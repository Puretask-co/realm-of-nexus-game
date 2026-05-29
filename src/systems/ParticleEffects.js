import EventBus from '../core/EventBus.js';

/**
 * ParticleEffects — Plays Phaser built-in particle bursts using Kenney CC0 textures.
 *
 * Listens to EventBus events and fires particle effects at the right world position.
 * Uses Phaser 3.60+ particle API (ParticleEmitter, not deprecated Particle Manager).
 *
 * Spell element → particle texture mapping:
 *   fire, arcane, shadow, nature/verdant, radiant/light, spirit, void,
 *   physical, water, ice, thunder
 */

// ─── Per-element particle configs ─────────────────────────────────────────
// Primary textures are the new imp_vfx_* imports; Kenney keys remain as
// fallback so older builds still render something if the imports are missing.
const ELEMENT_FX = {
    fire:     { textures: ['imp_vfx_fire1','imp_vfx_fire2','imp_vfx_fire3','particle_fire_01'],                tint: 0xff4400, speed: 120, scale: { start: 0.35, end: 0.05 }, lifespan: 600 },
    arcane:   { textures: ['imp_vfx_holy1','imp_vfx_holy2','imp_vfx_light_balls_tree1','particle_magic_01'],   tint: 0xaa44ff, speed: 100, scale: { start: 0.30, end: 0.05 }, lifespan: 500 },
    shadow:   { textures: ['imp_vfx_darkness1','imp_vfx_statedark','imp_vfx_darkness3','particle_smoke_01'],   tint: 0x330066, speed: 80,  scale: { start: 0.35, end: 0.08 }, lifespan: 700 },
    nature:   { textures: ['imp_vfx_earth1','imp_vfx_earth3','imp_vfx_light_balls_tree2','particle_circle_01'],tint: 0x44dd44, speed: 90,  scale: { start: 0.30, end: 0.05 }, lifespan: 500 },
    verdant:  { textures: ['imp_vfx_earth2','imp_vfx_earth5','imp_vfx_light_balls_tree2','particle_circle_02'],tint: 0x33ff77, speed: 90,  scale: { start: 0.30, end: 0.05 }, lifespan: 500 },
    radiant:  { textures: ['imp_vfx_holy3','imp_vfx_holy4','imp_vfx_holy5','particle_star_01'],                tint: 0xffffaa, speed: 110, scale: { start: 0.35, end: 0.05 }, lifespan: 500 },
    light:    { textures: ['imp_vfx_light_balls_tree1','imp_vfx_light_balls_tree3','imp_vfx_hitphoton','particle_light_01'], tint: 0xffffff, speed: 110, scale: { start: 0.35, end: 0.05 }, lifespan: 500 },
    spirit:   { textures: ['imp_vfx_howl','imp_vfx_sonic','imp_vfx_stateup1','particle_twirl_01'],             tint: 0x88aaff, speed: 70,  scale: { start: 0.30, end: 0.05 }, lifespan: 600 },
    void:     { textures: ['imp_vfx_statedeath','imp_vfx_statechaos','imp_vfx_darkness5','particle_symbol_01'],tint: 0x660099, speed: 80,  scale: { start: 0.35, end: 0.08 }, lifespan: 700 },
    physical: { textures: ['imp_vfx_slashspecial1','imp_vfx_slashspecial2','imp_vfx_slashspecial3','particle_slash_01'], tint: 0xffddaa, speed: 150, scale: { start: 0.35, end: 0.05 }, lifespan: 350 },
    water:    { textures: ['imp_vfx_ice2','imp_vfx_ice3','imp_vfx_ice4','particle_circle_03'],                 tint: 0x4488ff, speed: 100, scale: { start: 0.30, end: 0.05 }, lifespan: 500 },
    ice:      { textures: ['imp_vfx_ice5','imp_vfx_ice4','imp_vfx_ice2','particle_circle_04'],                 tint: 0xaaddff, speed: 90,  scale: { start: 0.30, end: 0.05 }, lifespan: 550 },
    thunder:  { textures: ['imp_vfx_thunder1','imp_vfx_thunder5','imp_vfx_slashthunder','particle_spark_07'],  tint: 0xffff00, speed: 180, scale: { start: 0.35, end: 0.05 }, lifespan: 400 },
    wind:     { textures: ['imp_vfx_sonic','imp_vfx_song','imp_vfx_special1','particle_trace_05'],             tint: 0xaaffcc, speed: 100, scale: { start: 0.25, end: 0.02 }, lifespan: 500 },
    silver:   { textures: ['imp_vfx_special2','imp_vfx_holy2','imp_vfx_special1'],                            tint: 0xc8c8ee, speed: 100, scale: { start: 0.30, end: 0.05 }, lifespan: 550 },
};

// Hit / damage effect
const HIT_FX = {
    textures: ['imp_vfx_hitfire','imp_vfx_hitspecial1','imp_vfx_hitspecial2','imp_vfx_hit2','particle_spark_01'],
    tint: 0xffaa44, speed: 130, scale: { start: 0.30, end: 0 }, lifespan: 350
};

// Heal effect
const HEAL_FX = {
    textures: ['imp_vfx_cure1','imp_vfx_cure2','imp_vfx_cure3','imp_vfx_cure4','particle_star_03'],
    tint: 0x88ff88, speed: 60, scale: { start: 0.30, end: 0 }, lifespan: 700
};

// Level-up effect
const LEVELUP_FX = {
    textures: ['imp_vfx_special1','imp_vfx_special2','imp_vfx_special3','imp_vfx_holy5','particle_star_01'],
    tint: 0xffdd44, speed: 120, scale: { start: 0.40, end: 0 }, lifespan: 1000
};

export default class ParticleEffects {
    constructor(scene) {
        this.scene = scene;
        this._unsubs = [];
        this._fallbackCircle = null; // lazily created if textures missing
    }

    init() {
        const eb = EventBus;
        this._unsubs = [
            eb.on('spell-cast',      (d) => this._onSpellCast(d)),
            eb.on('enemy-damaged',   (d) => this._onHit(d?.x, d?.y, false)),
            eb.on('player-damaged',  (d) => this._onHit(d?.x, d?.y, true)),
            eb.on('player:healed',   (d) => this._onHeal(d?.x, d?.y)),
            eb.on('player:levelUp',  (d) => this._onLevelUp()),
            eb.on('progression:levelUp', (d) => this._onLevelUp()),
        ];
    }

    destroy() {
        this._unsubs.forEach(fn => typeof fn === 'function' && fn());
    }

    // ─── Event handlers ───────────────────────────────────────────────

    _onSpellCast(data) {
        // Try to get position from player sprite
        const scene = this.scene;
        const player = scene.player;
        const x = data?.x ?? player?.x ?? scene.cameras.main.centerX;
        const y = data?.y ?? player?.y ?? scene.cameras.main.centerY;
        const element = data?.spell?.element || data?.element || 'arcane';
        const baseCfg = ELEMENT_FX[element] || ELEMENT_FX.arcane;
        // Honor the spell's own vfx.color when present (per-spell tint),
        // otherwise use the element's default tint.
        const spellColor = this._parseColor(data?.spell?.vfx?.color);
        const cfg = spellColor != null ? { ...baseCfg, tint: spellColor } : baseCfg;
        this._burst(x, y, cfg, 18);
    }

    _parseColor(c) {
        if (c == null) return null;
        if (typeof c === 'number') return c;
        const n = parseInt(String(c).replace(/^0x/i, ''), 16);
        return Number.isFinite(n) ? n : null;
    }

    _onHit(x, y, isPlayer) {
        const scene = this.scene;
        const px = x ?? (isPlayer ? scene.player?.x : null) ?? scene.cameras.main.centerX;
        const py = y ?? (isPlayer ? scene.player?.y : null) ?? scene.cameras.main.centerY;
        this._burst(px, py, HIT_FX, 10);
    }

    _onHeal(x, y) {
        const scene = this.scene;
        const px = x ?? scene.player?.x ?? scene.cameras.main.centerX;
        const py = y ?? scene.player?.y ?? scene.cameras.main.centerY;
        this._burst(px, py, HEAL_FX, 12);
    }

    _onLevelUp() {
        const scene = this.scene;
        const x = scene.player?.x ?? scene.cameras.main.centerX;
        const y = scene.player?.y ?? scene.cameras.main.centerY;
        this._burst(x, y - 20, LEVELUP_FX, 30);
    }

    // ─── Core burst emitter ───────────────────────────────────────────

    _burst(x, y, cfg, count) {
        const scene = this.scene;

        // Find a texture that's actually loaded
        let textureKey = null;
        for (const key of cfg.textures) {
            if (scene.textures.exists(key)) { textureKey = key; break; }
        }

        if (!textureKey) {
            // Fallback: draw a quick graphics circle burst
            this._graphicsBurst(x, y, cfg.tint, count);
            return;
        }

        try {
            // Phaser 3.60+ particle API
            const emitter = scene.add.particles(x, y, textureKey, {
                speed:    { min: cfg.speed * 0.4, max: cfg.speed },
                scale:    cfg.scale,
                lifespan: cfg.lifespan,
                quantity: count,
                tint:     cfg.tint,
                alpha:    { start: 1, end: 0 },
                angle:    { min: 0, max: 360 },
                depth:    4500,
                emitting: false,
            });
            emitter.explode(count, x, y);

            // Auto-destroy after effect completes
            scene.time.delayedCall(cfg.lifespan + 200, () => {
                try { emitter.destroy(); } catch (_) {}
            });
        } catch (e) {
            // Phaser API version mismatch fallback
            this._graphicsBurst(x, y, cfg.tint, count);
        }
    }

    _graphicsBurst(x, y, color, count) {
        // Quick fallback: animated expanding circles
        const scene = this.scene;
        for (let i = 0; i < Math.min(count, 8); i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 40 + Math.random() * 60;
            const gfx = scene.add.graphics().setDepth(4500);
            gfx.fillStyle(color, 0.9);
            gfx.fillCircle(0, 0, 5 + Math.random() * 5);
            gfx.x = x;
            gfx.y = y;
            scene.tweens.add({
                targets: gfx,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 400 + Math.random() * 200,
                onComplete: () => { try { gfx.destroy(); } catch (_) {} }
            });
        }
    }
}
