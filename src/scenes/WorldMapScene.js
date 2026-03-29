import EventBus from '../core/EventBus.js';

/**
 * WorldMapScene — Full-screen world map overlay.
 *
 * Launched over GameScene via `this.scene.launch('WorldMapScene', { currentZone })`.
 * Draws all locations from locations.json as interactive nodes connected by edges.
 * Press M or Escape to close. Click a node to emit worldmap:travelTo.
 */
export default class WorldMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WorldMapScene' });
    }

    init(data) {
        this._currentZone = data?.currentZone || 'canopy_of_life';
        this._tooltip = null;
        this._tooltipBg = null;
        this._pulseTargets = [];
    }

    create() {
        const W = 1280;
        const H = 720;

        // ── Overlay ──────────────────────────────────────────────────────
        const overlay = this.add.graphics().setDepth(500).setScrollFactor(0);
        overlay.fillStyle(0x0a0a18, 0.95);
        overlay.fillRect(0, 0, W, H);

        // Subtle grid lines for atmosphere
        const grid = this.add.graphics().setDepth(501).setScrollFactor(0);
        grid.lineStyle(1, 0x1a1a3a, 0.4);
        for (let x = 0; x < W; x += 80) grid.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 60) grid.lineBetween(0, y, W, y);

        // ── Title ─────────────────────────────────────────────────────────
        this.add.text(W / 2, 32, 'THE VERDANCE', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#d4a843',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 0, offsetY: 2, color: '#8a6010', blur: 6, fill: true }
        }).setOrigin(0.5, 0).setDepth(510).setScrollFactor(0);

        this.add.text(W / 2, 72, 'WORLD MAP', {
            fontFamily: 'Georgia, serif',
            fontSize: '14px',
            color: '#7aaccf',
            letterSpacing: 6
        }).setOrigin(0.5, 0).setDepth(510).setScrollFactor(0);

        // Decorative title divider
        const divGfx = this.add.graphics().setDepth(510).setScrollFactor(0);
        divGfx.lineStyle(1, 0xd4a843, 0.5);
        divGfx.lineBetween(W / 2 - 200, 96, W / 2 + 200, 96);

        // ── Location data ─────────────────────────────────────────────────
        // Positions are hand-tuned for a geographic layout across 1280×720.
        // Map area: roughly x=80–1200, y=110–620.
        const LOCATIONS = this._buildLocationData();

        // ── Connection lines ──────────────────────────────────────────────
        const lineGfx = this.add.graphics().setDepth(503).setScrollFactor(0);
        this._drawConnections(lineGfx, LOCATIONS);

        // ── Zone nodes ────────────────────────────────────────────────────
        LOCATIONS.forEach(loc => this._createNode(loc, LOCATIONS));

        // ── Legend ────────────────────────────────────────────────────────
        this._buildLegend(W, H);

        // ── Close button ─────────────────────────────────────────────────
        this._buildCloseButton(W);

        // ── Tooltip container (built once, hidden by default) ─────────────
        this._tooltipBg = this.add.graphics().setDepth(530).setScrollFactor(0);
        this._tooltip = this.add.text(0, 0, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '13px',
            color: '#e0e8f0',
            wordWrap: { width: 240 },
            lineSpacing: 4
        }).setDepth(531).setScrollFactor(0).setVisible(false);

        // ── Input ─────────────────────────────────────────────────────────
        this.input.keyboard.on('keydown-M',   () => this._close());
        this.input.keyboard.on('keydown-ESC', () => this._close());

        // Stop propagation so GameScene doesn't open PauseMenu while map is open
        this.input.keyboard.on('keydown-ESC', (evt) => { evt.stopPropagation?.(); }, this, 0);
    }

    // ── Build structured location list with map positions ─────────────────
    _buildLocationData() {
        // Zone-type color map
        const TYPE_COLORS = {
            hub:                 0x4a7a9b,
            market:              0x4a7a9b,
            military:            0x7a4a2d,
            temple:              0x2d6a4a,
            grove:               0x2d6a2d,
            dungeon:             0x6a2d2d,
            underground_city:    0x3a3a6a,
            hidden:              0x4a2d6a,
            exploration:         0x2d6a2d,
            laboratory:          0x3a5a3a,
            lore_site:           0x5a4a7a,
            military_outpost:    0x7a5a2d,
            training:            0x5a4a2d,
            nature_reserve:      0x2d7a5a,
            ruins:               0x6a4a2d,
            corrupted:           0x5a1a1a,
            boss_arena:          0x6a1a1a,
            endgame:             0x1a1a5a,
            default:             0x3a3a5a
        };

        // Geographic layout — placed to roughly reflect in-world geography.
        // Central hub cluster top-center, wildlands to the left, underground below center,
        // corrupted/endgame zones to the bottom-right.
        const rawPositions = {
            canopy_of_life:              { x: 640, y: 200 },
            verdant_exchange:            { x: 580, y: 260 },
            bloomguard_barracks:         { x: 700, y: 260 },
            emerald_sanctum:             { x: 620, y: 310 },
            whispering_veil:             { x: 660, y: 310 },
            hollowroot_catacombs:        { x: 590, y: 380 },
            spindlewood_forest:          { x: 360, y: 240 },
            mycelium_nexus:              { x: 580, y: 450 },
            thornbinder_safehouse:       { x: 260, y: 310 },
            emerald_cascades:            { x: 820, y: 270 },
            glinting_groves:             { x: 450, y: 200 },
            thornbinder_training_grounds:{ x: 300, y: 210 },
            wildkin_hunting_grounds:     { x: 240, y: 270 },
            sporecaller_labs:            { x: 620, y: 510 },
            veil_echo_chamber:           { x: 870, y: 360 },
            abyss_forward_camp:          { x: 920, y: 300 },
            hollow_tree_grove:           { x: 860, y: 450 },
            corruption_quarantine_zone:  { x: 740, y: 500 },
            sapling_plantation:          { x: 500, y: 160 },
            ancient_unbinding_site:      { x: 960, y: 420 },
            veil_tear_rift_alpha:        { x: 1000, y: 340 },
            veil_tear_rift_beta:         { x: 1060, y: 410 },
            veil_tear_rift_gamma:        { x: 1100, y: 480 },
            the_scar:                    { x: 1050, y: 290 },
            everwood_heart:              { x: 640, y: 580 },
            void_nexus:                  { x: 1140, y: 560 },
            canopy_overlook:             { x: 700, y: 140 },
        };

        // Connections derived from locations.json
        const rawConnections = {
            canopy_of_life:              ['hollowroot_catacombs','spindlewood_forest','emerald_cascades','glinting_groves','mycelium_nexus','sapling_plantation','canopy_overlook'],
            verdant_exchange:            ['canopy_of_life'],
            bloomguard_barracks:         ['canopy_of_life'],
            emerald_sanctum:             ['canopy_of_life'],
            whispering_veil:             ['canopy_of_life'],
            hollowroot_catacombs:        ['canopy_of_life','mycelium_nexus'],
            spindlewood_forest:          ['canopy_of_life','wildkin_hunting_grounds','thornbinder_training_grounds','glinting_groves','thornbinder_safehouse'],
            mycelium_nexus:              ['hollowroot_catacombs','canopy_of_life','sporecaller_labs','corruption_quarantine_zone'],
            thornbinder_safehouse:       ['thornbinder_training_grounds','spindlewood_forest'],
            emerald_cascades:            ['canopy_of_life','veil_echo_chamber','abyss_forward_camp','veil_tear_rift_alpha'],
            glinting_groves:             ['canopy_of_life','spindlewood_forest','sapling_plantation'],
            thornbinder_training_grounds:['thornbinder_safehouse','spindlewood_forest','wildkin_hunting_grounds'],
            wildkin_hunting_grounds:     ['spindlewood_forest','thornbinder_training_grounds','hollow_tree_grove'],
            sporecaller_labs:            ['mycelium_nexus','corruption_quarantine_zone'],
            veil_echo_chamber:           ['emerald_cascades','ancient_unbinding_site'],
            abyss_forward_camp:          ['emerald_cascades','hollow_tree_grove','corruption_quarantine_zone','the_scar'],
            hollow_tree_grove:           ['abyss_forward_camp','wildkin_hunting_grounds','corruption_quarantine_zone','ancient_unbinding_site'],
            corruption_quarantine_zone:  ['abyss_forward_camp','hollow_tree_grove','mycelium_nexus','sporecaller_labs'],
            sapling_plantation:          ['canopy_of_life','glinting_groves'],
            ancient_unbinding_site:      ['veil_echo_chamber','hollow_tree_grove'],
            veil_tear_rift_alpha:        ['emerald_cascades','veil_tear_rift_beta'],
            veil_tear_rift_beta:         ['veil_tear_rift_alpha','veil_tear_rift_gamma'],
            veil_tear_rift_gamma:        ['veil_tear_rift_beta','void_nexus'],
            the_scar:                    ['abyss_forward_camp'],
            everwood_heart:              ['mycelium_nexus'],
            void_nexus:                  ['veil_tear_rift_gamma'],
            canopy_overlook:             ['canopy_of_life'],
        };

        const rawTypes = {
            canopy_of_life: 'hub', verdant_exchange: 'market', bloomguard_barracks: 'military',
            emerald_sanctum: 'temple', whispering_veil: 'grove', hollowroot_catacombs: 'dungeon',
            spindlewood_forest: 'exploration', mycelium_nexus: 'underground_city',
            thornbinder_safehouse: 'hidden', emerald_cascades: 'nature_reserve',
            glinting_groves: 'exploration', thornbinder_training_grounds: 'training',
            wildkin_hunting_grounds: 'exploration', sporecaller_labs: 'laboratory',
            veil_echo_chamber: 'lore_site', abyss_forward_camp: 'military_outpost',
            hollow_tree_grove: 'dungeon', corruption_quarantine_zone: 'corrupted',
            sapling_plantation: 'exploration', ancient_unbinding_site: 'ruins',
            veil_tear_rift_alpha: 'dungeon', veil_tear_rift_beta: 'dungeon',
            veil_tear_rift_gamma: 'dungeon', the_scar: 'boss_arena',
            everwood_heart: 'endgame', void_nexus: 'endgame', canopy_overlook: 'exploration',
        };

        const rawNames = {
            canopy_of_life: 'Canopy of Life', verdant_exchange: 'Verdant Exchange',
            bloomguard_barracks: 'Bloomguard Barracks', emerald_sanctum: 'Emerald Sanctum',
            whispering_veil: 'Whispering Veil', hollowroot_catacombs: 'Hollowroot Catacombs',
            spindlewood_forest: 'Spindlewood Forest', mycelium_nexus: 'Mycelium Nexus',
            thornbinder_safehouse: 'Thornbinder Safehouse', emerald_cascades: 'Emerald Cascades',
            glinting_groves: 'Glinting Groves', thornbinder_training_grounds: 'Thornbinder Training Grounds',
            wildkin_hunting_grounds: 'Wildkin Hunting Grounds', sporecaller_labs: 'Sporecaller Labs',
            veil_echo_chamber: 'Veil Echo Chamber', abyss_forward_camp: 'Abyss Forward Camp',
            hollow_tree_grove: 'Hollow Tree Grove', corruption_quarantine_zone: 'Corruption Quarantine Zone',
            sapling_plantation: 'Sapling Plantation', ancient_unbinding_site: 'Ancient Unbinding Site',
            veil_tear_rift_alpha: 'Veil Tear Rift α', veil_tear_rift_beta: 'Veil Tear Rift β',
            veil_tear_rift_gamma: 'Veil Tear Rift γ', the_scar: 'The Scar',
            everwood_heart: 'Everwood Heart', void_nexus: 'Void Nexus',
            canopy_overlook: 'Canopy Overlook',
        };

        const rawDescriptions = {
            canopy_of_life: 'The great tree-city of Verdance. Heart of civilization, home to all factions.',
            verdant_exchange: 'A bustling marketplace beneath the Canopy\'s lower branches.',
            bloomguard_barracks: 'The Bloomguard\'s fortress. Training grounds ring with the clash of weapons.',
            emerald_sanctum: 'The Emerald Coven\'s sacred temple. Pools of pure Blue Sap offer magical services.',
            whispering_veil: 'A grove of ancient silvered trees where the Veilkeepers reside.',
            hollowroot_catacombs: 'A labyrinth of roots beneath the Canopy. The first Abyss breach opened here.',
            spindlewood_forest: 'A forest of impossibly thin, spiraling trees with ever-shifting light.',
            mycelium_nexus: 'An underground network of massive mushrooms — a second city below ground.',
            thornbinder_safehouse: 'A concealed network of treehouses. The Thornbinders\' center of operations.',
            emerald_cascades: 'Waterfalls of pure Blue Sap cascade down ancient stone. The finest DSP recovery site.',
            glinting_groves: 'A grove where crystallized Sap grows from every surface, refracting prismatic light.',
            thornbinder_training_grounds: 'Hidden obstacle courses where Thornbinders hone their stealth and combat.',
            wildkin_hunting_grounds: 'Vast untamed woodlands. Beast companions can be found and bonded here.',
            sporecaller_labs: 'A sprawling complex where Sporecallers experiment with spores and the boundary of life.',
            veil_echo_chamber: 'A resonating cavern where echoes of the Veil manifest as ghostly visions.',
            abyss_forward_camp: 'The Bloomguard\'s last military outpost before the corrupted lands.',
            hollow_tree_grove: 'Ancient petrified trees consumed by Abyss corruption. The Corrupted Elder lurks within.',
            corruption_quarantine_zone: 'Sealed off sections of the underground, quarantined against spreading corruption.',
            sapling_plantation: 'Carefully tended groves where the Sapling Consortium grows new Verdance trees.',
            ancient_unbinding_site: 'The location of the Great Unbinding. Reality is thin here.',
            veil_tear_rift_alpha: 'A rift in the Veil. Unstable and dangerous — first of three.',
            veil_tear_rift_beta: 'Second Veil rift, deeper and more chaotic than the first.',
            veil_tear_rift_gamma: 'Third Veil rift, trembling on the edge of the Void.',
            the_scar: 'A wound in the world where the Abyss first broke through. Nothing heals here.',
            everwood_heart: 'The mythical heart of the World-Sapling. The source of all Blue Sap.',
            void_nexus: 'The Abyss given form. The final confrontation awaits.',
            canopy_overlook: 'A high platform above the Canopy with a panoramic view of all Verdance.',
        };

        return Object.keys(rawPositions).map(id => ({
            id,
            name: rawNames[id] || id,
            description: rawDescriptions[id] || '',
            type: rawTypes[id] || 'default',
            color: TYPE_COLORS[rawTypes[id]] ?? TYPE_COLORS.default,
            x: rawPositions[id].x,
            y: rawPositions[id].y,
            connections: rawConnections[id] || [],
        }));
    }

    // ── Draw connection lines between linked zones ─────────────────────────
    _drawConnections(gfx, locations) {
        const posMap = {};
        locations.forEach(loc => { posMap[loc.id] = { x: loc.x, y: loc.y }; });

        const drawn = new Set();
        locations.forEach(loc => {
            loc.connections.forEach(targetId => {
                const key = [loc.id, targetId].sort().join('|');
                if (drawn.has(key)) return;
                drawn.add(key);
                const to = posMap[targetId];
                if (!to) return;

                // Corrupted/endgame links get a reddish tint
                const isCorrupted = ['void_nexus','the_scar','corruption_quarantine_zone','hollow_tree_grove'].includes(loc.id)
                    || ['void_nexus','the_scar','corruption_quarantine_zone','hollow_tree_grove'].includes(targetId);
                gfx.lineStyle(1.5, isCorrupted ? 0x8a2020 : 0x3a5a7a, 0.55);
                gfx.lineBetween(loc.x, loc.y, to.x, to.y);
            });
        });
    }

    // ── Create a single interactive zone node ─────────────────────────────
    _createNode(loc, allLocations) {
        const RADIUS = 28;
        const isCurrent = loc.id === this._currentZone;
        const isEndgame = ['void_nexus', 'everwood_heart', 'the_scar'].includes(loc.id);

        // Node circle
        const nodeGfx = this.add.graphics().setDepth(505).setScrollFactor(0);
        this._drawNodeCircle(nodeGfx, loc, RADIUS, isCurrent);

        // Pulsing ring for current zone
        if (isCurrent) {
            const ringGfx = this.add.graphics().setDepth(506).setScrollFactor(0);
            this._drawRing(ringGfx, loc.x, loc.y, RADIUS + 6, 0xffffff, 0.8);
            this.tweens.add({
                targets: ringGfx,
                scaleX: 1.3,
                scaleY: 1.3,
                alpha: 0.3,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            // Keep ring centered on the node origin
            ringGfx.x = loc.x;
            ringGfx.y = loc.y;
        }

        // Zone name label
        const labelStyle = {
            fontFamily: 'Georgia, serif',
            fontSize: isEndgame ? '10px' : '11px',
            color: isCurrent ? '#ffd700' : '#c8d8e8',
            stroke: '#050510',
            strokeThickness: 3,
            align: 'center',
        };
        const label = this.add.text(loc.x, loc.y + RADIUS + 7, loc.name, labelStyle)
            .setOrigin(0.5, 0).setDepth(508).setScrollFactor(0);

        // "YOU ARE HERE" indicator
        if (isCurrent) {
            this.add.text(loc.x, loc.y - RADIUS - 16, '▼ HERE', {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5, 1).setDepth(508).setScrollFactor(0);
        }

        // Interactive hit zone
        const hitZone = this.add.zone(loc.x, loc.y, RADIUS * 2 + 10, RADIUS * 2 + 10)
            .setInteractive({ useHandCursor: true })
            .setDepth(509)
            .setScrollFactor(0);

        hitZone.on('pointerover', (pointer) => {
            this._showTooltip(loc, pointer);
            // Brighten node on hover
            nodeGfx.clear();
            this._drawNodeCircle(nodeGfx, loc, RADIUS, isCurrent, true);
            label.setStyle({ ...labelStyle, color: '#ffffff' });
        });

        hitZone.on('pointermove', (pointer) => {
            this._moveTooltip(pointer);
        });

        hitZone.on('pointerout', () => {
            this._hideTooltip();
            nodeGfx.clear();
            this._drawNodeCircle(nodeGfx, loc, RADIUS, isCurrent, false);
            label.setStyle(labelStyle);
        });

        hitZone.on('pointerdown', () => {
            this._travelTo(loc.id);
        });
    }

    _drawNodeCircle(gfx, loc, radius, isCurrent, hovered = false) {
        const alpha = hovered ? 1.0 : 0.85;
        const borderColor = isCurrent ? 0xffd700 : (hovered ? 0x88ccff : 0x6688aa);
        const borderWidth = isCurrent ? 3 : 2;
        const fillColor = hovered ? this._lighten(loc.color) : loc.color;

        gfx.fillStyle(fillColor, alpha);
        gfx.fillCircle(loc.x, loc.y, radius);
        gfx.lineStyle(borderWidth, borderColor, 1.0);
        gfx.strokeCircle(loc.x, loc.y, radius);

        // Small type icon — a simple symbol in the circle
        const iconColor = this._contrastColor(loc.color);
        gfx.fillStyle(iconColor, 0.4);
        gfx.fillCircle(loc.x, loc.y, 8);
    }

    _drawRing(gfx, cx, cy, radius, color, alpha) {
        gfx.lineStyle(2, color, alpha);
        gfx.strokeCircle(0, 0, radius); // drawn at origin, then positioned via .x/.y
    }

    _lighten(color) {
        const r = Math.min(255, ((color >> 16) & 0xff) + 40);
        const g = Math.min(255, ((color >> 8) & 0xff) + 40);
        const b = Math.min(255, (color & 0xff) + 40);
        return (r << 16) | (g << 8) | b;
    }

    _contrastColor(bg) {
        const r = (bg >> 16) & 0xff;
        const g = (bg >> 8) & 0xff;
        const b = bg & 0xff;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 128 ? 0x000000 : 0xffffff;
    }

    // ── Tooltip ───────────────────────────────────────────────────────────
    _showTooltip(loc, pointer) {
        const lines = [
            loc.name,
            `[${loc.type.replace(/_/g, ' ').toUpperCase()}]`,
            '',
            loc.description,
        ];
        this._tooltip.setText(lines.join('\n')).setVisible(true);
        this._moveTooltip(pointer);
    }

    _moveTooltip(pointer) {
        if (!this._tooltip?.visible) return;
        const PAD = 10;
        const TW = this._tooltip.width + PAD * 2;
        const TH = this._tooltip.height + PAD * 2;
        let tx = pointer.x + 16;
        let ty = pointer.y + 16;
        if (tx + TW > 1270) tx = pointer.x - TW - 6;
        if (ty + TH > 710) ty = pointer.y - TH - 6;

        this._tooltip.setPosition(tx + PAD, ty + PAD);

        this._tooltipBg.clear();
        this._tooltipBg.fillStyle(0x08081a, 0.92);
        this._tooltipBg.fillRoundedRect(tx, ty, TW, TH, 6);
        this._tooltipBg.lineStyle(1, 0xd4a843, 0.7);
        this._tooltipBg.strokeRoundedRect(tx, ty, TW, TH, 6);
    }

    _hideTooltip() {
        this._tooltip?.setVisible(false);
        this._tooltipBg?.clear();
    }

    // ── Legend ────────────────────────────────────────────────────────────
    _buildLegend(W, H) {
        const entries = [
            { label: 'Hub / Market',      color: 0x4a7a9b },
            { label: 'Forest / Grove',    color: 0x2d6a2d },
            { label: 'Dungeon',           color: 0x6a2d2d },
            { label: 'Underground',       color: 0x3a3a6a },
            { label: 'Military',          color: 0x7a4a2d },
            { label: 'Corrupted / Rift',  color: 0x5a1a1a },
            { label: 'Lore Site',         color: 0x5a4a7a },
            { label: 'Nature Reserve',    color: 0x2d7a5a },
        ];

        const LX = 24;
        const LY = H - 16 - entries.length * 20 - 14;

        this.add.text(LX, LY, 'LEGEND', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#d4a843',
            letterSpacing: 2
        }).setDepth(510).setScrollFactor(0);

        const legendGfx = this.add.graphics().setDepth(510).setScrollFactor(0);
        entries.forEach((entry, i) => {
            const ey = LY + 14 + i * 20;
            legendGfx.fillStyle(entry.color, 0.9);
            legendGfx.fillRect(LX, ey + 2, 12, 12);
            legendGfx.lineStyle(1, 0x6688aa, 0.6);
            legendGfx.strokeRect(LX, ey + 2, 12, 12);
            this.add.text(LX + 18, ey + 2, entry.label, {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#99aabb',
            }).setDepth(511).setScrollFactor(0);
        });

        // Current zone indicator in legend footer
        this.add.text(LX, H - 14, `Current zone: ${this._currentZone.replace(/_/g, ' ')}`, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffd700',
        }).setDepth(511).setScrollFactor(0);
    }

    // ── Close button ──────────────────────────────────────────────────────
    _buildCloseButton(W) {
        const BTN_W = 88, BTN_H = 28;
        const bx = W - BTN_W - 16;
        const by = 16;

        const btnGfx = this.add.graphics().setDepth(520).setScrollFactor(0);
        const drawBtn = (hovered) => {
            btnGfx.clear();
            btnGfx.fillStyle(hovered ? 0x662222 : 0x441414, 0.9);
            btnGfx.fillRoundedRect(bx, by, BTN_W, BTN_H, 5);
            btnGfx.lineStyle(1.5, hovered ? 0xff6666 : 0xaa4444, 0.9);
            btnGfx.strokeRoundedRect(bx, by, BTN_W, BTN_H, 5);
        };
        drawBtn(false);

        this.add.text(bx + BTN_W / 2, by + BTN_H / 2, '✕  CLOSE', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffaaaa',
        }).setOrigin(0.5).setDepth(521).setScrollFactor(0);

        const hitBtn = this.add.zone(bx + BTN_W / 2, by + BTN_H / 2, BTN_W, BTN_H)
            .setInteractive({ useHandCursor: true })
            .setDepth(522)
            .setScrollFactor(0);
        hitBtn.on('pointerover', () => drawBtn(true));
        hitBtn.on('pointerout',  () => drawBtn(false));
        hitBtn.on('pointerdown', () => this._close());

        // Hint text
        this.add.text(W - 16, by + BTN_H + 8, 'M / ESC to close', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#445566',
        }).setOrigin(1, 0).setDepth(510).setScrollFactor(0);
    }

    // ── Actions ───────────────────────────────────────────────────────────
    _travelTo(locationId) {
        EventBus.emit('worldmap:travelTo', { locationId });
        this._close();
    }

    _close() {
        this.scene.stop();
    }
}
