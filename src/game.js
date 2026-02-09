/**
 * Realm of Nexus - Main Game Entry Point
 *
 * A 2D tactical RPG built with Phaser.js featuring the Sap Cycle magic system.
 * Toggle editor with F1 key.
 */

import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import EditorScene from './scenes/EditorScene.js';
import { EventBus } from './systems/EventBus.js';

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  scene: [GameScene, EditorScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  render: {
    pixelArt: true,
    antialias: false
  }
};

const game = new Phaser.Game(config);

// Expose EventBus globally for cross-system communication
window.EventBus = EventBus;

// Toggle between editor and game with F1
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault();

    const editor = game.scene.getScene('EditorScene');
    const gameScene = game.scene.getScene('GameScene');

    if (editor && editor.scene.isActive()) {
      editor.scene.stop();
      gameScene.scene.start();
    } else if (gameScene && gameScene.scene.isActive()) {
      gameScene.scene.stop();
      editor.scene.start();
    }
  }
});

export default game;
