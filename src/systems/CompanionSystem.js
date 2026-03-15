import { EventBus } from '../core/EventBus.js';

/**
 * CompanionSystem — Recruitable companions with AI and bond mechanics.
 *
 * 5 potential companions:
 *   Vaeril  - Bloomguard warrior, melee tank
 *   Sylor   - Thornbinder rogue, stealth/damage
 *   Aeliana - Emerald Mystic healer
 *   Mycon   - Sporecaller debuffer
 *   Kaelen  - Wildkin Ranger, ranged DPS
 *
 * Max 2 companions in party. Each has:
 *   - Bond level (0-10) that grows through shared experiences
 *   - Personal questline
 *   - Unique combat abilities
 *   - AI behavior that improves with bond level
 *   - Personal story arc that intersects with main narrative
 */
export class CompanionSystem {
  static instance = null;
  static getInstance() {
    if (!CompanionSystem.instance) new CompanionSystem();
    return CompanionSystem.instance;
  }

  constructor() {
    if (CompanionSystem.instance) return CompanionSystem.instance;
    this.eventBus = EventBus.getInstance();
    this.maxPartyCompanions = 2;

    // Companion definitions
    this.companions = new Map([
      ['vaeril', {
        id: 'vaeril', name: 'Vaeril', title: 'Shield of the Grove',
        class: 'bloomguard', role: 'tank',
        description: 'A steadfast Bloomguard warrior who believes in duty above all else. His ironbark shield has turned aside a thousand blows.',
        personality: 'Stoic, protective, quietly humorous. Values honor and keeping promises.',
        baseStats: { might: 4, agility: 1, resilience: 4, insight: 1, charisma: 2, hp: 45, guard: 12 },
        abilities: ['shield_wall', 'taunt', 'guardians_strike'],
        recruitLocation: 'verdant_grove', recruitQuest: 'vaeril_recruitment',
        bondEvents: ['shared_battle', 'saved_ally', 'camp_conversation', 'personal_quest'],
        personalQuest: 'oath_of_the_grove',
        recruited: false, bondLevel: 0, bondXP: 0, inParty: false, alive: true
      }],
      ['sylor', {
        id: 'sylor', name: 'Sylor', title: 'Shadow of Thorns',
        class: 'thornbinder', role: 'dps',
        description: 'A cunning Thornbinder who walks the line between justice and revenge. Quick with a blade and quicker with words.',
        personality: 'Sarcastic, clever, fiercely loyal once trust is earned. Distrusts authority.',
        baseStats: { might: 2, agility: 4, resilience: 1, insight: 3, charisma: 2, hp: 30, guard: 3 },
        abilities: ['backstab', 'vanish', 'venomous_edge'],
        recruitLocation: 'hollowroot_catacombs', recruitQuest: 'sylor_recruitment',
        bondEvents: ['shared_secret', 'successful_ambush', 'trust_test', 'personal_quest'],
        personalQuest: 'shadows_of_the_past',
        recruited: false, bondLevel: 0, bondXP: 0, inParty: false, alive: true
      }],
      ['aeliana', {
        id: 'aeliana', name: 'Aeliana', title: 'Voice of the Coven',
        class: 'emerald_mystic', role: 'healer',
        description: 'An Emerald Coven mystic with a gift for healing and an insatiable curiosity about the Sap\'s mysteries.',
        personality: 'Warm, intellectual, morally principled. Struggles between knowledge-seeking and caution.',
        baseStats: { might: 0, agility: 1, resilience: 2, insight: 4, charisma: 3, hp: 28, guard: 2 },
        abilities: ['verdant_bloom', 'soul_link', 'efficient_casting'],
        recruitLocation: 'canopy_of_life', recruitQuest: 'aeliana_recruitment',
        bondEvents: ['magical_discovery', 'moral_discussion', 'healing_crisis', 'personal_quest'],
        personalQuest: 'mysteries_of_the_sap',
        recruited: false, bondLevel: 0, bondXP: 0, inParty: false, alive: true
      }],
      ['mycon', {
        id: 'mycon', name: 'Mycon', title: 'The Living Network',
        class: 'sporecaller', role: 'controller',
        description: 'A Sporecaller who is slowly merging with the fungal networks beneath the Verdance. Their insights are alien but invaluable.',
        personality: 'Detached, cryptic, surprisingly empathetic. Speaks of "we" instead of "I" sometimes.',
        baseStats: { might: 1, agility: 1, resilience: 3, insight: 3, charisma: 2, hp: 32, guard: 5 },
        abilities: ['fungal_network', 'spore_detonation', 'decay_aura'],
        recruitLocation: 'sporecaller_depths', recruitQuest: 'mycon_recruitment',
        bondEvents: ['fungal_communion', 'corruption_resistance', 'shared_vision', 'personal_quest'],
        personalQuest: 'the_network_calls',
        recruited: false, bondLevel: 0, bondXP: 0, inParty: false, alive: true
      }],
      ['kaelen', {
        id: 'kaelen', name: 'Kaelen', title: 'Warden of the Wild',
        class: 'wildkin_ranger', role: 'ranged_dps',
        description: 'A Wildkin Ranger who has bonded with a ghostly hawk spirit. They see the world through the eyes of nature itself.',
        personality: 'Quiet, observant, deeply connected to nature. Speaks more to animals than people.',
        baseStats: { might: 2, agility: 4, resilience: 1, insight: 2, charisma: 1, hp: 34, guard: 4 },
        abilities: ['eagle_eye', 'thorn_barrage', 'terrain_mastery'],
        recruitLocation: 'moonpetal_marsh', recruitQuest: 'kaelen_recruitment',
        bondEvents: ['nature_communion', 'tracking_success', 'animal_rescue', 'personal_quest'],
        personalQuest: 'call_of_the_wild',
        recruited: false, bondLevel: 0, bondXP: 0, inParty: false, alive: true
      }]
    ]);

    // Bond XP thresholds per level
    this.bondXPPerLevel = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];

    this.eventBus.on('combat:ended', (data) => this._onCombatEnded(data));

    CompanionSystem.instance = this;
  }

  /**
   * Recruit a companion.
   */
  recruit(companionId) {
    const c = this.companions.get(companionId);
    if (!c || c.recruited) return false;
    c.recruited = true;
    this.eventBus.emit('companion:recruited', { companionId, name: c.name });
    return true;
  }

  /**
   * Add companion to active party.
   */
  addToParty(companionId) {
    const c = this.companions.get(companionId);
    if (!c || !c.recruited || c.inParty || !c.alive) return false;
    if (this.getActiveParty().length >= this.maxPartyCompanions) return false;
    c.inParty = true;
    this.eventBus.emit('companion:joinedParty', { companionId, name: c.name });
    return true;
  }

  /**
   * Remove companion from active party.
   */
  removeFromParty(companionId) {
    const c = this.companions.get(companionId);
    if (!c || !c.inParty) return false;
    c.inParty = false;
    this.eventBus.emit('companion:leftParty', { companionId, name: c.name });
    return true;
  }

  /**
   * Increase bond with a companion.
   */
  addBondXP(companionId, amount, source = 'unknown') {
    const c = this.companions.get(companionId);
    if (!c || !c.recruited || !c.alive) return;
    c.bondXP += amount;

    // Check bond level up
    while (c.bondLevel < 10 && c.bondXP >= this.bondXPPerLevel[c.bondLevel + 1]) {
      c.bondLevel++;
      this.eventBus.emit('companion:bondLevelUp', {
        companionId, name: c.name, bondLevel: c.bondLevel
      });
    }
  }

  /**
   * Get active party companions.
   */
  getActiveParty() {
    return [...this.companions.values()].filter(c => c.inParty && c.alive);
  }

  /**
   * Get all recruited companions.
   */
  getRecruited() {
    return [...this.companions.values()].filter(c => c.recruited);
  }

  /**
   * Get companion for combat as entity format.
   */
  getCompanionCombatEntity(companionId) {
    const c = this.companions.get(companionId);
    if (!c || !c.alive) return null;
    return {
      id: c.id, name: c.name, isCompanion: true,
      stats: {
        hp: c.baseStats.hp, maxHp: c.baseStats.hp,
        guard: c.baseStats.guard, maxGuard: c.baseStats.guard,
        might: c.baseStats.might, agility: c.baseStats.agility,
        resilience: c.baseStats.resilience, insight: c.baseStats.insight,
        charisma: c.baseStats.charisma,
        ap: c.baseStats.agility >= 4 ? 3 : 2
      },
      abilities: c.abilities,
      bondLevel: c.bondLevel
    };
  }

  _onCombatEnded(data) {
    if (data?.result === 'victory') {
      for (const c of this.getActiveParty()) {
        this.addBondXP(c.id, 3, 'shared_combat');
      }
    }
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    const state = {};
    for (const [id, c] of this.companions) {
      state[id] = {
        recruited: c.recruited, bondLevel: c.bondLevel,
        bondXP: c.bondXP, inParty: c.inParty, alive: c.alive
      };
    }
    return { companions: state };
  }

  deserialize(data) {
    if (!data?.companions) return;
    for (const [id, state] of Object.entries(data.companions)) {
      const c = this.companions.get(id);
      if (c) Object.assign(c, state);
    }
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }
}

export default CompanionSystem;
