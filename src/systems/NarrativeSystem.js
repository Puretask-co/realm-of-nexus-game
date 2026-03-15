import { EventBus } from '../core/EventBus.js';
import dataManager from './DataManager.js';

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

    // Listen for events
    this.eventBus.on('quest:completed', (data) => this._checkEraProgression(data));
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

    // Check if climax event quest is completed
    if (data?.questId && era.climaxEvent) {
      // The climax event signals era completion
      const mainQuests = era.mainQuests || [];
      const lastQuest = mainQuests[mainQuests.length - 1];
      if (data.questId === lastQuest || data.questId === era.climaxEvent.id) {
        this.completeCurrentEra();
      }
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

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return {
      currentEra: this.currentEra,
      currentAct: this.currentAct,
      completedEras: [...this.completedEras],
      choicesMade: Object.fromEntries(this.choicesMade),
      discoveredTruths: [...this.discoveredTruths],
      availableEndings: [...this.availableEndings]
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
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }

  loadStoryData(storyData) {
    this.initialize(storyData);
  }
}

export default NarrativeSystem;
