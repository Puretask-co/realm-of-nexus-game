# Realm of Nexus: Verdance

A **2D tactical RPG** (browser-first) built with **Phaser 3** and **Vite**: overworld exploration, grid tactical combat, data-driven quests and dialogue, **Sap Cycle** phases, shared **DSP** magic pressure, factions, **Veilkeepers**, and optional **AI Dungeon Master** narration.

**→ [AGENTS.md](AGENTS.md)** — start here for humans and AI (reading order, rules, commands).

## Requirements

- **Node.js** 18+ recommended  
- **npm**

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** (see `vite.config.js`).

```bash
npm run build          # production bundle → dist/
npm run validate-data  # parse-check all data/*.json (run after editing data)
npm run preview        # preview production build locally
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | **Entry index** — AI + human links, npm scripts, non-negotiables |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Full documentation map |
| [docs/CLAUDE_AGENT_GUIDE.md](docs/CLAUDE_AGENT_GUIDE.md) | Agent procedures, **copy-paste system prompt**, pitfalls |
| [docs/BUILD_PLAYBOOK_AND_ROADMAP.md](docs/BUILD_PLAYBOOK_AND_ROADMAP.md) | Vision, phased roadmap, release criteria |
| [docs/IMPLEMENTATION_AND_PATHS_GUIDE.md](docs/IMPLEMENTATION_AND_PATHS_GUIDE.md) | What exists vs missing, vertical slices, player paths |
| [docs/FEATURE_CHECKLIST.md](docs/FEATURE_CHECKLIST.md) | Living feature backlog |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, folders, EventBus, Sap Cycle |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | DSP, Sap Cycle, tactical vs overworld |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR expectations, verification |
| [SECURITY.md](SECURITY.md) | Secrets, dependencies, saves |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev commands, F2/F3, CI parity |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common build / data / port issues |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community expectations |

## AI / Cursor

- **Cursor rules:** `.cursor/rules/*.mdc` (core rule always applies; others by path).
- **System prompt:** [docs/CLAUDE_AGENT_GUIDE.md](docs/CLAUDE_AGENT_GUIDE.md) → *Copy-paste: agent system prompt*.

## Optional configuration

**Anthropic API** (AI Dungeon Master): set `VITE_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` in `.env.local` (gitignored). Never commit keys. See `src/systems/AIDungeonMaster.js` and [SECURITY.md](SECURITY.md).

## License

Proprietary — see **[LICENSE](LICENSE)**. `package.json` marks **UNLICENSED** for npm metadata; the file on disk defines terms.
