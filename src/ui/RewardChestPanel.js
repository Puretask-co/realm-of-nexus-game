import Phaser from 'phaser';
import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * RewardChestPanel — visible reward popup on quest completion.
 *
 * Listens to `quest:completed` with payload:
 *   { questId, name, rewards: { experience, gold, items:[{id,quantity}],
 *     reputation:{factionId:amount}, unlocks:[], spells:[] } }
 *
 * Centred modal:
 *   - Quest title + "Rewards" subtitle
 *   - Animated chest glyph that scales/glows
 *   - Itemised rewards (XP, gold, items with rarity colours, reputation, spells)
 *   - Dismiss with click / ESC / auto after 5s
 *
 * Non-blocking: depth above HUD, scroll-locked, doesn't pause the world.
 */
export class RewardChestPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.container = null;
        this._auto = null;
        this._dismiss = null;
        this._queue = [];
        this._build();
        this._wireEvents();
    }

    _build() {
        const W = this.scene.scale.width;
        const H = this.scene.scale.height;
        this.container = this.scene.add.container(W / 2, H / 2)
            .setDepth(16500).setScrollFactor(0).setVisible(false);
    }

    _wireEvents() {
        this._unsubs = [
            EventBus.on('quest:completed', (data) => this._enqueue(data)),
        ];
        // ESC / click to dismiss.
        this._onKey = (e) => { if (this.visible && e.code === 'Escape') this._dismissNow(); };
        this.scene.input.keyboard?.on('keydown', this._onKey);
    }

    _enqueue(data) {
        // Skip empty rewards (so we don't show a chest for nothing).
        const r = data?.rewards || {};
        const hasAny =
            (r.experience ?? r.xp ?? 0) > 0 || (r.gold ?? 0) > 0 ||
            (r.items?.length ?? 0) > 0 || (r.spells?.length ?? 0) > 0 ||
            (Object.keys(r.reputation || {}).length) > 0;
        if (!hasAny) return;
        this._queue.push(data);
        if (!this.visible) this._showNext();
    }

    _showNext() {
        const data = this._queue.shift();
        if (!data) return;
        this._render(data);
    }

    _render(data) {
        const W = 460, H = 320;
        const cx = 0, cy = 0;
        this.container.removeAll(true);

        // Backing card + glow.
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0c0c1c, 0.96); bg.fillRoundedRect(-W / 2, -H / 2, W, H, 12);
        bg.lineStyle(2, 0xffd66a, 0.85); bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 12);
        this.container.add(bg);

        const glow = this.scene.add.graphics();
        glow.fillStyle(0xffe2a0, 0.18); glow.fillCircle(0, -H / 4, 110);
        this.container.add(glow);

        // Title bar.
        this.container.add(this.scene.add.text(0, -H / 2 + 14, 'REWARDS', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#ffd66a',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5, 0));
        this.container.add(this.scene.add.text(0, -H / 2 + 36, data.name || 'Quest Complete', {
            fontFamily: 'Open Sans', fontSize: '20px', color: '#ffffff',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5, 0));

        // Animated chest glyph (large emoji works as the icon).
        const chest = this.scene.add.text(0, -H / 4 + 4, '🎁', {
            fontFamily: 'Open Sans', fontSize: '64px',
        }).setOrigin(0.5);
        this.container.add(chest);
        this.scene.tweens.add({
            targets: chest, scale: { from: 0.6, to: 1.1 }, duration: 320, ease: 'Back.easeOut',
            onComplete: () => this.scene.tweens.add({
                targets: chest, scale: 1.0, duration: 220, ease: 'Sine.easeOut'
            })
        });
        this.scene.tweens.add({
            targets: glow, alpha: { from: 0.05, to: 0.30 }, scale: { from: 0.8, to: 1.15 },
            duration: 700, yoyo: true, repeat: 1
        });

        // Reward lines.
        const lines = this._buildLines(data.rewards || {});
        const startY = 28;
        lines.forEach((line, i) => {
            const t = this.scene.add.text(0, startY + i * 22, line.text, {
                fontFamily: 'Open Sans', fontSize: '15px', color: line.color || '#e8e8f0',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setAlpha(0);
            this.container.add(t);
            this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 4, delay: 200 + i * 90, duration: 250, ease: 'Sine.easeOut' });
        });

        // Dismiss hint.
        this.container.add(this.scene.add.text(0, H / 2 - 18, '[click or ESC to dismiss]', {
            fontFamily: 'Open Sans', fontSize: '11px', color: '#9aa0b8',
        }).setOrigin(0.5));

        // Click to dismiss anywhere on the panel.
        bg.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H), Phaser.Geom.Rectangle.Contains);
        bg.on('pointerdown', () => this._dismissNow());

        this.container.setVisible(true);
        this.visible = true;
        this.container.setScale(0.85);
        this.scene.tweens.add({ targets: this.container, scale: 1, duration: 220, ease: 'Back.easeOut' });

        // Auto-dismiss after 5s.
        if (this._auto) this._auto.remove();
        this._auto = this.scene.time?.delayedCall?.(5000, () => this._dismissNow());
    }

    _buildLines(r) {
        const lines = [];
        const xp = r.experience ?? r.xp ?? 0;
        if (xp) lines.push({ text: `✦  +${xp} Experience`, color: '#a0d8ff' });
        if (r.gold) lines.push({ text: `◈  +${r.gold} Gold`, color: '#ffd866' });

        // Items, with name + quantity + rarity colour.
        for (const it of (r.items || [])) {
            const def = dataManager.getItem?.(it.id);
            const name = def?.name || it.id;
            const qty = it.quantity || 1;
            const rarity = (def?.rarity || 'common').toLowerCase();
            const color = RewardChestPanel.RARITY_COLOURS[rarity] || '#dcdcec';
            lines.push({ text: `▣  ${name}${qty > 1 ? ` ×${qty}` : ''}`, color });
        }

        for (const [fac, amt] of Object.entries(r.reputation || {})) {
            const sign = amt > 0 ? '+' : '';
            lines.push({ text: `❖  ${sign}${amt} ${fac} reputation`, color: amt >= 0 ? '#aaf0c0' : '#f0a0a0' });
        }
        for (const sp of (r.spells || [])) {
            const def = dataManager.getSpell?.(sp);
            lines.push({ text: `✺  Spell unlocked: ${def?.name || sp}`, color: '#d9b0ff' });
        }
        for (const u of (r.unlocks || [])) {
            lines.push({ text: `✧  Unlocked: ${u}`, color: '#e8e0a0' });
        }
        return lines.slice(0, 8); // cap so the card never overflows
    }

    _dismissNow() {
        if (!this.visible) return;
        if (this._auto) { this._auto.remove(); this._auto = null; }
        this.scene.tweens.add({
            targets: this.container, alpha: 0, duration: 180, ease: 'Sine.easeIn',
            onComplete: () => {
                this.container.setVisible(false);
                this.container.setAlpha(1);
                this.visible = false;
                // Show the next one if any queued up while open.
                if (this._queue.length) this._showNext();
            }
        });
    }

    destroy() {
        if (this._unsubs) this._unsubs.forEach((fn) => { try { fn(); } catch (_) {} });
        this._unsubs = [];
        if (this._onKey) this.scene.input.keyboard?.off('keydown', this._onKey);
        if (this._auto) { this._auto.remove(); this._auto = null; }
        this.container?.destroy();
    }
}

RewardChestPanel.RARITY_COLOURS = {
    common:    '#cfcfdc',
    uncommon:  '#7be29a',
    rare:      '#69bcff',
    epic:      '#c98cff',
    legendary: '#ffaf4a',
    mythic:    '#ff66cc',
};

export default RewardChestPanel;
