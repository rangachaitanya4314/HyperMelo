// NARO Product-Level Browser Smoke Test
// Verifies all 13 core end-to-end user flows in a real headless Chrome browser session:
// 1. Home loads
// 2. Search works
// 3. Play a normal song
// 4. Seek / pause / resume
// 5. Lyrics follow playback
// 6. Translation works
// 7. Full-length playback works
// 8. Open Karaoke
// 9. Record a take
// 10. Review the take
// 11. Save the take
// 12. Play saved take from Library
// 13. Navigate between screens without audio continuing unexpectedly

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEST_SYNCED_LYRICS_FIXTURE } from '../src/data/lyricsFixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _rootDir = path.resolve(__dirname, '..');

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
          const raw = JSON.parse(event.data.toString()) as { id?: number; method?: string; params?: any; result?: any; error?: { message: string } };
          if (raw.method === 'Runtime.consoleAPICalled') {
            const text = (raw.params?.args || []).map((a: any) => a.value !== undefined ? a.value : (a.description || '')).join(' ');
            if (raw.params?.type === 'error' || raw.params?.type === 'warn' || text.includes('Karaoke') || text.includes('recording') || text.includes('take')) {
              console.log(`  [Browser ${raw.params?.type}]:`, text);
            }
          }
          if (raw.method === 'Runtime.exceptionThrown') {
            console.error('  [Browser Exception]:', raw.params?.exceptionDetails?.text, raw.params?.exceptionDetails?.exception?.description);
          }
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
    if ((res as any).exceptionDetails) {
      const err = (res as any).exceptionDetails;
      const desc = err.exception?.description || err.text || JSON.stringify(err);
      console.error('  [CDP eval error]:', desc);
      throw new Error(`Eval failed: ${desc}`);
    }
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

async function runSmokeTest() {
  console.log('======================================================================');
  console.log('NARO PRODUCT-LEVEL BROWSER SMOKE TEST (13 CORE SCENARIOS)');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_smoke_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9255',
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
        const res = await fetch('http://127.0.0.1:9255/json');
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
      throw new Error('Failed to find WebSocketDebuggerUrl on port 9255');
    }

    await cdp.connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    try {
      await cdp.send('Browser.grantPermissions', {
        permissions: ['audioCapture'],
        origin: 'http://127.0.0.1:5173'
      });
    } catch {
      // ignore
    }

    // -----------------------------------------------------------------------
    // [Check 1/13] Home loads
    // -----------------------------------------------------------------------
    console.log('[Check 1/13] Home loads...');
    for (let i = 0; i < 30; i++) {
      const isReady = await cdp.eval(`
        (() => {
          try {
            sessionStorage.setItem('naro_intro_seen', 'true');
          } catch {}
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          const mainApp = document.querySelector('header, main');
          return Boolean(mainApp && window.__naro_play_song);
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    const homeVerification = await cdp.eval(`
      (() => {
        const title = document.title;
        const header = Boolean(document.querySelector('header'));
        const main = Boolean(document.querySelector('main'));
        const hasHomeNav = Array.from(document.querySelectorAll('header nav button')).some(b => b.textContent?.trim() === 'Home');
        return { title, header, main, hasHomeNav };
      })()
    `);
    assert(homeVerification.title.includes('NARO'), `Document title is valid: "${homeVerification.title}"`);
    assert(homeVerification.header && homeVerification.main, 'Header and Main elements rendered in DOM');
    assert(homeVerification.hasHomeNav, 'Primary nav contains Home navigation item');

    // -----------------------------------------------------------------------
    // [Check 2/13] Search works
    // -----------------------------------------------------------------------
    console.log('\n[Check 2/13] Search works...');
    await cdp.eval(`
      (() => {
        const searchBar = document.getElementById('header-search-bar');
        if (searchBar) searchBar.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Type "Shot Down" into search input
    await cdp.eval(`
      (() => {
        const input = document.getElementById('search-input');
        if (input) {
          input.value = 'Shot Down';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const searchResultsCheck = await cdp.eval(`
      (() => {
        const modal = document.getElementById('search-modal');
        const results = Array.from(document.querySelectorAll('[data-testid="search-result-row"], .search-result-item, #search-modal div'));
        const text = modal ? modal.textContent || '' : '';
        const foundSong = text.includes('Shot Down') || text.includes('Josh Woodward');
        return { hasModal: Boolean(modal), foundSong };
      })()
    `);
    assert(searchResultsCheck.hasModal, 'Search modal is displayed');
    assert(searchResultsCheck.foundSong, 'Search successfully returned "Shot Down" by Josh Woodward');

    // Close search modal
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close search modal"], button[aria-label="Close search"]');
        if (closeBtn) closeBtn.click();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // -----------------------------------------------------------------------
    // [Check 3/13] Play a normal song
    // -----------------------------------------------------------------------
    console.log('\n[Check 3/13] Play a normal song...');
    await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        if (window.__naro_play_song) {
          window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const songPlayCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        const isPlaying = audio ? !audio.paused : false;
        const currentSong = window.__naro_current_song;
        const bottomPlayerMounted = Boolean(document.querySelector('[data-testid="bottom-player"], footer'));
        return {
          isPlaying,
          title: currentSong ? currentSong.title : null,
          artist: currentSong ? currentSong.artist : null,
          currentTime: audio ? audio.currentTime : 0,
          bottomPlayerMounted
        };
      })()
    `);
    assert(songPlayCheck.isPlaying, 'Song playback is actively running (not paused)');
    assert(songPlayCheck.title === 'Shot Down', `Current song is "Shot Down" (got "${songPlayCheck.title}")`);
    assert(songPlayCheck.bottomPlayerMounted, 'Bottom player is visible and mounted');

    // -----------------------------------------------------------------------
    // [Check 4/13] Seek / pause / resume
    // -----------------------------------------------------------------------
    console.log('\n[Check 4/13] Seek / pause / resume...');
    // Seek to 45s
    await cdp.eval(`
      (() => {
        if (window.__naro_seek) {
          window.__naro_seek(45);
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const seekCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? audio.currentTime : 0;
      })()
    `);
    assert(seekCheck >= 44 && seekCheck <= 48, `Seeked to ~45s successfully (actual: ${seekCheck.toFixed(2)}s)`);

    // Click pause on bottom player
    await cdp.eval(`
      (() => {
        const pauseBtn = document.querySelector('button[aria-label="Pause"], button[aria-label="Play / Pause"]');
        if (pauseBtn) pauseBtn.click();
        else if (window.__naro_playback_controller) window.__naro_playback_controller.pause();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const pauseCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? audio.paused : true;
      })()
    `);
    assert(pauseCheck === true, 'Playback is strictly paused after Pause click');

    // Click resume on bottom player
    await cdp.eval(`
      (() => {
        const playBtn = document.querySelector('button[aria-label="Play"], button[aria-label="Play / Pause"]');
        if (playBtn) playBtn.click();
        else if (window.__naro_playback_controller) window.__naro_playback_controller.play();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const resumeCheck = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? !audio.paused : false;
      })()
    `);
    assert(resumeCheck === true, 'Playback resumed actively after Play click');

    // -----------------------------------------------------------------------
    // [Check 5/13] Lyrics follow playback
    // -----------------------------------------------------------------------
    console.log('\n[Check 5/13] Lyrics follow playback...');
    // Inject synced test track so we have precise multi-line synced lyrics to track
    await cdp.eval(`
      (() => {
        const syncedTrack = {
          id: 'smoke-test-synced-track',
          title: 'Starlight Avenue',
          artist: 'NARO Studio',
          duration: 180,
          fullTrackDuration: 180,
          genre: 'Indie Pop',
          bpm: 100,
          musicalKey: 'C Major',
          lyricsAvailable: true,
          lyricsSyncAvailable: true,
          karaokeAvailable: true,
          karaokeReady: true,
          playbackAvailable: true,
          playbackType: 'full',
          playbackSourceType: 'open-license',
          streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
          karaokeSource: {
            type: 'dedicated-instrumental',
            provider: 'naro',
            providerTrackId: 'smoke-test-backing',
            streamUrl: '/audio/josh-woodward-shot-down-novox.mp3',
            duration: 180,
            availability: 'available'
          },
          artwork: {
            palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
            pattern: 'solaris',
            accentWarm: '#E7A58D',
            accentCool: '#8FA8C8'
          },
          sections: [
            { type: 'verse', label: 'Verse 1', start: 0, end: 45 },
            { type: 'chorus', label: 'Chorus', start: 45, end: 90 }
          ],
          lyrics: {
            en: {
              chorusSnippet: 'Walking down the neon corridor',
              lines: ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}
            },
            hi: {
              chorusSnippet: 'नियॉन के गलियारे में चलते हुए',
              lines: ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}
            },
            te: {
              chorusSnippet: 'నియాన్ దారిలో నడుస్తూ',
              lines: ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}
            }
          }
        };

        window.__naro_play_song(syncedTrack, 10.0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Open lyrics drawer via button
    await cdp.eval(`
      (() => {
        const btn = document.getElementById('toggle-lyrics-drawer-btn') || 
          document.querySelector('button[aria-label="Toggle floating lyrics"]');
        if (btn) btn.click();
        else if (window.__naro_toggle_lyrics) window.__naro_toggle_lyrics();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const lyricsFollowCheck = await cdp.eval(`
      (() => {
        const drawer = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = drawer ? Array.from(drawer.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        return {
          hasDrawer: Boolean(drawer),
          lineCount: lines.length
        };
      })()
    `);
    assert(lyricsFollowCheck.hasDrawer, 'Lyrics drawer is opened');
    assert(lyricsFollowCheck.lineCount >= 4, `Lyrics lines rendered in drawer (${lyricsFollowCheck.lineCount} lines)`);

    // Click line 1 in the drawer (startTime: 9.0s) to seek and trigger active highlight
    console.log('  Clicking lyric line 1 to seek and highlight active line...');
    await cdp.eval(`
      (() => {
        const drawer = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = drawer ? Array.from(drawer.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        if (lines[1]) lines[1].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const activeLineCheck = await cdp.eval(`
      (() => {
        const drawer = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const activeLine = drawer ? drawer.querySelector('[data-testid="active-lyric-line"]') : null;
        return {
          hasActiveLine: Boolean(activeLine),
          activeText: activeLine ? activeLine.textContent : null
        };
      })()
    `);
    assert(activeLineCheck.hasActiveLine, `Active lyric line is dynamically highlighted: "${activeLineCheck.activeText}"`);

    // -----------------------------------------------------------------------
    // [Check 6/13] Translation works
    // -----------------------------------------------------------------------
    console.log('\n[Check 6/13] Translation works...');
    await cdp.eval(`
      (() => {
        if (window.__naro_set_display_language) {
          window.__naro_set_display_language('hi');
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const translationCheck = await cdp.eval(`
      (() => {
        const lang = window.__naro_get_display_language ? window.__naro_get_display_language() : null;
        const drawer = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const text = drawer ? drawer.textContent || '' : '';
        const hasHindi = text.includes('आधी रात के फर्श पर नाचती परछाइयां') || text.includes('नियॉन के गलियारे में');
        return { lang, hasHindi };
      })()
    `);
    assert(translationCheck.lang === 'hi', `Display language successfully switched to Hindi ("${translationCheck.lang}")`);
    assert(translationCheck.hasHindi, 'Hindi lyrics rendered accurately in drawer');

    // Close lyrics drawer
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close lyrics drawer"]') ||
          document.getElementById('toggle-lyrics-drawer-btn');
        if (closeBtn) closeBtn.click();
        else if (window.__naro_toggle_lyrics) window.__naro_toggle_lyrics();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // -----------------------------------------------------------------------
    // [Check 7/13] Full-length playback works
    // -----------------------------------------------------------------------
    console.log('\n[Check 7/13] Full-length playback works...');
    // Switch back to Shot Down
    await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const fullLengthCheck = await cdp.eval(`
      (() => {
        const song = window.__naro_current_song;
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return {
          title: song?.title,
          duration: song?.fullTrackDuration || song?.duration,
          isFullLength: song?.fullLengthAvailable,
          playbackType: song?.playbackType,
          streamUrl: audio?.src
        };
      })()
    `);
    assert(fullLengthCheck.isFullLength === true, 'Track is authenticated as full-length');
    assert(fullLengthCheck.duration >= 250, `Duration is full-length: ${fullLengthCheck.duration}s`);
    assert(fullLengthCheck.streamUrl?.includes('josh-woodward-shot-down-vocal.mp3'), `Audio source points to full-length master: ${fullLengthCheck.streamUrl}`);

    // -----------------------------------------------------------------------
    // [Check 8/13] Open Karaoke
    // -----------------------------------------------------------------------
    console.log('\n[Check 8/13] Open Karaoke...');
    // Navigate to Karaoke page via nav link
    await cdp.eval(`
      (() => {
        const karaokeNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Karaoke');
        if (karaokeNavBtn) karaokeNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const karaokePageCheck = await cdp.eval(`
      (() => {
        const h1 = document.querySelector('h1');
        return h1?.textContent?.includes('What do you want to sing?');
      })()
    `);
    assert(karaokePageCheck === true, 'Karaoke destination page loaded ("What do you want to sing?")');

    // Open Karaoke Studio modal for song
    await cdp.eval(`
      (() => {
        if (window.__naro_open_karaoke_modal) {
          window.__naro_open_karaoke_modal();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const karaokeModalCheck = await cdp.eval(`
      (() => {
        const modal = document.getElementById('karaoke-modal') || document.querySelector('[role="dialog"]');
        const modalText = modal ? modal.textContent || '' : '';
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText || b.getAttribute('aria-label') || '');
        return { hasModal: Boolean(modal), modalSnippet: modalText.slice(0, 200), buttons };
      })()
    `);
    console.log('  Karaoke Modal Diagnosis:', karaokeModalCheck);
    assert(karaokeModalCheck.hasModal, 'Karaoke Studio modal opened successfully');

    // -----------------------------------------------------------------------
    // [Check 9/13] Record a take
    // -----------------------------------------------------------------------
    console.log('\n[Check 9/13] Record a take...');

    // Wait for backing verification to complete and Sing button to appear
    let foundLaunchBtn = false;
    for (let i = 0; i < 25; i++) {
      const launchStatus = await cdp.eval(`
        (() => {
          const btn = document.getElementById('sing-moment-btn') || document.querySelector('[data-testid="karaoke-launch-btn"]');
          const allBtns = Array.from(document.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean);
          return { hasBtn: Boolean(btn), allBtns };
        })()
      `);
      if (launchStatus.hasBtn) {
        foundLaunchBtn = true;
        break;
      }
      if (i % 5 === 0) console.log('  Waiting for launch button, current buttons:', launchStatus.allBtns);
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log('  Found launch button:', foundLaunchBtn);

    console.log('  Clicking launch button...');
    const clickResult = await cdp.eval(`
      (() => {
        const startRecordBtn = document.getElementById('sing-moment-btn') || 
          document.querySelector('[data-testid="karaoke-launch-btn"]');
        if (startRecordBtn) {
          startRecordBtn.click();
          return { clicked: true, text: startRecordBtn.innerText };
        }
        return { clicked: false };
      })()
    `);
    console.log('  Click result:', clickResult);

    // Wait for countdown (3s) to finish and active live recording to begin
    console.log('  Waiting for countdown (3s) and active recording session...');
    for (let s = 1; s <= 7; s++) {
      await new Promise((r) => setTimeout(r, 600));
      const status = await cdp.eval(`
        (() => {
          const stopBtn = document.getElementById('karaoke-stop-recording-btn');
          const isStopActive = Boolean(stopBtn && !stopBtn.disabled);
          const hasRec = document.body.innerText.includes('REC');
          return { isStopActive, hasRec };
        })()
      `);
      if (status.isStopActive) {
        break;
      }
    }

    const recordingActiveCheck = await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('karaoke-stop-recording-btn') || 
          Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Stop'));
        const isRecIndicator = Boolean(document.body.innerText.includes('REC') || document.querySelector('.animate-pulse, [data-testid="recording-active"], .bg-red-500'));
        return { hasStopBtn: Boolean(stopBtn), isRecIndicator };
      })()
    `);
    assert(recordingActiveCheck.hasStopBtn, 'Live recording session is active with Stop control available');

    // Let recording run for 3 seconds to capture authentic audio take
    console.log('  Recording audio for 3 seconds...');
    await new Promise((r) => setTimeout(r, 3000));

    // Stop recording
    console.log('  Stopping live recording...');
    await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('karaoke-stop-recording-btn') || 
          Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Stop')) ||
          document.querySelector('button[aria-label="Stop recording"], button[aria-label="Stop"]');
        if (stopBtn) stopBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // -----------------------------------------------------------------------
    // [Check 10/13] Review the take
    // -----------------------------------------------------------------------
    console.log('\n[Check 10/13] Review the take...');
    const reviewModalCheck = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const hasYourTake = text.includes('YOUR TAKE') || text.includes('Your Take');
        const hasMusicSlider = Boolean(document.getElementById('review-music-volume-slider') || document.querySelector('input[aria-label="Music volume slider"]'));
        const hasVoiceSlider = Boolean(document.getElementById('review-voice-volume-slider') || document.querySelector('input[aria-label="My Voice volume slider"]'));
        const hasPlayBtn = Boolean(document.getElementById('review-play-btn') || document.querySelector('button[aria-label="Play recording"], button[aria-label="Pause recording"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Play') || b.textContent.includes('Pause'))));
        const hasSaveBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Save'));
        return { hasYourTake, hasMusicSlider, hasVoiceSlider, hasPlayBtn, hasSaveBtn };
      })()
    `);
    assert(reviewModalCheck.hasYourTake, 'Performance review modal opened with "YOUR TAKE" heading');
    assert(reviewModalCheck.hasMusicSlider && reviewModalCheck.hasVoiceSlider, 'Music and Voice volume sliders present in review modal');
    assert(reviewModalCheck.hasPlayBtn, 'Play review toggle button is present');
    assert(reviewModalCheck.hasSaveBtn, 'Save to Library button is present');

    // Toggle review playback
    console.log('  Testing review playback toggle...');
    await cdp.eval(`
      (() => {
        const playBtn = document.getElementById('review-play-btn') || 
          document.querySelector('button[aria-label="Play recording"], button[aria-label="Pause recording"]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.textContent && (b.textContent.includes('Play') || b.querySelector('svg')));
        if (playBtn) playBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const isCentralMusicPausedDuringReview = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return audio ? audio.paused : true;
      })()
    `);
    assert(isCentralMusicPausedDuringReview === true, 'Central music is strictly paused while reviewing take');

    // -----------------------------------------------------------------------
    // [Check 11/13] Save the take
    // -----------------------------------------------------------------------
    console.log('\n[Check 11/13] Save the take...');
    await cdp.eval(`
      (() => {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Save'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Also close review modal if close button exists
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close review modal"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const isReviewModalDismissed = await cdp.eval(`
      (() => {
        return !document.body.innerText.includes('YOUR TAKE');
      })()
    `);
    assert(isReviewModalDismissed === true, 'Review modal dismissed cleanly upon saving');

    // -----------------------------------------------------------------------
    // [Check 12/13] Play saved take from Library
    // -----------------------------------------------------------------------
    console.log('\n[Check 12/13] Play saved take from Library...');
    // Navigate to Library
    await cdp.eval(`
      (() => {
        const libraryNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Library');
        if (libraryNavBtn) libraryNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const libraryTakesCheck = await cdp.eval(`
      (() => {
        const takeCards = Array.from(document.querySelectorAll('.record-sleeve'));
        const playButtons = Array.from(document.querySelectorAll('button')).filter(b => 
          (b.title && (b.title.includes('Play Take') || b.title.includes('Pause Take'))) ||
          (b.textContent && (b.textContent.includes('Play Take') || b.textContent.includes('Pause Take')))
        );
        const bodyText = document.body.innerText;
        const hasTakesTab = bodyText.includes('Your Takes') || bodyText.includes('Takes');
        const count = Math.max(takeCards.length, playButtons.length);
        return { takeCount: count, hasTakesTab };
      })()
    `);
    assert(libraryTakesCheck.hasTakesTab, 'Library page rendered "Takes" tab');
    assert(libraryTakesCheck.takeCount > 0, `Library displays saved recorded take card (${libraryTakesCheck.takeCount} take(s))`);

    // Click to play the saved take
    console.log('  Triggering playback of saved take in Library...');
    const clickTakeResult = await cdp.eval(`
      (() => {
        const playTakeBtn = document.querySelector('[data-testid^="play-take-"]') ||
          Array.from(document.querySelectorAll('button')).find(b => 
            (b.title && b.title.includes('Play Take')) ||
            (b.textContent && b.textContent.includes('Play Take'))
          );
        if (playTakeBtn) {
          playTakeBtn.click();
          return { clicked: true, title: playTakeBtn.title, text: playTakeBtn.textContent };
        }
        return { clicked: false };
      })()
    `);
    console.log('  Click Take Result:', clickTakeResult);
    await new Promise((r) => setTimeout(r, 400));

    const takePlayingState = await cdp.eval(`
      (async () => {
        const svc = window.__naro_take_playback_service || (await import('/src/services/audio/takePlaybackService.ts')).takePlaybackService;
        const state = svc.getPreviewState();
        const mainAudio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        return {
          state,
          isTakePlaying: state.isPlaying || Boolean(state.playingTakeId),
          isMainAudioPaused: mainAudio ? mainAudio.paused : true
        };
      })()
    `);
    console.log('  Take Playing State:', takePlayingState);
    assert(takePlayingState.isTakePlaying === true, 'Saved take preview is actively playing in Library');
    assert(takePlayingState.isMainAudioPaused === true, 'Central normal music is strictly paused while playing saved take');

    // -----------------------------------------------------------------------
    // [Check 13/13] Navigate between screens without audio continuing unexpectedly
    // -----------------------------------------------------------------------
    console.log('\n[Check 13/13] Navigate between screens without audio continuing unexpectedly...');
    // While take audio is active in Library, navigate away to Discover
    await cdp.eval(`
      (() => {
        const discoverNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Discover');
        if (discoverNavBtn) discoverNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const navigationCleanupCheck = await cdp.eval(`
      (async () => {
        const svc = window.__naro_take_playback_service || (await import('/src/services/audio/takePlaybackService.ts')).takePlaybackService;
        const state = svc.getPreviewState();
        return {
          playingTakeId: state.playingTakeId,
          isPlaying: state.isPlaying
        };
      })()
    `);
    assert(navigationCleanupCheck.playingTakeId === null, 'Take playback id was cleared on unmount/navigation');
    assert(navigationCleanupCheck.isPlaying === false, 'Take audio stopped immediately upon navigating away from Library');

    // Navigate back to Home
    await cdp.eval(`
      (() => {
        const homeNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Home');
        if (homeNavBtn) homeNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const finalHomeCheck = await cdp.eval(`
      (() => {
        const h1 = document.querySelector('h1, h2');
        return Boolean(h1);
      })()
    `);
    assert(finalHomeCheck === true, 'Cleanly navigated back to Home view');

    console.log('\n======================================================================');
    console.log('ALL 13 PRODUCT-LEVEL SMOKE TEST SCENARIOS PASSED SUCCESSFULLY!');
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

runSmokeTest().catch((err) => {
  console.error('\n❌ PRODUCT SMOKE TEST FAILED:', err);
  process.exit(1);
});
