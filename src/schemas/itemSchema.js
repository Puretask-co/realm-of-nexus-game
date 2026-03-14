/**
 * Validation schemas for items and locations data.
 *
 * Used by DataManager to validate JSON data files on load.
 * Each schema defines:
 *  - type: expected JS type
 *  - required: whether the field must be present
 *  - enum: whitelist of allowed values
 *  - min/max: range for numbers
 *  - pattern: regex for strings
 *  - children: nested schema for objects/arrays
 */

export const itemSchema = {
    id: { type: 'string', required: true, pattern: /^[a-z_]+$/ },
    name: { type: 'string', required: true },
    type: { type: 'string', required: true, enum: ['consumable', 'material', 'equipment', 'quest', 'key'] },
    rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
    description: { type: 'string' },
    stackable: { type: 'boolean' },
    maxStack: { type: 'number', min: 1, max: 999 },
    value: { type: 'number', min: 0 },

    // Equipment-specific
    slot: { type: 'string', enum: ['head', 'body', 'weapon', 'accessory', 'offhand'] },
    statBonuses: {
        type: 'object',
        children: {
            hp: { type: 'number' },
            sap: { type: 'number' },
            attack: { type: 'number' },
            defense: { type: 'number' },
            speed: { type: 'number' },
            critChance: { type: 'number', min: 0, max: 1 }
        }
    },

    // Consumable-specific
    effect: {
        type: 'object',
        children: {
            type: { type: 'string', enum: ['heal', 'restore_sap', 'buff', 'cure'] },
            value: { type: 'number' },
            duration: { type: 'number' }
        }
    }
};

export const locationSchema = {
    id: { type: 'string', required: true, pattern: /^[a-z_]+$/ },
    name: { type: 'string', required: true },
    description: { type: 'string' },
    type: { type: 'string', enum: ['overworld', 'dungeon', 'town', 'boss_arena'] },
    connections: {
        type: 'array',
        required: true,
        itemSchema: { type: 'string' }
    },
    enemies: {
        type: 'array',
        itemSchema: { type: 'string' }
    },
    npcs: {
        type: 'array',
        itemSchema: {
            type: 'object',
            children: {
                name: { type: 'string', required: true },
                role: { type: 'string', enum: ['quest', 'shop', 'lore'] },
                x: { type: 'number' },
                y: { type: 'number' }
            }
        }
    },
    environment: {
        type: 'object',
        children: {
            ambientLight: { type: 'string' },
            music: { type: 'string' },
            weather: { type: 'string', enum: ['clear', 'rain', 'fog', 'storm'] },
            cameraZoom: { type: 'number', min: 0.25, max: 4.0 }
        }
    }
};

export const sceneFileSchema = {
    metadata: {
        type: 'object',
        required: true,
        children: {
            name: { type: 'string', required: true },
            author: { type: 'string' },
            version: { type: 'string' }
        }
    },
    objects: {
        type: 'array',
        required: true,
        itemSchema: {
            type: 'object',
            children: {
                type: { type: 'string', required: true },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                properties: { type: 'object' }
            }
        }
    },
    triggers: { type: 'array' },
    lights: { type: 'array' },
    spawns: { type: 'array' }
};
