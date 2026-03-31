import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * CharacterSheetScene — Full-screen overlay launched by pressing C in UIScene.
 *
 * Key:    CharacterSheetScene
 * Type:   Phaser.Scene launched with { active: false, visible: false }
 * Close:  ESC key or the X button
 *
 * Tabs
 *   0. STATS     — portrait, attributes, derived stats, equipment bonuses
 *   1. ABILITIES — passive + active class abilities
 *   2. SPELLS    — table view with inline expand + equip toggle
 *   3. EFFECTS   — active buffs / debuffs / permanent status effects
 */
export default class CharacterSheetScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSheetScene' });
    }

    // ────────────────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ────────────────────────────────────────────────────────────────────────

    create() {
        const { width, height } = this.scale;
        this._W = width;
        this._H = height;
        this._DEPTH = 9000;

        // ── mutable state ─────────────────────────────────────────────────
        this._activeTab       = 0;
        this._playerStats     = {};
        this._equippedSpells  = [null, null, null, null, null, null];
        this._expandedSpellId = null;

        this._buildPanel();

        // Listen for live updates while the scene is visible
        EventBus.on('player-stats-updated', (data) => {
            Object.assign(this._playerStats, data || {});
            if (this._activeTab === 0) this._drawTab(0);
        });
        EventBus.on('spellbook:equipped', ({ slotIndex, spellId }) => {
            this._equippedSpells[slotIndex] = spellId;
            if (this._activeTab === 2) this._drawTab(2);
        });

        // Pull initial state
        this._playerStats = {
            ...(globalThis.__playerStats || {}),
            ...(globalThis.__characterSystem?.getStats?.() || {}),
        };

        this._drawTabDivider(0);
        this._drawTab(0);

        // ESC / C to close
        this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
        this.input.keyboard.on('keydown-C',   () => this.scene.stop());
    }

    // ────────────────────────────────────────────────────────────────────────
    // BUILD PANEL (static chrome)
    // ────────────────────────────────────────────────────────────────────────

    _buildPanel() {
        const W = this._W, H = this._H;
        const D = this._DEPTH;

        // Backdrop
        this._backdrop = this.add.graphics().setDepth(D).setScrollFactor(0);
        this._backdrop.fillStyle(0x000000, 0.76);
        this._backdrop.fillRect(0, 0, W, H);

        // Panel geometry
        const PX = Math.floor(W * 0.04), PY = Math.floor(H * 0.03);
        const PW = Math.floor(W * 0.92), PH = Math.floor(H * 0.94);
        this._PX = PX; this._PY = PY; this._PW = PW; this._PH = PH;

        // Panel bg
        this._panelBg = this.add.graphics().setDepth(D + 1).setScrollFactor(0);
        this._panelBg.fillStyle(0x080d18, 0.98);
        this._panelBg.fillRoundedRect(PX, PY, PW, PH, 10);
        this._panelBg.lineStyle(2, 0xbb8822, 0.9);
        this._panelBg.strokeRoundedRect(PX, PY, PW, PH, 10);

        // Title
        this.add.text(PX + PW / 2, PY + 13, 'CHARACTER SHEET', {
            fontFamily: 'Open Sans', fontSize: '28px',
            color: '#ffcc44', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(D + 2).setScrollFactor(0);

        // Close button (static, tracked directly)
        const cBx = PX + PW - 34, cBy = PY + 10;
        const closeBg = this.add.graphics().setDepth(D + 3).setScrollFactor(0);
        closeBg.fillStyle(0x661111, 0.9);
        closeBg.fillRoundedRect(cBx, cBy, 28, 22, 4);
        this.add.text(cBx + 14, cBy + 11, 'X', {
            fontFamily: 'Open Sans', fontSize: '17px',
            color: '#ffffff', stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(D + 4).setScrollFactor(0);
        this.add.zone(cBx + 14, cBy + 11, 28, 22)
            .setInteractive({ useHandCursor: true })
            .setDepth(D + 5).setScrollFactor(0)
            .on('pointerdown', () => this.scene.stop());

        // Hint
        this.add.text(PX + PW - 14, PY + PH - 10, 'ESC or C to close', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#445566',
        }).setOrigin(1, 1).setDepth(D + 2).setScrollFactor(0);

        // Tab bar (4 tabs)
        const TAB_LABELS = ['STATS', 'ABILITIES', 'SPELLS', 'EFFECTS'];
        const tabStartX = PX + 16, tabY = PY + 42;
        const tabW = 120, tabH = 26, tabGap = 6;
        this._tabBtns = [];
        for (let i = 0; i < 4; i++) {
            const tx = tabStartX + i * (tabW + tabGap);
            const tbg = this.add.graphics().setDepth(D + 2).setScrollFactor(0);
            const ttxt = this.add.text(tx + tabW / 2, tabY + tabH / 2, TAB_LABELS[i], {
                fontFamily: 'Open Sans', fontSize: '17px',
                color: '#7788aa', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5).setDepth(D + 3).setScrollFactor(0);
            const thit = this.add.zone(tx + tabW / 2, tabY + tabH / 2, tabW, tabH)
                .setInteractive({ useHandCursor: true })
                .setDepth(D + 4).setScrollFactor(0);
            const idx = i;
            thit.on('pointerdown', () => {
                this._activeTab = idx;
                this._drawTabDivider(idx);
                this._drawTab(idx);
            });
            this._tabBtns.push({ tbg, ttxt, tx, tabY, tabW, tabH });
        }

        // Tab divider graphics object (redrawn on switch)
        this._divGfx = this.add.graphics().setDepth(D + 2).setScrollFactor(0);

        // Content-layer graphics (cleared + redrawn per tab)
        this._contentGfx = this.add.graphics().setDepth(D + 2).setScrollFactor(0);

        // Container for dynamic text + buttons per tab
        this._contentTexts = [];
        this._contentBtns  = [];
    }

    // ────────────────────────────────────────────────────────────────────────
    // TAB DIVIDER
    // ────────────────────────────────────────────────────────────────────────

    _drawTabDivider(activeIndex) {
        const { _PX: PX, _PY: PY, _PW: PW } = this;
        const D = this._DEPTH + 2;
        this._divGfx.clear();

        for (let i = 0; i < this._tabBtns.length; i++) {
            const { tbg, ttxt, tx, tabY, tabW, tabH } = this._tabBtns[i];
            const isAct = i === activeIndex;
            tbg.clear();
            tbg.fillStyle(isAct ? 0x226633 : 0x0d1a1d, 0.9);
            tbg.fillRoundedRect(tx, tabY, tabW, tabH, 4);
            tbg.lineStyle(1, isAct ? 0x44cc66 : 0x223333, 0.8);
            tbg.strokeRoundedRect(tx, tabY, tabW, tabH, 4);
            ttxt.setColor(isAct ? '#ffffff' : '#7788aa');
        }

        this._divGfx.lineStyle(1, 0x886622, 0.5);
        this._divGfx.lineBetween(PX + 12, PY + 72, PX + PW - 12, PY + 72);
    }

    // ────────────────────────────────────────────────────────────────────────
    // CONTENT DISPATCH
    // ────────────────────────────────────────────────────────────────────────

    _drawTab(index) {
        // Destroy previous content
        for (const t of this._contentTexts) { if (t && t.destroy) t.destroy(); }
        this._contentTexts = [];
        for (const b of this._contentBtns) {
            if (b) { b.bg?.destroy(); b.txt?.destroy(); b.hit?.destroy(); }
        }
        this._contentBtns = [];
        this._contentGfx.clear();

        switch (index) {
            case 0: this._drawStatsTab();     break;
            case 1: this._drawAbilitiesTab(); break;
            case 2: this._drawSpellsTab();    break;
            case 3: this._drawEffectsTab();   break;
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // TAB 0 — STATS
    // ────────────────────────────────────────────────────────────────────────

    _drawStatsTab() {
        const { _PX: PX, _PY: PY, _PW: PW } = this;
        const D   = this._DEPTH + 3;
        const cY  = PY + 80;
        const stats     = this._playerStats;
        const classId   = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
        const classData = classId ? (dataManager.getClassById?.(classId) || null) : null;

        // ── Portrait ─────────────────────────────────────────────────────
        const portX = PX + 20, portY = cY;
        const portW = 70,      portH = 88;
        const classHex = this._classHex(classId);

        // Class → portrait key map; add entries as portraits are loaded
        const CLASS_PORTRAIT = {
            bloomguard:     'portrait_companion_vaeril',
            thornbinder:    'portrait_companion_aeliana',
        };
        const portraitKey = CLASS_PORTRAIT[classId] || `portrait_${classId}`;
        const hasPortrait = portraitKey && this.textures.exists(portraitKey);

        // Colored rect frame (always drawn as background/border)
        this._contentGfx.fillStyle(classHex, 0.85);
        this._contentGfx.fillRect(portX, portY, portW, portH);
        this._contentGfx.lineStyle(2, 0xffcc44, 0.7);
        this._contentGfx.strokeRect(portX, portY, portW, portH);

        if (hasPortrait) {
            const portImg = this.add.image(portX + portW / 2, portY + portH / 2, portraitKey)
                .setDisplaySize(portW, portH)
                .setDepth(D).setScrollFactor(0);
            this._contentTexts.push(portImg);
        } else {
            this._addText(portX + portW / 2, portY + portH / 2, classData?.name || '?', {
                fontSize: '14px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
            }, D).setOrigin(0.5);
        }

        // Identity
        const iX = portX + portW + 18;
        this._addText(iX, portY,      stats.name     || 'Adventurer',              { fontSize: '25px', color: '#ffdd88', stroke: '#000', strokeThickness: 3 }, D);
        this._addText(iX, portY + 24, `Class: ${classData?.name || '—'}`,          { fontSize: '17px', color: '#aabbcc' }, D);
        this._addText(iX, portY + 40, `Ancestry: ${stats.ancestry || '—'}`,        { fontSize: '17px', color: '#aabbcc' }, D);
        this._addText(iX, portY + 56, `Variant: ${stats.variant || '—'}`,          { fontSize: '17px', color: '#aabbcc' }, D);
        this._addText(iX, portY + 72, `Level: ${stats.level || 1}  XP: ${stats.xp || 0}`, { fontSize: '17px', color: '#ffcc44' }, D);

        // ── Core Attributes ───────────────────────────────────────────────
        const attrX = PX + 20, attrY = cY + 108;
        this._addText(attrX, attrY - 14, 'CORE ATTRIBUTES', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);

        const ATTRS = ['might', 'agility', 'resilience', 'insight', 'charisma'];
        const ATTR_HEX = { might: 0xff6644, agility: 0x88ddff, resilience: 0x44cc66, insight: 0xaaccff, charisma: 0xffcc44 };
        const barW = 150, barH = 12, barMax = 10;

        for (let i = 0; i < ATTRS.length; i++) {
            const attr  = ATTRS[i];
            const ay    = attrY + i * 36;
            const base  = stats[attr]              ?? (classData?.baseStats?.[attr] ?? 0);
            const equip = stats[`${attr}_equip`]   ?? 0;
            const total = base + equip;
            const label = attr.charAt(0).toUpperCase() + attr.slice(1);
            const bonus = equip > 0 ? `  (+${equip} equip)` : '';

            this._addText(attrX, ay, `${label}: ${total}${bonus}`, { fontSize: '17px', color: '#ccddee' }, D);

            const barX = attrX + 190;
            this._contentGfx.fillStyle(0x0d1a2a, 0.7);
            this._contentGfx.fillRect(barX, ay + 2, barW, barH);
            this._contentGfx.lineStyle(1, 0x223344, 0.4);
            this._contentGfx.strokeRect(barX, ay + 2, barW, barH);
            const fillW = Math.max(0, Math.round(Math.min(total, barMax) / barMax * (barW - 2)));
            this._contentGfx.fillStyle(ATTR_HEX[attr] ?? 0x44cc66, 0.8);
            this._contentGfx.fillRect(barX + 1, ay + 3, fillW, barH - 2);
        }

        // ── Derived Stats ─────────────────────────────────────────────────
        const drvX = PX + Math.floor(PW / 2) + 20;
        const drvY = cY;
        this._addText(drvX, drvY - 4, 'DERIVED STATS', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);

        const DERIVED = [
            ['Max HP',       stats.maxHP       ?? (classData?.startingHP    ?? '—')],
            ['Max SAP',      stats.maxSAP      ?? '—'],
            ['Guard',        stats.guard       ?? (classData?.startingGuard ?? '—')],
            ['AP',           stats.ap          ?? (classData?.baseAP        ?? '—')],
            ['Speed',        stats.speed       ?? '—'],
            ['Evasion',      stats.evasion     ?? '—'],
            ['Carry Weight', stats.carryWeight ?? '—'],
            ['Initiative',   stats.initiative  ?? '—'],
        ];

        for (let i = 0; i < DERIVED.length; i++) {
            const [label, value] = DERIVED[i];
            const dy = drvY + 14 + i * 26;
            this._addText(drvX,       dy, `${label}:`,   { fontSize: '15px', color: '#7788aa' }, D);
            this._addText(drvX + 140, dy, String(value), { fontSize: '15px', color: '#ffdd88' }, D);
            this._contentGfx.lineStyle(1, 0x1a2a3a, 0.4);
            this._contentGfx.lineBetween(drvX, dy + 22, drvX + 220, dy + 22);
        }

        // HP bar
        const hpBarY = drvY + 14 + DERIVED.length * 26 + 14;
        const hpMax  = Number(stats.maxHP ?? classData?.startingHP ?? 100);
        const hpCur  = Number(stats.hp   ?? hpMax);
        const hBarW  = 220;
        this._addText(drvX, hpBarY, `HP: ${hpCur} / ${hpMax}`, { fontSize: '15px', color: '#44ff88' }, D);
        this._contentGfx.fillStyle(0x0d1a2a, 0.7);
        this._contentGfx.fillRect(drvX, hpBarY + 16, hBarW, 10);
        this._contentGfx.fillStyle(0x33cc66, 0.85);
        this._contentGfx.fillRect(drvX + 1, hpBarY + 17,
            Math.round((hpCur / Math.max(1, hpMax)) * (hBarW - 2)), 8);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TAB 1 — ABILITIES
    // ────────────────────────────────────────────────────────────────────────

    _drawAbilitiesTab() {
        const { _PX: PX, _PY: PY, _PW: PW } = this;
        const D   = this._DEPTH + 3;
        const cY  = PY + 82;
        const classId   = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
        const classData = classId ? (dataManager.getClassById?.(classId) || null) : null;

        if (!classData) {
            this._addText(PX + PW / 2, cY + 60, 'No class selected.', { fontSize: '20px', color: '#667788' }, D).setOrigin(0.5);
            return;
        }

        // Gather all abilities
        const levelKeys = ['level1', 'level3', 'level7', 'level10'];
        const allAbilities = [];
        for (const lk of levelKeys) {
            const arr = classData.classAbilities?.[lk];
            if (Array.isArray(arr)) allAbilities.push(...arr.map(ab => ({ ...ab, _levelKey: lk })));
        }
        const talents = classData.talentTree?.talents || [];

        const colW  = Math.floor(PW / 2) - 36;
        const leftX = PX + 20;
        const rightX = PX + Math.floor(PW / 2) + 14;

        this._addText(leftX,  cY - 2, 'CLASS ABILITIES', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);
        this._addText(rightX, cY - 2, 'TALENT TREE',     { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);

        const maxY = this._PY + this._PH - 30;
        let yL = cY + 14;

        for (const ab of allAbilities) {
            if (yL >= maxY) break;
            const isPassive  = ab.type === 'passive';
            const typeLabel  = isPassive ? '[PASSIVE]' : `[ACTIVE · ${ab.apCost ?? '?'}AP · CD:${ab.cooldown ?? '—'}]`;
            const typeColor  = isPassive ? '#aaddaa' : '#ffcc44';

            this._addText(leftX, yL, ab.name, { fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 2 }, D);
            yL += 16;
            this._addText(leftX + 4, yL, typeLabel, { fontSize: '13px', color: typeColor }, D);
            yL += 12;
            this._addText(leftX + 4, yL, ab.description || '', { fontSize: '14px', color: '#aabbcc', wordWrap: { width: colW } }, D);
            yL += this._estHeight(ab.description || '', colW, 10) + 6;
            this._contentGfx.lineStyle(1, 0x223344, 0.35);
            this._contentGfx.lineBetween(leftX, yL, leftX + colW, yL);
            yL += 8;
        }

        let yR = cY + 14;
        for (const tal of talents) {
            if (yR >= maxY) break;
            this._addText(rightX, yR, `${tal.name}  (Lv${tal.level})`, { fontSize: '17px', color: '#ccddff', stroke: '#000', strokeThickness: 2 }, D);
            yR += 15;
            this._addText(rightX + 4, yR, tal.type === 'passive' ? '[PASSIVE]' : '[ACTIVE]', { fontSize: '13px', color: '#aaddaa' }, D);
            yR += 12;
            this._addText(rightX + 4, yR, tal.description || '', { fontSize: '14px', color: '#aabbcc', wordWrap: { width: colW } }, D);
            yR += this._estHeight(tal.description || '', colW, 10) + 8;
            this._contentGfx.lineStyle(1, 0x223344, 0.35);
            this._contentGfx.lineBetween(rightX, yR, rightX + colW, yR);
            yR += 8;
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // TAB 2 — SPELLS (table)
    // ────────────────────────────────────────────────────────────────────────

    _drawSpellsTab() {
        const { _PX: PX, _PY: PY, _PW: PW } = this;
        const D   = this._DEPTH + 3;
        const cY  = PY + 82;

        const classId   = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
        const allSpells = dataManager.getAllSpells?.() || [];
        const spells = classId
            ? allSpells.filter(sp => {
                const c = sp.classId || sp.class;
                return c === classId || c === 'shared';
            })
            : allSpells;

        const equippedSet = new Set(this._equippedSpells.filter(Boolean));

        // Table header
        const COL_X = [PX + 14, PX + 214, PX + 314, PX + 388, PX + 446, PX + 506, PX + 560, PX + 624];
        const COL_H = ['Spell Name', 'Element', 'Damage', 'SAP', 'CD', 'Range', 'Tier', 'Equipped'];
        const headerY = cY;

        this._contentGfx.fillStyle(0x0d1a2a, 0.7);
        this._contentGfx.fillRect(PX + 8, headerY, PW - 16, 20);

        for (let c = 0; c < COL_H.length; c++) {
            this._addText(COL_X[c], headerY + 3, COL_H[c], { fontSize: '14px', color: '#7788aa', letterSpacing: 1 }, D);
        }

        this._contentGfx.lineStyle(1, 0x334455, 0.6);
        this._contentGfx.lineBetween(PX + 8, headerY + 22, PX + PW - 8, headerY + 22);

        const maxY  = this._PY + this._PH - 30;
        const rowH  = 22;
        let   rowY  = headerY + 26;

        for (const sp of spells) {
            if (rowY + rowH > maxY) break;

            const isExpanded = this._expandedSpellId === sp.id;
            const isEquipped = equippedSet.has(sp.id);
            const elemColor  = this._elementColor(sp.element);

            if (isExpanded) {
                this._contentGfx.fillStyle(0x182818, 0.65);
                this._contentGfx.fillRect(PX + 8, rowY, PW - 16, rowH);
            }
            if (isEquipped) {
                this._contentGfx.lineStyle(1, 0xffcc00, 0.5);
                this._contentGfx.strokeRect(PX + 8, rowY, PW - 16, rowH);
            }

            const sapKey = sp.sapCost != null ? sp.sapCost : (sp.dspCost ?? '—');
            const cells  = [
                sp.name,
                (sp.element || '—').toUpperCase(),
                sp.damage || '—',
                String(sapKey),
                sp.cooldown != null ? `${sp.cooldown}s` : '—',
                sp.range    != null && sp.range > 0 ? String(sp.range) : 'self',
                sp.tier     != null ? String(sp.tier) : '—',
                isEquipped ? '★ YES' : '—',
            ];
            const cellColors = [
                elemColor, elemColor, '#ffdd88', '#ffdd88',
                '#ffdd88', '#ffdd88', '#aabbcc', isEquipped ? '#ffcc44' : '#556677',
            ];

            for (let c = 0; c < cells.length; c++) {
                this._addText(COL_X[c], rowY + 4, cells[c], { fontSize: '14px', color: cellColors[c] }, D);
            }

            // Row click zone (expand)
            const hz = this.add.zone(PX + 8, rowY, PW - 100, rowH)
                .setOrigin(0, 0).setInteractive({ useHandCursor: true })
                .setDepth(D + 2).setScrollFactor(0);
            hz.on('pointerdown', () => {
                this._expandedSpellId = (this._expandedSpellId === sp.id) ? null : sp.id;
                this._drawTab(2);
            });
            this._contentTexts.push(hz);

            // Equip/Unequip button
            const btnLabel = isEquipped ? 'Unequip' : 'Equip';
            const btn = this._makeBtn(
                PX + PW - 52, rowY + rowH / 2, 76, rowH - 2, btnLabel,
                isEquipped ? 0x662211 : 0x226633,
                isEquipped ? 0xaa3322 : 0x33aa55,
                () => {
                    if (isEquipped) {
                        const idx = this._equippedSpells.indexOf(sp.id);
                        if (idx !== -1) {
                            this._equippedSpells[idx] = null;
                            EventBus.emit('spellbook:equipped', { slotIndex: idx, spellId: null });
                        }
                    } else {
                        const slot = this._equippedSpells.findIndex(s => s === null);
                        if (slot !== -1) {
                            this._equippedSpells[slot] = sp.id;
                            EventBus.emit('spellbook:equipped', { slotIndex: slot, spellId: sp.id });
                        }
                    }
                    this._drawTab(2);
                },
                D + 2, '9px'
            );
            this._contentBtns.push(btn);
            rowY += rowH;

            // Expanded detail row
            if (isExpanded) {
                const expH = sp.lore ? 62 : 42;
                this._contentGfx.fillStyle(0x0d1a2a, 0.7);
                this._contentGfx.fillRect(PX + 20, rowY, PW - 36, expH);
                this._contentGfx.lineStyle(1, this._elementColorHex(sp.element), 0.3);
                this._contentGfx.strokeRect(PX + 20, rowY, PW - 36, expH);
                this._addText(PX + 28, rowY + 4, sp.description || '—', {
                    fontSize: '14px', color: '#ccddee', wordWrap: { width: PW - 100 },
                }, D);
                if (sp.lore) {
                    this._addText(PX + 28, rowY + 30, `"${sp.lore}"`, {
                        fontSize: '14px', color: '#cc9944', fontStyle: 'italic', wordWrap: { width: PW - 100 },
                    }, D);
                }
                rowY += expH + 2;
            }

            // Row separator
            this._contentGfx.lineStyle(1, 0x1a2a2a, 0.45);
            this._contentGfx.lineBetween(PX + 8, rowY, PX + PW - 8, rowY);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // TAB 3 — EFFECTS
    // ────────────────────────────────────────────────────────────────────────

    _drawEffectsTab() {
        const { _PX: PX, _PY: PY, _PW: PW } = this;
        const D   = this._DEPTH + 3;
        const cY  = PY + 82;
        const stats     = this._playerStats;
        const classId   = globalThis.__playerClassSystem?.getCurrentClass?.()?.id || null;
        const classData = classId ? (dataManager.getClassById?.(classId) || null) : null;
        const equip     = globalThis.__equipmentSystem?.getAllSlots?.() || {};
        const maxY      = this._PY + this._PH - 30;
        let y = cY;

        // Section: active buffs / debuffs
        this._addText(PX + 16, y, 'ACTIVE STATUS EFFECTS', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);
        y += 18;

        const effects = stats.activeEffects || [];
        if (effects.length === 0) {
            this._addText(PX + 16, y, 'No active effects.', { fontSize: '17px', color: '#445566' }, D);
            y += 22;
        } else {
            for (const ef of effects) {
                if (y >= maxY) break;
                const col = ef.isDebuff ? '#ff6644' : '#44ff88';
                this._addText(PX + 16, y, `${ef.name || '?'} — ${ef.description || ''}`, {
                    fontSize: '15px', color: col, wordWrap: { width: PW - 100 },
                }, D);
                if (ef.duration != null) {
                    this._addText(PX + PW - 80, y, `${ef.duration}t left`, { fontSize: '14px', color: '#7788aa' }, D);
                }
                y += 22;
            }
        }

        y += 8;
        this._contentGfx.lineStyle(1, 0x334455, 0.5);
        this._contentGfx.lineBetween(PX + 16, y, PX + PW - 16, y);
        y += 14;

        // Section: permanent / variant bonuses
        this._addText(PX + 16, y, 'PERMANENT BONUSES', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);
        y += 16;

        if (classData?.variants) {
            const vKey  = stats.variant === 'Blighted' ? 'blighted' : 'pure';
            const vData = classData.variants[vKey];
            if (vData) {
                this._addText(PX + 16, y, `${vData.name}: ${vData.bonusAbility?.name || ''}`, { fontSize: '17px', color: '#aaddff' }, D);
                y += 16;
                this._addText(PX + 24, y, vData.bonusAbility?.description || '', {
                    fontSize: '14px', color: '#aabbcc', wordWrap: { width: PW - 80 },
                }, D);
                y += this._estHeight(vData.bonusAbility?.description || '', PW - 80, 10) + 10;
            }
            const mods = classData.variants[stats.variant === 'Blighted' ? 'blighted' : 'pure']?.statModifiers || {};
            for (const [stat, val] of Object.entries(mods)) {
                if (y >= maxY) break;
                this._addText(PX + 24, y, `${stat.charAt(0).toUpperCase() + stat.slice(1)} +${val} (variant bonus)`, {
                    fontSize: '15px', color: '#aaffcc',
                }, D);
                y += 18;
            }
        }

        y += 8;
        this._contentGfx.lineStyle(1, 0x334455, 0.5);
        this._contentGfx.lineBetween(PX + 16, y, PX + PW - 16, y);
        y += 14;

        // Section: equipment special abilities
        this._addText(PX + 16, y, 'EQUIPMENT ABILITIES', { fontSize: '13px', color: '#7788aa', letterSpacing: 1 }, D);
        y += 16;

        const equipped = Object.values(equip).filter(Boolean);
        if (equipped.length === 0) {
            this._addText(PX + 16, y, 'No equipment equipped.', { fontSize: '17px', color: '#445566' }, D);
        } else {
            for (const item of equipped) {
                if (y >= maxY) break;
                if (!item.specialAbility) continue;
                this._addText(PX + 16, y, `${item.name}: ${item.specialAbility}`, {
                    fontSize: '15px', color: '#ffdd88', wordWrap: { width: PW - 80 },
                }, D);
                y += 20;
            }
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────────────────

    _addText(x, y, text, style, depth) {
        const t = this.add.text(x, y, String(text), {
            fontFamily: 'Open Sans', ...style,
        }).setDepth(depth).setScrollFactor(0);
        this._contentTexts.push(t);
        return t;
    }

    _makeBtn(cx, cy, bw, bh, label, color, hoverColor, onClick, depth, fontSize = '11px') {
        const bx  = cx - bw / 2, by = cy - bh / 2;
        const bg  = this.add.graphics().setDepth(depth).setScrollFactor(0);
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
        };
        draw(color);
        const txt = this.add.text(cx, cy, label, {
            fontFamily: 'Open Sans', fontSize, color: '#ffffff',
            stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
        const hit = this.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth + 2).setScrollFactor(0);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }

    _estHeight(text, wrapWidth, fontSize) {
        if (!text) return fontSize + 2;
        const charsPerLine = Math.max(1, Math.floor(wrapWidth / (fontSize * 0.58)));
        const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
        return lines * (fontSize + 3);
    }

    _classHex(classId) {
        const map = {
            bloomguard: 0x226633, thornbinder: 0x442266,
            emerald_mystic: 0x1a3355, wildkin_ranger: 0x554422, sporecaller: 0x335522,
        };
        return map[classId] || 0x223344;
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
}
