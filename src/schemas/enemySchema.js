/**
 * Enemy Data Schema
 *
 * Defines the expected structure for enemy data in enemies.json.
 * Validates stats ranges, AI pattern references, and loot table integrity.
 */

const enemySchema = {
  required: ['id', 'name', 'baseStats', 'aiPattern'],
  optional: ['spells', 'lootTable', 'phaseSpawnWeights', 'sprite',
             'behaviorParams', 'isBoss', 'description'],

  properties: {
    id: {
      type: 'string',
      pattern: /^[a-z_]+$/,
      description: 'Unique enemy identifier'
    },
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 40,
      description: 'Display name'
    },
    baseStats: {
      type: 'object',
      required: ['hp', 'defense', 'speed', 'sapPool'],
      properties: {
        hp: { type: 'integer', min: 10, max: 9999 },
        defense: { type: 'integer', min: 0, max: 100 },
        speed: { type: 'integer', min: 1, max: 20 },
        sapPool: { type: 'integer', min: 0, max: 500 }
      },
      description: 'Base combat statistics'
    },
    aiPattern: {
      type: 'string',
      enum: ['aggressive', 'defensive', 'balanced', 'healer', 'supporter'],
      description: 'AI behaviour archetype'
    },
    spells: {
      type: 'array',
      description: 'Array of spell IDs this enemy can cast'
    },
    isBoss: {
      type: 'boolean',
      description: 'Whether this enemy is a boss encounter'
    },
    lootTable: {
      type: 'object',
      description: 'Drop table for gold and items'
    },
    phaseSpawnWeights: {
      type: 'object',
      description: 'Spawn probability multiplier per Sap Cycle phase'
    },
    sprite: {
      type: 'object',
      description: 'Sprite sheet configuration'
    },
    behaviorParams: {
      type: 'object',
      description: 'Tunable AI behaviour thresholds'
    }
  }
};

export default enemySchema;
