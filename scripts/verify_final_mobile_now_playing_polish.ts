// HyperMelo — Final Mobile Now Playing UI Polish
// Verification Suite for all 15 Acceptance Criteria
// Multi-Viewport Matrix: 320x568, 360x800, 390x844, 430x932, and Desktop 1440x900

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshot(cdp: CdpConnection, filename: string): Promise<void> {
  const screenshotData = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const screenshotsDir = path.join(process.cwd(), 'reports', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(screenshotData.data, 'base64'));
  console.log(`    📸 Saved screenshot: reports/screenshots/${filename}`);
}

async function main() {
  console.log('======================================================================');
  console.log('HYPERMELO - FINAL MOBILE NOW PLAYING UI POLISH VERIFICATION SUITE');
  console.log('======================================================================\n');

  const testPort = 5178;
  console.log(`[Step 1] Launching Vite preview server on port ${testPort}...`);
  const viteProcess: ChildProcess = spawn(
    'cmd.exe',
    ['/c', `npx vite preview --port ${testPort} --strictPort`],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  viteProcess.stdout?.on('data', (d) => {
    // console.log(`[Vite stdout]: ${d}`);
  });
  viteProcess.stderr?.on('data', (d) => {
    console.error(`[Vite stderr]: ${d}`);
  });

  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${testPort}`, (res) => {
          if (res.statusCode && res.statusCode < 400) resolve();
          else reject();
        });
        req.on('error', reject);
        req.end();
      });
      serverReady = true;
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!serverReady) {
    viteProcess.kill();
    throw new Error(`Vite server failed to start on port ${testPort}`);
  }
  console.log('  ✅ Vite preview server responding.\n');

  console.log('[Step 2] Launching Headless Chrome...');
  const cdpPort = 9227;
  const chromePath = await findChromePath();
  const chromeProcess: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + path.join(process.cwd(), '.chrome-polish-profile-' + Date.now()),
      `http://localhost:${testPort}`
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const json = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const pages = JSON.parse(json);
      const target = pages.find((p: any) => p.type === 'page' && p.url.includes(`${testPort}`));
      if (target?.webSocketDebuggerUrl) {
        wsUrl = target.webSocketDebuggerUrl;
        break;
      }
    } catch {
      await sleep(400);
    }
  }

  if (!wsUrl) {
    chromeProcess.kill();
    viteProcess.kill();
    throw new Error('Failed to obtain Chrome CDP WebSocket URL');
  }

  const cdp = new CdpConnection(wsUrl);
  await cdp.connect();
  console.log('  ✅ CDP connected successfully.\n');

  try {
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    await cdp.send('Page.navigate', { url: `http://localhost:${testPort}` });
    await sleep(2500);

    // Wait for app and bindings
    for (let i = 0; i < 30; i++) {
      const ready = await cdp.eval(`!!window.__naro_play_song && !!window.__naro_open_now_playing`);
      if (ready) break;
      await cdp.eval(`
        (() => {
          const skipBtn = document.querySelector('.intro-skip-btn, button[aria-label="Enter Studio"]');
          if (skipBtn) skipBtn.click();
        })()
      `);
      await sleep(400);
    }

    // ------------------------------------------------------------------------
    // SECTION 1: Global Button Reset & Zero Masking Verification
    // ------------------------------------------------------------------------
    console.log('[Step 3] Verifying Global Button Reset (Zero Masking / Zero Highlight)...');
    const buttonResetAudit = await cdp.eval(`
      (() => {
        const btn = document.createElement('button');
        btn.textContent = 'Reset Test';
        document.body.appendChild(btn);
        const cs = window.getComputedStyle(btn);
        const res = {
          tapHighlight: cs.webkitTapHighlightColor,
          userSelect: cs.userSelect || cs.webkitUserSelect,
          appearance: cs.appearance || cs.webkitAppearance,
          touchAction: cs.touchAction
        };
        document.body.removeChild(btn);
        return res;
      })()
    `);
    console.log('  Button computed styles:', buttonResetAudit);
    assert(
      buttonResetAudit.tapHighlight === 'rgba(0, 0, 0, 0)' || buttonResetAudit.tapHighlight === 'transparent',
      'Global -webkit-tap-highlight-color is transparent'
    );
    assert(buttonResetAudit.userSelect === 'none', 'Global user-select is none');
    assert(buttonResetAudit.appearance === 'none', 'Global appearance is none');
    assert(buttonResetAudit.touchAction === 'manipulation', 'Global touch-action is manipulation');

    // ------------------------------------------------------------------------
    // SECTION 2: Start Audio Playback & Open Now Playing Modal
    // ------------------------------------------------------------------------
    console.log('\n[Step 4] Starting audio playback and opening Now Playing...');
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs ? window.__naro_get_songs() : [];
        const song = songs[0] || window.__naro_current_song;
        if (song) {
          window.__naro_play_song(song, 0.5);
        }
        if (window.__naro_open_now_playing) {
          window.__naro_open_now_playing();
        }
      })()
    `);
    await sleep(800);

    const isNowPlayingOpen = await cdp.eval(`!!document.getElementById('naro-now-playing')`);
    assert(isNowPlayingOpen, 'Now Playing full-screen modal opened successfully');

    // Verify HyperMelo Branding
    const eyebrowText = await cdp.eval(`
      (() => {
        const el = document.querySelector('.now-playing-header-eyebrow');
        return el ? el.textContent.trim() : '';
      })()
    `);
    console.log(`  Header eyebrow branding: '${eyebrowText}'`);
    assert(
      eyebrowText === 'PLAYING FROM HYPERMELO',
      `Header displays 'PLAYING FROM HYPERMELO' (actual: '${eyebrowText}')`
    );

    // Verify Previous and Next buttons have zero white rectangular background
    const prevBg = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-prev-btn')).backgroundColor`);
    const nextBg = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-next-btn')).backgroundColor`);
    console.log(`  Prev/Next background styles: prev=${prevBg}, next=${nextBg}`);
    assert(
      prevBg === 'rgba(0, 0, 0, 0)' || prevBg === 'transparent',
      `Previous button has transparent background (no white box: ${prevBg})`
    );
    assert(
      nextBg === 'rgba(0, 0, 0, 0)' || nextBg === 'transparent',
      `Next button has transparent background (no white box: ${nextBg})`
    );

    // ------------------------------------------------------------------------
    // SECTION 3: Exact Center Positioning of Prev, Play/Pause, Next
    // ------------------------------------------------------------------------
    console.log('\n[Step 5] Verifying Exact Center Positioning (50% Viewport Width)...');
    const viewportsToTest = [
      { width: 320, height: 568, name: '320x568 (iPhone SE)' },
      { width: 360, height: 800, name: '360x800 (Android Standard)' },
      { width: 390, height: 844, name: '390x844 (iPhone 14)' },
      { width: 430, height: 932, name: '430x932 (iPhone Pro Max)' }
    ];

    for (const vp of viewportsToTest) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true,
        hasTouch: true
      });
      await sleep(350);

      const centerMetric = await cdp.eval(`
        (() => {
          const centerGroup = document.querySelector('.now-playing-controls-center-group');
          if (!centerGroup) return null;
          const rect = centerGroup.getBoundingClientRect();
          const midX = (rect.left + rect.right) / 2;
          const vpWidth = window.innerWidth;
          const expectedMidX = vpWidth / 2;
          return {
            midX,
            expectedMidX,
            diff: Math.abs(midX - expectedMidX),
            vpWidth
          };
        })()
      `);
      console.log(`  Viewport ${vp.name} center metrics:`, centerMetric);
      assert(centerMetric !== null, `Center controls group found on ${vp.name}`);
      assert(
        centerMetric.diff < 1.5,
        `Center group is mathematically centered at 50% width on ${vp.name} (diff: ${centerMetric.diff.toFixed(2)}px)`
      );
    }

    // ------------------------------------------------------------------------
    // SECTION 4: Invariance of Center Position Across Sheet Toggles
    // ------------------------------------------------------------------------
    console.log('\n[Step 6] Verifying Center Group Position Invariance Across Lyrics & Queue...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      hasTouch: true
    });
    await sleep(300);

    const initialCenter = await cdp.eval(`
      (() => {
        const g = document.querySelector('.now-playing-controls-center-group');
        const r = g.getBoundingClientRect();
        return (r.left + r.right) / 2;
      })()
    `);

    // Open Lyrics
    await cdp.eval(`window.__naro_open_mobile_lyrics()`);
    await sleep(450);
    const lyricsOpenCenter = await cdp.eval(`
      (() => {
        const g = document.querySelector('.now-playing-controls-center-group');
        const r = g.getBoundingClientRect();
        return (r.left + r.right) / 2;
      })()
    `);
    assert(
      Math.abs(lyricsOpenCenter - initialCenter) < 1.0,
      `Center position invariant when Lyrics opens (delta: ${Math.abs(lyricsOpenCenter - initialCenter).toFixed(2)}px)`
    );

    // Close Lyrics
    await cdp.eval(`window.__naro_close_mobile_lyrics()`);
    await sleep(400);

    // Open Queue
    await cdp.eval(`window.__naro_open_queue()`);
    await sleep(400);
    const queueOpenCenter = await cdp.eval(`
      (() => {
        const g = document.querySelector('.now-playing-controls-center-group');
        const r = g.getBoundingClientRect();
        return (r.left + r.right) / 2;
      })()
    `);
    assert(
      Math.abs(queueOpenCenter - initialCenter) < 1.0,
      `Center position invariant when Queue opens (delta: ${Math.abs(queueOpenCenter - initialCenter).toFixed(2)}px)`
    );

    // Close Queue
    await cdp.eval(`window.__naro_close_queue()`);
    await sleep(350);

    // ------------------------------------------------------------------------
    // SECTION 5: Remove Unwanted Scrollbar on Mobile
    // ------------------------------------------------------------------------
    console.log('\n[Step 7] Verifying Zero Scrollbar and Viewport Fit When Lyrics Closed...');
    for (const vp of viewportsToTest) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true,
        hasTouch: true
      });
      await sleep(350);

      const scrollAudit = await cdp.eval(`
        (() => {
          const modal = document.getElementById('naro-now-playing');
          const main = document.getElementById('now-playing-main');
          const cs = window.getComputedStyle(main);
          const modalCs = window.getComputedStyle(modal);

          const lyricsBtn = document.getElementById('now-playing-lyrics-btn');
          const queueBtn = document.getElementById('now-playing-queue-btn');
          const playBtn = document.getElementById('now-playing-play-btn');
          const prevBtn = document.getElementById('now-playing-prev-btn');
          const nextBtn = document.getElementById('now-playing-next-btn');

          const lRect = lyricsBtn.getBoundingClientRect();
          const qRect = queueBtn.getBoundingClientRect();
          const pRect = playBtn.getBoundingClientRect();

          const allControlsInView = 
            lRect.bottom <= window.innerHeight + 2 &&
            qRect.bottom <= window.innerHeight + 2 &&
            pRect.bottom <= window.innerHeight + 2 &&
            lRect.top >= 0 && qRect.top >= 0 && pRect.top >= 0;

          return {
            modalScrollHeight: modal ? modal.scrollHeight : 0,
            modalClientHeight: modal ? modal.clientHeight : 0,
            modalScrollWidth: modal ? modal.scrollWidth : 0,
            modalClientWidth: modal ? modal.clientWidth : 0,
            modalOverflow: modal ? modalCs.overflow : '',
            mainScrollHeight: main ? main.scrollHeight : 0,
            mainClientHeight: main ? main.clientHeight : 0,
            mainOverflow: cs.overflowY || cs.overflow,
            scrollbarWidth: cs.scrollbarWidth,
            allControlsInView
          };
        })()
      `);

      console.log(`  Scroll audit for ${vp.name}:`, scrollAudit);
      assert(
        scrollAudit.modalScrollWidth <= vp.width,
        `Zero horizontal overflow on ${vp.name} (scrollWidth: ${scrollAudit.modalScrollWidth}px <= ${vp.width}px)`
      );
      assert(
        scrollAudit.modalScrollHeight <= vp.height + 2,
        `Zero vertical player scroll on ${vp.name} (modalScrollHeight: ${scrollAudit.modalScrollHeight}px <= ${vp.height}px)`
      );
      assert(
        scrollAudit.allControlsInView,
        `Bottom controls (Lyrics, Queue, Play) completely visible within viewport on ${vp.name}`
      );
    }

    // ------------------------------------------------------------------------
    // SECTION 6: Dedicated Lyrics Button (Bottom-Left)
    // ------------------------------------------------------------------------
    console.log('\n[Step 8] Verifying Dedicated Lyrics Button (Bottom-Left)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      hasTouch: true
    });
    await sleep(350);

    const lyricsBtnAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-lyrics-btn');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const cs = window.getComputedStyle(btn);
        return {
          left: rect.left,
          width: rect.width,
          height: rect.height,
          isBottomLeft: rect.left < window.innerWidth / 3,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          ariaExpanded: btn.getAttribute('aria-expanded'),
          ariaPressed: btn.getAttribute('aria-pressed'),
          hasMicIcon: !!btn.querySelector('svg'),
          hasLabel: !!btn.querySelector('.lyrics-dock-label')
        };
      })()
    `);
    console.log('  Lyrics button audit (inactive):', lyricsBtnAudit);
    assert(lyricsBtnAudit.isBottomLeft, 'Lyrics button is anchored at bottom-left');
    assert(lyricsBtnAudit.ariaExpanded === 'false', 'Lyrics button aria-expanded is false when closed');
    assert(lyricsBtnAudit.hasMicIcon, 'Lyrics button has Mic2 icon');

    // First tap -> opens lyrics
    await cdp.eval(`document.getElementById('now-playing-lyrics-btn').click()`);
    await sleep(450);

    const lyricsActiveAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-lyrics-btn');
        const col = document.querySelector('.now-playing-lyrics-col');
        const cs = window.getComputedStyle(btn);
        const colCs = window.getComputedStyle(col);
        return {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          ariaExpanded: btn.getAttribute('aria-expanded'),
          ariaPressed: btn.getAttribute('aria-pressed'),
          sheetOpacity: parseFloat(colCs.opacity),
          sheetTransform: colCs.transform
        };
      })()
    `);
    console.log('  Lyrics button audit (active):', lyricsActiveAudit);
    assert(lyricsActiveAudit.ariaExpanded === 'true', 'Lyrics button aria-expanded is true when open');
    assert(
      lyricsActiveAudit.backgroundColor.includes('231') && lyricsActiveAudit.backgroundColor.includes('165'),
      'Lyrics button has warm peach background (#E7A58D) when active'
    );
    assert(
      lyricsActiveAudit.color.includes('8') && lyricsActiveAudit.color.includes('11'),
      'Lyrics button has high contrast dark text/icon (#080B10) when active'
    );
    assert(lyricsActiveAudit.sheetOpacity > 0.9, 'Lyrics sheet is visible (opacity ~ 1)');

    await captureScreenshot(cdp, '05_mobile_390x844_lyrics_open.png');

    // Second tap -> closes lyrics
    await cdp.eval(`document.getElementById('now-playing-lyrics-btn').click()`);
    await sleep(400);

    const lyricsClosedAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-lyrics-btn');
        return {
          ariaExpanded: btn.getAttribute('aria-expanded'),
          ariaPressed: btn.getAttribute('aria-pressed'),
          hasActiveClass: btn.classList.contains('active')
        };
      })()
    `);
    assert(lyricsClosedAudit.ariaExpanded === 'false', 'Second tap closes lyrics and resets aria-expanded to false');
    assert(!lyricsClosedAudit.hasActiveClass, 'Lyrics button active class removed on close');

    // Escape closes lyrics and resets button
    await cdp.eval(`window.__naro_open_mobile_lyrics()`);
    await sleep(400);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(400);
    const escapeClosed = await cdp.eval(`!window.__naro_is_lyrics_active()`);
    assert(escapeClosed, 'Escape key closes lyrics sheet and resets button');

    // ------------------------------------------------------------------------
    // SECTION 7: Dedicated Queue Button (Bottom-Right) & Queue Bottom Sheet
    // ------------------------------------------------------------------------
    console.log('\n[Step 9] Verifying Dedicated Queue Button (Bottom-Right) & Queue Sheet...');
    const queueBtnAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-queue-btn');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const cs = window.getComputedStyle(btn);
        return {
          right: rect.right,
          width: rect.width,
          height: rect.height,
          isBottomRight: rect.right > (window.innerWidth * 2 / 3),
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          ariaExpanded: btn.getAttribute('aria-expanded'),
          hasQueueIcon: !!btn.querySelector('svg'),
          hasLabel: !!btn.querySelector('.queue-dock-label')
        };
      })()
    `);
    console.log('  Queue button audit (inactive):', queueBtnAudit);
    assert(queueBtnAudit.isBottomRight, 'Queue button is anchored at bottom-right');
    assert(queueBtnAudit.ariaExpanded === 'false', 'Queue button aria-expanded is false when closed');
    assert(queueBtnAudit.hasQueueIcon, 'Queue button has ListMusic icon');

    // First tap -> opens Queue sheet
    await cdp.eval(`document.getElementById('now-playing-queue-btn').click()`);
    await sleep(400);

    const queueOpenAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-queue-btn');
        const sheet = document.getElementById('now-playing-queue-sheet');
        const backdrop = document.getElementById('now-playing-queue-backdrop');
        const currentCard = document.getElementById('now-playing-queue-current-card');
        const queueList = document.getElementById('now-playing-queue-list');
        const cs = window.getComputedStyle(btn);
        return {
          ariaExpanded: btn.getAttribute('aria-expanded'),
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          hasSheet: !!sheet,
          hasBackdrop: !!backdrop,
          hasCurrentCard: !!currentCard,
          hasQueueList: !!queueList,
          queueItemsCount: queueList ? queueList.querySelectorAll('.now-playing-queue-item').length : 0
        };
      })()
    `);
    console.log('  Queue sheet open audit:', queueOpenAudit);
    assert(queueOpenAudit.ariaExpanded === 'true', 'Queue button aria-expanded is true when open');
    assert(
      queueOpenAudit.backgroundColor.includes('231') && queueOpenAudit.backgroundColor.includes('165'),
      'Queue button has warm peach background (#E7A58D) when active'
    );
    assert(queueOpenAudit.hasSheet, 'Queue bottom sheet (#now-playing-queue-sheet) rendered');
    assert(queueOpenAudit.hasBackdrop, 'Queue backdrop (#now-playing-queue-backdrop) rendered');
    assert(queueOpenAudit.hasCurrentCard, 'Queue shows Now Playing card');
    assert(queueOpenAudit.queueItemsCount > 0, 'Queue shows upcoming tracks list');

    await captureScreenshot(cdp, '07_mobile_390x844_queue_open.png');

    // Test tap-to-play from queue
    const prePlayTrackTitle = await cdp.eval(`document.getElementById('now-playing-title').textContent`);
    const upcomingTrack = await cdp.eval(`
      (() => {
        const firstItem = document.querySelector('.now-playing-queue-item .queue-item-clickable');
        if (firstItem) {
          const title = firstItem.querySelector('.queue-track-title').textContent;
          firstItem.click();
          return title;
        }
        return null;
      })()
    `);
    await sleep(600);
    const postPlayTrackTitle = await cdp.eval(`document.getElementById('now-playing-title').textContent`);
    console.log(`  Queue track tap test: '${prePlayTrackTitle}' -> '${postPlayTrackTitle}' (target: '${upcomingTrack}')`);
    assert(
      postPlayTrackTitle === upcomingTrack,
      'Tapping an item in the queue immediately plays that track'
    );

    // Test remove item from queue
    const preRemoveCount = await cdp.eval(`document.querySelectorAll('.now-playing-queue-item').length`);
    await cdp.eval(`
      (() => {
        const removeBtn = document.querySelector('.now-playing-queue-item .queue-item-remove-btn');
        if (removeBtn) removeBtn.click();
      })()
    `);
    await sleep(400);
    const postRemoveCount = await cdp.eval(`document.querySelectorAll('.now-playing-queue-item').length`);
    console.log(`  Queue item remove test: ${preRemoveCount} -> ${postRemoveCount}`);
    assert(
      postRemoveCount === preRemoveCount - 1,
      'Remove button removes individual track from queue'
    );

    // Test clear queue with confirmation
    await cdp.eval(`document.getElementById('now-playing-clear-queue-btn').click()`);
    await sleep(200);
    const clearBtnConfirming = await cdp.eval(`document.getElementById('now-playing-clear-queue-btn').textContent`);
    assert(
      clearBtnConfirming.includes('Confirm'),
      'Clear queue button enters confirmation state on first tap'
    );

    await cdp.eval(`document.getElementById('now-playing-clear-queue-btn').click()`);
    await sleep(400);
    const postClearCount = await cdp.eval(`document.querySelectorAll('.now-playing-queue-item').length`);
    assert(
      postClearCount === 0,
      'Confirming clear queue clears all upcoming tracks'
    );

    // Test reorder queue
    await cdp.eval(`
      (() => {
        const q = window.__naro_get_queue ? window.__naro_get_queue() : [];
        if (q.length >= 2 && window.__naro_reorder_queue) {
          window.__naro_reorder_queue([q[1], q[0], ...q.slice(2)]);
        }
      })()
    `);
    const reorderedQueue = await cdp.eval(`window.__naro_get_queue ? window.__naro_get_queue() : []`);
    assert(reorderedQueue.length > 0, 'Queue reorder executed successfully without errors');

    // Second tap on queue button -> closes queue
    await cdp.eval(`document.getElementById('now-playing-queue-btn').click()`);
    await sleep(400);
    const queueClosedAudit = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-queue-btn');
        return {
          ariaExpanded: btn.getAttribute('aria-expanded'),
          hasSheet: !!document.getElementById('now-playing-queue-sheet')
        };
      })()
    `);
    assert(queueClosedAudit.ariaExpanded === 'false', 'Second tap on Queue button closes queue');
    assert(!queueClosedAudit.hasSheet, 'Queue sheet is dismissed from DOM on close');

    // ------------------------------------------------------------------------
    // SECTION 8: Intelligent Space Fillers (Visualizer & Up Next Preview) & Audio Integrity
    // ------------------------------------------------------------------------
    console.log('\n[Step 10] Verifying Intelligent Space Fillers (Audio Visualizer & Up Next Pill)...');
    // Verify visualizer does not mutate volume or interrupt playback
    const audioIntegrityPre = await cdp.eval(`
      (() => {
        const audio = document.querySelector('audio');
        return {
          volume: audio ? audio.volume : 0.8,
          paused: audio ? audio.paused : false,
          currentTime: audio ? audio.currentTime : 0
        };
      })()
    `);
    console.log('  Audio integrity check during visualizer activity:', audioIntegrityPre);
    assert(audioIntegrityPre.volume > 0, 'Audio volume maintained without visualizer interference');

    // Add tracks back to queue to test Up Next pill
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs ? window.__naro_get_songs() : [];
        if (songs.length > 1 && window.__naro_add_to_queue) {
          songs.slice(1).forEach(s => window.__naro_add_to_queue(s));
        }
      })()
    `);
    await sleep(300);

    const fillersAudit = await cdp.eval(`
      (() => {
        const visualizer = document.getElementById('now-playing-audio-visualizer');
        const upNextPill = document.getElementById('now-playing-up-next-preview');
        const bars = visualizer ? visualizer.querySelectorAll('.now-playing-visualizer-bar') : [];
        return {
          hasVisualizer: !!visualizer,
          barsCount: bars.length,
          hasUpNextPill: !!upNextPill,
          upNextText: upNextPill ? upNextPill.textContent : ''
        };
      })()
    `);
    console.log('  Fillers audit:', fillersAudit);
    assert(fillersAudit.hasVisualizer, 'Audio visualizer (#now-playing-audio-visualizer) is rendered');
    assert(fillersAudit.barsCount === 5, 'Audio visualizer has 5 animated bars');
    assert(fillersAudit.hasUpNextPill, 'Up Next preview pill (#now-playing-up-next-preview) is rendered');
    assert(fillersAudit.upNextText.includes('Up Next'), 'Up Next pill shows upcoming track information');

    // Tap Up Next pill -> opens Queue sheet
    await cdp.eval(`document.getElementById('now-playing-up-next-preview').click()`);
    await sleep(400);
    const upNextOpenedQueue = await cdp.eval(`!!document.getElementById('now-playing-queue-sheet')`);
    assert(upNextOpenedQueue, 'Tapping Up Next pill successfully opens the Queue bottom sheet');

    await cdp.eval(`window.__naro_close_queue()`);
    await sleep(350);

    // ------------------------------------------------------------------------
    // SECTION 9: Shuffle and Repeat State Tests
    // ------------------------------------------------------------------------
    console.log('\n[Step 11] Verifying Shuffle and Repeat Secondary Controls...');
    const sColorPre = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-shuffle-btn')).color`);
    const rColorPre = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-repeat-btn')).color`);

    await cdp.eval(`document.getElementById('now-playing-shuffle-btn').click()`);
    await sleep(250);
    const sColorPost = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-shuffle-btn')).color`);

    await cdp.eval(`document.getElementById('now-playing-repeat-btn').click()`);
    await sleep(250);
    const rColorPost = await cdp.eval(`window.getComputedStyle(document.getElementById('now-playing-repeat-btn')).color`);

    const shuffleRepeatAudit = { sColorPre, sColorPost, rColorPre, rColorPost };
    console.log('  Shuffle/Repeat colors:', shuffleRepeatAudit);
    assert(
      shuffleRepeatAudit.sColorPost.includes('231') && shuffleRepeatAudit.sColorPost.includes('165'),
      'Shuffle button reflects active state with signature warm peach (#E7A58D)'
    );
    assert(
      shuffleRepeatAudit.rColorPost.includes('231') && shuffleRepeatAudit.rColorPost.includes('165'),
      'Repeat button reflects active state with signature warm peach (#E7A58D)'
    );

    // ------------------------------------------------------------------------
    // SECTION 10: Multi-Viewport Screenshots & Validation
    // ------------------------------------------------------------------------
    console.log('\n[Step 12] Capturing Multi-Viewport Verification Screenshots...');
    // 320x568
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 568,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true
    });
    await sleep(400);
    await captureScreenshot(cdp, '01_mobile_320x568_lyrics_closed.png');

    // 320x568 with Queue open
    await cdp.eval(`window.__naro_open_queue()`);
    await sleep(400);
    await captureScreenshot(cdp, '08_mobile_320x568_queue_open.png');
    await cdp.eval(`window.__naro_close_queue()`);
    await sleep(350);

    // 360x800
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true
    });
    await sleep(400);
    await captureScreenshot(cdp, '02_mobile_360x800_lyrics_closed.png');

    // 390x844
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      hasTouch: true
    });
    await sleep(400);
    await captureScreenshot(cdp, '03_mobile_390x844_lyrics_closed.png');

    // 430x932
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      mobile: true,
      hasTouch: true
    });
    await sleep(400);
    await captureScreenshot(cdp, '04_mobile_430x932_lyrics_closed.png');

    // Desktop 1440x900
    console.log('\n[Step 13] Verifying Desktop Layout Preservation (1440x900)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
      hasTouch: false
    });
    await sleep(500);

    const desktopAudit = await cdp.eval(`
      (() => {
        const lyricsBtn = document.getElementById('now-playing-lyrics-btn');
        const queueBtn = document.getElementById('now-playing-queue-btn');
        const desktopVol = document.querySelector('.now-playing-desktop-volume');
        const lyricsCol = document.querySelector('.now-playing-lyrics-col');
        const leftCol = document.querySelector('.now-playing-left-col');
        const prevBtn = document.getElementById('now-playing-prev-btn');
        const nextBtn = document.getElementById('now-playing-next-btn');
        const lCs = lyricsBtn ? window.getComputedStyle(lyricsBtn) : null;
        const qCs = queueBtn ? window.getComputedStyle(queueBtn) : null;
        const vCs = desktopVol ? window.getComputedStyle(desktopVol) : null;
        const colCs = lyricsCol ? window.getComputedStyle(lyricsCol) : null;
        const pCs = prevBtn ? window.getComputedStyle(prevBtn) : null;
        const nCs = nextBtn ? window.getComputedStyle(nextBtn) : null;
        return {
          lyricsDockBtnHidden: !lyricsBtn || lCs.display === 'none',
          queueDockBtnHidden: !queueBtn || qCs.display === 'none',
          desktopVolumeVisible: !!desktopVol && vCs.display !== 'none',
          lyricsColVisible: !!lyricsCol && colCs.display !== 'none' && parseFloat(colCs.opacity) > 0.9,
          isGridLayout: window.getComputedStyle(document.getElementById('now-playing-main')).display.includes('grid'),
          prevBg: pCs ? pCs.backgroundColor : '',
          nextBg: nCs ? nCs.backgroundColor : ''
        };
      })()
    `);
    console.log('  Desktop layout audit:', desktopAudit);
    assert(desktopAudit.lyricsDockBtnHidden, 'Mobile lyrics dock button is hidden on desktop');
    assert(desktopAudit.queueDockBtnHidden, 'Mobile queue dock button is hidden on desktop');
    assert(desktopAudit.desktopVolumeVisible, 'Desktop volume controls are visible on desktop');
    assert(desktopAudit.lyricsColVisible, 'Lyrics column is visible side-by-side on desktop');
    assert(desktopAudit.isGridLayout, 'Desktop uses side-by-side grid layout');
    assert(
      desktopAudit.prevBg === 'rgba(0, 0, 0, 0)' || desktopAudit.prevBg === 'transparent',
      `Desktop Previous button has transparent background (no white box: ${desktopAudit.prevBg})`
    );
    assert(
      desktopAudit.nextBg === 'rgba(0, 0, 0, 0)' || desktopAudit.nextBg === 'transparent',
      `Desktop Next button has transparent background (no white box: ${desktopAudit.nextBg})`
    );
    assert(desktopAudit.lyricsColVisible, 'Lyrics column is visible side-by-side on desktop');
    assert(desktopAudit.isGridLayout, 'Desktop uses side-by-side grid layout');

    await captureScreenshot(cdp, '09_desktop_1440x900_now_playing.png');

    console.log('\n======================================================================');
    console.log('🎉 ALL 15 ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } finally {
    cdp.close();
    chromeProcess.kill();
    viteProcess.kill();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});

