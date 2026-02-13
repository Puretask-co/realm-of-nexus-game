import EventBus from '../systems/EventBus.js';

/**
 * MinimapRenderer — Draws a real-time minimap in the corner of the UI.
 *
 * Features:
 *  - Scaled-down representation of the world
 *  - Player position indicator (blinking dot)
 *  - Enemy positions (red dots)
 *  - NPC positions (green dots)
 *  - Zone boundaries
 *  - Fog-of-war: only show areas the player has visited
 *  - Camera viewport rectangle
 *
 * Renders to a dedicated Graphics object on the UIScene
 * (scrollFactor 0 so it stays fixed on screen).
 */
export default class MinimapRenderer {
    constructor(scene, config) {
        this.scene = scene;

        // Minimap position and size
        this.x = config?.x ?? (1280 - 136);
        this.y = config?.y ?? 16;
        this.width = config?.width ?? 120;
        this.height = config?.height ?? 120;

        // World dimensions for scaling
        this.worldWidth = config?.worldWidth ?? 2400;
        this.worldHeight = config?.worldHeight ?? 1800;

        this.scaleX = this.width / this.worldWidth;
        this.scaleY = this.height / this.worldHeight;

        // Graphics
        this._gfx = scene.add.graphics().setDepth(10010).setScrollFactor(0);

        // Fog of war tracking (grid of visited cells)
        this.fogCellSize = 64;
        this.visited = new Set();

        // Blink timer for player dot
        this._blinkTimer = 0;
        this._blinkOn = true;

        // Data sources (set externally)
        this.player = null;
        this.enemies = null;
        this.npcs = null;
        this.camera = null;
    }

    /**
     * Bind data sources. Call after entities are created.
     */
    bind(player, enemies, npcs, camera) {
        this.player = player;
        this.enemies = enemies;
        this.npcs = npcs;
        this.camera = camera;
    }

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------

    update(delta) {
        const g = this._gfx;
        g.clear();

        // Background
        g.fillStyle(0x111122, 0.7);
        g.fillRect(this.x, this.y, this.width, this.height);
        g.lineStyle(1, 0x334466, 0.5);
        g.strokeRect(this.x, this.y, this.width, this.height);

        // Fog of war
        this._updateFogOfWar();
        this._renderFog(g);

        // Zone boundaries
        this._renderZones(g);

        // Enemies
        this._renderEnemies(g);

        // NPCs
        this._renderNPCs(g);

        // Camera viewport
        this._renderViewport(g);

        // Player (on top)
        this._blinkTimer += delta / 1000;
        if (this._blinkTimer > 0.5) {
            this._blinkTimer = 0;
            this._blinkOn = !this._blinkOn;
        }
        this._renderPlayer(g);
    }

    // ----------------------------------------------------------------
    // Fog of war
    // ----------------------------------------------------------------

    _updateFogOfWar() {
        if (!this.player) return;
        const px = this.player.sprite?.x ?? this.player.x;
        const py = this.player.sprite?.y ?? this.player.y;

        // Reveal cells around player
        const revealRadius = 3; // cells
        const cellX = Math.floor(px / this.fogCellSize);
        const cellY = Math.floor(py / this.fogCellSize);

        for (let dx = -revealRadius; dx <= revealRadius; dx++) {
            for (let dy = -revealRadius; dy <= revealRadius; dy++) {
                this.visited.add(`${cellX + dx},${cellY + dy}`);
            }
        }
    }

    _renderFog(g) {
        const cellW = this.fogCellSize * this.scaleX;
        const cellH = this.fogCellSize * this.scaleY;
        const cols = Math.ceil(this.worldWidth / this.fogCellSize);
        const rows = Math.ceil(this.worldHeight / this.fogCellSize);

        g.fillStyle(0x000000, 0.6);
        for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
                if (!this.visited.has(`${cx},${cy}`)) {
                    g.fillRect(
                        this.x + cx * cellW,
                        this.y + cy * cellH,
                        cellW + 1,
                        cellH + 1
                    );
                }
            }
        }
    }

    // ----------------------------------------------------------------
    // Entity rendering
    // ----------------------------------------------------------------

    _renderPlayer(g) {
        if (!this.player) return;
        const px = this.player.sprite?.x ?? this.player.x;
        const py = this.player.sprite?.y ?? this.player.y;
        const mx = this.x + px * this.scaleX;
        const my = this.y + py * this.scaleY;

        if (this._blinkOn) {
            g.fillStyle(0x4488ff, 1);
            g.fillCircle(mx, my, 3);
        }
        // Always show a dim dot
        g.fillStyle(0x4488ff, 0.4);
        g.fillCircle(mx, my, 2);
    }

    _renderEnemies(g) {
        if (!this.enemies) return;

        const entries = this.enemies.children?.entries || this.enemies;
        entries.forEach((enemy) => {
            if (!enemy.active) return;
            const ex = this.x + enemy.x * this.scaleX;
            const ey = this.y + enemy.y * this.scaleY;

            // Only show if in visited area
            const cellKey = `${Math.floor(enemy.x / this.fogCellSize)},${Math.floor(enemy.y / this.fogCellSize)}`;
            if (this.visited.has(cellKey)) {
                g.fillStyle(0xff4444, 0.8);
                g.fillCircle(ex, ey, 1.5);
            }
        });
    }

    _renderNPCs(g) {
        if (!this.npcs) return;

        this.npcs.forEach((npc) => {
            const nx = this.x + (npc.sprite?.x ?? npc.x) * this.scaleX;
            const ny = this.y + (npc.sprite?.y ?? npc.y) * this.scaleY;

            const cellKey = `${Math.floor((npc.sprite?.x ?? npc.x) / this.fogCellSize)},${Math.floor((npc.sprite?.y ?? npc.y) / this.fogCellSize)}`;
            if (this.visited.has(cellKey)) {
                g.fillStyle(0x44ff44, 0.8);
                g.fillCircle(nx, ny, 1.5);
            }
        });
    }

    _renderViewport(g) {
        if (!this.camera) return;

        const vx = this.x + this.camera.scrollX * this.scaleX;
        const vy = this.y + this.camera.scrollY * this.scaleY;
        const vw = (this.camera.width / this.camera.zoom) * this.scaleX;
        const vh = (this.camera.height / this.camera.zoom) * this.scaleY;

        g.lineStyle(1, 0xffffff, 0.3);
        g.strokeRect(vx, vy, vw, vh);
    }

    _renderZones(g) {
        // Draw zone boundaries as faint outlines
        g.lineStyle(1, 0x334466, 0.2);
        for (let i = 0; i < 6; i++) {
            const zx = this.x + (i % 3) * 800 * this.scaleX;
            const zy = this.y + Math.floor(i / 3) * 600 * this.scaleY;
            const zw = 800 * this.scaleX;
            const zh = 600 * this.scaleY;
            g.strokeRect(zx, zy, zw, zh);
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    destroy() {
        this._gfx.destroy();
    }
}
