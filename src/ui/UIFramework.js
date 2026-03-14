import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * UIFramework - Comprehensive UI system for Verdance.
 * Provides reusable UI components, layout management, theming,
 * transitions, and game-specific panels (inventory, skill tree, HUD, menus).
 */
export class UIFramework {
  static instance = null;

  constructor(scene) {
    if (UIFramework.instance) return UIFramework.instance;

    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // UI panels registry
    this.panels = new Map();
    this.activePanel = null;
    this.panelStack = []; // For nested menus

    // Theme
    this.theme = {
      primary: 0x4a9eff,
      secondary: 0x2a2a4e,
      accent: 0xffaa00,
      danger: 0xff4444,
      success: 0x44ff44,
      background: 0x1a1a2e,
      surface: 0x252545,
      text: '#e0e0e0',
      textSecondary: '#aaaacc',
      textHighlight: '#4a9eff',
      border: 0x4a4a6e,
      fontFamily: 'monospace',
      fontSize: '14px',
      padding: 12,
      borderRadius: 6,
      // Sap phase color overrides
      sapPhaseColors: {
        blue: { primary: 0x4a9eff, accent: 0x88ccff },
        crimson: { primary: 0xff4a4a, accent: 0xff8844 },
        silver: { primary: 0xccccee, accent: 0xeeeeff }
      }
    };

    // Tooltip
    this.tooltip = null;
    this.tooltipTimer = null;

    // Notification queue
    this.notifications = [];
    this.maxNotifications = 5;
    this.notificationContainer = null;

    // Input blocking
    this.uiInputActive = false;

    UIFramework.instance = this;
  }

  static getInstance(scene) {
    if (!UIFramework.instance && scene) new UIFramework(scene);
    return UIFramework.instance;
  }

  // ─── Panel Management ─────────────────────────────────────────────

  registerPanel(id, panel) {
    this.panels.set(id, panel);
    panel.setVisible(false);
  }

  showPanel(id, data = null) {
    const panel = this.panels.get(id);
    if (!panel) {
      console.warn(`UIFramework: Unknown panel '${id}'`);
      return;
    }

    // Stack current panel if one is active
    if (this.activePanel && this.activePanel !== id) {
      this.panelStack.push(this.activePanel);
      const current = this.panels.get(this.activePanel);
      if (current) current.setVisible(false);
    }

    this.activePanel = id;
    panel.setVisible(true);
    if (panel.onShow) panel.onShow(data);
    this.uiInputActive = true;

    this.eventBus.emit('ui:panelOpened', { panelId: id });
  }

  hidePanel(id = null) {
    const panelId = id || this.activePanel;
    if (!panelId) return;

    const panel = this.panels.get(panelId);
    if (panel) {
      panel.setVisible(false);
      if (panel.onHide) panel.onHide();
    }

    if (this.activePanel === panelId) {
      // Restore previous panel from stack
      if (this.panelStack.length > 0) {
        const prevId = this.panelStack.pop();
        this.activePanel = prevId;
        const prev = this.panels.get(prevId);
        if (prev) {
          prev.setVisible(true);
          if (prev.onShow) prev.onShow();
        }
      } else {
        this.activePanel = null;
        this.uiInputActive = false;
      }
    }

    this.eventBus.emit('ui:panelClosed', { panelId });
  }

  togglePanel(id, data = null) {
    if (this.activePanel === id) {
      this.hidePanel(id);
    } else {
      this.showPanel(id, data);
    }
  }

  hideAllPanels() {
    for (const [id, panel] of this.panels) {
      panel.setVisible(false);
      if (panel.onHide) panel.onHide();
    }
    this.activePanel = null;
    this.panelStack = [];
    this.uiInputActive = false;
  }

  // ─── Component Factory ────────────────────────────────────────────

  createButton(x, y, text, config = {}) {
    const {
      width = 150,
      height = 40,
      color = this.theme.primary,
      textColor = this.theme.text,
      fontSize = this.theme.fontSize,
      onClick = null,
      disabled = false
    } = config;

    const container = this.scene.add.container(x, y);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(color, disabled ? 0.4 : 0.8);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
    bg.lineStyle(1, this.theme.border, 0.6);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
    container.add(bg);

    // Label
    const label = this.scene.add.text(0, 0, text, {
      fontSize,
      fill: disabled ? '#666666' : textColor,
      fontFamily: this.theme.fontFamily
    }).setOrigin(0.5);
    container.add(label);

    if (!disabled) {
      container.setSize(width, height);
      container.setInteractive();

      container.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
        bg.lineStyle(1, this.theme.accent, 0.8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
      });

      container.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(color, 0.8);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
        bg.lineStyle(1, this.theme.border, 0.6);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
      });

      container.on('pointerdown', () => {
        bg.clear();
        bg.fillStyle(color, 0.6);
        bg.fillRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, 4);
        if (onClick) onClick();
      });

      container.on('pointerup', () => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
        bg.lineStyle(1, this.theme.accent, 0.8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
      });
    }

    container._bg = bg;
    container._label = label;
    return container;
  }

  createProgressBar(x, y, config = {}) {
    const {
      width = 200,
      height = 20,
      value = 0,
      maxValue = 100,
      barColor = this.theme.primary,
      bgColor = this.theme.surface,
      showText = true,
      label = '',
      textFormat = null
    } = config;

    const container = this.scene.add.container(x, y);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(bgColor, 0.8);
    bg.fillRoundedRect(0, 0, width, height, 3);
    bg.lineStyle(1, this.theme.border, 0.5);
    bg.strokeRoundedRect(0, 0, width, height, 3);
    container.add(bg);

    // Fill bar
    const fill = this.scene.add.graphics();
    container.add(fill);

    // Text
    const text = this.scene.add.text(width / 2, height / 2, '', {
      fontSize: '11px',
      fill: this.theme.text,
      fontFamily: this.theme.fontFamily
    }).setOrigin(0.5);
    container.add(text);

    // Label
    if (label) {
      const labelText = this.scene.add.text(0, -16, label, {
        fontSize: '11px',
        fill: this.theme.textSecondary,
        fontFamily: this.theme.fontFamily
      });
      container.add(labelText);
    }

    // Update function
    container.setValue = (val, max = maxValue) => {
      const progress = Math.max(0, Math.min(1, val / max));
      fill.clear();
      if (progress > 0) {
        fill.fillStyle(barColor, 1);
        fill.fillRoundedRect(2, 2, (width - 4) * progress, height - 4, 2);
      }
      if (showText) {
        if (textFormat) {
          text.setText(textFormat(val, max));
        } else {
          text.setText(`${Math.round(val)} / ${max}`);
        }
      }
    };

    container.setValue(value, maxValue);
    return container;
  }

  createSlot(x, y, config = {}) {
    const {
      size = 48,
      item = null,
      onClick = null,
      onRightClick = null,
      showQuantity = true,
      slotIndex = 0
    } = config;

    const container = this.scene.add.container(x, y);

    // Slot background
    const bg = this.scene.add.graphics();
    bg.fillStyle(this.theme.surface, 0.8);
    bg.fillRoundedRect(0, 0, size, size, 4);
    bg.lineStyle(1, this.theme.border, 0.5);
    bg.strokeRoundedRect(0, 0, size, size, 4);
    container.add(bg);

    // Item icon placeholder
    let itemIcon = null;
    let quantityText = null;

    container.setSize(size, size);
    container.setInteractive();

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(this.theme.surface, 1);
      bg.fillRoundedRect(0, 0, size, size, 4);
      bg.lineStyle(2, this.theme.primary, 0.8);
      bg.strokeRoundedRect(0, 0, size, size, 4);

      if (item) this.showTooltip(x + size + 10, y, item.name, item.description);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(this.theme.surface, 0.8);
      bg.fillRoundedRect(0, 0, size, size, 4);
      bg.lineStyle(1, this.theme.border, 0.5);
      bg.strokeRoundedRect(0, 0, size, size, 4);
      this.hideTooltip();
    });

    if (onClick) container.on('pointerdown', () => onClick(slotIndex, item));

    // Update slot contents
    container.setItem = (newItem) => {
      item = newItem;
      if (itemIcon) { itemIcon.destroy(); itemIcon = null; }
      if (quantityText) { quantityText.destroy(); quantityText = null; }

      if (newItem) {
        // Rarity color border
        const rarityColors = {
          common: 0x888888, uncommon: 0x44ff44, rare: 0x4a9eff,
          epic: 0xaa44ff, legendary: 0xff8800, mythic: 0xff4444
        };
        const rarityColor = rarityColors[newItem.rarity] || 0x888888;
        bg.clear();
        bg.fillStyle(this.theme.surface, 0.8);
        bg.fillRoundedRect(0, 0, size, size, 4);
        bg.lineStyle(2, rarityColor, 0.8);
        bg.strokeRoundedRect(0, 0, size, size, 4);

        // Item icon (text placeholder if no sprite)
        if (newItem.icon && this.scene.textures.exists(newItem.icon)) {
          itemIcon = this.scene.add.sprite(size / 2, size / 2, newItem.icon)
            .setDisplaySize(size - 8, size - 8);
        } else {
          itemIcon = this.scene.add.text(size / 2, size / 2, newItem.name?.charAt(0) || '?', {
            fontSize: '20px', fill: '#ffffff', fontFamily: this.theme.fontFamily
          }).setOrigin(0.5);
        }
        container.add(itemIcon);

        // Quantity
        if (showQuantity && newItem.quantity > 1) {
          quantityText = this.scene.add.text(size - 4, size - 4, `${newItem.quantity}`, {
            fontSize: '10px', fill: '#ffffff', fontFamily: this.theme.fontFamily,
            backgroundColor: '#000000'
          }).setOrigin(1, 1);
          container.add(quantityText);
        }
      }
    };

    if (item) container.setItem(item);
    return container;
  }

  createPanel(x, y, width, height, config = {}) {
    const {
      title = '',
      closable = true,
      draggable = false,
      depth = 5000
    } = config;

    const container = this.scene.add.container(x, y).setDepth(depth).setScrollFactor(0);

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(this.theme.background, 0.95);
    bg.fillRoundedRect(0, 0, width, height, this.theme.borderRadius);
    bg.lineStyle(2, this.theme.border, 0.8);
    bg.strokeRoundedRect(0, 0, width, height, this.theme.borderRadius);
    container.add(bg);

    // Title bar
    if (title) {
      const titleBar = this.scene.add.graphics();
      titleBar.fillStyle(this.theme.surface, 0.9);
      titleBar.fillRoundedRect(0, 0, width, 36, { tl: this.theme.borderRadius, tr: this.theme.borderRadius, bl: 0, br: 0 });
      container.add(titleBar);

      const titleText = this.scene.add.text(this.theme.padding, 10, title, {
        fontSize: '16px',
        fill: this.theme.textHighlight,
        fontFamily: this.theme.fontFamily,
        fontStyle: 'bold'
      });
      container.add(titleText);

      // Close button
      if (closable) {
        const closeBtn = this.scene.add.text(width - 28, 8, 'X', {
          fontSize: '16px',
          fill: '#888888',
          fontFamily: this.theme.fontFamily
        }).setInteractive();
        closeBtn.on('pointerover', () => closeBtn.setColor('#ff4444'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
        closeBtn.on('pointerdown', () => container.setVisible(false));
        container.add(closeBtn);
      }
    }

    // Draggable
    if (draggable) {
      container.setSize(width, 36);
      container.setInteractive();
      this.scene.input.setDraggable(container);
      container.on('drag', (pointer, dragX, dragY) => {
        container.setPosition(dragX, dragY);
      });
    }

    container._width = width;
    container._height = height;
    return container;
  }

  // ─── Tooltip ──────────────────────────────────────────────────────

  showTooltip(x, y, title, description = '', delay = 300) {
    this.hideTooltip();

    this.tooltipTimer = this.scene.time.delayedCall(delay, () => {
      const padding = 10;
      const maxWidth = 250;

      this.tooltip = this.scene.add.container(x, y).setDepth(10000).setScrollFactor(0);

      // Measure text
      const titleText = this.scene.add.text(padding, padding, title, {
        fontSize: '13px',
        fill: this.theme.textHighlight,
        fontFamily: this.theme.fontFamily,
        fontStyle: 'bold',
        wordWrap: { width: maxWidth - padding * 2 }
      });

      let totalHeight = titleText.height + padding * 2;
      let descText = null;

      if (description) {
        descText = this.scene.add.text(padding, titleText.height + padding + 4, description, {
          fontSize: '12px',
          fill: this.theme.textSecondary,
          fontFamily: this.theme.fontFamily,
          wordWrap: { width: maxWidth - padding * 2 }
        });
        totalHeight = titleText.height + descText.height + padding * 2 + 4;
      }

      const bgWidth = Math.min(maxWidth, Math.max(titleText.width, descText?.width || 0) + padding * 2);

      // Background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x111122, 0.95);
      bg.fillRoundedRect(0, 0, bgWidth, totalHeight, 4);
      bg.lineStyle(1, this.theme.primary, 0.5);
      bg.strokeRoundedRect(0, 0, bgWidth, totalHeight, 4);

      this.tooltip.add(bg);
      this.tooltip.add(titleText);
      if (descText) this.tooltip.add(descText);

      // Keep on screen
      if (x + bgWidth > GameConfig.WIDTH) {
        this.tooltip.setX(x - bgWidth - 10);
      }
      if (y + totalHeight > GameConfig.HEIGHT) {
        this.tooltip.setY(y - totalHeight);
      }
    });
  }

  hideTooltip() {
    if (this.tooltipTimer) {
      this.tooltipTimer.remove();
      this.tooltipTimer = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy(true);
      this.tooltip = null;
    }
  }

  // ─── Notifications ────────────────────────────────────────────────

  notify(message, config = {}) {
    const {
      type = 'info', // info, success, warning, error, quest, achievement, item
      duration = 3000,
      icon = null
    } = config;

    if (!this.notificationContainer) {
      this.notificationContainer = this.scene.add.container(GameConfig.WIDTH - 20, 80)
        .setDepth(9500).setScrollFactor(0);
    }

    const typeColors = {
      info: this.theme.primary,
      success: this.theme.success,
      warning: this.theme.accent,
      error: this.theme.danger,
      quest: 0xffaa00,
      achievement: 0xaa44ff,
      item: 0x44ffaa
    };
    const color = typeColors[type] || this.theme.primary;

    const notifWidth = 300;
    const notifHeight = 50;
    const index = this.notifications.length;

    const container = this.scene.add.container(0, index * (notifHeight + 8));

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(this.theme.background, 0.9);
    bg.fillRoundedRect(-notifWidth, 0, notifWidth, notifHeight, 4);
    bg.lineStyle(2, color, 0.8);
    bg.strokeRoundedRect(-notifWidth, 0, notifWidth, notifHeight, 4);
    // Color accent bar on left
    bg.fillStyle(color, 1);
    bg.fillRect(-notifWidth, 0, 4, notifHeight);
    container.add(bg);

    // Type label
    const typeLabel = this.scene.add.text(-notifWidth + 14, 6, type.toUpperCase(), {
      fontSize: '10px',
      fill: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: this.theme.fontFamily,
      fontStyle: 'bold'
    });
    container.add(typeLabel);

    // Message
    const msgText = this.scene.add.text(-notifWidth + 14, 24, message, {
      fontSize: '12px',
      fill: this.theme.text,
      fontFamily: this.theme.fontFamily,
      wordWrap: { width: notifWidth - 28 }
    });
    container.add(msgText);

    // Slide in animation
    container.setX(notifWidth);
    this.scene.tweens.add({
      targets: container,
      x: 0,
      duration: 300,
      ease: 'Back.easeOut'
    });

    this.notificationContainer.add(container);
    this.notifications.push(container);

    // Remove after duration
    this.scene.time.delayedCall(duration, () => {
      this.scene.tweens.add({
        targets: container,
        x: notifWidth,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => {
          const idx = this.notifications.indexOf(container);
          if (idx >= 0) this.notifications.splice(idx, 1);
          container.destroy(true);
          // Reposition remaining notifications
          this.repositionNotifications();
        }
      });
    });

    // Limit max notifications
    if (this.notifications.length > this.maxNotifications) {
      const oldest = this.notifications.shift();
      oldest.destroy(true);
      this.repositionNotifications();
    }
  }

  repositionNotifications() {
    for (let i = 0; i < this.notifications.length; i++) {
      this.scene.tweens.add({
        targets: this.notifications[i],
        y: i * 58,
        duration: 200,
        ease: 'Quad.easeOut'
      });
    }
  }

  // ─── Confirmation Dialog ──────────────────────────────────────────

  showConfirm(message, onConfirm, onCancel = null, config = {}) {
    const { title = 'Confirm', confirmText = 'Yes', cancelText = 'No' } = config;

    const overlay = this.scene.add.rectangle(
      GameConfig.WIDTH / 2, GameConfig.HEIGHT / 2,
      GameConfig.WIDTH, GameConfig.HEIGHT,
      0x000000, 0.5
    ).setDepth(9800).setScrollFactor(0).setInteractive();

    const dialog = this.createPanel(
      GameConfig.WIDTH / 2 - 160, GameConfig.HEIGHT / 2 - 80,
      320, 160,
      { title, closable: false, depth: 9900 }
    );

    const msgText = this.scene.add.text(160, 60, message, {
      fontSize: '14px',
      fill: this.theme.text,
      fontFamily: this.theme.fontFamily,
      wordWrap: { width: 280 },
      align: 'center'
    }).setOrigin(0.5, 0);
    dialog.add(msgText);

    const confirmBtn = this.createButton(100, 130, confirmText, {
      width: 100, height: 32, color: this.theme.success,
      onClick: () => {
        overlay.destroy();
        dialog.destroy(true);
        if (onConfirm) onConfirm();
      }
    });
    dialog.add(confirmBtn);

    const cancelBtn = this.createButton(220, 130, cancelText, {
      width: 100, height: 32, color: this.theme.danger,
      onClick: () => {
        overlay.destroy();
        dialog.destroy(true);
        if (onCancel) onCancel();
      }
    });
    dialog.add(cancelBtn);

    return dialog;
  }

  // ─── Sap Phase Theme ──────────────────────────────────────────────

  applySapPhaseTheme(phase) {
    const colors = this.theme.sapPhaseColors[phase];
    if (!colors) return;

    this.theme.primary = colors.primary;
    this.theme.accent = colors.accent;
    this.eventBus.emit('ui:themeChanged', { phase, colors });
  }

  // ─── Update ───────────────────────────────────────────────────────

  update(time, delta) {
    // Can be extended for animated UI elements
  }

  isUIActive() {
    return this.uiInputActive;
  }

  destroy() {
    this.hideAllPanels();
    this.hideTooltip();
    if (this.notificationContainer) {
      this.notificationContainer.destroy(true);
    }
    UIFramework.instance = null;
  }
}

export default UIFramework;
