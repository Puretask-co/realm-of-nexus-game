import dataManager from '../systems/DataManager.js';
import EventBus from '../core/EventBus.js';

/**
 * BootScene — First scene loaded.
 *
 * Responsibilities:
 *  1. Display a loading bar while assets are fetched.
 *  2. Load all game data via DataManager.
 *  3. Pre-generate placeholder textures for development.
 *  4. Transition to GameScene once everything is ready.
 *
 * During development, if sprite sheets are not yet available the
 * scene creates coloured rectangle textures so that gameplay can
 * be tested without external art.
 */
export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this._createLoadingBar();

        // ---- Asset loading ----
        // Placeholder: load real sprite sheets here when available
        // this.load.spritesheet('player', 'assets/sprites/player.png', { ... });
        // this.load.image('tileset', 'assets/maps/tileset.png');
        // this.load.tilemapTiledJSON('map_verdant_grove', 'assets/maps/verdant_grove.json');

        // Audio placeholders
        // this.load.audio('bgm_exploration', 'assets/audio/bgm_exploration.ogg');
        // this.load.audio('sfx_spell_cast', 'assets/audio/sfx_spell_cast.ogg');
    }

    create() {
        // Generate placeholder textures for dev
        this._generatePlaceholders();

        // Load game data (async)
        dataManager.loadAllData().then(() => {
            // Enable hot-reload in dev mode
            if (import.meta.env.DEV) {
                dataManager.enableHotReload();
                console.log('[BootScene] Hot-reload enabled');
            }

            EventBus.emit('boot-complete');
            console.log('[BootScene] Boot complete, starting game...');
            this.scene.start('GameScene');
        }).catch((err) => {
            console.error('[BootScene] Data load failed, using fallbacks:', err);
            this.scene.start('GameScene');
        });
    }

    // ----------------------------------------------------------------
    // Loading bar
    // ----------------------------------------------------------------

    _createLoadingBar() {
        const { width, height } = this.scale;
        const barWidth = 400;
        const barHeight = 20;
        const x = (width - barWidth) / 2;
        const y = height / 2;

        // Background bar
        const bg = this.add.graphics();
        bg.fillStyle(0x222244, 0.8);
        bg.fillRect(x, y, barWidth, barHeight);

        // Fill bar
        const fill = this.add.graphics();

        // Title text
        this.add.text(width / 2, y - 40, 'REALM OF NEXUS', {
            fontFamily: 'monospace',
            fontSize: '24px',
            color: '#88aaff'
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, y - 16, 'Loading...', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#aaaacc'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            fill.clear();
            fill.fillStyle(0x4488ff, 1);
            fill.fillRect(x + 2, y + 2, (barWidth - 4) * value, barHeight - 4);
        });

        this.load.on('complete', () => {
            bg.destroy();
            fill.destroy();
        });
    }

    // ----------------------------------------------------------------
    // Dev placeholders
    // ----------------------------------------------------------------

    _generatePlaceholders() {
        // Player placeholder (32x32 blue square)
        if (!this.textures.exists('player')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x4488ff, 1);
            gfx.fillRect(0, 0, 32, 32);
            gfx.generateTexture('player', 32, 32);
            gfx.destroy();
        }

        // Enemy placeholder (32x32 red square)
        if (!this.textures.exists('enemy')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xff4444, 1);
            gfx.fillRect(0, 0, 32, 32);
            gfx.generateTexture('enemy', 32, 32);
            gfx.destroy();
        }

        // NPC placeholder (32x32 green square)
        if (!this.textures.exists('npc')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x44ff44, 1);
            gfx.fillRect(0, 0, 32, 32);
            gfx.generateTexture('npc', 32, 32);
            gfx.destroy();
        }

        // Tile placeholder (16x16)
        if (!this.textures.exists('tile')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x336633, 1);
            gfx.fillRect(0, 0, 16, 16);
            gfx.lineStyle(1, 0x448844, 0.5);
            gfx.strokeRect(0, 0, 16, 16);
            gfx.generateTexture('tile', 16, 16);
            gfx.destroy();
        }

        // Light glow placeholder (64x64 radial)
        if (!this.textures.exists('light_glow')) {
            const gfx = this.add.graphics();
            for (let i = 8; i >= 0; i--) {
                const frac = i / 8;
                gfx.fillStyle(0xffffff, (1 - frac) * 0.6);
                gfx.fillCircle(32, 32, 32 * frac);
            }
            gfx.generateTexture('light_glow', 64, 64);
            gfx.destroy();
        }

        // Particle placeholder (8x8 white dot)
        if (!this.textures.exists('particle')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(4, 4, 4);
            gfx.generateTexture('particle', 8, 8);
            gfx.destroy();
        }

        console.log('[BootScene] Placeholder textures generated');
    }
}
