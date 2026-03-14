/**
 * lightingPresets - Comprehensive preset library for the AdvancedLightingSystem.
 *
 * Presets are organised into four categories:
 *
 *   timeOfDay  - Ambient conditions for different times of the day-night cycle.
 *   location   - Environment-specific overrides for different biomes / areas.
 *   weather    - Atmospheric overlays driven by the weather system.
 *   combat     - Short-lived dramatic lighting states triggered during gameplay.
 *
 * Each preset contains at minimum:
 *   ambientColor      (0xRRGGBB)  - base ambient light colour
 *   ambientIntensity  (0..1)      - ambient strength
 *   shadowIntensity   (0..1)      - how dark shadows render (0 = none)
 *   fogColor          (0xRRGGBB)  - screen-level fog tint
 *   fogDensity        (0..1)      - fog opacity
 *   globalTint        (0xRRGGBB)  - colour multiply applied to the full scene
 *
 * Many presets include additional keys consumed by specialised systems:
 *   sunAngle, sunColor, moonColor, starDensity, volumetricBoost,
 *   lightFlicker, particleColor, bloomStrength, etc.
 *
 * Part of the Realm of Nexus / Verdance project.
 */

// ════════════════════════════════════════════════════════════════════════════════
//  TIME OF DAY
// ════════════════════════════════════════════════════════════════════════════════

const timeOfDay = {
  dawn: {
    ambientColor: 0x3d2845,
    ambientIntensity: 0.25,
    shadowIntensity: 0.35,
    fogColor: 0x5e3a6e,
    fogDensity: 0.2,
    globalTint: 0xdda0c8,
    sunAngle: -5,
    sunColor: 0xff8855,
    sunIntensity: 0.3,
    skyGradientTop: 0x1a0a2e,
    skyGradientBottom: 0xff7744,
    starDensity: 0.05,
    volumetricBoost: 1.4,
    bloomStrength: 0.15,
  },

  morning: {
    ambientColor: 0x4a4a60,
    ambientIntensity: 0.45,
    shadowIntensity: 0.5,
    fogColor: 0x887766,
    fogDensity: 0.08,
    globalTint: 0xffeedd,
    sunAngle: 25,
    sunColor: 0xffdd88,
    sunIntensity: 0.7,
    skyGradientTop: 0x4488cc,
    skyGradientBottom: 0xaaddff,
    starDensity: 0,
    volumetricBoost: 1.0,
    bloomStrength: 0.1,
  },

  noon: {
    ambientColor: 0x666680,
    ambientIntensity: 0.65,
    shadowIntensity: 0.7,
    fogColor: 0xcccccc,
    fogDensity: 0.02,
    globalTint: 0xffffff,
    sunAngle: 90,
    sunColor: 0xffffff,
    sunIntensity: 1.0,
    skyGradientTop: 0x2266bb,
    skyGradientBottom: 0x88ccff,
    starDensity: 0,
    volumetricBoost: 0.6,
    bloomStrength: 0.05,
  },

  afternoon: {
    ambientColor: 0x605848,
    ambientIntensity: 0.55,
    shadowIntensity: 0.6,
    fogColor: 0xbbaa88,
    fogDensity: 0.06,
    globalTint: 0xfff0d0,
    sunAngle: 55,
    sunColor: 0xffcc66,
    sunIntensity: 0.85,
    skyGradientTop: 0x3377aa,
    skyGradientBottom: 0xddcc99,
    starDensity: 0,
    volumetricBoost: 0.8,
    bloomStrength: 0.08,
  },

  dusk: {
    ambientColor: 0x3a2030,
    ambientIntensity: 0.3,
    shadowIntensity: 0.45,
    fogColor: 0x662244,
    fogDensity: 0.18,
    globalTint: 0xff9966,
    sunAngle: 5,
    sunColor: 0xff5533,
    sunIntensity: 0.35,
    skyGradientTop: 0x110a22,
    skyGradientBottom: 0xcc4422,
    starDensity: 0.15,
    volumetricBoost: 1.6,
    bloomStrength: 0.2,
  },

  night: {
    ambientColor: 0x0a0a1e,
    ambientIntensity: 0.1,
    shadowIntensity: 0.8,
    fogColor: 0x0a0a18,
    fogDensity: 0.25,
    globalTint: 0x8888cc,
    sunAngle: -45,
    sunColor: 0x000000,
    sunIntensity: 0,
    moonColor: 0xaabbdd,
    moonIntensity: 0.2,
    skyGradientTop: 0x000011,
    skyGradientBottom: 0x0a0a22,
    starDensity: 0.7,
    volumetricBoost: 1.8,
    bloomStrength: 0.3,
  },

  midnight: {
    ambientColor: 0x050510,
    ambientIntensity: 0.06,
    shadowIntensity: 0.9,
    fogColor: 0x050508,
    fogDensity: 0.35,
    globalTint: 0x6666aa,
    sunAngle: -90,
    sunColor: 0x000000,
    sunIntensity: 0,
    moonColor: 0x8899bb,
    moonIntensity: 0.12,
    skyGradientTop: 0x000008,
    skyGradientBottom: 0x06061a,
    starDensity: 0.9,
    volumetricBoost: 2.0,
    bloomStrength: 0.35,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
//  LOCATION / BIOME
// ════════════════════════════════════════════════════════════════════════════════

const location = {
  forest_canopy: {
    ambientColor: 0x1a3a1a,
    ambientIntensity: 0.3,
    shadowIntensity: 0.55,
    fogColor: 0x223322,
    fogDensity: 0.12,
    globalTint: 0xccffcc,
    dappleEnabled: true,
    dappleIntensity: 0.35,
    dappleSpeed: 0.3,
    dappleColor: 0x88cc44,
    canopyDensity: 0.6,
    volumetricBoost: 1.3,
    bloomStrength: 0.1,
    particleColor: 0x66cc33,
  },

  cave_depths: {
    ambientColor: 0x080808,
    ambientIntensity: 0.04,
    shadowIntensity: 0.95,
    fogColor: 0x0a0a0a,
    fogDensity: 0.4,
    globalTint: 0x888899,
    torchFlicker: true,
    torchColor: 0xff9944,
    torchIntensity: 0.6,
    echoGlow: true,
    echoColor: 0x224488,
    volumetricBoost: 2.2,
    bloomStrength: 0.25,
    particleColor: 0x334466,
  },

  volcanic_glow: {
    ambientColor: 0x2a0800,
    ambientIntensity: 0.2,
    shadowIntensity: 0.7,
    fogColor: 0x331100,
    fogDensity: 0.22,
    globalTint: 0xff8844,
    lavaGlow: true,
    lavaColor: 0xff4400,
    lavaIntensity: 0.5,
    lavaPulseSpeed: 0.6,
    heatHaze: true,
    hazeIntensity: 0.15,
    volumetricBoost: 1.8,
    bloomStrength: 0.3,
    particleColor: 0xff6600,
    embers: true,
    emberCount: 40,
  },

  crystal_cavern: {
    ambientColor: 0x101830,
    ambientIntensity: 0.15,
    shadowIntensity: 0.5,
    fogColor: 0x0a1020,
    fogDensity: 0.1,
    globalTint: 0xaaddff,
    crystalRefraction: true,
    crystalColors: [0x44aaff, 0xaa44ff, 0x44ffaa, 0xff44aa],
    crystalIntensity: 0.4,
    crystalPulseSpeed: 0.4,
    prismaticBeams: true,
    beamCount: 5,
    volumetricBoost: 2.0,
    bloomStrength: 0.35,
    particleColor: 0x88ccff,
  },

  void_realm: {
    ambientColor: 0x0a0010,
    ambientIntensity: 0.08,
    shadowIntensity: 0.85,
    fogColor: 0x08000e,
    fogDensity: 0.3,
    globalTint: 0xaa66ff,
    voidDistortion: true,
    distortionStrength: 0.2,
    voidPulse: true,
    voidPulseColor: 0x6600cc,
    voidPulseSpeed: 0.25,
    reverseGravityParticles: true,
    volumetricBoost: 2.5,
    bloomStrength: 0.4,
    particleColor: 0x8833cc,
    chromaticAberration: 0.02,
  },

  warm_daylight: {
    ambientColor: 0x605040,
    ambientIntensity: 0.55,
    shadowIntensity: 0.45,
    fogColor: 0xddccaa,
    fogDensity: 0.03,
    globalTint: 0xfff5e0,
    sunColor: 0xffdd88,
    sunIntensity: 0.8,
    volumetricBoost: 0.7,
    bloomStrength: 0.08,
    particleColor: 0xffeecc,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
//  WEATHER
// ════════════════════════════════════════════════════════════════════════════════

const weather = {
  clear: {
    ambientColor: 0x555566,
    ambientIntensity: 0.5,
    shadowIntensity: 0.6,
    fogColor: 0xcccccc,
    fogDensity: 0.0,
    globalTint: 0xffffff,
    windStrength: 0.1,
    volumetricBoost: 0.8,
    bloomStrength: 0.05,
    rainDensity: 0,
    snowDensity: 0,
    lightningChance: 0,
  },

  overcast: {
    ambientColor: 0x404050,
    ambientIntensity: 0.4,
    shadowIntensity: 0.25,
    fogColor: 0x888899,
    fogDensity: 0.12,
    globalTint: 0xccccdd,
    windStrength: 0.2,
    cloudDensity: 0.7,
    cloudSpeed: 0.15,
    volumetricBoost: 0.5,
    bloomStrength: 0.03,
    rainDensity: 0,
    snowDensity: 0,
    lightningChance: 0,
  },

  rain: {
    ambientColor: 0x303040,
    ambientIntensity: 0.3,
    shadowIntensity: 0.3,
    fogColor: 0x556677,
    fogDensity: 0.2,
    globalTint: 0xaabbcc,
    windStrength: 0.35,
    cloudDensity: 0.85,
    cloudSpeed: 0.3,
    rainDensity: 0.6,
    rainColor: 0x8899aa,
    rainAngle: 10,
    puddleReflection: true,
    volumetricBoost: 0.9,
    bloomStrength: 0.08,
    snowDensity: 0,
    lightningChance: 0,
    wetSurfaceSheen: 0.3,
  },

  storm: {
    ambientColor: 0x1a1a28,
    ambientIntensity: 0.15,
    shadowIntensity: 0.5,
    fogColor: 0x333344,
    fogDensity: 0.3,
    globalTint: 0x8888aa,
    windStrength: 0.8,
    cloudDensity: 1.0,
    cloudSpeed: 0.6,
    rainDensity: 0.9,
    rainColor: 0x667788,
    rainAngle: 25,
    puddleReflection: true,
    lightningChance: 0.15,
    lightningColor: 0xeeeeff,
    lightningFlashIntensity: 3.0,
    lightningFlashDuration: 120,
    thunderDelay: 800,
    volumetricBoost: 1.5,
    bloomStrength: 0.2,
    snowDensity: 0,
    wetSurfaceSheen: 0.6,
    screenShake: 0.02,
  },

  fog: {
    ambientColor: 0x444450,
    ambientIntensity: 0.35,
    shadowIntensity: 0.15,
    fogColor: 0x999999,
    fogDensity: 0.6,
    globalTint: 0xcccccc,
    windStrength: 0.05,
    fogScrollSpeed: 0.08,
    fogLayerCount: 3,
    visibilityRange: 200,
    volumetricBoost: 2.0,
    bloomStrength: 0.15,
    rainDensity: 0,
    snowDensity: 0,
    lightningChance: 0,
    muteDistantSounds: true,
  },

  blizzard: {
    ambientColor: 0x303848,
    ambientIntensity: 0.2,
    shadowIntensity: 0.2,
    fogColor: 0xbbccdd,
    fogDensity: 0.5,
    globalTint: 0xccddee,
    windStrength: 0.9,
    cloudDensity: 1.0,
    snowDensity: 0.85,
    snowColor: 0xeeeeff,
    snowAngle: 30,
    frostOverlay: true,
    frostIntensity: 0.4,
    visibilityRange: 150,
    volumetricBoost: 1.2,
    bloomStrength: 0.18,
    rainDensity: 0,
    lightningChance: 0,
    temperatureEffect: -0.5,
    screenShake: 0.01,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
//  COMBAT
// ════════════════════════════════════════════════════════════════════════════════

const combat = {
  normal: {
    ambientColor: 0x444455,
    ambientIntensity: 0.4,
    shadowIntensity: 0.5,
    fogColor: 0x555555,
    fogDensity: 0.0,
    globalTint: 0xffffff,
    vignetteIntensity: 0.1,
    vignetteColor: 0x000000,
    volumetricBoost: 1.0,
    bloomStrength: 0.05,
    timeScale: 1.0,
    desaturation: 0.0,
  },

  boss_arena: {
    ambientColor: 0x1a0a20,
    ambientIntensity: 0.12,
    shadowIntensity: 0.8,
    fogColor: 0x220022,
    fogDensity: 0.2,
    globalTint: 0xdd88ff,
    vignetteIntensity: 0.35,
    vignetteColor: 0x110022,
    volumetricBoost: 2.0,
    bloomStrength: 0.3,
    arenaGlow: true,
    arenaGlowColor: 0x8800cc,
    arenaGlowPulse: 0.5,
    arenaBorderColor: 0xff00ff,
    timeScale: 1.0,
    desaturation: 0.0,
    screenShake: 0.005,
    musicIntensity: 1.5,
  },

  spell_impact: {
    ambientColor: 0xffffff,
    ambientIntensity: 0.9,
    shadowIntensity: 0.1,
    fogColor: 0xffffff,
    fogDensity: 0.05,
    globalTint: 0xffffff,
    vignetteIntensity: 0.0,
    vignetteColor: 0xffffff,
    volumetricBoost: 3.0,
    bloomStrength: 0.7,
    duration: 200,
    fadeOutDuration: 400,
    flashColor: 0xffffff,
    flashIntensity: 2.5,
    screenShake: 0.04,
    timeScale: 0.3,
    chromaticAberration: 0.03,
    desaturation: 0.0,
  },

  critical_moment: {
    ambientColor: 0x220000,
    ambientIntensity: 0.08,
    shadowIntensity: 0.9,
    fogColor: 0x110000,
    fogDensity: 0.15,
    globalTint: 0xff4444,
    vignetteIntensity: 0.5,
    vignetteColor: 0x220000,
    volumetricBoost: 1.8,
    bloomStrength: 0.25,
    heartbeatPulse: true,
    heartbeatSpeed: 1.2,
    heartbeatIntensity: 0.3,
    timeScale: 0.6,
    desaturation: 0.4,
    radialBlur: 0.01,
    screenShake: 0.015,
    duration: 0,
    fadeOutDuration: 1500,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
//  COMPOSITE EXPORT
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Master lighting preset collection.
 *
 * Usage:
 * ```js
 * import { lightingPresets } from '../configs/lightingPresets.js';
 *
 * const noon = lightingPresets.timeOfDay.noon;
 * lightingSystem.setAmbient(noon.ambientColor, noon.ambientIntensity);
 * ```
 */
export const lightingPresets = {
  timeOfDay,
  location,
  weather,
  combat,
};

// ── Utility: merge presets ─────────────────────────────────────────────────────

/**
 * Merge multiple presets into a single configuration object.
 * Later presets override earlier ones for matching keys.
 *
 * Useful for combining a time-of-day base with a weather overlay:
 * ```js
 * const merged = mergePresets(
 *   lightingPresets.timeOfDay.night,
 *   lightingPresets.weather.storm,
 *   lightingPresets.location.forest_canopy
 * );
 * ```
 *
 * @param {...Object} presets - Any number of preset objects to merge.
 * @returns {Object} A new merged configuration.
 */
export function mergePresets(...presets) {
  const result = {};
  for (const preset of presets) {
    if (!preset) continue;
    for (const key of Object.keys(preset)) {
      result[key] = preset[key];
    }
  }
  return result;
}

/**
 * Linearly interpolate between two preset configurations.
 * Numeric values are lerped; non-numeric values snap to `b` at t >= 0.5.
 *
 * @param {Object} a - Start preset.
 * @param {Object} b - End preset.
 * @param {number} t - Progress 0..1.
 * @returns {Object}
 */
export function lerpPresets(a, b, t) {
  const result = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];

    if (va === undefined) {
      result[key] = vb;
    } else if (vb === undefined) {
      result[key] = va;
    } else if (typeof va === 'number' && typeof vb === 'number') {
      // If both look like hex colours (> 0xFFFF), interpolate per-channel
      if (va > 0xffff && vb > 0xffff) {
        const ar = (va >> 16) & 0xff;
        const ag = (va >> 8) & 0xff;
        const ab = va & 0xff;
        const br = (vb >> 16) & 0xff;
        const bg = (vb >> 8) & 0xff;
        const bb = vb & 0xff;
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bv = Math.round(ab + (bb - ab) * t);
        result[key] = (r << 16) | (g << 8) | bv;
      } else {
        result[key] = va + (vb - va) * t;
      }
    } else {
      // Non-numeric: snap at midpoint
      result[key] = t < 0.5 ? va : vb;
    }
  }

  return result;
}

export default lightingPresets;
