import { EventBus } from '../core/EventBus.js';
import { AttributeSystem } from '../systems/AttributeSystem.js';

/**
 * AttributeAllocationPanel — shown when the player has unspent attribute points
 * after leveling up. Listens to `attributes:pointsAvailable` and lets the player
 * click + buttons to invest each point.
 *
 * Anchored top-right in UIScene. Hides itself when unallocatedPoints reaches 0.
 */
export class AttributeAllocationPanel {
    constructor(scene) {
        this.scene = scene;
        this.eb = EventBus.getInstance();
        this._container = null;
        this._pointsLabel = null;
        this._attrRows = {};
        this._pendingPoints = 0;

        this._build();
        this._hide();

        this.eb.on('attributes:pointsAvailable', (data) => {
            this._pendingPoints = data.points || 0;
            if (this._pendingPoints > 0) this._show();
            else this._hide();
            this._refresh();
        });

        // Sync on attribute changes (another system may also modify them)
        this.eb.on('attributes:changed', () => this._refresh());
    }

    _build() {
        const { width } = this.scene.scale;
        const panelW = 200;
        const panelX = width - panelW - 12;
        const panelY = 100;

        const container = this.scene.add.container(panelX, panelY);
        container.setDepth(180).setScrollFactor(0);

        // Background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0d1a2e, 0.92);
        bg.fillRoundedRect(0, 0, panelW, 240, 8);
        bg.lineStyle(2, 0x44aaff, 0.7);
        bg.strokeRoundedRect(0, 0, panelW, 240, 8);
        container.add(bg);

        // Title
        const title = this.scene.add.text(panelW / 2, 14, 'LEVEL UP!', {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#ffd700',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        container.add(title);

        // Points remaining label
        this._pointsLabel = this.scene.add.text(panelW / 2, 32, '', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#88ddff'
        }).setOrigin(0.5);
        container.add(this._pointsLabel);

        // Attribute rows
        const attrs = ['might', 'agility', 'resilience', 'insight', 'charisma'];
        const icons = { might: 'STR', agility: 'AGI', resilience: 'RES', insight: 'INT', charisma: 'CHA' };
        attrs.forEach((attr, i) => {
            const rowY = 56 + i * 34;

            const label = this.scene.add.text(8, rowY, icons[attr], {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#aaaacc'
            });
            const val = this.scene.add.text(50, rowY, '0', {
                fontFamily: 'Open Sans', fontSize: '18px', color: '#ffffff'
            });

            // + button
            const btnBg = this.scene.add.graphics();
            btnBg.fillStyle(0x1a4422, 0.9);
            btnBg.fillRoundedRect(panelW - 36, rowY - 2, 28, 22, 4);

            const btnLabel = this.scene.add.text(panelW - 22, rowY + 9, '+', {
                fontFamily: 'Open Sans', fontSize: '20px', color: '#44ff88'
            }).setOrigin(0.5);

            const hitZone = this.scene.add.zone(panelW - 22, rowY + 9, 28, 22)
                .setInteractive({ useHandCursor: true });

            hitZone.on('pointerover', () => {
                btnBg.clear();
                btnBg.fillStyle(0x2d7744, 0.95);
                btnBg.fillRoundedRect(panelW - 36, rowY - 2, 28, 22, 4);
            });
            hitZone.on('pointerout', () => {
                btnBg.clear();
                btnBg.fillStyle(0x1a4422, 0.9);
                btnBg.fillRoundedRect(panelW - 36, rowY - 2, 28, 22, 4);
            });
            hitZone.on('pointerdown', () => this._invest(attr));

            container.add([label, val, btnBg, btnLabel, hitZone]);
            this._attrRows[attr] = { val, hitZone, btnBg, btnLabel, rowY };
        });

        // Dismiss / skip button
        const skipBg = this.scene.add.graphics();
        skipBg.fillStyle(0x332211, 0.8);
        skipBg.fillRoundedRect(4, 224, panelW - 8, 12, 3);
        const skipText = this.scene.add.text(panelW / 2, 230, 'Save for later', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#888877'
        }).setOrigin(0.5);
        const skipZone = this.scene.add.zone(panelW / 2, 230, panelW - 8, 12)
            .setInteractive({ useHandCursor: true });
        skipZone.on('pointerdown', () => this._hide());
        container.add([skipBg, skipText, skipZone]);

        this._container = container;
    }

    _invest(attr) {
        if (this._pendingPoints <= 0) return;
        const attrSystem = AttributeSystem.getInstance();
        if (!attrSystem.investPoint) return;

        const ok = attrSystem.investPoint(attr);
        if (!ok) return;

        this._pendingPoints--;
        attrSystem.unallocatedPoints = this._pendingPoints;

        this.eb.emit('attributes:pointsAvailable', { points: this._pendingPoints });
        this._refresh();
    }

    _refresh() {
        const attrSystem = AttributeSystem.getInstance();
        const attrs = attrSystem.getAll?.() || {};

        this._pointsLabel?.setText(`${this._pendingPoints} point${this._pendingPoints !== 1 ? 's' : ''} to spend`);

        for (const [attr, row] of Object.entries(this._attrRows)) {
            const current = attrs[attr] ?? 0;
            row.val.setText(String(current));

            const canInvest = this._pendingPoints > 0;
            row.hitZone.setInteractive(canInvest ? { useHandCursor: true } : {});
            row.btnLabel.setColor(canInvest ? '#44ff88' : '#336644');
        }
    }

    _show() {
        this._container?.setVisible(true);
        this._refresh();
    }

    _hide() {
        this._container?.setVisible(false);
    }
}
