import EventBus from '../core/EventBus.js';

/**
 * TutorialSystem — Step-by-step tutorial overlay for new players.
 * Activated via EventBus 'game:newGameStarted' event.
 * Full implementation written by agent; this is a safe stub.
 */
export class TutorialSystem {
    static instance = null;
    static getInstance() {
        if (!TutorialSystem.instance) new TutorialSystem();
        return TutorialSystem.instance;
    }

    constructor() {
        if (TutorialSystem.instance) return TutorialSystem.instance;
        this._active = false;
        this._scene = null;
        this._step = 0;
        this._overlay = null;

        // Listen for new game event
        EventBus.on('game:newGameStarted', (scene) => this.start(scene));

        TutorialSystem.instance = this;
    }

    start(scene) {
        if (localStorage.getItem('verdance_tutorial_done')) return;
        this._scene = scene;
        this._active = true;
        this._step = 0;
        this._createOverlay(scene);
        this._showStep(0);
    }

    isActive() { return this._active; }

    nextStep() {
        this._step++;
        if (this._step >= this._getSteps().length) {
            this.skipTutorial();
            return;
        }
        this._showStep(this._step);
    }

    skipTutorial() {
        localStorage.setItem('verdance_tutorial_done', '1');
        this._destroyOverlay();
        this._active = false;
    }

    _getSteps() {
        return [
            { title: 'Welcome to Verdance', text: 'Welcome, traveller! This world pulses with the living Sap.\nUse WASD/Arrow Keys to move. Press NEXT to continue.', key: '' },
            { title: 'The Sap Cycle', text: 'Watch the phase indicator — the Sap Cycle shifts between\nBlue, Crimson, and Silver phases. Each phase changes the world.', key: '' },
            { title: 'Your Health & Sap', text: 'Your HP and Sap bars are top-left.\nSap powers your spells — manage it carefully.', key: '' },
            { title: 'Cast Spells', text: 'Press 1–6 to cast your equipped spells.\nEach spell costs Sap and has a cooldown.', key: '1–6' },
            { title: 'Inventory', text: 'Press I to open your inventory.\nEquip weapons, armor, and accessories to boost stats.', key: 'I' },
            { title: 'Spellbook', text: 'Press K to open the Spellbook.\nBrowse all spells, check requirements, manage equipped spells.', key: 'K' },
            { title: 'Game Info', text: 'Press TAB for the Game Info panel.\nTrack quests, view the Sap Cycle, check DSP, and read AI narrations.', key: 'TAB' },
            { title: 'Character Sheet', text: 'Press C to open your Character Sheet.\nView all stats, abilities, and active effects.', key: 'C' },
            { title: 'DSP Pool', text: 'Your DSP Pool rises when you use powerful magic.\nIf it hits 100, reality fractures — manage it carefully!', key: '' },
            { title: 'Home Base', text: 'Press H to return to your Home Base.\nRest, craft, manage your stash, and consult companions.', key: 'H' },
            { title: 'Crafting', text: 'At the Forge in your Home Base, combine materials\ninto weapons, armor, and consumables using recipes.', key: '' },
            { title: 'The Codex', text: 'Press W to open the Codex — your in-game wiki.\nEntries unlock as you discover enemies, items, and locations.', key: 'W' },
        ];
    }

    _createOverlay(scene) {
        if (!scene?.add) return;
        const { width, height } = scene.scale;
        const depth = 30000;

        this._dimBg = scene.add.graphics().setDepth(depth).setScrollFactor(0);
        this._dimBg.fillStyle(0x000000, 0.45);
        this._dimBg.fillRect(0, 0, width, height);

        const cardW = 520, cardH = 160;
        const cardX = width / 2 - cardW / 2;
        const cardY = height - cardH - 20;

        this._card = scene.add.graphics().setDepth(depth + 1).setScrollFactor(0);
        this._card.fillStyle(0x0a0a1e, 0.97);
        this._card.fillRoundedRect(cardX, cardY, cardW, cardH, 10);
        this._card.lineStyle(2, 0x4466cc, 0.9);
        this._card.strokeRoundedRect(cardX, cardY, cardW, cardH, 10);

        this._stepText = scene.add.text(cardX + 18, cardY + 12, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#6699cc'
        }).setDepth(depth + 2).setScrollFactor(0);

        this._titleText = scene.add.text(cardX + 18, cardY + 28, '', {
            fontFamily: 'monospace', fontSize: '16px', color: '#aaccff',
            stroke: '#000', strokeThickness: 2
        }).setDepth(depth + 2).setScrollFactor(0);

        this._bodyText = scene.add.text(cardX + 18, cardY + 54, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#cccccc',
            lineSpacing: 4
        }).setDepth(depth + 2).setScrollFactor(0);

        // Key hint badge
        this._keyBadge = scene.add.text(cardX + cardW - 70, cardY + 54, '', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffcc44',
            backgroundColor: '#222244', padding: { x: 8, y: 4 }
        }).setDepth(depth + 2).setScrollFactor(0);

        // NEXT button
        const nextBg = scene.add.graphics().setDepth(depth + 2).setScrollFactor(0);
        const nextX = cardX + cardW - 110, nextY = cardY + cardH - 40;
        nextBg.fillStyle(0x224466, 0.95);
        nextBg.fillRoundedRect(nextX, nextY, 90, 28, 5);
        this._nextBtn = scene.add.text(nextX + 45, nextY + 14, 'NEXT →', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(depth + 3).setScrollFactor(0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.nextStep())
            .on('pointerover', () => { nextBg.clear(); nextBg.fillStyle(0x3366aa, 0.95); nextBg.fillRoundedRect(nextX, nextY, 90, 28, 5); })
            .on('pointerout',  () => { nextBg.clear(); nextBg.fillStyle(0x224466, 0.95); nextBg.fillRoundedRect(nextX, nextY, 90, 28, 5); });

        // SKIP button
        const skipX = cardX + 18, skipY = cardY + cardH - 40;
        const skipBg = scene.add.graphics().setDepth(depth + 2).setScrollFactor(0);
        skipBg.fillStyle(0x442222, 0.8);
        skipBg.fillRoundedRect(skipX, skipY, 110, 28, 5);
        this._skipBtn = scene.add.text(skipX + 55, skipY + 14, 'SKIP TUTORIAL', {
            fontFamily: 'monospace', fontSize: '10px', color: '#cc8888'
        }).setOrigin(0.5).setDepth(depth + 3).setScrollFactor(0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.skipTutorial());

        this._tutorialObjects = [
            this._dimBg, this._card, this._stepText, this._titleText,
            this._bodyText, this._keyBadge, nextBg, this._nextBtn, skipBg, this._skipBtn
        ];
    }

    _showStep(index) {
        const steps = this._getSteps();
        const step = steps[index];
        if (!step || !this._titleText) return;

        const isLast = index === steps.length - 1;
        this._stepText.setText(`Step ${index + 1} / ${steps.length}`);
        this._titleText.setText(step.title);
        this._bodyText.setText(step.text);
        this._keyBadge.setText(step.key ? `[${step.key}]` : '');
        if (this._nextBtn) {
            this._nextBtn.setText(isLast ? 'BEGIN →' : 'NEXT →');
        }
    }

    _destroyOverlay() {
        if (this._tutorialObjects) {
            this._tutorialObjects.forEach(obj => { try { obj.destroy(); } catch {} });
            this._tutorialObjects = null;
        }
        this._overlay = null;
        this._scene = null;
    }
}

export default TutorialSystem;
