import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { AttributeSystem } from './AttributeSystem.js';
import { SkillCheckSystem } from './SkillCheckSystem.js';
import { PlayerClassSystem } from './PlayerClassSystem.js';

/**
 * ProgressionSystem — Verdance-specific XP & leveling (max level 10).
 *
 * Design doc alignment:
 *   - Max level 10 (multiclassing at 5, ultimate at 10)
 *   - XP table: 100, 250, 500, 850, 1300, 1900, 2600, 3500, 5000
 *   - Per level: +1 attribute point, +10 HP, +5 Guard, +1 talent, +1 skill rank
 *   - Stats use Verdance attributes (Might, Agility, Resilience, Insight, Charisma)
 *   - No generic atk/def/agi/mag stats
 */
export class ProgressionSystem {
  static instance = null;

  static getInstance() {
    if (!ProgressionSystem.instance) new ProgressionSystem();
    return ProgressionSystem.instance;
  }

  constructor() {
    if (ProgressionSystem.instance) return ProgressionSystem.instance;

    this.eventBus = EventBus.getInstance();

    // Config from config.json
    const progCfg = dataManager.getConfig('balance.progression') || {};
    this.maxLevel = progCfg.maxLevel || 10;

    // XP thresholds (from config.json)
    const xpThresholds = progCfg.xpThresholds || {};
    this.experiencePerLevel = [
      0,
      xpThresholds['1to2'] || 100,
      xpThresholds['2to3'] || 250,
      xpThresholds['3to4'] || 500,
      xpThresholds['4to5'] || 850,
      xpThresholds['5to6'] || 1300,
      xpThresholds['6to7'] || 1900,
      xpThresholds['7to8'] || 2600,
      xpThresholds['8to9'] || 3500,
      xpThresholds['9to10'] || 5000
    ];

    // Per-level rewards (from config.json)
    const rewards = progCfg.perLevelRewards || {};
    this.attributePointsPerLevel = rewards.attributePoints || 1;
    this.hpBonusPerLevel = rewards.hpBonus || 10;
    this.guardBonusPerLevel = rewards.guardBonus || 5;
    this.talentsPerLevel = rewards.talents || 1;

    // Player progression state
    this.level = 1;
    this.experience = 0;
    this.totalExperience = 0;
    this.talentPoints = 0;
    this.unlockedTalents = new Set();

    // Multiclassing (available at level 5)
    this.secondaryClass = null;
    this.multiclassAvailable = false;

    // Achievements
    this.achievements = new Map();

    // Listen for events
    this.eventBus.on('enemy-defeated', (data) => this.onEnemyDefeated(data));
    this.eventBus.on('combat:ended', (data) => this.onCombatEnded(data));
    this.eventBus.on('tactical:combatEnded', (data) => this.onCombatEnded(data));
    this.eventBus.on('data-reloaded', (data) => {
      if (data?.key === 'config') this.applyConfig(data.data);
    });

    ProgressionSystem.instance = this;
  }

  applyConfig(config) {
    if (!config?.balance?.progression) return;
    const p = config.balance.progression;
    if (p.maxLevel !== undefined) this.maxLevel = p.maxLevel;
    if (p.xpThresholds) {
      this.experiencePerLevel = [
        0,
        p.xpThresholds['1to2'] || 100,
        p.xpThresholds['2to3'] || 250,
        p.xpThresholds['3to4'] || 500,
        p.xpThresholds['4to5'] || 850,
        p.xpThresholds['5to6'] || 1300,
        p.xpThresholds['6to7'] || 1900,
        p.xpThresholds['7to8'] || 2600,
        p.xpThresholds['8to9'] || 3500,
        p.xpThresholds['9to10'] || 5000
      ];
    }
  }

  // ─── XP & Leveling ────────────────────────────────────────────────

  awardExperience(amount) {
    if (this.level >= this.maxLevel) return;

    this.experience += amount;
    this.totalExperience += amount;

    this.eventBus.emit('player-stats-updated', {
      type: 'experience',
      experience: this.experience,
      total: this.totalExperience,
      level: this.level
    });

    while (this.level < this.maxLevel && this.experience >= this.getXPForNextLevel()) {
      this.experience -= this.getXPForNextLevel();
      this.levelUp();
    }
  }

  getXPForNextLevel() {
    if (this.level >= this.maxLevel) return Infinity;
    if (this.level < this.experiencePerLevel.length) {
      return this.experiencePerLevel[this.level];
    }
    return Infinity;
  }

  getXPProgress() {
    const needed = this.getXPForNextLevel();
    if (needed === Infinity) return 1;
    return this.experience / needed;
  }

  levelUp() {
    this.level++;

    // Award attribute point via AttributeSystem
    const attrSystem = AttributeSystem.getInstance();
    attrSystem.addAttributePoints(this.attributePointsPerLevel);

    // Award talent point
    this.talentPoints += this.talentsPerLevel;

    // HP and Guard growth via PlayerClassSystem
    const classSystem = PlayerClassSystem.getInstance();
    const playerStats = classSystem.applyLevelUpGrowth({}, this.level);

    // Check multiclassing availability at level 5
    if (this.level >= 5 && !this.multiclassAvailable) {
      this.multiclassAvailable = true;
      this.eventBus.emit('progression:multiclassAvailable', { level: this.level });
    }

    // Check ultimate ability at level 10
    if (this.level >= 10) {
      const abilities = classSystem.getAbilitiesForLevel(10);
      if (abilities.length > 0) {
        this.eventBus.emit('progression:ultimateUnlocked', {
          level: this.level,
          abilities
        });
      }
    }

    this.eventBus.emit('player-stats-updated', {
      type: 'levelUp',
      level: this.level,
      talentPoints: this.talentPoints,
      hpBonus: this.hpBonusPerLevel,
      guardBonus: this.guardBonusPerLevel,
      attributePoints: this.attributePointsPerLevel
    });

    this.checkAchievements('level', this.level);
  }

  // ─── Talents ───────────────────────────────────────────────────────

  unlockTalent(talentId) {
    if (this.unlockedTalents.has(talentId)) return false;
    if (this.talentPoints <= 0) return false;

    this.talentPoints--;
    this.unlockedTalents.add(talentId);

    this.eventBus.emit('player-stats-updated', {
      type: 'talentUnlocked',
      talentId,
      remainingTalentPoints: this.talentPoints
    });

    return true;
  }

  hasTalent(talentId) {
    return this.unlockedTalents.has(talentId);
  }

  // ─── Multiclassing ────────────────────────────────────────────────

  setSecondaryClass(classId) {
    if (!this.multiclassAvailable || this.level < 5) return false;
    if (this.secondaryClass) return false;

    const classSystem = PlayerClassSystem.getInstance();
    const classDef = classSystem.getClass(classId);
    if (!classDef) return false;
    if (classDef.id === classSystem.getCurrentClass()?.id) return false;

    this.secondaryClass = classId;
    this.eventBus.emit('progression:multiclassed', {
      secondaryClass: classId,
      className: classDef.name
    });

    return true;
  }

  // ─── Effective Stats (Verdance attribute-derived) ──────────────────

  getEffectiveStats() {
    const attrSystem = AttributeSystem.getInstance();
    const classSystem = PlayerClassSystem.getInstance();
    const classDef = classSystem.getCurrentClass();

    // Compute derived stats from attributes + class
    const derived = attrSystem.computeDerivedStats(classDef);

    // Apply per-level HP/Guard growth
    const levelBonusHP = (this.level - 1) * this.hpBonusPerLevel;
    const levelBonusGuard = (this.level - 1) * this.guardBonusPerLevel;

    return {
      ...derived,
      maxHp: derived.maxHp + levelBonusHP,
      hp: derived.hp + levelBonusHP,
      maxGuard: derived.maxGuard + levelBonusGuard,
      guard: derived.guard + levelBonusGuard,
      level: this.level,
      classId: classDef?.id,
      className: classDef?.name,
      secondaryClass: this.secondaryClass
    };
  }

  // ─── Achievements ─────────────────────────────────────────────────

  registerAchievement(id, def) {
    this.achievements.set(id, {
      name: def.name,
      description: def.description || '',
      completed: false,
      progress: 0,
      target: def.target || 1
    });
  }

  checkAchievements(category, value) {
    for (const [id, ach] of this.achievements) {
      if (ach.completed) continue;
      if (id.startsWith(category)) {
        ach.progress = value;
        if (ach.progress >= ach.target) {
          ach.completed = true;
          this.eventBus.emit('achievement:unlocked', { id, ...ach });
        }
      }
    }
  }

  // ─── Event Handlers ───────────────────────────────────────────────

  onEnemyDefeated(data) {
    this.checkAchievements('kills', 1);
  }

  onCombatEnded(data) {
    if (data?.result === 'victory' && data?.rewards) {
      this.awardExperience(data.rewards.experience);
    }
  }

  // ─── Serialization ────────────────────────────────────────────────

  serialize() {
    return {
      level: this.level,
      experience: this.experience,
      totalExperience: this.totalExperience,
      talentPoints: this.talentPoints,
      unlockedTalents: [...this.unlockedTalents],
      secondaryClass: this.secondaryClass,
      multiclassAvailable: this.multiclassAvailable,
      achievements: Object.fromEntries(this.achievements)
    };
  }

  deserialize(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.experience = data.experience || 0;
    this.totalExperience = data.totalExperience || 0;
    this.talentPoints = data.talentPoints || 0;
    if (data.unlockedTalents) this.unlockedTalents = new Set(data.unlockedTalents);
    this.secondaryClass = data.secondaryClass || null;
    this.multiclassAvailable = data.multiclassAvailable || false;
  }
}

export default ProgressionSystem;
