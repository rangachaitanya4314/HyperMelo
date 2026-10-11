// Comprehensive Verification Script: Automatic Vocal Removal Workflow in NARO
// Conforms to user specification & NARO Core Architecture

import assert from 'node:assert';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import { vocalRemovalService } from '../src/services/audio/vocalSeparation/vocalRemovalService';
import { playbackController } from '../src/services/audio/PlaybackController';
import { karaokePlaybackService } from '../src/services/audio/karaokePlaybackService';
import { karaokeMixer } from '../src/services/audio/karaokeMixer';
import { capabilityService } from '../src/services/capability/capabilityService';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import type { Song } from '../src/shared';

async function runTests() {
  console.log('================================================================');
  console.log('NARO AUTOMATIC VOCAL REMOVAL & SUPPRESSION VERIFICATION');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Song with Verified Matching Instrumental Backing Track
  // --------------------------------------------------------------------------
  console.log('[Test 1] Testing song with verified matching instrumental (Josh Woodward - Shot Down)...');
  const songWithInstrumental = JOSH_WOODWARD_SHOT_DOWN;

  // Verify song metadata has matching instrumental
  assert(songWithInstrumental.karaokeAvailable, 'Song should have karaokeAvailable: true');
  assert(songWithInstrumental.karaokeSource?.streamUrl?.includes('novox'), 'Matching instrumental must be NoVox');
  assert(songWithInstrumental.playbackSource?.streamUrl?.includes('vocal'), 'Normal track must be vocal recording');

  // Resolve vocal removal method
  const res1 = vocalRemovalService.resolveMethod(songWithInstrumental);
  console.log(`  Method Resolved: ${res1.methodName} (${res1.type})`);
  console.log(`  Badge: ${res1.badgeLabel}`);
  console.log(`  Vocal Absent: ${res1.isVocalAbsent}`);
  console.log(`  Backing URL: ${res1.backingStreamUrl}`);

  assert.strictEqual(res1.type, 'verified_instrumental', 'Must resolve to verified_instrumental');
  assert.strictEqual(res1.isVocalAbsent, true, 'Lead vocal must be absent from backing track');
  assert.strictEqual(res1.isApproximate, false, 'Verified instrumental is NOT approximate');
  assert(res1.backingStreamUrl?.includes('novox'), 'Backing URL must point to NoVox instrumental');

  // Test loading track into PlaybackController and entering Karaoke Mode
  await playbackController.load(songWithInstrumental, 15.0);
  assert.strictEqual(playbackController.getCurrentTrack()?.id, songWithInstrumental.id, 'Loaded song');

  // Normal mode: audio should be normal vocal recording
  const audioEl = playbackController.getAudioElement();
  if (audioEl) {
    assert(audioEl.src.includes('vocal') || audioEl.src.endsWith('josh-woodward-shot-down-vocal.mp3'), 'Normal audio is vocal recording');
  }

  // Activate Karaoke Mode at position 20.5s
  console.log('  Activating Karaoke Mode at 20.5s...');
  playbackController.setKaraokeMode(true, 20.5);

  if (audioEl) {
    assert(audioEl.src.includes('novox') || audioEl.src.endsWith('josh-woodward-shot-down-novox.mp3'), 'Audio src automatically swapped to NoVox instrumental');
  }

  // Deactivate Karaoke Mode and verify return to normal playback
  console.log('  Exiting Karaoke Mode and returning to normal playback...');
  playbackController.setKaraokeMode(false, 25.0);
  if (audioEl) {
    assert(audioEl.src.includes('vocal') || audioEl.src.endsWith('josh-woodward-shot-down-vocal.mp3'), 'Audio src restored to normal vocal recording');
  }

  console.log('✓ Test 1 Passed: Matching instrumental played automatically, vocals absent, normal playback restored.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Song without Instrumental (Ordinary Stereo Audio Fallback)
  // --------------------------------------------------------------------------
  console.log('[Test 2] Testing song without dedicated instrumental (Center-Channel Reduction Fallback)...');
  const songWithoutInstrumental: Song = {
    id: 'test-stereo-song',
    title: 'Stereo Track',
    artist: 'Test Artist',
    duration: 180,
    fullTrackDuration: 180,
    playbackAvailable: true,
    playbackType: 'preview',
    playbackSourceType: 'preview',
    karaokeAvailable: false,
    karaokeReady: false,
    karaokeSource: {
      type: 'instrumental',
      provider: 'naro',
      availability: 'unavailable'
    },
    playbackSource: {
      provider: 'naro',
      streamUrl: 'https://example.com/audio.mp3'
    },
    capabilities: {
      playback: true,
      playbackAvailable: true,
      playbackType: 'preview',
      playbackSourceType: 'preview',
      lyrics: false,
      lyricsAvailable: false,
      lyricsSyncAvailable: false,
      karaoke: true,
      karaokeAvailable: false,
      karaokeSource: {
        type: 'instrumental',
        provider: 'naro',
        availability: 'unavailable'
      },
      recording: true
    },
    artwork: {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8',
      accentCream: '#F4DFC9'
    },
    sections: []
  };

  const res2 = vocalRemovalService.resolveMethod(songWithoutInstrumental);
  console.log(`  Method Resolved: ${res2.methodName} (${res2.type})`);
  console.log(`  Badge: ${res2.badgeLabel}`);
  console.log(`  Is Approximate: ${res2.isApproximate}`);
  console.log(`  Is Vocal Absent: ${res2.isVocalAbsent}`);
  console.log(`  Description: ${res2.description}`);

  assert.strictEqual(res2.type, 'center_channel_reduction', 'Must resolve to center_channel_reduction');
  assert.strictEqual(res2.isApproximate, true, 'Fallback must be marked approximate');
  assert.strictEqual(res2.isVocalAbsent, false, 'Vocal is NOT completely absent (may leave vocal remnants)');
  assert(res2.description.includes('approximate') || res2.description.includes('Approximate'), 'Must truthfully describe limitations');

  // Verify karaokeMixer center-channel cancellation engages
  await playbackController.load(songWithoutInstrumental, 0);
  playbackController.setKaraokeMode(true, 10.0);
  assert.strictEqual(karaokeMixer.isKaraoke, true, 'karaokeMixer center-channel mode engaged');

  playbackController.setKaraokeMode(false);
  assert.strictEqual(karaokeMixer.isKaraoke, false, 'karaokeMixer center-channel mode disengaged');

  console.log('✓ Test 2 Passed: Center-channel reduction fallback correctly engaged and truthfully described as approximate.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Unsupported Protected Provider (YouTube iframe & Apple DRM)
  // --------------------------------------------------------------------------
  console.log('[Test 3] Testing protected providers (YouTube iframe & DRM Apple MusicKit)...');
  const youtubeSong: Song = {
    id: 'yt-test',
    title: 'YouTube Track',
    artist: 'YT Artist',
    duration: 210,
    fullTrackDuration: 210,
    playbackAvailable: true,
    playbackType: 'full',
    playbackSourceType: 'official-provider',
    playbackProvider: 'youtube',
    karaokeAvailable: false,
    karaokeReady: false,
    playbackSource: {
      provider: 'youtube',
      youtubeId: 'dQw4w9WgXcQ'
    },
    capabilities: {
      playback: true,
      playbackAvailable: true,
      playbackType: 'full',
      playbackSourceType: 'official-provider',
      lyrics: false,
      lyricsAvailable: false,
      lyricsSyncAvailable: false,
      karaoke: false,
      karaokeAvailable: false,
      recording: false
    },
    artwork: {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8',
      accentCream: '#F4DFC9'
    },
    sections: []
  };

  const res3 = vocalRemovalService.resolveMethod(youtubeSong);
  console.log(`  YouTube Method Resolved: ${res3.methodName} (${res3.type})`);
  console.log(`  Is Vocal Removal Unavailable: ${res3.isVocalRemovalUnavailable}`);
  console.log(`  Explanation: ${res3.explanation}`);

  assert.strictEqual(res3.type, 'unavailable_protected', 'Protected provider must resolve to unavailable_protected');
  assert.strictEqual(res3.isVocalRemovalUnavailable, true, 'Vocal removal must be marked unavailable');
  assert.strictEqual(res3.isVocalAbsent, false, 'Cannot claim vocal is absent');

  // Verify playbackController does NOT attempt Web Audio DSP on YouTube
  await playbackController.load(youtubeSong, 0);
  playbackController.setKaraokeMode(true, 0);
  assert.strictEqual(karaokeMixer.isKaraoke, false, 'Never engage Web Audio DSP on YouTube iframe');

  console.log('✓ Test 3 Passed: Protected stream restrictions respected, no fake vocal removal claimed.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Timing, Lyrics Synchronization & Seek Preservation
  // --------------------------------------------------------------------------
  console.log('[Test 4] Testing timing preservation, lyrics sync, and seek integrity...');
  const { SONGS } = await import('../src/data/songs');
  const testTrack = SONGS[0];
  const canonicalLines = lyricsService.getCanonicalLyricLines(testTrack);
  assert(canonicalLines.length > 0, 'Must have canonical lyrics lines');

  // Check lyrics timing at chorus (48s)
  const chorusLine = lyricsService.getActiveLine(canonicalLines, 48.5);
  console.log(`  Active lyric at 48.5s: "${chorusLine.line?.text}" (timestamp: ${chorusLine.line?.time || chorusLine.line?.startTime}s)`);
  assert(chorusLine.line !== null, 'Active line exists at 48.5s');

  // Verify seek & clock coordination
  await playbackController.load(testTrack, 48.0);
  playbackController.seek(56.0);
  assert.strictEqual(playbackController.getCurrentClock().currentTime, 56.0, 'Seek position preserved');

  console.log('✓ Test 4 Passed: Lyrics sync and playback position preserved across operations.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Automatic Karaoke Backing Loading & Clock Integration
  // --------------------------------------------------------------------------
  console.log('[Test 5] Testing karaokePlaybackService backing coordination...');
  await karaokePlaybackService.loadBackingSource(songWithInstrumental, 12.0);
  const kClock = karaokePlaybackService.getClock();
  console.log(`  Karaoke clock ready: ${kClock.isReady}, SourceType: ${kClock.sourceType}, Time: ${kClock.currentTime}s`);
  assert.strictEqual(kClock.isReady, true, 'Backing source is ready');
  assert.strictEqual(kClock.sourceType, 'dedicated-instrumental', 'Source type is dedicated-instrumental');
  karaokePlaybackService.stop();

  console.log('✓ Test 5 Passed: Dedicated backing track loaded cleanly.\n');

  console.log('================================================================');
  console.log('ALL VOCAL REMOVAL VERIFICATION TESTS PASSED SUCCESSFULLY (5/5)!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
