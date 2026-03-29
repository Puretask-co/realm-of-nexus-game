# Contributing to Realm of Nexus: Verdance

## Prerequisites

- **Node.js** 18+ recommended (Vite 5 + native `fetch` in tooling).
- **npm** (comes with Node).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 — Vite dev server
npm run build
npm run validate-data   # required after editing data/*.json
```

Other scripts: see **[AGENTS.md](AGENTS.md)** (npm scripts table) or `package.json`.

## For AI agents

1. Read **[AGENTS.md](AGENTS.md)** and **[docs/CLAUDE_AGENT_GUIDE.md](docs/CLAUDE_AGENT_GUIDE.md)** before large or multi-file changes.
2. Follow **`.cursor/rules/*.mdc`** when using Cursor.

## For humans

1. **Branch:** Short, descriptive (`fix/quest-save`, `feat/pause-menu`).
2. **Scope:** One concern per PR; avoid unrelated refactors.
3. **Verify:** `npm run build` is required before merge; `npm run validate-data` if any file under `data/` changed.
4. **Docs:** Update **[docs/FEATURE_CHECKLIST.md](docs/FEATURE_CHECKLIST.md)** when you complete an item that maps to the backlog.
5. **Secrets:** Never commit API keys. Use **`.env.local`** (gitignored) for `VITE_ANTHROPIC_API_KEY` when testing the AI Dungeon Master. See **[SECURITY.md](SECURITY.md)**.

## Code style

- **`.editorconfig`** — charset, newlines, indent (4 spaces for `.js`, 2 for `.json`/`.md`).
- Match the **existing style** of the file you edit (naming, comment density).

## Project layout

| Path | Role |
|------|------|
| `src/main.js` | Phaser config, scene registration |
| `src/scenes/GameScene.js` | Main gameplay orchestration |
| `src/systems/` | Singletons, DataManager, SaveManager |
| `src/integration/` | Spell VFX, Sap lighting, tactical camera bridge |
| `src/schemas/` | JSON validation used by DataManager |
| `data/*.json` | Designer-editable content |
| `docs/` | Architecture, playbooks, agent guide |

## PR checklist

Aligns with [`.github/pull_request_template.md`](.github/pull_request_template.md):

- [ ] `npm run build` passes locally
- [ ] `npm run validate-data` if `data/*.json` touched
- [ ] Manual sanity check of the changed path in the browser
- [ ] `docs/FEATURE_CHECKLIST.md` updated if you closed a scoped checklist item

## Documentation index

**[docs/ONBOARDING.md](docs/ONBOARDING.md)** — full map of all project docs.

## License & conduct

- **[LICENSE](LICENSE)** — proprietary; do not redistribute without permission.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — expectations for issues and PRs.

## CI

GitHub Actions runs **`npm ci`**, **`npm run validate-data`**, and **`npm run build`** on pushes/PRs to `main`/`master` (see `.github/workflows/ci.yml`). Match that locally before pushing.
