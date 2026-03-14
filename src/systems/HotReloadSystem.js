import { EventBus } from '../core/EventBus.js';

/**
 * HotReloadSystem - Integrates with Vite HMR to provide instant game data
 * reloading during development. When a JSON data file is saved, changes are
 * pushed to the running game without a full page refresh.
 *
 * Supports two modes:
 *  1. Vite HMR (preferred) - uses import.meta.hot for sub-second reloads
 *  2. Polling fallback - periodically fetches files and compares hashes
 */
export class HotReloadSystem {
  static instance = null;

  constructor() {
    if (HotReloadSystem.instance) return HotReloadSystem.instance;

    this.eventBus = EventBus.getInstance();
    this.enabled = false;
    this.mode = 'none'; // 'hmr', 'polling', 'none'

    // Tracked data modules
    this.modules = new Map();

    // Reload history for UI overlay
    this.reloadHistory = [];
    this.maxHistory = 20;

    // Polling state (fallback)
    this.pollingInterval = null;
    this.pollingRate = 2000;
    this.fileHashes = new Map();

    // Subscribers that want to react to specific data changes
    this.changeHandlers = new Map();

    // Statistics
    this.stats = {
      reloadsTotal: 0,
      reloadsFailed: 0,
      lastReloadTime: null,
      lastReloadDuration: 0,
      averageReloadDuration: 0
    };

    HotReloadSystem.instance = this;
  }

  static getInstance() {
    if (!HotReloadSystem.instance) new HotReloadSystem();
    return HotReloadSystem.instance;
  }

  /**
   * Initialize the hot reload system. Attempts Vite HMR first,
   * falls back to polling if HMR is unavailable.
   */
  initialize() {
    if (this.enabled) return;

    if (this.tryInitHMR()) {
      this.mode = 'hmr';
      console.log('[HotReload] Initialized with Vite HMR (instant reloads)');
    } else {
      this.startPolling();
      this.mode = 'polling';
      console.log('[HotReload] Initialized with polling fallback');
    }

    this.enabled = true;
    this.eventBus.emit('hotreload:initialized', { mode: this.mode });
  }

  /**
   * Attempt to set up Vite HMR module accept hooks.
   * @returns {boolean} true if HMR is available
   */
  tryInitHMR() {
    if (typeof import.meta === 'undefined') return false;
    if (!import.meta.hot) return false;

    // Accept self-updates to keep this module alive
    import.meta.hot.accept();

    // Listen for custom HMR events sent by the Vite plugin/middleware
    import.meta.hot.on('verdance:data-update', (payload) => {
      this.handleHMRUpdate(payload);
    });

    return true;
  }

  /**
   * Register a data module for hot-reload tracking.
   * @param {string} key - Data category key (e.g. 'spells', 'enemies')
   * @param {string} path - File path relative to project root
   * @param {Function} onReload - Callback receiving new parsed data
   */
  registerModule(key, path, onReload) {
    this.modules.set(key, {
      key,
      path,
      onReload,
      lastHash: null,
      reloadCount: 0
    });
  }

  /**
   * Subscribe to changes for a specific data key.
   * @param {string} key - Data category key
   * @param {Function} handler - Callback(newData, key)
   * @returns {Function} Unsubscribe function
   */
  onChange(key, handler) {
    if (!this.changeHandlers.has(key)) {
      this.changeHandlers.set(key, []);
    }
    this.changeHandlers.get(key).push(handler);

    return () => {
      const handlers = this.changeHandlers.get(key);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Handle an HMR update from Vite.
   */
  handleHMRUpdate(payload) {
    const { key, data, path, timestamp } = payload;
    const start = performance.now();

    const module = this.modules.get(key);
    if (!module) {
      console.warn(`[HotReload] Received update for unregistered module: ${key}`);
      return;
    }

    try {
      // Call the module's reload handler
      module.onReload(data);
      module.reloadCount++;

      const elapsed = performance.now() - start;
      this.recordReload(key, path, elapsed, true);

      console.log(`[HotReload] ${key} reloaded via HMR in ${elapsed.toFixed(1)}ms`);
    } catch (err) {
      this.recordReload(key, path, 0, false, err.message);
      console.error(`[HotReload] Failed to reload ${key}:`, err);
    }
  }

  // ─── Polling Fallback ──────────────────────────────────────────────

  startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      this.pollForChanges();
    }, this.pollingRate);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async pollForChanges() {
    for (const [key, module] of this.modules) {
      try {
        const response = await fetch(module.path, { cache: 'no-store' });
        if (!response.ok) continue;

        const text = await response.text();
        const hash = this.hashString(text);

        if (module.lastHash !== null && hash !== module.lastHash) {
          const start = performance.now();
          const data = JSON.parse(text);

          module.onReload(data);
          module.reloadCount++;

          const elapsed = performance.now() - start;
          this.recordReload(key, module.path, elapsed, true);
          console.log(`[HotReload] ${key} reloaded via polling in ${elapsed.toFixed(1)}ms`);
        }

        module.lastHash = hash;
      } catch (err) {
        // Silent fail for polling
      }
    }
  }

  // ─── Reload Recording ───────────────────────────────────────────────

  recordReload(key, path, durationMs, success, error = null) {
    const entry = {
      key,
      path,
      timestamp: Date.now(),
      duration: durationMs,
      success,
      error
    };

    this.reloadHistory.unshift(entry);
    if (this.reloadHistory.length > this.maxHistory) {
      this.reloadHistory.pop();
    }

    this.stats.reloadsTotal++;
    if (!success) this.stats.reloadsFailed++;
    this.stats.lastReloadTime = entry.timestamp;
    this.stats.lastReloadDuration = durationMs;

    // Running average
    const successfulReloads = this.reloadHistory.filter(r => r.success);
    if (successfulReloads.length > 0) {
      this.stats.averageReloadDuration =
        successfulReloads.reduce((sum, r) => sum + r.duration, 0) / successfulReloads.length;
    }

    // Notify change handlers
    const handlers = this.changeHandlers.get(key);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(entry, key);
        } catch (err) {
          console.error(`[HotReload] Change handler error for ${key}:`, err);
        }
      }
    }

    // Emit event
    this.eventBus.emit('hotreload:reloaded', entry);
  }

  /**
   * Force a manual reload of a specific data module.
   */
  async forceReload(key) {
    const module = this.modules.get(key);
    if (!module) {
      console.warn(`[HotReload] Cannot force reload unknown module: ${key}`);
      return;
    }

    const start = performance.now();
    try {
      const response = await fetch(module.path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const data = JSON.parse(text);

      module.onReload(data);
      module.reloadCount++;
      module.lastHash = this.hashString(text);

      const elapsed = performance.now() - start;
      this.recordReload(key, module.path, elapsed, true);
      console.log(`[HotReload] ${key} force-reloaded in ${elapsed.toFixed(1)}ms`);
    } catch (err) {
      this.recordReload(key, module.path, 0, false, err.message);
      console.error(`[HotReload] Force reload failed for ${key}:`, err);
    }
  }

  /**
   * Force reload all registered modules.
   */
  async forceReloadAll() {
    const keys = Array.from(this.modules.keys());
    await Promise.all(keys.map(key => this.forceReload(key)));
  }

  // ─── Utilities ──────────────────────────────────────────────────────

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }

  getStats() {
    return {
      ...this.stats,
      mode: this.mode,
      enabled: this.enabled,
      registeredModules: this.modules.size,
      recentReloads: this.reloadHistory.slice(0, 5)
    };
  }

  getHistory() {
    return [...this.reloadHistory];
  }

  shutdown() {
    this.stopPolling();
    this.enabled = false;
    this.mode = 'none';
    this.modules.clear();
    this.changeHandlers.clear();
    this.reloadHistory = [];
    HotReloadSystem.instance = null;
  }
}

export default HotReloadSystem;
