// Thin facade: owns the canvas-sized video texture and delegates everything
// else to the declarative engine pipeline.

import { FullScreenQuad } from '../engine';
import type { Pipeline } from '../engine';
import { settings } from './settings';
import { createEffectPipeline } from './pipeline';

export interface AsciiRendererOptions {
	fillAtlas: WebGLTexture;
	edgeAtlas: WebGLTexture;
}

export class AsciiRenderer {
	private gl: WebGL2RenderingContext;
	private videoTexture: WebGLTexture;
	private pipeline: Pipeline;

	private readonly width = 1920;
	private readonly height = 1080;

	constructor(gl: WebGL2RenderingContext, options: AsciiRendererOptions) {
		this.gl = gl;

		// Flip uploaded images (video + atlases) so they are not upside down.
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

		const canvas = gl.canvas as HTMLCanvasElement;
		canvas.width = this.width;
		canvas.height = this.height;

		this.videoTexture = gl.createTexture()!;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const quad = new FullScreenQuad(gl);
		this.pipeline = createEffectPipeline(
			gl,
			quad,
			settings,
			{ width: this.width, height: this.height },
			{
				fillAtlas: options.fillAtlas,
				edgeAtlas: options.edgeAtlas,
				videoTexture: this.videoTexture,
			},
		);
	}

	render(video: HTMLVideoElement): void {
		const gl = this.gl;

		// Upload the latest webcam frame.
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

		this.pipeline.draw();

		// Debug output: show an intermediate buffer instead of the result.
		const debugView = settings.get('debugView');
		if (typeof debugView === 'string' && debugView !== 'final') {
			this.pipeline.present(debugView);
		}
	}
}
