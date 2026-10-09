#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform float u_glowStrength;

void main() {
    vec3 sharp = texture(u_scene, v_uv).rgb;
    vec3 glow  = texture(u_blur, v_uv).rgb;
    fragColor = vec4(sharp + glow * u_glowStrength, 1.0);
}
