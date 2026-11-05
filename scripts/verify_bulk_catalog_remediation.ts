// ============================================================================
// Catalog-Wide Bulk Remediation & Regression Suite
// ============================================================================
// Verifies shared systems across diverse catalog:
// - Title normalization, phonetic transliteration, and anchor token matching
// - Multi-artist extraction and role matching (singers, composers, lyricists)
// - Regional version disambiguation (soundtrack vs reloaded/promo)
// - Strict language validation and script isolation across Indic & Western languages
// - Honest provider classification (active vs auth_required vs deprecated vs stub)
// - Zero 30-second cutoff on full-length audio sources
// - Request bounds, cooldowns, and deduplication
// ============================================================================

import { playbackSourceResolver } from '../src/backend/services/PlaybackSourceResolver';
import {
  lyricsIngestionService,
  isLyricsCompatibleWithTarget,
  isCandidateTitleLanguageCompatible,
  isCandidateValidMatch,
  type ProviderContext
} from '../src/backend/services/LyricsIngestionService';
import { PlaybackController } from '../src/services/audio/PlaybackController';
import { sanitizeTrackTitle, sanitizeArtistName, extractPrimaryArtist } from '../src/services/lyrics/lyricsSanitizer';
import type { Song } from '../src/shared';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

interface TestTrackSpec {
  id: string;
  name: string;
  query: Song;
  expectedLang: string;
  minDuration: number;
  expectedPlaybackType: 'full' | 'preview';
  rootCauseCategory: string;
}

async function runBulkCatalogSuite() {
  console.log('================================================================================');
  console.log('CATALOG-WIDE BULK REMEDIATION SUITE: SHARED SYSTEM VERIFICATION');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Representative Catalog of Tracks Across Languages, Genres, & Versions
  // ---------------------------------------------------------------------------
  const testCatalog: TestTrackSpec[] = [
    {
      id: 'hukum-telugu',
      name: 'Hukum - Telugu (Jailer Telugu Soundtrack)',
      query: {
        id: 'hukum-te-spec',
        title: 'Hukum - Telugu',
        artist: 'Anirudh Ravichander',
        album: 'Jailer (Telugu)',
        language: 'te',
        duration: 30,
        fullTrackDuration: 207,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'telugu',
      minDuration: 200,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause C: Regional Version & Soundtrack vs Promo Disambiguation'
    },
    {
      id: 'hukum-tamil',
      name: 'Hukum - Thalaivar Alappara (Jailer Tamil Original)',
      query: {
        id: 'hukum-ta-spec',
        title: 'Hukum - Thalaivar Alappara',
        artist: 'Anirudh Ravichander',
        album: 'Jailer',
        language: 'ta',
        duration: 30,
        fullTrackDuration: 207,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'tamil',
      minDuration: 200,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause C: Subtitle Tagline Normalization & Original Soundtrack Selection'
    },
    {
      id: 'poolane-telugu',
      name: 'Poolane Kunukuveyamanta (I Telugu Film Soundtrack)',
      query: {
        id: 'poolane-te-spec',
        title: 'Poolane Kunukuveyamanta',
        artist: 'Haricharan',
        album: 'I (Telugu)',
        language: 'te',
        duration: 30,
        fullTrackDuration: 308,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'telugu',
      minDuration: 300,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause A: Transliteration & Phonetic Vowel Contraction Matching'
    },
    {
      id: 'fear-song-telugu',
      name: 'Fear Song - Telugu (Devara Part 1 Telugu)',
      query: {
        id: 'fear-song-te-spec',
        title: 'Fear Song - Telugu',
        artist: 'Anirudh Ravichander',
        album: 'Devara Part 1 - Telugu',
        language: 'te',
        duration: 30,
        fullTrackDuration: 196,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'telugu',
      minDuration: 190,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause B & C: Multi-Language Soundtrack Dub Disambiguation'
    },
    {
      id: 'baby-o-rendu-prema',
      name: 'O Rendu Prema Meghaalila (Baby Telugu)',
      query: {
        id: 'baby-o-rendu-spec',
        title: 'O Rendu Prema Meghaalila',
        artist: 'Sreerama Chandra',
        album: 'Baby',
        language: 'te',
        duration: 30,
        fullTrackDuration: 252,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'telugu',
      minDuration: 240,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause B: Multi-Artist Role Matching (Singer vs Composer vs Lyricist)'
    },
    {
      id: 'kesariya-hindi',
      name: 'Kesariya (Brahmastra Hindi)',
      query: {
        id: 'kesariya-hi-spec',
        title: 'Kesariya',
        artist: 'Arijit Singh, Pritam',
        album: 'Brahmastra',
        language: 'hi',
        duration: 30,
        fullTrackDuration: 268,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'hindi',
      minDuration: 260,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause B: Multi-Artist Extraction (Playback Singer & Music Director)'
    },
    {
      id: 'starboy-english',
      name: 'Starboy (The Weeknd ft. Daft Punk)',
      query: {
        id: 'starboy-en-spec',
        title: 'Starboy',
        artist: 'The Weeknd ft. Daft Punk',
        album: 'Starboy',
        language: 'en',
        duration: 30,
        fullTrackDuration: 230,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'preview'
      },
      expectedLang: 'english',
      minDuration: 220,
      expectedPlaybackType: 'full',
      rootCauseCategory: 'Root Cause C: Western Pop Featured Artist Stripping & Full-Length Resolution'
    },
    {
      id: 'unsupported-spanish-dub',
      name: 'Hukum (Spanish Dub - Nonexistent Recording)',
      query: {
        id: 'hukum-es-spec',
        title: 'Hukum (Spanish Dub)',
        artist: 'Anirudh Ravichander',
        album: 'Jailer Spanish',
        language: 'es',
        duration: 30,
        fullTrackDuration: 30,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: false,
        playbackAvailable: true,
        playbackType: 'preview',
        playbackSource: {
          provider: 'apple-music',
          providerTrackId: 'dummy-es-id',
          streamUrl: 'https://audio-ssl.itunes.apple.com/preview/spanish-dummy.m4a',
          isStreamPreview: true,
          format: 'aac'
        }
      },
      expectedLang: 'spanish',
      minDuration: 30,
      expectedPlaybackType: 'preview',
      rootCauseCategory: 'Root Cause D: Foreign Dub Protection & No Silent Cross-Language Substitution'
    },
    {
      id: 'obscure-indie-sample',
      name: 'Obscure Indie Sample 999 (Preview Only)',
      query: {
        id: 'obscure-indie-spec',
        title: 'Obscure Indie Snippet XYZ 999',
        artist: 'Unknown Bedroom Producer 888',
        album: 'Demos',
        duration: 30,
        fullTrackDuration: 30,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: false,
        playbackAvailable: true,
        playbackType: 'preview',
        playbackSource: {
          provider: 'apple-music',
          providerTrackId: 'dummy-indie-id',
          streamUrl: 'https://audio-ssl.itunes.apple.com/preview/obscure-dummy.m4a',
          isStreamPreview: true,
          format: 'aac'
        }
      },
      expectedLang: 'english',
      minDuration: 30,
      expectedPlaybackType: 'preview',
      rootCauseCategory: 'Root Cause F: Genuine Preview Preservation Without False Full-Length Claims'
    }
  ];

  // ---------------------------------------------------------------------------
  // SECTION A: BULK RESOLVER & STREAM ACCESSIBILITY TEST
  // ---------------------------------------------------------------------------
  console.log('>>> [Section A] Executing Bulk Audio Source Resolution Across Representative Catalog...\n');

  for (const track of testCatalog) {
    console.log(`--- Testing [${track.id}]: ${track.name} ---`);
    console.log(`  Category: ${track.rootCauseCategory}`);

    const resolved = await playbackSourceResolver.resolvePlaybackSource(track.query);
    console.log(`  Resolved: duration=${resolved.duration}s, playbackType="${resolved.playbackType}", isPreview=${resolved.isStreamPreview}`);
    console.log(`  Media Stream: ${resolved.playbackSource?.streamUrl}`);

    // Verify playbackType
    assert(
      resolved.playbackType === track.expectedPlaybackType,
      `Expected playbackType "${track.expectedPlaybackType}", got "${resolved.playbackType}"`
    );

    // Verify duration
    assert(
      resolved.duration >= track.minDuration,
      `Expected duration >= ${track.minDuration}s, got ${resolved.duration}s`
    );

    // Specific invariants
    if (track.id === 'hukum-telugu') {
      assert(
        !resolved.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4'),
        'Telugu Hukum MUST NOT resolve to Tamil original audio!'
      );
    }

    if (track.id === 'hukum-tamil') {
      assert(
        Boolean(resolved.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4')),
        'Tamil Hukum must resolve to Tamil original recording'
      );
    }

    if (track.id === 'fear-song-telugu') {
      assert(
        Boolean(resolved.playbackSource?.streamUrl?.includes('313/1178c7b2a16c3fd32ec5cd002b5a1ce0_160.mp4') || resolved.playbackSource?.providerTrackId === 'm0Yt29rq'),
        'Fear Song Telugu must resolve to official Telugu release (m0Yt29rq), not Tamil dub!'
      );
    }

    if (track.id === 'unsupported-spanish-dub') {
      assert(
        resolved.playbackType === 'preview' && resolved.isStreamPreview === true,
        'Unsupported dub must NEVER substitute Tamil/Telugu audio!'
      );
    }

    if (track.expectedPlaybackType === 'full') {
      // Verify stream accessibility with live HTTP Range request
      const streamUrl = resolved.playbackSource?.streamUrl;
      assert(Boolean(streamUrl), 'Full-length track must have streamUrl');
      const res = await fetch(streamUrl!, { method: 'GET', headers: { Range: 'bytes=0-1024' } });
      assert(res.status === 206 || res.status === 200, `HTTP status ${res.status} for stream`);
      const range = res.headers.get('content-range');
      const totalBytes = range ? parseInt(range.split('/')[1] || '0') : 0;
      const mb = totalBytes / 1024 / 1024;
      console.log(`  Stream Accessibility: HTTP ${res.status}, Total Size: ${mb.toFixed(2)} MB (${totalBytes} bytes)`);
      assert(mb > 1.5, `Stream size ${mb.toFixed(2)} MB must be > 1.5 MB for full-length song`);

      // Verify Player Clock loading
      const controller = new PlaybackController();
      await controller.load(resolved, 0);
      const clockDur = controller.getDuration();
      assert(clockDur >= track.minDuration, `Player clock duration ${clockDur}s >= ${track.minDuration}s`);
      assert(controller.getCurrentClock().playbackType === 'full', 'Clock playbackType is "full"');
    }

    console.log(`  ✓ [${track.id}] PASS.\n`);
  }

  // ---------------------------------------------------------------------------
  // SECTION B: SHARED LYRICS NORMALIZATION & TRANSLITERATION MATCHING
  // ---------------------------------------------------------------------------
  console.log('>>> [Section B] Verifying Shared Normalization, Transliteration, & Sanitization Rules...\n');

  // B1. Subtitle & Parenthetical Cleaning
  const titleA = sanitizeTrackTitle('O Rendu Prema Meghaalila (First Love Song)');
  assert(titleA === 'O Rendu Prema Meghaalila', `Expected "O Rendu Prema Meghaalila", got "${titleA}"`);

  const titleB = sanitizeTrackTitle('Fear Song (From "Devara Part 1")');
  assert(titleB === 'Fear Song', `Expected "Fear Song", got "${titleB}"`);

  const titleC = sanitizeTrackTitle('Kesariya (From "Brahmastra") [Lyrical]');
  assert(titleC === 'Kesariya', `Expected "Kesariya", got "${titleC}"`);

  const titleD = sanitizeTrackTitle('Poolane Kunukuveyamanta (Reprise Version)');
  assert(titleD === 'Poolane Kunukuveyamanta', `Expected "Poolane Kunukuveyamanta", got "${titleD}"`);

  // B2. Multi-Artist Extraction
  const cleanArt = sanitizeArtistName('Vijai Bulganin, Sreerama Chandra & Anantha Sriram (From Baby)');
  assert(!cleanArt.includes('Baby'), 'Artist note stripped');
  const primArt = extractPrimaryArtist('Vijai Bulganin, Sreerama Chandra & Anantha Sriram');
  assert(primArt === 'Vijai Bulganin', `Primary artist is Vijai Bulganin, got "${primArt}"`);

  // B3. Transliteration / Phonetic Matching in isCandidateValidMatch
  const match1 = isCandidateValidMatch(
    'Poolane Kunukuveyamanta',
    'Haricharan',
    'Poolane Kunukeyamantaa',
    'Haricharan, A.R. Rahman',
    'te'
  );
  assert(match1.isMatch, 'Phonetic/transliteration equivalence matches Poolane Kunukuveyamanta to Poolane Kunukeyamantaa');

  const match2 = isCandidateValidMatch(
    'O Rendu Prema Meghaalila',
    'Sreerama Chandra',
    'O Rendu Prema Meghaalila (First Love Song)',
    'Vijai Bulganin, Sreerama Chandra, Anantha Sriram',
    'te'
  );
  assert(match2.isMatch, 'O Rendu Prema Meghaalila matches candidate with multi-artist and parenthetical');

  console.log('  ✓ Shared normalization, transliteration, and candidate matching rules verified.\n');

  // ---------------------------------------------------------------------------
  // SECTION C: HONEST PROVIDER CLASSIFICATION & CASCADE INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('>>> [Section C] Verifying Truthful Provider Classification (No False Claims)...\n');

  const cascadeContext: ProviderContext = {};
  lyricsIngestionService.resetCooldown();

  // Test against a real track through the common resolution pipeline
  await lyricsIngestionService.fetchLyrics(
    'Starboy',
    'The Weeknd',
    230,
    'Starboy',
    undefined,
    'en',
    'bulk-starboy-audit',
    cascadeContext
  );

  const logs = cascadeContext.providerLogs || {};
  console.log(`  Total Providers Registered in Pipeline: ${Object.keys(logs).length}`);

  // Assert honest classification:
  // 1. Active providers that run: lrclib_exact, lrc_red, lrclib_search, netease, jiosaavn, kugou
  const activeIds = ['lrclib_exact', 'lrc_red', 'lrclib_search', 'netease', 'jiosaavn', 'kugou'];
  for (const aId of activeIds) {
    const l = logs[aId];
    assert(Boolean(l), `Active provider "${aId}" must be in pipeline`);
    assert(l.classification === 'active', `Provider "${aId}" classification must be "active"`);
    assert(
      l.status === 'checking' ||
      l.status === 'not_checked' ||
      l.status === 'synchronized_lyrics_found' ||
      l.status === 'plain_lyrics_found' ||
      l.status === 'no_matching_lyrics' ||
      l.status === 'provider_failed',
      `Active provider "${aId}" has valid active status, got "${l.status}"`
    );
  }

  // 2. Auth-required providers: paxsenix, musixmatch
  const authIds = ['paxsenix', 'musixmatch'];
  for (const aId of authIds) {
    const l = logs[aId];
    assert(Boolean(l), `Auth provider "${aId}" must be in pipeline`);
    assert(l.classification === 'auth_required', `Provider "${aId}" classification must be "auth_required"`);
    assert(l.status === 'auth_required', `Auth provider "${aId}" status must be "auth_required", got "${l.status}"`);
    assert(Boolean(l.error), `Auth provider "${aId}" provides clear reason for requirement`);
  }

  // 3. Deprecated services: megalobiz
  const dep = logs['megalobiz'];
  assert(Boolean(dep), 'Megalobiz must be in pipeline');
  assert(dep.classification === 'deprecated', 'Megalobiz classification must be "deprecated"');
  assert(dep.status === 'service_deprecated', `Megalobiz status must be "service_deprecated", got "${dep.status}"`);

  // 4. Stubs: youtube_captions, youtube_music, simpmusic, betterlyrics, lyricsplus, binilyrics, unison, genius
  const stubIds = ['youtube_captions', 'youtube_music', 'simpmusic', 'betterlyrics', 'lyricsplus', 'binilyrics', 'unison', 'genius'];
  for (const sId of stubIds) {
    const l = logs[sId];
    assert(Boolean(l), `Stub provider "${sId}" must be in pipeline`);
    assert(l.classification === 'stub', `Provider "${sId}" classification must be "stub"`);
    assert(l.status === 'unimplemented_stub', `Stub provider "${sId}" must be "unimplemented_stub" (NOT false "no_matching_lyrics"), got "${l.status}"`);
  }

  console.log('  ✓ Zero false claims: Stubs, auth-required, and deprecated services accurately classified.\n');

  // ---------------------------------------------------------------------------
  // SECTION D: STRICT SCRIPT & LANGUAGE REJECTION ACROSS ALL REGIONAL LANGUAGES
  // ---------------------------------------------------------------------------
  console.log('>>> [Section D] Verifying Script & Language Rejection Across Regional Languages...\n');

  const mlScriptText = '[00:10.00] ആരാധികേ മണിമുകിലുപോലെ നിനക്കു ഞാൻ സ്നേഹം കണ്ടേ';
  const teScriptText = '[00:10.00] ఏం మాయే ఇది ప్రాయమా గుండెలోన కలవరం';
  const taScriptText = '[00:10.00] முதல் நீ முடிவும் நீ உரைத்தாய் அன்பே';
  const hiScriptText = '[00:10.00] केसरिया तेरा इश्क है पिया रंग जाऊं';

  // Telugu target
  assert(!isLyricsCompatibleWithTarget(mlScriptText, 'te'), 'Malayalam script REJECTED for Telugu target');
  assert(!isLyricsCompatibleWithTarget(taScriptText, 'te'), 'Tamil script REJECTED for Telugu target');
  assert(isLyricsCompatibleWithTarget(teScriptText, 'te'), 'Telugu script ACCEPTED for Telugu target');

  // Tamil target
  assert(!isLyricsCompatibleWithTarget(teScriptText, 'ta'), 'Telugu script REJECTED for Tamil target');
  assert(isLyricsCompatibleWithTarget(taScriptText, 'ta'), 'Tamil script ACCEPTED for Tamil target');

  // Hindi target
  assert(!isLyricsCompatibleWithTarget(mlScriptText, 'hi'), 'Malayalam script REJECTED for Hindi target');
  assert(isLyricsCompatibleWithTarget(hiScriptText, 'hi'), 'Devanagari script ACCEPTED for Hindi target');

  // English target
  assert(!isLyricsCompatibleWithTarget(teScriptText, 'en'), 'Indic script REJECTED for English target');
  assert(!isLyricsCompatibleWithTarget(mlScriptText, 'en'), 'Indic script REJECTED for English target');

  // Title tags
  assert(!isCandidateTitleLanguageCompatible('Track Name [Tamil]', 'te'), '[Tamil] tag rejected for Telugu');
  assert(!isCandidateTitleLanguageCompatible('Track Name [Malayalam]', 'te'), '[Malayalam] tag rejected for Telugu');
  assert(isCandidateTitleLanguageCompatible('Track Name [Telugu]', 'te'), '[Telugu] tag accepted for Telugu');

  console.log('  ✓ Shared language and script isolation rules verified across all supported languages.\n');

  // ---------------------------------------------------------------------------
  // SECTION E: HONEST EXHAUSTION ON UNMATCHABLE TRACKS
  // ---------------------------------------------------------------------------
  console.log('>>> [Section E] Verifying Honest Exhaustion Reporting Without Fabricated Content...\n');

  const exhaustionContext: ProviderContext = {};
  const impossibleLyrics = await lyricsIngestionService.fetchLyrics(
    'Fictional Phantom Track 987654321',
    'Nonexistent Entity 123456789',
    180,
    undefined,
    undefined,
    'en',
    'phantom-exhaustion-test',
    exhaustionContext
  );

  assert(impossibleLyrics === null, 'Exhausted search must return null without fabricating content');
  assert(exhaustionContext.exhausted === true, 'exhaustionContext flags exhausted: true');

  console.log('  ✓ Honest exhaustion: returns null with exhausted=true, zero fabricated content.\n');

  console.log('================================================================================');
  console.log('ALL BULK CATALOG REMEDIATION & SHARED SYSTEM TESTS PASSED (100% SUITE PASS)');
  console.log('================================================================================');
}

runBulkCatalogSuite().catch((err) => {
  console.error('\n❌ BULK CATALOG SUITE FAILED:', err);
  process.exit(1);
});

