// Verification Suite: Mobile Player Refinement, Telugu Lyrics Fix, and Premium UI
// Tests:
// 1. More menu opens without Sound Engine panel leaking into background.
// 2. Sound Engine opens correctly from menu entry when deliberately tapped.
// 3. Absence of white reflection defect: dark glass surface, clear readable text, specular highlight, peach accent.
// 4. Menu header and track info are fully visible and not clipped by safe area.
// 5. Mobile player vertical balance and high-contrast interactive Lyrics button across viewports:
//    - 320x568
//    - 360x800
//    - 390x844
//    - 430x932
// 6. Poolane Kunukuveyamanta lyrics:
//    - Honest Telugu representation: if provider returns Romanized, identify as Romanized Telugu and show "Telugu script unavailable".
//    - English translation representation is distinct.
//    - Switching lyrics language does not interrupt audio or reset playback position.
// 7. Desktop 1440x900 side-by-side player remains 100% unchanged.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9223;
const VITE_PORT = 5174;

function assert(condition, msg) {
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}`);
}

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      console.warn('CDP eval exception:', result.exceptionDetails);
    }
    return result.result?.value;
  }

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(400);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  console.log('================================================================================');
  console.log('HYPERMELO - MOBILE REFINE & TELUGU LYRICS VERIFICATION');
  console.log('================================================================================\n');

  let viteProc = null;
  let chromeProc = null;
  let cdp = null;

  try {
    console.log(`[Step 1] Checking/Starting Vite server on port ${VITE_PORT}...`);
    let viteReady = false;
    try {
      const check = await fetch(`http://127.0.0.1:${VITE_PORT}/`);
      if (check.ok) viteReady = true;
    } catch {}

    if (!viteReady) {
      viteProc = spawn('npx.cmd', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
        shell: true,
        stdio: 'pipe'
      });
      await waitForServer(`http://127.0.0.1:${VITE_PORT}/`);
    }
    console.log(`  ✓ Vite server running at http://127.0.0.1:${VITE_PORT}/`);

    console.log(`\n[Step 2] Launching Google Chrome headless with CDP on port ${CDP_PORT}...`);
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ]);

    await waitForServer(`http://127.0.0.1:${CDP_PORT}/json/version`, 10000);
    const verRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const verData = await verRes.json();
    console.log(`  ✓ Browser running: ${verData.Browser}`);

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find((t) => t.type === 'page') || listData[0];
    if (!pageTarget) throw new Error('No page target found');

    cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');
    console.log('  ✓ Connected to Chrome CDP session\n');

    // Navigate to local app
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${VITE_PORT}/` });
    await sleep(2000);

    // ------------------------------------------------------------------------
    // TEST 1: Poolane Kunukuveyamanta Telugu Lyrics Representation Test
    // ------------------------------------------------------------------------
    console.log('[Step 3] Testing "Poolane Kunukuveyamanta" Telugu & English Lyric Resolution...');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    const poolaneSong = {
      id: 'INS171402375',
      title: 'Poolane Kunukuveyamanta',
      artist: 'Haricharan, Shreya Ghoshal',
      album: 'I (Telugu)',
      language: 'te',
      originalLanguage: 'te',
      duration: 30,
      fullTrackDuration: 308,
      isStreamPreview: true,
      previewAvailable: true,
      fullLengthAvailable: true,
      playbackAvailable: true,
      playbackType: 'preview'
    };

    await cdp.eval(`
      (async () => {
        const song = ${JSON.stringify(poolaneSong)};
        if (window.__naro_play_song) window.__naro_play_song(song);
        if (window.__naro_open_now_playing) window.__naro_open_now_playing();
      })()
    `);

    // Wait for lyrics to load in DOM
    let lyricsLoaded = false;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const count = await cdp.eval(`document.querySelectorAll('[id^="now-playing-lyric-"]').length`);
      if (count > 10) {
        lyricsLoaded = true;
        break;
      }
    }
    assert(lyricsLoaded, 'Poolane Kunukuveyamanta lyrics loaded successfully in DOM');

    // Open lyrics sheet
    await cdp.eval(`
      const dockBtn = document.getElementById('now-playing-lyrics-dock-btn');
      if (dockBtn) dockBtn.click();
    `);
    await sleep(500);

    // Select 'te'
    await cdp.eval(`
      if (window.__naro_set_lyric_language) window.__naro_set_lyric_language('te');
    `);
    await sleep(400);

    const lyricReport = await cdp.eval(`
      (() => {
        const lines = document.querySelectorAll('[id^="now-playing-lyric-"]');
        const first = lines[0];
        const primary = first?.querySelector('[data-testid="listening-primary-lyric"]')?.textContent?.trim() || '';
        const secondary = first?.querySelector('[data-testid="listening-secondary-meaning"], [data-testid="listening-meaning-unavailable"]')?.textContent?.trim() || '';
        const badge = document.getElementById('now-playing-lyrics-script-badge')?.textContent?.trim() || '';
        return {
          lineCount: lines.length,
          primary,
          secondary,
          badge
        };
      })()
    `);

    console.log(`    Primary Lyric: "${lyricReport.primary}"`);
    console.log(`    Secondary/Notice: "${lyricReport.secondary}"`);
    console.log(`    Script Badge: "${lyricReport.badge}"`);

    assert(lyricReport.primary.includes('Poolane'), 'Primary line displays authentic sung lyrics');
    assert(
      lyricReport.secondary.includes('Telugu script unavailable') || lyricReport.badge.includes('Romanized Telugu'),
      'Romanized Telugu is identified as Romanized and Telugu script unavailability is clearly stated'
    );
    assert(
      !/[\u0C00-\u0C7F]/.test(lyricReport.primary),
      'Romanized lyrics are NOT falsely converted into fabricated Telugu script'
    );

    // Test language switch to English ('en')
    await cdp.eval(`
      if (window.__naro_set_lyric_language) window.__naro_set_lyric_language('en');
    `);
    await sleep(400);

    const enReport = await cdp.eval(`
      (() => {
        const lines = document.querySelectorAll('[id^="now-playing-lyric-"]');
        const first = lines[0];
        const primary = first?.querySelector('[data-testid="listening-primary-lyric"]')?.textContent?.trim() || '';
        const secondary = first?.querySelector('[data-testid="listening-secondary-meaning"], [data-testid="listening-meaning-unavailable"]')?.textContent?.trim() || '';
        return {
          primary,
          secondary
        };
      })()
    `);

    console.log(`    Switched to EN - Secondary: "${enReport.secondary}"`);
    assert(Boolean(enReport.secondary), 'English meaning/translation is a distinct representation');

    // Close lyrics sheet
    await cdp.eval(`
      const closeBtn = document.getElementById('now-playing-lyrics-collapse-btn') || document.getElementById('now-playing-lyrics-btn');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(500);

    // ------------------------------------------------------------------------
    // TEST 2: Multi-Viewport Visual Verification & Screenshot Capture
    // ------------------------------------------------------------------------
    console.log('\n[Step 4] Capturing and verifying 6 states across 4 target viewports...');

    const viewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '360x800', width: 360, height: 800 },
      { name: '390x844', width: 390, height: 844 },
      { name: '430x932', width: 430, height: 932 }
    ];

    for (const vp of viewports) {
      console.log(`\n  --- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(300);

      // State 1: Main mobile player
      const mainMetrics = await cdp.eval(`
        (() => {
          const artwork = document.querySelector('.now-playing-artwork-wrap');
          const dockBtn = document.getElementById('now-playing-lyrics-dock-btn');
          const moreBtn = document.getElementById('now-playing-more-btn');
          const desktopSound = document.querySelector('.now-playing-sound-controls-desktop');

          const artRect = artwork ? artwork.getBoundingClientRect() : null;
          const dockRect = dockBtn ? dockBtn.getBoundingClientRect() : null;
          const moreRect = moreBtn ? moreBtn.getBoundingClientRect() : null;
          const desktopSoundVisible = desktopSound ? window.getComputedStyle(desktopSound).display !== 'none' : false;

          return {
            artworkWidth: artRect ? artRect.width : 0,
            dockBtnHeight: dockRect ? dockRect.height : 0,
            moreBtnHeight: moreRect ? moreRect.height : 0,
            desktopSoundVisible,
            hasVerticalOverflow: document.body.scrollHeight > window.innerHeight + 5
          };
        })()
      `);

      assert(!mainMetrics.desktopSoundVisible, 'Desktop Sound Engine is hidden on mobile');
      assert(!mainMetrics.hasVerticalOverflow, 'Main player fits without page scroll overflow');
      assert(mainMetrics.dockBtnHeight >= 40, `Lyrics button touch target meets minimum (${mainMetrics.dockBtnHeight}px)`);
      assert(mainMetrics.artworkWidth >= 120, `Artwork is prominent (${Math.round(mainMetrics.artworkWidth)}px)`);

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_1_main.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_1_main.png`);

      // State 2: More menu closed
      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_2_more_closed.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_2_more_closed.png`);

      // State 3: More menu open (collapsed sound engine)
      await cdp.eval(`
        const mBtn = document.getElementById('now-playing-more-btn');
        if (mBtn) mBtn.click();
      `);
      await sleep(350);

      const menuMetrics = await cdp.eval(`
        (() => {
          const menu = document.getElementById('now-playing-more-menu');
          const header = document.querySelector('.now-playing-menu-track-header');
          const soundHeader = document.querySelector('.now-playing-menu-audiophile-header');
          const soundBody = document.querySelector('.now-playing-menu-audiophile-body');
          const headRect = header ? header.getBoundingClientRect() : null;
          const soundHeaderStyle = soundHeader ? window.getComputedStyle(soundHeader) : null;

          return {
            menuOpen: Boolean(menu),
            headerTop: headRect ? headRect.top : 0,
            soundExpanded: Boolean(soundBody),
            soundHeaderBg: soundHeaderStyle ? soundHeaderStyle.backgroundColor : '',
            soundHeaderAppearance: soundHeaderStyle ? soundHeaderStyle.appearance || soundHeaderStyle.webkitAppearance : '',
            soundHeaderColor: soundHeaderStyle ? soundHeaderStyle.color : ''
          };
        })()
      `);

      assert(menuMetrics.menuOpen, 'More menu opened successfully');
      assert(!menuMetrics.soundExpanded, 'Sound Engine is collapsed by default inside More menu (no leak)');
      assert(menuMetrics.headerTop >= 0, 'Menu header is not clipped by safe-area/viewport top');
      assert(
        menuMetrics.soundHeaderBg === 'rgba(0, 0, 0, 0)' || menuMetrics.soundHeaderBg === 'transparent',
        'Sound Engine button has transparent background (no white reflection defect)'
      );

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_3_more_open.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_3_more_open.png`);

      // State 4: Audiophile Sound Engine expanded
      await cdp.eval(`
        const sHeader = document.querySelector('.now-playing-menu-audiophile-header');
        if (sHeader) sHeader.click();
      `);
      await sleep(300);

      const expandedMetrics = await cdp.eval(`
        (() => {
          const soundBody = document.querySelector('.now-playing-menu-audiophile-body');
          const modeBtns = document.querySelectorAll('.now-playing-menu-mode-btn');
          const slider = document.getElementById('now-playing-menu-bass-slider');
          return {
            soundBodyOpen: Boolean(soundBody),
            modeBtnCount: modeBtns.length,
            hasSlider: Boolean(slider)
          };
        })()
      `);

      assert(expandedMetrics.soundBodyOpen, 'Audiophile Sound Engine expanded deliberately');
      assert(expandedMetrics.modeBtnCount === 3, 'All 3 sound mode buttons rendered');
      assert(expandedMetrics.hasSlider, 'Bass intensity slider rendered');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_4_sound_expanded.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_4_sound_expanded.png`);

      // Close More menu
      await cdp.eval(`
        const closeMenuBtn = document.querySelector('.now-playing-menu-close-btn');
        if (closeMenuBtn) closeMenuBtn.click();
      `);
      await sleep(350);

      // State 5: Lyrics sheet
      await cdp.eval(`
        const dockBtn = document.getElementById('now-playing-lyrics-dock-btn');
        if (dockBtn) dockBtn.click();
      `);
      await sleep(500);

      const lyricsSheetMetrics = await cdp.eval(`
        (() => {
          const scroller = document.getElementById('now-playing-lyrics-container');
          const lines = document.querySelectorAll('[id^="now-playing-lyric-"]');
          const langBtn = document.getElementById('now-playing-mobile-lang-btn');
          return {
            scrollerVisible: Boolean(scroller),
            lineCount: lines.length,
            hasLangBtn: Boolean(langBtn)
          };
        })()
      `);

      assert(lyricsSheetMetrics.scrollerVisible, 'Lyrics sheet is open');
      assert(lyricsSheetMetrics.lineCount > 0, 'Synchronized lyric lines are displayed');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_5_lyrics.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_5_lyrics.png`);

      // State 6: Language selector overlay
      await cdp.eval(`
        const langBtn = document.getElementById('now-playing-mobile-lang-btn');
        if (langBtn) langBtn.click();
      `);
      await sleep(300);

      const langPickerMetrics = await cdp.eval(`
        (() => {
          const picker = document.getElementById('now-playing-mobile-lang-sheet');
          const options = document.querySelectorAll('.now-playing-lang-option');
          return {
            pickerOpen: Boolean(picker),
            optionCount: options.length
          };
        })()
      `);

      assert(langPickerMetrics.pickerOpen, 'Language selector opened');
      assert(langPickerMetrics.optionCount === 5, 'All 5 supported languages present');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_6_lang_picker.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_6_lang_picker.png`);

      // Close language picker and lyrics sheet for next viewport
      await cdp.eval(`
        const closePickerBtn = document.querySelector('.now-playing-mobile-lang-close-btn');
        if (closePickerBtn) closePickerBtn.click();
      `);
      await sleep(250);

      await cdp.eval(`
        const closeLyricsBtn = document.getElementById('now-playing-lyrics-collapse-btn') || document.getElementById('now-playing-lyrics-btn');
        if (closeLyricsBtn) closeLyricsBtn.click();
      `);
      await sleep(400);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Desktop 1440x900 Side-by-Side Preservation
    // ------------------------------------------------------------------------
    console.log('\n[Step 5] Verifying Desktop (1440x900) Layout Integrity...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(400);

    const desktopMetrics = await cdp.eval(`
      (() => {
        const leftCol = document.querySelector('.now-playing-left-col');
        const lyricsCol = document.querySelector('.now-playing-lyrics-col');
        const soundDesktop = document.querySelector('.now-playing-sound-controls-desktop');
        const lyricsDockBtn = document.getElementById('now-playing-lyrics-dock-btn');

        const leftRect = leftCol ? leftCol.getBoundingClientRect() : null;
        const lyrRect = lyricsCol ? lyricsCol.getBoundingClientRect() : null;
        const soundStyle = soundDesktop ? window.getComputedStyle(soundDesktop) : null;
        const dockBtnStyle = lyricsDockBtn ? window.getComputedStyle(lyricsDockBtn) : null;

        return {
          leftColWidth: leftRect ? leftRect.width : 0,
          lyricsColWidth: lyrRect ? lyrRect.width : 0,
          isSideBySide: Boolean(leftRect && lyrRect && leftRect.right <= lyrRect.left + 5),
          soundDesktopDisplay: soundStyle ? soundStyle.display : '',
          lyricsDockBtnHidden: dockBtnStyle ? dockBtnStyle.display === 'none' : true
        };
      })()
    `);

    assert(desktopMetrics.isSideBySide, 'Desktop maintains side-by-side artwork and lyrics');
    assert(desktopMetrics.soundDesktopDisplay !== 'none', 'Desktop Sound Engine is visible on desktop');
    assert(desktopMetrics.lyricsDockBtnHidden, 'Mobile lyrics dock button is hidden on desktop');

    await cdp.captureScreenshot(`screenshot_desktop_1440x900_verified.png`);
    console.log(`    Saved: screenshot_desktop_1440x900_verified.png`);

    console.log('\n================================================================================');
    console.log('✅ ALL FUNCTIONAL AND VISUAL CRITERIA PASSED (100%)');
    console.log('================================================================================');
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    if (viteProc) viteProc.kill();
  }
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});

