import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * DialogueSystem - Branching conversation system for Verdance.
 * Supports branching dialogue trees, character portraits, typewriter text,
 * player choices with consequences, conditions, variables, and cutscene integration.
 */
export class DialogueSystem {
  static instance = null;

  constructor(scene) {
    if (DialogueSystem.instance) return DialogueSystem.instance;

    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // Dialogue data
    this.dialogues = new Map();
    this.characters = new Map();

    // Active conversation state
    this.active = false;
    this.currentDialogue = null;
    this.currentNodeId = null;
    this.currentNode = null;
    this.currentCharIndex = 0;
    this.typewriterTimer = null;
    this.typewriterSpeed = 30; // ms per character
    this.isTyping = false;
    this.fullText = '';

    // Variables for condition checking and consequence tracking
    this.variables = new Map();
    this.history = []; // Track all dialogue choices made

    // UI Elements (will be created when dialogue starts)
    this.container = null;
    this.dialogueBox = null;
    this.nameText = null;
    this.bodyText = null;
    this.portraitImage = null;
    this.choiceButtons = [];
    this.continueIndicator = null;

    // Callbacks
    this.onDialogueEnd = null;
    this.onChoiceMade = null;

    // UI Configuration
    this.uiConfig = {
      boxWidth: GameConfig.WIDTH - 80,
      boxHeight: 160,
      boxX: 40,
      boxY: GameConfig.HEIGHT - 200,
      padding: 20,
      nameColor: '#4a9eff',
      textColor: '#e0e0e0',
      choiceColor: '#ffffff',
      choiceHoverColor: '#4a9eff',
      bgColor: 0x1a1a2e,
      bgAlpha: 0.92,
      borderColor: 0x4a4a6e,
      portraitSize: 96,
      fontSize: '16px',
      nameFontSize: '18px',
      fontFamily: 'monospace'
    };

    DialogueSystem.instance = this;
  }

  static getInstance(scene) {
    if (!DialogueSystem.instance && scene) new DialogueSystem(scene);
    return DialogueSystem.instance;
  }

  // ─── Data Registration ────────────────────────────────────────────

  registerDialogue(id, dialogueData) {
    const dialogue = {
      id,
      nodes: new Map(),
      startNode: dialogueData.startNode || 'start',
      metadata: dialogueData.metadata || {}
    };

    // Build node map
    if (dialogueData.nodes) {
      for (const node of dialogueData.nodes) {
        dialogue.nodes.set(node.id, {
          id: node.id,
          speaker: node.speaker || null,
          text: node.text || '',
          portrait: node.portrait || null,
          emotion: node.emotion || 'neutral',
          choices: node.choices || [],
          next: node.next || null,
          conditions: node.conditions || [],
          effects: node.effects || [],
          animation: node.animation || null,
          sound: node.sound || null,
          camera: node.camera || null,
          typewriterSpeed: node.typewriterSpeed || null,
          autoAdvance: node.autoAdvance || false,
          autoAdvanceDelay: node.autoAdvanceDelay || 2000
        });
      }
    }

    this.dialogues.set(id, dialogue);
    return dialogue;
  }

  registerCharacter(id, characterData) {
    this.characters.set(id, {
      id,
      name: characterData.name || id,
      portraits: characterData.portraits || {},
      defaultPortrait: characterData.defaultPortrait || 'neutral',
      nameColor: characterData.nameColor || this.uiConfig.nameColor,
      voiceSound: characterData.voiceSound || null,
      voicePitch: characterData.voicePitch || 1.0,
      textSpeed: characterData.textSpeed || 1.0
    });
  }

  // ─── Dialogue Control ────────────────────────────────────────────

  startDialogue(dialogueId, options = {}) {
    const dialogue = this.dialogues.get(dialogueId);
    if (!dialogue) {
      console.warn(`DialogueSystem: Unknown dialogue '${dialogueId}'`);
      return false;
    }

    this.currentDialogue = dialogue;
    this.active = true;
    this.onDialogueEnd = options.onEnd || null;
    this.onChoiceMade = options.onChoice || null;

    // Create UI
    this.createDialogueUI();

    // Show first node
    this.showNode(dialogue.startNode);

    // Emit events
    this.eventBus.emit('dialogue:started', { dialogueId });
    this.eventBus.emit('game:inputLocked', { system: 'dialogue' });

    return true;
  }

  showNode(nodeId) {
    if (!this.currentDialogue) return;

    const node = this.currentDialogue.nodes.get(nodeId);
    if (!node) {
      console.warn(`DialogueSystem: Unknown node '${nodeId}' in dialogue '${this.currentDialogue.id}'`);
      this.endDialogue();
      return;
    }

    // Check conditions
    if (node.conditions.length > 0 && !this.evaluateConditions(node.conditions)) {
      // Skip to next node if conditions not met
      if (node.next) this.showNode(node.next);
      else this.endDialogue();
      return;
    }

    this.currentNodeId = nodeId;
    this.currentNode = node;

    // Apply effects
    this.applyEffects(node.effects);

    // Get character info
    const character = node.speaker ? this.characters.get(node.speaker) : null;

    // Update UI
    this.updateDialogueUI(node, character);

    // Start typewriter effect
    this.startTypewriter(node.text, character?.textSpeed || 1.0, node.typewriterSpeed);

    // Play node sound
    if (node.sound) {
      this.eventBus.emit('audio:playSFX', { key: node.sound });
    }

    // Camera action
    if (node.camera) {
      this.eventBus.emit('camera:action', node.camera);
    }

    // Animation
    if (node.animation) {
      this.eventBus.emit('animation:play', node.animation);
    }

    this.eventBus.emit('dialogue:nodeShown', {
      dialogueId: this.currentDialogue.id,
      nodeId,
      speaker: node.speaker
    });
  }

  advanceDialogue() {
    if (!this.active || !this.currentNode) return;

    // If still typing, show full text immediately
    if (this.isTyping) {
      this.completeTypewriter();
      return;
    }

    // If there are choices, don't auto-advance
    if (this.currentNode.choices.length > 0) return;

    // Move to next node
    if (this.currentNode.next) {
      this.showNode(this.currentNode.next);
    } else {
      this.endDialogue();
    }
  }

  selectChoice(choiceIndex) {
    if (!this.active || !this.currentNode) return;
    if (choiceIndex < 0 || choiceIndex >= this.currentNode.choices.length) return;

    const choice = this.currentNode.choices[choiceIndex];

    // Check if choice is available
    if (choice.conditions && !this.evaluateConditions(choice.conditions)) return;

    // Record choice in history
    this.history.push({
      dialogueId: this.currentDialogue.id,
      nodeId: this.currentNodeId,
      choiceIndex,
      choiceText: choice.text,
      timestamp: Date.now()
    });

    // Apply choice effects
    if (choice.effects) this.applyEffects(choice.effects);

    // Callback
    if (this.onChoiceMade) {
      this.onChoiceMade({
        dialogueId: this.currentDialogue.id,
        nodeId: this.currentNodeId,
        choiceIndex,
        choice
      });
    }

    this.eventBus.emit('dialogue:choiceMade', {
      dialogueId: this.currentDialogue.id,
      nodeId: this.currentNodeId,
      choiceIndex,
      choiceText: choice.text
    });

    // Navigate to next node
    if (choice.next) {
      this.showNode(choice.next);
    } else {
      this.endDialogue();
    }
  }

  endDialogue() {
    this.active = false;
    this.currentDialogue = null;
    this.currentNode = null;
    this.currentNodeId = null;

    // Stop typewriter
    this.stopTypewriter();

    // Destroy UI
    this.destroyDialogueUI();

    // Callbacks
    if (this.onDialogueEnd) this.onDialogueEnd();

    this.eventBus.emit('dialogue:ended');
    this.eventBus.emit('game:inputUnlocked', { system: 'dialogue' });
  }

  // ─── Typewriter Effect ────────────────────────────────────────────

  startTypewriter(text, speedMultiplier = 1.0, customSpeed = null) {
    this.stopTypewriter();

    this.fullText = text;
    this.currentCharIndex = 0;
    this.isTyping = true;
    this.bodyText.setText('');

    const speed = customSpeed || (this.typewriterSpeed / speedMultiplier);

    this.typewriterTimer = this.scene.time.addEvent({
      delay: speed,
      callback: () => {
        this.currentCharIndex++;
        this.bodyText.setText(this.fullText.substring(0, this.currentCharIndex));

        // Play voice blip
        if (this.currentCharIndex % 3 === 0) {
          const character = this.currentNode?.speaker ? this.characters.get(this.currentNode.speaker) : null;
          if (character?.voiceSound) {
            this.eventBus.emit('audio:playSFX', {
              key: character.voiceSound,
              config: { volume: 0.3, rate: character.voicePitch + (Math.random() * 0.2 - 0.1) }
            });
          }
        }

        if (this.currentCharIndex >= this.fullText.length) {
          this.isTyping = false;
          this.typewriterTimer.remove();
          this.typewriterTimer = null;
          this.onTypewriterComplete();
        }
      },
      loop: true
    });
  }

  completeTypewriter() {
    this.stopTypewriter();
    this.bodyText.setText(this.fullText);
    this.isTyping = false;
    this.onTypewriterComplete();
  }

  stopTypewriter() {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
      this.typewriterTimer = null;
    }
  }

  onTypewriterComplete() {
    // Show choices if available
    if (this.currentNode?.choices.length > 0) {
      this.showChoices(this.currentNode.choices);
    } else {
      // Show continue indicator
      if (this.continueIndicator) {
        this.continueIndicator.setVisible(true);
      }

      // Auto-advance if configured
      if (this.currentNode?.autoAdvance) {
        this.scene.time.delayedCall(this.currentNode.autoAdvanceDelay, () => {
          if (this.active && this.currentNodeId === this.currentNode?.id) {
            this.advanceDialogue();
          }
        });
      }
    }
  }

  // ─── Variables & Conditions ───────────────────────────────────────

  setVariable(name, value) {
    this.variables.set(name, value);
    this.eventBus.emit('dialogue:variableSet', { name, value });
  }

  getVariable(name, defaultValue = null) {
    return this.variables.has(name) ? this.variables.get(name) : defaultValue;
  }

  evaluateConditions(conditions) {
    for (const condition of conditions) {
      const value = this.getVariable(condition.variable);

      switch (condition.operator || '==') {
        case '==':
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case '!=':
        case 'notEquals':
          if (value === condition.value) return false;
          break;
        case '>':
          if (value <= condition.value) return false;
          break;
        case '<':
          if (value >= condition.value) return false;
          break;
        case '>=':
          if (value < condition.value) return false;
          break;
        case '<=':
          if (value > condition.value) return false;
          break;
        case 'has':
          if (!value || (Array.isArray(value) && !value.includes(condition.value))) return false;
          break;
        case 'true':
          if (!value) return false;
          break;
        case 'false':
          if (value) return false;
          break;
      }
    }
    return true;
  }

  applyEffects(effects) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'setVariable':
          this.setVariable(effect.variable, effect.value);
          break;
        case 'increment':
          this.setVariable(effect.variable, (this.getVariable(effect.variable, 0)) + (effect.value || 1));
          break;
        case 'decrement':
          this.setVariable(effect.variable, (this.getVariable(effect.variable, 0)) - (effect.value || 1));
          break;
        case 'addItem':
          this.eventBus.emit('inventory:addItem', { itemId: effect.itemId, quantity: effect.quantity || 1 });
          break;
        case 'removeItem':
          this.eventBus.emit('inventory:removeItem', { itemId: effect.itemId, quantity: effect.quantity || 1 });
          break;
        case 'addExperience':
          this.eventBus.emit('player:addExperience', { amount: effect.amount });
          break;
        case 'startQuest':
          this.eventBus.emit('quest:start', { questId: effect.questId });
          break;
        case 'completeObjective':
          this.eventBus.emit('quest:completeObjective', { questId: effect.questId, objectiveId: effect.objectiveId });
          break;
        case 'changeReputation':
          this.setVariable(`reputation_${effect.faction}`, (this.getVariable(`reputation_${effect.faction}`, 0)) + effect.amount);
          break;
        case 'teleport':
          this.eventBus.emit('player:teleport', { locationId: effect.locationId, x: effect.x, y: effect.y });
          break;
        case 'playAnimation':
          this.eventBus.emit('animation:play', { entityId: effect.entityId, clip: effect.clip });
          break;
        case 'playSFX':
          this.eventBus.emit('audio:playSFX', { key: effect.sound });
          break;
        case 'custom':
          if (effect.callback) effect.callback(this);
          break;
      }
    }
  }

  // ─── UI Creation ──────────────────────────────────────────────────

  createDialogueUI() {
    const cfg = this.uiConfig;

    this.container = this.scene.add.container(0, 0).setDepth(9000).setScrollFactor(0);

    // Darkened overlay
    this.overlay = this.scene.add.rectangle(
      GameConfig.WIDTH / 2, GameConfig.HEIGHT / 2,
      GameConfig.WIDTH, GameConfig.HEIGHT,
      0x000000, 0.3
    );
    this.container.add(this.overlay);

    // Dialogue box background
    this.dialogueBox = this.scene.add.graphics();
    this.dialogueBox.fillStyle(cfg.bgColor, cfg.bgAlpha);
    this.dialogueBox.fillRoundedRect(cfg.boxX, cfg.boxY, cfg.boxWidth, cfg.boxHeight, 8);
    this.dialogueBox.lineStyle(2, cfg.borderColor, 1);
    this.dialogueBox.strokeRoundedRect(cfg.boxX, cfg.boxY, cfg.boxWidth, cfg.boxHeight, 8);
    this.container.add(this.dialogueBox);

    // Portrait placeholder
    this.portraitBg = this.scene.add.rectangle(
      cfg.boxX + cfg.padding + cfg.portraitSize / 2,
      cfg.boxY + cfg.boxHeight / 2,
      cfg.portraitSize, cfg.portraitSize,
      0x333355, 0.8
    );
    this.container.add(this.portraitBg);
    this.portraitBg.setVisible(false);

    // Character name
    const textX = cfg.boxX + cfg.padding;
    this.nameText = this.scene.add.text(textX, cfg.boxY + cfg.padding, '', {
      fontSize: cfg.nameFontSize,
      fill: cfg.nameColor,
      fontFamily: cfg.fontFamily,
      fontStyle: 'bold'
    });
    this.container.add(this.nameText);

    // Dialogue body text
    const textWidth = cfg.boxWidth - cfg.padding * 2;
    this.bodyText = this.scene.add.text(textX, cfg.boxY + cfg.padding + 28, '', {
      fontSize: cfg.fontSize,
      fill: cfg.textColor,
      fontFamily: cfg.fontFamily,
      wordWrap: { width: textWidth }
    });
    this.container.add(this.bodyText);

    // Continue indicator
    this.continueIndicator = this.scene.add.text(
      cfg.boxX + cfg.boxWidth - cfg.padding,
      cfg.boxY + cfg.boxHeight - cfg.padding,
      '[ Press Space ]',
      { fontSize: '12px', fill: '#888888', fontFamily: cfg.fontFamily }
    ).setOrigin(1, 1);
    this.continueIndicator.setVisible(false);
    this.container.add(this.continueIndicator);

    // Pulse animation on continue indicator
    this.scene.tweens.add({
      targets: this.continueIndicator,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Input handling
    this.scene.input.on('pointerdown', () => this.advanceDialogue());
    this.spaceKey = this.scene.input.keyboard.addKey('SPACE');
    this.spaceKey.on('down', () => this.advanceDialogue());

    // Number keys for choices
    this.choiceKeys = [];
    for (let i = 1; i <= 4; i++) {
      const key = this.scene.input.keyboard.addKey(String(i));
      key.on('down', () => this.selectChoice(i - 1));
      this.choiceKeys.push(key);
    }
  }

  updateDialogueUI(node, character) {
    // Clear choices
    this.clearChoices();
    this.continueIndicator?.setVisible(false);

    // Update name
    if (character) {
      this.nameText.setText(character.name);
      this.nameText.setColor(character.nameColor || this.uiConfig.nameColor);
    } else if (node.speaker) {
      this.nameText.setText(node.speaker);
      this.nameText.setColor(this.uiConfig.nameColor);
    } else {
      this.nameText.setText('');
    }

    // Update portrait
    const showPortrait = character && character.portraits[node.emotion || 'neutral'];
    if (showPortrait) {
      this.portraitBg.setVisible(true);
      // If the portrait texture exists, show it
      const portraitKey = character.portraits[node.emotion || 'neutral'];
      if (this.scene.textures.exists(portraitKey)) {
        if (this.portraitImage) this.portraitImage.destroy();
        this.portraitImage = this.scene.add.sprite(
          this.portraitBg.x, this.portraitBg.y,
          portraitKey
        ).setDisplaySize(this.uiConfig.portraitSize - 8, this.uiConfig.portraitSize - 8);
        this.container.add(this.portraitImage);
      }

      // Shift text to account for portrait
      const textX = this.uiConfig.boxX + this.uiConfig.padding + this.uiConfig.portraitSize + 15;
      this.nameText.setX(textX);
      this.bodyText.setX(textX);
      this.bodyText.setWordWrapWidth(this.uiConfig.boxWidth - this.uiConfig.padding * 2 - this.uiConfig.portraitSize - 15);
    } else {
      this.portraitBg.setVisible(false);
      if (this.portraitImage) {
        this.portraitImage.destroy();
        this.portraitImage = null;
      }
      const textX = this.uiConfig.boxX + this.uiConfig.padding;
      this.nameText.setX(textX);
      this.bodyText.setX(textX);
      this.bodyText.setWordWrapWidth(this.uiConfig.boxWidth - this.uiConfig.padding * 2);
    }
  }

  showChoices(choices) {
    this.clearChoices();

    const cfg = this.uiConfig;
    const startY = cfg.boxY - 10;

    const availableChoices = choices.filter(choice => {
      if (choice.conditions) return this.evaluateConditions(choice.conditions);
      return true;
    });

    for (let i = 0; i < availableChoices.length; i++) {
      const choice = availableChoices[i];
      const y = startY - (availableChoices.length - i) * 36;

      // Choice background
      const bg = this.scene.add.graphics();
      bg.fillStyle(cfg.bgColor, 0.9);
      bg.fillRoundedRect(cfg.boxX + 20, y - 12, cfg.boxWidth - 40, 32, 4);
      bg.lineStyle(1, cfg.borderColor, 0.6);
      bg.strokeRoundedRect(cfg.boxX + 20, y - 12, cfg.boxWidth - 40, 32, 4);
      this.container.add(bg);

      // Choice text
      const text = this.scene.add.text(
        cfg.boxX + 50, y,
        `${i + 1}. ${choice.text}`,
        {
          fontSize: '14px',
          fill: cfg.choiceColor,
          fontFamily: cfg.fontFamily
        }
      ).setOrigin(0, 0.5).setInteractive();

      text.on('pointerover', () => text.setColor(cfg.choiceHoverColor));
      text.on('pointerout', () => text.setColor(cfg.choiceColor));
      text.on('pointerdown', () => this.selectChoice(i));
      this.container.add(text);

      this.choiceButtons.push({ bg, text, index: i });
    }
  }

  clearChoices() {
    for (const choice of this.choiceButtons) {
      choice.bg.destroy();
      choice.text.destroy();
    }
    this.choiceButtons = [];
  }

  destroyDialogueUI() {
    this.stopTypewriter();
    this.clearChoices();

    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }

    // Remove input listeners
    this.scene.input.off('pointerdown');
    if (this.spaceKey) {
      this.spaceKey.removeAllListeners();
    }
    for (const key of this.choiceKeys) {
      key.removeAllListeners();
    }

    this.dialogueBox = null;
    this.nameText = null;
    this.bodyText = null;
    this.portraitImage = null;
    this.continueIndicator = null;
  }

  // ─── Serialization ────────────────────────────────────────────────

  saveState() {
    return {
      variables: Object.fromEntries(this.variables),
      history: this.history
    };
  }

  loadState(state) {
    if (state.variables) {
      this.variables = new Map(Object.entries(state.variables));
    }
    if (state.history) {
      this.history = state.history;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────

  isActive() {
    return this.active;
  }

  getHistory() {
    return [...this.history];
  }

  hasVisitedNode(dialogueId, nodeId) {
    return this.history.some(h => h.dialogueId === dialogueId && h.nodeId === nodeId);
  }

  destroy() {
    this.endDialogue();
    this.dialogues.clear();
    this.characters.clear();
    this.variables.clear();
    this.history = [];
    DialogueSystem.instance = null;
  }
}

export default DialogueSystem;
