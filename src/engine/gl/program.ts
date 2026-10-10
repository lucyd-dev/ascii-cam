// Low-level shader compilation and program linking.

// `label` is an optional human-readable tag (e.g. the pass name) included in
// error messages so a broken shader can be traced back to its pipeline entry.
export function createShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
	label?: string,
): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
		throw new Error(`Shader compile error [${label ?? kind}]: ${info ?? '(no info log)'}`);
	}
	return shader;
}

export function createProgram(
	gl: WebGL2RenderingContext,
	vertSource: string,
	fragSource: string,
	label?: string,
): WebGLProgram {
	const program = gl.createProgram()!;
	gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertSource, label));
	gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragSource, label));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		throw new Error(`Program link error [${label ?? 'unnamed'}]: ${info ?? '(no info log)'}`);
	}
	return program;
}
