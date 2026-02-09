import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * SkillTreePanel - Skill tree UI for character progression.
 * Displays interconnected skill nodes organized by Sap phase branches,
 * with prerequisites, point costs, and visual connections.
 */
export class SkillTreePanel {
  constructor(scene, uiFramework) {
    this.scene = scene;
    this.ui = uiFramework;
    this.eventBus = EventBus.getInstance();

    // Skill data
    this.skills = new Map();
    this.unlockedSkills = new Set();
    this.availablePoints = 0;

    // Skill branches (organized by Sap phase affinity)
    this.branches = {
      blue: { name: 'Temporal Arts', color: 0x4a9eff, skills: [] },
      crimson: { name: 'Crimson Fury', color: 0xff4a4a, skills: [] },
      silver: { name: 'Silver Mysteries', color: 0xccccee, skills: [] },
      core: { name: 'Core Abilities', color: 0xffaa00, skills: [] }
    };

    // UI
    this.panel = null;
    this.skillNodes = new Map();
    this.connectionLines = null;
    this.visible = false;
    this.panX = 0;
    this.panY = 0;

    this.build();
  }

  build() {
    const panelWidth = 700;
    const panelHeight = 500;
    const panelX = GameConfig.WIDTH / 2 - panelWidth / 2;
    const panelY = GameConfig.HEIGHT / 2 - panelHeight / 2;

    this.panel = this.ui.createPanel(panelX, panelY, panelWidth, panelHeight, {
      title: 'Skill Tree',
      closable: true,
      depth: 7000
    });
    this.panel.setVisible(false);

    // Branch tabs
    const branches = [
      { key: 'core', label: 'Core', x: 100 },
      { key: 'blue', label: 'Temporal', x: 220 },
      { key: 'crimson', label: 'Crimson', x: 360 },
      { key: 'silver', label: 'Silver', x: 500 }
    ];

    this.branchTabs = {};
    for (const branch of branches) {
      const color = this.branches[branch.key].color;
      const tab = this.scene.add.text(branch.x, 50, branch.label, {
        fontSize: '13px',
        fill: `#${color.toString(16).padStart(6, '0')}`,
        fontFamily: 'monospace',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive();

      tab.on('pointerdown', () => this.showBranch(branch.key));
      tab.on('pointerover', () => tab.setScale(1.1));
      tab.on('pointerout', () => tab.setScale(1));
      this.panel.add(tab);
      this.branchTabs[branch.key] = tab;
    }

    // Available points display
    this.pointsText = this.scene.add.text(panelWidth - 20, 50, 'Points: 0', {
      fontSize: '14px', fill: '#ffaa00', fontFamily: 'monospace'
    }).setOrigin(1, 0.5);
    this.panel.add(this.pointsText);

    // Skill tree viewport
    this.treeContainer = this.scene.add.container(0, 70);
    this.panel.add(this.treeContainer);

    // Connection lines graphics
    this.connectionLines = this.scene.add.graphics();
    this.treeContainer.add(this.connectionLines);

    // Skill details area
    this.detailBg = this.scene.add.graphics();
    this.detailBg.fillStyle(0x1a1a2e, 0.9);
    this.detailBg.fillRoundedRect(10, panelHeight - 100, panelWidth - 20, 85, 4);
    this.panel.add(this.detailBg);

    this.detailTitle = this.scene.add.text(20, panelHeight - 92, '', {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.panel.add(this.detailTitle);

    this.detailDesc = this.scene.add.text(20, panelHeight - 72, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace',
      wordWrap: { width: panelWidth - 50 }
    });
    this.panel.add(this.detailDesc);

    this.detailCost = this.scene.add.text(panelWidth - 25, panelHeight - 92, '', {
      fontSize: '12px', fill: '#ffaa00', fontFamily: 'monospace'
    }).setOrigin(1, 0);
    this.panel.add(this.detailCost);
  }

  // ─── Skill Registration ───────────────────────────────────────────

  registerSkill(skillData) {
    const skill = {
      id: skillData.id,
      name: skillData.name,
      description: skillData.description || '',
      branch: skillData.branch || 'core',
      tier: skillData.tier || 1,
      cost: skillData.cost || 1,
      maxRank: skillData.maxRank || 1,
      currentRank: 0,
      prerequisites: skillData.prerequisites || [],
      position: skillData.position || { x: 0, y: 0 },
      icon: skillData.icon || null,
      effects: skillData.effects || [],
      type: skillData.type || 'passive', // passive, active, ultimate
      sapPhaseBonus: skillData.sapPhaseBonus || null,
      connections: skillData.connections || []
    };

    this.skills.set(skill.id, skill);

    // Add to branch
    const branch = this.branches[skill.branch];
    if (branch) branch.skills.push(skill.id);

    return skill;
  }

  // ─── Skill Tree Display ───────────────────────────────────────────

  showBranch(branchKey) {
    // Clear existing nodes
    for (const [, node] of this.skillNodes) {
      node.destroy(true);
    }
    this.skillNodes.clear();
    this.connectionLines.clear();

    // Highlight active tab
    for (const [key, tab] of Object.entries(this.branchTabs)) {
      tab.setAlpha(key === branchKey ? 1 : 0.5);
    }

    const branch = this.branches[branchKey];
    if (!branch) return;

    // Draw connections first
    for (const skillId of branch.skills) {
      const skill = this.skills.get(skillId);
      if (!skill) continue;

      for (const connId of skill.connections) {
        const connSkill = this.skills.get(connId);
        if (connSkill) {
          const bothUnlocked = this.unlockedSkills.has(skillId) && this.unlockedSkills.has(connId);
          this.connectionLines.lineStyle(2, bothUnlocked ? branch.color : 0x444466, bothUnlocked ? 0.8 : 0.3);
          this.connectionLines.lineBetween(
            skill.position.x, skill.position.y,
            connSkill.position.x, connSkill.position.y
          );
        }
      }
    }

    // Draw skill nodes
    for (const skillId of branch.skills) {
      const skill = this.skills.get(skillId);
      if (!skill) continue;
      this.createSkillNode(skill, branch.color);
    }
  }

  createSkillNode(skill, branchColor) {
    const x = skill.position.x;
    const y = skill.position.y;
    const size = 40;
    const unlocked = this.unlockedSkills.has(skill.id);
    const canUnlock = this.canUnlockSkill(skill.id);

    const container = this.scene.add.container(x, y);

    // Node background
    const bg = this.scene.add.graphics();

    if (unlocked) {
      bg.fillStyle(branchColor, 0.6);
      bg.lineStyle(2, branchColor, 1);
    } else if (canUnlock) {
      bg.fillStyle(0x333355, 0.8);
      bg.lineStyle(2, branchColor, 0.5);
    } else {
      bg.fillStyle(0x222233, 0.5);
      bg.lineStyle(1, 0x444466, 0.3);
    }

    const shape = skill.type === 'ultimate' ? 'diamond' : 'rect';
    if (shape === 'diamond') {
      bg.fillStyle(unlocked ? branchColor : 0x333355, unlocked ? 0.7 : 0.5);
      bg.beginPath();
      bg.moveTo(0, -size / 2 - 5);
      bg.lineTo(size / 2 + 5, 0);
      bg.lineTo(0, size / 2 + 5);
      bg.lineTo(-size / 2 - 5, 0);
      bg.closePath();
      bg.fill();
      bg.stroke();
    } else {
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, skill.type === 'active' ? 8 : 4);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, skill.type === 'active' ? 8 : 4);
    }
    container.add(bg);

    // Skill icon or initial
    const iconText = this.scene.add.text(0, -2, skill.name.charAt(0), {
      fontSize: '18px',
      fill: unlocked ? '#ffffff' : (canUnlock ? '#cccccc' : '#555555'),
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(iconText);

    // Rank indicator
    if (skill.maxRank > 1) {
      const rankText = this.scene.add.text(size / 2 - 2, size / 2 - 2,
        `${skill.currentRank}/${skill.maxRank}`, {
          fontSize: '8px', fill: '#aaaaaa', fontFamily: 'monospace'
        }).setOrigin(1, 1);
      container.add(rankText);
    }

    // Skill name below node
    const nameText = this.scene.add.text(0, size / 2 + 6, skill.name, {
      fontSize: '9px',
      fill: unlocked ? '#ffffff' : '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // Interactivity
    container.setSize(size, size);
    container.setInteractive();

    container.on('pointerover', () => {
      this.showSkillDetails(skill);
      if (!unlocked && canUnlock) {
        bg.clear();
        bg.fillStyle(branchColor, 0.3);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 4);
        bg.lineStyle(2, branchColor, 0.8);
        bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 4);
      }
    });

    container.on('pointerout', () => {
      // Reset visual (simplified)
    });

    container.on('pointerdown', () => {
      if (canUnlock && !unlocked) {
        this.unlockSkill(skill.id);
      } else if (unlocked && skill.currentRank < skill.maxRank) {
        this.upgradeSkill(skill.id);
      }
    });

    this.treeContainer.add(container);
    this.skillNodes.set(skill.id, container);
  }

  // ─── Skill Unlocking ──────────────────────────────────────────────

  canUnlockSkill(skillId) {
    const skill = this.skills.get(skillId);
    if (!skill) return false;
    if (this.unlockedSkills.has(skillId)) return false;
    if (this.availablePoints < skill.cost) return false;

    // Check prerequisites
    for (const prereqId of skill.prerequisites) {
      if (!this.unlockedSkills.has(prereqId)) return false;
    }

    return true;
  }

  unlockSkill(skillId) {
    if (!this.canUnlockSkill(skillId)) return false;

    const skill = this.skills.get(skillId);
    this.availablePoints -= skill.cost;
    skill.currentRank = 1;
    this.unlockedSkills.add(skillId);

    this.updatePointsDisplay();
    this.showBranch(skill.branch); // Refresh display

    this.eventBus.emit('skill:unlocked', {
      skillId,
      name: skill.name,
      branch: skill.branch,
      effects: skill.effects
    });

    this.ui.notify(`Skill Unlocked: ${skill.name}`, { type: 'success' });
    return true;
  }

  upgradeSkill(skillId) {
    const skill = this.skills.get(skillId);
    if (!skill || !this.unlockedSkills.has(skillId)) return false;
    if (skill.currentRank >= skill.maxRank) return false;
    if (this.availablePoints < skill.cost) return false;

    this.availablePoints -= skill.cost;
    skill.currentRank++;
    this.updatePointsDisplay();
    this.showBranch(skill.branch);

    this.eventBus.emit('skill:upgraded', {
      skillId,
      name: skill.name,
      rank: skill.currentRank
    });

    return true;
  }

  addSkillPoints(amount) {
    this.availablePoints += amount;
    this.updatePointsDisplay();
  }

  // ─── UI Updates ───────────────────────────────────────────────────

  showSkillDetails(skill) {
    this.detailTitle.setText(skill.name);
    this.detailCost.setText(`Cost: ${skill.cost} pts`);

    let desc = skill.description;
    if (skill.effects.length > 0) {
      desc += '\n';
      for (const effect of skill.effects) {
        const rankValue = effect.valuePerRank
          ? effect.value + effect.valuePerRank * (skill.currentRank - 1)
          : effect.value;
        desc += `\n${effect.description || effect.type}: ${rankValue}`;
      }
    }
    if (skill.prerequisites.length > 0) {
      const prereqNames = skill.prerequisites.map(id => this.skills.get(id)?.name || id).join(', ');
      desc += `\n\nRequires: ${prereqNames}`;
    }

    this.detailDesc.setText(desc);
  }

  updatePointsDisplay() {
    this.pointsText.setText(`Points: ${this.availablePoints}`);
  }

  setVisible(visible) {
    this.visible = visible;
    this.panel.setVisible(visible);
  }

  onShow() {
    this.updatePointsDisplay();
    this.showBranch('core'); // Default to core branch
  }

  onHide() { }

  // ─── Save/Load ────────────────────────────────────────────────────

  saveState() {
    const skillStates = {};
    for (const [id, skill] of this.skills) {
      skillStates[id] = { currentRank: skill.currentRank };
    }
    return {
      unlockedSkills: Array.from(this.unlockedSkills),
      availablePoints: this.availablePoints,
      skillStates
    };
  }

  loadState(state) {
    if (state.unlockedSkills) this.unlockedSkills = new Set(state.unlockedSkills);
    if (state.availablePoints !== undefined) this.availablePoints = state.availablePoints;
    if (state.skillStates) {
      for (const [id, data] of Object.entries(state.skillStates)) {
        const skill = this.skills.get(id);
        if (skill) skill.currentRank = data.currentRank;
      }
    }
    this.updatePointsDisplay();
  }

  destroy() {
    this.panel.destroy(true);
  }
}

export default SkillTreePanel;
