/**
 * WikiCodexScene.js
 * Full-screen in-game codex/wiki for Realm of Nexus: Verdance.
 *
 * Scene key: 'WikiCodexScene'
 * Open:  W key (wired in UIScene)
 * Close: ESC or W key — calls scene.stop()
 *
 * Layout
 *   Left sidebar  220 px  — category list + sub-item list
 *   Main content  780 px  — selected entry with rich text
 *
 * Progressive unlock
 *   All entries start LOCKED. They unlock by listening to EventBus events.
 *   Persisted to localStorage key 'verdance_codex_unlocked' (JSON array of IDs).
 *
 * Imports
 *   EventBus from '../core/EventBus.js'
 *   Phaser is global (no import needed)
 */

import EventBus from '../core/EventBus.js';

// ============================================================
// CODEX DATA
// Each entry:
//   id              string   — unique entry ID
//   title           string   — display title
//   unlockEvent     string|null — EventBus event that triggers unlock
//   unlockId        string   — optional: payload must contain this substring
//   defaultUnlocked bool     — if true, starts unlocked
//   content         array    — rich text blocks (type: heading/badge/subheading/body/tip)
// ============================================================

const CODEX_DATA = {
  // --------------------------------------------------
  SYSTEMS: [
    {
      id: 'sys_sap_cycle',
      title: 'The Sap Cycle',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'The Sap Cycle' },
        { type: 'body',       text: 'Verdance breathes. Three great phases rotate in a never-ending rhythm, each reshaping the rules of battle, commerce, and magic.' },
        { type: 'subheading', text: 'Blue Phase — The Calm' },
        { type: 'body',       text: 'Duration: ~4 minutes. The Sap flows steadily. Spell DSP costs are unmodified. Enemies spawn at normal rates. Nature-aligned spells receive a +10% potency bonus. Ideal for crafting and exploration.' },
        { type: 'subheading', text: 'Crimson Phase — The Surge' },
        { type: 'body',       text: 'Duration: ~3 minutes. The Sap burns hot. All spell DSP costs increase by +5. Crimson-aspected enemies spawn more frequently (×2 weight). Fire and blood magic are amplified by 20%. Healing is 15% less effective.' },
        { type: 'subheading', text: 'Silver Phase — The Veil' },
        { type: 'body',       text: 'Duration: ~3 minutes. The Sap turns cold and thin. DSP costs decrease by -5 (minimum 1). Shadow and spirit magic receive a +25% potency bonus. Veilkeeper events are more likely to trigger. Some locked doors only open during this phase.' },
        { type: 'tip',        text: 'Watch the phase timer in the top-left corner. Planning a boss fight? Wait for the Silver Phase to reduce your DSP burden.' },
      ],
    },
    {
      id: 'sys_dsp_pool',
      title: 'DSP Pool',
      unlockEvent: 'spell-cast',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'DSP Pool (Dimensional Sap Pressure)' },
        { type: 'body',       text: 'DSP is the hidden cost of all magic. It measures the pressure of raw Sap forced through your soul. The pool ranges from 0 to 100.' },
        { type: 'subheading', text: 'Thresholds' },
        { type: 'body',       text: '0–30   Safe. No penalties.\n31–60  Strained. Spell animations flicker; minor tremors visible.\n61–80  Critical. 10% chance each cast triggers a Wild Surge.\n81–99  Fracture Imminent. Every cast costs +5 extra HP.\n100    Fracture! Catastrophic Wild Surge fires; DSP resets to 50; stunned 1 round.' },
        { type: 'subheading', text: 'Recovery' },
        { type: 'body',       text: 'DSP decays at 2 points per second out of combat. Resting at the Home Base resets DSP to 0. The Silver Phase reduces all spell DSP costs by 5, slowing accumulation.' },
        { type: 'tip',        text: 'Never open a boss fight above 60 DSP. The Wild Surge table at high pressure includes "Summon Friendly Fire" which targets you.' },
      ],
    },
    {
      id: 'sys_combat',
      title: 'Combat',
      unlockEvent: 'enemy-defeated',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Tactical Combat' },
        { type: 'body',       text: 'Combat is turn-based with initiative order determined by each combatant\'s Speed stat. Each turn grants 2 Action Points (AP).' },
        { type: 'subheading', text: 'Action Point Costs' },
        { type: 'body',       text: 'Move (1 tile) — 0 AP\nMelee Attack — 1 AP\nRanged Attack — 1 AP\nTier-1 Spell — 1 AP\nTier-2 Spell — 2 AP\nTier-3 Spell — 3 AP\nGuard — 1 AP\nItem Use — 1 AP' },
        { type: 'subheading', text: 'Guard & Evasion' },
        { type: 'body',       text: 'Guard reduces incoming physical damage by Resilience × 2. Evasion gives a flat % chance to dodge an attack entirely (capped at 60%).' },
        { type: 'subheading', text: 'Range Rules' },
        { type: 'body',       text: 'Melee: 1 tile. Ranged: up to 8 tiles, -5% damage per tile beyond 4. Magic: per-spell range; ignores tile distance penalties but requires line of sight.' },
        { type: 'tip',        text: 'Guard on the first round if you move into a cluster of enemies. The defence bonus applies until your next turn.' },
      ],
    },
    {
      id: 'sys_crafting',
      title: 'Crafting',
      unlockEvent: 'crafting:complete',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Crafting System' },
        { type: 'body',       text: 'Combine harvested materials at a crafting station to create weapons, armour, consumables, and spell components.' },
        { type: 'subheading', text: 'Stations' },
        { type: 'body',       text: 'Forge — weapons and armour\nAlchemist Bench — potions and bombs\nSpell Loom — spell scrolls and focus items\nGrowth Bed — botanical reagents and food' },
        { type: 'subheading', text: 'Recipe Discovery' },
        { type: 'body',       text: 'Some recipes are known from the start. Others require: reading a recipe scroll, reaching a required Insight score, or consulting Archivist Yeva at the Emerald Sanctum.' },
        { type: 'subheading', text: 'Quality Tiers' },
        { type: 'body',       text: 'Crafted items are Common by default. Higher Insight and rare materials can produce Uncommon or Rare quality. Legendary crafts require Mythic reagents and a Veilkeeper recipe.' },
        { type: 'tip',        text: 'Blue Phase boosts crafting output quality by one tier. Schedule your major crafting sessions accordingly.' },
      ],
    },
    {
      id: 'sys_attributes',
      title: 'Attributes',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'The Five Attributes' },
        { type: 'body',       text: 'Every character in Verdance is defined by five core attributes that govern all actions.' },
        { type: 'subheading', text: 'Might' },
        { type: 'body',       text: 'Physical strength and striking power. Increases melee damage, carry weight, and intimidation checks.' },
        { type: 'subheading', text: 'Agility' },
        { type: 'body',       text: 'Speed and precision. Governs turn order, evasion chance, ranged accuracy, and stealth checks.' },
        { type: 'subheading', text: 'Resilience' },
        { type: 'body',       text: 'Physical and magical toughness. Increases Guard value, max HP per level, and resistance to status effects.' },
        { type: 'subheading', text: 'Insight' },
        { type: 'body',       text: 'Intelligence and Sap sensitivity. Increases spell potency, DSP pool size, recipe discovery, and lore checks.' },
        { type: 'subheading', text: 'Sap Affinity' },
        { type: 'body',       text: 'Connection to the living Sap. Reduces DSP cost of spells, increases Sap regeneration rate, and unlocks advanced Veilkeeper consultations.' },
        { type: 'tip',        text: 'Veilkeeper blessings are the only way to increase Sap Affinity beyond natural caps.' },
      ],
    },
    {
      id: 'sys_classes',
      title: 'Classes & Variants',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'Classes & Variants' },
        { type: 'body',       text: 'At character creation you choose one of five classes, then whether to walk the Pure or Blighted path.' },
        { type: 'subheading', text: 'The Five Classes' },
        { type: 'body',       text: 'Bloomguard — Frontline fighter, high Resilience and Might.\nThornbinder — Nature mage, binds and disrupts with Verdant magic.\nEmerald Mystic — Pure spellcaster, high Insight and Sap Affinity.\nWildkin Ranger — Agile archer, animal companions.\nSporecaller — Support and debuffer, poisons and disease.' },
        { type: 'subheading', text: 'Pure vs Blighted' },
        { type: 'body',       text: 'Pure: Full Veilkeeper access, bonus healing from Blue Phase, clean predictable spells.\n\nBlighted: +20% Tier-3 spell damage, access to Forbidden spell tier, unique Crimson Phase bonuses — but +10% DSP costs and faction penalties with Bloomguard and Veilkeepers.' },
        { type: 'tip',        text: 'You cannot change your variant after the Prologue. Choose deliberately.' },
      ],
    },
    {
      id: 'sys_factions',
      title: 'Factions',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'The Six Factions' },
        { type: 'body',       text: 'Verdance is divided among six factions, each with their own agenda, services, and relationship to the Sap.' },
        { type: 'subheading', text: 'Bloomguard' },
        { type: 'body',       text: 'Militant defenders of the Canopy. Military training, heavy armour, group combat bonuses. Distrust Blighted.' },
        { type: 'subheading', text: 'Thornbinder Conclave' },
        { type: 'body',       text: 'Nature mages who study the Sap Cycle. Spell scrolls, Sap Affinity training, cycle manipulation rituals.' },
        { type: 'subheading', text: 'Emerald Sanctum' },
        { type: 'body',       text: 'Scholars and archivists. Recipe discovery, lore checks, Insight attribute training.' },
        { type: 'subheading', text: 'Verdant Exchange' },
        { type: 'body',       text: 'Merchant consortium controlling trade. Rare item stock, discounts, economics quests.' },
        { type: 'subheading', text: 'Sporecaller Brotherhood' },
        { type: 'body',       text: 'Mycelium shamans from the undercity. Poison crafting, unique spells, fungal companion bonuses.' },
        { type: 'subheading', text: 'Veilkeepers (Independent)' },
        { type: 'body',       text: 'Ancient order outside faction politics. Neutral brokers of cosmic power. See the Veilkeepers entry.' },
        { type: 'tip',        text: 'Faction reputation is shared — helping one often hurts another. Read all quest descriptions before accepting.' },
      ],
    },
    {
      id: 'sys_veilkeepers',
      title: 'Veilkeepers',
      unlockEvent: 'veilkeeper:consulted',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'The Veilkeepers' },
        { type: 'body',       text: 'An ancient order of eight immortal watchers who exist between the phases of the Sap Cycle, outside time as mortals know it.' },
        { type: 'subheading', text: 'Consulting a Veilkeeper' },
        { type: 'body',       text: 'Travel to the Whispering Veil during the Silver Phase. Each Veilkeeper offers one class of consultation:\n— Attribute Elevation: raise one attribute beyond its natural cap\n— Phase Boon: permanent minor Sap Phase bonus\n— Forbidden Knowledge: unlock Forbidden-tier spells (Blighted only)\n— Reality Anchor: set DSP Fracture threshold to 110 instead of 100' },
        { type: 'subheading', text: 'Cost' },
        { type: 'body',       text: 'Each consultation costs a Nexus Shard plus a Memory Tithe — permanently lose one discovered codex entry of your choice.' },
        { type: 'tip',        text: 'Consult Archivist Yeva first to catalogue all your codex entries before paying a Memory Tithe.' },
      ],
    },
  ],

  // --------------------------------------------------
  ENEMIES: [
    {
      id: 'enemy_timber_wolf',
      title: 'Timber Wolf',
      unlockEvent: 'enemy-defeated',
      unlockId: 'timber_wolf',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Timber Wolf' },
        { type: 'badge',      text: 'Tier 1 — Beast' },
        { type: 'body',       text: 'A large predatory wolf whose fur has been hardened by decades of Blue Sap exposure. Hunts in packs and coordinates attacks.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Pack Howl — Calls 1-2 additional wolves if below 50% HP.\nLunge — Charges one tile, deals 120% melee damage.\nFeral Bite — Applies Bleeding (3 damage/turn, 3 turns).' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Fire (+25%), Poison (+15%)\nResistant: Nature (-15%)\nImmune: Bleed' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Wolf Pelt (common), Beast Fang (uncommon), Blue Sap Gland (rare 5%)' },
        { type: 'tip',        text: 'Kill the Alpha (largest wolf) first or Pack Howl can chain-summon indefinitely.' },
      ],
    },
    {
      id: 'enemy_shadow_stalker',
      title: 'Shadow Stalker',
      unlockEvent: 'enemy-defeated',
      unlockId: 'shadow_stalker',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Shadow Stalker' },
        { type: 'badge',      text: 'Tier 2 — Corrupted' },
        { type: 'body',       text: 'A humanoid wraith formed from shadow-saturated Sap. Highly agile, targets isolated players and strikes from darkness.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Shadow Strike — Teleports behind target, deals 150% damage.\nDark Veil — Becomes invisible for 1 turn.\nDrain Touch — Steals 10 DSP from target on hit.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Light (+30%), Silver Phase spells (+20%)\nResistant: Physical (-20%)\nImmune: Shadow' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Shadow Essence (common), Void Fragment (uncommon 20%), Dark Sap Crystal (rare 8%)' },
        { type: 'tip',        text: 'Cast Soul Shield before engaging. Shadow Stalkers prioritise targets without active Guard buffs.' },
      ],
    },
    {
      id: 'enemy_corrupted_treant',
      title: 'Corrupted Treant',
      unlockEvent: 'enemy-defeated',
      unlockId: 'corrupted_treant',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Corrupted Treant' },
        { type: 'badge',      text: 'Tier 3 — Elite Beast' },
        { type: 'body',       text: 'Once a benign forest spirit, now twisted by the Great Corruption. Its bark drips black ichor and its roots crush stone.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Root Slam — AoE ground stomp, 3-tile radius, Stun 1 turn.\nCorrupted Sap — Poison cone, 5 turns.\nTreant Regeneration — Recovers 20 HP/turn on earth.\nEnrage — Below 30% HP: +50% damage, immunity to Stun.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Fire (+40%), Void (+25%)\nResistant: Nature (-30%), Physical (-15%)\nImmune: Poison, Root' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Corrupted Bark (common), Ancient Heartwood (uncommon), Treant Core (rare 10%)' },
        { type: 'tip',        text: 'Fire damage cancels Treant Regeneration. Bring a Levitation effect to avoid Root Slam.' },
      ],
    },
    {
      id: 'enemy_hollow_knight',
      title: 'Hollow Knight',
      unlockEvent: 'enemy-defeated',
      unlockId: 'hollow_knight',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Hollow Knight' },
        { type: 'badge',      text: 'Tier 3 — Undead Elite' },
        { type: 'body',       text: 'A Bloomguard soldier slain by Void magic and reanimated as a shambling armour shell. No will remains — only the echo of martial training.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Void Blade — Melee, ignores 50% of Guard.\nShield Bash — Stuns target 1 turn, destroys 1 AP next round.\nUndying — Revives once at 1 HP per battle.\nHollow Aura — Reduces healing in 2-tile radius by 30%.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Holy / Light (+35%), Shatter (+20%)\nResistant: Physical (-25%), Dark (-20%)\nImmune: Bleed, Poison' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Hollow Steel (common), Void-Tainted Plate (uncommon), Knight\'s Crest (rare 12%)' },
        { type: 'tip',        text: 'Save a Light burst for after the Undying revival. You only get one chance at the second kill.' },
      ],
    },
    {
      id: 'enemy_vine_wraith',
      title: 'Vine Wraith',
      unlockEvent: 'enemy-defeated',
      unlockId: 'vine_wraith',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Vine Wraith' },
        { type: 'badge',      text: 'Tier 2 — Corrupted Plant' },
        { type: 'body',       text: 'A semi-incorporeal mass of animated vines and shadow, born in the deepest zones of Sap corruption.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Entangle — Roots target for 2 turns.\nLife Sap — Drains 15 HP from target, heals self.\nThorn Burst — AoE spike spray, 2-tile radius, 8 damage each.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Fire (+30%), Slash (+15%)\nResistant: Nature (-25%), Bludgeon (-10%)' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Thorn Cluster (common), Wraith Vine (uncommon), Living Shard (rare 7%)' },
        { type: 'tip',        text: 'Entangle prevents escape — keep a teleport or dash skill ready. Fire clears the vines in one hit.' },
      ],
    },
    {
      id: 'enemy_crystal_sentinel',
      title: 'Crystal Sentinel',
      unlockEvent: 'enemy-defeated',
      unlockId: 'crystal_sentinel',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Crystal Sentinel' },
        { type: 'badge',      text: 'Tier 3 — Construct' },
        { type: 'body',       text: 'An ancient defensive construct formed from crystallised Sap. Guards pre-corruption ruins and Veilkeeper shrines.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Crystal Beam — 6-tile laser, 25 piercing damage.\nShard Burst — AoE explosion on death, 4-tile radius, 20 damage.\nHarden — 50% damage reduction for 1 turn (cooldown 3).\nResonance — Bonus damage if the same element hits twice in a row.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Sonic (+40%), Bludgeon (+20%)\nResistant: Fire (-30%), Cold (-30%)\nImmune: Poison, Bleed' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Sap Crystal (common), Blue Sap Crystal (uncommon), Resonance Core (rare 15%)' },
        { type: 'tip',        text: 'Stay away from the corpse — Shard Burst on death is lethal. Alternate two sonic spells to trigger Resonance every other hit.' },
      ],
    },
    {
      id: 'enemy_shadow_weaver',
      title: 'Shadow Weaver',
      unlockEvent: 'enemy-defeated',
      unlockId: 'shadow_weaver',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Shadow Weaver' },
        { type: 'badge',      text: 'Tier 3 — Caster' },
        { type: 'body',       text: 'A former Emerald Mystic scholar who descended into Void study and lost their physical form. Now a sentient storm of corrupted shadow-spells.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Void Bolt — 40 Void damage, ignores 20% magic resistance.\nShadow Web — Silence for 2 turns.\nDark Mimic — Copies your last-used spell and fires it back.\nVoid Gate — Teleports self to a random tile, resets threat.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Light (+35%), Silver Phase damage (+20%)\nResistant: Void (-40%), Shadow (-30%)\nImmune: Silence, Fear' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Void Essence (common), Shadow Weave Thread (uncommon), Codex Fragment (rare 10%)' },
        { type: 'tip',        text: 'Open with a weak spell to waste the Dark Mimic window, then unleash your strongest ability.' },
      ],
    },
    {
      id: 'enemy_spore_crawler',
      title: 'Spore Crawler',
      unlockEvent: 'enemy-defeated',
      unlockId: 'spore_crawler',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Spore Crawler' },
        { type: 'badge',      text: 'Tier 1 — Fungal Beast' },
        { type: 'body',       text: 'A multi-legged arthropod encrusted with bioluminescent fungal growth. Releases toxic spores as a defence mechanism.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Spore Cloud — AoE Poison, 2-tile radius, 3 turns.\nScuttle Charge — Quick dash dealing 15 damage.\nFungal Burst — Explodes on death, Poison all adjacent tiles.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Fire (+30%), Frost (+15%)\nResistant: Nature (-20%)\nImmune: Poison' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Spore Sack (common), Mycelium Thread (uncommon), Rare Spore (rare 8%)' },
        { type: 'tip',        text: 'Maintain 3+ tiles of distance. Fungal Burst on death is as deadly as the fight itself.' },
      ],
    },
    {
      id: 'enemy_crimson_wurm',
      title: 'Crimson Wurm',
      unlockEvent: 'enemy-defeated',
      unlockId: 'crimson_wurm',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Crimson Wurm' },
        { type: 'badge',      text: 'Tier 4 — Event Boss — Corrupted Creature' },
        { type: 'body',       text: 'A colossal burrowing worm saturated with Crimson Sap. A rare event boss that only surfaces during the Crimson Phase. Guards the deep levels of the Hollowroot Catacombs.' },
        { type: 'subheading', text: 'Abilities' },
        { type: 'body',       text: 'Crimson Roar — AoE fear, 5-tile radius, Flee 1 turn.\nBurrow — Immune to damage for 1 turn, resurfaces anywhere.\nMaw Crush — Grabs one target, 60 damage over 2 turns.\nSap Infusion — Heals 30 HP/turn during Crimson Phase.\nTail Sweep — 180° arc, 3-tile reach, knockback 2 tiles.' },
        { type: 'subheading', text: 'Weaknesses / Resistances' },
        { type: 'body',       text: 'Weak: Frost (+35%), Silver Phase spells (×2)\nResistant: Physical (-20%)\nImmune: Bleed, Poison, Fire during Crimson Phase' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Crimson Scale ×5, Wurm Fang ×2, Wurm Heart (quest), Crimson Sap Core (guaranteed)' },
        { type: 'tip',        text: 'Fight only during Blue or Silver Phase. Sap Infusion during Crimson Phase makes it nearly unkillable.' },
      ],
    },
    {
      id: 'enemy_nexus_guardian',
      title: 'Nexus Guardian',
      unlockEvent: 'enemy-defeated',
      unlockId: 'nexus_guardian',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Nexus Guardian' },
        { type: 'badge',      text: 'Tier 5 — Final Boss — Ancient Entity' },
        { type: 'body',       text: 'The primordial intelligence dwelling within the Nexus Gate. Not malevolent — it tests all who seek to enter, and destroys those found unworthy. Three phases corresponding to the three Sap Cycle states.' },
        { type: 'subheading', text: 'Phase I — Blue Form (100–67% HP)' },
        { type: 'body',       text: 'Crystal Lattice — Summons 4 Crystal Sentinels.\nResonance Wave — Full-screen AoE, 30 Sap damage.\nNexus Beam — Linear laser, 50 damage, pierces all tiles.' },
        { type: 'subheading', text: 'Phase II — Crimson Form (66–34% HP)' },
        { type: 'body',       text: 'Sap Eruption — AoE ground-fire zones, linger 3 turns.\nCrimson Bind — All players lose 1 AP next turn.\nMolten Form — Takes 50% less damage from all sources.' },
        { type: 'subheading', text: 'Phase III — Silver Form (33–0% HP)' },
        { type: 'body',       text: 'Veil Rip — Drains 30 DSP from all players.\nShadow Army — Summons 6 Shadow Stalkers.\nReality Fracture — Instantly pushes all players to 75 DSP.' },
        { type: 'subheading', text: 'Phase Weaknesses' },
        { type: 'body',       text: 'Blue Form: Crimson / Fire\nCrimson Form: Silver / Frost\nSilver Form: Blue / Nature' },
        { type: 'subheading', text: 'Loot' },
        { type: 'body',       text: 'Nexus Core (unique), Phase Crystal Set (3 items), Veilkeeper\'s Final Blessing, Achievement: Nexus Cleared' },
        { type: 'tip',        text: 'Enter at max HP with DSP below 20. Match your spell elements to the current phase form.' },
      ],
    },
  ],

  // --------------------------------------------------
  ITEMS: [
    {
      id: 'item_iron_sword',
      title: 'Iron Sword',
      unlockEvent: 'inventory:addItem',
      unlockId: 'iron_sword',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Iron Sword' },
        { type: 'badge',      text: 'Common Weapon — One-Handed Sword' },
        { type: 'body',       text: 'A sturdy single-edged blade forged from Verdance iron ore. Standard issue among Bloomguard recruits. Reliable if unimpressive.' },
        { type: 'subheading', text: 'Stats' },
        { type: 'body',       text: 'Physical Attack: +8\nSlot: Weapon\nUpgradeable: +1 Physical Attack per upgrade level (max +3)' },
        { type: 'tip',        text: 'A solid baseline weapon. Its weight class lets you equip a shield in the offhand.' },
      ],
    },
    {
      id: 'item_everbloom_sword',
      title: 'Everbloom Sword',
      unlockEvent: 'inventory:addItem',
      unlockId: 'everbloom_sword',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Everbloom Sword' },
        { type: 'badge',      text: 'Rare Weapon — Sap-Infused Sword' },
        { type: 'body',       text: 'Forged at the Forge Master\'s request during a Blue Phase surge. The blade is threaded with living Sap that blooms into light on each strike.' },
        { type: 'subheading', text: 'Stats' },
        { type: 'body',       text: 'Physical Attack: +18\nSap Affinity: +2\nBonus: Each melee hit has a 15% chance to restore 5 Sap.\nBlue Phase: Bonus chance increases to 30%.' },
        { type: 'tip',        text: 'With high Sap Affinity, this sword can make melee a self-sustaining Sap loop.' },
      ],
    },
    {
      id: 'item_nexus_staff',
      title: 'Nexus Staff',
      unlockEvent: 'inventory:addItem',
      unlockId: 'nexus_staff',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Nexus Staff' },
        { type: 'badge',      text: 'Legendary Weapon — Staff' },
        { type: 'body',       text: 'A staff grown from a splinter of the Nexus Gate itself. Hums with the energy of all three Sap phases simultaneously.' },
        { type: 'subheading', text: 'Stats' },
        { type: 'body',       text: 'Magic Attack: +35\nInsight: +5\nSap Affinity: +4\nBonus: Reduces all spell DSP costs by 3.\nBonus: Spells deal +10% damage during any Sap Phase.' },
        { type: 'tip',        text: 'The DSP cost reduction stacks with the Silver Phase discount — effectively -8 DSP per spell during Silver.' },
      ],
    },
    {
      id: 'item_veilkeepers_vestments',
      title: "Veilkeeper's Vestments",
      unlockEvent: 'inventory:addItem',
      unlockId: 'veilkeepers_vestments',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: "Veilkeeper's Vestments" },
        { type: 'badge',      text: 'Epic Armour — Robe' },
        { type: 'body',       text: 'Robes woven from Silver Phase-solidified Sap threads. Worn only by Veilkeepers and gifted sparingly to those who earn the order\'s deepest trust.' },
        { type: 'subheading', text: 'Stats' },
        { type: 'body',       text: 'Defence: +12\nInsight: +4\nSap Affinity: +3\nBonus: Veilkeeper consultation costs 1 fewer Nexus Shard.' },
        { type: 'tip',        text: 'The Nexus Shard discount means a full Veilkeeper build can consult twice for the price of one.' },
      ],
    },
    {
      id: 'item_bloomguard_commanders_plate',
      title: "Bloomguard Commander's Plate",
      unlockEvent: 'inventory:addItem',
      unlockId: 'bloomguard_commanders_plate',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: "Bloomguard Commander's Plate" },
        { type: 'badge',      text: 'Rare Armour — Heavy Plate' },
        { type: 'body',       text: 'Full-body plate worn by veteran Bloomguard Commanders. Engraved with the Verdance sigil and the names of fallen comrades.' },
        { type: 'subheading', text: 'Stats' },
        { type: 'body',       text: 'Defence: +28\nResilience: +3\nMight: +2\nBonus: Guard value increased by an additional 4.\nPenalty: Speed -2, Agility -1.' },
        { type: 'tip',        text: 'The best pure-tank armour in the game. Pair with a Wildkin Ranger companion to cover your reduced mobility.' },
      ],
    },
    {
      id: 'item_health_potion',
      title: 'Health Potion',
      unlockEvent: 'inventory:addItem',
      unlockId: 'health_potion',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Health Potion' },
        { type: 'badge',      text: 'Common Consumable' },
        { type: 'body',       text: 'A flask of distilled Blue Sap extract and healing herbs. Standard field medicine across all factions.' },
        { type: 'subheading', text: 'Effect' },
        { type: 'body',       text: 'Restores 50 HP immediately.\nBlue Phase: Restores 65 HP.\nCrimson Phase: Restores 42 HP.\nCooldown: 1 turn between potions.' },
        { type: 'tip',        text: 'Always carry 3-5. They are cheap at the Herbalist but scarce in dungeons.' },
      ],
    },
    {
      id: 'item_spore_bomb',
      title: 'Spore Bomb',
      unlockEvent: 'inventory:addItem',
      unlockId: 'spore_bomb',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Spore Bomb' },
        { type: 'badge',      text: 'Uncommon Consumable — Thrown' },
        { type: 'body',       text: 'A sealed fungal casing packed with concentrated toxic spores. A favourite of Sporecaller agents and battlefield saboteurs.' },
        { type: 'subheading', text: 'Effect' },
        { type: 'body',       text: 'Thrown to target tile (range 5). AoE Poison cloud, 4-tile radius, 8 damage/turn, 4 turns.\nSporecaller class: +50% duration.\nFriendly fire: targets all entities in radius.' },
        { type: 'tip',        text: 'Lob into chokepoints before the enemy turn. Position your party outside the 4-tile radius first.' },
      ],
    },
    {
      id: 'item_blue_sap_crystal',
      title: 'Blue Sap Crystal',
      unlockEvent: 'inventory:addItem',
      unlockId: 'blue_sap_crystal',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Blue Sap Crystal' },
        { type: 'badge',      text: 'Uncommon Reagent / Consumable' },
        { type: 'body',       text: 'A crystallised node of concentrated Blue Sap energy. Formed naturally where Sap pools have been still for decades.' },
        { type: 'subheading', text: 'Uses' },
        { type: 'body',       text: 'Consumed: Restores 30 Sap instantly.\nCrafting: Required for Tier-2 Blue-aligned spell scrolls.\nAltarPlaced: Extends current Blue Phase by 30 seconds.' },
        { type: 'tip',        text: 'Hoarding these for phase extension is worth it before a difficult exploration run.' },
      ],
    },
    {
      id: 'item_void_fragment',
      title: 'Void Fragment',
      unlockEvent: 'inventory:addItem',
      unlockId: 'void_fragment',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Void Fragment' },
        { type: 'badge',      text: 'Rare Material' },
        { type: 'body',       text: 'A shard of solidified nothingness from the edge of the Veil. It absorbs light and feels wrong to hold.' },
        { type: 'subheading', text: 'Uses' },
        { type: 'body',       text: 'Crafting: Required for Void-aspected weapons and Forbidden spell scrolls.\nVeilkeeper trade: Exchanged for Reality Anchor consultations.\nWarning: Prolonged carry adds +5 DSP per dungeon floor.' },
        { type: 'tip',        text: 'Store Void Fragments in your Home Base stash when not crafting. Do not walk dungeons with more than 2.' },
      ],
    },
    {
      id: 'item_nexus_shard',
      title: 'Nexus Shard',
      unlockEvent: 'inventory:addItem',
      unlockId: 'nexus_shard',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Nexus Shard' },
        { type: 'badge',      text: 'Rare Quest Material' },
        { type: 'body',       text: 'A fragment of pure crystallised Nexus energy. Radiates all three Sap phase colours simultaneously. The Veilkeepers use these as currency for their most significant consultations.' },
        { type: 'subheading', text: 'Uses' },
        { type: 'body',       text: 'Veilkeeper consultation cost (primary).\nCrafting: 1 shard + 5 materials = Mythic-quality item.\nNexus Gate: Place at the gate to reveal a hidden quest.' },
        { type: 'tip',        text: 'Nexus Shards cannot be purchased. They drop from Tier-4+ enemies and major quest completions only.' },
      ],
    },
    {
      id: 'item_sacred_nectar',
      title: 'Sacred Nectar',
      unlockEvent: 'inventory:addItem',
      unlockId: 'sacred_nectar',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Sacred Nectar' },
        { type: 'badge',      text: 'Epic Consumable' },
        { type: 'body',       text: 'The distilled essence of the Verdance world-tree, gathered only during Blue Phase from the deepest Sap pools.' },
        { type: 'subheading', text: 'Effect' },
        { type: 'body',       text: 'Full HP + Sap restore. DSP reduced by 40. Grants "Sap Blessed" (+10% Sap damage, 5 minutes).\nCooldown: 10 minutes (real-time).' },
        { type: 'tip',        text: 'Save for boss fights only. Its 10-minute cooldown makes it a once-per-dungeon resource.' },
      ],
    },
    {
      id: 'item_void_crystal',
      title: 'Void Crystal',
      unlockEvent: 'inventory:addItem',
      unlockId: 'void_crystal',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Void Crystal' },
        { type: 'badge',      text: 'Legendary Material' },
        { type: 'body',       text: 'A perfect crystallisation of Void energy. More stable than a Void Fragment, extraordinarily rare. Rumoured to be tears of the Nexus Guardian.' },
        { type: 'subheading', text: 'Uses' },
        { type: 'body',       text: 'Crafting: Required for all Void-Legendary weapons.\nForbidden Spell Scrolls: 1 crystal per scroll.\nVeilkeeper: Highest-tier consultation requires 1 Void Crystal + 1 Nexus Shard.\nWarning: Each crystal in inventory reduces your DSP cap by 8.' },
        { type: 'tip',        text: 'Use and store immediately. The passive DSP cap reduction can be lethal in a long dungeon run.' },
      ],
    },
  ],

  // --------------------------------------------------
  SPELLS: [
    {
      id: 'spell_soul_shield',
      title: 'Soul Shield',
      unlockEvent: 'spell-cast',
      unlockId: 'soul_shield',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Soul Shield' },
        { type: 'badge',      text: 'Tier 1 — Spirit — Self — All Classes' },
        { type: 'body',       text: 'Channel soul energy to reinforce your defences. One of the most universally useful spells in Verdance.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 1 | DSP Cost: 5\nEffect: +2 Guard, +2 Evasion for 2 turns.\nSilver Phase: Bonuses increase to +3 Guard, +3 Evasion.' },
        { type: 'tip',        text: 'Cast at round start against enemies with high burst damage. The Evasion bonus can outright dodge openers.' },
      ],
    },
    {
      id: 'spell_verdant_grasp',
      title: 'Verdant Grasp',
      unlockEvent: 'spell-cast',
      unlockId: 'verdant_grasp',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Verdant Grasp' },
        { type: 'badge',      text: 'Tier 1 — Nature — Single Target — Thornbinder' },
        { type: 'body',       text: 'Thorny vines erupt from the ground to ensnare a single enemy, rooting them in place.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 1 | DSP Cost: 5 | Range: 4 tiles\nEffect: Root target for 1 turn.\nBlue Phase: Duration 2 turns.\nCrimson Phase: No effect — vines wither in the heat.\nCombos with: Thorn Barrage (+50% damage on rooted target).' },
        { type: 'tip',        text: 'Use to lock down a fast enemy then cast Thorn Barrage into the combo window.' },
      ],
    },
    {
      id: 'spell_crimson_bolt',
      title: 'Crimson Bolt',
      unlockEvent: 'spell-cast',
      unlockId: 'crimson_bolt',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Crimson Bolt' },
        { type: 'badge',      text: 'Tier 2 — Fire — Single Target' },
        { type: 'body',       text: 'A concentrated lance of Crimson Sap energy. High damage with risk/reward mechanics tied to DSP.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 2 | DSP Cost: 12 | Range: 6 tiles\nDamage: 35 fire + 10% of current DSP as bonus.\nCrimson Phase: DSP cost 17, damage ×1.5.\nStatus: 20% chance to Burn (5 fire/turn, 3 turns).' },
        { type: 'tip',        text: 'The DSP bonus damage makes this devastating at 70-80 DSP — if you can survive the risk.' },
      ],
    },
    {
      id: 'spell_silver_veil',
      title: 'Silver Veil',
      unlockEvent: 'spell-cast',
      unlockId: 'silver_veil',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Silver Veil' },
        { type: 'badge',      text: 'Tier 2 — Spirit — Self — Emerald Mystic' },
        { type: 'body',       text: 'Wraps the caster in a shroud of Silver Sap, making them partially incorporeal.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 2 | DSP Cost: 10 | Duration: 2 turns\nEffect: 30% dodge chance, physical damage -20%.\nSilver Phase: Dodge increases to 50%.\nConcentration: Breaks if you cast another spell while active.' },
        { type: 'tip',        text: 'Maintain Silver Veil throughout a Silver Phase dungeon run — the dodge chance effectively doubles survivability.' },
      ],
    },
    {
      id: 'spell_spore_cloud',
      title: 'Spore Cloud',
      unlockEvent: 'spell-cast',
      unlockId: 'spore_cloud',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Spore Cloud' },
        { type: 'badge',      text: 'Tier 2 — Poison — AoE — Sporecaller' },
        { type: 'body',       text: 'Creates a persistent toxic cloud that damages and disorients all who pass through.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 2 | DSP Cost: 10 | Range: 5 tiles | AoE: 3-tile radius\nDuration: 3 turns\nDamage: 8 poison/turn to all inside.\n25% chance/turn: Confusion (random movement).\nBlue Phase: Duration 5 turns.' },
        { type: 'tip',        text: 'Place at corridor chokepoints and back away. Patrol AI enemies walk into it every round.' },
      ],
    },
    {
      id: 'spell_nexus_pulse',
      title: 'Nexus Pulse',
      unlockEvent: 'spell-cast',
      unlockId: 'nexus_pulse',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Nexus Pulse' },
        { type: 'badge',      text: 'Tier 3 — Nexus — AoE — Veilkeeper Only' },
        { type: 'body',       text: 'An omnidirectional burst of raw Nexus energy. Extremely powerful — only learnable from a Veilkeeper.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 3 | DSP Cost: 25 | AoE: 4-tile radius centred on caster\nDamage: 55 Nexus (bypasses all elemental resistances) + 15 bonus of current phase element.\nKnockback: 2 tiles.\nFriendly fire: applies.' },
        { type: 'tip',        text: 'Only safe solo or with teammates at max distance. 25 DSP pushes toward dangerous thresholds.' },
      ],
    },
    {
      id: 'spell_thornwall',
      title: 'Thornwall',
      unlockEvent: 'spell-cast',
      unlockId: 'thornwall',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Thornwall' },
        { type: 'badge',      text: 'Tier 2 — Nature — Utility — Thornbinder' },
        { type: 'body',       text: 'Raises a 4-tile wall of dense thornwood from the ground. Used to shape the battlefield and create safe zones.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 2 | DSP Cost: 8\nEffect: 4-tile impassable thornwood wall.\nDuration: 3 turns. Passers take 12 damage + Bleed (5/turn, 2 turns).\nBlue Phase: Duration 5 turns.\nCrimson Phase: Wall ignites — 15 fire damage to passers.' },
        { type: 'tip',        text: 'Combine with Verdant Grasp: root an enemy on one side of the wall. They cannot escape or pursue.' },
      ],
    },
    {
      id: 'spell_void_rift',
      title: 'Void Rift',
      unlockEvent: 'spell-cast',
      unlockId: 'void_rift',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Void Rift' },
        { type: 'badge',      text: 'Forbidden — Void — AoE — Blighted Only' },
        { type: 'body',       text: 'Tears a hole in the Veil of reality itself. Catastrophic damage. Using it in the Canopy of Life is a faction crime.' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'AP Cost: 3 | DSP Cost: 40 | Range: 8 tiles\nAoE: 5-tile expanding rift (grows 1 tile/turn for 2 turns, then collapses).\nDamage: 80 Void damage/turn to all inside. Duration: 3 turns.\nCritical Risk: 15% chance of instant DSP Fracture regardless of current DSP.' },
        { type: 'tip',        text: 'Reserve for outdoor boss fights only. The DSP Fracture risk in a dungeon can end a run.' },
      ],
    },
  ],

  // --------------------------------------------------
  NPCS: [
    {
      id: 'npc_elder_thornwick',
      title: 'Elder Thornwick',
      unlockEvent: 'dialogue:start',
      unlockId: 'elder_thornwick',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Elder Thornwick' },
        { type: 'badge',      text: 'Quest NPC — Thornbinder Conclave Elder' },
        { type: 'body',       text: 'The oldest living Thornbinder. His hands are permanently stained blue from decades of direct Sap contact. He speaks slowly and says nothing without intent.' },
        { type: 'subheading', text: 'Location' },
        { type: 'body',       text: 'Emerald Sanctum — upper library floor, every morning (in-game cycle).' },
        { type: 'subheading', text: 'Dialogue Topics' },
        { type: 'body',       text: '— The Great Corruption: Recounts the original event firsthand.\n— Sap Cycle origin: Shares history the Conclave keeps from outsiders.\n— The Nexus Gate: Warns against approaching before you are ready.\n— Your class: Offers tailored advice for each of the five classes.' },
        { type: 'subheading', text: 'Quest Involvement' },
        { type: 'body',       text: '"The Cycle Breaks" (main quest, Ch.2) — sends you to investigate anomalous Sap readings.\n"The Memory Keeper" (side) — his archive was stolen; recover it.' },
      ],
    },
    {
      id: 'npc_sylara',
      title: 'Sylara',
      unlockEvent: 'dialogue:start',
      unlockId: 'sylara',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Sylara' },
        { type: 'badge',      text: 'Companion NPC — Wildkin Ranger' },
        { type: 'body',       text: 'A young Wildkin Ranger who grew up outside city walls. Claims the Sap speaks to her through animals rather than directly.' },
        { type: 'subheading', text: 'Location' },
        { type: 'body',       text: 'Companion Board (initial); can be recruited to your party.' },
        { type: 'subheading', text: 'Dialogue Topics' },
        { type: 'body',       text: '— Animal companions: Teaches the beast-taming sub-system.\n— Wilderness routes: Reveals hidden zone connections on the world map.\n— Her past: A slowly revealed arc about her exiled Wildkin clan.\n— Enemies: Identifies weaknesses of any enemy encountered together.' },
        { type: 'subheading', text: 'Quest Involvement' },
        { type: 'body',       text: '"The Lost Pack" — rescue her clan from a Corrupted Treant infestation.\n"Skyward Path" — finds a secret route to the Canopy Overlook.' },
      ],
    },
    {
      id: 'npc_keeper_maren',
      title: 'Keeper Maren',
      unlockEvent: 'dialogue:start',
      unlockId: 'keeper_maren',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Keeper Maren' },
        { type: 'badge',      text: 'Service NPC — Innkeeper / Veilkeeper Liaison' },
        { type: 'body',       text: 'Runs the Roost inn. Also a retired Veilkeeper initiate who left the order under unclear circumstances. Provides rest, gossip, and coded referrals to the Veilkeepers.' },
        { type: 'subheading', text: 'Location' },
        { type: 'body',       text: 'The Roost inn, Canopy of Life.' },
        { type: 'subheading', text: 'Dialogue Topics' },
        { type: 'body',       text: '— Rest and board: Purchase a room to restore full HP/Sap and reset DSP to 0.\n— Rumours: Rotates daily with hints about upcoming events.\n— Veilkeeper referral: After sufficient trust, passes a referral letter needed to enter the Whispering Veil.' },
        { type: 'subheading', text: 'Quest Involvement' },
        { type: 'body',       text: '"The Innkeeper\'s Secret" — uncover why she left the Veilkeepers.\n"Rest and Restoration" — tutorial quest hook.' },
      ],
    },
    {
      id: 'npc_forge_master_bram',
      title: 'Forge Master Bram',
      unlockEvent: 'dialogue:start',
      unlockId: 'forge_master_bram',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Forge Master Bram' },
        { type: 'badge',      text: 'Service NPC — Blacksmith' },
        { type: 'body',       text: 'The most skilled smith in Verdance. His forge burns with a Blue Sap core that never goes out, giving his metal a faint luminescent quality.' },
        { type: 'subheading', text: 'Location' },
        { type: 'body',       text: "Craftsman's Lane, Canopy of Life. Open during Blue and Silver Phase only." },
        { type: 'subheading', text: 'Dialogue Topics' },
        { type: 'body',       text: '— Weapon upgrades: Upgrades equipment up to +3.\n— Recipe commission: Pay to unlock specific weapon recipes.\n— Materials: Explains rare material uses.\n— The Everbloom Sword: Shares its story if you own one.' },
        { type: 'subheading', text: 'Quest Involvement' },
        { type: 'body',       text: '"The Lost Alloy" — retrieve a stolen shipment of Nexus ore.\n"Master Craft" — provide Mythic materials for a unique legendary weapon.' },
      ],
    },
    {
      id: 'npc_archivist_yeva',
      title: 'Archivist Yeva',
      unlockEvent: 'dialogue:start',
      unlockId: 'archivist_yeva',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Archivist Yeva' },
        { type: 'badge',      text: 'Service NPC — Emerald Sanctum Scholar' },
        { type: 'body',       text: 'Has memorised every catalogued text in the Emerald Sanctum. Considers knowledge both sacred and dangerous.' },
        { type: 'subheading', text: 'Location' },
        { type: 'body',       text: 'Ground floor of the Emerald Sanctum, morning and afternoon sessions.' },
        { type: 'subheading', text: 'Dialogue Topics' },
        { type: 'body',       text: '— Recipe discovery: Spend Insight-based skill checks to learn hidden recipes.\n— Codex hints: Hints at the location of locked codex entries.\n— Lore verification: Confirms or expands on lore items found in the world.' },
        { type: 'subheading', text: 'Quest Involvement' },
        { type: 'body',       text: '"The Missing Codex" — recover scattered codex pages from Hollowroot Catacombs floors 3-5.\n"Knowledge is Power" — Insight-check quest chain, 5 parts.' },
      ],
    },
    {
      id: 'npc_companion_board',
      title: 'Companion Board',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'Companion Board' },
        { type: 'badge',      text: 'System NPC — Home Base' },
        { type: 'body',       text: 'A large wooden board in the Home Base common room where potential companions post their notices. The board is the game\'s companion recruitment interface.' },
        { type: 'subheading', text: 'Available Companions' },
        { type: 'body',       text: 'Sylara (Wildkin Ranger) — wilderness specialist\nGarrick (Bloomguard Veteran) — tank and melee support\nTaleth (Sporecaller Apprentice) — debuff and poison\nMirren (Emerald Mystic) — spell support and healing\nVex (Thornbinder) — crowd control and terrain' },
        { type: 'subheading', text: 'Mechanics' },
        { type: 'body',       text: 'Recruit up to 2 companions at once. Each companion has 3 active abilities and a personal quest chain. Completing their quest unlocks their final ability.' },
        { type: 'tip',        text: 'Read each companion\'s board notice carefully — they contain hidden hints about their personal quest location.' },
      ],
    },
  ],

  // --------------------------------------------------
  LOCATIONS: [
    {
      id: 'loc_canopy_of_life',
      title: 'Canopy of Life',
      unlockEvent: 'zone:entered',
      unlockId: 'canopy_of_life',
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'Canopy of Life' },
        { type: 'badge',      text: 'Hub — Tier 1 — Verdance Central' },
        { type: 'body',       text: 'The great tree-city of Verdance. Platforms and bridges connect living tree structures high above the forest floor. Ten districts bustle with over thirty NPCs.' },
        { type: 'subheading', text: 'Districts' },
        { type: 'body',       text: "Market Square — Verdant Exchange\nResidential Quarter — player dwelling\nBloomguard Barracks — military training\nEmerald Sanctum — scholarship and archives\nCouncil Hall — faction politics\nCraftsman's Lane — Forge, workshop\nThe Roost — inn, rest\nHerbalist Row — alchemy" },
        { type: 'subheading', text: 'Notable Features' },
        { type: 'body',       text: 'All services available. Fast travel hub. No hostile enemies inside city walls.' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'Founded centuries ago by the First Keepers, grown from a single sacred sapling into a sprawling metropolis. Each district was cultivated by a different faction, and the living wood remembers every hand that shaped it.' },
      ],
    },
    {
      id: 'loc_verdant_exchange',
      title: 'Verdant Exchange',
      unlockEvent: 'zone:entered',
      unlockId: 'verdant_exchange',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Verdant Exchange' },
        { type: 'badge',      text: 'District — Commerce Hub' },
        { type: 'body',       text: 'The commercial heart of the Canopy, controlled by the merchant consortium of the same name. Stalls and shops ring a great central market tree.' },
        { type: 'subheading', text: 'Services' },
        { type: 'body',       text: 'General merchant (daily rotating stock)\nRare goods auction (Silver Phase only)\nConsortium quests board\nBank and currency exchange\nPostmaster' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'Founded 80 years ago when a merchant family brokered peace between the Bloomguard and Sporecaller Brotherhood by controlling supply lines. The family still runs the Consortium.' },
      ],
    },
    {
      id: 'loc_bloomguard_barracks',
      title: 'Bloomguard Barracks',
      unlockEvent: 'zone:entered',
      unlockId: 'bloomguard_barracks',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Bloomguard Barracks' },
        { type: 'badge',      text: 'District — Military Quarter' },
        { type: 'body',       text: 'The fortress-district of the Bloomguard, carved directly into the thickest section of the great tree. The air smells of iron and wax.' },
        { type: 'subheading', text: 'Notable Features' },
        { type: 'body',       text: 'Combat training grounds (Might/Resilience training)\nArmory vendor (military gear)\nCommander Briara\'s office (Bloomguard faction quests)\nPrisoner holding cells (plot-relevant dungeon)' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'Built after the first Corruption incursion forty years ago. Every wall is inscribed with names of fallen soldiers. Commander Briara personally approves every inscription.' },
      ],
    },
    {
      id: 'loc_emerald_sanctum',
      title: 'Emerald Sanctum',
      unlockEvent: 'zone:entered',
      unlockId: 'emerald_sanctum',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Emerald Sanctum' },
        { type: 'badge',      text: 'District — Archive and Scholarship' },
        { type: 'body',       text: 'A vast library-temple of living wood and crystallised Sap windows housing every known text in Verdance.' },
        { type: 'subheading', text: 'Notable Features' },
        { type: 'body',       text: 'Archivist Yeva (recipe discovery)\nElder Thornwick (upper library, morning)\nSpell Loom crafting station\nAncient text reading room (Lore skill checks)\nSecret vault (requires quest)' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'The original Sanctum burned in the Great Corruption. The current structure was grown over 20 years by the Thornbinder Conclave. The upper floor contains texts written in a language no one alive can fully read.' },
      ],
    },
    {
      id: 'loc_whispering_veil',
      title: 'Whispering Veil',
      unlockEvent: 'zone:entered',
      unlockId: 'whispering_veil',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Whispering Veil' },
        { type: 'badge',      text: 'Special Location — Silver Phase Only' },
        { type: 'body',       text: 'A liminal space accessible only during the Silver Phase, through a hidden grove past the Hollowroot Catacombs entrance.' },
        { type: 'subheading', text: 'Access Requirements' },
        { type: 'body',       text: '— Silver Phase must be active\n— Keeper Maren\'s referral letter or 80+ Veilkeeper reputation\n— Must not carry more than 2 Void Fragments' },
        { type: 'subheading', text: 'Services' },
        { type: 'body',       text: 'All Veilkeeper consultations\nForbidden spell scroll vendor (Blighted only)\nMemory Tithe altar\nPassive DSP recovery (1 DSP/second while present)' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'Scholars debate whether the Veil exists between Sap phases or between the thoughts of the world-tree. The Veilkeepers refuse to clarify.' },
      ],
    },
    {
      id: 'loc_hollowroot_catacombs',
      title: 'Hollowroot Catacombs',
      unlockEvent: 'zone:entered',
      unlockId: 'hollowroot_catacombs',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Hollowroot Catacombs' },
        { type: 'badge',      text: 'Dungeon — Tier 2-4 — Underground' },
        { type: 'body',       text: 'A vast network of root-tunnels and carved chambers beneath the Canopy. Formerly used as burial crypts; now largely overtaken by Corruption.' },
        { type: 'subheading', text: 'Floors' },
        { type: 'body',       text: 'Floor 1-3: Shadow Stalkers, Vine Wraiths, Spore Crawlers (Tier 2)\nFloor 4-6: Hollow Knights, Crystal Sentinels, Shadow Weavers (Tier 3)\nDeep Level: Crimson Wurm territory (Tier 4, Crimson Phase only)\nSecret Floor: Nexus Guardian fragment (Codex puzzle required)' },
        { type: 'subheading', text: 'Notable Features' },
        { type: 'body',       text: 'Lost codex pages on floors 3-5\nAncient forge room (Tier-3 crafting station)\nVeilkeeper shrine on floor 2 (passive DSP recovery)' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'The only structure to survive the Great Corruption intact. Historians believe the Corruption entered Verdance through a rift that opened on the deep level.' },
      ],
    },
    {
      id: 'loc_crimson_spire',
      title: 'Crimson Spire',
      unlockEvent: 'zone:entered',
      unlockId: 'crimson_spire',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'Crimson Spire' },
        { type: 'badge',      text: 'Dungeon — Tier 3-4 — Above Ground' },
        { type: 'body',       text: 'A twisted tower of crystallised Crimson Sap. Pulses with Crimson Phase energy even during Blue and Silver phases — a permanent wound in the Sap Cycle.' },
        { type: 'subheading', text: 'Floors' },
        { type: 'body',       text: 'Floor 1-4: Corrupted Treants, Crimson Wurm spawn points\nFloor 5-7: Shadow Weavers, Crystal Sentinels\nApex: Mini-boss encounter, unique loot\nCrimson Phase bonus: Extra floor, double loot' },
        { type: 'subheading', text: 'Hazards' },
        { type: 'body',       text: 'Permanent Crimson aura: +5 DSP per spell cast inside.\nCrimson Sap pools: 10 damage/turn if stood in.\nStructural instability: Random floor sections collapse (telegraphed).' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'Grew overnight forty years ago at the peak of the Great Corruption. The Bloomguard attempted to destroy it three times. It regrew each time. Elder Thornwick believes it is a scar left by something older than the Corruption.' },
      ],
    },
    {
      id: 'loc_nexus_gate',
      title: 'The Nexus Gate',
      unlockEvent: 'zone:entered',
      unlockId: 'nexus_gate',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'The Nexus Gate' },
        { type: 'badge',      text: 'Endgame Location — Tier 5' },
        { type: 'body',       text: 'The absolute centre of the Verdance world. Simultaneously a physical structure and a metaphysical threshold — the point where all three Sap phases converge.' },
        { type: 'subheading', text: 'Access Requirements' },
        { type: 'body',       text: '— Complete all three main quest chapters\n— Collect all 7 Phase Crystals\n— Character level 20+\n— DSP below 30 on entry (the Gate refuses higher)' },
        { type: 'subheading', text: 'Notable Features' },
        { type: 'body',       text: 'Nexus Guardian boss (final boss)\nAll three Sap phases cycle every 60 seconds instead of 3-4 minutes\nAll stat caps removed inside' },
        { type: 'subheading', text: 'Lore' },
        { type: 'body',       text: 'The Gate predates the world-tree itself. Some scholars believe it is not an entrance to anywhere but the source of the Sap Cycle itself. Passing through may not lead outward — but inward.' },
      ],
    },
  ],

  // --------------------------------------------------
  LORE: [
    {
      id: 'lore_verdance_world',
      title: 'The Verdance World',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'The World of Verdance' },
        { type: 'body',       text: 'Verdance is a world defined by a single fact: everything lives. The rocks breathe slowly. The rivers remember their sources. At the root of all this vitality is the Sap — a luminous, living fluid that flows through every living thing and forms the medium through which magic operates.' },
        { type: 'subheading', text: 'Geography' },
        { type: 'body',       text: 'The world is centred on the great world-tree, so vast its canopy forms the sky visible from ground level. Below, concentric rings of forest, dungeon, and corrupted zone extend outward from the trunk toward the hostile Periphery.' },
        { type: 'subheading', text: 'The Living World' },
        { type: 'body',       text: 'Verdance reacts to the player. Kill too many nature creatures and forest paths close. Respect the Sap Cycle and the world provides bonuses. Fracture the DSP Cycle repeatedly and reality develops permanent visual distortions in areas you frequent.' },
      ],
    },
    {
      id: 'lore_sap_cycle_origin',
      title: 'The Sap Cycle Origin',
      unlockEvent: 'zone:entered',
      unlockId: 'whispering_veil',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'The Sap Cycle Origin' },
        { type: 'body',       text: 'The Sap Cycle was not always a cycle. In the First Age, the Sap flowed freely without phase distinction — a constant Silver-Blue shimmer with no Crimson presence at all.' },
        { type: 'subheading', text: 'The First Corruption (The Sundering)' },
        { type: 'body',       text: 'When the first practitioners forced Void energy into the Sap network — the act now called the Sundering — they introduced Crimson as a third phase. The world-tree\'s consciousness responded by creating the Cycle as a containment mechanism: rotating through phases to prevent any single energy type from dominating permanently.' },
        { type: 'subheading', text: 'The Veilkeepers\' Role' },
        { type: 'body',       text: 'The Veilkeepers were originally the world-tree\'s immune response — consciousnesses formed from Sap itself to monitor and maintain the Cycle. Over millennia they developed individual identity and chose mortal-adjacent form. They now maintain the Cycle through choice rather than nature.' },
        { type: 'tip',        text: 'This information is known only to the Veilkeepers. Elder Thornwick has a partial version. The full account requires a Veilkeeper consultation.' },
      ],
    },
    {
      id: 'lore_great_corruption',
      title: 'The Great Corruption',
      unlockEvent: 'enemy-defeated',
      unlockId: 'corrupted_treant',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'The Great Corruption' },
        { type: 'body',       text: 'Forty years before the events of Realm of Nexus: Verdance, a catastrophic surge of Void energy tore through the Sap network. In three days it killed a third of Verdance\'s population, corrupted half the forest, and destroyed the original Emerald Sanctum.' },
        { type: 'subheading', text: 'The Cause' },
        { type: 'body',       text: 'Officially: unknown. The Bloomguard blames a rogue Blighted cult. The Thornbinder Conclave\'s private records suggest it originated within the Nexus Gate itself. The Veilkeepers have never commented publicly.' },
        { type: 'subheading', text: 'The Aftermath' },
        { type: 'body',       text: 'Corrupted zones remain throughout the world. Some creatures were permanently altered. The Crimson Spire grew overnight from the epicentre. The Veilkeepers emerged publicly for the first time and enforced a ceasefire between factions.' },
        { type: 'subheading', text: 'The Present Threat' },
        { type: 'body',       text: 'Sap readings suggest a Second Corruption may be building. Whether it can be prevented — and what is truly causing it — forms the central mystery of Realm of Nexus: Verdance.' },
      ],
    },
    {
      id: 'lore_veilkeepers_history',
      title: 'The Veilkeepers History',
      unlockEvent: 'veilkeeper:consulted',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'History of the Veilkeepers' },
        { type: 'body',       text: 'The Veilkeepers are, depending on who you ask: ancient guardians of the world, dangerous mystics with too much power, or a convenient mythology maintained by powerful individuals who prefer anonymity.' },
        { type: 'subheading', text: 'Known Timeline' },
        { type: 'body',       text: '— Age of Founding: Eight Veilkeepers appeared during the Sundering, from nowhere.\n— First Compact: Negotiated peace between original human and spirit inhabitants.\n— Pre-Corruption: Warned factions of rising Void energy. Were ignored.\n— Post-Corruption: Stabilised the Sap network, then retreated again.\n— Present: Operate through intermediaries like Keeper Maren.' },
        { type: 'subheading', text: 'Faction Views' },
        { type: 'body',       text: 'Bloomguard — cautious respect\nThornbinder Conclave — reverence\nEmerald Sanctum — academic fascination\nSporecaller Brotherhood — deep suspicion\nVerdant Exchange — indifferent' },
      ],
    },
    {
      id: 'lore_five_classes',
      title: 'The Five Classes',
      unlockEvent: null,
      defaultUnlocked: true,
      content: [
        { type: 'heading',    text: 'The Five Classes of Verdance' },
        { type: 'body',       text: 'In Verdance, a character\'s class reflects their relationship to the Sap — how they channel it, what they protect, and what they sacrifice. Classes are not professions but identities.' },
        { type: 'subheading', text: 'Historical Origin' },
        { type: 'body',       text: 'The five classes emerged naturally over generations as the Sap revealed different affinities in different people. The Veilkeepers formalised the categories during post-Corruption reconstruction.' },
        { type: 'subheading', text: 'The Blighted Question' },
        { type: 'body',       text: 'The Thornbinder Conclave teaches that Blighted individuals are not corrupted but rather those whose Sap connection runs through the Crimson-Silver boundary. They carry more power and more risk.' },
        { type: 'subheading', text: 'Class Rarity' },
        { type: 'body',       text: 'Bloomguard are most common — military training actively seeks those with the affinity. Emerald Mystics and Sporecallers are rarer, requiring specific environmental exposure. Wildkin Rangers mostly emerge from communities outside the city.' },
      ],
    },
    {
      id: 'lore_factions_war',
      title: 'The Factions War',
      unlockEvent: 'zone:entered',
      unlockId: 'bloomguard_barracks',
      defaultUnlocked: false,
      content: [
        { type: 'heading',    text: 'The Factions War' },
        { type: 'body',       text: 'Before the Great Corruption, the six factions of Verdance were in open conflict — a resource war over Sap access building for decades.' },
        { type: 'subheading', text: 'The War\'s Causes' },
        { type: 'body',       text: 'Sap pools were finite and claimed by territory. The Verdant Exchange played factions against each other for profit. The Bloomguard and Sporecaller Brotherhood had reached open military confrontation.' },
        { type: 'subheading', text: 'The Corruption as Ceasefire' },
        { type: 'body',       text: 'The Great Corruption ended the war by ending a third of the population and making territorial squabbles irrelevant. The Veilkeepers\' public intervention provided a unified enemy that replaced faction conflict.' },
        { type: 'subheading', text: 'Present Tensions' },
        { type: 'body',       text: 'The ceasefire holds — barely. The Factions War is history but its causes have never been resolved. A Second Corruption could unify or shatter the peace for good.' },
      ],
    },
  ],
};

// ============================================================
// WikiCodexScene
// ============================================================

export default class WikiCodexScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WikiCodexScene' });

    // Scene state
    this._selectedCategory = 'SYSTEMS';
    this._selectedEntryId  = null;
    this._unlocked         = new Set();
    this._busListeners     = [];

    // Layout constants
    this.SIDEBAR_W   = 220;
    this.CAT_ITEM_H  = 36;
    this.SUBITEM_H   = 28;
    this.PAD         = 16;
    this.TITLE_BAR_H = 52;

    // Colours
    this.BG_COLOR     = 0x0d1117;
    this.SIDEBAR_BG   = 0x161b22;
    this.ACCENT       = 0x4ade80;
    this.ACCENT_HEX   = '#4ade80';
    this.DIM          = 0x30363d;
    this.TEXT_WHITE   = '#e6edf3';
    this.TEXT_MUTED   = '#8b949e';
    this.CAT_COLORS = {
      SYSTEMS:   '#60a5fa',
      ENEMIES:   '#f87171',
      ITEMS:     '#fbbf24',
      SPELLS:    '#a78bfa',
      NPCS:      '#34d399',
      LOCATIONS: '#fb923c',
      LORE:      '#e879f9',
    };
  }

  // -----------------------------------------------------------------------
  create() {
    const { width, height } = this.scale;

    this._loadUnlocked();
    this._setupEventListeners();

    // Full-screen background
    this.add.rectangle(width / 2, height / 2, width, height, this.BG_COLOR, 0.98).setDepth(0);

    this._buildTitleBar(width);
    this._buildSidebarBackground(height);
    this._sidebarContainer = this.add.container(0, this.TITLE_BAR_H).setDepth(2);

    const contentX = this.SIDEBAR_W;
    const contentY = this.TITLE_BAR_H;
    this._contentWidth  = width  - this.SIDEBAR_W;
    this._contentHeight = height - this.TITLE_BAR_H;
    this._contentContainer = this.add.container(contentX, contentY).setDepth(1);

    this._setupInput();
    this._refreshSidebar();

    // Auto-select first unlocked entry in default category
    const firstEntry = this._firstVisibleEntry(this._selectedCategory);
    if (firstEntry) this._showEntry(firstEntry);
  }

  shutdown() {
    this._busListeners.forEach(fn => fn());
    this._busListeners = [];
  }

  // -----------------------------------------------------------------------
  // Unlock persistence
  // -----------------------------------------------------------------------

  _loadUnlocked() {
    try {
      const arr = JSON.parse(localStorage.getItem('verdance_codex_unlocked') || '[]');
      this._unlocked = new Set(arr);
    } catch (_) {
      this._unlocked = new Set();
    }
    // Apply hardcoded defaults
    Object.values(CODEX_DATA).flat().forEach(e => {
      if (e.defaultUnlocked) this._unlocked.add(e.id);
    });
  }

  _saveUnlocked() {
    try {
      localStorage.setItem('verdance_codex_unlocked', JSON.stringify([...this._unlocked]));
    } catch (_) { /* storage full */ }
  }

  _isUnlocked(entry) {
    return entry.defaultUnlocked || this._unlocked.has(entry.id);
  }

  _unlock(entryId) {
    if (!this._unlocked.has(entryId)) {
      this._unlocked.add(entryId);
      this._saveUnlocked();
    }
  }

  // -----------------------------------------------------------------------
  // EventBus listeners — wire unlock events to entries
  // -----------------------------------------------------------------------

  _setupEventListeners() {
    const reg = (event, fn) => {
      this._busListeners.push(EventBus.on(event, fn));
    };

    // Helper: match a runtime ID against an entry's unlockId (substring, lowercase)
    const matchEntries = (category, runtimeId) => {
      if (!runtimeId) return;
      const id = String(runtimeId).toLowerCase();
      CODEX_DATA[category].forEach(e => {
        if (e.unlockId && id.includes(e.unlockId.toLowerCase())) {
          this._unlock(e.id);
        }
      });
    };

    // Enemies
    reg('enemy-defeated', (data) => {
      const type = (data && (data.type || data.id || data.enemyType)) || data;
      matchEntries('ENEMIES', type);
      this._unlock('sys_combat');
      if (type && String(type).toLowerCase().includes('corrupted_treant')) {
        this._unlock('lore_great_corruption');
      }
    });

    // Items
    reg('inventory:addItem', (data) => {
      const id = (data && (data.itemId || data.id)) || data;
      matchEntries('ITEMS', id);
    });

    // Zones (two event name variants)
    const onZone = (data) => {
      const id = (data && (data.locationId || data.zoneId || data.id)) || data;
      matchEntries('LOCATIONS', id);
      // Lore entries tied to zone discovery
      if (id && String(id).includes('whispering_veil')) this._unlock('lore_sap_cycle_origin');
      if (id && String(id).includes('bloomguard_barracks')) this._unlock('lore_factions_war');
    };
    reg('zone:entered',  onZone);
    reg('zone-entered',  onZone);

    // Dialogues
    reg('dialogue:start', (data) => {
      const id = (data && (data.npcId || data.id)) || data;
      matchEntries('NPCS', id);
    });

    // Spells
    reg('spell-cast', (data) => {
      const id = (data && (data.spellId || data.id)) || data;
      matchEntries('SPELLS', id);
      this._unlock('sys_dsp_pool');
    });

    // Crafting
    reg('crafting:complete', () => this._unlock('sys_crafting'));

    // Veilkeeper
    reg('veilkeeper:consulted', () => {
      this._unlock('sys_veilkeepers');
      this._unlock('lore_veilkeepers_history');
    });
  }

  // -----------------------------------------------------------------------
  // Title bar
  // -----------------------------------------------------------------------

  _buildTitleBar(width) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x161b22, 1);
    g.fillRect(0, 0, width, this.TITLE_BAR_H);
    g.lineStyle(1, this.ACCENT, 0.35);
    g.lineBetween(0, this.TITLE_BAR_H, width, this.TITLE_BAR_H);

    this.add.text(this.PAD, this.TITLE_BAR_H / 2, 'VERDANCE CODEX', {
      fontFamily: 'Open Sans',
      fontSize: '25px',
      color: this.ACCENT_HEX,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(2);

    this.add.text(width - this.PAD, this.TITLE_BAR_H / 2, '[W] or [ESC] to close', {
      fontFamily: 'Open Sans',
      fontSize: '17px',
      color: this.TEXT_MUTED,
    }).setOrigin(1, 0.5).setDepth(2);
  }

  // -----------------------------------------------------------------------
  // Sidebar
  // -----------------------------------------------------------------------

  _buildSidebarBackground(height) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(this.SIDEBAR_BG, 1);
    g.fillRect(0, this.TITLE_BAR_H, this.SIDEBAR_W, height - this.TITLE_BAR_H);
    g.lineStyle(1, this.DIM, 1);
    g.lineBetween(this.SIDEBAR_W, this.TITLE_BAR_H, this.SIDEBAR_W, height);
  }

  _refreshSidebar() {
    if (!this._sidebarContainer) return;
    this._sidebarContainer.removeAll(true);

    let yOff = 8;
    const categories = Object.keys(CODEX_DATA);

    categories.forEach(cat => {
      const isCat = cat === this._selectedCategory;
      const catHex = this.CAT_COLORS[cat] || '#ffffff';
      const catCol = Phaser.Display.Color.HexStringToColor(catHex).color;

      // Category row highlight
      if (isCat) {
        this._sidebarContainer.add(
          this.add.rectangle(this.SIDEBAR_W / 2, yOff + this.CAT_ITEM_H / 2,
            this.SIDEBAR_W - 4, this.CAT_ITEM_H - 2, 0x21262d, 1).setOrigin(0.5)
        );
      }

      const catLabel = this.add.text(this.PAD, yOff + this.CAT_ITEM_H / 2, cat, {
        fontFamily: 'Open Sans',
        fontSize: '18px',
        color: isCat ? catHex : this.TEXT_MUTED,
        fontStyle: isCat ? 'bold' : 'normal',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

      catLabel.on('pointerdown', () => {
        this._selectedCategory = cat;
        this._selectedEntryId  = null;
        const first = this._firstVisibleEntry(cat);
        this._showEntry(first || CODEX_DATA[cat][0]);
        this._refreshSidebar();
      });
      catLabel.on('pointerover',  () => { if (!isCat) catLabel.setColor(catHex); });
      catLabel.on('pointerout',   () => { if (!isCat) catLabel.setColor(this.TEXT_MUTED); });

      this._sidebarContainer.add(catLabel);
      yOff += this.CAT_ITEM_H;

      // Sub-items (only for selected category)
      if (isCat) {
        (CODEX_DATA[cat] || []).forEach(entry => {
          const unlocked  = this._isUnlocked(entry);
          const isActive  = this._selectedEntryId === entry.id;
          const labelText = unlocked ? entry.title : '[ LOCKED ]';
          const textColor = isActive ? catHex : (unlocked ? this.TEXT_WHITE : this.TEXT_MUTED);

          if (isActive) {
            this._sidebarContainer.add(
              this.add.rectangle(this.SIDEBAR_W / 2, yOff + this.SUBITEM_H / 2,
                this.SIDEBAR_W - 8, this.SUBITEM_H - 2, 0x21262d, 1).setOrigin(0.5)
            );
            this._sidebarContainer.add(
              this.add.rectangle(2, yOff + this.SUBITEM_H / 2, 3, this.SUBITEM_H - 2, catCol, 1).setOrigin(0, 0.5)
            );
          }

          const sub = this.add.text(this.PAD + 12, yOff + this.SUBITEM_H / 2, labelText, {
            fontFamily: 'Open Sans',
            fontSize: '15px',
            color: textColor,
          }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

          sub.on('pointerdown', () => this._showEntry(entry));
          sub.on('pointerover',  () => { if (!isActive) sub.setColor(unlocked ? catHex : '#555'); });
          sub.on('pointerout',   () => { if (!isActive) sub.setColor(textColor); });

          this._sidebarContainer.add(sub);
          yOff += this.SUBITEM_H;
        });
      }

      // Separator
      const sep = this.add.graphics();
      sep.lineStyle(1, this.DIM, 0.4);
      sep.lineBetween(this.PAD, yOff + 1, this.SIDEBAR_W - this.PAD, yOff + 1);
      this._sidebarContainer.add(sep);
      yOff += 5;
    });
  }

  // -----------------------------------------------------------------------
  // Content rendering
  // -----------------------------------------------------------------------

  _firstVisibleEntry(cat) {
    const entries = CODEX_DATA[cat] || [];
    return entries.find(e => this._isUnlocked(e)) || null;
  }

  _showEntry(entry) {
    if (!entry) return;
    this._selectedEntryId = entry.id;
    this._contentContainer.removeAll(true);

    // Reset scroll
    this._contentContainer.setPosition(this.SIDEBAR_W, this.TITLE_BAR_H);
    this._scrollY = 0;

    const catHex = this.CAT_COLORS[this._selectedCategory] || '#ffffff';

    if (this._isUnlocked(entry)) {
      this._renderEntry(entry, catHex);
    } else {
      this._renderLocked(entry);
    }

    this._refreshSidebar();
  }

  _renderLocked(entry) {
    const w = this._contentWidth;
    const h = this._contentHeight;

    this._contentContainer.add(
      this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setOrigin(0.5)
    );
    this._contentContainer.add(
      this.add.text(w / 2, h / 2 - 48, '?', {
        fontFamily: 'Open Sans', fontSize: '90px', color: this.TEXT_MUTED,
      }).setOrigin(0.5)
    );
    this._contentContainer.add(
      this.add.text(w / 2, h / 2 + 16, entry.title, {
        fontFamily: 'Open Sans', fontSize: '28px', color: this.TEXT_MUTED,
      }).setOrigin(0.5)
    );
    this._contentContainer.add(
      this.add.text(w / 2, h / 2 + 56, 'Discover this in-game to unlock', {
        fontFamily: 'Open Sans', fontSize: '18px', color: '#555',
      }).setOrigin(0.5)
    );
  }

  _renderEntry(entry, catHex) {
    const CPAD   = 32;
    const CWIDTH = this._contentWidth - CPAD * 2;
    let y = 24;

    const catColor = Phaser.Display.Color.HexStringToColor(catHex).color;

    entry.content.forEach(block => {
      switch (block.type) {

        case 'heading': {
          const t = this.add.text(CPAD, y, block.text, {
            fontFamily: 'Open Sans', fontSize: '31px',
            color: catHex, fontStyle: 'bold',
            wordWrap: { width: CWIDTH },
          });
          this._contentContainer.add(t);
          y += t.height + 6;

          const line = this.add.graphics();
          line.lineStyle(2, catColor, 0.55);
          line.lineBetween(CPAD, y, CPAD + Math.min(CWIDTH, t.width + 24), y);
          this._contentContainer.add(line);
          y += 14;
          break;
        }

        case 'badge': {
          const b = this.add.text(CPAD, y, block.text, {
            fontFamily: 'Open Sans', fontSize: '15px',
            color: '#0d1117', backgroundColor: catHex,
            padding: { x: 8, y: 4 },
          });
          this._contentContainer.add(b);
          y += b.height + 14;
          break;
        }

        case 'subheading': {
          const t = this.add.text(CPAD, y, block.text, {
            fontFamily: 'Open Sans', fontSize: '20px',
            color: catHex, fontStyle: 'bold',
            wordWrap: { width: CWIDTH },
          });
          this._contentContainer.add(t);
          y += t.height + 6;
          break;
        }

        case 'body': {
          const t = this.add.text(CPAD, y, block.text, {
            fontFamily: 'Open Sans', fontSize: '17px',
            color: this.TEXT_WHITE,
            wordWrap: { width: CWIDTH },
            lineSpacing: 4,
          });
          this._contentContainer.add(t);
          y += t.height + 12;
          break;
        }

        case 'tip': {
          const label = this.add.text(CPAD, y, ' TIP ', {
            fontFamily: 'Open Sans', fontSize: '14px',
            color: '#0d1117', backgroundColor: this.ACCENT_HEX,
            padding: { x: 4, y: 3 },
          });
          this._contentContainer.add(label);

          const tipW = CWIDTH - label.width - 10;
          const text = this.add.text(CPAD + label.width + 8, y, block.text, {
            fontFamily: 'Open Sans', fontSize: '15px',
            color: this.ACCENT_HEX, fontStyle: 'italic',
            wordWrap: { width: Math.max(tipW, 100) },
            lineSpacing: 3,
          });
          this._contentContainer.add(text);
          y += Math.max(label.height, text.height) + 14;
          break;
        }

        default: break;
      }
    });

    // Store total content height for scroll bounds
    this._totalContentH = y + 24;
  }

  // -----------------------------------------------------------------------
  // Input
  // -----------------------------------------------------------------------

  _setupInput() {
    this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
    this.input.keyboard.on('keydown-W',   () => this.scene.stop());

    this._scrollY = 0;
    this.input.on('wheel', (_ptr, _gos, _dx, dy) => {
      if (!this._contentContainer) return;

      this._scrollY += dy * 0.6;
      // Clamp: don't scroll above the top
      if (this._scrollY < 0) this._scrollY = 0;

      const maxScroll = Math.max(0, (this._totalContentH || 0) - this._contentHeight + 32);
      if (this._scrollY > maxScroll) this._scrollY = maxScroll;

      this._contentContainer.setPosition(
        this.SIDEBAR_W,
        this.TITLE_BAR_H - this._scrollY
      );
    });
  }
}
