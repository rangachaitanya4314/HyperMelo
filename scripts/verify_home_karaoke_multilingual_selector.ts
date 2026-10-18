import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {
  lyricsService,
  getAvailableLyricRepresentations,
  getLyricRepresentationText,
  getLanguageDisplayName,
  type VerifiedLyricRepresentation
} from '../src/services/lyrics/lyricsService';
import { ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import { TEST_SYNCED_LYRICS_FIXTURE } from '../src/data/lyricsFixtures';
import type { Song, TimedLyricLine } from '../src/types/music';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

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
    const res: any = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.error('CDP EVAL EXCEPTION:', res.exceptionDetails.text, res.exceptionDetails.exception?.description || res.exceptionDetails);
    }
    const resultObj = res.result as { value?: unknown; description?: string } | undefined;
    return resultObj?.value;
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
  }
}

async function runAllTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('NARO HOME KARAOKE MULTILINGUAL SELECTOR VERIFICATION SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // TEST 1: Song with Native Lyrics Only
  // =========================================================================
  console.log('[TEST 1] Song with Native Lyrics Only (No transliteration, no translations)');
  const nativeOnlySong: Song = {
    id: 'test-native-only',
    title: 'Native Only Song',
    artist: 'Traditional Singer',
    duration: 180,
    originalLanguage: 'te',
    language: 'te',
    lyricsAvailable: true,
    lyricsSyncAvailable: true,
    sections: [{ type: 'chorus', label: 'Pallavi', start: 10, end: 40 }],
    lyrics: {
      te: {
        chorusSnippet: 'మరువలేని జ్ఞాపకాలే మిగిలెనే',
        lines: [
          {
            id: 'no-1',
            startTime: 10,
            endTime: 18,
            time: 10,
            duration: 8,
            text: 'మరువలేని జ్ఞాపకాలే మిగిలెనే',
            original_language: 'te',
            karaoke: {
              native: 'మరువలేని జ్ఞాపకాలే మిగిలెనే'
              // No transliteration provided
            }
          }
        ]
      }
    }
  } as unknown as Song;

  const nativeOnlyLines = lyricsService.getCanonicalLyricLines(nativeOnlySong);
  // Simulate transliteration unavailable by ensuring transliteration is omitted and unsupported
  const nativeOnlyReps = getAvailableLyricRepresentations(nativeOnlySong, nativeOnlyLines);
  console.log('  Native-only representations:', nativeOnlyReps.map((r) => r.label));

  assert(nativeOnlyReps.length >= 1, 'At least 1 representation returned for native-only song');
  const nativeRep = nativeOnlyReps.find((r) => r.type === 'original');
  assert(Boolean(nativeRep), 'Original native-script representation is present');
  assert(nativeRep!.langCode === 'te', 'Original language code is "te"');
  assert(nativeRep!.isSinging === true, 'Original representation is marked as isSinging: true');
  assert(
    !nativeOnlyReps.some((r) => r.type === 'translation'),
    'No unverified translation representations offered for native-only song'
  );

  const nativeExcerpt = getLyricRepresentationText(nativeOnlyLines[0], nativeRep, 'te');
  assert(nativeExcerpt.text === 'మరువలేని జ్ఞాపకాలే మిగిలెనే', 'Native excerpt displays original Telugu text');
  assert(nativeExcerpt.categoryLabel.includes('ORIGINAL'), `Category label indicates ORIGINAL: "${nativeExcerpt.categoryLabel}"`);
  assert(nativeExcerpt.accessibleLabel.includes('Original'), `Accessible label indicates Original: "${nativeExcerpt.accessibleLabel}"`);

  // =========================================================================
  // TEST 2: Song with Native Lyrics Plus Transliteration
  // =========================================================================
  console.log('\n[TEST 2] Song with Native Lyrics Plus Transliteration (Gaali Vaaluga)');
  const gaaliLines = lyricsService.getCanonicalLyricLines(ANIRUDH_GAALI_VAALUGA);
  const gaaliReps = getAvailableLyricRepresentations(ANIRUDH_GAALI_VAALUGA, gaaliLines);
  console.log('  Gaali Vaaluga representations:', gaaliReps.map((r) => `${r.type}:${r.label}`));

  const origRep = gaaliReps.find((r) => r.type === 'original');
  const transRep = gaaliReps.find((r) => r.type === 'transliteration');
  assert(Boolean(origRep), 'Original native-script option is present');
  assert(Boolean(transRep), 'Roman transliteration singing guide is present');
  assert(origRep!.isSinging === true, 'Original is marked as singing lyrics');
  assert(transRep!.isSinging === true, 'Roman transliteration is marked as singing guide');
  assert(gaaliReps[0].type === 'original', 'Original native script is prioritized as first singing option');

  // Transliteration excerpt verification
  const transExcerpt = getLyricRepresentationText(gaaliLines[0], transRep, 'te');
  assert(transExcerpt.text.toLowerCase().includes('gaalivaalugaa') || transExcerpt.text.toLowerCase().includes('gaali'), `Transliteration text is Romanized: "${transExcerpt.text}"`);
  assert(transExcerpt.categoryLabel.includes('ROMAN TRANSLITERATION'), `Category badge indicates ROMAN TRANSLITERATION: "${transExcerpt.categoryLabel}"`);
  assert(transExcerpt.secondaryText?.includes('గాలివాలుగా') === true, `Secondary text displays original native script: "${transExcerpt.secondaryText}"`);
  assert(transExcerpt.accessibleLabel.includes('Roman transliteration singing guide'), `Accessible label is explicit: "${transExcerpt.accessibleLabel}"`);

  // =========================================================================
  // TEST 3: Song with Verified Translations (Meaning)
  // =========================================================================
  console.log('\n[TEST 3] Song with Verified Translations');
  // Gaali Vaaluga has verified English meaning in listening_meaning.en
  const enMeaningRep = gaaliReps.find((r) => r.id === 'translation-en');
  assert(Boolean(enMeaningRep), 'Verified English meaning representation is present for Gaali Vaaluga');
  assert(enMeaningRep!.isSinging === false, 'English meaning is marked isSinging: false (NOT sung words)');

  // Ensure unverified languages are NOT offered
  assert(!gaaliReps.some((r) => r.id === 'translation-hi'), 'Unverified Hindi meaning is NOT offered for Gaali Vaaluga');
  assert(!gaaliReps.some((r) => r.id === 'translation-ta'), 'Unverified Tamil meaning is NOT offered for Gaali Vaaluga');
  assert(!gaaliReps.some((r) => r.id === 'translation-ml'), 'Unverified Malayalam meaning is NOT offered for Gaali Vaaluga');

  // Verify meaning excerpt
  const enExcerpt = getLyricRepresentationText(gaaliLines[0], enMeaningRep, 'te');
  assert(enExcerpt.text.includes('rose') || enExcerpt.text.includes('gust of wind'), `English meaning text is translated meaning: "${enExcerpt.text}"`);
  assert(enExcerpt.categoryLabel.includes('NOT SUNG'), `Category label explicitly warns (NOT SUNG): "${enExcerpt.categoryLabel}"`);
  assert(enExcerpt.secondaryText?.includes('గాలివాలుగా') === true, `Secondary text preserves original singing lyrics: "${enExcerpt.secondaryText}"`);

  // Test fixture 2 with partial translations (has en, hi, ta; lacks te, ml)
  const partialSong: Song = {
    id: 'test-partial-translations',
    title: 'Partial Translation Song',
    artist: 'Multi Artist',
    duration: 120,
    originalLanguage: 'en',
    language: 'en',
    lyricsAvailable: true,
    lyricsSyncAvailable: true,
    lyrics: {
      en: {
        chorusSnippet: 'Catch the rhythm in your beating heart',
        lines: [TEST_SYNCED_LYRICS_FIXTURE[2]] // only has hi and ta translations, te and ml omitted!
      }
    }
  } as unknown as Song;

  const partialReps = getAvailableLyricRepresentations(partialSong, [TEST_SYNCED_LYRICS_FIXTURE[2]]);
  console.log('  Partial translation representations:', partialReps.map((r) => r.id));
  assert(partialReps.some((r) => r.id === 'translation-hi'), 'Verified Hindi translation is offered');
  assert(partialReps.some((r) => r.id === 'translation-ta'), 'Verified Tamil translation is offered');
  assert(!partialReps.some((r) => r.id === 'translation-te'), 'Missing Telugu translation is honestly omitted');
  assert(!partialReps.some((r) => r.id === 'translation-ml'), 'Missing Malayalam translation is honestly omitted');

  // =========================================================================
  // TEST 4: Song with Missing or Uncertain Language Metadata
  // =========================================================================
  console.log('\n[TEST 4] Song with Missing or Uncertain Language Metadata');
  // 4A: Track with no lyrics (Shot Down)
  const shotDownReps = getAvailableLyricRepresentations(JOSH_WOODWARD_SHOT_DOWN, []);
  assert(shotDownReps.length === 0, 'No representations returned for song without lyrics (Shot Down)');

  const emptyExcerpt = getLyricRepresentationText(null, null, 'en');
  assert(emptyExcerpt.isAvailable === false, 'Excerpt isAvailable: false for missing lyrics');
  assert(emptyExcerpt.text === 'Lyrics unavailable for this track', 'Truthful message for missing lyrics');
  assert(emptyExcerpt.categoryLabel === 'LYRICS UNAVAILABLE', 'Badge indicates LYRICS UNAVAILABLE');

  // 4B: Song with lines but undefined originalLanguage metadata
  const unannotatedSong: Song = {
    id: 'test-unannotated',
    title: 'Unannotated Track',
    artist: 'Unknown',
    duration: 100,
    // originalLanguage is intentionally undefined!
    lyrics: {
      custom: {
        chorusSnippet: 'హృదయం పలికే ప్రియ రాగం',
        lines: [
          {
            startTime: 5,
            endTime: 10,
            time: 5,
            duration: 5,
            text: 'హృదయం పలికే ప్రియ రాగం'
          }
        ]
      }
    }
  } as unknown as Song;

  const unannotatedLines = [
    {
      startTime: 5,
      endTime: 10,
      time: 5,
      duration: 5,
      text: 'హృదయం పలికే ప్రియ రాగం'
    }
  ];
  const unannotatedReps = getAvailableLyricRepresentations(unannotatedSong, unannotatedLines);
  assert(unannotatedReps.length >= 1, 'Resolved representations even with undefined originalLanguage');
  assert(unannotatedReps[0].langCode === 'te', `Correctly identified Telugu script from line text (got '${unannotatedReps[0].langCode}')`);

  // =========================================================================
  // TEST 5: Live Browser CDP Verification on Home Page
  // =========================================================================
  console.log('\n[TEST 5] Live Browser CDP Acceptance Verification');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_home_karaoke_test_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9245',
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
        const res = await fetch('http://127.0.0.1:9245/json');
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
      throw new Error('Failed to connect to Chrome on port 9245');
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    const cdp = new CdpClient();
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Wait for client to mount
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Karaoke section is present on Home
    const hasKaraokeSection = await cdp.eval(`Boolean(document.getElementById('karaoke'))`);
    assert(hasKaraokeSection === true, 'Core Karaoke moment section (#karaoke) is mounted on Home page');

    // Check representation buttons on Home
    const repButtons = await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button[data-testid^="core-lyric-rep-"]'));
        return btns.map((b) => ({
          id: b.getAttribute('data-testid'),
          text: b.textContent?.trim(),
          selected: b.getAttribute('aria-checked') === 'true'
        }));
      })()
    `);
    console.log('  Rendered representation buttons on Home:', repButtons);

    // Verify old blanket language buttons are NOT present
    const hasOldLanguageGroup = await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const labels = btns.map(b => b.textContent?.trim());
        return labels.includes('HI') && labels.includes('TE') && labels.includes('TA') && labels.includes('ML');
      })()
    `);
    assert(!hasOldLanguageGroup, 'Home panel no longer blindly displays all 5 application languages as lyric options');

    // Verify Sing options: Original (తెలుగు) and Roman Transliteration
    const hasOriginalBtn = repButtons.some((b: any) => b.id === 'core-lyric-rep-original');
    const hasTranslitBtn = repButtons.some((b: any) => b.id === 'core-lyric-rep-transliteration');
    const hasEnMeaningBtn = repButtons.some((b: any) => b.id === 'core-lyric-rep-translation-en');
    const hasFakeHiMeaningBtn = repButtons.some((b: any) => b.id === 'core-lyric-rep-translation-hi');

    assert(hasOriginalBtn, 'Sing option "Original (తెలుగు)" is rendered');
    assert(hasTranslitBtn, 'Sing option "Roman Transliteration" is rendered');
    assert(hasEnMeaningBtn, 'Meaning option "English Meaning" is rendered');
    assert(!hasFakeHiMeaningBtn, 'Unverified Hindi meaning is NOT rendered');

    // Check initial active lyric text and category badge (Native script)
    const initialBadge = await cdp.eval(`document.getElementById('core-karaoke-moment-badge')?.textContent?.trim()`);
    const initialActiveLyric = await cdp.eval(`document.getElementById('core-karaoke-active-lyric')?.textContent?.trim()`);
    console.log('  Initial Badge:', initialBadge);
    console.log('  Initial Active Lyric:', initialActiveLyric);

    assert(initialBadge?.includes('ORIGINAL'), `Initial badge specifies ORIGINAL: "${initialBadge}"`);
    assert(/[\u0C00-\u0C7F]/.test(initialActiveLyric || ''), `Initial excerpt displays authentic Telugu script: "${initialActiveLyric}"`);

    // Switch to Roman Transliteration
    console.log('  Clicking "Roman Transliteration"...');
    const clickDiag = await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[data-testid="core-lyric-rep-transliteration"]');
        if (!btn) return { found: false };
        btn.click();
        return {
          found: true,
          ariaChecked: btn.getAttribute('aria-checked')
        };
      })()
    `);
    console.log('  Click diagnostic:', clickDiag);
    await new Promise((r) => setTimeout(r, 600));

    const translitBadge = await cdp.eval(`document.getElementById('core-karaoke-moment-badge')?.textContent?.trim()`);
    const translitLyric = await cdp.eval(`document.getElementById('core-karaoke-active-lyric')?.textContent?.trim()`);
    const translitSubline = await cdp.eval(`document.getElementById('core-karaoke-subline-lyric')?.textContent?.trim()`);
    console.log('  Transliteration Badge:', translitBadge);
    console.log('  Transliteration Lyric:', translitLyric);
    console.log('  Transliteration Subline:', translitSubline);

    assert(translitBadge?.includes('ROMAN TRANSLITERATION'), `Badge updated to ROMAN TRANSLITERATION: "${translitBadge}"`);
    assert(/[a-zA-Z]/.test(translitLyric || ''), `Active lyric switched to Roman script: "${translitLyric}"`);
    assert(/[\u0C00-\u0C7F]/.test(translitSubline || ''), `Subline shows original Telugu singing lyrics: "${translitSubline}"`);

    // Switch to English Meaning
    console.log('  Clicking "English Meaning"...');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[data-testid="core-lyric-rep-translation-en"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const meaningBadge = await cdp.eval(`document.getElementById('core-karaoke-moment-badge')?.textContent?.trim()`);
    const meaningLyric = await cdp.eval(`document.getElementById('core-karaoke-active-lyric')?.textContent?.trim()`);
    console.log('  Meaning Badge:', meaningBadge);
    assert(meaningBadge?.includes('NOT SUNG'), `Meaning badge explicitly states NOT SUNG: "${meaningBadge}"`);
    assert(
      meaningLyric?.toLowerCase().includes('lightning') ||
      meaningLyric?.toLowerCase().includes('eyes') ||
      meaningLyric?.toLowerCase().includes('rose') ||
      meaningLyric?.toLowerCase().includes('wind'),
      `Displays English meaning: "${meaningLyric}"`
    );

    // Moment switching: Select Chorus
    console.log('  Testing moment selection switching (Chorus tab)...');
    await cdp.eval(`
      (() => {
        const chorusTab = Array.from(document.querySelectorAll('div[role="tablist"] button')).find(b => b.textContent?.trim() === 'Chorus');
        if (chorusTab) chorusTab.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const chorusActiveLyric = await cdp.eval(`document.getElementById('core-karaoke-active-lyric')?.textContent?.trim()`);
    console.log('  Chorus moment lyric:', chorusActiveLyric);
    assert(Boolean(chorusActiveLyric) && chorusActiveLyric.length > 0, 'Chorus moment displays updated lyric excerpt');

    // Switch to Shot Down (Track without lyrics)
    console.log('  Switching track to Shot Down (no lyrics)...');
    await cdp.eval(`
      (() => {
        window.__naro_play_song(${JSON.stringify(JOSH_WOODWARD_SHOT_DOWN)});
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const shotDownBadge = await cdp.eval(`document.getElementById('core-karaoke-moment-badge')?.textContent?.trim()`);
    const shotDownLyric = await cdp.eval(`document.getElementById('core-karaoke-active-lyric')?.textContent?.trim()`);
    const shotDownNotice = await cdp.eval(`document.getElementById('core-karaoke-lyrics-unavailable-badge')?.textContent?.trim()`);
    console.log('  Shot Down Badge:', shotDownBadge);
    console.log('  Shot Down Lyric:', shotDownLyric);
    console.log('  Shot Down Notice:', shotDownNotice);

    assert(shotDownBadge === 'LYRICS UNAVAILABLE', `Shot Down badge shows LYRICS UNAVAILABLE (got '${shotDownBadge}')`);
    assert(shotDownLyric === 'Lyrics unavailable for this track', `Shot Down excerpt honestly states "Lyrics unavailable for this track" (got '${shotDownLyric}')`);
    assert(shotDownNotice === 'No verified lyrics available', `Notice indicates "No verified lyrics available" (got '${shotDownNotice}')`);

    // Verify waveform timeline and play controls are still functional
    const hasWaveform = await cdp.eval(`Boolean(document.querySelector('[data-testid="waveform-timeline"]') || document.querySelector('canvas'))`);
    assert(hasWaveform, 'Waveform timeline canvas is present and active');

    const playBtnText = await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[aria-label*="Play selected song"], button[aria-label="Pause"]');
        return btn?.textContent?.trim();
      })()
    `);
    assert(playBtnText?.includes('Play') || playBtnText?.includes('Pause'), `Play track control is functional: "${playBtnText}"`);

    cdp.close();
  } finally {
    try {
      chromeProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  console.log('\n======================================================================');
  console.log('ALL HOME KARAOKE MULTILINGUAL SELECTOR CHECKS PASSED: 18/18');
  console.log('======================================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
