/**
 * Global event bus for decoupled communication between game systems.
 *
 * Any system can emit or listen for events without needing a direct
 * reference to another system. This keeps the architecture modular
 * and makes hot-reloading data possible without restarting the game.
 *
 * Usage:
 *   EventBus.on('phase-changed', (phase) => { ... });
 *   EventBus.emit('phase-changed', 'crimson');
 */
class EventBusClass {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Register a listener for an event.
     * @param {string} event
     * @param {Function} callback
     * @param {*} [context]
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const entry = { callback, context };
        this.listeners.get(event).push(entry);

        // Return an unsubscribe function for convenience
        return () => this.off(event, callback, context);
    }

    /**
     * Register a one-time listener.
     */
    once(event, callback, context = null) {
        const wrapper = (...args) => {
            this.off(event, wrapper, context);
            callback.apply(context, args);
        };
        return this.on(event, wrapper, context);
    }

    /**
     * Remove a listener.
     */
    off(event, callback, context = null) {
        const list = this.listeners.get(event);
        if (!list) return;

        const idx = list.findIndex(
            (e) => e.callback === callback && e.context === context
        );
        if (idx !== -1) {
            list.splice(idx, 1);
        }
    }

    /**
     * Emit an event to all registered listeners.
     */
    emit(event, ...args) {
        const list = this.listeners.get(event);
        if (!list) return;

        // Iterate over a copy so listeners can safely unsubscribe during emit
        [...list].forEach((entry) => {
            entry.callback.apply(entry.context, args);
        });
    }

    /**
     * Remove all listeners for an event, or all listeners entirely.
     */
    removeAll(event = null) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

const EventBus = new EventBusClass();
export default EventBus;
