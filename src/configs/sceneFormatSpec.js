/**
 * Verdance Scene File Format Specification v1.0
 *
 * Defines the complete structure of .scene.json files created, edited,
 * and loaded by the Visual Level Editor and SceneLoader.
 *
 * This file serves as living documentation. The EXAMPLE_SCENE at the
 * bottom is a fully valid scene that can be loaded directly.
 */

export const SCENE_FORMAT_VERSION = '1.0.0';

/**
 * Schema reference (documentation only — runtime validation is in SceneLoader).
 */
export const SCENE_SCHEMA = {
  version: 'string',          // Must match SCENE_FORMAT_VERSION major

  metadata: {
    name: 'string',
    description: 'string?',
    created: 'ISO 8601',
    modified: 'ISO 8601',
    author: 'string?',
    editorVersion: 'string?',
    tags: '[string]?'
  },

  camera: {
    startX: 'number',
    startY: 'number',
    zoom: 'number?',         // default 1.0
    bounds: '{ x, y, width, height }?',
    follow: 'objectId?',
    lerp: 'number?'          // 0-1, default 0.1
  },

  objects: [{
    id: 'string',
    type: "'sprite' | 'rectangle' | 'circle' | 'text' | 'image'",
    name: 'string',
    layer: 'string?',
    transform: '{ x, y, rotation?, scaleX?, scaleY? }',
    appearance: '{ texture?, frame?, tint?, alpha?, visible?, depth?, flipX?, flipY? }',
    physics: '{ enabled?, bodyType?, collider?, velocity?, bounce?, friction?, mass? }?',
    components: '{ [ComponentName]: { ...props } }?',
    editorData: '{ locked?, hidden?, notes?, color? }?'
  }],

  lighting: {
    ambientColor: 'number?',
    ambientIntensity: 'number?',
    lights: [{
      id: 'string',
      type: "'point' | 'spot' | 'directional'",
      x: 'number', y: 'number',
      color: 'number', intensity: 'number',
      radius: 'number',
      castShadows: 'boolean?'
    }]
  },

  triggers: [{
    id: 'string', name: 'string',
    shape: "'rectangle' | 'circle'",
    x: 'number', y: 'number',
    width: 'number?', height: 'number?', radius: 'number?',
    triggerType: "'enter' | 'exit' | 'stay'",
    oneShot: 'boolean?', enabled: 'boolean?',
    actions: [{ type: 'string', params: 'object' }]
  }],

  spawnPoints: [{
    id: 'string', name: 'string',
    x: 'number', y: 'number',
    spawnType: "'player' | 'enemy' | 'npc' | 'item'",
    entityId: 'string?',
    maxSpawns: 'number?',
    respawnTime: 'number?'
  }],

  paths: [{
    id: 'string', name: 'string',
    closed: 'boolean',
    points: [{ x: 'number', y: 'number', duration: 'number?' }]
  }],

  layers: [{
    name: 'string', depth: 'number',
    visible: 'boolean?', locked: 'boolean?', opacity: 'number?'
  }],

  environment: {
    weather: "'none' | 'rain' | 'snow' | 'fog'",
    weatherIntensity: 'number?',
    timeOfDay: "'dawn' | 'day' | 'dusk' | 'night'",
    windDirection: 'number?',
    windSpeed: 'number?'
  }
};

/**
 * A complete example scene file that can be loaded by SceneLoader.
 */
export const EXAMPLE_SCENE = {
  version: '1.0.0',
  metadata: {
    name: 'Forest Clearing',
    description: 'A peaceful forest clearing with hidden dangers',
    created: '2026-02-09T10:00:00Z',
    modified: '2026-02-09T14:30:00Z',
    author: 'Designer',
    editorVersion: '1.0.0',
    tags: ['forest', 'combat', 'chapter1']
  },
  camera: {
    startX: 600,
    startY: 400,
    zoom: 1.0,
    bounds: { x: 0, y: 0, width: 1200, height: 800 },
    follow: 'player_01',
    lerp: 0.1
  },
  objects: [
    {
      id: 'player_01',
      type: 'sprite',
      name: 'Player Start',
      layer: 'characters',
      transform: { x: 100, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
      appearance: {
        texture: 'player_character', frame: 0,
        tint: 0xffffff, alpha: 1, visible: true, depth: 100,
        flipX: false, flipY: false
      },
      physics: {
        enabled: true, bodyType: 'dynamic',
        collider: { type: 'rectangle', width: 32, height: 48 }
      },
      components: {
        PlayerController: { speed: 200 },
        Health: { current: 100, max: 100 },
        SapPool: { current: 100, max: 100 }
      },
      editorData: { locked: false, hidden: false, notes: 'Player spawn', color: '#00ff00' }
    },
    {
      id: 'tree_01',
      type: 'sprite',
      name: 'Oak Tree',
      layer: 'environment',
      transform: { x: 300, y: 250, rotation: 0, scaleX: 1.2, scaleY: 1.2 },
      appearance: {
        texture: 'oak_tree', frame: 0,
        alpha: 1, visible: true, depth: 50
      },
      physics: {
        enabled: true, bodyType: 'static',
        collider: { type: 'circle', radius: 30 }
      },
      editorData: { notes: 'Decorative tree' }
    },
    {
      id: 'enemy_01',
      type: 'sprite',
      name: 'Forest Guardian',
      layer: 'characters',
      transform: { x: 700, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
      appearance: {
        texture: 'forest_guardian', frame: 0,
        alpha: 1, visible: true, depth: 100, flipX: true
      },
      components: {
        Enemy: { enemyId: 'forest_guardian', level: 3 },
        Health: { current: 120, max: 120 }
      },
      editorData: { notes: 'First encounter', color: '#ff0000' }
    }
  ],
  lighting: {
    ambientColor: 0x4488bb,
    ambientIntensity: 0.6,
    lights: [
      { id: 'light_sun', type: 'directional', x: 600, y: -200, color: 0xffffee, intensity: 0.8, radius: 1000, castShadows: true },
      { id: 'light_campfire', type: 'point', x: 500, y: 500, color: 0xff8800, intensity: 1.2, radius: 150, castShadows: true }
    ]
  },
  triggers: [
    {
      id: 'trigger_boss',
      name: 'Boss Arena Entrance',
      shape: 'rectangle',
      x: 900, y: 350,
      width: 100, height: 150,
      triggerType: 'enter',
      oneShot: true,
      enabled: true,
      actions: [
        { type: 'spawn_boss', params: { bossId: 'ancient_guardian', spawnPoint: { x: 1000, y: 400 } } },
        { type: 'play_music', params: { track: 'boss_battle_theme', fadeIn: 2000 } }
      ]
    }
  ],
  spawnPoints: [
    { id: 'spawn_enemies', name: 'Random Enemy Spawner', x: 400, y: 300, spawnType: 'enemy', entityId: 'shadow_stalker', maxSpawns: 3, respawnTime: 30000 }
  ],
  paths: [
    { id: 'path_patrol', name: 'Patrol Route', closed: true, points: [
      { x: 600, y: 300, duration: 2000 },
      { x: 800, y: 300, duration: 2000 },
      { x: 800, y: 500, duration: 2000 },
      { x: 600, y: 500, duration: 2000 }
    ]}
  ],
  layers: [
    { name: 'background', depth: 0, visible: true, locked: false, opacity: 1.0 },
    { name: 'environment', depth: 50, visible: true, locked: false, opacity: 1.0 },
    { name: 'characters', depth: 100, visible: true, locked: false, opacity: 1.0 },
    { name: 'effects', depth: 200, visible: true, locked: false, opacity: 1.0 },
    { name: 'ui', depth: 1000, visible: true, locked: false, opacity: 1.0 }
  ],
  environment: {
    weather: 'none',
    weatherIntensity: 0,
    timeOfDay: 'day',
    windDirection: 90,
    windSpeed: 5
  }
};
