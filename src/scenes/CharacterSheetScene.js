/**
 * CharacterSheetScene — Full character sheet with Stats, Abilities, Spells, Effects tabs.
 * Stub — full implementation provided by agent. Press C to open, ESC to close.
 */
export default class CharacterSheetScene extends Phaser.Scene {
    constructor() { super({ key: 'CharacterSheetScene' }); }
    create() {
        const { width, height } = this.scale;
        const bg = this.add.graphics().setScrollFactor(0);
        bg.fillStyle(0x05050f, 0.97); bg.fillRect(0, 0, width, height);
        this.add.text(width / 2, 40, 'CHARACTER SHEET', {
            fontFamily: 'monospace', fontSize: '22px', color: '#aaccff',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);
        this.add.text(width / 2, height / 2, '[ Full UI loading... ]\nPress ESC to close', {
            fontFamily: 'monospace', fontSize: '14px', color: '#666688', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);
        this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
        this.input.keyboard.on('keydown-C', () => this.scene.stop());
    }
}
