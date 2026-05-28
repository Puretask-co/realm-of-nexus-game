/**
 * ZoneBackdrops — loads painterly biome backdrops and maps them to zones.
 *
 * To keep memory sane we load ONE representative panel (the `_A` panel) per
 * biome (~11 images) rather than every panel of every location. Each zone is
 * assigned a biome backdrop; GameScene stretches it to fill the zone floor.
 */

// Biome key -> source file (the representative _A panel).
const BIOME_FILES = {
  bg_archive:      'assets/imported/backdrops/bg_archive_A.png',
  bg_catacombs:    'assets/imported/backdrops/bg_catacombs_A.png',
  bg_crimsonmire:  'assets/imported/backdrops/bg_crimsonmire_A.png',
  bg_frostmere:    'assets/imported/backdrops/bg_frostmere_A.png',
  bg_gloamwood:    'assets/imported/backdrops/bg_gloamwood_A.png',
  bg_heights:      'assets/imported/backdrops/bg_heights_A.png',
  bg_scar:         'assets/imported/backdrops/bg_scar_A.png',
  bg_spire:        'assets/imported/backdrops/bg_spire_A.png',
  bg_tideflow:     'assets/imported/backdrops/bg_tideflow_A.png',
  bg_veil:         'assets/imported/backdrops/bg_veil_A.png',
};

// Game zone id -> biome backdrop key.
const ZONE_BACKDROP_MAP = {
  canopy_of_life:             'bg_heights',
  canopy_overlook:            'bg_heights',
  verdant_exchange:           'bg_heights',
  bloomguard_barracks:        'bg_heights',
  emerald_sanctum:            'bg_heights',
  sapling_plantation:         'bg_heights',

  spindlewood_forest:         'bg_gloamwood',
  glinting_groves:            'bg_gloamwood',
  wildkin_hunting_grounds:    'bg_gloamwood',
  hollow_tree_grove:          'bg_gloamwood',
  everwood_heart:             'bg_gloamwood',
  thornbinder_safehouse:      'bg_gloamwood',
  thornbinder_training_grounds:'bg_gloamwood',
  sporecaller_labs:           'bg_gloamwood',
  mycelium_nexus:             'bg_gloamwood',

  hollowroot_catacombs:       'bg_catacombs',
  ancient_unbinding_site:     'bg_spire',
  void_nexus:                 'bg_spire',

  whispering_veil:            'bg_veil',
  veil_echo_chamber:          'bg_veil',
  veil_tear_rift_alpha:       'bg_veil',
  veil_tear_rift_beta:        'bg_veil',
  veil_tear_rift_gamma:       'bg_veil',

  the_scar:                   'bg_scar',
  abyss_forward_camp:         'bg_scar',
  corruption_quarantine_zone: 'bg_crimsonmire',

  emerald_cascades:           'bg_tideflow',
};

const DEFAULT_BACKDROP = 'bg_gloamwood';

export const ZoneBackdrops = {
  preload(scene) {
    for (const [key, path] of Object.entries(BIOME_FILES)) {
      scene.load.image(key, path);
    }
  },

  /** Return the loaded backdrop texture key for a zone id (or default). */
  keyFor(zoneId) {
    const key = ZONE_BACKDROP_MAP[zoneId] || DEFAULT_BACKDROP;
    return key;
  },
};

export default ZoneBackdrops;
