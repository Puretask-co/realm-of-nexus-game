/**
 * PerformanceProfiler.js
 *
 * An in-game performance profiler overlay for Phaser 3.  Renders a fixed-
 * position HTML element in the top-right corner of the viewport showing
 * real-time FPS, frame time, memory usage, game-object counts, an
 * estimated draw-call count, and per-system timing breakdowns.
 *
 * @module PerformanceProfiler
 */

export default class PerformanceProfiler {
  /**
   * Creates a new PerformanceProfiler overlay.
   *
   * @param {Phaser.Scene} scene - The Phaser scene this profiler is attached to.
   */
  constructor(scene) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    // ---- FPS tracking ----
    /** @type {number} Current frames-per-second. */
    this.fps = 0;
    /** @type {number} Minimum FPS recorded since last reset. */
    this.minFps = Infinity;
    /** @type {number} Maximum FPS recorded since last reset. */
    this.maxFps = 0;
    /** @type {number} Running total of FPS values used for averaging. */
    this.fpsAccumulator = 0;
    /** @type {number} Number of frames sampled for the average. */
    this.frameCount = 0;

    // ---- Frame time ----
    /** @type {number} Time taken to process the last frame (ms). */
    this.frameTime = 0;

    // ---- Custom system timings ----
    /**
     * Map of custom system names to their most recent per-frame timing (ms).
     * @type {Map<string, number>}
     */
    this.systemTimings = new Map();

    // ---- Visibility ----
    /** @type {boolean} Whether the overlay is currently visible. */
    this.visible = true;

    // ---- Build DOM overlay ----
    this.container = this._createOverlayElement();
    document.body.appendChild(this.container);
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates the fixed-position overlay `<div>` element with initial styles.
   *
   * @private
   * @returns {HTMLDivElement} The overlay container element.
   */
  _createOverlayElement() {
    const el = document.createElement('div');
    el.id = 'perf-profiler-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      minWidth: '200px',
      padding: '10px 14px',
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.6',
      borderRadius: '6px',
      zIndex: '10000',
      pointerEvents: 'none',
      userSelect: 'none',
    });
    return el;
  }

  /**
   * Returns a CSS colour string based on the current FPS value.
   *   - Green (>55 FPS)
   *   - Yellow (>30 FPS)
   *   - Red   (<=30 FPS)
   *
   * @private
   * @param {number} fps
   * @returns {string} CSS colour string.
   */
  _fpsColor(fps) {
    if (fps > 55) return '#44ff44';
    if (fps > 30) return '#ffff44';
    return '#ff4444';
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Should be called once per frame (e.g. in the scene `update` method).
   * Recalculates all tracked stats and refreshes the HTML overlay.
   *
   * @param {number} [delta] - Frame delta in milliseconds.  If omitted the
   *   method falls back to `this.scene.game.loop.delta`.
   */
  update(delta) {
    const dt = delta ?? this.scene.game.loop.delta;
    this.frameTime = dt;

    // FPS from delta
    this.fps = dt > 0 ? Math.round(1000 / dt) : 0;
    if (this.fps < this.minFps) this.minFps = this.fps;
    if (this.fps > this.maxFps) this.maxFps = this.fps;
    this.fpsAccumulator += this.fps;
    this.frameCount += 1;

    if (!this.visible) {
      return;
    }

    // ---- Gather metrics ----
    const avgFps = Math.round(this.fpsAccumulator / this.frameCount);

    // Memory (non-standard, Chrome only)
    let memoryLine = '';
    if (typeof performance !== 'undefined' && performance.memory) {
      const used = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      const total = (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1);
      memoryLine = `<div>MEM: ${used} / ${total} MB</div>`;
    }

    // Active game objects
    const objectCount = this.scene.children ? this.scene.children.length : 0;

    // Estimated draw calls -- each visible, rendered game object is roughly
    // one draw call.  This is a coarse estimate.
    const drawCallEstimate = this.scene.children
      ? this.scene.children.list.filter((o) => o.visible && o.active).length
      : 0;

    // System timings
    let systemLines = '';
    if (this.systemTimings.size > 0) {
      systemLines = '<div style="margin-top:4px;border-top:1px solid #555;padding-top:4px;">';
      for (const [name, ms] of this.systemTimings) {
        systemLines += `<div>${name}: ${ms.toFixed(2)} ms</div>`;
      }
      systemLines += '</div>';
    }

    // ---- Render ----
    this.container.innerHTML = [
      `<div style="color:${this._fpsColor(this.fps)}; font-weight:bold;">`,
      `  FPS: ${this.fps}`,
      `</div>`,
      `<div>Min: ${this.minFps === Infinity ? '--' : this.minFps}  Max: ${this.maxFps}  Avg: ${avgFps}</div>`,
      `<div>Frame: ${this.frameTime.toFixed(2)} ms</div>`,
      memoryLine,
      `<div>Objects: ${objectCount}</div>`,
      `<div>Draw calls ~${drawCallEstimate}</div>`,
      systemLines,
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Custom system timing helpers
  // ---------------------------------------------------------------------------

  /**
   * Registers a named system for timing.  This is optional -- calling
   * {@link recordSystemTiming} will implicitly create the entry.
   *
   * @param {string} name - A human-readable name for the system.
   */
  addSystemTiming(name) {
    if (!this.systemTimings.has(name)) {
      this.systemTimings.set(name, 0);
    }
  }

  /**
   * Records the time a named system took this frame.
   *
   * @param {string} name - The system name (should match `addSystemTiming`).
   * @param {number} ms   - Duration in milliseconds.
   */
  recordSystemTiming(name, ms) {
    this.systemTimings.set(name, ms);
  }

  // ---------------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------------

  /**
   * Sets the overlay visibility.
   *
   * @param {boolean} visible - `true` to show, `false` to hide.
   */
  setVisible(visible) {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Toggles the overlay between visible and hidden.
   */
  toggle() {
    this.setVisible(!this.visible);
  }

  // ---------------------------------------------------------------------------
  // Reset & report
  // ---------------------------------------------------------------------------

  /**
   * Resets every tracked statistic back to its initial value.
   */
  reset() {
    this.fps = 0;
    this.minFps = Infinity;
    this.maxFps = 0;
    this.fpsAccumulator = 0;
    this.frameCount = 0;
    this.frameTime = 0;
    this.systemTimings.clear();
  }

  /**
   * Returns a plain object snapshot of all current profiler statistics.
   *
   * @returns {{
   *   fps: number,
   *   minFps: number,
   *   maxFps: number,
   *   avgFps: number,
   *   frameTime: number,
   *   objectCount: number,
   *   drawCallEstimate: number,
   *   memory: {usedMB: number, totalMB: number}|null,
   *   systemTimings: Object<string, number>
   * }}
   */
  getReport() {
    const avgFps = this.frameCount > 0
      ? Math.round(this.fpsAccumulator / this.frameCount)
      : 0;

    const objectCount = this.scene.children ? this.scene.children.length : 0;
    const drawCallEstimate = this.scene.children
      ? this.scene.children.list.filter((o) => o.visible && o.active).length
      : 0;

    let memory = null;
    if (typeof performance !== 'undefined' && performance.memory) {
      memory = {
        usedMB: +(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1),
        totalMB: +(performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1),
      };
    }

    const timings = {};
    for (const [name, ms] of this.systemTimings) {
      timings[name] = ms;
    }

    return {
      fps: this.fps,
      minFps: this.minFps === Infinity ? 0 : this.minFps,
      maxFps: this.maxFps,
      avgFps,
      frameTime: this.frameTime,
      objectCount,
      drawCallEstimate,
      memory,
      systemTimings: timings,
    };
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Removes the DOM overlay and cleans up references.  Call this when the
   * scene shuts down to avoid leaking DOM nodes.
   */
  shutdown() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.systemTimings.clear();
  }
}
