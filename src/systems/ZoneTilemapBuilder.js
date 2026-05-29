import Phaser from 'phaser';
/**
 * ZoneTilemapBuilder — Renders each zone as a proper tilemap using Kenney/CC0 tilesets.
 *
 * Zone types → tilesets:
 *   hub, market, military         → ts_town  (Kenney Tiny Town, 16×16, 12 cols)
 *   dungeon, underground_city     → ts_dungeon (Kenney Tiny Dungeon, 16×16, 12 cols)
 *   grove, exploration, forest    → enhanced graphics + tree decorations
 *   temple, sacred, shrine        → ts_temple solid-tile
 *   hidden, boss, void            → ts_void solid-tile
 *   (default/catch-all)           → ts_forest solid-tile
 *
 * Tile sizes are 16×16. Each zone is 800×900px = 50 tiles wide × 56 tiles tall.
 *
 * Kenney Tiny Town tile index reference (12 cols × 11 rows, packed):
 *   Row 0  (0–11):   Grass floor variants
 *   Row 1  (12–23):  Dirt / terrain
 *   Row 2  (24–35):  Building walls (top)
 *   Row 3  (36–47):  Building walls (mid)
 *   Row 4  (48–59):  Cobblestone / stone floor
 *   Row 5  (60–71):  Water
 *   Row 6  (72–83):  Sand / path
 *   Row 7  (84–95):  Props (tree, barrel, sign)
 *   Row 8  (96–107): More props
 *   Row 9  (108–119):Fences / structures
 *   Row 10 (120–131):Large decorations
 *
 * Kenney Tiny Dungeon tile index reference (12 cols × 11 rows, packed):
 *   Row 0  (0–11):   Stone floor variants
 *   Row 1  (12–23):  Cracked / worn floor
 *   Row 2  (24–35):  Wall bricks (top)
 *   Row 3  (36–47):  Wall bricks (solid)
 *   Row 4  (48–59):  Dark ceiling / empty
 *   Row 5  (60–71):  Special floors (lava, water)
 *   Row 6  (72–83):  Props (chest, skull, torch)
 *   Row 7  (84–95):  Columns / pillars
 *   Row 8  (96–107): Doors / arches
 *   Row 9  (108–119):Stairs
 *   Row 10 (120–131):Traps / spikes
 */

// ─── Tileset configurations ────────────────────────────────────────────────────
// Each entry: { key, tileW, tileH, cols, floor, wall, deco }
// Tile indices are 0-based.
const TILESET_CONFIGS = {
    ts_town: {
        key:    'ts_town',
        tileW:  16, tileH: 16, cols: 12,
        floor:  [0, 1, 2, 3, 4, 5],        // grass row
        floor2: [48, 49, 50, 51],           // cobblestone (paths, plazas)
        wall:   [24, 25, 36, 37],           // building wall tiles
        deco:   [84, 85, 86, 87, 96, 97],   // props
        border: 24,                          // wall tile used for zone border
    },
    ts_dungeon: {
        key:    'ts_dungeon',
        tileW:  16, tileH: 16, cols: 12,
        floor:  [0, 1, 2, 3],               // stone floor
        floor2: [12, 13, 14],               // cracked floor
        wall:   [36, 37, 38, 48, 49],       // solid wall / ceiling
        deco:   [72, 73, 74, 84, 85],       // chests, bones, torches
        border: 36,
    },
};

// Zone type → tileset key + palette color for Graphics fallback
const ZONE_TYPE_MAP = {
    hub:              { tileset: 'ts_town',    bg: 0x2d4a1e, path: 0x8b7355, border: 0x4a3728 },
    market:           { tileset: 'ts_town',    bg: 0x2d4a1e, path: 0xb8a070, border: 0x5a4535 },
    military:         { tileset: 'ts_town',    bg: 0x3a3a2a, path: 0x7a7a5a, border: 0x4a4a3a },
    settlement:       { tileset: 'ts_town',    bg: 0x2d4a1e, path: 0x8b7355, border: 0x4a3728 },
    city:             { tileset: 'ts_town',    bg: 0x35502a, path: 0xa09060, border: 0x55422a },

    dungeon:          { tileset: 'ts_dungeon', bg: 0x1a1a2e, path: 0x3a3a5a, border: 0x0a0a1a },
    underground_city: { tileset: 'ts_dungeon', bg: 0x2a1a3a, path: 0x4a3a5a, border: 0x1a0a2a },
    catacombs:        { tileset: 'ts_dungeon', bg: 0x1a1525, path: 0x2d2540, border: 0x0d0a15 },

    grove:            { tileset: null, bg: 0x1a3320, path: 0x2d5530, border: 0x0d2215, accent: 0x4dff88 },
    exploration:      { tileset: null, bg: 0x1c3b1a, path: 0x2e5c28, border: 0x0e1e0e, accent: 0x44cc55 },
    forest:           { tileset: null, bg: 0x152e14, path: 0x254d20, border: 0x081508, accent: 0x33bb44 },
    overworld:        { tileset: null, bg: 0x1e3d1a, path: 0x305a25, border: 0x0f1e0a, accent: 0x55dd66 },

    temple:           { tileset: null, bg: 0x1a1a3a, path: 0x2a2a5a, border: 0x0d0d25, accent: 0x8888ff },
    sacred:           { tileset: null, bg: 0x1e1e40, path: 0x303065, border: 0x10103a, accent: 0xaaaaff },
    shrine:           { tileset: null, bg: 0x25253a, path: 0x383855, border: 0x181825, accent: 0x9999ee },

    hidden:           { tileset: null, bg: 0x150a25, path: 0x250a3a, border: 0x080313, accent: 0x9933ff },
    boss:             { tileset: null, bg: 0x1a0a0a, path: 0x2d0a0a, border: 0x0d0505, accent: 0xff3333 },
    void:             { tileset: null, bg: 0x050510, path: 0x0d0d25, border: 0x020208, accent: 0x6622cc },
    corruption:       { tileset: null, bg: 0x200520, path: 0x350a35, border: 0x100310, accent: 0xcc22cc },
};

const DEFAULT_ZONE = { tileset: null, bg: 0x1e3020, path: 0x2e4830, border: 0x0e1810, accent: 0x44aa55 };

const TILE_W = 16;
const TILE_H = 16;

export default class ZoneTilemapBuilder {

    /**
     * Build all visual elements for a single zone.
     * Returns an array of Phaser objects that belong to this zone
     * (tilemaps, graphics, images) — caller can store/destroy them.
     *
     * @param {Phaser.Scene} scene
     * @param {number} zoneX   world-space origin X
     * @param {number} zoneY   world-space origin Y
     * @param {number} zoneW   zone width in pixels (800)
     * @param {number} zoneH   zone height in pixels (900)
     * @param {object} location  DataManager location entry
     * @returns {{ objects: any[], tilemaps: Phaser.Tilemaps.Tilemap[] }}
     */
    static buildZone(scene, zoneX, zoneY, zoneW, zoneH, location) {
        const cfg = ZONE_TYPE_MAP[location.type] || DEFAULT_ZONE;
        const objects = [];
        const tilemaps = [];

        if (cfg.tileset && scene.textures.exists(cfg.tileset)) {
            // ── Kenney tilemap path ──
            const result = ZoneTilemapBuilder._buildTilemapZone(
                scene, zoneX, zoneY, zoneW, zoneH, location, cfg
            );
            objects.push(...result.objects);
            tilemaps.push(...result.tilemaps);
        } else {
            // ── Enhanced Graphics path (forest, temple, void, etc.) ──
            const result = ZoneTilemapBuilder._buildGraphicsZone(
                scene, zoneX, zoneY, zoneW, zoneH, location, cfg
            );
            objects.push(...result.objects);
        }

        return { objects, tilemaps };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Kenney tilemap zones (town & dungeon)
    // ─────────────────────────────────────────────────────────────────────────

    static _buildTilemapZone(scene, zoneX, zoneY, zoneW, zoneH, location, cfg) {
        const tsCfg  = TILESET_CONFIGS[cfg.tileset];
        const cols   = Math.ceil(zoneW / TILE_W);   // 50
        const rows   = Math.ceil(zoneH / TILE_H);   // 56
        const objects = [];
        const tilemaps = [];

        // ── Generate tile data ──
        const floorData  = ZoneTilemapBuilder._genFloorLayer(cols, rows, tsCfg, location.type);
        const wallData   = ZoneTilemapBuilder._genWallLayer(cols, rows, tsCfg, location.type);
        const decoData   = ZoneTilemapBuilder._genDecoLayer(cols, rows, tsCfg, location.type);

        const makeMap = (data, depth) => {
            const map = scene.make.tilemap({ data, tileWidth: TILE_W, tileHeight: TILE_H });
            const tileset = map.addTilesetImage(tsCfg.key, tsCfg.key, TILE_W, TILE_H, 0, 0);
            if (!tileset) return null;
            const layer = map.createLayer(0, tileset, zoneX, zoneY);
            if (layer) layer.setDepth(depth);
            return { map, layer };
        };

        const floor = makeMap(floorData, 0);
        if (floor) { tilemaps.push(floor.map); if (floor.layer) objects.push(floor.layer); }

        const wall = makeMap(wallData, 1);
        if (wall) { tilemaps.push(wall.map); if (wall.layer) objects.push(wall.layer); }

        const deco = makeMap(decoData, 2);
        if (deco) { tilemaps.push(deco.map); if (deco.layer) objects.push(deco.layer); }

        return { objects, tilemaps };
    }

    /**
     * Floor layer: mostly floor tiles, 20% chance of floor2 (path/cobble) in central area.
     * Border row/col use wall tiles.
     */
    static _genFloorLayer(cols, rows, tsCfg, zoneType) {
        const data = [];
        const isDungeon = zoneType === 'dungeon' || zoneType === 'underground_city' || zoneType === 'catacombs';

        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const isEdge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
                if (isEdge) {
                    row.push(tsCfg.border);
                } else {
                    // Randomly choose floor tile
                    const useAlt = Math.random() < 0.2;
                    const arr = useAlt ? tsCfg.floor2 : tsCfg.floor;
                    row.push(arr[Math.floor(Math.random() * arr.length)]);
                }
            }
            data.push(row);
        }

        // Add a central plaza/path strip
        if (!isDungeon) {
            ZoneTilemapBuilder._addPathStrip(data, cols, rows, tsCfg.floor2);
        } else {
            ZoneTilemapBuilder._addCorridor(data, cols, rows, tsCfg.floor2);
        }

        return data;
    }

    /** Wall layer: -1 = transparent, only draw wall tiles at specific spots */
    static _genWallLayer(cols, rows, tsCfg, zoneType) {
        const data = [];
        const isDungeon = zoneType === 'dungeon' || zoneType === 'underground_city';
        const wallThickness = isDungeon ? 2 : 1;

        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const isWallEdge = r < wallThickness || r >= rows - wallThickness ||
                                   c < wallThickness || c >= cols - wallThickness;

                if (isWallEdge) {
                    const wallArr = tsCfg.wall;
                    row.push(wallArr[Math.floor(Math.random() * wallArr.length)]);
                } else {
                    // Occasional internal pillar/support (2% chance, dungeon only)
                    if (isDungeon && Math.random() < 0.02 && r > 4 && c > 4) {
                        row.push(tsCfg.wall[0]);
                    } else {
                        row.push(-1); // transparent
                    }
                }
            }
            data.push(row);
        }
        return data;
    }

    /** Deco layer: sparse prop tiles, mostly -1 */
    static _genDecoLayer(cols, rows, tsCfg, zoneType) {
        const data = [];
        const decoChance = 0.015; // 1.5% per interior tile

        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const isEdge = r <= 2 || r >= rows - 3 || c <= 2 || c >= cols - 3;
                if (!isEdge && Math.random() < decoChance) {
                    const decoArr = tsCfg.deco;
                    row.push(decoArr[Math.floor(Math.random() * decoArr.length)]);
                } else {
                    row.push(-1);
                }
            }
            data.push(row);
        }
        return data;
    }

    /** Carve a horizontal + vertical path cross through the zone */
    static _addPathStrip(data, cols, rows, pathTiles) {
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);
        const w = 3; // path width in tiles

        for (let r = 2; r < rows - 2; r++) {
            for (let dc = -w; dc <= w; dc++) {
                const c = midC + dc;
                if (c > 1 && c < cols - 2) {
                    data[r][c] = pathTiles[Math.floor(Math.random() * pathTiles.length)];
                }
            }
        }
        for (let c = 2; c < cols - 2; c++) {
            for (let dr = -w; dr <= w; dr++) {
                const r = midR + dr;
                if (r > 1 && r < rows - 2) {
                    data[r][c] = pathTiles[Math.floor(Math.random() * pathTiles.length)];
                }
            }
        }
    }

    /** Carve a winding corridor through a dungeon zone */
    static _addCorridor(data, cols, rows, floorTiles) {
        // Horizontal corridor at 1/3 and 2/3 height
        for (const fracR of [0.33, 0.67]) {
            const r = Math.floor(rows * fracR);
            for (let c = 2; c < cols - 2; c++) {
                data[r][c] = floorTiles[0];
                if (r > 2) data[r - 1][c] = floorTiles[0];
            }
        }
        // Vertical connector
        const midC = Math.floor(cols / 2);
        for (let r = 2; r < rows - 2; r++) {
            data[r][midC] = floorTiles[0];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Enhanced Graphics zones (forest, temple, void, etc.)
    // ─────────────────────────────────────────────────────────────────────────

    static _buildGraphicsZone(scene, zoneX, zoneY, zoneW, zoneH, location, cfg) {
        const objects = [];
        const gfx = scene.add.graphics().setDepth(0);
        objects.push(gfx);

        // ── Solid floor fill ──
        gfx.fillStyle(cfg.bg, 1.0);
        gfx.fillRect(zoneX, zoneY, zoneW, zoneH);

        // ── Inner ground texture: subtle tile-grid impression ──
        gfx.lineStyle(1, cfg.path, 0.12);
        for (let x = zoneX; x <= zoneX + zoneW; x += 64) {
            gfx.lineBetween(x, zoneY, x, zoneY + zoneH);
        }
        for (let y = zoneY; y <= zoneY + zoneH; y += 64) {
            gfx.lineBetween(zoneX, y, zoneX + zoneW, y);
        }

        // ── Border wall strip ──
        const borderW = 32;
        gfx.fillStyle(cfg.border, 1.0);
        gfx.fillRect(zoneX, zoneY, zoneW, borderW);           // top
        gfx.fillRect(zoneX, zoneY + zoneH - borderW, zoneW, borderW); // bottom
        gfx.fillRect(zoneX, zoneY + borderW, borderW, zoneH - borderW * 2); // left
        gfx.fillRect(zoneX + zoneW - borderW, zoneY + borderW, borderW, zoneH - borderW * 2); // right

        // ── Zone-type specific features ──
        ZoneTilemapBuilder._addGraphicsFeatures(gfx, scene, zoneX, zoneY, zoneW, zoneH, location, cfg, objects);

        // ── Zone border glow ──
        gfx.lineStyle(2, cfg.accent || cfg.path, 0.6);
        gfx.strokeRect(zoneX + borderW, zoneY + borderW, zoneW - borderW * 2, zoneH - borderW * 2);

        return { objects };
    }

    static _addGraphicsFeatures(gfx, scene, zoneX, zoneY, zoneW, zoneH, location, cfg, objects) {
        const type = location.type;
        const rng  = (min, max) => min + Math.random() * (max - min);
        const rngI = (min, max) => Math.floor(rng(min, max + 1));
        const accent = cfg.accent || 0x44cc55;

        if (type === 'grove' || type === 'exploration' || type === 'forest' || type === 'overworld') {
            // Forest/grove: central clearing with scattered foliage patches
            ZoneTilemapBuilder._drawForestZone(gfx, scene, zoneX, zoneY, zoneW, zoneH, cfg, accent, objects);

        } else if (type === 'temple' || type === 'sacred' || type === 'shrine') {
            // Temple: stone tile floor with columns and altar platform
            ZoneTilemapBuilder._drawTempleZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent);

        } else if (type === 'hidden') {
            // Hidden: misty purple with glowing crystal clusters
            ZoneTilemapBuilder._drawHiddenZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent);

        } else if (type === 'boss') {
            // Boss: arena circle with dramatic floor patterns
            ZoneTilemapBuilder._drawBossZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent);

        } else if (type === 'void' || type === 'corruption') {
            // Void: fractured dark tiles with corruption veins
            ZoneTilemapBuilder._drawVoidZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent);

        } else {
            // Default: simple checkerboard scatter
            gfx.fillStyle(cfg.path, 0.15);
            for (let i = 0; i < 30; i++) {
                const px = zoneX + 40 + rng(0, zoneW - 80);
                const py = zoneY + 40 + rng(0, zoneH - 80);
                const sz = rngI(8, 24);
                gfx.fillRect(px, py, sz, sz);
            }
        }
    }

    static _drawForestZone(gfx, scene, zoneX, zoneY, zoneW, zoneH, cfg, accent, objects) {
        const cx = zoneX + zoneW / 2;
        const cy = zoneY + zoneH / 2;

        // Central clearing (lighter ground)
        gfx.fillStyle(cfg.path, 0.2);
        gfx.fillEllipse(cx, cy, zoneW * 0.45, zoneH * 0.4);

        // Scattered foliage patches
        gfx.fillStyle(accent, 0.12);
        for (let i = 0; i < 25; i++) {
            const px = zoneX + 60 + Math.random() * (zoneW - 120);
            const py = zoneY + 60 + Math.random() * (zoneH - 120);
            const r  = 15 + Math.random() * 30;
            gfx.fillCircle(px, py, r);
        }

        // Flower spots
        gfx.fillStyle(accent, 0.4);
        for (let i = 0; i < 40; i++) {
            const px = zoneX + 40 + Math.random() * (zoneW - 80);
            const py = zoneY + 40 + Math.random() * (zoneH - 80);
            gfx.fillCircle(px, py, 3);
        }

        // Dirt path cross
        gfx.fillStyle(cfg.path, 0.35);
        gfx.fillRect(cx - 20, zoneY + 32, 40, zoneH - 64);
        gfx.fillRect(zoneX + 32, cy - 20, zoneW - 64, 40);
    }

    static _drawTempleZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent) {
        const cx = zoneX + zoneW / 2;
        const cy = zoneY + zoneH / 2;

        // Stone tile floor pattern (alternating)
        gfx.fillStyle(cfg.path, 0.18);
        for (let r = 0; r < 14; r++) {
            for (let c = 0; c < 12; c++) {
                if ((r + c) % 2 === 0) {
                    gfx.fillRect(zoneX + 32 + c * 61, zoneY + 32 + r * 61, 60, 60);
                }
            }
        }

        // Altar platform
        gfx.fillStyle(cfg.path, 0.4);
        gfx.fillRect(cx - 80, cy - 60, 160, 120);
        gfx.fillStyle(accent, 0.15);
        gfx.fillRect(cx - 60, cy - 40, 120, 80);

        // Columns (4 corners of altar)
        gfx.fillStyle(cfg.path, 0.6);
        const colPositions = [[-90, -70], [90, -70], [-90, 70], [90, 70]];
        for (const [dx, dy] of colPositions) {
            gfx.fillRect(cx + dx - 8, cy + dy - 16, 16, 32);
        }

        // Glowing altar rune
        gfx.fillStyle(accent, 0.35);
        gfx.fillCircle(cx, cy, 24);
        gfx.fillStyle(accent, 0.6);
        gfx.fillCircle(cx, cy, 10);
    }

    static _drawHiddenZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent) {
        const cx = zoneX + zoneW / 2;
        const cy = zoneY + zoneH / 2;

        // Mist pockets
        gfx.fillStyle(accent, 0.06);
        for (let i = 0; i < 12; i++) {
            const px = zoneX + 40 + Math.random() * (zoneW - 80);
            const py = zoneY + 40 + Math.random() * (zoneH - 80);
            gfx.fillEllipse(px, py, 80 + Math.random() * 120, 50 + Math.random() * 80);
        }

        // Crystal formations
        gfx.fillStyle(accent, 0.5);
        const crystalClusters = 8;
        for (let i = 0; i < crystalClusters; i++) {
            const px = zoneX + 60 + Math.random() * (zoneW - 120);
            const py = zoneY + 60 + Math.random() * (zoneH - 120);
            const h  = 20 + Math.random() * 30;
            const w  = 6 + Math.random() * 8;
            // Diamond/crystal shape
            gfx.fillTriangle(px, py - h, px - w, py, px + w, py);
            gfx.fillRect(px - w * 0.6, py, w * 1.2, h * 0.5);
        }

        // Central portal ring
        gfx.lineStyle(3, accent, 0.7);
        gfx.strokeCircle(cx, cy, 60);
        gfx.lineStyle(1, accent, 0.4);
        gfx.strokeCircle(cx, cy, 45);
        gfx.strokeCircle(cx, cy, 75);
        gfx.fillStyle(accent, 0.08);
        gfx.fillCircle(cx, cy, 58);
    }

    static _drawBossZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent) {
        const cx = zoneX + zoneW / 2;
        const cy = zoneY + zoneH / 2;

        // Arena floor: concentric rings
        gfx.fillStyle(cfg.path, 0.3);
        gfx.fillCircle(cx, cy, Math.min(zoneW, zoneH) * 0.42);
        gfx.fillStyle(cfg.bg, 0.5);
        gfx.fillCircle(cx, cy, Math.min(zoneW, zoneH) * 0.38);
        gfx.fillStyle(cfg.path, 0.15);
        gfx.fillCircle(cx, cy, Math.min(zoneW, zoneH) * 0.34);

        // Ring stripes
        gfx.lineStyle(3, accent, 0.5);
        gfx.strokeCircle(cx, cy, Math.min(zoneW, zoneH) * 0.42);
        gfx.lineStyle(1, accent, 0.25);
        gfx.strokeCircle(cx, cy, Math.min(zoneW, zoneH) * 0.34);
        gfx.strokeCircle(cx, cy, Math.min(zoneW, zoneH) * 0.28);

        // Radial lines (8 spokes)
        gfx.lineStyle(2, accent, 0.2);
        for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const r   = Math.min(zoneW, zoneH) * 0.42;
            gfx.lineBetween(cx, cy, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        }

        // Central summoning circle
        gfx.fillStyle(accent, 0.18);
        gfx.fillCircle(cx, cy, 40);
        gfx.lineStyle(2, accent, 0.8);
        gfx.strokeCircle(cx, cy, 40);

        // Bloody cracks radiating out
        gfx.lineStyle(2, 0x660000, 0.4);
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const len = 100 + Math.random() * 150;
            gfx.lineBetween(
                cx + Math.cos(ang) * 40,
                cy + Math.sin(ang) * 40,
                cx + Math.cos(ang + 0.15) * len,
                cy + Math.sin(ang + 0.15) * len
            );
        }
    }

    static _drawVoidZone(gfx, zoneX, zoneY, zoneW, zoneH, cfg, accent) {
        const cx = zoneX + zoneW / 2;
        const cy = zoneY + zoneH / 2;

        // Fractured tiles: broken rectangle grid
        gfx.fillStyle(cfg.path, 0.25);
        for (let r = 0; r < 12; r++) {
            for (let c = 0; c < 10; c++) {
                if (Math.random() < 0.55) {
                    const ox = zoneX + 32 + c * 74 + (Math.random() - 0.5) * 10;
                    const oy = zoneY + 32 + r * 70 + (Math.random() - 0.5) * 10;
                    const sw = 60 + (Math.random() - 0.5) * 20;
                    const sh = 56 + (Math.random() - 0.5) * 16;
                    gfx.fillRect(ox, oy, sw, sh);
                }
            }
        }

        // Corruption veins (jagged lines)
        gfx.lineStyle(2, accent, 0.4);
        for (let i = 0; i < 10; i++) {
            let px = zoneX + 40 + Math.random() * (zoneW - 80);
            let py = zoneY + 40 + Math.random() * (zoneH - 80);
            const segments = 6 + Math.floor(Math.random() * 6);
            for (let s = 0; s < segments; s++) {
                const nx = px + (Math.random() - 0.5) * 120;
                const ny = py + (Math.random() - 0.5) * 80;
                gfx.lineBetween(px, py, nx, ny);
                px = nx; py = ny;
            }
        }

        // Void singularity at center
        gfx.fillStyle(0x000000, 0.8);
        gfx.fillCircle(cx, cy, 30);
        gfx.lineStyle(2, accent, 0.9);
        gfx.strokeCircle(cx, cy, 30);
        gfx.lineStyle(1, accent, 0.4);
        gfx.strokeCircle(cx, cy, 50);
        gfx.strokeCircle(cx, cy, 75);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Static helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called from BootScene to register what tileset keys to load.
     * Returns an array of { key, path, tileW, tileH } for caller to load.
     */
    static getTilesetLoadList() {
        return [
            { key: 'ts_town',    path: 'assets/tilesets/tiny_town/Tilemap/tilemap_packed.png',    tileW: 16, tileH: 16 },
            { key: 'ts_dungeon', path: 'assets/tilesets/tiny_dungeon/Tilemap/tilemap_packed.png', tileW: 16, tileH: 16 },
        ];
    }
}
