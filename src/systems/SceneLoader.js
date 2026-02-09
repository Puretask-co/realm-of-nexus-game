/**
 * SceneLoader.js
 *
 * Reads `.scene.json` data and instantiates every object, trigger zone, and
 * spawn point in a Phaser 3 scene.  Provides a registry so that other
 * systems can look up objects by ID or type at runtime.
 *
 * Expected `.scene.json` structure (simplified):
 * ```json
 * {
 *   "version": "1.0",
 *   "metadata": { "name": "Forest Clearing", "author": "designer" },
 *   "camera": { "zoom": 1, "bounds": { "x": 0, "y": 0, "w": 3200, "h": 1600 } },
 *   "lighting": { "ambientColor": "#aabbcc", "intensity": 0.8 },
 *   "objects": [ ... ],
 *   "triggers": [ ... ],
 *   "spawnPoints": [ ... ]
 * }
 * ```
 *
 * @module SceneLoader
 */

export default class SceneLoader {
  /**
   * Creates a new SceneLoader.
   *
   * @param {Phaser.Scene} scene - The Phaser scene into which objects will
   *   be instantiated.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /**
     * Registry of all objects created by the loader, keyed by their unique
     * `id` from the scene data.
     * @type {Map<string, Phaser.GameObjects.GameObject>}
     */
    this.objectRegistry = new Map();

    /**
     * The raw scene data of the most recently loaded scene.
     * @type {object|null}
     */
    this.loadedScene = null;

    /**
     * Stored spawn point definitions from the loaded scene.
     * @type {Array<{id: string, x: number, y: number, properties: object}>}
     */
    this.spawnPoints = [];
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Loads a complete scene from parsed `.scene.json` data.
   *
   * The loading order is:
   * 1. Validate the data.
   * 2. Clear any existing objects from a previous load.
   * 3. Apply camera configuration.
   * 4. Apply lighting configuration.
   * 5. Instantiate objects.
   * 6. Create trigger zones.
   * 7. Register spawn points.
   *
   * @param {object} sceneData - Parsed JSON content of a `.scene.json` file.
   * @throws {Error} If validation fails.
   */
  loadScene(sceneData) {
    this.validateSceneData(sceneData);
    this.clearScene();

    this.loadedScene = sceneData;

    // Camera
    if (sceneData.camera) {
      this._loadCamera(sceneData.camera);
    }

    // Lighting
    if (sceneData.lighting) {
      this._loadLighting(sceneData.lighting);
    }

    // Objects
    if (Array.isArray(sceneData.objects)) {
      for (const objData of sceneData.objects) {
        this.createObject(objData);
      }
    }

    // Triggers
    if (Array.isArray(sceneData.triggers)) {
      this.loadTriggers(sceneData.triggers);
    }

    // Spawn points
    if (Array.isArray(sceneData.spawnPoints)) {
      this.loadSpawnPoints(sceneData.spawnPoints);
    }
  }

  /**
   * Validates that the scene data object has the minimum required fields.
   *
   * @param {object} sceneData - The data to validate.
   * @throws {Error} If any required field is missing or malformed.
   */
  validateSceneData(sceneData) {
    if (!sceneData || typeof sceneData !== 'object') {
      throw new Error('SceneLoader: sceneData must be a non-null object.');
    }
    if (sceneData.version === undefined) {
      throw new Error('SceneLoader: sceneData is missing required "version" field.');
    }
    if (!sceneData.metadata || typeof sceneData.metadata !== 'object') {
      throw new Error('SceneLoader: sceneData is missing required "metadata" object.');
    }
    if (!Array.isArray(sceneData.objects)) {
      throw new Error('SceneLoader: sceneData is missing required "objects" array.');
    }
  }

  /**
   * Destroys every registered game object and resets internal state.
   * Called automatically at the start of {@link loadScene}.
   */
  clearScene() {
    for (const [, obj] of this.objectRegistry) {
      if (obj && typeof obj.destroy === 'function') {
        obj.destroy();
      }
    }
    this.objectRegistry.clear();
    this.spawnPoints = [];
    this.loadedScene = null;
  }

  /**
   * Creates a Phaser game object from a serialised object descriptor.
   *
   * Supported `objData.type` values:
   * - `'sprite'`    -- `scene.add.sprite`
   * - `'rectangle'` -- `scene.add.rectangle`
   * - `'circle'`    -- `scene.add.circle`
   * - `'text'`      -- `scene.add.text`
   *
   * The descriptor may also carry optional groups of properties:
   * - **transform**: `x`, `y`, `rotation`, `scaleX`, `scaleY`
   * - **appearance**: `tint`, `alpha`, `visible`, `depth`, `flipX`, `flipY`
   * - **physics**: `{ enable: true, bodyType: 'static'|'dynamic', ... }`
   * - **editorData**: arbitrary metadata stored for tooling but not used at
   *   runtime.
   *
   * @param {object} objData - Serialised object descriptor from the scene file.
   * @returns {Phaser.GameObjects.GameObject|null} The created game object, or
   *   `null` if the type is unrecognised.
   */
  createObject(objData) {
    let gameObject = null;

    // ---- Instantiate by type ----
    switch (objData.type) {
      case 'sprite':
        gameObject = this.scene.add.sprite(
          objData.x || 0,
          objData.y || 0,
          objData.texture || '',
          objData.frame
        );
        break;

      case 'rectangle':
        gameObject = this.scene.add.rectangle(
          objData.x || 0,
          objData.y || 0,
          objData.width || 64,
          objData.height || 64,
          objData.fillColor ?? 0xffffff
        );
        break;

      case 'circle':
        gameObject = this.scene.add.circle(
          objData.x || 0,
          objData.y || 0,
          objData.radius || 32,
          objData.fillColor ?? 0xffffff
        );
        break;

      case 'text':
        gameObject = this.scene.add.text(
          objData.x || 0,
          objData.y || 0,
          objData.text || '',
          objData.style || {}
        );
        break;

      default:
        console.warn(`SceneLoader: unknown object type "${objData.type}"`);
        return null;
    }

    // ---- Apply transform ----
    if (objData.rotation !== undefined) gameObject.setRotation(objData.rotation);
    if (objData.scaleX !== undefined) gameObject.setScale(objData.scaleX, objData.scaleY ?? objData.scaleX);
    if (objData.scaleY !== undefined && objData.scaleX === undefined) {
      gameObject.setScale(1, objData.scaleY);
    }

    // ---- Apply appearance ----
    if (objData.tint !== undefined && typeof gameObject.setTint === 'function') {
      gameObject.setTint(objData.tint);
    }
    if (objData.alpha !== undefined) gameObject.setAlpha(objData.alpha);
    if (objData.visible !== undefined) gameObject.setVisible(objData.visible);
    if (objData.depth !== undefined) gameObject.setDepth(objData.depth);
    if (objData.flipX !== undefined && typeof gameObject.setFlipX === 'function') {
      gameObject.setFlipX(objData.flipX);
    }
    if (objData.flipY !== undefined && typeof gameObject.setFlipY === 'function') {
      gameObject.setFlipY(objData.flipY);
    }

    // ---- Enable physics (if requested) ----
    if (objData.physics && objData.physics.enable) {
      this.scene.physics.add.existing(
        gameObject,
        objData.physics.bodyType === 'static'
      );

      if (gameObject.body) {
        if (objData.physics.immovable !== undefined) {
          gameObject.body.setImmovable(objData.physics.immovable);
        }
        if (objData.physics.bounceX !== undefined || objData.physics.bounceY !== undefined) {
          gameObject.body.setBounce(
            objData.physics.bounceX ?? 0,
            objData.physics.bounceY ?? 0
          );
        }
      }
    }

    // ---- Store editor metadata ----
    if (objData.editorData) {
      gameObject.setData('editorData', objData.editorData);
    }

    // ---- Register ----
    if (objData.id) {
      gameObject.setData('id', objData.id);
      this.objectRegistry.set(objData.id, gameObject);
    }

    return gameObject;
  }

  /**
   * Creates physics-enabled trigger zones from an array of trigger descriptors.
   *
   * Each trigger zone is a transparent Phaser Zone with an Arcade Physics body
   * that other objects can overlap.  The trigger's `onEnter` and `onLeave`
   * callback names are stored as data on the zone for external systems to read.
   *
   * @param {Array<object>} triggersData - Array of trigger descriptors.
   */
  loadTriggers(triggersData) {
    for (const t of triggersData) {
      const zone = this.scene.add.zone(
        t.x || 0,
        t.y || 0,
        t.width || 64,
        t.height || 64
      );

      this.scene.physics.add.existing(zone, true); // static body

      zone.setData('triggerType', t.triggerType || 'default');
      zone.setData('onEnter', t.onEnter || null);
      zone.setData('onLeave', t.onLeave || null);
      zone.setData('properties', t.properties || {});

      if (t.id) {
        zone.setData('id', t.id);
        this.objectRegistry.set(t.id, zone);
      }
    }
  }

  /**
   * Stores spawn point definitions.  Spawn points are not rendered; they
   * simply record locations that other systems (e.g. EnemySpawner) can query.
   *
   * @param {Array<object>} spawnPointsData - Array of spawn point descriptors.
   */
  loadSpawnPoints(spawnPointsData) {
    for (const sp of spawnPointsData) {
      this.spawnPoints.push({
        id: sp.id || `spawn_${this.spawnPoints.length}`,
        x: sp.x || 0,
        y: sp.y || 0,
        properties: sp.properties || {},
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Lookup helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieves a registered game object by its unique ID.
   *
   * @param {string} id - The object's ID as defined in the scene file.
   * @returns {Phaser.GameObjects.GameObject|undefined}
   */
  getObject(id) {
    return this.objectRegistry.get(id);
  }

  /**
   * Returns all registered objects whose scene-data `type` matches the
   * given value.
   *
   * @param {string} type - The type string to filter on (e.g. `'sprite'`).
   * @returns {Phaser.GameObjects.GameObject[]}
   */
  getObjectsByType(type) {
    const results = [];
    for (const [, obj] of this.objectRegistry) {
      if (obj.getData && obj.getData('editorData')?.type === type) {
        results.push(obj);
      }
    }
    return results;
  }

  /**
   * Returns the metadata block from the loaded scene data, or `null` if no
   * scene has been loaded.
   *
   * @returns {object|null}
   */
  getMetadata() {
    return this.loadedScene ? this.loadedScene.metadata : null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Applies camera settings from the scene data.
   *
   * @private
   * @param {object} cameraConfig
   */
  _loadCamera(cameraConfig) {
    const cam = this.scene.cameras.main;

    if (cameraConfig.zoom !== undefined) {
      cam.setZoom(cameraConfig.zoom);
    }

    if (cameraConfig.bounds) {
      const b = cameraConfig.bounds;
      cam.setBounds(b.x ?? 0, b.y ?? 0, b.w ?? 0, b.h ?? 0);
    }
  }

  /**
   * Applies lighting / ambient settings from the scene data.
   *
   * If the Phaser Lights plugin is active on the scene this sets the
   * ambient colour; otherwise it is a no-op.
   *
   * @private
   * @param {object} lightingConfig
   */
  _loadLighting(lightingConfig) {
    if (!this.scene.lights) {
      return;
    }

    if (lightingConfig.ambientColor !== undefined) {
      // Convert CSS hex string to Phaser colour if needed.
      let color = lightingConfig.ambientColor;
      if (typeof color === 'string') {
        color = Phaser.Display.Color.HexStringToColor(color).color;
      }
      this.scene.lights.setAmbientColor(color);
    }

    if (lightingConfig.intensity !== undefined) {
      // Phaser doesn't natively expose a global intensity scalar on the
      // lights manager, but we store it on the scene data for other
      // systems to read.
      this.scene.data.set('lightingIntensity', lightingConfig.intensity);
    }
  }
}
