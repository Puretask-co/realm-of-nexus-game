/**
 * SapCycleLightingIntegration - Binds the Sap Cycle phase system to the
 * AdvancedLightingSystem so that world lighting responds dynamically to
 * the current Sap phase.
 *
 * Three Sap phases exist in Verdance:
 *
 *   Blue    - Cool, ethereal glow; soft diffuse shadows; blue-tinted ambient.
 *   Crimson - Warm, aggressive lighting; harsh directional shadows; red-orange ambient.
 *   Silver  - Neutral metallic sheen; crisp, sharp shadows; silver-white ambient.
 *
 * Phase transitions are smoothly interpolated over a configurable duration.
 * Deep Sap Pool proximity triggers additional intensity fluctuations.
 *
 * Listens on:
 *   'sap:phaseChange'   - { newPhase, oldPhase }
 *   'sap:deepPoolNear'  - { intensity }
 *   'sap:deepPoolLeave' - {}
 *
 * Part of the Realm of Nexus / Verdance project.
 */

import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

// ── Phase colour palettes ──────────────────────────────────────────────────────

/**
 * Each phase definition describes the target lighting environment.
 *
 * ambientColor / ambientIntensity  - base ambient light
 * shadowIntensity                  - multiplier on shadow darkness (0 = none, 1 = full)
 * lightTint                        - colour tint applied to all point lights
 * fogColor / fogDensity            - screen fog overlay
 * particleColor                    - colour hint for phase-specific light particles
 * particleAlpha                    - particle base alpha
 * volumetricBoost                  - multiplier for volumetric layer intensity
 */
const PHASE_PROFILES = {
  [GameConfig.SAP_PHASES.BLUE]: {
    ambientColor: 0x0a1a3a,
    ambientIntensity: 0.2,
    shadowIntensity: 0.4,
    lightTint: 0x6699ff,
    fogColor: 0x0d1b2a,
    fogDensity: 0.15,
    particleColor: 0x44aaff,
    particleAlpha: 0.6,
    volumetricBoost: 1.2,
  },
  [GameConfig.SAP_PHASES.CRIMSON]: {
    ambientColor: 0x3a0a0a,
    ambientIntensity: 0.18,
    shadowIntensity: 0.75,
    lightTint: 0xff6633,
    fogColor: 0x2a0d0d,
    fogDensity: 0.1,
    particleColor: 0xff4422,
    particleAlpha: 0.7,
    volumetricBoost: 1.5,
  },
  [GameConfig.SAP_PHASES.SILVER]: {
    ambientColor: 0x2a2a35,
    ambientIntensity: 0.25,
    shadowIntensity: 0.6,
    lightTint: 0xccccee,
    fogColor: 0x1e1e28,
    fogDensity: 0.08,
    particleColor: 0xddddff,
    particleAlpha: 0.5,
    volumetricBoost: 1.0,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert 0xRRGGBB to { r, g, b } normalised 0..1. */
function hexToNorm(hex) {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

/** Normalised { r, g, b } back to 0xRRGGBB integer. */
function normToHex(c) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return (r << 16) | (g << 8) | b;
}

/** Lerp between two normalised colours. */
function lerpColor(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Scalar lerp. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smooth-step easing (cubic Hermite). */
function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// ── Main class ─────────────────────────────────────────────────────────────────

export class SapCycleLightingIntegration {
  /**
   * @param {import('../systems/AdvancedLightingSystem.js').AdvancedLightingSystem} lightingSystem
   */
  constructor(lightingSystem) {
    this.lighting = lightingSystem;
    this.eventBus = EventBus.getInstance();

    // ── Phase state ──────────────────────────────────────────────────────────
    this.currentPhase = GameConfig.SAP_PHASES.BLUE;
    this.previousPhase = null;
    this.currentProfile = { ...PHASE_PROFILES[this.currentPhase] };

    // ── Transition state ─────────────────────────────────────────────────────
    this.transitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 3000; // ms
    this._transitionFrom = null;
    this._transitionTo = null;
    this._transitionElapsed = 0;

    // ── Deep Sap Pool state ──────────────────────────────────────────────────
    this._deepPoolActive = false;
    this._deepPoolIntensity = 0;
    this._deepPoolTime = 0;

    // ── Phase particle lights ────────────────────────────────────────────────
    /** IDs of ephemeral lights created for phase atmosphere. */
    this._phaseLightIds = [];
    this._maxPhaseLights = 6;

    // ── Event subscriptions ──────────────────────────────────────────────────
    this._unsubPhaseChange = this.eventBus.on(
      'sap:phaseChange',
      (data) => this.onPhaseChange(data.newPhase, data.oldPhase),
    );
    this._unsubDeepPoolNear = this.eventBus.on(
      'sap:deepPoolNear',
      (data) => this._onDeepPoolNear(data),
    );
    this._unsubDeepPoolLeave = this.eventBus.on(
      'sap:deepPoolLeave',
      () => this._onDeepPoolLeave(),
    );

    // Apply initial phase immediately (no transition)
    this.applyPhaseEffects(this.currentPhase);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE CHANGE
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Called when the Sap Cycle transitions to a new phase.
   *
   * @param {string} newPhase - One of GameConfig.SAP_PHASES values.
   * @param {string} oldPhase - The phase we are leaving.
   */
  onPhaseChange(newPhase, oldPhase) {
    if (newPhase === this.currentPhase) return;
    if (!PHASE_PROFILES[newPhase]) {
      console.warn(`[SapCycleLighting] Unknown phase "${newPhase}"`);
      return;
    }

    this.previousPhase = oldPhase || this.currentPhase;
    this.currentPhase = newPhase;

    // Begin smooth transition
    this._transitionFrom = { ...this._resolveProfile(this.previousPhase) };
    this._transitionTo = { ...PHASE_PROFILES[newPhase] };
    this.transitioning = true;
    this.transitionProgress = 0;
    this._transitionElapsed = 0;

    this.eventBus.emit('lighting:phaseTransitionStart', {
      from: this.previousPhase,
      to: newPhase,
      duration: this.transitionDuration,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  UPDATE (call each frame from the scene update)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Tick the integration forward.
   * @param {number} time  - Total elapsed ms.
   * @param {number} delta - Frame delta ms.
   */
  update(time, delta) {
    // ── Phase transition ─────────────────────────────────────────────────────
    if (this.transitioning) {
      this._transitionElapsed += delta;
      this.transitionProgress = Math.min(
        1,
        this._transitionElapsed / this.transitionDuration,
      );
      this.updateTransition(this.transitionProgress);

      if (this.transitionProgress >= 1) {
        this.transitioning = false;
        this.applyPhaseEffects(this.currentPhase);
        this.eventBus.emit('lighting:phaseTransitionEnd', {
          phase: this.currentPhase,
        });
      }
    }

    // ── Deep Sap Pool fluctuation ────────────────────────────────────────────
    if (this._deepPoolActive) {
      this._deepPoolTime += delta;
      this._applyDeepPoolFluctuation(time);
    }

    // ── Phase particle lights ────────────────────────────────────────────────
    this._updatePhaseLights(time, delta);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TRANSITION INTERPOLATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Interpolate all lighting parameters between the "from" and "to" phase
   * profiles at the given normalised progress (0..1).
   *
   * @param {number} progress - 0 = fully "from", 1 = fully "to".
   */
  updateTransition(progress) {
    const t = smoothstep(progress);
    const from = this._transitionFrom;
    const to = this._transitionTo;

    if (!from || !to) return;

    // Ambient
    const ambientFrom = hexToNorm(from.ambientColor);
    const ambientTo = hexToNorm(to.ambientColor);
    const ambientLerped = lerpColor(ambientFrom, ambientTo, t);
    const ambientIntensity = lerp(from.ambientIntensity, to.ambientIntensity, t);
    this.lighting.setAmbient(normToHex(ambientLerped), ambientIntensity);

    // Update current profile snapshot for other consumers
    this.currentProfile = {
      ambientColor: normToHex(ambientLerped),
      ambientIntensity,
      shadowIntensity: lerp(from.shadowIntensity, to.shadowIntensity, t),
      lightTint: normToHex(lerpColor(hexToNorm(from.lightTint), hexToNorm(to.lightTint), t)),
      fogColor: normToHex(lerpColor(hexToNorm(from.fogColor), hexToNorm(to.fogColor), t)),
      fogDensity: lerp(from.fogDensity, to.fogDensity, t),
      particleColor: normToHex(
        lerpColor(hexToNorm(from.particleColor), hexToNorm(to.particleColor), t),
      ),
      particleAlpha: lerp(from.particleAlpha, to.particleAlpha, t),
      volumetricBoost: lerp(from.volumetricBoost, to.volumetricBoost, t),
    };

    // Emit for other systems (e.g. particle manager, post-processing)
    this.eventBus.emit('lighting:phaseTransitionProgress', {
      progress: t,
      profile: this.currentProfile,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  APPLY PHASE (instant)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Instantly apply the lighting profile of the given phase, with no
   * transition interpolation.
   *
   * @param {string} phase
   */
  applyPhaseEffects(phase) {
    const profile = PHASE_PROFILES[phase];
    if (!profile) return;

    this.currentProfile = { ...profile };
    this.lighting.setAmbient(profile.ambientColor, profile.ambientIntensity);

    // Remove old phase particle lights
    this._clearPhaseLights();

    // Spawn new phase-specific atmospheric lights
    this._spawnPhaseLights(phase, profile);

    this.eventBus.emit('lighting:phaseApplied', { phase, profile });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  DEEP SAP POOL
  // ════════════════════════════════════════════════════════════════════════════

  /** @private */
  _onDeepPoolNear(data) {
    this._deepPoolActive = true;
    this._deepPoolIntensity = data.intensity ?? 1;
    this._deepPoolTime = 0;
  }

  /** @private */
  _onDeepPoolLeave() {
    this._deepPoolActive = false;
    // Restore ambient to current phase baseline
    const profile = PHASE_PROFILES[this.currentPhase];
    if (profile) {
      this.lighting.setAmbient(profile.ambientColor, profile.ambientIntensity);
    }
  }

  /**
   * While the player is near a Deep Sap Pool, oscillate the ambient
   * intensity with a slow, unsettling rhythm.
   * @private
   */
  _applyDeepPoolFluctuation(time) {
    const profile = PHASE_PROFILES[this.currentPhase];
    if (!profile) return;

    const base = profile.ambientIntensity;
    const wave =
      Math.sin(time * 0.0008) * 0.12 +
      Math.sin(time * 0.0023) * 0.06;

    const boosted = base + wave * this._deepPoolIntensity;
    this.lighting.setAmbient(profile.ambientColor, Math.max(0.02, boosted));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PHASE PARTICLE LIGHTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Spawn small atmospheric point lights around the camera that pulse with
   * phase-appropriate colours, simulating floating Sap motes.
   * @private
   */
  _spawnPhaseLights(phase, profile) {
    const scene = this.lighting.scene;
    if (!scene || !scene.cameras) return;

    const cam = scene.cameras.main;
    const cx = cam.scrollX + GameConfig.WIDTH * 0.5;
    const cy = cam.scrollY + GameConfig.HEIGHT * 0.5;

    for (let i = 0; i < this._maxPhaseLights; i++) {
      const angle = (Math.PI * 2 * i) / this._maxPhaseLights;
      const spread = 150 + Math.random() * 250;

      const light = this.lighting.addLight({
        type: 'point',
        x: cx + Math.cos(angle) * spread,
        y: cy + Math.sin(angle) * spread,
        color: profile.particleColor,
        intensity: 0.3 + Math.random() * 0.2,
        radius: 60 + Math.random() * 40,
        castShadows: false,
        effects: {
          pulse: {
            speed: 0.4 + Math.random() * 0.6,
            min: 0.15,
            max: 0.55,
          },
        },
      });

      this._phaseLightIds.push(light.id);
    }
  }

  /**
   * Remove all ephemeral phase-particle lights.
   * @private
   */
  _clearPhaseLights() {
    for (const id of this._phaseLightIds) {
      this.lighting.removeLight(id);
    }
    this._phaseLightIds = [];
  }

  /**
   * Slowly drift phase lights to follow the camera, keeping them in view.
   * @private
   */
  _updatePhaseLights(time, delta) {
    const scene = this.lighting.scene;
    if (!scene || !scene.cameras || this._phaseLightIds.length === 0) return;

    const cam = scene.cameras.main;
    const cx = cam.scrollX + GameConfig.WIDTH * 0.5;
    const cy = cam.scrollY + GameConfig.HEIGHT * 0.5;
    const driftSpeed = 0.002;

    for (let i = 0; i < this._phaseLightIds.length; i++) {
      const id = this._phaseLightIds[i];
      const light = this.lighting.lights.get(id);
      if (!light) continue;

      // Slowly orbit around camera centre
      const baseAngle = (Math.PI * 2 * i) / this._phaseLightIds.length;
      const wobble = Math.sin(time * 0.0005 + i * 1.7) * 0.3;
      const targetAngle = baseAngle + time * driftSpeed + wobble;
      const spread = 180 + Math.sin(time * 0.0003 + i) * 80;

      light.x += (cx + Math.cos(targetAngle) * spread - light.x) * delta * 0.001;
      light.y += (cy + Math.sin(targetAngle) * spread - light.y) * delta * 0.001;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  UTILITY
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Resolve the current profile for a given phase (or the interpolated
   * snapshot if a transition is in progress and the phase matches).
   * @private
   */
  _resolveProfile(phase) {
    if (this.transitioning && phase === this.currentPhase) {
      return this.currentProfile;
    }
    return PHASE_PROFILES[phase] || PHASE_PROFILES[GameConfig.SAP_PHASES.BLUE];
  }

  /**
   * Override the transition duration (ms) for the next phase change.
   * @param {number} ms
   */
  setTransitionDuration(ms) {
    this.transitionDuration = Math.max(100, ms);
  }

  /**
   * Get the raw profile definition for a phase.
   * @param {string} phase
   * @returns {Object|undefined}
   */
  getPhaseProfile(phase) {
    return PHASE_PROFILES[phase] ? { ...PHASE_PROFILES[phase] } : undefined;
  }

  /**
   * Tear down event listeners and phase lights.
   */
  destroy() {
    if (this._unsubPhaseChange) this._unsubPhaseChange();
    if (this._unsubDeepPoolNear) this._unsubDeepPoolNear();
    if (this._unsubDeepPoolLeave) this._unsubDeepPoolLeave();
    this._clearPhaseLights();
  }
}

export default SapCycleLightingIntegration;
