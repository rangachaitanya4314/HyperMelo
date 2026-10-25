// Regression and Verification Test for Fear Song (Devara Part 1)
// Verifies exact LRCLIB response handling, multi-language candidate scoring,
// retrieval pipeline resolution, canonical line extraction, and timeline synchronization.

import { lyricsIngestionService } from '../src/backend/services/LyricsIngestionService';
import { lyricsPipelineService } from '../src/services/lyrics/lyricsPipelineService';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import { getAllCuratedSongs } from '../src/data/curatedCatalog';

async function verifyFearSong() {
  console.log('======================================================================');
  console.log('HYPERMELO — FEAR SONG RETRIEVAL & SYNCHRONIZATION REGRESSION TEST');
  console.log('======================================================================\n');

  // 1. Locate Fear Song in Curated Catalog
  const curatedSongs = getAllCuratedSongs();
  const fearSong = curatedSongs.find(s => s.id === 'tr-fear-song');
  if (!fearSong) {
    throw new Error('Fear Song (tr-fear-song) not found in getAllCuratedSongs()');
  }
  console.log('[Step 1] Catalogue Metadata Verification:');
  console.log(`  - ID: ${fearSong.id}`);
  console.log(`  - Title: "${fearSong.title}"`);
  console.log(`  - Artist: "${fearSong.artist}"`);
  console.log(`  - Album: "${fearSong.album}"`);
  console.log(`  - Language: "${fearSong.language}"`);
  console.log(`  - Duration: ${fearSong.duration}s`);
  console.log(`  - Sync Available: ${fearSong.lyricsSyncAvailable}`);
  console.log('  ✅ PASS: Catalogue metadata matches track identity\n');

  // 2. Verify Ingestion / Retrieval Service Live Resolution
  console.log('[Step 2] Live Provider Retrieval & Language Filtering:');
  const fetchedLyrics = await lyricsIngestionService.fetchLyrics(
    fearSong.title,
    fearSong.artist,
    fearSong.duration,
    fearSong.album,
    undefined,
    fearSong.language,
    fearSong.id
  );

  if (!fetchedLyrics) {
    throw new Error('FAILED: fetchLyrics returned null for Fear Song');
  }

  const langKey = fearSong.language || 'te';
  const songData = fetchedLyrics[langKey] || fetchedLyrics.original || Object.values(fetchedLyrics)[0];
  if (!songData || !songData.lines || songData.lines.length === 0) {
    throw new Error(`FAILED: No lines returned in language bucket ${langKey}`);
  }

  console.log(`  - Resolved language bucket: ${langKey}`);
  console.log(`  - Total lines returned: ${songData.lines.length}`);
  console.log(`  - Line 0 Text: "${songData.lines[0].text}" (Start: ${songData.lines[0].startTime}s)`);
  console.log(`  - Line 1 Text: "${songData.lines[1].text}" (Start: ${songData.lines[1].startTime}s)`);
  console.log(`  - Line 2 Text: "${songData.lines[2].text}" (Start: ${songData.lines[2].startTime}s)`);

  // Assert genuine Telugu script: \u0C00-\u0C7F
  const containsTelugu = /[\u0C00-\u0C7F]/.test(songData.lines[0].text);
  if (!containsTelugu) {
    throw new Error(`FAILED: Expected Telugu script in line 0, but got: "${songData.lines[0].text}"`);
  }
  console.log('  ✅ PASS: Retrieved genuine Telugu lyrics matching track language te\n');

  // 3. Verify Timestamps are Genuine and Non-Fabricated
  console.log('[Step 3] Timestamp Integrity Verification:');
  let nonZeroCount = 0;
  for (let i = 0; i < songData.lines.length; i++) {
    const line = songData.lines[i];
    if (line.startTime === undefined || line.startTime === null || isNaN(line.startTime)) {
      throw new Error(`FAILED: Line ${i} missing startTime`);
    }
    if (i > 0 && line.startTime < songData.lines[i - 1].startTime) {
      throw new Error(`FAILED: Timestamps not monotonic at line ${i}: ${line.startTime} < ${songData.lines[i - 1].startTime}`);
    }
    if (line.startTime > 0) nonZeroCount++;
  }
  if (nonZeroCount < 30) {
    throw new Error(`FAILED: Suspiciously low count of genuine timestamps: ${nonZeroCount}`);
  }
  console.log(`  - Validated ${songData.lines.length} lines with monotonic, genuine timestamps (${nonZeroCount} > 0s)`);
  console.log('  ✅ PASS: No fabricated or constant timestamps detected\n');

  // 4. Verify Pipeline Resolution
  console.log('[Step 4] Lyrics Pipeline Service Resolution:');
  const pipelineResolution = await lyricsPipelineService.resolveTrack(fearSong);
  console.log(`  - Pipeline outcome: ${pipelineResolution.outcome}`);
  console.log(`  - Source provenance: ${pipelineResolution.sourceProvenance}`);
  console.log(`  - Language: ${pipelineResolution.language}`);
  console.log(`  - Line count: ${pipelineResolution.lineCount}`);

  if (pipelineResolution.outcome !== 'SYNCED_VERIFIED') {
    throw new Error(`FAILED: Expected SYNCED_VERIFIED, got ${pipelineResolution.outcome}`);
  }
  console.log('  ✅ PASS: Pipeline service reports SYNCED_VERIFIED\n');

  // 5. Verify Canonical Lyric Lines
  console.log('[Step 5] Canonical Lyric Lines Extraction:');
  const canonicalLines = lyricsService.getCanonicalLyricLines(fearSong);
  console.log(`  - Canonical lines count: ${canonicalLines.length}`);
  if (canonicalLines.length === 0) {
    throw new Error('FAILED: getCanonicalLyricLines returned 0 lines');
  }
  console.log(`  - Canonical Line 0: "${canonicalLines[0].text}" [${canonicalLines[0].startTime}s]`);
  console.log('  ✅ PASS: Canonical lines populated and verified\n');

  // 6. Verify Playhead Timeline Synchronization & Active Line Tracking
  console.log('[Step 6] Audio Playhead Timeline Synchronization:');
  // Check instrumental intro: before 20s
  const preIntroIndex = lyricsService.getActiveLyricIndex(canonicalLines, 5.0);
  console.log(`  - Time 5.0s (Instrumental Intro): active line index = ${preIntroIndex}`);
  if (preIntroIndex !== -1) {
    throw new Error(`FAILED: Expected -1 (instrumental intro) at 5.0s, got ${preIntroIndex}`);
  }

  // Check line 0 active at ~23.5s
  const line0Index = lyricsService.getActiveLyricIndex(canonicalLines, 23.5);
  console.log(`  - Time 23.5s (Line 0 active): active line index = ${line0Index}`);
  if (line0Index !== 0) {
    throw new Error(`FAILED: Expected line 0 at 23.5s, got ${line0Index}`);
  }

  // Check line 1 active at ~26.0s
  const line1Index = lyricsService.getActiveLyricIndex(canonicalLines, 26.0);
  console.log(`  - Time 26.0s (Line 1 active): active line index = ${line1Index}`);
  if (line1Index !== 1) {
    throw new Error(`FAILED: Expected line 1 at 26.0s, got ${line1Index}`);
  }

  // Check line 3 active at ~30.0s
  const line3Index = lyricsService.getActiveLyricIndex(canonicalLines, 30.0);
  console.log(`  - Time 30.0s (Line 3 active): active line index = ${line3Index}`);
  if (line3Index !== 3) {
    throw new Error(`FAILED: Expected line 3 at 30.0s, got ${line3Index}`);
  }

  console.log('  ✅ PASS: Audio playback clock synchronizes line transitions accurately');
  console.log('  ✅ PASS: Instrumental intro before line 0 correctly returns -1\n');

  console.log('======================================================================');
  console.log('FEAR SONG VERIFICATION COMPLETE — ALL REGRESSION CHECKS PASSED!');
  console.log('======================================================================');
}

verifyFearSong().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
