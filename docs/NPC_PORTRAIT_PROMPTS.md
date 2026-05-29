# NPC Character Profile Portrait Prompts — *Realm of Nexus: Verdance*

Comprehensive, copy-paste image-generation prompts for every NPC in the game.
Built to match the established art bible (see `data/veilkeepers.json` `portrait` fields),
the world/theme of the PRD, and the ancestry/class/faction lore in `data/*.json`.

**How to use:** prepend the **Style Bible** block to any single character prompt, then
append that character's **Subject** block. The combined text is one complete prompt
suitable for DALL·E / Midjourney / Stable Diffusion / ChatGPT image tools. Each
character also lists its in-game **UI accent color** (`nameColor` from `dialogues.json`)
so the portrait's palette can be tied to the dialogue UI.

---

## 0. STYLE BIBLE (prepend to every prompt)

> **Style & medium:** Stylized painterly 2D fantasy character portrait, semi-realistic
> digital illustration, clean rendering with rich brush texture and soft volumetric
> lighting — in the style of a high-end RPG dialogue portrait / character-select card.
> Cohesive hand-painted look (NOT photoreal, NOT flat vector, NOT pixel art). Crisp
> focal face, painterly fall-off toward the edges.
>
> **World / theme:** "Verdance" — a living, bioluminescent forest-fantasy realm grown
> from the great world-tree, the **Everwood**. Overgrown organic architecture of living
> wood, sap, moss, vines, glowing fungi and drifting spores; ancient stone reclaimed by
> nature. High fantasy with a dark-academia / folk-mystic undertone.
>
> **Camera & framing:** Character profile shot — **three-quarter (¾) front-facing
> bust-to-chest portrait, subject centered, eye-level camera**, head and shoulders
> dominant, shallow depth of field. Authority/leader figures may use a slight low
> (heroic) angle; fragile/mystic figures a slight high angle. Subject occupies ~70% of
> frame. Aspect ratio 3:4 (portrait) or 1:1 (card).
>
> **Lighting (Sap Cycle moods — pick to fit the character):**
> - *Default ambient:* dappled emerald forest light, warm key + cool green fill.
> - *Blue Sap phase:* cool moonlit blues and silvers, calm, glassy highlights.
> - *Crimson Sap phase:* warm reds and deep oranges, charged, dramatic rim light.
> - *Silver Sap phase:* pale ethereal silver-white, dreamlike, low-contrast glow.
>
> **Base palette:** forest greens, earth browns, ancient-stone grey, with
> **bioluminescent accent glows** (sap-light) keyed to the character's faction/role.
>
> **Faction visual language:**
> - **Emerald Coven** (druids/mystics/scholars): emerald robes, leaf & petal motifs,
>   glowing green sap-glyph tattoos, woven-bark trim.
> - **Bloomguard** (holy warriors): radiant living-wood + gold-and-white armor,
>   flowering crests, halberds, blooming shields, paladin bearing.
> - **Thornbinder** (shadow operatives/assassins): dark hooded leathers, thorn and
>   toxin motifs, muted purples/blacks, concealed blades.
> - **Wildkin Pact** (beast rangers): fur, hide, bone, feathers, claw jewelry, feral
>   tribal accents, animal companions.
> - **Sporecaller Syndicate** (fungal shamans): mushroom-cap headwear, spore pouches,
>   bioluminescent fungal growths, olive/violet alchemical gear.
> - **Verdant Consortium** (merchants/industry): ornate trade finery, brass, gilding,
>   ledgers and coin, polished mercantile sheen.
>
> **Ancestry cues (when relevant):**
> - *Sunpetal:* radiant humanoid, petal-like hair, sun-warmed glowing skin.
> - *Shadeborn:* dusky twilight skin, shadow affinity, faintly smoking edges.
> - *Stoneblood:* stocky, bark-like skin with embedded mineral/crystal deposits.
> - *Emberfae:* small fae with smoldering ember wings, fiery eyes.
> - *Echo:* spectral, partially translucent, ethereal dead-that-linger.
>
> **Negative / avoid:** no text, no watermark, no logos, no modern/sci-fi objects, no
> frame borders, no extra limbs, no harsh flat lighting, consistent single art style
> across the whole cast.

---

## 1. CANOPY OF LIFE — Tier-1 Hub NPCs (full character data)

### Elder Thalos — Elder Sage & Wisdom Keeper
**Faction:** Emerald Coven · **Location:** Canopy of Life / Canopy Overlook · **UI accent:** `#44ff88`
> ¾ bust portrait of **Elder Thalos**, an ancient, kindly Sunpetal sage and keeper of
> Verdance's wisdom. Deeply lined, sun-warmed face framed by a long silver-green beard
> braided with tiny living leaves and budding white flowers; petal-textured white hair.
> Heavy emerald-and-moss Coven robe with woven-bark shoulder mantle and a carved
> heartwood staff topped with a softly glowing green sap-crystal. Warm, patient, far-seeing
> eyes that glow faint green. Pose: serene, one hand resting on the staff, the other
> open in welcome. Background: the high canopy hub at golden dappled dusk, hanging
> lanterns of captured sap-light, bokeh of vast tree-boughs. Default ambient lighting
> with a **`#44ff88` emerald sap-glow** rim. Wise, grandfatherly, mentor energy.

### Lyra the Herbalist — Herbalist & Healer
**Faction:** Emerald Coven · **Location:** Canopy of Life · **UI accent:** `#88ff44`
> ¾ bust portrait of **Lyra the Herbalist**, a warm, capable young Sunpetal healer.
> Freckled sun-warmed skin, leaf-green eyes, hair the green of new shoots tied back with
> a vine and tucked with sprigs of medicinal herbs. Layered apothecary garb — linen
> tunic, leather satchel of glass vials and dried bundles, mortar-and-pestle at the hip,
> stained working gloves. Holding a glowing healing poultice / luminous herb. Kind,
> attentive expression, slight knowing smile. Background: a sunlit herb-drying alcove
> in the canopy hub, hanging bundles of plants, jars of glowing sap. Default ambient
> light with bright **`#88ff44` chartreuse leaf-glow**. Nurturing, grounded, practical.

### Archivist Kael — Knowledge & Lore Keeper
**Faction:** Emerald Coven · **Location:** Canopy of Life · **UI accent:** `#4488ff`
> ¾ bust portrait of **Archivist Kael**, a scholarly Shadeborn lore-keeper. Dusky
> twilight skin, sharp intelligent eyes lit faint blue, dark hair streaked with grey,
> ink-stained fingertips. Deep-blue scholar's robe over a buttoned vest, a bandolier of
> rolled scrolls, brass-rimmed reading lenses pushed up on the brow. Holding an open,
> faintly glowing tome with floating annotation glyphs. Reserved, precise, faintly weary
> expression. Background: a candlelit archive of living-wood shelves crammed with books
> and scroll-cases, motes of dust in shafts of cool light. Cool **`#4488ff` blue
> sap-glyph glow**. Studious, methodical, archivist energy.

### Merchant Orla — Trader
**Faction:** Verdant Consortium · **Location:** Canopy of Life · **UI accent:** `#ffaa44`
> ¾ bust portrait of **Merchant Orla**, a shrewd, jovial Stoneblood trader. Stocky,
> bark-textured skin with small amber-mineral flecks at the temples, hearty grin, gold
> tooth, eyes quick with appraisal. Ornate Consortium merchant finery — embroidered
> coat with brass buttons, jingling coin-pouches, rings, a fur-trimmed collar. One hand
> presenting a glowing trade-gem, the other resting on a ledger. Background: a bustling
> market stall under striped awnings, hanging wares and lanterns, warm amber bokeh.
> Warm **`#ffaa44` amber gilded glow**. Charismatic, deal-making, larger-than-life.

### Commander Briara — Military Leader
**Faction:** Bloomguard · **Location:** Canopy of Life / Bloomguard Barracks · **UI accent:** `#44cc44`
> ¾ bust portrait (slight heroic low angle) of **Commander Briara**, a stern Sunpetal
> Bloomguard commander. Strong jaw, battle-scarred cheek, close-cropped golden-green
> hair, resolute glowing eyes. Radiant living-wood plate armor in green-and-gold with a
> flowering crest at the shoulder, a Bloomguard tabard, blooming pauldrons. One gauntleted
> fist over the heart in salute, halberd visible behind. Commanding, unyielding expression.
> Background: the barracks parade ground, banners of the Bloomguard, soft gold light
> through the canopy. Authoritative **`#44cc44` verdant-gold glow** rim. Disciplined,
> protective, born-leader energy.

### Archdruid Veyla — High Druid / Nature Magic
**Faction:** Emerald Coven (leader) · **Location:** Canopy of Life / Emerald Sanctum · **UI accent:** `#66aaff`
> ¾ bust portrait of **Archdruid Veyla**, the serene and powerful high priestess of the
> Everwood. Ageless Sunpetal features, luminous blue-green eyes, flowing hair like living
> moss woven with blossoms and antler-like branch ornaments crowning her head. Ceremonial
> Archdruid vestments of deep emerald and silver, glowing sap-glyphs spiraling up her arms,
> a circlet of light. Hands cupped around a hovering orb of green Everwood energy.
> Tranquil, otherworldly, faintly sorrowful authority. Background: the inner Emerald
> Sanctum, a colossal glowing heart-tree, drifting pollen-light. Cool **`#66aaff`
> celestial sap-glow**. Mystical, regal, high-priestess energy.

### Beastcaller Yenna — Animal Companion Specialist
**Faction:** Wildkin Pact · **Location:** Canopy of Life / Wildkin Hunting Grounds · **UI accent:** `#cc8844`
> ¾ bust portrait of **Beastcaller Yenna**, a feral, watchful Wildkin ranger. Weathered
> tan skin with painted clay markings, sharp amber eyes, wild braided hair threaded with
> feathers, bone beads and claws. Hide-and-fur garb, a fanged-pelt mantle over one
> shoulder, talon necklace, leather bracers. A small glowing-eyed forest beast (sap-lynx
> or hawk) perched at her shoulder. Half-wild, alert expression mid-whistle/call.
> Background: deep wild forest, glowing animal eyes in the gloom, shafts of green light.
> Earthy **`#cc8844` amber-bronze glow**. Primal, bonded-to-nature energy.

### Seer Althea — Diviner / Future Sight
**Faction:** Mystic (Veil) · **Location:** Canopy of Life / Whispering Veil · **UI accent:** `#cc66ff`
> ¾ bust portrait (slight high angle) of **Seer Althea**, an enigmatic Shadeborn
> oracle. Smoky violet-tinged skin, eyes pure swirling starlight with no pupils, dark
> hair drifting as if underwater. Diaphanous violet seer's veils and layered shawls
> stitched with constellation thread, a third-eye gem on the brow. Hands hovering over a
> glowing scrying orb / floating tarot-like cards. Distant, prophetic, half-here
> expression. Background: the Whispering Veil — shimmering curtains of light, drifting
> motes, indistinct future-visions. Dreamy **`#cc66ff` violet glow**. Cryptic, fey,
> fortune-teller energy.

### Smith Garon — Blacksmith / Equipment Crafter
**Faction:** Craftsman (neutral) · **Location:** Canopy of Life · **UI accent:** `#cc6644`
> ¾ bust portrait of **Smith Garon**, a gruff, powerful Stoneblood blacksmith. Broad,
> bark-skinned, soot-streaked, with glowing-ember mineral veins along thick forearms, a
> singed beard, heavy brow, no-nonsense scowl. Leather apron over a sleeveless tunic,
> heat-scarred gloves, hammer over one shoulder, tongs at the belt. Backlit by a forge.
> Background: a living-wood-and-stone smithy, glowing forge, sparks, hung weapons and
> tools. Hot **`#cc6644` ember-copper glow** from below. Burly, taciturn, master-craftsman
> energy.

### Sporecaller Mycel — Fungal Magic Specialist
**Faction:** Sporecaller Syndicate · **Location:** Canopy of Life / Mycelium Nexus · **UI accent:** `#88cc44`
> ¾ bust portrait of **Sporecaller Mycel**, an alien, soft-spoken fungal shaman.
> Pale, slightly translucent skin with faint mycelial veining, mismatched glowing eyes,
> a living mushroom-cap cowl sprouting from the hood, tiny luminous fungi growing along
> the collarbone. Olive-and-violet alchemical robes, spore-pouches, a staff capped with
> a glowing bracket-fungus. Releasing a slow drift of glowing spores from an open palm.
> Otherworldly, gentle, unsettling-calm expression. Background: the Mycelium Nexus — vast
> glowing fungal caverns, pulsing networks of light. Bio-luminous **`#88cc44` spore-glow**.
> Strange, symbiotic, fungal-mystic energy.

### Trainer Borsk — Combat Trainer
**Faction:** Military affiliate · **Location:** Canopy of Life · **UI accent:** `#cc8866`
> ¾ bust portrait of **Trainer Borsk**, a stern veteran combat instructor. Scarred,
> weather-beaten Stoneblood with a broken-and-healed nose, grey-bristle hair, a hard
> appraising stare. Practical training leathers and a padded gambeson, a wooden practice
> sword across the back, bracers worn from use. Arms crossed, judging your stance.
> Background: a training yard with weapon racks, straw dummies, dusty light. Muted
> **`#cc8866` tan-rose glow**. Tough, demanding, drill-instructor energy.

### Innkeeper Maren — Tavern Keeper
**Faction:** Neutral · **Location:** Canopy of Life · **UI accent:** `#ffcc88`
> ¾ bust portrait of **Innkeeper Maren**, a warm, hospitable tavern keeper. Rosy-cheeked
> Sunpetal with laugh lines, hair in a practical bun with a flower tucked behind the ear,
> sleeves rolled up. Apron over a homespun dress, a dish-towel over one shoulder,
> presenting a foaming tankard of glowing sap-ale. Welcoming, motherly smile.
> Background: a cozy inn interior of warm living-wood, a crackling hearth, hanging mugs,
> golden lantern bokeh. Cozy **`#ffcc88` warm-cream glow**. Friendly, comforting,
> hearth-keeper energy.

### Guard Captain Reyla — Bloomguard Officer
**Faction:** Bloomguard · **Location:** Canopy of Life · **UI accent:** `#44cc88`
> ¾ bust portrait of **Guard Captain Reyla**, a sharp, vigilant Bloomguard officer.
> Alert green-glowing eyes, dark hair in a tight braid, a thin duty-scar on the chin,
> composed authority. Polished green-and-silver guard armor with a captain's flowering
> sigil, a halberd at the ready behind her, a horn at the belt. Watchful, dutiful
> expression scanning the viewer. Background: a guarded canopy gatehouse, banners, crisp
> daylight. Clean **`#44cc88` teal-green glow**. Vigilant, by-the-book, sentinel energy.

### Merchant Lirel — Trader
**Faction:** Verdant Consortium · **Location:** Canopy of Life / Verdant Exchange · **UI accent:** `#ffaa44`
> ¾ bust portrait of **Merchant Lirel**, a slick, fast-talking Shadeborn trader. Dusky
> skin, a thin moustache, a perpetual sly grin, darting eyes. Fashionable Consortium
> coat with too many rings, a coin-counting abacus-charm, silk scarf. Fanning out
> glowing trade-gems with theatrical flourish. Background: the Verdant Exchange trading
> floor, stalls, hanging price-boards (no text), warm amber bokeh. Warm **`#ffaa44`
> gilt-amber glow**. Smooth-talking, opportunist, salesman energy.

### Drillmaster Torvak — Combat Instruction
**Faction:** Bloomguard · **Location:** Bloomguard Barracks · **UI accent:** `#44cc44`
> ¾ bust portrait of **Drillmaster Torvak**, a barrel-chested, bellowing drill master.
> Stoneblood with a square jaw, shaved head, a thick neck and a permanent shout half-formed
> on his face. Bloomguard barracks armor, sleeves cut to show bark-mineral forearms, a
> drill-baton in hand. Background: the barracks drill yard, recruits in soft focus,
> dusty gold light. Verdant **`#44cc44` glow**. Loud, disciplined, no-excuses energy.

### Acolyte Ferrin — Apprentice Scholar
**Faction:** Emerald Coven · **Location:** Emerald Sanctum · **UI accent:** `#66aaff`
> ¾ bust portrait of **Acolyte Ferrin**, an eager, wide-eyed young Coven acolyte.
> Youthful Sunpetal face, hopeful glowing eyes, neatly combed sprout-green hair, a few
> nervous freckles. Simple novice's emerald robe slightly too big, a satchel of study
> scrolls clutched to the chest, a single faint sap-glyph on one hand. Earnest,
> over-eager smile. Background: the Emerald Sanctum's study cloister, glowing vines,
> soft blue light. Gentle **`#66aaff` glow**. Bright-eyed, devoted, apprentice energy.

### Keeper of Echoes — Mysterious Memory Keeper
**Faction:** Veil order · **Location:** Whispering Veil · **UI accent:** `#aabbdd`
> ¾ bust portrait of the **Keeper of Echoes**, a cryptic, half-faded Echo ancestry
> figure. Partially translucent pale-grey form, hollow luminous eyes, a face that seems
> to flicker between expressions, wisps of memory-light trailing from the edges. Tattered
> pale-grey ceremonial robes hung with hundreds of tiny memory-bells and suspended
> glowing echo-fragments. Hands cupping a floating sphere of recorded whispers. Distant,
> mournful, knowing expression. Background: the Whispering Veil's echo chamber, layered
> ghost-silhouettes, pale shimmering curtains. Faint **`#aabbdd` silver-blue glow**.
> Haunting, liminal, memory-keeper energy.

### Wandering Herbalist — Mobile Healer
**Faction:** Independent · **Location:** Spindlewood Forest · **UI accent:** `#88ff44`
> ¾ bust portrait of the **Wandering Herbalist**, a road-worn travelling healer. Sun-
> and weather-tanned, crow's-feet, a kind tired smile, hair under a wide woven hat strung
> with drying herbs. A patched travelling cloak, an enormous backpack of bundled plants,
> hanging gourds and glowing vials, a walking staff. Offering a sprig of glowing remedy.
> Background: a misty forest trail at dawn, ferns, drifting spores. Soft **`#88ff44`
> green glow**. Itinerant, gentle, folk-healer energy.

### Trader Boskyn — Secondary Merchant
**Faction:** Verdant Consortium · **Location:** Verdant Exchange · **UI accent:** `#ffaa44`
> ¾ bust portrait of **Trader Boskyn**, a heavyset, gruff-but-fair caravan merchant.
> Stoneblood with a thick grey beard, a leather eyepatch, a careful negotiator's frown.
> Travel-worn but sturdy Consortium coat, a strongbox under one arm, a coin-scale in hand.
> Background: a loaded trade caravan at the Exchange, crates and pack-beasts in soft focus.
> Warm **`#ffaa44` amber glow**. Seasoned, blunt, road-merchant energy.

---

## 2. CANOPY OF LIFE — Tier-1 Specialists & Watchers

### Archivist Scroll — Records Keeper
**Faction:** Emerald Coven · **UI accent:** `#4488ff`
> ¾ bust portrait of **Archivist Scroll**, a fussy, meticulous record-keeper. Thin
> Shadeborn with pinched features, half-moon reading lenses, ink-stained cuffs, hair
> escaping a tight knot. Blue archivist's robe layered with quill-holsters and a
> bandolier of labelled scroll-tubes; a self-inking quill floats beside the head. Peering
> disapprovingly over the lenses. Background: towering record-stacks, ladder rails,
> drifting dust in cool light. **`#4488ff` blue glow**. Pedantic, orderly, clerk energy.

### Herbalist Tansy — Herbalist
**Faction:** Emerald Coven · **UI accent:** `#88ff44`
> ¾ bust portrait of **Herbalist Tansy**, a cheerful, chatty young herb-grower.
> Round Sunpetal face, dirt-smudged cheeks, flower-crown of real blossoms, bright grin.
> Gardening smock with seed-pockets, a trowel and a potted glowing seedling cradled in
> the arms. Background: a terraced canopy garden bursting with luminous flowers, butterflies.
> Bright **`#88ff44` glow**. Bubbly, green-thumbed, gardener energy.

### Director Orin — Consortium Director
**Faction:** Verdant Consortium (leader) · **Location:** Canopy / Sapling Plantation · **UI accent:** `#cc9944`
> ¾ bust portrait (slight low angle) of **Director Orin**, a cold, polished corporate
> magnate of the Consortium. Sleek Shadeborn, immaculate, calculating amber eyes, oiled
> dark hair, a thin diplomat's smile that never reaches the eyes. Expensive gilded
> business-robes with a director's medallion, gloved hands steepled, a glowing ledger-orb
> hovering nearby. Background: a lavish plantation office of dark wood and gold, a window
> onto industrial sapling rows. Cold **`#cc9944` gold glow**. Imperious, profit-driven,
> magnate energy.

### Sentinel Ash — Guardian Sentinel
**Faction:** Bloomguard / Wildkin watch · **UI accent:** `#668844`
> ¾ bust portrait of **Sentinel Ash**, a silent, statue-still forest guardian. Tall
> Stoneblood with moss-grown bark armor fused to the skin, glowing slit eyes, a stoic
> face half-covered by a leaf-iron helm. Living-wood pauldrons, a longbow and a tall
> shield. Background: a misty boundary-watchtower among ancient trunks. Olive **`#668844`
> glow**. Stoic, immovable, watchman energy.

### Veil Watcher — Veil Sentinel
**Faction:** Veil order · **UI accent:** `#8866aa`
> ¾ bust portrait of the **Veil Watcher**, an eerie sentinel of the boundary between
> worlds. Hooded figure, face shadowed save for two violet pinpoint eyes, faint veil-mist
> pouring from the sleeves. Dusk-purple robes embroidered with watching-eye sigils, a
> lantern of trapped twilight. Background: a shimmering tear in reality, drifting veil-light.
> **`#8866aa` violet glow**. Ominous, watchful, threshold-guardian energy.

### Grove Tender — Grove Caretaker
**Faction:** Emerald Coven · **UI accent:** `#44aa66`
> ¾ bust portrait of the **Grove Tender**, a gentle caretaker of sacred groves. Soft-
> featured Sunpetal with moss-green hair full of growing sprouts, soil under the nails,
> a peaceful half-smile. Simple green tender's wrap, pruning shears, a watering-gourd of
> glowing sap. Background: a sunlit sacred grove of blossoming saplings. Mossy **`#44aa66`
> glow**. Patient, nurturing, gardener-monk energy.

### Ironbark Smith — Armorer
**Faction:** Craftsman · **UI accent:** `#aa6644`
> ¾ bust portrait of the **Ironbark Smith**, a master armorer who forges living-wood
> plate. Burly Stoneblood, bark-and-iron skin, a leather mask pushed up, a proud scowl.
> Heavy apron, ironbark gauntlets, a glowing-edged forging chisel. Background: an armory
> forge hung with living-wood breastplates. Rust-copper **`#aa6644` glow**. Sturdy,
> proud, armorer energy.

### Sap Weaver — Sap Artisan
**Faction:** Emerald Coven · **UI accent:** `#66aacc`
> ¾ bust portrait of the **Sap Weaver**, a delicate artisan who spins liquid sap into
> light-thread. Slender Sunpetal with luminous threadwork tattoos on the hands,
> calm focused eyes. Pale teal robes, finger-mounted spindles drawing glowing sap into
> floating ribbons of light. Background: a workshop strung with shimmering sap-tapestries.
> Cool **`#66aacc` glow**. Graceful, meditative, weaver energy.

### Thorn Sentinel — Thornbinder Guard
**Faction:** Thornbinder · **UI accent:** `#88aa44`
> ¾ bust portrait of the **Thorn Sentinel**, a coiled, dangerous thorn-guard. Lean
> Shadeborn, half-masked, narrowed eyes, thorn-vine tattoos creeping up the neck. Dark
> mossy-green leathers studded with real thorns, a barbed glaive. Background: an
> overgrown thorn-wall safehouse entry, deep shadow. Acid-green **`#88aa44` glow**.
> Tense, lethal, sentinel-assassin energy.

### Crystal Singer — Crystal Mystic
**Faction:** Emerald Coven · **Location:** Glinting Groves · **UI accent:** `#aaccff`
> ¾ bust portrait of the **Crystal Singer**, an ethereal mystic who sings to sap-crystals.
> Translucent-skinned Echo/Sunpetal, hair like spun glass, eyes glowing pale blue, mouth
> mid-note. Robes of resonant crystal facets and pale silk, floating singing-crystals
> orbiting the head. Background: the Glinting Groves — a cavern of giant glowing crystals.
> Icy **`#aaccff` glow**. Luminous, harmonic, song-mystic energy.

### Moss Elder — Ancient Caretaker
**Faction:** Emerald Coven · **UI accent:** `#559966`
> ¾ bust portrait of the **Moss Elder**, an immensely old, half-plant elder. Bark-skinned
> Stoneblood so ancient that moss and tiny ferns grow from the shoulders and brow; slow,
> deep-set glowing eyes. A robe indistinguishable from forest floor, a root-staff.
> Background: a primordial moss-cloaked hollow. Deep **`#559966` glow**. Venerable,
> earthen, tree-elder energy.

### Spore Guide — Mycelium Guide
**Faction:** Sporecaller Syndicate · **Location:** Mycelium Nexus · **UI accent:** `#99bb66`
> ¾ bust portrait of the **Spore Guide**, a friendly guide through the fungal tunnels.
> Pale fungal-touched skin, glowing freckle-spores, a mushroom-cap hat, an open helpful
> grin. Practical spore-rigger's gear, a glowing lantern-mushroom on a pole. Background:
> the luminous Mycelium Nexus tunnels. Olive **`#99bb66` glow**. Helpful, earthy,
> guide energy.

### Root Speaker — Earth Communer
**Faction:** Wildkin / Coven · **UI accent:** `#776633`
> ¾ bust portrait of the **Root Speaker**, a mud-caked mystic who listens to the roots.
> Earth-toned Stoneblood, clay-painted face, eyes closed in listening, roots braided into
> the hair. Simple root-fiber robes, hands pressed to a glowing root bundle. Background:
> a dim under-root chamber threaded with glowing rootlight. Brown **`#776633` glow**.
> Grounded, oracular, root-mystic energy.

### Canopy Scout — Treetop Ranger
**Faction:** Wildkin Pact / Bloomguard scouts · **UI accent:** `#44cc88`
> ¾ bust portrait of the **Canopy Scout**, a nimble treetop lookout. Lithe, wind-burned,
> sharp eyes, a feather in the hair, a confident half-grin. Light leather scouting garb,
> a coiled climbing-line, a shortbow, a spyglass at the belt. Background: a dizzying
> high-canopy lookout, sea of treetops, bright sky. Teal **`#44cc88` glow**. Agile,
> watchful, scout energy.

### Hollow Sage — Abyss-Touched Sage
**Faction:** Veil / Hollowed · **UI accent:** `#667788`
> ¾ bust portrait of the **Hollow Sage**, a grey, half-hollowed seeker of forbidden
> truths. Ashen-grey skin with faint void-cracks at the temples leaking dim light, one
> dark void-eye and one human eye, a hollow stare. Tattered grey-slate robes, a staff of
> petrified wood. Background: the edge of a hollowed grove, dead trees, cold mist.
> Desaturated **`#667788` grey-blue glow**. Bleak, fading, doom-sage energy.

### Ember Guard — Fire-Warden
**Faction:** Bloomguard / volcanic watch · **UI accent:** `#cc6644`
> ¾ bust portrait of the **Ember Guard**, a fierce warden of the volcanic sap-vents.
> Emberfae-touched, ember-glowing eyes, smoldering crack-lines across dark skin, short
> singed hair. Heat-blackened plate with glowing seams, a brazier-tipped poleaxe.
> Background: glowing lava-sap vents, drifting embers. Hot **`#cc6644` ember glow**.
> Fiery, vigilant, fire-warden energy.

### Dew Collector — Water Gatherer
**Faction:** Independent · **UI accent:** `#88ccaa`
> ¾ bust portrait of the **Dew Collector**, a quiet gatherer of morning sap-dew. Soft
> features, damp-curled hair, calm misty-green eyes. Light dew-catcher's garb hung with
> tiny glass collecting-bulbs, a glowing dew-flask. Background: a dawn fern-glade beaded
> with luminous dew. Pale **`#88ccaa` glow**. Serene, humble, gatherer energy.

### Bark Carver — Woodcraft Artisan
**Faction:** Craftsman · **UI accent:** `#996633`
> ¾ bust portrait of the **Bark Carver**, a focused craftsman of carved living-wood.
> Stoneblood with sawdust in the beard, squinting concentration, wood-shaving flecks.
> Carver's apron, chisels in a chest-roll, holding a half-finished glowing wood-totem.
> Background: a workshop of carved masks and totems. Warm **`#996633` glow**. Skilled,
> absorbed, carver energy.

### Vine Tender — Vine Caretaker
**Faction:** Emerald Coven · **UI accent:** `#66aa77`
> ¾ bust portrait of the **Vine Tender**, a caretaker who trains the living vines. Lithe
> Sunpetal, vine-wrapped forearms, leaf-green eyes, a gentle focused look. Green tender's
> garb, a pruning hook, glowing vine-tendrils curling toward the hands. Background: a
> hanging-garden wall of luminous vines. Green **`#66aa77` glow**. Caring, deft, vine-
> tender energy.

### Shadow Scribe — Secret Keeper
**Faction:** Thornbinder · **UI accent:** `#554466`
> ¾ bust portrait of the **Shadow Scribe**, a secretive recorder of Thornbinder
> contracts. Hooded Shadeborn, only the lower face visible, a faint cold smile, smoke
> curling from the sleeves. Dark violet-black robes, a black quill and a cipher-ledger
> glowing faint purple. Background: a candle-starved hidden archive. Dim **`#554466`
> glow**. Shadowy, clandestine, secret-keeper energy.

### Bloom Herald — Bloomguard Messenger
**Faction:** Bloomguard · **UI accent:** `#ccff88`
> ¾ bust portrait of the **Bloom Herald**, a bright ceremonial Bloomguard herald. Radiant
> Sunpetal, flower-petal hair, a beaming proclaiming expression. Ornate white-and-green
> herald's tabard, a flowering trumpet-horn raised, a banner behind. Background: a sunlit
> ceremonial plaza, falling petals. Bright **`#ccff88` glow**. Triumphant, ceremonial,
> herald energy.

### Warden Echo — Echo-Bound Warden
**Faction:** Veil order · **UI accent:** `#aabbcc`
> ¾ bust portrait of **Warden Echo**, a duty-bound, partly-spectral warden. Half-translucent
> Echo ancestry, pale armor showing the dim glow within, a solemn resolute face. Pale
> grey-blue veil-warden plate, a spectral spear. Background: an echoing veil-hall of
> mirrored light. Faint **`#aabbcc` glow**. Solemn, eternal, sentinel-spirit energy.

### Merchant Ferren — Trader
**Faction:** Verdant Consortium · **UI accent:** `#ffbb44`
> ¾ bust portrait of **Merchant Ferren**, a flamboyant, lucky-charm peddler. Sunpetal
> with a waxed moustache, a feathered cap, a dazzling grin. Garish bright-gold trade coat
> covered in trinkets and charms, presenting a glowing curio. Background: a curio stall
> crammed with oddities. Bright **`#ffbb44` glow**. Flashy, glib, peddler energy.

### Healer Mora — Healer
**Faction:** Emerald Coven · **UI accent:** `#88ffaa`
> ¾ bust portrait of **Healer Mora**, a calm, reassuring field healer. Soft Sunpetal
> features, tied-back mint-green hair, gentle steady eyes. White-and-green healer's robe
> with a glowing-cross-leaf sigil, a satchel of remedies, hands wreathed in soft healing
> light. Background: a sunlit infirmary alcove, hanging herbs. Soft **`#88ffaa` glow**.
> Compassionate, steady, healer energy.

### Scout Brin — Ranger Scout
**Faction:** Wildkin Pact · **UI accent:** `#44aa88`
> ¾ bust portrait of **Scout Brin**, a quick, quiet wilderness scout. Wiry, freckled,
> short practical hair, alert green eyes mid-scan. Mottled leaf-camouflage leathers, a
> shortbow, a tracking-charm. Background: a dappled forest edge, soft focus ferns. Teal
> **`#44aa88` glow**. Sharp, light-footed, scout energy.

### Keeper Lynn — Shrine Keeper
**Faction:** Veil / Coven · **UI accent:** `#aa88cc`
> ¾ bust portrait of **Keeper Lynn**, a soft-spoken keeper of a quiet shrine. Gentle
> Shadeborn, lavender-tinted skin, kind violet eyes, hair in a simple wrap. Lilac shrine-
> keeper robes, a glowing votive-lantern. Background: a small candlelit veil-shrine.
> Lavender **`#aa88cc` glow**. Quiet, devout, shrine-keeper energy.

### Forger Del — Weaponsmith
**Faction:** Craftsman · **UI accent:** `#bb7744`
> ¾ bust portrait of **Forger Del**, a brash young weaponsmith. Stoneblood, soot-flecked,
> a cocky grin, ember-mineral knuckles. Sleeveless leather, a glowing freshly-forged blade
> held up to inspect. Background: a busy forge, sparks. Copper **`#bb7744` glow**.
> Confident, energetic, weaponsmith energy.

### Trapper Vek — Wildkin Trapper
**Faction:** Wildkin Pact · **UI accent:** `#668855`
> ¾ bust portrait of **Trapper Vek**, a grizzled snare-setting trapper. Weathered, scarred,
> a fur hood, a sly squint. Hide garb hung with pelts, snares and bone hooks, a glowing
> lure-charm. Background: a forest trapline at dusk, hanging snares. Olive **`#668855`
> glow**. Cunning, rugged, trapper energy.

### Singer Aria — Bard
**Faction:** Neutral · **UI accent:** `#cc88aa`
> ¾ bust portrait of **Singer Aria**, a charismatic travelling bard. Striking Sunpetal,
> rose-petal hair, expressive eyes, a captivating smile mid-song. Colorful performer's
> garb, a glowing-stringed living-wood lute, ribbons of light from the strings. Background:
> a lantern-lit tavern stage, soft crowd bokeh. Rose **`#cc88aa` glow**. Magnetic,
> theatrical, bard energy.

### Watcher Cole — Night Watchman
**Faction:** Bloomguard / town watch · **UI accent:** `#4488aa`
> ¾ bust portrait of **Watcher Cole**, a tired, dependable night watchman. Stubbled,
> heavy-lidded but alert blue eyes, a worn cap. Practical watch-coat, a shuttered lantern
> raised, a billhook. Background: a foggy night street under canopy lanterns. Cool
> **`#4488aa` glow**. Weary, steadfast, watchman energy.

### Sylara — Mysterious Wanderer
**Faction:** Unaffiliated / Veil-touched · **UI accent:** `#cc99ff`
> ¾ bust portrait of **Sylara**, an alluring, secretive wanderer touched by the Veil.
> Shadeborn, violet-glowing eyes, dark hair streaked with starlight, a faint enigmatic
> smile. Layered traveller's silks in deep purple with veil-thread embroidery, a glowing
> pendant. Background: a moonlit veil-shrouded path. Violet **`#cc99ff` glow**.
> Mysterious, magnetic, wanderer energy.

### Elder Thornwick — Village Elder
**Faction:** Emerald Coven / village · **UI accent:** `#88cc66`
> ¾ bust portrait of **Elder Thornwick**, a kindly rural village elder. Old Stoneblood
> with bark-creased skin, a long mossy beard, twinkling green eyes, a warm crinkled smile.
> Homespun green elder's robe, a gnarled thornwood cane, a pipe. Background: a cozy
> village green under great boughs. Soft **`#88cc66` glow**. Folksy, warm, village-elder
> energy.

---

## 3. COMPANIONS (recruitable allies — `data/companions.json`)

### Vaeril — Defected Thornbinder Assassin (Companion)
**Class:** Thornbinder · **Ancestry:** Shadeborn
> ¾ bust portrait of **Vaeril**, a haunted Shadeborn assassin seeking redemption. Dusky
> twilight skin faintly smoking at the edges, sharp guarded eyes shadowed by guilt, dark
> hair half-hiding old scars. Dark thornbinder leathers, hood lowered, thorn-vine tattoos
> down one arm, twin concealed blades. Conflicted, watchful, protective expression.
> Background: a shadowed thornbinder safehouse, deep greens and blacks. Muted thorn-green
> rim glow. Brooding, redemptive, fallen-killer energy.

### Aeliana — Devout Emerald Mystic Healer (Companion)
**Class:** Emerald Mystic · **Ancestry:** Sunpetal
> ¾ bust portrait of **Aeliana**, a radiant, faithful Emerald Mystic healer. Glowing
> sun-warmed Sunpetal skin, petal-like golden hair haloed in soft light, serene devoted
> eyes. White-and-emerald mystic vestments with Everwood sigils, hands cupped around a
> warm healing light. Hopeful, unshakeable, compassionate expression. Background: a
> sunlit sanctum, the Everwood's glow. Warm gold-green halo glow. Devout, luminous,
> believer-healer energy.

### Emberfae — Sporecaller Fae (Companion)
**Class:** Sporecaller · **Ancestry:** Emberfae
> ¾ bust portrait of **Emberfae**, a small fiery fae sporecaller. Tiny fae with
> smoldering ember wings, glowing-coal eyes, a hot-tempered smirk, ember-flecked skin.
> Olive-and-ember spore-shaman garb, a glowing spore-and-cinder pouch. Background: a
> volcanic sap-vent cavern with drifting embers and spores. Ember-orange glow. Fierce,
> spry, ember-fae energy.

### Echo of Kaelen — Spectral Wildkin Ranger (Companion)
**Class:** Wildkin Ranger · **Ancestry:** Echo
> ¾ bust portrait of **Echo of Kaelen**, the lingering spirit of a fallen ranger.
> Partly translucent Echo, pale-blue ghost-light within, a resolute melancholic face,
> spectral hair drifting. Faded ranger leathers and a ghostly bow, a translucent
> spirit-beast at the shoulder. Background: a moonlit hunting ground, mist. Pale-blue
> spectral glow. Sorrowful, loyal, ghost-ranger energy.

### The Hollow One — Void-Touched Companion
**Class:** Hollowed · **Ancestry:** Void
> ¾ bust portrait of **The Hollow One**, a void-corrupted enigma. A humanoid silhouette
> of living darkness shot through with void-purple cracks, a featureless face with two
> cold pinpoint lights, drifting void-motes. Ragged dark wrappings, corruption crystals
> at the shoulders. Background: a rift of swallowing void. Cold void-purple glow.
> Eerie, ambiguous, abyssal energy.

### Seraphine — Bloomguard Paladin (Companion)
**Class:** Bloomguard · **Ancestry:** Sunpetal
> ¾ bust portrait (slight heroic angle) of **Seraphine**, a noble Bloomguard paladin.
> Radiant Sunpetal, golden petal-hair, valiant glowing eyes, a confident righteous smile.
> Gleaming green-and-gold living-wood plate with a flowering crest, a blooming greatsword.
> Background: a sunlit field of flowers, banners. Gold-green glow. Heroic, devout,
> paladin energy.

### Korrath — Stoneblood Wildkin Warrior (Companion)
**Class:** Wildkin Ranger · **Ancestry:** Stoneblood
> ¾ bust portrait of **Korrath**, a hulking stone-skinned beast-warrior. Massive
> Stoneblood with crystal-veined bark skin, a heavy brow, tusk-like markings, a stoic
> grimace. Bone-and-hide armor, a great stone axe, a low-slung beast-companion. Background:
> a rugged mountain forest. Earthy crystal glow. Mighty, taciturn, juggernaut energy.

### Grimvel — Shadeborn Bloomguard (Companion)
**Class:** Bloomguard · **Ancestry:** Shadeborn
> ¾ bust portrait of **Grimvel**, a grim dusk-skinned Bloomguard knight. Shadeborn with
> a stern scarred face, twilight skin, hard eyes. Dark-green-and-iron Bloomguard plate
> dimmed for stealth, a flanged mace, a half-wilted crest. Background: a stormy rampart
> at dusk. Muted green-violet glow. Severe, dutiful, dark-paladin energy.

### Mossback — Stoneblood Thornbinder (Companion)
**Class:** Thornbinder · **Ancestry:** Stoneblood
> ¾ bust portrait of **Mossback**, a moss-grown, patient ambusher. Broad Stoneblood
> whose bark skin is carpeted in moss and lichen for camouflage, slow watchful eyes, a
> faint grin. Earth-and-thorn leathers, a long thorn-dagger, a coil of barbed wire-vine.
> Background: a moss-choked forest hide. Mossy green glow. Patient, sturdy, ambusher
> energy.

### Nyx — Shadeborn Emerald Mystic (Companion)
**Class:** Emerald Mystic · **Ancestry:** Shadeborn
> ¾ bust portrait of **Nyx**, a sardonic twilight mystic. Shadeborn with deep-dusk skin,
> silver-violet eyes, sleek dark hair, an arch knowing smirk, faint shadow-smoke. Dark-
> emerald mystic robes with violet sap-glyphs, a floating shadow-orb of green-violet
> energy. Background: a moonlit grove, deep shadow. Violet-green glow. Witty, arcane,
> shadow-mystic energy.

---

## 4. MENTOR SPIRITS — Veilkeepers (profile-card versions)

> The five Veilkeepers already have canonical long-form `portrait` descriptions in
> `data/veilkeepers.json`. Below are matching **profile-card framings** (¾ bust, same
> Style Bible) for UI consistency with the rest of the cast. For full-body / scene
> descriptions, defer to `veilkeepers.json`.

### Sylthara — Keeper of Combat Wisdom
> ¾ bust profile of **Sylthara**: an open-visored suit of ancient battle-scarred iron-
> green living armor, amber eye-glow in the empty visor, white-flowering vines through the
> joints, bark-healed Abyss scars on the breastplate, a mossy tattered cape. Standing at
> rigid attention. Background: the Whispering Veil, spectral greatsword-light. Amber-on-
> green glow. Martial, commanding, ghost-general energy.

### Morvein — Keeper of Hidden Paths
> ¾ bust profile of **Morvein**: a hooded silver-blue figure whose face is a luminous
> ever-shifting topographic map forming a faint smile, casting no shadow, cloak embroidered
> with tiny doors, translucent gesturing hands. Background: the Veil with drifting path-
> markers. Silver glow. Playful, cryptic, cartographer-spirit energy.

### Elduin — Keeper of Future Events
> ¾ bust profile (slight high angle) of **Elduin**: a small child-like figure in a white
> robe, enormous ancient silver-blue eyes full of unborn futures, upward-floating pale
> hair, leaves drifting upward, a butterfly frozen mid-air, gentle permanent sorrow.
> Background: the Veil with reversed time-motes. Silver-blue glow. Fragile, melancholy,
> time-child energy.

### Kaelthas — Keeper of Ancient Lore
> ¾ bust profile of **Kaelthas**: a colossal carved tree-trunk face, deep grey-brown bark
> with luminous green script-moss, kind amber-glowing deep-set eyes, bark-eyebrows raised
> in delight, vine spectacles on the carved nose, books and scrolls orbiting slowly.
> Background: the Veil, drifting pages. Warm amber-green glow. Jovial, scholarly, ancient-
> librarian energy.

### Virelda — Keeper of Corruption & Abyss Intel
> ¾ bust profile of **Virelda**: a woman rigid in pain, left half consumed by jagged
> void-black crystalline corruption pulsing purple-red, left eye pure void-black, right
> eye fierce green, half a maintained Emerald Coven robe, a staff topped with a purified-
> sap vial, faint trembling. Background: the Veil, frozen corruption. Green-vs-void glow.
> Intense, defiant, doomed-scholar energy.

---

## 5. LOCATION ROSTER NPCs (referenced in `locations.json`)

These appear in location rosters and quests; each has a concise but complete prompt
(prepend the Style Bible). Role and faction inferred from id + location.

**Canopy of Life — town & services**
- **Shadowmaster Kael** *(Thornbinder leader, Thornbinder Safehouse)* — ¾ bust of a
  cold, commanding Shadeborn guildmaster; hooded black-violet leathers, thorn-crown
  motif, twin daggers, a calculating stare; shadowed safehouse background; violet-green
  rim glow; spymaster energy.
- **Courier Swift** *(messenger)* — ¾ bust of a breathless, wiry young runner; light
  travel garb, a satchel of letters, wind-blown hair, eager grin; a canopy road behind;
  green glow; courier energy.
- **Stable Master Holt** *(beast handler)* — ¾ bust of a burly, calm Stoneblood ostler;
  hay-flecked leathers, a lead-rope, a glowing-eyed mount nuzzling in; stable background;
  amber glow; horseman energy.
- **Chef Bramble** *(cook)* — ¾ bust of a rotund, jolly Sunpetal cook; flour-dusted apron,
  a ladle, a flower behind the ear, hearty laugh; a steaming kitchen behind; warm glow;
  cook energy.
- **Tailor Silk** *(clothier)* — ¾ bust of an elegant, fussy Shadeborn tailor; fine
  shimmer-thread garb, pin-cushion bracer, measuring vine-tape, a poised smile; a draped
  workshop behind; teal glow; couturier energy.
- **Jeweler Glint** *(gem-cutter)* — ¾ bust of a sharp-eyed Stoneblood jeweler; loupe at
  the eye, gilt finery, holding a glowing cut sap-gem; a velvet-and-brass shop; gold glow;
  gemcutter energy.
- **Alchemist Ferment** *(alchemist)* — ¾ bust of a wild-haired, slightly-singed alchemist;
  stained robe, goggles, a bubbling glowing flask; a cluttered lab of vials; green-violet
  glow; mad-alchemist energy.
- **Bard Melody** *(performer)* — ¾ bust of a radiant Sunpetal singer; colorful garb, a
  glowing harp, mid-performance; a tavern-stage bokeh; rose glow; bard energy.
- **Beggar Dusty** *(beggar)* — ¾ bust of a ragged, weary but sharp-eyed vagrant; patched
  cloak, an upturned cup, a knowing look that hints at hidden info; an alley under canopy
  lanterns; muted grey glow; informant-beggar energy.
- **Street Urchin Pip** *(child)* — ¾ bust of a grubby, grinning street kid; oversized
  patched clothes, a stolen apple, mischievous eyes; a market alley; warm glow; urchin
  energy.
- **Town Crier Bellows** *(announcer)* — ¾ bust of a red-faced, big-lunged crier; civic
  tabard, a hand-bell raised, mid-shout; a plaza behind; gold glow; crier energy.
- **Diplomat Grace** *(envoy)* — ¾ bust of a poised, elegant Shadeborn diplomat; refined
  robes with faction sigils, a sealed accord, a measured smile; a council-hall behind;
  cool glow; envoy energy.
- **Banker Vault** *(banker)* — ¾ bust of a stern, precise Stoneblood banker; severe
  gilt-trimmed coat, a locked coffer, spectacles, a flat appraising look; a vault behind;
  gold glow; banker energy.
- **Postmaster Seal** *(post)* — ¾ bust of a tidy, officious postmaster; ink-cuffed
  uniform, a wax-seal stamp, a wall of pigeonholes behind; teal glow; clerk energy.
- **Gardener Bloom** *(gardener)* — ¾ bust of a sun-freckled Sunpetal gardener; soil-
  smudged smock, a flowering shrub in arms, a contented smile; a terraced garden; bright
  green glow; gardener energy.
- **Night Watch Shade** *(night guard)* — ¾ bust of a shadowy, quiet Shadeborn night-
  watcher; dark watch-cloak, a hooded lantern, alert violet eyes; a foggy night street;
  violet glow; night-watch energy.

**Verdant Exchange — market underworld**
- **Rare Dealer Vashti** *(exotics)* — ¾ bust of an exotic, jewel-bedecked Shadeborn
  dealer; silk veils, rings, a glowing rare artifact presented; a curtained back-stall;
  violet-gold glow; black-market dealer energy.
- **Fence Nighthollow** *(fence)* — ¾ bust of a furtive, hawk-faced fence; dark hooded
  coat, a hidden ledger, darting eyes appraising stolen goods; a dim back-room; muted
  glow; fence energy.
- **Auctioneer Pell** *(auctioneer)* — ¾ bust of a flamboyant, fast-mouthed auctioneer;
  bright coat, a gavel raised, theatrical grin; an auction floor bokeh; amber glow;
  auctioneer energy.

**Bloomguard Barracks**
- **Quartermaster Hessa** *(supply officer)* — ¾ bust of a brisk, organized Stoneblood
  quartermaster; Bloomguard fatigues, a supply-ledger and crate, a no-nonsense look; an
  armory behind; green glow; quartermaster energy.
- **Recruit Eldon** *(new soldier)* — ¾ bust of a nervous, fresh-faced young recruit;
  ill-fitting Bloomguard armor, a too-big halberd, anxious determination; a drill-yard
  behind; green glow; rookie energy.

**Emerald Sanctum**
- **Lorekeeper Ashara** *(senior scholar)* — ¾ bust of a dignified elder Sunpetal
  lorekeeper; rich emerald robes, an ancient glowing tome, serene wisdom; a grand library
  behind; blue-green glow; lorekeeper energy.
- **Healer Brynn** *(infirmarian)* — ¾ bust of a gentle, tired Sunpetal healer; white-
  green robe, a healing-light poultice, kind weary eyes; an infirmary behind; soft green
  glow; healer energy.
- **Soul Scribe Daleth** *(soul records)* — ¾ bust of an austere, otherworldly scribe;
  pale robes inscribed with soul-glyphs, a floating glowing soul-ledger, distant eyes;
  a glowing-glyph sanctum; cyan glow; soul-scribe energy.

**Whispering Veil**
- **Warden of Threads** *(fate-weaver)* — ¾ bust of an enigmatic Echo warden; translucent
  form, hands holding glowing fate-threads, a serene cryptic face; a veil of woven light;
  silver-blue glow; thread-warden energy.

**Hollowroot Catacombs**
- **Lost Explorer Mika** *(survivor)* — ¾ bust of a dirt-smeared, frightened explorer;
  torn expedition gear, a flickering lantern, wide haunted eyes; dark catacomb walls;
  dim cold glow; lost-survivor energy.
- **Bloomguard Scout Renn** *(scout)* — ¾ bust of a tense, alert Bloomguard scout;
  scuffed green scout armor, a drawn shortbow, a wary look; catacomb gloom; green glow;
  scout energy.

**Spindlewood Forest**
- **Wildkin Scout Fara** *(ranger)* — ¾ bust of a lithe, watchful Wildkin scout; leaf-
  leather garb, feathers in braided hair, a tracking bow, sharp eyes; misty woods; teal
  glow; ranger energy.

**Mycelium Nexus**
- **Fungal Trader Grix** *(spore merchant)* — ¾ bust of a sly fungal-touched trader;
  mushroom-cap hat, spore-pouch bandolier, glowing fungal wares, a crooked grin; glowing
  caverns; olive glow; spore-trader energy.
- **Transit Keeper Lumina** *(gate-keeper)* — ¾ bust of a luminous fungal guide; glowing
  spore-freckles, a lantern-mushroom staff, a calm welcoming look; a glowing transit
  archway; teal-green glow; gatekeeper energy.

**Thornbinder Safehouse**
- **Broker Silka** *(contract broker)* — ¾ bust of a coolly elegant Shadeborn broker;
  dark refined leathers, a contract-scroll, a razor smile; a shadowed back-room; violet
  glow; broker energy.
- **Poisoner Vetch** *(toxin-maker)* — ¾ bust of a gaunt, gleeful poisoner; stained
  apron, a glowing-green vial, a vine of toxic berries, manic eyes; a poison-lab; acid-
  green glow; poisoner energy.
- **Informant Whisper** *(spy)* — ¾ bust of a faceless, hooded informant; only glowing
  eyes visible under a deep hood, a finger to where lips would be; deep shadow; dim glow;
  informant energy.

**Emerald Cascades**
- **Hermit Druid Oakenshade** *(hermit)* — ¾ bust of a wild, ancient hermit druid; bark-
  skin, a beard full of leaves and twigs, a root-staff, fierce bright eyes; a waterfall
  grove; green glow; hermit-druid energy.
- **Sap Collector Wren** *(harvester)* — ¾ bust of a cheerful young sap-tapper; tapping
  tools, glowing sap-buckets, a sticky grin; cascading sap-falls behind; amber-green glow;
  harvester energy.

**Glinting Groves**
- **Crystal Harvester Pria** *(miner)* — ¾ bust of a sturdy Stoneblood crystal-miner;
  dust-caked gear, a glowing pick, a crystal shard, a determined look; a crystal cavern;
  icy-blue glow; miner energy.
- **Geological Researcher Quartz** *(scholar)* — ¾ bust of a precise, curious researcher;
  field-coat, glowing survey-lenses, a crystal sample notebook; a crystal-cave study; blue
  glow; geologist energy.

**Thornbinder Training Grounds**
- **Blademaster Sirath** *(master)* — ¾ bust of a lethal, composed Shadeborn blademaster;
  sleek dark training leathers, twin glowing-edged blades crossed, a cold focused stare;
  a thorn-walled dojo; green-violet glow; blademaster energy.
- **Trap Instructor Nettle** *(trapper)* — ¾ bust of a wiry, smirking trap-instructor;
  tool-strung vest, a half-built snare, sharp clever eyes; a trap-rigged yard; olive glow;
  trapsmith energy.

**Wildkin Hunting Grounds**
- **Tracker Grenn** *(hunter)* — ¾ bust of a grizzled veteran tracker; fur hood, face-
  paint, a longbow, a scarred squint; a wild forest trail; bronze glow; tracker energy.
- **Beast Tamer Kova** *(tamer)* — ¾ bust of a fierce, bonded beast-tamer; hide armor,
  a clawed gauntlet, a snarling glowing-eyed beast beside; a den background; amber glow;
  tamer energy.

**Sporecaller Labs**
- **Lead Researcher Sporax** *(head scientist)* — ¾ bust of an intense fungal scientist;
  spore-stained lab robes, a mushroom-cap cowl, a glowing specimen, gleaming eyes; a
  fungal lab; olive-violet glow; researcher energy.
- **Lab Assistant Moldwyn** *(assistant)* — ¾ bust of a jittery young lab assistant;
  spore-flecked smock, a tray of glowing samples, anxious eagerness; a lab background;
  green glow; assistant energy.
- **Containment Specialist Ward** *(safety)* — ¾ bust of a grim, heavily-geared
  containment officer; sealed spore-suit half-removed, a glowing containment-rod, a wary
  look; a quarantined lab; teal glow; containment energy.

**Veil Echo Chamber**
- **Echo Warden Solivae** *(guardian)* — ¾ bust of a luminous Echo guardian; translucent
  shimmering form, a staff of resonant light, a serene eternal face; a hall of echoing
  reflections; silver glow; echo-warden energy.

**Abyss Forward Camp**
- **Captain Dorn** *(frontline commander)* — ¾ bust (heroic angle) of a battle-hardened
  Bloomguard captain; dented green-gold war-plate, a scarred grim face, a notched halberd;
  a war-camp at the Abyss edge; charged crimson rim glow; frontline-commander energy.
- **Field Medic Sera** *(combat medic)* — ¾ bust of a quick, steady war medic; blood-
  flecked white-green medic garb, a glowing field-poultice, tired resolve; a triage tent;
  green glow; combat-medic energy.
- **Supply Officer Brent** *(logistics)* — ¾ bust of a harried, practical supply officer;
  dusty uniform, a crate and tally-board, a frazzled frown; a supply depot; amber glow;
  logistics energy.
- **War Correspondent Ivy** *(reporter)* — ¾ bust of a bold, curious correspondent;
  travel-coat, a sketch-journal and charcoal, a fearless inquisitive look; a war-camp
  behind; warm glow; reporter energy.

**Special / Spirit & Abyss entities** *(more stylized, less human)*
- **Trapped Spirit Verdana** *(Hollow Tree Grove)* — ¾ bust of a sorrowful nature-spirit
  bound in a hollow tree; a translucent green-glowing female form fused with bark and
  blossoms, pleading luminous eyes, vines as hair; inside a hollow glowing trunk; soft
  green glow; trapped-dryad energy.
- **Ward Keeper Solenne** *(Corruption Quarantine Zone)* — ¾ bust of a resolute, masked
  quarantine warden; sealed ward-robes inscribed with containment glyphs, a glowing ward-
  staff, weary determined eyes; a corruption-quarantine boundary; teal-vs-purple glow;
  ward-keeper energy.
- **Foreman Grubb** *(Sapling Plantation)* — ¾ bust of a gruff, overworked plantation
  foreman; muddy work-clothes, a tally-whip, a hard tired scowl; rows of saplings behind;
  amber glow; foreman energy.
- **Disgruntled Worker Pella** *(Sapling Plantation)* — ¾ bust of an exhausted, defiant
  field worker; sap-stained labor garb, calloused hands, a simmering resentful glare;
  plantation rows; muted glow; oppressed-worker energy.
- **Trade Inspector Voss** *(Sapling Plantation)* — ¾ bust of a cold, officious Consortium
  inspector; pristine gilt-trim uniform, a clipboard-ledger, a disdainful stare; an
  industrial plantation; gold glow; inspector energy.
- **Ghost of the Unbound** *(Ancient Unbinding Site)* — ¾ bust of an ancient spectral
  prisoner-spirit; translucent shackle-marked form, broken chain-light around the wrists,
  hollow ancient eyes, drifting tatters; ruined unbinding-site stones; pale cold glow;
  unbound-ghost energy.
- **Spirit of Verdance** *(Everwood Heart)* — ¾ bust of the sublime nature-deity avatar of
  the Everwood; a vast luminous green-gold humanoid of living wood, blossom and light,
  serene god-like face, antler-branch crown radiating sap-light; the colossal heart-tree
  behind; brilliant green-gold halo glow; world-spirit / deity energy.
- **Void Architect** *(Void Nexus, antagonist)* — ¾ bust (slight low angle) of a cold,
  monumental abyssal mastermind; a towering void-crystalline humanoid of black geometry
  and purple-red void-light, a faceless mask of shifting angles, corruption-spires for a
  crown; a collapsing void-nexus behind; void-purple glow; architect-of-corruption energy.
- **Voice of the Abyss** *(Void Nexus, final antagonist)* — ¾ bust of the
  incomprehensible Abyss itself given form; a roiling silhouette of pure devouring
  darkness with countless faint whispering faces, two burning void-eyes, tendrils of
  unmaking; an event-horizon of swallowed light; deep void-crimson glow; eldritch
  final-antagonist energy.

---

## 6. Quick-reference UI accent palette (from `dialogues.json`)

| NPC | nameColor | NPC | nameColor |
|-----|-----------|-----|-----------|
| Elder Thalos | `#44ff88` | Hollow Sage | `#667788` |
| Lyra the Herbalist | `#88ff44` | Ember Guard | `#cc6644` |
| Archivist Kael | `#4488ff` | Dew Collector | `#88ccaa` |
| Merchant Orla | `#ffaa44` | Bark Carver | `#996633` |
| Commander Briara | `#44cc44` | Vine Tender | `#66aa77` |
| Archdruid Veyla | `#66aaff` | Shadow Scribe | `#554466` |
| Beastcaller Yenna | `#cc8844` | Bloom Herald | `#ccff88` |
| Seer Althea | `#cc66ff` | Warden Echo | `#aabbcc` |
| Smith Garon | `#cc6644` | Merchant Ferren | `#ffbb44` |
| Sporecaller Mycel | `#88cc44` | Healer Mora | `#88ffaa` |
| Trainer Borsk | `#cc8866` | Scout Brin | `#44aa88` |
| Innkeeper Maren | `#ffcc88` | Keeper Lynn | `#aa88cc` |
| Guard Captain Reyla | `#44cc88` | Forger Del | `#bb7744` |
| Merchant Lirel | `#ffaa44` | Trapper Vek | `#668855` |
| Drillmaster Torvak | `#44cc44` | Singer Aria | `#cc88aa` |
| Acolyte Ferrin | `#66aaff` | Watcher Cole | `#4488aa` |
| Keeper of Echoes | `#aabbdd` | Sylara | `#cc99ff` |
| Wandering Herbalist | `#88ff44` | Elder Thornwick | `#88cc66` |
| Trader Boskyn | `#ffaa44` | Director Orin | `#cc9944` |
| Archivist Scroll | `#4488ff` | Sentinel Ash | `#668844` |
| Herbalist Tansy | `#88ff44` | Veil Watcher | `#8866aa` |
| Grove Tender | `#44aa66` | Sap Weaver | `#66aacc` |
| Ironbark Smith | `#aa6644` | Thorn Sentinel | `#88aa44` |
| Crystal Singer | `#aaccff` | Moss Elder | `#559966` |
| Spore Guide | `#99bb66` | Root Speaker | `#776633` |
| Canopy Scout | `#44cc88` | | |
