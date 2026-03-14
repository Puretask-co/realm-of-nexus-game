import EventBus from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * Manages the Sap Cycle -- the core temporal magic system of Verdance.
 *
 * The world cycles through three phases:
 *   blue    -> crimson -> silver -> blue -> ...
 *
 * Each phase lasts a configurable number of seconds (default 180).
 * During transitions the phase modifier blends smoothly so there is
 * no hard jump in spell effectiveness.
 *
 * All spells carry per-phase modifiers (see spells.json) so the
 * player must plan around the current (and upcoming) phase.
 *
 * Events emitted:
 *   'phase-changed'     (newPhase, oldPhase)
 *   'phase-transition'  (progress 0..1, fromPhase, toPhase)
 *   'sap-cycle-tick'    (currentPhase, phaseProgress)
 */
export default class SapCycleManager {
    constructor(scene) {
        this.scene = scene;

        // Read durations from external config (hot-reloadable)
        const cycleConfig = dataManager.getConfig('balance.sapCycle') || {};
        this.phases = cycleConfig.phases || ['blue', 'crimson', 'silver'];
        this.phaseDuration = (cycleConfig.phaseDurationSeconds || 180) * 1000;
        this.transitionDuration = (cycleConfig.transitionDurationSeconds || 5) * 1000;

        // State
        this.currentPhaseIndex = 0;
        this.currentPhase = this.phases[0];
        this.phaseTimer = 0;           // ms elapsed in current phase
        this.transitioning = false;
        this.transitionTimer = 0;

        // Respond to data reloads so durations update in real-time
        EventBus.on('data-reloaded', () => {
            const cfg = dataManager.getConfig('balance.sapCycle') || {};
            this.phaseDuration = (cfg.phaseDurationSeconds || 180) * 1000;
            this.transitionDuration = (cfg.transitionDurationSeconds || 5) * 1000;
        });
    }

    /**
     * Call each frame with the Phaser delta (ms).
     */
    update(delta) {
        if (this.transitioning) {
            this.transitionTimer += delta;
            const progress = Math.min(this.transitionTimer / this.transitionDuration, 1);

            EventBus.emit(
                'phase-transition',
                progress,
                this.currentPhase,
                this.nextPhase
            );

            if (progress >= 1) {
                this.transitioning = false;
                this.transitionTimer = 0;
                this.advancePhase();
            }
            return;
        }

        this.phaseTimer += delta;

        // Emit progress tick every frame
        const phaseProgress = this.phaseTimer / this.phaseDuration;
        EventBus.emit('sap-cycle-tick', this.currentPhase, phaseProgress);

        if (this.phaseTimer >= this.phaseDuration) {
            // Start transitioning to next phase
            this.transitioning = true;
            this.transitionTimer = 0;
            this.nextPhase = this.phases[(this.currentPhaseIndex + 1) % this.phases.length];
        }
    }

    advancePhase() {
        const oldPhase = this.currentPhase;
        this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phases.length;
        this.currentPhase = this.phases[this.currentPhaseIndex];
        this.phaseTimer = 0;

        EventBus.emit('phase-changed', this.currentPhase, oldPhase);
        console.log(`[SapCycle] Phase changed: ${oldPhase} -> ${this.currentPhase}`);
    }

    /**
     * Get the modifier a spell receives in the current phase.
     */
    getPhaseModifier(spell) {
        return spell.phaseModifiers?.[this.currentPhase] ?? 1.0;
    }

    /**
     * Get the blended modifier during a transition (0-1 blend between phases).
     */
    getBlendedModifier(spell) {
        if (!this.transitioning) return this.getPhaseModifier(spell);

        const fromMod = spell.phaseModifiers?.[this.currentPhase] ?? 1.0;
        const toMod = spell.phaseModifiers?.[this.nextPhase] ?? 1.0;
        const t = this.transitionTimer / this.transitionDuration;
        return fromMod + (toMod - fromMod) * t;
    }

    /**
     * Get progress through the current phase (0..1).
     */
    getPhaseProgress() {
        return this.phaseTimer / this.phaseDuration;
    }

    /**
     * Force-set the phase (for testing / editor).
     */
    setPhase(phaseName) {
        const idx = this.phases.indexOf(phaseName);
        if (idx === -1) {
            console.warn(`[SapCycle] Unknown phase: ${phaseName}`);
            return;
        }
        const old = this.currentPhase;
        this.currentPhaseIndex = idx;
        this.currentPhase = phaseName;
        this.phaseTimer = 0;
        this.transitioning = false;
        EventBus.emit('phase-changed', this.currentPhase, old);
    }
}
