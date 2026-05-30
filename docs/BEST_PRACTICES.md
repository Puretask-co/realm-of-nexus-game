# Best Practices — Realm of Nexus

**Read this before touching code.** It captures the rules that have already prevented (or, when missed, caused) real bugs in this project. Each rule has a *why* tied to a specific past defect so the rule isn't arbitrary.

> **Pinned reading order for agents:**
> `AGENTS.md` → `docs/CLAUDE_AGENT_GUIDE.md` → **this file** → the doc most relevant to your task.

---

## 1. The verification rule (the one that's bitten us most)

**Every change must be verified to produce the intended end-state, not just compile and pass the call-site.**

> **Why:** PR #31's centralised `game:reset` handler called `loadState({})` on 13 systems. Each `loadState` is defensively written as `if (data.field) ...` so passing `{}` resets nothing. The handler ran, logged success, and **mutated zero state**. Same PR's panel `_unsubs` cleanup was correct per-panel — but `UIScene.shutdown` never called `panel.destroy()`, so the cleanup never ran. Both fixes looked right at the call-site; both were globally inert.

**Concrete checks:**
- After adding a listener cleanup, **trace upward** until you find the code that invokes the cleanup. If nothing does, your fix is dead.
- After adding a state-reset, **drive it** (browser test or unit) and assert at least one polluted field returns to its default.
- After adding an event emit, **grep for a listener of that exact event name**. If none, decide: rename to match the existing listener, add a listener, or delete the emit.

---

## 2. EventBus discipline

The game's communication backbone is `src/core/EventBus.js`. Most bugs in this project trace to event-bus mismatches.

### 2.1 Event naming

**One canonical name per event.** Pick a casing and stick to it. Our convention:
- **`namespace:action`** for game events: `quest:completed`, `spell:unlocked`, `tactical:turnStart`
- **`namespace-action`** (dash) form is **legacy**; do not introduce new dash forms. If you find a dash variant emitted, also emit the colon form, then deprecate the dash.

> **Why:** `enemy:defeated` (QuestSystem listener) vs `enemy-defeated` (3 emit sites) meant kill quests barely progressed for months. `spell:learned` vs `spell:unlocked` had the same shape.

### 2.2 Every `EventBus.on(...)` must be unsubscribed

The bus is a singleton that outlives scenes. Anything that calls `.on()` must:

```js
this._unsubs = this._unsubs || [];
this._unsubs.push(EventBus.on('name', handler));
// …later…
destroy() {
  if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
  this._unsubs = [];
}
```

And the **owning scene must call `destroy()`** on its panels in `shutdown()`. UI panels that don't have a parent invoking them are listener leaks waiting to happen.

> **Why:** without this, every scene restart (death respawn, new game) accumulates handlers that fire on stale state.

### 2.3 Listed-events table

Before adding a new event, scan `docs/ARCHITECTURE.md` (events table) and existing emits/listens. If something close exists, **reuse it**. Don't introduce siblings like `combat:hit` and `combat:struck`.

### 2.4 Synthetic emits during testing

Emits with partial payloads will hit production handlers. **Add defensive `if (!enemy || !enemy._state) return;` early-returns** to handlers that read sprite-specific fields. Tests should not require production handlers to be perfect, but production handlers should not crash on legitimate alternate payload shapes.

---

## 3. Singleton lifecycle

All `*System` files in `src/systems/` use the `getInstance()` pattern and live across scene restarts and "New Game". Three rules:

### 3.1 State that the player accumulates **must reset on `game:reset`**

A new game in the same browser session must truly start fresh. The pattern:

```js
// In your system:
/** Clear playthrough state for a fresh New Game. */
reset() {
  this.fieldA = initialValue;
  this.fieldB = new Set();
  // …mirror constructor's initial state for player-progress fields only.
  // Definitions (data loaded from JSON) are kept.
}
```

**Do NOT rely on `deserialize({})` to clear state.** Most deserializers are written defensively (`if (data.field) ...`) and a `{}` payload triggers zero writes. The `reset()` method must explicitly assign defaults.

> **Why:** see §1. The `loadState({})` approach was inert for 13 systems.

### 3.2 Wire it both ways

Add the system to `src/systems/ContentInitializer.js` in **three** places:
1. `save-collect` (writes `serialize/saveState` output into `saveData`)
2. `save-restore` (calls `deserialize/loadState` from `saveData`)
3. `game:reset` (calls `reset()` — the central handler already handles this if you implement `reset()`)

> **Why:** 4 systems (CraftingSystem, EquipmentSystem, DifficultySystem, AIDungeonMaster) had save methods but were never wired into the bundle. Player state was silently lost on save/load.

### 3.3 Save → load round-trip must be symmetric

If `serialize()` writes a field, `deserialize()` must read it. If `deserialize()` doesn't restore field X, then field X is functionally not saved. Add a test or audit pass after touching either.

---

## 4. Data integrity

### 4.1 References must resolve

Quest objectives that target `enemyId`, `itemId`, `locationId`, `dialogueId`, `questId` etc. — **every id must exist in the corresponding `data/*.json`.**

> **Why:** 61 broken references across 4 categories (quest→location, quest→dialogue, companion→quest, recipe→location). The validator only checks 2 categories so the others silently rot.

### 4.2 `npm run validate-data` should actually validate

The script is currently shallow (parse-only). When extending data, also extend `src/systems/DataManager.js` `checkReferences()` to cover the new field. CI catches what `validate-data` runs.

### 4.3 Don't author two parallel content layers

> **Why:** `data/companions.json` (Vaeril/Sylor/Aeliana/Mycon/Kaelen) was authored separately from `data/quests.json` companion quests (kael/yenna/althea/briara/veyla). They never reconciled. Solution: **one roster, one canon list**, content references that list.

### 4.4 When adding a new content kind, validate at load time

`DataManager.validateAllData()` runs at boot. New fields should be checked there or in a new `checkReferences()` clause. Don't punt validation to "later".

---

## 5. UI panels

### 5.1 The panel lifecycle template

Every panel in `src/ui/` must follow this shape:

```js
export class FooPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this._unsubs = [];
    this._build();
    this._wireEvents();
  }

  _wireEvents() {
    this._unsubs.push(EventBus.on('foo-open', (d) => this.open(d)));
    // …
  }

  show()  { /* ... */ this.visible = true;  this.container.setVisible(true); }
  hide()  { /* ... */ this.visible = false; this.container.setVisible(false); }

  destroy() {
    if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
    this._unsubs = [];
    this.container?.destroy();
  }
}
```

And in `UIScene.shutdown()`:

```js
const panels = [this.fooPanel, this.barPanel, /* … */];
for (const p of panels) { try { p?.destroy?.(); } catch (_) {} }
```

### 5.2 Hotkey ownership

For a key that opens a sub-scene (M / H / W / C):
- The **outer scene** binds the key only to **open** the sub-scene.
- The **sub-scene** binds the key to **close itself**.
- Use `if (this.scene.isActive('TargetScene')) return;` in the outer handler to no-op when the sub-scene is already up.

> **Why:** both handlers firing in the same frame caused open/close flicker on M, H, W, C.

### 5.3 No orphan UI files

If a panel is never imported outside `src/index.js` re-exports, **delete it**. Leftover files become decision-debt — every future agent must check whether they're alive.

> **Why:** 4 files (HUDPanel, MainMenuPanel, AttributeAllocationPanel, HotReloadOverlay) were dead for months. HUDPanel was 228 lines duplicating UIScene's HP/SAP bars.

### 5.4 Use the existing HUD; don't draw the same bar twice

Before adding HP/Sap/DSP/XP/gold rendering, search UIScene for the existing element. The HUD is in UIScene, not in panels.

---

## 6. Scenes

### 6.1 Every scene needs `shutdown()`

Even if the scene seems to have no listeners. Phaser auto-cleans `scene.input.keyboard.on(...)` handlers, but **EventBus listeners are NOT auto-cleaned** — they survive scene shutdown. If a future edit adds an EventBus listener and the scene has no `shutdown()`, the leak is silent.

```js
shutdown() {
  if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
  this._unsubs = [];
}
```

### 6.2 GameScene is the orchestrator, not the simulator

GameScene wires player input, owns the world rendering, and routes between systems. It should **not** duplicate logic that belongs in a system. If you find yourself writing combat math or quest progression in GameScene, that probably belongs in `TacticalCombatSystem` / `QuestSystem`.

### 6.3 Dev hooks live behind `import.meta.env.DEV`

`window.__gameDebug`, `window.__GAME`, console logging gates — all DEV-only. Production builds must be clean.

---

## 7. Combat (tactical grid)

### 7.1 The renderer is a pure view

`TacticalGridRenderer` reads state via `TacticalCombatSystem.getCombatState()` and routes input back through the system's public actions (`moveAction`, `attackAction`, `castSpell`). It must **not mutate combat state directly**. This separation is why the click-to-move + click-to-attack + hover-preview + spell targeting all stack cleanly.

### 7.2 New combat actions: AP cost + DSP cost + emit + log

Every player-facing action follows this template:

```js
fooAction(args) {
  if (!this.currentActor || this.currentAP < cost) return { success: false, reason: 'No AP' };
  // validate (range, target, status …)
  this.currentAP -= cost;
  this.currentActor.entity.stats.ap = this.currentAP;
  // perform the action (mutate state)
  this._log(`${actor.name} did foo`);
  this.eventBus.emit('tactical:foo', { /* payload */ });
  return { success: true /* extra fields the renderer needs */ };
}
```

### 7.3 Damage formulas live in one place

`attackAction` is the source of truth for d20 + might vs evasion. The hover-preview's `getHitChance()` mirrors that math. **If you change one, change the other** — XCOM-style readability is built on the player trusting the preview.

### 7.4 Status effects need to tick

If you add a new status effect type, extend `_tickEffects` in `TacticalCombatSystem`. Effects applied but never ticked are silent.

---

## 8. Data / content authoring

### 8.1 Adding a new quest

In `data/quests.json` your quest must have:
- `id`, `title`, `name`, `description`, `type`, `category`, `level`
- `prerequisites: []` (or list of `{type:'quest', questId}` / `{type:'level', level}`)
- `objectives: [{ id, type: 'kill'|'collect'|'travel'|'dialogue'|'interact', target, required }]`
- `rewards: { experience, gold, items:[{id, quantity}] }`
- If `isMainQuest: true`, add the quest id to `NarrativeSystem.MAIN_QUEST_ACTS` map.

Every `target` id must resolve in the matching data file:
- `kill` → enemy in `data/enemies.json`
- `collect` → item in `data/items.json`
- `travel` → location in `data/locations.json`
- `dialogue` → dialogue id in `data/dialogues.json`
- `interact` → world beacon (placed via `_refreshQuestBeacons`)

### 8.2 Adding a new location

In `data/locations.json`:
- `id`, `name`, `description`, `type`, `level`, `tier`, `zone`
- `connections: []` (other location ids)
- `enemies: []` (enemy ids — must exist in `data/enemies.json`)
- `npcs`, `services`, `requirements`
- `environment: { weather, timeOfDay, ambientColor }`

Then map the new location id to a realm in `src/scenes/ZoneBackdrops.js` `ZONE_REALM` so the backdrop panels render. Reuse an existing realm if the theme fits — no new art required.

### 8.3 Adding a new spell

In `data/spells.json` under `spells: [...]`:
- `id`, `name`, `class` (or `'shared'`), `tier`, `element`
- `apCost` (1/2/3), `dspCost` (5 / 10-15 / 20-30 by tier)
- `range`, `targetType`, `areaOfEffect`
- One of: `damage` (flat or dice `"2d8"`), `healAmount`, or `statusEffect: {type, duration, value}`
- `phaseModifiers: { crimson, silver, blue }` (damage multipliers)

DSP-only is canon: don't add `sapCost`.

### 8.4 Adding a new companion

In `data/companions.json` (the canonical roster), with:
- `id`, `name`, `title`, `class`, `role`, `description`, `personality`
- `baseStats: { might, agility, resilience, insight, charisma, hp, guard }`
- `abilities: []`, `recruitLocation`, `recruitQuest`, `bondEvents: []`, `personalQuest`
- Boot flags: `recruited: false`, `bondLevel: 0`, `bondXP: 0`, `inParty: false`, `alive: true`

Both `recruitQuest` and `personalQuest` ids **must exist** in `data/quests.json`.

---

## 9. Verification — every PR

Before opening a PR you must complete this checklist:

- [ ] `npm run build` passes
- [ ] `npm run validate-data` passes
- [ ] If touching gameplay logic: **driven in a real browser** (the bundled Chromium pattern — see `docs/CLAUDE_AGENT_GUIDE.md`) with at least one assertion proving the behaviour, plus a screenshot if visual
- [ ] If adding a system reset: pollute a field, fire `game:reset`, assert default returns
- [ ] If adding a UI panel: confirm it opens, closes, and is in `UIScene.shutdown`'s destroy list
- [ ] If adding an EventBus listener: confirm `_unsubs.push(...)` and panel/scene `destroy/shutdown` clears it
- [ ] If adding a content reference: confirm the target id exists (e.g. `node -e "require('./data/foo.json')"`)

### Browser test pattern

The dev sandbox has a bundled Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Drive it from a `scratch_*.mjs` script in the project root (so Node can resolve `@playwright/test`). Capture `window.__gameState`, drive actions via the panel/system objects exposed on `window.__GAME`, and assert on real state changes. The dev server takes 10-15s to fully boot under WebGL — poll patiently.

---

## 10. Process

### 10.1 PR size

Small, contained PRs. Each PR description must list:
- **What** changed
- **Why** (what bug or feature)
- **Verification** (the assertion that proves it works)
- **Known follow-ups** (the things you intentionally didn't fix)

### 10.2 Re-audit after merging

After a PR that touches multiple systems, run a re-audit (spawn parallel agents to verify the fixes actually took effect downstream). This caught two inert "fixes" in this codebase already.

### 10.3 Don't trust the docs over the code

The codebase has ~19 design docs, some stale. When the code disagrees with a doc, **the code wins** and the doc gets updated. `docs/GAME_VISION.md` is the consolidated source of truth.

### 10.4 Honest reporting

If something isn't browser-verified, say so. If the build passes but the feature wasn't play-tested, say so. The user has limited time; false confidence costs them more than a flagged caveat.

---

## Appendix — past defects this guide would have prevented

| Defect | Cause | Rule that covers it |
|---|---|---|
| `game:reset` handler inert | `loadState({})` on defensive deserializers | §1 verification, §3.1 reset pattern |
| Panel `_unsubs` never called | `UIScene.shutdown` didn't destroy panels | §1 verification, §5.1 lifecycle template |
| Kill quests didn't progress | `enemy:defeated` vs `enemy-defeated` | §2.1 event naming, §2.3 listed-events |
| Save dropped recipes/equipment/difficulty/AIDM state | 4 systems not in `wireSaveSystem` | §3.2 wire it both ways |
| 61 broken refs (quest→location, etc.) | DataManager validates 2 of 13 ref categories | §4.1 references must resolve, §4.2 validator |
| Two parallel companion rosters | Content authored in isolation | §4.3 don't author two layers |
| HUDPanel duplicating UIScene | Old code never deleted | §5.3 no orphans, §5.4 reuse the HUD |
| 4 orphan UI files | Same | §5.3 |
| M/H/W/C hotkey double-fire | Both outer + sub-scene handlers ran | §5.2 hotkey ownership |
| Phaser pipelines crashed under Canvas | No graceful fallback | §10.4 honest reporting + verification on multiple paths |
| 36 files missing `import Phaser` | Bundling hoisted a global; dev ESM didn't | §9 build + browser check |
| `_serializeGrid` crashed post-combat | No guard for cleared grid | §2.4 defensive handlers |
