// src/systems/RestManager.js
// Rest system to advance days and restore HP/DSP
// Three tiers: Short Rest (1 day), Long Rest (3 days), Full Rest (7 days)

export default class RestManager {
  constructor(scene) {
    this.scene = scene;

    this.restTypes = {
      SHORT_REST: {
        name: 'Short Rest',
        daysAdvanced: 1,
        hpRestore: 0.25,
        dspRestore: 0.5,
        duration: 2000,
        description: 'Rest for one day. Restore some HP and DSP.',
      },
      LONG_REST: {
        name: 'Long Rest',
        daysAdvanced: 3,
        hpRestore: 0.75,
        dspRestore: 1.0,
        duration: 4000,
        description: 'Rest for three days. Fully restore DSP and most HP.',
      },
      FULL_REST: {
        name: 'Full Rest',
        daysAdvanced: 7,
        hpRestore: 1.0,
        dspRestore: 1.0,
        removeStatusEffects: true,
        duration: 6000,
        description:
          'Rest for one week. Fully restore HP, DSP, and cure ailments.',
      },
    };

    this.currentLocation = null;
    this.isResting = false;
  }

  canRest() {
    if (!this.currentLocation || !this.currentLocation.isSafe) {
      console.warn('Cannot rest here - location not safe!');
      return false;
    }
    if (this.isResting) {
      console.warn('Already resting!');
      return false;
    }
    return true;
  }

  startRest(restType) {
    if (!this.canRest()) return false;

    const config = this.restTypes[restType];
    if (!config) {
      console.error(`Invalid rest type: ${restType}`);
      return false;
    }

    console.log(`=== STARTING ${config.name.toUpperCase()} ===`);
    console.log(`Will advance ${config.daysAdvanced} day(s)`);

    this.isResting = true;

    // Show rest screen and complete after animation
    this.scene.showRestScreen(config, () => {
      this.completeRest(restType);
    });

    return true;
  }

  completeRest(restType) {
    const config = this.restTypes[restType];
    console.log(`=== COMPLETING ${config.name.toUpperCase()} ===`);

    const player = this.scene.player.stats;

    const hpRestored = Math.floor(
      (player.maxHp - player.hp) * config.hpRestore
    );
    const dspRestored = Math.floor(
      (player.maxDsp - player.dsp) * config.dspRestore
    );

    player.hp = Math.min(player.hp + hpRestored, player.maxHp);
    player.dsp = Math.min(player.dsp + dspRestored, player.maxDsp);

    console.log(
      `HP restored: +${hpRestored} (${player.hp}/${player.maxHp})`
    );
    console.log(
      `DSP restored: +${dspRestored} (${player.dsp}/${player.maxDsp})`
    );

    if (config.removeStatusEffects && player.statusEffects) {
      player.statusEffects = [];
      console.log('All status effects removed');
    }

    // Advance Sap Cycle days
    const phaseBeforeRest = this.scene.sapCycle.currentPhase;
    for (let i = 0; i < config.daysAdvanced; i++) {
      this.scene.sapCycle.advanceDay();
    }
    const phaseAfterRest = this.scene.sapCycle.currentPhase;

    this.scene.showRestResults({
      hpRestored: hpRestored,
      dspRestored: dspRestored,
      daysAdvanced: config.daysAdvanced,
      newPhase: phaseAfterRest,
      phaseChanged: phaseBeforeRest !== phaseAfterRest,
    });

    this.isResting = false;
    console.log('=== REST COMPLETE ===');
  }

  setLocation(location) {
    this.currentLocation = location;
    console.log(
      `Location set: ${location.name} (Safe: ${location.isSafe})`
    );
  }
}
