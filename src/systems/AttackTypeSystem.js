import { EventBus } from '../core/EventBus.js';

/**
 * AttackTypeSystem — differentiates melee, ranged, and magic attacks.
 *
 * Responsibilities:
 *  - Range validation before an attack lands
 *  - Damage-type routing (physical vs magical) for CombatSystem
 *  - Projectile travel events for ranged/magic so the renderer can animate them
 *
 * Usage (GameScene):
 *   this.attackTypeSystem = AttackTypeSystem.getInstance();
 *   const result = this.attackTypeSystem.validateAttack(attacker, target, weapon);
 *   if (!result.canAttack) { showFloatingText(result.reason); return; }
 */
export class AttackTypeSystem {

  // ─── Attack type constants ────────────────────────────────────────

  static MELEE  = 'melee';   // Physical, must be within range.melee px
  static RANGED = 'ranged';  // Physical projectile, range.ranged px
  static MAGIC  = 'magic';   // Spell-based, range.magic px

  // ─── Default ranges (px) ─────────────────────────────────────────

  static DEFAULT_RANGES = {
    melee:  40,
    ranged: 400,
    magic:  350,
  };

  // ─── Singleton ───────────────────────────────────────────────────

  static instance = null;

  static getInstance() {
    if (!AttackTypeSystem.instance) new AttackTypeSystem();
    return AttackTypeSystem.instance;
  }

  constructor() {
    if (AttackTypeSystem.instance) return AttackTypeSystem.instance;
    this.eventBus = EventBus.getInstance();
    AttackTypeSystem.instance = this;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Returns effective range for the given attack type.
   * If the weapon/spell overrides the range via weapon.range, that wins.
   * @param {string} attackType - 'melee' | 'ranged' | 'magic'
   * @param {number|undefined} weaponRange - optional override from weapon data
   * @returns {number} effective range in pixels
   */
  getRange(attackType, weaponRange) {
    if (typeof weaponRange === 'number' && weaponRange > 0) return weaponRange;
    return AttackTypeSystem.DEFAULT_RANGES[attackType] ??
           AttackTypeSystem.DEFAULT_RANGES[AttackTypeSystem.MELEE];
  }

  /**
   * Returns the damage category that the attack falls into.
   * CombatSystem uses this to pick the correct resistance stat.
   * @param {string} attackType
   * @returns {'physical'|'magical'}
   */
  getDamageType(attackType) {
    return attackType === AttackTypeSystem.MAGIC ? 'magical' : 'physical';
  }

  /**
   * Pure range check — does not mutate state.
   * @param {number} attackerX
   * @param {number} attackerY
   * @param {number} targetX
   * @param {number} targetY
   * @param {string} attackType
   * @param {number|undefined} overrideRange
   * @returns {boolean}
   */
  canAttack(attackerX, attackerY, targetX, targetY, attackType, overrideRange) {
    const range = this.getRange(attackType, overrideRange);
    const dist  = Math.hypot(targetX - attackerX, targetY - attackerY);
    return dist <= range;
  }

  /**
   * Full validation called by GameScene before processing damage.
   *
   * @param {object} attacker  - has .x, .y (world-space) and optionally .stats
   * @param {object} target    - has .x, .y
   * @param {object} weapon    - { attackType: 'melee'|'ranged'|'magic', range? }
   *                             Falls back to 'magic' for spells (weapon = spell data).
   * @returns {{ canAttack: boolean, reason: string, attackType: string, damageType: string, distance: number }}
   */
  validateAttack(attacker, target, weapon) {
    const attackType  = weapon?.attackType ?? AttackTypeSystem.MAGIC;
    const damageType  = this.getDamageType(attackType);
    const range       = this.getRange(attackType, weapon?.range);
    const distance    = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    const inRange     = distance <= range;

    if (!inRange) {
      const reason = attackType === AttackTypeSystem.MELEE
        ? 'Out of range!'
        : `Target is too far! (${Math.round(distance)}/${range}px)`;

      return { canAttack: false, reason, attackType, damageType, distance };
    }

    return { canAttack: true, reason: '', attackType, damageType, distance };
  }

  /**
   * Fire a projectile travel event.
   * Called after validateAttack confirms the attack is valid and the attack
   * type is ranged or magic. The renderer/VFX layer listens to this event.
   *
   * @param {object} attacker
   * @param {object} target
   * @param {string} attackType
   * @param {object} extraData  - anything the renderer needs (spell, damage, etc.)
   */
  fireProjectile(attacker, target, attackType, extraData = {}) {
    this.eventBus.emit('attack:projectile', {
      attackType,
      fromX: attacker.x,
      fromY: attacker.y,
      toX: target.x,
      toY: target.y,
      speed: attackType === AttackTypeSystem.RANGED ? 600 : 480,   // px/s
      ...extraData
    });
  }

  /**
   * Convenience: resolve which visual style to use for damage numbers.
   * @param {string} attackType
   * @returns {number} hex colour tint
   */
  getDamageColor(attackType) {
    switch (attackType) {
      case AttackTypeSystem.MELEE:  return 0xffffff;  // white — physical strike
      case AttackTypeSystem.RANGED: return 0xffdd44;  // yellow — arrow/bolt
      case AttackTypeSystem.MAGIC:  return 0xffaa44;  // orange-gold — magic
      default:                      return 0xffffff;
    }
  }
}
