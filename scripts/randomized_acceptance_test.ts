// GRAVITAS PHASE 13: Full Project Audit & Randomized Acceptance Testing for HyperMelo
// Reproducible seeded pseudo-random verification covering >= 30 unique tracks,
// stratified across English, Hindi, Telugu, Tamil, Malayalam, and all discovery surfaces.
// Verifies truthful playback synchronization, fullscreen album artwork, collapsed Audiophile engine,
// and zero-fabrication invariants.

import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { MOOD_CATALOG } from '../src/data/moodCatalog';
import { SONGS, ANIRUDH_GAALI_VAALUGA } from '../src/data/songs';
import { lyricsPipelineService, getCanonicalTrackKey } from '../src/services/lyrics/lyricsPipelineService';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import { playbackController } from '../src/services/audio/PlaybackController';
import type { Song, TimedLyricLine } from '../src/types/music';
import * as fs from 'fs';
import * as path from 'path';

// Linear Congruential Generator for reproducible seeded randomness
class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  public next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
  public sample<T>(array: T[]): T {
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }
  public shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export async function runRandomizedAcceptanceTest(seed = 20261017) {
  console.log('================================================================');
  console.log('GRAVITAS PHASE 13: RANDOMIZED ACCEPTANCE & RELIABILITY AUDIT');
  console.log(`Recorded Reproducible Seed: ${seed}`);
  console.log('================================================================\n');

  const rng = new SeededRandom(seed);
  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition: boolean, description: string, details?: string) {
    if (condition) {
      console.log(`  ✓ ${description}`);
      passedAssertions++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      if (details) console.error(`    Details: ${details}`);
      failedAssertions++;
    }
  }

  // Step 1: Collect full pool of tracks and stratify by language
  console.log('--- Step 1: Stratified Sampling Across All Catalog Surfaces ---');
  const allCurated = getAllCuratedSongs();
  const allMoodTracks: Song[] = [];
  for (const songs of Object.values(MOOD_CATALOG)) {
    allMoodTracks.push(...songs);
  }

  const combinedPool = [...allCurated, ...allMoodTracks, ...SONGS, ANIRUDH_GAALI_VAALUGA];
  const uniqueTrackMap = new Map<string, Song>();
  for (const s of combinedPool) {
    const key = getCanonicalTrackKey(s);
    if (!uniqueTrackMap.has(key)) {
      uniqueTrackMap.set(key, s);
    }
  }

  const allTracks = Array.from(uniqueTrackMap.values());
  console.log(`Total canonical unique tracks available: ${allTracks.length}`);

  // Stratify by language
  const buckets: Record<string, Song[]> = {
    en: [],
    hi: [],
    te: [],
    ta: [],
    ml: [],
    other: []
  };

  for (const t of allTracks) {
    const lang = (t.originalLanguage || (t as any).language || 'en').toLowerCase();
    if (buckets[lang]) {
      buckets[lang].push(t);
    } else {
      buckets.other.push(t);
    }
  }

  console.log(`Stratification buckets: EN=${buckets.en.length}, HI=${buckets.hi.length}, TE=${buckets.te.length}, TA=${buckets.ta.length}, ML=${buckets.ml.length}, Other=${buckets.other.length}`);

  // Sample at least 6 distinct tracks from each supported language (5 * 6 = 30) + 5 random extra = 35 tracks
  const sampleTracks: Song[] = [];
  for (const lang of ['en', 'hi', 'te', 'ta', 'ml']) {
    const shuffled = rng.shuffle(buckets[lang]);
    const picked = shuffled.slice(0, 6);
    sampleTracks.push(...picked);
  }

  const remaining = allTracks.filter((t) => !sampleTracks.some((s) => s.id === t.id));
  const extraPicks = rng.shuffle(remaining).slice(0, 5);
  sampleTracks.push(...extraPicks);

  assert(sampleTracks.length >= 35, `Sampled ${sampleTracks.length} unique tracks (>= 30 required)`);

  // Step 2: Shared Lyrics Pipeline Resolution Verification
  console.log('\n--- Step 2: Shared Lyrics Pipeline Resolution & Invariant Auditing ---');
  for (const track of sampleTracks) {
    const res = await lyricsPipelineService.resolveTrack(track);

    assert(
      res.outcome === 'SYNCHRONIZED' ||
        res.outcome === 'VERIFIED_UNTIMED' ||
        res.outcome === 'CONFIRMED_NO_RESULT' ||
        res.outcome === 'TRANSIENT_FAILURE',
      `[${res.outcome}] Track "${track.title}" by ${track.artist} resolved with valid explicit status`
    );

    // Invariant: If marked SYNCHRONIZED, must have real line timestamps >= 0
    if (res.outcome === 'SYNCHRONIZED') {
      const lines = lyricsService.getCanonicalLyricLines(track);
      const hasRealTimestamps = lines.some((l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1));
      assert(hasRealTimestamps, `Synced track "${track.title}" contains genuine positive timestamps`);

      // Invariant: Timestamps must be monotonic
      let isMonotonic = true;
      for (let i = 1; i < lines.length; i++) {
        const prevT = lines[i - 1].startTime ?? lines[i - 1].time ?? 0;
        const currT = lines[i].startTime ?? lines[i].time ?? 0;
        if (currT < prevT && currT !== -1 && prevT !== -1) {
          isMonotonic = false;
          break;
        }
      }
      assert(isMonotonic, `Synced track "${track.title}" has non-decreasing chronological timestamps`);
    }

    // Invariant: If marked VERIFIED_UNTIMED, startTime must be -1 and NOT labeled as synced
    if (res.outcome === 'VERIFIED_UNTIMED') {
      const lines = lyricsService.getCanonicalLyricLines(track);
      assert(lines.length > 0 && lines[0].startTime === -1, `Untimed track "${track.title}" has startTime === -1`);
      assert(track.lyricsSyncAvailable === false, `Untimed track "${track.title}" never claims sync available`);
    }

    // Invariant: If CONFIRMED_NO_RESULT, lyricsAvailable must be false
    if (res.outcome === 'CONFIRMED_NO_RESULT') {
      assert(track.lyricsAvailable === false, `No-result track "${track.title}" honestly reports lyricsAvailable === false`);
    }
  }

  // Step 3: Targeted Kesariya Regression Verification
  console.log('\n--- Step 3: Kesariya Language Detection & Devanagari Integrity ---');
  const kesariyaTrack: Song = {
    id: 'kesariya-test',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    duration: 268,
    originalLanguage: 'hi'
  } as unknown as Song;

  const kesariyaRes = await lyricsPipelineService.resolveTrack(kesariyaTrack);
  assert(kesariyaRes.outcome === 'SYNCHRONIZED', 'Kesariya resolves genuine synchronized lyrics');
  const kesariyaLang = lyricsService.getSongSourceLanguage(kesariyaTrack);
  assert(kesariyaLang === 'hi', `Kesariya correctly detects source language as "hi" (observed: "${kesariyaLang}")`);
  const kesariyaLines = lyricsService.getCanonicalLyricLines(kesariyaTrack);
  assert(kesariyaLines.length > 15, `Kesariya loaded full synchronized lines (count: ${kesariyaLines.length})`);

  // Step 4: Fullscreen Player Artwork & Audiophile Panel Invariants
  console.log('\n--- Step 4: Fullscreen Player Artwork & Audiophile Invariants ---');
  const nowPlayingPath = path.resolve(process.cwd(), 'src/components/NowPlaying.tsx');
  const nowPlayingContent = fs.readFileSync(nowPlayingPath, 'utf-8');

  // Must import and render AbstractArtwork in NowPlaying.tsx
  assert(
    nowPlayingContent.includes("import { AbstractArtwork } from './AbstractArtwork';"),
    'NowPlaying.tsx imports AbstractArtwork for cinematic album cover rendering'
  );
  assert(
    !nowPlayingContent.includes('<BeatSyncedVisualizer'),
    'NowPlaying.tsx does NOT render BeatSyncedVisualizer in fullscreen view'
  );
  assert(
    nowPlayingContent.includes('<AbstractArtwork'),
    'NowPlaying.tsx renders AbstractArtwork in place of the fullscreen visualizer'
  );

  // Audiophile Engine must be collapsed by default
  assert(
    nowPlayingContent.includes('const [isAudiophileExpanded, setIsAudiophileExpanded] = useState<boolean>(false);'),
    'NowPlaying.tsx sets isAudiophileExpanded to FALSE by default'
  );
  assert(
    nowPlayingContent.includes('id="now-playing-audiophile-toggle"'),
    'NowPlaying.tsx provides visible toggle button with accessible id'
  );
  assert(
    nowPlayingContent.includes("aria-expanded={isAudiophileExpanded}"),
    'NowPlaying.tsx provides accurate aria-expanded state'
  );
  assert(
    nowPlayingContent.includes("minHeight: '44px'"),
    'NowPlaying.tsx toggle button provides 44px minimum touch target size'
  );

  // Step 5: Home Page Visualizer Preservation Invariant
  console.log('\n--- Step 5: Home Page Visualizer Preservation ---');
  const heroPath = path.resolve(process.cwd(), 'src/components/Hero.tsx');
  const heroContent = fs.readFileSync(heroPath, 'utf-8');
  assert(
    heroContent.includes("import { BeatSyncedVisualizer } from './BeatSyncedVisualizer';"),
    'Hero.tsx continues to import BeatSyncedVisualizer'
  );
  assert(
    heroContent.includes('<BeatSyncedVisualizer'),
    'Hero.tsx continues to render the Home visualizer untouched'
  );

  // Step 6: Playback Clock Synchronization & Seeking Validation
  console.log('\n--- Step 6: Playback Synchronization & Active Line Tracking ---');
  const testTrack = kesariyaTrack;
  const testLines = kesariyaLines;

  if (testLines.length > 5) {
    const line3 = testLines[3];
    const targetTime = (line3.startTime ?? line3.time ?? 10) + 0.1;
    const activeIdx = lyricsService.getActiveLyricIndex(testLines, targetTime, 0);
    assert(activeIdx === 3, `Authoritative clock active line matches target line index (expected 3, observed ${activeIdx})`);

    // Test seek to end
    const lastLine = testLines[testLines.length - 1];
    const seekTime = (lastLine.startTime ?? lastLine.time ?? 200) + 0.2;
    const lastActiveIdx = lyricsService.getActiveLyricIndex(testLines, seekTime, 0);
    assert(lastActiveIdx === testLines.length - 1, `Seek to final lyric resolves to last line index`);

    // Test before first line
    const beforeFirstIdx = lyricsService.getActiveLyricIndex(testLines, 0, 0);
    assert(beforeFirstIdx === -1, 'Time before first lyric line produces active index -1');
  }

  console.log('\n================================================================');
  console.log('RANDOMIZED ACCEPTANCE TEST REPORT SUMMARY');
  console.log('================================================================');
  console.log(`Passed Invariants: ${passedAssertions}`);
  console.log(`Failed Invariants: ${failedAssertions}`);

  if (failedAssertions === 0) {
    console.log('\nVERDICT: PASS');
    return true;
  } else {
    console.error(`\nVERDICT: FAIL -- ${failedAssertions} invariants violated`);
    return false;
  }
}

runRandomizedAcceptanceTest().then((success) => {
  if (!success) process.exit(1);
}).catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
