# Art Style Guide — Realm of Nexus: Verdance

## Visual Identity

- Stylized painterly 2D, semi-realistic digital illustration
- Rich brush texture with soft volumetric lighting
- NOT photoreal, NOT flat vector, NOT pixel art
- High-end RPG dialogue portrait / character-select card quality
- Cohesive hand-painted look with crisp focal face, painterly fall-off toward edges

## World Aesthetic

- "Verdance" — bioluminescent forest-fantasy realm grown from the Everwood (great world-tree)
- Overgrown organic architecture of living wood, sap, moss, vines, glowing fungi, drifting spores
- Ancient stone reclaimed by nature
- High fantasy with dark-academia / folk-mystic undertone

## Color Palette

Base palette: forest greens, earth browns, ancient-stone grey.

### Sap Cycle Lighting Moods

| Phase | Description | Ambient | Intensity | Light Tint | Fog |
|---|---|---|---|---|---|
| Blue Sap | Cool moonlit blues and silvers, calm, glassy highlights | `0x0a1a3a` | 0.2 | `0x6699ff` | `0x0d1b2a` |
| Crimson Sap | Warm reds and deep oranges, charged, dramatic rim light | `0x3a0a0a` | 0.18 | `0xff6633` | `0x2a0d0d` |
| Silver Sap | Pale ethereal silver-white, dreamlike, low-contrast glow | `0x2a2a35` | 0.25 | `0xccccee` | `0x1e1e28` |

### Faction Visual Language

| Faction | Motifs | Colors |
|---|---|---|
| **Emerald Coven** | Emerald robes, leaf/petal motifs, glowing green sap-glyph tattoos, woven-bark trim | Deep emerald green, gold accents |
| **Bloomguard** | Radiant living-wood + gold-and-white armor, flowering crests, halberds, blooming shields | Gold, white, forest green |
| **Thornbinder** | Dark hooded leathers, thorn/toxin motifs, muted purples/blacks, concealed blades | Deep purple, black, poison green |
| **Wildkin Pact** | Fur, hide, bone, feathers, claw jewelry, feral tribal accents, animal companions | Earth brown, amber, forest tones |
| **Sporecaller Syndicate** | Mushroom-cap headwear, spore pouches, bioluminescent fungal growths, olive/violet alchemical gear | Olive, violet, bioluminescent blue-green |
| **Verdant Consortium** | Ornate trade finery, brass, gilding, ledgers, coin, polished mercantile sheen | Brass, burgundy, rich brown |

### Ancestry Visual Cues

| Ancestry | Appearance |
|---|---|
| **Human** | Ordinary mortal features, no innate glow; adaptable |
| **Soulborn** | Faintly luminous skin, soul-resonant eyes glowing with DSP light, subtle drifting soul-motes |
| **Half-Abyss** | Dark void-crystal or purple-black veining on mortal features, one faintly void-touched eye |
| **Sylvan** | Bark-like skin, leaf/petal hair, blossoms and lichen, deep bond to plant life |
| **Stoneborn** | Mineral-veined skin, embedded crystalline growths, hardy, naturally corruption-resistant |
| **Wispkin** | Ethereal and quick, pale translucent features, born of Silver Sap currents |

## Rendering Configuration

| Setting | Value |
|---|---|
| `pixelArt` | `false` |
| `antialias` | `true` |
| `roundPixels` | `true` |

- High-res painted art uses LINEAR (smooth) texture filtering
- Only 16x16 Kenney tilesets use NEAREST filtering (set manually in BootScene)
- CSS: `image-rendering: auto/smooth` on canvas

## Asset Resolutions

| Asset Type | Resolution |
|---|---|
| Enemy/boss paintings | 640x640px |
| NPC portraits | 512x512px |
| Scene backdrops | 768x768px |
| Character sprite sheets | 64x64px frames (downscaled 4x from 256px originals for boot speed) |
| Spell/item icons | 192-256px |
| UI elements | High-quality painted PNGs |
| Kenney tilesets | 16x16px per tile |

## UI Design Standards

### Colors

| Role | Value |
|---|---|
| Panel backgrounds | `0x1a1a2e` (dark navy), `0x0d0d1a` (near-black) |
| Gold accent | `#ffd700` |
| HP bar | Green gradient |
| Sap bar | Blue gradient |
| DSP bar | Gold gradient |
| Error/damage | `#ff4444` |
| Heal/success | `#44ff88` |
| Disabled/locked | `#666666` |

### Talent Tree Colors

| Tree | Color |
|---|---|
| Martial Prowess | `0xcc6644` |
| Guardian's Oath | `0x4488aa` |
| Soul Magic Mastery | `0xaa44cc` |
| Verdant Bond | `0x44aa66` |
| Tactical Mind | `0x88aa44` |

### Typography

| Usage | Font | Size |
|---|---|---|
| Body / UI text | Open Sans (Google Fonts) | 14-16px |
| Titles / headers | Cinzel (Google Fonts) | 20-28px |
| Decorative / special titles | Cinzel Decorative (Google Fonts) | — |
| Tooltips | — | 12-13px |

### Panel Design

- Rounded corners (6-10px radius)
- Semi-transparent dark backgrounds (0.8-0.95 alpha)
- Thin colored borders matching context (1-2px)
- Hover states: brighten background, gold text color
- Click feedback: scale pulse tween (0.96x for 80ms, yoyo)
- Scroll factor 0 (fixed to camera)
- Depth range: 7000-20001 for UI elements

## Portrait & Character Art Framing

- Three-quarter (3/4) front-facing bust-to-chest portrait
- Subject centered, eye-level camera
- Authority/leader figures: slight low (heroic) angle
- Fragile/mystic figures: slight high angle
- Subject occupies ~70% of frame
- Aspect ratio: 3:4 (portrait) or 1:1 (card)
- Background: soft bokeh of relevant environment (forest, cavern, sanctum)

## Image Generation

- **Tool:** `scripts/generate-images.mjs` (OpenAI gpt-image-1 API)
- **Default size:** 1024x1024
- **Quality:** high
- **Style bible:** see `docs/NPC_PORTRAIT_PROMPTS.md` section 0
- All prompts should be prepended with the style bible block
- **Output to:** `public/assets/imported/{category}/`

## VFX Color Language

| Effect | Color(s) |
|---|---|
| Fire spells | Orange-red (`0xff4400` -> `0x440000`) |
| Ice spells | Cyan-white (`0x88ccff`) |
| Nature / verdant | Emerald green (`0x44dd44`, `0x33ff77`) |
| Shadow / void | Deep purple-black (`0x330066`, `0x660099`) |
| Radiant / light | Warm gold-white (`0xffffaa`, `0xffffff`) |
| Spirit | Soft blue (`0x88aaff`) |
| Thunder | Bright yellow (`0xffff00`) |
| Healing | Soft green (`0x44ff88`) |
| Damage | Warm orange (`0xffaa44`) |
| Level-up | Rich gold (`0xffdd44`) |

## Zone Visual Types

| Zone | Visual Description |
|---|---|
| **Hub (Canopy of Life)** | Warm forest green, living wood platforms, market lanterns |
| **Forest** | Deep green canopy, dappled light, glowing eyes in shadows |
| **Dungeon** | Dark stone, torch flicker, corruption veins |
| **Sacred Grove** | Sunlit clearings, cascading sap-falls, flower carpets |
| **Fungal Cavern** | Bioluminescent mushrooms, pulsing mycelial networks |
| **Crystal Cave** | Prismatic light refractions, mineral formations |
| **Void / Corruption** | Purple-black void tears, corruption crystals, distorted space |
| **Boss Arena** | Dramatic lighting, confined space, environmental hazards |
