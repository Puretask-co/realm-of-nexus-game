import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * AttributeSystem — Verdance's 5 core attributes and derived stats.
 *
 * Attributes: Might, Agility, Resilience, Insight, Charisma
 * - Allocated at character creation (8 points, max 4 per attr, cap 6)
 * - Modified by ancestry bonuses
 * - +1 per level
 *
 * Derived stats are computed from attributes + class + equipment.
 */
export class AttributeSystem {
  static instance = null;
  static getInstance() {
    if (!AttributeSystem.instance) new AttributeSystem();
    return AttributeSystem.instance;
  }

  constructor() {
    if (AttributeSystem.instance) return AttributeSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Config from config.json
    const attrCfg = dataManager.getConfig('balance.attributes') || {};
    this.attributeNames = attrCfg.list || ['Might', 'Agility', 'Resilience', 'Insight', 'Charisma'];
    this.pointsAtCreation = attrCfg.pointsAtCreation || 8;
    this.minAtCreation = attrCfg.minAtCreation || 0;
    this.maxAtCreation = attrCfg.maxAtCreation || 4;
    this.absoluteCap = attrCfg.absoluteCap || 6;

    // Current attribute values
    this.attributes = {
      might: 0,
      agility: 0,
      resilience: 0,
      insight: 0,
      charisma: 0
    };

    // Ancestry modifiers applied
    this.ancestryMods = {};

    // Derived stats config
    const derived = dataManager.getConfig('balance.derivedStats') || {};
    this.derivedConfig = derived;

    AttributeSystem.instance = this;
  }

  /**
   * Set base attributes from character creation.
   */
  setBaseAttributes(attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      const k = key.toLowerCase();
      if (this.attributes[k] !== undefined) {
        this.attributes[k] = Math.min(this.absoluteCap, val);
      }
    }
    this.eventBus.emit('attributes:changed', this.getAll());
  }

  /**
   * Apply ancestry attribute modifiers.
   */
  applyAncestryModifiers(ancestry) {
    if (!ancestry?.attributeModifiers) return;
    this.ancestryMods = {};
    for (const mod of ancestry.attributeModifiers) {
      if (mod.attribute === 'player_choice') continue; // Handled in UI
      if (mod.attribute === 'dspMaxReserve') continue; // Handled by DSP system
      const key = mod.attribute.toLowerCase();
      if (this.attributes[key] !== undefined) {
        this.attributes[key] = Math.min(this.absoluteCap, this.attributes[key] + mod.value);
        this.ancestryMods[key] = (this.ancestryMods[key] || 0) + mod.value;
      }
    }
    this.eventBus.emit('attributes:changed', this.getAll());
  }

  /**
   * Apply class base stats as attribute starting points.
   */
  applyClassStats(classDef) {
    if (!classDef?.baseStats) return;
    const bs = classDef.baseStats;
    for (const [key, val] of Object.entries(bs)) {
      const k = key.toLowerCase();
      if (this.attributes[k] !== undefined) {
        this.attributes[k] = Math.min(this.absoluteCap, val);
      }
    }
    this.eventBus.emit('attributes:changed', this.getAll());
  }

  /**
   * Award an attribute point (on level up).
   */
  investPoint(attribute) {
    const key = attribute.toLowerCase();
    if (this.attributes[key] === undefined) return false;
    if (this.attributes[key] >= this.absoluteCap) return false;
    this.attributes[key]++;
    this.eventBus.emit('attributes:changed', this.getAll());
    return true;
  }

  /**
   * Get a single attribute value.
   */
  get(attribute) {
    return this.attributes[attribute.toLowerCase()] || 0;
  }

  /**
   * Get all attributes.
   */
  getAll() {
    return { ...this.attributes };
  }

  /**
   * Compute derived stats from current attributes + class.
   */
  computeDerivedStats(classDef) {
    const a = this.attributes;

    // HP: base 20 + (Resilience x 5) + class startingHP
    const classHP = classDef?.startingHP || 30;
    const hp = classHP + (a.resilience * 5);

    // Guard: base 5 + class startingGuard
    const classGuard = classDef?.startingGuard || 0;
    const guard = classGuard;

    // AP: base 2, +1 if Agility >= 4
    const baseAP = classDef?.baseAP || 2;
    const ap = a.agility >= 4 ? baseAP + 1 : baseAP;

    // Speed: 4 + Agility modifier
    const speed = 4 + a.agility;

    // Evasion: 10 + Agility
    const evasion = 10 + a.agility;

    // Carry capacity: 10 + (Might x 5)
    const carry = 10 + (a.might * 5);

    // Initiative bonus: Agility
    const initiativeBonus = a.agility;

    // Attack bonus: Might for physical, Insight for magic
    const physicalAttackBonus = a.might;
    const magicAttackBonus = a.insight;

    return {
      maxHp: hp,
      hp,
      maxGuard: guard,
      guard,
      ap,
      speed,
      evasion,
      carry,
      initiativeBonus,
      physicalAttackBonus,
      magicAttackBonus,
      might: a.might,
      agility: a.agility,
      resilience: a.resilience,
      insight: a.insight,
      charisma: a.charisma
    };
  }

  /**
   * Serialize for save.
   */
  serialize() {
    return { attributes: { ...this.attributes }, ancestryMods: { ...this.ancestryMods } };
  }

  deserialize(data) {
    if (data?.attributes) this.attributes = { ...data.attributes };
    if (data?.ancestryMods) this.ancestryMods = { ...data.ancestryMods };
  }
}

export default AttributeSystem;
