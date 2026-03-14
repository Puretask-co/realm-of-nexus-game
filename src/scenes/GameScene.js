import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { DataManager } from '../systems/DataManager.js';
import { SapCycleManager } from '../systems/SapCycleManager.js';
import { CooldownManager } from '../systems/CooldownManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SpellSystem } from '../systems/SpellSystem.js';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { AudioManager } from '../systems/AudioManager.js';
import { SaveManager } from '../systems/SaveManager.js';
import { PerformanceProfiler } from '../systems/PerformanceProfiler.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';
import { Player } from '../components/Player.js';
import { Enemy } from '../components/Enemy.js';
import { NPC } from '../components/NPC.js';
import { Projectile } from '../components/Projectile.js';

/**
 * GameScene - Main gameplay scene for Verdance.
 * Initializes all game systems, spawns entities, and runs the game loop.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    // ─── Initialize Systems ──────────────────────────────────────
    this.dataManager = DataManager.getInstance();
    this.sapCycle = SapCycleManager.getInstance();
    this.cooldownManager = CooldownManager.getInstance();
    this.combatSystem = CombatSystem.getInstance();
    this.spellSystem = SpellSystem.getInstance();
    this.progressionSystem = ProgressionSystem.getInstance();
    this.aiSystem = AISystem.getInstance();

    // Apply config to systems
    const config = this.dataManager.data.config;
    this.sapCycle.applyConfig(config);
    this.combatSystem.applyConfig(config);
    this.progressionSystem.applyConfig(config);

    // Set difficulty
    const difficulty = config?.difficulty?.normal || {};
    this.combatSystem.setDifficulty(difficulty);

    // Load spells into SpellSystem
    this.spellSystem.loadSpells(this.dataManager.data.spells || []);

    // Start Sap Cycle
    this.sapCycle.start(config);

    // ─── Dialogue System ──────────────────────────────────────────
    this.dialogueSystem = DialogueSystem.getInstance(this);
    const characters = this.dataManager.data.characters || [];
    for (const char of characters) {
      this.dialogueSystem.registerCharacter(char.id, char);
    }
    const dialogues = this.dataManager.data.dialogues || [];
    for (const dlg of dialogues) {
      this.dialogueSystem.registerDialogue(dlg.id, dlg);
    }

    // ─── Quest System ─────────────────────────────────────────────
    this.questSystem = QuestSystem.getInstance();
    const quests = this.dataManager.data.quests || [];
    for (const quest of quests) {
      this.questSystem.registerQuest(quest);
    }

    // ─── Audio Manager ────────────────────────────────────────────
    this.audioManager = AudioManager.getInstance(this);

    // ─── World Setup ─────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#1a2a1a');
    this.physics.world.setBounds(0, 0, 2560, 1440);

    // Draw ground grid for visual reference
    this.drawWorldGrid();

    // ─── Player Class System ──────────────────────────────────────
    this.playerClassSystem = PlayerClassSystem.getInstance();
    if (!this.playerClassSystem.getCurrentClass()) {
      this.playerClassSystem.selectClass('temporal_mage');
    }

    // ─── Spawn Player ────────────────────────────────────────────
    this.player = new Player(this, 640, 360);
    this.player.setupInput();
    this.player.equipStartingSpells();

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setBounds(0, 0, 2560, 1440);

    // ─── Spawn Enemies ───────────────────────────────────────────
    this.enemies = [];
    this.spawnEnemiesFromData();

    // ─── Spawn NPCs ──────────────────────────────────────────────
    this.npcs = [];
    this.spawnNPCsFromData();

    // ─── Projectiles ─────────────────────────────────────────────
    this.projectiles = [];

    // ─── Collision Setup ─────────────────────────────────────────
    this.setupCollisions();

    // ─── Event Listeners ─────────────────────────────────────────
    this.setupEventListeners();

    // ─── Debug HUD (only FPS counter, rest is in UIScene) ──────
    if (GameConfig.DEBUG.SHOW_FPS) {
      this.fpsText = this.add.text(10, 10, '', {
        fontSize: '12px', fill: '#00ff00', fontFamily: 'monospace'
      }).setScrollFactor(0).setDepth(9999);
    }

    // F2 - Toggle to Editor Scene
    this.input.keyboard.on('keydown-F2', () => {
      this.scene.stop('UIScene');
      this.scene.start('EditorScene');
    });

    // ─── SaveManager ───────────────────────────────────────────
    this.saveManager = SaveManager.getInstance();
    this.saveManager.register('progression', {
      serialize: () => this.progressionSystem.serialize(),
      deserialize: (data) => this.progressionSystem.deserialize(data)
    });
    this.saveManager.register('player', {
      serialize: () => ({
        x: this.player.x,
        y: this.player.y,
        stats: { ...this.player.stats }
      }),
      deserialize: (data) => {
        if (data.x) this.player.sprite.x = data.x;
        if (data.y) this.player.sprite.y = data.y;
        if (data.stats) Object.assign(this.player.stats, data.stats);
      }
    });

    this.saveManager.register('playerClass', {
      serialize: () => this.playerClassSystem.serialize(),
      deserialize: (data) => this.playerClassSystem.deserialize(data)
    });
    this.saveManager.register('quests', {
      serialize: () => this.questSystem.saveState(),
      deserialize: (data) => this.questSystem.loadState(data)
    });
    this.saveManager.register('dialogue', {
      serialize: () => this.dialogueSystem.saveState(),
      deserialize: (data) => this.dialogueSystem.loadState(data)
    });

    // ─── Performance Profiler ──────────────────────────────────
    this.profiler = PerformanceProfiler.getInstance();
    this.profiler.attach(this);

    // ─── Launch UIScene as parallel overlay ─────────────────────
    this.scene.launch('UIScene');

    // Enable hot reload in dev mode
    if (import.meta.hot || import.meta.env?.DEV) {
      this.dataManager.enableHotReload();
    }

    this.eventBus.emit('scene:ready', { scene: 'GameScene' });
  }

  // ─── World Grid ──────────────────────────────────────────────────

  drawWorldGrid() {
    const graphics = this.add.graphics();
    graphics.setDepth(-1);

    // Ground tiles
    const tileSize = GameConfig.TILE_SIZE;
    for (let x = 0; x < 2560; x += tileSize) {
      for (let y = 0; y < 1440; y += tileSize) {
        const shade = ((x / tileSize + y / tileSize) % 2 === 0) ? 0x1a2a1a : 0x1e2e1e;
        graphics.fillStyle(shade, 1);
        graphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // ─── Entity Spawning ─────────────────────────────────────────────

  spawnEnemiesFromData() {
    const enemyDefs = this.dataManager.data.enemies || [];
    const locations = this.dataManager.data.locations || [];

    // Spawn enemies from location spawn points
    for (const location of locations) {
      if (!location.spawns) continue;
      for (const spawn of location.spawns) {
        const def = enemyDefs.find(e => e.id === spawn.enemyId);
        if (!def) continue;

        const count = spawn.count || 1;
        for (let i = 0; i < count; i++) {
          const x = (spawn.x || 400) + (i * 80) + Math.random() * 40;
          const y = (spawn.y || 300) + Math.random() * 40;
          this.spawnEnemy(def, x, y);
        }
      }
    }

    // If no spawns found, create some test enemies
    if (this.enemies.length === 0) {
      for (const def of enemyDefs) {
        const x = 300 + Math.random() * 600;
        const y = 200 + Math.random() * 400;
        this.spawnEnemy(def, x, y);
      }
    }
  }

  spawnEnemy(definition, x, y) {
    const enemy = new Enemy(this, x, y, definition);
    this.enemies.push(enemy);

    // Register with AI system
    this.aiSystem.register({
      id: enemy.id,
      name: enemy.name,
      stats: enemy.stats,
      ai: enemy.ai,
      abilities: enemy.abilities,
      sapPhaseVulnerability: enemy.sapPhaseVulnerability,
      experienceReward: enemy.experienceReward,
      lootTable: enemy.lootTable,
      attackRange: definition.attackRange || 1.5,
      speed: enemy.stats.speed,
      x: enemy.sprite.x,
      y: enemy.sprite.y
    });

    return enemy;
  }

  spawnNPCsFromData() {
    const characters = this.dataManager.data.characters || [];

    // Place NPCs at predefined positions or spread them out
    const positions = [
      { x: 640, y: 200 },
      { x: 900, y: 400 },
      { x: 400, y: 500 },
      { x: 800, y: 600 }
    ];

    for (let i = 0; i < characters.length; i++) {
      const pos = positions[i] || { x: 500 + i * 100, y: 300 };
      const npc = new NPC(this, pos.x, pos.y, characters[i]);
      this.npcs.push(npc);
    }
  }

  // ─── Collision Setup ─────────────────────────────────────────────

  setupCollisions() {
    // Player <-> Enemy collision
    for (const enemy of this.enemies) {
      this.physics.add.overlap(
        this.player.sprite,
        enemy.sprite,
        () => this.onPlayerEnemyCollision(enemy),
        null,
        this
      );
    }
  }

  onPlayerEnemyCollision(enemy) {
    if (enemy.stats.hp <= 0) return;
    // Contact damage
    this.player.takeDamage(enemy.stats.atk * 0.3);
  }

  // ─── Event Listeners ─────────────────────────────────────────────

  setupEventListeners() {
    // Phase change visual updates
    this.eventBus.on('phase-changed', (data) => {
      this.onPhaseChanged(data);
    });

    // Spell cast → create projectile
    this.eventBus.on('spell-cast', (data) => {
      this.onSpellCast(data);
    });

    // Spell impact → apply damage
    this.eventBus.on('spell-impact', (data) => {
      this.onSpellImpact(data);
    });

    // Enemy defeated → clean up
    this.eventBus.on('enemy-defeated', (data) => {
      this.onEnemyDefeated(data);
    });

    // AI action → execute
    this.eventBus.on('ai:action', (data) => {
      this.onAIAction(data);
    });

    // Quest events
    this.eventBus.on('quest:start', (data) => {
      this.questSystem.startQuest(data.questId);
    });
    this.eventBus.on('quest:completeObjective', (data) => {
      this.questSystem.completeObjective(data.questId, data.objectiveId);
    });

    // Dialogue start from NPC interaction
    this.eventBus.on('dialogue:start', (data) => {
      this.dialogueSystem.startDialogue(data.dialogueId);
    });

    // Audio SFX events
    this.eventBus.on('audio:playSFX', (data) => {
      this.audioManager.playSFX(data.key, data.config || {});
    });

    // Game save/quit from MainMenuPanel
    this.eventBus.on('game:save', () => {
      this.saveManager.saveAll();
    });
    this.eventBus.on('game:quit', () => {
      this.scene.stop('UIScene');
      this.scene.start('TitleScene');
    });
    this.eventBus.on('game:paused', () => {
      this.physics.pause();
    });
    this.eventBus.on('game:resumed', () => {
      this.physics.resume();
    });
  }

  onPhaseChanged(data) {
    const phaseColors = {
      blue: '#4488ff',
      crimson: '#ff4444',
      silver: '#ccccff'
    };
    const color = phaseColors[data.phase] || '#ffffff';

    // Tint the background slightly
    const bgColors = {
      blue: '#1a1a2e',
      crimson: '#2e1a1a',
      silver: '#2a2a3e'
    };
    this.cameras.main.setBackgroundColor(bgColors[data.phase] || '#1a2a1a');

    if (this.phaseText) {
      this.phaseText.setColor(color);
    }
  }

  onSpellCast(data) {
    if (!data.spell || data.spell.type !== 'offensive') return;
    if (!data.targetPos) return;

    // Create projectile
    const proj = new Projectile(this, data.caster?.x || 640, data.caster?.y || 360, {
      spell: data.spell,
      caster: data.caster,
      targetPos: data.targetPos,
      speed: 350,
      color: this.getSpellColor(data.spell)
    });

    this.projectiles.push(proj);

    // Set up overlap with enemies
    for (const enemy of this.enemies) {
      if (enemy.stats.hp <= 0) continue;
      this.physics.add.overlap(proj.sprite, enemy.sprite, () => {
        proj.impact(enemy);
      });
    }
  }

  getSpellColor(spell) {
    const elementColors = {
      temporal: 0x4488ff,
      fire: 0xff6622,
      light: 0xccccff,
      nature: 0x44ff44,
      void: 0xaa22ff
    };
    return elementColors[spell.element] || 0x4a9eff;
  }

  onSpellImpact(data) {
    const target = data.target;
    if (!target || !target.stats) return;

    // Calculate damage using CombatSystem
    const damageResult = this.combatSystem.calculateDamage(
      data.caster || this.player,
      target,
      {
        spell: data.spell,
        sapPhaseVulnerability: target.sapPhaseVulnerability
      }
    );

    // Apply damage
    if (target.takeDamage) {
      target.takeDamage(damageResult.damage, data.caster);
    }

    // Increment combo
    if (!damageResult.isDodged) {
      this.combatSystem.incrementCombo();
    }
  }

  onEnemyDefeated(data) {
    const enemy = data.enemy;

    // Remove from enemies array
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);

    // Unregister from AI
    this.aiSystem.unregister(enemy.id);

    // Award XP
    if (data.experienceReward) {
      this.progressionSystem.awardExperience(data.experienceReward);
    }
  }

  onAIAction(data) {
    // Find the enemy entity
    const enemy = this.enemies.find(e => e.id === data.entityId);
    if (!enemy) return;

    switch (data.action) {
      case 'basic_attack': {
        // Check if player is the target and in range
        const dist = Phaser.Math.Distance.Between(
          enemy.sprite.x, enemy.sprite.y,
          this.player.sprite.x, this.player.sprite.y
        );
        if (dist < 60) {
          this.player.takeDamage(enemy.stats.atk);
        }
        break;
      }
      case 'use_ability':
        // Emit spell cast for the enemy
        this.eventBus.emit('spell-cast', {
          spell: this.spellSystem.getSpell(data.spellId),
          spellId: data.spellId,
          caster: enemy,
          targetPos: { x: this.player.x, y: this.player.y }
        });
        break;
    }
  }

  // ─── Update Loop ─────────────────────────────────────────────────

  update(time, delta) {
    // Update systems
    this.profiler.begin('sapCycle');
    this.sapCycle.update(delta);
    this.profiler.end('sapCycle');

    this.cooldownManager.update(delta);
    this.spellSystem.update(delta);
    this.audioManager.update(time, delta);
    this.audioManager.setListenerPosition(this.player.x, this.player.y);
    this.saveManager.update(delta);
    this.profiler.update(delta);

    // Update AI (pass player as the target list)
    const playerTarget = {
      id: 'player',
      name: 'Player',
      stats: this.player.stats,
      x: this.player.x,
      y: this.player.y,
      active: this.player.state !== 'dead'
    };
    this.aiSystem.update(delta, [playerTarget]);

    // Sync AI positions back to enemy sprites
    for (const enemy of this.enemies) {
      const aiState = this.aiSystem.entities.get(enemy.id);
      if (aiState) {
        // AI updates entity.x/y, sync back to sprite
        const aiEntity = aiState.entity;
        if (aiEntity.x !== enemy.sprite.x || aiEntity.y !== enemy.sprite.y) {
          enemy.sprite.x = aiEntity.x;
          enemy.sprite.y = aiEntity.y;
        }
        // Also sync sprite position back to AI entity
        aiEntity.x = enemy.sprite.x;
        aiEntity.y = enemy.sprite.y;
      }
    }

    // Update entities
    this.player.update(delta);
    for (const enemy of this.enemies) enemy.update(delta);
    for (const npc of this.npcs) npc.update(delta, this.player.x, this.player.y);

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(delta);
      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // ─── HUD Updates ───────────────────────────────────────────
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }

    // Emit stats to UIScene's HUDPanel via EventBus
    const s = this.player.stats;
    this.eventBus.emit('player:healthChanged', { current: s.hp, max: s.maxHp });
    this.eventBus.emit('player:sapChanged', { current: s.sap, max: s.maxSap });

    const prog = this.progressionSystem;
    this.eventBus.emit('player:experienceGained', {
      current: prog.experience,
      toNextLevel: prog.getXPForNextLevel()
    });
  }
}

export default GameScene;
