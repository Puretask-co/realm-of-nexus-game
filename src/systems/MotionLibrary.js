/**
 * MotionLibrary — procedural Phaser tween "motions" for single-image
 * painterly sprites. All animation in this game is tween-based (the art is
 * single PNGs, not sprite sheets), so this provides a named catalog of
 * reusable motions: idle ambience, locomotion, attacks, reactions, death/
 * spawn, emphasis, and environmental.
 *
 *   import MotionLibrary from '../systems/MotionLibrary.js';
 *   MotionLibrary.apply(scene, sprite, 'tree-sway');
 *   MotionLibrary.apply(scene, enemy, 'lunge-attack', { direction, onComplete });
 *   MotionLibrary.applyGroup(scene, group.getChildren(), 'idle-sway');
 *   MotionLibrary.stop(scene, sprite);
 *
 * Rules:
 *  - Two looping motions on one sprite are fine ONLY if they touch different
 *    properties (e.g. idle-bob[y] + idle-pulse-glow[alpha]). Never stack two
 *    that animate the same property — call stop() first.
 *  - One-shot motions restore the base transform on complete.
 *  - On physics sprites being moved by velocity, avoid x/y motions (they fight
 *    the body) — prefer scale/angle/alpha motions.
 */
export default class MotionLibrary {
  static _baseOf(t) {
    if (t._mlBase) return t._mlBase;
    t._mlBase = { x: t.x, y: t.y, sx: t.scaleX, sy: t.scaleY, ang: t.angle, a: t.alpha };
    return t._mlBase;
  }

  static stop(scene, t) {
    if (!t) return;
    scene.tweens.killTweensOf(t);
    const b = t._mlBase;
    if (b) { t.x = b.x; t.y = b.y; t.setScale(b.sx, b.sy); t.angle = b.ang; t.alpha = b.a; }
  }

  static list() { return Object.keys(MotionLibrary.MOTIONS); }
  static has(name) { return !!MotionLibrary.MOTIONS[name]; }

  static apply(scene, t, name, o = {}) {
    const fn = MotionLibrary.MOTIONS[name];
    if (!fn) { console.warn('[Motion] unknown motion:', name); return null; }
    if (!t || !scene?.tweens) return null;
    MotionLibrary._baseOf(t);
    try { return fn(scene, t, o); } catch (e) { return null; }
  }

  /** Apply a motion to many targets with a stagger so they don't sync up. */
  static applyGroup(scene, arr, name, o = {}) {
    (arr || []).forEach((t, i) => {
      scene.time.delayedCall((o.stagger ?? 120) * i, () => MotionLibrary.apply(scene, t, name, o));
    });
  }

  /** Face a sprite by horizontal direction (flipX). */
  static face(t, dirX) {
    if (dirX < 0) t.setFlipX(true); else if (dirX > 0) t.setFlipX(false);
  }
}

const B = (t) => MotionLibrary._baseOf(t);

MotionLibrary.MOTIONS = {
  // ── Idle / ambient (loop) ──────────────────────────────────────────
  'idle-sway':      (s, t, o) => s.tweens.add({ targets: t, angle: { from: B(t).ang - (o.amount ?? 3), to: B(t).ang + (o.amount ?? 3) }, duration: o.duration ?? 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'idle-breathe':   (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * (1 + (o.amount ?? 0.04)), scaleY: B(t).sy * (1 + (o.amount ?? 0.04)), duration: o.duration ?? 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'idle-bob':       (s, t, o) => s.tweens.add({ targets: t, y: B(t).y - (o.amount ?? 6), duration: o.duration ?? 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'idle-float':     (s, t, o) => { s.tweens.add({ targets: t, y: B(t).y - (o.amount ?? 8), duration: o.duration ?? 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); return s.tweens.add({ targets: t, x: B(t).x + 4, duration: (o.duration ?? 2000) * 1.3, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); },
  'idle-flicker':   (s, t, o) => s.tweens.add({ targets: t, alpha: { from: 0.75, to: 1 }, duration: o.duration ?? 120, yoyo: true, repeat: -1, ease: 'Linear' }),
  'idle-pulse-glow':(s, t, o) => s.tweens.add({ targets: t, alpha: { from: 0.7, to: 1 }, scaleX: B(t).sx * 1.05, scaleY: B(t).sy * 1.05, duration: o.duration ?? 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'idle-drift':     (s, t, o) => s.tweens.add({ targets: t, x: B(t).x + Phaser.Math.Between(-10, 10), y: B(t).y + Phaser.Math.Between(-10, 10), duration: o.duration ?? 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'idle-shimmer':   (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 1.03, alpha: { from: 0.85, to: 1 }, duration: o.duration ?? 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),

  // ── Locomotion ─────────────────────────────────────────────────────
  'walk-bob':       (s, t, o) => s.tweens.add({ targets: t, y: B(t).y - (o.amount ?? 4), scaleY: B(t).sy * 0.97, duration: o.duration ?? 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'walk-waddle':    (s, t, o) => s.tweens.add({ targets: t, angle: { from: B(t).ang - 4, to: B(t).ang + 4 }, duration: o.duration ?? 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'hop':            (s, t, o) => s.tweens.add({ targets: t, y: B(t).y - (o.amount ?? 30), duration: o.duration ?? 300, yoyo: true, repeat: 0, ease: 'Quad.easeOut', onComplete: o.onComplete }),
  'slither':        (s, t, o) => s.tweens.add({ targets: t, x: B(t).x + (o.amount ?? 8), duration: o.duration ?? 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'roll':           (s, t, o) => s.tweens.add({ targets: t, angle: t.angle + 360, duration: o.duration ?? 800, repeat: -1, ease: 'Linear' }),
  'dash':           (s, t, o) => { const d = o.direction ?? 0, dist = o.amount ?? 80; return s.tweens.add({ targets: t, x: B(t).x + Math.cos(d) * dist, y: B(t).y + Math.sin(d) * dist, scaleX: B(t).sx * 1.2, duration: o.duration ?? 180, yoyo: true, ease: 'Quad.easeOut', onComplete: o.onComplete }); },
  'hover-move':     (s, t, o) => s.tweens.add({ targets: t, y: B(t).y - 5, duration: o.duration ?? 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),

  // ── Attacks ────────────────────────────────────────────────────────
  'lunge-attack':   (s, t, o) => { const d = o.direction ?? 0, dist = o.amount ?? 26; return s.tweens.add({ targets: t, x: B(t).x + Math.cos(d) * dist, y: B(t).y + Math.sin(d) * dist, duration: o.duration ?? 130, yoyo: true, ease: 'Quad.easeOut', onComplete: o.onComplete }); },
  'windup-slam':    (s, t, o) => s.tweens.add({ targets: t, y: B(t).y - 18, duration: o.duration ?? 200, yoyo: true, hold: 60, ease: 'Back.easeOut', onComplete: o.onComplete }),
  'spin-attack':    (s, t, o) => s.tweens.add({ targets: t, angle: t.angle + 360, scaleX: B(t).sx * 1.1, scaleY: B(t).sy * 1.1, duration: o.duration ?? 320, ease: 'Cubic.easeInOut', onComplete: () => { t.angle = B(t).ang; o.onComplete && o.onComplete(); } }),
  'pounce':         (s, t, o) => { const d = o.direction ?? 0, dist = o.amount ?? 60; return s.tweens.add({ targets: t, scaleY: B(t).sy * 0.85, duration: 90, yoyo: true, onComplete: () => s.tweens.add({ targets: t, x: B(t).x + Math.cos(d) * dist, y: B(t).y + Math.sin(d) * dist, duration: 200, yoyo: true, ease: 'Quad.easeOut', onComplete: o.onComplete }) }); },
  'cast-thrust':    (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 0.92, duration: 160, yoyo: true, hold: 80, ease: 'Back.easeOut', onComplete: o.onComplete }),

  // ── Reactions ──────────────────────────────────────────────────────
  'hit-recoil':     (s, t, o) => { const d = (o.direction ?? 0) + Math.PI; t.setTint?.(o.tint ?? 0xff5555); s.time.delayedCall(150, () => t.clearTint?.()); return s.tweens.add({ targets: t, x: B(t).x + Math.cos(d) * (o.amount ?? 14), y: B(t).y + Math.sin(d) * (o.amount ?? 14), duration: o.duration ?? 110, yoyo: true, ease: 'Quad.easeOut', onComplete: o.onComplete }); },
  'hit-shake':      (s, t, o) => { t.setTint?.(0xff5555); s.time.delayedCall(180, () => t.clearTint?.()); return s.tweens.add({ targets: t, x: B(t).x + 6, duration: 40, yoyo: true, repeat: 3, ease: 'Linear', onComplete: () => { t.x = B(t).x; } }); },
  'stagger':        (s, t, o) => s.tweens.add({ targets: t, angle: B(t).ang - 12, duration: o.duration ?? 160, yoyo: true, ease: 'Quad.easeOut' }),
  'block-flash':    (s, t, o) => { t.setTint?.(0xffffff); s.time.delayedCall(120, () => t.clearTint?.()); return s.tweens.add({ targets: t, scaleX: B(t).sx * 1.12, scaleY: B(t).sy * 1.12, duration: 120, yoyo: true, ease: 'Quad.easeOut' }); },

  // ── Death / spawn ──────────────────────────────────────────────────
  'death-fall':     (s, t, o) => s.tweens.add({ targets: t, angle: B(t).ang + 85, alpha: 0, scaleX: B(t).sx * 0.8, scaleY: B(t).sy * 0.8, y: B(t).y + 10, duration: o.duration ?? 600, ease: 'Quad.easeIn', onComplete: o.onComplete }),
  'death-dissolve': (s, t, o) => s.tweens.add({ targets: t, alpha: 0, y: B(t).y - 30, scaleX: B(t).sx * 1.1, scaleY: B(t).sy * 1.1, duration: o.duration ?? 700, ease: 'Sine.easeOut', onComplete: o.onComplete }),
  'death-shatter':  (s, t, o) => s.tweens.add({ targets: t, alpha: 0, scaleX: B(t).sx * 1.3, scaleY: B(t).sy * 0.6, duration: o.duration ?? 350, ease: 'Quad.easeOut', onComplete: o.onComplete }),
  'spawn-rise':     (s, t, o) => { t.alpha = 0; t.y = B(t).y + 20; t.setScale(B(t).sx * 0.7, B(t).sy * 0.7); return s.tweens.add({ targets: t, alpha: B(t).a, y: B(t).y, scaleX: B(t).sx, scaleY: B(t).sy, duration: o.duration ?? 450, ease: 'Back.easeOut', onComplete: o.onComplete }); },
  'spawn-drop':     (s, t, o) => { t.y = B(t).y - 120; return s.tweens.add({ targets: t, y: B(t).y, duration: o.duration ?? 400, ease: 'Bounce.easeOut', onComplete: o.onComplete }); },

  // ── Emphasis ───────────────────────────────────────────────────────
  'pulse-once':     (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 1.2, scaleY: B(t).sy * 1.2, duration: o.duration ?? 150, yoyo: true, ease: 'Quad.easeOut', onComplete: o.onComplete }),
  'wobble':         (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 1.15, scaleY: B(t).sy * 0.85, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => { t.setScale(B(t).sx, B(t).sy); } }),
  'shake':          (s, t, o) => s.tweens.add({ targets: t, x: B(t).x + 5, duration: 35, yoyo: true, repeat: 4, ease: 'Linear', onComplete: () => { t.x = B(t).x; o.onComplete && o.onComplete(); } }),
  'flash':          (s, t, o) => { t.setTint?.(o.tint ?? 0xffffff); s.time.delayedCall(o.duration ?? 120, () => t.clearTint?.()); },
  'bounce-in':      (s, t, o) => { t.setScale(0); return s.tweens.add({ targets: t, scaleX: B(t).sx, scaleY: B(t).sy, duration: o.duration ?? 400, ease: 'Back.easeOut', onComplete: o.onComplete }); },
  'nod':            (s, t, o) => s.tweens.add({ targets: t, y: B(t).y + 4, duration: 120, yoyo: true, ease: 'Quad.easeOut' }),

  // ── Environmental ──────────────────────────────────────────────────
  'tree-sway':      (s, t, o) => { t.setOrigin?.(0.5, 1); return s.tweens.add({ targets: t, angle: { from: -(o.amount ?? 2.5), to: (o.amount ?? 2.5) }, duration: o.duration ?? 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); },
  'flag-wave':      (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 0.94, duration: o.duration ?? 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  'fire-flicker':   (s, t, o) => { s.tweens.add({ targets: t, scaleY: B(t).sy * 1.08, duration: 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); return s.tweens.add({ targets: t, alpha: { from: 0.8, to: 1 }, duration: 90, yoyo: true, repeat: -1, ease: 'Linear' }); },
  'portal-swirl':   (s, t, o) => { s.tweens.add({ targets: t, angle: t.angle + 360, duration: o.duration ?? 4000, repeat: -1, ease: 'Linear' }); return s.tweens.add({ targets: t, scaleX: B(t).sx * 1.06, scaleY: B(t).sy * 1.06, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); },
  'water-ripple':   (s, t, o) => s.tweens.add({ targets: t, scaleX: B(t).sx * 1.02, scaleY: B(t).sy * 1.02, alpha: { from: 0.9, to: 1 }, duration: o.duration ?? 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
};
