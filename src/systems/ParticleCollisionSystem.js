import { EventBus } from '../core/EventBus.js';

/**
 * ParticleCollisionSystem - Spatial-hash-based collision detection for particles.
 *
 * Provides broad-phase collision detection via a spatial hash grid and
 * narrow-phase resolution with configurable behaviours (bounce, die, slide,
 * stick).  Supports particle-to-world colliders and optional particle-to-
 * particle collision for special effects.
 *
 * Performance notes:
 *   - The spatial hash keeps insertion and query at O(1) per particle.
 *   - Particle-to-particle is opt-in because it is O(n) per occupied cell.
 *   - Collision layers / masks let you skip irrelevant pairs entirely.
 *
 * Usage:
 *   const collision = new ParticleCollisionSystem(64);
 *   collision.addCollider({ x: 0, y: 500, width: 1280, height: 32 }, 'solid');
 *   // each frame:
 *   collision.checkCollisions(particleSystem.aliveIndices.map(i => particleSystem.pool[i]));
 */
export class ParticleCollisionSystem {

  // ─── Static helpers ──────────────────────────────────────────────

  static _nextId = 0;

  /** Generate a unique identifier. */
  static uid(prefix = 'col') {
    return `${prefix}_${++ParticleCollisionSystem._nextId}`;
  }

  // ─── Constructor ─────────────────────────────────────────────────

  /**
   * @param {number} cellSize  Width/height of each spatial hash cell in pixels.
   *                           Smaller cells = tighter queries but more cells.
   */
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.eventBus = EventBus.getInstance();

    /**
     * World colliders: static axis-aligned bounding boxes that particles
     * can collide with.
     * @type {Map<string, object>}
     */
    this.colliders = new Map();

    /**
     * Spatial hash grid for colliders.
     * Key = "cx,cy", Value = Set of collider IDs.
     * @type {Map<string, Set<string>>}
     */
    this.colliderGrid = new Map();

    /**
     * Spatial hash grid for particles (rebuilt each frame).
     * Key = "cx,cy", Value = array of particle references.
     * @type {Map<string, object[]>}
     */
    this.particleGrid = new Map();

    /**
     * Registered collision callbacks.
     * Key = collider ID or '*' for wildcard.
     * Value = Array of { callback, context }.
     * @type {Map<string, Array>}
     */
    this.callbacks = new Map();

    /**
     * Whether particle-to-particle collision is enabled.
     * @type {boolean}
     */
    this.particleToParticleEnabled = false;

    /**
     * Layer mask table. Collision only occurs when
     * (particle.collisionLayer & collider.layerMask) !== 0.
     * Default mask 0xFFFFFFFF accepts all layers.
     * @type {number}
     */
    this.defaultLayerMask = 0xFFFFFFFF;

    /**
     * Statistics for profiling.
     */
    this.stats = {
      colliderCount: 0,
      checksPerFrame: 0,
      collisionsPerFrame: 0,
      particleToParticleChecks: 0,
      particleToParticleCollisions: 0,
      frameTimeMs: 0
    };
  }

  // ─── Collider Management ─────────────────────────────────────────

  /**
   * Register a world collider (static AABB).
   *
   * @param {object} bounds  { x, y, width, height } - top-left origin.
   * @param {string} type    Collider type tag: 'solid', 'liquid', 'trigger', etc.
   * @param {object} [opts]  Optional properties:
   *   - id           {string}  Custom ID (auto-generated if omitted).
   *   - layerMask    {number}  Bitmask of particle layers this collider responds to.
   *   - friction     {number}  0..1 surface friction for slide behaviour.
   *   - bounciness   {number}  Override bounce factor for this collider.
   *   - active       {boolean} Whether collision is enabled.
   *   - data         {*}       Arbitrary user data attached to callbacks.
   * @returns {string} Collider ID.
   */
  addCollider(bounds, type = 'solid', opts = {}) {
    const id = opts.id ?? ParticleCollisionSystem.uid();

    const collider = {
      id,
      type,
      x: bounds.x ?? 0,
      y: bounds.y ?? 0,
      width: bounds.width ?? 64,
      height: bounds.height ?? 64,
      layerMask: opts.layerMask ?? this.defaultLayerMask,
      friction: opts.friction ?? 0.2,
      bounciness: opts.bounciness ?? 0.5,
      active: opts.active ?? true,
      data: opts.data ?? null
    };

    this.colliders.set(id, collider);
    this._insertColliderIntoGrid(collider);
    this.stats.colliderCount = this.colliders.size;

    this.eventBus.emit('collision:colliderAdded', { id, type });
    return id;
  }

  /**
   * Remove a collider by ID.
   * @param {string} id
   */
  removeCollider(id) {
    const collider = this.colliders.get(id);
    if (!collider) return;

    this._removeColliderFromGrid(collider);
    this.colliders.delete(id);
    this.callbacks.delete(id);
    this.stats.colliderCount = this.colliders.size;

    this.eventBus.emit('collision:colliderRemoved', { id });
  }

  /**
   * Update a collider's bounds at runtime (e.g. moving platform).
   * @param {string} id
   * @param {object} bounds  Partial { x, y, width, height }.
   */
  updateCollider(id, bounds) {
    const collider = this.colliders.get(id);
    if (!collider) return;

    // Remove from old grid cells
    this._removeColliderFromGrid(collider);

    // Apply new bounds
    if (bounds.x !== undefined) collider.x = bounds.x;
    if (bounds.y !== undefined) collider.y = bounds.y;
    if (bounds.width !== undefined) collider.width = bounds.width;
    if (bounds.height !== undefined) collider.height = bounds.height;

    // Re-insert into grid
    this._insertColliderIntoGrid(collider);
  }

  // ─── Collision Callbacks ─────────────────────────────────────────

  /**
   * Register a callback for collisions involving a specific collider.
   *
   * @param {string}   colliderId  Collider ID, or '*' for all colliders.
   * @param {Function} callback    (particle, collider, collision) => void
   * @param {*}        [context]   Optional `this` context.
   * @returns {Function} Unsubscribe function.
   */
  onCollision(colliderId, callback, context = null) {
    if (!this.callbacks.has(colliderId)) {
      this.callbacks.set(colliderId, []);
    }
    this.callbacks.get(colliderId).push({ callback, context });

    return () => {
      const arr = this.callbacks.get(colliderId);
      if (arr) {
        const idx = arr.findIndex(e => e.callback === callback);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  /**
   * Register a callback for particle-to-particle collisions.
   * @param {Function} callback  (particleA, particleB) => void
   * @param {*}        [context]
   * @returns {Function} Unsubscribe function.
   */
  onParticleCollision(callback, context = null) {
    return this.onCollision('__p2p__', callback, context);
  }

  // ─── Main Check ──────────────────────────────────────────────────

  /**
   * Run collision detection for an array of alive particles.
   *
   * @param {object[]} particles  Array of particle objects (must have
   *        x, y, vx, vy, collisionLayer, collisionBehavior, bounceFactor, alive).
   */
  checkCollisions(particles) {
    const t0 = performance.now();
    this.stats.checksPerFrame = 0;
    this.stats.collisionsPerFrame = 0;
    this.stats.particleToParticleChecks = 0;
    this.stats.particleToParticleCollisions = 0;

    // Rebuild particle spatial hash
    this._rebuildParticleGrid(particles);

    // --- Particle vs World colliders ---
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p || !p.alive) continue;

      const nearbyColliders = this._queryCollidersNear(p.x, p.y);
      for (const colId of nearbyColliders) {
        const collider = this.colliders.get(colId);
        if (!collider || !collider.active) continue;

        // Layer check
        if ((p.collisionLayer & collider.layerMask) === 0) continue;

        this.stats.checksPerFrame++;

        if (this._testAABB(p, collider)) {
          this.stats.collisionsPerFrame++;
          const collision = this.resolveCollision(p, collider);
          this._fireCallbacks(p, collider, collision);
        }
      }
    }

    // --- Particle vs Particle (optional) ---
    if (this.particleToParticleEnabled) {
      this._checkParticleToParticle();
    }

    this.stats.frameTimeMs = performance.now() - t0;
  }

  // ─── Spatial Hashing ─────────────────────────────────────────────

  /**
   * Convert a world-space coordinate to a spatial hash key string.
   * @param {number} x
   * @param {number} y
   * @returns {string}
   */
  spatialHash(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  /** Insert a collider's AABB into all overlapping grid cells. */
  _insertColliderIntoGrid(collider) {
    const minCX = Math.floor(collider.x / this.cellSize);
    const minCY = Math.floor(collider.y / this.cellSize);
    const maxCX = Math.floor((collider.x + collider.width) / this.cellSize);
    const maxCY = Math.floor((collider.y + collider.height) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = `${cx},${cy}`;
        if (!this.colliderGrid.has(key)) {
          this.colliderGrid.set(key, new Set());
        }
        this.colliderGrid.get(key).add(collider.id);
      }
    }
  }

  /** Remove a collider from all grid cells it occupied. */
  _removeColliderFromGrid(collider) {
    const minCX = Math.floor(collider.x / this.cellSize);
    const minCY = Math.floor(collider.y / this.cellSize);
    const maxCX = Math.floor((collider.x + collider.width) / this.cellSize);
    const maxCY = Math.floor((collider.y + collider.height) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.colliderGrid.get(key);
        if (cell) {
          cell.delete(collider.id);
          if (cell.size === 0) this.colliderGrid.delete(key);
        }
      }
    }
  }

  /** Rebuild the particle grid from scratch. */
  _rebuildParticleGrid(particles) {
    this.particleGrid.clear();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p || !p.alive) continue;

      const key = this.spatialHash(p.x, p.y);
      if (!this.particleGrid.has(key)) {
        this.particleGrid.set(key, []);
      }
      this.particleGrid.get(key).push(p);
    }
  }

  /**
   * Query the collider grid for colliders near a world position.
   * Returns a Set of collider IDs in the cell containing (x,y) and its
   * immediate neighbours.
   */
  _queryCollidersNear(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const result = new Set();

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.colliderGrid.get(key);
        if (cell) {
          for (const id of cell) {
            result.add(id);
          }
        }
      }
    }

    return result;
  }

  // ─── Narrow-Phase Tests ──────────────────────────────────────────

  /**
   * Point-in-AABB test: does the particle overlap the collider's box?
   * Particles are treated as points for simplicity and speed.
   */
  _testAABB(particle, collider) {
    return (
      particle.x >= collider.x &&
      particle.x <= collider.x + collider.width &&
      particle.y >= collider.y &&
      particle.y <= collider.y + collider.height
    );
  }

  /**
   * Circle-based distance test between two particles.
   * @param {object} a  Particle A.
   * @param {object} b  Particle B.
   * @param {number} radius  Collision radius per particle.
   * @returns {boolean}
   */
  _testParticlePair(a, b, radius = 4) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist2 = dx * dx + dy * dy;
    const minDist = (a.scale + b.scale) * radius;
    return dist2 <= minDist * minDist;
  }

  // ─── Resolution ──────────────────────────────────────────────────

  /**
   * Resolve a confirmed collision between a particle and a world collider.
   *
   * @param {object} particle   The colliding particle.
   * @param {object} collider   The collider AABB.
   * @returns {object} Collision info: { normal, depth, behavior }.
   */
  resolveCollision(particle, collider) {
    // Compute penetration on each axis to find the shallowest separation
    const halfW = collider.width / 2;
    const halfH = collider.height / 2;
    const cx = collider.x + halfW;
    const cy = collider.y + halfH;
    const dx = particle.x - cx;
    const dy = particle.y - cy;

    const overlapX = halfW - Math.abs(dx);
    const overlapY = halfH - Math.abs(dy);

    // Determine collision normal (axis of least penetration)
    let nx = 0, ny = 0, depth = 0;
    if (overlapX < overlapY) {
      nx = dx > 0 ? 1 : -1;
      depth = overlapX;
    } else {
      ny = dy > 0 ? 1 : -1;
      depth = overlapY;
    }

    const behavior = particle.collisionBehavior ?? 'die';
    const collision = { nx, ny, depth, behavior, colliderId: collider.id };

    switch (behavior) {
      case 'die':
        particle.life = 0; // Will be killed on next update
        break;

      case 'bounce': {
        // Push out of collider
        particle.x += nx * depth;
        particle.y += ny * depth;

        // Reflect velocity along normal
        const bounce = particle.bounceFactor ?? collider.bounciness ?? 0.5;
        if (nx !== 0) {
          particle.vx = -particle.vx * bounce;
        }
        if (ny !== 0) {
          particle.vy = -particle.vy * bounce;
        }

        // Apply surface friction to tangential velocity
        const friction = 1 - (collider.friction ?? 0.2);
        if (nx !== 0) particle.vy *= friction;
        if (ny !== 0) particle.vx *= friction;
        break;
      }

      case 'slide': {
        // Push out of collider
        particle.x += nx * depth;
        particle.y += ny * depth;

        // Zero the normal component of velocity; keep tangential
        if (nx !== 0) particle.vx = 0;
        if (ny !== 0) particle.vy = 0;

        // Friction
        const slideFriction = 1 - (collider.friction ?? 0.2);
        particle.vx *= slideFriction;
        particle.vy *= slideFriction;
        break;
      }

      case 'stick': {
        // Push to surface and freeze
        particle.x += nx * depth;
        particle.y += ny * depth;
        particle.vx = 0;
        particle.vy = 0;
        particle.ax = 0;
        particle.ay = 0;
        particle.rotationSpeed = 0;
        break;
      }

      default:
        particle.life = 0;
    }

    return collision;
  }

  // ─── Particle-to-Particle ────────────────────────────────────────

  /**
   * Check particle-to-particle collisions within the spatial grid.
   * Only particles in the same or adjacent cells are tested.
   */
  _checkParticleToParticle() {
    const checked = new Set(); // Track checked pairs to avoid duplicates

    for (const [key, cellParticles] of this.particleGrid) {
      // Gather particles from this cell and all 8 neighbours
      const nearby = [...cellParticles];
      const [cxStr, cyStr] = key.split(',');
      const cx = parseInt(cxStr, 10);
      const cy = parseInt(cyStr, 10);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nKey = `${cx + dx},${cy + dy}`;
          const nCell = this.particleGrid.get(nKey);
          if (nCell) nearby.push(...nCell);
        }
      }

      // Pairwise tests within the gathered set
      for (let i = 0; i < cellParticles.length; i++) {
        const a = cellParticles[i];
        if (!a.alive) continue;

        for (let j = 0; j < nearby.length; j++) {
          const b = nearby[j];
          if (!b.alive || a === b) continue;

          // Deduplicate pair
          const pairKey = a.index < b.index
            ? `${a.index}:${b.index}`
            : `${b.index}:${a.index}`;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);

          // Layer compatibility
          if ((a.collisionLayer & b.collisionLayer) === 0) continue;

          this.stats.particleToParticleChecks++;

          if (this._testParticlePair(a, b)) {
            this.stats.particleToParticleCollisions++;
            this._resolveParticleToParticle(a, b);
            this._fireParticleCallbacks(a, b);
          }
        }
      }
    }
  }

  /**
   * Simple elastic-ish resolution: swap velocities and push apart.
   */
  _resolveParticleToParticle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const nx = dx / dist;
    const ny = dy / dist;

    // Push apart
    const overlap = (a.scale + b.scale) * 4 - dist;
    if (overlap > 0) {
      const half = overlap / 2;
      a.x -= nx * half;
      a.y -= ny * half;
      b.x += nx * half;
      b.y += ny * half;
    }

    // Velocity exchange (simplified elastic collision)
    const relVx = a.vx - b.vx;
    const relVy = a.vy - b.vy;
    const dotN = relVx * nx + relVy * ny;

    // Only resolve if approaching
    if (dotN > 0) {
      const restitution = 0.5;
      const impulse = dotN * restitution;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }

  // ─── Callback Dispatch ───────────────────────────────────────────

  /** Fire registered callbacks for a particle-to-world collision. */
  _fireCallbacks(particle, collider, collision) {
    // Specific callbacks for this collider
    const specific = this.callbacks.get(collider.id);
    if (specific) {
      for (const { callback, context } of specific) {
        callback.call(context, particle, collider, collision);
      }
    }

    // Wildcard callbacks
    const wildcard = this.callbacks.get('*');
    if (wildcard) {
      for (const { callback, context } of wildcard) {
        callback.call(context, particle, collider, collision);
      }
    }

    this.eventBus.emit('collision:particleWorld', {
      particleIndex: particle.index,
      colliderId: collider.id,
      behavior: collision.behavior
    });
  }

  /** Fire registered callbacks for a particle-to-particle collision. */
  _fireParticleCallbacks(a, b) {
    const handlers = this.callbacks.get('__p2p__');
    if (handlers) {
      for (const { callback, context } of handlers) {
        callback.call(context, a, b);
      }
    }

    this.eventBus.emit('collision:particleParticle', {
      indexA: a.index,
      indexB: b.index
    });
  }

  // ─── Utility ─────────────────────────────────────────────────────

  /**
   * Query all particles within a rectangular region.
   * @param {number} x      Top-left X.
   * @param {number} y      Top-left Y.
   * @param {number} width   Rectangle width.
   * @param {number} height  Rectangle height.
   * @returns {object[]}  Array of particle references.
   */
  queryRegion(x, y, width, height) {
    const results = [];
    const minCX = Math.floor(x / this.cellSize);
    const minCY = Math.floor(y / this.cellSize);
    const maxCX = Math.floor((x + width) / this.cellSize);
    const maxCY = Math.floor((y + height) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.particleGrid.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const p of cell) {
          if (!p.alive) continue;
          if (p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height) {
            results.push(p);
          }
        }
      }
    }
    return results;
  }

  /**
   * Query all particles within a circular region.
   * @param {number} cx     Center X.
   * @param {number} cy     Center Y.
   * @param {number} radius Radius.
   * @returns {object[]}
   */
  queryRadius(cx, cy, radius) {
    const results = [];
    const r2 = radius * radius;
    const minCellX = Math.floor((cx - radius) / this.cellSize);
    const maxCellX = Math.floor((cx + radius) / this.cellSize);
    const minCellY = Math.floor((cy - radius) / this.cellSize);
    const maxCellY = Math.floor((cy + radius) / this.cellSize);

    for (let gx = minCellX; gx <= maxCellX; gx++) {
      for (let gy = minCellY; gy <= maxCellY; gy++) {
        const cell = this.particleGrid.get(`${gx},${gy}`);
        if (!cell) continue;
        for (const p of cell) {
          if (!p.alive) continue;
          const dx = p.x - cx;
          const dy = p.y - cy;
          if (dx * dx + dy * dy <= r2) {
            results.push(p);
          }
        }
      }
    }
    return results;
  }

  /**
   * Return current statistics.
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Remove all colliders and clear grids.
   */
  clear() {
    this.colliders.clear();
    this.colliderGrid.clear();
    this.particleGrid.clear();
    this.callbacks.clear();
    this.stats.colliderCount = 0;
  }

  /**
   * Destroy the collision system and release references.
   */
  destroy() {
    this.clear();
    this.colliders = null;
    this.colliderGrid = null;
    this.particleGrid = null;
    this.callbacks = null;
    this.eventBus = null;
  }
}

export default ParticleCollisionSystem;
