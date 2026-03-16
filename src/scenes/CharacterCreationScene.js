import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';
import { AttributeSystem } from '../systems/AttributeSystem.js';

/**
 * CharacterCreationScene — 5-step character creation.
 *
 * Flow: ClassSelectionScene → CharacterCreationScene → GameScene
 *
 * Steps:
 *   1. Ancestry selection (Human, Soulborn, Half-Abyss) — done here
 *   2. Class was already selected in ClassSelectionScene
 *   3. Attribute point allocation (8 points, max 4 each, cap 6)
 *   4. Pure/Blighted variant selection
 *   5. Appearance (body type, skin tone, 15 hair styles, Verdant Sigil placement)
 *   6. Backstory selection (8 backgrounds that affect dialogue/quests)
 */
export default class CharacterCreationScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterCreationScene' });
    }

    create() {
        this.classSystem = PlayerClassSystem.getInstance();
        this.attributeSystem = AttributeSystem.getInstance();

        const { width, height } = this.scale;

        // Load ancestry data
        this.ancestries = dataManager.getAllAncestries?.() || [];
        if (this.ancestries.length === 0) {
            // Fallback if DataManager doesn't have getAllAncestries
            const data = dataManager.getAncestryData?.();
            this.ancestries = data?.ancestries || [];
        }

        // Current state
        this.selectedAncestryIndex = 0;
        this.attributes = { Might: 0, Agility: 0, Resilience: 0, Insight: 0, Charisma: 0 };
        this.pointsRemaining = 8;
        this.maxPerAttr = 4;
        this.humanBonusAttr = null; // For Human's +1 choice
        this.selectedVariant = 'pure';
        this.selectedBackstoryIndex = 0;
        this.selectedBodyType = 0;
        this.selectedSkinTone = 0;
        this.selectedHairStyle = 0;
        this.selectedSigilPlacement = 0;

        // 8 backstory options
        this.backstories = [
            { id: 'orphan_of_the_grove', name: 'Orphan of the Grove', description: 'Raised by the trees themselves after your family vanished during a Crimson Sap surge.', bonusSkill: 'survival', bonusQuest: 'find_your_family' },
            { id: 'coven_apprentice', name: 'Coven Apprentice', description: 'Trained by an Emerald Coven mystic who disappeared, leaving only cryptic notes.', bonusSkill: 'arcana', bonusQuest: 'the_missing_mentor' },
            { id: 'bloomguard_recruit', name: 'Bloomguard Recruit', description: 'You served as a Bloomguard cadet before a scandal forced you out. Now you seek redemption.', bonusSkill: 'athletics', bonusQuest: 'clear_your_name' },
            { id: 'wandering_trader', name: 'Wandering Trader', description: 'A Sapling Consortium merchant who stumbled into something far larger than any trade deal.', bonusSkill: 'persuasion', bonusQuest: 'the_lost_caravan' },
            { id: 'corruption_survivor', name: 'Corruption Survivor', description: 'You survived Blight infection as a child, leaving you scarred but resistant.', bonusSkill: 'medicine', bonusQuest: 'the_cure' },
            { id: 'veil_touched', name: 'Veil-Touched', description: 'Born during a Silver Sap phase, you occasionally hear whispers from beyond the Veil.', bonusSkill: 'perception', bonusQuest: 'voices_in_the_veil' },
            { id: 'beast_raised', name: 'Beast-Raised', description: 'Abandoned as an infant and raised by Wildkin creatures in the deep forest.', bonusSkill: 'nature', bonusQuest: 'the_wild_calling' },
            { id: 'noble_exile', name: 'Noble Exile', description: 'Heir to a disgraced Thornbinder house, you walk the line between shadow and light.', bonusSkill: 'deception', bonusQuest: 'house_of_thorns' }
        ];

        // Apply class starting attributes as base
        const cls = this.classSystem.getCurrentClass();
        if (cls?.baseStats) {
            this.attributes.Might = cls.baseStats.might || 0;
            this.attributes.Agility = cls.baseStats.agility || 0;
            this.attributes.Resilience = cls.baseStats.resilience || 0;
            this.attributes.Insight = cls.baseStats.insight || 0;
            this.attributes.Charisma = cls.baseStats.charisma || 0;
        }

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a1a, 1);
        bg.fillRect(0, 0, width, height);
        bg.lineStyle(1, 0x222244, 0.15);
        for (let x = 0; x < width; x += 64) bg.lineBetween(x, 0, x, height);
        for (let y = 0; y < height; y += 64) bg.lineBetween(0, y, width, y);

        // Title
        const clsName = cls?.name || 'Adventurer';
        this.add.text(width / 2, 25, 'CHARACTER CREATION', {
            fontFamily: 'monospace', fontSize: '24px', color: '#88aaff',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, 50, `Class: ${clsName}`, {
            fontFamily: 'monospace', fontSize: '12px', color: '#66aa88'
        }).setOrigin(0.5);

        // ---- Left panel: Ancestry Selection ----
        this._buildAncestryPanel(30, 80, 500, 210);

        // ---- Right panel: Attribute Allocation ----
        this._buildAttributePanel(560, 80, 400, 280);

        // ---- Middle-left: Pure/Blighted Variant ----
        this._buildVariantPanel(30, 300, 240, 90);

        // ---- Middle: Appearance (design: body, skin, 15 hair, Verdant Sigil) ----
        this._buildAppearancePanel(280, 300, 260, 90);

        // ---- Middle-right: Backstory Selection ----
        this._buildBackstoryPanel(550, 300, 250, 90);

        // ---- Bottom: Summary + Confirm ----
        this._buildSummaryPanel(width / 2, 400, 600, 200);

        // Keyboard
        this.input.keyboard.on('keydown-ENTER', () => this._confirm());
        this.input.keyboard.on('keydown-SPACE', () => this._confirm());
    }

    _buildAncestryPanel(x, y, w, h) {
        this.add.text(x + w / 2, y, 'CHOOSE ANCESTRY', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ccaa88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        this._ancestryCards = [];
        const cardW = (w - 20) / Math.max(this.ancestries.length, 1);
        const cardH = h - 30;

        this.ancestries.forEach((ancestry, i) => {
            const cx = x + 5 + i * cardW;
            const cy = y + 25;
            const card = this._createAncestryCard(cx, cy, cardW - 5, cardH, ancestry, i);
            this._ancestryCards.push(card);
        });

        this._highlightAncestry(0);
    }

    _createAncestryCard(x, y, w, h, ancestry, index) {
        const container = this.add.container(x, y);

        const colors = { human: 0x88aa66, soulborn: 0x6688cc, 'half-abyss': 0xcc4488, half_abyss: 0xcc4488 };
        const color = colors[ancestry.id] || 0x888888;

        const bg = this.add.graphics();
        bg.fillStyle(0x111133, 0.8);
        bg.fillRoundedRect(0, 0, w, h, 6);
        bg.lineStyle(2, color, 0.5);
        bg.strokeRoundedRect(0, 0, w, h, 6);
        container.add(bg);

        const colorStr = `#${color.toString(16).padStart(6, '0')}`;

        container.add(this.add.text(w / 2, 15, ancestry.name, {
            fontFamily: 'monospace', fontSize: '13px', color: colorStr,
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5));

        // Description
        const desc = (ancestry.description || '').substring(0, 100) + '...';
        container.add(this.add.text(w / 2, 35, desc, {
            fontFamily: 'monospace', fontSize: '7px', color: '#8888aa',
            wordWrap: { width: w - 10 }, align: 'center', lineSpacing: 2
        }).setOrigin(0.5, 0));

        // Attribute modifiers
        const modY = 100;
        container.add(this.add.text(5, modY, 'Modifiers:', {
            fontFamily: 'monospace', fontSize: '9px', color: '#aaaa88'
        }));

        const mods = ancestry.attributeModifiers || [];
        mods.forEach((mod, mi) => {
            const label = mod.attribute === 'player_choice'
                ? `+${mod.value} to any attribute`
                : `+${mod.value} ${mod.attribute}`;
            container.add(this.add.text(10, modY + 14 + mi * 12, label, {
                fontFamily: 'monospace', fontSize: '9px', color: colorStr
            }));
        });

        // Special ability
        if (ancestry.specialAbility) {
            const abilY = modY + 14 + mods.length * 12 + 10;
            container.add(this.add.text(5, abilY, `Ability: ${ancestry.specialAbility.name}`, {
                fontFamily: 'monospace', fontSize: '9px', color: '#ffcc44'
            }));
            const abilDesc = (ancestry.specialAbility.description || '').substring(0, 80);
            container.add(this.add.text(5, abilY + 14, abilDesc, {
                fontFamily: 'monospace', fontSize: '7px', color: '#8888aa',
                wordWrap: { width: w - 10 }, lineSpacing: 1
            }));
        }

        // Click
        const hitZone = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.selectedAncestryIndex = index;
            this._highlightAncestry(index);
            this._updateSummary();
        });
        container.add(hitZone);

        return { container, bg, color, w, h, ancestry };
    }

    _highlightAncestry(index) {
        this._ancestryCards.forEach((card, i) => {
            const selected = (i === index);
            card.bg.clear();
            if (selected) {
                card.bg.fillStyle(0x1a1a55, 0.95);
                card.bg.fillRoundedRect(0, 0, card.w, card.h, 6);
                card.bg.lineStyle(3, card.color, 1.0);
                card.bg.strokeRoundedRect(0, 0, card.w, card.h, 6);
            } else {
                card.bg.fillStyle(0x111133, 0.6);
                card.bg.fillRoundedRect(0, 0, card.w, card.h, 6);
                card.bg.lineStyle(1, card.color, 0.3);
                card.bg.strokeRoundedRect(0, 0, card.w, card.h, 6);
            }
        });
    }

    _buildAttributePanel(x, y, w, h) {
        this.add.text(x + w / 2, y, 'ALLOCATE ATTRIBUTES', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ccaa88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        this._pointsText = this.add.text(x + w / 2, y + 22, `Points: ${this.pointsRemaining}`, {
            fontFamily: 'monospace', fontSize: '12px', color: '#88ff88'
        }).setOrigin(0.5);

        const attrNames = ['Might', 'Agility', 'Resilience', 'Insight', 'Charisma'];
        const attrColors = {
            Might: '#ff6666', Agility: '#66ffaa', Resilience: '#88aacc',
            Insight: '#cc66ff', Charisma: '#ffcc44'
        };
        const attrDescs = {
            Might: 'Physical power, melee damage, carry weight',
            Agility: 'Speed, evasion, initiative, ranged accuracy',
            Resilience: 'HP, damage resistance, stamina',
            Insight: 'Magic power, perception, lore knowledge',
            Charisma: 'Persuasion, prices, companion bonds'
        };

        this._attrTexts = {};
        this._attrBarGfx = {};

        attrNames.forEach((attr, i) => {
            const ay = y + 45 + i * 44;

            this.add.text(x + 10, ay, attr, {
                fontFamily: 'monospace', fontSize: '12px', color: attrColors[attr]
            });

            this.add.text(x + 10, ay + 14, attrDescs[attr], {
                fontFamily: 'monospace', fontSize: '7px', color: '#666688'
            });

            // Value text
            this._attrTexts[attr] = this.add.text(x + w / 2, ay + 2, `${this.attributes[attr]}`, {
                fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
            }).setOrigin(0.5);

            // Bar
            const barGfx = this.add.graphics();
            this._attrBarGfx[attr] = barGfx;
            this._drawAttrBar(barGfx, x + 10, ay + 26, w - 80, attr, attrColors[attr]);

            // - button
            const minusBtn = this.add.text(x + w - 60, ay + 2, '[-]', {
                fontFamily: 'monospace', fontSize: '14px', color: '#ff6666'
            }).setInteractive({ useHandCursor: true });
            minusBtn.on('pointerdown', () => this._adjustAttribute(attr, -1));

            // + button
            const plusBtn = this.add.text(x + w - 25, ay + 2, '[+]', {
                fontFamily: 'monospace', fontSize: '14px', color: '#66ff66'
            }).setInteractive({ useHandCursor: true });
            plusBtn.on('pointerdown', () => this._adjustAttribute(attr, 1));
        });
    }

    _drawAttrBar(gfx, x, y, w, attr, colorStr) {
        gfx.clear();
        gfx.fillStyle(0x222244, 0.6);
        gfx.fillRect(x, y, w, 6);
        const ratio = Math.min(1, this.attributes[attr] / 6);
        const barColor = parseInt(colorStr.replace('#', ''), 16);
        gfx.fillStyle(barColor, 0.7);
        gfx.fillRect(x, y, w * ratio, 6);
    }

    _adjustAttribute(attr, delta) {
        const cls = this.classSystem.getCurrentClass();
        const baseVal = cls?.baseStats?.[attr.toLowerCase()] || 0;
        const allocated = this.attributes[attr] - baseVal;

        if (delta > 0) {
            if (this.pointsRemaining <= 0) return;
            if (allocated >= this.maxPerAttr) return;
            if (this.attributes[attr] >= 6) return; // absolute cap
            this.attributes[attr]++;
            this.pointsRemaining--;
        } else {
            if (allocated <= 0) return; // Can't go below class base
            this.attributes[attr]--;
            this.pointsRemaining++;
        }

        this._refreshAttributeDisplay();
        this._updateSummary();
    }

    _refreshAttributeDisplay() {
        this._pointsText.setText(`Points: ${this.pointsRemaining}`);
        this._pointsText.setColor(this.pointsRemaining > 0 ? '#88ff88' : '#ffffff');

        const attrColors = {
            Might: '#ff6666', Agility: '#66ffaa', Resilience: '#88aacc',
            Insight: '#cc66ff', Charisma: '#ffcc44'
        };

        for (const [attr, text] of Object.entries(this._attrTexts)) {
            text.setText(`${this.attributes[attr]}`);
            const gfx = this._attrBarGfx[attr];
            if (gfx) {
                const bounds = gfx.getBounds();
                this._drawAttrBar(gfx, bounds.x, bounds.y, bounds.width || 300, attr, attrColors[attr]);
            }
        }
    }

    _buildVariantPanel(x, y, w, h) {
        this.add.text(x + w / 2, y, 'PATH', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ccaa88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        const variants = [
            { id: 'pure', name: 'Pure (Lumen)', color: 0x44cc88, desc: 'Healing, protection, growth' },
            { id: 'blighted', name: 'Blighted', color: 0xcc4488, desc: 'Decay, corruption, chaos' }
        ];

        this._variantBgs = [];
        variants.forEach((v, i) => {
            const vx = x + 5;
            const vy = y + 18 + i * 34;
            const vw = w - 10;

            const bg = this.add.graphics();
            bg.fillStyle(0x111133, 0.8);
            bg.fillRoundedRect(vx, vy, vw, 30, 4);
            bg.lineStyle(2, v.color, this.selectedVariant === v.id ? 1.0 : 0.3);
            bg.strokeRoundedRect(vx, vy, vw, 30, 4);
            this._variantBgs.push({ bg, vx, vy, vw, color: v.color, id: v.id });

            const colorStr = `#${v.color.toString(16).padStart(6, '0')}`;
            this.add.text(vx + 8, vy + 4, v.name, {
                fontFamily: 'monospace', fontSize: '10px', color: colorStr
            });
            this.add.text(vx + 8, vy + 17, v.desc, {
                fontFamily: 'monospace', fontSize: '7px', color: '#8888aa'
            });

            const hitZone = this.add.zone(vx + vw / 2, vy + 15, vw, 30).setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                this.selectedVariant = v.id;
                this._refreshVariantHighlight();
                this._updateSummary();
            });
        });
    }

    _refreshVariantHighlight() {
        for (const v of this._variantBgs) {
            v.bg.clear();
            const selected = this.selectedVariant === v.id;
            v.bg.fillStyle(selected ? 0x1a1a55 : 0x111133, 0.8);
            v.bg.fillRoundedRect(v.vx, v.vy, v.vw, 30, 4);
            v.bg.lineStyle(2, v.color, selected ? 1.0 : 0.3);
            v.bg.strokeRoundedRect(v.vx, v.vy, v.vw, 30, 4);
        }
    }

    _buildAppearancePanel(x, y, w, h) {
        this.add.text(x + w / 2, y, 'APPEARANCE', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ccaa88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        const optsY = y + 18;
        const rowH = 20;
        const bodyOpts = ['Slim', 'Heavy'];
        const skinOpts = ['Light', 'Tan', 'Brown', 'Dark'];
        this.hairStyles = Array.from({ length: 15 }, (_, i) => `Style ${i + 1}`);
        const sigilOpts = ['Forehead', 'Cheek', 'Chest', 'Hand'];

        this._appearanceOptionButtons = [];
        [['Body', bodyOpts, () => this.selectedBodyType, (v) => { this.selectedBodyType = v; }],
         ['Skin', skinOpts, () => this.selectedSkinTone, (v) => { this.selectedSkinTone = v; }],
         ['Sigil', sigilOpts, () => this.selectedSigilPlacement, (v) => { this.selectedSigilPlacement = v; }]].forEach(([label, opts, get, set], i) => {
            const ly = optsY + i * rowH;
            this.add.text(x + 4, ly, label + ':', { fontFamily: 'monospace', fontSize: '9px', color: '#aaaacc' });
            const rowBtns = [];
            opts.forEach((txt, j) => {
                const btn = this.add.text(x + 40 + j * 52, ly + 6, txt, {
                    fontFamily: 'monospace', fontSize: '8px',
                    color: get() === j ? '#88ff88' : '#666688'
                }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => { set(j); this._updateAppearanceButtons(); this._updateSummary(); });
                rowBtns.push({ btn, get });
            });
            this._appearanceOptionButtons.push(rowBtns);
        });

        const hairY = optsY + 3 * rowH;
        this.add.text(x + 4, hairY, 'Hair:', { fontFamily: 'monospace', fontSize: '9px', color: '#aaaacc' });
        this._hairLabel = this.add.text(x + 80, hairY + 6, this.hairStyles[0], {
            fontFamily: 'monospace', fontSize: '9px', color: '#88aaff'
        }).setOrigin(0, 0.5);
        const leftH = this.add.text(x + 42, hairY + 6, '<', {
            fontFamily: 'monospace', fontSize: '14px', color: '#4488ff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        leftH.on('pointerdown', () => {
            this.selectedHairStyle = (this.selectedHairStyle - 1 + 15) % 15;
            this._hairLabel.setText(this.hairStyles[this.selectedHairStyle]);
            this._updateSummary();
        });
        const rightH = this.add.text(x + w - 20, hairY + 6, '>', {
            fontFamily: 'monospace', fontSize: '14px', color: '#4488ff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        rightH.on('pointerdown', () => {
            this.selectedHairStyle = (this.selectedHairStyle + 1) % 15;
            this._hairLabel.setText(this.hairStyles[this.selectedHairStyle]);
            this._updateSummary();
        });
    }

    _updateAppearanceButtons() {
        if (!this._appearanceOptionButtons) return;
        this._appearanceOptionButtons.forEach((rowBtns) => {
            const selected = rowBtns[0]?.get?.() ?? 0;
            rowBtns.forEach(({ btn }, j) => {
                btn.setColor(selected === j ? '#88ff88' : '#666688');
            });
        });
    }

    _buildBackstoryPanel(x, y, w, h) {
        this.add.text(x + w / 2, y, 'BACKSTORY', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ccaa88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        // Compact list with left/right arrows
        const listY = y + 20;
        const listW = w - 40;

        this._backstoryNameText = this.add.text(x + w / 2, listY + 8, this.backstories[0].name, {
            fontFamily: 'monospace', fontSize: '10px', color: '#88aaff'
        }).setOrigin(0.5);

        this._backstoryDescText = this.add.text(x + w / 2, listY + 24, this.backstories[0].description, {
            fontFamily: 'monospace', fontSize: '7px', color: '#8888aa',
            wordWrap: { width: listW }, align: 'center', lineSpacing: 1
        }).setOrigin(0.5, 0);

        this._backstoryBonusText = this.add.text(x + w / 2, listY + 56, `Bonus: +1 ${this.backstories[0].bonusSkill}`, {
            fontFamily: 'monospace', fontSize: '8px', color: '#ffcc44'
        }).setOrigin(0.5);

        // Arrow buttons
        const leftBtn = this.add.text(x + 5, listY + 8, '<', {
            fontFamily: 'monospace', fontSize: '18px', color: '#4488ff'
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        leftBtn.on('pointerdown', () => this._navigateBackstory(-1));

        const rightBtn = this.add.text(x + w - 5, listY + 8, '>', {
            fontFamily: 'monospace', fontSize: '18px', color: '#4488ff'
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        rightBtn.on('pointerdown', () => this._navigateBackstory(1));
    }

    _navigateBackstory(dir) {
        this.selectedBackstoryIndex = (this.selectedBackstoryIndex + dir + this.backstories.length) % this.backstories.length;
        const bs = this.backstories[this.selectedBackstoryIndex];
        this._backstoryNameText.setText(bs.name);
        this._backstoryDescText.setText(bs.description);
        this._backstoryBonusText.setText(`Bonus: +1 ${bs.bonusSkill}`);
        this._updateSummary();
    }

    _buildSummaryPanel(cx, y, w, h) {
        const x = cx - w / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x111133, 0.6);
        bg.fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(1, 0x334466, 0.5);
        bg.strokeRoundedRect(x, y, w, h, 8);

        this.add.text(cx, y + 10, 'CHARACTER SUMMARY', {
            fontFamily: 'monospace', fontSize: '14px', color: '#88aaff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        this._summaryText = this.add.text(cx, y + 30, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaacc',
            wordWrap: { width: w - 30 }, align: 'center', lineSpacing: 3
        }).setOrigin(0.5, 0);

        this._updateSummary();

        // Confirm button
        const btnW = 220;
        const btnH = 36;
        const btnX = cx - btnW / 2;
        const btnY = y + h - 50;

        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x224488, 0.8);
        btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        btnBg.lineStyle(2, 0x4488ff, 0.7);
        btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

        this.add.text(cx, btnY + btnH / 2, 'BEGIN ADVENTURE', {
            fontFamily: 'monospace', fontSize: '14px', color: '#88bbff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        const hitZone = this.add.zone(cx, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this._confirm());
        hitZone.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x3366aa, 0.9);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
            btnBg.lineStyle(2, 0x66aaff, 0.9);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
        });
        hitZone.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x224488, 0.8);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
            btnBg.lineStyle(2, 0x4488ff, 0.7);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
        });
    }

    _updateSummary() {
        const cls = this.classSystem.getCurrentClass();
        const ancestry = this.ancestries[this.selectedAncestryIndex];
        const backstory = this.backstories[this.selectedBackstoryIndex];
        const clsName = cls?.name || 'Adventurer';
        const ancName = ancestry?.name || 'Unknown';
        const variantLabel = this.selectedVariant === 'pure' ? 'Pure (Lumen)' : 'Blighted';

        const hp = (cls?.startingHP || 30) + (this.attributes.Resilience * 5);
        const guard = cls?.startingGuard || 5;

        const bodyLabels = ['Slim', 'Heavy'];
        const skinLabels = ['Light', 'Tan', 'Brown', 'Dark'];
        const sigilLabels = ['Forehead', 'Cheek', 'Chest', 'Hand'];
        const appearanceLine = `Appearance: ${bodyLabels[this.selectedBodyType]}, ${skinLabels[this.selectedSkinTone]}, Hair ${this.selectedHairStyle + 1}, ${sigilLabels[this.selectedSigilPlacement]}`;
        const lines = [
            `${ancName} ${variantLabel} ${clsName}  —  ${backstory?.name || ''}`,
            `HP: ${hp}  |  Guard: ${guard}  |  AP: ${cls?.baseAP || 2}`,
            `MIG: ${this.attributes.Might}  AGI: ${this.attributes.Agility}  RES: ${this.attributes.Resilience}  INS: ${this.attributes.Insight}  CHA: ${this.attributes.Charisma}`,
            appearanceLine,
            this.pointsRemaining > 0 ? `(${this.pointsRemaining} attribute points remaining)` : ''
        ].filter(Boolean);

        if (this._summaryText) {
            this._summaryText.setText(lines.join('\n'));
        }
    }

    _confirm() {
        if (this.pointsRemaining > 0) {
            // Flash warning
            this._pointsText.setColor('#ff4444');
            this.tweens.add({
                targets: this._pointsText,
                alpha: { from: 0.3, to: 1 },
                duration: 200,
                repeat: 2,
                onComplete: () => this._pointsText.setAlpha(1)
            });
            return;
        }

        const ancestry = this.ancestries[this.selectedAncestryIndex];
        const backstory = this.backstories[this.selectedBackstoryIndex];

        // Store selections in registry for GameScene to pick up
        this.registry.set('selectedAncestry', ancestry?.id || 'human');
        this.registry.set('allocatedAttributes', { ...this.attributes });
        this.registry.set('selectedVariant', this.selectedVariant);
        this.registry.set('selectedBackstory', backstory?.id || 'orphan_of_the_grove');
        this.registry.set('appearance', {
            bodyType: this.selectedBodyType,
            skinTone: this.selectedSkinTone,
            hairStyle: this.selectedHairStyle,
            sigilPlacement: this.selectedSigilPlacement
        });

        // Apply to AttributeSystem
        this.attributeSystem.setAttributes(this.attributes);
        if (ancestry) {
            this.attributeSystem.applyAncestryBonuses(ancestry.id);
        }

        // Apply variant to PlayerClassSystem
        this.classSystem.setVariant(this.selectedVariant);

        // Transition
        const { width, height } = this.scale;
        const overlay = this.add.graphics().setDepth(100);
        overlay.fillStyle(0x88aaff, 0);
        overlay.fillRect(0, 0, width, height);

        this.tweens.add({
            targets: overlay,
            alpha: { from: 0, to: 1 },
            duration: 600,
            onComplete: () => {
                EventBus.emit('character:created', {
                    ancestry: ancestry?.id,
                    attributes: this.attributes,
                    classId: this.classSystem.getCurrentClass()?.id,
                    variant: this.selectedVariant,
                    appearance: {
                        bodyType: this.selectedBodyType,
                        skinTone: this.selectedSkinTone,
                        hairStyle: this.selectedHairStyle,
                        sigilPlacement: this.selectedSigilPlacement
                    },
                    backstory: backstory?.id,
                    backstoryBonusSkill: backstory?.bonusSkill,
                    backstoryBonusQuest: backstory?.bonusQuest
                });
                this.scene.start('GameScene');
            }
        });
    }
}
