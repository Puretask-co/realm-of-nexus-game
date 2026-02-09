import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * GameScene - Main gameplay scene for Verdance.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    // Placeholder - game systems will be initialized here
    const text = this.add.text(
      GameConfig.WIDTH / 2,
      GameConfig.HEIGHT / 2,
      'Verdance - Realm of Nexus\nEngine Initialized',
      {
        fontSize: '24px',
        fill: '#4a9eff',
        fontFamily: 'monospace',
        align: 'center'
      }
    ).setOrigin(0.5);

    // FPS display
    if (GameConfig.DEBUG.SHOW_FPS) {
      this.fpsText = this.add.text(10, 10, '', {
        fontSize: '12px',
        fill: '#00ff00',
        fontFamily: 'monospace'
      }).setScrollFactor(0).setDepth(9999);
    }

    this.eventBus.emit('scene:ready', { scene: 'GameScene' });
  }

  update(time, delta) {
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }
  }
}

export default GameScene;
