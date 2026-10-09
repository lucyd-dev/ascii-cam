// Uploads an image (URL) into a GPU texture.

export async function loadTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
	const img = new Image();
	img.src = url;
	await img.decode();

	const texture = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Pixel-art textures (glyph atlases) should stay pixel-sharp, hence NEAREST.
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

	// Leave the texture unbound; the pipeline binds it when it is sampled.
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}
