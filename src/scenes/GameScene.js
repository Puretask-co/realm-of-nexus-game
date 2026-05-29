import Phaser from 'phaser';
import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';
import SapCycleManager from '../systems/SapCycleManager.js';
import AdvancedLightingSystem from '../systems/AdvancedLightingSystem.js';
import AdvancedParticleSystem from '../systems/AdvancedParticleSystem.js';
import AdvancedCameraSystem from '../systems/AdvancedCameraSystem.js';
import PerformanceProfiler from '../systems/PerformanceProfiler.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { SpellSystem } from '../systems/SpellSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import CooldownManager from '../systems/CooldownManager.js';
import SaveManager from '../systems/SaveManager.js';
import ContentInitializer from '../systems/ContentInitializer.js';
import DamageNumberRenderer from '../renderers/DamageNumberRenderer.js';
import MinimapRenderer from '../renderers/MinimapRenderer.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';
import NPC from '../components/NPC.js';

// ---- New Systems (Design Doc aligned) ----
import { TacticalCombatSystem } from '../systems/TacticalCombatSystem.js';
import { DSPSystem } from '../systems/DSPSystem.js';
import { AttributeSystem } from '../systems/AttributeSystem.js';
import { FactionSystem } from '../systems/FactionSystem.js';
import { VeilkeeperSystem } from '../systems/VeilkeeperSystem.js';
import { NarrativeSystem } from '../systems/NarrativeSystem.js';
import { MoralChoiceSystem } from '../systems/MoralChoiceSystem.js';
import { CompanionSystem } from '../systems/CompanionSystem.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { SkillCheckSystem } from '../systems/SkillCheckSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';
import { AIDungeonMaster } from '../systems/AIDungeonMaster.js';
import SpellVFXIntegration from '../integration/SpellVFXIntegration.js';
import { SapCycleLightingIntegration } from '../integration/SapCycleLightingIntegration.js';
import TacticalCombatCameraBridge from '../integration/TacticalCombatCameraBridge.js';
import { EndingEvaluator } from '../systems/EndingEvaluator.js';
import { AttackTypeSystem } from '../systems/AttackTypeSystem.js';
import { PortalSystem } from '../systems/PortalSystem.js';
import StashSystem from '../systems/StashSystem.js';
import ZoneContentManager from '../systems/ZoneContentManager.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import TutorialSystem from '../systems/TutorialSystem.js';
import ZoneTilemapBuilder from '../systems/ZoneTilemapBuilder.js';
import { ZoneBackdrops } from './ZoneBackdrops.js';
import { PAINTERLY_ENEMY_MAP, BOSS_IDS, npcArtFor, companionArtFor } from './GameArt.js';
import MotionLibrary from '../systems/MotionLibrary.js';
import { AudioManager } from '../systems/AudioManager.js';
import ParticleEffects from '../systems/ParticleEffects.js';
import PhysicsSystem from '../systems/PhysicsSystem.js';

/**
 * GameScene — Main gameplay scene.
 *
 * Responsibilities:
 *  1. Initialise all engine systems (lighting, particles, camera, sap cycle, profiler).
 *  2. Build the world from location data with distinct zone visuals.
 *  3. Spawn the player, enemies, and NPCs.
 *  4. Handle input (movement, spell casting, UI hotkeys).
 *  5. Drive per-frame updates for every system.
 *  6. Process combat, loot drops, quest updates via EventBus events.
 *  7. Manage death/respawn cycle.
 */
export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this._resumeZone = data?.resumeZone || null;
    }

    create() {
        try {
            this._create();
        } catch (err) {
            console.error('[GameScene] FATAL create() error:', err);
            const { width, height } = this.scale;
            this.add.rectangle(width / 2, height / 2, width, height, 0x110022).setScrollFactor(0);
            this.add.text(width / 2, height / 2 - 40, 'GameScene failed to load', {
                fontSize: '24px', color: '#ff4444', fontFamily: 'monospace'
            }).setOrigin(0.5).setScrollFactor(0);
            this.add.text(width / 2, height / 2 + 10, err.message, {
                fontSize: '14px', color: '#ffaaaa', fontFamily: 'monospace', wordWrap: { width: width - 40 }
            }).setOrigin(0.5, 0).setScrollFactor(0);
        }
    }

    _create() {
        this._unsubs = [];

        // ---- Core Systems ----
        this.sapCycle = new SapCycleManager(this);
        this.lighting = new AdvancedLightingSystem(this);
        this.particles = new AdvancedParticleSystem(this);
        this.cameraSystem = new AdvancedCameraSystem(this);
        this.profiler = new PerformanceProfiler(this);

        // Integration layer: spell VFX, sap-phase lighting, tactical combat camera feedback
        this.spellVfxIntegration = new SpellVFXIntegration();
        this.spellVfxIntegration.bind(this.particles, this.lighting, this.cameraSystem);
        this.sapCycleLightingIntegration = new SapCycleLightingIntegration(this.lighting);
        this.sapCycleLightingIntegration.syncInitialPhase(this.sapCycle.currentPhase);
        this.tacticalCombatCameraBridge = new TacticalCombatCameraBridge(this.cameraSystem);

        // ---- Gameplay Systems (singletons) ----
        this.combatSystem = CombatSystem.getInstance();
        this.attackTypeSystem = AttackTypeSystem.getInstance();
        this.tacticalCombat = TacticalCombatSystem.getInstance();
        this.aiSystem = AISystem.getInstance();
        this.progression = ProgressionSystem.getInstance();
        this.spellSystem = SpellSystem.getInstance();
        this.questSystem = QuestSystem.getInstance();
        this.dialogueSystem = DialogueSystem.getInstance(this);

        // ---- Class System ----
        this.classSystem = PlayerClassSystem.getInstance();

        // ---- New Design-Doc Systems ----
        this.dspSystem = DSPSystem.getInstance();
        this.attributeSystem = AttributeSystem.getInstance();
        this.factionSystem = FactionSystem.getInstance();
        this.veilkeeperSystem = VeilkeeperSystem.getInstance();
        this.narrativeSystem = NarrativeSystem.getInstance();
        this.moralChoiceSystem = MoralChoiceSystem.getInstance();
        this.companionSystem = CompanionSystem.getInstance();
        this.craftingSystem = CraftingSystem.getInstance();
        this.skillCheckSystem = SkillCheckSystem.getInstance();
        this.difficultySystem = DifficultySystem.getInstance();
        this.dungeonMaster = AIDungeonMaster.getInstance();
        this.equipmentSystem = EquipmentSystem.getInstance();
        this.tutorialSystem = TutorialSystem;

        // ---- Utilities ----
        this.cooldowns = new CooldownManager();
        this.saveManager = new SaveManager();

        // ---- Renderers ----
        this.damageNumbers = new DamageNumberRenderer(this);
        // Minimap maps the single active-zone bounds (one zone on screen).
        this.minimap = new MinimapRenderer(this, {
            worldWidth: GameScene.ACTIVE_W,
            worldHeight: GameScene.ACTIVE_H,
        });

        // ---- Content Registration ----
        ContentInitializer.registerQuests();
        ContentInitializer.registerDialogues(this);
        ContentInitializer.registerFactions(this.factionSystem);
        ContentInitializer.registerNarrative(this.narrativeSystem);
        ContentInitializer.registerVeilkeepers(this.veilkeeperSystem);
        ContentInitializer.registerCompanions(this.companionSystem);

        // ---- Portal System (Silver phase portals) ----
        this.portalSystem = new PortalSystem();
        this.portalSystem.init(this);

        // ---- Stash System (item vault) ----
        this.stashSystem = StashSystem.getInstance();

        // ---- Audio ----
        this.audioManager = AudioManager.getInstance(this);
        this.audioManager.wireToGame(this);

        // ---- Particle Effects (real Kenney textures) ----
        this.particleEffects = new ParticleEffects(this);
        this.particleEffects.init();

        // ---- Physics System (knockback, acceleration movement, zone modifiers, projectiles) ----
        this.physicsSystem = new PhysicsSystem(this);
        // init() is called after player is spawned (needs player.body)

        // ---- World ----
        this._buildWorld();

        // ---- Zone Content Manager (per-zone visuals, enemies, music mood) ----
        this.zoneContentManager = new ZoneContentManager(this);
        // Initial zone entered after world is built; deferred so _unsubs is set up first
        this._pendingInitialZone = this._resumeZone || this.currentZone || 'canopy_of_life';

        // ---- Player ----
        this._createPlayer();

        // ---- Physics System init (needs player.body to exist) ----
        this.physicsSystem.init();

        // ---- Enemies (zone-based) ----
        this._spawnEnemies();

        // ---- NPCs ----
        this._spawnNPCs();

        // ---- Companion followers (any already in the party) ----
        this._syncCompanionFollowers();

        // ---- Camera ----
        this.cameraSystem.startFollow(this.player, {
            lerpX: 0.08,
            lerpY: 0.08,
            offsetY: -20
        });
        this.cameraSystem.enableLookAhead(120, 0.04);

        // ---- Lighting setup ----
        this._setupLighting();

        // ---- Input ----
        this._setupInput();

        // ---- Launch UI overlay ----
        this.scene.launch('UIScene');

        // Dev: expose debug API for automated testing (Playwright / manual testing)
        if (import.meta.env.DEV) {
            window.__gameDebug = {
                dealDamageToPlayer: (amount) => {
                    if (this.player?.stats) {
                        this.player.stats.hp = Math.max(0, this.player.stats.hp - amount);
                        EventBus.emit('player-stats-updated', this.player.stats);
                        if (this.player.stats.hp <= 0) this._onPlayerDeath();
                    }
                },
                killPlayer: () => {
                    if (this.player?.stats) {
                        this.player.stats.hp = 0;
                        EventBus.emit('player-stats-updated', this.player.stats);
                        this._onPlayerDeath();
                    }
                },
                teleportPlayer: (x, y) => {
                    if (this.player) this.player.setPosition(x, y);
                },
                addGold: (amount) => {
                    if (this.player?.stats) {
                        this.player.stats.gold = (this.player.stats.gold || 0) + amount;
                        EventBus.emit('player-stats-updated', this.player.stats);
                    }
                },
                addItem: (itemId, quantity = 1) => {
                    const itemData = window.__dataManager?.getItem?.(itemId) || { id: itemId, name: itemId };
                    EventBus.emit('inventory:addItem', { itemId, quantity, itemData });
                },
                setDSP: (value) => {
                    if (this.dspSystem) {
                        this.dspSystem.current = Math.max(0, Math.min(this.dspSystem.max, value));
                        EventBus.emit('dsp:changed', this.dspSystem.getStatus());
                    }
                },
                getState: () => window.__gameState,
                // Force a tactical encounter for testing the grid renderer.
                startTacticalDemo: () => {
                    const live = this.enemies.getChildren().filter(e => e.active).slice(0, 3);
                    if (live.length) this._startTacticalEncounter(live);
                    else this.tacticalCombat.startCombat({
                        allies: [{ id: 'player', name: this.player.stats?.name || 'Hero',
                            stats: { hp: this.player.stats.hp, maxHp: this.player.stats.maxHp, guard: 0, maxGuard: 10, might: 3, agility: 3, ap: 2, speed: 4 } }],
                        enemies: [
                            { id: 'dummy1', name: 'Thornling', stats: { hp: 24, maxHp: 24, guard: 0, might: 2, agility: 2, ap: 2, speed: 3 } },
                            { id: 'dummy2', name: 'Sap Beetle', stats: { hp: 18, maxHp: 18, guard: 0, might: 2, agility: 3, ap: 2, speed: 3 } },
                        ],
                        gridWidth: 10, gridHeight: 7,
                    });
                }
            };
            // Also expose dataManager for debug convenience
            window.__dataManager = window.__dataManager || {};
        }

        // ---- Hotkeys ----
        this.input.keyboard.on('keydown-F2', () => {
            this.scene.switch('EditorScene');
        });

        // ---- Minimap binding ----
        this.minimap.bind(this.player, this.enemies, this.npcs, this.cameras.main);

        // ---- Auto-save ----
        this.saveManager.enableAutoSave(60000);

        // ---- Wire save system ----
        this._unsubSaveSystem = ContentInitializer.wireSaveSystem({
            questSystem: this.questSystem,
            dialogueSystem: this.dialogueSystem,
            progressionSystem: this.progression,
            dspSystem: this.dspSystem,
            factionSystem: this.factionSystem,
            narrativeSystem: this.narrativeSystem,
            moralChoiceSystem: this.moralChoiceSystem,
            companionSystem: this.companionSystem,
            attributeSystem: this.attributeSystem,
            veilkeeperSystem: this.veilkeeperSystem,
            skillCheckSystem: this.skillCheckSystem,
            sapCycleManager: this.sapCycle
        });

        // ---- Inventory cache (used by CraftingPanel for material checks) ----
        this._inventoryCache = {};

        // ---- EventBus listeners ----
        this._unsubs.push(
            EventBus.on('spell-cast', (data) => this._onSpellCast(data)),
            EventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data)),
            EventBus.on('combat:effectApplied', (data) => this._onCombatEffectApplied(data)),
            EventBus.on('shop:deductGold', (data) => {
                if (this.player?.stats) {
                    this.player.stats.gold = Math.max(0, (this.player.stats.gold || 0) - (data.amount || 0));
                    EventBus.emit('player-stats-updated', this.player.stats);
                }
            }),
            EventBus.on('inventory:addItem', (data) => {
                const id = data.itemId;
                if (id) this._inventoryCache[id] = (this._inventoryCache[id] || 0) + (data.quantity || 1);
            }),
            EventBus.on('inventory:removeItem', (data) => {
                const id = data.itemId;
                if (id) this._inventoryCache[id] = Math.max(0, (this._inventoryCache[id] || 0) - (data.quantity || 1));
            }),
            EventBus.on('crafting-open', () => {
                // Send current inventory snapshot so CraftingPanel can check materials accurately
                EventBus.emit('crafting:inventorySnapshot', { items: { ...this._inventoryCache } });
            }),
            EventBus.on('dialogue:start', (data) => this._onDialogueStart(data)),
            EventBus.on('quest:start', (data) => this._onQuestStart(data)),
            EventBus.on('quest:started', (data) => { this._onQuestStarted(data); this._refreshQuestBeacons(); }),
            EventBus.on('quest:completed', (data) => { this._onQuestCompleted(data); this._refreshQuestBeacons(); }),
            EventBus.on('quest:objectiveCompleted', () => this._refreshQuestBeacons()),
            EventBus.on('player:addExperience', (data) => this._onAddExperience(data)),
            // ProgressionSystem owns level/XP; react to its level-up to apply
            // class growth + spell unlocks to the player sprite's stats.
            EventBus.on('progression:levelUp', (data) => this._onProgressionLevelUp(data?.level)),
            EventBus.on('dsp:thresholdChanged', (data) => this._onDSPThresholdChanged(data)),
            EventBus.on('faction:reputationChanged', (data) => this._onFactionRepChanged(data)),
            EventBus.on('moral:choiceMade', (data) => this._onMoralChoice(data)),
            EventBus.on('moral-choice-made', (data) => this._onMoralChoiceMade(data)),
            EventBus.on('narrative:eraChanged', (data) => this._onEraChanged(data)),
            EventBus.on('narrative:eraCompleted', (data) => this._onEraCompleted(data)),
            EventBus.on('companion:recruited', (data) => this._onCompanionRecruited(data)),
            EventBus.on('veilkeeper:consulted', (data) => this._onVeilkeeperConsulted(data)),
            EventBus.on('veilkeeper:died', (data) => this._onVeilkeeperDied(data)),
            EventBus.on('veilkeeper-consult', (data) => this._onVeilkeeperConsultRequest(data)),
            EventBus.on('veilkeeper-query-state', (data) => this._onVeilkeeperQueryState(data)),
            EventBus.on('dm:narration', (data) => this._onDMNarration(data)),
            EventBus.on('dm:encounter', (data) => this._onDMEncounter(data)),
            // ---- Moral choice overlay: world pause / resume ----
            EventBus.on('pause-world', () => this._onPauseWorld()),
            EventBus.on('resume-world', () => this._onResumeWorld()),
            // ---- World map travel ----
            EventBus.on('worldmap:travelTo', (data) => this._onWorldMapTravelTo(data)),
            // ---- Portal system ----
            EventBus.on('portal:enter', (data) => this._onPortalEnter(data)),
            // ---- Equipment stat bonuses ----
            EventBus.on('equipment:changed', (data) => this._onEquipmentChanged(data)),
            // ---- Zone content: show zone name toast on entry ----
            EventBus.on('zone:entered', (data) => {
                if (data?.ambientLabel) {
                    EventBus.emit('ui:notification', {
                        message: `\u25B6 ${data.ambientLabel}`,
                        color: '#88ffcc',
                        duration: 2500
                    });
                }
            })
        );

        // ---- Fire initial zone entry now that listeners are wired ----
        if (this._pendingInitialZone && this.zoneContentManager) {
            this.zoneContentManager.enterZone(this._pendingInitialZone);
            this._pendingInitialZone = null;
        }

        // ---- Tactical combat (design: grid-based main combat) ----
        this.inTacticalCombat = false;
        this._tacticalOverworldEnemies = [];
        this._unsubs.push(
            EventBus.on('tactical:combatEnded', (data) => this._onTacticalCombatEnded(data))
        );

        // ---- Track current location ----
        this.currentLocationId = this.currentZone || 'canopy_of_life';
        this._emitLocationDiscovery(this.currentLocationId);

        // ---- Fog of War (world-map only) ----
        // Only one zone is built on-screen at a time, so the in-world fog
        // overlay is no longer used (it would black out the active zone). We
        // still track discovered zones for the world map / minimap.
        this._discoveredZones = new Set([this.currentLocationId]);
        // Additional fog-related EventBus wiring (travel discover handled in _onWorldMapTravelTo).
        this._unsubs.push(
            EventBus.on('zone:discovered', (data) => {
                if (data?.zoneName) {
                    EventBus.emit('ui:notification', {
                        message: `Area Discovered: ${data.zoneName}`,
                        color: '#88ffcc',
                        duration: 3000
                    });
                }
            }),
            EventBus.on('save-collect', (saveData) => {
                saveData.discoveredZones = [...this._discoveredZones];
                // Player position, current zone, and live vitals — without
                // these a load respawns at the default zone with default HP.
                saveData.location = this.currentZone || 'canopy_of_life';
                if (this.player) {
                    saveData.playerPosition = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
                    saveData.playerVitals = {
                        hp:  this.player.stats?.hp,
                        sap: this.player.stats?.sap,
                    };
                }
                saveData.playtime = (this._loadedPlaytime || 0) + (Date.now() - (this._playStartTs || Date.now()));
            }),
            EventBus.on('save-restore', (saveData) => {
                this._discoveredZones = new Set(saveData.discoveredZones || ['canopy_of_life']);
                this._loadedPlaytime = saveData.playtime || 0;
                this._playStartTs = Date.now();

                const targetZone = saveData.location;
                const pos = saveData.playerPosition;
                const vitals = saveData.playerVitals;

                // Apply after the synchronous restore listeners have run, so
                // progression/equipment have set maxHp/maxSap before we clamp.
                this.time.delayedCall(0, () => {
                    if (targetZone && this.zoneContentManager) {
                        this._onWorldMapTravelTo({ locationId: targetZone });
                    }
                    if (pos && this.player) {
                        this.player.setPosition(pos.x, pos.y);
                        if (this.cameraSystem?.camera) this.cameraSystem.camera.centerOn(pos.x, pos.y);
                    }
                    if (vitals && this.player?.stats) {
                        if (vitals.hp != null)  this.player.stats.hp  = Math.min(vitals.hp,  this.player.stats.maxHp  ?? vitals.hp);
                        if (vitals.sap != null) this.player.stats.sap = Math.min(vitals.sap, this.player.stats.maxSap ?? vitals.sap);
                        EventBus.emit('player-stats-updated', this.player.stats);
                    }
                });
            })
        );

        // ---- Start first quest automatically ----
        this.time.delayedCall(2000, () => {
            this.dialogueSystem.startDialogue('elder_awakening');
        });

        // ---- Demo moral choice: present 3s after game load ----
        // Also triggers on quest:started for any veil/prologue quest.
        this._veilChoiceShown = false;
        this.time.delayedCall(3000, () => {
            if (!this._veilChoiceShown) this._presentVeilChoice();
        });

        // ---- Playtime tracking (restored/extended by the save system) ----
        this._loadedPlaytime = this._loadedPlaytime || 0;
        this._playStartTs = Date.now();

        // ---- Quest interaction beacons ----
        this._questBeacons = [];
        this.input.keyboard.on('keydown-E', () => this._tryActivateQuestBeacon());
        this._refreshQuestBeacons();

        // ---- Death state ----
        this.isDead = false;

        // ---- Frame counter (used for throttled per-frame work) ----
        this._frameCount = 0;

        // ---- DSP visual state ----
        this._dspTween = null;
        this._dspOverlay = null;
        this._applyDSPVisuals('stable', 0);

        // ---- Tutorial: fire on new game ----
        if (this.registry.get('isNewGame')) {
            this.registry.set('isNewGame', false); // prevent re-trigger on reload
            this.time.delayedCall(1500, () => {
                EventBus.emit('game:newGameStarted', this);
            });
        }

        console.log('[GameScene] Created — all content wired');
    } // end _create

    // ----------------------------------------------------------------
    // World building — distinct zones per location
    // ----------------------------------------------------------------

    // One zone is active at a time. It occupies a single screen-filling rect
    // at the world origin; travelling tears the current zone down and rebuilds
    // the destination in place. This keeps each zone large and readable instead
    // of cramming all 27 into one giant scrolling grid.
    static ACTIVE_W = 1280;
    static ACTIVE_H = 720;

    _buildWorld() {
        const locations = dataManager.getAllLocations();
        const W = GameScene.ACTIVE_W;
        const H = GameScene.ACTIVE_H;

        // Single fixed bounds shared by every zone — the camera is locked to
        // this rect so the active zone always fills the screen.
        this._activeBounds = { x: 0, y: 0, w: W, h: H };
        this.physics.world.setBounds(0, 0, W, H);
        this.cameras.main.setBounds(0, 0, W, H);

        this._zoneTilemaps = [];        // current zone's tilemaps (destroyed on travel)
        this._activeZoneObjects = [];   // display objects owned by the active zone

        // Zone metadata for the rest of the game (fog discovery, quest beacons,
        // minimap). Every zone shares the same on-screen bounds because only
        // one is ever built at a time.
        this.zones = locations.map(loc => ({ ...loc, bounds: this._activeBounds }));

        // Determine and build the starting zone.
        const startId = this._resumeZone || this.currentZone || 'canopy_of_life';
        const startLoc = this.zones.find(z => z.id === startId) || this.zones[0];
        this.currentZone = startLoc.id;
        this.currentLocationId = startLoc.id;
        this._buildActiveZone(startLoc);
    }

    /**
     * Tear down the previously built zone and build the given one in place at
     * the shared active bounds. Tracks every created display object so the next
     * travel can dispose of it cleanly.
     */
    _buildActiveZone(loc) {
        const { x: zx, y: zy, w: W, h: H } = this._activeBounds;

        // ── Teardown previous zone visuals ───────────────────────────────
        if (this._zoneTilemaps) {
            for (const m of this._zoneTilemaps) { try { m.destroy(); } catch (_) {} }
        }
        this._zoneTilemaps = [];
        if (this._activeZoneObjects) {
            for (const o of this._activeZoneObjects) {
                // Kill any infinite (repeat:-1) sway/drift tweens first, else
                // they linger in the tween manager after the target is gone.
                try { this.tweens.killTweensOf(o); } catch (_) {}
                try { o.destroy(); } catch (_) {}
            }
        }
        this._activeZoneObjects = [];

        // Refresh the single ambient zone light to the new zone's mood colour.
        this._applyZoneAmbientLight(loc);

        // ── Painterly backdrop floor: assemble the realm's panels into a grid
        // filling the zone. Panels overlap their neighbours and the seams are
        // hidden under blended feather strips so the floor reads as one paint. ─
        const grid = ZoneBackdrops.gridFor(loc.id, this);
        const hasBackdrop = !!grid;
        if (grid) {
            const cellW = W / grid.cols;
            const cellH = H / grid.rows;
            // Overlap each panel into its neighbours so there are no hard seams.
            const overlap = Math.max(24, Math.round(Math.min(cellW, cellH) * 0.08));
            grid.keys.forEach((key, idx) => {
                const cx = idx % grid.cols;
                const cy = Math.floor(idx / grid.cols);
                const img = this.add.image(zx + cx * cellW + cellW / 2, zy + cy * cellH + cellH / 2, key)
                    .setOrigin(0.5, 0.5)
                    .setDisplaySize(cellW + overlap, cellH + overlap)
                    .setDepth(0.1);
                this._track(img);
            });
            // Soft feather strips painted over the interior seams to blend the
            // overlapping panels into one another.
            this._blendBackdropSeams(zx, zy, W, H, grid, cellW, cellH);
        } else {
            // No painterly floor — fall back to the old tilemap graphics.
            const result = ZoneTilemapBuilder.buildZone(this, zx, zy, W, H, loc);
            this._zoneTilemaps.push(...result.tilemaps);
        }

        // ── Per-zone atmospheric tint overlay. ───────────────────────────
        this._applyZoneTheme(zx, zy, W, H, loc, hasBackdrop ? 0.10 : 1.0);

        // ── Zone name label ──────────────────────────────────────────────
        const color = parseInt((loc.environment?.ambientColor || '0x44aa44').replace('0x', ''), 16);
        const hexStr = '#' + color.toString(16).padStart(6, '0');
        this._track(this.add.text(zx + W / 2, zy + 16, loc.name.toUpperCase(), {
            fontFamily: 'Open Sans', fontSize: '22px', color: hexStr,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(10).setAlpha(0.85));
        this._track(this.add.text(zx + W / 2, zy + 40, `Lv.${loc.level} — ${loc.type}`, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10).setAlpha(0.7));

        // ── Weather ──────────────────────────────────────────────────────
        if (loc.environment?.weather === 'fog') this._addFogEffect(zx, zy, W, H);

        // ── Decorations (trees, props) ───────────────────────────────────
        this._addZoneDecorations(zx, zy, W, H, loc);
    }

    /** Track a display object as owned by the active zone (destroyed on travel). */
    _track(obj) {
        if (obj && this._activeZoneObjects) this._activeZoneObjects.push(obj);
        return obj;
    }

    /**
     * Paint soft translucent strips over the interior panel seams so the
     * overlapping backdrop panels blend instead of showing a hard edge.
     */
    _blendBackdropSeams(zx, zy, W, H, grid, cellW, cellH) {
        const feather = this.add.graphics().setDepth(0.15);
        const band = Math.max(20, Math.round(Math.min(cellW, cellH) * 0.06));
        // Vertical seams between columns.
        for (let c = 1; c < grid.cols; c++) {
            const sx = zx + c * cellW;
            for (let s = 0; s < band; s++) {
                const a = 0.06 * (1 - s / band);
                feather.fillStyle(0x000000, a);
                feather.fillRect(sx - s, zy, 1, H);
                feather.fillRect(sx + s, zy, 1, H);
            }
        }
        // Horizontal seams between rows.
        for (let r = 1; r < grid.rows; r++) {
            const sy = zy + r * cellH;
            for (let s = 0; s < band; s++) {
                const a = 0.06 * (1 - s / band);
                feather.fillStyle(0x000000, a);
                feather.fillRect(zx, sy - s, W, 1);
                feather.fillRect(zx, sy + s, W, 1);
            }
        }
        this._track(feather);
    }

    _addFogEffect(x, y, w, h) {
        for (let i = 0; i < 8; i++) {
            const fogX = x + Phaser.Math.Between(50, w - 50);
            const fogY = y + Phaser.Math.Between(50, h - 50);
            const fog = this.add.graphics().setDepth(3).setAlpha(0.15);
            fog.fillStyle(0xaabbcc, 1);
            fog.fillCircle(fogX, fogY, Phaser.Math.Between(40, 80));
            this._track(fog);

            // Animate fog drift
            this.tweens.add({
                targets: fog,
                x: Phaser.Math.Between(-30, 30),
                y: Phaser.Math.Between(-20, 20),
                alpha: { from: 0.1, to: 0.2 },
                duration: Phaser.Math.Between(4000, 8000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    _addZoneDecorations(x, y, w, h, location) {
        const count = location.type === 'dungeon' ? 12 : 20;

        // Real tree keys for forest/overworld zones
        const forestTrees = ['tree1', 'tree2', 'tree3', 'tree_moss1', 'tree_moss2', 'tree_flower1', 'tree_flower2', 'tree_autumn'];
        const dungeon = location.type === 'dungeon' || location.type === 'boss';

        // Sprinkle imported environment props on top of the base pass.
        this._scatterImportedDecor(x, y, w, h, location);

        for (let i = 0; i < count; i++) {
            const dx = x + Phaser.Math.Between(50, w - 50);
            const dy = y + Phaser.Math.Between(70, h - 50);

            if (!dungeon) {
                // Use real tree sprites if loaded, else fall back to graphics
                const treeKey = forestTrees[Phaser.Math.Between(0, forestTrees.length - 1)];
                if (this.textures.exists(treeKey)) {
                    const tree = this.add.image(dx, dy, treeKey)
                        .setDepth(2)
                        .setScale(Phaser.Math.FloatBetween(0.4, 0.7))
                        .setAlpha(0.9);
                    this._track(tree);
                    // Subtle sway tween
                    this.tweens.add({
                        targets: tree,
                        angle: Phaser.Math.Between(-3, 3),
                        duration: Phaser.Math.Between(2000, 4000),
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                    });
                } else {
                    // Fallback circle
                    const color = parseInt((location.environment?.ambientColor || '0x336633').replace('0x', ''), 16);
                    const gfx = this.add.graphics().setDepth(1);
                    gfx.fillStyle(color, 0.5);
                    gfx.fillCircle(dx, dy, Phaser.Math.Between(8, 18));
                    this._track(gfx);
                }
            } else {
                // Dungeon: use cave/crystal graphics
                const color = parseInt((location.environment?.ambientColor || '0x336633').replace('0x', ''), 16);
                const gfx = this.add.graphics().setDepth(1);
                gfx.fillStyle(color, 0.6);
                const size = Phaser.Math.Between(4, 14);
                gfx.fillTriangle(dx, dy - size * 2, dx - size, dy, dx + size, dy);
                this._track(gfx);
            }
        }
    }

    /**
     * Spawn a physical loot pickup at (x, y). Player overlap collects it.
     * Uses an imported VFX sparkle as the visual; gold gets a different tint.
     */
    _spawnLootPickup(x, y, itemId, itemData) {
        // Lazy-create the pickup group on first use.
        if (!this._lootGroup) {
            this._lootGroup = this.physics.add.group();
            // Player-pickup overlap.
            this.physics.add.overlap(this.player, this._lootGroup, (_player, pickup) => {
                this._collectLootPickup(pickup);
            });
        }

        const isGold = itemId === '__gold__';
        const spriteKey = isGold
            ? (this.textures.exists('imp_vfx_special1') ? 'imp_vfx_special1' : null)
            : (this.textures.exists('imp_vfx_holy1') ? 'imp_vfx_holy1' : null);

        let pickup;
        if (spriteKey) {
            pickup = this._lootGroup.create(x, y, spriteKey);
            pickup.setDisplaySize(28, 28).setDepth(4.5).setAlpha(0.95);
            pickup.setTint(isGold ? 0xffdd44 : 0x88ddff);
        } else {
            // Fallback: glowing circle graphic.
            const gfx = this.add.graphics().setDepth(4.5);
            gfx.fillStyle(isGold ? 0xffdd44 : 0x88ddff, 0.95);
            gfx.fillCircle(0, 0, 8);
            pickup = this.physics.add.image(x, y).setDepth(4.5);
            pickup.setDisplaySize(16, 16);
            // attach gfx to pickup for cleanup
            pickup._gfx = gfx;
            gfx.x = x; gfx.y = y;
            this._lootGroup.add(pickup);
        }
        pickup.body?.setSize?.(28, 28);
        pickup._itemId = itemId;
        pickup._itemData = itemData;

        // Hover bob + slow rotation for visibility.
        this.tweens.add({
            targets: pickup,
            y: y - 6,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        if (pickup.setAngle) {
            this.tweens.add({
                targets: pickup,
                angle: 360,
                duration: 2400,
                repeat: -1,
                ease: 'Linear'
            });
        }

        // Tiny floating label so the player can see what's there.
        const labelText = isGold ? (itemData?.name || 'Gold') : (itemData?.name || itemId);
        const label = this.add.text(x, y - 22, labelText, {
            fontFamily: 'Open Sans', fontSize: '10px',
            color: isGold ? '#ffdd44' : '#aaddff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(4.6);
        pickup._label = label;
        // Keep label following the pickup as it bobs.
        const follow = this.time.addEvent({
            delay: 30,
            loop: true,
            callback: () => {
                if (pickup?.active && label?.active) { label.x = pickup.x; label.y = pickup.y - 22; }
                else { follow.remove(); }
            }
        });

        // Auto-despawn after 30s if not collected.
        this.time.delayedCall(30000, () => {
            if (pickup?.active) this._destroyLootPickup(pickup);
        });
    }

    _collectLootPickup(pickup) {
        if (!pickup?.active) return;
        const isGold = pickup._itemId === '__gold__';
        if (isGold) {
            const amt = pickup._itemData?._goldAmount || 0;
            this.player.stats.gold = (this.player.stats.gold || 0) + amt;
            this.damageNumbers?.show?.(pickup.x, pickup.y - 12, `+${amt}g`, 0xffdd44);
            EventBus.emit('player-stats-updated', this.player.stats);
        } else {
            EventBus.emit('inventory:addItem', {
                itemId: pickup._itemId,
                quantity: 1,
                itemData: pickup._itemData || { id: pickup._itemId, name: pickup._itemId, stackable: true }
            });
            this.damageNumbers?.show?.(pickup.x, pickup.y - 12, `+${pickup._itemData?.name || pickup._itemId}`, 0xaaddff);
        }
        EventBus.emit('item:pickup', { itemId: pickup._itemId });
        this._destroyLootPickup(pickup);
    }

    _destroyLootPickup(pickup) {
        try { pickup._label?.destroy(); } catch (_) {}
        try { pickup._gfx?.destroy(); } catch (_) {}
        try { pickup.destroy(); } catch (_) {}
    }

    /**
     * Quick fade + zone-name banner whenever the player crosses into a new
     * zone. Gives the "screen change" feel without a full scene swap.
     */
    _playZoneEnterTransition(loc) {
        const cam = this.cameras.main;
        // Brief flash that wipes from the zone tint
        const tintHex = (loc.environment?.ambientColor || '0x223344').replace('0x', '');
        const tint = parseInt(tintHex, 16) || 0x223344;
        cam.flash(280, (tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff, false);

        // Centered banner that fades out
        const W = cam.width, H = cam.height;
        const banner = this.add.container(W / 2, H * 0.32).setDepth(11000).setScrollFactor(0);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.55); bg.fillRect(-280, -42, 560, 84);
        bg.lineStyle(2, tint, 0.9); bg.strokeRect(-280, -42, 560, 84);
        const title = this.add.text(0, -10, loc.name, {
            fontFamily: 'Cinzel, Open Sans', fontSize: '30px',
            color: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        const sub = this.add.text(0, 22, `Lv. ${loc.level || 1} · ${loc.type || 'wilds'}`, {
            fontFamily: 'Open Sans', fontSize: '15px',
            color: '#ccddee', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        banner.add([bg, title, sub]);
        banner.setAlpha(0);
        this.tweens.add({
            targets: banner, alpha: 1, duration: 200, ease: 'Sine.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: banner, alpha: 0, delay: 1400, duration: 500, ease: 'Sine.easeIn',
                    onComplete: () => { try { banner.destroy(); } catch (_) {} }
                });
            }
        });
    }

    /**
     * Paint a per-zone color overlay so each area reads as visually distinct
     * — fog blue for forests, ember orange for cinder/blight, deep purple
     * for void/cave, sea green for tideflow, etc. Picks a tint from the
     * zone id/tags; falls back to environment.ambientColor or neutral.
     */
    _applyZoneTheme(x, y, w, h, location, alphaMul = 1.0) {
        const id   = String(location.id || '').toLowerCase();
        const tags = (location.tags || []).map(t => String(t).toLowerCase());
        const has  = (re) => re.test(id) || tags.some(t => re.test(t));

        let tint = 0x1a2233;  // default cool slate
        let alpha = 0.18;

        if (has(/canopy|spindle|verdant|grove|wood|forest/))           { tint = 0x144a22; alpha = 0.22; }
        else if (has(/cave|catacomb|hollow|crypt|dungeon|tomb/))       { tint = 0x1a0a22; alpha = 0.40; }
        else if (has(/mycelium|fungal|spore/))                          { tint = 0x351a44; alpha = 0.32; }
        else if (has(/cinder|burn|ash|scorched|ember|fire/))            { tint = 0x4a1a08; alpha = 0.30; }
        else if (has(/tideflow|water|sea|reef|shore|beach/))            { tint = 0x0a3a55; alpha = 0.28; }
        else if (has(/snow|frost|ice|tundra|winter/))                   { tint = 0xb0d8ff; alpha = 0.18; }
        else if (has(/desert|sand|wastes|drought/))                     { tint = 0xb88a44; alpha = 0.22; }
        else if (has(/crystal|lumin|radiant|holy|shrine|chapel/))       { tint = 0xffeeaa; alpha = 0.16; }
        else if (has(/veil|rift|void|shadow|dark|blight|corrupted/))    { tint = 0x2a0a3a; alpha = 0.40; }
        else if (has(/town|village|haven|hub|home|nexus|sanctum/))      { tint = 0xa8b8cc; alpha = 0.12; }
        else if (location.environment?.ambientColor) {
            tint = parseInt(String(location.environment.ambientColor).replace('0x', ''), 16) || tint;
            alpha = 0.20;
        }

        const overlay = this.add.graphics().setDepth(0.2);
        overlay.fillStyle(tint, alpha * alphaMul);
        overlay.fillRect(x, y, w, h);
        this._track(overlay);

        // Subtle border framing so the zone reads as a framed "room".
        const border = this.add.graphics().setDepth(0.3);
        border.lineStyle(3, tint, 0.55);
        border.strokeRect(x + 2, y + 2, w - 4, h - 4);
        this._track(border);
    }

    /**
     * Scatter imported environment sprites across a zone, themed by zone tags.
     * Picks key prefixes from public/assets/imported/environment/ — bushes,
     * trees, stones, ruins, mushrooms, ferns, corals, shells, statues,
     * buildings, decor — and places them at low depth so they sit behind
     * gameplay entities. Idempotent: no-op if the imported textures aren't
     * loaded.
     */
    _scatterImportedDecor(x, y, w, h, location) {
        const env = (location.environment || {});
        const tags = (location.tags || []).map(t => String(t).toLowerCase());
        const id = String(location.id || '').toLowerCase();

        // Build a candidate prefix list from zone hints.
        const prefixes = new Set();
        const has = (re) => re.test(id) || tags.some(t => re.test(t));

        // Always-on baseline so every zone gets some variety
        ['imp_env_bush_', 'imp_env_stones_', 'imp_env_greenery_', 'imp_env_decor_'].forEach(p => prefixes.add(p));

        if (has(/cave|catacomb|tomb|dungeon|hollow|crypt/)) {
            ['imp_env_brown_ruins', 'imp_env_brown_gray_ruins', 'imp_env_statue', 'imp_env_dragon_bones'].forEach(p => prefixes.add(p));
        }
        if (has(/forest|canopy|spindle|wood|grove|verdant|root/)) {
            ['imp_env_tree_', 'imp_env_fern', 'imp_env_chanterelles', 'imp_env_beige_green_mushroom', 'imp_env_white_red_mushroom'].forEach(p => prefixes.add(p));
        }
        if (has(/ruin|ancient|temple|altar|shrine/)) {
            ['imp_env_white_ruins', 'imp_env_yellow_ruins', 'imp_env_sand_ruins', 'imp_env_statue', 'imp_env_tree_idol'].forEach(p => prefixes.add(p));
        }
        if (has(/water|tide|sea|reef|coral|shore|beach/)) {
            ['imp_env_blue_coral', 'imp_env_violet_pink_coral', 'imp_env_starfish', 'imp_env_brown_white_shell', 'imp_env_sea_urchin', 'imp_env_water_ruins'].forEach(p => prefixes.add(p));
        }
        if (has(/snow|frost|ice|winter|tundra/)) {
            ['imp_env_snow_bush', 'imp_env_snow_ruins'].forEach(p => prefixes.add(p));
        }
        if (has(/desert|sand|wastes|drought/)) {
            ['imp_env_cactus', 'imp_env_sand_ruins', 'imp_env_yellow_ruins'].forEach(p => prefixes.add(p));
        }
        if (has(/burn|cinder|ash|scorched|blight|corrupted/)) {
            ['imp_env_burned_tree', 'imp_env_broken_tree', 'imp_env_brown_gray_ruins'].forEach(p => prefixes.add(p));
        }
        if (has(/town|village|haven|hub|home|nexus/)) {
            ['imp_env_building_', 'imp_env_road_', 'imp_env_land_', 'imp_env_decor_'].forEach(p => prefixes.add(p));
        }

        // Collect all loaded texture keys matching any prefix.
        const allKeys = this.textures.getTextureKeys();
        const candidates = [];
        for (const key of allKeys) {
            for (const p of prefixes) {
                if (key.startsWith(p)) { candidates.push(key); break; }
            }
        }
        if (candidates.length === 0) return;

        // Scatter density: more for outdoor zones, fewer for dungeons.
        const isDungeon = location.type === 'dungeon' || location.type === 'boss';
        const decorCount = isDungeon ? 14 : 28;

        for (let i = 0; i < decorCount; i++) {
            const key = candidates[Phaser.Math.Between(0, candidates.length - 1)];
            const dx = x + Phaser.Math.Between(40, w - 40);
            const dy = y + Phaser.Math.Between(60, h - 40);
            const scale = Phaser.Math.FloatBetween(0.35, 0.85);
            // Depth 1.5 sits between background (0) and gameplay (4+).
            const prop = this.add.image(dx, dy, key)
                .setDepth(1.5)
                .setScale(scale)
                .setAlpha(Phaser.Math.FloatBetween(0.75, 0.95))
                .setOrigin(0.5, 0.85);
            this._track(prop);
            // Foliage sways; only a third get motion to keep it cheap.
            if (/tree|bush|fern|flower|willow|greenery|grass/.test(key) && Math.random() < 0.35) {
                MotionLibrary.apply(this, prop, 'idle-sway', { amount: Phaser.Math.Between(2, 4), duration: 2400 + Math.random() * 1200 });
            }
        }

        // Drop a unique landmark idol per zone (deterministic by id hash so the
        // same zone always gets the same idol). Skip dungeons.
        if (!isDungeon) {
            this._placeZoneLandmark(x, y, w, h, id);
        }
    }

    /**
     * Place a single decorative landmark (tree idol or living gazebo) at a
     * fixed-ish position in a zone. Deterministic per zone id.
     */
    _placeZoneLandmark(x, y, w, h, zoneId) {
        const LANDMARKS = [
            'imp_env_tree_idol_deer',
            'imp_env_tree_idol_dragon',
            'imp_env_tree_idol_human',
            'imp_env_tree_idol_wolf',
            'imp_env_living_gazebo1',
            'imp_env_living_gazebo2',
        ];
        const loaded = LANDMARKS.filter(k => this.textures.exists(k));
        if (loaded.length === 0) return;

        // Hash the zone id to pick an idol + position offset.
        let h1 = 0;
        for (let i = 0; i < zoneId.length; i++) h1 = ((h1 << 5) - h1 + zoneId.charCodeAt(i)) | 0;
        const idol = loaded[Math.abs(h1) % loaded.length];
        const px = x + 120 + (Math.abs(h1 >> 3) % Math.max(1, w - 240));
        const py = y + 140 + (Math.abs(h1 >> 7) % Math.max(1, h - 260));

        const landmark = this.add.image(px, py, idol)
            .setDepth(2.5)
            .setScale(0.7)
            .setAlpha(0.95)
            .setOrigin(0.5, 0.85);
        this._track(landmark);

        // Subtle glow pulse so the player can spot landmarks from afar.
        this.tweens.add({
            targets: landmark,
            scale: 0.74,
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    _drawZoneConnections(locations) {
        const gfx = this.add.graphics().setDepth(0.5);
        gfx.lineStyle(3, 0x888888, 0.3);

        for (const loc of locations) {
            const zone = this.zones.find(z => z.id === loc.id);
            if (!zone) continue;
            const fromX = zone.bounds.x + zone.bounds.w / 2;
            const fromY = zone.bounds.y + zone.bounds.h / 2;

            for (const connId of (loc.connections || [])) {
                const connZone = this.zones.find(z => z.id === connId);
                if (!connZone) continue;
                const toX = connZone.bounds.x + connZone.bounds.w / 2;
                const toY = connZone.bounds.y + connZone.bounds.h / 2;

                // Only draw each connection once
                if (loc.id < connId) {
                    gfx.lineBetween(fromX, fromY, toX, toY);
                }
            }
        }
    }

    _emitLocationDiscovery(locationId) {
        EventBus.emit('location:discovered', { locationId });
    }

    // ----------------------------------------------------------------
    // Player
    // ----------------------------------------------------------------

    _createPlayer() {
        const b = this._activeBounds || { x: 0, y: 0, w: GameScene.ACTIVE_W, h: GameScene.ACTIVE_H };
        const startX = b.x + b.w / 2;
        const startY = b.y + b.h * 0.7;

        // Reconcile the chosen class from the registry if the class system
        // wasn't told directly (e.g. skipToGame / loaded save). The chosen
        // class drives both stats and the in-world sprite.
        if (!this.classSystem.getCurrentClass()) {
            const regClass = this.registry?.get('selectedClass');
            if (regClass) this.classSystem.selectClass(regClass);
        }
        const classDef = this.classSystem.getCurrentClass();

        // Pick the player's in-world sprite. Each of the 5 classes has a
        // full-body painterly sprite loaded as art_companion_<classId>
        // (clean 512×512 images). The chosen class IS the chosen character,
        // so the look matches the picked class. Fall back to the legacy
        // animated 'player' sheet only if the class art isn't loaded.
        const classArtKey = classDef?.id ? `art_companion_${classDef.id}` : null;
        const useClassArt = !!(classArtKey && this.textures.exists(classArtKey));
        const explicitSprite = classDef?.sprite && this.textures.exists(classDef.sprite);
        const spriteKey = useClassArt ? classArtKey
            : (explicitSprite ? classDef.sprite : 'player');

        this.player = this.physics.add.sprite(startX, startY, spriteKey);
        this.player.setDepth(5);
        this.player.setCollideWorldBounds(true);
        this.player.setDamping(true);
        this.player.setDrag(0.85);
        this.player.setMaxVelocity(250);

        if (useClassArt) {
            // Static painterly full-body art: scale to a readable in-world
            // size and centre the physics body on the texture's own pixels.
            this.player._staticArt = true;
            this.player.setDisplaySize(72, 72);
            const tw = this.player.width, th = this.player.height;
            this.player.body.setSize(tw * 0.4, th * 0.4);
            this.player.body.setOffset(tw * 0.3, th * 0.45);
            // Gentle idle "breathing" so the static sprite feels alive.
            MotionLibrary.apply(this, this.player, 'idle-breathe', { duration: 1800 });
        } else {
            // Legacy animated sheet (266px frames) → 64px display size.
            this.player.setDisplaySize(64, 64);
            this.player.body.setSize(40, 40);
            this.player.body.setOffset(113, 145);
            if (this.anims.exists('player-idle')) this.player.play('player-idle');
        }

        // Complete stat defaults — guaranteed baseline regardless of class system
        const STAT_DEFAULTS = {
            hp: 30, maxHp: 30, guard: 5, maxGuard: 5,
            sap: 100, maxSap: 100, ap: 2, maxAP: 2,
            speed: 200, level: 1, experience: 0, gold: 0,
            spells: [], cooldowns: {},
            might: 2, agility: 2, resilience: 2, insight: 2, charisma: 0,
            sapRegenRate: 5, attack: 0,
            classId: null, className: 'Adventurer', classRole: 'Adventurer',
            name: this.registry?.get('playerName') || 'Adventurer',
            ancestry: this.registry?.get('selectedAncestry') || '—',
            variant: this.registry?.get('selectedVariant') || '—',
        };

        // Base stats — use class system if available, then merge with defaults
        if (classDef) {
            const baseStats = this.classSystem.applyClassStats({
                level: 1, experience: 0, gold: 0,
                spells: [], cooldowns: {},
                speed: 200, sapRegenRate: 5,
                sap: 100, maxSap: 100
            });
            // Merge: class stats win where defined; defaults fill any gaps
            this.player.stats = Object.assign({}, STAT_DEFAULTS, baseStats);

            // Apply ancestry bonuses if selected
            const ancestry = this.registry?.get('selectedAncestry');
            if (ancestry && this.attributeSystem) {
                this.attributeSystem.applyAncestryBonuses(ancestry);
            }
        } else {
            this.player.stats = { ...STAT_DEFAULTS };
        }

        // Equip starting spells — class spells first, then shared as fallback
        const startSpellIds = classDef
            ? this.classSystem.getStartingSpells()
            : ['azure_bolt', 'crimson_surge', 'verdant_bloom', 'shadow_strike', 'radiant_burst'];

        startSpellIds.forEach((id) => {
            const spell = dataManager.getSpell(id);
            if (spell) this.player.stats.spells.push(spell);
        });

        // If class has fewer than 5 starting spells, fill from shared pool
        if (this.player.stats.spells.length < 5) {
            const sharedSpells = ['azure_bolt', 'crimson_surge', 'verdant_bloom', 'shadow_strike', 'radiant_burst'];
            for (const id of sharedSpells) {
                if (this.player.stats.spells.length >= 5) break;
                if (this.player.stats.spells.find(s => s.id === id)) continue;
                const spell = dataManager.getSpell(id);
                if (spell) this.player.stats.spells.push(spell);
            }
        }

        // Apply class passives info
        if (classDef) {
            this.player.stats.passives = this.classSystem.getActivePassives(1);
        }

        // Apply Pure / Blighted variant visuals
        this._applyVariantVisuals();

        // Sync level/XP from ProgressionSystem (the single source of truth).
        // On a loaded save its deserialize() has already restored these.
        this.player.stats.level = this.progression.level;
        this.player.stats.experience = this.progression.experience;

        // Emit initial stats
        EventBus.emit('player-stats-updated', this.player.stats);
        EventBus.emit('class:applied', {
            classId: this.player.stats.classId,
            className: this.player.stats.className
        });
    }

    /**
     * Apply Pure/Blighted visual theme to the player sprite.
     * Pure  → soft golden tint + periodic white sparkle particles
     * Blighted → desaturated purple-green tint + periodic corruption particles
     */
    _applyVariantVisuals() {
        const variant = this.registry.get('selectedVariant') || this.classSystem.getVariant() || 'pure';
        if (!this.player) return;

        if (variant === 'pure') {
            // Warm golden tint — subtle, not garish
            this.player.setTint(0xffe8c0);
            this._variantParticleColor = 0xffffaa;
            this._variantParticleLabel = 'Pure';
        } else if (variant === 'blighted') {
            // Cool purple-green desaturated tint
            this.player.setTint(0xc0d8b0);
            this._variantParticleColor = 0x88ff88;
            this._variantParticleLabel = 'Blighted';
        }

        // Periodic ambient particle bursts from player (every 4s)
        this._variantParticleTimer = this.time.addEvent({
            delay: 4000,
            loop: true,
            callback: () => this._emitVariantParticle()
        });

        // Store variant for HUD badge
        this.player.variant = variant;
        EventBus.emit('player:variantApplied', { variant, label: this._variantParticleLabel });
    }

    _emitVariantParticle() {
        if (!this.player?.active) return;
        const color = this._variantParticleColor || 0xffffff;
        // Use Phaser particles if available; otherwise a simple flash graphic
        try {
            const gfx = this.add.graphics().setDepth(6);
            gfx.fillStyle(color, 0.7);
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI * 2 * i) / 4;
                const dx = Math.cos(angle) * 12;
                const dy = Math.sin(angle) * 12;
                gfx.fillCircle(this.player.x + dx, this.player.y + dy, 3);
            }
            this.tweens.add({
                targets: gfx, alpha: 0, duration: 600,
                onComplete: () => gfx.destroy()
            });
        } catch {}
    }

    // ----------------------------------------------------------------
    // Enemies — zone-based spawning
    // ----------------------------------------------------------------

    _spawnEnemies() {
        this.enemies = this.physics.add.group();

        // Enemies belong to the active zone only. ZoneContentManager emits
        // zone:clearEnemies / zone:spawnEnemies on every zone entry; we spawn
        // and despawn in response so each zone has its own population instead
        // of every zone's enemies existing at once.
        this._unsubs.push(
            EventBus.on('zone:clearEnemies', () => this._clearZoneEnemies()),
            EventBus.on('zone:spawnEnemies', (data) => this._spawnZoneEnemies(data))
        );

        // Player-enemy overlap: start tactical encounter (design: tactical as main combat)
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            if (this.isDead || this.inTacticalCombat) return;
            if (enemy._state?._encounterCooldown) return;
            if (!enemy._state) enemy._state = {};
            enemy._state._encounterCooldown = true;
            this.time.delayedCall(2000, () => { if (enemy.active && enemy._state) enemy._state._encounterCooldown = false; });

            const nearby = this.enemies.getChildren().filter(e =>
                e.active && Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 180
            );
            const encounterEnemies = nearby.slice(0, 4);
            this._startTacticalEncounter(encounterEnemies);
        });
    }

    /** Destroy all overworld enemies (and their HP bars) for the current zone. */
    _clearZoneEnemies() {
        if (!this.enemies) return;
        this.enemies.getChildren().slice().forEach((enemy) => {
            try { enemy._hpBar?.destroy(); } catch (_) {}
            try { enemy.destroy(); } catch (_) {}
        });
        this.enemies.clear(true, true);
    }

    /**
     * Spawn the active zone's enemies. Driven by zone:spawnEnemies from
     * ZoneContentManager; placed within the shared on-screen bounds.
     */
    _spawnZoneEnemies({ enemyIds, bounds } = {}) {
        if (!this.enemies || !enemyIds || enemyIds.length === 0) return;
        const b = bounds || this._activeBounds;
        const zoneId = this.currentZone;
        const isBossZone = (this.zones || []).find(z => z.id === zoneId)?.type === 'boss';
        const spawnCount = isBossZone ? 4 : 3;

        for (let i = 0; i < spawnCount; i++) {
            const enemyId = enemyIds[i % enemyIds.length];
            if (!enemyId) continue;
            const def = dataManager.getEnemy(enemyId);
            if (!def) continue;
            const ex = b.x + Phaser.Math.Between(80, b.w - 80);
            const ey = b.y + Phaser.Math.Between(120, b.h - 80);
            this._spawnSingleEnemy(def, ex, ey, zoneId);
        }
    }

    _startTacticalEncounter(overworldEnemies) {
        if (this.inTacticalCombat || overworldEnemies.length === 0) return;
        this._tacticalOverworldEnemies = overworldEnemies;

        // Enemy definitions live on _state.definition (e.data may be null for
        // painterly sprites). Filter out any without a definition.
        const defs = overworldEnemies.map(e => e._state?.definition || e.data?.definition).filter(Boolean);
        if (defs.length === 0) return;
        const isBoss = defs.some(d => (d?.tier || 1) >= 4) || defs.length >= 4;
        const gridWidth = isBoss ? 12 : (defs.length <= 2 ? 6 : 10);
        const gridHeight = isBoss ? 8 : (defs.length <= 2 ? 6 : 7);

        const allyStats = this.player.stats;
        const allies = [{
            id: 'player',
            name: this.player.name || 'Hero',
            stats: {
                hp: allyStats.hp ?? 30,
                maxHp: allyStats.maxHp ?? 30,
                guard: allyStats.guard ?? 0,
                maxGuard: allyStats.maxGuard ?? 10,
                might: allyStats.might ?? allyStats.atk ?? 2,
                agility: allyStats.agility ?? allyStats.agi ?? 2,
                resilience: allyStats.resilience ?? 2,
                insight: allyStats.insight ?? 2,
                ap: allyStats.agility >= 4 ? 3 : 2,
                maxAP: allyStats.agility >= 4 ? 3 : 2,
                speed: 4
            },
            // Carry the player's known spells into tactical combat so the
            // Cast action has something to offer.
            spells: (allyStats.spells || []).slice(),
            // Class full-body art for the combat token (falls back in renderer).
            spriteKey: (this.classSystem.getCurrentClass()?.id
                ? `art_companion_${this.classSystem.getCurrentClass().id}` : null),
            variant: this.registry.get('selectedVariant') || 'pure'
        }];

        const companions = this.companionSystem.getActiveParty?.() || [];
        companions.slice(0, 2 - allies.length).forEach((c, i) => {
            const ent = this.companionSystem.getCompanionCombatEntity?.(c.id);
            if (ent) allies.push({ ...ent, variant: c.variant || 'pure' });
        });

        const enemies = defs.map((d, i) => ({
            id: d.id + '_' + i,
            name: d.name || 'Enemy',
            stats: {
                hp: d.baseStats?.hp || 40,
                maxHp: d.baseStats?.hp || 40,
                guard: d.baseStats?.guard ?? 0,
                maxGuard: d.baseStats?.guard ?? 10,
                might: d.baseStats?.might ?? 2,
                agility: d.baseStats?.agility ?? 2,
                insight: d.baseStats?.insight ?? 2,
                speed: d.baseStats?.speed ?? 3
            },
            // Resolve the enemy's spell ids to full spell defs so the tactical
            // AI can actually cast them; tag the behaviour pattern.
            spells: (d.spells || []).map(id => dataManager.getSpell(id)).filter(Boolean),
            aiPattern: d.aiPattern || 'aggressive',
            tier: d.tier || 1,
            // Painterly art for the combat token (renderer falls back to a
            // circle if the texture isn't loaded).
            spriteKey: PAINTERLY_ENEMY_MAP[d.id] || null,
            experienceReward: d.experienceReward || 30,
            lootTable: d.lootTable
        }));

        this.inTacticalCombat = true;
        this.player.setVisible(false);
        this.player.setActive(false);
        overworldEnemies.forEach(e => { e.setVisible(false); e.setActive(false); });

        this.tacticalCombat.startCombat({
            allies,
            enemies,
            gridWidth,
            gridHeight,
            terrain: this._generateCombatTerrain(gridWidth, gridHeight)
        });

        EventBus.emit('tactical:encounterStarted', { allyCount: allies.length, enemyCount: enemies.length });
    }

    /**
     * Build a themed terrain array for the tactical grid based on the current
     * zone. Returns [{ x, y, terrain?, elevation? }]. The two spawn columns
     * (x=1 allies, x=gridWidth-2 enemies) and their rows are kept clear so no
     * one spawns inside a wall.
     */
    _generateCombatTerrain(gridWidth, gridHeight) {
        const zone = (this.zones || []).find(z => z.id === this.currentZone);
        const id = String(this.currentZone || '').toLowerCase();
        const tags = (zone?.tags || []).map(t => String(t).toLowerCase());
        const has = (re) => re.test(id) || tags.some(t => re.test(t));

        // Concealing terrain type by theme (drives Shrouded Strike bonuses).
        let shroud = 'forest';
        if (has(/cave|catacomb|hollow|crypt|dungeon|tomb|nexus/)) shroud = 'shadow_veil';
        else if (has(/spore|fungal|mycel/)) shroud = 'spore_cloud';
        else if (has(/blight|corrupt|abyss|void|scar|rift/)) shroud = 'blight_zone';

        const spawnCols = new Set([1, gridWidth - 2]);
        const terrain = [];
        const used = new Set();
        const rng = (n) => Math.floor(Math.random() * n);

        const place = (t, count, builder) => {
            let tries = 0;
            for (let n = 0; n < count && tries < count * 6; tries++) {
                const x = 2 + rng(Math.max(1, gridWidth - 4)); // keep edges/spawns freer
                const y = rng(gridHeight);
                const key = `${x},${y}`;
                if (spawnCols.has(x) || used.has(key)) continue;
                used.add(key);
                terrain.push(builder(x, y));
                n++;
            }
        };

        // A few impassable walls (cover the centre, never the spawn columns).
        place('wall', Math.max(1, Math.floor(gridWidth * gridHeight * 0.04)), (x, y) => ({ x, y, terrain: 'wall' }));
        // Concealing patches for flanking/shroud play.
        place('shroud', Math.max(2, Math.floor(gridWidth * gridHeight * 0.10)), (x, y) => ({ x, y, terrain: shroud }));
        // High cover (defensive bonus) and a couple of elevation tiles.
        place('cover', Math.max(1, Math.floor(gridWidth * gridHeight * 0.05)), (x, y) => ({ x, y, terrain: 'cover_high' }));
        place('elev', Math.max(1, Math.floor(gridWidth * gridHeight * 0.04)), (x, y) => ({ x, y, terrain: 'open', elevation: 1 }));

        return terrain;
    }

    _onTacticalCombatEnded(data) {
        if (!this.inTacticalCombat) return;
        const { result, rewards } = data;

        this.player.setVisible(true);
        this.player.setActive(true);

        const state = this.tacticalCombat.getCombatState?.();
        const playerAlly = state?.allies?.find(a => a.id === 'player');
        if (playerAlly) {
            this.player.stats.hp = playerAlly.hp;
            this.player.stats.maxHp = playerAlly.maxHp ?? this.player.stats.maxHp;
            this.player.stats.guard = playerAlly.guard ?? 0;
            EventBus.emit('player-stats-updated', this.player.stats);
        }

        if (result === 'victory' && rewards) {
            (rewards.loot || []).forEach(drop => {
                EventBus.emit('inventory:addItem', { itemId: drop.itemId, quantity: drop.quantity || 1, itemData: dataManager.getItem(drop.itemId) });
            });
            this._tacticalOverworldEnemies.forEach(e => {
                if (e._hpBar) e._hpBar.destroy();
                e.destroy();
            });
            // ProgressionSystem.onCombatEnded awards the XP from rewards; we
            // just mirror its value onto player.stats for the HUD.
            EventBus.emit('combat:ended', { result: 'victory', rewards });
            this.player.stats.experience = this.progression.experience;
        } else {
            this._tacticalOverworldEnemies.forEach(e => {
                e.setVisible(true);
                e.setActive(true);
            });
            if (result === 'defeat') this._onPlayerDeath();
        }

        this._tacticalOverworldEnemies = [];
        this.inTacticalCombat = false;
        EventBus.emit('tactical:encounterEnded', { result });
    }

    _spawnSingleEnemy(def, x, y, zoneId) {
        // Map enemy types to animated spritesheet keys. HD imported variants
        // are preferred when their textures exist; otherwise fall back to
        // the original lower-res Kenney-derived sheets.
        const HD_TITAN_WALK  = 'imp_treetitan_treetitanwalk_top_down_10col_5row_256px';
        const HD_CORRUPTED   = 'imp_corruptedtreetitan_walk_top_down_5col_7row_256px';
        const HD_SENTINEL    = 'imp_corrupted_tree_sentenel_run_top_down_7col_3row_256px';
        const useHdTitan     = this.textures.exists(HD_TITAN_WALK);
        const useHdCorrupted = this.textures.exists(HD_CORRUPTED);
        const useHdSentinel  = this.textures.exists(HD_SENTINEL);

        const ENEMY_SPRITE_MAP = {
            forest_guardian:       useHdTitan ? HD_TITAN_WALK : 'enemy_treetitan',
            verdant_guardian:      useHdTitan ? HD_TITAN_WALK : 'enemy_treetitan',
            tree_titan:            useHdTitan ? HD_TITAN_WALK : 'enemy_treetitan',
            corrupted_guardian:    useHdCorrupted ? HD_CORRUPTED : 'enemy_corrupted_titan',
            shadow_stalker:        useHdSentinel ? HD_SENTINEL : 'enemy_warrior',
            crimson_warden:        'enemy_warrior',
            mushroom_berserker:    'enemy_mushroom',
            spore_caller:          'enemy_mushroom',
            mycelium_hulk:         'enemy_mushroom',
        };
        const ENEMY_ANIM_MAP = {
            'enemy_treetitan':      'enemy_treetitan-walk',
            'enemy_corrupted_titan':'enemy_corrupted_titan-walk',
            'enemy_mushroom':       'enemy_mushroom-walk',
            'enemy_warrior':        'enemy_warrior-idle',
            [HD_TITAN_WALK]:        'treetitan-hd-walk',
            [HD_CORRUPTED]:         'corrupted-titan-hd-walk',
            [HD_SENTINEL]:          'corrupted-sentinel-run',
        };

        // Prefer the new painterly enemy art (single static image) when we
        // have a mapping and the texture is loaded.
        const painterlyKey = PAINTERLY_ENEMY_MAP[def.id];
        const usePainterly = painterlyKey && this.textures.exists(painterlyKey);

        let enemy, spriteKey;
        if (usePainterly) {
            const isBoss = BOSS_IDS.has(def.id);
            const display = isBoss ? 96 : 64;
            spriteKey = painterlyKey;
            enemy = this.physics.add.sprite(x, y, spriteKey);
            enemy.setDepth(4);
            enemy.setCollideWorldBounds(true);
            enemy.setDisplaySize(display, display);
            // Body in source-texture pixels (~55% of the sprite, centered).
            const tw = enemy.width, th = enemy.height;
            enemy.body.setSize(tw * 0.5, th * 0.5);
            enemy.body.setOffset(tw * 0.25, th * 0.35);
            enemy._painterly = true;
            enemy._isBoss = isBoss;
            // Gentle idle "breathing" so static art feels alive.
            MotionLibrary.apply(this, enemy, 'idle-breathe', { duration: 1400 + Math.random() * 400 });
        } else {
            spriteKey = ENEMY_SPRITE_MAP[def.id] ||
                (this.textures.exists(`enemy_${def.id}`) ? `enemy_${def.id}` : 'enemy_treetitan');
            enemy = this.physics.add.sprite(x, y, spriteKey);
            enemy.setDepth(4);
            enemy.setCollideWorldBounds(true);
            // Scale 256px frame down to 56px display size
            enemy.setDisplaySize(56, 56);
            enemy.body.setSize(36, 36);
            enemy.body.setOffset(110, 140);
            // Play walk animation if available
            const animKey = ENEMY_ANIM_MAP[spriteKey];
            if (animKey && this.anims.exists(animKey)) enemy.play(animKey);
        }

        enemy._state = {
            definition: def,
            hp: def.baseStats?.hp || 50,
            maxHp: def.baseStats?.hp || 50,
            aiState: 'idle',
            aiTimer: 0,
            patrolOrigin: { x, y },
            zoneId,
            attackCooldown: 0
        };

        // HP bar above enemy
        enemy._hpBar = this.add.graphics().setDepth(6);
        this._updateEnemyHpBar(enemy);

        this.enemies.add(enemy);
        return enemy;
    }

    _updateEnemyHpBar(enemy) {
        if (!enemy._hpBar || !enemy.active) return;
        enemy._hpBar.clear();
        const ratio = enemy._state.hp / enemy._state.maxHp;
        const barW = 30;
        const barH = 3;
        const x = enemy.x - barW / 2;
        const y = enemy.y - 22;

        enemy._hpBar.fillStyle(0x333333, 0.7);
        enemy._hpBar.fillRect(x, y, barW, barH);
        enemy._hpBar.fillStyle(ratio > 0.3 ? 0xff4444 : 0xff0000, 0.9);
        enemy._hpBar.fillRect(x, y, barW * ratio, barH);
    }

    // ----------------------------------------------------------------
    // NPCs
    // ----------------------------------------------------------------

    // ----------------------------------------------------------------
    // Quest interaction beacons
    //
    // 'interact' objectives and 'travel' objectives whose target is not a real
    // zone have no natural world trigger. For each active quest's current such
    // objective we drop a glowing beacon in the current zone; pressing E near it
    // fulfils the objective. Real-zone travel completes on entry (no beacon).
    // ----------------------------------------------------------------

    _zoneIds() {
        if (!this._zoneIdSet) this._zoneIdSet = new Set((this.zones || []).map(z => z.id));
        return this._zoneIdSet;
    }

    _currentObjectiveFor(quest) {
        const objs = [...(quest.definition?.objectives || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        for (const o of objs) {
            const p = quest.objectiveProgress?.get(o.id);
            if (!p || !p.completed) return o;
        }
        return null;
    }

    _clearQuestBeacons() {
        for (const b of (this._questBeacons || [])) {
            try { b.gfx?.destroy(); b.label?.destroy(); b.prompt?.destroy(); } catch (_) {}
        }
        this._questBeacons = [];
    }

    _refreshQuestBeacons() {
        if (!this.questSystem?.activeQuests) return;
        this._clearQuestBeacons();
        const zone = (this.zones || []).find(z => z.id === this.currentZone);
        if (!zone) return;
        const zoneIds = this._zoneIds();

        let slot = 0;
        for (const [questId, quest] of this.questSystem.activeQuests) {
            const obj = this._currentObjectiveFor(quest);
            if (!obj) continue;
            const isInteract = obj.type === 'interact';
            const isAbstractTravel = obj.type === 'travel' && !zoneIds.has(obj.target);
            if (!isInteract && !isAbstractTravel) continue;

            // Spread beacons across the zone so multiple don't overlap.
            const bx = zone.bounds.x + zone.bounds.w * (0.3 + 0.18 * (slot % 3));
            const by = zone.bounds.y + zone.bounds.h * (0.35 + 0.16 * Math.floor(slot / 3));
            slot++;

            const gfx = this.add.graphics().setDepth(7);
            gfx.fillStyle(isInteract ? 0xffcc44 : 0x66ccff, 0.85);
            gfx.fillCircle(bx, by, 12);
            gfx.lineStyle(2, 0xffffff, 0.7);
            gfx.strokeCircle(bx, by, 12);
            this.tweens.add({ targets: gfx, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

            const label = this.add.text(bx, by - 26, obj.description || 'Quest objective', {
                fontFamily: 'Open Sans', fontSize: '12px', color: '#ffeeaa',
                stroke: '#000', strokeThickness: 3, align: 'center', wordWrap: { width: 220 }
            }).setOrigin(0.5).setDepth(11);

            const prompt = this.add.text(bx, by + 20, '[E] Interact', {
                fontFamily: 'Open Sans', fontSize: '11px', color: '#ffffff',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(11).setVisible(false);

            this._questBeacons.push({ questId, objectiveId: obj.id, type: obj.type, target: obj.target, x: bx, y: by, gfx, label, prompt });
        }
    }

    _updateQuestBeacons() {
        if (!this._questBeacons?.length || !this.player) return;
        for (const b of this._questBeacons) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
            b.prompt?.setVisible(d < 70);
        }
    }

    _tryActivateQuestBeacon() {
        if (!this._questBeacons?.length || !this.player) return;
        for (const b of this._questBeacons) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
            if (d < 70) {
                if (b.type === 'interact') {
                    EventBus.emit('quest:interact', { target: b.target });
                } else {
                    EventBus.emit('location:discovered', { locationId: b.target });
                }
                EventBus.emit('ui:notification', { message: `Objective complete: ${b.target}`, color: '#ffcc44', duration: 2000 });
                // _refreshQuestBeacons fires via quest:objectiveCompleted.
                return;
            }
        }
    }

    _spawnNPCs() {
        this.npcs = [];

        // NPC definitions — driven by location data and dialogue system
        const npcDefs = [
            // ---- Canopy of Life (Hub) ----
            { name: 'Elder Thalos', role: 'quest', x: 300, y: 350, zoneId: 'canopy_of_life',
              dialogue: ['The Sap flows through all things here.', 'Seek the Hollowroot Catacombs when you are ready.', 'The three phases of Sap shape our world.'],
              dialogueId: 'elder_awakening', interactRadius: 70 },
            { name: 'Commander Briara', role: 'quest', x: 200, y: 280, zoneId: 'canopy_of_life',
              dialogue: ['The Bloomguard stands ready.', 'Our scouts report corruption in the south.', 'Will you serve the Canopy?'],
              dialogueId: 'briara_greeting', interactRadius: 60 },
            { name: 'Archdruid Veyla', role: 'quest', x: 350, y: 250, zoneId: 'canopy_of_life',
              dialogue: ['The Emerald Coven preserves ancient knowledge.', 'The Sap speaks to those who listen.', 'Seek wisdom before strength.'],
              dialogueId: 'veyla_greeting', interactRadius: 60 },
            { name: 'Beastcaller Yenna', role: 'quest', x: 500, y: 350, zoneId: 'canopy_of_life',
              dialogue: ['The wild ones are restless...', 'The Wildkin Pact watches the forest borders.', 'Nature knows when something is wrong.'],
              dialogueId: 'yenna_greeting', interactRadius: 60 },
            { name: 'Seer Althea', role: 'quest', x: 150, y: 450, zoneId: 'canopy_of_life',
              dialogue: ['I see many paths before you...', 'The Veilkeepers whisper of change.', 'Choose wisely, for consequences echo.'],
              dialogueId: 'althea_greeting', interactRadius: 60 },
            { name: 'Smith Garon', role: 'shop', x: 600, y: 280, zoneId: 'canopy_of_life',
              dialogue: ['Finest weapons in the Canopy!', 'Need something repaired?', 'I work with Sap-tempered steel.'],
              dialogueId: 'garon_greeting', interactRadius: 60,
              shopInventory: [{ itemId: 'iron_sword', price: 50 }, { itemId: 'leather_armor', price: 40 }] },
            { name: 'Merchant Lirel', role: 'shop', x: 450, y: 600, zoneId: 'canopy_of_life',
              dialogue: ['Welcome! Browse my wares.', 'Best potions this side of the Nexus!', 'Come back anytime!'],
              dialogueId: 'merchant_lirel_greeting', interactRadius: 60,
              shopInventory: [{ itemId: 'minor_health_potion', price: 10 }, { itemId: 'sap_crystal', price: 20 }] },
            { name: 'Herbalist Tansy', role: 'quest', x: 550, y: 300, zoneId: 'canopy_of_life',
              dialogue: ['Need more herbs... always more herbs.', 'The forest creatures carry useful ingredients.', 'Bring me potions and I\'ll reward you well!'],
              dialogueId: 'herbalist_quest', interactRadius: 60 },
            { name: 'Trainer Borsk', role: 'quest', x: 650, y: 450, zoneId: 'canopy_of_life',
              dialogue: ['Ready to train?', 'Combat is an art. Let me show you.', 'Practice makes perfect, recruit.'],
              dialogueId: 'borsk_greeting', interactRadius: 60 },
            { name: 'Innkeeper Maren', role: 'shop', x: 400, y: 500, zoneId: 'canopy_of_life',
              dialogue: ['Need a room? Meal?', 'Rest here to recover your strength.', 'The inn is always open.'],
              dialogueId: 'maren_greeting', interactRadius: 60,
              shopInventory: [
                { itemId: 'minor_health_potion', price: 12 },
                { itemId: 'healing_herb', price: 5 },
                { itemId: 'spring_water', price: 3 }
              ] },
            { name: 'Sapling Workshop', role: 'crafting', x: 750, y: 300, zoneId: 'canopy_of_life',
              dialogue: ['The workshop is open. Bring materials and craft what you need.'],
              dialogueId: null, interactRadius: 70,
              stationId: 'sapling_workshop' },
            { name: 'Bloomguard Forge', role: 'crafting', x: 750, y: 420, zoneId: 'canopy_of_life',
              dialogue: ['The forge burns hot. Bring iron and leather.'],
              dialogueId: null, interactRadius: 70,
              stationId: 'bloomguard_forge' },
            { name: 'Guard Captain Reyla', role: 'quest', x: 100, y: 350, zoneId: 'canopy_of_life',
              dialogue: ['Keep your weapons ready.', 'Report any suspicious activity.', 'The Canopy must be protected.'],
              dialogueId: 'reyla_greeting', interactRadius: 60 },
            { name: 'Sporecaller Mycel', role: 'quest', x: 700, y: 550, zoneId: 'canopy_of_life',
              dialogue: ['Decay is natural... embrace it.', 'The Syndicate sees truth in corruption.', 'We are not your enemy.'],
              dialogueId: 'mycel_greeting', interactRadius: 60 },
            // ---- Spindlewood Forest ----
            { name: 'Ranger Scout', role: 'quest', x: 180, y: 980, zoneId: 'spindlewood_forest',
              dialogue: ['Wolves have been aggressive lately.', 'The forest paths are treacherous.', 'Watch for Thorn Sprites in the undergrowth.'],
              interactRadius: 60 },
            // ---- Hollowroot Catacombs ----
            { name: 'Catacomb Guide', role: 'quest', x: 850, y: 150, zoneId: 'hollowroot_catacombs',
              dialogue: ['These tunnels run deep.', 'Ancient dead stir when the Crimson phase rises.', 'Stay close to the light sources.'],
              interactRadius: 60 },
            // ---- Emerald Cascades ----
            { name: 'Water Sage', role: 'quest', x: 1650, y: 150, zoneId: 'emerald_cascades',
              dialogue: ['The cascades carry Sap through the land.', 'Something poisons the water upstream.', 'Cleanse the source and the land will heal.'],
              interactRadius: 60 },
            // ---- Glinting Groves ----
            { name: 'Crystal Hermit', role: 'quest', x: 150, y: 1350, zoneId: 'glinting_groves',
              dialogue: ['The crystals remember everything.', 'Touch them and see visions of the past.', 'Some memories are best left buried.'],
              interactRadius: 60 },
            // ---- Mycelium Nexus ----
            { name: 'Corrupted Scholar', role: 'quest', x: 900, y: 1350, zoneId: 'mycelium_nexus',
              dialogue: ['I came to study the corruption...', 'It\'s beautiful, in its own terrible way.', 'Help me gather samples before it spreads further.'],
              interactRadius: 60 },
            // ---- Veilkeeper — near world center ----
            { name: 'Sylara', role: 'veilkeeper', x: 800, y: 500, zoneId: 'canopy_of_life',
              dialogue: ['The Veil whispers your name. What do you seek to know?'],
              dialogueId: 'sylara_greeting', keeperId: 'sylthara', interactRadius: 70 },

            // ---- Quest-giver NPCs referenced by dialogue objectives ----
            // Placed so their quests' "speak to X" objectives can complete.
            { name: 'Faction Leaders', role: 'quest', x: 380, y: 420, zoneId: 'canopy_of_life',
              dialogue: ['The council has gathered.', 'The factions are divided on how to face the Veil.', 'Your voice may sway the outcome.'], interactRadius: 70 },
            { name: 'Healer Mora', role: 'quest', x: 520, y: 480, zoneId: 'canopy_of_life',
              dialogue: ['So many wounded come to me now.', 'I am low on healing herbs.', 'Bless you for helping.'], interactRadius: 60 },
            { name: 'Keeper Lynn', role: 'quest', x: 620, y: 520, zoneId: 'canopy_of_life',
              dialogue: ['The archives hold answers, if you can find them.', 'A lost scroll troubles me.', 'Knowledge must not be forgotten.'], interactRadius: 60 },
            { name: 'Veil Watcher', role: 'quest', x: 180, y: 520, zoneId: 'canopy_of_life',
              dialogue: ['I watch the Veil for tears.', 'Something stirs beyond the threshold.', 'Stay vigilant.'], interactRadius: 60 },
            { name: 'Watcher Cole', role: 'quest', x: 260, y: 600, zoneId: 'canopy_of_life',
              dialogue: ['I have seen things on the borders.', 'A warning must reach the Bloomguard.', 'Time is short.'], interactRadius: 60 },
            { name: 'Sap Weaver', role: 'quest', x: 680, y: 360, zoneId: 'canopy_of_life',
              dialogue: ['I weave charms from living Sap.', 'Bring me what I need and I will craft you one.', 'The Sap remembers its shape.'], interactRadius: 60 },
            { name: 'Consortium Director Orin', role: 'quest', x: 120, y: 480, zoneId: 'canopy_of_life',
              dialogue: ['The Consortium values efficiency.', 'A blight infestation threatens our workshop.', 'Clear it and you will be rewarded.'], interactRadius: 60 },
            { name: 'Elder Thornwick', role: 'quest', x: 340, y: 560, zoneId: 'canopy_of_life',
              dialogue: ['The Veil grows thin, young one.', 'I have studied its tears for decades.', 'Help me, and I will teach you what I know.'],
              dialogueId: 'elder_thornwick_quest1', interactRadius: 65 },
            { name: 'Scout Brin', role: 'quest', x: 240, y: 1020, zoneId: 'spindlewood_forest',
              dialogue: ['I scout the forest paths.', 'My recon route needs covering.', 'Eyes open out there.'], interactRadius: 60 },
            { name: 'Shadowmaster Kael', role: 'quest', x: 780, y: 200, zoneId: 'hollowroot_catacombs',
              dialogue: ['You walk in shadow as I do.', 'My past haunts these tunnels.', 'Perhaps you can help me face it.'], interactRadius: 60 },
            { name: 'Alchemist Ferment', role: 'quest', x: 840, y: 1300, zoneId: 'mycelium_nexus',
              dialogue: ['Decay is just transformation, friend.', 'I need a moss heart for my brew.', 'Fetch it and we both profit.'], interactRadius: 60 }
        ];

        // Keep the full roster; spawn only the active zone's NPCs at a time.
        this._npcDefs = npcDefs;
        this._spawnZoneNPCs(this.currentZone);

        // Override NPC E-key to use DialogueSystem for richer dialogues
        this._wireNPCDialogues();
    }

    /** Destroy the currently spawned NPCs (called on zone change). */
    _clearZoneNPCs() {
        for (const npc of (this.npcs || [])) { try { npc.destroy(); } catch (_) {} }
        // Mutate in place — the minimap captured this array by reference at
        // bind time, so reassigning would orphan it and freeze its NPC dots.
        if (this.npcs) this.npcs.length = 0;
        else this.npcs = [];
    }

    /**
     * Spawn the NPCs belonging to a zone. Authored coordinates predate the
     * single-screen layout and are often off-screen or in the wrong band, so
     * each NPC is mapped deterministically into the active on-screen bounds.
     */
    _spawnZoneNPCs(zoneId) {
        if (!this._npcDefs) return;
        this._clearZoneNPCs();
        const b = this._activeBounds;
        const defs = this._npcDefs.filter(d => (d.zoneId || 'canopy_of_life') === zoneId);

        defs.forEach((def, i) => {
            const { x, y } = this._placeInBounds(def, i, b);
            const visual = this._pickNpcVisual(def);
            const npc = new NPC(this, x, y, {
                name: def.name,
                role: def.role,
                dialogue: def.dialogue || [],
                interactRadius: def.interactRadius || 60,
                dialogueId: def.dialogueId,
                shopInventory: def.shopInventory,
                keeperId: def.keeperId,
                stationId: def.stationId,
                spriteKey: visual.spriteKey,
                idleAnim: visual.idleAnim,
                tint: visual.tint,
            });
            this.npcs.push(npc);
        });
    }

    /**
     * Map an NPC's authored position into the active bounds. If it already
     * fits on screen (with margin) it's kept; otherwise NPCs are laid out on a
     * deterministic grid so they never pile up or fall off-screen.
     */
    _placeInBounds(def, index, b) {
        const margin = 90;
        const inX = def.x >= b.x + margin && def.x <= b.x + b.w - margin;
        const inY = def.y >= b.y + margin && def.y <= b.y + b.h - margin;
        if (inX && inY) return { x: def.x, y: def.y };

        // Deterministic fallback grid (4 columns), starting below the labels.
        const cols = 4;
        const cellW = (b.w - margin * 2) / cols;
        const rows = Math.max(1, Math.ceil((this._npcDefs?.length || 1) / cols));
        const cellH = (b.h - margin * 2 - 60) / Math.min(rows, 4);
        const c = index % cols;
        const r = Math.floor(index / cols) % 4;
        return {
            x: b.x + margin + cellW * (c + 0.5),
            y: b.y + margin + 60 + cellH * (r + 0.5),
        };
    }

    /**
     * Pick a visual variant for an NPC so the world has visible diversity
     * instead of every villager looking identical. Uses role + name hash to
     * deterministically choose a sprite key + tint.
     */
    _pickNpcVisual(def) {
        const name = (def.name || '').toLowerCase();
        const role = (def.role || 'lore').toLowerCase();

        // Prefer painterly NPC art (single static image) when loaded.
        const artKey = npcArtFor(def.name);
        if (this.textures.exists(artKey)) {
            return { spriteKey: artKey, idleAnim: null, tint: null };
        }

        // Hash name → 0..2^32 for stable choice per NPC.
        let h = 0;
        for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
        const hash = Math.abs(h);

        // Distinctive sprites for specific archetypes.
        if (/druid|archdruid|veyla|grove|beastcaller/.test(name)) {
            return {
                spriteKey: 'imp_druid_run_top_down_8col_3row_256px',
                idleAnim: 'npc-druid-run',
                tint: null
            };
        }
        if (/elder|seer|thalos|althea|sage|oracle/.test(name)) {
            // Tinted hue marks elders.
            return { spriteKey: 'npc', idleAnim: null, tint: 0xddccaa };
        }
        if (/commander|warden|guard|briara|crimson|brawler/.test(name)) {
            return { spriteKey: 'npc', idleAnim: null, tint: 0xff8866 };
        }
        if (/merchant|trader|wares|shopkeeper|smith|forger/.test(name) || role === 'shop' || role === 'merchant') {
            return { spriteKey: 'npc', idleAnim: null, tint: 0xffd966 };
        }
        if (/veil|keeper|hidden|whisper/.test(name)) {
            return { spriteKey: 'npc', idleAnim: null, tint: 0xaa88ff };
        }
        if (/companion|vaeril|sylor|aeliana|mycon|kaelen/.test(name)) {
            return { spriteKey: 'npc', idleAnim: null, tint: 0x88ffcc };
        }

        // Default: hue-shift the legacy 'npc' texture by hash so a row of
        // villagers reads as different people.
        const palette = [0xffffff, 0xcceedd, 0xeeddcc, 0xddcceeff & 0xffffff, 0xccddff, 0xeeccdd, 0xddeecc];
        return { spriteKey: 'npc', idleAnim: null, tint: palette[hash % palette.length] };
    }

    _wireNPCDialogues() {
        const unsub = EventBus.on('npc-dialogue-complete', (data) => {
            const npc = this.npcs.find(n => n.name === data.npc);
            if (!npc) return;

            // Wire shop-open for merchant/shop NPCs (matches ShopPanel listener)
            if (npc.role === 'merchant' || npc.role === 'shop' || npc.isShopkeeper) {
                EventBus.emit('shop-open', {
                    shopId: npc.id || npc.name.toLowerCase().replace(/\s+/g, '_'),
                    shopName: npc.name + "'s Wares",
                    inventory: npc.config.shopInventory || this._getDefaultShopInventory(
                        npc.id || npc.name.toLowerCase().replace(/\s+/g, '_')
                    )
                });
            }

            if (npc.config.dialogueId) {
                const dialogue = dataManager.getDialogue(npc.config.dialogueId);
                if (dialogue) {
                    this.dialogueSystem.startDialogue(npc.config.dialogueId);
                }
            }
        });
        this._unsubs.push(unsub);
    }

    _getDefaultShopInventory(shopId) {
        const SHOPS = {
            smith_garon: [
                { itemId: 'iron_sword', quantity: 1, price: 120 },
                { itemId: 'hunting_knife', quantity: 2, price: 80 },
                { itemId: 'leather_tunic', quantity: 1, price: 90 },
            ],
            merchant_lirel: [
                { itemId: 'health_potion', quantity: 5, price: 30 },
                { itemId: 'minor_health_potion', quantity: 10, price: 10 },
                { itemId: 'antidote', quantity: 3, price: 15 },
                { itemId: 'speed_elixir', quantity: 2, price: 45 },
            ],
            innkeeper_maren: [
                { itemId: 'minor_health_potion', quantity: 5, price: 12 },
                { itemId: 'healing_herb', quantity: 5, price: 5 },
                { itemId: 'spring_water', quantity: 10, price: 3 },
                { itemId: 'trail_rations', quantity: 5, price: 5 },
            ],
            merchant_vale: [
                { itemId: 'health_potion', quantity: 5, price: 30 },
                { itemId: 'minor_health_potion', quantity: 10, price: 10 },
                { itemId: 'antidote', quantity: 3, price: 15 },
                { itemId: 'speed_elixir', quantity: 2, price: 45 },
            ],
            blacksmith_bram: [
                { itemId: 'iron_sword', quantity: 1, price: 120 },
                { itemId: 'hunting_knife', quantity: 2, price: 80 },
                { itemId: 'leather_tunic', quantity: 1, price: 90 },
            ],
            default: [
                { itemId: 'minor_health_potion', quantity: 5, price: 10 },
                { itemId: 'health_potion', quantity: 3, price: 30 },
                { itemId: 'trail_rations', quantity: 5, price: 5 },
            ]
        };
        return SHOPS[shopId] || SHOPS.default;
    }

    // ----------------------------------------------------------------
    // Lighting
    // ----------------------------------------------------------------

    _setupLighting() {
        // Player torch
        this.playerLight = this.lighting.addLight(this.player.x, this.player.y, {
            type: 'point',
            color: 0xffeedd,
            intensity: 1.2,
            radius: 180,
            flicker: { speed: 3, amount: 0.08 }
        });

        // Single ambient light for the active zone (only one zone is on screen
        // at a time). Refreshed on travel via _applyZoneAmbientLight.
        const startLoc = (this.zones || []).find(z => z.id === this.currentZone);
        this._applyZoneAmbientLight(startLoc);
    }

    /** Place/refresh the one ambient light for the currently active zone. */
    _applyZoneAmbientLight(loc) {
        if (!this.lighting) return;
        if (this._zoneAmbientLight) {
            try { this.lighting.removeLight(this._zoneAmbientLight); } catch (_) {}
            this._zoneAmbientLight = null;
        }
        const b = this._activeBounds || { x: 0, y: 0, w: GameScene.ACTIVE_W, h: GameScene.ACTIVE_H };
        const color = parseInt((loc?.environment?.ambientColor || '0x336633').replace('0x', ''), 16);
        this._zoneAmbientLight = this.lighting.addLight(b.x + b.w / 2, b.y + b.h / 2, {
            type: 'point',
            color,
            intensity: 0.5,
            radius: Math.max(b.w, b.h) * 0.6,
            pulse: { speed: 0.3, min: 0.3, max: 0.7 }
        });
    }

    // ----------------------------------------------------------------
    // Input
    // ----------------------------------------------------------------

    _setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Spell keys 1-5
        this.input.keyboard.on('keydown-ONE', () => this._castSpell(0));
        this.input.keyboard.on('keydown-TWO', () => this._castSpell(1));
        this.input.keyboard.on('keydown-THREE', () => this._castSpell(2));
        this.input.keyboard.on('keydown-FOUR', () => this._castSpell(3));
        this.input.keyboard.on('keydown-FIVE', () => this._castSpell(4));

        // Escape → pause menu
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.scene.isActive('PauseMenuScene')) return;
            this.scene.launch('PauseMenuScene');
        });

        // J → toggle quest journal in UIScene
        this.input.keyboard.on('keydown-J', () => {
            EventBus.emit('ui:toggleQuestJournal');
        });

        // M → toggle world map overlay
        this.input.keyboard.on('keydown-M', () => {
            if (!this.scene.isActive('WorldMapScene')) {
                this.scene.launch('WorldMapScene', { currentZone: this.currentZone || 'canopy_of_life' });
            } else {
                this.scene.stop('WorldMapScene');
            }
        });

        // H → enter Home Base (The Verdant Hearth)
        this.input.keyboard.on('keydown-H', () => {
            this.scene.start('HomeBaseScene', { returnZone: this.currentZone || 'canopy_of_life' });
        });
    }

    _castSpell(index) {
        if (this.isDead) return;
        if (this.dialogueSystem.isActive()) return;

        const spell = this.player.stats.spells[index];
        if (!spell) return;

        // Cooldown check
        const now = this.time.now;
        const cd = this.player.stats.cooldowns[spell.id];
        if (cd && now < cd) return;

        // ── Resource: DSP only (the shared world pool). spells.json declares
        // DSP as the single casting resource; phase modifiers adjust DSP cost
        // (Crimson +5, Silver -5). Personal "Sap" is no longer a casting gate.
        const baseDspCost = spell.dspCost ?? spell.sapCost ?? 0;
        const phaseDspMod = this.sapCycle.getDspCostModifier?.() ?? 0;
        const dspCost = Math.max(0, baseDspCost + phaseDspMod);
        if (!this.dspSystem.canAfford(dspCost)) {
            this.damageNumbers.show(this.player.x, this.player.y - 30, 'Not enough DSP', 0x66ccff);
            return;
        }

        // Apply phase modifier to damage
        const modifier = this.sapCycle.getBlendedModifier(spell);
        let baseDmg = spell.baseDamage ?? spell.damage ?? 0;
        if (typeof baseDmg === 'string' && baseDmg.includes('d')) {
            const [count, sides] = baseDmg.split('d').map(Number);
            baseDmg = 0;
            for (let i = 0; i < (count || 1); i++) baseDmg += Math.floor(Math.random() * (sides || 6)) + 1;
        }
        const damage = Math.round(baseDmg * modifier);

        // Drain the shared world pool. Casting costs the world, not the caster.
        this.dspSystem.drain(dspCost, `spell:${spell.id}`);

        // Set cooldown
        this.player.stats.cooldowns[spell.id] = now + spell.cooldown * 1000;

        // SpellVFXIntegration: cast burst, cast flash, tier-based shake
        EventBus.emit('spell-cast', { spell, damage: 0, modifier, caster: this.player });

        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        // Healing spell
        if (spell.healAmount) {
            const healMod = this.sapCycle.getBlendedModifier(spell);
            const healAmt = Math.round(spell.healAmount * healMod);
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healAmt);
            this.damageNumbers.show(this.player.x, this.player.y - 20, healAmt, 0x44ff88);
            EventBus.emit('player-stats-updated', this.player.stats);
            this._broadcastCooldown(spell);
            return;
        }

        // Find nearest enemy in range (cursor-aimed)
        let targetEnemy = null;
        let closestDist = 300;
        this.enemies.getChildren().forEach((e) => {
            if (!e.active) return;
            const d = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, e.x, e.y);
            if (d < closestDist) {
                closestDist = d;
                targetEnemy = e;
            }
        });

        if (targetEnemy) {
            // ── Attack-type validation ──────────────────────────────────
            // Spell data may declare attackType ('melee'|'ranged'|'magic').
            // Default to 'magic' when absent so all legacy spells just work.
            const weaponData = { attackType: spell.attackType ?? 'magic', range: spell.range };
            const validation = this.attackTypeSystem.validateAttack(this.player, targetEnemy, weaponData);

            if (!validation.canAttack) {
                // Out of range — refund the DSP we drained above.
                this.dspSystem.recover(dspCost, `refund:${spell.id}`);
                this.damageNumbers.show(
                    this.player.x, this.player.y - 30,
                    validation.reason,
                    0xff4444
                );
                EventBus.emit('player-stats-updated', this.player.stats);
                return;
            }

            // Play sword animation for melee attacks, projectile event for ranged/magic
            if (weaponData.attackType === 'melee') {
                const playerSprite = this.player.sprite ?? this.player;
                if (playerSprite?.anims && !playerSprite._staticArt && this.anims.exists('player-sword')) {
                    playerSprite.play('player-sword', true);
                    playerSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                        if (playerSprite.active) playerSprite.play('player-idle', true);
                    });
                }
            } else {
                this.attackTypeSystem.fireProjectile(this.player, targetEnemy, weaponData.attackType, {
                    spell,
                    damage
                });
            }
            // ── End attack-type validation ──────────────────────────────

            const atk = this.player.stats.attack ?? this.player.stats.might ?? 0;
            const finalDmg = Math.max(1, damage + atk);
            targetEnemy._state.hp = Math.max(0, targetEnemy._state.hp - finalDmg);
            if (targetEnemy.data) targetEnemy.data.hp = targetEnemy._state.hp;

            // Hit flash + knockback
            this._flashEnemyHit(targetEnemy);
            const _kbClass = ['void','thunder','explosive'].includes(spell?.element) ? 'heavy'
                           : ['fire','physical','water'].includes(spell?.element)    ? 'medium' : 'light';
            this._knockbackEnemy(targetEnemy, this.player.x, this.player.y, _kbClass);

            EventBus.emit('enemy-damaged', {
                enemy: targetEnemy, x: targetEnemy.x, y: targetEnemy.y,
                attackerX: this.player.x, attackerY: this.player.y,
                element: spell?.element, damage: finalDmg,
            });

            // Apply status effects declared by the spell
            this._applySpellEffects(targetEnemy, spell);

            // SpellVFXIntegration: impact burst + flash (if vfx.impactParticle, etc.)
            EventBus.emit('spell-impact', { spell, caster: this.player, target: targetEnemy, damage: finalDmg });

            // Damage number — colour-coded by attack type
            const dmgColor = this.attackTypeSystem.getDamageColor(weaponData.attackType);
            this.damageNumbers.show(targetEnemy.x, targetEnemy.y - 20, finalDmg, dmgColor);

            // Update HP bar
            this._updateEnemyHpBar(targetEnemy);

            // Dramatic camera for big spells
            if (spell.tier >= 3) {
                this.cameraSystem.dramaticSpellZoom(this.player, targetEnemy, 600);
            }

            if (targetEnemy._state.hp <= 0) {
                EventBus.emit('enemy-defeated', { enemy: targetEnemy, spell });
            }
        }

        EventBus.emit('player-stats-updated', this.player.stats);
        this._broadcastCooldown(spell);
    }

    // ----------------------------------------------------------------
    // Hit feedback — flash & knockback
    // ----------------------------------------------------------------

    /**
     * Brief red-white flash on an enemy sprite when it takes damage.
     * @param {Phaser.GameObjects.Sprite} enemySprite
     */
    _flashEnemyHit(enemySprite) {
        if (!enemySprite?.active) return;
        enemySprite.setTint(0xff4444);
        this.time.delayedCall(80, () => {
            if (enemySprite?.active) enemySprite.setTint(0xff8888);
            this.time.delayedCall(80, () => {
                if (enemySprite?.active) enemySprite.clearTint();
            });
        });
    }

    /**
     * Apply a knockback impulse away from the damage source.
     * Delegates to PhysicsSystem which handles weighted force and falloff.
     */
    _knockbackEnemy(enemySprite, sourceX, sourceY, weightClass = 'light') {
        this.physicsSystem?.applyKnockback(enemySprite, sourceX, sourceY, weightClass);
    }

    _broadcastCooldown(spell) {
        const totalCd = spell.cooldown * 1000;
        const tickCd = () => {
            const remaining = this.player.stats.cooldowns[spell.id] - this.time.now;
            if (remaining > 0) {
                EventBus.emit('spell-cooldown-tick', spell.id, remaining, totalCd);
                this.time.delayedCall(100, tickCd);
            } else {
                EventBus.emit('spell-cooldown-tick', spell.id, 0, totalCd);
            }
        };
        tickCd();
    }

    // ----------------------------------------------------------------
    // Event handlers
    // ----------------------------------------------------------------

    _onSpellCast(data) {
        const spell = data?.spell || {};
        const caster = data?.caster;
        const target = data?.target;

        // Play player cast animation if the caster is the player.
        if (caster === this.player && !this.player._staticArt && this.anims.exists('player-cast')) {
            const wasPlaying = this.player.anims?.currentAnim?.key;
            this.player.play('player-cast', true);
            // Auto-return to idle/walk after the cast plays out.
            this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                const moving = (this.player.body?.velocity?.x || 0) ** 2 + (this.player.body?.velocity?.y || 0) ** 2 > 16;
                const next = moving && this.anims.exists('player-walk') ? 'player-walk' : (this.anims.exists('player-idle') ? 'player-idle' : null);
                if (next) this.player.play(next, true);
            });
        }

        // Show a large elemental splash at the spell target / cast direction.
        let sx = data?.x, sy = data?.y;
        if ((sx == null || sy == null) && target?.x !== undefined) { sx = target.x; sy = target.y; }
        if (sx == null || sy == null) {
            // Fall back to a point in front of the caster toward the cursor.
            const cam = this.cameras?.main;
            const ptr = this.input?.activePointer;
            if (cam && ptr) {
                const wp = cam.getWorldPoint(ptr.x, ptr.y);
                sx = wp.x; sy = wp.y;
            } else {
                sx = caster?.x ?? this.player?.x ?? 0;
                sy = caster?.y ?? this.player?.y ?? 0;
            }
        }
        this._showSpellImpactSplash(sx, sy, spell.element || data?.element || 'arcane', spell.vfx?.color, spell.vfx?.effect);
    }

    /**
     * Single large elemental impact PNG that pops, scales up, and fades.
     * Picks an imported VFX texture by element family. No-op if no candidate
     * is loaded (the particle burst still fires from ParticleEffects).
     */
    _showSpellImpactSplash(x, y, element, spellColor, effectName) {
        // Effect-name keywords pick more specific imagery than element alone.
        // Checked before the element family below.
        const EFFECT_KEYWORDS = [
            [/explos|detonat|erupt|blast|shatter|shockwave/, ['imp_vfx_explosion1', 'imp_vfx_explosion2']],
            [/slash|dart|garrote|crimson_slash/,             ['imp_vfx_slashspecial2', 'imp_vfx_slashspecial1', 'imp_vfx_slashthunder']],
            [/arrow/,                                        ['imp_vfx_slashspecial3', 'imp_vfx_slashspecial1']],
            [/shield|aegis|ward|fortress|wall|cocoon|encase|wrap|shell|mirror|guardian/, ['imp_vfx_holy2', 'imp_vfx_special1']],
            [/shadow/,                                       ['imp_vfx_darkness4', 'imp_vfx_darkness3', 'imp_vfx_statedark']],
            [/void/,                                         ['imp_vfx_darkness5', 'imp_vfx_statechaos']],
            [/decay|necro|rot|soul_rip|mind_leech/,          ['imp_vfx_statedeath', 'imp_vfx_darkness3']],
            [/poison|toxic|venom|spore|fungal|pollen|mushroom/, ['imp_vfx_earth3', 'imp_vfx_statepoison']],
            [/vine|root|bark|canopy|bloom|green|nature|thorn|sap/, ['imp_vfx_earth5', 'imp_vfx_earth3', 'imp_vfx_earth2']],
            [/crystal|prism|silver|mind|sense|reality|time|mana_tether/, ['imp_vfx_special2', 'imp_vfx_holy2']],
            [/fire|flame/,                                   ['imp_vfx_fire2', 'imp_vfx_fire1']],
            [/wind/,                                         ['imp_vfx_sonic', 'imp_vfx_song']],
            [/beast|roar|charge/,                            ['imp_vfx_howl', 'imp_vfx_sonic']],
            [/soul|spirit|whisper/,                          ['imp_vfx_howl', 'imp_vfx_special1']],
            [/teleport|leap|vanish|flicker|camo|quick/,      ['imp_vfx_special1', 'imp_vfx_sonic']],
            [/glow|aura|pulse|wave|ripple/,                  ['imp_vfx_special2', 'imp_vfx_holy1']],
        ];
        const SPLASH = {
            fire:     ['imp_vfx_fire2', 'imp_vfx_fire1', 'imp_vfx_explosion1', 'imp_vfx_explosion2'],
            ice:      ['imp_vfx_ice4', 'imp_vfx_ice5', 'imp_vfx_ice3'],
            water:    ['imp_vfx_ice3', 'imp_vfx_ice2'],
            thunder:  ['imp_vfx_thunder3', 'imp_vfx_thunder1', 'imp_vfx_slashthunder'],
            holy:     ['imp_vfx_holy3', 'imp_vfx_holy4', 'imp_vfx_holy5'],
            radiant:  ['imp_vfx_holy4', 'imp_vfx_holy5'],
            light:    ['imp_vfx_holy2', 'imp_vfx_light_balls_tree2'],
            shadow:   ['imp_vfx_darkness4', 'imp_vfx_darkness3', 'imp_vfx_statedark'],
            void:     ['imp_vfx_darkness5', 'imp_vfx_statechaos'],
            nature:   ['imp_vfx_earth3', 'imp_vfx_earth2'],
            verdant:  ['imp_vfx_earth5', 'imp_vfx_earth3'],
            arcane:   ['imp_vfx_special2', 'imp_vfx_special1', 'imp_vfx_holy1'],
            physical: ['imp_vfx_slashspecial2', 'imp_vfx_slashspecial1', 'imp_vfx_slashspecial3'],
            wind:     ['imp_vfx_sonic', 'imp_vfx_song'],
            spirit:   ['imp_vfx_howl', 'imp_vfx_sonic'],
            silver:   ['imp_vfx_special2', 'imp_vfx_holy2', 'imp_vfx_special1'],
        };
        const family = String(element || 'arcane').toLowerCase();
        // Prefer effect-name-keyword imagery; fall back to the element family.
        let candidates = SPLASH[family] || SPLASH.arcane;
        if (effectName) {
            const en = String(effectName).toLowerCase();
            for (const [re, cand] of EFFECT_KEYWORDS) {
                if (re.test(en)) { candidates = cand.concat(candidates); break; }
            }
        }
        let key = null;
        for (const k of candidates) { if (this.textures.exists(k)) { key = k; break; } }
        if (!key) return;

        const splash = this.add.image(x, y, key)
            .setDepth(5000)
            .setAlpha(0.95)
            .setScale(0.35)
            .setBlendMode(Phaser.BlendModes.ADD);
        // Tint with the spell's own vfx.color when provided (per-spell color).
        if (spellColor != null) {
            const c = typeof spellColor === 'number'
                ? spellColor
                : parseInt(String(spellColor).replace(/^0x/i, ''), 16);
            if (Number.isFinite(c)) splash.setTint(c);
        }
        this.tweens.add({
            targets: splash,
            scale: 1.2,
            alpha: 0,
            angle: Phaser.Math.Between(-25, 25),
            duration: 500,
            ease: 'Sine.easeOut',
            onComplete: () => { try { splash.destroy(); } catch (_) {} }
        });
    }

    /**
     * Float a status effect icon above a target for the effect's duration.
     * Listens to `combat:effectApplied` from CombatSystem.
     */
    _onCombatEffectApplied(payload) {
        const effect = payload?.effect;
        const tName  = payload?.target?.name;
        if (!effect || !tName) return;

        // Resolve target sprite by matching name. Player first, then enemies.
        let sprite = null;
        if (this.player && (this.player.stats?.name === tName || tName === 'Player')) {
            sprite = this.player;
        } else if (this.enemies) {
            sprite = this.enemies.getChildren().find(e => e?._state?.definition?.name === tName) || null;
        }
        if (!sprite) return;

        const STATUS_ICON = {
            dot:            'imp_vfx_statepoison',
            burn:           'imp_vfx_statepoison',
            poison:         'imp_vfx_statepoison',
            bleed:          'imp_vfx_statepoison',
            sleep:          'imp_vfx_statesleep',
            silence:        'imp_vfx_statesilent',
            paralysis:      'imp_vfx_stateparalys',
            stun:           'imp_vfx_stateparalys',
            chaos:          'imp_vfx_statechaos',
            confuse:        'imp_vfx_statechaos',
            doom:           'imp_vfx_statedeath',
            death:          'imp_vfx_statedeath',
            dark:           'imp_vfx_statedark',
            shadow:         'imp_vfx_statedark',
            slow:           'imp_vfx_statedown1',
            weakness:       'imp_vfx_statedown2',
            curse:          'imp_vfx_curse',
            heal_over_time: 'imp_vfx_cure2',
            regen:          'imp_vfx_cure2',
            buff:           'imp_vfx_stateup1',
            haste:          'imp_vfx_stateup1',
            strength:       'imp_vfx_stateup2',
        };
        const iconKey = STATUS_ICON[effect.type] || 'imp_vfx_stateup1';
        if (!this.textures.exists(iconKey)) return;

        const icon = this.add.image(sprite.x, sprite.y - 36, iconKey)
            .setDepth(7000)
            .setScale(0.15)
            .setAlpha(0.95);

        // Follow the sprite while alive; pulse + auto-destroy when duration ends.
        const durationMs = Math.max(800, (effect.duration || 3) * 1000);
        const follow = this.time.addEvent({
            delay: 50,
            repeat: Math.floor(durationMs / 50),
            callback: () => { if (sprite?.active && icon?.active) { icon.x = sprite.x; icon.y = sprite.y - 36; } }
        });
        this.tweens.add({
            targets: icon, scale: 0.2, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut'
        });
        this.time.delayedCall(durationMs, () => {
            this.tweens.add({
                targets: icon, alpha: 0, scale: 0.05, duration: 250,
                onComplete: () => { try { icon.destroy(); follow.remove(); } catch (_) {} }
            });
        });
    }

    _onEnemyDefeated(data) {
        const { enemy } = data;

        // Death particles
        this.particles.burst(enemy.x, enemy.y, 'hit_sparks', { count: 20 });

        // Destroy HP bar
        if (enemy._hpBar) { enemy._hpBar.destroy(); enemy._hpBar = null; }

        // Award XP through ProgressionSystem (single source of truth for
        // level/XP). It emits player-stats-updated{type:levelUp} which we
        // apply to player.stats in _onProgressionEvent.
        const xpReward = Math.round((enemy._state.definition?.baseStats?.hp || 50) / 2);
        this.progression.awardExperience(xpReward);
        this.player.stats.experience = this.progression.experience;
        this.damageNumbers.show(enemy.x, enemy.y - 30, `+${xpReward} XP`, 0x44ff88);

        // Award gold (Sap Cycle: lootRateMultiplier affects economy)
        const lootTable = enemy._state.definition?.lootTable;
        const sapMods = this.sapCycle.getModifiers();
        if (lootTable) {
            const rawGold = Phaser.Math.Between(lootTable.goldMin || 5, lootTable.goldMax || 15);
            const goldDrop = Math.max(0, Math.round(rawGold * (sapMods.lootRateMultiplier ?? 1)));
            this.player.stats.gold += goldDrop;

            // Drop items as physical pickups the player walks over.
            const items = lootTable.items || [];
            for (const drop of items) {
                const chance = (drop.dropChance ?? 0.5) * (sapMods.lootRateMultiplier ?? 1);
                if (Math.random() < Math.min(1, chance)) {
                    const itemData = dataManager.getItem(drop.itemId);
                    this._spawnLootPickup(
                        enemy.x + Phaser.Math.Between(-18, 18),
                        enemy.y + Phaser.Math.Between(-12, 12),
                        drop.itemId,
                        itemData
                    );
                    console.log(`[Loot] Dropped pickup: ${drop.itemId}`);
                }
            }
            // Also drop a gold pickup if there was any.
            if (goldDrop > 0) {
                this._spawnLootPickup(
                    enemy.x + Phaser.Math.Between(-10, 10),
                    enemy.y + Phaser.Math.Between(-6, 6),
                    '__gold__',
                    { name: `${goldDrop} Gold`, stackable: true, _goldAmount: goldDrop }
                );
                // The gold was already added to player.stats.gold above; subtract so the pickup awards it on collect.
                this.player.stats.gold = Math.max(0, this.player.stats.gold - goldDrop);
            }
        }

        // Notify quest system
        const enemyId = enemy._state.definition?.id;
        if (enemyId) {
            EventBus.emit('enemy:defeated', { enemyId });
        }

        // Broadcast loot summary
        if (lootTable) {
            EventBus.emit('loot-dropped', {
                enemyId: enemyId || 'unknown',
                gold: this.player.stats.gold,
                items: (lootTable.items || []).map(d => d.itemId)
            });
        }

        // Play death animation then remove enemy
        const DEATH_ANIM = {
            enemy_treetitan:      'enemy_treetitan-death',
            enemy_corrupted_titan:'enemy_treetitan-death',
        };
        const deathAnim = DEATH_ANIM[enemy.texture?.key];
        const defId     = enemy._state?.definition?.id;
        const zoneId    = enemy._state?.zoneId;

        const _doDestroy = () => {
            if (enemy?.active) enemy.destroy();
            EventBus.emit('player-stats-updated', this.player.stats);
            this.time.delayedCall(15000, () => this._respawnEnemy(enemy._state?.definition, zoneId));
        };

        if (deathAnim && this.anims.exists(deathAnim)) {
            enemy.setVelocity(0, 0);
            enemy.body?.setEnable(false);
            enemy.play(deathAnim);
            enemy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, _doDestroy);
        } else {
            _doDestroy();
        }
    }

    /**
     * Apply a ProgressionSystem level-up to the player sprite's stats.
     * ProgressionSystem owns level/XP and the XP curve; this handler reacts to
     * its `player-stats-updated{type:levelUp}` event and applies the
     * class-specific growth, spell unlocks, and level-up feedback to
     * player.stats (which the HUD and combat read).
     */
    _onProgressionLevelUp(level) {
        if (!this.player?.stats) return;
        this.player.stats.level = level;

        const classDef = this.classSystem.getCurrentClass();
        if (classDef) {
            const newStats = this.classSystem.applyLevelUpGrowth(this.player.stats, level);
            Object.assign(this.player.stats, newStats);

            // Unlock new class spells available at this level.
            const availableSpells = this.classSystem.getAvailableSpells(level);
            for (const spellId of availableSpells) {
                if (!this.player.stats.spells.find(s => s.id === spellId)) {
                    const spell = dataManager.getSpell(spellId);
                    if (spell) {
                        this.player.stats.spells.push(spell);
                        EventBus.emit('spell:unlocked', { spell });
                    }
                }
            }
            this.player.stats.passives = this.classSystem.getActivePassives(level);
        } else {
            // Fallback flat growth.
            this.player.stats.maxHp += 15;
            this.player.stats.hp = this.player.stats.maxHp;
        }

        this.cameraSystem.shake('medium');
        this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 30 });
        EventBus.emit('player:levelUp', { level });
        EventBus.emit('player-stats-updated', this.player.stats);
        console.log(`[Level Up] ${this.player.stats.className} is now level ${level}`);
    }

    _onDialogueStart(data) {
        if (data.dialogueId) {
            this.dialogueSystem.startDialogue(data.dialogueId);
        }
    }

    _onQuestStart(data) {
        if (data.questId) {
            this.questSystem.startQuest(data.questId);
        }
    }

    /**
     * Apply XP granted directly by a dialogue effect (player:addExperience),
     * which previously had no listener so dialogue XP rewards were lost.
     */
    _onAddExperience(data) {
        const amount = data?.amount || 0;
        if (!amount || !this.player?.stats) return;
        // Route through ProgressionSystem (single source of truth); mirror back.
        this.progression.awardExperience(amount);
        this.player.stats.experience = this.progression.experience;
        this.damageNumbers?.show?.(this.player.x, this.player.y - 28, `+${amount} XP`, 0x44ff88);
        EventBus.emit('player-stats-updated', this.player.stats);
    }

    _onQuestCompleted(data) {
        console.log(`[Quest] Completed: ${data.name}`);
        this.cameraSystem.shake('medium');
        this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 25 });

        // Quest completion recovers DSP (+5 to +15 per design docs)
        const dspRecover = Phaser.Math.Between(5, 15);
        this.dspSystem.recover(dspRecover, `quest:${data.questId || data.name}`);

        // Apply faction reputation from quest rewards
        if (data.rewards?.reputation) {
            for (const [factionId, amount] of Object.entries(data.rewards.reputation)) {
                this.factionSystem.modifyReputation(factionId, amount);
            }
        }

        // Credit XP + gold to the ACTUAL player. QuestSystem.addExperience
        // writes to its own detached playerStats object (not this.player.stats),
        // and completeQuest never grants gold — so apply both here, the one
        // place the live player is in scope. (Items are already added during
        // completeQuest via inventory:addItem.)
        const r = data.rewards || {};
        const xp = r.experience ?? r.xp ?? 0;
        if (xp && this.player?.stats) {
            this.player.stats.experience = (this.player.stats.experience || 0) + xp;
            this.damageNumbers?.show?.(this.player.x, this.player.y - 30, `+${xp} XP`, 0x44ff88);
        }
        if (r.gold && this.player?.stats) {
            this.player.stats.gold = (this.player.stats.gold || 0) + r.gold;
            this.damageNumbers?.show?.(this.player.x, this.player.y - 12, `+${r.gold}g`, 0xffdd44);
        }
        if ((xp || r.gold) && this.player?.stats) {
            EventBus.emit('player-stats-updated', this.player.stats);
        }

        // Check if this is a main quest completion — trigger ending evaluation
        const questDef = this.questSystem?.questDefinitions?.get?.(data.questId);
        if (questDef?.type === 'main' || questDef?.isMainQuest === true) {
            // Brief delay so DSP recovery and reputation changes settle first
            this.time.delayedCall(1500, () => this._evaluateEnding());
        }
    }

    _respawnEnemy(def, zoneId) {
        if (!def) return;
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone) return;

        const ex = zone.bounds.x + Phaser.Math.Between(60, zone.bounds.w - 60);
        const ey = zone.bounds.y + Phaser.Math.Between(80, zone.bounds.h - 60);

        this._spawnSingleEnemy(def, ex, ey, zoneId);
    }

    // ----------------------------------------------------------------
    // New System Event Handlers
    // ----------------------------------------------------------------

    _onDSPThresholdChanged(data) {
        const threshold = data.threshold ?? data.current;
        const value = data.value ?? data.dsp;
        console.log(`[DSP] World state: ${threshold} (${value}/100)`);

        // Visual feedback for DSP state
        if (threshold === 'crisis' || threshold === 'catastrophic') {
            this.cameraSystem.shake('light');
            // Tint the world darker as DSP drops
            const tint = threshold === 'catastrophic' ? 0.6 : 0.8;
            this.cameras.main.setAlpha(tint);
        } else {
            this.cameras.main.setAlpha(1);
        }

        // Camera / overlay VFX keyed to named thresholds
        this._applyDSPVisuals(threshold, value);
    }

    // ----------------------------------------------------------------
    // DSP Visual Overload Effects
    // ----------------------------------------------------------------

    _applyDSPVisuals(threshold, value) {
        const cam = this.cameras.main;

        // Clear previous DSP effects
        if (this._dspTween) { this._dspTween.stop(); this._dspTween = null; }
        if (this._dspOverlay) { this._dspOverlay.destroy(); this._dspOverlay = null; }

        if (threshold === 'stable') {
            return;
        }

        if (threshold === 'strained') {
            // Subtle chromatic aberration hint: slight periodic camera offset tween
            this._dspTween = this.tweens.add({
                targets: cam,
                scrollX: `+=${Math.random() > 0.5 ? 2 : -2}`,
                scrollY: `+=${Math.random() > 0.5 ? 1 : -1}`,
                duration: 3000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        if (threshold === 'critical') {
            // Stronger shake + red vignette overlay
            cam.shake(500, 0.003);
            this._dspTween = this.tweens.add({
                targets: cam,
                scrollX: `+=${Math.random() > 0.5 ? 4 : -4}`,
                scrollY: `+=${Math.random() > 0.5 ? 2 : -2}`,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            // Red vignette overlay
            const { width, height } = this.scale;
            this._dspOverlay = this.add.graphics().setScrollFactor(0).setDepth(18000);
            this._dspOverlay.fillStyle(0xff0000, 0.08);
            this._dspOverlay.fillRect(0, 0, width, height);
            // Pulsing alpha
            this.tweens.add({
                targets: this._dspOverlay,
                alpha: { from: 0.08, to: 0.18 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        if (threshold === 'overload') {
            // Intense screen flash + heavy shake + full red overlay
            cam.flash(400, 255, 50, 50);
            cam.shake(800, 0.012);
            const { width, height } = this.scale;
            this._dspOverlay = this.add.graphics().setScrollFactor(0).setDepth(18000);
            this._dspOverlay.fillStyle(0x880000, 0.25);
            this._dspOverlay.fillRect(0, 0, width, height);
            // Fast pulse
            this.tweens.add({
                targets: this._dspOverlay,
                alpha: { from: 0.25, to: 0.5 },
                duration: 300,
                yoyo: true,
                repeat: -1
            });
            // Scanline effect: horizontal bands
            for (let y = 0; y < height; y += 6) {
                this._dspOverlay.fillStyle(0x000000, 0.06);
                this._dspOverlay.fillRect(0, y, width, 2);
            }

            // Emit overload event for ProceduralAudio
            EventBus.emit('dsp:overload');
        }
    }

    // ----------------------------------------------------------------
    // Status Effect Visuals on Enemies
    // ----------------------------------------------------------------

    _updateStatusEffectVisuals() {
        if (!this.enemies) return;
        this.enemies.getChildren?.().forEach(enemy => {
            if (!enemy?.active) return;

            // Ensure per-enemy graphics object exists
            if (!enemy._statusGfx) {
                enemy._statusGfx = this.add.graphics().setDepth(enemy.depth + 1);
            }
            enemy._statusGfx.clear();

            const effects = enemy.statusEffects || {};
            const icons = [];

            if (effects.poison   || effects.poisoned)  icons.push({ color: 0x44cc44, char: '\u2620' });
            if (effects.stun     || effects.stunned)   icons.push({ color: 0xffff44, char: '\u2605' });
            if (effects.slow     || effects.slowed)    icons.push({ color: 0x4499ff, char: '\u2744' });
            if (effects.bleed    || effects.bleeding)  icons.push({ color: 0xff3333, char: '\u2665' });
            if (effects.burn     || effects.burning)   icons.push({ color: 0xff7722, char: '\uD83D\uDD25' });
            if (effects.silence  || effects.silenced)  icons.push({ color: 0xaa44aa, char: '\u2298' });

            icons.forEach((icon, i) => {
                const ix = enemy.x - (icons.length - 1) * 8 + i * 16;
                const iy = enemy.y - (enemy.height || 32) - 14;
                enemy._statusGfx.fillStyle(icon.color, 0.9);
                enemy._statusGfx.fillCircle(ix, iy, 6);
            });
        });
    }

    // ----------------------------------------------------------------
    // Spell Status-Effect Application
    // ----------------------------------------------------------------

    _applySpellEffects(enemy, spell) {
        if (!enemy || !spell?.effects) return;
        if (!enemy.statusEffects) enemy.statusEffects = {};

        spell.effects.forEach(effectStr => {
            if (effectStr.includes('poison')) {
                enemy.statusEffects.poison = true;
                this.time.delayedCall((parseInt(effectStr.split(':')[1]) || 3) * 1000, () => {
                    if (enemy?.statusEffects) delete enemy.statusEffects.poison;
                });
            }
            if (effectStr.includes('stun')) {
                enemy.statusEffects.stun = true;
                this.time.delayedCall((parseInt(effectStr.split(':')[1]) || 2) * 1000, () => {
                    if (enemy?.statusEffects) delete enemy.statusEffects.stun;
                });
            }
            if (effectStr.includes('slow')) {
                enemy.statusEffects.slow = true;
                this.time.delayedCall((parseInt(effectStr.split(':')[1]) || 3) * 1000, () => {
                    if (enemy?.statusEffects) delete enemy.statusEffects.slow;
                });
            }
            if (effectStr.includes('bleed')) {
                enemy.statusEffects.bleed = true;
                this.time.delayedCall((parseInt(effectStr.split(':')[1]) || 4) * 1000, () => {
                    if (enemy?.statusEffects) delete enemy.statusEffects.bleed;
                });
            }
            if (effectStr.includes('silence')) {
                enemy.statusEffects.silence = true;
                this.time.delayedCall((parseInt(effectStr.split(':')[1]) || 3) * 1000, () => {
                    if (enemy?.statusEffects) delete enemy.statusEffects.silence;
                });
            }
        });
    }

    _onFactionRepChanged(data) {
        const { factionId, newRep, oldRep } = data;
        const direction = newRep > oldRep ? 'increased' : 'decreased';
        console.log(`[Faction] ${factionId} reputation ${direction}: ${oldRep} → ${newRep}`);
    }

    _onMoralChoice(data) {
        const { choiceId, alignment } = data;
        console.log(`[Moral] Choice made: ${choiceId} (${alignment})`);
        this.cameraSystem.shake('light');
    }

    /**
     * Called when the MoralChoicePanel resolves a player choice.
     * Applies DSP delta and faction reputation changes from the selected option.
     */
    _onMoralChoiceMade(data) {
        const { choiceId, selectedChoice } = data;
        if (!selectedChoice) return;

        const impact = selectedChoice.impact || {};

        // Apply DSP delta
        if (impact.dsp !== undefined && impact.dsp !== 0) {
            if (impact.dsp > 0) {
                this.dspSystem?.recover(Math.abs(impact.dsp), `moral:${choiceId}`);
            } else {
                this.dspSystem?.drain(Math.abs(impact.dsp), `moral:${choiceId}`);
            }
        }

        // Apply faction reputation delta
        if (impact.faction && impact.factionDelta !== 0) {
            this.factionSystem?.modifyReputation(impact.faction, impact.factionDelta);
        }

        // Record in MoralChoiceSystem for alignment tracking
        this.moralChoiceSystem?.makeChoice(choiceId, selectedChoice.id);

        console.log(`[Moral] Overlay choice resolved: ${choiceId} → ${selectedChoice.id}`);
        this.cameraSystem.shake('light');
    }

    /** Pause overworld physics when moral choice panel opens. */
    _onPauseWorld() {
        this.physics.pause();
        console.log('[GameScene] World paused for moral choice');
    }

    /** Resume overworld physics after moral choice panel closes. */
    _onResumeWorld() {
        this.physics.resume();
        console.log('[GameScene] World resumed after moral choice');
    }

    /**
     * Player touched a Silver-phase portal — teleport to the destination zone.
     */
    _onEquipmentChanged({ bonuses }) {
        if (!this.player?.stats || !bonuses) return;
        // Apply equipment bonuses on top of base stats
        this.player.stats.equipDamage    = bonuses.damage    || 0;
        this.player.stats.equipDefense   = bonuses.defense   || 0;
        this.player.stats.equipSpeed     = bonuses.speed     || 0;
        this.player.stats.equipHealth    = bonuses.health    || 0;
        this.player.stats.equipMight     = bonuses.might     || 0;
        this.player.stats.equipAgility   = bonuses.agility   || 0;
        this.player.stats.equipResilience= bonuses.resilience|| 0;
        this.player.stats.equipInsight   = bonuses.insight   || 0;
        this.player.stats.equipCrit      = bonuses.critChance|| 0;
        this.player.stats.equipEvasion   = bonuses.evasion   || 0;

        // Adjust max HP by equipment health bonus
        const baseMaxHp = this.player.stats.maxHp - (this.player.stats._prevEquipHealth || 0);
        this.player.stats._prevEquipHealth = bonuses.health || 0;
        this.player.stats.maxHp = baseMaxHp + (bonuses.health || 0);

        EventBus.emit('hud:update', {
            hp: this.player.stats.hp,
            maxHp: this.player.stats.maxHp,
        });
    }

    _onPortalEnter({ destinationZoneId }) {
        if (!destinationZoneId) return;
        console.log(`[Portal] Entering portal → ${destinationZoneId}`);
        this._onWorldMapTravelTo({ locationId: destinationZoneId });
        EventBus.emit('ui:notification', {
            message: `Teleported via Silver Portal`,
            color: '#aaccff',
            duration: 2500
        });
    }

    _onWorldMapTravelTo({ locationId }) {
        if (!locationId) return;
        const destZone = this.zones?.find(z => z.id === locationId);
        if (!destZone) { console.warn(`[WorldMap] Unknown zone: ${locationId}`); return; }
        if (locationId === this.currentZone && this._activeZoneObjects?.length) {
            // Already here and built — nothing to rebuild.
            return;
        }
        console.log(`[WorldMap] Travelling to zone: ${locationId}`);
        this.currentZone = locationId;
        this.currentLocationId = locationId;

        // Rebuild the active zone in place (tears down the previous one).
        this._buildActiveZone(destZone);

        // Re-home the player to the centre of the on-screen bounds.
        if (this.player) {
            const b = this._activeBounds;
            const spawnX = b.x + b.w / 2;
            const spawnY = b.y + b.h * 0.7;
            this.player.setPosition(spawnX, spawnY);
            const cam = this.cameras?.main;
            if (cam && cam._bounds) cam.centerOn(spawnX, spawnY);
            else if (cam) { cam.scrollX = spawnX - cam.width / 2; cam.scrollY = spawnY - cam.height / 2; }
        }

        // Repopulate this zone's NPCs.
        this._spawnZoneNPCs(locationId);

        // Fog of War: reveal the travel destination immediately
        this._discoverZone(locationId, destZone?.name || locationId);
        EventBus.emit('zone:changed', { locationId });

        // Zone content: update visuals, enemies, and music mood. This emits
        // zone:clearEnemies + zone:spawnEnemies which we handle to swap the
        // overworld enemy population.
        if (this.zoneContentManager) {
            this.zoneContentManager.enterZone(locationId);
        }

        // Banner + flash for the new zone.
        this._playZoneEnterTransition(destZone);

        // Re-place quest beacons for the new zone.
        this._refreshQuestBeacons();
    }

    /**
     * Listen for quest:started — if a veil/prologue quest fires, show the
     * Veil Shard moral choice (once only).
     */
    _onQuestStarted(data) {
        const qid = (data?.questId || data?.id || '').toLowerCase();
        if (!this._veilChoiceShown && (qid.startsWith('quest_veil') || qid.startsWith('prologue'))) {
            this._veilChoiceShown = true;
            this.time.delayedCall(1500, () => this._presentVeilChoice());
        }
    }

    /** Emit the demo Veil Shard moral choice. */
    _presentVeilChoice() {
        this._veilChoiceShown = true;
        EventBus.emit('moral-choice-present', {
            id: 'choice_veil_approach',
            title: 'The Veil Beckons',
            description: 'A trembling shard of the Veil lies before you. You can feel its power — corruptive or restorative depending on how it is used.',
            choices: [
                {
                    id: 'purify',
                    label: 'Purify the Shard',
                    consequence: 'The DSP stabilizes, but the Verdant Circle grows suspicious of your motives.',
                    impact: { dsp: 10, faction: 'verdant_circle', factionDelta: -5 }
                },
                {
                    id: 'absorb',
                    label: 'Absorb its Power',
                    consequence: 'You gain strength, but the DSP drops sharply. The Veilkeepers take notice.',
                    impact: { dsp: -20, faction: 'veilkeepers', factionDelta: 10 }
                },
                {
                    id: 'destroy',
                    label: 'Destroy the Shard',
                    consequence: 'The shard is gone. No gain, no loss — but you sense the Veil watching.',
                    impact: { dsp: 0, faction: null, factionDelta: 0 }
                }
            ]
        });
    }

    _onEraChanged(data) {
        const { eraId, eraName } = data;
        console.log(`[Narrative] New era: ${eraName}`);

        // Show era transition text
        const text = this.add.text(
            this.cameras.main.scrollX + 640,
            this.cameras.main.scrollY + 200,
            eraName.toUpperCase(),
            { fontFamily: 'Open Sans', fontSize: '39px', color: '#88aaff', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(10000).setScrollFactor(0).setAlpha(0);

        this.tweens.add({
            targets: text,
            alpha: { from: 0, to: 1 },
            y: text.y - 30,
            duration: 1500,
            hold: 2000,
            yoyo: true,
            onComplete: () => text.destroy()
        });
    }

    _onCompanionRecruited(data) {
        console.log(`[Companion] ${data.name} joined the party`);
        this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 20 });
        this._syncCompanionFollowers();
    }

    /**
     * Spawn a world follower sprite for each active-party companion (and remove
     * sprites for any who left). Followers are plain images that trail the
     * player in _updateCompanionFollowers.
     */
    _syncCompanionFollowers() {
        if (!this._companionFollowers) this._companionFollowers = new Map();
        const party = this.companionSystem?.getActiveParty?.() || [];
        const activeIds = new Set(party.map(c => c.id));

        for (const [id, spr] of this._companionFollowers) {
            if (!activeIds.has(id)) { try { spr.destroy(); } catch (_) {} this._companionFollowers.delete(id); }
        }
        party.forEach((c, i) => {
            if (this._companionFollowers.has(c.id)) return;
            const key = companionArtFor(c.id);
            if (!this.textures.exists(key)) return;
            const spr = this.add.image(this.player.x - 44 - i * 22, this.player.y, key)
                .setDepth(4.8).setDisplaySize(56, 56);
            spr._cid = c.id;
            spr._cname = c.name;
            MotionLibrary.apply(this, spr, 'idle-breathe', { duration: 1600 + i * 150 });
            // Floating name tag.
            spr._tag = this.add.text(spr.x, spr.y - 34, c.name, {
                fontFamily: 'Open Sans', fontSize: '11px', color: '#88ffcc',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(10);
            this._companionFollowers.set(c.id, spr);
        });
    }

    /**
     * Big boss attack telegraph: a crimson shockwave ring that expands and
     * fades from the boss, a scale-up "rear back + slam" on the boss sprite,
     * a red tint flash, and a camera shake. Signals a heavy hit.
     */
    _bossAttackTell(boss) {
        // Expanding shockwave ring.
        const ring = this.add.graphics().setDepth(4.9);
        ring.lineStyle(5, 0xff3322, 0.9);
        ring.strokeCircle(0, 0, 18);
        ring.x = boss.x; ring.y = boss.y;
        this.tweens.add({
            targets: ring, scale: 5, alpha: 0, duration: 480, ease: 'Cubic.easeOut',
            onComplete: () => { try { ring.destroy(); } catch (_) {} }
        });
        // Rear-back then slam (scale punch — safe on physics sprites).
        const base = boss._mlBase?.sy ?? boss.scaleY;
        this.tweens.add({
            targets: boss, scaleX: boss.scaleX * 1.18, scaleY: base * 1.18,
            duration: 160, yoyo: true, ease: 'Back.easeOut'
        });
        boss.setTint?.(0xff5544);
        this.time.delayedCall(220, () => boss.clearTint?.());
        this.cameraSystem?.shake?.('medium');
    }

    /** Trail each companion behind the player; auto-attack nearby enemies. */
    _updateCompanionFollowers() {
        if (!this._companionFollowers || !this.player) return;
        const now = this.time.now;
        let i = 0;
        for (const spr of this._companionFollowers.values()) {
            // ── Auto-attack: hit the nearest enemy within range ──
            const enemy = this._nearestEnemyTo(spr.x, spr.y, 140);
            if (enemy && now >= (spr._atkReady || 0)) {
                spr._atkReady = now + 1300;
                this._companionAttack(spr, enemy);
            }

            // ── Follow: chase the player (or lunge an enemy if attacking) ──
            const followTarget = enemy ? enemy : this.player;
            const spacing = enemy ? 30 : (46 + i * 30);
            const dist = Phaser.Math.Distance.Between(spr.x, spr.y, followTarget.x, followTarget.y);
            if (dist > spacing) {
                const ang = Math.atan2(followTarget.y - spr.y, followTarget.x - spr.x);
                const sp = Math.min(3.4, (dist - spacing) * 0.12);
                spr.x += Math.cos(ang) * sp;
                spr.y += Math.sin(ang) * sp;
                if (Math.cos(ang) < -0.1) spr.setFlipX(true);
                else if (Math.cos(ang) > 0.1) spr.setFlipX(false);
            }
            if (spr._tag) { spr._tag.x = spr.x; spr._tag.y = spr.y - 34; }
            i++;
        }
    }

    _nearestEnemyTo(x, y, range) {
        const list = this.enemies?.getChildren?.() || [];
        let best = null, bestD = range;
        for (const e of list) {
            if (!e.active || !e._state || e._state.hp <= 0) continue;
            const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    _companionAttack(companion, enemy) {
        const dmg = 5 + Phaser.Math.Between(0, 4);
        enemy._state.hp = Math.max(0, enemy._state.hp - dmg);
        if (enemy.data) enemy.data.hp = enemy._state.hp; // keep both fields in sync
        // Visual feedback.
        MotionLibrary.apply(this, companion, 'pulse-once');
        enemy.setTint?.(0x88ffcc);
        this.time.delayedCall(120, () => enemy.clearTint?.());
        this.damageNumbers?.show?.(enemy.x, enemy.y - 24, dmg, 0x88ffcc);
        this._updateEnemyHpBar(enemy);
        if (enemy._state.hp <= 0) {
            EventBus.emit('enemy-defeated', { enemy, byCompanion: companion._cid });
        }
    }

    _onVeilkeeperConsulted(data) {
        const { keeperId, hint, dspCost } = data;
        console.log(`[Veilkeeper] Consulted ${keeperId} — DSP cost: ${dspCost}`);
    }

    _onVeilkeeperDied(data) {
        const { keeperId, name } = data;
        console.log(`[Veilkeeper] ${name} has perished! Their knowledge is lost forever.`);
        this.cameraSystem.shake('heavy');

        // Death notification
        const text = this.add.text(
            this.cameras.main.scrollX + 640,
            this.cameras.main.scrollY + 250,
            `${name} has been lost to the Hollowing...`,
            { fontFamily: 'Open Sans', fontSize: '25px', color: '#ff4444', stroke: '#000', strokeThickness: 3 }
        ).setOrigin(0.5).setDepth(10000).setScrollFactor(0);

        this.tweens.add({
            targets: text,
            alpha: { from: 1, to: 0 },
            duration: 4000,
            onComplete: () => text.destroy()
        });
    }

    /**
     * Handle consultation request from VeilkeeperPanel.
     * Calls VeilkeeperSystem.consult(), then emits a response back to the panel.
     */
    _onVeilkeeperConsultRequest(data) {
        const { keeperId, question } = data || {};
        if (!keeperId) return;

        const sapPhase = this.sapCycle?.currentPhase || 'blue';
        const result = this.veilkeeperSystem.consult(keeperId, sapPhase);

        if (!result.success) {
            EventBus.emit('veilkeeper-response', {
                keeperId,
                message: null,
                warning: result.reason || 'The Veil does not answer.'
            });
            return;
        }

        // Contextual fallback responses keyed by preset question text
        const responses = {
            'What fate awaits me?': 'The strands of your fate are tangled with the Sap itself. What you do with that power determines what unravels.',
            'How do I restore the DSP?': 'The Dynamic Sap Potential can be restored only by tending to the world — completing its tasks, healing its wounds, and preserving its keepers.',
            'What does my ancestry mean?': 'Your lineage carries echoes of those who shaped the Veil. Look to your ancestry traits — they are not limits, they are keys.'
        };
        const message = responses[question] || 'The Veil has shown me a glimpse of what you seek. Proceed with clarity, and it will reveal more.';

        const warning = result.died
            ? `${keeperId} has succumbed to the Hollowing. Their domain is sealed forever.`
            : (result.warning || null);

        EventBus.emit('veilkeeper-response', { keeperId, message, warning });
    }

    /**
     * Reply with live Veilkeeper state for the hollowing display in VeilkeeperPanel.
     */
    _onVeilkeeperQueryState(data) {
        const { keeperId, replyEvent } = data || {};
        if (!keeperId || !replyEvent) return;

        const vk = this.veilkeeperSystem.getVeilkeeper(keeperId);
        if (!vk) {
            EventBus.emit(replyEvent, { keeperId, alive: false });
            return;
        }
        EventBus.emit(replyEvent, {
            keeperId,
            alive: vk.alive,
            currentHollowing: vk.currentHollowing,
            hollowingThreshold: vk.hollowingThreshold
        });
    }

    _onDMNarration(data) {
        const { text, priority } = data;
        EventBus.emit('ui:showNarration', { text, priority });
    }

    _onDMEncounter(data) {
        const { type, description } = data;
        console.log(`[DM] Encounter: ${type} — ${description}`);
    }

    // ----------------------------------------------------------------
    // Death / Respawn
    // ----------------------------------------------------------------

    _onPlayerDeath() {
        if (this.isDead) return;
        this.isDead = true;

        console.log('[GameScene] Player died');

        // Death VFX
        this.cameraSystem.shake('heavy');
        this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 40 });

        // Freeze player
        this.player.setVelocity(0, 0);
        this.player.setAlpha(0.3);

        // Death overlay text
        const deathText = this.add.text(
            this.cameras.main.scrollX + 640,
            this.cameras.main.scrollY + 300,
            'YOU HAVE FALLEN',
            { fontFamily: 'Open Sans', fontSize: '45px', color: '#ff4444', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(10000).setScrollFactor(0);

        const respawnText = this.add.text(
            this.cameras.main.scrollX + 640,
            this.cameras.main.scrollY + 350,
            'Respawning...',
            { fontFamily: 'Open Sans', fontSize: '20px', color: '#aaaaaa', stroke: '#000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(10000).setScrollFactor(0);

        // Respawn after 3 seconds
        this.time.delayedCall(3000, () => {
            deathText.destroy();
            respawnText.destroy();
            this._respawnPlayer();
        });
    }

    _respawnPlayer() {
        this.isDead = false;

        // Respawn at the centre of the current active zone.
        const b = this._activeBounds || { x: 0, y: 0, w: GameScene.ACTIVE_W, h: GameScene.ACTIVE_H };
        this.player.setPosition(b.x + b.w / 2, b.y + b.h * 0.7);
        this.player.setAlpha(1);
        this.player.stats.hp = Math.round(this.player.stats.maxHp * 0.5);
        this.player.stats.sap = Math.round(this.player.stats.maxSap * 0.5);

        // Lose some gold
        const goldLoss = Math.floor(this.player.stats.gold * 0.1);
        this.player.stats.gold = Math.max(0, this.player.stats.gold - goldLoss);

        EventBus.emit('player-stats-updated', this.player.stats);

        // Brief invincibility flash
        this.tweens.add({
            targets: this.player,
            alpha: { from: 0.3, to: 1 },
            duration: 200,
            repeat: 5
        });

        console.log('[GameScene] Player respawned');
    }

    // ----------------------------------------------------------------
    // Enemy AI
    // ----------------------------------------------------------------

    _updateEnemyAI(delta) {
        const dt = delta / 1000;

        this.enemies.getChildren().forEach((enemy) => {
            if (!enemy.active || !enemy._state) return;

            const d = enemy._state;
            d.aiTimer += dt;

            // Update HP bar position
            this._updateEnemyHpBar(enemy);

            const distToPlayer = Phaser.Math.Distance.Between(
                enemy.x, enemy.y, this.player.x, this.player.y
            );

            // Flip sprite based on movement direction
            if (enemy.body.velocity.x < -10) enemy.setFlipX(true);
            else if (enemy.body.velocity.x > 10) enemy.setFlipX(false);

            switch (d.aiState) {
                case 'idle':
                    enemy.setVelocity(0, 0);
                    if (distToPlayer < 250) {
                        d.aiState = 'chase';
                    } else if (d.aiTimer > 3) {
                        d.aiState = 'patrol';
                        d.aiTimer = 0;
                    }
                    break;

                case 'patrol': {
                    const angle = Phaser.Math.Angle.Between(
                        enemy.x, enemy.y,
                        d.patrolOrigin.x + Math.cos(d.aiTimer) * 100,
                        d.patrolOrigin.y + Math.sin(d.aiTimer) * 100
                    );
                    const speed = (d.definition?.baseStats?.speed || 60) * 0.5;
                    enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

                    if (distToPlayer < 250) {
                        d.aiState = 'chase';
                    }
                    if (d.aiTimer > 6) {
                        d.aiState = 'idle';
                        d.aiTimer = 0;
                    }
                    break;
                }

                case 'chase': {
                    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    const speed = d.definition?.baseStats?.speed || 80;

                    if (distToPlayer <= 32) {
                        enemy.setVelocity(0, 0);
                        d.attackCooldown -= dt;
                        if (d.attackCooldown <= 0) {
                            const might = d.definition?.baseStats?.might ?? d.definition?.might ?? 0;
                            const tier = d.definition?.tier ?? 1;
                            const damage = Math.max(1, might + tier * 2);
                            this.player.stats.hp = Math.max(0, this.player.stats.hp - damage);
                            // Play attack animation if available (reverts to walk anim automatically)
                            const ATTACK_ANIM = {
                                enemy_treetitan: 'enemy_treetitan-attack',
                                enemy_corrupted_titan: 'enemy_treetitan-attack',
                                imp_treetitan_treetitanwalk_top_down_10col_5row_256px: 'treetitan-hd-attack',
                                imp_corruptedtreetitan_walk_top_down_5col_7row_256px: 'treetitan-hd-attack',
                            };
                            const WALK_ANIM = {
                                enemy_treetitan: 'enemy_treetitan-walk',
                                enemy_corrupted_titan: 'enemy_corrupted_titan-walk',
                                imp_treetitan_treetitanwalk_top_down_10col_5row_256px: 'treetitan-hd-walk',
                                imp_corruptedtreetitan_walk_top_down_5col_7row_256px: 'corrupted-titan-hd-walk',
                            };
                            const atkAnim = ATTACK_ANIM[enemy.texture?.key];
                            if (atkAnim && this.anims.exists(atkAnim) && !enemy.anims.isPlaying) {
                                enemy.play(atkAnim);
                                enemy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                                    const walkAnim = WALK_ANIM[enemy.texture?.key];
                                    if (walkAnim && this.anims.exists(walkAnim)) enemy.play(walkAnim);
                                });
                            } else if (enemy._isBoss) {
                                // Boss signature tell: bigger telegraph — a
                                // crimson windup ring that expands + fades, a
                                // scale-up "rear back", and a camera shake.
                                this._bossAttackTell(enemy);
                            } else if (enemy._painterly) {
                                // Painterly (physics) enemies can't lunge (body
                                // overwrites position), so flash + quick wobble as
                                // the attack tell. Wobble restores scale on done.
                                MotionLibrary.apply(this, enemy, 'flash', { tint: 0xffdd88, duration: 140 });
                                MotionLibrary.apply(this, enemy, 'wobble');
                            }
                            EventBus.emit('enemy-attack', { enemy, player: this.player, damage });
                            EventBus.emit('player-damaged', { x: this.player.x, y: this.player.y });
                            EventBus.emit('player-stats-updated', this.player.stats);
                            d.attackCooldown = 1.5;
                            if (this.player.stats.hp <= 0) this._onPlayerDeath?.();
                        }
                    } else {
                        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                    }

                    if (distToPlayer > 400) {
                        d.aiState = 'idle';
                        d.aiTimer = 0;
                    }
                    break;
                }
            }
        });
    }

    // ----------------------------------------------------------------
    // Per-frame update
    // ----------------------------------------------------------------

    update(time, delta) {
        if (!this.profiler) return;
        this._frameCount++;
        this.profiler.begin('total');

        // Player movement (skip if dead or in dialogue)
        this.profiler.begin('input');
        if (!this.isDead && !this.dialogueSystem.isActive()) {
            this._handleMovement();
        }
        this.profiler.end('input');

        // Sap cycle
        this.profiler.begin('sapCycle');
        this.sapCycle.update(delta);
        if (this.sapCycleLightingIntegration) {
            this.sapCycleLightingIntegration.update(time, delta);
        }
        this.profiler.end('sapCycle');

        // Enemy AI (pause during dialogue so foes don't rush past the player)
        this.profiler.begin('enemyAI');
        if (!this.isDead && !this.dialogueSystem.isActive()) {
            this._updateEnemyAI(delta);
        } else if (!this.isDead && this.dialogueSystem.isActive()) {
            this.enemies.getChildren().forEach((enemy) => {
                if (enemy?.active && enemy.body) enemy.setVelocity(0, 0);
            });
        }
        this.profiler.end('enemyAI');

        // NPCs
        if (!this.dialogueSystem.isActive()) {
            for (const npc of this.npcs) {
                npc.update(delta, this.player);
            }
        }

        // Quest interaction beacons (interact / abstract-travel objectives)
        this._updateQuestBeacons();

        // Lighting
        this.profiler.begin('lighting');
        if (this.playerLight) {
            this.playerLight.x = this.player.x;
            this.playerLight.y = this.player.y;
        }
        this.lighting.update(delta);
        this.profiler.end('lighting');

        // Particles
        this.profiler.begin('particles');
        this.particles.update(delta);
        this.profiler.end('particles');

        // Physics system (knockback, projectiles, slow effects)
        this.physicsSystem?.update(delta);

        // Camera
        this.profiler.begin('camera');
        this.cameraSystem.update(delta);
        this.profiler.end('camera');

        // Combat & spells
        this.profiler.begin('combat');
        this.combatSystem.update(delta);
        this.spellSystem.update(delta);
        this.cooldowns.update(delta);
        this.profiler.end('combat');

        // AI
        this.profiler.begin('ai');
        this.aiSystem.update(delta, [this.player]);
        this.profiler.end('ai');

        // Damage numbers
        this.damageNumbers.update(delta);

        // Minimap
        this.minimap.update(delta);

        // New systems update
        this.profiler.begin('newSystems');
        if (this.dspSystem.update) this.dspSystem.update(delta);
        if (this.narrativeSystem.update) this.narrativeSystem.update(delta);
        if (this.companionSystem.update) this.companionSystem.update(delta, this.player);
        this._updateCompanionFollowers();
        if (this.portalSystem) this.portalSystem.update();
        this.profiler.end('newSystems');

        // Sap regeneration
        if (!this.isDead) {
            this._regenSap(delta);
        }

        // Status effect visuals on enemies (throttled to every 8th frame)
        if (this._frameCount % 8 === 0) this._updateStatusEffectVisuals();

        // Fog of War
        this._updateFog();

        // Profiler (always last)
        this.profiler.end('total');
        this.profiler.stats.lightsActive = this.lighting.lights.length;
        this.profiler.stats.particlesActive = this.particles.getActiveCount?.() || 0;
        this.profiler.update(delta);

        // Dev: expose game state for automated testing (Playwright)
        if (import.meta.env.DEV && this.player) {
            window.__gameState = {
                scene: 'GameScene',
                playerX: Math.round(this.player.x),
                playerY: Math.round(this.player.y),
                playerHP: this.player.stats?.hp ?? 0,
                playerMaxHP: this.player.stats?.maxHp ?? 100,
                playerSap: this.player.stats?.sap ?? 0,
                playerMaxSap: this.player.stats?.maxSap ?? 100,
                playerGold: this.player.stats?.gold ?? 0,
                playerLevel: this.player.stats?.level ?? 1,
                dsp: this.dspSystem?.current ?? 100,
                dspMax: this.dspSystem?.max ?? 100,
                sapPhase: this.sapCycle?.currentPhase ?? 'blue',
                isPaused: this.scene.isActive('PauseMenuScene'),
                isInDialogue: this.dialogueSystem?.isActive?.() ?? false,
                isDead: this.isDead ?? false,
                inTacticalCombat: this.inTacticalCombat ?? false,
                activeEnemyCount: this.enemies?.children?.size ?? 0,
                activeQuestName: null // filled by QuestSystem if wired
            };
        }
    }

    _handleMovement() {
        let ix = 0, iy = 0;

        if (this.cursors.left.isDown  || this.wasd.left.isDown)  ix = -1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) ix =  1;
        if (this.cursors.up.isDown    || this.wasd.up.isDown)    iy = -1;
        if (this.cursors.down.isDown  || this.wasd.down.isDown)  iy =  1;

        this.physicsSystem.applyPlayerMovement(this.player, ix, iy, this.player.stats.speed);

        // Facing flip on horizontal input (applies to both sprite types).
        if (ix < 0) this.player.setFlipX(true);
        else if (ix > 0) this.player.setFlipX(false);

        // Animation — only the legacy animated sheet has walk/idle frames.
        // Static painterly art keeps its idle-breathe tween instead.
        if (!this.player._staticArt) {
            const current = this.player.anims?.currentAnim?.key;
            const isCasting = current === 'player-cast' && this.player.anims?.isPlaying;
            if (!isCasting) {
                const moving = ix !== 0 || iy !== 0;
                const target = moving ? 'player-walk' : 'player-idle';
                if (this.anims.exists(target) && current !== target) {
                    this.player.play(target, true);
                }
            }
        }
    }

    _regenSap(delta) {
        const regenRate = this.player.stats.sapRegenRate || 5;
        if (this.player.stats.sap < this.player.stats.maxSap) {
            this.player.stats.sap = Math.min(
                this.player.stats.maxSap,
                this.player.stats.sap + regenRate * (delta / 1000)
            );
        }
    }

    // ----------------------------------------------------------------
    // Ending
    // ----------------------------------------------------------------

    /**
     * Called when NarrativeSystem completes an era.
     * Only triggers the ending on the final era (era 6 per design docs).
     */
    _onEraCompleted(data) {
        const FINAL_ERA = 6;
        if (data?.eraNumber >= FINAL_ERA) {
            this.time.delayedCall(2000, () => this._evaluateEnding());
        }
    }

    /**
     * Evaluate the ending and transition to EndingScene.
     * Guards against double-calls with a flag.
     */
    _evaluateEnding() {
        if (this._endingTriggered) return;
        this._endingTriggered = true;

        const evaluator = new EndingEvaluator();
        const result    = evaluator.evaluate({ player: this.player });

        console.log(`[Ending] Triggering: ${result.endingId}`);

        // Fade out then launch ending scene
        this.cameras.main.fadeOut(1500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('EndingScene', { endingId: result.endingId });
        });
    }

    // ----------------------------------------------------------------
    // Fog of War
    // ----------------------------------------------------------------

    /**
     * Discover a zone — add it to the revealed set and fire zone:discovered.
     * Safe to call multiple times; subsequent calls for the same zone are no-ops.
     */
    _discoverZone(zoneId, zoneName) {
        if (this._discoveredZones.has(zoneId)) return;
        this._discoveredZones.add(zoneId);
        EventBus.emit('zone:discovered', { zoneId, zoneName: zoneName || zoneId });
    }

    /**
     * Redraws the fog-of-war overlay every frame.
     *
     * Logic:
     *   - Undiscovered zones get a semi-transparent dark rectangle over their bounds.
     *   - If the player physically walks into an undiscovered zone it is auto-revealed.
     */
    _updateFog() {
        // With a single on-screen zone there is no in-world fog overlay; the
        // active zone is always the discovered one. Kept as a no-op so callers
        // and the minimap's discovery tracking stay intact.
        if (this.currentZone && !this._discoveredZones?.has(this.currentZone)) {
            this._discoverZone(this.currentZone, this.currentLocationId);
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        if (this._unsubs) this._unsubs.forEach((fn) => fn());
        // Unsub save/restore listeners registered via ContentInitializer
        if (this._unsubSaveSystem) this._unsubSaveSystem();
        if (this.spellVfxIntegration) this.spellVfxIntegration.shutdown();
        if (this.sapCycleLightingIntegration) this.sapCycleLightingIntegration.destroy();
        if (this.tacticalCombatCameraBridge) this.tacticalCombatCameraBridge.destroy();
        this.lighting.shutdown();
        this.particles.shutdown();
        this.cameraSystem.shutdown();
        this.profiler.shutdown();
        this.damageNumbers.shutdown();
        this.minimap.destroy();
        this.saveManager.shutdown();
        for (const npc of this.npcs) npc.destroy();
        this._clearQuestBeacons();
        // Clean up systems that subscribe to EventBus (prevents ghost listeners on scene restart)
        this.sapCycle?.destroy?.();
        this.portalSystem?.destroy();
        this.zoneContentManager?.destroy?.();
        // Cleanup particle effects, audio, and physics
        this.particleEffects?.destroy();
        this.audioManager?.unwireFromGame();
        this.physicsSystem?.destroy();
        // Destroy zone tilemaps to prevent memory leak on scene restart
        if (this._zoneTilemaps) {
            for (const map of this._zoneTilemaps) {
                try { map.destroy(); } catch (_) {}
            }
        }
        // Destroy active-zone display objects (backdrop, decor, labels).
        if (this._activeZoneObjects) {
            for (const o of this._activeZoneObjects) { try { o.destroy(); } catch (_) {} }
            this._activeZoneObjects = [];
        }
        this.scene.stop('UIScene');
    }
}
