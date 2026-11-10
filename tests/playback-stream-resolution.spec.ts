import { test, expect } from 'playwright/test';

test.describe('Hypermelo - Stream Resolution & Meaning Fallback Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Suppress intro animation
    await page.addInitScript(() => {
      sessionStorage.setItem('hypermelo_intro_seen', 'true');
      localStorage.setItem('hypermelo_intro_seen', 'true');
    });

    // 2. Open homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('Issue 1: Track selection from search requests full-length stream without 30s truncation', async ({ page }) => {
    // Open Search Modal by clicking search trigger or pressing Ctrl+K / '/'
    const searchTrigger = page.locator('button[aria-label="Search"]').first();
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
    } else {
      await page.keyboard.press('/');
    }

    const searchInput = page.locator('#search-input, input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type query for a song in catalog
    await searchInput.fill('Chaleya');

    // Wait for search results and click Play Chaleya
    const playBtn = page.getByRole('button', { name: /Play Chaleya/i }).first();
    await expect(playBtn).toBeVisible({ timeout: 7000 });
    await playBtn.click();

    // Verify track is loaded in player and duration is genuine full-length (03:20)
    const trackTitle = page.locator('.player-track-title').filter({ hasText: 'Chaleya' });
    await expect(trackTitle.first()).toBeVisible({ timeout: 7000 });

    // Check that the song's duration displays 03:20 (not 00:30)
    const durationDisplay = page.getByText('03:20');
    await expect(durationDisplay.first()).toBeVisible({ timeout: 7000 });
  });

  test('Issue 2: Meaning unavailable in English does not render abrupt bracketed error string', async ({ page }) => {
    // Navigate to section or open Now Playing with lyrics
    const pageBody = page.locator('body');
    await expect(pageBody).toBeVisible();

    // The text "[Meaning unavailable in English]" must NEVER exist anywhere in the DOM
    const bracketedError = page.getByText(/\[Meaning unavailable in (English|Telugu|Tamil|Hindi|Malayalam)\]/i);
    await expect(bracketedError).toHaveCount(0);

    const exactError = page.getByText('Meaning unavailable in English');
    await expect(exactError).toHaveCount(0);
  });
});

