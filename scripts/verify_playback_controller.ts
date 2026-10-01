// NARO Playback Controller Verification Suite
// Phase 3.5B: Verifies PlaybackController responsibilities, single provider ownership,
// delegation, clock propagation, provider replacement cleanup, and subscription cleanup.

import { PlaybackController, playbackController } from '../src/services/audio/PlaybackController';
import { PlaybackService, playbackService } from '../src/services/audio/playbackService';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import type { Song, MusicPlaybackProvider, PlaybackClockEvent, ProviderCapabilities } from '../src/shared';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Minimal mock provider helper for unit testing delegation & lifecycle
function createMockProvider(id: string, name: string): {
  provider: MusicPlaybackProvider;
  calls: {
    play: number;
    pause: number;
    seek: number[];
    load: number;
    dispose: number;
    setVolume: number[];
  };
  emitClock: (event: Partial<PlaybackClockEvent>) => void;
} {
  let clockListener: ((e: PlaybackClockEvent) => void) | null = null;
  const calls = {
    play: 0,
    pause: 0,
    seek: [] as number[],
    load: 0,
    dispose: 0,
    setVolume: [] as number[]
  };

  const capabilities: ProviderCapabilities = {
    supportsFullLength: true,
    supportsSeek: true,
    supportsWebAudioRouting: true,
    supportsKaraokeProcessing: true,
    supportsLyrics: true,
    requiresAuthorization: false
  };

  const provider: MusicPlaybackProvider = {
    id,
    name,
    capabilities,
    authenticate: async () => true,
    isAuthorized: () => true,
    canPlay: () => true,
    canPlayFullLength: () => true,
    load: async (_song: Song, _startTime?: number) => {
      calls.load++;
    },
    play: async () => {
      calls.play++;
    },
    pause: () => {
      calls.pause++;
    },
    resume: async () => {
      calls.play++;
    },
    seek: (time: number) => {
      calls.seek.push(time);
    },
    setVolume: (volume: number) => {
      calls.setVolume.push(volume);
    },
    getCurrentTime: () => (calls.seek.length ? calls.seek[calls.seek.length - 1] : 0),
    getDuration: () => 200,
    getState: () => 'idle',
    getVisualizerData: () => null,
    dispose: () => {
      calls.dispose++;
    },
    destroy: () => {
      calls.dispose++;
    }
  };

  return {
    provider,
    calls,
    emitClock: (event: Partial<PlaybackClockEvent>) => {
      if (clockListener) {
        clockListener({
          currentTime: 0,
          duration: 200,
          bufferedTime: 0,
          isPlaying: false,
          state: 'idle',
          playbackType: 'full',
          providerId: id,
          ...event
        });
      }
    }
  };
}

async function runPlaybackControllerVerification() {
  console.log('======================================================================');
  console.log('NARO PHASE 3.5B — PLAYBACK CONTROLLER SPECIFICATION VERIFICATION');
  console.log('======================================================================\n');

  // =========================================================================
  // CHECK 1: Exactly One Playback Provider Active at a Time
  // =========================================================================
  console.log('[Check 1] Verifying Single Active Playback Provider Invariant...');
  const controller = new PlaybackController();

  const initialProvider = controller.getActiveProvider();
  assert(initialProvider !== null, 'Initial active provider is present');
  assert(
    initialProvider === controller.naroFullLengthProvider,
    'Default active provider is naroFullLengthProvider for licensed catalog tracks'
  );

  // Switch to an Apple preview track
  const previewTrack: Song = {
    id: 'test-preview-track',
    title: 'Test Preview Track',
    artist: 'Preview Artist',
    duration: 30,
    sections: [{ type: 'chorus', label: 'Chorus', start: 0, end: 30 }],
    isStreamPreview: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    playbackSource: {
      provider: 'itunes',
      streamUrl: 'https://audio-ssl.itunes.apple.com/test-preview.m4a'
    },
    capabilities: {
      playback: true,
      lyrics: false,
      karaoke: false,
      recording: false
    }
  };

  const previewProvider = controller.selectProviderForSong(previewTrack);
  assert(previewProvider.id === 'html5-audio', 'Preview track selects html5Provider');

  await controller.load(previewTrack, 0);
  const currentActive = controller.getActiveProvider();
  assert(currentActive !== null, 'Active provider is present after load');
  assert(currentActive === controller.html5Provider, 'Active provider switched strictly to html5Provider');
  assert(currentActive !== controller.naroFullLengthProvider, 'Previous provider is NOT active');
  assert(currentActive !== controller.youtubeProvider, 'YouTube provider is NOT active');
  assert(currentActive !== controller.appleMusicProvider, 'Apple MusicKit provider is NOT active');
  console.log('  ✅ PASS: Exactly one playback provider is active at any given moment');

  // =========================================================================
  // CHECK 2: Play and Pause Delegation
  // =========================================================================
  console.log('\n[Check 2] Verifying Play and Pause Delegation...');
  const mockA = createMockProvider('mock-a', 'Mock Provider A');
  controller.setActiveProvider(mockA.provider);
  assert(controller.getActiveProvider() === mockA.provider, 'Mock A set as active provider');

  await controller.play();
  assert(mockA.calls.play === 1, 'controller.play() delegated to activeProvider.play()');

  controller.pause();
  assert(mockA.calls.pause === 1, 'controller.pause() delegated to activeProvider.pause()');

  await controller.play();
  assert(mockA.calls.play === 2, 'controller.play() second invocation delegated correctly');

  controller.pause();
  assert(mockA.calls.pause === 2, 'controller.pause() second invocation delegated correctly');
  console.log('  ✅ PASS: play() and pause() delegate correctly to active provider');

  // =========================================================================
  // CHECK 3: Seek Delegation
  // =========================================================================
  console.log('\n[Check 3] Verifying Seek Delegation...');
  controller.seek(42.5);
  assert(mockA.calls.seek.includes(42.5), 'controller.seek(42.5) delegated to activeProvider.seek(42.5)');
  assert(controller.getCurrentTime() === 42.5, 'controller.getCurrentTime() reflects seek position');

  controller.seek(88.0);
  assert(mockA.calls.seek.includes(88.0), 'controller.seek(88.0) delegated to activeProvider.seek(88.0)');
  assert(controller.getCurrentTime() === 88.0, 'controller.getCurrentTime() reflects updated seek position');
  console.log('  ✅ PASS: seek() delegates correctly and updates clock time');

  // =========================================================================
  // CHECK 4: Playback Clock Events Propagation & Enrichment
  // =========================================================================
  console.log('\n[Check 4] Verifying Authoritative Playback Clock Events Propagation...');
  const receivedEvents: PlaybackClockEvent[] = [];
  const unsubClock = controller.subscribeClock((event) => {
    receivedEvents.push(event);
  });

  // Verify immediate initial snapshot
  assert(receivedEvents.length >= 1, 'Subscriber immediately receives current clock snapshot');

  // Trigger internal clock event through provider clock listener
  (controller as unknown as { handleClockEvent: (e: PlaybackClockEvent) => void }).handleClockEvent({
    currentTime: 15.5,
    duration: 255,
    bufferedTime: 30,
    isPlaying: true,
    state: 'playing',
    playbackType: 'full',
    playbackSourceType: 'open-license',
    providerId: 'mock-a'
  });

  assert(receivedEvents.length >= 2, 'Subscriber receives propagated clock event');
  const latestEvent = receivedEvents[receivedEvents.length - 1];
  assert(latestEvent.currentTime === 15.5, 'Propagated event has correct currentTime');
  assert(latestEvent.duration === 255, 'Propagated event has correct duration');
  assert(latestEvent.isPlaying === true, 'Propagated event has correct isPlaying state');
  assert(latestEvent.state === 'playing', 'Propagated event has correct state');
  assert(latestEvent.providerId === 'mock-a', 'Propagated event enriched with active providerId');
  assert(controller.getCurrentTime() === 15.5, 'controller.getCurrentTime() updated from clock event');
  assert(controller.isPlaying() === true, 'controller.isPlaying() updated from clock event');

  unsubClock();
  console.log('  ✅ PASS: Playback clock events propagate correctly with authoritative enrichment');

  // =========================================================================
  // CHECK 5: Provider Replacement Cleans Up Previous Provider
  // =========================================================================
  console.log('\n[Check 5] Verifying Provider Replacement Cleanup Invariant...');
  const mockOld = createMockProvider('mock-old', 'Old Provider');
  const mockNew = createMockProvider('mock-new', 'New Provider');

  controller.setActiveProvider(mockOld.provider);
  assert(controller.getActiveProvider() === mockOld.provider, 'Old provider is initially active');
  assert(mockOld.calls.dispose === 0, 'Old provider not yet disposed');

  // Switch to new provider
  controller.setActiveProvider(mockNew.provider);
  assert(controller.getActiveProvider() === mockNew.provider, 'New provider is now active');
  assert(mockOld.calls.pause >= 1, 'Replaced provider was paused on replacement');
  assert(mockOld.calls.dispose >= 1, 'Replaced provider was disposed on replacement');
  assert(mockNew.calls.dispose === 0, 'New provider is active and not disposed');
  console.log('  ✅ PASS: Provider replacement cleanly pauses and disposes previous provider');

  // =========================================================================
  // CHECK 6: Clock Subscriptions are Cleaned Up
  // =========================================================================
  console.log('\n[Check 6] Verifying Clock Subscriptions Cleanup...');
  let listener1Calls = 0;
  let listener2Calls = 0;

  const unsub1 = controller.subscribeClock(() => {
    listener1Calls++;
  });
  const unsub2 = controller.subscribeClock(() => {
    listener2Calls++;
  });

  const calls1Before = listener1Calls;
  const calls2Before = listener2Calls;

  // Unsubscribe listener 1
  unsub1();

  // Emit another clock event
  (controller as unknown as { handleClockEvent: (e: PlaybackClockEvent) => void }).handleClockEvent({
    currentTime: 25.0,
    duration: 255,
    bufferedTime: 30,
    isPlaying: true,
    state: 'playing',
    playbackType: 'full',
    playbackSourceType: 'open-license',
    providerId: 'mock-new'
  });

  assert(listener1Calls === calls1Before, 'Unsubscribed listener was NOT invoked after unsubscribing');
  assert(listener2Calls === calls2Before + 1, 'Remaining active listener was invoked');

  unsub2();
  console.log('  ✅ PASS: Clock subscriptions clean up completely upon unsubscription');

  // =========================================================================
  // CHECK 7: No Duplicate Audio Ownership / Single Authoritative Source
  // =========================================================================
  console.log('\n[Check 7] Verifying Single Audio Ownership & No Competing Elements...');
  const naroProviderAudio = controller.naroFullLengthProvider.getAudioElement();
  const html5ProviderAudio = controller.html5Provider.getAudioElement();

  assert(naroProviderAudio !== null, 'NaroFullLengthPlaybackProvider owns an audio element');
  assert(html5ProviderAudio !== null, 'Html5AudioPlaybackProvider owns an audio element');
  assert(naroProviderAudio !== html5ProviderAudio, 'Each provider encapsulates its own distinct element');

  // When active provider is naroFullLengthProvider, getAudioElement returns naroProviderAudio
  controller.setActiveProvider(controller.naroFullLengthProvider);
  assert(controller.getAudioElement() === naroProviderAudio, 'controller.getAudioElement() returns active provider audio');

  // When active provider is html5Provider, getAudioElement returns html5ProviderAudio
  controller.setActiveProvider(controller.html5Provider);
  assert(controller.getAudioElement() === html5ProviderAudio, 'controller.getAudioElement() returns active provider audio');

  // Compatibility facade verification
  const facade = new PlaybackService(controller);
  assert(facade.getAudioElement() === html5ProviderAudio, 'playbackService facade returns active audio element');
  controller.setActiveProvider(controller.naroFullLengthProvider);
  assert(facade.getAudioElement() === naroProviderAudio, 'playbackService facade updates active audio element');
  console.log('  ✅ PASS: No duplicate or conflicting audio ownership; audio element access is strictly synchronized');

  // =========================================================================
  // CHECK 8: Queue and Previous / Next Navigation Orchestration
  // =========================================================================
  console.log('\n[Check 8] Verifying Track Queue & Next/Previous Orchestration...');
  const track1: Song = { ...JOSH_WOODWARD_SHOT_DOWN, id: 'track-1', title: 'Track 1' };
  const track2: Song = { ...JOSH_WOODWARD_SHOT_DOWN, id: 'track-2', title: 'Track 2' };
  const track3: Song = { ...JOSH_WOODWARD_SHOT_DOWN, id: 'track-3', title: 'Track 3' };

  controller.setQueue([track1, track2, track3]);
  controller.setCurrentTrack(track1);

  assert(controller.getCurrentTrack()?.id === 'track-1', 'Current track is track 1');

  await controller.nextTrack();
  assert(controller.getCurrentTrack()?.id === 'track-2', 'nextTrack() navigated to track 2');

  await controller.nextTrack();
  assert(controller.getCurrentTrack()?.id === 'track-3', 'nextTrack() navigated to track 3');

  await controller.nextTrack();
  assert(controller.getCurrentTrack()?.id === 'track-1', 'nextTrack() wrapped back to track 1');

  await controller.prevTrack();
  assert(controller.getCurrentTrack()?.id === 'track-3', 'prevTrack() wrapped back to track 3');

  await controller.prevTrack();
  assert(controller.getCurrentTrack()?.id === 'track-2', 'prevTrack() navigated to track 2');
  console.log('  ✅ PASS: Track queue and next/previous track navigation correctly orchestrated');

  // =========================================================================
  // CHECK 9: Authoritative Moment / Section Looping
  // =========================================================================
  console.log('\n[Check 9] Verifying Authoritative Moment / Section Looping...');
  const loopSpyProvider = createMockProvider('loop-mock', 'Loop Mock');
  controller.setActiveProvider(loopSpyProvider.provider);

  controller.setLoopSection({
    type: 'chorus',
    label: 'Chorus',
    start: 30,
    end: 60
  }, true);

  assert(controller.isLoopingActive() === true, 'Looping is active');
  assert(controller.getLoopSection()?.start === 30, 'Loop start is 30s');
  assert(controller.getLoopSection()?.end === 60, 'Loop end is 60s');

  // Trigger clock event before loop end -> no seek
  (controller as unknown as { handleClockEvent: (e: PlaybackClockEvent) => void }).handleClockEvent({
    currentTime: 45.0,
    duration: 255,
    bufferedTime: 50,
    isPlaying: true,
    state: 'playing',
    playbackType: 'full',
    playbackSourceType: 'open-license',
    providerId: 'loop-mock'
  });
  assert(!loopSpyProvider.calls.seek.includes(30), 'Clock before loop end did not trigger seek');

  // Trigger clock event reaching/exceeding loop end -> automatic seek to loop start (30s)
  (controller as unknown as { handleClockEvent: (e: PlaybackClockEvent) => void }).handleClockEvent({
    currentTime: 60.5,
    duration: 255,
    bufferedTime: 70,
    isPlaying: true,
    state: 'playing',
    playbackType: 'full',
    playbackSourceType: 'open-license',
    providerId: 'loop-mock'
  });
  assert(loopSpyProvider.calls.seek.includes(30), 'Clock reaching loop end automatically seeked to loop start (30s)');

  // Disable looping -> exceed end again -> no seek
  controller.setIsLooping(false);
  const seekCountBefore = loopSpyProvider.calls.seek.length;
  (controller as unknown as { handleClockEvent: (e: PlaybackClockEvent) => void }).handleClockEvent({
    currentTime: 62.0,
    duration: 255,
    bufferedTime: 70,
    isPlaying: true,
    state: 'playing',
    playbackType: 'full',
    playbackSourceType: 'open-license',
    providerId: 'loop-mock'
  });
  assert(loopSpyProvider.calls.seek.length === seekCountBefore, 'Disabled looping does not seek on passing loop end');
  console.log('  ✅ PASS: Authoritative moment / section looping correctly handled by PlaybackController');

  // =========================================================================
  // CHECK 10: Backward Compatibility Facade (playbackService)
  // =========================================================================
  console.log('\n[Check 10] Verifying PlaybackService Facade Alignment with PlaybackController...');
  assert(typeof playbackService.play === 'function', 'playbackService has play()');
  assert(typeof playbackService.pause === 'function', 'playbackService has pause()');
  assert(typeof playbackService.seek === 'function', 'playbackService has seek()');
  assert(typeof playbackService.loadAndPlay === 'function', 'playbackService has loadAndPlay()');
  assert(typeof playbackService.selectProviderForSong === 'function', 'playbackService has selectProviderForSong()');
  assert(typeof playbackService.canPlayFullLength === 'function', 'playbackService has canPlayFullLength()');
  assert(typeof playbackService.isKaraokeMode === 'function', 'playbackService has isKaraokeMode()');
  assert(typeof playbackService.subscribeClock === 'function', 'playbackService has subscribeClock()');
  assert(typeof playbackService.getAudioElement === 'function', 'playbackService has getAudioElement()');

  // Verify volume delegation through facade instance
  const facade10 = new PlaybackService(controller);
  facade10.setVolume(0.65);
  assert(controller.getVolume() === 0.65, 'facade.setVolume delegates to controller');
  assert(facade10.getVolume() === 0.65, 'facade.getVolume returns controller volume');

  // Verify singleton playbackService delegates to singleton playbackController
  playbackService.setVolume(0.72);
  assert(playbackController.getVolume() === 0.72, 'playbackService delegates to singleton playbackController');
  assert(playbackService.getVolume() === 0.72, 'playbackService returns updated volume');
  console.log('  ✅ PASS: playbackService acts as an exact, non-breaking facade over PlaybackController');

  console.log('\n======================================================================');
  console.log('ALL 10 PLAYBACK CONTROLLER SPECIFICATION VERIFICATIONS PASSED!');
  console.log('======================================================================\n');
}

runPlaybackControllerVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
