import { EventBus } from '../core/EventBus.js';

/**
 * ComponentRegistry - Formal Entity-Component-System layer.
 *
 * ECS Layer providing:
 *  - Entity creation with unique IDs
 *  - Component registration and attachment
 *  - System update loop management
 *  - Entity queries by component type
 *  - Hierarchical parent-child relationships
 *  - Serialization support for scene save/load
 *
 * Adapted for Phaser.js: entities wrap Phaser GameObjects,
 * components are plain data objects, systems are update functions.
 */
export class ComponentRegistry {
  static instance = null;

  static getInstance() {
    if (!ComponentRegistry.instance) new ComponentRegistry();
    return ComponentRegistry.instance;
  }

  constructor() {
    if (ComponentRegistry.instance) return ComponentRegistry.instance;

    this.eventBus = EventBus.getInstance();
    this.entities = new Map();       // entityId → Entity
    this.componentTypes = new Map(); // typeName → { schema, defaults }
    this.systems = [];               // { name, update(dt, entities), priority }
    this._nextId = 1;

    ComponentRegistry.instance = this;
  }

  // ─── Component Type Registration ─────────────────────────────────

  registerComponent(typeName, schema = {}) {
    this.componentTypes.set(typeName, {
      name: typeName,
      schema,
      defaults: { ...schema }
    });
    return this;
  }

  getComponentType(typeName) {
    return this.componentTypes.get(typeName) || null;
  }

  getRegisteredTypes() {
    return [...this.componentTypes.keys()];
  }

  // ─── Entity Management ───────────────────────────────────────────

  createEntity(name = 'Entity', parentId = null) {
    const id = `entity_${this._nextId++}`;
    const entity = {
      id,
      name,
      active: true,
      visible: true,
      components: new Map(),
      children: [],
      parentId,
      gameObject: null, // Phaser reference
      tags: new Set(),
      depth: 0
    };

    this.entities.set(id, entity);

    if (parentId && this.entities.has(parentId)) {
      this.entities.get(parentId).children.push(id);
    }

    this.eventBus.emit('ecs:entityCreated', { id, name, parentId });
    return entity;
  }

  destroyEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    // Destroy children recursively
    for (const childId of [...entity.children]) {
      this.destroyEntity(childId);
    }

    // Remove from parent
    if (entity.parentId) {
      const parent = this.entities.get(entity.parentId);
      if (parent) {
        parent.children = parent.children.filter(c => c !== entityId);
      }
    }

    // Destroy Phaser game object
    if (entity.gameObject && entity.gameObject.destroy) {
      entity.gameObject.destroy();
    }

    this.entities.delete(entityId);
    this.eventBus.emit('ecs:entityDestroyed', { id: entityId, name: entity.name });
  }

  getEntity(entityId) {
    return this.entities.get(entityId) || null;
  }

  getAllEntities() {
    return [...this.entities.values()];
  }

  getRootEntities() {
    return [...this.entities.values()].filter(e => !e.parentId);
  }

  // ─── Component Attachment ────────────────────────────────────────

  addComponent(entityId, typeName, data = {}) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    const type = this.componentTypes.get(typeName);
    const component = {
      type: typeName,
      data: type ? { ...type.defaults, ...data } : { ...data },
      enabled: true
    };

    entity.components.set(typeName, component);
    this.eventBus.emit('ecs:componentAdded', { entityId, typeName, data: component.data });
    return component;
  }

  removeComponent(entityId, typeName) {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.delete(typeName);
    this.eventBus.emit('ecs:componentRemoved', { entityId, typeName });
  }

  getComponent(entityId, typeName) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return entity.components.get(typeName) || null;
  }

  hasComponent(entityId, typeName) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    return entity.components.has(typeName);
  }

  // ─── Entity Queries ──────────────────────────────────────────────

  getEntitiesWithComponent(typeName) {
    const result = [];
    for (const entity of this.entities.values()) {
      if (entity.components.has(typeName)) result.push(entity);
    }
    return result;
  }

  getEntitiesWithComponents(...typeNames) {
    const result = [];
    for (const entity of this.entities.values()) {
      if (typeNames.every(t => entity.components.has(t))) result.push(entity);
    }
    return result;
  }

  getEntitiesByTag(tag) {
    return [...this.entities.values()].filter(e => e.tags.has(tag));
  }

  findEntityByName(name) {
    for (const entity of this.entities.values()) {
      if (entity.name === name) return entity;
    }
    return null;
  }

  // ─── Tags ────────────────────────────────────────────────────────

  addTag(entityId, tag) {
    const entity = this.entities.get(entityId);
    if (entity) entity.tags.add(tag);
  }

  removeTag(entityId, tag) {
    const entity = this.entities.get(entityId);
    if (entity) entity.tags.delete(tag);
  }

  // ─── System Registration ─────────────────────────────────────────

  registerSystem(name, updateFn, priority = 0) {
    this.systems.push({ name, update: updateFn, priority, enabled: true });
    this.systems.sort((a, b) => a.priority - b.priority);
    return this;
  }

  enableSystem(name) {
    const sys = this.systems.find(s => s.name === name);
    if (sys) sys.enabled = true;
  }

  disableSystem(name) {
    const sys = this.systems.find(s => s.name === name);
    if (sys) sys.enabled = false;
  }

  updateSystems(delta) {
    for (const sys of this.systems) {
      if (!sys.enabled) continue;
      sys.update(delta, this.entities);
    }
  }

  // ─── Hierarchy ───────────────────────────────────────────────────

  setParent(childId, newParentId) {
    const child = this.entities.get(childId);
    if (!child) return;

    // Remove from old parent
    if (child.parentId) {
      const oldParent = this.entities.get(child.parentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(c => c !== childId);
      }
    }

    child.parentId = newParentId;

    // Add to new parent
    if (newParentId) {
      const newParent = this.entities.get(newParentId);
      if (newParent) newParent.children.push(childId);
    }

    this.eventBus.emit('ecs:parentChanged', { childId, parentId: newParentId });
  }

  getChildren(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return [];
    return entity.children.map(id => this.entities.get(id)).filter(Boolean);
  }

  // ─── Serialization ──────────────────────────────────────────────

  serialize() {
    const data = [];
    for (const entity of this.entities.values()) {
      const components = {};
      for (const [typeName, comp] of entity.components) {
        components[typeName] = { ...comp.data };
      }
      data.push({
        id: entity.id,
        name: entity.name,
        active: entity.active,
        visible: entity.visible,
        parentId: entity.parentId,
        tags: [...entity.tags],
        components,
        transform: entity.gameObject ? {
          x: entity.gameObject.x,
          y: entity.gameObject.y,
          rotation: entity.gameObject.rotation || 0,
          scaleX: entity.gameObject.scaleX || 1,
          scaleY: entity.gameObject.scaleY || 1
        } : null
      });
    }
    return data;
  }

  deserialize(data, scene) {
    this.clear();
    for (const entry of data) {
      const entity = this.createEntity(entry.name, entry.parentId);
      entity.active = entry.active;
      entity.visible = entry.visible;
      if (entry.tags) entry.tags.forEach(t => entity.tags.add(t));
      for (const [typeName, compData] of Object.entries(entry.components)) {
        this.addComponent(entity.id, typeName, compData);
      }
    }
  }

  // ─── Import Phaser Scene Objects ─────────────────────────────────

  importFromScene(scene) {
    const children = scene.children?.list || [];
    for (const obj of children) {
      if (!obj.active) continue;
      const name = obj.name || obj.getData?.('objectName') || obj.type || 'GameObject';
      const entity = this.createEntity(name);
      entity.gameObject = obj;
      entity.depth = obj.depth || 0;

      // Auto-detect and add components based on game object type
      this.addComponent(entity.id, 'Transform', {
        x: obj.x || 0,
        y: obj.y || 0,
        rotation: obj.rotation || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1
      });

      if (obj.body) {
        this.addComponent(entity.id, 'Physics', {
          velocityX: obj.body.velocity?.x || 0,
          velocityY: obj.body.velocity?.y || 0,
          immovable: obj.body.immovable || false,
          collideWorldBounds: obj.body.collideWorldBounds || false
        });
      }

      if (obj.texture?.key) {
        this.addComponent(entity.id, 'Sprite', {
          texture: obj.texture.key,
          frame: obj.frame?.name || 0
        });
      }

      // Check for custom data
      const dataStore = obj.data?.list;
      if (dataStore && Object.keys(dataStore).length > 0) {
        this.addComponent(entity.id, 'CustomData', { ...dataStore });
      }
    }

    this.eventBus.emit('ecs:sceneImported', { count: this.entities.size });
  }

  clear() {
    this.entities.clear();
    this._nextId = 1;
    this.eventBus.emit('ecs:cleared');
  }

  getStats() {
    return {
      entityCount: this.entities.size,
      componentTypes: this.componentTypes.size,
      systemCount: this.systems.length,
      rootEntities: this.getRootEntities().length
    };
  }
}

export default ComponentRegistry;
