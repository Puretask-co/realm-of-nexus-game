# Claude Agent Guide — Realm of Nexus: Verdance

**Audience:** Autonomous and semi-autonomous coding agents (Claude Code, Cursor agents, Copilot Workspace, etc.) that implement, extend, or debug this repository.

**Purpose:** Give agents enough **context, constraints, and procedures** to design and build systems **consistently** with the existing architecture, without re-learning the whole repo each session.

**Last updated:** 2026-03-29 (revision: sufficiency assessment, system prompt block, outputs & escalation)

---

## Documentation coverage: is this enough for agents?

**Short answer:** The docs are **strong enough for orientation, constraints, and workflow** — if the agent **actually reads** `CLAUDE_AGENT_GUIDE.md`, `IMPLEMENTATION_AND_PATHS_GUIDE.md`, and the **specific source files** for the task. They are **not** a substitute for reading implementation code on every non-trivial change.

| Strong enough for… | Why |
|--------------------|-----|
| **Architecture & patterns** | Singletons, `GameScene` hub, `ContentInitializer`, `wireSaveSystem`, EventBus semantics, integrations |
| **What exists vs missing** | `IMPLEMENTATION_AND_PATHS_GUIDE.md` + `FEATURE_CHECKLIST.md` |
| **Roadmap & priorities** | `BUILD_PLAYBOOK_AND_ROADMAP.md` |
| **Pitfalls & env** | This guide + `AIDungeonMaster` keys |

| Agents must still open code for… | Why docs alone fail |
|----------------------------------|---------------------|
| **Exact function signatures & call order** | APIs drift; only `src/` is authoritative |
| **Phaser scene lifecycle** | `create` / `shutdown` / input must match existing scenes |
| **Event payloads** | `emit` shapes are discovered by grep + reading listeners |
| **Quest/dialogue graph** | IDs and links live in JSON + runtime wiring |

**Recommendation:** Treat docs as **mandatory context** and the repo as **mandatory verification**. For any feature touching more than two files, the agent should **list files read** in its summary (proves it did not only paraphrase docs).

---

## Copy-paste: agent system prompt (for tool settings)

**Instructions for humans:** Paste the block below into your agent’s **system prompt**, **project instructions**, or **Cursor Rules** entry for this repository. Optionally prepend your API/tool policy. Then give **task-specific** user messages (see §“User task message template”).

```
You are a coding agent working on the repository "Realm of Nexus: Verdance" — a Phaser 3 + Vite browser game (vanilla ES modules).

AUTHORITATIVE CONTEXT (read these paths from the repo when the task needs them):
- docs/CLAUDE_AGENT_GUIDE.md — architecture rules, EventBus/save wiring, pitfalls, verification steps
- docs/IMPLEMENTATION_AND_PATHS_GUIDE.md — what is implemented vs partial vs missing; vertical slices; scene flow
- docs/FEATURE_CHECKLIST.md — update checkboxes when you complete scoped work
- docs/BUILD_PLAYBOOK_AND_ROADMAP.md — product vision and phased roadmap

GROUND RULES:
1. Running code and data/*.json beat old design-only notes. If unsure, read the target files in src/ and data/.
2. GameScene.js is the main orchestrator; ContentInitializer registers content and wireSaveSystem persists most subsystem state.
3. EventBus: default export is the singleton instance; named export EventBus is the class — use getInstance() with named import. Do not double-emit or duplicate phase-changed listeners for lighting (SapCycleLightingIntegration owns that).
4. New persistent state must hook ContentInitializer.wireSaveSystem (save-collect / save-restore) with saveState/loadState on the system or panel.
5. SkillCheckSystem uses twelve lowercase skill IDs (athletics, stealth, perception, persuasion, intimidation, deception, nature, arcana, medicine, survival, crafting, history) — not the same namespace as talent data in skills.json.
6. Minimal diffs only; no drive-by refactors, no secrets in source. Use VITE_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY for AI features — never commit keys.
7. After changes: npm run build (required); npm run validate-data if data/*.json changed; manually test the affected path in the browser at http://localhost:3000 (npm run dev).

OUTPUT EXPECTATIONS:
- Summarize what changed, which files you touched, and how you verified (build + validate-data + manual step if applicable).
- Update docs/FEATURE_CHECKLIST.md when your work completes a checklist item for the current scope.

OUT OF SCOPE unless the user explicitly asks: engine migration off Phaser; deleting large doc sets; adding heavy dependencies without justification.

If requirements are ambiguous, state assumptions briefly and proceed with the smallest safe change, OR ask one focused question — do not invent large features.
```

---

## TL;DR (read before any task)

1. **Truth order:** Running code + `data/*.json` beat old design-chat logs. Confirm with `docs/IMPLEMENTATION_AND_PATHS_GUIDE.md`.
2. **Orchestrator:** `src/scenes/GameScene.js` wires most systems; **`ContentInitializer`** registers content and **`wireSaveSystem`** persists state.
3. **Events:** `src/core/EventBus.js` — see **§4.3** (default vs named import is easy to get wrong).
4. **Backlog:** Update `docs/FEATURE_CHECKLIST.md` when you complete work; do not duplicate long backlogs here.
5. **Verify:** `npm run build` + `npm run validate-data` + manual path in browser (`http://localhost:3000` in dev).

---

## 1. Mandatory document order (load context)

| Priority | Document | Why |
|----------|----------|-----|
| **1** | `docs/BUILD_PLAYBOOK_AND_ROADMAP.md` | Vision, phased roadmap (0–8), release criteria, workflow. |
| **2** | `docs/IMPLEMENTATION_AND_PATHS_GUIDE.md` | Implemented vs partial vs missing; vertical slices A–G; scene flow; wiring gaps. |
| **3** | `docs/FEATURE_CHECKLIST.md` | Granular `[x]` / `[~]` / `[ ]` — **update when you ship.** |
| **4** | `docs/ARCHITECTURE.md` | Folder map, EventBus table, run commands, Sap Cycle. |
| **5** | `docs/DESIGN_DOCUMENT_ANALYSIS.md` | Lore, content counts, design history — **not** sole authority over code behavior. |

**Narrow tasks** (e.g. “fix spell validation”): skim 1–2, then read the **target files** in `src/` and **`src/schemas/`** for the same domain.

**Optional:** `docs/GAP_ANALYSIS_AND_IMPLEMENTATION_GUIDE.md` — may reference Godot-era ideas; **cross-check** against Phaser code before implementing.

---

## 2. Agent session protocol (recommended)

Use this as an internal checklist for long agent runs:

| Step | Action |
|------|--------|
| **A. Restate goal** | One sentence: desired player-visible outcome or bug fix. |
| **B. Scope** | List files you expect to touch; avoid drive-by refactors. |
| **C. Read** | Relevant section of this guide + `IMPLEMENTATION_AND_PATHS_GUIDE` if touching multiple systems. |
| **D. Implement** | Minimal diff; match existing patterns in the file you edit. |
| **E. Validate** | §10 (verification) + `npm run validate-data` for JSON edits. |
| **F. Document** | Toggle `FEATURE_CHECKLIST.md`; note new EventBus events in `ARCHITECTURE.md` if public API. |

### 2.1 User task message template (paste per assignment)

Humans get better results when each task includes **goal**, **scope**, and **done when**. Example:

```text
Goal: [one sentence — player-visible or bug fix]

Scope: [files/systems — e.g. "QuestSystem + quests.json only" or "UIScene pause panel"]

Done when: [e.g. "Quest completes, reward grants, save/load preserves state" or "npm run build passes and pause opens/closes without errors"]

Out of scope: [optional — e.g. "do not refactor TacticalCombatSystem"]

Read first: docs/CLAUDE_AGENT_GUIDE.md §5–6; then [specific files].
```

---

## 3. Project identity (internalize)

| Fact | Detail |
|------|--------|
| **Product** | Realm of Nexus: **Verdance** — 2D tactical RPG (browser-first). |
| **Stack** | **Phaser 3** + **Vite** + **vanilla ES modules** (no React in core loop). |
| **Entry** | `src/main.js` registers scenes; **`GameScene`** is the main orchestrator. |
| **Data** | `data/*.json` via **`DataManager`** + **`src/schemas/*`** validation. |
| **Comms** | **`EventBus`** — prefer events over tight coupling between systems. |
| **Loop** | **Overworld real-time** + **grid tactical** encounters — hybrid by design. |

Do **not** assume Unity/Godot unless the task is explicitly to translate patterns.

---

## 4. Repository map

```
src/
  main.js                 # Phaser config, scene registration
  index.js                # Library exports (tools / systems surface)
  core/                   # EventBus, GameConfig
  scenes/                 # Boot, ClassSelection, CharacterCreation, Game, UIScene, EditorScene
                          # PreloadScene.js exists but is NOT registered in main.js
  systems/                # Gameplay singletons, DataManager, SaveManager, SapCycle, tactical, DSP, …
  integration/            # SpellVFX, SapCycle lighting, TacticalCombatCameraBridge
  components/             # Player, Enemy, NPC, Projectile
  ui/                     # UIFramework, HUD, panels
  renderers/              # Damage numbers, minimap
  engine/                 # ComponentRegistry, etc.
  schemas/                # spell, enemy, item, location validation
  configs/                # lightingPresets, particlePresets, scene format
  effects/                # e.g. ScreenSpaceEffects
  pipelines/              # NormalMap, PostProcessing
data/                     # Authoritative JSON content
docs/                     # Human + agent documentation
scripts/                  # validate-data.js, export-csv.js
```

### 4.1 Hot paths (where to start)

| Building… | Start here |
|-----------|------------|
| Gameplay rule | `GameScene.js` + `systems/<Name>System.js` |
| UI | `UIScene.js` + `ui/*Panel.js` |
| Content | `data/*.json` + `ContentInitializer` if new registration path |
| VFX / feedback | `integration/*` + `EventBus` + `configs/particlePresets.js` |
| Balance | `data/` first, then system multipliers / `config.json` |

---

## 5. Architectural rules

### 5.1 Singletons

Many systems use **`getInstance()`**. Extend the existing class; **do not** create second singletons for the same system in one session.

### 5.2 GameScene as hub

- Hook new work in **`create()`** or a dedicated **`_init…`** helper.
- If you **`EventBus.on(...)`** from GameScene or a long-lived object, **`shutdown`** / **`destroy`** must **`off`** or the handler will leak across scene restarts.

### 5.3 EventBus — **critical for agents**

`src/core/EventBus.js` exports:

- **`export class EventBus`** — the class (use **`EventBus.getInstance()`** for the singleton).
- **`export default EventBus.getInstance()`** — the **singleton instance** directly.

**Both import styles appear in the repo:**

```javascript
// Instance: default import — emit/on on the instance
import EventBus from '../core/EventBus.js';
EventBus.emit('foo', payload);

// Class: named import — must call getInstance() for the same singleton
import { EventBus } from '../core/EventBus.js';
this.bus = EventBus.getInstance();
```

**Do not** mix up the class vs instance when calling **`emit`**. There is only one bus; **`getInstance()`** returns the same object as the default export.

**Before adding event names:** search the codebase:

```bash
rg "emit\\(['\"]" src/
rg "EventBus\\.(on|once)" src/
```

On **Windows PowerShell**, chain commands with **`;`** instead of **`&&`** (e.g. `cd path; npm run build`). Use **`rg`** if installed, or **IDE search**.

**Spell / VFX contract:** Overworld and tactical casting should emit **`spell-cast`** (include **`caster`** when the integration expects it) and **`spell-impact`** so **`SpellVFXIntegration`** stays aligned.

### 5.4 DataManager & hot-reload

- Boot: **`BootScene`** → **`dataManager.loadAllData()`**.
- Dev: hot-reload may fire **`data-reloaded`** — listeners must stay consistent.
- After **schema** edits, run the game **and** `npm run validate-data`.

### 5.5 ContentInitializer

Registers quests, dialogues, factions, narrative, companions, talent trees, etc.  

**Adding a new content type** usually means: new **`register*`** method + call from **`GameScene.create()`** + optional **schema** + **save** fields in **`wireSaveSystem`** (see §5.6).

### 5.6 Save / restore pipeline — **extend when adding persistent state**

**`SaveManager`** emits:

- **`save-collect`** — mutates a `saveData` object; each subscriber merges state.
- **`save-restore`** — applies loaded blob to systems.

**`ContentInitializer.wireSaveSystem(systems)`** is the **central place** that copies quest, dialogue, progression, inventory, skills, class, DSP, factions, narrative, moral choices, companions, attributes, veilkeepers, skill checks.

If your feature introduces **new persistent state**:

1. Add **`saveState()` / `loadState()`** (or `serialize`/`deserialize`) on the system **or** UI panel, consistent with neighbors.
2. **Append** handlers inside **`ContentInitializer.wireSaveSystem`** for both **`save-collect`** and **`save-restore`**.
3. Test **save → hard refresh → load** for that feature.

### 5.7 Skill checks vs `data/skills.json`

**`SkillCheckSystem`** defines **12 skills by ID** (lowercase keys). Use **only these IDs** in `check()` unless you extend `skillDefinitions`:

| ID | Governing attribute (conceptually) |
|----|-------------------------------------|
| `athletics` | might |
| `stealth` | agility |
| `perception` | insight |
| `persuasion` | charisma |
| `intimidation` | might |
| `deception` | charisma |
| `nature` | insight |
| `arcana` | insight |
| `medicine` | insight |
| `survival` | resilience |
| `crafting` | insight |
| `history` | insight |

**`data/skills.json`** is primarily **talent trees / categories** — **not** the same namespace as skill-check IDs. Dialogue and quest scripts must reference the table above or you add IDs in code first.

### 5.8 DSP vs Sap

Shared **DSP** is a design pillar; **personal Sap** may still appear in spells and HUD. **Do not** remove either in isolation — align **`IMPLEMENTATION_AND_PATHS_GUIDE.md` §4**, **HUD**, **spell costs**, and **saves**.

---

## 6. Integrations

| Module | Status | Agent note |
|--------|--------|------------|
| `SpellVFXIntegration` | Active | `spell-cast` / `spell-impact`; avoid duplicate **`damage-number`** emissions |
| `SapCycleLightingIntegration` | Active | Owns phase ambient; **no duplicate** `phase-changed` listeners for lighting |
| `TacticalCombatCameraBridge` | Active | Tactical → camera shake / zoom via **`AdvancedCameraSystem`** |
| `CombatCameraIntegration` | **Not wired** | **Do not** assume it works; API mismatch with **`AdvancedCameraSystem`** |
| `CombatCameraIntegration` refactor | Only if tasked | Requires API alignment or adapter |

---

## 7. Environment & tooling

### 7.1 npm scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server — **`http://localhost:3000`** (`vite.config.js`), `--host` for LAN |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run validate-data` | **Parse-check all `data/*.json`** — run after bulk JSON edits |
| `npm run export-csv` | CSV export utility (designer pipeline) |
| `npm run editor` | **`EDITOR_MODE=true`** dev server — only if working on editor tooling |

### 7.2 AI / Claude API keys (AIDungeonMaster)

`AIDungeonMaster` resolves keys roughly in this order (see `src/systems/AIDungeonMaster.js`):

- **`import.meta.env.VITE_ANTHROPIC_API_KEY`** (Vite / browser)
- **`process.env.ANTHROPIC_API_KEY`** (Node / tooling)

**Never commit keys.** Document `.env.local` or env vars in README when adding player-facing AI features.

---

## 8. Task archetypes (recipes)

### 8.1 Add or change a spell

1. Edit `data/spells.json`.
2. Adjust **`src/schemas/spellSchema.js`** if new required fields exist.
3. Ensure **`SpellSystem`** and/or **`GameScene`** casting applies **DSP / Sap** costs consistently.
4. Emit **`spell-cast`** / **`spell-impact`** for VFX.
5. Map **particle preset** in `configs/particlePresets.js` if needed.
6. `npm run validate-data` → `npm run dev` → cast in-game.

### 8.2 Add a quest

1. Add to **`data/quests.json`** with stable **`id`**.
2. Confirm **`ContentInitializer.registerQuests()`** runs (default on **`GameScene`** load).
3. Wire NPCs / dialogue / objectives; test accept → update → complete → **save/load**.

### 8.3 Add UI (e.g. pause)

1. Follow **`UIFramework`** patterns in `ui/`.
2. Integrate from **`UIScene`**; single owner for **Escape** / pause input where possible.
3. If pausing gameplay, gate **physics** / **input** deliberately.
4. Confirm **save** still works from the new UI state.

### 8.4 Add a new persistent system

1. Mirror **`getInstance()`** + init patterns in `systems/`.
2. Register from **`GameScene`** / **`ContentInitializer`** as appropriate.
3. **Extend `ContentInitializer.wireSaveSystem`** (§5.6).
4. Export from **`src/index.js`** only if part of the public library surface.

### 8.5 AIDungeonMaster

1. Read **`AIDungeonMaster.js`** — listens/emits events documented in file header (`dm:narration`, `dm:encounter`, `dm:hint`, `dm:event`).
2. No hardcoded secrets; graceful behavior without API key.
3. Rate limits and cost awareness for any user-triggered calls.

---

## 9. Schemas & validation

- **`src/schemas/`** gates what **`DataManager`** accepts.
- **Tightening** validation without fixing JSON **breaks boot** — always run **`npm run dev`** and **`npm run validate-data`**.
- Prefer **dropping invalid entries with a console warning** over failing the entire load when content is messy (match existing project style).

---

## 10. Verification checklist (after substantive changes)

| Step | Command / action |
|------|------------------|
| 1 | `npm run build` — must succeed |
| 2 | `npm run validate-data` — if `data/` changed |
| 3 | `npm run dev` — reach **`GameScene`** |
| 4 | Exercise the changed path manually |
| 5 | **Save → reload** if stats, inventory, quests, or new `save-collect` fields touched |
| 6 | Watch **browser console** for validation spam or runtime errors |

Automated Playwright tests are **not** assumed present; if you add them, run in CI or document manual QA steps.

---

## 11. Code style & constraints

- **ES modules** only (`"type": "module"`).
- **Match** indentation, naming, and comment density of the file you edit.
- **Minimal diffs** — no unrelated refactors.
- **No secrets** in tracked files.

---

## 12. Known pitfalls

| Issue | Mitigation |
|-------|------------|
| **EventBus class vs instance** | §5.3 — wrong import breaks `emit` |
| **`this.particles.burst` missing** | Implement on **`AdvancedParticleSystem`** if required |
| **`dsp:thresholdChanged` payload** | Match actual emitter fields (`current` / `dsp`) |
| **`ComponentRegistry`** | Safe reads; no assumed deep shape |
| **Duplicate `phase-changed` listeners** | Lighting owned by **`SapCycleLightingIntegration`** |
| **Duplicate damage numbers** | Coordinate **`SpellVFXIntegration`** vs **`DamageNumberRenderer`** |
| **PreloadScene** | Not in **`main.js`** — do not use unless wired |
| **Class list drift** | **`classes.json` + `PlayerClassSystem`** are implementation truth |
| **Forgot `wireSaveSystem`** | New state silently **not** saved — §5.6 |

---

## 13. Backlog authority

- **What to build:** `docs/FEATURE_CHECKLIST.md`
- **Order / milestones:** `docs/BUILD_PLAYBOOK_AND_ROADMAP.md`
- **Slice acceptance:** `docs/IMPLEMENTATION_AND_PATHS_GUIDE.md` §6

Do **not** maintain a parallel backlog inside this guide.

---

## 14. Multi-agent & long sessions

- Prefer **additive** JSON (new quests, new IDs) over renames that invalidate saves.
- **Document** new EventBus names when they become stable.
- If you **rename** faction/quest IDs, provide a **migration** or accept broken old saves explicitly.

---

## 15. Out of scope without explicit approval

- Engine migration off Phaser.
- Flattening hybrid combat to **only** real-time or **only** tactical without design sign-off.
- Mass-deleting `docs/` or user docs.
- Heavy new dependencies without bundle-size and maintenance justification.

---

## 16. Machine index (jump table)

| Path | Role |
|------|------|
| `src/main.js` | Scene list |
| `src/scenes/GameScene.js` | Main orchestration |
| `src/systems/DataManager.js` | Loads `data/`, validation |
| `src/systems/ContentInitializer.js` | Register content + **`wireSaveSystem`** |
| `src/core/EventBus.js` | Singleton + class exports |
| `src/systems/SaveManager.js` | `save-collect` / `save-restore` |
| `src/schemas/*.js` | JSON shape enforcement |
| `data/*.json` | Content |
| `scripts/validate-data.js` | JSON parse validation |

---

## 17. Expected outputs (definition of done for agent work)

Work is **complete** when all applicable items hold:

| Criterion | Check |
|-----------|--------|
| **Build** | `npm run build` exits 0 |
| **Data** | If `data/*.json` changed: `npm run validate-data` exits 0 |
| **Behavior** | Changed path tested manually in browser (or automated test added and run) |
| **Persistence** | If new state: save → reload → state restored |
| **Documentation** | `FEATURE_CHECKLIST.md` updated for completed items in scope; no stale claims |
| **Summary** | Final message lists **files changed**, **assumptions**, and **verification steps run** |

**Not** required for every tiny fix: updating `ARCHITECTURE.md` — only when adding **new public EventBus contracts** or new first-class systems.

---

## 18. When to ask the user vs. proceed

| Situation | Action |
|-----------|--------|
| **Requirement is clear** and fits repo patterns | Implement; state assumptions in the summary if any |
| **Two valid designs** (e.g. new keybind vs UI button) | Pick the **smaller** change consistent with nearby code; note in summary |
| **Breaking save format** or **deleting content** | **Ask** before doing it |
| **New dependency** or **engine-level change** | **Ask** unless explicitly in task |
| **Ambiguous “fix the game”** | **Ask one** clarifying question OR scope to the file/error provided |

Default: **bias to shipping a minimal working change** over extended design debate.

---

## 19. Platform and tooling notes

| Topic | Note |
|-------|------|
| **OS** | Repo is developed on **Windows**; paths use forward slashes in docs; agents should use repo-relative paths |
| **Shell** | PowerShell: use **`;`** to chain, not **`&&`** (older PowerShell) |
| **Search** | Prefer **ripgrep** (`rg`) or IDE search; `grep` available in Git Bash |
| **Dev URL** | `npm run dev` → **`http://localhost:3000`** (see `vite.config.js`) |
| **Editor dev** | `npm run editor` sets `EDITOR_MODE=true` — only when working on editor tooling |

---

## 20. Repo entry points (automation)

| Path | Role |
|------|------|
| **`AGENTS.md`** (repo root) | Short index for humans + agents — read first |
| **`docs/ONBOARDING.md`** | Full documentation map |
| **`.cursor/rules/*.mdc`** | Cursor: core (always on) + scoped rules for `data/**/*.json`, `src/schemas/`, `systems/`, `scenes/`+`ui/`, `integration/` |
| **`.github/pull_request_template.md`** | PR checklist; links to `CONTRIBUTING.md` / `AGENTS.md` |
| **`.github/ISSUE_TEMPLATE/`** | Bug + feature templates; `config.yml` enables blank issues |
| **`CONTRIBUTING.md`** | Human contributor expectations |
| **`SECURITY.md`** | Secrets and reporting |

Keep **Cursor rules** concise; put detail in **`CLAUDE_AGENT_GUIDE.md`** and the **copy-paste system prompt** block in §“Copy-paste: agent system prompt”.

---

**Human planning:** `BUILD_PLAYBOOK_AND_ROADMAP.md` · **Implementation truth:** `IMPLEMENTATION_AND_PATHS_GUIDE.md` · **Tasks:** `FEATURE_CHECKLIST.md` · **Index:** `AGENTS.md`, `docs/ONBOARDING.md`
