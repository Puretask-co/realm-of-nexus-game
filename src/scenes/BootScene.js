import dataManager from '../systems/DataManager.js';
import EventBus from '../core/EventBus.js';
import MainMenuScene from './MainMenuScene.js';
import { ImportedAssets } from './ImportedAssets.js';
import { ZoneBackdrops } from './ZoneBackdrops.js';
import { GameArt } from './GameArt.js';

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

        // ── Bulk imported assets (auto-generated registry) ────────────
        ImportedAssets.preload(this);
        ZoneBackdrops.preload(this);
        GameArt.preload(this);

        // ── Player ─────────────────────────────────────────────────────
        // Green mage spritesheet: 6 cols × 18 rows. The source sheet is
        // 1596×4788, so each frame is 266px (NOT 256) — slicing at 256
        // misaligned every frame and made the player render as a broken
        // floating fragment.
        this.load.spritesheet('player', 'assets/sprites/player.png', {
            frameWidth: 266, frameHeight: 266
        });

        // ── Enemies ────────────────────────────────────────────────────
        // Tree Titan walk (top-down): 6 cols × 10 rows, 256px
        this.load.spritesheet('enemy_treetitan', 'assets/sprites/enemies/enemy_treetitan_walk.png', {
            frameWidth: 256, frameHeight: 256
        });
        // Corrupted Titan walk (top-down): 5 cols × 7 rows, 256px
        this.load.spritesheet('enemy_corrupted_titan', 'assets/sprites/enemies/enemy_corrupted_titan_walk.png', {
            frameWidth: 256, frameHeight: 256
        });
        // Mushroom creature walk (front): 6 cols × 5 rows, 256px
        this.load.spritesheet('enemy_mushroom', 'assets/sprites/enemies/enemy_mushroom_walk.png', {
            frameWidth: 256, frameHeight: 256
        });
        // Generic warrior (front): 6 cols × 3 rows, 256px
        this.load.spritesheet('enemy_warrior', 'assets/sprites/enemies/enemy_warrior.png', {
            frameWidth: 256, frameHeight: 256
        });

        // ── NPC ────────────────────────────────────────────────────────
        // Mage NPC walk: 10 cols × 13 rows, 256px
        this.load.spritesheet('npc', 'assets/sprites/npcs/npc_mage_walk.png', {
            frameWidth: 256, frameHeight: 256
        });

        // ── Portrait images (UI: dialogue, character sheet, veilkeepers)
        this.load.image('portrait_hero',             'assets/sprites/characters/portrait_hero.png');
        this.load.image('portrait_bloomguard',       'assets/sprites/characters/portrait_bloomguard.png');
        this.load.image('portrait_lion',             'assets/sprites/characters/portrait_lion.png');
        this.load.image('portrait_veilkeeper',       'assets/sprites/npcs/portrait_veilkeeper.png');
        this.load.image('portrait_flower_girl',      'assets/sprites/npcs/portrait_flower_girl.png');
        this.load.image('portrait_fire_dragon',      'assets/sprites/enemies/portrait_fire_dragon.png');
        this.load.image('portrait_forest_guardian',  'assets/sprites/enemies/portrait_forest_guardian.png');
        this.load.image('portrait_mushroom',         'assets/sprites/enemies/portrait_mushroom_berserker.png');

        // ── Environment / World decorations ────────────────────────────
        this.load.image('env_props',         'assets/environment/props.png');
        this.load.image('env_trees',         'assets/environment/trees/trees_topdown.png');
        this.load.image('env_rocks',         'assets/environment/rocks/rocks.png');
        this.load.image('env_cave',          'assets/environment/cave_objects.png');
        this.load.image('tree1',             'assets/environment/trees/tree1.png');
        this.load.image('tree2',             'assets/environment/trees/tree2.png');
        this.load.image('tree3',             'assets/environment/trees/tree3.png');
        this.load.image('tree_moss1',        'assets/environment/trees/moss_tree1.png');
        this.load.image('tree_moss2',        'assets/environment/trees/moss_tree2.png');
        this.load.image('tree_autumn',       'assets/environment/trees/autumn_tree1.png');
        this.load.image('tree_flower1',      'assets/environment/trees/flower_tree1.png');
        this.load.image('tree_flower2',      'assets/environment/trees/flower_tree2.png');
        this.load.image('tree_broken',       'assets/environment/trees/broken_tree1.png');

        // ── Tilesets ───────────────────────────────────────────────────
        // Kenney RPG sheet: 16×16 tiles, 1px margin
        this.load.spritesheet('tileset_kenney', 'assets/tilesets/kenney_rpg.png', {
            frameWidth: 16, frameHeight: 16, margin: 1, spacing: 1
        });
        this.load.image('tileset_outdoor', 'assets/tilesets/outdoor.png');

        // Kenney zone tilesets (packed, no margin/spacing)
        this.load.image('ts_town',    'assets/tilesets/tiny_town/Tilemap/tilemap_packed.png');
        this.load.image('ts_dungeon', 'assets/tilesets/tiny_dungeon/Tilemap/tilemap_packed.png');

        // ── Kenney character icons (16×16, 1px margin) ─────────────────
        this.load.spritesheet('kenney_chars', 'assets/sprites/kenney_characters.png', {
            frameWidth: 16, frameHeight: 16, margin: 1, spacing: 1
        });

        // ── Additional enemy spritesheets ──────────────────────────────
        this.load.spritesheet('enemy_treetitan_attack', 'assets/sprites/enemies/enemy_treetitan_attack.png', {
            frameWidth: 256, frameHeight: 256
        });
        this.load.spritesheet('enemy_treetitan_death', 'assets/sprites/enemies/enemy_treetitan_death.png', {
            frameWidth: 256, frameHeight: 256
        });
        this.load.spritesheet('enemy_tree_idle', 'assets/sprites/enemies/enemy_tree_idle.png', {
            frameWidth: 256, frameHeight: 256
        });

        // ── Player action sheets ────────────────────────────────────────
        this.load.spritesheet('player_all_actions', 'assets/sprites/characters/player_all_actions.png', {
            frameWidth: 256, frameHeight: 256
        });
        this.load.spritesheet('player_swordattack', 'assets/sprites/characters/player_swordattack.png', {
            frameWidth: 256, frameHeight: 256
        });

        // ── Companion / NPC portraits ───────────────────────────────────
        this.load.image('portrait_companion_vaeril',   'assets/sprites/characters/portrait_companion_vaeril.png');
        this.load.image('portrait_companion_aeliana',  'assets/sprites/characters/portrait_companion_aeliana.png');
        this.load.image('portrait_corrupted_hero',     'assets/sprites/enemies/portrait_corrupted_hero.png');
        this.load.image('portrait_corrupted_bloomguard', 'assets/sprites/enemies/portrait_corrupted_bloomguard.png');

        // ── SFX — combat ────────────────────────────────────────────────
        this.load.audio('sfx_attack1',    'assets/audio/sfx/Attack1.ogg');
        this.load.audio('sfx_attack2',    'assets/audio/sfx/Attack2.ogg');
        this.load.audio('sfx_attack3',    'assets/audio/sfx/Attack3.ogg');
        this.load.audio('sfx_slash1',     'assets/audio/sfx/Slash1.ogg');
        this.load.audio('sfx_slash2',     'assets/audio/sfx/Slash2.ogg');
        this.load.audio('sfx_slash3',     'assets/audio/sfx/Slash3.ogg');
        this.load.audio('sfx_sword1',     'assets/audio/sfx/Sword1.ogg');
        this.load.audio('sfx_sword2',     'assets/audio/sfx/Sword2.ogg');
        this.load.audio('sfx_damage1',    'assets/audio/sfx/Damage1.ogg');
        this.load.audio('sfx_damage2',    'assets/audio/sfx/Damage2.ogg');
        this.load.audio('sfx_damage3',    'assets/audio/sfx/Damage3.ogg');
        this.load.audio('sfx_blow1',      'assets/audio/sfx/Blow1.ogg');
        this.load.audio('sfx_blow2',      'assets/audio/sfx/Blow2.ogg');
        this.load.audio('sfx_collapse1',  'assets/audio/sfx/Collapse1.ogg');

        // ── SFX — spells (by element) ───────────────────────────────────
        this.load.audio('sfx_magic1',     'assets/audio/sfx/Magic1.ogg');
        this.load.audio('sfx_magic2',     'assets/audio/sfx/Magic2.ogg');
        this.load.audio('sfx_magic3',     'assets/audio/sfx/Magic3.ogg');
        this.load.audio('sfx_magic4',     'assets/audio/sfx/Magic4.ogg');
        this.load.audio('sfx_magic5',     'assets/audio/sfx/Magic5.ogg');
        this.load.audio('sfx_skill1',     'assets/audio/sfx/Skill1.ogg');
        this.load.audio('sfx_skill2',     'assets/audio/sfx/Skill2.ogg');
        this.load.audio('sfx_skill3',     'assets/audio/sfx/Skill3.ogg');
        this.load.audio('sfx_fire1',      'assets/audio/sfx/Fire1.ogg');
        this.load.audio('sfx_fire2',      'assets/audio/sfx/Fire2.ogg');
        this.load.audio('sfx_fire3',      'assets/audio/sfx/Fire3.ogg');
        this.load.audio('sfx_thunder1',   'assets/audio/sfx/Thunder1.ogg');
        this.load.audio('sfx_thunder2',   'assets/audio/sfx/Thunder2.ogg');
        this.load.audio('sfx_thunder3',   'assets/audio/sfx/Thunder3.ogg');
        this.load.audio('sfx_wind1',      'assets/audio/sfx/Wind1.ogg');
        this.load.audio('sfx_wind2',      'assets/audio/sfx/Wind2.ogg');
        this.load.audio('sfx_water1',     'assets/audio/sfx/Water1.ogg');
        this.load.audio('sfx_water2',     'assets/audio/sfx/Water2.ogg');
        this.load.audio('sfx_ice1',       'assets/audio/sfx/Ice1.ogg');
        this.load.audio('sfx_ice2',       'assets/audio/sfx/Ice2.ogg');
        this.load.audio('sfx_heal1',      'assets/audio/sfx/Heal1.ogg');
        this.load.audio('sfx_heal2',      'assets/audio/sfx/Heal2.ogg');
        this.load.audio('sfx_heal3',      'assets/audio/sfx/Heal3.ogg');
        this.load.audio('sfx_saint1',     'assets/audio/sfx/Saint1.ogg');
        this.load.audio('sfx_saint2',     'assets/audio/sfx/Saint2.ogg');
        this.load.audio('sfx_teleport',   'assets/audio/sfx/Teleport.ogg');
        this.load.audio('sfx_poison',     'assets/audio/sfx/Poison.ogg');
        this.load.audio('sfx_recovery',   'assets/audio/sfx/Recovery.ogg');

        // ── SFX — UI & game events ──────────────────────────────────────
        this.load.audio('sfx_cursor1',    'assets/audio/sfx/Cursor1.ogg');
        this.load.audio('sfx_cursor2',    'assets/audio/sfx/Cursor2.ogg');
        this.load.audio('sfx_cancel1',    'assets/audio/sfx/Cancel1.ogg');
        this.load.audio('sfx_coin',       'assets/audio/sfx/Coin.ogg');
        this.load.audio('sfx_save',       'assets/audio/sfx/Save.ogg');
        this.load.audio('sfx_powerup',    'assets/audio/sfx/Powerup.ogg');
        this.load.audio('sfx_levelup',    'assets/audio/sfx/Up1.ogg');
        this.load.audio('sfx_chime1',     'assets/audio/sfx/Chime1.ogg');
        this.load.audio('sfx_chime2',     'assets/audio/sfx/Chime2.ogg');
        this.load.audio('sfx_bell1',      'assets/audio/sfx/Bell1.ogg');

        // ── Kenney UI Pack RPG Expansion ───────────────────────────────
        // Single spritesheet atlas — used by all UI panels
        this.load.atlasXML(
            'ui_rpg',
            'assets/ui/Spritesheet/uipack_rpg_sheet.png',
            'assets/ui/Spritesheet/uipack_rpg_sheet.xml'
        );

        // ── Kenney Particle Pack (transparent PNGs) ─────────────────────
        const particleNames = [
            'circle_01','circle_02','circle_03','circle_04','circle_05',
            'fire_01','fire_02',
            'flame_01','flame_02','flame_03','flame_04','flame_05','flame_06',
            'flare_01',
            'light_01','light_02','light_03',
            'magic_01','magic_02','magic_03','magic_04','magic_05',
            'scorch_01','scorch_02',
            'slash_01','slash_02','slash_03','slash_04',
            'smoke_01','smoke_02','smoke_03','smoke_04',
            'spark_01','spark_02','spark_03','spark_04','spark_05','spark_06','spark_07',
            'star_01','star_02','star_03','star_04','star_05',
            'symbol_01','symbol_02',
            'trace_01','trace_02','trace_03','trace_04',
            'twirl_01','twirl_02','twirl_03',
            'dirt_01','dirt_02',
        ];
        for (const p of particleNames) {
            this.load.image(`particle_${p}`, `assets/vfx/particles/PNG (Transparent)/${p}.png`);
        }

        // ── VFX spritesheets (RPGVXAce animation frames, 192px wide strips) ─
        const vfxSpells = ['fire1','fire2','fire3','ice1','ice2','ice3','thunder1','thunder2',
            'wind1','wind2','water1','water2','heal1','heal2','heal3','light1','light2',
            'darkness1','earth1','special1','special2','special3','special4'];
        const vfxCombat = ['attack1','attack2','attack3','blow1','blow2','sword1','sword2','death1'];
        // Load as plain images (used as animation frames by AdvancedParticleSystem)
        for (const name of vfxSpells) {
            this.load.image(`vfx_${name}`, `assets/vfx/spells/vfx_${name}.png`);
        }
        for (const name of vfxCombat) {
            this.load.image(`vfx_${name}`, `assets/vfx/combat/vfx_${name}.png`);
        }

        // ── BGM ─────────────────────────────────────────────────────────
        this.load.audio('bgm_menu',       'assets/audio/bgm/menu.ogg');
        this.load.audio('bgm_battle',     'assets/audio/bgm/battle.ogg');
        this.load.audio('bgm_boss',       'assets/audio/bgm/boss.ogg');
        this.load.audio('bgm_dungeon',    'assets/audio/bgm/dungeon.ogg');
        this.load.audio('bgm_exploration','assets/audio/bgm/exploration.ogg');
        this.load.audio('bgm_town',       'assets/audio/bgm/town.ogg');
        this.load.audio('bgm_victory',    'assets/audio/bgm/victory.ogg');
        this.load.audio('bgm_gameover',   'assets/audio/bgm/gameover.ogg');
    }

    create() {
        document.getElementById('boot-message')?.setAttribute('hidden', '');

        // Register all sprite animations (done once here, available globally)
        this._createAnimations();

        // Generate placeholder textures for any keys not covered by real assets
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

            // Dev-only: ?skipToGame=true jumps straight to GameScene with defaults
            const params = new URLSearchParams(window.location.search);
            if (import.meta.env.DEV && params.get('skipToGame') === 'true') {
                console.log('[BootScene] DEV: skipToGame active — jumping to GameScene');
                const classes = dataManager.getAllClasses?.() || [];
                const firstClass = classes[0] || { id: 'verdant_guardian', name: 'Verdant Guardian' };
                this.registry.set('selectedClass', firstClass.id || firstClass.name || 'verdant_guardian');
                this.registry.set('selectedAncestry', 'heartwood');
                this.registry.set('selectedVariant', 'pure');
                this.registry.set('playerName', 'TestHero');
                this.registry.set('characterAttributes', { might: 2, agility: 2, resilience: 2, insight: 2, presence: 2 });
                this.scene.start('GameScene');
            } else {
                console.log('[BootScene] Boot complete, starting main menu...');
                this._ensureMainMenu();
                this.scene.start('MainMenuScene');
            }
        }).catch((err) => {
            console.error('[BootScene] Data load failed, using fallbacks:', err);
            this._ensureMainMenu();
            this.scene.start('MainMenuScene');
        });
    }

    // ----------------------------------------------------------------
    // Dynamic scene registration
    // ----------------------------------------------------------------

    /**
     * Registers MainMenuScene with Phaser's SceneManager at runtime so it
     * doesn't need to be listed in main.js. Safe to call multiple times.
     */
    _ensureMainMenu() {
        if (!this.scene.get('MainMenuScene')) {
            this.scene.add('MainMenuScene', MainMenuScene, false);
        }
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
            fontFamily: 'Open Sans', fontSize: '34px', color: '#88aaff'
        }).setOrigin(0.5);

        this.add.text(width / 2, y - 16, 'Loading...', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#aaaacc'
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

        // ---- Class-specific player sprites ----
        // Temporal Mage: blue robed figure with clock motif
        if (!this.textures.exists('class_temporal_mage')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x223388, 1);
            gfx.fillRoundedRect(8, 10, 16, 18, 3);
            gfx.fillStyle(0x4488ff, 1);
            gfx.fillCircle(16, 8, 7);
            // Hat
            gfx.fillStyle(0x2244aa, 1);
            gfx.fillTriangle(10, 6, 16, -4, 22, 6);
            // Clock symbol on body
            gfx.lineStyle(1, 0x88bbff, 0.8);
            gfx.strokeCircle(16, 19, 4);
            gfx.lineBetween(16, 17, 16, 19);
            gfx.lineBetween(16, 19, 18, 20);
            // Eyes
            gfx.fillStyle(0x88ccff, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('class_temporal_mage', 32, 32);
            gfx.destroy();
        }

        // Crimson Berserker: red muscular figure with horns
        if (!this.textures.exists('class_crimson_berserker')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x881122, 1);
            gfx.fillRoundedRect(6, 10, 20, 18, 3);
            gfx.fillStyle(0xcc2233, 1);
            gfx.fillCircle(16, 8, 7);
            // Horns
            gfx.fillStyle(0xff4422, 1);
            gfx.fillTriangle(10, 4, 8, -2, 12, 4);
            gfx.fillTriangle(20, 4, 24, -2, 22, 4);
            // Broad shoulders
            gfx.fillStyle(0x991122, 1);
            gfx.fillRect(4, 12, 6, 8);
            gfx.fillRect(22, 12, 6, 8);
            // Eyes
            gfx.fillStyle(0xff6644, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('class_crimson_berserker', 32, 32);
            gfx.destroy();
        }

        // Silver Warden: silver armored figure with shield
        if (!this.textures.exists('class_silver_warden')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x556688, 1);
            gfx.fillRoundedRect(8, 10, 16, 18, 3);
            gfx.fillStyle(0x8899bb, 1);
            gfx.fillCircle(16, 8, 7);
            // Helmet visor
            gfx.fillStyle(0xaabbdd, 1);
            gfx.fillRect(11, 5, 10, 3);
            // Shield on left
            gfx.fillStyle(0x99aacc, 1);
            gfx.fillRoundedRect(2, 12, 8, 14, 2);
            gfx.lineStyle(1, 0xccddff, 0.7);
            gfx.strokeRoundedRect(2, 12, 8, 14, 2);
            // Eyes
            gfx.fillStyle(0xccddff, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('class_silver_warden', 32, 32);
            gfx.destroy();
        }

        // Verdant Druid: green robed figure with leaf crown
        if (!this.textures.exists('class_verdant_druid')) {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x226633, 1);
            gfx.fillRoundedRect(8, 10, 16, 18, 3);
            gfx.fillStyle(0x44aa55, 1);
            gfx.fillCircle(16, 8, 7);
            // Leaf crown
            gfx.fillStyle(0x66dd66, 1);
            gfx.fillTriangle(10, 4, 13, -2, 16, 4);
            gfx.fillTriangle(16, 4, 19, -2, 22, 4);
            // Staff
            gfx.fillStyle(0x886633, 1);
            gfx.fillRect(24, 4, 2, 24);
            gfx.fillStyle(0x44ff44, 1);
            gfx.fillCircle(25, 4, 3);
            // Eyes
            gfx.fillStyle(0x88ff88, 1);
            gfx.fillCircle(14, 7, 1.5);
            gfx.fillCircle(18, 7, 1.5);
            gfx.generateTexture('class_verdant_druid', 32, 32);
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

        // Loot sparkle (Phaser Graphics has no fillStar — use circles + triangles)
        if (!this.textures.exists('loot_sparkle')) {
            const gfx = this.add.graphics();
            const cx = 8;
            const cy = 8;
            gfx.fillStyle(0xffdd44, 1);
            gfx.fillCircle(cx, cy, 5);
            gfx.fillStyle(0xffffaa, 1);
            gfx.fillCircle(cx - 2, cy - 2, 2);
            // small cross glint
            gfx.fillStyle(0xffffff, 0.9);
            gfx.fillTriangle(cx, cy - 7, cx - 2, cy - 1, cx + 2, cy - 1);
            gfx.fillTriangle(cx, cy + 7, cx - 2, cy + 1, cx + 2, cy + 1);
            gfx.fillTriangle(cx - 7, cy, cx - 1, cy - 2, cx - 1, cy + 2);
            gfx.fillTriangle(cx + 7, cy, cx + 1, cy - 2, cx + 1, cy + 2);
            gfx.generateTexture('loot_sparkle', 16, 16);
            gfx.destroy();
        }

        console.log('[BootScene] Placeholder textures generated (player, 3 enemy types, NPC, world)');
    }

    // ----------------------------------------------------------------
    // Animation definitions — registered once, available in all scenes
    // ----------------------------------------------------------------

    _createAnimations() {
        const a = this.anims;

        // ── Player (6 cols × 18 rows = 108 frames) ─────────────────────
        // Row layout (each row = 6 frames):
        //   Row 0  (frames 0-5):   Idle
        //   Row 1  (frames 6-11):  Walk
        //   Row 2  (frames 12-17): Run
        //   Row 3  (frames 18-23): Attack 1
        //   Row 4  (frames 24-29): Attack 2
        //   Row 5  (frames 30-35): Cast spell
        //   Row 6  (frames 36-41): Take damage
        //   Row 7  (frames 42-47): Death
        //   Rows 8-17: additional states / variations

        if (!a.exists('player-idle')) {
            a.create({ key: 'player-idle',   frames: a.generateFrameNumbers('player', { start: 0,  end: 5  }), frameRate: 6,  repeat: -1 });
            a.create({ key: 'player-walk',   frames: a.generateFrameNumbers('player', { start: 6,  end: 11 }), frameRate: 10, repeat: -1 });
            a.create({ key: 'player-run',    frames: a.generateFrameNumbers('player', { start: 12, end: 17 }), frameRate: 12, repeat: -1 });
            a.create({ key: 'player-attack', frames: a.generateFrameNumbers('player', { start: 18, end: 23 }), frameRate: 10, repeat: 0  });
            a.create({ key: 'player-cast',   frames: a.generateFrameNumbers('player', { start: 30, end: 35 }), frameRate: 10, repeat: 0  });
            a.create({ key: 'player-hurt',   frames: a.generateFrameNumbers('player', { start: 36, end: 41 }), frameRate: 10, repeat: 0  });
            a.create({ key: 'player-death',  frames: a.generateFrameNumbers('player', { start: 42, end: 47 }), frameRate: 8,  repeat: 0  });
        }

        // ── Tree Titan enemy (top-down walk: 6 cols × 10 rows = 60 frames)
        if (!a.exists('enemy_treetitan-walk')) {
            a.create({ key: 'enemy_treetitan-walk',  frames: a.generateFrameNumbers('enemy_treetitan', { start: 0, end: 59 }), frameRate: 12, repeat: -1 });
        }

        // ── Corrupted Titan (top-down walk: 5 cols × 7 rows = 35 frames)
        if (!a.exists('enemy_corrupted_titan-walk')) {
            a.create({ key: 'enemy_corrupted_titan-walk', frames: a.generateFrameNumbers('enemy_corrupted_titan', { start: 0, end: 34 }), frameRate: 10, repeat: -1 });
        }

        // ── Mushroom walk (front: 6 cols × 5 rows = 30 frames)
        // Rows: 0=walk normal, 1=walk variant, 2=walk glowing, 3=walk aura, 4=partial
        if (!a.exists('enemy_mushroom-walk')) {
            a.create({ key: 'enemy_mushroom-walk',  frames: a.generateFrameNumbers('enemy_mushroom', { start: 0, end: 5  }), frameRate: 8, repeat: -1 });
            a.create({ key: 'enemy_mushroom-rage',  frames: a.generateFrameNumbers('enemy_mushroom', { start: 12, end: 17 }), frameRate: 10, repeat: -1 });
        }

        // ── Warrior enemy (front: 6 cols × 3 rows = 18 frames)
        if (!a.exists('enemy_warrior-idle')) {
            a.create({ key: 'enemy_warrior-idle',   frames: a.generateFrameNumbers('enemy_warrior', { start: 0, end: 5  }), frameRate: 6, repeat: -1 });
            a.create({ key: 'enemy_warrior-attack', frames: a.generateFrameNumbers('enemy_warrior', { start: 6, end: 11 }), frameRate: 10, repeat: 0  });
        }

        // ── NPC mage walk (10 cols × 13 rows = 130 frames)
        if (!a.exists('npc-walk')) {
            a.create({ key: 'npc-walk', frames: a.generateFrameNumbers('npc', { start: 0, end: 9 }), frameRate: 8, repeat: -1 });
            a.create({ key: 'npc-idle', frames: a.generateFrameNumbers('npc', { start: 0, end: 0 }), frameRate: 4, repeat: -1 });
        }

        // ── Tree Titan attack (6 cols × 5 rows = 30 frames)
        if (!a.exists('enemy_treetitan-attack') && a.anims.has('enemy_treetitan_attack') ||
            this.textures.exists('enemy_treetitan_attack')) {
            a.create({ key: 'enemy_treetitan-attack', frames: a.generateFrameNumbers('enemy_treetitan_attack', { start: 0, end: 29 }), frameRate: 10, repeat: 0 });
            a.create({ key: 'enemy_treetitan-death',  frames: a.generateFrameNumbers('enemy_treetitan_death',  { start: 0, end: 24 }), frameRate: 8,  repeat: 0 });
        }

        // ── Tree idle (8 cols × 13 rows = 104 frames)
        if (this.textures.exists('enemy_tree_idle') && !a.exists('enemy_tree-idle')) {
            a.create({ key: 'enemy_tree-idle', frames: a.generateFrameNumbers('enemy_tree_idle', { start: 0, end: 23 }), frameRate: 6, repeat: -1 });
        }

        // ── Player sword attack (7 cols × 9 rows = 63 frames)
        if (this.textures.exists('player_swordattack') && !a.exists('player-sword')) {
            a.create({ key: 'player-sword', frames: a.generateFrameNumbers('player_swordattack', { start: 0, end: 62 }), frameRate: 14, repeat: 0 });
        }

        // ── HD Tree Titan from imported sheets (opt-in upgrade) ─────────
        // Walk: 10 cols × 5 rows = 50 frames; Attack: 14 cols × 5 rows = 70;
        // Damage/Die: 5 cols × 6 rows = 30 frames (split first half = hurt,
        // second half = death).
        const hdWalkKey = 'imp_treetitan_treetitanwalk_top_down_10col_5row_256px';
        if (this.textures.exists(hdWalkKey) && !a.exists('treetitan-hd-walk')) {
            a.create({ key: 'treetitan-hd-walk', frames: a.generateFrameNumbers(hdWalkKey, { start: 0, end: 49 }), frameRate: 14, repeat: -1 });
        }
        const hdAttackKey = 'imp_treetitan_treetitanswordattack_top_down_14col_5row_256px';
        if (this.textures.exists(hdAttackKey) && !a.exists('treetitan-hd-attack')) {
            a.create({ key: 'treetitan-hd-attack', frames: a.generateFrameNumbers(hdAttackKey, { start: 0, end: 69 }), frameRate: 18, repeat: 0 });
        }
        const hdHurtKey = 'imp_tree_titan_treetitantakedamagedie_top_down_5col_6row_256px';
        if (this.textures.exists(hdHurtKey) && !a.exists('treetitan-hd-hurt')) {
            a.create({ key: 'treetitan-hd-hurt',  frames: a.generateFrameNumbers(hdHurtKey, { start: 0,  end: 14 }), frameRate: 12, repeat: 0 });
            a.create({ key: 'treetitan-hd-death', frames: a.generateFrameNumbers(hdHurtKey, { start: 15, end: 29 }), frameRate: 10, repeat: 0 });
        }

        // ── HD Corrupted Tree Titan (5 cols × 7 rows = 35 frames) ──────
        const corruptedHdKey = 'imp_corruptedtreetitan_walk_top_down_5col_7row_256px';
        if (this.textures.exists(corruptedHdKey) && !a.exists('corrupted-titan-hd-walk')) {
            a.create({ key: 'corrupted-titan-hd-walk', frames: a.generateFrameNumbers(corruptedHdKey, { start: 0, end: 34 }), frameRate: 12, repeat: -1 });
        }

        // ── Corrupted Tree Sentinel (smaller corrupted enemy, 7×3) ─────
        const sentinelKey = 'imp_corrupted_tree_sentenel_run_top_down_7col_3row_256px';
        if (this.textures.exists(sentinelKey) && !a.exists('corrupted-sentinel-run')) {
            a.create({ key: 'corrupted-sentinel-run', frames: a.generateFrameNumbers(sentinelKey, { start: 0, end: 20 }), frameRate: 14, repeat: -1 });
        }

        // ── Druid NPC walk (8×3 = 24 frames) ────────────────────────────
        const druidKey = 'imp_druid_run_top_down_8col_3row_256px';
        if (this.textures.exists(druidKey) && !a.exists('npc-druid-run')) {
            a.create({ key: 'npc-druid-run', frames: a.generateFrameNumbers(druidKey, { start: 0, end: 23 }), frameRate: 12, repeat: -1 });
        }

        // ── Imported decorative tree idle (8×3 = 24 frames) ─────────────
        const idleTreeKey = 'imp_tree_idle_top_down_8col_3row_256px';
        if (this.textures.exists(idleTreeKey) && !a.exists('decor-tree-idle')) {
            a.create({ key: 'decor-tree-idle', frames: a.generateFrameNumbers(idleTreeKey, { start: 0, end: 23 }), frameRate: 5, repeat: -1 });
        }

        console.log('[BootScene] Animations registered');
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
