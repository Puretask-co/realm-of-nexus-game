/**
 * cinematicPresets.js - Pre-authored cinematic camera timelines for the Verdance
 * game engine (Realm of Nexus).
 *
 * Each preset is an array of keyframe objects describing sequential camera actions.
 * Systems that consume these presets iterate through the keyframes, executing each
 * action after the specified `time` offset (ms from the start of the sequence).
 *
 * Keyframe schema:
 *   time     {number}  - Offset in ms from sequence start when this action fires.
 *   action   {string}  - One of: 'pan', 'zoom', 'shake', 'fade', 'wait',
 *                         'setController', 'slowMotion', 'effect', 'flash'.
 *   target   {Object}  - Position { x, y } for pan/zoom/focus actions (optional).
 *   value    {*}       - Action-specific payload (zoom level, shake preset, etc.).
 *   duration {number}  - How long the action takes (ms).
 *   easing   {string}  - Phaser/tween easing string (default 'Linear').
 *   params   {Object}  - Extra parameters for the action.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helper: common easing constants
// ─────────────────────────────────────────────────────────────────────────────
const EASE_IN_OUT   = 'Cubic.easeInOut';
const EASE_OUT      = 'Cubic.easeOut';
const EASE_IN       = 'Cubic.easeIn';
const EASE_LINEAR   = 'Linear';
const EASE_QUAD_OUT = 'Quad.easeOut';
const EASE_SINE_OUT = 'Sine.easeOut';

// ─────────────────────────────────────────────────────────────────────────────
// Preset Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const cinematicPresets = {

  // ── 1. Boss Entrance ────────────────────────────────────────────────────
  // Dramatic zoom out to reveal the boss, shake, then slow pan to it.
  boss_entrance: [
    { time: 0,    action: 'setController', value: 'follow',   duration: 0 },
    { time: 0,    action: 'slowMotion',    value: 0.4,        duration: 0 },
    { time: 0,    action: 'zoom',          value: 0.65,       duration: 1500, easing: EASE_IN_OUT },
    { time: 200,  action: 'shake',         value: 'heavy',    duration: 400 },
    { time: 800,  action: 'effect',        value: 'vignette', duration: 1000, params: { intensity: 0.7 } },
    { time: 1600, action: 'pan',           target: { x: 0, y: 0 }, duration: 1200, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'boss' } },
    { time: 2900, action: 'shake',         value: 'earthquake', duration: 800 },
    { time: 3800, action: 'slowMotion',    value: 1.0,          duration: 0 },
    { time: 3800, action: 'zoom',          value: 1.0,          duration: 600, easing: EASE_OUT },
    { time: 4500, action: 'setController', value: 'follow',     duration: 0 },
    { time: 4500, action: 'effect',        value: 'vignette',   duration: 500, params: { intensity: 0 } }
  ],

  // ── 2. Dramatic Reveal ──────────────────────────────────────────────────
  // Slow zoom + pan to reveal a hidden area or important character.
  dramatic_reveal: [
    { time: 0,    action: 'slowMotion',    value: 0.6,          duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.4,          duration: 2000, easing: EASE_IN_OUT },
    { time: 0,    action: 'effect',        value: 'vignette',   duration: 800,  params: { intensity: 0.5 } },
    { time: 500,  action: 'pan',           target: { x: 0, y: 0 }, duration: 2000, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'reveal_target' } },
    { time: 2500, action: 'flash',         value: '#ffffff',    duration: 200 },
    { time: 2800, action: 'zoom',          value: 1.0,          duration: 800, easing: EASE_OUT },
    { time: 2800, action: 'slowMotion',    value: 1.0,          duration: 0 },
    { time: 3600, action: 'effect',        value: 'vignette',   duration: 600, params: { intensity: 0 } }
  ],

  // ── 3. Final Blow ──────────────────────────────────────────────────────
  // Freeze-frame, slow zoom in on impact, then shake.
  final_blow: [
    { time: 0,    action: 'slowMotion',  value: 0.05,       duration: 0 },
    { time: 0,    action: 'zoom',        value: 1.6,        duration: 600,  easing: EASE_IN },
    { time: 0,    action: 'effect',      value: 'flash',    duration: 100,  params: { color: '#ffffff' } },
    { time: 100,  action: 'effect',      value: 'chromatic_aberration', duration: 500, params: { intensity: 0.8 } },
    { time: 600,  action: 'slowMotion',  value: 1.0,        duration: 0 },
    { time: 600,  action: 'shake',       value: 'explosion', duration: 500 },
    { time: 700,  action: 'flash',       value: '#ffcc00',  duration: 150 },
    { time: 1200, action: 'zoom',        value: 1.0,        duration: 800,  easing: EASE_OUT },
    { time: 1200, action: 'effect',      value: 'chromatic_aberration', duration: 400, params: { intensity: 0 } }
  ],

  // ── 4. Area Transition ──────────────────────────────────────────────────
  // Smooth pan with fade-to-black between two areas.
  area_transition: [
    { time: 0,    action: 'fade',   value: 'out', duration: 600, easing: EASE_IN,    params: { color: '#000000' } },
    { time: 600,  action: 'wait',   duration: 300 },
    { time: 900,  action: 'pan',    target: { x: 0, y: 0 }, duration: 0, easing: EASE_LINEAR,
      params: { relative: true, tag: 'destination' } },
    { time: 900,  action: 'zoom',   value: 0.8,  duration: 0 },
    { time: 1000, action: 'fade',   value: 'in', duration: 800, easing: EASE_OUT,    params: { color: '#000000' } },
    { time: 1000, action: 'zoom',   value: 1.0,  duration: 1200, easing: EASE_OUT },
    { time: 2200, action: 'setController', value: 'follow', duration: 0 }
  ],

  // ── 5. Dialogue Framing ─────────────────────────────────────────────────
  // Two-shot framing: camera frames both speakers with gentle zoom.
  dialogue_framing: [
    { time: 0,    action: 'setController', value: 'framing', duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.3,       duration: 800, easing: EASE_IN_OUT },
    { time: 0,    action: 'effect',        value: 'vignette', duration: 500, params: { intensity: 0.3 } },
    { time: 100,  action: 'effect',        value: 'blur',     duration: 600, params: { intensity: 0.15, edgesOnly: true } },
    { time: 800,  action: 'wait',          duration: 0, params: { untilEvent: 'dialogue:end' } }
  ],

  // ── 6. Skill Showcase ──────────────────────────────────────────────────
  // Orbit around the character during a special attack animation.
  skill_showcase: [
    { time: 0,    action: 'setController', value: 'targetLock', duration: 0 },
    { time: 0,    action: 'slowMotion',    value: 0.3,          duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.5,          duration: 400, easing: EASE_IN },
    { time: 50,   action: 'effect',        value: 'chromatic_aberration', duration: 300, params: { intensity: 0.4 } },
    { time: 400,  action: 'pan',           target: { x: 60, y: 0 },  duration: 300, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 700,  action: 'pan',           target: { x: 0, y: -60 }, duration: 300, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 1000, action: 'pan',           target: { x: -60, y: 0 }, duration: 300, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 1300, action: 'pan',           target: { x: 0, y: 60 },  duration: 300, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 1600, action: 'slowMotion',    value: 1.0,          duration: 0 },
    { time: 1600, action: 'shake',         value: 'heavy',      duration: 300 },
    { time: 1600, action: 'flash',         value: '#ffffff',    duration: 120 },
    { time: 2000, action: 'zoom',          value: 1.0,          duration: 500, easing: EASE_OUT },
    { time: 2000, action: 'effect',        value: 'chromatic_aberration', duration: 300, params: { intensity: 0 } },
    { time: 2500, action: 'setController', value: 'follow',     duration: 0 }
  ],

  // ── 7. Death Scene ─────────────────────────────────────────────────────
  // Slow zoom out with desaturation as the character falls.
  death_scene: [
    { time: 0,    action: 'slowMotion',    value: 0.3,              duration: 0 },
    { time: 0,    action: 'setController', value: 'targetLock',     duration: 0 },
    { time: 0,    action: 'effect',        value: 'desaturation',   duration: 1500, params: { intensity: 0.8 } },
    { time: 0,    action: 'effect',        value: 'vignette',       duration: 1200, params: { intensity: 0.7, color: '#1a0000' } },
    { time: 200,  action: 'zoom',          value: 0.7,              duration: 2000, easing: EASE_OUT },
    { time: 2200, action: 'slowMotion',    value: 1.0,              duration: 0 },
    { time: 2500, action: 'fade',          value: 'out',            duration: 1000, easing: EASE_IN, params: { color: '#000000' } }
  ],

  // ── 8. Victory Pose ────────────────────────────────────────────────────
  // Zoom in on the victorious character with particle fanfare.
  victory_pose: [
    { time: 0,    action: 'setController', value: 'targetLock', duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.4,          duration: 1000, easing: EASE_IN_OUT },
    { time: 0,    action: 'effect',        value: 'vignette',   duration: 600, params: { intensity: 0.3 } },
    { time: 200,  action: 'effect',        value: 'flash',      duration: 100, params: { color: '#ffffcc' } },
    { time: 500,  action: 'effect',        value: 'particles',  duration: 2000,
      params: { type: 'confetti', emitZone: 'screen' } },
    { time: 2500, action: 'zoom',          value: 1.0,          duration: 800, easing: EASE_OUT },
    { time: 3300, action: 'effect',        value: 'vignette',   duration: 500, params: { intensity: 0 } },
    { time: 3300, action: 'setController', value: 'follow',     duration: 0 }
  ],

  // ── 9. Ambush ──────────────────────────────────────────────────────────
  // Quick shake, then snap to reveal enemy positions before returning.
  ambush: [
    { time: 0,    action: 'shake',   value: 'heavy',            duration: 250 },
    { time: 0,    action: 'flash',   value: '#ff0000',          duration: 80 },
    { time: 250,  action: 'slowMotion', value: 0.5,             duration: 0 },
    { time: 300,  action: 'pan',     target: { x: 0, y: 0 },   duration: 400, easing: EASE_OUT,
      params: { relative: true, tag: 'enemy_1' } },
    { time: 750,  action: 'wait',    duration: 300 },
    { time: 1050, action: 'pan',     target: { x: 0, y: 0 },   duration: 400, easing: EASE_OUT,
      params: { relative: true, tag: 'enemy_2' } },
    { time: 1500, action: 'wait',    duration: 300 },
    { time: 1800, action: 'pan',     target: { x: 0, y: 0 },   duration: 400, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'player' } },
    { time: 2200, action: 'slowMotion', value: 1.0,             duration: 0 },
    { time: 2200, action: 'setController', value: 'follow',     duration: 0 }
  ],

  // ── 10. Treasure Reveal ─────────────────────────────────────────────────
  // Slow pan to treasure location with subtle sparkle effect.
  treasure_reveal: [
    { time: 0,    action: 'setController', value: 'follow',      duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.2,           duration: 1000, easing: EASE_IN_OUT },
    { time: 200,  action: 'pan',           target: { x: 0, y: 0 }, duration: 1200, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'treasure' } },
    { time: 1400, action: 'effect', value: 'flash',   duration: 100, params: { color: '#ffeeaa' } },
    { time: 1500, action: 'effect', value: 'particles', duration: 1500,
      params: { type: 'sparkle', emitZone: 'target' } },
    { time: 1500, action: 'wait',   duration: 1200 },
    { time: 2700, action: 'pan',    target: { x: 0, y: 0 }, duration: 800, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'player' } },
    { time: 3500, action: 'zoom',   value: 1.0, duration: 600, easing: EASE_OUT },
    { time: 4100, action: 'setController', value: 'follow', duration: 0 }
  ],

  // ── 11. Boss Phase Transition ───────────────────────────────────────────
  // Intense shake, zoom out, color shift as boss enters a new phase.
  boss_phase_transition: [
    { time: 0,    action: 'shake',       value: 'earthquake',      duration: 1000 },
    { time: 0,    action: 'flash',       value: '#ff4400',         duration: 150 },
    { time: 0,    action: 'slowMotion',  value: 0.4,               duration: 0 },
    { time: 200,  action: 'zoom',        value: 0.6,               duration: 800, easing: EASE_IN },
    { time: 200,  action: 'effect',      value: 'chromatic_aberration', duration: 600, params: { intensity: 0.9 } },
    { time: 500,  action: 'effect',      value: 'color_grade',     duration: 800,
      params: { tint: '#ff2200', intensity: 0.4 } },
    { time: 1200, action: 'slowMotion',  value: 1.0,               duration: 0 },
    { time: 1200, action: 'zoom',        value: 0.85,              duration: 600, easing: EASE_OUT },
    { time: 1200, action: 'shake',       value: 'medium',          duration: 300 },
    { time: 1800, action: 'effect',      value: 'chromatic_aberration', duration: 400, params: { intensity: 0 } },
    { time: 2200, action: 'effect',      value: 'color_grade',     duration: 800, params: { intensity: 0 } },
    { time: 2200, action: 'zoom',        value: 1.0,               duration: 600, easing: EASE_OUT }
  ],

  // ── 12. Flashback ──────────────────────────────────────────────────────
  // Blurred edges, desaturation, slow zoom -- evokes a memory sequence.
  flashback: [
    { time: 0,    action: 'effect', value: 'blur',          duration: 800,  params: { intensity: 0.3, edgesOnly: true } },
    { time: 0,    action: 'effect', value: 'desaturation',  duration: 1000, params: { intensity: 0.6 } },
    { time: 0,    action: 'effect', value: 'vignette',      duration: 800,  params: { intensity: 0.5, color: '#222222' } },
    { time: 0,    action: 'effect', value: 'film_grain',    duration: 600,  params: { intensity: 0.25 } },
    { time: 200,  action: 'zoom',   value: 1.15,            duration: 2000, easing: EASE_IN_OUT },
    { time: 200,  action: 'pan',    target: { x: 0, y: 0 }, duration: 2000, easing: EASE_IN_OUT,
      params: { relative: true, tag: 'flashback_focus' } },
    { time: 2200, action: 'wait',   duration: 0, params: { untilEvent: 'flashback:end' } }
  ],

  // ── 13. Time Freeze ────────────────────────────────────────────────────
  // Everything stops; camera slowly orbits the frozen moment.
  time_freeze: [
    { time: 0,    action: 'slowMotion',    value: 0.0,              duration: 0 },
    { time: 0,    action: 'effect',        value: 'desaturation',   duration: 300, params: { intensity: 0.3 } },
    { time: 0,    action: 'effect',        value: 'chromatic_aberration', duration: 200, params: { intensity: 0.3 } },
    { time: 0,    action: 'zoom',          value: 1.3,              duration: 500, easing: EASE_IN },
    { time: 500,  action: 'pan',           target: { x: 80, y: 0 }, duration: 600, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 1100, action: 'pan',           target: { x: 0, y: -80 }, duration: 600, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 1700, action: 'pan',           target: { x: -80, y: 0 }, duration: 600, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 2300, action: 'pan',           target: { x: 0, y: 80 }, duration: 600, easing: EASE_LINEAR,
      params: { relative: true, orbit: true } },
    { time: 2900, action: 'slowMotion',    value: 1.0,              duration: 0 },
    { time: 2900, action: 'zoom',          value: 1.0,              duration: 500, easing: EASE_OUT },
    { time: 2900, action: 'effect',        value: 'desaturation',   duration: 400, params: { intensity: 0 } },
    { time: 2900, action: 'effect',        value: 'chromatic_aberration', duration: 300, params: { intensity: 0 } }
  ],

  // ── 14. Sap Cycle Transition ────────────────────────────────────────────
  // Color wash combined with an environmental shift, unique to Verdance lore.
  // The sap cycle defines the world's magical rhythms (Blue, Crimson, Silver).
  sap_cycle_transition: [
    { time: 0,    action: 'effect', value: 'color_grade', duration: 1500,
      params: { tint: '#3388ff', intensity: 0.5, tag: 'sap_color' } },
    { time: 0,    action: 'effect', value: 'flash',       duration: 200, params: { color: '#88bbff' } },
    { time: 0,    action: 'zoom',   value: 0.9,           duration: 1000, easing: EASE_IN_OUT },
    { time: 200,  action: 'shake',  value: 'light',       duration: 300 },
    { time: 500,  action: 'effect', value: 'vignette',    duration: 800, params: { intensity: 0.35, color: '#224488' } },
    { time: 1500, action: 'effect', value: 'color_grade', duration: 1500, params: { intensity: 0, tag: 'sap_color' } },
    { time: 1500, action: 'zoom',   value: 1.0,           duration: 800, easing: EASE_OUT },
    { time: 2300, action: 'effect', value: 'vignette',    duration: 600, params: { intensity: 0 } }
  ],

  // ── 15. Map Overview ────────────────────────────────────────────────────
  // High-altitude zoom out showing the full playable area, then zoom back.
  map_overview: [
    { time: 0,    action: 'setController', value: 'follow',   duration: 0 },
    { time: 0,    action: 'zoom',          value: 0.3,        duration: 1500, easing: EASE_IN_OUT },
    { time: 0,    action: 'effect',        value: 'vignette', duration: 800, params: { intensity: 0.4 } },
    { time: 1500, action: 'wait',          duration: 2000 },
    { time: 3500, action: 'zoom',          value: 1.0,        duration: 1200, easing: EASE_OUT },
    { time: 3500, action: 'effect',        value: 'vignette', duration: 600, params: { intensity: 0 } },
    { time: 4700, action: 'setController', value: 'follow',   duration: 0 }
  ],

  // ── 16. Stealth Takedown ────────────────────────────────────────────────
  // Quick lock-on, brief slow-mo, sharp shake on impact.
  stealth_takedown: [
    { time: 0,    action: 'setController', value: 'targetLock', duration: 0 },
    { time: 0,    action: 'slowMotion',    value: 0.25,         duration: 0 },
    { time: 0,    action: 'zoom',          value: 1.5,          duration: 250, easing: EASE_IN },
    { time: 250,  action: 'slowMotion',    value: 1.0,          duration: 0 },
    { time: 250,  action: 'shake',         value: 'medium',     duration: 200 },
    { time: 250,  action: 'flash',         value: '#ffffff',    duration: 80 },
    { time: 500,  action: 'zoom',          value: 1.0,          duration: 400, easing: EASE_OUT },
    { time: 900,  action: 'setController', value: 'follow',     duration: 0 }
  ],

  // ── 17. Environmental Hazard ────────────────────────────────────────────
  // Shake + red flash for traps, explosions, or environmental damage.
  environmental_hazard: [
    { time: 0,   action: 'shake', value: 'explosion',  duration: 500 },
    { time: 0,   action: 'flash', value: '#ff3300',    duration: 120 },
    { time: 50,  action: 'effect', value: 'chromatic_aberration', duration: 400, params: { intensity: 0.5 } },
    { time: 50,  action: 'zoom',   value: 1.08,        duration: 200, easing: EASE_IN },
    { time: 300, action: 'zoom',   value: 1.0,         duration: 400, easing: EASE_OUT },
    { time: 500, action: 'effect', value: 'chromatic_aberration', duration: 300, params: { intensity: 0 } }
  ]
};

export default cinematicPresets;
