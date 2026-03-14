/**
 * CameraPresets — Predefined camera configurations for
 * different gameplay contexts.
 *
 * Categories:
 *  - Follow modes (exploration, combat, dialogue)
 *  - Shake presets (by severity)
 *  - Cinematic sequences (intro, boss reveal, death)
 *  - Zone transitions
 */

const CameraPresets = {

    // ================================================================
    // FOLLOW MODES
    // ================================================================

    follow_exploration: {
        name: 'Exploration',
        lerpX: 0.08,
        lerpY: 0.08,
        offsetX: 0,
        offsetY: -20,
        deadzone: { width: 80, height: 60 },
        zoom: 1.0,
        lookAhead: { distance: 120, smoothing: 0.04 }
    },

    follow_combat: {
        name: 'Combat',
        lerpX: 0.12,
        lerpY: 0.12,
        offsetX: 0,
        offsetY: 0,
        deadzone: { width: 40, height: 30 },
        zoom: 1.15,
        lookAhead: { distance: 60, smoothing: 0.08 }
    },

    follow_dialogue: {
        name: 'Dialogue',
        lerpX: 0.05,
        lerpY: 0.05,
        offsetX: 0,
        offsetY: -30,
        deadzone: { width: 200, height: 150 },
        zoom: 1.3,
        lookAhead: null
    },

    follow_editor: {
        name: 'Editor',
        lerpX: 1.0,
        lerpY: 1.0,
        offsetX: 0,
        offsetY: 0,
        deadzone: null,
        zoom: 1.0,
        lookAhead: null
    },

    // ================================================================
    // SHAKE PRESETS
    // ================================================================

    shake_light: {
        name: 'Light Shake',
        duration: 100,
        intensity: 0.003,
        frequency: 30
    },

    shake_medium: {
        name: 'Medium Shake',
        duration: 200,
        intensity: 0.008,
        frequency: 25
    },

    shake_heavy: {
        name: 'Heavy Shake',
        duration: 350,
        intensity: 0.015,
        frequency: 20
    },

    shake_explosion: {
        name: 'Explosion',
        duration: 500,
        intensity: 0.025,
        frequency: 15
    },

    shake_earthquake: {
        name: 'Earthquake',
        duration: 2000,
        intensity: 0.012,
        frequency: 8
    },

    shake_spell_cast: {
        name: 'Spell Cast',
        duration: 150,
        intensity: 0.005,
        frequency: 25
    },

    shake_critical_hit: {
        name: 'Critical Hit',
        duration: 250,
        intensity: 0.018,
        frequency: 18
    },

    // ================================================================
    // CINEMATIC SEQUENCES
    // ================================================================

    cinematic_intro: {
        name: 'Intro Pan',
        keyframes: [
            { time: 0, x: 0, y: 0, zoom: 0.5, duration: 0 },
            { time: 2000, x: 600, y: 400, zoom: 0.8, ease: 'Sine.easeInOut' },
            { time: 4000, x: 640, y: 360, zoom: 1.0, ease: 'Sine.easeInOut' }
        ],
        totalDuration: 4000
    },

    cinematic_boss_reveal: {
        name: 'Boss Reveal',
        keyframes: [
            { time: 0, x: null, y: null, zoom: 1.0, duration: 0 },       // current position
            { time: 500, x: null, y: null, zoom: 1.4, ease: 'Quad.easeIn' },   // zoom in on boss
            { time: 1500, x: null, y: null, zoom: 1.4, ease: 'Linear' },       // hold
            { time: 2500, x: null, y: null, zoom: 1.0, ease: 'Quad.easeOut' }  // zoom back
        ],
        totalDuration: 2500
    },

    cinematic_death: {
        name: 'Death Camera',
        keyframes: [
            { time: 0, x: null, y: null, zoom: 1.0, duration: 0 },
            { time: 300, x: null, y: null, zoom: 1.5, ease: 'Quad.easeIn' },
            { time: 2000, x: null, y: null, zoom: 1.5, ease: 'Linear' }
        ],
        totalDuration: 2000
    },

    cinematic_spell_zoom: {
        name: 'Spell Zoom',
        keyframes: [
            { time: 0, x: null, y: null, zoom: 1.0, duration: 0 },
            { time: 150, x: null, y: null, zoom: 1.3, ease: 'Quad.easeIn' },
            { time: 400, x: null, y: null, zoom: 1.3, ease: 'Linear' },
            { time: 600, x: null, y: null, zoom: 1.0, ease: 'Quad.easeOut' }
        ],
        totalDuration: 600
    },

    // ================================================================
    // ZONE TRANSITIONS
    // ================================================================

    zone_indoor: {
        name: 'Indoor Zone',
        zoom: 1.2,
        transitionDuration: 800,
        ease: 'Sine.easeInOut'
    },

    zone_outdoor: {
        name: 'Outdoor Zone',
        zoom: 0.9,
        transitionDuration: 800,
        ease: 'Sine.easeInOut'
    },

    zone_boss_arena: {
        name: 'Boss Arena Zone',
        zoom: 0.85,
        transitionDuration: 1200,
        ease: 'Quad.easeInOut'
    },

    zone_safe: {
        name: 'Safe Zone',
        zoom: 1.1,
        transitionDuration: 600,
        ease: 'Sine.easeInOut'
    }
};

/**
 * Get a preset by name.
 */
CameraPresets.get = function (name) {
    const preset = CameraPresets[name];
    if (!preset) {
        console.warn(`[CameraPresets] Unknown preset: ${name}`);
        return null;
    }
    return { ...preset };
};

export default CameraPresets;
