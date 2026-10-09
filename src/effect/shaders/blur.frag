#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform vec2 u_direction;

void main() {
	vec2 step = u_texelSize * u_direction;

	vec3 sum = texture(u_source, v_uv).rgb * (6.0f / 16.0f);
	sum += texture(u_source, v_uv + step).rgb * (4.0f / 16.0f);
	sum += texture(u_source, v_uv - step).rgb * (4.0f / 16.0f);
	sum += texture(u_source, v_uv + step * 2.0f).rgb * (1.0f / 16.0f);
	sum += texture(u_source, v_uv - step * 2.0f).rgb * (1.0f / 16.0f);

	fragColor = vec4(sum, 1.0f);
}
