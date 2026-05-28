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
  },
};

export default GameArt;
