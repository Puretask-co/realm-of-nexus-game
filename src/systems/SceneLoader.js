import { EventBus } from '../core/EventBus.js';
import { SCENE_FORMAT_VERSION } from '../configs/sceneFormatSpec.js';

/**
 * SceneLoader - Runtime loader for scene JSON files.
 * Instantiates all objects, lighting, triggers, and environment settings
 * defined in a .scene.json file into a live Phaser scene.
 */
export class SceneLoader {
  static instance = null;

  constructor() {
    if (SceneLoader.instance) return SceneLoader.instance;
    this.eventBus = EventBus.getInstance();
    this.loadedScenes = new Map();
    this.prefabs = new Map();
    this.objectFactories = new Map();

    // Register default object factories
    this.registerDefaultFactories();

    SceneLoader.instance = this;
  }

  static getInstance() {
    if (!SceneLoader.instance) new SceneLoader();
    return SceneLoader.instance;
  }

  // ─── Factory Registration ─────────────────────────────────────────

  registerDefaultFactories() {
    this.objectFactories.set('sprite', (scene, obj) => {
      const sprite = scene.add.sprite(obj.x, obj.y, obj.texture, obj.frame);
      this.applyCommonProperties(sprite, obj);
      if (obj.physics?.enabled) {
        scene.physics.add.existing(sprite, obj.physics.type === 'static');
        if (obj.physics.collides === false) sprite.body.setImmovable(true);
      }
      return sprite;
    });

    this.objectFactories.set('tilemap', (scene, obj) => {
      // Tilemap objects are handled separately
      return null;
    });

    this.objectFactories.set('zone', (scene, obj) => {
      const zone = scene.add.zone(obj.x, obj.y, obj.width || 32, obj.height || 32);
      zone.setOrigin(0, 0);
      if (obj.physics?.enabled) {
        scene.physics.add.existing(zone, true);
      }
      return zone;
    });

    this.objectFactories.set('trigger', (scene, obj) => {
      const zone = scene.add.zone(obj.x, obj.y, obj.width || 32, obj.height || 32);
      zone.setOrigin(0, 0);
      scene.physics.add.existing(zone, true);
      zone.setData('trigger', true);
      zone.setData('event', obj.properties?.event || '');
      zone.setData('oneShot', obj.properties?.oneShot || false);
      zone.setData('conditions', obj.properties?.conditions || []);
      return zone;
    });

    this.objectFactories.set('decor', (scene, obj) => {
      if (obj.texture) {
        const sprite = scene.add.sprite(obj.x, obj.y, obj.texture, obj.frame);
        this.applyCommonProperties(sprite, obj);
        return sprite;
      }
      const rect = scene.add.rectangle(obj.x, obj.y, obj.width || 32, obj.height || 32, obj.tint || 0x888888);
      this.applyCommonProperties(rect, obj);
      return rect;
    });

    this.objectFactories.set('npc', (scene, obj) => {
      const sprite = scene.add.sprite(obj.x, obj.y, obj.texture || 'npc_default', obj.frame);
      this.applyCommonProperties(sprite, obj);
      sprite.setData('npcId', obj.properties?.npcId || obj.id);
      sprite.setData('dialogue', obj.properties?.dialogue || '');
      sprite.setInteractive();
      return sprite;
    });

    this.objectFactories.set('enemy', (scene, obj) => {
      const sprite = scene.add.sprite(obj.x, obj.y, obj.texture || 'enemy_default', obj.frame);
      this.applyCommonProperties(sprite, obj);
      if (obj.physics?.enabled !== false) {
        scene.physics.add.existing(sprite);
      }
      sprite.setData('enemyId', obj.properties?.enemyId || '');
      sprite.setData('level', obj.properties?.level || 1);
      return sprite;
    });

    this.objectFactories.set('interactive', (scene, obj) => {
      const sprite = scene.add.sprite(obj.x, obj.y, obj.texture || 'interactive_default', obj.frame);
      this.applyCommonProperties(sprite, obj);
      sprite.setInteractive();
      sprite.setData('interactionType', obj.properties?.interactionType || 'examine');
      sprite.setData('interactionData', obj.properties?.interactionData || {});
      return sprite;
    });
  }

  registerFactory(type, factory) {
    this.objectFactories.set(type, factory);
  }

  applyCommonProperties(gameObject, obj) {
    if (obj.width && gameObject.setDisplaySize) gameObject.setDisplaySize(obj.width, obj.height || obj.width);
    if (obj.rotation !== undefined) gameObject.setRotation(obj.rotation);
    if (obj.scaleX !== undefined) gameObject.setScale(obj.scaleX, obj.scaleY ?? obj.scaleX);
    if (obj.alpha !== undefined) gameObject.setAlpha(obj.alpha);
    if (obj.depth !== undefined) gameObject.setDepth(obj.depth);
    if (obj.visible !== undefined) gameObject.setVisible(obj.visible);
    if (obj.tint !== undefined && gameObject.setTint) gameObject.setTint(obj.tint);
    if (obj.flipX && gameObject.setFlipX) gameObject.setFlipX(true);
    if (obj.flipY && gameObject.setFlipY) gameObject.setFlipY(true);
    if (obj.name) gameObject.setName(obj.name);
    if (obj.id) gameObject.setData('sceneObjectId', obj.id);
    if (obj.layer) gameObject.setData('layer', obj.layer);
    if (obj.properties) {
      for (const [key, value] of Object.entries(obj.properties)) {
        gameObject.setData(key, value);
      }
    }
  }

  // ─── Prefab System ────────────────────────────────────────────────

  registerPrefab(id, template) {
    this.prefabs.set(id, template);
  }

  instantiatePrefab(scene, prefabId, overrides = {}) {
    const template = this.prefabs.get(prefabId);
    if (!template) {
      console.warn(`SceneLoader: Unknown prefab '${prefabId}'`);
      return null;
    }
    const merged = this.deepMerge(template, overrides);
    merged.id = `${prefabId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return this.createObject(scene, merged);
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object') {
        result[key] = this.deepMerge(target[key], value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ─── Scene Loading ────────────────────────────────────────────────

  async loadSceneFromFile(scene, path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sceneData = await response.json();
      return this.loadSceneData(scene, sceneData);
    } catch (err) {
      console.error(`SceneLoader: Failed to load scene from ${path}: ${err.message}`);
      throw err;
    }
  }

  loadSceneData(scene, sceneData) {
    const startTime = performance.now();
    const result = {
      objects: [],
      lights: [],
      triggers: [],
      spawnPoints: [],
      paths: []
    };

    // Validate version
    if (sceneData.metadata?.version && sceneData.metadata.version !== SCENE_FORMAT_VERSION) {
      console.warn(`SceneLoader: Scene version ${sceneData.metadata.version} may not be compatible with loader version ${SCENE_FORMAT_VERSION}`);
    }

    // Set up camera
    if (sceneData.camera) {
      this.setupCamera(scene, sceneData.camera);
    }

    // Set up environment
    if (sceneData.environment) {
      this.setupEnvironment(scene, sceneData.environment);
    }

    // Create layers (used for depth sorting)
    const layerDepths = new Map();
    if (sceneData.layers) {
      for (const layer of sceneData.layers) {
        layerDepths.set(layer.id, layer.depth || 0);
      }
    }

    // Instantiate objects
    if (sceneData.objects) {
      for (const obj of sceneData.objects) {
        // Resolve prefab if specified
        let objectDef = obj;
        if (obj.prefabId && this.prefabs.has(obj.prefabId)) {
          objectDef = this.deepMerge(this.prefabs.get(obj.prefabId), obj);
        }

        // Apply layer depth
        if (objectDef.layer && layerDepths.has(objectDef.layer)) {
          objectDef.depth = (objectDef.depth || 0) + layerDepths.get(objectDef.layer);
        }

        const gameObject = this.createObject(scene, objectDef);
        if (gameObject) {
          result.objects.push(gameObject);

          // Handle children
          if (objectDef.children) {
            for (const child of objectDef.children) {
              const childObj = this.createObject(scene, {
                ...child,
                x: objectDef.x + (child.x || 0),
                y: objectDef.y + (child.y || 0)
              });
              if (childObj) result.objects.push(childObj);
            }
          }
        }
      }
    }

    // Set up triggers
    if (sceneData.triggers) {
      for (const trigger of sceneData.triggers) {
        const zone = scene.add.zone(trigger.x, trigger.y, trigger.width, trigger.height);
        zone.setOrigin(0, 0);
        scene.physics.add.existing(zone, true);
        zone.setData('triggerId', trigger.id);
        zone.setData('triggerEvent', trigger.event);
        zone.setData('oneShot', trigger.oneShot || false);
        zone.setData('conditions', trigger.conditions || []);
        zone.setData('enabled', trigger.enabled !== false);
        result.triggers.push(zone);
      }
    }

    // Store spawn points
    if (sceneData.spawnPoints) {
      result.spawnPoints = sceneData.spawnPoints;
    }

    // Store paths
    if (sceneData.paths) {
      result.paths = sceneData.paths;
    }

    // Cache the loaded scene
    const sceneId = sceneData.metadata?.id || 'unknown';
    this.loadedScenes.set(sceneId, { data: sceneData, result });

    const elapsed = performance.now() - startTime;
    console.log(`SceneLoader: Scene '${sceneData.metadata?.name || sceneId}' loaded in ${elapsed.toFixed(1)}ms (${result.objects.length} objects)`);

    this.eventBus.emit('scene:loaded', {
      id: sceneId,
      name: sceneData.metadata?.name,
      objectCount: result.objects.length,
      elapsed
    });

    return result;
  }

  createObject(scene, obj) {
    const factory = this.objectFactories.get(obj.type);
    if (!factory) {
      console.warn(`SceneLoader: No factory for object type '${obj.type}'`);
      return null;
    }
    try {
      return factory(scene, obj);
    } catch (err) {
      console.error(`SceneLoader: Error creating object ${obj.id}: ${err.message}`);
      return null;
    }
  }

  setupCamera(scene, cameraData) {
    const cam = scene.cameras.main;
    if (cameraData.x !== undefined && cameraData.y !== undefined) {
      cam.scrollX = cameraData.x;
      cam.scrollY = cameraData.y;
    }
    if (cameraData.zoom) cam.setZoom(cameraData.zoom);
    if (cameraData.bounds) {
      cam.setBounds(cameraData.bounds.x, cameraData.bounds.y, cameraData.bounds.width, cameraData.bounds.height);
    }
  }

  setupEnvironment(scene, env) {
    scene.registry.set('sapPhase', env.sapPhase || 'blue');
    scene.registry.set('weather', env.weather || 'none');
    scene.registry.set('timeOfDay', env.timeOfDay || 'noon');
    scene.registry.set('wind', { direction: env.windDirection || 0, strength: env.windStrength || 0 });
    scene.registry.set('fog', { density: env.fogDensity || 0, color: env.fogColor || '#cccccc' });

    this.eventBus.emit('environment:set', env);
  }

  // ─── Utilities ────────────────────────────────────────────────────

  getLoadedScene(sceneId) {
    return this.loadedScenes.get(sceneId) || null;
  }

  unloadScene(sceneId) {
    this.loadedScenes.delete(sceneId);
  }

  reset() {
    this.loadedScenes.clear();
  }
}

export default SceneLoader;
