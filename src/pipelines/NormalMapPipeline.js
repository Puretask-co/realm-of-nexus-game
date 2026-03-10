/**
 * NormalMapPipeline - Custom WebGL pipeline for per-pixel normal-mapped lighting.
 *
 * Extends Phaser's SinglePipeline to inject a fragment shader that reads from
 * a normal map texture and calculates diffuse + specular lighting against an
 * array of dynamic light sources passed in as uniforms.
 *
 * Supports up to MAX_LIGHTS simultaneous lights per draw call.  Each light is
 * described by position (screen-space), colour, intensity, and radius.
 *
 * For non-WebGL renderers (Canvas fallback) this class provides no-op stubs
 * so the rest of the codebase can reference it safely.
 *
 * Part of the Realm of Nexus / Verdance project.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_LIGHTS = 16;

// ── GLSL source ────────────────────────────────────────────────────────────────

const VERT_SHADER = `
precision mediump float;

attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute float inTintEffect;
attribute vec4 inTint;

uniform mat4 uProjectionMatrix;

varying vec2 vTexCoord;
varying vec4 vTint;
varying float vTintEffect;

void main () {
    gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);
    vTexCoord   = inTexCoord;
    vTint       = inTint;
    vTintEffect = inTintEffect;
}
`;

const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;   // diffuse / colour texture
uniform sampler2D uNormalSampler;  // normal map

// Light data arrays (screen-space)
uniform int   uLightCount;
uniform vec3  uLightPos[${MAX_LIGHTS}];       // x, y, z (z = height above surface)
uniform vec3  uLightColor[${MAX_LIGHTS}];     // r, g, b  (0..1)
uniform float uLightIntensity[${MAX_LIGHTS}]; // 0..N
uniform float uLightRadius[${MAX_LIGHTS}];    // in pixels

// Ambient
uniform vec3  uAmbientColor;
uniform float uAmbientIntensity;

// Texture resolution (for coordinate scaling)
uniform vec2 uResolution;

varying vec2 vTexCoord;
varying vec4 vTint;
varying float vTintEffect;

void main () {
    vec4 diffuse = texture2D(uMainSampler, vTexCoord);
    if (diffuse.a < 0.01) {
        discard;
    }

    // Sample normal map and unpack from [0,1] to [-1,1]
    vec3 normal = texture2D(uNormalSampler, vTexCoord).rgb;
    normal = normalize(normal * 2.0 - 1.0);

    // Accumulate lighting
    vec3 totalLight = uAmbientColor * uAmbientIntensity;

    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;

        // Fragment position in screen pixels
        vec2 fragPos = vTexCoord * uResolution;

        // Direction from fragment to light (2D with z for height)
        vec3 lightDir = vec3(uLightPos[i].xy - fragPos, uLightPos[i].z);
        float distance = length(lightDir);
        lightDir = normalize(lightDir);

        // Attenuation: smooth falloff based on radius
        float attenuation = 1.0 - smoothstep(0.0, uLightRadius[i], distance);
        attenuation *= uLightIntensity[i];

        // Diffuse (Lambert)
        float diff = max(dot(normal, lightDir), 0.0);

        // Specular (Blinn-Phong)
        vec3 viewDir  = vec3(0.0, 0.0, 1.0); // top-down view
        vec3 halfDir  = normalize(lightDir + viewDir);
        float spec    = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.3;

        totalLight += uLightColor[i] * (diff + spec) * attenuation;
    }

    // Apply accumulated lighting to the diffuse colour
    vec3 lit = diffuse.rgb * totalLight;

    // Apply Phaser tint
    vec4 color = vec4(lit, diffuse.a);

    if (vTintEffect < 0.5) {
        color.rgb *= vTint.rgb;
    } else {
        color.rgb = mix(color.rgb, vTint.rgb, vTint.a);
    }

    gl_FragColor = color;
}
`;

// ── Pipeline class ─────────────────────────────────────────────────────────────

/**
 * Checks whether we are running under a WebGL renderer (and whether the
 * necessary Phaser pipeline base class exists).  This allows the module to
 * be safely imported in Canvas-mode games without throwing.
 */
function isWebGLAvailable() {
  return (
    typeof Phaser !== 'undefined' &&
    Phaser.Renderer &&
    Phaser.Renderer.WebGL &&
    Phaser.Renderer.WebGL.Pipelines &&
    Phaser.Renderer.WebGL.Pipelines.SinglePipeline
  );
}

/**
 * Build the actual pipeline class only if WebGL pipelines are available.
 * Otherwise export a lightweight fallback that silently no-ops.
 */
let NormalMapPipelineClass;

if (isWebGLAvailable()) {
  NormalMapPipelineClass = class NormalMapPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    /**
     * @param {Phaser.Game} game - The Phaser Game instance.
     */
    constructor(game) {
      super({
        game,
        name: 'NormalMapPipeline',
        fragShader: FRAG_SHADER,
        vertShader: VERT_SHADER,
        uniforms: [
          'uProjectionMatrix',
          'uMainSampler',
          'uNormalSampler',
          'uLightCount',
          'uLightPos',
          'uLightColor',
          'uLightIntensity',
          'uLightRadius',
          'uAmbientColor',
          'uAmbientIntensity',
          'uResolution',
        ],
      });

      /**
       * Currently-bound normal map WebGL texture reference.
       * Set by calling setNormalMap() before drawing a sprite.
       * @type {WebGLTexture|null}
       */
      this._normalMapTexture = null;

      /** Cached light uniform arrays (avoid per-frame allocations). */
      this._lightPos = new Float32Array(MAX_LIGHTS * 3);
      this._lightColor = new Float32Array(MAX_LIGHTS * 3);
      this._lightIntensity = new Float32Array(MAX_LIGHTS);
      this._lightRadius = new Float32Array(MAX_LIGHTS);
      this._lightCount = 0;

      /** Ambient defaults. */
      this._ambientColor = new Float32Array([0.1, 0.1, 0.15]);
      this._ambientIntensity = 0.2;
    }

    /**
     * Called by Phaser whenever a game object using this pipeline is about
     * to be rendered.  We upload the normal map texture unit and all light
     * uniforms here.
     *
     * @param {Phaser.GameObjects.GameObject} gameObject
     * @returns {this}
     */
    onBind(gameObject) {
      super.onBind(gameObject);

      // Upload normal map to texture unit 1
      if (this._normalMapTexture) {
        this.set1i('uNormalSampler', 1);
        this.renderer.gl.activeTexture(this.renderer.gl.TEXTURE1);
        this.renderer.gl.bindTexture(
          this.renderer.gl.TEXTURE_2D,
          this._normalMapTexture,
        );
        this.renderer.gl.activeTexture(this.renderer.gl.TEXTURE0);
      }

      // Resolution
      const width = this.renderer.width;
      const height = this.renderer.height;
      this.set2f('uResolution', width, height);

      // Ambient
      this.set3fv('uAmbientColor', this._ambientColor);
      this.set1f('uAmbientIntensity', this._ambientIntensity);

      // Lights
      this.set1i('uLightCount', this._lightCount);

      if (this._lightCount > 0) {
        this.set3fv('uLightPos', this._lightPos);
        this.set3fv('uLightColor', this._lightColor);
        this.set1fv('uLightIntensity', this._lightIntensity);
        this.set1fv('uLightRadius', this._lightRadius);
      }

      return this;
    }

    /**
     * Provide the raw WebGL texture to use as the normal map.
     *
     * @param {WebGLTexture} texture
     * @returns {this}
     */
    setNormalMap(texture) {
      this._normalMapTexture = texture;
      return this;
    }

    /**
     * Bulk-set light data from the AdvancedLightingSystem's light collection.
     *
     * Each entry in the array should look like:
     * ```
     * { x, y, z?, color: 0xRRGGBB, intensity, radius }
     * ```
     *
     * @param {Array<Object>} lights - Array of light descriptors.
     * @returns {this}
     */
    setLightData(lights) {
      const count = Math.min(lights.length, MAX_LIGHTS);
      this._lightCount = count;

      for (let i = 0; i < count; i++) {
        const l = lights[i];
        const base = i * 3;

        this._lightPos[base] = l.x;
        this._lightPos[base + 1] = l.y;
        this._lightPos[base + 2] = l.z ?? 60; // default height

        this._lightColor[base] = ((l.color >> 16) & 0xff) / 255;
        this._lightColor[base + 1] = ((l.color >> 8) & 0xff) / 255;
        this._lightColor[base + 2] = (l.color & 0xff) / 255;

        this._lightIntensity[i] = l.intensity ?? 1;
        this._lightRadius[i] = l.radius ?? 200;
      }

      // Zero out remaining slots
      for (let i = count; i < MAX_LIGHTS; i++) {
        const base = i * 3;
        this._lightPos[base] = 0;
        this._lightPos[base + 1] = 0;
        this._lightPos[base + 2] = 0;
        this._lightColor[base] = 0;
        this._lightColor[base + 1] = 0;
        this._lightColor[base + 2] = 0;
        this._lightIntensity[i] = 0;
        this._lightRadius[i] = 0;
      }

      return this;
    }

    /**
     * Set the ambient light colour and intensity used by the shader.
     *
     * @param {number} color     - 0xRRGGBB
     * @param {number} intensity - 0..1
     * @returns {this}
     */
    setAmbient(color, intensity) {
      this._ambientColor[0] = ((color >> 16) & 0xff) / 255;
      this._ambientColor[1] = ((color >> 8) & 0xff) / 255;
      this._ambientColor[2] = (color & 0xff) / 255;
      this._ambientIntensity = intensity;
      return this;
    }

    /**
     * Convenience: register this pipeline on a Phaser game instance.
     * Call during the Boot scene or before any sprite uses the pipeline.
     *
     * @param {Phaser.Game} game
     */
    static register(game) {
      if (game.renderer && game.renderer.pipelines) {
        game.renderer.pipelines.addPostPipeline('NormalMapPipeline', NormalMapPipelineClass);
      }
    }
  };
} else {
  // ── Canvas / fallback stub ─────────────────────────────────────────────────
  NormalMapPipelineClass = class NormalMapPipeline {
    constructor() {
      console.warn(
        '[NormalMapPipeline] WebGL not available. Normal-map lighting disabled.',
      );
      this._lightCount = 0;
    }

    onBind() {
      return this;
    }

    setNormalMap() {
      return this;
    }

    setLightData() {
      return this;
    }

    setAmbient() {
      return this;
    }

    static register() {
      /* no-op */
    }
  };
}

export const NormalMapPipeline = NormalMapPipelineClass;
export default NormalMapPipeline;
