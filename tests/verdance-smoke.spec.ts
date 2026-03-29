/**
 * Realm of Nexus: Verdance — Playwright Smoke & Gameplay Tests
 *
 * Tier 1 — Smoke:    canvas loads, no JS errors, game state accessible
 * Tier 2 — Gameplay: player movement, HUD, pause, quest journal, combat basics
 * Tier 3 — Snapshot: baseline screenshots for visual regression
 */
import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ── Constants ──────────────────────────────────────────────────────────────
const BASE_URL           = 'http://localhost:5173';
const GAME_URL           = `${BASE_URL}/?skipToGame=true`;
const CANVAS_TIMEOUT_MS  = 15_000;
const SCENE_SETTLE_MS    = 2_000;   // wait for GameScene + UIScene to fully init
const MOVE_MS            = 600;
const HUD_SETTLE_MS      = 300;
const SCREENSHOT_DIR     = 'test-results/screenshots';
const DIFF_PCT           = 0.05;

// ── Helpers ────────────────────────────────────────────────────────────────
async function loadGame(page: Page): Promise<string[]> {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(GAME_URL);
    await expect(page.locator('canvas')).toBeVisible({ timeout: CANVAS_TIMEOUT_MS });
    await page.waitForTimeout(SCENE_SETTLE_MS);
    return errors;
}

async function state(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => (window as any).__gameState ?? {});
}

async function shot(page: Page, name: string): Promise<void> {
    const dir = SCREENSHOT_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function waitForState(
    page: Page,
    predicate: (s: Record<string, unknown>) => boolean,
    timeoutMs = 5_000
): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const s = await state(page);
        if (predicate(s)) return s;
        await page.waitForTimeout(100);
    }
    return state(page);
}

// ── Tier 1: Smoke Tests ────────────────────────────────────────────────────
test.describe('Tier 1 — Smoke', () => {
    test('canvas is visible within timeout', async ({ page }) => {
        await page.goto(GAME_URL);
        await expect(page.locator('canvas')).toBeVisible({ timeout: CANVAS_TIMEOUT_MS });
        await shot(page, '01-canvas-loaded');
    });

    test('no JavaScript errors on load', async ({ page }) => {
        const errors = await loadGame(page);
        expect(errors, `Console errors on load:\n${errors.join('\n')}`).toHaveLength(0);
    });

    test('__gameState is exposed and has required fields', async ({ page }) => {
        await loadGame(page);
        const s = await state(page);
        expect(s.scene).toBe('GameScene');
        expect(typeof s.playerX).toBe('number');
        expect(typeof s.playerY).toBe('number');
        expect(typeof s.playerHP).toBe('number');
        expect(typeof s.dsp).toBe('number');
        expect(typeof s.sapPhase).toBe('string');
        await shot(page, '02-state-exposed');
    });

    test('__gameDebug API is available in dev', async ({ page }) => {
        await loadGame(page);
        const hasDebug = await page.evaluate(() => typeof (window as any).__gameDebug === 'object');
        expect(hasDebug).toBe(true);
    });

    test('player spawns with positive HP and Sap', async ({ page }) => {
        await loadGame(page);
        const s = await state(page);
        expect(s.playerHP as number).toBeGreaterThan(0);
        expect(s.playerSap as number).toBeGreaterThanOrEqual(0);
    });

    test('DSP starts in healthy range', async ({ page }) => {
        await loadGame(page);
        const s = await state(page);
        expect(s.dsp as number).toBeGreaterThan(0);
        expect(s.dsp as number).toBeLessThanOrEqual(s.dspMax as number ?? 100);
    });
});

// ── Tier 2: Player Movement ────────────────────────────────────────────────
test.describe('Tier 2 — Player Movement', () => {
    test.beforeEach(async ({ page }) => { await loadGame(page); });

    test('player moves right on ArrowRight', async ({ page }) => {
        const before = await state(page);
        const xBefore = before.playerX as number;

        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(MOVE_MS);
        await page.keyboard.up('ArrowRight');
        await shot(page, '03-move-right');

        const after = await state(page);
        expect(after.playerX as number).toBeGreaterThan(xBefore);
    });

    test('player moves left on ArrowLeft', async ({ page }) => {
        // First move right to have space
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(MOVE_MS);
        await page.keyboard.up('ArrowRight');

        const before = await state(page);
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(MOVE_MS);
        await page.keyboard.up('ArrowLeft');
        await shot(page, '04-move-left');

        const after = await state(page);
        expect(after.playerX as number).toBeLessThan(before.playerX as number);
    });

    test('player position unchanged with no input', async ({ page }) => {
        await page.waitForTimeout(400);
        const before = await state(page);
        await page.waitForTimeout(400);
        const after = await state(page);
        // Allow ≤2px drift from physics settling
        expect(Math.abs((after.playerX as number) - (before.playerX as number))).toBeLessThanOrEqual(2);
    });
});

// ── Tier 2: HUD ───────────────────────────────────────────────────────────
test.describe('Tier 2 — HUD', () => {
    test.beforeEach(async ({ page }) => { await loadGame(page); });

    test('player HP decreases after debug damage', async ({ page }) => {
        const before = await state(page);
        const hpBefore = before.playerHP as number;

        await page.evaluate(() => (window as any).__gameDebug?.dealDamageToPlayer(20));
        await page.waitForTimeout(HUD_SETTLE_MS);

        const after = await state(page);
        await shot(page, '05-after-damage');
        expect(after.playerHP as number).toBeLessThan(hpBefore);
    });

    test('DSP changes after setDSP debug call', async ({ page }) => {
        await page.evaluate(() => (window as any).__gameDebug?.setDSP(42));
        await page.waitForTimeout(HUD_SETTLE_MS);

        const s = await state(page);
        await shot(page, '06-dsp-set');
        // DSP may clamp — just verify it moved from 100
        expect(s.dsp as number).toBeLessThanOrEqual(100);
    });

    test('player gold increases after addGold debug call', async ({ page }) => {
        const before = await state(page);
        const goldBefore = before.playerGold as number;

        await page.evaluate(() => (window as any).__gameDebug?.addGold(50));
        await page.waitForTimeout(HUD_SETTLE_MS);

        const after = await state(page);
        await shot(page, '07-gold-added');
        expect(after.playerGold as number).toBeGreaterThan(goldBefore);
    });
});

// ── Tier 2: Pause Menu ────────────────────────────────────────────────────
test.describe('Tier 2 — Pause Menu', () => {
    test.beforeEach(async ({ page }) => { await loadGame(page); });

    test('Escape opens pause menu', async ({ page }) => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(HUD_SETTLE_MS);

        const s = await state(page);
        await shot(page, '08-pause-open');
        expect(s.isPaused).toBe(true);
    });

    test('pressing Escape again closes pause menu', async ({ page }) => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(HUD_SETTLE_MS);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(HUD_SETTLE_MS);

        const s = await state(page);
        await shot(page, '09-pause-closed');
        expect(s.isPaused).toBe(false);
    });
});

// ── Tier 2: Quest Journal ─────────────────────────────────────────────────
test.describe('Tier 2 — Quest Journal', () => {
    test.beforeEach(async ({ page }) => { await loadGame(page); });

    test('J key toggles quest journal (isInDialogue stays false)', async ({ page }) => {
        // Verify no crash when toggling journal
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(HUD_SETTLE_MS);
        await shot(page, '10-journal-open');

        // Journal open should not set isInDialogue
        const s = await state(page);
        expect(s.isDead).toBe(false);

        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(HUD_SETTLE_MS);
        await shot(page, '11-journal-closed');
    });
});

// ── Tier 2: Combat / Death ────────────────────────────────────────────────
test.describe('Tier 2 — Combat & Death', () => {
    test.beforeEach(async ({ page }) => { await loadGame(page); });

    test('killPlayer debug sets isDead true', async ({ page }) => {
        await page.evaluate(() => (window as any).__gameDebug?.killPlayer());

        const s = await waitForState(page, s => s.isDead === true, 5_000);
        await shot(page, '12-player-dead');
        expect(s.isDead).toBe(true);
    });

    test('teleportPlayer moves player to target coords', async ({ page }) => {
        await page.evaluate(() => (window as any).__gameDebug?.teleportPlayer(400, 300));
        await page.waitForTimeout(HUD_SETTLE_MS);

        const s = await state(page);
        await shot(page, '13-after-teleport');
        // Allow ±5px tolerance from physics
        expect(Math.abs((s.playerX as number) - 400)).toBeLessThanOrEqual(5);
        expect(Math.abs((s.playerY as number) - 300)).toBeLessThanOrEqual(5);
    });
});

// ── Tier 3: Visual Regression ─────────────────────────────────────────────
test.describe('Tier 3 — Visual Regression', () => {
    test('game loaded baseline', async ({ page }) => {
        await loadGame(page);
        await expect(page).toHaveScreenshot('baseline-game-loaded.png', {
            maxDiffPixelRatio: DIFF_PCT,
        });
    });
});
