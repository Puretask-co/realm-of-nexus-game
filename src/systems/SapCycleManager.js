/**
 * SapCycleManager.js
 *
 * Manages the Sap Cycle -- the core temporal-magic system of Realm of Nexus.
 * The game world continuously cycles through three elemental phases:
 *
 *   1. **Blue**    - Water / ice magic is amplified; fire magic is weakened.
 *   2. **Crimson** - Fire / blood magic is amplified; nature magic is weakened.
 *   3. **Silver**  - Arcane / wind magic is amplified; water magic is weakened.
 *
 * Each phase lasts a configurable duration (default 180 s).  When the phase
 * advances the system emits events via the Phaser EventEmitter so that other
 * systems (UI, VFX, AI) can react.
 *
 * @module SapCycleManager
 */

import EventBus from '../events/EventBus.js';

export default class SapCycleManager {
  /**
   * Creates a new SapCycleManager.
   *
   * Configuration values are read from the scene's DataManager (if present)
   * under the keys `sapCyclePhaseDuration` and `sapCycleTransitionDuration`.
   *
   * @param {Phaser.Scene} scene - The owning Phaser scene.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    // ---- Phase definitions ----

    /**
     * Ordered list of phase names.
     * @type {string[]}
     */
    this.phases = ['blue', 'crimson', 'silver'];

    /**
     * Index into `this.phases` for the active phase.
     * @type {number}
     */
    this.currentPhaseIndex = 0;

    /**
     * Name of the currently active phase.
     * @type {string}
     */
    this.currentPhase = this.phases[this.currentPhaseIndex];

    // ---- Timing ----

    /**
     * How long each phase lasts, in milliseconds.
     * Loaded from DataManager key `sapCyclePhaseDuration`; defaults to 180 000 ms (180 s).
     * @type {number}
     */
    this.phaseDuration =
      (scene.data && scene.data.get('sapCyclePhaseDuration')) || 180000;

    /**
     * Duration of the visual / gameplay transition between phases (ms).
     * Loaded from DataManager key `sapCycleTransitionDuration`; defaults to 3 000 ms.
     * @type {number}
     */
    this.transitionDuration =
      (scene.data && scene.data.get('sapCycleTransitionDuration')) || 3000;

    /**
     * Accumulated time (ms) spent in the current phase.
     * @type {number}
     */
    this.phaseTimer = 0;

    // ---- Phase colour look-up ----

    /**
     * Maps each phase name to a representative hex colour.
     * @type {Object<string, number>}
     */
    this.phaseColors = {
      blue: 0x3366bb,
      crimson: 0xbb3344,
      silver: 0xccccdd,
    };

    // ---- Spell-element modifier tables ----

    /**
     * Modifier look-up keyed by phase, then by spell element.
     * A value > 1 means the element is *stronger* in that phase;
     * a value < 1 means it is *weaker*.
     *
     * @type {Object<string, Object<string, number>>}
     */
    this.phaseModifiers = {
      blue: {
        water: 1.5,
        ice: 1.4,
        fire: 0.6,
        nature: 1.0,
        arcane: 1.0,
        wind: 0.9,
        blood: 0.9,
      },
      crimson: {
        water: 0.9,
        ice: 0.8,
        fire: 1.5,
        nature: 0.6,
        arcane: 1.0,
        wind: 1.0,
        blood: 1.4,
      },
      silver: {
        water: 0.6,
        ice: 0.9,
        fire: 1.0,
        nature: 1.0,
        arcane: 1.5,
        wind: 1.4,
        blood: 0.9,
      },
    };

    /**
     * Local event emitter for phase-change listeners that prefer not to
     * use the global EventBus.
     * @type {Phaser.Events.EventEmitter}
     */
    this.events = new Phaser.Events.EventEmitter();
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Advances the phase timer by the frame delta.  When the timer exceeds
   * `phaseDuration` the cycle moves to the next phase.
   *
   * Should be called every frame from the scene's `update` method.
   *
   * @param {number} delta - Frame delta in milliseconds.
   */
  update(delta) {
    this.phaseTimer += delta;

    if (this.phaseTimer >= this.phaseDuration) {
      this.advancePhase();
    }
  }

  // ---------------------------------------------------------------------------
  // Phase advancement
  // ---------------------------------------------------------------------------

  /**
   * Advances the Sap Cycle to the next phase.  Emits transition events on
   * both the local `this.events` emitter and the global `EventBus`:
   *
   * 1. `phase-transition-start` (with the *upcoming* phase name)
   * 2. Phase index & name are updated.
   * 3. `phase-changed`          (with the *new* phase name)
   * 4. `phase-transition-end`   (with the *new* phase name)
   */
  advancePhase() {
    // Calculate the next phase index, wrapping around.
    const nextIndex = (this.currentPhaseIndex + 1) % this.phases.length;
    const nextPhase = this.phases[nextIndex];

    // --- Pre-transition event ---
    this.events.emit('phase-transition-start', nextPhase);
    EventBus.emit('phase-transition-start', nextPhase);

    // --- Apply the change ---
    this.currentPhaseIndex = nextIndex;
    this.currentPhase = nextPhase;
    this.phaseTimer = 0;

    // --- Post-transition events ---
    this.events.emit('phase-changed', this.currentPhase);
    EventBus.emit('phase-changed', this.currentPhase);

    this.events.emit('phase-transition-end', this.currentPhase);
    EventBus.emit('phase-transition-end', this.currentPhase);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /**
   * Returns a multiplicative modifier for a given spell element based on the
   * current Sap Cycle phase.
   *
   * If the element is not listed in the modifier table, `1.0` (neutral) is
   * returned.
   *
   * @param {string} spellElement - The elemental type of the spell
   *   (e.g. `'fire'`, `'water'`, `'arcane'`).
   * @returns {number} A multiplier (e.g. `1.5` = 50 % stronger).
   */
  getPhaseModifier(spellElement) {
    const modifiers = this.phaseModifiers[this.currentPhase];
    if (!modifiers) return 1.0;
    return modifiers[spellElement] ?? 1.0;
  }

  /**
   * Returns the progress through the current phase as a normalised value
   * between `0` (phase just started) and `1` (phase about to end).
   *
   * @returns {number} Phase progress in the range [0, 1].
   */
  getPhaseProgress() {
    return Math.min(this.phaseTimer / this.phaseDuration, 1);
  }

  /**
   * Returns the name of the active phase.
   *
   * @returns {string} `'blue'`, `'crimson'`, or `'silver'`.
   */
  getCurrentPhase() {
    return this.currentPhase;
  }

  /**
   * Returns the representative hex colour for the active phase.
   *
   * @returns {number} A 24-bit hex colour (e.g. `0x3366bb`).
   */
  getPhaseColor() {
    return this.phaseColors[this.currentPhase];
  }
}
