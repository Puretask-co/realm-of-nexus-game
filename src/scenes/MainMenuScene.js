import EventBus from '../core/EventBus.js';

/**
 * MainMenuScene — The game's main menu.
 *
 * Features:
 *  - Animated dark-forest background with floating particles (blue/green/silver)
 *  - Game title + subtitle rendered with Phaser Text objects
 *  - Four buttons: New Game, Load Game, Settings, Quit
 *  - Save slot picker modal (3 slots, localStorage-backed)
 *  - Quit confirmation dialog
 */
export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });

        this._particles = [];   // { gfx, x, y, speed, alpha, color, size }
        this._modalContainer = null;
    }

    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------

    create() {
        const { width, height } = this.scale;

        this._buildBackground(width, height);
        this._buildTitle(width, height);
        this._buildButtons(width, height);

        // Floating particle update loop
        this.events.on('update', this._updateParticles, this);

        // Start menu BGM — defer until AudioContext is unlocked (Chrome autoplay policy)
        if (this.sound && this.cache.audio.exists('bgm_menu')) {
            this._bgm = this.sound.add('bgm_menu', { loop: true, volume: 0.55 });
            if (this.sound.locked) {
                this.sound.once('unlocked', () => { if (this._bgm?.active) this._bgm.play(); });
            } else {
                this._bgm.play();
            }
        }

        EventBus.emit('main-menu-open');
    }

    // ----------------------------------------------------------------
    // Background
    // ----------------------------------------------------------------

    _buildBackground(width, height) {
        // Deep dark gradient base
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x020610, 0x020610, 0x061a0a, 0x061a0a, 1);
        bg.fillRect(0, 0, width, height);

        // Distant tree silhouettes (simple filled shapes)
        const trees = this.add.graphics();
        trees.fillStyle(0x050e05, 1);

        const treeData = [
            { x: 60,  w: 70,  h: 260 },
            { x: 130, w: 50,  h: 200 },
            { x: 200, w: 90,  h: 310 },
            { x: 310, w: 55,  h: 230 },
            { x: 400, w: 80,  h: 280 },
            { x: 490, w: 45,  h: 190 },
            { x: 580, w: 100, h: 340 },
            { x: 700, w: 60,  h: 220 },
            { x: 800, w: 85,  h: 295 },
            { x: 900, w: 50,  h: 210 },
            { x: 1000,w: 95,  h: 320 },
            { x: 1100,w: 55,  h: 240 },
            { x: 1190,w: 80,  h: 270 },
            { x: 1260,w: 70,  h: 200 },
        ];

        treeData.forEach(({ x, w, h }) => {
            // Trunk
            const tw = Math.max(8, w * 0.15);
            trees.fillRect(x + w / 2 - tw / 2, height - h * 0.3, tw, h * 0.3);
            // Canopy (triangle approximation using fillTriangle)
            trees.fillTriangle(
                x,         height - h * 0.25,
                x + w / 2, height - h,
                x + w,     height - h * 0.25
            );
            trees.fillTriangle(
                x + w * 0.1,  height - h * 0.45,
                x + w / 2,    height - h * 1.1,
                x + w * 0.9,  height - h * 0.45
            );
        });

        // Ground fog band
        const fog = this.add.graphics();
        fog.fillGradientStyle(0x0a1f0a, 0x0a1f0a, 0x000000, 0x000000, 0);
        fog.fillRect(0, height - 100, width, 100);

        // Subtle horizontal scan-line vignette (top and bottom fade)
        const vignette = this.add.graphics();
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
        vignette.fillRect(0, 0, width, 160);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
        vignette.fillRect(0, height - 140, width, 140);

        // Spawn initial particles
        for (let i = 0; i < 55; i++) {
            this._spawnParticle(width, height, true);
        }
    }

    _spawnParticle(width, height, randomY = false) {
        const colors = [0x4499ff, 0x44ffaa, 0xbbbbff, 0x22cc88, 0x6688ff];
        const color  = colors[Math.floor(Math.random() * colors.length)];
        const size   = 1.2 + Math.random() * 2.2;
        const x      = Math.random() * width;
        const y      = randomY ? Math.random() * height : height + size * 2;
        const speed  = 0.18 + Math.random() * 0.45;
        const alpha  = 0.15 + Math.random() * 0.55;
        const drift  = (Math.random() - 0.5) * 0.25; // horizontal drift

        const gfx = this.add.graphics();
        gfx.fillStyle(color, alpha);
        gfx.fillCircle(0, 0, size);
        gfx.x = x;
        gfx.y = y;

        this._particles.push({ gfx, x, y, speed, alpha, color, size, drift });
    }

    _updateParticles() {
        if (!this.scene.isActive('MainMenuScene')) return;
        const { width, height } = this.scale;

        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            if (!p.gfx?.active) {
                this._particles.splice(i, 1);
                continue;
            }
            p.y  -= p.speed;
            p.x  += p.drift;
            p.gfx.x = p.x;
            p.gfx.y = p.y;

            // Gentle twinkle: oscillate alpha
            const twinkle = Math.sin(this.time.now * 0.002 + i) * 0.12;
            p.gfx.clear();
            p.gfx.fillStyle(p.color, Math.max(0, Math.min(1, p.alpha + twinkle)));
            p.gfx.fillCircle(0, 0, p.size);

            // Recycle when off-screen
            if (p.y < -10 || p.x < -10 || p.x > width + 10) {
                p.gfx.destroy();
                this._particles.splice(i, 1);
                this._spawnParticle(width, height, false);
            }
        }
    }

    // ----------------------------------------------------------------
    // Title
    // ----------------------------------------------------------------

    _buildTitle(width, height) {
        // Glow layer (blurred look via multiple overlapping texts)
        const glowStyle = {
            fontFamily: 'Open Sans',
            fontSize: '81px',
            color: '#224466',
            stroke: '#224466',
            strokeThickness: 18,
            alpha: 0.4,
        };
        this.add.text(width / 2, height * 0.22, 'REALM OF NEXUS', glowStyle)
            .setOrigin(0.5)
            .setAlpha(0.35);

        // Main title
        const titleText = this.add.text(width / 2, height * 0.22, 'REALM OF NEXUS', {
            fontFamily: 'Open Sans',
            fontSize: '81px',
            color: '#ddeeff',
            stroke: '#0a2244',
            strokeThickness: 6,
            shadow: { offsetX: 0, offsetY: 0, color: '#4499ff', blur: 20, fill: true },
        }).setOrigin(0.5);

        // Subtitle
        const subtitleText = this.add.text(width / 2, height * 0.22 + 64, 'Verdance', {
            fontFamily: 'Open Sans',
            fontSize: '36px',
            color: '#88ffcc',
            stroke: '#062210',
            strokeThickness: 3,
            letterSpacing: 6,
        }).setOrigin(0.5);

        // Decorative divider line
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x336644, 0.6);
        const dw = 280;
        divider.lineBetween(width / 2 - dw / 2, height * 0.22 + 94, width / 2 + dw / 2, height * 0.22 + 94);

        // Gentle float animation for title
        this.tweens.add({
            targets: [titleText, subtitleText],
            y: `-=6`,
            duration: 2800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    // ----------------------------------------------------------------
    // Menu buttons
    // ----------------------------------------------------------------

    _buildButtons(width, height) {
        const btnW   = 240;
        const btnH   = 48;
        const startY = height * 0.52;
        const gap    = 64;

        const defs = [
            {
                label: 'New Game',
                color: 0x1a4a2a,
                hover: 0x2a7a44,
                border: 0x44cc88,
                action: () => this._onNewGame(),
            },
            {
                label: 'Load Game',
                color: 0x1a2a4a,
                hover: 0x2a4a7a,
                border: 0x4488cc,
                action: () => this._onLoadGame(),
            },
            {
                label: 'Settings',
                color: 0x252535,
                hover: 0x3a3a55,
                border: 0x6666aa,
                action: () => this._onSettings(),
            },
            {
                label: 'Quit',
                color: 0x3a1515,
                hover: 0x6a2222,
                border: 0xcc4444,
                action: () => this._onQuit(),
            },
        ];

        defs.forEach((def, i) => {
            this._makeButton(width / 2, startY + i * gap, btnW, btnH, def);
        });
    }

    _makeButton(cx, cy, bw, bh, def) {
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const hasAtlas = this.textures.exists('ui_rpg');

        if (hasAtlas) {
            // Atlas nineslice button
            const atlasVariant = def.atlasVariant || 'brown';
            const btnImg = this.add.nineslice(cx, cy, 'ui_rpg', `buttonLong_${atlasVariant}.png`, bw, bh, 14, 14, 0, 0);

            const label = this.add.text(cx, cy, def.label, {
                fontFamily: 'Open Sans', fontSize: '24px',
                color: '#e8eeff', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);

            const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });

            zone.on('pointerover', () => {
                btnImg.setTint(0xdddddd);
                label.setColor('#ffffff');
                this.tweens.add({ targets: [btnImg, label], scaleX: 1.03, scaleY: 1.03, duration: 80 });
            });
            zone.on('pointerout', () => {
                btnImg.clearTint();
                label.setColor('#e8eeff');
                this.tweens.add({ targets: [btnImg, label], scaleX: 1.0, scaleY: 1.0, duration: 80 });
            });
            zone.on('pointerdown', () => {
                btnImg.setFrame(`buttonLong_${atlasVariant}_pressed.png`);
                label.setY(cy + 2);
                EventBus.emit('ui:buttonClick');
                this.tweens.add({
                    targets: [btnImg, label], scaleX: 0.96, scaleY: 0.96,
                    duration: 60, ease: 'Power1', yoyo: true,
                    onComplete: () => { btnImg.setFrame(`buttonLong_${atlasVariant}.png`); label.setY(cy); def.action(); }
                });
            });
        } else {
            // Fallback: plain graphics button
            const radius = 8;
            const bg = this.add.graphics();
            const draw = (fillColor, borderColor, glowAlpha) => {
                bg.clear();
                bg.fillStyle(fillColor, 0.92);
                bg.fillRoundedRect(bx, by, bw, bh, radius);
                bg.lineStyle(2, borderColor, glowAlpha);
                bg.strokeRoundedRect(bx, by, bw, bh, radius);
            };
            draw(def.color, def.border, 0.5);

            const label = this.add.text(cx, cy, def.label, {
                fontFamily: 'Open Sans', fontSize: '24px',
                color: '#e8eeff', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);

            const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
            zone.on('pointerover', () => {
                draw(def.hover, def.border, 1.0);
                label.setColor('#ffffff');
                this.tweens.add({ targets: [bg, label], scaleX: 1.03, scaleY: 1.03, duration: 80 });
            });
            zone.on('pointerout', () => {
                draw(def.color, def.border, 0.5);
                label.setColor('#e8eeff');
                this.tweens.add({ targets: [bg, label], scaleX: 1.0, scaleY: 1.0, duration: 80 });
            });
            zone.on('pointerdown', () => {
                EventBus.emit('ui:buttonClick');
                this.tweens.add({
                    targets: [bg, label], scaleX: 0.96, scaleY: 0.96,
                    duration: 60, ease: 'Power1', yoyo: true,
                    onComplete: () => def.action(),
                });
            });
        }
    }

    // ----------------------------------------------------------------
    // Button actions
    // ----------------------------------------------------------------

    _onNewGame() {
        this._clearModal();
        this.scene.start('ClassSelectionScene');
    }

    _onLoadGame() {
        this._clearModal();
        this._showSaveSlotModal();
    }

    _onSettings() {
        this._clearModal();
        this.scene.launch('SettingsScene');
    }

    _onQuit() {
        this._clearModal();
        this._showQuitConfirm();
    }

    // ----------------------------------------------------------------
    // Save Slot Picker Modal
    // ----------------------------------------------------------------

    _showSaveSlotModal() {
        const { width, height } = this.scale;

        const SLOT_COUNT  = 3;
        const CARD_W      = 350;
        const CARD_H      = 90;
        const PANEL_PAD   = 28;
        const PANEL_W     = CARD_W + PANEL_PAD * 2;
        const HEADER_H    = 48;
        const FOOTER_H    = 52;
        const PANEL_H     = HEADER_H + SLOT_COUNT * (CARD_H + 12) + FOOTER_H;
        const PANEL_X     = width  / 2 - PANEL_W / 2;
        const PANEL_Y     = height / 2 - PANEL_H / 2;

        const container = this.add.container(0, 0);
        this._modalContainer = container;

        // Dim background
        const dimmer = this.add.graphics();
        dimmer.fillStyle(0x000000, 0.7);
        dimmer.fillRect(0, 0, width, height);
        container.add(dimmer);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x0d0d22, 0.97);
        panel.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12);
        panel.lineStyle(2, 0x3355aa, 0.9);
        panel.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12);
        container.add(panel);

        // Title
        const titleTxt = this.add.text(width / 2, PANEL_Y + HEADER_H / 2, 'Load Game', {
            fontFamily: 'Open Sans', fontSize: '28px', color: '#aaccff',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
        container.add(titleTxt);

        // Divider
        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, 0x334466, 0.7);
        divGfx.lineBetween(PANEL_X + 20, PANEL_Y + HEADER_H, PANEL_X + PANEL_W - 20, PANEL_Y + HEADER_H);
        container.add(divGfx);

        // Slot cards — rendered inside a sub-container so refresh is easy
        const cardsContainer = this.add.container(0, 0);
        container.add(cardsContainer);
        this._renderSlotCards(cardsContainer, PANEL_X + PANEL_PAD, PANEL_Y + HEADER_H + 12, CARD_W, CARD_H);

        // Cancel button
        const cancelX = width / 2;
        const cancelY = PANEL_Y + PANEL_H - FOOTER_H / 2;
        this._makeInlineButton(cancelX, cancelY, 120, 34, {
            label: 'Cancel',
            color: 0x2a1a1a,
            hover: 0x551111,
            border: 0xaa4444,
            action: () => this._clearModal(),
        }, container);
    }

    _renderSlotCards(cardsContainer, startX, startY, cardW, cardH) {
        // Clear previous card objects
        cardsContainer.removeAll(true);

        const gap = 12;
        for (let slot = 0; slot < 3; slot++) {
            const y = startY + slot * (cardH + gap);
            this._renderSingleCard(cardsContainer, slot, startX, y, cardW, cardH);
        }
    }

    _renderSingleCard(container, slot, x, y, w, h) {
        const raw = localStorage.getItem(`verdance_save_${slot}`);
        let saveData = null;
        try { saveData = raw ? JSON.parse(raw) : null; } catch { saveData = null; }

        const isEmpty = !saveData;

        // Card background
        const cardBg = this.add.graphics();
        const fillColor = isEmpty ? 0x111122 : 0x162236;
        const borderColor = isEmpty ? 0x223344 : 0x4477bb;
        cardBg.fillStyle(fillColor, 0.9);
        cardBg.fillRoundedRect(x, y, w, h, 8);
        cardBg.lineStyle(1, borderColor, 0.8);
        cardBg.strokeRoundedRect(x, y, w, h, 8);
        container.add(cardBg);

        // Slot number badge
        const badgeTxt = this.add.text(x + 14, y + h / 2, `${slot + 1}`, {
            fontFamily: 'Open Sans', fontSize: '28px',
            color: isEmpty ? '#445566' : '#88bbff',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5);
        container.add(badgeTxt);

        if (isEmpty) {
            const emptyTxt = this.add.text(x + w / 2 + 10, y + h / 2, '— Empty —', {
                fontFamily: 'Open Sans', fontSize: '20px', color: '#445566',
            }).setOrigin(0.5);
            container.add(emptyTxt);

            // Click on empty slot — show brief message
            const emptyZone = this.add.zone(x + w / 2, y + h / 2, w - 60, h).setInteractive({ useHandCursor: false });
            emptyZone.on('pointerdown', () => {
                emptyTxt.setText('No save data');
                emptyTxt.setColor('#aa6644');
                this.time.delayedCall(1200, () => {
                    if (emptyTxt?.active) {
                        emptyTxt.setText('— Empty —');
                        emptyTxt.setColor('#445566');
                    }
                });
            });
            container.add(emptyZone);
        } else {
            const { playerName = 'Unknown', className = '???', level = 1, currentZone = '???', playtime = 0 } = saveData;
            const hrs  = Math.floor(playtime / 3600);
            const mins = Math.floor((playtime % 3600) / 60);
            const timeStr = `${hrs}h ${String(mins).padStart(2, '0')}m`;
            const zoneLabel = currentZone.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            const nameText = this.add.text(x + 38, y + 14, playerName, {
                fontFamily: 'Open Sans', fontSize: '21px', color: '#ddeeff',
                stroke: '#000', strokeThickness: 2,
            });
            container.add(nameText);

            const classText = this.add.text(x + 38, y + 32, `${className}  Lv.${level}`, {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#88bbcc',
            });
            container.add(classText);

            const zoneText = this.add.text(x + 38, y + 50, zoneLabel, {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#55aa77',
            });
            container.add(zoneText);

            const timeText = this.add.text(x + w - 100, y + 14, timeStr, {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#778899',
            });
            container.add(timeText);

            // Load zone (left 75% of card)
            const loadZone = this.add.zone(x + (w - 70) / 2, y + h / 2, w - 70, h).setInteractive({ useHandCursor: true });
            loadZone.on('pointerover', () => {
                cardBg.clear();
                cardBg.fillStyle(0x224466, 0.95);
                cardBg.fillRoundedRect(x, y, w, h, 8);
                cardBg.lineStyle(2, 0x66aaff, 1.0);
                cardBg.strokeRoundedRect(x, y, w, h, 8);
            });
            loadZone.on('pointerout', () => {
                cardBg.clear();
                cardBg.fillStyle(fillColor, 0.9);
                cardBg.fillRoundedRect(x, y, w, h, 8);
                cardBg.lineStyle(1, borderColor, 0.8);
                cardBg.strokeRoundedRect(x, y, w, h, 8);
            });
            loadZone.on('pointerdown', () => this._loadSlot(slot, saveData));
            container.add(loadZone);

            // Delete button
            this._makeInlineButton(x + w - 30, y + h / 2, 44, 28, {
                label: 'Del',
                color: 0x3a0a0a,
                hover: 0x771111,
                border: 0xcc2222,
                action: () => {
                    localStorage.removeItem(`verdance_save_${slot}`);
                    // Refresh cards by clearing and re-rendering
                    const parent = container.parentContainer;
                    if (parent) {
                        const startX = x;
                        // recalculate start y for slot 0
                        const startYRecalc = y - slot * (h + 12);
                        this._renderSlotCards(container, startX, startYRecalc, w, h);
                    }
                },
            }, container);
        }
    }

    _loadSlot(slot, saveData) {
        this._clearModal();
        const { playerName = 'Hero', className = 'verdant_guardian', level = 1,
                currentZone = 'starting_area', playtime = 0 } = saveData;

        this.registry.set('selectedClass',         className);
        this.registry.set('playerName',            playerName);
        this.registry.set('currentLevel',          level);
        this.registry.set('currentZone',           currentZone);
        this.registry.set('playtime',              playtime);
        this.registry.set('loadedSaveSlot',        slot);

        EventBus.emit('load-save', { slot, saveData });
        this.scene.start('GameScene');
    }

    // ----------------------------------------------------------------
    // Quit Confirmation Dialog
    // ----------------------------------------------------------------

    _showQuitConfirm() {
        const { width, height } = this.scale;

        const DW = 360, DH = 180;
        const DX = width  / 2 - DW / 2;
        const DY = height / 2 - DH / 2;

        const container = this.add.container(0, 0);
        this._modalContainer = container;

        // Dim
        const dimmer = this.add.graphics();
        dimmer.fillStyle(0x000000, 0.7);
        dimmer.fillRect(0, 0, width, height);
        container.add(dimmer);

        // Box
        const box = this.add.graphics();
        box.fillStyle(0x0d0d1e, 0.97);
        box.fillRoundedRect(DX, DY, DW, DH, 12);
        box.lineStyle(2, 0xaa3333, 0.9);
        box.strokeRoundedRect(DX, DY, DW, DH, 12);
        container.add(box);

        // Message
        const msg = this.add.text(width / 2, DY + 52, 'Quit the game?', {
            fontFamily: 'Open Sans', fontSize: '25px', color: '#ffcccc',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);
        container.add(msg);

        const sub = this.add.text(width / 2, DY + 82, 'Any unsaved progress will be lost.', {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#887777',
        }).setOrigin(0.5);
        container.add(sub);

        // Yes
        this._makeInlineButton(width / 2 - 75, DY + DH - 42, 120, 36, {
            label: 'Yes, Quit',
            color: 0x551111,
            hover: 0x882222,
            border: 0xcc4444,
            action: () => {
                this._clearModal();
                window.close();
                // Fallback for browsers that block window.close()
                this.add.text(width / 2, height / 2, 'You may now close this tab.', {
                    fontFamily: 'Open Sans', fontSize: '20px', color: '#aaaaaa',
                }).setOrigin(0.5);
            },
        }, container);

        // Cancel
        this._makeInlineButton(width / 2 + 75, DY + DH - 42, 120, 36, {
            label: 'Cancel',
            color: 0x1a2a1a,
            hover: 0x2a4a2a,
            border: 0x44aa66,
            action: () => this._clearModal(),
        }, container);
    }

    // ----------------------------------------------------------------
    // Utility: inline button (added to a container)
    // ----------------------------------------------------------------

    _makeInlineButton(cx, cy, bw, bh, def, container) {
        const bx = cx - bw / 2;
        const by = cy - bh / 2;

        const bg = this.add.graphics();
        const draw = (fillColor, borderAlpha) => {
            bg.clear();
            bg.fillStyle(fillColor, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 6);
            bg.lineStyle(1.5, def.border, borderAlpha);
            bg.strokeRoundedRect(bx, by, bw, bh, 6);
        };
        draw(def.color, 0.6);

        const lbl = this.add.text(cx, cy, def.label, {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);

        const zone = this.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => draw(def.hover, 1.0));
        zone.on('pointerout',  () => draw(def.color, 0.6));
        zone.on('pointerdown', () => def.action());

        if (container) {
            container.add(bg);
            container.add(lbl);
            container.add(zone);
        }

        return { bg, lbl, zone };
    }

    // ----------------------------------------------------------------
    // Modal helpers
    // ----------------------------------------------------------------

    _clearModal() {
        if (this._modalContainer) {
            this._modalContainer.destroy(true);
            this._modalContainer = null;
        }
    }

    // ----------------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------------

    shutdown() {
        this.events.off('update', this._updateParticles, this);
        this._particles.forEach(p => p.gfx?.destroy());
        this._particles = [];
        this._clearModal();
        if (this._bgm) { this._bgm.stop(); this._bgm = null; }
    }
}
