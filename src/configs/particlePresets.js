/**
 * Particle Effect Presets
 *
 * A library of ready-to-use particle configurations for spells, environment,
 * combat hits, and UI flourishes.  Each preset is a plain object that can be
 * passed directly to AdvancedParticleSystem.createEmitter() or registered
 * via registerPreset() for shorthand access with createEffect().
 */

const PARTICLE_PRESETS = {
  // ===== SPELL EFFECTS =====

  fireball: {
    emissionMode: 'burst',
    burstCount: 40,
    emissionShape: 'point',
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 600, max: 1000 },
      speed: { min: 100, max: 250 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0xff4400, end: 0x440000 },
      scale: { start: 1.5, end: 0.2 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD',
      drag: 0.95,
      trail: true,
      trailLength: 8
    },
    subEmitters: [{
      trigger: 'death',
      config: {
        emissionMode: 'burst',
        burstCount: 3,
        particleConfig: {
          texture: 'particle',
          lifetime: { min: 1000, max: 1500 },
          speed: { min: 20, max: 50 },
          angle: { min: 0, max: Math.PI * 2 },
          color: { start: 0x666666, end: 0x111111 },
          scale: { start: 0.5, end: 1.5 },
          alpha: { start: 0.6, end: 0.0 },
          blendMode: 'NORMAL',
          drag: 0.98
        }
      },
      inherit: ['position']
    }]
  },

  ice_shards: {
    emissionMode: 'burst',
    burstCount: 25,
    emissionShape: 'circle',
    emissionArea: { radius: 20 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 500, max: 800 },
      speed: { min: 150, max: 300 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0x88ccff,
      scale: { start: 0.8, end: 1.2 },
      alpha: { start: 1.0, end: 0.0 },
      rotation: { min: 0, max: Math.PI * 2 },
      angularVelocity: { min: -5, max: 5 },
      blendMode: 'ADD',
      drag: 0.92
    }
  },

  healing_aura: {
    emissionMode: 'continuous',
    emissionRate: 20,
    duration: 2000,
    emissionShape: 'circle',
    emissionArea: { radius: 50 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 1000, max: 1500 },
      speed: { min: 30, max: 60 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0x44ff88, end: 0xffffff },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0.8, end: 0.0 },
      blendMode: 'ADD',
      drag: 0.96
    }
  },

  lightning_bolt: {
    emissionMode: 'stream',
    emissionRate: 100,
    duration: 200,
    emissionShape: 'line',
    emissionArea: { length: 200, angle: 0 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 100, max: 300 },
      speed: { min: 50, max: 150 },
      angle: { min: -Math.PI / 4, max: Math.PI / 4 },
      color: 0xffffaa,
      scale: { start: 1.0, end: 0.2 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD'
    }
  },

  poison_cloud: {
    emissionMode: 'continuous',
    emissionRate: 30,
    duration: 3000,
    emissionShape: 'circle',
    emissionArea: { radius: 80 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 2000, max: 3000 },
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0x88ff44, end: 0x224411 },
      scale: { start: 0.5, end: 2.0 },
      alpha: { start: 0.7, end: 0.0 },
      angularVelocity: { min: -1, max: 1 },
      blendMode: 'NORMAL',
      drag: 0.99
    }
  },

  shadow_strike: {
    emissionMode: 'burst',
    burstCount: 30,
    emissionShape: 'ring',
    emissionArea: { innerRadius: 20, outerRadius: 40 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 400, max: 700 },
      speed: { min: 200, max: 350 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0x8844ff, end: 0x220044 },
      scale: { start: 1.2, end: 0.0 },
      alpha: { start: 0.9, end: 0.0 },
      trail: true,
      trailLength: 10,
      blendMode: 'ADD',
      drag: 0.90
    }
  },

  radiant_nova: {
    emissionMode: 'burst',
    burstCount: 60,
    emissionShape: 'ring',
    emissionArea: { innerRadius: 10, outerRadius: 30 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 500, max: 900 },
      speed: { min: 250, max: 400 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0xffffaa, end: 0xffcc00 },
      scale: { start: 1.5, end: 0.0 },
      alpha: { start: 1.0, end: 0.0 },
      trail: true,
      trailLength: 6,
      blendMode: 'ADD',
      drag: 0.88
    }
  },

  // ===== ENVIRONMENTAL EFFECTS =====

  rain: {
    emissionMode: 'continuous',
    emissionRate: 50,
    duration: -1,
    emissionShape: 'rectangle',
    emissionArea: { width: 1200, height: 10 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 2000, max: 3000 },
      speed: { min: 400, max: 600 },
      angle: { min: Math.PI / 2 - 0.1, max: Math.PI / 2 + 0.1 },
      color: 0xaaccff,
      scale: { start: 0.8, end: 0.5 },
      alpha: { start: 0.6, end: 0.3 },
      blendMode: 'NORMAL',
      drag: 1.0
    }
  },

  snow: {
    emissionMode: 'continuous',
    emissionRate: 30,
    duration: -1,
    emissionShape: 'rectangle',
    emissionArea: { width: 1200, height: 10 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 5000, max: 8000 },
      speed: { min: 30, max: 60 },
      angle: { min: Math.PI / 2 - 0.3, max: Math.PI / 2 + 0.3 },
      color: 0xffffff,
      scale: { start: 0.5, end: 0.8 },
      alpha: { start: 0.9, end: 0.7 },
      angularVelocity: { min: -2, max: 2 },
      blendMode: 'NORMAL',
      drag: 0.995
    }
  },

  fireflies: {
    emissionMode: 'continuous',
    emissionRate: 5,
    duration: -1,
    emissionShape: 'rectangle',
    emissionArea: { width: 800, height: 600 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 3000, max: 5000 },
      speed: { min: 20, max: 40 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0xffff88,
      scale: 0.3,
      alpha: {
        points: [
          { time: 0.0, value: 0.0 },
          { time: 0.2, value: 1.0 },
          { time: 0.5, value: 0.3 },
          { time: 0.8, value: 1.0 },
          { time: 1.0, value: 0.0 }
        ]
      },
      blendMode: 'ADD',
      drag: 0.98
    }
  },

  falling_leaves: {
    emissionMode: 'continuous',
    emissionRate: 10,
    duration: -1,
    emissionShape: 'rectangle',
    emissionArea: { width: 1200, height: 10 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 4000, max: 6000 },
      speed: { min: 50, max: 100 },
      angle: { min: Math.PI / 3, max: 2 * Math.PI / 3 },
      color: 0xaa8844,
      scale: { start: 0.8, end: 0.6 },
      alpha: { start: 1.0, end: 0.8 },
      angularVelocity: { min: -3, max: 3 },
      blendMode: 'NORMAL',
      drag: 0.99
    }
  },

  dust_particles: {
    emissionMode: 'continuous',
    emissionRate: 15,
    duration: -1,
    emissionShape: 'rectangle',
    emissionArea: { width: 1200, height: 800 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 3000, max: 5000 },
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0xccaa88,
      scale: { start: 0.3, end: 0.5 },
      alpha: { start: 0.2, end: 0.0 },
      blendMode: 'NORMAL',
      drag: 0.995
    }
  },

  // ===== COMBAT HIT EFFECTS =====

  hit_sparks: {
    emissionMode: 'burst',
    burstCount: 15,
    emissionShape: 'point',
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 300, max: 500 },
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0xffaa00,
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD',
      drag: 0.92
    }
  },

  critical_hit: {
    emissionMode: 'burst',
    burstCount: 50,
    emissionShape: 'circle',
    emissionArea: { radius: 30 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 400, max: 700 },
      speed: { min: 200, max: 400 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0xffff00, end: 0xff8800 },
      scale: { start: 1.5, end: 0.0 },
      alpha: { start: 1.0, end: 0.0 },
      angularVelocity: { min: -10, max: 10 },
      blendMode: 'ADD',
      drag: 0.88
    }
  },

  block_impact: {
    emissionMode: 'burst',
    burstCount: 10,
    emissionShape: 'ring',
    emissionArea: { innerRadius: 15, outerRadius: 25 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 300, max: 500 },
      speed: { min: 50, max: 100 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0x88ccff,
      scale: { start: 1.0, end: 0.3 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD'
    }
  },

  // ===== UI FLOURISHES =====

  level_up: {
    emissionMode: 'burst',
    burstCount: 60,
    emissionShape: 'ring',
    emissionArea: { innerRadius: 40, outerRadius: 60 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 1000, max: 1500 },
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: Math.PI * 2 },
      color: { start: 0xffff00, end: 0xffffff },
      scale: { start: 1.2, end: 0.0 },
      alpha: { start: 1.0, end: 0.0 },
      angularVelocity: { min: -5, max: 5 },
      blendMode: 'ADD'
    }
  },

  item_collect: {
    emissionMode: 'burst',
    burstCount: 20,
    emissionShape: 'circle',
    emissionArea: { radius: 20 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 600, max: 900 },
      speed: { min: 80, max: 150 },
      angle: { min: 0, max: Math.PI * 2 },
      color: 0xffcc00,
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD',
      drag: 0.93
    }
  },

  quest_complete: {
    emissionMode: 'burst',
    burstCount: 40,
    emissionShape: 'ring',
    emissionArea: { innerRadius: 30, outerRadius: 50 },
    particleConfig: {
      texture: 'particle',
      lifetime: { min: 800, max: 1200 },
      speed: { min: 100, max: 200 },
      angle: { min: -Math.PI / 2 - 0.5, max: -Math.PI / 2 + 0.5 },
      color: { start: 0x44ff88, end: 0x88ffcc },
      scale: { start: 1.0, end: 0.3 },
      alpha: { start: 1.0, end: 0.0 },
      blendMode: 'ADD'
    }
  }
};

/**
 * Register all presets with a particle system instance.
 * @param {AdvancedParticleSystem} particleSystem
 */
function registerAllPresets(particleSystem) {
  Object.entries(PARTICLE_PRESETS).forEach(([name, config]) => {
    particleSystem.registerPreset(name, config);
  });
  console.log(
    `[ParticlePresets] Registered ${Object.keys(PARTICLE_PRESETS).length} presets`
  );
}

export { PARTICLE_PRESETS, registerAllPresets };
