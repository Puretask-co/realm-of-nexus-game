import { EventBus } from '../core/EventBus.js';
import { Logger } from '../engine/Logger.js';

/**
 * ConsolePanel - Debug console window for the Verdance engine editor.
 *
 * Features:
 *  - Live log output from Logger system
 *  - Color-coded log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
 *  - Filter by log level and category
 *  - Search through log entries
 *  - Command input line for runtime commands
 *  - Auto-scroll with manual scroll override
 *  - Clear / pause / copy functionality
 *  - Memory and FPS status in footer
 *  - Collapsible panel
 */
export class ConsolePanel {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.logger = Logger.getInstance();

    this.panelX = config.x || 0;
    this.panelY = config.y || 420;
    this.panelWidth = config.width || 1280;
    this.panelHeight = config.height || 300;
    this.visible = true;
    this.collapsed = false;
    this.autoScroll = true;
    this.paused = false;
    this.scrollOffset = 0;
    this.rowHeight = 14;
    this.maxVisibleRows = Math.floor((this.panelHeight - 50) / this.rowHeight);

    // Filter state
    this.minLevel = 'DEBUG';
    this.filterCategory = null;
    this.searchTerm = '';

    // Command history
    this.commandHistory = [];
    this.commandHistoryIndex = -1;
    this.commandInput = '';

    // Registered commands
    this.commands = new Map();

    // UI elements
    this.container = null;
    this.logRows = [];

    this._registerBuiltinCommands();
    this.createPanel();

    // Listen for new log entries
    this.eventBus.on('logger:entry', (entry) => {
      if (!this.paused) this.onNewEntry(entry);
    });
    this.eventBus.on('logger:cleared', () => this.refresh());
  }

  createPanel() {
    this.container = this.scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    // Background
    this.bg = this.scene.add.graphics().setScrollFactor(0);
    this.container.add(this.bg);

    // Title bar
    this.titleBar = this.scene.add.graphics().setScrollFactor(0);
    this.container.add(this.titleBar);

    this.titleText = this.scene.add.text(
      this.panelX + 8, this.panelY + 4,
      'CONSOLE',
      { fontSize: '10px', color: '#6688aa', fontFamily: 'monospace', fontStyle: 'bold' }
    ).setScrollFactor(0);
    this.container.add(this.titleText);

    // Filter buttons
    this._createFilterButtons();

    // Clear button
    this.clearBtn = this.scene.add.text(
      this.panelX + this.panelWidth - 80, this.panelY + 4,
      '[CLEAR]',
      { fontSize: '9px', color: '#667788', fontFamily: 'monospace' }
    ).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.clearBtn.on('pointerdown', () => this.clear());
    this.clearBtn.on('pointerover', () => this.clearBtn.setColor('#aabbcc'));
    this.clearBtn.on('pointerout', () => this.clearBtn.setColor('#667788'));
    this.container.add(this.clearBtn);

    // Pause button
    this.pauseBtn = this.scene.add.text(
      this.panelX + this.panelWidth - 130, this.panelY + 4,
      '[PAUSE]',
      { fontSize: '9px', color: '#667788', fontFamily: 'monospace' }
    ).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());
    this.container.add(this.pauseBtn);

    // Log area container
    this.logContainer = this.scene.add.container(0, 0).setScrollFactor(0);
    this.container.add(this.logContainer);

    // Command input background
    this.inputBg = this.scene.add.graphics().setScrollFactor(0);
    this.container.add(this.inputBg);

    // Command prompt
    this.promptText = this.scene.add.text(
      this.panelX + 8, this.panelY + this.panelHeight - 16,
      '> _',
      { fontSize: '10px', color: '#44ff44', fontFamily: 'monospace' }
    ).setScrollFactor(0);
    this.container.add(this.promptText);

    // Footer status
    this.footerText = this.scene.add.text(
      this.panelX + this.panelWidth - 8, this.panelY + this.panelHeight - 16,
      '',
      { fontSize: '9px', color: '#445566', fontFamily: 'monospace' }
    ).setOrigin(1, 0).setScrollFactor(0);
    this.container.add(this.footerText);

    // Scroll handling
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (pointer.x >= this.panelX && pointer.x <= this.panelX + this.panelWidth &&
          pointer.y >= this.panelY && pointer.y <= this.panelY + this.panelHeight) {
        this.autoScroll = false;
        this.scrollOffset = Math.max(0, this.scrollOffset + (deltaY > 0 ? 2 : -2));
        this.refresh();
      }
    });

    // Keyboard for command input
    this.scene.input.keyboard.on('keydown', (event) => {
      if (!this.visible || this.collapsed) return;
      this._handleKeyInput(event);
    });

    this._drawBackground();
    this.refresh();
  }

  _drawBackground() {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a14, 0.92);
    this.bg.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);
    this.bg.lineStyle(1, 0x334466, 0.5);
    this.bg.strokeRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);

    // Title bar
    this.titleBar.clear();
    this.titleBar.fillStyle(0x111122, 0.9);
    this.titleBar.fillRect(this.panelX, this.panelY, this.panelWidth, 18);
    this.titleBar.lineStyle(1, 0x334466, 0.3);
    this.titleBar.lineBetween(
      this.panelX, this.panelY + 18,
      this.panelX + this.panelWidth, this.panelY + 18
    );

    // Command input bg
    this.inputBg.clear();
    this.inputBg.fillStyle(0x0e0e1e, 0.9);
    this.inputBg.fillRect(
      this.panelX, this.panelY + this.panelHeight - 20,
      this.panelWidth, 20
    );
    this.inputBg.lineStyle(1, 0x334466, 0.3);
    this.inputBg.lineBetween(
      this.panelX, this.panelY + this.panelHeight - 20,
      this.panelX + this.panelWidth, this.panelY + this.panelHeight - 20
    );
  }

  _createFilterButtons() {
    const levels = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
    const colors = {
      ALL: '#667788', DEBUG: '#888888', INFO: '#4488ff',
      WARN: '#ffaa44', ERROR: '#ff4444'
    };

    this.filterBtns = [];
    let bx = this.panelX + 70;

    for (const level of levels) {
      const btn = this.scene.add.text(bx, this.panelY + 4, level, {
        fontSize: '9px',
        color: this.minLevel === level || (level === 'ALL' && this.minLevel === 'TRACE')
          ? '#ffffff' : colors[level],
        fontFamily: 'monospace'
      }).setScrollFactor(0).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.minLevel = level === 'ALL' ? 'TRACE' : level;
        this.scrollOffset = 0;
        this.autoScroll = true;
        this.refresh();
        this._updateFilterHighlights();
      });

      this.container.add(btn);
      this.filterBtns.push({ btn, level });
      bx += level.length * 7 + 10;
    }
  }

  _updateFilterHighlights() {
    const colors = {
      ALL: '#667788', DEBUG: '#888888', INFO: '#4488ff',
      WARN: '#ffaa44', ERROR: '#ff4444'
    };

    for (const { btn, level } of this.filterBtns) {
      const isActive = (level === 'ALL' && this.minLevel === 'TRACE') || this.minLevel === level;
      btn.setColor(isActive ? '#ffffff' : (colors[level] || '#667788'));
    }
  }

  // ─── Log Display ────────────────────────────────────────────────

  onNewEntry(entry) {
    if (this.autoScroll) {
      this.refresh();
    }
  }

  refresh() {
    this.logContainer.removeAll(true);
    this.logRows = [];

    const entries = this.logger.getEntries({
      level: this.minLevel,
      category: this.filterCategory,
      search: this.searchTerm
    });

    // Auto-scroll to bottom
    if (this.autoScroll) {
      this.scrollOffset = Math.max(0, entries.length - this.maxVisibleRows);
    }

    const startIdx = Math.min(this.scrollOffset, Math.max(0, entries.length - this.maxVisibleRows));
    const endIdx = Math.min(startIdx + this.maxVisibleRows, entries.length);

    for (let i = startIdx; i < endIdx; i++) {
      const entry = entries[i];
      const rowY = this.panelY + 22 + (i - startIdx) * this.rowHeight;
      this._createLogRow(entry, rowY);
    }

    // Update footer
    const mem = this.logger.getMemoryInfo();
    const memStr = mem.usedMB > 0 ? `Mem: ${mem.usedMB}MB` : '';
    this.footerText.setText(
      `${entries.length} entries ${memStr} Frame: ${this.logger.frameCount}`
    );
  }

  _createLogRow(entry, y) {
    const levelColors = {
      TRACE: '#555555',
      DEBUG: '#888888',
      INFO: '#4488ff',
      WARN: '#ffaa44',
      ERROR: '#ff4444',
      FATAL: '#ff0000'
    };

    const color = levelColors[entry.level] || '#888888';

    // Timestamp
    const timeText = this.scene.add.text(
      this.panelX + 4, y,
      entry.time,
      { fontSize: '9px', color: '#445566', fontFamily: 'monospace' }
    ).setScrollFactor(0);
    this.logContainer.add(timeText);

    // Level tag
    const levelText = this.scene.add.text(
      this.panelX + 80, y,
      `[${entry.level.padEnd(5)}]`,
      { fontSize: '9px', color, fontFamily: 'monospace' }
    ).setScrollFactor(0);
    this.logContainer.add(levelText);

    // Category
    if (entry.category && entry.category !== 'Console') {
      const catText = this.scene.add.text(
        this.panelX + 136, y,
        `[${entry.category}]`,
        { fontSize: '9px', color: '#6688aa', fontFamily: 'monospace' }
      ).setScrollFactor(0);
      this.logContainer.add(catText);
    }

    // Message (truncated to fit)
    const msgX = this.panelX + (entry.category && entry.category !== 'Console' ? 136 + entry.category.length * 6 + 18 : 136);
    const maxMsgWidth = this.panelX + this.panelWidth - msgX - 8;
    let msg = entry.message;
    const maxChars = Math.floor(maxMsgWidth / 6);
    if (msg.length > maxChars) {
      msg = msg.substring(0, maxChars - 3) + '...';
    }

    const msgText = this.scene.add.text(
      msgX, y, msg,
      { fontSize: '9px', color: entry.level === 'ERROR' || entry.level === 'FATAL' ? color : '#ccccdd', fontFamily: 'monospace' }
    ).setScrollFactor(0);
    this.logContainer.add(msgText);

    // Alternating row background
    if (this.logRows.length % 2 === 0) {
      const rowBg = this.scene.add.graphics().setScrollFactor(0).setDepth(-1);
      rowBg.fillStyle(0x111122, 0.3);
      rowBg.fillRect(this.panelX + 1, y - 1, this.panelWidth - 2, this.rowHeight);
      this.logContainer.add(rowBg);
      this.logContainer.sendToBack(rowBg);
    }

    this.logRows.push({ entry, y });
  }

  // ─── Command Input ──────────────────────────────────────────────

  _handleKeyInput(event) {
    // Only handle when tilde/backtick activated console
    const key = event.key;

    if (key === 'Enter' && this.commandInput.length > 0) {
      this._executeCommand(this.commandInput);
      this.commandHistory.push(this.commandInput);
      this.commandHistoryIndex = this.commandHistory.length;
      this.commandInput = '';
      this._updatePrompt();
      return;
    }

    if (key === 'Backspace') {
      this.commandInput = this.commandInput.slice(0, -1);
      this._updatePrompt();
      return;
    }

    if (key === 'ArrowUp') {
      if (this.commandHistoryIndex > 0) {
        this.commandHistoryIndex--;
        this.commandInput = this.commandHistory[this.commandHistoryIndex] || '';
        this._updatePrompt();
      }
      return;
    }

    if (key === 'ArrowDown') {
      if (this.commandHistoryIndex < this.commandHistory.length - 1) {
        this.commandHistoryIndex++;
        this.commandInput = this.commandHistory[this.commandHistoryIndex] || '';
      } else {
        this.commandHistoryIndex = this.commandHistory.length;
        this.commandInput = '';
      }
      this._updatePrompt();
      return;
    }

    // Regular character input
    if (key.length === 1 && !event.ctrlKey && !event.altKey) {
      this.commandInput += key;
      this._updatePrompt();
    }
  }

  _updatePrompt() {
    this.promptText.setText(`> ${this.commandInput}_`);
  }

  _executeCommand(input) {
    const parts = input.trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    this.logger.info('Console', `> ${input}`);

    const cmd = this.commands.get(cmdName);
    if (cmd) {
      try {
        const result = cmd.execute(args);
        if (result) this.logger.info('Console', result);
      } catch (err) {
        this.logger.error('Console', `Command error: ${err.message}`);
      }
    } else {
      this.logger.warn('Console', `Unknown command: ${cmdName}. Type 'help' for commands.`);
    }

    this.autoScroll = true;
    this.refresh();
  }

  // ─── Command Registration ───────────────────────────────────────

  registerCommand(name, description, execute) {
    this.commands.set(name.toLowerCase(), { name, description, execute });
  }

  _registerBuiltinCommands() {
    this.registerCommand('help', 'List all commands', () => {
      const lines = ['Available commands:'];
      for (const [name, cmd] of this.commands) {
        lines.push(`  ${name} - ${cmd.description}`);
      }
      return lines.join('\n');
    });

    this.registerCommand('clear', 'Clear console output', () => {
      this.logger.clear();
      return 'Console cleared.';
    });

    this.registerCommand('fps', 'Show FPS info', () => {
      const game = this.scene.game;
      return `FPS: ${Math.round(game.loop.actualFps)} | Target: ${game.loop.targetFps}`;
    });

    this.registerCommand('entities', 'List entity count', () => {
      const reg = ComponentRegistry.getInstance();
      const stats = reg.getStats();
      return `Entities: ${stats.entityCount} | Components: ${stats.componentTypes} | Systems: ${stats.systemCount}`;
    });

    this.registerCommand('memory', 'Show memory usage', () => {
      const mem = this.logger.getMemoryInfo();
      if (mem.usedMB === 0) return 'Memory info not available (Chrome only)';
      return `Used: ${mem.usedMB}MB / ${mem.totalMB}MB (Limit: ${mem.limitMB}MB)`;
    });

    this.registerCommand('scene', 'Show current scene info', (args) => {
      const scenes = this.scene.scene.manager.getScenes(true);
      return `Active scenes: ${scenes.map(s => s.scene.key).join(', ')}`;
    });

    this.registerCommand('physics', 'Toggle physics debug', () => {
      const PhysicsLayer = require('../engine/PhysicsLayer.js').default;
      const physics = PhysicsLayer.getInstance();
      physics.toggleDebug();
      return `Physics debug: ${physics.debugMode ? 'ON' : 'OFF'}`;
    });

    this.registerCommand('log', 'Set log level (trace/debug/info/warn/error)', (args) => {
      if (args.length === 0) return `Current level: ${this.minLevel}`;
      const level = args[0].toUpperCase();
      if (Logger.LEVELS[level] !== undefined) {
        this.minLevel = level;
        this.refresh();
        return `Log level set to ${level}`;
      }
      return `Invalid level. Use: trace, debug, info, warn, error`;
    });

    this.registerCommand('eval', 'Evaluate JavaScript expression', (args) => {
      const expr = args.join(' ');
      try {
        const result = new Function('game', 'scene', `return ${expr}`)(this.scene.game, this.scene);
        return String(result);
      } catch (err) {
        return `Error: ${err.message}`;
      }
    });

    this.registerCommand('time', 'Show game time', () => {
      return `Time: ${(this.scene.time.now / 1000).toFixed(1)}s | Delta: ${this.scene.game.loop.delta.toFixed(1)}ms`;
    });
  }

  // ─── Controls ───────────────────────────────────────────────────

  togglePause() {
    this.paused = !this.paused;
    this.pauseBtn.setText(this.paused ? '[RESUME]' : '[PAUSE]');
    this.pauseBtn.setColor(this.paused ? '#ffaa44' : '#667788');
  }

  clear() {
    this.logger.clear();
    this.scrollOffset = 0;
    this.autoScroll = true;
    this.refresh();
  }

  setVisible(visible) {
    this.visible = visible;
    this.container.setVisible(visible);
  }

  setPosition(x, y) {
    this.panelX = x;
    this.panelY = y;
    this._drawBackground();
    this.refresh();
  }

  resize(width, height) {
    this.panelWidth = width;
    this.panelHeight = height;
    this.maxVisibleRows = Math.floor((this.panelHeight - 50) / this.rowHeight);
    this._drawBackground();
    this.refresh();
  }

  destroy() {
    if (this.container) this.container.destroy(true);
  }
}

export default ConsolePanel;
