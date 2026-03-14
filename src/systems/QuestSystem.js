import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import DataManager from './DataManager.js';

/**
 * QuestSystem - Quest and progression tracking for Verdance.
 * Handles quests with multiple objectives, achievement tracking,
 * reputation systems, unlock progression, and Sap Cycle quest modifiers.
 */
export class QuestSystem {
  static instance = null;

  constructor() {
    if (QuestSystem.instance) return QuestSystem.instance;

    this.eventBus = EventBus.getInstance();

    // Quest storage
    this.questDefinitions = new Map();
    this.activeQuests = new Map();
    this.completedQuests = new Set();
    this.failedQuests = new Set();

    // Achievement system
    this.achievements = new Map();
    this.unlockedAchievements = new Set();
    this.achievementProgress = new Map();

    // Reputation system
    this.factions = new Map();
    this.reputationLevels = [
      { name: 'Hostile', threshold: -1000 },
      { name: 'Unfriendly', threshold: -500 },
      { name: 'Neutral', threshold: 0 },
      { name: 'Friendly', threshold: 500 },
      { name: 'Honored', threshold: 1000 },
      { name: 'Revered', threshold: 2000 },
      { name: 'Exalted', threshold: 5000 }
    ];

    // Unlock system
    this.unlocks = new Map();
    this.unlockedItems = new Set();

    // Player progression
    this.playerStats = {
      level: 1,
      experience: 0,
      totalExperience: 0,
      skillPoints: 0,
      statPoints: 0,
      playtime: 0,
      enemiesDefeated: 0,
      questsCompleted: 0,
      deathCount: 0,
      sapCyclesWitnessed: 0,
      secretsFound: 0,
      locationsDiscovered: new Set(),
      spellsLearned: new Set(),
      bestiary: new Set()
    };

    // Event listeners
    this.setupEventListeners();

    QuestSystem.instance = this;
  }

  static getInstance() {
    if (!QuestSystem.instance) new QuestSystem();
    return QuestSystem.instance;
  }

  setupEventListeners() {
    this.eventBus.on('enemy:defeated', (data) => this.onEnemyDefeated(data));
    this.eventBus.on('item:collected', (data) => this.onItemCollected(data));
    this.eventBus.on('location:discovered', (data) => this.onLocationDiscovered(data));
    this.eventBus.on('dialogue:choiceMade', (data) => this.onDialogueChoice(data));
    this.eventBus.on('spell:learned', (data) => this.onSpellLearned(data));
    this.eventBus.on('player:levelUp', (data) => this.onLevelUp(data));
    this.eventBus.on('sapCycle:phaseChanged', (data) => this.onSapPhaseChanged(data));
  }

  // ─── Quest Definitions ───────────────────────────────────────────

  registerQuest(questData) {
    const quest = {
      id: questData.id,
      name: questData.name,
      description: questData.description || '',
      type: questData.type || 'main', // main, side, daily, event, hidden
      category: questData.category || 'general',
      level: questData.level || 1,
      prerequisites: questData.prerequisites || [],
      objectives: (questData.objectives || []).map(obj => ({
        id: obj.id,
        type: obj.type, // kill, collect, visit, talk, interact, escort, survive, custom
        description: obj.description || '',
        target: obj.target || null,
        required: obj.required || 1,
        optional: obj.optional || false,
        hidden: obj.hidden || false,
        order: obj.order || 0,
        sapPhaseRequired: obj.sapPhaseRequired || null
      })),
      rewards: questData.rewards || {},
      timeLimit: questData.timeLimit || null,
      repeatable: questData.repeatable || false,
      chainQuest: questData.chainQuest || null,
      failConditions: questData.failConditions || [],
      dialogueOnAccept: questData.dialogueOnAccept || null,
      dialogueOnComplete: questData.dialogueOnComplete || null,
      tags: questData.tags || []
    };

    this.questDefinitions.set(quest.id, quest);
    return quest;
  }

  // ─── Quest Control ────────────────────────────────────────────────

  startQuest(questId) {
    const definition = this.questDefinitions.get(questId);
    if (!definition) {
      console.warn(`QuestSystem: Unknown quest '${questId}'`);
      return false;
    }

    if (this.activeQuests.has(questId)) {
      console.warn(`QuestSystem: Quest '${questId}' is already active`);
      return false;
    }

    if (this.completedQuests.has(questId) && !definition.repeatable) {
      return false;
    }

    // Check prerequisites
    if (!this.checkPrerequisites(definition.prerequisites)) {
      this.eventBus.emit('quest:prerequisitesNotMet', { questId, prerequisites: definition.prerequisites });
      return false;
    }

    // Create active quest instance
    const questInstance = {
      id: questId,
      definition,
      startTime: Date.now(),
      objectiveProgress: new Map(),
      status: 'active' // active, completed, failed
    };

    // Initialize objective progress
    for (const objective of definition.objectives) {
      questInstance.objectiveProgress.set(objective.id, {
        current: 0,
        required: objective.required,
        completed: false
      });
    }

    this.activeQuests.set(questId, questInstance);

    this.eventBus.emit('quest:started', {
      questId,
      name: definition.name,
      objectives: definition.objectives
    });

    // Play accept dialogue
    if (definition.dialogueOnAccept) {
      this.eventBus.emit('dialogue:start', { dialogueId: definition.dialogueOnAccept });
    }

    return true;
  }

  updateObjective(questId, objectiveId, amount = 1) {
    const quest = this.activeQuests.get(questId);
    if (!quest || quest.status !== 'active') return false;

    const progress = quest.objectiveProgress.get(objectiveId);
    if (!progress || progress.completed) return false;

    progress.current = Math.min(progress.current + amount, progress.required);

    this.eventBus.emit('quest:objectiveUpdated', {
      questId,
      objectiveId,
      current: progress.current,
      required: progress.required
    });

    // Check if objective is complete
    if (progress.current >= progress.required) {
      progress.completed = true;
      this.eventBus.emit('quest:objectiveCompleted', { questId, objectiveId });

      // Check if all required objectives are complete
      this.checkQuestCompletion(questId);
    }

    return true;
  }

  completeObjective(questId, objectiveId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return false;

    const progress = quest.objectiveProgress.get(objectiveId);
    if (progress) {
      progress.current = progress.required;
      progress.completed = true;
      this.eventBus.emit('quest:objectiveCompleted', { questId, objectiveId });
      this.checkQuestCompletion(questId);
    }
    return true;
  }

  checkQuestCompletion(questId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return;

    const allRequired = quest.definition.objectives
      .filter(o => !o.optional)
      .every(o => quest.objectiveProgress.get(o.id)?.completed);

    if (allRequired) {
      this.completeQuest(questId);
    }
  }

  completeQuest(questId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return;

    quest.status = 'completed';
    this.completedQuests.add(questId);
    this.activeQuests.delete(questId);
    this.playerStats.questsCompleted++;

    // Grant rewards
    const rewards = quest.definition.rewards;
    if (rewards) {
      if (rewards.experience) {
        this.addExperience(rewards.experience);
      }
      if (rewards.items) {
        for (const item of rewards.items) {
          this.eventBus.emit('inventory:addItem', { itemId: item.id, quantity: item.quantity || 1 });
        }
      }
      if (rewards.reputation) {
        for (const [faction, amount] of Object.entries(rewards.reputation)) {
          this.changeReputation(faction, amount);
        }
      }
      if (rewards.unlocks) {
        for (const unlock of rewards.unlocks) {
          this.unlock(unlock);
        }
      }
      if (rewards.spells) {
        for (const spellId of rewards.spells) {
          this.eventBus.emit('spell:unlock', { spellId });
        }
      }
    }

    this.eventBus.emit('quest:completed', {
      questId,
      name: quest.definition.name,
      rewards
    });

    // Start chain quest if exists
    if (quest.definition.chainQuest) {
      this.scene?.time?.delayedCall(1000, () => {
        this.startQuest(quest.definition.chainQuest);
      });
    }

    // Check achievements
    this.checkAchievements();
  }

  failQuest(questId, reason = '') {
    const quest = this.activeQuests.get(questId);
    if (!quest) return;

    quest.status = 'failed';
    this.failedQuests.add(questId);
    this.activeQuests.delete(questId);

    this.eventBus.emit('quest:failed', { questId, name: quest.definition.name, reason });
  }

  abandonQuest(questId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return;

    this.activeQuests.delete(questId);
    this.eventBus.emit('quest:abandoned', { questId, name: quest.definition.name });
  }

  checkPrerequisites(prerequisites) {
    for (const prereq of prerequisites) {
      switch (prereq.type) {
        case 'quest':
          if (!this.completedQuests.has(prereq.questId)) return false;
          break;
        case 'level':
          if (this.playerStats.level < prereq.level) return false;
          break;
        case 'reputation':
          if (this.getReputation(prereq.faction) < prereq.amount) return false;
          break;
        case 'item':
          // Would check inventory - emitting event to check
          break;
        case 'achievement':
          if (!this.unlockedAchievements.has(prereq.achievementId)) return false;
          break;
      }
    }
    return true;
  }

  // ─── Experience & Leveling ────────────────────────────────────────

  addExperience(amount) {
    this.playerStats.experience += amount;
    this.playerStats.totalExperience += amount;

    this.eventBus.emit('player:experienceGained', { amount, total: this.playerStats.experience });

    // Check for level up
    this.checkLevelUp();
  }

  checkLevelUp() {
    const config = this.getProgressionConfig();
    if (!config) return;

    while (this.playerStats.level < config.maxLevel) {
      const requiredXP = config.experiencePerLevel[this.playerStats.level] || Infinity;
      if (this.playerStats.experience >= requiredXP) {
        this.playerStats.experience -= requiredXP;
        this.playerStats.level++;
        this.playerStats.skillPoints += config.skillPointsPerLevel;
        this.playerStats.statPoints += config.statPointsPerLevel;

        this.eventBus.emit('player:levelUp', {
          level: this.playerStats.level,
          skillPoints: this.playerStats.skillPoints,
          statPoints: this.playerStats.statPoints
        });
      } else {
        break;
      }
    }
  }

  getProgressionConfig() {
    try {
      const dm = DataManager.getInstance();
      const config = dm.data?.config;
      return config?.progression || {
        maxLevel: 50,
        experiencePerLevel: new Array(50).fill(100).map((v, i) => v * (i + 1) * (i + 1)),
        skillPointsPerLevel: 2,
        statPointsPerLevel: 3
      };
    } catch {
      return {
        maxLevel: 50,
        experiencePerLevel: new Array(50).fill(100).map((v, i) => v * (i + 1) * (i + 1)),
        skillPointsPerLevel: 2,
        statPointsPerLevel: 3
      };
    }
  }

  getExperienceToNextLevel() {
    const config = this.getProgressionConfig();
    if (!config) return Infinity;
    return (config.experiencePerLevel[this.playerStats.level] || Infinity) - this.playerStats.experience;
  }

  getExperienceProgress() {
    const config = this.getProgressionConfig();
    if (!config) return 0;
    const required = config.experiencePerLevel[this.playerStats.level] || 1;
    return this.playerStats.experience / required;
  }

  // ─── Achievements ─────────────────────────────────────────────────

  registerAchievement(achievementData) {
    this.achievements.set(achievementData.id, {
      id: achievementData.id,
      name: achievementData.name,
      description: achievementData.description || '',
      icon: achievementData.icon || null,
      hidden: achievementData.hidden || false,
      category: achievementData.category || 'general',
      conditions: achievementData.conditions || [],
      rewards: achievementData.rewards || {},
      points: achievementData.points || 10,
      rarity: achievementData.rarity || 'common'
    });
  }

  checkAchievements() {
    for (const [id, achievement] of this.achievements) {
      if (this.unlockedAchievements.has(id)) continue;

      let unlocked = true;
      for (const condition of achievement.conditions) {
        switch (condition.type) {
          case 'questsCompleted':
            if (this.playerStats.questsCompleted < condition.count) unlocked = false;
            break;
          case 'level':
            if (this.playerStats.level < condition.level) unlocked = false;
            break;
          case 'enemiesDefeated':
            if (this.playerStats.enemiesDefeated < condition.count) unlocked = false;
            break;
          case 'locationsDiscovered':
            if (this.playerStats.locationsDiscovered.size < condition.count) unlocked = false;
            break;
          case 'spellsLearned':
            if (this.playerStats.spellsLearned.size < condition.count) unlocked = false;
            break;
          case 'specificQuest':
            if (!this.completedQuests.has(condition.questId)) unlocked = false;
            break;
          case 'specificEnemy':
            if (!this.playerStats.bestiary.has(condition.enemyId)) unlocked = false;
            break;
          case 'secretsFound':
            if (this.playerStats.secretsFound < condition.count) unlocked = false;
            break;
          case 'deathless':
            if (this.playerStats.deathCount > 0) unlocked = false;
            break;
          case 'custom':
            if (condition.check && !condition.check(this.playerStats)) unlocked = false;
            break;
        }
      }

      if (unlocked) {
        this.unlockAchievement(id);
      }
    }
  }

  unlockAchievement(achievementId) {
    if (this.unlockedAchievements.has(achievementId)) return;

    const achievement = this.achievements.get(achievementId);
    if (!achievement) return;

    this.unlockedAchievements.add(achievementId);

    // Grant rewards
    if (achievement.rewards) {
      if (achievement.rewards.experience) this.addExperience(achievement.rewards.experience);
      if (achievement.rewards.items) {
        for (const item of achievement.rewards.items) {
          this.eventBus.emit('inventory:addItem', { itemId: item.id, quantity: item.quantity || 1 });
        }
      }
    }

    this.eventBus.emit('achievement:unlocked', {
      id: achievementId,
      name: achievement.name,
      description: achievement.description,
      points: achievement.points
    });
  }

  // ─── Reputation ───────────────────────────────────────────────────

  registerFaction(id, config) {
    this.factions.set(id, {
      id,
      name: config.name || id,
      description: config.description || '',
      reputation: config.startReputation || 0,
      icon: config.icon || null,
      rewards: config.rewards || {}
    });
  }

  changeReputation(factionId, amount) {
    const faction = this.factions.get(factionId);
    if (!faction) return;

    const oldRep = faction.reputation;
    faction.reputation += amount;

    const oldLevel = this.getReputationLevel(oldRep);
    const newLevel = this.getReputationLevel(faction.reputation);

    this.eventBus.emit('reputation:changed', {
      factionId,
      amount,
      newTotal: faction.reputation,
      oldLevel: oldLevel.name,
      newLevel: newLevel.name
    });

    if (oldLevel.name !== newLevel.name) {
      this.eventBus.emit('reputation:levelChanged', {
        factionId,
        oldLevel: oldLevel.name,
        newLevel: newLevel.name
      });
    }
  }

  getReputation(factionId) {
    return this.factions.get(factionId)?.reputation || 0;
  }

  getReputationLevel(reputation) {
    let result = this.reputationLevels[0];
    for (const level of this.reputationLevels) {
      if (reputation >= level.threshold) result = level;
    }
    return result;
  }

  // ─── Unlock System ────────────────────────────────────────────────

  registerUnlock(id, config) {
    this.unlocks.set(id, {
      id,
      name: config.name || id,
      type: config.type || 'feature', // feature, spell, area, cosmetic, item
      description: config.description || '',
      unlockCondition: config.unlockCondition || null
    });
  }

  unlock(unlockId) {
    if (this.unlockedItems.has(unlockId)) return;
    this.unlockedItems.add(unlockId);

    const unlock = this.unlocks.get(unlockId);
    this.eventBus.emit('unlock:unlocked', {
      id: unlockId,
      name: unlock?.name || unlockId,
      type: unlock?.type || 'feature'
    });
  }

  isUnlocked(unlockId) {
    return this.unlockedItems.has(unlockId);
  }

  // ─── Event Handlers ───────────────────────────────────────────────

  onEnemyDefeated(data) {
    this.playerStats.enemiesDefeated++;
    if (data.enemyId) this.playerStats.bestiary.add(data.enemyId);

    // Update kill objectives
    for (const [questId, quest] of this.activeQuests) {
      for (const objective of quest.definition.objectives) {
        if (objective.type === 'kill' && objective.target === data.enemyId) {
          this.updateObjective(questId, objective.id);
        }
      }
    }

    this.checkAchievements();
  }

  onItemCollected(data) {
    for (const [questId, quest] of this.activeQuests) {
      for (const objective of quest.definition.objectives) {
        if (objective.type === 'collect' && objective.target === data.itemId) {
          this.updateObjective(questId, objective.id, data.quantity || 1);
        }
      }
    }
  }

  onLocationDiscovered(data) {
    this.playerStats.locationsDiscovered.add(data.locationId);

    for (const [questId, quest] of this.activeQuests) {
      for (const objective of quest.definition.objectives) {
        if (objective.type === 'visit' && objective.target === data.locationId) {
          this.completeObjective(questId, objective.id);
        }
      }
    }

    this.checkAchievements();
  }

  onDialogueChoice(data) {
    for (const [questId, quest] of this.activeQuests) {
      for (const objective of quest.definition.objectives) {
        if (objective.type === 'talk' && objective.target === data.dialogueId) {
          this.completeObjective(questId, objective.id);
        }
      }
    }
  }

  onSpellLearned(data) {
    this.playerStats.spellsLearned.add(data.spellId);
    this.checkAchievements();
  }

  onLevelUp(data) {
    this.checkAchievements();
  }

  onSapPhaseChanged(data) {
    this.playerStats.sapCyclesWitnessed++;

    // Check sap-phase-specific objectives
    for (const [questId, quest] of this.activeQuests) {
      for (const objective of quest.definition.objectives) {
        if (objective.sapPhaseRequired && objective.sapPhaseRequired === data.phase) {
          // The objective can only be progressed during this sap phase
        }
      }
    }
  }

  // ─── Query Methods ────────────────────────────────────────────────

  getActiveQuests() {
    return Array.from(this.activeQuests.values());
  }

  getActiveQuestsByType(type) {
    return this.getActiveQuests().filter(q => q.definition.type === type);
  }

  getCompletedQuests() {
    return Array.from(this.completedQuests);
  }

  getQuestProgress(questId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return null;

    const objectives = [];
    for (const obj of quest.definition.objectives) {
      const progress = quest.objectiveProgress.get(obj.id);
      objectives.push({
        ...obj,
        current: progress?.current || 0,
        required: progress?.required || obj.required,
        completed: progress?.completed || false
      });
    }

    const completedCount = objectives.filter(o => o.completed && !o.optional).length;
    const requiredCount = objectives.filter(o => !o.optional).length;

    return {
      questId,
      name: quest.definition.name,
      objectives,
      progress: requiredCount > 0 ? completedCount / requiredCount : 0,
      status: quest.status
    };
  }

  getAvailableQuests() {
    const available = [];
    for (const [id, definition] of this.questDefinitions) {
      if (this.activeQuests.has(id)) continue;
      if (this.completedQuests.has(id) && !definition.repeatable) continue;
      if (this.checkPrerequisites(definition.prerequisites)) {
        available.push(definition);
      }
    }
    return available;
  }

  // ─── Save/Load ────────────────────────────────────────────────────

  saveState() {
    return {
      activeQuests: Array.from(this.activeQuests.entries()).map(([id, quest]) => ({
        id,
        progress: Object.fromEntries(quest.objectiveProgress),
        startTime: quest.startTime,
        status: quest.status
      })),
      completedQuests: Array.from(this.completedQuests),
      failedQuests: Array.from(this.failedQuests),
      unlockedAchievements: Array.from(this.unlockedAchievements),
      factions: Array.from(this.factions.entries()).map(([id, f]) => ({ id, reputation: f.reputation })),
      unlockedItems: Array.from(this.unlockedItems),
      playerStats: {
        ...this.playerStats,
        locationsDiscovered: Array.from(this.playerStats.locationsDiscovered),
        spellsLearned: Array.from(this.playerStats.spellsLearned),
        bestiary: Array.from(this.playerStats.bestiary)
      }
    };
  }

  loadState(state) {
    if (state.completedQuests) this.completedQuests = new Set(state.completedQuests);
    if (state.failedQuests) this.failedQuests = new Set(state.failedQuests);
    if (state.unlockedAchievements) this.unlockedAchievements = new Set(state.unlockedAchievements);
    if (state.unlockedItems) this.unlockedItems = new Set(state.unlockedItems);

    if (state.factions) {
      for (const { id, reputation } of state.factions) {
        const faction = this.factions.get(id);
        if (faction) faction.reputation = reputation;
      }
    }

    if (state.playerStats) {
      Object.assign(this.playerStats, state.playerStats);
      this.playerStats.locationsDiscovered = new Set(state.playerStats.locationsDiscovered || []);
      this.playerStats.spellsLearned = new Set(state.playerStats.spellsLearned || []);
      this.playerStats.bestiary = new Set(state.playerStats.bestiary || []);
    }

    if (state.activeQuests) {
      for (const questState of state.activeQuests) {
        if (this.questDefinitions.has(questState.id)) {
          this.startQuest(questState.id);
          const quest = this.activeQuests.get(questState.id);
          if (quest && questState.progress) {
            for (const [objId, progress] of Object.entries(questState.progress)) {
              quest.objectiveProgress.set(objId, progress);
            }
          }
        }
      }
    }
  }

  // ─── Statistics ───────────────────────────────────────────────────

  getStatistics() {
    return {
      activeQuests: this.activeQuests.size,
      completedQuests: this.completedQuests.size,
      failedQuests: this.failedQuests.size,
      totalQuests: this.questDefinitions.size,
      achievements: `${this.unlockedAchievements.size}/${this.achievements.size}`,
      unlocks: this.unlockedItems.size,
      playerLevel: this.playerStats.level,
      totalExperience: this.playerStats.totalExperience,
      enemiesDefeated: this.playerStats.enemiesDefeated
    };
  }

  destroy() {
    this.activeQuests.clear();
    this.completedQuests.clear();
    this.questDefinitions.clear();
    this.achievements.clear();
    this.factions.clear();
    this.unlocks.clear();
    QuestSystem.instance = null;
  }
}

export default QuestSystem;
