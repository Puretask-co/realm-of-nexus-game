/**
 * EditorScene.js
 * Visual level editor for "Realm of Nexus".
 * Provides grid overlay, object placement, selection, undo/redo,
 * save/load, and an HTML-based toolbar + object palette.
 */

/** @typedef {'SELECT'|'MOVE'|'DELETE'|'PLACE'} EditorMode */

/**
 * @typedef {Object} SceneObjectData
 * @property {string}  id   - Unique identifier.
 * @property {string}  type - Object type (e.g. 'Player', 'Enemy').
 * @property {number}  x    - World X position.
 * @property {number}  y    - World Y position.
 * @property {Object}  [properties] - Arbitrary key/value pairs.
 */

export default class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });

        // ---- Editor state ----
        /** @type {EditorMode} */
        this.mode = 'SELECT';
        /** @type {Phaser.GameObjects.GameObject[]} */
        this.selectedObjects = [];
        /** @type {boolean} */
        this.gridEnabled = true;
        /** @type {number} */
        this.gridSize = 32;
        /** @type {boolean} */
        this.snapToGridEnabled = true;

        /** @type {Object[]} */
        this.undoStack = [];
        /** @type {Object[]} */
        this.redoStack = [];

        // ---- Scene data model ----
        this.sceneData = {
            objects: [],
            metadata: {
                name: 'Untitled',
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            }
        };

        // ---- Internals ----
        this.gridGraphics = null;
        this.selectionBoxes = [];
        this.isPanning = false;
        this.lastPointer = { x: 0, y: 0 };
        this.nextObjectId = 1;

        // DOM element references (cleaned up in shutdown)
        this.toolbarEl = null;
        this.paletteEl = null;
    }

    // ================================================================
    // Phaser lifecycle
    // ================================================================

    /**
     * Called before create(). Resets transient editor state so the
     * scene can be restarted cleanly.
     */
    init() {
        this.mode = 'SELECT';
        this.selectedObjects = [];
        this.gridEnabled = true;
        this.gridSize = 32;
        this.snapToGridEnabled = true;
        this.undoStack = [];
        this.redoStack = [];
        this.sceneData = {
            objects: [],
            metadata: {
                name: 'Untitled',
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            }
        };
        this.selectionBoxes = [];
        this.isPanning = false;
        this.nextObjectId = 1;
    }

    /**
     * Main setup — grid, input handlers, keyboard shortcuts,
     * HTML toolbar and palette.
     */
    create() {
        // ---- Grid overlay ----
        this.gridGraphics = this.add.graphics();
        this.drawGrid();

        // ---- Pointer input ----
        this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
        this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
        this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));

        // ---- Mouse wheel zoom ----
        this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
            const cam = this.cameras.main;
            const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.25, 4);
            cam.setZoom(newZoom);
        });

        // ---- Keyboard shortcuts ----
        this.input.keyboard.on('keydown-DELETE', () => this.deleteSelected());

        this.input.keyboard.on('keydown-Z', (event) => {
            if (event.ctrlKey) this.undo();
        });

        this.input.keyboard.on('keydown-Y', (event) => {
            if (event.ctrlKey) this.redo();
        });

        this.input.keyboard.on('keydown-D', (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
                this.duplicateSelected();
            }
        });

        // ---- HTML UI ----
        this.createToolbar();
        this.createPalette();

        console.log('[EditorScene] Editor ready.');
    }

    /**
     * Per-frame update.  Keeps selection highlight boxes in sync with
     * the objects they represent.
     */
    update() {
        // Update selection box positions
        this.selectionBoxes.forEach((box, index) => {
            const obj = this.selectedObjects[index];
            if (obj && box) {
                box.setPosition(obj.x, obj.y);
            }
        });
    }

    /**
     * Called when the scene is shut down or restarted.
     * Removes any DOM elements we injected.
     */
    shutdown() {
        if (this.toolbarEl && this.toolbarEl.parentNode) {
            this.toolbarEl.parentNode.removeChild(this.toolbarEl);
            this.toolbarEl = null;
        }
        if (this.paletteEl && this.paletteEl.parentNode) {
            this.paletteEl.parentNode.removeChild(this.paletteEl);
            this.paletteEl = null;
        }
    }

    // ================================================================
    // Grid
    // ================================================================

    /**
     * Renders the grid overlay based on current gridSize and camera.
     */
    drawGrid() {
        this.gridGraphics.clear();
        if (!this.gridEnabled) return;

        const cam = this.cameras.main;
        const width = cam.width / cam.zoom;
        const height = cam.height / cam.zoom;
        const startX = Math.floor(cam.scrollX / this.gridSize) * this.gridSize;
        const startY = Math.floor(cam.scrollY / this.gridSize) * this.gridSize;

        this.gridGraphics.lineStyle(1, 0x444444, 0.3);

        for (let x = startX; x < startX + width + this.gridSize; x += this.gridSize) {
            this.gridGraphics.lineBetween(x, startY, x, startY + height + this.gridSize);
        }
        for (let y = startY; y < startY + height + this.gridSize; y += this.gridSize) {
            this.gridGraphics.lineBetween(startX, y, startX + width + this.gridSize, y);
        }
    }

    // ================================================================
    // Pointer handlers
    // ================================================================

    /**
     * @param {Phaser.Input.Pointer} pointer
     */
    onPointerDown(pointer) {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;

        // Right-click starts panning
        if (pointer.rightButtonDown()) {
            this.isPanning = true;
            this.lastPointer.x = pointer.x;
            this.lastPointer.y = pointer.y;
            return;
        }

        switch (this.mode) {
            case 'SELECT':
                this.handleSelect(worldX, worldY);
                break;
            case 'MOVE':
                this.handleSelect(worldX, worldY);
                break;
            case 'DELETE':
                this.handleDeleteAtPoint(worldX, worldY);
                break;
            case 'PLACE':
                // Placement is handled via palette drag; clicking in PLACE
                // mode with no dragged type does nothing.
                break;
        }
    }

    /**
     * @param {Phaser.Input.Pointer} pointer
     */
    onPointerMove(pointer) {
        // Right-click drag panning
        if (this.isPanning && pointer.rightButtonDown()) {
            const cam = this.cameras.main;
            const dx = (this.lastPointer.x - pointer.x) / cam.zoom;
            const dy = (this.lastPointer.y - pointer.y) / cam.zoom;
            cam.scrollX += dx;
            cam.scrollY += dy;
            this.lastPointer.x = pointer.x;
            this.lastPointer.y = pointer.y;
            this.drawGrid();
            return;
        }

        // Move mode — drag selected objects
        if (this.mode === 'MOVE' && pointer.isDown && this.selectedObjects.length > 0) {
            const dx = pointer.worldX - pointer.prevPosition.x;
            const dy = pointer.worldY - pointer.prevPosition.y;
            this.selectedObjects.forEach((obj) => {
                obj.x += dx;
                obj.y += dy;
            });
        }
    }

    /**
     * @param {Phaser.Input.Pointer} pointer
     */
    onPointerUp(pointer) {
        if (this.isPanning) {
            this.isPanning = false;
        }

        // If we were moving, snap and record undo
        if (this.mode === 'MOVE' && this.selectedObjects.length > 0) {
            if (this.snapToGridEnabled) {
                this.selectedObjects.forEach((obj) => {
                    const snapped = this.snapToGrid(obj.x, obj.y);
                    obj.x = snapped.x;
                    obj.y = snapped.y;
                });
            }
            this.recordUndo();
        }
    }

    /**
     * Attempt to select an object at the given world coordinates.
     * @param {number} worldX
     * @param {number} worldY
     */
    handleSelect(worldX, worldY) {
        const hit = this.getObjectAtPoint(worldX, worldY);
        if (hit) {
            this.selectObject(hit);
        } else {
            this.clearSelection();
        }
    }

    /**
     * Delete any object found at the given world coordinates.
     * @param {number} worldX
     * @param {number} worldY
     */
    handleDeleteAtPoint(worldX, worldY) {
        const hit = this.getObjectAtPoint(worldX, worldY);
        if (hit) {
            this.selectObject(hit);
            this.deleteSelected();
        }
    }

    /**
     * Returns the first editor-managed object whose bounds contain
     * the given point, or null.
     * @param {number} x
     * @param {number} y
     * @returns {Phaser.GameObjects.GameObject|null}
     */
    getObjectAtPoint(x, y) {
        // Iterate in reverse so the topmost object wins
        for (let i = this.sceneData.objects.length - 1; i >= 0; i--) {
            const entry = this.sceneData.objects[i];
            const obj = entry._gameObject;
            if (!obj) continue;
            const bounds = obj.getBounds();
            if (bounds.contains(x, y)) return obj;
        }
        return null;
    }

    // ================================================================
    // Object management
    // ================================================================

    /**
     * Place a new object into the scene.
     * @param {string} type - Object type label (e.g. 'Player', 'Enemy').
     * @param {number} x    - World X position.
     * @param {number} y    - World Y position.
     * @returns {Phaser.GameObjects.GameObject} The created game object.
     */
    placeObject(type, x, y) {
        // Snap if enabled
        if (this.snapToGridEnabled) {
            const snapped = this.snapToGrid(x, y);
            x = snapped.x;
            y = snapped.y;
        }

        // Visual representation — simple colored rectangle per type
        const colorMap = {
            Player: 0x3399ff,
            Enemy: 0xff3333,
            NPC: 0x33cc66,
            Tree: 0x228b22,
            Rock: 0x888888,
            Light: 0xffee88,
            Trigger: 0xcc66ff
        };
        const color = colorMap[type] || 0xffffff;
        const size = (type === 'Tree') ? 48 : 32;

        const rect = this.add.rectangle(x, y, size, size, color);
        rect.setStrokeStyle(1, 0xffffff, 0.6);

        // Label
        const label = this.add.text(x, y - size / 2 - 10, type, {
            fontSize: '10px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Data entry
        const id = `obj_${this.nextObjectId++}`;
        const entry = {
            id,
            type,
            x,
            y,
            properties: {},
            _gameObject: rect,
            _label: label
        };

        this.sceneData.objects.push(entry);
        this.sceneData.metadata.modified = new Date().toISOString();

        // Make the rectangle interactive for selection
        rect.setInteractive();
        rect.setData('entryId', id);

        this.recordUndo();
        console.log(`[EditorScene] Placed ${type} at (${x}, ${y}).`);
        return rect;
    }

    /**
     * Mark a game object as selected.
     * @param {Phaser.GameObjects.GameObject} gameObject
     */
    selectObject(gameObject) {
        this.clearSelection();
        this.selectedObjects.push(gameObject);

        // Draw highlight box
        const bounds = gameObject.getBounds();
        const highlight = this.add.rectangle(
            gameObject.x, gameObject.y,
            bounds.width + 4, bounds.height + 4
        );
        highlight.setStrokeStyle(2, 0x00ffff, 1);
        highlight.isFilled = false;
        this.selectionBoxes.push(highlight);
    }

    /**
     * Clear the current selection and remove highlight boxes.
     */
    clearSelection() {
        this.selectionBoxes.forEach((box) => box.destroy());
        this.selectionBoxes = [];
        this.selectedObjects = [];
    }

    /**
     * Delete all currently selected objects from the scene and data model.
     */
    deleteSelected() {
        if (this.selectedObjects.length === 0) return;

        this.recordUndo();

        this.selectedObjects.forEach((obj) => {
            const id = obj.getData('entryId');
            const index = this.sceneData.objects.findIndex((e) => e.id === id);
            if (index !== -1) {
                const entry = this.sceneData.objects[index];
                if (entry._label) entry._label.destroy();
                this.sceneData.objects.splice(index, 1);
            }
            obj.destroy();
        });

        this.clearSelection();
        this.sceneData.metadata.modified = new Date().toISOString();
        console.log('[EditorScene] Deleted selected object(s).');
    }

    /**
     * Duplicate the currently selected objects offset by one grid cell.
     */
    duplicateSelected() {
        if (this.selectedObjects.length === 0) return;

        const newObjects = [];
        this.selectedObjects.forEach((obj) => {
            const id = obj.getData('entryId');
            const entry = this.sceneData.objects.find((e) => e.id === id);
            if (entry) {
                const newObj = this.placeObject(
                    entry.type,
                    entry.x + this.gridSize,
                    entry.y + this.gridSize
                );
                newObjects.push(newObj);
            }
        });

        // Select the duplicates
        this.clearSelection();
        newObjects.forEach((obj) => this.selectObject(obj));
    }

    // ================================================================
    // Undo / Redo
    // ================================================================

    /**
     * Take a snapshot of the current scene data and push it onto the
     * undo stack.  Clears the redo stack.
     */
    recordUndo() {
        const snapshot = this.serializeSceneData();
        this.undoStack.push(snapshot);
        this.redoStack = [];
    }

    /**
     * Revert to the previous snapshot.
     */
    undo() {
        if (this.undoStack.length === 0) return;
        const current = this.serializeSceneData();
        this.redoStack.push(current);
        const previous = this.undoStack.pop();
        this.restoreSceneData(previous);
        console.log('[EditorScene] Undo.');
    }

    /**
     * Re-apply the last undone snapshot.
     */
    redo() {
        if (this.redoStack.length === 0) return;
        const current = this.serializeSceneData();
        this.undoStack.push(current);
        const next = this.redoStack.pop();
        this.restoreSceneData(next);
        console.log('[EditorScene] Redo.');
    }

    /**
     * Serialize the scene data (without internal references) to a
     * plain JSON string.
     * @returns {string}
     */
    serializeSceneData() {
        const stripped = this.sceneData.objects.map((entry) => ({
            id: entry.id,
            type: entry.type,
            x: entry._gameObject ? entry._gameObject.x : entry.x,
            y: entry._gameObject ? entry._gameObject.y : entry.y,
            properties: { ...entry.properties }
        }));
        return JSON.stringify({
            objects: stripped,
            metadata: { ...this.sceneData.metadata }
        });
    }

    /**
     * Destroy all current objects and rebuild from a serialized snapshot.
     * @param {string} json
     */
    restoreSceneData(json) {
        // Destroy existing objects
        this.clearSelection();
        this.sceneData.objects.forEach((entry) => {
            if (entry._gameObject) entry._gameObject.destroy();
            if (entry._label) entry._label.destroy();
        });
        this.sceneData.objects = [];

        const data = JSON.parse(json);
        this.sceneData.metadata = data.metadata;

        data.objects.forEach((obj) => {
            this.placeObject(obj.type, obj.x, obj.y);
        });
    }

    // ================================================================
    // Save / Open
    // ================================================================

    /**
     * Serialize all objects to JSON and trigger a file download.
     */
    saveScene() {
        const json = this.serializeSceneData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this.sceneData.metadata.name || 'scene'}.scene.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        console.log('[EditorScene] Scene saved.');
    }

    /**
     * Open a file picker and load a .scene.json file into the editor.
     */
    openScene() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.scene.json,application/json';

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = e.target.result;
                    this.recordUndo();
                    this.restoreSceneData(json);
                    console.log(`[EditorScene] Opened scene from "${file.name}".`);
                } catch (err) {
                    console.error('[EditorScene] Failed to load scene file:', err);
                }
            };
            reader.readAsText(file);
        });

        input.click();
    }

    // ================================================================
    // Grid snapping
    // ================================================================

    /**
     * Snap a coordinate pair to the nearest grid intersection.
     * @param {number} x
     * @param {number} y
     * @returns {{ x: number, y: number }}
     */
    snapToGrid(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    // ================================================================
    // HTML UI — Toolbar
    // ================================================================

    /**
     * Creates a fixed-position toolbar across the top of the viewport.
     */
    createToolbar() {
        this.toolbarEl = document.createElement('div');
        Object.assign(this.toolbarEl.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 10px',
            background: '#1e1e2e',
            borderBottom: '1px solid #444',
            zIndex: '1000',
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#ccc',
            boxSizing: 'border-box'
        });

        const buttonDefs = [
            { label: 'New', action: () => { this.recordUndo(); this.init(); this.create(); } },
            { label: 'Save', action: () => this.saveScene() },
            { label: 'Open', action: () => this.openScene() },
            { label: '|', action: null },
            { label: 'Select', action: () => this.setMode('SELECT') },
            { label: 'Move', action: () => this.setMode('MOVE') },
            { label: 'Delete', action: () => this.setMode('DELETE') },
            { label: '|', action: null },
            { label: 'Grid', action: () => this.toggleGrid() },
            { label: 'Snap', action: () => this.toggleSnap() }
        ];

        buttonDefs.forEach((def) => {
            if (def.label === '|') {
                const sep = document.createElement('span');
                sep.textContent = '|';
                sep.style.color = '#555';
                this.toolbarEl.appendChild(sep);
                return;
            }

            const btn = document.createElement('button');
            btn.textContent = def.label;
            Object.assign(btn.style, {
                padding: '4px 10px',
                background: '#2a2a3e',
                color: '#ddd',
                border: '1px solid #555',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
            });
            btn.addEventListener('click', def.action);
            this.toolbarEl.appendChild(btn);
        });

        // Mode indicator
        this.modeIndicator = document.createElement('span');
        this.modeIndicator.textContent = `Mode: ${this.mode}`;
        Object.assign(this.modeIndicator.style, {
            marginLeft: 'auto',
            color: '#88ccff'
        });
        this.toolbarEl.appendChild(this.modeIndicator);

        document.body.appendChild(this.toolbarEl);
    }

    /**
     * Set the current editor mode and update the toolbar indicator.
     * @param {EditorMode} mode
     */
    setMode(mode) {
        this.mode = mode;
        if (this.modeIndicator) {
            this.modeIndicator.textContent = `Mode: ${this.mode}`;
        }
        console.log(`[EditorScene] Mode set to ${mode}.`);
    }

    /**
     * Toggle grid visibility and redraw.
     */
    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        this.drawGrid();
    }

    /**
     * Toggle snap-to-grid.
     */
    toggleSnap() {
        this.snapToGridEnabled = !this.snapToGridEnabled;
        console.log(`[EditorScene] Snap to grid: ${this.snapToGridEnabled}.`);
    }

    // ================================================================
    // HTML UI — Object Palette
    // ================================================================

    /**
     * Creates a fixed-position palette on the left side with draggable
     * object types that can be dropped onto the scene.
     */
    createPalette() {
        this.paletteEl = document.createElement('div');
        Object.assign(this.paletteEl.style, {
            position: 'fixed',
            top: '40px',
            left: '0',
            width: '110px',
            bottom: '0',
            background: '#1a1a2a',
            borderRight: '1px solid #444',
            zIndex: '1000',
            fontFamily: 'sans-serif',
            fontSize: '12px',
            color: '#ccc',
            overflowY: 'auto',
            padding: '8px'
        });

        const heading = document.createElement('div');
        heading.textContent = 'Objects';
        Object.assign(heading.style, {
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#88ccff'
        });
        this.paletteEl.appendChild(heading);

        const objectTypes = ['Player', 'Enemy', 'NPC', 'Tree', 'Rock', 'Light', 'Trigger'];

        objectTypes.forEach((type) => {
            const item = document.createElement('div');
            item.textContent = type;
            item.draggable = true;
            Object.assign(item.style, {
                padding: '6px 8px',
                marginBottom: '4px',
                background: '#2a2a3e',
                border: '1px solid #444',
                borderRadius: '3px',
                cursor: 'grab',
                textAlign: 'center',
                userSelect: 'none'
            });

            // Drag start — store the type name
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', type);
                e.dataTransfer.effectAllowed = 'copy';
            });

            this.paletteEl.appendChild(item);
        });

        document.body.appendChild(this.paletteEl);

        // Drop target — the game canvas
        const canvas = this.game.canvas;
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            if (!type) return;

            // Convert screen coordinates to world coordinates
            const rect = canvas.getBoundingClientRect();
            const cam = this.cameras.main;
            const worldX = (e.clientX - rect.left) / cam.zoom + cam.scrollX;
            const worldY = (e.clientY - rect.top) / cam.zoom + cam.scrollY;

            this.placeObject(type, worldX, worldY);
        });
    }
}
