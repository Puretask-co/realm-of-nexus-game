/**
 * GameConfig - Central game configuration constants.
 */
export const GameConfig = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE_SIZE: 32,
  PHYSICS_FPS: 60,

  // Sap Cycle phases
  SAP_PHASES: {
    BLUE: 'blue',
    CRIMSON: 'crimson',
    SILVER: 'silver'
  },

  // Performance thresholds
  PERFORMANCE: {
    TARGET_FPS: 60,
    LOW_FPS_THRESHOLD: 30,
    ADAPTIVE_QUALITY: true
  },

  // Debug flags
  DEBUG: {
    SHOW_FPS: true,
    SHOW_PHYSICS: false,
    SHOW_LIGHTING: false,
    SHOW_PARTICLES: false,
    SHOW_CAMERA: false,
    LOG_EVENTS: false
  }
};

export default GameConfig;
