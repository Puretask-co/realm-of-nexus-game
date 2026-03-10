import { EventBus } from '../core/EventBus.js';

/**
 * PlayerClassSystem — Defines the 4 player classes of Verdance.
 *
 * Each class has:
 *  - Unique base stats and stat growth rates
 *  - Starting spells and class-exclusive spells
 *  - Passive abilities that modify gameplay
 *  - A class-specific ultimate ability
 *  - Sap Phase affinity (bonus during a specific phase)
 *
 * Classes:
 *  TEMPORAL_MAGE  — Blue Phase affinity, ranged caster, time manipulation
 *  CRIMSON_BERSERKER — Crimson Phase affinity, melee bruiser, fire & fury
 *  SILVER_WARDEN  — Silver Phase affinity, tank/support, shields & arcane
 *  VERDANT_DRUID  — Balanced affinity, healer/hybrid, nature & life
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
    this.registerAllClasses();
    PlayerClassSystem.instance = this;
  }

  registerAllClasses() {
    // ═══════════════════════════════════════════════════════════════
    // TEMPORAL MAGE — Blue Phase Specialist
    // ═══════════════════════════════════════════════════════════════
    this.classDefinitions.set('temporal_mage', {
      id: 'temporal_mage',
      name: 'Temporal Mage',
      description: 'Masters of time and Blue Sap, Temporal Mages warp reality with devastating ranged spells. Fragile but lethal.',
      phaseAffinity: 'blue',
      sprite: 'class_temporal_mage',
      color: 0x4488ff,

      baseStats: {
        hp: 80, maxHp: 80,
        sap: 150, maxSap: 150,
        atk: 6, def: 3, agi: 7, mag: 15,
        speed: 190,
        critChance: 0.08, critDamage: 0.3,
        dodge: 0.04, block: 0,
        sapRegenRate: 8
      },

      statGrowth: {
        hp: 8, maxHp: 8,
        sap: 12, maxSap: 12,
        atk: 1, def: 1, agi: 1, mag: 3,
        critChance: 0.005, dodge: 0.002
      },

      startingSpells: ['temporal_bolt', 'sap_surge'],
      classSpells: [
        'temporal_bolt', 'chrono_freeze', 'time_rewind',
        'temporal_storm', 'sap_surge', 'blink',
        'arcane_missiles', 'temporal_rift'
      ],
      ultimateSpell: 'temporal_rift',

      passives: [
        {
          id: 'time_dilation',
          name: 'Time Dilation',
          description: 'Spell cooldowns reduced by 15% during Blue Phase.',
          effect: { type: 'cooldown_reduction', value: 0.15, condition: 'blue_phase' }
        },
        {
          id: 'sap_attunement',
          name: 'Sap Attunement',
          description: 'Sap regeneration increased by 25%.',
          effect: { type: 'sap_regen_bonus', value: 0.25 }
        },
        {
          id: 'temporal_echo',
          name: 'Temporal Echo',
          description: 'Offensive spells have a 10% chance to cast twice.',
          effect: { type: 'double_cast_chance', value: 0.10 },
          unlockLevel: 10
        }
      ],

      resistances: { temporal: 0.2, void: -0.1, fire: -0.15 }
    });

    // ═══════════════════════════════════════════════════════════════
    // CRIMSON BERSERKER — Crimson Phase Specialist
    // ═══════════════════════════════════════════════════════════════
    this.classDefinitions.set('crimson_berserker', {
      id: 'crimson_berserker',
      name: 'Crimson Berserker',
      description: 'Fueled by rage and Crimson Sap, Berserkers deal massive melee damage. Their fury grows as their health drops.',
      phaseAffinity: 'crimson',
      sprite: 'class_crimson_berserker',
      color: 0xff4422,

      baseStats: {
        hp: 130, maxHp: 130,
        sap: 80, maxSap: 80,
        atk: 18, def: 6, agi: 10, mag: 4,
        speed: 220,
        critChance: 0.10, critDamage: 0.5,
        dodge: 0.03, block: 0.05,
        sapRegenRate: 4
      },

      statGrowth: {
        hp: 18, maxHp: 18,
        sap: 4, maxSap: 4,
        atk: 3, def: 2, agi: 2, mag: 0.5,
        critChance: 0.008, critDamage: 0.03
      },

      startingSpells: ['crimson_flare', 'flame_dash'],
      classSpells: [
        'crimson_flare', 'flame_dash', 'blazing_strike',
        'inferno_slam', 'blood_rage', 'fire_whirl',
        'magma_eruption', 'crimson_apocalypse'
      ],
      ultimateSpell: 'crimson_apocalypse',

      passives: [
        {
          id: 'berserker_rage',
          name: 'Berserker Rage',
          description: 'Attack damage increases by up to 40% as HP drops below 50%.',
          effect: { type: 'low_hp_damage_bonus', value: 0.40, threshold: 0.5 }
        },
        {
          id: 'crimson_fury',
          name: 'Crimson Fury',
          description: 'Each kill restores 10% max HP and boosts attack speed for 3s.',
          effect: { type: 'on_kill_heal', value: 0.10, duration: 3 }
        },
        {
          id: 'unstoppable',
          name: 'Unstoppable',
          description: 'Cannot be slowed or stunned during Crimson Phase.',
          effect: { type: 'cc_immunity', condition: 'crimson_phase' },
          unlockLevel: 10
        }
      ],

      resistances: { fire: 0.25, nature: -0.1, ice: -0.2 }
    });

    // ═══════════════════════════════════════════════════════════════
    // SILVER WARDEN — Silver Phase Specialist
    // ═══════════════════════════════════════════════════════════════
    this.classDefinitions.set('silver_warden', {
      id: 'silver_warden',
      name: 'Silver Warden',
      description: 'Arcane guardians channeling Silver Sap into impenetrable shields. They protect allies and punish aggressors with reflected damage.',
      phaseAffinity: 'silver',
      sprite: 'class_silver_warden',
      color: 0xccccff,

      baseStats: {
        hp: 120, maxHp: 120,
        sap: 110, maxSap: 110,
        atk: 10, def: 12, agi: 5, mag: 10,
        speed: 170,
        critChance: 0.04, critDamage: 0.2,
        dodge: 0.02, block: 0.15,
        sapRegenRate: 6
      },

      statGrowth: {
        hp: 14, maxHp: 14,
        sap: 8, maxSap: 8,
        atk: 1.5, def: 3, agi: 1, mag: 2,
        block: 0.01, dodge: 0.001
      },

      startingSpells: ['silver_shield', 'arcane_bolt'],
      classSpells: [
        'silver_shield', 'arcane_bolt', 'reflective_ward',
        'holy_smite', 'sanctuary', 'silver_chains',
        'purification', 'silver_nova'
      ],
      ultimateSpell: 'silver_nova',

      passives: [
        {
          id: 'aegis_mastery',
          name: 'Aegis Mastery',
          description: 'Shield effects are 30% stronger and last 2s longer.',
          effect: { type: 'shield_bonus', value: 0.30, durationBonus: 2 }
        },
        {
          id: 'damage_reflection',
          name: 'Damage Reflection',
          description: 'While shielded, reflect 15% of damage back to attackers.',
          effect: { type: 'damage_reflect', value: 0.15 }
        },
        {
          id: 'silver_resonance',
          name: 'Silver Resonance',
          description: 'During Silver Phase, all allies gain 10% damage reduction.',
          effect: { type: 'party_damage_reduction', value: 0.10, condition: 'silver_phase' },
          unlockLevel: 10
        }
      ],

      resistances: { light: 0.2, void: 0.15, shadow: -0.1 }
    });

    // ═══════════════════════════════════════════════════════════════
    // VERDANT DRUID — Balanced / Nature Specialist
    // ═══════════════════════════════════════════════════════════════
    this.classDefinitions.set('verdant_druid', {
      id: 'verdant_druid',
      name: 'Verdant Druid',
      description: 'Caretakers of the Nexus who draw power from all three Sap phases. They heal, summon, and command nature itself.',
      phaseAffinity: null, // balanced — benefits from all phases equally
      sprite: 'class_verdant_druid',
      color: 0x44cc44,

      baseStats: {
        hp: 100, maxHp: 100,
        sap: 120, maxSap: 120,
        atk: 8, def: 7, agi: 7, mag: 12,
        speed: 185,
        critChance: 0.05, critDamage: 0.2,
        dodge: 0.03, block: 0.05,
        sapRegenRate: 7
      },

      statGrowth: {
        hp: 12, maxHp: 12,
        sap: 10, maxSap: 10,
        atk: 1.5, def: 1.5, agi: 1.5, mag: 2.5,
        critChance: 0.004
      },

      startingSpells: ['verdant_heal', 'thorn_whip'],
      classSpells: [
        'verdant_heal', 'thorn_whip', 'natures_grasp',
        'regrowth', 'summon_treant', 'spore_cloud',
        'wild_surge', 'verdant_cataclysm'
      ],
      ultimateSpell: 'verdant_cataclysm',

      passives: [
        {
          id: 'cycle_harmony',
          name: 'Cycle Harmony',
          description: 'Gains a small bonus from every Sap Phase instead of just one.',
          effect: { type: 'all_phase_bonus', value: 0.08 }
        },
        {
          id: 'natural_regeneration',
          name: 'Natural Regeneration',
          description: 'Continuously regenerates 1% max HP per second.',
          effect: { type: 'hp_regen_percent', value: 0.01 }
        },
        {
          id: 'natures_wrath',
          name: "Nature's Wrath",
          description: 'Healing spells also deal 20% of heal amount as nature damage to nearby enemies.',
          effect: { type: 'heal_damage', value: 0.20, radius: 3 },
          unlockLevel: 10
        }
      ],

      resistances: { nature: 0.2, fire: 0.05, ice: 0.05, temporal: 0.05 }
    });
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
   * Apply class stats to a player stats object.
   */
  applyClassStats(playerStats) {
    if (!this.currentClass) return playerStats;

    const base = this.currentClass.baseStats;
    return {
      ...playerStats,
      hp: base.hp,
      maxHp: base.maxHp,
      sap: base.sap,
      maxSap: base.maxSap,
      atk: base.atk,
      def: base.def,
      agi: base.agi,
      mag: base.mag,
      speed: base.speed,
      critChance: base.critChance,
      critDamage: base.critDamage,
      dodge: base.dodge,
      block: base.block,
      resistances: { ...base.resistances || {} }
    };
  }

  /**
   * Apply stat growth for a level-up.
   */
  applyLevelUpGrowth(playerStats, level) {
    if (!this.currentClass) return playerStats;

    const growth = this.currentClass.statGrowth;
    const newStats = { ...playerStats };
    for (const [stat, value] of Object.entries(growth)) {
      if (newStats[stat] !== undefined) {
        newStats[stat] += value;
      }
    }
    // Heal to max on level up
    newStats.hp = newStats.maxHp;
    newStats.sap = newStats.maxSap;
    return newStats;
  }

  /**
   * Get starting spells for the current class.
   */
  getStartingSpells() {
    return this.currentClass?.startingSpells || ['temporal_bolt'];
  }

  /**
   * Get all spells available to the current class up to a given level.
   */
  getAvailableSpells(level) {
    if (!this.currentClass) return [];
    // Class spells unlock roughly every 5 levels
    const count = Math.min(this.currentClass.classSpells.length, Math.ceil(level / 5) + 2);
    return this.currentClass.classSpells.slice(0, count);
  }

  /**
   * Get passives for the current class, filtered by level.
   */
  getActivePassives(level) {
    if (!this.currentClass) return [];
    return this.currentClass.passives.filter(p => (p.unlockLevel || 1) <= level);
  }

  /**
   * Check if current class has phase affinity.
   */
  getPhaseAffinity() {
    return this.currentClass?.phaseAffinity || null;
  }

  /**
   * Serialization for save/load.
   */
  serialize() {
    return {
      currentClassId: this.currentClass?.id || null
    };
  }

  deserialize(data) {
    if (data?.currentClassId) {
      this.selectClass(data.currentClassId);
    }
  }
}

export default PlayerClassSystem;
