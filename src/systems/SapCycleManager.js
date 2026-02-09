// src/systems/SapCycleManager.js
// Core Sap Cycle calendar system for Verdance
// 3-phase cycle: CRIMSON -> SILVER -> BLUE -> repeat
// Each phase has unique modifiers affecting magic, growth, and vulnerability

export default class SapCycleManager {
  constructor(scene) {
    this.scene = scene;

    // Current sap phase state
    this.currentPhase = 'CRIMSON'; // 'CRIMSON', 'SILVER', 'BLUE'
    this.phaseDay = 1;
    this.totalDays = 0;

    // Phase duration configuration (in game days)
    this.phaseDurations = {
      CRIMSON: { min: 7, max: 21 },
      SILVER: { min: 3, max: 7 },
      BLUE: { min: 14, max: 28 },
    };

    this.currentPhaseDuration = 0;
    this.plantedSeeds = [];

    // Phase-specific modifiers
    this.phaseModifiers = {
      CRIMSON: {
        magicPower: 0.7,
        growthRate: 1.0,
        vulnerabilityMultiplier: 1.3,
        description:
          'The sap runs crimson. Plant seeds and prepare for renewal.',
      },
      SILVER: {
        magicPower: 1.5,
        growthRate: 3.0,
        vulnerabilityMultiplier: 0.8,
        description: 'The sap glows silver! The Great Unbinding occurs.',
      },
      BLUE: {
        magicPower: 1.0,
        growthRate: 1.2,
        vulnerabilityMultiplier: 1.0,
        description:
          'The sap runs blue. A time of reflection and stability.',
      },
    };

    this.listeners = [];

    // Initialize first phase
    this.startPhase('CRIMSON');
  }

  startPhase(phaseName) {
    console.log(`=== SAP CYCLE: ${phaseName} PHASE BEGINS ===`);

    const previousPhase = this.currentPhase;
    this.currentPhase = phaseName;
    this.phaseDay = 1;

    // Randomize phase duration
    const config = this.phaseDurations[phaseName];
    this.currentPhaseDuration = Phaser.Math.Between(config.min, config.max);
    console.log(`Phase will last ${this.currentPhaseDuration} days`);

    this.applyPhaseEffects();

    this.notifyListeners('phase-start', {
      phase: phaseName,
      previousPhase: previousPhase,
      duration: this.currentPhaseDuration,
      modifiers: this.phaseModifiers[phaseName],
    });

    switch (phaseName) {
      case 'CRIMSON':
        this.onCrimsonPhaseStart();
        break;
      case 'SILVER':
        this.onSilverPhaseStart();
        break;
      case 'BLUE':
        this.onBluePhaseStart();
        break;
    }

    this.triggerPhaseEvent(phaseName, previousPhase);
  }

  advanceDay() {
    this.totalDays++;
    this.phaseDay++;

    console.log(
      `Day ${this.totalDays} | ${this.currentPhase} Phase Day ${this.phaseDay}/${this.currentPhaseDuration}`
    );

    this.notifyListeners('day-advance', {
      totalDays: this.totalDays,
      phaseDay: this.phaseDay,
      phase: this.currentPhase,
    });

    // Check for random events
    this.checkForRandomEvent();

    if (this.phaseDay > this.currentPhaseDuration) {
      this.transitionToNextPhase();
    }
  }

  transitionToNextPhase() {
    const currentPhase = this.currentPhase;
    console.log(`=== PHASE TRANSITION FROM ${currentPhase} ===`);

    const phaseOrder = {
      CRIMSON: 'SILVER',
      SILVER: 'BLUE',
      BLUE: 'CRIMSON',
    };

    const nextPhase = phaseOrder[currentPhase];

    this.notifyListeners('phase-end', {
      endingPhase: currentPhase,
      nextPhase: nextPhase,
    });

    this.startPhase(nextPhase);
  }

  applyPhaseEffects() {
    const modifiers = this.phaseModifiers[this.currentPhase];
    console.log('Phase modifiers applied:', modifiers);
  }

  // --- Phase Start Handlers ---

  onCrimsonPhaseStart() {
    console.log('CRIMSON PHASE: Time to plant seeds!');
    this.plantedSeeds = [];
  }

  onSilverPhaseStart() {
    console.log('SILVER PHASE: The Great Unbinding begins!');
    this.performGreatUnbinding();
  }

  onBluePhaseStart() {
    console.log('BLUE PHASE: Time of reflection.');
  }

  performGreatUnbinding() {
    console.log(`Unbinding ${this.plantedSeeds.length} seeds...`);
    this.plantedSeeds.forEach((seed, index) => {
      if (this.scene && this.scene.time) {
        this.scene.time.delayedCall(index * 500, () => {
          this.unbindSeed(seed);
        });
      } else {
        this.unbindSeed(seed);
      }
    });
  }

  unbindSeed(seed) {
    console.log(
      `Seed at (${seed.x}, ${seed.y}) unbinds into ${seed.type}!`
    );
    this.notifyListeners('seed-unbind', seed);
  }

  // --- Planting System ---

  plantSeed(x, y, seedType) {
    if (this.currentPhase !== 'CRIMSON') {
      console.warn('Can only plant seeds during CRIMSON phase!');
      return false;
    }

    const seed = {
      x: x,
      y: y,
      type: seedType,
      plantedDay: this.totalDays,
    };

    this.plantedSeeds.push(seed);
    console.log(`Seed planted: ${seedType} at (${x}, ${y})`);
    this.notifyListeners('seed-planted', seed);
    return true;
  }

  // --- Phase Events ---

  triggerPhaseEvent(newPhase, oldPhase) {
    if (!oldPhase) return;
    const transitionKey = `${oldPhase}_to_${newPhase}`;

    const events = {
      CRIMSON_to_SILVER: {
        title: 'The Great Unbinding Begins!',
        message:
          'The sap glows silver! Planted seeds burst into life.',
        type: 'major',
      },
      SILVER_to_BLUE: {
        title: 'The Unbinding Fades',
        message:
          'The silver sap calms to blue. Verdance enters a period of reflection.',
        type: 'normal',
      },
      BLUE_to_CRIMSON: {
        title: 'The Sap Darkens',
        message:
          'Crimson sap flows once more. Time to plant new seeds.',
        type: 'normal',
      },
    };

    const event = events[transitionKey];
    if (event) {
      this.notifyListeners('phase-event', event);
    }
  }

  checkForRandomEvent() {
    if (Math.random() > 0.1) return; // 10% chance

    const phaseEvents = {
      CRIMSON: [
        {
          title: 'Crimson Bloom',
          message: 'A rare crimson flower blooms nearby. DSP +10.',
          effect: (scene) => {
            scene.player.stats.dsp = Math.min(
              scene.player.stats.dsp + 10,
              scene.player.stats.maxDsp
            );
          },
        },
        {
          title: 'Withering Winds',
          message: 'Harsh winds damage unprepared travelers. HP -15.',
          effect: (scene) => {
            scene.player.stats.hp = Math.max(scene.player.stats.hp - 15, 1);
          },
        },
      ],
      SILVER: [
        {
          title: 'Unbinding Surge',
          message:
            'The Great Unbinding empowers you! ATK +3 (temporary).',
          effect: (scene) => {
            scene.player.stats.attack += 3;
            scene.player.temporaryBonus = { stat: 'attack', value: 3, duration: 5 };
          },
        },
        {
          title: 'Silver Blessing',
          message: 'Silver sap rains down. HP and DSP fully restored!',
          effect: (scene) => {
            scene.player.stats.hp = scene.player.stats.maxHp;
            scene.player.stats.dsp = scene.player.stats.maxDsp;
          },
        },
      ],
      BLUE: [
        {
          title: 'Reflective Insight',
          message: 'Deep meditation grants wisdom. EXP +50.',
          effect: (scene) => {
            scene.player.stats.exp = (scene.player.stats.exp || 0) + 50;
          },
        },
        {
          title: 'Calm Waters',
          message: 'The blue phase soothes your wounds. HP +20.',
          effect: (scene) => {
            scene.player.stats.hp = Math.min(
              scene.player.stats.hp + 20,
              scene.player.stats.maxHp
            );
          },
        },
      ],
    };

    const events = phaseEvents[this.currentPhase];
    if (!events || events.length === 0) return;

    const event = Phaser.Utils.Array.GetRandom(events);
    this.notifyListeners('random-event', event);
  }

  // --- Query Methods ---

  getCurrentPhaseInfo() {
    return {
      phase: this.currentPhase,
      day: this.phaseDay,
      duration: this.currentPhaseDuration,
      daysRemaining: this.currentPhaseDuration - this.phaseDay,
      modifiers: this.phaseModifiers[this.currentPhase],
    };
  }

  getPhaseColor() {
    const colors = {
      CRIMSON: 0xcc3333,
      SILVER: 0xcccccc,
      BLUE: 0x3366cc,
    };
    return colors[this.currentPhase];
  }

  getPhaseModifier(modifierName) {
    return this.phaseModifiers[this.currentPhase][modifierName] || 1.0;
  }

  // --- Event System ---

  addEventListener(eventType, callback) {
    this.listeners.push({ type: eventType, callback });
  }

  removeEventListener(callback) {
    this.listeners = this.listeners.filter((l) => l.callback !== callback);
  }

  notifyListeners(eventType, data) {
    this.listeners
      .filter((l) => l.type === eventType)
      .forEach((l) => l.callback(data));
  }

  // --- Save/Load ---

  getSaveData() {
    return {
      currentPhase: this.currentPhase,
      phaseDay: this.phaseDay,
      totalDays: this.totalDays,
      currentPhaseDuration: this.currentPhaseDuration,
      plantedSeeds: this.plantedSeeds,
    };
  }

  loadSaveData(data) {
    this.currentPhase = data.currentPhase;
    this.phaseDay = data.phaseDay;
    this.totalDays = data.totalDays;
    this.currentPhaseDuration = data.currentPhaseDuration;
    this.plantedSeeds = data.plantedSeeds || [];
    this.applyPhaseEffects();
    console.log('Sap Cycle data loaded:', data);
  }
}
