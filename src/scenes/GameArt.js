/**
 * GameArt — curated loader for the renamed painterly assets that get wired
 * directly into gameplay (enemies, bosses, UI frames, class portraits).
 *
 * We deliberately load only a curated set (~50 images), NOT every imported
 * asset, to keep the texture budget sane.
 */

// ── Enemy / boss painterly art (single static images) ────────────────────
const ENEMY_FILES = {
  art_enemy_tree_titan:        'assets/imported/enemies/enemy_tree_titan.png',
  art_enemy_tree_titan_v2:     'assets/imported/enemies/enemy_tree_titan_v2.png',
  art_enemy_tree_titan_v3:     'assets/imported/enemies/enemy_tree_titan_v3.png',
  art_enemy_corrupted_titan:   'assets/imported/enemies/enemy_corrupted_titan.png',
  art_enemy_corrupted_titan_v2:'assets/imported/enemies/enemy_corrupted_titan_v2.png',
  art_enemy_crystal_golem:     'assets/imported/enemies/enemy_crystal_golem.png',
  art_enemy_river_serpent:     'assets/imported/enemies/enemy_river_serpent.png',
  art_enemy_vine_wraith:       'assets/imported/enemies/enemy_vine_wraith.png',
  art_enemy_hollow_knight:     'assets/imported/enemies/enemy_hollow_knight.png',
  art_enemy_abyssal_imp:       'assets/imported/enemies/enemy_abyssal_imp.png',
  art_enemy_shadow_weaver:     'assets/imported/enemies/enemy_shadow_weaver.png',
  art_enemy_bloodthorn_beast:  'assets/imported/enemies/enemy_bloodthorn_beast.png',
  art_enemy_sap_leech:         'assets/imported/enemies/enemy_sap_leech.png',
  art_boss_hollow_king:        'assets/imported/enemies/boss_hollow_king.png',
  art_boss_abyssal_warden:     'assets/imported/enemies/boss_abyssal_warden.png',
  art_boss_nexus_guardian:     'assets/imported/enemies/boss_nexus_guardian.png',
  art_boss_blighted_oakfather: 'assets/imported/enemies/boss_blighted_oakfather.png',
  art_boss_sporelord_mycel:    'assets/imported/enemies/boss_sporelord_mycel.png',
};

// ── UI frames ─────────────────────────────────────────────────────────────
const UI_FILES = {
  art_ui_hotbar:       'assets/imported/ui/ui_hotbar.png',
  art_ui_health_bar:   'assets/imported/ui/ui_health_bar.png',
  art_ui_sap_bar:      'assets/imported/ui/ui_sap_bar.png',
  art_ui_button:       'assets/imported/ui/ui_button_normal.png',
  art_ui_button_hover: 'assets/imported/ui/ui_button_hover.png',
  art_ui_dialogue_box: 'assets/imported/ui/ui_dialogue_box.png',
  art_ui_slot_frame:   'assets/imported/ui/ui_slot_frame.png',
  art_ui_status_badge: 'assets/imported/ui/ui_status_badge.png',
};

// ── NPC archetype art (single static images) ─────────────────────────────
const NPC_FILES = {
  art_npc_elder_sage:        'assets/imported/npcs/npc_elder_sage.png',
  art_npc_archdruid:         'assets/imported/npcs/npc_archdruid.png',
  art_npc_bloomguard_soldier:'assets/imported/npcs/npc_bloomguard_soldier.png',
  art_npc_guard_halberd:     'assets/imported/npcs/npc_guard_halberd.png',
  art_npc_merchant:          'assets/imported/npcs/npc_merchant.png',
  art_npc_blacksmith:        'assets/imported/npcs/npc_blacksmith.png',
  art_npc_herbalist:         'assets/imported/npcs/npc_herbalist.png',
  art_npc_seer:              'assets/imported/npcs/npc_seer.png',
  art_npc_beastcaller:       'assets/imported/npcs/npc_beastcaller.png',
  art_npc_trainer:           'assets/imported/npcs/npc_trainer.png',
  art_npc_scholar:           'assets/imported/npcs/npc_scholar.png',
  art_npc_innkeeper:         'assets/imported/npcs/npc_innkeeper.png',
  art_npc_child:             'assets/imported/npcs/npc_child.png',
};

// Match NPC display-name keywords -> npc art key.
export const NPC_ART_RULES = [
  [/elder|thalos|thornwick|sage|hollow sage|moss elder/, 'art_npc_elder_sage'],
  [/archdruid|veyla|druid|grove tender|vine tender/,     'art_npc_archdruid'],
  [/seer|althea|oracle|veil watcher|keeper of echoes/,   'art_npc_seer'],
  [/commander|briara|bloomguard|bloom herald/,           'art_npc_bloomguard_soldier'],
  [/guard|warden|sentinel|reyla|drillmaster|watcher/,    'art_npc_guard_halberd'],
  [/merchant|trader|lirel|ferren|orla|boskyn|wares/,     'art_npc_merchant'],
  [/smith|garon|forge|forger|bark carver|ironbark/,      'art_npc_blacksmith'],
  [/herbalist|tansy|healer|mora|lyra|dew collector/,     'art_npc_herbalist'],
  [/beastcaller|yenna|ranger|scout|trapper|hunt/,        'art_npc_beastcaller'],
  [/trainer|borsk|torvak/,                               'art_npc_trainer'],
  [/scholar|archivist|kael|scribe|director|orin|singer|crystal/, 'art_npc_scholar'],
  [/innkeeper|maren|aria/,                               'art_npc_innkeeper'],
  [/child|wren|kid/,                                     'art_npc_child'],
];

export function npcArtFor(name) {
  const n = String(name || '').toLowerCase();
  for (const [re, key] of NPC_ART_RULES) if (re.test(n)) return key;
  return 'art_npc_elder_sage';
}

// ── Companion full-body sprites (reuse class sprites) ─────────────────────
const COMPANION_FILES = {
  art_companion_bloomguard:     'assets/imported/sprites/class_sprite_bloomguard.png',
  art_companion_thornbinder:    'assets/imported/sprites/class_sprite_thornbinder.png',
  art_companion_emerald_mystic: 'assets/imported/sprites/class_sprite_emerald_mystic.png',
  art_companion_sporecaller:    'assets/imported/sprites/class_sprite_sporecaller.png',
  art_companion_wildkin_ranger: 'assets/imported/sprites/class_sprite_wildkin_ranger.png',
};

const COMPANION_CLASS = {
  vaeril: 'bloomguard', sylor: 'thornbinder', aeliana: 'emerald_mystic',
  mycon: 'sporecaller', kaelen: 'wildkin_ranger',
  // Second roster — added with the 10-companion expansion. Mirrors data/companions.json.
  briara: 'bloomguard', yenna: 'wildkin_ranger', althea: 'emerald_mystic',
  veyla: 'emerald_mystic', kael: 'thornbinder',
};

export function companionArtFor(companionId) {
  const cls = COMPANION_CLASS[companionId] || 'bloomguard';
  return `art_companion_${cls}`;
}

// ── Spell icons ───────────────────────────────────────────────────────────
const SPELL_ICON_FILES = {
  icon_azure_bolt:      'assets/imported/icons/spell_azure_bolt.png',
  icon_crimson_surge:   'assets/imported/icons/spell_crimson_surge.png',
  icon_verdant_bloom:   'assets/imported/icons/spell_verdant_bloom.png',
  icon_shadow_strike:   'assets/imported/icons/spell_shadow_strike.png',
  icon_radiant_burst:   'assets/imported/icons/spell_radiant_burst.png',
  icon_fireball:        'assets/imported/icons/spell_fireball.png',
  icon_frostbolt:       'assets/imported/icons/spell_frostbolt.png',
  icon_frostbind:       'assets/imported/icons/spell_frostbind.png',
  icon_lightning_bolt:  'assets/imported/icons/spell_lightning_bolt.png',
  icon_thunder:         'assets/imported/icons/spell_thunder.png',
  icon_divine_heal:     'assets/imported/icons/spell_divine_heal.png',
  icon_arcane_missile:  'assets/imported/icons/spell_arcane_missile.png',
  icon_spore_plague:    'assets/imported/icons/spell_spore_plague.png',
  icon_veil_step:       'assets/imported/icons/spell_veil_step.png',
  icon_sap_drain:       'assets/imported/icons/spell_sap_drain.png',
  icon_veilkeepers_memory:'assets/imported/icons/spell_veilkeepers_memory.png',
  icon_teleport:        'assets/imported/icons/spell_teleport.png',
};

// element/keyword fallback so any spell gets a reasonable icon.
// Order matters — more specific patterns first.
const SPELL_ICON_FALLBACK = [
  [/fire|flame|burn|inciner|ember|blaze/, 'icon_fireball'],
  [/frost|ice|freeze|cold|chill|blizzard/, 'icon_frostbolt'],
  [/thunder|storm|lightning|shock|spark|bolt/, 'icon_lightning_bolt'],
  [/poison|venom|nettle|hemorrhage|toxin|plague|fungal|mushroom/, 'icon_spore_plague'],
  [/shield|guard|stance|bulwark|ward|fortress|wall|armor|bark/, 'icon_radiant_burst'],
  [/heal|cure|bloom|mend|regen|grove|nature|verdant|root|thorn|spore|vine|sap|whisper|ancestor|beast|bond|companion/, 'icon_verdant_bloom'],
  [/holy|radiant|divine|light|sanct/, 'icon_radiant_burst'],
  [/shadow|dark|decay|abyss|void|curse|necro|drain|hollow|garrote/, 'icon_shadow_strike'],
  [/trap|snare|web|entangle|caltrop|debilitat/, 'icon_shadow_strike'],
  [/bash|strike|slash|cleave|blade|hammer|crush|smash|charge/, 'icon_crimson_surge'],
  [/crimson|blood|surge|rage|fury|berserk/, 'icon_crimson_surge'],
  [/aim|arrow|shot|piercing|volley|sniper|wind_arrow/, 'icon_arcane_missile'],
  [/veil|silver|memory|temporal|step|teleport|sight|rift|channel|dash|camouflag|stealth|disengag|hunter|mark|sense|track|harmony/, 'icon_veil_step'],
  [/crystal|prism|lance|construct|sliver/, 'icon_azure_bolt'],
  [/arcane|azure|magic|bolt|missile|soul|mana/, 'icon_azure_bolt'],
];

export function spellIconFor(spellId, scene) {
  const id = String(spellId || '').toLowerCase();
  const direct = `icon_${id}`;
  if (scene.textures.exists(direct)) return direct;
  for (const [re, key] of SPELL_ICON_FALLBACK) {
    if (re.test(id) && scene.textures.exists(key)) return key;
  }
  return scene.textures.exists('icon_azure_bolt') ? 'icon_azure_bolt' : null;
}

// ── Class portraits (base 6) ──────────────────────────────────────────────
const PORTRAIT_FILES = {
  art_portrait_bloomguard:     'assets/imported/portraits/class_portrait_bloomguard.png',
  art_portrait_thornbinder:    'assets/imported/portraits/class_portrait_thornbinder.png',
  art_portrait_emerald_mystic: 'assets/imported/portraits/class_portrait_emerald_mystic.png',
  art_portrait_wildkin_ranger: 'assets/imported/portraits/class_portrait_wildkin_ranger.png',
  art_portrait_sporecaller:    'assets/imported/portraits/class_portrait_sporecaller.png',
  art_portrait_veilkeeper:     'assets/imported/portraits/class_portrait_veilkeeper.png',
};

// Map enemy data ids -> painterly texture key (with sensible reuse).
export const PAINTERLY_ENEMY_MAP = {
  // direct
  abyssal_imp: 'art_enemy_abyssal_imp',
  bloodthorn_beast: 'art_enemy_bloodthorn_beast',
  crystal_golem: 'art_enemy_crystal_golem',
  hollow_knight: 'art_enemy_hollow_knight',
  river_serpent: 'art_enemy_river_serpent',
  sap_leech: 'art_enemy_sap_leech',
  shadow_weaver: 'art_enemy_shadow_weaver',
  vine_wraith: 'art_enemy_vine_wraith',
  // tree-titan family
  forest_guardian: 'art_enemy_tree_titan',
  ancient_treant: 'art_enemy_tree_titan_v2',
  deeproot_guardian: 'art_enemy_tree_titan_v3',
  moss_golem: 'art_enemy_tree_titan_v2',
  root_sentinel_mini: 'art_enemy_tree_titan',
  corrupted_treant: 'art_enemy_corrupted_titan',
  corrupted_dryad: 'art_enemy_corrupted_titan_v2',
  crimson_warden: 'art_enemy_corrupted_titan',
  // reuse by archetype
  crystal_sentinel: 'art_enemy_crystal_golem',
  shadow_stalker: 'art_enemy_shadow_weaver',
  bark_spider: 'art_enemy_shadow_weaver',
  veil_wisp: 'art_enemy_vine_wraith',
  sap_ghost: 'art_enemy_vine_wraith',
  timber_wolf: 'art_enemy_bloodthorn_beast',
  blight_hound: 'art_enemy_bloodthorn_beast',
  thornback_bear: 'art_enemy_bloodthorn_beast',
  thorn_harrier: 'art_enemy_bloodthorn_beast',
  canopy_stalker: 'art_enemy_bloodthorn_beast',
  crimson_maw: 'art_enemy_abyssal_imp',
  thorn_sprite: 'art_enemy_abyssal_imp',
  ember_sprite: 'art_enemy_abyssal_imp',
  rot_grub: 'art_enemy_sap_leech',
  sap_beetle: 'art_enemy_sap_leech',
  blight_beetle_swarm: 'art_enemy_sap_leech',
  spore_crawler: 'art_enemy_sap_leech',
  root_crawler: 'art_enemy_sap_leech',
  fungal_slime: 'art_enemy_sap_leech',
  // bosses
  the_hollow_king: 'art_boss_hollow_king',
  abyssal_warden: 'art_boss_abyssal_warden',
  nexus_guardian: 'art_boss_nexus_guardian',
  blighted_oakfather: 'art_boss_blighted_oakfather',
  sporelord_mycel: 'art_boss_sporelord_mycel',
};

export const BOSS_IDS = new Set([
  'the_hollow_king', 'abyssal_warden', 'nexus_guardian',
  'blighted_oakfather', 'sporelord_mycel',
]);

export const GameArt = {
  preload(scene) {
    const load = (map) => {
      for (const [key, path] of Object.entries(map)) scene.load.image(key, path);
    };
    load(ENEMY_FILES);
    load(UI_FILES);
    load(PORTRAIT_FILES);
    load(NPC_FILES);
    load(SPELL_ICON_FILES);
    load(COMPANION_FILES);
  },
};

export default GameArt;
