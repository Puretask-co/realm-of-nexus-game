// src/main.js
// Realm of Nexus - Main game entry point
// Phaser 3 configuration and scene registration

import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import ExplorationScene from './scenes/ExplorationScene.js';
import CombatScene from './scenes/CombatScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0A0A0A',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, ExplorationScene, CombatScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

export default game;
