# Security

## Secrets and credentials

- **Do not** commit API keys, tokens, or passwords.
- **Gitignored:** `.env`, `.env.local` (see `.gitignore`).
- **AI Dungeon Master** (`AIDungeonMaster`): prefer **`VITE_ANTHROPIC_API_KEY`** for Vite/browser builds, or **`ANTHROPIC_API_KEY`** where Node reads env — logic is in `src/systems/AIDungeonMaster.js`.
- Rotate keys if they are ever exposed in a commit or public fork.

## Dependencies

- Run **`npm audit`** before releases or when upgrading Phaser/Vite.
- Prefer **pinned ranges** in `package.json` for reproducible builds; upgrade deliberately after reading changelogs.

## Runtime / web surface

- The game runs as a **static client** in the browser — follow normal **XSS** hygiene if you ever inject HTML from untrusted strings (prefer Phaser text APIs).
- **No server** in this repo for gameplay; do not add a random HTTP listener without reviewing exposure.

## Saves

- Saves use **localStorage** — **not encrypted**. Do not store real names, emails, or other PII in save blobs.

## Reporting

- For **dependency** issues: `npm audit`, upgrade, or advisory links.
- For **project code** vulnerabilities: contact maintainers privately or use **GitHub Security Advisories** if enabled on the repository.
