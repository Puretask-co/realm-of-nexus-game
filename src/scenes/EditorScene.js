import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';
import { createBlankScene, SCENE_FORMAT_VERSION } from '../configs/sceneFormatSpec.js';

/**
 * EditorScene - Visual Level Editor for Verdance.
 * Provides a full scene editing environment with drag-and-drop placement,
 * property inspector, hierarchy panel, undo/redo, save/load, and grid snapping.
 */
export class EditorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EditorScene' });
    this.eventBus = EventBus.getInstance();
  }

  create() {
    // ─── State ────────────────────────────────────────────────────
    this.sceneData = createBlankScene('Untitled Level');
    this.selectedObject = null;
    this.selectedObjects = [];
    this.hoveredObject = null;
    this.placedObjects = [];
    this.gridVisible = true;
    this.gridSize = 32;
    this.snapToGrid = true;
    this.currentLayer = 'layer_objects';
    this.currentTool = 'select'; // select, place, erase, pan, rect_select
    this.currentPaletteItem = null;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.copyBuffer = null;

    // Undo/Redo
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 50;

    // Camera setup
    this.editorCamera = this.cameras.main;
    this.editorCamera.setBackgroundColor('#2a2a3e');

    // ─── Grid ─────────────────────────────────────────────────────
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(-1000);
    this.drawGrid();

    // ─── Selection Indicator ──────────────────────────────────────
    this.selectionRect = this.add.graphics();
    this.selectionRect.setDepth(10000);

    // ─── Toolbar UI (rendered as simple shapes/text) ──────────────
    this.createEditorUI();

    // ─── Input Handling ───────────────────────────────────────────
    this.setupInputHandlers();
    this.setupKeyboardShortcuts();

    // ─── Coordinate display ───────────────────────────────────────
    this.coordsText = this.add.text(10, GameConfig.HEIGHT - 30, 'X: 0  Y: 0', {
      fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(10001);

    this.toolText = this.add.text(10, 10, 'Tool: Select', {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(10001);

    this.infoText = this.add.text(GameConfig.WIDTH / 2, 10, 'Verdance Level Editor', {
      fontSize: '14px', fill: '#4a9eff', fontFamily: 'monospace'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10001);

    this.eventBus.emit('editor:ready');
  }

  // ─── Grid Drawing ─────────────────────────────────────────────────

  drawGrid() {
    this.gridGraphics.clear();
    if (!this.gridVisible) return;

    const cam = this.editorCamera;
    const startX = Math.floor(cam.scrollX / this.gridSize) * this.gridSize;
    const startY = Math.floor(cam.scrollY / this.gridSize) * this.gridSize;
    const endX = startX + cam.width / cam.zoom + this.gridSize * 2;
    const endY = startY + cam.height / cam.zoom + this.gridSize * 2;

    // Minor grid lines
    this.gridGraphics.lineStyle(1, 0x333355, 0.3);
    for (let x = startX; x <= endX; x += this.gridSize) {
      this.gridGraphics.lineBetween(x, startY, x, endY);
    }
    for (let y = startY; y <= endY; y += this.gridSize) {
      this.gridGraphics.lineBetween(startX, y, endX, y);
    }

    // Major grid lines (every 4 tiles)
    const majorSize = this.gridSize * 4;
    const majorStartX = Math.floor(cam.scrollX / majorSize) * majorSize;
    const majorStartY = Math.floor(cam.scrollY / majorSize) * majorSize;

    this.gridGraphics.lineStyle(1, 0x555588, 0.5);
    for (let x = majorStartX; x <= endX; x += majorSize) {
      this.gridGraphics.lineBetween(x, startY, x, endY);
    }
    for (let y = majorStartY; y <= endY; y += majorSize) {
      this.gridGraphics.lineBetween(startX, y, endX, y);
    }

    // Origin axes
    this.gridGraphics.lineStyle(2, 0xff4444, 0.6);
    this.gridGraphics.lineBetween(0, startY, 0, endY); // Y axis
    this.gridGraphics.lineStyle(2, 0x44ff44, 0.6);
    this.gridGraphics.lineBetween(startX, 0, endX, 0); // X axis
  }

  // ─── Editor UI ────────────────────────────────────────────────────

  createEditorUI() {
    // Toolbar background
    this.toolbarBg = this.add.rectangle(GameConfig.WIDTH / 2, 40, GameConfig.WIDTH, 60, 0x1a1a2e, 0.9)
      .setScrollFactor(0).setDepth(9999).setOrigin(0.5, 0.5);

    // Tool buttons
    const tools = [
      { key: 'select', label: 'SEL', x: 80 },
      { key: 'place', label: 'PLC', x: 130 },
      { key: 'erase', label: 'ERA', x: 180 },
      { key: 'pan', label: 'PAN', x: 230 },
      { key: 'rect_select', label: 'RCT', x: 280 }
    ];

    this.toolButtons = [];
    for (const tool of tools) {
      const btn = this.add.text(tool.x, 40, tool.label, {
        fontSize: '12px',
        fill: '#aaaaaa',
        fontFamily: 'monospace',
        backgroundColor: '#333355',
        padding: { x: 6, y: 4 }
      }).setScrollFactor(0).setDepth(10000).setOrigin(0.5).setInteractive();

      btn.setData('toolKey', tool.key);
      btn.on('pointerdown', () => this.setTool(tool.key));
      this.toolButtons.push(btn);
    }

    // Action buttons
    const actions = [
      { label: 'SAVE', x: GameConfig.WIDTH - 200, action: () => this.saveScene() },
      { label: 'LOAD', x: GameConfig.WIDTH - 150, action: () => this.loadScenePrompt() },
      { label: 'GRID', x: GameConfig.WIDTH - 100, action: () => this.toggleGrid() },
      { label: 'SNAP', x: GameConfig.WIDTH - 50, action: () => this.toggleSnap() }
    ];

    for (const action of actions) {
      const btn = this.add.text(action.x, 40, action.label, {
        fontSize: '12px',
        fill: '#aaaaaa',
        fontFamily: 'monospace',
        backgroundColor: '#333355',
        padding: { x: 6, y: 4 }
      }).setScrollFactor(0).setDepth(10000).setOrigin(0.5).setInteractive();

      btn.on('pointerdown', action.action);
    }

    // Layer indicator
    this.layerText = this.add.text(350, 40, `Layer: ${this.currentLayer}`, {
      fontSize: '12px', fill: '#88aaff', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(10000).setOrigin(0, 0.5);

    // Object count
    this.objectCountText = this.add.text(550, 40, 'Objects: 0', {
      fontSize: '12px', fill: '#88ff88', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(10000).setOrigin(0, 0.5);
  }

  // ─── Input Handling ───────────────────────────────────────────────

  setupInputHandlers() {
    // Mouse move
    this.input.on('pointermove', (pointer) => {
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      this.coordsText.setText(`X: ${Math.round(worldX)}  Y: ${Math.round(worldY)}`);

      if (this.isPanning) {
        const dx = pointer.x - this.panStartX;
        const dy = pointer.y - this.panStartY;
        this.editorCamera.scrollX -= dx / this.editorCamera.zoom;
        this.editorCamera.scrollY -= dy / this.editorCamera.zoom;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        this.drawGrid();
      }

      if (this.isDragging && this.selectedObject) {
        let newX = worldX - this.dragOffsetX;
        let newY = worldY - this.dragOffsetY;
        if (this.snapToGrid) {
          newX = Math.round(newX / this.gridSize) * this.gridSize;
          newY = Math.round(newY / this.gridSize) * this.gridSize;
        }
        this.selectedObject.setPosition(newX, newY);
        this.updateSelectionIndicator();
      }
    });

    // Mouse down
    this.input.on('pointerdown', (pointer) => {
      // Ignore if clicking on UI area
      if (pointer.y < 70 && !pointer.rightButtonDown()) return;

      if (pointer.rightButtonDown()) {
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        return;
      }

      switch (this.currentTool) {
        case 'select':
          this.handleSelectClick(pointer);
          break;
        case 'place':
          this.handlePlaceClick(pointer);
          break;
        case 'erase':
          this.handleEraseClick(pointer);
          break;
        case 'pan':
          this.isPanning = true;
          this.panStartX = pointer.x;
          this.panStartY = pointer.y;
          break;
      }
    });

    // Mouse up
    this.input.on('pointerup', (pointer) => {
      if (this.isPanning) {
        this.isPanning = false;
      }
      if (this.isDragging) {
        this.isDragging = false;
        if (this.selectedObject) {
          this.pushUndo({
            type: 'move',
            objectId: this.selectedObject.getData('sceneObjectId'),
            x: this.selectedObject.x,
            y: this.selectedObject.y
          });
        }
      }
    });

    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Phaser.Math.Clamp(this.editorCamera.zoom + zoomDelta, 0.25, 4.0);
      this.editorCamera.setZoom(newZoom);
      this.drawGrid();
    });
  }

  setupKeyboardShortcuts() {
    // Ctrl+Z - Undo
    this.input.keyboard.on('keydown-Z', (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.shiftKey) this.redo();
        else this.undo();
      }
    });

    // Ctrl+C - Copy
    this.input.keyboard.on('keydown-C', (event) => {
      if ((event.ctrlKey || event.metaKey) && this.selectedObject) {
        this.copyBuffer = this.serializeObject(this.selectedObject);
      }
    });

    // Ctrl+V - Paste
    this.input.keyboard.on('keydown-V', (event) => {
      if ((event.ctrlKey || event.metaKey) && this.copyBuffer) {
        const pasted = { ...this.copyBuffer };
        pasted.x += this.gridSize;
        pasted.y += this.gridSize;
        pasted.id = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.placeObject(pasted);
      }
    });

    // Ctrl+S - Save
    this.input.keyboard.on('keydown-S', (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.saveScene();
      }
    });

    // Delete - Remove selected
    this.input.keyboard.on('keydown-DELETE', () => {
      if (this.selectedObject) this.deleteSelected();
    });
    this.input.keyboard.on('keydown-BACKSPACE', () => {
      if (this.selectedObject) this.deleteSelected();
    });

    // Tool shortcuts
    this.input.keyboard.on('keydown-S', (event) => {
      if (!event.ctrlKey && !event.metaKey) this.setTool('select');
    });
    this.input.keyboard.on('keydown-P', () => this.setTool('place'));
    this.input.keyboard.on('keydown-E', () => this.setTool('erase'));
    this.input.keyboard.on('keydown-G', () => this.toggleGrid());
    this.input.keyboard.on('keydown-N', () => this.toggleSnap());

    // Layer switching (1-5)
    const layers = ['layer_bg', 'layer_terrain', 'layer_objects', 'layer_collision', 'layer_ui'];
    for (let i = 0; i < layers.length; i++) {
      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        this.currentLayer = layers[i];
        this.layerText.setText(`Layer: ${this.currentLayer}`);
      });
    }
  }

  // ─── Tool Actions ─────────────────────────────────────────────────

  handleSelectClick(pointer) {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    // Find object under cursor
    let found = null;
    for (let i = this.placedObjects.length - 1; i >= 0; i--) {
      const obj = this.placedObjects[i];
      if (!obj.active) continue;
      const bounds = obj.getBounds();
      if (bounds.contains(worldX, worldY)) {
        found = obj;
        break;
      }
    }

    if (found) {
      this.selectObject(found);
      this.isDragging = true;
      this.dragOffsetX = worldX - found.x;
      this.dragOffsetY = worldY - found.y;
    } else {
      this.deselectAll();
    }
  }

  handlePlaceClick(pointer) {
    let x = pointer.worldX;
    let y = pointer.worldY;

    if (this.snapToGrid) {
      x = Math.round(x / this.gridSize) * this.gridSize;
      y = Math.round(y / this.gridSize) * this.gridSize;
    }

    const objectDef = {
      id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: this.currentPaletteItem?.type || 'decor',
      name: this.currentPaletteItem?.name || 'New Object',
      x, y,
      width: this.currentPaletteItem?.width || this.gridSize,
      height: this.currentPaletteItem?.height || this.gridSize,
      texture: this.currentPaletteItem?.texture || null,
      layer: this.currentLayer,
      properties: {}
    };

    this.placeObject(objectDef);
  }

  handleEraseClick(pointer) {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    for (let i = this.placedObjects.length - 1; i >= 0; i--) {
      const obj = this.placedObjects[i];
      if (!obj.active) continue;
      const bounds = obj.getBounds();
      if (bounds.contains(worldX, worldY)) {
        this.pushUndo({
          type: 'delete',
          objectData: this.serializeObject(obj)
        });
        obj.destroy();
        this.placedObjects.splice(i, 1);
        if (this.selectedObject === obj) this.deselectAll();
        this.updateObjectCount();
        break;
      }
    }
  }

  // ─── Object Management ────────────────────────────────────────────

  placeObject(objectDef) {
    let gameObject;
    if (objectDef.texture && this.textures.exists(objectDef.texture)) {
      gameObject = this.add.sprite(objectDef.x, objectDef.y, objectDef.texture, objectDef.frame);
    } else {
      // Create a colored rectangle as placeholder
      const colors = {
        'layer_bg': 0x334455,
        'layer_terrain': 0x556633,
        'layer_objects': 0x666688,
        'layer_collision': 0xff4444,
        'layer_ui': 0x4488ff
      };
      const color = colors[objectDef.layer] || 0x888888;
      gameObject = this.add.rectangle(
        objectDef.x, objectDef.y,
        objectDef.width || this.gridSize,
        objectDef.height || this.gridSize,
        color, 0.7
      );
    }

    gameObject.setData('sceneObjectId', objectDef.id);
    gameObject.setData('objectType', objectDef.type);
    gameObject.setData('objectName', objectDef.name || 'Object');
    gameObject.setData('layer', objectDef.layer);

    if (objectDef.properties) {
      for (const [key, value] of Object.entries(objectDef.properties)) {
        gameObject.setData(key, value);
      }
    }

    // Set depth based on layer
    const layerDef = this.sceneData.layers.find(l => l.id === objectDef.layer);
    gameObject.setDepth((layerDef?.depth || 0) + (objectDef.depth || 0));

    this.placedObjects.push(gameObject);
    this.sceneData.objects.push(objectDef);
    this.updateObjectCount();

    this.pushUndo({
      type: 'place',
      objectId: objectDef.id,
      objectData: objectDef
    });

    this.eventBus.emit('editor:objectPlaced', objectDef);
    return gameObject;
  }

  selectObject(obj) {
    this.selectedObject = obj;
    this.updateSelectionIndicator();
    this.eventBus.emit('editor:objectSelected', {
      id: obj.getData('sceneObjectId'),
      type: obj.getData('objectType'),
      name: obj.getData('objectName'),
      x: obj.x,
      y: obj.y
    });
  }

  deselectAll() {
    this.selectedObject = null;
    this.selectedObjects = [];
    this.selectionRect.clear();
    this.eventBus.emit('editor:deselected');
  }

  deleteSelected() {
    if (!this.selectedObject) return;

    const id = this.selectedObject.getData('sceneObjectId');
    this.pushUndo({
      type: 'delete',
      objectData: this.serializeObject(this.selectedObject)
    });

    const idx = this.placedObjects.indexOf(this.selectedObject);
    if (idx >= 0) this.placedObjects.splice(idx, 1);

    const dataIdx = this.sceneData.objects.findIndex(o => o.id === id);
    if (dataIdx >= 0) this.sceneData.objects.splice(dataIdx, 1);

    this.selectedObject.destroy();
    this.deselectAll();
    this.updateObjectCount();
  }

  updateSelectionIndicator() {
    this.selectionRect.clear();
    if (!this.selectedObject || !this.selectedObject.active) return;

    const bounds = this.selectedObject.getBounds();
    this.selectionRect.lineStyle(2, 0x00ffff, 1);
    this.selectionRect.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);

    // Corner handles
    const handleSize = 6;
    this.selectionRect.fillStyle(0x00ffff, 1);
    this.selectionRect.fillRect(bounds.x - handleSize / 2, bounds.y - handleSize / 2, handleSize, handleSize);
    this.selectionRect.fillRect(bounds.right - handleSize / 2, bounds.y - handleSize / 2, handleSize, handleSize);
    this.selectionRect.fillRect(bounds.x - handleSize / 2, bounds.bottom - handleSize / 2, handleSize, handleSize);
    this.selectionRect.fillRect(bounds.right - handleSize / 2, bounds.bottom - handleSize / 2, handleSize, handleSize);
  }

  serializeObject(gameObject) {
    return {
      id: gameObject.getData('sceneObjectId'),
      type: gameObject.getData('objectType') || 'decor',
      name: gameObject.getData('objectName') || 'Object',
      x: gameObject.x,
      y: gameObject.y,
      width: gameObject.displayWidth || gameObject.width,
      height: gameObject.displayHeight || gameObject.height,
      depth: gameObject.depth,
      layer: gameObject.getData('layer') || 'layer_objects'
    };
  }

  // ─── Tool State ───────────────────────────────────────────────────

  setTool(toolKey) {
    this.currentTool = toolKey;
    this.toolText.setText(`Tool: ${toolKey.charAt(0).toUpperCase() + toolKey.slice(1)}`);

    // Update button highlighting
    for (const btn of this.toolButtons) {
      btn.setColor(btn.getData('toolKey') === toolKey ? '#00ffff' : '#aaaaaa');
    }

    if (toolKey !== 'select') {
      this.deselectAll();
    }
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.drawGrid();
  }

  toggleSnap() {
    this.snapToGrid = !this.snapToGrid;
  }

  // ─── Undo / Redo ──────────────────────────────────────────────────

  pushUndo(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this.redoStack.push(action);

    switch (action.type) {
      case 'place': {
        const idx = this.placedObjects.findIndex(o => o.getData('sceneObjectId') === action.objectId);
        if (idx >= 0) {
          this.placedObjects[idx].destroy();
          this.placedObjects.splice(idx, 1);
        }
        const dataIdx = this.sceneData.objects.findIndex(o => o.id === action.objectId);
        if (dataIdx >= 0) this.sceneData.objects.splice(dataIdx, 1);
        break;
      }
      case 'delete': {
        this.placeObjectWithoutUndo(action.objectData);
        break;
      }
      case 'move': {
        const obj = this.placedObjects.find(o => o.getData('sceneObjectId') === action.objectId);
        if (obj) {
          // Store current position for redo
          action.prevX = obj.x;
          action.prevY = obj.y;
          obj.setPosition(action.x, action.y);
        }
        break;
      }
    }

    this.updateObjectCount();
    this.deselectAll();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.undoStack.push(action);

    switch (action.type) {
      case 'place':
        this.placeObjectWithoutUndo(action.objectData);
        break;
      case 'delete': {
        const idx = this.placedObjects.findIndex(o => o.getData('sceneObjectId') === action.objectData.id);
        if (idx >= 0) {
          this.placedObjects[idx].destroy();
          this.placedObjects.splice(idx, 1);
        }
        break;
      }
    }

    this.updateObjectCount();
  }

  placeObjectWithoutUndo(objectDef) {
    // Same as placeObject but without pushing to undo stack
    const color = 0x888888;
    const gameObject = this.add.rectangle(
      objectDef.x, objectDef.y,
      objectDef.width || this.gridSize,
      objectDef.height || this.gridSize,
      color, 0.7
    );

    gameObject.setData('sceneObjectId', objectDef.id);
    gameObject.setData('objectType', objectDef.type);
    gameObject.setData('objectName', objectDef.name || 'Object');
    gameObject.setData('layer', objectDef.layer);
    gameObject.setDepth(objectDef.depth || 0);

    this.placedObjects.push(gameObject);
    if (!this.sceneData.objects.find(o => o.id === objectDef.id)) {
      this.sceneData.objects.push(objectDef);
    }
  }

  // ─── Save / Load ──────────────────────────────────────────────────

  saveScene() {
    // Update scene data from placed objects
    this.sceneData.objects = this.placedObjects
      .filter(o => o.active)
      .map(o => this.serializeObject(o));

    this.sceneData.metadata.modified = Date.now();

    const json = JSON.stringify(this.sceneData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.sceneData.metadata.name.replace(/\s+/g, '_').toLowerCase()}.scene.json`;
    link.click();
    URL.revokeObjectURL(link.href);

    this.eventBus.emit('editor:saved', { name: this.sceneData.metadata.name });
    console.log('EditorScene: Scene saved');
  }

  loadScenePrompt() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.scene.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        this.loadSceneData(data);
      } catch (err) {
        console.error('EditorScene: Invalid scene file:', err.message);
      }
    };
    input.click();
  }

  loadSceneData(data) {
    // Clear existing objects
    for (const obj of this.placedObjects) {
      obj.destroy();
    }
    this.placedObjects = [];
    this.deselectAll();
    this.undoStack = [];
    this.redoStack = [];

    this.sceneData = data;

    // Recreate objects
    if (data.objects) {
      for (const objDef of data.objects) {
        this.placeObjectWithoutUndo(objDef);
      }
    }

    // Apply camera
    if (data.camera) {
      if (data.camera.x !== undefined) this.editorCamera.scrollX = data.camera.x;
      if (data.camera.y !== undefined) this.editorCamera.scrollY = data.camera.y;
      if (data.camera.zoom) this.editorCamera.setZoom(data.camera.zoom);
    }

    this.updateObjectCount();
    this.drawGrid();

    this.infoText.setText(`Editing: ${data.metadata?.name || 'Untitled'}`);
    this.eventBus.emit('editor:loaded', { name: data.metadata?.name });
    console.log(`EditorScene: Loaded scene '${data.metadata?.name}'`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  updateObjectCount() {
    const count = this.placedObjects.filter(o => o.active).length;
    this.objectCountText.setText(`Objects: ${count}`);
  }

  // ─── Update Loop ──────────────────────────────────────────────────

  update(time, delta) {
    // Redraw grid on camera movement
    if (this.isPanning) {
      this.drawGrid();
    }

    // Update selection indicator position
    if (this.selectedObject && this.selectedObject.active) {
      this.updateSelectionIndicator();
    }
  }
}

export default EditorScene;
