import { EventBus } from '../core/EventBus.js';

/**
 * Enemy component — encapsulates a single enemy entity.
 *
 * Wraps a Phaser.Physics.Arcade.Sprite with:
 *  - Stats derived from enemy definition data
 *  - Health bar rendered above the sprite
 *  - Hit flash effect on damage
 *  - Death sequence with event emission
 *
 * AI behaviour is driven externally by AISystem;
 * this component only handles per-entity state and rendering.
 */
export class Enemy {
  constructor(scene, x, y, definition) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.definition = definition;
    this.id = definition.id + '_' + Math.random().toString(36).slice(2, 6);

    // Physics sprite (placeholder if no texture)
    if (scene.textures.exists('enemy')) {
      this.sprite = scene.physics.add.sprite(x, y, 'enemy');
    } else {
      const tierColors = { 1: 0xff6644, 2: 0xff4444, 3: 0xcc22cc, 4: 0xff2222 };
      this.sprite = scene.add.rectangle(x, y, 28, 28, tierColors[definition.tier] || 0xff4444);
      scene.physics.add.existing(this.sprite);
    }

    this.sprite.setDepth(4);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.owner = this;

    // ─── Stats from definition ─────────────────────────────────
    // Support both flat format (health/damage/defense/speed) and nested baseStats format
    const base = definition.baseStats || {};
    this.stats = {
      hp: base.hp || definition.health || 50,
      maxHp: base.hp || definition.health || 50,
      atk: base.attack || definition.damage || 10,
      def: base.defense || definition.defense || 5,
      agi: base.speed || definition.speed || 80,
      speed: base.speed || definition.speed || 80,
      sapPool: base.sapPool || 30
    };

    // AI config
    this.ai = definition.ai || { behavior: 'aggressive' };
    this.abilities = definition.abilities || [];
    this.sapPhaseVulnerability = definition.sapPhaseVulnerability || null;
    this.experienceReward = definition.experienceReward || 0;
    this.lootTable = definition.lootTable || [];

    // Name
    this.name = definition.name || 'Enemy';

    // Active effects
    this.activeEffects = [];

    // Spawn origin (for leash/patrol)
    this.spawnX = x;
    this.spawnY = y;

    // ─── Health Bar ────────────────────────────────────────────
    this.healthBarBg = scene.add.graphics().setDepth(10);
    this.healthBarFill = scene.add.graphics().setDepth(10);

    // Name tag
    this.nameTag = scene.add.text(x, y - 26, this.name, {
      fontSize: '10px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);

    this.drawHealthBar();
  }

  // ─── Health Bar ──────────────────────────────────────────────────

  drawHealthBar() {
    const barWidth = 36;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 20;

    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x222222, 0.8);
    this.healthBarBg.fillRect(x, y, barWidth, barHeight);

    this.healthBarFill.clear();
    const hpPercent = Math.max(0, this.stats.hp / this.stats.maxHp);
    const barColor = hpPercent > 0.5 ? 0x44dd44 : hpPercent > 0.25 ? 0xddaa00 : 0xff4444;
    this.healthBarFill.fillStyle(barColor, 1);
    this.healthBarFill.fillRect(x, y, barWidth * hpPercent, barHeight);
  }

  // ─── Damage ──────────────────────────────────────────────────────

  takeDamage(amount, source = null) {
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.drawHealthBar();

    // Hit flash
    if (this.sprite.setFillStyle) {
      const origColor = this.sprite.fillColor;
      this.sprite.setFillStyle(0xffffff);
      this.scene.time.delayedCall(80, () => {
        if (this.sprite.active) this.sprite.setFillStyle(origColor);
      });
    } else {
      this.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(80, () => {
        if (this.sprite.active) this.sprite.clearTint();
      });
    }

    this.eventBus.emit('combat:damage', {
      target: { id: this.id, name: this.name, hp: this.stats.hp, maxHp: this.stats.maxHp },
      source,
      damage: amount
    });

    if (this.stats.hp <= 0) {
      this.die(source);
    }
  }

  // ─── Death ───────────────────────────────────────────────────────

  die(source = null) {
    this.eventBus.emit('enemy-defeated', {
      enemy: this,
      definition: this.definition,
      source,
      experienceReward: this.experienceReward,
      lootTable: this.lootTable,
      x: this.sprite.x,
      y: this.sprite.y
    });

    // Clean up visuals
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.nameTag.destroy();
    this.sprite.destroy();
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(delta) {
    if (this.stats.hp <= 0) return;

    // Sync health bar and name tag position
    this.drawHealthBar();
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 26);
  }

  // ─── Position Helpers ────────────────────────────────────────────

  get x() { return this.sprite.x; }
  set x(val) { this.sprite.x = val; }
  get y() { return this.sprite.y; }
  set y(val) { this.sprite.y = val; }
  get position() { return { x: this.sprite.x, y: this.sprite.y }; }

  get active() { return this.sprite.active && this.stats.hp > 0; }

  destroy() {
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.nameTag.destroy();
    this.sprite.destroy();
  }
}

export default Enemy;
