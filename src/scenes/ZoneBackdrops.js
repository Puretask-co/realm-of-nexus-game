/**
 * ZoneBackdrops — assembles each realm's multi-panel backdrop into one
 * continuous zone floor. A realm's panels (A..F) are placed edge-to-edge in a
 * grid (6 panels = 3x2, 4 panels = 2x2) filling the zone bounds, so the whole
 * zone reads as one large painted area instead of a single stretched image.
 */

// Realm -> ordered panel letters that exist, plus grid layout.
// Only realms that ZONE_REALM actually maps a zone to are listed — otherwise
// their panel textures would be preloaded but never used.
const REALM_GRID = {
  heights:     { panels: ['A', 'B', 'C', 'D', 'E', 'F'], cols: 3, rows: 2 },
  crimsonmire: { panels: ['A', 'B', 'C', 'D', 'E', 'F'], cols: 3, rows: 2 },
  gloamwood:   { panels: ['A', 'B', 'C', 'D', 'E', 'F'], cols: 3, rows: 2 },
  spire:       { panels: ['A', 'B', 'C', 'D', 'E', 'F'], cols: 3, rows: 2 },
  catacombs:   { panels: ['A', 'B', 'C', 'D'],            cols: 2, rows: 2 },
  scar:        { panels: ['A', 'B', 'C', 'D'],            cols: 2, rows: 2 },
  tideflow:    { panels: ['A', 'B', 'C', 'D'],            cols: 2, rows: 2 },
  veil:        { panels: ['A', 'B', 'C', 'D'],            cols: 2, rows: 2 },
};

// Game zone id -> realm.
const ZONE_REALM = {
  canopy_of_life: 'heights', canopy_overlook: 'heights', verdant_exchange: 'heights',
  bloomguard_barracks: 'heights', emerald_sanctum: 'heights', sapling_plantation: 'heights',

  spindlewood_forest: 'gloamwood', glinting_groves: 'gloamwood', wildkin_hunting_grounds: 'gloamwood',
  hollow_tree_grove: 'gloamwood', everwood_heart: 'gloamwood', thornbinder_safehouse: 'gloamwood',
  thornbinder_training_grounds: 'gloamwood', sporecaller_labs: 'gloamwood', mycelium_nexus: 'gloamwood',

  hollowroot_catacombs: 'catacombs',
  ancient_unbinding_site: 'spire', void_nexus: 'spire',

  whispering_veil: 'veil', veil_echo_chamber: 'veil',
  veil_tear_rift_alpha: 'veil', veil_tear_rift_beta: 'veil', veil_tear_rift_gamma: 'veil',

  the_scar: 'scar', abyss_forward_camp: 'scar',
  corruption_quarantine_zone: 'crimsonmire',
  emerald_cascades: 'tideflow',

  // ── New locations (companion/quest content) ────────────────────────
  crystal_caverns: 'catacombs',
  crimson_plateau: 'crimsonmire',
  nexus_spire: 'spire',
  sunken_ruins: 'tideflow',
  hollowroot_sealed_chamber: 'catacombs',
  east_gate_ruins: 'heights',
  deep_grove_clearing: 'gloamwood',
  root_sentinel_grove: 'gloamwood',
  eastern_canopy: 'heights',
  deep_woods: 'gloamwood',
  veil_breach_approach: 'veil',
  veil_breach: 'veil',
};

const DEFAULT_REALM = 'gloamwood';
const panelKey = (realm, letter) => `bgp_${realm}_${letter}`;

// Zones with dedicated single-image scene art. When set, the scene image
// renders instead of the realm's tiled multi-panel grid — distinctive
// landmarks (sanctums, fortresses, rift scenes) read better as one image.
const ZONE_SCENE = {
  mycelium_nexus:          'bgs_mycelium',
  veil_echo_chamber:       'bgs_veil_echo_chamber',
  veil_tear_rift_alpha:    'bgs_veil_rift',
  veil_tear_rift_beta:     'bgs_veil_rift2',
  hollowroot_catacombs:    'bgs_catacombs',
  bloomguard_barracks:     'bgs_bloomguard_fortress',
  emerald_sanctum:         'bgs_emerald_sanctum',
  sporecaller_labs:        'bgs_sporecaller_labs',
  verdant_exchange:        'bgs_verdant_exchange',
  wildkin_hunting_grounds: 'bgs_wildkin_hunting',
  spindlewood_forest:      'bgs_spindlewood_dark',
  canopy_overlook:         'bgs_verdance_heights',
  canopy_of_life:          'bgs_verdant_grove',
  emerald_cascades:        'bgs_tideflow_scene',
  the_scar:                'bgs_scar_scene',
  void_nexus:              'bgs_veil_rift2',
  veil_breach:             'bgs_veil_rift',
};

// Backdrop-key -> file path. Mirrors filenames in /public/assets/imported/backdrops.
const ZONE_SCENE_FILES = {
  bgs_mycelium:            'assets/imported/backdrops/bg_mycelium_scene.png',
  bgs_veil_echo_chamber:   'assets/imported/backdrops/bg_veil_echo_chamber.png',
  bgs_veil_rift:           'assets/imported/backdrops/bg_veil_rift_scene.png',
  bgs_veil_rift2:          'assets/imported/backdrops/bg_veil_rift_scene2.png',
  bgs_catacombs:           'assets/imported/backdrops/bg_catacombs_scene.png',
  bgs_bloomguard_fortress: 'assets/imported/backdrops/bg_bloomguard_fortress.png',
  bgs_emerald_sanctum:     'assets/imported/backdrops/bg_emerald_sanctum.png',
  bgs_sporecaller_labs:    'assets/imported/backdrops/bg_sporecaller_labs.png',
  bgs_verdant_exchange:    'assets/imported/backdrops/bg_verdant_exchange.png',
  bgs_wildkin_hunting:     'assets/imported/backdrops/bg_wildkin_hunting_grounds.png',
  bgs_spindlewood_dark:    'assets/imported/backdrops/bg_spindlewood_dark.png',
  bgs_verdance_heights:    'assets/imported/backdrops/bg_verdance_heights.png',
  bgs_verdant_grove:       'assets/imported/backdrops/bg_verdant_grove.png',
  bgs_tideflow_scene:      'assets/imported/backdrops/bg_tideflow_scene.png',
  bgs_scar_scene:          'assets/imported/backdrops/bg_scar_scene.png',
};

export const ZoneBackdrops = {
  preload(scene) {
    for (const [realm, grid] of Object.entries(REALM_GRID)) {
      for (const letter of grid.panels) {
        scene.load.image(panelKey(realm, letter), `assets/imported/backdrops/bg_${realm}_${letter}.png`);
      }
    }
    for (const [key, path] of Object.entries(ZONE_SCENE_FILES)) {
      scene.load.image(key, path);
    }
  },

  realmFor(zoneId) {
    return ZONE_REALM[zoneId] || DEFAULT_REALM;
  },

  /**
   * Returns the panel grid for a zone: { keys: [tex keys row-major], cols, rows }
   * Zones with dedicated scene art (ZONE_SCENE) return a single-image 1x1 grid;
   * otherwise the realm's panel grid is assembled. Only includes panels whose
   * texture actually loaded.
   */
  gridFor(zoneId, scene) {
    const sceneKey = ZONE_SCENE[zoneId];
    if (sceneKey && scene.textures.exists(sceneKey)) {
      return { keys: [sceneKey], cols: 1, rows: 1 };
    }
    const realm = this.realmFor(zoneId);
    const grid = REALM_GRID[realm];
    if (!grid) return null;
    const keys = grid.panels.map(l => panelKey(realm, l)).filter(k => scene.textures.exists(k));
    if (keys.length === 0) return null;
    // Fit cols/rows to however many actually loaded.
    let cols = grid.cols, rows = grid.rows;
    if (keys.length < cols * rows) {
      cols = Math.min(cols, keys.length);
      rows = Math.ceil(keys.length / cols);
    }
    return { keys, cols, rows };
  },
};

export default ZoneBackdrops;
