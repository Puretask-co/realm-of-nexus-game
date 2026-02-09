import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * ScreenSpaceEffects - Post-processing screen-space visual effects for the
 * Verdance camera pipeline.
 *
 * All effects are implemented as Phaser GameObjects layered on top of the scene
 * (rectangles, graphics, images) with blend modes and alpha manipulation,
 * avoiding WebGL shader dependencies so the system works on Canvas and WebGL
 * renderers alike.
 *
 * Supported effects:
 *   vignette, chromatic_aberration, scan_lines, film_grain, blood_splatter,
 *   screen_crack, desaturation, color_grade, flash, blur
 *
 * Each effect supports:
 *   - enable / disable with smooth fade transitions
 *   - configurable intensity (0 = off, 1 = full)
 *   - per-frame update for animated effects (grain, scan lines)
 */
export class ScreenSpaceEffects {

  // ───────────────────────────────────────────────────────────────────────────
  // Construction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {Phaser.Scene} scene - The Phaser scene to attach effects to.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {EventBus} */
    this.eventBus = EventBus.getInstance();

    /**
     * Registry of all effect definitions.
     * Each entry has: enabled, intensity, targetIntensity, transitionSpeed,
     * config, gameObject (Phaser display object), and an update function.
     * @type {Map<string, Object>}
     */
    this.effects = new Map();

    /** Depth counter; each new effect layer gets a higher depth. */
    this._nextDepth = 8000;

    // ── Initialize built-in effects ───────────────────────────────────

    this._initVignette();
    this._initChromaticAberration();
    this._initScanLines();
    this._initFilmGrain();
    this._initBloodSplatter();
    this._initScreenCrack();
    this._initDesaturation();
    this._initColorGrade();
    this._initFlash();
    this._initBlur();

    // ── Event Wiring ──────────────────────────────────────────────────

    this._bindEvents();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event Wiring
  // ───────────────────────────────────────────────────────────────────────────

  /** @private */
  _bindEvents() {
    this._unbindHandles = [];

    const bind = (event, handler) => {
      const unsub = this.eventBus.on(event, handler.bind(this));
      this._unbindHandles.push(unsub);
    };

    bind('effect:enable',  (data) => this.enableEffect(data.effect, data.config));
    bind('effect:disable', (data) => this.disableEffect(data.effect, data.fadeOut));
    bind('effect:flash',   (data) => this.flash(data.color, data.duration));
    bind('effect:setIntensity', (data) => this.setEffectIntensity(data.effect, data.intensity));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Effect Registration Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Register a new effect in the registry.
   * @private
   * @param {string}   name       - Unique effect name.
   * @param {Object}   config     - Default configuration.
   * @param {Function} createFn   - Returns the Phaser display object(s).
   * @param {Function} [updateFn] - Per-frame update (receives delta, effectState).
   */
  _registerEffect(name, config, createFn, updateFn = null) {
    const gameObject = createFn();
    const depth = this._nextDepth++;

    if (gameObject) {
      gameObject.setScrollFactor(0);
      gameObject.setDepth(depth);
      gameObject.setAlpha(0);
      gameObject.setVisible(false);
    }

    this.effects.set(name, {
      name,
      enabled: false,
      intensity: 0,
      targetIntensity: 0,
      transitionSpeed: 0.004,  // per ms
      config: { ...config },
      gameObject,
      updateFn,
      depth
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Built-in Effect Initializers
  // ───────────────────────────────────────────────────────────────────────────

  /** @private Vignette: dark gradient around the screen edges. */
  _initVignette() {
    this._registerEffect('vignette', {
      color: '#000000',
      softness: 0.4,
      size: 0.8
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const gfx = this.scene.add.graphics();
      gfx.setName('effect_vignette');

      // Draw a radial gradient approximation using concentric ellipses
      const steps = 20;
      for (let i = steps; i >= 0; i--) {
        const ratio = i / steps;
        const alpha = Math.pow(1 - ratio, 2.5) * 0.9;
        const rx = (w * 0.55) * ratio + w * 0.05;
        const ry = (h * 0.55) * ratio + h * 0.05;
        gfx.fillStyle(0x000000, alpha);
        gfx.fillEllipse(w * 0.5, h * 0.5, rx * 2, ry * 2);
      }

      return gfx;
    }, null);
  }

  /** @private Chromatic aberration: RGB channel split overlay. */
  _initChromaticAberration() {
    this._registerEffect('chromatic_aberration', {
      offsetX: 3,
      offsetY: 1
    }, () => {
      // Use two tinted rectangles offset from center to simulate RGB split
      const container = this.scene.add.container(0, 0);
      container.setName('effect_chromatic');

      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;

      // Red channel overlay (shifted right)
      const redRect = this.scene.add.rectangle(w * 0.5 + 3, h * 0.5, w, h, 0xff0000, 0.08);
      redRect.setBlendMode(Phaser.BlendModes.ADD);

      // Blue channel overlay (shifted left)
      const blueRect = this.scene.add.rectangle(w * 0.5 - 3, h * 0.5, w, h, 0x0000ff, 0.08);
      blueRect.setBlendMode(Phaser.BlendModes.ADD);

      container.add([redRect, blueRect]);
      container._redRect = redRect;
      container._blueRect = blueRect;

      return container;
    }, (delta, state) => {
      // Animate the offset slightly for a living chromatic effect
      if (state.gameObject && state.intensity > 0) {
        const offset = state.config.offsetX * state.intensity;
        const obj = state.gameObject;
        if (obj._redRect) {
          obj._redRect.setX(GameConfig.WIDTH * 0.5 + offset);
          obj._redRect.setAlpha(0.08 * state.intensity);
        }
        if (obj._blueRect) {
          obj._blueRect.setX(GameConfig.WIDTH * 0.5 - offset);
          obj._blueRect.setAlpha(0.08 * state.intensity);
        }
      }
    });
  }

  /** @private Scan lines: CRT-style horizontal lines. */
  _initScanLines() {
    this._registerEffect('scan_lines', {
      lineSpacing: 4,
      lineAlpha: 0.12,
      scrollSpeed: 0.5
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const gfx = this.scene.add.graphics();
      gfx.setName('effect_scanlines');

      gfx.fillStyle(0x000000, 0.12);
      for (let y = 0; y < h; y += 4) {
        gfx.fillRect(0, y, w, 2);
      }

      return gfx;
    }, (delta, state) => {
      // Optional: animate scroll offset for moving-scanline look
      if (state.gameObject && state.config.scrollSpeed > 0) {
        const speed = state.config.scrollSpeed;
        state._scrollOffset = ((state._scrollOffset || 0) + speed * delta * 0.01) % 4;
        state.gameObject.setY(-state._scrollOffset);
      }
    });
  }

  /** @private Film grain: pseudo-random noise overlay. */
  _initFilmGrain() {
    this._registerEffect('film_grain', {
      grainSize: 2,
      density: 0.3
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const gfx = this.scene.add.graphics();
      gfx.setName('effect_filmgrain');
      return gfx;
    }, (delta, state) => {
      // Redraw random noise each frame for an animated grain effect
      if (!state.gameObject || state.intensity <= 0) return;

      const gfx = state.gameObject;
      gfx.clear();

      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const size = state.config.grainSize;
      const density = state.config.density * state.intensity;
      const count = Math.floor((w * h * density) / (size * size * 50));

      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const brightness = Math.random();
        const color = brightness > 0.5 ? 0xffffff : 0x000000;
        const alpha = Math.random() * 0.15 * state.intensity;
        gfx.fillStyle(color, alpha);
        gfx.fillRect(x, y, size, size);
      }
    });
  }

  /** @private Blood splatter: red overlay at screen corners/edges. */
  _initBloodSplatter() {
    this._registerEffect('blood_splatter', {
      color: '#8b0000',
      cornerIntensity: 0.6,
      edgeIntensity: 0.3
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const gfx = this.scene.add.graphics();
      gfx.setName('effect_blood');

      // Draw blood-like gradients in corners
      const cornerSize = 200;
      const corners = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: 0, y: h },
        { x: w, y: h }
      ];

      for (const corner of corners) {
        const steps = 10;
        for (let i = steps; i >= 0; i--) {
          const ratio = i / steps;
          const alpha = (1 - ratio) * 0.35;
          const radius = cornerSize * ratio;
          gfx.fillStyle(0x8b0000, alpha);
          gfx.fillCircle(corner.x, corner.y, radius);
        }
      }

      // Subtle red wash along top and bottom edges
      gfx.fillStyle(0x8b0000, 0.08);
      gfx.fillRect(0, 0, w, 40);
      gfx.fillRect(0, h - 40, w, 40);

      return gfx;
    }, null);
  }

  /** @private Screen crack: overlay simulating cracked glass. */
  _initScreenCrack() {
    this._registerEffect('screen_crack', {
      crackCount: 5,
      lineWidth: 2,
      color: '#ffffff'
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const gfx = this.scene.add.graphics();
      gfx.setName('effect_crack');

      // Draw procedural crack lines radiating from a central impact point
      const cx = w * 0.5 + (Math.random() - 0.5) * w * 0.3;
      const cy = h * 0.5 + (Math.random() - 0.5) * h * 0.3;
      const crackCount = 8;

      gfx.lineStyle(2, 0xffffff, 0.6);

      for (let i = 0; i < crackCount; i++) {
        let angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        let px = cx;
        let py = cy;
        const segments = 4 + Math.floor(Math.random() * 4);

        gfx.beginPath();
        gfx.moveTo(px, py);

        for (let s = 0; s < segments; s++) {
          const len = 30 + Math.random() * 60;
          angle += (Math.random() - 0.5) * 0.8;
          px += Math.cos(angle) * len;
          py += Math.sin(angle) * len;
          gfx.lineTo(px, py);
        }

        gfx.strokePath();
      }

      // Small radial web around the impact point
      gfx.lineStyle(1, 0xffffff, 0.3);
      for (let r = 20; r < 80; r += 25) {
        gfx.strokeCircle(cx, cy, r);
      }

      return gfx;
    }, null);
  }

  /** @private Desaturation: grayscale tint overlay. */
  _initDesaturation() {
    this._registerEffect('desaturation', {
      color: '#808080'
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const rect = this.scene.add.rectangle(w * 0.5, h * 0.5, w, h, 0x808080, 0.5);
      rect.setName('effect_desat');
      rect.setBlendMode(Phaser.BlendModes.SATURATION || Phaser.BlendModes.MULTIPLY);
      return rect;
    }, (delta, state) => {
      if (state.gameObject) {
        state.gameObject.setAlpha(state.intensity * 0.5);
      }
    });
  }

  /** @private Color grade: full-screen tint overlay for color tone. */
  _initColorGrade() {
    this._registerEffect('color_grade', {
      tint: '#ff8800',
      blendMode: 'MULTIPLY'
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const rect = this.scene.add.rectangle(w * 0.5, h * 0.5, w, h, 0xff8800, 0.15);
      rect.setName('effect_colorgrade');
      rect.setBlendMode(Phaser.BlendModes.MULTIPLY);
      return rect;
    }, (delta, state) => {
      if (state.gameObject && state.config.tint) {
        const color = Phaser.Display.Color.HexStringToColor(state.config.tint);
        state.gameObject.setFillStyle(color.color, 0.15 * state.intensity);
      }
    });
  }

  /** @private Flash: brief full-screen color flash on impacts. */
  _initFlash() {
    this._registerEffect('flash', {
      color: '#ffffff',
      duration: 150
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const rect = this.scene.add.rectangle(w * 0.5, h * 0.5, w, h, 0xffffff, 1);
      rect.setName('effect_flash');
      rect.setBlendMode(Phaser.BlendModes.ADD);
      return rect;
    }, (delta, state) => {
      // Flash auto-fades quickly
      if (state.enabled && state._flashRemaining !== undefined) {
        state._flashRemaining -= delta;
        if (state._flashRemaining <= 0) {
          state.enabled = false;
          state.intensity = 0;
          state.targetIntensity = 0;
          if (state.gameObject) {
            state.gameObject.setAlpha(0);
            state.gameObject.setVisible(false);
          }
        } else {
          const progress = state._flashRemaining / state._flashDuration;
          state.intensity = progress;
          if (state.gameObject) {
            state.gameObject.setAlpha(progress * 0.8);
          }
        }
      }
    });
  }

  /** @private Blur: simulated blur using layered transparent copies. */
  _initBlur() {
    this._registerEffect('blur', {
      strength: 4,
      edgesOnly: false
    }, () => {
      const w = GameConfig.WIDTH;
      const h = GameConfig.HEIGHT;
      const container = this.scene.add.container(0, 0);
      container.setName('effect_blur');

      // Simulate blur with semi-transparent overlapping rectangles
      // (true Gaussian blur requires a shader; this is a visual approximation)
      const offsets = [
        { x: -2, y: 0 }, { x: 2, y: 0 },
        { x: 0, y: -2 }, { x: 0, y: 2 },
        { x: -1, y: -1 }, { x: 1, y: 1 },
        { x: -1, y: 1 }, { x: 1, y: -1 }
      ];

      for (const offset of offsets) {
        const rect = this.scene.add.rectangle(
          w * 0.5 + offset.x, h * 0.5 + offset.y, w, h, 0x000000, 0.02
        );
        rect.setBlendMode(Phaser.BlendModes.NORMAL);
        container.add(rect);
      }

      return container;
    }, (delta, state) => {
      // Scale blur offset with intensity
      if (state.gameObject && state.gameObject.list) {
        const strength = (state.config.strength || 4) * state.intensity;
        const offsets = [
          { x: -strength, y: 0 }, { x: strength, y: 0 },
          { x: 0, y: -strength }, { x: 0, y: strength },
          { x: -strength * 0.5, y: -strength * 0.5 },
          { x: strength * 0.5, y: strength * 0.5 },
          { x: -strength * 0.5, y: strength * 0.5 },
          { x: strength * 0.5, y: -strength * 0.5 }
        ];

        const children = state.gameObject.list;
        for (let i = 0; i < children.length && i < offsets.length; i++) {
          children[i].setPosition(
            GameConfig.WIDTH * 0.5 + offsets[i].x,
            GameConfig.HEIGHT * 0.5 + offsets[i].y
          );
          children[i].setAlpha(0.02 * state.intensity);
        }
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Enable an effect with an optional configuration override.
   *
   * @param {string} effectName - Name of the effect to enable.
   * @param {Object} [config={}] - Partial config to merge (intensity, color, etc.).
   */
  enableEffect(effectName, config = {}) {
    const state = this.effects.get(effectName);
    if (!state) {
      console.warn(`ScreenSpaceEffects: Unknown effect '${effectName}'`);
      return;
    }

    // Merge config
    Object.assign(state.config, config);

    // Set target intensity (default to 1 if not specified)
    state.targetIntensity = config.intensity !== undefined ? config.intensity : 1.0;

    // Compute transition speed from optional transitionDuration
    if (config.transitionDuration && config.transitionDuration > 0) {
      state.transitionSpeed = 1.0 / config.transitionDuration;
    } else {
      state.transitionSpeed = 0.004; // default ~250ms
    }

    state.enabled = true;

    if (state.gameObject) {
      state.gameObject.setVisible(true);
    }

    // Update tint color for color_grade if specified
    if (effectName === 'color_grade' && config.tint && state.gameObject) {
      const color = Phaser.Display.Color.HexStringToColor(config.tint);
      state.gameObject.setFillStyle(color.color, 0.15 * state.targetIntensity);
    }

    // Update vignette color if specified
    if (effectName === 'vignette' && config.color) {
      // Rebuild the vignette with the new color would require regeneration;
      // for now store the config for future use
      state.config.color = config.color;
    }

    this.eventBus.emit('effect:enabled', { effect: effectName, intensity: state.targetIntensity });
  }

  /**
   * Disable an effect, optionally fading it out.
   *
   * @param {string}         effectName - Name of the effect to disable.
   * @param {number|boolean} [fadeOut=300] - Fade-out duration in ms, or false for instant.
   */
  disableEffect(effectName, fadeOut = 300) {
    const state = this.effects.get(effectName);
    if (!state) return;

    state.targetIntensity = 0;

    if (fadeOut && typeof fadeOut === 'number' && fadeOut > 0) {
      state.transitionSpeed = 1.0 / fadeOut;
    } else {
      // Instant disable
      state.intensity = 0;
      state.enabled = false;
      if (state.gameObject) {
        state.gameObject.setAlpha(0);
        state.gameObject.setVisible(false);
      }
    }

    this.eventBus.emit('effect:disabled', { effect: effectName });
  }

  /**
   * Set the intensity of a running effect.
   *
   * @param {string} effectName - Effect name.
   * @param {number} intensity  - 0 (off) to 1 (full).
   */
  setEffectIntensity(effectName, intensity) {
    const state = this.effects.get(effectName);
    if (!state) return;

    state.targetIntensity = Phaser.Math.Clamp(intensity, 0, 1);

    if (intensity > 0 && !state.enabled) {
      this.enableEffect(effectName, { intensity });
    }
  }

  /**
   * Trigger a quick screen flash effect.
   *
   * @param {string} [color='#ffffff'] - Flash color as hex string.
   * @param {number} [duration=150]    - Flash duration in ms.
   */
  flash(color = '#ffffff', duration = 150) {
    const state = this.effects.get('flash');
    if (!state) return;

    // Parse color
    const parsedColor = Phaser.Display.Color.HexStringToColor(color);
    if (state.gameObject) {
      state.gameObject.setFillStyle(parsedColor.color, 1);
      state.gameObject.setAlpha(0.8);
      state.gameObject.setVisible(true);
    }

    state.enabled = true;
    state.intensity = 1;
    state.targetIntensity = 0;
    state._flashRemaining = duration;
    state._flashDuration = duration;
    state.config.color = color;
    state.config.duration = duration;

    this.eventBus.emit('effect:flashTriggered', { color, duration });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Per-Frame Update
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called every frame to update all active effects: interpolate intensities,
   * apply per-frame animations, and manage visibility.
   *
   * @param {number} time  - Total elapsed time in ms.
   * @param {number} delta - Frame delta in ms.
   */
  update(time, delta) {
    for (const [name, state] of this.effects) {
      // ── Intensity interpolation ─────────────────────────────────────
      if (state.intensity !== state.targetIntensity) {
        const direction = state.targetIntensity > state.intensity ? 1 : -1;
        const step = state.transitionSpeed * delta;
        state.intensity += direction * step;

        // Clamp to target
        if (direction > 0 && state.intensity >= state.targetIntensity) {
          state.intensity = state.targetIntensity;
        } else if (direction < 0 && state.intensity <= state.targetIntensity) {
          state.intensity = state.targetIntensity;
        }

        // Auto-disable when intensity reaches 0
        if (state.intensity <= 0 && state.targetIntensity <= 0) {
          state.intensity = 0;
          state.enabled = false;
          if (state.gameObject) {
            state.gameObject.setAlpha(0);
            state.gameObject.setVisible(false);
          }
        }
      }

      // ── Apply intensity to game object alpha ────────────────────────
      if (state.enabled && state.gameObject && name !== 'flash') {
        state.gameObject.setAlpha(state.intensity);
      }

      // ── Run per-frame update function if defined ────────────────────
      if (state.enabled && state.updateFn) {
        state.updateFn(delta, state);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Query
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check whether an effect is currently active.
   * @param {string} effectName
   * @returns {boolean}
   */
  isEffectActive(effectName) {
    const state = this.effects.get(effectName);
    return state ? state.enabled : false;
  }

  /**
   * Get the current intensity of an effect.
   * @param {string} effectName
   * @returns {number} Intensity 0-1, or -1 if unknown.
   */
  getEffectIntensity(effectName) {
    const state = this.effects.get(effectName);
    return state ? state.intensity : -1;
  }

  /**
   * List all registered effect names.
   * @returns {string[]}
   */
  getEffectNames() {
    return Array.from(this.effects.keys());
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Destroy all effect game objects and remove EventBus listeners.
   */
  destroy() {
    // Destroy all game objects
    for (const [name, state] of this.effects) {
      if (state.gameObject) {
        state.gameObject.destroy();
        state.gameObject = null;
      }
    }
    this.effects.clear();

    // Unbind events
    if (this._unbindHandles) {
      for (const unsub of this._unbindHandles) {
        if (typeof unsub === 'function') unsub();
      }
      this._unbindHandles = [];
    }

    this.scene = null;
  }
}

export default ScreenSpaceEffects;
