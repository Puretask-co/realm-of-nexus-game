// src/systems/StatusEffects.js
// Status effect system: Poison, Slow, Root, Stun
// Each effect has duration, potency, and visual indicators

export default class StatusEffectManager {
  constructor(scene) {
    this.scene = scene;
  }

  applyStatus(target, statusType, duration, potency = 1) {
    if (!target.statusEffects) {
      target.statusEffects = [];
    }

    // Check if status already exists (refresh if so)
    const existing = target.statusEffects.find((s) => s.type === statusType);

    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.potency = Math.max(existing.potency, potency);
    } else {
      const status = {
        type: statusType,
        duration: duration,
        potency: potency,
        visual: null,
      };
      target.statusEffects.push(status);
      this.createStatusVisual(target, status);
    }

    this.showStatusMessage(target, statusType);

    // Play sound if available
    const statusSounds = {
      poison: 'poisonApply',
      stun: 'stunApply',
    };
    if (statusSounds[statusType] && this.scene.playSoundEffect) {
      this.scene.playSoundEffect(statusSounds[statusType]);
    }
  }

  createStatusVisual(target, status) {
    const colorMap = {
      poison: { color: 0x88ff00, particles: [0x88ff00, 0x66dd00] },
      slow: { color: 0x6666ff, particles: [0x6666ff, 0x8888ff] },
      root: { color: 0x8b4513, particles: [0x8b4513, 0xa0522d] },
      stun: { color: 0xffff00, particles: [0xffff00, 0xffcc00] },
    };

    const cfg = colorMap[status.type] || {
      color: 0xffffff,
      particles: [0xffffff],
    };

    // Status icon above entity
    const iconIndex = target.statusEffects
      ? target.statusEffects.indexOf(status)
      : 0;
    const icon = this.scene.add.circle(
      target.x + 25 + iconIndex * 18,
      target.y - 45,
      8,
      cfg.color,
      0.8
    );
    icon.setStrokeStyle(2, 0x000000);

    status.visual = { icon };
  }

  showStatusMessage(target, statusType) {
    const messages = {
      poison: `${target.stats.name} is poisoned!`,
      slow: `${target.stats.name} is slowed!`,
      root: `${target.stats.name} is rooted!`,
      stun: `${target.stats.name} is stunned!`,
    };
    this.scene.showMessage(
      messages[statusType] || 'Status applied',
      0xffaa88
    );
  }

  // Process all status effects at the start of an entity's turn.
  // Returns true if the entity can act, false if stunned.
  processStatusEffects(target) {
    if (!target.statusEffects || target.statusEffects.length === 0) {
      return true;
    }

    let canAct = true;

    // Store original moveRange to restore after slow/root wears off
    if (target._baseMoveRange === undefined) {
      target._baseMoveRange = target.stats.moveRange;
    }

    // Reset moveRange before applying modifiers
    target.stats.moveRange = target._baseMoveRange;

    for (let i = target.statusEffects.length - 1; i >= 0; i--) {
      const status = target.statusEffects[i];

      switch (status.type) {
        case 'poison': {
          const poisonDamage = 5 * status.potency;
          target.stats.hp -= poisonDamage;
          if (target.stats.hp < 0) target.stats.hp = 0;
          if (target.healthBar) {
            target.healthBar.update(target.stats.hp, target.stats.maxHp);
          }
          this.scene.showDamageNumber(target.x, target.y - 30, poisonDamage);
          if (target.stats.hp <= 0) {
            this.scene.onEntityDefeated(target);
          }
          break;
        }
        case 'slow':
          target.stats.moveRange = Math.max(
            1,
            Math.floor(target.stats.moveRange * 0.5)
          );
          break;
        case 'root':
          target.stats.moveRange = 0;
          break;
        case 'stun':
          canAct = false;
          this.scene.showMessage(
            `${target.stats.name} is stunned!`,
            0xffff88
          );
          break;
      }

      status.duration--;
      if (status.duration <= 0) {
        this.removeStatus(target, i);
      }
    }

    return canAct;
  }

  removeStatus(target, index) {
    const status = target.statusEffects[index];

    if (status.visual) {
      if (status.visual.icon) status.visual.icon.destroy();
    }

    target.statusEffects.splice(index, 1);
  }

  clearAllStatuses(target) {
    if (!target.statusEffects) return;
    for (let i = target.statusEffects.length - 1; i >= 0; i--) {
      this.removeStatus(target, i);
    }
  }
}
