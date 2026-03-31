# Realm of Nexus — What We Built, How We Did It, How It All Works

> Last updated: 2026-03-31
> Covers all work done across the recent dev sessions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Zone Tilemap System](#2-zone-tilemap-system)
3. [Audio System](#3-audio-system)
4. [Particle Effects System](#4-particle-effects-system)
5. [UI Framework Rebuild](#5-ui-framework-rebuild)
6. [Physics System](#6-physics-system)
7. [Scene Upgrades](#7-scene-upgrades)
8. [Asset Integration](#8-asset-integration)
9. [Architecture: How Everything Connects](#9-architecture-how-everything-connects)
10. [EventBus — The Nervous System](#10-eventbus--the-nervous-system)
11. [File Map](#11-file-map)

---

## 1. Project Overview

**Realm of Nexus** is a top-down RPG built in **Phaser 3.80** (HTML5/JS).

- **Engine:** Phaser 3 with Arcade Physics
- **Framework:** Vanilla JS (ES modules), bundled with Vite
- **World:** 27 hand-designed zones laid out in a 3-column grid
- **Combat:** Real-time in GameScene + optional turn-based TacticalCombatSystem
- **Classes:** 5 player classes (Bloomguard, Thornbinder, Emerald Mystic, Wildkin Ranger, Sporecaller), each with unique spells and abilities
- **Save system:** localStorage, 3 save slots

The game uses a **singleton EventBus** pattern — every system talks to every other system by emitting/listening to named events, keeping systems fully decoupled.

---

## 2. Zone Tilemap System

**File:** `src/systems/ZoneTilemapBuilder.js`

### What it does

Replaced the old placeholder colored-rectangle world with a visually distinct rendered world. Every zone now looks different based on its type.

### How it works

`ZoneTilemapBuilder` is a **static class** (no instances needed). GameScene calls:

```js
const result = ZoneTilemapBuilder.buildZone(scene, zoneX, zoneY, ZONE_W, ZONE_H, locationData);
this._zoneTilemaps.push(...result.tilemaps);
```

Inside `buildZone`, the zone's `type` field routes to one of two renderers:

**Kenney Tilemap Renderer** (`_buildTilemapZone`) — used for town/dungeon zones:
- Creates a **50×56 tile data array** (each tile = 16×16 px → total 800×900 px per zone)
- Builds 3 separate Phaser tilemaps: floor, wall, deco
- Uses `scene.make.tilemap({ data, tileWidth: 16, tileHeight: 16 })`
- Floor tiles randomly pick from `tsCfg.floor` or `tsCfg.floor2` options
- Border tiles use `tsCfg.border`; transparent tiles are `-1`
- Returns an array of Phaser Tilemap objects for cleanup on scene shutdown

**Enhanced Graphics Renderer** — used for forest/temple/boss/void/hidden zones:
- Draws directly with Phaser `Graphics` objects
- Each zone type has its own draw method:

| Zone Type | Visual |
|-----------|--------|
| `grove / forest / exploration` | Dark green base + foliage patches + dirt path cross |
| `temple / sacred / shrine` | Checkerboard stone + altar platform + columns + glowing rune |
| `boss` | Arena circle + radial spokes + summoning ring + bloody cracks |
| `hidden` | Crystal formations + portal ring + mist pockets |
| `void / corruption` | Fractured tiles + corruption veins + singularity core |

### World height bug fix

The world was previously hardcoded to 1800px (fit only 6 zones at once). Fixed to:

```js
const rowCount   = Math.ceil(locations.length / ZONE_COLS);
const worldHeight = rowCount * ZONE_H;   // all 27 zones now reachable
```

### How tilesets are loaded

`ZoneTilemapBuilder.getTilesetLoadList()` returns the load specs. BootScene reads them:

```js
this.load.image('ts_town',    'assets/tilesets/tiny_town/Tilemap/tilemap_packed.png');
this.load.image('ts_dungeon', 'assets/tilesets/tiny_dungeon/Tilemap/tilemap_packed.png');
```

---

## 3. Audio System

**Files:** `src/systems/AudioManager.js` (modified), `src/scenes/BootScene.js` (modified)

### What it does

The existing `AudioManager` class was well-written but **never connected to the game**. We added `wireToGame(scene)` which maps every EventBus game event to the correct sound automatically.

### How it works

```js
// In GameScene.create():
this.audioManager = AudioManager.getInstance(this);
this.audioManager.wireToGame(this);
```

`wireToGame` subscribes to EventBus events and calls `playSFX` or `playMusic` on each:

```js
eb.on('spell-cast', (d) => {
    const element = d?.spell?.element || d?.element;
    const sfxKey  = ELEMENT_SFX[element] || 'sfx_magic1';
    this.playSFX(sfxKey);
});
```

The full mapping (20+ events):

| Event | Sound |
|-------|-------|
| `spell-cast` (fire) | `sfx_fire1/2/3` (random) |
| `spell-cast` (thunder) | `sfx_thunder1-3` |
| `spell-cast` (heal/radiant) | `sfx_heal1-7` |
| `enemy-damaged` | `sfx_damage1-3` |
| `player-damaged` | `sfx_blow1-4` |
| `enemy-defeated` | `sfx_collapse1` |
| `player:levelUp` | `sfx_levelup` |
| `ui:buttonClick` | `sfx_cursor1` |
| `ui:menuOpen` | `sfx_cursor2` |
| `ui:menuClose` | `sfx_cancel1` |
| `portal:activated` | `sfx_teleport` |
| `zone-entered` (town) | crossfade → `bgm_town` |
| `zone-entered` (dungeon) | crossfade → `bgm_dungeon` |
| `zone-entered` (boss) | crossfade → `bgm_boss` |
| `tactical:combatStarted` | crossfade → `bgm_battle` |
| `player:died` | fade → `bgm_gameover` (2s delay) |

### Cleanup

```js
// In GameScene.shutdown():
this.audioManager.unwireFromGame();
```

`unwireFromGame()` calls all unsubscribe functions stored in `_gameUnsubs`, preventing memory leaks on scene restart.

### MainMenuScene BGM

MainMenuScene plays `bgm_menu` directly (not through AudioManager — AudioManager is tied to GameScene):

```js
// In MainMenuScene.create():
if (this.cache.audio.exists('bgm_menu')) {
    this._bgm = this.sound.add('bgm_menu', { loop: true, volume: 0.55 });
    this._bgm.play();
}
// In shutdown():
this._bgm?.stop();
```

---

## 4. Particle Effects System

**File:** `src/systems/ParticleEffects.js`

### What it does

Fires real Kenney particle textures (81 PNG files) on game events using Phaser 3.60+ built-in particle emitter API.

### How it works

```js
// In GameScene.create():
this.particleEffects = new ParticleEffects(this);
this.particleEffects.init();
```

`init()` subscribes to EventBus events. When `spell-cast` fires:

```js
_onSpellCast(data) {
    const element = data?.spell?.element || data?.element || 'arcane';
    const cfg     = ELEMENT_FX[element] || ELEMENT_FX.arcane;
    this._burst(player.x, player.y, cfg, 18);
}
```

`_burst(x, y, cfg, count)` uses the Phaser 3.60+ one-shot emitter:

```js
const emitter = scene.add.particles(x, y, textureKey, {
    speed:    { min: cfg.speed * 0.4, max: cfg.speed },
    scale:    cfg.scale,
    lifespan: cfg.lifespan,
    tint:     cfg.tint,
    alpha:    { start: 1, end: 0 },
    angle:    { min: 0, max: 360 },
    depth:    4500,
    emitting: false,
});
emitter.explode(count, x, y);
// Auto-destroy after effect completes
scene.time.delayedCall(cfg.lifespan + 200, () => emitter.destroy());
```

### Element → texture mapping

Every spell element has its own particle config with matching Kenney textures:

| Element | Textures | Tint |
|---------|----------|------|
| fire | `particle_fire_01`, `particle_flame_01` | orange `0xff4400` |
| arcane | `particle_magic_01`, `particle_flare_01` | purple `0xaa44ff` |
| thunder | `particle_spark_06/07`, `particle_circle_05` | yellow `0xffff00` |
| shadow | `particle_smoke_01/02`, `particle_symbol_01` | dark purple `0x330066` |
| water/ice | `particle_circle_03/04`, `particle_trace_03/04` | blue `0x4488ff` |
| nature/verdant | `particle_circle_01/02`, `particle_spark_01/02` | green `0x44dd44` |

### Fallback

If the texture isn't loaded, `_graphicsBurst` draws animated tween circles instead — the game never breaks if assets are missing.

---

## 5. UI Framework Rebuild

**File:** `src/ui/UIFramework.js`

### What changed

The 4 core factory methods were upgraded to use the **Kenney UI Pack RPG Expansion** atlas (`ui_rpg`). All 19+ UI panels in the game use these methods, so upgrading here upgrades every panel simultaneously.

### createButton

**Before:** plain `graphics.fillRoundedRect`
**After:** Phaser `NineSlice` using atlas frame `buttonLong_brown.png`

```js
const btnImg = scene.add.nineslice(0, 0, 'ui_rpg', 'buttonLong_brown.png', width, height, 14, 14, 0, 0);
// Hover: setTint(0xdddddd)
// Press: setFrame('buttonLong_brown_pressed.png') + label shifts down 2px
// Release: setFrame back to normal + clearTint
// On pointerdown: EventBus.emit('ui:buttonClick')  ← triggers AudioManager sfx
```

**Available variants** via `atlasVariant` config option:
- `'brown'` (default, warm prominent)
- `'blue'` (cool, secondary actions)
- `'beige'` (neutral)
- `'grey'` (disabled-looking)

### createProgressBar

**Before:** plain graphics fill rectangle
**After:** NineSlice track + NineSlice fill bar that resizes

```js
// Track (always full width)
const track = scene.add.nineslice(0, 0, 'ui_rpg', 'barBack_horizontalMid.png', width, h, 9, 9, 0, 0).setOrigin(0,0);

// Fill (resizes on setValue)
const fillBar = scene.add.nineslice(0, 0, 'ui_rpg', fillVariant.mid, 1, h, 4, 4, 0, 0).setOrigin(0,0);

container.setValue = (val, max) => {
    const fillW = Math.floor(width * (val / max));
    fillBar.setSize(fillW, h).setVisible(fillW > 1);
};
```

**Bar color → atlas frame mapping:**

| Theme color | Atlas frames used |
|-------------|-------------------|
| `theme.success` (green HP) | `barGreen_horizontal*` |
| `theme.primary` (blue mana) | `barBlue_horizontal*` |
| `theme.danger` (red damage) | `barRed_horizontal*` |
| `theme.accent` (yellow XP) | `barYellow_horizontal*` |

### createSlot

**Before:** graphics rounded rect with `fillRoundedRect`
**After:** `panelInset_beige.png` NineSlice + a separate graphics layer for rarity border overlay

```js
// Slot base — atlas nineslice
bg = scene.add.nineslice(0, 0, 'ui_rpg', 'panelInset_beige.png', size, size, 10, 10, 10, 10).setOrigin(0,0);

// Rarity border — separate Graphics on top, drawn with lineStyle + strokeRect
_drawRarityBorder(rarityColor);
```

### createPanel

**Before:** graphics background + graphics title bar
**After:** `panel_brown.png` NineSlice (6px borders) + `panelInset_brown.png` title strip

```js
const panelImg = scene.add.nineslice(0, 0, 'ui_rpg', 'panel_brown.png', width, height, 6, 6, 6, 6).setOrigin(0,0);
```

### NineSlice explained

`scene.add.nineslice(x, y, texture, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight)`

The 9-slice technique divides an image into 9 regions. Corner regions stay fixed size; edge and center regions stretch. This lets one 190×49px button frame render at any width without distortion.

For `buttonLong_brown.png` (190×49 px):
- `leftWidth: 14` — fixes the 14px left rounded cap
- `rightWidth: 14` — fixes the 14px right rounded cap
- Middle stretches freely to any button width

---

## 6. Physics System

**File:** `src/systems/PhysicsSystem.js`

### What it does

Replaces the game's basic physics with a proper game-aware system covering smooth player movement, weighted knockback, zone-based speed modifiers, projectile management, and status effects.

### Initialization

```js
// In GameScene.create(), AFTER _createPlayer():
this.physicsSystem = new PhysicsSystem(this);
this.physicsSystem.init();
// init() reconfigures the player body:
player.setDamping(false);
player.setDragX(600);
player.setDragY(600);
player.setMaxVelocity(280);
```

### Player Movement — Acceleration Model

**Before (old):**
```js
this.player.setVelocity(vx, vy);  // instant snap to target speed
```

**After (new):**
```js
// GameScene._handleMovement():
this.physicsSystem.applyPlayerMovement(this.player, ix, iy, baseSpeed);

// Inside PhysicsSystem:
const ACCEL = 2200;  // px/s²
player.setAcceleration(nx * ACCEL, ny * ACCEL);
player.setMaxVelocity(speed);
// setDragX/Y(600) naturally decelerates when no input
```

**Why this is better:** Acceleration-based movement means the player takes a few frames to reach full speed (natural feel) and decelerates smoothly when keys are released. Direct `setVelocity` was instant, which felt stiff.

### Knockback — Weight Classes

```js
static KNOCKBACK = {
    light:     { force: 90,  duration: 180 },  // normal hits
    medium:    { force: 180, duration: 280 },  // fire/physical spells
    heavy:     { force: 300, duration: 420 },  // thunder/void spells
    explosive: { force: 450, duration: 600 },  // boss abilities
};
```

How it works:
1. `applyKnockback(enemy, sourceX, sourceY, 'heavy')` calculates angle from source → enemy
2. Stores `{ vx, vy, elapsed: 0, duration: 420 }` in `_knockbacks` Map
3. Every `update(delta)`: velocity = `force × (1 - t²)` where `t` = progress 0→1
4. Quadratic falloff means knockback decelerates naturally rather than cutting off sharply
5. When duration expires, entry is deleted and enemy AI resumes control

### Zone Speed Modifiers

```js
static ZONE_SPEED = {
    void: 0.7,   corruption: 0.7,   // heavily slowed
    forest: 0.8, grove: 0.85,       // vegetation slows movement
    dungeon: 0.9, exploration: 0.9, // moderate
    hub: 1.0, boss: 1.0,            // full speed
};
```

When `zone-entered` fires, `_onZoneEnter` updates `_zoneSpeedMult`. The player's effective max velocity becomes `baseSpeed × zoneSpeedMult` on the next movement frame.

### Projectile System

```js
this.physicsSystem.fireProjectile({
    originX: player.x, originY: player.y,
    angle: Math.atan2(dy, dx),   // radians toward target
    speed: 500,
    textureKey: 'particle_magic_01',
    tint: 0xaa44ff,
    size: 12,
    range: 700,
    targets: this.enemies,       // Phaser group for overlap detection
    onHit: (target, proj) => {
        EventBus.emit('enemy-damaged', { enemy: target });
    }
});
```

Projectiles are tracked in `_projectiles[]`. Each frame: check `elapsed > lifetime` and `distance > range`; destroy if either exceeded. Phaser handles the physics velocity and overlap callbacks.

Also supports **homing projectiles:**
```js
this.physicsSystem.fireHomingProjectile({
    ...baseConfig,
    target: bossSprite,
    turnSpeed: 3.0  // how aggressively it steers
});
```

### Slow Status Effect

```js
// Poison bolt slows target for 3 seconds:
this.physicsSystem.applyPlayerSlow(0.5, 3000);  // 50% speed for 3s

// Multiple slows stack — largest slow wins
// e.g. 0.5 + 0.7 active = player moves at 0.5×
```

### Player Knockback

When `player-damaged` fires (from enemy attack), PhysicsSystem:
1. Calculates angle away from attacker
2. Calls `applyKnockback(player, attackerX, attackerY, 'light')`
3. Triggers `cameras.main.shake(90, 0.004)` for impact feel
4. `_handleMovement` checks `isKnockedBack(player)` and skips acceleration during knockback frames

---

## 7. Scene Upgrades

### CharacterSheetScene — Real Portrait Images

**Before:** colored rectangle filled with the class hex color
**After:** tries to load a real portrait texture first

```js
const CLASS_PORTRAIT = {
    bloomguard:  'portrait_companion_vaeril',
    thornbinder: 'portrait_companion_aeliana',
};
const portraitKey = CLASS_PORTRAIT[classId] || `portrait_${classId}`;
const hasPortrait  = this.textures.exists(portraitKey);

if (hasPortrait) {
    // Real image displayed at portW×portH
    const portImg = this.add.image(portX + portW/2, portY + portH/2, portraitKey)
        .setDisplaySize(portW, portH).setDepth(D).setScrollFactor(0);
    this._contentTexts.push(portImg);  // tracked for tab-switch cleanup
} else {
    // Fallback: old colored rect + class name text
}
```

### CompanionPanel — Real Companion Portraits

Uses a name-to-key convention: companion named "Vaeril" → key `portrait_companion_vaeril`

```js
const nameKey = companion.name.toLowerCase().replace(/\s+/g, '_');
const portKey = `portrait_companion_${nameKey}`;
if (scene.textures.exists(portKey)) {
    scene.add.image(cx, cy, portKey).setDisplaySize(40, 40);
} else {
    // Initials text fallback
}
```

### GameScene — Enemy Animation Wiring

**Attack animation** (plays when enemy hits player):
```js
const ATTACK_ANIM = {
    enemy_treetitan:      'enemy_treetitan-attack',
    enemy_corrupted_titan: 'enemy_treetitan-attack',
};
enemy.play(atkAnim);
enemy.once(ANIMATION_COMPLETE, () => enemy.play(walkAnim));
```

**Death animation** (plays before sprite is destroyed):
```js
const DEATH_ANIM = {
    enemy_treetitan: 'enemy_treetitan-death',
};
if (deathAnim && this.anims.exists(deathAnim)) {
    enemy.setVelocity(0, 0);
    enemy.body.setEnable(false);    // disable physics so no sliding
    enemy.play(deathAnim);
    enemy.once(ANIMATION_COMPLETE, _doDestroy);  // destroy only after anim
} else {
    _doDestroy();  // fallback: instant destroy
}
```

---

## 8. Asset Integration

### What was loaded

Everything is preloaded in `BootScene.js`. The load chain:

1. **Tilesets** — Kenney Tiny Town + Tiny Dungeon (16×16 tile sheets)
2. **UI Atlas** — `uipack_rpg_sheet.png` + `.xml` (XML atlas = frame names map to regions)
3. **Particle textures** — 57 individual PNGs from Kenney Particle Pack
4. **VFX sheets** — 35 spell/combat animation strips
5. **BGM** — 8 OGG tracks
6. **SFX** — 64 OGG sound effects
7. **Enemy sprites** — treetitan (walk/attack/death), corrupted titan, tree idle
8. **Character sprites** — `player_all_actions`, `player_swordattack`
9. **Portraits** — companion portraits (Vaeril, Aeliana), enemy portraits, NPC portrait

### How the XML atlas works

Phaser loads the atlas as a single texture with named frames:
```js
this.load.atlas('ui_rpg', 'assets/ui/Spritesheet/uipack_rpg_sheet.png',
                          'assets/ui/Spritesheet/uipack_rpg_sheet.xml');
```

The XML maps frame names to pixel coordinates in the sheet:
```xml
<SubTexture name="buttonLong_brown.png" x="0" y="49" width="190" height="49"/>
```

Use frames anywhere in Phaser:
```js
scene.add.image(x, y, 'ui_rpg', 'buttonLong_brown.png');
scene.add.nineslice(x, y, 'ui_rpg', 'panel_brown.png', w, h, 6, 6, 6, 6);
```

### Asset licenses

| Pack | License |
|------|---------|
| Kenney UI Pack RPG Expansion | CC0 Public Domain |
| Kenney Particle Pack | CC0 Public Domain |
| Kenney Tiny Town | CC0 Public Domain |
| Kenney Tiny Dungeon | CC0 Public Domain |
| RPGVXAce / "In Search of Immortality" audio | RPG Maker RTP EULA |
| Character/enemy spritesheets | Custom AI-generated |

---

## 9. Architecture: How Everything Connects

```
BootScene
  └── Loads ALL assets (tilesets, atlas, particles, vfx, audio, sprites)
  └── Registers ALL animations (player-idle, player-walk, enemy-treetitan-*, etc.)
  └── Starts → MainMenuScene

MainMenuScene
  └── Plays bgm_menu
  └── Atlas buttons (ui_rpg)
  └── → ClassSelectionScene → GameScene

GameScene (main scene)
  ├── ZoneTilemapBuilder   — renders 27 zones in 3-column grid
  ├── AudioManager         — EventBus → sound mapping (wireToGame)
  ├── ParticleEffects      — EventBus → particle bursts
  ├── PhysicsSystem        — knockback, movement, zones, projectiles
  ├── UIFramework          — panel factory (all 19 UI panels)
  │     ├── createButton   — atlas nineslice + SFX
  │     ├── createProgressBar — atlas bar frames
  │     ├── createSlot     — atlas panelInset
  │     └── createPanel    — atlas panel_brown
  └── 20+ other systems (combat, quests, companions, crafting, etc.)

UIScene (overlay, always running)
  └── HUDPanel, InventoryPanel, SpellbookPanel, etc.
      All built via UIFramework.createButton/createPanel/createSlot
```

---

## 10. EventBus — The Nervous System

**File:** `src/core/EventBus.js`

The EventBus is the communication backbone. Every system fires events; every other system listens. No direct references between systems.

### Key events

| Event | Emitted by | Listened by |
|-------|------------|-------------|
| `spell-cast` | GameScene | AudioManager, ParticleEffects, PhysicsSystem |
| `enemy-damaged` | GameScene | AudioManager, ParticleEffects, PhysicsSystem |
| `player-damaged` | GameScene | AudioManager, ParticleEffects, PhysicsSystem |
| `zone-entered` | GameScene/ZoneContentManager | AudioManager, PhysicsSystem |
| `tactical:combatStarted` | TacticalCombatSystem | AudioManager |
| `player:levelUp` | ProgressionSystem | ParticleEffects, AudioManager |
| `ui:buttonClick` | UIFramework, MainMenuScene | AudioManager |
| `ui:menuOpen` | UIFramework.showPanel | AudioManager |
| `ui:menuClose` | UIFramework.hidePanel, panel X button | AudioManager |
| `physics:zoneSpeedChanged` | PhysicsSystem | (HUD, future speed indicator) |
| `player-stats-updated` | GameScene | UIScene/HUDPanel, CharacterSheetScene |

### Subscription pattern

```js
// Subscribe — eb.on() returns an unsubscribe function
const unsub = EventBus.on('spell-cast', (data) => handleSpell(data));

// Store it and call in destroy/shutdown to prevent leaks:
this._unsubs = [unsub, ...moreUnsubs];
// On destroy:
this._unsubs.forEach(fn => fn());
```

This is critical — every system cleans up its EventBus subscriptions on destroy.

---

## 11. File Map

```
src/
├── core/
│   ├── EventBus.js              ← singleton pub/sub, backbone of all communication
│   └── GameConfig.js            ← WIDTH, HEIGHT, other constants
│
├── engine/
│   └── PhysicsLayer.js          ← low-level arcade physics wrapper (collision groups, raycasts)
│
├── systems/
│   ├── AudioManager.js          ← sound + music, wireToGame() event→sound mapping
│   ├── ParticleEffects.js       ← Kenney particle bursts on game events
│   ├── PhysicsSystem.js         ← NEW: knockback, acceleration, zones, projectiles
│   ├── ZoneTilemapBuilder.js    ← NEW: builds every zone's visual from tileset or Graphics
│   ├── TacticalCombatSystem.js  ← turn-based combat overlay
│   ├── CompanionSystem.js       ← companion party management
│   ├── CraftingSystem.js        ← crafting recipes + UI
│   ├── ProgressionSystem.js     ← XP, levelling, skill unlocks
│   ├── SpellSystem.js           ← spell execution, element effects, cooldowns
│   ├── QuestSystem.js           ← quest tracking, completion, rewards
│   └── ...16 more systems
│
├── scenes/
│   ├── BootScene.js             ← ALL asset loading + animation registration
│   ├── MainMenuScene.js         ← menu + save slot picker (atlas buttons + bgm)
│   ├── GameScene.js             ← main gameplay (world, player, enemies, input, update)
│   ├── CharacterSheetScene.js   ← full-screen character stats overlay
│   ├── ClassSelectionScene.js   ← class picker before game starts
│   └── ...5 more scenes
│
├── ui/
│   ├── UIFramework.js           ← createButton / createProgressBar / createSlot / createPanel
│   ├── HUDPanel.js              ← HP/mana/sap bars, spell slots, minimap
│   ├── InventoryPanel.js        ← grid inventory with drag-drop
│   ├── CompanionPanel.js        ← party management, companion portraits
│   ├── SpellbookPanel.js        ← spell list, equip slots
│   └── ...14 more panels
│
└── components/
    ├── Player.js                ← player state, input, animation
    └── NPC.js                   ← NPC dialogue + interaction

public/assets/
├── audio/bgm/                   ← 8 OGG music tracks
├── audio/sfx/                   ← 64 OGG sound effects
├── ui/Spritesheet/              ← uipack_rpg_sheet.png + .xml (Kenney UI atlas)
├── vfx/particles/               ← 81 Kenney particle PNGs
├── vfx/spells/                  ← 35 spell/combat VFX strips
├── tilesets/tiny_town/          ← Kenney Tiny Town 16×16 tilesheet
├── tilesets/tiny_dungeon/       ← Kenney Tiny Dungeon 16×16 tilesheet
└── sprites/
    ├── characters/              ← player, companions
    └── enemies/                 ← treetitan, corrupted titan, mushroom, etc.

docs/
├── WHAT_WE_BUILT.md             ← THIS FILE
├── ASSET_REGISTRY.md            ← full asset inventory with file paths + load keys
├── ARCHITECTURE.md              ← system architecture overview
├── DESIGN_DOCUMENT_ANALYSIS.md ← game design spec analysis
└── ...12 more docs
```

---

## Quick Reference: How to Add a New System

1. **Create** `src/systems/MySystem.js` — export default class, constructor takes `scene`
2. **Subscribe** to EventBus in an `init()` method, store unsub functions
3. **Unsubscribe** in `destroy()` by calling all stored unsub functions
4. **Import + init** in `GameScene.create()` after player is spawned
5. **Call `update(delta)`** in GameScene's update loop if needed
6. **Call `destroy()`** in GameScene's shutdown

## Quick Reference: How to Add a New UI Panel

1. **Create** `src/ui/MyPanel.js` — use `UIFramework.createPanel`, `createButton`, `createSlot` for all UI elements
2. **Register** with `UIFramework.getInstance().registerPanel('myPanel', panelContainer)` in UIScene
3. **Show/hide** with `UIFramework.showPanel('myPanel', data)` / `hidePanel('myPanel')`
4. **Audio comes free** — button clicks, panel open/close already emit the right EventBus events that AudioManager handles

## Quick Reference: How to Add a New Sound

1. Add the OGG file to `public/assets/audio/sfx/` or `bgm/`
2. Load in `BootScene.js`: `this.load.audio('sfx_mySound', 'assets/audio/sfx/MyFile.ogg')`
3. Either call `audioManager.playSFX('sfx_mySound')` directly, or add an EventBus mapping in `AudioManager.wireToGame()`
