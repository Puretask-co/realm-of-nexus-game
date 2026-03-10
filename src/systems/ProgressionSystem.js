import { EventBus } from '../core/EventBus.js';

/**
 * ProgressionSystem - XP, leveling, stat growth, skill points, and achievements.
 * Driven by config.json progression data (hot-reloadable).
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

    // Config (from config.json)
    this.maxLevel = 50;
    this.experiencePerLevel = [];
    this.skillPointsPerLevel = 2;
    this.statPointsPerLevel = 3;

    // Player progression state
    this.level = 1;
    this.experience = 0;
    this.totalExperience = 0;
    this.skillPoints = 0;
    this.statPoints = 0;

    // Base stats (modifiable via stat points)
    this.baseStats = {
      hp: 100,
      maxHp: 100,
      atk: 10,
      def: 5,
      agi: 8,
      mag: 10,
      critChance: 0,
      critDamage: 0,
      dodge: 0,
      block: 0
    };

    // Stat growth per point invested
    this.statGrowth = {
      hp: 15,
      atk: 2,
      def: 2,
      agi: 1,
      mag: 2
    };

    // Invested stat points tracker
    this.statInvestments = {
      hp: 0,
      atk: 0,
      def: 0,
      agi: 0,
      mag: 0
    };

    // Skills (unlocked abilities/passives)
    this.unlockedSkills = new Set();
    this.skillTree = new Map(); // id → { name, description, cost, requires[], effects[] }

    // Achievements
    this.achievements = new Map(); // id → { name, description, completed, progress, target }

    // Listen for events
    this.eventBus.on('enemy-defeated', (data) => this.onEnemyDefeated(data));
    this.eventBus.on('combat:ended', (data) => this.onCombatEnded(data));
    this.eventBus.on('data-reloaded', (data) => {
      if (data?.key === 'config') this.applyConfig(data.data);
    });

    ProgressionSystem.instance = this;
  }

  applyConfig(config) {
    if (!config?.progression) return;
    const p = config.progression;
    if (p.maxLevel !== undefined) this.maxLevel = p.maxLevel;
    if (p.experiencePerLevel) this.experiencePerLevel = p.experiencePerLevel;
    if (p.skillPointsPerLevel !== undefined) this.skillPointsPerLevel = p.skillPointsPerLevel;
    if (p.statPointsPerLevel !== undefined) this.statPointsPerLevel = p.statPointsPerLevel;
  }

  // ─── XP & Leveling ────────────────────────────────────────────────

  /**
   * Award experience points.
   */
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

    // Check for level ups (can gain multiple levels at once)
    while (this.level < this.maxLevel && this.experience >= this.getXPForNextLevel()) {
      this.experience -= this.getXPForNextLevel();
      this.levelUp();
    }
  }

  /**
   * Get XP required for next level.
   */
  getXPForNextLevel() {
    if (this.level >= this.maxLevel) return Infinity;
    if (this.experiencePerLevel.length > this.level) {
      return this.experiencePerLevel[this.level];
    }
    // Fallback formula if table doesn't go high enough
    return Math.round(100 * Math.pow(1.5, this.level - 1));
  }

  /**
   * Get XP progress toward next level (0-1).
   */
  getXPProgress() {
    const needed = this.getXPForNextLevel();
    if (needed === Infinity) return 1;
    return this.experience / needed;
  }

  /**
   * Level up the player.
   */
  levelUp() {
    this.level++;
    this.skillPoints += this.skillPointsPerLevel;
    this.statPoints += this.statPointsPerLevel;

    // Grow base stats slightly per level
    this.baseStats.maxHp += 10;
    this.baseStats.hp = this.baseStats.maxHp; // Full heal on level up
    this.baseStats.atk += 1;
    this.baseStats.def += 1;
    this.baseStats.mag += 1;

    this.eventBus.emit('player-stats-updated', {
      type: 'levelUp',
      level: this.level,
      skillPoints: this.skillPoints,
      statPoints: this.statPoints,
      stats: this.getEffectiveStats()
    });

    this.checkAchievements('level', this.level);
  }

  // ─── Stat Investment ──────────────────────────────────────────────

  /**
   * Invest a stat point into a specific stat.
   * @param {string} stat - 'hp', 'atk', 'def', 'agi', or 'mag'
   * @returns {boolean} success
   */
  investStatPoint(stat) {
    if (this.statPoints <= 0) return false;
    if (!this.statGrowth[stat]) return false;

    this.statPoints--;
    this.statInvestments[stat]++;
    this.baseStats[stat] += this.statGrowth[stat];

    if (stat === 'hp') {
      this.baseStats.maxHp += this.statGrowth.hp;
    }

    this.eventBus.emit('player-stats-updated', {
      type: 'statInvested',
      stat,
      value: this.baseStats[stat],
      remainingPoints: this.statPoints,
      stats: this.getEffectiveStats()
    });

    return true;
  }

  /**
   * Get effective stats (base + investments + equipment + buffs).
   */
  getEffectiveStats() {
    // For now, just return base stats. Equipment/buff modifiers
    // would be layered on top by other systems.
    return { ...this.baseStats };
  }

  // ─── Skills ───────────────────────────────────────────────────────

  /**
   * Register a skill in the skill tree.
   */
  registerSkill(id, skillDef) {
    this.skillTree.set(id, {
      name: skillDef.name,
      description: skillDef.description || '',
      cost: skillDef.cost || 1,
      requires: skillDef.requires || [],
      effects: skillDef.effects || [],
      unlockLevel: skillDef.unlockLevel || 1
    });
  }

  /**
   * Unlock a skill by spending skill points.
   */
  unlockSkill(id) {
    if (this.unlockedSkills.has(id)) return false;

    const skill = this.skillTree.get(id);
    if (!skill) return false;

    // Check level requirement
    if (this.level < skill.unlockLevel) return false;

    // Check prerequisites
    for (const reqId of skill.requires) {
      if (!this.unlockedSkills.has(reqId)) return false;
    }

    // Check cost
    if (this.skillPoints < skill.cost) return false;

    this.skillPoints -= skill.cost;
    this.unlockedSkills.add(id);

    this.eventBus.emit('player-stats-updated', {
      type: 'skillUnlocked',
      skillId: id,
      skill,
      remainingSkillPoints: this.skillPoints
    });

    return true;
  }

  /**
   * Check if a skill is unlocked.
   */
  hasSkill(id) {
    return this.unlockedSkills.has(id);
  }

  // ─── Achievements ─────────────────────────────────────────────────

  /**
   * Register an achievement.
   */
  registerAchievement(id, def) {
    this.achievements.set(id, {
      name: def.name,
      description: def.description || '',
      completed: false,
      progress: 0,
      target: def.target || 1
    });
  }

  /**
   * Check and update achievements by category.
   */
  checkAchievements(category, value) {
    for (const [id, ach] of this.achievements) {
      if (ach.completed) continue;

      // Match by naming convention: category_* achievements
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
    this.checkAchievements('kills', 1); // Increment kill counter
  }

  onCombatEnded(data) {
    if (data?.result === 'victory' && data?.rewards) {
      this.awardExperience(data.rewards.experience);
    }
  }

  // ─── Serialization ────────────────────────────────────────────────

  /**
   * Serialize progression state for saving.
   */
  serialize() {
    return {
      level: this.level,
      experience: this.experience,
      totalExperience: this.totalExperience,
      skillPoints: this.skillPoints,
      statPoints: this.statPoints,
      baseStats: { ...this.baseStats },
      statInvestments: { ...this.statInvestments },
      unlockedSkills: [...this.unlockedSkills],
      achievements: Object.fromEntries(this.achievements)
    };
  }

  /**
   * Restore progression state from save data.
   */
  deserialize(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.experience = data.experience || 0;
    this.totalExperience = data.totalExperience || 0;
    this.skillPoints = data.skillPoints || 0;
    this.statPoints = data.statPoints || 0;
    if (data.baseStats) this.baseStats = { ...data.baseStats };
    if (data.statInvestments) this.statInvestments = { ...data.statInvestments };
    if (data.unlockedSkills) this.unlockedSkills = new Set(data.unlockedSkills);
  }
}

export default ProgressionSystem;
