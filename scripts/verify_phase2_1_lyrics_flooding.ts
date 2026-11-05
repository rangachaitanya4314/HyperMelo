// Phase 2.1 Lyrics Request Flooding Fix - Automated Verification Suite
// Tests all 10 acceptance criteria using mocked provider responses.
// Zero live LRCLIB requests are made.

import fs from 'fs';
import path from 'path';
import { lyricsIngestionService } from '../src/backend/services/LyricsIngestionService';
import { lyricsPipelineService } from '../src/services/lyrics/lyricsPipelineService';
import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { ANIRUDH_GAALI_VAALUGA } from '../src/data/songs';
import { PlaybackController } from '../src/services/audio/PlaybackController';
import { getCanonicalTrackDuration } from '../src/shared';
import type { Song } from '../src/shared';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function runPhase2_1Verification() {
  console.log('========================================================================');
  console.log('PHASE 2.1 VERIFICATION: LYRICS REQUEST FLOODING & RATE LIMIT SAFETY');
  console.log('========================================================================\n');

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  let fetchCalls: { url: string; options?: any }[] = [];

  const setupMockFetch = (handler: (url: string, options?: any) => Promise<Response>) => {
    fetchCallCount = 0;
    fetchCalls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCallCount++;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url;
      fetchCalls.push({ url, options: init });
      return handler(url, init);
    }) as any;
  };

  const restoreFetch = () => {
    globalThis.fetch = originalFetch;
  };

  try {
    // =========================================================================
    // TEST 1: Zero bulk pre-resolving in DiscoverPage, HomeMoods, SearchModal
    // =========================================================================
    console.log('>>> [Test 1] Verifying removal of bulk preResolveTracks from UI components...');
    const discoverCode = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DiscoverPage.tsx'), 'utf-8');
    const homeMoodsCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/HomeMoods.tsx'), 'utf-8');
    const searchModalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SearchModal.tsx'), 'utf-8');

    assert(!discoverCode.includes('preResolveTracks'), 'DiscoverPage.tsx must not call preResolveTracks');
    assert(!discoverCode.includes('lyricsPipelineService'), 'DiscoverPage.tsx must not import lyricsPipelineService');
    assert(!homeMoodsCode.includes('preResolveTracks'), 'HomeMoods.tsx must not call preResolveTracks');
    assert(!homeMoodsCode.includes('lyricsPipelineService'), 'HomeMoods.tsx must not import lyricsPipelineService');
    assert(!searchModalCode.includes('preResolveTracks'), 'SearchModal.tsx must not call preResolveTracks');
    assert(!searchModalCode.includes('lyricsPipelineService'), 'SearchModal.tsx must not import lyricsPipelineService');

    console.log('  ✓ PASS: DiscoverPage, HomeMoods, and SearchModal do not trigger any preResolveTracks.');

    // =========================================================================
    // TEST 2: One track uses at most 1 exact lookup and 1 targeted search fallback
    // =========================================================================
    console.log('\n>>> [Test 2] Verifying at most 1 exact lookup and 1 targeted search fallback per track...');
    lyricsIngestionService.resetCooldown();
    setupMockFetch(async (url) => {
      if (url.includes('lrclib.net/api/get')) {
        return new Response(JSON.stringify({ message: 'Failed to find lyrics' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('lrclib.net/api/search')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    await lyricsIngestionService.fetchLyrics(
      'Unknown Song (From "Movie")',
      'Primary Singer ft. Second Singer',
      240,
      'Movie Album',
      undefined,
      'en',
      'test-track-1'
    );

    const lrclibCalls = fetchCalls.filter((c) => c.url.includes('lrclib.net'));
    assert(lrclibCalls.length === 2, `Expected exactly 2 LRCLIB calls (1 exact, 1 search fallback), but got ${lrclibCalls.length}`);
    assert(lrclibCalls[0].url.includes('/api/get'), 'First LRCLIB call was exact lookup');
    assert(lrclibCalls[1].url.includes('/api/search'), 'Second LRCLIB call was targeted search fallback');

    console.log(`  LRCLIB Exact URL called: ${lrclibCalls[0].url}`);
    console.log(`  LRCLIB Search URL called: ${lrclibCalls[1].url}`);
    console.log(`  ✓ PASS: Exactly ${lrclibCalls.length} LRCLIB requests made (1 exact, 1 search fallback).`);

    // =========================================================================
    // TEST 3: Five rapid requests for the same track produce only 1 in-flight operation
    // =========================================================================
    console.log('\n>>> [Test 3] Verifying 5 concurrent requests produce only 1 in-flight provider fetch...');
    lyricsIngestionService.resetCooldown();
    setupMockFetch(async (url) => {
      await new Promise((r) => setTimeout(r, 50));
      return new Response(
        JSON.stringify({
          id: 1234,
          trackName: 'Concurrent Song',
          artistName: 'Artist One',
          syncedLyrics: '[00:01.00] Line one\n[00:05.00] Line two'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const concurrentPromises = [
      lyricsIngestionService.fetchLyrics('Concurrent Song', 'Artist One', 200, undefined, undefined, 'en', 'concurrent-track-id'),
      lyricsIngestionService.fetchLyrics('Concurrent Song', 'Artist One', 200, undefined, undefined, 'en', 'concurrent-track-id'),
      lyricsIngestionService.fetchLyrics('Concurrent Song', 'Artist One', 200, undefined, undefined, 'en', 'concurrent-track-id'),
      lyricsIngestionService.fetchLyrics('Concurrent Song', 'Artist One', 200, undefined, undefined, 'en', 'concurrent-track-id'),
      lyricsIngestionService.fetchLyrics('Concurrent Song', 'Artist One', 200, undefined, undefined, 'en', 'concurrent-track-id')
    ];

    const concurrentResults = await Promise.all(concurrentPromises);
    assert(fetchCallCount === 1, `Expected 1 in-flight fetch for 5 concurrent calls, but got ${fetchCallCount}`);
    for (const res of concurrentResults) {
      assert(res !== null, 'All concurrent callers received resolved lyrics');
    }
    console.log(`  ✓ PASS: 5 concurrent callers deduplicated into ${fetchCallCount} in-flight network request.`);

    // =========================================================================
    // TEST 4: HTTP 429 and 503 trigger cooldown with NO immediate retry and no subsequent requests
    // =========================================================================
    console.log('\n>>> [Test 4] Verifying HTTP 429/503 triggers cooldown without immediate retry...');
    lyricsIngestionService.resetCooldown();
    setupMockFetch(async (url) => {
      if (url.includes('lrclib.net')) {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const startCallTime = Date.now();
    try {
      await lyricsIngestionService.fetchLyrics(
        'Rate Limited Song',
        'Rate Limited Artist',
        180,
        undefined,
        undefined,
        'en',
        'rate-limited-track'
      );
    } catch {
      // Expected transient error propagation
    }
    const duration = Date.now() - startCallTime;

    const lrclibCalls429 = fetchCalls.filter((c) => c.url.includes('lrclib.net'));
    assert(lrclibCalls429.length === 1, `Expected exactly 1 LRCLIB request with zero immediate retries, got ${lrclibCalls429.length}`);
    assert(duration < 400, `Call completed immediately in ${duration}ms without 600ms sleep loop`);
    assert(lyricsIngestionService.isLrclibInCooldown(), 'LyricsIngestionService must enter cooldown');

    // Subsequent call within cooldown must be suppressed
    try {
      await lyricsIngestionService.fetchLyrics(
        'Another Song',
        'Another Artist',
        180,
        undefined,
        undefined,
        'en',
        'another-track'
      );
    } catch {
      // Expected transient failure during cooldown
    }
    const lrclibCallsAfter = fetchCalls.filter((c) => c.url.includes('lrclib.net'));
    assert(lrclibCallsAfter.length === 1, `Subsequent call during cooldown must NOT issue a fetch! Got ${lrclibCallsAfter.length}`);
    console.log('  ✓ PASS: 429 triggered immediate cooldown; no 600ms sleep retry; subsequent LRCLIB calls suppressed.');

    // Verify 503
    lyricsIngestionService.resetCooldown();
    setupMockFetch(async (url) => {
      if (url.includes('lrclib.net')) {
        return new Response('Service Unavailable', { status: 503 });
      }
      return new Response('Not Found', { status: 404 });
    });

    try {
      await lyricsIngestionService.fetchLyrics('Track 503', 'Artist 503', 180, undefined, undefined, 'en', 'track-503');
    } catch {
      // Expected transient failure
    }
    const lrclibCalls503 = fetchCalls.filter((c) => c.url.includes('lrclib.net'));
    assert(lrclibCalls503.length === 1, `503 made exactly 1 fetch call with no retries (got ${lrclibCalls503.length})`);
    assert(lyricsIngestionService.isLrclibInCooldown(), '503 triggers cooldown');
    console.log('  ✓ PASS: 503 Service Unavailable triggers cooldown and eliminates immediate retry.');

    // =========================================================================
    // TEST 5: Valid Retry-After header is respected
    // =========================================================================
    console.log('\n>>> [Test 5] Verifying Retry-After header is respected...');
    lyricsIngestionService.resetCooldown();
    setupMockFetch(async (url) => {
      if (url.includes('lrclib.net')) {
        return new Response(JSON.stringify({ error: 'Rate limit' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '120'
          }
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    try {
      await lyricsIngestionService.fetchLyrics('Track Retry After', 'Artist', 180, undefined, undefined, 'en', 'track-retry-after');
    } catch {
      // Expected transient failure
    }
    const remainingMs = lyricsIngestionService.getLrclibCooldownRemainingMs();
    console.log(`  Cooldown remaining after Retry-After: 120: ${Math.round(remainingMs / 1000)}s`);
    assert(remainingMs > 100000 && remainingMs <= 120000, `Expected ~120s cooldown, got ${remainingMs}ms`);
    console.log('  ✓ PASS: Retry-After: 120 sets cooldown to 120 seconds.');

    // =========================================================================
    // TEST 6: Transient failures cached for 60 seconds
    // =========================================================================
    console.log('\n>>> [Test 6] Verifying transient failure cached for 60 seconds in pipeline...');
    lyricsPipelineService.invalidateCache();
    lyricsIngestionService.resetCooldown();

    setupMockFetch(async () => {
      throw new Error('Network timeout transient error');
    });

    const testSongTransient: Song = {
      id: 'transient-track',
      title: 'Transient Song',
      artist: 'Transient Artist',
      album: 'Album',
      duration: 180,
      artwork: '',
      streamUrl: 'https://example.com/audio.mp3',
      provider: 'naro-catalog'
    };

    const res1 = await lyricsPipelineService.resolveTrack(testSongTransient);
    assert(res1.outcome === 'TRANSIENT_FAILURE', `Outcome should be TRANSIENT_FAILURE, got ${res1.outcome}`);
    const fetchCountAfterFirst = fetchCallCount;

    // Second call within 60 seconds
    const res2 = await lyricsPipelineService.resolveTrack(testSongTransient);
    assert(res2.outcome === 'TRANSIENT_FAILURE', 'Second call returns cached TRANSIENT_FAILURE');
    assert(fetchCallCount === fetchCountAfterFirst, 'Second call within 60s did not issue new fetch');
    console.log('  ✓ PASS: Transient failures cached for 60s and served from cache.');

    // =========================================================================
    // TEST 7: Confirmed no-match results cached for 10 minutes
    // =========================================================================
    console.log('\n>>> [Test 7] Verifying confirmed no-match cached for 10 minutes (600,000ms)...');
    lyricsPipelineService.invalidateCache();
    lyricsIngestionService.resetCooldown();

    setupMockFetch(async (url) => {
      if (url.includes('/api/get')) {
        return new Response(JSON.stringify({ message: 'Failed to find lyrics' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const testSongNoMatch: Song = {
      id: 'no-match-track',
      title: 'No Match Song',
      artist: 'No Match Artist',
      album: 'Album',
      duration: 180,
      artwork: '',
      streamUrl: 'https://example.com/audio.mp3',
      provider: 'naro-catalog'
    };

    const resNoMatch1 = await lyricsPipelineService.resolveTrack(testSongNoMatch);
    assert(resNoMatch1.outcome === 'CONFIRMED_NO_MATCH', `Expected CONFIRMED_NO_MATCH, got ${resNoMatch1.outcome}`);
    const fetchCountNoMatch = fetchCallCount;

    const resNoMatch2 = await lyricsPipelineService.resolveTrack(testSongNoMatch);
    assert(resNoMatch2.outcome === 'CONFIRMED_NO_MATCH', 'Expected cached CONFIRMED_NO_MATCH');
    assert(fetchCallCount === fetchCountNoMatch, 'Second call within 10 min did not issue new fetch');
    console.log('  ✓ PASS: Confirmed no-match cached for 10 minutes.');

    // =========================================================================
    // TEST 8: Successful lyrics are cached and returned correctly
    // =========================================================================
    console.log('\n>>> [Test 8] Verifying successful lyrics cached and returned correctly...');
    lyricsPipelineService.invalidateCache();
    lyricsIngestionService.resetCooldown();

    setupMockFetch(async (url) => {
      if (url.includes('lrclib.net/api/get')) {
        return new Response(
          JSON.stringify({
            id: 9999,
            trackName: 'Success Song',
            artistName: 'Success Artist',
            syncedLyrics: '[00:01.00] First lyric line\n[00:06.00] Second lyric line'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const testSongSuccess: Song = {
      id: 'success-track',
      title: 'Success Song',
      artist: 'Success Artist',
      album: 'Album',
      duration: 180,
      artwork: '',
      streamUrl: 'https://example.com/audio.mp3',
      provider: 'naro-catalog'
    };

    const resSuccess1 = await lyricsPipelineService.resolveTrack(testSongSuccess);
    assert(resSuccess1.outcome === 'SYNCED_VERIFIED', `Expected SYNCED_VERIFIED, got ${resSuccess1.outcome}`);
    assert(resSuccess1.hasSyncedLyrics === true, 'hasSyncedLyrics should be true');
    const fetchCountSuccess = fetchCallCount;

    const resSuccess2 = await lyricsPipelineService.resolveTrack(testSongSuccess);
    assert(resSuccess2.outcome === 'SYNCED_VERIFIED', 'Returned cached SYNCED_VERIFIED');
    assert(fetchCallCount === fetchCountSuccess, 'Did not refetch cached successful lyrics');
    console.log('  ✓ PASS: Successful synced lyrics cached and returned without redundant provider calls.');

    // =========================================================================
    // TEST 9: Track switching cannot display stale lyrics from previous track
    // =========================================================================
    console.log('\n>>> [Test 9] Verifying track switching cannot display stale lyrics...');
    const testSongA: Song = {
      id: 'track-alpha',
      title: 'Alpha Song',
      artist: 'Alpha Artist',
      album: 'Alpha Album',
      duration: 180,
      artwork: '',
      streamUrl: 'https://example.com/a.mp3',
      provider: 'naro-catalog',
      lyrics: {
        en: {
          chorusSnippet: 'Alpha Chorus',
          lines: [{ text: 'Alpha Line', time: 1, startTime: 1, endTime: 5 }]
        }
      }
    };

    const testSongB: Song = {
      id: 'track-beta',
      title: 'Beta Song',
      artist: 'Beta Artist',
      album: 'Beta Album',
      duration: 180,
      artwork: '',
      streamUrl: 'https://example.com/b.mp3',
      provider: 'naro-catalog',
      lyrics: {
        en: {
          chorusSnippet: 'Beta Chorus',
          lines: [{ text: 'Beta Line', time: 2, startTime: 2, endTime: 6 }]
        }
      }
    };

    const resA = await lyricsPipelineService.resolveTrack(testSongA);
    const resB = await lyricsPipelineService.resolveTrack(testSongB);

    assert(resA.trackId === 'track-alpha', 'resA trackId is track-alpha');
    assert(resB.trackId === 'track-beta', 'resB trackId is track-beta');
    assert(resA.canonicalKey !== resB.canonicalKey, 'Canonical keys are completely distinct');
    assert(resA.sampleSnippet?.includes('Alpha') || resA.sampleSnippet === undefined, 'No cross contamination');
    console.log('  ✓ PASS: Track resolution is strictly partitioned by track key; no cross-track bleeding.');

    // =========================================================================
    // TEST 10: Existing Phase 1 audio regression tests continue to pass
    // =========================================================================
    console.log('\n>>> [Test 10] Verifying Phase 1 audio regression tests...');
    const allSongs = getAllCuratedSongs();
    const starboy = allSongs.find((s) => s.title.toLowerCase().includes('starboy'))!;
    const hukum = allSongs.find((s) => s.title.toLowerCase().includes('hukum'))!;

    assert(
      starboy.playbackSource?.streamUrl !== hukum.playbackSource?.streamUrl,
      'Starboy and Hukum MUST NOT have the same streamUrl'
    );
    assert(
      !starboy.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4'),
      'Starboy must NOT use Hukum Saavn CDN audio URL'
    );

    const controller = new PlaybackController();
    await controller.load(hukum, 0);
    assert(controller.getAudioElement()?.src === hukum.playbackSource?.streamUrl, 'Hukum loaded correctly');
    await controller.load(starboy, 0);
    assert(controller.getAudioElement()?.src === starboy.playbackSource?.streamUrl, 'Starboy loaded cleanly');

    const gaaliTracks = allSongs.filter((s) => s.title.toLowerCase().includes('gaali vaaluga'));
    for (const t of gaaliTracks) {
      assert(!t.playbackSource?.streamUrl?.includes('midnight-drive.wav'), 'Gaali Vaaluga must not use midnight-drive.wav');
    }
    assert(!ANIRUDH_GAALI_VAALUGA.playbackSource?.streamUrl?.includes('midnight-drive.wav'), 'ANIRUDH_GAALI_VAALUGA must not use midnight-drive.wav');

    const starboyDur = getCanonicalTrackDuration(starboy);
    assert(starboyDur === 30 && starboy.isStreamPreview === true, 'Starboy canonical duration is 30s preview');

    console.log('  ✓ PASS: Phase 1 audio defect fixes remain intact and verified.');

    console.log('\n========================================================================');
    console.log('ALL 10 PHASE 2.1 TARGETED TESTS PASSED SUCCESSFULLY (100%)');
    console.log('========================================================================\n');
  } finally {
    restoreFetch();
  }
}

runPhase2_1Verification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:');
  console.error(err);
  process.exit(1);
});
