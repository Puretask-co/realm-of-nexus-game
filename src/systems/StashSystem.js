import EventBus from '../core/EventBus.js';

/**
 * StashSystem — Persistent item storage (60 slots).
 *
 * Singleton. Reacts to `stash:addItem` / `stash:removeItem` events.
 * Serialises through `save-collect` / `save-restore` events.
 * Emits `stash:updated` whenever contents change.
 *
 * Slot format: null | { id, name, rarity, quantity, ...itemData }
 */
export class StashSystem {
    static _instance = null;

    static getInstance() {
        if (!StashSystem._instance) {
            StashSystem._instance = new StashSystem();
        }
        return StashSystem._instance;
    }

    constructor() {
        if (StashSystem._instance) return StashSystem._instance;
        StashSystem._instance = this;

        this.slots = new Array(60).fill(null);

        // EventBus wiring
        this._unsubs = [
            EventBus.on('stash:addItem', (item) => this.addItem(item)),
            EventBus.on('stash:removeItem', ({ slotIndex }) => this.removeItem(slotIndex)),
            EventBus.on('save-collect', (saveData) => {
                saveData.stash = this.serialize();
            }),
            EventBus.on('save-restore', (saveData) => {
                if (saveData.stash) this.deserialize(saveData.stash);
            })
        ];

        console.log('[StashSystem] Initialised — 60 slots');
    }

    // ----------------------------------------------------------------
    // Core operations
    // ----------------------------------------------------------------

    /**
     * Add an item to the first empty slot.
     * @param {object} item - Item object with at least { id, name }.
     * @returns {number} The slot index used, or -1 if stash is full.
     */
    addItem(item) {
        if (!item) return -1;
        const idx = this.slots.findIndex(s => s === null);
        if (idx === -1) {
            console.warn('[StashSystem] Stash is full — cannot add', item);
            EventBus.emit('ui:notification', {
                message: 'Stash is full!',
                color: '#ff6644',
                duration: 2500
            });
            return -1;
        }
        this.slots[idx] = { ...item };
        EventBus.emit('stash:updated', { slots: this.getSlots() });
        return idx;
    }

    /**
     * Remove item at the given slot index.
     * @param {number} slotIndex
     * @returns {object|null} The removed item or null.
     */
    removeItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return null;
        const item = this.slots[slotIndex];
        if (!item) return null;
        this.slots[slotIndex] = null;
        EventBus.emit('stash:updated', { slots: this.getSlots() });
        return item;
    }

    /**
     * Return a shallow copy of the slots array.
     */
    getSlots() {
        return [...this.slots];
    }

    /**
     * Check whether any slot holds an item with the given id.
     * @param {string} itemId
     * @returns {boolean}
     */
    hasItem(itemId) {
        return this.slots.some(s => s && s.id === itemId);
    }

    // ----------------------------------------------------------------
    // Serialization
    // ----------------------------------------------------------------

    serialize() {
        return { slots: this.slots.map(s => s ? { ...s } : null) };
    }

    deserialize(data) {
        if (!data?.slots) return;
        this.slots = data.slots.map(s => s ? { ...s } : null);
        // Pad/trim to exactly 60 slots
        while (this.slots.length < 60) this.slots.push(null);
        this.slots = this.slots.slice(0, 60);
        EventBus.emit('stash:updated', { slots: this.getSlots() });
    }

    destroy() {
        for (const unsub of this._unsubs) if (typeof unsub === 'function') unsub();
        this._unsubs = [];
        StashSystem._instance = null;
    }
}

export default StashSystem;
