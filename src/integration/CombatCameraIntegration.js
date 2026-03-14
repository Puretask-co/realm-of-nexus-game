import { EventBus } from '../core/EventBus.js';
import { cinematicPresets } from '../configs/cinematicPresets.js';

/**
 * CombatCameraIntegration - Bridges the combat system and the AdvancedCameraSystem.
 *
 * Listens for combat events (via EventBus) and translates them into camera actions:
 * auto-framing combatants, shaking on impacts, zooming for critical hits, following
 * the active-turn character, tracking spell areas, executing boss-encounter sequences,
 * slow-motion finishing moves, and death-tracking cameras.
 *
 * Usage:
 *   const integration = new CombatCameraIntegration(cameraSystem);
 *   // ... combat events are handled automatically via EventBus
 *   integration.destroy(); // when no longer needed
 */
export class CombatCameraIntegration {

  // ───────────────────────────────────────────────────────────────────────────
  // Construction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {AdvancedCameraSystem} cameraSystem - The camera system instance.
   */
  constructor(cameraSystem) {
    /** @type {AdvancedCameraSystem} */
    this.cameraSystem = cameraSystem;

    /** @type {EventBus} */
    this.eventBus = EventBus.getInstance();

    /** Whether combat mode is currently active */
    this.inCombat = false;

    /** Reference to the character whose turn it is */
    this.activeCharacter = null;

    /** All combatants in the current encounter */
    this.combatants = [];

    /** Whether a cinematic sequence is currently playing */
    this.cinematicPlaying = false;

    /** Timer handle for the cinematic keyframe scheduler */
    this._cinematicTimers = [];

    /** Saved camera state before combat started (for restoration) */
    this._preCombatState = null;

    // ── Tuning Constants ──────────────────────────────────────────────

    /** Base shake intensity per point of damage */
    this.damageShakeScale = 0.04;

    /** Minimum shake intensity regardless of damage */
    this.minDamageShake = 1.5;

    /** Maximum shake intensity regardless of damage */
    this.maxDamageShake = 14;

    /** Zoom level applied during critical hits */
    this.criticalZoom = 1.35;

    /** Duration of the critical-hit zoom pulse (ms) */
    this.criticalZoomDuration = 350;

    /** Slow-motion time scale for finishing moves */
    this.finishingSlowMo = 0.2;

    /** Duration of the finishing-move slow-motion window (ms) */
    this.finishingSlowMoDuration = 800;

    /** Death camera zoom level */
    this.deathZoom = 1.15;

    /** Death camera tracking duration (ms) */
    this.deathTrackDuration = 1500;

    // ── Bind Events ───────────────────────────────────────────────────

    this._bindEvents();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event Wiring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to all combat-related EventBus events.
   * @private
   */
  _bindEvents() {
    this._unbindHandles = [];

    const bind = (event, handler) => {
      const unsub = this.eventBus.on(event, handler.bind(this));
      this._unbindHandles.push(unsub);
    };

    bind('combat:start',       (data) => this.onCombatStart(data.combatants));
    bind('combat:turnStart',   (data) => this.onTurnStart(data.character));
    bind('combat:attack',      (data) => this.onAttack(data.attacker, data.target, data.damage));
    bind('combat:spellCast',   (data) => this.onSpellCast(data.caster, data.spell, data.targetArea));
    bind('combat:criticalHit', (data) => this.onCriticalHit(data.attacker, data.target, data.damage));
    bind('combat:death',       (data) => this.onDeath(data.character));
    bind('combat:bossEncounter', (data) => this.onBossEncounter(data.boss));
    bind('combat:end',         (data) => this.onCombatEnd(data.result));
    bind('combat:finishingMove', (data) => this.onFinishingMove(data.attacker, data.target));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Combat Lifecycle Handlers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called when combat begins. Saves the pre-combat camera state, switches
   * to the framing controller, and frames all combatants.
   *
   * @param {Array<Object>} combatants - All participants (with x, y, cameraWeight).
   */
  onCombatStart(combatants) {
    this.inCombat = true;
    this.combatants = combatants || [];

    // Save state for later restoration
    this._preCombatState = {
      controller: this.cameraSystem.activeController,
      zoom: this.cameraSystem.currentZoom,
      target: this.cameraSystem.target
    };

    // Frame all combatants
    this.cameraSystem.setTargets(this.combatants);
    this.cameraSystem.setController('framing', {
      paddingX: 120,
      paddingY: 100,
      lerpX: 0.06,
      lerpY: 0.06
    }, 600);

    this.eventBus.emit('camera:combatStarted', { combatantCount: this.combatants.length });
  }

  /**
   * Called when a combatant's turn begins. Switches the camera to follow
   * the active character with a moderate transition.
   *
   * @param {Object} activeCharacter - The character whose turn it is.
   */
  onTurnStart(activeCharacter) {
    if (!this.inCombat) return;

    this.activeCharacter = activeCharacter;

    // Follow the active character during their turn
    this.cameraSystem.setTarget(activeCharacter);
    this.cameraSystem.setController('follow', {
      lerpX: 0.1,
      lerpY: 0.1,
      offsetY: -20
    }, 400);

    this.eventBus.emit('camera:turnFocused', { character: activeCharacter });
  }

  /**
   * Called when an attack lands. Applies a camera shake proportional to
   * the damage dealt, and briefly focuses the camera midpoint between
   * attacker and target.
   *
   * @param {Object} attacker - The attacking character.
   * @param {Object} target   - The defending character.
   * @param {number} damage   - Amount of damage dealt.
   */
  onAttack(attacker, target, damage) {
    if (!this.inCombat) return;

    // Calculate shake intensity from damage
    const rawIntensity = damage * this.damageShakeScale;
    const intensity = Phaser.Math.Clamp(rawIntensity, this.minDamageShake, this.maxDamageShake);

    // Determine shake preset based on damage thresholds
    let preset = 'light';
    if (damage >= 80) preset = 'heavy';
    else if (damage >= 30) preset = 'medium';

    this.cameraSystem.shake(preset, intensity);

    // Briefly frame attacker + target for the hit moment
    if (attacker && target) {
      this.cameraSystem.setTargets([
        { ...attacker, cameraWeight: 0.4 },
        { ...target, cameraWeight: 1.0 }
      ]);
      this.cameraSystem.setController('framing', {
        paddingX: 80,
        paddingY: 60,
        lerpX: 0.12,
        lerpY: 0.12
      }, 200);

      // Return focus to all combatants after a short delay
      this._scheduleReturn(500);
    }

    this.eventBus.emit('camera:attackImpact', { damage, intensity });
  }

  /**
   * Called when a spell is cast. Frames the caster and target area,
   * with a slight zoom for dramatic effect.
   *
   * @param {Object} caster     - The spell caster.
   * @param {Object} spell      - The spell data (name, type, element, etc.).
   * @param {Object} targetArea - The area being targeted { x, y, radius }.
   */
  onSpellCast(caster, spell, targetArea) {
    if (!this.inCombat) return;

    // Create a virtual target at the spell's impact point for framing
    const spellTarget = {
      x: targetArea.x,
      y: targetArea.y,
      cameraWeight: 1.2,
      active: true
    };

    this.cameraSystem.setTargets([
      { ...caster, cameraWeight: 0.6 },
      spellTarget
    ]);

    this.cameraSystem.setController('framing', {
      paddingX: targetArea.radius ? targetArea.radius + 60 : 100,
      paddingY: targetArea.radius ? targetArea.radius + 40 : 80,
      lerpX: 0.08,
      lerpY: 0.08
    }, 300);

    // Slight zoom emphasis
    const spellZoom = spell.tier >= 3 ? 1.15 : 1.05;
    this.cameraSystem.zoom(spellZoom, 300, 'Quad.easeOut');

    // For high-tier spells, add slow-motion
    if (spell.tier >= 4) {
      this.cameraSystem.setSlowMotion(0.5);
      this._scheduleAction(800, () => {
        this.cameraSystem.setSlowMotion(1.0);
      });
    }

    // Return to normal after spell animation
    this._scheduleReturn(1200);

    this.eventBus.emit('camera:spellFocused', { spell: spell.name, targetArea });
  }

  /**
   * Called on a critical hit. Triggers a dramatic zoom pulse and heavier
   * shake, with brief slow-motion.
   *
   * @param {Object} attacker - The attacking character.
   * @param {Object} target   - The defending character.
   * @param {number} damage   - Amount of damage (amplified by crit).
   */
  onCriticalHit(attacker, target, damage) {
    if (!this.inCombat) return;

    // Lock onto the target for the crit moment
    this.cameraSystem.setTarget(target);
    this.cameraSystem.setController('targetLock', {
      lerpX: 0.2,
      lerpY: 0.2,
      zoomLevel: this.criticalZoom,
      offsetY: -15
    }, 150);

    // Brief slow-motion for dramatic weight
    this.cameraSystem.setSlowMotion(0.3);

    // Heavy shake
    const intensity = Phaser.Math.Clamp(damage * this.damageShakeScale * 1.5, 4, this.maxDamageShake);
    this.cameraSystem.shake('heavy', intensity);

    // Emit flash event for ScreenSpaceEffects
    this.eventBus.emit('effect:flash', { color: '#ffcc00', duration: 100 });

    // Recover after the critical-hit window
    this._scheduleAction(this.criticalZoomDuration, () => {
      this.cameraSystem.setSlowMotion(1.0);
      this.cameraSystem.zoom(1.0, 400, 'Cubic.easeOut');
    });

    this._scheduleReturn(800);

    this.eventBus.emit('camera:criticalHit', { damage, intensity });
  }

  /**
   * Called when a character dies. Tracks the dying character with a slight
   * zoom and slow-motion for emotional weight.
   *
   * @param {Object} character - The character who died.
   */
  onDeath(character) {
    if (!this.inCombat) return;

    // Lock onto the dying character
    this.cameraSystem.setTarget(character);
    this.cameraSystem.setController('targetLock', {
      lerpX: 0.12,
      lerpY: 0.12,
      zoomLevel: this.deathZoom,
      offsetY: -10
    }, 300);

    // Slow-motion death moment
    this.cameraSystem.setSlowMotion(0.4);

    // Emit desaturation event for ScreenSpaceEffects
    this.eventBus.emit('effect:enable', {
      effect: 'desaturation',
      config: { intensity: 0.5, duration: 800 }
    });

    // Remove dead character from combatants list
    this.combatants = this.combatants.filter(c => c !== character);

    // Recover after the death animation window
    this._scheduleAction(this.deathTrackDuration, () => {
      this.cameraSystem.setSlowMotion(1.0);
      this.eventBus.emit('effect:disable', { effect: 'desaturation', fadeOut: 600 });
    });

    this._scheduleReturn(this.deathTrackDuration + 200);

    this.eventBus.emit('camera:deathTracked', { character });
  }

  /**
   * Called when a boss is encountered. Plays the boss_entrance cinematic
   * preset if available, otherwise uses a simplified entrance sequence.
   *
   * @param {Object} boss - The boss entity.
   */
  onBossEncounter(boss) {
    if (!this.inCombat) return;

    // Give the boss higher camera weight
    boss.cameraWeight = 2.0;

    const preset = cinematicPresets.boss_entrance;
    if (preset) {
      this._playCinematic(preset, { boss });
    } else {
      // Fallback: simple dramatic zoom + shake
      this.cameraSystem.setTarget(boss);
      this.cameraSystem.setController('targetLock', {
        zoomLevel: 0.7,
        lerpX: 0.06,
        lerpY: 0.06
      }, 800);
      this.cameraSystem.shake('earthquake', 8, 1000);

      this._scheduleReturn(3000);
    }

    this.eventBus.emit('camera:bossEncounterStarted', { boss });
  }

  /**
   * Called when a finishing move is performed. Triggers the final_blow
   * cinematic or a manual slow-motion + zoom sequence.
   *
   * @param {Object} attacker - The character delivering the finishing blow.
   * @param {Object} target   - The character receiving it.
   */
  onFinishingMove(attacker, target) {
    if (!this.inCombat) return;

    const preset = cinematicPresets.final_blow;
    if (preset) {
      // Focus on target for the cinematic
      this.cameraSystem.setTarget(target);
      this._playCinematic(preset, { attacker, target });
    } else {
      // Fallback: manual slow-mo + zoom
      this.cameraSystem.setTarget(target);
      this.cameraSystem.setController('targetLock', {
        zoomLevel: 1.5,
        lerpX: 0.18,
        lerpY: 0.18
      }, 150);
      this.cameraSystem.setSlowMotion(this.finishingSlowMo);

      this._scheduleAction(this.finishingSlowMoDuration, () => {
        this.cameraSystem.setSlowMotion(1.0);
        this.cameraSystem.shake('explosion');
        this.cameraSystem.zoom(1.0, 600, 'Cubic.easeOut');
      });

      this._scheduleReturn(this.finishingSlowMoDuration + 800);
    }

    this.eventBus.emit('camera:finishingMove', { attacker, target });
  }

  /**
   * Called when combat ends. Restores pre-combat camera state and
   * optionally plays a victory or defeat camera sequence.
   *
   * @param {Object} result - Combat outcome { victory: boolean, ... }.
   */
  onCombatEnd(result) {
    // Clear any pending scheduled actions
    this._clearScheduled();

    this.inCombat = false;
    this.activeCharacter = null;
    this.combatants = [];
    this.cinematicPlaying = false;

    // Restore slow-motion to normal
    this.cameraSystem.setSlowMotion(1.0);

    // Play a brief victory / defeat camera beat
    if (result && result.victory) {
      const preset = cinematicPresets.victory_pose;
      if (preset && result.mvp) {
        this.cameraSystem.setTarget(result.mvp);
        this._playCinematic(preset, { mvp: result.mvp });
      }
    }

    // Restore pre-combat camera state after a delay
    this._scheduleAction(result && result.victory ? 3500 : 500, () => {
      if (this._preCombatState) {
        this.cameraSystem.setController(
          this._preCombatState.controller,
          {},
          600
        );
        this.cameraSystem.zoom(this._preCombatState.zoom, 600);
        if (this._preCombatState.target) {
          this.cameraSystem.setTarget(this._preCombatState.target);
        }
        this._preCombatState = null;
      }
    });

    this.eventBus.emit('camera:combatEnded', { result });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cinematic Playback
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Play a cinematic preset by scheduling each keyframe action.
   *
   * @private
   * @param {Array<Object>} preset  - Array of keyframe objects.
   * @param {Object}        context - Named targets/entities referenced by tags.
   */
  _playCinematic(preset, context = {}) {
    this.cinematicPlaying = true;
    this._clearScheduled();

    let maxTime = 0;

    for (const keyframe of preset) {
      const kfTime = keyframe.time || 0;
      if (kfTime > maxTime) maxTime = kfTime + (keyframe.duration || 0);

      this._scheduleAction(kfTime, () => {
        this._executeCinematicAction(keyframe, context);
      });
    }

    // Mark cinematic as finished once all keyframes have completed
    this._scheduleAction(maxTime + 100, () => {
      this.cinematicPlaying = false;
    });
  }

  /**
   * Execute a single cinematic keyframe action on the camera system.
   *
   * @private
   * @param {Object} keyframe - The keyframe data.
   * @param {Object} context  - Runtime context (boss, attacker, target, etc.).
   */
  _executeCinematicAction(keyframe, context) {
    const { action, value, duration, easing, target, params } = keyframe;

    switch (action) {
      case 'pan': {
        // Resolve tagged target position from context
        let panTarget = target;
        if (params && params.tag && context[params.tag]) {
          const entity = context[params.tag];
          panTarget = { x: entity.x, y: entity.y };
        }
        if (panTarget && params && params.relative) {
          // Relative pans offset from current smooth position
          panTarget = {
            x: this.cameraSystem.smoothX + panTarget.x,
            y: this.cameraSystem.smoothY + panTarget.y
          };
        }
        if (panTarget) {
          // Create a virtual target and lock to it
          const virtualTarget = { x: panTarget.x, y: panTarget.y, active: true };
          this.cameraSystem.setTarget(virtualTarget);
        }
        break;
      }

      case 'zoom':
        this.cameraSystem.zoom(value, duration || 400, easing || 'Cubic.easeInOut');
        break;

      case 'shake':
        this.cameraSystem.shake(value, undefined, duration);
        break;

      case 'fade':
        // Delegate to the scene's camera fade (Phaser built-in)
        if (this.cameraSystem.camera) {
          if (value === 'out') {
            const color = this._parseHexColor(params && params.color ? params.color : '#000000');
            this.cameraSystem.camera.fadeOut(duration || 500, color.r, color.g, color.b);
          } else {
            const color = this._parseHexColor(params && params.color ? params.color : '#000000');
            this.cameraSystem.camera.fadeIn(duration || 500, color.r, color.g, color.b);
          }
        }
        break;

      case 'flash': {
        const flashColor = this._parseHexColor(value || '#ffffff');
        if (this.cameraSystem.camera) {
          this.cameraSystem.camera.flash(duration || 150, flashColor.r, flashColor.g, flashColor.b);
        }
        this.eventBus.emit('effect:flash', { color: value, duration: duration || 150 });
        break;
      }

      case 'wait':
        // No-op; the scheduler handles timing
        break;

      case 'setController':
        this.cameraSystem.setController(value, {}, duration || 400);
        break;

      case 'slowMotion':
        this.cameraSystem.setSlowMotion(value);
        break;

      case 'effect':
        if (params && params.intensity !== undefined) {
          if (params.intensity === 0) {
            this.eventBus.emit('effect:disable', { effect: value, fadeOut: duration || 300 });
          } else {
            this.eventBus.emit('effect:enable', {
              effect: value,
              config: { ...params, transitionDuration: duration }
            });
          }
        } else {
          this.eventBus.emit('effect:enable', {
            effect: value,
            config: { ...params, transitionDuration: duration }
          });
        }
        break;

      default:
        console.warn(`CombatCameraIntegration: Unknown cinematic action '${action}'`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Scheduling Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Schedule a one-shot callback after a delay.
   * @private
   * @param {number}   delayMs  - Delay in ms.
   * @param {Function} callback - Function to call.
   */
  _scheduleAction(delayMs, callback) {
    const timer = setTimeout(callback, delayMs);
    this._cinematicTimers.push(timer);
    return timer;
  }

  /**
   * Schedule a return to normal combat framing (all combatants).
   * @private
   * @param {number} delayMs
   */
  _scheduleReturn(delayMs) {
    this._scheduleAction(delayMs, () => {
      if (!this.inCombat || this.cinematicPlaying) return;

      // Return to framing all remaining combatants
      this.cameraSystem.setTargets(this.combatants);
      this.cameraSystem.setController('framing', {
        paddingX: 120,
        paddingY: 100,
        lerpX: 0.06,
        lerpY: 0.06
      }, 400);
      this.cameraSystem.zoom(1.0, 400, 'Cubic.easeOut');
    });
  }

  /**
   * Clear all pending scheduled timers.
   * @private
   */
  _clearScheduled() {
    for (const timer of this._cinematicTimers) {
      clearTimeout(timer);
    }
    this._cinematicTimers = [];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Utilities
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Parse a hex color string into { r, g, b } integers.
   * @private
   * @param {string} hex - e.g. '#ff3300' or '#fff'
   * @returns {{ r: number, g: number, b: number }}
   */
  _parseHexColor(hex) {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16)
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tear down all listeners and pending timers.
   */
  destroy() {
    this._clearScheduled();

    if (this._unbindHandles) {
      for (const unsub of this._unbindHandles) {
        if (typeof unsub === 'function') unsub();
      }
      this._unbindHandles = [];
    }

    this.combatants = [];
    this.activeCharacter = null;
    this.cameraSystem = null;
    this._preCombatState = null;
  }
}

export default CombatCameraIntegration;
