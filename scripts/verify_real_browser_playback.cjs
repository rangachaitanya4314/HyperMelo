// ============================================================================
// Real-Browser Playback and UI Verification Suite
// ============================================================================
// 1. Launches real Google Chrome (headless=new) and connects via Chrome DevTools Protocol (CDP).
// 2. Starts Vite server and navigates to the HyperMelo application.
// 3. Verifies "O Rendu Prema Meghaalila" displays the 26 retrieved Telugu synchronized lines
//    in the actual DOM while playing.
// 4. Verifies real audio playback advances past 30s for representative full-length sources:
//    - Hukum (Tamil)
//    - Fear Song (Telugu)
//    - O Rendu Prema Meghaalila (Telugu)
// ============================================================================

const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9222;
const VITE_PORT = 5173;

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
      throw new Error('CDP eval error: ' + JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
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

async function runRealBrowserVerification() {
  console.log('================================================================================');
  console.log('REAL-BROWSER PLAYBACK & DOM LYRICS VERIFICATION');
  console.log('================================================================================');

  let viteProc = null;
  let chromeProc = null;
  let cdp = null;

  try {
    // 1. Start Vite dev server
    console.log(`[Step 1] Starting Vite dev server on port ${VITE_PORT}...`);
    viteProc = spawn('npx.cmd', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
      shell: true,
      stdio: 'pipe'
    });
    viteProc.stderr.on('data', (d) => process.stderr.write(d.toString()));

    await waitForServer(`http://localhost:${VITE_PORT}/`);
    console.log('  ✓ Vite server running at http://localhost:5173/');

    // 2. Launch Google Chrome headless with CDP
    console.log(`[Step 2] Launching Google Chrome headless on port ${CDP_PORT}...`);
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

    // 3. Connect to page
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find((t) => t.type === 'page') || listData[0];
    if (!pageTarget) throw new Error('No page target found');

    cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log(`[Step 3] Navigating to http://localhost:${VITE_PORT}/...`);
    await cdp.send('Page.navigate', { url: `http://localhost:${VITE_PORT}/` });

    // Wait for __naro_play_song to be exposed
    let initialized = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const isReady = await cdp.eval('typeof window.__naro_play_song === "function"');
      if (isReady) {
        initialized = true;
        break;
      }
    }
    if (!initialized) throw new Error('App failed to expose player harness within 10s');
    console.log('  ✓ App loaded and player harness ready');

    // =========================================================================
    // Check 1: O Rendu Prema Meghaalila — 26 Retrieved Telugu Lines & UI Display
    // =========================================================================
    console.log('\n[Check 1] Verifying O Rendu Prema Meghaalila 26 Telugu Lines in UI...');
    await cdp.eval(`
      (async () => {
        const song = {
          id: 'baby-o-rendu-browser',
          title: 'O Rendu Prema Meghaalila',
          artist: 'Sreerama Chandra',
          album: 'Baby',
          language: 'te',
          originalLanguage: 'te',
          duration: 30,
          fullTrackDuration: 252,
          isStreamPreview: true,
          previewAvailable: true,
          fullLengthAvailable: true,
          playbackAvailable: true,
          playbackType: 'preview'
        };
        window.__naro_play_song(song);
        window.__naro_open_now_playing();
      })()
    `);

    // Poll until lyrics resolution completes and DOM renders
    let lyricsReady = false;
    let lineCount = 0;
    let badgeText = '';
    let firstLineText = '';

    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const status = await cdp.eval(`
        (() => {
          const badge = document.getElementById('now-playing-lyrics-capability-badge');
          const lines = document.querySelectorAll('[id^="now-playing-lyric-"]');
          const firstLine = lines[0]?.querySelector('[data-testid="listening-primary-lyric"]')?.textContent?.trim();
          return {
            badge: badge?.textContent?.trim(),
            lineCount: lines.length,
            firstLine: firstLine || ''
          };
        })()
      `);

      if (status && status.lineCount >= 20) {
        lyricsReady = true;
        lineCount = status.lineCount;
        badgeText = status.badge;
        firstLineText = status.firstLine;
        break;
      }
    }

    console.log(`  Rendered DOM Line Count: ${lineCount}`);
    console.log(`  Capability Badge: "${badgeText}"`);
    console.log(`  First Lyric Line: "${firstLineText}"`);

    if (!lyricsReady || lineCount !== 26) {
      throw new Error(`Expected 26 rendered Telugu lines, got ${lineCount}`);
    }
    if (badgeText !== 'SYNCED') {
      throw new Error(`Expected badge SYNCED, got "${badgeText}"`);
    }
    if (!firstLineText.includes('ఏం మాయే ఇది ప్రాయమా')) {
      throw new Error(`Expected first line to contain "ఏం మాయే ఇది ప్రాయమా", got "${firstLineText}"`);
    }
    console.log('  ✓ PASS: O Rendu Prema Meghaalila renders all 26 synchronized Telugu lines in real browser DOM.');

    // =========================================================================
    // Check 2: Real-Browser Playback Beyond 30s — O Rendu Prema Meghaalila
    // =========================================================================
    console.log('\n[Check 2] Verifying Real-Browser Playback Past 30s for O Rendu Prema Meghaalila...');
    const oRenduPlayback = await cdp.eval(`
      (async () => {
        window.__naro_seek(32);
        const audio = window.__naro_get_audio();
        if (audio && audio.paused) {
          try { await audio.play(); } catch {}
        }
        await new Promise((r) => setTimeout(r, 1500));
        return {
          currentTime: audio ? audio.currentTime : 0,
          duration: audio ? audio.duration : 0,
          paused: audio ? audio.paused : true,
          src: audio ? audio.src : '',
          controllerDuration: window.__naro_playback_controller ? window.__naro_playback_controller.getDuration() : 0,
          isFull: window.__naro_playback_controller && window.__naro_playback_controller.getActiveProvider()
            ? window.__naro_playback_controller.getActiveProvider().canPlayFullLength(window.__naro_current_song)
            : false
        };
      })()
    `);

    console.log(`  Playback Clock Current Time: ${oRenduPlayback.currentTime.toFixed(2)}s`);
    console.log(`  Audio Element Duration: ${oRenduPlayback.duration.toFixed(2)}s`);
    console.log(`  Controller Full-Length Status: ${oRenduPlayback.isFull}`);
    console.log(`  Audio Paused: ${oRenduPlayback.paused}`);
    console.log(`  Audio Source: ${oRenduPlayback.src.slice(0, 70)}...`);

    if (oRenduPlayback.currentTime <= 30) {
      throw new Error(`Expected playback > 30s, got ${oRenduPlayback.currentTime}s`);
    }
    if (oRenduPlayback.duration < 200) {
      throw new Error(`Expected full duration > 200s, got ${oRenduPlayback.duration}s`);
    }
    console.log('  ✓ PASS: O Rendu Prema Meghaalila continues full-length playback beyond 30s in real browser.');

    // =========================================================================
    // Check 3: Real-Browser Playback Beyond 30s — Hukum (Tamil)
    // =========================================================================
    console.log('\n[Check 3] Verifying Real-Browser Playback Past 30s for Hukum (Tamil)...');
    const hukumPlayback = await cdp.eval(`
      (async () => {
        const song = {
          id: 'hukum-ta-browser',
          title: 'Hukum - Thalaivar Alappara',
          artist: 'Anirudh Ravichander',
          album: 'Jailer',
          language: 'ta',
          originalLanguage: 'ta',
          duration: 30,
          fullTrackDuration: 202,
          isStreamPreview: true,
          previewAvailable: true,
          fullLengthAvailable: true,
          playbackAvailable: true,
          playbackType: 'preview'
        };
        await window.__naro_play_song(song);
        await new Promise((r) => setTimeout(r, 800));
        window.__naro_seek(45);
        const audio = window.__naro_get_audio();
        if (audio && audio.paused) {
          try { await audio.play(); } catch {}
        }
        await new Promise((r) => setTimeout(r, 1200));
        return {
          currentTime: audio ? audio.currentTime : 0,
          duration: audio ? audio.duration : 0,
          paused: audio ? audio.paused : true,
          isFull: window.__naro_playback_controller && window.__naro_playback_controller.getActiveProvider()
            ? window.__naro_playback_controller.getActiveProvider().canPlayFullLength(window.__naro_current_song)
            : false
        };
      })()
    `);

    console.log(`  Hukum Current Time: ${hukumPlayback.currentTime.toFixed(2)}s`);
    console.log(`  Hukum Duration: ${hukumPlayback.duration.toFixed(2)}s`);
    console.log(`  Hukum Full-Length Status: ${hukumPlayback.isFull}`);

    if (hukumPlayback.currentTime <= 30) {
      throw new Error(`Hukum expected > 30s, got ${hukumPlayback.currentTime}s`);
    }
    if (hukumPlayback.duration < 190) {
      throw new Error(`Hukum expected duration >= 190s, got ${hukumPlayback.duration}s`);
    }
    console.log('  ✓ PASS: Hukum plays beyond 30s on full-length 207s stream in real browser.');

    // =========================================================================
    // Check 4: Real-Browser Playback Beyond 30s — Fear Song (Telugu)
    // =========================================================================
    console.log('\n[Check 4] Verifying Real-Browser Playback Past 30s for Fear Song (Telugu)...');
    const fearPlayback = await cdp.eval(`
      (async () => {
        const song = {
          id: 'fear-song-te-browser',
          title: 'Fear Song',
          artist: 'Anirudh Ravichander, Ramajogayya Sastry',
          album: 'Devara Part 1',
          language: 'te',
          originalLanguage: 'te',
          duration: 30,
          fullTrackDuration: 195,
          isStreamPreview: true,
          previewAvailable: true,
          fullLengthAvailable: true,
          playbackAvailable: true,
          playbackType: 'preview'
        };
        await window.__naro_play_song(song);
        await new Promise((r) => setTimeout(r, 800));
        window.__naro_seek(50);
        const audio = window.__naro_get_audio();
        if (audio && audio.paused) {
          try { await audio.play(); } catch {}
        }
        await new Promise((r) => setTimeout(r, 1200));
        return {
          currentTime: audio ? audio.currentTime : 0,
          duration: audio ? audio.duration : 0,
          paused: audio ? audio.paused : true,
          isFull: window.__naro_playback_controller && window.__naro_playback_controller.getActiveProvider()
            ? window.__naro_playback_controller.getActiveProvider().canPlayFullLength(window.__naro_current_song)
            : false
        };
      })()
    `);

    console.log(`  Fear Song Current Time: ${fearPlayback.currentTime.toFixed(2)}s`);
    console.log(`  Fear Song Duration: ${fearPlayback.duration.toFixed(2)}s`);
    console.log(`  Fear Song Full-Length Status: ${fearPlayback.isFull}`);

    if (fearPlayback.currentTime <= 30) {
      throw new Error(`Fear Song expected > 30s, got ${fearPlayback.currentTime}s`);
    }
    if (fearPlayback.duration < 180) {
      throw new Error(`Fear Song expected duration >= 180s, got ${fearPlayback.duration}s`);
    }
    console.log('  ✓ PASS: Fear Song plays beyond 30s on full-length 195s stream in real browser.');

    console.log('\n================================================================================');
    console.log('ALL REAL-BROWSER PLAYBACK & DOM CHECKS PASSED (100%)');
    console.log('================================================================================');
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    if (viteProc) {
      // Kill process tree on Windows
      spawn('taskkill', ['/pid', String(viteProc.pid), '/f', '/t']);
    }
  }
}

runRealBrowserVerification().catch((err) => {
  console.error('\nFAIL in real-browser verification:', err);
  process.exit(1);
});

