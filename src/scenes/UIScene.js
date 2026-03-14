import EventBus from '../core/EventBus.js';

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
        this._createSpellSlots();
        this._createMinimap();
        this._createFPSCounter();
        this._createQuestTracker();
        this._createLocationIndicator();

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
            })
        ];
    }

    // ----------------------------------------------------------------
    // Phase indicator
    // ----------------------------------------------------------------

    _createPhaseIndicator() {
        const PHASE_COLORS = { blue: '#4488ff', crimson: '#ff4444', silver: '#ccccdd' };

        this.uiElements.phaseLabel = this.add.text(640, 16, 'BLUE PHASE', {
            fontFamily: 'monospace', fontSize: '16px', color: PHASE_COLORS.blue,
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
            fontFamily: 'monospace', fontSize: '11px', color: '#ff6666'
        }).setDepth(10000);

        this.uiElements.hpBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.hpBarBg.fillStyle(0x331111, 0.7);
        this.uiElements.hpBarBg.fillRect(x + 24, y + 1, 150, 12);

        this.uiElements.hpBarFill = this.add.graphics().setDepth(10000);
        this.uiElements.hpBarFill.fillStyle(0xff4444, 0.9);
        this.uiElements.hpBarFill.fillRect(x + 25, y + 2, 148, 10);

        this.uiElements.hpText = this.add.text(x + 99, y + 7, '100/100', {
            fontFamily: 'monospace', fontSize: '9px', color: '#ffaaaa'
        }).setOrigin(0.5).setDepth(10001);

        // Sap bar
        this.uiElements.sapLabel = this.add.text(x, y + 18, 'SAP', {
            fontFamily: 'monospace', fontSize: '11px', color: '#66aaff'
        }).setDepth(10000);

        this.uiElements.sapBarBg = this.add.graphics().setDepth(10000);
        this.uiElements.sapBarBg.fillStyle(0x112233, 0.7);
        this.uiElements.sapBarBg.fillRect(x + 30, y + 19, 150, 12);

        this.uiElements.sapBarFill = this.add.graphics().setDepth(10000);
        this.uiElements.sapBarFill.fillStyle(0x4488ff, 0.9);
        this.uiElements.sapBarFill.fillRect(x + 31, y + 20, 148, 10);

        // Level & XP
        this.uiElements.levelText = this.add.text(x, y + 38, 'Lv.1', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffaa44',
            stroke: '#000', strokeThickness: 2
        }).setDepth(10000);

        this.uiElements.xpText = this.add.text(x + 40, y + 39, 'XP: 0', {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa'
        }).setDepth(10000);

        // Gold
        this.uiElements.goldText = this.add.text(x + 120, y + 39, 'Gold: 0', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44'
        }).setDepth(10000);
    }

    _updatePlayerBars(stats) {
        if (!stats) return;
        const x = 20;

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

    // ----------------------------------------------------------------
    // Spell slots
    // ----------------------------------------------------------------

    _createSpellSlots() {
        this.uiElements.spellSlots = {};
        const slotSize = 48;
        const startX = 640 - (slotSize * 2.5);
        const y = 720 - slotSize - 16;

        const spellNames = ['Azure', 'Crim', 'Bloom', 'Shadow', 'Radi'];
        const spellColors = [0x4488ff, 0xff4444, 0x44ff88, 0x8844ff, 0xffffaa];

        for (let i = 0; i < 5; i++) {
            const x = startX + i * (slotSize + 8);
            const bg = this.add.graphics().setDepth(10000);
            bg.fillStyle(0x222244, 0.7);
            bg.fillRect(x, y, slotSize, slotSize);
            bg.lineStyle(1, spellColors[i], 0.4);
            bg.strokeRect(x, y, slotSize, slotSize);

            const keyLabel = this.add.text(x + 4, y + 2, `${i + 1}`, {
                fontFamily: 'monospace', fontSize: '10px', color: '#6688aa'
            }).setDepth(10001);

            // Spell name
            this.add.text(x + slotSize / 2, y + slotSize - 4, spellNames[i], {
                fontFamily: 'monospace', fontSize: '8px', color: `#${spellColors[i].toString(16).padStart(6, '0')}`
            }).setOrigin(0.5, 1).setDepth(10001);

            const cooldownOverlay = this.add.graphics().setDepth(10001);

            this.uiElements.spellSlots[i] = { bg, keyLabel, cooldownOverlay, x, y, size: slotSize };
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
        const mapping = ['azure_bolt', 'crimson_surge', 'verdant_bloom', 'shadow_strike', 'radiant_burst'];
        return mapping.indexOf(spellId);
    }

    // ----------------------------------------------------------------
    // Quest tracker
    // ----------------------------------------------------------------

    _createQuestTracker() {
        const x = 1280 - 260;
        const y = 160;

        this.uiElements.questTitle = this.add.text(x, y, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffaa44',
            stroke: '#000', strokeThickness: 2
        }).setDepth(10000);

        this.uiElements.questObjectives = [];
        for (let i = 0; i < 4; i++) {
            const obj = this.add.text(x + 8, y + 18 + i * 16, '', {
                fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
                stroke: '#000', strokeThickness: 1
            }).setDepth(10000);
            this.uiElements.questObjectives.push(obj);
        }

        this._currentQuestData = null;
    }

    _updateQuestTracker(data) {
        this._currentQuestData = data;
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
    }

    // ----------------------------------------------------------------
    // Location indicator
    // ----------------------------------------------------------------

    _createLocationIndicator() {
        this.uiElements.locationText = this.add.text(640, 700, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#888888',
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
            fontFamily: 'monospace',
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
            fontFamily: 'monospace', fontSize: '10px', color: '#334466'
        }).setOrigin(0.5).setDepth(10001);
    }

    // ----------------------------------------------------------------
    // FPS counter
    // ----------------------------------------------------------------

    _createFPSCounter() {
        this.uiElements.fpsText = this.add.text(1260, 708, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#446644'
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

    shutdown() {
        if (this._unsubs) this._unsubs.forEach((fn) => fn());
    }
}
