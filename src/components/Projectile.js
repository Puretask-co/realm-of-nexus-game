import EventBus from '../core/EventBus.js';

/**
 * Projectile component — a spell projectile that travels from
 * caster to target position, dealing damage on impact.
 *
 * Features:
 *  - Constant-speed travel toward target or direction
 *  - Homing: optional target-seeking behaviour
 *  - Trail particles emitted every frame via EventBus
 *  - Collision with enemies (area-of-effect optional)
 *  - Auto-destroy on impact or after max lifetime
 *  - Piercing mode: passes through enemies without stopping
 *
 * Created by the SpellVFXIntegration or CombatSystem when
 * a ranged spell is cast.
 */
export default class Projectile {
    constructor(scene, config) {
        this.scene = scene;
        this.spell = config.spell;
        this.caster = config.caster;

        const startX = config.startX || config.caster?.x || 0;
        const startY = config.startY || config.caster?.y || 0;

        // Physics body
        this.sprite = scene.physics.add.sprite(startX, startY, 'particle');
        this.sprite.setDepth(6);
        this.sprite.setScale(config.scale || 1.5);
        this.sprite.owner = this;

        // Tint based on element
        this.sprite.setTint(this._elementColor(config.spell?.element));

        // Movement
        this.speed = config.speed || 400;
        this.maxLifetime = config.lifetime || 2.0; // seconds
        this.lifetime = 0;
        this.piercing = config.piercing || false;
        this.aoeRadius = config.aoeRadius || 0;
        this.homing = config.homing || false;
        this.homingTarget = config.target || null;
        this.hasHit = false;

        // Direction
        if (config.targetX !== undefined && config.targetY !== undefined) {
            const angle = Phaser.Math.Angle.Between(startX, startY, config.targetX, config.targetY);
            this.sprite.setVelocity(
                Math.cos(angle) * this.speed,
                Math.sin(angle) * this.speed
            );
            this.sprite.setRotation(angle);
        } else if (config.angle !== undefined) {
            this.sprite.setVelocity(
                Math.cos(config.angle) * this.speed,
                Math.sin(config.angle) * this.speed
            );
            this.sprite.setRotation(config.angle);
        }

        // Trail particle frequency
        this._trailTimer = 0;
        this._trailInterval = 0.03; // 30ms between trail particles

        this.alive = true;
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(delta) {
        if (!this.alive) return;
        const dt = delta / 1000;

        this.lifetime += dt;
        if (this.lifetime >= this.maxLifetime) {
            this.destroy();
            return;
        }

        // Homing behaviour
        if (this.homing && this.homingTarget && this.homingTarget.active) {
            const angle = Phaser.Math.Angle.Between(
                this.sprite.x, this.sprite.y,
                this.homingTarget.x, this.homingTarget.y
            );

            // Smooth turning
            const currentAngle = this.sprite.rotation;
            const turnSpeed = 3.0; // radians per second
            const diff = Phaser.Math.Angle.Wrap(angle - currentAngle);
            const newAngle = currentAngle + Phaser.Math.Clamp(diff, -turnSpeed * dt, turnSpeed * dt);

            this.sprite.setVelocity(
                Math.cos(newAngle) * this.speed,
                Math.sin(newAngle) * this.speed
            );
            this.sprite.setRotation(newAngle);
        }

        // Emit trail particles
        this._trailTimer += dt;
        if (this._trailTimer >= this._trailInterval) {
            this._trailTimer = 0;
            EventBus.emit('spell-projectile-move', {
                spell: this.spell,
                x: this.sprite.x,
                y: this.sprite.y
            });
        }
    }

    // ----------------------------------------------------------------
    // Collision
    // ----------------------------------------------------------------

    onHitEnemy(enemy) {
        if (!this.alive) return;
        if (this.hasHit && !this.piercing) return;

        this.hasHit = true;

        // Calculate damage
        const baseDamage = this.spell?.baseDamage || 10;

        // Area of effect
        if (this.aoeRadius > 0) {
            EventBus.emit('aoe-damage', {
                x: this.sprite.x,
                y: this.sprite.y,
                radius: this.aoeRadius,
                spell: this.spell,
                caster: this.caster,
                baseDamage: baseDamage
            });
        } else {
            EventBus.emit('combat-action', {
                attacker: this.caster,
                target: enemy,
                spell: this.spell
            });
        }

        // Impact effects
        EventBus.emit('spell-impact', {
            spell: this.spell,
            target: enemy,
            x: this.sprite.x,
            y: this.sprite.y,
            damage: baseDamage
        });

        if (!this.piercing) {
            this.destroy();
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _elementColor(element) {
        const map = {
            arcane: 0x4488ff,
            fire: 0xff6622,
            nature: 0x44ff66,
            shadow: 0x8844cc,
            light: 0xffdd44,
            ice: 0x88ddff
        };
        return map[element] || 0xffffff;
    }

    destroy() {
        if (!this.alive) return;
        this.alive = false;
        this.sprite.destroy();
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get active() { return this.alive && this.sprite.active; }
}
