

# Realm of Nexus — Asset Registry & Session Work Log

> Last updated: 2026-03-31 | Session: Asset Integration + Zone Tilemap + Audio + VFX

---

## What Was Built This Session

### 1. Zone Tilemap System (`src/systems/ZoneTilemapBuilder.js`)

Replaced the old placeholder graphics-rectangle world with a real rendered world.

**How it works:**
- Every zone now has a proper visual based on its type
- Town/dungeon zones use **Kenney Tiny Town + Tiny Dungeon** 16×16 tilemaps (3 layers: floor, wall, deco)
- All other zone types use an **enhanced Graphics renderer** with zone-specific art

| Zone Type | Renderer | Visual Style |
|-----------|----------|-------------|
| `hub`, `market`, `military` | Kenney tilemap | Grass/cobblestone floor, building walls, props |
| `dungeon`, `underground_city` | Kenney tilemap | Stone floor, double-thick walls, corridors |
| `grove`, `exploration`, `forest` | Enhanced Graphics | Dark green + foliage patches + dirt path cross |
| `temple`, `sacred`, `shrine` | Enhanced Graphics | Checkerboard stone + altar platform + columns + glowing rune |
| `boss` | Enhanced Graphics | Arena circle with radial spokes + summoning ring + bloody cracks |
| `hidden` | Enhanced Graphics | Crystal formations + portal ring + mist pockets |
| `void`, `corruption` | Enhanced Graphics | Fractured tiles + corruption veins + singularity |

**World height bug fixed** — was hardcoded to 1800px (fits 6 zones), now dynamically calculates:
```js
const rowCount   = Math.ceil(locations.length / ZONE_COLS);
const worldHeight = rowCount * 900;
```
All 27 zones are now visible and reachable.

---

### 2. Audio System Wiring (`src/systems/AudioManager.js` + `src/scenes/GameScene.js`)

The existing `AudioManager` was never connected to the game. Added `wireToGame(scene)` method that maps every game event to the correct sound automatically.

**Event → Sound mapping:**

| Game Event | Sound |
|------------|-------|
| `spell-cast` (fire element) | `sfx_fire1/2/3` (random) |
| `spell-cast` (arcane) | `sfx_magic1-5` (random) |
| `spell-cast` (thunder) | `sfx_thunder1/2/3` (random) |
| `spell-cast` (heal/radiant) | `sfx_saint1/2` or `sfx_chime1` |
| `enemy-damaged` | `sfx_damage1/2/3` (random) |
| `player-damaged` | `sfx_blow1/2` or `sfx_damage1` |
| `enemy-defeated` | `sfx_collapse1` |
| `player:healed` | `sfx_heal1/2/3` (random) |
| `player:levelUp` | `sfx_levelup` |
| `ui:buttonClick` | `sfx_cursor1` |
| `ui:menuOpen/Close` | `sfx_cursor2` / `sfx_cancel1` |
| `ui:notification` | `sfx_chime2` |
| `ui:questComplete` | `sfx_chime1` |
| `item:pickup` / `currency:gained` | `sfx_coin` |
| `game:saved` | `sfx_save` |
| `portal:activated` | `sfx_teleport` |
| `player:died` | BGM fades → `bgm_gameover` after 2s |
| `tactical:combatStarted` | Crossfade to `bgm_battle` |
| `tactical:combatEnded` | Crossfade back to zone BGM |
| `zone-entered` (town type) | Crossfade to `bgm_town` |
| `zone-entered` (dungeon type) | Crossfade to `bgm_dungeon` |
| `zone-entered` (boss type) | Crossfade to `bgm_boss` |
| `zone-entered` (default) | Crossfade to `bgm_exploration` |

---

### 3. Particle Effects System (`src/systems/ParticleEffects.js`)

New system that fires real Kenney particle textures on game events using Phaser 3.60+ built-in particle API.

| Event | Effect | Texture Set |
|-------|--------|-------------|
| `spell-cast` (fire) | Orange burst | `particle_fire_01`, `particle_flame_01` |
| `spell-cast` (arcane) | Purple burst | `particle_magic_01`, `particle_flare_01` |
| `spell-cast` (shadow) | Dark smoke | `particle_smoke_01`, `particle_symbol_01` |
| `spell-cast` (thunder) | Yellow sparks | `particle_spark_06/07`, `particle_circle_05` |
| `spell-cast` (nature/verdant) | Green sparks | `particle_circle_01`, `particle_trace_01` |
| `spell-cast` (water/ice) | Blue circles | `particle_circle_03/04`, `particle_trace_03` |
| `enemy-damaged` | Orange spark burst | `particle_spark_01-03`, `particle_scorch_01` |
| `player-damaged` | Orange spark burst | Same as above |
| `player:healed` | Green star rise | `particle_star_03/04`, `particle_light_02` |
| `player:levelUp` | Gold star explosion (30 particles) | `particle_star_01/05`, `particle_twirl_03` |

Falls back to animated graphics circles if textures aren't loaded.

---

## Complete Asset Inventory

### Audio — 72 Files

#### BGM (Music) — `public/assets/audio/bgm/`

| File | Source | Used For |
|------|--------|----------|
| `battle.ogg` | Sonancy Designs — "A Battle Awaits" | Overworld/tactical combat |
| `boss.ogg` | In Search of Immortality — F-boss | Boss encounters, hidden zones |
| `dungeon.ogg` | In Search of Immortality — F-regular | Dungeon, underground zones |
| `exploration.ogg` | Tyler Cline — "The Voice of the Wind" | Grove, forest, exploration zones |
| `gameover.ogg` | In Search of Immortality — Gameover1 | Player death screen |
| `menu.ogg` | Joel Steudler — "Opening The Portal" | Main menu |
| `town.ogg` | TK Projects — DFRM1_BGM09_Field_Town | Hub, market, military zones |
| `victory.ogg` | In Search of Immortality — Victory1 | Combat victory |

#### SFX (Sound Effects) — `public/assets/audio/sfx/` — 64 files

**Combat:**
`Attack1-3`, `Blow1-4`, `Collapse1-2`, `Damage1-3`, `Slash1-12`, `Sword1-5`

**Spells by Element:**
`Fire1-3`, `Ice1-3`, `Thunder1-12`, `Wind1-11`, `Water1-6`, `Heal1-7`, `Magic1-7`, `Skill1-3`, `Saint1-9`, `Teleport`, `Poison`, `Recovery`

**UI & Events:**
`Bell1-3`, `Cancel1-2`, `Chime1-2`, `Coin`, `Cursor1-2`, `Powerup`, `Save`, `Up1-4` (level up)

---

### UI Assets — `public/assets/ui/`

**Source:** Kenney UI Pack RPG Expansion (CC0 — free to use commercially)

| File | Contents | Loaded As |
|------|----------|-----------|
| `Spritesheet/uipack_rpg_sheet.png` | 90 UI elements | `ui_rpg` atlas |
| `Spritesheet/uipack_rpg_sheet.xml` | Frame name map | (atlas descriptor) |

**What's in the atlas (use with `scene.textures.get('ui_rpg').getFrame('name.png')`):**

- Buttons: `button_01.png` – `button_06.png` (various states)
- Checkboxes: `checkBox.png`, `checkMark.png`
- Sliders: `slider.png`, `sliderLeft.png`, `sliderRight.png`, `sliderHandle.png`
- Progress bars: `barBack_horizontalLeft.png`, `barBlue_horizontalLeft.png`, `barRed_mid.png`, etc.
- Panels: `panel_brown.png`, `panel_blue.png`, `panel_beige.png`, `panel_beigeLight.png`
- Icons: `arrowBlue_left.png`, `arrowBrown_right.png`, `iconCross.png`
- Tooltips: `tooltipBorder.png`
- Inventory: `inventoryItemBack_*.png`

---

### VFX Assets

#### Spell/Combat Spritesheets — `public/assets/vfx/spells/` and `public/assets/vfx/combat/`

**Source:** RPGVXAce star-stealing-prince pack (already on desktop)

| Key | File | Type |
|-----|------|------|
| `vfx_fire1/2/3` | `vfx_fire1.png` etc | Fire spell animation |
| `vfx_ice1/2/3` | `vfx_ice1.png` etc | Ice spell animation |
| `vfx_thunder1/2/3` | `vfx_thunder1.png` etc | Thunder spell animation |
| `vfx_wind1/2` | `vfx_wind1.png` etc | Wind spell animation |
| `vfx_water1/2` | `vfx_water1.png` etc | Water spell animation |
| `vfx_heal1/2/3` | `vfx_heal1.png` etc | Healing animation |
| `vfx_light1/2` | `vfx_light1.png` etc | Light/radiant spell |
| `vfx_darkness1/2` | `vfx_darkness1.png` etc | Shadow/void spell |
| `vfx_earth1/2` | `vfx_earth1.png` etc | Nature/earth spell |
| `vfx_special1-4` | `vfx_special1.png` etc | Special abilities |
| `vfx_attack1/2/3` | `vfx_attack1.png` etc | Melee attack |
| `vfx_blow1/2` | `vfx_blow1.png` etc | Impact hit |
| `vfx_sword1/2/3` | `vfx_sword1.png` etc | Sword strike |
| `vfx_death1` | `vfx_death1.png` | Enemy death |

#### Particle Textures — `public/assets/vfx/particles/PNG (Transparent)/` — 81 files

**Source:** Kenney Particle Pack (CC0 — free to use commercially)

Loaded with `particle_` prefix (e.g. `particle_fire_01`, `particle_spark_03`):

| Category | Files |
|----------|-------|
| Fire/Flame | `fire_01/02`, `flame_01-06` |
| Magic | `magic_01-05`, `flare_01` |
| Sparks | `spark_01-07` |
| Smoke | `smoke_01-10` |
| Stars | `star_01-09` |
| Circles | `circle_01-05` |
| Traces/Trails | `trace_01-07` |
| Twirls | `twirl_01-03` |
| Symbols | `symbol_01-02` |
| Slashes | `slash_01-04` |
| Lights | `light_01-03` |
| Scorch/Dirt | `scorch_01-02`, `dirt_01-02` |

---

### Sprites Added This Session

#### New Enemy Spritesheets — `public/assets/sprites/enemies/`

| File | Source | Loaded As | Frames |
|------|--------|-----------|--------|
| `enemy_treetitan_walk.png` | godot desktop | `enemy_treetitan` | 6×10 = 60 frames |
| `enemy_treetitan_attack.png` | godot desktop | `enemy_treetitan_attack` | 6×5 = 30 frames |
| `enemy_treetitan_death.png` | godot desktop | `enemy_treetitan_death` | 5×6 = 30 frames |
| `enemy_corrupted_titan_walk.png` | godot desktop | `enemy_corrupted_titan` | 5×7 = 35 frames |
| `enemy_tree_idle.png` | godot desktop | `enemy_tree_idle` | 8×13 = 104 frames |

#### New Enemy Portraits — `public/assets/sprites/enemies/`

| File | Used For |
|------|----------|
| `portrait_corrupted_bloomguard.png` | Enemy/boss dialogue portrait |
| `portrait_corrupted_hero.png` | Enemy/boss dialogue portrait |
| `portrait_mushroom_berserker.png` | Mushroom enemy portrait |

#### New Character Sprites — `public/assets/sprites/characters/`

| File | Loaded As | Frames | Used For |
|------|-----------|--------|----------|
| `player_all_actions.png` | `player_all_actions` | 6×11 = 66 frames | Full player action set |
| `player_swordattack.png` | `player_swordattack` | 7×9 = 63 frames | Sword attack animation |
| `portrait_companion_vaeril.png` | `portrait_companion_vaeril` | — | Companion dialogue |
| `portrait_companion_aeliana.png` | `portrait_companion_aeliana` | — | Companion dialogue |

#### NPC Portraits — `public/assets/sprites/npcs/`

| File | Used For |
|------|----------|
| `portrait_veilkeeper.png` | Veilkeeper NPC dialogue |

---

### New Animations Registered in BootScene

| Key | Spritesheet | Frames | Use |
|-----|-------------|--------|-----|
| `enemy_treetitan-attack` | `enemy_treetitan_attack` | 0–29, 10fps | Attack animation |
| `enemy_treetitan-death` | `enemy_treetitan_death` | 0–24, 8fps | Death animation |
| `enemy_tree-idle` | `enemy_tree_idle` | 0–23, 6fps | Ambient idle |
| `player-sword` | `player_swordattack` | 0–62, 14fps | Sword attack |

---

## Files Modified This Session

| File | What Changed |
|------|-------------|
| `src/systems/ZoneTilemapBuilder.js` | **New file** — full tilemap/graphics zone renderer |
| `src/systems/ParticleEffects.js` | **New file** — Kenney particle burst system |
| `src/systems/AudioManager.js` | Added `wireToGame()` + `unwireFromGame()` — event → audio mapping |
| `src/scenes/BootScene.js` | Added loading for: Kenney tilesets, new sprites, 72 audio files, UI atlas, 55 particle textures, 35 VFX sheets |
| `src/scenes/GameScene.js` | Fixed world height bug; uses `ZoneTilemapBuilder`; added `AudioManager` + `ParticleEffects` init/destroy |

---

## How To Use the UI Atlas in a Panel

```js
// In any UI scene or component:
const frame = scene.textures.get('ui_rpg').getFrame('button_03.png');

// Or directly in add.image:
scene.add.image(x, y, 'ui_rpg', 'button_03.png');

// Or in NineSlice for scalable panels:
scene.add.nineslice(x, y, 'ui_rpg', 'panel_brown.png', width, height, 6, 6, 6, 6);
```

## How To Trigger a Particle Burst Manually

```js
// From anywhere with EventBus access:
EventBus.emit('spell-cast', { element: 'fire', x: player.x, y: player.y });
EventBus.emit('enemy-damaged', { x: enemy.x, y: enemy.y });
EventBus.emit('player:healed', { x: player.x, y: player.y });
```

## How To Play Audio Manually

```js
// AudioManager is a singleton accessible anywhere in GameScene:
this.audioManager.playSFX('sfx_fire1', { volume: 0.8 });
this.audioManager.playMusic('bgm_battle', { crossfade: 1.5 });
```

---

## Asset Licenses

| Pack | License | Source |
|------|---------|--------|
| Kenney UI Pack RPG Expansion | CC0 (Public Domain) | kenney.nl |
| Kenney Particle Pack | CC0 (Public Domain) | kenney.nl |
| Kenney Tiny Town | CC0 (Public Domain) | kenney.nl |
| Kenney Tiny Dungeon | CC0 (Public Domain) | kenney.nl |
| RPGVXAce / "In Search of Immortality" audio | RPG Maker RTP (see license in pack) | Your desktop |
| Joel Steudler — Opening The Portal | Per EULA in pack folder | Your desktop |
| Sonancy Designs — A Battle Awaits | Per EULA in pack folder | Your desktop |
| Tyler Cline — Voice of the Wind | Per EULA in pack folder | Your desktop |
| TK Projects — Field Town BGM | Per EULA in pack folder | Your desktop |
| Enemy/Player spritesheets (godot folder) | Custom AI-generated (your assets) | Your desktop |
