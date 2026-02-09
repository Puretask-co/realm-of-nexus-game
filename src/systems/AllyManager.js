// src/systems/AllyManager.js
// Party management system for allied entities
// Allies are spawned from seeds during the Great Unbinding (Silver phase)

export default class AllyManager {
  constructor(scene) {
    this.scene = scene;

    this.allies = [];
    this.maxAllies = 10; // Max party size

    this.selectedAlly = null;
  }

  addAlly(allyData) {
    if (this.allies.length >= this.maxAllies) {
      console.warn(`Party full! Max ${this.maxAllies} allies.`);
      return false;
    }

    const ally = {
      id: `ally_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sprite: allyData.sprite,
      stats: allyData.stats,
      type: allyData.type,
      name: allyData.name,

      // Combat state
      currentHp: allyData.stats.hp,
      maxHp: allyData.stats.hp,
      statusEffects: [],
      isAlive: true,
    };

    this.allies.push(ally);

    console.log(
      `Ally added: ${ally.name} (${this.allies.length}/${this.maxAllies})`
    );

    return ally;
  }

  removeAlly(allyId) {
    const index = this.allies.findIndex((a) => a.id === allyId);

    if (index === -1) {
      console.warn(`Ally not found: ${allyId}`);
      return false;
    }

    const ally = this.allies[index];

    // Destroy sprite if exists
    if (ally.sprite) {
      ally.sprite.destroy();
    }

    this.allies.splice(index, 1);

    console.log(`Ally removed: ${ally.name}`);

    return true;
  }

  getAlly(allyId) {
    return this.allies.find((a) => a.id === allyId);
  }

  getAllies() {
    return this.allies;
  }

  getAliveAllies() {
    return this.allies.filter((a) => a.isAlive);
  }

  healAlly(allyId, amount) {
    const ally = this.getAlly(allyId);
    if (!ally) return;

    const oldHp = ally.currentHp;
    ally.currentHp = Math.min(ally.currentHp + amount, ally.maxHp);

    const healed = ally.currentHp - oldHp;

    console.log(`${ally.name} healed for ${healed} HP`);

    return healed;
  }

  healAllAllies(percentage = 1.0) {
    this.allies.forEach((ally) => {
      const healAmount = Math.floor(
        (ally.maxHp - ally.currentHp) * percentage
      );
      this.healAlly(ally.id, healAmount);
    });
  }

  damageAlly(allyId, amount) {
    const ally = this.getAlly(allyId);
    if (!ally) return;

    ally.currentHp -= amount;

    if (ally.currentHp <= 0) {
      ally.currentHp = 0;
      ally.isAlive = false;
      console.log(`${ally.name} has fallen!`);
    }
  }

  reviveAlly(allyId) {
    const ally = this.getAlly(allyId);
    if (!ally) return;

    ally.isAlive = true;
    ally.currentHp = Math.floor(ally.maxHp * 0.5); // Revive with 50% HP

    console.log(`${ally.name} revived!`);
  }

  getSaveData() {
    return {
      allies: this.allies.map((ally) => ({
        id: ally.id,
        type: ally.type,
        name: ally.name,
        stats: ally.stats,
        currentHp: ally.currentHp,
        maxHp: ally.maxHp,
        isAlive: ally.isAlive,
      })),
    };
  }

  loadSaveData(data) {
    // Clear existing allies
    this.allies.forEach((ally) => {
      if (ally.sprite) ally.sprite.destroy();
    });
    this.allies = [];

    // Recreate allies from save data
    data.allies.forEach((savedAlly) => {
      this.allies.push({
        id: savedAlly.id,
        sprite: null, // Will be set by scene
        type: savedAlly.type,
        name: savedAlly.name,
        stats: savedAlly.stats,
        currentHp: savedAlly.currentHp,
        maxHp: savedAlly.maxHp,
        statusEffects: [],
        isAlive: savedAlly.isAlive,
      });
    });

    console.log(`Loaded ${this.allies.length} allies`);
  }
}
