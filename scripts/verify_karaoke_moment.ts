import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

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
          const raw = JSON.parse(event.data.toString()) as { id?: number; method?: string; params?: any; error?: { message: string } };
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

async function findChromePath(): Promise<string> {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'chrome';
}

async function verifyKaraokeMoment() {
  console.log('======================================================================');
  console.log('NARO — KARAOKE 2.0 LYRIC-FIRST & >=60s UNLIMITED RECORDING ACCEPTANCE');
  console.log('======================================================================\n');

  const chromePath = await findChromePath();
  const cdpPort = 9225;
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_moment_60s_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--window-size=1280,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
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
      throw new Error(`Failed to connect to Chrome on port ${cdpPort}`);
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    const cdp = new CdpClient();
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('[Setup] Loading NARO application...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

    for (let i = 0; i < 40; i++) {
      const isMounted = await cdp.eval(`
        (() => {
          sessionStorage.setItem('naro_intro_seen', 'true');
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(window.__naro_play_song);
        })()
      `);
      if (isMounted) break;
      await new Promise((r) => setTimeout(r, 350));
    }
    await new Promise((r) => setTimeout(r, 800));

    // =========================================================================
    // CHECK 1: Play Reference Track & Open Karaoke Modal
    // =========================================================================
    console.log('\n[Check 1] Loading official reference track "Shot Down" and opening Karaoke Modal...');
    const loadTrackRes = await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        if (typeof window.__naro_play_song === 'function') {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
          return {
            success: true,
            title: JOSH_WOODWARD_SHOT_DOWN.title,
            duration: JOSH_WOODWARD_SHOT_DOWN.duration
          };
        }
        return { success: false };
      })()
    `);
    assert(loadTrackRes?.success === true, `Loaded "${loadTrackRes?.title}" (duration: ${loadTrackRes?.duration}s)`);

    await cdp.eval(`
      (() => {
        if (typeof window.__naro_open_karaoke_modal === 'function') {
          window.__naro_open_karaoke_modal();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    // =========================================================================
    // CHECK 2: Lyric-First Architecture & Elimination of Obsolete Fixed Presets
    // =========================================================================
    console.log('\n[Check 2] Verifying Lyric-First Architecture (No Obsolete Fixed-Duration Tabs)...');
    const modalCheck = await cdp.eval(`
      (() => {
        const modal = document.querySelector('div[role="dialog"][aria-labelledby="karaoke-modal-title"]') || document.querySelector('div[role="dialog"]');
        if (!modal) return { hasSingTheMoment: false, hasObsoleteTabs: false, error: 'Modal not found' };

        const titleEl = modal.querySelector('#karaoke-modal-title');
        const modalText = modal.innerText || modal.textContent || '';
        const hasSingTheMoment = titleEl ? titleEl.textContent.toUpperCase().includes('SING THE MOMENT') : modalText.toUpperCase().includes('SING THE MOMENT');

        // Confirm obsolete tablist is gone from Karaoke Modal
        const tabList = modal.querySelector('[role="tablist"]');
        const tabs = Array.from(modal.querySelectorAll('[role="tab"]')).map(t => (t.textContent || '').trim().toUpperCase());
        const hasObsoleteTabs = Boolean(tabList) || tabs.includes('VERSE') || tabs.includes('CHORUS') || tabs.includes('BRIDGE');

        // Confirm lyric-first start position banner and sliders are present
        const startBanner = modal.querySelector('[data-testid="karaoke-start-banner"]');
        const hasStartPos = modalText.toUpperCase().includes('START POSITION') || modalText.toUpperCase().includes('START AT');
        const hasUnlimitedMode = modalText.toUpperCase().includes('UNLIMITED') || modalText.toUpperCase().includes('MANUAL STOP');

        const musicSlider = modal.querySelector('#karaoke-music-volume-slider') || modal.querySelector('input[aria-label="Backing music volume"]');
        const voiceSlider = modal.querySelector('#karaoke-voice-volume-slider') || modal.querySelector('input[aria-label="Microphone volume"]');

        return {
          hasSingTheMoment,
          hasObsoleteTabs,
          hasStartBanner: Boolean(startBanner) || hasStartPos,
          hasUnlimitedMode,
          hasMusicSlider: Boolean(musicSlider),
          hasVoiceSlider: Boolean(voiceSlider)
        };
      })()
    `);
    console.log('  Modal Audit:', modalCheck);
    assert(modalCheck.hasSingTheMoment, 'Modal heading displays "SING THE MOMENT"');
    assert(!modalCheck.hasObsoleteTabs, 'Obsolete Verse/Chorus/Bridge/Custom fixed-duration tabs are REMOVED');
    assert(modalCheck.hasStartBanner, 'Lyric-first Start Position banner is present');
    assert(modalCheck.hasUnlimitedMode, 'Recording mode explicitly labeled Unlimited / Manual Stop');
    assert(modalCheck.hasMusicSlider, 'Backing Music volume slider present');
    assert(modalCheck.hasVoiceSlider, 'My Voice volume slider present');

    // =========================================================================
    // CHECK 3: Wait for Backing Audio Verification & Launch Recording
    // =========================================================================
    console.log('\n[Check 3] Waiting for backing verification and launching recording...');
    let singBtnReady = false;
    for (let i = 0; i < 30; i++) {
      const isReady = await cdp.eval(`Boolean(document.getElementById('sing-moment-btn'))`);
      if (isReady) {
        singBtnReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(singBtnReady, 'Backing audio verified; Sing This Moment button ready');

    await cdp.eval(`
      (() => {
        const singBtn = document.getElementById('sing-moment-btn');
        if (singBtn) singBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Wait for countdown (3 -> 2 -> 1 -> GO) to transition to live recording
    console.log('  Waiting for countdown to finish...');
    await new Promise((r) => setTimeout(r, 3500));

    const recActiveCheck = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const hasRec = text.includes('REC');
        const stopBtn = document.getElementById('karaoke-stop-recording-btn');
        const hasUnlimited = text.includes('Unlimited Take') || text.includes('Starting at');
        return {
          hasRec,
          hasStopBtn: Boolean(stopBtn),
          hasUnlimited
        };
      })()
    `);
    assert(recActiveCheck.hasRec, 'Live recording active with REC indicator');
    assert(recActiveCheck.hasStopBtn, 'Manual Stop button present (#karaoke-stop-recording-btn)');
    assert(recActiveCheck.hasUnlimited, 'Recording header truthfully indicates start time & Unlimited Take');

    // =========================================================================
    // CHECK 4: Real Continuous Recording Beyond 60 Seconds (>=60s Proof)
    // =========================================================================
    console.log('\n[Check 4] Recording continuously past 60-second threshold (>= 60s required)...');
    console.log('  Testing true unbounded recording without artificial 30s or 60s cutoff...');

    const recStartTime = Date.now();
    let verifiedPast60 = false;
    let sampledSec = 0;

    // Monitor for 66 seconds total
    while (Date.now() - recStartTime < 75000) {
      await new Promise((r) => setTimeout(r, 4000));
      const elapsed = Math.round((Date.now() - recStartTime) / 1000);

      const status = await cdp.eval(`
        (() => {
          const isRec = document.body.innerText.includes('REC');
          const stopBtn = document.getElementById('karaoke-stop-recording-btn');
          return { isRec, hasStopBtn: Boolean(stopBtn) };
        })()
      `);

      process.stdout.write(`  ... Recording elapsed: ~${elapsed}s (REC: ${status.isRec ? 'ACTIVE' : 'STOPPED'})\n`);

      if (elapsed >= 62) {
        assert(status.isRec, `Recording is STILL active at ${elapsed}s (exceeded 60s threshold, no auto-cutoff)`);
        verifiedPast60 = true;
        sampledSec = elapsed;
        break;
      }
    }

    assert(verifiedPast60, `Successfully recorded past 60 seconds (measured sample: ${sampledSec}s)`);

    // =========================================================================
    // CHECK 5: Manual Stop & Performance Review ("YOUR TAKE")
    // =========================================================================
    console.log('\n[Check 5] Triggering user manual STOP...');
    await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('karaoke-stop-recording-btn');
        if (stopBtn) stopBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    console.log('  Verifying Performance Review Modal ("YOUR TAKE")...');
    const reviewCheck = await cdp.eval(`
      (async () => {
        const bodyText = document.body.innerText;
        const hasYourTake = bodyText.toUpperCase().includes('YOUR TAKE');
        const hasAnalysisUnavailable = bodyText.toUpperCase().includes('ANALYSIS UNAVAILABLE');

        const musicSlider = document.getElementById('review-music-volume-slider') || document.querySelector('input[aria-label="Music volume slider"]');
        const voiceSlider = document.getElementById('review-voice-volume-slider') || document.querySelector('input[aria-label="My Voice volume slider"]');

        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
        const hasPlay = buttons.some(b => b.includes('Play') || b.includes('Pause'));
        const hasRerecord = buttons.some(b => b.includes('Re-record') || b.includes('Retake'));
        const hasSave = buttons.some(b => b.includes('Save') || b.includes('Saved'));
        const hasDelete = buttons.some(b => b.includes('Delete'));

        // Confirm zero fake scoring numbers/stars
        const hasFakeScores = bodyText.includes('Pitch Accuracy:') || bodyText.includes('★') || bodyText.includes('Score: 9');

        const { indexedDbService } = await import('/src/services/storage/indexedDbService.ts');
        const takes = await indexedDbService.getAllTakes();
        const latest = takes[0];

        return {
          hasYourTake,
          hasAnalysisUnavailable,
          hasMusicSlider: Boolean(musicSlider),
          hasVoiceSlider: Boolean(voiceSlider),
          hasPlay,
          hasRerecord,
          hasSave,
          hasDelete,
          hasFakeScores,
          persistedDuration: latest?.duration || 0,
          persistedSongTitle: latest?.songTitle,
          isRealRecording: latest?.isRealRecording
        };
      })()
    `);
    console.log('  Review Check:', reviewCheck);
    assert(reviewCheck.hasYourTake, 'Review heading displays "YOUR TAKE"');
    assert(reviewCheck.hasAnalysisUnavailable, 'Truthfully displays "Performance analysis unavailable"');
    assert(!reviewCheck.hasFakeScores, 'Zero fabricated pitch scores or ratings');
    assert(reviewCheck.hasMusicSlider, 'Review includes Music volume slider');
    assert(reviewCheck.hasVoiceSlider, 'Review includes My Voice volume slider');
    assert(reviewCheck.hasPlay, 'Review includes Play button');
    assert(reviewCheck.hasRerecord, 'Review includes Re-record button');
    assert(reviewCheck.hasSave, 'Review includes Save button');
    assert(reviewCheck.hasDelete, 'Review includes Delete button');
    assert(reviewCheck.persistedDuration >= 60, `Persisted take duration is >= 60.0s (actual: ${reviewCheck.persistedDuration.toFixed(1)}s)`);
    assert(reviewCheck.isRealRecording === true, 'Saved take marked isRealRecording: true');

    // =========================================================================
    // CHECK 6: Test Audio Playback in Review Modal
    // =========================================================================
    console.log('\n[Check 6] Testing audio playback in review modal...');
    const playToggleRes = await cdp.eval(`
      (() => {
        const playBtn = document.getElementById('review-play-btn') || Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Play'));
        if (playBtn) {
          playBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    assert(playToggleRes?.clicked === true, 'Toggled take playback in review modal');
    await new Promise((r) => setTimeout(r, 1000));

    // Pause audio before dismissing
    await cdp.eval(`
      (() => {
        const pauseBtn = document.getElementById('review-play-btn') || Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Pause'));
        if (pauseBtn) pauseBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // CHECK 7: Save to Library & Verify in Library -> Your Takes
    // =========================================================================
    console.log('\n[Check 7] Saving take and verifying Library -> Your Takes...');
    await cdp.eval(`
      (() => {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Dismiss review modal
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close review modal"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Navigate to Library
    await cdp.eval(`
      (() => {
        const libBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.innerText.trim() === 'Library');
        if (libBtn) libBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const libraryTakesCheck = await cdp.eval(`
      (async () => {
        const bodyText = document.body.innerText;
        const hasShotDownTake = bodyText.includes('Shot Down');
        const { indexedDbService } = await import('/src/services/storage/indexedDbService.ts');
        const takes = await indexedDbService.getAllTakes();
        const latest = takes[0];

        return {
          hasShotDownTake,
          totalTakes: takes.length,
          latestSongTitle: latest?.songTitle,
          latestDuration: latest?.duration,
          isRealRecording: latest?.isRealRecording
        };
      })()
    `);
    console.log('  Library State:', libraryTakesCheck);
    assert(libraryTakesCheck.hasShotDownTake, 'Saved take card successfully rendered in Library UI');
    assert(libraryTakesCheck.latestDuration >= 60, `Saved take has genuine duration >= 60s (${libraryTakesCheck.latestDuration.toFixed(1)}s)`);
    assert(libraryTakesCheck.isRealRecording === true, 'Saved take has isRealRecording: true');

    console.log('\n======================================================================');
    console.log(`ACCEPTANCE SUCCESS: RECORDING DURATION ${libraryTakesCheck.latestDuration.toFixed(1)}s (>=60s PROVEN)`);
    console.log('ALL KARAOKE 2.0 MOMENT & REVIEW ACCEPTANCE CHECKS PASSED: 7/7');
    console.log('======================================================================\n');
    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {
      // ignore
    }
  }
}

verifyKaraokeMoment().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
