// The shared fullscreen quad (two triangles covering the whole canvas).
// Every fullscreen pass draws this.

export class FullScreenQuad {
	private gl: WebGL2RenderingContext;
	private buffer: WebGLBuffer;
	private attribLocations: Map<WebGLProgram, number> = new Map();

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		this.buffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
	}

	bind(program: WebGLProgram): void {
		this.gl.useProgram(program);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

		let loc = this.attribLocations.get(program);
		if (loc === undefined) {
			loc = this.gl.getAttribLocation(program, 'a_position');
			this.attribLocations.set(program, loc);
		}

		this.gl.enableVertexAttribArray(loc);
		this.gl.vertexAttribPointer(loc, 2, this.gl.FLOAT, false, 0, 0);
	}

	draw(): void {
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
	}
}
