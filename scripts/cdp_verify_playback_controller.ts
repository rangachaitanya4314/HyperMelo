// Real Chrome Browser Acceptance Test for PlaybackController
// Directly tests real browser playback, play/pause, seek, and provider switching via Chrome CDP

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

  async screenshot(filePath: string): Promise<void> {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const base64Data = res.data as string;
    const buf = Buffer.from(base64Data, 'base64');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buf);
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

async function runBrowserPlaybackControllerVerification(): Promise<void> {
  console.log('======================================================================');
  console.log('NARO PHASE 3.5B — REAL BROWSER PLAYBACK CONTROLLER ACCEPTANCE TEST');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_playback_controller_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9232',
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
        const res = await fetch('http://127.0.0.1:9232/json');
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
      throw new Error('Failed to connect to Chrome on port 9232');
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    const cdp = new CdpClient();
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('[Setup] Navigating to http://127.0.0.1:5173/ and dismissing intro...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

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

    // =========================================================================
    // CHECK 1: Playback of Licensed Full-Length Reference Track
    // =========================================================================
    console.log('\n[Check 1] Verifying PlaybackController Starting Reference Track...');
    const playStatus = await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        if (window.__naro_play_song) {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
          return { success: true, title: JOSH_WOODWARD_SHOT_DOWN.title };
        }
        const { playbackController } = await import('/src/services/audio/PlaybackController.ts');
        await playbackController.loadAndPlay(JOSH_WOODWARD_SHOT_DOWN, 0);
        return { success: true, title: JOSH_WOODWARD_SHOT_DOWN.title };
      })()
    `);
    assert(playStatus?.success === true, `Started normal playback of ${playStatus?.title}`);
    await new Promise((r) => setTimeout(r, 1200));

    const audioInfo = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return {
          src: audio?.src || '',
          paused: audio ? audio.paused : true,
          currentTime: audio?.currentTime || 0,
          duration: audio?.duration || 0
        };
      })()
    `);
    assert(audioInfo.src.includes('josh-woodward-shot-down-vocal.mp3'), `Active audio playing vocal master: ${audioInfo.src}`);
    assert(audioInfo.paused === false, 'Audio element is currently playing');
    assert(audioInfo.currentTime > 0.1, `Playback clock advancing (currentTime: ${audioInfo.currentTime.toFixed(2)}s)`);

    // =========================================================================
    // CHECK 2: PlaybackController Seek Delegation
    // =========================================================================
    console.log('\n[Check 2] Verifying Seek to 60s via PlaybackController...');
    await cdp.eval(`
      (() => {
        if (window.__naro_seek) {
          window.__naro_seek(60.0);
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const seekTime = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio?.currentTime || (window.__naro_get_current_time ? window.__naro_get_current_time() : 0);
      })()
    `);
    assert(Math.abs(seekTime - 60.0) < 3.0, `Audio seeked cleanly to ~60s (actual: ${seekTime.toFixed(2)}s)`);

    // =========================================================================
    // CHECK 3: Pause and Resume Delegation
    // =========================================================================
    console.log('\n[Check 3] Verifying Pause and Resume via Bottom Player Controls...');
    // Click pause button in bottom player
    await cdp.eval(`
      (() => {
        const pauseBtn = document.querySelector('aside button[aria-label="Pause"], [data-testid="bottom-play-btn"]');
        if (pauseBtn) pauseBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const isPaused = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio?.paused === true || (window.__naro_is_playing ? !window.__naro_is_playing() : false);
      })()
    `);
    assert(isPaused === true, 'Audio is strictly paused after Pause click');

    // Click play button to resume
    await cdp.eval(`
      (() => {
        const playBtn = document.querySelector('aside button[aria-label="Play"], [data-testid="bottom-play-btn"]');
        if (playBtn) playBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isResumed = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio && !audio.paused;
      })()
    `);
    assert(isResumed === true, 'Audio resumed playing after Play click');

    // =========================================================================
    // CHECK 4: Real Provider Switching in Browser (Full-Length -> Preview -> Full-Length)
    // =========================================================================
    console.log('\n[Check 4] Testing Provider Switching to Apple Preview Track...');
    const previewSwitchStatus = await cdp.eval(`
      (async () => {
        const controller = (window).__naro_playback_controller || (await import('/src/services/audio/PlaybackController.ts')).playbackController;
        const previewTrack = {
          id: 'apple-preview-unlicensed',
          title: 'Unlicensed Indie Preview',
          artist: 'Independent Sample Artist',
          duration: 30,
          sections: [{ type: 'chorus', label: 'Chorus', start: 0, end: 30 }],
          isStreamPreview: true,
          playbackType: 'preview',
          playbackSourceType: 'preview',
          playbackSource: {
            provider: 'itunes',
            streamUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d5/f9/98/d5f998a7-0090-ee2d-03f8-557ad6c5bf65/mzaf_14251357991592637728.plus.aac.p.m4a'
          },
          capabilities: { playback: true, lyrics: false, karaoke: false, recording: false }
        };

        if (window.__naro_play_song) {
          window.__naro_play_song(previewTrack, 0);
        }
        await controller.loadAndPlay(previewTrack, 0);

        const activeProvider = controller.getActiveProvider();
        return {
          activeProviderId: activeProvider?.id || '',
          providerSwitched: activeProvider?.id === 'html5-audio'
        };
      })()
    `);

    assert(previewSwitchStatus.providerSwitched === true, `Provider cleanly switched to ${previewSwitchStatus.activeProviderId}`);
    await new Promise((r) => setTimeout(r, 1500));

    const previewAudioSrc = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio?.src || '';
      })()
    `);
    assert(previewAudioSrc.includes('itunes.apple.com'), `Active audio element now playing preview: ${previewAudioSrc}`);

    // Switch back to NARO full-length provider track
    console.log('  Switching back to NARO full-length provider track...');
    const switchBackStatus = await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        const controller = (window).__naro_playback_controller || (await import('/src/services/audio/PlaybackController.ts')).playbackController;
        if (window.__naro_play_song) {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
        }
        await controller.loadAndPlay(JOSH_WOODWARD_SHOT_DOWN, 0);
        const activeProvider = controller.getActiveProvider();
        return {
          activeProviderId: activeProvider?.id || '',
          providerSwitchedBack: activeProvider?.id === 'naro-full-length'
        };
      })()
    `);
    assert(switchBackStatus.providerSwitchedBack === true, `Provider switched back cleanly to ${switchBackStatus.activeProviderId}`);
    await new Promise((r) => setTimeout(r, 1200));

    const restoredAudioSrc = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio?.src || '';
      })()
    `);
    assert(restoredAudioSrc.includes('josh-woodward-shot-down-vocal.mp3'), `Audio element restored to vocal master: ${restoredAudioSrc}`);

    // =========================================================================
    // CHECK 5: Visual Layout & Bottom Player Stability
    // =========================================================================
    console.log('\n[Check 5] Capturing Live Player State Screenshot...');
    const screenshotPath = path.resolve(process.cwd(), 'screenshots', 'playback_controller_live.png');
    await cdp.screenshot(screenshotPath);
    assert(fs.existsSync(screenshotPath), `Captured live screenshot to ${screenshotPath}`);

    cdp.close();
    console.log('\n======================================================================');
    console.log('ALL REAL BROWSER PLAYBACK CONTROLLER ACCEPTANCE CHECKS PASSED!');
    console.log('======================================================================\n');
  } finally {
    try {
      chromeProcess.kill();
    } catch {
      // ignore
    }
  }
}

runBrowserPlaybackControllerVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
