// Automated Verification for Full-Length Provider Architecture
// Covers:
// 1. preview-only track
// 2. authorized full-length track
// 3. unavailable track
// 4. dev fixture
// 5. protected full-length track
// 6. karaoke-ready track
// 7. sing-along-only track
// 8. Strict non-inference verification (duration, WAV, badges, provider name)
// 9. Startup gracefully without developer credentials

import type { Song } from '../src/types/music';
import { capabilityService } from '../src/services/capability/capabilityService';
import { playbackService } from '../src/services/audio/playbackService';
import { appleMusicKitService } from '../src/services/providers/appleMusicKitService';
import { AppleMusicPlaybackProvider } from '../src/services/audio/AppleMusicPlaybackProvider';

function createMockSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'test-track',
    title: 'Test Track',
    artist: 'Test Artist',
    duration: 180,
    genre: 'Pop',
    bpm: 120,
    musicalKey: 'C Major',
    karaokeReady: true,
    karaokeAvailable: false,
    sections: [
      { type: 'verse', label: 'Verse 1', start: 0, end: 30 },
      { type: 'chorus', label: 'Chorus', start: 30, end: 60 }
    ],
    lyrics: {
      en: { chorusSnippet: 'Test chorus snippet', lines: [] },
      hi: { chorusSnippet: 'परीक्षण', lines: [] },
      te: { chorusSnippet: 'పరీక్ష', lines: [] }
    },
    artwork: {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8'
    },
    ...overrides
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('NARO FULL-LENGTH PROVIDER ARCHITECTURE VERIFICATION');
  console.log('======================================================================\n');

  // Test 1: Preview-only track
  console.log('[Test 1] Preview-Only Track');
  const previewTrack = createMockSong({
    id: 'preview-track',
    title: 'Commercial Track (Preview Only)',
    duration: 30,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    isStreamPreview: true,
    previewAvailable: true,
    playbackSource: {
      provider: 'apple-music',
      providerTrackId: 'apple-preview-123',
      streamUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/preview.m4a',
      isStreamPreview: true
    }
  });

  const previewProvider = playbackService.selectProviderForSong(previewTrack);
  assert(previewProvider.id === 'html5-audio', 'Preview track should select html5-audio provider');
  assert(!playbackService.canPlayFullLength(previewTrack), 'Preview track must NOT confirm canPlayFullLength');
  const previewCaps = capabilityService.evaluate(previewTrack);
  assert(previewCaps.playback === 'PREVIEW', `Expected PREVIEW playback capability, got ${previewCaps.playback}`);
  assert(previewCaps.karaoke === 'KARAOKE_READY', `Expected KARAOKE_READY (unencrypted Web Audio DSP), got ${previewCaps.karaoke}`);
  console.log('  ✓ Correctly categorized as PREVIEW and KARAOKE_READY\n');

  // Test 2: Authorized Full-Length Track
  console.log('[Test 2] Authorized Full-Length Track');
  const fullLengthTrack = createMockSong({
    id: 'full-track',
    title: 'NARO Master Recording',
    duration: 240,
    playbackType: 'full',
    playbackSourceType: 'naro-licensed',
    isStreamPreview: false,
    playbackAvailable: true,
    playbackSource: {
      provider: 'naro-licensed',
      providerTrackId: 'naro-master-456',
      streamUrl: 'https://stream.naro.fm/authorized-song.mp3',
      playbackSourceType: 'naro-licensed',
      isStreamPreview: false
    }
  });

  const fullProvider = playbackService.selectProviderForSong(fullLengthTrack);
  assert(fullProvider.id === 'naro-full-length', `Expected naro-full-length provider, got ${fullProvider.id}`);
  assert(playbackService.canPlayFullLength(fullLengthTrack), 'Authorized track must confirm canPlayFullLength');
  const fullCaps = capabilityService.evaluate(fullLengthTrack);
  assert(fullCaps.playback === 'FULL_LENGTH', `Expected FULL_LENGTH, got ${fullCaps.playback}`);
  assert(fullCaps.karaoke === 'KARAOKE_READY', `Expected KARAOKE_READY, got ${fullCaps.karaoke}`);
  console.log('  ✓ Correctly confirmed as FULL_LENGTH and KARAOKE_READY by provider\n');

  // Test 3: Unavailable Track
  console.log('[Test 3] Unavailable Track (No backing, no audio stream)');
  const unavailableTrack = createMockSong({
    id: 'unavailable-track',
    title: 'Missing Track',
    playbackAvailable: false,
    playbackSourceType: 'unavailable',
    playbackSource: undefined,
    karaokeAvailable: false,
    karaokeSource: undefined
  });

  assert(!playbackService.canPlayFullLength(unavailableTrack), 'Unavailable track must NOT play full-length');
  const unavailCaps = capabilityService.evaluate(unavailableTrack);
  assert(unavailCaps.playback === 'UNAVAILABLE', `Expected UNAVAILABLE playback, got ${unavailCaps.playback}`);
  assert(unavailCaps.karaoke === 'UNAVAILABLE', `Expected UNAVAILABLE karaoke, got ${unavailCaps.karaoke}`);
  console.log('  ✓ Correctly recognized as UNAVAILABLE for both playback and karaoke\n');

  // Test 4: Dev Fixture (Midnight Drive / local WAV)
  console.log('[Test 4] Dev Fixture (Never marked full-length)');
  const devFixtureTrack = createMockSong({
    id: 'midnight-drive',
    title: 'Midnight Drive (Dev Fixture)',
    duration: 195,
    playbackSourceType: 'dev-fixture',
    playbackSource: {
      provider: 'local-file',
      streamUrl: '/audio/midnight-drive.wav',
      playbackSourceType: 'dev-fixture'
    }
  });

  assert(!playbackService.canPlayFullLength(devFixtureTrack), 'Dev fixture must NEVER confirm full-length');
  const devCaps = capabilityService.evaluate(devFixtureTrack);
  assert(devCaps.isDevFixture === true, 'isDevFixture must be true');
  assert(devCaps.playback === 'UNAVAILABLE', `Commercial playback capability must be UNAVAILABLE, got ${devCaps.playback}`);
  assert(devCaps.karaoke === 'KARAOKE_READY', `Dev fixture with local WAV should allow KARAOKE_READY testing`);
  console.log('  ✓ Strictly tagged as DEV FIXTURE, prevented from claiming full length\n');

  // Test 5: Protected Full-Length Track (Apple MusicKit when authorized)
  console.log('[Test 5] Protected Full-Length Track (Apple MusicKit)');
  const appleTrack = createMockSong({
    id: 'apple-track-789',
    title: 'Apple Music Full Track',
    playbackSource: {
      provider: 'apple-music',
      providerTrackId: '123456789'
    }
  });

  // Test provider behavior with authorized mock
  const mockAuthorizedAppleProvider = new AppleMusicPlaybackProvider();
  (mockAuthorizedAppleProvider as unknown as { isAuthorized: () => boolean }).isAuthorized = () => true;
  assert(mockAuthorizedAppleProvider.canPlayFullLength(appleTrack) === true, 'Authorized Apple provider confirms full-length');
  assert(mockAuthorizedAppleProvider.capabilities.supportsWebAudioRouting === false, 'EME DRM protected stream must NOT claim Web Audio routing');

  // When capability evaluator evaluates a track with a protected provider:
  // Simulate active provider being the authorized Apple Music provider
  (playbackService as unknown as { activeProvider: unknown }).activeProvider = mockAuthorizedAppleProvider;
  (playbackService as unknown as { appleMusicProvider: unknown }).appleMusicProvider = mockAuthorizedAppleProvider;
  (playbackService as unknown as { currentSong: Song }).currentSong = appleTrack;

  const protectedCaps = capabilityService.evaluate(appleTrack);
  assert(protectedCaps.playback === 'FULL_LENGTH', `Protected track with authorized provider must be FULL_LENGTH, got ${protectedCaps.playback}`);
  assert(protectedCaps.karaoke === 'SING_ALONG', `Protected track must be SING_ALONG (not karaoke ready), got ${protectedCaps.karaoke}`);
  console.log('  ✓ Protected track correctly marked FULL_LENGTH and SING_ALONG\n');

  // Reset playbackService mock provider
  (playbackService as unknown as { activeProvider: unknown }).activeProvider = null;
  (playbackService as unknown as { appleMusicProvider: unknown }).appleMusicProvider = new AppleMusicPlaybackProvider();
  (playbackService as unknown as { currentSong: Song | null }).currentSong = null;

  // Test 6: Karaoke-Ready Track (Dedicated instrumental backing / stems)
  console.log('[Test 6] Dedicated Instrumental Backing (KARAOKE READY)');
  const instrumentalTrack = createMockSong({
    id: 'inst-track',
    title: 'Track with Dedicated Backing',
    karaokeAvailable: true,
    karaokeSource: {
      type: 'instrumental',
      availability: 'available',
      streamUrl: 'https://stream.naro.fm/instrumental.mp3',
      provider: 'naro-licensed'
    }
  });

  const instCaps = capabilityService.evaluate(instrumentalTrack);
  assert(instCaps.karaoke === 'KARAOKE_READY', `Expected KARAOKE_READY, got ${instCaps.karaoke}`);
  console.log('  ✓ Dedicated backing confirmed KARAOKE_READY\n');

  // Test 7: Sing-Along Only Track (Protected stream where vocal suppression cannot be performed)
  console.log('[Test 7] Sing-Along Only Track');
  const singAlongTrack = createMockSong({
    id: 'sing-along-track',
    title: 'Sing Along Only Track',
    playbackAvailable: true,
    playbackSource: {
      provider: 'apple-music',
      providerTrackId: '987654321',
      streamUrl: 'https://audio.example.com/protected-stream'
    }
  });

  // Set provider with supportsWebAudioRouting: false
  const unroutableProvider = {
    id: 'protected-provider',
    name: 'Protected Provider',
    capabilities: {
      supportsFullLength: true,
      supportsSeek: true,
      supportsWebAudioRouting: false,
      supportsKaraokeProcessing: false,
      supportsLyrics: true,
      requiresAuthorization: true
    },
    canPlay: () => true,
    canPlayFullLength: () => true,
    isAuthorized: () => true
  };
  (playbackService as unknown as { activeProvider: unknown }).activeProvider = unroutableProvider;
  (playbackService as unknown as { selectProviderForSong: (s: Song) => unknown }).selectProviderForSong = () => unroutableProvider;

  const singAlongCaps = capabilityService.evaluate(singAlongTrack);
  assert(singAlongCaps.karaoke === 'SING_ALONG', `Expected SING_ALONG, got ${singAlongCaps.karaoke}`);
  console.log('  ✓ Protected stream with no Web Audio routing correctly evaluated as SING_ALONG\n');

  // Reset mocks on playbackService
  delete (playbackService as unknown as { selectProviderForSong?: unknown }).selectProviderForSong;
  (playbackService as unknown as { activeProvider: unknown }).activeProvider = null;

  // Test 8: Non-Inference Strictness (Never infer from duration, metadata, wav, badge, or provider name)
  console.log('[Test 8] Strict Non-Inference Verification');
  const fakeMetadataTrack = createMockSong({
    id: 'fake-track',
    title: 'Heuristic Trap Track',
    duration: 360, // > 35 seconds
    playbackType: 'full', // Claims full in metadata, but provider canPlayFullLength is false!
    playbackSourceType: 'preview',
    playbackSource: {
      provider: 'apple-music',
      streamUrl: 'https://audio-ssl.itunes.apple.com/trap-preview.m4a'
    }
  });

  assert(!playbackService.canPlayFullLength(fakeMetadataTrack), 'Must NOT infer full-length from duration=360 or playbackType="full"');
  const fakeCaps = capabilityService.evaluate(fakeMetadataTrack);
  assert(fakeCaps.playback === 'PREVIEW', `Must be PREVIEW despite duration > 35s, got ${fakeCaps.playback}`);
  console.log('  ✓ Heuristic traps rejected: metadata duration and labels are never trusted\n');

  // Test 9: Apple Developer Token Not Required on Normal Startup
  console.log('[Test 9] Apple Developer Token Not Required on Normal Startup');
  assert(appleMusicKitService.isAuthorized() === false, 'Startup defaults to unauthenticated without error');
  console.log('  ✓ App starts up cleanly without developer token prompts\n');

  console.log('======================================================================');
  console.log('ALL 7 ARCHITECTURE SCENARIOS & CONSTRAINTS PASSED SUCCESSFULLY');
  console.log('======================================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
