import { EventBus } from '../core/EventBus.js';
import { DifficultySystem } from './DifficultySystem.js';
import { NarrativeSystem } from './NarrativeSystem.js';

/**
 * AIDungeonMaster - Dynamic AI narration, encounter generation, difficulty
 * adaptation, pacing control, and contextual storytelling.
 *
 * Listens to:
 *   zone-entered, enemy-defeated, player-stats-updated, quest:completed,
 *   spell-cast, phase-changed, player:levelUp, combat:started, combat:ended,
 *   narrative:eraStarted, narrative:eraCompleted, narrative:choiceMade
 *
 * Emits:
 *   dm:narration   - { text, category, priority }
 *   dm:encounter   - { type, enemies, zone, context }
 *   dm:hint        - { text, category }
 *   dm:event       - { type, data }
 */
export class AIDungeonMaster {
  static instance = null;

  static getInstance() {
    if (!AIDungeonMaster.instance) new AIDungeonMaster();
    return AIDungeonMaster.instance;
  }

  constructor() {
    if (AIDungeonMaster.instance) return AIDungeonMaster.instance;

    this.eventBus = EventBus.getInstance();
    this.difficultySystem = DifficultySystem.getInstance();
    this.narrativeSystem = NarrativeSystem.getInstance();

    // ─── Narration Queue ───────────────────────────────────────────
    this.narrationQueue = [];
    this.isProcessingQueue = false;
    this.minNarrationInterval = 3000;  // ms between narrations
    this.lastNarrationTime = 0;
    this.maxQueueSize = 20;

    this.priorities = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    // ─── Player Performance Tracking ───────────────────────────────
    this.playerPerformance = {
      deaths: 0,
      totalDeaths: 0,
      combatsWon: 0,
      combatsLost: 0,
      averageHpAfterCombat: 1.0,   // ratio 0..1
      recentHpRatios: [],          // last N combat HP ratios
      averageCombatRounds: 0,
      recentCombatRounds: [],
      consecutiveDeaths: 0,
      consecutiveVictories: 0,
      spellsCast: 0,
      enemiesDefeated: 0,
      questsCompleted: 0,
      zonesVisited: new Set(),
      lastCombatTime: 0,
      sessionStartTime: Date.now()
    };

    // ─── Adaptive Difficulty State ─────────────────────────────────
    this.adaptiveDifficulty = {
      enabled: true,
      adjustmentFactor: 0,        // -1.0 (easiest) to +1.0 (hardest)
      encounterDensity: 1.0,      // multiplier for encounter frequency
      encounterStrength: 1.0,     // multiplier for encounter enemy levels
      lastAdjustmentTime: 0,
      adjustmentCooldown: 60000   // 1 min between adjustments
    };

    // ─── Pacing State ──────────────────────────────────────────────
    this.pacing = {
      mode: 'exploration',        // exploration | combat | story
      combatsSinceRest: 0,
      timeSinceLastCombat: 0,
      timeSinceLastStoryBeat: 0,
      explorationStreak: 0,       // consecutive exploration time (sec)
      combatFatigue: 0,           // 0..1 how tired of combat
      storyHunger: 0,             // 0..1 how much player needs a story beat
      maxCombatBeforeRest: 3,
      minExplorationBetweenCombats: 30000  // ms
    };

    // ─── Context ───────────────────────────────────────────────────
    this.currentZone = null;
    this.currentPhase = 'crimson';
    this.playerLevel = 1;
    this.playerStats = null;
    this.hintsGiven = new Set();
    this.tutorialComplete = false;
    this.sessionEncounterCount = 0;

    // ─── Mini-event Cooldowns ──────────────────────────────────────
    this.lastMiniEventTime = 0;
    this.miniEventCooldown = 45000; // 45s between mini-events

    // ─── Narrative Templates ───────────────────────────────────────
    this._initTemplates();

    // ─── Event Bindings ────────────────────────────────────────────
    this._bindEvents();

    AIDungeonMaster.instance = this;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NARRATION TEMPLATES
  // ═══════════════════════════════════════════════════════════════════

  _initTemplates() {
    this.templates = {
      zoneEnter: {
        verdant_grove: [
          'The canopy overhead filters sunlight into emerald shafts. Sap-veined roots pulse beneath your feet.',
          'Ancient trees whisper as you step into the Verdant Grove. The air hums with primal energy.',
          'Bioluminescent fungi dot the forest floor, casting pale blue light through the green haze.'
        ],
        crystal_caverns: [
          'Crystalline formations refract the light into dancing rainbows across the cavern walls.',
          'The air grows cool and still. Each footstep echoes through the vast underground chamber.',
          'Veins of raw sap-crystal thread through the stone, pulsing with a heartbeat not your own.'
        ],
        ashen_wastes: [
          'A bitter wind carries ash and the faint scent of sulfur. The ground cracks beneath your boots.',
          'The wasteland stretches endlessly, scorched earth bearing witness to cataclysms long past.',
          'Twisted remnants of what were once great trees claw at the darkened sky.'
        ],
        nexus_spire: [
          'The Nexus Spire looms above, its surface alive with shifting runes and flowing sap-light.',
          'Reality seems thinner here. The boundary between realms grows fragile near the Spire.',
          'Power radiates from the structure in waves you can feel in your bones.'
        ],
        default: [
          'You press onward into unfamiliar territory. The path ahead promises both danger and discovery.',
          'A new landscape unfolds before you, the air thick with possibility.',
          'The terrain shifts as you cross into a new region. Stay alert.'
        ]
      },

      combat: {
        start: [
          'Steel meets sap-corrupted flesh. The fight begins!',
          'Enemies emerge from the shadows. Prepare yourself!',
          'Hostiles block your path. Draw your weapon!'
        ],
        victory: [
          'The last foe falls. Silence reclaims the battlefield.',
          'Victory is yours, though the cost is written in blood and bruises.',
          'The threat is neutralized. For now.'
        ],
        defeat: [
          'Darkness closes in as your strength fails...',
          'The world fades. Perhaps fate will grant another chance.',
          'You fall, but the Sap stirs... death is not always the end in Nexus.'
        ],
        critical: [
          'A devastating blow! The strike lands with surgical precision.',
          'Critical hit! The attack cleaves through defenses like paper.'
        ],
        tough: [
          'This enemy is formidable. Consider your strategy carefully.',
          'A dangerous opponent. Watch for patterns in its attacks.'
        ]
      },

      questMilestone: {
        started: [
          'A new quest unfolds before you. The path forward grows clearer.',
          'Your purpose sharpens. A new objective beckons.'
        ],
        completed: [
          'Quest complete. Your deeds echo through the realm of Nexus.',
          'Another chapter closes. The rewards of perseverance are yours.',
          'The task is done. But every answer in Nexus breeds new questions.'
        ],
        failed: [
          'The opportunity has slipped away. Some paths close forever.',
          'Failure is a harsh teacher, but a teacher nonetheless.'
        ]
      },

      phaseChange: {
        crimson: [
          'The Sap bleeds crimson. Combat intensifies as primal energy surges through the land.',
          'A red tide washes over the world. The Crimson Phase has begun — steel yourself.'
        ],
        silver: [
          'The world exhales. Silver light suffuses the air as the Sap calms into equilibrium.',
          'The Silver Phase dawns — a time of balance, when magic flows true and steady.'
        ],
        blue: [
          'The Sap deepens to azure. Magic amplifies and the veil between realms thins.',
          'Blue light cascades across the horizon. The Blue Phase empowers those who wield the arcane.'
        ]
      },

      npcInteraction: [
        'A figure steps from the shadows, eyes carrying the weight of untold stories.',
        'Someone has words for you. In Nexus, every conversation can alter the course of fate.',
        'An encounter awaits — not all battles are fought with blades.'
      ],

      itemDiscovery: {
        common: [
          'You find something useful amidst the debris.',
          'A modest find, but every advantage counts.'
        ],
        rare: [
          'A rare discovery! This could turn the tide.',
          'Fortune smiles — a valuable item reveals itself.'
        ],
        legendary: [
          'A legendary artifact pulses with ancient power. The Sap itself seems to sing.',
          'An item of myth lies before you. Few in Nexus have ever held such a thing.'
        ]
      },

      deathRespawn: [
        'The Sap surges, pulling you back from the void. You awaken, weakened but alive.',
        'Death is but a pause in Nexus. The cycle restores you, though something feels... different.',
        'You gasp back to consciousness. The realm needs you still — it will not let you rest.'
      ],

      exploration: [
        'The path winds onward. What secrets does this place still hold?',
        'Quiet moments like these are rare in Nexus. Take stock of your surroundings.',
        'The landscape unfolds with each step. Discovery rewards the curious.'
      ],

      levelUp: [
        'Power flows through you as experience crystallizes into strength. You have grown.',
        'A surge of energy — you feel your capabilities expand. Level up!',
        'The Sap recognizes your growth and rewards it. You are more than you were.'
      ]
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EVENT BINDINGS
  // ═══════════════════════════════════════════════════════════════════

  _bindEvents() {
    this.eventBus.on('zone-entered', (data) => this._onZoneEntered(data));
    this.eventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data));
    this.eventBus.on('player-stats-updated', (data) => this._onPlayerStatsUpdated(data));
    this.eventBus.on('quest:completed', (data) => this._onQuestCompleted(data));
    this.eventBus.on('spell-cast', (data) => this._onSpellCast(data));
    this.eventBus.on('phase-changed', (data) => this._onPhaseChanged(data));
    this.eventBus.on('player:levelUp', (data) => this._onLevelUp(data));
    this.eventBus.on('combat:started', (data) => this._onCombatStarted(data));
    this.eventBus.on('combat:ended', (data) => this._onCombatEnded(data));
    this.eventBus.on('narrative:eraStarted', (data) => this._onEraStarted(data));
    this.eventBus.on('narrative:eraCompleted', (data) => this._onEraCompleted(data));
    this.eventBus.on('narrative:choiceMade', (data) => this._onChoiceMade(data));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  _onZoneEntered(data) {
    const zone = data?.zone || data?.zoneId || 'default';
    this.currentZone = zone;
    this.playerPerformance.zonesVisited.add(zone);

    // Zone narration
    const zoneKey = this.templates.zoneEnter[zone] ? zone : 'default';
    const text = this._pickTemplate(this.templates.zoneEnter[zoneKey]);
    this._enqueue(text, 'zone', 'high');

    // Tutorial hint for first zone visit
    if (this.playerPerformance.zonesVisited.size <= 2 && !this.tutorialComplete) {
      this._giveHint('exploration_basics',
        'Explore thoroughly — hidden paths and secret caches are scattered across every zone.',
        'tutorial');
    }

    // Check if we should generate a mini-event
    this._tryMiniEvent(zone);
  }

  _onEnemyDefeated(data) {
    this.playerPerformance.enemiesDefeated++;
  }

  _onPlayerStatsUpdated(data) {
    this.playerStats = data;
    if (data?.level) {
      this.playerLevel = data.level;
    }
  }

  _onQuestCompleted(data) {
    this.playerPerformance.questsCompleted++;
    const text = this._pickTemplate(this.templates.questMilestone.completed);
    this._enqueue(text, 'quest', 'high');

    this.pacing.timeSinceLastStoryBeat = 0;
    this.pacing.storyHunger = 0;
  }

  _onSpellCast(data) {
    this.playerPerformance.spellsCast++;

    // Hint about sap phase synergy on first few spell casts
    if (this.playerPerformance.spellsCast === 3) {
      this._giveHint('phase_synergy',
        'Spells aligned with the current Sap phase deal bonus damage. Watch for phase shifts!',
        'combat');
    }
  }

  _onPhaseChanged(data) {
    const phase = (data?.newPhase || data?.phase || 'crimson').toLowerCase();
    const oldPhase = this.currentPhase;
    this.currentPhase = phase;

    const phaseTemplates = this.templates.phaseChange[phase];
    if (phaseTemplates) {
      const text = this._pickTemplate(phaseTemplates);
      this._enqueue(text, 'phase', 'critical');
    }

    this.eventBus.emit('dm:event', {
      type: 'phaseTransition',
      data: { from: oldPhase, to: phase }
    });
  }

  _onLevelUp(data) {
    const text = this._pickTemplate(this.templates.levelUp);
    this._enqueue(text, 'levelUp', 'high');

    // Recalculate adaptive difficulty on level up
    this._adjustAdaptiveDifficulty();
  }

  _onCombatStarted(data) {
    this.pacing.mode = 'combat';
    this.playerPerformance.lastCombatTime = Date.now();

    const enemies = data?.enemies || [];
    const enemyCount = enemies.length;

    // Combat start narration
    const text = this._pickTemplate(this.templates.combat.start);
    this._enqueue(text, 'combat', 'normal');

    // Hint for tough fights
    if (enemyCount >= 3 && this.playerPerformance.combatsWon < 5) {
      this._giveHint('multiple_enemies',
        'Facing multiple foes? Focus fire on one enemy at a time to thin their ranks quickly.',
        'combat');
    }
  }

  _onCombatEnded(data) {
    const result = data?.result;
    const rounds = data?.rounds || 0;

    this.pacing.mode = 'exploration';
    this.pacing.combatsSinceRest++;
    this.pacing.timeSinceLastCombat = 0;

    if (result === 'victory') {
      this.playerPerformance.combatsWon++;
      this.playerPerformance.consecutiveVictories++;
      this.playerPerformance.consecutiveDeaths = 0;

      // Track HP after combat
      const hpRatio = this._estimateHpRatio(data);
      this.playerPerformance.recentHpRatios.push(hpRatio);
      if (this.playerPerformance.recentHpRatios.length > 10) {
        this.playerPerformance.recentHpRatios.shift();
      }
      this.playerPerformance.averageHpAfterCombat = this._average(
        this.playerPerformance.recentHpRatios
      );

      // Track rounds
      this.playerPerformance.recentCombatRounds.push(rounds);
      if (this.playerPerformance.recentCombatRounds.length > 10) {
        this.playerPerformance.recentCombatRounds.shift();
      }
      this.playerPerformance.averageCombatRounds = this._average(
        this.playerPerformance.recentCombatRounds
      );

      const text = this._pickTemplate(this.templates.combat.victory);
      this._enqueue(text, 'combat', 'normal');

      // Pacing: suggest rest if too many combats
      if (this.pacing.combatsSinceRest >= this.pacing.maxCombatBeforeRest) {
        this._giveHint('rest_suggestion',
          'You have fought many battles in succession. Seek a safe haven to rest and recover.',
          'pacing');
      }
    } else if (result === 'defeat') {
      this.playerPerformance.deaths++;
      this.playerPerformance.totalDeaths++;
      this.playerPerformance.consecutiveDeaths++;
      this.playerPerformance.consecutiveVictories = 0;
      this.playerPerformance.combatsLost++;

      const text = this._pickTemplate(this.templates.deathRespawn);
      this._enqueue(text, 'death', 'critical');

      // Difficulty hint after repeated deaths
      if (this.playerPerformance.consecutiveDeaths >= 2) {
        this._giveHint('difficulty_suggestion',
          'Struggling with the difficulty? You can adjust it in the settings menu, or try leveling up in a safer zone.',
          'combat');
      }
    }

    // Adjust adaptive difficulty after every combat
    this._adjustAdaptiveDifficulty();
  }

  _onEraStarted(data) {
    const eraName = data?.eraName || 'a new era';
    this._enqueue(
      `A new era dawns — ${eraName}. The fate of Nexus shifts once more.`,
      'story', 'critical'
    );
    this.pacing.timeSinceLastStoryBeat = 0;
  }

  _onEraCompleted(data) {
    const eraName = data?.eraName || 'the era';
    this._enqueue(
      `The age of ${eraName} draws to a close. The choices you have made will echo through time.`,
      'story', 'critical'
    );
  }

  _onChoiceMade(data) {
    const choiceName = data?.choiceName || 'a fateful decision';
    this._enqueue(
      `Your decision at ${choiceName} ripples outward. In Nexus, every choice carries weight.`,
      'story', 'high'
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NARRATION QUEUE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enqueue a narration message with a priority level.
   * @param {string} text
   * @param {string} category - zone|combat|quest|phase|story|death|levelUp|hint|event
   * @param {string} priority - critical|high|normal|low
   */
  _enqueue(text, category, priority = 'normal') {
    if (!text) return;

    // Drop low-priority messages if queue is full
    if (this.narrationQueue.length >= this.maxQueueSize) {
      const lowestIdx = this.narrationQueue.findIndex(
        n => n.priorityValue === this.priorities.low
      );
      if (lowestIdx !== -1) {
        this.narrationQueue.splice(lowestIdx, 1);
      } else {
        return; // Queue is full of important messages, drop this one
      }
    }

    const entry = {
      text,
      category,
      priority,
      priorityValue: this.priorities[priority] || this.priorities.normal,
      timestamp: Date.now()
    };

    this.narrationQueue.push(entry);

    // Sort by priority descending, then by timestamp ascending
    this.narrationQueue.sort((a, b) => {
      if (b.priorityValue !== a.priorityValue) return b.priorityValue - a.priorityValue;
      return a.timestamp - b.timestamp;
    });

    this._processQueue();
  }

  /**
   * Process the narration queue, respecting rate limits.
   */
  _processQueue() {
    if (this.isProcessingQueue || this.narrationQueue.length === 0) return;

    const now = Date.now();
    const elapsed = now - this.lastNarrationTime;

    if (elapsed < this.minNarrationInterval) {
      // Schedule processing after the remaining cooldown
      const remaining = this.minNarrationInterval - elapsed;
      setTimeout(() => this._processQueue(), remaining);
      return;
    }

    this.isProcessingQueue = true;

    const entry = this.narrationQueue.shift();
    if (entry) {
      this.lastNarrationTime = Date.now();

      this.eventBus.emit('dm:narration', {
        text: entry.text,
        category: entry.category,
        priority: entry.priority
      });
    }

    this.isProcessingQueue = false;

    // Continue processing if more items
    if (this.narrationQueue.length > 0) {
      setTimeout(() => this._processQueue(), this.minNarrationInterval);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADAPTIVE DIFFICULTY
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Analyze player performance and adjust encounter parameters.
   */
  _adjustAdaptiveDifficulty() {
    if (!this.adaptiveDifficulty.enabled) return;

    const now = Date.now();
    if (now - this.adaptiveDifficulty.lastAdjustmentTime < this.adaptiveDifficulty.adjustmentCooldown) {
      return;
    }
    this.adaptiveDifficulty.lastAdjustmentTime = now;

    const perf = this.playerPerformance;
    let adjustment = 0;

    // Deaths pull difficulty down
    if (perf.consecutiveDeaths >= 3) {
      adjustment -= 0.3;
    } else if (perf.consecutiveDeaths >= 2) {
      adjustment -= 0.2;
    } else if (perf.consecutiveDeaths >= 1) {
      adjustment -= 0.1;
    }

    // Consistent victories push difficulty up
    if (perf.consecutiveVictories >= 5) {
      adjustment += 0.2;
    } else if (perf.consecutiveVictories >= 3) {
      adjustment += 0.1;
    }

    // Low HP after combat = player is struggling
    if (perf.averageHpAfterCombat < 0.2 && perf.recentHpRatios.length >= 3) {
      adjustment -= 0.15;
    } else if (perf.averageHpAfterCombat > 0.8 && perf.recentHpRatios.length >= 3) {
      adjustment += 0.1;
    }

    // Long combats mean enemies are too tanky or player is underpowered
    if (perf.averageCombatRounds > 8 && perf.recentCombatRounds.length >= 3) {
      adjustment -= 0.1;
    }

    // Apply with smoothing
    this.adaptiveDifficulty.adjustmentFactor = this._clamp(
      this.adaptiveDifficulty.adjustmentFactor + adjustment * 0.5,
      -1.0, 1.0
    );

    // Map adjustment factor to encounter parameters
    const factor = this.adaptiveDifficulty.adjustmentFactor;
    this.adaptiveDifficulty.encounterStrength = 1.0 + factor * 0.3;
    this.adaptiveDifficulty.encounterDensity = 1.0 + factor * 0.2;

    this.eventBus.emit('dm:event', {
      type: 'difficultyAdjusted',
      data: {
        adjustmentFactor: this.adaptiveDifficulty.adjustmentFactor,
        encounterStrength: this.adaptiveDifficulty.encounterStrength,
        encounterDensity: this.adaptiveDifficulty.encounterDensity
      }
    });
  }

  /**
   * Get current adaptive modifiers to be applied to encounters.
   * Combines base DifficultySystem modifiers with adaptive adjustments.
   */
  getEncounterModifiers() {
    const base = this.difficultySystem.getModifiers();
    const adaptive = this.adaptiveDifficulty;

    return {
      ...base,
      enemyHealthMultiplier: base.enemyHealthMultiplier * adaptive.encounterStrength,
      enemyDamageMultiplier: base.enemyDamageMultiplier * adaptive.encounterStrength,
      encounterDensity: adaptive.encounterDensity,
      adaptiveAdjustment: adaptive.adjustmentFactor
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DYNAMIC ENCOUNTER GENERATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Attempt to generate a contextual encounter.
   * Called periodically or on zone transitions.
   * @param {string} zone
   * @param {object} options - { forceType, playerPosition }
   * @returns {object|null} Generated encounter data or null
   */
  generateEncounter(zone, options = {}) {
    const pacing = this._evaluatePacing();
    if (pacing === 'rest' && !options.forceType) return null;

    const era = this.narrativeSystem.getCurrentEra();
    const eraNumber = era?.eraNumber || 1;
    const modifiers = this.getEncounterModifiers();

    // Determine encounter type
    const encounterType = options.forceType || this._selectEncounterType(zone, pacing);

    const encounter = {
      type: encounterType,
      zone,
      phase: this.currentPhase,
      playerLevel: this.playerLevel,
      eraNumber,
      modifiers,
      enemies: [],
      context: {}
    };

    switch (encounterType) {
      case 'combat':
        encounter.enemies = this._generateCombatEncounter(zone, modifiers);
        encounter.context.description = this._getCombatEncounterNarration(zone);
        break;

      case 'ambush':
        encounter.enemies = this._generateCombatEncounter(zone, modifiers);
        encounter.context.description = `Ambush! Enemies spring from concealment, catching you off guard.`;
        encounter.context.ambush = true;
        encounter.context.surpriseRound = true;
        break;

      case 'wounded_npc':
        encounter.context = this._generateWoundedNPCEvent(zone);
        break;

      case 'cache':
        encounter.context = this._generateCacheEvent(zone);
        break;

      case 'environmental_hazard':
        encounter.context = this._generateHazardEvent(zone);
        break;

      case 'lore':
        encounter.context = this._generateLoreEvent(zone);
        break;

      default:
        return null;
    }

    this.sessionEncounterCount++;

    this.eventBus.emit('dm:encounter', encounter);
    return encounter;
  }

  /**
   * Select an encounter type based on zone, pacing, and randomness.
   */
  _selectEncounterType(zone, pacing) {
    const weights = {
      combat: 35,
      ambush: 10,
      wounded_npc: 15,
      cache: 15,
      environmental_hazard: 10,
      lore: 15
    };

    // Modify weights based on pacing
    if (pacing === 'action') {
      weights.combat += 20;
      weights.ambush += 10;
      weights.cache -= 5;
      weights.lore -= 10;
    } else if (pacing === 'exploration') {
      weights.combat -= 15;
      weights.ambush -= 5;
      weights.cache += 10;
      weights.lore += 10;
      weights.wounded_npc += 10;
    }

    // Phase modifiers
    if (this.currentPhase === 'crimson') {
      weights.combat += 10;
      weights.ambush += 5;
    } else if (this.currentPhase === 'blue') {
      weights.lore += 10;
      weights.environmental_hazard += 5;
    }

    return this._weightedRandom(weights);
  }

  /**
   * Generate enemy data for a combat encounter.
   */
  _generateCombatEncounter(zone, modifiers) {
    const baseLevel = this.playerLevel;
    const levelVariance = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
    const enemyLevel = Math.max(1, baseLevel + levelVariance);

    // Enemy count based on adaptive difficulty
    const baseCount = 1 + Math.floor(Math.random() * 3); // 1-3
    const adjustedCount = Math.max(1, Math.round(baseCount * modifiers.encounterDensity));

    const zoneEnemies = this._getZoneEnemyPool(zone);
    const enemies = [];

    for (let i = 0; i < adjustedCount; i++) {
      const template = zoneEnemies[Math.floor(Math.random() * zoneEnemies.length)];
      enemies.push({
        ...template,
        level: enemyLevel,
        stats: {
          hp: Math.round(template.baseHp * (1 + (enemyLevel - 1) * 0.15) * modifiers.enemyHealthMultiplier),
          maxHp: Math.round(template.baseHp * (1 + (enemyLevel - 1) * 0.15) * modifiers.enemyHealthMultiplier),
          atk: Math.round(template.baseAtk * (1 + (enemyLevel - 1) * 0.1) * modifiers.enemyDamageMultiplier),
          def: Math.round(template.baseDef * (1 + (enemyLevel - 1) * 0.1)),
          agi: template.baseAgi + Math.floor(enemyLevel * 0.5)
        }
      });
    }

    return enemies;
  }

  /**
   * Get the enemy pool for a given zone.
   */
  _getZoneEnemyPool(zone) {
    const pools = {
      verdant_grove: [
        { id: 'sap_wraith', name: 'Sap Wraith', baseHp: 40, baseAtk: 8, baseDef: 3, baseAgi: 10 },
        { id: 'thorn_crawler', name: 'Thorn Crawler', baseHp: 55, baseAtk: 10, baseDef: 5, baseAgi: 6 },
        { id: 'corrupted_sprite', name: 'Corrupted Sprite', baseHp: 25, baseAtk: 12, baseDef: 2, baseAgi: 14 }
      ],
      crystal_caverns: [
        { id: 'crystal_golem', name: 'Crystal Golem', baseHp: 80, baseAtk: 14, baseDef: 10, baseAgi: 3 },
        { id: 'echo_bat', name: 'Echo Bat', baseHp: 20, baseAtk: 7, baseDef: 2, baseAgi: 16 },
        { id: 'shard_beetle', name: 'Shard Beetle', baseHp: 45, baseAtk: 11, baseDef: 8, baseAgi: 8 }
      ],
      ashen_wastes: [
        { id: 'ash_revenant', name: 'Ash Revenant', baseHp: 60, baseAtk: 15, baseDef: 6, baseAgi: 9 },
        { id: 'ember_hound', name: 'Ember Hound', baseHp: 35, baseAtk: 13, baseDef: 4, baseAgi: 13 },
        { id: 'cinder_elemental', name: 'Cinder Elemental', baseHp: 70, baseAtk: 16, baseDef: 7, baseAgi: 5 }
      ],
      nexus_spire: [
        { id: 'void_sentinel', name: 'Void Sentinel', baseHp: 100, baseAtk: 18, baseDef: 12, baseAgi: 7 },
        { id: 'nexus_phantom', name: 'Nexus Phantom', baseHp: 50, baseAtk: 20, baseDef: 5, baseAgi: 15 },
        { id: 'reality_shard', name: 'Reality Shard', baseHp: 65, baseAtk: 14, baseDef: 14, baseAgi: 10 }
      ]
    };

    return pools[zone] || pools.verdant_grove;
  }

  _getCombatEncounterNarration(zone) {
    const narrations = {
      verdant_grove: 'Corrupted creatures stir from beneath the roots, eyes gleaming with malice.',
      crystal_caverns: 'The crystals fracture and reform — shapes emerge from the living stone.',
      ashen_wastes: 'From the ash and smoke, hostile forms coalesce before you.',
      nexus_spire: 'Reality tears open and entities from between the realms spill forth.'
    };
    return narrations[zone] || 'Enemies materialize from the shadows ahead.';
  }

  // ─── Mini-event Generators ─────────────────────────────────────────

  _generateWoundedNPCEvent(zone) {
    const npcs = [
      { name: 'a wounded traveler', dialogue: 'Please... I was attacked on the road. Do you have any healing herbs?' },
      { name: 'a fallen scout', dialogue: 'The enemy is stronger than we thought. I have information if you can help me.' },
      { name: 'a lost merchant', dialogue: 'My caravan was overrun. I can offer you a discount if you escort me to safety.' }
    ];
    const npc = npcs[Math.floor(Math.random() * npcs.length)];

    return {
      description: `You come across ${npc.name}, slumped against the terrain.`,
      npc,
      type: 'wounded_npc',
      choices: ['help', 'ignore', 'investigate'],
      rewards: { help: 'reputation_and_item', investigate: 'information' }
    };
  }

  _generateCacheEvent(zone) {
    const caches = [
      { description: 'A hidden supply cache, partially buried and covered in moss.', lootTier: 'common' },
      { description: 'A sealed chest bearing the mark of a forgotten faction.', lootTier: 'rare' },
      { description: 'Glowing sap-crystal formations surround a natural deposit of resources.', lootTier: 'common' }
    ];
    const cache = caches[Math.floor(Math.random() * caches.length)];

    return {
      ...cache,
      type: 'cache',
      zone,
      trapped: Math.random() < 0.2
    };
  }

  _generateHazardEvent(zone) {
    const hazards = {
      verdant_grove: [
        { description: 'Toxic pollen fills the air in a thick cloud.', effect: 'poison', damage: 5 },
        { description: 'Thorny vines writhe across the path, grasping at your legs.', effect: 'slow', damage: 3 }
      ],
      crystal_caverns: [
        { description: 'A resonance cascade builds — the crystals are about to shatter!', effect: 'shatter', damage: 10 },
        { description: 'The ground gives way to a sinkhole of loose crystal shards.', effect: 'fall', damage: 8 }
      ],
      ashen_wastes: [
        { description: 'A geyser of superheated ash erupts from the cracked earth.', effect: 'burn', damage: 12 },
        { description: 'The air shimmers with heat mirages — navigation becomes treacherous.', effect: 'confusion', damage: 0 }
      ],
      nexus_spire: [
        { description: 'A pocket of unstable reality warps the space around you.', effect: 'warp', damage: 7 },
        { description: 'Raw sap energy discharges in a violent arc.', effect: 'shock', damage: 15 }
      ]
    };

    const zoneHazards = hazards[zone] || hazards.verdant_grove;
    const hazard = zoneHazards[Math.floor(Math.random() * zoneHazards.length)];

    return {
      ...hazard,
      type: 'environmental_hazard',
      zone,
      avoidable: Math.random() < 0.6
    };
  }

  _generateLoreEvent(zone) {
    const lore = {
      verdant_grove: [
        'You find ancient carvings on a tree trunk — a record of the First Sap Awakening.',
        'A stone tablet half-buried in roots tells of the Veilkeepers who once guarded this grove.'
      ],
      crystal_caverns: [
        'Crystal formations contain frozen images — memories of the realm preserved in mineral.',
        'Echoes of ancient voices bounce off the cavern walls, speaking of the Nexus before the fracture.'
      ],
      ashen_wastes: [
        'A charred monument bears an inscription: "Here fell the Silver Kingdom."',
        'Beneath the ash, you find remnants of a civilization that once thrived in this desolation.'
      ],
      nexus_spire: [
        'Runes etched into the Spire pulse with meaning you can almost grasp — knowledge of the creators.',
        'A holographic projection flickers to life, showing a map of realms connected by the Nexus.'
      ]
    };

    const zoneLore = lore[zone] || lore.verdant_grove;
    const snippet = zoneLore[Math.floor(Math.random() * zoneLore.length)];

    return {
      description: snippet,
      type: 'lore',
      zone
    };
  }

  /**
   * Attempt to trigger a mini-event during exploration.
   */
  _tryMiniEvent(zone) {
    const now = Date.now();
    if (now - this.lastMiniEventTime < this.miniEventCooldown) return;

    // Base chance of 25%, modified by pacing
    let chance = 0.25;
    if (this.pacing.explorationStreak > 60) chance += 0.15;
    if (this.pacing.storyHunger > 0.5) chance += 0.1;

    if (Math.random() < chance) {
      this.lastMiniEventTime = now;
      this.generateEncounter(zone);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CONTEXTUAL TIPS & HINTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Provide a hint if it hasn't been given before.
   * @param {string} hintId - Unique ID to prevent duplicates
   * @param {string} text
   * @param {string} category - tutorial|combat|exploration|pacing
   */
  _giveHint(hintId, text, category = 'general') {
    if (this.hintsGiven.has(hintId)) return;
    this.hintsGiven.add(hintId);

    this._enqueue(text, 'hint', 'low');

    this.eventBus.emit('dm:hint', { text, category, hintId });
  }

  /**
   * Get a combat tip based on current combat context.
   * @param {object} combatState - { enemyCount, playerHpRatio, round, phase }
   * @returns {string|null}
   */
  getCombatTip(combatState = {}) {
    const tips = [];

    if (combatState.playerHpRatio !== undefined && combatState.playerHpRatio < 0.3) {
      tips.push('Your health is critical! Use a healing item or retreat if possible.');
    }

    if (combatState.round > 5) {
      tips.push('This fight is dragging on. Consider using your strongest abilities to finish it.');
    }

    if (combatState.enemyCount >= 3) {
      tips.push('Use area-of-effect spells to deal with groups efficiently.');
    }

    if (this.currentPhase === 'crimson') {
      tips.push('The Crimson Phase boosts physical damage — lean into melee attacks.');
    } else if (this.currentPhase === 'blue') {
      tips.push('The Blue Phase amplifies magic — your spells will hit harder now.');
    }

    if (tips.length === 0) return null;
    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Get a lore snippet relevant to the current context.
   * @returns {string|null}
   */
  getLoreSnippet() {
    if (!this.currentZone) return null;

    const event = this._generateLoreEvent(this.currentZone);
    return event.description;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PACING CONTROL
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Evaluate current pacing state and return a recommendation.
   * @returns {string} 'action' | 'exploration' | 'story' | 'rest'
   */
  _evaluatePacing() {
    const p = this.pacing;

    // Force rest after too many consecutive combats
    if (p.combatsSinceRest >= p.maxCombatBeforeRest) {
      return 'rest';
    }

    // Too soon after last combat — encourage exploration
    if (p.timeSinceLastCombat < p.minExplorationBetweenCombats) {
      return 'exploration';
    }

    // Player has been exploring for a while — time for action
    if (p.combatFatigue < 0.3 && p.explorationStreak > 90) {
      return 'action';
    }

    // Story hunger building up
    if (p.storyHunger > 0.7) {
      return 'story';
    }

    // Default to exploration
    return 'exploration';
  }

  /**
   * Get the current pacing recommendation.
   * @returns {object} { mode, combatFatigue, storyHunger, recommendation }
   */
  getPacingState() {
    const recommendation = this._evaluatePacing();
    return {
      mode: this.pacing.mode,
      combatFatigue: this.pacing.combatFatigue,
      storyHunger: this.pacing.storyHunger,
      combatsSinceRest: this.pacing.combatsSinceRest,
      recommendation
    };
  }

  /**
   * Reset combat fatigue (called when player rests or heals at a safe point).
   */
  resetCombatFatigue() {
    this.pacing.combatsSinceRest = 0;
    this.pacing.combatFatigue = 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UPDATE LOOP
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Frame update. Called from the game loop.
   * @param {number} delta - ms since last frame
   */
  update(delta) {
    const dt = delta / 1000; // seconds

    // Update pacing timers
    this.pacing.timeSinceLastCombat += delta;
    this.pacing.timeSinceLastStoryBeat += delta;

    if (this.pacing.mode === 'exploration') {
      this.pacing.explorationStreak += dt;
    } else {
      this.pacing.explorationStreak = 0;
    }

    // Decay combat fatigue over time during exploration
    if (this.pacing.mode === 'exploration') {
      this.pacing.combatFatigue = Math.max(0, this.pacing.combatFatigue - dt * 0.01);
    }

    // Build story hunger over time
    this.pacing.storyHunger = Math.min(1, this.pacing.storyHunger + dt * 0.002);

    // Periodic exploration narration (every ~90 seconds of exploration)
    if (this.pacing.explorationStreak > 90 && this.pacing.mode === 'exploration') {
      const text = this._pickTemplate(this.templates.exploration);
      this._enqueue(text, 'exploration', 'low');
      this.pacing.explorationStreak = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Manually trigger a narration from external systems.
   * @param {string} text
   * @param {string} category
   * @param {string} priority
   */
  narrate(text, category = 'general', priority = 'normal') {
    this._enqueue(text, category, priority);
  }

  /**
   * Trigger an item discovery narration.
   * @param {object} item - { name, rarity }
   */
  onItemDiscovered(item) {
    const rarity = item?.rarity || 'common';
    const tierTemplates = this.templates.itemDiscovery[rarity] || this.templates.itemDiscovery.common;
    const text = this._pickTemplate(tierTemplates);
    const priority = rarity === 'legendary' ? 'high' : (rarity === 'rare' ? 'normal' : 'low');
    this._enqueue(`${text} Acquired: ${item?.name || 'an item'}.`, 'item', priority);
  }

  /**
   * Trigger an NPC interaction narration.
   */
  onNPCInteraction(npcData) {
    const text = this._pickTemplate(this.templates.npcInteraction);
    this._enqueue(text, 'npc', 'normal');
  }

  /**
   * Get the player performance summary (for debug/UI).
   */
  getPerformanceSummary() {
    const perf = this.playerPerformance;
    return {
      deaths: perf.totalDeaths,
      combatsWon: perf.combatsWon,
      combatsLost: perf.combatsLost,
      winRate: perf.combatsWon + perf.combatsLost > 0
        ? perf.combatsWon / (perf.combatsWon + perf.combatsLost)
        : 0,
      averageHpAfterCombat: perf.averageHpAfterCombat,
      averageCombatRounds: perf.averageCombatRounds,
      enemiesDefeated: perf.enemiesDefeated,
      questsCompleted: perf.questsCompleted,
      zonesVisited: perf.zonesVisited.size,
      adaptiveDifficulty: this.adaptiveDifficulty.adjustmentFactor
    };
  }

  /**
   * Enable or disable adaptive difficulty.
   */
  setAdaptiveDifficulty(enabled) {
    this.adaptiveDifficulty.enabled = enabled;
  }

  /**
   * Mark the tutorial as complete (stops tutorial hints).
   */
  completeTutorial() {
    this.tutorialComplete = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SERIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  serialize() {
    return {
      playerPerformance: {
        totalDeaths: this.playerPerformance.totalDeaths,
        combatsWon: this.playerPerformance.combatsWon,
        combatsLost: this.playerPerformance.combatsLost,
        enemiesDefeated: this.playerPerformance.enemiesDefeated,
        questsCompleted: this.playerPerformance.questsCompleted,
        zonesVisited: [...this.playerPerformance.zonesVisited],
        spellsCast: this.playerPerformance.spellsCast
      },
      adaptiveDifficulty: {
        enabled: this.adaptiveDifficulty.enabled,
        adjustmentFactor: this.adaptiveDifficulty.adjustmentFactor
      },
      currentZone: this.currentZone,
      currentPhase: this.currentPhase,
      playerLevel: this.playerLevel,
      hintsGiven: [...this.hintsGiven],
      tutorialComplete: this.tutorialComplete,
      sessionEncounterCount: this.sessionEncounterCount
    };
  }

  deserialize(data) {
    if (!data) return;

    if (data.playerPerformance) {
      const p = data.playerPerformance;
      this.playerPerformance.totalDeaths = p.totalDeaths || 0;
      this.playerPerformance.combatsWon = p.combatsWon || 0;
      this.playerPerformance.combatsLost = p.combatsLost || 0;
      this.playerPerformance.enemiesDefeated = p.enemiesDefeated || 0;
      this.playerPerformance.questsCompleted = p.questsCompleted || 0;
      this.playerPerformance.zonesVisited = new Set(p.zonesVisited || []);
      this.playerPerformance.spellsCast = p.spellsCast || 0;
    }

    if (data.adaptiveDifficulty) {
      this.adaptiveDifficulty.enabled = data.adaptiveDifficulty.enabled ?? true;
      this.adaptiveDifficulty.adjustmentFactor = data.adaptiveDifficulty.adjustmentFactor || 0;
      // Recalculate derived values
      const factor = this.adaptiveDifficulty.adjustmentFactor;
      this.adaptiveDifficulty.encounterStrength = 1.0 + factor * 0.3;
      this.adaptiveDifficulty.encounterDensity = 1.0 + factor * 0.2;
    }

    this.currentZone = data.currentZone || null;
    this.currentPhase = data.currentPhase || 'crimson';
    this.playerLevel = data.playerLevel || 1;
    this.hintsGiven = new Set(data.hintsGiven || []);
    this.tutorialComplete = data.tutorialComplete || false;
    this.sessionEncounterCount = data.sessionEncounterCount || 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Pick a random template from an array.
   */
  _pickTemplate(templates) {
    if (!templates || templates.length === 0) return '';
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Weighted random selection from an object { key: weight }.
   * @returns {string} The selected key
   */
  _weightedRandom(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) return entries[0]?.[0] || null;

    let roll = Math.random() * total;
    for (const [key, weight] of entries) {
      if (weight <= 0) continue;
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * Clamp a value between min and max.
   */
  _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Compute the average of a numeric array.
   */
  _average(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  }

  /**
   * Estimate HP ratio from combat end data.
   */
  _estimateHpRatio(combatData) {
    if (this.playerStats?.hp !== undefined && this.playerStats?.maxHp) {
      return this.playerStats.hp / this.playerStats.maxHp;
    }
    // Fallback estimate
    return 0.5;
  }
}

export default AIDungeonMaster;
