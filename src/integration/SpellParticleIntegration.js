import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { particlePresets } from '../configs/particlePresets.js';

/**
 * SpellParticleIntegration - Bridges the spell / combat system and the
 * AdvancedParticleSystem for Verdance.
 *
 * Responsibilities:
 *   - Map spell IDs to multi-phase particle chains (cast, travel, impact, linger).
 *   - Manage projectile trail emitters that follow moving entities.
 *   - Spawn impact effects keyed by element type.
 *   - Fill area-of-effect zones with particle emitters.
 *   - Attach persistent status-effect emitters to targets.
 *   - Tint / modify particles based on the active Sap Cycle phase.
 *
 * This class does NOT own the particle system; it is a thin orchestration
 * layer that calls createEmitter / removeEmitter on the injected instance.
 */
export class SpellParticleIntegration {

  // ─── Static data ─────────────────────────────────────────────────

  /**
   * Mapping from spell element to a base impact preset name.
   * Elements not listed here fall back to 'magic_impact'.
   */
  static ELEMENT_IMPACT_MAP = {
    fire:      'fireball',
    ice:       'ice_shards',
    lightning: 'lightning_bolt',
    earth:     'earth_spike',
    wind:      'hit_spark',
    shadow:    'void_portal',
    light:     'magic_impact',
    temporal:  'temporal_echo',
    nature:    'healing_aura',
    void:      'void_portal'
  };

  /**
   * Status effect to preset mapping.
   */
  static STATUS_PRESET_MAP = {
    burning:   'fireball',
    frozen:    'ice_shards',
    poisoned:  'poison_cloud',
    shocked:   'lightning_bolt',
    shielded:  'silver_barrier',
    healing:   'healing_aura',
    buffed:    'buff_active',
    cursed:    'void_portal',
    temporal:  'temporal_echo',
    bleeding:  'blood_splatter'
  };

  /**
   * Sap-phase colour tint overrides.  Each phase provides a primary tint and
   * a colour-curve that will be merged with the preset's curve.
   */
  static SAP_PHASE_TINTS = {
    blue: {
      tint: 0x3388ff,
      colorCurve: [
        { t: 0, color: 0x88bbff },
        { t: 0.5, color: 0x3388ff },
        { t: 1, color: 0x1144aa }
      ]
    },
    crimson: {
      tint: 0xcc2244,
      colorCurve: [
        { t: 0, color: 0xff6677 },
        { t: 0.5, color: 0xcc2244 },
        { t: 1, color: 0x661122 }
      ]
    },
    silver: {
      tint: 0xbbbbcc,
      colorCurve: [
        { t: 0, color: 0xeeeeff },
        { t: 0.5, color: 0xbbbbcc },
        { t: 1, color: 0x666677 }
      ]
    }
  };

  // ─── Constructor ─────────────────────────────────────────────────

  /**
   * @param {import('../systems/AdvancedParticleSystem.js').AdvancedParticleSystem} particleSystem
   */
  constructor(particleSystem) {
    this.ps = particleSystem;
    this.eventBus = EventBus.getInstance();

    /**
     * Active spell effect chains keyed by a unique effect ID.
     * Each entry: { spellId, phases: { cast, travel, impact, linger }, emitterIds: [] }
     * @type {Map<string, object>}
     */
    this.activeEffects = new Map();

    /**
     * Active status effect emitters keyed by a unique status ID.
     * Each entry: { emitterId, targetRef, effectType }
     * @type {Map<string, object>}
     */
    this.activeStatusEffects = new Map();

    /**
     * Counter for generating unique IDs within this integration layer.
     */
    this._nextId = 0;

    // Listen for game events so we can clean up automatically
    this.eventBus.on('scene:shutdown', () => this._cleanupAll());
  }

  // ─── Spell Effect Chain ──────────────────────────────────────────

  /**
   * Play the full particle chain for a spell.
   *
   * The chain consists of up to four phases executed in sequence:
   *   1. **cast**   - Particles at the caster's position during cast time.
   *   2. **travel** - Trail emitter that follows a projectile / travels to target.
   *   3. **impact** - Burst at the target position on hit.
   *   4. **linger** - Residual effect (DoT zone, lingering flame, etc.).
   *
   * @param {string} spellId      Spell identifier (matches data/spells.json `id`).
   * @param {{x:number, y:number}} origin  Cast origin position.
   * @param {{x:number, y:number}} target  Target position.
   * @param {string|null} sapPhase  Current Sap Cycle phase ('blue','crimson','silver').
   * @returns {string} A unique effect ID that can be used to query or cancel.
   */
  playSpellEffect(spellId, origin, target, sapPhase = null) {
    const effectId = this._uid('fx');
    const mapping = this._getSpellMapping(spellId);

    const chain = {
      spellId,
      effectId,
      origin: { ...origin },
      target: { ...target },
      sapPhase,
      emitterIds: [],
      timers: []
    };

    // ---- Phase 1: Cast --------------------------------------------------
    if (mapping.cast) {
      const preset = this._resolvePreset(mapping.cast, sapPhase);
      const emId = this.ps.createEmitter({
        ...preset,
        x: origin.x,
        y: origin.y,
        duration: mapping.castDuration ?? 0.5
      });
      chain.emitterIds.push(emId);
    }

    // ---- Phase 2: Travel ------------------------------------------------
    if (mapping.travel) {
      const delay = (mapping.castDuration ?? 0.5) * 1000; // ms
      const timerId = setTimeout(() => {
        this._startTravelPhase(chain, mapping, sapPhase);
      }, delay);
      chain.timers.push(timerId);
    }

    // ---- Phase 3: Impact ------------------------------------------------
    const impactDelay = ((mapping.castDuration ?? 0.5) + (mapping.travelDuration ?? 0.3)) * 1000;
    const impactTimer = setTimeout(() => {
      this._startImpactPhase(chain, mapping, sapPhase);
    }, impactDelay);
    chain.timers.push(impactTimer);

    // ---- Phase 4: Linger ------------------------------------------------
    if (mapping.linger) {
      const lingerDelay = impactDelay + 100;
      const lingerTimer = setTimeout(() => {
        this._startLingerPhase(chain, mapping, sapPhase);
      }, lingerDelay);
      chain.timers.push(lingerTimer);
    }

    this.activeEffects.set(effectId, chain);
    this.eventBus.emit('spell:particleStarted', { effectId, spellId });
    return effectId;
  }

  /** Internal: spawn the travel-phase emitter. */
  _startTravelPhase(chain, mapping, sapPhase) {
    const preset = this._resolvePreset(mapping.travel, sapPhase);
    const dx = chain.target.x - chain.origin.x;
    const dy = chain.target.y - chain.origin.y;
    const angle = Math.atan2(dy, dx);

    const emId = this.ps.createEmitter({
      ...preset,
      x: chain.origin.x,
      y: chain.origin.y,
      rotation: angle,
      duration: mapping.travelDuration ?? 0.3,
      trail: { enabled: true, frequency: 0.02, emitterId: null }
    });
    chain.emitterIds.push(emId);

    // Animate the emitter position towards target over travelDuration
    const travelMs = (mapping.travelDuration ?? 0.3) * 1000;
    const steps = Math.max(1, Math.round(travelMs / 16)); // ~60fps steps
    const stepX = dx / steps;
    const stepY = dy / steps;
    let step = 0;

    const moveInterval = setInterval(() => {
      step++;
      const em = this.ps.emitters.get(emId);
      if (em) {
        em.x += stepX;
        em.y += stepY;
      }
      if (step >= steps) {
        clearInterval(moveInterval);
      }
    }, 16);

    chain.timers.push(moveInterval);
  }

  /** Internal: spawn the impact-phase emitter. */
  _startImpactPhase(chain, mapping, sapPhase) {
    const presetKey = mapping.impact ?? 'magic_impact';
    const preset = this._resolvePreset(presetKey, sapPhase);

    const emId = this.ps.createEmitter({
      ...preset,
      x: chain.target.x,
      y: chain.target.y,
      type: 'burst',
      maxEmissions: 1,
      duration: preset.lifetime?.max ?? 1.5
    });
    chain.emitterIds.push(emId);

    this.eventBus.emit('spell:particleImpact', {
      effectId: chain.effectId,
      spellId: chain.spellId,
      position: chain.target
    });
  }

  /** Internal: spawn the linger-phase emitter. */
  _startLingerPhase(chain, mapping, sapPhase) {
    const preset = this._resolvePreset(mapping.linger, sapPhase);

    const emId = this.ps.createEmitter({
      ...preset,
      x: chain.target.x,
      y: chain.target.y,
      duration: mapping.lingerDuration ?? 3.0
    });
    chain.emitterIds.push(emId);
  }

  /**
   * Cancel an active spell effect chain, killing all associated emitters.
   * @param {string} effectId
   */
  cancelSpellEffect(effectId) {
    const chain = this.activeEffects.get(effectId);
    if (!chain) return;

    // Clear pending timers
    for (const t of chain.timers) {
      clearTimeout(t);
      clearInterval(t);
    }

    // Remove emitters
    for (const emId of chain.emitterIds) {
      this.ps.removeEmitter(emId, true);
    }

    this.activeEffects.delete(effectId);
    this.eventBus.emit('spell:particleCancelled', { effectId });
  }

  // ─── Impact Effects ──────────────────────────────────────────────

  /**
   * Play a standalone impact effect for a given element at a position.
   *
   * @param {string} element   Element type (fire, ice, lightning, etc.).
   * @param {{x:number, y:number}} position  World position.
   * @param {object} [opts]     Optional overrides: { scale, sapPhase, burstCount }.
   * @returns {string} Emitter ID.
   */
  playImpactEffect(element, position, opts = {}) {
    const presetKey = SpellParticleIntegration.ELEMENT_IMPACT_MAP[element] ?? 'magic_impact';
    const basePreset = this._resolvePreset(presetKey, opts.sapPhase ?? null);

    const overrides = {};
    if (opts.scale) {
      overrides.baseScale = {
        min: (basePreset.baseScale?.min ?? 1) * opts.scale,
        max: (basePreset.baseScale?.max ?? 1) * opts.scale
      };
    }
    if (opts.burstCount) {
      overrides.burstCount = opts.burstCount;
    }

    const emId = this.ps.createEmitter({
      ...basePreset,
      ...overrides,
      x: position.x,
      y: position.y,
      type: 'burst',
      maxEmissions: 1,
      duration: basePreset.lifetime?.max ?? 1.5
    });

    this.eventBus.emit('spell:impactPlayed', { element, position, emitterId: emId });
    return emId;
  }

  // ─── Area of Effect ──────────────────────────────────────────────

  /**
   * Fill a circular area with particle emitters (e.g. blizzard zone, fire ring).
   *
   * @param {string} presetKey   Preset name or element identifier.
   * @param {{x:number, y:number}} center  Centre of the AoE.
   * @param {number} radius       Radius in pixels.
   * @param {number} duration     Duration in seconds.
   * @param {string|null} sapPhase
   * @returns {string[]} Array of emitter IDs created.
   */
  playAreaEffect(presetKey, center, radius, duration = 3.0, sapPhase = null) {
    const preset = this._resolvePreset(presetKey, sapPhase);
    const emitterIds = [];

    // Central emitter covers most of the area
    const mainId = this.ps.createEmitter({
      ...preset,
      x: center.x,
      y: center.y,
      shape: 'circle',
      shapeParams: { radius },
      duration,
      emissionRate: (preset.emissionRate ?? 20) * 2
    });
    emitterIds.push(mainId);

    // Edge ring emitter for visual boundary
    const ringId = this.ps.createEmitter({
      ...preset,
      x: center.x,
      y: center.y,
      shape: 'ring',
      shapeParams: { innerRadius: radius * 0.85, outerRadius: radius },
      duration,
      emissionRate: preset.emissionRate ?? 20,
      baseAlpha: (preset.baseAlpha ?? 1) * 0.6
    });
    emitterIds.push(ringId);

    this.eventBus.emit('spell:aoeStarted', { center, radius, duration, emitterIds });
    return emitterIds;
  }

  // ─── Status Effects ──────────────────────────────────────────────

  /**
   * Attach a persistent status-effect particle emitter to a target entity.
   *
   * The emitter will follow the target's position each frame (caller must
   * call `updateStatusEffects()` in the game loop, or wire into the entity's
   * movement events).
   *
   * @param {string} effectType  One of: burning, frozen, poisoned, shocked,
   *                             shielded, healing, buffed, cursed, temporal, bleeding.
   * @param {{x:number, y:number}} target  Reference object with x/y (mutated externally).
   * @param {object} [opts]  { duration, sapPhase, scale }
   * @returns {string}  Unique status effect ID (use to stop later).
   */
  playStatusEffect(effectType, target, opts = {}) {
    const statusId = this._uid('status');
    const presetKey = SpellParticleIntegration.STATUS_PRESET_MAP[effectType] ?? 'buff_active';
    const preset = this._resolvePreset(presetKey, opts.sapPhase ?? null);

    // Scale down for status effects — they sit on a character, not filling the screen
    const scaleFactor = opts.scale ?? 0.6;

    const emId = this.ps.createEmitter({
      ...preset,
      x: target.x,
      y: target.y,
      duration: opts.duration ?? -1,
      emissionRate: Math.max(5, Math.round((preset.emissionRate ?? 20) * 0.5)),
      maxParticles: Math.max(20, Math.round((preset.maxParticles ?? 100) * 0.4)),
      baseScale: {
        min: (preset.baseScale?.min ?? 0.5) * scaleFactor,
        max: (preset.baseScale?.max ?? 1.0) * scaleFactor
      },
      shapeParams: this._shrinkShape(preset.shapeParams, 0.5)
    });

    this.activeStatusEffects.set(statusId, {
      emitterId: emId,
      targetRef: target,
      effectType
    });

    this.eventBus.emit('spell:statusStarted', { statusId, effectType });
    return statusId;
  }

  /**
   * Stop and remove a status effect emitter.
   * @param {string} statusId  The ID returned by playStatusEffect().
   */
  stopStatusEffect(statusId) {
    const entry = this.activeStatusEffects.get(statusId);
    if (!entry) return;

    this.ps.removeEmitter(entry.emitterId, true);
    this.activeStatusEffects.delete(statusId);
    this.eventBus.emit('spell:statusStopped', { statusId, effectType: entry.effectType });
  }

  /**
   * Call each frame to keep status-effect emitters tracking their targets.
   */
  updateStatusEffects() {
    for (const [statusId, entry] of this.activeStatusEffects) {
      const em = this.ps.emitters.get(entry.emitterId);
      if (!em) {
        // Emitter expired naturally; clean up
        this.activeStatusEffects.delete(statusId);
        continue;
      }
      if (entry.targetRef) {
        em.x = entry.targetRef.x;
        em.y = entry.targetRef.y;
      }
    }
  }

  // ─── Sap Phase Colour Modification ──────────────────────────────

  /**
   * Apply Sap-phase colour modifications to a preset config.
   * Returns a new config object — does not mutate the original.
   *
   * @param {object} presetConfig  Original emitter config.
   * @param {string} sapPhase      'blue' | 'crimson' | 'silver' | null.
   * @returns {object}  Modified config (or original if no phase).
   */
  _applySapPhase(presetConfig, sapPhase) {
    if (!sapPhase) return presetConfig;

    const phaseTint = SpellParticleIntegration.SAP_PHASE_TINTS[sapPhase];
    if (!phaseTint) return presetConfig;

    // Blend 50/50 between original base colour and phase tint
    const blendedColor = this._blendColors(presetConfig.baseColor ?? 0xffffff, phaseTint.tint, 0.45);

    return {
      ...presetConfig,
      baseColor: blendedColor,
      colorCurve: phaseTint.colorCurve
    };
  }

  // ─── Internal Helpers ────────────────────────────────────────────

  /**
   * Build the spell -> particle phase mapping.
   * In production this would read from DataManager; here we use a convention-
   * based approach that derives presets from the spell's element.
   */
  _getSpellMapping(spellId) {
    // Convention: split spellId into tokens and infer element
    // e.g. "fire_bolt" -> element "fire"
    const parts = spellId.split('_');
    const element = parts[0] ?? 'light';
    const impactPreset = SpellParticleIntegration.ELEMENT_IMPACT_MAP[element] ?? 'magic_impact';

    // Default mapping (can be extended with DataManager lookups)
    return {
      cast: impactPreset,
      castDuration: 0.4,
      travel: impactPreset,
      travelDuration: 0.3,
      impact: impactPreset,
      linger: null,
      lingerDuration: 0
    };
  }

  /**
   * Resolve a preset key into a config object, applying Sap-phase tinting.
   * @param {string} presetKey
   * @param {string|null} sapPhase
   * @returns {object}
   */
  _resolvePreset(presetKey, sapPhase) {
    const base = particlePresets[presetKey] ?? particlePresets.magic_impact ?? {};
    return this._applySapPhase({ ...base }, sapPhase);
  }

  /** Simple additive colour blend (clamped). */
  _blendColors(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.min(255, Math.round(r1 * (1 - t) + r2 * t));
    const g = Math.min(255, Math.round(g1 * (1 - t) + g2 * t));
    const b = Math.min(255, Math.round(b1 * (1 - t) + b2 * t));
    return (r << 16) | (g << 8) | b;
  }

  /** Shrink shape params by a factor (for status-effect scaling). */
  _shrinkShape(params, factor) {
    if (!params) return {};
    const out = { ...params };
    if (out.radius) out.radius = Math.round(out.radius * factor);
    if (out.innerRadius) out.innerRadius = Math.round(out.innerRadius * factor);
    if (out.outerRadius) out.outerRadius = Math.round(out.outerRadius * factor);
    if (out.width) out.width = Math.round(out.width * factor);
    if (out.height) out.height = Math.round(out.height * factor);
    return out;
  }

  /** Generate a unique ID. */
  _uid(prefix) {
    return `${prefix}_${++this._nextId}_${Date.now().toString(36)}`;
  }

  /** Clean up everything when the scene shuts down. */
  _cleanupAll() {
    // Cancel all active spell chains
    for (const effectId of [...this.activeEffects.keys()]) {
      this.cancelSpellEffect(effectId);
    }

    // Stop all status effects
    for (const statusId of [...this.activeStatusEffects.keys()]) {
      this.stopStatusEffect(statusId);
    }
  }

  /**
   * Tear down the integration layer.
   */
  destroy() {
    this._cleanupAll();
    this.ps = null;
    this.activeEffects.clear();
    this.activeStatusEffects.clear();
  }
}

export default SpellParticleIntegration;
