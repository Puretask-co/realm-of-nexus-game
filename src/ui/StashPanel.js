import EventBus from '../core/EventBus.js';

/**
 * StashPanel — 6×10 grid UI for the player's Vault (60 item slots).
 *
 * Triggered by `stash:open` event.  ESC closes.
 * Clicking an occupied slot sends the item back to the player inventory
 * via `inventory:addItem` and removes it from the stash.
 *
 * Constructed in UIScene and added to that scene's create() method.
 */
export class StashPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._slots = new Array(60).fill(null);
        this._slotElements = [];   // array of { bg, label } per slot
        this._elements = [];       // all root elements for show/hide

        this._build();
        this._setupEvents();
    }

    // ----------------------------------------------------------------
    // Build
    // ----------------------------------------------------------------

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;

        const COLS = 6;
        const ROWS = 10;
        const SLOT = 48;
        const PAD = 6;
        const HEADER = 52;
        const MARGIN = 12;

        const pw = COLS * (SLOT + PAD) + PAD + MARGIN * 2;
        const ph = ROWS * (SLOT + PAD) + PAD + HEADER + MARGIN;
        const px = width / 2 - pw / 2;
        const py = height / 2 - ph / 2;

        this._px = px; this._py = py;
        this._pw = pw; this._ph = ph;

        const DEPTH = 17000;

        // ── Dim overlay ──
        this._overlay = s.add.graphics().setDepth(DEPTH);
        this._overlay.fillStyle(0x000000, 0.45);
        this._overlay.fillRect(0, 0, width, height);

        // ── Background panel ──
        this._bg = s.add.graphics().setDepth(DEPTH + 1);
        this._bg.fillStyle(0x0b0b1a, 0.97);
        this._bg.fillRoundedRect(px, py, pw, ph, 10);
        this._bg.lineStyle(2, 0x997700, 0.85);
        this._bg.strokeRoundedRect(px, py, pw, ph, 10);

        // ── Title ──
        this._titleText = s.add.text(px + pw / 2, py + 18, 'VAULT', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#ffcc44',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(DEPTH + 2);

        // ── Subtitle ──
        this._subText = s.add.text(px + pw / 2, py + 40, '0 / 60 items stored', {
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            color: '#888866'
        }).setOrigin(0.5, 0).setDepth(DEPTH + 2);

        // ── Close button ──
        this._closeBtn = this._makeButton(
            px + pw - 20, py + 16, 28, 24, 'X',
            0x661111, 0xaa2222, () => this.hide()
        );

        // ── Divider ──
        this._divider = s.add.graphics().setDepth(DEPTH + 2);
        this._divider.lineStyle(1, 0x553300, 0.6);
        this._divider.lineBetween(px + MARGIN, py + HEADER - 4, px + pw - MARGIN, py + HEADER - 4);

        // ── Slot grid ──
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const idx = row * COLS + col;
                const sx = px + MARGIN + PAD + col * (SLOT + PAD);
                const sy = py + HEADER + PAD + row * (SLOT + PAD);

                // Slot background
                const slotBg = s.add.graphics().setDepth(DEPTH + 2);
                slotBg.fillStyle(0x1a1a2e, 0.9);
                slotBg.fillRect(sx, sy, SLOT, SLOT);
                slotBg.lineStyle(1, 0x334455, 0.7);
                slotBg.strokeRect(sx, sy, SLOT, SLOT);

                // Item label (truncated, initially empty)
                const lbl = s.add.text(sx + SLOT / 2, sy + SLOT / 2, '', {
                    fontFamily: 'monospace',
                    fontSize: '8px',
                    color: '#cccccc',
                    wordWrap: { width: SLOT - 4 }
                }).setOrigin(0.5).setDepth(DEPTH + 3);

                // Rarity border overlay (drawn dynamically)
                const rarityBorder = s.add.graphics().setDepth(DEPTH + 3);

                // Hit zone
                const hit = s.add.zone(sx + SLOT / 2, sy + SLOT / 2, SLOT, SLOT)
                    .setInteractive({ useHandCursor: true })
                    .setDepth(DEPTH + 4);

                hit.on('pointerover', () => {
                    if (this._slots[idx]) {
                        slotBg.clear();
                        slotBg.fillStyle(0x2a2a44, 0.95);
                        slotBg.fillRect(sx, sy, SLOT, SLOT);
                        slotBg.lineStyle(1, 0x6688aa, 0.9);
                        slotBg.strokeRect(sx, sy, SLOT, SLOT);
                    }
                });
                hit.on('pointerout', () => {
                    this._redrawSlot(idx, sx, sy, SLOT, slotBg, rarityBorder, lbl);
                });
                hit.on('pointerdown', () => {
                    this._onSlotClick(idx);
                });

                this._slotElements.push({ slotBg, lbl, rarityBorder, hit, sx, sy, SLOT });
            }
        }

        // ── ESC to close ──
        this._escKey = s.input.keyboard.on('keydown-ESC', () => {
            if (this.visible) this.hide();
        });

        // Root elements list for show/hide
        this._elements = [
            this._overlay, this._bg, this._titleText, this._subText, this._divider,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit
        ];
        for (const se of this._slotElements) {
            this._elements.push(se.slotBg, se.lbl, se.rarityBorder, se.hit);
        }

        this._setVisible(false);
    }

    // ----------------------------------------------------------------
    // Events
    // ----------------------------------------------------------------

    _setupEvents() {
        this._unsubs = [
            EventBus.on('stash:open', () => this.show()),
            EventBus.on('stash:updated', ({ slots }) => {
                this._slots = slots;
                this._refresh();
            })
        ];
    }

    // ----------------------------------------------------------------
    // Slot interaction
    // ----------------------------------------------------------------

    _onSlotClick(idx) {
        const item = this._slots[idx];
        if (!item) return;

        // Return item to player inventory
        EventBus.emit('inventory:addItem', {
            itemId: item.id,
            quantity: item.quantity || 1,
            itemData: { ...item }
        });

        // Remove from stash
        EventBus.emit('stash:removeItem', { slotIndex: idx });
    }

    // ----------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------

    _refresh() {
        let count = 0;
        for (let idx = 0; idx < 60; idx++) {
            const el = this._slotElements[idx];
            if (!el) continue;
            const { slotBg, lbl, rarityBorder, sx, sy, SLOT } = el;
            this._redrawSlot(idx, sx, sy, SLOT, slotBg, rarityBorder, lbl);
            if (this._slots[idx]) count++;
        }
        if (this._subText?.active) {
            this._subText.setText(`${count} / 60 items stored`);
        }
    }

    _redrawSlot(idx, sx, sy, SLOT, slotBg, rarityBorder, lbl) {
        const item = this._slots[idx];

        slotBg.clear();
        slotBg.fillStyle(0x1a1a2e, 0.9);
        slotBg.fillRect(sx, sy, SLOT, SLOT);
        slotBg.lineStyle(1, 0x334455, 0.7);
        slotBg.strokeRect(sx, sy, SLOT, SLOT);

        rarityBorder.clear();

        if (item) {
            // Rarity color
            const rarityColors = {
                common:    0x888888,
                uncommon:  0x44aa44,
                rare:      0x4466ff,
                epic:      0xaa44ff,
                legendary: 0xffaa00
            };
            const borderColor = rarityColors[item.rarity?.toLowerCase()] || rarityColors.common;
            rarityBorder.lineStyle(2, borderColor, 1.0);
            rarityBorder.strokeRect(sx + 1, sy + 1, SLOT - 2, SLOT - 2);

            // Truncate name to fit
            const name = (item.name || item.id || '?').slice(0, 10);
            lbl.setText(name).setColor('#dddddd');
        } else {
            lbl.setText('');
        }
    }

    // ----------------------------------------------------------------
    // Visibility
    // ----------------------------------------------------------------

    show() {
        this.visible = true;
        this._setVisible(true);
        this._refresh();
    }

    hide() {
        this.visible = false;
        this._setVisible(false);
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.active) el.setVisible(v);
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick) {
        const s = this.scene;
        const DEPTH = 17002;
        const bx = cx - bw / 2, by = cy - bh / 2;
        const bg = s.add.graphics().setDepth(DEPTH);
        const draw = (c) => { bg.clear(); bg.fillStyle(c, 0.9); bg.fillRoundedRect(bx, by, bw, bh, 4); };
        draw(color);
        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(DEPTH + 1);
        const hit = s.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(DEPTH + 1);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }
}

export default StashPanel;
