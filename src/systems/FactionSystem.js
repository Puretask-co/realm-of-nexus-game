import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * FactionSystem — 6 faction reputation tracking.
 *
 * Factions:
 *   Bloomguard     - Military protectors
 *   Thornbinders   - Rogues and spies
 *   Emerald Coven  - Mages and scholars
 *   Wildkin Pact   - Rangers and nature spirits
 *   Sporecallers   - Decay magic users
 *   Sapling Consortium - Crafters and merchants
 *
 * Reputation range: -50 to +50 per faction.
 * Reputation affects:
 *   - Shop prices and inventory
 *   - Available quests and dialogue options
 *   - NPC reactions and help
 *   - Ending availability
 *   - Companion recruitment
 */
export class FactionSystem {
  static instance = null;
  static getInstance() {
    if (!FactionSystem.instance) new FactionSystem();
    return FactionSystem.instance;
  }

  constructor() {
    if (FactionSystem.instance) return FactionSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Config
    const factionCfg = dataManager.getConfig('balance.factionReputation') || {};
    this.minRep = factionCfg.min || -50;
    this.maxRep = factionCfg.max || 50;

    // Faction definitions
    this.factions = new Map([
      ['bloomguard', {
        id: 'bloomguard',
        name: 'Bloomguard',
        description: 'Military protectors of the Verdance. They value strength, duty, and decisive action.',
        color: 0x44aa44,
        reputation: 0
      }],
      ['thornbinders', {
        id: 'thornbinders',
        name: 'Thornbinders',
        description: 'Rogues and spies who operate in shadows. They value cunning, freedom, and pragmatism.',
        color: 0x886644,
        reputation: 0
      }],
      ['emerald_coven', {
        id: 'emerald_coven',
        name: 'Emerald Coven',
        description: 'Mages and scholars who study the Sap. They value knowledge, restraint, and magical mastery.',
        color: 0x22cc88,
        reputation: 0
      }],
      ['wildkin_pact', {
        id: 'wildkin_pact',
        name: 'Wildkin Pact',
        description: 'Rangers and nature spirits. They value harmony, respect for nature, and wilderness survival.',
        color: 0x66aa33,
        reputation: 0
      }],
      ['sporecallers', {
        id: 'sporecallers',
        name: 'Sporecallers',
        description: 'Users of decay magic. They value understanding corruption, sacrifice, and unconventional solutions.',
        color: 0x996688,
        reputation: 0
      }],
      ['sapling_consortium', {
        id: 'sapling_consortium',
        name: 'Sapling Consortium',
        description: 'Crafters and merchants. They value trade, innovation, and practical solutions.',
        color: 0xcc9944,
        reputation: 0
      }]
    ]);

    // Reputation tier names
    this.reputationTiers = [
      { min: -50, max: -30, name: 'Hostile', color: '#ff2222' },
      { min: -29, max: -10, name: 'Unfriendly', color: '#ff6644' },
      { min: -9, max: 9, name: 'Neutral', color: '#888888' },
      { min: 10, max: 29, name: 'Friendly', color: '#44aa44' },
      { min: 30, max: 50, name: 'Allied', color: '#44ff88' }
    ];

    // Listen for events
    this.eventBus.on('faction:reputationChange', (data) => {
      this.changeReputation(data.faction, data.change, data.source);
    });

    FactionSystem.instance = this;
  }

  /**
   * Change reputation with a faction.
   */
  changeReputation(factionId, amount, source = 'unknown') {
    const faction = this.factions.get(factionId);
    if (!faction) return;

    const prev = faction.reputation;
    const prevTier = this.getReputationTier(prev);
    faction.reputation = Math.max(this.minRep, Math.min(this.maxRep, faction.reputation + amount));
    const newTier = this.getReputationTier(faction.reputation);

    this.eventBus.emit('faction:reputationChanged', {
      factionId,
      name: faction.name,
      previous: prev,
      current: faction.reputation,
      change: amount,
      source,
      tierChanged: prevTier.name !== newTier.name,
      tier: newTier
    });
  }

  /**
   * Get reputation with a faction.
   */
  getReputation(factionId) {
    return this.factions.get(factionId)?.reputation || 0;
  }

  /**
   * Get reputation tier for a value.
   */
  getReputationTier(value) {
    for (const tier of this.reputationTiers) {
      if (value >= tier.min && value <= tier.max) return tier;
    }
    return this.reputationTiers[2]; // Neutral fallback
  }

  /**
   * Get faction status for UI.
   */
  getFactionStatus(factionId) {
    const faction = this.factions.get(factionId);
    if (!faction) return null;
    return {
      ...faction,
      tier: this.getReputationTier(faction.reputation),
      percentage: ((faction.reputation - this.minRep) / (this.maxRep - this.minRep)) * 100
    };
  }

  /**
   * Get all factions with their status.
   */
  getAllFactions() {
    const result = [];
    for (const faction of this.factions.values()) {
      result.push({
        ...faction,
        tier: this.getReputationTier(faction.reputation)
      });
    }
    return result;
  }

  /**
   * Get shop price multiplier based on faction reputation.
   */
  getShopMultiplier(factionId) {
    const rep = this.getReputation(factionId);
    if (rep >= 30) return 0.85; // Allied: 15% discount
    if (rep >= 10) return 0.95; // Friendly: 5% discount
    if (rep <= -30) return 1.30; // Hostile: 30% markup
    if (rep <= -10) return 1.15; // Unfriendly: 15% markup
    return 1.0; // Neutral
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    const reps = {};
    for (const [id, faction] of this.factions) {
      reps[id] = faction.reputation;
    }
    return { reputations: reps };
  }

  deserialize(data) {
    if (!data?.reputations) return;
    for (const [id, rep] of Object.entries(data.reputations)) {
      const faction = this.factions.get(id);
      if (faction) faction.reputation = rep;
    }
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }

  registerFaction(id, factionData) {
    if (this.factions.has(id)) return false;
    this.factions.set(id, {
      id,
      name: factionData.name || id,
      description: factionData.description || '',
      color: factionData.color || 0x888888,
      reputation: factionData.reputation || 0,
      ...factionData
    });
    return true;
  }

  modifyReputation(factionId, amount, source = 'unknown') {
    this.changeReputation(factionId, amount, source);
  }
}

export default FactionSystem;
