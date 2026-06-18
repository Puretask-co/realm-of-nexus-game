# Visual Systems — Realm of Nexus: Verdance

## Lighting System (AdvancedLightingSystem.js)
- 2D multiplicative lighting via MULTIPLY blend render texture
- Volumetric glow layer via ADD blend render texture
- Light types: point, spot, directional, area
- Light effects: flicker (sinusoidal intensity), pulse (min/max oscillation), color cycle, volumetric glow (1.2x radius ADD layer)
- Default ambient: 0x222244 at 0.3 intensity
- Max 32 lights, 12 concentric circles per light for radial gradient approximation
- getBrightnessAt(x,y) for gameplay queries

## Sap Phase Lighting (SapCycleLightingIntegration.js)

| Phase | Ambient Color | Intensity | Shadow | Light Tint | Fog Color | Fog Density | Volumetric |
|--------|---------------|-----------|--------|------------|-----------|-------------|------------|
| Blue | 0x0a1a3a | 0.2 | 0.4 | 0x6699ff | 0x0d1b2a | 0.15 | 1.2x |
| Crimson | 0x3a0a0a | 0.18 | 0.75 | 0xff6633 | 0x2a0d0d | 0.1 | 1.5x |
| Silver | 0x2a2a35 | 0.25 | 0.6 | 0xccccee | 0x1e1e28 | 0.08 | 1.0x |

- Smooth cubic Hermite transition over 3000ms between phases
- 6 ephemeral phase-colored point lights orbit camera during each phase
- Deep Sap Pool proximity creates unsettling ambient pulsation (layered sine waves)

## Post-Processing (PostProcessingPipeline.js)

WebGL fragment shader with:
- Vignette (strength 0-1, radius 0.85 default)
- Bloom (threshold 0.8, brightens above luminance)
- Color grading/tint (per-phase: Blue [0.05,0.08,0.2], Crimson [0.2,0.05,0.05], Silver [0.1,0.1,0.15] at 0.15 strength)
- Scanlines (CRT-style horizontal lines)
- Desaturation (0-1, used for death/pause)
- Death effect: gradual desat→0.8 + vignette→0.7 + red tint over 1000ms

## Normal Map Pipeline

Per-pixel lighting for sprites with normal maps. Max 8 lights. Lambertian diffuse with distance attenuation.

## Camera System (AdvancedCameraSystem.js)

### Shake Presets (stackable)
- light: 0.003 intensity, 150ms, 20Hz (minor hits)
- medium: 0.008, 300ms, 25Hz (standard hits)
- heavy: 0.015, 500ms, 30Hz (major attacks)
- explosion: 0.025, 700ms, 35Hz (AoE spells)
- earthquake: 0.012, 2000ms, 15Hz (long rumble)
- spell: 0.004, 200ms, 22Hz (spell casts)

### Features
- Smooth follow (lerpX/Y 0.1, deadzone 20%)
- Look-ahead: predicts movement 150px, 0.05 smoothing
- Multi-target framing: auto-zoom to fit combatants (0.5-2.0 zoom)
- Camera zones: trigger zoom/pan on entry with 1000ms transitions
- Cinematic timeline: keyframed paths {x, y, zoom, duration, ease}
- dramaticSpellZoom(caster, target): zoom 1.3x on caster, flash, pan to target
- focusOnCombat(combatants): auto-frame all combatants

## Particle Systems

### AdvancedParticleSystem (Custom 2D Physics)

6 presets:
- fireball: 40 burst, orange trails
- ice_shards: 25 burst + circle, cyan
- healing_aura: continuous 2s, green to white
- shadow_strike: 30 burst + ring, purple trails
- hit_sparks: 15 burst, orange
- level_up: 60 burst + ring, gold to white

Physics: drag 0.92-0.98, sub-emitters, emission shapes (point/circle/rect/ring), global forces (gravity, vortex, turbulence)

### ParticleEffects (Event-driven)

Element-matched bursts triggered by EventBus:
- fire: 0xff4400, imp_vfx_fire textures
- arcane: 0xaa44ff, imp_vfx_holy textures
- shadow: 0x330066, imp_vfx_darkness textures
- nature: 0x44dd44, imp_vfx_earth textures
- radiant: 0xffffaa, imp_vfx_holy textures
- spirit: 0x88aaff, imp_vfx_howl textures
- void: 0x660099, imp_vfx_statedeath textures
- physical: 0xffddaa, imp_vfx_slash textures
- water/ice: 0x4488ff, imp_vfx_ice textures
- thunder: 0xffff00, imp_vfx_thunder textures
- wind: 0xaaffcc, imp_vfx_sonic textures

Event triggers: spell-cast → element burst at player, enemy-damaged → hit burst, player-damaged → hit burst, player:healed → green burst, player:levelUp → gold explosion (30 particles)

## Spell VFX (SpellVFXIntegration.js)

7 spell effect types with tier scaling (T1/T2/T3):
- projectile: moving orb + trailing ghosts (12/18/24 particles)
- burst: instant radial + flash (80/96/120px radius)
- beam: line + side lines (8/12/16 particles)
- nova: expanding AoE ring (200/240/300px radius)
- channel: pulsing charge circle + beam
- shield: orbiting particle ring (8/12/16 orbiters)
- summon: sigil with 3 circles + radial lines (40/48/60px)
- Tier 3 adds camera shake to all types

## Motion Library (MotionLibrary.js) — 32 Reusable Tweens

### Idle/Ambient (looping)
idle-sway, idle-breathe, idle-bob, idle-float, idle-flicker, idle-pulse-glow, idle-drift, idle-shimmer

### Locomotion
walk-bob, walk-waddle, hop, slither, roll, dash, hover-move

### Attacks
lunge-attack, windup-slam, spin-attack, pounce, cast-thrust

### Reactions
- hit-recoil (red tint + knockback)
- hit-shake (red tint + jitter)
- stagger
- block-flash (white tint + expand)

### Death/Spawn
- death-fall (rotate+fade)
- death-dissolve (rise+fade)
- death-shatter (squash+fade)
- spawn-rise (bounce up)
- spawn-drop (drop from above)

### Emphasis
pulse-once, wobble, shake, flash, bounce-in, nod

### Environmental
tree-sway, flag-wave, fire-flicker, portal-swirl, water-ripple

## Zone Visuals
- Realm multi-panel backdrops: 3x2 or 2x2 tiled grids per realm
- Landmark single-image backdrops for distinctive zones (Mycelium Nexus, Bloomguard Fortress, etc.)
- Tilemap rendering (Kenney Tiny Town/Dungeon) for hub/dungeon zones
- Graphics-based procedural rendering for exploration zones
- Fog banks: semi-transparent circles with drift tweens (4-8s)
- Trees/foliage: layered decoration with idle-sway (2-4s)
- Glowing landmarks: pulsing alpha + white sparkle VFX

## Combat VFX
- Enemy hit: red tint 100ms + orange spark burst (10 particles)
- Enemy death: rotating fade + particle burst (20 particles)
- Loot drop: gold coin particles with upward tween
- Player damage: orange spark burst (25-30) + medium camera shake
- Level-up: gold star explosion (30 particles) + upward float
- Healing: green star burst (12 particles)

## DSP Corruption Screen Effects
- Level 1-2: Subtle chromatic aberration (periodic camera offset tween)
- Level 3-4: Red vignette (0.5) + shake (500ms, 0.003)
- Level 5+: Screen flash (400ms red) + heavy shake (800ms, 0.012) + vignette (0.7) + red tint
