/**
 * NormalMapPipeline — Custom WebGL pipeline for normal-mapped 2D sprites.
 *
 * Normal maps add the illusion of depth to flat 2D sprites by
 * encoding surface normals in an RGB texture. This pipeline
 * reads the normal map and computes per-pixel lighting against
 * active light sources.
 *
 * Usage:
 *   // In BootScene after textures are loaded:
 *   game.renderer.pipelines.addPostPipeline('NormalMap', NormalMapPipeline);
 *
 *   // On a sprite:
 *   sprite.setPostPipeline('NormalMap');
 *   sprite.pipelineData.normalMap = 'sprite_normals';
 *
 * The pipeline receives light positions from the AdvancedLightingSystem
 * via a uniform buffer updated each frame.
 *
 * Note: Falls back gracefully to standard rendering in Canvas mode.
 */
export default class NormalMapPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game,
            name: 'NormalMapPipeline',
            fragShader: NormalMapPipeline.FRAG_SHADER
        });

        // Light uniforms (max 8 lights)
        this.maxLights = 8;
        this.lightPositions = new Float32Array(this.maxLights * 3);  // x, y, z
        this.lightColors = new Float32Array(this.maxLights * 4);     // r, g, b, intensity
        this.lightRadii = new Float32Array(this.maxLights);
        this.activeLightCount = 0;
        this.ambientColor = [0.15, 0.12, 0.2, 1.0];
    }

    onPreRender() {
        this.set1i('uNormalMap', 1);
        this.set1i('uLightCount', this.activeLightCount);
        this.set4fv('uAmbientColor', this.ambientColor);

        for (let i = 0; i < this.activeLightCount && i < this.maxLights; i++) {
            this.set3f(`uLightPos[${i}]`,
                this.lightPositions[i * 3],
                this.lightPositions[i * 3 + 1],
                this.lightPositions[i * 3 + 2]
            );
            this.set4f(`uLightColor[${i}]`,
                this.lightColors[i * 4],
                this.lightColors[i * 4 + 1],
                this.lightColors[i * 4 + 2],
                this.lightColors[i * 4 + 3]
            );
            this.set1f(`uLightRadius[${i}]`, this.lightRadii[i]);
        }
    }

    /**
     * Feed light data from AdvancedLightingSystem.
     */
    setLights(lights, cameraScrollX, cameraScrollY) {
        this.activeLightCount = Math.min(lights.length, this.maxLights);

        for (let i = 0; i < this.activeLightCount; i++) {
            const light = lights[i];
            // Convert world coords to screen coords
            this.lightPositions[i * 3] = light.x - cameraScrollX;
            this.lightPositions[i * 3 + 1] = light.y - cameraScrollY;
            this.lightPositions[i * 3 + 2] = light.z || 60; // height above surface

            const color = Phaser.Display.Color.IntegerToColor(light.color || 0xffffff);
            this.lightColors[i * 4] = color.redGL;
            this.lightColors[i * 4 + 1] = color.greenGL;
            this.lightColors[i * 4 + 2] = color.blueGL;
            this.lightColors[i * 4 + 3] = light.intensity || 1.0;

            this.lightRadii[i] = light.radius || 100;
        }
    }

    setAmbient(r, g, b, a) {
        this.ambientColor = [r, g, b, a || 1.0];
    }
}

// ----------------------------------------------------------------
// Fragment shader for normal-mapped lighting
// ----------------------------------------------------------------

NormalMapPipeline.FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;   // diffuse texture
uniform sampler2D uNormalMap;     // normal map texture
uniform int       uLightCount;
uniform vec4      uAmbientColor;
uniform vec3      uLightPos[8];
uniform vec4      uLightColor[8]; // rgb + intensity
uniform float     uLightRadius[8];

varying vec2 outTexCoord;

void main() {
    vec4 diffuse = texture2D(uMainSampler, outTexCoord);
    vec3 normal  = texture2D(uNormalMap, outTexCoord).rgb;

    // Decode normal from [0,1] to [-1,1]
    normal = normalize(normal * 2.0 - 1.0);

    // Start with ambient
    vec3 finalColor = diffuse.rgb * uAmbientColor.rgb * uAmbientColor.a;

    // Accumulate light contributions
    for (int i = 0; i < 8; i++) {
        if (i >= uLightCount) break;

        vec3 lightDir = uLightPos[i] - vec3(gl_FragCoord.xy, 0.0);
        float dist = length(lightDir);
        lightDir = normalize(lightDir);

        // Attenuation
        float atten = 1.0 - smoothstep(0.0, uLightRadius[i], dist);
        atten *= uLightColor[i].a; // intensity

        // Lambertian diffuse
        float ndotl = max(dot(normal, lightDir), 0.0);

        finalColor += diffuse.rgb * uLightColor[i].rgb * ndotl * atten;
    }

    gl_FragColor = vec4(finalColor, diffuse.a);
}
`;
