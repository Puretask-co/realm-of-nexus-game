/**
 * PostProcessingPipeline — Fullscreen post-processing effects.
 *
 * Effects available:
 *  - Vignette: darkened edges for atmospheric framing
 *  - Color grading: per-phase tint overlay (blue / crimson / silver)
 *  - Bloom (approximated): brighten highlights above threshold
 *  - Scanlines: retro CRT-style lines (optional aesthetic)
 *  - Desaturation: used during pause or death screen
 *
 * Usage:
 *   this.cameras.main.setPostPipeline(PostProcessingPipeline);
 *   const pp = this.cameras.main.getPostPipeline(PostProcessingPipeline);
 *   pp.setPhase('crimson');
 *   pp.setVignetteStrength(0.4);
 */
export default class PostProcessingPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game,
            name: 'PostProcessingPipeline',
            fragShader: PostProcessingPipeline.FRAG_SHADER
        });

        // Defaults
        this._vignetteStrength = 0.3;
        this._vignetteRadius = 0.85;
        this._tintColor = [0.0, 0.0, 0.0]; // additive tint
        this._tintStrength = 0.0;
        this._bloomThreshold = 0.8;
        this._bloomStrength = 0.0;
        this._scanlineStrength = 0.0;
        this._desaturation = 0.0;
        this._time = 0;
    }

    onPreRender() {
        this._time += 0.016;

        this.set1f('uVignetteStrength', this._vignetteStrength);
        this.set1f('uVignetteRadius', this._vignetteRadius);
        this.set3fv('uTintColor', this._tintColor);
        this.set1f('uTintStrength', this._tintStrength);
        this.set1f('uBloomThreshold', this._bloomThreshold);
        this.set1f('uBloomStrength', this._bloomStrength);
        this.set1f('uScanlineStrength', this._scanlineStrength);
        this.set1f('uDesaturation', this._desaturation);
        this.set1f('uTime', this._time);
        this.set2f('uResolution',
            this.renderer.width,
            this.renderer.height
        );
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    setVignetteStrength(value) {
        this._vignetteStrength = Phaser.Math.Clamp(value, 0, 1);
    }

    setPhase(phase) {
        const phaseColors = {
            blue:    [0.05, 0.08, 0.2],
            crimson: [0.2,  0.05, 0.05],
            silver:  [0.1,  0.1,  0.15]
        };
        this._tintColor = phaseColors[phase] || [0, 0, 0];
        this._tintStrength = 0.15;
    }

    setTint(r, g, b, strength) {
        this._tintColor = [r, g, b];
        this._tintStrength = strength;
    }

    setBloom(threshold, strength) {
        this._bloomThreshold = threshold;
        this._bloomStrength = strength;
    }

    setScanlines(strength) {
        this._scanlineStrength = strength;
    }

    setDesaturation(amount) {
        this._desaturation = Phaser.Math.Clamp(amount, 0, 1);
    }

    /**
     * Transition to death screen effect.
     */
    deathEffect(duration = 1000) {
        // Gradually desaturate and vignette
        const startDesat = this._desaturation;
        const startVig = this._vignetteStrength;
        const steps = 30;
        const interval = duration / steps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const t = step / steps;
            this._desaturation = Phaser.Math.Linear(startDesat, 0.8, t);
            this._vignetteStrength = Phaser.Math.Linear(startVig, 0.7, t);
            this._tintColor = [0.15 * t, 0, 0];
            this._tintStrength = 0.3 * t;

            if (step >= steps) clearInterval(timer);
        }, interval);
    }

    /**
     * Reset all effects to defaults.
     */
    reset() {
        this._vignetteStrength = 0.3;
        this._vignetteRadius = 0.85;
        this._tintColor = [0, 0, 0];
        this._tintStrength = 0;
        this._bloomStrength = 0;
        this._scanlineStrength = 0;
        this._desaturation = 0;
    }
}

// ----------------------------------------------------------------
// Fragment shader
// ----------------------------------------------------------------

PostProcessingPipeline.FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2      uResolution;
uniform float     uTime;
uniform float     uVignetteStrength;
uniform float     uVignetteRadius;
uniform vec3      uTintColor;
uniform float     uTintStrength;
uniform float     uBloomThreshold;
uniform float     uBloomStrength;
uniform float     uScanlineStrength;
uniform float     uDesaturation;

varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    vec3 rgb = color.rgb;

    // --- Bloom (simple threshold glow) ---
    if (uBloomStrength > 0.0) {
        float brightness = dot(rgb, vec3(0.299, 0.587, 0.114));
        if (brightness > uBloomThreshold) {
            float excess = (brightness - uBloomThreshold) * uBloomStrength;
            rgb += rgb * excess;
        }
    }

    // --- Desaturation ---
    if (uDesaturation > 0.0) {
        float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
        rgb = mix(rgb, vec3(grey), uDesaturation);
    }

    // --- Color tint ---
    if (uTintStrength > 0.0) {
        rgb = mix(rgb, rgb + uTintColor, uTintStrength);
    }

    // --- Vignette ---
    if (uVignetteStrength > 0.0) {
        vec2 uv = outTexCoord;
        float dist = distance(uv, vec2(0.5));
        float vig = smoothstep(uVignetteRadius, uVignetteRadius - 0.4, dist);
        rgb *= mix(1.0, vig, uVignetteStrength);
    }

    // --- Scanlines ---
    if (uScanlineStrength > 0.0) {
        float scanline = sin(outTexCoord.y * uResolution.y * 1.5) * 0.5 + 0.5;
        rgb *= 1.0 - (uScanlineStrength * (1.0 - scanline) * 0.15);
    }

    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
`;
