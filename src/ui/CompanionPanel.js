import EventBus from '../core/EventBus.js';

/**
 * CompanionPanel — Shows active companions and full roster.
 *
 * Toggle with P key (wired in UIScene).
 * Size: 620 × 440, depth 8200.
 *
 * Sections:
 *   Left  (200px) — Active party cards (max 2)
 *   Right (420px) — Selected companion detail
 *   Bottom bar    — Scrollable full roster (all 5 companions)
 */

const PW = 620;
const PH = 440;
const DEPTH = 8200;

const BOTTOM_H = 80;     // height of roster bar
const HEADER_H = 36;
const CONTENT_H = PH - HEADER_H - BOTTOM_H; // 324

const LEFT_W = 200;
const RIGHT_W = PW - LEFT_W; // 420

const BOND_NAMES = [
    'Stranger',     // 0-1
    'Stranger',     // 1
    'Acquaintance', // 2
    'Acquaintance', // 3
    'Friend',       // 4
    'Friend',       // 5
    'Trusted',      // 6
    'Trusted',      // 7
    'Bonded',       // 8
    'Bonded',       // 9
    'Soulbound',    // 10
];

const CLASS_COLORS = {
    bloomguard:     0x44aa66,
    thornbinder:    0x886633,
    emerald_mystic: 0x44aaaa,
    sporecaller:    0x99aa44,
    wildkin:        0xaa7733,
};

function getBondName(level) {
    return BOND_NAMES[Math.min(10, Math.max(0, level))];
}

function getClassColor(classId) {
    if (!classId) return 0x445566;
    for (const [key, val] of Object.entries(CLASS_COLORS)) {
        if (classId.toLowerCase().includes(key)) return val;
    }
    return 0x445566;
}

function starString(level) {
    const filled = Math.min(10, Math.max(0, level));
    return '★'.repeat(filled) + '☆'.repeat(10 - filled);
}

export default class CompanionPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._container = null;
        this._selectedId = null;

        // Content sub-containers rebuilt on refresh
        this._leftContainer = null;
        this._rightContainer = null;
        this._bottomContainer = null;

        this._build();
        this._wireEvents();
    }

    // ──────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────

    toggle() {
        this.visible ? this.hide() : this.show();
    }

    show() {
        this.visible = true;
        this._container.setVisible(true);
        this._refresh();
    }

    hide() {
        this.visible = false;
        this._container.setVisible(false);
    }

    // ──────────────────────────────────────────────────────────────────
    // Data helpers
    // ──────────────────────────────────────────────────────────────────

    _getCompanions() {
        return globalThis.__companionSystem?.getCompanions?.() || [];
    }

    _getActiveParty() {
        return globalThis.__companionSystem?.getActiveParty?.() || [];
    }

    // ──────────────────────────────────────────────────────────────────
    // Build skeleton (static chrome only — content rebuilt on refresh)
    // ──────────────────────────────────────────────────────────────────

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const PX = Math.round(width / 2 - PW / 2);
        const PY = Math.round(height / 2 - PH / 2);

        this._container = s.add.container(PX, PY).setDepth(DEPTH).setScrollFactor(0);

        // ── Background ──
        const bg = s.add.graphics();
        bg.fillStyle(0x06060f, 0.97);
        bg.fillRoundedRect(0, 0, PW, PH, 10);
        bg.lineStyle(2, 0x334466, 0.9);
        bg.strokeRoundedRect(0, 0, PW, PH, 10);
        this._container.add(bg);

        // ── Header bar ──
        const hdrBg = s.add.graphics();
        hdrBg.fillStyle(0x0d1122, 0.95);
        hdrBg.fillRoundedRect(0, 0, PW, HEADER_H, { tl: 10, tr: 10, bl: 0, br: 0 });
        this._container.add(hdrBg);

        const title = s.add.text(PW / 2, HEADER_H / 2, 'COMPANIONS', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#8899cc',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._container.add(title);

        const closeZone = s.add.zone(PW - 20, HEADER_H / 2, 28, 28).setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => this.hide());
        const closeX = s.add.text(PW - 20, HEADER_H / 2, '✕', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#aa5555',
        }).setOrigin(0.5);
        this._container.add([closeZone, closeX]);

        // ── Vertical divider between left and right ──
        const vdiv = s.add.graphics();
        vdiv.lineStyle(1, 0x223355, 0.7);
        vdiv.lineBetween(LEFT_W, HEADER_H, LEFT_W, HEADER_H + CONTENT_H);
        this._container.add(vdiv);

        // ── Horizontal divider above roster bar ──
        const hdiv = s.add.graphics();
        hdiv.lineStyle(1, 0x223355, 0.7);
        hdiv.lineBetween(0, HEADER_H + CONTENT_H, PW, HEADER_H + CONTENT_H);
        this._container.add(hdiv);

        // ── Dynamic content containers (replaced on each refresh) ──
        this._leftContainer = s.add.container(0, HEADER_H);
        this._rightContainer = s.add.container(LEFT_W, HEADER_H);
        this._bottomContainer = s.add.container(0, HEADER_H + CONTENT_H);
        this._container.add([this._leftContainer, this._rightContainer, this._bottomContainer]);

        this._container.setVisible(false);

        s.input.keyboard.on('keydown-ESC', () => { if (this.visible) this.hide(); });
    }

    // ──────────────────────────────────────────────────────────────────
    // Full refresh — rebuilds all three sections
    // ──────────────────────────────────────────────────────────────────

    _refresh() {
        this._buildLeft();
        this._buildRight();
        this._buildBottom();
    }

    // ──────────────────────────────────────────────────────────────────
    // LEFT — Active party cards
    // ──────────────────────────────────────────────────────────────────

    _buildLeft() {
        this._leftContainer.removeAll(true);
        const s = this.scene;
        const allCompanions = this._getCompanions();
        const party = this._getActiveParty();

        // Normalize party — can be array of ids or objects
        const partyIds = party.map(p => (typeof p === 'string' ? p : p.id));

        // Ensure exactly 2 slots shown
        const slots = [partyIds[0] || null, partyIds[1] || null];

        const CARD_W = LEFT_W - 12;
        const CARD_H = 136;
        const SLOT_PAD = 8;

        slots.forEach((companionId, slotIndex) => {
            const cardX = 6;
            const cardY = SLOT_PAD + slotIndex * (CARD_H + SLOT_PAD);

            const companion = companionId
                ? allCompanions.find(c => c.id === companionId)
                : null;

            const cardBg = s.add.graphics();

            if (!companion) {
                // Empty slot
                cardBg.fillStyle(0x0a0a14, 0.8);
                cardBg.fillRoundedRect(cardX, cardY, CARD_W, CARD_H, 6);
                cardBg.lineStyle(1, 0x222233, 0.6);
                cardBg.setAlpha(0.6);
                cardBg.strokeRoundedRect(cardX, cardY, CARD_W, CARD_H, 6);
                this._leftContainer.add(cardBg);

                const emptyTxt = s.add.text(cardX + CARD_W / 2, cardY + CARD_H / 2 - 10, 'Empty Slot', {
                    fontFamily: 'Open Sans', fontSize: '15px', color: '#333344',
                }).setOrigin(0.5);
                const plusTxt = s.add.text(cardX + CARD_W / 2, cardY + CARD_H / 2 + 8, '+', {
                    fontFamily: 'Open Sans', fontSize: '25px', color: '#223333',
                }).setOrigin(0.5);
                this._leftContainer.add([emptyTxt, plusTxt]);
                return;
            }

            const classColor = getClassColor(companion.class);
            const bondLevel = companion.bondLevel ?? 0;
            const hp = companion.baseStats?.hp ?? 0;
            const maxHp = companion.baseStats?.maxHp ?? hp;
            const hpPct = maxHp > 0 ? Math.min(1, hp / maxHp) : 1;

            // Highlight if selected
            const isSelected = this._selectedId === companion.id;
            cardBg.fillStyle(isSelected ? 0x1a2244 : 0x0d1122, 0.92);
            cardBg.fillRoundedRect(cardX, cardY, CARD_W, CARD_H, 6);
            cardBg.lineStyle(2, isSelected ? 0x4466cc : 0x223344, isSelected ? 0.9 : 0.5);
            cardBg.strokeRoundedRect(cardX, cardY, CARD_W, CARD_H, 6);
            this._leftContainer.add(cardBg);

            // Portrait (40×40) — real image if available, colored rect fallback
            const portGfx = s.add.graphics();
            portGfx.fillStyle(classColor, 0.8);
            portGfx.fillRoundedRect(cardX + 6, cardY + 8, 40, 40, 4);
            portGfx.lineStyle(1, classColor, 0.5);
            portGfx.strokeRoundedRect(cardX + 6, cardY + 8, 40, 40, 4);
            this._leftContainer.add(portGfx);

            const nameKey = (companion.name || '').toLowerCase().replace(/\s+/g, '_');
            const portKey = `portrait_companion_${nameKey}`;
            if (s.textures.exists(portKey)) {
                const portImg = s.add.image(cardX + 6 + 20, cardY + 8 + 20, portKey)
                    .setDisplaySize(40, 40).setOrigin(0.5);
                this._leftContainer.add(portImg);
            } else {
                const initials = (companion.name || '?').substring(0, 2).toUpperCase();
                const portInitials = s.add.text(cardX + 6 + 20, cardY + 8 + 20, initials, {
                    fontFamily: 'Open Sans', fontSize: '20px', color: '#ffffff',
                    stroke: '#000', strokeThickness: 2,
                }).setOrigin(0.5);
                this._leftContainer.add(portInitials);
            }

            // Name
            const nameTxt = s.add.text(cardX + 52, cardY + 10, companion.name || 'Unknown', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#ddeeff',
            });
            this._leftContainer.add(nameTxt);

            // Role badge
            const roleStr = (companion.role || companion.class || 'adventurer').toUpperCase();
            const roleBg = s.add.graphics();
            roleBg.fillStyle(classColor, 0.3);
            roleBg.fillRoundedRect(cardX + 52, cardY + 26, Math.min(CARD_W - 58, roleStr.length * 7 + 8), 14, 3);
            const roleTxt = s.add.text(cardX + 56, cardY + 26, roleStr, {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#' + classColor.toString(16).padStart(6, '0'),
            });
            this._leftContainer.add([roleBg, roleTxt]);

            // HP bar
            const barX = cardX + 6;
            const barY = cardY + 56;
            const barW = CARD_W - 12;
            const hpBarBg = s.add.graphics();
            hpBarBg.fillStyle(0x111122, 0.9);
            hpBarBg.fillRoundedRect(barX, barY, barW, 10, 3);
            hpBarBg.fillStyle(hpPct > 0.5 ? 0x44cc66 : hpPct > 0.25 ? 0xccaa22 : 0xcc3333, 0.9);
            hpBarBg.fillRoundedRect(barX, barY, Math.round(barW * hpPct), 10, 3);
            const hpTxt = s.add.text(barX + barW / 2, barY, `HP ${hp}/${maxHp}`, {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#aabbcc',
            }).setOrigin(0.5, 0);
            this._leftContainer.add([hpBarBg, hpTxt]);

            // Bond stars (max 10, shown as 2 rows of 5 for space)
            const starsRow1 = starString(bondLevel).substring(0, 5);
            const starsRow2 = starString(bondLevel).substring(5, 10);
            const starsColor = bondLevel >= 8 ? '#ffcc44' : bondLevel >= 4 ? '#88aaff' : '#445566';
            const starTxt1 = s.add.text(cardX + 6, cardY + 72, starsRow1, {
                fontFamily: 'Open Sans', fontSize: '14px', color: starsColor,
            });
            const starTxt2 = s.add.text(cardX + 6, cardY + 84, starsRow2, {
                fontFamily: 'Open Sans', fontSize: '14px', color: starsColor,
            });
            this._leftContainer.add([starTxt1, starTxt2]);

            // DISMISS button
            const btnW = 68, btnH = 18;
            const btnX = cardX + CARD_W - btnW - 6;
            const btnY = cardY + CARD_H - btnH - 6;
            const btnBg = s.add.graphics();
            btnBg.fillStyle(0x441111, 0.85);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 3);
            btnBg.lineStyle(1, 0x882222, 0.7);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 3);
            const btnTxt = s.add.text(btnX + btnW / 2, btnY + btnH / 2, 'DISMISS', {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#ff6666',
            }).setOrigin(0.5);
            const btnZone = s.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
                .setInteractive({ useHandCursor: true });
            btnZone.on('pointerdown', () => {
                EventBus.emit('companion:dismiss', { companionId: companion.id });
            });
            btnZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x882222, 0.95);
                btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 3);
            });
            btnZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x441111, 0.85);
                btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 3);
                btnBg.lineStyle(1, 0x882222, 0.7);
                btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 3);
            });
            this._leftContainer.add([btnBg, btnTxt, btnZone]);

            // Card click zone for selection
            const cardZone = s.add.zone(cardX + CARD_W / 2, cardY + CARD_H / 2, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true });
            cardZone.on('pointerdown', () => {
                this._selectedId = companion.id;
                this._buildLeft();
                this._buildRight();
            });
            this._leftContainer.add(cardZone);
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // RIGHT — Selected companion detail
    // ──────────────────────────────────────────────────────────────────

    _buildRight() {
        this._rightContainer.removeAll(true);
        const s = this.scene;
        const CW = RIGHT_W;

        const allCompanions = this._getCompanions();
        const party = this._getActiveParty();
        const partyIds = party.map(p => (typeof p === 'string' ? p : p.id));

        // Find selected companion, fallback to first available
        let companion = null;
        if (this._selectedId) {
            companion = allCompanions.find(c => c.id === this._selectedId);
        }
        if (!companion && allCompanions.length > 0) {
            companion = allCompanions[0];
            this._selectedId = companion.id;
        }

        if (!companion) {
            const emptyTxt = s.add.text(CW / 2, CONTENT_H / 2, 'No companion data', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#333344',
            }).setOrigin(0.5);
            this._rightContainer.add(emptyTxt);
            return;
        }

        const classColor = getClassColor(companion.class);
        const bondLevel = companion.bondLevel ?? 0;
        const isInParty = partyIds.includes(companion.id);

        let y = 10;
        const PAD = 10;

        // ── Name (large) ──
        const nameTxt = s.add.text(PAD, y, companion.name || 'Unknown', {
            fontFamily: 'Open Sans', fontSize: '25px', color: '#ddeeff',
            stroke: '#000', strokeThickness: 2,
        });
        this._rightContainer.add(nameTxt);

        if (companion.title) {
            const titleTxt = s.add.text(PAD + nameTxt.width + 8, y + 4, `"${companion.title}"`, {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#' + classColor.toString(16).padStart(6, '0'),
            });
            this._rightContainer.add(titleTxt);
        }
        y += 28;

        // Role description
        const roleDesc = companion.description || companion.personality || '';
        const descTxt = s.add.text(PAD, y, roleDesc, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#778899',
            wordWrap: { width: CW - PAD * 2 },
        });
        this._rightContainer.add(descTxt);
        y += descTxt.height + 10;

        // ── Stat block ──
        const statLabel = s.add.text(PAD, y, 'ATTRIBUTES', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#556677',
        });
        this._rightContainer.add(statLabel);
        y += 16;

        const stats = companion.baseStats || {};
        const STAT_MAP = [
            { key: 'might',      label: 'STR', color: '#ff8844' },
            { key: 'agility',    label: 'AGI', color: '#44ff88' },
            { key: 'resilience', label: 'RES', color: '#4488ff' },
            { key: 'insight',    label: 'INS', color: '#cc88ff' },
            { key: 'charisma',   label: 'CHA', color: '#ffcc44' },
        ];

        const colW = Math.floor((CW - PAD * 2) / STAT_MAP.length);
        STAT_MAP.forEach((stat, i) => {
            const sx = PAD + i * colW;
            const val = stats[stat.key] ?? 0;
            const statBg = s.add.graphics();
            statBg.fillStyle(0x0d1020, 0.8);
            statBg.fillRoundedRect(sx, y, colW - 4, 34, 4);
            statBg.lineStyle(1, 0x222233, 0.5);
            statBg.strokeRoundedRect(sx, y, colW - 4, 34, 4);
            const sLabel = s.add.text(sx + (colW - 4) / 2, y + 5, stat.label, {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#556677',
            }).setOrigin(0.5, 0);
            const sVal = s.add.text(sx + (colW - 4) / 2, y + 17, String(val), {
                fontFamily: 'Open Sans', fontSize: '20px', color: stat.color,
            }).setOrigin(0.5, 0);
            this._rightContainer.add([statBg, sLabel, sVal]);
        });
        y += 44;

        // ── Bond level ──
        const bondLabel = s.add.text(PAD, y, `BOND: ${bondLevel}/10  —  ${getBondName(bondLevel).toUpperCase()}`, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#aaaacc',
        });
        this._rightContainer.add(bondLabel);
        y += 16;

        const bondBarW = CW - PAD * 2;
        const bondBarBg = s.add.graphics();
        bondBarBg.fillStyle(0x111122, 0.9);
        bondBarBg.fillRoundedRect(PAD, y, bondBarW, 10, 3);
        const bondFill = bondLevel >= 10 ? 0xffcc44 : bondLevel >= 8 ? 0x44aaff : bondLevel >= 4 ? 0x44cc88 : 0x445566;
        bondBarBg.fillStyle(bondFill, 0.9);
        bondBarBg.fillRoundedRect(PAD, y, Math.round(bondBarW * (bondLevel / 10)), 10, 3);
        this._rightContainer.add(bondBarBg);
        y += 18;

        // ── Personal quest ──
        if (companion.personalQuest) {
            const pqLabel = s.add.text(PAD, y, 'PERSONAL QUEST', {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#556677',
            });
            this._rightContainer.add(pqLabel);
            y += 14;

            const pqBg = s.add.graphics();
            pqBg.fillStyle(0x0d1020, 0.8);
            pqBg.fillRoundedRect(PAD, y, CW - PAD * 2, 28, 4);
            pqBg.lineStyle(1, 0x223344, 0.5);
            pqBg.strokeRoundedRect(PAD, y, CW - PAD * 2, 28, 4);
            const pqName = s.add.text(PAD + 6, y + 5, companion.personalQuest.replace(/_/g, ' ').toUpperCase(), {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#99bbcc',
            });
            // Progress bar (stub — no live data available without quest system)
            const pqBarW = CW - PAD * 2 - 12;
            const pqBarBg = s.add.graphics();
            pqBarBg.fillStyle(0x111122, 0.9);
            pqBarBg.fillRoundedRect(PAD + 6, y + 18, pqBarW, 6, 2);
            pqBarBg.fillStyle(0x334477, 0.8);
            pqBarBg.fillRoundedRect(PAD + 6, y + 18, Math.round(pqBarW * 0.2), 6, 2);
            this._rightContainer.add([pqBg, pqName, pqBarBg]);
            y += 36;
        }

        // ── Abilities ──
        const abilities = companion.abilities || [];
        if (abilities.length > 0) {
            const abilLabel = s.add.text(PAD, y, 'ABILITIES', {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#556677',
            });
            this._rightContainer.add(abilLabel);
            y += 14;

            abilities.slice(0, 3).forEach(abilId => {
                const abilBg = s.add.graphics();
                abilBg.fillStyle(0x0d1020, 0.8);
                abilBg.fillRoundedRect(PAD, y, CW - PAD * 2, 22, 3);
                abilBg.lineStyle(1, 0x222233, 0.5);
                abilBg.strokeRoundedRect(PAD, y, CW - PAD * 2, 22, 3);

                const dot = s.add.graphics();
                dot.fillStyle(classColor, 0.8);
                dot.fillCircle(PAD + 8, y + 11, 3);

                const abilName = abilId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const abilTxt = s.add.text(PAD + 16, y + 4, abilName, {
                    fontFamily: 'Open Sans', fontSize: '14px', color: '#aabbcc',
                });
                this._rightContainer.add([abilBg, dot, abilTxt]);
                y += 26;
            });
        }

        // ── RECRUIT button (if not in party) ──
        if (!isInParty) {
            const btnW = 120, btnH = 28;
            const btnX = CW - btnW - PAD;
            const btnY = CONTENT_H - btnH - 10;
            const recruitBg = s.add.graphics();
            recruitBg.fillStyle(0x113322, 0.9);
            recruitBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
            recruitBg.lineStyle(1, 0x44aa66, 0.8);
            recruitBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
            const recruitTxt = s.add.text(btnX + btnW / 2, btnY + btnH / 2, 'RECRUIT', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#44ff88',
            }).setOrigin(0.5);
            const recruitZone = s.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
                .setInteractive({ useHandCursor: true });
            recruitZone.on('pointerdown', () => {
                EventBus.emit('companion:recruit', { companionId: companion.id });
            });
            recruitZone.on('pointerover', () => {
                recruitBg.clear();
                recruitBg.fillStyle(0x224433, 0.95);
                recruitBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
                recruitBg.lineStyle(1, 0x44ff88, 0.9);
                recruitBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
            });
            recruitZone.on('pointerout', () => {
                recruitBg.clear();
                recruitBg.fillStyle(0x113322, 0.9);
                recruitBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
                recruitBg.lineStyle(1, 0x44aa66, 0.8);
                recruitBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
            });
            this._rightContainer.add([recruitBg, recruitTxt, recruitZone]);
        } else {
            // Show "IN PARTY" badge instead
            const badgeBg = s.add.graphics();
            const btnW = 100, btnH = 24;
            const btnX = CW - btnW - PAD;
            const btnY = CONTENT_H - btnH - 12;
            badgeBg.fillStyle(0x112233, 0.8);
            badgeBg.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
            badgeBg.lineStyle(1, 0x4488cc, 0.6);
            badgeBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 4);
            const badgeTxt = s.add.text(btnX + btnW / 2, btnY + btnH / 2, '★ IN PARTY', {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#44aaff',
            }).setOrigin(0.5);
            this._rightContainer.add([badgeBg, badgeTxt]);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // BOTTOM — Full roster bar
    // ──────────────────────────────────────────────────────────────────

    _buildBottom() {
        this._bottomContainer.removeAll(true);
        const s = this.scene;

        const allCompanions = this._getCompanions();
        const party = this._getActiveParty();
        const partyIds = party.map(p => (typeof p === 'string' ? p : p.id));

        // Label
        const rosterLabel = s.add.text(8, 4, 'ROSTER', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#445566',
        });
        this._bottomContainer.add(rosterLabel);

        const CARD_W = Math.floor((PW - 20) / 5);
        const CARD_H = BOTTOM_H - 16;

        allCompanions.slice(0, 5).forEach((companion, i) => {
            const cx = 10 + i * (CARD_W + 2);
            const cy = 14;
            const classColor = getClassColor(companion.class);
            const bondLevel = companion.bondLevel ?? 0;
            const isInParty = partyIds.includes(companion.id);
            const isSelected = this._selectedId === companion.id;

            const cardBg = s.add.graphics();
            cardBg.fillStyle(isSelected ? 0x1a2244 : 0x0d1020, 0.9);
            cardBg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 4);
            cardBg.lineStyle(1, isSelected ? 0x4466cc : (isInParty ? classColor : 0x222233), isSelected ? 0.9 : 0.5);
            cardBg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 4);
            this._bottomContainer.add(cardBg);

            // Mini portrait
            const portGfx = s.add.graphics();
            portGfx.fillStyle(classColor, 0.7);
            portGfx.fillRoundedRect(cx + 4, cy + 4, 22, 22, 3);
            const portInitials = s.add.text(cx + 4 + 11, cy + 4 + 11, (companion.name || '?').substring(0, 1), {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#ffffff',
            }).setOrigin(0.5);
            this._bottomContainer.add([portGfx, portInitials]);

            // Name
            const nameTxt = s.add.text(cx + 30, cy + 4, companion.name || '?', {
                fontFamily: 'Open Sans', fontSize: '13px', color: isInParty ? '#ddeeff' : '#778899',
            });
            this._bottomContainer.add(nameTxt);

            // Role
            const roleTxt = s.add.text(cx + 30, cy + 15, (companion.role || '').toUpperCase(), {
                fontFamily: 'Open Sans', fontSize: '11px', color: '#445566',
            });
            this._bottomContainer.add(roleTxt);

            // Bond stars (compact)
            const starsShort = '★'.repeat(Math.min(5, bondLevel)) + '☆'.repeat(Math.max(0, 5 - bondLevel));
            const starsColor = bondLevel >= 8 ? '#ffcc44' : bondLevel >= 4 ? '#88aaff' : '#333355';
            const starsTxt = s.add.text(cx + 30, cy + 26, starsShort, {
                fontFamily: 'Open Sans', fontSize: '11px', color: starsColor,
            });
            this._bottomContainer.add(starsTxt);

            // Active / recruit badge
            const badgeLabel = isInParty ? 'ACTIVE' : (companion.recruited ? 'RECRUIT' : 'LOCKED');
            const badgeColor = isInParty ? '#44cc88' : (companion.recruited ? '#4488cc' : '#333344');
            const badgeTxt = s.add.text(cx + CARD_W - 4, cy + 4, badgeLabel, {
                fontFamily: 'Open Sans', fontSize: '10px', color: badgeColor,
            }).setOrigin(1, 0);
            this._bottomContainer.add(badgeTxt);

            // Click to select
            const cardZone = s.add.zone(cx + CARD_W / 2, cy + CARD_H / 2, CARD_W, CARD_H)
                .setInteractive({ useHandCursor: true });
            cardZone.on('pointerdown', () => {
                this._selectedId = companion.id;
                this._buildBottom();
                this._buildLeft();
                this._buildRight();
            });
            this._bottomContainer.add(cardZone);
        });

        // If no companions loaded yet
        if (allCompanions.length === 0) {
            const emptyTxt = s.add.text(PW / 2, BOTTOM_H / 2, 'No companions found', {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#333344',
            }).setOrigin(0.5);
            this._bottomContainer.add(emptyTxt);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Event wiring
    // ──────────────────────────────────────────────────────────────────

    _wireEvents() {
        this._unsubs = [
            EventBus.on('companion:recruited', () => {
                if (this.visible) this._refresh();
            }),
            EventBus.on('companion:leftParty', () => {
                if (this.visible) this._refresh();
            }),
            EventBus.on('companion:bondChanged', () => {
                if (this.visible) this._refresh();
            }),
        ];
    }

    destroy() {
        this._unsubs?.forEach(fn => fn());
        this._container?.destroy(true);
    }
}
