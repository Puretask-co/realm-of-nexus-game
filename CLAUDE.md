# Realm of Nexus: Verdance — Claude Code Context

## What this game is

A **browser-based 2D tactical RPG** (Phaser 3.90 + Vite 5.x, vanilla ES modules).
Set in the **Verdance**, a bioluminescent forest-fantasy world whose magic (DSP) is dying.
Explore zones top-down (WASD), talk to NPCs (E), touch enemies for **turn-based grid battles**.
Core hook: **magic is finite** — every spell drains the world's Domain Soul Pool (DSP).
A rotating **15-day Sap Cycle** (Blue → Crimson → Silver) reshapes combat, economy, and lighting.

**Comparables:** Final Fantasy Tactics × Disco Elysium.
**Pitch:** A tactical RPG where the world's magic is finite and every choice permanently shapes the world.

## Architecture (read before editing)

| Layer | Key files |
|-------|-----------|
| Entry | `src/main.js` → Phaser config, 1280×720, WebGL |
| Boot | `src/scenes/BootScene.js` → asset loading, placeholder generation |
| Game | `src/scenes/GameScene.js` → main gameplay (3500+ lines), orchestrates everything |
| UI | `src/scenes/UIScene.js` → HUD overlay (parallel scene), spell bar, HP/Sap bars |
| Systems | `src/systems/*.js` → singletons via `getInstance()` pattern |
| Components | `src/components/*.js` → NPC, Player, etc. |
| Panels | `src/ui/*.js` → SkillTree, Shop, Crafting, MoralChoice, Companion, etc. |
| Data | `public/data/*.json` → all content (spells, quests, enemies, items, dialogues, etc.) |
| Art | `src/scenes/GameArt.js` → curated loader for ~50 painterly assets |
| Art assets | `public/assets/imported/` → 840+ high-res painted PNGs |

### Critical patterns

- **EventBus** (`src/core/EventBus.js`): Singleton pub/sub. Default export = instance, named export = class. Always unsubscribe in `destroy()`. Convention: `namespace:action` (colon), not dashes.
- **Singletons**: All systems use `static instance` + `getInstance()` with lazy creation.
- **Single-zone model**: One zone rendered at a time; `_buildActiveZone(loc)` rebuilds on travel.
- **Save system**: `ContentInitializer.wireSaveSystem` handles persistence; panels implement `saveState`/`loadState`.
- **Data-driven**: Spells, quests, enemies, items, dialogues, locations all live in `public/data/*.json`.

### Dependencies (pinned — do NOT upgrade)

- **Phaser ^3.90.0** — game is NOT compatible with Phaser 4.x
- **Vite ^5.4.21** — game is NOT compatible with Vite 8.x
- **Branch protection**: Cannot push directly to `main`; must use PRs.

## Art style & visual guidelines

**Style:** Stylized painterly 2D, semi-realistic digital illustration. Rich brush texture,
soft volumetric lighting. NOT photoreal, NOT flat vector, NOT pixel art (despite using some
16×16 Kenney tilesets for ground). High-end RPG dialogue portrait / character-select card quality.

**World aesthetic:** Bioluminescent forest-fantasy. Overgrown organic architecture of living wood,
sap, moss, vines, glowing fungi, drifting spores. Ancient stone reclaimed by nature.
Dark-academia / folk-mystic undertone.

**Palette:** Forest greens, earth browns, ancient-stone grey. Sap-phase accents:
- Blue phase: cool moonlit blues/silvers, calm
- Crimson phase: warm reds/deep oranges, dramatic rim light
- Silver phase: pale ethereal silver-white, dreamlike

**Rendering:** `pixelArt: false`, `antialias: true`. High-res painted art uses LINEAR filtering.
Only 16×16 Kenney tilesets use NEAREST filtering (set manually in BootScene).

**Asset resolutions:**
- Enemy/boss paintings: 640×640px
- NPC portraits: 512×512px
- Scene backdrops: 768×768px
- Character sprite sheets: 64×64px frames (downscaled 4x from 256px originals)
- Spell/item icons: 192–256px
- UI elements: high-quality painted PNGs

**UI colors:**
- Panel backgrounds: `0x1a1a2e` (dark navy), `0x0d0d1a` (near-black)
- Gold accent: `#ffd700`
- Tree colors: Martial `0xcc6644`, Guardian `0x4488aa`, Soul Magic `0xaa44cc`, Verdant `0x44aa66`, Tactical `0x88aa44`
- HP bar: green. Sap bar: blue. DSP bar: gold.
- Font: 'Open Sans' for UI, 'Cinzel' for titles

**Image generation:** `scripts/generate-images.mjs` uses OpenAI's gpt-image-1 API.
Style bible in `docs/NPC_PORTRAIT_PROMPTS.md` § 0.

## Game systems reference

| System | Status | Key mechanic |
|--------|--------|-------------|
| Sap Cycle | Working | 15-day rotation (Blue/Crimson/Silver) affects combat modifiers, lighting, prices |
| DSP (Domain Soul Pool) | Working | Shared world-magic pool; spells drain it; quests recover it; thresholds change world |
| Tactical Combat | Working | Grid-based turn combat on enemy contact |
| Class System | Working | 5 classes: Verdant Guardian, Emerald Mystic, Thornbinder, Sporecaller, Bloomguard |
| Talent Trees | Working | 5 trees × 5 talents each, 1 point per level, in `data/skills.json` |
| Quest System | Working | Data-driven from `data/quests.json` |
| Companion System | Working | Party members follow player, auto-attack |
| Faction System | Working | Reputation with factions affects dialogue, prices, endings |
| Moral Choices | Working | MoralChoicePanel with timer, DSP/faction impacts |
| Veilkeepers | Working | Mentor NPCs that offer guidance at DSP cost |
| Crafting | Working | Station-based crafting from `data/recipes.json` |
| Shop | Working | NPC shops with Charisma discount |
| Inventory | Working | Item management with stacking |
| Lighting | Working | AdvancedLightingSystem with MULTIPLY render texture |
| Dialogue | Working | Typewriter effect, sequential lines, role-based follow-up |

## Known issues & recurring bugs

- **Body offset drift**: Phaser `body.y ≠ sprite.y` when `setOffset()` is used. Never read `body.y` for visual positioning — store a `_baseY` or use `sprite.y`.
- **MULTIPLY RT black screen**: AdvancedLightingSystem's render texture must be `fill(0xffffff, 1)` on creation or first frame is black.
- **Scene restart listener leaks**: EventBus outlives scenes. Every `EventBus.on()` must have a matching cleanup in `destroy()`/`shutdown()`.
- **Data files in production**: JSON files must be in `public/data/` (not root `data/`) for Vite to include them in `dist/`.

## Docs (read priority for deep dives)

### Creative & Design
1. `docs/ART_STYLE.md` — visual identity, palettes, asset specs, UI standards
2. `docs/LORE.md` — world history, factions, ancestries, companions, story arcs, endings
3. `docs/GAME_MECHANICS.md` — stats, combat, classes, spells, DSP, progression, economy
4. `docs/VISUALS.md` — lighting, post-processing, camera, particles, VFX, motion tweens

### Technical
5. `docs/CLAUDE_AGENT_GUIDE.md` — architecture, EventBus wiring, pitfalls
6. `docs/BEST_PRACTICES.md` — rules that prevent real bugs
7. `docs/BUILD_PLAYBOOK_AND_ROADMAP.md` — vision, phased roadmap
8. `docs/GAME_VISION.md` — game design source of truth
9. `docs/ARCHITECTURE.md` — stack, folders, EventBus table, controls
10. `docs/NPC_PORTRAIT_PROMPTS.md` — art style bible for image generation

## Verification checklist (before saying "done")

1. `npm run build` succeeds
2. If data changed → `npm run validate-data`
3. No new EventBus listeners without matching unsubscribe
4. No `body.y` reads for visual positioning
5. Trace any new listener cleanup upward to confirm something calls it
