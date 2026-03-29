# Build Playbook & Roadmap — Realm of Nexus: Verdance

This document answers three questions in one place: **what we are designing**, **what we are building**, and **in what order we implement it** so the team can follow the docs and ship the game without re-deriving the plan.

**Companion documents (read in this order when onboarding):**

| Order | Document | Role |
|-------|----------|------|
| 0 | **`AGENTS.md`** (repo root) | Master index for humans + AI — links to everything below |
| 1 | **This file** | Vision, phases, dependencies, workflow |
| 2 | `IMPLEMENTATION_AND_PATHS_GUIDE.md` | What exists in code today, vertical slices A–G, player paths |
| 3 | `FEATURE_CHECKLIST.md` | Granular `[x]` / `[~]` / `[ ]` backlog — update as you ship |
| 4 | `ARCHITECTURE.md` | Stack, folder map, engine decision (Phaser) |
| 5 | `DESIGN_DOCUMENT_ANALYSIS.md` | Design history, resolved vs open contradictions, content counts |
| **Agents** | `CLAUDE_AGENT_GUIDE.md` | Procedures, **copy-paste system prompt**, sufficiency assessment, expected outputs, Windows/shell notes |
| **Map** | `docs/ONBOARDING.md` | Full documentation table of contents |

**Last updated:** 2026-03-29

---

## 1. What we are designing and building

### 1.1 Product in one sentence

**Realm of Nexus: Verdance** is a **2D Verdance-fantasy tactical RPG** (browser-first, Phaser 3) where **magic draws on a shared world resource (DSP)**, a **15-day Sap Cycle** reshapes phases and lighting, and **narrative systems** (quests, factions, moral choices, Veilkeepers, optional AI Dungeon Master) support a **multi-era campaign** with **multiple endings**.

### 1.2 Genre and loop (authoritative)

- **Overworld:** Real-time movement, exploration, NPC interaction, overworld spell combat using keys and targeting.
- **Encounters:** Transition to **grid-based tactical combat** (AP, Guard, positioning bonuses, undo) — not a pure action RPG.
- **Progression:** Classes, ancestries, Pure/Blighted variant, five core attributes, XP, talents/skills, items, crafting.
- **Meta-systems:** Factions, companions, Veilkeeper consultations (permanent death), moral choice tracking, narrative eras from `story.json`.

This hybrid (RT explore + tactical battles) is the **intended** design; older design logs sometimes read as “full tactical only” or “full action only” — **the codebase implements the hybrid** (see `DESIGN_DOCUMENT_ANALYSIS.md` § Implementation table).

### 1.3 Design pillars (what every feature should reinforce)

1. **Restraint as power** — Spellcasting and major actions cost **DSP** (shared pool); thresholds change the world. Personal Sap may still exist for some abilities — treat the **documented hybrid** in `IMPLEMENTATION_AND_PATHS_GUIDE.md` §4 as truth until fully unified.
2. **Temporal pressure** — **Sap Cycle** phases (blue → crimson → silver) affect lighting, modifiers, and pacing.
3. **Meaningful positioning** — Tactical grid rewards flanks, cover, and class “pillar” mechanics.
4. **Consequence** — Factions, moral flags, Veilkeeper death, and endings react to choices.
5. **Data-driven content** — Quests, dialogues, spells, items, locations live in `data/*.json` and flow through `DataManager` + `ContentInitializer`.

### 1.4 Unique selling points (build toward these)

1. **AI Dungeon Master** (optional, API-driven) — emergent narration layered on structured quests.
2. **DSP as world health** — not silent solo mana; UI and events should communicate cost to the **domain**.
3. **Veilkeepers** — consultation has real cost; **permanent death** of mentors is a differentiated stakes mechanic.
4. **Sap Cycle** — calendar + phase shifts as a core clock, not cosmetic skybox.
5. **Restraint-based progression** — reward patience and planning in balance and systems.

### 1.5 Scope boundaries (non-goals unless explicitly re-scoped)

- **Not** a 3D engine migration (stay Phaser — see `ARCHITECTURE.md`).
- **Not** shipping with every design-doc class name if data and `classes.json` are the agreed source of truth — **rename in data + UI**, not in scattered code guesses.
- **Not** “finish all content before any UI” — **vertical slices** first (playable loops), then volume.
- **Not** relying on `CombatCameraIntegration` until refactored — use `TacticalCombatCameraBridge` and `AdvancedCameraSystem` as documented.

---

## 2. What “done” looks like (release criteria)

Use this as the **north star**; phases below are how we get there.

| Layer | Release criteria |
|-------|------------------|
| **Playable** | New game → explore → fight (overworld + tactical) → save/load without corruption. |
| **Understandable** | HUD explains Sap, DSP, phase; journal shows active quests; pause/settings exist. |
| **RPG complete** | Shop buy/sell, crafting loop, faction/moral consequences visible in gameplay. |
| **Campaign complete** | Era progression is player-visible; at least **two** ending branches playable from flags. |
| **Content** | Meet or justify gaps vs targets in `FEATURE_CHECKLIST.md` §8 and `DESIGN_DOCUMENT_ANALYSIS.md` § Content Scope. |
| **Production** | README, build/CI, smoke tests, credits, accessibility basics. |

---

## 3. How we will build everything (phased roadmap)

Principle: **one vertical slice at a time** — each phase produces a **demoable increment**, not a pile of half-wired systems.

Phases map to **slices A–G** from `IMPLEMENTATION_AND_PATHS_GUIDE.md` §6.

### Phase 0 — Foundation (maintain, don’t redo)

**Goal:** Stable spine for all future work.

**Includes:** Vite + Phaser, `DataManager` + schemas + hot-reload, `EventBus`, `BootScene` → class → character → `GameScene` + `UIScene`, `SaveManager` + `ContentInitializer`, core integrations (lighting, particles, spell VFX, tactical camera bridge).

**Done when:** `npm run build` passes; boot loads data; no known crash on fresh save.

**Docs:** `ARCHITECTURE.md`, `IMPLEMENTATION_AND_PATHS_GUIDE.md` §2–3.

---

### Phase 1 — Slice A: Core combat loop

**Goal:** Prove the **minute-to-minute** game is fun and stable.

**Build:**

- Overworld movement, enemy contact → tactical start → win/lose → return.
- Spell casting paths emit consistent `spell-cast` / `spell-impact` (with `caster` where required).
- Balance pass on `baseDamage` / `damage` / costs in data.
- Regression: save after tactical encounter.

**Done when:** Slice A exit criteria in `IMPLEMENTATION_AND_PATHS_GUIDE.md` §6 (Slice A) are met.

**Updates:** `FEATURE_CHECKLIST.md` — combat, overworld, tactical rows.

---

### Phase 2 — Slice B: Narrative quest loop

**Goal:** One **full** quest chain: accept → track → complete → reward → persist.

**Build:**

- NPC placement or quest triggers for dialogue cast.
- Quest objective clarity (panel or HUD strip); fix broken `quests.json` links.
- Faction/DSP rewards where designed.

**Done when:** Slice B exit criteria met; one chain playable in under ~10 minutes.

**Updates:** `FEATURE_CHECKLIST.md` §6; content counts in `DESIGN_DOCUMENT_ANALYSIS.md` if you add quests.

---

### Phase 3 — Player clarity & shell (infrastructure)

**Goal:** The game is **legible** — players understand resources and can navigate menus.

**Build (typical order):**

1. Pause menu (resume, save, settings stub).
2. DSP / Sap / phase HUD pass — thresholds visible.
3. Quest journal / objective list (even minimal).
4. Settings: audio, key hints; optional accessibility toggles.

**Done when:** A new playtester can explain what DSP is after 15 minutes without reading a README.

**Depends on:** Phases 1–2 (so clarity is tested on real loops).

---

### Phase 4 — Slices C & D: Economy and crafting

**Goal:** Complete **resource loops** — gold and items move through UI.

**Build:**

- Shop UI: buy/sell, NPC inventories, gold sync with `FactionSystem` / saves as needed.
- Loot tables pass: enemies, chests, phase/DSP modifiers where specified.
- Crafting UI: stations, recipes from data, success/fail feedback.

**Done when:** Slices C and D exit criteria met.

**Updates:** `FEATURE_CHECKLIST.md` §5; `items.json` / recipe data.

---

### Phase 5 — Slice E: Social, faction, moral

**Goal:** Choices **matter visibly** before endgame.

**Build:**

- Moral choice overlay for scripted moments.
- Faction rep reflected in prices, dialogue, or access.
- Companion recruitment/bond if in scope for this milestone.

**Done when:** Slice E exit criteria met.

---

### Phase 6 — Slice F: Veilkeepers & AI Dungeon Master

**Goal:** Ship the **differentiators** as product-quality features.

**Build:**

- Veilkeeper consultation UI: pick keeper, cost, outcome, death state.
- `AIDungeonMaster`: API key config, rate limits, offline/safe copy, UI queue.

**Done when:** Slice F exit criteria met; no silent failures when API is missing.

---

### Phase 7 — Slice G: Campaign & endings

**Goal:** **Finish** the story machinery.

**Build:**

- Wire `NarrativeSystem` eras to player-visible transitions (UI, locks, world state).
- Ending evaluation from flags (DSP, factions, hollowing, major choices).
- Ending scenes or credits for at least two branches.

**Done when:** Slice G exit criteria met.

---

### Phase 8 — Content at scale & polish

**Goal:** Meet volume targets and production bar.

**Build:**

- Add enemies, NPCs, quests toward `FEATURE_CHECKLIST.md` §8 targets.
- Audio pass (music crossfade, SFX hooks).
- Tutorials / tooltips for tactical pillars.
- README, CI, Playwright smoke (boot, dialogue, one combat).
- Credits, error handling, performance caps.

**Done when:** §2 “Release criteria” in this document are satisfied.

---

## 4. Dependency overview

```mermaid
flowchart LR
  P0[Phase 0 Foundation]
  P1[Phase 1 Slice A Combat]
  P2[Phase 2 Slice B Quests]
  P3[Phase 3 Clarity UI]
  P4[Phase 4 Economy Craft]
  P5[Phase 5 Social Moral]
  P6[Phase 6 Veilkeeper AI DM]
  P7[Phase 7 Endings]
  P8[Phase 8 Content Polish]
  P0 --> P1
  P1 --> P2
  P2 --> P3
  P3 --> P4
  P4 --> P5
  P5 --> P6
  P6 --> P7
  P7 --> P8
```

**Parallelism:** Art and **data authoring** (quests, dialogues) can run alongside Phase 1–2 if schemas are stable; **avoid** large schema changes without a migration note in this file or `FEATURE_CHECKLIST.md`.

---

## 5. Day-to-day implementation workflow

1. **Pick a phase** (or a slice A–G) from §3 — do not “touch everything.”
2. **Read** `IMPLEMENTATION_AND_PATHS_GUIDE.md` for current wiring truth.
3. **Implement** in small PRs: one system or one UI surface per PR when possible.
4. **Update** `FEATURE_CHECKLIST.md` when behavior flips from partial to done.
5. **Note** data schema changes in PR description (downstream: saves, tools).
6. **Manual test script:** boot → your change → save → reload.

Optional: add Playwright coverage when a path becomes stable (Phase 8).

---

## 6. Roles and ownership (suggested)

| Area | Primary focus |
|------|----------------|
| **Gameplay / systems** | `src/systems/`, `GameScene.js`, tactical + overworld |
| **Content** | `data/*.json`, dialogue graph, quest graph |
| **UI/UX** | `src/ui/`, `UIScene.js`, panels |
| **Integrations** | `src/integration/`, EventBus contracts |
| **Tools** | `EditorScene`, CSV/export, `DataManager` validation |

---

## 7. When design docs disagree with the repo

**Rule:** The **running game + `data/*.json`** are the authority for implementation. Design logs in `DESIGN_DOCUMENT_ANALYSIS.md` capture **history and tensions** (e.g. old 4-class vs 7-class debate).

**Process:**

1. If code and GDD conflict, **decide** in a short note (PR or issue): “We standardize on X.”
2. Update **data** first (`classes.json`, `spells.json`), then **UI strings**, then **docs**.
3. Do not leave silent contradictions in quest/dialogue IDs.

---

## 8. Quick reference — vertical slices

| Slice | Name | One-line purpose |
|-------|------|------------------|
| A | Core combat | Overworld + tactical + save |
| B | Narrative quest | Full quest chain |
| C | Economy | Shop + inventory + gold |
| D | Crafting | Recipes + stations + UI |
| E | Social / moral | Factions + visible consequences |
| F | Veilkeeper + AI DM | Differentiators |
| G | Campaign / endings | Eras + branching endings |

Full criteria: `IMPLEMENTATION_AND_PATHS_GUIDE.md` §6.

---

## 9. After this playbook

When Phase 8 is complete, retire aggressive “gap” language in favor of **patch notes** and **live ops** (balance, events). Keep `FEATURE_CHECKLIST.md` as the living backlog for post-1.0 work.

---

*This playbook is the master implementation guide; keep it updated when phases complete or priorities shift.*
