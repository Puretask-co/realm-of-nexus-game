/**
 * Lighting Presets
 *
 * Pre-configured lighting setups for different times of day, locations,
 * combat scenarios, and weather conditions.  Applied via the
 * LightingPresetManager which handles smooth transitions between presets.
 */

const LIGHTING_PRESETS = {
  // ===== TIME OF DAY =====
  timeOfDay: {
    dawn: {
      ambient: { color: 0xff8866, intensity: 0.4 },
      directionalLight: { angle: -Math.PI / 4, color: 0xffaa88, intensity: 0.6 }
    },
    day: {
      ambient: { color: 0xffffee, intensity: 0.8 },
      directionalLight: { angle: -Math.PI / 2, color: 0xffffee, intensity: 1.0 }
    },
    dusk: {
      ambient: { color: 0xff6644, intensity: 0.5 },
      directionalLight: { angle: -Math.PI / 6, color: 0xff8844, intensity: 0.7 }
    },
    night: {
      ambient: { color: 0x223344, intensity: 0.2 },
      directionalLight: { angle: Math.PI / 2, color: 0x8899bb, intensity: 0.3 }
    }
  },

  // ===== LOCATIONS =====
  locations: {
    forest: {
      ambient: { color: 0x336633, intensity: 0.4 },
      fog: { color: 0x88aa88, density: 0.3 }
    },
    cave: {
      ambient: { color: 0x222222, intensity: 0.1 }
    },
    temple: {
      ambient: { color: 0x8888aa, intensity: 0.5 }
    },
    desert: {
      ambient: { color: 0xffffbb, intensity: 0.9 }
    },
    underwater: {
      ambient: { color: 0x4488aa, intensity: 0.6 }
    }
  },

  // ===== SAP CYCLE PHASES =====
  sapPhases: {
    blue: {
      ambient: { color: 0x3366bb, intensity: 0.4 },
      tint: 0x88aaff,
      fogColor: 0x4477cc
    },
    crimson: {
      ambient: { color: 0xbb3344, intensity: 0.35 },
      tint: 0xff8899,
      fogColor: 0xcc4455
    },
    silver: {
      ambient: { color: 0xccccdd, intensity: 0.5 },
      tint: 0xddddff,
      fogColor: 0xaaaacc
    }
  },

  // ===== COMBAT =====
  combat: {
    normal: {
      ambient: { color: 0x666688, intensity: 0.5 }
    },
    boss: {
      ambient: { color: 0x884444, intensity: 0.4 }
    },
    stealth: {
      ambient: { color: 0x222244, intensity: 0.2 }
    }
  },

  // ===== WEATHER =====
  weather: {
    clear: {
      ambient: { color: 0xffffee, intensity: 0.8 }
    },
    overcast: {
      ambient: { color: 0xaaaacc, intensity: 0.6 }
    },
    rain: {
      ambient: { color: 0x6688aa, intensity: 0.5 },
      lightning: { frequency: 5000, duration: 100 }
    },
    storm: {
      ambient: { color: 0x445566, intensity: 0.3 },
      lightning: { frequency: 2000, duration: 150, intensity: 2.0 }
    },
    fog: {
      ambient: { color: 0xccccdd, intensity: 0.7 },
      volumetricIntensity: 0.8
    }
  }
};

export default LIGHTING_PRESETS;
