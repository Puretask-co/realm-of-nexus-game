import Phaser from 'phaser';
import EventBus from '../core/EventBus.js';

/**
 * SpellVFXIntegration — Renders spell visuals from EventBus `spell:*` events.
 *
 * Each vfxType is rendered distinctly:
 *   projectile  - Moving orb with trail from caster to target
 *   burst       - Instant explosion at target with screen flash
 *   beam        - Sustained line from caster to target
 *   nova        - Expanding AoE ring from caster
 *   channel     - Pulsing charge circle + sustained beam
 *   shield      - Orbiting particle ring around player
 *   summon      - Ground sigil that flashes and fades
 *
 * Effects scale with spell tier:
 *   tier 1 - base effect
 *   tier 2 - 1.5x particles, 1.2x radius
 *   tier 3 - 2x particles, 1.5x radius, camera shake added
 *
 * Usage:
 *   const vfx = new SpellVFXIntegration();
 *   vfx.bind(scene);                       // call from GameScene.create
 *   vfx.onSpellCast(spell, px, py, tx, ty);
 */
export default class SpellVFXIntegration {
    constructor() {
        this.scene = null;

        // Legacy sub-system references (kept for backward-compat with existing bind calls)
        this.particleSystem = null;
        this.lightingSystem = null;
        this.cameraSystem = null;

        this._unsubs = [
            EventBus.on('spell-cast', (data) => this._onSpellCastEvent(data))
        ];
    }

    // ----------------------------------------------------------------
    // Bind
    // ----------------------------------------------------------------

    /**
     * Connect to the live Phaser scene.
     * Accepts either (scene) or legacy (particleSystem, lightingSystem, cameraSystem).
     */
    bind(sceneOrParticles, lightingSystem, cameraSystem) {
        if (sceneOrParticles && sceneOrParticles.add && sceneOrParticles.cameras) {
            // New style: first arg is a Phaser scene
            this.scene = sceneOrParticles;
        } else {
            // Legacy style: keep old sub-systems for fallback
            this.particleSystem = sceneOrParticles;
            this.lightingSystem = lightingSystem;
            this.cameraSystem = cameraSystem;
        }
    }

    // ----------------------------------------------------------------
    // Public API — call directly or let the EventBus listener call it
    // ----------------------------------------------------------------

    /**
     * Main entry point.
     * @param {object} spell   - spell data object with vfxType, vfxColor, tier, aoeRadius
     * @param {number} casterX
     * @param {number} casterY
     * @param {number} targetX
     * @param {number} targetY
     */
    onSpellCast(spell, casterX, casterY, targetX, targetY) {
        if (!this.scene || !spell) return;

        const color = this._parseColor(spell.vfxColor || '#44aaff');
        const tier = spell.tier || 1;
        const type = spell.vfxType || 'burst';

        switch (type) {
            case 'projectile': this._vfxProjectile(spell, color, tier, casterX, casterY, targetX, targetY); break;
            case 'burst':      this._vfxBurst(spell, color, tier, targetX, targetY); break;
            case 'beam':       this._vfxBeam(spell, color, tier, casterX, casterY, targetX, targetY); break;
            case 'nova':       this._vfxNova(spell, color, tier, casterX, casterY); break;
            case 'channel':    this._vfxChannel(spell, color, tier, casterX, casterY, targetX, targetY); break;
            case 'shield':     this._vfxShield(spell, color, tier, casterX, casterY); break;
            case 'summon':     this._vfxSummon(spell, color, tier, targetX, targetY); break;
            default:           this._vfxBurst(spell, color, tier, targetX, targetY); break;
        }
    }

    // ----------------------------------------------------------------
    // EventBus listener (legacy 'spell-cast' event)
    // ----------------------------------------------------------------

    _onSpellCastEvent(data) {
        if (!data) return;
        const { spell, caster, target } = data;
        const cx = caster?.x ?? 0;
        const cy = caster?.y ?? 0;
        const tx = target?.x ?? cx;
        const ty = target?.y ?? cy;
        this.onSpellCast(spell, cx, cy, tx, ty);
    }

    // ----------------------------------------------------------------
    // VFX: Projectile
    // ----------------------------------------------------------------

    _vfxProjectile(spell, color, tier, cx, cy, tx, ty) {
        const scene = this.scene;
        const { r, g, b, hex } = color;
        const travelMs = spell.element === 'physical' ? 300 : 500;

        // Orb graphics
        const orb = scene.add.graphics();
        orb.setDepth(4500);
        orb.fillStyle(hex, 1);
        orb.fillCircle(0, 0, 8);
        orb.x = cx;
        orb.y = cy;

        // Trail timer: every 50ms drop a fading ghost
        const trailTimer = scene.time.addEvent({
            delay: 50,
            loop: true,
            callback: () => {
                if (!orb.active) return;
                const ghost = scene.add.graphics();
                ghost.setDepth(4499);
                ghost.fillStyle(hex, 0.6);
                ghost.fillCircle(0, 0, 4);
                ghost.x = orb.x;
                ghost.y = orb.y;
                scene.tweens.add({
                    targets: ghost,
                    alpha: 0,
                    duration: 250,
                    onComplete: () => ghost.destroy()
                });
            }
        });

        // Fly to target
        scene.tweens.add({
            targets: orb,
            x: tx,
            y: ty,
            duration: travelMs,
            ease: 'Linear',
            onComplete: () => {
                trailTimer.destroy();
                orb.destroy();

                // Burst particles at impact
                const count = this._scaledParticles(12, tier);
                this._emitParticles(tx, ty, count, hex, 80, 0.9);

                // Flash target area
                scene.cameras.main.flash(120, r, g, b);
            }
        });
    }

    // ----------------------------------------------------------------
    // VFX: Burst
    // ----------------------------------------------------------------

    _vfxBurst(spell, color, tier, tx, ty) {
        const scene = this.scene;
        const { r, g, b, hex } = color;
        const radius = this._scaledRadius(80, tier);

        // Screen flash
        scene.cameras.main.flash(120, r, g, b);

        // Radiate particles
        const count = this._scaledParticles(20, tier);
        this._emitParticles(tx, ty, count, hex, radius, 0.9);

        // Expanding ring
        const ring = scene.add.graphics();
        ring.setDepth(4500);
        ring.lineStyle(3, hex, 0.8);
        ring.strokeCircle(0, 0, 1);
        ring.x = tx;
        ring.y = ty;

        scene.tweens.add({
            targets: ring,
            scaleX: radius,
            scaleY: radius,
            alpha: 0,
            duration: 400,
            ease: 'Quad.Out',
            onComplete: () => ring.destroy()
        });

        if (tier >= 3) {
            scene.cameras.main.shake(200, 0.003);
        }
    }

    // ----------------------------------------------------------------
    // VFX: Beam
    // ----------------------------------------------------------------

    _vfxBeam(spell, color, tier, cx, cy, tx, ty) {
        const scene = this.scene;
        const { hex } = color;
        const count = this._scaledParticles(8, tier);

        const drawBeam = (offsetX, offsetY, width, alpha, depth) => {
            const g = scene.add.graphics();
            g.setDepth(depth);
            g.lineStyle(width, hex, alpha);
            g.lineBetween(cx + offsetX, cy + offsetY, tx + offsetX, ty + offsetY);
            scene.tweens.add({
                targets: g,
                alpha: 0,
                duration: 600,
                ease: 'Linear',
                onComplete: () => g.destroy()
            });
            return g;
        };

        // Core beam + side beams
        drawBeam(0, 0, 3, 0.9, 4500);
        drawBeam(-3, 0, 1, 0.5, 4499);
        drawBeam(3, 0, 1, 0.5, 4499);

        // Particles distributed along beam length
        const dx = tx - cx;
        const dy = ty - cy;
        for (let i = 0; i < count; i++) {
            const t = i / Math.max(count - 1, 1);
            const px = cx + dx * t;
            const py = cy + dy * t;
            this._emitParticles(px, py, 1, hex, 20, 0.7);
        }

        if (tier >= 3) {
            scene.cameras.main.shake(150, 0.002);
        }
    }

    // ----------------------------------------------------------------
    // VFX: Nova
    // ----------------------------------------------------------------

    _vfxNova(spell, color, tier, cx, cy) {
        const scene = this.scene;
        const { r, g, b, hex } = color;
        const baseRadius = spell.aoeRadius > 0 ? spell.aoeRadius : 200;
        const radius = this._scaledRadius(baseRadius, tier);

        // Camera shake (always for nova, stronger at tier 3)
        const shakeMag = tier >= 3 ? 0.007 : 0.004;
        scene.cameras.main.shake(200, shakeMag);

        // Expanding ring
        const ring = scene.add.graphics();
        ring.setDepth(4500);
        ring.lineStyle(4, hex, 0.9);
        ring.strokeCircle(0, 0, 1);
        ring.x = cx;
        ring.y = cy;

        scene.tweens.add({
            targets: ring,
            scaleX: radius,
            scaleY: radius,
            alpha: 0,
            duration: 600,
            ease: 'Quad.Out',
            onComplete: () => ring.destroy()
        });

        // Inner particles
        const count = this._scaledParticles(30, tier);
        this._emitParticles(cx, cy, count, hex, radius * 0.6, 0.9);
    }

    // ----------------------------------------------------------------
    // VFX: Channel
    // ----------------------------------------------------------------

    _vfxChannel(spell, color, tier, cx, cy, tx, ty) {
        const scene = this.scene;
        const { hex } = color;

        // Pulsing charge circle at caster
        const pulse = scene.add.graphics();
        pulse.setDepth(4500);
        pulse.lineStyle(2, hex, 0.7);
        pulse.strokeCircle(0, 0, 28);
        pulse.x = cx;
        pulse.y = cy;

        const pulseTween = scene.tweens.add({
            targets: pulse,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.4,
            duration: 400,
            ease: 'Sine.InOut',
            yoyo: true,
            repeat: -1
        });

        // Sustained pulsing beam to target
        const beam = scene.add.graphics();
        beam.setDepth(4499);
        beam.lineStyle(2, hex, 0.7);
        beam.lineBetween(cx, cy, tx, ty);
        beam.x = 0;
        beam.y = 0;

        const beamTween = scene.tweens.add({
            targets: beam,
            alpha: 0.2,
            duration: 300,
            ease: 'Sine.InOut',
            yoyo: true,
            repeat: -1
        });

        // Channel lasts for spell.duration (seconds) or 2s fallback
        const channelMs = (spell.duration || 2) * 1000;
        scene.time.delayedCall(channelMs, () => {
            pulseTween.stop();
            beamTween.stop();
            scene.tweens.add({
                targets: [pulse, beam],
                alpha: 0,
                duration: 300,
                onComplete: () => { pulse.destroy(); beam.destroy(); }
            });
        });

        if (tier >= 3) {
            scene.cameras.main.shake(150, 0.002);
        }
    }

    // ----------------------------------------------------------------
    // VFX: Shield
    // ----------------------------------------------------------------

    _vfxShield(spell, color, tier, cx, cy) {
        const scene = this.scene;
        const { hex } = color;
        const ringRadius = this._scaledRadius(36, tier);

        // Shield ring
        const ring = scene.add.graphics();
        ring.setDepth(4500);
        ring.lineStyle(2, hex, 0.6);
        ring.strokeCircle(0, 0, ringRadius);
        ring.x = cx;
        ring.y = cy;

        // Pulsing alpha
        const pulseTween = scene.tweens.add({
            targets: ring,
            alpha: 0.9,
            duration: 500,
            ease: 'Sine.InOut',
            yoyo: true,
            repeat: -1
        });

        // Orbiting particles
        const orbitCount = this._scaledParticles(8, tier);
        const orbitDots = [];
        for (let i = 0; i < orbitCount; i++) {
            const dot = scene.add.graphics();
            dot.setDepth(4501);
            dot.fillStyle(hex, 0.8);
            dot.fillCircle(0, 0, 3);
            orbitDots.push({ dot, offset: (i / orbitCount) * Math.PI * 2 });
        }

        // Orbit update via a time event
        let elapsed = 0;
        const orbitTimer = scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                elapsed += 0.016;
                for (const { dot, offset } of orbitDots) {
                    dot.x = cx + Math.cos(elapsed * 1.5 + offset) * ringRadius;
                    dot.y = cy + Math.sin(elapsed * 1.5 + offset) * ringRadius;
                }
            }
        });

        // Shield duration
        const durationMs = (spell.duration || 5) * 1000;
        scene.time.delayedCall(durationMs, () => {
            pulseTween.stop();
            orbitTimer.destroy();
            scene.tweens.add({
                targets: [ring, ...orbitDots.map(o => o.dot)],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    ring.destroy();
                    orbitDots.forEach(o => o.dot.destroy());
                }
            });
        });
    }

    // ----------------------------------------------------------------
    // VFX: Summon
    // ----------------------------------------------------------------

    _vfxSummon(spell, color, tier, tx, ty) {
        const scene = this.scene;
        const { r, g, b, hex } = color;
        const baseRadius = this._scaledRadius(40, tier);

        // Sigil: 3 concentric circles + radial lines
        const sigil = scene.add.graphics();
        sigil.setDepth(4500);
        sigil.alpha = 0;
        sigil.x = tx;
        sigil.y = ty;

        const drawSigil = (g, baseR, col) => {
            g.clear();
            g.lineStyle(2, col, 0.9);
            g.strokeCircle(0, 0, baseR);
            g.strokeCircle(0, 0, baseR * 0.65);
            g.strokeCircle(0, 0, baseR * 0.3);
            // 8 radial lines
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                g.lineBetween(
                    Math.cos(angle) * baseR * 0.3,
                    Math.sin(angle) * baseR * 0.3,
                    Math.cos(angle) * baseR,
                    Math.sin(angle) * baseR
                );
            }
        };

        drawSigil(sigil, baseRadius, hex);

        // Fade in sigil
        scene.tweens.add({
            targets: sigil,
            alpha: 1,
            duration: 800,
            ease: 'Quad.In',
            onComplete: () => {
                // Flash bright white
                drawSigil(sigil, baseRadius, 0xffffff);
                scene.time.delayedCall(80, () => {
                    drawSigil(sigil, baseRadius, hex);
                    // Fade out
                    scene.tweens.add({
                        targets: sigil,
                        alpha: 0,
                        duration: 400,
                        ease: 'Quad.Out',
                        onComplete: () => sigil.destroy()
                    });
                    // Camera flash
                    scene.cameras.main.flash(200, r, g, b);
                });
            }
        });

        if (tier >= 3) {
            scene.cameras.main.shake(200, 0.004);
        }
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /**
     * Parse a CSS hex color string into { r, g, b, hex }.
     * Falls back to blue if the string is malformed.
     */
    _parseColor(hexStr) {
        try {
            const c = Phaser.Display.Color.HexStringToColor(hexStr);
            return { r: c.r, g: c.g, b: c.b, hex: c.color };
        } catch (_) {
            return { r: 68, g: 170, b: 255, hex: 0x44aaff };
        }
    }

    /**
     * Scale particle count by tier.
     */
    _scaledParticles(base, tier) {
        if (tier >= 3) return Math.round(base * 2);
        if (tier >= 2) return Math.round(base * 1.5);
        return base;
    }

    /**
     * Scale a radius value by tier.
     */
    _scaledRadius(base, tier) {
        if (tier >= 3) return base * 1.5;
        if (tier >= 2) return base * 1.2;
        return base;
    }

    /**
     * Emit `count` small particle circles radiating outward from (ox, oy).
     * Each particle is a tiny graphics object that tweens outward and fades.
     */
    _emitParticles(ox, oy, count, hex, spread, startAlpha) {
        const scene = this.scene;
        if (!scene) return;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
            const dist = spread * (0.5 + Math.random() * 0.5);
            const speed = 200 + Math.random() * 200;

            const p = scene.add.graphics();
            p.setDepth(4500);
            p.fillStyle(hex, startAlpha);
            p.fillCircle(0, 0, 3 + Math.random() * 2);
            p.x = ox;
            p.y = oy;

            scene.tweens.add({
                targets: p,
                x: ox + Math.cos(angle) * dist,
                y: oy + Math.sin(angle) * dist,
                alpha: 0,
                duration: speed,
                ease: 'Quad.Out',
                onComplete: () => p.destroy()
            });
        }
    }

    // ----------------------------------------------------------------
    // Shutdown
    // ----------------------------------------------------------------

    shutdown() {
        this._unsubs.forEach((fn) => typeof fn === 'function' && fn());
        this._unsubs = [];
        this.scene = null;
    }
}
