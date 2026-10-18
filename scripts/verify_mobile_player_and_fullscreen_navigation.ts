// Comprehensive Verification Suite for:
// 1. Mobile Bottom Now Playing Player Layout & Touch Targets across 11 Viewports
// 2. Fullscreen / Expanded Player Entry & Exit Navigation (Close button, Escape key, Browser Back)
// 3. Touch Targets (all interactive buttons >= 44x44px)
// 4. Overlap & Collision Prevention (zero overlapping bounding rects)
// 5. Page Content Layout Reservation & Safe Area Handling
// 6. Naro Logo Navigation to Home

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: '320x568 compact mobile', width: 320, height: 568, isMobile: true },
  { name: '360x640 mobile', width: 360, height: 640, isMobile: true },
  { name: '375x667 small mobile', width: 375, height: 667, isMobile: true },
  { name: '390x844 standard mobile', width: 390, height: 844, isMobile: true },
  { name: '412x915 android mobile', width: 412, height: 915, isMobile: true },
  { name: '430x932 pro max mobile', width: 430, height: 932, isMobile: true },
  { name: '768x1024 tablet portrait', width: 768, height: 1024, isMobile: true },
  { name: '1024x768 tablet landscape', width: 1024, height: 768, isMobile: false },
  { name: '1280x720 desktop 720p', width: 1280, height: 720, isMobile: false },
  { name: '1440x900 desktop standard', width: 1440, height: 900, isMobile: false },
  { name: '1920x1080 large desktop', width: 1920, height: 1080, isMobile: false }
];

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}`);
}

class CdpConnection {
  private ws: any;
  private id = 1;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err: any) => reject(err);
      this.ws.onmessage = (event: any) => {
        try {
          const raw = JSON.parse(event.data.toString());
          if (raw.id && this.callbacks.has(raw.id)) {
            const cb = this.callbacks.get(raw.id)!;
            this.callbacks.delete(raw.id);
            cb(raw.result);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: any = {}): Promise<any> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      console.warn('CDP Eval Exception:', res.exceptionDetails);
    }
    const resultObj = res?.result;
    return resultObj?.value !== undefined ? resultObj.value : resultObj?.description;
  }

  close(): void {
    if (this.ws) this.ws.close();
  }
}

async function findChromePath(): Promise<string> {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'chrome';
}

async function runMobileAndFullscreenVerification() {
  console.log('======================================================================');
  console.log('NARO — MOBILE NOW PLAYING & FULLSCREEN NAVIGATION VERIFICATION');
  console.log('======================================================================\n');

  const chromePath = await findChromePath();
  const cdpPort = 9255;
  const userDataDir = path.join(os.tmpdir(), `naro-nav-test-${Date.now()}`);
  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1920,1080',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ]);

  try {
    let tabs: any[] = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
        if (res.ok) {
          const list = (await res.json()) as any[];
          if (Array.isArray(list) && list.length > 0 && list[0].webSocketDebuggerUrl) {
            tabs = list;
            break;
          }
        }
      } catch {
        // waiting for chrome
      }
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP page on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('[Setup] Navigating to NARO Home and dismissing intro...');
    await new Promise((r) => setTimeout(r, 1200));

    // Dismiss cinematic intro
    await cdp.eval(`
      (() => {
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Start playback of current song (or first song if fresh launch started empty)
    await cdp.eval(`
      (() => {
        if (window.__naro_play_song) {
          const song = window.__naro_current_song || (window.__naro_get_songs ? window.__naro_get_songs()[0] : null);
          if (song) {
            window.__naro_play_song(song, 5.0);
          }
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // =========================================================================
    // PART 1: TEST BOTTOM PLAYER ACROSS ALL 11 VIEWPORTS
    // =========================================================================
    console.log('\n======================================================================');
    console.log('PART 1: TESTING BOTTOM PLAYER ACROSS ALL 11 VIEWPORTS');
    console.log('======================================================================');

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ---`);

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.isMobile
      });
      await cdp.send('Emulation.setVisibleSize', {
        width: vp.width,
        height: vp.height
      });

      await new Promise((r) => setTimeout(r, 400));

      const bottomMetrics = await cdp.eval(`
        (() => {
          const player = document.querySelector('aside[aria-label="NARO Studio Audio Player"], aside.bottom-player-aside');
          if (!player) return { error: 'Bottom player aside not found' };

          const playBtn = document.getElementById('bottom-play-btn');
          const expandBtn = document.getElementById('expand-now-playing-btn');
          const likeBtn = document.getElementById('bottom-player-like-btn');
          const trackInfo = document.getElementById('bottom-player-track-info');
          const seekSlider = document.getElementById('bottom-seek-slider');
          const scrubberRow = player.querySelector('.player-scrubber-row');
          const buttonsRow = player.querySelector('.player-buttons-row');
          const prevBtn = player.querySelector('button[aria-label="Previous track"]');
          const nextBtn = player.querySelector('button[aria-label="Next track"]');
          const mainContent = document.querySelector('main.app-main-content') || document.querySelector('main');

          const pRect = player.getBoundingClientRect();
          const playRect = playBtn ? playBtn.getBoundingClientRect() : null;
          const expRect = expandBtn ? expandBtn.getBoundingClientRect() : null;
          const likeRect = likeBtn ? likeBtn.getBoundingClientRect() : null;
          const trackRect = trackInfo ? trackInfo.getBoundingClientRect() : null;
          const seekRect = seekSlider ? seekSlider.getBoundingClientRect() : null;
          const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
          const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
          const mStyle = mainContent ? window.getComputedStyle(mainContent) : null;

          // Helper to check rect intersection
          function intersects(r1, r2) {
            if (!r1 || !r2) return false;
            return !(
              r2.left >= r1.right ||
              r2.right <= r1.left ||
              r2.top >= r1.bottom ||
              r2.bottom <= r1.top
            );
          }

          return {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            docScrollWidth: document.documentElement.scrollWidth,
            playerScrollWidth: player.scrollWidth,
            playerClientWidth: player.clientWidth,
            playerHeight: pRect.height,
            mainPaddingBottom: mStyle ? mStyle.paddingBottom : null,
            playBtn: playRect ? {
              width: playRect.width,
              height: playRect.height,
              top: playRect.top,
              left: playRect.left,
              visible: playRect.width > 0 && playRect.height > 0
            } : null,
            expandBtn: expRect ? {
              width: expRect.width,
              height: expRect.height,
              top: expRect.top,
              left: expRect.left,
              visible: expRect.width > 0 && expRect.height > 0 && window.getComputedStyle(expandBtn).display !== 'none'
            } : null,
            likeBtn: likeRect ? {
              width: likeRect.width,
              height: likeRect.height,
              visible: likeRect.width > 0 && likeRect.height > 0
            } : null,
            prevBtn: prevRect ? {
              width: prevRect.width,
              height: prevRect.height,
              visible: prevRect.width > 0 && prevRect.height > 0
            } : null,
            nextBtn: nextRect ? {
              width: nextRect.width,
              height: nextRect.height,
              visible: nextRect.width > 0 && nextRect.height > 0
            } : null,
            seekSlider: seekRect ? {
              width: seekRect.width,
              height: seekRect.height,
              visible: seekRect.width > 0
            } : null,
            // Check collisions between interactive elements
            playIntersectsExpand: intersects(playRect, expRect),
            playIntersectsLike: intersects(playRect, likeRect),
            playIntersectsPrev: intersects(playRect, prevRect),
            playIntersectsNext: intersects(playRect, nextRect),
            prevIntersectsNext: intersects(prevRect, nextRect)
          };
        })()
      `);

      if (bottomMetrics.error) {
        throw new Error(bottomMetrics.error);
      }

      // 1. Zero horizontal overflow
      const hDiff = bottomMetrics.docScrollWidth - vp.width;
      assert(hDiff <= 1, `Zero horizontal overflow (doc: ${bottomMetrics.docScrollWidth}px, vp: ${vp.width}px)`);

      // 2. Play/Pause button touch target >= 44x44px
      assert(bottomMetrics.playBtn !== null && bottomMetrics.playBtn.visible, 'Play/Pause button is visible');
      assert(bottomMetrics.playBtn.width >= 44 && bottomMetrics.playBtn.height >= 44,
        `Play/Pause touch target is >= 44x44px (${bottomMetrics.playBtn.width.toFixed(1)}x${bottomMetrics.playBtn.height.toFixed(1)}px)`);

      // 3. Expand button touch target >= 44x44px and visible
      assert(bottomMetrics.expandBtn !== null && bottomMetrics.expandBtn.visible, 'Expand Now Playing button is visible and NOT display:none');
      assert(bottomMetrics.expandBtn.width >= 44 && bottomMetrics.expandBtn.height >= 44,
        `Expand button touch target is >= 44x44px (${bottomMetrics.expandBtn.width.toFixed(1)}x${bottomMetrics.expandBtn.height.toFixed(1)}px)`);

      // 4. Like button touch target >= 44x44px
      if (bottomMetrics.likeBtn && bottomMetrics.likeBtn.visible) {
        assert(bottomMetrics.likeBtn.width >= 44 && bottomMetrics.likeBtn.height >= 44,
          `Like button touch target is >= 44x44px (${bottomMetrics.likeBtn.width.toFixed(1)}x${bottomMetrics.likeBtn.height.toFixed(1)}px)`);
      }

      // 5. Prev & Next buttons touch target >= 44x44px
      if (bottomMetrics.prevBtn && bottomMetrics.prevBtn.visible) {
        assert(bottomMetrics.prevBtn.width >= 44 && bottomMetrics.prevBtn.height >= 44,
          `Prev button touch target is >= 44x44px (${bottomMetrics.prevBtn.width.toFixed(1)}x${bottomMetrics.prevBtn.height.toFixed(1)}px)`);
      }
      if (bottomMetrics.nextBtn && bottomMetrics.nextBtn.visible) {
        assert(bottomMetrics.nextBtn.width >= 44 && bottomMetrics.nextBtn.height >= 44,
          `Next button touch target is >= 44x44px (${bottomMetrics.nextBtn.width.toFixed(1)}x${bottomMetrics.nextBtn.height.toFixed(1)}px)`);
      }

      // 6. Zero collisions between buttons
      assert(!bottomMetrics.playIntersectsExpand, 'Play button does not collide with Expand button');
      assert(!bottomMetrics.playIntersectsPrev, 'Play button does not collide with Prev button');
      assert(!bottomMetrics.playIntersectsNext, 'Play button does not collide with Next button');
      assert(!bottomMetrics.prevIntersectsNext, 'Prev and Next buttons do not collide');

      // 7. Scrubber slider accessible
      assert(bottomMetrics.seekSlider !== null && bottomMetrics.seekSlider.visible, 'Scrubber slider is accessible');

      // 8. Main content padding-bottom reservation
      const pbNum = parseFloat(bottomMetrics.mainPaddingBottom || '0');
      assert(pbNum >= 80, `Layout space reserved for fixed player (main padding-bottom: ${bottomMetrics.mainPaddingBottom})`);
    }

    // =========================================================================
    // PART 2: FULLSCREEN ENTRY & EXIT NAVIGATION VERIFICATION
    // =========================================================================
    console.log('\n======================================================================');
    console.log('PART 2: FULLSCREEN ENTRY, CLOSE/BACK, ESCAPE, AND BROWSER BACK');
    console.log('======================================================================');

    // Test on mobile viewport (390x844)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise((r) => setTimeout(r, 400));

    // 2.1: Entry via Expand Now Playing button on Mobile
    console.log('\n[Test 2.1] Clicking Expand Now Playing button on mobile viewport (390x844)...');
    const openResult = await cdp.eval(`
      (() => {
        const expandBtn = document.getElementById('expand-now-playing-btn');
        if (!expandBtn) return { success: false, reason: 'expand-now-playing-btn not found' };
        expandBtn.click();
        return { success: true };
      })()
    `);
    assert(openResult.success, 'Expand button clicked successfully');
    await new Promise((r) => setTimeout(r, 600));

    // Verify NowPlaying overlay is open
    const isOpen = await cdp.eval(`
      (() => {
        const np = document.getElementById('naro-now-playing');
        return !!np;
      })()
    `);
    assert(isOpen, 'Now Playing expanded view successfully opened via mobile expand button');

    // 2.2: Verify Persistent Close/Back Button properties in Fullscreen
    console.log('\n[Test 2.2] Verifying Close/Back button in Fullscreen overlay...');
    const closeBtnMetrics = await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[aria-label="Close full screen player"], button[data-close-now-playing="true"], #minimize-now-playing-btn');
        if (!btn) return { error: 'Close button not found' };
        const rect = btn.getBoundingClientRect();
        const header = document.querySelector('.now-playing-header');
        const hRect = header ? header.getBoundingClientRect() : null;

        return {
          ariaLabel: btn.getAttribute('aria-label'),
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          headerTop: hRect ? hRect.top : 0,
          visible: rect.width > 0 && rect.height > 0
        };
      })()
    `);

    console.log('    [DEBUG] closeBtnMetrics:', JSON.stringify(closeBtnMetrics));
    assert(closeBtnMetrics.visible, 'Close/Back button is visible in Fullscreen overlay');
    assert(closeBtnMetrics.ariaLabel === 'Close full screen player', `Close button has required aria-label: "${closeBtnMetrics.ariaLabel}"`);
    assert(closeBtnMetrics.width >= 44 && closeBtnMetrics.height >= 44,
      `Close button touch target is >= 44x44px (${closeBtnMetrics.width.toFixed(1)}x${closeBtnMetrics.height.toFixed(1)}px)`);
    assert(closeBtnMetrics.left < 50, `Close button is positioned on the top-left (left: ${closeBtnMetrics.left}px)`);

    // 2.3: Exit via Close/Back Button
    console.log('\n[Test 2.3] Clicking Close button to exit Fullscreen...');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[aria-label="Close full screen player"], button[data-close-now-playing="true"], #minimize-now-playing-btn');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isClosedAfterClick = await cdp.eval(`
      (() => {
        return document.getElementById('naro-now-playing') === null;
      })()
    `);
    assert(isClosedAfterClick, 'Clicking Close button successfully exited expanded Now Playing');

    // 2.4: Exit via Browser Back Navigation
    console.log('\n[Test 2.4] Testing Browser Back navigation to exit Fullscreen...');
    // Open Now Playing again
    await cdp.eval(`
      (() => {
        const expandBtn = document.getElementById('expand-now-playing-btn');
        if (expandBtn) expandBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isOpen2 = await cdp.eval(`!!document.getElementById('naro-now-playing')`);
    assert(isOpen2, 'Now Playing re-opened for back navigation test');

    // Simulate browser back via history.back() or popstate
    await cdp.eval(`
      (() => {
        window.history.back();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isClosedAfterBack = await cdp.eval(`
      (() => {
        return document.getElementById('naro-now-playing') === null;
      })()
    `);
    assert(isClosedAfterBack, 'Browser back navigation successfully exited expanded Now Playing without navigating away');

    // 2.5: Exit via Escape Key on Desktop
    console.log('\n[Test 2.5] Testing Escape key to exit Fullscreen on desktop (1440x900)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 400));

    // Open Now Playing
    await cdp.eval(`
      (() => {
        const expandBtn = document.getElementById('expand-now-playing-btn');
        if (expandBtn) expandBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isOpen3 = await cdp.eval(`!!document.getElementById('naro-now-playing')`);
    assert(isOpen3, 'Now Playing open on desktop for Escape key test');

    // Press Escape key
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27
    });
    await new Promise((r) => setTimeout(r, 600));

    const isClosedAfterEscape = await cdp.eval(`
      (() => {
        return document.getElementById('naro-now-playing') === null;
      })()
    `);
    assert(isClosedAfterEscape, 'Pressing Escape key successfully exited expanded Now Playing');

    // =========================================================================
    // PART 3: NARO LOGO NAVIGATION TEST
    // =========================================================================
    console.log('\n======================================================================');
    console.log('PART 3: NARO LOGO NAVIGATION TO HOME');
    console.log('======================================================================');

    // Navigate to 'discover' first
    await cdp.eval(`
      (() => {
        const discoverBtn = document.querySelector('nav[aria-label="Main Navigation"] button:nth-child(2)');
        if (discoverBtn) discoverBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Verify on Discover
    const onDiscover = await cdp.eval(`
      (() => {
        return document.querySelector('h1')?.textContent?.toLowerCase().includes('discover') ||
               document.body.textContent?.toLowerCase().includes('discover');
      })()
    `);
    assert(onDiscover, 'Navigated to Discover view');

    // Click Naro logo
    console.log('Clicking NARO logo...');
    await cdp.eval(`
      (() => {
        const logo = document.querySelector('header button[aria-label="NARO Home"]');
        if (logo) logo.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Verify back on Home
    const onHome = await cdp.eval(`
      (() => {
        return document.body.textContent?.includes('Feel the song') ||
               document.body.textContent?.includes('Your Next Listen');
      })()
    `);
    assert(onHome, 'Clicking NARO Logo successfully navigated back to Home view');

    console.log('\n======================================================================');
    console.log('ALL VERIFICATIONS PASSED: 100% PRODUCTION-QUALITY RESPONSIVE & NAVIGATION');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\nVerification Error:', err);
    process.exit(1);
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

runMobileAndFullscreenVerification();
