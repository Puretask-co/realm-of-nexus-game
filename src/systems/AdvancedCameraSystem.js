import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * AdvancedCameraSystem - Comprehensive camera management for the Verdance game engine.
 *
 * Provides four distinct camera controller modes (follow, lookAhead, framing, targetLock),
 * smooth transitions between them, camera shake presets, zoom interpolation, deadzone support,
 * slow-motion awareness, soft-edge bounds, and optional debug visualization.
 *
 * Designed to integrate with the EventBus for decoupled communication with combat,
 * cinematic, and zone systems.
 */
export class AdvancedCameraSystem {

  // ───────────────────────────────────────────────────────────────────────────
  // Construction & Initialization
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {Phaser.Scene} scene - The Phaser scene this camera system belongs to.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Phaser.Cameras.Scene2D.Camera} */
    this.camera = scene.cameras.main;

    /** @type {EventBus} */
    this.eventBus = EventBus.getInstance();

    // ── Controller State ──────────────────────────────────────────────

    /** Active controller type: 'follow' | 'lookAhead' | 'framing' | 'targetLock' */
    this.activeController = 'follow';

    /** Previous controller (for transition blending) */
    this.previousController = null;

    /** Primary tracking target (game object with x, y) */
    this.target = null;

    /** Array of targets for the framing controller */
    this.targets = [];

    /** Controller-specific configuration objects keyed by controller name */
    this.controllers = {
      follow: {
        lerpX: 0.1,
        lerpY: 0.1,
        offsetX: 0,
        offsetY: 0,
        deadzoneWidth: 80,
        deadzoneHeight: 80
      },
      lookAhead: {
        lerpX: 0.08,
        lerpY: 0.08,
        lookAheadDistance: 120,
        lookAheadSmoothing: 0.05,
        velocityInfluence: 1.0,
        offsetX: 0,
        offsetY: 0
      },
      framing: {
        lerpX: 0.06,
        lerpY: 0.06,
        paddingX: 100,
        paddingY: 80,
        minZoom: 0.4,
        maxZoom: 1.5,
        zoomLerp: 0.04,
        weightDefault: 1.0
      },
      targetLock: {
        lerpX: 0.15,
        lerpY: 0.15,
        lockStrength: 1.0,
        offsetX: 0,
        offsetY: -30,
        zoomLevel: 1.2
      }
    };

    // ── Transition ────────────────────────────────────────────────────

    /** Whether a controller transition is currently active */
    this.isTransitioning = false;

    /** Elapsed time of the current transition (ms) */
    this.transitionElapsed = 0;

    /** Total duration of the current transition (ms) */
    this.transitionDuration = 500;

    /** Camera position at the start of the transition */
    this.transitionStartPos = { x: 0, y: 0 };

    /** Camera zoom at the start of the transition */
    this.transitionStartZoom = 1;

    // ── Shake ─────────────────────────────────────────────────────────

    /** Whether a camera shake is currently active */
    this.isShaking = false;

    /** Remaining shake time (ms) */
    this.shakeRemaining = 0;

    /** Total shake duration (ms) */
    this.shakeDuration = 0;

    /** Current shake intensity (pixels of offset) */
    this.shakeIntensity = 0;

    /** Shake offset currently applied */
    this.shakeOffset = { x: 0, y: 0 };

    /** Whether shake should decay linearly over its duration */
    this.shakeDecay = true;

    /** Named shake presets */
    this.shakePresets = {
      light:      { intensity: 2,  duration: 150, decay: true },
      medium:     { intensity: 5,  duration: 250, decay: true },
      heavy:      { intensity: 10, duration: 400, decay: true },
      explosion:  { intensity: 18, duration: 500, decay: true },
      earthquake: { intensity: 8,  duration: 1200, decay: false },
      custom:     { intensity: 5,  duration: 300, decay: true }
    };

    // ── Zoom ──────────────────────────────────────────────────────────

    /** Current zoom level of the camera */
    this.currentZoom = 1;

    /** Target zoom level being interpolated toward */
    this.targetZoom = 1;

    /** Zoom interpolation speed (0-1) */
    this.zoomLerp = 0.05;

    /** Whether a zoom tween is active */
    this.isZooming = false;

    /** Minimum allowed zoom */
    this.minZoom = 0.25;

    /** Maximum allowed zoom */
    this.maxZoom = 3.0;

    // ── Deadzone ──────────────────────────────────────────────────────

    /** Deadzone rectangle (target can move freely inside without camera motion) */
    this.deadzone = { width: 80, height: 80 };

    /** Whether the deadzone is enabled */
    this.deadzoneEnabled = true;

    // ── Bounds ────────────────────────────────────────────────────────

    /** World bounds the camera should not exceed */
    this.bounds = null;

    /** Soft-edge size: pixels of gradual slowdown before hitting bounds */
    this.softEdgeSize = 60;

    /** Whether soft-edge clamping is active */
    this.softEdgeEnabled = true;

    // ── Slow Motion ───────────────────────────────────────────────────

    /** Current time scale (1 = normal, <1 = slow motion) */
    this.timeScale = 1.0;

    // ── Internal Tracking ─────────────────────────────────────────────

    /** Smoothed camera position (before shake offset) */
    this.smoothX = this.camera.scrollX + this.camera.width * 0.5;
    this.smoothY = this.camera.scrollY + this.camera.height * 0.5;

    /** Look-ahead velocity accumulator */
    this.lookAheadVelX = 0;
    this.lookAheadVelY = 0;

    /** Previous target position for velocity estimation */
    this.prevTargetX = 0;
    this.prevTargetY = 0;

    // ── Statistics ────────────────────────────────────────────────────

    this.stats = {
      controllerSwitches: 0,
      totalShakes: 0,
      totalZooms: 0,
      totalTransitions: 0,
      framesUpdated: 0,
      lastUpdateTime: 0
    };

    // ── Debug ─────────────────────────────────────────────────────────

    /** Whether debug visualization is drawn */
    this.debugEnabled = GameConfig.DEBUG.SHOW_CAMERA || false;

    /** Phaser Graphics object used for debug drawing */
    this.debugGraphics = null;

    // ── Event Wiring ──────────────────────────────────────────────────

    this._bindEvents();

    this.eventBus.emit('camera:initialized', { controller: this.activeController });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event Wiring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Register listeners on the central EventBus so other systems can
   * influence the camera without a direct reference.
   * @private
   */
  _bindEvents() {
    this._unbindHandles = [];

    const bind = (event, handler) => {
      const unsub = this.eventBus.on(event, handler.bind(this));
      this._unbindHandles.push(unsub);
    };

    bind('camera:setController', (data) => this.setController(data.type, data.config));
    bind('camera:setTarget', (data) => this.setTarget(data.target));
    bind('camera:shake', (data) => this.shake(data.preset, data.intensity, data.duration));
    bind('camera:zoom', (data) => this.zoom(data.targetZoom, data.duration, data.ease));
    bind('camera:setSlowMotion', (data) => this.setSlowMotion(data.timeScale));
    bind('camera:setBounds', (data) => this.setBounds(data.x, data.y, data.w, data.h));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Controller Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Switch the active camera controller. Optionally merge additional config
   * into the controller's settings. Triggers a smooth transition if a
   * different controller was active.
   *
   * @param {'follow'|'lookAhead'|'framing'|'targetLock'} type
   * @param {Object} [config={}] - Partial config merged into the controller.
   * @param {number} [transitionDuration=500] - Transition time in ms.
   */
  setController(type, config = {}, transitionDuration = 500) {
    if (!this.controllers[type]) {
      console.warn(`AdvancedCameraSystem: Unknown controller type '${type}'`);
      return;
    }

    // Merge user config into the stored controller config
    Object.assign(this.controllers[type], config);

    if (this.activeController !== type) {
      this.previousController = this.activeController;
      this.activeController = type;
      this.stats.controllerSwitches++;

      // Begin smooth transition
      this._startTransition(transitionDuration);

      this.eventBus.emit('camera:controllerChanged', {
        from: this.previousController,
        to: type
      });
    }
  }

  /**
   * Set the primary follow target.
   * @param {Object} target - Any object with x, y (and optionally body.velocity).
   */
  setTarget(target) {
    this.target = target;

    if (target) {
      this.prevTargetX = target.x;
      this.prevTargetY = target.y;
    }

    this.eventBus.emit('camera:targetChanged', { target });
  }

  /**
   * Set multiple targets for the framing controller. Each target can have an
   * optional `cameraWeight` property (default 1.0).
   * @param {Array<Object>} targets
   */
  setTargets(targets) {
    this.targets = targets || [];
    this.eventBus.emit('camera:targetsChanged', { count: this.targets.length });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Transitions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Kick off a smooth position/zoom transition.
   * @private
   * @param {number} duration - Transition time in ms.
   */
  _startTransition(duration) {
    this.isTransitioning = true;
    this.transitionElapsed = 0;
    this.transitionDuration = duration;
    this.transitionStartPos.x = this.smoothX;
    this.transitionStartPos.y = this.smoothY;
    this.transitionStartZoom = this.currentZoom;
    this.stats.totalTransitions++;
  }

  /**
   * Compute the eased transition progress (0 to 1).
   * Uses a smooth-step ease-in-out curve.
   * @private
   * @param {number} t - Raw progress 0-1.
   * @returns {number} Eased value 0-1.
   */
  _easeTransition(t) {
    // Smooth-step: 3t^2 - 2t^3
    return t * t * (3 - 2 * t);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Camera Shake
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Trigger a camera shake effect.
   *
   * @param {string} [preset='medium'] - One of the named shake presets.
   * @param {number} [intensity] - Override the preset intensity (pixels).
   * @param {number} [duration] - Override the preset duration (ms).
   */
  shake(preset = 'medium', intensity, duration) {
    const presetData = this.shakePresets[preset] || this.shakePresets.medium;

    this.shakeIntensity = (intensity !== undefined) ? intensity : presetData.intensity;
    this.shakeDuration = (duration !== undefined) ? duration : presetData.duration;
    this.shakeRemaining = this.shakeDuration;
    this.shakeDecay = presetData.decay;
    this.isShaking = true;
    this.stats.totalShakes++;

    this.eventBus.emit('camera:shakeStart', {
      preset,
      intensity: this.shakeIntensity,
      duration: this.shakeDuration
    });
  }

  /**
   * Update the shake offset each frame.
   * @private
   * @param {number} delta - Frame delta in ms.
   */
  _updateShake(delta) {
    if (!this.isShaking) {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      return;
    }

    this.shakeRemaining -= delta;

    if (this.shakeRemaining <= 0) {
      this.isShaking = false;
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      this.eventBus.emit('camera:shakeEnd');
      return;
    }

    // Compute effective intensity (optionally decayed)
    let effectiveIntensity = this.shakeIntensity;
    if (this.shakeDecay) {
      const progress = this.shakeRemaining / this.shakeDuration;
      effectiveIntensity *= progress;
    }

    // Random displacement within intensity radius
    const angle = Math.random() * Math.PI * 2;
    const magnitude = Math.random() * effectiveIntensity;
    this.shakeOffset.x = Math.cos(angle) * magnitude;
    this.shakeOffset.y = Math.sin(angle) * magnitude;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Zoom
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Smoothly zoom the camera to a target zoom level.
   *
   * @param {number} targetZoom - Desired zoom level.
   * @param {number} [duration=400] - Duration of the zoom tween (ms).
   * @param {string} [ease='Cubic.easeInOut'] - Phaser tween easing string.
   */
  zoom(targetZoom, duration = 400, ease = 'Cubic.easeInOut') {
    this.targetZoom = Phaser.Math.Clamp(targetZoom, this.minZoom, this.maxZoom);
    this.isZooming = true;
    this.stats.totalZooms++;

    // Use a Phaser tween for the zoom interpolation if the scene is active
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.add({
        targets: this,
        currentZoom: this.targetZoom,
        duration: duration,
        ease: ease,
        onUpdate: () => {
          this.camera.setZoom(this.currentZoom);
        },
        onComplete: () => {
          this.isZooming = false;
          this.eventBus.emit('camera:zoomComplete', { zoom: this.currentZoom });
        }
      });
    }

    this.eventBus.emit('camera:zoomStart', {
      from: this.currentZoom,
      to: this.targetZoom,
      duration
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Deadzone
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set the deadzone dimensions. Inside this rectangle the target can move
   * freely without the camera following.
   *
   * @param {number} width - Deadzone width in pixels.
   * @param {number} height - Deadzone height in pixels.
   */
  setDeadzone(width, height) {
    this.deadzone.width = width;
    this.deadzone.height = height;
    this.deadzoneEnabled = (width > 0 && height > 0);

    // Also propagate to the native Phaser camera deadzone
    if (this.deadzoneEnabled) {
      this.camera.setDeadzone(width, height);
    } else {
      this.camera.setDeadzone();
    }

    this.eventBus.emit('camera:deadzoneChanged', { width, height });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Bounds
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set the world bounds that constrain the camera.
   *
   * @param {number} x - Left edge.
   * @param {number} y - Top edge.
   * @param {number} w - Width of the bounded area.
   * @param {number} h - Height of the bounded area.
   */
  setBounds(x, y, w, h) {
    this.bounds = { x, y, width: w, height: h };
    this.camera.setBounds(x, y, w, h);
    this.eventBus.emit('camera:boundsChanged', this.bounds);
  }

  /**
   * Clamp a position so the camera viewport stays inside the configured bounds,
   * with optional soft-edge deceleration.
   *
   * @private
   * @param {number} posX - Desired camera center X.
   * @param {number} posY - Desired camera center Y.
   * @returns {{ x: number, y: number }} Clamped position.
   */
  _applyBounds(posX, posY) {
    if (!this.bounds) return { x: posX, y: posY };

    const hw = this.camera.width * 0.5 / this.currentZoom;
    const hh = this.camera.height * 0.5 / this.currentZoom;

    const minX = this.bounds.x + hw;
    const maxX = this.bounds.x + this.bounds.width - hw;
    const minY = this.bounds.y + hh;
    const maxY = this.bounds.y + this.bounds.height - hh;

    let clampedX = posX;
    let clampedY = posY;

    if (this.softEdgeEnabled && this.softEdgeSize > 0) {
      clampedX = this._softClamp(posX, minX, maxX, this.softEdgeSize);
      clampedY = this._softClamp(posY, minY, maxY, this.softEdgeSize);
    } else {
      clampedX = Phaser.Math.Clamp(posX, minX, maxX);
      clampedY = Phaser.Math.Clamp(posY, minY, maxY);
    }

    return { x: clampedX, y: clampedY };
  }

  /**
   * Apply a soft clamp: as value approaches the min/max boundary within
   * the soft-edge region, the movement decelerates rather than stopping abruptly.
   *
   * @private
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @param {number} softSize - Size of the soft-edge region.
   * @returns {number} Soft-clamped value.
   */
  _softClamp(value, min, max, softSize) {
    if (value < min) {
      const overshoot = min - value;
      return min - softSize * (1 - Math.exp(-overshoot / softSize));
    }
    if (value > max) {
      const overshoot = value - max;
      return max + softSize * (1 - Math.exp(-overshoot / softSize));
    }
    return value;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Slow Motion
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Set the time scale. Values below 1 create slow-motion; above 1 speeds up.
   * This affects all camera interpolation rates.
   *
   * @param {number} timeScale - New time scale (clamped 0.05 .. 3.0).
   */
  setSlowMotion(timeScale) {
    this.timeScale = Phaser.Math.Clamp(timeScale, 0.05, 3.0);
    this.eventBus.emit('camera:slowMotion', { timeScale: this.timeScale });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main Update Loop
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called every frame (typically from the scene's update method).
   *
   * @param {number} time - Total elapsed time in ms.
   * @param {number} delta - Frame delta in ms.
   */
  update(time, delta) {
    if (!this.camera || !this.scene) return;

    // Scale delta by time-scale for slow-motion support
    const scaledDelta = delta * this.timeScale;

    this.stats.framesUpdated++;
    this.stats.lastUpdateTime = time;

    // ── Transition blending ───────────────────────────────────────────
    if (this.isTransitioning) {
      this.transitionElapsed += scaledDelta;
      if (this.transitionElapsed >= this.transitionDuration) {
        this.isTransitioning = false;
      }
    }

    // ── Run the active controller to compute desired position ─────────
    let desiredX = this.smoothX;
    let desiredY = this.smoothY;

    switch (this.activeController) {
      case 'follow':
        ({ x: desiredX, y: desiredY } = this._computeFollow(scaledDelta));
        break;
      case 'lookAhead':
        ({ x: desiredX, y: desiredY } = this._computeLookAhead(scaledDelta));
        break;
      case 'framing':
        ({ x: desiredX, y: desiredY } = this._computeFraming(scaledDelta));
        break;
      case 'targetLock':
        ({ x: desiredX, y: desiredY } = this._computeTargetLock(scaledDelta));
        break;
    }

    // ── Blend with transition if active ───────────────────────────────
    if (this.isTransitioning) {
      const rawT = this.transitionElapsed / this.transitionDuration;
      const t = this._easeTransition(Phaser.Math.Clamp(rawT, 0, 1));
      desiredX = Phaser.Math.Linear(this.transitionStartPos.x, desiredX, t);
      desiredY = Phaser.Math.Linear(this.transitionStartPos.y, desiredY, t);
    }

    // ── Apply bounds ──────────────────────────────────────────────────
    const bounded = this._applyBounds(desiredX, desiredY);
    this.smoothX = bounded.x;
    this.smoothY = bounded.y;

    // ── Apply shake ───────────────────────────────────────────────────
    this._updateShake(scaledDelta);

    // ── Commit to Phaser camera ───────────────────────────────────────
    const finalX = this.smoothX + this.shakeOffset.x;
    const finalY = this.smoothY + this.shakeOffset.y;

    this.camera.centerOn(finalX, finalY);

    // ── Debug visualization ───────────────────────────────────────────
    if (this.debugEnabled) {
      this._drawDebug();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Controller: Follow
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Standard follow controller with deadzone and lerp.
   * @param {number} delta
   * @returns {{ x: number, y: number }}
   */
  updateFollow(delta) {
    return this._computeFollow(delta);
  }

  /**
   * @private
   */
  _computeFollow(delta) {
    if (!this.target) return { x: this.smoothX, y: this.smoothY };

    const cfg = this.controllers.follow;
    const targetX = this.target.x + cfg.offsetX;
    const targetY = this.target.y + cfg.offsetY;

    let dx = targetX - this.smoothX;
    let dy = targetY - this.smoothY;

    // Apply deadzone: only move if target is outside the deadzone rectangle
    if (this.deadzoneEnabled) {
      const halfW = cfg.deadzoneWidth * 0.5;
      const halfH = cfg.deadzoneHeight * 0.5;
      if (Math.abs(dx) < halfW) dx = 0;
      else dx -= Math.sign(dx) * halfW;

      if (Math.abs(dy) < halfH) dy = 0;
      else dy -= Math.sign(dy) * halfH;
    }

    // Delta-adjusted lerp factor (frame-rate independent)
    const factor = 1 - Math.pow(1 - cfg.lerpX, delta / 16.667);
    const factorY = 1 - Math.pow(1 - cfg.lerpY, delta / 16.667);

    const newX = this.smoothX + dx * factor;
    const newY = this.smoothY + dy * factorY;

    return { x: newX, y: newY };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Controller: LookAhead
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Predictive camera that leads the target based on velocity.
   * @param {number} delta
   * @returns {{ x: number, y: number }}
   */
  updateLookAhead(delta) {
    return this._computeLookAhead(delta);
  }

  /**
   * @private
   */
  _computeLookAhead(delta) {
    if (!this.target) return { x: this.smoothX, y: this.smoothY };

    const cfg = this.controllers.lookAhead;

    // Estimate target velocity (use physics body if available, else compute from position delta)
    let velX = 0;
    let velY = 0;

    if (this.target.body && this.target.body.velocity) {
      velX = this.target.body.velocity.x;
      velY = this.target.body.velocity.y;
    } else {
      velX = (this.target.x - this.prevTargetX) / Math.max(delta, 1) * 16.667;
      velY = (this.target.y - this.prevTargetY) / Math.max(delta, 1) * 16.667;
    }

    this.prevTargetX = this.target.x;
    this.prevTargetY = this.target.y;

    // Smooth the look-ahead velocity accumulator
    const smoothFactor = 1 - Math.pow(1 - cfg.lookAheadSmoothing, delta / 16.667);
    this.lookAheadVelX += (velX - this.lookAheadVelX) * smoothFactor;
    this.lookAheadVelY += (velY - this.lookAheadVelY) * smoothFactor;

    // Normalize velocity direction and scale by look-ahead distance
    const speed = Math.sqrt(
      this.lookAheadVelX * this.lookAheadVelX +
      this.lookAheadVelY * this.lookAheadVelY
    );

    let aheadX = 0;
    let aheadY = 0;

    if (speed > 1) {
      const normalizedX = this.lookAheadVelX / speed;
      const normalizedY = this.lookAheadVelY / speed;
      const clampedSpeed = Math.min(speed, 300);
      const influence = (clampedSpeed / 300) * cfg.velocityInfluence;
      aheadX = normalizedX * cfg.lookAheadDistance * influence;
      aheadY = normalizedY * cfg.lookAheadDistance * influence;
    }

    const targetX = this.target.x + cfg.offsetX + aheadX;
    const targetY = this.target.y + cfg.offsetY + aheadY;

    const lerpFactor = 1 - Math.pow(1 - cfg.lerpX, delta / 16.667);
    const lerpFactorY = 1 - Math.pow(1 - cfg.lerpY, delta / 16.667);

    const newX = this.smoothX + (targetX - this.smoothX) * lerpFactor;
    const newY = this.smoothY + (targetY - this.smoothY) * lerpFactorY;

    return { x: newX, y: newY };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Controller: Framing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Multi-target framing controller. Computes a bounding rectangle around
   * all tracked targets (with per-target weight) and adjusts zoom to fit.
   * @param {number} delta
   * @returns {{ x: number, y: number }}
   */
  updateFraming(delta) {
    return this._computeFraming(delta);
  }

  /**
   * @private
   */
  _computeFraming(delta) {
    const activeTargets = this.targets.filter(t => t && t.active !== false);
    if (activeTargets.length === 0) {
      return { x: this.smoothX, y: this.smoothY };
    }

    const cfg = this.controllers.framing;

    // Compute weighted centroid and bounding box
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const target of activeTargets) {
      const weight = target.cameraWeight ?? cfg.weightDefault;
      totalWeight += weight;
      weightedX += target.x * weight;
      weightedY += target.y * weight;

      if (target.x < minX) minX = target.x;
      if (target.y < minY) minY = target.y;
      if (target.x > maxX) maxX = target.x;
      if (target.y > maxY) maxY = target.y;
    }

    const centroidX = weightedX / totalWeight;
    const centroidY = weightedY / totalWeight;

    // Calculate desired zoom to fit all targets with padding
    const boundsWidth = (maxX - minX) + cfg.paddingX * 2;
    const boundsHeight = (maxY - minY) + cfg.paddingY * 2;

    const zoomX = this.camera.width / Math.max(boundsWidth, 1);
    const zoomY = this.camera.height / Math.max(boundsHeight, 1);
    const desiredZoom = Phaser.Math.Clamp(
      Math.min(zoomX, zoomY),
      cfg.minZoom,
      cfg.maxZoom
    );

    // Smoothly interpolate zoom
    const zoomFactor = 1 - Math.pow(1 - cfg.zoomLerp, delta / 16.667);
    this.currentZoom += (desiredZoom - this.currentZoom) * zoomFactor;
    this.camera.setZoom(this.currentZoom);

    // Smoothly move toward centroid
    const lerpFactor = 1 - Math.pow(1 - cfg.lerpX, delta / 16.667);
    const lerpFactorY = 1 - Math.pow(1 - cfg.lerpY, delta / 16.667);

    const newX = this.smoothX + (centroidX - this.smoothX) * lerpFactor;
    const newY = this.smoothY + (centroidY - this.smoothY) * lerpFactorY;

    return { x: newX, y: newY };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Controller: Target Lock
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hard lock onto a single target (e.g., during combat focus). Higher lerp
   * and optional zoom adjustment for cinematic lock-on effect.
   * @param {number} delta
   * @returns {{ x: number, y: number }}
   */
  updateTargetLock(delta) {
    return this._computeTargetLock(delta);
  }

  /**
   * @private
   */
  _computeTargetLock(delta) {
    if (!this.target) return { x: this.smoothX, y: this.smoothY };

    const cfg = this.controllers.targetLock;
    const targetX = this.target.x + cfg.offsetX;
    const targetY = this.target.y + cfg.offsetY;

    // Stronger lerp for a snappier lock-on feel
    const strength = cfg.lockStrength;
    const lerpFactor = 1 - Math.pow(1 - cfg.lerpX * strength, delta / 16.667);
    const lerpFactorY = 1 - Math.pow(1 - cfg.lerpY * strength, delta / 16.667);

    const newX = this.smoothX + (targetX - this.smoothX) * lerpFactor;
    const newY = this.smoothY + (targetY - this.smoothY) * lerpFactorY;

    // Smoothly approach the configured zoom level
    if (!this.isZooming) {
      const zoomLerp = 1 - Math.pow(0.95, delta / 16.667);
      this.currentZoom += (cfg.zoomLevel - this.currentZoom) * zoomLerp;
      this.camera.setZoom(this.currentZoom);
    }

    return { x: newX, y: newY };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Statistics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return a snapshot of the camera system's runtime statistics.
   * @returns {Object}
   */
  getStatistics() {
    return {
      ...this.stats,
      activeController: this.activeController,
      currentZoom: this.currentZoom,
      isShaking: this.isShaking,
      isZooming: this.isZooming,
      isTransitioning: this.isTransitioning,
      timeScale: this.timeScale,
      targetCount: this.targets.length,
      position: { x: this.smoothX, y: this.smoothY },
      bounds: this.bounds ? { ...this.bounds } : null
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Debug Visualization
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Enable or disable real-time debug visualization.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugEnabled = enabled;

    if (!enabled && this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Draw debug overlays: deadzone rectangle, bounds outline, target indicators,
   * current controller label, and camera center crosshair.
   * @private
   */
  _drawDebug() {
    if (!this.scene || !this.scene.add) return;

    // Create the debug graphics object lazily
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(9999);
    }

    this.debugGraphics.clear();

    const cam = this.camera;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    const viewW = cam.width;
    const viewH = cam.height;

    // ── Camera center crosshair ───────────────────────────────────────
    const cx = this.smoothX;
    const cy = this.smoothY;
    this.debugGraphics.lineStyle(1, 0x00ff00, 0.6);
    this.debugGraphics.lineBetween(cx - 12, cy, cx + 12, cy);
    this.debugGraphics.lineBetween(cx, cy - 12, cx, cy + 12);

    // ── Deadzone rectangle ────────────────────────────────────────────
    if (this.deadzoneEnabled) {
      const dzW = this.deadzone.width;
      const dzH = this.deadzone.height;
      this.debugGraphics.lineStyle(1, 0xffff00, 0.5);
      this.debugGraphics.strokeRect(
        cx - dzW * 0.5,
        cy - dzH * 0.5,
        dzW,
        dzH
      );
    }

    // ── Bounds outline ────────────────────────────────────────────────
    if (this.bounds) {
      this.debugGraphics.lineStyle(2, 0xff0000, 0.4);
      this.debugGraphics.strokeRect(
        this.bounds.x,
        this.bounds.y,
        this.bounds.width,
        this.bounds.height
      );

      // Soft-edge region
      if (this.softEdgeEnabled) {
        this.debugGraphics.lineStyle(1, 0xff6600, 0.25);
        this.debugGraphics.strokeRect(
          this.bounds.x + this.softEdgeSize,
          this.bounds.y + this.softEdgeSize,
          this.bounds.width - this.softEdgeSize * 2,
          this.bounds.height - this.softEdgeSize * 2
        );
      }
    }

    // ── Target indicators ─────────────────────────────────────────────
    if (this.target) {
      this.debugGraphics.lineStyle(2, 0x00ffff, 0.8);
      this.debugGraphics.strokeCircle(this.target.x, this.target.y, 10);
    }

    for (const t of this.targets) {
      if (t && t.active !== false) {
        this.debugGraphics.lineStyle(1, 0xff00ff, 0.6);
        this.debugGraphics.strokeCircle(t.x, t.y, 8);
      }
    }

    // ── Controller label ──────────────────────────────────────────────
    // Use a cached text object to avoid creating new text every frame
    if (!this._debugText) {
      this._debugText = this.scene.add.text(10, 10, '', {
        fontSize: '12px',
        color: '#00ff00',
        backgroundColor: '#000000aa'
      }).setScrollFactor(0).setDepth(10000);
    }
    this._debugText.setText(
      `Camera: ${this.activeController} | ` +
      `Zoom: ${this.currentZoom.toFixed(2)} | ` +
      `Pos: (${this.smoothX.toFixed(0)}, ${this.smoothY.toFixed(0)}) | ` +
      `TimeScale: ${this.timeScale.toFixed(2)}`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tear down listeners, debug graphics, and internal references.
   * Call this when the scene shuts down.
   */
  destroy() {
    // Remove EventBus listeners
    if (this._unbindHandles) {
      for (const unsub of this._unbindHandles) {
        if (typeof unsub === 'function') unsub();
      }
      this._unbindHandles = [];
    }

    // Destroy debug visuals
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    if (this._debugText) {
      this._debugText.destroy();
      this._debugText = null;
    }

    this.target = null;
    this.targets = [];
    this.scene = null;
    this.camera = null;

    this.eventBus.emit('camera:destroyed');
  }
}

export default AdvancedCameraSystem;
