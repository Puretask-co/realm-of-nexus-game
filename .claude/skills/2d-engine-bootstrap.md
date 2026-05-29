# 2D Engine Bootstrap Skill

## Purpose

Creates the initial architecture for a 2D game project in the chosen engine.
Bootstrap a new or blank repo with a minimal, modular, scalable foundation including folder structure, scenes, state, camera, input, and asset loading.

## Use This Skill When

- Starting a new 2D game repo from scratch
- Converting a blank repo into a game project
- Setting up folder structure, preload, scenes, state, camera, and input
- Creating a starter prototype foundation

## Do Not Use This Skill When

- The project already has a well-established architecture
- The task is only fixing one animation or one bug

---

## Inputs Expected

Before generating the bootstrap, gather the following from the user or infer from repo contents:

| Input | Examples |
|---|---|
| **Engine / Framework** | Phaser 3, Godot 4, Unity, Pygame, LÖVE |
| **Game Type** | platformer, top-down RPG, metroidvania, shooter, puzzle |
| **Language** | TypeScript, JavaScript, GDScript, C# |
| **Desired Systems** | scenes, HUD, save system, combat, inventory, camera |
| **Current Repo Contents** | (inspect before generating — never overwrite existing work) |

---

## Workflow

1. **Inspect the repo** — read existing files, folder structure, package.json / project.godot / etc.
2. **Identify the engine and conventions** — detect framework version, language, and any existing patterns.
3. **Propose minimal scalable architecture** — prefer modular scene/system separation over monolithic files.
4. **Create scene/system breakdown** — define which scenes exist, how they transition, and what each system owns.
5. **Generate bootstrap files** — produce only the starter files needed; keep it minimal but extensible.
6. **Explain next steps** — tell the developer what to implement after the bootstrap is in place.

---

## Rules

- Prefer modular scene/system separation — one responsibility per file.
- Avoid giant monolithic files (no 1000-line `Game.js`).
- Choose naming conventions early and apply them consistently.
- Keep the starter build minimal but extensible.
- Never overwrite files that already contain meaningful implementation.
- Always check repo contents before generating structure.

---

## Outputs Required

Produce all of the following sections in the response:

### `## Project Structure`

A recommended folder tree for the engine and game type. Example (Phaser 3 / JS):

```
src/
  main.js              # entry point, Phaser config
  scenes/
    Boot.js            # asset preload, first scene
    Preload.js         # heavy asset loading with progress bar
    MainMenu.js        # title screen
    Game.js            # primary gameplay scene
    UI.js              # HUD overlay scene (runs in parallel)
    GameOver.js        # end state
  systems/
    InputManager.js    # keyboard/gamepad/touch abstraction
    CameraManager.js   # follow, shake, zoom helpers
    StateManager.js    # global game state / event bus
    SaveManager.js     # localStorage or file I/O wrapper
  entities/
    Player.js          # player class (extends Phaser.Physics.Arcade.Sprite)
    Enemy.js           # base enemy class
  ui/
    HUD.js             # health bar, score, etc.
  utils/
    constants.js       # shared constants (tile size, gravity, layers)
    helpers.js         # utility functions
assets/
  images/
  audio/
  tilemaps/
  spritesheets/
```

Adapt the tree for the actual engine (Godot, Unity, etc.) and game type.

---

### `## Core Systems`

Describe each system and its single responsibility:

- **Boot / Preload** — loads minimal assets first, then transitions to full preload with progress feedback.
- **Scene Manager** — defines scene lifecycle and transitions (fade, cut, overlay).
- **Input Manager** — wraps raw input into named actions (`jump`, `attack`, `pause`); supports remapping.
- **Camera Manager** — player follow with deadzone, screen shake, zoom transitions.
- **State Manager / Event Bus** — holds global state (score, health, flags); emits typed events.
- **Save Manager** — serializes/deserializes state to localStorage (web) or file (native).
- **Asset Loading Strategy** — define what loads in Boot vs Preload vs lazy-loaded on demand.

---

### `## Files To Create`

A numbered list of files to create in implementation order:

1. Entry point / config (`main.js` or `project.godot` settings)
2. Boot scene
3. Preload scene with progress bar
4. Constants / config file
5. Input manager
6. State manager / event bus
7. Camera manager
8. Main game scene (stub)
9. Player entity (stub)
10. HUD scene (stub)
11. Save manager (stub)

---

### `## Starter Code`

Provide ready-to-paste code stubs for each file listed above.
Each stub must:
- Be syntactically correct for the chosen engine and language.
- Include `// TODO:` markers for sections the developer must fill in.
- Import/require only what is actually used.

#### Example stubs (Phaser 3 / JavaScript)

**`src/main.js`**
```js
import Phaser from 'phaser';
import Boot from './scenes/Boot.js';
import Preload from './scenes/Preload.js';
import MainMenu from './scenes/MainMenu.js';
import Game from './scenes/Game.js';
import UI from './scenes/UI.js';
import GameOver from './scenes/GameOver.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 800 }, debug: false },
  },
  scene: [Boot, Preload, MainMenu, Game, UI, GameOver],
};

export default new Phaser.Game(config);
```

**`src/scenes/Boot.js`**
```js
export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // TODO: load loading-bar assets (minimal — just a progress sprite or nothing)
  }

  create() {
    this.scene.start('Preload');
  }
}
```

**`src/scenes/Preload.js`**
```js
export default class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    // Progress bar UI
    const bar = this.add.graphics();
    this.load.on('progress', (v) => {
      bar.clear().fillStyle(0xffffff).fillRect(100, 360, 1080 * v, 20);
    });
    this.load.on('complete', () => bar.destroy());

    // TODO: load all game assets here
    // this.load.image('player', 'assets/images/player.png');
    // this.load.tilemapTiledJSON('level1', 'assets/tilemaps/level1.json');
    // this.load.audio('bgm', 'assets/audio/bgm.ogg');
  }

  create() {
    this.scene.start('MainMenu');
  }
}
```

**`src/systems/InputManager.js`**
```js
export default class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys({
      up:     Phaser.Input.Keyboard.KeyCodes.W,
      down:   Phaser.Input.Keyboard.KeyCodes.S,
      left:   Phaser.Input.Keyboard.KeyCodes.A,
      right:  Phaser.Input.Keyboard.KeyCodes.D,
      jump:   Phaser.Input.Keyboard.KeyCodes.SPACE,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      pause:  Phaser.Input.Keyboard.KeyCodes.ESC,
    });
  }

  isDown(action) { return this.keys[action]?.isDown ?? false; }
  justDown(action) { return Phaser.Input.Keyboard.JustDown(this.keys[action]); }

  // TODO: add gamepad support
  // TODO: add touch virtual buttons for mobile
}
```

**`src/systems/StateManager.js`**
```js
export default class StateManager extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.state = {
      score: 0,
      health: 100,
      // TODO: add additional global state fields
    };
  }

  get(key) { return this.state[key]; }

  set(key, value) {
    this.state[key] = value;
    this.emit(`change:${key}`, value);
  }

  increment(key, amount = 1) { this.set(key, (this.state[key] ?? 0) + amount); }
}
```

**`src/systems/CameraManager.js`**
```js
export default class CameraManager {
  constructor(scene) {
    this.cam = scene.cameras.main;
  }

  follow(target, { lerpX = 0.1, lerpY = 0.1, deadZoneW = 80, deadZoneH = 60 } = {}) {
    this.cam.startFollow(target, true, lerpX, lerpY);
    this.cam.setDeadzone(deadZoneW, deadZoneH);
  }

  shake(duration = 200, intensity = 0.01) {
    this.cam.shake(duration, intensity);
  }

  // TODO: add zoom transitions, fade in/out wrappers
}
```

**`src/systems/SaveManager.js`**
```js
const SAVE_KEY = 'game_save';

export default class SaveManager {
  save(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }

  // TODO: add slot support for multiple saves
  // TODO: replace localStorage with file I/O for non-web targets
}
```

**`src/entities/Player.js`**
```js
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCollideWorldBounds(true);
    this.speed = 200;
    this.jumpForce = -500;

    // TODO: define animations
  }

  update(input) {
    if (input.isDown('left'))       this.setVelocityX(-this.speed);
    else if (input.isDown('right')) this.setVelocityX(this.speed);
    else                            this.setVelocityX(0);

    if (input.justDown('jump') && this.body.onFloor()) {
      this.setVelocityY(this.jumpForce);
    }

    // TODO: handle attack, animation states, damage
  }
}
```

**`src/scenes/Game.js`**
```js
import InputManager from '../systems/InputManager.js';
import CameraManager from '../systems/CameraManager.js';
import Player from '../entities/Player.js';

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.input  = new InputManager(this);
    this.camera = new CameraManager(this);

    // TODO: create tilemap
    // const map = this.make.tilemap({ key: 'level1' });

    this.player = new Player(this, 100, 300);
    this.camera.follow(this.player);

    // Launch HUD as parallel scene
    this.scene.launch('UI');
  }

  update() {
    this.player.update(this.input);
  }
}
```

**`src/ui/HUD.js`** and **`src/scenes/UI.js`**
```js
// scenes/UI.js — runs in parallel with Game
export default class UI extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    // TODO: create health bar, score text, mini-map, etc.
    this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '18px', color: '#fff' });
  }

  update() {
    // TODO: sync UI values from StateManager
  }
}
```

**`src/utils/constants.js`**
```js
export const TILE_SIZE  = 32;
export const GRAVITY    = 800;
export const GAME_W     = 1280;
export const GAME_H     = 720;
export const DEPTH = {
  BACKGROUND: 0,
  WORLD:      10,
  ENTITIES:   20,
  EFFECTS:    30,
  HUD:        40,
};
```

---

### `## Next Steps`

After the bootstrap files are in place, implement in this order:

1. **Asset pipeline** — add real sprites, tilemaps, and audio to `assets/`; register them in Preload.
2. **Tilemap integration** — wire the tilemap in `Game.js`; set up collision layers.
3. **Player animations** — define `anims.create()` calls; link to movement/attack states.
4. **Enemy base class** — extend the entity pattern; add simple patrol AI.
5. **Combat system** — hitboxes, damage events via StateManager, knockback, death.
6. **HUD wiring** — subscribe HUD to StateManager `change:*` events.
7. **Save / load flow** — trigger save on checkpoint; load on game start.
8. **Scene transitions** — add fade/wipe transitions between MainMenu → Game → GameOver.
9. **Audio manager** — wrap `this.sound` into a manager with volume, mute, and BGM crossfade.
10. **Polish** — screen shake on hit, particle effects, camera zoom on boss entry.
