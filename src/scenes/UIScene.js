import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * UIScene - Parallel HUD overlay scene that runs alongside GameScene.
 * Renders health/sap bars, spell cooldown slots, Sap Cycle indicator,
 * minimap placeholder, and combo counter.
 *
 * Launched by GameScene as a parallel scene so HUD elements are
 * always screen-fixed and don't scroll with the game camera.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    const W = GameConfig.WIDTH;
    const H = GameConfig.HEIGHT;

    // ─── Health Bar ──────────────────────────────────────────────
    this.healthBarBg = this.add.rectangle(125, 20, 220, 16, 0x222222, 0.8).setOrigin(0, 0.5);
    this.healthBarFill = this.add.rectangle(125, 20, 220, 16, 0x44dd44, 1).setOrigin(0, 0.5);
    this.healthText = this.add.text(15, 20, 'HP:', {
      fontSize: '12px', fill: '#44dd44', fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.healthValueText = this.add.text(235, 20, '100/100', {
      fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace'
    }).setOrigin(0.5, 0.5);

    // ─── Sap Bar ─────────────────────────────────────────────────
    this.sapBarBg = this.add.rectangle(125, 42, 220, 12, 0x222222, 0.8).setOrigin(0, 0.5);
    this.sapBarFill = this.add.rectangle(125, 42, 220, 12, 0x4488ff, 1).setOrigin(0, 0.5);
    this.sapText = this.add.text(15, 42, 'SAP:', {
      fontSize: '12px', fill: '#4488ff', fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    // ─── XP Bar ──────────────────────────────────────────────────
    this.xpBarBg = this.add.rectangle(125, 60, 220, 6, 0x222222, 0.6).setOrigin(0, 0.5);
    this.xpBarFill = this.add.rectangle(125, 60, 0, 6, 0xffaa00, 1).setOrigin(0, 0.5);
    this.levelText = this.add.text(15, 60, 'Lv.1', {
      fontSize: '10px', fill: '#ffaa00', fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    // ─── Sap Cycle Phase Indicator ───────────────────────────────
    this.phaseIndicatorBg = this.add.rectangle(W - 90, 25, 160, 40, 0x111122, 0.8).setOrigin(0.5);
    this.phaseLabel = this.add.text(W - 90, 15, 'BLUE PHASE', {
      fontSize: '12px', fill: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.phaseTimer = this.add.text(W - 90, 33, '120s', {
      fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace'
    }).setOrigin(0.5);

    // ─── Spell Slots (1-5) ──────────────────────────────────────
    this.spellSlots = [];
    const slotStartX = W / 2 - 120;
    const slotY = H - 40;

    for (let i = 0; i < 5; i++) {
      const x = slotStartX + i * 55;
      const bg = this.add.rectangle(x, slotY, 44, 44, 0x222244, 0.8).setStrokeStyle(1, 0x4a9eff, 0.5);
      const keyLabel = this.add.text(x - 18, slotY - 18, `${i + 1}`, {
        fontSize: '8px', fill: '#666666', fontFamily: 'monospace'
      });
      const nameLabel = this.add.text(x, slotY, '', {
        fontSize: '8px', fill: '#cccccc', fontFamily: 'monospace', align: 'center'
      }).setOrigin(0.5);
      const cdOverlay = this.add.rectangle(x, slotY, 44, 0, 0x000000, 0.6).setOrigin(0.5, 1);

      this.spellSlots.push({ bg, keyLabel, nameLabel, cdOverlay });
    }

    // ─── Combo Counter ───────────────────────────────────────────
    this.comboText = this.add.text(W / 2, H - 80, '', {
      fontSize: '18px', fill: '#ffaa00', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);

    // ─── Event Listeners ─────────────────────────────────────────
    this.eventBus.on('player-stats-updated', (stats) => this.updatePlayerStats(stats));
    this.eventBus.on('phase-changed', (data) => this.updatePhaseIndicator(data));
    this.eventBus.on('phase-transition', (data) => this.updatePhaseTransition(data));
    this.eventBus.on('sap-changed', (data) => this.updateSapDisplay(data));
    this.eventBus.on('combat:combo', (data) => this.showCombo(data));
    this.eventBus.on('combat:comboReset', () => this.hideCombo());
  }

  // ─── Update Methods ──────────────────────────────────────────────

  updatePlayerStats(stats) {
    if (!stats) return;

    // Health bar
    const hpPercent = Math.max(0, stats.hp / stats.maxHp);
    this.healthBarFill.setDisplaySize(220 * hpPercent, 16);
    const hpColor = hpPercent > 0.5 ? 0x44dd44 : hpPercent > 0.25 ? 0xddaa00 : 0xff4444;
    this.healthBarFill.setFillStyle(hpColor);
    this.healthValueText.setText(`${Math.round(stats.hp)}/${stats.maxHp}`);

    // Sap bar
    if (stats.sap !== undefined && stats.maxSap) {
      const sapPercent = Math.max(0, stats.sap / stats.maxSap);
      this.sapBarFill.setDisplaySize(220 * sapPercent, 12);
    }
  }

  updatePhaseIndicator(data) {
    const phaseColors = {
      blue: '#4488ff',
      crimson: '#ff4444',
      silver: '#ccccff'
    };
    const color = phaseColors[data.phase] || '#ffffff';
    this.phaseLabel.setText(`${data.phase.toUpperCase()} PHASE`);
    this.phaseLabel.setColor(color);
  }

  updatePhaseTransition(data) {
    // Pulse effect during transition
    const alpha = 0.5 + Math.sin(data.progress * Math.PI) * 0.5;
    this.phaseIndicatorBg.setAlpha(alpha);
  }

  updateSapDisplay(data) {
    if (data.current !== undefined && data.max) {
      const percent = data.current / data.max;
      this.sapBarFill.setDisplaySize(220 * percent, 12);
    }
  }

  showCombo(data) {
    this.comboText.setText(`${data.count}x COMBO`);
    this.comboText.setAlpha(1);
    this.comboText.setScale(1.3);
    this.tweens.add({
      targets: this.comboText,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  hideCombo() {
    this.tweens.add({
      targets: this.comboText,
      alpha: 0,
      duration: 300
    });
  }

  update(time, delta) {
    // Update phase timer display
    // (SapCycleManager status is read via event, but we can also poll)
  }
}

export default UIScene;
