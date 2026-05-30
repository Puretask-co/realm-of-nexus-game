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

export const ZoneBackdrops = {
  preload(scene) {
    for (const [realm, grid] of Object.entries(REALM_GRID)) {
      for (const letter of grid.panels) {
        scene.load.image(panelKey(realm, letter), `assets/imported/backdrops/bg_${realm}_${letter}.png`);
      }
    }
  },

  realmFor(zoneId) {
    return ZONE_REALM[zoneId] || DEFAULT_REALM;
  },

  /**
   * Returns the panel grid for a zone: { keys: [tex keys row-major], cols, rows }
   * Only includes panels whose texture actually loaded.
   */
  gridFor(zoneId, scene) {
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
