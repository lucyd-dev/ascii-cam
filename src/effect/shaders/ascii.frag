#version 300 es
precision highp float;

out vec4 fragColor;

uniform sampler2D u_video;
uniform sampler2D u_fillAtlas;
uniform sampler2D u_edgeAtlas;
uniform sampler2D u_tileTexture;
uniform vec2 u_resolution;
uniform vec2 u_tileResolution;
uniform bool u_monochromic;
uniform vec3 u_paletteBg;
uniform vec3 u_paletteShadow;
uniform vec3 u_paletteMid;
uniform vec3 u_paletteHighlight;

const float FILL_GLYPH_COUNT = 10.0f;
const float EDGE_GLYPH_COUNT = 5.0f;

void main() {
    vec2 screenUV = gl_FragCoord.xy / u_resolution;

    vec4 tileData = texture(u_tileTexture, screenUV);
    int glyphIndex = int(round(tileData.r * 255.0f));
    bool isEdge = tileData.g > 0.5f;
    float lum = tileData.b;

    vec2 block = u_resolution / u_tileResolution;
    vec2 cellUV = mod(gl_FragCoord.xy, block) / block;

    float glyphAlpha = 0.0f;

    if(isEdge) {
        float u = (float(glyphIndex) + cellUV.x) / EDGE_GLYPH_COUNT;
        glyphAlpha = texture(u_edgeAtlas, vec2(u, cellUV.y)).r;
    } else {
        float u = (float(glyphIndex) + cellUV.x) / FILL_GLYPH_COUNT;
        glyphAlpha = texture(u_fillAtlas, vec2(u, cellUV.y)).r;
    }

    if(!u_monochromic) {
        vec2 blockCenterPixel = floor(gl_FragCoord.xy / block) * block + block * 0.5f;
        vec3 baseColor = texture(u_video, blockCenterPixel / u_resolution).rgb * 1.35f;

        // Slight contrast curve: lifts highlights, cleans shadows
        vec3 gradedColor = pow(baseColor, vec3(1.15f));

        fragColor = vec4(gradedColor * glyphAlpha, 1.0f);
    } else {
        vec3 rampColor;
        if (lum < 0.5) {
            rampColor = mix(u_paletteShadow, u_paletteMid, lum * 2.0);
        } else {
            rampColor = mix(u_paletteMid, u_paletteHighlight, (lum - 0.5) * 2.0);
        }

        vec3 cellBase = mix(u_paletteBg, rampColor, 0.1f);
        vec3 finalColor = mix(cellBase, rampColor, glyphAlpha);

        fragColor = vec4(finalColor, 1.0f);
    }
}
