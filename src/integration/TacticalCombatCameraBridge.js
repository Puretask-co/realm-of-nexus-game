import { EventBus } from '../core/EventBus.js';

/**
 * Bridges TacticalCombatSystem EventBus events to AdvancedCameraSystem.
 *
 * CombatCameraIntegration expects APIs (setController, setSlowMotion, …) that
 * AdvancedCameraSystem does not implement; this bridge only uses shake + zoom
 * helpers that exist today.
 */
export default class TacticalCombatCameraBridge {
    /**
     * @param {import('../systems/AdvancedCameraSystem.js').default} cameraSystem
     */
    constructor(cameraSystem) {
        this.cameraSystem = cameraSystem;
        this.eventBus = EventBus.getInstance();
        this._unsubs = [
            this.eventBus.on('tactical:attacked', (d) => this._onAttacked(d)),
            this.eventBus.on('tactical:spellCast', () => this._onSpellCast()),
            this.eventBus.on('tactical:combatStarted', () => this._onCombatStarted()),
            this.eventBus.on('tactical:combatEnded', () => this._onCombatEnded())
        ];
    }

    _onAttacked(data) {
        if (!this.cameraSystem || !data) return;
        const dmg = data.damage || 0;
        const preset = dmg >= 45 ? 'heavy' : dmg >= 18 ? 'medium' : 'light';
        this.cameraSystem.shake(preset);
    }

    _onSpellCast() {
        if (this.cameraSystem) this.cameraSystem.shake('spell');
    }

    _onCombatStarted() {
        if (this.cameraSystem?.transitionZoom) {
            this.cameraSystem.transitionZoom(1.06, 450);
        }
    }

    _onCombatEnded() {
        if (this.cameraSystem?.transitionZoom) {
            this.cameraSystem.transitionZoom(1.0, 500);
        }
    }

    destroy() {
        this._unsubs.forEach((fn) => { if (typeof fn === 'function') fn(); });
        this._unsubs = [];
    }
}
