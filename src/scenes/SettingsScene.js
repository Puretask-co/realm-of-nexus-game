import EventBus from '../core/EventBus.js';

/**
 * SettingsScene — Full settings overlay launched from PauseMenuScene.
 * Controls: master/music/sfx volume, fullscreen, difficulty.
 * Saves preferences to localStorage and broadcasts via EventBus.
 */
export default class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
    }

    create() {
        const { width, height } = this.scale;
        const cx = width / 2;

        // Load saved prefs
        this._prefs = this._loadPrefs();

        // Dim overlay
        const overlay = this.add.graphics().setDepth(20000);
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(0, 0, width, height);

        // Panel
        const pw = 460, ph = 480;
        const px = cx - pw / 2, py = height / 2 - ph / 2;
        const panel = this.add.graphics().setDepth(20001);
        panel.fillStyle(0x0d0d22, 0.97);
        panel.fillRoundedRect(px, py, pw, ph, 12);
        panel.lineStyle(2, 0x6644aa, 0.9);
        panel.strokeRoundedRect(px, py, pw, ph, 12);

        // Title
        this.add.text(cx, py + 28, 'SETTINGS', {
            fontFamily: 'Georgia, serif', fontSize: '20px',
            color: '#ccaaff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(20002);

        // Divider
        const div = this.add.graphics().setDepth(20002);
        div.lineStyle(1, 0x443366, 0.6);
        div.lineBetween(px + 20, py + 52, px + pw - 20, py + 52);

        let rowY = py + 74;
        const rowGap = 62;

        // ── Volume sliders ────────────────────────────────────────────
        this._sliders = {};
        const sliders = [
            { key: 'masterVolume', label: 'Master Volume', color: 0xaaaaff },
            { key: 'musicVolume',  label: 'Music Volume',  color: 0x44aaff },
            { key: 'sfxVolume',    label: 'SFX Volume',    color: 0x44ffaa },
        ];

        for (const s of sliders) {
            this._createSlider(cx, rowY, pw - 60, s.key, s.label, s.color);
            rowY += rowGap;
        }

        // ── Difficulty toggle ─────────────────────────────────────────
        this.add.text(px + 30, rowY, 'Difficulty', {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aaaacc'
        }).setDepth(20002);

        const difficulties = ['Easy', 'Normal', 'Hard'];
        difficulties.forEach((d, i) => {
            const bx = px + 160 + i * 86;
            const isActive = this._prefs.difficulty === d.toLowerCase();
            const bg = this.add.graphics().setDepth(20002);
            const draw = (active) => {
                bg.clear();
                bg.fillStyle(active ? 0x4455aa : 0x222233, 0.9);
                bg.fillRoundedRect(bx, rowY - 4, 78, 28, 5);
            };
            draw(isActive);
            const label = this.add.text(bx + 39, rowY + 10, d, {
                fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
            }).setOrigin(0.5).setDepth(20003);
            const zone = this.add.zone(bx + 39, rowY + 10, 78, 28)
                .setInteractive({ useHandCursor: true }).setDepth(20003);
            zone.on('pointerdown', () => {
                this._prefs.difficulty = d.toLowerCase();
                difficulties.forEach((_, j) => {
                    const isNow = j === i;
                    this._diffBgs[j].clear();
                    this._diffBgs[j].fillStyle(isNow ? 0x4455aa : 0x222233, 0.9);
                    this._diffBgs[j].fillRoundedRect(px + 160 + j * 86, rowY - 4, 78, 28, 5);
                });
                EventBus.emit('settings:difficultyChanged', { difficulty: d.toLowerCase() });
            });
            if (!this._diffBgs) this._diffBgs = [];
            this._diffBgs.push(bg);
        });
        rowY += rowGap;

        // ── Fullscreen toggle ─────────────────────────────────────────
        this.add.text(px + 30, rowY, 'Fullscreen', {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aaaacc'
        }).setDepth(20002);

        const fsBox = this.add.graphics().setDepth(20002);
        const drawFs = (on) => {
            fsBox.clear();
            fsBox.fillStyle(on ? 0x226644 : 0x222233, 0.9);
            fsBox.fillRoundedRect(px + pw - 90, rowY - 4, 60, 28, 5);
        };
        drawFs(this._prefs.fullscreen);
        this._fsLabel = this.add.text(px + pw - 60, rowY + 10,
            this._prefs.fullscreen ? 'ON' : 'OFF', {
                fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
            }).setOrigin(0.5).setDepth(20003);

        const fsZone = this.add.zone(px + pw - 60, rowY + 10, 60, 28)
            .setInteractive({ useHandCursor: true }).setDepth(20003);
        fsZone.on('pointerdown', () => {
            this._prefs.fullscreen = !this._prefs.fullscreen;
            drawFs(this._prefs.fullscreen);
            this._fsLabel.setText(this._prefs.fullscreen ? 'ON' : 'OFF');
            if (this._prefs.fullscreen) {
                this.scale.startFullscreen();
            } else {
                this.scale.stopFullscreen();
            }
        });
        rowY += rowGap;

        // ── Buttons ───────────────────────────────────────────────────
        this._makeBtn(cx - 80, rowY + 10, 140, 36, 'Apply', 0x224466, 0x3366aa, () => this._apply());
        this._makeBtn(cx + 80, rowY + 10, 140, 36, 'Back',  0x442222, 0xaa3333, () => this._back());

        this.input.keyboard.on('keydown-ESC', () => this._back());
    }

    _createSlider(cx, y, trackW, key, label, color) {
        const scene = this;
        const px = cx - trackW / 2;
        const depth = 20002;

        this.add.text(px, y, label, {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aaaacc'
        }).setDepth(depth);

        const val = this._prefs[key] ?? 0.8;
        const trackX = px, trackY = y + 22;
        const trackH = 8;
        const thumbR = 9;

        // Track background
        const track = this.add.graphics().setDepth(depth);
        track.fillStyle(0x222233, 0.9);
        track.fillRoundedRect(trackX, trackY - trackH / 2, trackW, trackH, 4);

        // Fill bar
        const fill = this.add.graphics().setDepth(depth + 1);
        const redraw = (v) => {
            fill.clear();
            fill.fillStyle(color, 0.85);
            fill.fillRoundedRect(trackX, trackY - trackH / 2, trackW * v, trackH, 4);
        };
        redraw(val);

        // Value label
        const valText = this.add.text(cx + trackW / 2 + 18, trackY, `${Math.round(val * 100)}%`, {
            fontFamily: 'monospace', fontSize: '11px', color: '#888899'
        }).setOrigin(0, 0.5).setDepth(depth + 1);

        // Thumb
        const thumbX = trackX + trackW * val;
        const thumb = this.add.graphics().setDepth(depth + 2);
        const drawThumb = (tx) => {
            thumb.clear();
            thumb.fillStyle(0xffffff, 1);
            thumb.fillCircle(tx, trackY, thumbR);
            thumb.lineStyle(2, color, 1);
            thumb.strokeCircle(tx, trackY, thumbR);
        };
        drawThumb(thumbX);

        // Drag zone — full track width + padding
        const hitZone = this.add.zone(cx, trackY, trackW + 30, 30)
            .setInteractive({ useHandCursor: true }).setDepth(depth + 3);

        const updateFromPointer = (pointer) => {
            const relX = Phaser.Math.Clamp(pointer.x - trackX, 0, trackW);
            const newVal = relX / trackW;
            this._prefs[key] = newVal;
            redraw(newVal);
            drawThumb(trackX + trackW * newVal);
            valText.setText(`${Math.round(newVal * 100)}%`);
        };

        hitZone.on('pointerdown', updateFromPointer);
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown && scene.input.hitTestPointer(pointer).includes(hitZone)) {
                updateFromPointer(pointer);
            }
        });

        this._sliders[key] = { redraw, drawThumb, valText, trackX, trackW, trackY };
    }

    _makeBtn(cx, cy, bw, bh, label, color, hover, action) {
        const bx = cx - bw / 2, by = cy - bh / 2;
        const bg = this.add.graphics().setDepth(20002);
        const draw = (c) => { bg.clear(); bg.fillStyle(c, 0.9); bg.fillRoundedRect(bx, by, bw, bh, 6); };
        draw(color);
        this.add.text(cx, cy, label, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(20003);
        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(20003);
        zone.on('pointerover', () => draw(hover));
        zone.on('pointerout',  () => draw(color));
        zone.on('pointerdown', action);
    }

    _apply() {
        this._savePrefs();
        // Broadcast volume changes
        EventBus.emit('settings:volumeChanged', {
            master: this._prefs.masterVolume,
            music:  this._prefs.musicVolume,
            sfx:    this._prefs.sfxVolume,
        });
        EventBus.emit('settings:applied', this._prefs);
        this._back();
    }

    _back() {
        this.scene.stop();
    }

    _loadPrefs() {
        try {
            const saved = localStorage.getItem('verdance_settings');
            if (saved) return JSON.parse(saved);
        } catch {}
        return {
            masterVolume: 0.8,
            musicVolume:  0.6,
            sfxVolume:    0.8,
            difficulty:   'normal',
            fullscreen:   false,
        };
    }

    _savePrefs() {
        try {
            localStorage.setItem('verdance_settings', JSON.stringify(this._prefs));
        } catch {}
    }
}
