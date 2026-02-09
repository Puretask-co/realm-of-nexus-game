/**
 * Item Schema - Validation rules for item data definitions.
 * Used by DataManager to validate items.json at load time.
 */
export const itemSchema = {
  required: ['id', 'name', 'type', 'rarity'],

  properties: {
    id: { type: 'string', pattern: /^[a-z_]+$/, minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    type: { type: 'string', enum: ['weapon', 'armor', 'accessory', 'consumable', 'material', 'quest', 'key'] },
    rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] },
    description: { type: 'string' },
    value: { type: 'number', min: 0 },
    stackable: { type: 'boolean' },
    maxStack: { type: 'number', min: 1 },
    stats: {
      type: 'object',
      properties: {
        damage: { type: 'number' },
        defense: { type: 'number' },
        health: { type: 'number' },
        sapRegenRate: { type: 'number' },
        speed: { type: 'number' },
        critChance: { type: 'number', min: 0, max: 1 },
        critDamage: { type: 'number' }
      }
    },
    effects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          value: { type: 'number' },
          duration: { type: 'number' }
        }
      }
    },
    requirements: {
      type: 'object',
      properties: {
        level: { type: 'number', min: 1 },
        class: { type: 'string' }
      }
    },
    sapPhaseAffinity: { type: 'string', enum: ['blue', 'crimson', 'silver', 'none'] },
    icon: { type: 'string' },
    sprite: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  }
};

export default itemSchema;
