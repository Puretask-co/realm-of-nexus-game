# Implementation Guide: Systems, Gaps, Vertical Slices & Player Paths

**Realm of Nexus: Verdance** (Phaser 3 + Vite)

This document is the **single overview** for: what exists in code today, what is specified but incomplete, what we want next, **vertical slices** (playable proof-of-concept loops), and **player paths** (flows that should exist vs need building).  

**Companion docs:** `AGENTS.md` (repo root — index), `docs/ONBOARDING.md` (full map), `BUILD_PLAYBOOK_AND_ROADMAP.md` (**master plan** — vision, phased roadmap, workflow), `FEATURE_CHECKLIST.md` (tick-box backlog), `CLAUDE_AGENT_GUIDE.md` (AI agent procedures, patterns, pitfalls, system prompt), `DESIGN_DOCUMENT_ANALYSIS.md` (design history / GDD alignment), `ARCHITECTURE.md` (stack snapshot — verify counts against repo).

**Last updated:** 2026-03-29

---

## 1. How to use this document

| Audience | Use |
|----------|-----|
| **Developers** | Sections 2–4 for wiring truth; section 6 for integration gaps. |
| **Design / narrative** | Sections 5, 7, 8 for paths and content. |
| **Milestones** | Section 9 (vertical slices) — pick one slice and ship it before expanding scope. |

---

## 2. Runtime architecture (what actually runs)

### 2.1 Scene flow

Registered in `src/main.js`:

```
BootScene → ClassSelectionScene → CharacterCreationScene → GameScene  (+ UIScene launched in parallel)
```

| Scene | Role |
|-------|------|
| **BootScene** | Loads `DataManager` JSON, placeholder textures/audio, then starts class selection. |
| **ClassSelectionScene** | Player picks Verdance class. |
| **CharacterCreationScene** | Ancestry, attributes, Pure/Blighted variant, backstory. |
| **GameScene** | Main world: movement, zones, NPCs, enemies, overworld spells, tactical encounters, systems tick. |
| **UIScene** | HUD overlay (runs alongside GameScene). |
| **EditorScene** | In-game editor — **F2** from `GameScene` (`scene.switch`). Dev tool, not required for players. |

**Note:** `src/scenes/PreloadScene.js` exists but is **not** registered in `main.js`; asset loading today is split between BootScene placeholders and DataManager. Treat PreloadScene as **legacy / unused** unless you wire it in.

### 2.2 Data pipeline

On boot, `DataManager` loads (among others): `spells.json`, `enemies.json`, `items.json`, `locations.json`, `quests.json`, `dialogues.json`, `skills.json` (talent trees + skill categories), `classes.json`, `ancestries.json`, `story.json`, `veilkeepers.json`, `companions.json`, `config.json`.

`ContentInitializer` registers quests, dialogues, factions, narrative, companions, talent trees into the right systems from `GameScene.create()`.

---

## 3. Systems inventory

Legend: **Have** = wired in main play path. **Partial** = code/data exists; UI, balance, or hooks incomplete. **Spec** = described in GDD / JSON but not fully simulated. **Missing** = not implemented.

### 3.1 Core engine

| System | Status | Notes |
|--------|--------|------|
| Phaser 3 + Vite | Have | `npm run dev` / `npm run build` |
| DataManager + schemas + hot-reload | Have | Validation relaxed to match Verdance JSON |
| EventBus | Have | Cross-system events |
| SaveManager + ContentInitializer wiring | Have | Many subsystems serialize via `save-collect` / `save-restore` |
| PerformanceProfiler (F3) | Have | If hooked in Boot/UI |
| AdvancedLightingSystem | Have | Phase ambient driven by SapCycleLightingIntegration |
| AdvancedParticleSystem | Have | `burst()` + presets |
| AdvancedCameraSystem | Have | Follow, zones, shake, framing helpers |
| SpellVFXIntegration | Have | Listens to `spell-cast` / `spell-impact`; needs `caster` on events |
| SapCycleLightingIntegration | Have | `phase-changed` + per-frame update |
| TacticalCombatCameraBridge | Have | Tactical event → shake / light zoom only |
| CombatCameraIntegration | Missing API match | Expects controllers not on AdvancedCameraSystem |
| CameraZoneSystem | Partial | Library; GameScene uses `cameraSystem.addZone` instead |
| ParticleCollisionSystem | Missing wiring | Optional |
| CSVDataLoader, SceneLoader | Partial | Editor / export; not main gameplay |
| NormalMap / PostProcessing pipelines | Have | Registered; may fall back on GPU failure |

### 3.2 Gameplay singletons (GameScene)

Instantiated or retrieved in `GameScene.create()`:

| System | Status | Notes |
|--------|--------|------|
| SapCycleManager | Have | 15-day calendar; emits `phase-changed` |
| CombatSystem | Have | Shared combat math / events |
| TacticalCombatSystem | Have | Grid combat, AP, Guard, pillars data |
| AISystem | Have | Hooked; overworld uses simplified GameScene AI too |
| ProgressionSystem | Have | XP / levels — align cap with GDD intentionally |
| SpellSystem | Partial | Used when casting through SpellSystem path; overworld often uses GameScene `_castSpell` |
| QuestSystem | Have | `quests.json` registered |
| DialogueSystem | Have | `dialogues.json`; overlay UI |
| PlayerClassSystem | Have | `classes.json` |
| DSPSystem | Have | Shared pool, thresholds, drain/recover |
| AttributeSystem | Have | Might/Agi/Res/Ins/Cha |
| FactionSystem | Have | Reputation |
| VeilkeeperSystem | Partial | Logic + data; **no dedicated consultation UI** |
| NarrativeSystem | Partial | Eras/acts loaded; **full era gating** not player-visible everywhere |
| MoralChoiceSystem | Partial | State exists; **no universal choice overlay** |
| CompanionSystem | Partial | Definitions + save; party UX varies |
| CraftingSystem | Partial | Instantiated; **crafting UI thin / missing** |
| SkillCheckSystem | Partial | 12 skills in **code**; `skills.json` categories are separate from check IDs |
| DifficultySystem | Have | Multipliers |
| AIDungeonMaster | Partial | Needs API key + UI queue for production feel |
| CooldownManager | Have | |
| SaveManager | Have | Auto-save |

### 3.3 Renderers / components

| Piece | Status | Notes |
|-------|--------|------|
| DamageNumberRenderer | Have | Listens to `damage-number` sparingly to avoid duplicates |
| MinimapRenderer | Have | Bound to player + enemies |
| NPC | Have | E to talk; dialogueId wiring |
| Player / Enemy patterns | Partial | Enemy uses overworld sprites + tactical defs |

### 3.4 UI (UIScene / panels)

| Piece | Status | Notes |
|-------|--------|------|
| HUD / phase / stats | Partial | Verify all bars match DSP + Sap + real stats |
| SkillTreePanel + talent trees | Partial | Data-driven; point spend / effects need verification |
| Inventory | Partial | Exists; shop sell loop may be incomplete |
| Pause / settings / spellbook | Missing | See checklist |

---

## 4. “Specified but not fully working” (common cases)

These are **not** necessarily bugs — they are **expectation mismatches** between docs, data, and runtime.

| Topic | What’s true |
|-------|----------------|
| **Personal Sap vs DSP** | Design stressed shared DSP; game still uses **personal Sap** for many spells + **DSP** drain. Both exist — document the hybrid until fully unified. |
| **Skill data vs SkillCheckSystem** | `skills.json` has categories/ranks; **SkillCheckSystem** uses **fixed 12 IDs** in code. Dialogue “skill checks” must call those IDs or you extend the system. |
| **SpellSystem vs GameScene casting** | Two paths: SpellSystem cast vs direct `_castSpell`. VFX integration listens to **EventBus** `spell-cast` with **caster** — ensure both paths emit consistently if you unify. |
| **NPC count vs dialogue cast** | Many characters in `dialogues.json`; **fewer** hand-placed NPCs in `GameScene`. Some content is only reachable if dialogue is triggered by quests/commands. |
| **CombatCameraIntegration** | **Spec / code exists**; **does not run** — camera API mismatch. **TacticalCombatCameraBridge** is the active substitute. |
| **Max level** | GDD sometimes says 10; **ProgressionSystem** may allow higher — decide and align. |

---

## 5. What we want but don’t have yet (high level)

Consolidated from `FEATURE_CHECKLIST.md` and design docs:

- **Player-facing:** pause menu, settings, quest journal with clear objectives, world/map screen, spellbook, strong DSP/world-health readout, shops with buy/sell, crafting stations UI, Veilkeeper consultation UI, moral choice overlay, ending screens / routing.
- **Gameplay depth:** overworld enemy leashes + tuned speeds, melee/basic attacks if required, terrain-tagged tactical tiles, boss phases + intent UI, full loot/economy loop.
- **Narrative:** era transitions visible in UI, 50+ NPCs in world or justified shortcuts, 40+ quests with review for broken links.
- **Production:** README, CI, Playwright smoke tests, audio pass, accessibility options.

---

## 6. Vertical slices (playable milestones)

A **vertical slice** is a **thin end-to-end path** you can demo: not “all systems maxed,” but **one complete player story** through boot → play → outcome → save.

Below are **distinct slices** you can implement in **priority order**. Each has **entry**, **must prove**, and **exit criteria**.

### Slice A — **Core combat loop** (minimum game)

| Stage | Content |
|-------|---------|
| **Entry** | New game from Boot → class → character create → GameScene. |
| **Must prove** | Move in overworld, cast spell (VFX + damage), touch enemy → **tactical combat** starts → win/lose → return to overworld, **auto-save** doesn’t corrupt. |
| **Exit criteria** | No hard crashes; DSP/Sap/cooldowns behave; one enemy defeat grants XP/loot if wired. |

**Build focus:** balance numbers, tactical UI clarity, save/load regression tests.

---

### Slice B — **Narrative quest loop**

| Stage | Content |
|-------|---------|
| **Entry** | Same as A; trigger dialogue with an NPC that has `dialogueId` + quest hook. |
| **Must prove** | Accept quest → objective updates in QuestSystem → complete condition (kill/fetch/talk) → reward + **DSP/faction** if in data → persistence after save. |
| **Exit criteria** | At least **one** full quest chain testable in under 10 minutes. |

**Build focus:** quest objective UI, NPC placement, `quests.json`/`dialogues.json` consistency, remove dead links.

---

### Slice C — **Economy & inventory**

| Stage | Content |
|-------|---------|
| **Entry** | Player has gold/items from rewards. |
| **Must prove** | Open shop (or NPC shop action) → **buy** → inventory updates → **sell** → gold updates → **save/load** preserves state. |
| **Exit criteria** | Gold and items never desync from UI. |

**Build focus:** shop panel, inventory panel wiring, `items.json` prices.

---

### Slice D — **Crafting**

| Stage | Content |
|-------|---------|
| **Entry** | Player has materials; crafting station or NPC triggers crafting UI. |
| **Must prove** | Recipe from data → spend mats → receive item → save. |
| **Exit criteria** | At least 3 recipes feel intentional, not debug. |

**Build focus:** CraftingSystem UI, recipe tables in data, feedback on failure.

---

### Slice E — **Social / faction / moral**

| Stage | Content |
|-------|---------|
| **Entry** | Mid-game reputation and a quest with a **moral fork**. |
| **Must prove** | Choice changes **faction rep** or **flags** → reflected in dialogue or prices → saved. |
| **Exit criteria** | Player can explain *what changed* after the choice. |

**Build focus:** MoralChoiceSystem UI, FactionSystem HUD or summary screen.

---

### Slice F — **Veilkeeper + AI DM** (differentiator)

| Stage | Content |
|-------|---------|
| **Entry** | Player opens Veilkeeper panel, picks keeper, pays cost. |
| **Must prove** | Consultation uses **VeilkeeperSystem** rules (ticks, death) + optional **AIDungeonMaster** text with fallback if no API key. |
| **Exit criteria** | Consultation is a **deliberate** choice with visible cost and consequence. |

**Build focus:** UI layer, API key config, safe copy if offline.

---

### Slice G — **Campaign / ending** (late)

| Stage | Content |
|-------|---------|
| **Entry** | Late-game flags satisfied (DSP, factions, hollowing, bosses). |
| **Must prove** | **EndingEvaluator**-style branch → ending scene or credits → save epilogue state. |
| **Exit criteria** | At least 2 distinct endings testable. |

**Build focus:** story flags, ending scenes, no soft-lock.

---

**Recommendation:** Ship **A**, then **B**, then choose **C or D** based on whether you want “RPG shopping” or “survival crafting” to sell the fantasy first.

---

## 7. Player paths (flows)

### 7.1 Paths that **exist today** (implemented flow)

| Path | Steps |
|------|--------|
| **New game** | Boot load data → class pick → character creation → GameScene spawn. |
| **Explore overworld** | WASD, zones, minimap, phase changes (lighting + HUD if wired). |
| **Talk to NPC** | Approach → `[E] Talk` → dialogue / optional `dialogueId` → richer DialogueSystem trees. |
| **Overworld spell** | Keys 1–5 → costs Sap + DSP → VFX integration → damage/heal. |
| **Tactical encounter** | Overlap enemy group → tactical layer → `tactical:*` events → return to overworld. |
| **Auto-save / manual save** | SaveManager events; ContentInitializer bundles subsystem state. |
| **Editor** | F2 → EditorScene (dev). |

### 7.2 Paths **partially** implemented (need wiring/UI/content)

| Path | Gap |
|------|-----|
| **Full quest arc** | Data often exists; **journal + pins + edge cases** incomplete. |
| **Shops** | NPC defs may include `shopInventory`; **dedicated shop UX** may be missing. |
| **Crafting** | System exists; **station UI** thin. |
| **Companions in combat** | Tactical can add allies; **recruitment + persistent party** needs pass. |
| **Veilkeeper consultation** | Logic exists; **no full screen flow**. |
| **Moral choices** | System state exists; **not every quest uses overlay**. |
| **AI Dungeon Master** | Scaffold; needs **key + UI + rate limits**. |
| **Six-era campaign** | `story.json` + NarrativeSystem; **gated world progression** not fully player-visible. |

### 7.3 Paths **to build** (design intent, not done)

| Path | Description |
|------|-------------|
| **Fast travel / map jump** | No world map travel UI; only walk. |
| **Pause → settings → resume** | Standard expectation for shipping. |
| **Ending route** | Branching endings from faction/DSP/hollowing. |
| **Pure vs Blighted** | Character creation choice → **different spell access / story** end-to-end. |
| **100% dialogue coverage** | Every `dialogues.json` character has a **world presence or cheat route**. |

---

## 8. Player personas / “paths” by play style (design targets)

These are **product paths**, not all implemented:

| Persona | Wants | Systems involved | Build priority |
|---------|--------|------------------|----------------|
| **Skirmisher** | Combat clarity, builds, gear | Tactical, items, progression | Slices A + C |
| **Lore seeker** | Dialogue, eras, codex | Narrative, quests, spellbook UI | Slices B + G |
| **Sandbox economist** | Craft, shop, factions | Crafting, factions, DSP | Slices C + D + E |
| **Moral / RP** | Choices, endings | Moral, factions, Veilkeeper | Slices E + F + G |

Use these to **justify** which vertical slice comes after B.

---

## 9. Implementation handoff checklist (when starting a slice)

1. **Name the slice** (A–G) and **time box** (e.g. 1–2 weeks).
2. **List scenes touched** (usually GameScene + UIScene + data).
3. **Add one Playwright or manual script**: steps from section 6 for that slice.
4. **Update `FEATURE_CHECKLIST.md`** when something flips from `[ ]` to `[x]` / `[~]`.
5. **Note breaking changes** in README if data schema changes.

---

## 10. Related files

| File | Purpose |
|------|---------|
| `docs/FEATURE_CHECKLIST.md` | Granular checkbox backlog |
| `docs/DESIGN_DOCUMENT_ANALYSIS.md` | Design vs code history |
| `docs/ARCHITECTURE.md` | Stack overview (refresh counts periodically) |
| `docs/GAP_ANALYSIS_AND_IMPLEMENTATION_GUIDE.md` | Godot-era reference — cross-check ideas only |
| `src/main.js` | Scene registration |
| `src/scenes/GameScene.js` | Main orchestration |
| `src/systems/ContentInitializer.js` | Data → systems registration |
| `data/*.json` | Authoritative content |

---

*Maintainers: when a vertical slice is completed, add a dated subsection under §6 with “Completed YYYY-MM-DD” and link to release or PR.*
