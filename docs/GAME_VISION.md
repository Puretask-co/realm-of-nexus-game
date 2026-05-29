# Realm of Nexus: Verdance — Game Vision (Source of Truth)

**Status:** Living doc. When this disagrees with older docs, **this wins** — then fix the older doc.
**Last updated:** 2026-05-29

This is the one-page answer to three questions: **what is the game, what is the player
trying to do, and what systems does it have (and how real is each one).** It consolidates
the PRD and ~18 scattered docs and reconciles them against what the code actually runs.

---

## 1. What the game is — in one paragraph

A **browser-based 2D tactical RPG** set in the **Verdance**, a fantasy world whose magic is
dying. You explore the world one zone at a time; touching an enemy drops you into a
**turn-based grid battle**. The hook that makes it *ours*: **magic is a finite, shared world
resource (DSP — Domain Soul Pool).** Big spells literally drain the world's life, and a
rotating **15-day Sap Cycle** (Blue → Crimson → Silver) constantly reshapes combat, prices,
enemy aggression, and lighting. The core fantasy is **"power is poison"**: every spell is a
bet against the world you are trying to save.

**One-sentence pitch:** A tactical RPG where the world's magic is finite, time moves in
phases, and every choice — spell, mentor, alliance, morality — permanently shapes the world
and its ending.

**Comparables:** Final Fantasy Tactics / Divinity (tactics) × Disco Elysium (consequence).

---

## 2. What the player is trying to accomplish

| Horizon | Goal | Tension |
|---|---|---|
| **Moment-to-moment** (a battle) | Win the grid fight via positioning (flank, cover, class pillar) and well-timed spells. | Spending magic to win drains DSP / personal Sap. |
| **Session** (a play hour) | Level up, finish quests, raise faction reputation, recruit companions, consult Veilkeepers, make moral choices. | Choices alienate one faction while pleasing another; DSP thresholds visibly worsen the world. |
| **Campaign** (whole game) | Advance the 3 acts (**Awakening → Descent → Revelation**) to one of multiple endings. | The ending is decided by how much you healed vs. corrupted the world (DSP + moral flags). |

**Win/Loss:** Loss = player HP hits 0 (`_onPlayerDeath` → respawn with penalties). "Win" =
reach an **ending branch**, evaluated on main-quest completion from accumulated moral/era flags.

---

## 3. Design pillars (every feature must reinforce one)

1. **Restraint as power** — casting drains the shared DSP pool; thresholds reshape the world. Patience is rewarded.
2. **Temporal pressure** — the 15-day Sap Cycle changes combat, economy, aggression, lighting. Time is a resource.
3. **Meaningful positioning** — the grid rewards flanks, cover, and class pillar mechanics.
4. **Consequence** — factions, moral flags, Veilkeeper permanence, and era gating react visibly.
5. **Data-driven content** — spells/quests/enemies/dialogue/items/locations live in `data/*.json`.

---

## 4. The core loop (the spine of the game)

```
Boot → pick Class → create Character → enter a Zone
   └─ explore (WASD) → talk to NPCs (E) / pick up quests
        └─ touch enemy → TACTICAL GRID BATTLE
             └─ win → XP + loot → back to overworld   (lose → respawn, penalties)
        └─ cast spell → DSP/Sap drain → Sap-phase modifier applies
        └─ complete quest → reward + DSP recovery → world reacts
   └─ travel to next zone (rebuilds the active zone) … repeat across 3 acts → ENDING
```

**Audit of the loop in code (verified 2026-05-29):**

| Step | State | Note |
|---|---|---|
| Boot → class → creation → GameScene | ✅ Works | |
| Enter zone / travel (one zone on screen) | ✅ Works | Single-active-zone model. |
| Enemy contact → tactical combat | ✅ Wired | `_startTacticalEncounter`. |
| Win → XP + loot to inventory | ✅ Wired | `_onTacticalCombatEnded`. |
| Spell cast → DSP drain | ⚠️ Partial | Only `GameScene._castSpell` drains DSP; the `SpellSystem.beginCast` path is **dead code**. |
| Sap phase modifies the fight | ⚠️ Weak | Modifier exists but is barely visible to the player. |
| Quest complete → DSP recover → world reacts | ✅ Wired | `dspSystem.recover` on quest complete. |
| Death / endings | ✅ Wired | `_onPlayerDeath`; ending evaluated on main-quest completion. |
| **Verified in a real browser** | ❌ No | No Chromium in CI sandbox; "wired" ≠ "feels good." Manual play-test required. |

---

## 5. Systems & features — what's real

Legend: ✅ **Have** (in main play path) · 🟡 **Partial** (exists; UI/balance/hooks incomplete) · 🔴 **Missing**.

### Gameplay systems
| System | Status | Reality |
|---|---|---|
| Overworld movement + zone travel | ✅ | One zone fills the screen; travel rebuilds it. |
| Tactical grid combat (AP, Guard, flank/cover, class pillars) | 🟡 | Core math runs; **UI clarity + balance unproven**. The #1 thing to make fun. |
| DSP (shared magic pool + thresholds) | 🟡 | Drains/recovers; thresholds need stronger world feedback. |
| Sap Cycle (15-day Blue/Crimson/Silver) | ✅ | Calendar + lighting; combat effect under-communicated. |
| Personal Sap | ✅ | Gates most spells — **coexists** with DSP (hybrid, not unified). |
| Progression (XP/levels) | 🟡 | Works; **two level counters exist** (Progression vs Quest) — consolidate. |
| Quests (5 objective types) | ✅ | 50 quests; objectives wired to real events. |
| Dialogue trees | ✅ | 52 characters in data. |
| Factions (reputation) | ✅ | Reputation tracked; resets on new game. |
| Attributes (Might/Agility/Resilience/Insight/Charisma) | ✅ | Derived stats computed. |
| Save/Load (3 slots + autosave) | ✅ | Position, zone, vitals, most systems persist. |
| Veilkeepers (mentor spirits) | 🟡 | Logic + data; **no dedicated consult UI**. |
| Narrative eras / acts | 🟡 | Loaded; era gating not fully player-visible. |
| Moral choices | 🟡 | State tracked; **no universal choice overlay**. |
| Companions | 🟡 | Definitions + followers; party UX thin. |
| Crafting | 🟡 | System exists; **UI thin/missing**. |
| Skill checks (12 skills) | 🟡 | Code IDs differ from `skills.json` categories. |
| AI Dungeon Master (Claude API) | 🟡 | Optional; needs API key + UI queue. |

### Player-facing UI gaps (most-felt missing pieces)
🔴 Spellbook · 🔴 Veilkeeper consultation UI · 🔴 universal moral-choice overlay ·
🟡 crafting stations UI · 🟡 shop buy/sell loop · 🟡 quest journal clarity · 🟡 DSP/world-health readout.

### Content (in `data/*.json`, verified counts)
classes **5** · ancestries **3** *(PRD targets 5 — gap)* · spells (6 class pools) · enemies **88** ·
quests **50** · locations **27** · dialogues **52** · veilkeepers **5** · companions **(defined)** ·
recipes **42** · acts **3**.

**The 5 classes:** Bloomguard · Thornbinder · Emerald Mystic · Wildkin Ranger · Sporecaller.
**Ancestries:** Human · Soulborn · Half-Abyss.
**Veilkeepers:** Sylthara · Morvein · Elduin · Kaelthas · Virelda.

---

## 6. Scope: the vertical slice to build first

Don't build narrative breadth until **one battle is genuinely fun.** Ship this slice end-to-end:

> **Slice A — Core combat loop.** New game → class → creation → spawn in **one** zone → move,
> cast a spell (VFX + damage + DSP drain), touch an enemy → **grid battle with readable UI** →
> win → XP/loot → autosave → reload returns you intact.

**Done when:** no crashes; tactical UI clearly shows whose turn / AP / target / flank bonus;
the current Sap phase visibly changes the fight; one enemy defeat grants XP+loot; save/load round-trips.

**Recommended build order after the slice:**
1. **Tactical combat feel** (readability + balance) — the minimum game.
2. **Make the Sap Cycle visibly matter** in a fight — the unique selling point, cheap once combat is solid.
3. **DSP consequences** — thresholds that visibly scar/heal the world.
4. Then breadth: Veilkeeper/moral/crafting UIs, more quests, endings polish.

---

## 7. Known inconsistencies to resolve (decisions needed)

- **DSP vs personal Sap** — unify into one resource story, or formally document the hybrid.
- **Two spell-cast paths** — keep `GameScene._castSpell`, delete/retire `SpellSystem.beginCast`, or unify so both drain DSP.
- **Two level systems** — pick `ProgressionSystem` (maxLevel 10) or `QuestSystem` counter; align XP curve.
- **Ancestry count** — 3 in data vs 5 in PRD: add two or revise the target.
- **Max level** — docs say 10; confirm and enforce one number.
