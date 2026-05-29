import Phaser from 'phaser';
import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * GameInfoPanel — TAB-key overlay panel with 7 tabs:
 *   QUESTS | LOCATIONS | SAP CYCLE | AI DM | DSP POOL | CHARACTER | FACTIONS
 *
 * All data comes from EventBus events — zero direct coupling to GameScene.
 */
export default class GameInfoPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this._activeTab = 0;
        this._container = null;

        // Rolling data buffers
        this._quests = [];           // { id, title, objectives[], completed }
        this._locations = [];        // from dataManager
        this._discoveredZones = new Set(['canopy_of_life']);
        this._currentZone = 'canopy_of_life';
        this._sapPhase = 'blue';
        this._sapProgress = 0;
        this._phaseHistory = [];     // last 3 phases
        this._dmMessages = [];       // last 20 narrations
        this._dspValue = 0;
        this._dspHistory = [];       // last 20 readings (0-100)
        this._playerStats = {};
        this._equipmentSlots = {};

        this._build();
        this._wireEvents();
    }

    // ─────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────

    toggle() {
        this.visible ? this.hide() : this.show();
    }

    show() {
        this.visible = true;
        this._container.setVisible(true);
        this._refreshTab(this._activeTab);
    }

    hide() {
        this.visible = false;
        this._container.setVisible(false);
    }

    // ─────────────────────────────────────────────────────────────────
    // Build UI
    // ─────────────────────────────────────────────────────────────────

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        const PW = 920, PH = 580;
        const PX = Math.round(width / 2 - PW / 2);
        const PY = Math.round(height / 2 - PH / 2);
        const DEPTH = 9500;

        this._container = s.add.container(PX, PY).setDepth(DEPTH).setScrollFactor(0);

        // Background panel
        const bg = s.add.graphics();
        bg.fillStyle(0x06060f, 0.97);
        bg.fillRoundedRect(0, 0, PW, PH, 12);
        bg.lineStyle(2, 0x334477, 0.9);
        bg.strokeRoundedRect(0, 0, PW, PH, 12);
        this._container.add(bg);

        // Header
        const hdr = s.add.text(PW / 2, 20, 'GAME INFO', {
            fontFamily: 'Open Sans', fontSize: '22px', color: '#8899cc',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        this._container.add(hdr);

        // Close button
        const closeZone = s.add.zone(PW - 22, 20, 28, 28).setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => this.hide());
        const closeX = s.add.text(PW - 22, 20, '✕', {
            fontFamily: 'Open Sans', fontSize: '21px', color: '#aa5555'
        }).setOrigin(0.5);
        this._container.add([closeZone, closeX]);

        // Tab bar
        const TABS = ['QUESTS', 'LOCATIONS', 'SAP CYCLE', 'AI DM', 'DSP POOL', 'CHARACTER', 'FACTIONS'];
        const TAB_W = Math.floor(PW / TABS.length);
        this._tabBgs = [];
        this._tabLabels = [];

        TABS.forEach((label, i) => {
            const tx = i * TAB_W;
            const tabBg = s.add.graphics();
            this._drawTabBg(tabBg, tx, 44, TAB_W - 2, 34, i === 0);
            const tabTxt = s.add.text(tx + TAB_W / 2, 61, label, {
                fontFamily: 'Open Sans', fontSize: '15px', color: i === 0 ? '#ffffff' : '#888899'
            }).setOrigin(0.5);
            const tabZone = s.add.zone(tx + TAB_W / 2, 61, TAB_W - 2, 34).setInteractive({ useHandCursor: true });
            tabZone.on('pointerdown', () => this._selectTab(i));
            this._container.add([tabBg, tabTxt, tabZone]);
            this._tabBgs.push(tabBg);
            this._tabLabels.push(tabTxt);
        });

        // Divider
        const div = s.add.graphics();
        div.lineStyle(1, 0x223355, 0.7);
        div.lineBetween(8, 80, PW - 8, 80);
        this._container.add(div);

        // Content area (clipped region)
        this._contentArea = s.add.container(10, 88);
        this._container.add(this._contentArea);
        this._contentW = PW - 20;
        this._contentH = PH - 96;

        this._container.setVisible(false);

        // ESC to close
        s.input.keyboard.on('keydown-ESC', () => { if (this.visible) this.hide(); });
    }

    _drawTabBg(gfx, x, y, w, h, active) {
        gfx.clear();
        gfx.fillStyle(active ? 0x1a2244 : 0x0d0d1a, 0.95);
        gfx.fillRoundedRect(x, y, w, h, 4);
        if (active) {
            gfx.lineStyle(2, 0x4466cc, 0.8);
            gfx.strokeRoundedRect(x, y, w, h, 4);
        }
    }

    _selectTab(index) {
        this._activeTab = index;
        const TABS = ['QUESTS', 'LOCATIONS', 'SAP CYCLE', 'AI DM', 'DSP POOL', 'CHARACTER', 'FACTIONS'];
        const TAB_W = Math.floor(920 / TABS.length);
        this._tabBgs.forEach((bg, i) => {
            this._drawTabBg(bg, i * TAB_W, 44, TAB_W - 2, 34, i === index);
            this._tabLabels[i].setColor(i === index ? '#ffffff' : '#888899');
        });
        this._refreshTab(index);
    }

    _clearContent() {
        this._contentArea.removeAll(true);
    }

    _refreshTab(index) {
        this._clearContent();
        switch (index) {
            case 0: this._buildQuestsTab(); break;
            case 1: this._buildLocationsTab(); break;
            case 2: this._buildSapCycleTab(); break;
            case 3: this._buildDMTab(); break;
            case 4: this._buildDSPTab(); break;
            case 5: this._buildCharacterTab(); break;
            case 6: this._buildFactionsTab(); break;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 0 — QUESTS
    // ─────────────────────────────────────────────────────────────────

    _buildQuestsTab() {
        const s = this.scene;
        const CW = this._contentW, CH = this._contentH;
        const active = this._quests.filter(q => !q.completed);
        const done = this._quests.filter(q => q.completed);

        let y = 0;

        const addLabel = (text, color = '#aaccff', size = '13px') => {
            const t = s.add.text(0, y, text, { fontFamily: 'Open Sans', fontSize: size, color });
            this._contentArea.add(t);
            y += parseInt(size) + 8;
        };

        if (active.length === 0) {
            addLabel('No active quests.', '#555566');
        } else {
            addLabel(`ACTIVE QUESTS (${active.length})`, '#aaccff', '12px');
            active.forEach(q => {
                if (y > CH - 20) return;
                const bg = s.add.graphics();
                bg.fillStyle(0x0d1122, 0.8);
                bg.fillRoundedRect(0, y, CW - 2, 56, 5);
                bg.lineStyle(1, 0x334477, 0.6);
                bg.strokeRoundedRect(0, y, CW - 2, 56, 5);
                this._contentArea.add(bg);

                const title = s.add.text(8, y + 6, q.title || q.id, {
                    fontFamily: 'Open Sans', fontSize: '18px', color: '#cceeff'
                });
                this._contentArea.add(title);

                const objs = q.objectives || [];
                objs.slice(0, 2).forEach((obj, oi) => {
                    const pct = Math.min(1, (obj.current || 0) / Math.max(1, obj.required || obj.count || 1));
                    const barW = Math.floor((CW - 80) * 0.6);
                    const barBg = s.add.graphics();
                    const barY = y + 26 + oi * 14;
                    barBg.fillStyle(0x222233, 0.9); barBg.fillRect(8, barY, barW, 8);
                    barBg.fillStyle(pct >= 1 ? 0x44cc44 : 0x4477cc, 0.9);
                    barBg.fillRect(8, barY, Math.round(barW * pct), 8);
                    const objTxt = s.add.text(barW + 16, barY, `${obj.description || obj.type || 'Objective'} ${obj.current || 0}/${obj.required || obj.count || 1}`, {
                        fontFamily: 'Open Sans', fontSize: '14px', color: '#778899'
                    }).setOrigin(0, 0);
                    this._contentArea.add([barBg, objTxt]);
                });

                y += 64;
            });
        }

        if (done.length > 0) {
            y += 6;
            addLabel(`COMPLETED (${done.length})`, '#558855', '11px');
            done.slice(-5).forEach(q => {
                if (y > CH - 16) return;
                const t = s.add.text(8, y, `✓ ${q.title || q.id}`, { fontFamily: 'Open Sans', fontSize: '15px', color: '#447744' });
                this._contentArea.add(t);
                y += 18;
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 1 — LOCATIONS
    // ─────────────────────────────────────────────────────────────────

    _buildLocationsTab() {
        const s = this.scene;
        const CW = this._contentW;
        const locations = this._locations.length
            ? this._locations
            : (dataManager.getAllLocations?.() || []);

        const COLS = 3;
        const CARD_W = Math.floor((CW - (COLS - 1) * 6) / COLS);
        const CARD_H = 64;

        locations.forEach((loc, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const cx = col * (CARD_W + 6);
            const cy = row * (CARD_H + 6);
            const discovered = this._discoveredZones.has(loc.id);
            const isCurrent = loc.id === this._currentZone;

            const bg = s.add.graphics();
            bg.fillStyle(isCurrent ? 0x1a2233 : (discovered ? 0x0d1020 : 0x090910), 0.9);
            bg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 5);
            bg.lineStyle(1, isCurrent ? 0xffcc44 : (discovered ? 0x334455 : 0x222233), isCurrent ? 1 : 0.6);
            bg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 5);
            this._contentArea.add(bg);

            const nameColor = isCurrent ? '#ffcc88' : (discovered ? '#99bbcc' : '#334455');
            const name = s.add.text(cx + 8, cy + 8, discovered ? (loc.name || loc.id) : '???', {
                fontFamily: 'Open Sans', fontSize: '15px', color: nameColor
            });
            this._contentArea.add(name);

            if (discovered) {
                const typeTxt = s.add.text(cx + 8, cy + 26, loc.type || '', {
                    fontFamily: 'Open Sans', fontSize: '14px', color: '#556677',
                    backgroundColor: '#111122', padding: { x: 4, y: 2 }
                });
                this._contentArea.add(typeTxt);

                if (isCurrent) {
                    const curTxt = s.add.text(cx + CARD_W - 8, cy + 8, '★ HERE', {
                        fontFamily: 'Open Sans', fontSize: '13px', color: '#ffcc44'
                    }).setOrigin(1, 0);
                    this._contentArea.add(curTxt);
                } else {
                    const travelZone = s.add.zone(cx + CARD_W / 2, cy + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
                    travelZone.on('pointerdown', () => {
                        this.hide();
                        EventBus.emit('worldmap:travelTo', { locationId: loc.id });
                    });
                    travelZone.on('pointerover', () => { bg.clear(); bg.fillStyle(0x1a2244, 0.9); bg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 5); bg.lineStyle(1, 0x4466aa, 0.8); bg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 5); });
                    travelZone.on('pointerout', () => { bg.clear(); bg.fillStyle(0x0d1020, 0.9); bg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 5); bg.lineStyle(1, 0x334455, 0.6); bg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 5); });
                    this._contentArea.add(travelZone);
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 2 — SAP CYCLE
    // ─────────────────────────────────────────────────────────────────

    _buildSapCycleTab() {
        const s = this.scene;
        const CW = this._contentW;

        const PHASE_DATA = {
            blue:    { color: 0x4499ff, textColor: '#88ccff', label: 'BLUE PHASE',    desc: 'Restoration — Healing amplified, Sap regenerates fast, peaceful encounters' },
            crimson: { color: 0xff4433, textColor: '#ff8877', label: 'CRIMSON PHASE', desc: 'Corruption — Combat power surges, enemies grow aggressive and deal more damage' },
            silver:  { color: 0xccddff, textColor: '#ddeeff', label: 'SILVER PHASE',  desc: 'Convergence — Portals open, rare drops increase, Veilkeeper powers peak' },
        };
        const DURATIONS = { blue: 45, crimson: 30, silver: 60 };

        const pd = PHASE_DATA[this._sapPhase] || PHASE_DATA.blue;
        const cx = CW / 2;

        // Phase name
        const phaseLabel = s.add.text(cx, 20, pd.label, {
            fontFamily: 'Open Sans', fontSize: '39px', color: pd.textColor,
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this._contentArea.add(phaseLabel);

        // Circular progress ring
        const ringX = Math.round(cx), ringY = 130, R = 60;
        const ring = s.add.graphics();
        ring.lineStyle(8, 0x222233, 0.7);
        ring.strokeCircle(ringX, ringY, R);
        const fillAngle = -Math.PI / 2 + this._sapProgress * Math.PI * 2;
        ring.lineStyle(8, pd.color, 0.9);
        ring.beginPath();
        ring.arc(ringX, ringY, R, -Math.PI / 2, fillAngle, false);
        ring.strokePath();
        this._contentArea.add(ring);

        const dur = DURATIONS[this._sapPhase] || 45;
        const remaining = Math.round(dur * (1 - this._sapProgress));
        const timeText = s.add.text(ringX, ringY, `${remaining}s`, {
            fontFamily: 'Open Sans', fontSize: '31px', color: '#ffffff'
        }).setOrigin(0.5);
        this._contentArea.add(timeText);

        const descText = s.add.text(cx, 210, pd.desc, {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#aabbcc',
            wordWrap: { width: CW - 40 }, align: 'center'
        }).setOrigin(0.5, 0);
        this._contentArea.add(descText);

        // Phase timeline
        const tlY = 270;
        const tlLabel = s.add.text(16, tlY, 'PHASE HISTORY', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(tlLabel);

        const recent = [...this._phaseHistory].slice(-5);
        recent.forEach((ph, i) => {
            const phData = PHASE_DATA[ph] || PHASE_DATA.blue;
            const dot = s.add.graphics();
            dot.fillStyle(phData.color, 0.8);
            dot.fillCircle(24 + i * 100, tlY + 28, 8);
            const lbl = s.add.text(24 + i * 100, tlY + 44, phData.label.split(' ')[0], {
                fontFamily: 'Open Sans', fontSize: '13px', color: phData.textColor
            }).setOrigin(0.5, 0);
            this._contentArea.add([dot, lbl]);

            if (i < recent.length - 1) {
                const arrow = s.add.graphics();
                arrow.lineStyle(1, 0x333344, 0.7);
                arrow.lineBetween(32 + i * 100, tlY + 28, 115 + i * 100, tlY + 28);
                this._contentArea.add(arrow);
            }
        });

        // All 3 phase cards
        const phases = ['blue', 'crimson', 'silver'];
        const cardW = Math.floor((CW - 20) / 3);
        phases.forEach((ph, i) => {
            const phD = PHASE_DATA[ph];
            const DURATIONS2 = { blue: '45s', crimson: '30s', silver: '60s' };
            const isActive = ph === this._sapPhase;
            const cx2 = i * (cardW + 8);
            const cy2 = 340;
            const cardH = 80;
            const phBg = s.add.graphics();
            phBg.fillStyle(isActive ? 0x1a2233 : 0x0d0d1a, 0.9);
            phBg.fillRoundedRect(cx2, cy2, cardW, cardH, 6);
            phBg.lineStyle(2, isActive ? phD.color : 0x222233, isActive ? 0.8 : 0.4);
            phBg.strokeRoundedRect(cx2, cy2, cardW, cardH, 6);
            const phName = s.add.text(cx2 + cardW / 2, cy2 + 14, phD.label, {
                fontFamily: 'Open Sans', fontSize: '15px', color: phD.textColor
            }).setOrigin(0.5);
            const phDur = s.add.text(cx2 + cardW / 2, cy2 + 34, DURATIONS2[ph], {
                fontFamily: 'Open Sans', fontSize: '20px', color: '#aaaacc'
            }).setOrigin(0.5);
            this._contentArea.add([phBg, phName, phDur]);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 3 — AI DM
    // ─────────────────────────────────────────────────────────────────

    _buildDMTab() {
        const s = this.scene;
        const CW = this._contentW, CH = this._contentH;

        const header = s.add.text(CW / 2, 8, 'AI DUNGEON MASTER', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#ccaaff'
        }).setOrigin(0.5);
        this._contentArea.add(header);

        // Status badge
        const statusBg = s.add.graphics();
        statusBg.fillStyle(this._dmMessages.length > 0 ? 0x223322 : 0x221122, 0.9);
        statusBg.fillRoundedRect(CW - 110, 2, 100, 24, 4);
        const statusTxt = s.add.text(CW - 60, 14, this._dmMessages.length > 0 ? '● ACTIVE' : '○ IDLE', {
            fontFamily: 'Open Sans', fontSize: '15px', color: this._dmMessages.length > 0 ? '#44ff88' : '#884488'
        }).setOrigin(0.5);
        this._contentArea.add([statusBg, statusTxt]);

        // Message log
        const logY = 42;
        const logH = CH - logY - 60;
        const logBg = s.add.graphics();
        logBg.fillStyle(0x050510, 0.8);
        logBg.fillRect(0, logY, CW, logH);
        this._contentArea.add(logBg);

        const msgs = this._dmMessages.slice(-8);
        if (msgs.length === 0) {
            const emptyTxt = s.add.text(CW / 2, logY + logH / 2, 'No narrations yet.\nExplore the world to hear from the AI Dungeon Master.', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#333355', align: 'center'
            }).setOrigin(0.5);
            this._contentArea.add(emptyTxt);
        } else {
            let msgY = logY + 8;
            msgs.forEach((msg) => {
                const bubble = s.add.text(8, msgY, msg, {
                    fontFamily: 'Open Sans', fontSize: '15px', color: '#aabbcc',
                    wordWrap: { width: CW - 20 }
                });
                this._contentArea.add(bubble);
                msgY += bubble.height + 10;
            });
        }

        // Request narration button
        const btnY = CH - 46;
        const reqBg = s.add.graphics();
        reqBg.fillStyle(0x332244, 0.9);
        reqBg.fillRoundedRect(CW / 2 - 110, btnY, 220, 34, 6);
        const reqTxt = s.add.text(CW / 2, btnY + 17, '⚡ Request Narration', {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#cc88ff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        reqTxt.on('pointerdown', () => { EventBus.emit('dm:requestNarration', { context: 'player_request' }); });
        reqTxt.on('pointerover', () => { reqBg.clear(); reqBg.fillStyle(0x4433aa, 0.9); reqBg.fillRoundedRect(CW / 2 - 110, btnY, 220, 34, 6); });
        reqTxt.on('pointerout', () => { reqBg.clear(); reqBg.fillStyle(0x332244, 0.9); reqBg.fillRoundedRect(CW / 2 - 110, btnY, 220, 34, 6); });
        this._contentArea.add([reqBg, reqTxt]);
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 4 — DSP POOL
    // ─────────────────────────────────────────────────────────────────

    _buildDSPTab() {
        const s = this.scene;
        const CW = this._contentW;
        const dsp = this._dspValue;

        const THRESHOLDS = [
            { max: 30,  label: 'STABLE',    color: 0x44cc66, textColor: '#44ff88', desc: 'No effects. Dimensional fabric is intact.' },
            { max: 60,  label: 'STRAINED',  color: 0xcccc33, textColor: '#ffff44', desc: 'Minor visual distortions. Edge effects visible.' },
            { max: 80,  label: 'CRITICAL',  color: 0xcc7722, textColor: '#ff9944', desc: 'Enemy aggro increased. Sap drains faster.' },
            { max: 100, label: 'OVERLOAD',  color: 0xcc2222, textColor: '#ff4444', desc: 'World corruption visible. Reality fractures imminent!' },
        ];
        const tier = THRESHOLDS.find(t => dsp <= t.max) || THRESHOLDS[3];

        // Large gauge
        const gX = Math.round(CW / 2), gY = 110, gR = 85;
        const gaugeGfx = s.add.graphics();

        // Background arc
        gaugeGfx.lineStyle(14, 0x111122, 0.9);
        gaugeGfx.arc(gX, gY, gR, Phaser.Math.DegToRad(150), Phaser.Math.DegToRad(390), false);
        gaugeGfx.strokePath();

        // Colored zones on gauge
        const zones = [
            { from: 150, to: 222, col: 0x44cc66 },   // 0-30  stable
            { from: 222, to: 270, col: 0xcccc33 },   // 30-60 strained
            { from: 270, to: 306, col: 0xcc7722 },   // 60-80 critical
            { from: 306, to: 390, col: 0xcc2222 },   // 80-100 overload
        ];
        zones.forEach(z => {
            gaugeGfx.lineStyle(14, z.col, 0.25);
            gaugeGfx.beginPath();
            gaugeGfx.arc(gX, gY, gR, Phaser.Math.DegToRad(z.from), Phaser.Math.DegToRad(z.to), false);
            gaugeGfx.strokePath();
        });

        // Fill arc
        const fillEnd = 150 + (dsp / 100) * 240;
        gaugeGfx.lineStyle(14, tier.color, 0.9);
        gaugeGfx.beginPath();
        gaugeGfx.arc(gX, gY, gR, Phaser.Math.DegToRad(150), Phaser.Math.DegToRad(fillEnd), false);
        gaugeGfx.strokePath();
        this._contentArea.add(gaugeGfx);

        // Center value
        const valTxt = s.add.text(gX, gY, `${Math.round(dsp)}`, {
            fontFamily: 'Open Sans', fontSize: '45px', color: tier.textColor,
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this._contentArea.add(valTxt);

        const tierTxt = s.add.text(gX, gY + 30, tier.label, {
            fontFamily: 'Open Sans', fontSize: '18px', color: tier.textColor
        }).setOrigin(0.5);
        this._contentArea.add(tierTxt);

        // Description
        const descTxt = s.add.text(gX, 218, tier.desc, {
            fontFamily: 'Open Sans', fontSize: '17px', color: '#aaaacc',
            wordWrap: { width: CW - 60 }, align: 'center'
        }).setOrigin(0.5, 0);
        this._contentArea.add(descTxt);

        // Threshold table
        const tblY = 270;
        const tblLabel = s.add.text(16, tblY, 'THRESHOLDS', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(tblLabel);
        THRESHOLDS.forEach((t, i) => {
            const prevMax = i > 0 ? THRESHOLDS[i - 1].max : 0;
            const row = s.add.text(16, tblY + 20 + i * 22,
                `${prevMax}–${t.max}  ${t.label}  —  ${t.desc}`, {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#' + t.color.toString(16).padStart(6, '0')
            });
            this._contentArea.add(row);
        });

        // Sparkline history
        const sparkY = 380;
        const sparkLabel = s.add.text(16, sparkY, 'HISTORY', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(sparkLabel);
        if (this._dspHistory.length > 1) {
            const sparkGfx = s.add.graphics();
            const sparkW = CW - 40, sparkH = 50;
            sparkGfx.fillStyle(0x050510, 0.6);
            sparkGfx.fillRect(16, sparkY + 16, sparkW, sparkH);
            sparkGfx.lineStyle(1, 0x4466cc, 0.8);
            const pts = this._dspHistory.slice(-20);
            pts.forEach((v, i) => {
                const px2 = 16 + (i / (pts.length - 1)) * sparkW;
                const py2 = sparkY + 16 + sparkH - (v / 100) * sparkH;
                if (i === 0) sparkGfx.moveTo(px2, py2);
                else sparkGfx.lineTo(px2, py2);
            });
            sparkGfx.strokePath();
            this._contentArea.add(sparkGfx);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 5 — CHARACTER
    // ─────────────────────────────────────────────────────────────────

    _buildCharacterTab() {
        const s = this.scene;
        const CW = this._contentW;
        const stats = this._playerStats;

        // HP / SAP / Guard bars
        const bars = [
            { label: 'HP',    val: stats.hp || 0,    max: stats.maxHp || 100,    color: 0xcc4444 },
            { label: 'SAP',   val: stats.sap || 0,   max: stats.maxSap || 100,   color: 0x4488cc },
            { label: 'GUARD', val: stats.guard || 0, max: stats.maxGuard || 10,  color: 0x888844 },
        ];
        let y = 8;
        bars.forEach(b => {
            const barLabel = s.add.text(8, y, b.label, { fontFamily: 'Open Sans', fontSize: '17px', color: '#aaaacc' });
            const barBg = s.add.graphics();
            const barW = CW - 120;
            barBg.fillStyle(0x111122, 0.9); barBg.fillRoundedRect(60, y - 1, barW, 18, 3);
            barBg.fillStyle(b.color, 0.85); barBg.fillRoundedRect(60, y - 1, Math.round(barW * Math.min(1, (b.val / Math.max(1, b.max)))), 18, 3);
            const barVal = s.add.text(CW - 50, y + 8, `${Math.round(b.val)}/${Math.round(b.max)}`, { fontFamily: 'Open Sans', fontSize: '15px', color: '#888899' }).setOrigin(0, 0.5);
            this._contentArea.add([barLabel, barBg, barVal]);
            y += 26;
        });

        // Attributes
        y += 8;
        const attrLabel = s.add.text(8, y, 'ATTRIBUTES', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(attrLabel);
        y += 18;

        const attrs = ['might', 'agility', 'resilience', 'insight', 'charisma'];
        const attrColors = { might: '#ff8844', agility: '#44ff88', resilience: '#4488ff', insight: '#cc88ff', charisma: '#ffcc44' };
        attrs.forEach((attr, i) => {
            const col = i < 3 ? 0 : Math.floor((CW / 2));
            const rowY = y + Math.floor(i / 2 < 1 ? i * 22 : (i % 3) * 22);
            const val = stats[attr] || stats[`equip${attr.charAt(0).toUpperCase() + attr.slice(1)}`] || 0;
            const txt = s.add.text(col === 0 ? 8 : col, rowY, `${attr.toUpperCase()}: ${val}`, {
                fontFamily: 'Open Sans', fontSize: '17px', color: attrColors[attr]
            });
            this._contentArea.add(txt);
        });
        y += 3 * 22 + 12;

        // Equipment summary
        const eqLabel = s.add.text(8, y, 'EQUIPMENT', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(eqLabel);
        y += 18;

        const eqSlots = Object.entries(this._equipmentSlots || {});
        eqSlots.slice(0, 8).forEach(([slotName, item]) => {
            const slotTxt = s.add.text(8, y, `${slotName.toUpperCase().padEnd(8)} ${item ? (item.name || item.id) : '—'}`, {
                fontFamily: 'Open Sans', fontSize: '15px', color: item ? '#99bbcc' : '#333344'
            });
            this._contentArea.add(slotTxt);
            y += 18;
        });

        // Active effects (placeholder)
        const effectLabel = s.add.text(CW / 2 + 8, 100, 'ACTIVE EFFECTS', { fontFamily: 'Open Sans', fontSize: '15px', color: '#556677' });
        this._contentArea.add(effectLabel);
        const noEffects = s.add.text(CW / 2 + 8, 120, 'None', { fontFamily: 'Open Sans', fontSize: '15px', color: '#333344' });
        this._contentArea.add(noEffects);
    }

    // ─────────────────────────────────────────────────────────────────
    // Tab 6 — FACTIONS
    // ─────────────────────────────────────────────────────────────────

    _buildFactionsTab() {
        const s = this.scene;
        const CW = this._contentW;

        const FACTIONS = [
            { id: 'bloomguard',    name: 'Bloomguard',    role: 'Peacekeepers',    color: 0x44aa66 },
            { id: 'thornbinders',  name: 'Thornbinders',  role: 'Nature Wardens',  color: 0x886633 },
            { id: 'emerald_coven', name: 'Emerald Coven', role: 'Arcane Scholars', color: 0x44aaaa },
            { id: 'wildkin_pact',  name: 'Wildkin Pact',  role: 'Beast Speakers',  color: 0xaa7733 },
            { id: 'veilkeepers',   name: 'Veilkeepers',   role: 'Mystic Guardians',color: 0x8844aa },
            { id: 'hollow_court',  name: 'Hollow Court',  role: 'Shadow Brokers',  color: 0x444466 },
        ];

        const getRepTier = (rep) => {
            if (rep <= -26) return { label: 'HOSTILE',    color: 0xff3333, textColor: '#ff4444' };
            if (rep <= -6)  return { label: 'UNFRIENDLY', color: 0xff8844, textColor: '#ff9955' };
            if (rep <= 5)   return { label: 'NEUTRAL',    color: 0x888899, textColor: '#9999aa' };
            if (rep <= 25)  return { label: 'FRIENDLY',   color: 0x44cc88, textColor: '#44dd99' };
            if (rep <= 49)  return { label: 'HONORED',    color: 0x44aaff, textColor: '#55bbff' };
            return             { label: 'REVERED',    color: 0xffcc44, textColor: '#ffdd55' };
        };

        const CARD_W = Math.floor((CW - 12) / 2);
        const CARD_H = 80;
        const COLS = 2;

        FACTIONS.forEach((faction, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const cx = col * (CARD_W + 12);
            const cy = row * (CARD_H + 8);

            const rep = globalThis.__factionSystem?.getReputation?.(faction.id) ?? 0;
            const tier = getRepTier(rep);

            // Card background
            const cardBg = s.add.graphics();
            cardBg.fillStyle(0x0d1020, 0.92);
            cardBg.fillRoundedRect(cx, cy, CARD_W, CARD_H, 6);
            cardBg.lineStyle(2, faction.color, 0.35);
            cardBg.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 6);
            this._contentArea.add(cardBg);

            // Color accent strip on left edge
            const accentGfx = s.add.graphics();
            accentGfx.fillStyle(faction.color, 0.7);
            accentGfx.fillRoundedRect(cx, cy, 4, CARD_H, { tl: 6, tr: 0, bl: 6, br: 0 });
            this._contentArea.add(accentGfx);

            // Faction name
            const nameTxt = s.add.text(cx + 12, cy + 8, faction.name, {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#ddeeff',
            });
            this._contentArea.add(nameTxt);

            // Role
            const roleTxt = s.add.text(cx + 12, cy + 24, faction.role, {
                fontFamily: 'Open Sans', fontSize: '14px', color: '#556677',
            });
            this._contentArea.add(roleTxt);

            // Reputation bar: range -50 to +50 mapped to full bar width
            const BAR_X = cx + 12;
            const BAR_Y = cy + 44;
            const BAR_W = CARD_W - 24;
            const BAR_H = 10;

            const barBg = s.add.graphics();
            barBg.fillStyle(0x111122, 0.9);
            barBg.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 3);

            // Center line at neutral
            const centerX = BAR_X + Math.floor(BAR_W / 2);
            barBg.lineStyle(1, 0x334455, 0.8);
            barBg.lineBetween(centerX, BAR_Y, centerX, BAR_Y + BAR_H);
            this._contentArea.add(barBg);

            // Fill from center
            const fillGfx = s.add.graphics();
            const repClamped = Math.max(-50, Math.min(50, rep));
            if (repClamped !== 0) {
                const fillLen = Math.round((Math.abs(repClamped) / 50) * (BAR_W / 2));
                if (repClamped > 0) {
                    fillGfx.fillStyle(tier.color, 0.85);
                    fillGfx.fillRoundedRect(centerX, BAR_Y, fillLen, BAR_H, { tl: 0, tr: 3, bl: 0, br: 3 });
                } else {
                    fillGfx.fillStyle(tier.color, 0.85);
                    fillGfx.fillRoundedRect(centerX - fillLen, BAR_Y, fillLen, BAR_H, { tl: 3, tr: 0, bl: 3, br: 0 });
                }
            }
            this._contentArea.add(fillGfx);

            // Rep tier label
            const tierTxt = s.add.text(cx + 12, cy + 58, tier.label, {
                fontFamily: 'Open Sans', fontSize: '13px', color: tier.textColor,
            });
            this._contentArea.add(tierTxt);

            // Rep numeric value
            const repSign = rep > 0 ? '+' : '';
            const repValTxt = s.add.text(cx + CARD_W - 8, cy + 58, `${repSign}${rep}`, {
                fontFamily: 'Open Sans', fontSize: '13px', color: tier.textColor,
            }).setOrigin(1, 0);
            this._contentArea.add(repValTxt);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // EventBus wiring
    // ─────────────────────────────────────────────────────────────────

    _wireEvents() {
        this._unsubs = [
            EventBus.on('quest:started', (data) => {
                if (!this._quests.find(q => q.id === data.id)) {
                    this._quests.push({ id: data.id, title: data.name || data.title || data.id, objectives: data.objectives || [], completed: false });
                    if (this.visible && this._activeTab === 0) this._refreshTab(0);
                }
            }),
            EventBus.on('quest:objectiveUpdated', (data) => {
                const q = this._quests.find(q => q.id === data.questId);
                if (q) {
                    const obj = q.objectives.find(o => o.id === data.objectiveId || o.type === data.objectiveId);
                    if (obj) obj.current = data.current;
                    if (this.visible && this._activeTab === 0) this._refreshTab(0);
                }
            }),
            EventBus.on('quest:completed', (data) => {
                const q = this._quests.find(q => q.id === data.id);
                if (q) q.completed = true;
                if (this.visible && this._activeTab === 0) this._refreshTab(0);
            }),
            EventBus.on('zone:entered', (data) => {
                this._discoveredZones.add(data.id || data.locationId);
                this._currentZone = data.id || data.locationId || this._currentZone;
                if (this.visible && this._activeTab === 1) this._refreshTab(1);
            }),
            EventBus.on('zone-entered', (data) => {
                this._discoveredZones.add(data.id || data.locationId || data.name);
                this._currentZone = data.id || data.locationId || this._currentZone;
                if (this.visible && this._activeTab === 1) this._refreshTab(1);
            }),
            EventBus.on('worldmap:travelTo', (data) => {
                if (data?.locationId) {
                    this._discoveredZones.add(data.locationId);
                    this._currentZone = data.locationId;
                }
            }),
            EventBus.on('sap-cycle-tick', (data) => {
                const phase = typeof data === 'string' ? data : data?.phase;
                const progress = typeof data === 'string' ? undefined : data?.progress;
                this._sapPhase = phase;
                this._sapProgress = progress;
                if (this.visible && this._activeTab === 2) this._refreshTab(2);
            }),
            EventBus.on('phase-changed', (newPhase) => {
                if (newPhase !== this._sapPhase) {
                    this._phaseHistory.push(this._sapPhase);
                    if (this._phaseHistory.length > 10) this._phaseHistory.shift();
                }
                this._sapPhase = newPhase;
                if (this.visible && this._activeTab === 2) this._refreshTab(2);
            }),
            EventBus.on('dm:narration', (data) => {
                const text = data?.text || data?.message || String(data);
                this._dmMessages.push(text);
                if (this._dmMessages.length > 20) this._dmMessages.shift();
                if (this.visible && this._activeTab === 3) this._refreshTab(3);
            }),
            EventBus.on('dsp:changed', (status) => {
                this._dspValue = status?.value ?? status?.current ?? 0;
                this._dspHistory.push(this._dspValue);
                if (this._dspHistory.length > 20) this._dspHistory.shift();
                if (this.visible && this._activeTab === 4) this._refreshTab(4);
            }),
            EventBus.on('player-stats-updated', (stats) => {
                this._playerStats = { ...stats };
                if (this.visible && this._activeTab === 5) this._refreshTab(5);
            }),
            EventBus.on('equipment:changed', (data) => {
                this._equipmentSlots = data?.slots || {};
                if (this.visible && this._activeTab === 5) this._refreshTab(5);
            }),
            EventBus.on('faction:reputationChanged', () => {
                if (this.visible && this._activeTab === 6) this._refreshTab(6);
            }),
        ];

        // Load initial locations
        try {
            this._locations = dataManager.getAllLocations?.() || [];
        } catch {}
    }

    destroy() {
        this._unsubs?.forEach(fn => fn());
        this._container?.destroy(true);
    }
}
