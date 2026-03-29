# Troubleshooting — development

Common issues when building or running **Realm of Nexus: Verdance**.

## Build fails (`npm run build`)

| Symptom | Things to try |
|---------|----------------|
| Syntax error in a `.js` file | Run from repo root; fix the reported file/line. |
| Out of memory | Close other apps; on CI, ensure Node 18+ and sufficient runner memory. |
| Vite / Rollup error after adding import | Check path and extension; use ES module `import`/`export` only. |

## Data validation fails (`npm run validate-data`)

| Symptom | Things to try |
|---------|----------------|
| `Unexpected token` in JSON | Trailing commas, comments, or smart quotes in `data/*.json` — JSON must be strict. |
| File not listed | `validate-data` scans `data/` — ensure new files are `.json` and valid UTF-8. |

## Game boots but crashes or spams console

| Symptom | Things to try |
|---------|----------------|
| Schema validation warnings | Align `data/*.json` with `src/schemas/*.js` or adjust schema consistently. |
| `EventBus` / undefined errors | See [CLAUDE_AGENT_GUIDE.md](./CLAUDE_AGENT_GUIDE.md) §5.3 (class vs instance). |
| Missing texture / audio | Boot uses placeholders; check `BootScene` and asset paths if you add real assets. |

## Port already in use (`npm run dev`)

Vite defaults to **port 3000** (`vite.config.js`). Another process may hold it.

- Stop the other dev server, or
- Temporarily change `server.port` in `vite.config.js`, or
- Run `npx vite --port 3001` (override; not in `package.json` by default).

## PowerShell: `&&` not recognized

On older Windows PowerShell, chain with **`;`** instead of **`&&`**:

```powershell
cd path\to\realm-of-nexus-game; npm run build
```

## Git: line endings

The repo uses **LF** (see `.gitattributes`). If files flip to CRLF-only on Windows, ensure EditorConfig is enabled and `core.autocrlf` is not forcing unwanted conversions — see Git docs for your setup.

## Still stuck?

1. [AGENTS.md](../AGENTS.md) — commands and doc index  
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — controls, Sap Cycle, structure  
3. [CLAUDE_AGENT_GUIDE.md](./CLAUDE_AGENT_GUIDE.md) — known pitfalls table  
