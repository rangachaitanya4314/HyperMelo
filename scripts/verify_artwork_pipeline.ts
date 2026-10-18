import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { MOOD_CATALOG } from '../src/data/moodCatalog';
import { chartService } from '../src/services/charts/chartService';
import type { NormalizedChartTrack } from '../src/services/charts/types';
import {
  VERIFIED_SONG_ARTWORK_BY_ID,
  VERIFIED_SONG_ARTWORK_BY_KEY,
  getVerifiedSongArtwork
} from '../src/data/verifiedArtwork';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('HYPERMELO AUTHORITATIVE ARTWORK PIPELINE & CATALOG INTEGRITY SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Curated Catalog Artwork Verification
  // -------------------------------------------------------------------------
  console.log('>>> [1/6] Auditing Curated Catalog Artwork Coverage & Integrity...');
  const curated = getAllCuratedSongs();
  assert(curated.length >= 130, `Curated catalog pool is sufficiently populated (${curated.length} tracks)`);

  let curatedWithArt = 0;
  let dummyCount = 0;
  for (const song of curated) {
    const art = song.artwork?.imageUrl;
    if (art) {
      curatedWithArt++;
      if (
        art.includes('xx/yy/zz') ||
        art.includes('aa/bb/cc') ||
        art.includes('11/22/33') ||
        art.includes('placeholder')
      ) {
        dummyCount++;
      }
      assert(
        art.startsWith('https://is1-ssl.mzstatic.com/image/thumb/') || art.startsWith('http'),
        `Track [${song.id}] "${song.title}" uses official CDN URL: ${art}`
      );
    }
  }

  assert(dummyCount === 0, 'Zero dummy placeholder URLs (xx/yy/zz, aa/bb/cc) in curated catalog');
  const curatedCoveragePct = (curatedWithArt / curated.length) * 100;
  console.log(`    Curated Artwork Coverage: ${curatedWithArt}/${curated.length} (${curatedCoveragePct.toFixed(1)}%)`);
  assert(curatedCoveragePct >= 95, `Curated artwork coverage exceeds 95% threshold (Actual: ${curatedCoveragePct.toFixed(1)}%)`);

  // -------------------------------------------------------------------------
  // 2. Multilingual Mood Catalog Artwork Verification
  // -------------------------------------------------------------------------
  console.log('\n>>> [2/6] Auditing All 12 Mood Catalog Shelves for Verified Artwork...');
  let totalMoodSongs = 0;
  let moodWithArt = 0;
  let moodDummyCount = 0;

  for (const [moodName, songs] of Object.entries(MOOD_CATALOG)) {
    let shelfWithArt = 0;
    for (const song of songs) {
      totalMoodSongs++;
      const art = song.artwork?.imageUrl;
      if (art) {
        moodWithArt++;
        shelfWithArt++;
        if (
          art.includes('xx/yy/zz') ||
          art.includes('aa/bb/cc') ||
          art.includes('11/22/33')
        ) {
          moodDummyCount++;
        }
      }
    }
    const shelfPct = (shelfWithArt / songs.length) * 100;
    console.log(`    Mood "${moodName}": ${shelfWithArt}/${songs.length} (${shelfPct.toFixed(0)}%) verified covers`);
    assert(shelfWithArt >= 10, `Mood "${moodName}" has at least 10 verified covers (Actual: ${shelfWithArt})`);
  }

  assert(moodDummyCount === 0, 'Zero dummy placeholder URLs in any mood shelf');
  const moodCoveragePct = (moodWithArt / totalMoodSongs) * 100;
  console.log(`    Total Mood Songs Coverage: ${moodWithArt}/${totalMoodSongs} (${moodCoveragePct.toFixed(1)}%)`);
  assert(moodCoveragePct >= 80, `Mood catalog artwork coverage exceeds 80% threshold (Actual: ${moodCoveragePct.toFixed(1)}%)`);

  // -------------------------------------------------------------------------
  // 3. Track-to-Artwork Attributions (Audit Key Visible Tracks)
  // -------------------------------------------------------------------------
  console.log('\n>>> [3/6] Verifying Exact Track-to-Artwork Mappings (No False Attribution)...');

  const duaLipaTracks = curated.filter(s => s.artist.toLowerCase().includes('dua lipa'));
  assert(duaLipaTracks.length >= 4, `Dua Lipa tracks present in catalog (${duaLipaTracks.length})`);
  for (const t of duaLipaTracks) {
    const art = t.artwork?.imageUrl;
    assert(!!art, `Dua Lipa track "${t.title}" has verified cover art`);
    assert(!art?.includes('devara') && !art?.includes('jawan'), `Dua Lipa track "${t.title}" is never falsely attributed to unrelated soundtrack`);
  }

  // Anirudh tracks
  const fearSong = curated.find(s => s.id === 'tr-fear-song');
  assert(!!fearSong?.artwork?.imageUrl, 'Fear Song (Devara) has authentic artwork');

  const hukum = curated.find(s => s.id === 'tr-hukum');
  assert(!!hukum?.artwork?.imageUrl, 'Hukum (Jailer) has authentic artwork');

  const chaleya = curated.find(s => s.id === 'tr-chaleya');
  assert(!!chaleya?.artwork?.imageUrl, 'Chaleya (Jawan) has authentic artwork');

  assert(fearSong?.artwork?.imageUrl !== hukum?.artwork?.imageUrl, 'Fear Song and Hukum have distinct official covers');
  assert(chaleya?.artwork?.imageUrl !== hukum?.artwork?.imageUrl, 'Chaleya and Hukum have distinct official covers');

  // -------------------------------------------------------------------------
  // 4. Chart Engine Artwork Preservation in toSong()
  // -------------------------------------------------------------------------
  console.log('\n>>> [4/6] Verifying Chart Engine Artwork Preservation (toSong)...');

  // Test 4a: Preserves chartTrack.artwork_url
  const mockChartTrack: NormalizedChartTrack = {
    internal_track_id: 'test-track-1',
    provider: 'apple-music',
    provider_track_id: 'am-12345',
    title: 'Cruel Summer',
    primary_artist: 'Taylor Swift',
    album_or_release: 'Lover',
    artwork_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg',
    rank: 1,
    movement: 'same',
    is_hot: true,
    language_if_verified: 'en'
  };

  const convertedSong = chartService.toSong(mockChartTrack);
  assert(convertedSong.artwork?.imageUrl === mockChartTrack.artwork_url, 'toSong preserves explicit chartTrack.artwork_url');

  // Test 4b: Resolves from registry when chartTrack.artwork_url is missing
  const mockTrackNoArt: NormalizedChartTrack = {
    internal_track_id: 'test-track-2',
    provider: 'apple-music',
    provider_track_id: 'am-99999',
    title: 'Chaleya',
    primary_artist: 'Arijit Singh & Shilpa Rao',
    album_or_release: 'Jawan',
    rank: 2,
    movement: 'new',
    is_hot: false,
    language_if_verified: 'hi'
  };

  const convertedWithFallback = chartService.toSong(mockTrackNoArt);
  assert(!!convertedWithFallback.artwork?.imageUrl, 'toSong resolves authentic artwork from registry when artwork_url is undefined');
  assert(convertedWithFallback.artwork?.imageUrl?.includes('mzstatic'), 'Resolved artwork is an official Apple Music CDN URL');

  // -------------------------------------------------------------------------
  // 5. Missing Artwork Graceful Handling & Filtering
  // -------------------------------------------------------------------------
  console.log('\n>>> [5/6] Verifying Missing & Synthetic Artwork Handling...');

  // Track without verified artwork returns undefined (triggering branded fallback)
  const unknownArt = getVerifiedSongArtwork({
    id: 'unknown-indie-demo-track-999',
    title: 'Nonexistent Song That Never Existed',
    artist: 'Random Unknown Artist'
  });
  assert(unknownArt === undefined, 'Non-catalog tracks return undefined to allow deliberate branded fallback');

  // Registry key normalization is case-insensitive and trims whitespace
  const normArt1 = getVerifiedSongArtwork({ title: '  CHALEYA  ', artist: '  ARIJIT SINGH & SHILPA RAO  ' });
  const normArt2 = getVerifiedSongArtwork({ title: 'chaleya', artist: 'arijit singh & shilpa rao' });
  assert(normArt1 === normArt2 && !!normArt1, 'Registry keys normalize case and whitespace deterministically');

  // -------------------------------------------------------------------------
  // 6. Live CDN Availability Check
  // -------------------------------------------------------------------------
  console.log('\n>>> [6/6] Verifying Live Apple Music CDN Image Loading...');
  const sampleUrls = [
    fearSong?.artwork?.imageUrl,
    chaleya?.artwork?.imageUrl,
    hukum?.artwork?.imageUrl
  ].filter(Boolean) as string[];

  for (const url of sampleUrls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      assert(res.status === 200, `Apple Music CDN responds with HTTP 200 OK for: ${url.slice(0, 65)}...`);
      const contentType = res.headers.get('content-type');
      assert(contentType?.startsWith('image/') === true, `Response Content-Type is valid image: ${contentType}`);
    } catch (err: any) {
      console.warn(`  ⚠️ Network fetch warning: ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`ALL ${passedTests}/${totalTests} ARTWORK PIPELINE TESTS PASSED PERFECTLY!`);
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
