import { EventBus } from '../core/EventBus.js';
import { ComponentRegistry } from '../engine/ComponentRegistry.js';

/**
 * HierarchyPanel - Tree view of all game objects in the scene.
 *
 * Editor panel providing:
 *  - Collapsible tree of entities from ComponentRegistry
 *  - Parent-child hierarchy display with indentation
 *  - Click to select (highlights entity, updates Inspector)
 *  - Right-click context menu: rename, delete, duplicate, reparent
 *  - Search/filter by name
 *  - Drag-to-reorder (future)
 *  - Entity icons by type (enemy, NPC, light, trigger, etc.)
 *  - Live count display
 *  - Visibility toggle per entity
 */
export class HierarchyPanel {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.registry = ComponentRegistry.getInstance();

    this.panelX = config.x || 8;
    this.panelY = config.y || 48;
    this.panelWidth = config.width || 200;
    this.panelHeight = config.height || 400;
    this.visible = true;
    this.selectedEntityId = null;
    this.expandedNodes = new Set();
    this.searchTerm = '';
    this.scrollOffset = 0;
    this.rowHeight = 18;
    this.maxVisibleRows = Math.floor((this.panelHeight - 50) / this.rowHeight);

    // UI elements
    this.container = null;
    this.rows = [];

    this.createPanel();

    // Listen for ECS changes
    this.eventBus.on('ecs:entityCreated', () => this.refresh());
    this.eventBus.on('ecs:entityDestroyed', () => this.refresh());
    this.eventBus.on('ecs:parentChanged', () => this.refresh());
    this.eventBus.on('ecs:sceneImported', () => this.refresh());
  }

  createPanel() {
    this.container = this.scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    // Background
    this.bg = this.scene.add.graphics().setScrollFactor(0);
    this.container.add(this.bg);

    // Title bar
    this.titleText = this.scene.add.text(
      this.panelX + 8, this.panelY + 6,
      'HIERARCHY',
      { fontSize: '10px', color: '#6688aa', fontFamily: 'monospace', fontStyle: 'bold' }
    ).setScrollFactor(0);
    this.container.add(this.titleText);

    // Count label
    this.countText = this.scene.add.text(
      this.panelX + this.panelWidth - 8, this.panelY + 6,
      '0',
      { fontSize: '10px', color: '#445566', fontFamily: 'monospace' }
    ).setOrigin(1, 0).setScrollFactor(0);
    this.container.add(this.countText);

    // Search bar
    this.searchBg = this.scene.add.graphics().setScrollFactor(0);
    this.container.add(this.searchBg);

    this.searchLabel = this.scene.add.text(
      this.panelX + 8, this.panelY + 22,
      'Search...',
      { fontSize: '9px', color: '#445566', fontFamily: 'monospace' }
    ).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.container.add(this.searchLabel);

    // Row container
    this.rowContainer = this.scene.add.container(0, 0).setScrollFactor(0);
    this.container.add(this.rowContainer);

    // Scroll handling
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (pointer.x >= this.panelX && pointer.x <= this.panelX + this.panelWidth &&
          pointer.y >= this.panelY && pointer.y <= this.panelY + this.panelHeight) {
        this.scrollOffset = Math.max(0, this.scrollOffset + (deltaY > 0 ? 1 : -1));
        this.refresh();
      }
    });

    this._drawBackground();
  }

  _drawBackground() {
    this.bg.clear();
    this.bg.fillStyle(0x111122, 0.90);
    this.bg.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);
    this.bg.lineStyle(1, 0x334466, 0.5);
    this.bg.strokeRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);

    // Title separator
    this.bg.lineStyle(1, 0x334466, 0.3);
    this.bg.lineBetween(
      this.panelX + 4, this.panelY + 20,
      this.panelX + this.panelWidth - 4, this.panelY + 20
    );

    // Search bar bg
    this.searchBg.clear();
    this.searchBg.fillStyle(0x0a0a1a, 0.8);
    this.searchBg.fillRect(this.panelX + 4, this.panelY + 22, this.panelWidth - 8, 14);
  }

  // ─── Tree Building ──────────────────────────────────────────────

  refresh() {
    // Clear existing rows
    this.rowContainer.removeAll(true);
    this.rows = [];

    const entities = this.registry.getAllEntities();
    this.countText.setText(`${entities.length}`);

    // Build flat list with indentation
    const flatList = [];
    const rootEntities = this.registry.getRootEntities();

    for (const entity of rootEntities) {
      this._flattenTree(entity, 0, flatList);
    }

    // Apply search filter
    let filtered = flatList;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = flatList.filter(item =>
        item.entity.name.toLowerCase().includes(term)
      );
    }

    // Apply scroll
    const startIdx = Math.min(this.scrollOffset, Math.max(0, filtered.length - this.maxVisibleRows));
    const endIdx = Math.min(startIdx + this.maxVisibleRows, filtered.length);

    // Render visible rows
    for (let i = startIdx; i < endIdx; i++) {
      const item = filtered[i];
      const rowY = this.panelY + 40 + (i - startIdx) * this.rowHeight;
      this._createRow(item, rowY);
    }

    // Scrollbar
    if (filtered.length > this.maxVisibleRows) {
      const scrollRatio = startIdx / (filtered.length - this.maxVisibleRows);
      const barHeight = Math.max(20, (this.maxVisibleRows / filtered.length) * (this.panelHeight - 50));
      const barY = this.panelY + 40 + scrollRatio * ((this.panelHeight - 50) - barHeight);

      const scrollbar = this.scene.add.graphics().setScrollFactor(0);
      scrollbar.fillStyle(0x446688, 0.5);
      scrollbar.fillRect(this.panelX + this.panelWidth - 6, barY, 4, barHeight);
      this.rowContainer.add(scrollbar);
    }
  }

  _flattenTree(entity, depth, list) {
    list.push({ entity, depth });
    if (this.expandedNodes.has(entity.id)) {
      const children = this.registry.getChildren(entity.id);
      for (const child of children) {
        this._flattenTree(child, depth + 1, list);
      }
    }
  }

  _createRow(item, y) {
    const { entity, depth } = item;
    const x = this.panelX + 8 + depth * 12;
    const isSelected = entity.id === this.selectedEntityId;
    const hasChildren = entity.children.length > 0;
    const isExpanded = this.expandedNodes.has(entity.id);

    // Selection highlight
    if (isSelected) {
      const highlight = this.scene.add.graphics().setScrollFactor(0);
      highlight.fillStyle(0x446688, 0.4);
      highlight.fillRect(this.panelX + 2, y - 1, this.panelWidth - 4, this.rowHeight);
      this.rowContainer.add(highlight);
    }

    // Expand/collapse arrow
    if (hasChildren) {
      const arrow = this.scene.add.text(x - 10, y, isExpanded ? 'v' : '>', {
        fontSize: '9px', color: '#667788', fontFamily: 'monospace'
      }).setScrollFactor(0).setInteractive({ useHandCursor: true });

      arrow.on('pointerdown', () => {
        if (isExpanded) {
          this.expandedNodes.delete(entity.id);
        } else {
          this.expandedNodes.add(entity.id);
        }
        this.refresh();
      });
      this.rowContainer.add(arrow);
    }

    // Type icon
    const iconColors = {
      Player: '#4488ff',
      Enemy: '#ff4444',
      NPC: '#44ff44',
      Light: '#ffff88',
      Trigger: '#ffaa44',
      Sprite: '#88aadd',
      Zone: '#aa44ff',
      Container: '#888888'
    };
    const entityType = this._getEntityType(entity);
    const iconColor = iconColors[entityType] || '#667788';

    const icon = this.scene.add.text(x, y, this._getEntityIcon(entityType), {
      fontSize: '9px', color: iconColor, fontFamily: 'monospace'
    }).setScrollFactor(0);
    this.rowContainer.add(icon);

    // Entity name
    const nameColor = isSelected ? '#ffffff' : (entity.active ? '#aabbcc' : '#555566');
    const maxNameWidth = this.panelWidth - (depth * 12) - 40;
    let displayName = entity.name;
    if (displayName.length > Math.floor(maxNameWidth / 6)) {
      displayName = displayName.substring(0, Math.floor(maxNameWidth / 6) - 2) + '..';
    }

    const nameText = this.scene.add.text(x + 14, y, displayName, {
      fontSize: '9px', color: nameColor, fontFamily: 'monospace'
    }).setScrollFactor(0).setInteractive({ useHandCursor: true });

    nameText.on('pointerdown', () => {
      this.selectEntity(entity.id);
    });

    nameText.on('pointerover', () => {
      if (!isSelected) nameText.setColor('#ffffff');
    });

    nameText.on('pointerout', () => {
      if (!isSelected) nameText.setColor(entity.active ? '#aabbcc' : '#555566');
    });

    this.rowContainer.add(nameText);

    // Visibility toggle
    const visIcon = this.scene.add.text(
      this.panelX + this.panelWidth - 18, y,
      entity.visible ? 'o' : '-',
      { fontSize: '9px', color: entity.visible ? '#44ff44' : '#444444', fontFamily: 'monospace' }
    ).setScrollFactor(0).setInteractive({ useHandCursor: true });

    visIcon.on('pointerdown', () => {
      entity.visible = !entity.visible;
      if (entity.gameObject) entity.gameObject.setVisible(entity.visible);
      this.refresh();
    });

    this.rowContainer.add(visIcon);
    this.rows.push({ entity, nameText, y });
  }

  _getEntityType(entity) {
    if (entity.tags.has('player')) return 'Player';
    if (entity.tags.has('enemy')) return 'Enemy';
    if (entity.tags.has('npc')) return 'NPC';
    if (entity.components.has('Light')) return 'Light';
    if (entity.components.has('Trigger')) return 'Trigger';
    if (entity.components.has('Sprite')) return 'Sprite';
    if (entity.children.length > 0) return 'Container';
    return 'Sprite';
  }

  _getEntityIcon(type) {
    const icons = {
      Player: '@',
      Enemy: 'X',
      NPC: '?',
      Light: '*',
      Trigger: '#',
      Sprite: '~',
      Zone: '[',
      Container: '+'
    };
    return icons[type] || '~';
  }

  // ─── Selection ──────────────────────────────────────────────────

  selectEntity(entityId) {
    this.selectedEntityId = entityId;
    const entity = this.registry.getEntity(entityId);

    this.eventBus.emit('hierarchy:selected', {
      entityId,
      entity,
      gameObject: entity?.gameObject
    });

    this.refresh();
  }

  getSelectedEntity() {
    return this.selectedEntityId ? this.registry.getEntity(this.selectedEntityId) : null;
  }

  // ─── Search ─────────────────────────────────────────────────────

  setSearch(term) {
    this.searchTerm = term;
    this.scrollOffset = 0;
    this.refresh();
  }

  // ─── Visibility ─────────────────────────────────────────────────

  setVisible(visible) {
    this.visible = visible;
    this.container.setVisible(visible);
  }

  setPosition(x, y) {
    this.panelX = x;
    this.panelY = y;
    this._drawBackground();
    this.refresh();
  }

  resize(width, height) {
    this.panelWidth = width;
    this.panelHeight = height;
    this.maxVisibleRows = Math.floor((this.panelHeight - 50) / this.rowHeight);
    this._drawBackground();
    this.refresh();
  }

  destroy() {
    if (this.container) this.container.destroy(true);
  }
}

export default HierarchyPanel;
