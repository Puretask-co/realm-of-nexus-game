import { EventBus } from '../core/EventBus.js';

/**
 * CameraZoneSystem - Area-based camera behavior manager for the Verdance engine.
 *
 * Allows level designers to define rectangular (or polygonal) zones in the world
 * that automatically change the camera's controller, zoom, bounds, deadzone, and
 * post-processing effects when the player enters them.
 *
 * Features:
 *   - Five zone types with ascending priority:
 *       exploration (0) < interior (1) < combat (2) < cinematic (3) < boss_arena (4)
 *   - Smooth transitions when crossing zone boundaries
 *   - Nested / overlapping zones resolved by priority, then by specificity (smaller area)
 *   - EventBus integration for decoupled communication
 *   - Per-zone effect presets (vignette, color grade, etc.)
 *
 * Usage:
 *   const zones = new CameraZoneSystem(cameraSystem);
 *   zones.addZone({ id: 'forest_clearing', type: 'exploration', ... });
 *   // In update loop:
 *   zones.update(player.getPosition());
 */
export class CameraZoneSystem {

  // ───────────────────────────────────────────────────────────────────────────
  // Static Constants
  // ───────────────────────────────────────────────────────────────────────────

  /** Priority levels for each zone type (higher overrides lower). */
  static ZONE_PRIORITIES = {
    exploration:  0,
    interior:     1,
    combat:       2,
    cinematic:    3,
    boss_arena:   4
  };

  /** Default transition duration when entering/exiting zones (ms). */
  static DEFAULT_TRANSITION_MS = 600;

  // ───────────────────────────────────────────────────────────────────────────
  // Construction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {AdvancedCameraSystem} cameraSystem - The camera system to control.
   */
  constructor(cameraSystem) {
    /** @type {AdvancedCameraSystem} */
    this.cameraSystem = cameraSystem;

    /** @type {EventBus} */
    this.eventBus = EventBus.getInstance();

    /**
     * All registered zones, keyed by ID.
     * @type {Map<string, Object>}
     */
    this.zones = new Map();

    /**
     * The zone the player is currently inside (highest-priority winner).
     * @type {Object|null}
     */
    this.activeZone = null;

    /**
     * Stack of all overlapping zones the player is inside, sorted by
     * descending priority then ascending area (most specific first).
     * @type {Array<Object>}
     */
    this.overlappingZones = [];

    /**
     * Camera/effect state captured before any zone was entered, so we can
     * restore defaults when the player leaves all zones.
     * @type {Object|null}
     */
    this._defaultState = null;

    /** Whether the system is enabled and should process zone checks. */
    this.enabled = true;

    /** Internal ID counter for zones added without an explicit id. */
    this._nextId = 1;

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

    bind('zone:add',    (data) => this.addZone(data));
    bind('zone:remove', (data) => this.removeZone(data.id));
    bind('zone:enable', ()     => { this.enabled = true; });
    bind('zone:disable', ()    => { this.enabled = false; });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Zone Registration
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Register a new camera zone.
   *
   * @param {Object} config - Zone configuration:
   * @param {string}  [config.id]             - Unique identifier (auto-generated if omitted).
   * @param {string}   config.type            - Zone type: 'exploration'|'interior'|'combat'|'cinematic'|'boss_arena'.
   * @param {number}   config.x              - Left edge of the zone rectangle (world coords).
   * @param {number}   config.y              - Top edge.
   * @param {number}   config.width          - Zone width.
   * @param {number}   config.height         - Zone height.
   * @param {string}  [config.controller]    - Camera controller to activate ('follow', 'lookAhead', etc.).
   * @param {Object}  [config.controllerConfig] - Config to merge into the controller.
   * @param {number}  [config.zoom]          - Zoom level for this zone.
   * @param {Object}  [config.bounds]        - Camera bounds override { x, y, width, height }.
   * @param {Object}  [config.deadzone]      - Deadzone override { width, height }.
   * @param {Array}   [config.effects]       - Array of effect descriptors: { name, config }.
   * @param {number}  [config.transitionDuration] - Transition time in ms.
   * @param {number}  [config.priority]      - Manual priority override.
   * @param {boolean} [config.enabled=true]  - Whether this zone is active.
   * @returns {string} The zone's ID.
   */
  addZone(config) {
    const id = config.id || `zone_${this._nextId++}`;
    const type = config.type || 'exploration';

    const zone = {
      id,
      type,
      x: config.x ?? 0,
      y: config.y ?? 0,
      width: config.width ?? 0,
      height: config.height ?? 0,
      controller: config.controller || null,
      controllerConfig: config.controllerConfig || {},
      zoom: config.zoom ?? null,
      bounds: config.bounds || null,
      deadzone: config.deadzone || null,
      effects: config.effects || [],
      transitionDuration: config.transitionDuration ?? CameraZoneSystem.DEFAULT_TRANSITION_MS,
      priority: config.priority ?? (CameraZoneSystem.ZONE_PRIORITIES[type] || 0),
      enabled: config.enabled !== false,
      // Precomputed area for specificity tie-breaking
      _area: (config.width ?? 0) * (config.height ?? 0)
    };

    this.zones.set(id, zone);

    this.eventBus.emit('zone:added', { id, type });
    return id;
  }

  /**
   * Remove a zone by ID. If the removed zone was active, the system
   * re-evaluates overlapping zones.
   *
   * @param {string} id - Zone ID to remove.
   * @returns {boolean} True if found and removed.
   */
  removeZone(id) {
    const zone = this.zones.get(id);
    if (!zone) return false;

    this.zones.delete(id);

    // If this was the active zone, force re-evaluation
    if (this.activeZone && this.activeZone.id === id) {
      this.overlappingZones = this.overlappingZones.filter(z => z.id !== id);
      const newActive = this.overlappingZones.length > 0 ? this.overlappingZones[0] : null;

      if (newActive) {
        this._transitionToZone(newActive);
      } else {
        this.exitZone(zone);
        this.activeZone = null;
      }
    }

    this.eventBus.emit('zone:removed', { id });
    return true;
  }

  /**
   * Temporarily enable or disable a zone without removing it.
   *
   * @param {string}  id      - Zone ID.
   * @param {boolean} enabled - New enabled state.
   */
  setZoneEnabled(id, enabled) {
    const zone = this.zones.get(id);
    if (zone) {
      zone.enabled = enabled;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Zone Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get a zone by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getZone(id) {
    return this.zones.get(id) || null;
  }

  /**
   * Get all zones of a given type.
   * @param {string} type
   * @returns {Array<Object>}
   */
  getZonesByType(type) {
    const result = [];
    for (const zone of this.zones.values()) {
      if (zone.type === type) result.push(zone);
    }
    return result;
  }

  /**
   * Get the currently active zone, if any.
   * @returns {Object|null}
   */
  getActiveZone() {
    return this.activeZone;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Spatial Checks
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Test all registered zones against a world position and determine which
   * zones the player is inside.
   *
   * @param {{ x: number, y: number }} playerPosition
   * @returns {Array<Object>} Overlapping zones sorted by priority desc, area asc.
   */
  checkZones(playerPosition) {
    const overlapping = [];

    for (const zone of this.zones.values()) {
      if (!zone.enabled) continue;

      if (this._isInsideZone(playerPosition, zone)) {
        overlapping.push(zone);
      }
    }

    // Sort: highest priority first; for ties, smallest area (most specific) first
    overlapping.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a._area - b._area;
    });

    return overlapping;
  }

  /**
   * Point-in-rectangle test.
   * @private
   * @param {{ x: number, y: number }} pos
   * @param {Object} zone
   * @returns {boolean}
   */
  _isInsideZone(pos, zone) {
    return (
      pos.x >= zone.x &&
      pos.x <= zone.x + zone.width &&
      pos.y >= zone.y &&
      pos.y <= zone.y + zone.height
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Zone Transition Logic
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Called when the player enters a zone that becomes the new active zone.
   * Applies the zone's camera settings.
   *
   * @param {Object} zone - The zone being entered.
   */
  enterZone(zone) {
    // Save default camera state on first zone entry
    if (!this._defaultState) {
      this._captureDefaultState();
    }

    this._transitionToZone(zone);

    this.eventBus.emit('zone:entered', {
      id: zone.id,
      type: zone.type,
      priority: zone.priority
    });
  }

  /**
   * Called when the player exits a zone. If no other zone is active, restores
   * the default camera state.
   *
   * @param {Object} zone - The zone being exited.
   */
  exitZone(zone) {
    // Disable zone-specific effects
    for (const effect of zone.effects) {
      this.eventBus.emit('effect:disable', {
        effect: effect.name,
        fadeOut: zone.transitionDuration
      });
    }

    // Restore defaults if no zones remain
    if (this.overlappingZones.length === 0) {
      this._restoreDefaultState(zone.transitionDuration);
    }

    this.eventBus.emit('zone:exited', {
      id: zone.id,
      type: zone.type
    });
  }

  /**
   * Apply a zone's camera settings with a smooth transition.
   *
   * @private
   * @param {Object} zone
   */
  _transitionToZone(zone) {
    const duration = zone.transitionDuration;

    // Controller
    if (zone.controller) {
      this.cameraSystem.setController(
        zone.controller,
        zone.controllerConfig,
        duration
      );
    }

    // Zoom
    if (zone.zoom !== null && zone.zoom !== undefined) {
      this.cameraSystem.zoom(zone.zoom, duration, 'Cubic.easeInOut');
    }

    // Bounds
    if (zone.bounds) {
      this.cameraSystem.setBounds(
        zone.bounds.x,
        zone.bounds.y,
        zone.bounds.width,
        zone.bounds.height
      );
    }

    // Deadzone
    if (zone.deadzone) {
      this.cameraSystem.setDeadzone(zone.deadzone.width, zone.deadzone.height);
    }

    // Effects
    for (const effect of zone.effects) {
      this.eventBus.emit('effect:enable', {
        effect: effect.name,
        config: {
          ...effect.config,
          transitionDuration: duration
        }
      });
    }

    this.activeZone = zone;
  }

  /**
   * Capture the current camera configuration as the "default" state.
   * @private
   */
  _captureDefaultState() {
    this._defaultState = {
      controller: this.cameraSystem.activeController,
      controllerConfig: {},
      zoom: this.cameraSystem.currentZoom,
      bounds: this.cameraSystem.bounds ? { ...this.cameraSystem.bounds } : null,
      deadzone: {
        width: this.cameraSystem.deadzone.width,
        height: this.cameraSystem.deadzone.height
      }
    };
  }

  /**
   * Restore the default camera configuration.
   * @private
   * @param {number} duration - Transition duration in ms.
   */
  _restoreDefaultState(duration) {
    if (!this._defaultState) return;

    const state = this._defaultState;

    this.cameraSystem.setController(
      state.controller,
      state.controllerConfig,
      duration
    );

    if (state.zoom !== null) {
      this.cameraSystem.zoom(state.zoom, duration, 'Cubic.easeInOut');
    }

    if (state.bounds) {
      this.cameraSystem.setBounds(
        state.bounds.x,
        state.bounds.y,
        state.bounds.width,
        state.bounds.height
      );
    }

    if (state.deadzone) {
      this.cameraSystem.setDeadzone(state.deadzone.width, state.deadzone.height);
    }

    this.eventBus.emit('zone:defaultsRestored');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Per-Frame Update
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check the player's position against all zones and trigger
   * enter/exit transitions as needed. Call this every frame.
   *
   * @param {{ x: number, y: number }} playerPosition
   */
  update(playerPosition) {
    if (!this.enabled || !playerPosition) return;

    const newOverlapping = this.checkZones(playerPosition);

    // Determine which zones were entered and which were exited
    const newIds = new Set(newOverlapping.map(z => z.id));
    const oldIds = new Set(this.overlappingZones.map(z => z.id));

    // Zones the player just entered
    const entered = newOverlapping.filter(z => !oldIds.has(z.id));

    // Zones the player just exited
    const exited = this.overlappingZones.filter(z => !newIds.has(z.id));

    // Update the overlapping list
    this.overlappingZones = newOverlapping;

    // Handle exits first
    for (const zone of exited) {
      this.exitZone(zone);
    }

    // Determine new highest-priority zone
    const topZone = newOverlapping.length > 0 ? newOverlapping[0] : null;

    // If the top zone changed, transition to it
    if (topZone && (!this.activeZone || this.activeZone.id !== topZone.id)) {
      this.enterZone(topZone);
    } else if (!topZone && this.activeZone) {
      // Player left all zones
      this.activeZone = null;
    }

    // Fire events for newly entered zones (informational)
    for (const zone of entered) {
      if (zone !== topZone) {
        this.eventBus.emit('zone:overlapping', { id: zone.id, type: zone.type });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add multiple zones at once (e.g., loaded from a level data file).
   *
   * @param {Array<Object>} zoneConfigs - Array of zone config objects.
   * @returns {string[]} Array of assigned zone IDs.
   */
  addZones(zoneConfigs) {
    return zoneConfigs.map(config => this.addZone(config));
  }

  /**
   * Remove all zones and reset to the default camera state.
   */
  clearAllZones() {
    // Exit current zone cleanly
    if (this.activeZone) {
      this.exitZone(this.activeZone);
    }

    this.zones.clear();
    this.overlappingZones = [];
    this.activeZone = null;

    if (this._defaultState) {
      this._restoreDefaultState(CameraZoneSystem.DEFAULT_TRANSITION_MS);
    }

    this.eventBus.emit('zone:allCleared');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Debug / Inspection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return a summary of all registered zones for debug display.
   * @returns {Array<Object>}
   */
  getDebugInfo() {
    const info = [];
    for (const zone of this.zones.values()) {
      info.push({
        id: zone.id,
        type: zone.type,
        priority: zone.priority,
        enabled: zone.enabled,
        rect: { x: zone.x, y: zone.y, w: zone.width, h: zone.height },
        isActive: this.activeZone ? this.activeZone.id === zone.id : false,
        isOverlapping: this.overlappingZones.some(z => z.id === zone.id)
      });
    }
    return info;
  }

  /**
   * Draw debug rectangles for all zones using the provided Phaser Graphics.
   *
   * @param {Phaser.GameObjects.Graphics} graphics - A Graphics object to draw on.
   */
  drawDebug(graphics) {
    if (!graphics) return;

    const typeColors = {
      exploration: 0x00ff00,
      interior:    0x00aaff,
      combat:      0xff4400,
      cinematic:   0xffaa00,
      boss_arena:  0xff0066
    };

    for (const zone of this.zones.values()) {
      if (!zone.enabled) continue;

      const color = typeColors[zone.type] || 0xffffff;
      const isActive = this.activeZone && this.activeZone.id === zone.id;

      graphics.lineStyle(isActive ? 3 : 1, color, isActive ? 0.8 : 0.3);
      graphics.strokeRect(zone.x, zone.y, zone.width, zone.height);

      // Draw a small label marker in the top-left corner
      graphics.fillStyle(color, isActive ? 0.5 : 0.15);
      graphics.fillRect(zone.x, zone.y, 8, 8);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tear down the zone system: remove listeners, clear zones.
   */
  destroy() {
    this.clearAllZones();

    if (this._unbindHandles) {
      for (const unsub of this._unbindHandles) {
        if (typeof unsub === 'function') unsub();
      }
      this._unbindHandles = [];
    }

    this.cameraSystem = null;
    this._defaultState = null;
  }
}

export default CameraZoneSystem;
