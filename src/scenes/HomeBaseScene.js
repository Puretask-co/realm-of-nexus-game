import EventBus from '../core/EventBus.js';

/**
 * HomeBaseScene — The Verdant Hearth.
 *
 * A safe sanctuary scene the player can enter at any time with H.
 * Drawn entirely with Phaser Graphics + Text (no external images).
 *
 * Layout:
 *   - Forest clearing background
 *   - Warm campfire at centre with flickering particle effect
 *   - 5 NPC interaction stations
 *   - Exit portal at top-centre
 *
 * Entry:  GameScene emits scene.start('HomeBaseScene', { returnZone })
 * Exit:   EventBus 'homebase:exit' → back to GameScene with resumeZone
 *         Also wired from the Exit Portal click and pressing H again.
 */
export default class HomeBaseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HomeBaseScene' });
    }

    init(data) {
        this._returnZone = data?.returnZone || 'canopy_of_life';
    }

    create() {
        const { width, height } = this.scale;

        // ── Background ──────────────────────────────────────────────
        const bg = this.add.graphics().setDepth(0);
        // Deep forest floor
        bg.fillStyle(0x0a1a0a, 1);
        bg.fillRect(0, 0, width, height);

        // Grass patches
        this._drawGrass(bg, width, height);

        // Tree silhouettes around edges
        this._drawTrees(width, height);

        // ── Title ────────────────────────────────────────────────────
        this.add.text(width / 2, 28, 'The Verdant Hearth', {
            fontFamily: 'Open Sans',
            fontSize: '36px',
            color: '#aaffaa',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5, 0).setDepth(10).setScrollFactor(0);

        this.add.text(width / 2, 60, '— Your sanctuary —', {
            fontFamily: 'Open Sans',
            fontSize: '18px',
            color: '#66aa66',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10).setScrollFactor(0);

        // ── Campfire ─────────────────────────────────────────────────
        const fireX = width / 2;
        const fireY = height / 2 + 40;
        this._buildCampfire(fireX, fireY);

        // ── NPC Stations ─────────────────────────────────────────────
        const stationDefs = [
            // [label, sub-label, x-fraction, y-fraction, event, eventData, buttonLabel, buttonColor]
            {
                label: 'Keeper Maren',
                sub: 'Innkeeper · Rest',
                xf: 0.18, yf: 0.30,
                action: () => this._onRest(),
                btnLabel: 'Rest (30g)',
                btnColor: 0x225522
            },
            {
                label: 'Forge Master Bram',
                sub: 'Blacksmith · Craft',
                xf: 0.82, yf: 0.30,
                action: () => EventBus.emit('crafting-open', { stationId: 'home_forge' }),
                btnLabel: 'Open Forge',
                btnColor: 0x553311
            },
            {
                label: 'Archivist Yeva',
                sub: 'Scholar · Spells',
                xf: 0.18, yf: 0.72,
                action: () => EventBus.emit('spellbook-open'),
                btnLabel: 'Spellbook',
                btnColor: 0x221155
            },
            {
                label: 'Companion Board',
                sub: 'Recruit · Manage',
                xf: 0.82, yf: 0.72,
                action: () => EventBus.emit('companion:board-open'),
                btnLabel: 'View Board',
                btnColor: 0x114433
            },
            {
                label: 'Storage Chest',
                sub: 'Vault · 60 slots',
                xf: 0.50, yf: 0.80,
                action: () => EventBus.emit('stash:open'),
                btnLabel: 'Open Vault',
                btnColor: 0x553300
            }
        ];

        stationDefs.forEach(def => {
            this._buildStation(
                Math.floor(width * def.xf),
                Math.floor(height * def.yf),
                def.label, def.sub, def.action, def.btnLabel, def.btnColor
            );
        });

        // ── Exit Portal ───────────────────────────────────────────────
        this._buildExitPortal(width / 2, 110);

        // ── Ambient hints ─────────────────────────────────────────────
        this.add.text(width / 2, height - 22, 'Press H to return to the world', {
            fontFamily: 'Open Sans',
            fontSize: '17px',
            color: '#446644',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(10).setScrollFactor(0);

        // ── Input ─────────────────────────────────────────────────────
        this.input.keyboard.on('keydown-H', () => this._exit());
        this.input.keyboard.on('keydown-ESC', () => this._exit());

        // ── EventBus ──────────────────────────────────────────────────
        this._unsubExit = EventBus.on('homebase:exit', (data) => {
            const zone = data?.returnZone || this._returnZone;
            this.scene.start('GameScene', { resumeZone: zone });
        });

        this._feedbackText = this.add.text(width / 2, height - 44, '', {
            fontFamily: 'Open Sans',
            fontSize: '18px',
            color: '#aaffaa',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(12).setScrollFactor(0);

        console.log('[HomeBaseScene] Entered — returnZone:', this._returnZone);
    }

    shutdown() {
        if (this._unsubExit) {
            this._unsubExit();
            this._unsubExit = null;
        }
        if (this._fireTweens) {
            this._fireTweens.forEach(t => { if (t?.remove) t.remove(); });
        }
    }

    // ----------------------------------------------------------------
    // Background helpers
    // ----------------------------------------------------------------

    _drawGrass(gfx, width, height) {
        // Soft green patches
        const patches = [
            [0.15, 0.55, 90, 60], [0.85, 0.55, 90, 60],
            [0.50, 0.60, 110, 50], [0.30, 0.75, 80, 40],
            [0.70, 0.75, 80, 40], [0.50, 0.45, 100, 35]
        ];
        for (const [xf, yf, rw, rh] of patches) {
            gfx.fillStyle(0x133a13, 0.5);
            gfx.fillEllipse(width * xf, height * yf, rw, rh);
        }
    }

    _drawTrees(width, height) {
        const treePositions = [
            // left column
            [40, 100], [60, 280], [30, 460], [55, 640],
            // right column
            [width - 40, 100], [width - 60, 280], [width - 30, 460], [width - 55, 640],
            // top row
            [180, 50], [350, 40], [550, 45], [730, 40], [900, 50], [1100, 45]
        ];

        for (const [tx, ty] of treePositions) {
            const gfx = this.add.graphics().setDepth(1);
            // Trunk
            gfx.fillStyle(0x3a2010, 1);
            gfx.fillRect(tx - 6, ty + 20, 12, 40);
            // Canopy layers
            gfx.fillStyle(0x1a4a1a, 0.9);
            gfx.fillTriangle(tx, ty - 40, tx - 28, ty + 25, tx + 28, ty + 25);
            gfx.fillStyle(0x1e5a1e, 0.85);
            gfx.fillTriangle(tx, ty - 60, tx - 22, ty + 5, tx + 22, ty + 5);
            gfx.fillStyle(0x226622, 0.8);
            gfx.fillTriangle(tx, ty - 78, tx - 16, ty - 12, tx + 16, ty - 12);
        }
    }

    // ----------------------------------------------------------------
    // Campfire
    // ----------------------------------------------------------------

    _buildCampfire(cx, cy) {
        this._fireTweens = [];

        // Stone ring
        const stones = this.add.graphics().setDepth(3);
        stones.fillStyle(0x555555, 1);
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            stones.fillCircle(cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 16, 6);
        }

        // Log cross
        const logs = this.add.graphics().setDepth(3);
        logs.fillStyle(0x4a2a10, 1);
        logs.fillRect(cx - 20, cy - 4, 40, 8);
        logs.fillRect(cx - 4, cy - 20, 8, 40);
        logs.lineStyle(1, 0x2a1808, 1);
        logs.strokeRect(cx - 20, cy - 4, 40, 8);
        logs.strokeRect(cx - 4, cy - 20, 8, 40);

        // Embers glow
        const embers = this.add.graphics().setDepth(4);
        embers.fillStyle(0xff4400, 0.6);
        embers.fillCircle(cx, cy, 12);

        // Three flame layers with tweens for flicker
        const flameDefs = [
            { color: 0xff6600, r: 18, dr: 22, alpha: 0.75, dur: 280 },
            { color: 0xffaa00, r: 12, dr: 16, alpha: 0.85, dur: 220 },
            { color: 0xffee44, r: 6,  dr: 9,  alpha: 0.95, dur: 170 }
        ];

        for (const fd of flameDefs) {
            const flame = this.add.graphics().setDepth(5);
            const drawFlame = (radius) => {
                flame.clear();
                flame.fillStyle(fd.color, fd.alpha);
                // Teardrop-ish: ellipse taller than wide
                flame.fillEllipse(cx, cy - radius * 0.6, radius * 1.2, radius * 2.2);
            };
            drawFlame(fd.r);

            const tween = this.tweens.add({
                targets: { r: fd.r },
                r: fd.dr,
                duration: fd.dur,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: (tw) => {
                    drawFlame(tw.targets[0].r);
                }
            });
            this._fireTweens.push(tween);
        }

        // Smoke particles (simple rising circles)
        for (let i = 0; i < 4; i++) {
            const smoke = this.add.graphics().setDepth(6).setAlpha(0.18);
            smoke.fillStyle(0x888888, 1);
            smoke.fillCircle(0, 0, 8 + i * 3);

            const startX = cx + Phaser.Math.Between(-8, 8);
            smoke.setPosition(startX, cy - 20);

            this.tweens.add({
                targets: smoke,
                y: cy - 90 - i * 20,
                x: startX + Phaser.Math.Between(-15, 15),
                alpha: 0,
                scaleX: 2.5,
                scaleY: 2.5,
                duration: 2500 + i * 600,
                delay: i * 500,
                repeat: -1,
                ease: 'Cubic.easeOut',
                onRepeat: () => {
                    smoke.setPosition(cx + Phaser.Math.Between(-8, 8), cy - 20);
                    smoke.setAlpha(0.18);
                    smoke.setScale(1);
                }
            });
        }

        // Warm light halo
        const halo = this.add.graphics().setDepth(2);
        halo.fillStyle(0xff6633, 0.08);
        halo.fillCircle(cx, cy, 140);
        halo.fillStyle(0xffaa44, 0.05);
        halo.fillCircle(cx, cy, 90);

        // Flicker the halo
        const haloTween = this.tweens.add({
            targets: halo,
            alpha: { from: 0.7, to: 1.0 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this._fireTweens.push(haloTween);
    }

    // ----------------------------------------------------------------
    // NPC stations
    // ----------------------------------------------------------------

    _buildStation(x, y, label, sub, action, btnLabel, btnColor) {
        const W = 150, H = 100;
        const bx = x - W / 2, by = y - H / 2;

        // Station backing
        const bg = this.add.graphics().setDepth(4);
        bg.fillStyle(0x111a11, 0.88);
        bg.fillRoundedRect(bx, by, W, H, 8);
        bg.lineStyle(1, 0x336633, 0.7);
        bg.strokeRoundedRect(bx, by, W, H, 8);

        // NPC icon placeholder
        const icon = this.add.graphics().setDepth(5);
        icon.fillStyle(0x2a4a2a, 1);
        icon.fillCircle(x, by + 28, 18);
        icon.lineStyle(1, 0x449944, 0.8);
        icon.strokeCircle(x, by + 28, 18);

        // Label
        this.add.text(x, by + 52, label, {
            fontFamily: 'Open Sans',
            fontSize: '15px',
            color: '#aaddaa',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(5).setScrollFactor(0);

        // Sub-label
        this.add.text(x, by + 65, sub, {
            fontFamily: 'Open Sans',
            fontSize: '13px',
            color: '#668866'
        }).setOrigin(0.5, 0).setDepth(5).setScrollFactor(0);

        // Action button
        this._makeButton(x, by + H - 14, 120, 22, btnLabel, btnColor, 0x44aa44, action, 6);
    }

    // ----------------------------------------------------------------
    // Exit portal
    // ----------------------------------------------------------------

    _buildExitPortal(cx, cy) {
        const W = 60, H = 90;

        // Portal frame
        const frame = this.add.graphics().setDepth(4);
        frame.fillStyle(0x224422, 0.9);
        frame.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);
        frame.lineStyle(2, 0x44ff44, 0.8);
        frame.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);

        // Portal glow interior
        const glow = this.add.graphics().setDepth(5);
        glow.fillStyle(0x00ff44, 0.2);
        glow.fillRoundedRect(cx - W / 2 + 4, cy - H / 2 + 4, W - 8, H - 8, 5);

        // Shimmer tween
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.5, to: 1.0 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Label
        this.add.text(cx, cy - H / 2 - 14, 'EXIT', {
            fontFamily: 'Open Sans',
            fontSize: '18px',
            color: '#88ff88',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(6).setScrollFactor(0);

        // Hit zone
        const hit = this.add.zone(cx, cy, W + 10, H + 10)
            .setInteractive({ useHandCursor: true })
            .setDepth(7);

        hit.on('pointerover', () => {
            frame.clear();
            frame.fillStyle(0x336633, 0.95);
            frame.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);
            frame.lineStyle(2, 0x88ff88, 1.0);
            frame.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);
        });
        hit.on('pointerout', () => {
            frame.clear();
            frame.fillStyle(0x224422, 0.9);
            frame.fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);
            frame.lineStyle(2, 0x44ff44, 0.8);
            frame.strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 8);
        });
        hit.on('pointerdown', () => this._exit());
    }

    // ----------------------------------------------------------------
    // Actions
    // ----------------------------------------------------------------

    _onRest() {
        // Stubbed gold check — in production, check player gold via EventBus
        this._showFeedback('Resting... HP and Sap restored!', '#aaffaa');
        EventBus.emit('rest-open', { cost: 30, stationId: 'home_inn' });
    }

    _exit() {
        EventBus.emit('homebase:exit', { returnZone: this._returnZone });
    }

    _showFeedback(msg, color = '#aaffaa') {
        if (!this._feedbackText?.active) return;
        this._feedbackText.setText(msg).setColor(color);
        this.time.delayedCall(2500, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    // ----------------------------------------------------------------
    // Utility
    // ----------------------------------------------------------------

    _makeButton(cx, cy, bw, bh, label, color, hoverColor, onClick, depth = 6) {
        const bx = cx - bw / 2, by = cy - bh / 2;
        const bg = this.add.graphics().setDepth(depth);
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
        };
        draw(color);
        const txt = this.add.text(cx, cy, label, {
            fontFamily: 'Open Sans',
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000',
            strokeThickness: 1
        }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
        const hit = this.add.zone(cx, cy, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth + 1);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout',  () => draw(color));
        hit.on('pointerdown', () => onClick());
        return { bg, txt, hit };
    }
}
