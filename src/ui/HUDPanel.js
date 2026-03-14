import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * HUDPanel - In-game heads-up display showing player health, sap, experience,
 * minimap, active quest tracker, quick slots, and Sap Cycle indicator.
 */
export class HUDPanel {
  constructor(scene, uiFramework) {
    this.scene = scene;
    this.ui = uiFramework;
    this.eventBus = EventBus.getInstance();
    this.container = scene.add.container(0, 0).setDepth(8000).setScrollFactor(0);
    this.visible = true;

    this.build();
    this.setupEventListeners();
  }

  build() {
    const W = GameConfig.WIDTH;
    const H = GameConfig.HEIGHT;

    // ─── Health Bar ───────────────────────────────────────────────
    this.healthBar = this.ui.createProgressBar(15, 15, {
      width: 220, height: 22, value: 100, maxValue: 100,
      barColor: 0x44dd44, label: '', showText: true,
      textFormat: (v, m) => `HP: ${Math.round(v)} / ${m}`
    });
    this.container.add(this.healthBar);

    // ─── Sap Bar ──────────────────────────────────────────────────
    this.sapBar = this.ui.createProgressBar(15, 42, {
      width: 220, height: 18, value: 80, maxValue: 100,
      barColor: 0x4a9eff, showText: true,
      textFormat: (v, m) => `SAP: ${Math.round(v)} / ${m}`
    });
    this.container.add(this.sapBar);

    // ─── Experience Bar ───────────────────────────────────────────
    this.xpBar = this.ui.createProgressBar(15, 65, {
      width: 220, height: 10, value: 0, maxValue: 100,
      barColor: 0xffaa00, showText: false
    });
    this.container.add(this.xpBar);

    // Level display
    this.levelText = this.scene.add.text(240, 58, 'Lv.1', {
      fontSize: '12px', fill: '#ffaa00', fontFamily: 'monospace'
    });
    this.container.add(this.levelText);

    // ─── Sap Cycle Indicator ──────────────────────────────────────
    this.sapPhaseContainer = this.scene.add.container(W / 2, 20);
    this.container.add(this.sapPhaseContainer);

    const sapPhaseBg = this.scene.add.graphics();
    sapPhaseBg.fillStyle(0x1a1a2e, 0.85);
    sapPhaseBg.fillRoundedRect(-70, -12, 140, 28, 14);
    sapPhaseBg.lineStyle(1, 0x4a4a6e, 0.5);
    sapPhaseBg.strokeRoundedRect(-70, -12, 140, 28, 14);
    this.sapPhaseContainer.add(sapPhaseBg);

    // Phase dots
    const phaseColors = { blue: 0x4a9eff, crimson: 0xff4a4a, silver: 0xccccee };
    const phasePositions = [
      { phase: 'blue', x: -35 },
      { phase: 'crimson', x: 0 },
      { phase: 'silver', x: 35 }
    ];

    this.phaseDots = {};
    for (const p of phasePositions) {
      const dot = this.scene.add.circle(p.x, 2, 8, phaseColors[p.phase], 0.4);
      this.sapPhaseContainer.add(dot);
      this.phaseDots[p.phase] = dot;
    }
    // Highlight current phase
    this.setActiveSapPhase('blue');

    this.sapPhaseText = this.scene.add.text(0, 20, 'Blue Phase', {
      fontSize: '10px', fill: '#4a9eff', fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.sapPhaseContainer.add(this.sapPhaseText);

    // ─── Quick Slots ──────────────────────────────────────────────
    this.quickSlots = [];
    const slotStartX = W / 2 - 100;
    const slotY = H - 60;

    for (let i = 0; i < 4; i++) {
      const slot = this.ui.createSlot(slotStartX + i * 54, slotY, {
        size: 48, slotIndex: i,
        onClick: (idx) => this.eventBus.emit('quickslot:used', { index: idx })
      });
      this.container.add(slot);
      this.quickSlots.push(slot);

      // Key label
      const keyLabel = this.scene.add.text(slotStartX + i * 54 + 24, slotY - 8, `${i + 1}`, {
        fontSize: '10px', fill: '#888888', fontFamily: 'monospace'
      }).setOrigin(0.5);
      this.container.add(keyLabel);
    }

    // ─── Quest Tracker ────────────────────────────────────────────
    this.questTrackerContainer = this.scene.add.container(W - 20, 80);
    this.container.add(this.questTrackerContainer);

    this.questTrackerBg = this.scene.add.graphics();
    this.questTrackerBg.fillStyle(0x1a1a2e, 0.7);
    this.questTrackerBg.fillRoundedRect(-260, 0, 260, 120, 6);
    this.questTrackerContainer.add(this.questTrackerBg);

    this.questTrackerTitle = this.scene.add.text(-248, 8, 'Active Quest', {
      fontSize: '12px', fill: '#ffaa00', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.questTrackerContainer.add(this.questTrackerTitle);

    this.questTrackerText = this.scene.add.text(-248, 26, 'No active quests', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace',
      wordWrap: { width: 240 }
    });
    this.questTrackerContainer.add(this.questTrackerText);

    // ─── Minimap placeholder ──────────────────────────────────────
    this.minimapContainer = this.scene.add.container(W - 90, 220);
    this.container.add(this.minimapContainer);

    const minimapBg = this.scene.add.graphics();
    minimapBg.fillStyle(0x1a1a2e, 0.7);
    minimapBg.fillRoundedRect(-70, 0, 140, 140, 6);
    minimapBg.lineStyle(1, 0x4a4a6e, 0.5);
    minimapBg.strokeRoundedRect(-70, 0, 140, 140, 6);
    this.minimapContainer.add(minimapBg);

    const minimapLabel = this.scene.add.text(0, 145, 'Minimap', {
      fontSize: '10px', fill: '#666666', fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.minimapContainer.add(minimapLabel);
  }

  setupEventListeners() {
    this.eventBus.on('player:healthChanged', (data) => {
      this.healthBar.setValue(data.current, data.max);
    });

    this.eventBus.on('player:sapChanged', (data) => {
      this.sapBar.setValue(data.current, data.max);
    });

    this.eventBus.on('player:experienceGained', (data) => {
      this.xpBar.setValue(data.current, data.toNextLevel);
    });

    this.eventBus.on('player:levelUp', (data) => {
      this.levelText.setText(`Lv.${data.level}`);
      this.ui.notify(`Level Up! You are now level ${data.level}`, { type: 'success' });
    });

    this.eventBus.on('sapCycle:phaseChanged', (data) => {
      this.setActiveSapPhase(data.phase);
    });

    this.eventBus.on('quest:started', (data) => this.updateQuestTracker(data));
    this.eventBus.on('quest:objectiveUpdated', (data) => this.updateQuestTracker(data));
    this.eventBus.on('quest:completed', (data) => {
      this.ui.notify(`Quest Complete: ${data.name}`, { type: 'quest' });
      this.questTrackerText.setText('No active quests');
    });
  }

  setActiveSapPhase(phase) {
    const phaseColors = { blue: '#4a9eff', crimson: '#ff4a4a', silver: '#ccccee' };
    const phaseNames = { blue: 'Blue Phase', crimson: 'Crimson Phase', silver: 'Silver Phase' };

    for (const [key, dot] of Object.entries(this.phaseDots)) {
      dot.setAlpha(key === phase ? 1 : 0.3);
      dot.setScale(key === phase ? 1.3 : 1);
    }

    this.sapPhaseText.setText(phaseNames[phase] || phase);
    this.sapPhaseText.setColor(phaseColors[phase] || '#ffffff');

    // Update sap bar color based on phase
    const barColors = { blue: 0x4a9eff, crimson: 0xff4a4a, silver: 0xccccee };
    // Will need to re-render bar with new color
  }

  updateQuestTracker(data) {
    if (data.name) {
      this.questTrackerTitle.setText(data.name);
    }
    if (data.objectives) {
      const lines = data.objectives.map(obj => {
        const check = obj.completed ? '[x]' : '[ ]';
        return `${check} ${obj.description} (${obj.current || 0}/${obj.required})`;
      });
      this.questTrackerText.setText(lines.join('\n'));
    } else if (data.current !== undefined) {
      // Update existing objective text
      this.questTrackerText.setText(
        `Progress: ${data.current}/${data.required}`
      );
    }
  }

  setVisible(visible) {
    this.visible = visible;
    this.container.setVisible(visible);
  }

  onShow() { }
  onHide() { }

  destroy() {
    this.container.destroy(true);
  }
}

export default HUDPanel;
