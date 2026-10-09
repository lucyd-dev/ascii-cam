// Engine utility: copies any texture 1:1 to the screen.
// Used by the pipeline's debug feature to inspect intermediate buffers.

import presentFragSource from '../shaders/present.frag?raw';
import { Pass, type UniformApplier } from './pass';
import type { FullScreenQuad } from '../gl/quad';

const NOOP_UNIFORMS: UniformApplier = { applyTo() {} };

export class PresentPass extends Pass {
	private unit: number;

	constructor(gl: WebGL2RenderingContext, quad: FullScreenQuad, unit: number) {
		super(gl, quad, presentFragSource, NOOP_UNIFORMS);
		this.unit = unit;
		this.setUniform1i('u_source', unit);
	}

	show(texture: WebGLTexture): void {
		this.bindScreen();
		this.bindInput(this.unit, texture);
		this.render();
	}
}
