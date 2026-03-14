import EventBus from '../core/EventBus.js';
import { PlayerClassSystem } from '../systems/PlayerClassSystem.js';

/**
 * ClassSelectionScene — Lets the player choose one of 4 classes before gameplay.
 *
 * Displays each class with name, description, stats radar, phase affinity,
 * starting spells, and passives. Selecting a class applies it via
 * PlayerClassSystem and transitions to GameScene.
 */
export default class ClassSelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClassSelectionScene' });
    }

    create() {
        this.classSystem = PlayerClassSystem.getInstance();
        this.classes = this.classSystem.getAllClasses();
        this.selectedIndex = 0;

        const { width, height } = this.scale;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a1a, 1);
        bg.fillRect(0, 0, width, height);

        // Subtle grid
        bg.lineStyle(1, 0x222244, 0.15);
        for (let x = 0; x < width; x += 64) bg.lineBetween(x, 0, x, height);
        for (let y = 0; y < height; y += 64) bg.lineBetween(0, y, width, y);

        // Title
        this.add.text(width / 2, 30, 'CHOOSE YOUR CLASS', {
            fontFamily: 'monospace', fontSize: '28px', color: '#88aaff',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, 62, 'Each class has a Sap Phase affinity that shapes your playstyle', {
            fontFamily: 'monospace', fontSize: '11px', color: '#666688'
        }).setOrigin(0.5);

        // Class cards
        this._cards = [];
        const cardW = 280;
        const cardH = 480;
        const gap = 20;
        const totalW = this.classes.length * cardW + (this.classes.length - 1) * gap;
        const startX = (width - totalW) / 2;

        this.classes.forEach((cls, i) => {
            const card = this._createClassCard(startX + i * (cardW + gap), 90, cardW, cardH, cls, i);
            this._cards.push(card);
        });

        // Controls hint
        this.add.text(width / 2, height - 50, 'Click a class to select  |  ENTER or SPACE to confirm', {
            fontFamily: 'monospace', fontSize: '11px', color: '#555577'
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 30, 'Arrow keys to browse', {
            fontFamily: 'monospace', fontSize: '10px', color: '#444466'
        }).setOrigin(0.5);

        // Confirm button
        this._confirmBtn = this._createConfirmButton(width / 2, height - 85);

        // Keyboard
        this.input.keyboard.on('keydown-LEFT', () => this._navigate(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this._navigate(1));
        this.input.keyboard.on('keydown-ENTER', () => this._confirm());
        this.input.keyboard.on('keydown-SPACE', () => this._confirm());

        // Initial highlight
        this._highlightCard(0);
    }

    _createClassCard(x, y, w, h, cls, index) {
        const container = this.add.container(x, y);

        // Card background
        const bg = this.add.graphics();
        bg.fillStyle(0x111133, 0.8);
        bg.fillRoundedRect(0, 0, w, h, 8);
        bg.lineStyle(2, cls.color, 0.5);
        bg.strokeRoundedRect(0, 0, w, h, 8);
        container.add(bg);

        // Class sprite preview
        const spriteKey = this.textures.exists(cls.sprite) ? cls.sprite : 'player';
        const sprite = this.add.image(w / 2, 50, spriteKey).setScale(2.5);
        sprite.setTint(cls.color);
        container.add(sprite);

        // Class name
        const colorStr = `#${cls.color.toString(16).padStart(6, '0')}`;
        const nameText = this.add.text(w / 2, 85, cls.name, {
            fontFamily: 'monospace', fontSize: '16px', color: colorStr,
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        container.add(nameText);

        // Phase affinity
        const affinityText = cls.phaseAffinity
            ? `${cls.phaseAffinity.toUpperCase()} Phase`
            : 'ALL Phases';
        const affinityColor = {
            blue: '#4488ff', crimson: '#ff4444', silver: '#ccccdd', null: '#44cc44'
        }[cls.phaseAffinity] || '#44cc44';

        container.add(this.add.text(w / 2, 105, affinityText, {
            fontFamily: 'monospace', fontSize: '10px', color: affinityColor
        }).setOrigin(0.5));

        // Description
        const desc = this.add.text(w / 2, 125, cls.description, {
            fontFamily: 'monospace', fontSize: '9px', color: '#8888aa',
            wordWrap: { width: w - 20 }, align: 'center', lineSpacing: 2
        }).setOrigin(0.5, 0);
        container.add(desc);

        // Stats
        const statsY = 195;
        const stats = cls.baseStats;
        const statEntries = [
            { label: 'HP', value: stats.hp, max: 150, color: '#ff6666' },
            { label: 'SAP', value: stats.sap, max: 150, color: '#6688ff' },
            { label: 'ATK', value: stats.atk, max: 20, color: '#ffaa44' },
            { label: 'DEF', value: stats.def, max: 15, color: '#88aacc' },
            { label: 'MAG', value: stats.mag, max: 15, color: '#cc66ff' },
            { label: 'SPD', value: stats.speed, max: 250, color: '#66ffaa' }
        ];

        statEntries.forEach((stat, si) => {
            const sy = statsY + si * 16;

            container.add(this.add.text(10, sy, stat.label, {
                fontFamily: 'monospace', fontSize: '9px', color: stat.color
            }));

            // Bar background
            const barGfx = this.add.graphics();
            barGfx.fillStyle(0x222244, 0.6);
            barGfx.fillRect(45, sy + 2, 160, 8);
            const ratio = Math.min(1, stat.value / stat.max);
            const barColor = parseInt(stat.color.replace('#', ''), 16);
            barGfx.fillStyle(barColor, 0.7);
            barGfx.fillRect(45, sy + 2, 160 * ratio, 8);
            container.add(barGfx);

            container.add(this.add.text(210, sy, `${stat.value}`, {
                fontFamily: 'monospace', fontSize: '9px', color: '#aaaacc'
            }));
        });

        // Starting spells
        const spellY = statsY + statEntries.length * 16 + 10;
        container.add(this.add.text(10, spellY, 'Starting Spells:', {
            fontFamily: 'monospace', fontSize: '9px', color: '#aaaa88'
        }));

        cls.startingSpells.forEach((spellId, si) => {
            const spellName = spellId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            container.add(this.add.text(15, spellY + 14 + si * 12, `- ${spellName}`, {
                fontFamily: 'monospace', fontSize: '9px', color: colorStr
            }));
        });

        // Passives
        const passiveY = spellY + 14 + cls.startingSpells.length * 12 + 8;
        container.add(this.add.text(10, passiveY, 'Passives:', {
            fontFamily: 'monospace', fontSize: '9px', color: '#aaaa88'
        }));

        cls.passives.forEach((passive, pi) => {
            const lvlTag = passive.unlockLevel ? ` (Lv.${passive.unlockLevel})` : '';
            container.add(this.add.text(15, passiveY + 14 + pi * 12, `- ${passive.name}${lvlTag}`, {
                fontFamily: 'monospace', fontSize: '9px', color: '#8888aa'
            }));
        });

        // Ultimate
        const ultY = passiveY + 14 + cls.passives.length * 12 + 8;
        const ultName = cls.ultimateSpell.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        container.add(this.add.text(10, ultY, `Ultimate: ${ultName}`, {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44',
            stroke: '#000', strokeThickness: 1
        }));

        // Click interaction
        const hitZone = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.selectedIndex = index;
            this._highlightCard(index);
        });
        hitZone.on('pointerover', () => {
            if (this.selectedIndex !== index) {
                bg.clear();
                bg.fillStyle(0x1a1a44, 0.9);
                bg.fillRoundedRect(0, 0, w, h, 8);
                bg.lineStyle(2, cls.color, 0.6);
                bg.strokeRoundedRect(0, 0, w, h, 8);
            }
        });
        hitZone.on('pointerout', () => {
            if (this.selectedIndex !== index) {
                bg.clear();
                bg.fillStyle(0x111133, 0.8);
                bg.fillRoundedRect(0, 0, w, h, 8);
                bg.lineStyle(2, cls.color, 0.5);
                bg.strokeRoundedRect(0, 0, w, h, 8);
            }
        });
        container.add(hitZone);

        return { container, bg, cls, w, h };
    }

    _createConfirmButton(cx, cy) {
        const w = 200;
        const h = 36;
        const container = this.add.container(cx - w / 2, cy - h / 2);

        const bg = this.add.graphics();
        bg.fillStyle(0x224488, 0.8);
        bg.fillRoundedRect(0, 0, w, h, 6);
        bg.lineStyle(2, 0x4488ff, 0.7);
        bg.strokeRoundedRect(0, 0, w, h, 6);
        container.add(bg);

        const text = this.add.text(w / 2, h / 2, 'CONFIRM', {
            fontFamily: 'monospace', fontSize: '14px', color: '#88bbff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        container.add(text);

        const hitZone = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this._confirm());
        hitZone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x3366aa, 0.9);
            bg.fillRoundedRect(0, 0, w, h, 6);
            bg.lineStyle(2, 0x66aaff, 0.9);
            bg.strokeRoundedRect(0, 0, w, h, 6);
        });
        hitZone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x224488, 0.8);
            bg.fillRoundedRect(0, 0, w, h, 6);
            bg.lineStyle(2, 0x4488ff, 0.7);
            bg.strokeRoundedRect(0, 0, w, h, 6);
        });
        container.add(hitZone);

        return { container, bg, text };
    }

    _navigate(dir) {
        const newIndex = Phaser.Math.Clamp(this.selectedIndex + dir, 0, this.classes.length - 1);
        if (newIndex !== this.selectedIndex) {
            this.selectedIndex = newIndex;
            this._highlightCard(newIndex);
        }
    }

    _highlightCard(index) {
        this._cards.forEach((card, i) => {
            const isSelected = (i === index);
            card.bg.clear();

            if (isSelected) {
                card.bg.fillStyle(0x1a1a55, 0.95);
                card.bg.fillRoundedRect(0, 0, card.w, card.h, 8);
                card.bg.lineStyle(3, card.cls.color, 1.0);
                card.bg.strokeRoundedRect(0, 0, card.w, card.h, 8);

                // Glow effect
                card.bg.lineStyle(6, card.cls.color, 0.15);
                card.bg.strokeRoundedRect(-3, -3, card.w + 6, card.h + 6, 10);
            } else {
                card.bg.fillStyle(0x111133, 0.6);
                card.bg.fillRoundedRect(0, 0, card.w, card.h, 8);
                card.bg.lineStyle(2, card.cls.color, 0.3);
                card.bg.strokeRoundedRect(0, 0, card.w, card.h, 8);
            }

            // Scale animation
            this.tweens.add({
                targets: card.container,
                scaleX: isSelected ? 1.02 : 1.0,
                scaleY: isSelected ? 1.02 : 1.0,
                duration: 200,
                ease: 'Back.easeOut'
            });
        });
    }

    _confirm() {
        const cls = this.classes[this.selectedIndex];
        if (!cls) return;

        this.classSystem.selectClass(cls.id);

        // Flash and transition
        this.cameras.main.flash(400, ...this._hexToRGB(cls.color));

        const { width, height } = this.scale;
        const overlay = this.add.graphics().setDepth(100);
        overlay.fillStyle(cls.color, 0);
        overlay.fillRect(0, 0, width, height);

        this.tweens.add({
            targets: overlay,
            alpha: { from: 0, to: 1 },
            duration: 600,
            onComplete: () => {
                EventBus.emit('class:confirmed', { classId: cls.id });
                this.scene.start('GameScene');
            }
        });

        // Confirm text
        this.add.text(width / 2, height / 2, cls.name.toUpperCase(), {
            fontFamily: 'monospace', fontSize: '36px',
            color: `#${cls.color.toString(16).padStart(6, '0')}`,
            stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(101).setAlpha(0).setScale(0.5);

        this.tweens.add({
            targets: this.children.list[this.children.list.length - 1],
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });
    }

    _hexToRGB(hex) {
        return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
    }
}
