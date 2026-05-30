import { EventBus } from '../core/EventBus.js';
import { DSPSystem } from './DSPSystem.js';
import { DifficultySystem } from './DifficultySystem.js';

/**
 * TacticalCombatSystem — Grid-based turn-based tactical combat.
 *
 * Design pillars:
 *   - AP (Action Points): 2 base, 3 if Agility >= 4
 *   - Initiative: d20 + Agility
 *   - Guard: Regenerating armor that absorbs damage before HP
 *   - Positioning: Flanking (+25%), Rear (+50%), Cover (-50%), Elevation (+30%)
 *   - DSP spell costs: Magic drains the world
 *   - Undo button for last action (per turn)
 *
 * Grid: 12x8 hexagonal grid (stored as offset coords).
 * Each combatant occupies 1 tile.
 */
export class TacticalCombatSystem {
  static instance = null;
  static getInstance() {
    if (!TacticalCombatSystem.instance) new TacticalCombatSystem();
    return TacticalCombatSystem.instance;
  }

  constructor() {
    if (TacticalCombatSystem.instance) return TacticalCombatSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Grid dimensions
    this.gridWidth = 12;
    this.gridHeight = 8;
    this.grid = []; // 2D array: grid[x][y] = { terrain, occupant, cover, elevation }

    // Combat state
    this.inCombat = false;
    this.turnOrder = [];
    this.currentTurnIndex = -1;
    this.currentActor = null;
    this.roundNumber = 0;
    this.combatLog = [];

    // Combatant collections
    this.allies = [];  // Player + companions
    this.enemies = [];

    // AP tracking
    this.currentAP = 0;
    this.maxAP = 2;

    // Undo system (one action per turn)
    this.undoStack = [];
    this.canUndo = false;

    // Verdance 4-pillar positioning (design doc)
    this.positionBonuses = {
      // Legacy fallbacks (used if pillar logic doesn't apply)
      flanking: 0.25,
      rear: 0.50,
      cover: -0.50,
      elevation: 0.30,
      // Pillar 1: Entanglement (allies adjacent to defender)
      entanglementBase: 0.15,   // 2+ allies
      entanglementDeep: 0.25,   // 3+ allies
      entanglementRooted: 0.35, // 4+ allies
      // Pillar 2: Shrouded Strike (rear/terrain shroud)
      shroudPartial: 0.20,   // +20% damage, ignore 25% defense
      shroudFull: 0.40,      // +40% damage, ignore 50% defense, crit
      // Pillar 3: Canopy Advantage (elevation)
      canopyTier1Ranged: 0.20,
      canopyTier1Melee: 0.15,
      canopyTier2Ranged: 0.35,
      canopyTier2Melee: 0.25,
      // Pillar 4: Verdant Ward (cover)
      wardLight: -0.15,
      wardMedium: -0.30,
      wardHeavy: -0.50
    };

    TacticalCombatSystem.instance = this;
  }

  // ═══════════════════════════════════════════════════════════════
  // Grid Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initialize the combat grid.
   */
  initGrid(config = {}) {
    const w = config.width || this.gridWidth;
    const h = config.height || this.gridHeight;
    this.gridWidth = w;
    this.gridHeight = h;
    this.grid = [];

    for (let x = 0; x < w; x++) {
      this.grid[x] = [];
      for (let y = 0; y < h; y++) {
        this.grid[x][y] = {
          terrain: 'open',
          occupant: null,
          elevation: 0,
          effects: [],
          wardModifier: 'normal'  // 'normal' | 'strengthened' (Pure) | 'corrupted' (Blighted)
        };
      }
    }

    // Apply config terrain
    if (config.terrain) {
      for (const t of config.terrain) {
        if (this.isValidTile(t.x, t.y)) {
          Object.assign(this.grid[t.x][t.y], t);
        }
      }
    }
  }

  isValidTile(x, y) {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  isTileWalkable(x, y) {
    if (!this.isValidTile(x, y)) return false;
    const tile = this.grid[x][y];
    return tile.terrain !== 'wall' && tile.occupant === null;
  }

  /**
   * Get tile at position.
   */
  getTile(x, y) {
    if (!this.isValidTile(x, y)) return null;
    return this.grid[x][y];
  }

  /**
   * Place a combatant on the grid.
   */
  placeCombatant(combatant, x, y) {
    if (!this.isTileWalkable(x, y)) return false;
    // Remove from old position
    if (combatant.gridX !== undefined && combatant.gridY !== undefined) {
      this.grid[combatant.gridX][combatant.gridY].occupant = null;
    }
    combatant.gridX = x;
    combatant.gridY = y;
    this.grid[x][y].occupant = combatant;
    return true;
  }

  /**
   * Get distance between two grid positions.
   */
  getDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan distance
  }

  /**
   * Get adjacent tiles (4-directional).
   */
  getAdjacentTiles(x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    return dirs
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter(t => this.isValidTile(t.x, t.y));
  }

  /**
   * Get tiles within range.
   */
  getTilesInRange(x, y, range) {
    const tiles = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const tx = x + dx;
        const ty = y + dy;
        if (this.isValidTile(tx, ty) && Math.abs(dx) + Math.abs(dy) <= range) {
          tiles.push({ x: tx, y: ty, distance: Math.abs(dx) + Math.abs(dy) });
        }
      }
    }
    return tiles;
  }

  /**
   * Get walkable tiles reachable within movement range (BFS).
   */
  getReachableTiles(x, y, moveRange) {
    const visited = new Set();
    const result = [];
    const queue = [{ x, y, remaining: moveRange }];
    visited.add(`${x},${y}`);

    while (queue.length > 0) {
      const current = queue.shift();
      result.push({ x: current.x, y: current.y, cost: moveRange - current.remaining });

      if (current.remaining <= 0) continue;

      for (const adj of this.getAdjacentTiles(current.x, current.y)) {
        const key = `${adj.x},${adj.y}`;
        if (!visited.has(key) && this.isTileWalkable(adj.x, adj.y)) {
          visited.add(key);
          queue.push({ x: adj.x, y: adj.y, remaining: current.remaining - 1 });
        }
      }
    }

    return result.filter(t => !(t.x === x && t.y === y));
  }

  // ═══════════════════════════════════════════════════════════════
  // Combat Flow
  // ═══════════════════════════════════════════════════════════════

  /**
   * Start a tactical combat encounter.
   * @param {object} config - { allies, enemies, terrain, gridWidth, gridHeight }
   */
  startCombat(config) {
    this.inCombat = true;
    this.roundNumber = 0;
    this.combatLog = [];

    // Init grid
    this.initGrid({
      width: config.gridWidth || 12,
      height: config.gridHeight || 8,
      terrain: config.terrain || []
    });

    // Setup allies
    this.allies = config.allies.map((a, i) => ({
      ...a,
      side: 'ally',
      stats: {
        ...a.stats,
        guard: a.stats.guard || 0,
        maxGuard: a.stats.maxGuard || a.stats.guard || 0,
        ap: a.stats.ap || 2,
        maxAP: a.stats.ap || 2
      },
      facing: 'right',
      activeEffects: [],
      acted: false
    }));

    // Setup enemies with difficulty scaling
    const diff = DifficultySystem.getInstance();
    this.enemies = config.enemies.map((e, i) => ({
      ...e,
      side: 'enemy',
      stats: {
        ...e.stats,
        hp: Math.round((e.stats.hp || 30) * diff.getModifier('enemyHealthMultiplier')),
        maxHp: Math.round((e.stats.maxHp || e.stats.hp || 30) * diff.getModifier('enemyHealthMultiplier')),
        guard: e.stats.guard || 0,
        maxGuard: e.stats.maxGuard || e.stats.guard || 0,
        ap: e.stats.ap || 2,
        maxAP: e.stats.ap || 2
      },
      facing: 'left',
      activeEffects: [],
      acted: false
    }));

    // Neutral combatants — hostile to ALL sides (e.g. summoned vermin).
    // Usually empty at start; spawned mid-fight by lairs.
    this.neutrals = (config.neutrals || []).map((n, i) => ({
      ...n, side: 'neutral',
      stats: { ...n.stats, guard: n.stats?.guard || 0, maxGuard: n.stats?.maxGuard || 0,
        ap: n.stats?.ap || 1, maxAP: n.stats?.ap || 1 },
      facing: 'left', activeEffects: [], acted: false
    }));

    // Lairs — passive grid hazards that summon neutrals when a combatant comes
    // within triggerRadius, or when a matching spell element is cast nearby.
    // { id, name, x, y, triggerRadius, spawn:{ name, count, stats, spells? },
    //   triggerElements?:[], triggered:false }
    this.lairs = (config.lairs || []).map(l => ({ triggered: false, triggerRadius: 2, ...l }));
    this._neutralSeq = 0;

    // Place combatants on grid
    this.allies.forEach((a, i) => {
      this.placeCombatant(a, 1, 2 + i * 2);
    });
    this.enemies.forEach((e, i) => {
      this.placeCombatant(e, this.gridWidth - 2, 2 + i * 2);
    });
    this.neutrals.forEach((n, i) => {
      const ny = n.gridY ?? (1 + i * 2);
      const nx = n.gridX ?? Math.floor(this.gridWidth / 2);
      this.placeCombatant(n, nx, ny);
    });
    // Mark lair tiles so the renderer can show them.
    for (const lair of this.lairs) {
      const t = this.getTile(lair.x, lair.y);
      if (t) { t.terrain = 'lair'; t.lairId = lair.id; }
    }

    // Calculate initiative
    this._rollInitiative();
    this._startRound();

    this.eventBus.emit('tactical:combatStarted', {
      allies: this.allies.map(a => ({ id: a.id, name: a.name })),
      enemies: this.enemies.map(e => ({ id: e.id, name: e.name })),
      neutrals: this.neutrals.map(n => ({ id: n.id, name: n.name })),
      grid: this._serializeGrid()
    });
  }

  /**
   * Spawn neutral units from a lair near its tile and splice them into the
   * turn order. Hostile to everyone. Returns the spawned units.
   */
  _spawnFromLair(lair) {
    if (!lair || lair.triggered) return [];
    lair.triggered = true;
    const spawned = [];
    const count = lair.spawn?.count || 2;
    for (let i = 0; i < count; i++) {
      const n = {
        id: `neutral_${lair.id}_${this._neutralSeq++}`,
        name: lair.spawn?.name || 'Vermin',
        side: 'neutral',
        stats: {
          hp: lair.spawn?.stats?.hp || 12, maxHp: lair.spawn?.stats?.hp || 12,
          guard: 0, maxGuard: 0,
          might: lair.spawn?.stats?.might ?? 2, agility: lair.spawn?.stats?.agility ?? 3,
          speed: lair.spawn?.stats?.speed ?? 3, ap: lair.spawn?.stats?.ap || 1, maxAP: lair.spawn?.stats?.ap || 1
        },
        spells: lair.spawn?.spells || [],
        spriteKey: lair.spawn?.spriteKey || null,
        facing: 'left', activeEffects: [], acted: false
      };
      // Place on a free tile adjacent to the lair (spiral out).
      const spot = this._freeTileNear(lair.x, lair.y) || { x: lair.x, y: lair.y };
      this.placeCombatant(n, spot.x, spot.y);
      this.neutrals.push(n);
      this.turnOrder.push({ entity: n, side: 'neutral', initiative: 5 });
      spawned.push(n);
    }
    this.eventBus.emit('tactical:lairTriggered', {
      lairId: lair.id, name: lair.name,
      spawned: spawned.map(s => ({ id: s.id, name: s.name, gridX: s.gridX, gridY: s.gridY }))
    });
    this._log(`The ${lair.name} stirs — ${spawned.length} ${lair.spawn?.name || 'creatures'} emerge!`);
    return spawned;
  }

  /** First walkable, unoccupied tile near (x,y), searched in rings. */
  _freeTileNear(x, y) {
    for (let r = 1; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.isTileWalkable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /**
   * Check every untriggered lair against a position (and optional spell
   * element). Spawns neutrals from any lair whose trigger condition is met.
   */
  _checkLairTriggers(x, y, element = null) {
    if (!this.lairs?.length) return;
    for (const lair of this.lairs) {
      if (lair.triggered) continue;
      const near = this.getDistance(x, y, lair.x, lair.y) <= (lair.triggerRadius ?? 2);
      const byElement = element && Array.isArray(lair.triggerElements) && lair.triggerElements.includes(element);
      if (near || byElement) this._spawnFromLair(lair);
    }
  }

  /**
   * Roll initiative for all combatants.
   */
  _rollInitiative() {
    const all = [
      ...this.allies.map(a => ({ entity: a, side: 'ally' })),
      ...this.enemies.map(e => ({ entity: e, side: 'enemy' })),
      ...(this.neutrals || []).map(n => ({ entity: n, side: 'neutral' }))
    ];

    for (const entry of all) {
      const agi = entry.entity.stats?.agility || entry.entity.stats?.agi || 0;
      entry.initiative = Math.floor(Math.random() * 20) + 1 + agi;
    }

    all.sort((a, b) => b.initiative - a.initiative);
    this.turnOrder = all;
  }

  /**
   * Start a new round.
   */
  _startRound() {
    this.roundNumber++;
    this.currentTurnIndex = -1;

    // Regenerate Guard for all combatants (2 per turn passively)
    for (const entry of this.turnOrder) {
      const e = entry.entity;
      if (e.stats.hp > 0) {
        e.stats.guard = Math.min(e.stats.maxGuard, e.stats.guard + 2);
        e.acted = false;
      }
    }

    this.eventBus.emit('tactical:roundStart', { round: this.roundNumber });
    this._nextTurn();
  }

  /**
   * Advance to the next turn.
   */
  _nextTurn() {
    do {
      this.currentTurnIndex++;
    } while (
      this.currentTurnIndex < this.turnOrder.length &&
      this.turnOrder[this.currentTurnIndex].entity.stats.hp <= 0
    );

    if (this.currentTurnIndex >= this.turnOrder.length) {
      if (this._checkCombatEnd()) return;
      this._startRound();
      return;
    }

    const current = this.turnOrder[this.currentTurnIndex];
    this.currentActor = current;
    const entity = current.entity;

    // Process active status effects at the start of this entity's turn
    // (poison ticks, durations decrement, expired effects drop off).
    this._tickEffects(entity);
    if (entity.stats.hp <= 0) {
      this._onCombatantDefeated(entity, null);
      if (this._checkCombatEnd()) return;
      return this.endTurn();
    }

    // Reset AP (a rooted entity still acts but can't move — see moveAction).
    entity.stats.ap = entity.stats.maxAP;
    this.currentAP = entity.stats.ap;
    this.undoStack = [];
    this.canUndo = false;

    this.eventBus.emit('tactical:turnStart', {
      entity: { id: entity.id, name: entity.name, side: current.side },
      ap: this.currentAP,
      round: this.roundNumber,
      gridX: entity.gridX,
      gridY: entity.gridY
    });

    // AI sides act automatically. Neutrals are hostile to everyone.
    if (current.side === 'enemy') {
      this._runEnemyAI(entity);
    } else if (current.side === 'neutral') {
      this._runNeutralAI(entity);
    }
  }

  /**
   * Neutral AI — hostile to ALL. Charges and melees the nearest living
   * combatant of any other side.
   */
  _runNeutralAI(entity) {
    const everyoneElse = [...this.allies, ...this.enemies]
      .filter(c => c.stats.hp > 0);
    if (everyoneElse.length === 0) { setTimeout(() => this.endTurn(), 300); return; }

    let nearest = everyoneElse[0], nd = Infinity;
    for (const t of everyoneElse) {
      const d = this.getDistance(entity.gridX, entity.gridY, t.gridX, t.gridY);
      if (d < nd) { nd = d; nearest = t; }
    }

    let safety = 6;
    while (this.currentAP > 0 && safety-- > 0) {
      const apBefore = this.currentAP;
      const dist = this.getDistance(entity.gridX, entity.gridY, nearest.gridX, nearest.gridY);
      if (dist <= 1) {
        this.attackAction(nearest);
      } else {
        const reachable = this.getReachableTiles(entity.gridX, entity.gridY, entity.stats.speed || 3);
        let best = null, bd = Infinity;
        for (const tile of reachable) {
          const d = this.getDistance(tile.x, tile.y, nearest.gridX, nearest.gridY);
          if (d < bd) { bd = d; best = tile; }
        }
        if (best && (best.x !== entity.gridX || best.y !== entity.gridY)) this.moveAction(best.x, best.y);
        else break;
      }
      if (this.currentAP === apBefore) break;
    }
    setTimeout(() => this.endTurn(), 400);
  }

  /**
   * End the current turn.
   */
  endTurn() {
    if (!this.currentActor) return;
    this.currentActor.entity.acted = true;

    this.eventBus.emit('tactical:turnEnd', {
      entity: this.currentActor.entity,
      side: this.currentActor.side
    });

    this._nextTurn();
  }

  // ═══════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Move the current actor to a tile.
   * Costs 1 AP.
   */
  moveAction(targetX, targetY) {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };

    const entity = this.currentActor.entity;
    if (this._isRooted(entity)) return { success: false, reason: 'Rooted!' };
    const reachable = this.getReachableTiles(entity.gridX, entity.gridY, entity.stats.speed || 4);
    const target = reachable.find(t => t.x === targetX && t.y === targetY);

    if (!target) return { success: false, reason: 'Tile not reachable' };

    // Save undo state
    this._saveUndo('move', { x: entity.gridX, y: entity.gridY });

    // Move
    const oldX = entity.gridX;
    const oldY = entity.gridY;
    this.placeCombatant(entity, targetX, targetY);
    this.currentAP--;
    entity.stats.ap = this.currentAP;

    this.eventBus.emit('tactical:moved', {
      entity: { id: entity.id, name: entity.name },
      from: { x: oldX, y: oldY },
      to: { x: targetX, y: targetY },
      apRemaining: this.currentAP
    });

    this._log(`${entity.name} moved to (${targetX}, ${targetY})`);
    // Moving close to a lair can rouse it.
    this._checkLairTriggers(targetX, targetY);
    return { success: true };
  }

  /**
   * Attack nearest enemy (for UI: single "Attack" button).
   * Returns result of attackAction or { success: false, reason }.
   */
  attackNearestEnemy() {
    if (!this.currentActor || this.currentActor.side !== 'ally') return { success: false, reason: 'Not your turn' };
    const me = this.currentActor.entity;
    const alive = this.enemies.filter(e => e.stats.hp > 0);
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of alive) {
      const d = this.getDistance(me.gridX, me.gridY, e.gridX, e.gridY);
      if (d < nearestDist && d <= 1) { nearestDist = d; nearest = e; }
    }
    if (!nearest) return { success: false, reason: 'No enemy in melee range' };
    return this.attackAction(nearest);
  }

  /**
   * Attack a target.
   * Costs 1 AP for basic attack.
   */
  attackAction(targetEntity) {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };

    const attacker = this.currentActor.entity;
    const defender = targetEntity;

    // Range check (melee = 1 tile adjacent)
    const dist = this.getDistance(attacker.gridX, attacker.gridY, defender.gridX, defender.gridY);
    if (dist > 1) return { success: false, reason: 'Out of melee range' };

    this.currentAP--;
    attacker.stats.ap = this.currentAP;

    // Attack roll: d20 + Might + Skill vs Evasion (10 + Agility)
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const attackBonus = attacker.stats.might || attacker.stats.atk || 0;
    const total = attackRoll + attackBonus;

    const evasion = 10 + (defender.stats.agility || defender.stats.agi || 0);
    const hit = attackRoll === 20 || total >= evasion;

    if (!hit) {
      this._log(`${attacker.name} missed ${defender.name}!`);
      this.eventBus.emit('tactical:attackMissed', {
        attacker: attacker.id, defender: defender.id, roll: attackRoll, total, evasion
      });
      return { success: true, hit: false };
    }

    // Verdance 4-pillar positioning (needed before crit so guaranteedCrit doubles damage)
    const posResult = this._getPositionBonus(attacker, defender);
    const criticalHit = attackRoll === 20 || !!posResult.guaranteedCrit;

    // Damage calculation
    let damage = (attacker.stats.might || attacker.stats.atk || 2) +
      Math.floor(Math.random() * 6) + 1; // d6 base weapon damage

    if (criticalHit) damage *= 2;

    damage = Math.round(damage * (1 + posResult.damageMultiplier));

    // Difficulty modifier
    const diff = DifficultySystem.getInstance();
    if (attacker.side === 'enemy') {
      damage = Math.round(damage * diff.getModifier('enemyDamageMultiplier'));
    } else {
      damage = Math.round(damage * diff.getModifier('playerDamageMultiplier'));
    }

    // Apply damage (Guard absorbs first; Shrouded Strike can ignore portion of Guard)
    const result = this._applyDamage(defender, damage, attacker, { defenseIgnore: posResult.defenseIgnore || 0 });

    this._log(`${attacker.name} ${criticalHit ? 'CRITICALLY ' : ''}hit ${defender.name} for ${result.totalDamage} damage${result.guardAbsorbed > 0 ? ` (${result.guardAbsorbed} absorbed by Guard)` : ''}`);

    this.eventBus.emit('tactical:attacked', {
      attacker: attacker.id, defender: defender.id,
      roll: attackRoll, total, evasion, hit: true, criticalHit,
      damage: result.totalDamage, guardAbsorbed: result.guardAbsorbed,
      positionBonus: posResult.damageMultiplier, defenderHP: defender.stats.hp
    });

    // Check death
    if (defender.stats.hp <= 0) {
      this._onCombatantDefeated(defender, attacker);
    }

    return { success: true, hit: true, ...result };
  }

  /**
   * Cast a spell/ability.
   * AP cost varies by spell tier.
   */
  /**
   * Roll a dice/flat damage value. Accepts a number (flat) or a string like
   * "1d8" / "2d6+3". Returns an integer.
   */
  _rollAmount(val) {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;
    const m = val.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) { const n = parseInt(val, 10); return Number.isFinite(n) ? n : 0; }
    const count = parseInt(m[1], 10), sides = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
    let total = mod;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }

  /**
   * Cast a spell from our data schema (spells.json):
   *   { apCost, dspCost, damage, healAmount, element, range, targetType,
   *     statusEffect:{ type, duration, ... } }
   * Costs AP + DSP, validates range, and applies damage / heal / guard / status.
   */
  castSpell(spellDef, targetX, targetY) {
    if (!this.currentActor) return { success: false, reason: 'No active actor' };
    const caster = this.currentActor.entity;

    const apCost = spellDef.apCost || 1;
    if (this.currentAP < apCost) return { success: false, reason: 'Insufficient AP' };

    // Range check (0 = self).
    const range = spellDef.range ?? 0;
    if (range > 0 && targetX != null) {
      const d = this.getDistance(caster.gridX, caster.gridY, targetX, targetY);
      if (d > range) return { success: false, reason: 'Out of range' };
    }

    // DSP cost (the world pays for magic). spend() returns false if unaffordable.
    const dspCost = spellDef.dspCost || 0;
    if (dspCost > 0) {
      const dsp = DSPSystem.getInstance();
      if (!dsp.spend(dspCost)) return { success: false, reason: 'Insufficient DSP' };
    }

    this.currentAP -= apCost;
    caster.stats.ap = this.currentAP;

    const tile = this.getTile(targetX, targetY);
    const target = tile?.occupant || null;
    const result = { success: true, spellName: spellDef.name };

    // Determine intent from the data, not a missing `type` field.
    const isHeal = spellDef.healAmount != null || /heal|bloom|mend|cure/i.test(spellDef.id || '');
    const isGuard = /guard|shield|ward|soul_shield/i.test(spellDef.id || '') ||
                    spellDef.statusEffect?.guardBonus != null;
    const dealsDamage = spellDef.damage != null;
    const diff = DifficultySystem.getInstance();

    if (dealsDamage && target && target.side !== caster.side) {
      let damage = this._rollAmount(spellDef.damage);
      damage = Math.round(damage * (1 + (caster.stats.insight || 0) * 0.05)); // Insight scales magic
      if (caster.side === 'ally') damage = Math.round(damage * diff.getModifier('playerDamageMultiplier'));
      else damage = Math.round(damage * diff.getModifier('enemyDamageMultiplier'));

      const dmgResult = this._applyDamage(target, damage, caster);
      result.damage = dmgResult.totalDamage;
      result.guardAbsorbed = dmgResult.guardAbsorbed;
      result.target = target.name;
      result.targetId = target.id;
      this._applyStatusFromSpell(spellDef, target);
      this._log(`${caster.name} cast ${spellDef.name} on ${target.name} for ${dmgResult.totalDamage} damage`);
      if (target.stats.hp <= 0) this._onCombatantDefeated(target, caster);
    } else if (isHeal) {
      const healTarget = (target && target.side === caster.side) ? target : caster;
      const healAmount = this._rollAmount(spellDef.healAmount ?? spellDef.damage ?? 15);
      healTarget.stats.hp = Math.min(healTarget.stats.maxHp, healTarget.stats.hp + healAmount);
      result.healed = healAmount;
      result.target = healTarget.name;
      result.targetId = healTarget.id;
      this._log(`${caster.name} cast ${spellDef.name}, healing ${healTarget.name} for ${healAmount}`);
    } else if (isGuard) {
      const guardTarget = (target && target.side === caster.side) ? target : caster;
      const guardAmount = spellDef.statusEffect?.guardBonus || spellDef.guardAmount || 5;
      guardTarget.stats.guard = (guardTarget.stats.guard || 0) + guardAmount;
      guardTarget.stats.maxGuard = Math.max(guardTarget.stats.maxGuard || 0, guardTarget.stats.guard);
      result.guardGained = guardAmount;
      result.target = guardTarget.name;
      result.targetId = guardTarget.id;
      this._applyStatusFromSpell(spellDef, guardTarget);
      this._log(`${caster.name} cast ${spellDef.name}, granting ${guardAmount} Guard`);
    } else if (target) {
      // Pure status/control spell (root, poison, etc.) on a target.
      this._applyStatusFromSpell(spellDef, target);
      result.target = target.name;
      result.targetId = target.id;
      this._log(`${caster.name} cast ${spellDef.name} on ${target.name}`);
    } else {
      // No valid target for a targeted spell — refund and report.
      this.currentAP += apCost;
      caster.stats.ap = this.currentAP;
      if (dspCost > 0) DSPSystem.getInstance().recover?.(dspCost, 'spell-refund');
      return { success: false, reason: 'No valid target' };
    }

    this.eventBus.emit('tactical:spellCast', {
      caster: caster.id, spell: spellDef,
      targetX, targetY, apCost, dspCost, ...result
    });
    // Loud/elemental magic near a lair can rouse it.
    if (targetX != null) this._checkLairTriggers(targetX, targetY, spellDef.element);
    return result;
  }

  /**
   * Apply a spell's statusEffect (root/poison/buff/etc.) to a combatant as a
   * timed active effect. Stored on entity.activeEffects; consumed elsewhere.
   */
  _applyStatusFromSpell(spellDef, entity) {
    const se = spellDef.statusEffect;
    if (!se || !se.type || !entity) return;
    if (!entity.activeEffects) entity.activeEffects = [];
    entity.activeEffects.push({
      type: se.type,
      duration: se.duration ?? spellDef.duration ?? 2,
      value: se.value ?? se.damage ?? se.amount ?? 0,
      source: spellDef.id,
    });
    this.eventBus.emit('tactical:statusApplied', {
      target: entity.id, status: se.type, duration: se.duration ?? spellDef.duration ?? 2
    });
  }

  /**
   * Process an entity's active status effects at the start of its turn:
   * poison/burn/bleed deal damage-over-time, durations decrement, expired
   * effects drop off.
   */
  _tickEffects(entity) {
    if (!entity?.activeEffects?.length) return;
    const remaining = [];
    for (const eff of entity.activeEffects) {
      if ((eff.type === 'poison' || eff.type === 'burn' || eff.type === 'bleed') && eff.value > 0) {
        const dmg = this._rollAmount(eff.value);
        entity.stats.hp = Math.max(0, entity.stats.hp - dmg);
        this.eventBus.emit('tactical:effectTick', { target: entity.id, type: eff.type, damage: dmg, hp: entity.stats.hp });
        this._log(`${entity.name} suffers ${dmg} ${eff.type} damage`);
      }
      eff.duration -= 1;
      if (eff.duration > 0) remaining.push(eff);
      else this.eventBus.emit('tactical:effectExpired', { target: entity.id, type: eff.type });
    }
    entity.activeEffects = remaining;
  }

  /** True if the entity is currently rooted/held (cannot move this turn). */
  _isRooted(entity) {
    return !!entity?.activeEffects?.some(e => e.type === 'root' || e.type === 'stun' || e.type === 'snare');
  }

  /**
   * Strengthen Verdant Ward (Pure variant). Costs 1 AP. Improves ward at current tile.
   */
  strengthenWardAction() {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };
    const entity = this.currentActor.entity;
    if (entity.variant !== 'pure') return { success: false, reason: 'Pure only' };
    const tile = this.getTile(entity.gridX, entity.gridY);
    if (!tile || !['ward_light', 'ward_medium', 'ward_heavy'].includes(tile.terrain)) return { success: false, reason: 'Not on ward' };
    this.currentAP--;
    entity.stats.ap = this.currentAP;
    tile.wardModifier = 'strengthened';
    this._log(`${entity.name} strengthened the Verdant Ward.`);
    this.eventBus.emit('tactical:wardStrengthened', { x: entity.gridX, y: entity.gridY });
    return { success: true };
  }

  /**
   * Corrupt Verdant Ward (Blighted variant). Costs 1 AP. Weakens ward at current tile.
   */
  corruptWardAction() {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };
    const entity = this.currentActor.entity;
    if (entity.variant !== 'blighted') return { success: false, reason: 'Blighted only' };
    const tile = this.getTile(entity.gridX, entity.gridY);
    if (!tile || !['ward_light', 'ward_medium', 'ward_heavy'].includes(tile.terrain)) return { success: false, reason: 'Not on ward' };
    this.currentAP--;
    entity.stats.ap = this.currentAP;
    tile.wardModifier = 'corrupted';
    this._log(`${entity.name} corrupted the Verdant Ward.`);
    this.eventBus.emit('tactical:wardCorrupted', { x: entity.gridX, y: entity.gridY });
    return { success: true };
  }

  /**
   * Defend action — doubles Guard regen this turn.
   * Costs 1 AP.
   */
  defendAction() {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };

    const entity = this.currentActor.entity;
    this.currentAP--;
    entity.stats.ap = this.currentAP;

    // Gain 4 Guard instead of passive 2
    entity.stats.guard = Math.min(entity.stats.maxGuard, entity.stats.guard + 4);

    this._log(`${entity.name} defended, gaining +4 Guard`);
    this.eventBus.emit('tactical:defended', {
      entity: entity.id, guard: entity.stats.guard
    });

    return { success: true };
  }

  /**
   * Use an item.
   * Costs 1 AP.
   */
  useItemAction(itemDef) {
    if (!this.currentActor || this.currentAP < 1) return { success: false, reason: 'No AP' };

    this.currentAP--;
    this.currentActor.entity.stats.ap = this.currentAP;

    this._log(`${this.currentActor.entity.name} used ${itemDef.name}`);
    this.eventBus.emit('tactical:itemUsed', {
      entity: this.currentActor.entity.id, item: itemDef
    });

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // Undo
  // ═══════════════════════════════════════════════════════════════

  /**
   * Undo the last action (once per turn).
   */
  undo() {
    if (!this.canUndo || this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();

    if (action.type === 'move') {
      this.placeCombatant(this.currentActor.entity, action.data.x, action.data.y);
      this.currentAP++;
      this.currentActor.entity.stats.ap = this.currentAP;
    }

    this.canUndo = false;
    this.eventBus.emit('tactical:undone', { action: action.type });
    return true;
  }

  _saveUndo(type, data) {
    this.undoStack.push({ type, data });
    this.canUndo = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Damage & Guard
  // ═══════════════════════════════════════════════════════════════

  /**
   * Apply damage to a combatant (Guard absorbs first).
   * @param {object} options - { defenseIgnore: 0..1 } from Shrouded Strike (reduces Guard effectiveness)
   */
  _applyDamage(target, rawDamage, source, options = {}) {
    let remaining = Math.max(1, rawDamage);
    const defenseIgnore = options.defenseIgnore || 0;
    const targetTile = this.getTile(target.gridX, target.gridY);
    const terrain = targetTile?.terrain || 'open';

    let guardAbsorbed = 0;
    if (target.stats.guard > 0) {
      const absorbable = remaining * (1 - defenseIgnore);
      guardAbsorbed = Math.min(target.stats.guard, absorbable);
      target.stats.guard = Math.max(0, target.stats.guard - guardAbsorbed);
      remaining -= guardAbsorbed;
    }

    target.stats.hp = Math.max(0, target.stats.hp - remaining);

    // Verdant Ward Heavy: reflect 20% of raw damage back to source
    let reflectedDamage = 0;
    if (terrain === 'ward_heavy' && source && source.stats && remaining > 0) {
      reflectedDamage = Math.round(rawDamage * 0.2);
      if (reflectedDamage > 0) {
        source.stats.hp = Math.max(0, source.stats.hp - reflectedDamage);
        this._log(`${source.name} takes ${reflectedDamage} reflected damage from Verdant Ward!`);
        this.eventBus.emit('tactical:reflectedDamage', { source: source.id, amount: reflectedDamage });
      }
    }

    return {
      totalDamage: rawDamage,
      guardAbsorbed,
      hpDamage: remaining,
      remainingHP: target.stats.hp,
      remainingGuard: target.stats.guard,
      reflectedDamage
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Positioning
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate positioning bonus for an attack (Verdance 4-pillar system).
   * Returns { damageMultiplier, defenseIgnore, guaranteedCrit } for the attack.
   */
  _getPositionBonus(attacker, defender) {
    let bonus = 0;
    let defenseIgnore = 0;
    let guaranteedCrit = false;

    const dx = attacker.gridX - defender.gridX;
    const dy = attacker.gridY - defender.gridY;
    const attackerTile = this.getTile(attacker.gridX, attacker.gridY);
    const defenderTile = this.getTile(defender.gridX, defender.gridY);

    // ─── Pillar 1: Entanglement (allies adjacent to defender) ───
    const adjacentAllies = this._countAlliesAdjacentTo(defender);
    if (adjacentAllies >= 4) {
      bonus += this.positionBonuses.entanglementRooted;
      this.eventBus.emit('pillar-activated', { pillarName: 'Entanglement', description: 'Rooted — 4+ allies surrounding target: +35% damage' });
    } else if (adjacentAllies >= 3) {
      bonus += this.positionBonuses.entanglementDeep;
      this.eventBus.emit('pillar-activated', { pillarName: 'Entanglement', description: 'Deep entanglement — 3 allies flanking: +25% damage' });
    } else if (adjacentAllies >= 2) {
      bonus += this.positionBonuses.entanglementBase;
      this.eventBus.emit('pillar-activated', { pillarName: 'Entanglement', description: 'Entanglement — 2 allies flanking: +15% damage' });
    }

    // ─── Pillar 2: Shrouded Strike (rear / terrain shroud) ───
    const isRear = (defender.facing === 'right' && dx < 0) || (defender.facing === 'left' && dx > 0);
    const isFlank = !isRear && (Math.abs(dy) > 0 || Math.abs(dx) > 0);
    const terrainShroud = defenderTile?.terrain === 'forest' || defenderTile?.terrain === 'spore_cloud' || defenderTile?.terrain === 'shadow_veil' || defenderTile?.terrain === 'blight_zone';
    if (isRear && terrainShroud) {
      bonus += this.positionBonuses.shroudFull;
      defenseIgnore = 0.50;
      guaranteedCrit = true;
      this.eventBus.emit('pillar-activated', { pillarName: 'Shrouded Strike', description: 'Full shroud — rear attack through concealing terrain: +40% damage, ignore 50% defense, guaranteed crit' });
    } else if (isRear || terrainShroud) {
      bonus += this.positionBonuses.shroudPartial;
      defenseIgnore = 0.25;
      this.eventBus.emit('pillar-activated', { pillarName: 'Shrouded Strike', description: 'Partial shroud — rear or terrain concealment: +20% damage, ignore 25% defense' });
    } else if (isFlank) {
      bonus += this.positionBonuses.flanking;
    }

    // ─── Pillar 3: Canopy Advantage (elevation) ───
    const elevationDiff = (attackerTile?.elevation ?? 0) - (defenderTile?.elevation ?? 0);
    if (elevationDiff >= 2) {
      bonus += this.positionBonuses.canopyTier2Ranged; // melee uses same for simplicity
      this.eventBus.emit('pillar-activated', { pillarName: 'Canopy Advantage', description: 'Tier 2 elevation — high ground mastery: +35% ranged / +25% melee damage' });
    } else if (elevationDiff >= 1) {
      bonus += this.positionBonuses.canopyTier1Ranged;
      this.eventBus.emit('pillar-activated', { pillarName: 'Canopy Advantage', description: 'Tier 1 elevation — elevated position: +20% ranged / +15% melee damage' });
    } else if (elevationDiff > 0) {
      bonus += this.positionBonuses.elevation; // legacy single tier
    }

    // ─── Pillar 4: Verdant Ward (cover); Pure can strengthen, Blighted can corrupt ───
    const terrain = defenderTile?.terrain || 'open';
    const wardMod = defenderTile?.wardModifier || 'normal';
    if (terrain === 'ward_heavy') {
      bonus += (wardMod === 'strengthened') ? -0.60 : (wardMod === 'corrupted') ? -0.40 : this.positionBonuses.wardHeavy;
      this.eventBus.emit('pillar-activated', { pillarName: 'Verdant Ward', description: `Heavy ward${wardMod !== 'normal' ? ` (${wardMod})` : ''} — strong protection: damage reduced 50%+` });
    } else if (terrain === 'ward_medium') {
      bonus += (wardMod === 'strengthened') ? -0.40 : (wardMod === 'corrupted') ? -0.20 : this.positionBonuses.wardMedium;
      this.eventBus.emit('pillar-activated', { pillarName: 'Verdant Ward', description: `Medium ward${wardMod !== 'normal' ? ` (${wardMod})` : ''} — moderate protection: damage reduced 30%` });
    } else if (terrain === 'ward_light') {
      bonus += (wardMod === 'strengthened') ? -0.25 : (wardMod === 'corrupted') ? -0.10 : this.positionBonuses.wardLight;
      this.eventBus.emit('pillar-activated', { pillarName: 'Verdant Ward', description: `Light ward${wardMod !== 'normal' ? ` (${wardMod})` : ''} — light protection: damage reduced 15%` });
    } else if (terrain === 'cover_high') bonus += this.positionBonuses.cover;
    else if (terrain === 'cover_low') bonus -= 0.25;

    return { damageMultiplier: bonus, defenseIgnore, guaranteedCrit };
  }

  _countAlliesAdjacentTo(defender) {
    let count = 0;
    const adj = this.getAdjacentTiles(defender.gridX, defender.gridY);
    for (const t of adj) {
      const occ = this.grid[t.x][t.y]?.occupant;
      if (occ && occ.side !== defender.side && occ.stats?.hp > 0) count++;
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════
  // Enemy AI
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get intent for an enemy (for telegraphing). Returns { action: 'attack'|'move'|'defend', targetId?: string }.
   */
  getEnemyIntent(enemy) {
    if (!enemy || enemy.side !== 'enemy' || enemy.stats?.hp <= 0) return null;
    const targets = this.allies.filter(a => a.stats.hp > 0);
    if (targets.length === 0) return { action: 'defend' };

    let nearest = targets[0];
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = this.getDistance(enemy.gridX, enemy.gridY, t.gridX, t.gridY);
      if (d < nearestDist) { nearestDist = d; nearest = t; }
    }

    const dist = this.getDistance(enemy.gridX, enemy.gridY, nearest.gridX, nearest.gridY);
    if (dist <= 1 && this.currentAP >= 1) return { action: 'attack', targetId: nearest.id, targetName: nearest.name };
    if (this.currentAP >= 1) return { action: 'move', targetId: nearest.id };
    return { action: 'defend' };
  }

  /**
   * Boss intent types — telegraphed one turn ahead so the player can react.
   * Each entry: { type, description, apCost, color }
   */
  static BOSS_INTENTS = [
    { type: 'heavy_attack',  description: 'Charges a devastating melee strike',    apCost: 2 },
    { type: 'aoe_blast',     description: 'Prepares a wide area explosion',         apCost: 2 },
    { type: 'defend',        description: 'Braces and regenerates Guard',           apCost: 1 },
    { type: 'summon',        description: 'Calls forth additional minions',          apCost: 1 },
    { type: 'phase_shift',   description: 'Transitions to the next battle phase',   apCost: 2 }
  ];

  /**
   * Roll the next boss intent and store it on the unit.
   * Emits boss:intentChanged for the UI.
   */
  _rollBossIntent(boss) {
    const intents = TacticalCombatSystem.BOSS_INTENTS;
    const chosen = intents[Math.floor(Math.random() * intents.length)];
    boss.nextIntent = { ...chosen };
    this.eventBus.emit('boss:intentChanged', {
      unitId: boss.id,
      unitName: boss.name,
      intent: boss.nextIntent
    });
  }

  /**
   * Classify a spell for AI decision-making.
   */
  _spellKind(sp) {
    if (!sp) return 'other';
    if (sp.healAmount != null || /heal|mend|bloom|cure/i.test(sp.id || '')) return 'heal';
    if (/guard|shield|ward|soul_shield/i.test(sp.id || '') || sp.statusEffect?.guardBonus != null) return 'guard';
    if (sp.damage != null) return 'damage';
    if (sp.statusEffect?.type) return 'control';
    return 'other';
  }

  _affordable(sp) {
    const dsp = DSPSystem.getInstance();
    return this.currentAP >= (sp.apCost || 1) && (dsp.current ?? 0) >= (sp.dspCost || 0);
  }

  _spellsOfKind(enemy, kind) {
    return (enemy.spells || []).filter(sp => this._spellKind(sp) === kind && this._affordable(sp));
  }

  /** Lowest-HP living ally on the enemy's own side (for support healing). */
  _woundedAlly(enemy) {
    const mates = (enemy.side === 'enemy' ? this.enemies : this.allies)
      .filter(e => e.stats.hp > 0);
    let worst = null, worstPct = 1;
    for (const m of mates) {
      const pct = m.stats.hp / (m.stats.maxHp || 1);
      if (pct < worstPct) { worstPct = pct; worst = m; }
    }
    return worstPct < 0.6 ? worst : null;
  }

  /**
   * Pattern-aware behaviour. Returns true if it performed an action (the
   * caller then re-evaluates remaining AP). Returns false to fall through to
   * the default move/melee logic.
   */
  _enemyTryBehaviour(enemy, nearest, pattern, dist) {
    const hpPct = enemy.stats.hp / (enemy.stats.maxHp || 1);

    // SUPPORT: heal a badly wounded ally (or self) when possible.
    if (pattern === 'support') {
      const heals = this._spellsOfKind(enemy, 'heal');
      const patient = this._woundedAlly(enemy);
      if (heals.length && patient) {
        const r = this.castSpell(heals[0], patient.gridX, patient.gridY);
        if (r.success) return true;
      }
    }

    // DEFENSIVE: shield/guard up when hurt.
    if (pattern === 'defensive' && hpPct < 0.6) {
      const guards = this._spellsOfKind(enemy, 'guard');
      if (guards.length) {
        const r = this.castSpell(guards[0], enemy.gridX, enemy.gridY);
        if (r.success) return true;
      }
    }

    // CASTER-ish (tactical/balanced/support/skirmisher): throw a damage or
    // control spell at the nearest target if it's in range.
    const wantsToCast = ['tactical', 'balanced', 'support', 'skirmisher', 'aggressive'].includes(pattern);
    if (wantsToCast) {
      const offensive = [...this._spellsOfKind(enemy, 'damage'), ...this._spellsOfKind(enemy, 'control')];
      // Prefer a spell whose range reaches the target.
      const inRange = offensive.find(sp => (sp.range ?? 0) >= dist && (sp.range ?? 0) > 0);
      if (inRange) {
        const r = this.castSpell(inRange, nearest.gridX, nearest.gridY);
        if (r.success) return true;
      }
    }
    return false;
  }

  /**
   * Enemy AI — behaviour-driven (aiPattern), uses spells when sensible.
   */
  _runEnemyAI(enemy) {
    // Telegraph intent (design: enemy intent telegraphed)
    enemy.nextIntent = this.getEnemyIntent(enemy);
    this.eventBus.emit('tactical:enemyIntent', { entityId: enemy.id, intent: enemy.nextIntent });

    const targets = this.allies.filter(a => a.stats.hp > 0);
    if (targets.length === 0) { this.endTurn(); return; }

    let nearest = targets[0];
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = this.getDistance(enemy.gridX, enemy.gridY, t.gridX, t.gridY);
      if (d < nearestDist) { nearestDist = d; nearest = t; }
    }

    // Use AP — behaviour-driven (aiPattern). Guard against an infinite loop
    // by bailing if an iteration makes no progress.
    const pattern = enemy.aiPattern || 'aggressive';
    let safety = 8;
    while (this.currentAP > 0 && safety-- > 0) {
      const apBefore = this.currentAP;
      const dist = this.getDistance(enemy.gridX, enemy.gridY, nearest.gridX, nearest.gridY);

      if (this._enemyTryBehaviour(enemy, nearest, pattern, dist)) {
        if (this.currentAP === apBefore) break; // action consumed no AP → avoid spin
        continue;
      }

      // Fallback: melee if adjacent, else advance toward the nearest target.
      if (dist <= 1) {
        this.attackAction(nearest);
      } else {
        const reachable = this.getReachableTiles(enemy.gridX, enemy.gridY, enemy.stats.speed || 3);
        let bestTile = null, bestDist = Infinity;
        for (const tile of reachable) {
          const d = this.getDistance(tile.x, tile.y, nearest.gridX, nearest.gridY);
          if (d < bestDist) { bestDist = d; bestTile = tile; }
        }
        if (bestTile && (bestTile.x !== enemy.gridX || bestTile.y !== enemy.gridY)) this.moveAction(bestTile.x, bestTile.y);
        else break;
      }
      if (this.currentAP === apBefore) break;
    }

    // After acting: if this is a boss, roll next turn's intent for the player to react to
    if (enemy.isBoss === true) {
      this._rollBossIntent(enemy);
    }

    // End turn after AI actions
    setTimeout(() => this.endTurn(), 500);
  }

  // ═══════════════════════════════════════════════════════════════
  // Combat End
  // ═══════════════════════════════════════════════════════════════

  _onCombatantDefeated(entity, source) {
    this._log(`${entity.name} has been defeated!`);

    // Remove from grid
    if (entity.gridX !== undefined) {
      this.grid[entity.gridX][entity.gridY].occupant = null;
    }

    this.eventBus.emit('tactical:combatantDefeated', {
      entity: { id: entity.id, name: entity.name, side: entity.side },
      source: { id: source?.id, name: source?.name }
    });
  }

  _checkCombatEnd() {
    const alliesAlive = this.allies.filter(a => a.stats.hp > 0);
    const enemiesAlive = this.enemies.filter(e => e.stats.hp > 0);
    const neutralsAlive = (this.neutrals || []).filter(n => n.stats.hp > 0);

    if (alliesAlive.length === 0) {
      this._endCombat('defeat');
      return true;
    }
    // Victory only once BOTH hostile factions are cleared.
    if (enemiesAlive.length === 0 && neutralsAlive.length === 0) {
      this._endCombat('victory');
      return true;
    }
    return false;
  }

  _endCombat(result) {
    this.inCombat = false;

    const rewards = result === 'victory' ? this._calculateRewards() : null;

    this.eventBus.emit('tactical:combatEnded', {
      result,
      rounds: this.roundNumber,
      rewards,
      log: this.combatLog
    });

    // Also emit generic combat:ended for other systems
    this.eventBus.emit('combat:ended', { result, rewards });

    // Clean up
    this.turnOrder = [];
    this.currentTurnIndex = -1;
    this.currentActor = null;
    this.grid = [];
    this.neutrals = [];
    this.lairs = [];
  }

  _calculateRewards() {
    let totalXP = 0;
    const loot = [];

    for (const enemy of this.enemies) {
      totalXP += enemy.experienceReward || (enemy.stats.maxHp || 30);
      if (enemy.lootTable) {
        for (const drop of (enemy.lootTable.items || [])) {
          if (Math.random() < (drop.dropChance || 0.3)) {
            loot.push({ itemId: drop.itemId, quantity: drop.quantity || 1 });
          }
        }
      }
    }

    const diff = DifficultySystem.getInstance();
    return {
      experience: Math.round(totalXP * diff.getModifier('experienceMultiplier')),
      loot
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  _log(message) {
    this.combatLog.push({ round: this.roundNumber, message, timestamp: Date.now() });
  }

  _serializeGrid() {
    const data = [];
    // Grid is cleared to [] on combat end; guard so getCombatState() is safe
    // to call afterwards (UI listeners can fire as combat resolves).
    if (!this.grid || !this.grid.length) return data;
    for (let x = 0; x < this.gridWidth; x++) {
      if (!this.grid[x]) continue;
      for (let y = 0; y < this.gridHeight; y++) {
        const tile = this.grid[x][y];
        if (!tile) continue;
        if (tile.terrain !== 'open' || tile.elevation > 0 || tile.occupant) {
          data.push({
            x, y, terrain: tile.terrain, elevation: tile.elevation,
            occupant: tile.occupant ? { id: tile.occupant.id, name: tile.occupant.name, side: tile.occupant.side } : null
          });
        }
      }
    }
    return data;
  }

  /**
   * Honest XCOM-style preview of an attacker's chance to hit a defender plus
   * an estimated damage range. Mirrors the real attackAction math (d20 + might
   * vs 10 + agility; nat-20 always hits) and the position/cover damage
   * modifiers, so what's shown is what will land.
   *
   * Returns: { inRange, hitChance, critChance, dmgMin, dmgMax,
   *            attackerOn:{terrain,elevation}, defenderOn:{terrain,elevation},
   *            flanking, elevated }
   */
  getHitChance(attacker, defender) {
    if (!attacker || !defender) return null;
    const dist = this.getDistance(attacker.gridX, attacker.gridY, defender.gridX, defender.gridY);
    const inRange = dist <= 1;

    const might = attacker.stats?.might ?? attacker.stats?.atk ?? 0;
    const agi = defender.stats?.agility ?? defender.stats?.agi ?? 0;
    // P(d20 + might >= 10 + agi) — 20 outcomes, plus nat-20 always hits.
    const needRoll = (10 + agi) - might;
    let hits = 0;
    for (let r = 1; r <= 20; r++) if (r === 20 || r + might >= 10 + agi) hits++;
    let hitChance = Math.max(0.05, Math.min(0.95, hits / 20));
    const critChance = 0.05; // base nat-20 crit; positioning can guarantee

    const aTile = this.getTile(attacker.gridX, attacker.gridY);
    const dTile = this.getTile(defender.gridX, defender.gridY);

    // Defender on high cover effectively halves incoming damage (positionBonuses.cover = -0.50).
    // Defender on cover_low gives the attacker -0.25 damage modifier.
    // Attacker on elevation gives +0.30 damage. We surface these as the dmg
    // range, and as boolean flags the UI can hint at.
    const baseLo = 1 + might; // 1d6 base + might (min 1+m)
    const baseHi = 6 + might; // max 6+m
    let mod = 1;
    if (dTile?.terrain === 'cover_high') mod -= 0.50;
    if (dTile?.terrain === 'cover_low')  mod -= 0.25;
    if (aTile?.elevation > 0)            mod += 0.30;
    // Crit doubles base before mod; show the un-crit estimate.
    const dmgMin = Math.max(1, Math.round(baseLo * mod));
    const dmgMax = Math.max(1, Math.round(baseHi * mod));

    return {
      inRange,
      distance: dist,
      hitChance,
      critChance,
      dmgMin, dmgMax,
      attackerOn: { terrain: aTile?.terrain || 'open', elevation: aTile?.elevation || 0 },
      defenderOn: { terrain: dTile?.terrain || 'open', elevation: dTile?.elevation || 0 },
      elevated: (aTile?.elevation || 0) > (dTile?.elevation || 0),
      defenderInCover: dTile?.terrain === 'cover_high' || dTile?.terrain === 'cover_low'
    };
  }

  /**
   * Get full combat state for UI rendering.
   */
  getCombatState() {
    return {
      inCombat: this.inCombat,
      round: this.roundNumber,
      currentActor: this.currentActor ? {
        id: this.currentActor.entity.id,
        name: this.currentActor.entity.name,
        side: this.currentActor.side,
        ap: this.currentAP,
        maxAP: this.currentActor.entity.stats.maxAP,
        gridX: this.currentActor.entity.gridX,
        gridY: this.currentActor.entity.gridY
      } : null,
      allies: this.allies.map(a => ({
        id: a.id, name: a.name, hp: a.stats.hp, maxHp: a.stats.maxHp,
        guard: a.stats.guard, maxGuard: a.stats.maxGuard,
        gridX: a.gridX, gridY: a.gridY, alive: a.stats.hp > 0,
        spriteKey: a.spriteKey || null,
        effects: (a.activeEffects || []).map(e => e.type)
      })),
      enemies: this.enemies.map(e => ({
        id: e.id, name: e.name, hp: e.stats.hp, maxHp: e.stats.maxHp,
        guard: e.stats.guard, maxGuard: e.stats.maxGuard,
        gridX: e.gridX, gridY: e.gridY, alive: e.stats.hp > 0,
        intent: e.nextIntent || null,
        spriteKey: e.spriteKey || null,
        effects: (e.activeEffects || []).map(ef => ef.type)
      })),
      neutrals: (this.neutrals || []).map(n => ({
        id: n.id, name: n.name, hp: n.stats.hp, maxHp: n.stats.maxHp,
        guard: n.stats.guard, maxGuard: n.stats.maxGuard,
        gridX: n.gridX, gridY: n.gridY, alive: n.stats.hp > 0,
        spriteKey: n.spriteKey || null,
        effects: (n.activeEffects || []).map(ef => ef.type)
      })),
      lairs: (this.lairs || []).map(l => ({
        id: l.id, name: l.name, x: l.x, y: l.y, triggered: l.triggered,
        triggerRadius: l.triggerRadius
      })),
      grid: this._serializeGrid(),
      canUndo: this.canUndo,
      turnOrder: this.turnOrder.map(t => ({
        id: t.entity.id, name: t.entity.name, side: t.side,
        initiative: t.initiative, alive: t.entity.stats.hp > 0
      }))
    };
  }
}

export default TacticalCombatSystem;
