/**
 * ParticlePresets — Comprehensive library of particle effect
 * configurations for spells, environment, UI, and combat.
 *
 * Each preset is a config object compatible with AdvancedParticleSystem.
 *
 * Categories:
 *  - Spell effects (cast, impact, trail)
 *  - Environmental (rain, dust, fireflies, fog)
 *  - Combat (hit sparks, blood, shield)
 *  - UI (level up, achievement)
 *  - Phase transitions (blue, crimson, silver swirl)
 */

const ParticlePresets = {

    // ================================================================
    // SPELL EFFECTS
    // ================================================================

    fireball: {
        count: 30,
        lifespan: { min: 400, max: 800 },
        speed: { min: 40, max: 120 },
        scale: { start: 1.5, end: 0.2 },
        alpha: { start: 1, end: 0 },
        color: { start: 0xff6622, end: 0xff2200 },
        emitShape: 'circle',
        emitRadius: 8,
        gravity: { x: 0, y: -20 },
        blendMode: 'ADD'
    },

    ice_shards: {
        count: 20,
        lifespan: { min: 300, max: 600 },
        speed: { min: 80, max: 200 },
        scale: { start: 1.0, end: 0.3 },
        alpha: { start: 0.9, end: 0.1 },
        color: { start: 0x88ddff, end: 0x4488cc },
        emitShape: 'ring',
        emitRadius: 12,
        rotation: { min: 0, max: 360, speed: 300 },
        blendMode: 'ADD'
    },

    healing_aura: {
        count: 25,
        lifespan: { min: 600, max: 1200 },
        speed: { min: 10, max: 40 },
        scale: { start: 0.8, end: 1.5 },
        alpha: { start: 0.6, end: 0 },
        color: { start: 0x44ff88, end: 0x22aa44 },
        emitShape: 'circle',
        emitRadius: 30,
        gravity: { x: 0, y: -30 },
        blendMode: 'ADD'
    },

    shadow_strike: {
        count: 40,
        lifespan: { min: 200, max: 500 },
        speed: { min: 60, max: 180 },
        scale: { start: 1.2, end: 0.1 },
        alpha: { start: 0.8, end: 0 },
        color: { start: 0x8844cc, end: 0x220044 },
        emitShape: 'point',
        gravity: { x: 0, y: 40 },
        blendMode: 'ADD'
    },

    arcane_burst: {
        count: 35,
        lifespan: { min: 300, max: 700 },
        speed: { min: 50, max: 150 },
        scale: { start: 1.3, end: 0.2 },
        alpha: { start: 1, end: 0 },
        color: { start: 0x4488ff, end: 0x2244aa },
        emitShape: 'ring',
        emitRadius: 10,
        blendMode: 'ADD'
    },

    radiant_burst: {
        count: 45,
        lifespan: { min: 400, max: 900 },
        speed: { min: 30, max: 120 },
        scale: { start: 1.5, end: 0.3 },
        alpha: { start: 1, end: 0 },
        color: { start: 0xffdd44, end: 0xffaa00 },
        emitShape: 'circle',
        emitRadius: 15,
        gravity: { x: 0, y: -15 },
        blendMode: 'ADD'
    },

    spell_trail_fire: {
        count: 3,
        lifespan: { min: 150, max: 300 },
        speed: { min: 5, max: 20 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        color: { start: 0xff8844, end: 0xff2200 },
        emitShape: 'point',
        blendMode: 'ADD'
    },

    spell_trail_ice: {
        count: 3,
        lifespan: { min: 200, max: 400 },
        speed: { min: 5, max: 15 },
        scale: { start: 0.6, end: 0.1 },
        alpha: { start: 0.5, end: 0 },
        color: { start: 0xaaeeff, end: 0x4488cc },
        emitShape: 'point',
        blendMode: 'ADD'
    },

    // ================================================================
    // COMBAT
    // ================================================================

    hit_sparks: {
        count: 15,
        lifespan: { min: 100, max: 300 },
        speed: { min: 100, max: 250 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 1, end: 0 },
        color: { start: 0xffffaa, end: 0xff8800 },
        emitShape: 'point',
        gravity: { x: 0, y: 200 },
        blendMode: 'ADD'
    },

    shield_block: {
        count: 12,
        lifespan: { min: 200, max: 400 },
        speed: { min: 30, max: 80 },
        scale: { start: 1.0, end: 0.3 },
        alpha: { start: 0.7, end: 0 },
        color: { start: 0x88bbff, end: 0x4466aa },
        emitShape: 'ring',
        emitRadius: 20,
        blendMode: 'ADD'
    },

    death_burst: {
        count: 50,
        lifespan: { min: 300, max: 800 },
        speed: { min: 40, max: 160 },
        scale: { start: 1.2, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        color: { start: 0xff4444, end: 0x440000 },
        emitShape: 'circle',
        emitRadius: 10,
        gravity: { x: 0, y: 60 },
        blendMode: 'ADD'
    },

    // ================================================================
    // ENVIRONMENT
    // ================================================================

    fireflies: {
        count: 1,
        lifespan: { min: 2000, max: 4000 },
        speed: { min: 5, max: 15 },
        scale: { start: 0.5, end: 0.3 },
        alpha: { start: 0, end: 0 },
        alphaCurve: [0, 0.8, 1, 0, 0.8, 0], // fade in and out
        color: { start: 0xaaffaa, end: 0x66ff66 },
        emitShape: 'rectangle',
        emitWidth: 400,
        emitHeight: 300,
        blendMode: 'ADD'
    },

    dust_motes: {
        count: 1,
        lifespan: { min: 3000, max: 6000 },
        speed: { min: 2, max: 8 },
        scale: { start: 0.3, end: 0.1 },
        alpha: { start: 0.3, end: 0 },
        color: { start: 0xccaa88, end: 0x886644 },
        emitShape: 'rectangle',
        emitWidth: 500,
        emitHeight: 400,
        gravity: { x: 5, y: -2 }
    },

    rain: {
        count: 5,
        lifespan: { min: 400, max: 600 },
        speed: { min: 300, max: 500 },
        scale: { start: 0.2, end: 0.1 },
        alpha: { start: 0.4, end: 0.1 },
        color: { start: 0x8899bb, end: 0x667799 },
        emitShape: 'rectangle',
        emitWidth: 1400,
        emitHeight: 10,
        angle: { min: 80, max: 85 }
    },

    fog_wisps: {
        count: 1,
        lifespan: { min: 4000, max: 8000 },
        speed: { min: 3, max: 10 },
        scale: { start: 3, end: 5 },
        alpha: { start: 0, end: 0 },
        alphaCurve: [0, 0.15, 0.5, 0.15, 1, 0],
        color: { start: 0x888899, end: 0x555566 },
        emitShape: 'rectangle',
        emitWidth: 600,
        emitHeight: 400
    },

    // ================================================================
    // UI / FEEDBACK
    // ================================================================

    level_up: {
        count: 60,
        lifespan: { min: 800, max: 1500 },
        speed: { min: 20, max: 80 },
        scale: { start: 1.0, end: 0.2 },
        alpha: { start: 1, end: 0 },
        color: { start: 0xffdd44, end: 0xffaa00 },
        emitShape: 'ring',
        emitRadius: 30,
        gravity: { x: 0, y: -50 },
        blendMode: 'ADD'
    },

    achievement: {
        count: 30,
        lifespan: { min: 600, max: 1000 },
        speed: { min: 30, max: 100 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 1, end: 0 },
        color: { start: 0xffffff, end: 0xffdd88 },
        emitShape: 'circle',
        emitRadius: 10,
        blendMode: 'ADD'
    },

    // ================================================================
    // PHASE TRANSITIONS
    // ================================================================

    phase_transition_blue: {
        count: 40,
        lifespan: { min: 800, max: 1500 },
        speed: { min: 10, max: 50 },
        scale: { start: 2, end: 0.5 },
        alpha: { start: 0.5, end: 0 },
        color: { start: 0x4488ff, end: 0x2244aa },
        emitShape: 'rectangle',
        emitWidth: 1280,
        emitHeight: 720,
        gravity: { x: 0, y: -20 },
        blendMode: 'ADD'
    },

    phase_transition_crimson: {
        count: 40,
        lifespan: { min: 800, max: 1500 },
        speed: { min: 10, max: 50 },
        scale: { start: 2, end: 0.5 },
        alpha: { start: 0.5, end: 0 },
        color: { start: 0xff4444, end: 0xaa2222 },
        emitShape: 'rectangle',
        emitWidth: 1280,
        emitHeight: 720,
        gravity: { x: 0, y: 10 },
        blendMode: 'ADD'
    },

    phase_transition_silver: {
        count: 40,
        lifespan: { min: 800, max: 1500 },
        speed: { min: 10, max: 50 },
        scale: { start: 2, end: 0.5 },
        alpha: { start: 0.4, end: 0 },
        color: { start: 0xccccdd, end: 0x888899 },
        emitShape: 'rectangle',
        emitWidth: 1280,
        emitHeight: 720,
        blendMode: 'ADD'
    }
};

/**
 * Get a preset by name. Returns a shallow copy.
 */
ParticlePresets.get = function (name) {
    const preset = ParticlePresets[name];
    if (!preset) {
        console.warn(`[ParticlePresets] Unknown preset: ${name}`);
        return null;
    }
    return { ...preset };
};

export default ParticlePresets;
