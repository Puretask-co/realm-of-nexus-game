import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { DSPSystem } from './DSPSystem.js';

/**
 * VeilkeeperSystem — 5 mentor spirits you can consult for hints.
 *
 * Core design pillar: "Knowledge costs lives."
 * Each consultation:
 *   - Costs 10 DSP from the world
 *   - Adds 1 Hollowing tick to the consulted Veilkeeper
 *   - During Crimson Sap: +2 Hollowing ticks instead of +1
 *
 * When a Veilkeeper's Hollowing reaches their threshold, they die permanently:
 *   - Their knowledge domain is locked forever
 *   - All other Veilkeepers gain +1 Hollowing
 *   - DSP drops by 10
 *   - Emerald Coven reputation -15
 *
 * Veilkeepers:
 *   Sylthara  - Combat Wisdom (threshold 10)
 *   Morvein   - Hidden Paths (threshold 10)
 *   Elduin    - Future Events (threshold 8, most fragile)
 *   Kaelthas  - Ancient Lore (threshold 12, most resilient)
 *   Virelda   - Corruption & Abyss Intel (threshold 10)
 */
export class VeilkeeperSystem {
  static instance = null;
  static getInstance() {
    if (!VeilkeeperSystem.instance) new VeilkeeperSystem();
    return VeilkeeperSystem.instance;
  }

  constructor() {
    if (VeilkeeperSystem.instance) return VeilkeeperSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Veilkeeper state
    this.veilkeepers = new Map();
    this.deadVeilkeepers = new Set();
    this.communionUsed = new Set(); // Track post-death communion rituals
    this.consultationHistory = [];

    // Load from data
    this._loadFromData();

    VeilkeeperSystem.instance = this;
  }

  _loadFromData() {
    const vkData = dataManager.getVeilkeeperData?.() || {};
    const veilkeepers = vkData.veilkeepers || [];
    const rules = vkData.systemRules || {};

    this.consultationCostDSP = rules.consultationCost?.dsp || 10;
    this.baseHollowingPerConsult = rules.consultationCost?.hollowingTicks || 1;
    this.crimsonHollowingPerConsult = rules.consultationCost?.crimsonPhaseHollowingTicks || 2;
    this.warningThresholds = rules.warningThresholds || [];

    for (const vk of veilkeepers) {
      this.veilkeepers.set(vk.id, {
        ...vk,
        currentHollowing: vk.currentHollowing || 0,
        alive: true,
        consultCount: 0
      });
    }
  }

  /**
   * Get a Veilkeeper by ID.
   */
  getVeilkeeper(id) {
    return this.veilkeepers.get(id) || null;
  }

  /**
   * Get all living Veilkeepers.
   */
  getLivingVeilkeepers() {
    return [...this.veilkeepers.values()].filter(vk => vk.alive);
  }

  /**
   * Get all dead Veilkeepers.
   */
  getDeadVeilkeepers() {
    return [...this.veilkeepers.values()].filter(vk => !vk.alive);
  }

  /**
   * Consult a Veilkeeper for knowledge.
   * @param {string} veilkeeperId - The Veilkeeper to consult
   * @param {string} currentSapPhase - 'blue', 'crimson', or 'silver'
   * @returns {{ success: boolean, warning?: string, died?: boolean }}
   */
  consult(veilkeeperId, currentSapPhase = 'blue') {
    const vk = this.veilkeepers.get(veilkeeperId);
    if (!vk || !vk.alive) {
      return { success: false, reason: 'Veilkeeper is dead or does not exist' };
    }

    // Check DSP cost
    const dsp = DSPSystem.getInstance();
    const costDSP = Math.abs(this.consultationCostDSP);
    if (!dsp.spend(costDSP)) {
      return { success: false, reason: 'Insufficient DSP' };
    }

    // Calculate Hollowing ticks
    const isCrimson = currentSapPhase.toLowerCase() === 'crimson';
    const hollowingTicks = isCrimson ? this.crimsonHollowingPerConsult : this.baseHollowingPerConsult;

    vk.currentHollowing += hollowingTicks;
    vk.consultCount++;

    // Record consultation
    this.consultationHistory.push({
      veilkeeperId,
      hollowingAdded: hollowingTicks,
      dspSpent: costDSP,
      sapPhase: currentSapPhase,
      timestamp: Date.now()
    });

    // Check warning level
    const warningLevel = this._getWarningLevel(vk);

    // Check death
    if (vk.currentHollowing >= vk.hollowingThreshold) {
      this._killVeilkeeper(veilkeeperId);
      this.eventBus.emit('veilkeeper:consulted', {
        veilkeeperId,
        hollowingAdded: hollowingTicks,
        dspSpent: costDSP,
        died: true,
        specialization: vk.specialization
      });
      return {
        success: true,
        died: true,
        warning: `${vk.name} has succumbed to the Hollowing. Their knowledge is lost forever.`
      };
    }

    this.eventBus.emit('veilkeeper:consulted', {
      veilkeeperId,
      hollowingAdded: hollowingTicks,
      dspSpent: costDSP,
      currentHollowing: vk.currentHollowing,
      threshold: vk.hollowingThreshold,
      warningLevel,
      specialization: vk.specialization
    });

    return {
      success: true,
      warning: warningLevel ? this._getWarningMessage(warningLevel) : null,
      hollowing: vk.currentHollowing,
      threshold: vk.hollowingThreshold
    };
  }

  /**
   * Kill a Veilkeeper (Hollowing reached threshold).
   */
  _killVeilkeeper(veilkeeperId) {
    const vk = this.veilkeepers.get(veilkeeperId);
    if (!vk) return;

    vk.alive = false;
    this.deadVeilkeepers.add(veilkeeperId);

    // Cascade effects
    const cascadeEffects = vk.deathConsequences?.cascadeEffects || {};

    // All other Veilkeepers gain +1 Hollowing
    const hollowingIncrease = cascadeEffects.otherVeilkeepersHollowingIncrease || 1;
    for (const [id, otherVk] of this.veilkeepers) {
      if (id !== veilkeeperId && otherVk.alive) {
        otherVk.currentHollowing += hollowingIncrease;
        // Check if cascade kills another
        if (otherVk.currentHollowing >= otherVk.hollowingThreshold) {
          this._killVeilkeeper(id); // Recursive cascade
        }
      }
    }

    // DSP penalty
    const dspPenalty = Math.abs(cascadeEffects.dspPenalty || 10);
    const dsp = DSPSystem.getInstance();
    dsp.current = Math.max(dsp.min, dsp.current - dspPenalty);

    // Faction reputation penalty
    this.eventBus.emit('faction:reputationChange', {
      faction: cascadeEffects.reputationPenalty?.faction || 'emerald_coven',
      change: cascadeEffects.reputationPenalty?.value || -15,
      source: `${vk.name}'s death`
    });

    this.eventBus.emit('veilkeeper:died', {
      veilkeeperId,
      name: vk.name,
      specialization: vk.specialization,
      lockedDomain: vk.deathConsequences?.lockedDomain,
      lockedAbilities: vk.deathConsequences?.lockedAbilities || []
    });
  }

  /**
   * Check if a knowledge domain is still accessible.
   */
  isDomainAvailable(domain) {
    for (const vk of this.veilkeepers.values()) {
      if (vk.specialization === domain && vk.alive) return true;
    }
    return false;
  }

  /**
   * Perform a post-death communion ritual.
   */
  performCommunion(veilkeeperId) {
    const vk = this.veilkeepers.get(veilkeeperId);
    if (!vk || vk.alive) return { success: false, reason: 'Veilkeeper is still alive' };
    if (this.communionUsed.has(veilkeeperId)) return { success: false, reason: 'Communion already used' };

    // Check DSP cost (50)
    const dsp = DSPSystem.getInstance();
    if (!dsp.spend(50)) return { success: false, reason: 'Insufficient DSP (need 50)' };

    // TODO: Check material requirements

    this.communionUsed.add(veilkeeperId);
    this.eventBus.emit('veilkeeper:communion', {
      veilkeeperId,
      name: vk.name,
      specialization: vk.specialization
    });

    return { success: true };
  }

  /**
   * Leave an offering at a memorial for a buff.
   */
  leaveOffering(veilkeeperId) {
    const vk = this.veilkeepers.get(veilkeeperId);
    if (!vk || vk.alive) return null;
    if (!vk.memorialBuffs) return null;

    const buff = vk.memorialBuffs.effect;
    this.eventBus.emit('veilkeeper:offeringLeft', {
      veilkeeperId,
      buff
    });

    return buff;
  }

  // ─── Warning System ─────────────────────────────────────────────

  _getWarningLevel(vk) {
    const ratio = vk.currentHollowing / vk.hollowingThreshold;
    for (let i = this.warningThresholds.length - 1; i >= 0; i--) {
      if (ratio >= this.warningThresholds[i].percentOfThreshold) {
        return this.warningThresholds[i];
      }
    }
    return null;
  }

  _getWarningMessage(warningLevel) {
    return warningLevel?.message || '';
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    const vkState = {};
    for (const [id, vk] of this.veilkeepers) {
      vkState[id] = {
        currentHollowing: vk.currentHollowing,
        alive: vk.alive,
        consultCount: vk.consultCount
      };
    }
    return {
      veilkeepers: vkState,
      deadVeilkeepers: [...this.deadVeilkeepers],
      communionUsed: [...this.communionUsed],
      consultationHistory: this.consultationHistory
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.veilkeepers) {
      for (const [id, state] of Object.entries(data.veilkeepers)) {
        const vk = this.veilkeepers.get(id);
        if (vk) {
          vk.currentHollowing = state.currentHollowing || 0;
          vk.alive = state.alive !== false;
          vk.consultCount = state.consultCount || 0;
        }
      }
    }
    if (data.deadVeilkeepers) this.deadVeilkeepers = new Set(data.deadVeilkeepers);
    if (data.communionUsed) this.communionUsed = new Set(data.communionUsed);
    if (data.consultationHistory) this.consultationHistory = data.consultationHistory;
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }

  getAliveCount() {
    return this.getLivingVeilkeepers().length;
  }
}

export default VeilkeeperSystem;
