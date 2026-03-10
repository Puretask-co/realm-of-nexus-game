import { EventBus } from '../core/EventBus.js';

/**
 * SapCycleManager - Core temporal magic system for Verdance.
 * Manages the three-phase Sap Cycle: BLUE → CRIMSON → SILVER → repeat.
 * Each phase modifies spell damage, enemy behavior, lighting, and particles.
 */
export class SapCycleManager {
  static instance = null;

  static getInstance() {
    if (!SapCycleManager.instance) new SapCycleManager();
    return SapCycleManager.instance;
  }

  constructor() {
    if (SapCycleManager.instance) return SapCycleManager.instance;

    this.eventBus = EventBus.getInstance();

    // Phase definitions
    this.phases = ['blue', 'crimson', 'silver'];
    this.phaseIndex = 0;
    this.currentPhase = 'blue';
    this.previousPhase = null;

    // Timing (configurable via config.json hot-reload)
    this.phaseDuration = 120;      // seconds per phase
    this.transitionDuration = 5;   // seconds for transition effect
    this.phaseTimer = 0;           // elapsed seconds in current phase
    this.isTransitioning = false;
    this.transitionTimer = 0;
    this.transitionProgress = 0;   // 0-1 blend factor

    // Deep Sap Pool (player resource)
    this.deepSapPool = 100;
    this.deepSapPoolMax = 100;
    this.sapRegenRate = 2;
    this.sapRegenInterval = 1;     // regen every N seconds
    this.sapRegenTimer = 0;

    // Phase modifiers applied to game systems
    this.phaseModifiers = {
      blue: {
        magicMultiplier: 1.0,
        sapCostMultiplier: 1.0,
        vulnerabilityMultiplier: 1.0,
        ambientColor: 0x4488ff,
        ambientIntensity: 0.7,
        description: 'The Sap flows steady and calm. Temporal magic resonates.'
      },
      crimson: {
        magicMultiplier: 0.7,
        sapCostMultiplier: 1.4,
        vulnerabilityMultiplier: 1.3,
        ambientColor: 0xff4444,
        ambientIntensity: 0.5,
        description: 'The Sap burns hot and wild. Fire magic surges, but costs rise.'
      },
      silver: {
        magicMultiplier: 1.5,
        sapCostMultiplier: 0.7,
        vulnerabilityMultiplier: 0.8,
        ambientColor: 0xccccff,
        ambientIntensity: 0.9,
        description: 'The Sap crystallizes into clarity. All magic amplified.'
      }
    };

    this.running = false;
    this.totalCycles = 0;

    // Listen for config hot-reload
    this.eventBus.on('data-reloaded', (data) => {
      if (data?.key === 'config') this.applyConfig(data.data);
    });

    SapCycleManager.instance = this;
  }

  /**
   * Apply configuration from config.json
   */
  applyConfig(config) {
    if (!config?.sapCycle) return;
    const sc = config.sapCycle;
    if (sc.phaseDuration) this.phaseDuration = sc.phaseDuration;
    if (sc.transitionDuration) this.transitionDuration = sc.transitionDuration;
    if (sc.deepSapPoolMax) this.deepSapPoolMax = sc.deepSapPoolMax;
    if (sc.sapRegenRate) this.sapRegenRate = sc.sapRegenRate;
    if (sc.sapRegenInterval) this.sapRegenInterval = sc.sapRegenInterval;
    if (sc.phaseOrder && Array.isArray(sc.phaseOrder)) this.phases = sc.phaseOrder;
  }

  /**
   * Start the Sap Cycle.
   */
  start(config = null) {
    if (config) this.applyConfig(config);
    this.running = true;
    this.phaseTimer = 0;
    this.phaseIndex = 0;
    this.currentPhase = this.phases[0];
    this.eventBus.emit('phase-changed', {
      phase: this.currentPhase,
      modifiers: this.getModifiers(),
      isStart: true
    });
  }

  /**
   * Stop the Sap Cycle.
   */
  stop() {
    this.running = false;
  }

  /**
   * Update called each frame with delta in ms.
   */
  update(delta) {
    if (!this.running) return;

    const dt = delta / 1000; // convert ms to seconds

    // Handle transition blending
    if (this.isTransitioning) {
      this.transitionTimer += dt;
      this.transitionProgress = Math.min(this.transitionTimer / this.transitionDuration, 1);

      this.eventBus.emit('phase-transition', {
        from: this.previousPhase,
        to: this.currentPhase,
        progress: this.transitionProgress
      });

      if (this.transitionProgress >= 1) {
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.transitionProgress = 0;
      }
    }

    // Phase timer
    this.phaseTimer += dt;
    if (this.phaseTimer >= this.phaseDuration) {
      this.advancePhase();
    }

    // Sap regeneration
    this.sapRegenTimer += dt;
    if (this.sapRegenTimer >= this.sapRegenInterval) {
      this.sapRegenTimer -= this.sapRegenInterval;
      this.regenSap(this.sapRegenRate);
    }
  }

  /**
   * Advance to the next phase in the cycle.
   */
  advancePhase() {
    this.previousPhase = this.currentPhase;
    this.phaseIndex = (this.phaseIndex + 1) % this.phases.length;
    this.currentPhase = this.phases[this.phaseIndex];
    this.phaseTimer = 0;

    // Start transition
    this.isTransitioning = true;
    this.transitionTimer = 0;
    this.transitionProgress = 0;

    if (this.phaseIndex === 0) {
      this.totalCycles++;
    }

    this.eventBus.emit('phase-changed', {
      phase: this.currentPhase,
      previousPhase: this.previousPhase,
      modifiers: this.getModifiers(),
      cycle: this.totalCycles,
      isStart: false
    });
  }

  /**
   * Force a specific phase (for editor/debug).
   */
  forcePhase(phase) {
    if (!this.phases.includes(phase)) return;
    this.previousPhase = this.currentPhase;
    this.phaseIndex = this.phases.indexOf(phase);
    this.currentPhase = phase;
    this.phaseTimer = 0;
    this.isTransitioning = true;
    this.transitionTimer = 0;

    this.eventBus.emit('phase-changed', {
      phase: this.currentPhase,
      previousPhase: this.previousPhase,
      modifiers: this.getModifiers(),
      forced: true
    });
  }

  /**
   * Get modifiers for the current phase.
   */
  getModifiers() {
    return { ...this.phaseModifiers[this.currentPhase] };
  }

  /**
   * Get a spell's damage multiplier for a specific phase bonus.
   */
  getSpellPhaseMultiplier(spellPhaseBonus) {
    if (!spellPhaseBonus) return 1.0;
    if (spellPhaseBonus.phase === this.currentPhase) {
      return spellPhaseBonus.multiplier;
    }
    return 1.0;
  }

  /**
   * Get the enemy vulnerability multiplier for the current phase.
   */
  getEnemyVulnerability(enemyPhaseVulnerability) {
    if (!enemyPhaseVulnerability) return 1.0;
    return enemyPhaseVulnerability[this.currentPhase] || 1.0;
  }

  /**
   * Get the effective Sap cost for a spell during the current phase.
   */
  getEffectiveSapCost(baseCost) {
    return Math.round(baseCost * this.phaseModifiers[this.currentPhase].sapCostMultiplier);
  }

  // ─── Sap Pool Management ──────────────────────────────────────────

  /**
   * Spend Sap from the Deep Sap Pool.
   * Returns true if the player had enough Sap.
   */
  spendSap(amount) {
    const effectiveCost = this.getEffectiveSapCost(amount);
    if (this.deepSapPool < effectiveCost) return false;
    this.deepSapPool -= effectiveCost;
    this.eventBus.emit('sap-changed', {
      current: this.deepSapPool,
      max: this.deepSapPoolMax,
      spent: effectiveCost
    });
    return true;
  }

  /**
   * Regenerate Sap.
   */
  regenSap(amount) {
    const prev = this.deepSapPool;
    this.deepSapPool = Math.min(this.deepSapPool + amount, this.deepSapPoolMax);
    if (this.deepSapPool !== prev) {
      this.eventBus.emit('sap-changed', {
        current: this.deepSapPool,
        max: this.deepSapPoolMax,
        regenerated: this.deepSapPool - prev
      });
    }
  }

  /**
   * Get current phase progress (0-1).
   */
  getPhaseProgress() {
    return this.phaseTimer / this.phaseDuration;
  }

  /**
   * Get time remaining in current phase (seconds).
   */
  getTimeRemaining() {
    return Math.max(0, this.phaseDuration - this.phaseTimer);
  }

  /**
   * Get full status snapshot.
   */
  getStatus() {
    return {
      phase: this.currentPhase,
      previousPhase: this.previousPhase,
      phaseProgress: this.getPhaseProgress(),
      timeRemaining: this.getTimeRemaining(),
      isTransitioning: this.isTransitioning,
      transitionProgress: this.transitionProgress,
      deepSapPool: this.deepSapPool,
      deepSapPoolMax: this.deepSapPoolMax,
      modifiers: this.getModifiers(),
      totalCycles: this.totalCycles
    };
  }
}

export default SapCycleManager;
