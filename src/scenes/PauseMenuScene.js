import EventBus from '../core/EventBus.js';

/**
 * PauseMenuScene — Overlay scene launched on Escape from GameScene.
 *
 * Buttons:
 *  - Resume        (green)  — resumes physics + stops this scene
 *  - Save Game     (blue)   — emits request-save with slot 0, shows "Saved!" feedback
 *  - Load Game     (blue)   — inline 3-slot picker; emits request-load then resumes
 *  - Settings      (grey)   — launches SettingsScene
 *  - Quit to Menu  (red)    — stops UIScene + GameScene + PauseMenuScene, starts MainMenuScene
 *
 * Escape key always resumes.
 */
export default class PauseMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseMenuScene' });
        this._slotPickerContainer = null;
    }

    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------

    create() {
        const { width, height } = this.scale;

        // Pause world physics immediately
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.pause();

        // ---- Dim overlay ----
        this.add.graphics()
            .setDepth(19000)
            .fillStyle(0x000000, 0.65)
            .fillRect(0, 0, width, height);

        // ---- Main panel ----
        const panelW = 360;
        const panelH = 360;
        const panelX = width  / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2;

        const panel = this.add.graphics().setDepth(19001);
        panel.fillStyle(0x0d0d22, 0.96);
        panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
        panel.lineStyle(2, 0x4466aa, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);

        // Title
        this.add.text(width / 2, panelY + 30, 'PAUSED', {
            fontFamily: 'Open Sans', fontSize: '31px', color: '#aaccff',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(19002);

        // Divider
        const divGfx = this.add.graphics().setDepth(19002);
        divGfx.lineStyle(1, 0x334466, 0.6);
        divGfx.lineBetween(panelX + 20, panelY + 56, panelX + panelW - 20, panelY + 56);

        // ---- Buttons ----
        const btnW  = 280;
        const btnH  = 40;
        const bx0   = width / 2;
        const by0   = panelY + 80;
        const gap   = 52;

        const defs = [
            {
                label: 'Resume',
                color: 0x1a4a2a, hover: 0x2a7a44, border: 0x44cc88,
                action: () => this._resume(),
            },
            {
                label: 'Save Game',
                color: 0x1a2a4a, hover: 0x2a4a7a, border: 0x4488cc,
                action: () => this._saveGame(),
            },
            {
                label: 'Load Game',
                color: 0x1a2a4a, hover: 0x2a4a7a, border: 0x4488cc,
                action: () => this._toggleSlotPicker(),
            },
            {
                label: 'Settings',
                color: 0x252535, hover: 0x3a3a55, border: 0x6666aa,
                action: () => this._settings(),
            },
            {
                label: 'Quit to Main Menu',
                color: 0x3a1515, hover: 0x6a2222, border: 0xcc4444,
                action: () => this._quit(),
            },
        ];

        defs.forEach((def, i) => {
            this._createButton(bx0, by0 + i * gap, btnW, btnH, def);
        });

        // Feedback text (shows "Saved!" etc.)
        this._feedbackText = this.add.text(width / 2, panelY + panelH - 16, '', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#66ffaa',
        }).setOrigin(0.5).setDepth(19003);

        // Escape to resume
        this.input.keyboard.on('keydown-ESC', () => this._resume());
    }

    // ----------------------------------------------------------------
    // Button factory
    // ----------------------------------------------------------------

    _createButton(cx, cy, bw, bh, def) {
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const bg = this.add.graphics().setDepth(19002);
        const draw = (fillColor, borderAlpha) => {
            bg.clear();
            bg.fillStyle(fillColor, 0.88);
            bg.fillRoundedRect(bx, by, bw, bh, 6);
            bg.lineStyle(1.5, def.border, borderAlpha);
            bg.strokeRoundedRect(bx, by, bw, bh, 6);
        };
        draw(def.color, 0.5);

        const lbl = this.add.text(cx, cy, def.label, {
            fontFamily: 'Open Sans', fontSize: '21px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(19003);

        const zone = this.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(19003);

        zone.on('pointerover', () => { draw(def.hover, 1.0); lbl.setColor('#ffffff'); });
        zone.on('pointerout',  () => { draw(def.color, 0.5); lbl.setColor('#ffffff'); });
        zone.on('pointerdown', () => def.action());
    }

    // ----------------------------------------------------------------
    // Actions
    // ----------------------------------------------------------------

    _resume() {
        this._clearSlotPicker();
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.resume();
        this.scene.stop();
    }

    _saveGame() {
        EventBus.emit('request-save', 0);
        this._showFeedback('Game saved!', '#66ffaa');
    }

    _settings() {
        this.scene.launch('SettingsScene');
    }

    _quit() {
        this._clearSlotPicker();
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.resume();
        this.scene.stop('UIScene');
        this.scene.stop('GameScene');
        this.scene.stop('PauseMenuScene');
        this.scene.start('MainMenuScene');
    }

    _showFeedback(msg, color = '#66ffaa') {
        if (!this._feedbackText?.active) return;
        this._feedbackText.setText(msg).setColor(color);
        this.time.delayedCall(1800, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    // ----------------------------------------------------------------
    // Inline save slot picker
    // ----------------------------------------------------------------

    _toggleSlotPicker() {
        if (this._slotPickerContainer) {
            this._clearSlotPicker();
        } else {
            this._openSlotPicker();
        }
    }

    _openSlotPicker() {
        this._clearSlotPicker();

        const { width, height } = this.scale;

        const SLOT_COUNT  = 3;
        const CARD_W      = 340;
        const CARD_H      = 80;
        const PANEL_PAD   = 20;
        const PANEL_W     = CARD_W + PANEL_PAD * 2;
        const HEADER_H    = 44;
        const FOOTER_H    = 50;
        const PANEL_H     = HEADER_H + SLOT_COUNT * (CARD_H + 10) + FOOTER_H;

        // Position picker to the right of the main panel if there's room,
        // otherwise centre over the pause panel
        const mainPanelCX = width / 2;
        const pickerX = Math.min(
            mainPanelCX + 200,
            width - PANEL_W - 16
        );
        const pickerY = height / 2 - PANEL_H / 2;

        const container = this.add.container(0, 0).setDepth(19010);
        this._slotPickerContainer = container;

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(0x0a0a1e, 0.97);
        panel.fillRoundedRect(pickerX, pickerY, PANEL_W, PANEL_H, 10);
        panel.lineStyle(2, 0x3355aa, 0.9);
        panel.strokeRoundedRect(pickerX, pickerY, PANEL_W, PANEL_H, 10);
        container.add(panel);

        // Header
        const hdrTxt = this.add.text(pickerX + PANEL_W / 2, pickerY + HEADER_H / 2, 'Load Game', {
            fontFamily: 'Open Sans', fontSize: '24px', color: '#aaccff',
            stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5);
        container.add(hdrTxt);

        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, 0x334466, 0.7);
        divGfx.lineBetween(pickerX + 16, pickerY + HEADER_H, pickerX + PANEL_W - 16, pickerY + HEADER_H);
        container.add(divGfx);

        // Slot cards sub-container
        const cardsContainer = this.add.container(0, 0);
        container.add(cardsContainer);

        this._renderPickerCards(
            cardsContainer,
            pickerX + PANEL_PAD,
            pickerY + HEADER_H + 8,
            CARD_W,
            CARD_H
        );

        // Close button
        const closeY = pickerY + PANEL_H - FOOTER_H / 2;
        this._addPickerButton(
            pickerX + PANEL_W / 2, closeY, 110, 32,
            { label: 'Close', color: 0x2a1a1a, hover: 0x551111, border: 0xaa4444, action: () => this._clearSlotPicker() },
            container
        );
    }

    _renderPickerCards(cardsContainer, startX, startY, cardW, cardH) {
        cardsContainer.removeAll(true);

        const gap = 10;
        for (let slot = 0; slot < 3; slot++) {
            const y = startY + slot * (cardH + gap);
            this._renderPickerCard(cardsContainer, slot, startX, y, cardW, cardH);
        }
    }

    _renderPickerCard(container, slot, x, y, w, h) {
        const raw = localStorage.getItem(`verdance_save_${slot}`);
        let saveData = null;
        try { saveData = raw ? JSON.parse(raw) : null; } catch { saveData = null; }

        const isEmpty = !saveData;
        const fillColor   = isEmpty ? 0x111122 : 0x162236;
        const borderColor = isEmpty ? 0x223344 : 0x4477bb;

        const cardBg = this.add.graphics();
        cardBg.fillStyle(fillColor, 0.9);
        cardBg.fillRoundedRect(x, y, w, h, 6);
        cardBg.lineStyle(1, borderColor, 0.8);
        cardBg.strokeRoundedRect(x, y, w, h, 6);
        container.add(cardBg);

        // Slot number
        const numTxt = this.add.text(x + 12, y + h / 2, `${slot + 1}`, {
            fontFamily: 'Open Sans', fontSize: '25px',
            color: isEmpty ? '#445566' : '#88bbff',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        container.add(numTxt);

        if (isEmpty) {
            const emptyTxt = this.add.text(x + w / 2 + 10, y + h / 2, '— Empty —', {
                fontFamily: 'Open Sans', fontSize: '18px', color: '#445566',
            }).setOrigin(0.5);
            container.add(emptyTxt);
        } else {
            const { playerName = 'Unknown', className = '???', level = 1,
                    currentZone = '???', playtime = 0 } = saveData;
            const hrs  = Math.floor(playtime / 3600);
            const mins = Math.floor((playtime % 3600) / 60);
            const timeStr  = `${hrs}h ${String(mins).padStart(2, '0')}m`;
            const zoneLabel = currentZone.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            container.add(this.add.text(x + 36, y + 12, playerName, {
                fontFamily: 'Open Sans', fontSize: '20px', color: '#ddeeff', stroke: '#000', strokeThickness: 2,
            }));
            container.add(this.add.text(x + 36, y + 30, `${className}  Lv.${level}`, {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#88bbcc',
            }));
            container.add(this.add.text(x + 36, y + 48, zoneLabel, {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#55aa77',
            }));
            container.add(this.add.text(x + w - 90, y + 12, timeStr, {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#778899',
            }));

            // Load zone
            const loadZone = this.add.zone(x + (w - 60) / 2, y + h / 2, w - 60, h)
                .setInteractive({ useHandCursor: true });

            loadZone.on('pointerover', () => {
                cardBg.clear();
                cardBg.fillStyle(0x224466, 0.95);
                cardBg.fillRoundedRect(x, y, w, h, 6);
                cardBg.lineStyle(2, 0x66aaff, 1);
                cardBg.strokeRoundedRect(x, y, w, h, 6);
            });
            loadZone.on('pointerout', () => {
                cardBg.clear();
                cardBg.fillStyle(fillColor, 0.9);
                cardBg.fillRoundedRect(x, y, w, h, 6);
                cardBg.lineStyle(1, borderColor, 0.8);
                cardBg.strokeRoundedRect(x, y, w, h, 6);
            });
            loadZone.on('pointerdown', () => {
                EventBus.emit('request-load', slot);
                this._clearSlotPicker();
                this._resume();
            });
            container.add(loadZone);

            // Delete button (small, right side)
            this._addPickerButton(x + w - 26, y + h / 2, 40, 26, {
                label: 'Del',
                color: 0x3a0a0a, hover: 0x771111, border: 0xcc2222,
                action: () => {
                    localStorage.removeItem(`verdance_save_${slot}`);
                    const parent = container.parentContainer ?? container.scene;
                    this._renderPickerCards(container, x, y - slot * (h + 10), w, h);
                },
            }, container);
        }
    }

    _addPickerButton(cx, cy, bw, bh, def, container) {
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const bg = this.add.graphics();
        const draw = (fillColor, borderAlpha) => {
            bg.clear();
            bg.fillStyle(fillColor, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 5);
            bg.lineStyle(1, def.border, borderAlpha);
            bg.strokeRoundedRect(bx, by, bw, bh, 5);
        };
        draw(def.color, 0.6);

        const lbl = this.add.text(cx, cy, def.label, {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ffffff',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => draw(def.hover, 1.0));
        zone.on('pointerout',  () => draw(def.color, 0.6));
        zone.on('pointerdown', () => def.action());

        if (container) {
            container.add(bg);
            container.add(lbl);
            container.add(zone);
        }
    }

    _clearSlotPicker() {
        if (this._slotPickerContainer) {
            this._slotPickerContainer.destroy(true);
            this._slotPickerContainer = null;
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this._clearSlotPicker();
    }
}
