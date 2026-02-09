/**
 * GameScene.js
 * Main gameplay scene for "Realm of Nexus" — a 2D tactical RPG.
 * Manages player input, subsystem orchestration, and the core game loop.
 */

import DataManager from '../systems/DataManager.js';
import AdvancedLightingSystem from '../systems/AdvancedLightingSystem.js';
import AdvancedParticleSystem from '../systems/AdvancedParticleSystem.js';
import CinematicCameraSystem from '../systems/CinematicCameraSystem.js';
import PerformanceProfiler from '../systems/PerformanceProfiler.js';
import SapCycleManager from '../systems/SapCycleManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Subsystem references (initialized in create)
        this.dataManager = null;
        this.lightingSystem = null;
        this.particleSystem = null;
        this.cameraSystem = null;
        this.profiler = null;
        this.sapCycleManager = null;

        // Player reference
        this.player = null;

        // Input reference
        this.cursors = null;

        // Movement speed in pixels per second
        this.playerSpeed = 200;

        // Whether the profiler overlay is visible
        this.profilerVisible = false;
    }

    // ----------------------------------------------------------------
    // Phaser lifecycle
    // ----------------------------------------------------------------

    /**
     * Called once when the scene is first created.
     * Loads data, boots every subsystem, and sets up input + player.
     */
    create() {
        // ---- Data loading ----
        this.dataManager = new DataManager(this);
        this.dataManager.load();

        // ---- Subsystem initialization ----
        this.lightingSystem = new AdvancedLightingSystem(this);
        this.particleSystem = new AdvancedParticleSystem(this);
        this.cameraSystem = new CinematicCameraSystem(this);
        this.profiler = new PerformanceProfiler(this);
        this.sapCycleManager = new SapCycleManager(this);

        // ---- Hot-reload support (debug builds only) ----
        this.enableHotReload();

        // ---- Input ----
        this.cursors = this.input.keyboard.createCursorKeys();

        // F2 toggles the performance profiler overlay
        this.input.keyboard.on('keydown-F2', () => {
            this.toggleProfiler();
        });

        // ---- Player placeholder ----
        // A simple colored rectangle representing the player until real
        // sprites are loaded from the asset pipeline.
        this.player = this.add.rectangle(200, 400, 32, 48, 0x3399ff);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        // Let the cinematic camera follow the player
        this.cameraSystem.follow(this.player);

        console.log('[GameScene] Scene created successfully.');
    }

    /**
     * Core game loop — called every frame.
     * @param {number} time  - Total elapsed time in ms.
     * @param {number} delta - Time since last frame in ms.
     */
    update(time, delta) {
        // ---- Player movement ----
        this.handlePlayerMovement();

        // ---- Subsystem updates ----
        this.lightingSystem.update(time, delta);
        this.particleSystem.update(time, delta);
        this.cameraSystem.update(time, delta);
        this.sapCycleManager.update(time, delta);

        // ---- Profiler (always updated so it can track even when hidden) ----
        this.profiler.update(time, delta);
    }

    // ----------------------------------------------------------------
    // Player movement
    // ----------------------------------------------------------------

    /**
     * Reads cursor-key state and applies velocity to the player body.
     */
    handlePlayerMovement() {
        const body = this.player.body;
        body.setVelocity(0);

        // Horizontal
        if (this.cursors.left.isDown) {
            body.setVelocityX(-this.playerSpeed);
        } else if (this.cursors.right.isDown) {
            body.setVelocityX(this.playerSpeed);
        }

        // Vertical
        if (this.cursors.up.isDown) {
            body.setVelocityY(-this.playerSpeed);
        } else if (this.cursors.down.isDown) {
            body.setVelocityY(this.playerSpeed);
        }

        // Normalize diagonal movement so it isn't faster than cardinal
        if (body.velocity.x !== 0 && body.velocity.y !== 0) {
            body.velocity.normalize().scale(this.playerSpeed);
        }
    }

    // ----------------------------------------------------------------
    // Profiler
    // ----------------------------------------------------------------

    /**
     * Toggles the performance profiler overlay on or off.
     */
    toggleProfiler() {
        this.profilerVisible = !this.profilerVisible;

        if (this.profilerVisible) {
            this.profiler.show();
            console.log('[GameScene] Profiler enabled.');
        } else {
            this.profiler.hide();
            console.log('[GameScene] Profiler disabled.');
        }
    }

    // ----------------------------------------------------------------
    // Hot-reload (debug only)
    // ----------------------------------------------------------------

    /**
     * When running in a development environment that supports HMR,
     * listen for module-replacement events and restart the scene
     * so changes are reflected immediately.
     */
    enableHotReload() {
        // Only activate when a bundler exposes import.meta.hot (Vite)
        // or module.hot (Webpack). Wrapped in try/catch so it is
        // harmless in production builds where these APIs do not exist.
        try {
            if (import.meta.hot) {
                import.meta.hot.accept(() => {
                    console.log('[GameScene] Hot-reload triggered — restarting scene.');
                    this.scene.restart();
                });
            }
        } catch (_) {
            // Not in a hot-reload-capable environment — nothing to do.
        }
    }
}
