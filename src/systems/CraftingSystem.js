import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * CraftingSystem — 3 crafting stations, recipe database, material gathering.
 *
 * Stations:
 *   Bloomguard Forge     - Weapons and armor
 *   Emerald Coven Sanctum - Potions and enchantments
 *   Sapling Workshop      - Tools and consumables
 *
 * Blue Sap phase gives +10% crafting success bonus.
 * Higher Crafting skill rank increases quality.
 */
export class CraftingSystem {
  static instance = null;
  static getInstance() {
    if (!CraftingSystem.instance) new CraftingSystem();
    return CraftingSystem.instance;
  }

  constructor() {
    if (CraftingSystem.instance) return CraftingSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Crafting stations
    this.stations = new Map([
      ['bloomguard_forge', {
        id: 'bloomguard_forge', name: 'Bloomguard Forge',
        description: 'The ancient forge where Bloomguard weapons and armor are shaped from living metal and ironbark.',
        recipeCategories: ['weapon', 'armor', 'shield'],
        location: 'verdant_grove', unlocked: true
      }],
      ['emerald_sanctum', {
        id: 'emerald_sanctum', name: 'Emerald Coven Sanctum',
        description: 'A mystical workshop where potions are brewed and enchantments are woven into equipment.',
        recipeCategories: ['potion', 'enchantment', 'scroll'],
        location: 'canopy_of_life', unlocked: false
      }],
      ['sapling_workshop', {
        id: 'sapling_workshop', name: 'Sapling Workshop',
        description: 'A practical workshop where tools, traps, and consumables are crafted with ingenuity.',
        recipeCategories: ['tool', 'trap', 'consumable', 'ammunition'],
        location: 'verdant_grove', unlocked: true
      }]
    ]);

    // Recipe database
    this.recipes = new Map([
      // Forge recipes
      ['iron_sword', {
        id: 'iron_sword', name: 'Iron Sword', station: 'bloomguard_forge', category: 'weapon',
        materials: [{ itemId: 'iron_ore', quantity: 3 }, { itemId: 'leather_strip', quantity: 1 }],
        result: { itemId: 'iron_sword', quantity: 1 },
        craftingRank: 0, baseDifficulty: 10, craftTime: 5
      }],
      ['ironbark_shield', {
        id: 'ironbark_shield', name: 'Ironbark Shield', station: 'bloomguard_forge', category: 'shield',
        materials: [{ itemId: 'ironbark_wood', quantity: 2 }, { itemId: 'iron_ore', quantity: 1 }],
        result: { itemId: 'ironbark_shield', quantity: 1 },
        craftingRank: 1, baseDifficulty: 12, craftTime: 8
      }],
      ['verdant_mail', {
        id: 'verdant_mail', name: 'Verdant Mail', station: 'bloomguard_forge', category: 'armor',
        materials: [{ itemId: 'iron_ore', quantity: 4 }, { itemId: 'living_vine', quantity: 2 }],
        result: { itemId: 'verdant_mail', quantity: 1 },
        craftingRank: 2, baseDifficulty: 14, craftTime: 12
      }],
      // Sanctum recipes
      ['minor_health_potion', {
        id: 'minor_health_potion', name: 'Minor Health Potion', station: 'emerald_sanctum', category: 'potion',
        materials: [{ itemId: 'healing_herb', quantity: 2 }, { itemId: 'spring_water', quantity: 1 }],
        result: { itemId: 'minor_health_potion', quantity: 2 },
        craftingRank: 0, baseDifficulty: 8, craftTime: 3
      }],
      ['sap_crystal_refined', {
        id: 'sap_crystal_refined', name: 'Refined Sap Crystal', station: 'emerald_sanctum', category: 'enchantment',
        materials: [{ itemId: 'sap_crystal', quantity: 3 }, { itemId: 'moonpetal', quantity: 1 }],
        result: { itemId: 'refined_sap_crystal', quantity: 1 },
        craftingRank: 2, baseDifficulty: 14, craftTime: 10
      }],
      ['purification_potion', {
        id: 'purification_potion', name: 'Purification Potion', station: 'emerald_sanctum', category: 'potion',
        materials: [{ itemId: 'silver_sap_crystal', quantity: 1 }, { itemId: 'healing_herb', quantity: 3 }],
        result: { itemId: 'purification_potion', quantity: 1 },
        craftingRank: 3, baseDifficulty: 16, craftTime: 15
      }],
      // Workshop recipes
      ['thorn_trap', {
        id: 'thorn_trap', name: 'Thorn Trap', station: 'sapling_workshop', category: 'trap',
        materials: [{ itemId: 'thorn_vine', quantity: 2 }, { itemId: 'iron_ore', quantity: 1 }],
        result: { itemId: 'thorn_trap', quantity: 3 },
        craftingRank: 1, baseDifficulty: 10, craftTime: 5
      }],
      ['sap_arrows', {
        id: 'sap_arrows', name: 'Sap-Tipped Arrows', station: 'sapling_workshop', category: 'ammunition',
        materials: [{ itemId: 'wood_shaft', quantity: 5 }, { itemId: 'sap_crystal', quantity: 1 }],
        result: { itemId: 'sap_arrows', quantity: 10 },
        craftingRank: 0, baseDifficulty: 8, craftTime: 3
      }]
    ]);

    // Known recipes
    this.knownRecipes = new Set(['iron_sword', 'minor_health_potion', 'sap_arrows', 'thorn_trap']);

    // Rarity tiers
    this.rarityTiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

    CraftingSystem.instance = this;
  }

  /**
   * Attempt to craft a recipe.
   * @param {string} recipeId
   * @param {object} inventory - { hasItem(id, qty), removeItem(id, qty), addItem(id, qty) }
   * @param {number} craftingRank - Player's Crafting skill rank
   * @param {string} sapPhase - Current sap phase for bonus
   * @returns {{ success: boolean, quality?: string, item?: object }}
   */
  craft(recipeId, inventory, craftingRank = 0, sapPhase = 'blue') {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return { success: false, reason: 'Unknown recipe' };
    if (!this.knownRecipes.has(recipeId)) return { success: false, reason: 'Recipe not learned' };
    if (craftingRank < recipe.craftingRank) return { success: false, reason: 'Insufficient crafting skill' };

    // Check station unlocked
    const station = this.stations.get(recipe.station);
    if (!station?.unlocked) return { success: false, reason: 'Station not unlocked' };

    // Check materials
    for (const mat of recipe.materials) {
      if (!inventory.hasItem(mat.itemId, mat.quantity)) {
        return { success: false, reason: `Missing ${mat.quantity}x ${mat.itemId}` };
      }
    }

    // Consume materials
    for (const mat of recipe.materials) {
      inventory.removeItem(mat.itemId, mat.quantity);
    }

    // Calculate quality
    const blueSapBonus = sapPhase === 'blue' ? 0.10 : 0;
    const skillBonus = craftingRank * 0.05;
    const qualityRoll = Math.random() + blueSapBonus + skillBonus;

    let quality = 'Common';
    if (qualityRoll >= 0.95) quality = 'Legendary';
    else if (qualityRoll >= 0.85) quality = 'Epic';
    else if (qualityRoll >= 0.70) quality = 'Rare';
    else if (qualityRoll >= 0.50) quality = 'Uncommon';

    // Create item
    inventory.addItem(recipe.result.itemId, recipe.result.quantity);

    this.eventBus.emit('crafting:completed', {
      recipeId, recipeName: recipe.name, quality,
      itemId: recipe.result.itemId, quantity: recipe.result.quantity
    });

    return { success: true, quality, item: recipe.result };
  }

  /**
   * Learn a new recipe.
   */
  learnRecipe(recipeId) {
    if (this.recipes.has(recipeId)) {
      this.knownRecipes.add(recipeId);
      this.eventBus.emit('crafting:recipeLearned', { recipeId });
      return true;
    }
    return false;
  }

  /**
   * Unlock a crafting station.
   */
  unlockStation(stationId) {
    const station = this.stations.get(stationId);
    if (station) {
      station.unlocked = true;
      this.eventBus.emit('crafting:stationUnlocked', { stationId, name: station.name });
      return true;
    }
    return false;
  }

  /**
   * Get recipes available at a station.
   */
  getStationRecipes(stationId) {
    const results = [];
    for (const [id, recipe] of this.recipes) {
      if (recipe.station === stationId && this.knownRecipes.has(id)) {
        results.push(recipe);
      }
    }
    return results;
  }

  /**
   * Get all stations with status.
   */
  getAllStations() {
    return [...this.stations.values()];
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return {
      knownRecipes: [...this.knownRecipes],
      unlockedStations: [...this.stations.entries()]
        .filter(([_, s]) => s.unlocked).map(([id]) => id)
    };
  }

  deserialize(data) {
    if (data?.knownRecipes) this.knownRecipes = new Set(data.knownRecipes);
    if (data?.unlockedStations) {
      for (const id of data.unlockedStations) {
        const s = this.stations.get(id);
        if (s) s.unlocked = true;
      }
    }
  }
}

export default CraftingSystem;
