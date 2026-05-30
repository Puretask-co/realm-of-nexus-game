import Phaser from 'phaser';
import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * AdminScene — full-screen developer/admin overlay (DEV-only, hotkey F10).
 *
 * Lets us inspect and manipulate every gameplay singleton without writing
 * console one-liners. Tabs:
 *   Systems     DSP / SapCycle / Narrative / Faction / Difficulty live setters
 *   Player      HP / Gold / XP / Level + attribute setters
 *   Quests      list + start / complete / reset
 *   Inventory   search items + add to bag
 *   World       list zones + travel-to + force-discover
 *   Data        broken-ref report, reload data, dump save
 *
 * Built per docs/BEST_PRACTICES.md §5.1 (panel lifecycle) and §6.1
 * (scene shutdown unsubs everything).
 */
export default class AdminScene extends Phaser.Scene {
    constructor() { super({ key: 'AdminScene' }); }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        this._unsubs = [];

        // Backdrop (dark, blocks input below).
        const bg = this.add.graphics().setScrollFactor(0).setDepth(20000);
        bg.fillStyle(0x05060d, 0.92);
        bg.fillRect(0, 0, W, H);
        // Side stripe so it's obviously a dev panel, not the game.
        bg.fillStyle(0xff8800, 0.9);
        bg.fillRect(0, 0, 6, H);

        // Header.
        this.add.text(20, 14, 'ADMIN', {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#ffaa44', fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(20001);
        this.add.text(70, 18, 'F10 to close · DEV-only', {
            fontFamily: 'Open Sans', fontSize: '12px', color: '#7a7d8a'
        }).setScrollFactor(0).setDepth(20001);

        // Container for the active tab's content (rebuilt per tab switch).
        this._content = this.add.container(0, 0).setScrollFactor(0).setDepth(20002);

        // Tabs.
        this._tabs = ['Systems', 'Player', 'Quests', 'Inventory', 'World', 'Data'];
        this._activeTab = 'Systems';
        this._tabButtons = {};
        this._renderTabBar();
        this._showTab('Systems');

        // ESC + F10 close the admin overlay. Defer the actual stop so we
        // don't tear the scene down from inside its own keydown listener.
        this._closeHandler = (e) => {
            if (e.code === 'Escape' || e.code === 'F10') {
                this.time?.delayedCall?.(0, () => this.scene.stop());
            }
        };
        this.input.keyboard.on('keydown', this._closeHandler);

        // Live readouts on a 500ms heartbeat (cheap, only while panel is open).
        this._tickEvent = this.time.addEvent({
            delay: 500, loop: true, callback: () => this._tick()
        });
    }

    shutdown() {
        try { (this._unsubs || []).forEach(fn => { try { fn(); } catch (_) {} }); } catch (_) {}
        this._unsubs = [];
        try {
            if (this._closeHandler && this.input?.keyboard) {
                this.input.keyboard.off('keydown', this._closeHandler);
            }
        } catch (_) {}
        this._closeHandler = null;
        try {
            if (this._tickEvent && typeof this._tickEvent.remove === 'function') this._tickEvent.remove();
        } catch (_) {}
        this._tickEvent = null;
    }

    // ─── Tab bar ──────────────────────────────────────────────────

    _renderTabBar() {
        const Y = 46;
        let x = 20;
        for (const name of this._tabs) {
            const t = this.add.text(x, Y, name, {
                fontFamily: 'Open Sans', fontSize: '14px',
                color: name === this._activeTab ? '#ffd66a' : '#9aa0b8',
                backgroundColor: name === this._activeTab ? '#1a1a2a' : 'transparent',
                padding: { x: 10, y: 4 },
            }).setScrollFactor(0).setDepth(20001)
              .setInteractive({ useHandCursor: true });
            t.on('pointerdown', () => this._showTab(name));
            this._tabButtons[name] = t;
            x += t.width + 6;
        }
        // Underline
        const under = this.add.graphics().setScrollFactor(0).setDepth(20000);
        under.lineStyle(1, 0x444a5a, 0.6);
        under.lineBetween(0, Y + 26, this.scale.width, Y + 26);
    }

    _showTab(name) {
        this._activeTab = name;
        // Re-color tab buttons.
        for (const [n, t] of Object.entries(this._tabButtons)) {
            t.setColor(n === name ? '#ffd66a' : '#9aa0b8');
            t.setStyle({ backgroundColor: n === name ? '#1a1a2a' : 'transparent' });
        }
        // Rebuild content.
        this._content.removeAll(true);
        const builder = {
            Systems:   () => this._buildSystems(),
            Player:    () => this._buildPlayer(),
            Quests:    () => this._buildQuests(),
            Inventory: () => this._buildInventory(),
            World:     () => this._buildWorld(),
            Data:      () => this._buildData(),
        }[name];
        try { builder?.(); } catch (e) {
            this._content.add(this._mkText(20, 90, 'Tab error: ' + e.message, '#ff8a8a'));
        }
    }

    _tick() {
        // Re-render the active tab cheaply (whole rebuild — small content,
        // fine at 500ms). Keeps live readouts in sync with game state.
        if (this._tickEvent) this._showTab(this._activeTab);
    }

    // ─── Common helpers ───────────────────────────────────────────

    _gs() { return window.__GAME?.scene?.getScene?.('GameScene'); }
    _ui() { return window.__GAME?.scene?.getScene?.('UIScene'); }

    _mkText(x, y, str, color = '#dcdcec', size = 13) {
        return this.add.text(x, y, str, {
            fontFamily: 'Open Sans', fontSize: `${size}px`, color
        }).setScrollFactor(0).setDepth(20002);
    }

    _mkButton(x, y, w, h, label, onClick, color = '#3a4566', textColor = '#dcdcec') {
        const g = this.add.graphics().setScrollFactor(0).setDepth(20002);
        const rect = (col) => { g.clear(); g.fillStyle(parseInt(col.slice(1), 16), 0.95); g.fillRoundedRect(x, y, w, h, 4); };
        rect(color);
        const t = this.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: 'Open Sans', fontSize: '12px', color: textColor
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20003);
        const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        hit.on('pointerover', () => rect('#4a5680'));
        hit.on('pointerout',  () => rect(color));
        hit.on('pointerdown', () => { try { onClick(); } catch (e) { console.error('[Admin] btn error', e); } });
        this._content.add([g, t, hit]);
        return { g, t, hit };
    }

    _mkSlider(x, y, w, label, get, set, min, max, step = 1) {
        const trackY = y + 18;
        const range = max - min;
        const value = Math.max(min, Math.min(max, get()));
        const t01 = (value - min) / range;

        this._content.add(this._mkText(x, y, `${label}: ${value}`, '#bcd8ff'));

        const track = this.add.graphics().setScrollFactor(0).setDepth(20002);
        track.fillStyle(0x1a1f2c, 1); track.fillRect(x, trackY, w, 6);
        track.fillStyle(0x6688cc, 1); track.fillRect(x, trackY, w * t01, 6);

        const dot = this.add.circle(x + w * t01, trackY + 3, 6, 0xffd66a)
            .setScrollFactor(0).setDepth(20003);

        const hit = this.add.zone(x - 4, trackY - 10, w + 8, 26).setOrigin(0, 0)
            .setInteractive({ useHandCursor: true }).setScrollFactor(0);
        const apply = (px) => {
            const t = Math.max(0, Math.min(1, (px - x) / w));
            const raw = min + t * range;
            const snapped = step > 0 ? Math.round(raw / step) * step : raw;
            set(snapped);
        };
        hit.on('pointerdown', (p) => apply(p.x));
        hit.on('pointermove', (p) => { if (p.isDown) apply(p.x); });

        this._content.add([track, dot, hit]);
        return { track, dot, hit };
    }

    // ─── Systems tab ──────────────────────────────────────────────

    _buildSystems() {
        const gs = this._gs(); if (!gs) return this._content.add(this._mkText(20, 90, 'GameScene not active'));

        let y = 90;
        this._content.add(this._mkText(20, y, '— SYSTEMS —', '#ffaa44', 14)); y += 26;

        // DSP
        const dsp = gs.dspSystem;
        if (dsp) {
            this._mkSlider(20, y, 260, `DSP  (${Math.round(dsp.current)}/${dsp.max})`,
                () => Math.round(dsp.current),
                (v) => { dsp.current = Math.max(0, Math.min(dsp.max, v)); EventBus.emit('dsp:changed', dsp.getStatus()); },
                0, dsp.max, 1);
            this._mkButton(300, y + 12, 60, 22, 'Fill', () => { dsp.current = dsp.max; EventBus.emit('dsp:changed', dsp.getStatus()); });
            this._mkButton(366, y + 12, 60, 22, 'Empty', () => { dsp.current = 0; EventBus.emit('dsp:changed', dsp.getStatus()); });
            y += 50;
        }

        // SapCycle
        const sc = gs.sapCycle;
        if (sc) {
            this._content.add(this._mkText(20, y, `SapCycle: day ${sc.currentDay} / phase ${sc.currentPhase}`, '#bcd8ff'));
            const phases = ['crimson', 'silver', 'blue'];
            phases.forEach((ph, i) => {
                this._mkButton(180 + i * 70, y - 4, 64, 22, ph,
                    () => {
                        sc.currentPhase = ph;
                        sc.currentPhaseIndex = sc.phaseDefinitions.findIndex(p => p.name.toLowerCase() === ph);
                        EventBus.emit('sap-cycle-tick', ph, 0);
                        EventBus.emit('sapCycle:phaseChanged', { phase: ph });
                    });
            });
            this._mkButton(20, y + 26, 90, 22, '+1 Day', () => { sc.currentDay++; });
            y += 60;
        }

        // Narrative
        const ns = gs.narrativeSystem;
        if (ns) {
            this._content.add(this._mkText(20, y, `Narrative: era ${ns.currentEra}, act ${ns.currentAct}`, '#bcd8ff'));
            ['act_1', 'act_2', 'act_3'].forEach((aid, i) => {
                this._mkButton(180 + i * 70, y - 4, 64, 22, aid,
                    () => {
                        ns.currentAct = aid;
                        EventBus.emit('narrative:actChanged', { from: 'admin', to: aid, title: ns.getCurrentAct()?.title || aid });
                    });
            });
            y += 36;
        }

        // Difficulty
        const diff = gs.difficultySystem;
        if (diff) {
            this._content.add(this._mkText(20, y, `Difficulty: ${diff.currentDifficulty}`, '#bcd8ff'));
            ['easy', 'normal', 'hard'].forEach((d, i) => {
                this._mkButton(180 + i * 70, y - 4, 64, 22, d,
                    () => { diff.setDifficulty?.(d) || (diff.currentDifficulty = d); });
            });
            y += 36;
        }

        // Faction reputations
        const fs = gs.factionSystem;
        if (fs && fs.factions) {
            y += 6;
            this._content.add(this._mkText(20, y, '— FACTION REP (-50..+50) —', '#ffaa44', 14)); y += 24;
            for (const [id, f] of fs.factions) {
                this._mkSlider(20, y, 200, `${f.name}`, () => f.reputation,
                    (v) => { f.reputation = Math.max(-50, Math.min(50, v)); EventBus.emit('faction:reputationChanged', { factionId: id, value: f.reputation }); },
                    -50, 50, 1);
                this._content.add(this._mkText(240, y, `${f.reputation > 0 ? '+' : ''}${f.reputation}`,
                    f.reputation > 0 ? '#aaf0c0' : f.reputation < 0 ? '#f0a0a0' : '#9aa0b8'));
                y += 40;
            }
        }
    }

    // ─── Player tab ───────────────────────────────────────────────

    _buildPlayer() {
        const gs = this._gs(); if (!gs?.player?.stats) return this._content.add(this._mkText(20, 90, 'Player not ready'));
        const st = gs.player.stats;

        let y = 90;
        this._content.add(this._mkText(20, y, '— PLAYER —', '#ffaa44', 14)); y += 26;
        this._content.add(this._mkText(20, y, `Class: ${st.className || '—'}  ·  Level ${st.level}  ·  XP ${Math.round(st.experience || 0)}  ·  Gold ${st.gold || 0}`, '#bcd8ff'));
        y += 28;

        this._mkSlider(20, y, 260, `HP  (${Math.round(st.hp)}/${st.maxHp})`,
            () => Math.round(st.hp),
            (v) => { st.hp = Math.max(0, Math.min(st.maxHp, v)); EventBus.emit('player-stats-updated', st); },
            0, st.maxHp || 100, 1);
        this._mkButton(300, y + 12, 60, 22, 'Fill', () => { st.hp = st.maxHp; EventBus.emit('player-stats-updated', st); });
        y += 40;

        if (st.maxSap) {
            this._mkSlider(20, y, 260, `Sap (${Math.round(st.sap)}/${st.maxSap})`,
                () => Math.round(st.sap),
                (v) => { st.sap = Math.max(0, Math.min(st.maxSap, v)); EventBus.emit('player-stats-updated', st); },
                0, st.maxSap, 1);
            y += 40;
        }

        // Gold
        this._content.add(this._mkText(20, y, 'Gold:', '#bcd8ff'));
        [10, 100, 1000].forEach((amt, i) => {
            this._mkButton(80 + i * 64, y - 4, 60, 22, `+${amt}`, () => {
                st.gold = (st.gold || 0) + amt;
                EventBus.emit('player-stats-updated', st);
            });
        });
        y += 30;

        // XP / Level
        this._content.add(this._mkText(20, y, 'XP:', '#bcd8ff'));
        [100, 1000, 5000].forEach((amt, i) => {
            this._mkButton(80 + i * 64, y - 4, 60, 22, `+${amt}`, () => {
                EventBus.emit('player:addExperience', { amount: amt, source: 'admin' });
            });
        });
        this._mkButton(272, y - 4, 80, 22, '+1 Level', () => {
            try { gs.progression?.levelUp?.(); } catch (_) {}
        });
        y += 36;

        // Attributes
        this._content.add(this._mkText(20, y, '— Attributes (Might / Agi / Res / Ins / Cha) —', '#ffaa44', 14)); y += 22;
        for (const a of ['might', 'agility', 'resilience', 'insight', 'charisma']) {
            this._mkSlider(20, y, 200, a, () => st[a] || 0,
                (v) => { st[a] = Math.max(0, Math.min(10, v)); EventBus.emit('player-stats-updated', st); },
                0, 10, 1);
            y += 36;
        }
    }

    // ─── Quests tab ───────────────────────────────────────────────

    _buildQuests() {
        const gs = this._gs(); const QS = gs?.questSystem;
        if (!QS) return this._content.add(this._mkText(20, 90, 'QuestSystem not ready'));

        let y = 90;
        const active = [...(QS.activeQuests || new Map()).keys()];
        const completed = [...(QS.completedQuests || new Set())];
        const all = [...(QS.questDefinitions || new Map()).values()];
        this._content.add(this._mkText(20, y, `— QUESTS —  active:${active.length}  completed:${completed.length}  total:${all.length}`, '#ffaa44', 14));
        y += 26;

        // Filter to main + companion quests for the panel — full list would
        // overflow at 62.
        const shown = all.filter(q => q.isMainQuest || /^companion_|^quest_companion_/.test(q.id))
            .slice(0, 16);

        for (const q of shown) {
            const status = QS.completedQuests?.has(q.id) ? '✓' : (QS.activeQuests?.has(q.id) ? '●' : '○');
            const color = status === '✓' ? '#aaf0c0' : status === '●' ? '#ffd66a' : '#9aa0b8';
            this._content.add(this._mkText(20, y, `${status}  ${q.id}`, color, 12));

            this._mkButton(280, y - 2, 50, 18, 'Start', () => {
                if (!QS.completedQuests?.has(q.id) && !QS.activeQuests?.has(q.id)) QS.startQuest(q.id);
            });
            this._mkButton(336, y - 2, 70, 18, 'Complete', () => {
                if (!QS.activeQuests?.has(q.id)) QS.startQuest(q.id);
                const inst = QS.activeQuests.get(q.id);
                if (inst) for (const o of inst.definition.objectives) QS.completeObjective(q.id, o.id);
            });
            y += 22;
        }

        this._content.add(this._mkText(20, y + 8, `(showing ${shown.length} of ${all.length} — main + companion quests)`, '#7a7d8a', 11));
    }

    // ─── Inventory tab ────────────────────────────────────────────

    _buildInventory() {
        const gs = this._gs(); const inv = this._ui()?.inventoryPanel;
        let y = 90;
        this._content.add(this._mkText(20, y, '— INVENTORY —  add items by id', '#ffaa44', 14)); y += 26;

        const items = (dataManager.cache?.itemsById ? [...dataManager.cache.itemsById.values()] : []);
        const featured = ['iron_sword', 'leather_armor', 'minor_health_potion', 'health_potion',
            'sap_crystal', 'iron_ore', 'leather_strip', 'healing_herb', 'antidote', 'speed_elixir'];

        this._content.add(this._mkText(20, y, 'Quick adds:', '#bcd8ff'));
        let bx = 110;
        featured.forEach((id, i) => {
            if (!items.find(it => it.id === id)) return;
            this._mkButton(bx + (i % 3) * 130, y - 4 + Math.floor(i / 3) * 26, 122, 20, `+ ${id}`, () => {
                EventBus.emit('inventory:addItem', { itemId: id, quantity: 1, itemData: dataManager.getItem(id) });
            });
        });
        y += 26 + Math.ceil(featured.length / 3) * 26;

        // Show current inventory snapshot.
        const cache = gs?._inventoryCache || {};
        const have = Object.entries(cache).filter(([, n]) => n > 0).slice(0, 12);
        this._content.add(this._mkText(20, y, `In bag: ${have.length ? have.map(([id, n]) => `${id} ×${n}`).join(', ') : '(empty)'}`, '#9aa0b8', 11));
    }

    // ─── World tab ────────────────────────────────────────────────

    _buildWorld() {
        const gs = this._gs(); if (!gs) return this._content.add(this._mkText(20, 90, 'GameScene not ready'));
        let y = 90;
        this._content.add(this._mkText(20, y, `— WORLD —  current zone: ${gs.currentZone}`, '#ffaa44', 14)); y += 26;

        const zones = gs.zones || [];
        // Show only a column of clickable zones; ~15 fit.
        const shown = zones.slice(0, 30);
        shown.forEach((z, i) => {
            const col = Math.floor(i / 15);
            const row = i % 15;
            const x = 20 + col * 260;
            const cy = y + row * 22;
            const isCurrent = z.id === gs.currentZone;
            this._content.add(this._mkText(x, cy, (isCurrent ? '★ ' : '  ') + z.id,
                isCurrent ? '#ffd66a' : '#bcd8ff', 12));
            this._mkButton(x + 200, cy - 2, 50, 18, 'Go', () => {
                EventBus.emit('worldmap:travelTo', { locationId: z.id });
            });
        });

        if (zones.length > 30) {
            this._content.add(this._mkText(20, y + 16 * 22, `(showing first 30 of ${zones.length} zones)`, '#7a7d8a', 11));
        }
    }

    // ─── Data tab ─────────────────────────────────────────────────

    _buildData() {
        let y = 90;
        this._content.add(this._mkText(20, y, '— DATA INTEGRITY —', '#ffaa44', 14)); y += 26;

        // Run the same checks the DataManager + a few extras the validator misses.
        const issues = this._scanBrokenRefs();
        if (issues.length === 0) {
            this._content.add(this._mkText(20, y, '✓ No broken references detected (within audited categories).', '#aaf0c0'));
        } else {
            this._content.add(this._mkText(20, y, `${issues.length} broken refs:`, '#f0a0a0'));
            y += 20;
            issues.slice(0, 20).forEach(line => {
                this._content.add(this._mkText(20, y, '  • ' + line, '#f0a0a0', 11));
                y += 16;
            });
            if (issues.length > 20) {
                this._content.add(this._mkText(20, y, `  …and ${issues.length - 20} more`, '#7a7d8a', 11));
                y += 16;
            }
        }
        y += 12;

        this._mkButton(20, y, 140, 24, 'Dump save → console', () => {
            const data = {};
            EventBus.emit('save-collect', data);
            console.log('[Admin] save snapshot:', data);
        });
        this._mkButton(168, y, 140, 24, 'Fire game:reset', () => {
            EventBus.emit('game:reset');
            console.log('[Admin] game:reset emitted');
        });
        this._mkButton(316, y, 140, 24, 'Reload data', () => {
            dataManager.loadAllData?.().then(() => {
                console.log('[Admin] data reloaded');
                EventBus.emit('data-reloaded', { key: 'all', data: {} });
            });
        });
    }

    _scanBrokenRefs() {
        const out = [];
        try {
            const quests = dataManager.cache?.quests || [];
            const locIds = new Set((dataManager.cache?.locations || []).map(x => x.id));
            const itemIds = new Set((dataManager.cache?.items || []).map(x => x.id));
            const dlgIds = new Set((dataManager.cache?.dialogues?.dialogues || []).map(x => x.id));
            const questIds = new Set(quests.map(q => q.id));

            for (const q of quests) {
                for (const o of (q.objectives || [])) {
                    if (o.type === 'travel' && o.target && !locIds.has(o.target)) out.push(`quest:${q.id} travel→${o.target}`);
                    if (o.type === 'collect' && o.target && !itemIds.has(o.target)) out.push(`quest:${q.id} collect→${o.target}`);
                }
                for (const k of ['dialogueId', 'dialogueOnAccept', 'dialogueOnComplete']) {
                    const v = q[k]; if (v && !dlgIds.has(v)) out.push(`quest:${q.id}.${k}→${v}`);
                }
            }
            // Companion → quest
            const comps = dataManager.cache?.companions || [];
            for (const c of comps) {
                for (const k of ['recruitQuest', 'personalQuest']) {
                    const v = c[k]; if (v && !questIds.has(v)) out.push(`companion:${c.id}.${k}→${v}`);
                }
            }
        } catch (e) {
            out.push('scan error: ' + e.message);
        }
        return out;
    }
}
