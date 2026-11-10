import { test, expect } from 'playwright/test';

test.describe('Hypermelo - Fluid-Particle Energy Logo Reveal & Fallback Suite', () => {
  test('1. Cinematic particle logo reveal renders with canvas, active waveform, and wordmark', async ({ page }) => {
    // Clear seen flags so intro displays
    await page.addInitScript(() => {
      sessionStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_logo_mode');
    });

    // Use pauseIntro=true so inspection tests don't race against auto-dismiss
    await page.goto('/?pauseIntro=true', { waitUntil: 'domcontentloaded' });

    // Verify dialog container is active
    const introDialog = page.locator('div[role="dialog"][aria-label="HyperMelo Brand Reveal"]');
    await expect(introDialog).toBeVisible({ timeout: 5000 });

    // Verify canvas particle engine is present and attached
    const canvas = introDialog.locator('canvas');
    await expect(canvas).toBeAttached();

    // Verify 9:16 responsive hero stage and active audio waveform spectrum
    const spectrum = page.locator('.cinematic-waveform-spectrum');
    await expect(spectrum).toBeAttached();
    const spectrumBars = page.locator('.spectrum-bar');
    await expect(spectrumBars).toHaveCount(16);

    // Verify master brand SVG lockup
    const brandSvg = page.locator('.cinematic-brand-svg');
    await expect(brandSvg).toBeVisible();

    // Verify skip button exists and clicking it dismisses the intro
    const skipBtn = page.getByRole('button', { name: /Skip brand reveal/i });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(introDialog).not.toBeVisible({ timeout: 4000 });
  });

  test('2. Fallback mode toggle between Cinematic and Legacy logo reveals', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_logo_mode');
    });

    await page.goto('/?pauseIntro=true', { waitUntil: 'domcontentloaded' });

    // Start in cinematic mode
    const cinematicDialog = page.locator('div[role="dialog"][aria-label="HyperMelo Brand Reveal"]');
    await expect(cinematicDialog).toBeVisible({ timeout: 5000 });

    // Click "Classic Reveal" toggle button
    const classicBtn = page.getByRole('button', { name: /Classic Reveal/i });
    await expect(classicBtn).toBeVisible();
    await classicBtn.click();

    // Verify it switches to the Legacy Reveal dialog
    const legacyDialog = page.locator('div[role="dialog"][aria-label="HyperMelo Brand Reveal (Legacy)"]');
    await expect(legacyDialog).toBeVisible({ timeout: 4000 });

    // Verify the switcher to return to Cinematic Vortex is present and clickable
    const vortexBtn = page.getByRole('button', { name: /Try Cinematic Vortex/i });
    await expect(vortexBtn).toBeVisible();
    await vortexBtn.click();

    // Verify it returns to the Cinematic Reveal
    await expect(cinematicDialog).toBeVisible({ timeout: 4000 });
  });

  test('3. Responsive mobile (9:16) viewport renders cleanly', async ({ page }) => {
    // Set viewport to mobile 390x844 (9:19.5 smartphone)
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      sessionStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_intro_seen');
      localStorage.removeItem('hypermelo_logo_mode');
    });

    await page.goto('/?pauseIntro=true', { waitUntil: 'domcontentloaded' });

    const introDialog = page.locator('div[role="dialog"][aria-label="HyperMelo Brand Reveal"]');
    await expect(introDialog).toBeVisible({ timeout: 5000 });

    const heroStage = page.locator('.cinematic-hero-stage');
    await expect(heroStage).toBeVisible();

    const skipBtn = page.getByRole('button', { name: /Skip brand reveal/i });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(introDialog).not.toBeVisible({ timeout: 4000 });
  });
});
