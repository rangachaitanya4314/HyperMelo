import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

interface CdpResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { message: string; code?: number };
}

class CdpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending: Map<number, (res: CdpResponse) => void> = new Map();

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data.toString()) as { id?: number; result?: any; error?: { message: string } };
          if (raw.id && this.pending.has(raw.id)) {
            const cb = this.pending.get(raw.id)!;
            this.pending.delete(raw.id);
            cb(raw as CdpResponse);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (res) => {
        if (res.error) {
          reject(new Error(`CDP Error [${method}]: ${res.error.message}`));
        } else {
          resolve(res.result || {});
        }
      });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    const resultObj = res.result as { value?: unknown; description?: string } | undefined;
    return resultObj?.value !== undefined ? resultObj.value : resultObj?.description;
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function verifyKaraokeUnlimitedRecording() {
  console.log('======================================================================');
  console.log('NARO — KARAOKE UNLIMITED RECORDING VERIFICATION (>30s PROOF)');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_unlimited_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch('http://127.0.0.1:9229/json');
        if (res.ok) {
          listData = await res.json();
          if (listData.length > 0 && listData[0].webSocketDebuggerUrl) {
            break;
          }
        }
      } catch {
        // retry
      }
    }

    if (!listData.length || !listData[0].webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome on port 9229');
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    const cdp = new CdpClient();
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('[Setup] Navigating to NARO...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

    // Wait for React app to mount and dismiss intro if present
    for (let i = 0; i < 40; i++) {
      const isReady = await cdp.eval(`
        (() => {
          sessionStorage.setItem('naro_intro_seen', 'true');
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(window.__naro_play_song);
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 800));

    // -----------------------------------------------------------------------
    // Step 1: Load and Play Full-Length Track "Shot Down"
    // -----------------------------------------------------------------------
    console.log('\n[Step 1] Loading authorized full-length reference track "Shot Down"...');
    const loadRes = await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        if (window.__naro_play_song) {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN);
          return {
            success: true,
            title: JOSH_WOODWARD_SHOT_DOWN.title,
            duration: JOSH_WOODWARD_SHOT_DOWN.duration,
            fullLengthAvailable: JOSH_WOODWARD_SHOT_DOWN.fullLengthAvailable
          };
        }
        return { success: false };
      })()
    `);
    assert(loadRes?.success === true, `Loaded "${loadRes?.title}" into player (duration: ${loadRes?.duration}s)`);
    assert(loadRes?.duration >= 254, 'Track duration is genuine full length (255s)');

    // -----------------------------------------------------------------------
    // Step 2: Open Karaoke Modal & Launch Recording Session
    // -----------------------------------------------------------------------
    console.log('\n[Step 2] Opening Karaoke Modal and launching recording...');
    await cdp.eval(`
      (() => {
        if (window.__naro_open_karaoke_modal) {
          window.__naro_open_karaoke_modal();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify modal is open and backing audio verifies
    const modalCheck = await cdp.eval(`
      (() => {
        const modal = document.querySelector('div[role="dialog"][aria-modal="true"]');
        const startBtn = document.querySelector('#karaoke-launch-btn, button[aria-label="Start Karaoke Recording"]');
        return {
          open: Boolean(modal),
          hasStartBtn: Boolean(startBtn)
        };
      })()
    `);
    assert(modalCheck?.open === true, 'Karaoke Modal opened');

    // Click "Sing This Moment" (#sing-moment-btn) once backing verification finishes
    console.log('  Waiting for backing audio verification to complete...');
    let launchClicked = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const clickRes = await cdp.eval(`
        (() => {
          const btn = document.getElementById('sing-moment-btn') || document.querySelector('button[aria-label="Sing This Moment"]');
          if (btn) {
            btn.click();
            return { clicked: true, text: btn.textContent };
          }
          return { clicked: false };
        })()
      `);
      if (clickRes?.clicked) {
        launchClicked = true;
        break;
      }
    }
    assert(launchClicked, 'Clicked Sing This Moment (#sing-moment-btn) button');

    // Wait for countdown (3 -> 2 -> 1 -> Recording active)
    console.log('\n[Step 3] Waiting for countdown to transition to live recording...');
    let recordingStarted = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = await cdp.eval(`
        (() => {
          const recBadge = document.querySelector('div[role="dialog"] span');
          const isRec = document.body.textContent.includes('REC');
          const stopBtn = document.getElementById('karaoke-stop-recording-btn');
          return { isRec, hasStopBtn: Boolean(stopBtn) };
        })()
      `);
      if (status?.isRec && status?.hasStopBtn) {
        recordingStarted = true;
        break;
      }
    }
    assert(recordingStarted, 'Live recording session started with REC indicator and Stop button');

    // -----------------------------------------------------------------------
    // Step 4: Prove Recording Continues Beyond 30 Seconds Without Auto-Stopping
    // -----------------------------------------------------------------------
    console.log('\n[Step 4] Monitoring recording progress past 30 seconds...');
    console.log('  Letting recording run beyond 30-second boundary...');

    // Sample progress across 36 seconds to solidly pass the 30s mark
    let reachedPast30 = false;
    let finalSampleSec = 0;

    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      await new Promise((r) => setTimeout(r, 2000));
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      const recStatus = await cdp.eval(`
        (() => {
          const stopBtn = document.getElementById('karaoke-stop-recording-btn');
          const isRec = document.body.textContent.includes('REC');
          const timeSpan = Array.from(document.querySelectorAll('span')).find(s => s.style && s.style.fontVariantNumeric === 'tabular-nums');
          return {
            active: Boolean(stopBtn) && isRec,
            timerText: timeSpan ? timeSpan.innerText : ''
          };
        })()
      `);

      process.stdout.write(`  ... Recording elapsed: ~${elapsed}s (UI timer: ${recStatus?.timerText || 'active'})\r`);

      if (elapsed >= 35) {
        assert(recStatus?.active === true, `Recording is STILL active at ${elapsed}s (did NOT auto-stop at 30s)`);
        reachedPast30 = true;
        finalSampleSec = elapsed;
        break;
      }
    }
    console.log('');
    assert(reachedPast30, `Recording successfully progressed past 30 seconds (sample: ${finalSampleSec}s)`);

    // -----------------------------------------------------------------------
    // Step 5: User Manually Stops Recording
    // -----------------------------------------------------------------------
    console.log('\n[Step 5] Triggering user manual STOP...');
    const stopResult = await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('karaoke-stop-recording-btn');
        if (stopBtn) {
          stopBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    assert(stopResult?.clicked === true, 'Manually clicked Stop & Finish Moment button');
    await new Promise((r) => setTimeout(r, 1500));

    // -----------------------------------------------------------------------
    // Step 6: Verify Resulting Recorded Take is Retained with Duration > 30s
    // -----------------------------------------------------------------------
    console.log('\n[Step 6] Verifying resulting take retention in IndexedDB...');
    const dbTakes = await cdp.eval(`
      (async () => {
        const { indexedDbService } = await import('/src/services/storage/indexedDbService.ts');
        const takes = await indexedDbService.getAllTakes();
        const latest = takes[0]; // takes are ordered desc by recordedAt
        return {
          totalTakes: takes.length,
          latestId: latest?.id,
          songTitle: latest?.songTitle,
          artist: latest?.artist,
          duration: latest?.duration,
          isRealRecording: latest?.isRealRecording,
          hasBlob: Boolean(latest?.audioBlob || latest?.audioBlobUrl)
        };
      })()
    `);

    console.log('  Saved Take Details:', dbTakes);
    assert(dbTakes?.totalTakes > 0, `IndexedDB contains saved takes (count: ${dbTakes?.totalTakes})`);
    assert(dbTakes?.songTitle === 'Shot Down', `Saved take matches song "Shot Down" (got "${dbTakes?.songTitle}")`);
    assert(dbTakes?.duration > 30, `Recorded take duration is GREATER than 30 seconds: ${dbTakes?.duration}s`);
    assert(dbTakes?.isRealRecording === true, 'Take is marked isRealRecording: true');

    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {
      // ignore
    }
  }

  console.log('\n======================================================================');
  console.log('ALL UNLIMITED RECORDING CHECKS PASSED: RECORDING >30s PROVEN');
  console.log('======================================================================\n');
}

verifyKaraokeUnlimitedRecording().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
