import { EventBus } from '../core/EventBus.js';

/**
 * VeilkeeperPanel — Consult the Veil's keepers for knowledge.
 *
 * Design mechanic: "Knowledge costs lives."
 * Each consultation costs 10 Sap (DSP) and adds Hollowing to the keeper.
 * When a keeper's Hollowing maxes out, they die — that knowledge domain is locked forever.
 *
 * Triggered by EventBus event `veilkeeper-open`.
 * Emits `veilkeeper-consult` with { keeperId, question, cost: 10 }.
 * Emits `veilkeeper-close` when hidden.
 */
export class VeilkeeperPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._selectedKeeperId = null;
        this._selectedQuestion = null;
        this._deadKeepers = new Set();
        this._elements = [];
        this._keeperSlots = [];
        this._questionBtns = [];

        this._build();
        this._setupEvents();
    }

    // ----------------------------------------------------------------
    // Build UI
    // ----------------------------------------------------------------

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const pw = 540, ph = 520;
        const px = width / 2 - pw / 2;
        const py = height / 2 - ph / 2;

        this._px = px; this._py = py; this._pw = pw; this._ph = ph;

        // Background
        this._bg = s.add.graphics().setDepth(200).setScrollFactor(0);
        this._drawBg();

        // Title
        this._titleText = s.add.text(width / 2, py + 24, 'Seek the Veil\'s Counsel', {
            fontFamily: 'Open Sans', fontSize: '28px', color: '#cc99ff',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // Subtitle / flavour
        this._subtitleText = s.add.text(width / 2, py + 50, 'Knowledge costs lives. Choose with care.', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#886699',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // Divider
        this._dividerGfx = s.add.graphics().setDepth(201).setScrollFactor(0);
        this._dividerGfx.lineStyle(1, 0x553377, 0.7);
        this._dividerGfx.lineBetween(px + 16, py + 68, px + pw - 16, py + 68);

        // ---- Keeper slots (3 fixed keepers shown by the panel) ----
        const keeperData = [
            { id: 'sylthara', name: 'Sylthara', specialty: 'Combat Wisdom' },
            { id: 'morvein',  name: 'Morvein',  specialty: 'Hidden Paths'  },
            { id: 'elduin',   name: 'Elduin',   specialty: 'Future Events' }
        ];

        const slotY = py + 84;
        const slotW = 140, slotH = 72;
        const slotSpacing = 16;
        const totalW = 3 * slotW + 2 * slotSpacing;
        const slotStartX = width / 2 - totalW / 2;

        this._keeperSlots = keeperData.map((kd, i) => {
            const sx = slotStartX + i * (slotW + slotSpacing);
            return this._buildKeeperSlot(kd, sx, slotY, slotW, slotH);
        });

        // ---- Selected keeper display ----
        this._selectedLabel = s.add.text(px + 16, py + 178, 'Selected Keeper:', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#886699'
        }).setDepth(201).setScrollFactor(0);

        this._selectedName = s.add.text(px + 130, py + 178, '—', {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#cc99ff',
            fontStyle: 'bold'
        }).setDepth(201).setScrollFactor(0);

        this._hollowingBar = s.add.graphics().setDepth(201).setScrollFactor(0);
        this._hollowingLabel = s.add.text(px + 16, py + 198, 'Hollowing: —', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#aa6688'
        }).setDepth(201).setScrollFactor(0);

        // ---- Preset questions ----
        const questDivY = py + 226;
        const questionsDivGfx = s.add.graphics().setDepth(201).setScrollFactor(0);
        questionsDivGfx.lineStyle(1, 0x553377, 0.5);
        questionsDivGfx.lineBetween(px + 16, questDivY, px + pw - 16, questDivY);
        this._elements.push(questionsDivGfx);

        this._questionLabel = s.add.text(px + 16, questDivY + 6, 'Choose your question:', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#886699'
        }).setDepth(201).setScrollFactor(0);

        const presetQuestions = [
            'What fate awaits me?',
            'How do I restore the DSP?',
            'What does my ancestry mean?'
        ];

        this._questionBtns = presetQuestions.map((q, i) => {
            const qy = questDivY + 28 + i * 44;
            return this._buildQuestionButton(q, px + 16, qy, pw - 32, 36);
        });

        // ---- Cost display ----
        this._costText = s.add.text(px + 16, py + ph - 90, 'Cost: 10 Sap (DSP)', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#88aacc'
        }).setDepth(201).setScrollFactor(0);

        this._warningText = s.add.text(px + 16, py + ph - 72, '', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#ff8844',
            wordWrap: { width: pw - 32 }
        }).setDepth(201).setScrollFactor(0);

        // ---- Confirm / Cancel buttons ----
        this._confirmBtn = this._makeButton(
            width / 2 - 70, py + ph - 38,
            120, 30,
            'Consult', 0x442266, 0x7744bb,
            () => this._onConfirm()
        );

        this._cancelBtn = this._makeButton(
            width / 2 + 70, py + ph - 38,
            100, 30,
            'Cancel', 0x331111, 0x661111,
            () => this.hide()
        );

        // ---- Response area ----
        const responseDivY = py + ph - 94 - 80;  // above cost
        const responseDivGfx = s.add.graphics().setDepth(201).setScrollFactor(0);
        responseDivGfx.lineStyle(1, 0x553377, 0.4);
        // (No extra divider needed, response is shown in warningText area via repurpose below)
        this._elements.push(responseDivGfx);

        // Response text (distinct from warning, replaces it when a response arrives)
        this._responseText = s.add.text(px + 16, py + ph - 72, '', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#cc99ff',
            wordWrap: { width: pw - 32 }, fontStyle: 'italic'
        }).setDepth(202).setScrollFactor(0);

        // Close button (X)
        this._closeBtn = this._makeButton(
            px + pw - 16, py + 14,
            26, 22,
            'X', 0x330022, 0x661111,
            () => this.hide()
        );

        // Collect all top-level elements for show/hide
        this._elements.push(
            this._bg, this._titleText, this._subtitleText, this._dividerGfx,
            this._selectedLabel, this._selectedName, this._hollowingBar, this._hollowingLabel,
            this._questionLabel, this._costText, this._warningText, this._responseText,
            this._confirmBtn.bg, this._confirmBtn.txt, this._confirmBtn.hit,
            this._cancelBtn.bg, this._cancelBtn.txt, this._cancelBtn.hit,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit
        );

        // Add keeper slot elements
        for (const slot of this._keeperSlots) {
            this._elements.push(slot.bg, slot.nameTxt, slot.specialtyTxt, slot.hit);
            if (slot.deadLabel) this._elements.push(slot.deadLabel);
        }

        // Add question button elements
        for (const btn of this._questionBtns) {
            this._elements.push(btn.bg, btn.txt, btn.hit);
        }

        this._setVisible(false);
    }

    _buildKeeperSlot(keeperData, sx, sy, sw, sh) {
        const s = this.scene;

        const bg = s.add.graphics().setDepth(201).setScrollFactor(0);
        const drawBg = (selected, dead) => {
            bg.clear();
            if (dead) {
                bg.fillStyle(0x1a1a1a, 0.8);
            } else if (selected) {
                bg.fillStyle(0x3a1a5a, 0.95);
                bg.lineStyle(2, 0xaa66ff, 0.9);
            } else {
                bg.fillStyle(0x1a0a2e, 0.8);
                bg.lineStyle(1, 0x553377, 0.6);
            }
            bg.fillRoundedRect(sx, sy, sw, sh, 6);
            if (!dead || selected) bg.strokeRoundedRect(sx, sy, sw, sh, 6);
        };
        drawBg(false, false);

        const nameTxt = s.add.text(sx + sw / 2, sy + 16, keeperData.name, {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#cc99ff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(202).setScrollFactor(0);

        const specialtyTxt = s.add.text(sx + sw / 2, sy + 36, keeperData.specialty, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#886699'
        }).setOrigin(0.5).setDepth(202).setScrollFactor(0);

        const deadLabel = s.add.text(sx + sw / 2, sy + 54, '', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#666666', fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(202).setScrollFactor(0);

        const hit = s.add.zone(sx + sw / 2, sy + sh / 2, sw, sh)
            .setInteractive({ useHandCursor: true })
            .setDepth(203).setScrollFactor(0);

        const slot = {
            id: keeperData.id,
            name: keeperData.name,
            specialty: keeperData.specialty,
            bg, nameTxt, specialtyTxt, deadLabel, hit,
            sx, sy, sw, sh,
            selected: false,
            dead: false,
            _drawBg: drawBg
        };

        hit.on('pointerover', () => {
            if (!slot.dead && !slot.selected) {
                bg.clear();
                bg.fillStyle(0x2a0a4a, 0.95);
                bg.lineStyle(1, 0x7755aa, 0.7);
                bg.fillRoundedRect(sx, sy, sw, sh, 6);
                bg.strokeRoundedRect(sx, sy, sw, sh, 6);
            }
        });
        hit.on('pointerout', () => {
            if (!slot.dead) drawBg(slot.selected, false);
        });
        hit.on('pointerdown', () => {
            if (slot.dead) return;
            this._selectKeeper(slot.id);
        });

        return slot;
    }

    _buildQuestionButton(question, bx, by, bw, bh) {
        const s = this.scene;
        const cx = bx + bw / 2;
        const cy = by + bh / 2;

        const bg = s.add.graphics().setDepth(201).setScrollFactor(0);
        const normalColor = 0x1a0a2e;
        const hoverColor  = 0x3a1a5a;
        const activeColor = 0x442266;

        const draw = (color, border) => {
            bg.clear();
            bg.fillStyle(color, 0.9);
            bg.lineStyle(1, border, 0.6);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
            bg.strokeRoundedRect(bx, by, bw, bh, 4);
        };
        draw(normalColor, 0x553377);

        const txt = s.add.text(bx + 12, cy, question, {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ddccff'
        }).setOrigin(0, 0.5).setDepth(202).setScrollFactor(0);

        const hit = s.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(203).setScrollFactor(0);

        const btn = { bg, txt, hit, question, selected: false, draw, normalColor, hoverColor, activeColor };

        hit.on('pointerover', () => {
            if (!btn.selected) draw(hoverColor, 0x7755aa);
        });
        hit.on('pointerout', () => {
            if (!btn.selected) draw(normalColor, 0x553377);
        });
        hit.on('pointerdown', () => {
            this._selectQuestion(question);
        });

        return btn;
    }

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick) {
        const s = this.scene;
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const bg = s.add.graphics().setDepth(201).setScrollFactor(0);
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 5);
        };
        draw(color);

        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ffffff',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(202).setScrollFactor(0);

        const hit = s.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(203).setScrollFactor(0);

        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());

        return { bg, txt, hit };
    }

    _drawBg() {
        this._bg.clear();
        this._bg.fillStyle(0x1a1a2e, 0.92);
        this._bg.fillRoundedRect(this._px, this._py, this._pw, this._ph, 12);
        this._bg.lineStyle(2, 0x7744bb, 0.8);
        this._bg.strokeRoundedRect(this._px, this._py, this._pw, this._ph, 12);
    }

    // ----------------------------------------------------------------
    // Interaction logic
    // ----------------------------------------------------------------

    _selectKeeper(keeperId) {
        this._selectedKeeperId = keeperId;

        for (const slot of this._keeperSlots) {
            slot.selected = (slot.id === keeperId);
            slot._drawBg(slot.selected, slot.dead);
        }

        const slot = this._keeperSlots.find(s => s.id === keeperId);
        if (slot) {
            this._selectedName.setText(`${slot.name} (${slot.specialty})`);
        }
        this._updateHollowingDisplay(keeperId);
        this._clearResponse();
    }

    _updateHollowingDisplay(keeperId) {
        // Try to read live data from VeilkeeperSystem via EventBus bridge, fall back to —
        this._hollowingLabel.setText(`Hollowing: consulting the Veil...`);
        EventBus.getInstance().emit('veilkeeper-query-state', { keeperId, replyEvent: 'veilkeeper-state-reply' });
    }

    _selectQuestion(question) {
        this._selectedQuestion = question;

        for (const btn of this._questionBtns) {
            btn.selected = (btn.question === question);
            btn.draw(
                btn.selected ? btn.activeColor : btn.normalColor,
                btn.selected ? 0xaa77ff : 0x553377
            );
            btn.txt.setColor(btn.selected ? '#ffffff' : '#ddccff');
        }
        this._clearResponse();
    }

    _onConfirm() {
        if (!this._selectedKeeperId) {
            this._showWarning('Select a keeper first.');
            return;
        }
        if (!this._selectedQuestion) {
            this._showWarning('Choose a question first.');
            return;
        }

        const slot = this._keeperSlots.find(s => s.id === this._selectedKeeperId);
        if (slot?.dead) {
            this._showWarning('This keeper has passed beyond the Veil.');
            return;
        }

        this._warningText.setText('').setVisible(false);

        EventBus.getInstance().emit('veilkeeper-consult', {
            keeperId: this._selectedKeeperId,
            question: this._selectedQuestion,
            cost: 10
        });

        // Optimistic feedback
        this._responseText.setText('The Veil stirs... listening.').setVisible(true);
    }

    _showWarning(msg) {
        this._warningText.setText(msg).setVisible(true);
        this._responseText.setText('').setVisible(false);
    }

    _clearResponse() {
        this._warningText.setText('').setVisible(false);
        this._responseText.setText('').setVisible(false);
    }

    // ----------------------------------------------------------------
    // Event handling
    // ----------------------------------------------------------------

    _setupEvents() {
        const eb = EventBus.getInstance();
        // Store unsubs so destroy() can clear listeners — previously this
        // panel leaked 4 handlers on every scene restart.
        this._unsubs = this._unsubs || [];

        this._unsubs.push(eb.on('veilkeeper-open', (data) => {
            this.open(data);
        }));

        this._unsubs.push(eb.on('veilkeeper-response', (data) => {
            const { message, warning } = data || {};
            const text = message || warning || 'The Veil is silent.';
            if (this.visible) {
                this._responseText.setText(`"${text}"`).setVisible(true);
                this._warningText.setText('').setVisible(false);
                if (warning) this._showWarning(warning);
            }
        }));

        this._unsubs.push(eb.on('veilkeeper:died', (data) => {
            const { veilkeeperId, name } = data || {};
            if (!veilkeeperId && !name) return;
            const slot = this._keeperSlots.find(s =>
                s.id === veilkeeperId || s.name === name
            );
            if (slot) {
                this._markKeeperDead(slot);
            }
        }));

        this._unsubs.push(eb.on('veilkeeper-state-reply', (data) => {
            if (!data || data.keeperId !== this._selectedKeeperId) return;
            if (data.alive === false) {
                this._hollowingLabel.setText('Hollowing: PASSED BEYOND');
            } else if (data.currentHollowing !== undefined && data.hollowingThreshold !== undefined) {
                this._hollowingLabel.setText(
                    `Hollowing: ${data.currentHollowing} / ${data.hollowingThreshold}`
                );
            } else {
                this._hollowingLabel.setText('Hollowing: unknown');
            }
        }));
    }

    /** Clear EventBus listeners when the panel/scene tears down. */
    destroy() {
        if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
        this._unsubs = [];
    }

    _markKeeperDead(slot) {
        slot.dead = true;
        this._deadKeepers.add(slot.id);

        slot._drawBg(false, true);
        slot.nameTxt.setColor('#666666');
        slot.specialtyTxt.setColor('#444444');
        slot.deadLabel.setText('PASSED BEYOND').setVisible(true);

        // Disable the hit zone
        if (slot.hit?.disableInteractive) slot.hit.disableInteractive();

        // Deselect if this was the selected keeper
        if (this._selectedKeeperId === slot.id) {
            this._selectedKeeperId = null;
            this._selectedName.setText('—');
            this._hollowingLabel.setText('Hollowing: —');
        }
    }

    // ----------------------------------------------------------------
    // Show / Hide
    // ----------------------------------------------------------------

    open(data) {
        const { keeperId } = data || {};

        // Pre-select the keeper that triggered the open event
        if (keeperId) {
            const slot = this._keeperSlots.find(s => s.id === keeperId);
            if (slot && !slot.dead) {
                // Don't call _selectKeeper yet — let the player choose
                // But highlight the relevant one if found
            }
        }

        this._clearResponse();
        this._setVisible(true);
        this.visible = true;
    }

    hide() {
        this._setVisible(false);
        this.visible = false;
        // Reset selections
        this._selectedKeeperId = null;
        this._selectedQuestion = null;
        for (const slot of this._keeperSlots) {
            if (!slot.dead) slot._drawBg(false, false);
            slot.selected = false;
        }
        for (const btn of this._questionBtns) {
            btn.selected = false;
            btn.draw(btn.normalColor, 0x553377);
            btn.txt.setColor('#ddccff');
        }
        this._selectedName.setText('—');
        this._hollowingLabel.setText('Hollowing: —');
        this._clearResponse();

        EventBus.getInstance().emit('veilkeeper-close', {});
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
        // Keeper slot dead labels: only show if dead AND panel visible
        for (const slot of this._keeperSlots) {
            if (slot.deadLabel?.setVisible) {
                slot.deadLabel.setVisible(v && slot.dead);
            }
        }
    }
}

export default VeilkeeperPanel;
