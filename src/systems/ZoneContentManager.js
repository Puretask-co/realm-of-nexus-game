import EventBus from '../core/EventBus.js';

/**
 * ZoneContentManager — Manages per-zone visual themes, enemy spawning,
 * NPC placement, and music mood for each zone in Verdance.
 *
 * Draws distinct background graphics for each zone type using Phaser Graphics,
 * clears/spawns enemies on zone entry, and drives ProceduralAudio phase changes
 * via EventBus.
 */
export class ZoneContentManager {
    constructor(scene) {
        this.scene = scene;
        this.currentZone = null;
        this.zoneGraphics = null;   // background graphics layer (created fresh per zone)
        this.fogGraphics = null;    // atmosphere/fog overlay layer
        this._decorGraphics = [];   // detail decoration layers for cleanup
        this.activeNPCs = [];
        this.zoneDefinitions = this._buildZoneDefinitions();
    }

    // -----------------------------------------------------------------------
    // Zone definitions — keyed by location id, falls back to type-based lookup
    // -----------------------------------------------------------------------

    _buildZoneDefinitions() {
        return {
            // ── Hub / Central ────────────────────────────────────────────
            canopy_of_life: {
                bgColor: 0x1a3a1a,
                accentColor: 0x2d5a2d,
                fogColor: 0x0a2010,
                groundPattern: 'village',
                ambientLabel: 'Canopy of Life',
                musicMood: 'calm',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x44ff88,
                hazards: []
            },
            verdant_exchange: {
                bgColor: 0x1e3a20,
                accentColor: 0x3a6640,
                fogColor: 0x0a1a10,
                groundPattern: 'village',
                ambientLabel: 'Verdant Exchange',
                musicMood: 'calm',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x55bb66,
                hazards: []
            },
            bloomguard_barracks: {
                bgColor: 0x223322,
                accentColor: 0x445544,
                fogColor: 0x111811,
                groundPattern: 'ruins',
                ambientLabel: 'Bloomguard Barracks',
                musicMood: 'tense',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x667744,
                hazards: []
            },
            emerald_sanctum: {
                bgColor: 0x0d2a1f,
                accentColor: 0x1a5a40,
                fogColor: 0x051510,
                groundPattern: 'forest',
                ambientLabel: 'Emerald Sanctum',
                musicMood: 'mysterious',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x22cc88,
                hazards: []
            },
            whispering_veil: {
                bgColor: 0x1a1f30,
                accentColor: 0x334466,
                fogColor: 0x0a0f20,
                groundPattern: 'forest',
                ambientLabel: 'Whispering Veil',
                musicMood: 'mysterious',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0xaabbdd,
                hazards: []
            },
            canopy_overlook: {
                bgColor: 0x1e3350,
                accentColor: 0x3366aa,
                fogColor: 0x0a1830,
                groundPattern: 'highlands',
                ambientLabel: 'Canopy Overlook',
                musicMood: 'epic',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x88bbdd,
                hazards: []
            },

            // ── Forest / Wilds ────────────────────────────────────────────
            spindlewood_forest: {
                bgColor: 0x142814,
                accentColor: 0x2a522a,
                fogColor: 0x081408,
                groundPattern: 'forest',
                ambientLabel: 'Spindlewood Forest',
                musicMood: 'calm',
                enemyIds: ['grove_sprite', 'root_crawler', 'sap_beetle', 'ember_fox', 'corrupted_sapling'],
                npcTemplates: [],
                lightColor: 0x336633,
                hazards: []
            },
            glinting_groves: {
                bgColor: 0x1a2d3a,
                accentColor: 0x336688,
                fogColor: 0x0a1820,
                groundPattern: 'forest',
                ambientLabel: 'Glinting Groves',
                musicMood: 'calm',
                enemyIds: ['crystal_stag', 'sap_beetle', 'prism_wraith'],
                npcTemplates: [],
                lightColor: 0x88ccee,
                hazards: []
            },
            wildkin_hunting_grounds: {
                bgColor: 0x162614,
                accentColor: 0x2c4a22,
                fogColor: 0x080e08,
                groundPattern: 'forest',
                ambientLabel: 'Wildkin Hunting Grounds',
                musicMood: 'tense',
                enemyIds: ['thornback_bear', 'ember_fox', 'crystal_stag', 'ancient_rootworm'],
                npcTemplates: [],
                lightColor: 0x446633,
                hazards: []
            },
            thornbinder_training_grounds: {
                bgColor: 0x131f13,
                accentColor: 0x243424,
                fogColor: 0x080a08,
                groundPattern: 'forest',
                ambientLabel: 'Thornbinder Training Grounds',
                musicMood: 'tense',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x2d3d2d,
                hazards: []
            },
            thornbinder_safehouse: {
                bgColor: 0x121218,
                accentColor: 0x1e1e28,
                fogColor: 0x060608,
                groundPattern: 'dungeon',
                ambientLabel: 'Thornbinder Safehouse',
                musicMood: 'mysterious',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x2a2a3a,
                hazards: []
            },
            sapling_plantation: {
                bgColor: 0x1e3316,
                accentColor: 0x3d6a2a,
                fogColor: 0x0e1a0a,
                groundPattern: 'village',
                ambientLabel: 'Sapling Plantation',
                musicMood: 'calm',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x669944,
                hazards: []
            },

            // ── Underground / Dungeon ─────────────────────────────────────
            hollowroot_catacombs: {
                bgColor: 0x0d0d1a,
                accentColor: 0x1a1a33,
                fogColor: 0x050510,
                groundPattern: 'dungeon',
                ambientLabel: 'Hollowroot Catacombs',
                musicMood: 'tense',
                enemyIds: ['void_wisp', 'abyssal_crawler', 'shadow_imp', 'void_tendril', 'thornmaw_dryad'],
                npcTemplates: [],
                lightColor: 0x1a1a2e,
                hazards: ['dark']
            },
            mycelium_nexus: {
                bgColor: 0x101820,
                accentColor: 0x1e3a44,
                fogColor: 0x08101a,
                groundPattern: 'dungeon',
                ambientLabel: 'Mycelium Nexus',
                musicMood: 'mysterious',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x224466,
                hazards: ['spores']
            },
            sporecaller_labs: {
                bgColor: 0x141a10,
                accentColor: 0x283420,
                fogColor: 0x0a0e08,
                groundPattern: 'dungeon',
                ambientLabel: 'Sporecaller Labs',
                musicMood: 'mysterious',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x334422,
                hazards: ['spores']
            },

            // ── Highlands / Nature ────────────────────────────────────────
            emerald_cascades: {
                bgColor: 0x142030,
                accentColor: 0x1e4455,
                fogColor: 0x0a1820,
                groundPattern: 'highlands',
                ambientLabel: 'Emerald Cascades',
                musicMood: 'calm',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x33aacc,
                hazards: []
            },
            veil_echo_chamber: {
                bgColor: 0x151a2a,
                accentColor: 0x2a3355,
                fogColor: 0x080a18,
                groundPattern: 'ruins',
                ambientLabel: 'Veil Echo Chamber',
                musicMood: 'mysterious',
                enemyIds: ['echo_phantom', 'memory_wraith'],
                npcTemplates: [],
                lightColor: 0x6677aa,
                hazards: []
            },

            // ── Military / Outpost ────────────────────────────────────────
            abyss_forward_camp: {
                bgColor: 0x1e1410,
                accentColor: 0x3a2a22,
                fogColor: 0x100808,
                groundPattern: 'ruins',
                ambientLabel: 'Abyss Forward Camp',
                musicMood: 'tense',
                enemyIds: ['void_sentinel', 'abyssal_mage', 'shadow_assassin'],
                npcTemplates: [],
                lightColor: 0x553322,
                hazards: ['ash']
            },

            // ── Corrupted Lands ───────────────────────────────────────────
            hollow_tree_grove: {
                bgColor: 0x0d080d,
                accentColor: 0x1a0f1a,
                fogColor: 0x050305,
                groundPattern: 'corrupted',
                ambientLabel: 'Hollow Tree Grove',
                musicMood: 'tense',
                enemyIds: ['corrupted_dryad', 'blighted_treant', 'corrupted_elder'],
                npcTemplates: [],
                lightColor: 0x1a0f1a,
                hazards: ['corruption']
            },
            corruption_quarantine_zone: {
                bgColor: 0x0a0612,
                accentColor: 0x160e22,
                fogColor: 0x050308,
                groundPattern: 'corrupted',
                ambientLabel: 'Corruption Quarantine Zone',
                musicMood: 'tense',
                enemyIds: ['corruption_wraith', 'corrupted_thornweaver', 'decay_knight', 'void_parasite'],
                npcTemplates: [],
                lightColor: 0x110822,
                hazards: ['corruption', 'damage_aura']
            },

            // ── Ritual / Lore Sites ───────────────────────────────────────
            ancient_unbinding_site: {
                bgColor: 0x1a0e28,
                accentColor: 0x330d44,
                fogColor: 0x0e0818,
                groundPattern: 'ruins',
                ambientLabel: 'Ancient Unbinding Site',
                musicMood: 'epic',
                enemyIds: ['void_herald', 'corruption_colossus', 'memory_guardian'],
                npcTemplates: [],
                lightColor: 0x442266,
                hazards: ['arcane']
            },

            // ── Veil Rifts ────────────────────────────────────────────────
            veil_tear_rift_alpha: {
                bgColor: 0x1a1530,
                accentColor: 0x2d2255,
                fogColor: 0x0e0a1e,
                groundPattern: 'dungeon',
                ambientLabel: 'Veil Tear Rift Alpha',
                musicMood: 'mysterious',
                enemyIds: ['void_wisp', 'shadow_imp', 'corruption_wraith', 'rift_stalker'],
                npcTemplates: [],
                lightColor: 0x665588,
                hazards: ['rift_flux']
            },
            veil_tear_rift_beta: {
                bgColor: 0x160f2a,
                accentColor: 0x261844,
                fogColor: 0x0a0818,
                groundPattern: 'dungeon',
                ambientLabel: 'Veil Tear Rift Beta',
                musicMood: 'tense',
                enemyIds: ['void_sentinel', 'abyssal_mage', 'decay_knight', 'mirror_horror'],
                npcTemplates: [],
                lightColor: 0x554477,
                hazards: ['rift_flux', 'mirror']
            },
            veil_tear_rift_gamma: {
                bgColor: 0x0e0018,
                accentColor: 0x1a0030,
                fogColor: 0x070010,
                groundPattern: 'corrupted',
                ambientLabel: 'Veil Tear Rift Gamma',
                musicMood: 'epic',
                enemyIds: ['abyssal_knight', 'void_harbinger', 'corruption_colossus', 'rift_lord'],
                npcTemplates: [],
                lightColor: 0x330044,
                hazards: ['rift_flux', 'void']
            },

            // ── The Abyss ─────────────────────────────────────────────────
            the_scar: {
                bgColor: 0x050008,
                accentColor: 0x0d0018,
                fogColor: 0x020005,
                groundPattern: 'corrupted',
                ambientLabel: 'The Scar',
                musicMood: 'epic',
                enemyIds: ['abyssal_knight', 'void_harbinger', 'abyssal_brute', 'scar_guardian'],
                npcTemplates: [],
                lightColor: 0x0a0010,
                hazards: ['void', 'damage_aura']
            },
            void_nexus: {
                bgColor: 0x030005,
                accentColor: 0x0a000d,
                fogColor: 0x010003,
                groundPattern: 'corrupted',
                ambientLabel: 'Void Nexus',
                musicMood: 'epic',
                enemyIds: ['void_architect'],
                npcTemplates: [],
                lightColor: 0x0a0008,
                hazards: ['void']
            },

            // ── Sacred Core ───────────────────────────────────────────────
            everwood_heart: {
                bgColor: 0x0d3020,
                accentColor: 0x1a6040,
                fogColor: 0x081808,
                groundPattern: 'forest',
                ambientLabel: 'Everwood Heart',
                musicMood: 'epic',
                enemyIds: [],
                npcTemplates: [],
                lightColor: 0x44ff88,
                hazards: []
            }
        };
    }

    // -----------------------------------------------------------------------
    // Type-based fallback definitions
    // -----------------------------------------------------------------------

    _getFallbackDef(locationType) {
        const fallbacks = {
            hub:                { bgColor: 0x1a3a1a, accentColor: 0x2d5a2d, fogColor: 0x0a1a0a, groundPattern: 'village',   ambientLabel: 'Settlement',  musicMood: 'calm',       lightColor: 0x44aa55, enemyIds: [], npcTemplates: [], hazards: [] },
            market:             { bgColor: 0x1e3a20, accentColor: 0x3a6640, fogColor: 0x0a1a10, groundPattern: 'village',   ambientLabel: 'Market',      musicMood: 'calm',       lightColor: 0x55bb66, enemyIds: [], npcTemplates: [], hazards: [] },
            military:           { bgColor: 0x223322, accentColor: 0x445544, fogColor: 0x111811, groundPattern: 'ruins',     ambientLabel: 'Barracks',    musicMood: 'tense',      lightColor: 0x667744, enemyIds: [], npcTemplates: [], hazards: [] },
            military_outpost:   { bgColor: 0x1e1410, accentColor: 0x3a2a22, fogColor: 0x100808, groundPattern: 'ruins',     ambientLabel: 'Outpost',     musicMood: 'tense',      lightColor: 0x553322, enemyIds: [], npcTemplates: [], hazards: ['ash'] },
            temple:             { bgColor: 0x0d2a1f, accentColor: 0x1a5a40, fogColor: 0x051510, groundPattern: 'forest',   ambientLabel: 'Temple',      musicMood: 'mysterious', lightColor: 0x22cc88, enemyIds: [], npcTemplates: [], hazards: [] },
            grove:              { bgColor: 0x1a1f30, accentColor: 0x334466, fogColor: 0x0a0f20, groundPattern: 'forest',   ambientLabel: 'Grove',       musicMood: 'mysterious', lightColor: 0xaabbdd, enemyIds: [], npcTemplates: [], hazards: [] },
            dungeon:            { bgColor: 0x0d0d1a, accentColor: 0x1a1a33, fogColor: 0x050510, groundPattern: 'dungeon',  ambientLabel: 'Dungeon',     musicMood: 'tense',      lightColor: 0x1a1a2e, enemyIds: [], npcTemplates: [], hazards: ['dark'] },
            underground_city:   { bgColor: 0x101820, accentColor: 0x1e3a44, fogColor: 0x08101a, groundPattern: 'dungeon',  ambientLabel: 'Underground', musicMood: 'mysterious', lightColor: 0x224466, enemyIds: [], npcTemplates: [], hazards: [] },
            laboratory:         { bgColor: 0x141a10, accentColor: 0x283420, fogColor: 0x0a0e08, groundPattern: 'dungeon',  ambientLabel: 'Laboratory',  musicMood: 'mysterious', lightColor: 0x334422, enemyIds: [], npcTemplates: [], hazards: ['spores'] },
            exploration:        { bgColor: 0x142814, accentColor: 0x2a522a, fogColor: 0x081408, groundPattern: 'forest',   ambientLabel: 'Wilderness',  musicMood: 'calm',       lightColor: 0x336633, enemyIds: [], npcTemplates: [], hazards: [] },
            nature_reserve:     { bgColor: 0x142030, accentColor: 0x1e4455, fogColor: 0x0a1820, groundPattern: 'highlands',ambientLabel: 'Nature Site', musicMood: 'calm',       lightColor: 0x33aacc, enemyIds: [], npcTemplates: [], hazards: [] },
            lore_site:          { bgColor: 0x151a2a, accentColor: 0x2a3355, fogColor: 0x080a18, groundPattern: 'ruins',    ambientLabel: 'Lore Site',   musicMood: 'mysterious', lightColor: 0x6677aa, enemyIds: [], npcTemplates: [], hazards: [] },
            ritual_site:        { bgColor: 0x1a0e28, accentColor: 0x330d44, fogColor: 0x0e0818, groundPattern: 'ruins',    ambientLabel: 'Ritual Site', musicMood: 'epic',       lightColor: 0x442266, enemyIds: [], npcTemplates: [], hazards: ['arcane'] },
            hazard_zone:        { bgColor: 0x0a0612, accentColor: 0x160e22, fogColor: 0x050308, groundPattern: 'corrupted',ambientLabel: 'Hazard Zone', musicMood: 'tense',      lightColor: 0x110822, enemyIds: [], npcTemplates: [], hazards: ['corruption'] },
            hidden:             { bgColor: 0x121218, accentColor: 0x1e1e28, fogColor: 0x060608, groundPattern: 'dungeon',  ambientLabel: 'Hidden Area', musicMood: 'mysterious', lightColor: 0x2a2a3a, enemyIds: [], npcTemplates: [], hazards: [] },
            training:           { bgColor: 0x131f13, accentColor: 0x243424, fogColor: 0x080a08, groundPattern: 'forest',   ambientLabel: 'Training',    musicMood: 'tense',      lightColor: 0x2d3d2d, enemyIds: [], npcTemplates: [], hazards: [] },
            faction_hq:         { bgColor: 0x1e3316, accentColor: 0x3d6a2a, fogColor: 0x0e1a0a, groundPattern: 'village',  ambientLabel: 'Faction HQ',  musicMood: 'calm',       lightColor: 0x669944, enemyIds: [], npcTemplates: [], hazards: [] },
            sanctum:            { bgColor: 0x0d3020, accentColor: 0x1a6040, fogColor: 0x081808, groundPattern: 'forest',   ambientLabel: 'Sanctum',     musicMood: 'epic',       lightColor: 0x44ff88, enemyIds: [], npcTemplates: [], hazards: [] },
            boss_arena:         { bgColor: 0x050008, accentColor: 0x0d0018, fogColor: 0x020005, groundPattern: 'corrupted',ambientLabel: 'Boss Arena',  musicMood: 'epic',       lightColor: 0x0a0008, enemyIds: [], npcTemplates: [], hazards: ['void'] },
            procedural_dungeon: { bgColor: 0x1a1530, accentColor: 0x2d2255, fogColor: 0x0e0a1e, groundPattern: 'dungeon',  ambientLabel: 'Rift',        musicMood: 'mysterious', lightColor: 0x665588, enemyIds: [], npcTemplates: [], hazards: ['rift_flux'] },
            vista:              { bgColor: 0x1e3350, accentColor: 0x3366aa, fogColor: 0x0a1830, groundPattern: 'highlands', ambientLabel: 'Vista',       musicMood: 'epic',       lightColor: 0x88bbdd, enemyIds: [], npcTemplates: [], hazards: [] }
        };
        return fallbacks[locationType] || fallbacks.exploration;
    }

    // -----------------------------------------------------------------------
    // Resolve definition for a given location id
    // -----------------------------------------------------------------------

    _resolveDef(zoneId) {
        if (this.zoneDefinitions[zoneId]) return this.zoneDefinitions[zoneId];

        // Try to find the zone in the world zones list to get its type
        const zone = this.scene.zones?.find(z => z.id === zoneId);
        if (zone) {
            const fallback = this._getFallbackDef(zone.type);
            return { ...fallback, ambientLabel: zone.name };
        }

        return this._getFallbackDef('exploration');
    }

    // -----------------------------------------------------------------------
    // Map musicMood → ProceduralAudio Sap phase (blue/crimson/silver)
    // -----------------------------------------------------------------------

    _moodToSapPhase(mood) {
        switch (mood) {
            case 'calm':       return 'blue';
            case 'tense':      return 'crimson';
            case 'mysterious': return 'silver';
            case 'epic':       return 'crimson';  // intense / driving
            default:           return 'blue';
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Call when the player enters a zone. Redraws background, spawns enemies,
     * triggers audio mood change, and emits zone:entered.
     */
    enterZone(zoneId) {
        if (this.currentZone === zoneId) return;

        // Clean up previous zone visuals
        this._clearZoneVisuals();

        // Emit cleanup for old enemies
        EventBus.emit('zone:clearEnemies', { previousZone: this.currentZone });

        this.currentZone = zoneId;

        const def = this._resolveDef(zoneId);
        const zoneBounds = this._getZoneBounds(zoneId);

        if (zoneBounds) {
            // Draw layered background
            this.zoneGraphics = this.scene.add.graphics().setDepth(0);
            this._drawBackground(this.zoneGraphics, zoneBounds, def);

            // Draw ground pattern details
            const detailGfx = this.scene.add.graphics().setDepth(1);
            this._decorGraphics.push(detailGfx);
            this.drawGroundPattern(detailGfx, zoneBounds, def.groundPattern, def);

            // Draw atmosphere/fog overlay
            this.fogGraphics = this.scene.add.graphics().setDepth(2);
            this._drawFogOverlay(this.fogGraphics, zoneBounds, def);
        }

        // Spawn enemies appropriate for this zone
        if (def.enemyIds && def.enemyIds.length > 0) {
            EventBus.emit('zone:spawnEnemies', {
                zoneId,
                enemyIds: def.enemyIds,
                bounds: zoneBounds
            });
        }

        // Change audio mood
        const sapPhase = this._moodToSapPhase(def.musicMood);
        EventBus.emit('zone:musicMood', { mood: def.musicMood, sapPhase, zoneId });
        EventBus.emit('sapCycle:phaseChanged', { phase: sapPhase });

        // Notify the rest of the game
        EventBus.emit('zone:entered', {
            zoneId,
            def,
            bounds: zoneBounds,
            musicMood: def.musicMood,
            ambientLabel: def.ambientLabel,
            hazards: def.hazards
        });

        console.log(`[ZoneContentManager] Entered zone: ${def.ambientLabel} (${zoneId}) — mood: ${def.musicMood}`);
    }

    /**
     * Call when the player exits a zone. Cleans up visuals and emits zone:exited.
     */
    exitZone(zoneId) {
        this._clearZoneVisuals();
        EventBus.emit('zone:exited', { zoneId });
        if (this.currentZone === zoneId) this.currentZone = null;
    }

    // -----------------------------------------------------------------------
    // Visual drawing helpers
    // -----------------------------------------------------------------------

    _drawBackground(gfx, bounds, def) {
        const { x, y, w, h } = bounds;

        // Base fill
        gfx.fillStyle(def.bgColor, 1.0);
        gfx.fillRect(x, y, w, h);

        // Subtle gradient bands (simulate depth variation)
        const bandCount = 6;
        for (let i = 0; i < bandCount; i++) {
            const bandY = y + (h / bandCount) * i;
            const bandH = h / bandCount;
            const alpha = 0.04 + (i % 2) * 0.03;
            gfx.fillStyle(def.accentColor, alpha);
            gfx.fillRect(x, bandY, w, bandH);
        }

        // Border glow
        gfx.lineStyle(3, def.lightColor, 0.5);
        gfx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }

    _drawFogOverlay(gfx, bounds, def) {
        const { x, y, w, h } = bounds;

        // Scattered fog blobs around the edges and corners
        const edgePositions = [
            { bx: x + w * 0.1, by: y + h * 0.1 },
            { bx: x + w * 0.9, by: y + h * 0.1 },
            { bx: x + w * 0.1, by: y + h * 0.9 },
            { bx: x + w * 0.9, by: y + h * 0.9 },
            { bx: x + w * 0.5, by: y + h * 0.08 },
            { bx: x + w * 0.5, by: y + h * 0.92 },
        ];

        edgePositions.forEach(pos => {
            gfx.fillStyle(def.fogColor, 0.35);
            gfx.fillCircle(pos.bx, pos.by, Phaser.Math.Between(60, 120));
        });
    }

    /**
     * Draws a ground pattern for the given zone type.
     *
     * @param {Phaser.GameObjects.Graphics} graphics
     * @param {{ x, y, w, h }} bounds  — world-space rectangle of the zone
     * @param {string} pattern         — 'forest'|'ruins'|'dungeon'|'village'|'swamp'|'highlands'|'corrupted'
     * @param {object} def             — zone definition (for colors)
     */
    drawGroundPattern(graphics, bounds, pattern, def) {
        switch (pattern) {
            case 'forest':    this._patternForest(graphics, bounds, def);    break;
            case 'ruins':     this._patternRuins(graphics, bounds, def);     break;
            case 'dungeon':   this._patternDungeon(graphics, bounds, def);   break;
            case 'village':   this._patternVillage(graphics, bounds, def);   break;
            case 'swamp':     this._patternSwamp(graphics, bounds, def);     break;
            case 'highlands': this._patternHighlands(graphics, bounds, def); break;
            case 'corrupted': this._patternCorrupted(graphics, bounds, def); break;
            default:          this._patternForest(graphics, bounds, def);    break;
        }
    }

    // ── Pattern: forest ────────────────────────────────────────────────────
    _patternForest(gfx, { x, y, w, h }, def) {
        // Small triangle "pine trees" scattered through zone
        const treeCount = 28;
        const rng = this._seededPositions(x, y, treeCount, w, h, 40);
        rng.forEach(({ px, py }) => {
            const size = Phaser.Math.Between(10, 22);
            const shade = Phaser.Math.FloatBetween(0.3, 0.7);
            gfx.fillStyle(def.accentColor, shade);
            // Trunk
            gfx.fillRect(px - 2, py, 4, size * 0.4);
            // Canopy (stacked triangles)
            gfx.fillTriangle(px, py - size, px - size * 0.55, py, px + size * 0.55, py);
            gfx.fillStyle(def.accentColor, shade * 0.7);
            gfx.fillTriangle(px, py - size * 1.4, px - size * 0.4, py - size * 0.6, px + size * 0.4, py - size * 0.6);
        });
        // Ground cover dots (foliage clusters)
        for (let i = 0; i < 18; i++) {
            const cx = x + Phaser.Math.Between(30, w - 30);
            const cy = y + Phaser.Math.Between(60, h - 30);
            gfx.fillStyle(def.bgColor, 0.5);
            gfx.fillCircle(cx, cy, Phaser.Math.Between(8, 18));
        }
    }

    // ── Pattern: ruins ────────────────────────────────────────────────────
    _patternRuins(gfx, { x, y, w, h }, def) {
        // Stone column stumps and scattered blocks
        const rng = this._seededPositions(x, y, 20, w, h, 50);
        rng.forEach(({ px, py }) => {
            const colW = Phaser.Math.Between(10, 20);
            const colH = Phaser.Math.Between(20, 50);
            const shade = Phaser.Math.FloatBetween(0.25, 0.55);
            // Column body
            gfx.fillStyle(def.accentColor, shade);
            gfx.fillRect(px - colW / 2, py - colH, colW, colH);
            // Cap stone
            gfx.fillStyle(def.accentColor, shade * 1.2);
            gfx.fillRect(px - colW / 2 - 3, py - colH - 5, colW + 6, 6);
        });
        // Rubble: scattered small rectangles at ground level
        for (let i = 0; i < 25; i++) {
            const rx = x + Phaser.Math.Between(20, w - 20);
            const ry = y + Phaser.Math.Between(60, h - 30);
            gfx.fillStyle(def.accentColor, Phaser.Math.FloatBetween(0.15, 0.4));
            gfx.fillRect(rx, ry, Phaser.Math.Between(4, 18), Phaser.Math.Between(3, 10));
        }
        // Cracked floor lines
        gfx.lineStyle(1, def.accentColor, 0.2);
        for (let i = 0; i < 8; i++) {
            const lx = x + Phaser.Math.Between(50, w - 50);
            const ly = y + Phaser.Math.Between(80, h - 50);
            gfx.lineBetween(lx, ly, lx + Phaser.Math.Between(-60, 60), ly + Phaser.Math.Between(-30, 30));
        }
    }

    // ── Pattern: dungeon ─────────────────────────────────────────────────
    _patternDungeon(gfx, { x, y, w, h }, def) {
        // Stone floor tiles — darker checkerboard
        const tileSize = 48;
        for (let tx = x; tx < x + w; tx += tileSize) {
            for (let ty = y; ty < y + h; ty += tileSize) {
                const isAlt = ((Math.floor((tx - x) / tileSize) + Math.floor((ty - y) / tileSize)) % 2 === 0);
                gfx.fillStyle(def.accentColor, isAlt ? 0.1 : 0.06);
                gfx.fillRect(tx, ty, tileSize - 1, tileSize - 1);
            }
        }
        // Wall torch sconces (small rect + glow circle)
        const sconces = this._seededPositions(x, y, 8, w, h, 100);
        sconces.forEach(({ px, py }) => {
            gfx.fillStyle(def.accentColor, 0.5);
            gfx.fillRect(px - 3, py - 12, 6, 14);
            gfx.fillStyle(0xffaa22, 0.3);
            gfx.fillCircle(px, py - 14, 8);
        });
        // Crack lines
        gfx.lineStyle(1, def.accentColor, 0.15);
        for (let i = 0; i < 12; i++) {
            const lx = x + Phaser.Math.Between(20, w - 20);
            const ly = y + Phaser.Math.Between(40, h - 20);
            gfx.lineBetween(lx, ly, lx + Phaser.Math.Between(-40, 40), ly + Phaser.Math.Between(-20, 20));
        }
    }

    // ── Pattern: village ─────────────────────────────────────────────────
    _patternVillage(gfx, { x, y, w, h }, def) {
        // Simple house shapes: rectangle base + triangle roof
        const rng = this._seededPositions(x, y, 12, w, h, 80);
        rng.forEach(({ px, py }) => {
            const bw = Phaser.Math.Between(28, 48);
            const bh = Phaser.Math.Between(22, 36);
            const shade = Phaser.Math.FloatBetween(0.25, 0.5);
            // Building body
            gfx.fillStyle(def.accentColor, shade);
            gfx.fillRect(px - bw / 2, py - bh, bw, bh);
            // Roof
            gfx.fillStyle(def.accentColor, shade * 1.3);
            gfx.fillTriangle(px - bw / 2 - 4, py - bh, px + bw / 2 + 4, py - bh, px, py - bh - bh * 0.7);
            // Door
            gfx.fillStyle(def.bgColor, 0.7);
            gfx.fillRect(px - 4, py - 12, 8, 12);
            // Window
            gfx.fillStyle(def.lightColor, 0.2);
            gfx.fillRect(px - bw * 0.3, py - bh * 0.65, 7, 7);
        });
        // Cobblestone path: row of circles
        for (let i = 0; i < 16; i++) {
            const cx = x + 40 + i * (w / 17);
            gfx.fillStyle(def.accentColor, 0.15);
            gfx.fillCircle(cx, y + h * 0.75, 6);
        }
    }

    // ── Pattern: swamp ────────────────────────────────────────────────────
    _patternSwamp(gfx, { x, y, w, h }, def) {
        // Murky water pools (filled ellipses)
        for (let i = 0; i < 8; i++) {
            const cx = x + Phaser.Math.Between(60, w - 60);
            const cy = y + Phaser.Math.Between(80, h - 60);
            gfx.fillStyle(def.accentColor, 0.35);
            gfx.fillEllipse(cx, cy, Phaser.Math.Between(60, 130), Phaser.Math.Between(30, 60));
        }
        // Wavy water lines
        gfx.lineStyle(2, def.lightColor, 0.2);
        for (let i = 0; i < 12; i++) {
            const sy = y + Phaser.Math.Between(60, h - 40);
            const sx = x + Phaser.Math.Between(30, w * 0.3);
            gfx.beginPath();
            for (let j = 0; j < 8; j++) {
                const wx = sx + j * 20;
                const wy = sy + Math.sin(j * 1.2) * 6;
                j === 0 ? gfx.moveTo(wx, wy) : gfx.lineTo(wx, wy);
            }
            gfx.strokePath();
        }
        // Dead tree stumps
        for (let i = 0; i < 10; i++) {
            const sx = x + Phaser.Math.Between(40, w - 40);
            const sy = y + Phaser.Math.Between(70, h - 40);
            gfx.fillStyle(def.accentColor, 0.4);
            gfx.fillRect(sx - 4, sy - 20, 8, 20);
            gfx.fillRect(sx - 8, sy - 20, 6, 3);  // branch
        }
    }

    // ── Pattern: highlands ───────────────────────────────────────────────
    _patternHighlands(gfx, { x, y, w, h }, def) {
        // Rolling hill outlines (arcs across lower third)
        gfx.lineStyle(2, def.accentColor, 0.3);
        for (let i = 0; i < 5; i++) {
            const cx = x + (w / 5) * i + w * 0.1;
            const cy = y + h * 0.6 + i * 15;
            gfx.strokeArc(cx, cy + 60, Phaser.Math.Between(80, 140), Math.PI, 0, false);
        }
        // Scattered rocks
        for (let i = 0; i < 20; i++) {
            const rx = x + Phaser.Math.Between(30, w - 30);
            const ry = y + Phaser.Math.Between(60, h - 40);
            const rs = Phaser.Math.Between(4, 14);
            gfx.fillStyle(def.accentColor, Phaser.Math.FloatBetween(0.2, 0.5));
            gfx.fillEllipse(rx, ry, rs * 2, rs);
        }
        // Sparse tall grass blades
        for (let i = 0; i < 30; i++) {
            const gx = x + Phaser.Math.Between(20, w - 20);
            const gy = y + Phaser.Math.Between(60, h - 20);
            gfx.lineStyle(1, def.accentColor, Phaser.Math.FloatBetween(0.2, 0.5));
            gfx.lineBetween(gx, gy, gx + Phaser.Math.Between(-4, 4), gy - Phaser.Math.Between(8, 18));
        }
    }

    // ── Pattern: corrupted ───────────────────────────────────────────────
    _patternCorrupted(gfx, { x, y, w, h }, def) {
        // Void tendrils radiating from a centre point
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        gfx.lineStyle(2, def.accentColor, 0.5);
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const len = Phaser.Math.Between(60, 180);
            const ex = cx + Math.cos(angle) * len;
            const ey = cy + Math.sin(angle) * len;
            gfx.lineBetween(cx, cy, ex, ey);
            // Barb at tip
            gfx.fillStyle(def.accentColor, 0.4);
            gfx.fillCircle(ex, ey, 4);
        }
        // Corruption pools
        for (let i = 0; i < 6; i++) {
            const px = x + Phaser.Math.Between(60, w - 60);
            const py = y + Phaser.Math.Between(80, h - 60);
            gfx.fillStyle(def.accentColor, 0.3);
            gfx.fillCircle(px, py, Phaser.Math.Between(18, 40));
            gfx.fillStyle(def.bgColor, 0.5);
            gfx.fillCircle(px, py, Phaser.Math.Between(6, 14));
        }
        // Cracked ground veins
        gfx.lineStyle(1, def.lightColor, 0.25);
        for (let i = 0; i < 14; i++) {
            const sx = x + Phaser.Math.Between(20, w - 20);
            const sy = y + Phaser.Math.Between(40, h - 20);
            gfx.lineBetween(sx, sy, sx + Phaser.Math.Between(-70, 70), sy + Phaser.Math.Between(-40, 40));
        }
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Generate a deterministic-ish set of positions within the zone bounds,
     * given an offset seed derived from the zone origin.
     */
    _seededPositions(originX, originY, count, w, h, margin) {
        const positions = [];
        // Use zone origin to produce variation without true seeding
        const seedX = (originX * 7 + 31) % w;
        const seedY = (originY * 13 + 17) % h;
        for (let i = 0; i < count; i++) {
            const t = (i / count);
            const px = originX + margin + ((seedX + t * w * 1.618) % (w - margin * 2));
            const py = originY + margin + ((seedY + t * h * 2.414) % (h - margin * 2));
            positions.push({ px, py });
        }
        return positions;
    }

    _getZoneBounds(zoneId) {
        const zone = this.scene.zones?.find(z => z.id === zoneId);
        if (zone?.bounds) return zone.bounds;
        return null;
    }

    _clearZoneVisuals() {
        if (this.zoneGraphics) {
            this.zoneGraphics.destroy();
            this.zoneGraphics = null;
        }
        if (this.fogGraphics) {
            this.fogGraphics.destroy();
            this.fogGraphics = null;
        }
        this._decorGraphics.forEach(g => g?.destroy());
        this._decorGraphics = [];
    }
}

export default ZoneContentManager;
