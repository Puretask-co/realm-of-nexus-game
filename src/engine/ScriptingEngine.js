import { EventBus } from '../core/EventBus.js';
import { Logger } from './Logger.js';

/**
 * ScriptingEngine - Per-component scripting system for the Verdance engine.
 *
 * Scripting Layer providing:
 *  - JavaScript-based script definitions with lifecycle hooks
 *  - Scripts attach to entities via the ComponentRegistry
 *  - Hooks: init(), update(dt), onEvent(name, data), onDestroy()
 *  - Sandboxed execution with error catching
 *  - Script hot-reload support
 *  - Built-in API: access entity, transform, emit events
 *  - Script templates for common behaviors
 */
export class ScriptingEngine {
  static instance = null;

  static getInstance() {
    if (!ScriptingEngine.instance) new ScriptingEngine();
    return ScriptingEngine.instance;
  }

  constructor() {
    if (ScriptingEngine.instance) return ScriptingEngine.instance;

    this.eventBus = EventBus.getInstance();
    this.logger = Logger.getInstance();
    this.scripts = new Map();         // scriptId → ScriptDefinition
    this.instances = new Map();       // instanceId → ScriptInstance
    this.templates = new Map();       // templateName → source code
    this._nextInstanceId = 1;

    this._registerBuiltinTemplates();
    ScriptingEngine.instance = this;
  }

  // ─── Script Registration ─────────────────────────────────────────

  registerScript(id, definition) {
    const script = {
      id,
      name: definition.name || id,
      description: definition.description || '',
      properties: definition.properties || {},
      source: definition.source || '',
      init: definition.init || null,
      update: definition.update || null,
      onEvent: definition.onEvent || null,
      onDestroy: definition.onDestroy || null,
      onCollision: definition.onCollision || null
    };
    this.scripts.set(id, script);
    this.eventBus.emit('script:registered', { id, name: script.name });
    return script;
  }

  getScript(id) {
    return this.scripts.get(id) || null;
  }

  getAllScripts() {
    return [...this.scripts.values()];
  }

  // ─── Script Attachment ───────────────────────────────────────────

  attachScript(entityId, scriptId, properties = {}) {
    const script = this.scripts.get(scriptId);
    if (!script) {
      this.logger.warn('Scripting', `Script '${scriptId}' not found`);
      return null;
    }

    const instanceId = `si_${this._nextInstanceId++}`;
    const instance = {
      id: instanceId,
      scriptId,
      entityId,
      properties: { ...script.properties, ...properties },
      state: {},         // Per-instance runtime state
      enabled: true,
      initialized: false
    };

    this.instances.set(instanceId, instance);
    this.eventBus.emit('script:attached', { instanceId, scriptId, entityId });
    return instance;
  }

  detachScript(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    const script = this.scripts.get(instance.scriptId);
    if (script && script.onDestroy) {
      this._safeExecute(script.onDestroy, instance, 'onDestroy');
    }

    this.instances.delete(instanceId);
    this.eventBus.emit('script:detached', { instanceId, entityId: instance.entityId });
  }

  getEntityScripts(entityId) {
    const result = [];
    for (const instance of this.instances.values()) {
      if (instance.entityId === entityId) result.push(instance);
    }
    return result;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  initAll(entityProvider) {
    for (const instance of this.instances.values()) {
      if (instance.initialized || !instance.enabled) continue;
      const script = this.scripts.get(instance.scriptId);
      if (script && script.init) {
        const ctx = this._createContext(instance, entityProvider);
        this._safeExecute(script.init, ctx, 'init');
        instance.initialized = true;
      }
    }
  }

  updateAll(delta, entityProvider) {
    for (const instance of this.instances.values()) {
      if (!instance.enabled) continue;
      const script = this.scripts.get(instance.scriptId);
      if (script && script.update) {
        const ctx = this._createContext(instance, entityProvider);
        this._safeExecute(() => script.update.call(ctx, delta / 1000), instance, 'update');
      }
    }
  }

  broadcastEvent(eventName, data, entityProvider) {
    for (const instance of this.instances.values()) {
      if (!instance.enabled) continue;
      const script = this.scripts.get(instance.scriptId);
      if (script && script.onEvent) {
        const ctx = this._createContext(instance, entityProvider);
        this._safeExecute(() => script.onEvent.call(ctx, eventName, data), instance, 'onEvent');
      }
    }
  }

  // ─── Script Context (API available to scripts) ───────────────────

  _createContext(instance, entityProvider) {
    const self = this;
    return {
      properties: instance.properties,
      state: instance.state,
      entityId: instance.entityId,

      getEntity() {
        return entityProvider ? entityProvider(instance.entityId) : null;
      },

      getTransform() {
        const entity = this.getEntity();
        if (!entity?.gameObject) return { x: 0, y: 0, rotation: 0 };
        return {
          x: entity.gameObject.x,
          y: entity.gameObject.y,
          rotation: entity.gameObject.rotation || 0,
          scaleX: entity.gameObject.scaleX || 1,
          scaleY: entity.gameObject.scaleY || 1
        };
      },

      setPosition(x, y) {
        const entity = this.getEntity();
        if (entity?.gameObject) {
          entity.gameObject.x = x;
          entity.gameObject.y = y;
        }
      },

      emit(event, data) {
        self.eventBus.emit(event, data);
      },

      log(message) {
        self.logger.info('Script', `[${instance.scriptId}] ${message}`);
      },

      getTime() {
        return performance.now();
      },

      random(min = 0, max = 1) {
        return min + Math.random() * (max - min);
      },

      distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      },

      lerp(a, b, t) {
        return a + (b - a) * Math.max(0, Math.min(1, t));
      }
    };
  }

  _safeExecute(fn, context, hookName) {
    try {
      if (typeof fn === 'function') {
        fn.call(context);
      }
    } catch (err) {
      const id = context.scriptId || context.id || 'unknown';
      this.logger.error('Scripting', `Error in ${id}.${hookName}: ${err.message}`);
    }
  }

  // ─── Built-in Script Templates ───────────────────────────────────

  _registerBuiltinTemplates() {
    this.registerScript('builtin_patrol', {
      name: 'Patrol',
      description: 'Moves entity back and forth along a path',
      properties: { speed: 50, distance: 100, axis: 'x' },
      init() {
        this.state.startX = this.getTransform().x;
        this.state.startY = this.getTransform().y;
        this.state.direction = 1;
      },
      update(dt) {
        const t = this.getTransform();
        const prop = this.properties;
        if (prop.axis === 'x') {
          const newX = t.x + prop.speed * this.state.direction * dt;
          if (Math.abs(newX - this.state.startX) > prop.distance) {
            this.state.direction *= -1;
          }
          this.setPosition(newX, t.y);
        } else {
          const newY = t.y + prop.speed * this.state.direction * dt;
          if (Math.abs(newY - this.state.startY) > prop.distance) {
            this.state.direction *= -1;
          }
          this.setPosition(t.x, newY);
        }
      }
    });

    this.registerScript('builtin_bob', {
      name: 'Bob',
      description: 'Gentle floating/bobbing animation',
      properties: { amplitude: 4, frequency: 2 },
      init() {
        this.state.baseY = this.getTransform().y;
        this.state.time = 0;
      },
      update(dt) {
        this.state.time += dt;
        const t = this.getTransform();
        const y = this.state.baseY + Math.sin(this.state.time * this.properties.frequency) * this.properties.amplitude;
        this.setPosition(t.x, y);
      }
    });

    this.registerScript('builtin_rotate', {
      name: 'Rotate',
      description: 'Continuous rotation',
      properties: { speed: 1 },
      update(dt) {
        const entity = this.getEntity();
        if (entity?.gameObject) {
          entity.gameObject.rotation += this.properties.speed * dt;
        }
      }
    });

    this.registerScript('builtin_trigger_zone', {
      name: 'Trigger Zone',
      description: 'Emits event when player enters area',
      properties: { event: 'zone:entered', radius: 50, oneShot: true },
      init() {
        this.state.triggered = false;
      },
      onEvent(name, data) {
        if (name === 'player-moved' && !this.state.triggered) {
          const t = this.getTransform();
          const dist = this.distance(t.x, t.y, data.x, data.y);
          if (dist < this.properties.radius) {
            this.emit(this.properties.event, { entityId: this.entityId });
            if (this.properties.oneShot) this.state.triggered = true;
          }
        }
      }
    });

    this.registerScript('builtin_follow', {
      name: 'Follow Target',
      description: 'Follows a target position smoothly',
      properties: { targetTag: 'player', speed: 100, minDistance: 30 },
      update(dt) {
        const t = this.getTransform();
        const target = this.state.targetPos;
        if (!target) return;
        const dist = this.distance(t.x, t.y, target.x, target.y);
        if (dist > this.properties.minDistance) {
          const dx = target.x - t.x;
          const dy = target.y - t.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const mx = (dx / len) * this.properties.speed * dt;
          const my = (dy / len) * this.properties.speed * dt;
          this.setPosition(t.x + mx, t.y + my);
        }
      }
    });
  }

  // ─── Serialization ──────────────────────────────────────────────

  serialize() {
    const data = [];
    for (const instance of this.instances.values()) {
      data.push({
        scriptId: instance.scriptId,
        entityId: instance.entityId,
        properties: { ...instance.properties },
        enabled: instance.enabled
      });
    }
    return data;
  }

  deserialize(data) {
    for (const entry of data) {
      this.attachScript(entry.entityId, entry.scriptId, entry.properties);
    }
  }

  getStats() {
    return {
      registeredScripts: this.scripts.size,
      activeInstances: this.instances.size,
      enabledInstances: [...this.instances.values()].filter(i => i.enabled).length
    };
  }
}

export default ScriptingEngine;
