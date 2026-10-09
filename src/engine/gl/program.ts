// Low-level shader compilation and program linking.

export function createShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error('Shader-Error: ' + info);
	}
	return shader;
}

export function createProgram(
	gl: WebGL2RenderingContext,
	vertSource: string,
	fragSource: string,
): WebGLProgram {
	const program = gl.createProgram()!;
	gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertSource));
	gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragSource));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error('Link-Error: ' + gl.getProgramInfoLog(program));
	}
	return program;
}
