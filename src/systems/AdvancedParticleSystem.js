import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * AdvancedParticleSystem - High-performance particle engine for Verdance.
 *
 * Provides a fully-featured particle simulation that exceeds Phaser's built-in
 * particle manager. Designed for the Realm of Nexus universe where spell effects,
 * environmental ambiance, and Sap-phase visuals demand thousands of concurrent
 * particles with complex behaviours.
 *
 * Architecture:
 *   - Object-pooled particles eliminate per-frame allocation.
 *   - Emitters describe *how* particles are born (shape, rate, properties).
 *   - Forces describe *how* particles move after birth (gravity, vortex, etc.).
 *   - Spatial partitioning and adaptive LOD keep frame times stable.
 *
 * Usage:
 *   const ps = new AdvancedParticleSystem(scene);
 *   const id = ps.createEmitter({ preset: 'fireball', x: 100, y: 200 });
 *   // each frame:
 *   ps.update(time, delta);
 *   ps.render();
 */
export class AdvancedParticleSystem {

  // ─── Static helpers ──────────────────────────────────────────────

  /** Generate a unique identifier. */
  static _nextId = 0;
  static uid(prefix = 'ps') {
    return `${prefix}_${++AdvancedParticleSystem._nextId}`;
  }

  /** Linearly interpolate between a and b by t (0..1). */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Evaluate a multi-point curve [{t, value}] at a given normalised time. */
  static evaluateCurve(curve, t) {
    if (!curve || curve.length === 0) return 1;
    if (curve.length === 1) return curve[0].value;
    if (t <= curve[0].t) return curve[0].value;
    if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].value;

    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i];
      const b = curve[i + 1];
      if (t >= a.t && t <= b.t) {
        const segT = (t - a.t) / (b.t - a.t);
        return AdvancedParticleSystem.lerp(a.value, b.value, segT);
      }
    }
    return curve[curve.length - 1].value;
  }

  /** Interpolate a colour curve [{t, color: 0xRRGGBB}]. */
  static evaluateColorCurve(curve, t) {
    if (!curve || curve.length === 0) return 0xffffff;
    if (curve.length === 1) return curve[0].color;
    if (t <= curve[0].t) return curve[0].color;
    if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].color;

    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i];
      const b = curve[i + 1];
      if (t >= a.t && t <= b.t) {
        const segT = (t - a.t) / (b.t - a.t);
        return AdvancedParticleSystem.lerpColor(a.color, b.color, segT);
      }
    }
    return curve[curve.length - 1].color;
  }

  /** Component-wise colour lerp. */
  static lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(AdvancedParticleSystem.lerp(r1, r2, t));
    const g = Math.round(AdvancedParticleSystem.lerp(g1, g2, t));
    const b = Math.round(AdvancedParticleSystem.lerp(b1, b2, t));
    return (r << 16) | (g << 8) | b;
  }

  /** Return a random float in [min, max). */
  static randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // ─── Constructor ─────────────────────────────────────────────────

  /**
   * @param {Phaser.Scene} scene  The owning Phaser scene.
   * @param {object}       opts   Optional overrides (maxParticles, etc.).
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // --- Configuration ---------------------------------------------------
    this.maxParticles = opts.maxParticles ?? 10000;
    this.qualityLevel = opts.qualityLevel ?? 'high'; // 'low', 'medium', 'high', 'ultra'
    this.qualityMultiplier = 1.0;

    // --- Particle pool ---------------------------------------------------
    /** @type {object[]} Pre-allocated particle objects. */
    this.pool = new Array(this.maxParticles);
    /** Index of first free slot in the pool (free-list head). */
    this.freeHead = 0;
    /** Number of currently alive particles. */
    this.activeCount = 0;
    /** Flat list of alive particle indices for iteration. */
    this.aliveIndices = [];

    this._initPool();

    // --- Emitters ---------------------------------------------------------
    /** @type {Map<string, object>} */
    this.emitters = new Map();

    // --- Forces -----------------------------------------------------------
    /** @type {Map<string, object>} */
    this.forces = new Map();

    // --- Spatial grid for LOD / culling -----------------------------------
    this.gridCellSize = opts.gridCellSize ?? 256;
    /** @type {Map<string, number[]>} cell key -> array of pool indices */
    this.spatialGrid = new Map();

    // --- Statistics -------------------------------------------------------
    this.stats = {
      activeParticles: 0,
      peakParticles: 0,
      spawnedThisFrame: 0,
      killedThisFrame: 0,
      emitterCount: 0,
      forceCount: 0,
      frameTimeMs: 0,
      lastUpdateTime: 0
    };

    // --- Flags ------------------------------------------------------------
    this.paused = false;
    this.debugDraw = GameConfig.DEBUG?.SHOW_PARTICLES ?? false;

    this.eventBus.emit('particle:systemCreated', { maxParticles: this.maxParticles });
  }

  // ─── Pool Management ─────────────────────────────────────────────

  /** Pre-allocate every particle object once. */
  _initPool() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool[i] = this._createBlankParticle(i);
    }
    // Build free-list: each dead particle points to the next free slot.
    for (let i = 0; i < this.maxParticles - 1; i++) {
      this.pool[i]._nextFree = i + 1;
    }
    this.pool[this.maxParticles - 1]._nextFree = -1; // end of list
    this.freeHead = 0;
  }

  /** Return a fresh particle template. */
  _createBlankParticle(index) {
    return {
      index,
      alive: false,
      // Spatial
      x: 0, y: 0,
      vx: 0, vy: 0,
      ax: 0, ay: 0,
      // Visual
      scale: 1, baseScale: 1,
      alpha: 1, baseAlpha: 1,
      color: 0xffffff,
      rotation: 0,
      rotationSpeed: 0,
      // Timing
      life: 0,
      maxLife: 1,
      age: 0, // normalised 0..1
      // Meta
      emitterId: null,
      depth: 0,
      spaceMode: 'world', // 'world' | 'local'
      // Trail
      trailEnabled: false,
      trailFrequency: 0.05,
      trailTimer: 0,
      trailEmitterId: null,
      // Sub-emitter
      subEmitterId: null,
      // Collision
      collisionLayer: 0,
      collisionBehavior: 'die', // 'die' | 'bounce' | 'slide' | 'stick'
      bounceFactor: 0.5,
      // Texture
      textureKey: null,
      frameIndex: 0,
      // Free-list pointer (internal)
      _nextFree: -1
    };
  }

  /** Acquire a particle from the pool. Returns null if pool exhausted. */
  _acquireParticle() {
    if (this.freeHead === -1) return null;
    const idx = this.freeHead;
    const p = this.pool[idx];
    this.freeHead = p._nextFree;
    p._nextFree = -1;
    p.alive = true;
    this.activeCount++;
    this.aliveIndices.push(idx);
    return p;
  }

  /** Return a particle to the pool. */
  _releaseParticle(p) {
    p.alive = false;
    p._nextFree = this.freeHead;
    this.freeHead = p.index;
    this.activeCount--;
  }

  // ─── Emitter Management ──────────────────────────────────────────

  /**
   * Create a new emitter and return its ID.
   *
   * @param {object} config  Emitter configuration:
   *   - type        {'continuous'|'burst'|'stream'} Emission mode.
   *   - shape       {'point'|'circle'|'ring'|'rectangle'|'line'|'cone'|'custom'}
   *   - x, y        Emitter world position.
   *   - rotation     Emitter rotation (radians).
   *   - emissionRate  Particles per second (continuous/stream).
   *   - burstCount    Particles per burst.
   *   - burstInterval Seconds between bursts (0 = one-shot).
   *   - maxEmissions  Total bursts allowed (-1 = infinite).
   *   - lifetime      {min, max}  Per-particle lifetime range.
   *   - speed         {min, max}  Initial speed range.
   *   - angle         {min, max}  Emission angle range (radians).
   *   - acceleration  {x, y}      Per-particle constant accel.
   *   - scaleCurve    [{t, value}]  Scale over normalised life.
   *   - alphaCurve    [{t, value}]  Alpha over normalised life.
   *   - colorCurve    [{t, color}]  Colour over normalised life.
   *   - rotationSpeed {min, max}  Rotation speed range (rad/s).
   *   - shapeParams   Extra params for the chosen shape.
   *   - spaceMode     'world' | 'local'
   *   - trail         {enabled, frequency, emitterId}
   *   - subEmitter    Emitter config ID spawned on particle death.
   *   - depth         Render depth / layer.
   *   - collisionLayer, collisionBehavior, bounceFactor
   *   - textureKey, frameIndex
   *   - maxParticles  Per-emitter cap.
   *   - active        Whether the emitter is active on creation.
   *   - duration      Total emitter lifetime in seconds (-1 = infinite).
   *   - forces        Array of force IDs this emitter responds to.
   * @returns {string} Emitter ID.
   */
  createEmitter(config = {}) {
    const id = config.id ?? AdvancedParticleSystem.uid('em');

    const emitter = {
      id,
      active: config.active ?? true,
      type: config.type ?? 'continuous',
      shape: config.shape ?? 'point',
      shapeParams: config.shapeParams ?? {},

      // Transform
      x: config.x ?? 0,
      y: config.y ?? 0,
      rotation: config.rotation ?? 0,
      scale: config.scale ?? 1,

      // Emission
      emissionRate: config.emissionRate ?? 10,
      burstCount: config.burstCount ?? 10,
      burstInterval: config.burstInterval ?? 0,
      maxEmissions: config.maxEmissions ?? -1,
      emissionCounter: 0,
      burstTimer: 0,
      emissionsRemaining: config.maxEmissions ?? -1,

      // Particle properties
      lifetime: config.lifetime ?? { min: 1, max: 2 },
      speed: config.speed ?? { min: 50, max: 100 },
      angle: config.angle ?? { min: 0, max: Math.PI * 2 },
      acceleration: config.acceleration ?? { x: 0, y: 0 },
      scaleCurve: config.scaleCurve ?? [{ t: 0, value: 1 }, { t: 1, value: 0 }],
      alphaCurve: config.alphaCurve ?? [{ t: 0, value: 1 }, { t: 1, value: 0 }],
      colorCurve: config.colorCurve ?? null,
      baseColor: config.baseColor ?? 0xffffff,
      rotationSpeed: config.rotationSpeed ?? { min: 0, max: 0 },
      baseScale: config.baseScale ?? { min: 1, max: 1 },
      baseAlpha: config.baseAlpha ?? 1,

      // Space mode
      spaceMode: config.spaceMode ?? 'world',

      // Trail
      trail: config.trail ?? { enabled: false, frequency: 0.05, emitterId: null },

      // Sub-emitter
      subEmitter: config.subEmitter ?? null,

      // Rendering
      depth: config.depth ?? 0,
      blendMode: config.blendMode ?? 'ADD',
      textureKey: config.textureKey ?? null,
      frameIndex: config.frameIndex ?? 0,

      // Collision
      collisionLayer: config.collisionLayer ?? 0,
      collisionBehavior: config.collisionBehavior ?? 'die',
      bounceFactor: config.bounceFactor ?? 0.5,

      // Limits
      maxParticles: config.maxParticles ?? 500,
      aliveCount: 0,

      // Duration
      duration: config.duration ?? -1,
      elapsed: 0,

      // Forces this emitter responds to (null = all global forces)
      forceIds: config.forceIds ?? null,

      // Custom spawn callback
      onSpawn: config.onSpawn ?? null,

      // Custom shape callback: (emitter) => {x, y}
      customShapeFn: config.customShapeFn ?? null,

      // Sort mode
      sortMode: config.sortMode ?? 'none' // 'none' | 'age' | 'distance' | 'depth'
    };

    this.emitters.set(id, emitter);
    this.stats.emitterCount = this.emitters.size;

    this.eventBus.emit('particle:emitterCreated', { id, type: emitter.type });
    return id;
  }

  /**
   * Remove an emitter by ID. Optionally kill all its alive particles.
   * @param {string}  id           Emitter ID.
   * @param {boolean} killParticles  If true, immediately kill owned particles.
   */
  removeEmitter(id, killParticles = true) {
    if (!this.emitters.has(id)) return;

    if (killParticles) {
      for (let i = this.aliveIndices.length - 1; i >= 0; i--) {
        const p = this.pool[this.aliveIndices[i]];
        if (p.alive && p.emitterId === id) {
          this.killParticle(p);
        }
      }
    }

    this.emitters.delete(id);
    this.stats.emitterCount = this.emitters.size;
    this.eventBus.emit('particle:emitterRemoved', { id });
  }

  /**
   * Update an existing emitter's properties at runtime.
   */
  updateEmitter(id, props) {
    const em = this.emitters.get(id);
    if (!em) return;
    Object.assign(em, props);
  }

  // ─── Force Management ────────────────────────────────────────────

  /**
   * Register a global or named force.
   *
   * @param {object} config
   *   - type   {'gravity'|'wind'|'vortex'|'attractor'|'repeller'|'turbulence'}
   *   - For gravity / wind: {x, y}  acceleration vector.
   *   - For vortex: {x, y, strength, radius}
   *   - For attractor / repeller: {x, y, strength, radius, falloff}
   *   - For turbulence: {strength, frequency, octaves}
   * @returns {string} Force ID.
   */
  addForce(config = {}) {
    const id = config.id ?? AdvancedParticleSystem.uid('force');

    const force = {
      id,
      active: config.active ?? true,
      type: config.type ?? 'gravity',
      // Directional
      x: config.x ?? 0,
      y: config.y ?? 0,
      // Area-based
      strength: config.strength ?? 100,
      radius: config.radius ?? 200,
      falloff: config.falloff ?? 'linear', // 'linear' | 'quadratic' | 'none'
      // Turbulence
      frequency: config.frequency ?? 0.01,
      octaves: config.octaves ?? 2,
      // Internal
      _time: 0
    };

    this.forces.set(id, force);
    this.stats.forceCount = this.forces.size;
    this.eventBus.emit('particle:forceAdded', { id, type: force.type });
    return id;
  }

  /** Remove a force by ID. */
  removeForce(id) {
    this.forces.delete(id);
    this.stats.forceCount = this.forces.size;
    this.eventBus.emit('particle:forceRemoved', { id });
  }

  // ─── Main Update Loop ────────────────────────────────────────────

  /**
   * Advance the simulation by one frame.
   *
   * @param {number} time  Total elapsed time (ms).
   * @param {number} delta Frame delta (ms).
   */
  update(time, delta) {
    if (this.paused) return;

    const t0 = performance.now();
    const dt = (delta / 1000) * this.qualityMultiplier; // seconds
    const dtRaw = delta / 1000;

    this.stats.spawnedThisFrame = 0;
    this.stats.killedThisFrame = 0;

    // --- Update forces internal timers -----------------------------------
    for (const force of this.forces.values()) {
      if (force.active) {
        force._time += dtRaw;
      }
    }

    // --- Emission --------------------------------------------------------
    for (const emitter of this.emitters.values()) {
      if (!emitter.active) continue;

      // Duration check
      if (emitter.duration > 0) {
        emitter.elapsed += dtRaw;
        if (emitter.elapsed >= emitter.duration) {
          emitter.active = false;
          this.eventBus.emit('particle:emitterExpired', { id: emitter.id });
          continue;
        }
      }

      this._processEmission(emitter, dtRaw);
    }

    // --- Update alive particles ------------------------------------------
    this._rebuildAliveList();

    for (let i = this.aliveIndices.length - 1; i >= 0; i--) {
      const p = this.pool[this.aliveIndices[i]];
      if (!p.alive) continue;
      this.updateParticle(p, dtRaw);
    }

    // --- Rebuild spatial grid (used by collision system & LOD) -----------
    this._rebuildSpatialGrid();

    // --- Statistics -------------------------------------------------------
    this.stats.activeParticles = this.activeCount;
    if (this.activeCount > this.stats.peakParticles) {
      this.stats.peakParticles = this.activeCount;
    }
    this.stats.frameTimeMs = performance.now() - t0;
    this.stats.lastUpdateTime = time;

    // --- Adaptive quality ------------------------------------------------
    if (GameConfig.PERFORMANCE?.ADAPTIVE_QUALITY) {
      this._adaptQuality();
    }
  }

  // ─── Emission Processing ─────────────────────────────────────────

  /** Handle spawning logic for a single emitter for one frame. */
  _processEmission(emitter, dt) {
    switch (emitter.type) {
      case 'continuous':
        this._emitContinuous(emitter, dt);
        break;
      case 'burst':
        this._emitBurst(emitter, dt);
        break;
      case 'stream':
        this._emitStream(emitter, dt);
        break;
      default:
        this._emitContinuous(emitter, dt);
    }
  }

  /** Continuous emission: steady rate per second. */
  _emitContinuous(emitter, dt) {
    const rate = emitter.emissionRate * this.qualityMultiplier;
    emitter.emissionCounter += rate * dt;

    while (emitter.emissionCounter >= 1) {
      emitter.emissionCounter -= 1;
      if (emitter.aliveCount >= emitter.maxParticles) break;
      if (this.activeCount >= this.maxParticles) break;
      this.spawnParticle(emitter);
    }
  }

  /** Burst emission: spawns a batch at intervals. */
  _emitBurst(emitter, dt) {
    emitter.burstTimer += dt;

    const interval = emitter.burstInterval > 0 ? emitter.burstInterval : Infinity;
    if (emitter.burstTimer >= interval || emitter.emissionsRemaining === emitter.maxEmissions) {
      // First-frame burst or interval reached
      if (emitter.emissionsRemaining === 0) {
        emitter.active = false;
        return;
      }

      const count = Math.min(
        Math.round(emitter.burstCount * this.qualityMultiplier),
        emitter.maxParticles - emitter.aliveCount,
        this.maxParticles - this.activeCount
      );
      for (let i = 0; i < count; i++) {
        this.spawnParticle(emitter);
      }
      emitter.burstTimer = 0;
      if (emitter.emissionsRemaining > 0) {
        emitter.emissionsRemaining--;
      }
    }
  }

  /** Stream emission: like continuous but follows a path / direction. */
  _emitStream(emitter, dt) {
    // Stream uses the same rate logic as continuous but restricts angle
    this._emitContinuous(emitter, dt);
  }

  // ─── Spawn / Update / Kill ───────────────────────────────────────

  /**
   * Spawn a single particle from the given emitter.
   *
   * @param {object} emitter
   * @returns {object|null} The spawned particle, or null if pool exhausted.
   */
  spawnParticle(emitter) {
    const p = this._acquireParticle();
    if (!p) return null;

    // Position from shape
    const pos = this._sampleEmissionShape(emitter);
    p.x = pos.x;
    p.y = pos.y;

    // Velocity
    const speed = AdvancedParticleSystem.randRange(emitter.speed.min, emitter.speed.max);
    const angle = AdvancedParticleSystem.randRange(emitter.angle.min, emitter.angle.max) + emitter.rotation;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;

    // Acceleration
    p.ax = emitter.acceleration.x;
    p.ay = emitter.acceleration.y;

    // Scale
    const sc = typeof emitter.baseScale === 'object'
      ? AdvancedParticleSystem.randRange(emitter.baseScale.min, emitter.baseScale.max)
      : emitter.baseScale;
    p.baseScale = sc * emitter.scale;
    p.scale = p.baseScale;

    // Alpha
    p.baseAlpha = typeof emitter.baseAlpha === 'object'
      ? AdvancedParticleSystem.randRange(emitter.baseAlpha.min, emitter.baseAlpha.max)
      : emitter.baseAlpha;
    p.alpha = p.baseAlpha;

    // Colour
    p.color = emitter.baseColor;

    // Rotation
    p.rotation = AdvancedParticleSystem.randRange(0, Math.PI * 2);
    p.rotationSpeed = AdvancedParticleSystem.randRange(
      emitter.rotationSpeed.min, emitter.rotationSpeed.max
    );

    // Lifetime
    p.maxLife = AdvancedParticleSystem.randRange(emitter.lifetime.min, emitter.lifetime.max);
    p.life = p.maxLife;
    p.age = 0;

    // Meta
    p.emitterId = emitter.id;
    p.depth = emitter.depth;
    p.spaceMode = emitter.spaceMode;

    // Trail
    if (emitter.trail && emitter.trail.enabled) {
      p.trailEnabled = true;
      p.trailFrequency = emitter.trail.frequency ?? 0.05;
      p.trailTimer = 0;
      p.trailEmitterId = emitter.trail.emitterId ?? null;
    } else {
      p.trailEnabled = false;
    }

    // Sub-emitter
    p.subEmitterId = emitter.subEmitter ?? null;

    // Collision
    p.collisionLayer = emitter.collisionLayer;
    p.collisionBehavior = emitter.collisionBehavior;
    p.bounceFactor = emitter.bounceFactor;

    // Texture
    p.textureKey = emitter.textureKey;
    p.frameIndex = emitter.frameIndex;

    // Curves stored by reference (no copy needed, they are read-only)
    p._scaleCurve = emitter.scaleCurve;
    p._alphaCurve = emitter.alphaCurve;
    p._colorCurve = emitter.colorCurve;

    emitter.aliveCount++;
    this.stats.spawnedThisFrame++;

    // Custom spawn callback
    if (emitter.onSpawn) {
      emitter.onSpawn(p, emitter);
    }

    return p;
  }

  /**
   * Sample the emission shape to produce a spawn position.
   * @returns {{x: number, y: number}}
   */
  _sampleEmissionShape(emitter) {
    const sp = emitter.shapeParams;
    let lx = 0, ly = 0;

    switch (emitter.shape) {
      case 'point':
        lx = 0;
        ly = 0;
        break;

      case 'circle': {
        const r = Math.sqrt(Math.random()) * (sp.radius ?? 50);
        const a = Math.random() * Math.PI * 2;
        lx = Math.cos(a) * r;
        ly = Math.sin(a) * r;
        break;
      }

      case 'ring': {
        const inner = sp.innerRadius ?? 40;
        const outer = sp.outerRadius ?? 50;
        const rr = inner + Math.random() * (outer - inner);
        const aa = Math.random() * Math.PI * 2;
        lx = Math.cos(aa) * rr;
        ly = Math.sin(aa) * rr;
        break;
      }

      case 'rectangle': {
        const hw = (sp.width ?? 100) / 2;
        const hh = (sp.height ?? 100) / 2;
        lx = AdvancedParticleSystem.randRange(-hw, hw);
        ly = AdvancedParticleSystem.randRange(-hh, hh);
        break;
      }

      case 'line': {
        const t = Math.random();
        const x1 = sp.x1 ?? -50, y1 = sp.y1 ?? 0;
        const x2 = sp.x2 ?? 50, y2 = sp.y2 ?? 0;
        lx = AdvancedParticleSystem.lerp(x1, x2, t);
        ly = AdvancedParticleSystem.lerp(y1, y2, t);
        break;
      }

      case 'cone': {
        const dist = Math.random() * (sp.length ?? 100);
        const halfAngle = (sp.angle ?? Math.PI / 4) / 2;
        const ca = AdvancedParticleSystem.randRange(-halfAngle, halfAngle);
        lx = Math.cos(ca) * dist;
        ly = Math.sin(ca) * dist;
        break;
      }

      case 'custom':
        if (emitter.customShapeFn) {
          const result = emitter.customShapeFn(emitter);
          lx = result.x ?? 0;
          ly = result.y ?? 0;
        }
        break;

      default:
        break;
    }

    // Apply emitter transform
    const cos = Math.cos(emitter.rotation);
    const sin = Math.sin(emitter.rotation);
    return {
      x: emitter.x + lx * cos - ly * sin,
      y: emitter.y + lx * sin + ly * cos
    };
  }

  /**
   * Advance a single particle by dt seconds.
   * @param {object} p   Particle.
   * @param {number} dt  Delta time in seconds.
   */
  updateParticle(p, dt) {
    // Age
    p.life -= dt;
    if (p.life <= 0) {
      this.killParticle(p);
      return;
    }
    p.age = 1 - (p.life / p.maxLife);

    // Apply forces
    this._applyForces(p, dt);

    // Integrate velocity -> position
    p.vx += p.ax * dt;
    p.vy += p.ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Rotation
    p.rotation += p.rotationSpeed * dt;

    // Evaluate curves
    if (p._scaleCurve) {
      p.scale = p.baseScale * AdvancedParticleSystem.evaluateCurve(p._scaleCurve, p.age);
    }
    if (p._alphaCurve) {
      p.alpha = p.baseAlpha * AdvancedParticleSystem.evaluateCurve(p._alphaCurve, p.age);
    }
    if (p._colorCurve) {
      p.color = AdvancedParticleSystem.evaluateColorCurve(p._colorCurve, p.age);
    }

    // Trail spawning
    if (p.trailEnabled) {
      p.trailTimer += dt;
      if (p.trailTimer >= p.trailFrequency) {
        p.trailTimer -= p.trailFrequency;
        this._spawnTrailParticle(p);
      }
    }
  }

  /** Apply all relevant forces to a particle. */
  _applyForces(p, dt) {
    const emitter = this.emitters.get(p.emitterId);
    const allowedForces = emitter?.forceIds ?? null;

    for (const force of this.forces.values()) {
      if (!force.active) continue;
      if (allowedForces && !allowedForces.includes(force.id)) continue;

      switch (force.type) {
        case 'gravity':
        case 'wind':
          p.vx += force.x * dt;
          p.vy += force.y * dt;
          break;

        case 'vortex': {
          const dx = force.x - p.x;
          const dy = force.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < force.radius && dist > 0.01) {
            const falloff = this._computeFalloff(dist, force.radius, force.falloff);
            const str = force.strength * falloff * dt;
            // Perpendicular tangent
            p.vx += (-dy / dist) * str;
            p.vy += (dx / dist) * str;
          }
          break;
        }

        case 'attractor': {
          const dx = force.x - p.x;
          const dy = force.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < force.radius && dist > 0.01) {
            const falloff = this._computeFalloff(dist, force.radius, force.falloff);
            const str = force.strength * falloff * dt;
            p.vx += (dx / dist) * str;
            p.vy += (dy / dist) * str;
          }
          break;
        }

        case 'repeller': {
          const dx = p.x - force.x;
          const dy = p.y - force.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < force.radius && dist > 0.01) {
            const falloff = this._computeFalloff(dist, force.radius, force.falloff);
            const str = force.strength * falloff * dt;
            p.vx += (dx / dist) * str;
            p.vy += (dy / dist) * str;
          }
          break;
        }

        case 'turbulence': {
          // Simplified Perlin-style noise using sin combinations
          const freq = force.frequency;
          const t = force._time;
          const noiseX = Math.sin(p.x * freq + t * 1.3) * Math.cos(p.y * freq * 0.7 + t * 0.9);
          const noiseY = Math.cos(p.x * freq * 0.8 + t * 1.1) * Math.sin(p.y * freq + t * 1.4);
          const str = force.strength * dt;
          p.vx += noiseX * str;
          p.vy += noiseY * str;
          break;
        }
      }
    }
  }

  /** Compute distance-based falloff. */
  _computeFalloff(dist, radius, type) {
    const t = dist / radius;
    switch (type) {
      case 'linear':    return 1 - t;
      case 'quadratic': return (1 - t) * (1 - t);
      case 'none':      return 1;
      default:          return 1 - t;
    }
  }

  /** Spawn a tiny trail particle behind a moving particle. */
  _spawnTrailParticle(parent) {
    if (this.activeCount >= this.maxParticles) return;

    const trailEmitter = parent.trailEmitterId
      ? this.emitters.get(parent.trailEmitterId)
      : null;

    const p = this._acquireParticle();
    if (!p) return;

    // Position at parent's current location
    p.x = parent.x;
    p.y = parent.y;
    p.vx = 0;
    p.vy = 0;
    p.ax = 0;
    p.ay = 0;

    // Smaller, shorter-lived copy
    p.baseScale = parent.baseScale * 0.5;
    p.scale = p.baseScale;
    p.baseAlpha = parent.alpha * 0.7;
    p.alpha = p.baseAlpha;
    p.color = parent.color;
    p.rotation = parent.rotation;
    p.rotationSpeed = 0;

    p.maxLife = parent.maxLife * 0.3;
    p.life = p.maxLife;
    p.age = 0;

    p.emitterId = parent.emitterId;
    p.depth = parent.depth - 1;
    p.spaceMode = parent.spaceMode;
    p.trailEnabled = false;
    p.subEmitterId = null;
    p.textureKey = trailEmitter?.textureKey ?? parent.textureKey;
    p.frameIndex = parent.frameIndex;

    // Use parent emitter curves or simple fade-out
    p._scaleCurve = trailEmitter?.scaleCurve ?? [{ t: 0, value: 1 }, { t: 1, value: 0 }];
    p._alphaCurve = trailEmitter?.alphaCurve ?? [{ t: 0, value: 1 }, { t: 1, value: 0 }];
    p._colorCurve = trailEmitter?.colorCurve ?? parent._colorCurve;

    // Trail particles do not increment emitter alive count
    this.stats.spawnedThisFrame++;
  }

  /**
   * Kill a particle and optionally spawn a sub-emitter burst.
   * @param {object} p  The particle to kill.
   */
  killParticle(p) {
    if (!p.alive) return;

    // Sub-emitter on death
    if (p.subEmitterId) {
      const subConfig = this.emitters.get(p.subEmitterId);
      if (subConfig) {
        // One-shot burst at particle death position
        const burstId = this.createEmitter({
          ...subConfig,
          id: undefined, // force new ID
          x: p.x,
          y: p.y,
          type: 'burst',
          burstInterval: 0,
          maxEmissions: 1,
          duration: subConfig.lifetime?.max ?? 2
        });
        // Immediately trigger the burst
        const burstEm = this.emitters.get(burstId);
        if (burstEm) {
          burstEm.emissionsRemaining = 1;
          burstEm.burstTimer = burstEm.burstInterval;
        }
      }
    }

    // Decrement emitter alive count
    const emitter = this.emitters.get(p.emitterId);
    if (emitter) {
      emitter.aliveCount = Math.max(0, emitter.aliveCount - 1);
    }

    this._releaseParticle(p);
    this.stats.killedThisFrame++;
  }

  // ─── Rendering ───────────────────────────────────────────────────

  /**
   * Render all alive particles using the scene's graphics or custom renderer.
   * This default implementation draws simple circles / rects; production code
   * would integrate with Phaser's rendering pipeline or a WebGL batch.
   */
  render() {
    if (!this.scene || !this.scene.sys?.canvas) return;

    // Sort alive particles if any emitter requests sorting
    this._sortParticlesIfNeeded();

    const graphics = this._getOrCreateGraphics();
    graphics.clear();

    const camera = this.scene.cameras?.main;
    const camX = camera?.scrollX ?? 0;
    const camY = camera?.scrollY ?? 0;
    const camW = camera?.width ?? GameConfig.WIDTH;
    const camH = camera?.height ?? GameConfig.HEIGHT;

    for (let i = 0; i < this.aliveIndices.length; i++) {
      const p = this.pool[this.aliveIndices[i]];
      if (!p.alive) continue;

      // Frustum culling
      const sx = p.x - camX;
      const sy = p.y - camY;
      const margin = 64;
      if (sx < -margin || sx > camW + margin || sy < -margin || sy > camH + margin) {
        continue;
      }

      // LOD: skip rendering very small / transparent particles
      if (p.alpha < 0.01 || p.scale < 0.01) continue;

      const r = ((p.color >> 16) & 0xff) / 255;
      const g = ((p.color >> 8) & 0xff) / 255;
      const b = (p.color & 0xff) / 255;
      const colorInt = p.color;

      graphics.fillStyle(colorInt, p.alpha);
      const size = Math.max(1, p.scale * 4);
      graphics.fillCircle(p.x, p.y, size);
    }

    // Debug overlay
    if (this.debugDraw) {
      this._renderDebug(graphics, camX, camY);
    }
  }

  /** Lazily create or retrieve the shared Graphics object. */
  _getOrCreateGraphics() {
    if (!this._graphics || !this._graphics.scene) {
      this._graphics = this.scene.add.graphics();
      this._graphics.setDepth(999);
    }
    return this._graphics;
  }

  /** Draw emitter origins, force visualisations, and stat text. */
  _renderDebug(graphics, camX, camY) {
    // Emitter origins
    for (const em of this.emitters.values()) {
      graphics.lineStyle(1, 0x00ff00, 0.6);
      graphics.strokeCircle(em.x, em.y, 8);
    }

    // Force areas
    for (const f of this.forces.values()) {
      if (f.type === 'vortex' || f.type === 'attractor' || f.type === 'repeller') {
        const col = f.type === 'attractor' ? 0x00ffff : f.type === 'repeller' ? 0xff4444 : 0xffff00;
        graphics.lineStyle(1, col, 0.4);
        graphics.strokeCircle(f.x, f.y, f.radius);
      }
    }
  }

  /** Sort alive particles based on emitter sort modes. */
  _sortParticlesIfNeeded() {
    let needsSort = false;
    for (const em of this.emitters.values()) {
      if (em.sortMode !== 'none') {
        needsSort = true;
        break;
      }
    }
    if (!needsSort) return;

    this.aliveIndices.sort((a, b) => {
      const pa = this.pool[a];
      const pb = this.pool[b];
      // Primary sort by depth
      if (pa.depth !== pb.depth) return pa.depth - pb.depth;
      // Secondary sort by age
      return pa.age - pb.age;
    });
  }

  // ─── Spatial Grid ────────────────────────────────────────────────

  /** Rebuild the spatial hash grid from alive particles. */
  _rebuildSpatialGrid() {
    this.spatialGrid.clear();

    for (let i = 0; i < this.aliveIndices.length; i++) {
      const p = this.pool[this.aliveIndices[i]];
      if (!p.alive) continue;

      const key = this._spatialKey(p.x, p.y);
      let cell = this.spatialGrid.get(key);
      if (!cell) {
        cell = [];
        this.spatialGrid.set(key, cell);
      }
      cell.push(p.index);
    }
  }

  /** Compact alive-indices list, removing gaps left by killed particles. */
  _rebuildAliveList() {
    let write = 0;
    for (let read = 0; read < this.aliveIndices.length; read++) {
      if (this.pool[this.aliveIndices[read]].alive) {
        this.aliveIndices[write++] = this.aliveIndices[read];
      }
    }
    this.aliveIndices.length = write;
  }

  /** Hash a world position to a grid-cell key string. */
  _spatialKey(x, y) {
    const cx = Math.floor(x / this.gridCellSize);
    const cy = Math.floor(y / this.gridCellSize);
    return `${cx},${cy}`;
  }

  /**
   * Query the spatial grid for particles near a world position.
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {object[]} Nearby particles.
   */
  queryNearby(x, y, radius) {
    const results = [];
    const r2 = radius * radius;
    const minCX = Math.floor((x - radius) / this.gridCellSize);
    const maxCX = Math.floor((x + radius) / this.gridCellSize);
    const minCY = Math.floor((y - radius) / this.gridCellSize);
    const maxCY = Math.floor((y + radius) / this.gridCellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.spatialGrid.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const idx of cell) {
          const p = this.pool[idx];
          if (!p.alive) continue;
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(p);
          }
        }
      }
    }
    return results;
  }

  // ─── Quality / LOD ───────────────────────────────────────────────

  /**
   * Set the global quality level.
   * @param {'low'|'medium'|'high'|'ultra'} level
   */
  setQuality(level) {
    this.qualityLevel = level;
    switch (level) {
      case 'low':    this.qualityMultiplier = 0.25; break;
      case 'medium': this.qualityMultiplier = 0.5;  break;
      case 'high':   this.qualityMultiplier = 1.0;  break;
      case 'ultra':  this.qualityMultiplier = 1.5;  break;
      default:       this.qualityMultiplier = 1.0;
    }
    this.eventBus.emit('particle:qualityChanged', { level, multiplier: this.qualityMultiplier });
  }

  /** Automatically adjust quality when frame budget is exceeded. */
  _adaptQuality() {
    const budget = 1000 / (GameConfig.PERFORMANCE?.TARGET_FPS ?? 60); // ms per frame
    const usage = this.stats.frameTimeMs / budget;

    if (usage > 0.8 && this.qualityLevel !== 'low') {
      // Downgrade
      const levels = ['low', 'medium', 'high', 'ultra'];
      const idx = levels.indexOf(this.qualityLevel);
      if (idx > 0) {
        this.setQuality(levels[idx - 1]);
      }
    } else if (usage < 0.3 && this.qualityLevel !== 'ultra') {
      // Upgrade
      const levels = ['low', 'medium', 'high', 'ultra'];
      const idx = levels.indexOf(this.qualityLevel);
      if (idx < levels.length - 1) {
        this.setQuality(levels[idx + 1]);
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Return a snapshot of system statistics.
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Retrieve all alive particles for a given emitter ID.
   * @param {string} emitterId
   * @returns {object[]}
   */
  getParticlesForEmitter(emitterId) {
    const result = [];
    for (const idx of this.aliveIndices) {
      const p = this.pool[idx];
      if (p.alive && p.emitterId === emitterId) {
        result.push(p);
      }
    }
    return result;
  }

  /** Pause the entire particle system. */
  pause() {
    this.paused = true;
    this.eventBus.emit('particle:paused');
  }

  /** Resume the particle system. */
  resume() {
    this.paused = false;
    this.eventBus.emit('particle:resumed');
  }

  /**
   * Kill all alive particles and reset emitter counters.
   */
  clear() {
    for (let i = this.aliveIndices.length - 1; i >= 0; i--) {
      const p = this.pool[this.aliveIndices[i]];
      if (p.alive) {
        this._releaseParticle(p);
      }
    }
    this.aliveIndices.length = 0;
    this.activeCount = 0;

    for (const em of this.emitters.values()) {
      em.aliveCount = 0;
      em.emissionCounter = 0;
      em.burstTimer = 0;
    }

    this.spatialGrid.clear();
    this.stats.activeParticles = 0;
    this.eventBus.emit('particle:cleared');
  }

  /**
   * Tear down the entire system and release all resources.
   */
  destroy() {
    this.clear();
    this.emitters.clear();
    this.forces.clear();
    this.spatialGrid.clear();

    if (this._graphics) {
      this._graphics.destroy();
      this._graphics = null;
    }

    this.pool = null;
    this.aliveIndices = null;
    this.scene = null;

    this.eventBus.emit('particle:systemDestroyed');
  }
}

export default AdvancedParticleSystem;
