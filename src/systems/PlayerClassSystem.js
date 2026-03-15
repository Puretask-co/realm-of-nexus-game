import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * PlayerClassSystem — Rewired to consume classes.json with Verdance class names.
 *
 * 5 Verdance classes (from classes.json):
 *   Bloomguard     — Tank (Resilience-focused)
 *   Thornbinder    — Rogue (Agility-focused)
 *   Emerald Mystic — Caster/Healer (Insight-focused)
 *   Wildkin Ranger — Ranged DPS (Agility/Might)
 *   Sporecaller    — Debuffer/Controller (Resilience/Insight)
 *
 * Each class has:
 *   - Verdance attributes (Might, Agility, Resilience, Insight, Charisma)
 *   - Starting HP, Guard, and AP
 *   - Starting spells and class abilities at levels 1, 3, 7, and ultimate at 10
 *   - A talent tree with 5 nodes
 *   - Pure and Blighted variants
 *   - Preferred weapons and armor
 *
 * Also supports legacy 4 classes for backwards compatibility.
 */
export class PlayerClassSystem {
  static instance = null;

  static getInstance() {
    if (!PlayerClassSystem.instance) new PlayerClassSystem();
    return PlayerClassSystem.instance;
  }

  constructor() {
    if (PlayerClassSystem.instance) return PlayerClassSystem.instance;
    this.eventBus = EventBus.getInstance();
    this.currentClass = null;
    this.classDefinitions = new Map();
    this.tierProgression = {};
    this.multiclassingRules = {};
    this.pureBlightedVariant = null; // 'pure' or 'blighted'

    // Load from data
    this._loadFromData();

    // Listen for data reloads
    this.eventBus.on('data-reloaded', () => this._loadFromData());

    PlayerClassSystem.instance = this;
  }

  /**
   * Load class definitions from classes.json via DataManager.
   */
  _loadFromData() {
    const classData = dataManager.getClassData?.() || {};
    const classes = classData.classes || [];
    this.tierProgression = classData.tierProgression || {};
    this.multiclassingRules = classData.multiclassing || {};

    this.classDefinitions.clear();

    for (const cls of classes) {
      this.classDefinitions.set(cls.id, cls);
    }

    // If no classes loaded from JSON, register legacy fallbacks
    if (this.classDefinitions.size === 0) {
      this._registerLegacyClasses();
    }

    console.log(`[PlayerClassSystem] Loaded ${this.classDefinitions.size} classes from data`);
  }

  /**
   * Legacy fallback classes (old 4-class system).
   */
  _registerLegacyClasses() {
    const legacy = [
      {
        id: 'bloomguard', name: 'Bloomguard', role: 'Tank',
        description: 'Front-line protector channeling the Verdance\'s great trees.',
        baseStats: { might: 3, agility: 0, resilience: 4, insight: 1, charisma: 1 },
        startingHP: 45, startingGuard: 10, baseAP: 3,
        startingSpells: ['soul_shield', 'verdant_grasp'],
        classAbilities: { level1: [] }, talentTree: { id: 'guardians_oath' },
        preferredWeapons: ['mace', 'sword_and_shield'], preferredArmor: 'heavy'
      },
      {
        id: 'thornbinder', name: 'Thornbinder', role: 'Rogue',
        description: 'Shadow operative who uses stealth and precision strikes.',
        baseStats: { might: 1, agility: 4, resilience: 1, insight: 2, charisma: 1 },
        startingHP: 30, startingGuard: 3, baseAP: 4,
        startingSpells: ['shadow_step', 'thorn_volley'],
        classAbilities: { level1: [] }, talentTree: { id: 'tactical_mind' },
        preferredWeapons: ['dagger', 'shortbow'], preferredArmor: 'light'
      },
      {
        id: 'emerald_mystic', name: 'Emerald Mystic', role: 'Caster/Healer',
        description: 'Soul magic specialist who channels the Sap for healing and destruction.',
        baseStats: { might: 0, agility: 1, resilience: 1, insight: 4, charisma: 3 },
        startingHP: 28, startingGuard: 2, baseAP: 3,
        startingSpells: ['verdant_bloom', 'verdant_heal'],
        classAbilities: { level1: [] }, talentTree: { id: 'soul_magic_mastery' },
        preferredWeapons: ['staff', 'wand'], preferredArmor: 'light'
      },
      {
        id: 'wildkin_ranger', name: 'Wildkin Ranger', role: 'Ranged DPS',
        description: 'Nature-bonded ranger with beast companion and ranged mastery.',
        baseStats: { might: 2, agility: 3, resilience: 1, insight: 2, charisma: 1 },
        startingHP: 34, startingGuard: 4, baseAP: 3,
        startingSpells: ['thorn_volley', 'wind_arrow'],
        classAbilities: { level1: [] }, talentTree: { id: 'verdant_bond' },
        preferredWeapons: ['longbow', 'crossbow'], preferredArmor: 'medium'
      },
      {
        id: 'sporecaller', name: 'Sporecaller', role: 'Debuffer/Controller',
        description: 'Decay magic user who weakens enemies and controls the battlefield.',
        baseStats: { might: 0, agility: 1, resilience: 3, insight: 3, charisma: 2 },
        startingHP: 32, startingGuard: 5, baseAP: 3,
        startingSpells: ['spore_cloud', 'root_snare'],
        classAbilities: { level1: [] }, talentTree: { id: 'martial_prowess' },
        preferredWeapons: ['staff', 'sickle'], preferredArmor: 'medium'
      }
    ];

    for (const cls of legacy) {
      this.classDefinitions.set(cls.id, cls);
    }
  }

  // ─── API ────────────────────────────────────────────────────────────

  getClass(classId) {
    return this.classDefinitions.get(classId) || null;
  }

  getAllClasses() {
    return [...this.classDefinitions.values()];
  }

  selectClass(classId) {
    const classDef = this.getClass(classId);
    if (!classDef) return false;

    this.currentClass = classDef;
    this.eventBus.emit('class:selected', { classId, classDef });
    return true;
  }

  getCurrentClass() {
    return this.currentClass;
  }

  /**
   * Set Pure or Blighted variant.
   */
  setVariant(variant) {
    if (variant !== 'pure' && variant !== 'blighted') return false;
    this.pureBlightedVariant = variant;
    this.eventBus.emit('class:variantSet', { variant });
    return true;
  }

  getVariant() {
    return this.pureBlightedVariant;
  }

  /**
   * Get class abilities available at a given level.
   */
  getAbilitiesForLevel(level) {
    if (!this.currentClass?.classAbilities) return [];
    const abilities = [];
    if (level >= 1 && this.currentClass.classAbilities.level1) {
      abilities.push(...this.currentClass.classAbilities.level1);
    }
    if (level >= 3 && this.currentClass.classAbilities.level3) {
      abilities.push(...this.currentClass.classAbilities.level3);
    }
    if (level >= 7 && this.currentClass.classAbilities.level7) {
      abilities.push(...this.currentClass.classAbilities.level7);
    }
    if (level >= 10 && this.currentClass.classAbilities.ultimate) {
      abilities.push(this.currentClass.classAbilities.ultimate);
    }
    return abilities;
  }

  /**
   * Get talent tree for current class.
   */
  getTalentTree() {
    return this.currentClass?.talentTree || null;
  }

  /**
   * Get starting spells for the current class.
   */
  getStartingSpells() {
    return this.currentClass?.startingSpells || [];
  }

  /**
   * Apply class base stats to create initial player stats.
   * Uses Verdance attribute system (Might, Agility, Resilience, Insight, Charisma).
   */
  applyClassStats(playerStats) {
    if (!this.currentClass) return playerStats;

    const cls = this.currentClass;
    return {
      ...playerStats,
      hp: cls.startingHP || 30,
      maxHp: cls.startingHP || 30,
      guard: cls.startingGuard || 0,
      maxGuard: cls.startingGuard || 0,
      ap: cls.baseAP || 2,
      maxAP: cls.baseAP || 2,
      might: cls.baseStats?.might || 0,
      agility: cls.baseStats?.agility || 0,
      resilience: cls.baseStats?.resilience || 0,
      insight: cls.baseStats?.insight || 0,
      charisma: cls.baseStats?.charisma || 0,
      classId: cls.id,
      className: cls.name,
      classRole: cls.role,
      preferredWeapons: cls.preferredWeapons || [],
      preferredArmor: cls.preferredArmor || 'light'
    };
  }

  /**
   * Apply stat growth for a level-up.
   * In the new system: +1 attribute point, +10 HP, +5 Guard, +1 skill rank
   */
  applyLevelUpGrowth(playerStats, level) {
    if (!this.currentClass) return playerStats;

    const newStats = { ...playerStats };

    // HP growth
    newStats.maxHp += 10;
    newStats.hp = newStats.maxHp; // Full heal on level up

    // Guard growth
    newStats.maxGuard += 5;
    newStats.guard = newStats.maxGuard;

    // AP check: if agility reaches 4, gain +1 AP
    if (newStats.agility >= 4 && newStats.maxAP < 3) {
      newStats.maxAP = 3;
      newStats.ap = newStats.maxAP;
    }

    return newStats;
  }

  /**
   * Get available spells for current class up to a given level.
   */
  getAvailableSpells(level) {
    const spells = [...(this.currentClass?.startingSpells || [])];

    // Add class ability spells at milestone levels
    if (level >= 3 && this.currentClass?.classAbilities?.level3) {
      for (const ability of this.currentClass.classAbilities.level3) {
        if (ability.type === 'active') spells.push(ability.id);
      }
    }
    if (level >= 7 && this.currentClass?.classAbilities?.level7) {
      for (const ability of this.currentClass.classAbilities.level7) {
        if (ability.type === 'active') spells.push(ability.id);
      }
    }
    if (level >= 10 && this.currentClass?.classAbilities?.ultimate) {
      const ult = this.currentClass.classAbilities.ultimate;
      if (ult.id) spells.push(ult.id);
    }

    return spells;
  }

  /**
   * Get passive abilities active at a given level.
   */
  getActivePassives(level) {
    const passives = [];
    const tree = this.currentClass?.talentTree;
    if (!tree?.nodes) return passives;

    for (const node of tree.nodes) {
      if ((node.unlockLevel || 1) <= level && node.type === 'passive') {
        passives.push(node);
      }
    }
    return passives;
  }

  /**
   * Serialization for save/load.
   */
  serialize() {
    return {
      currentClassId: this.currentClass?.id || null,
      pureBlightedVariant: this.pureBlightedVariant
    };
  }

  deserialize(data) {
    if (data?.currentClassId) {
      this.selectClass(data.currentClassId);
    }
    if (data?.pureBlightedVariant) {
      this.pureBlightedVariant = data.pureBlightedVariant;
    }
  }
}

export default PlayerClassSystem;
