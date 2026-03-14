import EventBus from '../systems/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * ProgressionSystem — Manages XP, levelling, stat growth, and unlocks.
 *
 * Listens to:
 *  - 'enemy-defeated'  → awards XP and checks for level up
 *  - 'quest-completed' → awards bonus XP / unlocks
 *  - 'item-collected'  → updates inventory counts
 *
 * Emits:
 *  - 'xp-gained'       → { amount, total, source }
 *  - 'level-up'        → { newLevel, statGains, unlocks }
 *  - 'player-stats-updated' → updated stat block for UI
 *
 * XP curve and stat-per-level tables are read from config.json
 * so designers can tune progression without code changes.
 */
export default class ProgressionSystem {
    constructor(playerStats) {
        this.stats = playerStats || this._defaultStats();
        this.level = 1;
        this.xp = 0;
        this.totalXp = 0;
        this.skillPoints = 0;

        // Spell unlock tracking
        this.unlockedSpells = new Set(['azure_bolt']);

        // Achievement tracking
        this.achievements = {};
        this.enemiesDefeated = {};

        this._unsubs = [
            EventBus.on('enemy-defeated', (data) => this._onEnemyDefeated(data)),
            EventBus.on('quest-completed', (data) => this._onQuestCompleted(data)),
            EventBus.on('item-collected', (data) => this._onItemCollected(data))
        ];
    }

    _defaultStats() {
        return {
            hp: 100, maxHp: 100,
            sap: 100, maxSap: 100,
            attack: 10, defense: 5,
            speed: 200, critChance: 0.05,
            resistances: {}
        };
    }

    // ----------------------------------------------------------------
    // XP & levelling
    // ----------------------------------------------------------------

    _xpForLevel(level) {
        // Exponential curve: each level needs ~15% more XP
        const baseXp = dataManager.getConfig('balance.progression.baseXpPerLevel') || 100;
        const growthRate = dataManager.getConfig('balance.progression.xpGrowthRate') || 1.15;
        return Math.round(baseXp * Math.pow(growthRate, level - 1));
    }

    _xpNeeded() {
        return this._xpForLevel(this.level);
    }

    addXp(amount, source) {
        this.xp += amount;
        this.totalXp += amount;

        EventBus.emit('xp-gained', { amount, total: this.totalXp, source });

        // Check for level up (support multi-level jumps)
        let levelsGained = 0;
        while (this.xp >= this._xpNeeded()) {
            this.xp -= this._xpNeeded();
            this.level++;
            levelsGained++;
        }

        if (levelsGained > 0) {
            const gains = this._applyLevelUp(levelsGained);
            EventBus.emit('level-up', {
                newLevel: this.level,
                statGains: gains.statGains,
                unlocks: gains.unlocks
            });
        }

        EventBus.emit('player-stats-updated', this.stats);
    }

    _applyLevelUp(levels) {
        const statGains = { hp: 0, sap: 0, attack: 0, defense: 0 };
        const unlocks = [];

        for (let i = 0; i < levels; i++) {
            // Stat growth per level
            const hpGain = dataManager.getConfig('balance.progression.hpPerLevel') || 12;
            const sapGain = dataManager.getConfig('balance.progression.sapPerLevel') || 8;
            const atkGain = dataManager.getConfig('balance.progression.attackPerLevel') || 2;
            const defGain = dataManager.getConfig('balance.progression.defensePerLevel') || 1;

            this.stats.maxHp += hpGain;
            this.stats.hp += hpGain; // heal on level up
            this.stats.maxSap += sapGain;
            this.stats.sap += sapGain;
            this.stats.attack += atkGain;
            this.stats.defense += defGain;

            statGains.hp += hpGain;
            statGains.sap += sapGain;
            statGains.attack += atkGain;
            statGains.defense += defGain;

            this.skillPoints++;

            // Spell unlocks at certain levels
            const spellUnlocks = {
                3: 'crimson_surge',
                5: 'verdant_bloom',
                8: 'shadow_strike',
                12: 'radiant_burst'
            };

            const currentLevel = this.level - levels + i + 1;
            if (spellUnlocks[currentLevel]) {
                const spellId = spellUnlocks[currentLevel];
                this.unlockedSpells.add(spellId);
                unlocks.push({ type: 'spell', id: spellId });
            }
        }

        return { statGains, unlocks };
    }

    // ----------------------------------------------------------------
    // Event handlers
    // ----------------------------------------------------------------

    _onEnemyDefeated(data) {
        const { enemy, spell } = data;
        if (!enemy?.data?.definition) return;

        const def = enemy.data.definition;
        const baseXp = def.xpReward || 25;

        // Bonus XP for using the right element during matching phase
        let xpMultiplier = 1.0;
        if (spell?.element) {
            const phase = dataManager.getConfig('sapCycle.currentPhase') || 'blue';
            const phaseElementBonus = {
                blue: 'arcane',
                crimson: 'fire',
                silver: 'light'
            };
            if (spell.element === phaseElementBonus[phase]) {
                xpMultiplier = 1.25;
            }
        }

        const xp = Math.round(baseXp * xpMultiplier);
        this.addXp(xp, `defeated:${def.id}`);

        // Track kill counts
        this.enemiesDefeated[def.id] = (this.enemiesDefeated[def.id] || 0) + 1;

        // Achievement check
        this._checkAchievements(def.id);
    }

    _onQuestCompleted(data) {
        const xp = data.xpReward || 50;
        this.addXp(xp, `quest:${data.questId}`);
    }

    _onItemCollected(data) {
        // Items don't give XP by default, but some special items might
        if (data.xpReward) {
            this.addXp(data.xpReward, `item:${data.itemId}`);
        }
    }

    // ----------------------------------------------------------------
    // Achievements
    // ----------------------------------------------------------------

    _checkAchievements(enemyId) {
        const kills = this.enemiesDefeated[enemyId] || 0;
        const milestones = [10, 50, 100, 500];

        milestones.forEach((m) => {
            const key = `kill_${enemyId}_${m}`;
            if (kills >= m && !this.achievements[key]) {
                this.achievements[key] = { unlockedAt: Date.now(), enemyId, count: m };
                EventBus.emit('achievement-unlocked', {
                    id: key,
                    title: `Defeated ${m} ${enemyId}`,
                    enemyId,
                    count: m
                });
            }
        });
    }

    // ----------------------------------------------------------------
    // Serialisation
    // ----------------------------------------------------------------

    serialize() {
        return {
            level: this.level,
            xp: this.xp,
            totalXp: this.totalXp,
            skillPoints: this.skillPoints,
            stats: { ...this.stats },
            unlockedSpells: [...this.unlockedSpells],
            achievements: { ...this.achievements },
            enemiesDefeated: { ...this.enemiesDefeated }
        };
    }

    deserialize(data) {
        if (!data) return;
        this.level = data.level || 1;
        this.xp = data.xp || 0;
        this.totalXp = data.totalXp || 0;
        this.skillPoints = data.skillPoints || 0;
        Object.assign(this.stats, data.stats || {});
        this.unlockedSpells = new Set(data.unlockedSpells || ['azure_bolt']);
        this.achievements = data.achievements || {};
        this.enemiesDefeated = data.enemiesDefeated || {};

        EventBus.emit('player-stats-updated', this.stats);
    }

    shutdown() {
        this._unsubs.forEach((fn) => fn());
    }
}
