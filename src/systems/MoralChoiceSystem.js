import { EventBus } from '../core/EventBus.js';

/**
 * MoralChoiceSystem — Tracks player moral choices and their consequences.
 *
 * 4 major endings with 12 variations based on player choices.
 * 15 major choice points across the 6-era campaign.
 * Choices have both immediate and delayed consequences.
 */
export class MoralChoiceSystem {
  static instance = null;
  static getInstance() {
    if (!MoralChoiceSystem.instance) new MoralChoiceSystem();
    return MoralChoiceSystem.instance;
  }

  constructor() {
    if (MoralChoiceSystem.instance) return MoralChoiceSystem.instance;
    this.eventBus = EventBus.getInstance();

    // Moral alignment tracking
    this.alignment = {
      mercy: 0,        // -50 (ruthless) to +50 (merciful)
      truth: 0,        // -50 (deceptive) to +50 (honest)
      sacrifice: 0,    // -50 (selfish) to +50 (selfless)
      authority: 0     // -50 (anarchist) to +50 (authoritarian)
    };

    // Criminality (0-100%)
    this.criminality = 0;

    // Choice history with consequences
    this.choiceHistory = [];

    // Pending consequences (trigger later based on era/quest)
    this.pendingConsequences = [];

    // Resolved consequences
    this.resolvedConsequences = [];

    MoralChoiceSystem.instance = this;
  }

  /**
   * Present a moral choice.
   * @param {object} choice - { id, name, description, options: [{ id, text, alignment, consequences }] }
   */
  presentChoice(choice) {
    this.eventBus.emit('moral:choicePresented', choice);
    return choice;
  }

  /**
   * Record a moral choice made by the player.
   */
  makeChoice(choiceId, optionId, choiceData = {}) {
    const record = {
      choiceId,
      optionId,
      timestamp: Date.now(),
      era: choiceData.era || 1,
      ...choiceData
    };

    this.choiceHistory.push(record);

    // Apply alignment shifts
    if (choiceData.alignment) {
      for (const [axis, shift] of Object.entries(choiceData.alignment)) {
        if (this.alignment[axis] !== undefined) {
          this.alignment[axis] = Math.max(-50, Math.min(50, this.alignment[axis] + shift));
        }
      }
    }

    // Apply criminality changes
    if (choiceData.criminalityChange) {
      this.criminality = Math.max(0, Math.min(100, this.criminality + choiceData.criminalityChange));
    }

    // Queue delayed consequences
    if (choiceData.delayedConsequences) {
      for (const dc of choiceData.delayedConsequences) {
        this.pendingConsequences.push({
          choiceId,
          optionId,
          triggerEra: dc.era,
          triggerQuest: dc.quest,
          effect: dc.effect,
          description: dc.description
        });
      }
    }

    this.eventBus.emit('moral:choiceMade', record);
    return record;
  }

  /**
   * Check and resolve pending consequences for a given era.
   */
  checkPendingConsequences(currentEra, completedQuestId = null) {
    const triggered = [];
    const remaining = [];

    for (const pc of this.pendingConsequences) {
      if (pc.triggerEra === currentEra || pc.triggerQuest === completedQuestId) {
        triggered.push(pc);
        this.resolvedConsequences.push(pc);
        this.eventBus.emit('moral:consequenceTriggered', pc);
      } else {
        remaining.push(pc);
      }
    }

    this.pendingConsequences = remaining;
    return triggered;
  }

  /**
   * Get which endings are available based on alignment.
   */
  getAvailableEndings() {
    const endings = [];

    // Domination: authority > 20
    if (this.alignment.authority > 20) {
      endings.push('domination');
    }

    // Harmony: mercy > 10 and truth > 10
    if (this.alignment.mercy > 10 && this.alignment.truth > 10) {
      endings.push('harmony');
    }

    // Sacrifice: sacrifice > 20
    if (this.alignment.sacrifice > 20) {
      endings.push('sacrifice');
    }

    // Collapse: truth < -10 or authority < -20
    if (this.alignment.truth < -10 || this.alignment.authority < -20) {
      endings.push('collapse');
    }

    // At least one ending is always available
    if (endings.length === 0) {
      endings.push('harmony'); // Default fallback
    }

    return endings;
  }

  /**
   * Get alignment description for UI.
   */
  getAlignmentSummary() {
    const desc = (val, negName, posName) => {
      if (val <= -30) return `Deeply ${negName}`;
      if (val <= -10) return `Somewhat ${negName}`;
      if (val >= 30) return `Deeply ${posName}`;
      if (val >= 10) return `Somewhat ${posName}`;
      return 'Balanced';
    };

    return {
      mercy: { value: this.alignment.mercy, description: desc(this.alignment.mercy, 'Ruthless', 'Merciful') },
      truth: { value: this.alignment.truth, description: desc(this.alignment.truth, 'Deceptive', 'Honest') },
      sacrifice: { value: this.alignment.sacrifice, description: desc(this.alignment.sacrifice, 'Self-Serving', 'Selfless') },
      authority: { value: this.alignment.authority, description: desc(this.alignment.authority, 'Anarchist', 'Authoritarian') },
      criminality: { value: this.criminality, description: this.criminality > 50 ? 'Wanted' : this.criminality > 20 ? 'Suspicious' : 'Clean' }
    };
  }

  /**
   * Check if a specific choice was made.
   */
  hasChosen(choiceId, optionId = null) {
    return this.choiceHistory.some(c =>
      c.choiceId === choiceId && (optionId === null || c.optionId === optionId)
    );
  }

  // ─── Serialization ────────────────────────────────────────────

  serialize() {
    return {
      alignment: { ...this.alignment },
      criminality: this.criminality,
      choiceHistory: this.choiceHistory,
      pendingConsequences: this.pendingConsequences,
      resolvedConsequences: this.resolvedConsequences
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.alignment) this.alignment = { ...data.alignment };
    if (data.criminality !== undefined) this.criminality = data.criminality;
    if (data.choiceHistory) this.choiceHistory = data.choiceHistory;
    if (data.pendingConsequences) this.pendingConsequences = data.pendingConsequences;
    if (data.resolvedConsequences) this.resolvedConsequences = data.resolvedConsequences;
  }

  saveState() { return this.serialize(); }
  loadState(data) { this.deserialize(data); }
}

export default MoralChoiceSystem;
