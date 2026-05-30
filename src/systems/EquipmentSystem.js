import { EventBus } from '../core/EventBus.js';

/**
 * EquipmentSystem — Authoritative source for what the player has equipped.
 *
 * Slots:  head | chest | weapon | offhand | boots | ring1 | ring2 | amulet
 *
 * When an item is equipped or unequipped this system:
 *   1. Updates the internal slot map
 *   2. Recomputes total equipment bonuses
 *   3. Emits `equipment:changed` with the full stat delta so GameScene /
 *      AttributeSystem can apply the diff to the live player
 *   4. Emits `equipment:slotChanged` per-slot for UI panels
 *
 * Rarity bonus multipliers (applied to base item stats):
 *   common 1.0 | uncommon 1.15 | rare 1.35 | epic 1.6 | legendary 2.0
 */

const SLOT_TYPES = {
    head:    ['helmet', 'head'],
    chest:   ['armor', 'chest'],
    weapon:  ['weapon', 'sword', 'staff', 'bow', 'dagger', 'axe', 'mace'],
    offhand: ['offhand', 'shield', 'tome', 'focus'],
    boots:   ['boots', 'greaves'],
    ring1:   ['ring', 'accessory'],
    ring2:   ['ring', 'accessory'],
    amulet:  ['amulet', 'necklace', 'accessory'],
};

const RARITY_MULT = {
    common:    1.0,
    uncommon:  1.15,
    rare:      1.35,
    epic:      1.6,
    legendary: 2.0,
};

const EMPTY_BONUSES = () => ({
    damage: 0, defense: 0, speed: 0, health: 0,
    might: 0, agility: 0, resilience: 0, insight: 0, charisma: 0,
    sapRegenRate: 0, critChance: 0, evasion: 0,
});

export class EquipmentSystem {
    static instance = null;
    static getInstance() {
        if (!EquipmentSystem.instance) new EquipmentSystem();
        return EquipmentSystem.instance;
    }

    constructor() {
        if (EquipmentSystem.instance) return EquipmentSystem.instance;
        this.eventBus = EventBus.getInstance();

        /** @type {Record<string, object|null>} */
        this.slots = {
            head: null, chest: null, weapon: null, offhand: null,
            boots: null, ring1: null, ring2: null, amulet: null,
        };

        // Last computed total bonus (so callers can query without re-summing)
        this._totalBonuses = EMPTY_BONUSES();

        EquipmentSystem.instance = this;
        globalThis.__equipmentSystem = this;
    }

    // ─────────────────────────────────────────────────────────────────
    // Equip / Unequip
    // ─────────────────────────────────────────────────────────────────

    /**
     * Equip an item into the best matching slot (or a named slot).
     * Returns `{ success, unequipped, slot }`.
     *   unequipped — the item that was displaced (if any)
     */
    equip(item, preferredSlot = null) {
        if (!item) return { success: false };

        const slot = preferredSlot
            ? (this.slots[preferredSlot] !== undefined ? preferredSlot : null)
            : this._findSlot(item);

        if (!slot) {
            this.eventBus.emit('equipment:error', { message: `No valid slot for ${item.name || item.id}` });
            return { success: false };
        }

        const unequipped = this.slots[slot];
        this.slots[slot] = item;

        this._recalculate();

        this.eventBus.emit('equipment:slotChanged', { slot, item, unequipped });
        this.eventBus.emit('equipment:changed', {
            slots: { ...this.slots },
            bonuses: { ...this._totalBonuses },
        });

        return { success: true, slot, unequipped };
    }

    /**
     * Unequip a specific slot. Returns the item that was removed (or null).
     */
    unequip(slot) {
        if (!this.slots[slot]) return null;
        const item = this.slots[slot];
        this.slots[slot] = null;

        this._recalculate();

        this.eventBus.emit('equipment:slotChanged', { slot, item: null, unequipped: item });
        this.eventBus.emit('equipment:changed', {
            slots: { ...this.slots },
            bonuses: { ...this._totalBonuses },
        });

        return item;
    }

    /**
     * Unequip the item with this id (searches all slots). Returns item or null.
     */
    unequipById(itemId) {
        for (const slot of Object.keys(this.slots)) {
            if (this.slots[slot]?.id === itemId) return this.unequip(slot);
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────────

    getSlot(slot) { return this.slots[slot] || null; }
    getAllSlots() { return { ...this.slots }; }
    getTotalBonuses() { return { ...this._totalBonuses }; }

    /** True if slotName can accept item based on type matching */
    canEquip(item, slotName) {
        if (!item?.type) return false;
        const allowed = SLOT_TYPES[slotName] || [];
        return allowed.includes(item.type.toLowerCase());
    }

    getEquippedWeapon() { return this.slots.weapon || null; }
    getWeaponType() { return this.slots.weapon?.weaponType || this.slots.weapon?.type || null; }

    // ─────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────

    _findSlot(item) {
        const type = (item.type || '').toLowerCase();
        for (const [slotName, allowed] of Object.entries(SLOT_TYPES)) {
            if (allowed.includes(type)) {
                // Prefer empty slot first; fall back to first matching slot
                if (!this.slots[slotName]) return slotName;
            }
        }
        // All matching slots occupied — return first matching slot (will displace)
        for (const [slotName, allowed] of Object.entries(SLOT_TYPES)) {
            if (allowed.includes(type)) return slotName;
        }
        return null;
    }

    _recalculate() {
        const totals = EMPTY_BONUSES();

        for (const item of Object.values(this.slots)) {
            if (!item) continue;
            const mult = RARITY_MULT[item.rarity?.toLowerCase()] ?? 1.0;
            const stats = item.stats || {};

            for (const key of Object.keys(totals)) {
                const raw = stats[key] || 0;
                totals[key] += raw * mult;
            }

            // Special abilities — flag them but don't duplicate
            if (item.specialAbility && !totals._abilities) totals._abilities = [];
            if (item.specialAbility) totals._abilities.push(item.specialAbility);
        }

        // Round numeric values
        for (const key of Object.keys(EMPTY_BONUSES())) {
            totals[key] = Math.round(totals[key]);
        }

        this._totalBonuses = totals;
    }

    // ─────────────────────────────────────────────────────────────────
    // Persistence
    // ─────────────────────────────────────────────────────────────────

    saveState() {
        return { slots: { ...this.slots } };
    }

    loadState(data) {
        if (!data?.slots) return;
        for (const [slot, item] of Object.entries(data.slots)) {
            if (this.slots[slot] !== undefined) {
                this.slots[slot] = item;
            }
        }
        this._recalculate();
        this.eventBus.emit('equipment:changed', {
            slots: { ...this.slots },
            bonuses: { ...this._totalBonuses },
        });
    }

    /** Clear playthrough state for a fresh New Game (all slots empty). */
    reset() {
        this.slots = {
            head: null, chest: null, weapon: null, offhand: null,
            boots: null, ring1: null, ring2: null, amulet: null,
        };
        this._totalBonuses = EMPTY_BONUSES();
        this.eventBus.emit('equipment:changed', {
            slots: { ...this.slots },
            bonuses: { ...this._totalBonuses },
        });
    }
}

export default EquipmentSystem;
