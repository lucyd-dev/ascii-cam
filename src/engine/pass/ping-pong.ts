// Two render targets with strictly alternating roles (src/dst).
// Used whenever a pass must read the previous frame's result
// while writing the next one (e.g. temporal EMA).

import {
	createRenderTarget,
	type RenderTarget,
	type TextureFormat,
} from '../gl/framebuffer';

export class PingPong {
	readonly targets: [RenderTarget, RenderTarget];
	private index: number = 0;

	constructor(
		gl: WebGL2RenderingContext,
		width: number,
		height: number,
		filter: number = gl.LINEAR,
		format: TextureFormat = 'rgba8',
		mipmap = false,
	) {
		this.targets = [
			createRenderTarget(gl, width, height, filter, format, mipmap),
			createRenderTarget(gl, width, height, filter, format, mipmap),
		];
	}

	get src(): RenderTarget {
		return this.targets[1 - this.index];
	}

	get dst(): RenderTarget {
		return this.targets[this.index];
	}

	swap(): void {
		this.index = 1 - this.index;
	}
}
