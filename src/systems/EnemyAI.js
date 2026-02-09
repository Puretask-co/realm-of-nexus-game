// src/systems/EnemyAI.js
// Enemy AI behavior system with 4 distinct personality types:
// Aggressive, Defensive, Tactical, Support

export default class EnemyAI {
  constructor(scene) {
    this.scene = scene;
  }

  executeTurn(enemy) {
    console.log(`AI executing turn for ${enemy.stats.name} (${enemy.stats.aiType})`);

    switch (enemy.stats.aiType) {
      case 'aggressive':
        this.aggressiveBehavior(enemy);
        break;
      case 'defensive':
        this.defensiveBehavior(enemy);
        break;
      case 'tactical':
        this.tacticalBehavior(enemy);
        break;
      case 'support':
        this.supportBehavior(enemy);
        break;
      default:
        this.aggressiveBehavior(enemy);
    }
  }

  // Always pursues and attacks the player
  aggressiveBehavior(enemy) {
    const player = this.scene.player;
    const distanceToPlayer = this.getDistance(enemy.tile, player.tile);

    if (distanceToPlayer <= enemy.stats.attackRange) {
      this.scene.time.delayedCall(500, () => {
        this.scene.executeBasicAttack(enemy, player);
        this.scene.time.delayedCall(1500, () => {
          this.scene.endTurn();
        });
      });
    } else {
      const pathToPlayer = this.findPathToTarget(enemy, player.tile);
      if (pathToPlayer && pathToPlayer.length > 0) {
        const moveDistance = Math.min(enemy.stats.moveRange, pathToPlayer.length);
        const movePath = pathToPlayer.slice(0, moveDistance);

        this.moveEnemyAlongPath(enemy, movePath, () => {
          const newDistance = this.getDistance(enemy.tile, player.tile);
          if (newDistance <= enemy.stats.attackRange) {
            this.scene.time.delayedCall(300, () => {
              this.scene.executeBasicAttack(enemy, player);
              this.scene.time.delayedCall(1500, () => {
                this.scene.endTurn();
              });
            });
          } else {
            this.scene.time.delayedCall(800, () => {
              this.scene.endTurn();
            });
          }
        });
      } else {
        this.scene.time.delayedCall(800, () => {
          this.scene.endTurn();
        });
      }
    }
  }

  // Maintains distance, retreats when too close, defends
  defensiveBehavior(enemy) {
    const player = this.scene.player;
    const distanceToPlayer = this.getDistance(enemy.tile, player.tile);

    if (distanceToPlayer < 2) {
      // Too close - retreat
      const retreatTile = this.findRetreatTile(enemy, player.tile);
      if (retreatTile) {
        const pathToRetreat = this.findPathToTarget(enemy, retreatTile);
        if (pathToRetreat && pathToRetreat.length > 0) {
          const moveDistance = Math.min(enemy.stats.moveRange, pathToRetreat.length);
          const movePath = pathToRetreat.slice(0, moveDistance);

          this.moveEnemyAlongPath(enemy, movePath, () => {
            this.scene.time.delayedCall(300, () => {
              this.applyDefend(enemy);
            });
          });
          return;
        }
      }
      // Can't retreat - defend in place
      this.applyDefend(enemy);
    } else if (distanceToPlayer <= enemy.stats.attackRange && distanceToPlayer >= 2) {
      // Good distance - attack from safety
      this.scene.time.delayedCall(500, () => {
        this.scene.executeBasicAttack(enemy, player);
        this.scene.time.delayedCall(1500, () => {
          this.scene.endTurn();
        });
      });
    } else {
      // Maintain position and defend
      this.applyDefend(enemy);
    }
  }

  // Adapts based on HP, tries to flank
  tacticalBehavior(enemy) {
    const player = this.scene.player;
    const distanceToPlayer = this.getDistance(enemy.tile, player.tile);
    const hpPercentage = enemy.stats.hp / enemy.stats.maxHp;

    if (hpPercentage < 0.3) {
      // Low HP - retreat and defend
      this.defensiveBehavior(enemy);
    } else if (hpPercentage > 0.7 && distanceToPlayer <= 2) {
      // High HP and close - be aggressive
      this.aggressiveBehavior(enemy);
    } else {
      // Mid HP - try to flank
      const flankTile = this.findFlankingPosition(enemy, player);
      if (flankTile) {
        const pathToFlank = this.findPathToTarget(enemy, flankTile);
        if (pathToFlank && pathToFlank.length > 0) {
          const moveDistance = Math.min(enemy.stats.moveRange, pathToFlank.length);
          const movePath = pathToFlank.slice(0, moveDistance);

          this.moveEnemyAlongPath(enemy, movePath, () => {
            const newDistance = this.getDistance(enemy.tile, player.tile);
            if (newDistance <= enemy.stats.attackRange) {
              this.scene.time.delayedCall(300, () => {
                this.scene.executeBasicAttack(enemy, player);
                this.scene.time.delayedCall(1500, () => {
                  this.scene.endTurn();
                });
              });
            } else {
              this.scene.time.delayedCall(800, () => {
                this.scene.endTurn();
              });
            }
          });
          return;
        }
      }
      // No flanking opportunity - attack normally
      this.aggressiveBehavior(enemy);
    }
  }

  // Stays back, defensive (placeholder for future healing)
  supportBehavior(enemy) {
    this.applyDefend(enemy);
  }

  // --- Helper Methods ---

  applyDefend(enemy) {
    enemy.stats.defendBonus = Math.floor(enemy.stats.defense * 0.5);
    this.scene.showMessage(`${enemy.stats.name} defends`, 0x88aaff);
    this.scene.time.delayedCall(1000, () => {
      this.scene.endTurn();
    });
  }

  getDistance(tileA, tileB) {
    const dx = Math.abs(tileA.col - tileB.col);
    const dy = Math.abs(tileA.row - tileB.row);
    return Math.max(dx, dy);
  }

  findPathToTarget(enemy, targetTile) {
    return this.scene.gridManager.findPath(enemy.tile, targetTile);
  }

  findRetreatTile(enemy, threatTile) {
    const reachable = this.scene.gridManager.getReachableTiles(
      enemy.tile,
      enemy.stats.moveRange
    );

    let bestTile = null;
    let maxDistance = -1;

    reachable.forEach((tile) => {
      if (!tile.occupant && tile.walkable) {
        const distance = this.getDistance(tile, threatTile);
        if (distance > maxDistance) {
          maxDistance = distance;
          bestTile = tile;
        }
      }
    });

    return bestTile;
  }

  findFlankingPosition(enemy, player) {
    const playerTile = player.tile;
    const currentTile = enemy.tile;

    const reachable = this.scene.gridManager.getReachableTiles(
      currentTile,
      enemy.stats.moveRange
    );

    const goodPositions = reachable.filter((tile) => {
      if (tile.occupant || !tile.walkable) return false;

      const dx = tile.col - playerTile.col;
      const dy = tile.row - playerTile.row;
      const currentDx = currentTile.col - playerTile.col;
      const currentDy = currentTile.row - playerTile.row;

      // Dot product < 0 means opposite side (flanking)
      const dotProduct = dx * currentDx + dy * currentDy;
      return dotProduct < 0;
    });

    if (goodPositions.length > 0) {
      let closest = goodPositions[0];
      let minDist = this.getDistance(currentTile, closest);

      goodPositions.forEach((tile) => {
        const dist = this.getDistance(currentTile, tile);
        if (dist < minDist) {
          minDist = dist;
          closest = tile;
        }
      });

      return closest;
    }

    return null;
  }

  moveEnemyAlongPath(enemy, path, onComplete) {
    let currentIndex = 0;

    const moveToNext = () => {
      if (currentIndex >= path.length) {
        onComplete();
        return;
      }

      const nextTile = path[currentIndex];

      // Update occupancy
      enemy.tile.occupant = null;
      nextTile.occupant = enemy;
      enemy.tile = nextTile;

      // Animate movement
      this.scene.tweens.add({
        targets: enemy,
        x: nextTile.x,
        y: nextTile.y,
        duration: 300,
        ease: 'Linear',
        onComplete: () => {
          this.scene.updateHealthBarPosition(enemy);
          currentIndex++;
          moveToNext();
        },
      });
    };

    moveToNext();
  }
}
