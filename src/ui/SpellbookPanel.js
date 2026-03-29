import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * SpellbookPanel — 750×520 overlay toggled by K key from UIScene.
 *
 * Layout
 *   LEFT  (220px) — class filter tabs + scrollable spell list
 *   CENTER(320px) — selected spell detail with VFX preview
 *   RIGHT (210px) — 6 equipped spell slots
 *
 * Events emitted
 *   spellbook:equipped  { slotIndex: number, spellId: string }
 *
 * Events consumed
 *   spellbook-open      → show()
 *   class:applied       → refresh list
 *   player:spellsUpdated { spells: string[] } → refresh list
 */
export class SpellbookPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;

        // ── state ──────────────────────────────────────────────────────────
        this._allSpells      = [];      // all spells from DataManager
        this._filteredSpells = [];      // after class filter
        this._listEntries    = [];      // { spell } flat list for display
        this._scrollOffset   = 0;
        this._maxVisibleRows = 16;

        this._selectedSpell   = null;
        this._selectedSlot    = null;   // 0-5 or null
        this._equippedSlots   = [null, null, null, null, null, null]; // spellId | null
        this._activeFilter    = 'all';  // 'all' | classId

        this._knownSpellIds   = null;   // null = show all
        this._playerLevel     = 1;
        this._playerClassId   = null;

        // Phaser display objects
        this._elements       = [];
        this._rowObjects     = [];
        this._vfxTweens      = [];

        this._build();
        this._setupEvents();
    }

    // ────────────────────────────────────────────────────────────────────────
    // BUILD
    // ────────────────────────────────────────────────────────────────────────

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;

        const PW = 750, PH = 520;
        const PX = Math.floor(width  / 2 - PW / 2);
        const PY = Math.floor(height / 2 - PH / 2);

        this._PW = PW; this._PH = PH;
        this._PX = PX; this._PY = PY;

        const DEPTH = 8500;

        // ── Background ───────────────────────────────────────────────────
        this._bg = s.add.graphics().setDepth(DEPTH).setScrollFactor(0);

        // ── Title bar ────────────────────────────────────────────────────
        this._titleText = s.add.text(PX + PW / 2, PY + 14, 'SPELLBOOK', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#ffcc44',
            stroke: '#000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(DEPTH + 2).setScrollFactor(0);

        // Close button
        this._closeBtn = this._makeButton(
            PX + PW - 18, PY + 18, 28, 22, 'X',
            0x661111, 0xaa2222, () => this.hide(),
            DEPTH + 3
        );

        // ── CLASS FILTER TABS ────────────────────────────────────────────
        const CLASSES = ['all', 'bloomguard', 'thornbinder', 'emerald_mystic', 'wildkin_ranger', 'sporecaller'];
        const CLASS_LABELS = { all: 'ALL', bloomguard: 'Bloom', thornbinder: 'Thorn', emerald_mystic: 'Mystic', wildkin_ranger: 'Ranger', sporecaller: 'Spore' };
        this._filterTabs = [];
        const tabW = 35, tabH = 18, tabGap = 1;
        const tabsStartX = PX + 4;
        for (let i = 0; i < CLASSES.length; i++) {
            const classId = CLASSES[i];
            const tx = tabsStartX + i * (tabW + tabGap);
            const ty = PY + 42;
            const tab = this._makeButton(
                tx + tabW / 2, ty + tabH / 2, tabW, tabH, CLASS_LABELS[classId],
                0x1a2a1a, 0x2a3a2a,
                () => { this._activeFilter = classId; this._refreshList(); this._renderFilterTabs(); },
                DEPTH + 3,
                '9px'
            );
            tab._classId = classId;
            this._filterTabs.push(tab);
        }

        // ── LEFT COLUMN — spell list ──────────────────────────────────────
        const LX = PX + 4;
        const listStartY = PY + 64;

        this._leftHeader = s.add.text(LX, PY + 52, 'SPELLS', {
            fontFamily: 'Georgia, serif',
            fontSize: '9px',
            color: '#7788aa',
            letterSpacing: 1,
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // Scroll arrows
        this._scrollUpBtn = this._makeButton(
            LX + 105, PY + PH - 28, 30, 18, '▲',
            0x223344, 0x3355aa, () => this._scroll(-1), DEPTH + 3
        );
        this._scrollDnBtn = this._makeButton(
            LX + 105, PY + PH - 8, 30, 18, '▼',
            0x223344, 0x3355aa, () => this._scroll(1), DEPTH + 3
        );

        // Pre-allocated list rows
        this._rowObjects = [];
        for (let i = 0; i < this._maxVisibleRows; i++) {
            const rowY = listStartY + i * 26;
            const rowBg  = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
            const rowDot = s.add.graphics().setDepth(DEPTH + 2).setScrollFactor(0);
            const rowTxt = s.add.text(LX + 14, rowY + 4, '', {
                fontFamily: 'Georgia, serif',
                fontSize: '11px',
                color: '#ccccdd',
                wordWrap: { width: 190 },
            }).setDepth(DEPTH + 2).setScrollFactor(0);
            const rowSub = s.add.text(LX + 14, rowY + 15, '', {
                fontFamily: 'Georgia, serif',
                fontSize: '9px',
                color: '#667788',
            }).setDepth(DEPTH + 2).setScrollFactor(0);
            const rowHit = s.add.zone(LX, rowY, 215, 26)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(DEPTH + 4)
                .setScrollFactor(0);
            rowHit.on('pointerdown', () => this._onRowClick(i));
            this._rowObjects.push({ rowBg, rowDot, rowTxt, rowSub, rowHit, rowY });
        }

        // ── CENTER COLUMN — detail panel ─────────────────────────────────
        const CX = PX + 228;
        const CY = PY + 48;

        this._detailGfx = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);

        this._detailName = s.add.text(CX, CY, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '17px',
            color: '#ffffff',
            stroke: '#000',
            strokeThickness: 3,
            wordWrap: { width: 310 },
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        this._detailBadges = s.add.text(CX, CY + 26, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '10px',
            color: '#aaddff',
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // Stat grid (2 rows × 4 cols)
        this._statBoxGfx = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
        const STAT_DEFS = ['Damage', 'Sap Cost', 'Cooldown', 'Cast Time', 'Range', 'AoE', 'Duration', 'Dmg Type'];
        const boxW = 72, boxH = 38, bGapX = 4, bGapY = 4;
        const gridX = CX, gridY = CY + 44;
        this._statLabels = [];
        this._statValues = [];
        for (let i = 0; i < STAT_DEFS.length; i++) {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const bx  = gridX + col * (boxW + bGapX);
            const by  = gridY + row * (boxH + bGapY);
            const lbl = s.add.text(bx + boxW / 2, by + 4, STAT_DEFS[i], {
                fontFamily: 'Georgia, serif', fontSize: '8px', color: '#7788aa',
            }).setOrigin(0.5, 0).setDepth(DEPTH + 3).setScrollFactor(0);
            const val = s.add.text(bx + boxW / 2, by + 14, '—', {
                fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffdd88',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setDepth(DEPTH + 3).setScrollFactor(0);
            this._statLabels.push(lbl);
            this._statValues.push(val);
        }

        // Effects list
        this._effectsHeader = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 2, 'EFFECTS', {
            fontFamily: 'Georgia, serif', fontSize: '9px', color: '#7788aa', letterSpacing: 1,
        }).setDepth(DEPTH + 2).setScrollFactor(0);
        this._effectsText = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 14, '', {
            fontFamily: 'Georgia, serif', fontSize: '10px', color: '#aaffcc',
            wordWrap: { width: 310 },
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // Requirements
        this._reqHeader = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 42, 'REQUIREMENTS', {
            fontFamily: 'Georgia, serif', fontSize: '9px', color: '#7788aa', letterSpacing: 1,
        }).setDepth(DEPTH + 2).setScrollFactor(0);
        this._reqText = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 54, '', {
            fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ccddff',
            wordWrap: { width: 310 },
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // VFX preview area
        this._vfxBgGfx  = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
        this._vfxPrevGfx = s.add.graphics().setDepth(DEPTH + 2).setScrollFactor(0);
        this._vfxX = CX + 240;
        this._vfxY = gridY + 2 * (boxH + bGapY) + 44;

        // Description
        this._descText = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 82, '', {
            fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ccccdd',
            wordWrap: { width: 310 },
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // Lore
        this._loreText = s.add.text(CX, gridY + 2 * (boxH + bGapY) + 148, '', {
            fontFamily: 'Georgia, serif', fontSize: '10px', color: '#cc9944',
            fontStyle: 'italic', wordWrap: { width: 310 },
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        // Equip/Unequip button
        this._equipBtn = this._makeButton(
            CX + 60, PY + PH - 20, 100, 24, 'EQUIP',
            0x226633, 0x33aa55, () => this._onEquipClick(), DEPTH + 3
        );

        // ── RIGHT COLUMN — equipped slots ─────────────────────────────────
        const RX = PX + PW - 205;
        const RY = PY + 48;

        this._slotsGfx = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
        this._slotsHeader = s.add.text(RX + 4, RY - 14, 'EQUIPPED SPELLS', {
            fontFamily: 'Georgia, serif', fontSize: '9px', color: '#7788aa', letterSpacing: 1,
        }).setDepth(DEPTH + 2).setScrollFactor(0);

        this._slotObjects = [];
        for (let i = 0; i < 6; i++) {
            const sy  = RY + i * 70;
            const slotBg  = s.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);
            const slotNum = s.add.text(RX + 8, sy + 6, String(i + 1), {
                fontFamily: 'Georgia, serif', fontSize: '13px', color: '#7788aa',
                stroke: '#000', strokeThickness: 2,
            }).setDepth(DEPTH + 2).setScrollFactor(0);
            const slotName = s.add.text(RX + 26, sy + 6, '— empty —', {
                fontFamily: 'Georgia, serif', fontSize: '11px', color: '#444455',
                wordWrap: { width: 160 },
            }).setDepth(DEPTH + 2).setScrollFactor(0);
            const slotSap = s.add.text(RX + 26, sy + 22, '', {
                fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ffdd66',
            }).setDepth(DEPTH + 2).setScrollFactor(0);
            const slotUnequip = this._makeButton(
                RX + 172, sy + 14, 22, 18, 'X',
                0x441111, 0x882222, () => this._unequipSlot(i), DEPTH + 3
            );
            const slotHit = s.add.zone(RX, sy, 196, 66)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(DEPTH + 4)
                .setScrollFactor(0);
            slotHit.on('pointerdown', () => this._onSlotClick(i));
            this._slotObjects.push({ slotBg, slotNum, slotName, slotSap, slotUnequip, slotHit, sy });
        }

        // Hint text
        this._hintText = s.add.text(PX + PW - 12, PY + PH - 8, 'K or ESC to close', {
            fontFamily: 'Georgia, serif', fontSize: '9px', color: '#445566',
        }).setOrigin(1, 1).setDepth(DEPTH + 2).setScrollFactor(0);

        // ── Collect all elements ─────────────────────────────────────────
        this._elements = [
            this._bg,
            this._titleText,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit,
            this._leftHeader,
            this._scrollUpBtn.bg, this._scrollUpBtn.txt, this._scrollUpBtn.hit,
            this._scrollDnBtn.bg, this._scrollDnBtn.txt, this._scrollDnBtn.hit,
            this._detailGfx,
            this._detailName, this._detailBadges,
            this._statBoxGfx,
            this._effectsHeader, this._effectsText,
            this._reqHeader, this._reqText,
            this._vfxBgGfx, this._vfxPrevGfx,
            this._descText, this._loreText,
            this._equipBtn.bg, this._equipBtn.txt, this._equipBtn.hit,
            this._slotsGfx, this._slotsHeader,
            this._hintText,
            ...this._statLabels, ...this._statValues,
        ];
        for (const tab of this._filterTabs) {
            this._elements.push(tab.bg, tab.txt, tab.hit);
        }
        for (const row of this._rowObjects) {
            this._elements.push(row.rowBg, row.rowDot, row.rowTxt, row.rowSub, row.rowHit);
        }
        for (const slot of this._slotObjects) {
            this._elements.push(slot.slotBg, slot.slotNum, slot.slotName, slot.slotSap,
                slot.slotUnequip.bg, slot.slotUnequip.txt, slot.slotUnequip.hit, slot.slotHit);
        }

        this._setVisible(false);
    }

    // ────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ────────────────────────────────────────────────────────────────────────

    _setupEvents() {
        EventBus.on('spellbook-open', () => this.show());
        EventBus.on('class:applied', () => {
            this._playerClassId = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
            if (this.visible) { this._refreshList(); }
        });
        EventBus.on('player:spellsUpdated', (data) => {
            if (data?.spells) {
                this._knownSpellIds = data.spells;
                if (this.visible) this._refreshList();
            }
        });
        EventBus.on('player-stats-updated', (data) => {
            if (data?.level) this._playerLevel = data.level;
        });

        this.scene.input.keyboard.on('keydown-ESC', () => {
            if (this.visible) this.hide();
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ────────────────────────────────────────────────────────────────────────

    toggle() { if (this.visible) this.hide(); else this.show(); }

    show() {
        this._playerClassId = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
        this._refreshList();
        this._redrawBg();
        this._renderFilterTabs();
        this._renderSlots();
        this._setVisible(true);
        this.visible = true;
    }

    hide() {
        this._killVfxTweens();
        this._setVisible(false);
        this.visible = false;
    }

    // ────────────────────────────────────────────────────────────────────────
    // DATA / LIST MANAGEMENT
    // ────────────────────────────────────────────────────────────────────────

    _refreshList() {
        let pool = dataManager.getAllSpells?.() || [];

        // Filter to known spells if we have an explicit set
        if (this._knownSpellIds && this._knownSpellIds.length > 0) {
            const idSet = new Set(this._knownSpellIds);
            pool = pool.filter(sp => idSet.has(sp.id));
        }
        this._allSpells = pool;

        // Apply class filter
        if (this._activeFilter && this._activeFilter !== 'all') {
            this._filteredSpells = pool.filter(sp =>
                (sp.classId || sp.class) === this._activeFilter
            );
        } else {
            this._filteredSpells = pool;
        }

        // Build flat entry list (no headers — filter tabs replace grouping)
        this._listEntries = this._filteredSpells.map(sp => ({ spell: sp }));
        this._scrollOffset = 0;
        this._selectedSpell = this._listEntries[0]?.spell || null;
        this._renderList();
        this._renderDetail(this._selectedSpell);
    }

    _scroll(dir) {
        const max = Math.max(0, this._listEntries.length - this._maxVisibleRows);
        this._scrollOffset = Math.max(0, Math.min(max, this._scrollOffset + dir));
        this._renderList();
    }

    _onRowClick(rowIndex) {
        const entry = this._listEntries[this._scrollOffset + rowIndex];
        if (!entry) return;
        this._selectedSpell = entry.spell;
        this._renderList();
        this._renderDetail(entry.spell);
    }

    // ────────────────────────────────────────────────────────────────────────
    // RENDER — left list
    // ────────────────────────────────────────────────────────────────────────

    _renderList() {
        const visible = this._listEntries.slice(
            this._scrollOffset,
            this._scrollOffset + this._maxVisibleRows
        );

        const equippedIds = new Set(this._equippedSlots.filter(Boolean));

        for (let i = 0; i < this._maxVisibleRows; i++) {
            const row   = this._rowObjects[i];
            const entry = visible[i];

            row.rowBg.clear();
            row.rowDot.clear();

            if (!entry) {
                row.rowTxt.setText('').setVisible(false);
                row.rowSub.setText('').setVisible(false);
                row.rowHit.setVisible(false);
                continue;
            }

            const sp = entry.spell;
            const isSelected  = this._selectedSpell?.id === sp.id;
            const isEquipped   = equippedIds.has(sp.id);
            const isLocked     = this._isLocked(sp);
            const elemColorHex = this._elementColorHex(sp.element);

            // Row background
            if (isSelected) {
                row.rowBg.fillStyle(0x182818, 0.9);
                row.rowBg.fillRoundedRect(this._PX + 4, row.rowY, 218, 25, 3);
                row.rowBg.lineStyle(1, isEquipped ? 0xffcc00 : 0x44aa66, 0.8);
                row.rowBg.strokeRoundedRect(this._PX + 4, row.rowY, 218, 25, 3);
            } else if (isEquipped) {
                row.rowBg.lineStyle(1, 0xffcc00, 0.5);
                row.rowBg.strokeRoundedRect(this._PX + 4, row.rowY, 218, 25, 3);
            }

            // Element colour dot
            row.rowDot.fillStyle(elemColorHex, isLocked ? 0.3 : 0.9);
            row.rowDot.fillCircle(this._PX + 10, row.rowY + 8, 4);

            // Name
            row.rowTxt.setText(sp.name)
                .setColor(isLocked ? '#555566' : (isSelected ? '#ffdd66' : this._elementColor(sp.element)))
                .setFontSize('11px')
                .setVisible(true);

            // Sub-line: type tag + sap cost + cooldown
            const sapKey  = sp.sapCost ?? sp.dspCost ?? '—';
            const cdKey   = sp.cooldown != null ? `${sp.cooldown}s` : '—';
            const typeTag = (sp.type || sp.element || '').toUpperCase().slice(0, 8);
            row.rowSub.setText(`${typeTag}  SAP:${sapKey}  CD:${cdKey}`)
                .setColor(isLocked ? '#333344' : '#556677')
                .setVisible(true);

            row.rowHit.setVisible(true);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // RENDER — center detail
    // ────────────────────────────────────────────────────────────────────────

    _renderDetail(spell) {
        this._killVfxTweens();
        this._vfxPrevGfx.clear();
        this._vfxBgGfx.clear();
        this._statBoxGfx.clear();
        this._detailGfx.clear();

        if (!spell) {
            this._detailName.setText('Select a spell').setColor('#667788');
            this._detailBadges.setText('');
            this._effectsText.setText('');
            this._reqText.setText('');
            this._descText.setText('');
            this._loreText.setText('');
            this._equipBtn.txt.setText('EQUIP');
            for (const v of this._statValues) v.setText('—');
            return;
        }

        const isEquipped = this._equippedSlots.includes(spell.id);
        const isLocked   = this._isLocked(spell);
        const elemColor  = this._elementColor(spell.element);
        const elemHex    = this._elementColorHex(spell.element);

        // Name + badges
        this._detailName.setText(spell.name).setColor(isLocked ? '#555566' : elemColor);

        const badges = [];
        if (spell.element)   badges.push(`[${spell.element.toUpperCase()}]`);
        if (spell.type)      badges.push(`[${spell.type.toUpperCase()}]`);
        if (spell.attackType) badges.push(spell.attackType);
        if (spell.tier)      badges.push(`Tier ${spell.tier}`);
        if (spell.isUltimate) badges.push('ULTIMATE');
        this._detailBadges.setText(badges.join('  ·  ')).setColor(elemColor);

        // Stat grid boxes
        const { _PX: PX, _PY: PY } = this;
        const CX = PX + 228, CY = PY + 48;
        const gridY = CY + 44;
        const boxW = 72, boxH = 38, bGapX = 4, bGapY = 4;

        for (let i = 0; i < 8; i++) {
            const col = i % 4, row = Math.floor(i / 4);
            const bx  = CX + col * (boxW + bGapX);
            const by  = gridY + row * (boxH + bGapY);
            this._statBoxGfx.fillStyle(0x0d1a2a, 0.85);
            this._statBoxGfx.fillRoundedRect(bx, by, boxW, boxH, 3);
            this._statBoxGfx.lineStyle(1, elemHex, 0.4);
            this._statBoxGfx.strokeRoundedRect(bx, by, boxW, boxH, 3);
        }

        // Stat values
        const sapCost  = spell.sapCost != null ? spell.sapCost : (spell.dspCost ?? '—');
        const dmg      = spell.damage || '—';
        const cd       = spell.cooldown != null ? `${spell.cooldown}s` : '—';
        const ct       = spell.castTime != null ? `${spell.castTime}s` : (spell.apCost != null ? `${spell.apCost}AP` : '—');
        const range    = spell.range != null && spell.range > 0 ? `${spell.range}` : (spell.areaOfEffect ? '—' : 'self');
        const aoe      = spell.aoeRadius != null && spell.aoeRadius > 0 ? `${spell.aoeRadius}r` :
                          (spell.areaOfEffect ? `${spell.areaOfEffect}t` : '—');
        const dur      = spell.duration != null && spell.duration > 0 ? `${spell.duration}t` : '—';
        const dmgType  = spell.damageType || spell.element || '—';

        const statData = [dmg, String(sapCost), cd, ct, range, aoe, dur, dmgType];
        for (let i = 0; i < 8; i++) {
            this._statValues[i].setText(statData[i]);
        }

        // Effects
        const effectsRow = spell.effects || [];
        const effectsStr = effectsRow.map(e => `▸ ${this._describeEffect(e)}`).join('\n');
        this._effectsText.setText(effectsStr || '—');

        // Requirements checklist
        const req = spell.requirements || {};
        const reqLines = [];
        if (req.level) {
            const met = this._playerLevel >= req.level;
            reqLines.push(`${met ? '✓' : '✗'} Level ${req.level}`);
        }
        if (req.insight) {
            reqLines.push(`? Insight ${req.insight} (stat check)`);
        }
        if (req.classId) {
            const met = (this._playerClassId === req.classId);
            reqLines.push(`${met ? '✓' : '✗'} Class: ${req.classId}`);
        }
        this._reqText.setText(reqLines.length ? reqLines.join('\n') : 'None');

        // VFX preview
        this._drawVfxPreview(spell);

        // Description + lore
        this._descText.setText(spell.description || '');
        this._loreText.setText(spell.lore ? `"${spell.lore}"` : '');

        // Equip button
        this._equipBtn.txt.setText(isEquipped ? 'UNEQUIP' : (isLocked ? 'LOCKED' : 'EQUIP'));
        const btnColor  = isEquipped ? 0x662211 : (isLocked ? 0x333333 : 0x226633);
        const btnHover  = isEquipped ? 0xaa3322 : (isLocked ? 0x333333 : 0x33aa55);
        this._equipBtn._color = btnColor;
        this._equipBtn._hover = btnHover;
        this._equipBtn.bg.clear();
        const ebx = this._PX + 228 + 60 - 50, eby = this._PY + this._PH - 20 - 12;
        this._equipBtn.bg.fillStyle(btnColor, 0.9);
        this._equipBtn.bg.fillRoundedRect(ebx, eby, 100, 24, 4);
    }

    _drawVfxPreview(spell) {
        const vx = this._vfxX, vy = this._vfxY;
        const r  = 28;
        const color = spell.vfxColor
            ? parseInt(spell.vfxColor.replace('#', ''), 16)
            : this._elementColorHex(spell.element);

        // Background circle
        this._vfxBgGfx.fillStyle(0x0a0d1a, 0.85);
        this._vfxBgGfx.fillCircle(vx, vy, r + 4);
        this._vfxBgGfx.lineStyle(1, color, 0.5);
        this._vfxBgGfx.strokeCircle(vx, vy, r + 4);

        // Animated shape based on vfxType
        const type = spell.vfxType || 'burst';
        this._vfxPrevGfx.clear();
        this._vfxPrevGfx.fillStyle(color, 0.7);

        if (type === 'shield' || type === 'nova') {
            this._vfxPrevGfx.strokeCircle(vx, vy, r * 0.7);
        } else if (type === 'beam') {
            this._vfxPrevGfx.fillRect(vx - 3, vy - r, 6, r * 2);
        } else if (type === 'projectile') {
            this._vfxPrevGfx.fillTriangle(vx, vy - r * 0.8, vx - 6, vy + r * 0.6, vx + 6, vy + r * 0.6);
        } else if (type === 'summon') {
            this._vfxPrevGfx.fillStar(vx, vy, 5, r * 0.5, r * 0.2);
        } else if (type === 'channel') {
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                const px = vx + Math.cos(a) * r * 0.6;
                const py = vy + Math.sin(a) * r * 0.6;
                this._vfxPrevGfx.fillCircle(px, py, 5);
            }
        } else {
            // burst default
            this._vfxPrevGfx.fillCircle(vx, vy, r * 0.55);
        }

        // Pulse tween
        const t1 = this.scene.tweens.add({
            targets: this._vfxPrevGfx,
            alpha: { from: 0.5, to: 1.0 },
            scaleX: { from: 0.85, to: 1.05 },
            scaleY: { from: 0.85, to: 1.05 },
            duration: 700 + Math.random() * 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        this._vfxTweens.push(t1);
    }

    _killVfxTweens() {
        for (const t of this._vfxTweens) {
            if (t && t.isPlaying()) t.stop();
        }
        this._vfxTweens = [];
    }

    // ────────────────────────────────────────────────────────────────────────
    // RENDER — right slots
    // ────────────────────────────────────────────────────────────────────────

    _renderSlots() {
        const RX = this._PX + this._PW - 205;

        for (let i = 0; i < 6; i++) {
            const slot    = this._slotObjects[i];
            const spellId = this._equippedSlots[i];
            const spell   = spellId ? this._allSpells.find(s => s.id === spellId) : null;
            const isActive = this._selectedSlot === i;

            slot.slotBg.clear();
            slot.slotBg.fillStyle(0x0d1a1d, 0.8);
            slot.slotBg.fillRoundedRect(RX, slot.sy, 196, 64, 4);
            slot.slotBg.lineStyle(1, isActive ? 0xffcc44 : (spellId ? 0x336633 : 0x223333), 0.8);
            slot.slotBg.strokeRoundedRect(RX, slot.sy, 196, 64, 4);

            if (spell) {
                slot.slotName.setText(spell.name)
                    .setColor(this._elementColor(spell.element));
                const sapKey = spell.sapCost ?? spell.dspCost ?? '—';
                slot.slotSap.setText(`SAP: ${sapKey}  CD: ${spell.cooldown ?? '—'}s`);
                slot.slotUnequip.bg.setVisible(true);
                slot.slotUnequip.txt.setVisible(true);
                slot.slotUnequip.hit.setVisible(true);
            } else {
                slot.slotName.setText(isActive ? '← click a spell' : '— empty —').setColor(isActive ? '#ffcc44' : '#444455');
                slot.slotSap.setText('');
                slot.slotUnequip.bg.setVisible(false);
                slot.slotUnequip.txt.setVisible(false);
                slot.slotUnequip.hit.setVisible(false);
            }
        }
    }

    _onSlotClick(slotIndex) {
        this._selectedSlot = (this._selectedSlot === slotIndex) ? null : slotIndex;
        this._renderSlots();

        // If a spell is selected and slot is being targeted, equip it
        if (this._selectedSlot !== null && this._selectedSpell && !this._isLocked(this._selectedSpell)) {
            this._equipToSlot(this._selectedSlot, this._selectedSpell.id);
        }
    }

    _onEquipClick() {
        if (!this._selectedSpell) return;
        const isEquipped = this._equippedSlots.includes(this._selectedSpell.id);
        if (isEquipped) {
            // Unequip from whichever slot holds it
            const idx = this._equippedSlots.indexOf(this._selectedSpell.id);
            this._unequipSlot(idx);
        } else {
            if (this._isLocked(this._selectedSpell)) return;
            // Find first empty slot or use selectedSlot
            const target = this._selectedSlot !== null
                ? this._selectedSlot
                : this._equippedSlots.findIndex(s => s === null);
            if (target === -1) return; // all slots full
            this._equipToSlot(target, this._selectedSpell.id);
        }
    }

    _equipToSlot(slotIndex, spellId) {
        // Remove from any existing slot first
        const existing = this._equippedSlots.indexOf(spellId);
        if (existing !== -1) this._equippedSlots[existing] = null;
        this._equippedSlots[slotIndex] = spellId;
        this._selectedSlot = null;
        EventBus.emit('spellbook:equipped', { slotIndex, spellId });
        this._renderSlots();
        this._renderList();
        this._renderDetail(this._selectedSpell);
    }

    _unequipSlot(slotIndex) {
        this._equippedSlots[slotIndex] = null;
        EventBus.emit('spellbook:equipped', { slotIndex, spellId: null });
        this._renderSlots();
        this._renderList();
        this._renderDetail(this._selectedSpell);
    }

    // ────────────────────────────────────────────────────────────────────────
    // RENDER — filter tabs
    // ────────────────────────────────────────────────────────────────────────

    _renderFilterTabs() {
        const CLASSES = ['all', 'bloomguard', 'thornbinder', 'emerald_mystic', 'wildkin_ranger', 'sporecaller'];
        for (let i = 0; i < this._filterTabs.length; i++) {
            const tab = this._filterTabs[i];
            const isActive = this._activeFilter === CLASSES[i];
            tab.bg.clear();
            const tabW = 35, tabH = 18;
            const tx = this._PX + 4 + i * (tabW + 1);
            const ty = this._PY + 42;
            tab.bg.fillStyle(isActive ? 0x226633 : 0x0d1a1d, 0.9);
            tab.bg.fillRoundedRect(tx, ty, tabW, tabH, 3);
            tab.bg.lineStyle(1, isActive ? 0x44cc66 : 0x223333, 0.7);
            tab.bg.strokeRoundedRect(tx, ty, tabW, tabH, 3);
            tab.txt.setColor(isActive ? '#ffffff' : '#7788aa');
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // BACKGROUND DRAW
    // ────────────────────────────────────────────────────────────────────────

    _redrawBg() {
        const { _PX: PX, _PY: PY, _PW: PW, _PH: PH } = this;
        const g = this._bg;
        g.clear();

        // Main panel
        g.fillStyle(0x080d18, 0.97);
        g.fillRoundedRect(PX, PY, PW, PH, 10);
        g.lineStyle(2, 0xbb8822, 0.85);
        g.strokeRoundedRect(PX, PY, PW, PH, 10);

        // Title underline
        g.lineStyle(1, 0x886622, 0.55);
        g.lineBetween(PX + 12, PY + 40, PX + PW - 12, PY + 40);

        // Left column divider
        g.lineStyle(1, 0x223344, 0.6);
        g.lineBetween(PX + 222, PY + 40, PX + 222, PY + PH - 12);

        // Right column divider
        g.lineStyle(1, 0x223344, 0.6);
        g.lineBetween(PX + PW - 208, PY + 40, PX + PW - 208, PY + PH - 12);
    }

    // ────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────────────────

    _isLocked(spell) {
        const req = spell.requirements || {};
        if (req.level && this._playerLevel < req.level) return true;
        if (req.classId && this._playerClassId && this._playerClassId !== req.classId) return true;
        return false;
    }

    _describeEffect(effectStr) {
        if (!effectStr) return effectStr;
        const parts = String(effectStr).split(':');
        const key   = parts[0];
        const map = {
            stun: `Stun for ${parts[1] || '?'}`,
            poison: `Poison ${parts[1] || '?'} dmg/turn for ${parts[2] || '?'}`,
            heal: `Heal ${parts[1] || '?'} HP`,
            slow: `Slow ${parts[1] || '?'} for ${parts[2] || '?'}`,
            bleed: `Bleed ${parts[1] || '?'} dmg/turn for ${parts[2] || '?'}`,
            root: `Root for ${parts[1] || '?'}`,
            silence: `Silence for ${parts[1] || '?'}`,
            reflect: `Reflect ${parts[1] || '?'} of damage`,
            revive: `Revive at ${parts[1] || '?'}`,
            summon: `Summon ${parts[1] || '?'}`,
            confuse: `Confuse for ${parts[1] || '?'}`,
            taunt_aoe: `Force enemies to target you for ${parts[1] || '?'}`,
            marked: `Mark: target takes ${parts[1] || '?'} extra damage`,
            restore_sap: `Restore ${parts[1] || '?'} SAP`,
        };
        return map[key] || effectStr;
    }

    _elementColor(element) {
        const map = {
            verdant: '#55cc66', nature: '#55cc66', silver: '#aaccff',
            arcane: '#bb88ff', shadow: '#bb88ff', void: '#cc44ff',
            physical: '#ddcc88', radiant: '#ffee66', crimson: '#ff6644',
            fire: '#ff6644', ice: '#88ddff', lightning: '#ffff44',
            spirit: '#aaccff', light: '#ffffaa',
        };
        return map[element] || '#ccccdd';
    }

    _elementColorHex(element) {
        const map = {
            verdant: 0x55cc66, nature: 0x55cc66, silver: 0xaaccff,
            arcane: 0xbb88ff, shadow: 0xbb88ff, void: 0xcc44ff,
            physical: 0xddcc88, radiant: 0xffee66, crimson: 0xff6644,
            fire: 0xff6644, ice: 0x88ddff, lightning: 0xffff44,
            spirit: 0xaaccff, light: 0xffffaa,
        };
        return map[element] || 0xccccdd;
    }

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick, depth, fontSize = '11px') {
        const s   = this.scene;
        const bx  = cx - bw / 2, by = cy - bh / 2;
        const bg  = s.add.graphics().setDepth(depth).setScrollFactor(0);
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
        };
        draw(color);
        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'Georgia, serif', fontSize, color: '#ffffff',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
        const hit = s.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth + 2)
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
