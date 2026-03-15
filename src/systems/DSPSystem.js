import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * DSPSystem — Domain Soul Pool.
 *
 * The shared world magic resource. "Your magic costs lives."
 * Core design pillar: every spell draws from the world's life force.
 *
 * DSP ranges 0-100 with thresholds that affect the world:
 *   Healthy (90-100): World thrives
 *   Stable (70-89): Normal
 *   Strained (50-69): Shop prices +10%, encounter rate +10%
 *   Crisis (30-49): Corrupted enemies appear, NPCs fearful
 *   Catastrophic (10-29): World visibly dying, desperation quests
 *   Imminent Collapse (0-9): Final warnings, permanent consequences
 *
 * Recovery:
 *   - Blue Sap phase: +5/day
 *   - Long rest: +10
 *   - Quest completion: +5 to +15
 *   - Silver Sap Unbinding: +30 to +60
 */
export class DSPSystem {
  static instance = null;
  static getInstance() {
    if (!DSPSystem.instance) new DSPSystem();
    return DSPSystem.instance;
  }

  constructor() {
    if (DSPSystem.instance) return DSPSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Load config
    const dspCfg = dataManager.getConfig('balance.dsp') || {};
    this.min = dspCfg.min || 0;
    this.max = dspCfg.max || 100;
    this.current = dspCfg.startingValue || 100;

    // Thresholds
    this.thresholds = dspCfg.thresholds || {
      healthy: { min: 90, max: 100 },
      stable: { min: 70, max: 89 },
      strained: { min: 50, max: 69 },
      crisis: { min: 30, max: 49 },
      catastrophic: { min: 10, max: 29 },
      imminentCollapse: { min: 0, max: 9 }
    };

    // Recovery config
    this.recovery = dspCfg.recovery || {
      blueSapPerDay: 5,
      longRest: 10,
      questMin: 5,
      questMax: 15,
      silverSapUnbindingMin: 30,
      silverSapUnbindingMax: 60
    };

    // Track previous threshold for change events
    this._previousThreshold = this.getCurrentThreshold();

    // Listen for events
    this.eventBus.on('quest:completed', () => this.onQuestCompleted());
    this.eventBus.on('sap-day-passed', (data) => this.onDayPassed(data));

    DSPSystem.instance = this;
  }

  /**
   * Spend DSP for a spell or ability.
   * @param {number} amount - DSP to spend
   * @returns {boolean} Whether the spend was successful
   */
  spend(amount) {
    if (amount <= 0) return true;
    if (this.current < amount) {
      this.eventBus.emit('dsp:insufficient', { required: amount, available: this.current });
      return false;
    }

    this.current = Math.max(this.min, this.current - amount);
    this._checkThresholdChange();
    this.eventBus.emit('dsp:changed', this.getStatus());
    return true;
  }

  /**
   * Recover DSP.
   */
  recover(amount, source = 'unknown') {
    if (amount <= 0) return;
    const prev = this.current;
    this.current = Math.min(this.max, this.current + amount);
    const actual = this.current - prev;

    if (actual > 0) {
      this._checkThresholdChange();
      this.eventBus.emit('dsp:changed', this.getStatus());
      this.eventBus.emit('dsp:recovered', { amount: actual, source });
    }
  }

  /**
   * Get the effective DSP cost for a spell, modified by Sap phase.
   */
  getEffectiveCost(baseCost, sapPhase) {
    const phaseCfg = dataManager.getConfig('balance.sapCycle.phases') || [];
    const phase = phaseCfg.find(p => p.name.toLowerCase() === sapPhase);
    const bonus = phase?.modifiers?.magicCostBonusDSP || 0;
    return Math.max(0, baseCost + bonus);
  }

  /**
   * Get current threshold name.
   */
  getCurrentThreshold() {
    for (const [name, range] of Object.entries(this.thresholds)) {
      if (this.current >= range.min && this.current <= range.max) {
        return name;
      }
    }
    return 'imminentCollapse';
  }

  /**
   * Get modifiers from current threshold.
   */
  getThresholdModifiers() {
    const threshold = this.getCurrentThreshold();
    const thresholdData = this.thresholds[threshold];
    return {
      threshold,
      effects: thresholdData?.effects || {},
      shopPriceMultiplier: 1.0 + (thresholdData?.effects?.shopPriceIncrease || 0),
      encounterRateMultiplier: 1.0 + (thresholdData?.effects?.encounterRateIncrease || 0)
    };
  }

  /**
   * Get full DSP status for UI display.
   */
  getStatus() {
    return {
      current: this.current,
      max: this.max,
      percentage: (this.current / this.max) * 100,
      threshold: this.getCurrentThreshold(),
      modifiers: this.getThresholdModifiers()
    };
  }

  // ─── Event Handlers ─────────────────────────────────────────────

  onQuestCompleted() {
    const amount = this.recovery.questMin +
      Math.floor(Math.random() * (this.recovery.questMax - this.recovery.questMin + 1));
    this.recover(amount, 'quest');
  }

  onDayPassed(data) {
    if (data?.phase === 'blue') {
      this.recover(this.recovery.blueSapPerDay, 'blue_sap_regen');
    }
    // Silver Sap drains DSP per day
    const phaseCfg = dataManager.getConfig('balance.sapCycle.phases') || [];
    const silverPhase = phaseCfg.find(p => p.name === 'Silver');
    if (data?.phase === 'silver' && silverPhase?.modifiers?.dspDrainPerDay) {
      const drain = Math.abs(silverPhase.modifiers.dspDrainPerDay);
      this.current = Math.max(this.min, this.current - drain);
      this._checkThresholdChange();
      this.eventBus.emit('dsp:changed', this.getStatus());
    }
  }

  onLongRest() {
    this.recover(this.recovery.longRest, 'long_rest');
  }

  // ─── Internal ─────────────────────────────────────────────────

  _checkThresholdChange() {
    const current = this.getCurrentThreshold();
    if (current !== this._previousThreshold) {
      this.eventBus.emit('dsp:thresholdChanged', {
        previous: this._previousThreshold,
        current,
        dsp: this.current
      });
      this._previousThreshold = current;
    }
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return { current: this.current };
  }

  deserialize(data) {
    if (data?.current !== undefined) {
      this.current = data.current;
      this._previousThreshold = this.getCurrentThreshold();
    }
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }

  drain(amount, source) {
    this.currentDSP = Math.max(this.min, this.currentDSP - amount);
    this.eventBus.emit('dsp:drained', { amount, source, current: this.currentDSP });
    this._checkThreshold();
  }
}

export default DSPSystem;
