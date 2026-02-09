// src/scenes/ExplorationScene.js
// Main exploration scene with Sap Cycle, rest system, and combat transitions
// Integrates: SapCycleManager, SapCycleUI, RestManager, SeedManager, AllyManager

import SapCycleManager from '../systems/SapCycleManager.js';
import SapCycleUI from '../ui/SapCycleUI.js';
import RestManager from '../systems/RestManager.js';
import SeedManager from '../systems/SeedManager.js';
import AllyManager from '../systems/AllyManager.js';

export default class ExplorationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ExplorationScene' });
  }

  init(data) {
    this.playerData =
      data && data.playerData
        ? data.playerData
        : {
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

    // Store ally HP data from combat return
    this.returnedAllyHpData = data && data.allyHpData ? data.allyHpData : null;
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
      if (data.phase === 'SILVER') {
        this.seedManager.unbindAllSeeds();
      }
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

    // Initialize Seed Manager
    this.seedManager = new SeedManager(this, this.sapCycle);

    // Initialize Ally Manager
    this.allyManager = new AllyManager(this);

    // Apply returned ally HP data from combat
    if (this.returnedAllyHpData) {
      this.returnedAllyHpData.forEach((allyHp) => {
        const ally = this.allyManager.getAlly(allyHp.id);
        if (ally) {
          ally.currentHp = allyHp.currentHp;
          ally.isAlive = allyHp.isAlive;
        }
      });
    }

    // Create UI buttons
    this.createRestButton();
    this.createCombatTestButton();
    this.createPlantSeedsButton();

    // Player stats display
    this.createPlayerStatsDisplay();

    // Create ally panel UI
    this.createAllyPanel();

    // Location label
    this.locationLabel = this.add.text(
      400,
      560,
      'Location: Canopy of Life',
      {
        fontSize: '16px',
        color: '#AAFFAA',
      }
    );
    this.locationLabel.setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-D', () => {
      this.sapCycle.advanceDay();
      this.updatePlayerStatsDisplay();
    });

    this.input.keyboard.on('keydown-R', () => {
      if (this.restManager.canRest()) {
        this.openRestMenu();
      }
    });

    this.input.keyboard.on('keydown-P', () => {
      if (this.sapCycle.currentPhase === 'CRIMSON') {
        this.openSeedMenu();
      }
    });

    this.input.keyboard.on('keydown-A', () => {
      if (this.allyPanelElements) {
        const visible = this.allyPanelElements.bg.visible;
        this.allyPanelElements.bg.setVisible(!visible);
        this.allyPanelElements.title.setVisible(!visible);
        this.allyPanelElements.countText.setVisible(!visible);
        this.allyListContainer.setVisible(!visible);
      }
    });

    this.input.keyboard.on('keydown-H', () => {
      this.showHelpOverlay();
    });

    // Initialize tutorial
    this.initTutorial();

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
    button.on('pointerover', () => {
      button.setFillStyle(0x5a8c69);
      button.setScale(1.05);
      text.setScale(1.05);
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x4a7c59);
      button.setScale(1.0);
      text.setScale(1.0);
    });
    button.on('pointerdown', () => this.openRestMenu());

    this.restButton = { button, text };
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

  createPlantSeedsButton() {
    const button = this.add.rectangle(580, 540, 150, 40, 0x8b4513, 0.9);
    button.setStrokeStyle(2, 0xcc8844);
    button.setDepth(100);

    const text = this.add.text(580, 540, 'Plant Seeds', {
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(101);

    button.setInteractive({ useHandCursor: true });

    button.on('pointerover', () => {
      button.setFillStyle(0xaa6633);
      button.setScale(1.05);
      text.setScale(1.05);
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x8b4513);
      button.setScale(1.0);
      text.setScale(1.0);
    });

    button.on('pointerdown', () => {
      this.openSeedMenu();
    });

    // Only visible during CRIMSON phase
    button.setVisible(this.sapCycle.currentPhase === 'CRIMSON');
    text.setVisible(this.sapCycle.currentPhase === 'CRIMSON');

    this.plantSeedsButton = { button, text };
  }

  createPlayerStatsDisplay() {
    const x = 560;
    const y = 100;
    const bg = this.add.rectangle(x + 80, y + 50, 200, 100, 0x1a2a1a, 0.85);
    bg.setStrokeStyle(2, 0x4a7c59);
    bg.setDepth(90);

    this.statsText = this.add.text(x + 10, y + 10, this.getStatsString(), {
      fontSize: '13px',
      color: '#FFFFFF',
      lineSpacing: 4,
    });
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

  // --- Ally Panel ---

  createAllyPanel() {
    const panelX = 50;
    const panelY = 250;

    const panelBg = this.add.rectangle(
      panelX + 120,
      panelY + 150,
      260,
      320,
      0x1a2a1a,
      0.85
    );
    panelBg.setStrokeStyle(3, 0x88cc88);
    panelBg.setOrigin(0, 0);
    panelBg.setDepth(100);

    const title = this.add.text(panelX + 130, panelY + 160, 'ALLIES', {
      fontSize: '18px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setDepth(101);

    this.allyCountText = this.add.text(
      panelX + 130,
      panelY + 185,
      `0 / ${this.allyManager.maxAllies}`,
      {
        fontSize: '14px',
        color: '#CCCCCC',
      }
    );
    this.allyCountText.setDepth(101);

    this.allyListContainer = this.add.container(0, 0);
    this.allyListContainer.setDepth(102);

    this.allyPanelElements = {
      bg: panelBg,
      title: title,
      countText: this.allyCountText,
      listContainer: this.allyListContainer,
    };

    this.updateAllyPanel();
  }

  updateAllyPanel() {
    if (!this.allyPanelElements) return;

    const allies = this.allyManager.getAllies();

    this.allyCountText.setText(
      `${allies.length} / ${this.allyManager.maxAllies}`
    );

    this.allyListContainer.removeAll(true);

    const startY = 270;
    const entryHeight = 50;

    allies.forEach((ally, index) => {
      const y = startY + index * entryHeight;

      const entryBg = this.add.rectangle(
        180,
        y,
        230,
        45,
        ally.isAlive ? 0x2a3a2a : 0x3a2a2a,
        0.8
      );
      entryBg.setStrokeStyle(2, ally.isAlive ? 0x66aa66 : 0xaa6666);

      const icon = this.add.text(
        75,
        y,
        this.seedManager.seedTypes[ally.type]
          ? this.seedManager.seedTypes[ally.type].icon
          : '?',
        {
          fontSize: '24px',
        }
      );
      icon.setOrigin(0.5);

      const nameText = this.add.text(110, y - 10, ally.name, {
        fontSize: '12px',
        color: ally.isAlive ? '#FFFFFF' : '#888888',
        fontStyle: 'bold',
      });
      nameText.setOrigin(0, 0.5);

      const hpBarBg = this.add.rectangle(110, y + 8, 130, 10, 0x333333);
      hpBarBg.setOrigin(0, 0.5);

      const hpPercentage = ally.currentHp / ally.maxHp;
      const hpBarFill = this.add.rectangle(
        110,
        y + 8,
        130 * hpPercentage,
        10,
        ally.isAlive ? 0x66ff66 : 0xff6666
      );
      hpBarFill.setOrigin(0, 0.5);

      const hpText = this.add.text(
        250,
        y + 8,
        `${ally.currentHp}/${ally.maxHp}`,
        {
          fontSize: '10px',
          color: '#FFFFFF',
        }
      );
      hpText.setOrigin(0, 0.5);

      entryBg.setInteractive({ useHandCursor: true });

      entryBg.on('pointerover', () => {
        entryBg.setFillStyle(ally.isAlive ? 0x3a4a3a : 0x4a3a3a);
        this.showAllyTooltip(ally, 180, y);
      });

      entryBg.on('pointerout', () => {
        entryBg.setFillStyle(ally.isAlive ? 0x2a3a2a : 0x3a2a2a);
        this.hideAllyTooltip();
      });

      entryBg.on('pointerdown', () => {
        this.selectAlly(ally);
      });

      this.allyListContainer.add([
        entryBg,
        icon,
        nameText,
        hpBarBg,
        hpBarFill,
        hpText,
      ]);
    });
  }

  showAllyTooltip(ally, x, y) {
    if (this.allyTooltip) {
      this.hideAllyTooltip();
    }

    const tooltipBg = this.add.rectangle(
      x + 150,
      y,
      180,
      100,
      0x1a1a1a,
      0.95
    );
    tooltipBg.setStrokeStyle(2, ally.isAlive ? 0x88cc88 : 0xcc8888);
    tooltipBg.setDepth(110);

    const statsText = this.add.text(
      x + 150,
      y - 25,
      `HP: ${ally.stats.hp}\nATK: ${ally.stats.attack}\nDEF: ${ally.stats.defense}\nType: ${ally.stats.type}`,
      {
        fontSize: '11px',
        color: '#FFFFFF',
        lineSpacing: 4,
      }
    );
    statsText.setOrigin(0.5);
    statsText.setDepth(111);

    const statusText = this.add.text(
      x + 150,
      y + 35,
      ally.isAlive ? 'Ready' : 'Fallen',
      {
        fontSize: '12px',
        color: ally.isAlive ? '#88FF88' : '#FF8888',
        fontStyle: 'italic',
      }
    );
    statusText.setOrigin(0.5);
    statusText.setDepth(111);

    this.allyTooltip = [tooltipBg, statsText, statusText];
  }

  hideAllyTooltip() {
    if (this.allyTooltip) {
      this.allyTooltip.forEach((el) => el.destroy());
      this.allyTooltip = null;
    }
  }

  selectAlly(ally) {
    console.log(`Selected ally: ${ally.name}`);

    this.allyManager.selectedAlly = ally;

    if (ally.sprite) {
      this.tweens.add({
        targets: ally.sprite,
        alpha: { from: 1, to: 0.5 },
        duration: 200,
        yoyo: true,
        repeat: 2,
      });

      this.cameras.main.pan(ally.sprite.x, ally.sprite.y, 500, 'Power2');
    }

    this.showMessage(`Selected: ${ally.name}`, 0x88ff88);
  }

  // --- Rest System ---

  openRestMenu() {
    if (this.restManager.isResting) {
      this.showMessage('Already resting!', 0xff6666);
      return;
    }

    if (!this.restManager.canRest()) {
      this.showMessage('Cannot rest here - find a safe location!', 0xff6666);
      return;
    }

    this.showRestOptions();
  }

  showRestOptions() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setDepth(200);

    const menuBg = this.add.rectangle(400, 300, 500, 400, 0x2d4a3e, 0.95);
    menuBg.setStrokeStyle(4, 0x88cc88);
    menuBg.setDepth(201);

    const title = this.add.text(400, 140, 'Choose Rest Duration', {
      fontSize: '32px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(202);

    const elements = [overlay, menuBg, title];

    const restTypes = ['SHORT_REST', 'LONG_REST', 'FULL_REST'];

    restTypes.forEach((restType, index) => {
      const config = this.restManager.restTypes[restType];
      const yPos = 230 + index * 90;

      const btn = this.add.rectangle(400, yPos, 450, 70, 0x4a7c59, 0.9);
      btn.setStrokeStyle(3, 0x88cc88);
      btn.setDepth(202);

      const btnText = this.add.text(400, yPos - 12, config.name, {
        fontSize: '22px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      });
      btnText.setOrigin(0.5);
      btnText.setDepth(203);

      const desc = this.add.text(400, yPos + 12, config.description, {
        fontSize: '12px',
        color: '#CCCCCC',
        align: 'center',
        wordWrap: { width: 420 },
      });
      desc.setOrigin(0.5);
      desc.setDepth(203);

      btn.setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => {
        btn.setFillStyle(0x5a8c69);
        btn.setScale(1.02);
        btnText.setScale(1.02);
        desc.setScale(1.02);
      });

      btn.on('pointerout', () => {
        btn.setFillStyle(0x4a7c59);
        btn.setScale(1.0);
        btnText.setScale(1.0);
        desc.setScale(1.0);
      });

      btn.on('pointerdown', () => {
        elements.forEach((el) => el.destroy());
        [btn, btnText, desc].forEach((el) => el.destroy());
        cancelBtn.destroy();
        cancelText.destroy();
        this.restManager.startRest(restType);
      });

      elements.push(btn, btnText, desc);
    });

    const cancelBtn = this.add.rectangle(400, 480, 200, 45, 0x666666, 0.9);
    cancelBtn.setStrokeStyle(2, 0x999999);
    cancelBtn.setDepth(202);

    const cancelText = this.add.text(400, 480, 'Cancel', {
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

    elements.push(cancelBtn, cancelText);
  }

  showRestScreen(config, onComplete) {
    console.log(`Showing rest screen for ${config.name}`);

    this.cameras.main.fadeOut(1000, 0, 0, 0);

    this.time.delayedCall(1000, () => {
      this.createRestVisuals(config, onComplete);
    });
  }

  createRestVisuals(config, onComplete) {
    const restOverlay = this.add.rectangle(
      400,
      300,
      800,
      600,
      0x0a0a0a,
      1.0
    );
    restOverlay.setDepth(300);

    // Flickering light effect
    const fireLight = this.add.circle(400, 350, 150, 0xff6600, 0.3);
    fireLight.setDepth(300);

    this.tweens.add({
      targets: fireLight,
      alpha: { from: 0.3, to: 0.15 },
      scale: { from: 1.0, to: 1.1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Campfire placeholder (rectangle since no sprite available)
    const campfire = this.add.rectangle(400, 350, 24, 24, 0xff6600);
    campfire.setStrokeStyle(2, 0xff9933);
    campfire.setDepth(301);

    // Resting text
    const restText = this.add.text(400, 150, `${config.name}...`, {
      fontSize: '48px',
      color: '#FFAA66',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    restText.setOrigin(0.5);
    restText.setDepth(302);
    restText.setAlpha(0);

    this.tweens.add({
      targets: restText,
      alpha: 1,
      duration: 1500,
      ease: 'Power2',
    });

    // Progress indicator
    const progressText = this.add.text(400, 450, 'Advancing time...', {
      fontSize: '20px',
      color: '#CCCCCC',
      fontStyle: 'italic',
    });
    progressText.setOrigin(0.5);
    progressText.setDepth(302);
    progressText.setAlpha(0);

    this.tweens.add({
      targets: progressText,
      alpha: { from: 0, to: 0.7 },
      duration: 800,
      delay: 500,
      yoyo: true,
      repeat: -1,
    });

    // Particle embers
    const embers = this.add.particles(400, 380, 'fire_particle', {
      speed: { min: 20, max: 60 },
      angle: { min: 260, max: 280 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 2000,
      frequency: 100,
      tint: [0xff6600, 0xff9933, 0xffcc66],
      blendMode: 'ADD',
    });
    embers.setDepth(301);

    // Show days advancing
    this.showDaysAdvancing(config.daysAdvanced);

    // Complete rest after duration
    this.time.delayedCall(config.duration, () => {
      this.tweens.add({
        targets: [restOverlay, campfire, fireLight, restText, progressText],
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          [restOverlay, campfire, fireLight, restText, progressText].forEach(
            (el) => el.destroy()
          );
          embers.destroy();
        },
      });

      this.cameras.main.fadeIn(1000);

      this.time.delayedCall(1000, () => {
        onComplete();
      });
    });

    this.restVisuals = {
      overlay: restOverlay,
      campfire: campfire,
      light: fireLight,
      text: restText,
      progress: progressText,
      embers: embers,
    };
  }

  showDaysAdvancing(daysCount) {
    let currentDay = 0;

    const showDayNumber = () => {
      currentDay++;

      if (currentDay > daysCount) return;

      const dayText = this.add.text(
        400,
        250,
        `Day ${currentDay} of ${daysCount}`,
        {
          fontSize: '24px',
          color: '#FFDD88',
          fontStyle: 'bold',
        }
      );
      dayText.setOrigin(0.5);
      dayText.setDepth(302);
      dayText.setAlpha(0);

      this.tweens.add({
        targets: dayText,
        alpha: 0.8,
        duration: 400,
        yoyo: true,
        onComplete: () => {
          dayText.destroy();
        },
      });

      this.time.delayedCall(1000, () => {
        showDayNumber();
      });
    };

    this.time.delayedCall(1000, () => {
      showDayNumber();
    });
  }

  showRestResults(results) {
    console.log('Rest results:', results);

    const resultsOverlay = this.add.rectangle(
      400,
      300,
      800,
      600,
      0x000000,
      0.7
    );
    resultsOverlay.setDepth(300);
    resultsOverlay.setAlpha(0);

    this.tweens.add({
      targets: resultsOverlay,
      alpha: 0.7,
      duration: 500,
    });

    const resultsBg = this.add.rectangle(
      400,
      300,
      500,
      350,
      0x2d4a3e,
      0.95
    );
    resultsBg.setStrokeStyle(4, 0x88cc88);
    resultsBg.setDepth(301);
    resultsBg.setScale(0);

    this.tweens.add({
      targets: resultsBg,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(300, () => {
      const title = this.add.text(400, 160, 'Rest Complete', {
        fontSize: '36px',
        color: '#AAFFAA',
        fontStyle: 'bold',
      });
      title.setOrigin(0.5);
      title.setDepth(302);

      let text = `HP Restored: +${results.hpRestored}\nDSP Restored: +${results.dspRestored}\n\nDays Advanced: ${results.daysAdvanced}\nCurrent Phase: ${results.newPhase}`;

      const resultsText = this.add.text(400, 240, text, {
        fontSize: '20px',
        color: '#FFFFFF',
        align: 'center',
        lineSpacing: 10,
      });
      resultsText.setOrigin(0.5);
      resultsText.setDepth(302);

      // Phase warning if changed
      let phaseWarning = null;
      if (results.phaseChanged) {
        phaseWarning = this.add.text(
          400,
          360,
          `Sap Phase changed to ${results.newPhase}!`,
          {
            fontSize: '16px',
            color: '#FFAA66',
            fontStyle: 'italic',
          }
        );
        phaseWarning.setOrigin(0.5);
        phaseWarning.setDepth(302);
      }

      this.time.delayedCall(800, () => {
        const continueBtn = this.add.rectangle(
          400,
          420,
          200,
          50,
          0x4a7c59,
          0.9
        );
        continueBtn.setStrokeStyle(3, 0x88cc88);
        continueBtn.setDepth(302);

        const btnText = this.add.text(400, 420, 'Continue', {
          fontSize: '24px',
          color: '#FFFFFF',
          fontStyle: 'bold',
        });
        btnText.setOrigin(0.5);
        btnText.setDepth(303);

        continueBtn.setInteractive({ useHandCursor: true });

        continueBtn.on('pointerover', () => {
          continueBtn.setFillStyle(0x5a8c69);
          continueBtn.setScale(1.05);
          btnText.setScale(1.05);
        });

        continueBtn.on('pointerout', () => {
          continueBtn.setFillStyle(0x4a7c59);
          continueBtn.setScale(1.0);
          btnText.setScale(1.0);
        });

        continueBtn.on('pointerdown', () => {
          [
            resultsOverlay,
            resultsBg,
            title,
            resultsText,
            continueBtn,
            btnText,
          ].forEach((el) => el.destroy());
          if (phaseWarning) phaseWarning.destroy();
          this.updatePlayerStatsDisplay();
        });
      });
    });
  }

  // --- Seed Planting ---

  openSeedMenu() {
    if (!this.seedManager.canPlantSeeds()) {
      if (this.sapCycle.currentPhase !== 'CRIMSON') {
        this.showMessage(
          'Can only plant seeds during CRIMSON phase!',
          0xff6666
        );
      } else {
        this.showMessage('Maximum seeds already planted!', 0xff6666);
      }
      return;
    }

    this.showSeedSelectionMenu();
  }

  showSeedSelectionMenu() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setDepth(200);

    const menuBg = this.add.rectangle(400, 300, 600, 450, 0x2d4a3e, 0.95);
    menuBg.setStrokeStyle(4, 0x88cc88);
    menuBg.setDepth(201);

    const title = this.add.text(400, 90, 'Select Seed to Plant', {
      fontSize: '32px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(202);

    const seedCount = this.add.text(
      400,
      130,
      `Seeds Planted: ${this.seedManager.plantedSeeds.length} / ${this.seedManager.maxSeedsPerPhase}`,
      {
        fontSize: '16px',
        color: '#CCCCCC',
      }
    );
    seedCount.setOrigin(0.5);
    seedCount.setDepth(202);

    const elements = [overlay, menuBg, title, seedCount];

    const seedTypes = Object.keys(this.seedManager.seedTypes);

    seedTypes.forEach((seedType, index) => {
      const config = this.seedManager.seedTypes[seedType];
      const hasSeed = this.seedManager.hasSeed(seedType);
      const canAfford = this.seedManager.canAffordSeed(seedType);
      const available = hasSeed && canAfford;

      const row = Math.floor(index / 2);
      const col = index % 2;

      const xPos = 250 + col * 300;
      const yPos = 200 + row * 120;

      const btn = this.add.rectangle(
        xPos,
        yPos,
        280,
        100,
        available ? 0x4a7c59 : 0x333333,
        0.9
      );
      btn.setStrokeStyle(3, available ? 0x88cc88 : 0x666666);
      btn.setDepth(202);

      const icon = this.add.text(xPos - 110, yPos, config.icon, {
        fontSize: '40px',
      });
      icon.setOrigin(0.5);
      icon.setDepth(203);

      const nameText = this.add.text(xPos - 50, yPos - 20, config.name, {
        fontSize: '18px',
        color: available ? '#FFFFFF' : '#888888',
        fontStyle: 'bold',
      });
      nameText.setOrigin(0, 0.5);
      nameText.setDepth(203);

      const costText = this.add.text(xPos - 50, yPos + 5, `DSP: ${config.cost}`, {
        fontSize: '14px',
        color: canAfford ? '#88AAFF' : '#FF6666',
      });
      costText.setOrigin(0, 0.5);
      costText.setDepth(203);

      const invCount = this.add.text(
        xPos - 50,
        yPos + 25,
        `Owned: ${this.seedManager.playerSeeds[seedType] || 0}`,
        {
          fontSize: '12px',
          color: '#CCCCCC',
        }
      );
      invCount.setOrigin(0, 0.5);
      invCount.setDepth(203);

      if (available) {
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
          btn.setFillStyle(0x5a8c69);
          btn.setScale(1.03);
          [icon, nameText, costText, invCount].forEach((el) =>
            el.setScale(1.03)
          );
          this.showSeedTooltip(config, xPos, yPos - 60);
        });

        btn.on('pointerout', () => {
          btn.setFillStyle(0x4a7c59);
          btn.setScale(1.0);
          [icon, nameText, costText, invCount].forEach((el) =>
            el.setScale(1.0)
          );
          this.hideSeedTooltip();
        });

        btn.on('pointerdown', () => {
          elements.forEach((el) => el.destroy());
          [btn, icon, nameText, costText, invCount].forEach((el) =>
            el.destroy()
          );
          this.hideSeedTooltip();

          this.seedManager.selectSeedForPlanting(seedType);
        });
      }

      elements.push(btn, icon, nameText, costText, invCount);
    });

    const cancelBtn = this.add.rectangle(400, 510, 200, 45, 0x666666, 0.9);
    cancelBtn.setStrokeStyle(2, 0x999999);
    cancelBtn.setDepth(202);

    const cancelText = this.add.text(400, 510, 'Cancel', {
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
      this.hideSeedTooltip();
    });

    this.seedMenuElements = [...elements, cancelBtn, cancelText];
  }

  showSeedTooltip(config, x, y) {
    if (this.seedTooltip) {
      this.hideSeedTooltip();
    }

    const tooltipBg = this.add.rectangle(x, y, 250, 80, 0x1a1a1a, 0.95);
    tooltipBg.setStrokeStyle(2, config.color);
    tooltipBg.setDepth(210);

    const desc = this.add.text(x, y - 15, config.description, {
      fontSize: '12px',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 230 },
    });
    desc.setOrigin(0.5);
    desc.setDepth(211);

    const stats = this.add.text(
      x,
      y + 20,
      `HP: ${config.stats.hp} | ATK: ${config.stats.attack} | DEF: ${config.stats.defense}`,
      {
        fontSize: '11px',
        color: '#CCCCCC',
      }
    );
    stats.setOrigin(0.5);
    stats.setDepth(211);

    this.seedTooltip = [tooltipBg, desc, stats];
  }

  hideSeedTooltip() {
    if (this.seedTooltip) {
      this.seedTooltip.forEach((el) => el.destroy());
      this.seedTooltip = null;
    }
  }

  showPlantingMode(seedType) {
    const config = this.seedManager.seedTypes[seedType];

    console.log(`Entering planting mode for ${config.name}`);

    // Create placement preview cursor
    this.plantingCursor = this.add.container(0, 0);
    this.plantingCursor.setDepth(150);

    const preview = this.add.circle(0, 0, 10, config.color, 0.6);
    preview.setStrokeStyle(2, config.color);

    const previewGlow = this.add.circle(0, 0, 20, config.color, 0.3);

    const previewIcon = this.add.text(0, -25, config.icon, {
      fontSize: '24px',
    });
    previewIcon.setOrigin(0.5);

    this.plantingCursor.add([previewGlow, preview, previewIcon]);

    // Instruction text
    this.plantingInstruction = this.add.text(
      400,
      30,
      `Click to plant ${config.name} | Right-click to cancel`,
      {
        fontSize: '18px',
        color: '#FFDD88',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#00000088',
        padding: { x: 10, y: 5 },
      }
    );
    this.plantingInstruction.setOrigin(0.5);
    this.plantingInstruction.setDepth(200);

    // Update cursor position on pointer move
    this.input.on('pointermove', this.updatePlantingCursor, this);

    // Plant on click
    this.input.on('pointerdown', this.onPlantingClick, this);
  }

  updatePlantingCursor(pointer) {
    if (!this.plantingCursor) return;

    this.plantingCursor.setPosition(pointer.worldX, pointer.worldY);

    const validation = this.seedManager.validatePlacement(
      pointer.worldX,
      pointer.worldY
    );

    const color = validation.valid ? 0x88ff88 : 0xff6666;
    this.plantingCursor.list[0].setFillStyle(color, 0.3); // Glow
    this.plantingCursor.list[1].setFillStyle(color, 0.6); // Circle
    this.plantingCursor.list[1].setStrokeStyle(2, color);
  }

  onPlantingClick(pointer) {
    if (!this.seedManager.plantingMode) return;

    if (pointer.rightButtonDown()) {
      this.exitPlantingMode();
      return;
    }

    if (pointer.leftButtonDown()) {
      this.seedManager.plantSeedAt(pointer.worldX, pointer.worldY);
    }
  }

  exitPlantingMode() {
    console.log('Exiting planting mode');

    if (this.plantingCursor) {
      this.plantingCursor.destroy();
      this.plantingCursor = null;
    }

    if (this.plantingInstruction) {
      this.plantingInstruction.destroy();
      this.plantingInstruction = null;
    }

    this.input.off('pointermove', this.updatePlantingCursor, this);
    this.input.off('pointerdown', this.onPlantingClick, this);
  }

  // --- Combat ---

  startTestCombat() {
    const phaseInfo = this.sapCycle.getCurrentPhaseInfo();

    // Get alive allies
    const aliveAllies = this.allyManager.getAliveAllies();

    this.cameras.main.fadeOut(500);
    this.time.delayedCall(500, () => {
      this.scene.start('CombatScene', {
        player: { ...this.player.stats },
        enemies: null, // use defaults
        terrain: 'forest',
        canEscape: true,
        allies: aliveAllies.map((ally) => ({
          id: ally.id,
          name: ally.name,
          type: ally.type,
          hp: ally.currentHp,
          maxHp: ally.maxHp,
          attack: ally.stats.attack,
          defense: ally.stats.defense,
          agility: ally.stats.agility || 10,
          aiType: 'friendly',
        })),
        sapPhase: phaseInfo.phase,
        phaseModifiers: phaseInfo.modifiers,
      });
    });
  }

  // --- Phase Event Handlers ---

  onPhaseChange(data) {
    console.log(`=== PHASE CHANGE TO ${data.phase} ===`);

    // Update Sap Cycle UI
    if (this.sapCycleUI) {
      this.sapCycleUI.updatePhase(data.phase);
      const phaseInfo = this.sapCycle.getCurrentPhaseInfo();
      this.sapCycleUI.updateDay(phaseInfo.day, phaseInfo.duration);
    }

    // Toggle Plant Seeds button visibility
    if (this.plantSeedsButton) {
      const isCrimson = data.phase === 'CRIMSON';
      this.plantSeedsButton.button.setVisible(isCrimson);
      this.plantSeedsButton.text.setVisible(isCrimson);
    }
  }

  onDayAdvance(data) {
    console.log(`Day ${data.totalDays}`);

    if (this.sapCycleUI) {
      this.sapCycleUI.updateDay(
        data.phaseDay,
        this.sapCycle.currentPhaseDuration
      );
    }

    // Update seed counters
    if (this.seedManager) {
      this.seedManager.updateSeedCounters();
    }
  }

  showPhaseTransitionEvent(event) {
    console.log('Phase transition event:', event);

    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
    overlay.setDepth(350);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 0.8,
      duration: 800,
    });

    const panel = this.add.rectangle(
      400,
      300,
      600,
      250,
      event.type === 'major' ? 0x4a2a5a : 0x2d4a3e,
      0.95
    );
    panel.setStrokeStyle(
      5,
      event.type === 'major' ? 0xcc88ff : 0x88cc88
    );
    panel.setDepth(351);
    panel.setScale(0);

    this.tweens.add({
      targets: panel,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(400, () => {
      const title = this.add.text(400, 220, event.title, {
        fontSize: event.type === 'major' ? '42px' : '32px',
        color: event.type === 'major' ? '#FFCC88' : '#AAFFAA',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      });
      title.setOrigin(0.5);
      title.setDepth(352);

      const message = this.add.text(400, 290, event.message, {
        fontSize: '20px',
        color: '#FFFFFF',
        align: 'center',
        wordWrap: { width: 550 },
      });
      message.setOrigin(0.5);
      message.setDepth(352);

      this.time.delayedCall(1500, () => {
        const continueBtn = this.add.rectangle(
          400,
          370,
          180,
          50,
          0x666666,
          0.9
        );
        continueBtn.setStrokeStyle(3, 0xaaaaaa);
        continueBtn.setDepth(352);

        const btnText = this.add.text(400, 370, 'Continue', {
          fontSize: '22px',
          color: '#FFFFFF',
          fontStyle: 'bold',
        });
        btnText.setOrigin(0.5);
        btnText.setDepth(353);

        continueBtn.setInteractive({ useHandCursor: true });
        continueBtn.on('pointerdown', () => {
          [overlay, panel, title, message, continueBtn, btnText].forEach(
            (el) => {
              this.tweens.add({
                targets: el,
                alpha: 0,
                duration: 400,
                onComplete: () => el.destroy(),
              });
            }
          );
        });
      });
    });
  }

  showRandomEvent(event) {
    console.log('Random event:', event);

    // Apply event effect
    if (event.effect) {
      event.effect(this);
      this.updatePlayerStatsDisplay();
    }

    // Show notification
    const notification = this.add.container(0, 0);
    notification.setDepth(360);

    const bg = this.add.rectangle(400, 100, 500, 120, 0x3a4a3a, 0.95);
    bg.setStrokeStyle(3, 0xaacc88);

    const titleText = this.add.text(240, 80, event.title, {
      fontSize: '22px',
      color: '#FFDD88',
      fontStyle: 'bold',
    });
    titleText.setOrigin(0, 0.5);

    const messageText = this.add.text(240, 110, event.message, {
      fontSize: '16px',
      color: '#FFFFFF',
      wordWrap: { width: 400 },
    });
    messageText.setOrigin(0, 0.5);

    notification.add([bg, titleText, messageText]);

    // Slide in
    notification.setY(-120);
    this.tweens.add({
      targets: notification,
      y: 0,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Slide out after 4 seconds
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: notification,
        y: -120,
        duration: 400,
        ease: 'Power2',
        onComplete: () => notification.destroy(),
      });
    });
  }

  // --- Help Overlay ---

  showHelpOverlay() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
    overlay.setDepth(400);

    const helpBg = this.add.rectangle(400, 300, 600, 500, 0x2d4a3e, 0.95);
    helpBg.setStrokeStyle(4, 0x88cc88);
    helpBg.setDepth(401);

    const title = this.add.text(400, 80, 'CONTROLS & INFO', {
      fontSize: '32px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(402);

    const helpText = this.add.text(
      400,
      320,
      `KEYBOARD SHORTCUTS:

R - Open Rest Menu
P - Plant Seeds (Crimson Phase)
A - Toggle Ally Panel
D - Advance Day (Debug)
H - Show This Help

MOUSE CONTROLS:

Click - Move / Interact
Right-Click - Cancel

SAP CYCLE PHASES:

CRIMSON - Plant seeds, magic weak
SILVER - Great Unbinding, magic strong
BLUE - Reflection, balanced

TIP: Rest advances time to trigger
phase transitions!`,
      {
        fontSize: '16px',
        color: '#FFFFFF',
        align: 'center',
        lineSpacing: 8,
      }
    );
    helpText.setOrigin(0.5);
    helpText.setDepth(402);

    const closeBtn = this.add.rectangle(400, 520, 150, 45, 0x666666, 0.9);
    closeBtn.setStrokeStyle(2, 0x999999);
    closeBtn.setDepth(402);

    const closeText = this.add.text(400, 520, 'Close', {
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    closeText.setOrigin(0.5);
    closeText.setDepth(403);

    closeBtn.setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      [overlay, helpBg, title, helpText, closeBtn, closeText].forEach((el) =>
        el.destroy()
      );
    });

    const closeHandler = (event) => {
      if (event.key === 'Escape' || event.key === 'h') {
        [overlay, helpBg, title, helpText, closeBtn, closeText].forEach(
          (el) => el.destroy()
        );
        this.input.keyboard.off('keydown', closeHandler);
      }
    };

    this.input.keyboard.on('keydown', closeHandler);
  }

  // --- Save/Load ---

  saveGameState() {
    const saveData = {
      timestamp: Date.now(),

      player: {
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        dsp: this.player.stats.dsp,
        maxDsp: this.player.stats.maxDsp,
        attack: this.player.stats.attack,
        defense: this.player.stats.defense,
        agility: this.player.stats.agility,
        exp: this.player.stats.exp || 0,
        level: this.player.stats.level || 1,
      },

      sapCycle: this.sapCycle.getSaveData(),

      seeds: this.seedManager.getSaveData(),

      allies: this.allyManager.getSaveData(),
    };

    localStorage.setItem('verdance_save', JSON.stringify(saveData));

    console.log('Game saved!');
    this.showMessage('Game Saved', 0x88ff88);
  }

  loadGameState() {
    const saveJson = localStorage.getItem('verdance_save');

    if (!saveJson) {
      console.log('No save data found');
      return false;
    }

    try {
      const saveData = JSON.parse(saveJson);

      Object.assign(this.player.stats, saveData.player);

      this.sapCycle.loadSaveData(saveData.sapCycle);

      this.seedManager.loadSaveData(saveData.seeds);

      this.allyManager.loadSaveData(saveData.allies);

      console.log('Game loaded!');
      this.showMessage('Game Loaded', 0x88aaff);

      return true;
    } catch (error) {
      console.error('Failed to load save:', error);
      return false;
    }
  }

  // --- Tutorial ---

  initTutorial() {
    this.tutorialFlags = {
      shownRest: false,
      shownPlant: false,
      shownAlly: false,
      shownPhaseChange: false,
    };

    const tutorialData = localStorage.getItem('verdance_tutorial');
    if (tutorialData) {
      try {
        this.tutorialFlags = JSON.parse(tutorialData);
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  showTutorialTooltip(key, text, x, y) {
    if (this.tutorialFlags[key]) return;

    const tooltip = this.add.container(x, y);
    tooltip.setDepth(500);

    const bg = this.add.rectangle(0, 0, 300, 100, 0x4a3a5a, 0.95);
    bg.setStrokeStyle(3, 0xcc88ff);

    const message = this.add.text(-100, 0, text, {
      fontSize: '14px',
      color: '#FFFFFF',
      wordWrap: { width: 180 },
      align: 'left',
    });
    message.setOrigin(0, 0.5);

    const gotItBtn = this.add.rectangle(120, 30, 80, 30, 0x666666, 0.9);
    gotItBtn.setStrokeStyle(2, 0x999999);

    const btnText = this.add.text(120, 30, 'Got it!', {
      fontSize: '12px',
      color: '#FFFFFF',
    });
    btnText.setOrigin(0.5);

    tooltip.add([bg, message, gotItBtn, btnText]);

    gotItBtn.setInteractive({ useHandCursor: true });
    gotItBtn.on('pointerdown', () => {
      tooltip.destroy();
      this.tutorialFlags[key] = true;
      localStorage.setItem(
        'verdance_tutorial',
        JSON.stringify(this.tutorialFlags)
      );
    });

    // Auto-dismiss after 10 seconds
    this.time.delayedCall(10000, () => {
      if (tooltip.scene) {
        tooltip.destroy();
        this.tutorialFlags[key] = true;
        localStorage.setItem(
          'verdance_tutorial',
          JSON.stringify(this.tutorialFlags)
        );
      }
    });
  }

  // --- Utility ---

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
