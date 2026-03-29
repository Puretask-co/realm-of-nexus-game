/**
 * TutorialSystem.js
 * Step-by-step tutorial overlay for new players in Realm of Nexus: Verdance.
 *
 * ACTIVATION
 *   Listens for the EventBus event 'game:newGameStarted' (payload: Phaser scene ref).
 *   GameScene must emit this event at the end of create() when registry key
 *   'isNewGame' is truthy:
 *
 *     // In GameScene.create() — DO NOT MODIFY GameScene.js
 *     // The agent building GameScene should add:
 *     if (this.registry.get('isNewGame')) {
 *       EventBus.emit('game:newGameStarted', this);
 *     }
 *
 *   In MainMenuScene.js "New Game" handler, before starting ClassSelectionScene:
 *     this.registry.set('isNewGame', true);
 *
 * SINGLETON PATTERN
 *   Use TutorialSystem.getInstance() everywhere. Never call `new TutorialSystem()` directly.
 *
 * PERSISTENCE
 *   Completion stored in localStorage under key 'verdance_tutorial_done'.
 *   If that key is '1', the tutorial will not show again.
 *
 * OVERLAY DESIGN
 *   - Semi-transparent full-screen dimming layer
 *   - Optional spotlight rectangle (punches a hole in the dim)
 *   - 420×160px instruction card anchored at bottom-centre of screen
 *   - Card contains: step counter, title, detail text, optional key hint badge,
 *     NEXT button (or BEGIN JOURNEY on last step), and SKIP TUTORIAL button
 */

import EventBus from '../core/EventBus.js';

// ============================================================
// TUTORIAL STEP DEFINITIONS
// Each step:
//   title    string — bold header
//   text     string — descriptive body
//   keyHint  string|null — shown as a badge (e.g. "W A S D")
//   spotlight { x, y, w, h }|null — region to keep bright; null = no spotlight
//   final    bool — if true, NEXT button becomes "BEGIN YOUR JOURNEY"
// ============================================================

const STEPS = [
  {
    title:     'Welcome to Verdance',
    text:      'Welcome, traveller! This world pulses with the living Sap — a force that shapes magic, monsters, and the land itself. Let\'s learn the basics.',
    keyHint:   null,
    spotlight: null,
    final:     false,
  },
  {
    title:     'Movement',
    text:      'Use WASD or the Arrow Keys to move your character around the world. Explore freely — the world is alive and reacts to your presence.',
    keyHint:   'W A S D  /  ↑ ↓ ← →',
    spotlight: { x: 0.5, y: 0.5, w: 0.4, h: 0.4, centred: true }, // centre of screen (relative)
    final:     false,
  },
  {
    title:     'The Sap Cycle',
    text:      'Watch the top bar — the Sap Cycle shifts between Blue, Crimson, and Silver phases. Each phase changes the world: enemy types, spell costs, and even shop prices.',
    keyHint:   null,
    spotlight: { x: 0, y: 0, w: 300, h: 60, absolute: true },
    final:     false,
  },
  {
    title:     'Your Health & Sap',
    text:      'Your HP bar and Sap bar are shown top-left. HP is your life — reach zero and it\'s over. Sap powers your spells. Don\'t run out mid-fight.',
    keyHint:   null,
    spotlight: { x: 0, y: 0, w: 240, h: 90, absolute: true },
    final:     false,
  },
  {
    title:     'Casting Spells',
    text:      'Press keys 1 through 6 to cast your equipped spells. Each spell costs Sap (your mana) and has a cooldown shown on the spell bar at the bottom of the screen.',
    keyHint:   '1  2  3  4  5  6',
    spotlight: null, // bottom spell bar — dynamic position, skip spotlight
    final:     false,
  },
  {
    title:     'Your Inventory',
    text:      'Press I to open your inventory. Equip weapons, armour, and accessories to boost your attributes. Drag items between slots to re-equip on the fly.',
    keyHint:   'I',
    spotlight: null,
    final:     false,
  },
  {
    title:     'The Spellbook',
    text:      'Press K to open the Spellbook. Browse all spells, check class requirements, read full mechanics, and manage which spells fill your 1-6 slots.',
    keyHint:   'K',
    spotlight: null,
    final:     false,
  },
  {
    title:     'Quests & Game Info',
    text:      'Press TAB to open the Game Info panel. Track active quests, view the Sap Cycle timer, check your DSP pool level, and read AI Dungeon Master narrations.',
    keyHint:   'TAB',
    spotlight: null,
    final:     false,
  },
  {
    title:     'The DSP Pool',
    text:      'Your DSP Pool (Dimensional Sap Pressure) rises every time you cast a spell. If it hits 100, reality fractures — a catastrophic event that stuns you. Manage it carefully.',
    keyHint:   null,
    spotlight: null,
    final:     false,
  },
  {
    title:     'Combat Basics',
    text:      'When enemies are nearby, your spells auto-target the closest enemy. Melee attacks require being adjacent. Ranged and magic attacks reach further but some require line of sight.',
    keyHint:   null,
    spotlight: null,
    final:     false,
  },
  {
    title:     'Home Base',
    text:      'Press H to return to your Home Base. Rest there to recover HP and Sap and reset your DSP pool to zero. You can also craft, manage your stash, and consult companions.',
    keyHint:   'H',
    spotlight: null,
    final:     false,
  },
  {
    title:     'The Codex',
    text:      'Press W to open the Verdance Codex — your in-game wiki. It starts mostly locked. As you discover enemies, collect items, and explore locations, entries unlock automatically.',
    keyHint:   'W',
    spotlight: null,
    final:     true,
  },
];

// ============================================================
// TutorialSystem
// ============================================================

class TutorialSystem {
  constructor() {
    if (TutorialSystem._instance) return TutorialSystem._instance;
    TutorialSystem._instance = this;

    this._scene       = null;
    this._active      = false;
    this._stepIndex   = 0;
    this._overlay     = null; // Phaser container
    this._spotCanvas  = null; // Graphics for dim + spotlight

    // Listen for new-game event from GameScene
    // NOTE: GameScene must emit 'game:newGameStarted' (passing `this`) at the
    //       end of create() when this.registry.get('isNewGame') === true.
    EventBus.on('game:newGameStarted', (scene) => this.start(scene));
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Returns the singleton instance, creating it if necessary. */
  static getInstance() {
    if (!TutorialSystem._instance) new TutorialSystem();
    return TutorialSystem._instance;
  }

  /**
   * Attach the tutorial overlay to a Phaser scene and begin from step 1.
   * @param {Phaser.Scene} scene
   */
  start(scene) {
    if (this._active) return;
    if (localStorage.getItem('verdance_tutorial_done') === '1') return;

    this._scene     = scene;
    this._active    = true;
    this._stepIndex = 0;

    this._createOverlay(scene);
    this._showStep(this._stepIndex);
  }

  /** Advance to the next step. On the final step, closes the tutorial. */
  nextStep() {
    if (!this._active) return;

    this._stepIndex += 1;
    if (this._stepIndex >= STEPS.length) {
      this._finish();
      return;
    }
    this._showStep(this._stepIndex);
  }

  /** Skip and permanently disable the tutorial. */
  skipTutorial() {
    this.saveProgress();
    this._destroyOverlay();
  }

  /** Returns true while the tutorial overlay is displayed. */
  isActive() {
    return this._active;
  }

  /** Marks the tutorial as done in localStorage. */
  saveProgress() {
    try {
      localStorage.setItem('verdance_tutorial_done', '1');
    } catch (_) { /* storage unavailable */ }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  _finish() {
    this.saveProgress();
    this._destroyOverlay();
    EventBus.emit('tutorial:complete');
  }

  /**
   * Create the persistent overlay container. Called once per start().
   * @param {Phaser.Scene} scene
   */
  _createOverlay(scene) {
    const { width, height } = scene.scale;

    // High depth so overlay sits above all game objects
    const DEPTH = 9000;

    // Layer 1: the spotlight graphics (dim + optional bright hole)
    this._spotCanvas = scene.add.graphics().setDepth(DEPTH);

    // Layer 2: the instruction card container
    this._overlay = scene.add.container(width / 2, height - 30).setDepth(DEPTH + 1);

    // Card dimensions
    const CW = 420;
    const CH = 160;

    // Card background
    const cardBg = scene.add.graphics();
    cardBg.fillStyle(0x0d1117, 0.96);
    cardBg.lineStyle(2, 0x4ade80, 0.7);
    cardBg.fillRoundedRect(-CW / 2, -CH, CW, CH, 10);
    cardBg.strokeRoundedRect(-CW / 2, -CH, CW, CH, 10);
    this._overlay.add(cardBg);

    // Step counter (top-left of card)
    this._stepLabel = scene.add.text(-CW / 2 + 14, -CH + 12, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8b949e',
    });
    this._overlay.add(this._stepLabel);

    // Title
    this._titleText = scene.add.text(-CW / 2 + 14, -CH + 30, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#4ade80', fontStyle: 'bold',
    });
    this._overlay.add(this._titleText);

    // Body text
    this._bodyText = scene.add.text(-CW / 2 + 14, -CH + 52, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#e6edf3',
      wordWrap: { width: CW - 28 }, lineSpacing: 3,
    });
    this._overlay.add(this._bodyText);

    // Key hint badge (conditionally visible)
    this._keyBadge = scene.add.text(CW / 2 - 14, -CH + 14, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#0d1117',
      backgroundColor: '#60a5fa', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0);
    this._overlay.add(this._keyBadge);

    // NEXT button
    this._nextBtn = scene.add.text(CW / 2 - 14, -16, 'NEXT  →', {
      fontFamily: 'monospace', fontSize: '13px', color: '#0d1117',
      backgroundColor: '#4ade80', padding: { x: 14, y: 7 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });

    this._nextBtn.on('pointerdown', () => this.nextStep());
    this._nextBtn.on('pointerover',  () => this._nextBtn.setAlpha(0.8));
    this._nextBtn.on('pointerout',   () => this._nextBtn.setAlpha(1));
    this._overlay.add(this._nextBtn);

    // SKIP button
    this._skipBtn = scene.add.text(-CW / 2 + 14, -16, 'SKIP TUTORIAL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8b949e',
      padding: { x: 0, y: 7 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

    this._skipBtn.on('pointerdown', () => this.skipTutorial());
    this._skipBtn.on('pointerover',  () => this._skipBtn.setColor('#e6edf3'));
    this._skipBtn.on('pointerout',   () => this._skipBtn.setColor('#8b949e'));
    this._overlay.add(this._skipBtn);
  }

  /**
   * Update all overlay UI elements to reflect the given step.
   * @param {number} index
   */
  _showStep(index) {
    const step = STEPS[index];
    if (!step || !this._overlay) return;

    const total = STEPS.length;
    const { width, height } = this._scene.scale;

    // Update text elements
    this._stepLabel.setText(`Step ${index + 1} / ${total}`);
    this._titleText.setText(step.title);
    this._bodyText.setText(step.text);

    // Key hint badge
    if (step.keyHint) {
      this._keyBadge.setText(` ${step.keyHint} `).setVisible(true);
    } else {
      this._keyBadge.setVisible(false);
    }

    // Final step button label
    if (step.final) {
      this._nextBtn.setText('BEGIN YOUR JOURNEY  ✦');
    } else {
      this._nextBtn.setText('NEXT  →');
    }

    // Spotlight / dim canvas
    this._spotCanvas.clear();

    // Full-screen semi-transparent dim
    this._spotCanvas.fillStyle(0x000000, 0.55);
    this._spotCanvas.fillRect(0, 0, width, height);

    if (step.spotlight) {
      // Erase a rectangle from the dim to create a spotlight effect.
      // Phaser graphics don't support true punch-outs natively, so we redraw
      // four dark panels around the spotlight region instead.
      let sx, sy, sw, sh;

      if (step.spotlight.centred) {
        // Proportional centred spotlight
        sw = width  * step.spotlight.w;
        sh = height * step.spotlight.h;
        sx = (width  - sw) / 2;
        sy = (height - sh) / 2;
      } else if (step.spotlight.absolute) {
        sx = step.spotlight.x;
        sy = step.spotlight.y;
        sw = step.spotlight.w;
        sh = step.spotlight.h;
      } else {
        // Relative proportional
        sx = step.spotlight.x * width;
        sy = step.spotlight.y * height;
        sw = step.spotlight.w * width;
        sh = step.spotlight.h * height;
      }

      // Redraw dim as four surrounding panels, leaving the spotlight clear
      this._spotCanvas.clear();

      // Top panel
      this._spotCanvas.fillStyle(0x000000, 0.55);
      this._spotCanvas.fillRect(0, 0, width, sy);
      // Bottom panel
      this._spotCanvas.fillRect(0, sy + sh, width, height - sy - sh);
      // Left panel
      this._spotCanvas.fillRect(0, sy, sx, sh);
      // Right panel
      this._spotCanvas.fillRect(sx + sw, sy, width - sx - sw, sh);

      // Spotlight border
      this._spotCanvas.lineStyle(2, 0x4ade80, 0.6);
      this._spotCanvas.strokeRect(sx, sy, sw, sh);
    }
  }

  /**
   * Remove all overlay objects from the scene and mark the system inactive.
   */
  _destroyOverlay() {
    if (this._spotCanvas) {
      this._spotCanvas.destroy();
      this._spotCanvas = null;
    }
    if (this._overlay) {
      this._overlay.destroy(true);
      this._overlay = null;
    }
    this._active = false;
    this._scene  = null;
  }
}

// ============================================================
// Module export — singleton
// ============================================================

// Eagerly create the singleton so the EventBus listener is registered
// before any 'game:newGameStarted' event fires.
export default TutorialSystem.getInstance();
