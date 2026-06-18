# UI & Visual Design Skill — Realm of Nexus: Verdance

## Purpose

Diagnose and fix visual quality issues across the game's UI, HUD, panels, sprites, and rendering pipeline. Maintain consistency with the established art style. Design new UI elements that match the game's painterly fantasy aesthetic.

## Use This Skill When

- UI elements look blurry, pixelated, or low quality
- Designing new panels, menus, HUD elements, or overlays
- Fixing sprite rendering, scaling, or filtering issues
- Reviewing visual consistency across scenes
- Creating or updating UI layouts and interactions
- Debugging rendering pipeline issues (WebGL, shaders, blend modes)

## Do Not Use This Skill When

- Pure gameplay logic with no visual component
- Data-only changes (JSON content files)
- Server/build tooling changes

---

## Reference Docs (Read Before Any Visual Work)

1. `docs/ART_STYLE.md` — Complete visual identity, palettes, asset specs, UI standards
2. `docs/VISUALS.md` — Lighting, post-processing, camera, particles, VFX, motion tweens
3. `CLAUDE.md` — Architecture, rendering config, known bugs

---

## Rendering Pipeline Rules

### Texture Filtering
- **Global:** `pixelArt: false`, `antialias: true`, `roundPixels: true`
- **High-res art (portraits, backdrops, spell icons):** LINEAR filtering (default)
- **16x16 Kenney tilesets only:** NEAREST filtering (set in BootScene via `gl.texParameteri`)
- **CSS canvas:** `image-rendering: auto; image-rendering: smooth;`
- **Never** set `pixelArt: true` globally — it forces NEAREST on everything

### Blend Modes & Render Textures
- AdvancedLightingSystem uses MULTIPLY blend RT — must `fill(0xffffff, 1)` on creation
- Volumetric glow uses ADD blend RT
- UI elements always at `scrollFactor(0)` with depth 7000-20001

### Known Pitfalls
- `body.y != sprite.y` when `setOffset()` is used — never read `body.y` for visual positioning
- Software WebGL (headless) can't `bindTexture` — wrap in try/catch
- Scene restart leaks EventBus listeners — always cleanup in `destroy()`

---

## UI Design Standards

### Color System
```
Panel backgrounds:  0x1a1a2e (dark navy), 0x0d0d1a (near-black)
Gold accent:        #ffd700 / 0xffd700
HP bar:             green gradient
Sap bar:            blue gradient  
DSP bar:            gold gradient
Error/damage:       #ff4444
Heal/success:       #44ff88
Disabled/locked:    #666666
```

### Talent Tree Colors
```
Martial Prowess:    0xcc6644
Guardian's Oath:    0x4488aa
Soul Magic Mastery: 0xaa44cc
Verdant Bond:       0x44aa66
Tactical Mind:      0x88aa44
```

### Typography
- **Body/UI text:** 'Open Sans', 14-16px
- **Titles/headers:** 'Cinzel', 20-28px, often with stroke
- **Decorative:** 'Cinzel Decorative' for special titles
- **Tooltips:** 12-13px
- Always include `fontFamily` with fallback: `'Open Sans, sans-serif'` or `'Cinzel, serif'`

### Panel Construction Pattern
```javascript
// Standard panel background
const bg = scene.add.graphics();
bg.fillStyle(0x1a1a2e, 0.92);
bg.fillRoundedRect(x, y, w, h, 8);
bg.lineStyle(1.5, 0xffd700, 0.6);
bg.strokeRoundedRect(x, y, w, h, 8);
bg.setScrollFactor(0).setDepth(10000);

// Standard button
const btn = scene.add.graphics();
btn.fillStyle(0x2a2a3e, 1);
btn.fillRoundedRect(bx, by, bw, bh, 6);
btn.lineStyle(1, 0xffd700, 0.5);
btn.strokeRoundedRect(bx, by, bw, bh, 6);

// Hover: brighten bg, gold text
// Click: scale pulse tween (0.96x, 80ms, yoyo)
```

### Sprite Display Sizes (Overworld)
- **Player:** 48-64px (from 266px spritesheet frames, scaled down)
- **NPCs:** 48-64px (from 256px spritesheet frames)
- **Enemies:** 48-80px depending on type (from 256px spritesheet frames)
- **DO NOT** display 512px/640px portrait art as overworld sprites — use spritesheets
- Portrait art is for: dialogue boxes, class selection, character sheets, bestiary

### Spell Bar
- 5 slots across bottom-center of screen
- Each slot: painted frame background + spell icon overlay
- Active spells show icon + colored border matching element
- Empty slots: dark fill (0x444444), label "---"
- Cooldown overlay: semi-transparent dark sweep

### HUD Layout (UIScene)
- **Top-left:** HP bar (green), Sap bar (blue), DSP bar (gold), Level + XP + Gold text
- **Top-center:** Zone name + Sap phase indicator
- **Top-right:** Minimap
- **Bottom-center:** Spell bar (5 slots)
- **Bottom-left:** Quest tracker (collapsible)
- All HUD at scrollFactor(0), depth 15000+

---

## Visual Quality Checklist

When reviewing or fixing visual quality:

1. [ ] Textures render smoothly (no unexpected pixelation on painted art)
2. [ ] Kenney tilesets render crisp (NEAREST filtering active)
3. [ ] UI panels have consistent styling (dark navy bg, gold borders, correct fonts)
4. [ ] Sprites use correct source (spritesheets for overworld, portraits for UI)
5. [ ] Text is readable (correct size, stroke on dark backgrounds, proper font)
6. [ ] Colors match the Sap phase (blue/crimson/silver mood)
7. [ ] Hover states work on interactive elements
8. [ ] Panels are fixed to camera (scrollFactor 0)
9. [ ] No z-fighting or depth ordering issues
10. [ ] Animations use MotionLibrary tweens where applicable

---

## Common Visual Fixes

### Blurry sprites
- Check if `pixelArt: true` is set (should be false)
- Check CSS `image-rendering` on canvas
- Verify texture filtering mode for the specific texture
- Ensure sprites aren't being upscaled past their native resolution

### Wrong sprite showing
- Overworld entities should use spritesheet frames, not portrait PNGs
- Check `GameArt.js` and `ImportedAssets.js` for correct texture key mapping
- Verify `BootScene.js` loads the correct spritesheet with proper frameWidth/frameHeight

### Panel/HUD not visible
- Check depth value (UI should be 7000+, HUD 15000+)
- Check scrollFactor (must be 0 for HUD elements)
- Verify scene is launched (UIScene runs parallel to GameScene)

### Lighting issues
- MULTIPLY RT must be filled white on creation
- Check SapCycleLightingIntegration for correct phase colors
- Verify AdvancedLightingSystem.getBrightnessAt() returns valid values

---

## Asset Pipeline

### Existing Painted Assets
- `public/assets/imported/` — 840+ high-res painted PNGs
- Categories: enemies, npcs, spells, items, ui, backdrops, companions

### Generating New Art
- `scripts/generate-images.mjs` — OpenAI gpt-image-1 API
- Style bible: `docs/NPC_PORTRAIT_PROMPTS.md` section 0
- Default: 1024x1024, high quality
- Output to: `public/assets/imported/{category}/`

### Spritesheet Specs
- Player: 266x266px frames, 6 cols x 18 rows
- Enemies: 256x256px frames, varying grid sizes
- NPCs: 256x256px frames, varying grid sizes
