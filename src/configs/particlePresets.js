/**
 * particlePresets.js - Ready-to-use particle effect configurations for Verdance.
 *
 * Each key maps to a config object compatible with AdvancedParticleSystem.createEmitter().
 * Presets are organised into four groups:
 *   1. Combat effects   - spell impacts, projectiles, auras
 *   2. Environment       - weather, ambient, Sap flows
 *   3. Impact effects    - hit reactions, explosions, shatters
 *   4. UI / Ambient      - level-up fanfare, pickups, teleport
 *
 * Colour values use packed 0xRRGGBB. Curves use normalised time [0..1].
 * Speed units are pixels / second; lifetime in seconds.
 */

// ─── Helper curve factories ──────────────────────────────────────────────────

/** Simple linear fade out. */
const fadeOut = [{ t: 0, value: 1 }, { t: 1, value: 0 }];

/** Quick pop then shrink. */
const popScale = [
  { t: 0, value: 0.2 },
  { t: 0.1, value: 1 },
  { t: 1, value: 0 }
];

/** Ease-in fade. */
const fadeInOut = [
  { t: 0, value: 0 },
  { t: 0.15, value: 1 },
  { t: 0.8, value: 1 },
  { t: 1, value: 0 }
];

/** Gentle pulse. */
const pulse = [
  { t: 0, value: 0.6 },
  { t: 0.25, value: 1 },
  { t: 0.5, value: 0.6 },
  { t: 0.75, value: 1 },
  { t: 1, value: 0 }
];

/** Grow then fade. */
const growFade = [
  { t: 0, value: 0.3 },
  { t: 0.4, value: 1 },
  { t: 1, value: 0.1 }
];

// ─── Presets ─────────────────────────────────────────────────────────────────

export const particlePresets = {

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Swirling fireball projectile trail. */
  fireball: {
    type: 'continuous',
    shape: 'circle',
    shapeParams: { radius: 8 },
    maxParticles: 200,
    emissionRate: 80,
    lifetime: { min: 0.3, max: 0.6 },
    speed: { min: 20, max: 60 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -30 },
    baseScale: { min: 0.8, max: 1.5 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xff6600,
    colorCurve: [
      { t: 0, color: 0xffff44 },
      { t: 0.3, color: 0xff6600 },
      { t: 1, color: 0x991100 }
    ],
    rotationSpeed: { min: -2, max: 2 },
    blendMode: 'ADD',
    trail: { enabled: true, frequency: 0.03, emitterId: null },
    depth: 5
  },

  /** Crystalline ice shard burst. */
  ice_shards: {
    type: 'burst',
    shape: 'point',
    maxParticles: 60,
    burstCount: 30,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.4, max: 0.9 },
    speed: { min: 150, max: 350 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 80 },
    baseScale: { min: 0.5, max: 1.2 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 0.6, value: 0.8 }, { t: 1, value: 0 }],
    alphaCurve: fadeOut,
    baseColor: 0x88ccff,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.2, color: 0xaaddff },
      { t: 1, color: 0x4488cc }
    ],
    rotationSpeed: { min: -5, max: 5 },
    blendMode: 'ADD',
    depth: 6
  },

  /** Crackling lightning bolt chain. */
  lightning_bolt: {
    type: 'burst',
    shape: 'line',
    shapeParams: { x1: 0, y1: 0, x2: 200, y2: 0 },
    maxParticles: 120,
    burstCount: 60,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.1, max: 0.35 },
    speed: { min: 10, max: 80 },
    angle: { min: -Math.PI / 6, max: Math.PI / 6 },
    acceleration: { x: 0, y: 0 },
    baseScale: { min: 0.4, max: 1.0 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.1 }],
    alphaCurve: [{ t: 0, value: 1 }, { t: 0.5, value: 0.9 }, { t: 1, value: 0 }],
    baseColor: 0xccddff,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.3, color: 0xaaccff },
      { t: 1, color: 0x6688dd }
    ],
    rotationSpeed: { min: -10, max: 10 },
    blendMode: 'ADD',
    depth: 7
  },

  /** Void portal swirl — dark energy. */
  void_portal: {
    type: 'continuous',
    shape: 'ring',
    shapeParams: { innerRadius: 30, outerRadius: 50 },
    maxParticles: 300,
    emissionRate: 50,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 5, max: 20 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 0 },
    baseScale: { min: 0.6, max: 1.4 },
    scaleCurve: fadeInOut,
    alphaCurve: fadeInOut,
    baseColor: 0x6611aa,
    colorCurve: [
      { t: 0, color: 0x220044 },
      { t: 0.5, color: 0x8833cc },
      { t: 1, color: 0x220044 }
    ],
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'ADD',
    depth: 4
  },

  /** Temporal echo — ghostly after-image. */
  temporal_echo: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 32, height: 48 },
    maxParticles: 100,
    emissionRate: 20,
    lifetime: { min: 0.8, max: 1.5 },
    speed: { min: 5, max: 15 },
    angle: { min: Math.PI * 0.4, max: Math.PI * 0.6 },
    acceleration: { x: 0, y: -10 },
    baseScale: { min: 0.8, max: 1.2 },
    scaleCurve: fadeOut,
    alphaCurve: [{ t: 0, value: 0.5 }, { t: 0.5, value: 0.3 }, { t: 1, value: 0 }],
    baseColor: 0x88aaff,
    colorCurve: [
      { t: 0, color: 0xaaccff },
      { t: 1, color: 0x445588 }
    ],
    rotationSpeed: { min: 0, max: 0 },
    blendMode: 'ADD',
    depth: 3
  },

  /** Crimson flare — Sap-powered fire burst. */
  crimson_flare: {
    type: 'burst',
    shape: 'circle',
    shapeParams: { radius: 12 },
    maxParticles: 150,
    burstCount: 50,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.5, max: 1.2 },
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -40 },
    baseScale: { min: 0.6, max: 1.8 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xcc2200,
    colorCurve: [
      { t: 0, color: 0xff8844 },
      { t: 0.4, color: 0xcc2200 },
      { t: 1, color: 0x440000 }
    ],
    rotationSpeed: { min: -3, max: 3 },
    blendMode: 'ADD',
    depth: 6
  },

  /** Silver barrier — protective shield shimmer. */
  silver_barrier: {
    type: 'continuous',
    shape: 'ring',
    shapeParams: { innerRadius: 36, outerRadius: 40 },
    maxParticles: 200,
    emissionRate: 40,
    lifetime: { min: 0.6, max: 1.2 },
    speed: { min: 5, max: 20 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 0 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: pulse,
    alphaCurve: fadeInOut,
    baseColor: 0xccccdd,
    colorCurve: [
      { t: 0, color: 0xeeeeff },
      { t: 0.5, color: 0xaaaacc },
      { t: 1, color: 0x8888aa }
    ],
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'ADD',
    depth: 5
  },

  /** Green healing aura. */
  healing_aura: {
    type: 'continuous',
    shape: 'circle',
    shapeParams: { radius: 24 },
    maxParticles: 150,
    emissionRate: 25,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 10, max: 30 },
    angle: { min: -Math.PI * 0.75, max: -Math.PI * 0.25 },
    acceleration: { x: 0, y: -20 },
    baseScale: { min: 0.4, max: 1.0 },
    scaleCurve: growFade,
    alphaCurve: fadeInOut,
    baseColor: 0x44dd66,
    colorCurve: [
      { t: 0, color: 0xaaffaa },
      { t: 0.5, color: 0x44dd66 },
      { t: 1, color: 0x116622 }
    ],
    rotationSpeed: { min: -0.5, max: 0.5 },
    blendMode: 'ADD',
    depth: 4
  },

  /** Toxic poison cloud. */
  poison_cloud: {
    type: 'continuous',
    shape: 'circle',
    shapeParams: { radius: 40 },
    maxParticles: 250,
    emissionRate: 35,
    lifetime: { min: 1.5, max: 3.0 },
    speed: { min: 5, max: 25 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -8 },
    baseScale: { min: 1.0, max: 2.5 },
    scaleCurve: growFade,
    alphaCurve: [{ t: 0, value: 0 }, { t: 0.2, value: 0.5 }, { t: 0.7, value: 0.4 }, { t: 1, value: 0 }],
    baseColor: 0x66aa22,
    colorCurve: [
      { t: 0, color: 0x88cc44 },
      { t: 0.5, color: 0x66aa22 },
      { t: 1, color: 0x334411 }
    ],
    rotationSpeed: { min: -0.3, max: 0.3 },
    blendMode: 'NORMAL',
    depth: 3
  },

  /** Earth spike eruption. */
  earth_spike: {
    type: 'burst',
    shape: 'line',
    shapeParams: { x1: -20, y1: 0, x2: 20, y2: 0 },
    maxParticles: 80,
    burstCount: 40,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.3, max: 0.7 },
    speed: { min: 120, max: 280 },
    angle: { min: -Math.PI * 0.8, max: -Math.PI * 0.2 },
    acceleration: { x: 0, y: 350 },
    baseScale: { min: 0.6, max: 1.4 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.3 }],
    alphaCurve: fadeOut,
    baseColor: 0x886644,
    colorCurve: [
      { t: 0, color: 0xbbaa77 },
      { t: 0.4, color: 0x886644 },
      { t: 1, color: 0x443322 }
    ],
    rotationSpeed: { min: -4, max: 4 },
    blendMode: 'NORMAL',
    depth: 5
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIRONMENT EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Raindrop streaks. */
  rain: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 1400, height: 10 },
    maxParticles: 800,
    emissionRate: 200,
    lifetime: { min: 0.5, max: 0.9 },
    speed: { min: 400, max: 600 },
    angle: { min: Math.PI * 0.45, max: Math.PI * 0.48 },
    acceleration: { x: 0, y: 200 },
    baseScale: { min: 0.2, max: 0.4 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 1 }],
    alphaCurve: [{ t: 0, value: 0.4 }, { t: 0.8, value: 0.4 }, { t: 1, value: 0 }],
    baseColor: 0x8899bb,
    rotationSpeed: { min: 0, max: 0 },
    blendMode: 'ADD',
    depth: 10,
    spaceMode: 'world'
  },

  /** Gentle snowfall. */
  snow: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 1400, height: 10 },
    maxParticles: 500,
    emissionRate: 60,
    lifetime: { min: 3, max: 6 },
    speed: { min: 20, max: 50 },
    angle: { min: Math.PI * 0.35, max: Math.PI * 0.65 },
    acceleration: { x: 0, y: 15 },
    baseScale: { min: 0.3, max: 0.9 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.8 }],
    alphaCurve: fadeInOut,
    baseColor: 0xeeeeff,
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'NORMAL',
    depth: 10,
    spaceMode: 'world'
  },

  /** Floating fireflies in forests. */
  fireflies: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 600, height: 400 },
    maxParticles: 80,
    emissionRate: 5,
    lifetime: { min: 3, max: 7 },
    speed: { min: 5, max: 20 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -3 },
    baseScale: { min: 0.3, max: 0.7 },
    scaleCurve: pulse,
    alphaCurve: pulse,
    baseColor: 0xccff44,
    colorCurve: [
      { t: 0, color: 0xeeff88 },
      { t: 0.5, color: 0xccff44 },
      { t: 1, color: 0x88aa22 }
    ],
    rotationSpeed: { min: 0, max: 0 },
    blendMode: 'ADD',
    depth: 8
  },

  /** Autumn leaves drifting down. */
  falling_leaves: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 1200, height: 10 },
    maxParticles: 100,
    emissionRate: 8,
    lifetime: { min: 4, max: 8 },
    speed: { min: 15, max: 40 },
    angle: { min: Math.PI * 0.3, max: Math.PI * 0.7 },
    acceleration: { x: 0, y: 10 },
    baseScale: { min: 0.5, max: 1.2 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.8 }],
    alphaCurve: fadeInOut,
    baseColor: 0xcc8833,
    colorCurve: [
      { t: 0, color: 0xddaa44 },
      { t: 0.5, color: 0xcc6622 },
      { t: 1, color: 0x884411 }
    ],
    rotationSpeed: { min: -2, max: 2 },
    blendMode: 'NORMAL',
    depth: 9
  },

  /** Dust motes floating in shafts of light. */
  dust_motes: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 300, height: 200 },
    maxParticles: 120,
    emissionRate: 10,
    lifetime: { min: 3, max: 6 },
    speed: { min: 2, max: 10 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -2 },
    baseScale: { min: 0.15, max: 0.4 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 1 }],
    alphaCurve: [{ t: 0, value: 0 }, { t: 0.3, value: 0.5 }, { t: 0.7, value: 0.5 }, { t: 1, value: 0 }],
    baseColor: 0xddcc99,
    rotationSpeed: { min: 0, max: 0 },
    blendMode: 'ADD',
    depth: 7
  },

  /** Ember particles rising from a campfire. */
  ember_float: {
    type: 'continuous',
    shape: 'circle',
    shapeParams: { radius: 16 },
    maxParticles: 150,
    emissionRate: 20,
    lifetime: { min: 1.5, max: 3.5 },
    speed: { min: 15, max: 45 },
    angle: { min: -Math.PI * 0.8, max: -Math.PI * 0.2 },
    acceleration: { x: 0, y: -25 },
    baseScale: { min: 0.2, max: 0.6 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 0.7, value: 0.8 }, { t: 1, value: 0 }],
    alphaCurve: fadeOut,
    baseColor: 0xff8800,
    colorCurve: [
      { t: 0, color: 0xffcc44 },
      { t: 0.5, color: 0xff6600 },
      { t: 1, color: 0x882200 }
    ],
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'ADD',
    depth: 6
  },

  /** Blue Sap flow particles along Nexus veins. */
  sap_flow_blue: {
    type: 'continuous',
    shape: 'line',
    shapeParams: { x1: -60, y1: 0, x2: 60, y2: 0 },
    maxParticles: 200,
    emissionRate: 30,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 20, max: 50 },
    angle: { min: -Math.PI * 0.55, max: -Math.PI * 0.45 },
    acceleration: { x: 0, y: -5 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: fadeInOut,
    alphaCurve: fadeInOut,
    baseColor: 0x3388ff,
    colorCurve: [
      { t: 0, color: 0x88bbff },
      { t: 0.5, color: 0x3388ff },
      { t: 1, color: 0x1144aa }
    ],
    rotationSpeed: { min: -0.5, max: 0.5 },
    blendMode: 'ADD',
    depth: 2
  },

  /** Crimson Sap flow particles. */
  sap_flow_crimson: {
    type: 'continuous',
    shape: 'line',
    shapeParams: { x1: -60, y1: 0, x2: 60, y2: 0 },
    maxParticles: 200,
    emissionRate: 30,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 20, max: 50 },
    angle: { min: -Math.PI * 0.55, max: -Math.PI * 0.45 },
    acceleration: { x: 0, y: -5 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: fadeInOut,
    alphaCurve: fadeInOut,
    baseColor: 0xcc2244,
    colorCurve: [
      { t: 0, color: 0xff6677 },
      { t: 0.5, color: 0xcc2244 },
      { t: 1, color: 0x661122 }
    ],
    rotationSpeed: { min: -0.5, max: 0.5 },
    blendMode: 'ADD',
    depth: 2
  },

  /** Silver Sap flow particles. */
  sap_flow_silver: {
    type: 'continuous',
    shape: 'line',
    shapeParams: { x1: -60, y1: 0, x2: 60, y2: 0 },
    maxParticles: 200,
    emissionRate: 30,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 20, max: 50 },
    angle: { min: -Math.PI * 0.55, max: -Math.PI * 0.45 },
    acceleration: { x: 0, y: -5 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: fadeInOut,
    alphaCurve: fadeInOut,
    baseColor: 0xbbbbcc,
    colorCurve: [
      { t: 0, color: 0xeeeeff },
      { t: 0.5, color: 0xbbbbcc },
      { t: 1, color: 0x666677 }
    ],
    rotationSpeed: { min: -0.5, max: 0.5 },
    blendMode: 'ADD',
    depth: 2
  },

  /** Low-lying fog wisps. */
  fog_wisps: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 800, height: 60 },
    maxParticles: 100,
    emissionRate: 6,
    lifetime: { min: 4, max: 8 },
    speed: { min: 8, max: 20 },
    angle: { min: -0.1, max: 0.1 },
    acceleration: { x: 0, y: -2 },
    baseScale: { min: 2.0, max: 4.0 },
    scaleCurve: growFade,
    alphaCurve: [{ t: 0, value: 0 }, { t: 0.3, value: 0.25 }, { t: 0.7, value: 0.2 }, { t: 1, value: 0 }],
    baseColor: 0xaaaaaa,
    rotationSpeed: { min: -0.1, max: 0.1 },
    blendMode: 'NORMAL',
    depth: 1
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPACT EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Metallic hit spark. */
  hit_spark: {
    type: 'burst',
    shape: 'point',
    maxParticles: 40,
    burstCount: 20,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.1, max: 0.35 },
    speed: { min: 150, max: 400 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 200 },
    baseScale: { min: 0.2, max: 0.6 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0 }],
    alphaCurve: [{ t: 0, value: 1 }, { t: 1, value: 0 }],
    baseColor: 0xffffaa,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.3, color: 0xffdd66 },
      { t: 1, color: 0xff6600 }
    ],
    rotationSpeed: { min: -8, max: 8 },
    blendMode: 'ADD',
    depth: 8
  },

  /** Blood splatter on physical hit. */
  blood_splatter: {
    type: 'burst',
    shape: 'point',
    maxParticles: 30,
    burstCount: 15,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.3, max: 0.6 },
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 300 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.5 }],
    alphaCurve: fadeOut,
    baseColor: 0xaa1122,
    colorCurve: [
      { t: 0, color: 0xdd3344 },
      { t: 1, color: 0x661111 }
    ],
    rotationSpeed: { min: -3, max: 3 },
    blendMode: 'NORMAL',
    collisionBehavior: 'stick',
    depth: 6
  },

  /** Generic magic impact flash. */
  magic_impact: {
    type: 'burst',
    shape: 'circle',
    shapeParams: { radius: 6 },
    maxParticles: 60,
    burstCount: 30,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.2, max: 0.5 },
    speed: { min: 80, max: 220 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 0 },
    baseScale: { min: 0.4, max: 1.2 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xcc88ff,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.2, color: 0xcc88ff },
      { t: 1, color: 0x6633aa }
    ],
    rotationSpeed: { min: -4, max: 4 },
    blendMode: 'ADD',
    depth: 8
  },

  /** Fiery explosion. */
  explosion: {
    type: 'burst',
    shape: 'point',
    maxParticles: 200,
    burstCount: 80,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.3, max: 1.0 },
    speed: { min: 100, max: 350 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 60 },
    baseScale: { min: 0.6, max: 2.0 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xff6600,
    colorCurve: [
      { t: 0, color: 0xffffcc },
      { t: 0.15, color: 0xff8800 },
      { t: 0.5, color: 0xcc3300 },
      { t: 1, color: 0x331100 }
    ],
    rotationSpeed: { min: -3, max: 3 },
    blendMode: 'ADD',
    trail: { enabled: true, frequency: 0.04, emitterId: null },
    depth: 9
  },

  /** Glass / crystal shatter. */
  shatter: {
    type: 'burst',
    shape: 'circle',
    shapeParams: { radius: 10 },
    maxParticles: 50,
    burstCount: 25,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.4, max: 0.9 },
    speed: { min: 120, max: 300 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 350 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: [{ t: 0, value: 1 }, { t: 1, value: 0.6 }],
    alphaCurve: fadeOut,
    baseColor: 0xccddee,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.3, color: 0xccddee },
      { t: 1, color: 0x667788 }
    ],
    rotationSpeed: { min: -10, max: 10 },
    blendMode: 'NORMAL',
    collisionBehavior: 'bounce',
    bounceFactor: 0.3,
    depth: 7
  },

  /** Dissolve / disintegration. */
  dissolve: {
    type: 'burst',
    shape: 'rectangle',
    shapeParams: { width: 32, height: 48 },
    maxParticles: 120,
    burstCount: 60,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.8, max: 2.0 },
    speed: { min: 10, max: 50 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -15 },
    baseScale: { min: 0.2, max: 0.6 },
    scaleCurve: fadeOut,
    alphaCurve: [{ t: 0, value: 1 }, { t: 0.6, value: 0.6 }, { t: 1, value: 0 }],
    baseColor: 0x888888,
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'NORMAL',
    depth: 5
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI / AMBIENT EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Level-up celebration fountain. */
  level_up: {
    type: 'burst',
    shape: 'ring',
    shapeParams: { innerRadius: 0, outerRadius: 10 },
    maxParticles: 200,
    burstCount: 80,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 1.0, max: 2.5 },
    speed: { min: 80, max: 200 },
    angle: { min: -Math.PI, max: 0 },
    acceleration: { x: 0, y: 60 },
    baseScale: { min: 0.3, max: 1.0 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xffdd44,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.2, color: 0xffee66 },
      { t: 0.6, color: 0xffaa22 },
      { t: 1, color: 0x885500 }
    ],
    rotationSpeed: { min: -2, max: 2 },
    blendMode: 'ADD',
    depth: 12
  },

  /** Item pickup sparkle. */
  item_pickup: {
    type: 'burst',
    shape: 'circle',
    shapeParams: { radius: 14 },
    maxParticles: 30,
    burstCount: 15,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 0.3, max: 0.8 },
    speed: { min: 30, max: 80 },
    angle: { min: -Math.PI, max: 0 },
    acceleration: { x: 0, y: -20 },
    baseScale: { min: 0.2, max: 0.6 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0xffee88,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.3, color: 0xffee88 },
      { t: 1, color: 0x886600 }
    ],
    rotationSpeed: { min: -3, max: 3 },
    blendMode: 'ADD',
    depth: 11
  },

  /** Quest completion radial burst. */
  quest_complete: {
    type: 'burst',
    shape: 'ring',
    shapeParams: { innerRadius: 5, outerRadius: 20 },
    maxParticles: 150,
    burstCount: 60,
    burstInterval: 0,
    maxEmissions: 1,
    lifetime: { min: 1.0, max: 2.0 },
    speed: { min: 60, max: 180 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: 20 },
    baseScale: { min: 0.4, max: 1.0 },
    scaleCurve: popScale,
    alphaCurve: fadeOut,
    baseColor: 0x44ddff,
    colorCurve: [
      { t: 0, color: 0xffffff },
      { t: 0.2, color: 0x88eeff },
      { t: 0.6, color: 0x44bbdd },
      { t: 1, color: 0x226688 }
    ],
    rotationSpeed: { min: -2, max: 2 },
    blendMode: 'ADD',
    depth: 12
  },

  /** Teleport swirl — inward spiral. */
  teleport_swirl: {
    type: 'continuous',
    shape: 'ring',
    shapeParams: { innerRadius: 40, outerRadius: 60 },
    maxParticles: 250,
    emissionRate: 80,
    lifetime: { min: 0.5, max: 1.0 },
    speed: { min: 10, max: 30 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -20 },
    baseScale: { min: 0.3, max: 0.8 },
    scaleCurve: fadeOut,
    alphaCurve: fadeInOut,
    baseColor: 0x8866ff,
    colorCurve: [
      { t: 0, color: 0xccaaff },
      { t: 0.5, color: 0x8866ff },
      { t: 1, color: 0x332288 }
    ],
    rotationSpeed: { min: -6, max: 6 },
    blendMode: 'ADD',
    duration: 1.5,
    depth: 10
  },

  /** Death essence — dark wisps leaving a corpse. */
  death_essence: {
    type: 'continuous',
    shape: 'rectangle',
    shapeParams: { width: 32, height: 20 },
    maxParticles: 80,
    emissionRate: 15,
    lifetime: { min: 1.0, max: 2.5 },
    speed: { min: 10, max: 30 },
    angle: { min: -Math.PI * 0.7, max: -Math.PI * 0.3 },
    acceleration: { x: 0, y: -10 },
    baseScale: { min: 0.4, max: 1.0 },
    scaleCurve: growFade,
    alphaCurve: [{ t: 0, value: 0 }, { t: 0.2, value: 0.6 }, { t: 0.7, value: 0.4 }, { t: 1, value: 0 }],
    baseColor: 0x332244,
    colorCurve: [
      { t: 0, color: 0x665588 },
      { t: 0.5, color: 0x332244 },
      { t: 1, color: 0x110011 }
    ],
    rotationSpeed: { min: -0.5, max: 0.5 },
    blendMode: 'ADD',
    duration: 3.0,
    depth: 5
  },

  /** Active buff indicator — orbiting sparkles. */
  buff_active: {
    type: 'continuous',
    shape: 'ring',
    shapeParams: { innerRadius: 18, outerRadius: 22 },
    maxParticles: 60,
    emissionRate: 12,
    lifetime: { min: 0.8, max: 1.5 },
    speed: { min: 5, max: 15 },
    angle: { min: 0, max: Math.PI * 2 },
    acceleration: { x: 0, y: -5 },
    baseScale: { min: 0.2, max: 0.5 },
    scaleCurve: pulse,
    alphaCurve: fadeInOut,
    baseColor: 0xffcc44,
    colorCurve: [
      { t: 0, color: 0xffee88 },
      { t: 0.5, color: 0xffcc44 },
      { t: 1, color: 0xaa7722 }
    ],
    rotationSpeed: { min: -1, max: 1 },
    blendMode: 'ADD',
    depth: 4
  }
};

export default particlePresets;
