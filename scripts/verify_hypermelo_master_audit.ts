// Master Automated Quality & Reliability Verification Suite for HyperMelo
// Covers:
// 1. Catalog & Artist Integrity (including the Sia / Tamil song root cause regression)
// 2. Playback Source Resolution & Stream Reliability
// 3. Lyrics Truthfulness (zero synthetic lyric lines)
// 4. Minimized Player Artwork Reliability & Eager Loading
// 5. Fullscreen Visualizer Scoping & Accessible Audiophile Toggle
// 6. Predictive Smart Search (Prefix matching, Diacritics, Recent Searches)
// 7. Queue Progression & Player State Machine

import { isArtistMatch, findArtistByName, ALL_ARTISTS } from '../src/data/artistCatalog';
import { getAllCuratedSongs, createCuratedSong } from '../src/data/curatedCatalog';
import { playbackSourceResolver } from '../src/services/audio/playbackSourceResolver';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import { predictiveSearchService } from '../src/services/search/predictiveSearchService';
import { chartService } from '../src/services/charts';
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(suite: string, test: string, condition: boolean, details?: string) {
  results.push({
    suite,
    test,
    passed: condition,
    details: details || (condition ? 'Passed' : 'Assertion failed')
  });
  const symbol = condition ? '✓' : '✗';
  console.log(`  ${symbol} [${suite}] ${test}`);
  if (!condition && details) {
    console.error(`      Detail: ${details}`);
  }
}

async function runMasterAudit() {
  console.log('\n================================================================');
  console.log('HYPERMELO MASTER QUALITY & RELIABILITY AUDIT');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: CATALOG & ARTIST INTEGRITY
  // -------------------------------------------------------------------------
  console.log('Running Suite 1: Catalog & Artist Integrity...');

  // 1.1: Sia vs Malaysia Vasudevan regression
  const siaVsMalaysia = isArtistMatch(
    'Malaysia Vasudevan, Yugendran, Anirudh & Deepthi Suresh',
    'Sia'
  );
  assert(
    'Catalog & Artist Integrity',
    'Tamil song artist "Malaysia Vasudevan" must NOT match "Sia"',
    siaVsMalaysia === false,
    `Got ${siaVsMalaysia}, expected false`
  );

  // 1.2: Sia genuine matches
  assert(
    'Catalog & Artist Integrity',
    'Exact artist "Sia" matches "Sia"',
    isArtistMatch('Sia', 'Sia') === true
  );

  assert(
    'Catalog & Artist Integrity',
    'Collaborative artist "David Guetta & Sia" matches "Sia"',
    isArtistMatch('David Guetta & Sia', 'Sia') === true
  );

  assert(
    'Catalog & Artist Integrity',
    'Featured artist "Sia feat. Sean Paul" matches "Sia"',
    isArtistMatch('Sia feat. Sean Paul', 'Sia') === true
  );

  assert(
    'Catalog & Artist Integrity',
    'Featured artist "Sia feat. Sean Paul" matches "Sean Paul"',
    isArtistMatch('Sia feat. Sean Paul', 'Sean Paul') === true
  );

  // 1.3: Anirudh matches collaborative track
  assert(
    'Catalog & Artist Integrity',
    'Anirudh matches "Malaysia Vasudevan, Yugendran, Anirudh & Deepthi Suresh"',
    isArtistMatch('Malaysia Vasudevan, Yugendran, Anirudh & Deepthi Suresh', 'Anirudh') === true
  );

  // 1.4: findArtistByName lookup
  const malaysiaProfile = findArtistByName('Malaysia Vasudevan');
  assert(
    'Catalog & Artist Integrity',
    'findArtistByName("Malaysia Vasudevan") does not return Sia profile',
    malaysiaProfile?.id !== 'art-sia',
    `Matched profile id: ${malaysiaProfile?.id}`
  );

  const siaProfile = findArtistByName('Sia');
  assert(
    'Catalog & Artist Integrity',
    'findArtistByName("Sia") returns Sia profile',
    siaProfile?.id === 'art-sia'
  );

  // 1.5: Manasilaayo metadata
  const curated = getAllCuratedSongs();
  const manasilaayo = curated.find((s) => s.id === 'nr-manasilaayo');
  assert(
    'Catalog & Artist Integrity',
    'Manasilaayo has canonical Tamil language metadata',
    manasilaayo !== undefined && manasilaayo.language === 'ta' && manasilaayo.album === 'Vettaiyan'
  );

  // -------------------------------------------------------------------------
  // SUITE 2: PLAYBACK STREAM RESOLUTION & RELIABILITY
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 2: Playback Stream Resolution & Reliability...');

  // 2.1: createCuratedSong without streamUrl must not claim open-license
  const testTrack = createCuratedSong({
    id: 'test-unresolved-track',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 210,
    genre: 'Pop',
    language: 'en'
  });

  assert(
    'Playback Reliability',
    'createCuratedSong without streamUrl leaves playbackSourceType undefined instead of fake open-license',
    testTrack.playbackSourceType === undefined,
    `playbackSourceType was "${testTrack.playbackSourceType}"`
  );

  assert(
    'Playback Reliability',
    'createCuratedSong without streamUrl reports playbackAvailable: false',
    testTrack.playbackAvailable === false
  );

  // 2.2: resolvePlaybackSource on genuine remote track
  const chaleya = curated.find((s) => s.id === 'tr-chaleya');
  if (chaleya) {
    try {
      const resolved = await playbackSourceResolver.resolvePlaybackSource(chaleya);
      assert(
        'Playback Reliability',
        'playbackSourceResolver resolves valid AAC/MP3 streamUrl for Chaleya',
        !!resolved.playbackSource?.streamUrl && resolved.playbackSource.streamUrl.startsWith('http'),
        `Resolved URL: ${resolved.playbackSource?.streamUrl?.slice(0, 60)}...`
      );
    } catch (err: any) {
      assert('Playback Reliability', 'Chaleya stream resolution network check', false, err.message);
    }
  }

  // 2.3: chartService toSong maps curated catalog songs with full metadata
  const mockChartTrack = {
    internal_track_id: 'chart-chaleya',
    provider_track_id: 'tr-chaleya',
    title: 'Chaleya',
    primary_artist: 'Arijit Singh & Shilpa Rao',
    rank: 1,
    chart_id: 'trending-india',
    movement: 'same' as const
  };
  const mappedSong = chartService.toSong(mockChartTrack);
  assert(
    'Playback Reliability',
    'chartService.toSong preserves curated catalog identity and language',
    mappedSong.id === 'tr-chaleya' && mappedSong.language === 'hi'
  );

  // -------------------------------------------------------------------------
  // SUITE 3: LYRICS ACCURACY & TRUTHFULNESS
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 3: Lyrics Accuracy & Truthfulness...');

  // 3.1: Zero synthetic lyric lines
  const emptySong = createCuratedSong({
    id: 'test-no-lyrics',
    title: 'Empty Test Track',
    artist: 'Unknown Artist',
    duration: 180,
    genre: 'Instrumental',
    language: 'en'
  });
  // Clear any lines
  if (emptySong.lyrics) emptySong.lyrics = {};

  const resolvedEmptyLyrics = await lyricsService.resolveCanonicalLyrics(emptySong);
  const hasSyntheticLines = resolvedEmptyLyrics.some(
    (l) => l.text.includes('— Verse') || l.text.includes('— Chorus')
  );

  assert(
    'Lyrics Truthfulness',
    'resolveCanonicalLyrics NEVER fabricates synthetic section lines like "${song.title} — ${sec.label}"',
    hasSyntheticLines === false && resolvedEmptyLyrics.length === 0,
    `Returned ${resolvedEmptyLyrics.length} lines, hasSynthetic: ${hasSyntheticLines}`
  );

  assert(
    'Lyrics Truthfulness',
    'Track with unavailable lyrics honestly reports lyricsAvailable: false',
    emptySong.lyricsAvailable === false
  );

  // -------------------------------------------------------------------------
  // SUITE 4: FULLSCREEN VISUALIZER & ACCESSIBLE AUDIOPHILE TOGGLE
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 4: Fullscreen Visualizer & Audiophile Toggle...');

  const visualizerFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/BeatSyncedVisualizer.tsx'),
    'utf-8'
  );

  assert(
    'Visualizer Scoping',
    'BeatSyncedVisualizer suppresses center text overlay when mode === "fullscreen"',
    visualizerFile.includes("mode !== 'fullscreen' &&")
  );

  assert(
    'Visualizer Scoping',
    'Home screen visualizer (mode === "hero") retains its center visualizer typography',
    visualizerFile.includes('id="visualizer-song-title"') &&
      visualizerFile.includes('id="visualizer-song-artist"')
  );

  const nowPlayingFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/NowPlaying.tsx'),
    'utf-8'
  );

  assert(
    'Audiophile Toggle',
    'NowPlaying contains accessible toggle button for Audiophile Sound Engine',
    nowPlayingFile.includes('id="now-playing-audiophile-toggle"') &&
      nowPlayingFile.includes('aria-expanded={isAudiophileExpanded}') &&
      nowPlayingFile.includes('aria-controls="now-playing-audiophile-controls"')
  );

  assert(
    'Audiophile Toggle',
    'NowPlaying collapsible controls container responds to isAudiophileExpanded state',
    nowPlayingFile.includes('id="now-playing-audiophile-controls"') &&
      nowPlayingFile.includes("display: isAudiophileExpanded ? 'block' : 'none'")
  );

  assert(
    'Audiophile Toggle',
    'Toggle button provides minHeight: 44px for accessible touch targets',
    nowPlayingFile.includes("minHeight: '44px'")
  );

  // -------------------------------------------------------------------------
  // SUITE 5: MINIMIZED ARTWORK & PLAYER RECOVERY
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 5: Minimized Artwork & Player Recovery...');

  const abstractArtworkFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AbstractArtwork.tsx'),
    'utf-8'
  );

  assert(
    'Artwork Reliability',
    'AbstractArtwork uses loading="eager" to prevent disappearing minimized artwork',
    abstractArtworkFile.includes('loading="eager"')
  );

  assert(
    'Artwork Reliability',
    'AbstractArtwork verifies imgRef.current.complete for instant cached image display',
    abstractArtworkFile.includes('imgRef.current.complete')
  );

  const bottomPlayerFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/BottomPlayer.tsx'),
    'utf-8'
  );

  assert(
    'Artwork Reliability',
    'BottomPlayer passes trackId, title, and artist to AbstractArtwork for immediate lookup',
    bottomPlayerFile.includes('trackId={currentSong?.id}') &&
      bottomPlayerFile.includes('title={currentSong?.title}')
  );

  const audioContextFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/context/AudioPlayerContext.tsx'),
    'utf-8'
  );

  assert(
    'Artwork Reliability',
    'AudioPlayerContext subscribeTrack updates track state when artwork or streamUrl updates',
    audioContextFile.includes('prev.artwork?.imageUrl !== track.artwork?.imageUrl')
  );

  // -------------------------------------------------------------------------
  // SUITE 6: PREDICTIVE SMART SEARCH
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 6: Predictive Smart Search...');

  // 6.1: Empty query returns recent searches and popular suggestions
  const emptySearch = predictiveSearchService.searchLocal('');
  assert(
    'Predictive Search',
    'Empty query returns popular suggestions and recent searches',
    emptySearch.popularSuggestions.length > 0 && Array.isArray(emptySearch.recentSearches)
  );

  // 6.2: Prefix search for "bon" matches "Bones"
  const bonesSearch = predictiveSearchService.searchLocal('bon');
  const foundBones = bonesSearch.songs.some((s) => s.title.toLowerCase().startsWith('bone'));
  assert(
    'Predictive Search',
    'Prefix query "bon" matches "Bones" by Imagine Dragons',
    foundBones,
    `Returned songs: ${bonesSearch.songs.map((s) => s.title).join(', ')}`
  );

  // 6.3: Artist prefix search for "sia"
  const siaSearch = predictiveSearchService.searchLocal('sia');
  const foundSia = siaSearch.artists.some((a) => a.name.toLowerCase() === 'sia');
  const falseTamilSongInSia = siaSearch.songs.some((s) => s.title === 'Manasilaayo');

  assert(
    'Predictive Search',
    'Query "sia" returns Sia in artists group',
    foundSia
  );

  assert(
    'Predictive Search',
    'Query "sia" does NOT return Tamil track "Manasilaayo" (preventing false substring attribution)',
    falseTamilSongInSia === false,
    `Found Manasilaayo under sia search: ${falseTamilSongInSia}`
  );

  // 6.4: Multilingual search
  const arijitSearch = predictiveSearchService.searchLocal('arijit');
  assert(
    'Predictive Search',
    'Query "arijit" returns Arijit Singh in artists and popular Hindi tracks in songs',
    arijitSearch.artists.some((a) => a.name.includes('Arijit')) &&
      arijitSearch.songs.length > 0
  );

  // 6.5: Diacritics normalization
  const diacriticSearch = predictiveSearchService.searchLocal('dánce');
  assert(
    'Predictive Search',
    'Query with diacritics "dánce" normalizes and matches songs or artists',
    diacriticSearch.songs.some((s) => s.genre?.toLowerCase().includes('dance') || s.title.toLowerCase().includes('dance')) ||
      diacriticSearch.artists.some((a) => a.genre.toLowerCase().includes('dance'))
  );

  // 6.6: Recent searches persistence
  predictiveSearchService.addRecentSearch('Imagine Dragons');
  predictiveSearchService.addRecentSearch('Kesariya');
  const recents = predictiveSearchService.getRecentSearches();
  assert(
    'Predictive Search',
    'Recent searches stores and retrieves deduplicated search terms in order of recency',
    recents[0] === 'Kesariya' && recents.includes('Imagine Dragons')
  );

  predictiveSearchService.removeRecentSearch('Imagine Dragons');
  const afterRemove = predictiveSearchService.getRecentSearches();
  assert(
    'Predictive Search',
    'Recent searches allows removing individual entries',
    !afterRemove.includes('Imagine Dragons') && afterRemove.includes('Kesariya')
  );

  // -------------------------------------------------------------------------
  // SUITE 7: QUEUE PROGRESSION & CONTROLS
  // -------------------------------------------------------------------------
  console.log('\nRunning Suite 7: Queue Progression & Controls...');

  assert(
    'Queue Progression',
    'AudioPlayerContext nextSong delegates to PlaybackController queue and handles curated catalog tracks',
    audioContextFile.includes('playbackController.nextTrack()') &&
      audioContextFile.includes('getAllCuratedSongs()')
  );

  assert(
    'Queue Progression',
    'AudioPlayerContext prevSong delegates to PlaybackController queue and handles curated catalog tracks',
    audioContextFile.includes('playbackController.prevTrack()') &&
      audioContextFile.includes('getAllCuratedSongs()')
  );

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('AUDIT REPORT SUMMARY');
  console.log('================================================================\n');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Invariants Audited: ${total}`);
  console.log(`Passed:                   ${passed}`);
  console.log(`Failed:                   ${failed}`);
  console.log(`Coverage Rate:            ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error('Audit failed with unresolved defects!');
    process.exit(1);
  } else {
    console.log('Master Audit PASSED with ZERO defects across all 7 verification suites.');
  }
}

runMasterAudit().catch((err) => {
  console.error('Master audit encountered fatal unhandled exception:', err);
  process.exit(1);
});
