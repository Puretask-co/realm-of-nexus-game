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

        // Hover preview: show XCOM-style hit% / damage tooltip over the hovered
        // enemy or cover hint over a move tile.
        this._hoverLayer = this.scene.add.container(0, 0).setDepth(14060).setScrollFactor(0);
        this.container.add(this._hoverLayer);
        this._onPointerMove = (pointer) => this._handleHover(pointer);
        this.scene.input.on('pointermove', this._onPointerMove);
        this._lastHoverCell = null;

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
        this._clearHover();
        this._lastHoverCell = null;
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
    // Hover preview (XCOM-style hit% / cover hint)
    // ----------------------------------------------------------------

    _handleHover(pointer) {
        if (!this.visible || !this._isPlayerTurn) { this._clearHover(); return; }
        const cell = this._screenToCell(pointer.x, pointer.y);
        if (!cell) { this._clearHover(); this._lastHoverCell = null; return; }
        if (this._lastHoverCell && this._lastHoverCell.x === cell.x && this._lastHoverCell.y === cell.y) return;
        this._lastHoverCell = cell;
        this._clearHover();

        const state = this.tactical.getCombatState();
        const attacker = this.tactical.currentActor?.entity;
        if (!attacker) return;

        // Hovering a living enemy → hit% + damage range preview.
        const liveEnemy = state.enemies.find(e => e.alive && e.gridX === cell.x && e.gridY === cell.y);
        if (liveEnemy) {
            const defender = this.tactical.enemies.find(e => e.id === liveEnemy.id);
            const info = defender ? this.tactical.getHitChance(attacker, defender) : null;
            if (info) this._drawAttackTooltip(cell, info);
            return;
        }
        // Hovering a reachable move tile → tile preview (cover at destination, dash warning).
        if (this._reachable.some(t => t.x === cell.x && t.y === cell.y)) {
            this._drawMoveTooltip(cell);
        }
    }

    _clearHover() { this._hoverLayer?.removeAll(true); }

    _drawAttackTooltip(cell, info) {
        const { x, y } = this._cellToScreen(cell.x, cell.y);
        const cellSz = this._cell;
        const hit = Math.round(info.hitChance * 100);
        const crit = Math.round(info.critChance * 100);
        // Anchor above the enemy when there's room, else below.
        const above = y > 70;
        const tx = x + cellSz / 2;
        const ty = above ? y - 8 : y + cellSz + 8;
        const lines = [
            `${hit}% to hit · ${crit}% crit`,
            info.inRange ? `${info.dmgMin}–${info.dmgMax} dmg` : `${info.distance} tiles away`,
        ];
        const hints = [];
        if (info.defenderInCover) hints.push('cover');
        if (info.elevated)        hints.push('high ground +');
        if (hints.length) lines.push(hints.join(' · '));

        const text = this.scene.add.text(tx, ty, lines.join('\n'), {
            fontFamily: 'Open Sans', fontSize: '13px',
            color: info.inRange ? (hit >= 70 ? '#bdf5b0' : hit >= 40 ? '#ffe28a' : '#ffb0a8') : '#aaaaaa',
            align: 'center', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#0b0b18cc', padding: { x: 6, y: 4 }
        }).setOrigin(0.5, above ? 1 : 0);
        this._hoverLayer.add(text);
    }

    _drawMoveTooltip(cell) {
        const { x, y } = this._cellToScreen(cell.x, cell.y);
        const cellSz = this._cell;
        const apAfter = (this.tactical.currentAP ?? 0) - 1;
        const isDash = apAfter < 1;
        const tile = (this.tactical.getCombatState().grid || []).find(t => t.x === cell.x && t.y === cell.y);
        // Adjacent cover at the destination?
        const tileAt = (gx, gy) => (this.tactical.getCombatState().grid || []).find(t => t.x === gx && t.y === gy);
        const adj = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => tileAt(cell.x+dx, cell.y+dy));
        const hasHigh = adj.some(t => t?.terrain === 'cover_high');
        const hasLow = adj.some(t => t?.terrain === 'cover_low');
        const lines = [
            isDash ? 'DASH (ends turn)' : 'Move (1 AP)',
            hasHigh ? 'Full cover here' : hasLow ? 'Half cover here' : 'No cover here',
        ];
        if (tile?.elevation > 0) lines.push('Elevated +');
        const text = this.scene.add.text(x + cellSz / 2, y - 6, lines.join('\n'), {
            fontFamily: 'Open Sans', fontSize: '12px',
            color: isDash ? '#ffe28a' : '#bcd8ff',
            align: 'center', stroke: '#000', strokeThickness: 3,
            backgroundColor: '#0b0b18cc', padding: { x: 5, y: 3 }
        }).setOrigin(0.5, 1);
        this._hoverLayer.add(text);
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
        this._clearHover();
        this._lastHoverCell = null;

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

        // ── Reachable-move highlight, XCOM-style (player turn, not while targeting) ──
        // BLUE  = move + still have AP to act after (the "free move" tier).
        // YELLOW = dash — move consumes your last AP; you can't attack/cast.
        if (this._isPlayerTurn && !this._targeting) {
            const apAfterMove = (this.tactical.currentAP ?? 0) - 1; // every move costs 1 AP
            const dashing = apAfterMove < 1;
            const moveColor = dashing ? 0xddcc44 : 0x3388ff;
            const moveAlpha = dashing ? 0.30 : 0.22;
            for (const t of this._reachable) {
                const { x, y } = this._cellToScreen(t.x, t.y);
                g.fillStyle(moveColor, moveAlpha);
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

        // ── Terrain / cover / elevation from the serialized grid ─────
        for (const tile of (state.grid || [])) {
            const { x, y } = this._cellToScreen(tile.x, tile.y);
            const t = tile.terrain;
            if (t === 'wall') {
                // Solid impassable block.
                g.fillStyle(0x5a5550, 0.95); g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
                g.lineStyle(2, 0x2a2622, 0.9); g.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
            } else if (t === 'cover_high') {
                g.fillStyle(0x6a5a2a, 0.6); g.fillRect(x + 5, y + 5, cell - 11, cell - 11);
                g.lineStyle(1, 0xccaa55, 0.7); g.strokeRect(x + 5, y + 5, cell - 11, cell - 11);
            } else if (t === 'cover_low') {
                g.fillStyle(0x5a4a22, 0.45); g.fillRect(x + 7, y + cell * 0.55, cell - 14, cell * 0.30);
                g.lineStyle(1, 0xaa8844, 0.6); g.strokeRect(x + 7, y + cell * 0.55, cell - 14, cell * 0.30);
            } else if (t === 'forest' || t === 'spore_cloud' || t === 'shadow_veil' || t === 'blight_zone') {
                // Concealing terrain (shroud) — translucent themed wash.
                const c = t === 'forest' ? 0x224a22 : t === 'spore_cloud' ? 0x3a4422
                    : t === 'shadow_veil' ? 0x2a2240 : 0x3a1030;
                g.fillStyle(c, 0.4); g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            }
            // Elevation marker (works alongside 'open' tiles).
            if (tile.elevation > 0) {
                g.fillStyle(0x88aacc, 0.18); g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                g.lineStyle(1, 0x88ccff, 0.5); g.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
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

        // ── Cover shield icons (XCOM-style) ──────────────────────────
        // A tile adjacent to a cover tile gets a shield icon on the edge
        // facing the cover — full shield for cover_high, half for cover_low.
        const tileAt = (gx, gy) => (state.grid || []).find(t => t.x === gx && t.y === gy);
        const dirs = [
            { dx:  1, dy: 0, side: 'e' }, { dx: -1, dy: 0, side: 'w' },
            { dx:  0, dy: 1, side: 's' }, { dx:  0, dy:-1, side: 'n' },
        ];
        for (let gx = 0; gx < this._cols; gx++) {
            for (let gy = 0; gy < this._rows; gy++) {
                const here = tileAt(gx, gy);
                if (here && (here.terrain === 'wall' || here.terrain === 'cover_high')) continue;
                for (const d of dirs) {
                    const nx = gx + d.dx, ny = gy + d.dy;
                    const t = tileAt(nx, ny);
                    if (!t) continue;
                    const isHigh = t.terrain === 'cover_high';
                    const isLow  = t.terrain === 'cover_low';
                    if (!isHigh && !isLow) continue;
                    const { x, y } = this._cellToScreen(gx, gy);
                    const color = isHigh ? '#ffd84a' : '#a8c8ff';
                    const glyph = isHigh ? '▮' : '▰'; // full vs half
                    let tx = x + cell / 2, ty = y + cell / 2;
                    const pad = Math.round(cell * 0.18);
                    if (d.side === 'e') tx = x + cell - pad;
                    else if (d.side === 'w') tx = x + pad;
                    else if (d.side === 's') ty = y + cell - pad;
                    else if (d.side === 'n') ty = y + pad;
                    const lab = this.scene.add.text(tx, ty, glyph, {
                        fontFamily: 'Open Sans', fontSize: `${Math.round(cell * 0.32)}px`,
                        color, stroke: '#000', strokeThickness: 3
                    }).setOrigin(0.5);
                    this.tokenLayer.add(lab);
                }
            }
        }

        // ── Lairs (untriggered) — pulsing hazard marker ──────────────
        for (const lair of (state.lairs || [])) {
            if (lair.triggered) continue;
            const { x, y } = this._cellToScreen(lair.x, lair.y);
            g.fillStyle(0xaa7722, 0.55); g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
            g.lineStyle(2, 0xffcc44, 0.8); g.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
            const m = this.scene.add.text(x + cell / 2, y + cell / 2, '☣', {
                fontFamily: 'Open Sans', fontSize: `${Math.round(cell * 0.4)}px`,
                color: '#ffdd66', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5);
            this.tokenLayer.add(m);
        }

        // ── Tokens ───────────────────────────────────────────────────
        for (const a of state.allies) if (a.alive) this._drawToken(a, 0x4488ff, '#bcd8ff');
        for (const e of state.enemies) if (e.alive) this._drawToken(e, 0xcc4444, '#ffc0c0', e.intent);
        for (const n of (state.neutrals || [])) if (n.alive) this._drawToken(n, 0xdd8822, '#ffdda0');
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
        if (this._onPointerMove) this.scene.input.off('pointermove', this._onPointerMove);
        this.container?.destroy();
    }
}

export default TacticalGridRenderer;
