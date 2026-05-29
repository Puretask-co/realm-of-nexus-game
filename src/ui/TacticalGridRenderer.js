import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { TacticalCombatSystem } from '../systems/TacticalCombatSystem.js';

/**
 * TacticalGridRenderer — draws the actual battlefield for grid combat.
 *
 * TacticalCombatSystem already runs the full grid simulation (AP, movement,
 * flank/cover, pathfinding) and emits an event stream + getCombatState(); the
 * old TacticalCombatPanel only showed a text/intent strip, so the battlefield
 * was invisible. This renderer fills that gap:
 *
 *   - grid tiles in the screen area above the action bar
 *   - ally (blue) and enemy (red) tokens with name + HP/Guard bars
 *   - current-actor highlight + reachable-move tiles on the active turn
 *   - click a reachable tile to move; click an adjacent enemy to attack
 *
 * It is purely a view + input layer: all mutations go through the system's
 * public actions (moveAction / attackAction), and it re-reads getCombatState()
 * after every relevant event.
 */
export class TacticalGridRenderer {
    constructor(scene) {
        this.scene = scene;
        this.eventBus = EventBus.getInstance();
        this.tactical = TacticalCombatSystem.getInstance();

        this.container = null;
        this.gridGfx = null;        // tile + highlight graphics
        this.tokenLayer = null;     // container for unit tokens
        this.visible = false;

        // Layout (computed per combat from grid dims).
        this._origin = { x: 0, y: 0 };
        this._cell = 48;
        this._reachable = [];       // [{x,y}] reachable tiles for current actor
        this._isPlayerTurn = false;
    }

    create() {
        this.container = this.scene.add.container(0, 0).setDepth(14000).setScrollFactor(0);
        this.container.setVisible(false);

        this.gridGfx = this.scene.add.graphics();
        this.container.add(this.gridGfx);

        this.tokenLayer = this.scene.add.container(0, 0);
        this.container.add(this.tokenLayer);

        // Click handling for move / attack on the active player turn.
        this._onPointerDown = (pointer) => this._handleClick(pointer);
        this.scene.input.on('pointerdown', this._onPointerDown);

        this._unsubs = [
            this.eventBus.on('tactical:combatStarted', () => this.show()),
            this.eventBus.on('tactical:combatEnded', () => this.hide()),
            this.eventBus.on('tactical:turnStart', (d) => this._onTurnStart(d)),
            this.eventBus.on('tactical:moved', () => this._redraw()),
            this.eventBus.on('tactical:attacked', (d) => { this._onAttacked(d); this._redraw(); }),
            this.eventBus.on('tactical:attackMissed', (d) => this._onMissed(d)),
            this.eventBus.on('tactical:defended', () => this._redraw()),
            this.eventBus.on('tactical:spellCast', () => this._redraw()),
            this.eventBus.on('tactical:combatantDefeated', () => this._redraw()),
            this.eventBus.on('tactical:undone', () => this._redraw()),
        ];
    }

    // ----------------------------------------------------------------
    // Show / hide
    // ----------------------------------------------------------------

    show() {
        this._computeLayout();
        this.visible = true;
        this.container.setVisible(true);
        this._redraw();
    }

    hide() {
        this.visible = false;
        this.container.setVisible(false);
        this._reachable = [];
    }

    /**
     * Fit the grid into the screen area above the action bar (which occupies
     * the bottom ~140px). Centres the grid horizontally.
     */
    _computeLayout() {
        const state = this.tactical.getCombatState();
        const cols = this.tactical.gridWidth || 12;
        const rows = this.tactical.gridHeight || 8;

        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        const topPad = 70;        // leave room for the HUD at the top
        const bottomPad = 160;    // action bar lives in the bottom 140px
        const availW = W - 40;
        const availH = H - topPad - bottomPad;

        this._cell = Math.max(24, Math.floor(Math.min(availW / cols, availH / rows)));
        const gridW = this._cell * cols;
        const gridH = this._cell * rows;
        this._origin = { x: Math.round((W - gridW) / 2), y: Math.round(topPad + (availH - gridH) / 2) };
        this._cols = cols;
        this._rows = rows;
    }

    // ----------------------------------------------------------------
    // Coordinate helpers
    // ----------------------------------------------------------------

    _cellToScreen(gx, gy) {
        return {
            x: this._origin.x + gx * this._cell,
            y: this._origin.y + gy * this._cell,
        };
    }

    _screenToCell(sx, sy) {
        const gx = Math.floor((sx - this._origin.x) / this._cell);
        const gy = Math.floor((sy - this._origin.y) / this._cell);
        if (gx < 0 || gy < 0 || gx >= this._cols || gy >= this._rows) return null;
        return { x: gx, y: gy };
    }

    // ----------------------------------------------------------------
    // Turn handling
    // ----------------------------------------------------------------

    _onTurnStart(data) {
        const isPlayer = data?.entity?.side === 'ally';
        this._isPlayerTurn = isPlayer;
        this._reachable = [];

        if (isPlayer) {
            const actor = this.tactical.currentActor?.entity;
            if (actor) {
                const range = actor.stats?.speed || 4;
                this._reachable = this.tactical.getReachableTiles(actor.gridX, actor.gridY, range) || [];
            }
        }
        this._redraw();
    }

    // ----------------------------------------------------------------
    // Input → actions
    // ----------------------------------------------------------------

    /**
     * Enter spell-targeting mode. While active, the next grid click resolves
     * the spell via onPick(cell) instead of move/attack. Highlights tiles in
     * range. Returns nothing; call cancelTargeting() to abort.
     */
    enterTargeting(spell, onPick) {
        this._targeting = { spell, onPick };
        const actor = this.tactical.currentActor?.entity;
        const range = spell.range ?? 0;
        this._targetTiles = [];
        if (actor && range > 0) {
            for (let gx = 0; gx < this._cols; gx++) {
                for (let gy = 0; gy < this._rows; gy++) {
                    if (this.tactical.getDistance(actor.gridX, actor.gridY, gx, gy) <= range) {
                        this._targetTiles.push({ x: gx, y: gy });
                    }
                }
            }
        }
        this._redraw();
    }

    cancelTargeting() {
        this._targeting = null;
        this._targetTiles = [];
        this._redraw();
    }

    _handleClick(pointer) {
        if (!this.visible || !this._isPlayerTurn) return;
        const cell = this._screenToCell(pointer.x, pointer.y);
        if (!cell) return;

        // Spell-targeting mode intercepts the click.
        if (this._targeting) {
            const t = this._targeting;
            this._targeting = null;
            this._targetTiles = [];
            t.onPick?.(cell);
            this._afterAction();
            return;
        }

        const state = this.tactical.getCombatState();

        // Clicked an enemy → attack it (the system validates range/AP).
        const enemy = state.enemies.find(e => e.alive && e.gridX === cell.x && e.gridY === cell.y);
        if (enemy) {
            const entity = this.tactical.enemies.find(e => e.id === enemy.id);
            const r = entity ? this.tactical.attackAction(entity) : { success: false };
            if (!r?.success) this._flash(cell, 0xff4444);
            this._afterAction();
            return;
        }

        // Clicked a reachable tile → move there.
        const reachable = this._reachable.some(t => t.x === cell.x && t.y === cell.y);
        if (reachable) {
            const r = this.tactical.moveAction(cell.x, cell.y);
            if (r?.success) {
                const actor = this.tactical.currentActor?.entity;
                if (actor) {
                    const range = actor.stats?.speed || 4;
                    this._reachable = this.tactical.getReachableTiles(actor.gridX, actor.gridY, range) || [];
                }
            } else {
                this._flash(cell, 0xff4444);
            }
            this._afterAction();
        }
    }

    _afterAction() {
        // If the actor is out of AP, the player can still press End Turn in the
        // panel; we just refresh the view.
        this._redraw();
    }

    // ----------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------

    _redraw() {
        if (!this.visible) return;
        const state = this.tactical.getCombatState();
        if (!state.inCombat) return; // combat ended; hide() will clear us
        const g = this.gridGfx;
        g.clear();
        this.tokenLayer.removeAll(true);

        const cell = this._cell;
        const actor = state.currentActor;

        // ── Tiles ────────────────────────────────────────────────────
        for (let gx = 0; gx < this._cols; gx++) {
            for (let gy = 0; gy < this._rows; gy++) {
                const { x, y } = this._cellToScreen(gx, gy);
                const checker = (gx + gy) % 2 === 0;
                g.fillStyle(checker ? 0x18202e : 0x141a26, 0.82);
                g.fillRect(x, y, cell - 1, cell - 1);
            }
        }

        // ── Reachable-move highlight (player turn, not while targeting) ──
        if (this._isPlayerTurn && !this._targeting) {
            for (const t of this._reachable) {
                const { x, y } = this._cellToScreen(t.x, t.y);
                g.fillStyle(0x3388ff, 0.22);
                g.fillRect(x, y, cell - 1, cell - 1);
            }
        }

        // ── Spell-targeting range highlight (purple) ─────────────────
        if (this._targeting) {
            for (const t of (this._targetTiles || [])) {
                const { x, y } = this._cellToScreen(t.x, t.y);
                g.fillStyle(0xbb66ff, 0.28);
                g.fillRect(x, y, cell - 1, cell - 1);
            }
        }

        // ── Terrain / cover from the serialized grid ─────────────────
        for (const tile of (state.grid || [])) {
            if (tile.terrain && tile.terrain !== 'open') {
                const { x, y } = this._cellToScreen(tile.x, tile.y);
                g.fillStyle(0x4a3a22, 0.5);
                g.fillRect(x + 4, y + 4, cell - 9, cell - 9);
            }
        }

        // ── Grid lines ───────────────────────────────────────────────
        g.lineStyle(1, 0x2a3340, 0.6);
        for (let gx = 0; gx <= this._cols; gx++) {
            const sx = this._origin.x + gx * cell;
            g.lineBetween(sx, this._origin.y, sx, this._origin.y + this._rows * cell);
        }
        for (let gy = 0; gy <= this._rows; gy++) {
            const sy = this._origin.y + gy * cell;
            g.lineBetween(this._origin.x, sy, this._origin.x + this._cols * cell, sy);
        }

        // ── Current-actor ring ───────────────────────────────────────
        if (actor && actor.gridX != null) {
            const { x, y } = this._cellToScreen(actor.gridX, actor.gridY);
            g.lineStyle(3, actor.side === 'ally' ? 0x66ccff : 0xff6666, 0.95);
            g.strokeRect(x + 1, y + 1, cell - 3, cell - 3);
        }

        // ── Tokens ───────────────────────────────────────────────────
        for (const a of state.allies) if (a.alive) this._drawToken(a, 0x4488ff, '#bcd8ff');
        for (const e of state.enemies) if (e.alive) this._drawToken(e, 0xcc4444, '#ffc0c0', e.intent);
    }

    _drawToken(unit, bodyColor, labelColor, intent) {
        const cell = this._cell;
        const { x, y } = this._cellToScreen(unit.gridX, unit.gridY);
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const r = Math.max(8, cell * 0.34);

        // Sprite art if available, else a colored circle token.
        const hasArt = unit.spriteKey && this.scene.textures.exists(unit.spriteKey);
        if (hasArt) {
            // Colored base ring marks side under the sprite.
            const ring = this.scene.add.graphics();
            ring.fillStyle(bodyColor, 0.35);
            ring.fillCircle(cx, cy + cell * 0.18, r * 0.9);
            this.tokenLayer.add(ring);
            const img = this.scene.add.image(cx, cy - 2, unit.spriteKey)
                .setDisplaySize(cell * 0.9, cell * 0.9).setOrigin(0.5, 0.5);
            this.tokenLayer.add(img);
        } else {
            const tg0 = this.scene.add.graphics();
            tg0.fillStyle(bodyColor, 0.95);
            tg0.fillCircle(cx, cy - 2, r);
            tg0.lineStyle(2, 0x000000, 0.5);
            tg0.strokeCircle(cx, cy - 2, r);
            this.tokenLayer.add(tg0);
        }

        const tg = this.scene.add.graphics();
        // HP bar under the token.
        const barW = cell - 10;
        const barX = x + 5;
        const barY = y + cell - 9;
        const hpPct = Math.max(0, Math.min(1, unit.hp / (unit.maxHp || 1)));
        tg.fillStyle(0x000000, 0.6);
        tg.fillRect(barX, barY, barW, 4);
        tg.fillStyle(hpPct > 0.3 ? 0x44dd55 : 0xdd3333, 0.95);
        tg.fillRect(barX, barY, barW * hpPct, 4);

        // Guard pip (small blue segment above HP) when guarding.
        if (unit.guard > 0) {
            const gPct = Math.max(0, Math.min(1, unit.guard / (unit.maxGuard || unit.guard)));
            tg.fillStyle(0x55aaff, 0.9);
            tg.fillRect(barX, barY - 5, barW * gPct, 3);
        }
        this.tokenLayer.add(tg);

        // Name label.
        const name = this.scene.add.text(cx, y + 1, this._short(unit.name), {
            fontFamily: 'Open Sans', fontSize: '10px', color: labelColor,
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0);
        this.tokenLayer.add(name);

        // Enemy intent icon above the token (telegraph).
        if (intent && intent.action) {
            const sym = intent.action === 'attack' ? '⚔' : intent.action === 'move' ? '→' : '🛡';
            const it = this.scene.add.text(cx, y - 9, sym, {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#ffdd66',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0);
            this.tokenLayer.add(it);
        }

        // Active status-effect dots (poison=green, root=brown, buff=cyan).
        const fx = unit.effects || [];
        if (fx.length) {
            const colorFor = (t) => t === 'poison' || t === 'burn' || t === 'bleed' ? '#66dd44'
                : t === 'root' || t === 'snare' || t === 'stun' ? '#cc9944'
                : t === 'buff' ? '#66ddff' : '#dd66dd';
            fx.slice(0, 4).forEach((t, i) => {
                const dot = this.scene.add.text(x + 4 + i * 9, y + cell - 18, '●', {
                    fontFamily: 'Open Sans', fontSize: '10px', color: colorFor(t),
                    stroke: '#000', strokeThickness: 2
                }).setOrigin(0, 0.5);
                this.tokenLayer.add(dot);
            });
        }
    }

    _short(name) {
        const s = String(name || '');
        return s.length > 9 ? s.slice(0, 8) + '…' : s;
    }

    // ----------------------------------------------------------------
    // Hit feedback
    // ----------------------------------------------------------------

    /** Find a unit's current grid cell by id, from live combat state. */
    _cellOf(unitId) {
        const s = this.tactical.getCombatState();
        const u = [...s.allies, ...s.enemies].find(x => x.id === unitId);
        return u ? { x: u.gridX, y: u.gridY } : null;
    }

    _onAttacked(d) {
        if (!this.visible || !d) return;
        const cell = this._cellOf(d.defender);
        if (!cell) return;
        if (d.hit === false) { this._floatText(cell, 'miss', '#cfd6e0'); return; }
        const dmg = d.damage ?? 0;
        const crit = d.criticalHit;
        this._floatText(cell, (crit ? '★' : '') + (dmg > 0 ? `-${dmg}` : '0'),
            crit ? '#ffd34d' : '#ff6b6b', crit ? 22 : 16);
        if (d.guardAbsorbed > 0) this._floatText(cell, `🛡${d.guardAbsorbed}`, '#6cf', 12, 14);
    }

    _onMissed(d) {
        if (!this.visible || !d) return;
        const cell = this._cellOf(d.defender);
        if (cell) this._floatText(cell, 'miss', '#cfd6e0');
    }

    /** Rising, fading combat text anchored to a grid cell. */
    _floatText(cell, text, color, size = 16, yOffset = 0) {
        const { x, y } = this._cellToScreen(cell.x, cell.y);
        const t = this.scene.add.text(x + this._cell / 2, y + this._cell / 2 + yOffset, text, {
            fontFamily: 'Open Sans', fontSize: `${size}px`, color,
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(14050).setScrollFactor(0);
        this.scene.tweens.add({
            targets: t, y: t.y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut',
            onComplete: () => t.destroy()
        });
    }

    _flash(cell, color) {
        const { x, y } = this._cellToScreen(cell.x, cell.y);
        const f = this.scene.add.graphics().setDepth(14001).setScrollFactor(0);
        f.fillStyle(color, 0.5);
        f.fillRect(x, y, this._cell - 1, this._cell - 1);
        this.scene.tweens.add({ targets: f, alpha: 0, duration: 350, onComplete: () => f.destroy() });
    }

    destroy() {
        if (this._unsubs) this._unsubs.forEach((fn) => { try { fn(); } catch (_) {} });
        this._unsubs = [];
        if (this._onPointerDown) this.scene.input.off('pointerdown', this._onPointerDown);
        this.container?.destroy();
    }
}

export default TacticalGridRenderer;
