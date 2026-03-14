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
import CooldownManager from '../systems/CooldownManager.js';
import SaveManager from '../systems/SaveManager.js';
import DamageNumberRenderer from '../renderers/DamageNumberRenderer.js';
import MinimapRenderer from '../renderers/MinimapRenderer.js';

/**
 * GameScene — Main gameplay scene.
 *
 * Responsibilities:
 *  1. Initialise all engine systems (lighting, particles, camera, sap cycle, profiler).
 *  2. Build the world from location data (tilemap or procedural grid).
 *  3. Spawn the player, enemies, and NPCs.
 *  4. Handle input (movement, spell casting, UI hotkeys).
 *  5. Drive per-frame updates for every system.
 *  6. Process combat via EventBus events.
 *
 * The scene deliberately keeps high-level orchestration logic here
 * and delegates heavy work to dedicated systems.
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

        // ---- Utilities ----
        this.cooldowns = new CooldownManager();
        this.saveManager = new SaveManager();

        // ---- Renderers ----
        this.damageNumbers = new DamageNumberRenderer(this);
        this.minimap = new MinimapRenderer(this);

        // ---- World ----
        this._buildWorld();

        // ---- Player ----
        this._createPlayer();

        // ---- Enemies ----
        this._spawnEnemies();

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

        // ---- EventBus listeners ----
        this._unsubs = [
            EventBus.on('spell-cast', (data) => this._onSpellCast(data)),
            EventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data))
        ];

        console.log('[GameScene] Created');
    }

    // ----------------------------------------------------------------
    // World building
    // ----------------------------------------------------------------

    _buildWorld() {
        const worldWidth = 2400;
        const worldHeight = 1800;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Ground layer (simple grid for now)
        this._worldGfx = this.add.graphics().setDepth(0);
        this._worldGfx.fillStyle(0x1a2a1a, 1);
        this._worldGfx.fillRect(0, 0, worldWidth, worldHeight);

        // Grid overlay for spatial reference
        this._worldGfx.lineStyle(1, 0x223322, 0.3);
        const gridSize = 64;
        for (let x = 0; x <= worldWidth; x += gridSize) {
            this._worldGfx.lineBetween(x, 0, x, worldHeight);
        }
        for (let y = 0; y <= worldHeight; y += gridSize) {
            this._worldGfx.lineBetween(0, y, worldWidth, y);
        }

        // Decorative elements (trees, rocks)
        this.decorations = this.add.group();
        for (let i = 0; i < 40; i++) {
            const dx = Phaser.Math.Between(50, worldWidth - 50);
            const dy = Phaser.Math.Between(50, worldHeight - 50);
            const gfx = this.add.graphics().setDepth(1);
            gfx.fillStyle(0x225522, 0.8);
            gfx.fillCircle(dx, dy, Phaser.Math.Between(8, 20));
            this.decorations.add(gfx);
        }

        // Camera zones from location data
        const locations = dataManager.getAllLocations();
        locations.forEach((loc, i) => {
            const zoneX = (i % 3) * 800;
            const zoneY = Math.floor(i / 3) * 600;
            this.cameraSystem.addZone(
                { x: zoneX, y: zoneY, width: 800, height: 600 },
                {
                    zoom: loc.environment?.cameraZoom || 1.0,
                    priority: i,
                    onEnter: () => console.log(`[Zone] Entered: ${loc.name}`),
                    onExit: () => console.log(`[Zone] Exited: ${loc.name}`)
                }
            );
        });
    }

    // ----------------------------------------------------------------
    // Player
    // ----------------------------------------------------------------

    _createPlayer() {
        const config = dataManager.getConfig('balance.player') || {};
        const startX = 640;
        const startY = 400;

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
            spells: [],
            cooldowns: {}
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
    // Enemies
    // ----------------------------------------------------------------

    _spawnEnemies() {
        this.enemies = this.physics.add.group();

        const enemyDefs = dataManager.getAllEnemies();
        const spawnCount = Math.min(enemyDefs.length * 2, 8);

        for (let i = 0; i < spawnCount; i++) {
            const def = enemyDefs[i % enemyDefs.length];
            const ex = Phaser.Math.Between(100, 2300);
            const ey = Phaser.Math.Between(100, 1700);

            const enemy = this.physics.add.sprite(ex, ey, 'enemy');
            enemy.setDepth(4);
            enemy.setCollideWorldBounds(true);

            enemy.data = {
                definition: def,
                hp: def.baseStats?.hp || 50,
                maxHp: def.baseStats?.hp || 50,
                aiState: 'idle',
                aiTimer: 0,
                patrolOrigin: { x: ex, y: ey }
            };

            this.enemies.add(enemy);
        }

        // Player-enemy collision
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            // Contact damage
            if (!enemy.data._contactCooldown) {
                const dmg = 5;
                this.player.stats.hp = Math.max(0, this.player.stats.hp - dmg);
                EventBus.emit('player-stats-updated', this.player.stats);
                this.cameraSystem.shake('light');
                enemy.data._contactCooldown = true;
                this.time.delayedCall(500, () => { enemy.data._contactCooldown = false; });
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

        // Ambient lights scattered around
        for (let i = 0; i < 6; i++) {
            this.lighting.addLight(
                Phaser.Math.Between(100, 2300),
                Phaser.Math.Between(100, 1700),
                {
                    type: 'point',
                    color: [0x4488ff, 0xff4466, 0x44ff88, 0xffcc44][i % 4],
                    intensity: 0.6,
                    radius: 120,
                    pulse: { speed: 0.5, min: 0.4, max: 1.0 }
                }
            );
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
        this.spellKeys = [];
        for (let i = 1; i <= 5; i++) {
            this.spellKeys.push(
                this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[`ONE`].valueOf() + (i - 1))
            );
        }

        // Alternative: number keys
        this.input.keyboard.on('keydown-ONE', () => this._castSpell(0));
        this.input.keyboard.on('keydown-TWO', () => this._castSpell(1));
        this.input.keyboard.on('keydown-THREE', () => this._castSpell(2));
        this.input.keyboard.on('keydown-FOUR', () => this._castSpell(3));
        this.input.keyboard.on('keydown-FIVE', () => this._castSpell(4));
    }

    _castSpell(index) {
        const spell = this.player.stats.spells[index];
        if (!spell) return;

        // Cooldown check
        const now = this.time.now;
        const cd = this.player.stats.cooldowns[spell.id];
        if (cd && now < cd) {
            console.log(`[Spell] ${spell.name} on cooldown`);
            return;
        }

        // Sap cost check
        if (this.player.stats.sap < spell.sapCost) {
            console.log(`[Spell] Not enough Sap for ${spell.name}`);
            return;
        }

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
            this.particles.burst(
                this.player.x,
                this.player.y,
                spell.vfx.castParticle,
                { count: 15 }
            );
        }

        // Find nearest enemy in range
        let targetEnemy = null;
        let closestDist = 300; // spell range
        this.enemies.children.entries.forEach((e) => {
            if (!e.active) return;
            const d = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, e.x, e.y);
            if (d < closestDist) {
                closestDist = d;
                targetEnemy = e;
            }
        });

        if (targetEnemy) {
            targetEnemy.data.hp -= damage;

            // Hit particles
            this.particles.burst(targetEnemy.x, targetEnemy.y, 'hit_sparks', { count: 10 });

            // Dramatic camera for big spells
            if (spell.tier >= 3) {
                this.cameraSystem.dramaticSpellZoom(this.player, targetEnemy, 600);
            }

            console.log(`[Spell] ${spell.name} hit for ${damage} (modifier: ${modifier.toFixed(2)})`);

            if (targetEnemy.data.hp <= 0) {
                EventBus.emit('enemy-defeated', { enemy: targetEnemy, spell });
            }
        }

        // Update UI
        EventBus.emit('player-stats-updated', this.player.stats);
        EventBus.emit('spell-cast', { spell, damage, modifier });

        // Broadcast cooldown for UI
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

        // Drop loot
        const loot = enemy.data.definition?.lootTable;
        if (loot) {
            loot.forEach((drop) => {
                if (Math.random() < drop.chance) {
                    console.log(`[Loot] Dropped: ${drop.itemId} x${drop.quantity}`);
                }
            });
        }

        // Remove enemy
        enemy.destroy();

        // Respawn after delay
        this.time.delayedCall(10000, () => {
            this._respawnEnemy(enemy.data.definition);
        });
    }

    _respawnEnemy(def) {
        if (!def) return;
        const ex = Phaser.Math.Between(100, 2300);
        const ey = Phaser.Math.Between(100, 1700);

        const enemy = this.physics.add.sprite(ex, ey, 'enemy');
        enemy.setDepth(4);
        enemy.setCollideWorldBounds(true);
        enemy.data = {
            definition: def,
            hp: def.baseStats?.hp || 50,
            maxHp: def.baseStats?.hp || 50,
            aiState: 'idle',
            aiTimer: 0,
            patrolOrigin: { x: ex, y: ey }
        };
        this.enemies.add(enemy);
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

        // Player movement
        this.profiler.begin('input');
        this._handleMovement();
        this.profiler.end('input');

        // Sap cycle
        this.profiler.begin('sapCycle');
        this.sapCycle.update(delta);
        this.profiler.end('sapCycle');

        // Enemy AI
        this.profiler.begin('enemyAI');
        this._updateEnemyAI(delta);
        this.profiler.end('enemyAI');

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
        this._regenSap(delta);

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
        this.scene.stop('UIScene');
    }
}
