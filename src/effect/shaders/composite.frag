#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform float u_glowStrength;
uniform float u_bloomThreshold;
uniform float u_bloomKnee;

void main() {
    vec3 sharp = texture(u_scene, v_uv).rgb;
    vec3 glow  = texture(u_blur, v_uv).rgb;

    // Soft bright-pass so dark areas stay clean and only highlights bleed,
    // emulating a CRT phosphor glow.
    float luminance = dot(glow, vec3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(u_bloomThreshold, u_bloomThreshold + max(u_bloomKnee, 0.001), luminance);

    fragColor = vec4(sharp + glow * weight * u_glowStrength, 1.0);
}
