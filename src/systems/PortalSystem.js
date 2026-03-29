import EventBus from '../core/EventBus.js';
import dataManager from './DataManager.js';

/**
 * PortalSystem — Manages in-world portals that appear only during the Silver Sap phase.
 *
 * One portal is placed at the center of each major zone (read from data/locations.json).
 * Portals shimmer while active. Clicking a portal emits `portal:enter`.
 * When Silver phase ends portals fade out over 2 seconds and are destroyed.
 *
 * Usage:
 *   this.portalSystem = new PortalSystem();
 *   this.portalSystem.init(scene);
 *   // in update(): this.portalSystem.update();
 */
export class PortalSystem {
    constructor() {
        this.scene = null;
        this._portals = [];          // active portal objects { gfx, zone, tween, hitZone }
        this._active = false;        // true when Silver phase is live
        this._phaseHandler = null;
        this._unsubPhase = null;
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    init(scene) {
        this.scene = scene;

        // Listen for phase transitions
        this._unsubPhase = EventBus.on('phase-changed', (newPhase, oldPhase) => {
            this._onPhaseChanged(newPhase, oldPhase);
        });

        // If the scene already started in Silver phase, spawn immediately
        if (scene.sapCycle?.currentPhase === 'silver') {
            this._spawnPortals();
        }
    }

    update() {
        // Nothing per-frame needed; tweens handle animations.
        // Overlap check is done via pointer events on hit zones.
    }

    destroy() {
        if (this._unsubPhase) {
            this._unsubPhase();
            this._unsubPhase = null;
        }
        this._destroyAllPortals(false);
    }

    // ----------------------------------------------------------------
    // Phase handling
    // ----------------------------------------------------------------

    _onPhaseChanged(newPhase /*, oldPhase */) {
        if (newPhase === 'silver') {
            this._spawnPortals();
        } else if (this._active) {
            this._fadeOutPortals();
        }
    }

    // ----------------------------------------------------------------
    // Spawning
    // ----------------------------------------------------------------

    _spawnPortals() {
        if (this._active) return;
        this._active = true;

        const locations = dataManager.getAllLocations?.() || [];
        const scene = this.scene;

        // Use the same zone layout logic as GameScene: 3 cols x N rows, 800x900 per zone
        locations.forEach((loc, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const zoneX = col * 800;
            const zoneY = row * 900;
            const zoneW = 800;
            const zoneH = 900;

            // Place portal near zone center, offset slightly so it doesn't overlap the label
            const px = zoneX + zoneW / 2;
            const py = zoneY + zoneH / 2 + 60;

            const portal = this._createPortalAt(px, py, loc);
            this._portals.push(portal);
        });

        console.log(`[PortalSystem] Spawned ${this._portals.length} portals (Silver phase)`);
    }

    _createPortalAt(x, y, loc) {
        const scene = this.scene;
        const RADIUS = 24;

        // ── Outer glow ring ──
        const glow = scene.add.graphics().setDepth(6);
        glow.lineStyle(3, 0xccddff, 0.5);
        glow.strokeCircle(x, y, RADIUS + 6);

        // ── Main portal circle ──
        const gfx = scene.add.graphics().setDepth(7);
        gfx.fillStyle(0xaaccff, 0.85);
        gfx.fillCircle(x, y, RADIUS);
        gfx.lineStyle(2, 0xffffff, 1.0);
        gfx.strokeCircle(x, y, RADIUS);

        // ── Inner shimmer ──
        const inner = scene.add.graphics().setDepth(8);
        inner.fillStyle(0xffffff, 0.4);
        inner.fillCircle(x, y, RADIUS * 0.5);

        // ── Label ──
        const label = scene.add.text(x, y - RADIUS - 14, `⬡ ${loc.name}`, {
            fontFamily: 'Open Sans',
            fontSize: '15px',
            color: '#ddeeff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(8);

        // ── Hit zone ──
        const hitZone = scene.add.zone(x, y, RADIUS * 2 + 8, RADIUS * 2 + 8)
            .setInteractive({ useHandCursor: true })
            .setDepth(9);

        hitZone.on('pointerover', () => {
            gfx.clear();
            gfx.fillStyle(0xeef6ff, 0.95);
            gfx.fillCircle(x, y, RADIUS);
            gfx.lineStyle(2, 0xffffff, 1.0);
            gfx.strokeCircle(x, y, RADIUS);
        });
        hitZone.on('pointerout', () => {
            gfx.clear();
            gfx.fillStyle(0xaaccff, 0.85);
            gfx.fillCircle(x, y, RADIUS);
            gfx.lineStyle(2, 0xffffff, 1.0);
            gfx.strokeCircle(x, y, RADIUS);
        });
        hitZone.on('pointerdown', () => {
            if (this._active) {
                EventBus.emit('portal:enter', {
                    destinationZoneId: loc.id,
                    portalId: `portal_${loc.id}`
                });
            }
        });

        // ── Shimmer tween on gfx container ──
        const tween = scene.tweens.add({
            targets: [gfx, glow, inner],
            alpha: { from: 0.6, to: 1.0 },
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Fade in on spawn
        [gfx, glow, inner, label].forEach(obj => obj.setAlpha(0));
        scene.tweens.add({
            targets: [gfx, glow, inner, label],
            alpha: 1,
            duration: 800,
            ease: 'Cubic.easeOut'
        });

        return { gfx, glow, inner, label, hitZone, tween, loc };
    }

    // ----------------------------------------------------------------
    // Despawning
    // ----------------------------------------------------------------

    _fadeOutPortals() {
        const scene = this.scene;
        if (!scene) {
            this._destroyAllPortals(false);
            return;
        }

        const targets = [];
        for (const p of this._portals) {
            targets.push(p.gfx, p.glow, p.inner, p.label);
            // Disable interaction immediately
            p.hitZone.disableInteractive();
        }

        if (targets.length === 0) {
            this._destroyAllPortals(false);
            return;
        }

        scene.tweens.add({
            targets,
            alpha: 0,
            duration: 2000,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this._destroyAllPortals(false);
            }
        });

        // Mark inactive so clicks are ignored during fade
        this._active = false;
    }

    _destroyAllPortals(alsoMarkInactive = true) {
        for (const p of this._portals) {
            if (p.tween) p.tween.remove();
            if (p.gfx?.active) p.gfx.destroy();
            if (p.glow?.active) p.glow.destroy();
            if (p.inner?.active) p.inner.destroy();
            if (p.label?.active) p.label.destroy();
            if (p.hitZone?.active) p.hitZone.destroy();
        }
        this._portals = [];
        if (alsoMarkInactive) this._active = false;
    }
}

export default PortalSystem;
