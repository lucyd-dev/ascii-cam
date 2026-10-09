// Tracks which texture currently sits on which unit.
// WebGL does not expose these bindings, so the engine remembers them itself.
// This is what makes automatic feedback-loop prevention possible:
// before rendering INTO a texture, we detach it from every unit it is on.

const unitBindings = new Map<number, WebGLTexture | null>();

export function bindTexture(gl: WebGL2RenderingContext, unit: number, texture: WebGLTexture): void {
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	unitBindings.set(unit, texture);
}

export function unbindTextureEverywhere(gl: WebGL2RenderingContext, texture: WebGLTexture): void {
	for (const [unit, bound] of unitBindings) {
		if (bound === texture) {
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, null);
			unitBindings.set(unit, null);
		}
	}
}
