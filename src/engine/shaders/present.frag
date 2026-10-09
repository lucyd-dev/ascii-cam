#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;

void main() {
	fragColor = texture(u_source, v_uv);
}