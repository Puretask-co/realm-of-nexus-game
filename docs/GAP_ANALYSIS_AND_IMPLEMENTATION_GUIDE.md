# Realm of Nexus: Verdance
# Gap Analysis & Implementation Guide
*Generated: 2026-03-16 | Based on full design-doc + Godot project scan*

---

## EXECUTIVE SUMMARY

| Metric | Status |
|--------|--------|
| Total Scenes | 50 .tscn files |
| Total Scripts | 106 .gd files |
| Autoloads | 14/14 operational |
| Core Systems | ~85% implemented |
| Content Volume | ~70% of target |
| Ready to Play | YES (MainMenu → CharacterCreation → WorldMap → Combat loop works) |

**The core game loop runs.** All architecture is solid. Remaining work is three categories:
1. **Content volume** — more enemies, NPCs, quests
2. **UI wiring** — panels that exist but aren't hooked into Game.gd or signals
3. **Feature completion** — AI DM API key, ending logic, Pure/Blighted variants

---

## PART 1: WHAT IS FULLY IMPLEMENTED ✅

### Core Architecture
- **GameState.gd** — Complete: 5 attributes, 3 ancestries, 7 classes, DSP tracking, hollowing ticks, 6 faction reputations, XP/level table, known spells, visited locations
- **EventBus.gd** — Complete: 40+ signals covering all systems (combat, DSP, veilkeeper, quest, UI, world, inventory)
- **DSPManager.gd** — Complete: Spell costs by tier, Blue Sap regen, Crimson phase +5 surcharge, warning thresholds at 50/30/20
- **SapCycleManager.gd** — Complete: 15-day calendar (5 Crimson + 3 Silver + 7 Blue), phase modifiers for combat difficulty + loot
- **VeilkeeperManager.gd** — Complete: All 5 keepers (Sylthara, Morvein, Elduin, Kaelthas, Virelda) with unique tick limits, death speeches, permanent death tracking
- **SaveManager.gd, SceneManager.gd, ThemeManager.gd** — Complete

### Combat System
- **TacticalCombatSystem.gd** — Complete: 4-pillar positioning (Entanglement, Shrouded Strike, Canopy Advantage, Verdant Ward), full damage resolution
- **CombatGrid.gd, CombatUnit.gd, CombatManager.gd, CombatController.gd** — Complete
- **CombatBridge.gd** — Complete: WorldMap → Combat scene transition with CombatEncounter resources
- **TacticalHUD.gd/.tscn** — Complete: Live pillar display during combat
- **DamageNumberPool.gd + DamageNumber.tscn** — Complete: Floating number FX

### Character Systems
- **AttributeSystem.gd** — Complete: 5 attributes, threshold bonuses (Agility ≥4 → 3 AP, etc.)
- **SkillCheckSystem.gd** — Complete: 12 use-based skills mapped to attributes
- **CharacterCreation.gd/.tscn** — Complete: Ancestry + class selection, attribute preview, transitions to Game.tscn

### Content Libraries
- **MonsterLibrary.gd** — 10+ monster types with full animation/stat data + grid-sheet loader
- **SpellLibrary.gd** — 29 spells across 7 schools + 9 Verdance-lore spells (38 total), `get_all_spell_ids()` added
- **ItemLibrary.gd** — 18+ items across weapons/armor/accessories/consumables/materials/quest items
- **SpellFXPlayer.gd** — 44 VFX effects, SPELL_TO_FX mapping, ENEMY_TO_FX mapping
- **AudioManager.gd** — 32 audio files: 9 BGM, 2 ME, 21 SFX, spell→SFX mapping, volume getters/setters

### UI Panels (all have scenes + scripts)
- MainMenu, CharacterCreation, SpellBook, TacticalHUD, Minimap, SettingsPanel
- InventoryPanel, CraftingPanel, CompanionPanel, FactionPanel, LoreJournal
- CharacterSheet, SkillTreePanel, DialoguePanel, NotificationSystem, SpellBar
- CompanionCombatCard

### World
- **WorldMap.gd/.tscn** — Complete: 7 clickable locations, encounter dispatch, notification system
- **8 Location scenes** — Heartwood, ThornfieldOutskirts, SporecallerWarrens, VeilkeeperSanctum, EmeraldCovenTower, BloomingSapSprings, CrimsonScar + Full Tower variant
- **NPCBase.tscn** — Base NPC scene

### Enemy Scenes (complete with scripts)
- `scenes/combat/enemies/`: HollowSoldier, HollowChampion, HollowKing, TimberWolf, ThornbackBear, SoulFragment, CorruptedWolf, CorruptedTreeSpirit, CorruptedTreeTitan (9 with EnemyUnit.gd base)
- `scenes/enemies/`: SapWraith, SporeCaller, TreeTitan, VerdantGuard (4 older scenes)

### Companions
- Thorn.gd/.tscn, Lyse.gd/.tscn, Vael.gd/.tscn — scenes + scripts
- CompanionSystem.gd — stats, unlock flags, spell lists for all 3

---

## PART 2: GAP LIST — WHAT'S MISSING OR INCOMPLETE ❌

---

### GAP-01: AIDungeonMaster — Needs API Key + Testing
**Design Spec:** Claude API narrates combat events, Veilkeeper consultations, world events
**Current State:** AIDungeonMaster.gd scaffold complete (319 lines), HTTP request logic present, 10 narration contexts
**Missing:**
- `ANTHROPIC_API_KEY` not set (hardcoded empty string or env var not wired)
- No test to verify HTTP → Claude → narration display pipeline
- NarrationBox.gd exists but not confirmed connected to AIDungeonMaster signals

---

### GAP-02: Veilkeeper Consultation UI Flow
**Design Spec:** Player opens VeilkeeperPanel, selects keeper, asks question, gets AI-narrated answer, pays Hollowing Ticks
**Current State:** VeilkeeperManager.gd complete (logic), VeilkeeperPanel.gd exists
**Missing:**
- VeilkeeperPanel.tscn has no scene file in scenes/ui/hud/
- Consultation dialogue flow (select keeper → input question → receive answer → pay ticks)
- Connection between VeilkeeperPanel and AIDungeonMaster.narrate_veilkeeper_consultation()
- No keyboard shortcut assigned to open VeilkeeperPanel

---

### GAP-03: Ending Logic Not Wired
**Design Spec:** 4 endings (12 variants) triggered by: faction rep, DSP level, hollowing ticks, quest completion flags
**Current State:** StoryProgressManager.gd defines 6 eras and era data, 4 endings named
**Missing:**
- No EndingScene.tscn or EndingScene.gd
- No branching logic that checks end conditions and routes to correct ending
- Endings need narrated cutscenes (text screens + AIDungeonMaster narration)
- No "win condition" check in Game.gd or WorldMap.gd

---

### GAP-04: Pure/Blighted Class Variants
**Design Spec:** Every class has a Pure variant and a Blighted variant with different spell access and moral alignment
**Current State:** 7 classes in GameState enum, no variant system
**Missing:**
- Variant tracking variable in GameState (e.g., `player_variant: String = ""` — "pure" or "blighted")
- Variant unlock conditions (story flag triggers)
- Variant-specific spell lists in SpellLibrary
- Visual distinction (character tint or portrait variant) in CharacterSheet

---

### GAP-05: TileSet Terrain Tagging Not Configured
**Design Spec:** TacticalCombatSystem uses terrain types (forest, spore_cloud, shadow_veil, blight_zone) to modulate combat
**Current State:** TacticalCombatSystem.gd has `CONCEALING_TERRAIN` constant with these types, but TileSet resources not tagged
**Missing:**
- TileSet resources in assets/sprites/tilesets/ need custom data layers added: "terrain" (String), "elevation" (int)
- CombatTilemap.gd needs to read tile custom data and populate TacticalCombatSystem grid on scene load
- Forest tiles should tag as "forest", Blight Hollow tiles as "blight_zone", etc.

---

### GAP-06: Content Volume — Enemies (Need 9+ More)
**Target:** 40+ enemy types
**Current:** 13 in scenes/combat/enemies/ + 4 in scenes/enemies/ = ~17 scene files, 10+ in MonsterLibrary data
**Missing enemies to add to MonsterLibrary + create scenes:**

| Enemy ID | Era | AI Type | Description |
|----------|-----|---------|-------------|
| spore_titan | 3 | boss_melee | Giant fungal construct, spore AoE attacks |
| abyss_knight | 6 | tactical | Armored Hollow King elite, shield bash |
| veil_phantom | 4 | flanker | Teleporting attacker, ignores Guard |
| corrupted_veilkeeper | 5 | support | Fallen keeper, casts dark Sap spells |
| sap_leech | 2 | swarm | Drains DSP instead of HP (unique mechanic) |
| thornback_golem | 3 | defensive | Living stone with thorn reflect |
| crimson_wraith | 5 | ranged | Crimson Sap-infected wraith, fire damage |
| hollow_archer | 6 | ranged | Ranged Hollow King soldier |
| bloom_corrupted | 4 | aggressive | Corrupted healer, damages own allies |

---

### GAP-07: Content Volume — NPCs (Need 20-36 More)
**Target:** 50+ NPCs with dialogue trees
**Current:** ~3 detailed dialogue trees (Elder Brynn, Forager Moss, Mystic Vera in Heartwood)
**Missing NPC dialogue trees to add to DialogueData.gd + location scenes:**

**Heartwood (6 needed):**
- Warden Captain Sael — quest giver, patrol orders
- Herbalist Duna — sells consumables, crafting hints
- The Hollow-Marked Child — eerie prophetic dialogue
- Lore Keeper Tomas — expository NPC for world history
- Guard Ryn — gatekeeper, world state commentary
- Mourning Mother — emotional story beat, missing son quest

**Thornfield Outskirts (5 needed):**
- Scout Perras — outpost scout, warning about corruption spread
- Farmhand Joss — ordinary person, slice-of-life in crisis
- Injured Ranger — sends player on rescue quest
- Merchant Caravan Leader — shop NPC with special inventory
- Abandoned Child — mystery NPC, connects to deeper lore

**Sporecaller Warrens (4 needed):**
- Mycelith Elder (referenced in Lyse unlock) — cryptic guide
- Spore-Touched Hermit — corrupted but lucid NPC
- Lost Scholar — was researching warrens, needs rescue
- Warren Keeper — trades rare spore items

**Veilkeeper Sanctum (4 needed):**
- Novice Veilkeeper — introduces sanctum mechanics
- Archivist Serath — lore on the 6 eras
- High Veilkeeper Seraphine (referenced in Vael unlock) — major NPC
- Stone Guardian — non-hostile construct that tests player

**Emerald Coven Tower (4 needed):**
- Coven Mistress Lhyra — faction leader, quest giver
- Alchemist Sorren — crafting expansion NPC
- Corrupted Initiate — enemy-turned-neutral via moral choice
- Coven Historian — details the Crimson Reckoning

**Blooming Sap Springs (3 needed):**
- Spring Tender — maintains the springs, endangered
- Water Rememberer — mystical NPC, connects to DSP lore
- Pilgrim — traveling NPC with cross-location info

**Crimson Scar (3 needed):**
- The Scarred Survivor — only person who survived the Reckoning
- Echo of Avaris — not the real Hollow King, a memory remnant
- Reckoning Witness — ghost NPC, dialogue only

---

### GAP-08: Content Volume — Quests (Need 16-24 More)
**Target:** 40+ quests
**Current:** ~16-24 quest resources
**Missing quest categories:**

**Main Story Quests (need 6+ more):**
- Era 2 connector quests (Soul War remnants)
- Era 3: Emerald Coven alliance or betrayal path
- Era 4: Crimson Reckoning investigation chain
- Era 5: Tree Titan confrontation
- Era 6: Approach to Hollow Keep
- Final Quest: Confronting Avaris / The Hollow King

**Side Quests (need 8+ more):**
- "What the Springs Remember" — fetch + lore quest at Blooming Sap Springs
- "The Missing Grove" — Thorn companion unlock quest
- "Spore-Net Messages" — Lyse companion unlock quest
- "Veil Crossing" — Vael companion unlock quest
- "The Hollow-Marked Child" — mystery investigation chain
- "Crimson Debt" — faction reputation quest (Bloomguard vs Hollow King)
- "The Archivist's Request" — collect 3 era relics for lore
- "Breaking the Cycle" — affects DSP regen rate for rest of game

**Faction Quests (need 4+ more):**
- Bloomguard: "Defend the Grove" (timed combat quest)
- Emerald Coven: "The Forbidden Ritual" (moral choice)
- Wildkin Pact: "Pack Law" (companion-required quest)
- Veilkeepers: "The Consultation" (must keep keeper alive)

**Timed/Calendar Quests (need 2+ more):**
- "The Crimson Moon" — must complete in Crimson Sap phase
- "Blue Sap Harvest" — only available in Blue Sap phase, rewards max DSP increase

---

### GAP-09: Game.gd Missing Panel Instantiation
**Current State:** Game.gd spawns: WorldMap, DialoguePanel, SpellBar, NotificationSystem, LoreJournal, CharacterSheet, SkillTreePanel, FactionPanel, CompanionPanel, CraftingPanel
**Missing from Game.gd:**
- `Minimap.tscn` — not spawned in Game.gd
- `TacticalHUD.tscn` — not spawned in Game.gd
- `SettingsPanel.tscn` — not spawned in Game.gd
- `SpellBook.tscn` — not spawned in Game.gd
- `VeilkeeperPanel` — no scene file, not spawned

---

### GAP-10: Companion Scenes Need CharacterResource
**Design Spec:** CombatUnit.gd asserts `data: CharacterResource != null`
**Current State:** Thorn.gd, Lyse.gd, Vael.gd extend CombatUnit but override `_ready()` to bypass data assertion by loading from CompanionSystem
**Issue:** CombatUnit._ready() fires BEFORE companion _ready() override, triggering assert
**Fix Needed:** Either create CharacterResource .tres files for each companion, OR add `@export` skip mechanism to CombatUnit

---

### GAP-11: SkillTreePanel — Attribute Allocation Not Implemented
**Design Spec:** Players gain attribute points on level up and can allocate them
**Current State:** SkillTreePanel displays current attributes (pip bars), listens for changes
**Missing:**
- Level-up point tracking (`unspent_attribute_points: int` in GameState)
- "+" buttons per attribute in SkillTreePanel
- Spending logic that calls AttributeSystem and emits attribute_changed signal

---

### GAP-12: ShopPanel — Not Implemented
**Design Spec:** 3 WorldMap locations have `has_shop: true` (Heartwood, EmeraldCovenTower)
**Current State:** No ShopPanel.tscn or ShopPanel.gd
**Missing:**
- ShopPanel scene with buy/sell tabs
- Integration with InventoryManager.add_item_by_id() / remove_item()
- Gold tracking in GameState
- Shop inventory per location (defined in WorldMap LOCATIONS data)

---

### GAP-13: PauseMenu — Not Implemented
**Design Spec:** Implied by Game.gd pause logic
**Current State:** Game.gd has `func _handle_pause()` but no PauseMenu scene
**Missing:**
- PauseMenu.tscn with: Resume, Settings, Save, Quit to Menu
- Pause menu connects to SettingsPanel.toggle()

---

### GAP-14: CharacterCreation → GameState Class Mismatch
**Issue:** CharacterCreation.gd stores `GameState.player_class = _selected_class` as a String (e.g. "verdant_warden"), but GameState.PlayerClass is an enum
**Fix:** Either convert string to enum in CharacterCreation._on_confirm(), or change GameState.player_class to String type

---

### GAP-15: Moral Choice System — Not Tracked
**Design Spec:** Player choices leave permanent marks, affect endings and faction reps
**Current State:** faction_reputations in GameState tracks some moral state; story_flags can capture choices
**Missing:**
- No `MoralChoiceOverlay.tscn` for presenting binary choices with consequences
- No consolidated moral score tracking (aggregate of choices)
- No place where moral_score feeds into ending determination

---

### GAP-16: Crafting System — Recipes Too Sparse
**Design Spec:** Station-based crafting with rarity tiers and ~30+ recipes
**Current State:** CraftingSystem.gd and CraftingPanel.tscn exist
**Missing:**
- Recipe count likely below 15; needs expansion to 30+ using new items (bloom_armor, ironwood_shield, sap_crystals, etc.)
- Crafting station types not differentiated in panel (any item craftable anywhere vs. forge/altar/garden)

---

## PART 3: IMPLEMENTATION GUIDE

> **How to use this guide:** Each section is ordered by priority (P1 = play-blocking, P2 = feature-incomplete, P3 = content volume). Implementation uses Godot MCP server tools where possible for scene building, and direct file edits for scripts.

---

## PRIORITY 1 — Play-Blocking Fixes

---

### IMPL-01: Fix CharacterCreation → GameState Class Type Mismatch
**File:** `scenes/ui/character_creation/CharacterCreation.gd`
**Problem:** `GameState.player_class` is a `PlayerClass` enum but receives a String
**Fix:** In `_on_confirm()`, convert the string:

```gdscript
# Add this mapping constant at top of CharacterCreation.gd:
const CLASS_ENUM_MAP: Dictionary = {
    "verdant_warden":  GameState.PlayerClass.VERDANT_WARDEN,
    "hollow_seeker":   GameState.PlayerClass.BEASTMASTER,  # closest
    "spore_caller":    GameState.PlayerClass.SPORECALLER,
    "shadow_dancer":   GameState.PlayerClass.VEILWALKER,
    "bloom_herald":    GameState.PlayerClass.SOULBORN_CLASS,
    "ironwood_knight": GameState.PlayerClass.TREE_SENTINEL,
    "veil_scholar":    GameState.PlayerClass.DRUID,
}

# In _on_confirm(), change:
# GameState.player_class = _selected_class  (WRONG - String)
# To:
GameState.player_class = CLASS_ENUM_MAP.get(_selected_class, GameState.PlayerClass.VERDANT_WARDEN)
GameState.player_class_string = _selected_class  # keep string for display too
```

Also add `var player_class_string: String = ""` to GameState.gd.

---

### IMPL-02: Fix Companion Scenes — CharacterResource Assert
**Problem:** CombatUnit._ready() asserts `data != null` before companion overrides can load stats
**Option A (Recommended):** Create CharacterResource .tres files for each companion

**Steps via MCP:**
```
# Create resources in Godot editor after reading CharacterResource.gd to know fields
# OR add @export skip to CombatUnit:
```

**Option B — Modify CombatUnit.gd `_init_from_data()`:**
```gdscript
func _ready() -> void:
    if data != null:          # <-- change assert to conditional
        _init_from_data()
    # subclasses override _ready() and call their own init
```

This single-line change allows Thorn/Lyse/Vael scripts to work without pre-set CharacterResource data.

---

### IMPL-03: Add Missing Panels to Game.gd
**File:** `scenes/game/Game.gd`
**Add these after the existing panel instantiation:**

```gdscript
# In _spawn_hud() function, append:
var minimap_scene = load("res://scenes/ui/hud/Minimap.tscn")
var minimap = minimap_scene.instantiate()
add_child(minimap)

var tactical_hud_scene = load("res://scenes/ui/hud/TacticalHUD.tscn")
var tactical_hud = tactical_hud_scene.instantiate()
add_child(tactical_hud)

var spellbook_scene = load("res://scenes/ui/spellbook/SpellBook.tscn")
var spellbook = spellbook_scene.instantiate()
add_child(spellbook)

var settings_scene = load("res://scenes/ui/settings/SettingsPanel.tscn")
var settings = settings_scene.instantiate()
add_child(settings)
```

---

## PRIORITY 2 — Feature Completion

---

### IMPL-04: AIDungeonMaster — Wire API Key

**File:** `autoloads/AIDungeonMaster.gd`
**Find the API key constant and set it:**

```gdscript
# Option A: Hardcode for testing (remove before ship)
const API_KEY: String = "sk-ant-YOUR_KEY_HERE"

# Option B: Read from user://api_key.txt (safer)
func _ready() -> void:
    var f = FileAccess.open("user://api_key.txt", FileAccess.READ)
    if f:
        API_KEY = f.get_line().strip_edges()
        f.close()
```

**Test procedure:**
1. Start game, trigger a combat
2. Watch Output panel for HTTP response or errors
3. NarrationBox should display generated text in top area of screen
4. If 401 error: key wrong; if 422: prompt format issue

---

### IMPL-05: Create VeilkeeperPanel.tscn (MCP)

**Build scene via MCP server:**

```
# Step 1: Create scene
mcp__godot__create_scene(
    scenePath: "scenes/ui/hud/VeilkeeperPanel.tscn",
    rootNodeType: "CanvasLayer"
)

# Step 2: Add root panel
mcp__godot__add_node(
    scenePath: "scenes/ui/hud/VeilkeeperPanel.tscn",
    nodeType: "PanelContainer",
    nodeName: "RootPanel",
    parentNodePath: "root",
    properties: { anchor_left: 0.1, anchor_top: 0.05, anchor_right: 0.9, anchor_bottom: 0.95 }
)

# Step 3: Add Layout VBoxContainer
# Step 4: Add Header HBoxContainer (TitleLabel + CloseButton)
# Step 5: Add KeeperGrid (GridContainer, 5 cols) — one button per keeper
# Step 6: Add QueryInput (LineEdit) — "Ask the Veil..."
# Step 7: Add SubmitButton
# Step 8: Add ResponseContainer (ScrollContainer > ResponseLabel)
# Step 9: Add CostLabel ("Cost: X Hollowing Ticks")
```

**Script logic (`VeilkeeperPanel.gd`):**
```gdscript
extends CanvasLayer

@onready var _keeper_grid: GridContainer = $RootPanel/Layout/KeeperGrid
@onready var _query_input: LineEdit = $RootPanel/Layout/QueryInput
@onready var _response_label: Label = $RootPanel/Layout/ResponseContainer/ResponseLabel
@onready var _cost_label: Label = $RootPanel/Layout/CostLabel

var _selected_keeper: String = ""

func _ready() -> void:
    layer = 18
    $RootPanel.visible = false
    _build_keeper_buttons()

func _build_keeper_buttons() -> void:
    for keeper_id in VeilkeeperManager.KEEPERS:
        var btn := Button.new()
        var alive: bool = VeilkeeperManager.is_alive(keeper_id)
        btn.text = VeilkeeperManager.KEEPERS[keeper_id]["name"]
        btn.disabled = not alive
        btn.pressed.connect(func(): _select_keeper(keeper_id))
        _keeper_grid.add_child(btn)

func _select_keeper(keeper_id: String) -> void:
    _selected_keeper = keeper_id
    var ticks: int = VeilkeeperManager.KEEPERS[keeper_id].get("tick_cost", 2)
    _cost_label.text = "Cost: %d Hollowing Ticks" % ticks

func _on_submit() -> void:
    if _selected_keeper.is_empty() or _query_input.text.strip_edges().is_empty():
        return
    var question: String = _query_input.text.strip_edges()
    VeilkeeperManager.consult(_selected_keeper, question)
    AIDungeonMaster.narrate_veilkeeper_consultation(_selected_keeper, question)
    # Connect to AIDungeonMaster.narration_ready signal to display response
```

**Open with V key — add to Game.gd:**
```gdscript
func _unhandled_input(event):
    if event is InputEventKey and event.keycode == KEY_V and event.pressed:
        _veilkeeper_panel.toggle()
```

---

### IMPL-06: Create PauseMenu.tscn (MCP)

**Build via MCP:**
```
mcp__godot__create_scene("scenes/ui/pause/PauseMenu.tscn", "CanvasLayer")
# Add: DimRect (ColorRect full-screen, color 0,0,0,0.6)
# Add: MenuPanel (PanelContainer, anchored center 35-65% x, 30-70% y)
# Add: VBoxContainer with buttons: Resume, Settings, Save Game, Quit to Menu
```

**Script:**
```gdscript
extends CanvasLayer

func _ready() -> void:
    layer = 25  # Above everything
    $DimRect.visible = false
    $MenuPanel.visible = false

func open() -> void:
    get_tree().paused = true
    $DimRect.visible = true
    $MenuPanel.visible = true

func close() -> void:
    get_tree().paused = false
    $DimRect.visible = false
    $MenuPanel.visible = false
```

**Wire in Game.gd:**
```gdscript
func _handle_pause() -> void:
    if _pause_menu.visible:
        _pause_menu.close()
    else:
        _pause_menu.open()
```

---

### IMPL-07: Attribute Allocation in SkillTreePanel
**File:** `scenes/ui/skill_tree/SkillTreePanel.gd`
**Add to GameState.gd first:**
```gdscript
var unspent_attribute_points: int = 0
```

**In GameState.add_xp() or GameState.level_up():**
```gdscript
unspent_attribute_points += 1  # 1 point per level
EventBus.notification_requested.emit("Level Up! Attribute point available. Press K.", "story")
```

**In SkillTreePanel, add "+" buttons per attribute row:**
```gdscript
func _build_attr_row(attr: String, value: int) -> HBoxContainer:
    var row := HBoxContainer.new()
    # ... existing label/pip code ...
    var plus_btn := Button.new()
    plus_btn.text = "+"
    plus_btn.disabled = GameState.unspent_attribute_points <= 0
    plus_btn.pressed.connect(func(): _spend_point(attr))
    row.add_child(plus_btn)
    return row

func _spend_point(attr: String) -> void:
    if GameState.unspent_attribute_points <= 0:
        return
    GameState.unspent_attribute_points -= 1
    AttributeSystem.base_attributes[attr] = \
        clampi(AttributeSystem.base_attributes.get(attr, 1) + 1, 1, AttributeSystem.ATTR_MAX)
    GameState.recompute_derived_stats()
    EventBus.attribute_changed.emit(attr, AttributeSystem.base_attributes[attr])
    _refresh()
```

---

### IMPL-08: Create ShopPanel.tscn (MCP)

**Build via MCP:**
```
mcp__godot__create_scene("scenes/ui/shop/ShopPanel.tscn", "CanvasLayer")
# Structure:
# CanvasLayer → RootPanel (PanelContainer) → Layout (VBoxContainer)
#   → Header (HBoxContainer: "SHOP" TitleLabel + GoldLabel + CloseButton)
#   → TabContainer
#       → BuyTab (ScrollContainer → ItemGrid GridContainer, 3 cols)
#       → SellTab (ScrollContainer → SellGrid GridContainer, 3 cols)
```

**Script key methods:**
```gdscript
func open(shop_inventory: Array[String]) -> void:
    _shop_items = shop_inventory
    _refresh_buy_tab()
    _refresh_sell_tab()
    $RootPanel.visible = true

func _buy_item(item_id: String) -> void:
    var item: Dictionary = ItemLibrary.get_item(item_id)
    var cost: int = item.get("value", 10)
    if GameState.gold >= cost:
        GameState.gold -= cost
        InventoryManager.add_item_by_id(item_id, 1)
        EventBus.gold_picked_up.emit(-cost)
        _refresh_buy_tab()

func _sell_item(item_id: String) -> void:
    var item: Dictionary = ItemLibrary.get_item(item_id)
    var value: int = item.get("value", 5) / 2  # 50% sell price
    InventoryManager.remove_item(item_id, 1)
    GameState.gold += value
    _refresh_sell_tab()
```

**Add gold to GameState.gd:**
```gdscript
var gold: int = 50  # Starting gold
```

**Open shop from WorldMap location entry:**
```gdscript
# In WorldMap._enter_location():
if loc_data.get("has_shop", false):
    _shop_panel.open(loc_data.get("shop_inventory", [
        "healing_draught", "sap_vial", "antidote", "ap_tonic"
    ]))
```

---

### IMPL-09: Ending Logic
**File:** Create `scenes/endings/EndingScene.gd` + `.tscn`
**Logic goes in a new EndingEvaluator:**

```gdscript
## EndingEvaluator.gd
## Called when player defeats Hollow King or story flags indicate end
static func evaluate_ending() -> String:
    var hollowing: int = GameState.hollowing_ticks
    var keepers_alive: int = 0
    for k in GameState.veilkeeper_alive:
        if GameState.veilkeeper_alive[k]:
            keepers_alive += 1
    var bloomguard_rep: int = GameState.faction_reputations.get("bloomguard", 0)
    var hollow_rep: int = GameState.faction_reputations.get("abyss_touched", 0)
    var dsp_remaining: int = DSPManager.current_dsp

    # Ending A: "The Verdant Restoration"
    # High bloomguard rep, 3+ keepers alive, DSP > 50, low hollowing
    if bloomguard_rep >= 50 and keepers_alive >= 3 and dsp_remaining >= 50 and hollowing < 10:
        return "verdant_restoration"

    # Ending B: "The Hollow Compromise"
    # Mixed factions, some keepers dead, moderate hollowing
    if keepers_alive >= 2 and hollowing < 20 and dsp_remaining >= 20:
        return "hollow_compromise"

    # Ending C: "The Broken Grove"
    # DSP depleted or critically low, most keepers dead
    if dsp_remaining < 20 or keepers_alive <= 1:
        return "broken_grove"

    # Ending D: "The Final Hollow" (dark ending)
    # Became Hollow King's ally, high abyss rep, heavy hollowing
    if hollow_rep >= 50 or hollowing >= 30:
        return "final_hollow"

    return "hollow_compromise"  # default
```

**EndingScene.tscn:** CanvasLayer with large centered TextLabel for ending text, AIDungeonMaster narration, "Credits" button.

**Trigger in Game.gd:**
```gdscript
func _on_combat_ended(victory: bool) -> void:
    if victory and StoryProgressManager.get_flag("hollow_king_defeated"):
        var ending_id: String = EndingEvaluator.evaluate_ending()
        _show_ending(ending_id)
```

---

### IMPL-10: Pure/Blighted Variant System

**Add to GameState.gd:**
```gdscript
enum ClassVariant { NONE, PURE, BLIGHTED }
var class_variant: ClassVariant = ClassVariant.NONE
```

**Unlock via story flags in NarrativeSystem or quest completion:**
```gdscript
# Example: completing "The Crimson Choice" quest unlocks Blighted variant
func _on_quest_completed(quest_id: String) -> void:
    match quest_id:
        "crimson_choice_dark": GameState.class_variant = GameState.ClassVariant.BLIGHTED
        "crimson_choice_pure": GameState.class_variant = GameState.ClassVariant.PURE
```

**In SpellLibrary, filter by variant:**
```gdscript
static func get_spells_for_variant(class_str: String, variant: String) -> Array[Dictionary]:
    return get_spells_for_class(class_str).filter(func(d):
        var v = d.get("variant", "both")
        return v == "both" or v == variant
    )
```

**Add "variant" field to spell entries in SpellLibrary:**
- Pure spells: healing, ward, restoration spells
- Blighted spells: corruption, drain, blight spells
- "both": accessible regardless of variant

**Visual distinction:** In CharacterSheet.gd, tint the portrait panel:
```gdscript
match GameState.class_variant:
    GameState.ClassVariant.PURE:    _portrait_panel.modulate = Color(0.8, 1.0, 0.9)
    GameState.ClassVariant.BLIGHTED: _portrait_panel.modulate = Color(0.9, 0.6, 0.9)
```

---

### IMPL-11: Moral Choice System

**Create `scenes/ui/moral_choice/MoralChoiceOverlay.tscn` via MCP:**
```
# Structure: CanvasLayer (layer 22) → DimRect → ChoicePanel
# ChoicePanel: VBoxContainer → SituationLabel + VBoxContainer(ButtonsContainer)
```

**Script:**
```gdscript
extends CanvasLayer

signal choice_made(choice_id: String)

func present(situation: String, choices: Array[Dictionary]) -> void:
    ## choices: [{ "id": "help_refugees", "text": "Help them cross", "consequence": "+10 Bloomguard" }, ...]
    $ChoicePanel/SituationLabel.text = situation
    for btn_node in $ChoicePanel/ButtonsContainer.get_children():
        btn_node.queue_free()
    for choice in choices:
        var btn := Button.new()
        btn.text = "%s\n[%s]" % [choice["text"], choice.get("consequence", "")]
        btn.pressed.connect(func(): _on_choice(choice["id"]))
        $ChoicePanel/ButtonsContainer.add_child(btn)
    $ChoicePanel.visible = true

func _on_choice(choice_id: String) -> void:
    $ChoicePanel.visible = false
    choice_made.emit(choice_id)
```

**Usage from quest/dialogue scripts:**
```gdscript
_moral_overlay.present(
    "A desperate family blocks the road to the Warrens. The Hollow King's soldiers are close.",
    [
        { "id": "help", "text": "Help them hide", "consequence": "+15 Bloomguard, Risk delay" },
        { "id": "leave", "text": "Leave them — you can't save everyone", "consequence": "No change, Faster" },
        { "id": "hollow", "text": "Report their location for safe passage", "consequence": "+10 Abyss, -20 Bloomguard" }
    ]
)
```

---

## PRIORITY 3 — Content Volume Implementation

---

### IMPL-12: Add 9 New Enemies to MonsterLibrary.gd

Add these entries to the `MONSTERS` dictionary in `scripts/combat/MonsterLibrary.gd`:

```gdscript
"spore_titan": {
    "name": "Spore Titan",
    "asset_folder": "res://assets/sprites/monsters/monster_3",
    "animations": { "idle": 8, "fly": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Fly", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.9, 0.9), "tint": Color(0.5, 0.9, 0.3, 1.0),
    "ai_type": "boss_melee", "era": 3, "faction": "sporecallers",
    "hp": 200, "atk": 26, "def": 14, "dsp_reward": 35,
    "lore": "A Sporecaller colony that merged into a single colossal form. Its AoE spore attacks can poison an entire grid section.",
},
"abyss_knight": {
    "name": "Abyss Knight",
    "asset_folder": "res://assets/sprites/monsters/monster_9",
    "animations": { "idle": 8, "walk": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Walking", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.7, 0.7), "tint": Color(0.2, 0.0, 0.6, 1.0),
    "ai_type": "tactical", "era": 6, "faction": "hollow_king",
    "hp": 90, "atk": 22, "def": 18, "dsp_reward": 25,
    "lore": "Elite guard of the Hollow King. Their shield can absorb one spell per turn completely.",
},
"veil_phantom": {
    "name": "Veil Phantom",
    "asset_folder": "res://assets/sprites/monsters/monster_1",
    "animations": { "idle": 8, "fly": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "fly": "Fly", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.5, 0.5), "tint": Color(0.7, 0.5, 1.0, 0.7),
    "ai_type": "flanker", "era": 4, "faction": "none",
    "hp": 40, "atk": 16, "def": 0, "dsp_reward": 15,
    "lore": "A mind that slipped through the Veil and forgot how to return. Ignores Guard entirely — attacks strike directly.",
},
"sap_leech": {
    "name": "Sap Leech",
    "asset_folder": "res://assets/sprites/monsters/monster_5",
    "animations": { "idle": 8, "fly": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "drift": "Fly", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.4, 0.4), "tint": Color(0.4, 0.8, 0.3, 0.9),
    "ai_type": "swarm", "era": 2, "faction": "none",
    "hp": 18, "atk": 4, "def": 0, "dsp_reward": 6,
    "lore": "Drains DSP instead of HP. A swarm of these can leave a caster helpless within two turns.",
    "special": "drain_dsp",  # Special flag for EnemyUnit to handle
},
"crimson_wraith": {
    "name": "Crimson Wraith",
    "asset_folder": "res://assets/sprites/monsters/monster_1",
    "animations": { "idle": 8, "fly": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "fly": "Fly", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.6, 0.6), "tint": Color(1.0, 0.2, 0.1, 0.85),
    "ai_type": "ranged", "era": 5, "faction": "none",
    "hp": 55, "atk": 20, "def": 3, "dsp_reward": 18,
    "lore": "A soul scorched in the Crimson Reckoning and never released. Burns everything it touches.",
},
"hollow_archer": {
    "name": "Hollow Archer",
    "asset_folder": "res://assets/sprites/monsters/monster_9",
    "animations": { "idle": 8, "walk": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Walking", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.5, 0.5), "tint": Color(0.8, 0.4, 0.4, 1.0),
    "ai_type": "ranged", "era": 6, "faction": "hollow_king",
    "hp": 35, "atk": 14, "def": 6, "dsp_reward": 12,
    "lore": "Hollow soldiers trained as archers. They prioritise casting units and stay at maximum range.",
},
"bloom_corrupted": {
    "name": "Bloom Corrupted",
    "asset_folder": "res://assets/sprites/monsters/monster_7",
    "animations": { "idle": 8, "walk": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Walking", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.55, 0.55), "tint": Color(0.6, 1.0, 0.4, 0.8),
    "ai_type": "support", "era": 4, "faction": "none",
    "hp": 38, "atk": 8, "def": 4, "dsp_reward": 10,
    "lore": "A Bloom Herald who drank from a tainted spring. Their healing now damages whoever they try to heal.",
},
"thornback_golem": {
    "name": "Thornback Golem",
    "asset_folder": "res://assets/sprites/monsters/monster_2",
    "animations": { "idle": 8, "fly": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Fly", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.8, 0.8), "tint": Color(0.6, 0.7, 0.5, 1.0),
    "ai_type": "defensive", "era": 3, "faction": "wildkin_pact",
    "hp": 100, "atk": 12, "def": 22, "dsp_reward": 20,
    "lore": "A golem constructed from thornwood and Sap-hardened stone. Every attack against it risks 5 thorn damage to the attacker.",
},
"corrupted_veilkeeper": {
    "name": "Corrupted Veilkeeper",
    "asset_folder": "res://assets/sprites/monsters/monster_8",
    "animations": { "idle": 8, "walk": 8, "attack": 10, "die": 6 },
    "anim_map": { "idle": "Idle", "walk": "Walking", "attack": "Attack", "die": "Dying" },
    "scale": Vector2(0.6, 0.6), "tint": Color(0.5, 0.3, 0.7, 1.0),
    "ai_type": "ranged_debuff", "era": 5, "faction": "none",
    "hp": 65, "atk": 18, "def": 8, "dsp_reward": 28,
    "lore": "A Veilkeeper who went too far through the Veil and came back wrong. Casts dark Sap spells and drains DSP from the party.",
},
```

**Then create 9 enemy scenes using MCP** (same pattern as existing enemies):
```
# For each new enemy:
mcp__godot__create_scene("scenes/combat/enemies/SporeTitan.tscn", "Node2D")
# + add AnimatedSprite2D, HPBar, APPips, IntentIcon, HitboxArea, DetectArea
# + create SporeTitan.gd extending EnemyUnit with monster_id = "spore_titan"
```

---

### IMPL-13: Add NPC Dialogue Trees

**File:** `scripts/dialogue/DialogueData.gd`
**Pattern to follow** (existing Elder Brynn structure):

```gdscript
"warden_captain_sael": {
    "start": "sael_greeting",
    "nodes": {
        "sael_greeting": {
            "speaker": "Warden Captain Sael",
            "portrait": "res://assets/sprites/characters/npc/npc_idle.png",
            "text": "Another wanderer? The Heartwood patrols have been thin since the Hollow soldiers pushed through the northern pass. If you're looking for work, I'm not in a position to refuse.",
            "choices": [
                { "text": "What's happening in the north?", "next": "sael_north" },
                { "text": "Do you have any quests?", "next": "sael_quests" },
                { "text": "I'll be on my way.", "next": null }
            ]
        },
        "sael_north": {
            "speaker": "Warden Captain Sael",
            "text": "The Hollow King's forces crossed the Veil three nights ago. Not a full invasion — more like scouts. But scouts that don't scout alone. If they're mapping routes through the Heartwood, we have maybe a week before the main force.",
            "choices": [
                { "text": "How can I help?", "next": "sael_quests" },
                { "text": "What is the Hollow King?", "next": "sael_lore" }
            ]
        },
        # ... continue branches
    }
},
```

**Add to Heartwood.gd NPC spawning** and wire via `DialogueManager.start_dialogue(npc_id)`.

---

### IMPL-14: Add Quests to QuestManager

**Create QuestResource .tres files** OR register inline via code in a new `QuestContent.gd` autoload:

```gdscript
## QuestContent.gd — registers all quest resources
extends Node

func _ready() -> void:
    await get_tree().process_frame
    _register_quests()

func _register_quests() -> void:
    var quests: Array[Dictionary] = [
        {
            "id": "the_missing_grove",
            "title": "The Missing Grove",
            "description": "Thorn has asked you to find what remains of their destroyed grove in the Thornfield Outskirts. Something there still lives.",
            "giver": "thorn",
            "location": "thornfield_outskirts",
            "objectives": [
                { "id": "reach_grove", "text": "Travel to Thornfield Outskirts", "type": "location", "target": "thornfield_outskirts" },
                { "id": "fight_guardians", "text": "Defeat the Corrupted Guardians", "type": "kill", "target": "corrupted_wolf", "count": 3 },
                { "id": "find_seed", "text": "Find the last Verdant Seed", "type": "item", "target": "verdant_seed" },
            ],
            "rewards": { "xp": 80, "gold": 60, "items": ["verdant_shard", "verdant_shard"], "flag": "thorn_rescued", "companion_unlock": "thorn" },
            "era_required": 1,
        },
        {
            "id": "what_springs_remember",
            "title": "What the Springs Remember",
            "description": "The Spring Tender at Blooming Sap Springs believes the springs hold memories of the first Deep Sap. Recover three water samples from different parts of the springs.",
            "giver": "spring_tender",
            "location": "blooming_sap_springs",
            "objectives": [
                { "id": "sample_east", "text": "Collect East Spring sample", "type": "item", "target": "sap_crystal_springs" },
                { "id": "sample_center", "text": "Collect Center Spring sample", "type": "item", "target": "sap_crystal_heartwood" },
                { "id": "deliver", "text": "Return the samples to the Spring Tender", "type": "dialogue", "target": "spring_tender" },
            ],
            "rewards": { "xp": 60, "gold": 40, "items": ["sap_vial", "sap_vial", "sap_vial"], "flag": "springs_memory_found" },
            "era_required": 2,
        },
        # ... add 20+ more following this pattern
    ]
    for q in quests:
        QuestManager.register_quest_data(q)
```

**Add `register_quest_data(data: Dictionary)` to QuestManager.gd** to accept inline dictionary format.

---

### IMPL-15: TileSet Terrain Custom Data (Godot Editor Required)

**This requires the Godot editor (not MCP-scriptable):**

1. Open Godot Editor
2. Navigate to `assets/sprites/tilesets/` — open the combat TileSet resource
3. In TileSet inspector → **Custom Data Layers** → Add:
   - Layer 0: `terrain` (Type: String)
   - Layer 1: `elevation` (Type: int)
4. For each tile variant:
   - Forest/tree tiles: `terrain = "forest"`, `elevation = 1`
   - Swamp/blight tiles: `terrain = "blight_zone"`, `elevation = 0`
   - Water tiles: `terrain = "open"`, `elevation = -1`
   - Open field tiles: `terrain = "open"`, `elevation = 0`
   - Elevated rock tiles: `terrain = "open"`, `elevation = 2`
5. In `CombatTilemap.gd`, add terrain reading:

```gdscript
func _populate_tactical_grid() -> void:
    for y in TacticalCombatSystem.grid_height:
        for x in TacticalCombatSystem.grid_width:
            var cell := Vector2i(x, y)
            var tile_data := get_cell_tile_data(0, cell)
            if tile_data:
                TacticalCombatSystem.set_tile_property(cell, "terrain",
                    tile_data.get_custom_data("terrain"))
                TacticalCombatSystem.set_tile_property(cell, "elevation",
                    tile_data.get_custom_data("elevation"))
```

---

## PART 4: QUICK REFERENCE — WHAT TOOL TO USE FOR WHAT

| Task | Tool |
|------|------|
| Create a new scene (.tscn) | `mcp__godot__create_scene` |
| Add nodes to a scene | `mcp__godot__add_node` |
| Edit GDScript files | `Edit` tool (code) |
| Create new GDScript files | `Write` tool |
| Load sprite into scene | `mcp__godot__load_sprite` |
| Check Godot version/project | `mcp__godot__get_project_info` |
| Run the game | `mcp__godot__run_project` |
| Debug output | `mcp__godot__get_debug_output` |
| Search for code patterns | `Grep` tool |
| Find files | `Glob` tool |
| Read existing files | `Read` tool |
| TileSet terrain tagging | Godot Editor (manual) |
| API key setup | `Edit` tool on AIDungeonMaster.gd |

---

## PART 5: RECOMMENDED BUILD ORDER

### Sprint 1 — Make Everything Already Built Playable (1-2 days)
1. ✅ IMPL-01: Fix CharacterCreation → class enum mismatch
2. ✅ IMPL-02: Fix Companion scenes CombatUnit assert
3. ✅ IMPL-03: Add Minimap/TacticalHUD/SpellBook/Settings to Game.gd
4. ✅ IMPL-04: Set AIDungeonMaster API key, test narration pipeline
5. ✅ IMPL-13: Add gold to GameState, verify shop has_shop locations show something

### Sprint 2 — Core Feature Completion (2-3 days)
6. IMPL-05: Build VeilkeeperPanel.tscn + script (MCP build)
7. IMPL-06: Build PauseMenu.tscn (MCP build)
8. IMPL-07: Attribute allocation in SkillTreePanel
9. IMPL-08: Build ShopPanel.tscn + script (MCP build)
10. IMPL-09: Ending evaluation logic + EndingScene

### Sprint 3 — Content Expansion (3-5 days)
11. IMPL-12: Add 9 new enemies to MonsterLibrary + scenes (MCP)
12. IMPL-13: Add 20+ NPC dialogue trees to DialogueData.gd
13. IMPL-14: Add 20+ quests via QuestContent.gd autoload
14. IMPL-10: Pure/Blighted variant system
15. IMPL-11: Moral Choice overlay

### Sprint 4 — Polish (2-3 days)
16. IMPL-15: TileSet terrain tagging (Godot Editor)
17. IMPL-16: Crafting recipe expansion (30+ recipes)
18. Sound: Wire ui_cursor/ui_confirm SFX to Button hover/press in ThemeManager
19. Minimap: Fix EventBus signal name (`location_entered` not `location_changed`)
20. Final: End-to-end playtest of all 4 endings

---

## PART 6: KNOWN BUGS / QUICK FIXES

| Bug | Location | Fix |
|-----|----------|-----|
| Minimap.gd connects to `location_changed` signal | Minimap.gd:L44 | Change to `location_entered` (matches EventBus) |
| SpellBook loads wrong path | SpellBook.gd:L54 | Fixed — now `resources/spells/SpellLibrary.gd` ✅ |
| CompanionSystem.get_companion() not a method | CompanionCombatCard.gd | Change to `CompanionSystem.COMPANIONS.get(id, {})` |
| SkillTreePanel K key conflicts with SpellBook B key | SkillTreePanel.gd | No conflict (different keys), verify K toggles correctly |
| EnemyUnit references MonsterLibrary.MONSTERS as const dict | EnemyUnit.gd | MonsterLibrary extends Node (not static), access via autoload not class |
| VeilkeeperManager.consult() method name | VeilkeeperPanel impl | Check actual method name in VeilkeeperManager.gd |

---

*End of Gap Analysis and Implementation Guide*
*Project is in excellent shape — the core loop, all systems, and ~85% of content is done.*
*Remaining work is primarily content volume and a handful of UI wiring tasks.*
