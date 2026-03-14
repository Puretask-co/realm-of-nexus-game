import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';
import { SaveManager } from '../systems/SaveManager.js';

/**
 * TitleScene - Main menu and class selection screen.
 * Players choose their class before entering the game world.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    const W = GameConfig.WIDTH;
    const H = GameConfig.HEIGHT;
    this.classSystem = PlayerClassSystem.getInstance();

    // ─── Background ────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Animated particle background
    this.bgParticles = [];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const size = 1 + Math.random() * 2;
      const alpha = 0.1 + Math.random() * 0.4;
      const colors = [0x4a9eff, 0xff4a4a, 0xccccee, 0x44cc44];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dot = this.add.circle(x, y, size, color, alpha);
      dot._speed = 0.2 + Math.random() * 0.5;
      dot._baseY = y;
      this.bgParticles.push(dot);
    }

    // ─── Title ─────────────────────────────────────────────────
    const titleText = this.add.text(W / 2, 80, 'REALM OF NEXUS', {
      fontSize: '48px', fill: '#4a9eff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#1a1a4e', strokeThickness: 6
    }).setOrigin(0.5);

    const subtitleText = this.add.text(W / 2, 125, 'Where Sap Shapes Destiny', {
      fontSize: '16px', fill: '#8888bb', fontFamily: 'monospace', fontStyle: 'italic'
    }).setOrigin(0.5);

    // Pulse title
    this.tweens.add({
      targets: titleText,
      alpha: { from: 0.8, to: 1 },
      scaleX: { from: 1, to: 1.02 },
      scaleY: { from: 1, to: 1.02 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // ─── Class Selection ───────────────────────────────────────
    this.add.text(W / 2, 175, 'Choose Your Path', {
      fontSize: '20px', fill: '#ffaa00', fontFamily: 'monospace'
    }).setOrigin(0.5);

    const classes = this.classSystem.getAllClasses();
    const cardWidth = 260;
    const cardHeight = 300;
    const gap = 20;
    const totalWidth = classes.length * cardWidth + (classes.length - 1) * gap;
    const startX = W / 2 - totalWidth / 2;

    this.classCards = [];
    this.selectedClassId = null;

    for (let i = 0; i < classes.length; i++) {
      const classDef = classes[i];
      const x = startX + i * (cardWidth + gap);
      const y = 210;
      const card = this.createClassCard(x, y, cardWidth, cardHeight, classDef);
      this.classCards.push({ card, classDef });
    }

    // ─── Bottom Buttons ────────────────────────────────────────
    this.startBtn = this.createMenuButton(W / 2, H - 80, 'Start Adventure', 0x44aa44, () => {
      if (this.selectedClassId) {
        this.startGame();
      }
    });
    this.startBtn.setAlpha(0.3);

    // Continue button (if save exists)
    const saveManager = SaveManager.getInstance();
    if (saveManager.hasSave && saveManager.hasSave()) {
      this.createMenuButton(W / 2, H - 35, 'Continue', 0x4a9eff, () => {
        this.continueGame();
      });
    }

    // Version text
    this.add.text(W - 10, H - 10, 'v0.3.0', {
      fontSize: '10px', fill: '#333344', fontFamily: 'monospace'
    }).setOrigin(1, 1);
  }

  createClassCard(x, y, w, h, classDef) {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.9);
    bg.fillRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(2, 0x4a4a6e, 0.5);
    bg.strokeRoundedRect(0, 0, w, h, 8);
    container.add(bg);

    // Color accent strip at top
    const accent = this.add.graphics();
    accent.fillStyle(classDef.color, 0.8);
    accent.fillRect(0, 0, w, 4);
    container.add(accent);

    // Class icon (large letter)
    const iconBg = this.add.circle(w / 2, 50, 30, classDef.color, 0.3);
    container.add(iconBg);
    const iconText = this.add.text(w / 2, 50, classDef.name.charAt(0), {
      fontSize: '32px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(iconText);

    // Class name
    const nameText = this.add.text(w / 2, 90, classDef.name, {
      fontSize: '16px',
      fill: `#${classDef.color.toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(nameText);

    // Phase affinity
    const affinityLabel = classDef.phaseAffinity
      ? `${classDef.phaseAffinity.toUpperCase()} Phase`
      : 'All Phases';
    const affinityText = this.add.text(w / 2, 110, affinityLabel, {
      fontSize: '10px', fill: '#888888', fontFamily: 'monospace'
    }).setOrigin(0.5);
    container.add(affinityText);

    // Description
    const descText = this.add.text(w / 2, 135, classDef.description, {
      fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace',
      wordWrap: { width: w - 24 }, align: 'center', lineSpacing: 2
    }).setOrigin(0.5, 0);
    container.add(descText);

    // Stats preview
    const stats = classDef.baseStats;
    const statY = 220;
    const statPairs = [
      { label: 'HP', value: stats.maxHp, color: '#44dd44' },
      { label: 'SAP', value: stats.maxSap, color: '#4a9eff' },
      { label: 'ATK', value: stats.atk, color: '#ff8844' },
      { label: 'DEF', value: stats.def, color: '#88aacc' },
      { label: 'MAG', value: stats.mag, color: '#aa88ff' },
      { label: 'SPD', value: stats.speed, color: '#44ff88' }
    ];

    for (let j = 0; j < statPairs.length; j++) {
      const sx = 15 + (j % 3) * 80;
      const sy = statY + Math.floor(j / 3) * 20;
      this.add.text(0, 0, `${statPairs[j].label}:${statPairs[j].value}`, {
        fontSize: '10px', fill: statPairs[j].color, fontFamily: 'monospace'
      }).setPosition(0, 0);

      const statLabel = this.add.text(sx, sy, `${statPairs[j].label}: ${statPairs[j].value}`, {
        fontSize: '10px', fill: statPairs[j].color, fontFamily: 'monospace'
      });
      container.add(statLabel);
    }

    // Starting spells
    const spellsText = this.add.text(w / 2, h - 30, `Starts with: ${classDef.startingSpells.join(', ')}`, {
      fontSize: '9px', fill: '#666688', fontFamily: 'monospace',
      wordWrap: { width: w - 20 }, align: 'center'
    }).setOrigin(0.5);
    container.add(spellsText);

    // Make interactive
    const hitZone = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x222244, 0.95);
      bg.fillRoundedRect(0, 0, w, h, 8);
      bg.lineStyle(2, classDef.color, 0.7);
      bg.strokeRoundedRect(0, 0, w, h, 8);
    });

    hitZone.on('pointerout', () => {
      if (this.selectedClassId !== classDef.id) {
        bg.clear();
        bg.fillStyle(0x1a1a2e, 0.9);
        bg.fillRoundedRect(0, 0, w, h, 8);
        bg.lineStyle(2, 0x4a4a6e, 0.5);
        bg.strokeRoundedRect(0, 0, w, h, 8);
      }
    });

    hitZone.on('pointerdown', () => {
      this.selectClass(classDef.id);
    });

    container._bg = bg;
    container._classDef = classDef;
    return container;
  }

  selectClass(classId) {
    this.selectedClassId = classId;

    // Update card visuals
    for (const { card, classDef } of this.classCards) {
      const bg = card._bg;
      const w = 260;
      const h = 300;
      bg.clear();

      if (classDef.id === classId) {
        bg.fillStyle(0x222244, 0.95);
        bg.fillRoundedRect(0, 0, w, h, 8);
        bg.lineStyle(3, classDef.color, 1);
        bg.strokeRoundedRect(0, 0, w, h, 8);

        // Glow effect
        this.tweens.add({
          targets: card,
          scaleX: 1.03, scaleY: 1.03,
          duration: 200,
          ease: 'Back.easeOut'
        });
      } else {
        bg.fillStyle(0x1a1a2e, 0.7);
        bg.fillRoundedRect(0, 0, w, h, 8);
        bg.lineStyle(1, 0x4a4a6e, 0.3);
        bg.strokeRoundedRect(0, 0, w, h, 8);

        this.tweens.add({
          targets: card,
          scaleX: 1, scaleY: 1,
          duration: 200
        });
      }
    }

    // Enable start button
    if (this.startBtn) {
      this.startBtn.setAlpha(1);
    }
  }

  createMenuButton(x, y, text, color, onClick) {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.3);
    bg.fillRoundedRect(-120, -18, 240, 36, 6);
    bg.lineStyle(1, color, 0.6);
    bg.strokeRoundedRect(-120, -18, 240, 36, 6);
    container.add(bg);

    const label = this.add.text(0, 0, text, {
      fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace'
    }).setOrigin(0.5);
    container.add(label);

    container.setSize(240, 36).setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color, 0.5);
      bg.fillRoundedRect(-120, -18, 240, 36, 6);
      bg.lineStyle(2, color, 1);
      bg.strokeRoundedRect(-120, -18, 240, 36, 6);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 0.3);
      bg.fillRoundedRect(-120, -18, 240, 36, 6);
      bg.lineStyle(1, color, 0.6);
      bg.strokeRoundedRect(-120, -18, 240, 36, 6);
    });

    container.on('pointerdown', onClick);

    return container;
  }

  startGame() {
    if (!this.selectedClassId) return;

    this.classSystem.selectClass(this.selectedClassId);

    // Fade out transition
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }

  continueGame() {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { loadSave: true });
    });
  }

  update(time) {
    // Animate background particles
    for (const dot of this.bgParticles) {
      dot.y = dot._baseY + Math.sin(time * 0.001 * dot._speed) * 15;
      dot.x -= dot._speed * 0.3;
      if (dot.x < -5) dot.x = GameConfig.WIDTH + 5;
    }
  }
}

export default TitleScene;
