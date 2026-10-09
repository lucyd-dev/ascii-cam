#version 300 es
precision highp float;

out vec4 fragColor;

uniform sampler2D u_video;
uniform sampler2D u_dogTexture;
uniform vec2 u_resolution;     // 1920.0, 1080.0
uniform vec2 u_tileResolution; // 240.0, 135.0

const float BLOCK_SIZE = 8.0f;
const float PI = 3.14159265359f;
const float HALF_PI = 1.57079632679f;

const float EDGE_THRESHOLD = 0.12f;
uniform float u_minEdgeVotes;
const float FILL_GLYPH_COUNT = 10.0f;

const int bayer[16] = int[16](
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
);
uniform float u_ditherStrength;

// Rec. 709 luminance
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126f, 0.7152f, 0.0722f));
}

// Sample DoG buffer
float sampleDog(vec2 coord) {
    vec2 clamped = clamp(coord, vec2(0.0f), u_resolution - 1.0f);
    vec2 fboUV = clamped / u_resolution;
    return texture(u_dogTexture, fboUV).r;
}

// Sobel evaluation on DoG buffer
int evaluatePixelEdge(vec2 coord, out float edgeResponse) {
    float bl = sampleDog(coord + vec2(-1.0f, -1.0f));
    float b = sampleDog(coord + vec2(0.0f, -1.0f));
    float br = sampleDog(coord + vec2(1.0f, -1.0f));
    float l = sampleDog(coord + vec2(-1.0f, 0.0f));
    float r = sampleDog(coord + vec2(1.0f, 0.0f));
    float tl = sampleDog(coord + vec2(-1.0f, 1.0f));
    float t = sampleDog(coord + vec2(0.0f, 1.0f));
    float tr = sampleDog(coord + vec2(1.0f, 1.0f));

    float gx = ((tr + 2.0f * r + br) - (tl + 2.0f * l + bl)) / 4.0f;
    float gy = ((tl + 2.0f * t + tr) - (bl + 2.0f * b + br)) / 4.0f;

    edgeResponse  = length(vec2(gx, gy));
    if(edgeResponse < EDGE_THRESHOLD) {
        edgeResponse = EDGE_THRESHOLD;
        return 0;
    }

    float edgeAngle = atan(gy, gx) + HALF_PI;
    float normalizedAngle = fract(edgeAngle / PI);

    if(normalizedAngle < 0.125f || normalizedAngle >= 0.875f) {
        return 2; // Horizontal '-'
    } else if(normalizedAngle >= 0.125f && normalizedAngle < 0.375f) {
        return 3; // Diagonal '/'
    } else if(normalizedAngle >= 0.375f && normalizedAngle < 0.625f) {
        return 1; // Vertical '|'
    } else {
        return 4; // Diagonal '\'
    }
}

void main() {
    // Top-left tile grid space
    vec2 cellCoord = floor(gl_FragCoord.xy);

    int col = int(cellCoord.x) % 4;
    int row = int(cellCoord.y) % 4;
    int idx = row * 4 + col;
    float bayerValue = float(bayer[idx]);

    // Map cell position back to 1080p pixel coordinates
    vec2 blockOrigin = cellCoord * BLOCK_SIZE;
    vec2 blockCenterUV = (blockOrigin + (BLOCK_SIZE * 0.5f)) / u_resolution;

    vec3 tileColor = texture(u_video, blockCenterUV).rgb;
    float lum = getLuminance(tileColor);

    lum = clamp((lum - 0.08f) / 0.85f, 0.0f, 1.0f);
    lum = pow(lum, 0.75f);

    // Histogram voting across 64 pixels (runs only once per tile)
    float histogram[5];
    histogram[0] = 0.0f;
    histogram[1] = 0.0f;
    histogram[2] = 0.0f;
    histogram[3] = 0.0f;
    histogram[4] = 0.0f;

    for(float y = 0.5f; y < BLOCK_SIZE; y += 1.0f) {
        for(float x = 0.5f; x < BLOCK_SIZE; x += 1.0f) {
            vec2 samplePos = blockOrigin + vec2(x, y);
            float weight;
            int edgeType = evaluatePixelEdge(samplePos, weight);
            histogram[edgeType] += weight  - EDGE_THRESHOLD;
        }
    }

    float  totalEdgeVotes = histogram[1] + histogram[2] + histogram[3] + histogram[4];

    if(totalEdgeVotes >= u_minEdgeVotes) {
        // Find dominant edge direction
        int dominantEdge = 1;
        float  maxVotes = histogram[1];

        if(histogram[2] > maxVotes) {
            maxVotes = histogram[2];
            dominantEdge = 2;
        }
        if(histogram[3] > maxVotes) {
            maxVotes = histogram[3];
            dominantEdge = 3;
        }
        if(histogram[4] > maxVotes) {
            maxVotes = histogram[4];
            dominantEdge = 4;
        }

        // Output edge index (R) and edge flag = 1.0 (G)
        fragColor = vec4(float(dominantEdge) / 255.0f, 1.0f, lum, 1.0f);
    } else {
        // add bayer dithering
        float offset = (bayerValue / 16.0 - 0.5) * u_ditherStrength;
        int fillIndex = int(clamp(floor(lum * FILL_GLYPH_COUNT + offset), 0.0f, FILL_GLYPH_COUNT - 1.0f));

        // Output fill index (R) and edge flag = 0.0 (G)
        fragColor = vec4(float(fillIndex) / 255.0f, 0.0f, lum, 1.0f);
    }
}
