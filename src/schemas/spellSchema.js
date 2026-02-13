/**
 * Schema definition for spell data validation.
 * Used by DataManager to ensure all spell data is well-formed
 * before it enters the game systems.
 */
export const spellSchema = {
    required: ['id', 'name', 'tier', 'baseDamage', 'sapCost', 'cooldown'],
    optional: ['description', 'element', 'targetType', 'areaOfEffect', 'healAmount', 'defenseBypass'],

    properties: {
        id: {
            type: 'string',
            pattern: /^[a-z_]+$/,
            description: 'Unique spell identifier (lowercase, underscores only)'
        },
        name: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            description: 'Display name shown to player'
        },
        tier: {
            type: 'integer',
            min: 1,
            max: 3,
            description: 'Spell tier (1, 2, or 3)'
        },
        baseDamage: {
            type: 'number',
            min: 0,
            description: 'Base damage before modifiers'
        },
        sapCost: {
            type: 'integer',
            min: 0,
            max: 100,
            description: 'Sap cost to cast'
        },
        cooldown: {
            type: 'integer',
            min: 0,
            description: 'Turns before spell can be cast again'
        },
        element: {
            type: 'string',
            enum: ['nature', 'arcane', 'shadow', 'radiant'],
            description: 'Elemental type'
        },
        targetType: {
            type: 'string',
            enum: ['single', 'aoe', 'self', 'ally'],
            default: 'single'
        },
        areaOfEffect: {
            type: 'integer',
            min: 0,
            description: 'Radius in tiles (0 = single target)'
        },
        phaseModifiers: {
            type: 'object',
            properties: {
                blue: { type: 'number', default: 1.0 },
                crimson: { type: 'number', default: 1.0 },
                silver: { type: 'number', default: 1.0 }
            }
        },
        canCombo: {
            type: 'boolean',
            default: false
        },
        combosWith: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of spell IDs this combos with'
        },
        vfx: {
            type: 'object',
            properties: {
                projectile: { type: 'string' },
                impact: { type: 'string' },
                color: { type: 'string', pattern: /^0x[0-9a-f]{6}$/i },
                trailEffect: { type: 'boolean', default: false }
            }
        }
    }
};

export const enemySchema = {
    required: ['id', 'name', 'baseStats', 'aiPattern'],

    properties: {
        id: { type: 'string', pattern: /^[a-z_]+$/ },
        name: { type: 'string', minLength: 3, maxLength: 40 },
        baseStats: {
            type: 'object',
            required: ['hp', 'defense', 'speed', 'sapPool'],
            properties: {
                hp: { type: 'integer', min: 10, max: 999 },
                defense: { type: 'integer', min: 0, max: 50 },
                speed: { type: 'integer', min: 1, max: 20 },
                sapPool: { type: 'integer', min: 0, max: 200 }
            }
        },
        aiPattern: {
            type: 'string',
            enum: ['aggressive', 'defensive', 'balanced', 'healer', 'supporter']
        },
        spells: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of spell IDs this enemy knows'
        },
        lootTable: {
            type: 'object',
            properties: {
                goldMin: { type: 'integer', min: 0 },
                goldMax: { type: 'integer', min: 0 },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            itemId: { type: 'string' },
                            dropChance: { type: 'number', min: 0, max: 1 }
                        }
                    }
                }
            }
        },
        phaseSpawnWeights: {
            type: 'object',
            properties: {
                blue: { type: 'number', min: 0, default: 1.0 },
                crimson: { type: 'number', min: 0, default: 1.0 },
                silver: { type: 'number', min: 0, default: 1.0 }
            },
            description: 'Spawn probability multiplier per phase'
        }
    }
};
