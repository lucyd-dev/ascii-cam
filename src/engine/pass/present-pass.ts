// Engine utility: copies any texture 1:1 to the screen.
// Used by the pipeline's debug feature to inspect intermediate buffers.

import presentFragSource from '../shaders/present.frag?raw';
import { Pass, type UniformApplier } from './pass';
import type { FullScreenQuad } from '../gl/quad';
import type { TextureFormat } from '../gl/framebuffer';

const NOOP_UNIFORMS: UniformApplier = { applyTo() {} };

export class PresentPass extends Pass {
	private unit: number;

	constructor(gl: WebGL2RenderingContext, quad: FullScreenQuad, unit: number) {
		super(gl, quad, presentFragSource, NOOP_UNIFORMS, 'present');
		this.unit = unit;
		this.setUniform1i('u_source', unit);
	}

	show(texture: WebGLTexture, format: TextureFormat = 'rgba8'): void {
		// Make the present program current before setting its uniform.
		this.gl.useProgram(this.program);
		this.setUniform1i('u_singleChannel', format === 'r8' ? 1 : 0);
		this.bindScreen();
		this.bindInput(this.unit, texture);
		this.render();
	}
}
