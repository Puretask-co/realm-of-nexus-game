/**
 * Enemy Schema - Validation rules for enemy data definitions.
 * Used by DataManager to validate enemies.json at load time.
 */
export const enemySchema = {
  required: ['id', 'name', 'type', 'health', 'damage', 'speed'],

  properties: {
    id: { type: 'string', pattern: /^[a-z_]+$/, minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    type: { type: 'string', enum: ['melee', 'ranged', 'caster', 'tank', 'boss', 'minion', 'elite'] },
    health: { type: 'number', min: 1 },
    damage: { type: 'number', min: 0 },
    defense: { type: 'number', min: 0 },
    speed: { type: 'number', min: 0 },
    attackRange: { type: 'number', min: 0 },
    attackSpeed: { type: 'number', min: 0 },
    experienceReward: { type: 'number', min: 0 },
    description: { type: 'string' },
    sapPhaseVulnerability: {
      type: 'object',
      properties: {
        blue: { type: 'number' },
        crimson: { type: 'number' },
        silver: { type: 'number' }
      }
    },
    abilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          spellId: { type: 'string' },
          priority: { type: 'number', min: 0, max: 1 },
          cooldown: { type: 'number', min: 0 },
          conditions: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    lootTable: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          dropChance: { type: 'number', min: 0, max: 1 },
          minQuantity: { type: 'number', min: 1 },
          maxQuantity: { type: 'number', min: 1 }
        }
      }
    },
    ai: {
      type: 'object',
      properties: {
        behavior: { type: 'string', enum: ['aggressive', 'defensive', 'patrol', 'ambush', 'support', 'flee'] },
        aggroRange: { type: 'number', min: 0 },
        leashRange: { type: 'number', min: 0 },
        fleeHealthPercent: { type: 'number', min: 0, max: 1 }
      }
    },
    sprite: { type: 'string' },
    animations: { type: 'object' },
    tags: { type: 'array', items: { type: 'string' } },
    tier: { type: 'number', min: 1, max: 5 }
  }
};

export default enemySchema;
