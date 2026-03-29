import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * SpellbookPanel — Full-screen codex overlay showing spells the player knows.
 *
 * Open/close:
 *   - K key (wired in UIScene)
 *   - EventBus event 'spellbook-open'
 *   - Escape closes it
 *
 * Data:
 *   - Listens to 'player:spellsUpdated' { spells: ['spell_id', ...] }
 *   - Falls back to dataManager.getAllSpells() if no player spells known
 */
export class SpellbookPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;

        // spell id list the player knows; null = show full codex
        this._knownSpellIds = null;
        // All spell objects available to display
        this._allSpells = [];
        // Grouped: { groupName: [spell, ...], ... }
        this._groups = {};
        this._groupNames = [];

        // Currently selected spell object
        this._selectedSpell = null;

        // Flat ordered list for the left column (matches what's rendered)
        this._listEntries = []; // { type: 'header'|'spell', label, spell? }
        this._rowObjects = [];  // Phaser text objects for each row
        this._scrollOffset = 0;
        this._maxVisibleRows = 14;

        this._elements = [];

        this._build();
        this._setupEvents();
    }

    // ------------------------------------------------------------------
    // Build
    // ------------------------------------------------------------------

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;

        const pw = 680, ph = 480;
        const px = Math.floor(width / 2 - pw / 2);
        const py = Math.floor(height / 2 - ph / 2);

        this._pw = pw; this._ph = ph;
        this._px = px; this._py = py;

        // --- Background + border ---
        this._bg = s.add.graphics()
            .setDepth(190)
            .setScrollFactor(0);

        // --- Title ---
        this._titleText = s.add.text(px + pw / 2, py + 22, 'SPELLBOOK & CODEX', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#ffcc44',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(191).setScrollFactor(0);

        // Decorative divider (drawn in _redrawBg)
        this._divGfx = s.add.graphics().setDepth(191).setScrollFactor(0);

        // --- Close button ---
        this._closeBtn = this._makeButton(
            px + pw - 18, py + 18, 26, 22, 'X',
            0x661111, 0xaa2222, () => this.hide()
        );

        // --- Left column header ---
        this._leftHeader = s.add.text(px + 16, py + 52, 'SPELLS KNOWN', {
            fontFamily: 'Georgia, serif',
            fontSize: '10px',
            color: '#7788aa',
            letterSpacing: 1,
        }).setDepth(191).setScrollFactor(0);

        // --- Scroll arrows ---
        this._scrollUpBtn = this._makeButton(
            px + 196 / 2, py + ph - 30, 28, 22, '▲',
            0x223344, 0x3355aa, () => this._scroll(-1)
        );
        this._scrollDnBtn = this._makeButton(
            px + 196 / 2, py + ph - 8, 28, 22, '▼',
            0x223344, 0x3355aa, () => this._scroll(1)
        );

        // --- Right column ---
        const rx = px + 210; // right column X
        const ry = py + 58;

        this._detailName = s.add.text(rx, ry, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '19px',
            color: '#ffffff',
            stroke: '#000',
            strokeThickness: 3,
        }).setDepth(191).setScrollFactor(0);

        this._detailBadge = s.add.text(rx, ry + 28, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            color: '#aaddff',
            stroke: '#000',
            strokeThickness: 2,
        }).setDepth(191).setScrollFactor(0);

        // Stat boxes: Damage | Sap Cost | DSP Cost | Range
        this._statBoxGfx = s.add.graphics().setDepth(191).setScrollFactor(0);
        this._statLabels = [];
        this._statValues = [];
        const statDefs = ['Damage', 'Sap Cost', 'DSP Cost', 'Range'];
        const boxW = 96, boxH = 42, boxGap = 6;
        for (let i = 0; i < 4; i++) {
            const bx = rx + i * (boxW + boxGap);
            const by = ry + 50;
            const lbl = s.add.text(bx + boxW / 2, by + 6, statDefs[i], {
                fontFamily: 'Georgia, serif',
                fontSize: '9px',
                color: '#7788aa',
            }).setOrigin(0.5, 0).setDepth(192).setScrollFactor(0);
            const val = s.add.text(bx + boxW / 2, by + 18, '—', {
                fontFamily: 'Georgia, serif',
                fontSize: '15px',
                color: '#ffdd88',
                stroke: '#000',
                strokeThickness: 2,
            }).setOrigin(0.5, 0).setDepth(192).setScrollFactor(0);
            this._statLabels.push(lbl);
            this._statValues.push(val);
        }

        // Lore text
        this._loreText = s.add.text(rx, ry + 102, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '12px',
            color: '#cc9944',
            fontStyle: 'italic',
            wordWrap: { width: pw - 230 },
        }).setDepth(191).setScrollFactor(0);

        // Description text
        this._descText = s.add.text(rx, ry + 102 + 72, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '12px',
            color: '#ccccdd',
            wordWrap: { width: pw - 230 },
        }).setDepth(191).setScrollFactor(0);

        // Tactical notes header
        this._tacticalHeader = s.add.text(rx, ry + 102 + 72 + 72, 'TACTICAL', {
            fontFamily: 'Georgia, serif',
            fontSize: '10px',
            color: '#7788aa',
            letterSpacing: 1,
        }).setDepth(191).setScrollFactor(0);

        this._tacticalText = s.add.text(rx, ry + 102 + 72 + 72 + 14, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            color: '#aabbcc',
            wordWrap: { width: pw - 230 },
        }).setDepth(191).setScrollFactor(0);

        // Divider between columns (drawn in _redrawBg)
        // Hint bar at bottom right
        this._hintText = s.add.text(px + pw - 16, py + ph - 14, 'K or ESC to close', {
            fontFamily: 'Georgia, serif',
            fontSize: '10px',
            color: '#445566',
        }).setOrigin(1, 1).setDepth(191).setScrollFactor(0);

        // --- Left list rows (pre-allocated text objects) ---
        this._rowObjects = [];
        for (let i = 0; i < this._maxVisibleRows; i++) {
            const rowY = py + 70 + i * 24;
            const rowBg = s.add.graphics().setDepth(191).setScrollFactor(0);
            const rowTxt = s.add.text(px + 16, rowY + 4, '', {
                fontFamily: 'Georgia, serif',
                fontSize: '12px',
                color: '#ccccdd',
            }).setDepth(192).setScrollFactor(0);
            const rowHit = s.add.zone(px + 8, rowY + 2, 190, 22)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(193)
                .setScrollFactor(0);
            rowHit.on('pointerdown', () => this._onRowClick(i));
            this._rowObjects.push({ rowBg, rowTxt, rowHit, rowY });
        }

        // Collect all Phaser objects for show/hide
        this._elements = [
            this._bg, this._titleText, this._divGfx,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit,
            this._leftHeader,
            this._scrollUpBtn.bg, this._scrollUpBtn.txt, this._scrollUpBtn.hit,
            this._scrollDnBtn.bg, this._scrollDnBtn.txt, this._scrollDnBtn.hit,
            this._detailName, this._detailBadge,
            this._statBoxGfx,
            this._loreText, this._descText,
            this._tacticalHeader, this._tacticalText,
            this._hintText,
            ...this._statLabels, ...this._statValues,
        ];
        for (const row of this._rowObjects) {
            this._elements.push(row.rowBg, row.rowTxt, row.rowHit);
        }

        this._setVisible(false);
    }

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    _setupEvents() {
        EventBus.on('spellbook-open', () => this.show());
        EventBus.on('player:spellsUpdated', (data) => {
            if (data?.spells) {
                this._knownSpellIds = data.spells;
                if (this.visible) this._refreshSpellList();
            }
        });

        this.scene.input.keyboard.on('keydown-ESC', () => {
            if (this.visible) this.hide();
        });
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    toggle() {
        if (this.visible) this.hide();
        else this.show();
    }

    show() {
        this._refreshSpellList();
        this._redrawBg();
        this._setVisible(true);
        this.visible = true;
    }

    hide() {
        this._setVisible(false);
        this.visible = false;
    }

    // ------------------------------------------------------------------
    // Spell list management
    // ------------------------------------------------------------------

    _refreshSpellList() {
        // Load all spells from DataManager
        let pool = dataManager.getAllSpells?.() || [];

        // Filter to known spells if we have them
        if (this._knownSpellIds && this._knownSpellIds.length > 0) {
            const idSet = new Set(this._knownSpellIds);
            pool = pool.filter(sp => idSet.has(sp.id));
        }

        this._allSpells = pool;

        // Group by element (used as "school")
        this._groups = {};
        for (const spell of pool) {
            const group = spell.element || spell.class || 'general';
            if (!this._groups[group]) this._groups[group] = [];
            this._groups[group].push(spell);
        }

        // Sort group names
        this._groupNames = Object.keys(this._groups).sort();

        // Build flat entry list: header + spells per group
        this._listEntries = [];
        for (const gName of this._groupNames) {
            this._listEntries.push({ type: 'header', label: gName.toUpperCase() });
            for (const sp of this._groups[gName]) {
                this._listEntries.push({ type: 'spell', label: sp.name, spell: sp });
            }
        }

        this._scrollOffset = 0;

        // Auto-select first spell
        const firstSpell = this._listEntries.find(e => e.type === 'spell');
        this._selectedSpell = firstSpell?.spell || null;

        this._renderList();
        this._renderDetail(this._selectedSpell);
    }

    _scroll(dir) {
        const max = Math.max(0, this._listEntries.length - this._maxVisibleRows);
        this._scrollOffset = Math.max(0, Math.min(max, this._scrollOffset + dir));
        this._renderList();
    }

    _onRowClick(rowIndex) {
        const entryIndex = this._scrollOffset + rowIndex;
        const entry = this._listEntries[entryIndex];
        if (!entry || entry.type !== 'spell') return;
        this._selectedSpell = entry.spell;
        this._renderList();
        this._renderDetail(entry.spell);
    }

    // ------------------------------------------------------------------
    // Rendering — left list
    // ------------------------------------------------------------------

    _renderList() {
        const visible = this._listEntries.slice(
            this._scrollOffset,
            this._scrollOffset + this._maxVisibleRows
        );

        for (let i = 0; i < this._maxVisibleRows; i++) {
            const row = this._rowObjects[i];
            const entry = visible[i];

            row.rowBg.clear();

            if (!entry) {
                row.rowTxt.setText('').setVisible(true);
                row.rowHit.setVisible(false);
                continue;
            }

            if (entry.type === 'header') {
                row.rowTxt.setText(entry.label)
                    .setColor('#5566aa')
                    .setFontSize('10px')
                    .setVisible(true);
                // Subtle separator line
                const lx = this._px + 8;
                const ly = row.rowY;
                row.rowBg.lineStyle(1, 0x223355, 0.5);
                row.rowBg.lineBetween(lx, ly + 20, lx + 186, ly + 20);
                row.rowHit.setVisible(false);
            } else {
                const isSelected = this._selectedSpell?.id === entry.spell.id;
                const baseColor = this._elementColor(entry.spell.element);

                if (isSelected) {
                    row.rowBg.fillStyle(0x1a2a1a, 0.85);
                    row.rowBg.fillRoundedRect(this._px + 8, row.rowY, 188, 22, 3);
                    row.rowBg.lineStyle(1, 0xffcc44, 0.7);
                    row.rowBg.strokeRoundedRect(this._px + 8, row.rowY, 188, 22, 3);
                }

                row.rowTxt.setText('  ' + entry.label)
                    .setColor(isSelected ? '#ffdd66' : baseColor)
                    .setFontSize('12px')
                    .setVisible(true);
                row.rowHit.setVisible(true);
            }
        }
    }

    // ------------------------------------------------------------------
    // Rendering — right detail pane
    // ------------------------------------------------------------------

    _renderDetail(spell) {
        if (!spell) {
            this._detailName.setText('Select a spell');
            this._detailBadge.setText('');
            for (const v of this._statValues) v.setText('—');
            this._loreText.setText('');
            this._descText.setText('');
            this._tacticalText.setText('');
            this._statBoxGfx.clear();
            return;
        }

        const elemColor = this._elementColor(spell.element);
        const elemColorHex = this._elementColorHex(spell.element);

        // Name
        this._detailName.setText(spell.name).setColor(elemColor);

        // Badge row
        const parts = [];
        if (spell.element) parts.push(spell.element.toUpperCase());
        if (spell.class && spell.class !== 'shared') parts.push(spell.class.toUpperCase());
        if (spell.tier) parts.push(`Tier ${spell.tier}`);
        if (spell.isUltimate) parts.push('ULTIMATE');
        this._detailBadge.setText(parts.join('  ·  ')).setColor(elemColor);

        // Stat boxes
        this._drawStatBoxes(elemColorHex);
        const dmgVal = spell.damage || (spell.baseDamage ? String(spell.baseDamage) : '—');
        const sapVal = spell.sapCost != null ? String(spell.sapCost) : '—';
        const dspVal = spell.dspCost != null ? String(spell.dspCost) : '—';
        const rangeVal = spell.range != null ? `${spell.range}t` : '—';
        const statData = [dmgVal, sapVal, dspVal, rangeVal];
        for (let i = 0; i < 4; i++) {
            this._statValues[i].setText(statData[i]);
        }

        // Lore text — use description as lore if no dedicated loreText field
        const lore = spell.loreText || spell.description || '';
        this._loreText.setText(lore ? `"${lore}"` : '');

        // Description shown only if loreText exists separately (otherwise lore IS the desc)
        const desc = spell.loreText ? (spell.description || '') : '';
        this._descText.setText(desc);

        // Tactical notes
        const tacParts = [];
        if (spell.apCost != null) tacParts.push(`AP: ${spell.apCost}`);
        if (spell.cooldown != null) tacParts.push(`Cooldown: ${spell.cooldown}`);
        if (spell.targetType) tacParts.push(`Target: ${spell.targetType.replace(/_/g, ' ')}`);
        if (spell.areaOfEffect) tacParts.push(`AoE: ${spell.areaOfEffect}t radius`);
        if (spell.concentration) tacParts.push('Concentration');
        if (spell.duration) tacParts.push(`Duration: ${spell.duration} turns`);
        if (spell.canCombo && spell.combosWith?.length) {
            tacParts.push(`Combos: ${spell.combosWith.join(', ')}`);
        }
        this._tacticalText.setText(tacParts.join('   '));
    }

    _drawStatBoxes(borderColorHex) {
        const g = this._statBoxGfx;
        g.clear();
        const { _px: px, _py: py, _pw: pw } = this;
        const rx = px + 210;
        const ry = py + 58;
        const boxW = 96, boxH = 42, boxGap = 6;
        for (let i = 0; i < 4; i++) {
            const bx = rx + i * (boxW + boxGap);
            const by = ry + 50;
            g.fillStyle(0x0d1a2a, 0.85);
            g.fillRoundedRect(bx, by, boxW, boxH, 4);
            g.lineStyle(1, borderColorHex, 0.5);
            g.strokeRoundedRect(bx, by, boxW, boxH, 4);
        }
    }

    // ------------------------------------------------------------------
    // Background drawing
    // ------------------------------------------------------------------

    _redrawBg() {
        const { _px: px, _py: py, _pw: pw, _ph: ph } = this;
        const g = this._bg;
        g.clear();

        // Main panel
        g.fillStyle(0x0a0d1a, 0.96);
        g.fillRoundedRect(px, py, pw, ph, 10);
        g.lineStyle(2, 0xbb8822, 0.85);
        g.strokeRoundedRect(px, py, pw, ph, 10);

        // Title underline
        g.lineStyle(1, 0x886622, 0.6);
        g.lineBetween(px + 16, py + 46, px + pw - 16, py + 46);

        // Left/right column divider
        g.lineStyle(1, 0x223344, 0.7);
        g.lineBetween(px + 202, py + 50, px + 202, py + ph - 16);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    _elementColor(element) {
        const map = {
            nature:   '#55cc66',
            shadow:   '#bb88ff',
            spirit:   '#aaccff',
            physical: '#ddcc88',
            radiant:  '#ffee66',
            void:     '#cc44ff',
            fire:     '#ff6644',
            ice:      '#88ddff',
            lightning:'#ffff44',
        };
        return map[element] || '#ccccdd';
    }

    _elementColorHex(element) {
        const map = {
            nature:   0x55cc66,
            shadow:   0xbb88ff,
            spirit:   0xaaccff,
            physical: 0xddcc88,
            radiant:  0xffee66,
            void:     0xcc44ff,
            fire:     0xff6644,
            ice:      0x88ddff,
            lightning:0xffff44,
        };
        return map[element] || 0xccccdd;
    }

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick) {
        const s = this.scene;
        const bx = cx - bw / 2, by = cy - bh / 2;
        const bg = s.add.graphics().setDepth(191).setScrollFactor(0);
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
        };
        draw(color);
        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            color: '#ffffff',
            stroke: '#000',
            strokeThickness: 1,
        }).setOrigin(0.5).setDepth(192).setScrollFactor(0);
        const hit = s.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(193)
            .setScrollFactor(0);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
    }
}
