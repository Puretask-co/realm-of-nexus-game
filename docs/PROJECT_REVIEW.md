# Realm of Nexus — Full Technical & Game Design Review

> Reviewed: 2026-03-31 | Reviewer: Claude (Sonnet 4.6) | Branch: main (local ahead of GitHub by 2 commits)

---

## Part 1: What's Actually Strong

### Architecture intent is correct
The EventBus + data-driven + singleton pattern is a legitimate architecture for a solo-developed RPG. The fact that you can change spell numbers in JSON without touching code is the right call. GameScene correctly collects all EventBus unsubscribes in `_unsubs[]` — that's the right pattern.

### Player.js (the component) is well-written
Clean state machine (`idle`, `walking`, `casting`, `hurt`, `dead`). Diagonal normalization, invincibility frames, sap regen, resistance system — all implemented correctly. This is good, production-minded code.

### CombatSystem damage formula is solid
The pipeline is:
> base damage → damage type routing → dodge/block check → resistance reduction → variance (±15%) → phase multiplier → enemy vulnerability → crit → combo multiplier → block reduction

That's a real damage formula. It's properly layered.

### EventBus.on() returns an unsubscribe function
`EventBus.on()` returns `() => this.off(event, callback)`. That's correct. GameScene actually uses it (`this._unsubs = [EventBus.on(...), ...]`). The cleanup infrastructure is in place.

---

## Part 2: Critical Bugs

### Bug 1 — Game crashes on load ✅ FIXED
`TutorialSystem.js` exports its singleton as `export default TutorialSystem.getInstance()`. The default export is an instance, not the class. `GameScene.js:104` called `.getInstance()` on that instance → crash.

**Fix applied:** `GameScene.js:104` changed from `TutorialSystem.getInstance()` to `TutorialSystem`.

---

### Bug 2 — Player component is dead code ❌

This is the most important finding. **The `Player` class (`src/components/Player.js`) is never used in the game.**

`GameScene._createPlayer()` creates a raw Phaser sprite and staples `.stats` directly to it:

```js
// GameScene.js:563
this.player = this.physics.add.sprite(startX, startY, spriteKey);
this.player.stats = baseStats;
```

Input and spell casting are handled by `GameScene._setupInput()` → `GameScene._castSpell()`. `Player.js`'s `castSpell()`, `takeDamage()`, `dash()`, and `update()` are **never called**.

**Consequences:**
- Player.js's invincibility frames don't work in-game
- Player.js's dash cooldown doesn't work in-game
- Player.js's sap regen in `update()` doesn't run
- Two separate implementations of spell casting now exist and will diverge silently

**Fix options:**
- Use `new Player(scene, x, y)` in `_createPlayer()` and call `player.update(delta)` in GameScene's update loop
- OR delete `Player.js` and commit fully to the inline approach
- Do not leave both alive

---

### Bug 3 — 27 zones, world only fits 6 ❌

`_buildWorld()` lays out zones in a 3-column grid at 800px wide × 900px tall per zone:

```js
const worldWidth = 2400;   // 3 cols × 800 — correct
const worldHeight = 1800;  // only 2 rows × 900 — WRONG
```

But `dataManager.getAllLocations()` returns 27 locations. `row = Math.floor(i / 3)` means row 2 starts at `y = 1800` (the world boundary), and rows 3–8 are rendered completely outside the world bounds. **Zones 7–27 are invisible and unreachable.**

**Fix:**
```js
const rowCount = Math.ceil(locations.length / 3);
const worldHeight = rowCount * 900;
```
Apply the same to `physics.world.setBounds` and `cameras.main.setBounds`.

---

### Bug 4 — 48 spell validation errors at boot ❌

Two separate root causes:

**A. 28 spells use elements not in the schema enum.**

`spellSchema.js` allows: `nature, arcane, shadow, radiant, spirit, fire, physical, void, light`

The class spells (added later) use: `"verdant"` and likely other class-specific elements for `tb_`, `em_`, `wr_`, `sc_` prefixed spells. The data was added but the schema was never updated.

**Affected spell prefixes:** `bg_` (bloomguard), `tb_` (thornbinder), `em_` (emerald mystic), `wr_` (wildkin ranger), `sc_` (sporecaller)

**Fix:** Audit what elements the failing spells actually use, then add them to the `enum` array in `src/schemas/spellSchema.js:53`.

**B. 20 combo references use short IDs (no class prefix).**

Spells were renamed from `thorn_reflect` → `bg_thorn_reflect` when class prefixes were added. The `combosWith` arrays were never updated:

```json
// BROKEN — references old short ID
"combosWith": ["thorn_reflect"]

// CORRECT — must use full prefixed ID
"combosWith": ["bg_thorn_reflect"]
```

**Fix:** In `data/spells.json`, update all `combosWith` arrays to use full prefixed IDs.

---

### Bug 5 — Inconsistent event naming (two parallel event streams) ❌

GameScene listens to both naming conventions simultaneously:

```js
EventBus.on('moral:choiceMade', ...)   // colon-namespaced
EventBus.on('moral-choice-made', ...)  // hyphen-named

EventBus.on('zone:entered', ...)       // colon
EventBus.emit('zone-entered', ...)     // hyphen — emitted elsewhere
```

Events fire on one name and silently miss listeners registered under the other. No crash — just wrong behavior that's hard to trace.

**Fix:** Pick one convention project-wide. Recommendation: `colon:namespaced` (matches the majority). Audit every `EventBus.emit()` and `EventBus.on()` call and normalize.

---

## Part 3: Structural Problems

### Two combat systems with no integration point

`CombatSystem` handles: turn order, initiative, damage formula, status effects, crit/block/dodge, phase multipliers, difficulty scaling.

`TacticalCombatSystem` handles: grid layout, AP, Guard, positioning pillars (Entanglement, Shrouded Strike, Canopy Advantage, Verdant Ward).

**Neither calls the other.** The pillar bonuses (`flanking: 0.25`, `shroudFull: 0.40`, etc.) exist in `TacticalCombatSystem.positionBonuses` but there is no code path that passes those multipliers into `CombatSystem.calculateDamage()`. If tactical combat fires, it runs completely separate math from the tuned damage formula.

**Fix:** `TacticalCombatSystem` should call `CombatSystem.getInstance().calculateDamage(attacker, defender, options)`, passing pillar bonuses as options. `CombatSystem` owns the numbers; `TacticalCombatSystem` owns the grid.

---

### `_castSpell()` vs `Player.castSpell()` — two implementations, one dead

`GameScene._castSpell()` (line 1124) does:
- Cooldown check ✓
- Sap cost check ✓
- Sap consumption ✓
- DSP drain (`this.dspSystem.drain(...)`) ✓
- Phase modifier applied to damage ✓
- `AttackTypeSystem` validation ✓
- Emits `spell-cast` ✓

`Player.castSpell()` (Player.js:197) does:
- Cooldown check ✓
- Sap cost check ✓
- Sap consumption ✓
- Emits `spell-cast` ✓
- **No DSP drain** ✗
- **No phase modifier** ✗
- **No attack type validation** ✗

These will silently diverge. Any future work on the Player component that touches spell casting will bypass the DSP economy.

---

### Singletons are never destroyed

`CombatSystem.instance`, `TacticalCombatSystem.instance`, etc. are static properties — they persist for the entire browser session. If a player restarts a run without a full page reload, the combat systems carry stale state: `this.allies`, `this.enemies`, `this.turnOrder`, `this.inCombat`, `this.comboCounter`, `this.combatLog`.

`startCombat()` resets some of these but not all. This is a latent bug that will only appear during playtesting.

---

## Part 4: Game Design Assessment

### Core loop is defined but not playable end-to-end

You can move around a world. You can cast spells. But:
- No tactical combat is reachable from normal gameplay (the trigger exists but the grid is never rendered)
- Companions, Veilkeepers, Moral Choices have systems but no UI a player can interact with
- The quest dialogue fires on a timer (`elder_awakening` after 2 seconds), not from player interaction

**This is a tech demo, not yet a game loop.**

---

### Sap Cycle is your strongest differentiator — it needs more player agency

The 3-phase calendar (Crimson/Silver/Blue) is the most original mechanic in the design. Phase changes affect lighting, particle color, and spell modifiers. That's real. But:
- Players can't easily see which phase is active without checking the HUD
- DSP drain has no real consequence in normal gameplay — nothing punishes depleting it
- Phase transitions are not a player decision — they happen on a timer

The Sap Cycle should be creating player choices, not just ambient flavor.

---

### Five classes with 42 spells, but no working tactical combat

Class selection exists. Spell assignment exists. But if the tactical grid never renders, the class identity (bloomguard's positioning synergies, thornbinder's combo chains) is invisible to the player. In the current overworld combat path, all spells just deal damage numbers with different particle colors.

---

### Scope vs. completeness ratio is inverted

You have 43 systems, 89 spells, 27 locations, 50 quests, 5 companions. You need 1 playable combat encounter, 3 quests, and 1 companion that actually works end-to-end. More breadth makes gaps harder to find and fix, not easier.

---

## Part 5: Code Quality Summary

| File | Rating | Notes |
|------|--------|-------|
| `src/components/Player.js` | Good | Clean, correct, never used |
| `src/systems/CombatSystem.js` | Good | Real damage formula, proper EventBus usage |
| `src/systems/TacticalCombatSystem.js` | Good | Grid logic correct, positioning defined but never applied |
| `src/core/EventBus.js` | Good | Solid; no error boundary in `emit()` (uncaught callback throws propagate) |
| `src/scenes/GameScene.js` | Poor | God object, 700+ lines, duplicate player logic, broken zone layout |
| `data/spells.json` | Broken | 48 validation errors: element mismatch + combo ID prefix mismatch |
| `src/systems/DataManager.js` | Good | Hot-reload, fallback data, partial schema validation |

---

## Part 6: Fix Priority Order

Work through these in order. Do not add new features until bugs 1–5 are resolved.

| # | Fix | File(s) | Impact |
|---|-----|---------|--------|
| 1 | ✅ Fix game crash (TutorialSystem) | `GameScene.js:104` | **Done** |
| 2 | Fix 28 invalid spell elements | `spellSchema.js`, `spells.json` | Clears validator noise |
| 3 | Fix 20 broken combo references | `data/spells.json` | Clears validator noise |
| 4 | Fix world height for 27 zones | `GameScene.js:_buildWorld()` | Zones 7–27 become visible |
| 5 | Pick one event naming convention | All files | Fixes silent event misses |
| 6 | Pick one player implementation | `GameScene.js`, `Player.js` | Fixes dead code split |
| 7 | Wire TacticalCombat → CombatSystem damage | Both combat systems | Class pillars actually apply |
| 8 | Add singleton reset on new game | All singleton systems | Fixes stale state on restart |
| 9 | Get one quest fully playable end-to-end | Quest + Dialogue + UI | First real game loop |
| 10 | Wire one companion fully | CompanionSystem + CompanionPanel | First social system works |

---

## Bottom Line

The infrastructure is real and largely correct. The architectural instincts are sound. The damage formula is better than most hobby projects. The Sap Cycle is a genuinely interesting mechanic.

The problems are: a broken player architecture (two implementations, one dead), a broken world layout (27 zones rendered in a 6-zone grid), two combat systems that don't talk to each other, 48 data validation errors, and a breadth-over-depth problem where almost nothing is playable end-to-end.

Fix the six bugs above and you'll have something you can actually play. Then build depth before building more breadth.
