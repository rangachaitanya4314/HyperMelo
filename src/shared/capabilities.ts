// Canonical Capability and Availability Contracts for NARO
// Unified capability model:
// - Playback: PREVIEW | FULL_LENGTH | UNAVAILABLE
// - Karaoke:  KARAOKE_READY | SING_ALONG | UNAVAILABLE
// - Lyrics:   SYNCED_LYRICS | PLAIN_LYRICS | LYRICS_UNAVAILABLE

import type { KaraokeSource } from './track';

export type PlaybackCapability = 'PREVIEW' | 'FULL_LENGTH' | 'UNAVAILABLE';
export type KaraokeCapability = 'KARAOKE_READY' | 'SING_ALONG' | 'UNAVAILABLE';
export type LyricsCapability = 'SYNCED_LYRICS' | 'PLAIN_LYRICS' | 'LYRICS_UNAVAILABLE';

export type PlaybackAvailability =
  | 'full'
  | 'preview'
  | 'unavailable'
  | 'requires_auth';

export type PlaybackSourceType =
  | 'open-license'
  | 'naro-licensed'
  | 'official-provider'
  | 'preview'
  | 'dev-fixture'
  | 'unavailable';

export type KaraokeSourceType =
  | 'dedicated-instrumental'
  | 'instrumental'
  | 'licensed_stems'
  | 'provider_karaoke'
  | 'dev_fixture';

export type ProviderType = 'naro' | 'apple-music' | 'itunes' | 'youtube' | 'local';

export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error'
  | 'offline';

export interface TrackCapabilities {
  playback: PlaybackCapability;
  karaoke: KaraokeCapability;
  lyrics?: LyricsCapability;
  isDevFixture?: boolean;
  reasons?: {
    playback?: string;
    karaoke?: string;
    lyrics?: string;
  };
}

export interface ProviderCapabilities {
  supportsFullLength: boolean;
  supportsSeek: boolean;
  supportsWebAudioRouting: boolean;
  supportsKaraokeProcessing: boolean;
  supportsLyrics: boolean;
  requiresAuthorization: boolean;
}

export interface SongCapabilities {
  playback: boolean;
  lyrics: boolean;
  karaoke: boolean;
  recording: boolean;
  playbackAvailable?: boolean;
  playbackType?: PlaybackAvailability;
  playbackSourceType?: PlaybackSourceType;
  lyricsAvailable?: boolean;
  lyricsSyncAvailable?: boolean;
  lyricsCapability?: LyricsCapability;
  karaokeAvailable?: boolean;
  karaokeSource?: KaraokeSource;
}
