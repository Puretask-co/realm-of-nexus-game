import EventBus from '../core/EventBus.js';

/**
 * Enemy component — encapsulates a single enemy entity.
 *
 * Wraps a Phaser.Physics.Arcade.Sprite with:
 *  - Stats derived from enemy definition data
 *  - Health bar rendered above the sprite
 *  - State tracking for AI (idle, patrol, chase, attack, hurt, dead)
 *  - Hit flash effect on damage
 *  - Death sequence with particles and loot drop
 *
 * AI behaviour is driven externally by AISystem;
 * this component only handles per-entity state and rendering.
 */
export default class Enemy {
    constructor(scene, x, y, definition) {
        this.scene = scene;
        this.definition = definition;

        // Physics sprite
        this.sprite = scene.physics.add.sprite(x, y, 'enemy');
        this.sprite.setDepth(4);
        this.sprite.setCollideWorldBounds(true);
        this.sprite.owner = this;

        // Stats from definition
        const base = definition.baseStats || {};
        this.stats = {
            hp: base.hp || 50,
            maxHp: base.hp || 50,
            defense: base.defense || 5,
            speed: base.speed || 80,
            sapPool: base.sapPool || 30,
            attack: base.attack || 10
        };

        // AI state
        this.aiState = 'idle';
        this.aiTimer = 0;
        this.attackCooldown = 0;
        this.patrolOrigin = { x, y };
        this.patrolAngle = 0;

        // Health bar
        this._healthBarBg = scene.add.graphics().setDepth(10);
        this._healthBarFill = scene.add.graphics().setDepth(10);

        // Name tag
        this._nameTag = scene.add.text(x, y - 26, definition.name || 'Enemy', {
            fontFamily: 'monospace', fontSize: '8px', color: '#cc6666',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10);

        // Hit flash
        this._flashTimer = 0;

        // Active flag
        this.alive = true;
    }

    // ----------------------------------------------------------------
    // Update — called each frame
    // ----------------------------------------------------------------

    update(delta) {
        if (!this.alive) return;
        const dt = delta / 1000;

        // Update health bar position
        this._updateHealthBar();

        // Update name tag position
        this._nameTag.setPosition(this.sprite.x, this.sprite.y - 26);

        // Hit flash
        if (this._flashTimer > 0) {
            this._flashTimer -= dt;
            this.sprite.setTintFill(0xffffff);
            if (this._flashTimer <= 0) {
                this.sprite.clearTint();
            }
        }

        // Cooldowns
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        this.aiTimer += dt;
    }

    // ----------------------------------------------------------------
    // Health bar
    // ----------------------------------------------------------------

    _updateHealthBar() {
        const x = this.sprite.x - 16;
        const y = this.sprite.y - 22;
        const w = 32;
        const h = 3;
        const ratio = Math.max(0, this.stats.hp / this.stats.maxHp);

        this._healthBarBg.clear();
        this._healthBarBg.fillStyle(0x330000, 0.7);
        this._healthBarBg.fillRect(x, y, w, h);

        this._healthBarFill.clear();
        const barColor = ratio > 0.5 ? 0xff4444 : ratio > 0.25 ? 0xff8844 : 0xff2222;
        this._healthBarFill.fillStyle(barColor, 0.9);
        this._healthBarFill.fillRect(x, y, w * ratio, h);
    }

    // ----------------------------------------------------------------
    // Damage
    // ----------------------------------------------------------------

    takeDamage(amount, element) {
        if (!this.alive) return;

        // Apply defense
        const defReduction = this.stats.defense / (this.stats.defense + 100);
        const finalDamage = Math.max(1, Math.round(amount * (1 - defReduction)));

        this.stats.hp -= finalDamage;

        // Flash white
        this._flashTimer = 0.1;

        // Knockback
        const player = this.scene.player || this.scene.playerComponent?.sprite;
        if (player) {
            const angle = Phaser.Math.Angle.Between(player.x, player.y, this.sprite.x, this.sprite.y);
            this.sprite.setVelocity(
                Math.cos(angle) * 150,
                Math.sin(angle) * 150
            );
        }

        if (this.stats.hp <= 0) {
            this._die();
        }

        return finalDamage;
    }

    // ----------------------------------------------------------------
    // Death
    // ----------------------------------------------------------------

    _die() {
        this.alive = false;
        this.aiState = 'dead';

        // Emit event for loot, XP, etc.
        EventBus.emit('enemy-defeated', {
            enemy: this.sprite,
            definition: this.definition,
            position: { x: this.sprite.x, y: this.sprite.y }
        });

        // Fade out and destroy
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => this.destroy()
        });
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    destroy() {
        this._healthBarBg.destroy();
        this._healthBarFill.destroy();
        this._nameTag.destroy();
        this.sprite.destroy();
        this.alive = false;
    }

    // ----------------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------------

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get active() { return this.alive && this.sprite.active; }
}
