import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * PerformanceProfiler - Real-time FPS/memory/timer overlay (F3).
 * Provides named timer API for per-system profiling, rolling FPS graph,
 * game object counts, and periodic snapshot broadcast.
 */
export class PerformanceProfiler {
  static instance = null;

  static getInstance() {
    if (!PerformanceProfiler.instance) new PerformanceProfiler();
    return PerformanceProfiler.instance;
  }

  constructor() {
    if (PerformanceProfiler.instance) return PerformanceProfiler.instance;

    this.eventBus = EventBus.getInstance();
    this.visible = false;
    this.scene = null;

    // FPS tracking
    this.fps = 0;
    this.fpsMin = Infinity;
    this.fpsMax = 0;
    this.fpsHistory = new Array(120).fill(60); // rolling 120 frames
    this.fpsHistoryIndex = 0;

    // Frame time
    this.frameTime = 0;
    this.frameTimeAvg = 0;

    // Named timers for per-system profiling
    this.timers = new Map(); // name → { start, total, count }
    this.timerResults = new Map(); // name → { avgMs, maxMs, totalMs }

    // Memory (Chrome only)
    this.memoryUsed = 0;
    this.memoryTotal = 0;

    // Object counts
    this.objectCounts = {};

    // Snapshot interval
    this.snapshotInterval = 2; // seconds
    this.snapshotTimer = 0;

    // DOM overlay elements
    this.overlay = null;

    PerformanceProfiler.instance = this;
  }

  /**
   * Attach to a scene and set up F3 toggle.
   */
  attach(scene) {
    this.scene = scene;

    scene.input.keyboard.on('keydown-F3', () => {
      this.toggle();
    });
  }

  // ─── Timer API ───────────────────────────────────────────────────

  /**
   * Begin timing a named section.
   */
  begin(name) {
    this.timers.set(name, {
      start: performance.now(),
      total: this.timers.get(name)?.total || 0,
      count: (this.timers.get(name)?.count || 0)
    });
  }

  /**
   * End timing a named section.
   */
  end(name) {
    const timer = this.timers.get(name);
    if (!timer) return;

    const elapsed = performance.now() - timer.start;
    timer.total += elapsed;
    timer.count++;

    // Update results
    const existing = this.timerResults.get(name) || { avgMs: 0, maxMs: 0, totalMs: 0, count: 0 };
    existing.totalMs += elapsed;
    existing.count++;
    existing.avgMs = existing.totalMs / existing.count;
    existing.maxMs = Math.max(existing.maxMs, elapsed);
    this.timerResults.set(name, existing);
  }

  /**
   * Measure a function's execution time.
   */
  measure(name, fn) {
    this.begin(name);
    const result = fn();
    this.end(name);
    return result;
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(delta) {
    const dt = delta / 1000;

    // FPS
    this.fps = Math.round(1000 / delta);
    this.fpsMin = Math.min(this.fpsMin, this.fps);
    this.fpsMax = Math.max(this.fpsMax, this.fps);
    this.fpsHistory[this.fpsHistoryIndex] = this.fps;
    this.fpsHistoryIndex = (this.fpsHistoryIndex + 1) % this.fpsHistory.length;

    // Frame time
    this.frameTime = delta;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    this.frameTimeAvg = 1000 / (sum / this.fpsHistory.length);

    // Memory (Chrome)
    if (performance.memory) {
      this.memoryUsed = Math.round(performance.memory.usedJSHeapSize / 1048576);
      this.memoryTotal = Math.round(performance.memory.totalJSHeapSize / 1048576);
    }

    // Object counts
    if (this.scene) {
      this.objectCounts = {
        gameObjects: this.scene.children?.list?.length || 0,
        physics: this.scene.physics?.world?.bodies?.size || 0
      };
    }

    // Snapshot broadcast
    this.snapshotTimer += dt;
    if (this.snapshotTimer >= this.snapshotInterval) {
      this.snapshotTimer = 0;
      this.broadcastSnapshot();
    }

    // Update overlay if visible
    if (this.visible && this.overlay) {
      this.renderOverlay();
    }
  }

  // ─── Overlay ─────────────────────────────────────────────────────

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.createOverlay();
    } else {
      this.destroyOverlay();
    }
  }

  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'verdance-profiler';
    this.overlay.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 10000;
      background: rgba(0,0,0,0.85); color: #00ff00; padding: 10px;
      font-family: monospace; font-size: 11px; line-height: 1.5;
      border: 1px solid #00ff00; border-radius: 4px;
      pointer-events: none; min-width: 220px;
    `;
    document.body.appendChild(this.overlay);
  }

  destroyOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  renderOverlay() {
    if (!this.overlay) return;

    const fpsAvg = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
    const fpsColor = this.fps >= 55 ? '#00ff00' : this.fps >= 30 ? '#ffaa00' : '#ff4444';

    let html = `
      <div style="color:${fpsColor};font-size:14px;font-weight:bold">
        FPS: ${this.fps} (avg: ${fpsAvg})
      </div>
      <div>Min: ${this.fpsMin} | Max: ${this.fpsMax}</div>
      <div>Frame: ${this.frameTime.toFixed(1)}ms</div>
    `;

    if (this.memoryUsed > 0) {
      html += `<div>Memory: ${this.memoryUsed}MB / ${this.memoryTotal}MB</div>`;
    }

    html += `<div>Objects: ${this.objectCounts.gameObjects || 0} | Physics: ${this.objectCounts.physics || 0}</div>`;

    // System timers
    if (this.timerResults.size > 0) {
      html += `<div style="margin-top:4px;border-top:1px solid #333;padding-top:4px">`;
      for (const [name, result] of this.timerResults) {
        html += `<div>${name}: ${result.avgMs.toFixed(2)}ms (max: ${result.maxMs.toFixed(2)})</div>`;
      }
      html += `</div>`;
    }

    // Mini FPS graph (last 60 frames)
    html += `<div style="margin-top:4px;border-top:1px solid #333;padding-top:4px">`;
    html += this.renderFPSGraph();
    html += `</div>`;

    this.overlay.innerHTML = html;
  }

  renderFPSGraph() {
    const width = 200;
    const height = 30;
    const recent = [];

    for (let i = 0; i < 60; i++) {
      const idx = (this.fpsHistoryIndex - 60 + i + this.fpsHistory.length) % this.fpsHistory.length;
      recent.push(this.fpsHistory[idx]);
    }

    // Build SVG sparkline
    let path = '';
    for (let i = 0; i < recent.length; i++) {
      const x = (i / (recent.length - 1)) * width;
      const y = height - (Math.min(recent[i], 70) / 70) * height;
      path += (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }

    return `<svg width="${width}" height="${height}" style="display:block">
      <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.3)"/>
      <line x1="0" y1="${height - (60/70)*height}" x2="${width}" y2="${height - (60/70)*height}"
            stroke="#333" stroke-dasharray="2,2"/>
      <path d="${path}" fill="none" stroke="#00ff00" stroke-width="1"/>
    </svg>`;
  }

  // ─── Snapshot ────────────────────────────────────────────────────

  broadcastSnapshot() {
    const snapshot = {
      fps: this.fps,
      fpsAvg: Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length),
      fpsMin: this.fpsMin,
      fpsMax: this.fpsMax,
      frameTime: this.frameTime,
      memoryUsed: this.memoryUsed,
      objectCounts: { ...this.objectCounts },
      timers: Object.fromEntries(this.timerResults)
    };

    this.eventBus.emit('profiler-snapshot', snapshot);
  }

  /**
   * Reset all tracked stats.
   */
  reset() {
    this.fpsMin = Infinity;
    this.fpsMax = 0;
    this.fpsHistory.fill(60);
    this.timers.clear();
    this.timerResults.clear();
  }
}

export default PerformanceProfiler;
