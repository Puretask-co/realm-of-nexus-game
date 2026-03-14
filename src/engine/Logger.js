import { EventBus } from '../core/EventBus.js';

/**
 * Logger - Structured logging system for the Verdance engine.
 *
 * Core Layer component providing:
 *  - Log levels: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
 *  - Categorized logging by system (e.g. [Physics], [AI], [Combat])
 *  - Timestamped entries with frame count
 *  - In-memory log buffer for Console Panel display
 *  - EventBus integration for log streaming
 *  - Configurable log level filtering
 *  - Memory usage tracking
 */
export class Logger {
  static instance = null;
  static LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };

  static getInstance() {
    if (!Logger.instance) new Logger();
    return Logger.instance;
  }

  constructor() {
    if (Logger.instance) return Logger.instance;

    this.eventBus = EventBus.getInstance();
    this.entries = [];
    this.maxEntries = 500;
    this.minLevel = Logger.LEVELS.DEBUG;
    this.frameCount = 0;
    this.categories = new Set();
    this.mutedCategories = new Set();
    this.startTime = performance.now();

    // Intercept native console methods
    this._originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      debug: console.debug?.bind(console) || console.log.bind(console)
    };

    this._interceptConsole();
    Logger.instance = this;
  }

  _interceptConsole() {
    const self = this;

    console.log = (...args) => {
      self._originalConsole.log(...args);
      self._capture('INFO', 'Console', args.map(a => self._stringify(a)).join(' '));
    };
    console.warn = (...args) => {
      self._originalConsole.warn(...args);
      self._capture('WARN', 'Console', args.map(a => self._stringify(a)).join(' '));
    };
    console.error = (...args) => {
      self._originalConsole.error(...args);
      self._capture('ERROR', 'Console', args.map(a => self._stringify(a)).join(' '));
    };
    console.info = (...args) => {
      self._originalConsole.info(...args);
      self._capture('INFO', 'Console', args.map(a => self._stringify(a)).join(' '));
    };
    console.debug = (...args) => {
      self._originalConsole.debug(...args);
      self._capture('DEBUG', 'Console', args.map(a => self._stringify(a)).join(' '));
    };
  }

  _stringify(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return val;
    if (val instanceof Error) return `${val.name}: ${val.message}`;
    try { return JSON.stringify(val, null, 0); } catch { return String(val); }
  }

  _capture(level, category, message) {
    const levelNum = Logger.LEVELS[level] ?? Logger.LEVELS.INFO;
    if (levelNum < this.minLevel) return;
    if (this.mutedCategories.has(category)) return;

    this.categories.add(category);

    const entry = {
      id: this.entries.length,
      level,
      levelNum,
      category,
      message,
      timestamp: performance.now() - this.startTime,
      frame: this.frameCount,
      time: new Date().toISOString().slice(11, 23)
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    this.eventBus.emit('logger:entry', entry);
  }

  // Public API
  trace(category, message) { this._capture('TRACE', category, message); }
  debug(category, message) { this._capture('DEBUG', category, message); }
  info(category, message) { this._capture('INFO', category, message); }
  warn(category, message) { this._capture('WARN', category, message); }
  error(category, message) { this._capture('ERROR', category, message); }
  fatal(category, message) { this._capture('FATAL', category, message); }

  setLevel(level) {
    this.minLevel = Logger.LEVELS[level] ?? Logger.LEVELS.DEBUG;
  }

  muteCategory(category) { this.mutedCategories.add(category); }
  unmuteCategory(category) { this.mutedCategories.delete(category); }

  getEntries(filter = {}) {
    let result = this.entries;
    if (filter.level !== undefined) {
      const minLevel = Logger.LEVELS[filter.level] ?? 0;
      result = result.filter(e => e.levelNum >= minLevel);
    }
    if (filter.category) {
      result = result.filter(e => e.category === filter.category);
    }
    if (filter.search) {
      const term = filter.search.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(term));
    }
    return result;
  }

  getCategories() { return [...this.categories]; }

  clear() {
    this.entries = [];
    this.eventBus.emit('logger:cleared');
  }

  tickFrame() { this.frameCount++; }

  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedMB: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
        totalMB: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
        limitMB: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))
      };
    }
    return { usedMB: 0, totalMB: 0, limitMB: 0 };
  }

  destroy() {
    // Restore original console
    console.log = this._originalConsole.log;
    console.warn = this._originalConsole.warn;
    console.error = this._originalConsole.error;
    console.info = this._originalConsole.info;
    console.debug = this._originalConsole.debug;
    Logger.instance = null;
  }
}

export default Logger;
