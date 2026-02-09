/**
 * Spell Data Schema
 *
 * Defines the expected structure, types, and constraints for spell data.
 * Used by DataManager to validate spells.json integrity at load time and
 * during hot-reload so that broken data never reaches game systems.
 */

const spellSchema = {
  required: ['id', 'name', 'tier', 'baseDamage', 'sapCost', 'cooldown'],
  optional: ['description', 'element', 'targetType', 'areaOfEffect', 'healAmount',
             'stunChance', 'stunDuration', 'phaseModifiers', 'canCombo', 'combosWith',
             'vfx', 'soundEffects'],

  properties: {
    id: {
      type: 'string',
      pattern: /^[a-z_]+$/,
      description: 'Unique spell identifier (lowercase with underscores)'
    },
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 40,
      description: 'Display name shown to the player'
    },
    tier: {
      type: 'integer',
      min: 1,
      max: 3,
      description: 'Spell tier (1 = basic, 2 = advanced, 3 = ultimate)'
    },
    baseDamage: {
      type: 'number',
      min: 0,
      description: 'Base damage before modifiers (0 for non-damage spells)'
    },
    sapCost: {
      type: 'integer',
      min: 0,
      max: 100,
      description: 'Sap energy cost to cast'
    },
    cooldown: {
      type: 'integer',
      min: 0,
      description: 'Turns before the spell can be cast again'
    },
    element: {
      type: 'string',
      enum: ['nature', 'arcane', 'shadow', 'radiant'],
      description: 'Elemental type of the spell'
    },
    targetType: {
      type: 'string',
      enum: ['single', 'aoe', 'self', 'ally'],
      description: 'Who or what this spell targets'
    },
    areaOfEffect: {
      type: 'integer',
      min: 0,
      description: 'Radius in tiles (0 = single target)'
    },
    healAmount: {
      type: 'number',
      min: 0,
      description: 'HP restored (for healing spells)'
    },
    description: {
      type: 'string',
      maxLength: 200,
      description: 'Flavour text shown in tooltips'
    },
    phaseModifiers: {
      type: 'object',
      description: 'Damage multiplier per Sap Cycle phase'
    },
    canCombo: {
      type: 'boolean',
      description: 'Whether this spell can participate in combos'
    },
    combosWith: {
      type: 'array',
      description: 'Array of spell IDs this combos with'
    },
    vfx: {
      type: 'object',
      description: 'Visual effect configuration'
    },
    soundEffects: {
      type: 'object',
      description: 'Sound effect keys'
    }
  }
};

export default spellSchema;
