// src/systems/DSPManager.js
// Domain Soul Points manager with Sap Cycle phase cost modifiers

export default class DSPManager {
  constructor(scene) {
    this.scene = scene;

    this.currentDSP = 100;
    this.maxDSP = 100;
    this.criticalThreshold = 20;
    this.warningThreshold = 40;

    // Phase modifier for DSP costs (set by Sap Cycle)
    this.phaseModifier = 1.0;

    this.listeners = [];
  }

  setPhaseModifier(modifier) {
    this.phaseModifier = modifier;
    console.log(`DSP phase modifier set to ${modifier}x`);
  }

  calculateCost(baseCost) {
    const modifiedCost = Math.floor(baseCost * this.phaseModifier);
    console.log(
      `DSP cost: ${baseCost} base -> ${modifiedCost} (${this.phaseModifier}x phase modifier)`
    );
    return modifiedCost;
  }

  canAfford(baseCost) {
    return this.currentDSP >= this.calculateCost(baseCost);
  }

  spend(baseCost) {
    const actualCost = this.calculateCost(baseCost);

    if (actualCost > this.currentDSP) {
      console.warn(
        `Not enough DSP! Need ${actualCost}, have ${this.currentDSP}`
      );
      return false;
    }

    this.currentDSP -= actualCost;
    if (this.currentDSP < 0) this.currentDSP = 0;

    console.log(
      `Spent ${actualCost} DSP (${this.currentDSP}/${this.maxDSP} remaining)`
    );

    this.checkThresholds();
    this.notifyListeners('dsp-spent', {
      amount: actualCost,
      remaining: this.currentDSP,
      percentage: this.currentDSP / this.maxDSP,
    });

    return true;
  }

  restore(amount) {
    const oldDSP = this.currentDSP;
    this.currentDSP = Math.min(this.currentDSP + amount, this.maxDSP);
    const restored = this.currentDSP - oldDSP;
    console.log(
      `Restored ${restored} DSP (${this.currentDSP}/${this.maxDSP})`
    );
    this.notifyListeners('dsp-restored', {
      amount: restored,
      remaining: this.currentDSP,
      percentage: this.currentDSP / this.maxDSP,
    });
    return restored;
  }

  checkThresholds() {
    if (this.currentDSP <= this.criticalThreshold) {
      this.notifyListeners('dsp-critical', {
        remaining: this.currentDSP,
      });
    } else if (this.currentDSP <= this.warningThreshold) {
      this.notifyListeners('dsp-warning', {
        remaining: this.currentDSP,
      });
    }
  }

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

  getPercentage() {
    return this.currentDSP / this.maxDSP;
  }

  getSaveData() {
    return {
      currentDSP: this.currentDSP,
      maxDSP: this.maxDSP,
    };
  }

  loadSaveData(data) {
    this.currentDSP = data.currentDSP;
    this.maxDSP = data.maxDSP;
  }
}
