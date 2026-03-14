import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { UIFramework } from '../ui/UIFramework.js';
import { HUDPanel } from '../ui/HUDPanel.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { SkillTreePanel } from '../ui/SkillTreePanel.js';
import { MainMenuPanel } from '../ui/MainMenuPanel.js';

/**
 * UIScene - Parallel HUD overlay scene that runs alongside GameScene.
 * Uses UIFramework to manage all panels: HUD, Inventory, SkillTree, MainMenu.
 * Keyboard shortcuts: I = Inventory, K = Skill Tree, ESC = Menu, TAB = Toggle HUD.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    // ─── Initialize UIFramework ────────────────────────────────
    // Reset singleton so it binds to this scene
    UIFramework.instance = null;
    this.ui = UIFramework.getInstance(this);

    // ─── Create Panels ─────────────────────────────────────────
    this.hudPanel = new HUDPanel(this, this.ui);
    this.inventoryPanel = new InventoryPanel(this, this.ui);
    this.skillTreePanel = new SkillTreePanel(this, this.ui);
    this.mainMenuPanel = new MainMenuPanel(this, this.ui);

    // Register panels with UIFramework
    this.ui.registerPanel('inventory', this.inventoryPanel);
    this.ui.registerPanel('skillTree', this.skillTreePanel);
    this.ui.registerPanel('mainMenu', this.mainMenuPanel);

    // HUD is always visible (not toggled via panel system)
    this.hudPanel.setVisible(true);

    // ─── Keyboard Shortcuts ────────────────────────────────────
    this.input.keyboard.on('keydown-I', () => {
      this.ui.togglePanel('inventory');
    });

    this.input.keyboard.on('keydown-K', () => {
      this.ui.togglePanel('skillTree');
    });

    this.input.keyboard.on('keydown-ESC', () => {
      // If any panel is open, close it. Otherwise open main menu.
      if (this.ui.activePanel) {
        this.ui.hideAllPanels();
      } else {
        this.ui.togglePanel('mainMenu');
      }
    });

    this.input.keyboard.on('keydown-TAB', (e) => {
      e.preventDefault();
      this.hudPanel.setVisible(!this.hudPanel.visible);
    });

    // ─── Skill Tree: Grant points on level up ──────────────────
    this.eventBus.on('player:levelUp', (data) => {
      this.skillTreePanel.addSkillPoints(2);
    });

    // ─── Sap Phase Theme ───────────────────────────────────────
    this.eventBus.on('sapCycle:phaseChanged', (data) => {
      this.ui.applySapPhaseTheme(data.phase);
    });

    // ─── Populate Skill Trees ──────────────────────────────────
    this.populateSkillTrees();

    // ─── Controls hint ─────────────────────────────────────────
    this.controlsHint = this.add.text(
      GameConfig.WIDTH / 2, GameConfig.HEIGHT - 10,
      'WASD: Move | 1-5: Spells | SPACE: Dash | E: Interact | I: Inventory | K: Skills | ESC: Menu',
      { fontSize: '10px', fill: '#555555', fontFamily: 'monospace' }
    ).setOrigin(0.5, 1).setDepth(9999).setScrollFactor(0);
  }

  /**
   * Register skill tree nodes for each Sap branch + Core.
   */
  populateSkillTrees() {
    // ─── Core Abilities ──────────────────────────────────────────
    const coreSkills = [
      {
        id: 'vitality', name: 'Vitality', branch: 'core', tier: 1, cost: 1, maxRank: 5,
        position: { x: 350, y: 60 },
        description: 'Increases max HP by 5% per rank.',
        type: 'passive',
        effects: [{ type: 'max_hp_bonus', value: 0.05, valuePerRank: 0.05, description: '+HP%' }],
        connections: ['endurance', 'sap_mastery']
      },
      {
        id: 'endurance', name: 'Endurance', branch: 'core', tier: 2, cost: 1, maxRank: 3,
        position: { x: 220, y: 130 },
        description: 'Reduces damage taken by 3% per rank.',
        type: 'passive',
        effects: [{ type: 'damage_reduction', value: 0.03, valuePerRank: 0.03, description: 'DR%' }],
        prerequisites: ['vitality'], connections: ['unyielding']
      },
      {
        id: 'sap_mastery', name: 'Sap Mastery', branch: 'core', tier: 2, cost: 1, maxRank: 3,
        position: { x: 480, y: 130 },
        description: 'Increases sap regeneration by 10% per rank.',
        type: 'passive',
        effects: [{ type: 'sap_regen_bonus', value: 0.10, valuePerRank: 0.10, description: 'Sap Regen%' }],
        prerequisites: ['vitality'], connections: ['sap_overflow']
      },
      {
        id: 'unyielding', name: 'Unyielding', branch: 'core', tier: 3, cost: 2, maxRank: 1,
        position: { x: 220, y: 220 },
        description: 'Survive a lethal hit once per 120s, retaining 1 HP.',
        type: 'passive',
        effects: [{ type: 'cheat_death', value: 120, description: 'Cheat Death' }],
        prerequisites: ['endurance'], connections: []
      },
      {
        id: 'sap_overflow', name: 'Sap Overflow', branch: 'core', tier: 3, cost: 2, maxRank: 1,
        position: { x: 480, y: 220 },
        description: 'Excess sap above max converts to bonus spell damage (1% per 5 sap).',
        type: 'passive',
        effects: [{ type: 'sap_to_damage', value: 0.01, description: 'Sap→Dmg' }],
        prerequisites: ['sap_mastery'], connections: []
      },
      {
        id: 'quick_dash', name: 'Quick Dash', branch: 'core', tier: 1, cost: 1, maxRank: 3,
        position: { x: 350, y: 300 },
        description: 'Reduces dash cooldown by 0.5s per rank.',
        type: 'passive',
        effects: [{ type: 'dash_cd_reduction', value: 0.5, valuePerRank: 0.5, description: 'Dash CD' }],
        connections: ['phase_walker']
      },
      {
        id: 'phase_walker', name: 'Phase Walker', branch: 'core', tier: 3, cost: 3, maxRank: 1,
        position: { x: 350, y: 370 },
        description: 'Dashing during a phase transition grants 3s invulnerability.',
        type: 'ultimate',
        effects: [{ type: 'dash_invuln', value: 3, description: 'Invuln' }],
        prerequisites: ['quick_dash'], connections: []
      }
    ];

    // ─── Temporal (Blue) Branch ──────────────────────────────────
    const blueSkills = [
      {
        id: 'chrono_precision', name: 'Chrono Precision', branch: 'blue', tier: 1, cost: 1, maxRank: 5,
        position: { x: 350, y: 60 },
        description: 'Increases spell damage by 4% per rank during Blue Phase.',
        type: 'passive',
        effects: [{ type: 'spell_damage_bonus', value: 0.04, valuePerRank: 0.04, description: 'Spell Dmg%' }],
        connections: ['time_warp', 'arcane_focus']
      },
      {
        id: 'time_warp', name: 'Time Warp', branch: 'blue', tier: 2, cost: 2, maxRank: 3,
        position: { x: 200, y: 140 },
        description: 'Spell cooldowns reduced by 5% per rank.',
        type: 'passive',
        effects: [{ type: 'cooldown_reduction', value: 0.05, valuePerRank: 0.05, description: 'CDR%' }],
        prerequisites: ['chrono_precision'], connections: ['temporal_cascade']
      },
      {
        id: 'arcane_focus', name: 'Arcane Focus', branch: 'blue', tier: 2, cost: 2, maxRank: 3,
        position: { x: 500, y: 140 },
        description: 'Crit chance for spells increased by 3% per rank.',
        type: 'passive',
        effects: [{ type: 'spell_crit', value: 0.03, valuePerRank: 0.03, description: 'Crit%' }],
        prerequisites: ['chrono_precision'], connections: ['temporal_cascade']
      },
      {
        id: 'temporal_cascade', name: 'Temporal Cascade', branch: 'blue', tier: 3, cost: 3, maxRank: 1,
        position: { x: 350, y: 240 },
        description: 'Every 5th spell cast triggers a free echo of the previous spell.',
        type: 'active',
        effects: [{ type: 'spell_echo', value: 5, description: 'Echo every 5 casts' }],
        prerequisites: ['time_warp', 'arcane_focus'], connections: ['temporal_mastery']
      },
      {
        id: 'mana_tide', name: 'Mana Tide', branch: 'blue', tier: 2, cost: 1, maxRank: 3,
        position: { x: 350, y: 330 },
        description: 'Kills during Blue Phase restore 8% max sap per rank.',
        type: 'passive',
        effects: [{ type: 'kill_sap_restore', value: 0.08, valuePerRank: 0.08, description: 'Sap on Kill%' }],
        connections: ['temporal_mastery']
      },
      {
        id: 'temporal_mastery', name: 'Temporal Mastery', branch: 'blue', tier: 4, cost: 4, maxRank: 1,
        position: { x: 350, y: 400 },
        description: 'Blue Phase lasts 30% longer. All temporal spells cost 20% less sap.',
        type: 'ultimate',
        effects: [
          { type: 'phase_duration_bonus', value: 0.30, description: 'Phase Duration' },
          { type: 'sap_cost_reduction', value: 0.20, description: 'Sap Cost' }
        ],
        prerequisites: ['temporal_cascade'], connections: []
      }
    ];

    // ─── Crimson Branch ──────────────────────────────────────────
    const crimsonSkills = [
      {
        id: 'burning_strikes', name: 'Burning Strikes', branch: 'crimson', tier: 1, cost: 1, maxRank: 5,
        position: { x: 350, y: 60 },
        description: 'Attacks deal 3% bonus fire damage per rank.',
        type: 'passive',
        effects: [{ type: 'fire_damage_bonus', value: 0.03, valuePerRank: 0.03, description: 'Fire Dmg%' }],
        connections: ['blood_thirst', 'fury_buildup']
      },
      {
        id: 'blood_thirst', name: 'Blood Thirst', branch: 'crimson', tier: 2, cost: 2, maxRank: 3,
        position: { x: 200, y: 140 },
        description: 'Heal for 3% of damage dealt per rank.',
        type: 'passive',
        effects: [{ type: 'lifesteal', value: 0.03, valuePerRank: 0.03, description: 'Lifesteal%' }],
        prerequisites: ['burning_strikes'], connections: ['infernal_rage']
      },
      {
        id: 'fury_buildup', name: 'Fury Buildup', branch: 'crimson', tier: 2, cost: 2, maxRank: 3,
        position: { x: 500, y: 140 },
        description: 'Each consecutive hit increases damage by 2% per rank (max 5 stacks).',
        type: 'passive',
        effects: [{ type: 'ramping_damage', value: 0.02, valuePerRank: 0.02, description: 'Ramp%/hit' }],
        prerequisites: ['burning_strikes'], connections: ['infernal_rage']
      },
      {
        id: 'infernal_rage', name: 'Infernal Rage', branch: 'crimson', tier: 3, cost: 3, maxRank: 1,
        position: { x: 350, y: 240 },
        description: 'When below 30% HP, gain 50% attack speed and 25% damage.',
        type: 'active',
        effects: [
          { type: 'low_hp_atk_speed', value: 0.50, description: 'Atk Speed' },
          { type: 'low_hp_damage', value: 0.25, description: 'Bonus Dmg' }
        ],
        prerequisites: ['blood_thirst', 'fury_buildup'], connections: ['crimson_mastery']
      },
      {
        id: 'flame_armor', name: 'Flame Armor', branch: 'crimson', tier: 2, cost: 1, maxRank: 3,
        position: { x: 350, y: 330 },
        description: 'Melee attackers take 5 fire damage per rank.',
        type: 'passive',
        effects: [{ type: 'thorns_fire', value: 5, valuePerRank: 5, description: 'Fire Thorns' }],
        connections: ['crimson_mastery']
      },
      {
        id: 'crimson_mastery', name: 'Crimson Mastery', branch: 'crimson', tier: 4, cost: 4, maxRank: 1,
        position: { x: 350, y: 400 },
        description: 'Crimson Phase grants permanent +15% damage. Kills extend Crimson Phase by 2s.',
        type: 'ultimate',
        effects: [
          { type: 'phase_damage_bonus', value: 0.15, description: 'Phase Dmg' },
          { type: 'kill_phase_extend', value: 2, description: 'Phase Extend' }
        ],
        prerequisites: ['infernal_rage'], connections: []
      }
    ];

    // ─── Silver Branch ───────────────────────────────────────────
    const silverSkills = [
      {
        id: 'arcane_barrier', name: 'Arcane Barrier', branch: 'silver', tier: 1, cost: 1, maxRank: 5,
        position: { x: 350, y: 60 },
        description: 'Shield strength increased by 5% per rank.',
        type: 'passive',
        effects: [{ type: 'shield_strength', value: 0.05, valuePerRank: 0.05, description: 'Shield%' }],
        connections: ['reflective_guard', 'mystic_ward']
      },
      {
        id: 'reflective_guard', name: 'Reflective Guard', branch: 'silver', tier: 2, cost: 2, maxRank: 3,
        position: { x: 200, y: 140 },
        description: 'Reflect 5% of blocked damage per rank back to attacker.',
        type: 'passive',
        effects: [{ type: 'damage_reflect', value: 0.05, valuePerRank: 0.05, description: 'Reflect%' }],
        prerequisites: ['arcane_barrier'], connections: ['silver_fortress']
      },
      {
        id: 'mystic_ward', name: 'Mystic Ward', branch: 'silver', tier: 2, cost: 2, maxRank: 3,
        position: { x: 500, y: 140 },
        description: 'Gain 3% magic resistance per rank.',
        type: 'passive',
        effects: [{ type: 'magic_resist', value: 0.03, valuePerRank: 0.03, description: 'MR%' }],
        prerequisites: ['arcane_barrier'], connections: ['silver_fortress']
      },
      {
        id: 'silver_fortress', name: 'Silver Fortress', branch: 'silver', tier: 3, cost: 3, maxRank: 1,
        position: { x: 350, y: 240 },
        description: 'Standing still for 2s creates an aura reducing nearby enemy damage by 20%.',
        type: 'active',
        effects: [{ type: 'stationary_aura', value: 0.20, description: 'Enemy Dmg Reduction' }],
        prerequisites: ['reflective_guard', 'mystic_ward'], connections: ['silver_mastery']
      },
      {
        id: 'purify', name: 'Purify', branch: 'silver', tier: 2, cost: 1, maxRank: 3,
        position: { x: 350, y: 330 },
        description: 'Reduce debuff duration on self by 15% per rank.',
        type: 'passive',
        effects: [{ type: 'debuff_reduction', value: 0.15, valuePerRank: 0.15, description: 'Debuff DR%' }],
        connections: ['silver_mastery']
      },
      {
        id: 'silver_mastery', name: 'Silver Mastery', branch: 'silver', tier: 4, cost: 4, maxRank: 1,
        position: { x: 350, y: 400 },
        description: 'Silver Phase grants a shield equal to 20% max HP. Block chance +10%.',
        type: 'ultimate',
        effects: [
          { type: 'phase_shield', value: 0.20, description: 'Phase Shield' },
          { type: 'block_bonus', value: 0.10, description: 'Block%' }
        ],
        prerequisites: ['silver_fortress'], connections: []
      }
    ];

    // Register all skills
    const allSkills = [...coreSkills, ...blueSkills, ...crimsonSkills, ...silverSkills];
    for (const skill of allSkills) {
      this.skillTreePanel.registerSkill(skill);
    }
  }

  update(time, delta) {
    this.ui.update(time, delta);
  }

  shutdown() {
    this.ui.destroy();
  }
}

export default UIScene;
