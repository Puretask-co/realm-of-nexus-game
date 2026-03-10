import { EventBus } from '../core/EventBus.js';

/**
 * CooldownManager - Centralized cooldown tracker for abilities, items, and systems.
 * Tracks named cooldowns with time-based resolution and progress queries.
 */
export class CooldownManager {
  static instance = null;

  static getInstance() {
    if (!CooldownManager.instance) new CooldownManager();
    return CooldownManager.instance;
  }

  constructor() {
    if (CooldownManager.instance) return CooldownManager.instance;

    this.eventBus = EventBus.getInstance();

    // Map<string, { duration, remaining, paused }>
    this.cooldowns = new Map();

    // Cooldown reduction modifier (e.g. from gear or buffs)
    this.globalCDR = 0; // 0-1 percentage reduction

    CooldownManager.instance = this;
  }

  /**
   * Start a named cooldown.
   * @param {string} id - Unique cooldown identifier (e.g. 'spell_temporal_bolt')
   * @param {number} duration - Cooldown duration in seconds
   * @param {boolean} applyCDR - Whether to apply global cooldown reduction
   */
  start(id, duration, applyCDR = true) {
    const effectiveDuration = applyCDR
      ? duration * (1 - Math.min(this.globalCDR, 0.75))
      : duration;

    this.cooldowns.set(id, {
      duration: effectiveDuration,
      remaining: effectiveDuration,
      paused: false
    });

    this.eventBus.emit('cooldown:started', { id, duration: effectiveDuration });
  }

  /**
   * Check if a cooldown is active (still ticking).
   */
  isOnCooldown(id) {
    const cd = this.cooldowns.get(id);
    return cd ? cd.remaining > 0 : false;
  }

  /**
   * Check if an ability is ready (not on cooldown).
   */
  isReady(id) {
    return !this.isOnCooldown(id);
  }

  /**
   * Get remaining time for a cooldown in seconds.
   */
  getRemaining(id) {
    const cd = this.cooldowns.get(id);
    return cd ? Math.max(0, cd.remaining) : 0;
  }

  /**
   * Get cooldown progress (0 = just started, 1 = ready).
   */
  getProgress(id) {
    const cd = this.cooldowns.get(id);
    if (!cd || cd.duration === 0) return 1;
    return 1 - (cd.remaining / cd.duration);
  }

  /**
   * Reset a specific cooldown (make it ready immediately).
   */
  reset(id) {
    if (this.cooldowns.has(id)) {
      this.cooldowns.delete(id);
      this.eventBus.emit('cooldown:reset', { id });
    }
  }

  /**
   * Reset all cooldowns.
   */
  resetAll() {
    this.cooldowns.clear();
    this.eventBus.emit('cooldown:resetAll');
  }

  /**
   * Pause a specific cooldown.
   */
  pause(id) {
    const cd = this.cooldowns.get(id);
    if (cd) cd.paused = true;
  }

  /**
   * Resume a paused cooldown.
   */
  resume(id) {
    const cd = this.cooldowns.get(id);
    if (cd) cd.paused = false;
  }

  /**
   * Reduce a specific cooldown by a number of seconds.
   */
  reduce(id, seconds) {
    const cd = this.cooldowns.get(id);
    if (!cd) return;
    cd.remaining = Math.max(0, cd.remaining - seconds);
    if (cd.remaining <= 0) {
      this.cooldowns.delete(id);
      this.eventBus.emit('cooldown:ready', { id });
    }
  }

  /**
   * Set global cooldown reduction (0-1, max 0.75).
   */
  setGlobalCDR(cdr) {
    this.globalCDR = Math.min(Math.max(cdr, 0), 0.75);
  }

  /**
   * Update all cooldowns. Call each frame with delta in ms.
   */
  update(delta) {
    const dt = delta / 1000;
    const expired = [];

    for (const [id, cd] of this.cooldowns) {
      if (cd.paused) continue;
      cd.remaining -= dt;
      if (cd.remaining <= 0) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.cooldowns.delete(id);
      this.eventBus.emit('cooldown:ready', { id });
    }
  }

  /**
   * Get all active cooldowns as an array of { id, remaining, duration, progress }.
   */
  getAll() {
    const result = [];
    for (const [id, cd] of this.cooldowns) {
      result.push({
        id,
        remaining: cd.remaining,
        duration: cd.duration,
        progress: 1 - (cd.remaining / cd.duration),
        paused: cd.paused
      });
    }
    return result;
  }
}

export default CooldownManager;
