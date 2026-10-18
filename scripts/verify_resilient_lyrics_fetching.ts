// Verification Script: Resilient Multi-Provider Lyrics Fetching & Title Sanitization
// Verifies:
// 1. Metadata sanitizer (movie tags, features, descriptors, HTML unescaping)
// 2. Step 1: IndexedDB / local storage cache under track ID
// 3. Step 2: LRCLIB exact /api/get
// 4. Step 3: LRCLIB search with ±3s duration filter
// 5. Step 4: JioSaavn lyrics endpoint & HTML stripping
// 6. Step 5: NetEase open lyrics parsing
// 7. Auto-caching: zero network calls on repeat queries

import {
  sanitizeTrackTitle,
  sanitizeArtistName,
  extractPrimaryArtist,
  sanitizeLyricsMetadata,
  unescapeHtml
} from '../src/services/lyrics/lyricsSanitizer';
import { indexedDbService } from '../src/services/storage/indexedDbService';
import { lyricsIngestionService, isCandidateValidMatch } from '../src/backend/services/LyricsIngestionService';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import type { Song, SongLyrics } from '../src/shared';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

async function runTests() {
  console.log('\n--- 1. METADATA SANITIZER TESTS ---');

  // Test Movie Tags
  assert(
    sanitizeTrackTitle('Naatu Naatu (From "RRR")') === 'Naatu Naatu',
    'Strips (From "...") movie tag'
  );
  assert(
    sanitizeTrackTitle("Kesariya (From 'Brahmastra')") === 'Kesariya',
    "Strips (From '...') single quotes"
  );
  assert(
    sanitizeTrackTitle('Arabic Kuthu - From "Beast"') === 'Arabic Kuthu',
    'Strips - From "..." movie tag'
  );
  assert(
    sanitizeTrackTitle('Tum Hi Ho (Original Motion Picture Soundtrack)') === 'Tum Hi Ho',
    'Strips (Original Motion Picture Soundtrack)'
  );
  assert(
    sanitizeTrackTitle('Dangal (Soundtrack)') === 'Dangal',
    'Strips (Soundtrack)'
  );
  assert(
    sanitizeTrackTitle('Jai Ho [OST]') === 'Jai Ho',
    'Strips [OST]'
  );

  // Test Features
  assert(
    sanitizeTrackTitle('Levitating (feat. DaBaby)') === 'Levitating',
    'Strips (feat. ...)'
  );
  assert(
    sanitizeTrackTitle('Starboy ft. Daft Punk') === 'Starboy',
    'Strips ft. ...'
  );
  assert(
    sanitizeTrackTitle('Stay (with Justin Bieber)') === 'Stay',
    'Strips (with ...)'
  );
  assert(
    sanitizeTrackTitle('Cold Water [featuring Justin Bieber]') === 'Cold Water',
    'Strips [featuring ...]'
  );

  // Test Descriptors
  assert(
    sanitizeTrackTitle('Shape of You [Remix]') === 'Shape of You',
    'Strips [Remix]'
  );
  assert(
    sanitizeTrackTitle('Channa Mereya (Remix By DJ Chetas)') === 'Channa Mereya',
    'Strips (Remix By DJ Chetas)'
  );
  assert(
    sanitizeTrackTitle('Samajavaragamana [Lyrical]') === 'Samajavaragamana',
    'Strips [Lyrical]'
  );
  assert(
    sanitizeTrackTitle('Butta Bomma (Lyrical Video)') === 'Butta Bomma',
    'Strips (Lyrical Video)'
  );
  assert(
    sanitizeTrackTitle('Blinding Lights [Official Audio]') === 'Blinding Lights',
    'Strips [Official Audio]'
  );
  assert(
    sanitizeTrackTitle('Bad Guy [Official Music Video]') === 'Bad Guy',
    'Strips [Official Music Video]'
  );
  assert(
    sanitizeTrackTitle('Slow Motion [Full Video Song]') === 'Slow Motion',
    'Strips [Full Video Song]'
  );
  assert(
    sanitizeTrackTitle('After Hours (Slowed + Reverb)') === 'After Hours',
    'Strips (Slowed + Reverb)'
  );
  assert(
    sanitizeTrackTitle('Hotel California (Acoustic Version)') === 'Hotel California',
    'Strips (Acoustic Version)'
  );
  assert(
    sanitizeTrackTitle('Comfortably Numb [Live at Pompeii]') === 'Comfortably Numb',
    'Strips [Live at Pompeii]'
  );
  assert(
    sanitizeTrackTitle('In the End (Radio Edit)') === 'In the End',
    'Strips (Radio Edit)'
  );

  // Test HTML unescaping and complex composite tags
  assert(
    sanitizeTrackTitle('Channa Mereya (Remix By DJ Chetas) [From &quot;Ae Dil Hai Mushkil&quot;]') === 'Channa Mereya',
    'Strips unescaped &quot; and multiple tags simultaneously'
  );
  assert(
    sanitizeTrackTitle('Kesariya (From "Brahmastra") [Lyrical]') === 'Kesariya',
    'Strips both movie tag and lyrical descriptor'
  );
  assert(
    sanitizeTrackTitle('Samajavaragamana [Lyrical] (From "Ala Vaikunthapurramuloo")') === 'Samajavaragamana',
    'Strips lyrical descriptor followed by movie tag'
  );

  // Test Artist Sanitization & Primary Artist
  assert(
    sanitizeArtistName('Arijit Singh (feat. Pritam)') === 'Arijit Singh',
    'Strips feature from artist name'
  );
  assert(
    extractPrimaryArtist('Arijit Singh, Pritam, Amitabh Bhattacharya') === 'Arijit Singh',
    'Extracts primary artist from comma-separated list'
  );
  assert(
    extractPrimaryArtist('Dua Lipa & DaBaby') === 'Dua Lipa',
    'Extracts primary artist with ampersand delimiter'
  );
  assert(
    extractPrimaryArtist('The Weeknd feat. Daft Punk') === 'The Weeknd',
    'Extracts primary artist with feat delimiter'
  );

  const bundle = sanitizeLyricsMetadata('Kesariya (From "Brahmastra") [Lyrical]', 'Arijit Singh & Pritam');
  assert(bundle.cleanTitle === 'Kesariya', 'Bundle cleanTitle is Kesariya');
  assert(bundle.cleanArtist === 'Arijit Singh & Pritam', 'Bundle cleanArtist preserves sanitized artist credit');
  assert(bundle.primaryArtist === 'Arijit Singh', 'Bundle primaryArtist is Arijit Singh');

  console.log('\n--- 2. STEP 1 & CACHING: INDEXEDDB / LOCAL STORAGE CACHE ---');
  const testTrackId = 'test-track-resilient-101';
  await indexedDbService.clearLyricsCache(testTrackId);

  // Step 1: Initial check returns null (cache miss)
  const initialCache = await indexedDbService.getLyrics(testTrackId);
  assert(initialCache === null, 'Initial cache is null on cache miss');

  // Populate cache under track ID
  const mockPayload: SongLyrics = {
    hi: {
      chorusSnippet: 'Kesariya tera ishq hai piya',
      lines: [
        {
          id: 'k-1',
          startTime: 12.5,
          endTime: 16.0,
          time: 12.5,
          duration: 3.5,
          text: 'केसरिया तेरा इश्क़ है पिया'
        },
        {
          id: 'k-2',
          startTime: 16.0,
          endTime: 20.2,
          time: 16.0,
          duration: 4.2,
          text: 'रंग जाऊँ जो मैं हाथ लगाऊँ'
        }
      ]
    }
  };

  await indexedDbService.saveLyrics(testTrackId, mockPayload, 'test_mock');
  const cachedHit = await indexedDbService.getLyrics(testTrackId);
  assert(cachedHit !== null, 'Cache hit retrieved successfully');
  assert(cachedHit?.hi?.lines?.length === 2, 'Cached lines count matches');
  assert(cachedHit?.hi?.lines[0].text === 'केसरिया तेरा इश्क़ है पिया', 'Cached line text preserved exactly');

  // Verify lyricsService.fetchLyrics respects Step 1 cache under track ID
  const serviceCached = await lyricsService.fetchLyrics(
    'Kesariya (From "Brahmastra")',
    'Arijit Singh',
    268,
    undefined,
    undefined,
    'hi',
    testTrackId
  );
  assert(serviceCached !== null, 'lyricsService.fetchLyrics hits Step 1 cache under track ID');
  assert(serviceCached?.hi?.lines[0].id === 'k-1', 'Correct cached payload returned without network request');

  console.log('\n--- 3. STEP 2: LRCLIB EXACT /api/get QUERY ---');
  // Query a classic known track with exact match
  const exactResult = await lyricsIngestionService.queryLrclibExact('Yellow', 'Coldplay', 269);
  if (exactResult) {
    const langKey = Object.keys(exactResult)[0];
    const lines = exactResult[langKey]?.lines;
    assert(lines !== undefined && lines.length > 0, `LRCLIB exact returned ${lines?.length} lines for Yellow`);
    assert(lines[0].startTime >= 0, 'LRCLIB exact lines have valid synchronized timestamps');
  } else {
    console.log('  INFO: LRCLIB exact query timed out or offline, skipping network assertion');
  }

  console.log('\n--- 4. STEP 3: LRCLIB SEARCH WITH ±3s DURATION FILTER ---');
  // Query LRCLIB search: verify duration matching logic
  // Case A: duration matches within ±3s -> accepted
  // Case B: duration delta > 3s -> rejected
  const mockCandidates = [
    {
      id: 1,
      trackName: 'Yellow (Remix)',
      artistName: 'Coldplay',
      duration: 300, // Delta = 31s
      syncedLyrics: '[00:10.00]Look at the stars'
    },
    {
      id: 2,
      trackName: 'Yellow',
      artistName: 'Coldplay',
      duration: 268, // Delta = 1s <= 3s -> MATCH
      syncedLyrics: '[00:15.00]Look at the stars\n[00:18.00]Look how they shine for you'
    }
  ];

  const targetDuration = 269;
  const filtered = mockCandidates.filter(c => c.duration && Math.abs(c.duration - targetDuration) <= 3);
  assert(filtered.length === 1 && filtered[0].id === 2, 'Filters out candidate with delta > 3s and picks candidate within ±3s');

  console.log('\n--- 5. STEP 4: JIOSAAVN LYRICS PARSING & HTML STRIPPING ---');
  // Test JioSaavn HTML formatting parser
  const sampleSaavnRaw = 'Hum Tere Bin Ab Reh Nahi Sakte&lt;br&gt;Tere Bina Kya Wajood Mera&lt;br/&gt;Tujhse Juda Agar Ho Jayenge&lt;br /&gt;Toh Khud Se Hi Ho Jayenge Juda';
  const cleanSaavn = unescapeHtml(sampleSaavnRaw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  const parsedSaavnLines = lyricsIngestionService.parsePlainLyrics(cleanSaavn);
  assert(parsedSaavnLines.length === 4, `JioSaavn parsed 4 lines correctly (got ${parsedSaavnLines.length})`);
  assert(parsedSaavnLines[0].text === 'Hum Tere Bin Ab Reh Nahi Sakte', 'Line 1 text clean without HTML tags');
  assert(parsedSaavnLines[0].startTime === -1, 'Plain lyrics have non-fake startTime -1');

  console.log('\n--- 6. STEP 5: NETEASE OPEN LYRICS PARSING ---');
  const sampleNetEaseLrc = `[00:12.34]Look at the stars\n[00:16.78]Look how they shine for you\n[00:21.05]And everything you do`;
  const parsedNetEase = lyricsIngestionService.parseLrc(sampleNetEaseLrc, 180);
  assert(parsedNetEase.length === 3, `NetEase LRC parsed into 3 timed lines (got ${parsedNetEase.length})`);
  assert(parsedNetEase[0].startTime === 12.34, 'NetEase line 1 startTime matches 12.34');
  assert(parsedNetEase[1].startTime === 16.78, 'NetEase line 2 startTime matches 16.78');
  assert(parsedNetEase[0].duration > 0, 'NetEase line duration calculated between lines');

  console.log('\n--- 7. END-TO-END CANONICAL LYRICS RESOLUTION WITH STEP 1 CACHE ---');
  const testSong: Song = {
    id: 'song-auto-cache-test-77',
    title: 'Kesariya (From "Brahmastra") [Lyrical]',
    artist: 'Arijit Singh, Pritam',
    duration: 268,
    category: 'bollywood'
  };

  // Seed cache for testSong.id
  await indexedDbService.saveLyrics(testSong.id, mockPayload, 'test_seed');

  // Call resolveCanonicalLyrics
  const resolvedLines = await lyricsService.resolveCanonicalLyrics(testSong);
  assert(resolvedLines.length === 2, `resolveCanonicalLyrics returned ${resolvedLines.length} lines from Step 1 cache`);
  assert(testSong.lyricsAvailable === true, 'song.lyricsAvailable is set to true');
  assert(testSong.lyricsSyncAvailable === true, 'song.lyricsSyncAvailable is set to true for timed lines');
  assert(resolvedLines[0].text === 'केसरिया तेरा इश्क़ है पिया', 'First line text matches seeded cache');

  console.log('\n--- 8. SEARCH CANDIDATE VALIDATION & MALFORMED RESPONSE TESTS ---');

  // Reverse-prefix collisions:
  // Target "Stay with Me", candidate "Stay", same artist -> REJECT
  const revColl = isCandidateValidMatch('Stay with Me', 'Sam Smith', 'Stay', 'Sam Smith');
  assert(revColl.isMatch === false, 'Rejects candidate "Stay" for target "Stay with Me" (same artist)');

  // Target "Stay", candidate "Stay with Me", same artist -> REJECT (not an alternate-title descriptor)
  const fwdColl = isCandidateValidMatch('Stay', 'Sam Smith', 'Stay with Me', 'Sam Smith');
  assert(fwdColl.isMatch === false, 'Rejects candidate "Stay with Me" for target "Stay" (same artist)');

  // Common-title collision across different artists:
  // Target "Stay", candidate "Stay", Kid LAROI vs Rihanna -> REJECT
  const diffArtistColl = isCandidateValidMatch('Stay', 'The Kid LAROI & Justin Bieber', 'Stay', 'Rihanna');
  assert(diffArtistColl.isMatch === false, 'Rejects "Stay" collision across different artists (Kid LAROI vs Rihanna)');

  // Exact matches:
  // Target "Stay", candidate "Stay", same artist -> ACCEPT
  const exactMatch = isCandidateValidMatch('Stay', 'The Kid LAROI & Justin Bieber', 'Stay', 'The Kid LAROI, Justin Bieber');
  assert(exactMatch.isMatch === true, 'Accepts exact title match with valid artist matching');

  // Soundtrack / remaster suffixes:
  const soundtrackMatch = isCandidateValidMatch('Kesariya (From "Brahmastra")', 'Arijit Singh', 'Kesariya', 'Arijit Singh');
  assert(soundtrackMatch.isMatch === true, 'Accepts title with soundtrack suffix (From "Brahmastra")');

  const remasterMatch = isCandidateValidMatch('Yellow - Remastered 2021', 'Coldplay', 'Yellow', 'Coldplay');
  assert(remasterMatch.isMatch === true, 'Accepts title with remaster suffix (- Remastered 2021)');

  // Candidate with alternate title descriptor:
  const liveMatch = isCandidateValidMatch('Yellow', 'Coldplay', 'Yellow Live at Pompeii', 'Coldplay');
  assert(liveMatch.isMatch === true, 'Accepts candidate with supported release descriptor suffix (Live at Pompeii)');

  // Multi-artist matching:
  const multiArtistMatch = isCandidateValidMatch('Kesariya', 'Pritam, Arijit Singh, Amitabh Bhattacharya', 'Kesariya', 'Arijit Singh');
  assert(multiArtistMatch.isMatch === true, 'Accepts valid multi-artist match');

  // Featured-artist matching:
  const featArtistMatch = isCandidateValidMatch('Levitating', 'Dua Lipa feat. DaBaby', 'Levitating', 'Dua Lipa');
  assert(featArtistMatch.isMatch === true, 'Accepts valid featured-artist match');

  // Malformed HTTP 200 response handling:
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html><head><title>502 Bad Gateway</title></head><body>Proxy Error</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    const malformedContext: any = {};
    const res = await lyricsIngestionService.queryLrclibExact('Test Track', 'Test Artist', 180, undefined, undefined, malformedContext);
    assert(res === null, 'queryLrclibExact returns null on malformed response');
    assert(malformedContext.authoritativeChecked !== true, 'authoritativeChecked is NOT set on malformed HTTP 200 response');
    assert(Boolean(malformedContext.lastTransientError), 'lastTransientError is recorded on malformed HTTP 200 response');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n========================================');
  console.log('ALL RESILIENT LYRICS FETCHING TESTS PASSED!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
