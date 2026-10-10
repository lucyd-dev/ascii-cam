// A fullscreen pass: one fragment shader drawn over the whole screen.
// The engine drives it declaratively (see pipeline.ts); this class only owns
// the program, the uniform plumbing, target/input binding and the draw call.

import vertSource from '../shaders/quad.vert?raw';
import { createProgram } from '../gl/program';
import { bindTexture, unbindTextureEverywhere } from '../gl/binding';
import type { FullScreenQuad } from '../gl/quad';
import type { RenderTarget } from '../gl/framebuffer';

export interface UniformApplier {
	applyTo(gl: WebGL2RenderingContext, program: WebGLProgram): void;
}

export class Pass {
	readonly program: WebGLProgram;

	protected gl: WebGL2RenderingContext;
	private quad: FullScreenQuad;
	private uniforms: UniformApplier;
	private locations = new Map<string, WebGLUniformLocation | null>();

	constructor(
		gl: WebGL2RenderingContext,
		quad: FullScreenQuad,
		fragSource: string,
		uniforms: UniformApplier,
		label?: string,
	) {
		this.gl = gl;
		this.quad = quad;
		this.uniforms = uniforms;
		this.program = createProgram(gl, vertSource, fragSource, label);
		gl.useProgram(this.program);
	}

	// ---- uniform helpers (locations are cached per program) ----

	setUniform1i(name: string, value: number): void {
		const loc = this.uniformLoc(name);
		if (loc) this.gl.uniform1i(loc, value);
	}

	setUniform1f(name: string, value: number): void {
		const loc = this.uniformLoc(name);
		if (loc) this.gl.uniform1f(loc, value);
	}

	setUniform2f(name: string, x: number, y: number): void {
		const loc = this.uniformLoc(name);
		if (loc) this.gl.uniform2f(loc, x, y);
	}

	setUniform3f(name: string, x: number, y: number, z: number): void {
		const loc = this.uniformLoc(name);
		if (loc) this.gl.uniform3f(loc, x, y, z);
	}

	setUniform4f(name: string, x: number, y: number, z: number, w: number): void {
		const loc = this.uniformLoc(name);
		if (loc) this.gl.uniform4f(loc, x, y, z, w);
	}

	// ---- target + input binding ----

	// Makes `target` the draw destination. Before drawing into a texture it is
	// detached from every unit it may be bound on, preventing a feedback loop.
	bindOutput(target: RenderTarget | null): void {
		const gl = this.gl;
		if (target) unbindTextureEverywhere(gl, target.texture);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo ?? null);
		gl.viewport(
			0,
			0,
			target?.width ?? gl.drawingBufferWidth,
			target?.height ?? gl.drawingBufferHeight,
		);
	}

	// Draws to the visible canvas (the default framebuffer).
	bindScreen(): void {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	}

	bindInput(unit: number, texture: WebGLTexture): void {
		bindTexture(this.gl, unit, texture);
	}

	// ---- draw ----

	render(): void {
		this.quad.bind(this.program);
		this.uniforms.applyTo(this.gl, this.program);
		this.quad.draw();
	}

	private uniformLoc(name: string): WebGLUniformLocation | null {
		let loc = this.locations.get(name);
		if (loc === undefined) {
			loc = this.gl.getUniformLocation(this.program, name);
			this.locations.set(name, loc);
		}
		return loc;
	}
}
