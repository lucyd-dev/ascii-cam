// Off-screen render target: a texture a pass can draw into.
// Framebuffer + texture + size live in one object.

// Storage formats supported by render targets. 'r8' is a single-channel
// unsigned byte target (1 byte/texel) for grayscale data; 'rgba8' is the
// default 4-byte/texel color target.
export type TextureFormat = 'rgba8' | 'r8';

interface GLFormat {
	internalFormat: number;
	format: number;
	type: number;
}

function resolveFormat(gl: WebGL2RenderingContext, format: TextureFormat): GLFormat {
	switch (format) {
		case 'r8':
			return { internalFormat: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE };
		case 'rgba8':
			return { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
	}
}

export interface RenderTarget {
	texture: WebGLTexture;
	fbo: WebGLFramebuffer;
	width: number;
	height: number;
	format: TextureFormat;
}

export function createRenderTarget(
	gl: WebGL2RenderingContext,
	width: number,
	height: number,
	filter: number,
	format: TextureFormat = 'rgba8',
): RenderTarget {
	const glFormat = resolveFormat(gl, format);

	const texture = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		glFormat.internalFormat,
		width,
		height,
		0,
		glFormat.format,
		glFormat.type,
		null,
	);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const fbo = gl.createFramebuffer()!;
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

	// Fail loudly on an incomplete target (e.g. an unsupported format) instead
	// of silently rendering nothing into it.
	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		throw new Error(
			`RenderTarget ${width}x${height} (${format}) is incomplete: ` +
				`0x${status.toString(16)}. The format may be unsupported.`,
		);
	}

	// Leave the texture unbound so it cannot linger on a unit as a stale
	// raw binding (a common source of feedback-loop errors).
	gl.bindTexture(gl.TEXTURE_2D, null);

	return { texture, fbo, width, height, format };
}
