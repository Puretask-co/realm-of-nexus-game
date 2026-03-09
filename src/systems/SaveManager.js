import { EventBus } from '../core/EventBus.js';

/**
 * SaveManager - localStorage save/load system with 3 manual slots + auto-save.
 * Serializes player progression, inventory, quest state, and position.
 */
export class SaveManager {
  static instance = null;

  static getInstance() {
    if (!SaveManager.instance) new SaveManager();
    return SaveManager.instance;
  }

  constructor() {
    if (SaveManager.instance) return SaveManager.instance;

    this.eventBus = EventBus.getInstance();
    this.storagePrefix = 'verdance_save_';
    this.maxSlots = 3;
    this.autoSaveInterval = 60; // seconds
    this.autoSaveTimer = 0;
    this.autoSaveEnabled = true;

    // Registered serializers: Map<string, { serialize: () => data, deserialize: (data) => void }>
    this.serializers = new Map();

    SaveManager.instance = this;
  }

  /**
   * Register a system for save/load.
   * @param {string} key - Unique key for this system's data
   * @param {object} handler - { serialize(): data, deserialize(data): void }
   */
  register(key, handler) {
    this.serializers.set(key, handler);
  }

  // ─── Save ────────────────────────────────────────────────────────

  /**
   * Save to a specific slot (0-2) or 'auto'.
   */
  save(slot = 'auto') {
    const saveData = {
      version: '1.0',
      timestamp: Date.now(),
      slot,
      systems: {}
    };

    // Serialize all registered systems
    for (const [key, handler] of this.serializers) {
      try {
        saveData.systems[key] = handler.serialize();
      } catch (err) {
        console.warn(`SaveManager: Failed to serialize '${key}':`, err.message);
      }
    }

    const storageKey = this.storagePrefix + slot;

    try {
      localStorage.setItem(storageKey, JSON.stringify(saveData));
      this.eventBus.emit('save:completed', { slot, timestamp: saveData.timestamp });
      console.log(`SaveManager: Saved to slot '${slot}'`);
      return true;
    } catch (err) {
      console.error('SaveManager: Save failed:', err.message);
      this.eventBus.emit('save:failed', { slot, error: err.message });
      return false;
    }
  }

  // ─── Load ────────────────────────────────────────────────────────

  /**
   * Load from a specific slot.
   */
  load(slot = 'auto') {
    const storageKey = this.storagePrefix + slot;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        console.log(`SaveManager: No save found in slot '${slot}'`);
        return false;
      }

      const saveData = JSON.parse(raw);

      // Deserialize all systems
      for (const [key, handler] of this.serializers) {
        if (saveData.systems?.[key]) {
          try {
            handler.deserialize(saveData.systems[key]);
          } catch (err) {
            console.warn(`SaveManager: Failed to deserialize '${key}':`, err.message);
          }
        }
      }

      this.eventBus.emit('save:loaded', { slot, timestamp: saveData.timestamp });
      console.log(`SaveManager: Loaded from slot '${slot}'`);
      return true;
    } catch (err) {
      console.error('SaveManager: Load failed:', err.message);
      this.eventBus.emit('save:loadFailed', { slot, error: err.message });
      return false;
    }
  }

  // ─── Slot Management ─────────────────────────────────────────────

  /**
   * Delete a save slot.
   */
  deleteSave(slot) {
    localStorage.removeItem(this.storagePrefix + slot);
    this.eventBus.emit('save:deleted', { slot });
  }

  /**
   * Check if a slot has save data.
   */
  hasSave(slot) {
    return localStorage.getItem(this.storagePrefix + slot) !== null;
  }

  /**
   * Get metadata for all save slots.
   */
  getSaveSlots() {
    const slots = [];

    for (let i = 0; i < this.maxSlots; i++) {
      const raw = localStorage.getItem(this.storagePrefix + i);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          slots.push({
            slot: i,
            timestamp: data.timestamp,
            date: new Date(data.timestamp).toLocaleString(),
            version: data.version,
            exists: true
          });
        } catch {
          slots.push({ slot: i, exists: false });
        }
      } else {
        slots.push({ slot: i, exists: false });
      }
    }

    // Auto-save slot
    const autoRaw = localStorage.getItem(this.storagePrefix + 'auto');
    if (autoRaw) {
      try {
        const data = JSON.parse(autoRaw);
        slots.push({
          slot: 'auto',
          timestamp: data.timestamp,
          date: new Date(data.timestamp).toLocaleString(),
          version: data.version,
          exists: true
        });
      } catch {
        slots.push({ slot: 'auto', exists: false });
      }
    }

    return slots;
  }

  // ─── Auto-Save ───────────────────────────────────────────────────

  /**
   * Update auto-save timer. Call each frame with delta in ms.
   */
  update(delta) {
    if (!this.autoSaveEnabled) return;

    this.autoSaveTimer += delta / 1000;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0;
      this.save('auto');
    }
  }

  /**
   * Clear all save data.
   */
  clearAll() {
    for (let i = 0; i < this.maxSlots; i++) {
      localStorage.removeItem(this.storagePrefix + i);
    }
    localStorage.removeItem(this.storagePrefix + 'auto');
    this.eventBus.emit('save:clearedAll');
  }
}

export default SaveManager;
