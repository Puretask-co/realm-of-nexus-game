// src/ui/CombatUI.js
// Combat action menu, turn order display, DSP bar, and spell selection

export default class CombatUI {
  constructor(scene) {
    this.scene = scene;
    this.actionMenu = null;
    this.turnOrderDisplay = null;
    this.spellMenu = null;
    this.aoePreview = null;
    this.selectedAction = null;
  }

  // --- Action Menu ---

  showActionMenu() {
    if (this.actionMenu) {
      this.actionMenu.destroy();
    }

    const player = this.scene.player;
    const remaining = player.stats.actionsRemaining;
    const menuX = 680;
    const menuY = 220;

    const elements = [];

    const menuBg = this.scene.add.rectangle(
      menuX, menuY, 180, 320, 0x2d4a3e, 0.95
    );
    menuBg.setStrokeStyle(3, 0x88cc88);
    elements.push(menuBg);

    const menuTitle = this.scene.add.text(menuX, menuY - 140, 'Actions', {
      fontSize: '20px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    menuTitle.setOrigin(0.5);
    elements.push(menuTitle);

    // Move button
    elements.push(
      ...this.createActionButton(menuX, menuY - 90, 'Move', remaining.move, () =>
        this.onMoveClicked()
      )
    );

    // Attack button
    elements.push(
      ...this.createActionButton(
        menuX, menuY - 30, 'Attack', remaining.action, () =>
          this.onAttackClicked()
      )
    );

    // Cast Spell button
    elements.push(
      ...this.createActionButton(
        menuX, menuY + 30, 'Cast Spell', remaining.action, () =>
          this.onSpellClicked()
      )
    );

    // Defend button
    elements.push(
      ...this.createActionButton(
        menuX, menuY + 90, 'Defend', remaining.action, () =>
          this.onDefendClicked()
      )
    );

    // End Turn button
    elements.push(
      ...this.createActionButton(
        menuX, menuY + 150, 'End Turn', true, () =>
          this.onEndTurnClicked(),
        0xffaa33
      )
    );

    this.actionMenu = this.scene.add.container(0, 0, elements);
  }

  createActionButton(x, y, text, enabled, callback, customColor = null) {
    const btnWidth = 150;
    const btnHeight = 40;
    const color = enabled ? customColor || 0x4a7c59 : 0x333333;
    const textColor = enabled ? '#FFFFFF' : '#666666';

    const button = this.scene.add.rectangle(
      x, y, btnWidth, btnHeight, color, 0.9
    );
    button.setStrokeStyle(2, enabled ? 0x88cc88 : 0x555555);

    const label = this.scene.add.text(x, y, text, {
      fontSize: '16px',
      color: textColor,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);

    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerover', () => {
        button.setFillStyle(customColor ? 0xffcc66 : 0x5a8c69);
        button.setScale(1.05);
      });
      button.on('pointerout', () => {
        button.setFillStyle(color);
        button.setScale(1.0);
      });
      button.on('pointerdown', () => callback());
    }

    return [button, label];
  }

  hideActionMenu() {
    if (this.actionMenu) {
      this.actionMenu.destroy();
      this.actionMenu = null;
    }
  }

  // --- Action Handlers ---

  onMoveClicked() {
    this.scene.movementMode = true;
    this.scene.gridManager.highlightMovementRange(
      this.scene.player.tile,
      this.scene.player.stats.moveRange
    );
    this.scene.events.on(
      'tile-clicked',
      this.scene.onMovementTileClicked,
      this.scene
    );
    this.hideActionMenu();
  }

  onAttackClicked() {
    this.selectedAction = 'attack';
    this.scene.gridManager.clearHighlights();
    this.scene.gridManager.highlightAttackRange(
      this.scene.player.tile,
      this.scene.player.stats.attackRange
    );
    this.scene.events.on('tile-clicked', this.onAttackTargetClicked, this);
    this.hideActionMenu();
  }

  onAttackTargetClicked(tile) {
    if (tile.highlight !== 'attack') {
      this.scene.showMessage('Invalid target!', 0xff6666);
      return;
    }

    const target = tile.occupant;
    this.scene.executeBasicAttack(this.scene.player, target);

    this.scene.events.off('tile-clicked', this.onAttackTargetClicked, this);
    this.scene.gridManager.clearHighlights();
    this.selectedAction = null;
    this.scene.player.stats.actionsRemaining.action = false;
  }

  onSpellClicked() {
    this.showSpellSelectionMenu();
  }

  onDefendClicked() {
    this.scene.player.stats.defendBonus = Math.floor(
      this.scene.player.stats.defense * 0.5
    );
    this.scene.showMessage('Defending (+50% DEF)', 0x88aaff);
    this.scene.player.stats.actionsRemaining.action = false;
    this.hideActionMenu();
    this.scene.time.delayedCall(800, () => {
      this.showActionMenu();
    });
  }

  onEndTurnClicked() {
    this.hideActionMenu();
    this.scene.endTurn();
  }

  // --- Spell Menu ---

  showSpellSelectionMenu() {
    this.hideActionMenu();

    const allAbilities = this.scene.player.stats.abilities || [];

    // Filter by current sap phase
    const availableAbilities = allAbilities.filter((ability) => {
      if (!ability.phaseRestriction) return true;
      return ability.phaseRestriction === this.scene.sapPhase;
    });

    if (availableAbilities.length === 0) {
      this.scene.showMessage('No spells available!', 0xff6666);
      this.showActionMenu();
      return;
    }

    const menuX = 680;
    const menuY = 250;
    const menuHeight = 80 + availableAbilities.length * 55 + 50;
    const elements = [];

    const menuBg = this.scene.add.rectangle(
      menuX, menuY, 220, menuHeight, 0x2d4a3e, 0.95
    );
    menuBg.setStrokeStyle(3, 0x88cc88);
    elements.push(menuBg);

    const title = this.scene.add.text(menuX, menuY - menuHeight / 2 + 20, 'Cast Spell', {
      fontSize: '18px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    elements.push(title);

    availableAbilities.forEach((ability, index) => {
      const baseCost = ability.dspCost;
      const actualCost = this.scene.dspManager
        ? this.scene.dspManager.calculateCost(baseCost)
        : baseCost;
      const canCast = this.scene.dspManager
        ? this.scene.dspManager.currentDSP >= actualCost
        : true;

      const costText = `${ability.name} (${actualCost} DSP)`;
      const yPos = menuY - menuHeight / 2 + 60 + index * 55;

      const btn = this.createActionButton(
        menuX, yPos, costText, canCast, () =>
          this.onAbilitySelected(ability)
      );
      elements.push(...btn);

      // Show base cost if modified
      if (actualCost !== baseCost) {
        const modIndicator = this.scene.add.text(
          menuX, yPos + 18, `(base: ${baseCost})`, {
            fontSize: '9px',
            color: actualCost < baseCost ? '#88FF88' : '#FF8888',
          }
        );
        modIndicator.setOrigin(0.5);
        elements.push(modIndicator);
      }
    });

    // Back button
    const backY = menuY + menuHeight / 2 - 30;
    const backBtn = this.createActionButton(
      menuX, backY, 'Back', true, () => {
        if (this.spellMenu) {
          this.spellMenu.destroy();
          this.spellMenu = null;
        }
        this.showActionMenu();
      },
      0x666666
    );
    elements.push(...backBtn);

    this.spellMenu = this.scene.add.container(0, 0, elements);
  }

  onAbilitySelected(ability) {
    if (this.spellMenu) {
      this.spellMenu.destroy();
      this.spellMenu = null;
    }

    switch (ability.type) {
      case 'aoe':
        this.showAoETargeting(ability);
        break;
      case 'buff':
        this.scene.executeSelfBuff(ability);
        break;
      case 'heal':
        this.scene.executeHeal(ability);
        break;
      case 'targeted':
        this.showTargetedSpellTargeting(ability);
        break;
      default:
        this.scene.showMessage('Ability type not implemented', 0xff6666);
        this.showActionMenu();
    }
  }

  // --- AoE Targeting ---

  showAoETargeting(ability) {
    this.scene.gridManager.clearHighlights();
    this.scene.gridManager.highlightAoECastRange(
      this.scene.player.tile,
      ability.range
    );

    const handler = (tile) => {
      if (tile.highlight === 'aoe_cast') {
        this.castAoESpell(tile, ability, handler);
      }
    };

    this.scene.events.on('tile-clicked', handler);
  }

  castAoESpell(targetTile, ability, handler) {
    this.clearAoEPreview();
    this.scene.gridManager.clearHighlights();
    this.scene.events.off('tile-clicked', handler);

    // Deduct DSP
    if (this.scene.dspManager) {
      const success = this.scene.dspManager.spend(ability.dspCost);
      if (!success) {
        this.scene.showMessage('Not enough DSP!', 0xff6666);
        this.showActionMenu();
        return;
      }
    }

    this.scene.executeAoEAttack(
      this.scene.player,
      targetTile,
      ability.aoeRadius,
      ability.damage,
      true
    );

    this.scene.player.stats.actionsRemaining.action = false;

    this.scene.time.delayedCall(2000, () => {
      this.showActionMenu();
    });
  }

  // --- Targeted Spell ---

  showTargetedSpellTargeting(ability) {
    this.scene.gridManager.clearHighlights();
    this.scene.gridManager.highlightAttackRange(
      this.scene.player.tile,
      ability.range
    );

    const handler = (tile) => {
      if (tile.highlight === 'attack' && tile.occupant) {
        this.scene.events.off('tile-clicked', handler);
        this.scene.gridManager.clearHighlights();

        if (this.scene.dspManager) {
          const success = this.scene.dspManager.spend(ability.dspCost);
          if (!success) {
            this.scene.showMessage('Not enough DSP!', 0xff6666);
            this.showActionMenu();
            return;
          }
        }

        const target = tile.occupant;
        // Apply damage
        target.stats.hp -= ability.damage;
        if (target.stats.hp < 0) target.stats.hp = 0;
        if (target.healthBar) {
          target.healthBar.update(target.stats.hp, target.stats.maxHp);
        }
        this.scene.showDamageNumber(target.x, target.y - 50, ability.damage);

        // Apply status if ability has one
        if (ability.status && this.scene.statusManager) {
          this.scene.statusManager.applyStatus(
            target,
            ability.status.type,
            ability.status.duration,
            ability.status.potency
          );
        }

        if (target.stats.hp <= 0) {
          this.scene.onEntityDefeated(target);
        }

        this.scene.player.stats.actionsRemaining.action = false;
        this.scene.time.delayedCall(1500, () => {
          this.showActionMenu();
        });
      }
    };

    this.scene.events.on('tile-clicked', handler);
  }

  clearAoEPreview() {
    if (this.aoePreview) {
      this.aoePreview.forEach((p) => p.destroy());
      this.aoePreview = null;
    }
  }

  // --- Turn Order Display ---

  createTurnOrderDisplay() {
    if (this.turnOrderDisplay) {
      this.turnOrderDisplay.destroy();
    }

    const x = 15;
    const y = 400;
    const elements = [];

    const bg = this.scene.add.rectangle(x + 55, y + 10, 130, 30 + this.scene.turnQueue.length * 35, 0x1a2a1a, 0.7);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x4a7c59);
    elements.push(bg);

    const title = this.scene.add.text(x + 65, y + 18, 'Turn Order', {
      fontSize: '14px',
      color: '#AAFFAA',
      fontStyle: 'bold',
    });
    elements.push(title);

    this.scene.turnQueue.forEach((entity, index) => {
      if (!entity || entity.stats.hp <= 0) return;
      const isCurrent = index === this.scene.currentTurnIndex;

      const icon = this.scene.add.circle(
        x + 75,
        y + 48 + index * 32,
        10,
        entity.isPlayer ? 0x88ff88 : 0xff6666
      );
      if (isCurrent) {
        icon.setStrokeStyle(3, 0xffff00);
      }
      elements.push(icon);

      const name = this.scene.add.text(
        x + 92,
        y + 48 + index * 32,
        entity.stats.name,
        {
          fontSize: '13px',
          color: isCurrent ? '#FFFF88' : '#FFFFFF',
        }
      );
      name.setOrigin(0, 0.5);
      elements.push(name);
    });

    this.turnOrderDisplay = this.scene.add.container(0, 0, elements);
    this.turnOrderDisplay.setDepth(50);
  }

  updateTurnOrderDisplay() {
    this.createTurnOrderDisplay();
  }

  // --- DSP Display ---

  createDSPDisplay() {
    if (!this.scene.dspManager) return;

    const x = 300;
    const y = 560;
    const elements = [];

    const dspBg = this.scene.add.rectangle(x, y, 300, 30, 0x1a2a1a, 0.85);
    elements.push(dspBg);

    const dspLabel = this.scene.add.text(x - 140, y, 'DSP:', {
      fontSize: '16px',
      color: '#88AAFF',
      fontStyle: 'bold',
    });
    dspLabel.setOrigin(0, 0.5);
    elements.push(dspLabel);

    const barBg = this.scene.add.rectangle(x - 80, y, 200, 16, 0x333333);
    barBg.setOrigin(0, 0.5);
    elements.push(barBg);

    const dspPct = this.scene.dspManager.getPercentage();
    this.dspBarFill = this.scene.add.rectangle(
      x - 80, y, 200 * dspPct, 16, 0x6688ff
    );
    this.dspBarFill.setOrigin(0, 0.5);
    elements.push(this.dspBarFill);

    this.dspValueText = this.scene.add.text(
      x + 130, y,
      `${this.scene.dspManager.currentDSP}/${this.scene.dspManager.maxDSP}`,
      { fontSize: '14px', color: '#FFFFFF' }
    );
    this.dspValueText.setOrigin(0.5);
    elements.push(this.dspValueText);

    this.dspDisplay = this.scene.add.container(0, 0, elements);
    this.dspDisplay.setDepth(50);

    // Listen for DSP changes
    this.scene.dspManager.addEventListener('dsp-spent', () => {
      this.updateDSPDisplay();
    });
  }

  updateDSPDisplay() {
    if (!this.scene.dspManager) return;
    const dspPct = this.scene.dspManager.getPercentage();

    if (this.dspBarFill) {
      this.scene.tweens.add({
        targets: this.dspBarFill,
        width: 200 * dspPct,
        duration: 300,
        ease: 'Power2',
      });
    }

    if (this.dspValueText) {
      this.dspValueText.setText(
        `${this.scene.dspManager.currentDSP}/${this.scene.dspManager.maxDSP}`
      );
    }

    // Color warning
    if (this.dspBarFill) {
      if (dspPct < 0.2) {
        this.dspBarFill.setFillStyle(0xff6666);
      } else if (dspPct < 0.4) {
        this.dspBarFill.setFillStyle(0xffaa66);
      } else {
        this.dspBarFill.setFillStyle(0x6688ff);
      }
    }
  }

  // --- Phase Indicator ---

  createPhaseIndicator(sapPhase, phaseModifiers) {
    const x = 680;
    const y = 30;
    const phaseColors = {
      CRIMSON: 0xcc3333,
      SILVER: 0xcccccc,
      BLUE: 0x3366cc,
    };
    const elements = [];

    const phaseBg = this.scene.add.rectangle(x, y, 160, 50, 0x1a2a1a, 0.85);
    phaseBg.setStrokeStyle(2, phaseColors[sapPhase] || 0x888888);
    elements.push(phaseBg);

    const colorHex = Phaser.Display.Color.IntegerToColor(
      phaseColors[sapPhase] || 0xffffff
    );
    const phaseText = this.scene.add.text(x, y - 6, `${sapPhase} PHASE`, {
      fontSize: '14px',
      color: colorHex.rgba,
      fontStyle: 'bold',
    });
    phaseText.setOrigin(0.5);
    elements.push(phaseText);

    // Modifier description
    let desc = '';
    if (phaseModifiers) {
      const magic = phaseModifiers.magicPower;
      const vuln = phaseModifiers.vulnerabilityMultiplier;
      if (magic !== 1.0) {
        desc += `Magic ${magic > 1.0 ? '+' : ''}${Math.round((magic - 1.0) * 100)}% `;
      }
      if (vuln !== 1.0) {
        desc += `Vuln ${vuln > 1.0 ? '+' : ''}${Math.round((vuln - 1.0) * 100)}%`;
      }
    }
    if (!desc) desc = 'Normal';

    const modText = this.scene.add.text(x, y + 14, desc, {
      fontSize: '10px',
      color: '#AAAAAA',
      align: 'center',
    });
    modText.setOrigin(0.5);
    elements.push(modText);

    this.phaseIndicatorContainer = this.scene.add.container(0, 0, elements);
    this.phaseIndicatorContainer.setDepth(50);
  }

  destroy() {
    if (this.actionMenu) this.actionMenu.destroy();
    if (this.turnOrderDisplay) this.turnOrderDisplay.destroy();
    if (this.spellMenu) this.spellMenu.destroy();
    if (this.dspDisplay) this.dspDisplay.destroy();
    if (this.phaseIndicatorContainer) this.phaseIndicatorContainer.destroy();
  }
}
