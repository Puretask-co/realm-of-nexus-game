import EventBus from '../core/EventBus.js';

/**
 * SaveManager — Handles game save/load to localStorage.
 *
 * Persists:
 *  - Player progression (level, XP, stats, spells, achievements)
 *  - Current location and position
 *  - Inventory
 *  - Quest state
 *  - Game settings (volume, controls)
 *
 * Features:
 *  - Multiple save slots (3 by default)
 *  - Auto-save at configurable intervals
 *  - Save versioning for migration
 *  - Corruption detection (JSON parse guard + backup)
 *  - Export/import as downloadable JSON file
 *
 * Usage:
 *   saveManager.save(0); // save to slot 0
 *   saveManager.load(0); // load from slot 0
 */
export default class SaveManager {
    constructor() {
        this.maxSlots = 3;
        this.storagePrefix = 'verdance_save_';
        this.saveVersion = 1;
        this.autoSaveInterval = 60000; // 1 minute
        this._autoSaveTimer = null;

        this._unsubs = [
            EventBus.on('request-save', (slot) => this.save(slot ?? 0)),
            EventBus.on('request-load', (slot) => this.load(slot ?? 0))
        ];
    }

    // ----------------------------------------------------------------
    // Save
    // ----------------------------------------------------------------

    save(slot = 0) {
        if (slot < 0 || slot >= this.maxSlots) {
            console.error(`[SaveManager] Invalid slot: ${slot}`);
            return false;
        }

        const saveData = {
            version: this.saveVersion,
            timestamp: Date.now(),
            slot
        };

        // Collect data from systems via EventBus
        // Systems respond synchronously by attaching data
        EventBus.emit('save-collect', saveData);

        try {
            const key = `${this.storagePrefix}${slot}`;
            const json = JSON.stringify(saveData);

            // Backup previous save
            const existing = localStorage.getItem(key);
            if (existing) {
                localStorage.setItem(`${key}_backup`, existing);
            }

            localStorage.setItem(key, json);
            console.log(`[SaveManager] Saved to slot ${slot} (${(json.length / 1024).toFixed(1)}KB)`);

            EventBus.emit('save-complete', { slot, timestamp: saveData.timestamp });
            return true;
        } catch (err) {
            console.error(`[SaveManager] Save failed:`, err);
            EventBus.emit('save-failed', { slot, error: err.message });
            return false;
        }
    }

    // ----------------------------------------------------------------
    // Load
    // ----------------------------------------------------------------

    load(slot = 0) {
        if (slot < 0 || slot >= this.maxSlots) {
            console.error(`[SaveManager] Invalid slot: ${slot}`);
            return null;
        }

        const key = `${this.storagePrefix}${slot}`;

        try {
            let json = localStorage.getItem(key);

            if (!json) {
                console.log(`[SaveManager] No save in slot ${slot}`);
                return null;
            }

            let saveData;
            try {
                saveData = JSON.parse(json);
            } catch (parseErr) {
                // Try backup
                console.warn(`[SaveManager] Corrupted save in slot ${slot}, trying backup...`);
                json = localStorage.getItem(`${key}_backup`);
                if (json) {
                    saveData = JSON.parse(json);
                } else {
                    throw parseErr;
                }
            }

            // Version migration
            if (saveData.version !== this.saveVersion) {
                saveData = this._migrate(saveData);
            }

            // Distribute to systems
            EventBus.emit('save-restore', saveData);

            console.log(`[SaveManager] Loaded slot ${slot} (saved: ${new Date(saveData.timestamp).toLocaleString()})`);
            EventBus.emit('load-complete', { slot, saveData });
            return saveData;
        } catch (err) {
            console.error(`[SaveManager] Load failed:`, err);
            EventBus.emit('load-failed', { slot, error: err.message });
            return null;
        }
    }

    // ----------------------------------------------------------------
    // Slot info
    // ----------------------------------------------------------------

    getSlotInfo(slot) {
        const key = `${this.storagePrefix}${slot}`;
        const json = localStorage.getItem(key);
        if (!json) return null;

        try {
            const data = JSON.parse(json);
            return {
                slot,
                timestamp: data.timestamp,
                version: data.version,
                level: data.progression?.level,
                location: data.location,
                playtime: data.playtime
            };
        } catch {
            return { slot, corrupted: true };
        }
    }

    getAllSlotInfo() {
        const slots = [];
        for (let i = 0; i < this.maxSlots; i++) {
            slots.push(this.getSlotInfo(i));
        }
        return slots;
    }

    // ----------------------------------------------------------------
    // Delete
    // ----------------------------------------------------------------

    deleteSave(slot) {
        const key = `${this.storagePrefix}${slot}`;
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_backup`);
        console.log(`[SaveManager] Deleted slot ${slot}`);
    }

    // ----------------------------------------------------------------
    // Auto-save
    // ----------------------------------------------------------------

    enableAutoSave(interval) {
        this.autoSaveInterval = interval || this.autoSaveInterval;
        this.disableAutoSave();

        this._autoSaveTimer = setInterval(() => {
            this.save(0); // auto-save always goes to slot 0
        }, this.autoSaveInterval);

        console.log(`[SaveManager] Auto-save enabled (${this.autoSaveInterval / 1000}s)`);
    }

    disableAutoSave() {
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
    }

    // ----------------------------------------------------------------
    // Export / Import
    // ----------------------------------------------------------------

    exportSave(slot = 0) {
        const key = `${this.storagePrefix}${slot}`;
        const json = localStorage.getItem(key);
        if (!json) return;

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verdance_save_slot${slot}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importSave(slot = 0) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.version || !data.timestamp) {
                        throw new Error('Invalid save file format');
                    }
                    const key = `${this.storagePrefix}${slot}`;
                    localStorage.setItem(key, JSON.stringify(data));
                    console.log(`[SaveManager] Imported save to slot ${slot}`);
                    EventBus.emit('save-imported', { slot });
                } catch (err) {
                    console.error('[SaveManager] Import failed:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ----------------------------------------------------------------
    // Migration
    // ----------------------------------------------------------------

    _migrate(saveData) {
        console.log(`[SaveManager] Migrating save from v${saveData.version} to v${this.saveVersion}`);
        // Future: handle schema changes between versions
        saveData.version = this.saveVersion;
        return saveData;
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this.disableAutoSave();
        this._unsubs.forEach((fn) => fn());
    }
}
