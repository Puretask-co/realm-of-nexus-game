import EventBus from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * SapCycleManager — 15-day in-game calendar affecting gameplay.
 *
 * The world cycles through three phases over 15 in-game days:
 *   Crimson (5 days) → Silver (3 days) → Blue (7 days) → repeat
 *
 * Each phase has modifiers affecting:
 *   - Combat difficulty and damage
 *   - Magic costs (DSP)
 *   - Healing effectiveness
 *   - Shop prices
 *   - Loot rates
 *   - Corruption saves
 *   - Crafting success
 *   - Diplomacy checks
 *
 * In-game time: 1 real minute = 1 in-game hour (configurable).
 * One full day = 24 real minutes by default.
 *
 * Events emitted:
 *   'phase-changed'     (newPhase, oldPhase)
 *   'phase-transition'  (progress 0..1, fromPhase, toPhase)
 *   'sap-cycle-tick'    (currentPhase, phaseProgress)
 *   'sap-day-passed'    ({ day, phase, dayInPhase })
 *   'sap-hour-passed'   ({ hour, day, phase })
 */
export default class SapCycleManager {
    constructor(scene) {
        this.scene = scene;

        // Read config from data
        const cycleConfig = dataManager.getConfig('balance.sapCycle') || {};
        this.totalDays = cycleConfig.totalDays || 15;

        // Phase definitions from config
        this.phaseDefinitions = (cycleConfig.phases || [
            { name: 'Crimson', durationDays: 5, order: 1, modifiers: {} },
            { name: 'Silver', durationDays: 3, order: 2, modifiers: {} },
            { name: 'Blue', durationDays: 7, order: 3, modifiers: {} }
        ]).sort((a, b) => a.order - b.order);

        // Time settings
        this.realMsPerGameHour = 60000; // 1 real minute = 1 game hour
        this.hoursPerDay = 24;
        this.realMsPerGameDay = this.realMsPerGameHour * this.hoursPerDay;

        // Transition settings
        this.transitionDuration = 5000; // 5 seconds for visual transition

        // State
        this.currentDay = 1;         // 1-based day within the cycle
        this.currentHour = 8;        // Start at 8 AM
        this.currentPhaseIndex = 0;
        this.currentPhase = this.phaseDefinitions[0]?.name?.toLowerCase() || 'crimson';
        this.dayInPhase = 1;         // Day within current phase
        this.elapsed = 0;            // Total elapsed ms

        // Timer accumulators
        this._hourAccum = 0;
        this._transitionTimer = 0;
        this.transitioning = false;
        this.nextPhase = null;

        // Compute phase day ranges
        this._computePhaseDayRanges();

        // Respond to data reloads
        EventBus.on('data-reloaded', () => {
            const cfg = dataManager.getConfig('balance.sapCycle') || {};
            if (cfg.phases) {
                this.phaseDefinitions = cfg.phases.sort((a, b) => a.order - b.order);
                this._computePhaseDayRanges();
            }
        });
    }

    /**
     * Compute which days each phase covers.
     */
    _computePhaseDayRanges() {
        this._phaseDayRanges = [];
        let dayStart = 1;
        for (const phase of this.phaseDefinitions) {
            this._phaseDayRanges.push({
                name: phase.name.toLowerCase(),
                startDay: dayStart,
                endDay: dayStart + phase.durationDays - 1,
                duration: phase.durationDays,
                modifiers: phase.modifiers || {}
            });
            dayStart += phase.durationDays;
        }
    }

    /**
     * Get phase for a given day in the cycle.
     */
    _getPhaseForDay(day) {
        for (const range of this._phaseDayRanges) {
            if (day >= range.startDay && day <= range.endDay) {
                return range;
            }
        }
        return this._phaseDayRanges[0]; // Wrap around fallback
    }

    /**
     * Call each frame with the Phaser delta (ms).
     */
    update(delta) {
        this.elapsed += delta;

        // Handle visual transition
        if (this.transitioning) {
            this._transitionTimer += delta;
            const progress = Math.min(this._transitionTimer / this.transitionDuration, 1);

            EventBus.emit('phase-transition', progress, this.currentPhase, this.nextPhase);

            if (progress >= 1) {
                this.transitioning = false;
                this._transitionTimer = 0;
                this._advanceToPhase(this.nextPhase);
            }
            return;
        }

        // Accumulate time for hour tracking
        this._hourAccum += delta;

        // Check if an hour has passed
        while (this._hourAccum >= this.realMsPerGameHour) {
            this._hourAccum -= this.realMsPerGameHour;
            this._advanceHour();
        }

        // Emit progress tick
        const phaseRange = this._getPhaseForDay(this.currentDay);
        const dayInPhase = this.currentDay - phaseRange.startDay + 1;
        const phaseProgress = (dayInPhase - 1 + this.currentHour / this.hoursPerDay) / phaseRange.duration;

        EventBus.emit('sap-cycle-tick', this.currentPhase, phaseProgress);
    }

    /**
     * Advance one hour.
     */
    _advanceHour() {
        this.currentHour++;

        EventBus.emit('sap-hour-passed', {
            hour: this.currentHour,
            day: this.currentDay,
            phase: this.currentPhase
        });

        // Check if a day has passed
        if (this.currentHour >= this.hoursPerDay) {
            this.currentHour = 0;
            this._advanceDay();
        }
    }

    /**
     * Advance one day.
     */
    _advanceDay() {
        this.currentDay++;
        if (this.currentDay > this.totalDays) {
            this.currentDay = 1; // Wrap around
        }

        // Check phase change
        const newPhaseRange = this._getPhaseForDay(this.currentDay);
        const newPhaseName = newPhaseRange.name;
        this.dayInPhase = this.currentDay - newPhaseRange.startDay + 1;

        if (newPhaseName !== this.currentPhase) {
            // Start visual transition
            this.transitioning = true;
            this._transitionTimer = 0;
            this.nextPhase = newPhaseName;
        }

        EventBus.emit('sap-day-passed', {
            day: this.currentDay,
            phase: this.currentPhase,
            dayInPhase: this.dayInPhase
        });

        console.log(`[SapCycle] Day ${this.currentDay} — ${this.currentPhase} phase (day ${this.dayInPhase})`);
    }

    /**
     * Complete the phase transition.
     */
    _advanceToPhase(newPhase) {
        const oldPhase = this.currentPhase;
        this.currentPhase = newPhase;

        // Update phase index
        this.currentPhaseIndex = this.phaseDefinitions.findIndex(
            p => p.name.toLowerCase() === newPhase
        );

        EventBus.emit('phase-changed', this.currentPhase, oldPhase);
        console.log(`[SapCycle] Phase changed: ${oldPhase} → ${this.currentPhase}`);
    }

    // ─── Modifiers ──────────────────────────────────────────────────

    /**
     * Get all modifiers for the current phase.
     */
    getModifiers() {
        const phaseRange = this._getPhaseForDay(this.currentDay);
        const mods = phaseRange.modifiers || {};

        return {
            // Combat modifiers
            enemyDamageBonus: mods.enemyDamageBonus || 0,
            magicCostBonusDSP: mods.magicCostBonusDSP || 0,
            healingDieStepChange: mods.healingDieStepChange || 0,
            corruptionSaveDCBonus: mods.corruptionSaveDCBonus || 0,

            // Economy modifiers
            shopPriceMultiplier: mods.shopPriceMultiplier || 1.0,
            lootRateMultiplier: mods.lootRateMultiplier || 1.0,

            // Silver-specific
            magicDamageDieStepChange: mods.magicDamageDieStepChange || 0,
            critRange: mods.critRange || [20],
            dspDrainPerDay: mods.dspDrainPerDay || 0,
            rareEnemySpawn: mods.rareEnemySpawn || false,

            // Blue-specific
            allSavesBonus: mods.allSavesBonus || 0,
            dspRegenPerDay: mods.dspRegenPerDay || 0,
            guardRegenPerTurn: mods.guardRegenPerTurn || 0,
            debuffDurationMultiplier: mods.debuffDurationMultiplier || 1.0,
            craftingBonus: mods.craftingBonus || 0,
            diplomacyBonus: mods.diplomacyBonus || 0,

            // Generic
            magicMultiplier: 1.0 + (mods.magicDamageDieStepChange || 0) * 0.15,
            phase: this.currentPhase
        };
    }

    /**
     * Get the modifier a spell receives in the current phase.
     */
    getPhaseModifier(spell) {
        return spell.phaseModifiers?.[this.currentPhase] ?? 1.0;
    }

    /**
     * Get blended modifier during transitions.
     */
    getBlendedModifier(spell) {
        if (!this.transitioning) return this.getPhaseModifier(spell);

        const fromMod = spell.phaseModifiers?.[this.currentPhase] ?? 1.0;
        const toMod = spell.phaseModifiers?.[this.nextPhase] ?? 1.0;
        const t = this._transitionTimer / this.transitionDuration;
        return fromMod + (toMod - fromMod) * t;
    }

    /**
     * Get spell phase multiplier for a specific phase affinity.
     */
    getSpellPhaseMultiplier(phaseAffinity) {
        if (!phaseAffinity) return 1.0;
        if (phaseAffinity === this.currentPhase) return 1.3; // 30% bonus in matching phase
        return 0.9; // 10% penalty in non-matching phase
    }

    /**
     * Get enemy vulnerability multiplier.
     */
    getEnemyVulnerability(vulnerablePhase) {
        if (!vulnerablePhase) return 1.0;
        return vulnerablePhase === this.currentPhase ? 1.5 : 1.0;
    }

    /**
     * Get effective DSP cost for a spell (modified by phase).
     */
    getEffectiveSapCost(baseCost) {
        const mods = this.getModifiers();
        return Math.max(0, baseCost + (mods.magicCostBonusDSP || 0));
    }

    /**
     * Get progress through the current phase (0..1).
     */
    getPhaseProgress() {
        const phaseRange = this._getPhaseForDay(this.currentDay);
        const dayInPhase = this.currentDay - phaseRange.startDay + 1;
        return (dayInPhase - 1 + this.currentHour / this.hoursPerDay) / phaseRange.duration;
    }

    /**
     * Get time of day info.
     */
    getTimeOfDay() {
        const hour = this.currentHour;
        let period = 'night';
        if (hour >= 6 && hour < 12) period = 'morning';
        else if (hour >= 12 && hour < 18) period = 'afternoon';
        else if (hour >= 18 && hour < 22) period = 'evening';

        return {
            hour,
            day: this.currentDay,
            period,
            phase: this.currentPhase,
            dayInPhase: this.dayInPhase,
            formattedTime: `${String(hour).padStart(2, '0')}:00`,
            formattedDate: `Day ${this.currentDay}/${this.totalDays}`
        };
    }

    /**
     * Force-set the phase (for testing / editor).
     */
    setPhase(phaseName) {
        const range = this._phaseDayRanges.find(r => r.name === phaseName.toLowerCase());
        if (!range) {
            console.warn(`[SapCycle] Unknown phase: ${phaseName}`);
            return;
        }
        const old = this.currentPhase;
        this.currentPhase = range.name;
        this.currentDay = range.startDay;
        this.dayInPhase = 1;
        this.currentPhaseIndex = this.phaseDefinitions.findIndex(
            p => p.name.toLowerCase() === range.name
        );
        this.transitioning = false;
        EventBus.emit('phase-changed', this.currentPhase, old);
    }

    /**
     * Force advance to next day (for testing / rest).
     */
    advanceDay() {
        this._advanceDay();
    }

    // ─── Serialization ──────────────────────────────────────────────

    serialize() {
        return {
            currentDay: this.currentDay,
            currentHour: this.currentHour,
            currentPhase: this.currentPhase,
            dayInPhase: this.dayInPhase
        };
    }

    deserialize(data) {
        if (!data) return;
        this.currentDay = data.currentDay || 1;
        this.currentHour = data.currentHour || 8;
        this.currentPhase = data.currentPhase || 'crimson';
        this.dayInPhase = data.dayInPhase || 1;
        this.currentPhaseIndex = this.phaseDefinitions.findIndex(
            p => p.name.toLowerCase() === this.currentPhase
        );
    }
}
