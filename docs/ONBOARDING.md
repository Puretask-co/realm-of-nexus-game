# Onboarding — documentation map

**Realm of Nexus: Verdance** — Phaser 3 + Vite, data-driven tactical RPG.

Use this page as a **single table of contents** for humans and agents. The **canonical entry** from the repo root is **[AGENTS.md](../AGENTS.md)**.

---

## Start here

| Who | Open |
|-----|------|
| **Everyone** | [AGENTS.md](../AGENTS.md) |
| **AI agents** | [CLAUDE_AGENT_GUIDE.md](./CLAUDE_AGENT_GUIDE.md) (includes **copy-paste system prompt**) |
| **Planning / milestones** | [BUILD_PLAYBOOK_AND_ROADMAP.md](./BUILD_PLAYBOOK_AND_ROADMAP.md) |
| **Current implementation truth** | [IMPLEMENTATION_AND_PATHS_GUIDE.md](./IMPLEMENTATION_AND_PATHS_GUIDE.md) |
| **Backlog** | [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) |
| **Terms** | [GLOSSARY.md](./GLOSSARY.md) |

---

## By topic

| Topic | Document |
|-------|----------|
| Stack, folders, EventBus, Sap Cycle, controls | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Design history, content counts, GDD alignment | [DESIGN_DOCUMENT_ANALYSIS.md](./DESIGN_DOCUMENT_ANALYSIS.md) |
| Optional / legacy cross-check | [GAP_ANALYSIS_AND_IMPLEMENTATION_GUIDE.md](./GAP_ANALYSIS_AND_IMPLEMENTATION_GUIDE.md) (verify ideas against Phaser code) |
| Contributing, PR checklist | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Security / secrets | [SECURITY.md](../SECURITY.md) |
| Repo overview (npm, doc links) | [README.md](../README.md) |
| Day-to-day dev (commands, CI) | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| When something breaks | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Release history | [CHANGELOG.md](../CHANGELOG.md) |
| Community | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) |

---

## Automation & repo tooling

| Path | Role |
|------|------|
| `.cursor/rules/*.mdc` | Cursor: `realm-of-nexus-core.mdc` **alwaysApply**; scoped rules for `data/`, `systems/`, `scenes`+`ui`, `integration`, `schemas` |
| `.vscode/extensions.json` | Recommends EditorConfig |
| `.vscode/settings.json` | Shared editor defaults (LF, tab size) |
| `.editorconfig` | Charset, EOL, indent |
| `.nvmrc` | Node version for `nvm` / `fnm` / CI |
| `.gitattributes` | Line endings (LF) and binary globs |
| `.github/workflows/ci.yml` | `validate-data` + `build` on push/PR |
| `.github/dependabot.yml` | Weekly npm dependency PRs |
| `.github/pull_request_template.md` | Default PR body: build, validate-data, FEATURE_CHECKLIST |
| `.github/ISSUE_TEMPLATE/` | Bug + feature forms; `config.yml` enables blank issues |
| `LICENSE` | Proprietary copyright notice |
| `scripts/README.md` | What `validate-data` / `export-csv` do |

---

## Key source locations

| Path | Role |
|------|------|
| `src/main.js` | Phaser config, scene list |
| `src/scenes/GameScene.js` | Main orchestration |
| `src/systems/DataManager.js` | Loads and validates `data/` |
| `src/systems/ContentInitializer.js` | Registers content + `wireSaveSystem` |
| `src/core/EventBus.js` | Cross-system events (singleton + class export) |
| `src/schemas/*.js` | JSON schemas for DataManager |
| `data/*.json` | Authoritative content |

---

## Environment

| Variable / command | Notes |
|--------------------|--------|
| `npm run dev` | **http://localhost:3000** |
| `VITE_ANTHROPIC_API_KEY` | Vite-exposed key for browser (AI DM) |
| `ANTHROPIC_API_KEY` | Node / fallback (see `AIDungeonMaster.js`) |
| `.env.local` | Gitignored — use for local keys |

---

*Update this file when you add major docs or tooling.*
