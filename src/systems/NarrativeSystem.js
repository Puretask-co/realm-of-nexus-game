import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';
import { MoralChoiceSystem } from './MoralChoiceSystem.js';
import { FactionSystem } from './FactionSystem.js';
import { CompanionSystem } from './CompanionSystem.js';

/**
 * NarrativeSystem — Drives the 6-era campaign from story.json.
 *
 * Manages:
 *   - Current era/act tracking
 *   - Era unlock conditions (quest completion, level requirements)
 *   - Choice points and consequence tracking
 *   - Butterfly effect chains across eras
 *   - Ending availability based on accumulated choices
 *   - Major choice point presentation and resolution
 */
export class NarrativeSystem {
  static instance = null;
  static getInstance() {
    if (!NarrativeSystem.instance) new NarrativeSystem();
    return NarrativeSystem.instance;
  }

  constructor() {
    if (NarrativeSystem.instance) return NarrativeSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Story data
    this.storyData = null;
    this.eras = [];
    this.acts = [];

    // State
    this.currentEra = 1;
    this.currentAct = 'act_1';
    this.completedEras = new Set();
    this.choicesMade = new Map(); // choicePointId -> selectedOption
    this.discoveredTruths = new Set();
    this.availableEndings = new Set(['domination', 'harmony', 'sacrifice', 'collapse']);
    this.storyFlags = new Set(); // e.g. void_architect_defeated, unbinding_truth_discovered

    // Quest id -> story flags to set when quest is completed (for ending requirements)
    this.questToStoryFlags = {
      the_unbinding: ['void_architect_defeated', 'unbinding_truth_discovered'],
      siege_of_hollowroot: ['soul_conduit_mastered'],
      nexus_convergence: ['nexus_destabilized']
    };

    // Listen for events
    this.eventBus.on('quest:completed', (data) => {
      this._checkEraProgression(data);
      this._onQuestCompletedForEnding(data);
    });
    this.eventBus.on('player:levelUp', (data) => this._checkEraProgression(data));

    NarrativeSystem.instance = this;
  }

  /**
   * Initialize from story.json data.
   */
  initialize(storyData) {
    this.storyData = storyData;
    this.eras = storyData.eras || [];
    this.acts = storyData.acts || [];
  }

  /**
   * Get the current era definition.
   */
  getCurrentEra() {
    return this.eras.find(e => e.eraNumber === this.currentEra) || this.eras[0];
  }

  /**
   * Get current act definition.
   */
  getCurrentAct() {
    return this.acts.find(a => a.id === this.currentAct) || this.acts[0];
  }

  /**
   * Get all eras with their status.
   */
  getAllEras() {
    return this.eras.map(era => ({
      ...era,
      completed: this.completedEras.has(era.id),
      current: era.eraNumber === this.currentEra,
      locked: era.eraNumber > this.currentEra && !this.completedEras.has(era.id)
    }));
  }

  /**
   * Make a choice at a choice point.
   */
  makeChoice(choicePointId, selectedOption) {
    if (this.choicesMade.has(choicePointId)) return false; // Already chose

    this.choicesMade.set(choicePointId, selectedOption);

    // Find the choice point to get consequences
    const era = this.getCurrentEra();
    const choicePoint = era?.keyChoicePoints?.find(cp => cp.id === choicePointId);

    if (choicePoint) {
      const consequence = choicePoint.consequences?.[selectedOption];

      this.eventBus.emit('narrative:choiceMade', {
        choicePointId,
        choiceName: choicePoint.name,
        selectedOption,
        consequence,
        era: this.currentEra
      });

      // Track specific consequences that affect endings
      this._processConsequences(choicePointId, selectedOption, consequence);
    }

    return true;
  }

  /**
   * Get available choices for current era.
   */
  getAvailableChoices() {
    const era = this.getCurrentEra();
    if (!era?.keyChoicePoints) return [];
    return era.keyChoicePoints.filter(cp => !this.choicesMade.has(cp.id));
  }

  /**
   * Get choices already made.
   */
  getChoicesMade() {
    return [...this.choicesMade.entries()].map(([id, option]) => ({ id, option }));
  }

  /**
   * Complete the current era and check for next.
   */
  completeCurrentEra() {
    const era = this.getCurrentEra();
    if (!era) return;

    this.completedEras.add(era.id);

    this.eventBus.emit('narrative:eraCompleted', {
      eraId: era.id,
      eraName: era.name,
      eraNumber: era.eraNumber,
      climaxEvent: era.climaxEvent
    });

    // Advance to next era
    if (this.currentEra < this.eras.length) {
      this.currentEra++;
      const nextEra = this.getCurrentEra();
      if (nextEra) {
        this.currentAct = nextEra.act;
        this.eventBus.emit('narrative:eraStarted', {
          eraId: nextEra.id,
          eraName: nextEra.name,
          eraNumber: nextEra.eraNumber,
          act: nextEra.act
        });
      }
    }
  }

  /**
   * Check if era progression conditions are met.
   */
  _checkEraProgression(data) {
    const era = this.getCurrentEra();
    if (!era) return;

    if (data?.questId && era.climaxEvent) {
      const mainQuests = era.mainQuests || [];
      const lastQuest = mainQuests[mainQuests.length - 1];
      if (data.questId === lastQuest || data.questId === era.climaxEvent.id) {
        this.completeCurrentEra();
      }
    }
  }

  _onQuestCompletedForEnding(data) {
    const questId = data?.questId;
    if (!questId) return;

    const flags = this.questToStoryFlags[questId];
    if (flags) {
      for (const flag of flags) this.recordStoryFlag(flag);
    }

    if (questId === 'the_unbinding') {
      this.triggerEnding();
    }
  }

  /**
   * Process consequences of a choice.
   */
  _processConsequences(choicePointId, option, consequence) {
    // Track ending-affecting choices
    if (consequence?.includes?.('Domination') || option === 'domination') {
      this.discoveredTruths.add('domination_path');
    }
    if (consequence?.includes?.('Harmony') || option === 'harmony') {
      this.discoveredTruths.add('harmony_path');
    }
    if (consequence?.includes?.('Sacrifice') || option === 'sacrifice') {
      this.discoveredTruths.add('sacrifice_path');
    }
  }

  /**
   * Get butterfly effect chains and their current state.
   */
  getButterflyEffects() {
    if (!this.storyData?.butterflyEffectChains) return [];

    return this.storyData.butterflyEffectChains.map(chain => {
      const nodes = chain.nodes.map(node => ({
        ...node,
        resolved: node.choicePoint ? this.choicesMade.has(node.choicePoint) : false,
        active: node.era === this.currentEra
      }));

      return {
        ...chain,
        nodes,
        triggered: nodes.some(n => n.resolved)
      };
    });
  }

  /**
   * Get available endings based on choices made.
   */
  getAvailableEndings() {
    if (!this.storyData?.narrative?.majorEndings) return [];
    return this.storyData.narrative.majorEndings.filter(ending =>
      this.availableEndings.has(ending.id)
    );
  }

  /**
   * Record a story flag (e.g. void_architect_defeated, unbinding_truth_discovered).
   * Called by quest completion or climax events.
   */
  recordStoryFlag(flagId) {
    this.storyFlags.add(flagId);
    this.eventBus.emit('narrative:storyFlagRecorded', { flagId });
  }

  /**
   * Check if a story flag has been set.
   */
  hasStoryFlag(flagId) {
    return this.storyFlags.has(flagId);
  }

  /**
   * Evaluate whether the player meets all requirements for a given ending.
   */
  evaluateEndingRequirements(endingId) {
    const endings = this.storyData?.narrative?.majorEndings || [];
    const ending = endings.find(e => e.id === endingId);
    if (!ending || !ending.requirements || !Array.isArray(ending.requirements)) return false;

    const moral = MoralChoiceSystem.getInstance();
    const factions = FactionSystem.getInstance();
    const companions = CompanionSystem.getInstance();

    for (const req of ending.requirements) {
      if (req === 'faction_alliance_authoritarian') {
        if (moral.alignment.authority <= 20) return false;
        continue;
      }
      if (req === 'void_architect_defeated') {
        if (!this.storyFlags.has('void_architect_defeated')) return false;
        continue;
      }
      if (req === 'faction_reputation_balanced') {
        const reps = [...factions.factions.values()].map(f => f.reputation);
        const anyHostile = reps.some(r => r <= -30);
        const anyAllied = reps.some(r => r >= 30);
        if (anyHostile || !reps.some(r => r >= 10)) return false; // need at least one friendly, none hostile
        continue;
      }
      if (req === 'unbinding_truth_discovered') {
        if (!this.storyFlags.has('unbinding_truth_discovered')) return false;
        continue;
      }
      if (req === 'companion_bonds_strong') {
        const recruited = companions.getRecruited?.() || [];
        const bondStrong = recruited.some(c => (c.bondLevel || 0) >= 6);
        if (recruited.length < 1 || !bondStrong) return false;
        continue;
      }
      if (req === 'soul_conduit_mastered') {
        if (!this.storyFlags.has('soul_conduit_mastered')) return false;
        continue;
      }
      if (req === 'nexus_destabilized') {
        if (!this.storyFlags.has('nexus_destabilized')) return false;
        continue;
      }
      if (req === 'scar_fully_opened') {
        if (!this.storyFlags.has('scar_fully_opened')) return false;
        continue;
      }
    }
    return true;
  }

  /**
   * Determine which ending and variation to trigger based on current state.
   * Call when the final climax is complete (e.g. after final quest).
   * @returns {{ endingId: string, variation: number, ending: object } | null}
   */
  getTriggeredEnding() {
    const endings = this.storyData?.narrative?.majorEndings || [];
    const moral = MoralChoiceSystem.getInstance();

    const candidates = endings.filter(e => this.availableEndings.has(e.id) && this.evaluateEndingRequirements(e.id));
    if (candidates.length === 0) {
      const fallback = moral.getAvailableEndings?.();
      const first = fallback?.[0] || 'harmony';
      const def = endings.find(e => e.id === first) || endings[0];
      return def ? { endingId: def.id, variation: 0, ending: def } : null;
    }

    const preferred = candidates[0];
    const variations = Math.min(preferred.variations || 3, 3);
    let variation = 0;
    if (variations > 1) {
      if (preferred.id === 'domination') variation = moral.alignment.authority >= 40 ? 2 : moral.alignment.authority >= 30 ? 1 : 0;
      else if (preferred.id === 'harmony') variation = moral.alignment.mercy >= 30 ? 2 : moral.alignment.truth >= 20 ? 1 : 0;
      else if (preferred.id === 'sacrifice') variation = moral.alignment.sacrifice >= 40 ? 2 : moral.alignment.sacrifice >= 25 ? 1 : 0;
      else variation = moral.alignment.truth <= -30 ? 2 : moral.alignment.authority <= -30 ? 1 : 0;
      variation = Math.min(variation, variations - 1);
    }

    return { endingId: preferred.id, variation, ending: preferred };
  }

  /**
   * Trigger the ending sequence. Call after final battle/quest.
   * Emits narrative:endingTriggered and returns the ending payload.
   */
  triggerEnding() {
    const result = this.getTriggeredEnding();
    if (!result) return null;
    this.eventBus.emit('narrative:endingTriggered', {
      endingId: result.endingId,
      variation: result.variation,
      ending: result.ending
    });
    return result;
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return {
      currentEra: this.currentEra,
      currentAct: this.currentAct,
      completedEras: [...this.completedEras],
      choicesMade: Object.fromEntries(this.choicesMade),
      discoveredTruths: [...this.discoveredTruths],
      availableEndings: [...this.availableEndings],
      storyFlags: [...this.storyFlags]
    };
  }

  deserialize(data) {
    if (!data) return;
    this.currentEra = data.currentEra || 1;
    this.currentAct = data.currentAct || 'act_1';
    if (data.completedEras) this.completedEras = new Set(data.completedEras);
    if (data.choicesMade) this.choicesMade = new Map(Object.entries(data.choicesMade));
    if (data.discoveredTruths) this.discoveredTruths = new Set(data.discoveredTruths);
    if (data.availableEndings) this.availableEndings = new Set(data.availableEndings);
    if (data.storyFlags) this.storyFlags = new Set(data.storyFlags);
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }

  loadStoryData(storyData) {
    this.initialize(storyData);
  }
}

export default NarrativeSystem;
