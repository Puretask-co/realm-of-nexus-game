import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * Player component — encapsulates player entity logic.
 *
 * Wraps a Phaser.Physics.Arcade.Sprite with:
 *  - Stats management (HP, Sap, Attack, Defense, Speed)
 *  - Spell inventory and cooldown tracking
 *  - Movement with 8-directional control and diagonal normalization
 *  - Dash ability (short burst of speed with cooldown)
 *  - Invincibility frames after taking damage
 *  - Animation state machine (idle, walk, cast, hurt, death)
 *  - Sap regeneration tied to the current phase
 *
 * The player does NOT directly reference other systems.
 * All communication is through EventBus.
 */
export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        // Create the physics sprite
        this.sprite = scene.physics.add.sprite(x, y, 'player');
        this.sprite.setDepth(5);
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setDamping(true);
        this.sprite.setDrag(0.85);
        this.sprite.setMaxVelocity(280);

        // Reference back to this component
        this.sprite.owner = this;

        // ---- Stats ----
        const config = dataManager.getConfig('balance.player') || {};
        this.stats = {
            hp: config.startingHp || 100,
            maxHp: config.startingHp || 100,
            sap: config.startingSap || 100,
            maxSap: config.startingSap || 100,
            attack: 10,
            defense: 5,
            speed: 200,
            critChance: 0.05,
            resistances: {}
        };

        // ---- Spells ----
        this.spells = [];
        this.cooldowns = {};

        // ---- State ----
        this.state = 'idle'; // idle | walking | casting | hurt | dead
        this.facing = 'down'; // up | down | left | right
        this.invincible = false;
        this.invincibleTimer = 0;
        this.dashCooldown = 0;
        this.dashDuration = 0;
        this.isDashing = false;

        // Sap regen rate (per second)
        this.sapRegenRate = config.sapRegenRate || 5;

        // ---- Input (set up by scene) ----
        this.cursors = null;
        this.wasd = null;
    }

    /**
     * Setup input keys. Call after scene.create().
     */
    setupInput() {
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Dash on SPACE
        this.scene.input.keyboard.on('keydown-SPACE', () => this.dash());

        // Spell keys
        this.scene.input.keyboard.on('keydown-ONE', () => this.castSpell(0));
        this.scene.input.keyboard.on('keydown-TWO', () => this.castSpell(1));
        this.scene.input.keyboard.on('keydown-THREE', () => this.castSpell(2));
        this.scene.input.keyboard.on('keydown-FOUR', () => this.castSpell(3));
        this.scene.input.keyboard.on('keydown-FIVE', () => this.castSpell(4));
    }

    /**
     * Equip starting spells from data.
     */
    equipStartingSpells() {
        const ids = ['azure_bolt', 'crimson_surge', 'verdant_bloom', 'shadow_strike', 'radiant_burst'];
        ids.forEach((id) => {
            const spell = dataManager.getSpell(id);
            if (spell) this.spells.push(spell);
        });
    }

    // ----------------------------------------------------------------
    // Movement
    // ----------------------------------------------------------------

    update(delta) {
        if (this.state === 'dead') return;

        const dt = delta / 1000;

        // Invincibility frames
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.sprite.setAlpha(1);
            } else {
                // Flash effect
                this.sprite.setAlpha(Math.sin(this.invincibleTimer * 15) > 0 ? 1 : 0.3);
            }
        }

        // Dash timer
        if (this.isDashing) {
            this.dashDuration -= dt;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
                this.sprite.setMaxVelocity(280);
            }
        }
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }

        // Movement
        this._handleMovement();

        // Sap regeneration
        if (this.stats.sap < this.stats.maxSap) {
            this.stats.sap = Math.min(
                this.stats.maxSap,
                this.stats.sap + this.sapRegenRate * dt
            );
        }

        // Cooldown ticking
        const now = this.scene.time.now;
        Object.keys(this.cooldowns).forEach((spellId) => {
            if (this.cooldowns[spellId] <= now) {
                delete this.cooldowns[spellId];
            }
        });
    }

    _handleMovement() {
        if (this.state === 'casting' || this.state === 'hurt') return;

        const speed = this.isDashing ? this.stats.speed * 2.5 : this.stats.speed;
        let vx = 0;
        let vy = 0;

        if (this.cursors?.left.isDown || this.wasd?.left.isDown) { vx = -speed; this.facing = 'left'; }
        if (this.cursors?.right.isDown || this.wasd?.right.isDown) { vx = speed; this.facing = 'right'; }
        if (this.cursors?.up.isDown || this.wasd?.up.isDown) { vy = -speed; this.facing = 'up'; }
        if (this.cursors?.down.isDown || this.wasd?.down.isDown) { vy = speed; this.facing = 'down'; }

        // Diagonal normalization
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }

        this.sprite.setVelocity(vx, vy);
        this.state = (vx !== 0 || vy !== 0) ? 'walking' : 'idle';
    }

    // ----------------------------------------------------------------
    // Dash
    // ----------------------------------------------------------------

    dash() {
        if (this.isDashing || this.dashCooldown > 0 || this.state === 'dead') return;

        this.isDashing = true;
        this.dashDuration = 0.15; // 150ms burst
        this.dashCooldown = 1.0;  // 1s cooldown
        this.sprite.setMaxVelocity(600);

        EventBus.emit('player-dash', { x: this.sprite.x, y: this.sprite.y, facing: this.facing });
    }

    // ----------------------------------------------------------------
    // Spell casting
    // ----------------------------------------------------------------

    castSpell(index) {
        if (this.state === 'dead') return;

        const spell = this.spells[index];
        if (!spell) return;

        const now = this.scene.time.now;
        if (this.cooldowns[spell.id] && now < this.cooldowns[spell.id]) return;
        if (this.stats.sap < spell.sapCost) return;

        // Consume sap
        this.stats.sap -= spell.sapCost;

        // Set cooldown
        this.cooldowns[spell.id] = now + spell.cooldown * 1000;

        // Emit for other systems
        EventBus.emit('spell-cast', {
            spell,
            caster: this.sprite,
            casterStats: this.stats,
            targetPos: this._getAimPosition()
        });

        EventBus.emit('player-stats-updated', this.stats);

        // Brief cast state
        this.state = 'casting';
        this.scene.time.delayedCall(200, () => {
            if (this.state === 'casting') this.state = 'idle';
        });
    }

    _getAimPosition() {
        const pointer = this.scene.input.activePointer;
        return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    }

    // ----------------------------------------------------------------
    // Damage
    // ----------------------------------------------------------------

    takeDamage(amount, element) {
        if (this.invincible || this.state === 'dead') return;

        // Apply resistance
        const resistance = this.stats.resistances[element] || 0;
        const finalDamage = Math.max(1, Math.round(amount * (1 - resistance)));

        this.stats.hp = Math.max(0, this.stats.hp - finalDamage);

        // Invincibility frames
        this.invincible = true;
        this.invincibleTimer = 0.5;

        EventBus.emit('player-stats-updated', this.stats);
        EventBus.emit('player-damaged', { damage: finalDamage, element, hp: this.stats.hp });

        if (this.stats.hp <= 0) {
            this.state = 'dead';
            EventBus.emit('player-defeated', { player: this.sprite });
        } else {
            this.state = 'hurt';
            this.scene.time.delayedCall(200, () => {
                if (this.state === 'hurt') this.state = 'idle';
            });
        }
    }

    // ----------------------------------------------------------------
    // Healing
    // ----------------------------------------------------------------

    heal(amount) {
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
        EventBus.emit('player-stats-updated', this.stats);
        EventBus.emit('player-healed', { amount, hp: this.stats.hp });
    }

    // ----------------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------------

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get position() { return { x: this.sprite.x, y: this.sprite.y }; }

    destroy() {
        this.sprite.destroy();
    }
}
