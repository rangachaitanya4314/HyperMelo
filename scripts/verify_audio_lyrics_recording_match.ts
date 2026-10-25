// Regression Test Suite: Audio Track & Lyrics Recording Alignment
// Verifies that audio source selection strictly pairs the intended recording/language with the track
// Ensures alternate-language dubs (Tamil, Hindi, Kannada, Malayalam) are rejected for Telugu tracks, and vice versa.

import { playbackSourceResolver, PlaybackSourceResolver } from '../src/backend/services/PlaybackSourceResolver';
import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { playbackController } from '../src/services/audio/PlaybackController';
import type { Song } from '../src/shared';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    failed++;
    throw new Error(msg);
  } else {
    console.log(`✅ PASSED: ${msg}`);
    passed++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('HYPERMELO REGRESSION: AUDIO TRACK & LYRICS RECORDING ALIGNMENT AUDIT');
  console.log('======================================================================\n');

  const testResolver = new PlaybackSourceResolver();

  // -------------------------------------------------------------------------
  // TEST 1: Deterministic Fixtures - Telugu Track Dub Rejection & Match
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Telugu Track Dub Rejection (Deterministic Fixtures) ---');
  const teluguTargetSong: Song = {
    id: 'tr-fear-song',
    title: 'Fear Song',
    artist: 'Anirudh Ravichander',
    album: 'Devara Part 1',
    duration: 195,
    language: 'te',
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  const candidatesFearSong = [
    {
      id: 'tamil-dub-1',
      title: 'Fear Song (From "Devara Part 1")',
      subtitle: 'Anirudh Ravichander, Vishnu Edavan - Kollywood Dancing Dhamaka Hits',
      language: 'tamil',
      more_info: {
        encrypted_media_url: 'enc_tamil_1',
        album: 'Kollywood Dancing Dhamaka Hits',
        duration: '195'
      }
    },
    {
      id: 'hindi-dub-1',
      title: 'Fear Song - Hindi',
      subtitle: 'Anirudh Ravichander, Manoj Muntashir - Devara Part 1 - Hindi',
      language: 'hindi',
      more_info: {
        encrypted_media_url: 'enc_hindi_1',
        album: 'Devara Part 1 - Hindi',
        duration: '195'
      }
    },
    {
      id: 'kannada-dub-1',
      title: 'Fear Song - Kannada',
      subtitle: 'Anirudh Ravichander, Varadaraj Chikkaballapura - Devara Part 1 - Kannada',
      language: 'kannada',
      more_info: {
        encrypted_media_url: 'enc_kannada_1',
        album: 'Devara Part 1 - Kannada',
        duration: '195'
      }
    },
    {
      id: 'malayalam-dub-1',
      title: 'Fear Song - Malayalam',
      subtitle: 'Anirudh Ravichander, Mankombu Gopalakrishnan - Devara Part 1 - Malayalam',
      language: 'malayalam',
      more_info: {
        encrypted_media_url: 'enc_malayalam_1',
        album: 'Devara Part 1 - Malayalam',
        duration: '195'
      }
    },
    {
      id: 'telugu-original',
      title: 'Fear Song - Telugu',
      subtitle: 'Anirudh Ravichander, Ramajogayya Sastry - Devara Part 1 - Telugu',
      language: 'telugu',
      more_info: {
        encrypted_media_url: 'enc_telugu_valid',
        album: 'Devara Part 1 - Telugu',
        duration: '195'
      }
    }
  ];

  const scoreTamil = testResolver.scoreCandidate(teluguTargetSong, candidatesFearSong[0] as any);
  const scoreHindi = testResolver.scoreCandidate(teluguTargetSong, candidatesFearSong[1] as any);
  const scoreKannada = testResolver.scoreCandidate(teluguTargetSong, candidatesFearSong[2] as any);
  const scoreMalayalam = testResolver.scoreCandidate(teluguTargetSong, candidatesFearSong[3] as any);
  const scoreTelugu = testResolver.scoreCandidate(teluguTargetSong, candidatesFearSong[4] as any);

  assert(scoreTamil === -1, 'Tamil candidate rejected for Telugu track (score === -1)');
  assert(scoreHindi === -1, 'Hindi candidate rejected for Telugu track (score === -1)');
  assert(scoreKannada === -1, 'Kannada candidate rejected for Telugu track (score === -1)');
  assert(scoreMalayalam === -1, 'Malayalam candidate rejected for Telugu track (score === -1)');
  assert(scoreTelugu > 250, `Telugu original accepted with high score (${scoreTelugu} > 250)`);

  // -------------------------------------------------------------------------
  // TEST 2: Deterministic Fixtures - Tamil Target Rejects Telugu/Hindi Dubs
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Tamil Target Dub Rejection (Deterministic Fixtures) ---');
  const tamilTargetSong: Song = {
    id: 'tr-hukum',
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander',
    album: 'Jailer',
    duration: 207,
    language: 'ta',
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  const candidatesHukum = [
    {
      id: 'telugu-dub-hukum',
      title: 'Hukum - Telugu',
      subtitle: 'Anirudh Ravichander, Bhaskarabhatla - Jailer - Telugu',
      language: 'telugu',
      more_info: { encrypted_media_url: 'enc_1', album: 'Jailer - Telugu', duration: '207' }
    },
    {
      id: 'tamil-orig-hukum',
      title: 'Hukum - Thalaivar Alappara',
      subtitle: 'Anirudh Ravichander, Super Subu - Jailer',
      language: 'tamil',
      more_info: { encrypted_media_url: 'enc_2', album: 'Jailer', duration: '207' }
    }
  ];

  assert(testResolver.scoreCandidate(tamilTargetSong, candidatesHukum[0] as any) === -1, 'Telugu dub rejected for Tamil track');
  assert(testResolver.scoreCandidate(tamilTargetSong, candidatesHukum[1] as any) > 250, 'Tamil original accepted for Tamil track');

  // -------------------------------------------------------------------------
  // TEST 3: Deterministic Fixtures - Hindi Target Rejects Regional Dubs
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Hindi Target Dub Rejection (Deterministic Fixtures) ---');
  const hindiTargetSong: Song = {
    id: 'tr-chaleya',
    title: 'Chaleya',
    artist: 'Arijit Singh, Shilpa Rao',
    album: 'Jawan',
    duration: 200,
    language: 'hi',
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  const candidatesChaleya = [
    {
      id: 'telugu-chaleya-dub',
      title: 'Chaleya - Telugu',
      subtitle: 'Anirudh Ravichander - Jawan (Telugu)',
      language: 'telugu',
      more_info: { encrypted_media_url: 'enc_te', album: 'Jawan (Telugu)', duration: '200' }
    },
    {
      id: 'hindi-chaleya-orig',
      title: 'Chaleya',
      subtitle: 'Arijit Singh, Shilpa Rao, Anirudh Ravichander - Jawan',
      language: 'hindi',
      more_info: { encrypted_media_url: 'enc_hi', album: 'Jawan', duration: '200' }
    }
  ];

  assert(testResolver.scoreCandidate(hindiTargetSong, candidatesChaleya[0] as any) === -1, 'Telugu dub rejected for Hindi track');
  assert(testResolver.scoreCandidate(hindiTargetSong, candidatesChaleya[1] as any) > 250, 'Hindi original accepted for Hindi track');

  // -------------------------------------------------------------------------
  // TEST 4: Deterministic Fixtures - Dub Exclusion When Target Language Recording Is Missing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Dub Exclusion When Target Language Recording Is Missing ---');
  // If only Tamil/Hindi candidates exist for a Telugu track, NO audio dub is accepted
  const candidatesNoTelugu = [candidatesFearSong[0], candidatesFearSong[1]];
  const allRejected = candidatesNoTelugu.every((c) => testResolver.scoreCandidate(teluguTargetSong, c as any) === -1);
  assert(allRejected, 'All alternate-language candidates rejected when Telugu recording is absent (honest unavailable)');

  // -------------------------------------------------------------------------
  // TEST 5: Deterministic Fixtures - Missing Language Metadata With Indistinguishable Variants
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Missing Language Metadata & Indistinguishable Variants ---');
  const ambiguousSongNoLang: Song = {
    id: 'tr-ambiguous-fear',
    title: 'Fear Song',
    artist: 'Anirudh Ravichander',
    album: 'Devara Part 1',
    duration: 195,
    language: undefined, // Missing language metadata!
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  const tiedCandidates = [
    {
      id: 'cand-tamil',
      title: 'Fear Song (From "Devara Part 1")',
      subtitle: 'Anirudh Ravichander - Devara Part 1',
      language: 'tamil',
      more_info: { encrypted_media_url: 'enc_ta', album: 'Devara Part 1', duration: '195' }
    },
    {
      id: 'cand-hindi',
      title: 'Fear Song (From "Devara Part 1")',
      subtitle: 'Anirudh Ravichander - Devara Part 1',
      language: 'hindi',
      more_info: { encrypted_media_url: 'enc_hi', album: 'Devara Part 1', duration: '195' }
    },
    {
      id: 'cand-telugu',
      title: 'Fear Song (From "Devara Part 1")',
      subtitle: 'Anirudh Ravichander - Devara Part 1',
      language: 'telugu',
      more_info: { encrypted_media_url: 'enc_te', album: 'Devara Part 1', duration: '195' }
    }
  ];

  const scoreTa = testResolver.scoreCandidate(ambiguousSongNoLang, tiedCandidates[0] as any);
  const scoreHi = testResolver.scoreCandidate(ambiguousSongNoLang, tiedCandidates[1] as any);
  const scoreTe = testResolver.scoreCandidate(ambiguousSongNoLang, tiedCandidates[2] as any);

  assert(scoreTa > 0 && scoreHi > 0 && scoreTe > 0, 'All variants score positively on title/artist/duration');
  assert(Math.abs(scoreTa - scoreTe) <= 30 && Math.abs(scoreHi - scoreTe) <= 30, 'Variants are score-tied within 30 points');

  // Verify that testResolver detects conflicting languages across tied variants
  const candLangs = tiedCandidates.map((c) => testResolver.getCandidateLanguage(c as any));
  assert(candLangs[0] === 'tamil' && candLangs[1] === 'hindi' && candLangs[2] === 'telugu', 'Detected distinct languages for competing candidates');

  // -------------------------------------------------------------------------
  // TEST 6: Deterministic Fixtures - Missing Language Metadata But Clearly Distinguishable
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Missing Language Metadata With Clearly Distinguishable Candidates ---');
  const monoSongNoLang: Song = {
    id: 'tr-yellow',
    title: 'Yellow',
    artist: 'Coldplay',
    album: 'Parachutes',
    duration: 269,
    language: undefined, // Missing language metadata!
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  const distinguishableCandidates = [
    {
      id: 'yellow-orig',
      title: 'Yellow',
      subtitle: 'Coldplay - Parachutes',
      language: 'english',
      more_info: { encrypted_media_url: 'enc_orig', album: 'Parachutes', duration: '269' }
    },
    {
      id: 'yellow-remix',
      title: 'Yellow (Club Remix)',
      subtitle: 'Coldplay, DJ Mike - Remix Collection',
      language: 'english',
      more_info: { encrypted_media_url: 'enc_remix', album: 'Remix Collection', duration: '210' }
    }
  ];

  const scoreOrig = testResolver.scoreCandidate(monoSongNoLang, distinguishableCandidates[0] as any);
  const scoreRemix = testResolver.scoreCandidate(monoSongNoLang, distinguishableCandidates[1] as any);

  assert(scoreOrig >= 240, `Target candidate has high score (${scoreOrig} >= 240)`);
  assert(scoreOrig - scoreRemix > 50, `Target candidate has clear decisive lead (${scoreOrig - scoreRemix} > 50)`);
  assert(
    testResolver.getCandidateLanguage(distinguishableCandidates[0] as any) ===
    testResolver.getCandidateLanguage(distinguishableCandidates[1] as any),
    'Both candidates share same language (no cross-language conflict)'
  );

  // -------------------------------------------------------------------------
  // TEST 7: Deterministic Fixtures - Language Inferred From Album / Title Metadata
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Inferred Language From Metadata ---');
  const songWithTeluguInAlbum: Song = {
    id: 'tr-fear-inferred',
    title: 'Fear Song',
    artist: 'Anirudh Ravichander',
    album: 'Devara Part 1 - Telugu',
    duration: 195,
    language: undefined, // Missing explicit language, but present in album!
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    fullLengthAvailable: false
  };

  assert(testResolver.inferSongLanguage(songWithTeluguInAlbum) === 'telugu', 'Inferred language is telugu from album title');
  const scoreInferredTelugu = testResolver.scoreCandidate(songWithTeluguInAlbum, candidatesFearSong[4] as any);
  const scoreInferredTamil = testResolver.scoreCandidate(songWithTeluguInAlbum, candidatesFearSong[0] as any);
  assert(scoreInferredTelugu > 250, `Telugu candidate scores high with inferred language (${scoreInferredTelugu} > 250)`);
  assert(scoreInferredTamil === -1, 'Tamil candidate rejected even when song.language was undefined due to inferred language');

  // -------------------------------------------------------------------------
  // TEST 8: Deterministic Fixtures - Preservation of Legitimate Previews & Licensed Streams
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Preservation of Legitimate Previews & Licensed Streams ---');
  const previewSong: Song = {
    id: 'tr-preview',
    title: 'Preview Song',
    artist: 'Artist',
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    playbackSource: {
      provider: 'apple-preview',
      providerTrackId: 'prev-123',
      streamUrl: 'https://cdn.apple.com/preview.m4a',
      format: 'aac',
      isStreamPreview: true,
      playbackSourceType: 'preview'
    }
  };

  const licensedSong: Song = {
    id: 'tr-licensed',
    title: 'Licensed Song',
    artist: 'Artist',
    playbackAvailable: true,
    playbackType: 'full',
    playbackSourceType: 'naro-licensed',
    isStreamPreview: false,
    playbackSource: {
      provider: 'naro',
      providerTrackId: 'lic-456',
      streamUrl: 'https://licensed.naro.fm/audio.mp4',
      format: 'aac',
      isStreamPreview: false,
      playbackSourceType: 'naro-licensed'
    }
  };

  const devFixtureSong: Song = {
    id: 'tr-fixture',
    title: 'Fixture Song',
    artist: 'Artist',
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'dev-fixture'
  };

  const resolvedPrev = await testResolver.resolvePlaybackSource(previewSong);
  assert(resolvedPrev.playbackSource?.streamUrl === 'https://cdn.apple.com/preview.m4a', 'Preview stream URL preserved untouched');

  const resolvedLic = await testResolver.resolvePlaybackSource(licensedSong);
  assert(resolvedLic.playbackSource?.streamUrl === 'https://licensed.naro.fm/audio.mp4', 'Licensed stream URL preserved untouched');

  const resolvedFix = await testResolver.resolvePlaybackSource(devFixtureSong);
  assert(resolvedFix.playbackSourceType === 'dev-fixture', 'Dev fixture preserved untouched');

  // -------------------------------------------------------------------------
  // TEST 9: Real Provider End-to-End Validation: Fear Song (Live JioSaavn API)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Real Provider End-to-End Validation: Fear Song ---');
  const songs = getAllCuratedSongs();
  const catalogFear = songs.find((s) => s.id === 'tr-fear-song');
  assert(!!catalogFear, 'Found tr-fear-song in curated catalog');
  assert(catalogFear!.language === 'te', 'Catalog Fear Song language is verified as te (Telugu)');

  const resolvedFear = await playbackSourceResolver.resolvePlaybackSource(catalogFear!);
  assert(resolvedFear.id === 'tr-fear-song', 'Resolved song preserves track ID tr-fear-song');
  assert(
    resolvedFear.playbackSource?.providerTrackId === 'm0Yt29rq',
    `Resolved providerTrackId is m0Yt29rq (Telugu recording) - actual: ${resolvedFear.playbackSource?.providerTrackId}`
  );
  assert(
    resolvedFear.playbackSource?.streamUrl?.includes('313/1178c7b2a16c3fd32ec5cd002b5a1ce0_160.mp4'),
    `Stream URL is genuine Telugu recording stream - actual: ${resolvedFear.playbackSource?.streamUrl}`
  );
  assert(resolvedFear.duration === 195, `Duration is 195 seconds - actual: ${resolvedFear.duration}`);

  // -------------------------------------------------------------------------
  // TEST 10: Real Provider PlaybackController Lifecycle & Rapid Track Switching
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Real Provider PlaybackController Lifecycle & Rapid Track Switching ---');
  const catalogChaleya = songs.find((s) => s.id === 'tr-chaleya');
  assert(!!catalogChaleya, 'Found tr-chaleya in curated catalog');

  // Load Fear Song
  await playbackController.load(catalogFear!, 0);
  const current1 = playbackController.getCurrentTrack();
  assert(current1?.id === 'tr-fear-song', 'PlaybackController loaded tr-fear-song');
  assert(
    current1?.playbackSource?.providerTrackId === 'm0Yt29rq',
    'PlaybackController active source is Telugu providerTrackId m0Yt29rq'
  );

  // Rapid switch to Chaleya
  await playbackController.load(catalogChaleya!, 0);
  const current2 = playbackController.getCurrentTrack();
  assert(current2?.id === 'tr-chaleya', 'PlaybackController immediately switched to tr-chaleya');
  assert(
    current2?.playbackSource?.providerTrackId !== 'm0Yt29rq',
    'Previous Fear Song audio source was cleanly disposed and not leaked to Chaleya'
  );

  // Switch back to Fear Song
  await playbackController.load(catalogFear!, 0);
  const current3 = playbackController.getCurrentTrack();
  assert(current3?.id === 'tr-fear-song', 'PlaybackController restored tr-fear-song');
  assert(
    current3?.playbackSource?.providerTrackId === 'm0Yt29rq',
    'PlaybackController restored Telugu providerTrackId m0Yt29rq cleanly'
  );

  console.log('\n======================================================================');
  console.log(`ALL TESTS PASSED: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
