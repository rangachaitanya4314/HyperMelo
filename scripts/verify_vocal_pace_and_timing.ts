// Verification Suite for Weighted Vocal Pace & Dynamic Highlight Timing
// Verifies:
// 1. Word timing fallback calculation based on syllable/vowel count and phrase position (final word extra weight).
// 2. Pre-existing word-level timestamps preservation.
// 3. Line pace calculation (syllables / (lineEnd - lineStart)).
// 4. Fast pace (> 4.5/s) instantaneous wipe transition (0.05s).
// 5. Slow pace (< 2.5/s) smooth transition curve cubic-bezier(0.2, 0.8, 0.2, 1).
// 6. Indic scripts (Telugu, Hindi, Tamil, Malayalam) word splitting along syllable vowel clusters.
// 7. Indic transliterations word splitting along syllable vowel clusters.
// 8. Integration across lyricsSync.ts and lyricsService.ts.

import {
  calculateLinePace,
  getPaceTransition,
  getWipeTransition,
  calculateWordTimingFallback,
  wordTimingFallback,
  applyWordTimingFallback,
  splitIndicAksharas,
  splitTransliterationSyllables,
  splitIndicSyllables,
  countSyllables,
  countLineSyllables,
  isIndicScript,
  isIndicTransliteration
} from '../src/services/lyrics/lyricsSync';

import {
  lyricsService,
  calculateLinePace as serviceCalculateLinePace,
  getPaceTransition as serviceGetPaceTransition,
  calculateWordTimingFallback as serviceCalculateWordTimingFallback
} from '../src/services/lyrics/lyricsService';

import type { TimedLyricLine, LyricWord } from '../src/shared/lyrics';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runVerification() {
  console.log('======================================================================');
  console.log('NARO — WEIGHTED VOCAL PACE & DYNAMIC HIGHLIGHT TIMING VERIFICATION');
  console.log('======================================================================\n');

  // =========================================================================
  // TEST 1: Word Timing Fallback (Syllable/Vowel Count & Final Word Weight)
  // =========================================================================
  console.log('[Test 1] Word Timing Fallback (Syllable Count & Phrase Position Weighting)...');
  const lineNoWords: TimedLyricLine = {
    id: 'test-line-1',
    text: 'Yesterday all my troubles seemed so far away',
    startTime: 10.0,
    endTime: 14.0,
    duration: 4.0
  };

  const wordsFallback = calculateWordTimingFallback(lineNoWords);
  assert(Array.isArray(wordsFallback) && wordsFallback.length > 0, 'Word timing fallback returns non-empty array of LyricWords');
  assert(wordsFallback[0].start === 10.0, `First word starts at line start (10.0s, got ${wordsFallback[0].start}s)`);
  assert(wordsFallback[wordsFallback.length - 1].end === 14.0, `Final word ends at line end (14.0s, got ${wordsFallback[wordsFallback.length - 1].end}s)`);

  // Verify timestamps are strictly ascending and contiguous
  for (let i = 0; i < wordsFallback.length - 1; i++) {
    assert(wordsFallback[i].start < wordsFallback[i].end, `Word ${i} (${wordsFallback[i].text}) has positive duration`);
    assert(Math.abs(wordsFallback[i].end - wordsFallback[i + 1].start) < 0.001, `Word ${i} and ${i + 1} are contiguous`);
  }

  // Compare multi-syllable word vs single-syllable word duration:
  // "Yesterday" (3 syllables) should have longer duration than "all" (1 syllable)
  const yesterdayWord = wordsFallback.find((w) => w.text.toLowerCase().includes('yesterday'))!;
  const allWord = wordsFallback.find((w) => w.text.toLowerCase() === 'all')!;
  assert(
    (yesterdayWord.end - yesterdayWord.start) > (allWord.end - allWord.start),
    `Multi-syllable word "Yesterday" (${(yesterdayWord.end - yesterdayWord.start).toFixed(2)}s) receives more duration than monosyllabic "all" (${(allWord.end - allWord.start).toFixed(2)}s)`
  );

  // Compare final word "away" (2 syllables) with non-final 2-syllable word "troubles":
  // Final word has phrase position weighting (1.5x)
  const finalAwayWord = wordsFallback[wordsFallback.length - 1];
  const troublesWord = wordsFallback.find((w) => w.text.toLowerCase().includes('troubles'))!;
  const finalDurationPerSyllable = (finalAwayWord.end - finalAwayWord.start) / 2;
  const nonFinalDurationPerSyllable = (troublesWord.end - troublesWord.start) / 2;
  assert(
    finalDurationPerSyllable > nonFinalDurationPerSyllable,
    `Final word "away" has higher duration per syllable (${finalDurationPerSyllable.toFixed(3)}s) than non-final "troubles" (${nonFinalDurationPerSyllable.toFixed(3)}s) due to phrase position extra weight`
  );

  // =========================================================================
  // TEST 2: Pre-existing Word Timestamps in LRC Payload Are Preserved
  // =========================================================================
  console.log('\n[Test 2] Pre-existing Word Timestamps in LRC Payload Are Preserved...');
  const existingWords: LyricWord[] = [
    { text: 'Custom', start: 10.0, end: 11.2 },
    { text: 'Payload', start: 11.2, end: 12.8 },
    { text: 'Timing', start: 12.8, end: 14.0 }
  ];
  const lineWithExistingWords: TimedLyricLine = {
    id: 'test-line-custom',
    text: 'Custom Payload Timing',
    startTime: 10.0,
    endTime: 14.0,
    words: existingWords
  };

  const preservedWords = calculateWordTimingFallback(lineWithExistingWords);
  assert(preservedWords === existingWords, 'Pre-existing word timestamps in LRC payload are preserved exactly');
  assert(preservedWords[0].end === 11.2, 'Custom word end timestamp 11.2s preserved');

  // =========================================================================
  // TEST 3: Pace Calculation (Syllables Per Second)
  // =========================================================================
  console.log('\n[Test 3] Pace Calculation: syllables / (lineEnd - lineStart)...');
  // 12 syllables in 2.0 seconds -> 6.0 / s (fast)
  const fastPace = calculateLinePace(12, 0, 2.0);
  assert(fastPace === 6.0, `Line pace 12 syllables in 2.0s = 6.0/s (got ${fastPace})`);

  // 4 syllables in 2.0 seconds -> 2.0 / s (slow)
  const slowPace = calculateLinePace(4, 0, 2.0);
  assert(slowPace === 2.0, `Line pace 4 syllables in 2.0s = 2.0/s (got ${slowPace})`);

  // 7 syllables in 2.0 seconds -> 3.5 / s (moderate)
  const moderatePace = calculateLinePace(7, 0, 2.0);
  assert(moderatePace === 3.5, `Line pace 7 syllables in 2.0s = 3.5/s (got ${moderatePace})`);

  // Test edge case (lineEnd <= lineStart)
  const zeroDurationPace = calculateLinePace(5, 10.0, 10.0);
  assert(Number.isFinite(zeroDurationPace) && zeroDurationPace > 0, 'Zero duration handled safely without NaN or Infinity');

  // =========================================================================
  // TEST 4: Dynamic Wipe Transition for Fast Pace (> 4.5/s)
  // =========================================================================
  console.log('\n[Test 4] Fast Pace (> 4.5/s) Transition Timing...');
  const fastConfig = getPaceTransition(5.2);
  assert(fastConfig.category === 'fast', `Pace 5.2/s recognized as fast (category: ${fastConfig.category})`);
  assert(fastConfig.durationCss === '0.05s', `Pace 5.2/s has instantaneous wipe duration (0.05s, got ${fastConfig.durationCss})`);
  assert(fastConfig.durationSeconds === 0.05, `durationSeconds is 0.05 (got ${fastConfig.durationSeconds})`);
  assert(fastConfig.transitionCss.includes('0.05s'), `transitionCss includes 0.05s (got "${fastConfig.transitionCss}")`);

  const wipeFast = getWipeTransition(4.8);
  assert(wipeFast.isInstantaneous === true, 'Pace 4.8/s marked as instantaneous');
  assert(wipeFast.duration === '0.05s', 'Pace 4.8/s wipe duration is 0.05s');

  // =========================================================================
  // TEST 5: Dynamic Wipe Transition for Slow Pace (< 2.5/s)
  // =========================================================================
  console.log('\n[Test 5] Slow Pace (< 2.5/s) Transition Timing (cubic-bezier(0.2, 0.8, 0.2, 1))...');
  const slowConfig = getPaceTransition(1.8);
  assert(slowConfig.category === 'slow', `Pace 1.8/s recognized as slow (category: ${slowConfig.category})`);
  assert(
    slowConfig.timingFunction === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    `Pace 1.8/s uses smoothed curve cubic-bezier(0.2, 0.8, 0.2, 1) (got ${slowConfig.timingFunction})`
  );
  assert(
    slowConfig.transitionCss.includes('cubic-bezier(0.2, 0.8, 0.2, 1)'),
    `transitionCss includes cubic-bezier(0.2, 0.8, 0.2, 1) (got "${slowConfig.transitionCss}")`
  );

  const wipeSlow = getWipeTransition(2.1);
  assert(wipeSlow.isSmooth === true, 'Pace 2.1/s marked as smooth');
  assert(wipeSlow.timingFunction === 'cubic-bezier(0.2, 0.8, 0.2, 1)', 'Pace 2.1/s timingFunction matches requirement');

  // =========================================================================
  // TEST 6: Indic Scripts Vowel Cluster Akshara Splitting
  // =========================================================================
  console.log('\n[Test 6] Indic Scripts (Telugu, Hindi, Tamil, Malayalam) Vowel Cluster Splitting...');
  // Telugu
  const teluguWord = 'కలశాల'; // 4 syllables: ka-la-shaa-la
  const teluguSyllables = splitIndicAksharas(teluguWord);
  assert(isIndicScript(teluguWord), 'Recognized as Indic script');
  assert(teluguSyllables.length === 4, `Telugu "కలశాల" split into 4 syllables (got ${teluguSyllables.length}: ${JSON.stringify(teluguSyllables)})`);
  assert(teluguSyllables.join('') === teluguWord, 'Telugu akshara join recreates original word without loss');

  // Telugu with conjunct
  const teluguConjunct = 'స్నేహం'; // sne-ham
  const teluguConjSyllables = splitIndicAksharas(teluguConjunct);
  assert(teluguConjSyllables.length === 2, `Telugu "స్నేహం" split into 2 syllables (got ${JSON.stringify(teluguConjSyllables)})`);

  // Hindi / Devanagari
  const hindiWord = 'दीवाना'; // dee-waa-naa
  const hindiSyllables = splitIndicAksharas(hindiWord);
  assert(hindiSyllables.length === 3, `Hindi "दीवाना" split into 3 syllables (got ${hindiSyllables.length}: ${JSON.stringify(hindiSyllables)})`);
  assert(hindiSyllables.join('') === hindiWord, 'Hindi akshara join recreates original word without loss');

  // Tamil
  const tamilWord = 'வணக்கம்'; // va-nak-kam
  const tamilSyllables = splitIndicAksharas(tamilWord);
  assert(tamilSyllables.length === 3, `Tamil "வணக்கம்" split into 3 syllables (got ${JSON.stringify(tamilSyllables)})`);
  assert(tamilSyllables.join('') === tamilWord, 'Tamil akshara join recreates original word without loss');

  // Malayalam
  const malayalamWord = 'നന്ദി'; // nan-di
  const malSyllables = splitIndicAksharas(malayalamWord);
  assert(malSyllables.length === 2, `Malayalam "നന്ദി" split into 2 syllables (got ${JSON.stringify(malSyllables)})`);
  assert(malSyllables.join('') === malayalamWord, 'Malayalam akshara join recreates original word without loss');

  // =========================================================================
  // TEST 7: Indic Transliterations Vowel Cluster Splitting
  // =========================================================================
  console.log('\n[Test 7] Indic Transliterations Vowel Cluster Splitting...');
  // "kalasala"
  const translitKalasala = splitTransliterationSyllables('kalasala');
  assert(
    translitKalasala.length === 4 && translitKalasala.join('') === 'kalasala',
    `Transliteration "kalasala" split into 4 syllable vowel clusters: ${JSON.stringify(translitKalasala)}`
  );
  assert(translitKalasala[0] === 'ka' && translitKalasala[1] === 'la' && translitKalasala[2] === 'sa' && translitKalasala[3] === 'la', 'Syallables are ["ka", "la", "sa", "la"]');

  // "chinukula"
  const translitChinukula = splitTransliterationSyllables('chinukula');
  assert(
    translitChinukula.length === 4 && translitChinukula.join('') === 'chinukula',
    `Transliteration "chinukula" split into 4 syllable vowel clusters: ${JSON.stringify(translitChinukula)}`
  );

  // "kesariya"
  const translitKesariya = splitTransliterationSyllables('kesariya');
  assert(
    translitKesariya.length === 4 && translitKesariya.join('') === 'kesariya',
    `Transliteration "kesariya" split into 4 syllable vowel clusters: ${JSON.stringify(translitKesariya)}`
  );

  // "deewana"
  const translitDeewana = splitTransliterationSyllables('deewana');
  assert(
    translitDeewana.length === 3 && translitDeewana.join('') === 'deewana',
    `Transliteration "deewana" split into 3 syllable vowel clusters: ${JSON.stringify(translitDeewana)}`
  );

  // "dilbaro"
  const translitDilbaro = splitTransliterationSyllables('dilbaro');
  assert(
    translitDilbaro.length === 3 && translitDilbaro.join('') === 'dilbaro',
    `Transliteration "dilbaro" split into 3 syllable vowel clusters: ${JSON.stringify(translitDilbaro)}`
  );

  // "nannu" (geminate consonant)
  const translitNannu = splitTransliterationSyllables('nannu');
  assert(
    translitNannu.length === 2 && translitNannu[0] === 'nan' && translitNannu[1] === 'nu',
    `Transliteration "nannu" split cleanly across geminate: ${JSON.stringify(translitNannu)}`
  );

  // "samajavaragamana" (compound multi-syllable word)
  const translitSamaja = splitTransliterationSyllables('samajavaragamana');
  assert(
    translitSamaja.length === 8 && translitSamaja.join('') === 'samajavaragamana',
    `Compound "samajavaragamana" split into 8 beat-matching syllables: ${JSON.stringify(translitSamaja)}`
  );

  // =========================================================================
  // TEST 8: Indic Line Word Timing Fallback Generates Syllable-Level Wipes
  // =========================================================================
  console.log('\n[Test 8] Indic Line Word Timing Fallback Generates Syllable-Level Wipes...');
  const translitLine: TimedLyricLine = {
    id: 'translit-1',
    text: 'kalasala lona valenu vayase',
    original_language: 'te',
    startTime: 20.0,
    endTime: 24.0,
    duration: 4.0
  };

  const translitWords = calculateWordTimingFallback(translitLine);
  // "kalasala" (4) + "lona" (2) + "valenu" (3) + "vayase" (3) = 12 syllable chunks
  assert(
    translitWords.length === 12,
    `Multi-syllable compound words split along syllable vowel clusters so wipe matches beat (12 syllable chunks, got ${translitWords.length})`
  );
  assert(translitWords[0].text === 'ka', `First syllable unit is "ka" (start: ${translitWords[0].start}s)`);
  assert(translitWords[translitWords.length - 1].end === 24.0, `Final syllable ends exactly at line end (24.0s)`);

  // Native Telugu script line
  const teluguLine: TimedLyricLine = {
    id: 'telugu-1',
    text: 'కలశాల లోన వాలెను వయసే',
    startTime: 20.0,
    endTime: 24.0,
    duration: 4.0
  };
  const teluguWords = calculateWordTimingFallback(teluguLine);
  assert(
    teluguWords.length === 12,
    `Native Telugu compound words split along akshara vowel clusters (12 chunks, got ${teluguWords.length}: ${teluguWords.map((w) => w.text).join(' | ')})`
  );

  // =========================================================================
  // TEST 9: applyWordTimingFallback Integration
  // =========================================================================
  console.log('\n[Test 9] applyWordTimingFallback and Service Integration...');
  const fastIndicLine: TimedLyricLine = {
    id: 'fast-line',
    text: 'kalasala lona valenu vayase', // 12 syllables in 2.0s -> pace 6.0/s (> 4.5/s)
    startTime: 0,
    endTime: 2.0,
    duration: 2.0
  };

  const enrichedFast = applyWordTimingFallback(fastIndicLine);
  assert(enrichedFast.pace === 6.0, `Pace measured as 6.0/s (got ${enrichedFast.pace})`);
  assert(enrichedFast.paceCategory === 'fast', `Pace category is "fast" (got ${enrichedFast.paceCategory})`);
  assert(enrichedFast.wipeDuration === '0.05s', `Fast line has instantaneous wipe duration 0.05s (got ${enrichedFast.wipeDuration})`);
  assert(enrichedFast.wipeTransition === 'all 0.05s linear', `Fast line has instantaneous transition (got ${enrichedFast.wipeTransition})`);

  const slowIndicLine: TimedLyricLine = {
    id: 'slow-line',
    text: 'priyatama nannu', // 6 syllables in 4.0s -> pace 1.5/s (< 2.5/s)
    startTime: 0,
    endTime: 4.0,
    duration: 4.0
  };

  const enrichedSlow = applyWordTimingFallback(slowIndicLine);
  assert(enrichedSlow.pace === 1.5, `Pace measured as 1.5/s (got ${enrichedSlow.pace})`);
  assert(enrichedSlow.paceCategory === 'slow', `Pace category is "slow" (got ${enrichedSlow.paceCategory})`);
  assert(
    enrichedSlow.wipeTimingFunction === 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    `Slow line uses cubic-bezier(0.2, 0.8, 0.2, 1) (got ${enrichedSlow.wipeTimingFunction})`
  );

  // Verify lyricsService re-exports match lyricsSync implementation
  assert(typeof lyricsService.calculateLinePace === 'function', 'lyricsService.calculateLinePace is exposed');
  assert(typeof lyricsService.getPaceTransition === 'function', 'lyricsService.getPaceTransition is exposed');
  assert(typeof lyricsService.calculateWordTimingFallback === 'function', 'lyricsService.calculateWordTimingFallback is exposed');
  assert(typeof serviceCalculateLinePace === 'function', 'Named export serviceCalculateLinePace is exposed');
  assert(typeof serviceGetPaceTransition === 'function', 'Named export serviceGetPaceTransition is exposed');

  // Verify alias wordTimingFallback
  const aliasWords = wordTimingFallback(lineNoWords);
  assert(aliasWords.length === wordsFallback.length, 'Alias wordTimingFallback returns identical result');

  console.log('\n======================================================================');
  console.log('✅ ALL VOCAL PACE & DYNAMIC HIGHLIGHT TIMING TESTS PASSED');
  console.log('======================================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
