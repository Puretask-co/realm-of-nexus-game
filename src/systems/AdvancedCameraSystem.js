import EventBus from '../core/EventBus.js';

/**
 * Cinematic camera controller built on Phaser's camera.
 *
 * Features beyond Phaser's defaults:
 *  - Deadzone-aware follow with smooth lerp
 *  - Look-ahead (camera predicts player movement direction)
 *  - Multi-target framing (auto-zoom to keep all combatants in view)
 *  - Camera zones (zoom/pan adjustments when entering areas)
 *  - Layered shake system with presets (light hit vs explosion vs earthquake)
 *  - Cinematic timeline (keyframed camera paths for cutscenes)
 *  - Combat focus (auto-frame attacker and target during spell casts)
 */
export default class AdvancedCameraSystem {
    constructor(scene) {
        this.scene = scene;
        this.camera = scene.cameras.main;

        // Follow state
        this.followTarget = null;
        this.followConfig = { lerpX: 0.1, lerpY: 0.1, offsetX: 0, offsetY: 0, deadzoneX: 0.2, deadzoneY: 0.2 };

        // Look-ahead
        this.lookAhead = { enabled: false, distance: 150, smoothing: 0.05, x: 0, y: 0 };

        // Multi-target framing
        this.framingTargets = null;
        this.framingConfig = { padding: 100, minZoom: 0.5, maxZoom: 2.0, smooth: 0.05 };

        // Zoom
        this.targetZoom = 1.0;
        this.zoomSpeed = 0.05;

        // Shake stack (multiple shakes can layer)
        this.shakes = [];

        // Camera zones
        this.zones = [];

        // Cinematic state
        this.cinematicActive = false;
        this.cinematicSteps = [];
        this.cinematicIndex = 0;
        this.cinematicTimer = 0;
        this.cinematicOnComplete = null;
        this._savedFollowTarget = null;

        // Shake presets
        this.shakePresets = {
            light:      { intensity: 0.003, duration: 150, frequency: 20, decay: 0.90 },
            medium:     { intensity: 0.008, duration: 300, frequency: 25, decay: 0.92 },
            heavy:      { intensity: 0.015, duration: 500, frequency: 30, decay: 0.94 },
            explosion:  { intensity: 0.025, duration: 700, frequency: 35, decay: 0.95 },
            earthquake: { intensity: 0.012, duration: 2000, frequency: 15, decay: 0.98 },
            spell:      { intensity: 0.004, duration: 200, frequency: 22, decay: 0.91 }
        };
    }

    // ----------------------------------------------------------------
    // Follow
    // ----------------------------------------------------------------

    startFollow(target, config = {}) {
        this.followTarget = target;
        Object.assign(this.followConfig, config);
        this.framingTargets = null; // disable framing when follow starts
    }

    stopFollow() {
        this.followTarget = null;
    }

    enableLookAhead(distance = 150, smoothing = 0.05) {
        this.lookAhead.enabled = true;
        this.lookAhead.distance = distance;
        this.lookAhead.smoothing = smoothing;
    }

    disableLookAhead() {
        this.lookAhead.enabled = false;
        this.lookAhead.x = 0;
        this.lookAhead.y = 0;
    }

    // ----------------------------------------------------------------
    // Multi-target framing
    // ----------------------------------------------------------------

    frameTargets(targets, config = {}) {
        this.framingTargets = targets;
        Object.assign(this.framingConfig, config);
        this.followTarget = null; // disable follow
    }

    stopFraming() {
        this.framingTargets = null;
    }

    // ----------------------------------------------------------------
    // Zoom
    // ----------------------------------------------------------------

    setZoom(zoom, instant = false) {
        this.targetZoom = Phaser.Math.Clamp(zoom, 0.25, 4.0);
        if (instant) this.camera.setZoom(this.targetZoom);
    }

    transitionZoom(zoom, duration = 1000) {
        this.scene.tweens.add({
            targets: this,
            targetZoom: zoom,
            duration,
            ease: 'Sine.easeInOut'
        });
    }

    // ----------------------------------------------------------------
    // Camera zones
    // ----------------------------------------------------------------

    addZone(bounds, config = {}) {
        const zone = {
            bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height),
            zoom: config.zoom ?? null,
            transitionDuration: config.transitionDuration || 1000,
            onEnter: config.onEnter || null,
            onExit: config.onExit || null,
            active: false,
            priority: config.priority || 0
        };
        this.zones.push(zone);
        this.zones.sort((a, b) => b.priority - a.priority);
        return zone;
    }

    removeZone(zone) {
        const i = this.zones.indexOf(zone);
        if (i !== -1) this.zones.splice(i, 1);
    }

    // ----------------------------------------------------------------
    // Shake
    // ----------------------------------------------------------------

    shake(preset, overrides = {}) {
        const base = this.shakePresets[preset] || this.shakePresets.medium;
        const s = { ...base, ...overrides, elapsed: 0, phase: Math.random() * Math.PI * 2, current: base.intensity };
        this.shakes.push(s);
        return s;
    }

    stopShake(shake = null) {
        if (shake) {
            const i = this.shakes.indexOf(shake);
            if (i !== -1) this.shakes.splice(i, 1);
        } else {
            this.shakes = [];
        }
    }

    // ----------------------------------------------------------------
    // Cinematic timeline
    // ----------------------------------------------------------------

    /**
     * Play a sequence of camera keyframes.
     * Each step: { x, y, zoom, duration, ease? }
     */
    playCinematic(steps, onComplete = null) {
        this.cinematicActive = true;
        this.cinematicSteps = steps;
        this.cinematicIndex = 0;
        this.cinematicTimer = 0;
        this.cinematicOnComplete = onComplete;

        // Pause follow during cinematic
        this._savedFollowTarget = this.followTarget;
        this.followTarget = null;
        this.framingTargets = null;

        this._startCinematicStep();
    }

    _startCinematicStep() {
        if (this.cinematicIndex >= this.cinematicSteps.length) {
            this._endCinematic();
            return;
        }
        const step = this.cinematicSteps[this.cinematicIndex];
        const ease = step.ease || 'Sine.easeInOut';

        this.scene.tweens.add({
            targets: this.camera,
            scrollX: step.x - this.camera.width / (2 * (step.zoom || this.camera.zoom)),
            scrollY: step.y - this.camera.height / (2 * (step.zoom || this.camera.zoom)),
            duration: step.duration || 1000,
            ease,
            onComplete: () => {
                this.cinematicIndex++;
                this._startCinematicStep();
            }
        });

        if (step.zoom) this.transitionZoom(step.zoom, step.duration || 1000);
    }

    _endCinematic() {
        this.cinematicActive = false;
        this.followTarget = this._savedFollowTarget;
        this._savedFollowTarget = null;
        if (this.cinematicOnComplete) this.cinematicOnComplete();
    }

    skipCinematic() {
        if (!this.cinematicActive) return;
        this.scene.tweens.killAll();
        this._endCinematic();
    }

    // ----------------------------------------------------------------
    // Combat helpers
    // ----------------------------------------------------------------

    /**
     * Briefly focus on attacker, then snap to target, then resume.
     */
    dramaticSpellZoom(caster, target, duration = 800) {
        const origZoom = this.camera.zoom;
        const saved = this.followTarget;
        this.followTarget = null;

        // Zoom in on caster
        this.scene.tweens.add({
            targets: this.camera,
            scrollX: caster.x - this.camera.width / (2 * origZoom * 1.3),
            scrollY: caster.y - this.camera.height / (2 * origZoom * 1.3),
            zoom: origZoom * 1.3,
            duration: duration * 0.3,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.camera.flash(100, 255, 255, 255, false);
                // Pan to target
                this.scene.tweens.add({
                    targets: this.camera,
                    scrollX: target.x - this.camera.width / (2 * origZoom),
                    scrollY: target.y - this.camera.height / (2 * origZoom),
                    zoom: origZoom,
                    duration: duration * 0.4,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.followTarget = saved;
                    }
                });
            }
        });
    }

    /**
     * Auto-zoom to show all combatants.
     */
    focusOnCombat(combatants) {
        this.frameTargets(combatants, { padding: 120, maxZoom: 2.0, smooth: 0.08 });
    }

    // ----------------------------------------------------------------
    // Per-frame update
    // ----------------------------------------------------------------

    update(delta) {
        if (this.cinematicActive) return; // tweens handle it

        // Follow controller
        if (this.followTarget) this._updateFollow(delta);

        // Multi-target framing
        if (this.framingTargets) this._updateFraming();

        // Zoom smoothing
        const zd = this.targetZoom - this.camera.zoom;
        if (Math.abs(zd) > 0.001) {
            this.camera.setZoom(this.camera.zoom + zd * this.zoomSpeed);
        }

        // Zones
        this._updateZones();

        // Shakes
        this._updateShakes(delta);
    }

    _updateFollow(delta) {
        const t = this.followTarget;
        const fc = this.followConfig;
        const sw = this.camera.width / this.camera.zoom;
        const sh = this.camera.height / this.camera.zoom;

        let targetX = t.x + fc.offsetX;
        let targetY = t.y + fc.offsetY;

        // Look-ahead
        if (this.lookAhead.enabled && t.body) {
            const vx = t.body.velocity.x;
            const vy = t.body.velocity.y;
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > 1) {
                const norm = Math.min(speed / 500, 1);
                const laX = (vx / speed) * this.lookAhead.distance * norm;
                const laY = (vy / speed) * this.lookAhead.distance * norm;
                this.lookAhead.x += (laX - this.lookAhead.x) * this.lookAhead.smoothing;
                this.lookAhead.y += (laY - this.lookAhead.y) * this.lookAhead.smoothing;
            } else {
                this.lookAhead.x *= 0.95;
                this.lookAhead.y *= 0.95;
            }
            targetX += this.lookAhead.x;
            targetY += this.lookAhead.y;
        }

        const cx = this.camera.scrollX + sw / 2;
        const cy = this.camera.scrollY + sh / 2;

        const newX = cx + (targetX - cx) * fc.lerpX;
        const newY = cy + (targetY - cy) * fc.lerpY;
        this.camera.centerOn(newX, newY);
    }

    _updateFraming() {
        const targets = this.framingTargets.filter((t) => t && t.active !== false);
        if (targets.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        targets.forEach((t) => {
            minX = Math.min(minX, t.x);
            minY = Math.min(minY, t.y);
            maxX = Math.max(maxX, t.x);
            maxY = Math.max(maxY, t.y);
        });

        const pad = this.framingConfig.padding;
        const w = maxX - minX + pad * 2;
        const h = maxY - minY + pad * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const zoomFit = Math.min(this.camera.width / w, this.camera.height / h);
        const clamped = Phaser.Math.Clamp(zoomFit, this.framingConfig.minZoom, this.framingConfig.maxZoom);

        const sm = this.framingConfig.smooth;
        const curX = this.camera.scrollX + this.camera.width / (2 * this.camera.zoom);
        const curY = this.camera.scrollY + this.camera.height / (2 * this.camera.zoom);

        this.camera.centerOn(
            curX + (cx - curX) * sm,
            curY + (cy - curY) * sm
        );
        this.targetZoom = clamped;
    }

    _updateZones() {
        const cx = this.camera.scrollX + this.camera.width / (2 * this.camera.zoom);
        const cy = this.camera.scrollY + this.camera.height / (2 * this.camera.zoom);

        this.zones.forEach((z) => {
            const inside = z.bounds.contains(cx, cy);
            if (inside && !z.active) {
                z.active = true;
                if (z.zoom !== null) this.transitionZoom(z.zoom, z.transitionDuration);
                if (z.onEnter) z.onEnter(z);
            } else if (!inside && z.active) {
                z.active = false;
                if (z.onExit) z.onExit(z);
            }
        });
    }

    _updateShakes(delta) {
        for (let i = this.shakes.length - 1; i >= 0; i--) {
            const s = this.shakes[i];
            s.elapsed += delta;
            if (s.duration > 0 && s.elapsed >= s.duration) { this.shakes.splice(i, 1); continue; }

            s.current *= s.decay;
            s.phase += s.frequency * (delta / 1000);

            const ox = Math.sin(s.phase * Math.PI * 2) * s.current * this.camera.width;
            const oy = Math.cos(s.phase * Math.PI * 2) * s.current * this.camera.height;
            this.camera.scrollX += ox;
            this.camera.scrollY += oy;
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this.shakes = [];
        this.zones = [];
        this.cinematicActive = false;
    }
}
