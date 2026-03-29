# Development workflow

Day-to-day notes for working on **Realm of Nexus: Verdance** in this repo.

## Commands

| Command | Use |
|---------|-----|
| `npm run dev` | Dev server with HMR — **http://localhost:3000** |
| `npm run build` | Production bundle to `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run validate-data` | Parse-check all `data/*.json` |
| `npm run export-csv` | Designer CSV export (`scripts/export-csv.js`) |
| `npm run editor` | Same as dev but **`EDITOR_MODE=true`** for in-game editor work |

## Data hot-reload (development)

With `npm run dev`, **`DataManager`** can hot-reload JSON in some setups — watch the console for `data-reloaded`. After large schema changes, **restart dev** and run **`npm run validate-data`**.

## In-game dev shortcuts

From [ARCHITECTURE.md](./ARCHITECTURE.md):

| Key | Action |
|-----|--------|
| **F2** | Toggle **EditorScene** (level editor) |
| **F3** | Performance profiler overlay (when wired) |

## Where to edit what

| Goal | Start |
|------|--------|
| New quest / dialogue line | `data/quests.json`, `data/dialogues.json` + `ContentInitializer` if new wiring |
| Balance / spell numbers | `data/spells.json`, enemies, items |
| Gameplay rule | `GameScene.js` + relevant `src/systems/*.js` |
| New UI panel | `UIScene.js`, `src/ui/` |
| JSON shape | `src/schemas/*.js` + matching JSON |

## CI locally (same as GitHub Actions)

```bash
npm ci
npm run validate-data
npm run build
```

## Node version

Use **Node 18+** (`package.json` `engines`, **`.nvmrc`** for `nvm` / `fnm`).

## See also

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — when something breaks  
- [CONTRIBUTING.md](../CONTRIBUTING.md) — PR expectations  
- [CLAUDE_AGENT_GUIDE.md](./CLAUDE_AGENT_GUIDE.md) — agent-oriented pitfalls  
