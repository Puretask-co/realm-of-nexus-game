import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * CombatSystem — Handles all damage calculations, resistances,
 * phase modifiers, and combat event orchestration.
 *
 * Flow:
 *  1. Receives 'combat-action' events from AI or player input.
 *  2. Resolves the attack: base damage * phase modifier * resistance * crit.
 *  3. Applies the result to the target's HP.
 *  4. Emits 'spell-impact', 'enemy-defeated', 'player-damaged' for
 *     other systems (VFX, UI, progression) to react.
 *
 * All formulas read from config.json so they can be hot-tuned.
 */
export default class CombatSystem {
    constructor(sapCycleManager) {
        this.sapCycle = sapCycleManager;

        this._unsubs = [
            EventBus.on('combat-action', (data) => this._resolveAction(data))
        ];
    }

    // ----------------------------------------------------------------
    // Resolve a combat action
    // ----------------------------------------------------------------

    _resolveAction(data) {
        const { attacker, target, spell } = data;
        if (!attacker || !target || !spell) return;

        // Base damage
        let damage = spell.baseDamage || 0;

        // Phase modifier
        const phaseModifier = this.sapCycle
            ? this.sapCycle.getBlendedModifier(spell)
            : 1.0;
        damage *= phaseModifier;

        // Elemental resistance
        const resistance = this._getResistance(target, spell.element);
        damage *= (1 - resistance);

        // Critical hit
        const critChance = dataManager.getConfig('balance.combat.critChance') || 0.1;
        const critMultiplier = dataManager.getConfig('balance.combat.critMultiplier') || 1.5;
        const isCrit = Math.random() < critChance;
        if (isCrit) {
            damage *= critMultiplier;
        }

        // Defense reduction
        const defense = target.data?.definition?.baseStats?.defense || target.stats?.defense || 0;
        const defenseReduction = defense / (defense + 100); // diminishing returns
        damage *= (1 - defenseReduction);

        // Floor
        damage = Math.max(1, Math.round(damage));

        // Apply damage
        if (target.data) {
            // Enemy target
            target.data.hp = Math.max(0, target.data.hp - damage);
        } else if (target.stats) {
            // Player target
            target.stats.hp = Math.max(0, target.stats.hp - damage);
            EventBus.emit('player-stats-updated', target.stats);
        }

        // Emit impact
        EventBus.emit('spell-impact', {
            spell,
            attacker,
            target,
            damage,
            isCrit,
            phaseModifier,
            resistance
        });

        // Check defeat
        const currentHp = target.data ? target.data.hp : (target.stats?.hp ?? 1);
        if (currentHp <= 0) {
            if (target.data) {
                EventBus.emit('enemy-defeated', { enemy: target, spell, killer: attacker });
            } else {
                EventBus.emit('player-defeated', { player: target });
            }
        }

        return { damage, isCrit, phaseModifier, resistance };
    }

    // ----------------------------------------------------------------
    // Resistance lookup
    // ----------------------------------------------------------------

    _getResistance(target, element) {
        if (!element) return 0;
        const resistances = target.data?.definition?.resistances || target.stats?.resistances || {};
        return resistances[element] || 0;
    }

    // ----------------------------------------------------------------
    // Utility: calculate damage preview (no side effects)
    // ----------------------------------------------------------------

    previewDamage(attacker, target, spell) {
        let damage = spell.baseDamage || 0;

        const phaseModifier = this.sapCycle
            ? this.sapCycle.getBlendedModifier(spell)
            : 1.0;
        damage *= phaseModifier;

        const resistance = this._getResistance(target, spell.element);
        damage *= (1 - resistance);

        const defense = target.data?.definition?.baseStats?.defense || target.stats?.defense || 0;
        damage *= (1 - defense / (defense + 100));

        return {
            minDamage: Math.max(1, Math.round(damage)),
            maxDamage: Math.max(1, Math.round(damage * (dataManager.getConfig('balance.combat.critMultiplier') || 1.5))),
            phaseModifier,
            resistance
        };
    }

    shutdown() {
        this._unsubs.forEach((fn) => fn());
    }
}
