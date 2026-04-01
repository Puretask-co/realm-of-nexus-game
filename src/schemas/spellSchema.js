/**
 * Schema definition for spell data validation.
 * Aligned with Verdance JSON: dspCost, single_target, forbidden tiers, etc.
 */
export const spellSchema = {
    required: ['id', 'name'],

    optional: [
        'description', 'element', 'targetType', 'areaOfEffect', 'healAmount', 'defenseBypass',
        'baseDamage', 'sapCost', 'cooldown', 'dspCost', 'apCost', 'damage', 'range', 'duration',
        'concentration', 'class', 'learnMethod', 'phaseModifiers', 'statusEffect', 'vfx', 'soundEffects'
    ],

    properties: {
        id: {
            type: 'string',
            pattern: /^[a-z_]+$/,
            description: 'Unique spell identifier (lowercase, underscores only)'
        },
        name: {
            type: 'string',
            minLength: 3,
            maxLength: 40,
            description: 'Display name shown to player'
        },
        tier: {
            description: 'Spell tier: 1–3 or "forbidden" for narrative spells'
        },
        baseDamage: {
            type: 'number',
            min: 0,
            description: 'Optional balance hook; many spells use damage dice strings instead'
        },
        sapCost: {
            type: 'integer',
            min: 0,
            max: 100,
            description: 'Legacy sap cost; often replaced by dspCost in data'
        },
        dspCost: {
            type: 'integer',
            min: 0,
            max: 100,
            description: 'Domain Soul Pool cost'
        },
        cooldown: {
            type: 'integer',
            min: 0,
            description: 'Turns before spell can be cast again'
        },
        element: {
            type: 'string',
            enum: [
                'nature', 'arcane', 'shadow', 'radiant',
                'spirit', 'fire', 'physical', 'void', 'light',
                'verdant', 'silver'
            ],
            description: 'Elemental / damage type'
        },
        targetType: {
            type: 'string',
            enum: [
                'single', 'aoe', 'self', 'ally',
                'single_target', 'ground_target', 'ally_target'
            ],
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
            enum: [
                'aggressive', 'defensive', 'balanced', 'healer', 'supporter',
                'skirmisher', 'boss_phased', 'swarm', 'tactical', 'support'
            ]
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
