# Glossary — Realm of Nexus: Verdance

Short definitions for **docs and agents**. If code or `data/*.json` disagree with a row here, **trust the implementation** and update this glossary.

| Term | Meaning |
|------|--------|
| **AP** | Action Points in tactical combat — spent on moves and abilities (`TacticalCombatSystem`). |
| **ContentInitializer** | Registers JSON into runtime systems (`registerQuests`, `registerDialogues`, …) and **`wireSaveSystem`** for `save-collect` / `save-restore`. |
| **DSP** | Domain Soul Pool — shared world magic pressure; major magic drains it; thresholds change tone and mechanics (`DSPSystem`). |
| **EventBus** | `src/core/EventBus.js` — pub/sub. **Default export** is the singleton instance; **named** `EventBus` is the class (`getInstance()`). |
| **Guard** | Defensive resource in tactical combat (armor integrity, regenerates) — see tactical docs / `TacticalCombatSystem`. |
| **Hollowing** | Cost / state tied to Veilkeeper overuse — see `VeilkeeperSystem` and `veilkeepers.json`. |
| **Overworld** | Real-time exploration in `GameScene` (WASD, NPCs, overworld spells) before/after tactical. |
| **Pure / Blighted** | Character variant at creation — can gate abilities and narrative flags. |
| **Sap** | Personal magical resource for many spells; may appear alongside DSP depending on spell data. |
| **Sap Cycle** | Rotating phases (e.g. blue → crimson → silver) with timers — `SapCycleManager`; drives lighting and modifiers. |
| **Tactical** | Grid-based, turn combat (`TacticalCombatSystem`) started from overworld enemy contact. |
| **UIScene** | Parallel HUD / UI scene launched with `GameScene`. |
| **Veilkeeper** | Mentor spirit; consultations cost resources; **permanent death** when depleted — `VeilkeeperSystem`. |
| **Verdance** | The realm’s magical nature; subtitle of the game. |
| **VFX integration** | `SpellVFXIntegration` (+ particles/lighting) — listens for `spell-cast` / `spell-impact`. |

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md) (controls, Sap timers), [CLAUDE_AGENT_GUIDE.md](./CLAUDE_AGENT_GUIDE.md) (skill-check IDs).
