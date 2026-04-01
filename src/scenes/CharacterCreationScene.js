import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';
import { AttributeSystem } from '../systems/AttributeSystem.js';

/**
 * CharacterCreationScene — 3-column layout.
 *
 * Left   (374px): Ancestry selection — 3 stacked cards
 * Center (420px): Attribute point allocation — 5 rows
 * Right  (450px): Backstory / Path / Appearance stacked sections
 * Bottom (90px) : Character summary strip + BEGIN ADVENTURE button
 *
 * Flow: ClassSelectionScene → CharacterCreationScene → GameScene
 */
export default class CharacterCreationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterCreationScene' });
    }

    create() {
        this.classSystem = PlayerClassSystem.getInstance();
        this.attributeSystem = AttributeSystem.getInstance();

        const { width, height } = this.scale;

        // ── Ancestry data ──────────────────────────────────────────────
        this.ancestries = dataManager.getAllAncestries?.() || [];
        if (this.ancestries.length === 0) {
            const data = dataManager.getAncestryData?.();
            this.ancestries = data?.ancestries || [];
        }
        if (this.ancestries.length === 0) {
            this.ancestries = [
                {
                    id: 'human', name: 'Human',
                    description: 'Adaptable and resourceful, humans flourish in every corner of the realm, driven by ambition alone.',
                    attributeModifiers: [{ attribute: 'player_choice', value: 1 }],
                    specialAbility: { name: 'Resilient', description: 'Once per rest, reduce incoming damage by 5.' }
                },
                {
                    id: 'soulborn', name: 'Soulborn',
                    description: 'Infused with radiant Sap energy from birth, the Soulborn glow faintly in darkness and dream in light.',
                    attributeModifiers: [{ attribute: 'Insight', value: 2 }],
                    specialAbility: { name: 'Sap Resonance', description: 'Spells cost 1 less SP during Silver Sap phase.' }
                },
                {
                    id: 'half-abyss', name: 'Half-Abyss',
                    description: 'Born of mortal and shadow, they carry the Veil\'s echo in their blood and walk between two worlds.',
                    attributeModifiers: [{ attribute: 'Agility', value: 1 }, { attribute: 'Charisma', value: 1 }],
                    specialAbility: { name: 'Shadow Step', description: 'Teleport up to 3 tiles once per combat.' }
                }
            ];
        }

        // ── State ──────────────────────────────────────────────────────
        this.selectedAncestryIndex = 0;
        this.attributes = { Might: 0, Agility: 0, Resilience: 0, Insight: 0, Charisma: 0 };
        this.pointsRemaining = 8;
        this.maxPerAttr = 4;
        this.selectedVariant = 'pure';
        this.selectedBackstoryIndex = 0;
        this.selectedBodyType = 0;
        this.selectedSkinTone = 0;
        this.selectedHairStyle = 0;
        this.selectedSigilPlacement = 0;
        this.hairStyles = Array.from({ length: 15 }, (_, i) => `Style ${i + 1}`);

        this.backstories = [
            { id: 'orphan_of_the_grove',  name: 'Orphan of the Grove',    description: 'Raised by the trees themselves after your family vanished during a Crimson Sap surge.',          bonusSkill: 'survival',   bonusQuest: 'find_your_family'   },
            { id: 'coven_apprentice',      name: 'Coven Apprentice',       description: 'Trained by an Emerald Coven mystic who disappeared, leaving only cryptic notes behind.',         bonusSkill: 'arcana',     bonusQuest: 'the_missing_mentor' },
            { id: 'bloomguard_recruit',    name: 'Bloomguard Recruit',     description: 'You served as a Bloomguard cadet before a scandal forced you out. Now you seek redemption.',     bonusSkill: 'athletics',  bonusQuest: 'clear_your_name'    },
            { id: 'wandering_trader',      name: 'Wandering Trader',       description: 'A Sapling Consortium merchant who stumbled into something far larger than any trade deal.',      bonusSkill: 'persuasion', bonusQuest: 'the_lost_caravan'   },
            { id: 'corruption_survivor',   name: 'Corruption Survivor',    description: 'You survived Blight infection as a child, leaving you scarred but strangely resistant.',         bonusSkill: 'medicine',   bonusQuest: 'the_cure'           },
            { id: 'veil_touched',          name: 'Veil-Touched',           description: 'Born during a Silver Sap phase, you occasionally hear whispers from beyond the Veil.',          bonusSkill: 'perception', bonusQuest: 'voices_in_the_veil' },
            { id: 'beast_raised',          name: 'Beast-Raised',           description: 'Abandoned as an infant and raised by Wildkin creatures deep in the ancient forest.',             bonusSkill: 'nature',     bonusQuest: 'the_wild_calling'   },
            { id: 'noble_exile',           name: 'Noble Exile',            description: 'Heir to a disgraced Thornbinder house, you walk the line between shadow and light.',            bonusSkill: 'deception',  bonusQuest: 'house_of_thorns'    }
        ];

        // Apply class base stats
        const cls = this.classSystem.getCurrentClass();
        if (cls?.baseStats) {
            this.attributes.Might      = cls.baseStats.might      || 0;
            this.attributes.Agility    = cls.baseStats.agility    || 0;
            this.attributes.Resilience = cls.baseStats.resilience || 0;
            this.attributes.Insight    = cls.baseStats.insight    || 0;
            this.attributes.Charisma   = cls.baseStats.charisma   || 0;
        }

        // ── Layout constants ───────────────────────────────────────────
        // Screen: 1280 × 720.  Columns: y 68–616 (h 548).  Strip: y 620–710 (h 90).
        const COL_L = { x: 10,  w: 374, y: 68, h: 548 };  // right edge 384
        const COL_C = { x: 392, w: 420, y: 68, h: 548 };  // right edge 812
        const COL_R = { x: 820, w: 450, y: 68, h: 548 };  // right edge 1270

        this._buildBackground(width, height);
        this._buildTitleBar(width, cls);
        this._buildAncestryPanel(COL_L);
        this._buildAttributePanel(COL_C);
        this._buildRightColumn(COL_R);
        this._buildSummaryStrip(width);

        this.input.keyboard.on('keydown-ENTER', () => this._confirm());
        this.input.keyboard.on('keydown-SPACE', () => this._confirm());
    }

    // ── Background ────────────────────────────────────────────────────
    _buildBackground(width, height) {
        const bg = this.add.graphics();
        bg.fillStyle(0x07070f, 1);
        bg.fillRect(0, 0, width, height);
        bg.lineStyle(1, 0x14142a, 0.25);
        for (let x = 0; x < width; x += 64) bg.lineBetween(x, 0, x, height);
        for (let y = 0; y < height; y += 64) bg.lineBetween(0, y, width, y);
    }

    // ── Title bar ─────────────────────────────────────────────────────
    _buildTitleBar(width, cls) {
        const bar = this.add.graphics();
        bar.fillStyle(0x0b0b1d, 1);
        bar.fillRect(0, 0, width, 66);
        bar.lineStyle(1, 0x30305a, 0.8);
        bar.lineBetween(0, 66, width, 66);

        this.add.text(width / 2, 14, 'CHARACTER CREATION', {
            fontFamily: '"Cinzel Decorative", Cinzel, serif',
            fontSize: '26px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0);

        this.add.text(width / 2, 44, `Class: ${cls?.name || 'Adventurer'}`, {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#6a8a6a', letterSpacing: 2
        }).setOrigin(0.5, 0);
    }

    // ─────────────────────────────────────────────────────────────────
    //  LEFT COLUMN — Ancestry
    // ─────────────────────────────────────────────────────────────────
    _buildAncestryPanel(col) {
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d0d1e, 0.97);
        panelBg.fillRect(col.x, col.y, col.w, col.h);
        panelBg.lineStyle(1, 0x28284a, 0.8);
        panelBg.strokeRect(col.x, col.y, col.w, col.h);

        this.add.text(col.x + col.w / 2, col.y + 12, 'CHOOSE ANCESTRY', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 3
        }).setOrigin(0.5, 0);

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x38385a, 0.5);
        divider.lineBetween(col.x + 12, col.y + 33, col.x + col.w - 12, col.y + 33);

        this._ancestryCards = [];
        const HEADER_H = 37;
        const CARD_GAP = 4;
        const cardH = Math.floor((col.h - HEADER_H - CARD_GAP * (this.ancestries.length + 1)) / this.ancestries.length);
        const cardW = col.w - CARD_GAP * 2;

        this.ancestries.forEach((ancestry, i) => {
            const cx = col.x + CARD_GAP;
            const cy = col.y + HEADER_H + CARD_GAP + i * (cardH + CARD_GAP);
            const card = this._createAncestryCard(cx, cy, cardW, cardH, ancestry, i);
            this._ancestryCards.push(card);
        });

        this._highlightAncestry(0);
    }

    _createAncestryCard(x, y, w, h, ancestry, index) {
        const COLORS = {
            human: 0x8aaa66, soulborn: 0x6688cc,
            'half-abyss': 0xaa6699, half_abyss: 0xaa6699
        };
        const color = COLORS[ancestry.id] || 0x7788aa;
        const colorStr = `#${color.toString(16).padStart(6, '0')}`;

        const bg = this.add.graphics();

        // Name
        this.add.text(x + 14, y + 12, ancestry.name, {
            fontFamily: 'Cinzel, serif',
            fontSize: '16px', color: colorStr,
            stroke: '#000000', strokeThickness: 2
        });

        // Description
        const desc = (ancestry.description || '').substring(0, 130);
        this.add.text(x + 14, y + 34, desc, {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '11px', color: '#7a8aaa',
            wordWrap: { width: w - 28 }, lineSpacing: 3
        });

        // Modifiers section (bottom-anchored)
        const mods = ancestry.attributeModifiers || [];
        const hasAbility = !!ancestry.specialAbility;
        const abilH = hasAbility ? 30 : 0;
        const modsH = mods.length * 16;
        let modLabelY = y + h - abilH - modsH - 22;

        this.add.text(x + 14, modLabelY, 'Modifiers', {
            fontFamily: 'Cinzel, serif', fontSize: '10px', color: '#5a6a4a', letterSpacing: 1
        });

        mods.forEach((mod, mi) => {
            const label = mod.attribute === 'player_choice'
                ? `  +${mod.value} to your choice`
                : `  +${mod.value} ${mod.attribute}`;
            this.add.text(x + 14, modLabelY + 14 + mi * 16, label, {
                fontFamily: '"Open Sans", sans-serif', fontSize: '12px', color: colorStr
            });
        });

        if (hasAbility) {
            const abilText = `✦ ${ancestry.specialAbility.name}: ${(ancestry.specialAbility.description || '').substring(0, 60)}`;
            this.add.text(x + 14, y + h - 26, abilText, {
                fontFamily: '"Open Sans", sans-serif',
                fontSize: '11px', color: '#b89030',
                wordWrap: { width: w - 28 }
            });
        }

        // Click zone
        const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
            this.selectedAncestryIndex = index;
            this._highlightAncestry(index);
            this._updateSummary();
        });

        return { bg, color, x, y, w, h };
    }

    _highlightAncestry(index) {
        this._ancestryCards.forEach((card, i) => {
            card.bg.clear();
            if (i === index) {
                card.bg.fillStyle(0x171730, 1);
                card.bg.fillRoundedRect(card.x, card.y, card.w, card.h, 5);
                card.bg.lineStyle(2, card.color, 0.95);
                card.bg.strokeRoundedRect(card.x, card.y, card.w, card.h, 5);
                card.bg.fillStyle(card.color, 0.75);
                card.bg.fillRect(card.x, card.y + 5, 3, card.h - 10);
            } else {
                card.bg.fillStyle(0x0c0c1e, 0.7);
                card.bg.fillRoundedRect(card.x, card.y, card.w, card.h, 5);
                card.bg.lineStyle(1, card.color, 0.22);
                card.bg.strokeRoundedRect(card.x, card.y, card.w, card.h, 5);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    //  CENTER COLUMN — Attribute Allocation
    // ─────────────────────────────────────────────────────────────────
    _buildAttributePanel(col) {
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d0d1e, 0.97);
        panelBg.fillRect(col.x, col.y, col.w, col.h);
        panelBg.lineStyle(1, 0x28284a, 0.8);
        panelBg.strokeRect(col.x, col.y, col.w, col.h);

        this.add.text(col.x + col.w / 2, col.y + 12, 'ALLOCATE ATTRIBUTES', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 2
        }).setOrigin(0.5, 0);

        this._pointsText = this.add.text(col.x + col.w / 2, col.y + 32, `${this.pointsRemaining} points remaining`, {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '13px', color: '#70b870'
        }).setOrigin(0.5, 0);

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x38385a, 0.5);
        divider.lineBetween(col.x + 12, col.y + 51, col.x + col.w - 12, col.y + 51);

        const ATTR_NAMES  = ['Might', 'Agility', 'Resilience', 'Insight', 'Charisma'];
        const ATTR_COLORS = {
            Might: '#b05555', Agility: '#55996a', Resilience: '#5580a8',
            Insight: '#8055b0', Charisma: '#b09030'
        };
        const ATTR_DESCS  = {
            Might:      'Physical power, melee damage, carry weight',
            Agility:    'Speed, evasion, initiative, ranged accuracy',
            Resilience: 'Max HP, damage resistance, stamina recovery',
            Insight:    'Magic potency, perception, lore knowledge',
            Charisma:   'Persuasion, prices, companion bond strength'
        };

        this._attrTexts     = {};
        this._attrBarGfx    = {};
        this._attrBarLayout = {};

        const HEADER_H = 55;
        const rowH = Math.floor((col.h - HEADER_H) / ATTR_NAMES.length);

        ATTR_NAMES.forEach((attr, i) => {
            const ay = col.y + HEADER_H + i * rowH;

            // Alternating row tint
            if (i % 2 === 1) {
                const rowTint = this.add.graphics();
                rowTint.fillStyle(0x111130, 0.35);
                rowTint.fillRect(col.x + 2, ay, col.w - 4, rowH);
            }

            // Attribute name
            this.add.text(col.x + 14, ay + 10, attr, {
                fontFamily: 'Cinzel, serif',
                fontSize: '15px', color: ATTR_COLORS[attr],
                stroke: '#000000', strokeThickness: 1
            });

            // Description
            this.add.text(col.x + 14, ay + 30, ATTR_DESCS[attr], {
                fontFamily: '"Open Sans", sans-serif',
                fontSize: '11px', color: '#4a5a6a'
            });

            // Bar
            const barX = col.x + 14;
            const barY = ay + 48;
            const barW = col.w - 110;
            const barGfx = this.add.graphics();
            this._attrBarGfx[attr]    = barGfx;
            this._attrBarLayout[attr] = { x: barX, y: barY, width: barW };
            this._drawAttrBar(barGfx, barX, barY, barW, attr, ATTR_COLORS[attr]);

            // Current value (right side, vertically centered in row)
            this._attrTexts[attr] = this.add.text(col.x + col.w - 65, ay + rowH / 2, `${this.attributes[attr]}`, {
                fontFamily: 'Cinzel, serif',
                fontSize: '24px', color: '#e8e8e8',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);

            // Minus button
            const minusBtn = this.add.text(col.x + col.w - 100, ay + rowH / 2 - 1, '−', {
                fontFamily: '"Open Sans", sans-serif',
                fontSize: '22px', color: '#994444',
                backgroundColor: '#1a0808', padding: { x: 6, y: 2 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            minusBtn.on('pointerdown', () => this._adjustAttribute(attr, -1));
            minusBtn.on('pointerover', () => minusBtn.setColor('#dd6666'));
            minusBtn.on('pointerout',  () => minusBtn.setColor('#994444'));

            // Plus button
            const plusBtn = this.add.text(col.x + col.w - 22, ay + rowH / 2 - 1, '+', {
                fontFamily: '"Open Sans", sans-serif',
                fontSize: '22px', color: '#449944',
                backgroundColor: '#081808', padding: { x: 6, y: 2 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            plusBtn.on('pointerdown', () => this._adjustAttribute(attr, 1));
            plusBtn.on('pointerover', () => plusBtn.setColor('#66dd66'));
            plusBtn.on('pointerout',  () => plusBtn.setColor('#449944'));
        });
    }

    _drawAttrBar(gfx, x, y, w, attr, colorStr) {
        gfx.clear();
        gfx.fillStyle(0x181830, 1);
        gfx.fillRoundedRect(x, y, w, 8, 3);
        const ratio = Math.min(1, this.attributes[attr] / 6);
        if (ratio > 0) {
            const barColor = parseInt(colorStr.replace('#', ''), 16);
            gfx.fillStyle(barColor, 0.7);
            gfx.fillRoundedRect(x, y, w * ratio, 8, 3);
        }
    }

    _adjustAttribute(attr, delta) {
        const cls = this.classSystem.getCurrentClass();
        const baseVal  = cls?.baseStats?.[attr.toLowerCase()] || 0;
        const allocated = this.attributes[attr] - baseVal;

        if (delta > 0) {
            if (this.pointsRemaining <= 0) return;
            if (allocated >= this.maxPerAttr) return;
            if (this.attributes[attr] >= 6) return;
            this.attributes[attr]++;
            this.pointsRemaining--;
        } else {
            if (allocated <= 0) return;
            this.attributes[attr]--;
            this.pointsRemaining++;
        }

        this._refreshAttributeDisplay();
        this._updateSummary();
    }

    _refreshAttributeDisplay() {
        this._pointsText.setText(`${this.pointsRemaining} points remaining`);
        this._pointsText.setColor(this.pointsRemaining > 0 ? '#70b870' : '#c0c0c0');

        const ATTR_COLORS = {
            Might: '#b05555', Agility: '#55996a', Resilience: '#5580a8',
            Insight: '#8055b0', Charisma: '#b09030'
        };
        for (const [attr, text] of Object.entries(this._attrTexts)) {
            text.setText(`${this.attributes[attr]}`);
            const gfx    = this._attrBarGfx[attr];
            const layout = this._attrBarLayout[attr];
            if (gfx && layout) this._drawAttrBar(gfx, layout.x, layout.y, layout.width, attr, ATTR_COLORS[attr]);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    //  RIGHT COLUMN — Backstory / Path / Appearance
    // ─────────────────────────────────────────────────────────────────
    _buildRightColumn(col) {
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x0d0d1e, 0.97);
        panelBg.fillRect(col.x, col.y, col.w, col.h);
        panelBg.lineStyle(1, 0x28284a, 0.8);
        panelBg.strokeRect(col.x, col.y, col.w, col.h);

        const BS_H = 208;  // Backstory
        const PV_H = 128;  // Path / Variant
        // Appearance: remaining space
        const AP_H = col.h - BS_H - PV_H - 8;

        this._buildBackstorySection(col.x, col.y,                    col.w, BS_H);

        const div = this.add.graphics();
        div.lineStyle(1, 0x2a2a4a, 0.5);
        div.lineBetween(col.x + 12, col.y + BS_H + 2, col.x + col.w - 12, col.y + BS_H + 2);

        this._buildVariantSection(col.x, col.y + BS_H + 4, col.w, PV_H);

        div.lineBetween(col.x + 12, col.y + BS_H + PV_H + 6, col.x + col.w - 12, col.y + BS_H + PV_H + 6);

        this._buildAppearanceSection(col.x, col.y + BS_H + PV_H + 8, col.w, AP_H);
    }

    // ── Backstory ─────────────────────────────────────────────────────
    _buildBackstorySection(x, y, w, h) {
        this.add.text(x + w / 2, y + 12, 'BACKSTORY', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 3
        }).setOrigin(0.5, 0);

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x38385a, 0.5);
        divider.lineBetween(x + 12, y + 32, x + w - 12, y + 32);

        const bs   = this.backstories[0];
        const midX = x + w / 2;

        const leftBtn = this.add.text(x + 18, y + 52, '‹', {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '28px', color: '#7088aa'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        leftBtn.on('pointerdown', () => this._navigateBackstory(-1));
        leftBtn.on('pointerover', () => leftBtn.setColor('#aabbdd'));
        leftBtn.on('pointerout',  () => leftBtn.setColor('#7088aa'));

        const rightBtn = this.add.text(x + w - 18, y + 52, '›', {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '28px', color: '#7088aa'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        rightBtn.on('pointerdown', () => this._navigateBackstory(1));
        rightBtn.on('pointerover', () => rightBtn.setColor('#aabbdd'));
        rightBtn.on('pointerout',  () => rightBtn.setColor('#7088aa'));

        this._backstoryNameText = this.add.text(midX, y + 40, bs.name, {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#9aaabb'
        }).setOrigin(0.5, 0);

        this._backstoryDescText = this.add.text(midX, y + 62, bs.description, {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '12px', color: '#6a7a8a',
            wordWrap: { width: w - 70 }, align: 'center', lineSpacing: 4
        }).setOrigin(0.5, 0);

        this._backstoryBonusText = this.add.text(midX, y + h - 22, `Bonus skill: ${bs.bonusSkill}`, {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '12px', color: '#c0942a'
        }).setOrigin(0.5, 0);
    }

    _navigateBackstory(dir) {
        this.selectedBackstoryIndex = (this.selectedBackstoryIndex + dir + this.backstories.length) % this.backstories.length;
        const bs = this.backstories[this.selectedBackstoryIndex];
        this._backstoryNameText.setText(bs.name);
        this._backstoryDescText.setText(bs.description);
        this._backstoryBonusText.setText(`Bonus skill: ${bs.bonusSkill}`);
        this._updateSummary();
    }

    // ── Path / Variant ────────────────────────────────────────────────
    _buildVariantSection(x, y, w, h) {
        this.add.text(x + w / 2, y + 10, 'PATH', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 3
        }).setOrigin(0.5, 0);

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x38385a, 0.5);
        divider.lineBetween(x + 12, y + 30, x + w - 12, y + 30);

        const variants = [
            { id: 'pure',     name: 'Pure — Lumen', color: 0x3a8850, desc: 'Healing, protection, growth magic' },
            { id: 'blighted', name: 'Blighted',      color: 0x883355, desc: 'Decay, corruption, shadow power' }
        ];

        this._variantBgs = [];
        const VH  = 36;
        const VY0 = y + 36;

        variants.forEach((v, i) => {
            const vx = x + 12;
            const vy = VY0 + i * (VH + 8);
            const vw = w - 24;
            const colorStr = `#${v.color.toString(16).padStart(6, '0')}`;

            const vbg = this.add.graphics();
            this._drawVariantBg(vbg, vx, vy, vw, VH, v.color, this.selectedVariant === v.id);
            this._variantBgs.push({ bg: vbg, vx, vy, vw, vh: VH, color: v.color, id: v.id });

            this.add.text(vx + 14, vy + 7, v.name, {
                fontFamily: 'Cinzel, serif', fontSize: '13px', color: colorStr
            });
            this.add.text(vx + 14, vy + 22, v.desc, {
                fontFamily: '"Open Sans", sans-serif', fontSize: '11px', color: '#5a6a7a'
            });

            const hit = this.add.zone(vx + vw / 2, vy + VH / 2, vw, VH).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => {
                this.selectedVariant = v.id;
                this._refreshVariantHighlight();
                this._updateSummary();
            });
        });
    }

    _drawVariantBg(gfx, x, y, w, h, color, selected) {
        gfx.clear();
        gfx.fillStyle(selected ? 0x181830 : 0x0d0d1e, selected ? 1 : 0.6);
        gfx.fillRoundedRect(x, y, w, h, 4);
        gfx.lineStyle(selected ? 2 : 1, color, selected ? 0.9 : 0.22);
        gfx.strokeRoundedRect(x, y, w, h, 4);
        if (selected) {
            gfx.fillStyle(color, 0.7);
            gfx.fillRect(x, y + 5, 3, h - 10);
        }
    }

    _refreshVariantHighlight() {
        for (const v of this._variantBgs) {
            this._drawVariantBg(v.bg, v.vx, v.vy, v.vw, v.vh, v.color, this.selectedVariant === v.id);
        }
    }

    // ── Appearance ────────────────────────────────────────────────────
    _buildAppearanceSection(x, y, w, h) {
        this.add.text(x + w / 2, y + 10, 'APPEARANCE', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px', color: '#c8a96e',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 3
        }).setOrigin(0.5, 0);

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x38385a, 0.5);
        divider.lineBetween(x + 12, y + 30, x + w - 12, y + 30);

        const LABEL_X    = x + 14;
        const OPT_X      = x + 82;
        const OPT_SPACE  = 52;
        const ROW_H      = 26;
        const ROWS_Y0    = y + 36;

        const rows = [
            { label: 'Body',  opts: ['Slim', 'Sturdy'],             get: () => this.selectedBodyType,       set: v => { this.selectedBodyType = v; } },
            { label: 'Skin',  opts: ['Pale', 'Tan', 'Brown', 'Dark'], get: () => this.selectedSkinTone,    set: v => { this.selectedSkinTone = v; } },
            { label: 'Sigil', opts: ['Forehead', 'Cheek', 'Chest'],  get: () => this.selectedSigilPlacement, set: v => { this.selectedSigilPlacement = v; } }
        ];

        this._appearanceOptionButtons = [];
        rows.forEach(({ label, opts, get, set }, ri) => {
            const ry = ROWS_Y0 + ri * ROW_H;
            this.add.text(LABEL_X, ry + 5, `${label}:`, {
                fontFamily: '"Open Sans", sans-serif', fontSize: '12px', color: '#7a8aaa'
            });
            const rowBtns = [];
            opts.forEach((txt, j) => {
                const btn = this.add.text(OPT_X + j * OPT_SPACE, ry + 5, txt, {
                    fontFamily: '"Open Sans", sans-serif',
                    fontSize: '12px', color: get() === j ? '#70cc70' : '#3a4a5a'
                }).setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => { set(j); this._updateAppearanceButtons(); this._updateSummary(); });
                btn.on('pointerover', () => { if (get() !== j) btn.setColor('#6a8888'); });
                btn.on('pointerout',  () => { btn.setColor(get() === j ? '#70cc70' : '#3a4a5a'); });
                rowBtns.push({ btn, get });
            });
            this._appearanceOptionButtons.push(rowBtns);
        });

        // Hair cycler
        const hairY = ROWS_Y0 + rows.length * ROW_H + 6;
        this.add.text(LABEL_X, hairY + 5, 'Hair:', {
            fontFamily: '"Open Sans", sans-serif', fontSize: '12px', color: '#7a8aaa'
        });

        const leftH = this.add.text(OPT_X, hairY + 5, '‹', {
            fontFamily: '"Open Sans", sans-serif', fontSize: '18px', color: '#7088aa'
        }).setInteractive({ useHandCursor: true });
        leftH.on('pointerdown', () => {
            this.selectedHairStyle = (this.selectedHairStyle - 1 + 15) % 15;
            this._hairLabel.setText(this.hairStyles[this.selectedHairStyle]);
            this._updateSummary();
        });

        this._hairLabel = this.add.text(OPT_X + 22, hairY + 7, this.hairStyles[0], {
            fontFamily: '"Open Sans", sans-serif', fontSize: '12px', color: '#aabbcc'
        });

        const rightH = this.add.text(OPT_X + 110, hairY + 5, '›', {
            fontFamily: '"Open Sans", sans-serif', fontSize: '18px', color: '#7088aa'
        }).setInteractive({ useHandCursor: true });
        rightH.on('pointerdown', () => {
            this.selectedHairStyle = (this.selectedHairStyle + 1) % 15;
            this._hairLabel.setText(this.hairStyles[this.selectedHairStyle]);
            this._updateSummary();
        });
    }

    _updateAppearanceButtons() {
        if (!this._appearanceOptionButtons) return;
        this._appearanceOptionButtons.forEach(rowBtns => {
            rowBtns.forEach(({ btn, get }, j) => {
                btn.setColor(get() === j ? '#70cc70' : '#3a4a5a');
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────
    //  BOTTOM STRIP — Summary + Confirm
    // ─────────────────────────────────────────────────────────────────
    _buildSummaryStrip(width) {
        const SX = 10;
        const SY = 620;
        const SW = width - 20;
        const SH = 90;

        const bg = this.add.graphics();
        bg.fillStyle(0x0b0b1d, 0.98);
        bg.fillRect(SX, SY, SW, SH);
        bg.lineStyle(1, 0x30305a, 0.8);
        bg.strokeRect(SX, SY, SW, SH);

        this.add.text(SX + 16, SY + 10, 'CHARACTER SUMMARY', {
            fontFamily: 'Cinzel, serif',
            fontSize: '10px', color: '#50604a', letterSpacing: 2
        });

        this._summaryText = this.add.text(SX + 16, SY + 26, '', {
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '12px', color: '#8a9aaa',
            wordWrap: { width: SW - 270 }, lineSpacing: 4
        });

        // Confirm button
        const BTN_W = 220;
        const BTN_H = 52;
        const BTN_X = width - SX - BTN_W - 10;
        const BTN_Y = SY + (SH - BTN_H) / 2;

        const btnBg = this.add.graphics();
        this._drawConfirmBtn(btnBg, BTN_X, BTN_Y, BTN_W, BTN_H, false);

        this.add.text(BTN_X + BTN_W / 2, BTN_Y + BTN_H / 2, 'BEGIN ADVENTURE', {
            fontFamily: 'Cinzel, serif',
            fontSize: '15px', color: '#c0d090',
            stroke: '#000000', strokeThickness: 2, letterSpacing: 1
        }).setOrigin(0.5);

        const hit = this.add.zone(BTN_X + BTN_W / 2, BTN_Y + BTN_H / 2, BTN_W, BTN_H).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this._confirm());
        hit.on('pointerover', () => this._drawConfirmBtn(btnBg, BTN_X, BTN_Y, BTN_W, BTN_H, true));
        hit.on('pointerout',  () => this._drawConfirmBtn(btnBg, BTN_X, BTN_Y, BTN_W, BTN_H, false));

        this._updateSummary();
    }

    _drawConfirmBtn(gfx, x, y, w, h, hover) {
        gfx.clear();
        gfx.fillStyle(hover ? 0x284428 : 0x1a2e1a, 0.97);
        gfx.fillRoundedRect(x, y, w, h, 6);
        gfx.lineStyle(hover ? 2 : 1, hover ? 0x88bb55 : 0x486a30, 0.9);
        gfx.strokeRoundedRect(x, y, w, h, 6);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Logic
    // ─────────────────────────────────────────────────────────────────
    _updateSummary() {
        const cls       = this.classSystem.getCurrentClass();
        const ancestry  = this.ancestries[this.selectedAncestryIndex];
        const backstory = this.backstories[this.selectedBackstoryIndex];

        const clsName      = cls?.name    || 'Adventurer';
        const ancName      = ancestry?.name || 'Unknown';
        const variantLabel = this.selectedVariant === 'pure' ? 'Pure (Lumen)' : 'Blighted';
        const hp           = (cls?.startingHP  || 30) + (this.attributes.Resilience * 5);
        const guard        = cls?.startingGuard || 5;

        const bodyLabels  = ['Slim', 'Sturdy'];
        const skinLabels  = ['Pale', 'Tan', 'Brown', 'Dark'];
        const hairLabel   = this.hairStyles?.[this.selectedHairStyle] || 'Style 1';

        const attrLine = this.pointsRemaining > 0
            ? `${this.pointsRemaining} attribute point${this.pointsRemaining > 1 ? 's' : ''} still unspent`
            : `MIG ${this.attributes.Might}  AGI ${this.attributes.Agility}  RES ${this.attributes.Resilience}  INS ${this.attributes.Insight}  CHA ${this.attributes.Charisma}`;

        const lines = [
            `${ancName} ${variantLabel} ${clsName}  ·  ${backstory?.name || ''}`,
            `HP ${hp}  Guard ${guard}  AP ${cls?.baseAP || 2}  ·  ${bodyLabels[this.selectedBodyType]}, ${skinLabels[this.selectedSkinTone]}, ${hairLabel}`,
            attrLine
        ];

        if (this._summaryText) this._summaryText.setText(lines.join('\n'));
    }

    _confirm() {
        if (this.pointsRemaining > 0) {
            this._pointsText.setColor('#dd4444');
            this.tweens.add({
                targets: this._pointsText,
                alpha: { from: 0.3, to: 1 },
                duration: 180, repeat: 3,
                onComplete: () => { if (this._pointsText?.active) this._pointsText.setAlpha(1); }
            });
            return;
        }

        const ancestry  = this.ancestries[this.selectedAncestryIndex];
        const backstory = this.backstories[this.selectedBackstoryIndex];

        this.registry.set('selectedAncestry',    ancestry?.id || 'human');
        this.registry.set('allocatedAttributes',  { ...this.attributes });
        this.registry.set('selectedVariant',      this.selectedVariant);
        this.registry.set('selectedBackstory',    backstory?.id || 'orphan_of_the_grove');
        this.registry.set('appearance', {
            bodyType:       this.selectedBodyType,
            skinTone:       this.selectedSkinTone,
            hairStyle:      this.selectedHairStyle,
            sigilPlacement: this.selectedSigilPlacement
        });

        this.attributeSystem.setAttributes(this.attributes);
        if (ancestry) this.attributeSystem.applyAncestryBonuses(ancestry.id);
        this.classSystem.setVariant(this.selectedVariant);

        const { width, height } = this.scale;
        const overlay = this.add.graphics().setDepth(100);
        overlay.fillStyle(0x000000, 1);
        overlay.fillRect(0, 0, width, height);
        overlay.setAlpha(0);

        this.tweens.add({
            targets: overlay, alpha: 1, duration: 600,
            onComplete: () => {
                EventBus.emit('character:created', {
                    ancestry:            ancestry?.id,
                    attributes:          this.attributes,
                    classId:             this.classSystem.getCurrentClass()?.id,
                    variant:             this.selectedVariant,
                    appearance: {
                        bodyType:       this.selectedBodyType,
                        skinTone:       this.selectedSkinTone,
                        hairStyle:      this.selectedHairStyle,
                        sigilPlacement: this.selectedSigilPlacement
                    },
                    backstory:           backstory?.id,
                    backstoryBonusSkill: backstory?.bonusSkill,
                    backstoryBonusQuest: backstory?.bonusQuest
                });
                this.scene.start('GameScene');
            }
        });
    }
}
