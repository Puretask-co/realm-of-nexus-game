/**
 * EventBus - Central event system for cross-system communication.
 *
 * Provides a decoupled publish/subscribe mechanism so game systems
 * can communicate without direct references to each other.
 */

class EventBusSystem {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @param {*} [context] - Optional `this` context for the callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, context) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry = { callback, context };
    this.listeners.get(event).push(entry);

    return () => this.off(event, callback, context);
  }

  /**
   * Subscribe to an event, firing only once.
   */
  once(event, callback, context) {
    const wrapper = (...args) => {
      this.off(event, wrapper, context);
      callback.apply(context, args);
    };
    return this.on(event, wrapper, context);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event, callback, context) {
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
   * Emit an event to all subscribers.
   * @param {string} event - Event name
   * @param {...*} args - Arguments passed to handlers
   */
  emit(event, ...args) {
    const list = this.listeners.get(event);
    if (!list) return;

    // Iterate over a copy so handlers can unsubscribe during emit
    [...list].forEach((entry) => {
      entry.callback.apply(entry.context, args);
    });
  }

  /**
   * Remove all listeners for an event, or all listeners entirely.
   */
  removeAll(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const EventBus = new EventBusSystem();
