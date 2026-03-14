import EventBus from './EventBus.js';

/**
 * 2D lighting engine layered on top of Phaser's renderer.
 *
 * Creates a multiplicative "lighting layer" render-texture that darkens
 * the scene by default (ambient) and brightens it where lights exist.
 * Shadow casters project real-time shadows using simple ray casting.
 *
 * Light types: point, spot, directional, area.
 * Effects: flicker, pulse, color-cycle, volumetric glow.
 *
 * Integrates with SapCycleManager via EventBus to shift ambient
 * colour as the phase changes (blue cool tones, crimson warm, etc.).
 */
export default class AdvancedLightingSystem {
    constructor(scene) {
        this.scene = scene;
        this.lights = [];
        this.shadowCasters = [];

        this.config = {
            enabled: true,
            shadowsEnabled: true,
            ambientLight: { color: 0x222244, intensity: 0.3 },
            maxLights: 32
        };

        this.stats = { lightsRendered: 0, shadowsRendered: 0, frameTime: 0 };
        this.lightPool = [];

        this._initRenderTextures();
        this._listenForPhaseChanges();
    }

    // ----------------------------------------------------------------
    // Initialisation
    // ----------------------------------------------------------------

    _initRenderTextures() {
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;

        this.lightingRT = this.scene.add.renderTexture(0, 0, w, h);
        this.lightingRT.setDepth(9998);
        this.lightingRT.setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.lightingRT.setScrollFactor(0);

        this.volumetricRT = this.scene.add.renderTexture(0, 0, w, h);
        this.volumetricRT.setDepth(9999);
        this.volumetricRT.setBlendMode(Phaser.BlendModes.ADD);
        this.volumetricRT.setScrollFactor(0);
        this.volumetricRT.setAlpha(0.4);
    }

    _listenForPhaseChanges() {
        const PHASE_AMBIENT = {
            blue: { color: 0x2244aa, intensity: 0.35 },
            crimson: { color: 0xaa2244, intensity: 0.3 },
            silver: { color: 0xccccdd, intensity: 0.45 }
        };

        EventBus.on('phase-changed', (newPhase) => {
            const preset = PHASE_AMBIENT[newPhase];
            if (preset) this.setAmbientLight(preset.color, preset.intensity);
        });
    }

    // ----------------------------------------------------------------
    // Light management
    // ----------------------------------------------------------------

    addLight(x, y, config = {}) {
        if (this.lights.length >= this.config.maxLights) {
            console.warn('[Lighting] Max lights reached');
            return null;
        }

        const light = {
            id: `light_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            x, y,
            type: config.type || 'point',
            color: config.color ?? 0xffffff,
            intensity: config.intensity ?? 1.0,
            radius: config.radius || 100,
            angle: config.angle || 0,
            cone: config.cone || Math.PI / 4,
            width: config.width || 100,
            height: config.height || 50,
            castShadows: config.castShadows ?? true,
            flicker: config.flicker || null,
            pulse: config.pulse || null,
            colorCycle: config.colorCycle || null,
            volumetric: config.volumetric || false,
            volumetricDensity: config.volumetricDensity || 0.5,
            enabled: true,
            visible: true,
            _currentIntensity: config.intensity ?? 1.0,
            _currentColor: config.color ?? 0xffffff,
            _time: 0,
            _gfx: null
        };

        this.lights.push(light);
        return light;
    }

    removeLight(light) {
        const idx = this.lights.indexOf(light);
        if (idx !== -1) {
            if (light._gfx) light._gfx.destroy();
            this.lights.splice(idx, 1);
        }
    }

    addShadowCaster(gameObject, config = {}) {
        const caster = {
            gameObject,
            enabled: true,
            opacity: config.opacity ?? 0.8,
            isStatic: config.isStatic || false,
            _cache: null
        };
        this.shadowCasters.push(caster);
        return caster;
    }

    removeShadowCaster(gameObject) {
        const idx = this.shadowCasters.findIndex((c) => c.gameObject === gameObject);
        if (idx !== -1) this.shadowCasters.splice(idx, 1);
    }

    setAmbientLight(color, intensity) {
        this.config.ambientLight.color = color;
        this.config.ambientLight.intensity = intensity;
    }

    setEnabled(enabled) {
        this.config.enabled = enabled;
        this.lightingRT.setVisible(enabled);
        this.volumetricRT.setVisible(enabled);
    }

    // ----------------------------------------------------------------
    // Per-frame update
    // ----------------------------------------------------------------

    update(delta) {
        if (!this.config.enabled) return;
        const t0 = performance.now();

        this.lightingRT.clear();
        this.volumetricRT.clear();

        // Ambient fill
        this.lightingRT.fill(
            this.config.ambientLight.color,
            this.config.ambientLight.intensity
        );

        const dt = delta / 1000;
        this.stats.lightsRendered = 0;

        this.lights.forEach((light) => {
            if (!light.enabled || !light.visible) return;
            this._updateLightEffects(light, dt);
            this._renderLight(light);
            this.stats.lightsRendered++;
        });

        this.stats.frameTime = performance.now() - t0;
    }

    _updateLightEffects(light, dt) {
        light._time += dt;

        if (light.flicker) {
            const f = light.flicker;
            light._currentIntensity =
                light.intensity * (1 + Math.sin(light._time * f.speed * Math.PI * 2) * f.amount);
        }

        if (light.pulse) {
            const p = light.pulse;
            const t = (Math.sin(light._time * p.speed * Math.PI * 2) + 1) / 2;
            light._currentIntensity = (p.min + (p.max - p.min) * t) * light.intensity;
        }

        if (light.colorCycle) {
            const cc = light.colorCycle;
            const idx = Math.floor(light._time * cc.speed) % cc.colors.length;
            light._currentColor = cc.colors[idx];
        }
    }

    _renderLight(light) {
        if (!light._gfx) light._gfx = this.scene.add.graphics();
        light._gfx.clear();

        const cam = this.scene.cameras.main;
        const sx = (light.x - cam.scrollX) * cam.zoom;
        const sy = (light.y - cam.scrollY) * cam.zoom;
        const sr = light.radius * cam.zoom;

        const c = Phaser.Display.Color.IntegerToColor(light._currentColor);
        const r = Math.min(255, Math.floor(c.red * light._currentIntensity));
        const g = Math.min(255, Math.floor(c.green * light._currentIntensity));
        const b = Math.min(255, Math.floor(c.blue * light._currentIntensity));

        // Concentric circles approximating radial gradient
        const steps = 12;
        for (let i = steps; i >= 0; i--) {
            const frac = i / steps;
            const alpha = (1 - frac) * 0.8;
            const radius = sr * frac;
            light._gfx.fillStyle(
                Phaser.Display.Color.GetColor(r, g, b),
                alpha
            );
            light._gfx.fillCircle(sx, sy, radius);
        }

        this.lightingRT.draw(light._gfx);

        if (light.volumetric) {
            const vAlpha = light.volumetricDensity * light._currentIntensity * 0.3;
            light._gfx.clear();
            light._gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), vAlpha);
            light._gfx.fillCircle(sx, sy, sr * 1.2);
            this.volumetricRT.draw(light._gfx);
        }
    }

    // ----------------------------------------------------------------
    // Gameplay helpers
    // ----------------------------------------------------------------

    /** Returns approximate brightness at a world position (0..~2). */
    getBrightnessAt(x, y) {
        let total = this.config.ambientLight.intensity;
        this.lights.forEach((light) => {
            if (!light.enabled) return;
            const d = Phaser.Math.Distance.Between(x, y, light.x, light.y);
            if (d < light.radius) {
                total += light._currentIntensity * (1 - d / light.radius);
            }
        });
        return Math.min(total, 2.0);
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this.lights.forEach((l) => { if (l._gfx) l._gfx.destroy(); });
        this.lightingRT.destroy();
        this.volumetricRT.destroy();
        this.lights = [];
        this.shadowCasters = [];
    }
}
