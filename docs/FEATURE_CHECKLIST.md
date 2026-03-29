# Realm of Nexus: Verdance — Systems & Features Checklist

**Purpose:** Single place to track what we want in the game vs what exists in the Phaser codebase. Update this file as you ship work; link PRs or issues in notes if helpful.

**See also:** `AGENTS.md` (repo root) — entry index. `BUILD_PLAYBOOK_AND_ROADMAP.md` — vision, phased order (0–8), release criteria. `IMPLEMENTATION_AND_PATHS_GUIDE.md` — systems status, vertical slices (A–G), player paths. `CLAUDE_AGENT_GUIDE.md` — agent conventions, **copy-paste system prompt**, pitfalls. `docs/ONBOARDING.md` — full doc map.

**Legend**

| Tag | Meaning |
|-----|---------|
| `[x]` | Largely implemented and wired in main play path |
| `[~]` | Partially there (scaffold, data only, or missing UI/feel) |
| `[ ]` | Not implemented or not yet in scope |

---

## 1. Core engine & tooling

- [x] Phaser 3 + Vite build pipeline
- [x] `DataManager` JSON load, validation, caches, hot-reload watch
- [x] `EventBus` for cross-system signals
- [x] `SaveManager` (slots + auto-save) + `ContentInitializer` save wiring
- [x] `BootScene` → class/character flow → `GameScene` + `UIScene`
- [x] `EditorScene` (F2) — level editor for development
- [x] `AdvancedLightingSystem` + `SapCycleLightingIntegration` (phase-driven ambient)
- [x] `AdvancedParticleSystem` + `SpellVFXIntegration` (cast/impact hooks)
- [x] `AdvancedCameraSystem` + `TacticalCombatCameraBridge` (tactical shake/zoom; not full `CombatCameraIntegration`)
- [ ] `CombatCameraIntegration` — **blocked** until camera API matches (framing controllers, slow-mo, etc.) or integration is refactored
- [ ] `CameraZoneSystem` — rich zone priorities (optional; `GameScene` uses `addZone` on camera today)
- [ ] `ParticleCollisionSystem` — wire if spell/world particle collision matters for gameplay
- [ ] `CSVDataLoader` / export pipeline — if designers need spreadsheet round-trip
- [ ] `SceneLoader` + editor — runtime load of saved scene JSON into `GameScene` (if desired for shipping)
- [ ] Automated tests (Playwright) for critical flows — smoke boot, cast spell, dialogue

---

## 2. World & exploration

- [x] Multi-zone overworld (`locations.json` + grid layout in `GameScene`)
- [x] Zone labels, discovery events, camera zones per location
- [~] **Enemy overworld AI** — chase/patrol exists; needs zone leashes, speed tuning vs data
- [ ] **Portals / travel UI** — walk between zones only today; no map travel menu
- [ ] **Fog of war / exploration flags** per location (if in GDD)
- [ ] **Terrain / encounter tables** driven fully from data (biome, phase, DSP)
- [ ] **Day/night or calendar UI** surfaced to player (Sap cycle is simulated; HUD clarity)

---

## 3. Combat

### Overworld (real-time)

- [x] Movement, dash, spell keys 1–5, overlap → tactical encounter
- [~] Spell targeting (pointer + nearest enemy); balance `baseDamage` / `damage` / costs in data — `caster` field now consistent on all spell-cast/spell-impact events
- [ ] **Melee / basic attack** if design calls for non-spell offense
- [x] **Enemy attack patterns** on overworld — enemies deal melee damage at ≤32px range with 1.5s cooldown; emits `enemy-attack` event

### Tactical (grid)

- [x] `TacticalCombatSystem` — AP, Guard, initiative, grid, undo, positioning bonuses (design pillars)
- [~] **Pillar UX** — rules exist; `pillar-activated` events now emitted with name + description for UI to consume; tutorialization + VFX still needed
- [ ] **Terrain tags on tiles** — tileset custom data + reader (see gap doc) if using tiled combat maps
- [ ] **Boss phases / intent UI** — data + UI polish
- [ ] **CombatCameraIntegration-level cinematics** — pending camera API alignment

---

## 4. Character & progression

- [x] Class selection + character creation (ancestry, attributes, variant, backstory)
- [x] `PlayerClassSystem`, `AttributeSystem`, `DSPSystem`
- [x] `ProgressionSystem` / XP hooks from quests & combat
- [~] **Max level / XP curve** — align `ProgressionSystem` + GDD (e.g. cap 10 vs 50)
- [~] **Talent trees** (`skills.json` talentTrees + `SkillTreePanel`) — ensure points unlock, save, and affect stats
- [~] **Skill checks** (`SkillCheckSystem`) — 12 skills in code; hook more dialogue/quests/locks to `check()` results
- [ ] **Attribute allocation on level-up** (+ buttons, unspent points) if GDD requires
- [ ] **Pure / Blighted** — variant effects on spell access, visuals, and story flags end-to-end
- [ ] **Respec / multiclass** — if in GDD

---

## 5. Resources & economy

- [x] Personal Sap + shared DSP (drain/recover, thresholds)
- [~] **DSP consequences in play** — shop/encounter/diplomacy modifiers: verify `getModifiers()` used everywhere intended
- [x] Items in data; inventory UI exists in stack
- [x] **Shop panels** — ShopPanel wired to `shop-open` event; buy items, deducts gold via `shop:deductGold`, per-NPC inventory support
- [x] **Loot tables** — enemy drops + gold rolled in `_onEnemyDefeated`; phase/DSP modifiers applied; `loot-dropped` event emitted
- [x] `CraftingSystem` in `GameScene`
- [x] **Crafting UI** — CraftingPanel wired to `crafting-open`; shows known recipes, material counts, craft button with success/fail feedback
- [x] **Currency display** — gold shown in player bars HUD (updates via `player-stats-updated`)

---

## 6. Social, factions & narrative

- [x] `FactionSystem`, `NarrativeSystem` (eras/acts from `story.json`), `MoralChoiceSystem`, `CompanionSystem`, `VeilkeeperSystem`
- [x] `QuestSystem` + `DialogueSystem` + bulk `quests.json` / `dialogues.json` — all quest dialogue IDs now have entries (30 stubs added for Act 2 + faction arcs)
- [~] **NPCs in world vs dialogue cast** — key quest NPCs placed; crafting station NPCs added (Workshop + Forge); Maren shop stocked
- [~] **Quest board / journal UX** — quest journal overlay (J key) with active quest + objectives added; map pins not yet done
- [x] **Veilkeeper consultation UI** — select keeper, question, cost, AI response, death state
- [x] **Moral choice overlay** — present binary/branch choices with visible consequences
- [ ] **Ending evaluation** — route to ending scenes from faction/DSP/hollowing/flags
- [ ] **6-era campaign** — gate content, act transitions, era-specific quests
- [~] `AIDungeonMaster` — API key, rate limits, safe fallbacks, in-UI narration queue

---

## 7. UI / UX

- [x] `UIScene` + HUD (phase, stats, bars — verify against current systems)
- [x] **Pause menu** — Escape to open; Resume/Save/Settings(stub)/Quit; R or Escape to close; pauses world physics
- [ ] **Settings** — audio, difficulty, accessibility (key remapping, color-blind)
- [ ] **Map** — world map scene or fullscreen minimap upgrade
- [ ] **Spellbook / codex** — readable spell & lore entries from data
- [x] **DSP / world health** — DSP bar in HUD with color threshold warnings (yellow ≤50, orange ≤30, red ≤20); driven by `dsp:changed` event
- [ ] **Controller / rebinding** — if targeting beyond keyboard
- [x] F2 editor (dev); optional: hide or gate in production build

---

## 8. Content volume (data-driven targets)

Use these as **ongoing** targets; counts drift — re-measure from `data/*.json` periodically.

| Area | Target (docs) | Checklist |
|------|----------------|-----------|
| Quests | 40+ | [ ] Track current count; add main + side + faction chains |
| Dialogues | Rich trees | [ ] Cover all major NPCs; branch on flags/DSP/faction |
| NPCs (world) | 50+ | [ ] Align spawns with `dialogues.json` characters |
| Enemies | Diverse bestiary | [ ] Boss variants, phase weights, unique mechanics |
| Items | Crafting + drops | [ ] Recipes, shop stock, quest rewards |
| Spells | Lore + balance | [ ] `loreText`, faction gates, DSP tiers, VFX ids in presets |
| Locations | Named regions | [ ] Connections, discovery, one-shot events |

---

## 9. Audio & polish

- [x] `AudioManager` + placeholder SFX in boot
- [ ] **Music** — phase/location/boss themes, crossfade
- [ ] **SFX pass** — spell, UI, footsteps, hit reactions (hook to `AudioManager` events)
- [ ] **Screen effects** — `ScreenSpaceEffects`, post-process toggles per phase/combat
- [ ] **Accessibility** — text size, reduce flash/shake options

---

## 10. Production & quality bar

- [ ] **README** — replace stub; setup, scripts, env vars (e.g. Claude API), folder map
- [ ] **Update `ARCHITECTURE.md`** — match real `data/` counts and integration wiring
- [ ] **Credits / attribution** — assets, fonts, libraries
- [ ] **Error boundaries** — graceful boot failure, missing texture fallbacks
- [ ] **Performance** — profile on low-end; particle/light caps
- [ ] **Build** — CI (lint, build, optional validate-data)

---

## Suggested priority order (opinion)

1. **Player clarity** — HUD for DSP/Sap/phase, pause, quest journal  
2. **Content path** — main quest chain + critical NPCs in world  
3. **Economy loop** — shop + crafting UI + loot  
4. **Veilkeeper + moral choices** — unique selling points  
5. **Endings + era structure** — campaign completeness  
6. **Polish** — audio, camera, tutorials  

---

*Last updated: 2026-03-29 — edit freely as scope changes.*
