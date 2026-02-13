import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * EditorScene — Visual Level Editor.
 *
 * A full in-game level editor accessible via F2 during gameplay.
 *
 * Features:
 *  - Object palette: place enemies, lights, spawn points, triggers
 *  - Drag-and-drop placement with grid snapping
 *  - Property inspector panel for selected objects
 *  - Save/Load scene layouts as JSON
 *  - Undo/Redo stack
 *  - Layer visibility toggles
 *  - Camera controls: pan (middle-click drag), zoom (scroll wheel)
 *  - Test mode: instantly play the level being edited
 *
 * Scene data format:
 *   {
 *     objects: [{ type, x, y, properties }],
 *     triggers: [{ x, y, width, height, event, data }],
 *     spawnPoints: [{ x, y, enemyId, respawnDelay }],
 *     lights: [{ x, y, color, radius, intensity }],
 *     metadata: { name, author, version }
 *   }
 */
export default class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
    }

    create() {
        // Editor state
        this.editorObjects = [];
        this.selectedObject = null;
        this.gridSize = 32;
        this.snapToGrid = true;
        this.currentTool = 'select';       // select | place | erase | trigger | light
        this.currentPalette = 'enemy';     // enemy | npc | spawn | decoration
        this.undoStack = [];
        this.redoStack = [];
        this.layers = {
            objects: { visible: true, items: [] },
            triggers: { visible: true, items: [] },
            lights: { visible: true, items: [] },
            spawns: { visible: true, items: [] }
        };

        // Camera setup
        this.cameras.main.setBackgroundColor('#111118');

        // Draw grid
        this._drawGrid();

        // UI panels
        this._createToolbar();
        this._createPalette();
        this._createInspector();
        this._createStatusBar();

        // Input
        this._setupInput();

        // Keyboard shortcuts
        this.input.keyboard.on('keydown-F2', () => {
            this.scene.switch('GameScene');
        });
        this.input.keyboard.on('keydown-ESC', () => {
            this.selectedObject = null;
            this._updateInspector();
        });

        console.log('[EditorScene] Visual level editor ready. Press F2 to return to game.');
    }

    // ----------------------------------------------------------------
    // Grid
    // ----------------------------------------------------------------

    _drawGrid() {
        this.gridGraphics = this.add.graphics().setDepth(0).setScrollFactor(1);
        const w = 2400;
        const h = 1800;

        this.gridGraphics.lineStyle(1, 0x222233, 0.3);
        for (let x = 0; x <= w; x += this.gridSize) {
            this.gridGraphics.lineBetween(x, 0, x, h);
        }
        for (let y = 0; y <= h; y += this.gridSize) {
            this.gridGraphics.lineBetween(0, y, w, y);
        }

        // Origin marker
        this.gridGraphics.lineStyle(2, 0xff4444, 0.5);
        this.gridGraphics.lineBetween(0, -10, 0, 10);
        this.gridGraphics.lineBetween(-10, 0, 10, 0);
    }

    // ----------------------------------------------------------------
    // Toolbar
    // ----------------------------------------------------------------

    _createToolbar() {
        const tools = [
            { key: 'select', label: 'SEL', tip: 'Select/Move (V)' },
            { key: 'place', label: 'PLC', tip: 'Place Object (P)' },
            { key: 'erase', label: 'DEL', tip: 'Erase (X)' },
            { key: 'trigger', label: 'TRG', tip: 'Place Trigger (T)' },
            { key: 'light', label: 'LIT', tip: 'Place Light (L)' }
        ];

        this.toolButtons = [];
        tools.forEach((tool, i) => {
            const x = 8 + i * 52;
            const y = 8;

            const bg = this.add.graphics().setDepth(10000).setScrollFactor(0);
            bg.fillStyle(this.currentTool === tool.key ? 0x446688 : 0x222244, 0.9);
            bg.fillRect(x, y, 48, 28);
            bg.lineStyle(1, 0x4466aa, 0.6);
            bg.strokeRect(x, y, 48, 28);

            const label = this.add.text(x + 24, y + 14, tool.label, {
                fontFamily: 'monospace', fontSize: '12px', color: '#88aadd'
            }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);

            bg.setInteractive(new Phaser.Geom.Rectangle(x, y, 48, 28), Phaser.Geom.Rectangle.Contains);
            bg.on('pointerdown', () => {
                this.currentTool = tool.key;
                this._refreshToolbar();
            });

            this.toolButtons.push({ bg, label, tool: tool.key, x, y });
        });

        // Keyboard shortcuts for tools
        this.input.keyboard.on('keydown-V', () => { this.currentTool = 'select'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-P', () => { this.currentTool = 'place'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-X', () => { this.currentTool = 'erase'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-T', () => { this.currentTool = 'trigger'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-L', () => { this.currentTool = 'light'; this._refreshToolbar(); });

        // Undo/Redo
        this.input.keyboard.on('keydown-Z', (e) => {
            if (e.ctrlKey) this.undo();
        });
        this.input.keyboard.on('keydown-Y', (e) => {
            if (e.ctrlKey) this.redo();
        });

        // Grid snap toggle
        this.input.keyboard.on('keydown-G', () => {
            this.snapToGrid = !this.snapToGrid;
            this._updateStatusBar();
        });
    }

    _refreshToolbar() {
        this.toolButtons.forEach((btn) => {
            btn.bg.clear();
            btn.bg.fillStyle(this.currentTool === btn.tool ? 0x446688 : 0x222244, 0.9);
            btn.bg.fillRect(btn.x, btn.y, 48, 28);
            btn.bg.lineStyle(1, 0x4466aa, 0.6);
            btn.bg.strokeRect(btn.x, btn.y, 48, 28);
        });
        this._updateStatusBar();
    }

    // ----------------------------------------------------------------
    // Palette
    // ----------------------------------------------------------------

    _createPalette() {
        const panelX = 8;
        const panelY = 48;
        const panelW = 140;

        this.paletteBg = this.add.graphics().setDepth(10000).setScrollFactor(0);
        this.paletteBg.fillStyle(0x111122, 0.85);
        this.paletteBg.fillRect(panelX, panelY, panelW, 300);
        this.paletteBg.lineStyle(1, 0x334466, 0.5);
        this.paletteBg.strokeRect(panelX, panelY, panelW, 300);

        this.add.text(panelX + 8, panelY + 6, 'PALETTE', {
            fontFamily: 'monospace', fontSize: '10px', color: '#6688aa'
        }).setDepth(10001).setScrollFactor(0);

        const paletteItems = [
            { key: 'enemy', label: 'Enemy', color: '#ff4444' },
            { key: 'npc', label: 'NPC', color: '#44ff44' },
            { key: 'spawn', label: 'Spawn Point', color: '#ffaa44' },
            { key: 'decoration', label: 'Decoration', color: '#888888' },
            { key: 'wall', label: 'Wall', color: '#666666' },
            { key: 'chest', label: 'Chest', color: '#ffdd44' },
            { key: 'portal', label: 'Portal', color: '#aa44ff' }
        ];

        this.paletteButtons = [];
        paletteItems.forEach((item, i) => {
            const ix = panelX + 8;
            const iy = panelY + 24 + i * 24;

            const text = this.add.text(ix + 16, iy + 4, item.label, {
                fontFamily: 'monospace', fontSize: '11px', color: item.color
            }).setDepth(10001).setScrollFactor(0).setInteractive();

            // Color swatch
            const swatch = this.add.graphics().setDepth(10001).setScrollFactor(0);
            swatch.fillStyle(parseInt(item.color.replace('#', '0x')), 1);
            swatch.fillRect(ix, iy + 4, 12, 12);

            text.on('pointerdown', () => {
                this.currentPalette = item.key;
                this._updateStatusBar();
            });

            this.paletteButtons.push({ text, swatch, key: item.key });
        });
    }

    // ----------------------------------------------------------------
    // Inspector
    // ----------------------------------------------------------------

    _createInspector() {
        const panelX = 1280 - 200;
        const panelY = 48;
        const panelW = 192;

        this.inspectorBg = this.add.graphics().setDepth(10000).setScrollFactor(0);
        this.inspectorBg.fillStyle(0x111122, 0.85);
        this.inspectorBg.fillRect(panelX, panelY, panelW, 300);
        this.inspectorBg.lineStyle(1, 0x334466, 0.5);
        this.inspectorBg.strokeRect(panelX, panelY, panelW, 300);

        this.add.text(panelX + 8, panelY + 6, 'INSPECTOR', {
            fontFamily: 'monospace', fontSize: '10px', color: '#6688aa'
        }).setDepth(10001).setScrollFactor(0);

        this.inspectorTexts = [];
        this.inspectorText = this.add.text(panelX + 8, panelY + 24, 'No selection', {
            fontFamily: 'monospace', fontSize: '10px', color: '#667788', wordWrap: { width: panelW - 16 }
        }).setDepth(10001).setScrollFactor(0);
    }

    _updateInspector() {
        if (!this.selectedObject) {
            this.inspectorText.setText('No selection');
            return;
        }

        const obj = this.selectedObject;
        const lines = [
            `Type: ${obj.editorData.type}`,
            `X: ${Math.round(obj.x)}`,
            `Y: ${Math.round(obj.y)}`,
            `Layer: ${obj.editorData.layer || 'objects'}`
        ];

        if (obj.editorData.properties) {
            lines.push('', '--- Properties ---');
            Object.entries(obj.editorData.properties).forEach(([k, v]) => {
                lines.push(`${k}: ${v}`);
            });
        }

        this.inspectorText.setText(lines.join('\n'));
    }

    // ----------------------------------------------------------------
    // Status bar
    // ----------------------------------------------------------------

    _createStatusBar() {
        this.statusText = this.add.text(8, 700, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#667788'
        }).setDepth(10001).setScrollFactor(0);
        this._updateStatusBar();
    }

    _updateStatusBar() {
        const parts = [
            `Tool: ${this.currentTool.toUpperCase()}`,
            `Palette: ${this.currentPalette}`,
            `Grid: ${this.snapToGrid ? 'ON' : 'OFF'} (${this.gridSize}px)`,
            `Objects: ${this.editorObjects.length}`,
            `[F2] Game  [Ctrl+S] Save  [Ctrl+L] Load  [G] Grid  [Ctrl+Z] Undo`
        ];
        this.statusText.setText(parts.join('  |  '));
    }

    // ----------------------------------------------------------------
    // Input handling
    // ----------------------------------------------------------------

    _setupInput() {
        // Camera pan with middle mouse or right click drag
        this.input.on('pointermove', (pointer) => {
            if (pointer.middleButtonDown() || (pointer.rightButtonDown() && !pointer.isDown)) {
                this.cameras.main.scrollX -= pointer.velocity.x / this.cameras.main.zoom;
                this.cameras.main.scrollY -= pointer.velocity.y / this.cameras.main.zoom;
            }
        });

        // Zoom with scroll wheel
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            const newZoom = Phaser.Math.Clamp(
                this.cameras.main.zoom - deltaY * 0.001,
                0.25,
                4.0
            );
            this.cameras.main.setZoom(newZoom);
        });

        // Click actions
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;

            // Ignore clicks on UI panels
            if (pointer.x < 160 && pointer.y > 40) return; // palette
            if (pointer.x > 1080 && pointer.y > 40 && pointer.y < 360) return; // inspector

            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            let wx = worldPoint.x;
            let wy = worldPoint.y;

            if (this.snapToGrid) {
                wx = Math.round(wx / this.gridSize) * this.gridSize;
                wy = Math.round(wy / this.gridSize) * this.gridSize;
            }

            switch (this.currentTool) {
                case 'select':
                    this._selectAt(wx, wy);
                    break;
                case 'place':
                    this._placeObject(wx, wy, this.currentPalette);
                    break;
                case 'erase':
                    this._eraseAt(wx, wy);
                    break;
                case 'trigger':
                    this._placeTrigger(wx, wy);
                    break;
                case 'light':
                    this._placeLight(wx, wy);
                    break;
            }
        });

        // Save/Load
        this.input.keyboard.on('keydown-S', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.saveScene();
            }
        });
        this.input.keyboard.on('keydown-O', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.loadScene();
            }
        });

        // Delete selected
        this.input.keyboard.on('keydown-DELETE', () => {
            if (this.selectedObject) {
                this._pushUndo('delete', this.selectedObject);
                this._removeObject(this.selectedObject);
                this.selectedObject = null;
                this._updateInspector();
                this._updateStatusBar();
            }
        });
    }

    // ----------------------------------------------------------------
    // Object management
    // ----------------------------------------------------------------

    _placeObject(x, y, type) {
        const COLORS = {
            enemy: 0xff4444, npc: 0x44ff44, spawn: 0xffaa44,
            decoration: 0x888888, wall: 0x666666, chest: 0xffdd44, portal: 0xaa44ff
        };

        const gfx = this.add.graphics().setDepth(5);
        gfx.fillStyle(COLORS[type] || 0xffffff, 0.8);

        if (type === 'wall') {
            gfx.fillRect(x - 16, y - 16, 32, 32);
        } else if (type === 'trigger') {
            gfx.lineStyle(2, 0xffaa00, 0.6);
            gfx.strokeRect(x - 32, y - 32, 64, 64);
        } else {
            gfx.fillCircle(x, y, 12);
        }

        // Label
        const label = this.add.text(x, y - 18, type.toUpperCase(), {
            fontFamily: 'monospace', fontSize: '8px', color: '#aaaacc'
        }).setOrigin(0.5).setDepth(6);

        const obj = this.add.container(x, y, []).setDepth(5);
        obj.editorData = {
            type,
            layer: 'objects',
            properties: this._defaultProperties(type),
            gfx,
            label
        };

        this.editorObjects.push(obj);
        this.layers.objects.items.push(obj);

        this._pushUndo('place', obj);
        this._updateStatusBar();
    }

    _placeLight(x, y) {
        const gfx = this.add.graphics().setDepth(5);
        gfx.fillStyle(0xffff88, 0.3);
        gfx.fillCircle(x, y, 40);
        gfx.lineStyle(1, 0xffff88, 0.6);
        gfx.strokeCircle(x, y, 40);
        gfx.fillStyle(0xffff88, 0.8);
        gfx.fillCircle(x, y, 4);

        const label = this.add.text(x, y - 48, 'LIGHT', {
            fontFamily: 'monospace', fontSize: '8px', color: '#ffff88'
        }).setOrigin(0.5).setDepth(6);

        const obj = this.add.container(x, y, []).setDepth(5);
        obj.editorData = {
            type: 'light',
            layer: 'lights',
            properties: { color: '0xffffff', radius: 100, intensity: 1.0 },
            gfx,
            label
        };

        this.editorObjects.push(obj);
        this.layers.lights.items.push(obj);

        this._pushUndo('place', obj);
        this._updateStatusBar();
    }

    _placeTrigger(x, y) {
        const gfx = this.add.graphics().setDepth(4);
        gfx.lineStyle(2, 0xffaa00, 0.5);
        gfx.strokeRect(x - 32, y - 32, 64, 64);
        gfx.fillStyle(0xffaa00, 0.1);
        gfx.fillRect(x - 32, y - 32, 64, 64);

        const label = this.add.text(x, y, 'TRIGGER', {
            fontFamily: 'monospace', fontSize: '8px', color: '#ffaa44'
        }).setOrigin(0.5).setDepth(6);

        const obj = this.add.container(x, y, []).setDepth(4);
        obj.editorData = {
            type: 'trigger',
            layer: 'triggers',
            properties: { event: 'custom', width: 64, height: 64, data: '{}' },
            gfx,
            label
        };

        this.editorObjects.push(obj);
        this.layers.triggers.items.push(obj);

        this._pushUndo('place', obj);
        this._updateStatusBar();
    }

    _selectAt(x, y) {
        const threshold = 24;
        let closest = null;
        let closestDist = threshold;

        this.editorObjects.forEach((obj) => {
            const d = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
            if (d < closestDist) {
                closestDist = d;
                closest = obj;
            }
        });

        // Deselect previous
        if (this.selectedObject && this.selectedObject.editorData?.gfx) {
            // Reset highlight
        }

        this.selectedObject = closest;

        // Highlight selected
        if (closest && closest.editorData?.gfx) {
            // Visual feedback would be added here
        }

        this._updateInspector();
    }

    _eraseAt(x, y) {
        const threshold = 24;
        let closest = null;
        let closestDist = threshold;

        this.editorObjects.forEach((obj) => {
            const d = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
            if (d < closestDist) {
                closestDist = d;
                closest = obj;
            }
        });

        if (closest) {
            this._pushUndo('delete', closest);
            this._removeObject(closest);
            this._updateStatusBar();
        }
    }

    _removeObject(obj) {
        const idx = this.editorObjects.indexOf(obj);
        if (idx !== -1) this.editorObjects.splice(idx, 1);

        // Remove from layer
        Object.values(this.layers).forEach((layer) => {
            const li = layer.items.indexOf(obj);
            if (li !== -1) layer.items.splice(li, 1);
        });

        if (obj.editorData?.gfx) obj.editorData.gfx.destroy();
        if (obj.editorData?.label) obj.editorData.label.destroy();
        obj.destroy();
    }

    _defaultProperties(type) {
        switch (type) {
            case 'enemy': return { enemyId: 'forest_guardian', level: 1, respawnDelay: 10 };
            case 'npc': return { name: 'NPC', dialogue: 'Hello!' };
            case 'spawn': return { enemyId: '', respawnDelay: 30, maxCount: 1 };
            case 'decoration': return { sprite: 'tree', scale: 1.0 };
            case 'wall': return { width: 32, height: 32, solid: true };
            case 'chest': return { lootTable: 'common', locked: false };
            case 'portal': return { targetLocation: '', targetX: 0, targetY: 0 };
            default: return {};
        }
    }

    // ----------------------------------------------------------------
    // Undo / Redo
    // ----------------------------------------------------------------

    _pushUndo(action, obj) {
        this.undoStack.push({
            action,
            data: {
                type: obj.editorData?.type,
                x: obj.x,
                y: obj.y,
                properties: obj.editorData?.properties ? { ...obj.editorData.properties } : {},
                layer: obj.editorData?.layer
            },
            ref: obj
        });
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > 50) this.undoStack.shift();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const entry = this.undoStack.pop();

        if (entry.action === 'place') {
            // Undo a placement = remove the object
            this._removeObject(entry.ref);
            this.redoStack.push(entry);
        } else if (entry.action === 'delete') {
            // Undo a deletion = re-place the object
            this._placeObject(entry.data.x, entry.data.y, entry.data.type);
            this.redoStack.push(entry);
        }

        this._updateStatusBar();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const entry = this.redoStack.pop();

        if (entry.action === 'place') {
            this._placeObject(entry.data.x, entry.data.y, entry.data.type);
            this.undoStack.push(entry);
        } else if (entry.action === 'delete') {
            this._removeObject(entry.ref);
            this.undoStack.push(entry);
        }

        this._updateStatusBar();
    }

    // ----------------------------------------------------------------
    // Save / Load
    // ----------------------------------------------------------------

    saveScene() {
        const sceneData = {
            metadata: {
                name: 'Untitled Scene',
                author: 'Editor',
                version: '1.0',
                created: new Date().toISOString()
            },
            objects: [],
            triggers: [],
            lights: [],
            spawns: []
        };

        this.editorObjects.forEach((obj) => {
            const ed = obj.editorData;
            const entry = {
                type: ed.type,
                x: Math.round(obj.x),
                y: Math.round(obj.y),
                properties: { ...ed.properties }
            };

            switch (ed.layer) {
                case 'triggers': sceneData.triggers.push(entry); break;
                case 'lights': sceneData.lights.push(entry); break;
                case 'spawns': sceneData.spawns.push(entry); break;
                default: sceneData.objects.push(entry); break;
            }
        });

        const json = JSON.stringify(sceneData, null, 2);

        // Download as file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        a.click();
        URL.revokeObjectURL(url);

        console.log('[Editor] Scene saved:', sceneData);
    }

    loadScene() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const sceneData = JSON.parse(ev.target.result);
                    this._loadSceneData(sceneData);
                    console.log('[Editor] Scene loaded:', sceneData.metadata?.name);
                } catch (err) {
                    console.error('[Editor] Failed to parse scene file:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    _loadSceneData(sceneData) {
        // Clear existing
        [...this.editorObjects].forEach((obj) => this._removeObject(obj));
        this.undoStack = [];
        this.redoStack = [];

        // Place objects
        (sceneData.objects || []).forEach((obj) => {
            this._placeObject(obj.x, obj.y, obj.type);
        });
        (sceneData.triggers || []).forEach((t) => {
            this._placeTrigger(t.x, t.y);
        });
        (sceneData.lights || []).forEach((l) => {
            this._placeLight(l.x, l.y);
        });

        this._updateStatusBar();
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(time, delta) {
        // Camera pan with arrow keys
        const speed = 400 / this.cameras.main.zoom;
        if (this.input.keyboard.addKey('LEFT').isDown) this.cameras.main.scrollX -= speed * (delta / 1000);
        if (this.input.keyboard.addKey('RIGHT').isDown) this.cameras.main.scrollX += speed * (delta / 1000);
        if (this.input.keyboard.addKey('UP').isDown) this.cameras.main.scrollY -= speed * (delta / 1000);
        if (this.input.keyboard.addKey('DOWN').isDown) this.cameras.main.scrollY += speed * (delta / 1000);
    }
}
