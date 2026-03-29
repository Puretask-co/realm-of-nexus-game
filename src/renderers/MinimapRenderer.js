import EventBus from '../core/EventBus.js';

/**
 * MinimapRenderer — Draws a real-time 120×120 minimap fixed in the top-right corner.
 *
 * Features:
 *  - Scaled-down representation of the 3200×3200 world → 120×120 px
 *  - Player position: 4 px white/yellow dot with pulse blink
 *  - Enemy positions: 3 px red dots (fog-of-war aware)
 *  - NPC positions: 2 px green dots (fog-of-war aware)
 *  - Zone boundary outlines
 *  - Fog-of-war: unvisited cells are dimmed with black overlay
 *  - Camera viewport rectangle
 *  - "You are here" label below the minimap
 *  - Current zone name label above the minimap
 *
 * Usage (GameScene.js):
 *   this.minimap = new MinimapRenderer(this);
 *   this.minimap.bind(player, enemies, npcs, cameras.main);
 *   // in update():
 *   this.minimap.update(delta);
 */
export default class MinimapRenderer {
    constructor(scene, config) {
        this.scene = scene;

        // Minimap screen position and size
        const gameWidth = scene.scale?.width ?? 1280;
        this.width  = config?.width  ?? 120;
        this.height = config?.height ?? 120;
        this.x = config?.x ?? (gameWidth - this.width - 12);
        this.y = config?.y ?? 8;

        // World dimensions (Realm of Nexus: 3200×3200)
        this.worldWidth  = config?.worldWidth  ?? 3200;
        this.worldHeight = config?.worldHeight ?? 3200;

        this.scaleX = this.width  / this.worldWidth;
        this.scaleY = this.height / this.worldHeight;

        // Graphics layer (fixed to screen via scrollFactor 0)
        this._gfx = scene.add.graphics()
            .setDepth(10010)
            .setScrollFactor(0);

        // Zone name label — above the minimap
        this._zoneLabel = scene.add.text(
            this.x + this.width / 2,
            this.y - 2,
            '',
            { fontFamily: 'Open Sans', fontSize: '10px', color: '#aabbcc', stroke: '#000', strokeThickness: 2 }
        ).setOrigin(0.5, 1).setDepth(10011).setScrollFactor(0);

        // "You are here" label — below the minimap
        this._hereLabel = scene.add.text(
            this.x + this.width / 2,
            this.y + this.height + 3,
            'YOU ARE HERE',
            { fontFamily: 'Open Sans', fontSize: '8px', color: '#667788', stroke: '#000', strokeThickness: 1 }
        ).setOrigin(0.5, 0).setDepth(10011).setScrollFactor(0);

        // Fog of war — grid of visited cells (cell = 64 world units)
        this.fogCellSize = 64;
        this.visited = new Set();

        // Player dot blink
        this._blinkTimer = 0;
        this._blinkOn = true;

        // NPC update throttle (every 30 frames)
        this._npcFrameCounter = 0;
        this._cachedNPCPositions = [];

        // Data sources (populated via bind())
        this.player  = null;
        this.enemies = null;
        this.npcs    = null;
        this.camera  = null;

        // Current zone name (updated via EventBus)
        this._currentZone = '';
        EventBus.on('zone:entered', (data) => {
            this._currentZone = data?.name || data?.locationId || '';
            this._zoneLabel.setText(this._currentZone);
        });
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    /**
     * Bind data sources. Call after entities are created in GameScene.
     */
    bind(player, enemies, npcs, camera) {
        this.player  = player;
        this.enemies = enemies;
        this.npcs    = npcs;
        this.camera  = camera;
    }

    // ----------------------------------------------------------------
    // Main render — called every frame
    // ----------------------------------------------------------------

    update(delta) {
        const g = this._gfx;
        g.clear();

        // ── Background ─────────────────────────────────────────────
        g.fillStyle(0x0a0e18, 0.82);
        g.fillRect(this.x, this.y, this.width, this.height);

        // ── Border ─────────────────────────────────────────────────
        g.lineStyle(1, 0x3355aa, 0.9);
        g.strokeRect(this.x, this.y, this.width, this.height);

        // ── Zone boundaries ────────────────────────────────────────
        this._renderZones(g);

        // ── Fog of war ─────────────────────────────────────────────
        this._updateFogOfWar();
        this._renderFog(g);

        // ── Enemies (every frame) ──────────────────────────────────
        this._renderEnemies(g);

        // ── NPCs (throttled to every 30 frames) ────────────────────
        this._npcFrameCounter++;
        if (this._npcFrameCounter >= 30) {
            this._npcFrameCounter = 0;
            this._cacheNPCPositions();
        }
        this._renderCachedNPCs(g);

        // ── Camera viewport ────────────────────────────────────────
        this._renderViewport(g);

        // ── Player dot (blink) ─────────────────────────────────────
        this._blinkTimer += delta / 1000;
        if (this._blinkTimer > 0.45) {
            this._blinkTimer = 0;
            this._blinkOn = !this._blinkOn;
        }
        this._renderPlayer(g);
    }

    // ----------------------------------------------------------------
    // Zone boundaries
    // ----------------------------------------------------------------

    _renderZones(g) {
        // Six zones arranged in a 3×2 grid across the 3200×3200 world
        const zoneLayout = [
            { x: 0,    y: 0,    w: 1067, h: 1067 },  // canopy_of_life (top-left)
            { x: 1067, y: 0,    w: 1067, h: 1067 },  // spindlewood_forest (top-center)
            { x: 2134, y: 0,    w: 1066, h: 1067 },  // hollowroot_catacombs (top-right)
            { x: 0,    y: 1067, w: 1067, h: 1066 },  // emerald_cascades (bottom-left)
            { x: 1067, y: 1067, w: 1067, h: 1066 },  // glinting_groves (bottom-center)
            { x: 2134, y: 1067, w: 1066, h: 1066 },  // mycelium_nexus (bottom-right)
        ];

        g.lineStyle(1, 0x334466, 0.35);
        for (const z of zoneLayout) {
            g.strokeRect(
                this.x + z.x * this.scaleX,
                this.y + z.y * this.scaleY,
                z.w * this.scaleX,
                z.h * this.scaleY
            );
        }
    }

    // ----------------------------------------------------------------
    // Fog of war
    // ----------------------------------------------------------------

    _updateFogOfWar() {
        if (!this.player) return;
        const px = this.player.sprite?.x ?? this.player.x ?? 0;
        const py = this.player.sprite?.y ?? this.player.y ?? 0;

        const revealRadius = 3; // cells
        const cellX = Math.floor(px / this.fogCellSize);
        const cellY = Math.floor(py / this.fogCellSize);

        for (let dx = -revealRadius; dx <= revealRadius; dx++) {
            for (let dy = -revealRadius; dy <= revealRadius; dy++) {
                if (dx * dx + dy * dy <= revealRadius * revealRadius) {
                    this.visited.add(`${cellX + dx},${cellY + dy}`);
                }
            }
        }
    }

    _renderFog(g) {
        const cellW = this.fogCellSize * this.scaleX;
        const cellH = this.fogCellSize * this.scaleY;
        const cols = Math.ceil(this.worldWidth  / this.fogCellSize);
        const rows = Math.ceil(this.worldHeight / this.fogCellSize);

        g.fillStyle(0x000000, 0.62);
        for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
                if (!this.visited.has(`${cx},${cy}`)) {
                    g.fillRect(
                        this.x + cx * cellW,
                        this.y + cy * cellH,
                        Math.ceil(cellW) + 1,
                        Math.ceil(cellH) + 1
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
        const px = this.player.sprite?.x ?? this.player.x ?? 0;
        const py = this.player.sprite?.y ?? this.player.y ?? 0;
        const mx = this.x + px * this.scaleX;
        const my = this.y + py * this.scaleY;

        // Outer glow ring (always visible)
        g.fillStyle(0xffd700, 0.25);
        g.fillCircle(mx, my, 6);

        // Solid dot (blinks)
        if (this._blinkOn) {
            g.fillStyle(0xffffff, 1);
            g.fillCircle(mx, my, 4);
        } else {
            g.fillStyle(0xffd700, 0.85);
            g.fillCircle(mx, my, 3);
        }
    }

    _renderEnemies(g) {
        if (!this.enemies) return;

        const entries = this.enemies.children?.entries ?? this.enemies;
        if (!Array.isArray(entries)) return;

        g.fillStyle(0xff3333, 0.85);
        for (const enemy of entries) {
            if (!enemy?.active) continue;
            const ex = enemy.x ?? 0;
            const ey = enemy.y ?? 0;
            const cellKey = `${Math.floor(ex / this.fogCellSize)},${Math.floor(ey / this.fogCellSize)}`;
            if (this.visited.has(cellKey)) {
                g.fillCircle(this.x + ex * this.scaleX, this.y + ey * this.scaleY, 2);
            }
        }
    }

    _cacheNPCPositions() {
        if (!this.npcs) { this._cachedNPCPositions = []; return; }
        this._cachedNPCPositions = this.npcs
            .filter(npc => npc && (npc.sprite?.active !== false))
            .map(npc => ({
                x: npc.sprite?.x ?? npc.x ?? 0,
                y: npc.sprite?.y ?? npc.y ?? 0,
                role: npc.role || 'lore'
            }));
    }

    _renderCachedNPCs(g) {
        for (const pos of this._cachedNPCPositions) {
            const cellKey = `${Math.floor(pos.x / this.fogCellSize)},${Math.floor(pos.y / this.fogCellSize)}`;
            if (!this.visited.has(cellKey)) continue;

            const nx = this.x + pos.x * this.scaleX;
            const ny = this.y + pos.y * this.scaleY;

            // Merchants show as brighter/larger dot; lore/quest NPCs are regular green
            if (pos.role === 'shop' || pos.role === 'merchant') {
                g.fillStyle(0xffcc44, 0.9);  // gold for merchants
                g.fillCircle(nx, ny, 2.5);
            } else if (pos.role === 'veilkeeper') {
                g.fillStyle(0xcc88ff, 0.9);  // purple for veilkeeper
                g.fillCircle(nx, ny, 2.5);
            } else {
                g.fillStyle(0x44ff88, 0.8);  // green for quest/lore NPCs
                g.fillCircle(nx, ny, 1.8);
            }
        }
    }

    _renderViewport(g) {
        if (!this.camera) return;

        const vx = this.x + this.camera.scrollX * this.scaleX;
        const vy = this.y + this.camera.scrollY * this.scaleY;
        const vw = (this.camera.width  / (this.camera.zoom || 1)) * this.scaleX;
        const vh = (this.camera.height / (this.camera.zoom || 1)) * this.scaleY;

        g.lineStyle(1, 0xffffff, 0.28);
        g.strokeRect(vx, vy, vw, vh);
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    destroy() {
        this._gfx.destroy();
        this._zoneLabel.destroy();
        this._hereLabel.destroy();
    }
}
