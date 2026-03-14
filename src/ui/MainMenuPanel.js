import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * MainMenuPanel - Pause/main menu with options for save, load, settings, and quit.
 */
export class MainMenuPanel {
  constructor(scene, uiFramework) {
    this.scene = scene;
    this.ui = uiFramework;
    this.eventBus = EventBus.getInstance();
    this.visible = false;

    this.build();
  }

  build() {
    const panelWidth = 320;
    const panelHeight = 400;
    const panelX = GameConfig.WIDTH / 2 - panelWidth / 2;
    const panelY = GameConfig.HEIGHT / 2 - panelHeight / 2;

    this.panel = this.ui.createPanel(panelX, panelY, panelWidth, panelHeight, {
      title: 'Verdance',
      closable: true,
      depth: 8500
    });
    this.panel.setVisible(false);

    // Overlay
    this.overlay = this.scene.add.rectangle(
      GameConfig.WIDTH / 2, GameConfig.HEIGHT / 2,
      GameConfig.WIDTH, GameConfig.HEIGHT,
      0x000000, 0.6
    ).setDepth(8400).setScrollFactor(0).setInteractive();
    this.overlay.setVisible(false);

    // Menu buttons
    const buttons = [
      { label: 'Resume', y: 70, onClick: () => this.hide() },
      { label: 'Inventory', y: 120, onClick: () => { this.hide(); this.ui.togglePanel('inventory'); } },
      { label: 'Skill Tree', y: 170, onClick: () => { this.hide(); this.ui.togglePanel('skillTree'); } },
      { label: 'Quest Log', y: 220, onClick: () => { this.hide(); this.ui.togglePanel('questLog'); } },
      { label: 'Settings', y: 270, onClick: () => this.showSettings() },
      { label: 'Save Game', y: 320, onClick: () => this.saveGame() },
      { label: 'Quit to Title', y: 370, onClick: () => this.quitToTitle() }
    ];

    for (const btn of buttons) {
      const button = this.ui.createButton(panelWidth / 2, btn.y, btn.label, {
        width: 200, height: 36, onClick: btn.onClick
      });
      this.panel.add(button);
    }
  }

  show() {
    this.visible = true;
    this.overlay.setVisible(true);
    this.panel.setVisible(true);
    this.eventBus.emit('game:paused');
  }

  hide() {
    this.visible = false;
    this.overlay.setVisible(false);
    this.panel.setVisible(false);
    this.eventBus.emit('game:resumed');
  }

  showSettings() {
    // Settings sub-panel
    this.ui.notify('Settings panel coming soon', { type: 'info' });
  }

  saveGame() {
    this.eventBus.emit('game:save');
    this.ui.notify('Game saved!', { type: 'success' });
  }

  quitToTitle() {
    this.ui.showConfirm(
      'Return to title screen? Unsaved progress will be lost.',
      () => {
        this.hide();
        this.eventBus.emit('game:quit');
      }
    );
  }

  setVisible(visible) {
    if (visible) this.show();
    else this.hide();
  }

  onShow() { this.show(); }
  onHide() { this.hide(); }

  destroy() {
    this.overlay?.destroy();
    this.panel?.destroy(true);
  }
}

export default MainMenuPanel;
