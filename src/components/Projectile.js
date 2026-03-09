import { EventBus } from '../core/EventBus.js';

/**
 * Projectile component — spell projectile with homing, AoE, and trails.
 *
 * Created by SpellSystem/GameScene when a ranged spell is cast.
 * Handles movement toward target, collision detection via overlap,
 * and impact event emission for VFX and damage.
 */
export class Projectile {
  constructor(scene, x, y, config) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.config = config;

    // Projectile properties
    this.spell = config.spell;
    this.caster = config.caster;
    this.targetPos = config.targetPos || { x: x + 100, y };
    this.speed = config.speed || 300;
    this.maxLifetime = config.maxLifetime || 3;  // seconds
    this.lifetime = 0;
    this.homing = config.homing || false;
    this.homingTarget = config.homingTarget || null;
    this.aoeRadius = (config.spell?.areaOfEffect || 0) * 32;
    this.hasImpacted = false;

    // Visual (placeholder if no texture)
    const color = config.color || 0x4a9eff;
    if (scene.textures.exists(config.texture || 'projectile')) {
      this.sprite = scene.physics.add.sprite(x, y, config.texture || 'projectile');
    } else {
      this.sprite = scene.add.circle(x, y, 6, color, 1);
      scene.physics.add.existing(this.sprite);
    }

    this.sprite.setDepth(6);
    this.sprite.owner = this;

    // Calculate velocity toward target
    const dx = this.targetPos.x - x;
    const dy = this.targetPos.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.sprite.body.setVelocity(
      (dx / dist) * this.speed,
      (dy / dist) * this.speed
    );

    // Rotate to face direction
    this.sprite.setRotation(Math.atan2(dy, dx));

    // Trail particles (emitted via EventBus for AdvancedParticleSystem)
    if (config.spell?.particleEffect) {
      this.eventBus.emit('particle:trail', {
        followTarget: this.sprite,
        preset: config.spell.particleEffect,
        x, y
      });
    }
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(delta) {
    if (this.hasImpacted || !this.sprite.active) return;

    const dt = delta / 1000;
    this.lifetime += dt;

    // Lifetime expiry
    if (this.lifetime >= this.maxLifetime) {
      this.expire();
      return;
    }

    // Homing behavior
    if (this.homing && this.homingTarget) {
      const target = this.homingTarget;
      if (target.active !== false && target.stats?.hp > 0) {
        const tx = (target.x || target.sprite?.x || 0);
        const ty = (target.y || target.sprite?.y || 0);
        const dx = tx - this.sprite.x;
        const dy = ty - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Steer toward target
        const turnRate = 5; // radians per second
        const targetAngle = Math.atan2(dy, dx);
        const currentAngle = Math.atan2(this.sprite.body.velocity.y, this.sprite.body.velocity.x);
        let angleDiff = targetAngle - currentAngle;

        // Normalize angle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const steer = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * dt);
        const newAngle = currentAngle + steer;

        this.sprite.body.setVelocity(
          Math.cos(newAngle) * this.speed,
          Math.sin(newAngle) * this.speed
        );
        this.sprite.setRotation(newAngle);
      }
    }
  }

  // ─── Impact ──────────────────────────────────────────────────────

  /**
   * Called when projectile overlaps with a target.
   */
  impact(target) {
    if (this.hasImpacted) return;
    this.hasImpacted = true;

    this.eventBus.emit('spell-impact', {
      spell: this.spell,
      spellId: this.spell?.id,
      caster: this.caster,
      target,
      x: this.sprite.x,
      y: this.sprite.y,
      aoeRadius: this.aoeRadius
    });

    this.destroy();
  }

  /**
   * Expire without hitting anything.
   */
  expire() {
    this.hasImpacted = true;
    this.destroy();
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get active() { return this.sprite.active && !this.hasImpacted; }

  destroy() {
    if (this.sprite.active) {
      this.sprite.destroy();
    }
  }
}

export default Projectile;
