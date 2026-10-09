// A tiny frame-graph: declare named buffers, textures and passes; the engine
// allocates the render targets, assigns texture units, binds inputs/outputs,
// and swaps ping-pong buffers. The effect only says WHAT happens, the
// pipeline decides WHERE (buffers/units) and WALKS the order.
//
// Example pass:
//   { frag, inputs: { u_source: 'scene' }, output: 'blurH',
//     uniforms: { u_texelSize: { texel: 'blurH' }, u_direction: [1, 0] } }
//
// Special values:
//   buffername               reads that buffer     (side: 'dst')
//   { buffer, side: 'src' }  reads the OTHER ping-pong texture (previous frame)
//   output buffer            writes it into the current 'dst' side
//   swap: ['dog']            swaps that ping-pong after the pass

import { Pass, type UniformApplier } from '../pass/pass';
import { PingPong } from '../pass/ping-pong';
import { PresentPass } from '../pass/present-pass';
import { createRenderTarget, type RenderTarget } from '../gl/framebuffer';
import { bindTexture } from '../gl/binding';
import type { FullScreenQuad } from '../gl/quad';

export interface MainSize {
	width: number;
	height: number;
}

export type BufferSide = 'dst' | 'src';

export interface BufferRef {
	buffer: string;
	side?: BufferSide;
}

export interface BufferSpec {
	name: string;
	width?: number;
	height?: number;
	/** main size divided by this when width/height are omitted. */
	scale?: number;
	/** gl.LINEAR (default) or gl.NEAREST. */
	filter?: number;
	/** Two alternating textures for temporal history (EMA). */
	pingPong?: boolean;
}

export interface TextureSpec {
	name: string;
	texture: WebGLTexture;
}

export type UniformSizeRef = { size: string } | { texel: string };

export type UniformValue = number | [number, number] | UniformSizeRef;

export interface PassSpec {
	frag: string;
	/** uniform name -> texture name or { buffer, side }. */
	inputs: Record<string, string | BufferRef>;
	/** buffer name, { buffer, side }, or omitted for the screen. */
	output?: string | { buffer: string; side?: BufferSide };
	/** ping-pong buffer names to swap after this pass. */
	swap?: string[];
	/** static uniforms: number, [x, y], { size } -> (w,h), { texel } -> (1/w,1/h). */
	uniforms?: Record<string, UniformValue>;
}

export interface PipelineOptions {
	mainSize: MainSize;
	uniforms: UniformApplier;
	buffers?: BufferSpec[];
	textures?: TextureSpec[];
	passes: PassSpec[];
}

interface Task {
	pass: Pass;
	/** Resolved per draw: ping-pong buffers change their 'dst' after a swap. */
	output: () => RenderTarget | null;
	inputs: Array<{ unit: number; texture: () => WebGLTexture }>;
	swaps: PingPong[];
}

export class Pipeline {
	private gl: WebGL2RenderingContext;
	private quad: FullScreenQuad;
	private mainSize: MainSize;
	private uniformApplier: UniformApplier;

	private buffers = new Map<string, RenderTarget | PingPong>();
	private textures = new Map<string, WebGLTexture>();
	private unitFor = new Map<string, number>();
	private nextUnit = 0;

	private tasks: Task[] = [];
	private presentPass: PresentPass | null = null;

	constructor(gl: WebGL2RenderingContext, quad: FullScreenQuad, options: PipelineOptions) {
		this.gl = gl;
		this.quad = quad;
		this.mainSize = options.mainSize;
		this.uniformApplier = options.uniforms;

		for (const spec of options.buffers ?? []) {
			const width = spec.width ?? Math.round(options.mainSize.width / (spec.scale ?? 1));
			const height = spec.height ?? Math.round(options.mainSize.height / (spec.scale ?? 1));
			const filter = spec.filter ?? gl.LINEAR;
			this.buffers.set(
				spec.name,
				spec.pingPong
					? new PingPong(gl, width, height)
					: createRenderTarget(gl, width, height, filter),
			);
		}

		for (const spec of options.textures ?? []) {
			this.textures.set(spec.name, spec.texture);
		}

		for (const spec of options.passes) {
			this.tasks.push(this.buildTask(spec));
		}
	}

	getBufferNames(): string[] {
		return [...this.buffers.keys()];
	}

	draw(): void {
		const gl = this.gl;
		for (const task of this.tasks) {
			const target = task.output();
			if (target) task.pass.bindOutput(target);
			else task.pass.bindScreen();

			for (const input of task.inputs) {
				bindTexture(gl, input.unit, input.texture());
			}

			task.pass.render();
		}

		// Swap ping-pong buffers AFTER every pass has read/written this frame,
		// so "src" always holds the most recent output at the start of draw().
		for (const task of this.tasks) {
			for (const ping of task.swaps) ping.swap();
		}
	}

	// Shows one named buffer on the screen (debug inspection).
	present(name: string): void {
		if (!this.presentPass) {
			this.presentPass = new PresentPass(this.gl, this.quad, this.nextUnit++);
		}
		// After draw() the ping-pong was swapped, so the latest output is on 'src'.
		const side: BufferSide = this.requireBuffer(name) instanceof PingPong ? 'src' : 'dst';
		this.presentPass.show(this.resolveRef({ buffer: name, side }));
	}

	// ---- internals ----

	private buildTask(spec: PassSpec): Task {
		const pass = new Pass(this.gl, this.quad, spec.frag, this.uniformApplier);

		const inputs: Task['inputs'] = [];
		for (const [uniform, ref] of Object.entries(spec.inputs)) {
			const unit = this.unitOf(ref);
			pass.setUniform1i(uniform, unit);
			inputs.push({ unit, texture: () => this.resolveRef(ref) });
		}

		for (const [name, value] of Object.entries(spec.uniforms ?? {})) {
			this.applyStaticUniform(pass, name, value);
		}

		const output = this.resolveOutput(spec.output);
		const swaps: PingPong[] = [];
		for (const name of spec.swap ?? []) {
			const buffer = this.requireBuffer(name);
			if (buffer instanceof PingPong) swaps.push(buffer);
			else throw new Error(`Pipeline: swap target "${name}" is not a ping-pong buffer.`);
		}

		return { pass, output, inputs, swaps };
	}

	private unitOf(ref: string | BufferRef): number {
		const key = typeof ref === 'string' ? `!${ref}` : `${ref.buffer}:${ref.side ?? 'dst'}`;
		let unit = this.unitFor.get(key);
		if (unit === undefined) {
			unit = this.nextUnit++;
			this.unitFor.set(key, unit);
		}
		return unit;
	}

	private resolveRef(ref: string | BufferRef): WebGLTexture {
		if (typeof ref === 'string') {
			const texture = this.textures.get(ref);
			if (texture) return texture; // external texture (video, atlases)
			// otherwise treat the name as a buffer
			const buffer = this.buffers.get(ref);
			if (buffer instanceof PingPong) return buffer.dst.texture;
			if (buffer) return buffer.texture;
			throw new Error(`Pipeline: unknown texture or buffer "${ref}".`);
		}
		const buffer = this.requireBuffer(ref.buffer);
		if (buffer instanceof PingPong) return buffer[ref.side ?? 'dst'].texture;
		return buffer.texture;
	}

	private resolveOutput(output: PassSpec['output']): () => RenderTarget | null {
		if (typeof output === 'string') {
			const buffer = this.requireBuffer(output);
			if (buffer instanceof PingPong) return () => buffer.dst;
			return () => buffer;
		}
		if (output?.buffer) {
			const buffer = this.requireBuffer(output.buffer);
			if (buffer instanceof PingPong) return () => buffer[output.side ?? 'dst'];
			return () => buffer;
		}
		return () => null; // screen
	}

	private sizeOf(name: string): [number, number] {
		if (name === 'main') return [this.mainSize.width, this.mainSize.height];
		const buffer = this.requireBuffer(name);
		const rt = buffer instanceof PingPong ? buffer.dst : buffer;
		return [rt.width, rt.height];
	}

	private applyStaticUniform(pass: Pass, name: string, value: UniformValue): void {
		if (typeof value === 'number') {
			pass.setUniform1f(name, value);
			return;
		}
		if (Array.isArray(value)) {
			pass.setUniform2f(name, value[0], value[1]);
			return;
		}
		if ('size' in value) {
			const [w, h] = this.sizeOf(value.size);
			pass.setUniform2f(name, w, h);
			return;
		}
		if ('texel' in value) {
			const [w, h] = this.sizeOf(value.texel);
			pass.setUniform2f(name, 1 / w, 1 / h);
			return;
		}
		throw new Error(`Pipeline: unsupported static uniform "${name}".`);
	}

	private requireBuffer(name: string): RenderTarget | PingPong {
		const buffer = this.buffers.get(name);
		if (!buffer) throw new Error(`Pipeline: unknown buffer "${name}".`);
		return buffer;
	}
}
