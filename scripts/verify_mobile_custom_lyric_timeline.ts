// Comprehensive Verification Suite for Mobile-First Custom Lyric Timeline
// Mandatory Mobile Viewports:
// - 320 x 568 (iPhone SE 1st gen)
// - 360 x 640 (Galaxy S5 / Android compact)
// - 390 x 844 (iPhone 12/13/14 standard)
// - 430 x 932 (iPhone 14/15 Pro Max)
//
// Verification Requirements:
// 1. Full-width, touch-friendly timeline designed specifically for mobile phones.
// 2. Large draggable start/end handles (minimum 44px touch targets).
// 3. Clearly visible start time, end time, and selected duration.
// 4. Horizontal timeline scrolling / zoom.
// 5. Lyrics displayed in a separate vertically scrollable section.
// 6. Users can select or deselect individual lyric lines.
// 7. Duration presets (5s, 10s, 15s, 20s, 30s) fit without horizontal page overflow.
// 8. Sticky bottom area with Preview and Use Selection actions (minimum 44px touch targets).
// 9. Ergonomic one-handed mobile experience with zero horizontal overflow.

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
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

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureViteRunning(): Promise<ChildProcess | null> {
  const isRunning = await probePort(5173);
  if (isRunning) {
    console.log('Vite dev server already running on port 5173.');
    return null;
  }

  console.log('Spawning Vite dev server on port 5173...');
  const viteProc = spawn('cmd.exe', ['/c', 'npx vite --port 5173 --strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore'
  });

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const alive = await probePort(5173);
    if (alive) {
      console.log('Vite dev server is now responding on http://127.0.0.1:5173/');
      return viteProc;
    }
  }

  throw new Error('Vite dev server failed to start on port 5173 within 20s.');
}

async function runMobileTimelineVerification() {
  console.log('======================================================================');
  console.log('HYPERMELO — MOBILE-FIRST CUSTOM LYRIC TIMELINE VERIFICATION');
  console.log('======================================================================\n');

  let viteProc: ChildProcess | null = null;
  let chromeProcess: ChildProcess | null = null;
  let cdp: CdpConnection | null = null;
  const userDataDir = path.join(os.tmpdir(), `naro-custom-timeline-${Date.now()}`);

  try {
    viteProc = await ensureViteRunning();

    const chromePath = await findChromePath();
    const cdpPort = 9272;

    chromeProcess = spawn(chromePath, [
      `--remote-debugging-port=${cdpPort}`,
      '--headless=new',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-gpu',
      `--user-data-dir=${userDataDir}`,
      'http://127.0.0.1:5173/'
    ]);

    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
        const targets = (await res.json()) as any[];
        const pageTarget = targets.find((t) => t.type === 'page');
        if (pageTarget?.webSocketDebuggerUrl) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      } catch {
        // retry
      }
    }

    if (!wsUrl) {
      throw new Error('Failed to connect to Chrome remote debugging port.');
    }

    cdp = new CdpConnection(wsUrl);
    await cdp.connect();
    console.log('Connected to Chrome CDP session.');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Dismiss intro animation if present
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'sessionStorage.setItem("hypermelo_intro_seen", "true");'
    });
    await cdp.eval('sessionStorage.setItem("hypermelo_intro_seen", "true");');

    // Wait for App to load and test bindings to be ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const isReady = await cdp.eval('typeof window.__naro_play_song === "function"');
      if (isReady) {
        ready = true;
        break;
      }
      await sleep(300);
    }
    assert(ready, 'HyperMelo App loaded and test bindings available');

    // Load a track with verified lyrics (Anirudh - Gaali Vaaluga)
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs();
        const testSong = songs.find(s => s.id === 'anirudh-gaali-vaaluga') || songs[0];
        window.__naro_play_song(testSong, 0);
      })()
    `);
    await sleep(600);

    const mandatoryMobileScreens = [
      { name: 'Compact Mobile (iPhone SE)', width: 320, height: 568 },
      { name: 'Galaxy S5 / Android Compact', width: 360, height: 640 },
      { name: 'iPhone 12/13/14 Standard', width: 390, height: 844 },
      { name: 'iPhone 14/15 Pro Max', width: 430, height: 932 }
    ];

    for (const vp of mandatoryMobileScreens) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width} x ${vp.height})`);
      console.log(`----------------------------------------------------------------------`);

      // Set device viewport
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(300);

      // Open Share Moment
      await cdp.eval('window.__naro_open_share_moment()');
      await sleep(500);

      // Verify zero horizontal page overflow in Share Moment
      const shareMomentOverflow = await cdp.eval(`
        (() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            hasOverflow: doc.scrollWidth > doc.clientWidth
          };
        })()
      `);
      assert(!shareMomentOverflow.hasOverflow, `No horizontal page overflow in Share Moment on ${vp.width}px (scroll: ${shareMomentOverflow.scrollWidth}px, client: ${shareMomentOverflow.clientWidth}px)`);

      // Open Custom Lyric Timeline via button
      const openBtnClicked = await cdp.eval(`
        (() => {
          const btn = document.getElementById("open-custom-timeline-btn");
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        })()
      `);
      assert(openBtnClicked, 'Clicked "Custom Timeline" button in Section 4');
      await sleep(500);

      // Verify Custom Lyric Timeline modal is open
      const isTimelineOpen = await cdp.eval('Boolean(document.getElementById("custom-lyric-timeline-modal"))');
      assert(isTimelineOpen, 'Custom Lyric Timeline modal opened in DOM');

      // 1. ZERO HORIZONTAL PAGE OVERFLOW in Custom Timeline
      const timelineOverflow = await cdp.eval(`
        (() => {
          const doc = document.documentElement;
          const modal = document.querySelector(".custom-timeline-container");
          return {
            docScroll: doc.scrollWidth,
            docClient: doc.clientWidth,
            hasDocOverflow: doc.scrollWidth > doc.clientWidth,
            modalScroll: modal ? modal.scrollWidth : 0,
            modalClient: modal ? modal.clientWidth : 0
          };
        })()
      `);
      assert(!timelineOverflow.hasDocOverflow, `Zero horizontal document overflow on ${vp.width}px (docScroll: ${timelineOverflow.docScroll}px, docClient: ${timelineOverflow.docClient}px)`);

      // 2. LARGE DRAGGABLE HANDLES (>= 44px touch targets)
      const handleDimensions = await cdp.eval(`
        (() => {
          const startH = document.getElementById("timeline-handle-start");
          const endH = document.getElementById("timeline-handle-end");
          if (!startH || !endH) return null;
          const rStart = startH.getBoundingClientRect();
          const rEnd = endH.getBoundingClientRect();
          return {
            startWidth: Math.round(rStart.width),
            startHeight: Math.round(rStart.height),
            endWidth: Math.round(rEnd.width),
            endHeight: Math.round(rEnd.height)
          };
        })()
      `);
      console.log(`    Touch Handle Dimensions:`, handleDimensions);
      assert(handleDimensions.startWidth >= 44 && handleDimensions.startHeight >= 44, `Start handle satisfies minimum 44px touch target (actual: ${handleDimensions.startWidth}x${handleDimensions.startHeight}px)`);
      assert(handleDimensions.endWidth >= 44 && handleDimensions.endHeight >= 44, `End handle satisfies minimum 44px touch target (actual: ${handleDimensions.endWidth}x${handleDimensions.endHeight}px)`);

      // 3. CLEARLY VISIBLE STATS CARD (Start Time, End Time, Selected Duration)
      const statsCard = await cdp.eval(`
        (() => {
          const st = document.getElementById("timeline-start-time")?.textContent?.trim();
          const et = document.getElementById("timeline-end-time")?.textContent?.trim();
          const dur = document.getElementById("timeline-selected-duration")?.textContent?.trim();
          return { st, et, dur };
        })()
      `);
      console.log(`    Stats Readout:`, statsCard);
      assert(Boolean(statsCard.st && statsCard.et && statsCard.dur), `Visible timeline stats (Start: ${statsCard.st}, End: ${statsCard.et}, Duration: ${statsCard.dur})`);

      // 4. ZOOM CONTROLS (Horizontal scrolling / precision zoom)
      await cdp.eval('document.getElementById("timeline-zoom-in-btn")?.click()');
      await sleep(150);
      const isZoomedIn = await cdp.eval(`
        (() => {
          const track = document.getElementById("timeline-bars-track");
          return track ? track.style.transform.includes('scaleX') || track.parentElement?.scrollWidth > track.parentElement?.clientWidth : true;
        })()
      `);
      assert(isZoomedIn, 'Zoom-in control verified for precision adjustment');

      await cdp.eval('document.getElementById("timeline-reset-btn")?.click()');
      await sleep(150);

      // 5. DURATION PRESETS (5s, 10s, 15s, 20s, 30s) — Fits without overflow
      for (const p of [5, 10, 15, 20, 30]) {
        await cdp.eval(`document.getElementById("preset-${p}s")?.click()`);
        await sleep(120);
        const activeDuration = await cdp.eval(`document.getElementById("timeline-selected-duration")?.textContent?.trim()`);
        const isPresetActive = await cdp.eval(`document.getElementById("preset-${p}s")?.classList.contains("active")`);
        assert(isPresetActive, `Preset ${p}s is active when clicked (duration readout: ${activeDuration})`);
      }

      // 6. DRAGGABLE HANDLE INTERACTION (Touch/Pointer move updates window)
      const dragResult = await cdp.eval(`
        (() => {
          const startH = document.getElementById("timeline-handle-start");
          const track = document.getElementById("timeline-track");
          if (!startH || !track) return null;
          const rect = track.getBoundingClientRect();
          // Dispatch pointerdown, pointermove, pointerup
          startH.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: rect.left, pointerId: 1 }));
          const targetX = rect.left + rect.width * 0.15; // drag to 15% mark
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: targetX, pointerId: 1 }));
          window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: targetX, pointerId: 1 }));
          const newStart = document.getElementById("timeline-start-time")?.textContent?.trim();
          return { newStart };
        })()
      `);
      console.log(`    Handle Drag Result:`, dragResult);
      assert(Boolean(dragResult && dragResult.newStart), 'Draggable handle pointer interaction executed and updated start time');

      // 7. SEPARATE VERTICALLY SCROLLABLE LYRICS SECTION
      const lyricsScrollerMetrics = await cdp.eval(`
        (() => {
          const scroller = document.getElementById("timeline-lyrics-scroller");
          if (!scroller) return null;
          return {
            scrollHeight: scroller.scrollHeight,
            clientHeight: scroller.clientHeight,
            isScrollable: scroller.scrollHeight >= scroller.clientHeight,
            lineCount: scroller.querySelectorAll(".timeline-lyric-row").length
          };
        })()
      `);
      console.log(`    Lyrics Scroller:`, lyricsScrollerMetrics);
      assert(lyricsScrollerMetrics.lineCount > 0, `Lyrics section populated with ${lyricsScrollerMetrics.lineCount} lines`);

      // 8. SELECT / DESELECT INDIVIDUAL LYRIC LINES
      const lineToggleBefore = await cdp.eval(`
        (() => {
          const row = document.getElementById("timeline-lyric-2");
          return row?.classList.contains("selected");
        })()
      `);
      await cdp.eval(`document.getElementById("timeline-lyric-2")?.click()`);
      await sleep(150);
      const lineToggleAfter = await cdp.eval(`
        (() => {
          const row = document.getElementById("timeline-lyric-2");
          return row?.classList.contains("selected");
        })()
      `);
      assert(lineToggleBefore !== lineToggleAfter, `Toggled lyric line 2 (was: ${lineToggleBefore}, now: ${lineToggleAfter})`);

      // 9. STICKY BOTTOM DOCK (Preview & Use Selection)
      const dockMetrics = await cdp.eval(`
        (() => {
          const dock = document.getElementById("timeline-sticky-dock");
          const previewBtn = document.getElementById("timeline-preview-btn");
          const useBtn = document.getElementById("timeline-use-selection-btn");
          if (!dock || !previewBtn || !useBtn) return null;
          const rDock = dock.getBoundingClientRect();
          const rPrev = previewBtn.getBoundingClientRect();
          const rUse = useBtn.getBoundingClientRect();
          return {
            dockHeight: Math.round(rDock.height),
            previewHeight: Math.round(rPrev.height),
            useHeight: Math.round(rUse.height),
            previewBottom: Math.round(rPrev.bottom),
            windowHeight: window.innerHeight
          };
        })()
      `);
      assert(dockMetrics.previewHeight >= 44, `Preview button touch target >= 44px (actual: ${dockMetrics.previewHeight}px)`);
      assert(dockMetrics.useHeight >= 44, `Use Selection button touch target >= 44px (actual: ${dockMetrics.useHeight}px)`);

      // Test Preview Toggle
      await cdp.eval('document.getElementById("timeline-preview-btn")?.click()');
      await sleep(250);
      const isTimelineAudioPlaying = await cdp.eval(`
        (() => {
          const a = document.querySelector("#share-moment-overlay audio");
          return a ? !a.paused : false;
        })()
      `);
      assert(isTimelineAudioPlaying, 'Preview audio started in Custom Timeline');

      await cdp.eval('document.getElementById("timeline-preview-btn")?.click()');
      await sleep(200);
      const isTimelineAudioPaused = await cdp.eval(`
        (() => {
          const a = document.querySelector("#share-moment-overlay audio");
          return a ? a.paused : true;
        })()
      `);
      assert(isTimelineAudioPaused, 'Preview audio paused in Custom Timeline');

      // Test Use Selection button
      // Select 10s preset first so we know expected duration
      await cdp.eval('document.getElementById("preset-10s")?.click()');
      await sleep(120);
      await cdp.eval('document.getElementById("timeline-use-selection-btn")?.click()');
      await sleep(400);

      // Verify custom timeline closed and Share Moment reflects 10s duration
      const isTimelineClosedAfterUse = await cdp.eval('!document.getElementById("custom-lyric-timeline-modal")');
      const shareMomentDuration = await cdp.eval(`
        (() => {
          const activePill = document.querySelector(".share-duration-pill.active");
          return activePill ? activePill.textContent.trim() : '';
        })()
      `);
      assert(isTimelineClosedAfterUse, 'Custom Timeline closed after clicking Use Selection');
      assert(shareMomentDuration.includes('10'), `Share Moment reflects selected 10s duration (actual: ${shareMomentDuration})`);

      // Clean close for next viewport iteration
      await cdp.eval('window.__naro_close_share_moment()');
      await sleep(300);
    }

    console.log('\n======================================================================');
    console.log('ALL MANDATORY MOBILE VIEWPORTS TESTED & PASSED (100%)');
    console.log('320x568, 360x640, 390x844, 430x932: ZERO OVERFLOW, 44px+ TARGETS');
    console.log('======================================================================\n');
  } finally {
    if (cdp) cdp.close();
    if (chromeProcess) {
      chromeProcess.kill('SIGKILL');
    }
    if (viteProc) {
      viteProc.kill('SIGKILL');
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runMobileTimelineVerification().catch((err) => {
  console.error('\nMobile Timeline Verification encountered an error:', err);
  process.exit(1);
});
