# AGENTS — AI & automation entry point

**Realm of Nexus: Verdance** — Phaser 3 + Vite, vanilla ES modules. **Humans and coding agents** (Claude, Cursor, Copilot, etc.) should start here.

## Read first (priority order)

| # | Path | Purpose |
|---|------|---------|
| 1 | [`docs/CLAUDE_AGENT_GUIDE.md`](docs/CLAUDE_AGENT_GUIDE.md) | **Primary:** architecture, EventBus/save wiring, pitfalls, verification, **copy-paste system prompt** |
| 2 | [`docs/BUILD_PLAYBOOK_AND_ROADMAP.md`](docs/BUILD_PLAYBOOK_AND_ROADMAP.md) | Vision, phased roadmap (0–8), release criteria |
| 3 | [`docs/IMPLEMENTATION_AND_PATHS_GUIDE.md`](docs/IMPLEMENTATION_AND_PATHS_GUIDE.md) | Implemented vs partial vs missing; vertical slices A–G; player paths |
| 4 | [`docs/FEATURE_CHECKLIST.md`](docs/FEATURE_CHECKLIST.md) | Living backlog — update when you ship |
| 5 | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, folders, EventBus table, Sap Cycle, controls |

**Also useful**

| Path | Purpose |
|------|---------|
| [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Full documentation map (all files) |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | DSP, Sap Cycle, tactical vs overworld, key acronyms |
| [`docs/DESIGN_DOCUMENT_ANALYSIS.md`](docs/DESIGN_DOCUMENT_ANALYSIS.md) | GDD depth, content counts — **not** sole authority over code; pair with `IMPLEMENTATION_AND_PATHS_GUIDE.md` |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Commands, F2/F3, CI parity |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Build, data, port issues |

## Non-negotiables (agents)

1. **Truth:** `src/` + `data/*.json` beat informal design-only notes.
2. **Hub:** `src/scenes/GameScene.js` orchestrates; `ContentInitializer` registers content and **`wireSaveSystem`** persists subsystem state.
3. **EventBus:** Default export = singleton **instance**; named `EventBus` = **class** → use `EventBus.getInstance()` when using the named import. See `docs/CLAUDE_AGENT_GUIDE.md` §5.3.
4. **Saves:** New persistent state → extend `ContentInitializer.wireSaveSystem` and implement `saveState`/`loadState` on the system or panel.
5. **Skills:** `SkillCheckSystem` uses **12 lowercase IDs** (`athletics`, `stealth`, …) — **not** the same namespace as talent trees in `data/skills.json`.
6. **Verify:** `npm run build`; if `data/` changed → `npm run validate-data`; manually test the affected path at **http://localhost:3000** (`npm run dev`).

## npm scripts (reference)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (default **port 3000**) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview production build |
| `npm run validate-data` | Parse-check all `data/*.json` |
| `npm run export-csv` | CSV export (`scripts/export-csv.js`) |
| `npm run editor` | Dev server with `EDITOR_MODE=true` (level editor work) |

## Cursor / IDE

- **Rules:** `.cursor/rules/*.mdc` — `realm-of-nexus-core.mdc` is **always applied**; others activate by file path.
- **Long prompt:** Copy from [`docs/CLAUDE_AGENT_GUIDE.md`](docs/CLAUDE_AGENT_GUIDE.md) → section **Copy-paste: agent system prompt**.

## Humans

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — branches, PR expectations, verification.
- **[SECURITY.md](SECURITY.md)** — secrets, saves, reporting.
