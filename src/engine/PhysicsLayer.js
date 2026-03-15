import { EventBus } from '../core/EventBus.js';

/**
 * PhysicsLayer - Physics abstraction layer for the Verdance engine.
 *
 * Physics Layer providing:
 *  - Rigidbody management (wraps Phaser Arcade Physics)
 *  - Collision layer/mask system
 *  - Raycasting for line-of-sight and targeting
 *  - Physics body creation helpers
 *  - Trigger zones with callbacks
 *  - Physics debug visualization
 *  - World bounds and gravity configuration
 *
 * Abstracts Phaser's arcade physics into a clean API
 * matching the WEngine5 architecture patterns.
 */
export class PhysicsLayer {
  static instance = null;

  static getInstance() {
    if (!PhysicsLayer.instance) new PhysicsLayer();
    return PhysicsLayer.instance;
  }

  constructor() {
    if (PhysicsLayer.instance) return PhysicsLayer.instance;

    this.eventBus = EventBus.getInstance();
    this.scene = null;
    this.bodies = new Map();          // bodyId → PhysicsBody
    this.collisionPairs = [];         // [{ groupA, groupB, callback }]
    this.triggerZones = new Map();    // zoneId → TriggerZone
    this.collisionGroups = new Map(); // groupName → Phaser.Physics.Arcade.Group
    this.debugMode = false;
    this._nextBodyId = 1;
    this._nextZoneId = 1;

    // Collision layer constants
    this.LAYERS = {
      DEFAULT: 0,
      PLAYER: 1,
      ENEMY: 2,
      PROJECTILE: 3,
      NPC: 4,
      TRIGGER: 5,
      WALL: 6,
      PICKUP: 7
    };

    PhysicsLayer.instance = this;
  }

  init(scene) {
    this.scene = scene;

    // Create default collision groups
    for (const [name] of Object.entries(this.LAYERS)) {
      this.collisionGroups.set(name, scene.physics.add.group({
        collideWorldBounds: name !== 'PROJECTILE'
      }));
    }

    this.eventBus.emit('physics:initialized');
  }

  // ─── Rigidbody Management ────────────────────────────────────────

  createBody(gameObject, config = {}) {
    if (!this.scene) return null;

    const {
      type = 'dynamic',     // dynamic, static, kinematic
      layer = 'DEFAULT',
      width = null,
      height = null,
      radius = null,
      offsetX = 0,
      offsetY = 0,
      mass = 1,
      bounce = 0,
      friction = 1,
      gravityScale = 1,
      immovable = false,
      collideWorldBounds = true
    } = config;

    const isStatic = type === 'static' || immovable;
    this.scene.physics.add.existing(gameObject, isStatic);

    const body = gameObject.body;
    if (!body) return null;

    if (width && height) {
      body.setSize(width, height);
    }
    if (radius) {
      body.setCircle(radius);
    }
    if (offsetX || offsetY) {
      body.setOffset(offsetX, offsetY);
    }

    body.setBounce(bounce, bounce);
    body.setCollideWorldBounds(collideWorldBounds);
    if (body.setMass) body.setMass(mass);
    if (body.setFriction) body.setFriction(friction, friction);
    if (body.setImmovable) body.setImmovable(isStatic);

    // Add to collision group
    const group = this.collisionGroups.get(layer);
    if (group) group.add(gameObject);

    const bodyId = `body_${this._nextBodyId++}`;
    const physicsBody = {
      id: bodyId,
      gameObject,
      body,
      layer,
      type,
      config
    };

    this.bodies.set(bodyId, physicsBody);
    gameObject.setData('physicsBodyId', bodyId);

    return physicsBody;
  }

  removeBody(bodyId) {
    const physicsBody = this.bodies.get(bodyId);
    if (!physicsBody) return;

    const group = this.collisionGroups.get(physicsBody.layer);
    if (group) group.remove(physicsBody.gameObject, true);

    this.bodies.delete(bodyId);
  }

  getBody(bodyId) {
    return this.bodies.get(bodyId) || null;
  }

  // ─── Collision Setup ─────────────────────────────────────────────

  addCollision(groupA, groupB, callback = null, processCallback = null) {
    const ga = this.collisionGroups.get(groupA);
    const gb = this.collisionGroups.get(groupB);
    if (!ga || !gb) return;

    this.scene.physics.add.collider(ga, gb, callback, processCallback);
    this.collisionPairs.push({ groupA, groupB, callback });

    return this;
  }

  addOverlap(groupA, groupB, callback = null) {
    const ga = this.collisionGroups.get(groupA);
    const gb = this.collisionGroups.get(groupB);
    if (!ga || !gb) return;

    this.scene.physics.add.overlap(ga, gb, callback);
    return this;
  }

  // ─── Trigger Zones ───────────────────────────────────────────────

  createTriggerZone(x, y, width, height, config = {}) {
    if (!this.scene) return null;

    const {
      event = 'trigger:entered',
      oneShot = false,
      data = {},
      onEnter = null,
      onExit = null
    } = config;

    const zone = this.scene.add.zone(x, y, width, height);
    this.scene.physics.add.existing(zone, true);

    const zoneId = `zone_${this._nextZoneId++}`;
    const triggerZone = {
      id: zoneId,
      zone,
      event,
      oneShot,
      data,
      onEnter,
      onExit,
      triggered: false,
      overlapping: new Set()
    };

    this.triggerZones.set(zoneId, triggerZone);
    zone.setData('triggerZoneId', zoneId);

    return triggerZone;
  }

  checkTriggers(playerBody) {
    if (!playerBody) return;

    for (const [, trigger] of this.triggerZones) {
      if (trigger.oneShot && trigger.triggered) continue;

      const overlaps = this.scene.physics.overlap(playerBody, trigger.zone);
      if (overlaps && !trigger.overlapping.has('player')) {
        trigger.overlapping.add('player');
        trigger.triggered = true;
        if (trigger.onEnter) trigger.onEnter(trigger.data);
        this.eventBus.emit(trigger.event, { zoneId: trigger.id, ...trigger.data });
      } else if (!overlaps && trigger.overlapping.has('player')) {
        trigger.overlapping.delete('player');
        if (trigger.onExit) trigger.onExit(trigger.data);
      }
    }
  }

  // ─── Raycasting ──────────────────────────────────────────────────

  raycast(fromX, fromY, toX, toY, targets = []) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return { hit: false };

    const nx = dx / length;
    const ny = dy / length;

    let closestHit = null;
    let closestDist = length;

    for (const target of targets) {
      if (!target.body) continue;

      const bounds = target.getBounds();
      const hit = this._lineRectIntersect(
        fromX, fromY, nx, ny,
        bounds.x, bounds.y, bounds.width, bounds.height
      );

      if (hit && hit.distance < closestDist) {
        closestDist = hit.distance;
        closestHit = {
          hit: true,
          target,
          point: { x: fromX + nx * hit.distance, y: fromY + ny * hit.distance },
          distance: hit.distance,
          normal: hit.normal
        };
      }
    }

    return closestHit || { hit: false, distance: length };
  }

  _lineRectIntersect(ox, oy, dx, dy, rx, ry, rw, rh) {
    let tmin = -Infinity;
    let tmax = Infinity;
    let nx = 0, ny = 0;

    if (dx !== 0) {
      const t1 = (rx - ox) / dx;
      const t2 = (rx + rw - ox) / dx;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      if (tNear > tmin) { tmin = tNear; nx = dx > 0 ? -1 : 1; ny = 0; }
      tmax = Math.min(tmax, tFar);
    } else if (ox < rx || ox > rx + rw) return null;

    if (dy !== 0) {
      const t1 = (ry - oy) / dy;
      const t2 = (ry + rh - oy) / dy;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      if (tNear > tmin) { tmin = tNear; nx = 0; ny = dy > 0 ? -1 : 1; }
      tmax = Math.min(tmax, tFar);
    } else if (oy < ry || oy > ry + rh) return null;

    if (tmin > tmax || tmax < 0) return null;
    const distance = tmin >= 0 ? tmin : tmax;
    return { distance, normal: { x: nx, y: ny } };
  }

  lineOfSight(fromX, fromY, toX, toY, obstacles = []) {
    const result = this.raycast(fromX, fromY, toX, toY, obstacles);
    const targetDist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    return !result.hit || result.distance >= targetDist - 1;
  }

  // ─── Utility ─────────────────────────────────────────────────────

  setWorldBounds(x, y, width, height) {
    if (this.scene) {
      this.scene.physics.world.setBounds(x, y, width, height);
    }
  }

  setGravity(x, y) {
    if (this.scene) {
      this.scene.physics.world.gravity.x = x;
      this.scene.physics.world.gravity.y = y;
    }
  }

  toggleDebug() {
    this.debugMode = !this.debugMode;
    if (this.scene) {
      this.scene.physics.world.drawDebug = this.debugMode;
      if (!this.debugMode && this.scene.physics.world.debugGraphic) {
        this.scene.physics.world.debugGraphic.clear();
      }
    }
    this.eventBus.emit('physics:debugToggled', { enabled: this.debugMode });
  }

  getStats() {
    return {
      bodyCount: this.bodies.size,
      triggerCount: this.triggerZones.size,
      collisionPairs: this.collisionPairs.length,
      groupCounts: Object.fromEntries(
        [...this.collisionGroups.entries()].map(([name, group]) => [name, group.getLength()])
      )
    };
  }

  clear() {
    this.bodies.clear();
    this.triggerZones.clear();
    this.collisionPairs = [];
    this._nextBodyId = 1;
    this._nextZoneId = 1;
  }
}

export default PhysicsLayer;
