import EventBus from '../core/EventBus.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';

/**
 * ClassSelectionScene — Sidebar list + full detail panel layout.
 *
 * LEFT (282px): vertical class buttons with name, role, HP/AP preview
 * RIGHT (990px): full class detail — portrait, stats, spells, abilities, ultimate
 *
 * Font: Cinzel / Cinzel Decorative for headings, Open Sans for body.
 * Palette: muted high-fantasy (no neon).
 */
export default class ClassSelectionScene extends Phaser.Scene {
    constructor() { super({ key: 'ClassSelectionScene' }); }

    // ─── Role → muted colour config ──────────────────────────────────────────
    static ROLE_COLORS = {
        'Tank':                  { main: 0x0f2810, border: 0x3a6a28, text: '#7ec870', glow: 0x3a6a28 },
        'Rogue':                 { main: 0x1a0f2a, border: 0x6644aa, text: '#bb88ff', glow: 0x6644aa },
        'Caster/Healer':         { main: 0x0a1628, border: 0x2255aa, text: '#7aadee', glow: 0x2255aa },
        'Ranged DPS':            { main: 0x251a08, border: 0x996622, text: '#ddaa55', glow: 0x996622 },
        'Debuffer/Controller':   { main: 0x280810, border: 0x992238, text: '#ff7799', glow: 0x992238 },
    };
    static DEFAULT_COLOR = { main: 0x101828, border: 0x334466, text: '#aabbcc', glow: 0x334466 };

    _getColor(cls) {
        return ClassSelectionScene.ROLE_COLORS[cls?.role] || ClassSelectionScene.DEFAULT_COLOR;
    }

    // ─── Layout constants ────────────────────────────────────────────────────
    static SIDEBAR_W   = 282;
    static PANEL_X     = 287;
    static BTN_H       = 90;
    static BTN_GAP     = 8;
    static BTN_START_Y = 80;

    // ─── Attribute metadata ──────────────────────────────────────────────────
    static ATTR_NAMES  = ['Might','Agility','Resilience','Insight','Charisma'];
    static ATTR_KEYS   = { Might:'might', Agility:'agility', Resilience:'resilience', Insight:'insight', Charisma:'charisma' };
    static ATTR_COLORS = { Might:'#ff7777', Agility:'#77ffaa', Resilience:'#88aadd', Insight:'#cc88ff', Charisma:'#ffdd55' };
    static ATTR_DESCS  = {
        Might:'Melee power, carry weight',
        Agility:'Speed, evasion, crit chance',
        Resilience:'Max HP, damage resistance',
        Insight:'Spell power, Sap regen',
        Charisma:'Persuasion, faction bonds',
    };

    create() {
        this.classSystem  = PlayerClassSystem.getInstance();
        this.classes      = this.classSystem.getAllClasses();
        this.selectedIndex = 0;

        const { width, height } = this.scale;
        const SW  = ClassSelectionScene.SIDEBAR_W;
        const PX  = ClassSelectionScene.PANEL_X;
        const PW  = width - PX - 5;
        const PH  = height - 10;

        this._drawBackground(width, height, SW);
        this._buildSidebar(0, 0, SW, height);
        this._buildDetailPanel(PX, 5, PW, PH);

        this.input.keyboard.on('keydown-UP',    () => this._navigate(-1));
        this.input.keyboard.on('keydown-DOWN',  () => this._navigate(1));
        this.input.keyboard.on('keydown-LEFT',  () => this._navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this._navigate(1));
        this.input.keyboard.on('keydown-ENTER', () => this._confirm());
        this.input.keyboard.on('keydown-SPACE', () => this._confirm());

        this._selectClass(0);
    }

    // ── Background ────────────────────────────────────────────────────────────
    _drawBackground(w, h, sw) {
        const bg = this.add.graphics();
        bg.fillStyle(0x07090f, 1);
        bg.fillRect(0, 0, w, h);

        // Sidebar bg slightly different shade
        bg.fillStyle(0x050710, 1);
        bg.fillRect(0, 0, sw, h);

        // Top/bottom decorative bands
        bg.fillStyle(0x000000, 0.55);
        bg.fillRect(0, 0, w, 5);
        bg.fillRect(0, h - 5, w, 5);

        // Sidebar right separator — thin gold line
        bg.lineStyle(1, 0x4a3a18, 0.5);
        bg.lineBetween(sw, 8, sw, h - 8);
    }

    // ── Left sidebar ──────────────────────────────────────────────────────────
    _buildSidebar(x, y, w, h) {
        // Title
        this.add.text(x + w / 2, 18, 'REALM OF NEXUS', {
            fontFamily: 'Cinzel Decorative', fontSize: '13px', color: '#c8a84b',
            stroke: '#2a1a04', strokeThickness: 2,
        }).setOrigin(0.5);

        this.add.text(x + w / 2, 40, 'Choose Your Class', {
            fontFamily: 'Cinzel', fontSize: '12px', color: '#556677',
        }).setOrigin(0.5);

        // Decorative divider under title
        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, 0x3a2a10, 0.6);
        divGfx.lineBetween(x + 16, 58, x + w - 16, 58);

        // Class buttons
        this._sidebarBtns = [];
        this.classes.forEach((cls, i) => {
            const by = ClassSelectionScene.BTN_START_Y + i * (ClassSelectionScene.BTN_H + ClassSelectionScene.BTN_GAP);
            const btn = this._makeSidebarBtn(x + 6, by, w - 12, ClassSelectionScene.BTN_H, cls, i);
            this._sidebarBtns.push(btn);
        });

        // Controls hint at bottom
        this.add.text(x + w / 2, h - 44, '↑ / ↓  Navigate', {
            fontFamily: 'Open Sans', fontSize: '11px', color: '#334455',
        }).setOrigin(0.5);
        this.add.text(x + w / 2, h - 28, 'ENTER  Confirm', {
            fontFamily: 'Open Sans', fontSize: '11px', color: '#334455',
        }).setOrigin(0.5);
    }

    _makeSidebarBtn(x, y, w, h, cls, index) {
        const cfg = this._getColor(cls);
        const container = this.add.container(x, y);

        const bg = this.add.graphics();
        container.add(bg);

        // Class name
        const nameT = this.add.text(16, 14, cls.name, {
            fontFamily: 'Cinzel', fontSize: '15px', color: cfg.text,
            stroke: '#000', strokeThickness: 2,
        });
        container.add(nameT);

        // Role
        container.add(this.add.text(16, 36, cls.role || '', {
            fontFamily: 'Open Sans', fontSize: '11px', color: '#7a8899',
        }));

        // Quick stats
        const hp = cls.startingHP || 30;
        const ap = cls.baseAP || 2;
        container.add(this.add.text(16, 54, `HP ${hp}  ·  AP ${ap}`, {
            fontFamily: 'Open Sans', fontSize: '11px', color: '#445566',
        }));

        // Hit zone
        const hit = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this._selectClass(index));
        hit.on('pointerover', () => { if (this.selectedIndex !== index) this._redrawSidebarBtn(index, 'hover'); });
        hit.on('pointerout',  () => { if (this.selectedIndex !== index) this._redrawSidebarBtn(index, 'idle'); });
        container.add(hit);

        this._renderSidebarBtnBg(bg, w, h, cfg, false);
        return { container, bg, nameT, cfg, w, h };
    }

    _renderSidebarBtnBg(gfx, w, h, cfg, selected) {
        gfx.clear();
        gfx.fillStyle(selected ? 0x1a2840 : cfg.main, 1);
        gfx.fillRoundedRect(0, 0, w, h, 5);
        gfx.lineStyle(selected ? 2 : 1, cfg.border, selected ? 1.0 : 0.35);
        gfx.strokeRoundedRect(0, 0, w, h, 5);
        if (selected) {
            // Gold left accent
            gfx.fillStyle(0xc8a84b, 0.9);
            gfx.fillRect(0, 4, 3, h - 8);
        }
    }

    _redrawSidebarBtn(index, state) {
        const btn = this._sidebarBtns[index];
        if (!btn) return;
        const hover = (state === 'hover');
        btn.bg.clear();
        btn.bg.fillStyle(hover ? 0x111e2e : btn.cfg.main, 1);
        btn.bg.fillRoundedRect(0, 0, btn.w, btn.h, 5);
        btn.bg.lineStyle(1, btn.cfg.border, hover ? 0.65 : 0.35);
        btn.bg.strokeRoundedRect(0, 0, btn.w, btn.h, 5);
    }

    // ── Right detail panel ────────────────────────────────────────────────────
    _buildDetailPanel(px, py, pw, ph) {
        // Panel backdrop
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x090d18, 0.98);
        panelBg.fillRoundedRect(px, py, pw, ph, 8);
        panelBg.lineStyle(1, 0x1e2e44, 0.8);
        panelBg.strokeRoundedRect(px, py, pw, ph, 8);

        // ── PORTRAIT AREA ──────────────────────────────────────────────────
        const PORT_X = px + 18;
        const PORT_Y = py + 14;
        const PORT_W = 162;
        const PORT_H = 192;
        this._portX = PORT_X; this._portY = PORT_Y;
        this._portW = PORT_W; this._portH = PORT_H;

        this._portFrame = this.add.graphics();   // redrawn per selection
        this._portImg   = null;

        // ── CLASS INFO (right of portrait) ────────────────────────────────
        const INFO_X = PORT_X + PORT_W + 18;
        const INFO_Y = PORT_Y;

        this._classNameT = this.add.text(INFO_X, INFO_Y + 6, '', {
            fontFamily: 'Cinzel', fontSize: '30px', color: '#c8a84b',
            stroke: '#000', strokeThickness: 3,
        });

        this._classRoleT = this.add.text(INFO_X, INFO_Y + 44, '', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#7a8899',
            fontStyle: 'italic',
        });

        // Combat stat labels (static labels so positioning is consistent)
        const STAT_Y = INFO_Y + 68;
        this._statHpT   = this.add.text(INFO_X,       STAT_Y, '', { fontFamily: 'Open Sans', fontSize: '14px', color: '#cc6666' });
        this._statGrdT  = this.add.text(INFO_X + 110,  STAT_Y, '', { fontFamily: 'Open Sans', fontSize: '14px', color: '#6688cc' });
        this._statApT   = this.add.text(INFO_X + 220,  STAT_Y, '', { fontFamily: 'Open Sans', fontSize: '14px', color: '#ccaa44' });
        this._statArmT  = this.add.text(INFO_X + 310,  STAT_Y, '', { fontFamily: 'Open Sans', fontSize: '14px', color: '#7a8899' });

        // Description
        this._descT = this.add.text(INFO_X, INFO_Y + 92, '', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#9999bb',
            wordWrap: { width: pw - (INFO_X - px) - 20 }, lineSpacing: 4,
        });

        // ── DIVIDER 1 ─────────────────────────────────────────────────────
        const DIV1_Y = py + 215;
        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, 0x1e2e44, 0.7);
        divGfx.lineBetween(px + 14, DIV1_Y, px + pw - 14, DIV1_Y);
        // Gold dot accents on divider
        divGfx.fillStyle(0x4a3a18, 0.8);
        divGfx.fillCircle(px + 14, DIV1_Y, 3);
        divGfx.fillCircle(px + pw - 14, DIV1_Y, 3);

        // Section headers
        const BODY_Y   = DIV1_Y + 10;
        const ATTR_X   = px + 18;
        const SPELL_X  = px + 330;
        const ABIL_X   = px + 580;
        const ABIL_W   = pw - (ABIL_X - px) - 18;

        this._makeSectionHeader(ATTR_X,  BODY_Y, 'ATTRIBUTES');
        this._makeSectionHeader(SPELL_X, BODY_Y, 'STARTING SPELLS');
        this._makeSectionHeader(ABIL_X,  BODY_Y, 'ABILITIES');

        // ── ATTRIBUTE ROWS ────────────────────────────────────────────────
        this._attrRows = [];
        ClassSelectionScene.ATTR_NAMES.forEach((name, i) => {
            const ay  = BODY_Y + 22 + i * 56;
            const lbl = this.add.text(ATTR_X, ay, name, {
                fontFamily: 'Open Sans', fontSize: '12px', color: ClassSelectionScene.ATTR_COLORS[name],
                fontStyle: 'bold',
            });
            const barBg = this.add.graphics();
            const barFg = this.add.graphics();
            const valT  = this.add.text(ATTR_X + 240, ay - 1, '0', {
                fontFamily: 'Cinzel', fontSize: '18px', color: '#ffffff',
            }).setOrigin(1, 0);
            const descT = this.add.text(ATTR_X, ay + 17, '', {
                fontFamily: 'Open Sans', fontSize: '10px', color: '#445566',
            });
            this._attrRows.push({ name, lbl, barBg, barFg, valT, descT, ax: ATTR_X, ay });
        });

        // ── STARTING SPELLS ───────────────────────────────────────────────
        this._spellTexts = [];
        for (let si = 0; si < 6; si++) {
            this._spellTexts.push(this.add.text(SPELL_X, BODY_Y + 22 + si * 24, '', {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#9999bb',
            }));
        }

        // ── ABILITY SLOTS ─────────────────────────────────────────────────
        this._abilSlots = [];
        for (let ai = 0; ai < 5; ai++) {
            const abilY = BODY_Y + 22 + ai * 52;
            const nameT = this.add.text(ABIL_X, abilY, '', {
                fontFamily: 'Cinzel', fontSize: '13px', color: '#c8a84b',
            });
            const descT = this.add.text(ABIL_X, abilY + 18, '', {
                fontFamily: 'Open Sans', fontSize: '11px', color: '#7a8899',
                wordWrap: { width: ABIL_W },
            });
            this._abilSlots.push({ nameT, descT });
        }

        // ── DIVIDER 2 ─────────────────────────────────────────────────────
        const DIV2_Y = py + ph - 138;
        const div2 = this.add.graphics();
        div2.lineStyle(1, 0x1e2e44, 0.7);
        div2.lineBetween(px + 14, DIV2_Y, px + pw - 14, DIV2_Y);
        div2.fillStyle(0x4a3a18, 0.8);
        div2.fillCircle(px + 14, DIV2_Y, 3);
        div2.fillCircle(px + pw - 14, DIV2_Y, 3);

        // ── ULTIMATE ──────────────────────────────────────────────────────
        const ULT_Y = DIV2_Y + 8;
        this.add.text(px + pw / 2, ULT_Y, '— ULTIMATE ABILITY —', {
            fontFamily: 'Cinzel', fontSize: '11px', color: '#3a2e0e',
        }).setOrigin(0.5);

        this._ultNameT = this.add.text(px + pw / 2, ULT_Y + 20, '', {
            fontFamily: 'Cinzel', fontSize: '22px', color: '#c8a84b',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this._ultDescT = this.add.text(px + pw / 2, ULT_Y + 50, '', {
            fontFamily: 'Open Sans', fontSize: '12px', color: '#7a6a3a',
            wordWrap: { width: pw - 60 }, align: 'center',
        }).setOrigin(0.5, 0);

        // ── CONFIRM BUTTON ────────────────────────────────────────────────
        const BTN_CX = px + pw / 2;
        const BTN_CY = py + ph - 26;
        this._confirmBtnGfx = this.add.graphics();
        this._drawConfirmBtn(false);
        this._confirmBtnPos = { cx: BTN_CX, cy: BTN_CY, w: 248, h: 44 };

        this._confirmTxt = this.add.text(BTN_CX, BTN_CY, 'CONFIRM CLASS', {
            fontFamily: 'Cinzel', fontSize: '18px', color: '#c8a84b',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const btnHit = this.add.zone(BTN_CX, BTN_CY, 248, 44).setInteractive({ useHandCursor: true });
        btnHit.on('pointerdown', () => this._confirm());
        btnHit.on('pointerover', () => this._drawConfirmBtn(true));
        btnHit.on('pointerout',  () => this._drawConfirmBtn(false));
    }

    _makeSectionHeader(x, y, label) {
        this.add.text(x, y, label, {
            fontFamily: 'Cinzel', fontSize: '11px', color: '#4a5a6a', letterSpacing: 2,
        });
    }

    _drawConfirmBtn(hovered) {
        const { cx, cy, w, h } = this._confirmBtnPos || { cx: 780, cy: 689, w: 248, h: 44 };
        this._confirmBtnGfx.clear();
        this._confirmBtnGfx.fillStyle(hovered ? 0x2a2008 : 0x16120a, 1);
        this._confirmBtnGfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
        this._confirmBtnGfx.lineStyle(2, hovered ? 0xc8a84b : 0x5a4a18, 0.9);
        this._confirmBtnGfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    }

    // ── Select / highlight a class ────────────────────────────────────────────
    _selectClass(index) {
        this.selectedIndex = index;
        const cls = this.classes[index];
        if (!cls) return;
        const cfg = this._getColor(cls);

        // ── Sidebar button states ──────────────────────────────────────────
        this._sidebarBtns.forEach((btn, i) => {
            const sel = (i === index);
            this._renderSidebarBtnBg(btn.bg, btn.w, btn.h, btn.cfg, sel);
        });

        // ── Portrait ──────────────────────────────────────────────────────
        this._portFrame.clear();
        this._portFrame.fillStyle(cfg.main, 1);
        this._portFrame.fillRoundedRect(this._portX, this._portY, this._portW, this._portH, 8);
        this._portFrame.lineStyle(2, cfg.border, 0.85);
        this._portFrame.strokeRoundedRect(this._portX, this._portY, this._portW, this._portH, 8);
        // Inner subtle gradient band at top of portrait
        this._portFrame.fillStyle(cfg.border, 0.12);
        this._portFrame.fillRoundedRect(this._portX, this._portY, this._portW, 40, 8);

        if (this._portImg) { this._portImg.destroy(); this._portImg = null; }
        const spriteKey = cls.sprite && this.textures.exists(cls.sprite) ? cls.sprite : 'player';
        if (this.textures.exists(spriteKey)) {
            this._portImg = this.add.image(this._portX + this._portW / 2, this._portY + this._portH / 2, spriteKey)
                .setDisplaySize(this._portW - 20, this._portH - 20);
        } else {
            // Large styled initial as fallback
            this._portImg = this.add.text(
                this._portX + this._portW / 2, this._portY + this._portH / 2,
                cls.name.charAt(0), {
                    fontFamily: 'Cinzel Decorative', fontSize: '72px', color: cfg.text, alpha: 0.35,
                }
            ).setOrigin(0.5);
        }

        // ── Class name, role, stats ────────────────────────────────────────
        this._classNameT.setText(cls.name).setColor(cfg.text);
        this._classRoleT.setText(cls.role || '');

        this._statHpT.setText(`HP: ${cls.startingHP || 30}`);
        this._statGrdT.setText(`Guard: ${cls.startingGuard || 0}`);
        this._statApT.setText(`AP: ${cls.baseAP || 2}`);
        const arm = cls.preferredArmor || 'light';
        this._statArmT.setText(`${arm[0].toUpperCase()}${arm.slice(1)} armor`);

        this._descT.setText(cls.description || '');

        // ── Attributes ────────────────────────────────────────────────────
        const attrs = cls.baseStats || {};
        this._attrRows.forEach(row => {
            const val  = attrs[ClassSelectionScene.ATTR_KEYS[row.name]] || 0;
            row.valT.setText(`${val}`);
            row.descT.setText(ClassSelectionScene.ATTR_DESCS[row.name]);

            const bx   = row.ax;
            const bw   = 230;
            const barY = row.ay + 30;
            const col  = parseInt(ClassSelectionScene.ATTR_COLORS[row.name].replace('#', ''), 16);

            row.barBg.clear();
            row.barBg.fillStyle(0x141824, 0.9);
            row.barBg.fillRoundedRect(bx, barY, bw, 6, 3);

            row.barFg.clear();
            const ratio = Math.min(1, val / 6);
            if (ratio > 0) {
                row.barFg.fillStyle(col, 0.65);
                row.barFg.fillRoundedRect(bx, barY, bw * ratio, 6, 3);
            }
        });

        // ── Starting spells ───────────────────────────────────────────────
        const spells = cls.startingSpells || [];
        this._spellTexts.forEach((t, i) => {
            if (i < spells.length) {
                const nm = spells[i].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                t.setText(`✦ ${nm}`).setAlpha(1);
            } else {
                t.setText('').setAlpha(0);
            }
        });

        // ── Abilities ─────────────────────────────────────────────────────
        const lvl1 = cls.classAbilities?.level1 || [];
        const lvl3 = cls.classAbilities?.level3 ? [cls.classAbilities.level3] : [];
        const lvl5 = cls.classAbilities?.level5 ? [cls.classAbilities.level5] : [];
        const allAbils = [...lvl1, ...lvl3, ...lvl5];

        this._abilSlots.forEach(({ nameT, descT }, i) => {
            if (i < allAbils.length) {
                const ab = allAbils[i];
                nameT.setText(ab.name || '').setAlpha(1);
                descT.setText((ab.description || '').substring(0, 120)).setAlpha(1);
            } else {
                nameT.setAlpha(0);
                descT.setAlpha(0);
            }
        });

        // ── Ultimate ──────────────────────────────────────────────────────
        const ult = cls.classAbilities?.ultimate;
        this._ultNameT.setText(ult?.name || '—');
        this._ultDescT.setText(ult?.description ? ult.description.substring(0, 200) : '');
    }

    // ── Navigation / Confirm ─────────────────────────────────────────────────
    _navigate(dir) {
        const n = Phaser.Math.Clamp(this.selectedIndex + dir, 0, this.classes.length - 1);
        if (n !== this.selectedIndex) this._selectClass(n);
    }

    _confirm() {
        const cls = this.classes[this.selectedIndex];
        if (!cls) return;
        this.classSystem.selectClass(cls.id);
        EventBus.emit('class:confirmed', { classId: cls.id });
        this.cameras.main.fade(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('CharacterCreationScene');
        });
    }
}
