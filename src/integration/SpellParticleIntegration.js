/**
 * SpellParticleIntegration
 *
 * Bridges the SpellSystem and AdvancedParticleSystem so that every spell
 * cast automatically triggers the correct visual effects: a cast flourish
 * at the caster, a travelling projectile, and an impact burst at the target.
 *
 * Element-to-effect mapping is defined here so designers only need to assign
 * an element to a spell in spells.json and the VFX "just works".
 */

class SpellParticleIntegration {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/AdvancedParticleSystem.js').default} particleSystem
   */
  constructor(scene, particleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
    this.activeEffects = new Map();
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Fire a complete spell VFX sequence: cast -> projectile -> impact.
   * @param {Object} spell - Spell data from DataManager
   * @param {Phaser.GameObjects.Sprite} caster
   * @param {Phaser.GameObjects.Sprite} target
   */
  playSpellSequence(spell, caster, target) {
    // 1. Cast effect at caster
    this.createCastEffect(spell, caster);

    // 2. Projectile from caster to target
    this.createProjectileEffect(spell, caster, target);
  }

  /**
   * Create a particle burst at the caster when they begin casting.
   */
  createCastEffect(spell, caster) {
    const presetName = this._getPresetForElement(spell.element, 'cast');
    if (!presetName) return null;

    return this.particleSystem.createEffect(presetName, caster.x, caster.y);
  }

  /**
   * Create an emitter that follows a projectile from caster to target,
   * then triggers an impact effect on arrival.
   */
  createProjectileEffect(spell, caster, target) {
    const color = this._getElementColor(spell.element);

    const emitter = this.particleSystem.createEmitter({
      x: caster.x,
      y: caster.y,
      emissionMode: 'continuous',
      emissionRate: 30,
      duration: 1000,
      particleConfig: {
        texture: 'particle',
        lifetime: { min: 200, max: 400 },
        speed: { min: 20, max: 50 },
        angle: { min: 0, max: Math.PI * 2 },
        color,
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 1.0, end: 0.0 },
        blendMode: 'ADD'
      }
    });

    // Tween the emitter position to the target
    this.scene.tweens.add({
      targets: emitter,
      x: target.x,
      y: target.y,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.particleSystem.stopEmitter(emitter);
        this.createImpactEffect(spell, target.x, target.y);
      }
    });

    return emitter;
  }

  /**
   * Create an impact burst at the target position.
   */
  createImpactEffect(spell, x, y) {
    const presetName = this._getPresetForElement(spell.element, 'impact');
    if (!presetName) return null;

    const emitter = this.particleSystem.createEffect(presetName, x, y);

    // Auto-cleanup
    this.scene.time.delayedCall(1500, () => {
      if (emitter) this.particleSystem.removeEmitter(emitter);
    });

    return emitter;
  }

  /**
   * Create a sustained area-of-effect visual.
   */
  createAreaEffect(spell, x, y, radius) {
    const color = this._getElementColor(spell.element);

    return this.particleSystem.createEmitter({
      x,
      y,
      emissionMode: 'continuous',
      emissionRate: 50,
      duration: spell.duration || 3000,
      emissionShape: 'circle',
      emissionArea: { radius },
      particleConfig: {
        texture: 'particle',
        lifetime: { min: 500, max: 1000 },
        speed: { min: 30, max: 80 },
        angle: { min: 0, max: Math.PI * 2 },
        color,
        scale: { start: 1.0, end: 0.3 },
        alpha: { start: 0.8, end: 0.0 },
        blendMode: 'ADD',
        drag: 0.95
      }
    });
  }

  /**
   * Create a channeled beam between caster and target.
   */
  createChannelEffect(spell, caster, target, duration) {
    const dist = Phaser.Math.Distance.Between(caster.x, caster.y, target.x, target.y);
    const angle = Phaser.Math.Angle.Between(caster.x, caster.y, target.x, target.y);
    const color = this._getElementColor(spell.element);

    const emitter = this.particleSystem.createEmitter({
      x: caster.x,
      y: caster.y,
      emissionMode: 'continuous',
      emissionRate: 100,
      duration: duration || 2000,
      emissionShape: 'line',
      emissionArea: { length: dist, angle },
      particleConfig: {
        texture: 'particle',
        lifetime: { min: 100, max: 300 },
        speed: { min: 50, max: 100 },
        angle: { min: angle - 0.3, max: angle + 0.3 },
        color,
        scale: { start: 0.6, end: 0.2 },
        alpha: { start: 1.0, end: 0.0 },
        blendMode: 'ADD'
      }
    });

    // Live-update the beam as targets might move
    const tracker = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!emitter.active) return;
        emitter.x = caster.x;
        emitter.y = caster.y;
        const d = Phaser.Math.Distance.Between(caster.x, caster.y, target.x, target.y);
        const a = Phaser.Math.Angle.Between(caster.x, caster.y, target.x, target.y);
        emitter.emissionArea.length = d;
        emitter.emissionArea.angle = a;
      },
      loop: true
    });

    this.scene.time.delayedCall(duration || 2000, () => {
      tracker.remove();
      this.particleSystem.stopEmitter(emitter);
    });

    return emitter;
  }

  /**
   * Clean up all tracked effects.
   */
  cleanup() {
    this.activeEffects.forEach((emitter) => {
      this.particleSystem.removeEmitter(emitter);
    });
    this.activeEffects.clear();
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  _getPresetForElement(element, stage) {
    const map = {
      nature: { cast: 'healing_aura', projectile: 'poison_cloud', impact: 'healing_aura' },
      arcane: { cast: 'lightning_bolt', projectile: 'lightning_bolt', impact: 'critical_hit' },
      shadow: { cast: 'shadow_strike', projectile: 'shadow_strike', impact: 'shadow_strike' },
      radiant: { cast: 'radiant_nova', projectile: 'radiant_nova', impact: 'radiant_nova' },
      fire: { cast: 'fireball', projectile: 'fireball', impact: 'fireball' },
      ice: { cast: 'ice_shards', projectile: 'ice_shards', impact: 'ice_shards' }
    };
    return map[element]?.[stage] || null;
  }

  _getElementColor(element) {
    const colors = {
      fire: { start: 0xff4400, end: 0x440000 },
      ice: { start: 0x88ccff, end: 0x004488 },
      nature: { start: 0x44ff88, end: 0x118844 },
      arcane: { start: 0x4488ff, end: 0x002288 },
      shadow: { start: 0x8844ff, end: 0x220044 },
      radiant: { start: 0xffffaa, end: 0xffcc00 }
    };
    return colors[element] || { start: 0xffffff, end: 0x888888 };
  }
}

export default SpellParticleIntegration;
