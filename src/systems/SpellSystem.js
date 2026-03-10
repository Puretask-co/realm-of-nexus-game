import { EventBus } from '../core/EventBus.js';
import { SapCycleManager } from './SapCycleManager.js';
import { CooldownManager } from './CooldownManager.js';
import { CombatSystem } from './CombatSystem.js';

/**
 * SpellSystem - Magic casting, spell effects, and combo chains.
 * Reads spell definitions from spells.json (hot-reloadable via DataManager).
 * Integrates with SapCycleManager for phase bonuses, CooldownManager for
 * ability timing, and CombatSystem for damage application.
 */
export class SpellSystem {
  static instance = null;

  static getInstance() {
    if (!SpellSystem.instance) new SpellSystem();
    return SpellSystem.instance;
  }

  constructor() {
    if (SpellSystem.instance) return SpellSystem.instance;

    this.eventBus = EventBus.getInstance();

    // Spell registry (loaded from spells.json)
    this.spells = new Map();

    // Active spell effects (ongoing DoTs, shields, buffs, etc.)
    this.activeEffects = [];

    // Casting state
    this.isCasting = false;
    this.currentCast = null;
    this.castTimer = 0;

    // Spell slot bindings (keys 1-5)
    this.spellSlots = [null, null, null, null, null];

    // Listen for data reload
    this.eventBus.on('data-reloaded', (data) => {
      if (data?.key === 'spells') this.loadSpells(data.data);
    });

    SpellSystem.instance = this;
  }

  /**
   * Load spell definitions from data array.
   */
  loadSpells(spellArray) {
    this.spells.clear();
    for (const spell of spellArray) {
      this.spells.set(spell.id, spell);
    }
  }

  /**
   * Get a spell definition by ID.
   */
  getSpell(id) {
    return this.spells.get(id) || null;
  }

  /**
   * Get all spells matching a filter.
   */
  getSpellsByTag(tag) {
    const results = [];
    for (const spell of this.spells.values()) {
      if (spell.tags?.includes(tag)) results.push(spell);
    }
    return results;
  }

  /**
   * Get spells available at a given level.
   */
  getSpellsForLevel(level) {
    const results = [];
    for (const spell of this.spells.values()) {
      if (spell.unlockLevel <= level) results.push(spell);
    }
    return results;
  }

  /**
   * Assign a spell to a slot (0-4, mapped to keys 1-5).
   */
  assignSlot(slotIndex, spellId) {
    if (slotIndex < 0 || slotIndex >= this.spellSlots.length) return false;
    this.spellSlots[slotIndex] = spellId;
    this.eventBus.emit('spell:slotChanged', { slot: slotIndex, spellId });
    return true;
  }

  /**
   * Get the spell assigned to a slot.
   */
  getSlotSpell(slotIndex) {
    const id = this.spellSlots[slotIndex];
    return id ? this.getSpell(id) : null;
  }

  // ─── Casting ──────────────────────────────────────────────────────

  /**
   * Begin casting a spell.
   * @param {string} spellId - The spell to cast
   * @param {object} caster - The casting entity
   * @param {object} target - The target entity or { x, y } for ground-targeted
   * @returns {boolean} Whether casting began successfully
   */
  beginCast(spellId, caster, target) {
    const spell = this.getSpell(spellId);
    if (!spell) return false;

    // Already casting?
    if (this.isCasting) return false;

    // Cooldown check
    const cooldownMgr = CooldownManager.getInstance();
    const cdKey = `spell_${spellId}`;
    if (cooldownMgr.isOnCooldown(cdKey)) return false;

    // Sap cost check
    const sapCycle = SapCycleManager.getInstance();
    const effectiveCost = sapCycle.getEffectiveSapCost(spell.sapCost);
    if (sapCycle.deepSapPool < effectiveCost) {
      this.eventBus.emit('spell:insufficientSap', {
        spellId,
        required: effectiveCost,
        available: sapCycle.deepSapPool
      });
      return false;
    }

    // Range check (if target has position)
    if (target && spell.range > 0 && caster.x !== undefined && target.x !== undefined) {
      const dx = target.x - caster.x;
      const dy = target.y - caster.y;
      const dist = Math.sqrt(dx * dx + dy * dy) / 32; // Convert pixels to tiles
      if (dist > spell.range) {
        this.eventBus.emit('spell:outOfRange', { spellId, distance: dist, range: spell.range });
        return false;
      }
    }

    // Start casting
    this.isCasting = true;
    this.castTimer = 0;
    this.currentCast = { spell, caster, target, spellId };

    this.eventBus.emit('spell-cast', {
      spellId,
      spell,
      caster,
      target,
      castTime: spell.castTime,
      phase: sapCycle.currentPhase
    });

    // Instant cast if castTime is 0
    if (spell.castTime <= 0) {
      this.completeCast();
    }

    return true;
  }

  /**
   * Update casting progress. Call each frame with delta in ms.
   */
  update(delta) {
    if (!this.isCasting || !this.currentCast) return;

    this.castTimer += delta / 1000;

    if (this.castTimer >= this.currentCast.spell.castTime) {
      this.completeCast();
    }

    // Update active effects
    this.updateEffects(delta);
  }

  /**
   * Complete the current cast and apply the spell.
   */
  completeCast() {
    if (!this.currentCast) return;

    const { spell, caster, target, spellId } = this.currentCast;
    const sapCycle = SapCycleManager.getInstance();
    const cooldownMgr = CooldownManager.getInstance();

    // Spend Sap
    sapCycle.spendSap(spell.sapCost);

    // Start cooldown
    cooldownMgr.start(`spell_${spellId}`, spell.cooldown);

    // Apply spell effect based on type
    switch (spell.type) {
      case 'offensive':
        this.applyOffensiveSpell(spell, caster, target);
        break;
      case 'defensive':
        this.applyDefensiveSpell(spell, caster, target);
        break;
      case 'healing':
        this.applyHealingSpell(spell, caster, target);
        break;
      case 'utility':
        this.applyUtilitySpell(spell, caster, target);
        break;
    }

    this.eventBus.emit('spell:completed', {
      spellId,
      spell,
      caster,
      target,
      phase: sapCycle.currentPhase
    });

    // Reset casting state
    this.isCasting = false;
    this.currentCast = null;
    this.castTimer = 0;
  }

  /**
   * Cancel the current cast.
   */
  cancelCast() {
    if (!this.isCasting) return;
    const { spellId } = this.currentCast;
    this.isCasting = false;
    this.currentCast = null;
    this.castTimer = 0;
    this.eventBus.emit('spell:cancelled', { spellId });
  }

  // ─── Spell Application ───────────────────────────────────────────

  applyOffensiveSpell(spell, caster, target) {
    const combat = CombatSystem.getInstance();

    // Calculate and apply damage
    const damageResult = combat.calculateDamage(caster, target, {
      spell,
      sapPhaseVulnerability: target.sapPhaseVulnerability
    });

    combat.applyDamage(target, damageResult, caster);

    // Increment combo on hit
    if (!damageResult.isDodged) {
      combat.incrementCombo();
    }

    // Apply on-hit effects (DoT, slow, pull, debuff)
    if (spell.effects) {
      for (const effect of spell.effects) {
        combat.applyEffect(target, effect, caster);
      }
    }

    // AoE handling
    if (spell.areaOfEffect > 0 && target.x !== undefined) {
      this.applyAoE(spell, caster, target);
    }

    this.eventBus.emit('spell-impact', {
      spellId: spell.id,
      spell,
      caster,
      target,
      damageResult
    });
  }

  applyDefensiveSpell(spell, caster, target) {
    // Defensive spells typically target self or ally
    const effectTarget = target || caster;

    if (spell.effects) {
      for (const effect of spell.effects) {
        if (effect.type === 'shield') {
          this.addActiveEffect({
            type: 'shield',
            target: effectTarget,
            value: effect.value * this.getPhaseMultiplier(spell),
            duration: effect.duration,
            remaining: effect.duration,
            spellId: spell.id
          });
          this.eventBus.emit('spell:shieldApplied', {
            target: effectTarget,
            value: effect.value,
            duration: effect.duration
          });
        }
      }
    }
  }

  applyHealingSpell(spell, caster, target) {
    const combat = CombatSystem.getInstance();
    const effectTarget = target || caster;

    // Immediate heal based on spell damage field used as heal amount
    if (spell.damage > 0) {
      const healAmount = Math.round(spell.damage * this.getPhaseMultiplier(spell));
      combat.applyHealing(effectTarget, healAmount, caster);
    }

    // Heal over time effects
    if (spell.effects) {
      for (const effect of spell.effects) {
        if (effect.type === 'heal_over_time') {
          this.addActiveEffect({
            type: 'heal_over_time',
            target: effectTarget,
            value: Math.round(effect.value * this.getPhaseMultiplier(spell)),
            duration: effect.duration,
            remaining: effect.duration,
            tickTimer: 0,
            tickInterval: 1,
            spellId: spell.id
          });
        }
      }
    }
  }

  applyUtilitySpell(spell, caster, target) {
    if (spell.effects) {
      for (const effect of spell.effects) {
        if (effect.type === 'buff') {
          // Sap Surge: restore Sap
          const sapCycle = SapCycleManager.getInstance();
          sapCycle.regenSap(effect.value);
          this.eventBus.emit('spell:buffApplied', {
            caster,
            type: 'sap_regen',
            value: effect.value
          });
        }
      }
    }
  }

  /**
   * Apply AoE damage to nearby enemies.
   */
  applyAoE(spell, caster, center) {
    const combat = CombatSystem.getInstance();
    const enemies = combat.getLivingCombatants('enemy');
    const aoeRadiusPx = spell.areaOfEffect * 32; // tiles to pixels

    for (const enemy of enemies) {
      if (enemy === center) continue; // Already hit primary target
      if (enemy.x === undefined) continue;

      const dx = enemy.x - center.x;
      const dy = enemy.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= aoeRadiusPx) {
        const aoeDamage = combat.calculateDamage(caster, enemy, {
          spell,
          sapPhaseVulnerability: enemy.sapPhaseVulnerability
        });
        // AoE damage reduced by 30%
        aoeDamage.damage = Math.round(aoeDamage.damage * 0.7);
        combat.applyDamage(enemy, aoeDamage, caster);
      }
    }
  }

  // ─── Active Effects ───────────────────────────────────────────────

  addActiveEffect(effect) {
    this.activeEffects.push(effect);
  }

  updateEffects(delta) {
    const dt = delta / 1000;
    const expired = [];

    for (let i = 0; i < this.activeEffects.length; i++) {
      const effect = this.activeEffects[i];
      effect.remaining -= dt;

      if (effect.type === 'heal_over_time') {
        effect.tickTimer = (effect.tickTimer || 0) + dt;
        if (effect.tickTimer >= effect.tickInterval) {
          effect.tickTimer -= effect.tickInterval;
          const combat = CombatSystem.getInstance();
          combat.applyHealing(effect.target, effect.value);
        }
      }

      if (effect.remaining <= 0) {
        expired.push(i);
        this.eventBus.emit('spell:effectExpired', {
          type: effect.type,
          spellId: effect.spellId,
          target: effect.target
        });
      }
    }

    // Remove expired (reverse order)
    for (let i = expired.length - 1; i >= 0; i--) {
      this.activeEffects.splice(expired[i], 1);
    }
  }

  /**
   * Get phase multiplier for a spell.
   */
  getPhaseMultiplier(spell) {
    const sapCycle = SapCycleManager.getInstance();
    return sapCycle.getSpellPhaseMultiplier(spell.sapPhaseBonus);
  }

  /**
   * Get casting progress (0-1).
   */
  getCastProgress() {
    if (!this.isCasting || !this.currentCast) return 0;
    return Math.min(1, this.castTimer / this.currentCast.spell.castTime);
  }

  /**
   * Get all spells with their current cooldown/availability status.
   */
  getSpellStatus() {
    const cooldownMgr = CooldownManager.getInstance();
    const sapCycle = SapCycleManager.getInstance();
    const result = [];

    for (const [id, spell] of this.spells) {
      const cdKey = `spell_${id}`;
      result.push({
        id,
        name: spell.name,
        type: spell.type,
        sapCost: sapCycle.getEffectiveSapCost(spell.sapCost),
        onCooldown: cooldownMgr.isOnCooldown(cdKey),
        cooldownRemaining: cooldownMgr.getRemaining(cdKey),
        cooldownProgress: cooldownMgr.getProgress(cdKey),
        canAfford: sapCycle.deepSapPool >= sapCycle.getEffectiveSapCost(spell.sapCost),
        phaseMultiplier: sapCycle.getSpellPhaseMultiplier(spell.sapPhaseBonus)
      });
    }

    return result;
  }
}

export default SpellSystem;
