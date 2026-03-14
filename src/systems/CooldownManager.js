import EventBus from './EventBus.js';

/**
 * CooldownManager — Centralised cooldown tracker for spells,
 * abilities, items, and any time-gated action.
 *
 * Each cooldown has:
 *  - id: unique identifier (e.g. spell ID)
 *  - duration: total cooldown in ms
 *  - remaining: ms left before ready
 *  - onReady: optional callback when cooldown expires
 *
 * The manager ticks every frame, emitting progress events
 * so the UI can render cooldown overlays.
 *
 * Usage:
 *   cooldownManager.start('azure_bolt', 3000);
 *   cooldownManager.isReady('azure_bolt'); // false
 *   // ... 3 seconds later ...
 *   cooldownManager.isReady('azure_bolt'); // true
 */
export default class CooldownManager {
    constructor() {
        this.cooldowns = new Map();
    }

    /**
     * Start a new cooldown.
     * @param {string} id - Unique identifier
     * @param {number} duration - Duration in milliseconds
     * @param {Function} [onReady] - Callback when cooldown completes
     */
    start(id, duration, onReady) {
        this.cooldowns.set(id, {
            duration,
            remaining: duration,
            onReady: onReady || null
        });

        EventBus.emit('cooldown-started', { id, duration });
    }

    /**
     * Check if a cooldown is ready (expired or never started).
     */
    isReady(id) {
        if (!this.cooldowns.has(id)) return true;
        return this.cooldowns.get(id).remaining <= 0;
    }

    /**
     * Get remaining time in ms. Returns 0 if ready or unknown.
     */
    getRemaining(id) {
        if (!this.cooldowns.has(id)) return 0;
        return Math.max(0, this.cooldowns.get(id).remaining);
    }

    /**
     * Get progress ratio (0 = just started, 1 = ready).
     */
    getProgress(id) {
        if (!this.cooldowns.has(id)) return 1;
        const cd = this.cooldowns.get(id);
        if (cd.duration === 0) return 1;
        return 1 - (cd.remaining / cd.duration);
    }

    /**
     * Cancel a cooldown (make it immediately ready).
     */
    cancel(id) {
        this.cooldowns.delete(id);
        EventBus.emit('cooldown-cancelled', { id });
    }

    /**
     * Reduce a cooldown by a flat amount (cooldown reduction ability).
     */
    reduce(id, amount) {
        if (!this.cooldowns.has(id)) return;
        const cd = this.cooldowns.get(id);
        cd.remaining = Math.max(0, cd.remaining - amount);
    }

    /**
     * Reset a cooldown back to full duration.
     */
    reset(id) {
        if (!this.cooldowns.has(id)) return;
        const cd = this.cooldowns.get(id);
        cd.remaining = cd.duration;
    }

    /**
     * Tick all cooldowns. Call from scene.update().
     * @param {number} delta - Frame delta in ms
     */
    update(delta) {
        const completed = [];

        this.cooldowns.forEach((cd, id) => {
            if (cd.remaining <= 0) return;

            cd.remaining -= delta;

            // Emit tick for UI
            EventBus.emit('spell-cooldown-tick', id, Math.max(0, cd.remaining), cd.duration);

            if (cd.remaining <= 0) {
                cd.remaining = 0;
                completed.push(id);
            }
        });

        // Fire completion callbacks
        completed.forEach((id) => {
            const cd = this.cooldowns.get(id);
            if (cd?.onReady) cd.onReady();
            EventBus.emit('cooldown-ready', { id });
            this.cooldowns.delete(id);
        });
    }

    /**
     * Get all active cooldowns as an array.
     */
    getAll() {
        const result = [];
        this.cooldowns.forEach((cd, id) => {
            result.push({
                id,
                duration: cd.duration,
                remaining: cd.remaining,
                progress: 1 - (cd.remaining / cd.duration)
            });
        });
        return result;
    }

    /**
     * Clear all cooldowns.
     */
    clearAll() {
        this.cooldowns.clear();
    }
}
