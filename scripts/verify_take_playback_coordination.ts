// NARO Phase 5 Step 2: Take Playback Coordination Verification
// Tests that:
// 1. TakePlaybackService coordinates with PlaybackController (pauses music when take starts)
// 2. Zero raw `new Audio()` calls exist in LibraryPage, KaraokePage, or PerformanceReviewModal
// 3. Single take preview and dual-track review session operate with authoritative lifecycle
// 4. Real browser Chrome CDP verifies that starting a take pauses normal music playback and unmounting cleans up

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
    const resultObj = res.result as { value?: unknown; description?: string };
    return resultObj?.value;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

async function runVerification() {
  console.log('======================================================================');
  console.log('NARO PHASE 5 STEP 2 — TAKE PLAYBACK COORDINATION ACCEPTANCE TEST');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // [Check 1] Static Code Audit: Zero raw `new Audio()` in Presentation Components
  // -------------------------------------------------------------------------
  console.log('[Check 1] Verifying Presentation Components have Zero raw new Audio()...');
  const presentationFiles = [
    'src/pages/LibraryPage.tsx',
    'src/pages/KaraokePage.tsx',
    'src/components/PerformanceReviewModal.tsx'
  ];

  for (const relPath of presentationFiles) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = content.match(/new\s+Audio\s*\(/g);
    assert(!matches || matches.length === 0, `${relPath} contains 0 raw new Audio() calls`);
  }

  // -------------------------------------------------------------------------
  // [Check 2] Service Unit Invariant: TakePlaybackService Interface & Coordination
  // -------------------------------------------------------------------------
  console.log('\n[Check 2] Verifying TakePlaybackService Interface and Coordination...');
  const { takePlaybackService } = await import('../src/services/audio/takePlaybackService');
  const { playbackController } = await import('../src/services/audio/PlaybackController');

  assert(typeof takePlaybackService.playTake === 'function', 'takePlaybackService.playTake is a function');
  assert(typeof takePlaybackService.toggleTake === 'function', 'takePlaybackService.toggleTake is a function');
  assert(typeof takePlaybackService.stopTake === 'function', 'takePlaybackService.stopTake is a function');
  assert(typeof takePlaybackService.initReviewSession === 'function', 'takePlaybackService.initReviewSession is a function');
  assert(typeof takePlaybackService.toggleReviewPlayback === 'function', 'takePlaybackService.toggleReviewPlayback is a function');
  assert(typeof takePlaybackService.stopReviewSession === 'function', 'takePlaybackService.stopReviewSession is a function');

  // Test that playTake calls playbackController.pause()
  let pauseCount = 0;
  const originalPause = playbackController.pause.bind(playbackController);
  playbackController.pause = () => {
    pauseCount++;
    originalPause();
  };

  const dummyTake: any = {
    id: 'test-take-coord',
    songId: 'shot-down',
    songTitle: 'Shot Down',
    artist: 'Josh Woodward',
    section: 'chorus',
    sectionLabel: 'Chorus',
    language: 'en',
    recordedAt: Date.now(),
    duration: 15,
    isRealRecording: true,
    analysisStatus: 'unavailable',
    audioBlobUrl: 'blob:http://localhost:5173/test-blob-123'
  };

  try {
    await takePlaybackService.playTake(dummyTake);
  } catch {
    // node runtime audio mock
  }

  assert(pauseCount > 0, 'takePlaybackService.playTake immediately coordinates by pausing PlaybackController');

  // Verify single-audio ownership: starting review session clears single-take preview
  takePlaybackService.initReviewSession(dummyTake, 'http://localhost:5173/backing.mp3');
  assert(takePlaybackService.getPlayingTakeId() === null, 'initReviewSession clears active preview take');

  // Verify toggleReviewPlayback also calls playbackController.pause()
  const previousPauseCount = pauseCount;
  try {
    await takePlaybackService.toggleReviewPlayback();
  } catch {
    // node mock
  }
  assert(pauseCount > previousPauseCount, 'takePlaybackService.toggleReviewPlayback coordinates by pausing PlaybackController');

  // Verify starting preview clears active review session
  try {
    await takePlaybackService.playTake(dummyTake);
  } catch {
    // node mock
  }
  const reviewState = takePlaybackService.getReviewState();
  assert(reviewState.isPlaying === false, 'playTake terminates any active review session');

  // Verify teardown cleans up both preview and review sessions
  takePlaybackService.teardown();
  assert(takePlaybackService.getPlayingTakeId() === null, 'teardown clears preview take');
  assert(takePlaybackService.getReviewState().isPlaying === false, 'teardown clears review session');

  playbackController.pause = originalPause;

  // -------------------------------------------------------------------------
  // [Check 3] Real Chrome CDP: Starting Take Playback Pauses Central Music Audio
  // -------------------------------------------------------------------------
  console.log('\n[Check 3] Real Chrome CDP: Verifying Central Music Pauses when Take Plays...');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_take_coord_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });
  const cdp = new CdpClient();

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch('http://127.0.0.1:9244/json');
        if (res.ok) {
          listData = await res.json();
          if (listData.length > 0 && listData[0].webSocketDebuggerUrl) {
            break;
          }
        }
      } catch {
        // waiting
      }
    }

    const pageTarget = listData.find((p) => p.url.includes('5173')) || listData[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Failed to find WebSocketDebuggerUrl on port 9244');
    }

    await cdp.connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Wait for React app to mount and dismiss intro if present
    for (let i = 0; i < 30; i++) {
      const isReady = await cdp.eval(`
        (() => {
          try {
            sessionStorage.setItem('naro_intro_seen', 'true');
          } catch {}
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          const mainApp = document.querySelector('aside, [data-testid="bottom-player"], h1');
          return Boolean(mainApp && window.__naro_play_song);
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // Start playing Shot Down normally via PlaybackController
    await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        if (window.__naro_play_song) {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
          return;
        }
        const { playbackController } = await import('/src/services/audio/PlaybackController.ts');
        await playbackController.loadAndPlay(JOSH_WOODWARD_SHOT_DOWN, 0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const isMusicPlayingInitially = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? !audio.paused : false;
      })()
    `);
    assert(isMusicPlayingInitially === true, 'Initial normal music is actively playing in browser');

    // Now simulate user playing a recorded take via takePlaybackService
    console.log('  Triggering take playback through takePlaybackService...');
    await cdp.eval(`
      (async () => {
        const blob = new Blob([new Uint8Array(1000)], { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        const take = {
          id: 'cdp-test-take',
          songId: 'josh-woodward-shot-down',
          songTitle: 'Shot Down',
          artist: 'Josh Woodward',
          section: 'chorus',
          sectionLabel: 'Chorus',
          language: 'en',
          recordedAt: Date.now(),
          duration: 20,
          isRealRecording: true,
          analysisStatus: 'unavailable',
          audioBlobUrl: blobUrl
        };

        const mod = await import('/src/services/audio/takePlaybackService.ts');
        await mod.takePlaybackService.playTake(take);
      })()
    `);

    await new Promise((r) => setTimeout(r, 600));

    // Verify central music audio is strictly paused
    const isMusicPausedAfterTakePlay = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? audio.paused : true;
      })()
    `);

    assert(isMusicPausedAfterTakePlay === true, 'Central music audio was automatically paused upon take playback');

    // Resume normal music, then test dual-track review playback coordination
    console.log('  Resuming central music to test Review Modal playback coordination...');
    await cdp.eval(`
      (async () => {
        const { playbackController } = await import('/src/services/audio/PlaybackController.ts');
        await playbackController.play();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    console.log('  Triggering review playback through takePlaybackService...');
    await cdp.eval(`
      (async () => {
        const mod = await import('/src/services/audio/takePlaybackService.ts');
        const blob = new Blob([new Uint8Array(1000)], { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        const take = {
          id: 'cdp-test-review-take',
          songId: 'josh-woodward-shot-down',
          songTitle: 'Shot Down',
          artist: 'Josh Woodward',
          section: 'chorus',
          sectionLabel: 'Chorus',
          language: 'en',
          recordedAt: Date.now(),
          duration: 20,
          isRealRecording: true,
          analysisStatus: 'unavailable',
          audioBlobUrl: blobUrl
        };
        mod.takePlaybackService.initReviewSession(take, 'http://127.0.0.1:5173/audio/josh-woodward-shot-down-novox.mp3');
        await mod.takePlaybackService.toggleReviewPlayback();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isMusicPausedAfterReviewPlay = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? audio.paused : true;
      })()
    `);
    assert(isMusicPausedAfterReviewPlay === true, 'Central music audio was automatically paused upon review playback');

    // -------------------------------------------------------------------------
    // [Check 4] Real Chrome CDP: Navigating / Unmounting Cleans Up Take Audio
    // -------------------------------------------------------------------------
    console.log('\n[Check 4] Real Chrome CDP: Verifying Unmount Cleanup...');
    await cdp.eval(`
      (async () => {
        const mod = await import('/src/services/audio/takePlaybackService.ts');
        mod.takePlaybackService.teardown();
      })()
    `);

    const isTakeCleanedUp = await cdp.eval(`
      (async () => {
        const mod = await import('/src/services/audio/takePlaybackService.ts');
        const state = mod.takePlaybackService.getPreviewState();
        return state.playingTakeId === null && state.isPlaying === false;
      })()
    `);

    assert(isTakeCleanedUp === true, 'Take preview state is completely cleared on stop/unmount');

    console.log('\n======================================================================');
    console.log('ALL TAKE PLAYBACK COORDINATION ACCEPTANCE CHECKS PASSED!');
    console.log('======================================================================\n');
  } finally {
    cdp.close();
    chromeProcess.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
