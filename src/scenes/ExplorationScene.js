// src/scenes/ExplorationScene.js
// Main exploration scene with Sap Cycle, rest system, and combat transitions
// Integrates: SapCycleManager, SapCycleUI, RestManager, and world navigation

import SapCycleManager from '../systems/SapCycleManager.js';
import SapCycleUI from '../ui/SapCycleUI.js';
import RestManager from '../systems/RestManager.js';

export default class ExplorationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ExplorationScene' });
  }

  init(data) {
    this.playerData = data && data.playerData ? data.playerData : {
      name: 'Verdant Warden',
      hp: 100,
      maxHp: 100,
      dsp: 50,
      maxDsp: 100,
      attack: 15,
      defense: 10,
      agility: 12,
      exp: 0,
      gold: 0,
    };
  }

  create() {
    // Background
    this.add.rectangle(400, 300, 800, 600, 0x1a3a1a);

    // Player representation
    this.player = this.add.rectangle(400, 300, 32, 32, 0x88ff88);
    this.player.setStrokeStyle(3, 0x44aa44);
    this.player.stats = { ...this.playerData };

    // Initialize Sap Cycle
    this.sapCycle = new SapCycleManager(this);

    this.sapCycle.addEventListener('phase-start', (data) => {
      this.onPhaseChange(data);
    });
    this.sapCycle.addEventListener('day-advance', (data) => {
      this.onDayAdvance(data);
    });
    this.sapCycle.addEventListener('phase-event', (event) => {
      this.showPhaseTransitionEvent(event);
    });
    this.sapCycle.addEventListener('random-event', (event) => {
      this.showRandomEvent(event);
    });

    // Initialize Sap Cycle UI
    this.sapCycleUI = new SapCycleUI(this, this.sapCycle);

    // Initialize Rest Manager
    this.restManager = new RestManager(this);
    this.restManager.setLocation({ name: 'Canopy of Life', isSafe: true });

    // Create UI buttons
    this.createRestButton();
    this.createCombatTestButton();

    // Player stats display
    this.createPlayerStatsDisplay();

    // Location label
    this.locationLabel = this.add.text(400, 560, 'Location: Canopy of Life', {
      fontSize: '16px',
      color: '#AAFFAA',
    });
    this.locationLabel.setOrigin(0.5);

    // Debug key: advance day
    this.input.keyboard.on('keydown-D', () => {
      this.sapCycle.advanceDay();
      this.updatePlayerStatsDisplay();
    });

    // Fade in
    this.cameras.main.fadeIn(500);
  }

  // --- UI Creation ---

  createRestButton() {
    const button = this.add.rectangle(700, 540, 120, 40, 0x4a7c59, 0.9);
    button.setStrokeStyle(2, 0x88cc88);
    button.setDepth(100);

    const text = this.add.text(700, 540, 'Rest', {
      fontSize: '18px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(101);

    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setFillStyle(0x5a8c69));
    button.on('pointerout', () => button.setFillStyle(0x4a7c59));
    button.on('pointerdown', () => this.openRestMenu());
  }

  createCombatTestButton() {
    const button = this.add.rectangle(700, 490, 120, 40, 0x994444, 0.9);
    button.setStrokeStyle(2, 0xcc6666);
    button.setDepth(100);

    const text = this.add.text(700, 490, 'Fight', {
      fontSize: '18px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(101);

    button.setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setFillStyle(0xaa5555));
    button.on('pointerout', () => button.setFillStyle(0x994444));
    button.on('pointerdown', () => this.startTestCombat());
  }

  createPlayerStatsDisplay() {
    const x = 560;
    const y = 100;
    const bg = this.add.rectangle(x + 80, y + 50, 200, 100, 0x1a2a1a, 0.85);
    bg.setStrokeStyle(2, 0x4a7c59);
    bg.setDepth(90);

    this.statsText = this.add.text(
      x + 10,
      y + 10,
      this.getStatsString(),
      {
        fontSize: '13px',
        color: '#FFFFFF',
        lineSpacing: 4,
      }
    );
    this.statsText.setDepth(91);
  }

  getStatsString() {
    const s = this.player.stats;
    return `HP: ${s.hp}/${s.maxHp}\nDSP: ${s.dsp}/${s.maxDsp}\nATK: ${s.attack}  DEF: ${s.defense}\nEXP: ${s.exp || 0}  Gold: ${s.gold || 0}`;
  }

  updatePlayerStatsDisplay() {
    if (this.statsText) {
      this.statsText.setText(this.getStatsString());
    }
  }

  // --- Rest System ---

  openRestMenu() {
    if (!this.restManager.canRest()) {
      this.showMessage('Cannot rest here!', 0xff6666);
      return;
    }

    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setDepth(200);

    const menuBg = this.add.rectangle(400, 300, 500, 380, 0x2d4a3e, 0.95);
    menuBg.setStrokeStyle(4, 0x88cc88);
    menuBg.setDepth(201);

    const title = this.add.text(400, 140, 'Choose Rest Duration', {
      fontSize: '28px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(202);

    const elements = [overlay, menuBg, title];

    ['SHORT_REST', 'LONG_REST', 'FULL_REST'].forEach((restType, index) => {
      const config = this.restManager.restTypes[restType];
      const yPos = 230 + index * 80;

      const btn = this.add.rectangle(400, yPos, 440, 60, 0x4a7c59, 0.9);
      btn.setStrokeStyle(3, 0x88cc88);
      btn.setDepth(202);

      const btnText = this.add.text(400, yPos - 10, config.name, {
        fontSize: '20px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      });
      btnText.setOrigin(0.5);
      btnText.setDepth(203);

      const desc = this.add.text(400, yPos + 12, config.description, {
        fontSize: '11px',
        color: '#CCCCCC',
        align: 'center',
      });
      desc.setOrigin(0.5);
      desc.setDepth(203);

      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x5a8c69));
      btn.on('pointerout', () => btn.setFillStyle(0x4a7c59));
      btn.on('pointerdown', () => {
        elements.forEach((el) => el.destroy());
        [btn, btnText, desc].forEach((el) => el.destroy());
        cancelBtn.destroy();
        cancelText.destroy();
        this.restManager.startRest(restType);
      });

      elements.push(btn, btnText, desc);
    });

    const cancelBtn = this.add.rectangle(400, 470, 200, 40, 0x666666, 0.9);
    cancelBtn.setStrokeStyle(2, 0x999999);
    cancelBtn.setDepth(202);
    const cancelText = this.add.text(400, 470, 'Cancel', {
      fontSize: '18px',
      color: '#FFFFFF',
    });
    cancelText.setOrigin(0.5);
    cancelText.setDepth(203);
    cancelBtn.setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => {
      elements.forEach((el) => el.destroy());
      cancelBtn.destroy();
      cancelText.destroy();
    });
  }

  showRestScreen(config, onComplete) {
    this.cameras.main.fadeOut(800, 0, 0, 0);

    this.time.delayedCall(800, () => {
      const restOverlay = this.add.rectangle(400, 300, 800, 600, 0x0a0a0a, 1.0);
      restOverlay.setDepth(300);

      const fireLight = this.add.circle(400, 350, 120, 0xff6600, 0.15);
      fireLight.setDepth(300);
      this.tweens.add({
        targets: fireLight,
        alpha: { from: 0.15, to: 0.08 },
        scale: { from: 1.0, to: 1.1 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const restText = this.add.text(400, 150, `${config.name}...`, {
        fontSize: '42px',
        color: '#FFAA66',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      });
      restText.setOrigin(0.5);
      restText.setDepth(302);
      restText.setAlpha(0);
      this.tweens.add({ targets: restText, alpha: 1, duration: 1500 });

      const progressText = this.add.text(400, 450, 'Advancing time...', {
        fontSize: '18px',
        color: '#CCCCCC',
        fontStyle: 'italic',
      });
      progressText.setOrigin(0.5);
      progressText.setDepth(302);

      this.tweens.add({
        targets: progressText,
        alpha: { from: 0.3, to: 0.8 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });

      this.time.delayedCall(config.duration, () => {
        this.tweens.add({
          targets: [restOverlay, fireLight, restText, progressText],
          alpha: 0,
          duration: 800,
          onComplete: () => {
            [restOverlay, fireLight, restText, progressText].forEach((el) => el.destroy());
          },
        });
        this.cameras.main.fadeIn(800);
        this.time.delayedCall(800, () => onComplete());
      });
    });
  }

  showRestResults(results) {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setDepth(300);

    const panel = this.add.rectangle(400, 300, 400, 300, 0x2d4a3e, 0.95);
    panel.setStrokeStyle(4, 0x88cc88);
    panel.setDepth(301);

    const title = this.add.text(400, 180, 'Rest Complete', {
      fontSize: '30px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(302);

    let text = `HP Restored: +${results.hpRestored}\nDSP Restored: +${results.dspRestored}\n\nDays Advanced: ${results.daysAdvanced}\nCurrent Phase: ${results.newPhase}`;
    if (results.phaseChanged) {
      text += `\n\nPhase changed to ${results.newPhase}!`;
    }

    const info = this.add.text(400, 290, text, {
      fontSize: '16px',
      color: '#FFFFFF',
      align: 'center',
      lineSpacing: 6,
    });
    info.setOrigin(0.5);
    info.setDepth(302);

    const continueBtn = this.add.rectangle(400, 410, 180, 45, 0x4a7c59, 0.9);
    continueBtn.setStrokeStyle(3, 0x88cc88);
    continueBtn.setDepth(302);
    const btnText = this.add.text(400, 410, 'Continue', {
      fontSize: '22px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    btnText.setOrigin(0.5);
    btnText.setDepth(303);

    continueBtn.setInteractive({ useHandCursor: true });
    continueBtn.on('pointerdown', () => {
      [overlay, panel, title, info, continueBtn, btnText].forEach((el) => el.destroy());
      this.updatePlayerStatsDisplay();
    });
  }

  // --- Combat ---

  startTestCombat() {
    const phaseInfo = this.sapCycle.getCurrentPhaseInfo();

    this.cameras.main.fadeOut(500);
    this.time.delayedCall(500, () => {
      this.scene.start('CombatScene', {
        player: { ...this.player.stats },
        enemies: null, // use defaults
        terrain: 'forest',
        canEscape: true,
        sapPhase: phaseInfo.phase,
        phaseModifiers: phaseInfo.modifiers,
      });
    });
  }

  // --- Phase Event Handlers ---

  onPhaseChange(data) {
    if (this.sapCycleUI) {
      this.sapCycleUI.updatePhase(data.phase);
      const info = this.sapCycle.getCurrentPhaseInfo();
      this.sapCycleUI.updateDay(info.day, info.duration);
    }
  }

  onDayAdvance(data) {
    if (this.sapCycleUI) {
      this.sapCycleUI.updateDay(data.phaseDay, this.sapCycle.currentPhaseDuration);
    }
  }

  showPhaseTransitionEvent(event) {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
    overlay.setDepth(350);

    const color = event.type === 'major' ? 0xcc88ff : 0x88cc88;
    const panel = this.add.rectangle(400, 300, 500, 220, 0x2d4a3e, 0.95);
    panel.setStrokeStyle(5, color);
    panel.setDepth(351);

    const title = this.add.text(400, 230, event.title, {
      fontSize: event.type === 'major' ? '36px' : '28px',
      color: event.type === 'major' ? '#FFCC88' : '#AAFFAA',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    title.setOrigin(0.5);
    title.setDepth(352);

    const message = this.add.text(400, 290, event.message, {
      fontSize: '18px',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 450 },
    });
    message.setOrigin(0.5);
    message.setDepth(352);

    this.time.delayedCall(1500, () => {
      const btn = this.add.rectangle(400, 360, 150, 40, 0x666666, 0.9);
      btn.setStrokeStyle(2, 0xaaaaaa);
      btn.setDepth(352);
      const btnText = this.add.text(400, 360, 'Continue', {
        fontSize: '18px',
        color: '#FFFFFF',
      });
      btnText.setOrigin(0.5);
      btnText.setDepth(353);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        [overlay, panel, title, message, btn, btnText].forEach((el) => el.destroy());
      });
    });
  }

  showRandomEvent(event) {
    // Apply event effect
    if (event.effectType && this.player && this.player.stats) {
      switch (event.effectType) {
        case 'dsp_gain':
          this.player.stats.dsp = Math.min(
            this.player.stats.dsp + event.effectValue,
            this.player.stats.maxDsp
          );
          break;
        case 'hp_loss':
          this.player.stats.hp = Math.max(
            this.player.stats.hp - event.effectValue,
            1
          );
          break;
        case 'hp_gain':
          this.player.stats.hp = Math.min(
            this.player.stats.hp + event.effectValue,
            this.player.stats.maxHp
          );
          break;
        case 'exp_gain':
          this.player.stats.exp =
            (this.player.stats.exp || 0) + event.effectValue;
          break;
        case 'full_restore':
          this.player.stats.hp = this.player.stats.maxHp;
          this.player.stats.dsp = this.player.stats.maxDsp;
          break;
      }
      this.updatePlayerStatsDisplay();
    }

    // Show notification
    const bg = this.add.rectangle(400, 80, 450, 80, 0x3a4a3a, 0.95);
    bg.setStrokeStyle(3, 0xaacc88);
    bg.setDepth(360);

    const title = this.add.text(400, 60, event.title, {
      fontSize: '18px',
      color: '#FFDD88',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(361);

    const msg = this.add.text(400, 88, event.message, {
      fontSize: '14px',
      color: '#FFFFFF',
      wordWrap: { width: 430 },
    });
    msg.setOrigin(0.5);
    msg.setDepth(361);

    // Slide in
    const container = this.add.container(0, -100, [bg, title, msg]);
    container.setDepth(360);
    this.tweens.add({
      targets: container,
      y: 0,
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: container,
        y: -100,
        duration: 400,
        onComplete: () => container.destroy(),
      });
    });
  }

  showMessage(text, color) {
    const colorObj = Phaser.Display.Color.IntegerToColor(color);
    const message = this.add.text(400, 50, text, {
      fontSize: '20px',
      color: colorObj.rgba,
      stroke: '#000000',
      strokeThickness: 4,
    });
    message.setOrigin(0.5);
    message.setDepth(400);

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: 30,
      duration: 500,
      delay: 2000,
      onComplete: () => message.destroy(),
    });
  }

  showPhaseNotification(title, message, color) {
    this.showPhaseTransitionEvent({
      title,
      message,
      type: 'normal',
    });
  }
}
