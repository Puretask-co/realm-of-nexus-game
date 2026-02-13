import EventBus from './EventBus.js';

/**
 * Custom particle engine with multi-stage effects, sub-emitters,
 * trails, global forces, and object pooling.
 *
 * Why build our own instead of using Phaser's built-in particles?
 * - Sub-emitters: fire particles spawn smoke on death
 * - Trails: projectile ribbon effects
 * - Global forces: vortex, wind, turbulence
 * - Tighter integration with spell VFX and Sap Cycle
 * - Preset library tuned for Verdance's visual style
 */
export default class AdvancedParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.emitters = [];
        this.particles = [];
        this.globalForces = [];
        this.presets = new Map();

        this.config = {
            enabled: true,
            maxParticles: 5000,
            maxEmitters: 100
        };

        this.stats = { active: 0, spawned: 0, killed: 0, frameTime: 0 };
        this.particlePool = [];

        this._loadPresets();
    }

    // ----------------------------------------------------------------
    // Emitter management
    // ----------------------------------------------------------------

    createEmitter(cfg) {
        if (this.emitters.length >= this.config.maxEmitters) return null;

        const emitter = {
            id: this._id(),
            x: cfg.x || 0,
            y: cfg.y || 0,
            emissionMode: cfg.emissionMode || 'continuous',
            emissionRate: cfg.emissionRate || 10,
            burstCount: cfg.burstCount || 20,
            duration: cfg.duration ?? -1,
            particleConfig: { ...cfg.particleConfig },
            emissionShape: cfg.emissionShape || 'point',
            emissionArea: cfg.emissionArea || {},
            subEmitters: cfg.subEmitters || [],
            onParticleDeath: cfg.onParticleDeath || null,
            enabled: true,
            active: true,
            timeAlive: 0,
            timeSinceEmit: 0,
            emitted: 0,
            _particles: [],
            _remove: false
        };

        this._setParticleDefaults(emitter.particleConfig);
        if (emitter.emissionMode === 'burst') this._burst(emitter);

        this.emitters.push(emitter);
        return emitter;
    }

    stopEmitter(emitter, killParticles = false) {
        emitter.active = false;
        if (killParticles) {
            emitter._particles.forEach((p) => { p.alive = false; });
            emitter._particles = [];
        }
    }

    removeEmitter(emitter) {
        this.stopEmitter(emitter, true);
        emitter._remove = true;
    }

    // ----------------------------------------------------------------
    // Presets
    // ----------------------------------------------------------------

    registerPreset(name, cfg) { this.presets.set(name, cfg); }

    createEffect(presetName, x, y, overrides = {}) {
        const preset = this.presets.get(presetName);
        if (!preset) { console.warn(`[Particles] Unknown preset: ${presetName}`); return null; }
        return this.createEmitter({ ...preset, x, y, ...overrides });
    }

    // ----------------------------------------------------------------
    // Forces
    // ----------------------------------------------------------------

    addGlobalForce(cfg) {
        const force = { id: this._id(), type: cfg.type, enabled: true, _time: 0, ...cfg };
        this.globalForces.push(force);
        return force;
    }

    removeGlobalForce(force) {
        const i = this.globalForces.indexOf(force);
        if (i !== -1) this.globalForces.splice(i, 1);
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(delta) {
        if (!this.config.enabled) return;
        const t0 = performance.now();
        const dt = delta / 1000;

        // Update emitters
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const em = this.emitters[i];
            if (em._remove) { this.emitters.splice(i, 1); continue; }
            if (!em.active) continue;
            em.timeAlive += delta;
            if (em.duration > 0 && em.timeAlive >= em.duration) { em.active = false; continue; }
            if (em.emissionMode === 'continuous') this._emitContinuous(em, delta);
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (!p.alive) { this._recycle(p, i); continue; }

            p.life += delta;
            if (p.life >= p.maxLife) { this._kill(p); this._recycle(p, i); continue; }

            const t = p.life / p.maxLife;
            p.vx *= p.drag; p.vy *= p.drag;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.rotation += p.angularVelocity * dt;

            // Evaluate curves
            if (p.scaleCurve) { const s = this._lerp(p.scaleCurve.start, p.scaleCurve.end, t); p.scaleX = s; p.scaleY = s; }
            if (p.alphaCurve) p.alpha = this._lerp(p.alphaCurve.start, p.alphaCurve.end, t);
            if (p.colorCurve) p.color = this._lerpColor(p.colorCurve.start, p.colorCurve.end, t);

            // Trail
            if (p.hasTrail) {
                p.trailPoints.push({ x: p.x, y: p.y });
                if (p.trailPoints.length > p.trailLength) p.trailPoints.shift();
            }
        }

        // Global forces
        this.globalForces.forEach((f) => {
            if (!f.enabled) return;
            f._time += dt;
            this.particles.forEach((p) => { if (p.alive) this._applyForce(f, p, dt); });
        });

        this.stats.active = this.particles.filter((p) => p.alive).length;
        this.stats.frameTime = performance.now() - t0;
    }

    // ----------------------------------------------------------------
    // Rendering (call from scene's update or a post-update hook)
    // ----------------------------------------------------------------

    render() {
        // Clear previous frame graphics
        if (!this._gfx) this._gfx = this.scene.add.graphics().setDepth(5000);
        this._gfx.clear();

        this.particles.forEach((p) => {
            if (!p.alive) return;

            // Trail
            if (p.hasTrail && p.trailPoints.length > 1) {
                this._gfx.lineStyle(2, p.color, p.alpha * 0.4);
                this._gfx.beginPath();
                this._gfx.moveTo(p.trailPoints[0].x, p.trailPoints[0].y);
                for (let i = 1; i < p.trailPoints.length; i++) {
                    this._gfx.lineTo(p.trailPoints[i].x, p.trailPoints[i].y);
                }
                this._gfx.strokePath();
            }

            // Particle dot
            this._gfx.fillStyle(p.color, p.alpha);
            this._gfx.fillCircle(p.x, p.y, 4 * p.scaleX);
        });
    }

    // ----------------------------------------------------------------
    // Internal helpers
    // ----------------------------------------------------------------

    _emitContinuous(em, delta) {
        em.timeSinceEmit += delta;
        const interval = 1000 / em.emissionRate;
        while (em.timeSinceEmit >= interval) {
            this._spawn(em);
            em.timeSinceEmit -= interval;
        }
    }

    _burst(em) {
        for (let i = 0; i < em.burstCount; i++) this._spawn(em);
        em.active = false;
    }

    _spawn(em) {
        if (this.particles.length >= this.config.maxParticles) return;

        const cfg = em.particleConfig;
        const pos = this._emissionPos(em);
        const angle = this._rand(cfg.angle);
        const speed = this._rand(cfg.speed);

        const p = this.particlePool.length > 0 ? this.particlePool.pop() : {};
        Object.assign(p, {
            x: pos.x, y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotation: cfg.rotateToDirection ? angle : (this._rand(cfg.rotation) || 0),
            angularVelocity: this._rand(cfg.angularVelocity) || 0,
            scaleX: 1, scaleY: 1,
            color: typeof cfg.color === 'number' ? cfg.color : (cfg.color?.start ?? 0xffffff),
            alpha: typeof cfg.alpha === 'number' ? cfg.alpha : (cfg.alpha?.start ?? 1),
            life: 0,
            maxLife: this._rand(cfg.lifetime),
            drag: cfg.drag ?? 0.98,
            scaleCurve: (cfg.scale && typeof cfg.scale === 'object') ? cfg.scale : null,
            alphaCurve: (cfg.alpha && typeof cfg.alpha === 'object') ? cfg.alpha : null,
            colorCurve: (cfg.color && typeof cfg.color === 'object' && cfg.color.start !== undefined) ? cfg.color : null,
            hasTrail: cfg.trail || false,
            trailPoints: [],
            trailLength: cfg.trailLength || 10,
            blendMode: cfg.blendMode || 'ADD',
            emitter: em,
            alive: true
        });

        if (p.scaleCurve) { p.scaleX = p.scaleCurve.start; p.scaleY = p.scaleCurve.start; }

        this.particles.push(p);
        em._particles.push(p);
        em.emitted++;
        this.stats.spawned++;
    }

    _kill(p) {
        p.alive = false;
        this.stats.killed++;

        // Sub-emitters
        if (p.emitter?.subEmitters) {
            p.emitter.subEmitters.forEach((sub) => {
                if (sub.trigger === 'death') {
                    this.createEmitter({ ...sub.config, x: p.x, y: p.y, emissionMode: 'burst' });
                }
            });
        }
        if (p.emitter?.onParticleDeath) p.emitter.onParticleDeath(p);
    }

    _recycle(p, idx) {
        // Remove from emitter list
        if (p.emitter) {
            const ei = p.emitter._particles.indexOf(p);
            if (ei !== -1) p.emitter._particles.splice(ei, 1);
        }
        this.particles.splice(idx, 1);
        p.trailPoints = [];
        if (this.particlePool.length < 1000) this.particlePool.push(p);
    }

    _emissionPos(em) {
        const a = em.emissionArea;
        switch (em.emissionShape) {
            case 'circle': {
                const ang = Math.random() * Math.PI * 2;
                const d = Math.random() * (a.radius || 50);
                return { x: em.x + Math.cos(ang) * d, y: em.y + Math.sin(ang) * d };
            }
            case 'rectangle':
                return {
                    x: em.x + (Math.random() - 0.5) * (a.width || 100),
                    y: em.y + (Math.random() - 0.5) * (a.height || 100)
                };
            case 'ring': {
                const ang = Math.random() * Math.PI * 2;
                const inner = a.innerRadius || 30;
                const outer = a.outerRadius || 50;
                const d = inner + Math.random() * (outer - inner);
                return { x: em.x + Math.cos(ang) * d, y: em.y + Math.sin(ang) * d };
            }
            default:
                return { x: em.x, y: em.y };
        }
    }

    _applyForce(force, p, dt) {
        switch (force.type) {
            case 'gravity':
                p.vx += (force.x || 0) * dt * 60;
                p.vy += (force.y || 0) * dt * 60;
                break;
            case 'vortex': {
                const dx = force.x - p.x, dy = force.y - p.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < (force.radius || 200) && d > 0) {
                    const f = (1 - d / force.radius) * (force.strength || 100) * dt;
                    const tang = Math.atan2(dy, dx) + Math.PI / 2;
                    p.vx += Math.cos(tang) * f;
                    p.vy += Math.sin(tang) * f;
                    p.vx += (dx / d) * (force.pull || 0) * f * 0.5;
                    p.vy += (dy / d) * (force.pull || 0) * f * 0.5;
                }
                break;
            }
            case 'turbulence': {
                const n1 = Math.sin(p.x * 0.01 + force._time) * 0.5 + 0.5;
                const n2 = Math.sin(p.y * 0.01 + force._time + 100) * 0.5 + 0.5;
                p.vx += (n1 - 0.5) * (force.strength || 30) * dt * 60;
                p.vy += (n2 - 0.5) * (force.strength || 30) * dt * 60;
                break;
            }
        }
    }

    _rand(range) {
        if (typeof range === 'number') return range;
        if (range && range.min !== undefined) return range.min + Math.random() * (range.max - range.min);
        return 0;
    }

    _lerp(a, b, t) { return a + (b - a) * t; }

    _lerpColor(startHex, endHex, t) {
        const s = Phaser.Display.Color.IntegerToColor(startHex);
        const e = Phaser.Display.Color.IntegerToColor(endHex);
        return Phaser.Display.Color.GetColor(
            Math.round(s.red + (e.red - s.red) * t),
            Math.round(s.green + (e.green - s.green) * t),
            Math.round(s.blue + (e.blue - s.blue) * t)
        );
    }

    _id() { return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

    _setParticleDefaults(cfg) {
        if (!cfg.lifetime) cfg.lifetime = { min: 800, max: 1500 };
        if (!cfg.speed) cfg.speed = { min: 50, max: 150 };
        if (!cfg.angle) cfg.angle = { min: 0, max: Math.PI * 2 };
    }

    // ----------------------------------------------------------------
    // Built-in presets
    // ----------------------------------------------------------------

    _loadPresets() {
        this.registerPreset('fireball', {
            emissionMode: 'burst', burstCount: 40,
            particleConfig: {
                lifetime: { min: 600, max: 1000 }, speed: { min: 100, max: 250 },
                angle: { min: 0, max: Math.PI * 2 },
                color: { start: 0xff4400, end: 0x440000 },
                scale: { start: 1.5, end: 0.2 }, alpha: { start: 1, end: 0 },
                blendMode: 'ADD', drag: 0.95, trail: true, trailLength: 8
            },
            subEmitters: [{
                trigger: 'death',
                config: {
                    burstCount: 3,
                    particleConfig: {
                        lifetime: { min: 800, max: 1200 }, speed: { min: 20, max: 50 },
                        angle: { min: 0, max: Math.PI * 2 },
                        color: { start: 0x666666, end: 0x111111 },
                        scale: { start: 0.5, end: 1.5 }, alpha: { start: 0.5, end: 0 },
                        drag: 0.98
                    }
                }
            }]
        });

        this.registerPreset('ice_shards', {
            emissionMode: 'burst', burstCount: 25,
            emissionShape: 'circle', emissionArea: { radius: 20 },
            particleConfig: {
                lifetime: { min: 500, max: 800 }, speed: { min: 150, max: 300 },
                angle: { min: 0, max: Math.PI * 2 },
                color: 0x88ccff,
                scale: { start: 0.8, end: 1.2 }, alpha: { start: 1, end: 0 },
                angularVelocity: { min: -5, max: 5 }, drag: 0.92
            }
        });

        this.registerPreset('healing_aura', {
            emissionMode: 'continuous', emissionRate: 20, duration: 2000,
            emissionShape: 'circle', emissionArea: { radius: 50 },
            particleConfig: {
                lifetime: { min: 1000, max: 1500 }, speed: { min: 30, max: 60 },
                angle: { min: 0, max: Math.PI * 2 },
                color: { start: 0x44ff88, end: 0xffffff },
                scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.8, end: 0 },
                drag: 0.96
            }
        });

        this.registerPreset('shadow_strike', {
            emissionMode: 'burst', burstCount: 30,
            emissionShape: 'ring', emissionArea: { innerRadius: 20, outerRadius: 40 },
            particleConfig: {
                lifetime: { min: 400, max: 700 }, speed: { min: 200, max: 350 },
                angle: { min: 0, max: Math.PI * 2 },
                color: { start: 0x8844ff, end: 0x220044 },
                scale: { start: 1.2, end: 0 }, alpha: { start: 0.9, end: 0 },
                trail: true, trailLength: 10, drag: 0.90
            }
        });

        this.registerPreset('hit_sparks', {
            emissionMode: 'burst', burstCount: 15,
            particleConfig: {
                lifetime: { min: 300, max: 500 }, speed: { min: 100, max: 200 },
                angle: { min: 0, max: Math.PI * 2 },
                color: 0xffaa00,
                scale: { start: 0.8, end: 0.2 }, alpha: { start: 1, end: 0 },
                drag: 0.92
            }
        });

        this.registerPreset('level_up', {
            emissionMode: 'burst', burstCount: 60,
            emissionShape: 'ring', emissionArea: { innerRadius: 40, outerRadius: 60 },
            particleConfig: {
                lifetime: { min: 1000, max: 1500 }, speed: { min: 50, max: 150 },
                angle: { min: 0, max: Math.PI * 2 },
                color: { start: 0xffff00, end: 0xffffff },
                scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 },
                angularVelocity: { min: -5, max: 5 }
            }
        });

        console.log(`[Particles] ${this.presets.size} presets loaded`);
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this.emitters.forEach((em) => this.stopEmitter(em, true));
        this.particles = [];
        if (this._gfx) this._gfx.destroy();
    }
}
