import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import ClassSelectionScene from './scenes/ClassSelectionScene.js';
import CharacterCreationScene from './scenes/CharacterCreationScene.js';
import GameScene from './scenes/GameScene.js';
import EditorScene from './scenes/EditorScene.js';
import UIScene from './scenes/UIScene.js';
import PauseMenuScene from './scenes/PauseMenuScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import WorldMapScene from './scenes/WorldMapScene.js';
import EndingScene from './scenes/EndingScene.js';
import HomeBaseScene from './scenes/HomeBaseScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import CharacterSheetScene from './scenes/CharacterSheetScene.js';
import WikiCodexScene from './scenes/WikiCodexScene.js';
import AdminScene from './scenes/AdminScene.js';
import ProceduralAudio from './systems/ProceduralAudio.js';
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
        pixelArt: false,
        antialias: true,
        roundPixels: true
    },

    pipeline: {
        NormalMap: NormalMapPipeline,
        PostProcessing: PostProcessingPipeline
    },

    scene: [BootScene, MainMenuScene, ClassSelectionScene, CharacterCreationScene, GameScene, EditorScene, UIScene, PauseMenuScene, SettingsScene, WorldMapScene, EndingScene, HomeBaseScene, CharacterSheetScene, WikiCodexScene, AdminScene]
};

function showBootError(message) {
    const el = document.getElementById('game-boot-error');
    if (el) {
        el.hidden = false;
        el.textContent = message;
    }
}

/**
 * Custom WebGL pipelines can fail to compile on some GPUs/drivers; retry without them.
 */
function createGame(gameConfig) {
    try {
        return new Phaser.Game(gameConfig);
    } catch (err) {
        console.error('[Verdance] Phaser.Game failed:', err);
        const { pipeline, ...withoutPipeline } = gameConfig;
        if (pipeline) {
            console.warn('[Verdance] Retrying without custom pipelines (NormalMap / PostProcessing).');
            try {
                return new Phaser.Game(withoutPipeline);
            } catch (err2) {
                showBootError(
                    `Game failed to start: ${err2.message}. Open the Console (F12) for details.`
                );
                throw err2;
            }
        }
        showBootError(`Game failed to start: ${err.message}. Open the Console (F12) for details.`);
        throw err;
    }
}

const game = createGame(config);

// Boot procedural audio — starts ambient music and wires all SFX to EventBus
// Needs to be after game creation so Web Audio context is available
ProceduralAudio.getInstance();

// Expose for debugging in dev mode
if (import.meta.env.DEV) {
    window.__GAME = game;
    console.log('[Verdance] Development mode — window.__GAME is available');
}

export default game;
