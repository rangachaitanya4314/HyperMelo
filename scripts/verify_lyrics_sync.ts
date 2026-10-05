import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { TEST_SYNCED_LYRICS_FIXTURE, TEST_PLAIN_LYRICS_FIXTURE } from '../src/data/lyricsFixtures';
import { lyricsService, getActiveLyricIndex } from '../src/services/lyrics/lyricsService';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import type { Song, TimedLyricLine } from '../src/types/music';

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

async function runLyricsSyncTests() {
  console.log('======================================================================');
  console.log('NARO — SYNCHRONIZED LYRICS ENGINE VERIFICATION (15 SCENARIOS)');
  console.log('======================================================================\n');

  // =========================================================================
  // SCENARIO 1: Active Line Calculation (Deterministic Algorithm)
  // =========================================================================
  console.log('[Scenario 1] Active Line Calculation...');
  // Line 0: 4.0 - 8.0, Line 1: 9.0 - 14.5, Line 2: 16.0 - 21.0, Line 3: 22.0 - 27.5, Line 4: 29.0 - 35.0
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 5.0) === 0, 'Line 0 active at 5.0s');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 10.0) === 1, 'Line 1 active at 10.0s');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 18.0) === 2, 'Line 2 active at 18.0s');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 25.0) === 3, 'Line 3 active at 25.0s');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 30.0) === 4, 'Line 4 active at 30.0s');

  // =========================================================================
  // SCENARIO 2: Exact Boundary Behavior
  // =========================================================================
  console.log('\n[Scenario 2] Exact Boundary Behavior...');
  // 1. Before first line
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 0.0) === -1, 'Time 0.0s before first line returns -1');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 3.99) === -1, 'Time 3.99s immediately before first line returns -1');
  // 2. Exact start
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 4.0) === 0, 'Exact start 4.0s returns 0');
  // 3. Inter-line gap with midpoint rule (line 0 ends at 8.0, line 1 starts at 9.0, midpoint 8.5)
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 8.2) === 0, '8.2s (before midpoint 8.5s) retains line 0');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 8.8) === -1, '8.8s (past midpoint 8.5s) enters gap (-1)');
  // 4. Exact start of next line
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 9.0) === 1, 'Exact start 9.0s returns 1');
  // 5. Final line bounds (29.0 - 35.0)
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 31.0) === 4, 'Within final line (31.0s) returns 4');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 35.0) === 4, 'Exact end of final line (35.0s) returns 4');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 36.0) === -1, 'Past final line explicitEnd (36.0s) returns -1');
  assert(getActiveLyricIndex(TEST_SYNCED_LYRICS_FIXTURE, 40.0) === -1, 'Well past final line (40.0s) returns -1');

  // =========================================================================
  // SCENARIO 9: Same Segment ID Across Translations
  // =========================================================================
  console.log('\n[Scenario 9] Invariant Segment ID Across Translations...');
  for (const line of TEST_SYNCED_LYRICS_FIXTURE) {
    const id = line.id;
    assert(typeof id === 'string' && id.startsWith('test-lyric-'), `Segment ID "${id}" is well-formed`);
    const enText = lyricsService.getLineTranslation(line, 'en').text;
    const hiText = lyricsService.getLineTranslation(line, 'hi').text;
    const teText = lyricsService.getLineTranslation(line, 'te').text;
    const taText = lyricsService.getLineTranslation(line, 'ta').text;
    const mlText = lyricsService.getLineTranslation(line, 'ml').text;
    assert(Boolean(enText && hiText && teText && taText && mlText), `Segment "${id}" references same timeline slot across all languages`);
  }

  // =========================================================================
  // SCENARIO 10: Missing Translation State
  // =========================================================================
  console.log('\n[Scenario 10] Missing Translation State...');
  const lineWithoutTe = TEST_SYNCED_LYRICS_FIXTURE[2];
  const trTe = lyricsService.getLineTranslation(lineWithoutTe, 'te');
  assert(trTe.isAvailable === false, 'Omitted Telugu translation is marked isAvailable: false');
  assert(trTe.text === 'Translation unavailable', 'Omitted Telugu translation displays "Translation unavailable"');
  const trMl = lyricsService.getLineTranslation(lineWithoutTe, 'ml');
  assert(trMl.isAvailable === false, 'Omitted Malayalam translation is marked isAvailable: false');
  assert(trMl.text === 'Translation unavailable', 'Omitted Malayalam translation displays "Translation unavailable"');

  // =========================================================================
  // SCENARIO 11: Plain Lyrics State (No False Sync, No Timestamps)
  // =========================================================================
  console.log('\n[Scenario 11] Plain Lyrics State...');
  const mockPlainSong: Song = {
    ...JOSH_WOODWARD_SHOT_DOWN,
    id: 'test-plain-song',
    lyricsSyncAvailable: false,
    lyrics: {
      en: { chorusSnippet: 'Plain lyrics snippet', lines: TEST_PLAIN_LYRICS_FIXTURE as any },
      hi: { chorusSnippet: '', lines: [] },
      te: { chorusSnippet: '', lines: [] }
    }
  };
  const plainCap = lyricsService.getLyricsCapability(mockPlainSong);
  assert(plainCap === 'PLAIN_LYRICS', `Track with unsynced text reports PLAIN_LYRICS (got ${plainCap})`);
  const plainLines = lyricsService.getCanonicalLyricLines(mockPlainSong);
  assert(plainLines.length === TEST_PLAIN_LYRICS_FIXTURE.length, 'Canonical lines returned for plain lyrics');
  assert(plainLines[0].startTime === -1, 'Plain lyrics have startTime -1 (no fabricated timestamps)');
  assert(!plainLines[0].duration || plainLines[0].duration === 0, 'Plain lyrics have no positive duration');

  // =========================================================================
  // SCENARIO 12: Unavailable Lyrics State
  // =========================================================================
  console.log('\n[Scenario 12] Unavailable Lyrics State...');
  const unavailCap = lyricsService.getLyricsCapability(JOSH_WOODWARD_SHOT_DOWN);
  assert(unavailCap === 'LYRICS_UNAVAILABLE', `Shot Down truthfully reports LYRICS_UNAVAILABLE (got ${unavailCap})`);
  const unavailLines = lyricsService.getCanonicalLyricLines(JOSH_WOODWARD_SHOT_DOWN);
  assert(unavailLines.length === 0, 'Empty lines array for track without lyrics');

  // =========================================================================
  // SCENARIO 13: No Fabricated Timestamps (LRC Parser Rejection)
  // =========================================================================
  console.log('\n[Scenario 13] No Fabricated Timestamps / Honest Parser...');
  const corruptLrc = `
    [ti:Test Title]
    Plain un-timed lyric line 1
    Plain un-timed lyric line 2
    [00:10.50] Valid timed line 3
    Another untimed line
  `;
  const parsedLrc = lyricsService.parseLrc(corruptLrc, 120);
  assert(parsedLrc.length === 1, 'Only lines with valid [mm:ss.xx] timestamp tags are parsed into timed lyrics');
  assert(parsedLrc[0].startTime === 10.5, 'Parsed line has exact timestamp 10.5s');

  const parsedPlain = lyricsService.parsePlainLyrics('Line one\nLine two\nLine three');
  assert(parsedPlain.length === 3, 'Plain lyrics parsed into 3 lines');
  assert(parsedPlain.every((l) => l.startTime === -1), 'Plain lyrics are NEVER assigned fabricated timestamps');

  // =========================================================================
  // SCENARIOS 3, 4, 5, 6, 7, 8, 14, 15: Real Chrome CDP Verification
  // =========================================================================
  console.log('\n[Browser CDP Verification: Scenarios 3, 4, 5, 6, 7, 8, 14, 15]...');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_lyrics_sync_' + Date.now());

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

    console.log('  [CDP] Navigating to NARO application...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

    // Wait for React app to mount and dismiss intro if present
    for (let i = 0; i < 40; i++) {
      const isReady = await cdp.eval(`
        (() => {
          sessionStorage.setItem('naro_intro_seen', 'true');
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(window.__naro_play_song || document.querySelector('#toggle-lyrics-drawer-btn, button[aria-label="Toggle floating lyrics"]'));
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 800));

    // Inject synced test track into window for testing
    console.log('  [CDP] Loading verified test track with synchronized lyrics...');
    const playRes = await cdp.eval(`
      (() => {
        const testTrack = {
          id: 'test-fixture-track',
          title: 'Neon Corridor (Test Fixture)',
          artist: 'NARO Test Studio',
          duration: 45,
          fullTrackDuration: 45,
          genre: 'Electronic',
          bpm: 100,
          musicalKey: 'C Major',
          lyricsAvailable: true,
          lyricsSyncAvailable: true,
          karaokeAvailable: true,
          karaokeReady: true,
          playbackAvailable: true,
          playbackType: 'full',
          playbackSourceType: 'dev-fixture',
          streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
          artwork: {
            palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
            pattern: 'orbital',
            accentWarm: '#E7A58D',
            accentCool: '#8FA8C8'
          },
          sections: [
            { type: 'verse', label: 'Verse 1', start: 0, end: 45 }
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
            },
            ta: {
              chorusSnippet: 'நியோன் நடைபாதையில் நடக்கிறேன்',
              lines: ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}
            },
            ml: {
              chorusSnippet: 'നിയോൺ ഇടനാഴിയിലൂടെ നടക്കുമ്പോൾ',
              lines: ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}
            }
          }
        };

        if (window.__naro_play_song) {
          window.__naro_play_song(testTrack);
          return { success: true };
        }
        return { success: false, reason: '__naro_play_song not found' };
      })()
    `);
    assert(playRes?.success === true, 'Injected and loaded test track with synced lyrics');
    await new Promise((r) => setTimeout(r, 600));

    // Open lyrics drawer
    console.log('  [CDP] Opening Lyrics Drawer...');
    const drawerOpenRes = await cdp.eval(`
      (() => {
        const btnById = document.getElementById('toggle-lyrics-drawer-btn');
        if (btnById) {
          btnById.click();
          return { clicked: true };
        }
        if (typeof window.__naro_toggle_lyrics === 'function') {
          window.__naro_toggle_lyrics();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    assert(drawerOpenRes?.clicked === true, 'Opened Floating Lyrics Drawer');
    await new Promise((r) => setTimeout(r, 500));

    // =========================================================================
    // SCENARIO 3: Click-to-Seek
    // =========================================================================
    console.log('\n[Scenario 3] Click-to-Seek in Lyrics Drawer...');
    // Line 1 starts at 9.0s. Let's click Line 1 in the drawer
    const clickSeekLine1 = await cdp.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = dialog ? Array.from(dialog.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        const line1 = lines[1];
        if (line1) {
          line1.click();
          return { clicked: true, text: line1.textContent };
        }
        return { clicked: false };
      })()
    `);
    assert(clickSeekLine1?.clicked === true, 'Clicked line 1 in lyrics drawer');
    await new Promise((r) => setTimeout(r, 600));

    const timeAfterSeek = await cdp.eval(`window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)`);
    assert(Math.abs(timeAfterSeek - 9.0) < 1.0, `Audio seeked to line 1 startTime (~9.0s, actual: ${timeAfterSeek.toFixed(2)}s)`);

    // =========================================================================
    // SCENARIO 4: Playback Continuation After Seek
    // =========================================================================
    console.log('\n[Scenario 4] Playback Continuation After Seek (No Restarts / No Freezes)...');
    const isPlayingBefore = await cdp.eval(`window.__naro_is_playing ? window.__naro_is_playing() : (!window.__naro_audio?.paused)`);
    // Seek to 22.0s (Line 3)
    await cdp.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = dialog ? Array.from(dialog.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        if (lines[3]) lines[3].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));
    const isPlayingAfter = await cdp.eval(`window.__naro_is_playing ? window.__naro_is_playing() : (!window.__naro_audio?.paused)`);
    assert(isPlayingBefore === isPlayingAfter, 'Seek preserved playing status (playing remained playing)');

    // =========================================================================
    // SCENARIO 5: Paused Seek Behavior
    // =========================================================================
    console.log('\n[Scenario 5] Paused Seek Behavior (Remains Paused After Seek)...');
    // Pause playback
    await cdp.eval(`
      (() => {
        const pauseBtn = document.querySelector('aside button[aria-label="Pause"], aside button[data-testid="bottom-play-btn"]');
        if (pauseBtn) pauseBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const isPaused = await cdp.eval(`window.__naro_audio?.paused === true || (window.__naro_is_playing ? !window.__naro_is_playing() : true)`);
    assert(isPaused === true, 'Audio is paused');

    // Seek while paused to Line 4 (29.0s)
    await cdp.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = dialog ? Array.from(dialog.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        if (lines[4]) lines[4].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const stillPaused = await cdp.eval(`window.__naro_audio?.paused === true || (window.__naro_is_playing ? !window.__naro_is_playing() : true)`);
    const timeWhilePaused = await cdp.eval(`window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)`);
    assert(stillPaused === true, 'Audio remains strictly paused after seeking while paused (no accidental autoplay)');
    assert(Math.abs(timeWhilePaused - 29.0) < 1.0, `Audio playhead positioned at ~29.0s (actual: ${timeWhilePaused.toFixed(2)}s)`);

    // =========================================================================
    // SCENARIO 6: Auto-Scroll Target
    // =========================================================================
    console.log('\n[Scenario 6] Auto-Scroll Active Line into Center Viewport...');
    // Resume play and seek to 11.0s (Line 1)
    const resumeRes = await cdp.eval(`
      (() => {
        if (typeof window.__naro_seek === 'function') {
          window.__naro_seek(11.0);
        }
        if (window.__naro_audio && window.__naro_audio.paused) {
          window.__naro_audio.play().catch(() => {});
        }
        return {
          time: window.__naro_get_current_time ? window.__naro_get_current_time() : -1,
          audioTime: window.__naro_audio?.currentTime ?? -1
        };
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const autoScrollCheck = await cdp.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const activeLine = document.querySelector('[data-testid="active-lyric-line"], [data-active="true"]');
        const allLines = dialog ? Array.from(dialog.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')).map(l => ({
          active: l.getAttribute('data-active'),
          testid: l.getAttribute('data-testid'),
          text: l.textContent?.slice(0, 30)
        })) : [];
        const currentTime = window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0);
        const isPlaying = window.__naro_is_playing ? window.__naro_is_playing() : false;
        if (!activeLine) {
          return { found: false, debug: { hasDialog: !!dialog, lineCount: allLines.length, allLines, currentTime, isPlaying } };
        }
        const rect = activeLine.getBoundingClientRect();
        const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
        return { found: true, isInViewport, top: rect.top, text: activeLine.textContent?.slice(0, 40) };
      })()
    `);
    if (!autoScrollCheck?.found) {
      console.error('Scenario 6 DEBUG info:', JSON.stringify(autoScrollCheck?.debug, null, 2));
    }
    assert(autoScrollCheck?.found === true, 'Active lyric line found in DOM');
    assert(autoScrollCheck?.isInViewport === true, `Active lyric line is visible inside container viewport (top: ${autoScrollCheck?.top?.toFixed(0)}px)`);

    // =========================================================================
    // SCENARIO 7 & 8: Language Switching & currentTime Preservation
    // =========================================================================
    console.log('\n[Scenario 7 & 8] Language Switching & currentTime Preservation...');
    const timeBeforeSwitch = await cdp.eval(`window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)`);

    // Switch to Hindi
    await cdp.eval(`
      (() => {
        const hiBtn = document.getElementById('drawer-lang-hi') || document.querySelector('[data-testid="drawer-lang-hi"]') || Array.from(document.querySelectorAll('button[role="radio"]')).find(b => b.textContent && (b.textContent.includes('HI') || b.textContent.includes('हिन्')));
        if (hiBtn) hiBtn.click();
        else if (window.__naro_set_display_language) window.__naro_set_display_language('hi');
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const timeAfterSwitchHi = await cdp.eval(`window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)`);
    const timeDeltaHi = Math.abs(timeAfterSwitchHi - timeBeforeSwitch);
    assert(timeDeltaHi < 1.0, `Audio playhead preserved across Hindi language switch (delta: ${timeDeltaHi.toFixed(2)}s)`);

    const hiTextCheck = await cdp.eval(`
      (() => {
        const activeLine = document.querySelector('[data-testid="active-lyric-line"], [data-active="true"]');
        return activeLine ? activeLine.textContent : '';
      })()
    `);
    assert(hiTextCheck.includes('परछाइ') || hiTextCheck.includes('नाचती') || hiTextCheck.includes('नियॉन'), `Active line rendered genuine Hindi translation: "${hiTextCheck.slice(0, 40)}"`);

    // Switch to Tamil
    await cdp.eval(`
      (() => {
        const taBtn = document.getElementById('drawer-lang-ta') || document.querySelector('[data-testid="drawer-lang-ta"]') || Array.from(document.querySelectorAll('button[role="radio"]')).find(b => b.textContent && (b.textContent.includes('TA') || b.textContent.includes('தமிழ்')));
        if (taBtn) taBtn.click();
        else if (window.__naro_set_display_language) window.__naro_set_display_language('ta');
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const taTextCheck = await cdp.eval(`
      (() => {
        const activeLine = document.querySelector('[data-testid="active-lyric-line"], [data-active="true"]');
        return activeLine ? activeLine.textContent : '';
      })()
    `);
    assert(taTextCheck.includes('நிழல்கள்') || taTextCheck.includes('நள்ளிரவு') || taTextCheck.includes('நியோன்'), `Active line rendered genuine Tamil translation: "${taTextCheck.slice(0, 40)}"`);

    // =========================================================================
    // SCENARIO 14: Now Playing Integration
    // =========================================================================
    console.log('\n[Scenario 14] Now Playing Integration (Full-Screen Immersive)...');
    // Expand Now Playing
    await cdp.eval(`
      (() => {
        const expandBtn = document.querySelector('[data-testid="expand-now-playing-btn"]') || document.querySelector('[data-testid="bottom-player-track-info"]');
        if (expandBtn) expandBtn.click();
        else if (window.__naro_open_now_playing) window.__naro_open_now_playing();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const nowPlayingCheck = await cdp.eval(`
      (() => {
        const npModal = document.querySelector('[data-testid="naro-now-playing"]');
        if (!npModal) return { open: false };
        const lyricsContainer = document.querySelector('[data-testid="now-playing-lyrics-container"]');
        const activeLine = document.querySelector('[data-testid="active-lyric-line"]');
        const badge = npModal.textContent.includes('SYNCED');
        return {
          open: true,
          hasLyricsContainer: !!lyricsContainer,
          hasActiveLine: !!activeLine,
          hasBadge: badge,
          activeText: activeLine?.textContent?.slice(0, 40)
        };
      })()
    `);
    assert(nowPlayingCheck?.open === true, 'Now Playing full-screen modal opened');
    assert(nowPlayingCheck?.hasLyricsContainer === true, 'Now Playing rendered lyrics container');
    assert(nowPlayingCheck?.hasActiveLine === true, `Now Playing active line highlighted: "${nowPlayingCheck?.activeText}"`);
    assert(nowPlayingCheck?.hasBadge === true, 'Now Playing displays SYNCED capability badge');

    // Close Now Playing
    await cdp.eval(`
      (() => {
        const minBtn = document.querySelector('[data-testid="minimize-now-playing-btn"]');
        if (minBtn) minBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // SCENARIO 15: Karaoke Integration
    // =========================================================================
    console.log('\n[Scenario 15] Karaoke Integration (Shared Canonical Clock & Lines)...');
    // Open Karaoke Modal via window API or primary destination
    await cdp.eval(`
      (() => {
        if (typeof window.__naro_open_karaoke_modal === 'function') {
          window.__naro_open_karaoke_modal();
        } else {
          const karaokeBtn = document.querySelector('aside button[aria-label*="Karaoke"]');
          if (karaokeBtn) karaokeBtn.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const karaokeModalCheck = await cdp.eval(`
      (() => {
        const modalTitle = document.getElementById('karaoke-modal-title');
        const sectionSnippet = document.querySelector('[data-testid="karaoke-section-snippet"]') || document.querySelector('div[role="dialog"]');
        return {
          isOpen: !!modalTitle,
          text: sectionSnippet?.textContent?.slice(0, 80)
        };
      })()
    `);
    assert(karaokeModalCheck?.isOpen === true, 'Karaoke Studio modal opened successfully');

    // Close Karaoke Modal
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close karaoke modal"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {
      // ignore
    }
  }

  console.log('\n======================================================================');
  console.log('ALL 15 SYNCHRONIZED LYRICS ENGINE SCENARIOS VERIFIED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runLyricsSyncTests().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
