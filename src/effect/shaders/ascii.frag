#version 300 es
precision highp float;

out vec4 fragColor;

uniform sampler2D u_video;
uniform sampler2D u_fillAtlas;
uniform sampler2D u_edgeAtlas;
uniform sampler2D u_tileTexture; // 240x135 resolution buffer from Pass 2
uniform vec2 u_resolution;       // 1920.0, 1080.0
uniform bool u_monochromic;

const float BLOCK_SIZE = 8.0f;
const float FILL_GLYPH_COUNT = 10.0f;
const float EDGE_GLYPH_COUNT = 5.0f;

void main() {
    // Normalized coordinate over the whole screen [0.0, 1.0]
    vec2 screenUV = gl_FragCoord.xy / u_resolution;

    // Read precomputed tile result from Pass 2
    vec4 tileData = texture(u_tileTexture, screenUV);
    int glyphIndex = int(round(tileData.r * 255.0f));
    bool isEdge = tileData.g > 0.5f;
    float lum = tileData.b;

    // Sub-pixel position inside the 8x8 character cell [0.0, 1.0]
    vec2 cellUV = mod(gl_FragCoord.xy, BLOCK_SIZE) / BLOCK_SIZE;

    float glyphAlpha = 0.0f;

    if(isEdge) {
        float u = (float(glyphIndex) + cellUV.x) / EDGE_GLYPH_COUNT;
        glyphAlpha = texture(u_edgeAtlas, vec2(u, cellUV.y)).r;
    } else {
        float u = (float(glyphIndex) + cellUV.x) / FILL_GLYPH_COUNT;
        glyphAlpha = texture(u_fillAtlas, vec2(u, cellUV.y)).r;
    }

    if(!u_monochromic) {
        // Cell center color from camera
        vec2 blockCenterPixel = floor(gl_FragCoord.xy / BLOCK_SIZE) * BLOCK_SIZE + (BLOCK_SIZE * 0.5f);
        vec3 baseColor = texture(u_video, blockCenterPixel / u_resolution).rgb * 1.35f;

        // Slight contrast curve: lifts highlights, cleans shadows
        vec3 gradedColor = pow(baseColor, vec3(1.15f));

        fragColor = vec4(gradedColor * glyphAlpha, 1.0f);
    } else {
        vec3 bgColor = vec3(0.06f, 0.05f, 0.09f);
        vec3 shadowColor = vec3(0.10f, 0.06f, 0.22f);
        vec3 midColor = vec3(0.47f, 0.33f, 0.62f);
        vec3 highlightColor = vec3(1.0f, 0.84f, 0.84f);

        vec3 rampColor;
        if (lum < 0.5) {
            rampColor = mix(shadowColor, midColor, lum * 2.0);
        } else {
            rampColor = mix(midColor, highlightColor, (lum - 0.5) * 2.0);
        }

        vec3 cellBase = mix(bgColor, rampColor, 0.1f);
        vec3 finalColor = mix(cellBase, rampColor, glyphAlpha);

        fragColor = vec4(finalColor, 1.0f);
    }
}
