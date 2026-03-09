import { EventBus } from '../core/EventBus.js';

/**
 * NPC component — non-player character with dialogue, quests, and shops.
 *
 * Wraps a Phaser game object with:
 *  - Interaction zone (player presses E to interact)
 *  - Dialogue triggers via EventBus
 *  - Visual indicators (name tag, interaction prompt)
 *  - Quest giver/turn-in support
 *  - Shop integration
 */
export class NPC {
  constructor(scene, x, y, definition) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.definition = definition;
    this.id = definition.id;
    this.name = definition.name || 'NPC';

    // Visual (placeholder if no texture)
    if (scene.textures.exists(definition.texture || 'npc')) {
      this.sprite = scene.physics.add.sprite(x, y, definition.texture || 'npc');
    } else {
      this.sprite = scene.add.rectangle(x, y, 24, 32, 0x44ff88);
      scene.physics.add.existing(this.sprite);
    }

    this.sprite.setDepth(4);
    this.sprite.body.setImmovable(true);
    this.sprite.owner = this;

    // Name tag
    const nameColor = definition.textColor || '#ffffff';
    this.nameTag = scene.add.text(x, y - 28, this.name, {
      fontSize: '10px',
      fill: nameColor,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);

    // Interaction prompt (hidden until player is near)
    this.promptText = scene.add.text(x, y - 40, '[E] Talk', {
      fontSize: '9px',
      fill: '#ffff88',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(10).setVisible(false);

    // Interaction range in pixels
    this.interactRange = definition.interactRange || 60;
    this.playerInRange = false;

    // Dialogue ID to start
    this.dialogueId = definition.dialogueId || null;

    // Quest info
    this.questIds = definition.questIds || [];
    this.isShopkeeper = definition.isShopkeeper || false;
    this.shopInventory = definition.shopInventory || [];

    // State
    this.hasInteracted = false;

    // Listen for player interaction
    this.interactUnsub = this.eventBus.on('player:interact', (data) => {
      this.onPlayerInteract(data);
    });
  }

  /**
   * Check if the player is interacting and in range.
   */
  onPlayerInteract(data) {
    if (!data) return;
    const dx = data.x - this.sprite.x;
    const dy = data.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.interactRange) {
      this.interact();
    }
  }

  /**
   * Trigger interaction.
   */
  interact() {
    this.hasInteracted = true;

    if (this.dialogueId) {
      this.eventBus.emit('dialogue:start', {
        dialogueId: this.dialogueId,
        npcId: this.id,
        npcName: this.name,
        definition: this.definition
      });
    }

    if (this.isShopkeeper) {
      this.eventBus.emit('shop:open', {
        npcId: this.id,
        npcName: this.name,
        inventory: this.shopInventory
      });
    }

    if (this.questIds.length > 0) {
      this.eventBus.emit('quest:npcInteract', {
        npcId: this.id,
        questIds: this.questIds
      });
    }

    this.eventBus.emit('npc:interact', {
      npcId: this.id,
      npcName: this.name,
      definition: this.definition
    });
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(delta, playerX, playerY) {
    if (!this.sprite.active) return;

    // Update name tag position
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 28);
    this.promptText.setPosition(this.sprite.x, this.sprite.y - 40);

    // Show/hide interaction prompt based on player distance
    if (playerX !== undefined && playerY !== undefined) {
      const dx = playerX - this.sprite.x;
      const dy = playerY - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inRange = dist <= this.interactRange;

      if (inRange !== this.playerInRange) {
        this.playerInRange = inRange;
        this.promptText.setVisible(inRange);
      }
    }
  }

  // ─── Position Helpers ────────────────────────────────────────────

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  destroy() {
    if (this.interactUnsub) this.interactUnsub();
    this.nameTag.destroy();
    this.promptText.destroy();
    this.sprite.destroy();
  }
}

export default NPC;
