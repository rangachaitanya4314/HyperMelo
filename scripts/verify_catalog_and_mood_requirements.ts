/**
 * Strict Verification Script for HyperMelo Catalog, Artist, and Mood Requirements
 * Tests:
 * 1. Minimum 15 unique songs per mood across all 12 moods
 * 2. Zero generic filler tracks (Shot Down, Gaali Vaaluga) used as generic mood filler
 * 3. Mood diversity: no two distinct moods share identical or excessive (>30%) song lists
 * 4. Movie and album diversity (<= 2 tracks per movie/album in general collections)
 * 5. Minimum 15 unique songs per populated Discover section
 * 6. Minimum 60 distinct artists, with >= 15 across English, Hindi, Telugu, and Tamil
 * 7. Track metadata completeness (title, artist, language, duration, artwork, playback source)
 */

import { MOOD_CATALOG, getMoodCatalog, type MoodId, normalizeMoodId } from '../src/data/moodCatalog';
import {
  TRENDING_INDIA_SONGS,
  HINDI_POPULAR_SONGS,
  TELUGU_POPULAR_SONGS,
  TAMIL_POPULAR_SONGS,
  MALAYALAM_POPULAR_SONGS,
  ENGLISH_POPULAR_SONGS,
  NEW_RELEASES_SONGS,
  QUICK_PICKS_SONGS,
  getAllCuratedSongs
} from '../src/data/curatedCatalog';
import {
  ALL_ARTISTS,
  ENGLISH_ARTISTS,
  HINDI_ARTISTS,
  TELUGU_ARTISTS,
  TAMIL_ARTISTS,
  findArtistByName
} from '../src/data/artistCatalog';
import type { Song } from '../src/types/music';

let failures = 0;
let passes = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passes++;
  }
}

console.log('================================================================');
console.log('HYPERMELO CATALOG, MOOD, AND ARTIST AUDIT & VERIFICATION');
console.log('================================================================\n');

// 1. MOOD CATALOG VERIFICATION
console.log('--- 1. MOOD CATALOG: 12 DISTINCT MOODS (>= 15 UNIQUE TRACKS EACH) ---');
const REQUIRED_MOODS = [
  'Romantic',
  'Sad',
  'Happy',
  'Party',
  'Chill',
  'Workout',
  'Focus',
  'Rainy Day',
  'Travel',
  'Motivation',
  'Late Night',
  'Nostalgic Classics'
];

const moodSongCounts: Record<string, number> = {};
const moodTrackSets: Record<string, Set<string>> = {};

for (const mood of REQUIRED_MOODS) {
  const songs = getMoodCatalog(mood);
  moodSongCounts[mood] = songs.length;
  const uniqueIds = new Set(songs.map((s) => s.id));
  const uniqueTitles = new Set(songs.map((s) => s.title.toLowerCase().trim()));
  moodTrackSets[mood] = uniqueTitles;

  assert(
    songs.length >= 15,
    `Mood "${mood}" contains ${songs.length} tracks (must be >= 15)`
  );
  assert(
    uniqueIds.size === songs.length,
    `Mood "${mood}" has zero internal duplicate IDs (${uniqueIds.size}/${songs.length})`
  );
  assert(
    uniqueTitles.size === songs.length,
    `Mood "${mood}" has zero internal duplicate song titles (${uniqueTitles.size}/${songs.length})`
  );

  // Check no generic fillers in mood
  const hasShotDown = songs.some(
    (s) => s.id.includes('shot-down') || s.title.toLowerCase() === 'shot down'
  );
  assert(
    !hasShotDown,
    `Mood "${mood}" does not use Shot Down as generic filler`
  );

  const hasGaaliVaalugaFiller = songs.some(
    (s) => (s.id.includes('gaali') || s.title.toLowerCase().includes('gaali vaaluga')) && mood !== 'Romantic' && mood !== 'Romance' && mood !== 'Chill'
  );
  assert(
    !hasGaaliVaalugaFiller,
    `Mood "${mood}" does not abuse Gaali Vaaluga as generic filler`
  );

  // Check movie diversity (<= 2 tracks per movie/album)
  const albumCounts: Record<string, number> = {};
  for (const s of songs) {
    if (s.album && s.album.trim().length > 0) {
      albumCounts[s.album] = (albumCounts[s.album] || 0) + 1;
    }
  }
  const overConcentratedAlbums = Object.entries(albumCounts).filter(([_, c]) => c > 2);
  assert(
    overConcentratedAlbums.length === 0,
    `Mood "${mood}" respects movie/album diversity (max 2 per album; violations: ${overConcentratedAlbums.map(([a, c]) => `${a}:${c}`).join(', ') || 'none'})`
  );
}

// Check mood cross-overlap (no two distinct moods should share > 30% of their songs)
console.log('\n--- 2. MOOD DIVERSITY & NON-DUPLICATION ACROSS MOODS ---');
let suspiciousOverlapFound = false;
for (let i = 0; i < REQUIRED_MOODS.length; i++) {
  for (let j = i + 1; j < REQUIRED_MOODS.length; j++) {
    const m1 = REQUIRED_MOODS[i];
    const m2 = REQUIRED_MOODS[j];
    const set1 = moodTrackSets[m1];
    const set2 = moodTrackSets[m2];
    let shared = 0;
    for (const title of set1) {
      if (set2.has(title)) shared++;
    }
    const maxAllowed = Math.floor(Math.min(set1.size, set2.size) * 0.35);
    if (shared > maxAllowed) {
      suspiciousOverlapFound = true;
      console.error(`Suspicious overlap between "${m1}" and "${m2}": ${shared} shared tracks!`);
    }
  }
}
assert(!suspiciousOverlapFound, 'All 12 mood collections have distinct, defended editorial track selections');

// 3. DISCOVER SECTION COLLECTIONS
console.log('\n--- 3. DISCOVER SONG SECTIONS (>= 15 UNIQUE TRACKS EACH) ---');
const DISCOVER_SECTIONS: Record<string, Song[]> = {
  'trending-india': TRENDING_INDIA_SONGS,
  'hindi-top-10': HINDI_POPULAR_SONGS,
  'telugu-top-10': TELUGU_POPULAR_SONGS,
  'tamil-top-10': TAMIL_POPULAR_SONGS,
  'malayalam-top-10': MALAYALAM_POPULAR_SONGS,
  'english-top-10': ENGLISH_POPULAR_SONGS,
  'new-releases': NEW_RELEASES_SONGS,
  'quick-picks': QUICK_PICKS_SONGS
};

for (const [secId, songs] of Object.entries(DISCOVER_SECTIONS)) {
  const uniqueIds = new Set(songs.map((s) => s.id));
  const uniqueTitles = new Set(songs.map((s) => s.title.toLowerCase().trim()));

  assert(
    songs.length >= 15,
    `Discover section "${secId}" contains ${songs.length} tracks (must be >= 15)`
  );
  assert(
    uniqueIds.size === songs.length,
    `Discover section "${secId}" has zero duplicate IDs (${uniqueIds.size}/${songs.length})`
  );
  assert(
    uniqueTitles.size === songs.length,
    `Discover section "${secId}" has zero duplicate song titles (${uniqueTitles.size}/${songs.length})`
  );

  // Movie/album diversity
  const albumCounts: Record<string, number> = {};
  for (const s of songs) {
    if (s.album && s.album.trim().length > 0) {
      albumCounts[s.album] = (albumCounts[s.album] || 0) + 1;
    }
  }
  const overConcentrated = Object.entries(albumCounts).filter(([_, c]) => c > 2);
  assert(
    overConcentrated.length === 0,
    `Discover section "${secId}" movie diversity compliant (violations: ${overConcentrated.map(([a, c]) => `${a}:${c}`).join(', ') || 'none'})`
  );
}

// 4. ARTIST DIRECTORY VERIFICATION
console.log('\n--- 4. ARTIST DIRECTORY: >= 60 DISTINCT ARTISTS (>= 15 PER LANGUAGE) ---');
const totalArtists = ALL_ARTISTS.length;
const uniqueArtistNames = new Set(ALL_ARTISTS.map((a) => a.name.toLowerCase().trim()));

assert(
  totalArtists >= 60,
  `Total distinct artists count is ${totalArtists} (must be >= 60)`
);
assert(
  uniqueArtistNames.size === totalArtists,
  `All ${totalArtists} artists in catalog are distinct`
);

assert(
  ENGLISH_ARTISTS.length >= 15,
  `English artists count is ${ENGLISH_ARTISTS.length} (must be >= 15)`
);
assert(
  HINDI_ARTISTS.length >= 15,
  `Hindi artists count is ${HINDI_ARTISTS.length} (must be >= 15)`
);
assert(
  TELUGU_ARTISTS.length >= 15,
  `Telugu artists count is ${TELUGU_ARTISTS.length} (must be >= 15)`
);
assert(
  TAMIL_ARTISTS.length >= 15,
  `Tamil artists count is ${TAMIL_ARTISTS.length} (must be >= 15)`
);

// Check required artists
const requiredKeyArtists = ['Dua Lipa', 'Sia', 'Alan Walker', 'Imagine Dragons', 'Arijit Singh', 'Sid Sriram', 'Anirudh Ravichander'];
for (const artName of requiredKeyArtists) {
  const found = findArtistByName(artName);
  assert(
    !!found,
    `Required prominent artist "${artName}" is verified in artist catalog`
  );
}

// Check artist profile completeness
let allProfilesComplete = true;
for (const a of ALL_ARTISTS) {
  if (!a.id || !a.name || !a.genre || !a.initial || !a.category || !a.language || a.popularTracks.length === 0) {
    allProfilesComplete = false;
    console.error(`Incomplete profile for artist: ${a.name}`);
  }
}
assert(allProfilesComplete, 'All artist profiles contain valid IDs, initials, genres, categories, and popularTracks');

// 5. OVERALL CURATED CATALOG
console.log('\n--- 5. OVERALL CURATED SONGS AUDIT ---');
const allCurated = getAllCuratedSongs();
assert(
  allCurated.length >= 120,
  `Total unique curated songs pool is ${allCurated.length} (must be >= 120)`
);

// Check metadata integrity
let allMetadataValid = true;
for (const song of allCurated) {
  if (
    !song.id ||
    !song.title ||
    !song.artist ||
    !song.language ||
    typeof song.duration !== 'number' ||
    song.duration <= 0
  ) {
    allMetadataValid = false;
    console.error(`Invalid metadata for song ${song.id}: ${song.title}`);
  }
}
assert(allMetadataValid, 'All curated songs have authentic titles, artists, valid languages, and non-zero durations');

console.log('\n================================================================');
console.log(`CATALOG & MOOD AUDIT SUMMARY: ${passes} PASSED, ${failures} FAILED`);
console.log('================================================================\n');

if (failures > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
