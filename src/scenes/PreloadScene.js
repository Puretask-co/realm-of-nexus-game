import Phaser from 'phaser';
import DataManager from '../systems/DataManager.js';

/**
 * PreloadScene - Loads all game assets and initializes data systems.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading Verdance...', {
      fontSize: '18px',
      fill: '#e0e0e0',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      percentText.setText(`${Math.round(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(0x4a9eff, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });
  }

  async create() {
    // Initialize the DataManager and load all game data
    const dataManager = DataManager.getInstance();
    try {
      await dataManager.loadAllData();
      dataManager.validateAllData();
      dataManager.buildCaches();
    } catch (err) {
      console.warn('Data loading skipped (no data files yet):', err.message);
    }

    this.scene.start('GameScene');
  }
}

export default PreloadScene;
