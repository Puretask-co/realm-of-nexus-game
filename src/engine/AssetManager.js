import { EventBus } from '../core/EventBus.js';

/**
 * AssetManager - Centralized asset management for the Verdance engine.
 *
 * Asset Layer providing:
 *  - Asset catalog with metadata (type, size, status)
 *  - Texture atlas creation and management
 *  - Dynamic asset loading/unloading
 *  - Asset dependency tracking
 *  - Memory budget monitoring
 *  - Asset preloading with progress reporting
 *  - Sprite sheet configuration
 *  - Audio asset management
 */
export class AssetManager {
  static instance = null;

  static getInstance() {
    if (!AssetManager.instance) new AssetManager();
    return AssetManager.instance;
  }

  constructor() {
    if (AssetManager.instance) return AssetManager.instance;

    this.eventBus = EventBus.getInstance();
    this.scene = null;
    this.catalog = new Map();         // assetId → AssetEntry
    this.atlases = new Map();         // atlasId → AtlasConfig
    this.loadQueue = [];
    this.loadedCount = 0;
    this.totalCount = 0;
    this.memoryBudgetMB = 256;

    // Asset types
    this.TYPES = {
      IMAGE: 'image',
      SPRITESHEET: 'spritesheet',
      ATLAS: 'atlas',
      AUDIO: 'audio',
      JSON: 'json',
      TILEMAP: 'tilemap',
      FONT: 'font',
      SHADER: 'shader'
    };

    AssetManager.instance = this;
  }

  init(scene) {
    this.scene = scene;
    this._scanExistingAssets();
    this.eventBus.emit('assets:initialized');
  }

  // ─── Asset Catalog ───────────────────────────────────────────────

  register(id, config) {
    const entry = {
      id,
      type: config.type || this.TYPES.IMAGE,
      path: config.path || '',
      loaded: false,
      size: 0,
      metadata: config.metadata || {},
      dependencies: config.dependencies || [],
      tags: config.tags || [],
      lastAccessed: 0,
      refCount: 0
    };

    this.catalog.set(id, entry);
    return entry;
  }

  get(id) {
    const entry = this.catalog.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.refCount++;
    }
    return entry || null;
  }

  getByType(type) {
    return [...this.catalog.values()].filter(a => a.type === type);
  }

  getByTag(tag) {
    return [...this.catalog.values()].filter(a => a.tags.includes(tag));
  }

  // ─── Loading ─────────────────────────────────────────────────────

  queueLoad(id, config) {
    this.register(id, config);
    this.loadQueue.push({ id, ...config });
    this.totalCount++;
  }

  async loadQueued() {
    if (!this.scene || this.loadQueue.length === 0) return;

    const loader = this.scene.load;
    for (const item of this.loadQueue) {
      switch (item.type) {
        case this.TYPES.IMAGE:
          loader.image(item.id, item.path);
          break;
        case this.TYPES.SPRITESHEET:
          loader.spritesheet(item.id, item.path, {
            frameWidth: item.frameWidth || 32,
            frameHeight: item.frameHeight || 32
          });
          break;
        case this.TYPES.ATLAS:
          loader.atlas(item.id, item.imagePath, item.dataPath);
          break;
        case this.TYPES.AUDIO:
          loader.audio(item.id, item.path);
          break;
        case this.TYPES.JSON:
          loader.json(item.id, item.path);
          break;
        case this.TYPES.TILEMAP:
          loader.tilemapTiledJSON(item.id, item.path);
          break;
      }
    }

    loader.on('filecomplete', (key) => {
      const entry = this.catalog.get(key);
      if (entry) {
        entry.loaded = true;
        this.loadedCount++;
        this.eventBus.emit('assets:fileLoaded', {
          id: key,
          progress: this.loadedCount / this.totalCount
        });
      }
    });

    loader.on('complete', () => {
      this.eventBus.emit('assets:allLoaded', { count: this.loadedCount });
    });

    loader.start();
    this.loadQueue = [];
  }

  isLoaded(id) {
    const entry = this.catalog.get(id);
    return entry ? entry.loaded : false;
  }

  // ─── Texture Atlas ───────────────────────────────────────────────

  createAtlas(atlasId, config) {
    const atlas = {
      id: atlasId,
      textureKey: config.textureKey || atlasId,
      frames: config.frames || [],
      tileWidth: config.tileWidth || 32,
      tileHeight: config.tileHeight || 32,
      columns: config.columns || 8,
      rows: config.rows || 8,
      margin: config.margin || 0,
      spacing: config.spacing || 0
    };

    this.atlases.set(atlasId, atlas);
    return atlas;
  }

  getAtlas(atlasId) {
    return this.atlases.get(atlasId) || null;
  }

  getAtlasFrame(atlasId, frameIndex) {
    const atlas = this.atlases.get(atlasId);
    if (!atlas) return null;

    const col = frameIndex % atlas.columns;
    const row = Math.floor(frameIndex / atlas.columns);
    return {
      x: atlas.margin + col * (atlas.tileWidth + atlas.spacing),
      y: atlas.margin + row * (atlas.tileHeight + atlas.spacing),
      width: atlas.tileWidth,
      height: atlas.tileHeight
    };
  }

  // ─── Procedural Texture Generation ───────────────────────────────

  generateTexture(id, width, height, drawCallback) {
    if (!this.scene) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    drawCallback(ctx, width, height);

    this.scene.textures.addCanvas(id, canvas);
    this.register(id, {
      type: this.TYPES.IMAGE,
      path: '[generated]',
      metadata: { width, height, generated: true }
    });

    const entry = this.catalog.get(id);
    if (entry) entry.loaded = true;
  }

  // ─── Memory Management ──────────────────────────────────────────

  getMemoryUsage() {
    let totalSize = 0;
    if (this.scene) {
      const textures = this.scene.textures;
      for (const [, entry] of this.catalog) {
        if (entry.loaded && entry.type === this.TYPES.IMAGE) {
          const tex = textures.get(entry.id);
          if (tex?.source?.[0]) {
            const src = tex.source[0];
            totalSize += (src.width || 0) * (src.height || 0) * 4; // RGBA
          }
        }
      }
    }

    return {
      textureMemoryMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      budgetMB: this.memoryBudgetMB,
      usagePercent: Math.round((totalSize / (1024 * 1024)) / this.memoryBudgetMB * 100),
      assetCount: this.catalog.size,
      loadedCount: [...this.catalog.values()].filter(a => a.loaded).length
    };
  }

  unloadUnused(maxAge = 60000) {
    const now = Date.now();
    const unloaded = [];

    for (const [id, entry] of this.catalog) {
      if (!entry.loaded) continue;
      if (entry.refCount > 0) continue;
      if (now - entry.lastAccessed < maxAge) continue;

      if (this.scene?.textures.exists(id)) {
        this.scene.textures.remove(id);
      }
      entry.loaded = false;
      unloaded.push(id);
    }

    if (unloaded.length > 0) {
      this.eventBus.emit('assets:unloaded', { ids: unloaded });
    }

    return unloaded;
  }

  // ─── Scanning ────────────────────────────────────────────────────

  _scanExistingAssets() {
    if (!this.scene) return;

    const textures = this.scene.textures;
    const textureKeys = textures.getTextureKeys();

    for (const key of textureKeys) {
      if (key.startsWith('__')) continue;
      if (!this.catalog.has(key)) {
        this.register(key, {
          type: this.TYPES.IMAGE,
          path: '[preloaded]',
          metadata: { preloaded: true }
        });
        this.catalog.get(key).loaded = true;
      }
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────

  getStats() {
    const memory = this.getMemoryUsage();
    return {
      totalAssets: this.catalog.size,
      loaded: memory.loadedCount,
      pending: this.loadQueue.length,
      atlases: this.atlases.size,
      memoryMB: memory.textureMemoryMB,
      budgetMB: this.memoryBudgetMB
    };
  }

  getAllAssets() {
    return [...this.catalog.values()];
  }
}

export default AssetManager;
