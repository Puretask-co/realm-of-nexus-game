/**
 * LightingPresets — Predefined lighting configurations for
 * different locations, phases, and special events.
 *
 * Each preset defines:
 *  - ambientColor: base scene illumination
 *  - ambientIntensity: how bright the base ambient is
 *  - lights: array of light definitions to auto-spawn
 *  - fog: optional distance fog settings
 *
 * Usage:
 *   const preset = LightingPresets.get('crystal_caverns');
 *   lightingSystem.applyPreset(preset);
 *
 * Presets can be blended during transitions:
 *   lightingSystem.blendPresets(presetA, presetB, 0.5);
 */

const LightingPresets = {
    // ---- Location presets ----

    verdant_grove: {
        name: 'Verdant Grove',
        ambientColor: 0x224422,
        ambientIntensity: 0.35,
        fog: { color: 0x112211, near: 400, far: 800 },
        lights: [
            { type: 'directional', color: 0xaaddaa, intensity: 0.5, angle: -0.8 },
            { type: 'point', color: 0x66ff66, intensity: 0.3, radius: 200, pulse: { speed: 0.3, min: 0.2, max: 0.4 } }
        ]
    },

    crystal_caverns: {
        name: 'Crystal Caverns',
        ambientColor: 0x112244,
        ambientIntensity: 0.15,
        fog: { color: 0x0a0a2a, near: 200, far: 500 },
        lights: [
            { type: 'point', color: 0x66aaff, intensity: 0.8, radius: 120, pulse: { speed: 0.8, min: 0.6, max: 1.0 } },
            { type: 'point', color: 0xaa66ff, intensity: 0.5, radius: 80, pulse: { speed: 1.2, min: 0.3, max: 0.7 } },
            { type: 'point', color: 0x44ffdd, intensity: 0.4, radius: 100 }
        ]
    },

    sunken_ruins: {
        name: 'Sunken Ruins',
        ambientColor: 0x0a1a2a,
        ambientIntensity: 0.2,
        fog: { color: 0x081828, near: 150, far: 400 },
        lights: [
            { type: 'point', color: 0x2288aa, intensity: 0.4, radius: 150 },
            { type: 'area', color: 0x115577, intensity: 0.2, width: 300, height: 200 }
        ]
    },

    shadow_vale: {
        name: 'Shadow Vale',
        ambientColor: 0x0a0a12,
        ambientIntensity: 0.08,
        fog: { color: 0x050510, near: 100, far: 300 },
        lights: [
            { type: 'point', color: 0x8844cc, intensity: 0.6, radius: 90, flicker: { speed: 5, amount: 0.15 } }
        ]
    },

    crimson_plateau: {
        name: 'Crimson Plateau',
        ambientColor: 0x2a1010,
        ambientIntensity: 0.3,
        fog: { color: 0x1a0808, near: 300, far: 600 },
        lights: [
            { type: 'directional', color: 0xff6644, intensity: 0.4, angle: -0.5 },
            { type: 'point', color: 0xff4422, intensity: 0.7, radius: 160, pulse: { speed: 0.5, min: 0.5, max: 0.9 } }
        ]
    },

    nexus_spire: {
        name: 'Nexus Spire',
        ambientColor: 0x1a1a2a,
        ambientIntensity: 0.25,
        fog: null,
        lights: [
            { type: 'point', color: 0xffffff, intensity: 1.0, radius: 250, pulse: { speed: 0.2, min: 0.8, max: 1.0 } },
            { type: 'point', color: 0x4488ff, intensity: 0.6, radius: 120 },
            { type: 'point', color: 0xff4444, intensity: 0.6, radius: 120 },
            { type: 'point', color: 0xccccdd, intensity: 0.6, radius: 120 }
        ]
    },

    // ---- Phase overlay presets ----

    phase_blue: {
        name: 'Blue Phase Overlay',
        ambientColor: 0x1a2244,
        ambientIntensity: 0.2,
        tint: { color: [0.05, 0.08, 0.2], strength: 0.12 }
    },

    phase_crimson: {
        name: 'Crimson Phase Overlay',
        ambientColor: 0x2a1111,
        ambientIntensity: 0.2,
        tint: { color: [0.2, 0.05, 0.05], strength: 0.15 }
    },

    phase_silver: {
        name: 'Silver Phase Overlay',
        ambientColor: 0x1a1a22,
        ambientIntensity: 0.25,
        tint: { color: [0.1, 0.1, 0.15], strength: 0.1 }
    },

    // ---- Special event presets ----

    boss_arena: {
        name: 'Boss Arena',
        ambientColor: 0x0a0a1a,
        ambientIntensity: 0.1,
        fog: { color: 0x050512, near: 200, far: 500 },
        lights: [
            { type: 'point', color: 0xff2244, intensity: 1.2, radius: 300, pulse: { speed: 1.0, min: 0.8, max: 1.5 } },
            { type: 'spot', color: 0xffffff, intensity: 0.8, radius: 100, angle: Math.PI / 6 }
        ]
    },

    safe_zone: {
        name: 'Safe Zone',
        ambientColor: 0x223344,
        ambientIntensity: 0.5,
        lights: [
            { type: 'area', color: 0xffeedd, intensity: 0.4, width: 400, height: 300 },
            { type: 'point', color: 0xffcc88, intensity: 0.6, radius: 150, flicker: { speed: 2, amount: 0.05 } }
        ]
    }
};

/**
 * Get a preset by name. Returns a deep copy.
 */
LightingPresets.get = function (name) {
    const preset = LightingPresets[name];
    if (!preset) {
        console.warn(`[LightingPresets] Unknown preset: ${name}`);
        return null;
    }
    return JSON.parse(JSON.stringify(preset));
};

/**
 * Blend two presets by a factor t (0 = presetA, 1 = presetB).
 */
LightingPresets.blend = function (presetA, presetB, t) {
    if (!presetA || !presetB) return presetA || presetB;

    const colorA = Phaser.Display.Color.IntegerToColor(presetA.ambientColor || 0);
    const colorB = Phaser.Display.Color.IntegerToColor(presetB.ambientColor || 0);

    const r = Math.round(colorA.red + (colorB.red - colorA.red) * t);
    const g = Math.round(colorA.green + (colorB.green - colorA.green) * t);
    const b = Math.round(colorA.blue + (colorB.blue - colorA.blue) * t);

    return {
        name: `blend(${presetA.name}, ${presetB.name})`,
        ambientColor: (r << 16) | (g << 8) | b,
        ambientIntensity: presetA.ambientIntensity + (presetB.ambientIntensity - presetA.ambientIntensity) * t,
        lights: t < 0.5 ? presetA.lights : presetB.lights
    };
};

export default LightingPresets;
