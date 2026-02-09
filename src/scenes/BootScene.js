import Phaser from 'phaser';

/**
 * BootScene - Initial boot scene that sets up core systems before loading.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Minimal assets needed for the loading screen
  }

  create() {
    // Detect WebGL support
    this.game.registry.set('webgl', this.game.renderer.type === Phaser.WEBGL);

    // Set up global input settings
    this.input.mouse.disableContextMenu();

    this.scene.start('PreloadScene');
  }
}

export default BootScene;
