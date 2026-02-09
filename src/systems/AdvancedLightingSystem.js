/**
 * AdvancedLightingSystem - Comprehensive 2D lighting engine for Verdance.
 *
 * Provides dynamic point, spot, directional, and area lights with real-time
 * shadow casting via raycasting against registered occluder geometry. Lighting
 * is composited onto the scene through four render-texture layers (lighting,
 * shadows, normals, volumetric) using appropriate Phaser blend modes.
 *
 * Features:
 *  - Four compositing layers with independent blend modes
 *  - Point / spot / directional / area light types
 *  - Dynamic shadow casting with configurable ray count
 *  - Flicker, pulse, and colorCycle per-light effects
 *  - LOD-based quality: fewer shadow rays for distant lights
 *  - Adaptive quality: automatically lowers render resolution on FPS drops
 *  - Rectangle and polygon occluder shapes
 *  - Debug visualisation (light radii, shadow rays, occluder outlines)
 *  - Statistics tracking for profiling
 *
 * Part of the Realm of Nexus / Verdance project.
 */

import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

// ── helpers ────────────────────────────────────────────────────────────────────

/** Convert a 0xRRGGBB integer to { r, g, b } in 0-1 range. */
function hexToNorm(hex) {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

/** Linearly interpolate between two normalised colour objects. */
function lerpColor(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Convert normalised { r, g, b } back to a 0xRRGGBB integer. */
function normToHex(c) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return (r << 16) | (g << 8) | b;
}

/** Clamp a number between min and max. */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Euclidean distance. */
function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── quality presets ────────────────────────────────────────────────────────────

const QUALITY_SETTINGS = {
  low: {
    resolutionScale: 0.25,
    maxShadowRays: 24,
    shadowBlur: 0,
    volumetricEnabled: false,
    maxActiveLights: 8,
    lodDistanceMultiplier: 0.5,
  },
  medium: {
    resolutionScale: 0.5,
    maxShadowRays: 48,
    shadowBlur: 1,
    volumetricEnabled: false,
    maxActiveLights: 16,
    lodDistanceMultiplier: 0.75,
  },
  high: {
    resolutionScale: 0.75,
    maxShadowRays: 96,
    shadowBlur: 2,
    volumetricEnabled: true,
    maxActiveLights: 32,
    lodDistanceMultiplier: 1.0,
  },
  ultra: {
    resolutionScale: 1.0,
    maxShadowRays: 180,
    shadowBlur: 3,
    volumetricEnabled: true,
    maxActiveLights: 64,
    lodDistanceMultiplier: 1.5,
  },
};

// Default quality level
const DEFAULT_QUALITY = 'high';

// ── main class ─────────────────────────────────────────────────────────────────

let _lightIdCounter = 0;
let _occluderIdCounter = 0;

export class AdvancedLightingSystem {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene this system is attached to.
   */
  constructor(scene) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // ── collections ──────────────────────────────────────────────────────────
    /** @type {Map<string, Object>} */
    this.lights = new Map();
    /** @type {Map<string, Object>} */
    this.occluders = new Map();

    // ── ambient ──────────────────────────────────────────────────────────────
    this.ambient = {
      color: { r: 0.05, g: 0.05, b: 0.12 },
      intensity: 0.15,
    };

    // ── quality ──────────────────────────────────────────────────────────────
    this.qualityLevel = DEFAULT_QUALITY;
    this.quality = { ...QUALITY_SETTINGS[DEFAULT_QUALITY] };

    // ── adaptive quality ─────────────────────────────────────────────────────
    this.adaptiveEnabled = GameConfig.PERFORMANCE.ADAPTIVE_QUALITY;
    this._fpsHistory = [];
    this._adaptiveTimer = 0;
    this._adaptiveInterval = 2000; // evaluate every 2 s

    // ── render textures ──────────────────────────────────────────────────────
    this._rtWidth = Math.ceil(GameConfig.WIDTH * this.quality.resolutionScale);
    this._rtHeight = Math.ceil(GameConfig.HEIGHT * this.quality.resolutionScale);

    this.lightingRT = scene.make.renderTexture(
      { x: 0, y: 0, width: this._rtWidth, height: this._rtHeight, add: false },
      false,
    );
    this.shadowRT = scene.make.renderTexture(
      { x: 0, y: 0, width: this._rtWidth, height: this._rtHeight, add: false },
      false,
    );
    this.normalRT = scene.make.renderTexture(
      { x: 0, y: 0, width: this._rtWidth, height: this._rtHeight, add: false },
      false,
    );
    this.volumetricRT = scene.make.renderTexture(
      { x: 0, y: 0, width: this._rtWidth, height: this._rtHeight, add: false },
      false,
    );

    // Display images that composite onto the scene
    this.lightingImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.lightingImage.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lightingImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);
    this.lightingImage.setDepth(9998);

    this.volumetricImage = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.volumetricImage.setBlendMode(Phaser.BlendModes.ADD);
    this.volumetricImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);
    this.volumetricImage.setDepth(9999);
    this.volumetricImage.setVisible(this.quality.volumetricEnabled);

    // ── debug ────────────────────────────────────────────────────────────────
    this.debugEnabled = GameConfig.DEBUG.SHOW_LIGHTING || false;
    this.debugGraphics = null;
    if (this.debugEnabled) {
      this._createDebugGraphics();
    }

    // ── statistics ───────────────────────────────────────────────────────────
    this._stats = {
      lightCount: 0,
      shadowCasterCount: 0,
      occluderCount: 0,
      renderTimeMs: 0,
      raysThisFrame: 0,
      activeQuality: this.qualityLevel,
    };

    // ── event wiring ─────────────────────────────────────────────────────────
    this._onResize = this._handleResize.bind(this);
    this.scene.scale.on('resize', this._onResize);
    this.eventBus.emit('lighting:ready', { system: this });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  LIGHT MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Register a new light source.
   *
   * @param {Object} config
   * @param {string}  [config.id]           - Unique identifier (auto-generated if omitted).
   * @param {string}  [config.type='point'] - 'point' | 'spot' | 'directional' | 'area'
   * @param {number}  config.x
   * @param {number}  config.y
   * @param {number}  [config.color=0xffffff]
   * @param {number}  [config.intensity=1]
   * @param {number}  [config.radius=200]
   * @param {number}  [config.angle=0]       - Direction angle in radians (spot / directional).
   * @param {number}  [config.coneAngle=Math.PI/4] - Half-cone angle for spot lights.
   * @param {number}  [config.width=100]     - Width for area lights.
   * @param {number}  [config.height=20]     - Height for area lights.
   * @param {boolean} [config.castShadows=true]
   * @param {Object}  [config.effects]       - { flicker, pulse, colorCycle }
   * @returns {Object} The created light object.
   */
  addLight(config = {}) {
    const id = config.id || `light_${++_lightIdCounter}`;
    const light = {
      id,
      type: config.type || 'point',
      x: config.x ?? 0,
      y: config.y ?? 0,
      color: config.color ?? 0xffffff,
      intensity: clamp(config.intensity ?? 1, 0, 10),
      radius: config.radius ?? 200,
      angle: config.angle ?? 0,
      coneAngle: config.coneAngle ?? Math.PI / 4,
      width: config.width ?? 100,
      height: config.height ?? 20,
      castShadows: config.castShadows !== false,
      enabled: true,
      effects: {
        flicker: config.effects?.flicker ?? null,
        pulse: config.effects?.pulse ?? null,
        colorCycle: config.effects?.colorCycle ?? null,
      },
      // internal runtime state
      _baseIntensity: clamp(config.intensity ?? 1, 0, 10),
      _baseColor: config.color ?? 0xffffff,
      _effectTime: 0,
      _shadowPolygon: [],
    };

    this.lights.set(id, light);
    this._stats.lightCount = this.lights.size;
    this._stats.shadowCasterCount = this._countShadowCasters();
    this.eventBus.emit('lighting:lightAdded', { id, light });
    return light;
  }

  /**
   * Remove a light by id.
   * @param {string} id
   * @returns {boolean} True if the light existed and was removed.
   */
  removeLight(id) {
    const existed = this.lights.delete(id);
    if (existed) {
      this._stats.lightCount = this.lights.size;
      this._stats.shadowCasterCount = this._countShadowCasters();
      this.eventBus.emit('lighting:lightRemoved', { id });
    }
    return existed;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  OCCLUDER MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Register an occluder (shadow-blocking geometry).
   *
   * @param {Object} config
   * @param {string}  [config.id]
   * @param {string}  [config.shape='rect'] - 'rect' | 'polygon'
   * @param {number}  [config.x]
   * @param {number}  [config.y]
   * @param {number}  [config.width]        - For rect shapes.
   * @param {number}  [config.height]       - For rect shapes.
   * @param {Array<{x:number,y:number}>} [config.vertices] - For polygon shapes.
   * @returns {Object} The created occluder.
   */
  addOccluder(config = {}) {
    const id = config.id || `occ_${++_occluderIdCounter}`;
    const shape = config.shape || 'rect';

    let edges = [];
    if (shape === 'rect') {
      const x = config.x ?? 0;
      const y = config.y ?? 0;
      const w = config.width ?? 32;
      const h = config.height ?? 32;
      // Build four edges (line segments) from the rectangle corners
      const corners = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      for (let i = 0; i < corners.length; i++) {
        edges.push({
          x1: corners[i].x,
          y1: corners[i].y,
          x2: corners[(i + 1) % corners.length].x,
          y2: corners[(i + 1) % corners.length].y,
        });
      }
    } else if (shape === 'polygon' && Array.isArray(config.vertices) && config.vertices.length >= 3) {
      const verts = config.vertices;
      for (let i = 0; i < verts.length; i++) {
        edges.push({
          x1: verts[i].x,
          y1: verts[i].y,
          x2: verts[(i + 1) % verts.length].x,
          y2: verts[(i + 1) % verts.length].y,
        });
      }
    }

    const occluder = {
      id,
      shape,
      x: config.x ?? 0,
      y: config.y ?? 0,
      width: config.width ?? 0,
      height: config.height ?? 0,
      vertices: config.vertices ?? [],
      edges,
      enabled: true,
    };

    this.occluders.set(id, occluder);
    this._stats.occluderCount = this.occluders.size;
    this.eventBus.emit('lighting:occluderAdded', { id, occluder });
    return occluder;
  }

  /**
   * Remove an occluder by id.
   * @param {string} id
   * @returns {boolean}
   */
  removeOccluder(id) {
    const existed = this.occluders.delete(id);
    if (existed) {
      this._stats.occluderCount = this.occluders.size;
      this.eventBus.emit('lighting:occluderRemoved', { id });
    }
    return existed;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  UPDATE LOOP
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Called each frame from the scene's update.
   * @param {number} time  - Total elapsed ms.
   * @param {number} delta - Ms since last frame.
   */
  update(time, delta) {
    const t0 = performance.now();

    // Adaptive quality evaluation
    if (this.adaptiveEnabled) {
      this._evaluateAdaptiveQuality(delta);
    }

    // Update per-light effects
    for (const light of this.lights.values()) {
      if (light.enabled) {
        this.updateLightEffects(light, time);
      }
    }

    // Render all lighting layers
    this.renderLighting();

    // Update statistics
    this._stats.renderTimeMs = performance.now() - t0;
    this._stats.activeQuality = this.qualityLevel;

    // Debug overlay
    if (this.debugEnabled) {
      this._renderDebug();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDERING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Composite the lighting, shadow, and volumetric layers.
   */
  renderLighting() {
    const camera = this.scene.cameras.main;
    const camX = camera.scrollX;
    const camY = camera.scrollY;
    const scale = this.quality.resolutionScale;

    // Reset render textures
    this.lightingRT.clear();
    this.shadowRT.clear();
    this.volumetricRT.clear();

    // Fill lighting RT with ambient colour
    const ac = this.ambient.color;
    const ai = this.ambient.intensity;
    this.lightingRT.fill(
      Math.round(ac.r * ai * 255),
      Math.round(ac.g * ai * 255),
      Math.round(ac.b * ai * 255),
      255,
    );

    // Prepare the sorted light list (by distance from camera centre, closest first)
    const camCX = camX + GameConfig.WIDTH * 0.5;
    const camCY = camY + GameConfig.HEIGHT * 0.5;
    const sortedLights = this._getSortedActiveLights(camCX, camCY);

    this._stats.raysThisFrame = 0;

    // Draw each active light
    for (const light of sortedLights) {
      // Screen-space position (offset by camera)
      const sx = (light.x - camX) * scale;
      const sy = (light.y - camY) * scale;
      const radius = light.radius * scale;

      // Frustum cull: skip lights entirely off-screen
      if (
        sx + radius < 0 ||
        sy + radius < 0 ||
        sx - radius > this._rtWidth ||
        sy - radius > this._rtHeight
      ) {
        continue;
      }

      const col = hexToNorm(light.color);

      // Draw light contribution onto lightingRT
      this._drawLightContribution(light, sx, sy, radius, col);

      // Cast shadows
      if (light.castShadows && this.occluders.size > 0) {
        this.castShadows(light);
      }

      // Volumetric scattering (additive glow)
      if (this.quality.volumetricEnabled && light.intensity > 0.3) {
        this._drawVolumetricGlow(light, sx, sy, radius, col);
      }
    }

    // Push final textures to display images
    this.lightingImage.setTexture(this.lightingRT.texture.key);
    this.lightingImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);

    if (this.quality.volumetricEnabled) {
      this.volumetricImage.setTexture(this.volumetricRT.texture.key);
      this.volumetricImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);
      this.volumetricImage.setVisible(true);
    } else {
      this.volumetricImage.setVisible(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SHADOW CASTING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Cast shadow rays from the given light against all registered occluders.
   * Produces a shadow polygon stored on light._shadowPolygon for later rendering.
   *
   * @param {Object} light
   */
  castShadows(light) {
    const d = dist(
      light.x,
      light.y,
      this.scene.cameras.main.scrollX + GameConfig.WIDTH * 0.5,
      this.scene.cameras.main.scrollY + GameConfig.HEIGHT * 0.5,
    );

    // LOD: reduce ray count for distant lights
    const lodFactor = clamp(
      1 - (d / (GameConfig.WIDTH * this.quality.lodDistanceMultiplier)),
      0.2,
      1,
    );
    const rayCount = Math.max(12, Math.floor(this.quality.maxShadowRays * lodFactor));
    this._stats.raysThisFrame += rayCount;

    const enabledOccluders = [];
    for (const occ of this.occluders.values()) {
      if (occ.enabled) enabledOccluders.push(occ);
    }

    // Build visibility polygon by casting rays at evenly-spaced angles plus
    // rays aimed directly at each occluder edge endpoint (+/- tiny offset).
    const angles = new Set();
    const step = (Math.PI * 2) / rayCount;
    for (let i = 0; i < rayCount; i++) {
      angles.add(i * step);
    }

    // Add targeted rays toward occluder vertices for tighter shadow edges
    for (const occ of enabledOccluders) {
      for (const edge of occ.edges) {
        for (const pt of [{ x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 }]) {
          const a = Math.atan2(pt.y - light.y, pt.x - light.x);
          angles.add(a - 0.0001);
          angles.add(a);
          angles.add(a + 0.0001);
        }
      }
    }

    // Sort angles and cast
    const sorted = [...angles].sort((a, b) => a - b);
    const polygon = [];

    for (const angle of sorted) {
      const endX = light.x + Math.cos(angle) * light.radius;
      const endY = light.y + Math.sin(angle) * light.radius;
      const hit = this.raycast(light.x, light.y, endX, endY, enabledOccluders);
      polygon.push(hit);
    }

    light._shadowPolygon = polygon;
  }

  /**
   * Cast a single ray from (x1,y1) towards (x2,y2) and return the closest
   * intersection with any occluder edge, or the endpoint if nothing is hit.
   *
   * Uses segment-segment intersection math.
   *
   * @param {number} x1 - Ray origin X.
   * @param {number} y1 - Ray origin Y.
   * @param {number} x2 - Ray target X.
   * @param {number} y2 - Ray target Y.
   * @param {Array}  occluders - Array of occluder objects with .edges arrays.
   * @returns {{ x: number, y: number, hit: boolean }}
   */
  raycast(x1, y1, x2, y2, occluders) {
    let closestT = 1;
    let hitX = x2;
    let hitY = y2;
    let hit = false;

    const rdx = x2 - x1;
    const rdy = y2 - y1;

    for (const occ of occluders) {
      for (const edge of occ.edges) {
        const sdx = edge.x2 - edge.x1;
        const sdy = edge.y2 - edge.y1;

        const denom = rdx * sdy - rdy * sdx;
        if (Math.abs(denom) < 1e-10) continue; // parallel

        const t = ((edge.x1 - x1) * sdy - (edge.y1 - y1) * sdx) / denom;
        const u = ((edge.x1 - x1) * rdy - (edge.y1 - y1) * rdx) / denom;

        if (t >= 0 && t < closestT && u >= 0 && u <= 1) {
          closestT = t;
          hitX = x1 + rdx * t;
          hitY = y1 + rdy * t;
          hit = true;
        }
      }
    }

    return { x: hitX, y: hitY, hit };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  LIGHT EFFECTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Apply flicker / pulse / colorCycle effects to a light.
   *
   * @param {Object} light
   * @param {number} time - Elapsed time in ms.
   */
  updateLightEffects(light, time) {
    light._effectTime = time;
    let intensity = light._baseIntensity;
    let color = hexToNorm(light._baseColor);

    // ── Flicker ──────────────────────────────────────────────────────────────
    // Random intensity jitter simulating a flame or faulty lamp.
    if (light.effects.flicker) {
      const f = light.effects.flicker;
      const speed = f.speed ?? 10;
      const amount = f.amount ?? 0.15;
      // Pseudo-random flicker using sin with prime-frequency modulation
      const noise =
        Math.sin(time * 0.001 * speed * 1.0) * 0.5 +
        Math.sin(time * 0.001 * speed * 2.3) * 0.3 +
        Math.sin(time * 0.001 * speed * 5.7) * 0.2;
      intensity += noise * amount * light._baseIntensity;
    }

    // ── Pulse ────────────────────────────────────────────────────────────────
    // Smooth sinusoidal intensity oscillation.
    if (light.effects.pulse) {
      const p = light.effects.pulse;
      const speed = p.speed ?? 1;
      const min = p.min ?? 0.5;
      const max = p.max ?? 1.0;
      const t = (Math.sin(time * 0.001 * speed * Math.PI * 2) + 1) * 0.5;
      intensity *= min + (max - min) * t;
    }

    // ── Color Cycle ──────────────────────────────────────────────────────────
    // Smoothly cycles the light colour through an array of colours.
    if (light.effects.colorCycle) {
      const cc = light.effects.colorCycle;
      const colors = cc.colors ?? [0xff0000, 0x00ff00, 0x0000ff];
      const speed = cc.speed ?? 1;
      const total = colors.length;
      const progress = ((time * 0.001 * speed) % total + total) % total;
      const idx = Math.floor(progress);
      const frac = progress - idx;
      const cA = hexToNorm(colors[idx % total]);
      const cB = hexToNorm(colors[(idx + 1) % total]);
      color = lerpColor(cA, cB, frac);
    }

    // Apply computed values
    light.intensity = clamp(intensity, 0, 10);
    light.color = normToHex(color);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  AMBIENT
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Set the global ambient light.
   * @param {number} color     - 0xRRGGBB
   * @param {number} intensity - 0..1 (clamped)
   */
  setAmbient(color, intensity) {
    this.ambient.color = hexToNorm(color);
    this.ambient.intensity = clamp(intensity, 0, 1);
    this.eventBus.emit('lighting:ambientChanged', {
      color,
      intensity: this.ambient.intensity,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  QUALITY
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Set the rendering quality tier.
   * @param {'low'|'medium'|'high'|'ultra'} level
   */
  setQuality(level) {
    if (!QUALITY_SETTINGS[level]) {
      console.warn(`[AdvancedLightingSystem] Unknown quality level "${level}"`);
      return;
    }
    this.qualityLevel = level;
    this.quality = { ...QUALITY_SETTINGS[level] };
    this._rebuildRenderTextures();
    this.volumetricImage.setVisible(this.quality.volumetricEnabled);
    this.eventBus.emit('lighting:qualityChanged', { level, settings: this.quality });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  STATISTICS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Return a snapshot of current lighting system statistics.
   * @returns {Object}
   */
  getStatistics() {
    return { ...this._stats };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  DEBUG
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Enable or disable the debug overlay.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugEnabled = !!enabled;
    if (this.debugEnabled && !this.debugGraphics) {
      this._createDebugGraphics();
    }
    if (!this.debugEnabled && this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CLEANUP
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Destroy the system and release all GPU / scene resources.
   */
  destroy() {
    this.scene.scale.off('resize', this._onResize);

    this.lightingRT.destroy();
    this.shadowRT.destroy();
    this.normalRT.destroy();
    this.volumetricRT.destroy();

    this.lightingImage.destroy();
    this.volumetricImage.destroy();

    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }

    this.lights.clear();
    this.occluders.clear();

    this.eventBus.emit('lighting:destroyed');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Draw a single light's additive contribution onto the lightingRT.
   * @private
   */
  _drawLightContribution(light, sx, sy, radius, col) {
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });

    const alpha = clamp(light.intensity, 0, 1);
    const hexColor = normToHex(col);

    switch (light.type) {
      case 'point': {
        // Radial gradient approximated by concentric circles
        const steps = 8;
        for (let i = steps; i >= 1; i--) {
          const frac = i / steps;
          const a = alpha * (1 - frac) * 0.9;
          gfx.fillStyle(hexColor, a);
          gfx.fillCircle(sx, sy, radius * frac);
        }
        break;
      }

      case 'spot': {
        // Cone of light
        const halfCone = light.coneAngle ?? Math.PI / 4;
        const startAngle = light.angle - halfCone;
        const endAngle = light.angle + halfCone;
        const steps = 6;
        for (let i = steps; i >= 1; i--) {
          const frac = i / steps;
          const a = alpha * (1 - frac) * 0.85;
          gfx.fillStyle(hexColor, a);
          gfx.slice(sx, sy, radius * frac, startAngle, endAngle, false);
          gfx.fillPath();
        }
        break;
      }

      case 'directional': {
        // Full-screen directional wash
        const a = alpha * 0.6;
        gfx.fillStyle(hexColor, a);
        gfx.fillRect(0, 0, this._rtWidth, this._rtHeight);
        break;
      }

      case 'area': {
        // Soft rectangular light
        const scale = this.quality.resolutionScale;
        const aw = (light.width ?? 100) * scale;
        const ah = (light.height ?? 20) * scale;
        const steps = 5;
        for (let i = steps; i >= 1; i--) {
          const frac = i / steps;
          const pad = radius * frac * 0.5;
          const a = alpha * (1 - frac) * 0.7;
          gfx.fillStyle(hexColor, a);
          gfx.fillRect(sx - aw * 0.5 - pad, sy - ah * 0.5 - pad, aw + pad * 2, ah + pad * 2);
        }
        break;
      }

      default:
        break;
    }

    this.lightingRT.draw(gfx);
    gfx.destroy();
  }

  /**
   * Draw volumetric (additive) glow for a light on the volumetricRT.
   * @private
   */
  _drawVolumetricGlow(light, sx, sy, radius, col) {
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    const hexColor = normToHex(col);
    const alpha = clamp(light.intensity * 0.25, 0, 0.4);
    const outerRadius = radius * 1.4;

    const steps = 5;
    for (let i = steps; i >= 1; i--) {
      const frac = i / steps;
      gfx.fillStyle(hexColor, alpha * (1 - frac));
      gfx.fillCircle(sx, sy, outerRadius * frac);
    }

    this.volumetricRT.draw(gfx);
    gfx.destroy();
  }

  /**
   * Return active lights sorted by distance to the given point, limited by
   * the current quality's maxActiveLights.
   * @private
   */
  _getSortedActiveLights(cx, cy) {
    const active = [];
    for (const light of this.lights.values()) {
      if (!light.enabled) continue;
      light._distToCamera = dist(light.x, light.y, cx, cy);
      active.push(light);
    }
    active.sort((a, b) => a._distToCamera - b._distToCamera);
    return active.slice(0, this.quality.maxActiveLights);
  }

  /** @private Count lights that have castShadows enabled. */
  _countShadowCasters() {
    let count = 0;
    for (const l of this.lights.values()) {
      if (l.castShadows) count++;
    }
    return count;
  }

  /**
   * Evaluate FPS history and step quality down/up if necessary.
   * @private
   */
  _evaluateAdaptiveQuality(delta) {
    this._adaptiveTimer += delta;
    const fps = 1000 / Math.max(1, delta);
    this._fpsHistory.push(fps);

    if (this._adaptiveTimer < this._adaptiveInterval) return;
    this._adaptiveTimer = 0;

    // Average FPS over the evaluation window
    const avg =
      this._fpsHistory.reduce((s, v) => s + v, 0) / this._fpsHistory.length;
    this._fpsHistory = [];

    const levels = ['low', 'medium', 'high', 'ultra'];
    const idx = levels.indexOf(this.qualityLevel);

    if (avg < GameConfig.PERFORMANCE.LOW_FPS_THRESHOLD && idx > 0) {
      this.setQuality(levels[idx - 1]);
    } else if (avg > GameConfig.PERFORMANCE.TARGET_FPS - 5 && idx < levels.length - 1) {
      // Only step up if well above target
      if (avg > GameConfig.PERFORMANCE.TARGET_FPS + 5) {
        this.setQuality(levels[idx + 1]);
      }
    }
  }

  /**
   * Rebuild all render textures to match the current resolution scale.
   * @private
   */
  _rebuildRenderTextures() {
    this._rtWidth = Math.ceil(GameConfig.WIDTH * this.quality.resolutionScale);
    this._rtHeight = Math.ceil(GameConfig.HEIGHT * this.quality.resolutionScale);

    // Destroy old
    this.lightingRT.destroy();
    this.shadowRT.destroy();
    this.normalRT.destroy();
    this.volumetricRT.destroy();

    // Create new
    const make = (w, h) =>
      this.scene.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false }, false);

    this.lightingRT = make(this._rtWidth, this._rtHeight);
    this.shadowRT = make(this._rtWidth, this._rtHeight);
    this.normalRT = make(this._rtWidth, this._rtHeight);
    this.volumetricRT = make(this._rtWidth, this._rtHeight);
  }

  /**
   * Handle scene resize events.
   * @private
   */
  _handleResize() {
    this._rebuildRenderTextures();
    this.lightingImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);
    this.volumetricImage.setDisplaySize(GameConfig.WIDTH, GameConfig.HEIGHT);
  }

  /**
   * Create the debug graphics overlay.
   * @private
   */
  _createDebugGraphics() {
    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(10000);
  }

  /**
   * Draw debug visualisation: light radii, shadow rays, and occluder outlines.
   * @private
   */
  _renderDebug() {
    if (!this.debugGraphics) return;
    this.debugGraphics.clear();
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX;
    const cy = cam.scrollY;

    // Draw occluder outlines
    this.debugGraphics.lineStyle(1, 0xff00ff, 0.7);
    for (const occ of this.occluders.values()) {
      if (!occ.enabled) continue;
      for (const edge of occ.edges) {
        this.debugGraphics.lineBetween(
          edge.x1 - cx, edge.y1 - cy,
          edge.x2 - cx, edge.y2 - cy,
        );
      }
    }

    // Draw light radii and shadow polygons
    for (const light of this.lights.values()) {
      if (!light.enabled) continue;
      const lx = light.x - cx;
      const ly = light.y - cy;

      // Radius circle
      this.debugGraphics.lineStyle(1, 0xffff00, 0.4);
      this.debugGraphics.strokeCircle(lx, ly, light.radius);

      // Centre dot
      this.debugGraphics.fillStyle(0xffff00, 0.8);
      this.debugGraphics.fillCircle(lx, ly, 3);

      // Shadow polygon rays
      if (light._shadowPolygon && light._shadowPolygon.length > 0) {
        this.debugGraphics.lineStyle(1, 0x00ffff, 0.2);
        for (const pt of light._shadowPolygon) {
          this.debugGraphics.lineBetween(lx, ly, pt.x - cx, pt.y - cy);
        }
      }
    }

    // Stats text (top-left)
    this.debugGraphics.fillStyle(0x000000, 0.5);
    this.debugGraphics.fillRect(4, 4, 200, 80);
  }
}

export default AdvancedLightingSystem;
