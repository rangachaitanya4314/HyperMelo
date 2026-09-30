// Canonical Catalog Provider Contracts for NARO

import type {
  ProviderType,
  PlaybackAvailability,
  PlaybackSourceType,
  SongCapabilities
} from './capabilities';
import type { SongLyrics } from './lyrics';
import type { Song, KaraokeSource, TrackAttribution } from './track';

export interface SearchOptions {
  limit?: number;
  genre?: string;
  language?: string;
}

export interface ProviderResult {
  provider: ProviderType;
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  duration: number;
  streamUrl?: string;
  youtubeId?: string;
  isrc?: string;
  explicit?: boolean;
  language?: string;
  genre?: string;
  releaseYear?: number;
  playbackAvailability: boolean;
  playbackType?: PlaybackAvailability;
  playbackSourceType?: PlaybackSourceType;
  previewAvailable?: boolean;
  fullLengthAvailable?: boolean;
  karaokeAvailability: boolean;
  karaokeSource?: KaraokeSource;
  lyricsAvailability: boolean;
  lyricsSyncAvailability?: boolean;
  attribution?: TrackAttribution;
}

export interface MusicProvider {
  readonly id: string;
  readonly name: string;
  readonly isPrimaryCatalog?: boolean;

  search(query: string, options?: SearchOptions): Promise<ProviderResult[]>;
  getTrack(trackId: string): Promise<Song | null>;
  getRecommendations(seedTrackId?: string): Promise<Song[]>;
  getTrending(genreOrLanguage?: string): Promise<Song[]>;
  getLyrics(trackId: string, isrc?: string): Promise<SongLyrics | null>;
  getPlaybackAvailability(trackId: string): Promise<SongCapabilities>;
}
