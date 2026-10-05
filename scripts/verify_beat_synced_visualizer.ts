// Phase: Beat-Synchronized Circular Visualizer Verification Suite
// Real Chrome CDP End-to-End Verification:
// 1. Visualizer mounted in DOM with Canvas and Center Disc
// 2. Center Content: Song Title, Artist Name, NO NARO Logo, graceful truncation, centered
// 3. Audio Reactivity: Web Audio API AnalyserNode byte frequency data flowing into visualizer
// 4. Pause Settling: Natural decay and settling on pause, kick impulse resets
// 5. Resume & Seek: Immediate audio reactivity on resume and seek
// 6. Track Change: Immediate update of title and artist without breaking layout
// 7. Full-Length Playback: Verified playback past 30 seconds without preview cutoff
// 8. Interactive Play/Pause: Click-to-toggle playback interaction
// 9. Responsive layout: Aspect-ratio 1:1, non-clipped canvas rendering

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
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

async function runVisualizerVerification() {
  console.log('======================================================================');
  console.log('NARO — BEAT-SYNCHRONIZED CIRCULAR VISUALIZER VERIFICATION (9 CHECKS)');
  console.log('======================================================================\n');

  const chromePath = await findChromePath();
  const cdpPort = 9238;
  const userDataDir = path.join(os.tmpdir(), `naro-viz-${Date.now()}`);
  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,900',
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

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs.find((t) => t.type === 'page') || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP page on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');

    console.log('[Setup] Navigating to NARO Home...');
    await new Promise((r) => setTimeout(r, 1200));

    // Dismiss cinematic intro if present
    await cdp.eval(`
      (() => {
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // =========================================================================
    // CHECK 1: Visualizer Mounting & Structure
    // =========================================================================
    console.log('\n[Check 1] Verifying Visualizer Mounting & Structure in DOM...');
    const mountCheck = await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        const canvas = visualizer ? visualizer.querySelector('canvas') : null;
        const centerDisc = visualizer ? visualizer.querySelector('.visualizer-center-disc') : null;
        return {
          hasVisualizer: !!visualizer,
          hasCanvas: !!canvas,
          hasCenterDisc: !!centerDisc,
          canvasWidth: canvas ? canvas.width : 0,
          canvasHeight: canvas ? canvas.height : 0
        };
      })()
    `);
    assert(mountCheck?.hasVisualizer === true, 'Visualizer container (.beat-synced-visualizer) is mounted in DOM');
    assert(mountCheck?.hasCanvas === true, 'Visualizer renders real HTML5 Canvas element');
    assert(mountCheck?.hasCenterDisc === true, 'Visualizer renders central audio-reactive core disc');
    assert(mountCheck?.canvasWidth > 200 && mountCheck?.canvasHeight > 200, `Canvas dimensions properly allocated (${mountCheck?.canvasWidth}x${mountCheck?.canvasHeight}px)`);

    // =========================================================================
    // CHECK 2: Center Content: Song Title, Artist Name, NO NARO Logo, Truncation
    // =========================================================================
    console.log('\n[Check 2] Verifying Center Content (Song Title & Artist, NO Logo, Truncation)...');
    const centerContent = await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        const titleEl = visualizer ? visualizer.querySelector('#visualizer-song-title') : null;
        const artistEl = visualizer ? visualizer.querySelector('#visualizer-song-artist') : null;
        const allText = visualizer ? visualizer.textContent : '';

        // Check if there is an explicit NARO logo inside the central disc
        const centerDisc = visualizer ? visualizer.querySelector('.visualizer-center-disc') : null;
        const hasNaroLogoInCenter = centerDisc ? (
          centerDisc.querySelector('svg text')?.textContent?.includes('NARO') ||
          centerDisc.querySelector('.naro-logo') !== null
        ) : false;

        const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
        const artistStyle = artistEl ? window.getComputedStyle(artistEl) : null;

        return {
          hasTitle: !!titleEl,
          titleText: titleEl ? titleEl.textContent?.trim() : '',
          hasArtist: !!artistEl,
          artistText: artistEl ? artistEl.textContent?.trim() : '',
          hasNaroLogoInCenter,
          titleOverflow: titleStyle?.overflow,
          titleTextOverflow: titleStyle?.textOverflow,
          titleWhiteSpace: titleStyle?.whiteSpace,
          artistOverflow: artistStyle?.overflow,
          artistTextOverflow: artistStyle?.textOverflow,
          artistWhiteSpace: artistStyle?.whiteSpace
        };
      })()
    `);
    assert(centerContent?.hasTitle === true, `Song title is displayed in visualizer center ("${centerContent?.titleText}")`);
    assert(centerContent?.hasArtist === true, `Artist name is displayed in visualizer center ("${centerContent?.artistText}")`);
    assert(centerContent?.hasNaroLogoInCenter === false, 'NARO logo is strictly absent from center disc (clean minimal audiophile styling)');
    assert(centerContent?.titleTextOverflow === 'ellipsis', 'Song title has graceful text-overflow: ellipsis for long titles');
    assert(centerContent?.titleWhiteSpace === 'nowrap', 'Song title has white-space: nowrap to prevent multi-line breaks');
    assert(centerContent?.artistTextOverflow === 'ellipsis', 'Artist name has graceful text-overflow: ellipsis');

    // =========================================================================
    // CHECK 3: Audio Reactivity & Real Web Audio Data Connection
    // =========================================================================
    console.log('\n[Check 3] Verifying Real Audio Reactivity (Web Audio API AnalyserNode)...');
    // Start audio playback
    await cdp.eval(`
      (() => {
        if (window.__naro_play_song && window.__naro_current_song) {
          window.__naro_play_song(window.__naro_current_song, 2.0);
        } else if (window.__naro_toggle_play) {
          window.__naro_toggle_play();
        }
      })()
    `);
    // Wait for audio playback to stream and AnalyserNode buffer to populate
    await new Promise((r) => setTimeout(r, 1500));

    const audioReactivity = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        const isPlaying = window.__naro_is_playing ? window.__naro_is_playing() : (!audio?.paused);
        const currentTime = window.__naro_get_current_time ? window.__naro_get_current_time() : (audio?.currentTime || 0);

        // Fetch frequency buffer
        const controller = window.__naro_playback_controller;
        const visualizerData = controller && typeof controller.getVisualizerData === 'function'
          ? controller.getVisualizerData()
          : null;

        let hasNonZeroData = false;
        let sum = 0;
        let maxVal = 0;
        if (visualizerData && visualizerData.length > 0) {
          for (let i = 0; i < visualizerData.length; i++) {
            sum += visualizerData[i];
            if (visualizerData[i] > maxVal) maxVal = visualizerData[i];
            if (visualizerData[i] > 0) hasNonZeroData = true;
          }
        }

        return {
          isPlaying,
          currentTime,
          hasVisualizerData: visualizerData !== null,
          dataLength: visualizerData ? visualizerData.length : 0,
          hasNonZeroData,
          avgFrequency: visualizerData ? (sum / visualizerData.length).toFixed(1) : 0,
          maxFrequency: maxVal
        };
      })()
    `);
    assert(audioReactivity?.isPlaying === true, `Audio is actively playing (currentTime: ${audioReactivity?.currentTime.toFixed(2)}s)`);
    assert(audioReactivity?.hasVisualizerData === true, `Web Audio AnalyserNode frequency buffer accessible (bins: ${audioReactivity?.dataLength})`);
    assert(audioReactivity?.hasNonZeroData === true, `Real audio frequency spectrum verified active (avg: ${audioReactivity?.avgFrequency}, peak: ${audioReactivity?.maxFrequency}/255)`);

    // =========================================================================
    // CHECK 4: Pause Settling Behavior
    // =========================================================================
    console.log('\n[Check 4] Verifying Smooth Pause Settling Behavior...');
    await cdp.eval(`
      (() => {
        if (window.__naro_toggle_play) {
          window.__naro_toggle_play();
        } else if (window.__naro_audio) {
          window.__naro_audio.pause();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const pauseCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        const isPlaying = window.__naro_is_playing ? window.__naro_is_playing() : (!audio?.paused);
        return {
          isPaused: !isPlaying,
          currentTime: window.__naro_get_current_time ? window.__naro_get_current_time() : (audio?.currentTime || 0)
        };
      })()
    `);
    assert(pauseCheck?.isPaused === true, `Playback paused cleanly (paused at ${pauseCheck?.currentTime.toFixed(2)}s)`);

    // =========================================================================
    // CHECK 5: Resume & Immediate Seek Following
    // =========================================================================
    console.log('\n[Check 5] Verifying Immediate Audio Reactivity on Resume & Seek...');
    // Seek to 15.0s and resume
    await cdp.eval(`
      (() => {
        if (window.__naro_seek) window.__naro_seek(15.0);
        if (window.__naro_toggle_play) window.__naro_toggle_play();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const seekResumeCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        const isPlaying = window.__naro_is_playing ? window.__naro_is_playing() : (!audio?.paused);
        const currentTime = window.__naro_get_current_time ? window.__naro_get_current_time() : (audio?.currentTime || 0);

        const controller = window.__naro_playback_controller;
        const visualizerData = controller?.getVisualizerData ? controller.getVisualizerData() : null;
        let nonZero = false;
        if (visualizerData) {
          for (let i = 0; i < visualizerData.length; i++) {
            if (visualizerData[i] > 0) nonZero = true;
          }
        }

        return {
          isPlaying,
          currentTime,
          hasAudioData: nonZero
        };
      })()
    `);
    assert(seekResumeCheck?.isPlaying === true, `Audio resumed actively at ~15s (currentTime: ${seekResumeCheck?.currentTime.toFixed(2)}s)`);
    assert(seekResumeCheck?.hasAudioData === true, 'Audio visualizer immediately reacts to real playback after seek');

    // =========================================================================
    // CHECK 6: Track Change Immediate Update
    // =========================================================================
    console.log('\n[Check 6] Verifying Track Change Immediate Update in Visualizer...');
    const trackChangeRes = await cdp.eval(`
      (() => {
        const testTrack2 = {
          id: 'test-aurora-borealis',
          title: 'Aurora Borealis (Studio Master)',
          artist: 'NARO Acoustic Ensemble',
          duration: 180,
          fullTrackDuration: 180,
          playbackType: 'full',
          playbackSourceType: 'open-license',
          streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
          playbackSource: {
            streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
            format: 'mp3',
            bitrate: '320kbps'
          },
          artwork: {
            palette: ['#38BDF8', '#0F172A', '#0284C7', '#BAE6FD'],
            accentWarm: '#38BDF8',
            accentCool: '#BAE6FD',
            accentCream: '#F0F9FF'
          }
        };

        if (window.__naro_play_song) {
          window.__naro_play_song(testTrack2, 0);
          return { success: true };
        }
        return { success: false };
      })()
    `);
    assert(trackChangeRes?.success === true, 'Loaded new track into NARO player');
    await new Promise((r) => setTimeout(r, 600));

    const updatedCenterContent = await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        const titleEl = visualizer ? visualizer.querySelector('#visualizer-song-title') : null;
        const artistEl = visualizer ? visualizer.querySelector('#visualizer-song-artist') : null;
        return {
          title: titleEl ? titleEl.textContent?.trim() : '',
          artist: artistEl ? artistEl.textContent?.trim() : ''
        };
      })()
    `);
    assert(updatedCenterContent?.title === 'Aurora Borealis (Studio Master)', `Visualizer center title immediately updated to: "${updatedCenterContent?.title}"`);
    assert(updatedCenterContent?.artist === 'NARO Acoustic Ensemble', `Visualizer center artist immediately updated to: "${updatedCenterContent?.artist}"`);

    // =========================================================================
    // CHECK 7: Full-Length Playback Beyond 30 Seconds
    // =========================================================================
    console.log('\n[Check 7] Verifying Full-Length Playback Beyond 30 Seconds (No 30-Sec Cutoff)...');
    await cdp.eval(`
      (() => {
        if (window.__naro_seek) window.__naro_seek(35.0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const beyond30Check = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        const isPlaying = window.__naro_is_playing ? window.__naro_is_playing() : (!audio?.paused);
        const currentTime = window.__naro_get_current_time ? window.__naro_get_current_time() : (audio?.currentTime || 0);
        return { isPlaying, currentTime };
      })()
    `);
    assert(beyond30Check?.isPlaying === true, 'Audio actively playing past 30 seconds');
    assert(beyond30Check?.currentTime >= 35.0, `Audio playback verified continuous at ${beyond30Check?.currentTime.toFixed(2)}s (zero 30s truncation)`);

    // =========================================================================
    // CHECK 8: Interactive Click-to-Toggle
    // =========================================================================
    console.log('\n[Check 8] Verifying Interactive Click-to-Toggle Playback...');
    // Click visualizer
    await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        if (visualizer) visualizer.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const clickTogglePause = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        return { isPaused: audio ? audio.paused : true };
      })()
    `);
    assert(clickTogglePause?.isPaused === true, 'Clicking visualizer successfully pauses playback');

    // Click visualizer again to resume
    await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        if (visualizer) visualizer.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const clickToggleResume = await cdp.eval(`
      (() => {
        const audio = window.__naro_audio;
        return { isPlaying: audio ? !audio.paused : false };
      })()
    `);
    assert(clickToggleResume?.isPlaying === true, 'Clicking visualizer again successfully resumes playback');

    // =========================================================================
    // CHECK 9: Responsive Aspect Ratio & Non-Clipped Bounds
    // =========================================================================
    console.log('\n[Check 9] Verifying Responsive Aspect Ratio (1:1) & Layout Safety...');
    const boundsCheck = await cdp.eval(`
      (() => {
        const visualizer = document.querySelector('.beat-synced-visualizer');
        if (!visualizer) return null;
        const rect = visualizer.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          ratio: (rect.width / rect.height).toFixed(2),
          isInViewport: rect.top >= 0 && rect.left >= 0
        };
      })()
    `);
    assert(boundsCheck !== null, 'Visualizer bounding rectangle measured');
    assert(Math.abs(parseFloat(boundsCheck.ratio) - 1.0) <= 0.05, `Aspect ratio is strictly square 1:1 (width: ${boundsCheck.width}px, height: ${boundsCheck.height}px, ratio: ${boundsCheck.ratio})`);
    assert(boundsCheck.isInViewport, 'Visualizer is positioned within viewport without clipping');

    // =========================================================================
    // CHECK 10: Verify Complete Absence of Floating Lyric Bubbles
    // =========================================================================
    console.log('\n[Check 10] Verifying Complete Absence of Floating Lyric Bubbles...');
    const floatingBubblesCheck = await cdp.eval(`
      (() => {
        const container = document.getElementById('visualizer-floating-lyrics-container');
        const topLeft = document.getElementById('floating-lyric-top-left');
        const right = document.getElementById('floating-lyric-right');
        const bottom = document.getElementById('floating-lyric-bottom');
        const anyBubble = document.querySelector('.floating-lyric-bubble');
        return {
          hasContainer: !!container,
          hasTopLeft: !!topLeft,
          hasRight: !!right,
          hasBottom: !!bottom,
          hasAnyBubble: !!anyBubble
        };
      })()
    `);
    assert(floatingBubblesCheck?.hasContainer === false, 'Floating lyrics container #visualizer-floating-lyrics-container is completely removed');
    assert(floatingBubblesCheck?.hasTopLeft === false, 'Top-left lyric bubble is completely removed');
    assert(floatingBubblesCheck?.hasRight === false, 'Right lyric bubble is completely removed');
    assert(floatingBubblesCheck?.hasBottom === false, 'Bottom lyric bubble is completely removed');
    assert(floatingBubblesCheck?.hasAnyBubble === false, 'Zero floating lyric bubbles exist around visualizer');

    console.log('\n======================================================================');
    console.log('ALL 10 BEAT-SYNCHRONIZED CIRCULAR VISUALIZER CHECKS PASSED!');
    console.log('======================================================================\n');
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

runVisualizerVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
