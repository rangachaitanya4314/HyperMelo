import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { TEST_SYNCED_LYRICS_FIXTURE } from '../src/data/lyricsFixtures';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import {
  validateScriptForLanguage,
  validateTimelineScript,
  transliterateIndic,
  translationService
} from '../src/services/lyrics/translationService';
import { MOOD_CATALOG } from '../src/data/moodCatalog';
import type { Song, TimedLyricLine, Language } from '../src/types/music';

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
          if (raw.method === 'Runtime.exceptionThrown') {
            console.error('  [CDP Browser Exception]:', JSON.stringify(raw.params?.exceptionDetails?.exception?.description || raw.params?.exceptionDetails?.text));
          }
          if (raw.id && this.pending.has(raw.id)) {
            const cb = this.pending.get(raw.id)!;
            this.pending.delete(raw.id);
            cb(raw as CdpResponse);
          }
        } catch {}
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

// Banned failure state strings in production UI
const FORBIDDEN_FAILURE_SUBSTRINGS = [
  'lyrics unavailable',
  'no lyrics',
  'lyrics not synced',
  'unable to translate',
  'translation unavailable',
  'no translation available'
];

function assertNoFailurePlaceholder(text: string, contextDescription: string) {
  const lower = text.toLowerCase();
  for (const forbidden of FORBIDDEN_FAILURE_SUBSTRINGS) {
    assert(
      !lower.includes(forbidden),
      `Zero forbidden failure placeholders in ${contextDescription} (found "${forbidden}" in "${text}")`
    );
  }
}

async function runHardeningRegressionSuite() {
  console.log('======================================================================');
  console.log('NARO — PRODUCTION LYRIC ENGINE HARDENING REGRESSION SUITE (17 SCENARIOS)');
  console.log('======================================================================\n');

  // Multi-lingual canonical test fixtures
  const tamilFixture: TimedLyricLine[] = [
    {
      id: 'ta-lyric-0',
      startTime: 3.0,
      endTime: 7.0,
      text: 'நியோன் நடைபாதையில் நடக்கிறேன்',
      time: 3.0,
      duration: 4.0,
      translations: {
        ta: 'நியோன் நடைபாதையில் நடக்கிறேன்',
        en: 'Walking down the neon corridor'
      }
    },
    {
      id: 'ta-lyric-1',
      startTime: 7.5,
      endTime: 12.0,
      text: 'நள்ளிரவு தரையில் ஆடும் நிழல்கள்',
      time: 7.5,
      duration: 4.5,
      translations: {
        ta: 'நள்ளிரவு தரையில் ஆடும் நிழல்கள்',
        en: 'Shadows dance against the midnight floor'
      }
    }
  ];

  const teluguFixture: TimedLyricLine[] = [
    {
      id: 'te-lyric-0',
      startTime: 3.0,
      endTime: 7.0,
      text: 'నియాన్ దారిలో నడుస్తూ సాగిపోతున్నా',
      time: 3.0,
      duration: 4.0,
      translations: {
        te: 'నియాన్ దారిలో నడుస్తూ సాగిపోతున్నా',
        en: 'Walking down the neon corridor'
      }
    },
    {
      id: 'te-lyric-1',
      startTime: 7.5,
      endTime: 12.0,
      text: 'అర్ధరాత్రి నేలపై నాట్యం చేసే నీడలు',
      time: 7.5,
      duration: 4.5,
      translations: {
        te: 'అర్ధరాత్రి నేలపై నాట్యం చేసే నీడలు',
        en: 'Shadows dance against the midnight floor'
      }
    }
  ];

  const hindiFixture: TimedLyricLine[] = [
    {
      id: 'hi-lyric-0',
      startTime: 3.0,
      endTime: 7.0,
      text: 'नियॉन के गलियारे में चलते हुए आगे बढ़ रहा हूं',
      time: 3.0,
      duration: 4.0,
      translations: {
        hi: 'नियॉन के गलियारे में चलते हुए आगे बढ़ रहा हूं',
        en: 'Walking down the neon corridor'
      }
    },
    {
      id: 'hi-lyric-1',
      startTime: 7.5,
      endTime: 12.0,
      text: 'आधी रात के फर्श पर नाचती हुई परछाइयां',
      time: 7.5,
      duration: 4.5,
      translations: {
        hi: 'आधी रात के फर्श पर नाचती हुई परछाइयां',
        en: 'Shadows dance against the midnight floor'
      }
    }
  ];

  const malayalamFixture: TimedLyricLine[] = [
    {
      id: 'ml-lyric-0',
      startTime: 3.0,
      endTime: 7.0,
      text: 'നിയോൺ ഇടനാഴിയിലൂടെ നടന്നു നീങ്ങുന്നു',
      time: 3.0,
      duration: 4.0,
      translations: {
        ml: 'നിയോൺ ഇടനാഴിയിലൂടെ നടന്നു നീങ്ങുന്നു',
        en: 'Walking down the neon corridor'
      }
    },
    {
      id: 'ml-lyric-1',
      startTime: 7.5,
      endTime: 12.0,
      text: 'അർദ്ധരാത്രി തറയിൽ നൃത്തം ചെയ്യുന്ന നിഴലുകൾ',
      time: 7.5,
      duration: 4.5,
      translations: {
        ml: 'അർദ്ധരാത്രി തറയിൽ നൃത്തം ചെയ്യുന്ന നിഴലുകൾ',
        en: 'Shadows dance against the midnight floor'
      }
    }
  ];

  // =========================================================================
  // SCENARIO 1: Tamil song -> Telugu lyrics
  // =========================================================================
  console.log('[Scenario 1] Tamil song -> Telugu lyrics...');
  const taSong: Song = {
    id: 'test-tamil-song',
    title: 'Neon Nights Tamil',
    artist: 'Anirudh Studio',
    duration: 120,
    fullTrackDuration: 120,
    language: 'ta',
    originalLanguage: 'ta',
    genre: 'Tamil Electronic',
    bpm: 120,
    musicalKey: 'E Minor',
    isStreamPreview: false,
    fullLengthAvailable: true,
    previewAvailable: false,
    playbackAvailable: true,
    playbackType: 'full',
    playbackAvailability: 'full',
    playbackSourceType: 'naro-licensed',
    playbackProvider: 'naro',
    karaokeReady: true,
    karaokeAvailable: true,
    karaokeAvailability: 'available',
    lyricsAvailable: true,
    lyricsSyncAvailable: true,
    sections: [{ type: 'verse', label: 'Verse 1', start: 0, end: 120 }],
    lyrics: {
      ta: { chorusSnippet: 'நியோன்', lines: tamilFixture }
    }
  };

  assert(lyricsService.detectSongLanguage(taSong) === 'ta', 'Tamil song original language recognized as "ta"');
  const s1Lines = await lyricsService.translateLyricLines(tamilFixture, 'te', 'ta', taSong.id, true);
  assert(s1Lines.length === tamilFixture.length, 'Segment count preserved across TA -> TE');
  for (let i = 0; i < s1Lines.length; i++) {
    const orig = tamilFixture[i];
    const trans = s1Lines[i];
    assert(trans.startTime === orig.startTime, `Line ${i} startTime invariant (${orig.startTime}s)`);
    assert(trans.endTime === orig.endTime, `Line ${i} endTime invariant (${orig.endTime}s)`);
    assert(validateScriptForLanguage(trans.text, 'te', 'ta'), `Line ${i} strictly matches Telugu script`);
    assert(!/[\u0B80-\u0BFF]/.test(trans.text), `Line ${i} contains ZERO Tamil script leakage`);
    assert(trans.text !== orig.text, `Line ${i} text genuinely translated away from original Tamil`);
  }

  // =========================================================================
  // SCENARIO 2: Tamil song -> Hindi lyrics
  // =========================================================================
  console.log('\n[Scenario 2] Tamil song -> Hindi lyrics...');
  const s2Lines = await lyricsService.translateLyricLines(tamilFixture, 'hi', 'ta', taSong.id, true);
  assert(s2Lines.length === tamilFixture.length, 'Segment count preserved across TA -> HI');
  for (let i = 0; i < s2Lines.length; i++) {
    const trans = s2Lines[i];
    assert(validateScriptForLanguage(trans.text, 'hi', 'ta'), `Line ${i} strictly matches Devanagari script`);
    assert(!/[\u0B80-\u0BFF]/.test(trans.text), `Line ${i} contains ZERO Tamil script leakage`);
  }

  // =========================================================================
  // SCENARIO 3: Tamil song -> English lyrics
  // =========================================================================
  console.log('\n[Scenario 3] Tamil song -> English lyrics...');
  const s3Lines = await lyricsService.translateLyricLines(tamilFixture, 'en', 'ta', taSong.id, true);
  assert(s3Lines.length === tamilFixture.length, 'Segment count preserved across TA -> EN');
  for (let i = 0; i < s3Lines.length; i++) {
    const trans = s3Lines[i];
    assert(validateScriptForLanguage(trans.text, 'en', 'ta'), `Line ${i} strictly matches Latin alphabet for English`);
    assert(!/[\u0B80-\u0D7F]/.test(trans.text), `Line ${i} contains ZERO Indic script leakage`);
  }

  // =========================================================================
  // SCENARIO 4: Telugu song -> Tamil lyrics
  // =========================================================================
  console.log('\n[Scenario 4] Telugu song -> Tamil lyrics...');
  const teSong: Song = {
    ...taSong,
    id: 'test-telugu-song',
    title: 'Neon Nights Telugu',
    language: 'te',
    originalLanguage: 'te',
    genre: 'Telugu Folk Pop',
    lyrics: {
      te: { chorusSnippet: 'నియాన్', lines: teluguFixture }
    }
  };
  assert(lyricsService.detectSongLanguage(teSong) === 'te', 'Telugu song original language recognized as "te"');
  const s4Lines = await lyricsService.translateLyricLines(teluguFixture, 'ta', 'te', teSong.id, true);
  for (let i = 0; i < s4Lines.length; i++) {
    const trans = s4Lines[i];
    assert(validateScriptForLanguage(trans.text, 'ta', 'te'), `Line ${i} strictly matches Tamil script`);
    assert(!/[\u0C00-\u0C7F]/.test(trans.text), `Line ${i} contains ZERO Telugu script leakage`);
  }

  // =========================================================================
  // SCENARIO 5: Telugu song -> Hindi lyrics
  // =========================================================================
  console.log('\n[Scenario 5] Telugu song -> Hindi lyrics...');
  const s5Lines = await lyricsService.translateLyricLines(teluguFixture, 'hi', 'te', teSong.id, true);
  for (let i = 0; i < s5Lines.length; i++) {
    const trans = s5Lines[i];
    assert(validateScriptForLanguage(trans.text, 'hi', 'te'), `Line ${i} strictly matches Devanagari script`);
    assert(!/[\u0C00-\u0C7F]/.test(trans.text), `Line ${i} contains ZERO Telugu script leakage`);
  }

  // =========================================================================
  // SCENARIO 6: Hindi song -> Telugu lyrics
  // =========================================================================
  console.log('\n[Scenario 6] Hindi song -> Telugu lyrics...');
  const hiSong: Song = {
    ...taSong,
    id: 'test-hindi-song',
    title: 'Neon Nights Hindi',
    language: 'hi',
    originalLanguage: 'hi',
    genre: 'Bollywood Dance',
    lyrics: {
      hi: { chorusSnippet: 'नियॉन', lines: hindiFixture }
    }
  };
  assert(lyricsService.detectSongLanguage(hiSong) === 'hi', 'Hindi song original language recognized as "hi"');
  const s6Lines = await lyricsService.translateLyricLines(hindiFixture, 'te', 'hi', hiSong.id, true);
  for (let i = 0; i < s6Lines.length; i++) {
    const trans = s6Lines[i];
    assert(validateScriptForLanguage(trans.text, 'te', 'hi'), `Line ${i} strictly matches Telugu script`);
    assert(!/[\u0900-\u097F]/.test(trans.text), `Line ${i} contains ZERO Devanagari script leakage`);
  }

  // =========================================================================
  // SCENARIO 7: Hindi song -> English lyrics
  // =========================================================================
  console.log('\n[Scenario 7] Hindi song -> English lyrics...');
  const s7Lines = await lyricsService.translateLyricLines(hindiFixture, 'en', 'hi', hiSong.id, true);
  for (let i = 0; i < s7Lines.length; i++) {
    const trans = s7Lines[i];
    assert(validateScriptForLanguage(trans.text, 'en', 'hi'), `Line ${i} strictly matches English Latin script`);
    assert(!/[\u0900-\u0D7F]/.test(trans.text), `Line ${i} contains ZERO Indic script leakage`);
  }

  // =========================================================================
  // SCENARIO 8: Malayalam song -> Telugu lyrics
  // =========================================================================
  console.log('\n[Scenario 8] Malayalam song -> Telugu lyrics...');
  const mlSong: Song = {
    ...taSong,
    id: 'test-malayalam-song',
    title: 'Neon Nights Malayalam',
    language: 'ml',
    originalLanguage: 'ml',
    genre: 'Mollywood Indie',
    lyrics: {
      ml: { chorusSnippet: 'നിയോൺ', lines: malayalamFixture }
    }
  };
  assert(lyricsService.detectSongLanguage(mlSong) === 'ml', 'Malayalam song original language recognized as "ml"');
  const s8Lines = await lyricsService.translateLyricLines(malayalamFixture, 'te', 'ml', mlSong.id, true);
  for (let i = 0; i < s8Lines.length; i++) {
    const trans = s8Lines[i];
    assert(validateScriptForLanguage(trans.text, 'te', 'ml'), `Line ${i} strictly matches Telugu script`);
    assert(!/[\u0D00-\u0D7F]/.test(trans.text), `Line ${i} contains ZERO Malayalam script leakage`);
  }

  // =========================================================================
  // SCENARIO 9: Same-language reselect (e.g. TE -> TE) & Cache Invalidation
  // =========================================================================
  console.log('\n[Scenario 9] Same-language reselect (TE -> TE) & Cache Invalidation...');
  const testTrackId = 'test-reselect-track';
  // Cache a mock translated timeline
  translationService.setCache(testTrackId, 'ta', 'te', s1Lines);
  const initialCached = translationService.getCached(testTrackId, 'ta', 'te');
  assert(Boolean(initialCached), 'Initial translation cached under [trackId, origLang, displayLang]');

  // Clear translation cache for this exact pair
  lyricsService.clearTranslationCache(testTrackId, 'ta', 'te');
  const clearedCached = translationService.getCached(testTrackId, 'ta', 'te');
  assert(clearedCached === null, 'Cache invalidated on same-language reselection');

  // Re-translate resolves afresh
  const refreshedLines = await lyricsService.translateLyricLines(tamilFixture, 'te', 'ta', testTrackId, true);
  assert(validateTimelineScript(refreshedLines, 'te', 'ta'), 'Re-translated timeline validates against Telugu script');

  // =========================================================================
  // SCENARIO 10: Rapid Language Switching Sequence:
  // "TA -> TE", "TE -> TA", "TA -> HI", "HI -> EN", "EN -> ML", "ML -> TE", "TE -> TE"
  // =========================================================================
  console.log('\n[Scenario 10] Rapid language switching sequence...');
  const sequence: Language[] = ['te', 'ta', 'hi', 'en', 'ml', 'te', 'te'];
  let currentTimeline = tamilFixture;
  const originalLang: Language = 'ta';

  for (let stepIdx = 0; stepIdx < sequence.length; stepIdx++) {
    const targetLang = sequence[stepIdx];
    lyricsService.clearTranslationCache(testTrackId, originalLang, targetLang);
    currentTimeline = await lyricsService.translateLyricLines(tamilFixture, targetLang, originalLang, testTrackId, true);

    assert(currentTimeline.length === tamilFixture.length, `Step ${stepIdx + 1} (${targetLang.toUpperCase()}): Preserved line count`);
    assert(
      validateTimelineScript(currentTimeline, targetLang, originalLang),
      `Step ${stepIdx + 1} (${targetLang.toUpperCase()}): Matches ${targetLang} script without leakage`
    );
  }
  assert(
    validateTimelineScript(currentTimeline, 'te', 'ta'),
    'Final sequence state "TE -> TE" rendered valid Telugu script'
  );

  // =========================================================================
  // PART 2: REAL CHROME CDP REGRESSION TESTS (SCENARIOS 11 - 17)
  // =========================================================================
  console.log('\n======================================================================');
  console.log('PART 2: REAL CHROME CDP REGRESSION TESTS (SCENARIOS 11-17)');
  console.log('======================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_hardening_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9255',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch('http://127.0.0.1:9255/json');
        if (res.ok) {
          listData = await res.json();
          if (listData.length > 0 && listData[0].webSocketDebuggerUrl) {
            break;
          }
        }
      } catch {}
    }

    if (!listData.length || !listData[0].webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome on port 9255');
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    const cdp = new CdpClient();
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

    // Wait for app ready and dismiss intro
    for (let i = 0; i < 40; i++) {
      const isReady = await cdp.eval(`
        (() => {
          sessionStorage.setItem('naro_intro_seen', 'true');
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(window.__naro_play_song && window.__naro_seek);
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 600));

    // Inject multilingual test track
    console.log('  [CDP] Injecting test track with genuine 5-language synchronized lines...');
    await cdp.eval(`
      (() => {
        const track = {
          id: 'test-multilingual-hardening',
          title: 'Neon Corridor (Hardening)',
          artist: 'NARO Collective',
          duration: 60,
          fullTrackDuration: 60,
          language: 'en',
          originalLanguage: 'en',
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
          playbackSource: {
            provider: 'naro',
            providerTrackId: 'test-multilingual-hardening',
            streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
            format: 'mp3',
            duration: 60
          },
          sections: [{ type: 'verse', label: 'Verse 1', start: 0, end: 60 }],
          lyrics: (() => {
            const lines = ${JSON.stringify(TEST_SYNCED_LYRICS_FIXTURE)}.map((l, idx) => ({
              ...l,
              id: 'hardening-lyric-' + idx,
              translations: {
                ...l.translations,
                te: (l.translations && l.translations.te) || 'నీ హృదయ స్పందనలో లయను పట్టుకో',
                ml: (l.translations && l.translations.ml) || 'നിന്റെ ഹൃദയമിടിപ്പിൽ താളം കണ്ടെത്തൂ'
              }
            }));
            return {
              en: { chorusSnippet: 'Walking down', lines },
              hi: { chorusSnippet: 'नियॉन के गलियारे', lines },
              te: { chorusSnippet: 'నియాన్ దారిలో', lines },
              ta: { chorusSnippet: 'நியோன்', lines },
              ml: { chorusSnippet: 'നിയോൺ', lines }
            };
          })()
        };
        window.__naro_play_song(track);
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Open Lyrics Drawer
    console.log('  [CDP] Opening Floating Lyrics Drawer...');
    await cdp.eval(`
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
    await new Promise((r) => setTimeout(r, 600));

    // =========================================================================
    // SCENARIO 11: Language switching while playing
    // =========================================================================
    console.log('\n[Scenario 11] Language switching while playing...');
    // Ensure playback is active
    await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        if (audio && audio.paused && window.__naro_toggle_play) {
          window.__naro_toggle_play();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const timeBeforePlaySwitch = await cdp.eval(`
      window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)
    `);
    const isPlayingBefore = await cdp.eval(`Boolean(window.__naro_is_playing ? window.__naro_is_playing() : true)`);

    // Switch language to Telugu while playing
    await cdp.eval(`
      (() => {
        if (window.__naro_set_display_language) window.__naro_set_display_language('te');
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const timeAfterPlaySwitch = await cdp.eval(`
      window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)
    `);
    const isPlayingAfter = await cdp.eval(`Boolean(window.__naro_is_playing ? window.__naro_is_playing() : true)`);

    assert(isPlayingBefore === isPlayingAfter, 'Playback state remained continuous and uninterrupted (did not stop or reset)');
    assert(timeAfterPlaySwitch >= timeBeforePlaySwitch, 'currentTime progressed forward monotonically across language switch');

    // =========================================================================
    // SCENARIO 12: Language switching while paused
    // =========================================================================
    console.log('\n[Scenario 12] Language switching while paused...');
    await cdp.eval(`
      (() => {
        if (window.__naro_toggle_play && window.__naro_is_playing && window.__naro_is_playing()) {
          window.__naro_toggle_play();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const isPausedBefore = await cdp.eval(`!Boolean(window.__naro_is_playing ? window.__naro_is_playing() : false)`);
    const timeBeforePauseSwitch = await cdp.eval(`
      window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)
    `);

    // Switch language to Hindi while paused
    await cdp.eval(`
      (() => {
        if (window.__naro_set_display_language) window.__naro_set_display_language('hi');
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const isPausedAfter = await cdp.eval(`!Boolean(window.__naro_is_playing ? window.__naro_is_playing() : false)`);
    const timeAfterPauseSwitch = await cdp.eval(`
      window.__naro_get_current_time ? window.__naro_get_current_time() : (window.__naro_audio?.currentTime || 0)
    `);

    assert(isPausedBefore && isPausedAfter, 'Audio remained strictly paused across language switch (zero accidental autoplay)');
    assert(Math.abs(timeAfterPauseSwitch - timeBeforePauseSwitch) < 0.2, 'currentTime stayed anchored at exact paused position');

    // =========================================================================
    // SCENARIO 13: Language switching after seek
    // =========================================================================
    console.log('\n[Scenario 13] Language switching after seek...');
    // Ensure Lyrics Drawer is open
    await cdp.eval(`
      (() => {
        if (typeof window.__naro_open_lyrics === 'function') {
          window.__naro_open_lyrics();
          return true;
        }
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        if (!dialog) {
          if (typeof window.__naro_toggle_lyrics === 'function') window.__naro_toggle_lyrics();
          else document.getElementById('toggle-lyrics-drawer-btn')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Seek to Line 1 (9.0s) via direct seek or lyrics line click
    await cdp.eval(`
      (() => {
        if (typeof window.__naro_seek === 'function') {
          window.__naro_seek(9.0);
        }
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const lines = dialog ? Array.from(dialog.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')) : [];
        if (lines[1]) lines[1].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const timeAfterSeek = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        const aTime = audio && !isNaN(audio.currentTime) ? audio.currentTime : 0;
        const rTime = window.__naro_get_current_time ? window.__naro_get_current_time() : 0;
        return Math.max(aTime, rTime);
      })()
    `);
    assert(Math.abs(timeAfterSeek - 9.0) < 1.0, `Audio seeked to target (9.0s, actual: ${Number(timeAfterSeek).toFixed(2)}s)`);

    // Switch to Tamil
    await cdp.eval(`
      (() => {
        const taBtn = document.getElementById('drawer-lang-ta');
        if (taBtn) taBtn.click();
        else if (window.__naro_set_display_language) window.__naro_set_display_language('ta');
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const timeAfterSeekSwitch = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        const aTime = audio && !isNaN(audio.currentTime) ? audio.currentTime : 0;
        const rTime = window.__naro_get_current_time ? window.__naro_get_current_time() : 0;
        return Math.max(aTime, rTime);
      })()
    `);
    assert(Math.abs(timeAfterSeekSwitch - 9.0) < 1.0, 'Playhead remained anchored at seek target after language switch');

    // =========================================================================
    // SCENARIO 14: Language switching during active lyric line
    // =========================================================================
    console.log('\n[Scenario 14] Language switching during active lyric line...');
    // Seek to 11.0s (Line 1: "Shadows dance against the midnight floor")
    await cdp.eval(`
      (() => {
        if (typeof window.__naro_seek === 'function') window.__naro_seek(11.0);
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        if (audio) { try { audio.currentTime = 11.0; } catch {} }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Ensure Lyrics Drawer is open
    await cdp.eval(`
      (() => {
        if (typeof window.__naro_open_lyrics === 'function') {
          window.__naro_open_lyrics();
          return true;
        }
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        if (!dialog) {
          if (typeof window.__naro_toggle_lyrics === 'function') window.__naro_toggle_lyrics();
          else document.getElementById('toggle-lyrics-drawer-btn')?.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Switch to English first
    await cdp.eval(`
      (() => {
        const enBtn = document.getElementById('drawer-lang-en');
        if (enBtn) enBtn.click();
        else if (window.__naro_set_display_language) window.__naro_set_display_language('en');
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const debugInfo = await cdp.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"][aria-label="Floating lyrics drawer"]');
        const active = document.querySelector('[data-testid="active-lyric-line"]');
        const all = Array.from(document.querySelectorAll('[data-testid="lyric-line"], [data-testid="active-lyric-line"]')).map(l => l.textContent);
        const time = window.__naro_get_current_time ? window.__naro_get_current_time() : null;
        const lang = window.__naro_get_display_language ? window.__naro_get_display_language() : null;
        return {
          hasDialog: Boolean(dialog),
          activeText: active?.textContent || '',
          allCount: all.length,
          all,
          time,
          lang,
          hasOpenLyricsFn: typeof window.__naro_open_lyrics === 'function',
          isLyricsOpen: window.__naro_is_lyrics_open ? window.__naro_is_lyrics_open() : null,
          hasToggleBtn: Boolean(document.getElementById('toggle-lyrics-drawer-btn')),
          currentSongTitle: window.__naro_current_song?.title,
          bodyHtmlSnippet: document.body.innerHTML.slice(0, 400)
        };
      })()
    `);
    console.log('Scenario 14 debug:', debugInfo);

    const activeEnText = debugInfo?.activeText || '';
    assert(activeEnText.includes('Shadows dance against the midnight floor'), `Active line rendered English before switch (was: "${activeEnText}")`);

    // Switch to Telugu during active line
    await cdp.eval(`
      (() => {
        const teBtn = document.getElementById('drawer-lang-te');
        if (teBtn) teBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const activeTeText = await cdp.eval(`
      document.querySelector('[data-testid="active-lyric-line"]')?.textContent || ''
    `);
    assert(activeTeText.includes('అర్ధరాత్రి') || activeTeText.includes('నీడలు'), `Active line immediately recomputed and rendered in Telugu script: "${activeTeText}"`);
    assertNoFailurePlaceholder(activeTeText, 'Active lyric line in Telugu');

    // =========================================================================
    // SCENARIO 15: Lyrics Drawer language switching
    // =========================================================================
    console.log('\n[Scenario 15] Lyrics Drawer language switching...');
    // Switch to Hindi in drawer
    await cdp.eval(`
      (() => {
        const hiBtn = document.getElementById('drawer-lang-hi');
        if (hiBtn) hiBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const drawerHiText = await cdp.eval(`
      document.querySelector('[data-testid="active-lyric-line"]')?.textContent || ''
    `);
    assert(drawerHiText.includes('आधी रात') || drawerHiText.includes('नाचती'), `Lyrics Drawer rendered Hindi translation: "${drawerHiText}"`);
    assertNoFailurePlaceholder(drawerHiText, 'Lyrics Drawer Hindi active line');

    // Switch to Malayalam in drawer
    await cdp.eval(`
      (() => {
        const mlBtn = document.getElementById('drawer-lang-ml');
        if (mlBtn) mlBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const drawerMlText = await cdp.eval(`
      document.querySelector('[data-testid="active-lyric-line"]')?.textContent || ''
    `);
    assert(drawerMlText.includes('അർദ്ധരാത്രി') || drawerMlText.includes('നിഴലുകൾ'), `Lyrics Drawer rendered Malayalam translation: "${drawerMlText}"`);

    // =========================================================================
    // SCENARIO 16: Now Playing language switching
    // =========================================================================
    console.log('\n[Scenario 16] Now Playing language switching...');
    // Open Now Playing full-screen modal
    await cdp.eval(`
      (() => {
        const expandBtn = document.querySelector('[data-testid="expand-now-playing-btn"]') || document.querySelector('[data-testid="bottom-player-track-info"]');
        if (expandBtn) expandBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Switch to Tamil in Now Playing modal
    await cdp.eval(`
      (() => {
        const taBtn = document.getElementById('now-playing-lang-ta');
        if (taBtn) taBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const npTaText = await cdp.eval(`
      document.querySelector('[data-testid="active-lyric-line"]')?.textContent || ''
    `);
    assert(npTaText.includes('நள்ளிரவு') || npTaText.includes('நிழல்கள்'), `Now Playing rendered Tamil translation: "${npTaText}"`);
    assertNoFailurePlaceholder(npTaText, 'Now Playing Tamil active line');

    // Switch to Telugu in Now Playing modal
    await cdp.eval(`
      (() => {
        const teBtn = document.getElementById('now-playing-lang-te');
        if (teBtn) teBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const npTeText = await cdp.eval(`
      document.querySelector('[data-testid="active-lyric-line"]')?.textContent || ''
    `);
    assert(npTeText.includes('అర్ధరాత్రి') || npTeText.includes('నీడలు'), `Now Playing rendered Telugu translation: "${npTeText}"`);
    assertNoFailurePlaceholder(npTeText, 'Now Playing Telugu active line');

    // Close Now Playing
    await cdp.eval(`
      (() => {
        const minBtn = document.querySelector('[data-testid="minimize-now-playing-btn"]');
        if (minBtn) minBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // SCENARIO 17: Karaoke language synchronization
    // =========================================================================
    console.log('\n[Scenario 17] Karaoke language synchronization...');
    // Open Karaoke Studio
    const karaokeOpened = await cdp.eval(`
      (() => {
        if (window.__naro_open_karaoke_modal) {
          window.__naro_open_karaoke_modal();
          return true;
        }
        const kBtn = document.querySelector('[data-testid="karaoke-toggle-btn"]');
        if (kBtn) {
          kBtn.click();
          return true;
        }
        return false;
      })()
    `);
    assert(karaokeOpened === true, 'Karaoke Studio modal triggered');
    await new Promise((r) => setTimeout(r, 700));

    // Check Karaoke modal is rendered and has no forbidden failure placeholders
    const karaokeContent = await cdp.eval(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label*="Karaoke"], [data-testid="karaoke-studio-modal"], .karaoke-modal');
        return modal ? modal.textContent : document.body.textContent || '';
      })()
    `);
    assertNoFailurePlaceholder(karaokeContent, 'Karaoke Studio interface');

    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }

  console.log('\n======================================================================');
  console.log('ALL 17 HARDENING REGRESSION TEST SCENARIOS PASSED WITH ZERO FAILURES!');
  console.log('======================================================================\n');
}

runHardeningRegressionSuite().catch((err) => {
  console.error('\nHardening Regression Suite Failed:', err);
  process.exit(1);
});
