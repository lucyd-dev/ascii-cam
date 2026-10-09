// Creates the WebGL2 context and applies engine-level defaults
// (e.g. vertical flip for uploaded images).

export interface GLContextOptions {
	flipY?: boolean;
}

export function createGLContext(
	canvas: HTMLCanvasElement,
	options: GLContextOptions = {},
): WebGL2RenderingContext {
	const gl = canvas.getContext('webgl2');
	if (!gl) throw new Error('WebGL 2 not supported');
	if (options.flipY !== false) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	return gl;
}
