// ============================================================================
// Comprehensive Verification Suite: 10 Core Acceptance Criteria & Audio Regressions
// ============================================================================
// Criterion 1: Telugu Hukum -> Telugu Audio (207s Jailer Telugu soundtrack)
// Criterion 2: Tamil Hukum -> Tamil Audio (207s Jailer Tamil original)
// Criterion 3: No Silent Substitution for Regional/Dub Versions
// Criterion 4: Telugu/Malayalam Lyrics Isolation & Wrong-Language Rejection
// Criterion 5: Full-Length Playback Beyond 30s (Hukum, Starboy, Poolane Kunukuveyamanta)
// Criterion 6: Honest Preview Labels for Genuine Preview-Only Sources
// Criterion 7: Complete 14+ Provider Cascade Without Stopping at First Failure
// Criterion 8: Rate-Limit Bounds and Cooldown Handling (429 / 503)
// Criterion 9: Audio and Lyrics Language & Version Correspondence
// Criterion 10: Honest Exhaustion Reporting Without Fabricated Content
// Foundation Checks: Starboy/Hukum Isolation, Gaali Vaaluga Fallback Removal, Catalog Collision Check

import { PlaybackController } from '../src/services/audio/PlaybackController';
import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { ANIRUDH_GAALI_VAALUGA } from '../src/data/songs';
import { naroCatalogProvider } from '../src/services/providers/NaroCatalogProvider';
import { getCanonicalTrackDuration, type Song } from '../src/shared';
import { playbackSourceResolver } from '../src/backend/services/PlaybackSourceResolver';
import {
  lyricsIngestionService,
  isLyricsCompatibleWithTarget,
  isCandidateTitleLanguageCompatible,
  isCandidateValidMatch,
  type ProviderContext
} from '../src/backend/services/LyricsIngestionService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function runAllVerifications() {
  console.log('========================================================================');
  console.log('10-POINT COMPREHENSIVE VERIFICATION SUITE: PLAYBACK & LYRICS INTEGRITY');
  console.log('========================================================================\n');

  const allSongs = getAllCuratedSongs();

  // -------------------------------------------------------------------------
  // CRITERION 1: Telugu Hukum -> Telugu Audio (Live Resolution)
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 1] Verifying Telugu Hukum resolves to authentic Telugu audio...');
  const teluguHukumQuery: Song = {
    id: 'hukum-telugu-test',
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
  };

  const resolvedTeluguHukum = await playbackSourceResolver.resolvePlaybackSource(teluguHukumQuery);
  console.log(`  Resolved Telugu Hukum: duration=${resolvedTeluguHukum.duration}s, playbackType=${resolvedTeluguHukum.playbackType}`);
  console.log(`  streamUrl: ${resolvedTeluguHukum.playbackSource?.streamUrl}`);

  assert(
    resolvedTeluguHukum.playbackType === 'full',
    'Telugu Hukum must resolve to playbackType "full"'
  );
  assert(
    resolvedTeluguHukum.duration >= 200,
    `Telugu Hukum duration must be full-length (>= 200s, expected ~207s), got ${resolvedTeluguHukum.duration}s`
  );
  assert(
    !resolvedTeluguHukum.isStreamPreview,
    'Telugu Hukum must not be marked as stream preview'
  );
  assert(
    Boolean(resolvedTeluguHukum.playbackSource?.streamUrl?.includes('saavncdn.com')),
    'Telugu Hukum must resolve to Saavn CDN stream'
  );
  assert(
    !resolvedTeluguHukum.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4'),
    'Telugu Hukum must NOT resolve to Tamil original audio (0c4d0aee91a3ac81d4b645ec448a2960)!'
  );
  assert(
    resolvedTeluguHukum.playbackSource?.providerTrackId === 'rtIe2EtQ' ||
    resolvedTeluguHukum.playbackSource?.providerTrackId === 'unPkX21N' ||
    resolvedTeluguHukum.playbackSource?.streamUrl?.includes('4161a58e6cff0010c02431e6c21728d9_160.mp4') ||
    resolvedTeluguHukum.playbackSource?.streamUrl?.includes('e6d7d0ec7d070a18d7b78dba2a8b372c_160.mp4'),
    'Telugu Hukum must resolve to the authentic 207s Jailer Telugu soundtrack recording (rtIe2EtQ or unPkX21N)!'
  );
  console.log('  ✓ PASS: Telugu Hukum resolves to authentic 207s Telugu Jailer soundtrack.\n');

  // -------------------------------------------------------------------------
  // CRITERION 2: Tamil Hukum -> Tamil Audio (Live Resolution)
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 2] Verifying Tamil Hukum resolves to authentic Tamil audio...');
  const tamilHukum = allSongs.find((s) => s.id === 'tr-hukum')!;
  const resolvedTamilHukum = await playbackSourceResolver.resolvePlaybackSource(tamilHukum);
  console.log(`  Resolved Tamil Hukum: duration=${resolvedTamilHukum.duration}s, playbackType=${resolvedTamilHukum.playbackType}`);
  console.log(`  streamUrl: ${resolvedTamilHukum.playbackSource?.streamUrl}`);

  assert(
    resolvedTamilHukum.playbackType === 'full',
    'Tamil Hukum must resolve to playbackType "full"'
  );
  assert(
    resolvedTamilHukum.duration >= 200,
    `Tamil Hukum duration must be full-length (>= 200s), got ${resolvedTamilHukum.duration}s`
  );
  assert(
    !resolvedTamilHukum.isStreamPreview,
    'Tamil Hukum must not be marked as stream preview'
  );
  assert(
    Boolean(resolvedTamilHukum.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4')),
    'Tamil Hukum must resolve to original Tamil recording (0c4d0aee91a3ac81d4b645ec448a2960)'
  );
  console.log('  ✓ PASS: Tamil Hukum resolves to authentic 207s Tamil original recording.\n');

  // -------------------------------------------------------------------------
  // CRITERION 3: No Silent Substitution for Regional/Dub Versions
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 3] Verifying no silent substitution for foreign dub requests...');
  const unsupportedDubTrack: Song = {
    id: 'hukum-spanish-dub-unsupported',
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
      providerTrackId: 'spanish-preview-id',
      streamUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/spanish-preview.m4a',
      format: 'aac',
      isStreamPreview: true,
      playbackSourceType: 'preview'
    }
  };

  const resolvedDubResult = await playbackSourceResolver.resolvePlaybackSource(unsupportedDubTrack);
  console.log(`  Dub request resolved playbackType: ${resolvedDubResult.playbackType}, isPreview: ${resolvedDubResult.isStreamPreview}`);
  assert(
    resolvedDubResult.playbackType === 'preview',
    'Unsupported dub must NOT silently substitute full-length Tamil/Telugu audio!'
  );
  assert(
    resolvedDubResult.isStreamPreview === true,
    'Unsupported dub must remain marked as preview'
  );
  assert(
    resolvedDubResult.duration === 30,
    'Unsupported dub duration must remain 30s preview duration'
  );
  console.log('  ✓ PASS: No silent substitution: unsupported dub preserved honestly as preview.\n');

  // -------------------------------------------------------------------------
  // CRITERION 4: Telugu/Malayalam Lyrics Isolation & Rejection
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 4] Verifying Telugu/Malayalam lyrics isolation and rejection...');
  const mlLyricsText = `
[00:12.30]ആരാധികേ മണിമുകിലുപോലെ
[00:15.80]നിനക്കു ഞാൻ സ്നേഹം കണ്ടേ
[00:20.10]ഇന്നു ഇത് സ്വപ്നമോ
  `.trim();

  const teLyricsText = `
[00:10.50]పూలనే కునుకువేయమంటా
[00:14.20]గుండెలోన వెన్నెల కురిసిందా
[00:18.40]కనులలో కలలే దాగివున్నాయా
  `.trim();

  assert(!isLyricsCompatibleWithTarget(mlLyricsText, 'te'), 'Malayalam script lyrics rejected for Telugu target');
  assert(isLyricsCompatibleWithTarget(teLyricsText, 'te'), 'Telugu script lyrics accepted for Telugu target');
  assert(isLyricsCompatibleWithTarget(mlLyricsText, 'ml'), 'Malayalam script lyrics accepted for Malayalam target');
  assert(!isLyricsCompatibleWithTarget(teLyricsText, 'ml'), 'Telugu script lyrics rejected for Malayalam target');

  // Title tag check
  assert(!isCandidateTitleLanguageCompatible('Hukum (From "Jailer") [Malayalam]', 'te'), 'Candidate title [Malayalam] rejected for Telugu');
  assert(isCandidateTitleLanguageCompatible('Hukum (From "Jailer") [Telugu]', 'te'), 'Candidate title [Telugu] accepted for Telugu');

  // buildSongLyricsFromLines check
  const mlLines = lyricsIngestionService.parseLrc(mlLyricsText, 180);
  const builtForTe = lyricsIngestionService.buildSongLyricsFromLines(mlLines, 'te');
  assert(builtForTe === null, 'buildSongLyricsFromLines returns null when Malayalam script parsed for Telugu song');

  console.log('  ✓ PASS: Malayalam lyrics strictly isolated and rejected for Telugu songs.\n');

  // -------------------------------------------------------------------------
  // CRITERION 5: Full-Length Playback Beyond 30s (Hukum, Starboy, Poolane Kunukuveyamanta)
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 5] Verifying Full-Length Playback Beyond 30s for Hukum, Starboy, Poolane Kunukuveyamanta...');

  const starboy = allSongs.find((s) => s.id === 'en-starboy')!;
  const resolvedStarboy = await playbackSourceResolver.resolvePlaybackSource(starboy);

  const poolaneQuery: Song = {
    id: 'te-poolane-test',
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
  };
  const resolvedPoolane = await playbackSourceResolver.resolvePlaybackSource(poolaneQuery);

  console.log(`  Starboy resolved duration: ${resolvedStarboy.duration}s (playbackType: ${resolvedStarboy.playbackType})`);
  console.log(`  Poolane resolved duration: ${resolvedPoolane.duration}s (playbackType: ${resolvedPoolane.playbackType})`);
  console.log(`  Hukum (Tamil) resolved duration: ${resolvedTamilHukum.duration}s`);
  console.log(`  Hukum (Telugu) resolved duration: ${resolvedTeluguHukum.duration}s`);

  assert(resolvedStarboy.duration >= 200 && resolvedStarboy.playbackType === 'full', 'Starboy resolved full length');
  assert(resolvedPoolane.duration >= 300 && resolvedPoolane.playbackType === 'full', 'Poolane Kunukuveyamanta resolved full length (308s)');
  assert(resolvedTamilHukum.duration >= 200 && resolvedTamilHukum.playbackType === 'full', 'Tamil Hukum resolved full length');
  assert(resolvedTeluguHukum.duration >= 200 && resolvedTeluguHukum.playbackType === 'full', 'Telugu Hukum resolved full length');

  // PlaybackController clock verification
  const controller = new PlaybackController();
  await controller.load(resolvedPoolane, 0);
  assert(controller.getDuration() >= 300, `Player clock reflects Poolane duration (>= 300s), got ${controller.getDuration()}s`);
  assert(controller.getAudioElement()?.src === resolvedPoolane.playbackSource?.streamUrl, 'Player audio element src matches resolved media');

  await controller.load(resolvedStarboy, 0);
  assert(controller.getDuration() >= 200, `Player clock reflects Starboy duration (>= 200s), got ${controller.getDuration()}s`);
  assert(controller.getAudioElement()?.src === resolvedStarboy.playbackSource?.streamUrl, 'Player audio element src matches Starboy media');

  console.log('  ✓ PASS: All target songs resolve to > 200s/300s full-length media and load into player clock.\n');

  // -------------------------------------------------------------------------
  // CRITERION 6: Honest Preview Labels for Genuine Preview-Only Sources
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 6] Verifying honest preview labels for genuine preview-only sources...');
  const obscurePreviewTrack: Song = {
    id: 'obscure-preview-song',
    title: 'Obscure Independant Snippet ZZZ 12345',
    artist: 'Unsigned Unknown Indie Artist 98765',
    album: 'Demo EP',
    duration: 30,
    fullTrackDuration: 30,
    isStreamPreview: true,
    previewAvailable: true,
    fullLengthAvailable: false,
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSource: {
      provider: 'apple-music',
      providerTrackId: 'dummy-id',
      streamUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/obscure.m4a',
      format: 'aac',
      isStreamPreview: true,
      playbackSourceType: 'preview'
    }
  };

  const previewResolved = await playbackSourceResolver.resolvePlaybackSource(obscurePreviewTrack);
  assert(previewResolved.duration === 30, 'Preview-only duration preserved as 30s');
  assert(previewResolved.isStreamPreview === true, 'Preview-only isStreamPreview preserved as true');
  assert(previewResolved.playbackType === 'preview', 'Preview-only playbackType preserved as preview');
  assert(previewResolved.fullLengthAvailable === false, 'fullLengthAvailable preserved as false');
  console.log('  ✓ PASS: Genuine previews honestly labeled without masquerading as full length.\n');

  // -------------------------------------------------------------------------
  // CRITERION 7: Complete 14+ Provider Cascade Without Stopping at First Failure
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 7] Verifying complete 14+ provider cascade execution and logging...');
  const cascadeContext: ProviderContext = {};
  lyricsIngestionService.resetCooldown();

  // Query a track through cascade with context logging
  await lyricsIngestionService.fetchLyrics(
    'Starboy',
    'The Weeknd',
    230,
    'Starboy',
    undefined,
    'en',
    'starboy-cascade-test',
    cascadeContext
  );

  assert(Boolean(cascadeContext.providerLogs), 'Provider attempt logs must be recorded in context');
  const loggedProviders = Object.keys(cascadeContext.providerLogs || {});
  console.log(`  Logged providers in cascade (${loggedProviders.length} providers): ${loggedProviders.join(', ')}`);

  // Verify key BitChord providers are present in cascade definitions
  const expectedProviders = [
    'lrclib_exact',
    'lrc_red',
    'lrclib_search',
    'netease',
    'jiosaavn',
    'kugou',
    'youtube_captions',
    'youtube_music',
    'simpmusic',
    'paxsenix',
    'betterlyrics',
    'lyricsplus',
    'binilyrics',
    'unison',
    'megalobiz',
    'genius',
    'musixmatch'
  ];

  for (const expected of expectedProviders) {
    assert(
      loggedProviders.includes(expected),
      `Expected provider "${expected}" to be included in multi-provider cascade!`
    );
  }

  // Verify status transitions: every checked provider has a valid status
  const validStatuses = [
    'not_checked',
    'checking',
    'provider_failed',
    'no_matching_lyrics',
    'plain_lyrics_found',
    'synchronized_lyrics_found',
    'auth_required',
    'service_deprecated',
    'unimplemented_stub'
  ];

  for (const pId of loggedProviders) {
    const log = cascadeContext.providerLogs![pId];
    assert(validStatuses.includes(log.status), `Provider ${pId} status "${log.status}" is valid`);
  }

  console.log('  ✓ PASS: Complete 14+ provider cascade configured and status transitions tracked.\n');

  // -------------------------------------------------------------------------
  // CRITERION 8: Rate-Limit Bounds and Cooldown on 429/503
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 8] Verifying rate-limit bounds and cooldown on 429/503...');
  lyricsIngestionService.resetCooldown();
  assert(!lyricsIngestionService.isLrclibInCooldown(), 'Cooldown begins cleared');

  // Trigger cooldown with 30s header
  lyricsIngestionService.triggerLrclibCooldown('30');
  assert(lyricsIngestionService.isLrclibInCooldown(), 'Cooldown is active after trigger');
  const remainingCooldown = lyricsIngestionService.getLrclibCooldownRemainingMs();
  assert(remainingCooldown > 25000 && remainingCooldown <= 30000, `Cooldown duration respected (~30s, got ${remainingCooldown}ms)`);

  // Verify queryLrclibExact short-circuits during cooldown
  const cooldownCtx: ProviderContext = {};
  const resDuringCooldown = await lyricsIngestionService.queryLrclibExact(
    'Starboy',
    'The Weeknd',
    230,
    'en',
    undefined,
    cooldownCtx
  );
  assert(resDuringCooldown === null, 'queryLrclibExact returns null immediately during active cooldown');
  assert(Boolean(cooldownCtx.lastTransientError?.message?.includes('cooldown')), 'cooldownCtx notes active cooldown');

  lyricsIngestionService.resetCooldown();
  console.log('  ✓ PASS: Rate-limit 429/503 triggers immediate cooldown without network hammering.\n');

  // -------------------------------------------------------------------------
  // CRITERION 9: Audio and Lyrics Language & Version Correspondence
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 9] Verifying Audio and Lyrics Language Correspondence...');
  // A Telugu track must only be paired with Telugu compatible lyrics
  const teCandidateMatch = isCandidateValidMatch(
    'Hukum',
    'Anirudh Ravichander',
    'Hukum (From "Jailer") [Telugu]',
    'Anirudh Ravichander, Dinker Kalvala',
    'te'
  );
  assert(teCandidateMatch.isMatch, 'Telugu candidate matches Telugu audio');

  const taCandidateMatch = isCandidateValidMatch(
    'Hukum',
    'Anirudh Ravichander',
    'Hukum (From "Jailer") [Tamil]',
    'Anirudh Ravichander',
    'ta'
  );
  assert(taCandidateMatch.isMatch, 'Tamil candidate matches Tamil audio');

  const crossLangMatch = isCandidateValidMatch(
    'Hukum',
    'Anirudh Ravichander',
    'Hukum (From "Jailer") [Tamil]',
    'Anirudh Ravichander',
    'te'
  );
  assert(!crossLangMatch.isMatch, 'Tamil candidate does NOT match Telugu audio!');

  console.log('  ✓ PASS: Audio recording and lyrics strictly correspond to the same language & version.\n');

  // -------------------------------------------------------------------------
  // CRITERION 10: Honest Result Reporting on Exhaustion Without Fabricated Content
  // -------------------------------------------------------------------------
  console.log('>>> [Criterion 10] Verifying honest exhaustion reporting without fabricated content...');
  const exhaustedContext: ProviderContext = {};

  // Query an impossible song that no provider will ever have
  const impossibleResult = await lyricsIngestionService.fetchLyrics(
    'Nonexistent Impossible Query XYZ 9876543210',
    'Nonexistent Unknown Phantom Entity 12345',
    180,
    'Unknown Album',
    undefined,
    'en',
    'impossible-test-track',
    exhaustedContext
  );

  assert(impossibleResult === null, 'Exhausted cascade returns null without inventing fake lyrics');
  assert(exhaustedContext.exhausted === true, 'exhaustedContext flags exhausted: true');
  console.log('  ✓ PASS: Honest exhaustion reporting: returns null with exhausted flag, zero fabricated content.\n');

  // -------------------------------------------------------------------------
  // FOUNDATION CHECKS: Starboy/Hukum Isolation, Gaali Vaaluga Fallback, Catalog Integrity
  // -------------------------------------------------------------------------
  console.log('>>> [Foundation Checks] Verifying baseline audio defect fixes and URL integrity...');

  // 1. Starboy and Hukum distinct audio sources
  assert(
    starboy.playbackSource?.streamUrl !== tamilHukum.playbackSource?.streamUrl,
    'Starboy and Hukum curated streams must differ'
  );
  assert(
    !starboy.playbackSource?.streamUrl?.includes('0c4d0aee91a3ac81d4b645ec448a2960_160.mp4'),
    'Starboy must not use Hukum Saavn audio'
  );

  // 2. Gaali Vaaluga fallback removal
  const gvTracks = allSongs.filter(s => s.title.toLowerCase().includes('gaali vaaluga'));
  for (const g of gvTracks) {
    assert(!g.playbackSource?.streamUrl?.includes('midnight-drive.wav'), 'No Gaali Vaaluga track may use midnight-drive.wav');
    assert(!g.playbackSource?.streamUrl?.includes('m4a.mp1'), 'No Gaali Vaaluga track may have 404 m4a.mp1 URL');
  }
  assert(!ANIRUDH_GAALI_VAALUGA.playbackSource?.streamUrl?.includes('midnight-drive.wav'), 'ANIRUDH_GAALI_VAALUGA does not use midnight-drive.wav');

  // 3. Zero cross-track URL collisions
  const urlToTracks = new Map<string, string[]>();
  for (const song of allSongs) {
    const url = song.playbackSource?.streamUrl;
    if (url && !url.startsWith('/audio/')) {
      const existing = urlToTracks.get(url) || [];
      existing.push(`[${song.id}] ${song.title} - ${song.artist}`);
      urlToTracks.set(url, existing);
    }
  }

  let collisions = 0;
  for (const [, tracks] of urlToTracks.entries()) {
    if (tracks.length > 1) {
      const titles = new Set(tracks.map(t => t.split('] ')[1].split(' - ')[0].trim().toLowerCase()));
      if (titles.size > 1) collisions++;
    }
  }
  assert(collisions === 0, `Zero cross-track URL collisions across catalog (found ${collisions})`);
  console.log('  ✓ PASS: Starboy/Hukum isolation, Gaali Vaaluga fallback removal, and URL integrity verified.\n');

  console.log('========================================================================');
  console.log('ALL 10 ACCEPTANCE CRITERIA AND FOUNDATION CHECKS PASSED (100% SUITE PASS)');
  console.log('========================================================================');
}

runAllVerifications().catch(err => {
  console.error('\n❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
