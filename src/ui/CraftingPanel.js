import EventBus from '../core/EventBus.js';
import dataManager from '../systems/DataManager.js';

/**
 * CraftingPanel — Full 3-section crafting UI (820×520px, depth 8000).
 *
 * LEFT  (220px) — Recipe Book: category tabs, scrollable list, lock indicators
 * CENTER(340px) — Crafting Table: materials, station badge, CRAFT button, COMBINE slots
 * RIGHT (260px) — Guide: GUIDE | STATIONS | TIPS sub-tabs
 *
 * Events emitted : crafting:craft   { recipeId }
 *                  crafting:combine { itemId1, itemId2 }
 * Events consumed: crafting:recipeDiscovered { recipeId }
 *                  inventory:update  (any shape — triggers material refresh)
 *                  crafting-open     { stationId? }
 */
export class CraftingPanel {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;

        // Layout constants
        this.PW = 820;
        this.PH = 520;
        this.DEPTH = 8000;

        // Left section config
        this.LEFT_W = 220;
        this.CENTER_W = 340;
        this.RIGHT_W = 260;

        // State
        this._allRecipes = [];          // full recipe list from DataManager
        this._filteredRecipes = [];     // after category filter
        this._selectedRecipe = null;    // currently selected recipe object
        this._inventory = {};           // itemId -> quantity
        this._stationId = null;         // active station filter (null = any)
        this._activeCategory = 'all';
        this._rightTab = 'guide';       // 'guide' | 'stations' | 'tips'
        this._craftProgress = 0;        // 0-1, drives progress bar tween
        this._isCrafting = false;
        this._combineSlot1 = null;      // itemId string or null
        this._combineSlot2 = null;

        // Scroll
        this._recipeScrollOffset = 0;
        this._visibleRows = 7;

        this._elements = [];
        this._dynamicElements = []; // cleared/redrawn on state change

        this._build();
        this._setupEvents();
    }

    // ─────────────────────────────────────────────────────────────
    //  BUILD  ─ construct all static chrome elements
    // ─────────────────────────────────────────────────────────────

    _build() {
        const s = this.scene;
        const { width, height } = s.scale;
        this._ox = Math.floor(width / 2 - this.PW / 2);
        this._oy = Math.floor(height / 2 - this.PH / 2);
        const ox = this._ox, oy = this._oy;

        // ── Background panel ──
        this._panelBg = s.add.graphics().setDepth(this.DEPTH);
        this._drawPanelBg();

        // ── Panel title ──
        this._titleText = s.add.text(ox + this.PW / 2, oy + 18, 'CRAFTING', {
            fontFamily: 'Open Sans', fontSize: '24px', color: '#88ffaa',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(this.DEPTH + 2);

        // ── Close button ──
        this._closeBtn = this._makeBtn(
            ox + this.PW - 18, oy + 18, 26, 22, 'X',
            0x661111, 0xaa2222, () => this.hide()
        );

        // ── Category tabs (LEFT) ──
        this._catTabs = [];
        const cats = ['all', 'weapons', 'armor', 'consumables', 'accessories', 'materials'];
        const catLabels = ['All', 'Wpn', 'Arm', 'Cons', 'Acc', 'Mat'];
        const tabW = Math.floor((this.LEFT_W - 8) / 3);
        cats.forEach((cat, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const tx = ox + 4 + col * (tabW + 2);
            const ty = oy + 40 + row * 24;
            const tab = this._makeBtn(
                tx + tabW / 2, ty + 11, tabW, 20,
                catLabels[i], 0x1a2a1a, 0x336633,
                () => { this._activeCategory = cat; this._recipeScrollOffset = 0; this._refreshRecipeList(); this._refreshCatTabs(); }
            );
            tab._cat = cat;
            this._catTabs.push(tab);
        });

        // ── Recipe list scroll area chrome ──
        this._recipeListBg = s.add.graphics().setDepth(this.DEPTH + 1);
        this._recipeListBg.fillStyle(0x0d1f0d, 0.7);
        this._recipeListBg.fillRect(ox + 4, oy + 90, this.LEFT_W - 8, this.PH - 130);

        // Scroll arrows
        this._scrollUp = this._makeBtn(
            ox + this.LEFT_W / 2, oy + 94, 24, 18, '▲',
            0x1a2a1a, 0x336633, () => { this._recipeScrollOffset = Math.max(0, this._recipeScrollOffset - 1); this._refreshRecipeList(); }
        );
        this._scrollDown = this._makeBtn(
            ox + this.LEFT_W / 2, oy + this.PH - 44, 24, 18, '▼',
            0x1a2a1a, 0x336633, () => { this._recipeScrollOffset = Math.min(Math.max(0, this._filteredRecipes.length - this._visibleRows), this._recipeScrollOffset + 1); this._refreshRecipeList(); }
        );

        // ── Dividers ──
        const divG = s.add.graphics().setDepth(this.DEPTH + 1);
        divG.lineStyle(1, 0x336633, 0.6);
        // Left | Center
        divG.lineBetween(ox + this.LEFT_W, oy + 36, ox + this.LEFT_W, oy + this.PH - 10);
        // Center | Right
        divG.lineBetween(ox + this.LEFT_W + this.CENTER_W, oy + 36, ox + this.LEFT_W + this.CENTER_W, oy + this.PH - 10);
        // Header rule
        divG.lineBetween(ox + 4, oy + 36, ox + this.PW - 4, oy + 36);

        // ── Center section header ──
        this._centerTitle = s.add.text(ox + this.LEFT_W + this.CENTER_W / 2, oy + 20, 'Select a Recipe', {
            fontFamily: 'Open Sans', fontSize: '18px', color: '#88ffaa'
        }).setOrigin(0.5).setDepth(this.DEPTH + 2);

        // ── Right section sub-tabs ──
        const rightTabsData = [
            { key: 'guide', label: 'GUIDE' },
            { key: 'stations', label: 'STATIONS' },
            { key: 'tips', label: 'TIPS' }
        ];
        const rTabW = Math.floor((this.RIGHT_W - 8) / 3);
        this._rightTabBtns = [];
        rightTabsData.forEach((t, i) => {
            const tx = ox + this.LEFT_W + this.CENTER_W + 4 + i * (rTabW + 2);
            const btn = this._makeBtn(
                tx + rTabW / 2, oy + 54, rTabW, 18,
                t.label, 0x1a2a1a, 0x336633,
                () => { this._rightTab = t.key; this._refreshRightPanel(); this._refreshRightTabs(); }
            );
            btn._key = t.key;
            this._rightTabBtns.push(btn);
        });

        // ── Dynamic content graphics (cleared on updates) ──
        this._dynG = s.add.graphics().setDepth(this.DEPTH + 3);

        // ── Feedback text ──
        this._feedbackText = s.add.text(ox + this.LEFT_W + this.CENTER_W / 2, oy + this.PH - 14, '', {
            fontFamily: 'Open Sans', fontSize: '15px', color: '#66ffaa',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(this.DEPTH + 6);

        // ── Collect permanent elements ──
        this._elements = [
            this._panelBg, this._titleText, this._recipeListBg, this._dynG, this._feedbackText,
            this._closeBtn.bg, this._closeBtn.txt, this._closeBtn.hit,
            this._scrollUp.bg, this._scrollUp.txt, this._scrollUp.hit,
            this._scrollDown.bg, this._scrollDown.txt, this._scrollDown.hit,
            divG, this._centerTitle, this._recipeListBg
        ];
        for (const tab of this._catTabs) this._elements.push(tab.bg, tab.txt, tab.hit);
        for (const tab of this._rightTabBtns) this._elements.push(tab.bg, tab.txt, tab.hit);

        this._setVisible(false);
    }

    _drawPanelBg() {
        const g = this._panelBg;
        const ox = this._ox, oy = this._oy;
        g.clear();
        g.fillStyle(0x0a140a, 0.96);
        g.fillRoundedRect(ox, oy, this.PW, this.PH, 10);
        g.lineStyle(2, 0x336633, 0.9);
        g.strokeRoundedRect(ox, oy, this.PW, this.PH, 10);
        g.lineStyle(1, 0x224422, 0.4);
        g.strokeRoundedRect(ox + 2, oy + 2, this.PW - 4, this.PH - 4, 9);
    }

    // ─────────────────────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────────────────────

    _setupEvents() {
        this._unsubs = this._unsubs || [];
        this._unsubs.push(EventBus.on('crafting-open', (data) => this.open(data)));

        this._unsubs.push(EventBus.on('crafting:recipeDiscovered', (data) => {
            if (!data?.recipeId) return;
            const rec = this._allRecipes.find(r => r.id === data.recipeId);
            if (rec) {
                rec.discovered = true;
                this._refreshRecipeList();
                this._showNotification(`New recipe discovered: ${rec.name}!`);
            }
        }));

        this._unsubs.push(EventBus.on('inventory:update', (data) => {
            if (data?.items) {
                for (const [id, qty] of Object.entries(data.items)) {
                    this._inventory[id] = qty;
                }
            }
            if (this.visible) {
                this._refreshRecipeList();
                this._refreshCenter();
            }
        }));

        // Legacy incremental events for backward-compat
        this._unsubs.push(EventBus.on('inventory:addItem', (data) => {
            const id = data?.itemId;
            if (id) this._inventory[id] = (this._inventory[id] || 0) + (data.quantity || 1);
            if (this.visible) { this._refreshRecipeList(); this._refreshCenter(); }
        }));
        this._unsubs.push(EventBus.on('inventory:removeItem', (data) => {
            const id = data?.itemId;
            if (id) this._inventory[id] = Math.max(0, (this._inventory[id] || 0) - (data.quantity || 1));
            if (this.visible) { this._refreshRecipeList(); this._refreshCenter(); }
        }));
        this._unsubs.push(EventBus.on('crafting:inventorySnapshot', (data) => {
            if (data?.items) {
                for (const [id, qty] of Object.entries(data.items)) this._inventory[id] = qty;
                if (this.visible) { this._refreshRecipeList(); this._refreshCenter(); }
            }
        }));
    }

    /** Tear down EventBus listeners on scene shutdown. */
    destroy() {
        if (this._unsubs) this._unsubs.forEach(fn => { try { fn(); } catch (_) {} });
        this._unsubs = [];
    }

    // ─────────────────────────────────────────────────────────────
    //  OPEN / HIDE
    // ─────────────────────────────────────────────────────────────

    // Alias for UIFramework.showPanel() compatibility.
    show(data) { return this.open(data); }

    async open(data = {}) {
        this._stationId = data?.stationId || null;
        this._selectedRecipe = null;
        this._activeCategory = 'all';
        this._recipeScrollOffset = 0;
        this._rightTab = 'guide';
        this._combineSlot1 = null;
        this._combineSlot2 = null;

        // Load recipe data
        const recipes = dataManager.getRecipes ? dataManager.getRecipes() : [];
        this._allRecipes = recipes.filter(r => r && r.id && !r._comment);

        this._setVisible(true);
        this.visible = true;
        this._refreshCatTabs();
        this._refreshRecipeList();
        this._refreshCenter();
        this._refreshRightPanel();
        this._refreshRightTabs();
    }

    hide() {
        this._setVisible(false);
        this.visible = false;
        this._clearDynamic();
    }

    // ─────────────────────────────────────────────────────────────
    //  REFRESH — LEFT (Recipe List)
    // ─────────────────────────────────────────────────────────────

    _refreshCatTabs() {
        this._catTabs.forEach(tab => {
            const isActive = tab._cat === this._activeCategory;
            tab.bg.clear();
            tab.bg.fillStyle(isActive ? 0x336633 : 0x1a2a1a, 0.9);
            const bx = tab._bx, by = tab._by, bw = tab._bw, bh = tab._bh;
            tab.bg.fillRoundedRect(bx, by, bw, bh, 4);
            tab.bg.lineStyle(1, isActive ? 0x66ff88 : 0x336633, 0.7);
            tab.bg.strokeRoundedRect(bx, by, bw, bh, 4);
            tab.txt.setColor(isActive ? '#66ff88' : '#88aa88');
        });
    }

    _refreshRightTabs() {
        this._rightTabBtns.forEach(tab => {
            const isActive = tab._key === this._rightTab;
            tab.bg.clear();
            tab.bg.fillStyle(isActive ? 0x224422 : 0x1a2a1a, 0.9);
            const bx = tab._bx, by = tab._by, bw = tab._bw, bh = tab._bh;
            tab.bg.fillRoundedRect(bx, by, bw, bh, 3);
            tab.bg.lineStyle(1, isActive ? 0x66ff88 : 0x335533, 0.7);
            tab.bg.strokeRoundedRect(bx, by, bw, bh, 3);
            tab.txt.setColor(isActive ? '#88ffaa' : '#668866');
        });
    }

    _refreshRecipeList() {
        this._clearDynamic();

        // Filter
        if (this._activeCategory === 'all') {
            this._filteredRecipes = [...this._allRecipes];
        } else {
            this._filteredRecipes = this._allRecipes.filter(r => r.category === this._activeCategory);
        }

        const s = this.scene;
        const ox = this._ox, oy = this._oy;
        const listTop = oy + 112;
        const rowH = Math.floor((this.PH - 152) / this._visibleRows);
        const listW = this.LEFT_W - 8;

        const start = this._recipeScrollOffset;
        const end = Math.min(start + this._visibleRows, this._filteredRecipes.length);

        for (let i = start; i < end; i++) {
            const rec = this._filteredRecipes[i];
            const rowY = listTop + (i - start) * rowH;
            const canCraft = this._canCraftRecipe(rec);
            const isSelected = this._selectedRecipe?.id === rec.id;

            // Row background
            const rowBg = s.add.graphics().setDepth(this.DEPTH + 4);
            if (isSelected) {
                rowBg.fillStyle(0x224422, 0.9);
                rowBg.fillRoundedRect(ox + 5, rowY + 1, listW - 2, rowH - 2, 3);
                rowBg.lineStyle(1, 0x66ff88, 0.8);
                rowBg.strokeRoundedRect(ox + 5, rowY + 1, listW - 2, rowH - 2, 3);
            } else if (canCraft && rec.discovered) {
                rowBg.fillStyle(0x162616, 0.7);
                rowBg.fillRoundedRect(ox + 5, rowY + 1, listW - 2, rowH - 2, 3);
            }

            if (!rec.discovered) {
                // Undiscovered — greyed locked entry
                const lockedTxt = s.add.text(ox + 12, rowY + rowH / 2 - 6, '??? (locked)', {
                    fontFamily: 'Open Sans', fontSize: '14px', color: '#445544'
                }).setDepth(this.DEPTH + 5);
                this._dynamicElements.push(rowBg, lockedTxt);

                const hitZ = s.add.zone(ox + this.LEFT_W / 2, rowY + rowH / 2, listW, rowH)
                    .setInteractive({ useHandCursor: false }).setDepth(this.DEPTH + 5);
                this._dynamicElements.push(hitZ);
                continue;
            }

            // Category color dot
            const dotColor = this._catColor(rec.category);
            const dot = s.add.graphics().setDepth(this.DEPTH + 5);
            dot.fillStyle(dotColor, 1);
            dot.fillCircle(ox + 13, rowY + rowH / 2, 4);

            // Level badge
            const lvlBadge = s.add.text(ox + this.LEFT_W - 10, rowY + 4, `Lv${rec.requiredLevel}`, {
                fontFamily: 'Open Sans', fontSize: '13px',
                color: canCraft ? '#66ff88' : '#ff6644',
                backgroundColor: '#111a11', padding: { x: 2, y: 1 }
            }).setOrigin(1, 0).setDepth(this.DEPTH + 5);

            // Recipe name
            const nameColor = canCraft ? '#aaffaa' : (isSelected ? '#88ddaa' : '#88aa88');
            const nameTxt = s.add.text(ox + 22, rowY + 4, rec.name, {
                fontFamily: 'Open Sans', fontSize: '15px', color: nameColor,
                wordWrap: { width: listW - 44 }
            }).setDepth(this.DEPTH + 5);

            // Materials count hint
            const matHint = s.add.text(ox + 22, rowY + rowH - 12, `${rec.materials.length} mat(s) · ${rec.requiredStation}`, {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#556655'
            }).setDepth(this.DEPTH + 5);

            // Craft-ready indicator
            if (canCraft) {
                const readyDot = s.add.graphics().setDepth(this.DEPTH + 5);
                readyDot.fillStyle(0x44ff66, 1);
                readyDot.fillCircle(ox + this.LEFT_W - 10, rowY + rowH - 10, 3);
                this._dynamicElements.push(readyDot);
            }

            // Hit zone
            const capturedRec = rec;
            const hitZ = s.add.zone(ox + this.LEFT_W / 2, rowY + rowH / 2, listW, rowH)
                .setInteractive({ useHandCursor: true }).setDepth(this.DEPTH + 6);
            hitZ.on('pointerdown', () => {
                this._selectedRecipe = capturedRec;
                this._refreshRecipeList();
                this._refreshCenter();
            });
            hitZ.on('pointerover', () => {
                if (this._selectedRecipe?.id !== capturedRec.id) {
                    rowBg.clear();
                    rowBg.fillStyle(0x1a2e1a, 0.7);
                    rowBg.fillRoundedRect(ox + 5, rowY + 1, listW - 2, rowH - 2, 3);
                }
            });
            hitZ.on('pointerout', () => {
                if (this._selectedRecipe?.id !== capturedRec.id) {
                    rowBg.clear();
                }
            });

            this._dynamicElements.push(rowBg, dot, lvlBadge, nameTxt, matHint, hitZ);
        }

        // Empty state
        if (this._filteredRecipes.length === 0) {
            const emptyTxt = s.add.text(ox + this.LEFT_W / 2, oy + 200, 'No recipes\nin this category', {
                fontFamily: 'Open Sans', fontSize: '15px', color: '#445544', align: 'center'
            }).setOrigin(0.5).setDepth(this.DEPTH + 5);
            this._dynamicElements.push(emptyTxt);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  REFRESH — CENTER (Crafting Table)
    // ─────────────────────────────────────────────────────────────

    _refreshCenter() {
        // Remove only center dynamic elements — keep left panel elements
        this._clearCenterDynamic();
        const s = this.scene;
        const ox = this._ox + this.LEFT_W + 8;
        const oy = this._oy;
        const cw = this.CENTER_W - 16;

        if (!this._selectedRecipe) {
            const hint = s.add.text(ox + cw / 2, oy + this.PH / 2, 'Select a recipe\nfrom the left panel', {
                fontFamily: 'Open Sans', fontSize: '17px', color: '#445544', align: 'center'
            }).setOrigin(0.5).setDepth(this.DEPTH + 5);
            this._centerTitle.setText('Select a Recipe').setColor('#667766');
            this._centerDynamic = [hint];
            // Combine subsystem always visible
            this._buildCombineSection();
            return;
        }

        const rec = this._selectedRecipe;
        this._centerTitle.setText(rec.name).setColor('#88ffaa');

        const elems = [];
        let curY = oy + 44;

        // Description
        const descTxt = s.add.text(ox, curY, rec.description, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#778877',
            wordWrap: { width: cw }
        }).setDepth(this.DEPTH + 5);
        elems.push(descTxt);
        curY += descTxt.height + 8;

        // Separator
        const sep1 = s.add.graphics().setDepth(this.DEPTH + 5);
        sep1.lineStyle(1, 0x224422, 0.7);
        sep1.lineBetween(ox, curY, ox + cw, curY);
        elems.push(sep1);
        curY += 6;

        // Materials header
        const matHeader = s.add.text(ox, curY, 'MATERIALS REQUIRED:', {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#66aa66'
        }).setDepth(this.DEPTH + 5);
        elems.push(matHeader);
        curY += 16;

        // Materials list
        for (const mat of rec.materials) {
            const have = this._inventory[mat.itemId] || 0;
            const ok = have >= mat.quantity;

            // Icon area (colored rect by type)
            const iconG = s.add.graphics().setDepth(this.DEPTH + 5);
            const iconColor = this._matTypeColor(mat.itemId);
            iconG.fillStyle(iconColor, 0.8);
            iconG.fillRoundedRect(ox, curY, 14, 14, 2);
            elems.push(iconG);

            // Item name
            const itemName = this._getItemName(mat.itemId);
            const matLine = s.add.text(ox + 18, curY, itemName, {
                fontFamily: 'Open Sans', fontSize: '15px', color: ok ? '#88cc88' : '#cc6644'
            }).setDepth(this.DEPTH + 5);
            elems.push(matLine);

            // have/need counter
            const countTxt = s.add.text(ox + cw, curY, `${have}/${mat.quantity}`, {
                fontFamily: 'Open Sans', fontSize: '15px',
                color: ok ? '#44ff66' : '#ff4422'
            }).setOrigin(1, 0).setDepth(this.DEPTH + 5);
            elems.push(countTxt);

            // MISSING badge
            if (!ok) {
                const missBadge = s.add.text(ox + cw - 46, curY, 'MISSING', {
                    fontFamily: 'Open Sans', fontSize: '13px', color: '#ff4422',
                    backgroundColor: '#2a0808', padding: { x: 2, y: 1 }
                }).setDepth(this.DEPTH + 6);
                elems.push(missBadge);
            }

            curY += 20;
        }

        curY += 4;

        // Separator
        const sep2 = s.add.graphics().setDepth(this.DEPTH + 5);
        sep2.lineStyle(1, 0x224422, 0.7);
        sep2.lineBetween(ox, curY, ox + cw, curY);
        elems.push(sep2);
        curY += 6;

        // Station badge
        const stationColor = this._stationColor(rec.requiredStation);
        const stationBg = s.add.graphics().setDepth(this.DEPTH + 5);
        stationBg.fillStyle(stationColor, 0.2);
        stationBg.fillRoundedRect(ox, curY, 120, 18, 4);
        stationBg.lineStyle(1, stationColor, 0.7);
        stationBg.strokeRoundedRect(ox, curY, 120, 18, 4);
        elems.push(stationBg);

        const stationTxt = s.add.text(ox + 6, curY + 3, `${this._stationIcon(rec.requiredStation)} ${this._stationLabel(rec.requiredStation)}`, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#aaffaa'
        }).setDepth(this.DEPTH + 6);
        elems.push(stationTxt);

        // Crafting time indicator
        const timeTxt = s.add.text(ox + 130, curY + 3, `⏱ ${rec.craftingTime}s`, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#888888'
        }).setDepth(this.DEPTH + 5);
        elems.push(timeTxt);
        curY += 26;

        // Discover unlock note
        if (rec.unlockMethod === 'discover') {
            const discoverNote = s.add.text(ox, curY, '✦ Crafting this may unlock new recipes!', {
                fontFamily: 'Open Sans', fontSize: '13px', color: '#aaaaff'
            }).setDepth(this.DEPTH + 5);
            elems.push(discoverNote);
            curY += 16;
        }

        curY += 4;

        // CRAFT button
        const canCraft = this._canCraftRecipe(rec);
        const craftBtnColor = canCraft ? 0x225522 : 0x1a1a1a;
        const craftBtnHover = canCraft ? 0x336633 : 0x1a1a1a;
        const craftBtnTextColor = canCraft ? '#66ff88' : '#445544';

        this._craftBtn = this._makeBtn(
            ox + cw / 2, curY + 16, 140, 30, 'CRAFT',
            craftBtnColor, craftBtnHover,
            () => { if (canCraft && !this._isCrafting) this._doCraft(rec); }
        );
        this._craftBtn.txt.setColor(craftBtnTextColor).setFontSize('15px');
        elems.push(this._craftBtn.bg, this._craftBtn.txt, this._craftBtn.hit);
        curY += 38;

        // Progress bar placeholder (shown during crafting)
        this._progressBg = s.add.graphics().setDepth(this.DEPTH + 5);
        this._progressFg = s.add.graphics().setDepth(this.DEPTH + 6);
        elems.push(this._progressBg, this._progressFg);

        this._centerDynamic = elems;
        this._buildCombineSection();
    }

    _buildCombineSection() {
        const s = this.scene;
        const ox = this._ox + this.LEFT_W + 8;
        const oy = this._oy + this.PH - 100;
        const cw = this.CENTER_W - 16;

        const sepG = s.add.graphics().setDepth(this.DEPTH + 5);
        sepG.lineStyle(1, 0x224422, 0.7);
        sepG.lineBetween(ox, oy, ox + cw, oy);

        const hdr = s.add.text(ox, oy + 6, 'COMBINE — try two items to discover recipes:', {
            fontFamily: 'Open Sans', fontSize: '13px', color: '#66aa66'
        }).setDepth(this.DEPTH + 5);

        // Slot 1
        const slot1Label = this._combineSlot1 || 'Item 1 (click)';
        const slot1Color = this._combineSlot1 ? 0x223322 : 0x1a1a1a;
        const slot1Btn = this._makeBtn(ox + 40, oy + 34, 70, 22, slot1Label.slice(0, 10),
            slot1Color, 0x336633,
            () => {
                const picked = this._pickItemFromInventory();
                if (picked) { this._combineSlot1 = picked; this._refreshCenter(); }
            }
        );

        // Plus sign
        const plusTxt = s.add.text(ox + 83, oy + 26, '+', {
            fontFamily: 'Open Sans', fontSize: '22px', color: '#668866'
        }).setDepth(this.DEPTH + 5);

        // Slot 2
        const slot2Label = this._combineSlot2 || 'Item 2 (click)';
        const slot2Color = this._combineSlot2 ? 0x223322 : 0x1a1a1a;
        const slot2Btn = this._makeBtn(ox + 126, oy + 34, 70, 22, slot2Label.slice(0, 10),
            slot2Color, 0x336633,
            () => {
                const picked = this._pickItemFromInventory();
                if (picked) { this._combineSlot2 = picked; this._refreshCenter(); }
            }
        );

        // Attempt Combine button
        const combineOk = this._combineSlot1 && this._combineSlot2;
        const attemptBtn = this._makeBtn(ox + cw - 50, oy + 34, 88, 22, 'Attempt Combine',
            combineOk ? 0x1a2a2a : 0x111111, combineOk ? 0x224444 : 0x111111,
            () => {
                if (combineOk) {
                    EventBus.emit('crafting:combine', { itemId1: this._combineSlot1, itemId2: this._combineSlot2 });
                    this._feedback('Combining items...', '#aaaaff');
                    this._combineSlot1 = null;
                    this._combineSlot2 = null;
                    this._refreshCenter();
                }
            }
        );
        attemptBtn.txt.setColor(combineOk ? '#66ffff' : '#334433').setFontSize('9px');

        const combineElems = [sepG, hdr, plusTxt,
            slot1Btn.bg, slot1Btn.txt, slot1Btn.hit,
            slot2Btn.bg, slot2Btn.txt, slot2Btn.hit,
            attemptBtn.bg, attemptBtn.txt, attemptBtn.hit
        ];

        if (!this._centerDynamic) this._centerDynamic = [];
        this._centerDynamic.push(...combineElems);
    }

    // ─────────────────────────────────────────────────────────────
    //  REFRESH — RIGHT (Guide / Stations / Tips)
    // ─────────────────────────────────────────────────────────────

    _refreshRightPanel() {
        this._clearRightDynamic();
        const s = this.scene;
        const ox = this._ox + this.LEFT_W + this.CENTER_W + 8;
        const oy = this._oy + 70;
        const rw = this.RIGHT_W - 16;

        const elems = [];
        const addText = (y, text, opts = {}) => {
            const t = s.add.text(ox, y, text, {
                fontFamily: 'Open Sans',
                fontSize: opts.size || '10px',
                color: opts.color || '#88aa88',
                wordWrap: { width: rw },
                ...opts
            }).setDepth(this.DEPTH + 5);
            elems.push(t);
            return t;
        };

        if (this._rightTab === 'guide') {
            addText(oy, 'HOW CRAFTING WORKS', { size: '11px', color: '#88ffaa' });
            const bullets = [
                '• Select a recipe from the Recipe Book on the left.',
                '• Gather required materials from the world.',
                '• Visit the required crafting station.',
                '• Press CRAFT when all materials are available.',
                '• Quality improves with character level and Blue Sap phase.',
                '• Undiscovered recipes show as ??? — find clues to unlock them.',
                '• Use COMBINE to experiment with two items and discover hidden recipes.',
                '• Some recipes are taught by NPCs or found as scrolls in the world.'
            ];
            let by = oy + 18;
            for (const b of bullets) {
                const t = addText(by, b, { size: '9px', color: '#778877' });
                by += t.height + 4;
            }

            by += 6;
            addText(by, 'STATIONS', { size: '11px', color: '#88ffaa' });
            by += 16;
            addText(by, 'Each recipe requires a specific station. Visit it in the game world to unlock crafting there.', { size: '9px', color: '#667766' });
            by += 30;
            addText(by, 'DISCOVERY', { size: '11px', color: '#88ffaa' });
            by += 16;
            addText(by, '"Discover" recipes are found by combining unexpected materials. Experiment freely — there is no penalty for failed combinations.', { size: '9px', color: '#667766' });

        } else if (this._rightTab === 'stations') {
            const stations = [
                { icon: '⚒', name: 'Forge', id: 'forge', desc: 'Weapons, armor, metal components. Found in Bloomguard outposts and Crimson Spire. Unlocked from start.' },
                { icon: '⚗', name: 'Alchemy Table', id: 'alchemy_table', desc: 'Potions, elixirs, bombs, refined materials. Found in Emerald Coven Sanctum and Sapling Workshop.' },
                { icon: '🔨', name: 'Workbench', id: 'workbench', desc: 'Bows, traps, tools, structural consumables. Found in Sapling Workshop. Unlocked from start.' },
                { icon: '🧵', name: 'Loom', id: 'loom', desc: 'Robes, silk armor, accessories, enchanted thread. Found in Veilkeeper Atelier and Hollow Court.' }
            ];

            let sy = oy;
            for (const st of stations) {
                const cardBg = s.add.graphics().setDepth(this.DEPTH + 4);
                cardBg.fillStyle(0x0d1f0d, 0.8);
                cardBg.fillRoundedRect(ox - 2, sy - 2, rw + 4, 72, 5);
                cardBg.lineStyle(1, this._stationColor(st.id), 0.5);
                cardBg.strokeRoundedRect(ox - 2, sy - 2, rw + 4, 72, 5);
                elems.push(cardBg);

                addText(sy, `${st.icon} ${st.name}`, { size: '11px', color: '#aaffaa' });
                addText(sy + 16, st.desc, { size: '9px', color: '#668866' });
                sy += 82;
            }

        } else if (this._rightTab === 'tips') {
            addText(oy, 'CRAFTING TIPS', { size: '11px', color: '#88ffaa' });
            const tips = [
                '1. During Blue Sap phase, quality rolls get a +10% bonus.',
                '2. Higher character level unlocks better station recipes.',
                '3. Sell duplicate crafted items for a good profit margin.',
                '4. Refined materials recipes (category: Materials) let you convert common drops into rarer components.',
                '5. NPCs in hubs often teach exclusive recipes if your reputation is high enough.',
                '6. Some questlines permanently unlock a whole recipe category.',
                '7. The COMBINE system never consumes items — just reveals recipes.',
                '8. Check the Stations tab for where to find each crafting location in the world.'
            ];
            let ty = oy + 18;
            for (const tip of tips) {
                const t = addText(ty, tip, { size: '9px', color: '#778877' });
                ty += t.height + 6;
            }

            // Discovered progress
            const discovered = this._allRecipes.filter(r => !r._comment && r.discovered).length;
            const total = this._allRecipes.filter(r => !r._comment).length;
            ty += 6;
            const progBg = s.add.graphics().setDepth(this.DEPTH + 4);
            progBg.fillStyle(0x1a2a1a, 0.9);
            progBg.fillRoundedRect(ox - 2, ty - 2, rw + 4, 22, 4);
            progBg.lineStyle(1, 0x336633, 0.6);
            progBg.strokeRoundedRect(ox - 2, ty - 2, rw + 4, 22, 4);
            if (total > 0) {
                const fillW = Math.floor((rw + 4) * (discovered / total));
                progBg.fillStyle(0x336633, 0.6);
                progBg.fillRoundedRect(ox - 2, ty - 2, fillW, 22, 4);
            }
            elems.push(progBg);
            addText(ty + 2, `Recipes discovered: ${discovered} / ${total}`, { size: '10px', color: '#88ffaa' });
        }

        this._rightDynamic = elems;
    }

    // ─────────────────────────────────────────────────────────────
    //  CRAFT ACTION
    // ─────────────────────────────────────────────────────────────

    _doCraft(rec) {
        this._isCrafting = true;

        // Emit craft event
        EventBus.emit('crafting:craft', { recipeId: rec.id });

        // Animated progress bar
        const ox = this._ox + this.LEFT_W + 8;
        const barY = this._oy + this.PH - 108;
        const cw = this.CENTER_W - 16;
        const totalMs = rec.craftingTime * 1000;
        const startTime = Date.now();

        const updateBar = () => {
            if (!this._progressBg?.active) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / totalMs);

            this._progressBg.clear();
            this._progressBg.fillStyle(0x1a2a1a, 0.8);
            this._progressBg.fillRoundedRect(ox, barY, cw, 12, 3);

            this._progressFg.clear();
            this._progressFg.fillStyle(0x44ff66, 0.85);
            this._progressFg.fillRoundedRect(ox + 1, barY + 1, Math.floor((cw - 2) * progress), 10, 2);

            if (progress < 1) {
                this.scene.time.delayedCall(50, updateBar);
            } else {
                this._isCrafting = false;
                this._feedback(`Crafted: ${rec.name}!`, '#66ff88');
                this._progressBg.clear();
                this._progressFg.clear();
                this._refreshCenter();
                this._refreshRecipeList();
            }
        };
        this.scene.time.delayedCall(50, updateBar);
    }

    // ─────────────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────────────

    _canCraftRecipe(rec) {
        if (!rec?.discovered) return false;
        return rec.materials.every(m => (this._inventory[m.itemId] || 0) >= m.quantity);
    }

    _getItemName(itemId) {
        const item = dataManager.getItem ? dataManager.getItem(itemId) : null;
        if (item?.name) return item.name;
        return itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    _pickItemFromInventory() {
        // Returns first inventory item available (simple fallback; full picker can be wired)
        const keys = Object.keys(this._inventory).filter(k => (this._inventory[k] || 0) > 0);
        return keys.length > 0 ? keys[0] : null;
    }

    _catColor(category) {
        const map = {
            weapons: 0xff4444, armor: 0x4488ff, consumables: 0x44ff88,
            accessories: 0xffdd44, materials: 0xaa88ff
        };
        return map[category] || 0x888888;
    }

    _matTypeColor(itemId) {
        if (itemId.includes('crystal') || itemId.includes('shard') || itemId.includes('nexus')) return 0x4488ff;
        if (itemId.includes('ore') || itemId.includes('iron') || itemId.includes('bark')) return 0xaa8844;
        if (itemId.includes('hide') || itemId.includes('silk') || itemId.includes('thread')) return 0x886644;
        if (itemId.includes('root') || itemId.includes('moss') || itemId.includes('resin')) return 0x44aa44;
        if (itemId.includes('void') || itemId.includes('shadow')) return 0x8844aa;
        if (itemId.includes('spore') || itemId.includes('extract')) return 0xaaaa44;
        return 0x667766;
    }

    _stationColor(stationId) {
        const map = { forge: 0xff8844, alchemy_table: 0x44aaff, workbench: 0xaaaa44, loom: 0xaa44aa };
        return map[stationId] || 0x448844;
    }

    _stationLabel(stationId) {
        const map = { forge: 'Forge', alchemy_table: 'Alchemy Table', workbench: 'Workbench', loom: 'Loom' };
        return map[stationId] || stationId;
    }

    _stationIcon(stationId) {
        const map = { forge: '⚒', alchemy_table: '⚗', workbench: '🔨', loom: '🧵' };
        return map[stationId] || '◈';
    }

    _showNotification(msg) {
        this._feedback(msg, '#aaffff');
    }

    _feedback(msg, color = '#66ffaa') {
        if (!this._feedbackText?.active) return;
        this._feedbackText.setText(msg).setColor(color);
        this.scene.time.delayedCall(3000, () => {
            if (this._feedbackText?.active) this._feedbackText.setText('');
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  DYNAMIC ELEMENT MANAGEMENT
    // ─────────────────────────────────────────────────────────────

    _clearDynamic() {
        for (const el of (this._dynamicElements || [])) {
            if (el?.destroy) el.destroy();
        }
        this._dynamicElements = [];
        this._clearCenterDynamic();
        this._clearRightDynamic();
    }

    _clearCenterDynamic() {
        for (const el of (this._centerDynamic || [])) {
            if (el?.destroy) el.destroy();
        }
        this._centerDynamic = [];
    }

    _clearRightDynamic() {
        for (const el of (this._rightDynamic || [])) {
            if (el?.destroy) el.destroy();
        }
        this._rightDynamic = [];
    }

    // ─────────────────────────────────────────────────────────────
    //  BUTTON FACTORY
    // ─────────────────────────────────────────────────────────────

    _makeBtn(cx, cy, bw, bh, label, color, hoverColor, onClick) {
        const s = this.scene;
        const bx = Math.floor(cx - bw / 2);
        const by = Math.floor(cy - bh / 2);
        const bg = s.add.graphics().setDepth(this.DEPTH + 2);
        bg._bx = bx; bg._by = by; bg._bw = bw; bg._bh = bh;
        const draw = (c) => {
            bg.clear();
            bg.fillStyle(c, 0.9);
            bg.fillRoundedRect(bx, by, bw, bh, 4);
            bg.lineStyle(1, 0x336633, 0.6);
            bg.strokeRoundedRect(bx, by, bw, bh, 4);
        };
        draw(color);
        const txt = s.add.text(cx, cy, label, {
            fontFamily: 'Open Sans', fontSize: '14px', color: '#cceecc',
            stroke: '#000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(this.DEPTH + 3);
        const hit = s.add.zone(cx, cy, bw, bh).setInteractive({ useHandCursor: true }).setDepth(this.DEPTH + 4);
        hit.on('pointerover', () => draw(hoverColor));
        hit.on('pointerout', () => draw(color));
        hit.on('pointerdown', onClick);
        return { bg, txt, hit, _bx: bx, _by: by, _bw: bw, _bh: bh };
    }

    _setVisible(v) {
        for (const el of this._elements) {
            if (el?.setVisible) el.setVisible(v);
        }
        if (!v) {
            this._clearDynamic();
        }
    }
}

export default CraftingPanel;
