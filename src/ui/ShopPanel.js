import EventBus from '../core/EventBus.js';

/**
 * ShopPanel — Buy/sell UI for merchant NPCs.
 *
 * Triggered by `shop-open` event (emitted by NPC when role === 'shop').
 * Deducts gold via `shop:deductGold` event caught by GameScene.
 * Items added to player inventory via `inventory:addItem`.
 */
export class ShopPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._currentShop = null;
        this._playerGold = 0;
        this._elements = [];
        this._build();
        this._setupEvents();
    }

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const pw = 400, ph = 480;
        const px = width / 2 - pw / 2;
        const py = height / 2 - ph / 2;
        this._px = px; this._py = py; this._pw = pw; this._ph = ph;

        this._bg = s.add.graphics().setDepth(16000);
        this._title = s.add.text(width / 2, py + 22, 'SHOP', {
            fontFamily: 'Open Sans', fontSize: '25px', color: '#ffcc44',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(16001);

        this._goldText = s.add.text(px + 16, py + 46, 'Gold: 0', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#ffcc44'
        }).setDepth(16001);

        this._closeBtn = this._makeButton(px + pw - 30, py + 14, 24, 22, 'X', 0x661111, 0xaa2222, () => this.hide());

        this._feedbackText = s.add.text(width / 2, py + ph - 20, '', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#66ffaa'
        }).setOrigin(0.5).setDepth(16002);

        this._itemRows = [];
        for (let i = 0; i < 8; i++) {
            const ry = py + 72 + i * 48;
            const nameTxt = s.add.text(px + 16, ry + 4, '', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#dddddd'
            }).setDepth(16001);
            const priceTxt = s.add.text(px + pw - 110, ry + 4, '', {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#ffcc44'
            }).setDepth(16001);
            const buyBtn = this._makeButton(px + pw - 60, ry + 12, 50, 26, 'BUY', 0x224466, 0x3366aa, () => this._buyItem(i));
            this._itemRows.push({ nameTxt, priceTxt, buyBtn });
        }

        this._elements = [this._bg, this._title, this._goldText, this._feedbackText,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit];
        for (const row of this._itemRows) {
            this._elements.push(row.nameTxt, row.priceTxt, row.buyBtn.bg, row.buyBtn.txt, row.buyBtn.hit);
        }
        this._setVisible(false);
    }

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick) {
        const s = this.scene;
        const bx = cx - bw / 2, by = cy - bh / 2;
        const bg = s.add.graphics().setDepth(16001);
        const draw = (c) => { bg.clear(); bg.fillStyle(c, 0.9); bg.fillRoundedRect(bx, by, bw, bh, 4); };
        draw(color);
        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#ffffff',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(16002);
        const hit = s.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(16002);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }

    _setupEvents() {
        EventBus.on('shop-open', (data) => this.open(data));
        EventBus.on('player-stats-updated', (stats) => {
            if (stats?.gold !== undefined) {
                this._playerGold = stats.gold;
                if (this._goldText?.active) this._goldText.setText(`Gold: ${this._playerGold}`);
            }
        });
    }

    open(data) {
        this._currentShop = data;
        const shopName = data.npc?.name || 'Merchant';
        this._title.setText(`${shopName}'s Shop`);
        const inventory = data.inventory || data.shopInventory || [];

        for (let i = 0; i < 8; i++) {
            const row = this._itemRows[i];
            if (i < inventory.length) {
                const item = inventory[i];
                const itemName = item.itemData?.name || item.itemId || '?';
                row.nameTxt.setText(itemName);
                row.priceTxt.setText(`${item.price}g`);
                row.buyBtn.bg.setVisible(true); row.buyBtn.txt.setVisible(true); row.buyBtn.hit.setVisible(true);
            } else {
                row.nameTxt.setText('');
                row.priceTxt.setText('');
                row.buyBtn.bg.setVisible(false); row.buyBtn.txt.setVisible(false); row.buyBtn.hit.setVisible(false);
            }
        }

        this._redrawBg();
        this._setVisible(true);
        this.visible = true;
    }

    _buyItem(index) {
        if (!this._currentShop) return;
        const inventory = this._currentShop.inventory || this._currentShop.shopInventory || [];
        const item = inventory[index];
        if (!item) return;

        if (this._playerGold < item.price) {
            this._feedback('Not enough gold!', '#ff6644');
            return;
        }

        EventBus.emit('shop:deductGold', { amount: item.price });
        EventBus.emit('inventory:addItem', {
            itemId: item.itemId,
            quantity: 1,
            itemData: item.itemData || { id: item.itemId, name: item.itemId, stackable: true }
        });
        EventBus.emit('item-purchased', { itemId: item.itemId, price: item.price });
        this._feedback(`Bought ${item.itemData?.name || item.itemId}!`, '#66ffaa');
    }

    _feedback(msg, color = '#66ffaa') {
        if (!this._feedbackText?.active) return;
        this._feedbackText.setText(msg).setColor(color);
        this.scene.time.delayedCall(2000, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    _redrawBg() {
        this._bg.clear();
        this._bg.fillStyle(0x0a0a1a, 0.93);
        this._bg.fillRoundedRect(this._px, this._py, this._pw, this._ph, 10);
        this._bg.lineStyle(2, 0x664400, 0.8);
        this._bg.strokeRoundedRect(this._px, this._py, this._pw, this._ph, 10);
        // Divider
        this._bg.lineStyle(1, 0x334466, 0.5);
        this._bg.lineBetween(this._px + 16, this._py + 64, this._px + this._pw - 16, this._py + 64);
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
    }

    hide() {
        this._setVisible(false);
        this.visible = false;
        this._currentShop = null;
    }
}
