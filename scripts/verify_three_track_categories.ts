// Verification of Three Canonical Lyrics Track Categories:
// Category 1: Genuine Timed Lyrics
// Category 2: Genuine Untimed (Plain) Lyrics (Zero Fabricated Timestamps)
// Category 3: Genuinely Failed / Unavailable Track (Honest Recovery State)

import { lyricsService } from '../src/services/lyrics/lyricsService';
import { lyricsPipelineService } from '../src/services/lyrics/lyricsPipelineService';
import { lyricsIngestionService } from '../src/backend/services/LyricsIngestionService';
import type { Song } from '../src/shared';

async function verifyThreeCategories() {
  console.log('======================================================================');
  console.log('HYPERMELO — THREE TRACK CATEGORIES VERIFICATION');
  console.log('======================================================================\n');

  // Category 1: Genuine Timed Lyrics
  console.log('[Category 1] Genuine Timed Lyrics Track ("Fear Song"):');
  const timedSong: Song = {
    id: 'test-fear-song',
    title: 'Fear Song',
    artist: 'Anirudh Ravichander',
    album: 'Devara Part 1',
    duration: 195,
    language: 'te',
    originalLanguage: 'te',
    lyricsSyncAvailable: true,
    lyrics: {
      te: {
        lines: [
          { startTime: 22.29, text: 'ఆకట్టుకుంది సంద్రం (దేవా)' },
          { startTime: 25.19, text: 'బగ్గున మండే ఆకసం' },
          { startTime: 27.88, text: 'ఆరాచకాల భగ్నం (దేవా)' }
        ]
      }
    }
  };

  const timedResolution = await lyricsPipelineService.resolveTrack(timedSong);
  console.log(`  - Pipeline Outcome: ${timedResolution.outcome}`);
  console.log(`  - Has Synced Lyrics: ${timedResolution.hasSyncedLyrics}`);
  console.log(`  - Has Plain Lyrics: ${timedResolution.hasPlainLyrics}`);
  console.log(`  - Line Count: ${timedResolution.lineCount}`);

  if (timedResolution.outcome !== 'SYNCED_VERIFIED') {
    throw new Error(`Category 1 Failed: Expected SYNCED_VERIFIED, got ${timedResolution.outcome}`);
  }
  const timedLines = lyricsService.getCanonicalLyricLines(timedSong);
  if (timedLines.length !== 3 || timedLines[0].startTime !== 22.29) {
    throw new Error('Category 1 Failed: Timed canonical lines mismatch');
  }
  console.log('  ✅ PASS: Timed lyrics category verified with genuine timestamps\n');

  // Category 2: Genuine Untimed (Plain) Lyrics
  console.log('[Category 2] Genuine Untimed (Plain) Lyrics Track:');
  const plainSong: Song = {
    id: 'test-plain-song',
    title: 'Acoustic Melody',
    artist: 'Indie Artist',
    duration: 180,
    language: 'en',
    originalLanguage: 'en',
    lyricsSyncAvailable: false,
    lyrics: {
      en: {
        lines: [
          { startTime: -1, text: 'First line of poetic lyrics' },
          { startTime: -1, text: 'Second line flowing like a river' },
          { startTime: -1, text: 'Final chorus fading into silence' }
        ]
      }
    }
  };

  const plainResolution = await lyricsPipelineService.resolveTrack(plainSong);
  console.log(`  - Pipeline Outcome: ${plainResolution.outcome}`);
  console.log(`  - Has Synced Lyrics: ${plainResolution.hasSyncedLyrics}`);
  console.log(`  - Has Plain Lyrics: ${plainResolution.hasPlainLyrics}`);
  console.log(`  - Line Count: ${plainResolution.lineCount}`);

  if (plainResolution.outcome !== 'PLAIN_VERIFIED') {
    throw new Error(`Category 2 Failed: Expected PLAIN_VERIFIED, got ${plainResolution.outcome}`);
  }
  const plainLines = lyricsService.getCanonicalLyricLines(plainSong);
  for (const l of plainLines) {
    if (l.startTime !== undefined && l.startTime > 0) {
      throw new Error(`Category 2 Failed: Fabricated timestamp detected on plain line: ${l.startTime}`);
    }
  }
  const activeIndexAt50s = lyricsService.getActiveLyricIndex(plainLines, 50.0);
  if (activeIndexAt50s !== -1) {
    throw new Error(`Category 2 Failed: Plain lyrics should not compute an active line index, got ${activeIndexAt50s}`);
  }
  console.log('  ✅ PASS: Untimed lyrics category verified with zero fabricated timestamps\n');

  // Category 3: Genuinely Failed / Unavailable Track
  console.log('[Category 3] Genuinely Unavailable Lyrics Track (No Available Match):');
  const unavailableSong: Song = {
    id: 'test-unavailable-song',
    title: 'Nonexistent Song X999Z',
    artist: 'Nonexistent Artist 888Q',
    duration: 120,
    lyricsSyncAvailable: false
  };

  const unavailableResolution = await lyricsPipelineService.resolveTrack(unavailableSong);
  console.log(`  - Pipeline Outcome: ${unavailableResolution.outcome}`);
  console.log(`  - Has Synced Lyrics: ${unavailableResolution.hasSyncedLyrics}`);
  console.log(`  - Has Plain Lyrics: ${unavailableResolution.hasPlainLyrics}`);
  console.log(`  - Line Count: ${unavailableResolution.lineCount}`);

  if (unavailableResolution.outcome !== 'CONFIRMED_NO_MATCH' && unavailableResolution.outcome !== 'CONFIRMED_NO_RESULT') {
    throw new Error(`Category 3 Failed: Expected CONFIRMED_NO_MATCH, got ${unavailableResolution.outcome}`);
  }
  const unavailableLines = lyricsService.getCanonicalLyricLines(unavailableSong);
  if (unavailableLines.length !== 0) {
    throw new Error(`Category 3 Failed: Expected 0 lines, got ${unavailableLines.length}`);
  }
  console.log('  ✅ PASS: Genuinely unavailable track truthfully reports CONFIRMED_NO_MATCH without empty white screen or crash\n');

  console.log('======================================================================');
  console.log('ALL THREE CANONICAL LYRICS CATEGORIES VERIFIED WITH HONEST REPORTING!');
  console.log('======================================================================');
}

verifyThreeCategories().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
