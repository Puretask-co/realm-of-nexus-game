# Verdance Development Architecture & Engine Comparison

## Executive Summary

This document analyzes our Phaser.js-based game development approach for Realm of Nexus,
identifies gaps from not using Unity/Unreal, and provides actionable solutions through
custom tooling. **Recommendation: Stay with Phaser.js** and build targeted custom tools.

## Core Technology Stack

- **Framework**: Phaser.js 3.x (2D HTML5 game framework)
- **Build Tool**: Vite
- **Language**: JavaScript (ES Modules)
- **Deployment**: Web-based (browser)

## Architecture Overview

```
Verdance/
├── Core Engine Layer (Phaser.js)
├── Custom Game Systems Layer
│   ├── SapCycleManager (temporal magic system)
│   ├── CooldownManager (ability timing)
│   ├── CombatSystem (turn-based tactical)
│   ├── ProgressionSystem (XP, levels, skills)
│   ├── SpellSystem (magic casting, combos)
│   └── AISystem (enemy behaviors)
├── Custom Development Tools
│   ├── DataManager (data-driven architecture)
│   ├── EditorScene (visual level editor)
│   ├── AdvancedLightingSystem (2D lighting + shadows)
│   ├── AdvancedParticleSystem (spell VFX)
│   ├── CinematicCameraSystem (camera tools)
│   └── PerformanceProfiler (debugging)
└── Game Content Layer
    ├── Maps & Locations (JSON scene files)
    ├── Character Data (JSON)
    ├── Spell Definitions (JSON)
    └── UI Components
```

## Why Not Unity/Unreal

### Migration Cost Analysis

| Metric                  | Stay Phaser + Tools | Migrate to Unity |
|-------------------------|---------------------|------------------|
| Time to Resume Features | 4 weeks             | 12 weeks         |
| Code Reuse              | 100%                | 5%               |
| Learning Curve          | Minimal             | Steep            |
| Web Performance         | Excellent           | Poor             |
| File Size               | 5-10MB              | 50-200MB         |
| Risk Level              | Low                 | High             |

### Key Reasons to Stay

1. **Game is 2D tactical RPG** - Phaser's sweet spot
2. **Web deployment is a strength** - share via link, no download
3. **Tool gaps are solvable** - 6 weeks of custom tools vs 12 weeks migration
4. **Single-player** - no networking needed (Unity advantage doesn't apply)

## Custom Tools Overview

### Tool 1: Data-Driven Architecture
- External JSON/CSV for all game data (spells, enemies, items, config)
- Schema validation for data integrity
- Hot-reload support for instant iteration
- **Impact**: 15x faster balancing

### Tool 2: Visual Level Editor
- In-game editor scene with grid, palette, inspector
- Object placement, selection, transform gizmos
- Scene serialization to JSON
- Undo/redo, prefab system
- **Impact**: 180x faster level design

### Tool 3: Advanced Lighting System
- Dynamic 2D shadows via ray casting
- Multiple light types (point, spot, directional, area)
- Normal map support for sprite depth
- Sap Cycle phase integration
- Lighting presets (time of day, weather, locations)
- **Impact**: 10x more atmospheric

### Tool 4: Advanced Particle System
- Complex multi-stage effects (fire -> smoke)
- Physics forces (gravity, wind, vortex, turbulence)
- Particle trails and sub-emitters
- Collision detection for particles
- Spell VFX preset library
- **Impact**: 20x more visually impressive

### Tool 5: Cinematic Camera System
- Camera shake presets (hit, explosion, earthquake)
- Camera zones (auto-adjust per area)
- Cinematic camera paths
- Combat focus (frame all combatants)
- Dramatic spell zoom
- **Impact**: Professional cinematic feel

### Tool 6: Performance Profiler
- FPS counter and frame time graph
- Memory usage tracking
- System performance breakdown
- Draw call monitoring
- Configurable overlay
- **Impact**: Identify bottlenecks efficiently

## Implementation Roadmap

### Phase 1 (Foundation Tools)
- Data-driven architecture (DataManager, schemas, JSON data files)
- Basic visual editor (EditorScene, SceneLoader)

### Phase 2 (Visual Polish)
- Advanced lighting system
- Particle system + spell VFX
- Camera system

### Phase 3 (Production Tools)
- Performance profiler
- Inspector panel enhancements
- Animation timeline
- Audio system improvements
