/**
 * Location Schema - Validation rules for location/map data definitions.
 * Used by DataManager to validate locations.json at load time.
 */
export const locationSchema = {
  required: ['id', 'name', 'type', 'width', 'height'],

  properties: {
    id: { type: 'string', pattern: /^[a-z_]+$/, minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    type: { type: 'string', enum: ['overworld', 'dungeon', 'town', 'arena', 'sanctuary', 'void_realm'] },
    description: { type: 'string' },
    width: { type: 'number', min: 1 },
    height: { type: 'number', min: 1 },
    tileSize: { type: 'number', min: 8 },
    tilemap: { type: 'string' },
    music: { type: 'string' },
    ambience: { type: 'string' },
    sapPhaseModifiers: {
      type: 'object',
      properties: {
        blue: { type: 'number' },
        crimson: { type: 'number' },
        silver: { type: 'number' }
      }
    },
    lighting: {
      type: 'object',
      properties: {
        ambientColor: { type: 'string' },
        ambientIntensity: { type: 'number', min: 0, max: 1 },
        preset: { type: 'string' }
      }
    },
    spawns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enemyId: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          respawnTime: { type: 'number' },
          conditions: { type: 'array' }
        }
      }
    },
    npcs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          dialogue: { type: 'string' }
        }
      }
    },
    connections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targetLocationId: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          targetX: { type: 'number' },
          targetY: { type: 'number' },
          type: { type: 'string', enum: ['door', 'portal', 'path', 'stairs', 'teleporter'] }
        }
      }
    },
    tags: { type: 'array', items: { type: 'string' } }
  }
};

export default locationSchema;
