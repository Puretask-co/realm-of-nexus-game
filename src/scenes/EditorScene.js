import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';
import { Logger } from '../engine/Logger.js';
import { ComponentRegistry } from '../engine/ComponentRegistry.js';
import { ScriptingEngine } from '../engine/ScriptingEngine.js';
import { PhysicsLayer } from '../engine/PhysicsLayer.js';
import { AssetManager } from '../engine/AssetManager.js';
import { HierarchyPanel } from '../ui/HierarchyPanel.js';
import { ConsolePanel } from '../ui/ConsolePanel.js';
import { InspectorPanel } from '../ui/InspectorPanel.js';

/**
 * EditorScene — Full WEngine5-style game engine editor.
 *
 * A Unity-like in-game editor accessible via F2 during gameplay.
 *
 * Panels:
 *  - Scene View: edit the game environment (center viewport)
 *  - Game View: preview/play the game (toggle with Scene View)
 *  - Hierarchy Panel: tree view of all game objects (left)
 *  - Inspector Panel: properties, scripts, and components (right)
 *  - Console Window: debug logging and command input (bottom)
 *  - Palette: object placement palette (left, below hierarchy)
 *  - Toolbar: tools (select, place, erase, trigger, light)
 *
 * Architecture layers integrated:
 *  - Core Layer: Logger, EventBus, GameConfig
 *  - ECS Layer: ComponentRegistry
 *  - Scene Layer: SceneLoader (serialization, prefabs)
 *  - Editor Layer: this scene (dockable panels)
 *  - Scripting Layer: ScriptingEngine
 *  - Physics Layer: PhysicsLayer
 *  - Asset Layer: AssetManager
 *
 * Hotkeys:
 *  - F2: Toggle back to game
 *  - F3: Toggle performance profiler
 *  - ` (backtick): Focus console input
 *  - Ctrl+S: Save scene
 *  - Ctrl+O: Load scene
 *  - Ctrl+Z: Undo
 *  - Ctrl+Y: Redo
 *  - V/P/X/T/L: Tool select
 *  - G: Toggle grid snap
 *  - H: Toggle hierarchy panel
 *  - C: Toggle console panel
 *  - I: Toggle inspector panel
 *  - Tab: Toggle between Scene View and Game View
 */
export default class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
    }

    create() {
        // Initialize engine systems
        this.logger = Logger.getInstance();
        this.registry = ComponentRegistry.getInstance();
        this.scripting = ScriptingEngine.getInstance();
        this.physicsLayer = PhysicsLayer.getInstance();
        this.assetManager = AssetManager.getInstance();

        // Register default ECS component types
        this._registerComponentTypes();

        // Editor state
        this.editorObjects = [];
        this.selectedObject = null;
        this.gridSize = 32;
        this.snapToGrid = true;
        this.currentTool = 'select';
        this.currentPalette = 'enemy';
        this.undoStack = [];
        this.redoStack = [];
        this.layers = {
            objects: { visible: true, items: [] },
            triggers: { visible: true, items: [] },
            lights: { visible: true, items: [] },
            spawns: { visible: true, items: [] }
        };
        this.viewMode = 'scene'; // scene | game

        // Camera setup
        this.cameras.main.setBackgroundColor('#111118');

        // ---- Layout Constants ----
        this.layout = {
            toolbarH: 38,
            hierarchyW: 180,
            inspectorW: 220,
            consoleH: 200,
            paletteH: 200
        };

        // Draw grid
        this._drawGrid();

        // Create all panels (WEngine5 layout)
        this._createToolbar();
        this._createViewTabs();
        this._createHierarchyPanel();
        this._createPalette();
        this._createInspectorPanel();
        this._createConsolePanel();
        this._createStatusBar();

        // Input
        this._setupInput();

        // Keyboard shortcuts
        this._setupHotkeys();

        // Import existing GameScene objects into ECS
        this._importGameScene();

        this.logger.info('Editor', 'WEngine5 Editor ready. Press F2 to return to game.');
    }

    // ----------------------------------------------------------------
    // Component Types (ECS Layer)
    // ----------------------------------------------------------------

    _registerComponentTypes() {
        this.registry
            .registerComponent('Transform', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
            .registerComponent('Sprite', { texture: '', frame: 0, tint: 0xffffff })
            .registerComponent('Physics', { velocityX: 0, velocityY: 0, immovable: false, collideWorldBounds: true })
            .registerComponent('Light', { color: 0xffffff, radius: 100, intensity: 1.0 })
            .registerComponent('Trigger', { event: '', width: 64, height: 64, oneShot: false })
            .registerComponent('Script', { scriptId: '', properties: {} })
            .registerComponent('AI', { behavior: 'aggressive', aggroRange: 5, leashRange: 10 })
            .registerComponent('Health', { hp: 100, maxHp: 100 })
            .registerComponent('Combat', { attack: 10, defense: 5, speed: 1 })
            .registerComponent('Dialogue', { dialogueId: '', role: 'lore' })
            .registerComponent('Loot', { lootTable: '', goldMin: 0, goldMax: 0 })
            .registerComponent('CustomData', {});
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
    // View Tabs (Scene View / Game View toggle)
    // ----------------------------------------------------------------

    _createViewTabs() {
        const tabY = 8;
        const tabX = 300;

        this.sceneTabBg = this.add.graphics().setDepth(10000).setScrollFactor(0);
        this.gameTabBg = this.add.graphics().setDepth(10000).setScrollFactor(0);

        this.sceneTabText = this.add.text(tabX + 40, tabY + 10, 'Scene', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setInteractive({ useHandCursor: true });

        this.gameTabText = this.add.text(tabX + 120, tabY + 10, 'Game', {
            fontFamily: 'monospace', fontSize: '11px', color: '#888888'
        }).setOrigin(0.5).setDepth(10001).setScrollFactor(0).setInteractive({ useHandCursor: true });

        this.sceneTabText.on('pointerdown', () => this._setViewMode('scene'));
        this.gameTabText.on('pointerdown', () => this._setViewMode('game'));

        this._refreshViewTabs();
    }

    _setViewMode(mode) {
        this.viewMode = mode;
        this._refreshViewTabs();

        if (mode === 'game') {
            // Hide editor overlays, show game preview
            this.gridGraphics.setVisible(false);
            this.editorObjects.forEach(obj => {
                if (obj.editorData?.gfx) obj.editorData.gfx.setVisible(false);
                if (obj.editorData?.label) obj.editorData.label.setVisible(false);
            });
        } else {
            this.gridGraphics.setVisible(true);
            this.editorObjects.forEach(obj => {
                if (obj.editorData?.gfx) obj.editorData.gfx.setVisible(true);
                if (obj.editorData?.label) obj.editorData.label.setVisible(true);
            });
        }
    }

    _refreshViewTabs() {
        const tabX = 300;
        const tabY = 8;

        this.sceneTabBg.clear();
        this.sceneTabBg.fillStyle(this.viewMode === 'scene' ? 0x446688 : 0x222244, 0.9);
        this.sceneTabBg.fillRect(tabX, tabY, 80, 22);
        this.sceneTabBg.lineStyle(1, 0x4466aa, 0.6);
        this.sceneTabBg.strokeRect(tabX, tabY, 80, 22);

        this.gameTabBg.clear();
        this.gameTabBg.fillStyle(this.viewMode === 'game' ? 0x446688 : 0x222244, 0.9);
        this.gameTabBg.fillRect(tabX + 80, tabY, 80, 22);
        this.gameTabBg.lineStyle(1, 0x4466aa, 0.6);
        this.gameTabBg.strokeRect(tabX + 80, tabY, 80, 22);

        this.sceneTabText.setColor(this.viewMode === 'scene' ? '#ffffff' : '#667788');
        this.gameTabText.setColor(this.viewMode === 'game' ? '#ffffff' : '#667788');
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
            { key: 'light', label: 'LIT', tip: 'Place Light (L)' },
            { key: 'script', label: 'SCR', tip: 'Attach Script (S)' }
        ];

        this.toolButtons = [];
        tools.forEach((tool, i) => {
            const x = 8 + i * 46;
            const y = 8;

            const bg = this.add.graphics().setDepth(10000).setScrollFactor(0);
            bg.fillStyle(this.currentTool === tool.key ? 0x446688 : 0x222244, 0.9);
            bg.fillRect(x, y, 42, 24);
            bg.lineStyle(1, 0x4466aa, 0.6);
            bg.strokeRect(x, y, 42, 24);

            const label = this.add.text(x + 21, y + 12, tool.label, {
                fontFamily: 'monospace', fontSize: '10px', color: '#88aadd'
            }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);

            bg.setInteractive(new Phaser.Geom.Rectangle(x, y, 42, 24), Phaser.Geom.Rectangle.Contains);
            bg.on('pointerdown', () => {
                this.currentTool = tool.key;
                this._refreshToolbar();
            });

            this.toolButtons.push({ bg, label, tool: tool.key, x, y });
        });
    }

    _refreshToolbar() {
        this.toolButtons.forEach((btn) => {
            btn.bg.clear();
            btn.bg.fillStyle(this.currentTool === btn.tool ? 0x446688 : 0x222244, 0.9);
            btn.bg.fillRect(btn.x, btn.y, 42, 24);
            btn.bg.lineStyle(1, 0x4466aa, 0.6);
            btn.bg.strokeRect(btn.x, btn.y, 42, 24);
        });
        this._updateStatusBar();
    }

    // ----------------------------------------------------------------
    // Hierarchy Panel (left side)
    // ----------------------------------------------------------------

    _createHierarchyPanel() {
        this.hierarchyPanel = new HierarchyPanel(this, {
            x: 0,
            y: this.layout.toolbarH,
            width: this.layout.hierarchyW,
            height: 720 - this.layout.toolbarH - this.layout.consoleH - this.layout.paletteH
        });

        // When hierarchy selection changes, update inspector
        EventBus.on('hierarchy:selected', (data) => {
            if (data.gameObject) {
                this.selectedObject = data.gameObject;
                if (this.inspectorPanel) {
                    this.inspectorPanel.show(data.gameObject);
                }
            }
        });
    }

    // ----------------------------------------------------------------
    // Palette (left side, below hierarchy)
    // ----------------------------------------------------------------

    _createPalette() {
        const panelX = 0;
        const panelY = 720 - this.layout.consoleH - this.layout.paletteH;
        const panelW = this.layout.hierarchyW;
        const panelH = this.layout.paletteH;

        this.paletteBg = this.add.graphics().setDepth(10000).setScrollFactor(0);
        this.paletteBg.fillStyle(0x111122, 0.90);
        this.paletteBg.fillRect(panelX, panelY, panelW, panelH);
        this.paletteBg.lineStyle(1, 0x334466, 0.5);
        this.paletteBg.strokeRect(panelX, panelY, panelW, panelH);

        this.add.text(panelX + 8, panelY + 4, 'PALETTE', {
            fontFamily: 'monospace', fontSize: '10px', color: '#6688aa', fontStyle: 'bold'
        }).setDepth(10001).setScrollFactor(0);

        const paletteItems = [
            { key: 'enemy', label: 'Enemy', color: '#ff4444' },
            { key: 'npc', label: 'NPC', color: '#44ff44' },
            { key: 'spawn', label: 'Spawn Point', color: '#ffaa44' },
            { key: 'decoration', label: 'Decoration', color: '#888888' },
            { key: 'wall', label: 'Wall', color: '#666666' },
            { key: 'chest', label: 'Chest', color: '#ffdd44' },
            { key: 'portal', label: 'Portal', color: '#aa44ff' },
            { key: 'light_point', label: 'Point Light', color: '#ffff88' },
            { key: 'trigger_zone', label: 'Trigger Zone', color: '#ff8844' }
        ];

        this.paletteButtons = [];
        paletteItems.forEach((item, i) => {
            const ix = panelX + 8;
            const iy = panelY + 20 + i * 19;

            const swatch = this.add.graphics().setDepth(10001).setScrollFactor(0);
            swatch.fillStyle(parseInt(item.color.replace('#', '0x')), 1);
            swatch.fillRect(ix, iy + 2, 10, 10);

            const text = this.add.text(ix + 14, iy, item.label, {
                fontFamily: 'monospace', fontSize: '10px',
                color: this.currentPalette === item.key ? '#ffffff' : item.color
            }).setDepth(10001).setScrollFactor(0).setInteractive({ useHandCursor: true });

            text.on('pointerdown', () => {
                this.currentPalette = item.key;
                this.paletteButtons.forEach(btn => {
                    const isActive = btn.key === item.key;
                    btn.text.setColor(isActive ? '#ffffff' : btn.origColor);
                });
                this._updateStatusBar();
            });

            text.on('pointerover', () => text.setColor('#ffffff'));
            text.on('pointerout', () => {
                text.setColor(this.currentPalette === item.key ? '#ffffff' : item.color);
            });

            this.paletteButtons.push({ text, swatch, key: item.key, origColor: item.color });
        });
    }

    // ----------------------------------------------------------------
    // Inspector Panel (right side)
    // ----------------------------------------------------------------

    _createInspectorPanel() {
        this.inspectorPanel = new InspectorPanel(this);
        // Position is handled internally by InspectorPanel
    }

    // ----------------------------------------------------------------
    // Console Panel (bottom)
    // ----------------------------------------------------------------

    _createConsolePanel() {
        this.consolePanel = new ConsolePanel(this, {
            x: this.layout.hierarchyW,
            y: 720 - this.layout.consoleH,
            width: 1280 - this.layout.hierarchyW - this.layout.inspectorW,
            height: this.layout.consoleH
        });

        // Register editor-specific commands
        this.consolePanel.registerCommand('spawn', 'Spawn entity (spawn enemy|npc x y)', (args) => {
            if (args.length < 3) return 'Usage: spawn <type> <x> <y>';
            const type = args[0];
            const x = parseFloat(args[1]);
            const y = parseFloat(args[2]);
            this._placeObject(x, y, type);
            return `Spawned ${type} at (${x}, ${y})`;
        });

        this.consolePanel.registerCommand('grid', 'Set grid size (grid <size>)', (args) => {
            if (args.length > 0) {
                this.gridSize = parseInt(args[0]) || 32;
                this._drawGrid();
            }
            return `Grid size: ${this.gridSize}px | Snap: ${this.snapToGrid ? 'ON' : 'OFF'}`;
        });

        this.consolePanel.registerCommand('layers', 'Toggle layer visibility (layers <name>)', (args) => {
            if (args.length > 0) {
                const layer = this.layers[args[0]];
                if (layer) {
                    layer.visible = !layer.visible;
                    layer.items.forEach(obj => {
                        if (obj.editorData?.gfx) obj.editorData.gfx.setVisible(layer.visible);
                        if (obj.editorData?.label) obj.editorData.label.setVisible(layer.visible);
                    });
                    return `Layer '${args[0]}' ${layer.visible ? 'shown' : 'hidden'}`;
                }
                return `Unknown layer: ${args[0]}`;
            }
            return Object.entries(this.layers).map(([k, v]) => `${k}: ${v.visible ? 'ON' : 'OFF'} (${v.items.length})`).join('\n');
        });

        this.consolePanel.registerCommand('scripts', 'List available scripts', () => {
            const scripts = this.scripting.getAllScripts();
            return scripts.map(s => `${s.id} - ${s.name}: ${s.description}`).join('\n');
        });

        this.consolePanel.registerCommand('assets', 'Show asset stats', () => {
            const stats = this.assetManager.getStats();
            return `Assets: ${stats.totalAssets} | Loaded: ${stats.loaded} | Memory: ${stats.memoryMB}MB / ${stats.budgetMB}MB`;
        });

        this.consolePanel.registerCommand('ecs', 'Show ECS stats', () => {
            const stats = this.registry.getStats();
            const types = this.registry.getRegisteredTypes();
            return `Entities: ${stats.entityCount} | Types: ${types.join(', ')} | Systems: ${stats.systemCount}`;
        });

        this.consolePanel.registerCommand('select', 'Select entity by name (select <name>)', (args) => {
            if (args.length === 0) return 'Usage: select <entityName>';
            const entity = this.registry.findEntityByName(args.join(' '));
            if (entity) {
                this.hierarchyPanel.selectEntity(entity.id);
                return `Selected: ${entity.name} (${entity.id})`;
            }
            return `Entity not found: ${args.join(' ')}`;
        });

        this.consolePanel.registerCommand('export', 'Export scene as JSON', () => {
            this.saveScene();
            return 'Scene exported.';
        });

        this.consolePanel.registerCommand('import', 'Import scene from JSON', () => {
            this.loadScene();
            return 'Opening file dialog...';
        });

        this.consolePanel.registerCommand('code', 'Open code in external editor hint', () => {
            return 'To edit code: open your project in VS Code with:\n  code /path/to/realm-of-nexus-game\n\nOr use the eval command for quick tests:\n  eval 1 + 1';
        });
    }

    // ----------------------------------------------------------------
    // Status Bar
    // ----------------------------------------------------------------

    _createStatusBar() {
        // Bottom-left engine info bar
        const barY = 720 - this.layout.consoleH - 16;
        this.statusText = this.add.text(this.layout.hierarchyW + 4, barY, '', {
            fontFamily: 'monospace', fontSize: '9px', color: '#556677'
        }).setDepth(10001).setScrollFactor(0);
        this._updateStatusBar();

        // Engine label (top right)
        this.add.text(1280 - 8, 4, 'WEngine5 / Verdance', {
            fontFamily: 'monospace', fontSize: '9px', color: '#334455'
        }).setOrigin(1, 0).setDepth(10001).setScrollFactor(0);
    }

    _updateStatusBar() {
        const parts = [
            `Tool: ${this.currentTool.toUpperCase()}`,
            `Palette: ${this.currentPalette}`,
            `Grid: ${this.snapToGrid ? 'ON' : 'OFF'}(${this.gridSize})`,
            `Obj: ${this.editorObjects.length}`,
            `ECS: ${this.registry.getStats().entityCount}`,
            `View: ${this.viewMode.toUpperCase()}`,
            `F2:Game  Ctrl+S:Save  G:Grid  H:Hierarchy  C:Console  I:Inspector`
        ];
        this.statusText.setText(parts.join('  '));
    }

    // ----------------------------------------------------------------
    // Hotkeys
    // ----------------------------------------------------------------

    _setupHotkeys() {
        this.input.keyboard.on('keydown-F2', () => {
            this.scene.switch('GameScene');
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.selectedObject = null;
            if (this.inspectorPanel) this.inspectorPanel.hide();
        });

        // Tool shortcuts
        this.input.keyboard.on('keydown-V', () => { this.currentTool = 'select'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-P', () => { this.currentTool = 'place'; this._refreshToolbar(); });
        this.input.keyboard.on('keydown-X', () => { this.currentTool = 'erase'; this._refreshToolbar(); });

        // Panel toggles
        this.input.keyboard.on('keydown-H', (e) => {
            if (!e.ctrlKey) {
                this.hierarchyPanel.setVisible(!this.hierarchyPanel.visible);
            }
        });

        this.input.keyboard.on('keydown-C', (e) => {
            if (!e.ctrlKey) {
                this.consolePanel.setVisible(!this.consolePanel.visible);
            }
        });

        this.input.keyboard.on('keydown-I', (e) => {
            if (!e.ctrlKey) {
                if (this.inspectorPanel.visible) {
                    this.inspectorPanel.hide();
                } else if (this.selectedObject) {
                    this.inspectorPanel.show(this.selectedObject);
                }
            }
        });

        // View mode toggle
        this.input.keyboard.on('keydown-TAB', (e) => {
            e.preventDefault();
            this._setViewMode(this.viewMode === 'scene' ? 'game' : 'scene');
        });

        // Undo/Redo
        this.input.keyboard.on('keydown-Z', (e) => { if (e.ctrlKey) this.undo(); });
        this.input.keyboard.on('keydown-Y', (e) => { if (e.ctrlKey) this.redo(); });

        // Grid snap
        this.input.keyboard.on('keydown-G', () => {
            this.snapToGrid = !this.snapToGrid;
            this._updateStatusBar();
        });

        // Save/Load
        this.input.keyboard.on('keydown-S', (e) => {
            if (e.ctrlKey) { e.preventDefault(); this.saveScene(); }
        });
        this.input.keyboard.on('keydown-O', (e) => {
            if (e.ctrlKey) { e.preventDefault(); this.loadScene(); }
        });

        // Delete selected
        this.input.keyboard.on('keydown-DELETE', () => {
            if (this.selectedObject) {
                this._pushUndo('delete', this.selectedObject);
                this._removeObject(this.selectedObject);
                this.selectedObject = null;
                if (this.inspectorPanel) this.inspectorPanel.hide();
                this._updateStatusBar();
            }
        });
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

        // Zoom with scroll wheel (only in scene viewport area)
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            // Only zoom in the scene viewport (not over panels)
            if (pointer.x > this.layout.hierarchyW &&
                pointer.x < 1280 - this.layout.inspectorW &&
                pointer.y < 720 - this.layout.consoleH) {
                const newZoom = Phaser.Math.Clamp(
                    this.cameras.main.zoom - deltaY * 0.001,
                    0.25,
                    4.0
                );
                this.cameras.main.setZoom(newZoom);
            }
        });

        // Click actions
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown() || pointer.middleButtonDown()) return;

            // Ignore clicks on UI panels
            if (pointer.x < this.layout.hierarchyW) return;
            if (pointer.x > 1280 - this.layout.inspectorW && pointer.y < 720 - this.layout.consoleH) return;
            if (pointer.y > 720 - this.layout.consoleH) return;
            if (pointer.y < this.layout.toolbarH) return;

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
                case 'script':
                    this._selectAt(wx, wy);
                    // If selected, show available scripts in console
                    if (this.selectedObject) {
                        const scripts = this.scripting.getAllScripts();
                        this.logger.info('Editor', `Available scripts for attachment: ${scripts.map(s => s.id).join(', ')}`);
                    }
                    break;
            }
        });
    }

    // ----------------------------------------------------------------
    // Import Game Scene into ECS
    // ----------------------------------------------------------------

    _importGameScene() {
        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.children) {
            this.registry.importFromScene(gameScene);
            this.hierarchyPanel.refresh();
            this.logger.info('Editor', `Imported ${this.registry.getStats().entityCount} entities from GameScene`);
        }
    }

    // ----------------------------------------------------------------
    // Object management
    // ----------------------------------------------------------------

    _placeObject(x, y, type) {
        const COLORS = {
            enemy: 0xff4444, npc: 0x44ff44, spawn: 0xffaa44,
            decoration: 0x888888, wall: 0x666666, chest: 0xffdd44,
            portal: 0xaa44ff, light_point: 0xffff88, trigger_zone: 0xff8844
        };

        const gfx = this.add.graphics().setDepth(5);
        gfx.fillStyle(COLORS[type] || 0xffffff, 0.8);

        if (type === 'wall') {
            gfx.fillRect(x - 16, y - 16, 32, 32);
        } else if (type === 'trigger_zone') {
            gfx.lineStyle(2, 0xff8844, 0.6);
            gfx.strokeRect(x - 32, y - 32, 64, 64);
            gfx.fillStyle(0xff8844, 0.1);
            gfx.fillRect(x - 32, y - 32, 64, 64);
        } else if (type === 'light_point') {
            gfx.fillStyle(0xffff88, 0.3);
            gfx.fillCircle(x, y, 40);
            gfx.lineStyle(1, 0xffff88, 0.6);
            gfx.strokeCircle(x, y, 40);
            gfx.fillStyle(0xffff88, 0.8);
            gfx.fillCircle(x, y, 4);
        } else {
            gfx.fillCircle(x, y, 12);
        }

        const label = this.add.text(x, y - 18, type.toUpperCase(), {
            fontFamily: 'monospace', fontSize: '8px', color: '#aaaacc'
        }).setOrigin(0.5).setDepth(6);

        const obj = this.add.container(x, y, []).setDepth(5);
        obj.editorData = {
            type,
            layer: type === 'light_point' ? 'lights' : (type === 'trigger_zone' ? 'triggers' : 'objects'),
            properties: this._defaultProperties(type),
            gfx,
            label
        };

        this.editorObjects.push(obj);
        const layer = this.layers[obj.editorData.layer] || this.layers.objects;
        layer.items.push(obj);

        // Register in ECS
        const entity = this.registry.createEntity(type);
        this.registry.addComponent(entity.id, 'Transform', { x, y });
        entity.gameObject = obj;
        obj.setData('entityId', entity.id);

        this._pushUndo('place', obj);
        this._updateStatusBar();
        this.hierarchyPanel.refresh();
    }

    _placeLight(x, y) {
        this._placeObject(x, y, 'light_point');
    }

    _placeTrigger(x, y) {
        this._placeObject(x, y, 'trigger_zone');
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

        this.selectedObject = closest;

        if (closest) {
            // Update inspector
            if (this.inspectorPanel) this.inspectorPanel.show(closest);
            // Update hierarchy selection
            const entityId = closest.getData?.('entityId');
            if (entityId) this.hierarchyPanel.selectEntity(entityId);
        } else {
            if (this.inspectorPanel) this.inspectorPanel.hide();
        }
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

        Object.values(this.layers).forEach((layer) => {
            const li = layer.items.indexOf(obj);
            if (li !== -1) layer.items.splice(li, 1);
        });

        // Remove from ECS
        const entityId = obj.getData?.('entityId');
        if (entityId) this.registry.destroyEntity(entityId);

        if (obj.editorData?.gfx) obj.editorData.gfx.destroy();
        if (obj.editorData?.label) obj.editorData.label.destroy();
        obj.destroy();

        this.hierarchyPanel.refresh();
    }

    _defaultProperties(type) {
        switch (type) {
            case 'enemy': return { enemyId: 'forest_guardian', level: 1, respawnDelay: 10, behavior: 'aggressive' };
            case 'npc': return { name: 'NPC', dialogue: 'Hello!', role: 'lore' };
            case 'spawn': return { enemyId: '', respawnDelay: 30, maxCount: 1 };
            case 'decoration': return { sprite: 'tree', scale: 1.0 };
            case 'wall': return { width: 32, height: 32, solid: true };
            case 'chest': return { lootTable: 'common', locked: false };
            case 'portal': return { targetLocation: '', targetX: 0, targetY: 0 };
            case 'light_point': return { color: '0xffffff', radius: 100, intensity: 1.0 };
            case 'trigger_zone': return { event: 'custom', width: 64, height: 64, oneShot: false };
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
        if (this.undoStack.length > 50) this.undoStack.shift();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const entry = this.undoStack.pop();

        if (entry.action === 'place') {
            this._removeObject(entry.ref);
            this.redoStack.push(entry);
        } else if (entry.action === 'delete') {
            this._placeObject(entry.data.x, entry.data.y, entry.data.type);
            this.redoStack.push(entry);
        }

        this._updateStatusBar();
        this.logger.debug('Editor', `Undo: ${entry.action}`);
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
        this.logger.debug('Editor', `Redo: ${entry.action}`);
    }

    // ----------------------------------------------------------------
    // Save / Load (Scene Layer)
    // ----------------------------------------------------------------

    saveScene() {
        const sceneData = {
            metadata: {
                name: 'Untitled Scene',
                author: 'WEngine5 Editor',
                version: '2.0',
                engine: 'WEngine5/Verdance',
                created: new Date().toISOString()
            },
            objects: [],
            triggers: [],
            lights: [],
            spawns: [],
            ecs: this.registry.serialize(),
            scripts: this.scripting.serialize()
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
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        a.click();
        URL.revokeObjectURL(url);

        this.logger.info('Editor', `Scene saved (${(json.length / 1024).toFixed(1)}KB, ${this.editorObjects.length} objects, ${this.registry.getStats().entityCount} entities)`);
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
                    this.logger.info('Editor', `Scene loaded: ${sceneData.metadata?.name || 'Untitled'}`);
                } catch (err) {
                    this.logger.error('Editor', `Failed to parse scene file: ${err.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    _loadSceneData(sceneData) {
        [...this.editorObjects].forEach((obj) => this._removeObject(obj));
        this.undoStack = [];
        this.redoStack = [];

        (sceneData.objects || []).forEach((obj) => {
            this._placeObject(obj.x, obj.y, obj.type);
        });
        (sceneData.triggers || []).forEach((t) => {
            this._placeObject(t.x, t.y, 'trigger_zone');
        });
        (sceneData.lights || []).forEach((l) => {
            this._placeObject(l.x, l.y, 'light_point');
        });

        // Restore ECS and scripts if present
        if (sceneData.ecs) {
            this.registry.deserialize(sceneData.ecs, this);
        }
        if (sceneData.scripts) {
            this.scripting.deserialize(sceneData.scripts);
        }

        this.hierarchyPanel.refresh();
        this._updateStatusBar();
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(time, delta) {
        this.logger.tickFrame();

        // Camera pan with arrow keys
        const speed = 400 / this.cameras.main.zoom;
        if (this.input.keyboard.addKey('LEFT').isDown) this.cameras.main.scrollX -= speed * (delta / 1000);
        if (this.input.keyboard.addKey('RIGHT').isDown) this.cameras.main.scrollX += speed * (delta / 1000);
        if (this.input.keyboard.addKey('UP').isDown) this.cameras.main.scrollY -= speed * (delta / 1000);
        if (this.input.keyboard.addKey('DOWN').isDown) this.cameras.main.scrollY += speed * (delta / 1000);

        // Refresh inspector live values
        if (this.inspectorPanel?.visible) {
            this.inspectorPanel.refresh();
        }
    }
}
