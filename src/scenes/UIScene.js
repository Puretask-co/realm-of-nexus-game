import EventBus from '../core/EventBus.js';
import { UIFramework } from '../ui/UIFramework.js';
import { TacticalCombatPanel } from '../ui/TacticalCombatPanel.js';
import { ShopPanel } from '../ui/ShopPanel.js';
import { CraftingPanel } from '../ui/CraftingPanel.js';
import { MoralChoicePanel } from '../ui/MoralChoicePanel.js';
import { VeilkeeperPanel } from '../ui/VeilkeeperPanel.js';
import { SpellbookPanel } from '../ui/SpellbookPanel.js';
import { StashPanel } from '../ui/StashPanel.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import GameInfoPanel from '../ui/GameInfoPanel.js';
import CompanionPanel from '../ui/CompanionPanel.js';

/**
 * UIScene — Always-on overlay scene for HUD elements.
 *
 * Runs in parallel with GameScene (launched as a parallel scene).
 * Displays:
 *  - Sap cycle phase indicator and timer
 *  - Player HP / Sap bars
 *  - Level, XP, and Gold display
 *  - Spell cooldowns
 *  - Quest tracker
 *  - Location indicator
 *  - Mini-map (stub)
 *  - Notification toasts
 *
 * All data comes through EventBus so this scene has zero direct
 * coupling to GameScene.
 */
export default class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
    }

    create() {
        this.uiElements = {};
        this._notifications = [];

        this._createPhaseIndicator();
        this._createPlayerBars();
        this._createDSPBar();
        this._createSpellSlots();
        this._createMinimap();
        this._createFPSCounter();
        this._createQuestTracker();
        this._createQuestJournal();
        this._createLocationIndicator();

        this.tacticalCombatPanel = new TacticalCombatPanel(this);
        this.tacticalCombatPanel.create();

        this.shopPanel = new ShopPanel(this);
        this.craftingPanel = new CraftingPanel(this);
        this.moralChoicePanel = new MoralChoicePanel(this);
        this.veilkeeperPanel = new VeilkeeperPanel(this);
        this.spellbookPanel = new SpellbookPanel(this);
        this.stashPanel = new StashPanel(this);
        this.inventoryPanel = new InventoryPanel(this, this._makeMinimalUI());
        this.gameInfoPanel = new GameInfoPanel(this);
        this.companionPanel = new CompanionPanel(this);

        // Register all panels with UIFramework so showPanel/hidePanel/hideAllPanels work
        // and ui:menuOpen / ui:menuClose SFX fire correctly via UIFramework.showPanel()
        const ui = UIFramework.getInstance(this);
        if (ui) {
            ui.registerPanel('tactical',    this.tacticalCombatPanel);
            ui.registerPanel('shop',        this.shopPanel);
            ui.registerPanel('crafting',    this.craftingPanel);
            ui.registerPanel('moralChoice', this.moralChoicePanel);
            ui.registerPanel('veilkeeper',  this.veilkeeperPanel);
            ui.registerPanel('spellbook',   this.spellbookPanel);
            ui.registerPanel('stash',       this.stashPanel);
            ui.registerPanel('inventory',   this.inventoryPanel);
            ui.registerPanel('gameInfo',    this.gameInfoPanel);
            ui.registerPanel('companion',   this.companionPanel);
        }

        this.input.keyboard.on('keydown-K', () => this.spellbookPanel.toggle());
        this.input.keyboard.on('keydown-TAB', () => this.gameInfoPanel.toggle());
        this.input.keyboard.on('keydown-P', () => this.companionPanel.toggle());
        this.input.keyboard.on('keydown-I', () => this._toggleInventory());
        this.input.keyboard.on('keydown-C', () => {
            if (this.scene.isActive('CharacterSheetScene')) {
                this.scene.stop('CharacterSheetScene');
            } else {
                this.scene.launch('CharacterSheetScene');
            }
        });
        this.input.keyboard.on('keydown-W', () => {
            if (this.scene.isActive('WikiCodexScene')) {
                this.scene.stop('WikiCodexScene');
            } else {
                this.scene.launch('WikiCodexScene');
            }
        });

        // EventBus bindings
        this._unsubs = [
            EventBus.on('sap-cycle-tick', (phase, progress) => {
                this._updatePhaseIndicator(phase, progress);
            }),
            EventBus.on('phase-changed', (newPhase) => {
                this._flashPhaseChange(newPhase);
            }),
            EventBus.on('player-stats-updated', (stats) => {
                this._updatePlayerBars(stats);
            }),
            EventBus.on('spell-cooldown-tick', (spellId, remaining, total) => {
                this._updateSpellCooldown(spellId, remaining, total);
            }),
            EventBus.on('cooldown-ready', (data) => {
                this._flashCooldownReady(data?.id);
            }),
            EventBus.on('quest:started', (data) => {
                this._updateQuestTracker(data);
                this._showNotification(`Quest Started: ${data.name}`, 0x4488ff);
            }),
            EventBus.on('quest:objectiveUpdated', (data) => {
                this._updateQuestObjective(data);
            }),
            EventBus.on('quest:completed', (data) => {
                this._showNotification(`Quest Complete: ${data.name}`, 0x44ff44);
                this._clearQuestTracker();
            }),
            EventBus.on('zone-entered', (data) => {
                this._updateLocation(data.name);
                this._showNotification(data.name, 0xccccdd, true);
            }),
            EventBus.on('player:levelUp', (data) => {
                this._showNotification(`Level Up! Lv.${data.level}`, 0xffaa44);
            }),
            EventBus.on('inventory:addItem', (data) => {
                const name = data.itemData?.name || data.itemId;
                this._showNotification(`+${data.quantity || 1} ${name}`, 0xffdd44);
            }),
            EventBus.on('achievement:unlocked', (data) => {
                this._showNotification(`Achievement: ${data.name}`, 0xffaa00);
            }),
            EventBus.on('class:applied', (data) => {
                if (data.className) {
                    this._updateClassName(data.className);
                }
            }),
            EventBus.on('spell:unlocked', (data) => {
                this._showNotification(`Spell Unlocked: ${data.spell.name}`, 0xcc66ff);
            }),
            EventBus.on('narrative:endingTriggered', (data) => {
                this._showEndingScreen(data);
            }),
            EventBus.on('dsp:changed', (status) => {
                this._updateDSPBar(status);
            }),
            EventBus.on('ui:toggleQuestJournal', () => {
                this._toggleQuestJournal();
            }),
            EventBus.on('pillar-activated', (data) => {
                this._showNotification(`${data.pillarName}: ${data.description}`, 0x88ff88);
            })
        ];
    }

    /**
     * Ending screen: 4 endings, 12 variations (design doc). Shows title, description, variation, and Continue.
     */
    _showEndingScreen(payload) {
        const { endingId, variation = 0, ending = {} } = payload || {};
        const name = ending.name || endingId || 'The End';
        const desc = ending.description || '';
        const variations = Math.max(1, ending.variations || 3);
        const variationText = variations > 1 ? `Variation ${variation + 1} of ${variations}` : '';

        const { width, height } = this.scale;
        const overlay = this.add.graphics().setDepth(20000).setScrollFactor(0);
        overlay.fillStyle(0x0a0a1a, 0.95);
        overlay.fillRect(0, 0, width, height);

        const title = this.add.text(width / 2, 120, name, {
            fontFamily: 'Open Sans', fontSize: '39px', color: '#ffcc88',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(20001);
        const sub = this.add.text(width / 2, 165, variationText, {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#8888aa'
        }).setOrigin(0.5).setDepth(20001);
        const body = this.add.text(width / 2, 240, desc, {
            fontFamily: 'Open Sans', fontSize: '22px', color: '#ccccdd',
            wordWrap: { width: width - 120 }, align: 'center'
        }).setOrigin(0.5, 0).setDepth(20001);

        const btnY = height - 100;
        const btnBg = this.add.graphics().setDepth(20001);
        btnBg.fillStyle(0x3366aa, 0.9);
        btnBg.fillRoundedRect(width / 2 - 100, btnY - 20, 200, 44, 8);
        const btnText = this.add.text(width / 2, btnY + 2, 'Continue', {
            fontFamily: 'Open Sans', fontSize: '25px', color: '#ffffff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(20002);
        const hitZone = this.add.zone(width / 2, btnY + 2, 200, 44).setInteractive({ useHandCursor: true }).setDepth(20002);
        hitZone.on('pointerdown', () => {
            overlay.destroy();
            title.destroy();
            sub.destroy();
            body.destroy();
            btnBg.destroy();
            btnText.destroy();
            hitZone.destroy();
            this.scene.start('ClassSelectionScene');
        });
    }

    // ----------------------------------------------------------------
    // Phase indicator
    // ----------------------------------------------------------------

    _createPhaseIndicator() {
        const PHASE_COLORS = { blue: '#4488ff', crimson: '#ff4444', silver: '#ccccdd' };

        this.uiElements.phaseLabel = this.add.text(640, 16, 'BLUE PHASE', {
            fontFamily: 'Open Sans', fontSize: '22px', color: PHASE_COLORS.blue,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(10000);

        this.uiElements.phaseBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.phaseBarBg.fillStyle(0x111122, 0.6);
        this.uiElements.phaseBarBg.fillRect(440, 36, 400, 6);

        this.uiElements.phaseBarFill = this.add.graphics().setDepth(10000);
    }

    _updatePhaseIndicator(phase, progress) {
        const PHASE_COLORS_HEX = { blue: 0x4488ff, crimson: 0xff4444, silver: 0xccccdd };
        const PHASE_COLORS_STR = { blue: '#4488ff', crimson: '#ff4444', silver: '#ccccdd' };

        this.uiElements.phaseLabel.setText(`${phase.toUpperCase()} PHASE`);
        this.uiElements.phaseLabel.setColor(PHASE_COLORS_STR[phase] || '#ffffff');

        this.uiElements.phaseBarFill.clear();
        this.uiElements.phaseBarFill.fillStyle(PHASE_COLORS_HEX[phase] || 0xffffff, 0.8);
        this.uiElements.phaseBarFill.fillRect(441, 37, 398 * Math.min(progress, 1), 4);
    }

    _flashPhaseChange(newPhase) {
        const FLASH = { blue: 0x4488ff, crimson: 0xff4444, silver: 0xccccdd };
        this.cameras.main.flash(500, ...this._hexToRGB(FLASH[newPhase] || 0xffffff));
    }

    // ----------------------------------------------------------------
    // Player bars
    // ----------------------------------------------------------------

    _createPlayerBars() {
        const x = 20;
        const y = 20;

        // HP bar
        this.uiElements.hpLabel = this.add.text(x, y, 'HP', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#ff6666'
        }).setDepth(10000);

        this.uiElements.hpBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.hpBarBg.fillStyle(0x331111, 0.7);
        this.uiElements.hpBarBg.fillRect(x + 24, y + 1, 150, 12);

        this.uiElements.hpBarFill = this.add.graphics().setDepth(10000);
        this.uiElements.hpBarFill.fillStyle(0xff4444, 0.9);
        this.uiElements.hpBarFill.fillRect(x + 25, y + 2, 148, 10);

        this.uiElements.hpText = this.add.text(x + 99, y + 7, '100/100', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#ffaaaa'
        }).setOrigin(0.5).setDepth(10001);

        // Sap bar
        this.uiElements.sapLabel = this.add.text(x, y + 18, 'SAP', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#66aaff'
        }).setDepth(10000);

        this.uiElements.sapBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.sapBarBg.fillStyle(0x112233, 0.7);
        this.uiElements.sapBarBg.fillRect(x + 30, y + 19, 150, 12);

        this.uiElements.sapBarFill = this.add.graphics().setDepth(10000);
        this.uiElements.sapBarFill.fillStyle(0x4488ff, 0.9);
        this.uiElements.sapBarFill.fillRect(x + 31, y + 20, 148, 10);

        // Class name
        this.uiElements.classText = this.add.text(x, y + 38, '', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#88aaff',
            stroke: '#000', strokeThickness: 1
        }).setDepth(10000);

        // Level & XP
        this.uiElements.levelText = this.add.text(x, y + 52, 'Lv.1', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ffaa44',
            stroke: '#000', strokeThickness: 2
        }).setDepth(10000);

        this.uiElements.xpText = this.add.text(x + 40, y + 53, 'XP: 0', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#aaaaaa'
        }).setDepth(10000);

        // Gold
        this.uiElements.goldText = this.add.text(x + 120, y + 53, 'Gold: 0', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#ffcc44'
        }).setDepth(10000);
    }

    _updatePlayerBars(stats) {
        if (!stats) return;
        const x = 20;

        // Update spell slot labels when spells change
        if (stats.spells && stats.spells.length > 0) {
            this._spellMapping = stats.spells.slice(0, 5).map(s => s.id);
            for (let i = 0; i < 5; i++) {
                const slot = this.uiElements.spellSlots[i];
                if (slot && slot.nameLabel) {
                    const spell = stats.spells[i];
                    if (spell) {
                        // Abbreviate spell name to fit
                        const short = spell.name.length > 7
                            ? spell.name.substring(0, 6) + '.'
                            : spell.name;
                        const color = spell.vfx?.color
                            ? `#${parseInt(spell.vfx.color).toString(16).padStart(6, '0')}`
                            : '#888888';
                        slot.nameLabel.setText(short);
                        slot.nameLabel.setColor(color);
                    } else {
                        slot.nameLabel.setText('---');
                        slot.nameLabel.setColor('#444444');
                    }
                }
            }
        }

        // HP
        if (stats.hp !== undefined && stats.maxHp) {
            const ratio = Math.max(0, stats.hp / stats.maxHp);
            this.uiElements.hpBarFill.clear();
            this.uiElements.hpBarFill.fillStyle(ratio > 0.3 ? 0xff4444 : 0xff0000, 0.9);
            this.uiElements.hpBarFill.fillRect(x + 25, 22, 148 * ratio, 10);
            this.uiElements.hpText.setText(`${Math.ceil(stats.hp)}/${stats.maxHp}`);
        }

        // Sap
        if (stats.sap !== undefined && stats.maxSap) {
            const ratio = Math.max(0, stats.sap / stats.maxSap);
            this.uiElements.sapBarFill.clear();
            this.uiElements.sapBarFill.fillStyle(0x4488ff, 0.9);
            this.uiElements.sapBarFill.fillRect(x + 31, 40, 148 * ratio, 10);
        }

        // Level & XP
        if (stats.level !== undefined) {
            this.uiElements.levelText.setText(`Lv.${stats.level}`);
        }
        if (stats.experience !== undefined) {
            this.uiElements.xpText.setText(`XP: ${Math.floor(stats.experience)}`);
        }
        if (stats.gold !== undefined) {
            this.uiElements.goldText.setText(`Gold: ${stats.gold}`);
        }
    }

    _updateClassName(name) {
        if (this.uiElements.classText) {
            this.uiElements.classText.setText(name);
        }
    }

    // ----------------------------------------------------------------
    // Spell slots
    // ----------------------------------------------------------------

    _createSpellSlots() {
        this.uiElements.spellSlots = {};
        const slotSize = 48;
        const startX = 640 - (slotSize * 2.5);
        const y = 720 - slotSize - 16;

        this._spellNames = ['Spell 1', 'Spell 2', 'Spell 3', 'Spell 4', 'Spell 5'];
        this._spellColorValues = [0x888888, 0x888888, 0x888888, 0x888888, 0x888888];

        for (let i = 0; i < 5; i++) {
            const x = startX + i * (slotSize + 8);
            const bg = this.add.graphics().setDepth(10000);
            bg.fillStyle(0x222244, 0.7);
            bg.fillRect(x, y, slotSize, slotSize);
            bg.lineStyle(1, this._spellColorValues[i], 0.4);
            bg.strokeRect(x, y, slotSize, slotSize);

            const keyLabel = this.add.text(x + 4, y + 2, `${i + 1}`, {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#6688aa'
            }).setDepth(10001);

            // Spell name label (updated dynamically)
            const nameLabel = this.add.text(x + slotSize / 2, y + slotSize - 4, this._spellNames[i], {
                fontFamily: 'Open Sans', fontSize: '11px', color: '#888888'
            }).setOrigin(0.5, 1).setDepth(10001);

            const cooldownOverlay = this.add.graphics().setDepth(10001);

            this.uiElements.spellSlots[i] = { bg, keyLabel, nameLabel, cooldownOverlay, x, y, size: slotSize };
        }
    }

    _updateSpellCooldown(spellId, remaining, total) {
        const slotIndex = this._getSlotForSpell(spellId);
        if (slotIndex === -1) return;

        const slot = this.uiElements.spellSlots[slotIndex];
        if (!slot) return;

        slot.cooldownOverlay.clear();
        if (remaining > 0 && total > 0) {
            const ratio = remaining / total;
            slot.cooldownOverlay.fillStyle(0x000000, 0.6);
            slot.cooldownOverlay.fillRect(slot.x, slot.y, slot.size, slot.size * ratio);
        }
    }

    _getSlotForSpell(spellId) {
        // Dynamic mapping — matches whatever spells the player has equipped
        return this._spellMapping ? this._spellMapping.indexOf(spellId) : -1;
    }

    /** Flash a spell slot gold when its cooldown finishes. */
    _flashCooldownReady(spellId) {
        if (!spellId) return;
        const slotIndex = this._getSlotForSpell(spellId);
        const slot = slotIndex !== -1 ? this.uiElements.spellSlots?.[slotIndex] : null;
        if (!slot?.bg) return;

        // Clear any lingering cooldown overlay first
        slot.cooldownOverlay.clear();

        // Brief gold flash on the slot background
        const origTint = 0xffffff;
        slot.bg.setTint(0xffdd44);
        this.time.delayedCall(200, () => { if (slot.bg?.active) slot.bg.clearTint(); });
    }

    // ----------------------------------------------------------------
    // Quest tracker
    // ----------------------------------------------------------------

    _createQuestTracker() {
        const x = 1280 - 260;
        const y = 160;

        this.uiElements.questTitle = this.add.text(x, y, '', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ffaa44',
            stroke: '#000', strokeThickness: 2
        }).setDepth(10000);

        this.uiElements.questObjectives = [];
        for (let i = 0; i < 4; i++) {
            const obj = this.add.text(x + 8, y + 18 + i * 16, '', {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#aaaaaa',
                stroke: '#000', strokeThickness: 1
            }).setDepth(10000);
            this.uiElements.questObjectives.push(obj);
        }

        this._currentQuestData = null;
    }

    _updateQuestTracker(data) {
        this._currentQuestData = data;
        if (this._journalVisible) this._refreshJournalDisplay();
        this.uiElements.questTitle.setText(data.name || '');

        const objectives = data.objectives || [];
        for (let i = 0; i < 4; i++) {
            if (i < objectives.length) {
                const obj = objectives[i];
                this.uiElements.questObjectives[i].setText(
                    `[ ] ${obj.description} (0/${obj.required})`
                );
                this.uiElements.questObjectives[i].setColor('#aaaaaa');
            } else {
                this.uiElements.questObjectives[i].setText('');
            }
        }
    }

    _updateQuestObjective(data) {
        if (!this._currentQuestData) return;

        const objectives = this._currentQuestData.objectives || [];
        const objIndex = objectives.findIndex(o => o.id === data.objectiveId);
        if (objIndex >= 0 && objIndex < 4) {
            const obj = objectives[objIndex];
            const done = data.current >= data.required;
            this.uiElements.questObjectives[objIndex].setText(
                `${done ? '[x]' : '[ ]'} ${obj.description} (${data.current}/${data.required})`
            );
            this.uiElements.questObjectives[objIndex].setColor(done ? '#44ff44' : '#aaaaaa');
        }
    }

    _clearQuestTracker() {
        this.uiElements.questTitle.setText('');
        for (const obj of this.uiElements.questObjectives) {
            obj.setText('');
        }
        this._currentQuestData = null;
        if (this._journalVisible) this._refreshJournalDisplay();
    }

    // ----------------------------------------------------------------
    // DSP Bar
    // ----------------------------------------------------------------

    _createDSPBar() {
        const x = 20;
        const y = 80; // below HP + SAP bars

        this.uiElements.dspLabel = this.add.text(x, y, 'DSP', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#88ddff'
        }).setDepth(10000);

        this.uiElements.dspBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.dspBarBg.fillStyle(0x112233, 0.7);
        this.uiElements.dspBarBg.fillRect(x + 30, y + 1, 150, 12);

        this.uiElements.dspBarFill = this.add.graphics().setDepth(10000);

        this.uiElements.dspValueText = this.add.text(x + 105, y + 7, '100/100', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#88ddff'
        }).setOrigin(0.5).setDepth(10001);

        this.uiElements.dspWarning = this.add.text(x + 185, y + 7, '', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#ff4444',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0, 0.5).setDepth(10001);

        this._updateDSPBar({ current: 100, max: 100 });
    }

    _updateDSPBar(status) {
        if (!this.uiElements.dspBarFill) return;
        const x = 20;
        const y = 80;
        const current = status.current ?? status.dsp ?? 100;
        const max = status.max || 100;
        const pct = Math.max(0, Math.min(1, current / max));

        let fillColor = 0x44ccff;
        let warningText = '';
        let warningColor = '#ffdd44';
        if (current <= 20) {
            fillColor = 0xff2222; warningText = '! CRITICAL'; warningColor = '#ff2222';
        } else if (current <= 30) {
            fillColor = 0xff6622; warningText = '! LOW'; warningColor = '#ff8844';
        } else if (current <= 50) {
            fillColor = 0xffdd22; warningText = '! STRAINED'; warningColor = '#ffdd44';
        }

        this.uiElements.dspBarFill.clear();
        this.uiElements.dspBarFill.fillStyle(fillColor, 0.85);
        this.uiElements.dspBarFill.fillRect(x + 31, y + 2, 148 * pct, 10);

        if (this.uiElements.dspValueText) {
            this.uiElements.dspValueText.setText(`${Math.round(current)}/${max}`);
            this.uiElements.dspValueText.setColor(`#${fillColor.toString(16).padStart(6, '0')}`);
        }
        if (this.uiElements.dspWarning) {
            this.uiElements.dspWarning.setText(warningText).setColor(warningColor);
        }
    }

    // ----------------------------------------------------------------
    // Quest Journal overlay (J key)
    // ----------------------------------------------------------------

    _createQuestJournal() {
        const { width, height } = this.scale;
        const jw = 340, jh = 400;
        const jx = width / 2 - jw / 2;
        const jy = height / 2 - jh / 2;

        this._journalVisible = false;

        this._journalBg = this.add.graphics().setDepth(15000);
        this._journalBg.fillStyle(0x0a0a1a, 0.92);
        this._journalBg.fillRoundedRect(jx, jy, jw, jh, 10);
        this._journalBg.lineStyle(2, 0x4466aa, 0.8);
        this._journalBg.strokeRoundedRect(jx, jy, jw, jh, 10);

        this._journalTitle = this.add.text(width / 2, jy + 22, 'QUEST JOURNAL  [J] close', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#ffaa44',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(15001);

        this._journalDivGfx = this.add.graphics().setDepth(15001);
        this._journalDivGfx.lineStyle(1, 0x334466, 0.6);
        this._journalDivGfx.lineBetween(jx + 16, jy + 42, jx + jw - 16, jy + 42);

        this._journalActiveLabel = this.add.text(jx + 16, jy + 52, 'Active Quest', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#888888'
        }).setDepth(15001);

        this._journalQuestName = this.add.text(jx + 16, jy + 68, '—', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#ffcc66',
            stroke: '#000', strokeThickness: 1
        }).setDepth(15001);

        this._journalObjectiveLines = [];
        for (let i = 0; i < 6; i++) {
            const line = this.add.text(jx + 24, jy + 90 + i * 18, '', {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#aaaaaa',
                stroke: '#000', strokeThickness: 1
            }).setDepth(15001);
            this._journalObjectiveLines.push(line);
        }

        this._journalHint = this.add.text(width / 2, jy + jh - 18, 'Press J to toggle journal', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#445566'
        }).setOrigin(0.5).setDepth(15001);

        this._journalElements = [
            this._journalBg, this._journalTitle, this._journalDivGfx,
            this._journalActiveLabel, this._journalQuestName, this._journalHint,
            ...this._journalObjectiveLines
        ];
        for (const el of this._journalElements) { if (el?.setVisible) el.setVisible(false); }
    }

    _toggleQuestJournal() {
        this._journalVisible = !this._journalVisible;
        for (const el of (this._journalElements || [])) {
            if (el?.setVisible) el.setVisible(this._journalVisible);
        }
        if (this._journalVisible) this._refreshJournalDisplay();
    }

    _refreshJournalDisplay() {
        if (!this._currentQuestData) {
            if (this._journalQuestName) this._journalQuestName.setText('No active quest');
            for (const line of (this._journalObjectiveLines || [])) line.setText('');
            return;
        }
        const data = this._currentQuestData;
        if (this._journalQuestName) this._journalQuestName.setText(data.name || '—');
        const objectives = data.objectives || [];
        for (let i = 0; i < 6; i++) {
            const line = this._journalObjectiveLines?.[i];
            if (!line) continue;
            if (i < objectives.length) {
                const obj = objectives[i];
                const done = obj._done || false;
                line.setText(`${done ? '[x]' : '[ ]'} ${obj.description}`).setColor(done ? '#44ff88' : '#aaaaaa');
            } else {
                line.setText('');
            }
        }
    }

    // ----------------------------------------------------------------
    // Location indicator
    // ----------------------------------------------------------------

    _createLocationIndicator() {
        this.uiElements.locationText = this.add.text(640, 700, '', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#888888',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10000).setAlpha(0);
    }

    _updateLocation(name) {
        this.uiElements.locationText.setText(name);
        this.uiElements.locationText.setAlpha(1);

        // Fade out after 3 seconds
        this.tweens.add({
            targets: this.uiElements.locationText,
            alpha: 0,
            delay: 3000,
            duration: 1000
        });
    }

    // ----------------------------------------------------------------
    // Notifications
    // ----------------------------------------------------------------

    _showNotification(text, color = 0xffffff, isLarge = false) {
        const y = 120 + this._notifications.length * 24;
        const colorStr = `#${color.toString(16).padStart(6, '0')}`;

        const notification = this.add.text(640, isLarge ? 360 : y, text, {
            fontFamily: 'Open Sans',
            fontSize: isLarge ? '20px' : '12px',
            color: colorStr,
            stroke: '#000000',
            strokeThickness: isLarge ? 4 : 2
        }).setOrigin(0.5).setDepth(10002).setAlpha(0);

        this._notifications.push(notification);

        // Animate in
        this.tweens.add({
            targets: notification,
            alpha: 1,
            y: notification.y - 10,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // Animate out
        this.tweens.add({
            targets: notification,
            alpha: 0,
            y: notification.y - 30,
            delay: isLarge ? 2000 : 3000,
            duration: 500,
            onComplete: () => {
                const idx = this._notifications.indexOf(notification);
                if (idx >= 0) this._notifications.splice(idx, 1);
                notification.destroy();
            }
        });
    }

    // ----------------------------------------------------------------
    // Minimap stub
    // ----------------------------------------------------------------

    _createMinimap() {
        const size = 120;
        const x = 1280 - size - 16;
        const y = 16;

        this.uiElements.minimapBg = this.add.graphics().setDepth(10000);
        this.uiElements.minimapBg.fillStyle(0x111122, 0.6);
        this.uiElements.minimapBg.fillRect(x, y, size, size);
        this.uiElements.minimapBg.lineStyle(1, 0x334466, 0.5);
        this.uiElements.minimapBg.strokeRect(x, y, size, size);

        this.add.text(x + size / 2, y + size / 2, 'MAP', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#334466'
        }).setOrigin(0.5).setDepth(10001);
    }

    // ----------------------------------------------------------------
    // FPS counter
    // ----------------------------------------------------------------

    _createFPSCounter() {
        this.uiElements.fpsText = this.add.text(1260, 708, '', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#446644'
        }).setOrigin(1, 1).setDepth(10002);
    }

    update() {
        if (this.uiElements.fpsText) {
            const fps = Math.round(this.game.loop.actualFps);
            this.uiElements.fpsText.setText(`${fps} FPS`);
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _hexToRGB(hex) {
        return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
    }

    _toggleInventory() {
        if (!this.inventoryPanel) return;
        const visible = !this.inventoryPanel.visible;
        this.inventoryPanel.setVisible(visible);
        if (visible) this.inventoryPanel.onShow?.();
        else this.inventoryPanel.onHide?.();
    }

    /**
     * Minimal UI adapter so InventoryPanel (which expects a UIFramework) can run
     * without the full UIFramework — just enough to create panels and buttons.
     */
    _makeMinimalUI() {
        const scene = this;
        return {
            notify: (msg, opts = {}) => {
                this._showNotification(msg, opts.type === 'warning' ? 0xff4444 : 0xffdd44);
            },
            createPanel: (x, y, w, h, opts = {}) => {
                const container = scene.add.container(x, y).setDepth(opts.depth || 7000);
                const bg = scene.add.graphics();
                bg.fillStyle(0x0d0d22, 0.95);
                bg.fillRoundedRect(0, 0, w, h, 10);
                bg.lineStyle(2, 0x4466aa, 0.8);
                bg.strokeRoundedRect(0, 0, w, h, 10);
                container.add(bg);
                if (opts.title) {
                    const title = scene.add.text(w / 2, 16, opts.title, {
                        fontFamily: 'Open Sans', fontSize: '20px', color: '#aaccff'
                    }).setOrigin(0.5);
                    container.add(title);
                }
                // Minimal container API used by InventoryPanel
                container.setItem = () => {};
                return container;
            },
            createSlot: (x, y, opts = {}) => {
                const size = opts.size || 42;
                const g = scene.add.graphics();
                g.lineStyle(1, 0x334466, 0.8);
                g.fillStyle(0x111122, 0.9);
                g.fillRect(x, y, size, size);
                g.strokeRect(x, y, size, size);
                g.setItem = () => {};
                return g;
            },
            createButton: (x, y, label, opts = {}) => {
                const bw = opts.width || 60, bh = opts.height || 24;
                const bg = scene.add.graphics();
                bg.fillStyle(0x224466, 0.9);
                bg.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 4);
                const txt = scene.add.text(x, y, label, {
                    fontFamily: 'Open Sans', fontSize: opts.fontSize || '11px', color: '#ffffff'
                }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                if (opts.onClick) txt.on('pointerdown', opts.onClick);
                return txt;
            },
        };
    }

    shutdown() {
        if (this._unsubs) this._unsubs.forEach((fn) => fn());
    }
}
