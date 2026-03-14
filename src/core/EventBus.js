/**
 * EventBus - Central event system for decoupled communication between game systems.
 * Supports namespaced events, one-time listeners, and wildcard subscriptions.
 */
export class EventBus {
  static instance = null;

  constructor() {
    if (EventBus.instance) return EventBus.instance;
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.wildcardListeners = [];
    EventBus.instance = this;
  }

  static getInstance() {
    if (!EventBus.instance) new EventBus();
    return EventBus.instance;
  }

  on(event, callback, context = null) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ callback, context });
    return () => this.off(event, callback);
  }

  once(event, callback, context = null) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    this.onceListeners.get(event).push({ callback, context });
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const filtered = this.listeners.get(event).filter(l => l.callback !== callback);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  offAll(event) {
    this.listeners.delete(event);
    this.onceListeners.delete(event);
  }

  onAny(callback) {
    this.wildcardListeners.push(callback);
    return () => {
      this.wildcardListeners = this.wildcardListeners.filter(l => l !== callback);
    };
  }

  emit(event, data = null) {
    // Regular listeners
    if (this.listeners.has(event)) {
      for (const { callback, context } of this.listeners.get(event)) {
        callback.call(context, data, event);
      }
    }

    // Once listeners
    if (this.onceListeners.has(event)) {
      for (const { callback, context } of this.onceListeners.get(event)) {
        callback.call(context, data, event);
      }
      this.onceListeners.delete(event);
    }

    // Wildcard listeners
    for (const callback of this.wildcardListeners) {
      callback(event, data);
    }
  }

  reset() {
    this.listeners.clear();
    this.onceListeners.clear();
    this.wildcardListeners = [];
  }
}

export default EventBus;
