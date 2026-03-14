import { EventBus } from '../core/EventBus.js';
import { GameConfig } from '../core/GameConfig.js';

/**
 * InspectorPanel - Live property editor overlay for the EditorScene.
 * Renders as Phaser game objects (not DOM) for consistent rendering
 * across environments. Shows editable properties for the selected object.
 */
export class InspectorPanel {
  constructor(scene) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.visible = false;
    this.target = null;
    this.fields = [];
    this.container = null;

    // Panel dimensions
    this.panelX = GameConfig.WIDTH - 240;
    this.panelY = 70;
    this.panelWidth = 230;
    this.panelPadding = 8;
    this.fieldHeight = 22;
    this.labelColor = '#8899bb';
    this.valueColor = '#ffffff';
    this.headerColor = '#4a9eff';

    // Currently focused field index for keyboard editing
    this.focusedField = -1;

    // DOM input for value editing (hidden, positioned over field)
    this.domInput = null;

    this.createPanel();
  }

  createPanel() {
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(10002);
    this.container.setVisible(false);

    // Background
    this.bg = this.scene.add.rectangle(
      this.panelX + this.panelWidth / 2,
      this.panelY,
      this.panelWidth,
      300, // dynamic height, updated later
      0x1a1a2e, 0.95
    ).setOrigin(0.5, 0);
    this.container.add(this.bg);

    // Border
    this.border = this.scene.add.graphics();
    this.container.add(this.border);

    // Title
    this.titleText = this.scene.add.text(
      this.panelX + this.panelPadding,
      this.panelY + 6,
      'Inspector',
      { fontSize: '13px', fill: this.headerColor, fontFamily: 'monospace', fontStyle: 'bold' }
    );
    this.container.add(this.titleText);

    // Separator line after title
    this.titleLine = this.scene.add.graphics();
    this.container.add(this.titleLine);

    // Field container (for dynamic field rows)
    this.fieldContainer = this.scene.add.container(0, 0);
    this.container.add(this.fieldContainer);
  }

  /**
   * Show inspector for a game object.
   * @param {Phaser.GameObjects.GameObject} gameObject
   */
  show(gameObject) {
    this.target = gameObject;
    this.visible = true;
    this.container.setVisible(true);
    this.rebuildFields();
  }

  /**
   * Hide the inspector.
   */
  hide() {
    this.target = null;
    this.visible = false;
    this.container.setVisible(false);
    this.clearFields();
    this.hideDOMInput();
  }

  /**
   * Rebuild all field displays from the target object.
   */
  rebuildFields() {
    this.clearFields();
    if (!this.target || !this.target.active) {
      this.hide();
      return;
    }

    const obj = this.target;
    let y = this.panelY + 28;
    const x = this.panelX + this.panelPadding;
    const valueX = this.panelX + 100;

    // Object name/ID header
    const name = obj.getData('objectName') || 'Object';
    const type = obj.getData('objectType') || 'unknown';
    this.addFieldRow(x, y, 'Name', name, 'string', (val) => {
      obj.setData('objectName', val);
    });
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'Type', type, 'string', (val) => {
      obj.setData('objectType', val);
    });
    y += this.fieldHeight;

    // Section: Transform
    y += 6;
    this.addSectionHeader(x, y, 'Transform');
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'X', Math.round(obj.x), 'number', (val) => {
      obj.x = parseFloat(val);
    });
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'Y', Math.round(obj.y), 'number', (val) => {
      obj.y = parseFloat(val);
    });
    y += this.fieldHeight;

    if (obj.rotation !== undefined) {
      this.addFieldRow(x, y, 'Rotation', Math.round(Phaser.Math.RadToDeg(obj.rotation)), 'number', (val) => {
        obj.rotation = Phaser.Math.DegToRad(parseFloat(val));
      });
      y += this.fieldHeight;
    }

    if (obj.scaleX !== undefined) {
      this.addFieldRow(x, y, 'Scale X', obj.scaleX.toFixed(2), 'number', (val) => {
        obj.scaleX = parseFloat(val);
      });
      y += this.fieldHeight;

      this.addFieldRow(x, y, 'Scale Y', obj.scaleY.toFixed(2), 'number', (val) => {
        obj.scaleY = parseFloat(val);
      });
      y += this.fieldHeight;
    }

    // Section: Appearance
    y += 6;
    this.addSectionHeader(x, y, 'Appearance');
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'Depth', obj.depth, 'number', (val) => {
      obj.setDepth(parseInt(val, 10));
    });
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'Alpha', obj.alpha.toFixed(2), 'number', (val) => {
      obj.setAlpha(parseFloat(val));
    });
    y += this.fieldHeight;

    this.addFieldRow(x, y, 'Visible', obj.visible ? 'true' : 'false', 'boolean', (val) => {
      obj.setVisible(val === 'true');
    });
    y += this.fieldHeight;

    // Section: Layer
    y += 6;
    this.addSectionHeader(x, y, 'Layer');
    y += this.fieldHeight;

    const layer = obj.getData('layer') || 'layer_objects';
    this.addFieldRow(x, y, 'Layer', layer, 'string', (val) => {
      obj.setData('layer', val);
    });
    y += this.fieldHeight;

    // Section: Custom Properties
    const customKeys = this.getCustomDataKeys(obj);
    if (customKeys.length > 0) {
      y += 6;
      this.addSectionHeader(x, y, 'Properties');
      y += this.fieldHeight;

      for (const key of customKeys) {
        const val = obj.getData(key);
        this.addFieldRow(x, y, key, String(val), 'string', (newVal) => {
          // Try to parse as number if appropriate
          const num = parseFloat(newVal);
          obj.setData(key, isNaN(num) ? newVal : num);
        });
        y += this.fieldHeight;
      }
    }

    // Resize background to fit content
    const totalHeight = y - this.panelY + this.panelPadding;
    this.bg.setSize(this.panelWidth, totalHeight);
    this.bg.setPosition(this.panelX + this.panelWidth / 2, this.panelY);

    // Draw border
    this.border.clear();
    this.border.lineStyle(1, 0x4a9eff, 0.6);
    this.border.strokeRect(this.panelX, this.panelY, this.panelWidth, totalHeight);

    // Draw title separator
    this.titleLine.clear();
    this.titleLine.lineStyle(1, 0x333366, 0.8);
    this.titleLine.lineBetween(
      this.panelX + 4, this.panelY + 24,
      this.panelX + this.panelWidth - 4, this.panelY + 24
    );
  }

  addSectionHeader(x, y, label) {
    const sectionBg = this.scene.add.rectangle(
      this.panelX + this.panelWidth / 2, y + this.fieldHeight / 2 - 2,
      this.panelWidth - 8, this.fieldHeight,
      0x333355, 0.6
    );
    this.fieldContainer.add(sectionBg);

    const text = this.scene.add.text(x + 2, y, label, {
      fontSize: '11px', fill: this.headerColor, fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.fieldContainer.add(text);
  }

  addFieldRow(x, y, label, value, type, onChange) {
    // Label
    const labelText = this.scene.add.text(x, y, label, {
      fontSize: '11px', fill: this.labelColor, fontFamily: 'monospace'
    });
    this.fieldContainer.add(labelText);

    // Value background (clickable area)
    const valueX = this.panelX + 100;
    const valueWidth = this.panelWidth - 108;
    const valueBg = this.scene.add.rectangle(
      valueX + valueWidth / 2, y + this.fieldHeight / 2 - 2,
      valueWidth, this.fieldHeight - 2,
      0x222244, 0.8
    ).setInteractive({ useHandCursor: true });
    this.fieldContainer.add(valueBg);

    // Value text
    const valueText = this.scene.add.text(valueX + 4, y, String(value), {
      fontSize: '11px', fill: this.valueColor, fontFamily: 'monospace'
    });
    this.fieldContainer.add(valueText);

    // Click to edit
    const fieldIndex = this.fields.length;
    valueBg.on('pointerdown', () => {
      this.startEditing(fieldIndex);
    });

    valueBg.on('pointerover', () => {
      valueBg.setFillStyle(0x333366, 0.9);
    });
    valueBg.on('pointerout', () => {
      valueBg.setFillStyle(0x222244, 0.8);
    });

    this.fields.push({
      label,
      value: String(value),
      type,
      onChange,
      labelText,
      valueText,
      valueBg,
      x: valueX,
      y,
      width: valueWidth
    });
  }

  /**
   * Start inline editing of a field using a hidden DOM input.
   */
  startEditing(fieldIndex) {
    const field = this.fields[fieldIndex];
    if (!field) return;

    this.focusedField = fieldIndex;

    // Create or reuse DOM input
    if (!this.domInput) {
      this.domInput = document.createElement('input');
      this.domInput.id = 'inspector-input';
      this.domInput.style.cssText = `
        position: absolute;
        background: #222244;
        color: #ffffff;
        border: 1px solid #4a9eff;
        font-family: monospace;
        font-size: 11px;
        padding: 2px 4px;
        outline: none;
        z-index: 10000;
      `;
      document.body.appendChild(this.domInput);
    }

    // Position input over the field value
    const canvas = this.scene.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / GameConfig.WIDTH;
    const scaleY = canvasRect.height / GameConfig.HEIGHT;

    this.domInput.style.left = `${canvasRect.left + field.x * scaleX}px`;
    this.domInput.style.top = `${canvasRect.top + field.y * scaleY}px`;
    this.domInput.style.width = `${field.width * scaleX}px`;
    this.domInput.style.height = `${(this.fieldHeight - 2) * scaleY}px`;
    this.domInput.style.display = 'block';
    this.domInput.value = field.value;
    this.domInput.type = field.type === 'number' ? 'number' : 'text';
    this.domInput.step = field.type === 'number' ? 'any' : undefined;

    this.domInput.focus();
    this.domInput.select();

    // Hide value text while editing
    field.valueText.setVisible(false);

    // Handle input changes
    const onInput = () => {
      const newVal = this.domInput.value;
      field.value = newVal;
      field.onChange(newVal);

      // Update the scene data to stay in sync
      this.eventBus.emit('editor:propertyChanged', {
        field: field.label,
        value: newVal,
        objectId: this.target?.getData('sceneObjectId')
      });
    };

    const onFinish = () => {
      onInput();
      field.valueText.setText(this.domInput.value);
      field.valueText.setVisible(true);
      this.hideDOMInput();
      this.focusedField = -1;
    };

    // Remove old listeners
    this.domInput.onkeydown = null;
    this.domInput.onblur = null;
    this.domInput.oninput = null;

    this.domInput.oninput = onInput;
    this.domInput.onblur = onFinish;
    this.domInput.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onFinish();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        onFinish();
        // Move to next field
        const next = e.shiftKey ? fieldIndex - 1 : fieldIndex + 1;
        if (next >= 0 && next < this.fields.length) {
          this.startEditing(next);
        }
      }
    };
  }

  hideDOMInput() {
    if (this.domInput) {
      this.domInput.style.display = 'none';
      this.domInput.onkeydown = null;
      this.domInput.onblur = null;
      this.domInput.oninput = null;
    }
  }

  clearFields() {
    this.fieldContainer.removeAll(true);
    this.fields = [];
    this.focusedField = -1;
    this.hideDOMInput();
  }

  /**
   * Get custom data keys (exclude internal editor keys).
   */
  getCustomDataKeys(gameObject) {
    const internalKeys = new Set([
      'sceneObjectId', 'objectType', 'objectName', 'layer'
    ]);

    const dataStore = gameObject.data?.list;
    if (!dataStore) return [];

    return Object.keys(dataStore).filter(k => !internalKeys.has(k));
  }

  /**
   * Refresh displayed values without rebuilding (called each frame).
   */
  refresh() {
    if (!this.visible || !this.target || !this.target.active) return;

    // Update transform fields from live object position
    for (const field of this.fields) {
      if (this.focusedField >= 0 && this.fields[this.focusedField] === field) {
        continue; // Don't overwrite field being edited
      }

      let currentValue;
      switch (field.label) {
        case 'X': currentValue = Math.round(this.target.x); break;
        case 'Y': currentValue = Math.round(this.target.y); break;
        case 'Rotation':
          currentValue = Math.round(Phaser.Math.RadToDeg(this.target.rotation || 0));
          break;
        case 'Scale X': currentValue = this.target.scaleX?.toFixed(2); break;
        case 'Scale Y': currentValue = this.target.scaleY?.toFixed(2); break;
        case 'Depth': currentValue = this.target.depth; break;
        case 'Alpha': currentValue = this.target.alpha?.toFixed(2); break;
        default: continue;
      }

      if (currentValue !== undefined) {
        field.value = String(currentValue);
        field.valueText.setText(String(currentValue));
      }
    }
  }

  /**
   * Clean up DOM elements.
   */
  destroy() {
    if (this.domInput && this.domInput.parentNode) {
      this.domInput.parentNode.removeChild(this.domInput);
      this.domInput = null;
    }
    if (this.container) {
      this.container.destroy();
    }
  }
}

export default InspectorPanel;
