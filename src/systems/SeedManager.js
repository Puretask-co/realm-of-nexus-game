// src/systems/SeedManager.js
// Seed planting system for Verdance
// Seeds planted during CRIMSON phase unbind into allies during SILVER phase

export default class SeedManager {
  constructor(scene, sapCycleManager) {
    this.scene = scene;
    this.sapCycle = sapCycleManager;

    // Seed inventory
    this.playerSeeds = {
      warrior: 3,
      guardian: 2,
      archer: 2,
      healer: 1,
    };

    // Seed type definitions
    this.seedTypes = {
      warrior: {
        name: 'Warrior Seed',
        description: 'Unbinds into a fierce Thornbeast warrior',
        cost: 10,
        unbindsInto: 'thornbeast_warrior',
        color: 0xff6666,
        icon: '⚔️',
        stats: {
          hp: 50,
          attack: 18,
          defense: 12,
          type: 'melee',
        },
      },
      guardian: {
        name: 'Guardian Seed',
        description: 'Unbinds into a protective Rootguard',
        cost: 12,
        unbindsInto: 'rootguard',
        color: 0x8b4513,
        icon: '🛡️',
        stats: {
          hp: 80,
          attack: 10,
          defense: 20,
          type: 'tank',
        },
      },
      archer: {
        name: 'Archer Seed',
        description: 'Unbinds into a ranged Skyweaver',
        cost: 8,
        unbindsInto: 'skyweaver_archer',
        color: 0x88ff88,
        icon: '🏹',
        stats: {
          hp: 35,
          attack: 16,
          defense: 8,
          type: 'ranged',
        },
      },
      healer: {
        name: 'Healer Seed',
        description: 'Unbinds into a supportive Bloomshaper',
        cost: 15,
        unbindsInto: 'bloomshaper',
        color: 0xffcc88,
        icon: '🌸',
        stats: {
          hp: 40,
          attack: 8,
          defense: 10,
          type: 'support',
        },
      },
    };

    // Currently planted seeds
    this.plantedSeeds = [];

    // Planting mode state
    this.plantingMode = false;
    this.selectedSeedType = null;

    // Placement restrictions
    this.maxSeedsPerPhase = 10;
    this.minSeedDistance = 50;
  }

  canPlantSeeds() {
    if (this.sapCycle.currentPhase !== 'CRIMSON') {
      console.warn('Can only plant seeds during CRIMSON phase!');
      return false;
    }

    if (this.plantedSeeds.length >= this.maxSeedsPerPhase) {
      console.warn(`Already planted max seeds (${this.maxSeedsPerPhase})!`);
      return false;
    }

    return true;
  }

  hasSeed(seedType) {
    return this.playerSeeds[seedType] && this.playerSeeds[seedType] > 0;
  }

  canAffordSeed(seedType) {
    const seedConfig = this.seedTypes[seedType];
    if (!seedConfig) return false;

    const playerDSP = this.scene.player.stats.dsp;
    return playerDSP >= seedConfig.cost;
  }

  selectSeedForPlanting(seedType) {
    if (!this.canPlantSeeds()) {
      return false;
    }

    if (!this.hasSeed(seedType)) {
      this.scene.showMessage(
        `No ${this.seedTypes[seedType].name}s remaining!`,
        0xff6666
      );
      return false;
    }

    if (!this.canAffordSeed(seedType)) {
      this.scene.showMessage(
        `Not enough DSP to plant ${this.seedTypes[seedType].name}!`,
        0xff6666
      );
      return false;
    }

    console.log(`Selected seed type: ${seedType}`);
    this.selectedSeedType = seedType;
    this.plantingMode = true;

    this.scene.showPlantingMode(seedType);

    return true;
  }

  plantSeedAt(x, y) {
    if (!this.plantingMode || !this.selectedSeedType) {
      console.warn('Not in planting mode!');
      return false;
    }

    const seedType = this.selectedSeedType;
    const seedConfig = this.seedTypes[seedType];

    // Validate placement
    const validation = this.validatePlacement(x, y);
    if (!validation.valid) {
      this.scene.showMessage(validation.reason, 0xff6666);
      return false;
    }

    // Deduct DSP cost
    this.scene.player.stats.dsp -= seedConfig.cost;
    console.log(
      `DSP spent: ${seedConfig.cost} (${this.scene.player.stats.dsp} remaining)`
    );

    // Deduct seed from inventory
    this.playerSeeds[seedType]--;

    // Create seed object
    const seed = {
      x: x,
      y: y,
      type: seedType,
      config: seedConfig,
      plantedDay: this.sapCycle.totalDays,
      visual: null,
    };

    this.plantedSeeds.push(seed);

    // Register with Sap Cycle
    this.sapCycle.plantSeed(x, y, seedType);

    // Create visual
    this.createSeedVisual(seed);

    // Show planted message
    this.scene.showMessage(`${seedConfig.name} planted!`, 0x88ff88);

    console.log(
      `Seed planted! Total: ${this.plantedSeeds.length}/${this.maxSeedsPerPhase}`
    );

    // Exit planting mode
    this.plantingMode = false;
    this.selectedSeedType = null;
    this.scene.exitPlantingMode();

    return true;
  }

  validatePlacement(x, y) {
    // Check if too close to other seeds
    for (const seed of this.plantedSeeds) {
      const distance = Phaser.Math.Distance.Between(x, y, seed.x, seed.y);
      if (distance < this.minSeedDistance) {
        return {
          valid: false,
          reason: 'Too close to another seed!',
        };
      }
    }

    // Check if within playable area
    if (x < 100 || x > 700 || y < 100 || y > 500) {
      return {
        valid: false,
        reason: 'Cannot plant outside playable area!',
      };
    }

    return { valid: true };
  }

  createSeedVisual(seed) {
    const config = seed.config;

    // Create container for all seed visuals
    const container = this.scene.add.container(seed.x, seed.y);
    container.setDepth(50);

    // Base seed sprite
    const seedSprite = this.scene.add.circle(0, 0, 10, config.color, 0.9);
    seedSprite.setStrokeStyle(
      3,
      Phaser.Display.Color.ValueToColor(config.color).lighten(30).color
    );

    // Outer glow effect
    const outerGlow = this.scene.add.circle(0, 0, 25, config.color, 0.2);

    // Pulsing animation
    this.scene.tweens.add({
      targets: outerGlow,
      scale: { from: 1.0, to: 1.6 },
      alpha: { from: 0.2, to: 0.05 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Inner glow
    const innerGlow = this.scene.add.circle(0, 0, 15, config.color, 0.4);

    this.scene.tweens.add({
      targets: innerGlow,
      scale: { from: 1.0, to: 1.3 },
      alpha: { from: 0.4, to: 0.1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 300,
    });

    // Icon above seed
    const icon = this.scene.add.text(0, -30, config.icon, {
      fontSize: '22px',
    });
    icon.setOrigin(0.5);

    // Icon float animation
    this.scene.tweens.add({
      targets: icon,
      y: -35,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Seed type label (shows on hover)
    const label = this.scene.add.text(0, 35, config.name, {
      fontSize: '12px',
      color: '#FFFFFF',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5);
    label.setAlpha(0);

    // Days until unbinding counter
    const daysUntilUnbind = this.scene.add.text(0, 50, '', {
      fontSize: '10px',
      color: '#CCCCCC',
    });
    daysUntilUnbind.setOrigin(0.5);

    // Ambient particles
    const particles = this.scene.add.particles(0, 0, 'seed_particle', {
      x: seed.x,
      y: seed.y,
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 2500,
      frequency: 600,
      tint: config.color,
      blendMode: 'ADD',
    });

    // Add all to container
    container.add([outerGlow, innerGlow, seedSprite, icon, label, daysUntilUnbind]);

    // Interactive hover
    seedSprite.setInteractive({ useHandCursor: true });

    seedSprite.on('pointerover', () => {
      this.scene.tweens.add({
        targets: label,
        alpha: 1,
        duration: 200,
      });

      this.scene.tweens.add({
        targets: container,
        scale: 1.15,
        duration: 200,
        ease: 'Back.easeOut',
      });
    });

    seedSprite.on('pointerout', () => {
      this.scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: 200,
      });

      this.scene.tweens.add({
        targets: container,
        scale: 1.0,
        duration: 200,
      });
    });

    // Store all visuals
    seed.visual = {
      container: container,
      sprite: seedSprite,
      outerGlow: outerGlow,
      innerGlow: innerGlow,
      icon: icon,
      label: label,
      daysCounter: daysUntilUnbind,
      particles: particles,
    };

    // Start with a planting animation
    container.setScale(0);
    container.setAlpha(0);

    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // Planting particle burst
    const plantBurst = this.scene.add.particles(seed.x, seed.y, 'seed_particle', {
      speed: { min: 80, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 25,
      tint: [config.color, 0x88ff88, 0x66dd66],
      emitting: false,
    });
    plantBurst.explode(25);
    this.scene.time.delayedCall(1000, () => plantBurst.destroy());
  }

  // Update seed counter each day
  updateSeedCounters() {
    const currentPhase = this.sapCycle.currentPhase;

    if (currentPhase !== 'CRIMSON' && currentPhase !== 'SILVER') {
      return;
    }

    this.plantedSeeds.forEach((seed) => {
      if (!seed.visual || !seed.visual.daysCounter) return;

      if (currentPhase === 'CRIMSON') {
        const daysInPhase = this.sapCycle.phaseDay;
        const phaseDuration = this.sapCycle.currentPhaseDuration;
        const daysRemaining = phaseDuration - daysInPhase;

        seed.visual.daysCounter.setText(`${daysRemaining} days to Silver`);
        seed.visual.daysCounter.setColor('#FFAA88');
      } else if (currentPhase === 'SILVER') {
        seed.visual.daysCounter.setText('Unbinding soon!');
        seed.visual.daysCounter.setColor('#FFFF88');

        // Make seed pulse faster during Silver phase
        this.scene.tweens.add({
          targets: seed.visual.container,
          scale: { from: 1.0, to: 1.2 },
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
    });
  }

  unbindSeed(seed) {
    console.log(`Unbinding seed: ${seed.type} at (${seed.x}, ${seed.y})`);

    // Explosion effect
    this.createUnbindingEffect(seed);

    // Spawn entity
    this.scene.time.delayedCall(800, () => {
      this.spawnEntityFromSeed(seed);
    });

    // Remove seed visual
    this.scene.time.delayedCall(1500, () => {
      if (seed.visual) {
        if (seed.visual.container) seed.visual.container.destroy();
        if (seed.visual.particles) seed.visual.particles.destroy();
      }
    });
  }

  createUnbindingEffect(seed) {
    const config = seed.config;

    // Stop ambient particles
    if (seed.visual && seed.visual.particles) {
      seed.visual.particles.destroy();
    }

    // Bright flash
    const flash = this.scene.add.circle(seed.x, seed.y, 30, 0xffffff, 1.0);
    flash.setDepth(100);

    this.scene.tweens.add({
      targets: flash,
      radius: 120,
      alpha: 0,
      duration: 600,
      ease: 'Power3',
      onComplete: () => flash.destroy(),
    });

    // Ring expansion effect
    const ring = this.scene.add.circle(seed.x, seed.y, 20, config.color, 0);
    ring.setStrokeStyle(4, config.color, 0.8);
    ring.setDepth(99);

    this.scene.tweens.add({
      targets: ring,
      radius: 100,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Energy burst particles
    const burstParticles = this.scene.add.particles(seed.x, seed.y, 'energy_particle', {
      speed: { min: 150, max: 350 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1200,
      quantity: 50,
      tint: [config.color, 0xffffff, 0xffdd88],
      blendMode: 'ADD',
      gravityY: -100,
      emitting: false,
    });
    burstParticles.explode(50);
    this.scene.time.delayedCall(1400, () => burstParticles.destroy());

    // Screen shake
    this.scene.cameras.main.shake(400, 0.01);

    // Ground ripple effect
    const ripple = this.scene.add.ellipse(
      seed.x,
      seed.y + 10,
      40,
      20,
      config.color,
      0.4
    );
    ripple.setDepth(45);

    this.scene.tweens.add({
      targets: ripple,
      scaleX: 3,
      scaleY: 2,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => ripple.destroy(),
    });

    // Light rays
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rayLength = 80;

      const ray = this.scene.add.line(
        seed.x,
        seed.y,
        0,
        0,
        Math.cos(angle) * rayLength,
        Math.sin(angle) * rayLength,
        0xffffff,
        0.6
      );
      ray.setLineWidth(3);
      ray.setDepth(97);

      this.scene.tweens.add({
        targets: ray,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 600,
        ease: 'Power2',
        onComplete: () => ray.destroy(),
      });
    }

    // Text popup
    const unbindText = this.scene.add.text(seed.x, seed.y - 60, 'UNBINDING', {
      fontSize: '24px',
      color: '#FFFF88',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    });
    unbindText.setOrigin(0.5);
    unbindText.setDepth(101);

    this.scene.tweens.add({
      targets: unbindText,
      y: seed.y - 90,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => unbindText.destroy(),
    });
  }

  spawnEntityFromSeed(seed) {
    const config = seed.config;

    console.log(`Spawning ${config.unbindsInto} from seed`);

    // Create entity sprite (use placeholder rectangle since no sprites available)
    const entity = this.scene.add.rectangle(
      seed.x,
      seed.y,
      28,
      28,
      config.color
    );
    entity.setScale(0);
    entity.setAlpha(0);
    entity.setDepth(60);

    // Emergence animation - rise from ground
    this.scene.tweens.add({
      targets: entity,
      y: seed.y - 20,
      scale: 1.5,
      alpha: 1,
      duration: 1000,
      ease: 'Back.easeOut',
    });

    // Spawn particles
    const spawnParticles = this.scene.add.particles(seed.x, seed.y, 'energy_particle', {
      speed: { min: 50, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 1500,
      frequency: 50,
      quantity: 3,
      tint: [config.color, 0xaaffaa],
      blendMode: 'ADD',
    });

    this.scene.time.delayedCall(1200, () => {
      spawnParticles.stop();
    });

    this.scene.time.delayedCall(2700, () => {
      spawnParticles.destroy();
    });

    // Name label that appears
    const nameLabel = this.scene.add.text(seed.x, seed.y - 50, config.name, {
      fontSize: '16px',
      color: Phaser.Display.Color.ValueToColor(config.color).rgba,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    });
    nameLabel.setOrigin(0.5);
    nameLabel.setAlpha(0);
    nameLabel.setDepth(102);

    this.scene.tweens.add({
      targets: nameLabel,
      alpha: 1,
      y: seed.y - 60,
      duration: 600,
      delay: 800,
      ease: 'Power2',
    });

    this.scene.tweens.add({
      targets: nameLabel,
      alpha: 0,
      duration: 800,
      delay: 3500,
      onComplete: () => nameLabel.destroy(),
    });

    // Add ally to manager
    const allyData = {
      sprite: entity,
      stats: { ...config.stats },
      type: seed.type,
      name: config.name,
    };

    if (this.scene.allyManager) {
      const ally = this.scene.allyManager.addAlly(allyData);

      if (ally) {
        console.log(`Ally spawned: ${ally.name}`);

        // Update ally panel
        if (this.scene.updateAllyPanel) {
          this.scene.updateAllyPanel();
        }

        this.scene.showMessage(`${ally.name} joined your party!`, 0x88ff88);
      }
    } else {
      // Fallback: add to scene allies array
      if (!this.scene.allies) {
        this.scene.allies = [];
      }

      this.scene.allies.push({
        sprite: entity,
        stats: { ...config.stats },
        type: seed.type,
        name: config.name,
      });

      console.log(`Ally spawned: ${config.name}`);
      this.scene.showMessage(`${config.name} joined your party!`, 0x88ff88);
    }
  }

  unbindAllSeeds() {
    console.log(`Unbinding ${this.plantedSeeds.length} seeds...`);

    this.plantedSeeds.forEach((seed, index) => {
      this.scene.time.delayedCall(index * 600, () => {
        this.unbindSeed(seed);
      });
    });

    // Clear planted seeds after unbinding complete
    const totalDelay = this.plantedSeeds.length * 600 + 2000;
    this.scene.time.delayedCall(totalDelay, () => {
      this.plantedSeeds = [];
    });
  }

  getSaveData() {
    return {
      playerSeeds: this.playerSeeds,
      plantedSeeds: this.plantedSeeds.map((seed) => ({
        x: seed.x,
        y: seed.y,
        type: seed.type,
        plantedDay: seed.plantedDay,
      })),
    };
  }

  loadSaveData(data) {
    this.playerSeeds = data.playerSeeds || {};
    this.plantedSeeds = data.plantedSeeds || [];

    // Recreate visuals for loaded seeds
    this.plantedSeeds.forEach((seed) => {
      seed.config = this.seedTypes[seed.type];
      this.createSeedVisual(seed);
    });
  }
}
