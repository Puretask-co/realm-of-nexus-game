// src/systems/DifficultyManager.js
// Scales combat stats based on difficulty setting

export default class DifficultyManager {
  constructor() {
    this.difficulty = 'normal'; // 'easy', 'normal', 'hard'

    this.difficultyModifiers = {
      easy: {
        playerHP: 1.3,
        playerDamage: 1.2,
        enemyHP: 0.8,
        enemyDamage: 0.7,
      },
      normal: {
        playerHP: 1.0,
        playerDamage: 1.0,
        enemyHP: 1.0,
        enemyDamage: 1.0,
      },
      hard: {
        playerHP: 0.8,
        playerDamage: 0.9,
        enemyHP: 1.3,
        enemyDamage: 1.2,
      },
    };
  }

  applyToPlayer(stats) {
    const mods = this.difficultyModifiers[this.difficulty];
    return {
      ...stats,
      hp: Math.floor(stats.hp * mods.playerHP),
      maxHp: Math.floor(stats.maxHp * mods.playerHP),
      attack: Math.floor(stats.attack * mods.playerDamage),
    };
  }

  applyToEnemy(stats) {
    const mods = this.difficultyModifiers[this.difficulty];
    return {
      ...stats,
      hp: Math.floor(stats.hp * mods.enemyHP),
      maxHp: Math.floor(stats.hp * mods.enemyHP),
      attack: Math.floor(stats.attack * mods.enemyDamage),
    };
  }

  setDifficulty(level) {
    if (this.difficultyModifiers[level]) {
      this.difficulty = level;
      console.log(`Difficulty set to: ${level}`);
    }
  }
}
