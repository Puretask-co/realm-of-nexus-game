import EventBus from './EventBus.js';

/**
 * Real-time performance profiler for the Verdance engine.
 *
 * Tracks:
 *  - FPS (current, min, max, average over rolling window)
 *  - Frame time breakdown by system (update, render, physics, etc.)
 *  - Memory usage (JS heap if available)
 *  - Draw calls / game object count
 *  - Custom named timers for any code section
 *  - History buffer for charting (last N frames)
 *
 * The profiler overlay can be toggled at runtime with F3.
 * It renders as a Phaser Graphics overlay so it works without DOM.
 *
 * Usage:
 *   profiler.begin('combat');
 *   // ... combat update ...
 *   profiler.end('combat');
 *
 * Integration:
 *   Listens to EventBus 'profiler-toggle' to show/hide.
 *   Emits 'profiler-snapshot' each second with aggregated data.
 */
export default class PerformanceProfiler {
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;
        this.overlayVisible = false;

        // Rolling metrics
        this.historySize = 120; // ~2 seconds at 60fps
        this.fpsHistory = [];
        this.frameTimeHistory = [];

        // Per-system timers
        this.timers = {};
        this.timerHistory = {};

        // Aggregate stats
        this.stats = {
            fps: 0,
            fpsMin: Infinity,
            fpsMax: 0,
            fpsAvg: 0,
            frameTime: 0,
            frameTimeMax: 0,
            drawCalls: 0,
            gameObjects: 0,
            memoryUsed: 0,
            memoryLimit: 0,
            lightsActive: 0,
            particlesActive: 0
        };

        // Snapshot interval
        this._snapshotInterval = 1000;
        this._snapshotTimer = 0;
        this._frameCount = 0;

        // Active timer tracking
        this._activeTimers = {};

        // Overlay graphics
        this._overlayGfx = null;
        this._overlayTexts = [];

        // Hotkey
        if (scene.input && scene.input.keyboard) {
            scene.input.keyboard.on('keydown-F3', () => {
                this.toggleOverlay();
            });
        }

        EventBus.on('profiler-toggle', () => this.toggleOverlay());
    }

    // ----------------------------------------------------------------
    // Timer API
    // ----------------------------------------------------------------

    /**
     * Start timing a named section.
     */
    begin(name) {
        if (!this.enabled) return;
        this._activeTimers[name] = performance.now();
    }

    /**
     * End timing a named section and record the duration.
     */
    end(name) {
        if (!this.enabled || !this._activeTimers[name]) return;
        const elapsed = performance.now() - this._activeTimers[name];
        delete this._activeTimers[name];

        if (!this.timers[name]) {
            this.timers[name] = { total: 0, count: 0, max: 0, last: 0 };
        }

        const t = this.timers[name];
        t.last = elapsed;
        t.total += elapsed;
        t.count++;
        t.max = Math.max(t.max, elapsed);

        // History
        if (!this.timerHistory[name]) {
            this.timerHistory[name] = [];
        }
        this.timerHistory[name].push(elapsed);
        if (this.timerHistory[name].length > this.historySize) {
            this.timerHistory[name].shift();
        }
    }

    /**
     * Convenience: wrap a function call with timing.
     */
    measure(name, fn) {
        this.begin(name);
        const result = fn();
        this.end(name);
        return result;
    }

    // ----------------------------------------------------------------
    // Per-frame update
    // ----------------------------------------------------------------

    update(delta) {
        if (!this.enabled) return;

        this._frameCount++;
        const fps = Math.round(1000 / Math.max(delta, 1));
        const frameTime = delta;

        // Rolling history
        this.fpsHistory.push(fps);
        this.frameTimeHistory.push(frameTime);
        if (this.fpsHistory.length > this.historySize) this.fpsHistory.shift();
        if (this.frameTimeHistory.length > this.historySize) this.frameTimeHistory.shift();

        // Current stats
        this.stats.fps = fps;
        this.stats.frameTime = frameTime;
        this.stats.fpsMin = Math.min(this.stats.fpsMin, fps);
        this.stats.fpsMax = Math.max(this.stats.fpsMax, fps);
        this.stats.frameTimeMax = Math.max(this.stats.frameTimeMax, frameTime);

        // Average FPS over window
        if (this.fpsHistory.length > 0) {
            const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
            this.stats.fpsAvg = Math.round(sum / this.fpsHistory.length);
        }

        // Game objects count
        if (this.scene.children) {
            this.stats.gameObjects = this.scene.children.length;
        }

        // Memory (Chrome only)
        if (performance.memory) {
            this.stats.memoryUsed = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            this.stats.memoryLimit = Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
        }

        // Snapshot broadcast
        this._snapshotTimer += delta;
        if (this._snapshotTimer >= this._snapshotInterval) {
            this._snapshotTimer = 0;
            this._emitSnapshot();
        }

        // Update overlay
        if (this.overlayVisible) {
            this._renderOverlay();
        }
    }

    // ----------------------------------------------------------------
    // Overlay
    // ----------------------------------------------------------------

    toggleOverlay() {
        this.overlayVisible = !this.overlayVisible;
        if (!this.overlayVisible) {
            this._destroyOverlay();
        }
    }

    _renderOverlay() {
        if (!this._overlayGfx) {
            this._overlayGfx = this.scene.add.graphics().setDepth(99999).setScrollFactor(0);
        }
        this._overlayTexts.forEach((t) => t.destroy());
        this._overlayTexts = [];

        const g = this._overlayGfx;
        g.clear();

        // Background panel
        const panelX = 8;
        const panelY = 50;
        const panelW = 260;
        const panelH = 200 + Object.keys(this.timers).length * 16;

        g.fillStyle(0x000000, 0.75);
        g.fillRect(panelX, panelY, panelW, panelH);
        g.lineStyle(1, 0x44ff44, 0.4);
        g.strokeRect(panelX, panelY, panelW, panelH);

        let y = panelY + 8;
        const addLine = (text, color = '#44ff44') => {
            const t = this.scene.add.text(panelX + 8, y, text, {
                fontFamily: 'monospace', fontSize: '11px', color,
                stroke: '#000', strokeThickness: 1
            }).setDepth(100000).setScrollFactor(0);
            this._overlayTexts.push(t);
            y += 14;
        };

        addLine('=== PERFORMANCE PROFILER ===', '#88ff88');
        addLine(`FPS: ${this.stats.fps}  (min: ${this.stats.fpsMin}  max: ${this.stats.fpsMax}  avg: ${this.stats.fpsAvg})`);
        addLine(`Frame: ${this.stats.frameTime.toFixed(1)}ms  (max: ${this.stats.frameTimeMax.toFixed(1)}ms)`);
        addLine(`Objects: ${this.stats.gameObjects}`);

        if (this.stats.memoryUsed > 0) {
            addLine(`Memory: ${this.stats.memoryUsed}MB / ${this.stats.memoryLimit}MB`);
        }

        addLine(`Lights: ${this.stats.lightsActive}  Particles: ${this.stats.particlesActive}`);
        y += 4;

        // System timers
        if (Object.keys(this.timers).length > 0) {
            addLine('--- System Timers ---', '#88aaff');
            Object.entries(this.timers).forEach(([name, t]) => {
                const avg = t.count > 0 ? (t.total / t.count).toFixed(2) : '0.00';
                addLine(`  ${name}: ${t.last.toFixed(2)}ms (avg: ${avg}ms, max: ${t.max.toFixed(2)}ms)`);
            });
        }

        // FPS graph
        y += 8;
        this._renderFPSGraph(g, panelX + 8, y, panelW - 16, 40);
    }

    _renderFPSGraph(g, x, y, w, h) {
        // Background
        g.fillStyle(0x111111, 0.8);
        g.fillRect(x, y, w, h);

        // 60fps line
        g.lineStyle(1, 0x444444, 0.5);
        g.lineBetween(x, y + h * (1 - 60 / 120), x + w, y + h * (1 - 60 / 120));

        // FPS curve
        if (this.fpsHistory.length < 2) return;

        g.lineStyle(1, 0x44ff44, 0.8);
        g.beginPath();

        const step = w / (this.historySize - 1);
        for (let i = 0; i < this.fpsHistory.length; i++) {
            const px = x + i * step;
            const py = y + h * (1 - Math.min(this.fpsHistory[i], 120) / 120);
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.strokePath();
    }

    _destroyOverlay() {
        if (this._overlayGfx) {
            this._overlayGfx.destroy();
            this._overlayGfx = null;
        }
        this._overlayTexts.forEach((t) => t.destroy());
        this._overlayTexts = [];
    }

    // ----------------------------------------------------------------
    // Snapshot
    // ----------------------------------------------------------------

    _emitSnapshot() {
        const snapshot = {
            ...this.stats,
            timers: {},
            timestamp: Date.now()
        };

        Object.entries(this.timers).forEach(([name, t]) => {
            snapshot.timers[name] = {
                last: t.last,
                avg: t.count > 0 ? t.total / t.count : 0,
                max: t.max
            };
        });

        EventBus.emit('profiler-snapshot', snapshot);
    }

    // ----------------------------------------------------------------
    // Reset / Cleanup
    // ----------------------------------------------------------------

    resetStats() {
        this.stats.fpsMin = Infinity;
        this.stats.fpsMax = 0;
        this.stats.frameTimeMax = 0;
        this.timers = {};
        this.timerHistory = {};
        this.fpsHistory = [];
        this.frameTimeHistory = [];
    }

    shutdown() {
        this._destroyOverlay();
        this.enabled = false;
    }
}
