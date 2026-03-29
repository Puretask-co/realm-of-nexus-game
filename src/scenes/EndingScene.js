/**
 * EndingScene — Full-screen narrative ending presentation.
 *
 * Receives scene data: { endingId }
 * EndingEvaluator should already have resolved the full payload before
 * transitioning here; if it hasn't, this scene fetches it itself.
 *
 * Timeline:
 *   0.0s  — Black bg fades in (1s fade from alpha 0)
 *   1.0s  — Title fades in
 *   2.0s  — Description fades in
 *   3.5s  — Epilogue fades in
 *   4.5s  — Footer fades in
 *   8.0s  — "Play Again" button appears (also appears immediately on keypress)
 */

import { EndingEvaluator } from '../systems/EndingEvaluator.js';

// ─── Colour Schemes ──────────────────────────────────────────────────────────
const COLOR_SCHEMES = {
    verdant_restoration: {
        bg:          0x050f05,
        titleColor:  '#b8d96b',
        descColor:   '#d4e8a0',
        epilogueColor: '#a0c870',
        footerColor: '#6a9448',
        glowColor:   0x2a6a1a,
        particleColor: 0x55cc33
    },
    blighted_dominion: {
        bg:          0x0a0005,
        titleColor:  '#cc3344',
        descColor:   '#d4a0b0',
        epilogueColor: '#a06070',
        footerColor: '#773344',
        glowColor:   0x550022,
        particleColor: 0x880022
    },
    veilkeeper_ascension: {
        bg:          0x020510,
        titleColor:  '#a8c8ff',
        descColor:   '#c8d8f0',
        epilogueColor: '#90a8d0',
        footerColor: '#607090',
        glowColor:   0x102050,
        particleColor: 0x4488cc
    },
    hollow_silence: {
        bg:          0x080808,
        titleColor:  '#888888',
        descColor:   '#aaaaaa',
        epilogueColor: '#666666',
        footerColor: '#444444',
        glowColor:   0x181818,
        particleColor: 0x333333
    },
    fractured_balance: {
        bg:          0x050a08,
        titleColor:  '#d4a044',
        descColor:   '#c8c0a0',
        epilogueColor: '#80b4a8',
        footerColor: '#607060',
        glowColor:   0x2a2010,
        particleColor: 0xaa7722
    }
};

const DEFAULT_SCHEME = COLOR_SCHEMES.fractured_balance;

// ─── Scene ───────────────────────────────────────────────────────────────────
export default class EndingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EndingScene' });
    }

    init(data) {
        this._endingId = data?.endingId ?? 'fractured_balance';

        // Resolve ending content
        const evaluator = new EndingEvaluator();
        const payload   = evaluator._build(this._endingId);

        this._title       = payload.title;
        this._description = payload.description;
        this._epilogue    = payload.epilogue;
        this._scheme      = COLOR_SCHEMES[this._endingId] ?? DEFAULT_SCHEME;

        this._playAgainShown = false;
    }

    create() {
        const { width, height } = this.scale;
        const cx = width  / 2;
        const cy = height / 2;
        const sc = this._scheme;

        // ── Background ───────────────────────────────────────────────────
        this._bg = this.add.rectangle(cx, cy, width, height, sc.bg, 1)
            .setAlpha(0)
            .setDepth(0);

        // Subtle radial glow (second rectangle, slightly tinted)
        this._bgGlow = this.add.rectangle(cx, cy, width * 0.7, height * 0.7, sc.glowColor, 0.3)
            .setAlpha(0)
            .setDepth(1);

        // ── Title ────────────────────────────────────────────────────────
        this._titleText = this.add.text(cx, cy - 160, this._title, {
            fontFamily: 'Open Sans',
            fontSize: '53px',
            color:      sc.titleColor,
            stroke:     '#000000',
            strokeThickness: 3,
            align:      'center'
        })
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(10);

        // Decorative rule below title
        this._rule = this.add.graphics()
            .setAlpha(0)
            .setDepth(10);
        const ruleColor = Phaser.Display.Color.HexStringToColor(sc.titleColor).color;
        this._rule.lineStyle(1, ruleColor, 0.6);
        this._rule.lineBetween(cx - 200, cy - 130, cx + 200, cy - 130);

        // ── Description ──────────────────────────────────────────────────
        this._descText = this.add.text(cx, cy - 50, this._description, {
            fontFamily: 'Open Sans',
            fontSize: '24px',
            color:      sc.descColor,
            align:      'center',
            wordWrap:   { width: Math.min(700, width - 120) },
            lineSpacing: 6
        })
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(10);

        // ── Epilogue ─────────────────────────────────────────────────────
        // Phaser doesn't have native italic text — approximate with smaller size + lighter colour
        this._epilogueText = this.add.text(cx, cy + 100, this._epilogue, {
            fontFamily: '"Times New Roman", Georgia, serif',
            fontSize: '20px',
            fontStyle:  'italic',
            color:      sc.epilogueColor,
            align:      'center',
            wordWrap:   { width: Math.min(600, width - 160) },
            lineSpacing: 5
        })
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(10);

        // ── Footer ───────────────────────────────────────────────────────
        this._footerText = this.add.text(cx, height - 40, 'The Verdance Remembers Your Path', {
            fontFamily: 'Open Sans',
            fontSize: '15px',
            color:      sc.footerColor,
            letterSpacing: 3
        })
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(10);

        // ── Play Again button (hidden until triggered) ───────────────────
        this._buildPlayAgainButton(cx, height - 90, sc);

        // ── Particle emitter (subtle ambient effect) ─────────────────────
        this._spawnParticles(sc.particleColor);

        // ── Fade-in timeline ─────────────────────────────────────────────
        this._runTimeline();

        // ── Input: any key shows play-again early ────────────────────────
        this.input.keyboard.once('keydown', () => this._showPlayAgain());
        this.input.once('pointerdown', () => this._showPlayAgain());
    }

    // ─── Timeline ──────────────────────────────────────────────────────────

    _runTimeline() {
        // Background fades in over 1s
        this.tweens.add({
            targets:  [this._bg, this._bgGlow],
            alpha:    { from: 0, to: 1 },
            duration: 1000,
            ease:     'Quad.easeIn'
        });

        // Title: delay 1s, fade 800ms
        this.tweens.add({
            targets:  [this._titleText, this._rule],
            alpha:    { from: 0, to: 1 },
            duration: 800,
            delay:    1000,
            ease:     'Quad.easeOut'
        });

        // Description: delay 2s
        this.tweens.add({
            targets:  this._descText,
            alpha:    { from: 0, to: 1 },
            duration: 800,
            delay:    2000,
            ease:     'Quad.easeOut'
        });

        // Epilogue: delay 3.5s
        this.tweens.add({
            targets:  this._epilogueText,
            alpha:    { from: 0, to: 1 },
            duration: 900,
            delay:    3500,
            ease:     'Quad.easeOut'
        });

        // Footer: delay 4.5s
        this.tweens.add({
            targets:  this._footerText,
            alpha:    { from: 0, to: 0.7 },
            duration: 600,
            delay:    4500,
            ease:     'Quad.easeOut'
        });

        // Show play-again button at 8s if player hasn't pressed a key
        this.time.delayedCall(8000, () => this._showPlayAgain());
    }

    // ─── Play Again ────────────────────────────────────────────────────────

    _buildPlayAgainButton(cx, y, sc) {
        const btnW = 200;
        const btnH = 44;

        this._btnBg = this.add.rectangle(cx, y, btnW, btnH, 0x000000, 0.7)
            .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(sc.titleColor).color, 0.9)
            .setInteractive({ useHandCursor: true })
            .setAlpha(0)
            .setDepth(20);

        this._btnText = this.add.text(cx, y, 'Play Again', {
            fontFamily: 'Open Sans',
            fontSize: '25px',
            color:      sc.titleColor
        })
            .setOrigin(0.5, 0.5)
            .setAlpha(0)
            .setDepth(21);

        this._btnBg.on('pointerover',  () => this._btnBg.setFillStyle(0x111111, 0.9));
        this._btnBg.on('pointerout',   () => this._btnBg.setFillStyle(0x000000, 0.7));
        this._btnBg.on('pointerdown',  () => this._restartGame());
    }

    _showPlayAgain() {
        if (this._playAgainShown) return;
        this._playAgainShown = true;

        this.tweens.add({
            targets:  [this._btnBg, this._btnText],
            alpha:    { from: 0, to: 1 },
            duration: 600,
            ease:     'Quad.easeOut'
        });

        // Also wire keyboard now that it's visible
        this.input.keyboard.once('keydown-ENTER', () => this._restartGame());
        this.input.keyboard.once('keydown-SPACE', () => this._restartGame());
    }

    _restartGame() {
        // Fade to black then restart
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('BootScene');
        });
    }

    // ─── Particles ─────────────────────────────────────────────────────────

    _spawnParticles(color) {
        const { width, height } = this.scale;

        // Create a tiny 2x2 pixel texture for the particles
        const gfx = this.make.graphics({ add: false });
        gfx.fillStyle(color, 1);
        gfx.fillRect(0, 0, 2, 2);
        gfx.generateTexture('ending_particle', 2, 2);
        gfx.destroy();

        // Drift particles upward slowly across the full screen
        this.add.particles(
            Phaser.Math.Between(0, width),
            height + 10,
            'ending_particle',
            {
                x:         { min: 0, max: width },
                y:         { start: height + 10, end: -10 },
                alpha:     { start: 0.6, end: 0 },
                scale:     { min: 0.5, max: 2 },
                speed:     { min: 15, max: 40 },
                lifespan:  8000,
                quantity:  1,
                frequency: 400,
                blendMode: Phaser.BlendModes.ADD
            }
        ).setDepth(5);
    }
}
