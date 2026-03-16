import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { AttributeSystem } from './AttributeSystem.js';

/**
 * SkillCheckSystem — Use-based skill improvement with 12 skills and 5 ranks.
 *
 * Skills improve by using them (not by spending points).
 * Each successful use grants skill XP toward the next rank.
 *
 * Skills: Athletics, Stealth, Perception, Persuasion, Intimidation,
 *         Deception, Nature, Arcana, Medicine, Survival, Crafting, History
 *
 * Ranks: Untrained (0), Novice (1), Apprentice (2), Journeyman (3),
 *        Expert (4), Master (5)
 *
 * Check formula: d20 + Attribute + Skill Rank vs DC
 */
export class SkillCheckSystem {
  static instance = null;
  static getInstance() {
    if (!SkillCheckSystem.instance) new SkillCheckSystem();
    return SkillCheckSystem.instance;
  }

  constructor() {
    if (SkillCheckSystem.instance) return SkillCheckSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Skill definitions with governing attributes
    this.skillDefinitions = {
      athletics: { name: 'Athletics', attribute: 'might', description: 'Physical feats: climbing, jumping, swimming, breaking' },
      stealth: { name: 'Stealth', attribute: 'agility', description: 'Moving unseen, hiding, pickpocketing, sneaking' },
      perception: { name: 'Perception', attribute: 'insight', description: 'Noticing details, detecting traps, spotting hidden things' },
      persuasion: { name: 'Persuasion', attribute: 'charisma', description: 'Convincing others, negotiating, inspiring' },
      intimidation: { name: 'Intimidation', attribute: 'might', description: 'Threatening, coercing, demanding' },
      deception: { name: 'Deception', attribute: 'charisma', description: 'Lying, disguising, misdirecting' },
      nature: { name: 'Nature', attribute: 'insight', description: 'Knowledge of flora, fauna, weather, terrain' },
      arcana: { name: 'Arcana', attribute: 'insight', description: 'Understanding magic, Sap, rituals, enchantments' },
      medicine: { name: 'Medicine', attribute: 'insight', description: 'Healing, diagnosing, curing corruption' },
      survival: { name: 'Survival', attribute: 'resilience', description: 'Tracking, foraging, camping, navigating' },
      crafting: { name: 'Crafting', attribute: 'insight', description: 'Creating items, repairing equipment, brewing' },
      history: { name: 'History', attribute: 'insight', description: 'Knowledge of lore, factions, Unbinding history' }
    };

    // Rank names
    this.rankNames = ['Untrained', 'Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];
    this.maxRank = 5;

    // XP required per rank (cumulative uses needed)
    this.xpPerRank = [0, 5, 15, 30, 50, 80];

    // Current skill state
    this.skills = {};
    for (const id of Object.keys(this.skillDefinitions)) {
      this.skills[id] = { rank: 0, xp: 0, totalUses: 0 };
    }

    // DC table
    const checkCfg = dataManager.getConfig('balance.skillChecks') || {};
    this.difficultyClasses = checkCfg.difficultyClasses || {
      veryEasy: 8, easy: 10, moderate: 12, hard: 14,
      veryHard: 16, extremelyHard: 18, nearlyImpossible: 20
    };

    SkillCheckSystem.instance = this;
  }

  /**
   * Perform a skill check.
   * @param {string} skillId - The skill to check
   * @param {number|string} dc - Difficulty class (number or name like 'moderate')
   * @param {object} options - { bonuses, advantage, sapCycleDiplomacyBonus (from SapCycleManager.getModifiers().diplomacyBonus for persuasion/deception) }
   * @returns {{ success: boolean, roll: number, total: number, dc: number, natural20: boolean }}
   */
  check(skillId, dc, options = {}) {
    const skill = this.skills[skillId];
    const def = this.skillDefinitions[skillId];
    if (!skill || !def) return { success: false, roll: 0, total: 0, dc: 0, error: 'Unknown skill' };

    // Resolve DC
    const dcValue = typeof dc === 'string' ? (this.difficultyClasses[dc] || 12) : dc;

    // Roll d20
    let roll = Math.floor(Math.random() * 20) + 1;

    // Advantage: roll twice, take higher
    if (options.advantage) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.max(roll, roll2);
    }

    // Get attribute bonus
    const attrs = AttributeSystem.getInstance();
    const attrBonus = attrs.get(def.attribute);

    // Sap Cycle: diplomacyBonus applies to social skills (persuasion, deception)
    const diplomacyBonus = (options.sapCycleDiplomacyBonus ?? 0) +
      ((skillId === 'persuasion' || skillId === 'deception') ? (options.diplomacyBonus ?? 0) : 0);
    // Total = roll + attribute + skill rank + bonuses
    const total = roll + attrBonus + skill.rank + (options.bonuses || 0) + diplomacyBonus;
    const natural20 = roll === 20;
    const success = natural20 || total >= dcValue;

    // Award skill XP on use (successful or not, but more on success)
    const xpGain = success ? 2 : 1;
    this._awardSkillXP(skillId, xpGain);

    const result = {
      success,
      roll,
      total,
      dc: dcValue,
      natural20,
      skillName: def.name,
      attribute: def.attribute,
      attrBonus,
      skillRank: skill.rank,
      rankName: this.rankNames[skill.rank]
    };

    this.eventBus.emit('skill:checked', result);
    return result;
  }

  /**
   * Award skill XP (from use).
   */
  _awardSkillXP(skillId, amount) {
    const skill = this.skills[skillId];
    if (!skill || skill.rank >= this.maxRank) return;

    skill.xp += amount;
    skill.totalUses++;

    // Check rank up
    const nextRankXP = this.xpPerRank[skill.rank + 1];
    if (nextRankXP !== undefined && skill.xp >= nextRankXP) {
      skill.rank++;
      this.eventBus.emit('skill:rankUp', {
        skillId,
        skillName: this.skillDefinitions[skillId].name,
        newRank: skill.rank,
        rankName: this.rankNames[skill.rank]
      });
    }
  }

  /**
   * Get skill info for UI.
   */
  getSkillInfo(skillId) {
    const skill = this.skills[skillId];
    const def = this.skillDefinitions[skillId];
    if (!skill || !def) return null;

    const nextRankXP = skill.rank < this.maxRank ? this.xpPerRank[skill.rank + 1] : null;
    return {
      id: skillId,
      ...def,
      rank: skill.rank,
      rankName: this.rankNames[skill.rank],
      xp: skill.xp,
      xpToNextRank: nextRankXP,
      xpProgress: nextRankXP ? skill.xp / nextRankXP : 1.0,
      totalUses: skill.totalUses,
      maxRank: skill.rank >= this.maxRank
    };
  }

  /**
   * Get all skills info.
   */
  getAllSkills() {
    return Object.keys(this.skillDefinitions).map(id => this.getSkillInfo(id));
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return { skills: JSON.parse(JSON.stringify(this.skills)) };
  }

  deserialize(data) {
    if (data?.skills) {
      for (const [id, state] of Object.entries(data.skills)) {
        if (this.skills[id]) Object.assign(this.skills[id], state);
      }
    }
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }
}

export default SkillCheckSystem;
