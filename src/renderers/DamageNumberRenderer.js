import EventBus from '../core/EventBus.js';

/**
 * DamageNumberRenderer — Floating combat text that pops up
 * above entities when damage is dealt or healing occurs.
 *
 * Features:
 *  - Numbers float upward and fade out
 *  - Color-coded by element (fire=orange, ice=blue, etc.)
 *  - Larger font for critical hits with "CRIT!" prefix
 *  - Healing numbers shown in green with "+" prefix
 *  - Object pooling to avoid GC pressure
 *  - Slight random X scatter to prevent overlap
 *
 * Listens to EventBus events:
 *  - 'damage-number'  → { x, y, value, element, isCrit }
 *  - 'heal-number'    → { x, y, value }
 *  - 'xp-number'      → { x, y, value }
 */
export default class DamageNumberRenderer {
    constructor(scene) {
        this.scene = scene;

        // Object pool
        this.pool = [];
        this.active = [];
        this.poolSize = 30;

        // Pre-create pool
        for (let i = 0; i < this.poolSize; i++) {
            const text = scene.add.text(0, 0, '', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold'
            }).setDepth(15000).setVisible(false).setOrigin(0.5);

            this.pool.push(text);
        }

        // EventBus listeners
        this._unsubs = [
            EventBus.on('damage-number', (data) => this._showDamage(data)),
            EventBus.on('heal-number', (data) => this._showHeal(data)),
            EventBus.on('xp-number', (data) => this._showXP(data)),
            EventBus.on('spell-impact', (data) => {
                if (data.damage && data.target) {
                    this._showDamage({
                        x: data.target.x,
                        y: data.target.y - 20,
                        value: data.damage,
                        element: data.spell?.element,
                        isCrit: data.isCrit
                    });
                }
            })
        ];
    }

    // ----------------------------------------------------------------
    // Show numbers
    // ----------------------------------------------------------------

    _showDamage(data) {
        const { x, y, value, element, isCrit } = data;

        const color = this._elementColor(element);
        const prefix = isCrit ? 'CRIT! ' : '';
        const size = isCrit ? '18px' : '14px';

        this._spawn(
            x + Phaser.Math.Between(-15, 15),
            y,
            `${prefix}${value}`,
            color,
            size
        );
    }

    _showHeal(data) {
        const { x, y, value } = data;
        this._spawn(
            x + Phaser.Math.Between(-10, 10),
            y,
            `+${value}`,
            '#44ff66',
            '13px'
        );
    }

    _showXP(data) {
        const { x, y, value } = data;
        this._spawn(
            x + Phaser.Math.Between(-10, 10),
            y - 10,
            `+${value} XP`,
            '#ffdd44',
            '11px'
        );
    }

    // ----------------------------------------------------------------
    // Pooling and animation
    // ----------------------------------------------------------------

    _spawn(x, y, text, color, fontSize) {
        // Get from pool
        let obj = this.pool.pop();
        if (!obj) {
            // Pool exhausted — recycle oldest active
            obj = this.active.shift();
        }
        if (!obj) return;

        obj.setText(text);
        obj.setPosition(x, y);
        obj.setColor(color);
        obj.setFontSize(fontSize);
        obj.setAlpha(1);
        obj.setScale(1);
        obj.setVisible(true);

        const entry = {
            text: obj,
            startY: y,
            lifetime: 0,
            maxLifetime: 1.0 // seconds
        };

        this.active.push(entry);
    }

    // ----------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------

    update(delta) {
        const dt = delta / 1000;
        const toRemove = [];

        this.active.forEach((entry, i) => {
            entry.lifetime += dt;
            const t = entry.lifetime / entry.maxLifetime;

            if (t >= 1) {
                toRemove.push(i);
                return;
            }

            // Float upward
            entry.text.y = entry.startY - 40 * t;

            // Fade out
            entry.text.setAlpha(1 - t * t);

            // Scale pop on spawn
            if (t < 0.1) {
                entry.text.setScale(1 + (1 - t / 0.1) * 0.3);
            } else {
                entry.text.setScale(1);
            }
        });

        // Return expired entries to pool
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const idx = toRemove[i];
            const entry = this.active[idx];
            entry.text.setVisible(false);
            this.pool.push(entry.text);
            this.active.splice(idx, 1);
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _elementColor(element) {
        const map = {
            arcane: '#4488ff',
            fire: '#ff6622',
            nature: '#44ff66',
            shadow: '#aa44ff',
            light: '#ffdd44',
            ice: '#88ddff'
        };
        return map[element] || '#ffffff';
    }

    shutdown() {
        this._unsubs.forEach((fn) => fn());
        this.active.forEach((e) => e.text.destroy());
        this.pool.forEach((t) => t.destroy());
        this.active = [];
        this.pool = [];
    }
}
