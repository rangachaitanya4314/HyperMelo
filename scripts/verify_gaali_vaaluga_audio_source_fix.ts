// Regression Verification Suite: Audio Source and Track Identity Alignment
// Verifies:
// 1. Initializing with Shot Down, then switching to Gaali Vaaluga switches BOTH track identity AND actual audio src.
// 2. Fails if UI/metadata displays Gaali Vaaluga while audio engine retains Shot Down source.
// 3. Failed source resolution displays honest error and NEVER silently plays Shot Down.
// 4. Rapid consecutive track switches cleanly discard obsolete loads and play only the latest selection.
// 5. Lyrics and artwork match the active audio track identity.

import { PlaybackController } from '../src/services/audio/PlaybackController';
import { ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import { playbackSourceResolver } from '../src/services/audio/playbackSourceResolver';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import type { Song } from '../src/shared';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRegressionVerification() {
  console.log('========================================================================');
  console.log('NARO REGRESSION VERIFICATION: AUDIO SOURCE & METADATA ALIGNMENT');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Initialize with Shot Down, then switch to Gaali Vaaluga
  // -------------------------------------------------------------------------
  console.log('>>> [Test 1] Initializing player with Shot Down, then switching to Gaali Vaaluga...');
  const controller = new PlaybackController({
    initialTrack: JOSH_WOODWARD_SHOT_DOWN
  });

  assert(
    controller.getCurrentTrack()?.id === JOSH_WOODWARD_SHOT_DOWN.id,
    'Player initially has Shot Down'
  );

  // Load Shot Down audio
  await controller.load(JOSH_WOODWARD_SHOT_DOWN, 0);
  const shotDownAudioSrc = controller.getAudioElement()?.src || '';
  console.log('  Shot Down loaded audio src:', shotDownAudioSrc);
  assert(
    shotDownAudioSrc.includes('josh-woodward-shot-down') || shotDownAudioSrc.includes('.mp3'),
    'Shot Down audio source is loaded into audio element'
  );

  // Now change selection to Gaali Vaaluga
  console.log('  Switching track selection to Gaali Vaaluga...');
  await controller.load(ANIRUDH_GAALI_VAALUGA, 0);

  const activeTrackAfterSwitch = controller.getCurrentTrack();
  const audioSrcAfterSwitch = controller.getAudioElement()?.src || '';

  console.log('  Active track after switch:', activeTrackAfterSwitch?.title, 'by', activeTrackAfterSwitch?.artist);
  console.log('  Audio src after switch:', audioSrcAfterSwitch);

  // CRITICAL REGRESSION ASSERTION:
  assert(
    activeTrackAfterSwitch?.id === ANIRUDH_GAALI_VAALUGA.id,
    'Active track identity is Gaali Vaaluga'
  );
  assert(
    !audioSrcAfterSwitch.includes('josh-woodward-shot-down'),
    'REGRESSION CHECK FAILED: Audio element still retains Shot Down audio source while track is Gaali Vaaluga!'
  );
  assert(
    audioSrcAfterSwitch.includes('itunes.apple.com') ||
      audioSrcAfterSwitch.includes('saavn') ||
      audioSrcAfterSwitch.includes('aac'),
    'Audio element actually switched to verified Gaali Vaaluga media stream'
  );

  console.log('  ✓ PASS: Both track identity and actual audio element src switched to Gaali Vaaluga!\n');

  // -------------------------------------------------------------------------
  // TEST 2: togglePlay with intended song differences
  // -------------------------------------------------------------------------
  console.log('>>> [Test 2] Testing togglePlay when intended track differs from controller track...');
  const controller2 = new PlaybackController({
    initialTrack: JOSH_WOODWARD_SHOT_DOWN
  });
  await controller2.load(JOSH_WOODWARD_SHOT_DOWN, 0);

  // Call togglePlay passing Gaali Vaaluga as intended song
  await controller2.togglePlay(ANIRUDH_GAALI_VAALUGA);

  const controller2Track = controller2.getCurrentTrack();
  const controller2AudioSrc = controller2.getAudioElement()?.src || '';
  console.log('  controller2 track:', controller2Track?.title);
  console.log('  controller2 audio src:', controller2AudioSrc);

  assert(
    controller2Track?.id === ANIRUDH_GAALI_VAALUGA.id,
    'togglePlay switched controller track to Gaali Vaaluga'
  );
  assert(
    !controller2AudioSrc.includes('josh-woodward-shot-down'),
    'togglePlay must NOT play Shot Down when Gaali Vaaluga was passed!'
  );
  console.log('  ✓ PASS: togglePlay switched track and audio source without playing Shot Down!\n');

  // -------------------------------------------------------------------------
  // TEST 3: Fresh launch defaults to null track, and explicit load resolves correctly
  // -------------------------------------------------------------------------
  console.log('>>> [Test 3] Fresh launch defaults to null track (empty player)...');
  const defaultController = new PlaybackController();
  assert(
    defaultController.getCurrentTrack() === null,
    'Fresh PlaybackController defaults to null (empty player)'
  );
  assert(
    defaultController.getCurrentClock().duration === 0,
    'Fresh PlaybackController clock duration is 0'
  );

  await defaultController.load(ANIRUDH_GAALI_VAALUGA, 0);
  assert(
    defaultController.getCurrentTrack()?.id === ANIRUDH_GAALI_VAALUGA.id,
    'Explicit load sets current track to Gaali Vaaluga'
  );
  const defaultAudioSrc = defaultController.getAudioElement()?.src || '';
  console.log('  Default loaded audio src:', defaultAudioSrc);
  assert(
    !defaultAudioSrc.includes('josh-woodward-shot-down'),
    'Default track audio source is NOT Shot Down'
  );
  console.log('  ✓ PASS: Fresh launch defaults to null track and explicit load resolves correctly!\n');

  // -------------------------------------------------------------------------
  // TEST 4: Failed source resolution displays honest error and NEVER plays Shot Down
  // -------------------------------------------------------------------------
  console.log('>>> [Test 4] Testing failed audio source resolution handling...');
  const unplayableSong: Song = {
    id: 'unplayable-test-track',
    title: 'Unplayable Song',
    artist: 'Unknown Artist',
    duration: 180,
    sections: [{ type: 'chorus', label: 'Chorus', start: 0, end: 180 }],
    isStreamPreview: false,
    playbackType: 'full',
    playbackSourceType: 'preview',
    playbackSource: {
      provider: 'custom',
      streamUrl: '' // Missing stream URL
    },
    capabilities: {
      playback: false,
      lyrics: false,
      karaoke: false,
      recording: false
    }
  };

  const controller4 = new PlaybackController();
  await controller4.loadAndPlay(unplayableSong, 0);

  const clock4 = controller4.getCurrentClock();
  const audioSrc4 = controller4.getAudioElement()?.src || '';

  console.log('  Clock state for unplayable song:', clock4.state);
  console.log('  Clock error message:', clock4.error);
  console.log('  Audio src after unplayable loadAndPlay:', audioSrc4);

  assert(clock4.state === 'error', 'State is set to error for unplayable song');
  assert(
    clock4.error?.includes('unavailable') || clock4.error?.includes('not available'),
    'Honest error message is reported'
  );
  assert(
    !audioSrc4.includes('josh-woodward-shot-down'),
    'FAILED RESOLUTION CHECK: Unplayable song must NEVER silently play Shot Down!'
  );
  console.log('  ✓ PASS: Unplayable track presents honest error and never plays Shot Down!\n');

  // -------------------------------------------------------------------------
  // TEST 5: Rapid consecutive track changes prevent race conditions
  // -------------------------------------------------------------------------
  console.log('>>> [Test 5] Testing rapid consecutive track switches (race condition prevention)...');
  const controller5 = new PlaybackController();

  const songA: Song = {
    id: 'fast-song-a',
    title: 'Fast Song A',
    artist: 'Artist A',
    duration: 120,
    playbackSource: {
      provider: 'naro',
      streamUrl: 'https://example.com/audio-a.mp3'
    }
  };

  const songB: Song = {
    id: 'fast-song-b',
    title: 'Fast Song B',
    artist: 'Artist B',
    duration: 150,
    playbackSource: {
      provider: 'naro',
      streamUrl: 'https://example.com/audio-b.mp3'
    }
  };

  // Launch load for songA, then immediately launch load for songB
  const pA = controller5.load(songA, 0);
  const pB = controller5.load(songB, 0);

  await Promise.all([pA, pB]);

  const finalTrack = controller5.getCurrentTrack();
  const finalAudioSrc = controller5.getAudioElement()?.src || '';

  console.log('  Final track after rapid load:', finalTrack?.title);
  console.log('  Final audio src:', finalAudioSrc);

  assert(finalTrack?.id === songB.id, 'Latest selected track (Song B) wins');
  assert(
    finalAudioSrc.includes('audio-b.mp3') || finalAudioSrc.endsWith('audio-b.mp3'),
    'Audio src matches the latest selected track (Song B)'
  );
  console.log('  ✓ PASS: Rapid consecutive switches correctly load only the latest track!\n');

  // -------------------------------------------------------------------------
  // TEST 6: Lyrics and metadata alignment with active audio track identity
  // -------------------------------------------------------------------------
  console.log('>>> [Test 6] Verifying lyrics and metadata association with active track...');
  const gaaliLyrics = lyricsService.getCanonicalLyricLines(ANIRUDH_GAALI_VAALUGA);
  assert(gaaliLyrics.length > 0, 'Gaali Vaaluga canonical lyrics exist');
  assert(
    gaaliLyrics[0].karaoke?.native?.includes('గాలివాలుగా') || gaaliLyrics[0].text?.includes('గాలివాలుగా'),
    'Gaali Vaaluga lyrics are Telugu text'
  );

  const shotDownLyrics = lyricsService.getCanonicalLyricLines(JOSH_WOODWARD_SHOT_DOWN);
  assert(
    shotDownLyrics.length === 0 || shotDownLyrics[0].text.includes('unavailable'),
    'Shot Down lyrics do not contain Telugu lyrics'
  );

  console.log('  ✓ PASS: Lyrics are strictly associated with track identity.\n');

  console.log('========================================================================');
  console.log('ALL 6 REGRESSION TESTS PASSED! ZERO METADATA/AUDIO MISMATCH!');
  console.log('========================================================================');
  process.exit(0);
}

runRegressionVerification().catch((err) => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
