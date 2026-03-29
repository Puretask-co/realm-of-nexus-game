import EventBus from '../core/EventBus.js';

/**
 * PauseMenuScene — Overlay scene launched on Escape from GameScene.
 * Pauses GameScene physics while active. Press Escape or R to resume.
 */
export default class PauseMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseMenuScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Dim overlay
        const overlay = this.add.graphics().setDepth(19000);
        overlay.fillStyle(0x000000, 0.65);
        overlay.fillRect(0, 0, width, height);

        // Panel
        const panelW = 300, panelH = 280;
        const panelX = width / 2 - panelW / 2;
        const panelY = height / 2 - panelH / 2;

        const panel = this.add.graphics().setDepth(19001);
        panel.fillStyle(0x0d0d22, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
        panel.lineStyle(2, 0x4466aa, 0.9);
        panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

        this.add.text(width / 2, panelY + 28, 'PAUSED', {
            fontFamily: 'monospace', fontSize: '22px', color: '#aaccff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(19002);

        const divGfx = this.add.graphics().setDepth(19002);
        divGfx.lineStyle(1, 0x334466, 0.6);
        divGfx.lineBetween(panelX + 20, panelY + 52, panelX + panelW - 20, panelY + 52);

        const btnDefs = [
            { label: 'Resume',       color: 0x226644, hover: 0x33aa66, action: () => this._resume() },
            { label: 'Save Game',    color: 0x224466, hover: 0x3366aa, action: () => this._saveGame() },
            { label: 'Settings',     color: 0x333344, hover: 0x555566, action: () => this._settings() },
            { label: 'Quit to Menu', color: 0x662222, hover: 0xaa3333, action: () => this._quit() }
        ];
        btnDefs.forEach((def, i) => this._createButton(width / 2, panelY + 76 + i * 52, 220, 38, def));

        this._feedbackText = this.add.text(width / 2, panelY + panelH - 18, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#66ffaa'
        }).setOrigin(0.5).setDepth(19003);

        // Escape or R to resume
        this.input.keyboard.on('keydown-ESC', () => this._resume());
        this.input.keyboard.on('keydown-R',   () => this._resume());

        // Pause world physics
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.pause();
    }

    _createButton(cx, cy, bw, bh, def) {
        const bx = cx - bw / 2;
        const by = cy - bh / 2;
        const bg = this.add.graphics().setDepth(19002);
        const draw = (color) => {
            bg.clear();
            bg.fillStyle(color, 0.85);
            bg.fillRoundedRect(bx, by, bw, bh, 6);
        };
        draw(def.color);
        this.add.text(cx, cy, def.label, {
            fontFamily: 'monospace', fontSize: '15px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(19003);
        const hit = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(19003);
        hit.on('pointerover', () => draw(def.hover));
        hit.on('pointerout',  () => draw(def.color));
        hit.on('pointerdown', () => def.action());
    }

    _resume() {
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.resume();
        this.scene.stop();
    }

    _saveGame() {
        EventBus.emit('request-save', 0);
        if (this._feedbackText) this._feedbackText.setText('Game saved!');
        this.time.delayedCall(1500, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    _settings() {
        if (this._feedbackText) this._feedbackText.setText('Settings coming soon...');
        this.time.delayedCall(1800, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    _quit() {
        const gs = this.scene.get('GameScene');
        if (gs?.physics) gs.physics.resume();
        this.scene.stop('UIScene');
        this.scene.stop('GameScene');
        this.scene.stop('PauseMenuScene');
        this.scene.start('BootScene');
    }
}
