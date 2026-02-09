/**
 * DataManager - Central data hub for the entire game.
 *
 * Loads all game data from external JSON files, validates it against schemas,
 * builds fast lookup caches, and supports hot-reload so that designers can
 * tweak values and see results instantly without restarting the game.
 *
 * Capabilities:
 *   - Load spells, enemies, items, locations, and balance config from JSON
 *   - Validate every record against its schema at load time
 *   - Detect duplicate IDs and broken cross-references (e.g. a spell combo
 *     referencing a spell that doesn't exist)
 *   - Build O(1) lookup caches keyed by ID
 *   - Poll for file changes every 2 seconds in dev mode and hot-reload
 *   - Emit 'data-reloaded' via the global EventBus so other systems can react
 *   - Provide query helpers: getSpell, getEnemy, getSpellsByTier, etc.
 *   - Fall back to hardcoded minimal data if JSON files are unavailable
 */

import spellSchema from '../schemas/spellSchema.js';
import enemySchema from '../schemas/enemySchema.js';

class DataManager {
  constructor() {
    this.data = {
      spells: [],
      enemies: [],
      items: [],
      locations: [],
      config: {}
    };

    this.schemas = {
      spells: spellSchema,
      enemies: enemySchema
    };

    this.loaded = false;
    this._loadPromise = null;

    // O(1) lookup caches
    this.cache = {
      spellsById: new Map(),
      enemiesById: new Map(),
      itemsById: new Map(),
      locationsById: new Map()
    };

    // Hot-reload state
    this._watchInterval = null;
    this._lastConfigTimestamp = null;

    // Validation report
    this.validationErrors = [];
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  /**
   * Load all game data. Safe to call multiple times; subsequent calls
   * return the same promise until a reload is triggered.
   */
  async loadAllData() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._doLoad();
    return this._loadPromise;
  }

  async _doLoad() {
    console.log('[DataManager] Loading game data...');

    try {
      const [spellsData, enemiesData, itemsData, locationsData, configData] =
        await Promise.all([
          this._loadJSON('./data/spells.json'),
          this._loadJSON('./data/enemies.json'),
          this._loadJSON('./data/items.json'),
          this._loadJSON('./data/locations.json'),
          this._loadJSON('./data/config.json')
        ]);

      this.data.spells = spellsData.spells || [];
      this.data.enemies = enemiesData.enemies || [];
      this.data.items = itemsData.items || [];
      this.data.locations = locationsData.locations || [];
      this.data.config = configData;

      this._lastConfigTimestamp = configData.lastModified;

      this.validateAllData();
      this._buildCaches();

      this.loaded = true;

      console.log('[DataManager] Data loaded successfully');
      console.log(`  - ${this.data.spells.length} spells`);
      console.log(`  - ${this.data.enemies.length} enemies`);
      console.log(`  - ${this.data.items.length} items`);
      console.log(`  - ${this.data.locations.length} locations`);
    } catch (err) {
      console.error('[DataManager] Failed to load data:', err);
      this._loadFallbackData();
    }
  }

  async _loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.statusText}`);
    return res.json();
  }

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  validateAllData() {
    this.validationErrors = [];

    this.data.spells.forEach((spell, i) => {
      const errs = this._validateObject(spell, this.schemas.spells);
      if (errs.length) {
        this.validationErrors.push({ type: 'spell', index: i, id: spell.id, errors: errs });
      }
    });

    this.data.enemies.forEach((enemy, i) => {
      const errs = this._validateObject(enemy, this.schemas.enemies);
      if (errs.length) {
        this.validationErrors.push({ type: 'enemy', index: i, id: enemy.id, errors: errs });
      }
    });

    this._checkDuplicateIds();
    this._checkReferences();

    if (this.validationErrors.length) {
      console.warn(`[DataManager] ${this.validationErrors.length} validation errors:`);
      this.validationErrors.forEach((e) =>
        console.warn(`  ${e.type} "${e.id}": ${e.errors.join(', ')}`)
      );
    } else {
      console.log('[DataManager] All data validated successfully');
    }
  }

  _validateObject(obj, schema) {
    const errors = [];

    // Required fields
    schema.required.forEach((field) => {
      if (!(field in obj)) errors.push(`Missing required field: ${field}`);
    });

    // Property constraints
    Object.keys(obj).forEach((key) => {
      const prop = schema.properties[key];
      if (!prop) return; // allow unknown properties for forward-compat

      const val = obj[key];

      if (prop.type === 'integer' && !Number.isInteger(val)) {
        errors.push(`${key} must be integer, got ${typeof val}`);
      } else if (prop.type === 'number' && typeof val !== 'number') {
        errors.push(`${key} must be number, got ${typeof val}`);
      } else if (prop.type === 'string' && typeof val !== 'string') {
        errors.push(`${key} must be string, got ${typeof val}`);
      } else if (prop.type === 'boolean' && typeof val !== 'boolean') {
        errors.push(`${key} must be boolean, got ${typeof val}`);
      }

      if (prop.min !== undefined && val < prop.min) {
        errors.push(`${key} must be >= ${prop.min}, got ${val}`);
      }
      if (prop.max !== undefined && val > prop.max) {
        errors.push(`${key} must be <= ${prop.max}, got ${val}`);
      }
      if (prop.minLength && typeof val === 'string' && val.length < prop.minLength) {
        errors.push(`${key} must be >= ${prop.minLength} chars`);
      }
      if (prop.maxLength && typeof val === 'string' && val.length > prop.maxLength) {
        errors.push(`${key} must be <= ${prop.maxLength} chars`);
      }
      if (prop.pattern && typeof val === 'string' && !prop.pattern.test(val)) {
        errors.push(`${key} does not match pattern`);
      }
      if (prop.enum && !prop.enum.includes(val)) {
        errors.push(`${key} must be one of: ${prop.enum.join(', ')}`);
      }
    });

    return errors;
  }

  _checkDuplicateIds() {
    const check = (arr, label) => {
      const seen = new Set();
      arr.forEach((obj) => {
        if (seen.has(obj.id)) {
          this.validationErrors.push({
            type: label, id: obj.id, errors: [`Duplicate ${label} ID`]
          });
        }
        seen.add(obj.id);
      });
    };

    check(this.data.spells, 'spell');
    check(this.data.enemies, 'enemy');
    check(this.data.items, 'item');
  }

  _checkReferences() {
    const spellIds = new Set(this.data.spells.map((s) => s.id));

    // Spell combo references
    this.data.spells.forEach((spell) => {
      if (spell.combosWith) {
        spell.combosWith.forEach((comboId) => {
          if (!spellIds.has(comboId)) {
            this.validationErrors.push({
              type: 'spell', id: spell.id,
              errors: [`combosWith references unknown spell: ${comboId}`]
            });
          }
        });
      }
    });

    // Enemy spell references
    this.data.enemies.forEach((enemy) => {
      if (enemy.spells) {
        enemy.spells.forEach((sid) => {
          if (!spellIds.has(sid)) {
            this.validationErrors.push({
              type: 'enemy', id: enemy.id,
              errors: [`references unknown spell: ${sid}`]
            });
          }
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // Caches
  // ------------------------------------------------------------------

  _buildCaches() {
    this.cache.spellsById.clear();
    this.cache.enemiesById.clear();
    this.cache.itemsById.clear();
    this.cache.locationsById.clear();

    this.data.spells.forEach((s) => this.cache.spellsById.set(s.id, s));
    this.data.enemies.forEach((e) => this.cache.enemiesById.set(e.id, e));
    this.data.items.forEach((i) => this.cache.itemsById.set(i.id, i));
    this.data.locations.forEach((l) => this.cache.locationsById.set(l.id, l));
  }

  // ------------------------------------------------------------------
  // Query Interface
  // ------------------------------------------------------------------

  getSpell(id) { return this.cache.spellsById.get(id) || null; }
  getEnemy(id) { return this.cache.enemiesById.get(id) || null; }
  getItem(id) { return this.cache.itemsById.get(id) || null; }
  getLocation(id) { return this.cache.locationsById.get(id) || null; }

  getAllSpells() { return [...this.data.spells]; }
  getAllEnemies() { return [...this.data.enemies]; }
  getAllItems() { return [...this.data.items]; }
  getAllLocations() { return [...this.data.locations]; }

  getSpellsByTier(tier) { return this.data.spells.filter((s) => s.tier === tier); }
  getSpellsByElement(el) { return this.data.spells.filter((s) => s.element === el); }

  getEnemiesForPhase(phase) {
    return this.data.enemies.filter((e) => {
      const weight = e.phaseSpawnWeights?.[phase] || 1.0;
      return weight > 0.5;
    });
  }

  /**
   * Read a deeply-nested config value using dot notation.
   * Example: getConfig('balance.player.startingSap') => 100
   */
  getConfig(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.data.config);
  }

  getValidationReport() {
    return {
      totalErrors: this.validationErrors.length,
      errors: this.validationErrors
    };
  }

  // ------------------------------------------------------------------
  // Hot-Reload
  // ------------------------------------------------------------------

  enableHotReload() {
    if (this._watchInterval) return;

    console.log('[DataManager] Hot-reload enabled (polling every 2 s)');
    this._watchInterval = setInterval(() => this._checkForUpdates(), 2000);
  }

  disableHotReload() {
    if (this._watchInterval) {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
    }
  }

  async _checkForUpdates() {
    try {
      const res = await fetch('./data/config.json');
      const cfg = await res.json();
      if (cfg.lastModified !== this._lastConfigTimestamp) {
        console.log('[DataManager] Change detected, reloading...');
        await this.reloadData();
      }
    } catch (_) {
      // Silently ignore polling failures
    }
  }

  async reloadData() {
    this.loaded = false;
    this._loadPromise = null;
    await this.loadAllData();

    if (window.EventBus) {
      window.EventBus.emit('data-reloaded', {
        spells: this.data.spells.length,
        enemies: this.data.enemies.length
      });
    }
  }

  // ------------------------------------------------------------------
  // Fallback
  // ------------------------------------------------------------------

  _loadFallbackData() {
    console.warn('[DataManager] Using hardcoded fallback data');
    this.data.spells = [{
      id: 'azure_bolt', name: 'Azure Bolt', tier: 1,
      baseDamage: 15, sapCost: 10, cooldown: 2
    }];
    this.data.config = { balance: { player: { startingSap: 100, startingHp: 100 } } };
    this._buildCaches();
    this.loaded = true;
  }
}

// Singleton
const dataManager = new DataManager();
export default dataManager;
