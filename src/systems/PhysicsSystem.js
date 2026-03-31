import EventBus from '../core/EventBus.js';

/**
 * PhysicsSystem — Game-aware physics layer built on top of Phaser Arcade Physics.
 *
 * Handles:
 *  - Knockback with weight classes (light / medium / heavy / explosive)
 *  - Smooth acceleration-based player movement (replaces direct setVelocity)
 *  - Zone-type speed modifiers (forest slows, void heavily slows, etc.)
 *  - Projectile lifecycle management (fire-and-forget with overlap detection)
 *  - Status-effect physics: slow, stagger, impulse
 *  - Player knockback from enemy hits
 *
 * Usage in GameScene:
 *   this.physicsSystem = new PhysicsSystem(this);
 *   this.physicsSystem.init();
 *   // in update:  this.physicsSystem.update(delta);
 *   // in shutdown: this.physicsSystem.destroy();
 */
export default class PhysicsSystem {
    // ── Knockback weight classes ──────────────────────────────────────────────
    static KNOCKBACK = {
        light:     { force: 90,  duration: 180 },
        medium:    { force: 180, duration: 280 },
        heavy:     { force: 300, duration: 420 },
        explosive: { force: 450, duration: 600 },
    };

    // ── Zone type → movement speed multiplier ─────────────────────────────────
    static ZONE_SPEED = {
        hub: 1.0, market: 1.0, military: 1.0,
        dungeon: 0.9, underground_city: 0.9,
        grove: 0.85, exploration: 0.9, forest: 0.8,
        temple: 0.9, sacred: 0.9, shrine: 0.9,
        boss: 1.0,
        hidden: 0.85,
        void: 0.7, corruption: 0.7,
    };

    constructor(scene) {
        this.scene = scene;

        // entity → { vx, vy, elapsed, duration }
        this._knockbacks  = new Map();
        // Active projectile descriptors
        this._projectiles = [];
        // Active slow effects on player: [{ mult, endTime }]
        this._slowEffects = [];

        this._zoneSpeedMult   = 1.0;  // set by zone-entered events
        this._playerSlowMult  = 1.0;  // set by slow status effects
        this._unsubs          = [];
    }

    // ────────────────────────────────────────────────────────────────────────────
    // INIT / DESTROY
    // ────────────────────────────────────────────────────────────────────────────

    init() {
        // Switch player to acceleration-based movement model:
        //   setDamping(false) + linear setDrag + setAcceleration from input
        const player = this.scene.player;
        if (player?.body) {
            player.setDamping(false);
            player.setDragX(600);
            player.setDragY(600);
            player.setMaxVelocity(280);
        }

        this._unsubs = [
            EventBus.on('zone-entered',    (d) => this._onZoneEnter(d)),
            EventBus.on('enemy-damaged',   (d) => this._onEnemyDamaged(d)),
            EventBus.on('player-damaged',  (d) => this._onPlayerDamaged(d)),
            EventBus.on('spell-impact',    (d) => this._onSpellImpact(d)),
        ];

        return this;
    }

    destroy() {
        this._unsubs.forEach(fn => typeof fn === 'function' && fn());
        this._projectiles.forEach(p => { try { p.sprite?.destroy(); } catch (_) {} });
        this._knockbacks.clear();
        this._projectiles = [];
        this._slowEffects = [];
    }

    // ────────────────────────────────────────────────────────────────────────────
    // UPDATE  (call every frame from GameScene.update)
    // ────────────────────────────────────────────────────────────────────────────

    update(delta) {
        this._processKnockbacks(delta);
        this._processProjectiles(delta);
        this._processSlowEffects();
    }

    _processKnockbacks(delta) {
        for (const [entity, kb] of this._knockbacks) {
            if (!entity?.active || !entity.body) {
                this._knockbacks.delete(entity);
                continue;
            }

            kb.elapsed += delta;
            if (kb.elapsed >= kb.duration) {
                this._knockbacks.delete(entity);
                continue;
            }

            // Quadratic falloff: full force at 0, zero at duration
            const t = kb.elapsed / kb.duration;
            const falloff = 1 - (t * t);

            entity.body.setVelocity(kb.vx * falloff, kb.vy * falloff);
        }
    }

    _processProjectiles(delta) {
        for (let i = this._projectiles.length - 1; i >= 0; i--) {
            const proj = this._projectiles[i];
            if (!proj.sprite?.active) {
                this._projectiles.splice(i, 1);
                continue;
            }

            proj.elapsed += delta;
            if (proj.elapsed > proj.lifetime) {
                this._safeDestroy(proj.sprite);
                this._projectiles.splice(i, 1);
                continue;
            }

            const dx = proj.sprite.x - proj.originX;
            const dy = proj.sprite.y - proj.originY;
            if ((dx * dx + dy * dy) > proj.rangeSq) {
                this._safeDestroy(proj.sprite);
                this._projectiles.splice(i, 1);
            }
        }
    }

    _processSlowEffects() {
        const now = this.scene.time.now;
        this._slowEffects = this._slowEffects.filter(e => e.endTime > now);
        // Composite slow: take the largest slow (smallest mult)
        if (this._slowEffects.length === 0) {
            this._playerSlowMult = 1.0;
        } else {
            this._playerSlowMult = Math.min(...this._slowEffects.map(e => e.mult));
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // PLAYER MOVEMENT  (replaces direct setVelocity in _handleMovement)
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Apply movement acceleration from input.
     * Call every frame INSTEAD of player.setVelocity().
     *
     * @param {Phaser.Physics.Arcade.Sprite} player
     * @param {number} inputX  — normalised X direction (-1, 0, 1)
     * @param {number} inputY  — normalised Y direction (-1, 0, 1)
     * @param {number} baseSpeed — player stats speed
     */
    applyPlayerMovement(player, inputX, inputY, baseSpeed) {
        if (this._knockbacks.has(player)) return; // knockback owns velocity

        const speedMult = this._zoneSpeedMult * this._playerSlowMult;
        const speed     = baseSpeed * speedMult;

        // Diagonal normalisation
        let nx = inputX, ny = inputY;
        if (nx !== 0 && ny !== 0) { nx *= 0.707; ny *= 0.707; }

        const ACCEL = 2200; // pixels per second²
        if (nx !== 0 || ny !== 0) {
            player.setAcceleration(nx * ACCEL, ny * ACCEL);
            player.setMaxVelocity(speed);
        } else {
            player.setAcceleration(0, 0);
        }
    }

    /** Returns the current composite speed multiplier (zone × slow effects). */
    getSpeedMultiplier() {
        return this._zoneSpeedMult * this._playerSlowMult;
    }

    /** True if entity is currently in a knockback state (velocity controlled by us). */
    isKnockedBack(entity) {
        return this._knockbacks.has(entity);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // KNOCKBACK
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Push an entity away from (sourceX, sourceY).
     * @param {Phaser.GameObjects.Sprite} entity
     * @param {number} sourceX
     * @param {number} sourceY
     * @param {'light'|'medium'|'heavy'|'explosive'} weightClass
     */
    applyKnockback(entity, sourceX, sourceY, weightClass = 'light') {
        if (!entity?.body || !entity.active) return;

        const cfg   = PhysicsSystem.KNOCKBACK[weightClass] || PhysicsSystem.KNOCKBACK.light;
        const angle = Phaser.Math.Angle.Between(sourceX, sourceY, entity.x, entity.y);
        const vx    = Math.cos(angle) * cfg.force;
        const vy    = Math.sin(angle) * cfg.force;

        this._knockbacks.set(entity, { vx, vy, elapsed: 0, duration: cfg.duration });
        entity.body.setVelocity(vx, vy);
    }

    /**
     * Knockback by explicit angle (degrees) and weight class.
     */
    applyKnockbackAngle(entity, angleDeg, weightClass = 'light') {
        if (!entity?.body || !entity.active) return;

        const cfg = PhysicsSystem.KNOCKBACK[weightClass] || PhysicsSystem.KNOCKBACK.light;
        const rad = Phaser.Math.DegToRad(angleDeg);
        const vx  = Math.cos(rad) * cfg.force;
        const vy  = Math.sin(rad) * cfg.force;

        this._knockbacks.set(entity, { vx, vy, elapsed: 0, duration: cfg.duration });
        entity.body.setVelocity(vx, vy);
    }

    /**
     * Instant impulse — does NOT register as knockback (velocity can be overridden next frame).
     */
    applyImpulse(entity, vx, vy) {
        if (!entity?.body || !entity.active) return;
        entity.body.setVelocity(vx, vy);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // STATUS EFFECT PHYSICS
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Slow the player's effective speed.
     * Multiple slow effects stack: the largest slow wins.
     * @param {number} multiplier  e.g. 0.5 = 50% speed
     * @param {number} durationMs
     */
    applyPlayerSlow(multiplier, durationMs) {
        this._slowEffects.push({ mult: multiplier, endTime: this.scene.time.now + durationMs });
    }

    /**
     * Stagger an enemy: lock their velocity briefly (shorter than knockback, just a hitch).
     * @param {Phaser.GameObjects.Sprite} entity
     * @param {number} durationMs
     */
    applyStagger(entity, durationMs = 150) {
        if (!entity?.body || !entity.active) return;
        entity.body.setVelocity(0, 0);
        // Hold in stagger by registering a zero-force knockback
        this._knockbacks.set(entity, { vx: 0, vy: 0, elapsed: 0, duration: durationMs });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // PROJECTILE SYSTEM
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Fire a physics-enabled projectile.
     *
     * @param {object} config
     *   originX/Y    — spawn position
     *   angle        — direction in RADIANS
     *   speed        — pixels per second (default 400)
     *   textureKey   — Phaser texture key (falls back to a colored rectangle)
     *   tint         — hex color (used for tint or fallback rect)
     *   size         — display size in px (default 10)
     *   range        — max travel distance in px (default 600)
     *   lifetime     — max alive time in ms (default 2500)
     *   targets      — Phaser Group or array to check overlap
     *   onHit(target, projSprite) — callback on overlap
     *   piercing     — if true, don't destroy on first hit
     *
     * @returns {object} projectile descriptor
     */
    fireProjectile(config) {
        const {
            originX, originY,
            angle     = 0,
            speed     = 400,
            textureKey = null,
            tint      = 0xffffff,
            size      = 10,
            range     = 600,
            lifetime  = 2500,
            targets   = null,
            onHit     = null,
            piercing  = false,
        } = config;

        const scene = this.scene;

        // Create the sprite — prefer texture, fall back to tinted white square
        let sprite;
        const key = (textureKey && scene.textures.exists(textureKey)) ? textureKey : '__DEFAULT';
        sprite = scene.physics.add.sprite(originX, originY, key);
        sprite.setDisplaySize(size, size).setTint(tint).setDepth(4300);
        sprite.body.setAllowGravity(false);

        // Set velocity from angle
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        sprite.body.setVelocity(vx, vy);

        // Overlap detection
        if (targets) {
            scene.physics.add.overlap(sprite, targets, (projSprite, target) => {
                if (!projSprite.active) return;
                if (onHit) onHit(target, projSprite);
                if (!piercing) {
                    this._safeDestroy(projSprite);
                }
            });
        }

        const desc = {
            sprite,
            originX, originY,
            range, rangeSq: range * range,
            lifetime, elapsed: 0,
        };

        this._projectiles.push(desc);
        return desc;
    }

    /**
     * Fire a homing projectile that steers toward a target entity each frame.
     *
     * @param {object} config — same as fireProjectile + `target` (entity to track)
     */
    fireHomingProjectile(config) {
        const { target, turnSpeed = 2.5, ...rest } = config;
        if (!target) return this.fireProjectile(rest);

        const desc = this.fireProjectile(rest);
        if (!desc) return;

        // Steer toward target every 50ms
        const steerTimer = this.scene.time.addEvent({
            delay: 50,
            loop: true,
            callback: () => {
                if (!desc.sprite?.active || !target?.active) {
                    steerTimer.remove();
                    return;
                }
                const angle = Phaser.Math.Angle.Between(
                    desc.sprite.x, desc.sprite.y, target.x, target.y
                );
                const speed = desc.sprite.body.speed || rest.speed || 400;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                desc.sprite.body.setVelocity(
                    Phaser.Math.Linear(desc.sprite.body.velocity.x, vx, turnSpeed * 0.1),
                    Phaser.Math.Linear(desc.sprite.body.velocity.y, vy, turnSpeed * 0.1)
                );
            }
        });

        return desc;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ────────────────────────────────────────────────────────────────────────────

    _onZoneEnter(data) {
        const zoneType = data?.locationType || data?.zone?.type || 'hub';
        const prev     = this._zoneSpeedMult;
        this._zoneSpeedMult = PhysicsSystem.ZONE_SPEED[zoneType] ?? 1.0;

        if (prev !== this._zoneSpeedMult) {
            EventBus.emit('physics:zoneSpeedChanged', {
                zoneType,
                multiplier: this._zoneSpeedMult
            });
        }
    }

    _onEnemyDamaged(data) {
        const enemy = data?.enemy;
        if (!enemy) return;

        const sx = data?.attackerX ?? this.scene.player?.x ?? enemy.x;
        const sy = data?.attackerY ?? this.scene.player?.y ?? enemy.y;

        // Map spell element / weapon class to knockback weight
        const element = data?.element;
        let weightClass = 'light';
        if (element === 'explosive' || element === 'void' || element === 'thunder') weightClass = 'heavy';
        else if (element === 'fire' || element === 'physical' || element === 'water') weightClass = 'medium';

        this.applyKnockback(enemy, sx, sy, weightClass);
    }

    _onPlayerDamaged(data) {
        const player = this.scene.player;
        if (!player) return;

        const sx = data?.attackerX ?? player.x + 40;
        const sy = data?.attackerY ?? player.y;

        // Player always gets light knockback from enemy attacks
        this.applyKnockback(player, sx, sy, 'light');

        // Brief camera shake
        this.scene.cameras?.main?.shake(90, 0.004);
    }

    _onSpellImpact(data) {
        // Heavy spells upgrade knockback class
        const element = data?.spell?.element;
        const target  = data?.target;
        if (!target) return;

        const sx = data?.caster?.x ?? target.x + 1;
        const sy = data?.caster?.y ?? target.y + 1;

        let weightClass = 'medium';
        if (['void', 'thunder', 'fire'].includes(element)) weightClass = 'heavy';

        this.applyKnockback(target, sx, sy, weightClass);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────────────────────

    _safeDestroy(obj) {
        try { if (obj?.active) obj.destroy(); } catch (_) {}
    }
}
