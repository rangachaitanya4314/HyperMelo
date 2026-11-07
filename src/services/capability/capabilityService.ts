// Playback and Karaoke Capability Evaluation Service for NARO
// Unified capability model:
// - Playback: PREVIEW | FULL_LENGTH | UNAVAILABLE
// - Karaoke:  KARAOKE_READY | SING_ALONG | UNAVAILABLE
//
// Strict rules:
// 1. A track must ONLY be marked FULL_LENGTH when the selected provider actually confirms
//    that full-length playback is available.
// 2. Never infer FULL_LENGTH merely from:
//    - track duration metadata
//    - a local WAV file
//    - a catalog result
//    - a UI badge
//    - a provider name
// 3. Keep Karaoke behavior explicit:
//    - authorized NARO instrumental/stems -> KARAOKE READY
//    - protected provider track where vocal suppression cannot be performed -> SING-ALONG
//    - no authorized backing source -> KARAOKE UNAVAILABLE

import type { Song, PlaybackCapability, KaraokeCapability, LyricsCapability, TrackCapabilities } from '../../shared';
import { playbackService } from '../audio/playbackService';
import { lyricsService } from '../lyrics/lyricsService';

class CapabilityService {
  /**
   * Determine the genuine lyrics capability of a song
   */
  public getLyricsCapability(song: Song | null): LyricsCapability {
    return lyricsService.getLyricsCapability(song);
  }
  /**
   * Determine the genuine playback capability of a song
   */
  public getPlaybackCapability(song: Song | null): PlaybackCapability {
    if (!song) return 'UNAVAILABLE';

    // 1. Ask the playback service whether the selected provider actually confirms full-length playback
    const canPlayFull = playbackService.canPlayFullLength(song);
    if (canPlayFull) {
      return 'FULL_LENGTH';
    }

    // 2. Dev fixtures are for internal development testing, not commercial full-length or official preview
    if (song.playbackSourceType === 'dev-fixture') {
      return 'UNAVAILABLE';
    }

    // 3. Official 30-second preview stream
    const hasPreviewStream =
      song.isStreamPreview ||
      song.previewAvailable ||
      song.playbackType === 'preview' ||
      song.playbackSourceType === 'preview' ||
      Boolean(
        song.playbackSource?.streamUrl &&
        (song.playbackSource.streamUrl.includes('itunes.apple.com') ||
         song.playbackSource.streamUrl.includes('mzstatic.com') ||
         song.playbackSource.streamUrl.includes('audio-ssl.itunes.apple.com'))
      );

    if (hasPreviewStream && song.playbackSource?.streamUrl) {
      return 'PREVIEW';
    }

    return 'UNAVAILABLE';
  }

  /**
   * Determine the genuine karaoke / sing-along capability of a song
   */
  public getKaraokeCapability(song: Song | null): KaraokeCapability {
    if (!song) return 'UNAVAILABLE';

    // 1. Authorized dedicated instrumental or licensed stems
    const hasDedicatedBacking =
      song.karaokeAvailable &&
      song.karaokeSource &&
      song.karaokeSource.availability === 'available' &&
      (song.karaokeSource.type === 'dedicated-instrumental' ||
       song.karaokeSource.type === 'instrumental' ||
       song.karaokeSource.type === 'licensed_stems' ||
       song.karaokeSource.type === 'dev_fixture');

    if (hasDedicatedBacking) {
      return 'KARAOKE_READY';
    }

    // 2. Check the provider that would handle playback of this track
    const provider = playbackService.selectProviderForSong(song);
    const playbackCap = this.getPlaybackCapability(song);

    const hasPlayableAudio = Boolean(
      song.playbackSource?.streamUrl ||
      (song as any).streamUrl ||
      (song as any).audioUrl ||
      (song as any).stream_url ||
      song.playbackAvailable !== false ||
      song.previewAvailable ||
      (song.playbackType !== 'unavailable' && song.playbackAvailability !== 'unavailable')
    );

    // If no playable audio at all (and no dedicated backing)
    if (!hasPlayableAudio && playbackCap === 'UNAVAILABLE' && song.playbackSourceType !== 'dev-fixture') {
      return 'UNAVAILABLE';
    }

    // If the provider does NOT support Web Audio routing (e.g. DRM-protected Apple MusicKit),
    // vocal suppression cannot be performed, but user can sing along with mic & synced lyrics!
    if (provider && (!provider.capabilities.supportsWebAudioRouting || !provider.capabilities.supportsKaraokeProcessing)) {
      return 'SING_ALONG';
    }

    // Unencrypted audio (official preview, licensed stream, dev fixture, center-channel reduction fallback) routed to Web Audio DSP
    if (hasPlayableAudio) {
      return 'KARAOKE_READY';
    }

    return 'UNAVAILABLE';
  }

  /**
   * Evaluate complete capabilities for a track
   */
  public evaluate(song: Song | null): TrackCapabilities {
    const playback = this.getPlaybackCapability(song);
    const karaoke = this.getKaraokeCapability(song);
    const lyrics = this.getLyricsCapability(song);
    const isDevFixture = song?.playbackSourceType === 'dev-fixture';

    return {
      playback,
      karaoke,
      lyrics,
      isDevFixture: !!isDevFixture,
      reasons: {
        playback: playback === 'FULL_LENGTH'
          ? 'Authorized full-length playback confirmed by provider'
          : playback === 'PREVIEW'
          ? 'Official 30-second preview stream'
          : isDevFixture
          ? 'Development fixture for internal testing'
          : 'Playback stream unavailable',
        karaoke: karaoke === 'KARAOKE_READY'
          ? 'Authorized backing audio or unencrypted Web Audio vocal suppression DSP'
          : karaoke === 'SING_ALONG'
          ? 'Protected stream: vocal suppression disabled, microphone sing-along & synced lyrics active'
          : 'Karaoke backing unavailable',
        lyrics: lyrics === 'SYNCED_LYRICS'
          ? 'Genuine verified synchronized lyrics timestamps'
          : lyrics === 'PLAIN_LYRICS'
          ? 'Plain lyrics without synchronized timing'
          : 'Lyrics unavailable for this track'
      }
    };
  }
}

export const capabilityService = new CapabilityService();
