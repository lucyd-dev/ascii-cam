#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform bool u_singleChannel;

void main() {
	vec4 texel = texture(u_source, v_uv);
	// A single-channel (R8) target samples as (r, 0, 0, 1). Replicate the red
	// channel so grayscale buffers preview as gray instead of red.
	if (u_singleChannel) {
		fragColor = vec4(vec3(texel.r), 1.0);
	} else {
		fragColor = texel;
	}
}