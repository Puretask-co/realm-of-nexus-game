/**
 * Spell Schema - Validation rules for spell data definitions.
 * Used by DataManager to validate spells.json at load time.
 */
export const spellSchema = {
  required: ['id', 'name', 'type', 'sapCost', 'damage', 'cooldown', 'description'],

  properties: {
    id: { type: 'string', pattern: /^[a-z_]+$/, minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    type: { type: 'string', enum: ['offensive', 'defensive', 'utility', 'temporal', 'healing'] },
    element: { type: 'string', enum: ['fire', 'ice', 'lightning', 'earth', 'wind', 'shadow', 'light', 'temporal', 'nature', 'void'] },
    sapCost: { type: 'number', min: 0, max: 100 },
    damage: { type: 'number', min: 0 },
    cooldown: { type: 'number', min: 0 },
    range: { type: 'number', min: 0 },
    areaOfEffect: { type: 'number', min: 0 },
    castTime: { type: 'number', min: 0 },
    description: { type: 'string', minLength: 1 },
    sapPhaseBonus: {
      type: 'object',
      properties: {
        phase: { type: 'string', enum: ['blue', 'crimson', 'silver'] },
        multiplier: { type: 'number', min: 0 }
      }
    },
    effects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['dot', 'slow', 'stun', 'heal_over_time', 'shield', 'buff', 'debuff', 'knockback', 'pull', 'teleport', 'temporal_shift'] },
          duration: { type: 'number', min: 0 },
          value: { type: 'number' },
          chance: { type: 'number', min: 0, max: 1 }
        }
      }
    },
    animation: { type: 'string' },
    particleEffect: { type: 'string' },
    soundEffect: { type: 'string' },
    icon: { type: 'string' },
    tier: { type: 'number', min: 1, max: 5 },
    unlockLevel: { type: 'number', min: 1 },
    tags: { type: 'array', items: { type: 'string' } }
  }
};

export default spellSchema;
