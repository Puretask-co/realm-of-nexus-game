import EventBus from '../systems/EventBus.js';

/**
 * UIScene — Always-on overlay scene for HUD elements.
 *
 * Runs in parallel with GameScene (launched as a parallel scene).
 * Displays:
 *  - Sap cycle phase indicator and timer
 *  - Player HP / Sap bars
 *  - Spell cooldowns
 *  - Mini-map (stub)
 *  - Phase transition overlay
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

        this._createPhaseIndicator();
        this._createPlayerBars();
        this._createSpellSlots();
        this._createMinimap();
        this._createFPSCounter();

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
            })
        ];
    }

    // ----------------------------------------------------------------
    // Phase indicator
    // ----------------------------------------------------------------

    _createPhaseIndicator() {
        const PHASE_COLORS = { blue: '#4488ff', crimson: '#ff4444', silver: '#ccccdd' };

        this.uiElements.phaseLabel = this.add.text(640, 16, 'BLUE PHASE', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: PHASE_COLORS.blue,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(10000);

        // Phase timer bar
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
    }

    _updatePlayerBars(stats) {
        if (!stats) return;
        const x = 20;

        // HP
        if (stats.hp !== undefined && stats.maxHp) {
            const ratio = Math.max(0, stats.hp / stats.maxHp);
            this.uiElements.hpBarFill.clear();
            this.uiElements.hpBarFill.fillStyle(0xff4444, 0.9);
            this.uiElements.hpBarFill.fillRect(x + 25, 22, 148 * ratio, 10);
        }

        // Sap
        if (stats.sap !== undefined && stats.maxSap) {
            const ratio = Math.max(0, stats.sap / stats.maxSap);
            this.uiElements.sapBarFill.clear();
            this.uiElements.sapBarFill.fillStyle(0x4488ff, 0.9);
            this.uiElements.sapBarFill.fillRect(x + 31, 40, 148 * ratio, 10);
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

        for (let i = 0; i < 5; i++) {
            const x = startX + i * (slotSize + 8);
            const bg = this.add.graphics().setDepth(10000);
            bg.fillStyle(0x222244, 0.7);
            bg.fillRect(x, y, slotSize, slotSize);
            bg.lineStyle(1, 0x4466aa, 0.6);
            bg.strokeRect(x, y, slotSize, slotSize);

            const keyLabel = this.add.text(x + 4, y + 2, `${i + 1}`, {
                fontFamily: 'monospace', fontSize: '10px', color: '#6688aa'
            }).setDepth(10001);

            const cooldownOverlay = this.add.graphics().setDepth(10001);

            this.uiElements.spellSlots[i] = { bg, keyLabel, cooldownOverlay, x, y, size: slotSize };
        }
    }

    _updateSpellCooldown(spellId, remaining, total) {
        // Map spell IDs to slot indices (placeholder mapping)
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
    // FPS counter (dev)
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
