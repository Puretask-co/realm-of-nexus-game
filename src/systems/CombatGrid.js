// src/systems/CombatGrid.js
// Hex grid system for tactical combat positioning
// Implements flat-top hexagon layout with A* pathfinding

export default class CombatGrid {
  constructor(scene, config = {}) {
    this.scene = scene;

    // Grid configuration
    this.rows = config.rows || 6;
    this.cols = config.cols || 8;
    this.hexSize = config.hexSize || 48;
    this.gridOffsetX = config.offsetX || 100;
    this.gridOffsetY = config.offsetY || 100;

    // Grid data structure
    this.tiles = []; // 2D array of tile objects
    this.obstacles = [];
    this.highlightedTiles = [];

    this.initializeGrid();
  }

  initializeGrid() {
    for (let row = 0; row < this.rows; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const hex = this.createHexTile(row, col);
        this.tiles[row][col] = hex;
      }
    }
    console.log(`Grid initialized: ${this.rows}x${this.cols} = ${this.rows * this.cols} tiles`);
  }

  createHexTile(row, col) {
    // Calculate hex position (flat-top hexagons)
    const x = this.gridOffsetX + col * (this.hexSize * 1.5);
    const y =
      this.gridOffsetY +
      row * (this.hexSize * Math.sqrt(3)) +
      (col % 2 === 1 ? (this.hexSize * Math.sqrt(3)) / 2 : 0);

    // Create visual hex
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0x4a7c59, 0.4);
    graphics.fillStyle(0x2d5a3d, 0.2);

    // Draw hexagon
    const points = this.getHexagonPoints(x, y);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
    graphics.fillPath();

    // Create tile data object
    const tile = {
      row: row,
      col: col,
      x: x,
      y: y,
      graphics: graphics,
      walkable: true,
      occupant: null,
      terrain: 'normal', // 'normal', 'difficult', 'blocking'
      highlight: null,
      costModifier: 1.0,
    };

    // Make tile interactive
    graphics.setInteractive(
      new Phaser.Geom.Polygon(points),
      Phaser.Geom.Polygon.Contains
    );

    graphics.on('pointerover', () => this.onTileHover(tile));
    graphics.on('pointerout', () => this.onTileExit(tile));
    graphics.on('pointerdown', () => this.onTileClick(tile));

    return tile;
  }

  getHexagonPoints(centerX, centerY) {
    const points = [];
    const size = this.hexSize;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push({
        x: centerX + size * Math.cos(angle),
        y: centerY + size * Math.sin(angle),
      });
    }
    return points;
  }

  onTileHover(tile) {
    if (!tile.highlight && tile.walkable) {
      this.drawTile(tile, 2, 0x88ff88, 0.8, 0x4a7c59, 0.4);
    }
  }

  onTileExit(tile) {
    if (!tile.highlight) {
      this.resetTileVisual(tile);
    }
  }

  onTileClick(tile) {
    console.log(`Tile clicked: (${tile.row}, ${tile.col})`);
    this.scene.events.emit('tile-clicked', tile);
  }

  drawTile(tile, lineWidth, lineColor, lineAlpha, fillColor, fillAlpha) {
    tile.graphics.clear();
    tile.graphics.lineStyle(lineWidth, lineColor, lineAlpha);
    tile.graphics.fillStyle(fillColor, fillAlpha);
    const points = this.getHexagonPoints(tile.x, tile.y);
    tile.graphics.beginPath();
    tile.graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      tile.graphics.lineTo(points[i].x, points[i].y);
    }
    tile.graphics.closePath();
    tile.graphics.strokePath();
    tile.graphics.fillPath();
  }

  resetTileVisual(tile) {
    this.drawTile(tile, 2, 0x4a7c59, 0.4, 0x2d5a3d, 0.2);
  }

  getTileAt(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.tiles[row][col];
    }
    return null;
  }

  getNeighbors(tile) {
    const neighbors = [];
    const { row, col } = tile;

    // Hex grid neighbor offsets (flat-top orientation)
    const offsets =
      col % 2 === 0
        ? [[-1, 0], [-1, 1], [0, 1], [1, 0], [0, -1], [-1, -1]]
        : [[-1, 0], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]];

    offsets.forEach(([dRow, dCol]) => {
      const neighbor = this.getTileAt(row + dRow, col + dCol);
      if (neighbor) {
        neighbors.push(neighbor);
      }
    });

    return neighbors;
  }

  clearHighlights() {
    this.highlightedTiles.forEach((tile) => {
      tile.highlight = null;
      this.resetTileVisual(tile);
    });
    this.highlightedTiles = [];
  }

  highlightMovementRange(fromTile, moveRange) {
    this.clearHighlights();
    const reachable = this.getReachableTiles(fromTile, moveRange);

    reachable.forEach((tile) => {
      if (!tile.occupant && tile.walkable && tile !== fromTile) {
        this.drawTile(tile, 3, 0x88ff88, 1.0, 0x66dd66, 0.3);
        tile.highlight = 'movement';
        this.highlightedTiles.push(tile);
      }
    });
  }

  highlightAttackRange(fromTile, attackRange) {
    const reachable = this.getReachableTiles(fromTile, attackRange);

    reachable.forEach((tile) => {
      if (tile.occupant && tile.occupant.isEnemy && tile.occupant.stats.hp > 0) {
        this.drawTile(tile, 3, 0xff6666, 1.0, 0xff3333, 0.4);
        tile.highlight = 'attack';
        this.highlightedTiles.push(tile);
      }
    });
  }

  highlightAoECastRange(fromTile, range) {
    const reachable = this.getReachableTiles(fromTile, range);

    reachable.forEach((tile) => {
      if (tile.walkable) {
        this.drawTile(tile, 3, 0x8888ff, 1.0, 0x6666ff, 0.3);
        tile.highlight = 'aoe_cast';
        this.highlightedTiles.push(tile);
      }
    });
  }

  getReachableTiles(fromTile, maxDistance) {
    const reachable = [];
    const visited = new Set();
    const queue = [{ tile: fromTile, distance: 0 }];

    while (queue.length > 0) {
      const { tile, distance } = queue.shift();
      const key = `${tile.row},${tile.col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (distance <= maxDistance) {
        reachable.push(tile);
        const neighbors = this.getNeighbors(tile);
        neighbors.forEach((neighbor) => {
          if (neighbor.walkable) {
            const cost = neighbor.costModifier;
            queue.push({ tile: neighbor, distance: distance + cost });
          }
        });
      }
    }

    return reachable;
  }

  // A* pathfinding
  findPath(startTile, endTile) {
    const openSet = [startTile];
    const closedSet = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();

    gScore.set(startTile, 0);
    fScore.set(startTile, this.heuristic(startTile, endTile));

    while (openSet.length > 0) {
      openSet.sort(
        (a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity)
      );
      const current = openSet.shift();

      if (current === endTile) {
        return this.reconstructPath(cameFrom, current);
      }

      closedSet.add(current);
      const neighbors = this.getNeighbors(current);

      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;
        if (!neighbor.walkable || (neighbor.occupant && neighbor !== endTile)) {
          continue;
        }

        const tentativeGScore =
          (gScore.get(current) || Infinity) + neighbor.costModifier;

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= (gScore.get(neighbor) || Infinity)) {
          continue;
        }

        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(
          neighbor,
          tentativeGScore + this.heuristic(neighbor, endTile)
        );
      }
    }

    return null; // No path found
  }

  heuristic(tileA, tileB) {
    const dx = Math.abs(tileA.col - tileB.col);
    const dy = Math.abs(tileA.row - tileB.row);
    return dx + dy;
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    path.shift(); // Remove starting tile
    return path;
  }

  // Hex distance using cube coordinates
  getHexDistance(tileA, tileB) {
    const axialToCube = (col, row) => {
      const x = col;
      const z = row - (col - (col & 1)) / 2;
      const y = -x - z;
      return { x, y, z };
    };

    const cubeA = axialToCube(tileA.col, tileA.row);
    const cubeB = axialToCube(tileB.col, tileB.row);

    return (
      (Math.abs(cubeA.x - cubeB.x) +
        Math.abs(cubeA.y - cubeB.y) +
        Math.abs(cubeA.z - cubeB.z)) /
      2
    );
  }

  getTilesInRadius(centerTile, radius) {
    const tiles = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const tile = this.tiles[row][col];
        const distance = this.getHexDistance(centerTile, tile);
        if (distance <= radius) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  addObstacle(row, col, terrainType = 'blocking') {
    const tile = this.getTileAt(row, col);
    if (tile) {
      tile.walkable = terrainType !== 'blocking';
      tile.terrain = terrainType;
      tile.costModifier = terrainType === 'difficult' ? 2.0 : 1.0;

      // Visual update for obstacle
      if (terrainType === 'blocking') {
        this.drawTile(tile, 2, 0x664422, 0.6, 0x442211, 0.5);
      } else if (terrainType === 'difficult') {
        this.drawTile(tile, 2, 0x887744, 0.5, 0x554433, 0.3);
      }
      this.obstacles.push(tile);
    }
  }

  destroy() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.tiles[row][col] && this.tiles[row][col].graphics) {
          this.tiles[row][col].graphics.destroy();
        }
      }
    }
    this.tiles = [];
    this.highlightedTiles = [];
    this.obstacles = [];
  }
}
