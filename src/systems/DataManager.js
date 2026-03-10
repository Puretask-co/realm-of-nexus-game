import { EventBus } from '../core/EventBus.js';
import { HotReloadSystem } from './HotReloadSystem.js';
import { spellSchema } from '../schemas/spellSchema.js';
import { enemySchema } from '../schemas/enemySchema.js';
import { itemSchema } from '../schemas/itemSchema.js';
import { locationSchema } from '../schemas/locationSchema.js';

/**
 * DataManager - Central data hub for all game data.
 * Handles loading, validation, caching, querying, and hot-reload of
 * external JSON data files. Foundation of the data-driven architecture.
 */
export class DataManager {
  static instance = null;

  constructor() {
    if (DataManager.instance) return DataManager.instance;

    this.eventBus = EventBus.getInstance();

    // Raw data storage
    this.data = {
      spells: [],
      enemies: [],
      items: [],
      locations: [],
      config: {}
    };

    // Indexed caches for O(1) lookups
    this.cache = {
      spellsById: new Map(),
      enemiesById: new Map(),
      itemsById: new Map(),
      locationsById: new Map(),
      spellsByType: new Map(),
      spellsByElement: new Map(),
      spellsByTier: new Map(),
      enemiesByType: new Map(),
      enemiesByTier: new Map(),
      itemsByType: new Map(),
      itemsByRarity: new Map(),
      locationsByType: new Map()
    };

    // Schema registry
    this.schemas = {
      spells: spellSchema,
      enemies: enemySchema,
      items: itemSchema,
      locations: locationSchema
    };

    // Data file paths
    this.dataPaths = {
      spells: '/src/data/spells.json',
      enemies: '/src/data/enemies.json',
      items: '/src/data/items.json',
      locations: '/src/data/locations.json',
      config: '/src/data/config.json',
      characters: '/src/data/characters.json',
      dialogues: '/src/data/dialogues.json',
      quests: '/src/data/quests.json'
    };

    // Validation results
    this.validationErrors = [];
    this.validationWarnings = [];

    // Hot-reload state
    this.hotReloadEnabled = false;
    this.hotReloadInterval = null;
    this.fileHashes = new Map();

    // Custom data sources
    this.customSources = new Map();

    // Modification tracking for modding support
    this.modifications = new Map();

    DataManager.instance = this;
  }

  static getInstance() {
    if (!DataManager.instance) new DataManager();
    return DataManager.instance;
  }

  // ─── Loading ──────────────────────────────────────────────────────

  async loadAllData() {
    const startTime = performance.now();
    const results = {};

    const loadPromises = Object.entries(this.dataPaths).map(async ([key, path]) => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
        const text = await response.text();
        results[key] = JSON.parse(text);
        this.fileHashes.set(key, this.hashString(text));
      } catch (err) {
        console.warn(`DataManager: Failed to load ${key} from ${path}: ${err.message}`);
        results[key] = key === 'config' ? {} : [];
      }
    });

    await Promise.all(loadPromises);

    // Apply loaded data
    for (const [key, value] of Object.entries(results)) {
      this.data[key] = value;
    }

    const elapsed = performance.now() - startTime;
    console.log(`DataManager: All data loaded in ${elapsed.toFixed(1)}ms`);

    this.eventBus.emit('data:loaded', { keys: Object.keys(results), elapsed });
    return this.data;
  }

  async loadDataFile(key, path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      this.data[key] = JSON.parse(text);
      this.fileHashes.set(key, this.hashString(text));
      this.eventBus.emit('data:fileLoaded', { key, path });
      return this.data[key];
    } catch (err) {
      console.error(`DataManager: Failed to load ${key}: ${err.message}`);
      throw err;
    }
  }

  registerDataSource(key, path, schema = null) {
    this.dataPaths[key] = path;
    if (schema) this.schemas[key] = schema;
    this.data[key] = [];
    this.customSources.set(key, { path, schema });
  }

  // ─── Validation ───────────────────────────────────────────────────

  validateAllData() {
    this.validationErrors = [];
    this.validationWarnings = [];

    for (const [key, schema] of Object.entries(this.schemas)) {
      const dataArray = this.data[key];
      if (!Array.isArray(dataArray)) continue;

      for (let i = 0; i < dataArray.length; i++) {
        this.validateEntry(key, dataArray[i], schema, i);
      }

      // Check for duplicate IDs
      this.checkDuplicateIds(key, dataArray);
    }

    // Cross-reference validation
    this.validateCrossReferences();

    // Log results
    if (this.validationErrors.length > 0) {
      console.error(`DataManager: ${this.validationErrors.length} validation errors found:`);
      this.validationErrors.forEach(e => console.error(`  - ${e}`));
    }
    if (this.validationWarnings.length > 0) {
      console.warn(`DataManager: ${this.validationWarnings.length} validation warnings:`);
      this.validationWarnings.forEach(w => console.warn(`  - ${w}`));
    }
    if (this.validationErrors.length === 0 && this.validationWarnings.length === 0) {
      console.log('DataManager: All data validated successfully');
    }

    this.eventBus.emit('data:validated', {
      errors: this.validationErrors.length,
      warnings: this.validationWarnings.length
    });

    return {
      valid: this.validationErrors.length === 0,
      errors: this.validationErrors,
      warnings: this.validationWarnings
    };
  }

  validateEntry(dataKey, entry, schema, index) {
    const prefix = `${dataKey}[${index}]`;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (entry[field] === undefined || entry[field] === null) {
          this.validationErrors.push(`${prefix}: Missing required field '${field}'`);
        }
      }
    }

    // Check property types and constraints
    if (schema.properties) {
      for (const [field, rules] of Object.entries(schema.properties)) {
        if (entry[field] === undefined) continue;
        const value = entry[field];

        // Type check
        if (rules.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rules.type) {
            this.validationErrors.push(
              `${prefix}.${field}: Expected type '${rules.type}', got '${actualType}'`
            );
            continue;
          }
        }

        // Enum check
        if (rules.enum && !rules.enum.includes(value)) {
          this.validationErrors.push(
            `${prefix}.${field}: Value '${value}' not in allowed values [${rules.enum.join(', ')}]`
          );
        }

        // Number range
        if (rules.min !== undefined && value < rules.min) {
          this.validationErrors.push(
            `${prefix}.${field}: Value ${value} below minimum ${rules.min}`
          );
        }
        if (rules.max !== undefined && value > rules.max) {
          this.validationErrors.push(
            `${prefix}.${field}: Value ${value} above maximum ${rules.max}`
          );
        }

        // String length
        if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
          this.validationErrors.push(
            `${prefix}.${field}: String length ${value.length} below minimum ${rules.minLength}`
          );
        }
        if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
          this.validationErrors.push(
            `${prefix}.${field}: String length ${value.length} above maximum ${rules.maxLength}`
          );
        }

        // Pattern check
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
          this.validationErrors.push(
            `${prefix}.${field}: Value '${value}' does not match required pattern`
          );
        }
      }
    }
  }

  checkDuplicateIds(dataKey, dataArray) {
    const ids = new Set();
    for (const entry of dataArray) {
      if (entry.id) {
        if (ids.has(entry.id)) {
          this.validationErrors.push(`${dataKey}: Duplicate ID '${entry.id}'`);
        }
        ids.add(entry.id);
      }
    }
  }

  validateCrossReferences() {
    // Validate enemy abilities reference valid spells
    for (const enemy of this.data.enemies) {
      if (enemy.abilities) {
        for (const ability of enemy.abilities) {
          if (ability.spellId && !this.data.spells.find(s => s.id === ability.spellId)) {
            this.validationWarnings.push(
              `enemies.${enemy.id}: Ability references unknown spell '${ability.spellId}'`
            );
          }
        }
      }
      // Validate loot table references valid items
      if (enemy.lootTable) {
        for (const loot of enemy.lootTable) {
          if (loot.itemId && !this.data.items.find(i => i.id === loot.itemId)) {
            this.validationWarnings.push(
              `enemies.${enemy.id}: Loot table references unknown item '${loot.itemId}'`
            );
          }
        }
      }
    }

    // Validate location spawn references valid enemies
    for (const location of this.data.locations) {
      if (location.spawns) {
        for (const spawn of location.spawns) {
          if (spawn.enemyId && !this.data.enemies.find(e => e.id === spawn.enemyId)) {
            this.validationWarnings.push(
              `locations.${location.id}: Spawn references unknown enemy '${spawn.enemyId}'`
            );
          }
        }
      }
      // Validate connections reference valid locations
      if (location.connections) {
        for (const conn of location.connections) {
          if (conn.targetLocationId && !this.data.locations.find(l => l.id === conn.targetLocationId)) {
            this.validationWarnings.push(
              `locations.${location.id}: Connection references unknown location '${conn.targetLocationId}'`
            );
          }
        }
      }
    }
  }

  // ─── Cache Building ───────────────────────────────────────────────

  buildCaches() {
    // Clear existing caches
    for (const cache of Object.values(this.cache)) {
      cache.clear();
    }

    // Build spell caches
    for (const spell of this.data.spells) {
      this.cache.spellsById.set(spell.id, spell);
      this.addToGroupCache(this.cache.spellsByType, spell.type, spell);
      if (spell.element) this.addToGroupCache(this.cache.spellsByElement, spell.element, spell);
      if (spell.tier) this.addToGroupCache(this.cache.spellsByTier, spell.tier, spell);
    }

    // Build enemy caches
    for (const enemy of this.data.enemies) {
      this.cache.enemiesById.set(enemy.id, enemy);
      this.addToGroupCache(this.cache.enemiesByType, enemy.type, enemy);
      if (enemy.tier) this.addToGroupCache(this.cache.enemiesByTier, enemy.tier, enemy);
    }

    // Build item caches
    for (const item of this.data.items) {
      this.cache.itemsById.set(item.id, item);
      this.addToGroupCache(this.cache.itemsByType, item.type, item);
      this.addToGroupCache(this.cache.itemsByRarity, item.rarity, item);
    }

    // Build location caches
    for (const location of this.data.locations) {
      this.cache.locationsById.set(location.id, location);
      this.addToGroupCache(this.cache.locationsByType, location.type, location);
    }

    console.log('DataManager: Caches built - ' +
      `${this.cache.spellsById.size} spells, ` +
      `${this.cache.enemiesById.size} enemies, ` +
      `${this.cache.itemsById.size} items, ` +
      `${this.cache.locationsById.size} locations`
    );

    this.eventBus.emit('data:cachesBuilt');
  }

  addToGroupCache(cacheMap, key, entry) {
    if (!cacheMap.has(key)) {
      cacheMap.set(key, []);
    }
    cacheMap.get(key).push(entry);
  }

  // ─── Querying ─────────────────────────────────────────────────────

  getSpell(id) { return this.cache.spellsById.get(id) || null; }
  getEnemy(id) { return this.cache.enemiesById.get(id) || null; }
  getItem(id) { return this.cache.itemsById.get(id) || null; }
  getLocation(id) { return this.cache.locationsById.get(id) || null; }

  getSpellsByType(type) { return this.cache.spellsByType.get(type) || []; }
  getSpellsByElement(element) { return this.cache.spellsByElement.get(element) || []; }
  getSpellsByTier(tier) { return this.cache.spellsByTier.get(tier) || []; }
  getEnemiesByType(type) { return this.cache.enemiesByType.get(type) || []; }
  getEnemiesByTier(tier) { return this.cache.enemiesByTier.get(tier) || []; }
  getItemsByType(type) { return this.cache.itemsByType.get(type) || []; }
  getItemsByRarity(rarity) { return this.cache.itemsByRarity.get(rarity) || []; }
  getLocationsByType(type) { return this.cache.locationsByType.get(type) || []; }

  getConfig(path = null) {
    if (!path) return this.data.config;
    const parts = path.split('.');
    let current = this.data.config;
    for (const part of parts) {
      if (current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  // Advanced querying with filters
  query(dataKey, filters = {}) {
    const dataArray = this.data[dataKey];
    if (!Array.isArray(dataArray)) return [];

    return dataArray.filter(entry => {
      for (const [field, condition] of Object.entries(filters)) {
        const value = entry[field];

        if (typeof condition === 'function') {
          if (!condition(value)) return false;
        } else if (typeof condition === 'object' && condition !== null) {
          if (condition.min !== undefined && value < condition.min) return false;
          if (condition.max !== undefined && value > condition.max) return false;
          if (condition.in && !condition.in.includes(value)) return false;
          if (condition.notIn && condition.notIn.includes(value)) return false;
          if (condition.contains && Array.isArray(value) && !value.includes(condition.contains)) return false;
          if (condition.pattern && typeof value === 'string' && !condition.pattern.test(value)) return false;
        } else {
          if (value !== condition) return false;
        }
      }
      return true;
    });
  }

  // ─── Hot Reload ───────────────────────────────────────────────────

  /**
   * Enable hot-reload using HotReloadSystem (Vite HMR preferred, polling fallback).
   * Registers all data modules so changes are automatically detected and applied.
   */
  enableHotReload(intervalMs = 2000) {
    if (this.hotReloadEnabled) return;
    this.hotReloadEnabled = true;

    const hotReload = HotReloadSystem.getInstance();
    hotReload.initialize();

    // Register each data path with HotReloadSystem
    for (const [key, path] of Object.entries(this.dataPaths)) {
      hotReload.registerModule(key, path, (newData) => {
        this.applyReloadedData(key, newData);
      });
    }

    // If HotReloadSystem fell back to polling, use the caller's interval
    if (hotReload.mode === 'polling') {
      hotReload.pollingRate = intervalMs;
    }

    console.log(`DataManager: Hot reload enabled via HotReloadSystem (mode: ${hotReload.mode})`);
    this.eventBus.emit('data:hotReloadEnabled', { mode: hotReload.mode });
  }

  /**
   * Apply reloaded data for a specific key, re-validate, and rebuild caches.
   */
  applyReloadedData(key, newData) {
    this.data[key] = newData;
    this.validateAllData();
    this.buildCaches();
    this.eventBus.emit('data:hotReloaded', { key, success: true });
  }

  disableHotReload() {
    if (this.hotReloadInterval) {
      clearInterval(this.hotReloadInterval);
      this.hotReloadInterval = null;
    }
    this.hotReloadEnabled = false;

    const hotReload = HotReloadSystem.getInstance();
    hotReload.shutdown();

    this.eventBus.emit('data:hotReloadDisabled');
  }

  async checkForChanges() {
    for (const [key, path] of Object.entries(this.dataPaths)) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = await response.text();
        const newHash = this.hashString(text);
        const oldHash = this.fileHashes.get(key);

        if (oldHash && newHash !== oldHash) {
          console.log(`DataManager: Change detected in ${key}, reloading...`);
          this.data[key] = JSON.parse(text);
          this.fileHashes.set(key, newHash);

          // Re-validate and rebuild caches
          this.validateAllData();
          this.buildCaches();

          this.eventBus.emit('data:hotReloaded', { key, path });
        }
      } catch (err) {
        // Silently skip failed checks
      }
    }
  }

  // ─── Data Modification (Runtime) ──────────────────────────────────

  modifyEntry(dataKey, id, modifications) {
    const entry = this.data[dataKey]?.find(e => e.id === id);
    if (!entry) {
      console.warn(`DataManager: Cannot modify ${dataKey}.${id} - not found`);
      return null;
    }

    // Track original values for undo/mod support
    if (!this.modifications.has(`${dataKey}.${id}`)) {
      this.modifications.set(`${dataKey}.${id}`, { ...entry });
    }

    Object.assign(entry, modifications);
    this.buildCaches(); // Rebuild caches to reflect changes

    this.eventBus.emit('data:modified', { dataKey, id, modifications });
    return entry;
  }

  revertModification(dataKey, id) {
    const modKey = `${dataKey}.${id}`;
    const original = this.modifications.get(modKey);
    if (!original) return null;

    const index = this.data[dataKey].findIndex(e => e.id === id);
    if (index >= 0) {
      this.data[dataKey][index] = original;
      this.modifications.delete(modKey);
      this.buildCaches();
      this.eventBus.emit('data:reverted', { dataKey, id });
      return original;
    }
    return null;
  }

  // ─── Export ───────────────────────────────────────────────────────

  exportData(dataKey) {
    return JSON.stringify(this.data[dataKey], null, 2);
  }

  exportAllData() {
    const exported = {};
    for (const [key, value] of Object.entries(this.data)) {
      exported[key] = value;
    }
    return JSON.stringify(exported, null, 2);
  }

  // ─── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    return {
      spells: this.data.spells.length,
      enemies: this.data.enemies.length,
      items: this.data.items.length,
      locations: this.data.locations.length,
      cacheSize: {
        spells: this.cache.spellsById.size,
        enemies: this.cache.enemiesById.size,
        items: this.cache.itemsById.size,
        locations: this.cache.locationsById.size
      },
      validationErrors: this.validationErrors.length,
      validationWarnings: this.validationWarnings.length,
      modifications: this.modifications.size,
      hotReload: this.hotReloadEnabled
    };
  }

  // ─── Utilities ────────────────────────────────────────────────────

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  reset() {
    this.data = { spells: [], enemies: [], items: [], locations: [], config: {} };
    for (const cache of Object.values(this.cache)) cache.clear();
    this.validationErrors = [];
    this.validationWarnings = [];
    this.modifications.clear();
    this.disableHotReload();
  }
}

export default DataManager;
