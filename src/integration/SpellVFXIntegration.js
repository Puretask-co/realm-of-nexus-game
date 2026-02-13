import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * SpellVFXIntegration — Bridges SpellSystem with Particle + Lighting systems.
 *
 * When a spell is cast, this module:
 *  1. Reads the spell's vfx config from data
 *  2. Spawns the correct particle preset at cast origin
 *  3. Creates a temporary light at the impact point
 *  4. Plays a trail effect if the spell is a projectile
 *  5. Triggers screen-shake via the camera system
 *
 * All coordination is done through EventBus — this module has no
 * direct references to scene objects.
 */
export default class SpellVFXIntegration {
    constructor() {
        this.particleSystem = null;
        this.lightingSystem = null;
        this.cameraSystem = null;
        this.activeLights = [];

        this._unsubs = [
            EventBus.on('spell-cast', (data) => this._onSpellCast(data)),
            EventBus.on('spell-impact', (data) => this._onSpellImpact(data)),
            EventBus.on('spell-projectile-move', (data) => this._onProjectileMove(data))
        ];
    }

    /**
     * Connect to live system instances (called once from GameScene.create).
     */
    bind(particleSystem, lightingSystem, cameraSystem) {
        this.particleSystem = particleSystem;
        this.lightingSystem = lightingSystem;
        this.cameraSystem = cameraSystem;
    }

    // ----------------------------------------------------------------
    // Spell cast — origin effects
    // ----------------------------------------------------------------

    _onSpellCast(data) {
        const { spell, caster } = data;
        if (!spell || !caster) return;

        const vfx = spell.vfx || {};

        // Cast particle burst at caster position
        if (vfx.castParticle && this.particleSystem) {
            this.particleSystem.burst(
                caster.x,
                caster.y,
                vfx.castParticle,
                { count: vfx.castParticleCount || 12 }
            );
        }

        // Cast flash light
        if (this.lightingSystem) {
            const light = this.lightingSystem.addLight(caster.x, caster.y, {
                type: 'point',
                color: this._elementToColor(spell.element),
                intensity: 1.5,
                radius: 80,
                duration: 300
            });
            this._scheduleLightRemoval(light, 300);
        }

        // Camera shake based on spell tier
        if (this.cameraSystem) {
            const shakeIntensity = spell.tier >= 3 ? 'medium' : 'light';
            this.cameraSystem.shake(shakeIntensity);
        }
    }

    // ----------------------------------------------------------------
    // Spell impact — target effects
    // ----------------------------------------------------------------

    _onSpellImpact(data) {
        const { spell, target, damage } = data;
        if (!spell || !target) return;

        const vfx = spell.vfx || {};

        // Impact particle burst
        if (vfx.impactParticle && this.particleSystem) {
            this.particleSystem.burst(
                target.x,
                target.y,
                vfx.impactParticle,
                { count: vfx.impactParticleCount || 20 }
            );
        }

        // Impact light flash
        if (this.lightingSystem) {
            const light = this.lightingSystem.addLight(target.x, target.y, {
                type: 'point',
                color: this._elementToColor(spell.element),
                intensity: 2.0,
                radius: 120,
                duration: 200
            });
            this._scheduleLightRemoval(light, 200);
        }

        // Bigger shake for big hits
        if (this.cameraSystem && damage > 50) {
            this.cameraSystem.shake('heavy');
        }

        // Emit damage number event for the renderer
        EventBus.emit('damage-number', {
            x: target.x,
            y: target.y - 20,
            value: damage,
            element: spell.element,
            isCrit: data.isCrit || false
        });
    }

    // ----------------------------------------------------------------
    // Projectile trail
    // ----------------------------------------------------------------

    _onProjectileMove(data) {
        const { spell, x, y } = data;
        if (!spell || !this.particleSystem) return;

        const vfx = spell.vfx || {};
        if (vfx.trailParticle) {
            this.particleSystem.burst(x, y, vfx.trailParticle, {
                count: 2,
                spread: 0.3
            });
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _elementToColor(element) {
        const map = {
            arcane: 0x4488ff,
            fire: 0xff6622,
            nature: 0x44ff66,
            shadow: 0x8844cc,
            light: 0xffdd44,
            ice: 0x88ddff
        };
        return map[element] || 0xffffff;
    }

    _scheduleLightRemoval(light, duration) {
        if (!light || !this.lightingSystem) return;
        this.activeLights.push(light);

        setTimeout(() => {
            this.lightingSystem.removeLight(light);
            const idx = this.activeLights.indexOf(light);
            if (idx !== -1) this.activeLights.splice(idx, 1);
        }, duration);
    }

    shutdown() {
        this._unsubs.forEach((fn) => fn());
        this.activeLights.forEach((l) => {
            if (this.lightingSystem) this.lightingSystem.removeLight(l);
        });
        this.activeLights = [];
    }
}
