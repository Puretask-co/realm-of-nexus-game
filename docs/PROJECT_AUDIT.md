# Realm of Nexus — Full Project Audit
> Generated: 2026-03-31 | Scope: All src/ files, all systems, all scenes, all UI panels

---

## Severity Legend
- 🔴 **CRITICAL** — Game-breaking: crashes, features silently broken, audio/particles never fire
- 🟡 **HIGH** — Memory leaks, systems not wired, noticeable gaps
- 🟠 **MEDIUM** — Features incomplete, dead code accumulating
- 🔵 **LOW** — Code quality, cleanup, minor inconsistencies

---

## SECTION 1 — EventBus Mismatches

The EventBus is the nervous system of the game. Mismatches here mean features silently do nothing.

### 1A — Event Name Inconsistency (🔴 CRITICAL)

| Emitted | Listened For | File | Impact |
|---------|-------------|------|--------|
| `player-healed` | `player:healed` | Player.js emits wrong name | **Heal particles & SFX never fire** |
| `player-defeated` | `player:died` | Player.js vs AudioManager | Death music never plays from Player component |
| `player-dash` | *(nothing)* | Player.js:190 | Dash has no audio/visual response |

**Fix applied:** Player.js now emits `player:healed` and `player:died` to match AudioManager and ParticleEffects.

### 1B — Events Emitted But Never Listened To (🟡 HIGH)

These events are fired every frame or on key actions but nothing responds:

| Event | Emitted In | Should Be Handled By |
|-------|-----------|---------------------|
| `location:discovered` | GameScene | Minimap, Quest log — but they listen for `zone:discovered` |
| `hud:update` | GameScene | HUDPanel — but HUDPanel listens for `player-stats-updated` |
| `enemy-attack` | GameScene | AudioManager should play hit sound on this |
| `dsp:overload` | GameScene | UIScene should show an overload warning |
| `veilkeeper-response` | GameScene | VeilkeeperPanel should display this |
| `ui:showNarration` | GameScene | NarrativePanel should handle this |
| `sap-hour-passed` | SapCycleManager | UI clock, HUD ambient effects |
| `sap-day-passed` | SapCycleManager | Day transition effects |
| `phase-transition` | SapCycleManager | Lighting, particle color shift |
| `zone:clearEnemies` | ZoneContentManager | GameScene enemy cleanup |
| `zone:spawnEnemies` | ZoneContentManager | GameScene enemy spawning |
| `zone:musicMood` | ZoneContentManager | AudioManager BGM selection |
| `zone:exited` | ZoneContentManager | GameScene/UI cleanup |
| `item-purchased` | ShopPanel | Inventory, gold deduction confirm |
| `crafting:craft` | CraftingPanel | CraftingSystem actual crafting logic |
| `companion:bondLevelUp` | AudioManager *listens* | **Never emitted anywhere** |
| `companion:leftParty` | CompanionPanel *listens* | **Never emitted by CompanionSystem** |
| `load-save` | MainMenuScene | GameScene should receive and apply save data |
| `main-menu-open` | MainMenuScene | AudioManager could start menu music via this |
| `settings:volumeChanged` | SettingsScene | AudioManager should update volume |
| `settings:difficultyChanged` | SettingsScene | DifficultySystem should respond |
| `cooldown-ready` | CooldownManager | HUD cooldown indicator |
| `cooldown-cancelled` | CooldownManager | HUD cooldown indicator |
| `physics:zoneSpeedChanged` | PhysicsSystem | HUD could show speed debuff icon |
| `tactical:floatMessage` | TacticalCombatPanel | No renderer picks it up |

### 1C — Events Listened For But Never Emitted (🟠 MEDIUM)

| Event | Listened In | Fix |
|-------|-----------|-----|
| `companion:playerRested` | CompanionSystem | HomeBase rest action should emit this |
| `quest-offer` | *(nothing listens)* | NPC.js emits it but nothing handles |
| `veilkeeper-open` | *(nothing listens)* | NPC.js emits it; VeilkeeperPanel should listen |

---

## SECTION 2 — System Wiring Gaps

### 2A — Systems Initialized but Never Updated (🟡 HIGH)

Some systems have an `update(delta)` method but GameScene never calls it:

| System | Has update()? | Called in GameScene? |
|--------|-------------|---------------------|
| CompanionSystem | Yes | Called via `companionSystem.update?.()` ✓ |
| AISystem | Yes | Called ✓ |
| TacticalCombatSystem | Yes | Called ✓ |
| SapCycleManager | Yes | Called ✓ |
| ZoneContentManager | Yes | Called ✓ |
| PortalSystem | Yes | Called ✓ |
| PhysicsSystem | Yes | **FIXED — now called at line 2224** ✓ |

### 2B — Systems that Don't Clean Up EventBus Subscriptions (🟡 HIGH)

These systems subscribe to EventBus on init but never unsubscribe when GameScene shuts down. This causes ghost listeners when the scene restarts (e.g., after player death → respawn):

| System | Subscribes | Has unsubscribe? | Called in shutdown()? |
|--------|-----------|-----------------|----------------------|
| SapCycleManager | Yes (line 71) | No | No |
| PortalSystem | Yes (line 33) | Partial (`_unsubPhase`) | **Not called** |
| ZoneContentManager | Likely | Unknown | No |
| ContentInitializer | Yes (2 events) | No | No |
| TutorialSystem | Yes | Unknown | No |

**Fix applied:** GameScene.shutdown() now explicitly destroys/cleans up all systems.

### 2C — Unused System Files (🟠 MEDIUM)

These files exist in src/ but are never imported anywhere:

| File | Replacement |
|------|-------------|
| `src/engine/PhysicsLayer.js` | PhysicsSystem handles what this was for |
| `src/engine/ComponentRegistry.js` | Not used |
| `src/systems/ParticleCollisionSystem.js` | AdvancedParticleSystem covers this |
| `src/systems/CameraZoneSystem.js` | AdvancedCameraSystem replaced it |
| `src/systems/CSVDataLoader.js` | DataManager handles all data loading |
| `src/systems/HotReloadSystem.js` | DataManager has hot-reload built-in |
| `src/systems/SceneLoader.js` | Phaser scene manager used directly |
| `src/integration/CombatCameraIntegration.js` | TacticalCombatCameraBridge replaced it |
| `src/integration/SpellParticleIntegration.js` | SpellVFXIntegration replaced it |
| `src/effects/ScreenSpaceEffects.js` | Never used |
| `src/pipelines/NormalMapPipeline.js` | Never used |
| `src/pipelines/PostProcessingPipeline.js` | Never used |

---

## SECTION 3 — UI Panel Registration Gap (🔴 CRITICAL)

### The Problem

`UIFramework.showPanel(id)` works by looking up the panel in `this.panels` Map:
```js
const panel = this.panels.get(id);  // returns undefined for ALL panels
if (!panel) { console.warn(`Unknown panel '${id}'`); return; }
```

None of the panels in UIScene are registered with `UIFramework.registerPanel()`. They are created as scene properties and toggled directly — **the UIFramework panel system is completely bypassed**.

### Affected Panels

All 10 panels in UIScene.create() are affected:
`spellbookPanel`, `shopPanel`, `craftingPanel`, `moralChoicePanel`, `veilkeeperPanel`,
`stashPanel`, `inventoryPanel`, `gameInfoPanel`, `companionPanel`, `tacticalCombatPanel`

### Consequence

- `UIFramework.showPanel('spellbook')` → silent warning, nothing opens
- `UIFramework.hideAllPanels()` → does nothing
- `ui:menuOpen` / `ui:menuClose` SFX tied to UIFramework never fire for these panels
- Panel stack (back navigation) doesn't work

**Fix applied:** All panels now registered in UIScene via `UIFramework.registerPanel()`.

---

## SECTION 4 — Player Stats Initialization Gap (🔴 CRITICAL)

### The Problem

When `classSystem.applyClassStats()` is used (the primary path), the returned stats object may not include all properties needed downstream. Tactical combat reads `might`, `agility`, `resilience`, `insight`, `guard`, `maxGuard` but these are only guaranteed in the fallback path.

### Missing Stats When Class System Is Used

| Stat | Used In | Initialized in class path? |
|------|---------|--------------------------|
| `might` | TacticalCombat, AttributeSystem | Only if class data includes it |
| `agility` | TacticalCombat, movement calc | Only if class data includes it |
| `resilience` | TacticalCombat, defense | Only if class data includes it |
| `insight` | TacticalCombat, spell power | Only if class data includes it |
| `charisma` | Dialogue checks, NPC interactions | Only if class data includes it |
| `guard` / `maxGuard` | Shield mechanic | Not in class system defaults |
| `ap` / `maxAP` | Tactical combat action points | Not in class system defaults |
| `name` | CharacterSheet display | Not in class system |
| `ancestry` | CharacterSheet display | Not in class system |
| `variant` | CharacterSheet display | Not in class system |

**Fix applied:** `_createPlayer()` now merges class stats with a complete defaults object, guaranteeing all properties exist.

---

## SECTION 5 — CompanionSystem Method Gaps (🔴 CRITICAL)

### Missing Methods Called in GameScene

| Called At | Method | Exists? | Impact |
|-----------|--------|---------|--------|
| GameScene:790 | `companionSystem.getCompanionCombatEntity()` | **No** | Tactical combat with companions crashes |
| GameScene (various) | `companionSystem.getCompanionData()` | **No** | Companion data access fails |

### Events Never Emitted

| Event | Listened By | Should Be Emitted When |
|-------|------------|------------------------|
| `companion:bondLevelUp` | AudioManager | Bond increases after combat/quest |
| `companion:leftParty` | CompanionPanel | Companion is dismissed |
| `companion:bondChanged` | CompanionPanel | Any bond level change |

**Fix applied:** Missing methods added to CompanionSystem. Bond events emitted on relevant actions.

---

## SECTION 6 — Audio Coverage Gaps (🟡 HIGH)

### Events That Should Have Audio But Don't

| Missing | Fix |
|---------|-----|
| `enemy-attack` → no hit sound on player | Add listener in AudioManager for player hit sound |
| `settings:volumeChanged` → audio volume doesn't update live | Add listener to call `setVolume()` |
| `quest:failed` → no failure sting | Add listener |
| `companion:recruited` → no fanfare | Add listener |
| Zone `zone:musicMood` → AudioManager ignores this and uses `zone-entered` only | Wire ZoneContentManager's mood event to BGM |

### Sound Keys Loaded But Never Used

The following SFX are loaded in BootScene but never referenced in AudioManager.wireToGame:
- `sfx_bell1/2/3` — could be used for quest events
- `sfx_powerup` — could be used for item pickups
- `sfx_wind1-11` — wind element spells map to `sfx_wind1` in AudioManager ✓

---

## SECTION 7 — Save/Load Integrity (🟠 MEDIUM)

### Systems That Should Save/Restore But May Not

| System | Data It Owns | Saves to EventBus `save-collect`? |
|--------|-------------|----------------------------------|
| QuestSystem | Active quests, progress, completed | Likely yes (needs verification) |
| FactionSystem | Reputation with each faction | Likely yes (needs verification) |
| CompanionSystem | Party roster, bond levels | Likely yes (needs verification) |
| EquipmentSystem | Equipped items per slot | Likely yes (needs verification) |
| MoralChoiceSystem | Choices made | Likely yes (needs verification) |
| ProgressionSystem | Level, XP, unlocked abilities | Likely yes (needs verification) |
| Player.stats | HP, gold, spells equipped | Partially — GameScene handles some |
| PortalSystem | Unlocked portals | Unknown |
| DSPSystem | Corruption level | Unknown |

### Load Flow Gap

`MainMenuScene` emits `load-save` when a slot is selected, but nothing in GameScene listens for it. The save data is put into `registry` instead:
```js
this.registry.set('loadedSaveSlot', slot);
EventBus.emit('load-save', { slot, saveData });  // no listener
```
GameScene reads from `registry.get('loadedSaveSlot')` on create — this works, but the EventBus emit is dead.

---

## SECTION 8 — Zone System Consistency (🔵 LOW)

### Zone Types Present in Code But Not in PhysicsSystem.ZONE_SPEED

| Zone Type | In locations.json | In PhysicsSystem | In AudioManager BGM |
|-----------|-----------------|-----------------|-------------------|
| `settlement` | Possibly | No (falls back to 1.0) | Yes → bgm_town |
| `catacombs` | Possibly | No (falls back to 1.0) | Yes → bgm_dungeon |
| `overworld` | Possibly | No (falls back to 1.0) | No → bgm_exploration |

These are handled gracefully by fallback logic (`?? 1.0` in PhysicsSystem, default BGM in AudioManager). Low severity.

---

## SECTION 9 — Spell Element Coverage (✅ CONSISTENT)

All three systems that handle spell elements use the same 14-element set:

```
fire, arcane, shadow, nature, verdant, radiant, light,
spirit, void, physical, water, ice, thunder, wind
```

**ParticleEffects.ELEMENT_FX** — all 14 ✓
**AudioManager.ELEMENT_SFX** — all 14 ✓
**PhysicsSystem knockback weight mapping** — grouped by weight class ✓

No inconsistencies found in spell element handling.

---

## SECTION 10 — Animation Key Consistency (🟠 MEDIUM)

### Animations Created in BootScene

| Key | Created | Used In |
|-----|---------|---------|
| `player-idle` | ✓ | GameScene._createPlayer() |
| `player-walk` | ✓ | Player.js movement |
| `player-attack` | ✓ | GameScene combat |
| `player-cast` | ✓ | SpellSystem |
| `enemy_treetitan-walk` | ✓ | GameScene._spawnSingleEnemy() |
| `enemy_treetitan-attack` | ✓ (conditional) | GameScene enemy attack loop |
| `enemy_treetitan-death` | ✓ (conditional) | GameScene._onEnemyDefeated() |
| `player-sword` | ✓ (conditional) | Not yet hooked up to input |

### Player-Sword Animation Not Triggered

`player-sword` animation is registered (BootScene) and the spritesheet loaded (`player_swordattack`) but there is no input binding that plays it. The melee attack in GameScene just fires the spell logic without swapping to sword animation.

---

## WHAT WAS FIXED IN THIS AUDIT

The following were repaired immediately after this audit was written:

### Critical Fixes
1. **`player-healed` → `player:healed`** — Player.js event name corrected
2. **Player stats defaults** — `_createPlayer()` merges class stats with full defaults object ensuring `might`, `agility`, `resilience`, `insight`, `guard`, `ap` etc. always exist
3. **UIScene panel registration** — All 10 panels now registered with `UIFramework.registerPanel()`
4. **CompanionSystem missing methods** — `getCompanionCombatEntity()` and `getCompanionData()` added
5. **Companion bond events** — `companion:bondChanged` and `companion:leftParty` now emitted correctly

### High Priority Fixes
6. **System cleanup in shutdown()** — SapCycleManager, PortalSystem, ZoneContentManager, ContentInitializer all cleaned up on GameScene shutdown
7. **`settings:volumeChanged` handler** — AudioManager now listens and applies volume live
8. **`enemy-attack` audio** — AudioManager now plays `sfx_blow1` on `enemy-attack` event
9. **`zone:musicMood` wiring** — AudioManager now listens to ZoneContentManager's mood event

### Medium Priority Fixes
10. **Companion bond/dismiss events** — CompanionSystem now emits `companion:bondLevelUp` and `companion:leftParty` on relevant actions
11. **Dead system imports removed** — GameScene no longer imports unused NPC (used inline)

---

## RECOMMENDED NEXT IMPROVEMENTS (NOT YET DONE)

| Priority | Task |
|----------|------|
| 🔴 | Add `getCompanionCombatEntity` return type — ensure it returns Phaser Sprite usable in TacticalCombat |
| 🔴 | Verify all systems respond to `save-collect` and `save-restore` — full save audit needed |
| 🟡 | Wire `player-sword` animation to melee attack in GameScene |
| 🟡 | Archive/delete the 12 unused system files to reduce codebase noise |
| 🟡 | Add `quest:failed` audio event to AudioManager |
| 🟡 | Implement `veilkeeper-open` → VeilkeeperPanel listener |
| 🟡 | Wire `cooldown-ready` event to HUD indicator |
| 🟡 | Wire `companion:recruited` to a fanfare/SFX event |
| 🟠 | Unify event naming: decide on `dash:colon` vs `dash-hyphen` and apply globally |
| 🟠 | Add `zone:spawnEnemies` / `zone:clearEnemies` listeners in GameScene to replace the current proximity-based spawn check |
| 🔵 | Remove dead EventBus emits (~35 identified) that are never received |
