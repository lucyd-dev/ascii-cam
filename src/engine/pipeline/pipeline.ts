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
import {
	createRenderTarget,
	generateMipmaps,
	type RenderTarget,
	type TextureFormat,
} from '../gl/framebuffer';
import { bindTexture } from '../gl/binding';
import { GpuTimer, type PassTiming } from '../gl/gpu-timer';
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
	/** Storage format; 'rgba8' (default) or 'r8' for grayscale data. */
	format?: TextureFormat;
	/** Two alternating textures for temporal history (EMA). */
	pingPong?: boolean;
	/** Keep a mip chain (rebuilt after each write) for clean minification. */
	mipmap?: boolean;
}

export interface TextureSpec {
	name: string;
	texture: WebGLTexture;
}

export type UniformSizeRef = { size: string } | { texel: string };

export type UniformValue = number | number[] | UniformSizeRef;

export interface PassSpec {
	/** Optional label used in validation and shader error messages. */
	name?: string;
	frag: string;
	/** uniform name -> texture name or { buffer, side }. */
	inputs: Record<string, string | BufferRef>;
	/** buffer name, { buffer, side }, or omitted for the screen. */
	output?: string | { buffer: string; side?: BufferSide };
	/** ping-pong buffer names to swap after this pass. */
	swap?: string[];
	/** When false the pass is skipped (debug bypass); default true. */
	enabled?: boolean;
	/** static uniforms: number, [x], [x,y], [x,y,z], [x,y,z,w],
	 *  { size } -> (w,h), { texel } -> (1/w,1/h). */
	uniforms?: Record<string, UniformValue>;
}

export interface PipelineOptions {
	mainSize: MainSize;
	/** One or more uniform sources; all are applied to every pass. */
	uniforms: UniformApplier | UniformApplier[];
	buffers?: BufferSpec[];
	textures?: TextureSpec[];
	passes: PassSpec[];
	/** Measure per-pass GPU time (EXT_disjoint_timer_query_webgl2). */
	timing?: boolean;
}

interface Task {
	/** Pass label, used for error messages and GPU timing. */
	name: string;
	pass: Pass;
	/** Resolved per draw: ping-pong buffers change their 'dst' after a swap. */
	output: () => RenderTarget | null;
	inputs: Array<{ unit: number; texture: () => WebGLTexture }>;
	swaps: PingPong[];
	enabled: boolean;
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
	private timer: GpuTimer | null = null;
	private debugView = 'final';

	constructor(gl: WebGL2RenderingContext, quad: FullScreenQuad, options: PipelineOptions) {
		this.gl = gl;
		this.quad = quad;
		this.mainSize = options.mainSize;
		const appliers = Array.isArray(options.uniforms) ? options.uniforms : [options.uniforms];
		this.uniformApplier = {
			applyTo: (gl, program) => {
				for (const applier of appliers) applier.applyTo(gl, program);
			},
		};
		if (options.timing) this.timer = new GpuTimer(gl);

		for (const spec of options.buffers ?? []) {
			const width = spec.width ?? Math.round(options.mainSize.width / (spec.scale ?? 1));
			const height = spec.height ?? Math.round(options.mainSize.height / (spec.scale ?? 1));
			const filter = spec.filter ?? gl.LINEAR;
			const format = spec.format ?? 'rgba8';
			const mipmap = spec.mipmap ?? false;
			this.buffers.set(
				spec.name,
				spec.pingPong
					? new PingPong(gl, width, height, filter, format, mipmap)
					: createRenderTarget(gl, width, height, filter, format, mipmap),
			);
		}

		for (const spec of options.textures ?? []) {
			this.textures.set(spec.name, spec.texture);
		}

		options.passes.forEach((spec, index) => {
			this.tasks.push(this.buildTask(spec, index));
		});
	}

	getBufferNames(): string[] {
		return [...this.buffers.keys()];
	}

	getPassNames(): string[] {
		return this.tasks.map((task) => task.name);
	}

	isPassEnabled(name: string): boolean {
		return this.tasks.find((task) => task.name === name)?.enabled ?? false;
	}

	setPassEnabled(name: string, enabled: boolean): void {
		const task = this.tasks.find((task) => task.name === name);
		if (task) task.enabled = enabled;
	}

	// Debug output: which buffer (if any) is shown instead of the final image.
	// 'final' (default) shows the normal result.
	getDebugView(): string {
		return this.debugView;
	}

	setDebugView(name: string): void {
		this.debugView = name;
	}

	// Last resolved per-pass GPU time in milliseconds (empty if timing is off
	// or the timer-query extension is unavailable). Results lag a few frames.
	getTimings(): ReadonlyMap<string, number> {
		return this.timer?.getTimings() ?? new Map();
	}

	// Rolling per-pass statistics (avg/min/max) for a stable readout.
	getTimingStats(): ReadonlyMap<string, PassTiming> {
		return this.timer?.getStats() ?? new Map();
	}

	draw(): void {
		const gl = this.gl;
		for (const task of this.tasks) {
			if (!task.enabled) continue;
			const target = task.output();
			if (target) task.pass.bindOutput(target);
			else task.pass.bindScreen();

			for (const input of task.inputs) {
				bindTexture(gl, input.unit, input.texture());
			}

			this.timer?.begin(task.name);
			task.pass.render();
			this.timer?.end(task.name);

			if (target?.mipmap) generateMipmaps(gl, target);
		}

		// Swap ping-pong buffers AFTER every pass has read/written this frame,
		// so "src" always holds the most recent output at the start of draw().
		// Disabled passes neither render nor swap.
		for (const task of this.tasks) {
			if (!task.enabled) continue;
			for (const ping of task.swaps) ping.swap();
		}

		this.timer?.poll();

		if (this.debugView !== 'final') this.present(this.debugView);
	}

	// Shows one named buffer on the screen (debug inspection).
	present(name: string): void {
		if (!this.presentPass) {
			this.presentPass = new PresentPass(this.gl, this.quad, this.nextUnit++);
		}
		// After draw() the ping-pong was swapped, so the latest output is on 'src'.
		const buffer = this.requireBuffer(name);
		const target = buffer instanceof PingPong ? buffer.src : buffer;
		this.presentPass.show(target.texture, target.format);
	}

	// ---- internals ----

	private buildTask(spec: PassSpec, index: number): Task {
		// A stable label so every validation / shader error names the culprit.
		const label = spec.name ?? `pass[${index}]`;

		// Fail fast, before any GL object is created, if an input refers to a
		// texture/buffer that was never declared.
		for (const [uniform, ref] of Object.entries(spec.inputs)) {
			this.assertRefExists(ref, `${label}: input "${uniform}"`);
		}

		const pass = new Pass(this.gl, this.quad, spec.frag, this.uniformApplier, label);

		const inputs: Task['inputs'] = [];
		for (const [uniform, ref] of Object.entries(spec.inputs)) {
			const unit = this.unitOf(ref);
			pass.setUniform1i(uniform, unit);
			inputs.push({ unit, texture: () => this.resolveRef(ref) });
		}

		for (const [name, value] of Object.entries(spec.uniforms ?? {})) {
			this.applyStaticUniform(pass, name, value);
		}

		const output = this.resolveOutput(spec.output, label);
		const swaps: PingPong[] = [];
		for (const name of spec.swap ?? []) {
			const buffer = this.requireBuffer(name, `${label}: swap`);
			if (buffer instanceof PingPong) swaps.push(buffer);
			else throw new Error(`Pipeline: [${label}] swap target "${name}" is not a ping-pong buffer.`);
		}

		return { name: label, pass, output, inputs, swaps, enabled: spec.enabled ?? true };
	}

	// Throws if `ref` does not name a declared texture or buffer.
	private assertRefExists(ref: string | BufferRef, context: string): void {
		const name = typeof ref === 'string' ? ref : ref.buffer;
		if (typeof ref === 'string') {
			if (this.textures.has(name) || this.buffers.has(name)) return;
		} else if (this.buffers.has(name)) {
			return;
		}
		throw new Error(`Pipeline: [${context}] references unknown texture or buffer "${name}".`);
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
			const buffer = this.buffers.get(ref);
			if (buffer instanceof PingPong) return buffer.dst.texture;
			if (buffer) return buffer.texture;
			throw new Error(`Pipeline: unknown texture or buffer "${ref}".`);
		}
		const buffer = this.requireBuffer(ref.buffer);
		if (buffer instanceof PingPong) return buffer[ref.side ?? 'dst'].texture;
		return buffer.texture;
	}

	private resolveOutput(output: PassSpec['output'], label?: string): () => RenderTarget | null {
		const context = label ? `${label}: output` : undefined;
		if (typeof output === 'string') {
			const buffer = this.requireBuffer(output, context);
			if (buffer instanceof PingPong) return () => buffer.dst;
			return () => buffer;
		}
		if (output?.buffer) {
			const buffer = this.requireBuffer(output.buffer, context);
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
			switch (value.length) {
				case 1:
					pass.setUniform1f(name, value[0]);
					return;
				case 2:
					pass.setUniform2f(name, value[0], value[1]);
					return;
				case 3:
					pass.setUniform3f(name, value[0], value[1], value[2]);
					return;
				case 4:
					pass.setUniform4f(name, value[0], value[1], value[2], value[3]);
					return;
			}
			throw new Error(`Pipeline: uniform "${name}" array must have 1-4 components.`);
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

	private requireBuffer(name: string, context?: string): RenderTarget | PingPong {
		const buffer = this.buffers.get(name);
		if (!buffer) {
			throw new Error(`Pipeline: unknown buffer "${name}"${context ? ` [${context}]` : ''}.`);
		}
		return buffer;
	}
}
