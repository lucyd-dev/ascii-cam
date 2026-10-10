#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_video;
uniform sampler2D u_history;
uniform float u_emaAlpha;
uniform float u_dogGain;
uniform vec2 u_resolution;

float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Sample directly in normalized texture space
float sampleLum(vec2 uvOffset) {
    vec2 uv = clamp(v_uv + uvOffset / u_resolution, vec2(0.0), vec2(1.0));
    return getLuminance(texture(u_video, uv).rgb);
}

void main() {
    // 1. Narrow Gaussian (Radius 1)
    float narrow =
        (sampleLum(vec2(-1.0, -1.0)) + sampleLum(vec2( 1.0, -1.0)) +
         sampleLum(vec2(-1.0,  1.0)) + sampleLum(vec2( 1.0,  1.0))) * 1.0 +
        (sampleLum(vec2( 0.0, -1.0)) + sampleLum(vec2( 0.0,  1.0)) +
         sampleLum(vec2(-1.0,  0.0)) + sampleLum(vec2( 1.0,  0.0))) * 2.0 +
        sampleLum(vec2(0.0, 0.0)) * 4.0;
    narrow /= 16.0;

    // 2. Wide Gaussian (Radius 2)
    float wide =
        (sampleLum(vec2(-2.0, -2.0)) + sampleLum(vec2( 2.0, -2.0)) +
         sampleLum(vec2(-2.0,  2.0)) + sampleLum(vec2( 2.0,  2.0))) * 1.0 +
        (sampleLum(vec2( 0.0, -2.0)) + sampleLum(vec2( 0.0,  2.0)) +
         sampleLum(vec2(-2.0,  0.0)) + sampleLum(vec2( 2.0,  0.0))) * 2.0 +
        narrow * 8.0;
    wide /= 20.0;

    // Difference of Gaussians
    float tau = 0.98;
    float diff = narrow - (tau * wide);
    float edgeSignal = clamp(diff * u_dogGain + 0.5, 0.0, 1.0);

    float previous = texture(u_history, v_uv).r;
    float smoothed = mix(previous, edgeSignal, u_emaAlpha);
    fragColor = vec4(vec3(smoothed), 1.0);
}
