import dataManager from '../systems/DataManager.js';
import EventBus from '../core/EventBus.js';

/**
 * BootScene — First scene loaded.
 *
 * Responsibilities:
 *  1. Display a loading bar while assets are fetched.
 *  2. Load all game data via DataManager.
 *  3. Pre-generate distinct placeholder textures for all entity types.
 *  4. Transition to GameScene once everything is ready.
 */
export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this._createLoadingBar();

        // Real asset loading goes here when available:
        // this.load.spritesheet('player', 'assets/sprites/player.png', { ... });
        // this.load.audio('bgm_exploration', 'assets/audio/bgm_exploration.ogg');
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

            // Generate audio placeholders after data is loaded
            this._generatePlaceholderAudio();

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

        const bg = this.add.graphics();
        bg.fillStyle(0x222244, 0.8);
        bg.fillRect(x, y, barWidth, barHeight);

        const fill = this.add.graphics();

        this.add.text(width / 2, y - 40, 'REALM OF NEXUS', {
            fontFamily: 'monospace', fontSize: '24px', color: '#88aaff'
        }).setOrigin(0.5);

        this.add.text(width / 2, y - 16, 'Loading...', {
            fontFamily: 'monospace', fontSize: '12px', color: '#aaaacc'
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
    // Procedural placeholder textures
    // ----------------------------------------------------------------

    _generatePlaceholders() {
        // ---- Player: blue humanoid shape with glow ----
        if (!this.textures.exists('player')) {
            const gfx = this.add.graphics();
            // Body
            gfx.fillStyle(0x2266cc, 1);
            gfx.fillRoundedRect(8, 10, 16, 18, 3);
            // Head
            gfx.fillStyle(0x4488ff, 1);
            gfx.fillCircle(16, 8, 7);
            // Glow outline
            gfx.lineStyle(1, 0x88bbff, 0.6);
            gfx.strokeCircle(16, 16, 15);
            // Eyes
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('player', 32, 32);
            gfx.destroy();
        }

        // ---- Enemy types ----
        // Forest Guardian: large green defender
        if (!this.textures.exists('enemy_forest_guardian')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x226622, 1);
            gfx.fillRoundedRect(4, 6, 24, 22, 4);
            gfx.fillStyle(0x44aa44, 1);
            gfx.fillCircle(16, 6, 8);
            // Leaf crown
            gfx.fillStyle(0x66cc66, 1);
            gfx.fillTriangle(8, 4, 16, -4, 24, 4);
            // Eyes
            gfx.fillStyle(0xffff44, 1);
            gfx.fillCircle(13, 5, 2);
            gfx.fillCircle(19, 5, 2);
            gfx.generateTexture('enemy_forest_guardian', 32, 32);
            gfx.destroy();
        }

        // Shadow Stalker: slim purple assassin
        if (!this.textures.exists('enemy_shadow_stalker')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x442266, 1);
            gfx.fillRoundedRect(10, 4, 12, 24, 2);
            gfx.fillStyle(0x8844cc, 1);
            gfx.fillCircle(16, 6, 6);
            // Shadow wisps
            gfx.lineStyle(1, 0xaa66ff, 0.5);
            gfx.strokeCircle(16, 16, 14);
            // Glowing eyes
            gfx.fillStyle(0xff44ff, 1);
            gfx.fillCircle(14, 5, 1.5);
            gfx.fillCircle(18, 5, 1.5);
            gfx.generateTexture('enemy_shadow_stalker', 32, 32);
            gfx.destroy();
        }

        // Crimson Warden: armored red tank
        if (!this.textures.exists('enemy_crimson_warden')) {
            const gfx = this.add.graphics();
            // Armor body
            gfx.fillStyle(0x881122, 1);
            gfx.fillRoundedRect(4, 8, 24, 20, 3);
            // Head
            gfx.fillStyle(0xcc2233, 1);
            gfx.fillCircle(16, 8, 7);
            // Helmet crest
            gfx.fillStyle(0xff4444, 1);
            gfx.fillRect(14, 0, 4, 6);
            // Shield
            gfx.fillStyle(0xaa1122, 1);
            gfx.fillRoundedRect(2, 12, 8, 12, 2);
            // Eyes
            gfx.fillStyle(0xff8844, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('enemy_crimson_warden', 32, 32);
            gfx.destroy();
        }

        // Generic enemy fallback (red square)
        if (!this.textures.exists('enemy')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xff4444, 1);
            gfx.fillRoundedRect(4, 4, 24, 24, 4);
            gfx.fillStyle(0xff8888, 1);
            gfx.fillCircle(12, 12, 2);
            gfx.fillCircle(20, 12, 2);
            gfx.generateTexture('enemy', 32, 32);
            gfx.destroy();
        }

        // ---- NPC types ----
        // Quest NPC (green robed)
        if (!this.textures.exists('npc')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x228844, 1);
            gfx.fillRoundedRect(8, 10, 16, 18, 3);
            gfx.fillStyle(0x44cc66, 1);
            gfx.fillCircle(16, 8, 7);
            // Friendly eyes
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(14, 7, 2);
            gfx.fillCircle(18, 7, 2);
            gfx.fillStyle(0x228844, 1);
            gfx.fillCircle(14, 7, 1);
            gfx.fillCircle(18, 7, 1);
            // Quest marker
            gfx.fillStyle(0xffff44, 1);
            gfx.fillRect(15, 0, 3, 5);
            gfx.fillCircle(16.5, 7, 0); // dot below !
            gfx.generateTexture('npc', 32, 32);
            gfx.destroy();
        }

        // ---- World textures ----
        // Tile placeholder
        if (!this.textures.exists('tile')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x336633, 1);
            gfx.fillRect(0, 0, 16, 16);
            gfx.lineStyle(1, 0x448844, 0.5);
            gfx.strokeRect(0, 0, 16, 16);
            gfx.generateTexture('tile', 16, 16);
            gfx.destroy();
        }

        // Light glow
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

        // Particle
        if (!this.textures.exists('particle')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xffffff, 1);
            gfx.fillCircle(4, 4, 4);
            gfx.generateTexture('particle', 8, 8);
            gfx.destroy();
        }

        // Loot sparkle
        if (!this.textures.exists('loot_sparkle')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xffdd44, 1);
            gfx.fillStar(8, 8, 4, 8, 3, 4);
            gfx.generateTexture('loot_sparkle', 16, 16);
            gfx.destroy();
        }

        console.log('[BootScene] Placeholder textures generated (player, 3 enemy types, NPC, world)');
    }

    // ----------------------------------------------------------------
    // Placeholder audio using Web Audio API
    // ----------------------------------------------------------------

    _generatePlaceholderAudio() {
        try {
            const audioCtx = this.sound.context;
            if (!audioCtx) return;

            // Helper: generate a simple tone as an audio buffer
            const createTone = (frequency, duration, type = 'sine', fadeOut = true) => {
                const sampleRate = audioCtx.sampleRate;
                const length = Math.floor(sampleRate * duration);
                const buffer = audioCtx.createBuffer(1, length, sampleRate);
                const data = buffer.getChannelData(0);

                for (let i = 0; i < length; i++) {
                    const t = i / sampleRate;
                    let sample = 0;

                    switch (type) {
                        case 'sine':
                            sample = Math.sin(2 * Math.PI * frequency * t);
                            break;
                        case 'square':
                            sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 0.5 : -0.5;
                            break;
                        case 'noise':
                            sample = (Math.random() * 2 - 1) * 0.3;
                            break;
                        case 'sweep':
                            sample = Math.sin(2 * Math.PI * (frequency + t * 500) * t);
                            break;
                    }

                    // Fade out envelope
                    if (fadeOut) {
                        const envelope = 1 - (i / length);
                        sample *= envelope * 0.4;
                    } else {
                        sample *= 0.3;
                    }

                    data[i] = sample;
                }

                return buffer;
            };

            // Register synthesized sounds
            const sounds = {
                'sfx_spell_cast': createTone(440, 0.2, 'sweep'),
                'sfx_spell_hit': createTone(220, 0.15, 'noise'),
                'sfx_enemy_death': createTone(150, 0.3, 'noise'),
                'sfx_player_hit': createTone(180, 0.1, 'square'),
                'sfx_level_up': createTone(660, 0.4, 'sine'),
                'sfx_quest_complete': createTone(880, 0.5, 'sine'),
                'sfx_loot_pickup': createTone(1200, 0.1, 'sine'),
                'sfx_ui_open': createTone(500, 0.08, 'sine'),
                'sfx_ui_close': createTone(400, 0.08, 'sine'),
                'sfx_npc_talk': createTone(300, 0.05, 'square')
            };

            for (const [key, buffer] of Object.entries(sounds)) {
                if (!this.cache.audio.exists(key)) {
                    this.cache.audio.add(key, { type: 'audio', data: buffer });
                }
            }

            console.log(`[BootScene] Generated ${Object.keys(sounds).length} placeholder audio effects`);
        } catch (err) {
            console.warn('[BootScene] Could not generate placeholder audio:', err.message);
        }
    }
}
