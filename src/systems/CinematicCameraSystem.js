/**
 * CinematicCameraSystem.js
 *
 * A cinematic camera controller for Phaser 3 that provides shake presets,
 * camera zones with smooth transitions, cinematic path playback, combat
 * focus framing, and dramatic spell zoom sequences.
 *
 * @module CinematicCameraSystem
 */

export default class CinematicCameraSystem {
  /**
   * Creates a new CinematicCameraSystem.
   *
   * @param {Phaser.Scene} scene - The Phaser scene this system belongs to.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Phaser.Cameras.Scene2D.Camera} */
    this.camera = scene.cameras.main;

    /**
     * Map of named shake presets, each containing duration and intensity.
     * @type {Map<string, {duration: number, intensity: number}>}
     */
    this.shakePresets = this.createShakePresets();

    /**
     * Array of defined camera zones that trigger transitions when the
     * player enters them.
     * @type {Array<{x: number, y: number, width: number, height: number, config: object}>}
     */
    this.cameraZones = [];

    /**
     * Whether the camera is currently playing a cinematic sequence.
     * While true the camera does not follow the player.
     * @type {boolean}
     */
    this.cinematicMode = false;

    /**
     * Reference to the zone the camera is currently transitioned to,
     * or null if in the default state.
     * @type {object|null}
     */
    this.activeZone = null;
  }

  // ---------------------------------------------------------------------------
  // Shake presets
  // ---------------------------------------------------------------------------

  /**
   * Builds and returns the map of predefined camera-shake presets.
   *
   * Each preset defines:
   * - `duration` (ms) - how long the shake lasts
   * - `intensity` - the shake strength (fraction of screen dimension)
   *
   * @returns {Map<string, {duration: number, intensity: number}>}
   */
  createShakePresets() {
    const presets = new Map();

    presets.set('light_hit', { duration: 100, intensity: 0.002 });
    presets.set('heavy_hit', { duration: 200, intensity: 0.005 });
    presets.set('explosion', { duration: 400, intensity: 0.01 });
    presets.set('earthquake', { duration: 800, intensity: 0.008 });
    presets.set('spell_impact', { duration: 150, intensity: 0.004 });

    return presets;
  }

  /**
   * Triggers a camera shake using a named preset.
   *
   * @param {string} presetName - Key into the shakePresets map (e.g. 'explosion').
   * @throws {Error} If the preset name is not recognised.
   */
  shake(presetName) {
    const preset = this.shakePresets.get(presetName);

    if (!preset) {
      throw new Error(
        `CinematicCameraSystem: unknown shake preset "${presetName}". ` +
        `Available: ${[...this.shakePresets.keys()].join(', ')}`
      );
    }

    this.camera.shake(preset.duration, preset.intensity);
  }

  // ---------------------------------------------------------------------------
  // Camera zones
  // ---------------------------------------------------------------------------

  /**
   * Defines a rectangular camera zone. When the player enters the zone the
   * camera will smoothly transition to the zone's settings.
   *
   * @param {number} x      - Left edge of the zone in world coordinates.
   * @param {number} y      - Top edge of the zone in world coordinates.
   * @param {number} width  - Width of the zone.
   * @param {number} height - Height of the zone.
   * @param {object} config - Zone camera configuration.
   * @param {number} [config.zoom=1]            - Target zoom level inside the zone.
   * @param {{x: number, y: number}} [config.followOffset={x:0,y:0}] - Camera follow offset.
   * @param {number} [config.smoothing=0.1]     - Lerp factor for the transition (0-1).
   * @returns {object} The zone object that was added.
   */
  addCameraZone(x, y, width, height, config = {}) {
    const zone = {
      x,
      y,
      width,
      height,
      config: {
        zoom: config.zoom ?? 1,
        followOffset: config.followOffset ?? { x: 0, y: 0 },
        smoothing: config.smoothing ?? 0.1,
      },
    };

    this.cameraZones.push(zone);
    return zone;
  }

  /**
   * Called every frame. Checks whether the player position falls inside any
   * camera zone and triggers a smooth transition when the zone changes.
   *
   * If the camera is in cinematic mode this method does nothing.
   *
   * @param {number} playerX - Player world-space X.
   * @param {number} playerY - Player world-space Y.
   */
  update(playerX, playerY) {
    if (this.cinematicMode) {
      return;
    }

    let insideZone = null;

    for (const zone of this.cameraZones) {
      if (
        playerX >= zone.x &&
        playerX <= zone.x + zone.width &&
        playerY >= zone.y &&
        playerY <= zone.y + zone.height
      ) {
        insideZone = zone;
        break;
      }
    }

    if (insideZone !== this.activeZone) {
      if (insideZone) {
        this.transitionToZone(insideZone);
      } else {
        // Player left all zones -- transition back to defaults.
        this.transitionToZone({
          config: {
            zoom: 1,
            followOffset: { x: 0, y: 0 },
            smoothing: 0.1,
          },
        });
      }
      this.activeZone = insideZone;
    }
  }

  /**
   * Smoothly tweens the camera zoom and follow offset to match the
   * provided zone's configuration.
   *
   * @param {object} zone - A camera zone object (or default-like object).
   */
  transitionToZone(zone) {
    const { zoom, followOffset, smoothing } = zone.config;
    const duration = (1 - smoothing) * 1000; // derive duration from smoothing

    // Tween zoom
    this.scene.tweens.add({
      targets: this.camera,
      zoom,
      duration,
      ease: 'Sine.easeInOut',
    });

    // Tween follow offset
    this.scene.tweens.add({
      targets: this.camera,
      followOffset: { x: followOffset.x, y: followOffset.y },
      duration,
      ease: 'Sine.easeInOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Cinematic path playback
  // ---------------------------------------------------------------------------

  /**
   * Animates the camera along a series of waypoints, temporarily disabling
   * player follow. After the cinematic finishes the camera resumes
   * following the player.
   *
   * @param {Array<{x: number, y: number, zoom: number}>} cameraPath
   *   Ordered array of waypoints the camera will visit.
   * @param {number} duration
   *   Total duration in milliseconds for the entire path.
   */
  playCinematic(cameraPath, duration) {
    if (!cameraPath || cameraPath.length === 0) {
      return;
    }

    this.cinematicMode = true;

    // Remember the object the camera was following so we can resume later.
    const previousTarget = this.camera._follow;
    this.camera.stopFollow();

    const segmentDuration = duration / cameraPath.length;
    const timeline = this.scene.tweens.createTimeline();

    cameraPath.forEach((point) => {
      // Pan the camera to each waypoint in sequence.
      timeline.add({
        targets: this.camera,
        scrollX: point.x - this.camera.width * 0.5,
        scrollY: point.y - this.camera.height * 0.5,
        zoom: point.zoom ?? 1,
        duration: segmentDuration,
        ease: 'Sine.easeInOut',
      });
    });

    timeline.on('complete', () => {
      this.cinematicMode = false;

      // Resume following the previous target if one existed.
      if (previousTarget) {
        this.camera.startFollow(previousTarget);
      }
    });

    timeline.play();
  }

  // ---------------------------------------------------------------------------
  // Combat focus
  // ---------------------------------------------------------------------------

  /**
   * Pans the camera to the centre of the bounding box enclosing all
   * combatants and zooms to fit every combatant on screen with padding.
   *
   * @param {Array<{x: number, y: number}>} combatants
   *   Array of game objects (or plain positions) for every combatant.
   */
  focusOnCombat(combatants) {
    if (!combatants || combatants.length === 0) {
      return;
    }

    // Calculate the axis-aligned bounding box of all combatants.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of combatants) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Determine the required zoom to fit the bounding box with 20% padding.
    const padding = 1.2;
    const bbWidth = (maxX - minX) * padding || 1;
    const bbHeight = (maxY - minY) * padding || 1;
    const zoomX = this.camera.width / bbWidth;
    const zoomY = this.camera.height / bbHeight;
    const targetZoom = Math.min(zoomX, zoomY, 1); // never zoom in past 1x

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: centerX - this.camera.width * 0.5,
      scrollY: centerY - this.camera.height * 0.5,
      zoom: targetZoom,
      duration: 600,
      ease: 'Sine.easeInOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Dramatic spell zoom
  // ---------------------------------------------------------------------------

  /**
   * Plays a dramatic zoom sequence for a spell cast:
   * 1. Quick zoom in on the caster.
   * 2. Camera flash.
   * 3. Pan to the target.
   * 4. Zoom back to normal.
   *
   * @param {{x: number, y: number}} caster - The caster's position.
   * @param {{x: number, y: number}} target - The target's position.
   */
  dramaticSpellZoom(caster, target) {
    const originalZoom = this.camera.zoom;
    const previousTarget = this.camera._follow;

    this.cinematicMode = true;
    this.camera.stopFollow();

    const timeline = this.scene.tweens.createTimeline();

    // Step 1 -- zoom in on caster
    timeline.add({
      targets: this.camera,
      scrollX: caster.x - this.camera.width * 0.5,
      scrollY: caster.y - this.camera.height * 0.5,
      zoom: originalZoom * 1.8,
      duration: 300,
      ease: 'Quad.easeIn',
    });

    // Step 2 -- flash the camera (handled via callback between tweens)
    timeline.add({
      targets: this.camera,
      scrollX: caster.x - this.camera.width * 0.5,
      scrollY: caster.y - this.camera.height * 0.5,
      duration: 100,
      ease: 'Linear',
      onStart: () => {
        this.camera.flash(150, 255, 255, 255);
      },
    });

    // Step 3 -- pan to target
    timeline.add({
      targets: this.camera,
      scrollX: target.x - this.camera.width * 0.5,
      scrollY: target.y - this.camera.height * 0.5,
      zoom: originalZoom * 1.4,
      duration: 400,
      ease: 'Sine.easeInOut',
    });

    // Step 4 -- zoom back to normal
    timeline.add({
      targets: this.camera,
      zoom: originalZoom,
      duration: 350,
      ease: 'Quad.easeOut',
    });

    timeline.on('complete', () => {
      this.cinematicMode = false;

      if (previousTarget) {
        this.camera.startFollow(previousTarget);
      }
    });

    timeline.play();
  }
}
