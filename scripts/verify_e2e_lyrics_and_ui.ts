// ============================================================================
// Bulk End-to-End Lyrics & UI Rendering Test Suite
// ============================================================================
// Verifies provider retrieval, pipeline resolution, canonical line extraction,
// and final UI output across representative Telugu, Tamil, Malayalam, Hindi, and English tracks.
// Also verifies strict cross-language rejection without regression.
// ============================================================================

import { lyricsPipelineService } from '../src/services/lyrics/lyricsPipelineService';
import { lyricsService, getCanonicalLyricLines } from '../src/services/lyrics/lyricsService';
import { isLyricsCompatibleWithTarget } from '../src/backend/services/LyricsIngestionService';
import { getListeningLyricDisplay } from '../src/shared/lyrics';
import type { Song, Language } from '../src/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

interface E2ETestTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  expectedLang: Language;
  fullTrackDuration: number;
  expectedMinLines: number;
}

const TEST_TRACKS: E2ETestTrack[] = [
  {
    id: 'e2e-o-rendu-te',
    title: 'O Rendu Prema Meghaalila',
    artist: 'Sreerama Chandra',
    album: 'Baby',
    expectedLang: 'te',
    fullTrackDuration: 252,
    expectedMinLines: 20
  },
  {
    id: 'e2e-fear-song-te',
    title: 'Fear Song',
    artist: 'Anirudh Ravichander, Ramajogayya Sastry',
    album: 'Devara Part 1',
    expectedLang: 'te',
    fullTrackDuration: 195,
    expectedMinLines: 20
  },
  {
    id: 'e2e-poolane-te',
    title: 'Poolane Kunukuveyamanta',
    artist: 'Haricharan, Shreya Ghoshal',
    album: 'I - Manoharudu',
    expectedLang: 'te',
    fullTrackDuration: 308,
    expectedMinLines: 30
  },
  {
    id: 'e2e-hukum-ta',
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander',
    album: 'Jailer',
    expectedLang: 'ta',
    fullTrackDuration: 202,
    expectedMinLines: 50
  },
  {
    id: 'e2e-kesariya-hi',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmastra',
    expectedLang: 'hi',
    fullTrackDuration: 268,
    expectedMinLines: 30
  },
  {
    id: 'e2e-starboy-en',
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    expectedLang: 'en',
    fullTrackDuration: 230,
    expectedMinLines: 50
  },
  {
    id: 'e2e-malare-ml',
    title: 'Malare',
    artist: 'Vijay Yesudas',
    album: 'Premam',
    expectedLang: 'ml',
    fullTrackDuration: 316,
    expectedMinLines: 30
  }
];

async function runBulkE2ELyricsSuite() {
  console.log('================================================================================');
  console.log('BULK END-TO-END MULTI-LANGUAGE RESOLUTION & REGRESSION SUITE');
  console.log('================================================================================');

  let passed = 0;
  let failed = 0;

  for (const t of TEST_TRACKS) {
    console.log(`\nTesting track: "${t.title}" by "${t.artist}" (${t.expectedLang.toUpperCase()})`);

    const song: Song = {
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      language: t.expectedLang,
      originalLanguage: t.expectedLang,
      duration: 30,
      fullTrackDuration: t.fullTrackDuration,
      isStreamPreview: true,
      previewAvailable: true,
      fullLengthAvailable: true,
      playbackAvailable: true,
      playbackType: 'preview'
    };

    // 1. Pipeline resolution
    const resolution = await lyricsPipelineService.resolveTrack(song, true);
    console.log(`  Outcome: ${resolution.outcome}`);
    console.log(`  Synced: ${resolution.hasSyncedLyrics}, LineCount: ${resolution.lineCount}`);

    // 2. Canonical lyric line extraction
    const canonical = getCanonicalLyricLines(song);
    console.log(`  Canonical Lines Extracted: ${canonical.length}`);

    // 3. UI capability badge
    const capability = lyricsService.getLyricsCapability(song);
    console.log(`  UI Lyrics Capability: ${capability}`);

    try {
      assert(
        resolution.outcome === 'SYNCED_VERIFIED',
        `Track "${t.title}" outcome matches expected: expected SYNCED_VERIFIED, got ${resolution.outcome}`
      );
      assert(
        canonical.length >= t.expectedMinLines,
        `Canonical lines must be >= ${t.expectedMinLines} (got ${canonical.length})`
      );
      assert(capability === 'SYNCED_LYRICS', `UI capability must be SYNCED_LYRICS (got ${capability})`);

      const firstLine = canonical[0];
      assert(Boolean(firstLine.text), 'First line has text');
      assert(
        (firstLine.startTime !== undefined && firstLine.startTime >= 0) ||
        (firstLine.time !== undefined && firstLine.time >= 0),
        'First line has non-negative timestamp'
      );

      const uiDisplayOrig = getListeningLyricDisplay(firstLine, t.expectedLang, t.expectedLang);
      assert(Boolean(uiDisplayOrig.originalText), 'UI displays authentic original text');
      console.log(`  Sample UI Line: [${firstLine.startTime ?? firstLine.time}s] "${uiDisplayOrig.originalText}"`);
      if (firstLine.karaoke?.transliteration) {
        console.log(`  Transliteration: "${firstLine.karaoke.transliteration}"`);
      }

      passed++;
      console.log(`  => PASS`);
    } catch (err: any) {
      failed++;
      console.error(`  => FAIL: ${err.message}`);
    }
  }

  // Cross-Language Script Isolation & Rejection Checks
  console.log('\n--- Cross-Language Script Isolation & Rejection Checks ---');
  // Malayalam script lyrics must NOT be accepted for Telugu song
  const malText = 'തെളിമാനം മഴവില്ലിൻ നിറമണിയും നേരം';
  assert(!isLyricsCompatibleWithTarget(malText, 'te'), 'Malayalam script strictly rejected for Telugu target');
  console.log('  ✓ Malayalam script rejected for Telugu target');

  // Devanagari script lyrics must NOT be accepted for English song
  const devText = 'मुझको इतना बताए कोई';
  assert(!isLyricsCompatibleWithTarget(devText, 'en'), 'Devanagari script strictly rejected for English target');
  console.log('  ✓ Devanagari script rejected for English target');

  // Tamil script lyrics must NOT be accepted for Telugu song
  const tamText = 'ஹே, இங்க நான் தான் king\'uh';
  assert(!isLyricsCompatibleWithTarget(tamText, 'te'), 'Tamil script strictly rejected for Telugu target');
  console.log('  ✓ Tamil script rejected for Telugu target');

  console.log('\n================================================================================');
  console.log(`E2E SUITE RESULTS: ${passed} passed, ${failed} failed (total: ${TEST_TRACKS.length})`);
  console.log('================================================================================');

  if (failed > 0) {
    throw new Error(`${failed} track(s) failed E2E lyrics and UI test!`);
  }
}

runBulkE2ELyricsSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
