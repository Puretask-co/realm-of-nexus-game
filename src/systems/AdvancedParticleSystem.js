/**
 * AdvancedParticleSystem
 *
 * A full-featured 2D particle engine for Phaser 3 that goes far beyond
 * Phaser's built-in emitter.  Designed for spell VFX, environmental
 * effects, combat impacts, and UI flourishes in Realm of Nexus.
 *
 * Capabilities:
 *   - Multiple emission modes: continuous, burst, stream
 *   - Emission shapes: point, circle, ring, rectangle, line
 *   - Particle property curves: color, scale, alpha over lifetime
 *   - Multi-point alpha curves (e.g. firefly pulsing)
 *   - Particle trails (motion ribbons)
 *   - Sub-emitters that fire on particle death (fire → smoke)
 *   - Global forces: gravity, wind, vortex, attractor, repeller, turbulence
 *   - Object pooling for particles and emitters
 *   - Preset system for named effect templates
 *   - Per-blend-mode render layers
 *   - Performance stats tracking
 */

export default class AdvancedParticleSystem {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    /** @type {Object[]} Active emitters */
    this.emitters = [];
    /** @type {Object[]} Active particles */
    this.particles = [];

    this.config = {
      enabled: true,
      maxParticles: 10000,
      maxEmitters: 100,
      updateFrequency: 60
    };

    this.stats = {
      activeParticles: 0,
      activeEmitters: 0,
      particlesSpawned: 0,
      particlesKilled: 0,
      frameTime: 0
    };

    // Object pools
    this._particlePool = [];
    this._emitterPool = [];

    // Global forces applied to all particles every frame
    this.globalForces = [];

    // Named effect presets
    this.presets = new Map();

    // Graphics object for rendering particles
    this._graphics = scene.add.graphics();
    this._graphics.setDepth(5000);

    // Unique-ID counter
    this._idCounter = 0;

    this._setupUpdateLoop();
  }

  // ------------------------------------------------------------------
  // Initialisation
  // ------------------------------------------------------------------

  _setupUpdateLoop() {
    const interval = 1000 / this.config.updateFrequency;
    this.scene.time.addEvent({
      delay: interval,
      callback: () => this.update(interval),
      loop: true
    });
  }

  // ------------------------------------------------------------------
  // Emitter Management
  // ------------------------------------------------------------------

  /**
   * Create and start a new particle emitter.
   *
   * @param {Object} config
   * @param {number}  config.x
   * @param {number}  config.y
   * @param {'continuous'|'burst'|'stream'} [config.emissionMode='continuous']
   * @param {number}  [config.emissionRate=10]    Particles per second (continuous/stream)
   * @param {number}  [config.burstCount=20]      Particles per burst
   * @param {'point'|'circle'|'ring'|'rectangle'|'line'} [config.emissionShape='point']
   * @param {Object}  [config.emissionArea]       Shape-specific area params
   * @param {Object}  config.particleConfig       Per-particle properties
   * @param {number}  [config.duration=-1]        ms, -1 = infinite
   * @param {Array}   [config.subEmitters]        Sub-emitter definitions
   * @param {boolean} [config.autoStart=true]
   * @returns {Object|null}
   */
  createEmitter(config) {
    if (this.emitters.length >= this.config.maxEmitters) {
      console.warn('[ParticleSystem] Max emitters reached');
      return null;
    }

    const emitter = this._emitterPool.length > 0
      ? this._emitterPool.pop()
      : {};

    Object.assign(emitter, {
      id: this._nextId(),
      x: config.x || 0,
      y: config.y || 0,
      emissionMode: config.emissionMode || 'continuous',
      emissionRate: config.emissionRate || 10,
      burstCount: config.burstCount || 20,
      streamDuration: config.streamDuration || 1000,
      emissionShape: config.emissionShape || 'point',
      emissionArea: config.emissionArea || {},
      particleConfig: { ...config.particleConfig } || {},
      duration: config.duration !== undefined ? config.duration : -1,
      delay: config.delay || 0,
      subEmitters: config.subEmitters || [],
      onStart: config.onStart || null,
      onStop: config.onStop || null,
      onComplete: config.onComplete || null,
      onParticleSpawn: config.onParticleSpawn || null,
      onParticleDeath: config.onParticleDeath || null,
      enabled: true,
      active: false,
      timeAlive: 0,
      timeSinceLastEmit: 0,
      particlesEmitted: 0,
      _particles: [],
      _markedForRemoval: false
    });

    this._validateParticleConfig(emitter.particleConfig);
    this.emitters.push(emitter);

    if (config.autoStart !== false) {
      this._startEmitter(emitter);
    }

    return emitter;
  }

  _startEmitter(emitter) {
    if (emitter.delay > 0) {
      this.scene.time.delayedCall(emitter.delay, () => {
        emitter.active = true;
        emitter.onStart?.(emitter);
      });
    } else {
      emitter.active = true;
      emitter.onStart?.(emitter);
    }
  }

  /**
   * Stop an emitter.  If killParticles is true, all its particles die
   * immediately; otherwise they finish their natural lifetime.
   */
  stopEmitter(emitter, killParticles = false) {
    emitter.active = false;
    if (killParticles) {
      emitter._particles.forEach((p) => this._killParticle(p));
      emitter._particles.length = 0;
    }
    emitter.onStop?.(emitter);
  }

  /** Remove an emitter and all its particles. */
  removeEmitter(emitter) {
    this.stopEmitter(emitter, true);
    const idx = this.emitters.indexOf(emitter);
    if (idx !== -1) this.emitters.splice(idx, 1);
    if (this._emitterPool.length < 50) this._emitterPool.push(emitter);
  }

  // ------------------------------------------------------------------
  // Particle Spawning
  // ------------------------------------------------------------------

  _spawnParticle(emitter) {
    if (this.particles.length >= this.config.maxParticles) return null;

    const p = this._particlePool.length > 0
      ? this._particlePool.pop()
      : {};

    const cfg = emitter.particleConfig;

    // Position from emission shape
    const pos = this._getEmissionPosition(emitter);
    const angle = this._randomRange(cfg.angle || { min: 0, max: Math.PI * 2 });
    const speed = this._randomRange(cfg.speed || { min: 50, max: 150 });

    Object.assign(p, {
      id: this._nextId(),
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: cfg.rotateToDirection ? angle : this._randomRange(cfg.rotation || 0),
      angularVelocity: this._randomRange(cfg.angularVelocity || 0),
      scaleX: 1,
      scaleY: 1,
      color: typeof cfg.color === 'number' ? cfg.color : (cfg.color?.start ?? 0xffffff),
      alpha: typeof cfg.alpha === 'number' ? cfg.alpha : (cfg.alpha?.start ?? 1),
      blendMode: cfg.blendMode || 'ADD',
      life: 0,
      maxLife: this._randomRange(cfg.lifetime || { min: 1000, max: 2000 }),
      mass: cfg.mass || 1,
      drag: cfg.drag !== undefined ? cfg.drag : 0.98,
      bounce: cfg.bounce || 0,
      scaleCurve: cfg.scale && typeof cfg.scale === 'object' && cfg.scale.start !== undefined ? cfg.scale : null,
      alphaCurve: cfg.alpha && typeof cfg.alpha === 'object' ? cfg.alpha : null,
      colorCurve: cfg.color && typeof cfg.color === 'object' && cfg.color.start !== undefined ? cfg.color : null,
      hasTrail: !!cfg.trail,
      trailPoints: [],
      trailLength: cfg.trailLength || 10,
      alive: true,
      emitter,
      data: {}
    });

    // Apply initial scale
    if (typeof cfg.scale === 'number') {
      p.scaleX = cfg.scale;
      p.scaleY = cfg.scale;
    } else if (cfg.scale?.start !== undefined) {
      p.scaleX = cfg.scale.start;
      p.scaleY = cfg.scale.start;
    }

    this.particles.push(p);
    emitter._particles.push(p);
    this.stats.particlesSpawned++;
    emitter.onParticleSpawn?.(p, emitter);
    return p;
  }

  _getEmissionPosition(emitter) {
    const area = emitter.emissionArea;
    switch (emitter.emissionShape) {
      case 'circle': {
        const r = (area.radius || 50) * Math.random();
        const a = Math.random() * Math.PI * 2;
        return { x: emitter.x + Math.cos(a) * r, y: emitter.y + Math.sin(a) * r };
      }
      case 'ring': {
        const inner = area.innerRadius || 30;
        const outer = area.outerRadius || 50;
        const r = inner + Math.random() * (outer - inner);
        const a = Math.random() * Math.PI * 2;
        return { x: emitter.x + Math.cos(a) * r, y: emitter.y + Math.sin(a) * r };
      }
      case 'rectangle': {
        const w = area.width || 100;
        const h = area.height || 100;
        return {
          x: emitter.x + (Math.random() - 0.5) * w,
          y: emitter.y + (Math.random() - 0.5) * h
        };
      }
      case 'line': {
        const len = area.length || 100;
        const ang = area.angle || 0;
        const t = Math.random();
        return {
          x: emitter.x + Math.cos(ang) * len * t,
          y: emitter.y + Math.sin(ang) * len * t
        };
      }
      default: // 'point'
        return { x: emitter.x, y: emitter.y };
    }
  }

  _killParticle(p) {
    p.alive = false;
    p.emitter?.onParticleDeath?.(p, p.emitter);

    // Sub-emitters
    p.emitter?.subEmitters?.forEach((sub) => {
      if (sub.trigger === 'death') {
        this._spawnSubEmitter(sub, p);
      }
    });

    this.stats.particlesKilled++;
  }

  _spawnSubEmitter(subDef, particle) {
    const cfg = {
      ...subDef.config,
      x: particle.x,
      y: particle.y,
      emissionMode: 'burst',
      duration: 0,
      autoStart: true
    };

    if (subDef.inherit?.includes('velocity') && cfg.particleConfig) {
      const spd = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
      cfg.particleConfig.speed = { min: spd * 0.3, max: spd * 0.6 };
    }
    if (subDef.inherit?.includes('color') && cfg.particleConfig) {
      cfg.particleConfig.color = particle.color;
    }

    this.createEmitter(cfg);
  }

  // ------------------------------------------------------------------
  // Update Loop
  // ------------------------------------------------------------------

  update(delta) {
    if (!this.config.enabled) return;
    const start = performance.now();

    this._updateEmitters(delta);
    this._updateParticles(delta);
    this._applyGlobalForces(delta);
    this._cleanupDead();
    this._render();

    this.stats.frameTime = performance.now() - start;
    this.stats.activeParticles = this.particles.length;
    this.stats.activeEmitters = this.emitters.filter((e) => e.active).length;
  }

  _updateEmitters(delta) {
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const em = this.emitters[i];
      if (!em.enabled) continue;

      em.timeAlive += delta;

      // Check duration
      if (em.duration > 0 && em.timeAlive >= em.duration) {
        em.onComplete?.(em);
        em._markedForRemoval = true;
        continue;
      }

      if (!em.active) continue;

      switch (em.emissionMode) {
        case 'continuous':
          this._emitContinuous(em, delta);
          break;
        case 'burst':
          if (em.particlesEmitted === 0) {
            for (let j = 0; j < em.burstCount; j++) this._spawnParticle(em);
            em.particlesEmitted = em.burstCount;
            em.active = false;
          }
          break;
        case 'stream':
          if (em.timeAlive < em.streamDuration) {
            this._emitContinuous(em, delta);
          } else {
            em.active = false;
          }
          break;
      }
    }

    // Remove marked
    this.emitters = this.emitters.filter((e) => !e._markedForRemoval);
  }

  _emitContinuous(em, delta) {
    em.timeSinceLastEmit += delta;
    const interval = 1000 / em.emissionRate;
    while (em.timeSinceLastEmit >= interval) {
      this._spawnParticle(em);
      em.timeSinceLastEmit -= interval;
      em.particlesEmitted++;
    }
  }

  _updateParticles(delta) {
    const dt = delta / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.alive) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        this._killParticle(p);
        continue;
      }

      const t = p.life / p.maxLife; // normalised lifetime 0→1

      // Physics
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.angularVelocity * dt;

      // Curves
      if (p.scaleCurve) {
        const s = this._evaluateCurve(p.scaleCurve, t);
        p.scaleX = s;
        p.scaleY = s;
      }
      if (p.alphaCurve) {
        p.alpha = this._evaluateCurve(p.alphaCurve, t);
      }
      if (p.colorCurve) {
        p.color = this._evaluateColorCurve(p.colorCurve, t);
      }

      // Trail
      if (p.hasTrail) {
        p.trailPoints.push({ x: p.x, y: p.y, alpha: p.alpha });
        if (p.trailPoints.length > p.trailLength) p.trailPoints.shift();
      }
    }
  }

  _applyGlobalForces(delta) {
    const dt = delta / 1000;
    this.globalForces.forEach((force) => {
      if (!force.enabled) return;
      this.particles.forEach((p) => {
        if (!p.alive) return;
        this._applyForce(force, p, dt);
      });
    });
  }

  _applyForce(force, p, dt) {
    const f = 60; // normalisation factor (forces tuned for 60 fps)
    switch (force.type) {
      case 'gravity':
        p.vx += (force.x || 0) * dt * f;
        p.vy += (force.y || 0) * dt * f;
        break;

      case 'wind':
        if (force.area && !this._pointInArea(p.x, p.y, force.area)) break;
        p.vx += (force.strength?.x || 0) * dt * f;
        p.vy += (force.strength?.y || 0) * dt * f;
        break;

      case 'vortex': {
        const dx = force.x - p.x;
        const dy = force.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= force.radius || dist === 0) break;
        const falloff = 1 - dist / force.radius;
        const tangent = Math.atan2(dy, dx) + Math.PI / 2;
        p.vx += Math.cos(tangent) * force.strength * falloff * dt * f;
        p.vy += Math.sin(tangent) * force.strength * falloff * dt * f;
        p.vx += (dx / dist) * (force.pull || 0) * falloff * dt * f;
        p.vy += (dy / dist) * (force.pull || 0) * falloff * dt * f;
        break;
      }

      case 'attractor': {
        const adx = force.x - p.x;
        const ady = force.y - p.y;
        const adist = Math.sqrt(adx * adx + ady * ady);
        if (adist >= force.radius || adist === 0) break;
        const af = (1 - adist / force.radius) * force.strength;
        p.vx += (adx / adist) * af * dt * f;
        p.vy += (ady / adist) * af * dt * f;
        break;
      }

      case 'repeller': {
        const rdx = force.x - p.x;
        const rdy = force.y - p.y;
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rdist >= force.radius || rdist === 0) break;
        const rf = (1 - rdist / force.radius) * force.strength;
        p.vx -= (rdx / rdist) * rf * dt * f;
        p.vy -= (rdy / rdist) * rf * dt * f;
        break;
      }

      case 'turbulence': {
        if (!force._time) force._time = 0;
        const nx = this._noise(p.x * 0.01, p.y * 0.01, force._time);
        const ny = this._noise(p.x * 0.01 + 100, p.y * 0.01 + 100, force._time);
        p.vx += (nx - 0.5) * force.strength * dt * f;
        p.vy += (ny - 0.5) * force.strength * dt * f;
        force._time += dt;
        break;
      }
    }
  }

  _cleanupDead() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.alive) continue;

      // Remove from emitter list
      if (p.emitter) {
        const ei = p.emitter._particles.indexOf(p);
        if (ei !== -1) p.emitter._particles.splice(ei, 1);
      }
      this.particles.splice(i, 1);

      // Pool it
      p.trailPoints = [];
      p.data = {};
      if (this._particlePool.length < 1000) this._particlePool.push(p);
    }
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  _render() {
    const g = this._graphics;
    g.clear();

    this.particles.forEach((p) => {
      if (!p.alive) return;

      // Trail
      if (p.hasTrail && p.trailPoints.length > 1) {
        const trailColor = p.color;
        for (let i = 1; i < p.trailPoints.length; i++) {
          const a = p.trailPoints[i - 1];
          const b = p.trailPoints[i];
          const trailAlpha = (i / p.trailPoints.length) * p.alpha * 0.5;
          g.lineStyle(2, trailColor, trailAlpha);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }

      // Particle body
      const c = Phaser.Display.Color.IntegerToColor(p.color);
      const drawColor = Phaser.Display.Color.GetColor(
        Math.floor(c.red * Math.min(p.alpha, 1)),
        Math.floor(c.green * Math.min(p.alpha, 1)),
        Math.floor(c.blue * Math.min(p.alpha, 1))
      );

      g.fillStyle(drawColor, Math.min(p.alpha, 1));
      g.fillCircle(p.x, p.y, 4 * p.scaleX);
    });
  }

  // ------------------------------------------------------------------
  // Forces API
  // ------------------------------------------------------------------

  /**
   * Add a persistent force that affects all particles.
   * @param {Object} config
   * @param {'gravity'|'wind'|'vortex'|'attractor'|'repeller'|'turbulence'} config.type
   * @returns {Object}
   */
  addGlobalForce(config) {
    const force = { id: this._nextId(), enabled: true, ...config };
    this.globalForces.push(force);
    return force;
  }

  removeGlobalForce(force) {
    const idx = this.globalForces.indexOf(force);
    if (idx !== -1) this.globalForces.splice(idx, 1);
  }

  // ------------------------------------------------------------------
  // Presets
  // ------------------------------------------------------------------

  /** Register a named preset for later use with createEffect(). */
  registerPreset(name, config) {
    this.presets.set(name, config);
  }

  /**
   * Spawn a preset effect at a position.
   * @param {string} name  Preset name
   * @param {number} x
   * @param {number} y
   * @param {Object} [overrides]  Properties to merge on top of preset
   */
  createEffect(name, x, y, overrides = {}) {
    const preset = this.presets.get(name);
    if (!preset) {
      console.warn(`[ParticleSystem] Unknown preset: ${name}`);
      return null;
    }

    const merged = { ...preset, x, y, ...overrides };

    // Deep-copy particleConfig so presets stay immutable
    if (preset.particleConfig) {
      merged.particleConfig = { ...preset.particleConfig };
    }

    return this.createEmitter(merged);
  }

  // ------------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------------

  _randomRange(range) {
    if (typeof range === 'number') return range;
    if (range?.min !== undefined && range?.max !== undefined) {
      return range.min + Math.random() * (range.max - range.min);
    }
    return 0;
  }

  _evaluateCurve(curve, t) {
    if (typeof curve === 'number') return curve;
    if (curve.start !== undefined && curve.end !== undefined) {
      return Phaser.Math.Linear(curve.start, curve.end, t);
    }
    if (curve.points) return this._evaluateMultiPoint(curve.points, t);
    return 1;
  }

  _evaluateMultiPoint(points, t) {
    if (!points.length) return 0;
    if (points.length === 1) return points[0].value;
    for (let i = 0; i < points.length - 1; i++) {
      if (t >= points[i].time && t <= points[i + 1].time) {
        const local = (t - points[i].time) / (points[i + 1].time - points[i].time);
        return Phaser.Math.Linear(points[i].value, points[i + 1].value, local);
      }
    }
    return points[points.length - 1].value;
  }

  _evaluateColorCurve(curve, t) {
    if (typeof curve === 'number') return curve;
    const a = Phaser.Display.Color.IntegerToColor(curve.start);
    const b = Phaser.Display.Color.IntegerToColor(curve.end);
    const interp = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);
    return Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
  }

  _pointInArea(x, y, area) {
    if (!area) return false;
    if (area.shape === 'circle') {
      const dx = x - area.x;
      const dy = y - area.y;
      return (dx * dx + dy * dy) <= (area.radius * area.radius);
    }
    // Default: rectangle
    return x >= area.x && x <= area.x + (area.width || 0)
        && y >= area.y && y <= area.y + (area.height || 0);
  }

  /** Simple pseudo-noise for turbulence. */
  _noise(x, y, z) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + (z || 0) * 37.719) * 43758.5453;
    return (n - Math.floor(n) + 1) / 2;
  }

  _nextId() {
    return `p_${++this._idCounter}`;
  }

  _validateParticleConfig(cfg) {
    if (!cfg.lifetime) cfg.lifetime = { min: 1000, max: 2000 };
    if (!cfg.speed) cfg.speed = { min: 50, max: 150 };
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  setEnabled(enabled) {
    this.config.enabled = enabled;
    if (!enabled) this._graphics.clear();
  }

  getStats() {
    return { ...this.stats };
  }

  shutdown() {
    this.emitters.forEach((em) => this.stopEmitter(em, true));
    this.particles.length = 0;
    this._graphics.destroy();
  }
}
