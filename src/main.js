import Phaser from 'phaser';
import { GameConfig } from './core/GameConfig.js';
import { EventBus } from './core/EventBus.js';
import { HotReloadSystem } from './systems/HotReloadSystem.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { EditorScene } from './scenes/EditorScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GameConfig.WIDTH,
  height: GameConfig.HEIGHT,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: GameConfig.DEBUG.SHOW_PHYSICS
    }
  },
  scene: [BootScene, PreloadScene, TitleScene, GameScene, EditorScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: false,
    pixelArt: true
  }
};

const game = new Phaser.Game(config);

// Store global references
game.eventBus = EventBus.getInstance();
window.__VERDANCE_GAME = game;

// Initialize HotReloadSystem in development mode
if (import.meta.hot || import.meta.env?.DEV) {
  const hotReload = HotReloadSystem.getInstance();
  hotReload.initialize();
  window.__VERDANCE_HOT_RELOAD = hotReload;
}

export default game;
