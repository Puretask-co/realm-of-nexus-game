import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import EditorScene from './scenes/EditorScene.js';
import UIScene from './scenes/UIScene.js';
import NormalMapPipeline from './pipelines/NormalMapPipeline.js';
import PostProcessingPipeline from './pipelines/PostProcessingPipeline.js';

/**
 * Realm of Nexus — Main entry point.
 *
 * Initialises the Phaser game instance with all scenes registered.
 * The BootScene loads assets and data, then transitions to GameScene.
 * EditorScene provides a visual level editor accessible via a hotkey.
 */

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#0a0a1a',

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: { width: 800, height: 450 },
        max: { width: 1920, height: 1080 }
    },

    render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true
    },

    pipeline: {
        NormalMap: NormalMapPipeline,
        PostProcessing: PostProcessingPipeline
    },

    scene: [BootScene, GameScene, EditorScene, UIScene]
};

const game = new Phaser.Game(config);

// Expose for debugging in dev mode
if (import.meta.env.DEV) {
    window.__GAME = game;
    console.log('[Verdance] Development mode — window.__GAME is available');
}

export default game;
