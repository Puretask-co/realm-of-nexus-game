// src/scenes/BootScene.js
// Initial boot scene for loading assets and displaying title screen

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      fontSize: '20px',
      color: '#AAFFAA',
    });
    loadingText.setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x88ff88, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder textures (since we don't have real assets yet)
    this.createPlaceholderAssets();
  }

  createPlaceholderAssets() {
    // Generate simple colored rectangle textures for entities
    const entities = [
      { key: 'player_idle', color: 0x88ff88 },
      { key: 'enemy_thornbeast', color: 0xff6666 },
      { key: 'enemy_rootguard', color: 0x8b4513 },
      { key: 'enemy_sporecaller', color: 0xff88ff },
      { key: 'ally_warrior', color: 0xff8888 },
      { key: 'ally_guardian', color: 0x886644 },
      { key: 'ally_archer', color: 0x88ff88 },
      { key: 'ally_healer', color: 0xffcc88 },
    ];

    entities.forEach((entity) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(entity.color, 1);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture(entity.key, 32, 32);
      gfx.destroy();
    });

    // Particle textures
    const particles = [
      { key: 'fire_particle', color: 0xff6600 },
      { key: 'impact_particle', color: 0xff4444 },
      { key: 'magic_particle', color: 0x8888ff },
      { key: 'heal_particle', color: 0x88ff88 },
      { key: 'status_particle', color: 0xffff00 },
      { key: 'seed_particle', color: 0x88ff88 },
      { key: 'energy_particle', color: 0xffffff },
      { key: 'leaf_particle', color: 0x88cc88 },
    ];

    particles.forEach((p) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(p.color, 1);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture(p.key, 8, 8);
      gfx.destroy();
    });
  }

  create() {
    this.showTitleScreen();
  }

  showTitleScreen() {
    // Dark background
    this.add.rectangle(400, 300, 800, 600, 0x0a0a0a);

    // Title
    const title = this.add.text(400, 180, 'REALM OF NEXUS', {
      fontSize: '48px',
      color: '#88FF88',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(400, 240, 'Verdance Awakens', {
      fontSize: '22px',
      color: '#66AA66',
      fontStyle: 'italic',
    });
    subtitle.setOrigin(0.5);

    // Pulse title
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.7 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Version
    this.add
      .text(400, 550, 'v0.1.0 - Combat & Sap Cycle Foundation', {
        fontSize: '12px',
        color: '#666666',
      })
      .setOrigin(0.5);

    // Start button
    const startBtn = this.add.rectangle(400, 380, 220, 60, 0x4a7c59, 0.9);
    startBtn.setStrokeStyle(3, 0x88cc88);

    const startText = this.add.text(400, 380, 'Begin Journey', {
      fontSize: '26px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    startText.setOrigin(0.5);

    startBtn.setInteractive({ useHandCursor: true });
    startBtn.on('pointerover', () => {
      startBtn.setFillStyle(0x5a8c69);
      startBtn.setScale(1.05);
      startText.setScale(1.05);
    });
    startBtn.on('pointerout', () => {
      startBtn.setFillStyle(0x4a7c59);
      startBtn.setScale(1.0);
      startText.setScale(1.0);
    });
    startBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('ExplorationScene');
      });
    });
  }
}
