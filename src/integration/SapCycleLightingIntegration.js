/**
 * SapCycleLightingIntegration
 *
 * Connects the SapCycleManager phase transitions to the AdvancedLightingSystem
 * so that the world's ambient light, fog colour, and spell light tints all
 * shift smoothly when the Sap Cycle changes phase.
 */

import LIGHTING_PRESETS from '../configs/lightingPresets.js';

class SapCycleLightingIntegration {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/AdvancedLightingSystem.js').default} lightingSystem
   * @param {import('../systems/SapCycleManager.js').default} sapCycleManager
   */
  constructor(scene, lightingSystem, sapCycleManager) {
    this.scene = scene;
    this.lightingSystem = lightingSystem;
    this.sapCycleManager = sapCycleManager;

    this.phasePresets = LIGHTING_PRESETS.sapPhases;

    // Listen for phase changes via global EventBus
    if (window.EventBus) {
      window.EventBus.on('phase-changed', (newPhase) => {
        this._onPhaseChanged(newPhase);
      });
    }

    // Apply initial phase
    this._applyPhaseInstant(sapCycleManager.getCurrentPhase());
  }

  // ------------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------------

  _onPhaseChanged(newPhase) {
    this._transitionToPhase(newPhase, 3000);
  }

  // ------------------------------------------------------------------
  // Transitions
  // ------------------------------------------------------------------

  _transitionToPhase(phase, duration) {
    const preset = this.phasePresets[phase];
    if (!preset) return;

    const current = this.lightingSystem.config.ambientLight;

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      onUpdate: (tween) => {
        const t = tween.getValue();
        const newColor = this._lerpColor(current.color, preset.ambient.color, t);
        const newIntensity = Phaser.Math.Linear(current.intensity, preset.ambient.intensity, t);
        this.lightingSystem.setAmbientLight(newColor, newIntensity);
      }
    });
  }

  _applyPhaseInstant(phase) {
    const preset = this.phasePresets[phase];
    if (preset) {
      this.lightingSystem.setAmbientLight(preset.ambient.color, preset.ambient.intensity);
    }
  }

  // ------------------------------------------------------------------
  // Spell light helpers
  // ------------------------------------------------------------------

  /**
   * Create a temporary light that travels from caster to target,
   * tinted by the current Sap phase.
   */
  createSpellLight(spell, caster, target) {
    const config = this._getSpellLightConfig(spell);
    const light = this.lightingSystem.addLight(caster.x, caster.y, config);
    if (!light) return null;

    light._isSpellLight = true;
    light._originalColor = config.color;

    this.scene.tweens.add({
      targets: light,
      x: target.x,
      y: target.y,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Flash on impact
        this.scene.tweens.add({
          targets: light,
          intensity: light.intensity * 2,
          duration: 80,
          yoyo: true,
          onComplete: () => this.lightingSystem.removeLight(light)
        });
      }
    });

    return light;
  }

  _getSpellLightConfig(spell) {
    const base = {
      type: 'point',
      radius: 80,
      intensity: 1.2,
      castShadows: false,
      volumetric: true,
      volumetricDensity: 0.3
    };

    const elementColors = {
      nature: 0x44ff88,
      arcane: 0x4488ff,
      shadow: 0x8844ff,
      radiant: 0xffffaa,
      fire: 0xff4400,
      ice: 0x88ccff
    };

    base.color = elementColors[spell.element] || 0xffffff;
    return base;
  }

  // ------------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------------

  _lerpColor(colorA, colorB, t) {
    const a = Phaser.Display.Color.IntegerToColor(colorA);
    const b = Phaser.Display.Color.IntegerToColor(colorB);
    const interp = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);
    return Phaser.Display.Color.GetColor(interp.r, interp.g, interp.b);
  }
}

export default SapCycleLightingIntegration;
