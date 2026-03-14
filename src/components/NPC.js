import EventBus from '../core/EventBus.js';

/**
 * NPC component — non-player character with dialogue and interaction.
 *
 * Features:
 *  - Proximity detection: shows interaction prompt when player is near
 *  - Dialogue system: sequential text lines with typewriter effect
 *  - Quest giver / shop keeper / lore NPC roles
 *  - Idle animation: gentle bob or facing toward player
 *  - Interact key: E to talk
 *
 * NPCs are placed by the level editor or spawned from location data.
 */
export default class NPC {
    constructor(scene, x, y, config) {
        this.scene = scene;
        this.config = config || {};

        // Sprite
        this.sprite = scene.physics.add.sprite(x, y, 'npc');
        this.sprite.setDepth(4);
        this.sprite.setImmovable(true);
        this.sprite.owner = this;

        // NPC data
        this.name = config.name || 'Stranger';
        this.role = config.role || 'lore'; // lore | quest | shop
        this.dialogueLines = config.dialogue || ['...'];
        this.dialogueIndex = 0;
        this.isInteracting = false;

        // Interaction radius
        this.interactRadius = config.interactRadius || 60;

        // Name label
        this._nameTag = scene.add.text(x, y - 28, this.name, {
            fontFamily: 'monospace', fontSize: '9px', color: '#44ff44',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10);

        // Prompt (hidden by default)
        this._prompt = scene.add.text(x, y - 40, '[E] Talk', {
            fontFamily: 'monospace', fontSize: '8px', color: '#aaddaa',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10).setVisible(false);

        // Dialogue box (created on interaction)
        this._dialogueBox = null;
        this._dialogueText = null;

        // Idle bobbing
        this._bobTimer = Math.random() * Math.PI * 2;

        // Input
        scene.input.keyboard.on('keydown-E', () => {
            if (this._playerInRange && !this.isInteracting) {
                this._startDialogue();
            } else if (this.isInteracting) {
                this._advanceDialogue();
            }
        });

        this._playerInRange = false;
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(delta, player) {
        if (!player) return;
        const dt = delta / 1000;

        // Idle bob
        this._bobTimer += dt * 1.5;
        this.sprite.y = this.sprite.body.y + Math.sin(this._bobTimer) * 2;

        // Update label position
        this._nameTag.setPosition(this.sprite.x, this.sprite.y - 28);
        this._prompt.setPosition(this.sprite.x, this.sprite.y - 40);

        // Proximity check
        const playerSprite = player.sprite || player;
        const dist = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            playerSprite.x, playerSprite.y
        );

        this._playerInRange = dist < this.interactRadius;
        this._prompt.setVisible(this._playerInRange && !this.isInteracting);

        // Face toward player when close
        if (this._playerInRange) {
            const dx = playerSprite.x - this.sprite.x;
            this.sprite.setFlipX(dx < 0);
        }
    }

    // ----------------------------------------------------------------
    // Dialogue
    // ----------------------------------------------------------------

    _startDialogue() {
        this.isInteracting = true;
        this.dialogueIndex = 0;
        this._prompt.setVisible(false);

        // Create dialogue box
        const cam = this.scene.cameras.main;
        const boxW = 500;
        const boxH = 80;
        const boxX = (cam.width - boxW) / 2;
        const boxY = cam.height - boxH - 20;

        this._dialogueBox = this.scene.add.graphics().setDepth(20000).setScrollFactor(0);
        this._dialogueBox.fillStyle(0x111122, 0.9);
        this._dialogueBox.fillRect(boxX, boxY, boxW, boxH);
        this._dialogueBox.lineStyle(2, 0x44ff44, 0.5);
        this._dialogueBox.strokeRect(boxX, boxY, boxW, boxH);

        // Speaker name
        this._dialogueName = this.scene.add.text(boxX + 12, boxY + 8, this.name, {
            fontFamily: 'monospace', fontSize: '12px', color: '#44ff44',
            fontStyle: 'bold'
        }).setDepth(20001).setScrollFactor(0);

        // Text content
        this._dialogueText = this.scene.add.text(boxX + 12, boxY + 26, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ccddcc',
            wordWrap: { width: boxW - 24 }
        }).setDepth(20001).setScrollFactor(0);

        // Advance hint
        this._dialogueHint = this.scene.add.text(boxX + boxW - 12, boxY + boxH - 14, '[E] Continue', {
            fontFamily: 'monospace', fontSize: '8px', color: '#667766'
        }).setOrigin(1, 0.5).setDepth(20001).setScrollFactor(0);

        this._showLine();
    }

    _showLine() {
        if (!this._dialogueText) return;
        const line = this.dialogueLines[this.dialogueIndex] || '';
        this._typewriterEffect(line);
    }

    _typewriterEffect(text) {
        this._dialogueText.setText('');
        let i = 0;
        const timer = this.scene.time.addEvent({
            delay: 25,
            callback: () => {
                i++;
                this._dialogueText.setText(text.substring(0, i));
                if (i >= text.length) timer.remove();
            },
            loop: true
        });
    }

    _advanceDialogue() {
        this.dialogueIndex++;
        if (this.dialogueIndex >= this.dialogueLines.length) {
            this._endDialogue();
            return;
        }
        this._showLine();
    }

    _endDialogue() {
        this.isInteracting = false;

        if (this._dialogueBox) { this._dialogueBox.destroy(); this._dialogueBox = null; }
        if (this._dialogueName) { this._dialogueName.destroy(); this._dialogueName = null; }
        if (this._dialogueText) { this._dialogueText.destroy(); this._dialogueText = null; }
        if (this._dialogueHint) { this._dialogueHint.destroy(); this._dialogueHint = null; }

        EventBus.emit('npc-dialogue-complete', { npc: this.name, role: this.role });

        // Role-specific follow-up
        if (this.role === 'quest') {
            EventBus.emit('quest-offer', { npc: this.name, questData: this.config.quest });
        } else if (this.role === 'shop') {
            EventBus.emit('shop-open', { npc: this.name, inventory: this.config.shopInventory });
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    destroy() {
        this._endDialogue();
        this._nameTag.destroy();
        this._prompt.destroy();
        this.sprite.destroy();
    }
}
