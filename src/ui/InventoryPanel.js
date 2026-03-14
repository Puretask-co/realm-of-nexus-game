import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * InventoryPanel - Player inventory UI with grid layout, equipment slots,
 * item tooltips, drag-and-drop, sorting, and filtering.
 */
export class InventoryPanel {
  constructor(scene, uiFramework) {
    this.scene = scene;
    this.ui = uiFramework;
    this.eventBus = EventBus.getInstance();

    // Inventory state
    this.items = new Array(40).fill(null);
    this.equipment = {
      weapon: null,
      armor: null,
      helmet: null,
      boots: null,
      accessory1: null,
      accessory2: null,
      amulet: null,
      ring: null
    };
    this.selectedSlot = null;
    this.sortMode = 'type'; // type, rarity, name, value
    this.filterType = 'all';

    // UI
    this.panel = null;
    this.slotContainers = [];
    this.equipmentSlots = {};
    this.visible = false;

    this.build();
    this.setupEventListeners();
  }

  build() {
    const panelWidth = 520;
    const panelHeight = 440;
    const panelX = GameConfig.WIDTH / 2 - panelWidth / 2;
    const panelY = GameConfig.HEIGHT / 2 - panelHeight / 2;

    this.panel = this.ui.createPanel(panelX, panelY, panelWidth, panelHeight, {
      title: 'Inventory',
      closable: true,
      depth: 7000
    });
    this.panel.setVisible(false);

    // ─── Equipment Section (left side) ────────────────────────────
    const equipLabel = this.scene.add.text(15, 45, 'Equipment', {
      fontSize: '12px', fill: '#4a9eff', fontFamily: 'monospace'
    });
    this.panel.add(equipLabel);

    const equipSlotPositions = {
      weapon: { x: 30, y: 70, label: 'WPN' },
      armor: { x: 80, y: 70, label: 'ARM' },
      helmet: { x: 30, y: 124, label: 'HLM' },
      boots: { x: 80, y: 124, label: 'BTS' },
      accessory1: { x: 30, y: 178, label: 'ACC' },
      accessory2: { x: 80, y: 178, label: 'ACC' },
      amulet: { x: 30, y: 232, label: 'AMU' },
      ring: { x: 80, y: 232, label: 'RNG' }
    };

    for (const [slotKey, pos] of Object.entries(equipSlotPositions)) {
      const slot = this.ui.createSlot(pos.x, pos.y, {
        size: 44,
        onClick: (_, item) => this.onEquipmentSlotClick(slotKey, item)
      });
      this.panel.add(slot);
      this.equipmentSlots[slotKey] = slot;

      const label = this.scene.add.text(pos.x + 22, pos.y + 48, pos.label, {
        fontSize: '8px', fill: '#666666', fontFamily: 'monospace'
      }).setOrigin(0.5);
      this.panel.add(label);
    }

    // ─── Stats Display ────────────────────────────────────────────
    this.statsText = this.scene.add.text(15, 290, 'ATK: 0\nDEF: 0\nSPD: 0', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace', lineSpacing: 4
    });
    this.panel.add(this.statsText);

    // ─── Inventory Grid (right side) ──────────────────────────────
    const gridLabel = this.scene.add.text(150, 45, 'Items', {
      fontSize: '12px', fill: '#4a9eff', fontFamily: 'monospace'
    });
    this.panel.add(gridLabel);

    // Sort/Filter buttons
    const sortBtn = this.ui.createButton(350, 50, 'Sort', {
      width: 50, height: 22, fontSize: '10px',
      onClick: () => this.cycleSortMode()
    });
    this.panel.add(sortBtn);

    const filterBtn = this.ui.createButton(410, 50, 'Filter', {
      width: 60, height: 22, fontSize: '10px',
      onClick: () => this.cycleFilterType()
    });
    this.panel.add(filterBtn);

    // Grid slots (8 columns x 5 rows = 40 slots)
    const gridStartX = 150;
    const gridStartY = 70;
    const slotSize = 42;
    const slotGap = 4;

    this.slotContainers = [];
    for (let i = 0; i < 40; i++) {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x = gridStartX + col * (slotSize + slotGap);
      const y = gridStartY + row * (slotSize + slotGap);

      const slot = this.ui.createSlot(x, y, {
        size: slotSize,
        slotIndex: i,
        onClick: (idx, item) => this.onInventorySlotClick(idx, item)
      });
      this.panel.add(slot);
      this.slotContainers.push(slot);
    }

    // ─── Gold/Currency Display ────────────────────────────────────
    this.goldText = this.scene.add.text(150, panelHeight - 35, 'Gold: 0', {
      fontSize: '13px', fill: '#ffcc00', fontFamily: 'monospace'
    });
    this.panel.add(this.goldText);

    // ─── Item Details ─────────────────────────────────────────────
    this.detailsText = this.scene.add.text(280, panelHeight - 65, '', {
      fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace',
      wordWrap: { width: 220 }
    });
    this.panel.add(this.detailsText);
  }

  setupEventListeners() {
    this.eventBus.on('inventory:addItem', (data) => this.addItem(data));
    this.eventBus.on('inventory:removeItem', (data) => this.removeItem(data));
    this.eventBus.on('inventory:update', () => this.refreshDisplay());
  }

  // ─── Item Management ──────────────────────────────────────────────

  addItem(data) {
    const { itemId, quantity = 1, itemData = null } = data;

    // Check for existing stack
    if (itemData?.stackable) {
      const existingSlot = this.items.findIndex(
        item => item && item.id === itemId && item.quantity < (item.maxStack || 99)
      );
      if (existingSlot >= 0) {
        this.items[existingSlot].quantity += quantity;
        this.refreshSlot(existingSlot);
        this.ui.notify(`+${quantity} ${itemData?.name || itemId}`, { type: 'item' });
        return true;
      }
    }

    // Find empty slot
    const emptySlot = this.items.findIndex(item => item === null);
    if (emptySlot < 0) {
      this.ui.notify('Inventory full!', { type: 'warning' });
      return false;
    }

    this.items[emptySlot] = {
      id: itemId,
      ...(itemData || {}),
      quantity
    };
    this.refreshSlot(emptySlot);
    this.ui.notify(`+${quantity} ${itemData?.name || itemId}`, { type: 'item' });
    return true;
  }

  removeItem(data) {
    const { itemId, quantity = 1 } = data;
    let remaining = quantity;

    for (let i = 0; i < this.items.length && remaining > 0; i++) {
      if (this.items[i]?.id === itemId) {
        const remove = Math.min(this.items[i].quantity, remaining);
        this.items[i].quantity -= remove;
        remaining -= remove;

        if (this.items[i].quantity <= 0) {
          this.items[i] = null;
        }
        this.refreshSlot(i);
      }
    }

    return remaining === 0;
  }

  getItemCount(itemId) {
    return this.items
      .filter(item => item?.id === itemId)
      .reduce((sum, item) => sum + (item?.quantity || 0), 0);
  }

  // ─── Slot Interactions ────────────────────────────────────────────

  onInventorySlotClick(index, item) {
    if (!item) {
      this.selectedSlot = null;
      this.detailsText.setText('');
      return;
    }

    this.selectedSlot = index;
    this.showItemDetails(item);
  }

  onEquipmentSlotClick(slotKey, item) {
    if (item) {
      // Unequip to inventory
      const added = this.addItem({ itemId: item.id, quantity: 1, itemData: item });
      if (added) {
        this.equipment[slotKey] = null;
        this.equipmentSlots[slotKey].setItem(null);
        this.updateStats();
      }
    } else if (this.selectedSlot !== null) {
      // Equip from inventory
      const invItem = this.items[this.selectedSlot];
      if (invItem && this.canEquip(invItem, slotKey)) {
        this.equipment[slotKey] = invItem;
        this.equipmentSlots[slotKey].setItem(invItem);
        this.items[this.selectedSlot] = null;
        this.refreshSlot(this.selectedSlot);
        this.selectedSlot = null;
        this.updateStats();
      }
    }
  }

  canEquip(item, slotKey) {
    const slotTypeMap = {
      weapon: ['weapon'],
      armor: ['armor'],
      helmet: ['armor'],
      boots: ['armor'],
      accessory1: ['accessory'],
      accessory2: ['accessory'],
      amulet: ['accessory'],
      ring: ['accessory']
    };
    return slotTypeMap[slotKey]?.includes(item.type) || false;
  }

  showItemDetails(item) {
    if (!item) {
      this.detailsText.setText('');
      return;
    }

    let text = `${item.name || item.id}\n`;
    text += `${(item.rarity || 'common').toUpperCase()}\n`;
    if (item.description) text += `${item.description}\n`;
    if (item.stats) {
      text += '\n';
      for (const [stat, val] of Object.entries(item.stats)) {
        if (val !== 0) text += `${stat}: ${val > 0 ? '+' : ''}${val}\n`;
      }
    }
    if (item.value) text += `\nValue: ${item.value}g`;

    this.detailsText.setText(text);
  }

  // ─── Sorting & Filtering ──────────────────────────────────────────

  cycleSortMode() {
    const modes = ['type', 'rarity', 'name', 'value'];
    const idx = modes.indexOf(this.sortMode);
    this.sortMode = modes[(idx + 1) % modes.length];
    this.sortInventory();
    this.ui.notify(`Sort: ${this.sortMode}`, { type: 'info', duration: 1000 });
  }

  cycleFilterType() {
    const types = ['all', 'weapon', 'armor', 'consumable', 'material', 'quest'];
    const idx = types.indexOf(this.filterType);
    this.filterType = types[(idx + 1) % types.length];
    this.refreshDisplay();
    this.ui.notify(`Filter: ${this.filterType}`, { type: 'info', duration: 1000 });
  }

  sortInventory() {
    const items = this.items.filter(i => i !== null);
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

    items.sort((a, b) => {
      switch (this.sortMode) {
        case 'type': return (a.type || '').localeCompare(b.type || '');
        case 'rarity': return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        case 'name': return (a.name || a.id).localeCompare(b.name || b.id);
        case 'value': return (b.value || 0) - (a.value || 0);
        default: return 0;
      }
    });

    this.items = new Array(40).fill(null);
    items.forEach((item, i) => { this.items[i] = item; });
    this.refreshDisplay();
  }

  // ─── Display Updates ──────────────────────────────────────────────

  refreshSlot(index) {
    if (this.slotContainers[index]) {
      this.slotContainers[index].setItem(this.items[index]);
    }
  }

  refreshDisplay() {
    for (let i = 0; i < 40; i++) {
      let item = this.items[i];
      if (item && this.filterType !== 'all' && item.type !== this.filterType) {
        this.slotContainers[i].setItem(null); // Hide filtered items visually
      } else {
        this.slotContainers[i].setItem(item);
      }
    }
  }

  updateStats() {
    let atk = 0, def = 0, spd = 0, hp = 0, sapRegen = 0;

    for (const item of Object.values(this.equipment)) {
      if (item?.stats) {
        atk += item.stats.damage || 0;
        def += item.stats.defense || 0;
        spd += item.stats.speed || 0;
        hp += item.stats.health || 0;
        sapRegen += item.stats.sapRegenRate || 0;
      }
    }

    this.statsText.setText(
      `ATK: ${atk}\nDEF: ${def}\nSPD: ${spd}\n HP: +${hp}\nSAP: +${sapRegen}`
    );

    this.eventBus.emit('player:statsUpdated', { atk, def, spd, hp, sapRegen });
  }

  setVisible(visible) {
    this.visible = visible;
    this.panel.setVisible(visible);
  }

  onShow() { this.refreshDisplay(); }
  onHide() { this.selectedSlot = null; this.detailsText?.setText(''); }

  // ─── Save/Load ────────────────────────────────────────────────────

  saveState() {
    return {
      items: this.items,
      equipment: this.equipment
    };
  }

  loadState(state) {
    if (state.items) {
      this.items = state.items;
      this.refreshDisplay();
    }
    if (state.equipment) {
      this.equipment = state.equipment;
      for (const [key, item] of Object.entries(this.equipment)) {
        if (this.equipmentSlots[key]) {
          this.equipmentSlots[key].setItem(item);
        }
      }
      this.updateStats();
    }
  }

  destroy() {
    this.panel.destroy(true);
  }
}

export default InventoryPanel;
