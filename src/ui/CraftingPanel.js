import EventBus from '../core/EventBus.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';

/**
 * CraftingPanel — Crafting station UI.
 *
 * Triggered by `crafting-open` event with optional `{ stationId }`.
 * Reads recipes from CraftingSystem. Checks inventory via `crafting:checkInventory`
 * request/response pattern, then calls CraftingSystem.craft().
 *
 * Inventory adapter: emits `crafting:checkMaterial` and listens to response,
 * or uses a simple local inventory cache kept in sync via `inventory:addItem`.
 */
export class CraftingPanel {
    constructor(scene) {
        this.scene = scene;
        this.craftingSystem = CraftingSystem.getInstance();
        this.visible = false;
        this._stationId = 'sapling_workshop'; // default to unlocked station
        this._inventory = {}; // itemId -> quantity cache
        this._elements = [];
        this._recipeRows = [];
        this._build();
        this._setupEvents();
    }

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const pw = 440, ph = 500;
        const px = width / 2 - pw / 2 + 40;
        const py = height / 2 - ph / 2;
        this._px = px; this._py = py; this._pw = pw; this._ph = ph;

        this._bg = s.add.graphics().setDepth(16000);

        this._title = s.add.text(px + pw / 2, py + 22, 'CRAFTING', {
            fontFamily: 'monospace', fontSize: '18px', color: '#88ff88',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(16001);

        this._stationLabel = s.add.text(px + 16, py + 46, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#668866'
        }).setDepth(16001);

        this._closeBtn = this._makeButton(px + pw - 30, py + 14, 24, 22, 'X', 0x661111, 0xaa2222, () => this.hide());

        this._feedbackText = s.add.text(px + pw / 2, py + ph - 20, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#66ffaa'
        }).setOrigin(0.5).setDepth(16002);

        // Recipe rows (5 visible)
        for (let i = 0; i < 5; i++) {
            const ry = py + 68 + i * 82;
            // Recipe name
            const nameTxt = s.add.text(px + 16, ry + 4, '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#88ff88'
            }).setDepth(16001);
            // Materials line
            const matTxt = s.add.text(px + 16, ry + 24, '', {
                fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
                wordWrap: { width: pw - 100 }
            }).setDepth(16001);
            // Can-craft indicator
            const canTxt = s.add.text(px + 16, ry + 44, '', {
                fontFamily: 'monospace', fontSize: '10px', color: '#66ffaa'
            }).setDepth(16001);
            const craftBtn = this._makeButton(px + pw - 60, ry + 36, 60, 28, 'CRAFT', 0x224422, 0x336633, () => this._craft(i));
            this._recipeRows.push({ nameTxt, matTxt, canTxt, craftBtn });
        }

        this._elements = [this._bg, this._title, this._stationLabel, this._feedbackText,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit];
        for (const row of this._recipeRows) {
            this._elements.push(row.nameTxt, row.matTxt, row.canTxt,
                row.craftBtn.bg, row.craftBtn.txt, row.craftBtn.hit);
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
            fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(16002);
        const hit = s.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(16002);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }

    _setupEvents() {
        EventBus.on('crafting-open', (data) => this.open(data));

        // Receive full inventory snapshot from GameScene when crafting opens
        EventBus.on('crafting:inventorySnapshot', (data) => {
            if (data?.items) {
                // Merge snapshot — snapshot is the authoritative source for existing items
                for (const [id, qty] of Object.entries(data.items)) {
                    this._inventory[id] = qty;
                }
                this._refreshRows();
            }
        });

        // Track live changes
        EventBus.on('inventory:addItem', (data) => {
            const id = data.itemId;
            if (id) this._inventory[id] = (this._inventory[id] || 0) + (data.quantity || 1);
            if (this.visible) this._refreshRows();
        });
        EventBus.on('inventory:removeItem', (data) => {
            const id = data.itemId;
            if (id) this._inventory[id] = Math.max(0, (this._inventory[id] || 0) - (data.quantity || 1));
            if (this.visible) this._refreshRows();
        });
    }

    open(data = {}) {
        if (data.stationId) this._stationId = data.stationId;

        const station = this.craftingSystem.stations.get(this._stationId);
        this._stationLabel.setText(station ? station.name : this._stationId);

        // Get known recipes for this station
        this._visibleRecipes = [];
        for (const [id, recipe] of this.craftingSystem.recipes) {
            if (!this.craftingSystem.knownRecipes.has(id)) continue;
            if (recipe.station !== this._stationId) continue;
            this._visibleRecipes.push(recipe);
        }

        this._refreshRows();
        this._redrawBg();
        this._setVisible(true);
        this.visible = true;
    }

    _refreshRows() {
        for (let i = 0; i < 5; i++) {
            const row = this._recipeRows[i];
            const recipe = this._visibleRecipes?.[i];
            if (recipe) {
                row.nameTxt.setText(`${recipe.name} →  ${recipe.result.quantity}x ${recipe.result.itemId}`);
                const matParts = recipe.materials.map(m => {
                    const have = this._inventory[m.itemId] || 0;
                    const ok = have >= m.quantity;
                    return `${ok ? '✓' : '✗'}${m.quantity}x ${m.itemId}(${have})`;
                });
                row.matTxt.setText(matParts.join('  '));
                const canCraft = recipe.materials.every(m => (this._inventory[m.itemId] || 0) >= m.quantity);
                row.canTxt.setText(canCraft ? 'Ready to craft' : 'Missing materials').setColor(canCraft ? '#66ffaa' : '#ff6644');
                [row.craftBtn.bg, row.craftBtn.txt, row.craftBtn.hit].forEach(e => e.setVisible(true));
            } else {
                row.nameTxt.setText('');
                row.matTxt.setText('');
                row.canTxt.setText('');
                [row.craftBtn.bg, row.craftBtn.txt, row.craftBtn.hit].forEach(e => e.setVisible(false));
            }
        }
    }

    _craft(index) {
        const recipe = this._visibleRecipes?.[index];
        if (!recipe) return;

        // Build inventory adapter from local cache
        const invCache = this._inventory;
        const inventoryAdapter = {
            hasItem: (id, qty) => (invCache[id] || 0) >= qty,
            removeItem: (id, qty) => {
                invCache[id] = Math.max(0, (invCache[id] || 0) - qty);
                EventBus.emit('inventory:removeItem', { itemId: id, quantity: qty });
            },
            addItem: (id, qty) => {
                invCache[id] = (invCache[id] || 0) + qty;
                EventBus.emit('inventory:addItem', { itemId: id, quantity: qty, itemData: { id, name: id, stackable: true } });
            }
        };

        const craftingRank = 0; // TODO: read from player stats
        const sapPhase = 'blue'; // TODO: read from SapCycle
        const result = this.craftingSystem.craft(recipe.id, inventoryAdapter, craftingRank, sapPhase);

        if (result.success) {
            EventBus.emit('item-crafted', { recipeId: recipe.id, item: result.item, quality: result.quality });
            this._feedback(`Crafted ${recipe.name}! (${result.quality})`, '#66ffaa');
            this._refreshRows();
        } else {
            this._feedback(result.reason || 'Craft failed', '#ff6644');
        }
    }

    _feedback(msg, color = '#66ffaa') {
        if (!this._feedbackText?.active) return;
        this._feedbackText.setText(msg).setColor(color);
        this.scene.time.delayedCall(2500, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    _redrawBg() {
        this._bg.clear();
        this._bg.fillStyle(0x0a1a0a, 0.93);
        this._bg.fillRoundedRect(this._px, this._py, this._pw, this._ph, 10);
        this._bg.lineStyle(2, 0x336633, 0.8);
        this._bg.strokeRoundedRect(this._px, this._py, this._pw, this._ph, 10);
        this._bg.lineStyle(1, 0x224422, 0.5);
        this._bg.lineBetween(this._px + 16, this._py + 62, this._px + this._pw - 16, this._py + 62);
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
    }

    hide() {
        this._setVisible(false);
        this.visible = false;
    }
}
