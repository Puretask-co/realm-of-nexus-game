import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { TacticalCombatSystem } from '../systems/TacticalCombatSystem.js';

/**
 * Boss intent icons and color coding.
 * Attacks are red, defend is blue, special/phase are purple.
 */
const BOSS_INTENT_ICONS = {
    heavy_attack: '⚔',
    aoe_blast:    '💥',
    defend:       '🛡',
    summon:       '✦',
    phase_shift:  '⚡'
};

const BOSS_INTENT_COLORS = {
    heavy_attack: '#ff5555',
    aoe_blast:    '#ff7744',
    defend:       '#4499ff',
    summon:       '#cc66ff',
    phase_shift:  '#aa44ff'
};

/**
 * TacticalCombatPanel — UI for grid-based tactical combat.
 * Shows turn order, current AP, enemy intents (telegraphed), and actions: Attack, Defend, End Turn, Undo.
 * Also shows a Boss Intent Bar when a boss unit is present.
 */
export class TacticalCombatPanel {
    constructor(scene) {
        this.scene = scene;
        this.eventBus = EventBus.getInstance();
        this.tactical = TacticalCombatSystem.getInstance();
        this.container = null;
        this.visible = false;
        // Boss intent bar state
        this._bossIntentBar = null;
        this._bossIntentBg = null;
        this._bossIntentText = null;
        this._currentBossIntent = null;
    }

    create() {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;

        this.container = this.scene.add.container(0, 0).setDepth(15000).setScrollFactor(0);
        this.container.setVisible(false);

        const panelY = H - 140;
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0a0a1a, 0.92);
        bg.fillRoundedRect(20, panelY, W - 40, 120, 8);
        bg.lineStyle(2, 0x336677, 0.6);
        bg.strokeRoundedRect(20, panelY, W - 40, 120, 8);
        this.container.add(bg);

        this.turnText = this.scene.add.text(W / 2, panelY + 16, '—', {
            fontFamily: 'monospace', fontSize: '14px', color: '#aaccff'
        }).setOrigin(0.5, 0);
        this.container.add(this.turnText);

        this.apText = this.scene.add.text(W / 2, panelY + 34, 'AP: 0/0', {
            fontFamily: 'monospace', fontSize: '12px', color: '#88ff88'
        }).setOrigin(0.5, 0);
        this.container.add(this.apText);

        this.intentText = this.scene.add.text(40, panelY + 58, 'Enemy intent: —', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ffaa88',
            wordWrap: { width: W - 80 }
        });
        this.container.add(this.intentText);

        const btnY = panelY + 88;
        const btnW = 90;
        const btnH = 28;
        const gap = 10;
        let bx = (W - (btnW * 4 + gap * 3)) / 2 + btnW / 2 + gap / 2;

        this.attackBtn = this._makeButton(bx, btnY, btnW, btnH, 'Attack', 0xcc4444, () => {
            const r = this.tactical.attackNearestEnemy();
            if (!r.success) this._showFloat(r.reason || 'Cannot attack');
            else this._refresh();
        });
        this.container.add(this.attackBtn.container);
        bx += btnW + gap;

        this.defendBtn = this._makeButton(bx, btnY, btnW, btnH, 'Defend', 0x4488cc, () => {
            this.tactical.defendAction();
            this._refresh();
        });
        this.container.add(this.defendBtn.container);
        bx += btnW + gap;

        this.endTurnBtn = this._makeButton(bx, btnY, btnW, btnH, 'End Turn', 0x6666aa, () => {
            this.tactical.endTurn();
            this._refresh();
        });
        this.container.add(this.endTurnBtn.container);
        bx += btnW + gap;

        this.undoBtn = this._makeButton(bx, btnY, btnW, btnH, 'Undo', 0x888888, () => {
            this.tactical.undo();
            this._refresh();
        });
        this.container.add(this.undoBtn.container);

        // ---- Boss Intent Bar (hidden by default) ----
        this._buildBossIntentBar(W, panelY);

        this._unsubs = [
            this.eventBus.on('tactical:combatStarted', () => this.show()),
            this.eventBus.on('tactical:combatEnded', () => this.hide()),
            this.eventBus.on('tactical:turnStart', (data) => this._onTurnStart(data)),
            this.eventBus.on('tactical:turnEnd', () => this._refresh()),
            this.eventBus.on('tactical:enemyIntent', (data) => this._onEnemyIntent(data)),
            this.eventBus.on('boss:intentChanged', (data) => this._onBossIntentChanged(data))
        ];
    }

    // ----------------------------------------------------------------
    // Boss Intent Bar
    // ----------------------------------------------------------------

    _buildBossIntentBar(W, panelY) {
        const barH = 32;
        const barY = panelY - barH - 6; // sits just above the main panel

        this._bossIntentBar = this.scene.add.container(0, 0);

        // Background strip
        this._bossIntentBg = this.scene.add.graphics();
        this._bossIntentBg.fillStyle(0x1a0010, 0.92);
        this._bossIntentBg.fillRoundedRect(20, barY, W - 40, barH, 6);
        this._bossIntentBg.lineStyle(2, 0xaa2255, 0.8);
        this._bossIntentBg.strokeRoundedRect(20, barY, W - 40, barH, 6);
        this._bossIntentBar.add(this._bossIntentBg);

        // Boss intent label text (centered vertically in the strip)
        this._bossIntentText = this.scene.add.text(W / 2, barY + barH / 2, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ff5555'
        }).setOrigin(0.5, 0.5);
        this._bossIntentBar.add(this._bossIntentText);

        this._bossIntentBar.setVisible(false);
        this.container.add(this._bossIntentBar);
    }

    _onBossIntentChanged(data) {
        const { unitName, intent } = data;
        if (!intent) return;

        this._currentBossIntent = { unitName, intent };

        const icon = BOSS_INTENT_ICONS[intent.type] || '?';
        const color = BOSS_INTENT_COLORS[intent.type] || '#ffffff';
        const label = `${unitName}  |  NEXT: ${icon} ${intent.description}  |  AP: ${intent.apCost}`;

        this._bossIntentText.setText(label).setColor(color);
        this._bossIntentBar.setVisible(true);
        this._bossIntentBar.setAlpha(1);

        // Flash tween on update
        this.scene.tweens.killTweensOf(this._bossIntentBar);
        this.scene.tweens.add({
            targets: this._bossIntentBar,
            alpha: { from: 0.2, to: 1 },
            duration: 350,
            ease: 'Quad.easeOut'
        });
    }

    _checkBossPresence() {
        const state = this.tactical.getCombatState?.();
        if (!state) return;
        const boss = state.enemies?.find(e => e.alive && e.isBoss);
        if (!boss) {
            // No boss alive — hide the bar
            this._bossIntentBar?.setVisible(false);
            this._currentBossIntent = null;
        }
    }

    _makeButton(x, y, w, h, label, color, callback) {
        const container = this.scene.add.container(x, y);
        const bg = this.scene.add.graphics();
        bg.fillStyle(color, 0.8);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
        bg.lineStyle(1, 0xffffff, 0.3);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
        const text = this.scene.add.text(0, 0, label, {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
        }).setOrigin(0.5);
        const zone = this.scene.add.zone(-w / 2, -h / 2, w, h).setOrigin(0, 0).setInteractive();
        zone.on('pointerdown', callback);
        container.add([bg, text, zone]);
        const setEnabled = (v) => { zone.setInteractive(!!v); text.setAlpha(v ? 1 : 0.5); };
        return { container, setEnabled };
    }

    _onTurnStart(data) {
        const isPlayer = data.entity?.side === 'ally';
        this.turnText.setText(isPlayer ? `Your turn: ${data.entity?.name || 'Ally'}` : `Enemy turn: ${data.entity?.name || 'Enemy'}`);
        this.apText.setText(`AP: ${data.ap ?? 0}/${data.ap ?? 0}`);
        this.attackBtn?.setEnabled?.(isPlayer);
        this.defendBtn?.setEnabled?.(isPlayer);
        this.endTurnBtn?.setEnabled?.(isPlayer);
        this.undoBtn?.setEnabled?.(isPlayer);
        this._refresh();
    }

    _onEnemyIntent(data) {
        const intent = data.intent;
        if (!intent) return;
        const msg = intent.action === 'attack' ? ` → Attack ${intent.targetName || ''}` : intent.action === 'move' ? ' → Move' : ' → Defend';
        this.intentText.setText(`Enemy intent: ${data.entityId || 'Enemy'}${msg}`);
    }

    _refresh() {
        const state = this.tactical.getCombatState?.();
        if (!state) return;
        if (state.currentActor) {
            this.turnText.setText(`${state.currentActor.side === 'ally' ? 'Your turn' : 'Enemy'}: ${state.currentActor.name}`);
            this.apText.setText(`AP: ${state.currentActor.ap}/${state.currentActor.maxAP}`);
        }
        const intents = state.enemies?.filter(e => e.alive && e.intent).map(e => `${e.name}: ${e.intent?.action}${e.intent?.targetName ? ' ' + e.intent.targetName : ''}`) || [];
        this.intentText.setText(intents.length ? 'Intent: ' + intents.join(' | ') : '');
        this.undoBtn?.setEnabled?.(state.canUndo);
        // Keep boss bar in sync — hide if no boss alive
        this._checkBossPresence();
    }

    _showFloat(msg) {
        EventBus.emit('tactical:floatMessage', msg);
    }

    show() {
        this.visible = true;
        if (this.container) this.container.setVisible(true);
        this._refresh();
        // Boss bar starts hidden; it will appear when boss:intentChanged fires
        this._bossIntentBar?.setVisible(false);
        this._currentBossIntent = null;
    }

    hide() {
        this.visible = false;
        if (this.container) this.container.setVisible(false);
        this._bossIntentBar?.setVisible(false);
        this._currentBossIntent = null;
    }

    destroy() {
        this._unsubs?.forEach(fn => typeof fn === 'function' && fn());
        this.container?.destroy();
    }
}
