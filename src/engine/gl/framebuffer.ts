// Off-screen render target: a texture a pass can draw into.
// Framebuffer + texture + size live in one object.

export interface RenderTarget {
	texture: WebGLTexture;
	fbo: WebGLFramebuffer;
	width: number;
	height: number;
}

export function createRenderTarget(
	gl: WebGL2RenderingContext,
	width: number,
	height: number,
	filter: number,
): RenderTarget {
	const texture = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const fbo = gl.createFramebuffer()!;
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

	// Leave the texture unbound so it cannot linger on a unit as a stale
	// raw binding (a common source of feedback-loop errors).
	gl.bindTexture(gl.TEXTURE_2D, null);

	return { texture, fbo, width, height };
}
