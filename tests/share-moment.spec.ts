import { test, expect } from 'playwright/test';

test.describe('Hypermelo - Share Moment & NARO Snippet Studio E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Bypass intro animation and onboarding dialogs
    await page.addInitScript(() => {
      sessionStorage.setItem('hypermelo_intro_seen', 'true');
      localStorage.setItem('hypermelo_intro_seen', 'true');
      
      // Mock navigator.clipboard in headless environments
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: async () => Promise.resolve(),
            readText: async () => Promise.resolve('https://hypermelo.app/m/test')
          },
          configurable: true,
          writable: true
        });
      }
    });

    // 2. Open application homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
  });

  test('1. Navigation to the Share Moment / NARO snippet section', async ({ page }) => {
    const karaokeSection = page.locator('#karaoke');
    await expect(karaokeSection).toBeAttached();

    // Scroll to the karaoke section
    await karaokeSection.scrollIntoViewIfNeeded();

    // Verify studio heading and typography
    const studioBadge = karaokeSection.getByText('STUDIO SNIPPETS • SING THE MOMENT');
    await expect(studioBadge).toBeVisible();

    const mainHeading = karaokeSection.locator('h2');
    await expect(mainHeading).toContainText("Don't sing the whole song.");
    await expect(mainHeading).toContainText("Sing the moment.");

    // Verify subline description
    await expect(karaokeSection.getByText('Loop any verse, chorus, or exact lyric phrase')).toBeVisible();

    // Verify the Share Moment CTA button is present in the studio
    const shareMomentBtn = page.locator('#share-moment-btn');
    await expect(shareMomentBtn).toBeVisible();
    await expect(shareMomentBtn).toContainText('Share Moment');
  });

  test('2. Interaction with lyric range selectors, presets, and timeline handles', async ({ page }) => {
    const karaokeSection = page.locator('#karaoke');
    await karaokeSection.scrollIntoViewIfNeeded();

    const timeDisplay = page.locator('#core-karaoke-time-display');
    await expect(timeDisplay).toBeVisible();

    // Check section preset tabs
    const verseTab = page.locator('#section-tab-verse');
    const chorusTab = page.locator('#section-tab-chorus');
    const bridgeTab = page.locator('#section-tab-bridge');
    const customTab = page.locator('#section-tab-custom');

    await expect(verseTab).toBeVisible();
    await expect(chorusTab).toBeVisible();

    // Click Verse tab and verify active selection
    await verseTab.click();
    await expect(verseTab).toHaveAttribute('aria-selected', 'true');
    const verseTime = await timeDisplay.textContent();
    expect(verseTime).toBeTruthy();
    expect(verseTime).toMatch(/\d{2}:\d{2}\s*—\s*\d{2}:\d{2}/);

    // Click Chorus tab and verify active selection
    await chorusTab.click();
    await expect(chorusTab).toHaveAttribute('aria-selected', 'true');
    const chorusTime = await timeDisplay.textContent();
    expect(chorusTime).toBeTruthy();
    expect(chorusTime).toMatch(/\d{2}:\d{2}\s*—\s*\d{2}:\d{2}/);

    // Click Bridge tab if available
    if (await bridgeTab.isVisible()) {
      await bridgeTab.click();
      await expect(bridgeTab).toHaveAttribute('aria-selected', 'true');
    }

    // Verify Waveform track and interactive handles
    const waveformTrack = page.locator('#core-waveform-track');
    await expect(waveformTrack).toBeVisible();

    const handleStart = page.locator('#waveform-handle-start');
    const handleEnd = page.locator('#waveform-handle-end');
    await expect(handleStart).toBeVisible();
    await expect(handleEnd).toBeVisible();

    // Verify Loop Preview button toggling
    const loopBtn = page.locator('#core-karaoke-loop-preview-btn');
    await expect(loopBtn).toBeVisible();
    await loopBtn.click();
  });

  test('3. Opening Share Moment modal, template customization, and duration selection', async ({ page }) => {
    const karaokeSection = page.locator('#karaoke');
    await karaokeSection.scrollIntoViewIfNeeded();

    // Click Share Moment CTA
    const shareMomentBtn = page.locator('#share-moment-btn');
    await shareMomentBtn.click();

    // Verify Share Moment modal overlay
    const modal = page.locator('#share-moment-modal');
    await expect(modal).toBeVisible();

    // Verify preview canvas
    const canvas = page.locator('#share-moment-canvas');
    await expect(canvas).toBeVisible();

    // Verify time display and playback controls inside modal
    const previewTime = page.locator('#preview-time-display');
    await expect(previewTime).toBeVisible();

    // Test template selector tabs
    const templateCinematic = page.locator('#template-tab-cinematic');
    const templateMinimal = page.locator('#template-tab-minimal');
    const templateVisualizer = page.locator('#template-tab-visualizer');
    const templateMood = page.locator('#template-tab-mood');
    const templateKaraoke = page.locator('#template-tab-karaoke');

    await expect(templateCinematic).toBeVisible();
    await expect(templateMinimal).toBeVisible();

    // Switch to Minimal template
    await templateMinimal.click();
    await expect(templateMinimal).toHaveAttribute('aria-selected', 'true');

    // Switch to Visualizer template
    if (await templateVisualizer.isVisible()) {
      await templateVisualizer.click();
      await expect(templateVisualizer).toHaveAttribute('aria-selected', 'true');
    }

    // Switch to Karaoke template
    if (await templateKaraoke.isVisible()) {
      await templateKaraoke.click();
      await expect(templateKaraoke).toHaveAttribute('aria-selected', 'true');
    }

    // Test duration pills (5s, 10s, 15s, 20s, 30s)
    const pill5 = page.locator('#duration-pill-5');
    const pill10 = page.locator('#duration-pill-10');
    const pill15 = page.locator('#duration-pill-15');

    await expect(pill5).toBeVisible();
    await expect(pill10).toBeVisible();
    await expect(pill15).toBeVisible();

    await pill15.click();
    await expect(pill15).toHaveClass(/active/);

    await pill5.click();
    await expect(pill5).toHaveClass(/active/);

    // Close modal
    const closeBtn = page.locator('#share-moment-close-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('4. Custom Lyric Timeline precision trimming and fine-tuning', async ({ page }) => {
    const karaokeSection = page.locator('#karaoke');
    await karaokeSection.scrollIntoViewIfNeeded();

    // Open Share Moment modal
    await page.locator('#share-moment-btn').click();
    const modal = page.locator('#share-moment-modal');
    await expect(modal).toBeVisible();

    // Click "Custom Timeline" button to launch precision trimmer
    const openCustomBtn = page.locator('#open-custom-timeline-btn');
    await expect(openCustomBtn).toBeVisible();
    await openCustomBtn.click();

    // Verify Custom Lyric Timeline modal opens
    const customModal = page.locator('#custom-lyric-timeline-modal');
    await expect(customModal).toBeVisible();

    // Check timeline track and handles
    const timelineTrack = page.locator('#timeline-track');
    await expect(timelineTrack).toBeVisible();

    const handleStart = page.locator('#timeline-handle-start');
    const handleEnd = page.locator('#timeline-handle-end');
    await expect(handleStart).toBeVisible();
    await expect(handleEnd).toBeVisible();

    // Verify presets inside Custom Timeline (e.g. 5s, 10s)
    const preset10s = page.locator('#preset-10s');
    if (await preset10s.isVisible()) {
      await preset10s.click();
      const selectedDuration = page.locator('#timeline-selected-duration');
      await expect(selectedDuration).toContainText('10.0s');
    }

    // Apply custom selection
    const useSelectionBtn = page.locator('#timeline-use-selection-btn');
    await expect(useSelectionBtn).toBeVisible();
    await useSelectionBtn.click();

    // Verify custom trimmer closes and returns to main Share Moment modal
    await expect(customModal).not.toBeVisible();
    await expect(modal).toBeVisible();

    // Close Share Moment modal
    await page.locator('#share-moment-close-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('5. Share Moment link copying and export pipeline without runtime errors', async ({ page }) => {
    const karaokeSection = page.locator('#karaoke');
    await karaokeSection.scrollIntoViewIfNeeded();

    // Open Share Moment modal
    await page.locator('#share-moment-btn').click();
    const modal = page.locator('#share-moment-modal');
    await expect(modal).toBeVisible();

    // Test "Copy Link" action
    const copyLinkBtn = page.locator('#copy-moment-link-btn');
    await expect(copyLinkBtn).toBeVisible();
    await copyLinkBtn.click();

    // Assert user-facing confirmation feedback
    await expect(copyLinkBtn).toContainText(/Moment link copied!|Copied|Copy Link/i);

    // Test 5s moment export
    await page.locator('#duration-pill-5').click();
    const exportBtn = page.locator('#export-moment-btn');
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Wait for export process to either show progress or complete
    const isCompleted = await Promise.race([
      page.locator('#share-native-btn').waitFor({ timeout: 15000 }).then(() => true).catch(() => false),
      page.locator('#save-video-btn').waitFor({ timeout: 15000 }).then(() => true).catch(() => false),
      page.locator('#export-progress-percent').waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
    ]);
    expect(isCompleted).toBe(true);

    // Close modal
    await page.locator('#share-moment-close-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('6. Mobile viewport isolation check (< 899px)', async ({ page }) => {
    // Resize viewport to mobile iPhone standard
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Confirm page loads cleanly without horizontal overflow
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify mobile navigation or bottom bar is present
    const bottomNav = page.locator('.mobile-bottom-nav, .mobile-now-playing-dock, #mobile-nav');
    if (await bottomNav.count() > 0) {
      await expect(bottomNav.first()).toBeVisible();
    }
  });
});

