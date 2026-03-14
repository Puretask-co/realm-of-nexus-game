import { EventBus } from '../core/EventBus.js';
import SapCycleManager from './SapCycleManager.js';

/**
 * AISystem - Enemy behavior state machine with 5 behavior patterns.
 * Each enemy has a behavior type that determines its combat strategy.
 *
 * Behavior types:
 *   aggressive - Charges in, attacks strongest/nearest target, never flees
 *   defensive  - Kites at range, flees when low HP, prefers ranged abilities
 *   tactical   - Targets weakest, flanks, uses abilities strategically
 *   support    - Heals/buffs allies, stays behind front line
 *   boss       - Phase-based behavior, uses rotation of abilities
 */
export class AISystem {
  static instance = null;

  static getInstance() {
    if (!AISystem.instance) new AISystem();
    return AISystem.instance;
  }

  constructor() {
    if (AISystem.instance) return AISystem.instance;

    this.eventBus = EventBus.getInstance();

    // AI state for each managed entity: Map<entityId, AIState>
    this.entities = new Map();

    // AI tick rate (process every N ms to avoid per-frame overhead)
    this.tickInterval = 200; // 5 Hz
    this.tickTimer = 0;

    AISystem.instance = this;
  }

  /**
   * Register an enemy entity for AI management.
   * @param {object} entity - Entity with { id, stats, ai: { behavior, aggroRange, leashRange, fleeHealthPercent }, abilities, sapPhaseVulnerability }
   */
  register(entity) {
    this.entities.set(entity.id, {
      entity,
      state: 'idle',         // idle, chase, attack, flee, ability, support
      target: null,
      stateTimer: 0,
      abilityTimers: new Map(), // spellId → remaining cooldown
      spawnX: entity.x || 0,
      spawnY: entity.y || 0,
      lastActionTime: 0
    });

    // Initialize ability cooldowns
    if (entity.abilities) {
      const ai = this.entities.get(entity.id);
      for (const ability of entity.abilities) {
        ai.abilityTimers.set(ability.spellId, 0); // Start ready
      }
    }
  }

  /**
   * Unregister an entity (e.g. on death).
   */
  unregister(entityId) {
    this.entities.delete(entityId);
  }

  /**
   * Update AI for all registered entities.
   * @param {number} delta - Frame delta in ms
   * @param {Array} allies - Array of ally entities (potential targets)
   */
  update(delta, allies = []) {
    this.tickTimer += delta;
    if (this.tickTimer < this.tickInterval) return;

    const dt = this.tickTimer;
    this.tickTimer = 0;

    for (const [id, ai] of this.entities) {
      const entity = ai.entity;
      if (entity.stats.hp <= 0) continue;

      // Update ability cooldowns
      for (const [spellId, remaining] of ai.abilityTimers) {
        if (remaining > 0) {
          ai.abilityTimers.set(spellId, Math.max(0, remaining - dt / 1000));
        }
      }

      // Run behavior logic based on type
      const behavior = entity.ai?.behavior || 'aggressive';
      switch (behavior) {
        case 'aggressive':
          this.updateAggressive(ai, allies, dt);
          break;
        case 'defensive':
          this.updateDefensive(ai, allies, dt);
          break;
        case 'tactical':
          this.updateTactical(ai, allies, dt);
          break;
        case 'support':
          this.updateSupport(ai, allies, dt);
          break;
        case 'boss':
          this.updateBoss(ai, allies, dt);
          break;
        default:
          this.updateAggressive(ai, allies, dt);
      }
    }
  }

  // ─── Behavior Implementations ─────────────────────────────────────

  /**
   * Aggressive: charge nearest target, attack relentlessly, never flee.
   */
  updateAggressive(ai, allies, dt) {
    const entity = ai.entity;
    const aggroRange = entity.ai?.aggroRange || 5;
    const leashRange = entity.ai?.leashRange || 10;

    switch (ai.state) {
      case 'idle':
        ai.target = this.findNearestTarget(entity, allies, aggroRange);
        if (ai.target) {
          ai.state = 'chase';
          this.emitStateChange(entity, 'chase');
        }
        break;

      case 'chase': {
        if (!ai.target || ai.target.stats.hp <= 0) {
          ai.target = this.findNearestTarget(entity, allies, aggroRange);
          if (!ai.target) { ai.state = 'idle'; return; }
        }

        // Leash check
        const distToSpawn = this.distance(entity, { x: ai.spawnX, y: ai.spawnY });
        if (distToSpawn > leashRange * 32) {
          ai.state = 'idle';
          ai.target = null;
          this.emitAction(entity, 'leash_return');
          return;
        }

        const dist = this.distance(entity, ai.target);
        if (dist <= (entity.attackRange || 1.5) * 32) {
          ai.state = 'attack';
        } else {
          this.moveToward(entity, ai.target, dt);
        }
        break;
      }

      case 'attack': {
        if (!ai.target || ai.target.stats.hp <= 0) {
          ai.state = 'idle';
          return;
        }

        // Try ability first
        const ability = this.selectAbility(ai, 'target_in_melee');
        if (ability) {
          this.useAbility(ai, ability);
        } else {
          this.emitAction(entity, 'basic_attack', { target: ai.target });
        }

        ai.state = 'chase'; // Return to chase after attack
        break;
      }
    }
  }

  /**
   * Defensive: maintain distance, use ranged abilities, flee when low HP.
   */
  updateDefensive(ai, allies, dt) {
    const entity = ai.entity;
    const aggroRange = entity.ai?.aggroRange || 6;
    const fleeThreshold = entity.ai?.fleeHealthPercent || 0.2;
    const hpPercent = entity.stats.hp / entity.stats.maxHp;

    // Flee check
    if (hpPercent <= fleeThreshold && ai.state !== 'flee') {
      ai.state = 'flee';
      this.emitStateChange(entity, 'flee');
    }

    switch (ai.state) {
      case 'idle':
        ai.target = this.findNearestTarget(entity, allies, aggroRange);
        if (ai.target) {
          ai.state = 'attack';
          this.emitStateChange(entity, 'attack');
        }
        break;

      case 'attack': {
        if (!ai.target || ai.target.stats.hp <= 0) {
          ai.target = this.findNearestTarget(entity, allies, aggroRange);
          if (!ai.target) { ai.state = 'idle'; return; }
        }

        const dist = this.distance(entity, ai.target);

        // Maintain range - back away if too close
        if (dist < 3 * 32) {
          this.moveAwayFrom(entity, ai.target, dt);
        }

        // Use ranged ability if in range
        const ability = this.selectAbility(ai, 'target_in_range');
        if (ability) {
          this.useAbility(ai, ability);
        }
        break;
      }

      case 'flee':
        if (ai.target) {
          this.moveAwayFrom(entity, ai.target, dt);
        }
        // Try to heal/shield if possible
        const healAbility = this.selectAbility(ai, 'health_below_50');
        if (healAbility) this.useAbility(ai, healAbility);
        break;
    }
  }

  /**
   * Tactical: targets weakest enemy, uses abilities at optimal times.
   */
  updateTactical(ai, allies, dt) {
    const entity = ai.entity;
    const aggroRange = entity.ai?.aggroRange || 7;

    switch (ai.state) {
      case 'idle':
        ai.target = this.findWeakestTarget(entity, allies, aggroRange);
        if (ai.target) {
          ai.state = 'chase';
          this.emitStateChange(entity, 'chase');
        }
        break;

      case 'chase': {
        if (!ai.target || ai.target.stats.hp <= 0) {
          ai.target = this.findWeakestTarget(entity, allies, aggroRange);
          if (!ai.target) { ai.state = 'idle'; return; }
        }

        const dist = this.distance(entity, ai.target);
        const attackRange = (entity.attackRange || 1.5) * 32;

        if (dist <= attackRange) {
          ai.state = 'attack';
        } else {
          this.moveToward(entity, ai.target, dt);
        }
        break;
      }

      case 'attack': {
        if (!ai.target || ai.target.stats.hp <= 0) {
          ai.state = 'idle';
          return;
        }

        // Prioritize abilities with matching conditions
        const hpPercent = entity.stats.hp / entity.stats.maxHp;
        let condition = 'target_in_range';
        if (hpPercent < 0.25) condition = 'health_below_25';
        else if (hpPercent < 0.5) condition = 'health_below_50';

        const ability = this.selectAbility(ai, condition);
        if (ability) {
          this.useAbility(ai, ability);
        } else {
          this.emitAction(entity, 'basic_attack', { target: ai.target });
        }

        ai.state = 'chase';
        break;
      }
    }
  }

  /**
   * Support: heal/buff allies, avoid direct combat.
   */
  updateSupport(ai, allies, dt) {
    const entity = ai.entity;
    const allEnemies = this.getAllLivingEntities();

    // Find injured ally
    let woundedAlly = null;
    let lowestHP = 1.0;
    for (const other of allEnemies) {
      if (other.id === entity.id) continue;
      const hpPct = other.stats.hp / other.stats.maxHp;
      if (hpPct < lowestHP) {
        lowestHP = hpPct;
        woundedAlly = other;
      }
    }

    switch (ai.state) {
      case 'idle':
        if (woundedAlly && lowestHP < 0.7) {
          ai.target = woundedAlly;
          ai.state = 'support';
          this.emitStateChange(entity, 'support');
        }
        break;

      case 'support': {
        // Try to use healing/buff ability
        const ability = this.selectAbility(ai, 'target_in_range');
        if (ability) {
          this.useAbility(ai, ability, woundedAlly);
        }

        // Stay behind front line - move away from player targets
        const playerTargets = allies.filter(a => a.stats.hp > 0);
        if (playerTargets.length > 0) {
          const nearest = this.findNearestTarget(entity, playerTargets, 99);
          if (nearest && this.distance(entity, nearest) < 4 * 32) {
            this.moveAwayFrom(entity, nearest, dt);
          }
        }

        // Re-evaluate
        if (!woundedAlly || lowestHP >= 0.9) {
          ai.state = 'idle';
        }
        break;
      }
    }
  }

  /**
   * Boss: phase-based behavior with ability rotation.
   */
  updateBoss(ai, allies, dt) {
    const entity = ai.entity;
    const aggroRange = entity.ai?.aggroRange || 10;
    const hpPercent = entity.stats.hp / entity.stats.maxHp;

    // Boss phase determination
    let bossPhase = 1;
    if (hpPercent <= 0.25) bossPhase = 3;
    else if (hpPercent <= 0.5) bossPhase = 2;

    if (!ai.target || ai.target.stats.hp <= 0) {
      ai.target = this.findNearestTarget(entity, allies, aggroRange);
    }
    if (!ai.target) return;

    // Select ability based on boss phase and conditions
    let condition = 'target_in_range';
    if (bossPhase >= 3) condition = 'health_below_25';
    else if (bossPhase >= 2) condition = 'health_below_50';

    const ability = this.selectAbility(ai, condition);
    if (ability) {
      this.useAbility(ai, ability);
      return;
    }

    // Fall back to chase + basic attack
    const dist = this.distance(entity, ai.target);
    if (dist > (entity.attackRange || 1.5) * 32) {
      this.moveToward(entity, ai.target, dt);
    } else {
      this.emitAction(entity, 'basic_attack', { target: ai.target, bossPhase });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /**
   * Find nearest living target within range.
   */
  findNearestTarget(entity, targets, rangeTiles) {
    let nearest = null;
    let minDist = rangeTiles * 32;

    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      const dist = this.distance(entity, target);
      if (dist < minDist) {
        minDist = dist;
        nearest = target;
      }
    }
    return nearest;
  }

  /**
   * Find weakest (lowest HP%) living target within range.
   */
  findWeakestTarget(entity, targets, rangeTiles) {
    let weakest = null;
    let lowestHPPercent = 1.0;
    const maxDist = rangeTiles * 32;

    for (const target of targets) {
      if (target.stats.hp <= 0) continue;
      if (this.distance(entity, target) > maxDist) continue;

      const hpPct = target.stats.hp / target.stats.maxHp;
      if (hpPct < lowestHPPercent) {
        lowestHPPercent = hpPct;
        weakest = target;
      }
    }
    return weakest;
  }

  /**
   * Select the best available ability matching a condition.
   */
  selectAbility(ai, condition) {
    const entity = ai.entity;
    if (!entity.abilities) return null;

    // Filter by condition and cooldown, sort by priority
    const available = entity.abilities
      .filter(ab => {
        // Check cooldown
        const remaining = ai.abilityTimers.get(ab.spellId) || 0;
        if (remaining > 0) return false;
        // Check condition match
        return ab.conditions.includes(condition);
      })
      .sort((a, b) => b.priority - a.priority);

    if (available.length === 0) return null;

    // Use highest priority, with random roll against priority value
    for (const ab of available) {
      if (Math.random() < ab.priority) return ab;
    }

    return available[0]; // Fallback to highest priority
  }

  /**
   * Execute an ability.
   */
  useAbility(ai, ability, overrideTarget = null) {
    const entity = ai.entity;
    const target = overrideTarget || ai.target;

    // Set cooldown
    ai.abilityTimers.set(ability.spellId, ability.cooldown);

    this.emitAction(entity, 'use_ability', {
      spellId: ability.spellId,
      target,
      priority: ability.priority
    });
  }

  /**
   * Move entity toward a target.
   */
  moveToward(entity, target, dt) {
    if (entity.x === undefined || target.x === undefined) return;
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const speed = (entity.speed || 50) * (dt / 1000);
    entity.x += (dx / dist) * speed;
    entity.y += (dy / dist) * speed;
  }

  /**
   * Move entity away from a target.
   */
  moveAwayFrom(entity, target, dt) {
    if (entity.x === undefined || target.x === undefined) return;
    const dx = entity.x - target.x;
    const dy = entity.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const speed = (entity.speed || 50) * (dt / 1000);
    entity.x += (dx / dist) * speed;
    entity.y += (dy / dist) * speed;
  }

  /**
   * Calculate pixel distance between two entities.
   */
  distance(a, b) {
    const dx = (a.x || 0) - (b.x || 0);
    const dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get all living managed entities (for support AI).
   */
  getAllLivingEntities() {
    const result = [];
    for (const [, ai] of this.entities) {
      if (ai.entity.stats.hp > 0) result.push(ai.entity);
    }
    return result;
  }

  // ─── Event Emitters ───────────────────────────────────────────────

  emitStateChange(entity, newState) {
    this.eventBus.emit('ai:stateChanged', {
      entityId: entity.id,
      name: entity.name,
      state: newState
    });
  }

  emitAction(entity, action, data = {}) {
    this.eventBus.emit('ai:action', {
      entityId: entity.id,
      name: entity.name,
      action,
      ...data
    });
  }

  /**
   * Get debug info for all managed entities.
   */
  getDebugInfo() {
    const result = [];
    for (const [id, ai] of this.entities) {
      result.push({
        id,
        name: ai.entity.name,
        state: ai.state,
        behavior: ai.entity.ai?.behavior,
        hp: `${ai.entity.stats.hp}/${ai.entity.stats.maxHp}`,
        target: ai.target?.name || 'none',
        cooldowns: Object.fromEntries(ai.abilityTimers)
      });
    }
    return result;
  }
}

export default AISystem;
