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
import NPC from '../components/NPC.js';

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

        // ---- Gameplay Systems (singletons) ----
        this.combatSystem = CombatSystem.getInstance();
        this.aiSystem = AISystem.getInstance();
        this.progression = ProgressionSystem.getInstance();
        this.spellSystem = SpellSystem.getInstance();
        this.questSystem = QuestSystem.getInstance();
        this.dialogueSystem = DialogueSystem.getInstance(this);

        // ---- Utilities ----
        this.cooldowns = new CooldownManager();
        this.saveManager = new SaveManager();

        // ---- Renderers ----
        this.damageNumbers = new DamageNumberRenderer(this);
        this.minimap = new MinimapRenderer(this);

        // ---- Content Registration ----
        ContentInitializer.registerQuests();
        ContentInitializer.registerDialogues(this);

        // ---- World ----
        this._buildWorld();

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

        // ---- Hotkeys ----
        this.input.keyboard.on('keydown-F2', () => {
            this.scene.switch('EditorScene');
        });

        // ---- Minimap binding ----
        this.minimap.bind(this.player, this.enemies, null, this.cameras.main);

        // ---- Auto-save ----
        this.saveManager.enableAutoSave(60000);

        // ---- Wire save system ----
        ContentInitializer.wireSaveSystem({
            questSystem: this.questSystem,
            dialogueSystem: this.dialogueSystem
        });

        // ---- EventBus listeners ----
        this._unsubs = [
            EventBus.on('spell-cast', (data) => this._onSpellCast(data)),
            EventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data)),
            EventBus.on('dialogue:start', (data) => this._onDialogueStart(data)),
            EventBus.on('quest:start', (data) => this._onQuestStart(data)),
            EventBus.on('quest:completed', (data) => this._onQuestCompleted(data))
        ];

        // ---- Track current location ----
        this.currentLocationId = 'verdant_grove';
        this._emitLocationDiscovery('verdant_grove');

        // ---- Start first quest automatically ----
        this.time.delayedCall(2000, () => {
            this.dialogueSystem.startDialogue('elder_awakening');
        });

        // ---- Death state ----
        this.isDead = false;

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
                fontFamily: 'monospace',
                fontSize: '14px',
                color: `#${color.toString(16).padStart(6, '0')}`,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5, 0).setDepth(1).setAlpha(0.7);
            this._zoneLabels.push(label);

            // Level indicator
            this.add.text(zoneX + zoneW / 2, zoneY + 38, `Lv.${loc.level} — ${loc.type}`, {
                fontFamily: 'monospace',
                fontSize: '10px',
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
        const config = dataManager.getConfig('balance.player') || {};
        const startX = 400;
        const startY = 450;

        this.player = this.physics.add.sprite(startX, startY, 'player');
        this.player.setDepth(5);
        this.player.setCollideWorldBounds(true);
        this.player.setDamping(true);
        this.player.setDrag(0.85);
        this.player.setMaxVelocity(250);

        // Player stats
        this.player.stats = {
            hp: config.startingHp || 100,
            maxHp: config.startingHp || 100,
            sap: config.startingSap || 100,
            maxSap: config.startingSap || 100,
            speed: 200,
            level: 1,
            experience: 0,
            gold: 0,
            spells: [],
            cooldowns: {},
            defense: 0,
            attack: 0
        };

        // Equip starting spells
        const startSpells = ['azure_bolt', 'crimson_surge', 'verdant_bloom', 'shadow_strike', 'radiant_burst'];
        startSpells.forEach((id) => {
            const spell = dataManager.getSpell(id);
            if (spell) this.player.stats.spells.push(spell);
        });

        // Emit initial stats
        EventBus.emit('player-stats-updated', this.player.stats);
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

        // Player-enemy collision
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            if (this.isDead) return;
            if (!enemy.data._contactCooldown) {
                const dmg = Math.max(1, 5 - this.player.stats.defense);
                this.player.stats.hp = Math.max(0, this.player.stats.hp - dmg);
                EventBus.emit('player-stats-updated', this.player.stats);
                this.cameraSystem.shake('light');
                this.damageNumbers.show(this.player.x, this.player.y - 20, dmg, 0xff4444);
                enemy.data._contactCooldown = true;
                this.time.delayedCall(500, () => { enemy.data._contactCooldown = false; });

                // Check death
                if (this.player.stats.hp <= 0) {
                    this._onPlayerDeath();
                }
            }
        });
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
            zoneId
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

        // Elder — quest giver in Verdant Grove
        const elder = new NPC(this, 300, 350, {
            name: 'Elder Thalos',
            role: 'quest',
            dialogue: [
                'The Sap flows through all things here.',
                'Seek the Crystal Caverns when you are ready.',
                'The three phases of Sap shape our world.'
            ],
            interactRadius: 70,
            dialogueId: 'elder_awakening'
        });
        this.npcs.push(elder);

        // Herbalist — repeatable quest in Verdant Grove
        const herbalist = new NPC(this, 550, 300, {
            name: 'Lyra',
            role: 'quest',
            dialogue: [
                'Need more herbs... always more herbs.',
                'The forest creatures carry useful ingredients.',
                'Bring me potions and I\'ll reward you well!'
            ],
            interactRadius: 60,
            dialogueId: 'herbalist_quest'
        });
        this.npcs.push(herbalist);

        // Scholar — side quest near Sunken Ruins zone edge
        const scholar = new NPC(this, 700, 750, {
            name: 'Archivist Kael',
            role: 'quest',
            dialogue: [
                'Fascinating readings from the south...',
                'The Sunken Ruins hold ancient knowledge.',
                'I\'d go myself, but... field work isn\'t my forte.'
            ],
            interactRadius: 60,
            dialogueId: 'scholar_quest'
        });
        this.npcs.push(scholar);

        // Merchant — shop NPC
        const merchant = new NPC(this, 450, 600, {
            name: 'Merchant Orla',
            role: 'shop',
            dialogue: [
                'Welcome! Browse my wares.',
                'Best potions this side of the Nexus!',
                'Come back anytime!'
            ],
            interactRadius: 60,
            dialogueId: 'merchant_greeting',
            shopInventory: [
                { itemId: 'minor_health_potion', price: 10 },
                { itemId: 'sap_crystal', price: 20 }
            ]
        });
        this.npcs.push(merchant);

        // Override NPC E-key to use DialogueSystem for richer dialogues
        this._wireNPCDialogues();
    }

    _wireNPCDialogues() {
        // When an NPC completes its basic dialogue, check if it has a dialogueId
        // for the full DialogueSystem
        EventBus.on('npc-dialogue-complete', (data) => {
            const npc = this.npcs.find(n => n.name === data.npc);
            if (npc && npc.config.dialogueId) {
                const dialogue = dataManager.getDialogue(npc.config.dialogueId);
                if (dialogue) {
                    this.dialogueSystem.startDialogue(npc.config.dialogueId);
                }
            }
        });
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
        const damage = Math.round(spell.baseDamage * modifier);

        // Consume sap
        this.player.stats.sap -= spell.sapCost;

        // Set cooldown
        this.player.stats.cooldowns[spell.id] = now + spell.cooldown * 1000;

        // Camera shake for the spell
        this.cameraSystem.shake('spell');

        // VFX
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        if (spell.vfx?.castParticle) {
            this.particles.burst(this.player.x, this.player.y, spell.vfx.castParticle, { count: 15 });
        }

        // Healing spell
        if (spell.healAmount) {
            const healMod = this.sapCycle.getBlendedModifier(spell);
            const healAmt = Math.round(spell.healAmount * healMod);
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healAmt);
            this.damageNumbers.show(this.player.x, this.player.y - 20, healAmt, 0x44ff88);
            EventBus.emit('player-stats-updated', this.player.stats);
            EventBus.emit('spell-cast', { spell, damage: 0, modifier });
            this._broadcastCooldown(spell);
            return;
        }

        // Find nearest enemy in range
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
            const finalDmg = Math.max(1, damage + this.player.stats.attack);
            targetEnemy.data.hp -= finalDmg;

            // Hit particles
            this.particles.burst(targetEnemy.x, targetEnemy.y, 'hit_sparks', { count: 10 });

            // Damage number
            this.damageNumbers.show(targetEnemy.x, targetEnemy.y - 20, finalDmg, 0xffaa44);

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

        // Update UI
        EventBus.emit('player-stats-updated', this.player.stats);
        EventBus.emit('spell-cast', { spell, damage, modifier });
        this._broadcastCooldown(spell);
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

        // Award gold
        const lootTable = enemy.data.definition?.lootTable;
        if (lootTable) {
            const goldDrop = Phaser.Math.Between(lootTable.goldMin || 5, lootTable.goldMax || 15);
            this.player.stats.gold += goldDrop;

            // Drop items to inventory
            const items = lootTable.items || [];
            for (const drop of items) {
                if (Math.random() < drop.dropChance) {
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
        const xpTable = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000];
        const currentLevel = this.player.stats.level;
        const requiredXP = xpTable[currentLevel] || (currentLevel * currentLevel * 100);

        if (this.player.stats.experience >= requiredXP && currentLevel < 50) {
            this.player.stats.experience -= requiredXP;
            this.player.stats.level++;
            this.player.stats.maxHp += 15;
            this.player.stats.hp = this.player.stats.maxHp;
            this.player.stats.maxSap += 10;
            this.player.stats.sap = this.player.stats.maxSap;

            this.cameraSystem.shake('medium');
            this.particles.burst(this.player.x, this.player.y, 'hit_sparks', { count: 30 });

            EventBus.emit('player:levelUp', { level: this.player.stats.level });
            EventBus.emit('player-stats-updated', this.player.stats);
            console.log(`[Level Up] Player is now level ${this.player.stats.level}`);
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
            { fontFamily: 'monospace', fontSize: '32px', color: '#ff4444', stroke: '#000', strokeThickness: 4 }
        ).setOrigin(0.5).setDepth(10000).setScrollFactor(0);

        const respawnText = this.add.text(
            this.cameras.main.scrollX + 640,
            this.cameras.main.scrollY + 350,
            'Respawning...',
            { fontFamily: 'monospace', fontSize: '14px', color: '#aaaaaa', stroke: '#000', strokeThickness: 2 }
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

        this.currentLocationId = 'verdant_grove';
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
                    enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

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
        this.profiler.end('sapCycle');

        // Enemy AI
        this.profiler.begin('enemyAI');
        if (!this.isDead) {
            this._updateEnemyAI(delta);
        }
        this.profiler.end('enemyAI');

        // NPCs
        for (const npc of this.npcs) {
            npc.update(delta, this.player);
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

        // Sap regeneration
        if (!this.isDead) {
            this._regenSap(delta);
        }

        // Profiler (always last)
        this.profiler.end('total');
        this.profiler.stats.lightsActive = this.lighting.lights.length;
        this.profiler.stats.particlesActive = this.particles.getActiveCount?.() || 0;
        this.profiler.update(delta);
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
        const regenRate = 5; // sap per second
        if (this.player.stats.sap < this.player.stats.maxSap) {
            this.player.stats.sap = Math.min(
                this.player.stats.maxSap,
                this.player.stats.sap + regenRate * (delta / 1000)
            );
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        if (this._unsubs) this._unsubs.forEach((fn) => fn());
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
