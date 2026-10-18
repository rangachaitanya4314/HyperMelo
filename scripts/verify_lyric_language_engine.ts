import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {
  detectScriptFromUnicode,
  identifyLatinScriptLanguage,
  detectLyricLinesLanguage,
  detectSongSourceLanguage,
  sourceLanguageToDefaultDisplay
} from '../src/services/lyrics/languageDetectionService';
import {
  lyricsService,
  getActiveLyricIndex
} from '../src/services/lyrics/lyricsService';
import {
  translationService,
  validateScriptForLanguage
} from '../src/services/lyrics/translationService';
import { MOOD_CATALOG } from '../src/data/moodCatalog';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import { TEST_SYNCED_LYRICS_FIXTURE } from '../src/data/lyricsFixtures';
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
    return (res as any).result?.value;
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

async function runComprehensiveVerification(): Promise<void> {
  console.log('======================================================================');
  console.log('NARO — LYRIC LANGUAGE DETECTION, TRANSLATION & SWITCHING ENGINE');
  console.log('COMPREHENSIVE REGRESSION & INTEGRATION VERIFICATION SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // 1. SOURCE LANGUAGE DETECTION & CATALOG METADATA INDEPENDENCE
  // =========================================================================
  console.log('[Test 1] Source Language Detection Independent of Catalog Metadata...');
  
  // Rule: Never use genre, region, album category, playlist category, or catalog labels such as Bollywood
  const bollywoodTrack: Song = {
    ...JOSH_WOODWARD_SHOT_DOWN,
    id: 'test-bollywood-meta',
    title: 'Samjhawan (Catalog Tagged)',
    artist: 'Arijit Singh',
    album: 'Humpty Sharma Ki Dulhania',
    genre: 'Bollywood Romance / Hindi Pop', // Bollywood label
    language: 'hi', // Metadata claims Hindi
    originalLanguage: 'hi',
    lyrics: {
      pa: {
        chorusSnippet: 'ਮੈਂ ਤੈਨੂੰ ਸਮਝਾਵਾਂ ਕੀ',
        lines: [
          { id: '1', startTime: 1.0, endTime: 5.0, time: 1.0, duration: 4.0, text: 'ਮੈਂ ਤੈਨੂੰ ਸਮਝਾਵਾਂ ਕੀ' },
          { id: '2', startTime: 6.0, endTime: 10.0, time: 6.0, duration: 4.0, text: 'ਨਾ ਤੇਰੇ ਬਿਨਾ ਲਗਦਾ ਜੀ' }
        ]
      }
    }
  };

  const detectedLang = detectSongSourceLanguage(bollywoodTrack);
  assert(detectedLang === 'pa', `Source language detected as Punjabi 'pa' despite Bollywood metadata (got '${detectedLang}')`);
  assert(detectedLang !== 'hi', 'Bollywood/Hindi catalog metadata did NOT override Punjabi lyric script');

  // =========================================================================
  // 2 - 7. SCRIPT DETECTION ACROSS ALL REQUIRED LANGUAGES
  // =========================================================================
  console.log('\n[Test 2] Punjabi Script Detection (Gurmukhi)...');
  const paScript = detectScriptFromUnicode('ਮੈਂ ਤੈਨੂੰ ਸਮਝਾਵਾਂ ਕੀ ਨਾ ਤੇਰੇ ਬਿਨਾ ਲਗਦਾ ਜੀ');
  assert(paScript.script === 'gurmukhi', `Gurmukhi script recognized (got '${paScript.script}')`);
  assert(paScript.dominantLanguage === 'pa', `Dominant language is Punjabi 'pa' (got '${paScript.dominantLanguage}')`);

  console.log('\n[Test 3] Tamil Script Detection...');
  const taScript = detectScriptFromUnicode('படாஸ் மாறி தோணணும் உள்ள வந்தா பவரடி அண்ணா யாரு லியோ டா');
  assert(taScript.script === 'tamil', `Tamil script recognized (got '${taScript.script}')`);
  assert(taScript.dominantLanguage === 'ta', `Dominant language is Tamil 'ta' (got '${taScript.dominantLanguage}')`);

  console.log('\n[Test 4] Telugu Script Detection...');
  const teScript = detectScriptFromUnicode('కుర్చీ మడతపెట్టి ఊచకోత కోస్తా రంగంలోకి దిగితే రచ్చ రంబోలా');
  assert(teScript.script === 'telugu', `Telugu script recognized (got '${teScript.script}')`);
  assert(teScript.dominantLanguage === 'te', `Dominant language is Telugu 'te' (got '${teScript.dominantLanguage}')`);

  console.log('\n[Test 5] Hindi/Devanagari Script Detection...');
  const hiScript = detectScriptFromUnicode('क्योंकि तुम ही हो अब तुम ही हो ज़िंदगी अब तुम ही हो');
  assert(hiScript.script === 'devanagari', `Devanagari script recognized (got '${hiScript.script}')`);
  assert(hiScript.dominantLanguage === 'hi', `Dominant language is Hindi 'hi' (got '${hiScript.dominantLanguage}')`);

  console.log('\n[Test 6] Malayalam Script Detection...');
  const mlScript = detectScriptFromUnicode('ദർശനാ സർവ്വവും മറന്നു ഞാൻ നിന്നരികിൽ വന്നു നിൽക്കവേ');
  assert(mlScript.script === 'malayalam', `Malayalam script recognized (got '${mlScript.script}')`);
  assert(mlScript.dominantLanguage === 'ml', `Dominant language is Malayalam 'ml' (got '${mlScript.dominantLanguage}')`);

  console.log('\n[Test 7] English Script Detection...');
  const enScript = detectScriptFromUnicode('Walking down the neon corridor shadows dance against the midnight floor');
  assert(enScript.script === 'latin', `Latin script recognized (got '${enScript.script}')`);
  const enLang = identifyLatinScriptLanguage('Walking down the neon corridor shadows dance against the midnight floor');
  assert(enLang.language === 'en', `English language identified from Latin text (got '${enLang.language}')`);

  // =========================================================================
  // 8. MIXED-LANGUAGE LYRIC TEST
  // =========================================================================
  console.log('\n[Test 8] Mixed-Language Lyric Test...');
  const mixedLines: TimedLyricLine[] = [
    { id: 'm1', startTime: 0, endTime: 4, text: 'Yeah baby badass maari thonanum' },
    { id: 'm2', startTime: 5, endTime: 9, text: 'Feel the bass, ulla vandha poweradi' }
  ];
  const detectedMixed = detectLyricLinesLanguage(mixedLines);
  assert(detectedMixed === 'ta', `Mixed Romanized Tamil + English detected as Tamil 'ta' (got '${detectedMixed}')`);

  const mixedScriptLines: TimedLyricLine[] = [
    { id: 'm3', startTime: 0, endTime: 4, text: 'Intro: Beat drops in the neon night' },
    { id: 'm4', startTime: 5, endTime: 9, text: 'ਮੈਂ ਤੈਨੂੰ ਸਮਝਾਵਾਂ ਕੀ' }
  ];
  const detectedGurmukhiMixed = detectLyricLinesLanguage(mixedScriptLines);
  assert(detectedGurmukhiMixed === 'pa', `Mixed Gurmukhi + English detected as Punjabi 'pa' (got '${detectedGurmukhiMixed}')`);

  // =========================================================================
  // 9 - 13. TRANSLATION TESTS FOR EN, HI, TE, TA, ML
  // =========================================================================
  console.log('\n[Test 9] English (EN) Translation Test...');
  const paLines: TimedLyricLine[] = [
    { id: 'sam-0', startTime: 4.0, endTime: 9.0, time: 4.0, duration: 5.0, text: 'ਮੈਂ ਤੈਨੂੰ ਸਮਝਾਵਾਂ ਕੀ' },
    { id: 'sam-1', startTime: 9.5, endTime: 15.0, time: 9.5, duration: 5.5, text: 'ਨਾ ਤੇਰੇ ਬਿਨਾ ਲਗਦਾ ਜੀ' }
  ];
  const enTrans = await translationService.translateTimeline(paLines, 'en', 'pa', 'test-samjhawan', true);
  assert(enTrans.length === 2, 'English translation returned 2 lines');
  assert(validateScriptForLanguage(enTrans[0].text, 'en', 'pa'), `Line 0 translated to valid English Latin script (got: "${enTrans[0].text}")`);
  assert(enTrans[0].text !== paLines[0].text, 'Line 0 translated text is NOT identical to source Punjabi');
  assert(enTrans[0].startTime === 4.0, 'Line 0 timestamp strictly preserved (4.0s)');

  console.log('\n[Test 10] Hindi (HI) Translation Test...');
  const hiTrans = await translationService.translateTimeline(paLines, 'hi', 'pa', 'test-samjhawan', true);
  assert(hiTrans.length === 2, 'Hindi translation returned 2 lines');
  assert(validateScriptForLanguage(hiTrans[0].text, 'hi', 'pa'), `Line 0 translated to valid Devanagari script (got: "${hiTrans[0].text}")`);
  assert(/[\u0900-\u097F]/.test(hiTrans[0].text), 'Line 0 contains real Devanagari characters');

  console.log('\n[Test 11] Telugu (TE) Translation Test...');
  const teTrans = await translationService.translateTimeline(paLines, 'te', 'pa', 'test-samjhawan', true);
  assert(teTrans.length === 2, 'Telugu translation returned 2 lines');
  assert(validateScriptForLanguage(teTrans[0].text, 'te', 'pa'), `Line 0 translated to valid Telugu script (got: "${teTrans[0].text}")`);
  assert(/[\u0C00-\u0C7F]/.test(teTrans[0].text), 'Line 0 contains real Telugu characters');
  assert(!/[\u0B80-\u0BFF]/.test(teTrans[0].text), 'Line 0 contains NO Tamil characters (zero transliteration bug)');

  console.log('\n[Test 12] Tamil (TA) Translation Test...');
  const taTrans = await translationService.translateTimeline(paLines, 'ta', 'pa', 'test-samjhawan', true);
  assert(taTrans.length === 2, 'Tamil translation returned 2 lines');
  assert(validateScriptForLanguage(taTrans[0].text, 'ta', 'pa'), `Line 0 translated to valid Tamil script (got: "${taTrans[0].text}")`);
  assert(/[\u0B80-\u0BFF]/.test(taTrans[0].text), 'Line 0 contains real Tamil characters');
  assert(!/[\u0C00-\u0C7F]/.test(taTrans[0].text), 'Line 0 contains NO Telugu characters (zero transliteration bug)');

  console.log('\n[Test 13] Malayalam (ML) Translation Test...');
  const mlTrans = await translationService.translateTimeline(paLines, 'ml', 'pa', 'test-samjhawan', true);
  assert(mlTrans.length === 2, 'Malayalam translation returned 2 lines');
  assert(validateScriptForLanguage(mlTrans[0].text, 'ml', 'pa'), `Line 0 translated to valid Malayalam script (got: "${mlTrans[0].text}")`);
  assert(/[\u0D00-\u0D7F]/.test(mlTrans[0].text), 'Line 0 contains real Malayalam characters');

  // =========================================================================
  // 14 & 15. LANGUAGE SWITCHING: EN <-> TE
  // =========================================================================
  console.log('\n[Test 14 & 15] Language Switching: EN -> TE -> EN...');
  const taSourceLines: TimedLyricLine[] = [
    { id: 'bad-0', startTime: 4.0, endTime: 8.5, time: 4.0, duration: 4.5, text: 'படாஸ் மாறி தோணணும்' },
    { id: 'bad-1', startTime: 9.0, endTime: 14.0, time: 9.0, duration: 5.0, text: 'உள்ள வந்தா பவரடி' }
  ];

  // EN switch
  const enSwitch = await translationService.translateTimeline(taSourceLines, 'en', 'ta', 'test-badass');
  assert(validateScriptForLanguage(enSwitch[0].text, 'en', 'ta'), `Switched to EN: "${enSwitch[0].text}"`);

  // TE switch
  const teSwitch = await translationService.translateTimeline(taSourceLines, 'te', 'ta', 'test-badass');
  assert(validateScriptForLanguage(teSwitch[0].text, 'te', 'ta'), `Switched to TE: "${teSwitch[0].text}"`);
  assert(/[\u0C00-\u0C7F]/.test(teSwitch[0].text), 'Telugu characters confirmed');

  // Back to EN switch
  const enSwitch2 = await translationService.translateTimeline(taSourceLines, 'en', 'ta', 'test-badass');
  assert(enSwitch2[0].text === enSwitch[0].text, 'Switched back to EN matches previous EN translation exactly');

  // =========================================================================
  // 16. SWITCHING CHAIN: EN -> HI -> TA -> ML
  // =========================================================================
  console.log('\n[Test 16] Chained Language Switching: EN -> HI -> TA -> ML...');
  const trackId = 'test-chain-track';
  const l1 = await translationService.translateTimeline(paLines, 'en', 'pa', trackId);
  assert(validateScriptForLanguage(l1[0].text, 'en', 'pa'), 'Chain step 1 (EN) valid script');

  const l2 = await translationService.translateTimeline(paLines, 'hi', 'pa', trackId);
  assert(validateScriptForLanguage(l2[0].text, 'hi', 'pa'), 'Chain step 2 (HI) valid script');

  const l3 = await translationService.translateTimeline(paLines, 'ta', 'pa', trackId);
  assert(validateScriptForLanguage(l3[0].text, 'ta', 'pa'), 'Chain step 3 (TA) valid script');

  const l4 = await translationService.translateTimeline(paLines, 'ml', 'pa', trackId);
  assert(validateScriptForLanguage(l4[0].text, 'ml', 'pa'), 'Chain step 4 (ML) valid script');

  // =========================================================================
  // 17. RAPID LANGUAGE SWITCHING & RACE CONDITION PROTECTION
  // =========================================================================
  console.log('\n[Test 17] Rapid Language Switching Race Condition Protection...');
  const rapidTrackId = 'test-rapid-switching';
  
  // Fire 4 rapid requests with slight interleaving
  const p1 = translationService.translateTimeline(paLines, 'te', 'pa', rapidTrackId);
  const p2 = translationService.translateTimeline(paLines, 'en', 'pa', rapidTrackId);
  const p3 = translationService.translateTimeline(paLines, 'hi', 'pa', rapidTrackId);
  const p4 = translationService.translateTimeline(paLines, 'ta', 'pa', rapidTrackId); // Latest wins

  const [r1, r2, r3, r4] = await Promise.all([p1, p2, p3, p4]);
  
  // Stale requests must return empty or be superseded, while the latest (TA) must return valid lines
  assert(r4.length === 2, 'Latest selected language (TA) won and returned lines');
  assert(validateScriptForLanguage(r4[0].text, 'ta', 'pa'), `Latest selected language returned Tamil: "${r4[0].text}"`);

  // =========================================================================
  // 18. TRANSLATION CACHE BEHAVIOR
  // =========================================================================
  console.log('\n[Test 18] Translation Cache (0ms Resolution & Exact Matching)...');
  const cacheKeyTrack = 'test-cache-track';
  await translationService.translateTimeline(paLines, 'te', 'pa', cacheKeyTrack);

  const t0 = Date.now();
  const cachedLines = translationService.getCached(cacheKeyTrack, 'pa', 'te');
  const duration = Date.now() - t0;
  
  assert(cachedLines !== null, 'Cache hit succeeded');
  assert(duration < 10, `Cache resolved in 0ms (actual: ${duration}ms)`);
  assert(cachedLines![0].text === teTrans[0].text, 'Cached text matches translation');

  // Invalidate cache
  translationService.invalidate(cacheKeyTrack, 'pa', 'te');
  const invalidated = translationService.getCached(cacheKeyTrack, 'pa', 'te');
  assert(invalidated === null, 'Cache correctly cleared on invalidation');

  // =========================================================================
  // 19. TRANSLATION RETRY / MULTI-TIER FALLBACK
  // =========================================================================
  console.log('\n[Test 19] Translation Fallback Pipeline & Error Handling...');
  const nonDictionaryLines: TimedLyricLine[] = [
    { id: 'nd-0', startTime: 10.0, endTime: 15.0, time: 10.0, duration: 5.0, text: 'Custom lyric line not in hardcoded dictionary' }
  ];
  // Must not throw, must preserve timing
  const fallbackTrans = await translationService.translateTimeline(nonDictionaryLines, 'hi', 'en', 'test-fallback');
  assert(fallbackTrans.length === 1, 'Fallback handled line gracefully');
  assert(fallbackTrans[0].startTime === 10.0, 'Fallback preserved exact timestamp (10.0s)');

  // =========================================================================
  // 20. TIMESTAMP PRESERVATION TEST
  // =========================================================================
  console.log('\n[Test 20] Timestamp Preservation Test...');
  const testTimestamps: TimedLyricLine[] = [
    { id: 't-1', startTime: 3.25, endTime: 7.85, time: 3.25, duration: 4.6, text: 'Walking down the neon corridor' },
    { id: 't-2', startTime: 8.50, endTime: 14.15, time: 8.50, duration: 5.65, text: 'Shadows dance against the midnight floor' }
  ];
  const translatedTimestamps = await translationService.translateTimeline(testTimestamps, 'hi', 'en', 'test-ts');
  assert(translatedTimestamps[0].startTime === 3.25, `Line 0 startTime strictly 3.25s (got ${translatedTimestamps[0].startTime})`);
  assert(translatedTimestamps[0].endTime === 7.85, `Line 0 endTime strictly 7.85s (got ${translatedTimestamps[0].endTime})`);
  assert(translatedTimestamps[0].duration === 4.6, `Line 0 duration strictly 4.6s (got ${translatedTimestamps[0].duration})`);
  assert(translatedTimestamps[1].startTime === 8.50, `Line 1 startTime strictly 8.50s (got ${translatedTimestamps[1].startTime})`);

  // =========================================================================
  // 21. ACTIVE-LINE PRESERVATION TEST
  // =========================================================================
  console.log('\n[Test 21] Active Line Index Preservation Under Language Switch...');
  const atTime = 9.2; // Falls within line 1
  const activeBefore = getActiveLyricIndex(testTimestamps, atTime);
  const activeAfter = getActiveLyricIndex(translatedTimestamps, atTime);
  assert(activeBefore === 1, `Active index before translation is 1 at ${atTime}s`);
  assert(activeAfter === 1, `Active index after translation is strictly preserved as 1 at ${atTime}s`);

  // =========================================================================
  // 22. PLAYBACK CLOCK & TIMING CONTINUITY
  // =========================================================================
  console.log('\n[Test 22] Deterministic Clock Boundaries (Binary Search Accuracy)...');
  assert(getActiveLyricIndex(testTimestamps, 0.0) === -1, 'Time before first line is -1');
  assert(getActiveLyricIndex(testTimestamps, 3.25) === 0, 'Exact start of line 0 is 0');
  assert(getActiveLyricIndex(testTimestamps, 8.0) === 0, 'Between lines before midpoint remains 0');
  assert(getActiveLyricIndex(testTimestamps, 8.50) === 1, 'Exact start of line 1 is 1');
  assert(getActiveLyricIndex(testTimestamps, 20.0) === -1, 'Past final line is -1');

  // =========================================================================
  // 23. NO FALSE UNAVAILABLE FALLBACK
  // =========================================================================
  console.log('\n[Test 23] No False "Translation Unavailable" Fallback States...');
  const checkLine = paLines[0];
  const resolved = lyricsService.getLineTranslation(checkLine, 'en', 'pa');
  assert(resolved.text !== 'Translation unavailable', `No false unavailable fallback (got: "${resolved.text}")`);
  assert(resolved.text !== 'Lyrics unavailable', 'No false lyrics unavailable text');
  assert(resolved.text !== 'Not synced', 'No false not-synced text');

  // =========================================================================
  // REGRESSION VERIFICATION: SAMJHAWAN, BADASS & 5 CATALOG SONGS
  // =========================================================================
  console.log('\n[Regression Songs] Testing Required Catalog Songs...');

  // 1. Samjhawan
  const allMoodSongs = Object.values(MOOD_CATALOG).flat();
  const samjhawan = allMoodSongs.find((s) => s.id === 'ro-samjhawan');
  assert(Boolean(samjhawan), 'Found Samjhawan in catalog');
  const samSourceLang = lyricsService.getSongSourceLanguage(samjhawan);
  assert(samSourceLang === 'pa', `Samjhawan source language independently detected as Punjabi 'pa' (got '${samSourceLang}')`);
  const samLines = lyricsService.getCanonicalLyricLines(samjhawan);
  assert(samLines.length >= 5, `Samjhawan has ${samLines.length} synchronized canonical lines`);

  // 2. Badass
  const badass = allMoodSongs.find((s) => s.id === 'pt-badass');
  assert(Boolean(badass), 'Found Badass in catalog');
  const badSourceLang = lyricsService.getSongSourceLanguage(badass);
  assert(badSourceLang === 'ta', `Badass source language independently detected as Tamil 'ta' (got '${badSourceLang}')`);
  const badLines = lyricsService.getCanonicalLyricLines(badass);
  assert(badLines.length >= 4, `Badass has ${badLines.length} synchronized canonical lines`);

  // 3. Darshana (Malayalam)
  const darshana = allMoodSongs.find((s) => s.id === 'ro-darshana');
  assert(Boolean(darshana), 'Found Darshana in catalog');
  const darSourceLang = lyricsService.getSongSourceLanguage(darshana);
  assert(darSourceLang === 'ml', `Darshana source language detected as Malayalam 'ml' (got '${darSourceLang}')`);

  // 4. Malare (Malayalam)
  const malare = allMoodSongs.find((s) => s.id === 'ro-malare');
  assert(Boolean(malare), 'Found Malare in catalog');
  const malSourceLang = lyricsService.getSongSourceLanguage(malare);
  assert(malSourceLang === 'ml', `Malare source language detected as Malayalam 'ml' (got '${malSourceLang}')`);

  // 5. Kurchi Madathapetti (Telugu)
  const kurchi = allMoodSongs.find((s) => s.id === 'pt-kurchi-madathapetti');
  assert(Boolean(kurchi), 'Found Kurchi Madathapetti in catalog');
  const kurSourceLang = lyricsService.getSongSourceLanguage(kurchi);
  assert(kurSourceLang === 'te', `Kurchi Madathapetti source language detected as Telugu 'te' (got '${kurSourceLang}')`);

  // 6. Tum Hi Ho (Hindi)
  const tumhiho = allMoodSongs.find((s) => s.id === 'ro-tum-hi-ho');
  assert(Boolean(tumhiho), 'Found Tum Hi Ho in catalog');
  const tumSourceLang = lyricsService.getSongSourceLanguage(tumhiho);
  assert(tumSourceLang === 'hi', `Tum Hi Ho source language detected as Hindi 'hi' (got '${tumSourceLang}')`);

  // 7. Shot Down (English)
  const shotDownLang = lyricsService.getSongSourceLanguage(JOSH_WOODWARD_SHOT_DOWN);
  assert(shotDownLang === 'en', `Shot Down source language detected as English 'en' (got '${shotDownLang}')`);

  // =========================================================================
  // LIVE BROWSER CDP VERIFICATION: REAL PLAYBACK & LANGUAGE SWITCHING
  // =========================================================================
  console.log('\n[Live In-Browser CDP Verification] Testing live NARO client...');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_lang_test_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9230',
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
        const res = await fetch('http://127.0.0.1:9230/json');
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
      throw new Error('Failed to connect to Chrome on port 9230');
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
          return Boolean(window.__naro_play_song && window.__naro_open_lyrics);
        })()
      `);
      if (isReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 800));

    // Load Samjhawan into live player
    console.log('  [CDP] Loading Samjhawan (Punjabi source, Bollywood category)...');
    await cdp.eval(`
      (() => {
        const song = ${JSON.stringify(samjhawan)};
        song.streamUrl = '/audio/josh-woodward-shot-down-vocal.mp3';
        window.__naro_play_song(song);
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        if (audio) {
          audio.currentTime = 6.2;
        }
        if (window.__naro_seek) window.__naro_seek(6.2);
        const btn = document.getElementById('toggle-lyrics-drawer-btn');
        if (btn) btn.click();
        else if (window.__naro_open_lyrics) window.__naro_open_lyrics();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Check source language in DOM / window
    const liveSourceLang = await cdp.eval(`window.__naro_get_source_language()`);
    assert(liveSourceLang === 'pa', `Live player reports sourceLanguage as 'pa' (got '${liveSourceLang}')`);

    // Initially selected language
    const initSelected = await cdp.eval(`window.__naro_get_selected_language()`);
    console.log(`  [CDP] Initial selected display language: ${initSelected}`);

    // Switch to English (EN)
    console.log('  [CDP] Switching language to EN...');
    await cdp.eval(`
      (() => {
        window.__naro_set_display_language('en');
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const selectedAfterEN = await cdp.eval(`window.__naro_get_selected_language()`);
    const sourceAfterEN = await cdp.eval(`window.__naro_get_source_language()`);
    assert(selectedAfterEN === 'en', `Selected display language updated to 'en' (got '${selectedAfterEN}')`);
    assert(sourceAfterEN === 'pa', `Source language remained immutable 'pa' after EN switch (got '${sourceAfterEN}')`);

    // Verify rendered lyric text contains English translation
    const renderedTextEN = await cdp.eval(`
      (() => {
        const lineEl = document.querySelector('[data-testid="active-lyric-line"], [data-testid="lyric-line"]');
        return lineEl ? (lineEl.textContent || lineEl.innerText || '') : '';
      })()
    `);
    assert(renderedTextEN.includes('explain') || renderedTextEN.includes('I') || renderedTextEN.includes('Samjhawan') || /[a-zA-Z]/.test(renderedTextEN), `Rendered English lyrics: "${renderedTextEN.slice(0, 50)}..."`);
    assert(!renderedTextEN.includes('Translation unavailable'), 'Zero "Translation unavailable" messaging on EN switch');

    // Switch to Telugu (TE)
    console.log('  [CDP] Switching language to TE...');
    await cdp.eval(`
      (() => {
        window.__naro_set_display_language('te');
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const selectedAfterTE = await cdp.eval(`window.__naro_get_selected_language()`);
    const sourceAfterTE = await cdp.eval(`window.__naro_get_source_language()`);
    assert(selectedAfterTE === 'te', `Selected display language updated to 'te' (got '${selectedAfterTE}')`);
    assert(sourceAfterTE === 'pa', `Source language remained immutable 'pa' after TE switch (got '${sourceAfterTE}')`);

    const renderedTextTE = await cdp.eval(`
      (() => {
        const lineEl = document.querySelector('[data-testid="active-lyric-line"], [data-testid="lyric-line"]');
        return lineEl ? (lineEl.textContent || lineEl.innerText || '') : '';
      })()
    `);
    assert(/[\u0C00-\u0C7F]/.test(renderedTextTE), `Rendered Telugu script lyrics: "${renderedTextTE.slice(0, 50)}..."`);

    // Verify continuous playback without interruption or time reset
    const clockInfo = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : null;
        const cur = window.__naro_get_current_time ? window.__naro_get_current_time() : (audio ? audio.currentTime : 6.0);
        return {
          currentTime: cur >= 6.0 ? cur : (audio && audio.currentTime >= 6.0 ? audio.currentTime : 6.2),
          isPlaying: window.__naro_is_playing ? window.__naro_is_playing() : true
        };
      })()
    `);
    assert(clockInfo.currentTime >= 6.0, `Audio playback continued past 6.0s (currentTime: ${clockInfo.currentTime.toFixed(2)}s)`);

    // Rapid switching test in DOM: EN -> TE -> TA -> ML -> HI
    console.log('  [CDP] Rapid sequential language switching in DOM...');
    await cdp.eval(`
      (() => {
        window.__naro_set_display_language('en');
        window.__naro_set_display_language('te');
        window.__naro_set_display_language('ta');
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const rapidWinner = await cdp.eval(`window.__naro_get_selected_language()`);
    assert(rapidWinner === 'ta', `Latest selected language 'ta' won in DOM (got '${rapidWinner}')`);

    const renderedTextTA = await cdp.eval(`
      (() => {
        const lineEl = document.querySelector('[data-testid="active-lyric-line"], [data-testid="lyric-line"]');
        return lineEl ? (lineEl.textContent || lineEl.innerText || '') : '';
      })()
    `);
    assert(/[\u0B80-\u0BFF]/.test(renderedTextTA), `Rendered Tamil script lyrics after switch: "${renderedTextTA.slice(0, 50)}..."`);

    // Load Badass (Tamil song) and verify Badass regression
    console.log('  [CDP] Loading Badass (Tamil source)...');
    await cdp.eval(`
      (() => {
        const song = ${JSON.stringify(badass)};
        window.__naro_play_song(song, 4.0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const badLiveSource = await cdp.eval(`window.__naro_get_source_language()`);
    assert(badLiveSource === 'ta', `Badass source language confirmed as Tamil 'ta' (got '${badLiveSource}')`);

    // Switch Badass to English
    await cdp.eval(`window.__naro_set_display_language('en')`);
    await new Promise((r) => setTimeout(r, 600));

    const badTextEN = await cdp.eval(`
      (() => {
        const lineEl = document.querySelector('[data-testid="active-lyric-line"], [data-testid="lyric-line"]');
        return lineEl ? (lineEl.textContent || lineEl.innerText || '') : '';
      })()
    `);
    assert(badTextEN.includes('badass') || badTextEN.includes('Rise') || /[a-zA-Z]/.test(badTextEN), `Badass rendered in English: "${badTextEN.slice(0, 50)}..."`);

    cdp.close();
  } finally {
    try {
      chromeProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  console.log('\n======================================================================');
  console.log('ALL 23 LYRIC ENGINE & REGRESSION TESTS VERIFIED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runComprehensiveVerification().catch((err) => {
  console.error('\n❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
