# Product Requirements Document — Realm of Nexus: Verdance

**Version:** 1.0  
**Date:** 2026-04-05  
**Status:** Active  

---

## 1. Product Overview

### 1.1 Product Summary

**Realm of Nexus: Verdance** is a browser-first 2D tactical RPG built on Phaser 3 + Vite. Players explore a living Verdance-fantasy world where magic draws on a **shared domain resource (DSP)**, a **15-day Sap Cycle** calendar reshapes gameplay phases and lighting, and a rich narrative layer — factions, companions, mentor spirits (Veilkeepers), and an optional AI Dungeon Master — drives a multi-era campaign to multiple endings.

### 1.2 One-Sentence Pitch

A tactical RPG where the world's magic is finite, time moves in phases, and every choice — combat, spell, mentor consultation, moral alignment — permanently shapes the domain and its ending.

### 1.3 Platform & Distribution

| Attribute | Value |
|-----------|-------|
| **Platform** | Browser-first (zero install; `localhost:3000` in dev; static `dist/` for production) |
| **Engine** | Phaser 3.80+ |
| **Build tool** | Vite 5 |
| **Language** | Vanilla JavaScript (ES modules) |
| **Save persistence** | `localStorage` (3 manual slots + 1 auto-save) |
| **Optional feature** | AI Dungeon Master via Claude API (`VITE_ANTHROPIC_API_KEY`) |

---

## 2. Goals & Success Criteria

### 2.1 Product Goals

1. Ship a **complete playable loop**: new game → explore → tactical combat → quest resolution → save/load — without crashes or data corruption.
2. Make the **DSP and Sap Cycle mechanics legible** to players through HUD, UI events, and world feedback.
3. Deliver a **campaign with at least two distinct endings** driven by player choices across factions, moral flags, and narrative eras.
4. Establish a **data-driven content pipeline** that lets designers extend spells, quests, enemies, and dialogue without touching engine code.

### 2.2 Release Criteria

| Layer | Criterion |
|-------|-----------|
| **Playable** | New game → explore → overworld combat → tactical grid encounter → save/load cycle completes without error |
| **Understandable** | HUD surfaces DSP, personal Sap, current Sap Cycle phase, and active quest objective at all times |
| **RPG-complete** | Shop, crafting, faction reputation, and moral consequence are all visible in gameplay |
| **Campaign-complete** | All 6 narrative eras advance correctly; at least 2 ending branches reachable from in-game flags |
| **Content targets** | ≥5 classes, ≥5 ancestries, ≥50 spells, ≥20 quests, ≥5 Veilkeepers, ≥5 companions, ≥6 locations |
| **Production** | CI green (`npm run build` + `npm run validate-data` + smoke tests); README; credits; accessibility basics |

---

## 3. Target Audience

| Segment | Description |
|---------|-------------|
| **Primary** | Tactical / strategy RPG fans (XCOM, Divinity, Final Fantasy Tactics) who value systems depth and meaningful choices |
| **Secondary** | Narrative RPG fans (Disco Elysium, Baldur's Gate) drawn by moral consequence, faction reputation, and AI-enhanced storytelling |
| **Tertiary** | Browser game hobbyists seeking a zero-install RPG experience with replay value from branching outcomes |

---

## 4. Design Pillars

Every feature decision should reinforce these five pillars:

1. **Restraint as power** — Casting costs DSP (shared world pool). Thresholds reshape world state. Patience and resource management are rewarded.
2. **Temporal pressure** — The 15-day Sap Cycle (Blue 7d → Crimson 5d → Silver 3d) affects combat modifiers, economy prices, enemy aggression, and ambient lighting. Time is a resource.
3. **Meaningful positioning** — Tactical grid rewards flanks, cover, and class-specific pillar mechanics. Positioning is a first-class decision.
4. **Consequence** — Faction reputation, moral flags, Veilkeeper permanence, and era gating all react visibly to player choices.
5. **Data-driven content** — All spells, quests, enemies, dialogues, items, and locations live in `data/*.json`. Designers extend content without touching engine code.

---

## 5. Core Feature Requirements

### 5.1 Game Flow & Scenes

| Scene | Requirement |
|-------|-------------|
| **Boot** | Load all `data/*.json` via `DataManager`; validate schemas; generate placeholder assets if missing; no crash on fresh install |
| **Class Selection** | Present all 5 classes (bloomguard, thornbinder, emerald_mystic, wildkin_ranger, sporecaller) with Verdance lore; selection persists to character creation |
| **Character Creation** | 5-step flow: ancestry → attribute allocation → Pure/Blighted variant → backstory; input validated before GameScene launch |
| **GameScene** | Orchestrates all gameplay: overworld movement, zone transitions, NPC interaction, overworld spells, tactical encounter trigger, system ticks |
| **UIScene** | Parallel HUD overlay: current DSP, Sap, phase indicator, health, active quest, minimap |
| **Pause / Settings** | Accessible at any time; volume, difficulty, save slot management |
| **World Map** | Player-visible map of 6 locations with travel and discovered-state tracking |
| **Ending Scene** | Renders correct ending branch based on accumulated moral flags and era completion state |

### 5.2 Overworld Exploration

- WASD / arrow-key real-time movement
- NPC interaction via proximity trigger + `E` key; opens dialogue tree
- Overworld spell casting targets nearest enemy (configurable keys)
- Zone transitions via portal objects; `PortalSystem` manages entry/exit state
- Minimap rendered by `MinimapRenderer` with fog-of-war cleared on exploration

### 5.3 Tactical Combat

| Requirement | Detail |
|-------------|--------|
| **Trigger** | Enemy contact in overworld transitions to grid scene |
| **Grid** | Turn-based; AP (Action Points) per turn; Guard resource for defense |
| **Positioning** | Flanking and cover grant damage/defense bonuses via `TacticalCombatSystem` |
| **Class pillars** | Each class has at least one unique pillar mechanic (e.g., thornbinder root/grab) active in grid combat |
| **Undo** | Last action within a turn is undoable before commitment |
| **Spell use** | Spells cost DSP (deducted from shared pool) and/or personal Sap; phase modifiers apply |
| **Enemy AI** | State machine: idle → chase → attack → flee; phase-reactive aggression |
| **Rewards** | XP, loot dropped to inventory; `ProgressionSystem` handles level-up |

### 5.4 Magic & Resource Systems

#### DSP (Domain Soul Pool)
- Shared world pool: 0–100
- Major spells drain DSP; recovery is slow and tied to game events
- **Thresholds** (configurable in `config.json`) change world state: enemy behavior, dialogue tone, ambient lighting, NPC attitudes
- HUD shows DSP at all times; UI events (`dsp-threshold-crossed`) broadcast for reactive systems

#### Sap Cycle
- 15-day rotating calendar: Blue phase (7d) → Crimson phase (5d) → Silver phase (3d)
- Each phase applies configurable modifiers: spell damage multipliers, shop price adjustments, enemy aggression, ambient light tint + particle effects
- Phase is visible in HUD; transitions emit `phase-changed` event consumed by lighting, audio, and AI systems
- Phase durations tunable in `config.json` without code changes

#### Personal Sap
- Per-character magical resource for select abilities
- Distinct from DSP; does not affect world state thresholds

### 5.5 Character Progression

| System | Requirement |
|--------|-------------|
| **Classes** | 5 classes; each has unique ability set, pillar mechanic, and spell pool sourced from `classes.json` |
| **Ancestries** | 5 ancestries; affect starting attributes and narrative options |
| **Attributes** | 5 core (Might, Agility, Resilience, Insight, Charisma); player-allocated at creation; derived stats (HP, defense, etc.) computed by `AttributeSystem` |
| **XP / Levels** | `ProgressionSystem` awards XP from combat and quests; level-up improves stats per class growth curve |
| **Skills** | 12 use-based skills (athletics, stealth, arcana, etc.); improve through use; checked via `SkillCheckSystem` |
| **Talent Trees** | Talent unlocks sourced from `skills.json`; accessible from `SkillTreePanel` in UIScene |
| **Pure/Blighted** | Moral variant choice at creation affects dialogue options and some narrative gating |

### 5.6 Quests & Narrative

| System | Requirement |
|--------|-------------|
| **Quests** | ≥20 quest chains in `quests.json`; objectives tracked in `QuestSystem`; active quest displayed in journal panel |
| **Dialogue** | NPC dialogue trees in `dialogues.json`; branching based on quest state, faction reputation, and moral flags |
| **Narrative eras** | 6 eras in `story.json`; `NarrativeSystem` gates content and unlocks acts based on era completion flags |
| **Moral choices** | `MoralChoiceSystem` tracks moral flags across the campaign; feeds directly into ending determination |
| **Endings** | ≥2 distinct ending branches reachable from in-game play; `EndingScene` reads flags and renders correct branch |

### 5.7 Factions & Social Systems

- 6 factions with reputation tracking (`FactionSystem`); reputation gates quests and dialogue options
- Faction standing modified by quest choices, combat outcomes, and dialogue selections
- Faction state visible in dedicated UI panel

### 5.8 Veilkeepers (Mentor Spirits)

- 5 Veilkeepers defined in `veilkeepers.json`
- Players may consult Veilkeepers for guidance; each consultation costs resources (Sap / DSP)
- **Permanent death**: when a Veilkeeper's resource pool is depleted, they are gone for the remainder of the campaign
- Veilkeeper UI panel shows current vitality, consultation cost, and available guidance
- Death is communicated clearly to the player; consequences persist in saves

### 5.9 Companions

- 5 recruitable companions defined in `companions.json`
- Each companion has bond levels; bond increases through shared events and choices
- Bond level unlocks companion-specific perks and dialogue
- Companion panel in UIScene shows party composition, bond meters, and active perks

### 5.10 Economy & Crafting

| System | Requirement |
|--------|-------------|
| **Shop** | Buy/sell items; prices vary by Sap Cycle phase (Crimson = +20% markup); inventory management with weight/slot limits |
| **Crafting** | Station-based recipes from `recipes.json`; requires correct station type in zone; phase bonuses on output quality |
| **Items** | Equipment (weapons, armor), consumables, crafting materials sourced from `items.json` with full stat definitions |
| **Loot** | Enemy defeat drops loot to inventory; drop tables in `enemies.json` |

### 5.11 Save System

- 3 manual save slots + 1 auto-save slot
- Auto-save triggered at zone transitions and quest completions
- Save corruption must not occur on unexpected quit (atomic write or validated restore)
- All systems serialize state via `save-collect` / `save-restore` EventBus events wired through `ContentInitializer.wireSaveSystem`

### 5.12 Optional AI Dungeon Master

- Claude API integration via `AIDungeonMaster.js`
- Generates emergent narration layered on top of structured quests and events
- Activated when `VITE_ANTHROPIC_AI_KEY` is present in environment
- Graceful no-op when API key is absent; game must be fully playable without it
- AI narration should respect current quest state, moral flags, phase, and DSP level when generating text

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Performance** | Stable 60 FPS on mid-range hardware; particle pooling prevents GC spikes |
| **Build** | `npm run build` completes in <10s; `npm run dev` HMR in <1s |
| **Data validation** | `npm run validate-data` passes before any merge that touches `data/` |
| **Test coverage** | Playwright smoke tests cover: boot, class selection, character creation, game start, save/load |
| **Accessibility** | Keyboard-only playable; font sizes ≥14px; color-blind safe phase indicators (not color alone) |
| **Browser support** | Latest Chrome, Firefox, Edge; WebGL required; graceful fallback message if WebGL absent |
| **Load time** | Initial page load to game-ready <5s on broadband |
| **Data extensibility** | Adding a new spell/quest/item requires only a `data/*.json` edit + `npm run validate-data` |

---

## 7. Technical Architecture Summary

### 7.1 Event-Driven Communication

All systems communicate via `EventBus` (singleton). Key contracts:

| Event | Emitter | Primary Consumers |
|-------|---------|-------------------|
| `phase-changed` | `SapCycleManager` | Lighting, AudioManager, AI, UIScene |
| `spell-cast` | Player / GameScene | SpellVFXIntegration, CombatSystem |
| `spell-impact` | CombatSystem | DamageNumberRenderer, CameraSystem |
| `enemy-defeated` | CombatSystem | ProgressionSystem, GameScene, QuestSystem |
| `dsp-threshold-crossed` | DSPSystem | NPCDialogue, EnemyAI, LightingSystem |
| `save-collect` / `save-restore` | SaveManager | All serializable systems |
| `data-reloaded` | DataManager | Hot-reload consumers (dev only) |

### 7.2 Data Pipeline

```
data/*.json → DataManager (load + validate) → ContentInitializer (register into systems) → GameScene (runtime)
```

Hot-reload polls every 2 seconds in dev mode; emits `data-reloaded` on change.

### 7.3 Key Architectural Constraints

- `GameScene.js` is the orchestration hub; avoid instantiating core systems outside it
- `ContentInitializer.wireSaveSystem` is the single location for save wiring — all new persistent state goes here
- Use `TacticalCombatCameraBridge` and `AdvancedCameraSystem` for camera control; `CombatCameraIntegration` is not API-compatible and must not be used until refactored
- `SkillCheckSystem` uses 12 lowercase string IDs (`athletics`, `stealth`, `arcana`, …); these are **not** the same namespace as talent tree IDs in `skills.json`

---

## 8. Phased Roadmap

### Phase 0 — Foundation (Complete)
Stable boot → class select → character create → GameScene + UIScene. DataManager, EventBus, SaveManager, core integrations operational. `npm run build` passes clean.

### Phase 1 — Core Combat Loop (Complete)
Overworld movement, enemy contact, grid tactical encounter, AP/Guard/spell use, enemy defeat → XP → level-up. Save/load persists combat state.

### Phase 2 — Quest Chains (Complete)
NPC dialogue trees, quest acceptance/tracking/completion, journal panel, XP/faction rewards. At least 3 full quest chains playable end-to-end.

### Phase 3 — Player Clarity (Complete)
HUD polish: DSP bar, Sap bar, phase indicator, minimap. Pause menu functional. Tutorial overlays for combat and crafting. New player can understand core systems without external docs.

### Phase 4 — Economy & Crafting (Active)
Shop buy/sell with phase pricing. Crafting panel with recipe browser and station gating. Item drops wired from enemies.json. Inventory management UI complete.

### Phase 5 — Veilkeeper System
Veilkeeper consultation UI. Cost deduction from DSP/Sap. Permanent death state persisted in saves. Hollowing effects on world state when Veilkeepers are lost.

### Phase 6 — Companions
Companion recruitment in-world. Bond level system. Companion perks active in tactical combat. Party management panel functional.

### Phase 7 — Narrative Integration
All 6 narrative eras advance from in-game actions. Faction reputation visibly gates dialogue and quests. Moral choice panel accessible. Era-gated content locked/unlocked correctly.

### Phase 8 — Endgame & Polish
Both ending branches playable from in-game play. AI Dungeon Master integration validated end-to-end. Balance pass (combat, economy, DSP drain rates). Accessibility audit. Full CI green. Release build verified.

---

## 9. Out of Scope

The following are explicitly excluded from the current product scope unless a scope change is approved:

- 3D engine migration (project stays on Phaser 3)
- Multiplayer or co-op
- Mobile native app (iOS/Android)
- Procedurally generated campaigns (AI narration ≠ procedural campaign structure)
- Modding SDK / external plugin system
- Renaming classes or systems based on older design documents that contradict `classes.json` and live code

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DSP mechanic feels punishing, not strategic | Medium | High | Tune drain rates and recovery in `config.json`; playtest DSP threshold UX before Phase 8 |
| AI DM responses break immersion or reveal internal state | Medium | Medium | Prompt engineering guardrails in `AIDungeonMaster.js`; feature is opt-in |
| Save data corruption on mid-campaign updates | Low | High | Version saves; `ContentInitializer.wireSaveSystem` must handle missing keys gracefully |
| Veilkeeper permanent death feels arbitrary | Medium | High | Clear resource visibility in Veilkeeper panel; confirmation step before costly consultations |
| Scope creep from data-driven extensibility | High | Medium | Feature freeze on data schema changes after Phase 6; additions via new JSON fields only |
| WebGL fallback absent on older hardware | Low | Medium | `main.js` already includes graceful fallback message; validate in CI with headless Chrome |

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| **DSP** | Domain Soul Pool — shared world magic resource (0–100); shared across all casters; threshold effects reshape world state |
| **Sap** | Personal magical resource for select abilities; distinct from DSP |
| **Sap Cycle** | 15-day rotating calendar (Blue → Crimson → Silver phases) that modifies gameplay variables |
| **AP** | Action Points — resource spent per action in grid tactical combat |
| **Guard** | Defensive resource in tactical combat; reduces damage when allocated |
| **Veilkeeper** | Mentor spirit; consultation costs resources; permanent death when pool depleted |
| **Pure/Blighted** | Moral variant chosen at character creation; affects dialogue and narrative gating |
| **EventBus** | Singleton pub/sub system decoupling all game systems |
| **ContentInitializer** | Boot-time registrar that wires JSON data into runtime systems and the save pipeline |
| **DataManager** | Async JSON loader with schema validation and hot-reload (dev) |
| **Pillar mechanic** | Class-specific combat ability active in grid tactical encounters |

---

*This PRD supersedes scattered vision notes in design docs where conflicts exist. Source of truth for implemented behavior is always `src/` + `data/*.json`. Refer to `docs/AGENTS.md` for the full documentation index.*
