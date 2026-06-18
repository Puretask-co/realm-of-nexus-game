# Game Mechanics — Realm of Nexus: Verdance

A comprehensive player-facing reference for all core systems, stats, combat, progression, and more.

---

## Core Loop

Boot → Pick Class → Create Character → Enter Zone → Explore (WASD) → Talk to NPCs (E) → Touch Enemy → Tactical Grid Battle → Win → XP + Loot → Back to Overworld → Travel to Next Zone → Repeat Across 3 Acts → Ending

---

## Attributes (5 Core Stats)

| Attribute   | Effects |
|-------------|---------|
| **Might**     | Melee damage bonus; carry weight = 10 + Might x 5 slots |
| **Agility**   | Movement speed = 4 + modifier; dodge/evasion = 10 + Agility + Armor; crit chance; initiative |
| **Resilience** | Max HP = 20 + Resilience x 5; defense bonus; poison resistance |
| **Insight**   | Spell power bonus; Sap regeneration rate; Veilkeeper consultation clarity |
| **Charisma**  | Unlocks dialogue options; increases faction reputation gains; shop price modifier |

### Point Allocation at Character Creation

- **Starting points:** 8 to distribute freely
- **Minimum per stat:** 0
- **Maximum per stat at creation:** 4
- **Absolute cap (with level-ups):** 6

---

## Classes (5)

| Class | Role | Might | Agility | Resilience | Insight | Charisma | HP | Guard | AP | Variant |
|-------|------|:-----:|:-------:|:----------:|:-------:|:--------:|:--:|:-----:|:--:|---------|
| **Bloomguard** | Tank | 3 | 0 | 4 | 1 | 1 | 45 | 10 | 3 | Pure / Blighted |
| **Thornbinder** | Rogue | 1 | 4 | 1 | 2 | 1 | 30 | 3 | 4 | Pure / Blighted |
| **Emerald Mystic** | Caster / Healer | 0 | 1 | 1 | 4 | 3 | 28 | 2 | 3 | Pure / Blighted |
| **Wildkin Ranger** | Ranged | 2 | 3 | 1 | 2 | 1 | 34 | 4 | 3 | Pure / Blighted |
| **Sporecaller** | Controller | 0 | 1 | 3 | 3 | 2 | 32 | 5 | 3 | Pure / Blighted |

- **Pure** and **Blighted** variants are chosen at character creation and affect story, abilities, and NPC reactions.

---

## Combat -- Overworld (Real-Time)

| Mechanic | Details |
|----------|---------|
| **Movement** | WASD with acceleration and drag (skating momentum feel) |
| **Spell casting** | Keys 1-5, auto-targets nearest enemy |
| **Dash** | SPACE -- 150 ms burst at 2.5x speed, 1 s cooldown, grants 0.5 s invincibility |
| **Damage invincibility** | 0.5 s invincibility frames after taking any hit |
| **Zone speed modifiers** | Hub 100%, Forest 80%, Void/Corruption 70% |

---

## Combat -- Tactical (Grid-Based)

Triggered when the player makes contact with an enemy in the overworld.

### Grid and Turn Order

- **Grid type:** Hexagonal
- **Initiative roll:** d20 + Agility (highest goes first)

### Action Points (AP)

- **Base AP per turn:** 2
- **Bonus AP:** 3 total if Agility >= 4

### Action Costs

| Action | AP Cost | Notes |
|--------|:-------:|-------|
| Move (1 hex) | 1 | Per hex moved |
| Basic Attack | 1 | Melee or ranged depending on class |
| Tier 1 Spell | 1 | Also costs DSP (see Spell System) |
| Tier 2 Spell | 2 | Also costs DSP |
| Tier 3 Spell | 3 | Also costs DSP |
| Use Item | 1 | Consumables from Quick Slots |
| Defend | 1 | Blocks 50% incoming damage until next turn |

### Guard

Guard absorbs damage before HP is touched.

| Detail | Value |
|--------|-------|
| Passive regen | +2 Guard per turn |
| Defend regen | +4 Guard per turn |
| Light armor cap | 5 |
| Medium armor cap | 10 |
| Heavy armor cap | 15 |

### Positioning Bonuses

| Position | Bonus |
|----------|-------|
| High ground | +1 attack |
| Flanking | +2 attack |
| Cover | +2 evasion |

### Critical Hits

- **Standard:** Natural 20 on the attack roll
- **Silver Sap phase:** Crit range expands to 18-20
- **Effect:** Double damage

---

## Damage Formula

```
(Base Damage + Attribute Bonus + Phase Modifier) - Enemy Defense or Evasion
```

- **Melee:** Attribute bonus = Might
- **Spells:** Attribute bonus = Insight
- **Element resistance** is applied per enemy (some enemies resist or are weak to specific elements)

---

## Spell System

### Resource: DSP (Domain Soul Pool)

A shared world pool ranging from 0 to 100 (see DSP section below for full details).

### Spell Tiers

| Tier | DSP Cost | AP Cost |
|------|:--------:|:-------:|
| Tier 1 | 5 | 1 |
| Tier 2 | 10-15 | 2 |
| Tier 3 | 20-30 | 3 |

### Elements (6)

Fire, Ice, Thunder, Void, Verdant, Radiant

### Spell Slots

- **Maximum spells known:** 10
- **Equipped at once:** 5 (mapped to hotkeys 1-5)

### Sap Phase Modifiers

| Phase | Effect on Spells |
|-------|-----------------|
| Crimson | +5 DSP cost to all spells |
| Silver | -5 DSP cost, +20% spell damage |
| Blue | Neutral (no modifier) |

### Cooldowns

Each spell has an individual cooldown of 1 to 8 turns in tactical combat.

### Status Effects

| Effect | Description |
|--------|-------------|
| Poison | 1d4 damage per turn |
| Root | Target cannot move |
| Slow | Movement and initiative reduced |
| Fear | Target flees from caster |
| Decay | Reduces healing received |
| Corruption | Periodic damage, may trigger Blighted events |
| Bleed | Damage over time, worsened by movement |

---

## DSP (Domain Soul Pool)

A shared world magic resource that fluctuates based on player actions and the passage of time. All spell costs draw from this single pool.

### DSP Thresholds

| Range | Name | Effects |
|-------|------|---------|
| 80-100% | Pristine | Spell costs reduced by 20% |
| 60-80% | Balanced | Normal -- no modifiers |
| 40-60% | Strained | Spell costs increase; shop prices +10% |
| 20-40% | Crisis | Spell costs +40%; corrupted enemies begin appearing |
| 5-20% | Catastrophic | Spell costs doubled; chance of spell failure |
| 0-5% | Collapse | Spells cost HP instead of Sap |

### DSP Recovery

| Source | DSP Restored |
|--------|:------------:|
| Blue Sap phase (passive) | +5 per day |
| Rest at HomeBase | +10 |
| Quest completion | +5 to +15 |

---

## Sap Cycle (15-Day Calendar)

The world operates on a repeating 15-day cycle with three phases that affect combat, economy, and exploration.

### Crimson Phase (Days 1-5)

| Category | Modifier |
|----------|----------|
| Enemy damage | +20% |
| Spell costs | +5 DSP |
| Healing effectiveness | -20% |
| Shop prices | +20% |
| Loot quality | -10% |

### Silver Phase (Days 6-8)

| Category | Modifier |
|----------|----------|
| Spell costs | -5 DSP |
| Spell damage | +20% |
| Crit range | 18-20 (expanded from 20) |
| Portals | Rare portals spawn in the world |
| Enemies | Rare enemy variants appear |

### Blue Phase (Days 9-15)

| Category | Modifier |
|----------|----------|
| All saving throws | +2 |
| Healing effectiveness | +30% |
| DSP regen | +5 per day |
| Guard regen | +1 per turn (bonus) |
| Crafting success | +10% |

---

## Progression

### Max Level: 10

### XP Requirements

| Level | XP Required | Cumulative XP |
|:-----:|:-----------:|:-------------:|
| 1 | -- | 0 |
| 2 | 100 | 100 |
| 3 | 250 | 350 |
| 4 | 500 | 850 |
| 5 | 850 | 1,700 |
| 6 | 1,300 | 3,000 |
| 7 | 1,900 | 4,900 |
| 8 | 2,600 | 7,500 |
| 9 | 3,500 | 11,000 |
| 10 | 5,000 | 16,000 |

### Per-Level Rewards

- +1 attribute point
- +10 max HP
- +5 max Guard
- +1 talent point
- New spells may unlock at certain levels

### Multiclassing

Available at **level 5**. Pick one ability from another class's talent tree (ultimate abilities are excluded).

### Talent Trees

- 5 trees per class, 5 talents per tree
- 1 talent point gained per level (10 total by max level)

| Tier | Unlock Level |
|------|:------------:|
| Tier 1 | Level 1 |
| Tier 2 | Level 3 |
| Tier 3 | Level 7 |
| Ultimate | Level 10 |

---

## Skill Checks (12 Skills)

### Formula

```
d20 + Attribute Modifier + Skill Rank   vs   DC (8-20)
```

### Skill List

| Skill | Governing Attribute |
|-------|-------------------|
| Athletics | Might |
| Stealth | Agility |
| Arcana | Insight |
| Herbalism | Insight |
| Lockpicking | Agility |
| Crafting | Insight |
| Scouting | Agility |
| Medicine | Insight |
| Persuasion | Charisma |
| Deception | Charisma |
| Insight (skill) | Insight |
| Survival | Resilience |

- **Rank range:** 0 to 5
- **Improvement:** Skills rank up through successful use

---

## Economy

### Income Sources

- Enemy drops (gold + items)
- Quest rewards
- Selling items to merchants

### Shop Price Modifiers

| Factor | Effect |
|--------|--------|
| Faction reputation | -20% to +20% depending on standing |
| Sap phase -- Silver | Discount |
| Sap phase -- Crimson | Markup (+20%) |
| Charisma | Flat modifier to buy/sell prices |

### Crafting Stations

| Station | Produces |
|---------|----------|
| Forge | Weapons and armor |
| Sanctum | Spells and magical items |
| Workshop | Tools and consumables |

- Recipes require specific materials and the correct station type.
- **Blue phase bonus:** +10% crafting success chance.

---

## Equipment (9 Slots)

### Slot Layout

| Slot | Type |
|------|------|
| Main Hand | Weapon |
| Off-Hand | Shield / secondary weapon / focus |
| Chest | Armor |
| Head | Helmet / circlet |
| Boots | Footwear |
| Ring | Accessory |
| Amulet | Accessory |
| Quick Slot 1 | Consumable / tool |
| Quick Slot 2 | Consumable / tool |

### Rarity Tiers

| Rarity | Color | Stat Multiplier |
|--------|-------|:---------------:|
| Common | White | 1.0x |
| Uncommon | Green | 1.3x |
| Rare | Blue | 1.6x |
| Epic | Purple | 2.0x |
| Legendary | Orange | 2.5x |
| Mythic | Gold | 3.0x |

### Upgrade System

Items can be upgraded from +1 to +3:

- **Weapons:** +1 attack per upgrade level
- **Armor:** +2 defense per upgrade level

### Inventory Capacity

- **Carried:** 10 + Might x 5 slots
- **Stash at HomeBase:** 60 slots

---

## Companions (5 Recruitable, Max 2 in Party)

### Bond System

- Bond levels range from 0 to 5.
- Bond increases through: fighting together in combat, completing companion personal quests, resting together.
- Reaching **bond level 5** unlocks a unique special ability.

### Companion Roster

| Companion | Role | Bond Level 5 Ability |
|-----------|------|----------------------|
| **Vaeril** | Tank | Free spell cast once per fight |
| **Aeliana** | Healer | Revives the player once per zone |
| **Sylor** | Rogue | Intercepts a lethal hit aimed at the player |
| *(Two additional companions discoverable in-game)* | -- | -- |

- Each companion has their own HP, AP, and ability set in tactical combat.
- Companions act on their own initiative in the turn order.

---

## Faction Reputation

### Scale

-100 (Hostile) to +100 (Exalted) across 6 factions.

### How Reputation Changes

- Quest choices (major shifts)
- Killing faction-aligned NPCs or enemies (negative shift)
- Dialogue choices
- Moral decisions during story events

### Reputation Effects

| Standing | Effect |
|----------|--------|
| Positive | Unlocks faction-exclusive quests, shop discounts, unique dialogue |
| Negative | Faction members become hostile, areas may be blocked or dangerous |

---

## Moral Choice System

### Alignment Axes (4)

| Axis | Description |
|------|-------------|
| **Mercy** | Compassion vs. ruthlessness |
| **Truth** | Honesty vs. deception |
| **Sacrifice** | Selflessness vs. self-preservation |
| **Authority** | Leadership vs. independence |

### Choice Points

- **15 major moral decisions** spread across **6 eras** of the story.
- Choices shift your position on one or more alignment axes.

### Endings

- **4 primary endings** determined by your dominant alignment.
- **3 variations per ending** based on secondary axis positions.
- **12 total possible outcomes.**

---

## Veilkeeper Consultation

Five mentor spirits, each governing a unique knowledge domain.

### Mechanics

- Each consultation costs **DSP** and inflicts **Hollowing** on the Veilkeeper.
- **Crimson phase penalty:** +2 Hollowing per consultation (double the normal rate).
- When a Veilkeeper's Hollowing reaches its threshold, that spirit **permanently dies**.
- A dead Veilkeeper's knowledge domain is **locked forever** for the remainder of the playthrough.
- Use consultations strategically -- the information gained must be weighed against the cost.

---

## Save System

| Type | Slots | Trigger |
|------|:-----:|---------|
| Manual save | 3 | Player-initiated |
| Auto-save | 1 | Every 60 seconds |

### Data Saved

Position, attributes, inventory, active quests, faction reputation, companion bonds, moral choices, DSP level, current Sap Cycle day, discovered locations, skill tree progress, skill ranks.

---

## Controls

| Key | Action |
|-----|--------|
| **WASD** / **Arrow Keys** | Move |
| **SPACE** | Dash |
| **E** | Interact / Talk |
| **1-5** | Cast equipped spells |
| **K** | Skill tree |
| **I** | Inventory |
| **P** | Companions |
| **TAB** | Game info (quests, factions, character overview) |
| **C** | Character sheet |
| **W** | Wiki / Codex |
| **ESC** | Pause menu |
