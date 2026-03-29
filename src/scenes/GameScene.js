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

    create() {
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
        this.tutorialSystem = TutorialSystem.getInstance();

        // ---- Utilities ----
        this.cooldowns = new CooldownManager();
        this.saveManager = new SaveManager();

        // ---- Renderers ----
        this.damageNumbers = new DamageNumberRenderer(this);
        this.minimap = new MinimapRenderer(this);

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

        // ---- World ----
        this._buildWorld();

        // ---- Zone Content Manager (per-zone visuals, enemies, music mood) ----
        this.zoneContentManager = new ZoneContentManager(this);
        // Initial zone entered after world is built; deferred so _unsubs is set up first
        this._pendingInitialZone = this.currentZone || 'canopy_of_life';

        // ---- Player ----
        this._createPlayer();

        // ---- Enemies (zone-based) ----
        this._spawnEnemies();

        // ---- NPCs ----
        this._spawnNPCs();

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
                getState: () => window.__gameState
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
        ContentInitializer.wireSaveSystem({
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
            skillCheckSystem: this.skillCheckSystem
        });

        // ---- Inventory cache (used by CraftingPanel for material checks) ----
        this._inventoryCache = {};

        // ---- EventBus listeners ----
        this._unsubs = [
            EventBus.on('spell-cast', (data) => this._onSpellCast(data)),
            EventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data)),
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
            EventBus.on('quest:started', (data) => this._onQuestStarted(data)),
            EventBus.on('quest:completed', (data) => this._onQuestCompleted(data)),
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
            // ---- Homebase exit (return from HomeBaseScene) ----
            EventBus.on('homebase:exit', (data) => {
                const zone = data?.returnZone || this.currentZone || 'canopy_of_life';
                this._onWorldMapTravelTo({ locationId: zone });
            }),
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
        ];

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
        this.currentLocationId = 'canopy_of_life';
        this._emitLocationDiscovery('canopy_of_life');

        // ---- Fog of War ----
        // canopy_of_life is the starting zone — always visible.
        this._discoveredZones = new Set(['canopy_of_life']);
        // Fog layer sits above zone graphics (depth 0) but below sprites (depth 4+).
        this._fogLayer = this.add.graphics().setDepth(5);
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
            }),
            EventBus.on('save-restore', (saveData) => {
                this._discoveredZones = new Set(saveData.discoveredZones || ['canopy_of_life']);
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
    }

    // ----------------------------------------------------------------
    // World building — distinct zones per location
    // ----------------------------------------------------------------

    _buildWorld() {
        const worldWidth = 2400;
        const worldHeight = 1800;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Zone layout: 3 columns x 2 rows, each 800x900
        const locations = dataManager.getAllLocations();
        this._worldGfx = this.add.graphics().setDepth(0);
        this._zoneLabels = [];

        // Zone definitions with grid positions
        this.zones = [];
        locations.forEach((loc, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const zoneX = col * 800;
            const zoneY = row * 900;
            const zoneW = 800;
            const zoneH = 900;

            const zone = { ...loc, bounds: { x: zoneX, y: zoneY, w: zoneW, h: zoneH } };
            this.zones.push(zone);

            // Draw zone background
            const color = parseInt((loc.environment?.ambientColor || '0x336633').replace('0x', ''), 16);
            this._worldGfx.fillStyle(color, 0.4);
            this._worldGfx.fillRect(zoneX, zoneY, zoneW, zoneH);

            // Zone border
            this._worldGfx.lineStyle(2, color, 0.7);
            this._worldGfx.strokeRect(zoneX + 2, zoneY + 2, zoneW - 4, zoneH - 4);

            // Grid overlay
            this._worldGfx.lineStyle(1, color, 0.15);
            const gridSize = 64;
            for (let x = zoneX; x <= zoneX + zoneW; x += gridSize) {
                this._worldGfx.lineBetween(x, zoneY, x, zoneY + zoneH);
            }
            for (let y = zoneY; y <= zoneY + zoneH; y += gridSize) {
                this._worldGfx.lineBetween(zoneX, y, zoneX + zoneW, y);
            }

            // Zone name label
            const label = this.add.text(zoneX + zoneW / 2, zoneY + 20, loc.name.toUpperCase(), {
                fontFamily: 'Open Sans',
                fontSize: '20px',
                color: `#${color.toString(16).padStart(6, '0')}`,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5, 0).setDepth(1).setAlpha(0.7);
            this._zoneLabels.push(label);

            // Level indicator
            this.add.text(zoneX + zoneW / 2, zoneY + 38, `Lv.${loc.level} — ${loc.type}`, {
                fontFamily: 'Open Sans',
                fontSize: '14px',
                color: '#888888',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5, 0).setDepth(1).setAlpha(0.6);

            // Weather effects per zone
            if (loc.environment?.weather === 'fog') {
                this._addFogEffect(zoneX, zoneY, zoneW, zoneH);
            }

            // Decorative elements (themed per zone)
            this._addZoneDecorations(zoneX, zoneY, zoneW, zoneH, loc);

            // Camera zone
            this.cameraSystem.addZone(
                { x: zoneX, y: zoneY, width: zoneW, height: zoneH },
                {
                    zoom: loc.environment?.cameraZoom || 1.0,
                    priority: i,
                    onEnter: () => {
                        if (this.currentLocationId !== loc.id) {
                            this.currentLocationId = loc.id;
                            this._emitLocationDiscovery(loc.id);
                            EventBus.emit('zone-entered', { locationId: loc.id, name: loc.name });
                            console.log(`[Zone] Entered: ${loc.name}`);
                        }
                    },
                    onExit: () => console.log(`[Zone] Exited: ${loc.name}`)
                }
            );
        });

        // Connection paths between zones (visual)
        this._drawZoneConnections(locations);
    }

    _addFogEffect(x, y, w, h) {
        for (let i = 0; i < 8; i++) {
            const fogX = x + Phaser.Math.Between(50, w - 50);
            const fogY = y + Phaser.Math.Between(50, h - 50);
            const fog = this.add.graphics().setDepth(3).setAlpha(0.15);
            fog.fillStyle(0xaabbcc, 1);
            fog.fillCircle(fogX, fogY, Phaser.Math.Between(40, 80));

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
        const count = location.type === 'dungeon' ? 15 : 25;
        for (let i = 0; i < count; i++) {
            const dx = x + Phaser.Math.Between(40, w - 40);
            const dy = y + Phaser.Math.Between(60, h - 40);
            const gfx = this.add.graphics().setDepth(1);

            const color = parseInt((location.environment?.ambientColor || '0x336633').replace('0x', ''), 16);

            if (location.type === 'dungeon') {
                // Crystal formations
                gfx.fillStyle(color, 0.6);
                const size = Phaser.Math.Between(4, 12);
                gfx.fillTriangle(dx, dy - size * 2, dx - size, dy, dx + size, dy);
            } else if (location.type === 'boss') {
                // Glowing pillars
                gfx.fillStyle(color, 0.5);
                gfx.fillRect(dx - 4, dy - 20, 8, 20);
                gfx.fillStyle(0xffffff, 0.3);
                gfx.fillCircle(dx, dy - 22, 6);
            } else {
                // Trees and rocks
                gfx.fillStyle(color, 0.5);
                gfx.fillCircle(dx, dy, Phaser.Math.Between(6, 16));
            }
        }
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
        const startX = 400;
        const startY = 450;
        const classDef = this.classSystem.getCurrentClass();

        // Use class sprite if available
        const spriteKey = classDef?.sprite && this.textures.exists(classDef.sprite)
            ? classDef.sprite : 'player';

        this.player = this.physics.add.sprite(startX, startY, spriteKey);
        this.player.setDepth(5);
        this.player.setCollideWorldBounds(true);
        this.player.setDamping(true);
        this.player.setDrag(0.85);
        this.player.setMaxVelocity(250);

        // Base stats — use Verdance attribute-based system
        if (classDef) {
            const baseStats = this.classSystem.applyClassStats({
                level: 1, experience: 0, gold: 0,
                spells: [], cooldowns: {},
                speed: 200, sapRegenRate: 5,
                sap: 100, maxSap: 100
            });

            this.player.stats = baseStats;

            // Apply ancestry bonuses if selected
            const ancestry = this.registry?.get('selectedAncestry');
            if (ancestry && this.attributeSystem) {
                this.attributeSystem.applyAncestryBonuses(ancestry);
            }
        } else {
            this.player.stats = {
                hp: 30, maxHp: 30, guard: 5, maxGuard: 5,
                sap: 100, maxSap: 100, ap: 2, maxAP: 2,
                speed: 200, level: 1, experience: 0, gold: 0,
                spells: [], cooldowns: {},
                might: 2, agility: 2, resilience: 2, insight: 2, charisma: 0,
                sapRegenRate: 5,
                classId: null, className: 'Adventurer', classRole: 'Adventurer'
            };
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

        // Spawn enemies per zone based on location data
        for (const zone of this.zones) {
            const enemyIds = zone.enemies || [];
            const spawnCount = zone.type === 'boss' ? 4 : 3;

            for (let i = 0; i < spawnCount; i++) {
                const enemyId = enemyIds[i % enemyIds.length];
                if (!enemyId) continue;

                const def = dataManager.getEnemy(enemyId);
                if (!def) continue;

                const ex = zone.bounds.x + Phaser.Math.Between(60, zone.bounds.w - 60);
                const ey = zone.bounds.y + Phaser.Math.Between(80, zone.bounds.h - 60);

                this._spawnSingleEnemy(def, ex, ey, zone.id);
            }
        }

        // Player-enemy overlap: start tactical encounter (design: tactical as main combat)
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            if (this.isDead || this.inTacticalCombat) return;
            if (enemy.data._encounterCooldown) return;
            enemy.data._encounterCooldown = true;
            this.time.delayedCall(2000, () => { if (enemy.active) enemy.data._encounterCooldown = false; });

            const nearby = this.enemies.children.entries.filter(e =>
                e.active && Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y) < 180
            );
            const encounterEnemies = nearby.slice(0, 4);
            this._startTacticalEncounter(encounterEnemies);
        });
    }

    _startTacticalEncounter(overworldEnemies) {
        if (this.inTacticalCombat || overworldEnemies.length === 0) return;
        this._tacticalOverworldEnemies = overworldEnemies;

        const defs = overworldEnemies.map(e => e.data.definition);
        const isBoss = defs.some(d => (d.tier || 1) >= 4) || defs.length >= 4;
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
                speed: d.baseStats?.speed ?? 3
            },
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
            gridHeight
        });

        EventBus.emit('tactical:encounterStarted', { allyCount: allies.length, enemyCount: enemies.length });
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
            this.player.stats.experience += rewards.experience || 0;
            (rewards.loot || []).forEach(drop => {
                EventBus.emit('inventory:addItem', { itemId: drop.itemId, quantity: drop.quantity || 1, itemData: dataManager.getItem(drop.itemId) });
            });
            this._tacticalOverworldEnemies.forEach(e => {
                if (e._hpBar) e._hpBar.destroy();
                e.destroy();
            });
            EventBus.emit('combat:ended', { result: 'victory', rewards });
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
        // Use zone-specific texture if available
        const textureKey = `enemy_${def.id}`;
        const texture = this.textures.exists(textureKey) ? textureKey : 'enemy';

        const enemy = this.physics.add.sprite(x, y, texture);
        enemy.setDepth(4);
        enemy.setCollideWorldBounds(true);

        enemy.data = {
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
        const ratio = enemy.data.hp / enemy.data.maxHp;
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
              dialogueId: 'sylara_greeting', keeperId: 'sylthara', interactRadius: 70 }
        ];

        for (const def of npcDefs) {
            const npc = new NPC(this, def.x, def.y, {
                name: def.name,
                role: def.role,
                dialogue: def.dialogue || [],
                interactRadius: def.interactRadius || 60,
                dialogueId: def.dialogueId,
                shopInventory: def.shopInventory,
                keeperId: def.keeperId,
                stationId: def.stationId
            });
            this.npcs.push(npc);
        }

        // Override NPC E-key to use DialogueSystem for richer dialogues
        this._wireNPCDialogues();
    }

    _wireNPCDialogues() {
        // When an NPC completes its basic dialogue, check if it has a dialogueId
        // for the full DialogueSystem
        EventBus.on('npc-dialogue-complete', (data) => {
            const npc = this.npcs.find(n => n.name === data.npc);
            if (!npc) return;

            // Wire shop:open for merchant/shop NPCs
            if (npc.role === 'merchant' || npc.role === 'shop' || npc.isShopkeeper) {
                EventBus.emit('shop:open', {
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

        // Ambient lights per zone
        for (const zone of this.zones) {
            const color = parseInt((zone.environment?.ambientColor || '0x336633').replace('0x', ''), 16);
            const cx = zone.bounds.x + zone.bounds.w / 2;
            const cy = zone.bounds.y + zone.bounds.h / 2;

            this.lighting.addLight(cx, cy, {
                type: 'point',
                color,
                intensity: 0.5,
                radius: 200,
                pulse: { speed: 0.3, min: 0.3, max: 0.7 }
            });
        }
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

        // Sap cost check
        if (this.player.stats.sap < spell.sapCost) return;

        // Apply phase modifier
        const modifier = this.sapCycle.getBlendedModifier(spell);
        const baseDmg = spell.baseDamage ?? spell.damage ?? 0;
        const damage = Math.round(baseDmg * modifier);

        // Consume sap (personal) and DSP (world resource)
        this.player.stats.sap -= spell.sapCost;
        const dspCost = spell.dspCost || spell.sapCost;
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
        this.enemies.children.entries.forEach((e) => {
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
                // Show floating "Out of range!" text and bail without consuming sap.
                // Refund the sap we already deducted above.
                this.player.stats.sap += spell.sapCost;
                this.damageNumbers.show(
                    this.player.x, this.player.y - 30,
                    validation.reason,
                    0xff4444
                );
                EventBus.emit('player-stats-updated', this.player.stats);
                return;
            }

            // For ranged/magic attacks fire a projectile event before applying damage
            if (weaponData.attackType !== 'melee') {
                this.attackTypeSystem.fireProjectile(this.player, targetEnemy, weaponData.attackType, {
                    spell,
                    damage
                });
            }
            // ── End attack-type validation ──────────────────────────────

            const atk = this.player.stats.attack ?? this.player.stats.might ?? 0;
            const finalDmg = Math.max(1, damage + atk);
            targetEnemy.data.hp -= finalDmg;

            // Hit flash + knockback
            this._flashEnemyHit(targetEnemy);
            this._knockbackEnemy(targetEnemy, this.player.x, this.player.y);

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

            if (targetEnemy.data.hp <= 0) {
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
     * Apply a short knockback impulse away from the damage source.
     * @param {Phaser.GameObjects.Sprite} enemySprite
     * @param {number} sourceX
     * @param {number} sourceY
     */
    _knockbackEnemy(enemySprite, sourceX, sourceY) {
        if (!enemySprite?.body) return;
        const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemySprite.x, enemySprite.y);
        enemySprite.body.setVelocity(Math.cos(angle) * 120, Math.sin(angle) * 120);
        this.time.delayedCall(200, () => {
            if (enemySprite?.body?.velocity) {
                enemySprite.body.setVelocity(0, 0);
            }
        });
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
        // Could trigger global effects, achievements, etc.
    }

    _onEnemyDefeated(data) {
        const { enemy } = data;

        // Death particles
        this.particles.burst(enemy.x, enemy.y, 'hit_sparks', { count: 20 });

        // Destroy HP bar
        if (enemy._hpBar) { enemy._hpBar.destroy(); enemy._hpBar = null; }

        // Award XP
        const xpReward = (enemy.data.definition?.baseStats?.hp || 50) / 2;
        this.player.stats.experience += xpReward;
        this.damageNumbers.show(enemy.x, enemy.y - 30, `+${Math.round(xpReward)} XP`, 0x44ff88);

        // Award gold (Sap Cycle: lootRateMultiplier affects economy)
        const lootTable = enemy.data.definition?.lootTable;
        const sapMods = this.sapCycle.getModifiers();
        if (lootTable) {
            const rawGold = Phaser.Math.Between(lootTable.goldMin || 5, lootTable.goldMax || 15);
            const goldDrop = Math.max(0, Math.round(rawGold * (sapMods.lootRateMultiplier ?? 1)));
            this.player.stats.gold += goldDrop;

            // Drop items to inventory (phase affects drop rate)
            const items = lootTable.items || [];
            for (const drop of items) {
                const chance = (drop.dropChance ?? 0.5) * (sapMods.lootRateMultiplier ?? 1);
                if (Math.random() < Math.min(1, chance)) {
                    const itemData = dataManager.getItem(drop.itemId);
                    EventBus.emit('inventory:addItem', {
                        itemId: drop.itemId,
                        quantity: 1,
                        itemData: itemData || { id: drop.itemId, name: drop.itemId, stackable: true }
                    });
                    console.log(`[Loot] Dropped: ${drop.itemId}`);
                }
            }
        }

        // Notify quest system
        const enemyId = enemy.data.definition?.id;
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

        // Remove enemy
        enemy.destroy();

        // Check level up
        this._checkLevelUp();

        // Update UI
        EventBus.emit('player-stats-updated', this.player.stats);

        // Respawn after delay
        this.time.delayedCall(15000, () => {
            this._respawnEnemy(enemy.data.definition, enemy.data.zoneId);
        });
    }

    _checkLevelUp() {
        // Max level 10 per design docs (config.json balance.progression.maxLevel)
        const xpTable = [0, 100, 250, 500, 850, 1300, 1900, 2600, 3500, 5000];
        const currentLevel = this.player.stats.level;
        const requiredXP = xpTable[currentLevel] || 5000;

        if (this.player.stats.experience >= requiredXP && currentLevel < 10) {
            this.player.stats.experience -= requiredXP;
            this.player.stats.level++;

            const classDef = this.classSystem.getCurrentClass();
            if (classDef) {
                // Apply class-specific stat growth
                const newStats = this.classSystem.applyLevelUpGrowth(this.player.stats, this.player.stats.level);
                Object.assign(this.player.stats, newStats);

                // Unlock new class spells at milestone levels
                const availableSpells = this.classSystem.getAvailableSpells(this.player.stats.level);
                for (const spellId of availableSpells) {
                    if (!this.player.stats.spells.find(s => s.id === spellId)) {
                        const spell = dataManager.getSpell(spellId);
                        if (spell) {
                            this.player.stats.spells.push(spell);
                            EventBus.emit('spell:unlocked', { spell });
                            console.log(`[Spell Unlocked] ${spell.name}`);
                        }
                    }
                }

                // Update passives
                this.player.stats.passives = this.classSystem.getActivePassives(this.player.stats.level);
            } else {
                // Fallback flat growth
                this.player.stats.maxHp += 15;
                this.player.stats.hp = this.player.stats.maxHp;
                this.player.stats.maxSap += 10;
                this.player.stats.sap = this.player.stats.maxSap;
            }

            this.cameraSystem.shake('medium');
            this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 30 });

            // Award attribute point per level (design doc: balance.progression.perLevelRewards)
            this.attributeSystem.addAttributePoints(1);

            EventBus.emit('player:levelUp', { level: this.player.stats.level });
            EventBus.emit('player-stats-updated', this.player.stats);
            console.log(`[Level Up] ${this.player.stats.className} is now level ${this.player.stats.level}`);
        }
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
            cam.clearRenderToTexture();
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
        this.currentZone = locationId;
        console.log(`[WorldMap] Travelling to zone: ${locationId}`);
        if (this.player) {
            const ZONE_SPAWNS = {
                canopy_of_life: { x: 640, y: 360 }, verdant_exchange: { x: 580, y: 400 },
                bloomguard_barracks: { x: 700, y: 400 }, emerald_sanctum: { x: 620, y: 450 },
                whispering_veil: { x: 660, y: 450 }, hollowroot_catacombs: { x: 580, y: 520 },
                spindlewood_forest: { x: 360, y: 360 }, mycelium_nexus: { x: 580, y: 600 },
                thornbinder_safehouse: { x: 260, y: 420 }, emerald_cascades: { x: 820, y: 380 },
                glinting_groves: { x: 450, y: 280 }, thornbinder_training_grounds: { x: 300, y: 300 },
                wildkin_hunting_grounds: { x: 240, y: 380 }, sporecaller_labs: { x: 620, y: 660 },
                veil_echo_chamber: { x: 870, y: 480 }, abyss_forward_camp: { x: 920, y: 420 },
                hollow_tree_grove: { x: 860, y: 560 }, corruption_quarantine_zone: { x: 740, y: 620 },
                sapling_plantation: { x: 500, y: 240 }, ancient_unbinding_site: { x: 960, y: 540 },
                veil_tear_rift_alpha: { x: 1000, y: 460 }, veil_tear_rift_beta: { x: 1060, y: 520 },
                veil_tear_rift_gamma: { x: 1100, y: 580 }, the_scar: { x: 1050, y: 380 },
                everwood_heart: { x: 640, y: 700 }, void_nexus: { x: 1140, y: 660 },
                canopy_overlook: { x: 700, y: 200 },
            };
            const spawn = ZONE_SPAWNS[locationId] || { x: 640, y: 360 };
            this.player.setPosition(spawn.x, spawn.y);
            if (this.cameraSystem?.camera) this.cameraSystem.camera.centerOn(spawn.x, spawn.y);
        }
        // Fog of War: reveal the travel destination immediately
        const destZone = this.zones?.find(z => z.id === locationId);
        this._discoverZone(locationId, destZone?.name || locationId);
        EventBus.emit('zone:changed', { locationId });

        // Zone content: update visuals, enemies, and music mood
        if (this.zoneContentManager) {
            this.zoneContentManager.enterZone(locationId);
        }
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

        const sapPhase = this.sapCycleSystem?.currentPhase || 'blue';
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

        // Respawn at Verdant Grove start
        this.player.setPosition(400, 450);
        this.player.setAlpha(1);
        this.player.stats.hp = Math.round(this.player.stats.maxHp * 0.5);
        this.player.stats.sap = Math.round(this.player.stats.maxSap * 0.5);

        // Lose some gold
        const goldLoss = Math.floor(this.player.stats.gold * 0.1);
        this.player.stats.gold = Math.max(0, this.player.stats.gold - goldLoss);

        this.currentLocationId = 'canopy_of_life';
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

        this.enemies.children.entries.forEach((enemy) => {
            if (!enemy.active || !enemy.data) return;

            const d = enemy.data;
            d.aiTimer += dt;

            // Update HP bar position
            this._updateEnemyHpBar(enemy);

            const distToPlayer = Phaser.Math.Distance.Between(
                enemy.x, enemy.y, this.player.x, this.player.y
            );

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
                            const damage = d.definition?.baseStats?.damage ?? d.definition?.baseStats?.atk ?? 5;
                            this.player.stats.hp = Math.max(0, this.player.stats.hp - damage);
                            EventBus.emit('enemy-attack', { enemy, player: this.player, damage });
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
            this.enemies.children.entries.forEach((enemy) => {
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
        const speed = this.player.stats.speed;
        let vx = 0;
        let vy = 0;

        if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
        if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
        if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
        if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }

        this.player.setVelocity(vx, vy);
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
        if (!this._fogLayer || !this.zones) return;

        this._fogLayer.clear();

        for (const zone of this.zones) {
            const { x, y, w, h } = zone.bounds;

            // Auto-discover zone when player physically walks into it
            if (!this._discoveredZones.has(zone.id) && this.player) {
                const px = this.player.x;
                const py = this.player.y;
                if (px >= x && px <= x + w && py >= y && py <= y + h) {
                    this._discoverZone(zone.id, zone.name);
                }
            }

            // Draw fog over undiscovered zones
            if (!this._discoveredZones.has(zone.id)) {
                this._fogLayer.fillStyle(0x000000, 0.75);
                this._fogLayer.fillRect(x, y, w, h);
            }
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        if (this._unsubs) this._unsubs.forEach((fn) => fn());
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
        this.scene.stop('UIScene');
    }
}
