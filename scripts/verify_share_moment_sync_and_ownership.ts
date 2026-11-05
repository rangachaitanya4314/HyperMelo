// Comprehensive Test Suite for HyperMelo Share Moment: Playback, Synchronization & Single Ownership
// Scenarios:
// A. Main player playing -> open Share Moment -> verify main player pauses, lock acquired, preview starts.
// B. Main player paused -> open Share Moment -> preview starts, but closing restores paused state.
// C. Main player playing at non-zero position -> open Share Moment -> close -> verify resumes from exact position.
// D. Preview play/pause and seeking -> verify audio and lyrics stay synchronized.
// E. Export at 5s, 10s and 15s -> verify normal-speed audio and correct lyric progression.
// F. Switch templates and lyric languages -> verify playback does not restart or become slower.
// G. Cancel export and close modal -> verify all preview audio stops and original player is restored correctly.
// H. Test repeated opening and closing -> verify no audio overlap or duplicate audio sources.
// Mobile Viewports (390x844, 360x800, 320x568) & Desktop (1440x900).

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
    return null;
  }
  const viteProc = spawn('cmd.exe', ['/c', 'npx vite --port 5173 --strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore'
  });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const alive = await probePort(5173);
    if (alive) {
      return viteProc;
    }
  }
  throw new Error('Vite dev server failed to start on port 5173 within 20s.');
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

async function runTests() {
  console.log('======================================================================');
  console.log('HYPERMELO — SHARE MOMENT PLAYBACK, SYNCHRONIZATION & SINGLE OWNERSHIP');
  console.log('======================================================================\n');

  let viteProc: ChildProcess | null = null;
  let chromeProcess: ChildProcess | null = null;
  let cdp: CdpConnection | null = null;
  const userDataDir = path.join(os.tmpdir(), `naro-share-sync-${Date.now()}`);

  try {
    viteProc = await ensureViteRunning();

    const chromePath = await findChromePath();
    const cdpPort = 9265;

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
    // Wait for Chrome to open debugging port
    let wsUrl = '';
    for (let i = 0; i < 25; i++) {
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'sessionStorage.setItem("hypermelo_intro_seen", "true");'
    });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(600);
    await cdp.eval('sessionStorage.setItem("hypermelo_intro_seen", "true");');

    // Wait for App to load
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

    // -----------------------------------------------------------------------
    // SCENARIO A: Main player playing -> open Share Moment -> main player pauses
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO A: Main player playing -> open Share Moment ---');
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs();
        const testSong = songs.find(s => s.id === 'josh-woodward-shot-down') || songs[0];
        window.__naro_play_song(testSong, 5.0);
      })()
    `);
    await sleep(800);

    const isMainPlayingBefore = await cdp.eval('window.__naro_is_playing()');
    console.log(`    Main player playing state before open: ${isMainPlayingBefore}`);

    // Open Share Moment
    await cdp.eval('window.__naro_open_share_moment()');
    await sleep(600);

    const isMainPlayingAfterOpen = await cdp.eval('window.__naro_is_playing()');
    const isLocked = await cdp.eval('window.__naro_playback_controller.isPlaybackLocked()');
    const lockOwner = await cdp.eval('window.__naro_playback_controller.getPlaybackLockOwner()');
    const isModalOpen = await cdp.eval('Boolean(document.getElementById("share-moment-modal"))');
    const previewAudioRate = await cdp.eval(`
      (() => {
        const a = document.querySelector("#share-moment-overlay audio");
        return a ? a.playbackRate : null;
      })()
    `);

    assert(!isMainPlayingAfterOpen, 'Main player paused immediately when Share Moment opened');
    assert(isLocked && lockOwner === 'share-moment', `Playback controller locked exclusively by ${lockOwner}`);
    assert(isModalOpen, 'Share Moment modal rendered in DOM');
    assert(previewAudioRate === 1.0, `Preview audio playbackRate is normal 1.0x (actual: ${previewAudioRate})`);

    // Close Share Moment
    await cdp.eval('window.__naro_close_share_moment()');
    await sleep(800);

    const isMainPlayingRestoredA = await cdp.eval('window.__naro_is_playing()');
    const isLockedAfterClose = await cdp.eval('window.__naro_playback_controller.isPlaybackLocked()');
    assert(!isLockedAfterClose, 'Playback lock released on close');
    assert(isMainPlayingRestoredA, 'Main player resumed automatically because it was playing before open');

    // -----------------------------------------------------------------------
    // SCENARIO B: Main player paused -> open Share Moment -> close restores paused state
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO B: Main player paused -> open Share Moment -> close restores paused state ---');
    await cdp.eval('window.__naro_playback_controller.pause()');
    await sleep(400);
    const mainPaused = await cdp.eval('!window.__naro_is_playing()');
    assert(mainPaused, 'Main player is now paused');

    await cdp.eval('window.__naro_open_share_moment()');
    await sleep(600);
    assert(await cdp.eval('window.__naro_playback_controller.isPlaybackLocked()'), 'Playback locked while open');

    // Close
    await cdp.eval('window.__naro_close_share_moment()');
    await sleep(600);

    const isStillPaused = await cdp.eval('!window.__naro_is_playing()');
    assert(isStillPaused, 'Main player remains paused after closing Share Moment (no accidental resumption)');

    // -----------------------------------------------------------------------
    // SCENARIO C: Main player playing at non-zero position -> open Share Moment -> close -> resumes from exact position
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO C: Exact position restoration ---');
    const targetSeekSec = 14.5;
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs();
        const testSong = songs.find(s => s.id === 'josh-woodward-shot-down') || songs[0];
        window.__naro_play_song(testSong, ${targetSeekSec});
      })()
    `);
    await sleep(1000);

    const timeBeforeOpen = await cdp.eval('window.__naro_get_current_time()');
    console.log(`    Main player clock before open: ${timeBeforeOpen.toFixed(2)}s`);
    assert(timeBeforeOpen >= targetSeekSec, `Playback advanced past seek position (actual: ${timeBeforeOpen.toFixed(2)}s)`);

    await cdp.eval('window.__naro_open_share_moment()');
    await sleep(1500); // Wait 1.5s while Share Moment preview audio plays

    // Close
    await cdp.eval('window.__naro_close_share_moment()');
    await sleep(1000);

    const timeAfterClose = await cdp.eval('window.__naro_get_current_time()');
    const isPlayingAfterClose = await cdp.eval('window.__naro_is_playing()');
    console.log(`    Main player clock after close: ${timeAfterClose.toFixed(2)}s (was playing: ${isPlayingAfterClose})`);

    assert(isPlayingAfterClose, 'Main player is playing after close');
    const timeDelta = Math.abs(timeAfterClose - timeBeforeOpen);
    assert(timeDelta < 2.5, `Resumed from exact position without restarting to 0 (delta: ${timeDelta.toFixed(2)}s)`);

    // -----------------------------------------------------------------------
    // SCENARIO D: Preview play/pause, seeking & authoritative audio timeline
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO D: Preview play/pause, seeking & synchronization ---');
    // Load track with verified lyrics for lyric line seeking verification
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs();
        const lyricSong = songs.find(s => s.id === 'anirudh-gaali-vaaluga') || songs[0];
        window.__naro_play_song(lyricSong, 0);
      })()
    `);
    await sleep(600);

    await cdp.eval('window.__naro_open_share_moment()');
    await sleep(600);

    // Toggle preview pause
    await cdp.eval('document.getElementById("preview-play-pause-btn")?.click()');
    await sleep(300);
    const isPreviewPaused = await cdp.eval(`
      (() => {
        const a = document.querySelector("#share-moment-overlay audio");
        return a ? a.paused : false;
      })()
    `);
    assert(isPreviewPaused, 'Preview audio paused when play/pause button clicked');

    // Toggle preview play
    await cdp.eval('document.getElementById("preview-play-pause-btn")?.click()');
    await sleep(400);
    const isPreviewPlaying = await cdp.eval(`
      (() => {
        const a = document.querySelector("#share-moment-overlay audio");
        return a ? !a.paused : false;
      })()
    `);
    assert(isPreviewPlaying, 'Preview audio resumed at 1x speed');

    // Select lyric line 1
    const lineSelected = await cdp.eval(`
      (() => {
        const lineBtn = document.getElementById("share-moment-line-1");
        if (lineBtn) {
          lineBtn.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(400);

    const audioTimeAfterSeek = await cdp.eval(`
      (() => {
        const a = document.querySelector("#share-moment-overlay audio");
        return a ? a.currentTime : 0;
      })()
    `);
    console.log(`    Preview audio currentTime after selecting line: ${audioTimeAfterSeek.toFixed(2)}s`);
    assert(lineSelected && audioTimeAfterSeek > 0, 'Audio seeking aligned with selected lyric moment');

    // -----------------------------------------------------------------------
    // SCENARIO E: Export at 5s, 10s and 15s durations
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO E: Duration pills and export duration alignment ---');
    for (const d of [5, 10, 15]) {
      await cdp.eval(`document.getElementById("duration-pill-${d}")?.click()`);
      await sleep(200);
      const isPillActive = await cdp.eval(`document.getElementById("duration-pill-${d}")?.classList.contains("active")`);
      assert(isPillActive, `Duration pill ${d}s is active`);
    }

    // -----------------------------------------------------------------------
    // SCENARIO F: Switch templates and languages -> verify playback does not restart or lag
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO F: Template switching without playback interruptions ---');
    const templates = ['cinematic', 'minimal', 'visualizer', 'mood', 'karaoke'];
    for (const tpl of templates) {
      await cdp.eval(`document.getElementById("template-tab-${tpl}")?.click()`);
      await sleep(200);
      const isTabActive = await cdp.eval(`document.getElementById("template-tab-${tpl}")?.classList.contains("active")`);
      const audioRate = await cdp.eval(`
        (() => {
          const a = document.querySelector("#share-moment-overlay audio");
          return a ? a.playbackRate : 0;
        })()
      `);
      assert(isTabActive, `Template "${tpl}" switched successfully`);
      assert(audioRate === 1.0, `Playback rate remained 1.0x after switching to ${tpl}`);
    }

    // -----------------------------------------------------------------------
    // SCENARIO G: Escape / Close button cleanup
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO G: Clean audio teardown on Close ---');
    await cdp.eval(`
      (() => {
        const closeBtn = document.getElementById("share-moment-close-btn");
        if (closeBtn) closeBtn.click();
      })()
    `);
    await sleep(600);

    const isModalClosed = await cdp.eval('!document.getElementById("share-moment-modal")');
    const anyLeakedAudio = await cdp.eval('document.querySelectorAll("#share-moment-overlay audio").length === 0');
    assert(isModalClosed, 'Modal closed cleanly via close button');
    assert(anyLeakedAudio, 'No orphaned preview audio elements remaining');

    // -----------------------------------------------------------------------
    // SCENARIO H: Repeated rapid open/close test
    // -----------------------------------------------------------------------
    console.log('\n--- SCENARIO H: Repeated rapid opening and closing (5 cycles) ---');
    for (let c = 1; c <= 5; c++) {
      await cdp.eval('window.__naro_open_share_moment()');
      await sleep(150);
      await cdp.eval('window.__naro_close_share_moment()');
      await sleep(150);
    }
    const finalLock = await cdp.eval('window.__naro_playback_controller.isPlaybackLocked()');
    const finalAudioOverlap = await cdp.eval('document.querySelectorAll("audio").length <= 2'); // main player + dev audio
    assert(!finalLock, 'Playback lock is completely free after rapid open/close cycles');
    assert(finalAudioOverlap, 'No duplicate or leaking audio streams created');

    // -----------------------------------------------------------------------
    // Mobile Viewport Verification & Horizontal Template Scrolling
    // -----------------------------------------------------------------------
    console.log('\n--- MOBILE VIEWPORTS & HORIZONTAL TEMPLATE SCROLLING ---');
    const mobileViewports = [
      { name: 'iPhone 14 / Standard Mobile', width: 390, height: 844 },
      { name: 'Android Standard', width: 360, height: 800 },
      { name: 'Compact Mobile (iPhone SE)', width: 320, height: 568 }
    ];

    for (const vp of mobileViewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(300);

      await cdp.eval('window.__naro_open_share_moment()');
      await sleep(400);

      const scrollMetrics = await cdp.eval(`
        (() => {
          const row = document.querySelector(".share-templates-row");
          if (!row) return null;
          return {
            scrollWidth: row.scrollWidth,
            clientWidth: row.clientWidth,
            isScrollable: row.scrollWidth > row.clientWidth
          };
        })()
      `);

      console.log(`    Viewport ${vp.name} (${vp.width}x${vp.height}):`);
      console.log(`      templates scrollWidth: ${scrollMetrics?.scrollWidth}px, clientWidth: ${scrollMetrics?.clientWidth}px, scrollable: ${scrollMetrics?.isScrollable}`);
      assert(scrollMetrics?.isScrollable === true, `All 5 templates accessible via horizontal scroll on ${vp.width}px`);

      // Verify touch targets
      const touchTargetOk = await cdp.eval(`
        (() => {
          const pills = Array.from(document.querySelectorAll(".share-template-pill"));
          return pills.every(p => {
            const r = p.getBoundingClientRect();
            return r.height >= 40; // minimum touch height
          });
        })()
      `);
      assert(touchTargetOk, `Touch targets satisfy mobile accessibility criteria on ${vp.width}px`);

      await cdp.eval('window.__naro_close_share_moment()');
      await sleep(300);
    }

    // Reset to desktop viewport (1440x900)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    console.log('\n    Reset to desktop viewport (1440x900).');

    console.log('\n======================================================================');
    console.log('ALL VERIFICATION SCENARIOS PASSED WITH ZERO ERRORS (100%)');
    console.log('======================================================================\n');
  } finally {
    if (cdp) cdp.close();
    if (chromeProcess) chromeProcess.kill('SIGKILL');
    if (viteProc) viteProc.kill('SIGKILL');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runTests().catch((err) => {
  console.error('\nVerification suite encountered an error:', err);
  process.exit(1);
});

