// src/scenes/CombatScene.js
// Core turn-based tactical combat scene
// Integrates: CombatGrid, EnemyAI, StatusEffects, DifficultyManager,
//             DSPManager, CombatUI, and Sap Cycle phase modifiers

import CombatGrid from '../systems/CombatGrid.js';
import EnemyAI from '../systems/EnemyAI.js';
import StatusEffectManager from '../systems/StatusEffects.js';
import DifficultyManager from '../systems/DifficultyManager.js';
import DSPManager from '../systems/DSPManager.js';
import CombatUI from '../ui/CombatUI.js';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });

    this.combatState = null; // 'INITIALIZING', 'ACTIVE', 'PLAYER_TURN', 'ENEMY_TURN', 'VICTORY', 'DEFEAT'
    this.turnQueue = [];
    this.currentTurnIndex = 0;
    this.movementMode = false;
    this.gridManager = null;
    this.uiManager = null;
    this.enemyAI = null;
    this.statusManager = null;
    this.difficultyManager = null;
    this.dspManager = null;

    // Combo system
    this.combo = {
      count: 0,
      multiplier: 1.0,
      maxMultiplier: 2.0,
      decayTimer: null,
    };
  }

  init(data) {
    this.playerData = data.player || {
      name: 'Verdant Warden',
      hp: 100,
      maxHp: 100,
      dsp: 50,
      maxDsp: 100,
      attack: 15,
      defense: 10,
      agility: 12,
    };

    this.enemyData = data.enemies || [
      {
        name: 'Thornbeast',
        sprite: 'thornbeast',
        hp: 40,
        attack: 12,
        defense: 8,
        agility: 8,
        moveRange: 3,
        attackRange: 1,
        aiType: 'aggressive',
      },
      {
        name: 'Rootguard',
        sprite: 'rootguard',
        hp: 60,
        attack: 10,
        defense: 15,
        agility: 5,
        moveRange: 2,
        attackRange: 1,
        aiType: 'defensive',
      },
      {
        name: 'Sporecaller',
        sprite: 'sporecaller',
        hp: 35,
        attack: 14,
        defense: 6,
        agility: 12,
        moveRange: 3,
        attackRange: 2,
        aiType: 'tactical',
      },
    ];

    this.battlefieldType = data.terrain || 'forest';
    this.escapable = data.canEscape || false;

    // Receive allies
    this.allyData = data.allies || [];

    // Sap Cycle phase data
    this.sapPhase = data.sapPhase || 'BLUE';
    this.phaseModifiers = data.phaseModifiers || {
      magicPower: 1.0,
      vulnerabilityMultiplier: 1.0,
    };

    console.log(`Combat starting during ${this.sapPhase} phase with ${this.allyData.length} allies`);
  }

  create() {
    // Initialize systems
    this.difficultyManager = new DifficultyManager();
    this.statusManager = new StatusEffectManager(this);
    this.enemyAI = new EnemyAI(this);
    this.dspManager = new DSPManager(this);
    this.dspManager.currentDSP = this.playerData.dsp || 50;
    this.dspManager.maxDSP = this.playerData.maxDsp || 100;

    // Apply phase modifier to DSP costs
    const dspPhaseMultipliers = {
      CRIMSON: 1.4,
      SILVER: 0.7,
      BLUE: 1.0,
    };
    this.dspManager.setPhaseModifier(dspPhaseMultipliers[this.sapPhase] || 1.0);

    // Reset combo
    this.combo = {
      count: 0,
      multiplier: 1.0,
      maxMultiplier: 2.0,
      decayTimer: null,
    };

    // Create battlefield
    this.createBattlefield();
    this.initializeGrid();
    this.spawnCombatants();
    this.calculateInitiative();
    this.createCombatUI();

    // Create ally AI
    this.allyAI = {
      executeTurn: (ally) => {
        const nearestEnemy = this.findNearestEnemy(ally);

        if (!nearestEnemy) {
          this.endTurn();
          return;
        }

        const distance = this.gridManager.getHexDistance(ally.tile, nearestEnemy.tile);

        if (distance <= ally.stats.attackRange) {
          this.time.delayedCall(500, () => {
            this.executeBasicAttack(ally, nearestEnemy);
            this.time.delayedCall(1500, () => {
              this.endTurn();
            });
          });
        } else {
          const path = this.gridManager.findPath(ally.tile, nearestEnemy.tile);

          if (path && path.length > 0) {
            const moveDistance = Math.min(ally.stats.moveRange, path.length);
            const movePath = path.slice(0, moveDistance);

            this.moveEntityAlongPath(ally, movePath, () => {
              const newDistance = this.gridManager.getHexDistance(ally.tile, nearestEnemy.tile);

              if (newDistance <= ally.stats.attackRange) {
                this.time.delayedCall(300, () => {
                  this.executeBasicAttack(ally, nearestEnemy);
                  this.time.delayedCall(1500, () => {
                    this.endTurn();
                  });
                });
              } else {
                this.time.delayedCall(800, () => {
                  this.endTurn();
                });
              }
            });
          } else {
            this.time.delayedCall(800, () => {
              this.endTurn();
            });
          }
        }
      },
    };

    // Log stats
    this.logCombatStats();

    // Start combat
    this.combatState = 'INITIALIZING';
    this.cameras.main.fadeIn(500);
    this.time.delayedCall(1000, () => {
      this.startCombat();
    });
  }

  // --- Battlefield Setup ---

  createBattlefield() {
    // Background based on terrain
    this.add.rectangle(400, 300, 800, 600, 0x1a2a1a);

    // Ambient atmosphere
    const atmosphereTints = {
      CRIMSON: 0x331111,
      SILVER: 0x222222,
      BLUE: 0x111122,
    };
    const tint = atmosphereTints[this.sapPhase] || 0x1a2a1a;
    this.add.rectangle(400, 300, 800, 600, tint, 0.3);
  }

  initializeGrid() {
    this.gridManager = new CombatGrid(this, {
      rows: 6,
      cols: 8,
      hexSize: 36,
      offsetX: 130,
      offsetY: 80,
    });

    // Add some obstacles
    this.gridManager.addObstacle(2, 4, 'blocking');
    this.gridManager.addObstacle(3, 3, 'difficult');
    this.gridManager.addObstacle(4, 5, 'blocking');
  }

  // --- Combatant Spawning ---

  spawnCombatants() {
    // Spawn player on left side
    const playerTile = this.gridManager.getTileAt(2, 1);
    this.player = this.createPlayer(playerTile);

    // Spawn allies
    this.allies = [];
    const allyPositions = [
      { row: 1, col: 2 },
      { row: 3, col: 2 },
      { row: 2, col: 2 },
      { row: 1, col: 3 },
      { row: 3, col: 3 },
    ];

    this.allyData.forEach((allyData, index) => {
      if (index >= allyPositions.length) return; // Max 5 allies in combat

      const pos = allyPositions[index];
      const tile = this.gridManager.getTileAt(pos.row, pos.col);
      if (tile) {
        const ally = this.createAlly(tile, allyData);
        this.allies.push(ally);
      }
    });

    // Spawn enemies on right side
    this.enemies = [];
    const enemyPositions = [
      { row: 1, col: 6 },
      { row: 3, col: 7 },
      { row: 4, col: 6 },
    ];

    this.enemyData.forEach((enemyType, index) => {
      if (index < enemyPositions.length) {
        const pos = enemyPositions[index];
        const tile = this.gridManager.getTileAt(pos.row, pos.col);
        if (tile) {
          const enemy = this.createEnemy(tile, enemyType);
          this.enemies.push(enemy);
        }
      }
    });
  }

  createPlayer(tile) {
    const player = this.add.rectangle(tile.x, tile.y, 28, 28, 0x88ff88);
    player.setStrokeStyle(3, 0x44aa44);

    // Player label
    const label = this.add.text(tile.x, tile.y - 35, 'P', {
      fontSize: '14px',
      color: '#88FF88',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    player.label = label;

    // Combat stats
    let stats = {
      name: this.playerData.name || 'Verdant Warden',
      hp: this.playerData.hp || 100,
      maxHp: this.playerData.maxHp || 100,
      dsp: this.playerData.dsp || 50,
      maxDsp: this.playerData.maxDsp || 100,
      attack: this.playerData.attack || 15,
      defense: this.playerData.defense || 10,
      agility: this.playerData.agility || 12,
      moveRange: 3,
      attackRange: 1,
      defendBonus: 0,
      actionsRemaining: { move: true, action: true, bonusAction: true },
      abilities: this.getPlayerAbilities(),
    };

    // Apply difficulty
    stats = this.difficultyManager.applyToPlayer(stats);
    player.stats = stats;

    player.tile = tile;
    tile.occupant = player;
    player.isPlayer = true;

    player.healthBar = this.createHealthBar(player);

    return player;
  }

  createAlly(tile, allyData) {
    const ally = this.add.rectangle(tile.x, tile.y, 28, 28, 0x88ff88);
    ally.setStrokeStyle(3, 0x44cc44);
    ally.setAlpha(0.85); // Slightly translucent to differentiate from player

    ally.stats = {
      id: allyData.id,
      name: allyData.name,
      hp: allyData.hp,
      maxHp: allyData.maxHp,
      attack: allyData.attack,
      defense: allyData.defense,
      agility: allyData.agility,
      moveRange: 3,
      attackRange: allyData.type === 'archer' ? 3 : 1,
      aiType: 'friendly',
      defendBonus: 0,
    };

    ally.tile = tile;
    tile.occupant = ally;
    ally.isAlly = true;

    ally.healthBar = this.createHealthBar(ally);

    // Name label
    ally.nameLabel = this.add.text(ally.x, ally.y - 55, allyData.name, {
      fontSize: '10px',
      color: '#88FF88',
      backgroundColor: '#00000088',
      padding: { x: 3, y: 2 },
    });
    ally.nameLabel.setOrigin(0.5);

    // Label showing first char
    const label = this.add.text(tile.x, tile.y - 35, allyData.name.charAt(0), {
      fontSize: '14px',
      color: '#88FF88',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    ally.label = label;

    return ally;
  }

  getPlayerAbilities() {
    return [
      {
        name: 'Thornburst',
        type: 'aoe',
        range: 3,
        aoeRadius: 2,
        damage: 12,
        dspCost: 15,
        description: 'Explodes thorns in an area',
        phaseRestriction: null,
      },
      {
        name: 'Venomspore',
        type: 'targeted',
        range: 4,
        damage: 8,
        status: { type: 'poison', duration: 3, potency: 1 },
        dspCost: 10,
        description: 'Poisons target for 3 turns',
        phaseRestriction: null,
      },
      {
        name: 'Seedling Shield',
        type: 'buff',
        range: 0,
        duration: 3,
        defenseBonus: 10,
        dspCost: 12,
        description: 'Plant protective seeds (+10 DEF for 3 turns)',
        phaseRestriction: 'CRIMSON',
      },
      {
        name: 'Unbinding Surge',
        type: 'aoe',
        range: 4,
        aoeRadius: 3,
        damage: 25,
        dspCost: 25,
        description: "Channel the Great Unbinding's power",
        phaseRestriction: 'SILVER',
      },
      {
        name: 'Reflective Calm',
        type: 'heal',
        range: 0,
        healAmount: 30,
        dspCost: 18,
        description: "Channel blue sap's stability to restore HP",
        phaseRestriction: 'BLUE',
      },
    ];
  }

  createEnemy(tile, enemyType) {
    const enemy = this.add.rectangle(tile.x, tile.y, 28, 28, 0xff6666);
    enemy.setStrokeStyle(3, 0xcc3333);

    // Enemy label
    const label = this.add.text(
      tile.x,
      tile.y - 35,
      enemyType.name.charAt(0),
      {
        fontSize: '14px',
        color: '#FF6666',
        fontStyle: 'bold',
      }
    );
    label.setOrigin(0.5);
    enemy.label = label;

    let stats = {
      name: enemyType.name,
      hp: enemyType.hp,
      maxHp: enemyType.hp,
      attack: enemyType.attack,
      defense: enemyType.defense,
      agility: enemyType.agility,
      moveRange: enemyType.moveRange || 2,
      attackRange: enemyType.attackRange || 1,
      aiType: enemyType.aiType || 'aggressive',
      defendBonus: 0,
    };

    // Apply difficulty
    stats = this.difficultyManager.applyToEnemy(stats);
    enemy.stats = stats;

    enemy.tile = tile;
    tile.occupant = enemy;
    enemy.isEnemy = true;

    enemy.healthBar = this.createHealthBar(enemy);

    return enemy;
  }

  createHealthBar(entity) {
    const barWidth = 50;
    const barHeight = 5;

    const barBg = this.add.rectangle(
      entity.x,
      entity.y - 28,
      barWidth,
      barHeight,
      0x333333
    );

    const color = entity.isPlayer || entity.isAlly ? 0x88ff88 : 0xff6666;
    const barFill = this.add.rectangle(
      entity.x - barWidth / 2,
      entity.y - 28,
      barWidth,
      barHeight,
      color
    );
    barFill.setOrigin(0, 0.5);

    return {
      background: barBg,
      fill: barFill,
      maxWidth: barWidth,
      update: (currentHp, maxHp) => {
        const percentage = currentHp / maxHp;
        barFill.width = barWidth * percentage;
        if (percentage < 0.3) {
          barFill.setFillStyle(0xff3333);
        } else if (percentage < 0.6) {
          barFill.setFillStyle(0xffaa33);
        } else {
          barFill.setFillStyle(color);
        }
      },
    };
  }

  // --- Initiative & Turn Management ---

  calculateInitiative() {
    // Combine all combatants
    const all = [this.player, ...this.allies, ...this.enemies];

    this.turnQueue = all.sort((a, b) => {
      const aInit = a.stats.agility + Phaser.Math.Between(1, 10);
      const bInit = b.stats.agility + Phaser.Math.Between(1, 10);
      return bInit - aInit;
    });

    console.log(
      'Turn order:',
      this.turnQueue.map(
        (e) =>
          `${e.stats.name} (${e.isPlayer ? 'Player' : e.isAlly ? 'Ally' : 'Enemy'})`
      )
    );
    this.currentTurnIndex = 0;
  }

  startCombat() {
    this.combatState = 'ACTIVE';
    this.showMessage('Combat begins!', 0xffff88);
    this.time.delayedCall(1000, () => {
      this.startTurn();
    });
  }

  startTurn() {
    // Skip dead entities
    while (
      this.currentTurnIndex < this.turnQueue.length &&
      this.turnQueue[this.currentTurnIndex].stats.hp <= 0
    ) {
      this.currentTurnIndex++;
      if (this.currentTurnIndex >= this.turnQueue.length) {
        this.currentTurnIndex = 0;
      }
    }

    const currentEntity = this.turnQueue[this.currentTurnIndex];
    if (!currentEntity || currentEntity.stats.hp <= 0) return;

    console.log(`${currentEntity.stats.name}'s turn`);

    // Clear defend bonus from previous round
    currentEntity.stats.defendBonus = 0;

    // Process status effects
    const canAct = this.statusManager.processStatusEffects(currentEntity);

    // Highlight current entity
    this.highlightCurrentEntity(currentEntity);

    // Update turn order display
    this.uiManager.updateTurnOrderDisplay();

    if (!canAct) {
      this.time.delayedCall(1500, () => {
        this.endTurn();
      });
      return;
    }

    if (currentEntity.isPlayer) {
      this.playerTurn();
    } else if (currentEntity.isAlly) {
      this.allyTurn(currentEntity);
    } else {
      this.enemyTurn(currentEntity);
    }
  }

  highlightCurrentEntity(entity) {
    if (entity.glowEffect) {
      entity.glowEffect.destroy();
    }
    const glow = this.add.circle(entity.x, entity.y, 24, 0xffff00, 0.2);
    glow.setStrokeStyle(2, 0xffff00, 0.6);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.4, to: 0.1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    entity.glowEffect = glow;
  }

  playerTurn() {
    this.combatState = 'PLAYER_TURN';
    this.showMessage('Your turn!', 0x88ff88);

    this.player.stats.actionsRemaining = {
      move: true,
      action: true,
      bonusAction: true,
    };

    this.uiManager.showActionMenu();
  }

  enemyTurn(enemy) {
    this.combatState = 'ENEMY_TURN';
    this.showMessage(`${enemy.stats.name}'s turn`, 0xff6666);

    this.time.delayedCall(800, () => {
      this.enemyAI.executeTurn(enemy);
    });
  }

  allyTurn(ally) {
    this.combatState = 'ALLY_TURN';
    this.showMessage(`${ally.stats.name}'s turn`, 0x88ff88);

    this.time.delayedCall(800, () => {
      this.allyAI.executeTurn(ally);
    });
  }

  findNearestEnemy(fromEntity) {
    let nearest = null;
    let minDistance = Infinity;

    this.enemies.forEach((enemy) => {
      if (enemy.stats.hp <= 0) return;

      const distance = this.gridManager.getHexDistance(
        fromEntity.tile,
        enemy.tile
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
  }

  moveEntityAlongPath(entity, path, onComplete) {
    let currentIndex = 0;

    const moveToNext = () => {
      if (currentIndex >= path.length) {
        if (onComplete) onComplete();
        return;
      }

      const nextTile = path[currentIndex];

      entity.tile.occupant = null;
      nextTile.occupant = entity;
      entity.tile = nextTile;

      this.tweens.add({
        targets: entity,
        x: nextTile.x,
        y: nextTile.y,
        duration: 250,
        ease: 'Linear',
        onComplete: () => {
          this.updateHealthBarPosition(entity);

          if (entity.nameLabel) {
            entity.nameLabel.setPosition(entity.x, entity.y - 55);
          }

          currentIndex++;
          moveToNext();
        },
      });
    };

    moveToNext();
  }

  endTurn() {
    const currentEntity = this.turnQueue[this.currentTurnIndex];

    if (currentEntity && currentEntity.glowEffect) {
      currentEntity.glowEffect.destroy();
      currentEntity.glowEffect = null;
    }

    this.gridManager.clearHighlights();
    this.movementMode = false;
    this.events.off('tile-clicked');

    // Process buffs
    this.processBuffs(currentEntity);

    // Advance turn
    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.turnQueue.length) {
      this.currentTurnIndex = 0;
    }

    if (this.checkCombatEnd()) return;

    this.time.delayedCall(500, () => {
      this.startTurn();
    });
  }

  // --- Movement ---

  onMovementTileClicked(tile) {
    if (!this.movementMode) return;
    if (!tile.highlight || tile.highlight !== 'movement') {
      this.showMessage('Cannot move there!', 0xff6666);
      return;
    }

    const path = this.gridManager.findPath(this.player.tile, tile);
    if (path && path.length > 0) {
      this.movePlayerAlongPath(path);
    }
  }

  movePlayerAlongPath(path) {
    this.movementMode = false;
    this.gridManager.clearHighlights();
    this.events.off('tile-clicked', this.onMovementTileClicked, this);

    let currentIndex = 0;
    const moveToNext = () => {
      if (currentIndex >= path.length) {
        this.onMovementComplete();
        return;
      }

      const nextTile = path[currentIndex];
      this.player.tile.occupant = null;
      nextTile.occupant = this.player;
      this.player.tile = nextTile;

      this.tweens.add({
        targets: [this.player, this.player.label],
        x: nextTile.x,
        y: (target) =>
          target === this.player ? nextTile.y : nextTile.y - 35,
        duration: 200,
        ease: 'Linear',
        onComplete: () => {
          this.updateHealthBarPosition(this.player);
          currentIndex++;
          moveToNext();
        },
      });
    };

    moveToNext();
  }

  onMovementComplete() {
    this.player.stats.actionsRemaining.move = false;
    this.showMessage('Movement complete', 0x88ff88);
    this.uiManager.showActionMenu();
  }

  updateHealthBarPosition(entity) {
    if (entity.healthBar) {
      entity.healthBar.background.setPosition(entity.x, entity.y - 28);
      entity.healthBar.fill.setPosition(
        entity.x - entity.healthBar.maxWidth / 2,
        entity.y - 28
      );
    }
    if (entity.label) {
      entity.label.setPosition(entity.x, entity.y - 35);
    }
  }

  // --- Attack System ---

  executeBasicAttack(attacker, defender) {
    console.log(`${attacker.stats.name} attacks ${defender.stats.name}!`);

    this.animateAttack(attacker, defender, () => {
      const damage = this.calculateDamage(attacker, defender, false);

      // Enhanced impact
      this.enhanceAttackImpact(attacker, defender, damage);

      defender.stats.hp -= damage;
      if (defender.stats.hp < 0) defender.stats.hp = 0;

      defender.healthBar.update(defender.stats.hp, defender.stats.maxHp);
      this.showDamageNumber(defender.x, defender.y - 50, damage);

      if (defender.stats.hp <= 0) {
        this.onEntityDefeated(defender);
      }

      this.time.delayedCall(1000, () => {
        if (this.combatState === 'PLAYER_TURN') {
          this.uiManager.showActionMenu();
        }
      });
    });
  }

  calculateDamage(attacker, defender, isMagical = false) {
    const baseAttack = attacker.stats.attack;
    const defense =
      defender.stats.defense + (defender.stats.defendBonus || 0);

    const variance = Phaser.Math.FloatBetween(0.85, 1.15);
    let damage = Math.floor((baseAttack - defense * 0.5) * variance);
    if (damage < 1) damage = 1;

    // Phase modifiers
    if (isMagical) {
      damage = Math.floor(damage * this.phaseModifiers.magicPower);
    }
    if (defender.isPlayer) {
      damage = Math.floor(
        damage * this.phaseModifiers.vulnerabilityMultiplier
      );
    }

    // Combo multiplier (player only)
    if (attacker.isPlayer) {
      damage = Math.floor(damage * this.combo.multiplier);
      this.incrementCombo();
    } else {
      this.resetCombo();
    }

    // Critical hit (10% chance)
    if (Math.random() < 0.1) {
      damage = Math.floor(damage * 1.5);
      this.showMessage('Critical Hit!', 0xffdd33);
    }

    return damage;
  }

  animateAttack(attacker, defender, onComplete) {
    const originalX = attacker.x;
    const originalY = attacker.y;
    const angle = Math.atan2(
      defender.y - originalY,
      defender.x - originalX
    );
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;

    // Lunge toward target
    this.tweens.add({
      targets: attacker,
      x: originalX + offsetX,
      y: originalY + offsetY,
      duration: 120,
      ease: 'Power2',
      yoyo: true,
      onYoyo: () => {
        // Flash defender on hit
        const origColor = defender.isPlayer || defender.isAlly ? 0x88ff88 : 0xff6666;
        defender.setFillStyle(0xff0000);
        this.time.delayedCall(100, () => {
          defender.setFillStyle(origColor);
        });
      },
      onComplete: () => {
        onComplete();
      },
    });
  }

  enhanceAttackImpact(attacker, defender, damage) {
    const intensity = Math.min(damage / 20, 1.0);
    this.cameras.main.shake(150, 0.003 + intensity * 0.007);
  }

  // --- AoE Attacks ---

  executeAoEAttack(attacker, centerTile, radius, baseDamage, isMagical = true) {
    console.log(`${attacker.stats.name} uses AoE attack!`);

    const affectedTiles = this.gridManager.getTilesInRadius(centerTile, radius);
    const targets = [];

    affectedTiles.forEach((tile) => {
      if (tile.occupant && tile.occupant !== attacker && tile.occupant.stats.hp > 0) {
        targets.push(tile.occupant);
      }
    });

    if (targets.length === 0) {
      this.showMessage('No targets hit!', 0xffaa88);
      return;
    }

    // AoE visual
    this.createAoEEffect(centerTile, radius);

    this.time.delayedCall(400, () => {
      targets.forEach((target, index) => {
        this.time.delayedCall(index * 150, () => {
          let damage = baseDamage;
          if (isMagical) {
            damage = Math.floor(damage * this.phaseModifiers.magicPower);
          }

          target.stats.hp -= damage;
          if (target.stats.hp < 0) target.stats.hp = 0;
          target.healthBar.update(target.stats.hp, target.stats.maxHp);
          this.showDamageNumber(target.x, target.y - 50, damage);

          // Flash
          const origColor = target.isPlayer || target.isAlly ? 0x88ff88 : 0xff6666;
          target.setFillStyle(0xff6600);
          this.time.delayedCall(100, () => {
            target.setFillStyle(origColor);
          });

          if (target.stats.hp <= 0) {
            this.onEntityDefeated(target);
          }
        });
      });
    });

    this.showMessage(`${targets.length} targets hit!`, 0xffdd33);
  }

  createAoEEffect(centerTile, radius) {
    const circle = this.add.circle(
      centerTile.x,
      centerTile.y,
      0,
      0xff6600,
      0.5
    );

    this.tweens.add({
      targets: circle,
      radius: radius * 50,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    });

    this.cameras.main.shake(200, 0.008);
  }

  // --- Self-Buff ---

  executeSelfBuff(ability) {
    console.log(`${this.player.stats.name} casts ${ability.name}!`);

    if (this.dspManager) {
      const success = this.dspManager.spend(ability.dspCost);
      if (!success) {
        this.showMessage('Not enough DSP!', 0xff6666);
        return;
      }
    }

    this.player.stats.defense += ability.defenseBonus;

    if (!this.player.activeBuffs) {
      this.player.activeBuffs = [];
    }

    this.player.activeBuffs.push({
      name: ability.name,
      stat: 'defense',
      bonus: ability.defenseBonus,
      duration: ability.duration,
      remainingTurns: ability.duration,
    });

    this.showMessage(`${ability.name}! DEF +${ability.defenseBonus}`, 0x88ff88);
    this.player.stats.actionsRemaining.action = false;

    this.time.delayedCall(1500, () => {
      this.uiManager.showActionMenu();
    });
  }

  // --- Heal ---

  executeHeal(ability) {
    console.log(`${this.player.stats.name} casts ${ability.name}!`);

    if (this.dspManager) {
      const success = this.dspManager.spend(ability.dspCost);
      if (!success) {
        this.showMessage('Not enough DSP!', 0xff6666);
        return;
      }
    }

    const oldHp = this.player.stats.hp;
    this.player.stats.hp = Math.min(
      this.player.stats.hp + ability.healAmount,
      this.player.stats.maxHp
    );
    const actualHeal = this.player.stats.hp - oldHp;

    this.player.healthBar.update(
      this.player.stats.hp,
      this.player.stats.maxHp
    );
    this.showHealNumber(this.player.x, this.player.y - 50, actualHeal);
    this.showMessage(`Restored ${actualHeal} HP!`, 0x88ff88);

    this.player.stats.actionsRemaining.action = false;
    this.time.delayedCall(1500, () => {
      this.uiManager.showActionMenu();
    });
  }

  // --- Buff Processing ---

  processBuffs(entity) {
    if (!entity || !entity.activeBuffs || entity.activeBuffs.length === 0) return;

    for (let i = entity.activeBuffs.length - 1; i >= 0; i--) {
      const buff = entity.activeBuffs[i];
      buff.remainingTurns--;

      if (buff.remainingTurns <= 0) {
        entity.stats[buff.stat] -= buff.bonus;
        this.showMessage(`${buff.name} expired`, 0xaaaaaa);
        entity.activeBuffs.splice(i, 1);
      }
    }
  }

  // --- Combo System ---

  incrementCombo() {
    this.combo.count++;
    this.combo.multiplier = Math.min(
      1.0 + this.combo.count * 0.1,
      this.combo.maxMultiplier
    );
    this.updateComboDisplay();

    if (this.combo.decayTimer) {
      this.combo.decayTimer.remove();
    }
    this.combo.decayTimer = this.time.delayedCall(5000, () => {
      this.resetCombo();
    });
  }

  resetCombo() {
    if (this.combo.count > 0) {
      this.showMessage('Combo broken!', 0xff6666);
    }
    this.combo.count = 0;
    this.combo.multiplier = 1.0;
    this.updateComboDisplay();
  }

  updateComboDisplay() {
    if (this.comboText) {
      this.comboText.destroy();
      this.comboText = null;
    }

    if (this.combo.count > 0) {
      this.comboText = this.add.text(
        400,
        30,
        `${this.combo.count}x COMBO! (${this.combo.multiplier.toFixed(1)}x DMG)`,
        {
          fontSize: '22px',
          color: '#FFDD33',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }
      );
      this.comboText.setOrigin(0.5);
      this.comboText.setDepth(60);

      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.2, to: 1.0 },
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
  }

  // --- Entity Defeat ---

  onEntityDefeated(entity) {
    console.log(`${entity.stats.name} defeated!`);

    this.tweens.add({
      targets: entity,
      alpha: 0,
      scale: 0.5,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        entity.destroy();
        if (entity.healthBar) {
          entity.healthBar.background.destroy();
          entity.healthBar.fill.destroy();
        }
        if (entity.glowEffect) {
          entity.glowEffect.destroy();
        }
        if (entity.label) {
          entity.label.destroy();
        }
        entity.tile.occupant = null;
      },
    });

    // Remove from turn queue
    const index = this.turnQueue.indexOf(entity);
    if (index > -1) {
      this.turnQueue.splice(index, 1);
      if (
        this.currentTurnIndex >= index &&
        this.currentTurnIndex > 0
      ) {
        this.currentTurnIndex--;
      }
    }

    this.uiManager.updateTurnOrderDisplay();
  }

  // --- Combat End ---

  checkCombatEnd() {
    const playerAlive = this.player.stats.hp > 0;
    const alliesAlive = this.allies.some((a) => a.stats.hp > 0);
    const enemiesAlive = this.enemies.some((e) => e.stats.hp > 0);

    const teamAlive = playerAlive || alliesAlive;

    if (!teamAlive) {
      this.combatState = 'DEFEAT';
      this.showMessage('Defeated...', 0xff3333);
      this.time.delayedCall(2000, () => {
        this.showDefeatScreen();
      });
      return true;
    }

    if (!enemiesAlive) {
      this.combatState = 'VICTORY';
      this.showMessage('Victory!', 0xffdd33);
      this.time.delayedCall(1000, () => {
        this.showVictoryScreen();
      });
      return true;
    }

    return false;
  }

  showVictoryScreen() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setDepth(200);

    const banner = this.add.text(400, 150, 'VICTORY', {
      fontSize: '64px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    banner.setOrigin(0.5);
    banner.setDepth(201);
    banner.setScale(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    const rewards = this.calculateRewards();

    this.time.delayedCall(800, () => {
      const rewardsText = this.add.text(
        400,
        260,
        `Rewards:\n\nEXP: +${rewards.exp}\nGold: +${rewards.gold}\nDSP Restored: +${rewards.dsp}`,
        {
          fontSize: '22px',
          color: '#FFFFFF',
          align: 'center',
          lineSpacing: 8,
        }
      );
      rewardsText.setOrigin(0.5);
      rewardsText.setDepth(201);
    });

    this.time.delayedCall(2000, () => {
      const continueBtn = this.add.rectangle(
        400, 430, 200, 55, 0x4a7c59, 0.9
      );
      continueBtn.setStrokeStyle(3, 0x88cc88);
      continueBtn.setDepth(201);

      const btnText = this.add.text(400, 430, 'Continue', {
        fontSize: '26px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      });
      btnText.setOrigin(0.5);
      btnText.setDepth(202);

      continueBtn.setInteractive({ useHandCursor: true });
      continueBtn.on('pointerover', () => {
        continueBtn.setFillStyle(0x5a8c69);
      });
      continueBtn.on('pointerout', () => {
        continueBtn.setFillStyle(0x4a7c59);
      });
      continueBtn.on('pointerdown', () => {
        this.applyRewards(rewards);
        this.returnToExploration();
      });
    });
  }

  showDefeatScreen() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8);
    overlay.setDepth(200);

    const defeatText = this.add.text(400, 200, 'DEFEAT', {
      fontSize: '72px',
      color: '#FF3333',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    defeatText.setOrigin(0.5);
    defeatText.setDepth(201);

    const message = this.add.text(400, 300, 'The forest consumes you...', {
      fontSize: '22px',
      color: '#AAAAAA',
      fontStyle: 'italic',
    });
    message.setOrigin(0.5);
    message.setDepth(201);

    this.time.delayedCall(2000, () => {
      const retryBtn = this.add.rectangle(
        400, 420, 180, 55, 0x666666, 0.9
      );
      retryBtn.setStrokeStyle(3, 0x999999);
      retryBtn.setDepth(201);

      const retryText = this.add.text(400, 420, 'Retry', {
        fontSize: '24px',
        color: '#FFFFFF',
      });
      retryText.setOrigin(0.5);
      retryText.setDepth(202);

      retryBtn.setInteractive({ useHandCursor: true });
      retryBtn.on('pointerdown', () => {
        this.scene.restart();
      });
    });
  }

  calculateRewards() {
    let exp = 100;
    let gold = 50;
    let dsp = 30;

    if (this.combo.count >= 5) {
      exp += 50;
      gold += 25;
    }

    const hpPercentage = this.player.stats.hp / this.player.stats.maxHp;
    if (hpPercentage > 0.7) {
      exp += 30;
      dsp += 10;
    }

    return { exp, gold, dsp };
  }

  applyRewards(rewards) {
    this.playerData.exp = (this.playerData.exp || 0) + rewards.exp;
    this.playerData.gold = (this.playerData.gold || 0) + rewards.gold;
    this.playerData.dsp = Math.min(
      (this.playerData.dsp || 50) + rewards.dsp,
      this.playerData.maxDsp || 100
    );
    this.playerData.hp = Math.min(
      this.player.stats.hp + 20,
      this.playerData.maxHp || 100
    );
    console.log('Rewards applied:', rewards);
  }

  returnToExploration() {
    this.cameras.main.fadeOut(500);

    // Save ally HP back to manager
    const allyHpData = this.allies.map((ally) => ({
      id: ally.stats.id,
      currentHp: ally.stats.hp,
      isAlive: ally.stats.hp > 0,
    }));

    this.time.delayedCall(500, () => {
      this.scene.start('ExplorationScene', {
        playerData: this.playerData,
        allyHpData: allyHpData,
      });
    });
  }

  // --- UI Creation ---

  createCombatUI() {
    this.uiManager = new CombatUI(this);
    this.uiManager.createTurnOrderDisplay();
    this.uiManager.createDSPDisplay();
    this.uiManager.createPhaseIndicator(this.sapPhase, this.phaseModifiers);
  }

  // --- Utility ---

  showMessage(text, color) {
    const colorObj = Phaser.Display.Color.IntegerToColor(color);
    const message = this.add.text(400, 60, text, {
      fontSize: '22px',
      color: colorObj.rgba,
      stroke: '#000000',
      strokeThickness: 4,
    });
    message.setOrigin(0.5);
    message.setDepth(100);

    this.tweens.add({
      targets: message,
      alpha: 0,
      duration: 500,
      delay: 1500,
      onComplete: () => message.destroy(),
    });
  }

  showDamageNumber(x, y, damage) {
    const damageText = this.add.text(x, y, `-${damage}`, {
      fontSize: '28px',
      color: '#FF3333',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    damageText.setOrigin(0.5);
    damageText.setDepth(100);

    this.tweens.add({
      targets: damageText,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => damageText.destroy(),
    });
  }

  showHealNumber(x, y, amount) {
    const healText = this.add.text(x, y, `+${amount}`, {
      fontSize: '28px',
      color: '#88FF88',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    healText.setOrigin(0.5);
    healText.setDepth(100);

    this.tweens.add({
      targets: healText,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => healText.destroy(),
    });
  }

  logCombatStats() {
    console.log('=== COMBAT STATS ===');
    console.log(`Phase: ${this.sapPhase}`);
    console.log('PLAYER:', {
      HP: `${this.player.stats.hp}/${this.player.stats.maxHp}`,
      ATK: this.player.stats.attack,
      DEF: this.player.stats.defense,
      AGI: this.player.stats.agility,
    });
    this.allies.forEach((ally) => {
      console.log(`ALLY ${ally.stats.name}:`, {
        HP: `${ally.stats.hp}/${ally.stats.maxHp}`,
        ATK: ally.stats.attack,
        DEF: ally.stats.defense,
        AGI: ally.stats.agility,
      });
    });
    this.enemies.forEach((enemy) => {
      console.log(`${enemy.stats.name}:`, {
        HP: `${enemy.stats.hp}/${enemy.stats.maxHp}`,
        ATK: enemy.stats.attack,
        DEF: enemy.stats.defense,
        AGI: enemy.stats.agility,
        AI: enemy.stats.aiType,
      });
    });
    console.log('===================');
  }

  getDirectionFromAngle(angle) {
    const deg = angle * (180 / Math.PI);
    if (deg >= -45 && deg < 45) return 'right';
    if (deg >= 45 && deg < 135) return 'down';
    if (deg >= 135 || deg < -135) return 'left';
    return 'up';
  }
}
