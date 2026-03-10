import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { DataManager } from '../systems/DataManager.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';

/**
 * Player component — encapsulates player entity logic.
 *
 * Wraps a Phaser.Physics.Arcade.Sprite with:
 *  - Stats management (HP, Sap, Attack, Defense, Speed)
 *  - Movement with 8-directional control and diagonal normalization
 *  - Dash ability (SPACE — short burst of speed with cooldown)
 *  - Spell casting (keys 1-5) via EventBus
 *  - Invincibility frames after taking damage
 *  - Animation state machine (idle, walk, cast, hurt, death)
 *  - Sap regeneration tied to the current phase
 *
 * All communication is through EventBus — no direct system references.
 */
export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // Create physics sprite (uses placeholder if no texture loaded)
    if (scene.textures.exists('player')) {
      this.sprite = scene.physics.add.sprite(x, y, 'player');
    } else {
      // Placeholder colored rectangle
      this.sprite = scene.add.rectangle(x, y, 24, 32, 0x4a9eff);
      scene.physics.add.existing(this.sprite);
    }

    this.sprite.setDepth(5);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setDamping(true);
    this.sprite.body.setDrag(0.85);
    this.sprite.body.setMaxVelocity(280);
    this.sprite.owner = this;

    // ─── Stats ────────────────────────────────────────────────────
    const dataManager = DataManager.getInstance();
    const config = dataManager.getConfig('balance.player') || {};

    // Default stats (overridden by class selection)
    this.stats = {
      hp: config.startingHp || 100,
      maxHp: config.startingHp || 100,
      sap: config.startingSap || 100,
      maxSap: config.startingSap || 100,
      atk: 10,
      def: 5,
      agi: 8,
      mag: 10,
      speed: 200,
      critChance: 0.05,
      critDamage: 0,
      dodge: 0,
      block: 0,
      resistances: {}
    };

    // Apply class stats if a class has been selected
    this.classSystem = PlayerClassSystem.getInstance();
    if (this.classSystem.getCurrentClass()) {
      this.stats = this.classSystem.applyClassStats(this.stats);
      this.sapRegenRate = this.stats.sapRegenRate || this.sapRegenRate;
    }

    // ─── Spells ───────────────────────────────────────────────────
    this.spells = [];       // Spell definitions assigned to slots 0-4
    this.cooldowns = {};    // spellId → ready timestamp

    // ─── State ────────────────────────────────────────────────────
    this.state = 'idle';    // idle | walking | casting | hurt | dead
    this.facing = 'down';   // up | down | left | right
    this.invincible = false;
    this.invincibleTimer = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0;
    this.isDashing = false;

    // Sap regen (may have been set by class system above)
    if (!this.sapRegenRate) {
      this.sapRegenRate = config.sapRegenRate || 5;
    }

    // Listen for level-up to apply class growth
    this.eventBus.on('player:levelUp', (data) => {
      if (this.classSystem.getCurrentClass()) {
        this.stats = this.classSystem.applyLevelUpGrowth(this.stats, data.level);
        this.eventBus.emit('player-stats-updated', this.stats);
      }
    });

    // Input references (set in setupInput)
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

    // Spell keys 1-5
    this.scene.input.keyboard.on('keydown-ONE', () => this.castSpell(0));
    this.scene.input.keyboard.on('keydown-TWO', () => this.castSpell(1));
    this.scene.input.keyboard.on('keydown-THREE', () => this.castSpell(2));
    this.scene.input.keyboard.on('keydown-FOUR', () => this.castSpell(3));
    this.scene.input.keyboard.on('keydown-FIVE', () => this.castSpell(4));

    // Interact
    this.scene.input.keyboard.on('keydown-E', () => {
      this.eventBus.emit('player:interact', {
        x: this.sprite.x,
        y: this.sprite.y,
        facing: this.facing
      });
    });
  }

  /**
   * Equip starting spells from DataManager.
   */
  equipStartingSpells() {
    const dataManager = DataManager.getInstance();

    // Use class-specific starting spells if a class is selected
    const classDef = this.classSystem.getCurrentClass();
    let startingIds;
    if (classDef) {
      startingIds = [...this.classSystem.getStartingSpells()];
      // Fill remaining spell slots (up to 5) with next available class spells
      const available = this.classSystem.getAvailableSpells(1);
      for (const spellId of available) {
        if (startingIds.length >= 5) break;
        if (!startingIds.includes(spellId)) startingIds.push(spellId);
      }
    } else {
      startingIds = ['temporal_bolt', 'crimson_flare', 'silver_shield', 'verdant_heal', 'sap_surge'];
    }

    for (const id of startingIds) {
      const spell = dataManager.getSpell(id);
      if (spell) this.spells.push(spell);
    }
  }

  // ─── Update (called each frame) ─────────────────────────────────

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
        this.sprite.setAlpha(Math.sin(this.invincibleTimer * 15) > 0 ? 1 : 0.3);
      }
    }

    // Dash timer
    if (this.isDashing) {
      this.dashDuration -= dt;
      if (this.dashDuration <= 0) {
        this.isDashing = false;
        this.sprite.body.setMaxVelocity(280);
      }
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    // Movement
    this.handleMovement();

    // Sap regeneration
    if (this.stats.sap < this.stats.maxSap) {
      this.stats.sap = Math.min(this.stats.maxSap, this.stats.sap + this.sapRegenRate * dt);
    }

    // Cooldown ticking
    const now = this.scene.time.now;
    for (const spellId of Object.keys(this.cooldowns)) {
      if (this.cooldowns[spellId] <= now) {
        delete this.cooldowns[spellId];
      }
    }
  }

  handleMovement() {
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

    this.sprite.body.setVelocity(vx, vy);
    this.state = (vx !== 0 || vy !== 0) ? 'walking' : 'idle';
  }

  // ─── Dash ───────────────────────────────────────────────────────

  dash() {
    if (this.isDashing || this.dashCooldown > 0 || this.state === 'dead') return;

    this.isDashing = true;
    this.dashDuration = 0.15;  // 150ms burst
    this.dashCooldown = 1.0;   // 1s cooldown
    this.sprite.body.setMaxVelocity(600);

    this.eventBus.emit('player:dash', {
      x: this.sprite.x,
      y: this.sprite.y,
      facing: this.facing
    });
  }

  // ─── Spell Casting ──────────────────────────────────────────────

  castSpell(index) {
    if (this.state === 'dead') return;

    const spell = this.spells[index];
    if (!spell) return;

    // Cooldown check
    const now = this.scene.time.now;
    if (this.cooldowns[spell.id] && now < this.cooldowns[spell.id]) return;

    // Sap cost check
    if (this.stats.sap < spell.sapCost) return;

    // Consume Sap
    this.stats.sap -= spell.sapCost;

    // Set cooldown
    this.cooldowns[spell.id] = now + spell.cooldown * 1000;

    // Emit for SpellSystem and VFX
    this.eventBus.emit('spell-cast', {
      spell,
      spellId: spell.id,
      caster: this,
      casterStats: this.stats,
      targetPos: this.getAimPosition()
    });

    this.eventBus.emit('player-stats-updated', this.stats);

    // Brief cast state
    this.state = 'casting';
    this.scene.time.delayedCall(200, () => {
      if (this.state === 'casting') this.state = 'idle';
    });
  }

  getAimPosition() {
    const pointer = this.scene.input.activePointer;
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  // ─── Damage & Healing ──────────────────────────────────────────

  takeDamage(amount, element) {
    if (this.invincible || this.state === 'dead') return;

    const resistance = this.stats.resistances[element] || 0;
    const finalDamage = Math.max(1, Math.round(amount * (1 - resistance)));
    this.stats.hp = Math.max(0, this.stats.hp - finalDamage);

    // Invincibility frames
    this.invincible = true;
    this.invincibleTimer = 0.5;

    this.eventBus.emit('player-stats-updated', this.stats);
    this.eventBus.emit('player:damaged', {
      damage: finalDamage,
      element,
      hp: this.stats.hp
    });

    if (this.stats.hp <= 0) {
      this.state = 'dead';
      this.eventBus.emit('player:defeated', { player: this });
    } else {
      this.state = 'hurt';
      this.scene.time.delayedCall(200, () => {
        if (this.state === 'hurt') this.state = 'idle';
      });
    }
  }

  heal(amount) {
    const prev = this.stats.hp;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    this.eventBus.emit('player-stats-updated', this.stats);
    this.eventBus.emit('player:healed', { amount: this.stats.hp - prev, hp: this.stats.hp });
  }

  // ─── Position Helpers ──────────────────────────────────────────

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get position() { return { x: this.sprite.x, y: this.sprite.y }; }

  destroy() {
    this.sprite.destroy();
  }
}

export default Player;
