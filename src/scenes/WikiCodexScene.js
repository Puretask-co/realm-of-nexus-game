/**
 * WikiCodexScene — Progressive unlock codex with all game knowledge.
 * Stub — full implementation provided by agent. Press W to open, ESC to close.
 */
export default class WikiCodexScene extends Phaser.Scene {
    constructor() { super({ key: 'WikiCodexScene' }); }
    create() {
        const { width, height } = this.scale;
        const bg = this.add.graphics().setScrollFactor(0);
        bg.fillStyle(0x05050f, 0.97); bg.fillRect(0, 0, width, height);
        this.add.text(width / 2, 40, 'CODEX', {
            fontFamily: 'monospace', fontSize: '22px', color: '#ccaaff',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);
        this.add.text(width / 2, height / 2, '[ Codex loading... ]\nPress ESC to close', {
            fontFamily: 'monospace', fontSize: '14px', color: '#666688', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
        this.input.keyboard.on('keydown-W', () => this.scene.stop());
    }
}
