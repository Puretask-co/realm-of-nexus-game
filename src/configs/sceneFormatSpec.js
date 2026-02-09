/**
 * Scene Format Specification v1.0
 * Defines the JSON structure for Verdance scene/level files.
 * Used by both the Visual Level Editor and the runtime SceneLoader.
 */
export const SCENE_FORMAT_VERSION = '1.0';

export const sceneFormatSpec = {
  version: '1.0',
  description: 'Verdance Scene File Format Specification',

  structure: {
    metadata: {
      version: 'string - Format version',
      name: 'string - Scene display name',
      id: 'string - Unique scene identifier',
      author: 'string - Creator name',
      created: 'number - Unix timestamp',
      modified: 'number - Unix timestamp',
      description: 'string - Scene description',
      tags: 'string[] - Searchable tags'
    },

    camera: {
      x: 'number - Initial camera X position',
      y: 'number - Initial camera Y position',
      zoom: 'number - Initial zoom level (default 1.0)',
      bounds: {
        x: 'number - Camera bounds X',
        y: 'number - Camera bounds Y',
        width: 'number - Camera bounds width',
        height: 'number - Camera bounds height'
      }
    },

    objects: [
      {
        id: 'string - Unique object ID',
        type: 'string - sprite|tilemap|zone|trigger|decor|npc|enemy|interactive',
        name: 'string - Display name',
        x: 'number - World X position',
        y: 'number - World Y position',
        width: 'number - Object width',
        height: 'number - Object height',
        rotation: 'number - Rotation in radians',
        scaleX: 'number - Horizontal scale',
        scaleY: 'number - Vertical scale',
        alpha: 'number - Opacity 0-1',
        depth: 'number - Z-depth for rendering order',
        visible: 'boolean - Visibility flag',
        texture: 'string - Sprite texture key',
        frame: 'number|string - Texture frame',
        tint: 'number - Color tint (hex)',
        flipX: 'boolean - Horizontal flip',
        flipY: 'boolean - Vertical flip',
        physics: {
          enabled: 'boolean',
          type: 'string - static|dynamic',
          collides: 'boolean',
          sensor: 'boolean'
        },
        properties: 'object - Custom key-value properties',
        children: 'object[] - Nested child objects',
        prefabId: 'string - Reference to a prefab template',
        layer: 'string - Layer this object belongs to'
      }
    ],

    lighting: {
      ambientColor: 'string - Hex color for ambient light',
      ambientIntensity: 'number - 0-1 ambient brightness',
      lights: [
        {
          id: 'string',
          type: 'string - point|spot|directional|area',
          x: 'number',
          y: 'number',
          color: 'string - Hex color',
          intensity: 'number - 0-1',
          radius: 'number - Light radius in pixels',
          angle: 'number - Spot light angle',
          castShadows: 'boolean',
          flickerRate: 'number - Flicker frequency',
          flickerAmount: 'number - Flicker intensity variation'
        }
      ]
    },

    triggers: [
      {
        id: 'string',
        name: 'string',
        x: 'number',
        y: 'number',
        width: 'number',
        height: 'number',
        event: 'string - Event to emit when triggered',
        conditions: 'string[] - Conditions that must be met',
        oneShot: 'boolean - Trigger only once',
        enabled: 'boolean'
      }
    ],

    spawnPoints: [
      {
        id: 'string',
        name: 'string',
        type: 'string - player|enemy|npc|item',
        x: 'number',
        y: 'number',
        properties: 'object - Spawn-specific data (enemyId, itemId, etc.)'
      }
    ],

    audioZones: [
      {
        id: 'string',
        x: 'number',
        y: 'number',
        width: 'number',
        height: 'number',
        music: 'string - Music track key',
        ambience: 'string - Ambience track key',
        volume: 'number - 0-1',
        fadeTime: 'number - Crossfade duration in seconds'
      }
    ],

    paths: [
      {
        id: 'string',
        name: 'string',
        type: 'string - patrol|cinematic|spline',
        points: [{ x: 'number', y: 'number', speed: 'number', wait: 'number' }],
        loop: 'boolean',
        pingPong: 'boolean'
      }
    ],

    layers: [
      {
        id: 'string',
        name: 'string',
        visible: 'boolean',
        locked: 'boolean',
        opacity: 'number - 0-1',
        depth: 'number',
        type: 'string - objects|tiles|decor|collision|ui'
      }
    ],

    environment: {
      sapPhase: 'string - blue|crimson|silver',
      weather: 'string - none|rain|snow|fog|storm|ash',
      timeOfDay: 'string - dawn|morning|noon|afternoon|dusk|night|midnight',
      windDirection: 'number - Wind angle in degrees',
      windStrength: 'number - 0-1',
      fogDensity: 'number - 0-1',
      fogColor: 'string - Hex color'
    }
  }
};

/**
 * Creates a blank scene file with required defaults.
 */
export function createBlankScene(name = 'Untitled Scene', width = 1280, height = 720) {
  return {
    metadata: {
      version: SCENE_FORMAT_VERSION,
      name,
      id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author: '',
      created: Date.now(),
      modified: Date.now(),
      description: '',
      tags: []
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1.0,
      bounds: { x: 0, y: 0, width, height }
    },
    objects: [],
    lighting: {
      ambientColor: '#ffffff',
      ambientIntensity: 0.8,
      lights: []
    },
    triggers: [],
    spawnPoints: [],
    audioZones: [],
    paths: [],
    layers: [
      { id: 'layer_bg', name: 'Background', visible: true, locked: false, opacity: 1, depth: -100, type: 'decor' },
      { id: 'layer_terrain', name: 'Terrain', visible: true, locked: false, opacity: 1, depth: 0, type: 'tiles' },
      { id: 'layer_objects', name: 'Objects', visible: true, locked: false, opacity: 1, depth: 100, type: 'objects' },
      { id: 'layer_collision', name: 'Collision', visible: true, locked: false, opacity: 0.5, depth: 200, type: 'collision' },
      { id: 'layer_ui', name: 'UI Overlay', visible: true, locked: false, opacity: 1, depth: 900, type: 'ui' }
    ],
    environment: {
      sapPhase: 'blue',
      weather: 'none',
      timeOfDay: 'noon',
      windDirection: 0,
      windStrength: 0,
      fogDensity: 0,
      fogColor: '#cccccc'
    }
  };
}

export default sceneFormatSpec;
