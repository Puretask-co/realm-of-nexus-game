# Realm of Nexus — Architecture Analysis

## Decision: Stay with Phaser.js

After thorough analysis comparing our current Phaser.js stack against Unity and Unreal Engine, the decision is to **remain on Phaser.js** and build custom tooling to close the identified gaps.

**Rationale:**
- Game is 2D tactical RPG — Unity/Unreal's 3D pipelines add unnecessary overhead
- Full control over every system (no engine black boxes)
- Web-native deployment (zero install, instant play)
- Smaller build sizes (< 5MB vs 50MB+ for Unity WebGL)
- Faster iteration with Vite hot module replacement
- The Sap Cycle temporal mechanic requires deep integration that custom code handles better

---

## Architecture Overview

```
src/
├── main.js                     # Entry point — Phaser.Game config
├── scenes/
│   ├── BootScene.js            # Asset loading, placeholder generation
│   ├── GameScene.js            # Main gameplay orchestration
│   ├── EditorScene.js          # Visual level editor (F2)
│   └── UIScene.js              # HUD overlay (parallel scene)
├── systems/
│   ├── EventBus.js             # Singleton event bus (decoupled comms)
│   ├── DataManager.js          # JSON data loading, validation, hot-reload
│   ├── SapCycleManager.js      # Phase cycle: blue → crimson → silver
│   ├── AdvancedLightingSystem.js  # Render-texture 2D lighting
│   ├── AdvancedParticleSystem.js  # Custom particle engine with pooling
│   ├── AdvancedCameraSystem.js    # Smooth follow, shake, cinematics
│   ├── PerformanceProfiler.js     # FPS/memory/timer overlay (F3)
│   ├── CooldownManager.js        # Centralised cooldown tracker
│   └── SaveManager.js            # localStorage save/load with slots
├── integration/
│   ├── SpellVFXIntegration.js  # Bridges spells → particles + lights
│   ├── CombatSystem.js         # Damage calculation, phase modifiers
│   ├── ProgressionSystem.js    # XP, levelling, stat growth, unlocks
│   └── AISystem.js             # State-machine enemy behaviours
├── components/
│   ├── Player.js               # Player entity (stats, movement, dash)
│   ├── Enemy.js                # Enemy entity (health bar, AI state)
│   ├── NPC.js                  # NPC with dialogue, quests, shops
│   └── Projectile.js           # Spell projectile (homing, AOE, trail)
├── configs/
│   ├── LightingPresets.js      # Per-location + per-phase light setups
│   ├── ParticlePresets.js      # Spell, combat, environment particles
│   └── CameraPresets.js        # Follow modes, shake, cinematics
├── pipelines/
│   ├── NormalMapPipeline.js    # WebGL normal-mapped sprite lighting
│   └── PostProcessingPipeline.js  # Vignette, bloom, color grading
├── renderers/
│   ├── MinimapRenderer.js      # Real-time minimap with fog of war
│   └── DamageNumberRenderer.js # Floating combat text (pooled)
└── schemas/
    ├── spellSchema.js          # Validation: spells + enemies
    └── itemSchema.js           # Validation: items + locations + scenes

data/
├── config.json                 # Balance tuning (hot-reloadable)
├── spells.json                 # 5 spells with phase modifiers
├── enemies.json                # 3 enemy types with AI patterns
├── items.json                  # 5 items (consumable, material, equipment)
└── locations.json              # 6 world locations with connections
```

---

## 6 Custom Tools Built

### Tool 1: Data-Driven Architecture

**Files:** `DataManager.js`, `schemas/`, `data/*.json`

The entire game is driven by external JSON data files. No gameplay values are hardcoded.

**Capabilities:**
- Parallel async loading of all data files at boot
- Schema validation with detailed error messages (type, range, enum, pattern)
- Fast lookup via cached Maps (O(1) by ID)
- Query API: `getSpell(id)`, `getSpellsByTier(n)`, `getEnemiesForPhase(phase)`
- Hot-reload: polls files every 2 seconds, reloads on change, emits 'data-reloaded'
- Fallback data if files fail to load
- Dot-path config access: `getConfig('balance.combat.critChance')`

**How to use:**
```js
import dataManager from './systems/DataManager.js';
await dataManager.loadAllData();
const spell = dataManager.getSpell('azure_bolt');
const config = dataManager.getConfig('balance.player.startingHp');
```

### Tool 2: Visual Level Editor

**File:** `EditorScene.js`

A complete in-game level editor accessible via F2.

**Capabilities:**
- Object palette: enemies, NPCs, spawn points, decorations, walls, chests, portals
- Tool modes: Select (V), Place (P), Erase (X), Trigger (T), Light (L)
- Grid snapping (G to toggle, 32px default)
- Property inspector for selected objects
- Undo/Redo stack (Ctrl+Z / Ctrl+Y)
- Save scene as JSON file (Ctrl+S download)
- Load scene from JSON file (Ctrl+O upload)
- Camera: pan with arrow keys, zoom with scroll wheel
- Layer system: objects, triggers, lights, spawns

**Scene file format:**
```json
{
  "metadata": { "name": "...", "author": "...", "version": "1.0" },
  "objects": [{ "type": "enemy", "x": 100, "y": 200, "properties": { "enemyId": "forest_guardian" } }],
  "triggers": [{ "type": "trigger", "x": 300, "y": 400, "properties": { "event": "custom" } }],
  "lights": [{ "type": "light", "x": 500, "y": 100, "properties": { "color": "0xffffff", "radius": 100 } }]
}
```

### Tool 3: Advanced Lighting System

**Files:** `AdvancedLightingSystem.js`, `LightingPresets.js`, `NormalMapPipeline.js`

Render-texture based 2D lighting with multiplicative blending.

**Capabilities:**
- Light types: point, spot, directional, area
- Dynamic effects: flicker, pulse, color-cycle
- Per-location presets with smooth transitions
- Phase-reactive ambient colors (blue/crimson/silver tints)
- Shadow caster registration
- Brightness query: `getBrightnessAt(x, y)` for stealth mechanics
- WebGL normal map pipeline for per-pixel depth illusion
- Post-processing: vignette, bloom, scanlines, desaturation

**How to use:**
```js
const light = lightingSystem.addLight(400, 300, {
  type: 'point', color: 0xff6644, intensity: 1.2, radius: 150,
  flicker: { speed: 3, amount: 0.1 }
});
lightingSystem.applyPreset(LightingPresets.get('crystal_caverns'));
```

### Tool 4: Advanced Particle System

**Files:** `AdvancedParticleSystem.js`, `ParticlePresets.js`

Custom particle engine with object pooling for zero GC pressure.

**Capabilities:**
- Emitter types: continuous, burst
- Emission shapes: point, circle, rectangle, ring
- Global forces: gravity, vortex, turbulence
- Sub-emitters (fire → smoke on particle death)
- Trail rendering
- 25+ built-in presets: spells, combat, environment, UI, phase transitions
- Per-particle color interpolation and alpha curves

**How to use:**
```js
particles.burst(x, y, 'fireball', { count: 20 });
particles.createEmitter(x, y, ParticlePresets.get('fireflies'));
```

### Tool 5: Advanced Camera System

**Files:** `AdvancedCameraSystem.js`, `CameraPresets.js`

Smooth follow, shake, and cinematic camera control.

**Capabilities:**
- Smooth follow with deadzone and configurable lerp
- Look-ahead: velocity-based prediction of player movement
- Multi-target framing with auto-zoom
- Camera zones: auto-adjust zoom/position on enter/exit
- 7 shake presets (light → earthquake)
- Cinematic timeline: keyframed camera paths for cutscenes
- Combat helpers: `dramaticSpellZoom()`, `focusOnCombat()`
- Follow mode presets: exploration, combat, dialogue

**How to use:**
```js
cameraSystem.startFollow(player, CameraPresets.get('follow_exploration'));
cameraSystem.shake('explosion');
cameraSystem.playCinematic(CameraPresets.get('cinematic_boss_reveal'));
```

### Tool 6: Performance Profiler

**File:** `PerformanceProfiler.js`

Real-time overlay showing FPS, frame times, and per-system costs.

**Capabilities:**
- FPS tracking: current, min, max, rolling average
- Frame time breakdown by named system timers
- Memory usage (Chrome JS heap)
- Game object and particle counts
- Rolling FPS graph (last 120 frames)
- Toggle overlay with F3
- Named timer API: `begin(name)` / `end(name)` / `measure(name, fn)`
- Periodic snapshot broadcast via EventBus

**How to use:**
```js
profiler.begin('combat');
combatSystem.update(delta);
profiler.end('combat');
// Check overlay: press F3 in-game
```

---

## System Communication

All systems are decoupled via the **EventBus** singleton. No system directly references another.

Key events:
| Event | Emitter | Listeners |
|-------|---------|-----------|
| `phase-changed` | SapCycleManager | Lighting, Camera, AI, UI |
| `spell-cast` | Player / GameScene | SpellVFX, Combat, UI |
| `spell-impact` | CombatSystem | SpellVFX, DamageNumbers, Camera |
| `enemy-defeated` | CombatSystem | Progression, GameScene |
| `player-stats-updated` | Player / Progression | UIScene |
| `data-reloaded` | DataManager | SapCycle, any hot-reload consumer |
| `profiler-snapshot` | Profiler | External tools / logging |

---

## Sap Cycle (Core Mechanic)

The Sap Cycle is a three-phase temporal system that continuously rotates:

```
BLUE PHASE (45s) → CRIMSON PHASE (30s) → SILVER PHASE (60s) → repeat
```

Each phase modifies:
- **Spell damage**: multipliers per spell per phase (in spells.json)
- **Enemy aggression**: enemies with high phase weight become stronger
- **Ambient lighting**: scene tint shifts to match the phase color
- **Particle effects**: phase transition bursts

Phase durations are hot-tunable via `config.json`.

---

## How to Run

```bash
npm install
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

**In-game controls:**
- WASD / Arrow keys: Move
- 1-5: Cast spells
- SPACE: Dash
- E: Interact with NPC
- F2: Toggle level editor
- F3: Toggle performance profiler

---

## Tech Stack

- **Phaser 3.80+** — 2D game framework
- **Vite 5** — Build tool with HMR
- **Vanilla JS (ES modules)** — No framework overhead
- **JSON data files** — Designer-editable game content
- **localStorage** — Save system (3 slots + auto-save)
