import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * HotReloadOverlay - Displays toast-style notifications in the game
 * viewport when data files are hot-reloaded. Provides visual feedback
 * so the developer knows changes were applied without checking the console.
 */
export class HotReloadOverlay {
  constructor(scene) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.notifications = [];
    this.maxNotifications = 4;
    this.notificationLifeMs = 3000;
    this.fadeOutMs = 500;

    // Container for all notification elements
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(10005);

    // Status indicator (small dot in corner)
    this.statusDot = this.scene.add.circle(GameConfig.WIDTH - 16, 16, 5, 0x44ff88, 0.8);
    this.statusDot.setScrollFactor(0);
    this.statusDot.setDepth(10005);
    this.statusDot.setVisible(false);

    // Listen for reload events
    this.eventBus.on('hotreload:reloaded', (data) => this.onReload(data), this);
    this.eventBus.on('data:hotReloaded', (data) => this.onReload(data), this);
  }

  onReload(data) {
    const key = data.key || 'data';
    const success = data.success !== false;

    this.showNotification(
      success
        ? `${key} reloaded`
        : `${key} reload failed: ${data.error || 'unknown error'}`,
      success ? 'success' : 'error'
    );

    // Flash the status dot
    this.flashStatusDot(success);
  }

  /**
   * Show a notification toast.
   * @param {string} message - Text to display
   * @param {'success'|'error'|'info'} type - Notification type
   */
  showNotification(message, type = 'info') {
    // Remove oldest if at capacity
    if (this.notifications.length >= this.maxNotifications) {
      const oldest = this.notifications.shift();
      this.destroyNotification(oldest);
    }

    const colors = {
      success: { bg: 0x1a3a1a, border: 0x44ff88, text: '#44ff88' },
      error: { bg: 0x3a1a1a, border: 0xff4444, text: '#ff4444' },
      info: { bg: 0x1a1a3a, border: 0x4a9eff, text: '#4a9eff' }
    };
    const style = colors[type] || colors.info;

    const yOffset = this.getNotificationY();
    const x = GameConfig.WIDTH - 210;
    const y = GameConfig.HEIGHT - 40 - yOffset;

    // Background
    const bg = this.scene.add.rectangle(x + 100, y, 200, 26, style.bg, 0.9);
    bg.setStrokeStyle(1, style.border, 0.8);
    this.container.add(bg);

    // Icon
    const icon = type === 'success' ? '\u2713' : type === 'error' ? '\u2717' : '\u2022';
    const iconText = this.scene.add.text(x + 8, y - 7, icon, {
      fontSize: '12px', fill: style.text, fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.container.add(iconText);

    // Message
    const msgText = this.scene.add.text(x + 22, y - 7, message, {
      fontSize: '11px', fill: style.text, fontFamily: 'monospace'
    });
    this.container.add(msgText);

    const notification = {
      bg, iconText, msgText,
      createdAt: Date.now()
    };

    this.notifications.push(notification);

    // Auto-remove after lifetime
    this.scene.time.delayedCall(this.notificationLifeMs, () => {
      this.fadeOutNotification(notification);
    });
  }

  getNotificationY() {
    return this.notifications.length * 30;
  }

  fadeOutNotification(notification) {
    const idx = this.notifications.indexOf(notification);
    if (idx < 0) return;

    // Fade out all elements
    const elements = [notification.bg, notification.iconText, notification.msgText];
    this.scene.tweens.add({
      targets: elements,
      alpha: 0,
      duration: this.fadeOutMs,
      onComplete: () => {
        this.destroyNotification(notification);
        // Reposition remaining notifications
        this.repositionNotifications();
      }
    });
  }

  destroyNotification(notification) {
    const idx = this.notifications.indexOf(notification);
    if (idx >= 0) this.notifications.splice(idx, 1);

    notification.bg.destroy();
    notification.iconText.destroy();
    notification.msgText.destroy();
  }

  repositionNotifications() {
    for (let i = 0; i < this.notifications.length; i++) {
      const n = this.notifications[i];
      const y = GameConfig.HEIGHT - 40 - (i * 30);

      this.scene.tweens.add({
        targets: [n.bg],
        y: y,
        duration: 150,
        ease: 'Quad.easeOut'
      });

      this.scene.tweens.add({
        targets: [n.iconText, n.msgText],
        y: y - 7,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    }
  }

  flashStatusDot(success) {
    this.statusDot.setVisible(true);
    this.statusDot.setFillStyle(success ? 0x44ff88 : 0xff4444, 1);

    this.scene.tweens.add({
      targets: this.statusDot,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 150,
      yoyo: true,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.statusDot,
          alpha: 0,
          delay: 2000,
          duration: 500,
          onComplete: () => {
            this.statusDot.setVisible(false);
            this.statusDot.setAlpha(0.8);
            this.statusDot.setScale(1);
          }
        });
      }
    });
  }

  destroy() {
    for (const n of this.notifications) {
      n.bg.destroy();
      n.iconText.destroy();
      n.msgText.destroy();
    }
    this.notifications = [];
    this.container.destroy();
    this.statusDot.destroy();
  }
}

export default HotReloadOverlay;
