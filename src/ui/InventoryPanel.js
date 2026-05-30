import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';

// Rarity colour map shared by drag ghost and tooltip border
const RARITY_COLORS = {
  common:    0x888888,
  uncommon:  0x44ff44,
  rare:      0x4a9eff,
  epic:      0xaa44ff,
  legendary: 0xff8800,
  mythic:    0xff4444
};

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
    this.equipSystem = EquipmentSystem.getInstance();

    // UI
    this.panel = null;
    this.slotContainers = [];
    this.equipmentSlots = {};
    this.visible = false;

    // ── Drag-and-drop state ──────────────────────────────────────
    this._dragging = false;
    this._dragSource = null;   // 'inv_0'..'inv_39' | 'weapon' | etc.
    this._dragGhost = null;    // Container that follows pointer
    this._slotZones = {};      // key → { zone, x, y, w, h, type, index?, slotName? }

    // Hover tooltip (separate from UIFramework tooltip — keyed on drag state)
    this._hoverTooltip = null;

    this.build();
    this._setupDragListeners();
    this.setupEventListeners();
  }

  // ──────────────────────────────────────────────────────────────────
  // Build
  // ──────────────────────────────────────────────────────────────────

  build() {
    const panelWidth  = 520;
    const panelHeight = 440;
    const panelX = GameConfig.WIDTH  / 2 - panelWidth  / 2;
    const panelY = GameConfig.HEIGHT / 2 - panelHeight / 2;

    this.panel = this.ui.createPanel(panelX, panelY, panelWidth, panelHeight, {
      title: 'Inventory',
      closable: true,
      depth: 7000
    });
    this.panel.setVisible(false);

    // ─── Equipment Section (left side) ────────────────────────────
    const equipLabel = this.scene.add.text(15, 45, 'Equipment', {
      fontSize: '17px', fill: '#4a9eff', fontFamily: 'Open Sans'
    });
    this.panel.add(equipLabel);

    const equipSlotPositions = {
      weapon:     { x: 30,  y: 70,  label: 'WPN' },
      armor:      { x: 80,  y: 70,  label: 'ARM' },
      helmet:     { x: 30,  y: 124, label: 'HLM' },
      boots:      { x: 80,  y: 124, label: 'BTS' },
      accessory1: { x: 30,  y: 178, label: 'ACC' },
      accessory2: { x: 80,  y: 178, label: 'ACC' },
      amulet:     { x: 30,  y: 232, label: 'AMU' },
      ring:       { x: 80,  y: 232, label: 'RNG' }
    };

    for (const [slotKey, pos] of Object.entries(equipSlotPositions)) {
      const slot = this.ui.createSlot(pos.x, pos.y, {
        size: 44,
        onClick: (_, item) => {
          if (!this._dragging) this.onEquipmentSlotClick(slotKey, item);
        }
      });
      this.panel.add(slot);
      this.equipmentSlots[slotKey] = slot;

      // Register as a drag-drop zone
      this._slotZones[slotKey] = {
        zone: slot,
        x: this.panel.x + pos.x,
        y: this.panel.y + pos.y,
        w: 44, h: 44,
        type: 'equip',
        slotName: slotKey
      };

      // Attach drag-source listener to equip slot
      this._attachSlotDragSource(slot, slotKey, () => this.equipment[slotKey]);

      const label = this.scene.add.text(pos.x + 22, pos.y + 48, pos.label, {
        fontSize: '11px', fill: '#666666', fontFamily: 'Open Sans'
      }).setOrigin(0.5);
      this.panel.add(label);
    }

    // ─── Stats Display ────────────────────────────────────────────
    this.statsText = this.scene.add.text(15, 290, 'ATK: 0\nDEF: 0\nSPD: 0', {
      fontSize: '15px', fill: '#aaaaaa', fontFamily: 'Open Sans', lineSpacing: 4
    });
    this.panel.add(this.statsText);

    // ─── Inventory Grid (right side) ──────────────────────────────
    const gridLabel = this.scene.add.text(150, 45, 'Items', {
      fontSize: '17px', fill: '#4a9eff', fontFamily: 'Open Sans'
    });
    this.panel.add(gridLabel);

    // Sort/Filter buttons
    const sortBtn = this.ui.createButton(350, 50, 'Sort', {
      width: 50, height: 22, fontSize: '14px',
      onClick: () => this.cycleSortMode()
    });
    this.panel.add(sortBtn);

    const filterBtn = this.ui.createButton(410, 50, 'Filter', {
      width: 60, height: 22, fontSize: '14px',
      onClick: () => this.cycleFilterType()
    });
    this.panel.add(filterBtn);

    // Grid slots (8 columns × 5 rows = 40 slots)
    const gridStartX = 150;
    const gridStartY = 70;
    const slotSize   = 42;
    const slotGap    = 4;

    this.slotContainers = [];
    for (let i = 0; i < 40; i++) {
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x   = gridStartX + col * (slotSize + slotGap);
      const y   = gridStartY + row * (slotSize + slotGap);

      const slot = this.ui.createSlot(x, y, {
        size: slotSize,
        slotIndex: i,
        onClick: (idx, item) => {
          if (!this._dragging) this.onInventorySlotClick(idx, item);
        }
      });
      this.panel.add(slot);
      this.slotContainers.push(slot);

      const key = `inv_${i}`;
      this._slotZones[key] = {
        zone: slot,
        x: this.panel.x + x,
        y: this.panel.y + y,
        w: slotSize, h: slotSize,
        type: 'inv',
        index: i
      };

      // Attach drag-source listener
      this._attachSlotDragSource(slot, key, () => this.items[i]);
    }

    // ─── Gold/Currency Display ────────────────────────────────────
    this.goldText = this.scene.add.text(150, panelHeight - 35, 'Gold: 0', {
      fontSize: '18px', fill: '#ffcc00', fontFamily: 'Open Sans'
    });
    this.panel.add(this.goldText);

    // ─── Item Details ─────────────────────────────────────────────
    this.detailsText = this.scene.add.text(280, panelHeight - 65, '', {
      fontSize: '15px', fill: '#cccccc', fontFamily: 'Open Sans',
      wordWrap: { width: 220 }
    });
    this.panel.add(this.detailsText);
  }

  // ──────────────────────────────────────────────────────────────────
  // Drag-source wiring — attaches pointerdown to a slot container
  // ──────────────────────────────────────────────────────────────────

  /**
   * @param {Phaser.GameObjects.Container} slotContainer
   * @param {string} slotKey  e.g. 'inv_3' or 'weapon'
   * @param {function(): object|null} getItemFn  returns the current item in the slot
   */
  _attachSlotDragSource(slotContainer, slotKey, getItemFn) {
    slotContainer.on('pointerdown', (pointer) => {
      if (!this.visible) return;
      const item = getItemFn();
      if (!item) return;
      this._startDrag(pointer, slotKey, item);
    });

    // Hover tooltip — only when NOT dragging
    slotContainer.on('pointerover', (pointer) => {
      if (this._dragging) return;
      const item = getItemFn();
      if (item) this._showHoverTooltip(pointer, item);
    });
    slotContainer.on('pointerout', () => {
      this._destroyHoverTooltip();
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Global drag listeners (pointer move / up)
  // ──────────────────────────────────────────────────────────────────

  _setupDragListeners() {
    this.scene.input.on('pointermove', (pointer) => {
      if (!this._dragging || !this._dragGhost) return;
      // Ghost follows the pointer in screen-space (scrollFactor 0)
      this._dragGhost.setPosition(pointer.x, pointer.y);
    });

    this.scene.input.on('pointerup', (pointer) => {
      if (this._dragging) this._endDrag(pointer);
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // _startDrag
  // ──────────────────────────────────────────────────────────────────

  _startDrag(pointer, sourceKey, item) {
    this._dragging    = true;
    this._dragSource  = sourceKey;
    this._destroyHoverTooltip();

    // Build ghost — semi-transparent rect + item initial letter
    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
    const ghost = this.scene.add.container(pointer.x, pointer.y)
      .setDepth(9900)
      .setScrollFactor(0);

    const gfx = this.scene.add.graphics();
    gfx.fillStyle(rarityColor, 0.4);
    gfx.fillRoundedRect(-20, -20, 40, 40, 4);
    gfx.lineStyle(2, rarityColor, 0.9);
    gfx.strokeRoundedRect(-20, -20, 40, 40, 4);
    ghost.add(gfx);

    const nameLabel = this.scene.add.text(0, 0,
      item.name ? item.name.charAt(0).toUpperCase() : '?',
      { fontSize: '25px', fill: '#ffffff', fontFamily: 'Open Sans' }
    ).setOrigin(0.5).setAlpha(0.85);
    ghost.add(nameLabel);

    const subLabel = this.scene.add.text(0, 24,
      (item.name || item.id || '').substring(0, 8),
      { fontSize: '11px', fill: '#cccccc', fontFamily: 'Open Sans' }
    ).setOrigin(0.5).setAlpha(0.9);
    ghost.add(subLabel);

    this._dragGhost = ghost;

    // Highlight valid drop targets
    this._highlightDropTargets(item, sourceKey);
  }

  // ──────────────────────────────────────────────────────────────────
  // _endDrag
  // ──────────────────────────────────────────────────────────────────

  _endDrag(pointer) {
    const sourceKey = this._dragSource;
    const isInvSource = sourceKey?.startsWith('inv_');
    const sourceIndex = isInvSource ? parseInt(sourceKey.split('_')[1], 10) : -1;
    const draggedItem = isInvSource
      ? this.items[sourceIndex]
      : this.equipment[sourceKey];

    // Find hit target
    const targetKey = this._findDropTarget(pointer);

    if (targetKey && targetKey !== sourceKey && draggedItem) {
      this._applyDrop(sourceKey, targetKey, draggedItem);
    }

    // Cleanup
    this._destroyGhost();
    this._clearDropHighlights();
    this._dragging   = false;
    this._dragSource = null;

    this.refreshDisplay();
    this.updateStats();
  }

  /**
   * Return the slotKey of whichever registered zone the pointer is inside,
   * or null when the pointer is over no zone.
   */
  _findDropTarget(pointer) {
    const px = pointer.x;
    const py = pointer.y;

    for (const [key, info] of Object.entries(this._slotZones)) {
      // Recompute world position in case panel moved
      const wx = this.panel.x + info.zone.x;
      const wy = this.panel.y + info.zone.y;
      if (px >= wx && px <= wx + info.w && py >= wy && py <= wy + info.h) {
        return key;
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────
  // _applyDrop — core swap / equip / unequip logic
  // ──────────────────────────────────────────────────────────────────

  _applyDrop(sourceKey, targetKey, draggedItem) {
    const srcIsInv   = sourceKey.startsWith('inv_');
    const tgtIsInv   = targetKey.startsWith('inv_');
    const srcIndex   = srcIsInv  ? parseInt(sourceKey.split('_')[1], 10)  : -1;
    const tgtIndex   = tgtIsInv  ? parseInt(targetKey.split('_')[1], 10)  : -1;
    const srcSlotName = !srcIsInv ? sourceKey : null;
    const tgtSlotName = !tgtIsInv ? targetKey : null;

    // ── Case 1: inv → inv (reorder / swap) ──────────────────────────
    if (srcIsInv && tgtIsInv) {
      const displaced = this.items[tgtIndex];
      this.items[tgtIndex] = draggedItem;
      this.items[srcIndex] = displaced;   // null if empty target
      return;
    }

    // ── Case 2: inv → equip ─────────────────────────────────────────
    if (srcIsInv && !tgtIsInv) {
      if (!this.equipSystem.canEquip(draggedItem, tgtSlotName)) return;

      const result = this.equipSystem.equip(draggedItem, tgtSlotName);
      if (!result.success) return;

      this.equipment[tgtSlotName] = draggedItem;
      this.equipmentSlots[tgtSlotName].setItem(draggedItem);
      this.items[srcIndex] = null;

      // Displaced item back into inventory
      if (result.unequipped) {
        const emptySlot = this.items.findIndex(i => i === null);
        if (emptySlot >= 0) {
          this.items[emptySlot] = result.unequipped;
        }
      }
      return;
    }

    // ── Case 3: equip → inv ─────────────────────────────────────────
    if (!srcIsInv && tgtIsInv) {
      const displaced = this.items[tgtIndex];   // may be null

      const unequipped = this.equipSystem.unequip(srcSlotName);
      if (!unequipped) return;

      this.equipment[srcSlotName] = null;
      this.equipmentSlots[srcSlotName].setItem(null);
      this.items[tgtIndex] = unequipped;

      // If there was an item in the target inv slot, try to equip it back
      // (or put it into first empty slot as a fallback)
      if (displaced) {
        if (this.equipSystem.canEquip(displaced, srcSlotName)) {
          const result = this.equipSystem.equip(displaced, srcSlotName);
          if (result.success) {
            this.equipment[srcSlotName] = displaced;
            this.equipmentSlots[srcSlotName].setItem(displaced);
          } else {
            const empty = this.items.findIndex(i => i === null);
            if (empty >= 0) this.items[empty] = displaced;
          }
        } else {
          const empty = this.items.findIndex(i => i === null);
          if (empty >= 0) this.items[empty] = displaced;
        }
      }
      return;
    }

    // ── Case 4: equip → equip ───────────────────────────────────────
    if (!srcIsInv && !tgtIsInv) {
      const targetItem = this.equipment[tgtSlotName];

      // Unequip source
      const unequippedSrc = this.equipSystem.unequip(srcSlotName);
      if (!unequippedSrc) return;
      this.equipment[srcSlotName] = null;
      this.equipmentSlots[srcSlotName].setItem(null);

      // Try to equip dragged item into target slot
      if (this.equipSystem.canEquip(draggedItem, tgtSlotName)) {
        const result = this.equipSystem.equip(draggedItem, tgtSlotName);
        if (result.success) {
          this.equipment[tgtSlotName] = draggedItem;
          this.equipmentSlots[tgtSlotName].setItem(draggedItem);

          // If the target had an item, try it in the source slot
          if (targetItem && this.equipSystem.canEquip(targetItem, srcSlotName)) {
            const r2 = this.equipSystem.equip(targetItem, srcSlotName);
            if (r2.success) {
              this.equipment[srcSlotName] = targetItem;
              this.equipmentSlots[srcSlotName].setItem(targetItem);
            } else {
              const empty = this.items.findIndex(i => i === null);
              if (empty >= 0) this.items[empty] = targetItem;
            }
          } else if (targetItem) {
            const empty = this.items.findIndex(i => i === null);
            if (empty >= 0) this.items[empty] = targetItem;
          }
        } else {
          // Re-equip the original item; cancel the whole operation
          const re = this.equipSystem.equip(unequippedSrc, srcSlotName);
          if (re.success) {
            this.equipment[srcSlotName] = unequippedSrc;
            this.equipmentSlots[srcSlotName].setItem(unequippedSrc);
          }
        }
      } else {
        // Target slot incompatible — cancel
        const re = this.equipSystem.equip(unequippedSrc, srcSlotName);
        if (re.success) {
          this.equipment[srcSlotName] = unequippedSrc;
          this.equipmentSlots[srcSlotName].setItem(unequippedSrc);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Visual helpers
  // ──────────────────────────────────────────────────────────────────

  _highlightDropTargets(item, sourceKey) {
    for (const [key, info] of Object.entries(this._slotZones)) {
      if (key === sourceKey) continue;

      const isEquipTarget = info.type === 'equip';
      const canDrop = isEquipTarget
        ? this.canEquip(item, info.slotName)
        : true;  // inventory slots always accept

      if (!canDrop) continue;

      const zone = info.zone;
      // Draw a subtle highlight border — find the first graphics child (bg)
      const bg = zone.list && zone.list[0];
      if (bg?.type === 'Graphics') {
        bg._highlighted = true;
        // store original draw fn is too complex; just overlay a second graphics
        if (!zone._highlightGfx) {
          zone._highlightGfx = this.scene.add.graphics().setDepth(7001);
          zone.add(zone._highlightGfx);
        }
        const hw = info.w;
        const hh = info.h;
        zone._highlightGfx.clear();
        zone._highlightGfx.lineStyle(2, isEquipTarget ? 0xffaa00 : 0x44ff88, 0.85);
        zone._highlightGfx.strokeRoundedRect(0, 0, hw, hh, 4);
      }
    }
  }

  _clearDropHighlights() {
    for (const info of Object.values(this._slotZones)) {
      const zone = info.zone;
      if (zone._highlightGfx) {
        zone._highlightGfx.clear();
        zone._highlightGfx.destroy();
        zone._highlightGfx = null;
      }
    }
  }

  _destroyGhost() {
    if (this._dragGhost) {
      this._dragGhost.destroy(true);
      this._dragGhost = null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Hover Tooltip card
  // ──────────────────────────────────────────────────────────────────

  _showHoverTooltip(pointer, item) {
    this._destroyHoverTooltip();

    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
    const padding = 8;
    const lineH = 14;

    let lines = [];
    lines.push(item.name || item.id || '???');
    lines.push((item.rarity || 'common').toUpperCase());
    if (item.description) lines.push(item.description);
    if (item.stats) {
      for (const [stat, val] of Object.entries(item.stats)) {
        if (val !== 0) lines.push(`${stat}: ${val > 0 ? '+' : ''}${val}`);
      }
    }
    if (item.value) lines.push(`Value: ${item.value}g`);

    const maxWidth = 180;
    const totalH   = lines.length * lineH + padding * 2;

    const tt = this.scene.add.container(pointer.x + 14, pointer.y - 10)
      .setDepth(9999)
      .setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111122, 0.95);
    bg.fillRoundedRect(0, 0, maxWidth, totalH, 4);
    bg.lineStyle(1, rarityColor, 0.7);
    bg.strokeRoundedRect(0, 0, maxWidth, totalH, 4);
    tt.add(bg);

    lines.forEach((line, i) => {
      const fill = i === 0 ? '#ffffff'
                 : i === 1 ? `#${rarityColor.toString(16).padStart(6, '0')}`
                 : '#aaaaaa';
      const t = this.scene.add.text(padding, padding + i * lineH, line, {
        fontSize: '15px', fill, fontFamily: 'Open Sans'
      });
      tt.add(t);
    });

    this._hoverTooltip = tt;
  }

  _destroyHoverTooltip() {
    if (this._hoverTooltip) {
      this._hoverTooltip.destroy(true);
      this._hoverTooltip = null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Event listeners
  // ──────────────────────────────────────────────────────────────────

  setupEventListeners() {
    this._unsubs = this._unsubs || [];
    this._unsubs.push(this.eventBus.on('inventory:addItem',    (data) => this.addItem(data)));
    this._unsubs.push(this.eventBus.on('inventory:removeItem', (data) => this.removeItem(data)));
    this._unsubs.push(this.eventBus.on('inventory:update',     ()     => this.refreshDisplay()));
  }

  // ──────────────────────────────────────────────────────────────────
  // Item Management
  // ──────────────────────────────────────────────────────────────────

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

    const emptySlot = this.items.findIndex(item => item === null);
    if (emptySlot < 0) {
      this.ui.notify('Inventory full!', { type: 'warning' });
      return false;
    }

    this.items[emptySlot] = { id: itemId, ...(itemData || {}), quantity };
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
        if (this.items[i].quantity <= 0) this.items[i] = null;
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

  // ──────────────────────────────────────────────────────────────────
  // Slot Interactions (click fallback, used when NOT dragging)
  // ──────────────────────────────────────────────────────────────────

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
      const displaced = this.equipSystem.unequip(slotKey);
      if (displaced) {
        this.addItem({ itemId: displaced.id, quantity: 1, itemData: displaced });
        this.equipment[slotKey] = null;
        this.equipmentSlots[slotKey].setItem(null);
        this.updateStats();
      }
    } else if (this.selectedSlot !== null) {
      const invItem = this.items[this.selectedSlot];
      if (invItem && this.equipSystem.canEquip(invItem, slotKey)) {
        const result = this.equipSystem.equip(invItem, slotKey);
        if (result.success) {
          this.equipment[slotKey] = invItem;
          this.equipmentSlots[slotKey].setItem(invItem);
          this.items[this.selectedSlot] = null;
          this.refreshSlot(this.selectedSlot);
          if (result.unequipped) {
            this.addItem({ itemId: result.unequipped.id, quantity: 1, itemData: result.unequipped });
          }
          this.selectedSlot = null;
          this.updateStats();
        }
      }
    }
  }

  canEquip(item, slotKey) {
    const slotTypeMap = {
      weapon:     ['weapon'],
      armor:      ['armor'],
      helmet:     ['armor'],
      boots:      ['armor'],
      accessory1: ['accessory'],
      accessory2: ['accessory'],
      amulet:     ['accessory'],
      ring:       ['accessory']
    };
    return slotTypeMap[slotKey]?.includes(item.type) || false;
  }

  showItemDetails(item) {
    if (!item) { this.detailsText.setText(''); return; }

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

  // ──────────────────────────────────────────────────────────────────
  // Sorting & Filtering
  // ──────────────────────────────────────────────────────────────────

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
        case 'type':   return (a.type || '').localeCompare(b.type || '');
        case 'rarity': return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        case 'name':   return (a.name || a.id).localeCompare(b.name || b.id);
        case 'value':  return (b.value || 0) - (a.value || 0);
        default:       return 0;
      }
    });

    this.items = new Array(40).fill(null);
    items.forEach((item, i) => { this.items[i] = item; });
    this.refreshDisplay();
  }

  // ──────────────────────────────────────────────────────────────────
  // Display Updates
  // ──────────────────────────────────────────────────────────────────

  refreshSlot(index) {
    if (this.slotContainers[index]) {
      this.slotContainers[index].setItem(this.items[index]);
    }
  }

  refreshDisplay() {
    for (let i = 0; i < 40; i++) {
      const item = this.items[i];
      if (item && this.filterType !== 'all' && item.type !== this.filterType) {
        this.slotContainers[i].setItem(null);
      } else {
        this.slotContainers[i].setItem(item);
      }
    }
  }

  updateStats() {
    const b = this.equipSystem.getTotalBonuses();

    this.statsText.setText(
      `ATK: ${b.damage}\nDEF: ${b.defense}\nSPD: ${b.speed}\n HP: +${b.health}\nSAP: +${b.sapRegenRate}`
    );

    this.eventBus.emit('player:statsUpdated', {
      atk: b.damage, def: b.defense, spd: b.speed,
      hp: b.health, sapRegen: b.sapRegenRate,
      might: b.might, agility: b.agility, resilience: b.resilience,
      insight: b.insight, charisma: b.charisma,
      critChance: b.critChance, evasion: b.evasion,
    });
  }

  setVisible(visible) {
    this.visible = visible;
    this.panel.setVisible(visible);
    if (!visible) {
      this._destroyGhost();
      this._destroyHoverTooltip();
      this._clearDropHighlights();
      this._dragging   = false;
      this._dragSource = null;
    }
  }

  onShow() { this.refreshDisplay(); }
  onHide() {
    this.selectedSlot = null;
    this.detailsText?.setText('');
    this._destroyGhost();
    this._destroyHoverTooltip();
    this._clearDropHighlights();
    this._dragging   = false;
    this._dragSource = null;
  }

  // ──────────────────────────────────────────────────────────────────
  // Save / Load
  // ──────────────────────────────────────────────────────────────────

  saveState() {
    return { items: this.items, equipment: this.equipment };
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
    if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
    this._unsubs = [];
    this._destroyGhost();
    this._destroyHoverTooltip();
    this.panel.destroy(true);
  }
}

export default InventoryPanel;
