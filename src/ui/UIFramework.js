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
      fontFamily: 'Open Sans',
      fontSize: '20px',
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

  /**
   * Unified show/hide helper. Supports both Phaser GameObjects (setVisible)
   * and custom panel classes that use show()/hide() directly.
   */
  _panelSetVisible(panel, visible) {
    if (!panel) return;
    if (visible) {
      if (typeof panel.show === 'function') panel.show();
      else if (typeof panel.setVisible === 'function') panel.setVisible(true);
    } else {
      if (typeof panel.hide === 'function') panel.hide();
      else if (typeof panel.setVisible === 'function') panel.setVisible(false);
    }
  }

  registerPanel(id, panel) {
    this.panels.set(id, panel);
    this._panelSetVisible(panel, false);
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
      this._panelSetVisible(this.panels.get(this.activePanel), false);
    }

    this.activePanel = id;
    this._panelSetVisible(panel, true);
    if (panel.onShow) panel.onShow(data);
    this.uiInputActive = true;

    this.eventBus.emit('ui:panelOpened', { panelId: id });
    EventBus.emit('ui:menuOpen');
  }

  hidePanel(id = null) {
    const panelId = id || this.activePanel;
    if (!panelId) return;

    const panel = this.panels.get(panelId);
    if (panel) {
      this._panelSetVisible(panel, false);
      if (panel.onHide) panel.onHide();
    }

    if (this.activePanel === panelId) {
      // Restore previous panel from stack
      if (this.panelStack.length > 0) {
        const prevId = this.panelStack.pop();
        this.activePanel = prevId;
        const prev = this.panels.get(prevId);
        if (prev) {
          this._panelSetVisible(prev, true);
          if (prev.onShow) prev.onShow();
        }
      } else {
        this.activePanel = null;
        this.uiInputActive = false;
      }
    }

    this.eventBus.emit('ui:panelClosed', { panelId });
    EventBus.emit('ui:menuClose');
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
      this._panelSetVisible(panel, false);
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
      disabled = false,
      // Atlas variant: 'brown' | 'blue' | 'beige' | 'grey' (default: 'brown')
      atlasVariant = 'brown'
    } = config;

    const container = this.scene.add.container(x, y);
    const hasAtlas = this.scene.textures.exists('ui_rpg');

    if (hasAtlas) {
      // ── Atlas-backed button (Kenney ui_rpg) ─────────────────────────
      const normalFrame  = `buttonLong_${atlasVariant}.png`;
      const pressedFrame = `buttonLong_${atlasVariant}_pressed.png`;

      // NineSlice: fixed 14px end caps, rest stretches horizontally
      const btnImg = this.scene.add.nineslice(0, 0, 'ui_rpg', normalFrame, width, height, 14, 14, 0, 0);
      if (disabled) btnImg.setTint(0x888888).setAlpha(0.6);
      container.add(btnImg);

      const label = this.scene.add.text(0, 0, text, {
        fontSize,
        fill: disabled ? '#888888' : textColor,
        fontFamily: this.theme.fontFamily
      }).setOrigin(0.5);
      container.add(label);

      if (!disabled) {
        container.setSize(width, height);
        container.setInteractive();

        container.on('pointerover', () => btnImg.setTint(0xdddddd));
        container.on('pointerout',  () => btnImg.clearTint());
        container.on('pointerdown', () => {
          btnImg.setFrame(pressedFrame);
          // Slight downward shift on press
          label.setY(2);
          EventBus.emit('ui:buttonClick');
          if (onClick) onClick();
        });
        container.on('pointerup', () => {
          btnImg.setFrame(normalFrame);
          label.setY(0);
        });
      }

      container._bg    = btnImg;
      container._label = label;

    } else {
      // ── Fallback: plain graphics button ─────────────────────────────
      const bg = this.scene.add.graphics();
      bg.fillStyle(color, disabled ? 0.4 : 0.8);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
      bg.lineStyle(1, this.theme.border, 0.6);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
      container.add(bg);

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
          EventBus.emit('ui:buttonClick');
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

      container._bg    = bg;
      container._label = label;
    }

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
    const hasAtlas = this.scene.textures.exists('ui_rpg');

    // Map theme colors → Kenney atlas bar variants
    const BAR_VARIANTS = {
      [this.theme.success]:  { left: 'barGreen_horizontalLeft.png',  mid: 'barGreen_horizontalMid.png',  right: 'barGreen_horizontalRight.png'  },
      [this.theme.primary]:  { left: 'barBlue_horizontalLeft.png',   mid: 'barBlue_horizontalBlue.png',  right: 'barBlue_horizontalRight.png'   },
      [this.theme.danger]:   { left: 'barRed_horizontalLeft.png',    mid: 'barRed_horizontalMid.png',    right: 'barRed_horizontalRight.png'    },
      [this.theme.accent]:   { left: 'barYellow_horizontalLeft.png', mid: 'barYellow_horizontalMid.png', right: 'barYellow_horizontalRight.png' },
    };
    const fillVariant = BAR_VARIANTS[barColor] || BAR_VARIANTS[this.theme.primary];

    // Atlas bar height is 18px; we stretch to fit config height
    const BAR_H = height;

    if (hasAtlas) {
      // ── Atlas-backed progress bar (Kenney ui_rpg) ───────────────────
      // Track: nineslice using barBack frames (9px end caps)
      const track = this.scene.add.nineslice(0, 0, 'ui_rpg', 'barBack_horizontalMid.png', width, BAR_H, 9, 9, 0, 0)
        .setOrigin(0, 0);
      container.add(track);

      // Fill: nineslice using color-matched frames, starts at 0 width
      const fillBar = this.scene.add.nineslice(0, 0, 'ui_rpg', fillVariant.mid, 1, BAR_H, 4, 4, 0, 0)
        .setOrigin(0, 0).setVisible(false);
      container.add(fillBar);

      // Text overlay
      const text = this.scene.add.text(width / 2, BAR_H / 2, '', {
        fontSize: '14px', fill: '#ffffff',
        fontFamily: this.theme.fontFamily,
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
      container.add(text);

      if (label) {
        const labelText = this.scene.add.text(0, -16, label, {
          fontSize: '15px', fill: this.theme.textSecondary,
          fontFamily: this.theme.fontFamily
        });
        container.add(labelText);
      }

      container.setValue = (val, max = maxValue) => {
        const progress = Math.max(0, Math.min(1, val / max));
        const fillW = Math.floor((width) * progress);
        if (fillW > 1) {
          fillBar.setSize(fillW, BAR_H).setVisible(true);
        } else {
          fillBar.setVisible(false);
        }
        if (showText) {
          text.setText(textFormat ? textFormat(val, max) : `${Math.round(val)} / ${max}`);
        }
      };

    } else {
      // ── Fallback: plain graphics bar ─────────────────────────────────
      const bg = this.scene.add.graphics();
      bg.fillStyle(bgColor, 0.8);
      bg.fillRoundedRect(0, 0, width, height, 3);
      bg.lineStyle(1, this.theme.border, 0.5);
      bg.strokeRoundedRect(0, 0, width, height, 3);
      container.add(bg);

      const fill = this.scene.add.graphics();
      container.add(fill);

      const text = this.scene.add.text(width / 2, height / 2, '', {
        fontSize: '15px', fill: this.theme.text,
        fontFamily: this.theme.fontFamily
      }).setOrigin(0.5);
      container.add(text);

      if (label) {
        const labelText = this.scene.add.text(0, -16, label, {
          fontSize: '15px', fill: this.theme.textSecondary,
          fontFamily: this.theme.fontFamily
        });
        container.add(labelText);
      }

      container.setValue = (val, max = maxValue) => {
        const progress = Math.max(0, Math.min(1, val / max));
        fill.clear();
        if (progress > 0) {
          fill.fillStyle(barColor, 1);
          fill.fillRoundedRect(2, 2, (width - 4) * progress, height - 4, 2);
        }
        if (showText) {
          text.setText(textFormat ? textFormat(val, max) : `${Math.round(val)} / ${max}`);
        }
      };
    }

    container.setValue(value, maxValue);
    return container;
  }

  createSlot(x, y, config = {}) {
    const {
      size = 48,
      onClick = null,
      onRightClick = null,
      showQuantity = true,
      slotIndex = 0
    } = config;
    let item = config.item ?? null;

    const container = this.scene.add.container(x, y);
    const hasAtlas = this.scene.textures.exists('ui_rpg');

    // Slot background — atlas nineslice or fallback graphics
    let bg;
    let rarityOverlay = null; // colored border for rarity, drawn on top of atlas slot

    if (hasAtlas) {
      bg = this.scene.add.nineslice(0, 0, 'ui_rpg', 'panelInset_beige.png', size, size, 10, 10, 10, 10)
        .setOrigin(0, 0);
    } else {
      bg = this.scene.add.graphics();
      bg.fillStyle(this.theme.surface, 0.8);
      bg.fillRoundedRect(0, 0, size, size, 4);
      bg.lineStyle(1, this.theme.border, 0.5);
      bg.strokeRoundedRect(0, 0, size, size, 4);
    }
    container.add(bg);

    // Rarity border overlay (graphics, drawn above slot image)
    const rarityBorder = this.scene.add.graphics();
    container.add(rarityBorder);

    let itemIcon = null;
    let quantityText = null;

    container.setSize(size, size);
    container.setInteractive();

    const _drawRarityBorder = (color, alpha = 0.8) => {
      rarityBorder.clear();
      rarityBorder.lineStyle(2, color, alpha);
      rarityBorder.strokeRect(1, 1, size - 2, size - 2);
    };

    container.on('pointerover', () => {
      if (hasAtlas) {
        bg.setTint(0xdddddd);
      } else {
        bg.clear();
        bg.fillStyle(this.theme.surface, 1);
        bg.fillRoundedRect(0, 0, size, size, 4);
        bg.lineStyle(2, this.theme.primary, 0.8);
        bg.strokeRoundedRect(0, 0, size, size, 4);
      }
      if (item) this.showTooltip(x + size + 10, y, item.name, item.description);
    });

    container.on('pointerout', () => {
      if (hasAtlas) {
        bg.clearTint();
      } else {
        bg.clear();
        bg.fillStyle(this.theme.surface, 0.8);
        bg.fillRoundedRect(0, 0, size, size, 4);
        bg.lineStyle(1, this.theme.border, 0.5);
        bg.strokeRoundedRect(0, 0, size, size, 4);
      }
      this.hideTooltip();
    });

    if (onClick) container.on('pointerdown', () => { EventBus.emit('ui:buttonClick'); onClick(slotIndex, item); });

    container.setItem = (newItem) => {
      item = newItem;
      if (itemIcon) { itemIcon.destroy(); itemIcon = null; }
      if (quantityText) { quantityText.destroy(); quantityText = null; }
      rarityBorder.clear();

      if (newItem) {
        const rarityColors = {
          common: 0x888888, uncommon: 0x44ff44, rare: 0x4a9eff,
          epic: 0xaa44ff, legendary: 0xff8800, mythic: 0xff4444
        };
        const rarityColor = rarityColors[newItem.rarity] || 0x888888;

        if (!hasAtlas) {
          bg.clear();
          bg.fillStyle(this.theme.surface, 0.8);
          bg.fillRoundedRect(0, 0, size, size, 4);
          bg.lineStyle(2, rarityColor, 0.8);
          bg.strokeRoundedRect(0, 0, size, size, 4);
        } else {
          _drawRarityBorder(rarityColor);
        }

        if (newItem.icon && this.scene.textures.exists(newItem.icon)) {
          itemIcon = this.scene.add.sprite(size / 2, size / 2, newItem.icon)
            .setDisplaySize(size - 8, size - 8);
        } else {
          itemIcon = this.scene.add.text(size / 2, size / 2, newItem.name?.charAt(0) || '?', {
            fontSize: '28px', fill: '#ffffff', fontFamily: this.theme.fontFamily
          }).setOrigin(0.5);
        }
        container.add(itemIcon);

        if (showQuantity && newItem.quantity > 1) {
          quantityText = this.scene.add.text(size - 4, size - 4, `${newItem.quantity}`, {
            fontSize: '14px', fill: '#ffffff', fontFamily: this.theme.fontFamily,
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
      depth = 5000,
      // Atlas variant: 'brown' | 'blue' | 'beige' (default: 'brown')
      atlasVariant = 'brown'
    } = config;

    const container = this.scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
    const hasAtlas = this.scene.textures.exists('ui_rpg');

    if (hasAtlas) {
      // ── Atlas-backed panel (Kenney ui_rpg) ───────────────────────────
      // Main panel nineslice — 6px border on all sides
      const panelImg = this.scene.add.nineslice(0, 0, 'ui_rpg', `panel_${atlasVariant}.png`, width, height, 6, 6, 6, 6)
        .setOrigin(0, 0);
      container.add(panelImg);

      if (title) {
        // Title inset strip using panelInset for contrast
        const titleBg = this.scene.add.nineslice(0, 0, 'ui_rpg', 'panelInset_brown.png', width, 36, 6, 6, 6, 6)
          .setOrigin(0, 0);
        container.add(titleBg);

        const titleText = this.scene.add.text(this.theme.padding, 8, title, {
          fontSize: '22px',
          fill: this.theme.textHighlight,
          fontFamily: this.theme.fontFamily,
          fontStyle: 'bold'
        });
        container.add(titleText);

        if (closable) {
          const closeBtn = this.scene.add.text(width - 28, 8, 'X', {
            fontSize: '22px', fill: '#888888',
            fontFamily: this.theme.fontFamily
          }).setInteractive();
          closeBtn.on('pointerover', () => closeBtn.setColor('#ff4444'));
          closeBtn.on('pointerout',  () => closeBtn.setColor('#888888'));
          closeBtn.on('pointerdown', () => {
            container.setVisible(false);
            EventBus.emit('ui:menuClose');
          });
          container.add(closeBtn);
        }
      }
    } else {
      // ── Fallback: graphics panel ──────────────────────────────────────
      const bg = this.scene.add.graphics();
      bg.fillStyle(this.theme.background, 0.95);
      bg.fillRoundedRect(0, 0, width, height, this.theme.borderRadius);
      bg.lineStyle(2, this.theme.border, 0.8);
      bg.strokeRoundedRect(0, 0, width, height, this.theme.borderRadius);
      container.add(bg);

      if (title) {
        const titleBar = this.scene.add.graphics();
        titleBar.fillStyle(this.theme.surface, 0.9);
        titleBar.fillRoundedRect(0, 0, width, 36, { tl: this.theme.borderRadius, tr: this.theme.borderRadius, bl: 0, br: 0 });
        container.add(titleBar);

        const titleText = this.scene.add.text(this.theme.padding, 10, title, {
          fontSize: '22px',
          fill: this.theme.textHighlight,
          fontFamily: this.theme.fontFamily,
          fontStyle: 'bold'
        });
        container.add(titleText);

        if (closable) {
          const closeBtn = this.scene.add.text(width - 28, 8, 'X', {
            fontSize: '22px', fill: '#888888',
            fontFamily: this.theme.fontFamily
          }).setInteractive();
          closeBtn.on('pointerover', () => closeBtn.setColor('#ff4444'));
          closeBtn.on('pointerout',  () => closeBtn.setColor('#888888'));
          closeBtn.on('pointerdown', () => {
            container.setVisible(false);
            EventBus.emit('ui:menuClose');
          });
          container.add(closeBtn);
        }
      }
    }

    if (draggable) {
      container.setSize(width, 36);
      container.setInteractive();
      this.scene.input.setDraggable(container);
      container.on('drag', (pointer, dragX, dragY) => container.setPosition(dragX, dragY));
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
        fontSize: '18px',
        fill: this.theme.textHighlight,
        fontFamily: this.theme.fontFamily,
        fontStyle: 'bold',
        wordWrap: { width: maxWidth - padding * 2 }
      });

      let totalHeight = titleText.height + padding * 2;
      let descText = null;

      if (description) {
        descText = this.scene.add.text(padding, titleText.height + padding + 4, description, {
          fontSize: '17px',
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
      fontSize: '14px',
      fill: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: this.theme.fontFamily,
      fontStyle: 'bold'
    });
    container.add(typeLabel);

    // Message
    const msgText = this.scene.add.text(-notifWidth + 14, 24, message, {
      fontSize: '17px',
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
      fontSize: '20px',
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
