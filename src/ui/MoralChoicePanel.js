import EventBus from '../core/EventBus.js';

/**
 * MoralChoicePanel — Full-screen modal overlay for moral choice moments.
 *
 * Listens to `moral-choice-present` with payload:
 *   { id, title, description, choices: [{ id, label, consequence, impact: { dsp, faction, factionDelta } }] }
 *
 * Emits on selection:
 *   `moral-choice-made`  → { choiceId: id, selectedChoice: choiceObj }
 *   `resume-world`       → signals GameScene to resume physics
 *
 * Emits on open:
 *   `pause-world`        → signals GameScene to pause physics
 */
export class MoralChoicePanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._currentChoice = null;
        this._paused = false;
        this._choiceButtons = [];
        this._timerTween = null;
        this._elements = [];

        this._build();
        this._setupEvents();
    }

    // ----------------------------------------------------------------
    // Build
    // ----------------------------------------------------------------

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const cx = width / 2;
        const cy = height / 2;

        // Full-screen dimming overlay
        this._dim = s.add.rectangle(cx, cy, width, height, 0x000000, 0.75)
            .setScrollFactor(0)
            .setDepth(199)
            .setInteractive(); // blocks clicks on the game world

        // Main panel box (700 x 420)
        const pw = 700, ph = 420;
        this._panel = s.add.rectangle(cx, cy, pw, ph, 0x1a1a2e)
            .setScrollFactor(0)
            .setDepth(200)
            .setStrokeStyle(2, 0xffd700, 0.8);

        // Title bar background strip
        this._titleBar = s.add.rectangle(cx, cy - ph / 2 + 28, pw, 56, 0x0d0d1f)
            .setScrollFactor(0)
            .setDepth(201);

        // Title text
        this._titleText = s.add.text(cx, cy - ph / 2 + 28, '', {
            fontFamily: 'Open Sans',
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(202);

        // Description text (wraps inside panel)
        this._descText = s.add.text(cx, cy - ph / 2 + 80, '', {
            fontFamily: 'Open Sans',
            fontSize: '18px',
            color: '#e0e0e0',
            wordWrap: { width: pw - 60 },
            align: 'center'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);

        // Timer bar background
        this._timerBarBg = s.add.rectangle(cx, cy + ph / 2 - 14, pw - 40, 8, 0x222244)
            .setScrollFactor(0)
            .setDepth(201);

        // Timer bar fill (shrinks from full to 0 via tween)
        this._timerBarFill = s.add.rectangle(
            cx - (pw - 40) / 2,
            cy + ph / 2 - 14,
            pw - 40, 8, 0xffd700
        ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(202);

        // Collect non-button base elements
        this._elements = [
            this._dim, this._panel, this._titleBar,
            this._titleText, this._descText,
            this._timerBarBg, this._timerBarFill
        ];

        this._setVisible(false);
    }

    // ----------------------------------------------------------------
    // Event wiring
    // ----------------------------------------------------------------

    _setupEvents() {
        // Store unsubs so destroy() can clear listeners — otherwise scene
        // restarts (death respawn / new game) accumulate handlers.
        this._unsubs = this._unsubs || [];
        this._unsubs.push(EventBus.on('moral-choice-present', (data) => this.open(data)));
        this._unsubs.push(EventBus.on('resume-world', () => {
            if (this.visible) this.hide();
        }));
    }

    // ----------------------------------------------------------------
    // Open / hide
    // ----------------------------------------------------------------

    open(data) {
        if (this.visible) return; // don't stack panels
        this._currentChoice = data;
        this.visible = true;

        // Pause the game world
        EventBus.emit('pause-world');
        this._paused = true;

        // Populate content
        this._titleText.setText(data.title || 'A Choice Awaits');
        this._descText.setText(data.description || '');

        // Reposition description based on actual text height
        const s = this.scene;
        const { height } = s.scale;
        const cy = height / 2;
        const ph = 420;

        // Build choice buttons
        this._clearChoiceButtons();
        this._buildChoiceButtons(data.choices || [], cy, ph);

        // Show everything
        this._setVisible(true);
        for (const btn of this._choiceButtons) btn.show();

        // Timer bar reset + tween (30 seconds)
        const pw = 700;
        this._timerBarFill.setSize(pw - 40, 8).setPosition(
            s.scale.width / 2 - (pw - 40) / 2,
            cy + ph / 2 - 14
        );

        if (this._timerTween) { this._timerTween.stop(); this._timerTween = null; }
        this._timerTween = s.tweens.add({
            targets: this._timerBarFill,
            scaleX: 0,
            duration: 30000,
            ease: 'Linear',
            onComplete: () => {
                // Auto-select last option (neutral/destroy choice) if time expires
                const choices = data.choices || [];
                if (choices.length > 0) {
                    this._selectChoice(choices[choices.length - 1]);
                }
            }
        });

        // Animate panel in
        s.tweens.add({
            targets: [this._panel, this._titleBar, this._titleText, this._descText],
            alpha: { from: 0, to: 1 },
            duration: 300,
            ease: 'Power2'
        });
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;

        if (this._timerTween) { this._timerTween.stop(); this._timerTween = null; }

        this._setVisible(false);
        for (const btn of this._choiceButtons) btn.hide();

        this._currentChoice = null;
        this._paused = false;
    }

    // ----------------------------------------------------------------
    // Choice buttons
    // ----------------------------------------------------------------

    _buildChoiceButtons(choices, cy, ph) {
        const s = this.scene;
        const cx = s.scale.width / 2;
        const btnW = 620;
        const btnH = 52;

        // Vertical layout: start below description area
        // Panel occupies cy - 210 to cy + 210
        // Title bar at top ~56px, description ~65px → choices start ~cy - 65
        const choiceAreaTop = cy - 60;
        const choiceSpacing = btnH + 12;

        choices.forEach((choice, i) => {
            const btnY = choiceAreaTop + i * choiceSpacing;
            const btn = new ChoiceButton(s, cx, btnY, btnW, btnH, choice, () => {
                this._selectChoice(choice);
            });
            this._choiceButtons.push(btn);
        });
    }

    _clearChoiceButtons() {
        for (const btn of this._choiceButtons) btn.destroy();
        this._choiceButtons = [];
    }

    _selectChoice(choice) {
        if (!this._currentChoice) return;

        EventBus.emit('moral-choice-made', {
            choiceId: this._currentChoice.id,
            selectedChoice: choice
        });

        EventBus.emit('resume-world');
        this.hide();
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
    }
}

// ----------------------------------------------------------------
// ChoiceButton — a single selectable choice row
// ----------------------------------------------------------------

class ChoiceButton {
    constructor(scene, cx, cy, bw, bh, choiceData, onClick) {
        this.scene = scene;
        this.choiceData = choiceData;
        this._elements = [];

        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const normalColor = 0x2d4a3e;
        const hoverColor  = 0x3d6a5e;

        // Background
        this._bg = scene.add.graphics().setScrollFactor(0).setDepth(203);
        const drawBg = (color) => {
            this._bg.clear();
            this._bg.fillStyle(color, 0.92);
            this._bg.fillRoundedRect(bx, by, bw, bh, 6);
            this._bg.lineStyle(1, 0x4a8a6e, 0.6);
            this._bg.strokeRoundedRect(bx, by, bw, bh, 6);
        };
        drawBg(normalColor);

        // Label text (left-aligned)
        this._labelText = scene.add.text(bx + 16, cy - 9, choiceData.label || '', {
            fontFamily: 'Open Sans',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(204);

        // Consequence text (smaller, italic-ish — right side, dimmed by default)
        this._consequenceText = scene.add.text(bx + 16, cy + 8, choiceData.consequence || '', {
            fontFamily: 'Open Sans',
            fontSize: '14px',
            color: '#aaaaaa',
            wordWrap: { width: bw - 230 }
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(204).setAlpha(0.7);

        // Impact indicators (right side)
        const impact = choiceData.impact || {};
        const impactLines = this._buildImpactLines(impact);
        this._impactText = scene.add.text(bx + bw - 16, cy, impactLines.text, {
            fontFamily: 'Open Sans',
            fontSize: '15px',
            color: impactLines.color,
            align: 'right'
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(204);

        // Hit zone for interaction
        this._hit = scene.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(205);

        this._hit.on('pointerover', () => {
            drawBg(hoverColor);
            this._consequenceText.setAlpha(1);
            this._labelText.setColor('#ffd700');
        });
        this._hit.on('pointerout', () => {
            drawBg(normalColor);
            this._consequenceText.setAlpha(0.7);
            this._labelText.setColor('#ffffff');
        });
        this._hit.on('pointerdown', () => onClick());

        this._elements = [this._bg, this._labelText, this._consequenceText, this._impactText, this._hit];
    }

    _buildImpactLines(impact) {
        const lines = [];
        let color = '#aaaaaa';

        if (impact.dsp !== undefined && impact.dsp !== 0) {
            const sign = impact.dsp > 0 ? '+' : '';
            const dspColor = impact.dsp > 0 ? '#44ff88' : '#ff4444';
            lines.push({ text: `DSP: ${sign}${impact.dsp}`, color: dspColor });
        }

        if (impact.faction && impact.factionDelta !== 0) {
            const sign = impact.factionDelta > 0 ? '+' : '';
            const factionLabel = this._formatFactionName(impact.faction);
            lines.push({ text: `${factionLabel}: ${sign}${impact.factionDelta}`, color: '#ffaa44' });
        }

        if (lines.length === 0) {
            return { text: 'No change', color: '#666666' };
        }

        // Join lines; use the color of the first meaningful line
        // For simplicity, render as a single text block with the first line's color
        // (Phaser basic Text doesn't support per-character color without RichText)
        color = lines[0].color;
        return { text: lines.map(l => l.text).join('\n'), color };
    }

    _formatFactionName(factionId) {
        return factionId
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    show() {
        for (const el of this._elements) if (el?.setVisible) el.setVisible(true);
    }

    hide() {
        for (const el of this._elements) if (el?.setVisible) el.setVisible(false);
    }

    destroy() {
        if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
        this._unsubs = [];
        for (const el of this._elements) if (el?.destroy) el.destroy();
        this._elements = [];
    }
}

export default MoralChoicePanel;
