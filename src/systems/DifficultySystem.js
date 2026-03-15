import { EventBus } from '../core/EventBus.js';

/**
 * DifficultySystem — Easy/Normal/Hard with damage, HP, and XP multipliers.
 */
export class DifficultySystem {
  static instance = null;
  static getInstance() {
    if (!DifficultySystem.instance) new DifficultySystem();
    return DifficultySystem.instance;
  }

  constructor() {
    if (DifficultySystem.instance) return DifficultySystem.instance;
    this.eventBus = EventBus.getInstance();

    this.difficulties = {
      easy: {
        name: 'Easy',
        description: 'Reduced enemy damage and increased XP. For story enjoyment.',
        enemyDamageMultiplier: 0.7,
        enemyHealthMultiplier: 0.8,
        playerDamageMultiplier: 1.2,
        experienceMultiplier: 1.3,
        dropRateMultiplier: 1.2,
        dspDrainMultiplier: 0.7,
        healingMultiplier: 1.3
      },
      normal: {
        name: 'Normal',
        description: 'The intended Verdance experience. Balanced challenge.',
        enemyDamageMultiplier: 1.0,
        enemyHealthMultiplier: 1.0,
        playerDamageMultiplier: 1.0,
        experienceMultiplier: 1.0,
        dropRateMultiplier: 1.0,
        dspDrainMultiplier: 1.0,
        healingMultiplier: 1.0
      },
      hard: {
        name: 'Hard',
        description: 'For veteran tacticians. Enemies hit harder and have more HP.',
        enemyDamageMultiplier: 1.4,
        enemyHealthMultiplier: 1.5,
        playerDamageMultiplier: 0.9,
        experienceMultiplier: 0.8,
        dropRateMultiplier: 0.8,
        dspDrainMultiplier: 1.3,
        healingMultiplier: 0.8
      }
    };

    this.currentDifficulty = 'normal';
    DifficultySystem.instance = this;
  }

  setDifficulty(level) {
    if (!this.difficulties[level]) return false;
    this.currentDifficulty = level;
    this.eventBus.emit('difficulty:changed', {
      difficulty: level,
      ...this.difficulties[level]
    });
    return true;
  }

  getModifiers() {
    return { ...this.difficulties[this.currentDifficulty] };
  }

  getModifier(key) {
    return this.difficulties[this.currentDifficulty]?.[key] || 1.0;
  }

  getCurrentDifficulty() {
    return this.currentDifficulty;
  }

  getAllDifficulties() {
    return Object.entries(this.difficulties).map(([id, def]) => ({
      id, ...def, selected: id === this.currentDifficulty
    }));
  }

  serialize() { return { difficulty: this.currentDifficulty }; }
  deserialize(data) { if (data?.difficulty) this.currentDifficulty = data.difficulty; }
}

export default DifficultySystem;
