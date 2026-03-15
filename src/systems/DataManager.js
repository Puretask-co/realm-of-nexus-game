import { spellSchema, enemySchema } from '../schemas/spellSchema.js';
import EventBus from '../core/EventBus.js';

/**
 * Central data hub for all game data.
 *
 * Loads spell, enemy, item, location, and balance data from external
 * JSON files so that game content can be edited without touching code.
 * Supports hot-reload during development: change a JSON file, save,
 * and the running game picks up the new values within seconds.
 *
 * This is the single most impactful workflow tool we can build.
 * Without it, every balance tweak requires editing JavaScript,
 * refreshing the browser, and navigating back to the point you
 * were testing. With it, changes appear instantly.
 */
class DataManager {
    constructor() {
        this.data = {
            spells: [],
            enemies: [],
            items: [],
            locations: [],
            quests: [],
            dialogues: { characters: [], dialogues: [] },
            skills: [],
            config: {},
            classes: { classes: [] },
            ancestries: { ancestries: [] },
            story: { eras: [], acts: [] },
            veilkeepers: { veilkeepers: [] }
        };

        this.schemas = {
            spells: spellSchema,
            enemies: enemySchema
        };

        this.loaded = false;
        this.loadPromise = null;

        // Fast lookup caches (Map keyed by id)
        this.cache = {
            spellsById: new Map(),
            enemiesById: new Map(),
            itemsById: new Map(),
            locationsById: new Map()
        };

        // Hot-reload bookkeeping
        this.watchForChanges = false;
        this.watchInterval = null;

        // Validation state
        this.validationErrors = [];
    }

    // ----------------------------------------------------------------
    // Loading
    // ----------------------------------------------------------------

    async loadAllData() {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = this._loadInternal();
        return this.loadPromise;
    }

    async _loadInternal() {
        console.log('[DataManager] Loading game data...');

        try {
            const [spellsData, enemiesData, itemsData, locationsData, configData, questsData, dialoguesData, skillsData, classesData, ancestriesData, storyData, veilkeepersData] =
                await Promise.all([
                    this._loadJSON('./data/spells.json'),
                    this._loadJSON('./data/enemies.json'),
                    this._loadJSON('./data/items.json'),
                    this._loadJSON('./data/locations.json'),
                    this._loadJSON('./data/config.json'),
                    this._loadJSON('./data/quests.json').catch(() => ({ quests: [] })),
                    this._loadJSON('./data/dialogues.json').catch(() => ({ characters: [], dialogues: [] })),
                    this._loadJSON('./data/skills.json').catch(() => ({ skills: [] })),
                    this._loadJSON('./data/classes.json').catch(() => ({ classes: [] })),
                    this._loadJSON('./data/ancestries.json').catch(() => ({ ancestries: [] })),
                    this._loadJSON('./data/story.json').catch(() => ({ eras: [], acts: [] })),
                    this._loadJSON('./data/veilkeepers.json').catch(() => ({ veilkeepers: [] }))
                ]);

            this.data.spells = spellsData.spells || [];
            this.data.enemies = enemiesData.enemies || [];
            this.data.items = itemsData.items || [];
            this.data.locations = locationsData.locations || [];
            this.data.quests = questsData.quests || [];
            this.data.dialogues = dialoguesData;
            this.data.skills = skillsData.skills || [];
            this.data.config = configData;
            this.data.classes = classesData;
            this.data.ancestries = ancestriesData;
            this.data.story = storyData;
            this.data.veilkeepers = veilkeepersData;

            this.validateAllData();
            this.buildCaches();

            this.loaded = true;
            console.log('[DataManager] Data loaded successfully');
            console.log(`  - ${this.data.spells.length} spells`);
            console.log(`  - ${this.data.enemies.length} enemies`);
            console.log(`  - ${this.data.items.length} items`);
            console.log(`  - ${this.data.locations.length} locations`);
            console.log(`  - ${this.data.quests.length} quests`);
            console.log(`  - ${(this.data.dialogues.dialogues || []).length} dialogues`);
            console.log(`  - ${this.data.skills.length} skills`);
            console.log(`  - ${(this.data.classes.classes || []).length} classes`);
            console.log(`  - ${(this.data.ancestries.ancestries || []).length} ancestries`);
            console.log(`  - ${(this.data.story.eras || []).length} story eras`);
            console.log(`  - ${(this.data.veilkeepers.veilkeepers || []).length} veilkeepers`);

            if (this.watchForChanges) {
                this.startWatching();
            }
        } catch (error) {
            console.error('[DataManager] Failed to load data:', error);
            this.loadFallbackData();
        }
    }

    async _loadJSON(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.statusText}`);
        }
        return response.json();
    }

    // ----------------------------------------------------------------
    // Validation
    // ----------------------------------------------------------------

    validateAllData() {
        this.validationErrors = [];

        this.data.spells.forEach((spell, index) => {
            const errors = this.validateObject(spell, this.schemas.spells);
            if (errors.length > 0) {
                this.validationErrors.push({ type: 'spell', index, id: spell.id, errors });
            }
        });

        this.data.enemies.forEach((enemy, index) => {
            const errors = this.validateObject(enemy, this.schemas.enemies);
            if (errors.length > 0) {
                this.validationErrors.push({ type: 'enemy', index, id: enemy.id, errors });
            }
        });

        this.checkDuplicateIds();
        this.checkReferences();

        if (this.validationErrors.length > 0) {
            console.warn(
                `[DataManager] ${this.validationErrors.length} validation issues:`
            );
            this.validationErrors.forEach((e) => {
                console.warn(`  - ${e.type} "${e.id}": ${e.errors.join(', ')}`);
            });
        } else {
            console.log('[DataManager] All data validated successfully');
        }
    }

    validateObject(obj, schema) {
        const errors = [];

        // Required fields
        if (schema.required) {
            schema.required.forEach((field) => {
                if (!(field in obj)) {
                    errors.push(`Missing required field: ${field}`);
                }
            });
        }

        // Property constraints
        Object.keys(obj).forEach((key) => {
            const propSchema = schema.properties?.[key];
            if (!propSchema) return; // unknown props are tolerated

            const value = obj[key];

            if (propSchema.type === 'integer' && !Number.isInteger(value)) {
                errors.push(`${key} must be an integer, got ${typeof value}`);
            } else if (propSchema.type === 'number' && typeof value !== 'number') {
                errors.push(`${key} must be a number, got ${typeof value}`);
            } else if (propSchema.type === 'string' && typeof value !== 'string') {
                errors.push(`${key} must be a string, got ${typeof value}`);
            }

            if (propSchema.min !== undefined && value < propSchema.min) {
                errors.push(`${key} must be >= ${propSchema.min}, got ${value}`);
            }
            if (propSchema.max !== undefined && value > propSchema.max) {
                errors.push(`${key} must be <= ${propSchema.max}, got ${value}`);
            }
            if (propSchema.pattern && typeof value === 'string' && !propSchema.pattern.test(value)) {
                errors.push(`${key} does not match required pattern`);
            }
            if (propSchema.enum && !propSchema.enum.includes(value)) {
                errors.push(`${key} must be one of: ${propSchema.enum.join(', ')}`);
            }
        });

        return errors;
    }

    checkDuplicateIds() {
        const check = (items, type) => {
            const seen = new Set();
            items.forEach((item) => {
                if (seen.has(item.id)) {
                    this.validationErrors.push({
                        type, id: item.id, errors: [`Duplicate ${type} ID: ${item.id}`]
                    });
                }
                seen.add(item.id);
            });
        };

        check(this.data.spells, 'spell');
        check(this.data.enemies, 'enemy');
        check(this.data.items, 'item');
        check(this.data.locations, 'location');
    }

    checkReferences() {
        const spellIds = new Set(this.data.spells.map((s) => s.id));

        // Spell combo references
        this.data.spells.forEach((spell) => {
            (spell.combosWith || []).forEach((comboId) => {
                if (!spellIds.has(comboId)) {
                    this.validationErrors.push({
                        type: 'spell',
                        id: spell.id,
                        errors: [`References unknown spell in combos: ${comboId}`]
                    });
                }
            });
        });

        // Enemy spell references
        this.data.enemies.forEach((enemy) => {
            (enemy.spells || []).forEach((spellId) => {
                if (!spellIds.has(spellId)) {
                    this.validationErrors.push({
                        type: 'enemy',
                        id: enemy.id,
                        errors: [`References unknown spell: ${spellId}`]
                    });
                }
            });
        });
    }

    // ----------------------------------------------------------------
    // Cache
    // ----------------------------------------------------------------

    buildCaches() {
        this.cache.spellsById.clear();
        this.cache.enemiesById.clear();
        this.cache.itemsById.clear();
        this.cache.locationsById.clear();

        this.data.spells.forEach((s) => this.cache.spellsById.set(s.id, s));
        this.data.enemies.forEach((e) => this.cache.enemiesById.set(e.id, e));
        this.data.items.forEach((i) => this.cache.itemsById.set(i.id, i));
        this.data.locations.forEach((l) => this.cache.locationsById.set(l.id, l));
    }

    // ----------------------------------------------------------------
    // Query interface
    // ----------------------------------------------------------------

    getSpell(id) { return this.cache.spellsById.get(id) || null; }
    getAllSpells() { return [...this.data.spells]; }
    getSpellsByTier(tier) { return this.data.spells.filter((s) => s.tier === tier); }
    getSpellsByElement(element) { return this.data.spells.filter((s) => s.element === element); }

    getEnemy(id) { return this.cache.enemiesById.get(id) || null; }
    getAllEnemies() { return [...this.data.enemies]; }
    getEnemiesForPhase(phase) {
        return this.data.enemies.filter((e) => (e.phaseSpawnWeights?.[phase] || 1.0) > 0.5);
    }

    getItem(id) { return this.cache.itemsById.get(id) || null; }
    getAllItems() { return [...this.data.items]; }

    getLocation(id) { return this.cache.locationsById.get(id) || null; }
    getAllLocations() { return [...this.data.locations]; }

    getAllQuests() { return [...this.data.quests]; }
    getQuest(id) { return this.data.quests.find(q => q.id === id) || null; }

    getDialogueData() { return this.data.dialogues; }
    getDialogue(id) { return (this.data.dialogues.dialogues || []).find(d => d.id === id) || null; }
    getCharacter(id) { return (this.data.dialogues.characters || []).find(c => c.id === id) || null; }

    getAllSkills() { return [...this.data.skills]; }
    getSkill(id) { return this.data.skills.find(s => s.id === id) || null; }

    getConfig(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.data.config);
    }

    // ---- Classes ----
    getClassData() { return this.data.classes; }
    getAllClasses() { return this.data.classes.classes || []; }
    getClassById(id) { return (this.data.classes.classes || []).find(c => c.id === id) || null; }
    getClassTierProgression() { return this.data.classes.tierProgression || {}; }
    getMulticlassingRules() { return this.data.classes.multiclassing || {}; }

    // ---- Ancestries ----
    getAncestryData() { return this.data.ancestries; }
    getAllAncestries() { return this.data.ancestries.ancestries || []; }
    getAncestryById(id) { return (this.data.ancestries.ancestries || []).find(a => a.id === id) || null; }
    getAvailableAncestries() { return (this.data.ancestries.ancestries || []).filter(a => a.availableAtStart !== false); }

    // ---- Story ----
    getStoryData() { return this.data.story; }
    getAllEras() { return this.data.story.eras || []; }
    getEraById(id) { return (this.data.story.eras || []).find(e => e.id === id) || null; }
    getAllActs() { return this.data.story.acts || []; }

    // ---- Veilkeepers ----
    getVeilkeeperData() { return this.data.veilkeepers; }
    getAllVeilkeepers() { return this.data.veilkeepers.veilkeepers || []; }
    getVeilkeeperById(id) { return (this.data.veilkeepers.veilkeepers || []).find(v => v.id === id) || null; }

    // ----------------------------------------------------------------
    // Hot-reload
    // ----------------------------------------------------------------

    enableHotReload() {
        this.watchForChanges = true;
        if (this.loaded) this.startWatching();
    }

    disableHotReload() {
        this.watchForChanges = false;
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
    }

    startWatching() {
        console.log('[DataManager] Watching for data changes...');
        this.watchInterval = setInterval(() => this.checkForUpdates(), 2000);
    }

    async checkForUpdates() {
        try {
            const res = await fetch('./data/config.json');
            const configData = await res.json();
            if (configData.lastModified !== this.data.config.lastModified) {
                console.log('[DataManager] Detected data changes, reloading...');
                await this.reloadData();
            }
        } catch (_) {
            // silent fail for polling
        }
    }

    async reloadData() {
        this.loaded = false;
        this.loadPromise = null;
        await this.loadAllData();
        EventBus.emit('data-reloaded', {
            spells: this.data.spells.length,
            enemies: this.data.enemies.length
        });
        console.log('[DataManager] Data hot-reloaded successfully');
    }

    // ----------------------------------------------------------------
    // Fallback
    // ----------------------------------------------------------------

    loadFallbackData() {
        console.warn('[DataManager] Loading fallback hardcoded data...');
        this.data.spells = [
            { id: 'azure_bolt', name: 'Azure Bolt', tier: 1, baseDamage: 15, sapCost: 10, cooldown: 2 }
        ];
        this.data.config = { balance: { player: { startingSap: 100, startingHp: 100 } } };
        this.buildCaches();
        this.loaded = true;
    }

    // ----------------------------------------------------------------
    // Reports
    // ----------------------------------------------------------------

    getValidationReport() {
        return {
            totalErrors: this.validationErrors.length,
            errors: this.validationErrors,
            summary: {
                spellErrors: this.validationErrors.filter((e) => e.type === 'spell').length,
                enemyErrors: this.validationErrors.filter((e) => e.type === 'enemy').length
            }
        };
    }
}

// Singleton
const dataManager = new DataManager();
export default dataManager;
