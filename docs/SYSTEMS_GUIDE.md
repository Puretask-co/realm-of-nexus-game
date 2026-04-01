# Realm of Nexus — Systems & Features Guide
> How every system works, how they connect, and how they combine to create a fun experience.
> Updated: 2026-03-31

---

## Table of Contents

1. [The Big Picture — What Kind of Game Is This?](#1-the-big-picture)
2. [The Core Loop](#2-the-core-loop)
3. [The Nervous System — EventBus](#3-the-nervous-system--eventbus)
4. [The World Clock — SapCycleManager](#4-the-world-clock--sapcyclemanager)
5. [The Player](#5-the-player)
6. [Movement & Physics — PhysicsSystem](#6-movement--physics--physicssystem)
7. [Combat — Spells, Attacks, and Tactical Mode](#7-combat)
8. [Enemies & AI](#8-enemies--ai)
9. [Companions](#9-companions)
10. [Zones & The World](#10-zones--the-world)
11. [Progression — Class, Attributes, XP, Skills](#11-progression)
12. [The Economy — Gold, Shops, Crafting, Stash](#12-the-economy)
13. [The Story Engine](#13-the-story-engine)
14. [Quests & Factions](#14-quests--factions)
15. [The Veil & DSP System](#15-the-veil--dsp-system)
16. [Audio — Music & Sound](#16-audio)
17. [Visual Feedback — Particles & Lighting](#17-visual-feedback)
18. [The HUD & UI System](#18-the-hud--ui-system)
19. [Save & Load](#19-save--load)
20. [Debug & Editor Tools](#20-debug--editor-tools)
21. [How Everything Connects — The Full Web](#21-how-everything-connects)
22. [The Fun — Why It All Works Together](#22-the-fun)

---

## 1. The Big Picture

**Realm of Nexus: Verdance** is a top-down action RPG with tactical depth. The player explores a living world where:

- **Time itself is a mechanic** — the world cycles through three magical phases (Crimson, Silver, Blue) that reshape combat, costs, portals, and story events
- **Every choice echoes** — moral decisions, faction alignment, and Veilkeeper consultations all feed into 4 endings with 12 variations
- **Combat has layers** — you can fight enemies in real-time with spells and dash, or drop into a full tactical grid-based mode
- **Companions matter** — 5 recruitable characters each have personal questlines and bond mechanics that affect gameplay and narrative

The game is built entirely in **Phaser 3** (HTML5) using an **EventBus pub/sub architecture** — every system is decoupled and communicates through events rather than direct references.

---

## 2. The Core Loop

```
EXPLORE → ENCOUNTER → FIGHT → REWARD → GROW → EXPLORE
```

In detail:

1. **Explore** — Player moves through the zone map (ZoneContentManager), discovers locations, talks to NPCs (DialogueSystem), accepts quests (QuestSystem)
2. **Encounter** — Enemies spawn based on zone type and player proximity (AISystem, ZoneContentManager)
3. **Fight** — Player casts spells (SpellSystem), dashes, engages in real-time or switches to Tactical Mode (TacticalCombatSystem). Companions fight alongside.
4. **Reward** — Enemies drop gold/items (EquipmentSystem, InventoryPanel), quests complete, XP is gained
5. **Grow** — ProgressionSystem handles level-up → AttributeAllocationPanel → SkillTreePanel → new spells unlocked
6. **Explore again** — New zones unlock, factions react, Sap Cycle advances, story branches

The Sap Cycle acts as a **meta-loop on top** — every 15 in-game days the world resets to a new phase, changing what's possible. Portals only appear in Silver phase. Healing is stronger in Blue phase. Combat is deadlier in Crimson phase.

---

## 3. The Nervous System — EventBus

**File:** `src/core/EventBus.js`

The EventBus is a singleton pub/sub system. It is the **only way systems talk to each other**. No system holds a direct reference to another system.

### How It Works

```js
// System A fires an event:
EventBus.emit('player-damaged', { damage: 15, element: 'fire', hp: 85 });

// System B (anywhere in the codebase) responds:
EventBus.on('player-damaged', (data) => { /* react */ });
// Returns an unsub function — call it on destroy to prevent memory leaks
```

### Why This Matters for Fun

Because systems are decoupled, every event can have **multiple unrelated things respond at once**:

| Event | Who Responds |
|-------|-------------|
| `player-damaged` | PhysicsSystem (knockback), AudioManager (hit SFX), UIScene (HP bar update), ParticleEffects (blood/impact burst), Camera (screen shake) |
| `enemy-defeated` | ProgressionSystem (XP), QuestSystem (objective update), AudioManager (death sound), ParticleEffects (death burst), FactionSystem (kill logged) |
| `phase-changed` | PortalSystem (spawn/despawn portals), AudioManager (new BGM), SapCycleLightingIntegration (sky color shift), UIScene (phase flash), all modifiers recalculate |

One action causes a cascade of feedback. That's what makes the world feel alive.

---

## 4. The World Clock — SapCycleManager

**File:** `src/systems/SapCycleManager.js`

The Sap Cycle is the game's **heartbeat**. Every 15 in-game days, the world goes through three phases, each lasting a different number of days:

| Phase | Duration | Combat | Magic | Healing | Shops | Portals |
|-------|----------|--------|-------|---------|-------|---------|
| **Crimson** | 5 days | +20% enemy damage | Higher spell costs | -20% effectiveness | Normal prices | Closed |
| **Silver** | 3 days | Balanced | Balanced | Normal | Discounts | **Open** |
| **Blue** | 7 days | -10% enemy damage | Lower costs | +30% effectiveness | Slight markup | Closed |

### How Time Passes

- 1 real-world minute = 1 in-game hour
- 1 in-game day = 24 minutes real time
- The phase-transition takes 5 seconds visually (lighting shift, color grade, particle color change)

### Events Emitted

| Event | When |
|-------|------|
| `sap-cycle-tick` | Every frame — passes `(phase, progress 0..1)` for HUD clock |
| `sap-hour-passed` | Every in-game hour |
| `sap-day-passed` | Every in-game day — triggers daily events |
| `phase-changed` | When phase flips — triggers massive cascade of reactions |
| `phase-transition` | During the 5-second transition window |

### What It Changes

Every system that cares about the Sap Cycle listens to `phase-changed`:
- **AudioManager** → crossfades to phase BGM
- **PortalSystem** → spawns/destroys portals (Silver only)
- **SpellSystem** → recalculates cost and power modifiers
- **SapCycleLightingIntegration** → shifts ambient light color (warm red / pale silver / cool blue)
- **QuestSystem** → some quests only unlock in specific phases
- **VeilkeeperSystem** → consultation costs change per phase

---

## 5. The Player

**File:** `src/components/Player.js`

The Player component wraps a Phaser physics sprite and manages everything the player character does.

### Stats

| Stat | Purpose |
|------|---------|
| `hp / maxHp` | Health — reach 0 and it's game over |
| `sap / maxSap` | Magic resource for casting spells — regenerates over time |
| `guard / maxGuard` | Shield buffer — absorbs hits before HP is touched (Tactical mode) |
| `ap / maxAP` | Action Points for Tactical combat |
| `might` | Melee damage modifier |
| `agility` | Movement speed and dodge bonuses |
| `resilience` | Defense and HP regeneration |
| `insight` | Spell power and sap regen rate |
| `charisma` | Dialogue checks and faction interactions |

### Actions

- **8-directional movement** (WASD / Arrow keys) with diagonal normalization (no faster diagonals)
- **Dash** (SPACE) — 150ms burst at 2.5x speed, 1 second cooldown — provides brief invincibility
- **Cast spells** (1–5 keys) — checks sap cost + cooldown, fires `spell-cast` event
- **Invincibility frames** — 0.5 seconds after taking damage, with a flicker visual

### How Stats Are Initialized

When GameScene creates the player, it merges class stats with a full defaults object:
```
Final Stats = STAT_DEFAULTS + Class System Stats (class wins on overlap)
```
This guarantees `might`, `guard`, `ap`, etc. always exist even if a class definition doesn't specify them.

---

## 6. Movement & Physics — PhysicsSystem

**File:** `src/systems/PhysicsSystem.js`

The PhysicsSystem sits on top of Phaser's Arcade Physics and adds **game-aware physics** that plain Phaser doesn't have.

### Acceleration-Based Movement

Instead of `player.setVelocity(vx, vy)` (snappy, instant), the player uses:
```
setAcceleration(direction * 2200) + setDrag(600)
```
This gives the player natural momentum — they **ramp up** when moving and **coast to a stop** rather than cutting off instantly. It feels like skating on a responsive surface rather than a robot toggling its motors.

### Knockback System

Four weight classes, each with different force and duration:

| Class | Force | Duration | Used When |
|-------|-------|----------|-----------|
| `light` | 90px/s | 180ms | Default enemy hits on player |
| `medium` | 180px/s | 280ms | Fire/water/physical spells |
| `heavy` | 300px/s | 420ms | Thunder/void/explosive spells |
| `explosive` | 450px/s | 600ms | AOE and boss attacks |

Knockback uses **quadratic falloff** — full force at the start, easing to zero. It feels like being thrown, not teleported.

### Zone Speed Modifiers

Different zone types slow the player:

| Zone Type | Speed Multiplier |
|-----------|-----------------|
| `void`, `corruption` | 70% — the Void is heavy |
| `forest` | 80% — dense undergrowth |
| `grove`, `hidden` | 85% |
| `dungeon`, `temple`, `exploration` | 90% |
| `hub`, `boss`, `market` | 100% |

### Projectile System

`fireProjectile(config)` creates a physics-enabled sprite, sets its velocity from an angle, checks overlaps with target groups, and automatically destroys on range/lifetime expiry.

`fireHomingProjectile(config)` adds a 50ms steering timer that gradually rotates the projectile toward a target using linear interpolation — creates smooth homing rather than instant lock-on.

### Slow Effects

Multiple slow effects stack — the **most severe** one wins. Used by swamp zones, enemy debuffs, and ice spells.

---

## 7. Combat

Combat in Verdance has two layers:

### Real-Time Combat

The default mode. Player and enemies exist in the same physics space.

**Spell casting flow:**
1. Player presses 1–5
2. `Player.castSpell(index)` checks cooldown + sap cost
3. Deducts sap, sets cooldown
4. Fires `spell-cast` event with `{ spell, caster, casterStats, targetPos }`
5. **SpellSystem** receives it → calculates damage with phase modifiers → spawns projectile or AOE
6. **ParticleEffects** receives it → plays element-matched burst at cast position
7. **AudioManager** receives it → plays element-matched SFX
8. On hit: `enemy-damaged` event → PhysicsSystem applies knockback → enemy HP drops → death check

**Attack Types** (AttackTypeSystem):
- Melee: range check, instant, physical damage
- Ranged: projectile spawned via PhysicsSystem.fireProjectile
- Magic: spell damage with element resistance and phase multiplier applied

### Tactical Combat Mode

When triggered (via `tactical:combatStarted`), TacticalCombatSystem takes over:

- Draws a **hexagonal grid** over the current area
- All entities take turns in **initiative order**
- Each turn the player has **Action Points (AP)** to spend on movement, spells, or abilities
- **Guard mechanic** — a shield buffer that absorbs damage before HP
- **Positioning bonuses** — flanking, high ground, adjacency all affect damage
- **Enemy intents** — TacticalCombatPanel shows what each enemy plans to do on its turn
- Ends when all enemies are defeated → fires `tactical:combatEnded` → AudioManager crossfades back to zone BGM

---

## 8. Enemies & AI

**Files:** `src/components/Enemy.js`, `src/systems/AISystem.js`

### Enemy Component

Each enemy has:
- Stats: HP, attack, defense, speed, element, weight class (affects knockback received)
- A floating health bar that tracks above the sprite
- Hit flash (white tint for 100ms on damage)
- Death sequence: plays death animation, disables physics body, destroys after anim completes

### AI Behavior Patterns

AISystem gives each enemy one of 5 behavior patterns:

| Pattern | Behavior |
|---------|---------|
| `aggressive` | Charges player immediately when in range, attacks at every opportunity |
| `defensive` | Retreats when HP below 30%, attacks from range when possible |
| `tactical` | Tries to flank, uses cover, coordinates with nearby enemies |
| `support` | Stays near allies, heals/buffs them, only attacks if player comes close |
| `boss` | Multi-phase AI, special abilities per phase threshold, arena control |

State machine: `idle → patrol → chase → attack → flee (if defensive and low HP)`

### Enemy–Physics Interaction

When `enemy-damaged` fires with `{ enemy, attackerX, attackerY, element, damage }`:
- PhysicsSystem maps element to knockback weight class
- Applies angle-based knockback away from attacker
- Enemy's `body.setVelocity` is overridden by knockback for the duration

---

## 9. Companions

**File:** `src/systems/CompanionSystem.js`, `src/ui/CompanionPanel.js`

Five recruitable companions, each with a unique role, personal questline, and bond progression:

| Companion | Role | Bond Ability |
|-----------|------|-------------|
| Vaeril | Mage | At max bond: free spell cast once per fight |
| Aeliana | Healer | At max bond: revives player once per zone |
| Kael | Warrior | At max bond: intercepts lethal hits |
| Mira | Rogue | At max bond: reveals hidden items in zones |
| Zeph | Scout | At max bond: prevents ambush encounters |

### Bond System

- Bond increases through combat together, completing companion quests, and resting at HomeBase
- Bond level (0–5) is tracked per companion
- On increase: fires `companion:bondChanged` → CompanionPanel updates → AudioManager plays chime
- At level 5: fires `companion:bondLevelUp` → special ability unlocks

### In Combat

Each companion has a `getCompanionCombatEntity()` method that returns their Phaser sprite for use in TacticalCombatSystem. They act as allied units on the tactical grid with their own AP pool.

### Panel

Press **P** to open CompanionPanel — shows all 5 companions with:
- Real portrait images (if loaded) or initials fallback
- Bond bar (0–5 stars)
- Recruit/dismiss buttons
- Current status

---

## 10. Zones & The World

**Files:** `src/systems/ZoneContentManager.js`, `src/systems/PortalSystem.js`, `src/systems/ZoneTilemapBuilder.js`

### Zone Types

The world is divided into zones, each with a type that determines:

| Zone Type | Tileset | Enemies | BGM | Speed Modifier |
|-----------|---------|---------|-----|---------------|
| `hub` | Town tiles | None | bgm_town | 100% |
| `market` | Town tiles | None | bgm_town | 100% |
| `dungeon` | Dungeon tiles | Medium density | bgm_dungeon | 90% |
| `forest` | Nature tiles | Low density | bgm_exploration | 80% |
| `boss` | Special | Boss only | bgm_boss | 100% |
| `void` | Dark tiles | High density | bgm_dungeon | 70% |
| `corruption` | Corrupted tiles | High density | bgm_dungeon | 70% |

### How Zones Work

1. Player enters a zone → `zone-entered` fires with zone data
2. ZoneContentManager receives it → spawns appropriate enemies/NPCs for that zone type
3. ZoneTilemapBuilder renders the zone using Kenney CC0 tilesets
4. PhysicsSystem receives `zone-entered` → applies speed modifier
5. AudioManager receives `zone-entered` → crossfades to zone-appropriate BGM
6. UIScene receives `zone-entered` → updates location indicator + shows notification toast

### Portals (PortalSystem)

Fast-travel portals that:
- Only **appear during Silver Sap phase** — they are literally summoned by Silver energy
- Have animated glow effects (pulsing inner ring + outer glow)
- Carry the player to previously-visited locations
- `portal:activated` → AudioManager plays teleport SFX
- On phase change to non-Silver: portals destroy themselves until next Silver phase

### Fog of War

ZoneContentManager maintains `fogGraphics` — unexplored zones are drawn with a dark overlay. As the player discovers zones, fog is cleared and `location:discovered` fires.

---

## 11. Progression

**Files:** `src/systems/ProgressionSystem.js`, `src/systems/AttributeSystem.js`, `src/systems/PlayerClassSystem.js`, `src/systems/SkillCheckSystem.js`

### Classes (5 Total)

At game start, the player picks one of 5 classes:

| Class | Role | Starting Strength |
|-------|------|------------------|
| Bloomguard | Tank/Support | High Resilience, Guard mechanic |
| Thornbinder | Mage/Controller | High Insight, debuff spells |
| Ashwalker | Rogue/Scout | High Agility, stealth and crit |
| Ironclad | Warrior/Bruiser | High Might, melee dominance |
| Voidweaver | Dark Mage/Summoner | High Insight, void element spells |

Each class applies a stat spread and unlocks a class-specific starting spell set.

### Leveling (Max Level 10)

```
XP gained → ProgressionSystem.addXP()
→ Level threshold met → player:levelUp event
→ UIScene shows notification
→ AttributeAllocationPanel opens → player spends attribute points
→ New spells may unlock → spell:unlocked event → SpellbookPanel updates
```

### The 5 Attributes

| Attribute | Derived Benefit |
|-----------|----------------|
| **Might** | Melee damage, carry weight |
| **Agility** | Movement speed, dodge chance, crit chance |
| **Resilience** | Max HP, defense, poison resistance |
| **Insight** | Spell power, Sap regen rate, Veilkeeper clarity |
| **Charisma** | Dialogue options, faction gains, Sap Cycle diplomacy bonus |

### Skill Checks (SkillCheckSystem)

12 use-based skills (Lockpicking, Herbalism, Scouting, etc.). Each time you use a skill successfully, it has a chance to improve. Formula: `d20 + Attribute + SkillRank vs Difficulty`. Skills have 5 ranks. This rewards players who engage with the world rather than just fighting.

---

## 12. The Economy

### Gold & Shops (ShopPanel, CraftingPanel, StashPanel)

**ShopPanel** — Buy and sell items with merchant NPCs. Prices are affected by:
- Faction reputation with that merchant's faction (-20% to +20%)
- Sap Cycle phase (Silver = 10% discount, Blue = slight markup)
- Charisma attribute (dialogue check for better prices)

**CraftingPanel** — 4 crafting stations, each for different item types:
- **Forge** — weapons and armor from metal/ore
- **Sanctum** — spell scrolls and magical components from crystals/herbs
- **Workshop** — tools, traps, consumables from wood/metal
- **Atelier** — accessories and jewellery from gems/cloth

CraftingPanel checks materials in the player's inventory, shows all recipes, and fires `crafting:craft` on confirm.

**StashPanel** — 60-slot persistent vault at HomeBase. Items here survive between zones and are saved with the game.

### EquipmentSystem

8 equipment slots: Head, Chest, Legs, Feet, MainHand, OffHand, Ring, Amulet.

Each equipped item:
- Applies stat bonuses directly to `player.stats`
- Has a rarity (Common → Uncommon → Rare → Legendary → Mythic) affecting stat multipliers
- Has an element type that interacts with spell systems

When equipment changes → `equipment:changed` event → all systems that read player stats recalculate.

---

## 13. The Story Engine

**Files:** `src/systems/NarrativeSystem.js`, `src/systems/MoralChoiceSystem.js`, `src/systems/EndingEvaluator.js`, `src/systems/AIDungeonMaster.js`

### NarrativeSystem

Drives the campaign through 6 story eras from `data/story.json`. Each era has:
- Unlock conditions (faction reputation, quest completions, day count, DSP level)
- Story beats delivered via VeilkeeperPanel or NarrativePanel
- Butterfly effects: completing Era 2 one way vs another way changes what's available in Era 4

### MoralChoiceSystem

Tracks 15 major moral choice points across the game. Each choice feeds into one of 4 alignment axes:

| Axis | Meaning |
|------|---------|
| **Mercy** | Do you spare enemies/criminals or punish them? |
| **Truth** | Do you deceive for good outcomes or stay honest? |
| **Sacrifice** | Do you risk yourself for others or prioritize survival? |
| **Authority** | Do you work with institutions or subvert them? |

Your alignment across these axes feeds into EndingEvaluator.

### 4 Endings × 3 Variations = 12 Outcomes

EndingEvaluator reads:
- Faction reputation (6 factions)
- Moral alignment scores (4 axes)
- Companion bond levels (5 companions)
- DSP/Hollowing level
- Quest completion flags

...and determines which of 4 major endings the player receives, and which of 3 variations of that ending plays out.

### AI Dungeon Master (AIDungeonMaster)

A dynamic narration layer that:
- Generates contextual flavor text based on zone type and player history
- Adapts encounter difficulty if player is on a losing streak
- Adds world details based on current Sap phase and factions
- Provides the text displayed in the AI DM tab of GameInfoPanel

---

## 14. Quests & Factions

**Files:** `src/systems/QuestSystem.js`, `src/systems/FactionSystem.js`

### QuestSystem

Quests have multiple objectives (kill X, collect Y, talk to Z, reach location W). Each objective has:
- A completion condition checked against EventBus events
- Optional Sap Cycle phase requirement (e.g., "only available during Crimson phase")
- Reputation reward for associated faction on completion

Quest lifecycle:
```
quest:started → objectives tracked via events →
quest:objectiveUpdated (UIScene updates tracker) →
quest:completed → XP + gold + faction rep awarded → AudioManager plays chime
```

### FactionSystem (6 Factions)

| Faction | Domain | Affects |
|---------|--------|---------|
| Grove Protectors | Nature/Verdant | Forest zones, nature spells, herbalism |
| Iron Covenant | Military/Trade | Weapon shops, Ironclad class bonuses |
| Veil Scholars | Magic/Knowledge | Veilkeeper access, spell unlocks |
| Shadowmere Guild | Rogues/Underground | Hidden zones, Ashwalker bonuses, black market |
| Silver Circle | Diplomacy/Silver | Silver phase bonuses, portal access, negotiations |
| Ashen Order | Corruption/Power | Void zones, DSP interactions, dark narrative |

Reputation scale: -100 (enemy) to +100 (exalted).

Actions that affect reputation:
- Quest completions/failures
- Enemy kills (faction-aligned enemies)
- Dialogue choices
- Moral choice outcomes
- Crafting items associated with a faction

High reputation → better shop prices, quest unlocks, dialogue options, narrative branches.
Hostile reputation → faction members attack on sight, certain areas blocked.

---

## 15. The Veil & DSP System

**Files:** `src/systems/DSPSystem.js`, `src/systems/VeilkeeperSystem.js`

### DSP System (Domain Soul Pool)

The world's magic resource. Think of it as the health of magic itself in Verdance.

6 status thresholds:

| DSP Level | Status | Effect |
|-----------|--------|--------|
| 80–100% | Pristine | Spell costs reduced 20%, bonuses to all magic |
| 60–80% | Balanced | Normal |
| 40–60% | Strained | Slight cost increase |
| 20–40% | Overloaded | Costs +40%, random spell failures |
| 5–20% | Critical | Costs doubled, visual distortion effects |
| 0–5% | Collapse | Spells cost HP instead of Sap |

DSP is depleted by:
- Casting spells (small amount per cast)
- Corruption zones (passive drain)
- Failing Veilkeeper consultations

DSP recovers via:
- Player resting at HomeBase
- Blue Sap phase passive recovery
- Completing Veil Scholars quests

### VeilkeeperSystem (5 Keepers)

Five ancient spirits the player can consult for information, guidance, and power at a cost:

- Consultation costs DSP (amount varies per keeper and Sap phase)
- Each keeper has a **Hollowing threshold** — if you consult too many times, the keeper hollows (becomes less coherent)
- At maximum Hollowing, the keeper permanently dies and their knowledge is lost
- Provides narrative context, hints at hidden quests, and unlocks rare dialogue options

Fired via `veilkeeper-open` event → VeilkeeperPanel displays keeper lore + options + DSP cost.

---

## 16. Audio

**File:** `src/systems/AudioManager.js`

The AudioManager is a singleton that handles all sound in the game. It runs independently from GameScene and responds entirely to EventBus events.

### Music System

- **Crossfading** — music layers blend over 1.5–2.5 seconds when zones change or phase shifts
- **Adaptive intensity** — intensity score (0–1) adjusts music layers based on nearby enemies
- **Zone BGM** — each zone type has a preferred track; boss zones always override to `bgm_boss`
- **Mood override** — ZoneContentManager can set a combat/tense/calm mood that changes BGM mid-zone

### Event-to-Sound Mapping

| Game Event | Sound |
|-----------|-------|
| `spell-cast` | Element-matched SFX (14 elements × 2–3 variants each) |
| `enemy-damaged` | Random from `sfx_damage1/2/3` |
| `player-damaged` | Random from `sfx_blow1/2/damage1` |
| `enemy-attack` | Random hit sound |
| `enemy-defeated` | `sfx_collapse1` |
| `player:healed` | Random from `sfx_heal1/2/3` |
| `player:died` | Music stops → 2s delay → `bgm_gameover` |
| `player:levelUp` | `sfx_levelup` |
| `portal:activated` | `sfx_teleport` |
| `ui:buttonClick` | `sfx_cursor1` |
| `ui:menuOpen` | `sfx_cursor2` |
| `ui:menuClose` | `sfx_cancel1` |
| `companion:bondLevelUp` | `sfx_chime1` |
| `game:saved` | `sfx_save` |
| `settings:volumeChanged` | Live volume update (no restart needed) |

### Spatial Audio

AudioManager supports distance-based volume attenuation for enemy sounds — enemies far from the player sound quieter, adding spatial awareness to the audio environment.

---

## 17. Visual Feedback

**Files:** `src/systems/ParticleEffects.js`, `src/systems/AdvancedParticleSystem.js`, `src/systems/AdvancedLightingSystem.js`

### Particle Effects

Every spell element has a unique particle burst:

| Element | Particle Style |
|---------|---------------|
| Fire | Orange/red sparks, smoke puff |
| Ice | White/cyan shards, frost mist |
| Thunder | Yellow/white flash, arc lines |
| Void | Purple/black wisps, dark particles |
| Verdant | Green petals, leaf scatter |
| Radiant | White/gold starburst, shimmer |

These fire on `spell-cast`, `enemy-damaged`, `player:healed`, and `player-damaged` events.

### Advanced Particle System

Supports:
- **Multi-stage effects** — particles that change behavior mid-life (e.g., fire rises then fades)
- **Sub-emitters** — particles that spawn new particles on death (explosion shrapnel)
- **Object pooling** — particles are recycled, not created/destroyed, preventing GC spikes
- **Global forces** — wind drift, gravity wells, turbulence fields applied to entire emitter groups

### Advanced Lighting

- **Point lights** — spells leave brief glowing light at impact
- **Flicker effects** — torches and fire lights pulse with pseudo-random flicker
- **Phase-based ambient** — SapCycleLightingIntegration shifts the ambient light color to match current phase (warm crimson / pale silver-white / cool blue)
- **Volumetric glow** — spells have a glow bloom during flight

---

## 18. The HUD & UI System

**Files:** `src/ui/UIFramework.js`, `src/scenes/UIScene.js`, all panel files

### UIFramework

The UIFramework is a singleton UI factory. It:
- Creates styled buttons, progress bars, inventory slots, and panels using **Kenney CC0 atlas assets** (NineSlice stretching for resolution-independent panels)
- Manages a **panel stack** — if you open the shop from within the inventory, closing shop returns you to inventory
- Fires `ui:menuOpen` / `ui:menuClose` SFX events when panels open/close
- `hideAllPanels()` closes everything cleanly

### All 10 Panels and Their Keys

| Panel | Key | Purpose |
|-------|-----|---------|
| SpellbookPanel | **K** | View all spells, filter by class, equip to slots |
| GameInfoPanel | **TAB** | 7-tab overlay: Quests, Locations, Sap Cycle, AI DM, DSP, Character, Factions |
| CompanionPanel | **P** | View/manage companions and bond levels |
| InventoryPanel | **I** | Full inventory grid with equipment slots and tooltips |
| CharacterSheetScene | **C** | Full character sheet (launches as separate scene overlay) |
| WikiCodexScene | **W** | In-game encyclopaedia with progressive unlocks |
| ShopPanel | Event-driven | Opens when talking to merchant NPC |
| CraftingPanel | Event-driven | Opens at crafting station interactions |
| VeilkeeperPanel | Event-driven | Opens when interacting with Veilkeeper spirits |
| TacticalCombatPanel | Event-driven | Opens when tactical combat is triggered |

### HUD (UIScene)

Always-visible elements:
- **HP / Sap bars** — update on every `player-stats-updated` event
- **DSP bar** — shows world magic health, pulses red when critical
- **Sap Cycle clock** — animated phase indicator + progress arc
- **Spell slots** — 5 slots showing equipped spells with cooldown overlay
- **Quest tracker** — active quest name and current objective
- **Location indicator** — current zone name, fades after 3 seconds
- **Mini-map** — zone overview (stub)
- **Notification toasts** — system-wide notifications stack in top-right

---

## 19. Save & Load

**Files:** `src/systems/SaveManager.js`, `src/systems/ContentInitializer.js`

### SaveManager

3 save slots stored in `localStorage`. Each save contains a full snapshot of:
- Player stats, position, equipment, spells
- Inventory contents
- Quest state (active quests + objective progress + completed quests)
- Faction reputation values
- Companion roster and bond levels
- Moral choice history
- DSP level
- Sap Cycle day/phase
- Discovered locations and portal unlocks
- SkillTree progress
- Attribute point allocations

**Auto-save** every 60 seconds. Manual save fires `game:saved` event → AudioManager plays save sound.

### How Save/Load Works

On `save-collect` event:
- ContentInitializer asks every system to serialize its state into the save object
- SaveManager writes the JSON to localStorage

On `save-restore` event:
- ContentInitializer receives the loaded JSON
- Each system's `loadState()` is called with its slice of data
- All EventBus listeners, stats, and UI update in response

---

## 20. Debug & Editor Tools

**Files:** `src/scenes/EditorScene.js`, `src/ui/HierarchyPanel.js`, `src/ui/InspectorPanel.js`, `src/ui/ConsolePanel.js`, `src/systems/PerformanceProfiler.js`

Press **F2** in-game to open the Editor — a Unity-style three-panel layout:

- **Hierarchy** — tree view of all active game objects; click to select
- **Inspector** — live property editor for the selected object (position, stats, flags)
- **Console** — log output with filtering, search, and command input

**PerformanceProfiler** — accessible via a toggle, shows real-time FPS, frame time breakdown by system, memory usage estimate, and draw call count. Critical for finding which system is causing frame drops.

**HotReloadOverlay** — during development, when a data JSON file changes on disk, the `data-reloaded` event fires and a toast shows which file was reloaded and how many records changed.

---

## 21. How Everything Connects

Here is the full communication web for the most important moment in the game — **an enemy hitting the player**:

```
Enemy.attack()
  → GameScene detects collision
  → player.takeDamage(amount, element)
    → stats.hp decreases
    → EventBus.emit('player-damaged', { damage, element, hp })
      → PhysicsSystem._onPlayerDamaged()
          → applyKnockback(player, 'light')
          → cameras.main.shake(90, 0.004)
      → AudioManager (wireToGame listener)
          → plays sfx_blow1/2 randomly
      → ParticleEffects listener
          → plays impact burst at player position with element tint
      → UIScene listener (player-stats-updated)
          → HP bar animates down
    → if hp <= 0:
        → EventBus.emit('player:died')
          → AudioManager: stops music, queues bgm_gameover
          → GameScene: triggers death screen / respawn flow
```

And the **Sap phase changing**:

```
SapCycleManager._advanceDay()
  → phase flip detected
  → EventBus.emit('phase-changed', newPhase, oldPhase)
    → PortalSystem: spawn or destroy portals
    → AudioManager: crossfade to new phase BGM
    → SapCycleLightingIntegration: shift ambient light color
    → SpellSystem: recalculate cost/power modifiers
    → UIScene: flash phase name + color on screen
    → QuestSystem: check if any quests unlock this phase
    → VeilkeeperSystem: recalculate consultation costs
```

---

## 22. The Fun — Why It All Works Together

Every design decision in this game is built around one question: **does this make the player feel powerful AND challenged at the same time?**

### The Three-Layer Feedback Loop

Every meaningful action in Verdance triggers **three simultaneous feedback channels**:

1. **Visual** — particle burst, screen shake, HP bar update, lighting flash
2. **Audio** — element-matched SFX, music intensity shift, UI chime
3. **Mechanical** — damage number, stat change, cooldown starts, knockback

This is why combat feels weighty even with placeholder art — every hit is confirmed by sight, sound, and system response simultaneously.

### Time Pressure Without Countdown Timers

The Sap Cycle creates urgency without a visible countdown. Players feel:
- *"I should do this now while portals are up (Silver phase)"*
- *"I need to rest — I'm fighting in Crimson and the enemies are brutal"*
- *"My spells are cheaper right now, I should farm this dungeon during Blue phase"*

This is **ambient time pressure** — the player chooses when to respond to it rather than being forced.

### The Risk/Reward of the Veil

Consulting a Veilkeeper gives you genuine power and story content — but each consultation drains the world's magic (DSP) and inches the keeper toward permanent death. This creates a meaningful tension:
- Consult more → more information, more power, more story
- Consult too much → keepers die forever, DSP collapses, spells start costing HP

Players must decide how much they want to know.

### Companions as Emotional Investment

The bond system is designed so that companions don't feel like stat bonuses — they feel like relationships. Bond improves through play, peaks with a unique ability, and companions can die permanently in certain narrative paths (if their personal quest fails). Players who engage with companions get rewarded both mechanically and emotionally.

### The Tactical Safety Valve

Real-time combat creates urgency and flow. Tactical mode creates mastery and control. The fact that the player can **choose when to go tactical** (or be forced into it for boss fights) means:
- Casual players can brute-force most encounters in real-time
- Skilled players can optimize tactical encounters for perfect runs
- Bosses feel different (forced tactical = deliberate, staged challenge)

### Everything Remembers

The combination of QuestSystem, FactionSystem, MoralChoiceSystem, and NarrativeSystem means the world **remembers everything the player does**. Merchants have better prices because you helped their faction. Enemies know you killed their leader. The ending changes based on hundreds of small decisions made over the entire playthrough.

This is the ultimate source of replayability — the same zones and spells create completely different stories based on how you engage with the world's systems.

---

*Document generated: 2026-03-31 — Realm of Nexus: Verdance*
