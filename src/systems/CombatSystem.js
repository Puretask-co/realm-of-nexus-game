import { EventBus } from '../core/EventBus.js';
import SapCycleManager from './SapCycleManager.js';

/**
 * CombatSystem - Turn-based tactical combat for Verdance.
 * Handles damage calculation, phase modifiers, initiative, turn order,
 * and combat state management.
 */
export class CombatSystem {
  static instance = null;

  static getInstance() {
    if (!CombatSystem.instance) new CombatSystem();
    return CombatSystem.instance;
  }

  constructor() {
    if (CombatSystem.instance) return CombatSystem.instance;

    this.eventBus = EventBus.getInstance();

    // Combat config (from config.json)
    this.turnTimeLimit = 30;
    this.maxPartySize = 4;
    this.critBaseChance = 0.05;
    this.critBaseDamage = 1.5;
    this.dodgeBaseChance = 0.03;
    this.blockBaseChance = 0.1;
    this.blockDamageReduction = 0.5;

    // Combat state
    this.inCombat = false;
    this.turnOrder = [];
    this.currentTurnIndex = -1;
    this.currentActor = null;
    this.turnTimer = 0;
    this.roundNumber = 0;
    this.combatLog = [];

    // Combatants
    this.allies = [];
    this.enemies = [];

    // Combo system
    this.comboCounter = 0;
    this.comboMultiplier = 1.0;
    this.comboDecayTimer = 0;
    this.comboDecayTime = 5; // seconds until combo resets

    // Difficulty multipliers
    this.difficultyMultipliers = {
      enemyHealthMultiplier: 1.0,
      enemyDamageMultiplier: 1.0
    };

    // Listen for config hot-reload
    this.eventBus.on('data-reloaded', (data) => {
      if (data?.key === 'config') this.applyConfig(data.data);
    });

    CombatSystem.instance = this;
  }

  applyConfig(config) {
    if (!config?.combat) return;
    const c = config.combat;
    if (c.turnTimeLimit !== undefined) this.turnTimeLimit = c.turnTimeLimit;
    if (c.maxPartySize !== undefined) this.maxPartySize = c.maxPartySize;
    if (c.critBaseChance !== undefined) this.critBaseChance = c.critBaseChance;
    if (c.critBaseDamage !== undefined) this.critBaseDamage = c.critBaseDamage;
    if (c.dodgeBaseChance !== undefined) this.dodgeBaseChance = c.dodgeBaseChance;
    if (c.blockBaseChance !== undefined) this.blockBaseChance = c.blockBaseChance;
    if (c.blockDamageReduction !== undefined) this.blockDamageReduction = c.blockDamageReduction;
  }

  setDifficulty(difficultyConfig) {
    if (!difficultyConfig) return;
    this.difficultyMultipliers = { ...difficultyConfig };
  }

  // ─── Combat Flow ──────────────────────────────────────────────────

  /**
   * Start a combat encounter.
   * @param {Array} allies - Array of ally entities { id, name, stats: { hp, maxHp, atk, def, agi, ... }, ... }
   * @param {Array} enemies - Array of enemy entities { id, name, stats, ai, sapPhaseVulnerability, ... }
   */
  startCombat(allies, enemies) {
    this.inCombat = true;
    this.allies = allies;
    this.enemies = enemies.map(e => ({
      ...e,
      stats: {
        ...e.stats,
        hp: Math.round(e.stats.hp * this.difficultyMultipliers.enemyHealthMultiplier),
        maxHp: Math.round(e.stats.maxHp * this.difficultyMultipliers.enemyHealthMultiplier)
      }
    }));
    this.roundNumber = 0;
    this.combatLog = [];
    this.comboCounter = 0;
    this.comboMultiplier = 1.0;

    this.calculateInitiative();
    this.startRound();

    this.eventBus.emit('combat:started', {
      allies: this.allies.map(a => ({ id: a.id, name: a.name })),
      enemies: this.enemies.map(e => ({ id: e.id, name: e.name }))
    });
  }

  /**
   * Calculate initiative and set turn order.
   * Initiative = AGI + random(1-10)
   */
  calculateInitiative() {
    const all = [
      ...this.allies.map(a => ({ entity: a, side: 'ally' })),
      ...this.enemies.map(e => ({ entity: e, side: 'enemy' }))
    ];

    for (const entry of all) {
      const agi = entry.entity.stats?.agi || 10;
      entry.initiative = agi + Math.floor(Math.random() * 10) + 1;
    }

    // Sort descending by initiative
    all.sort((a, b) => b.initiative - a.initiative);
    this.turnOrder = all;
  }

  /**
   * Start a new round.
   */
  startRound() {
    this.roundNumber++;
    this.currentTurnIndex = -1;
    this.eventBus.emit('combat:roundStart', { round: this.roundNumber });
    this.nextTurn();
  }

  /**
   * Advance to the next turn.
   */
  nextTurn() {
    // Skip dead combatants
    do {
      this.currentTurnIndex++;
    } while (
      this.currentTurnIndex < this.turnOrder.length &&
      this.turnOrder[this.currentTurnIndex].entity.stats.hp <= 0
    );

    // End of round
    if (this.currentTurnIndex >= this.turnOrder.length) {
      // Check win/lose conditions
      if (this.checkCombatEnd()) return;
      this.startRound();
      return;
    }

    const current = this.turnOrder[this.currentTurnIndex];
    this.currentActor = current;
    this.turnTimer = 0;

    this.eventBus.emit('combat:turnStart', {
      entity: current.entity,
      side: current.side,
      round: this.roundNumber
    });
  }

  /**
   * End the current turn and advance.
   */
  endTurn() {
    this.eventBus.emit('combat:turnEnd', {
      entity: this.currentActor?.entity,
      side: this.currentActor?.side
    });
    this.nextTurn();
  }

  /**
   * Check if combat should end.
   */
  checkCombatEnd() {
    const alliesAlive = this.allies.filter(a => a.stats.hp > 0);
    const enemiesAlive = this.enemies.filter(e => e.stats.hp > 0);

    if (enemiesAlive.length === 0) {
      this.endCombat('victory');
      return true;
    }
    if (alliesAlive.length === 0) {
      this.endCombat('defeat');
      return true;
    }
    return false;
  }

  /**
   * End combat with a result.
   */
  endCombat(result) {
    this.inCombat = false;

    const rewards = result === 'victory' ? this.calculateRewards() : null;

    this.eventBus.emit('combat:ended', {
      result,
      rounds: this.roundNumber,
      rewards,
      log: this.combatLog
    });

    // Clean up
    this.turnOrder = [];
    this.currentTurnIndex = -1;
    this.currentActor = null;
  }

  /**
   * Calculate rewards from defeated enemies.
   */
  calculateRewards() {
    let totalXP = 0;
    const loot = [];

    for (const enemy of this.enemies) {
      totalXP += enemy.experienceReward || 0;

      if (enemy.lootTable) {
        for (const drop of enemy.lootTable) {
          if (Math.random() < (drop.dropChance * (this.difficultyMultipliers.dropRateMultiplier || 1.0))) {
            const qty = Math.floor(
              Math.random() * (drop.maxQuantity - drop.minQuantity + 1)
            ) + drop.minQuantity;
            loot.push({ itemId: drop.itemId, quantity: qty });
          }
        }
      }
    }

    return {
      experience: Math.round(totalXP * (this.difficultyMultipliers.experienceMultiplier || 1.0)),
      loot
    };
  }

  // ─── Damage Calculation ───────────────────────────────────────────

  /**
   * Calculate damage from an attack.
   * Formula: (ATK - DEF * 0.5) * variance(0.85-1.15) * phaseMultiplier * comboMultiplier
   * @param {object} attacker - Entity with stats
   * @param {object} defender - Entity with stats
   * @param {object} options - { spell, isPhysical, sapPhaseBonus, sapPhaseVulnerability }
   * @returns {object} { damage, isCrit, isDodged, isBlocked, breakdown }
   */
  calculateDamage(attacker, defender, options = {}) {
    const { spell = null, isPhysical = false } = options;

    // Dodge check
    const dodgeChance = this.dodgeBaseChance + (defender.stats?.dodge || 0);
    if (Math.random() < dodgeChance) {
      this.log(`${defender.name} dodged the attack!`);
      return { damage: 0, isCrit: false, isDodged: true, isBlocked: false };
    }

    // Block check
    const blockChance = this.blockBaseChance + (defender.stats?.block || 0);
    const isBlocked = Math.random() < blockChance;

    // Base damage
    let baseDamage = spell ? spell.damage : (attacker.stats?.atk || 10);
    if (isPhysical) {
      baseDamage = attacker.stats?.atk || 10;
    }

    // Apply difficulty multiplier for enemy attackers
    if (options.attackerSide === 'enemy') {
      baseDamage *= this.difficultyMultipliers.enemyDamageMultiplier || 1.0;
    }

    // Defense reduction
    const defense = defender.stats?.def || 0;
    let damage = baseDamage - (defense * 0.5);

    // Variance (0.85 - 1.15)
    const variance = 0.85 + Math.random() * 0.3;
    damage *= variance;

    // Sap phase multiplier (spell affinity bonus)
    if (spell?.sapPhaseBonus) {
      const sapCycle = SapCycleManager.getInstance();
      damage *= sapCycle.getSpellPhaseMultiplier(spell.sapPhaseBonus);
    }

    // Enemy phase vulnerability
    if (options.sapPhaseVulnerability) {
      const sapCycle = SapCycleManager.getInstance();
      damage *= sapCycle.getEnemyVulnerability(options.sapPhaseVulnerability);
    }

    // Crit check
    const critChance = this.critBaseChance + (attacker.stats?.critChance || 0);
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      damage *= this.critBaseDamage + (attacker.stats?.critDamage || 0);
    }

    // Combo multiplier
    damage *= this.comboMultiplier;

    // Block reduction
    if (isBlocked) {
      damage *= (1 - this.blockDamageReduction);
    }

    // Phase magic multiplier
    const sapCycle = SapCycleManager.getInstance();
    if (spell && !isPhysical) {
      damage *= sapCycle.getModifiers().magicMultiplier;
    }

    // Clamp minimum
    damage = Math.max(1, Math.round(damage));

    return { damage, isCrit, isDodged: false, isBlocked };
  }

  /**
   * Apply damage to a target.
   */
  applyDamage(target, damageResult, source = null) {
    target.stats.hp = Math.max(0, target.stats.hp - damageResult.damage);

    const eventData = {
      target: { id: target.id, name: target.name, hp: target.stats.hp, maxHp: target.stats.maxHp },
      source: source ? { id: source.id, name: source.name } : null,
      ...damageResult
    };

    this.eventBus.emit('combat:damage', eventData);

    if (damageResult.isCrit) {
      this.eventBus.emit('combat:critical', eventData);
    }

    if (target.stats.hp <= 0) {
      this.eventBus.emit('enemy-defeated', {
        enemy: target,
        source
      });
    }

    this.log(`${source?.name || 'Unknown'} dealt ${damageResult.damage} damage to ${target.name}${damageResult.isCrit ? ' (CRIT!)' : ''}${damageResult.isBlocked ? ' (BLOCKED)' : ''}`);
    return eventData;
  }

  /**
   * Apply healing to a target.
   */
  applyHealing(target, amount, source = null) {
    const prevHp = target.stats.hp;
    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + amount);
    const healed = target.stats.hp - prevHp;

    this.eventBus.emit('combat:heal', {
      target: { id: target.id, name: target.name, hp: target.stats.hp, maxHp: target.stats.maxHp },
      source: source ? { id: source.id, name: source.name } : null,
      amount: healed
    });

    this.log(`${source?.name || 'Unknown'} healed ${target.name} for ${healed} HP`);
    return healed;
  }

  // ─── Combo System ─────────────────────────────────────────────────

  /**
   * Increment the combo counter (called on successful hit).
   */
  incrementCombo() {
    this.comboCounter++;
    this.comboMultiplier = Math.min(2.0, 1.0 + (this.comboCounter * 0.1));
    this.comboDecayTimer = 0;

    this.eventBus.emit('combat:combo', {
      count: this.comboCounter,
      multiplier: this.comboMultiplier
    });
  }

  /**
   * Reset the combo counter.
   */
  resetCombo() {
    if (this.comboCounter === 0) return;
    this.comboCounter = 0;
    this.comboMultiplier = 1.0;
    this.comboDecayTimer = 0;
    this.eventBus.emit('combat:comboReset');
  }

  // ─── Status Effects ───────────────────────────────────────────────

  /**
   * Apply a status effect to a target.
   */
  applyEffect(target, effect, source = null) {
    if (!target.activeEffects) target.activeEffects = [];

    // Chance check
    if (effect.chance !== undefined && Math.random() > effect.chance) return false;

    const activeEffect = {
      type: effect.type,
      value: effect.value,
      duration: effect.duration,
      remaining: effect.duration,
      source: source?.id || null
    };

    target.activeEffects.push(activeEffect);

    this.eventBus.emit('combat:effectApplied', {
      target: { id: target.id, name: target.name },
      effect: activeEffect
    });

    this.log(`${effect.type} applied to ${target.name} for ${effect.duration}s`);
    return true;
  }

  /**
   * Process active effects on all combatants (called each turn).
   */
  processEffects() {
    const allCombatants = [...this.allies, ...this.enemies];

    for (const entity of allCombatants) {
      if (!entity.activeEffects || entity.stats.hp <= 0) continue;

      const expired = [];
      for (let i = 0; i < entity.activeEffects.length; i++) {
        const effect = entity.activeEffects[i];

        switch (effect.type) {
          case 'dot':
            this.applyDamage(entity, { damage: effect.value, isCrit: false, isDodged: false, isBlocked: false });
            break;
          case 'heal_over_time':
            this.applyHealing(entity, effect.value);
            break;
          case 'slow':
            // Applied as a modifier during turn calculation
            break;
        }

        effect.remaining--;
        if (effect.remaining <= 0) expired.push(i);
      }

      // Remove expired effects (reverse order)
      for (let i = expired.length - 1; i >= 0; i--) {
        entity.activeEffects.splice(expired[i], 1);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  log(message) {
    this.combatLog.push({ round: this.roundNumber, message, timestamp: Date.now() });
  }

  /**
   * Update called each frame during combat.
   */
  update(delta) {
    if (!this.inCombat) return;

    const dt = delta / 1000;

    // Turn timer
    this.turnTimer += dt;
    if (this.turnTimer >= this.turnTimeLimit && this.currentActor?.side === 'ally') {
      this.endTurn(); // Force end turn on timeout
    }

    // Combo decay
    this.comboDecayTimer += dt;
    if (this.comboDecayTimer >= this.comboDecayTime && this.comboCounter > 0) {
      this.resetCombo();
    }
  }

  /**
   * Get all living combatants on a side.
   */
  getLivingCombatants(side) {
    const list = side === 'ally' ? this.allies : this.enemies;
    return list.filter(e => e.stats.hp > 0);
  }
}

export default CombatSystem;
