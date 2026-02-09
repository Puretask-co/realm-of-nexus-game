// src/ui/SapCycleUI.js
// HUD display for Sap Cycle phase, day counter, and progress bar

export default class SapCycleUI {
  constructor(scene, sapCycleManager) {
    this.scene = scene;
    this.sapCycle = sapCycleManager;

    this.container = null;
    this.phaseIndicator = null;
    this.dayCounter = null;
    this.progressBarFill = null;
    this.descriptionText = null;

    this.create();
  }

  create() {
    const x = 10;
    const y = 10;
    const elements = [];

    // Background panel
    const panelBg = this.scene.add.rectangle(
      x + 130,
      y + 70,
      260,
      140,
      0x1a2a1a,
      0.85
    );
    panelBg.setOrigin(0, 0);
    panelBg.setStrokeStyle(3, this.sapCycle.getPhaseColor());
    elements.push(panelBg);
    this.panelBg = panelBg;

    // Title
    const title = this.scene.add.text(x + 140, y + 80, 'SAP CYCLE', {
      fontSize: '18px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    elements.push(title);

    // Phase indicator
    const phaseInfo = this.sapCycle.getCurrentPhaseInfo();
    this.phaseIndicator = this.scene.add.text(
      x + 140,
      y + 105,
      `Phase: ${phaseInfo.phase}`,
      {
        fontSize: '16px',
        color: '#FFFFFF',
      }
    );
    elements.push(this.phaseIndicator);

    // Day counter
    this.dayCounter = this.scene.add.text(
      x + 140,
      y + 130,
      `Day ${phaseInfo.day} / ${phaseInfo.duration}`,
      {
        fontSize: '14px',
        color: '#CCCCCC',
      }
    );
    elements.push(this.dayCounter);

    // Progress bar background
    const barBg = this.scene.add.rectangle(
      x + 140,
      y + 158,
      220,
      14,
      0x333333,
      0.9
    );
    barBg.setOrigin(0, 0);
    elements.push(barBg);

    // Progress bar fill
    const progress = phaseInfo.day / phaseInfo.duration;
    this.progressBarFill = this.scene.add.rectangle(
      x + 140,
      y + 158,
      220 * progress,
      14,
      this.sapCycle.getPhaseColor(),
      0.9
    );
    this.progressBarFill.setOrigin(0, 0);
    elements.push(this.progressBarFill);

    // Phase description
    this.descriptionText = this.scene.add.text(
      x + 140,
      y + 178,
      phaseInfo.modifiers.description,
      {
        fontSize: '11px',
        color: '#AAAAAA',
        wordWrap: { width: 220 },
      }
    );
    elements.push(this.descriptionText);

    // Sap droplet icon (simple colored circle)
    const droplet = this.scene.add.circle(
      x + 70,
      y + 130,
      28,
      this.sapCycle.getPhaseColor(),
      0.8
    );
    droplet.setStrokeStyle(3, 0xffffff, 0.5);
    elements.push(droplet);
    this.droplet = droplet;

    // Shimmer animation on droplet
    this.scene.tweens.add({
      targets: droplet,
      alpha: { from: 0.8, to: 0.5 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.container = this.scene.add.container(0, 0, elements);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);
  }

  updateDay(currentDay, maxDays) {
    if (this.dayCounter) {
      this.dayCounter.setText(`Day ${currentDay} / ${maxDays}`);
    }
    if (this.progressBarFill) {
      const progress = currentDay / maxDays;
      this.scene.tweens.add({
        targets: this.progressBarFill,
        width: 220 * progress,
        duration: 500,
        ease: 'Power2',
      });
    }
  }

  updatePhase(phaseName) {
    if (this.phaseIndicator) {
      this.phaseIndicator.setText(`Phase: ${phaseName}`);
    }
    const newColor = this.sapCycle.getPhaseColor();
    if (this.progressBarFill) {
      this.progressBarFill.setFillStyle(newColor, 0.9);
    }
    if (this.panelBg) {
      this.panelBg.setStrokeStyle(3, newColor);
    }
    if (this.droplet) {
      this.droplet.setFillStyle(newColor, 0.8);
    }
    if (this.descriptionText) {
      const info = this.sapCycle.getCurrentPhaseInfo();
      this.descriptionText.setText(info.modifiers.description);
    }
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
    }
  }
}
