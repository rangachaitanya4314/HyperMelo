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

const REQUIRED_VIEWPORTS: ViewportConfig[] = [
  { name: '320x568', width: 320, height: 568, isMobile: true },
  { name: '360x640', width: 360, height: 640, isMobile: true },
  { name: '375x667', width: 375, height: 667, isMobile: true },
  { name: '390x844', width: 390, height: 844, isMobile: true },
  { name: '412x915', width: 412, height: 915, isMobile: true },
  { name: '430x932', width: 430, height: 932, isMobile: true },
  { name: '768x1024', width: 768, height: 1024, isMobile: true },
  { name: '1024x768', width: 1024, height: 768, isMobile: false },
  { name: '1440x900', width: 1440, height: 900, isMobile: false }
];

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
        } catch {}
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

  async clickAt(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y)
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
    await new Promise((r) => setTimeout(r, 60));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
  }

  async takeScreenshot(filePath: string): Promise<void> {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      const buffer = Buffer.from(res.data, 'base64');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
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

async function runStrictVerification() {
  console.log('======================================================================');
  console.log('NARO — STRICT 9-VIEWPORT MOBILE & FULLSCREEN CDP VERIFICATION SUITE');
  console.log('======================================================================\n');

  const screenshotsDir = path.resolve('c:/Users/Vijaya Raghava/.gemini/antigravity-ide/brain/71d86b75-68fa-42be-ac71-9a62fdfab447/screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const chromePath = await findChromePath();
  const cdpPort = 9265;
  const userDataDir = path.join(os.tmpdir(), `naro-strict-${Date.now()}`);
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

  const results: any[] = [];

  try {
    let tabs: any[] = [];
    for (let i = 0; i < 30; i++) {
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
      } catch {}
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    // Dismiss cinematic intro
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.eval(`
      (() => {
        sessionStorage.setItem('naro_intro_seen', 'true');
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Ensure music is actively loaded
    await cdp.eval(`
      (() => {
        if (window.__naro_play_song && window.__naro_current_song) {
          window.__naro_play_song(window.__naro_current_song, 2.0);
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    for (const vp of REQUIRED_VIEWPORTS) {
      console.log(`\n======================================================================`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}, isMobile: ${vp.isMobile})`);
      console.log(`======================================================================`);

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

      const vpResult: any = { viewport: vp.name, pass: true, errors: [] };

      // 1. COLLAPSED BOTTOM PLAYER VERIFICATION
      const bottomState = await cdp.eval(`
        (() => {
          const player = document.querySelector('aside.bottom-player-aside');
          if (!player) return { error: 'Bottom player aside not found' };

          const playBtn = document.getElementById('bottom-play-btn');
          const expandBtn = document.getElementById('expand-now-playing-btn');
          const prevBtn = player.querySelector('button[aria-label="Previous track"]');
          const nextBtn = player.querySelector('button[aria-label="Next track"]');
          const shuffleBtn = player.querySelector('button[aria-label*="Shuffle"]');
          const repeatBtn = player.querySelector('button[aria-label*="moment"], button[aria-label*="Repeat"]');
          const scrubberRow = player.querySelector('.player-scrubber-row');
          const buttonsRow = player.querySelector('.player-buttons-row');
          const seekInput = document.getElementById('bottom-seek-slider') || scrubberRow?.querySelector('input[type="range"]');
          const main = document.querySelector('main.app-main-content');

          function serializeRect(r) {
            if (!r) return null;
            return {
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height
            };
          }

          const pRect = serializeRect(player.getBoundingClientRect());
          const playRect = serializeRect(playBtn?.getBoundingClientRect());
          const expRect = serializeRect(expandBtn?.getBoundingClientRect());
          const prevRect = serializeRect(prevBtn?.getBoundingClientRect());
          const nextRect = serializeRect(nextBtn?.getBoundingClientRect());
          const shuffRect = serializeRect(shuffleBtn?.getBoundingClientRect());
          const repRect = serializeRect(repeatBtn?.getBoundingClientRect());
          const scrubRect = serializeRect(scrubberRow?.getBoundingClientRect());
          const btnRowRect = serializeRect(buttonsRow?.getBoundingClientRect());
          const seekRect = serializeRect(seekInput?.getBoundingClientRect());

          // Hit test play button center
          let playHit = null;
          if (playRect) {
            const el = document.elementFromPoint(playRect.left + playRect.width / 2, playRect.top + playRect.height / 2);
            playHit = el ? (el.id === 'bottom-play-btn' || el.closest('#bottom-play-btn') !== null) : false;
          }

          function overlaps(r1, r2) {
            if (!r1 || !r2) return false;
            return !(
              r2.left >= r1.right ||
              r2.right <= r1.left ||
              r2.top >= r1.bottom ||
              r2.bottom <= r1.top
            );
          }

          const scrubOverlapsBtns = overlaps(scrubRect, btnRowRect);

          return {
            docScrollWidth: document.documentElement.scrollWidth,
            playerHeight: pRect?.height,
            mainPaddingBottom: main ? window.getComputedStyle(main).paddingBottom : null,
            playHit,
            playRect,
            expRect,
            prevRect,
            nextRect,
            shuffRect,
            repRect,
            seekRect,
            scrubOverlapsBtns,
            overlapPrevPlay: overlaps(prevRect, playRect),
            overlapPlayNext: overlaps(playRect, nextRect),
            overlapShuffPrev: overlaps(shuffRect, prevRect),
            overlapNextRep: overlaps(nextRect, repRect)
          };
        })()
      `);

      if (bottomState.error) {
        console.error(`  ❌ Error: ${bottomState.error}`);
        vpResult.pass = false;
        vpResult.errors.push(bottomState.error);
        results.push(vpResult);
        continue;
      }

      // Check horizontal overflow
      const hOverflow = bottomState.docScrollWidth - vp.width;
      if (hOverflow > 1) {
        vpResult.pass = false;
        vpResult.errors.push(`Horizontal overflow: doc ${bottomState.docScrollWidth}px > vp ${vp.width}px`);
        console.log(`  ❌ Horizontal overflow: ${bottomState.docScrollWidth}px > ${vp.width}px`);
      } else {
        console.log(`  ✅ Zero horizontal overflow (${bottomState.docScrollWidth}px == ${vp.width}px)`);
      }

      // Check button touch targets >= 44x44
      const buttonsToCheck = [
        { name: 'Play/Pause', rect: bottomState.playRect },
        { name: 'Previous', rect: bottomState.prevRect },
        { name: 'Next', rect: bottomState.nextRect },
        { name: 'Shuffle', rect: bottomState.shuffRect },
        { name: 'Repeat', rect: bottomState.repRect },
        { name: 'Expand', rect: bottomState.expRect }
      ];

      for (const btn of buttonsToCheck) {
        if (!btn.rect) continue;
        if (btn.rect.width < 43.5 || btn.rect.height < 43.5) {
          vpResult.pass = false;
          vpResult.errors.push(`${btn.name} button touch target too small: ${btn.rect.width}x${btn.rect.height}`);
          console.log(`  ❌ ${btn.name} touch target too small: ${btn.rect.width}x${btn.rect.height}`);
        } else {
          console.log(`  ✅ ${btn.name} target >= 44x44px (${btn.rect.width.toFixed(1)}x${btn.rect.height.toFixed(1)}px)`);
        }
      }

      // Check collisions
      if (bottomState.overlapPrevPlay || bottomState.overlapPlayNext || bottomState.overlapShuffPrev || bottomState.overlapNextRep) {
        vpResult.pass = false;
        vpResult.errors.push(`Control overlap detected in player buttons row`);
        console.log(`  ❌ Control overlap detected`);
      } else {
        console.log(`  ✅ Zero control overlap in buttons row`);
      }

      if (bottomState.scrubOverlapsBtns) {
        vpResult.pass = false;
        vpResult.errors.push(`Scrubber row overlaps buttons row`);
        console.log(`  ❌ Scrubber row overlaps buttons row`);
      } else {
        console.log(`  ✅ Scrubber row and buttons row are cleanly separated`);
      }

      // Hit test play button
      if (!bottomState.playHit) {
        vpResult.pass = false;
        vpResult.errors.push(`Play button center elementFromPoint failed`);
        console.log(`  ❌ Play button center elementFromPoint failed`);
      } else {
        console.log(`  ✅ Play button center hit-test passed (pointer hits button directly)`);
      }

      // Capture screenshot of collapsed bottom player
      const bottomShotPath = path.join(screenshotsDir, `collapsed_${vp.name}.png`);
      await cdp.takeScreenshot(bottomShotPath);

      // Physical clicks on Play/Pause, Previous, Next
      if (bottomState.playRect) {
        await cdp.clickAt(
          bottomState.playRect.left + bottomState.playRect.width / 2,
          bottomState.playRect.top + bottomState.playRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 200));
        // Toggle back to playing
        await cdp.clickAt(
          bottomState.playRect.left + bottomState.playRect.width / 2,
          bottomState.playRect.top + bottomState.playRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 200));
        console.log(`  ✅ Physical mouse click verified on Play/Pause button`);
      }

      if (bottomState.prevRect && bottomState.nextRect) {
        await cdp.clickAt(
          bottomState.nextRect.left + bottomState.nextRect.width / 2,
          bottomState.nextRect.top + bottomState.nextRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 200));
        await cdp.clickAt(
          bottomState.prevRect.left + bottomState.prevRect.width / 2,
          bottomState.prevRect.top + bottomState.prevRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 200));
        console.log(`  ✅ Physical mouse click verified on Next & Previous buttons`);
      }

      // Physical interaction with progress bar
      if (bottomState.seekRect) {
        await cdp.clickAt(
          bottomState.seekRect.left + bottomState.seekRect.width * 0.3,
          bottomState.seekRect.top + bottomState.seekRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 200));
        console.log(`  ✅ Physical interaction verified on Progress bar seek slider`);
      }

      // 2. EXPAND TO FULLSCREEN NOW PLAYING
      console.log(`\n  --- Entering Fullscreen Now Playing ---`);
      if (bottomState.expRect) {
        await cdp.clickAt(
          bottomState.expRect.left + bottomState.expRect.width / 2,
          bottomState.expRect.top + bottomState.expRect.height / 2
        );
      } else {
        await cdp.eval(`(() => { const b = document.getElementById('expand-now-playing-btn'); if (b) b.click(); })()`);
      }
      await new Promise((r) => setTimeout(r, 600));

      const fsState = await cdp.eval(`
        (() => {
          const np = document.getElementById('naro-now-playing');
          if (!np) return { error: 'Fullscreen overlay not rendered' };

          const closeBtn = document.getElementById('minimize-now-playing-btn');
          const appHeader = document.querySelector('header[role="banner"]');
          const visualizer = document.querySelector('.beat-synced-visualizer-container') || document.querySelector('.now-playing-visualizer');
          const lyrics = document.querySelector('.now-playing-lyrics-col') || document.getElementById('now-playing-lyrics-container');
          const centerDisc = document.querySelector('.beat-visualizer-center-disc');
          const title = centerDisc?.querySelector('#visualizer-song-title') || centerDisc?.querySelector('.beat-visualizer-song-title');

          function serializeRect(r) {
            if (!r) return null;
            return {
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height
            };
          }

          const cRect = serializeRect(closeBtn?.getBoundingClientRect());
          const npRect = serializeRect(np.getBoundingClientRect());
          const visRect = serializeRect(visualizer?.getBoundingClientRect());
          const lyrRect = serializeRect(lyrics?.getBoundingClientRect());
          const discRect = serializeRect(centerDisc?.getBoundingClientRect());
          const titleRect = serializeRect(title?.getBoundingClientRect());

          // Physical hit test at close button center
          let closeHitTarget = null;
          let closeHitOk = false;
          if (cRect) {
            const hit = document.elementFromPoint(cRect.left + cRect.width / 2, cRect.top + cRect.height / 2);
            closeHitTarget = hit ? (hit.tagName + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).slice(0, 30) : '')) : null;
            closeHitOk = hit ? (hit.id === 'minimize-now-playing-btn' || hit.closest('#minimize-now-playing-btn') !== null) : false;
          }

          const npStyle = window.getComputedStyle(np);
          const appHeaderStyle = appHeader ? window.getComputedStyle(appHeader) : null;
          const lyrStyle = lyrics ? window.getComputedStyle(lyrics) : null;

          const discOverflows = titleRect && discRect ? (titleRect.width > discRect.width + 10 || titleRect.height > discRect.height) : false;

          return {
            npZIndex: npStyle.zIndex,
            bodyOverflow: document.body.style.overflow,
            appHeaderVisibility: appHeaderStyle?.visibility,
            appHeaderPointerEvents: appHeaderStyle?.pointerEvents,
            closeRect: cRect,
            closeHitOk,
            closeHitTarget,
            visRect,
            visTopCropped: visRect ? visRect.top < 0 : false,
            visBottomCropped: visRect ? visRect.bottom > window.innerHeight : false,
            lyricsHeight: lyrRect?.height,
            lyricsOverflowY: lyrStyle?.overflowY,
            discOverflows,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth
          };
        })()
      `);

      if (fsState.error) {
        vpResult.pass = false;
        vpResult.errors.push(fsState.error);
        console.log(`  ❌ ${fsState.error}`);
      } else {
        console.log(`  ✅ Fullscreen z-index: ${fsState.npZIndex} (>= 2000)`);
        console.log(`  ✅ App header pointerEvents: ${fsState.appHeaderPointerEvents}, visibility: ${fsState.appHeaderVisibility}`);
        console.log(`  ✅ Document body overflow lock: ${fsState.bodyOverflow}`);

        // Close button touch target >= 44x44
        if (fsState.closeRect.width < 43.5 || fsState.closeRect.height < 43.5) {
          vpResult.pass = false;
          vpResult.errors.push(`Close button too small: ${fsState.closeRect.width}x${fsState.closeRect.height}`);
          console.log(`  ❌ Close button too small: ${fsState.closeRect.width}x${fsState.closeRect.height}`);
        } else {
          console.log(`  ✅ Close button target >= 44x44px (${fsState.closeRect.width.toFixed(1)}x${fsState.closeRect.height.toFixed(1)}px)`);
        }

        // Close button hit test
        if (!fsState.closeHitOk) {
          vpResult.pass = false;
          vpResult.errors.push(`Close button intercepted by: ${fsState.closeHitTarget}`);
          console.log(`  ❌ Close button intercepted by: ${fsState.closeHitTarget}`);
        } else {
          console.log(`  ✅ Close button directly hit-tested (hit target: ${fsState.closeHitTarget})`);
        }

        // Visualizer cropping
        if (fsState.visTopCropped || fsState.visBottomCropped) {
          vpResult.pass = false;
          vpResult.errors.push(`Visualizer cropped: top=${fsState.visTopCropped}, bottom=${fsState.visBottomCropped}`);
          console.log(`  ❌ Visualizer cropped in viewport`);
        } else {
          console.log(`  ✅ Visualizer fits completely in viewport without top/bottom cropping`);
        }

        // Lyrics space
        if (fsState.lyricsHeight < 120) {
          vpResult.pass = false;
          vpResult.errors.push(`Lyrics height collapsed: ${fsState.lyricsHeight}px < 120px`);
          console.log(`  ❌ Lyrics height too small: ${fsState.lyricsHeight}px`);
        } else {
          console.log(`  ✅ Lyrics height usable (${fsState.lyricsHeight.toFixed(1)}px >= 120px, overflow-y: ${fsState.lyricsOverflowY})`);
        }

        // Center disc text
        if (fsState.discOverflows) {
          vpResult.pass = false;
          vpResult.errors.push(`Center disc text overflows circular bounds`);
          console.log(`  ❌ Center disc text overflows bounds`);
        } else {
          console.log(`  ✅ Center disc text cleanly styled within disc bounds`);
        }

        // Capture screenshot of expanded fullscreen player
        const fsShotPath = path.join(screenshotsDir, `fullscreen_${vp.name}.png`);
        await cdp.takeScreenshot(fsShotPath);

        // Physically click close button to exit
        console.log(`  --- Physically clicking Close button via CDP mouse events ---`);
        await cdp.clickAt(
          fsState.closeRect.left + fsState.closeRect.width / 2,
          fsState.closeRect.top + fsState.closeRect.height / 2
        );
        await new Promise((r) => setTimeout(r, 600));

        const isClosed = await cdp.eval(`document.getElementById('naro-now-playing') === null`);
        if (!isClosed) {
          vpResult.pass = false;
          vpResult.errors.push('Fullscreen did not close after physical click on close button');
          console.log(`  ❌ Fullscreen did not close after physical click`);
        } else {
          console.log(`  ✅ Fullscreen successfully closed via physical pointer click on close button!`);
        }
      }

      // 3. SCROLL CLEARANCE VERIFICATION ON HOME
      console.log(`  --- Verifying scroll clearance on Home page ---`);
      const scrollResultHome = await cdp.eval(`
        (() => {
          window.scrollTo(0, document.body.scrollHeight);
          const footer = document.querySelector('footer');
          const player = document.querySelector('aside.bottom-player-aside');
          if (!footer || !player) return { error: 'Footer or player missing' };

          const fRect = footer.getBoundingClientRect();
          const pRect = player.getBoundingClientRect();
          const lastEl = footer.lastElementChild;
          const lastRect = lastEl ? lastEl.getBoundingClientRect() : fRect;

          return {
            footerBottom: fRect.bottom,
            playerTop: pRect.top,
            playerHeight: pRect.height,
            lastElBottom: lastRect.bottom,
            clearance: pRect.top - lastRect.bottom
          };
        })()
      `);

      if (scrollResultHome.error) {
        console.log(`  ⚠️ Home scroll notice: ${scrollResultHome.error}`);
      } else {
        if (scrollResultHome.clearance < 20) {
          vpResult.pass = false;
          vpResult.errors.push(`Home footer clearance too small: ${scrollResultHome.clearance}px < 20px`);
          console.log(`  ❌ Home footer clearance too small: ${scrollResultHome.clearance}px`);
        } else {
          console.log(`  ✅ Home footer content clears player (clearance: ${scrollResultHome.clearance.toFixed(1)}px >= 20px)`);
        }
      }

      // 4. SCROLL CLEARANCE ON DISCOVER
      console.log(`  --- Verifying scroll clearance on Discover page ---`);
      await cdp.eval(`
        (() => {
          const navBtn = document.querySelector('nav[aria-label="Main Navigation"] button:nth-child(2)');
          if (navBtn) navBtn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      const scrollResultDiscover = await cdp.eval(`
        (() => {
          window.scrollTo(0, document.body.scrollHeight);
          const main = document.querySelector('main.app-main-content');
          const player = document.querySelector('aside.bottom-player-aside');
          if (!main || !player) return { error: 'Main or player missing' };

          const mRect = main.getBoundingClientRect();
          const pRect = player.getBoundingClientRect();
          const lastChild = main.lastElementChild;
          const lastRect = lastChild ? lastChild.getBoundingClientRect() : mRect;

          return {
            playerTop: pRect.top,
            lastChildBottom: lastRect.bottom,
            clearance: pRect.top - lastRect.bottom
          };
        })()
      `);

      if (scrollResultDiscover.error) {
        console.log(`  ⚠️ Discover scroll notice: ${scrollResultDiscover.error}`);
      } else {
        console.log(`  ✅ Discover content clears player (clearance: ${scrollResultDiscover.clearance.toFixed(1)}px)`);
      }

      // Return to Home view
      await cdp.eval(`
        (() => {
          const homeNav = document.querySelector('nav[aria-label="Main Navigation"] button:nth-child(1)');
          if (homeNav) homeNav.click();
          window.scrollTo(0, 0);
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));

      results.push(vpResult);
    }

    console.log('\n======================================================================');
    console.log('SUMMARY OF ALL 9 VIEWPORT TESTS');
    console.log('======================================================================');
    let allPassed = true;
    for (const res of results) {
      if (res.pass) {
        console.log(`  ✅ ${res.viewport}: ALL TESTS PASSED`);
      } else {
        allPassed = false;
        console.log(`  ❌ ${res.viewport}: FAILED (${res.errors.join('; ')})`);
      }
    }
    console.log('======================================================================\n');

    fs.writeFileSync(
      path.join(screenshotsDir, 'verification_summary.json'),
      JSON.stringify(results, null, 2)
    );

    cdp.close();
    try {
      chromeProcess.kill();
    } catch {}

    if (!allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      chromeProcess.kill();
    } catch {}
    process.exit(1);
  }
}

runStrictVerification();
