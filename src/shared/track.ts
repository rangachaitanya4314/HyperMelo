// Canonical Track and Catalog Contracts for NARO

import type {
  PlaybackAvailability,
  PlaybackSourceType,
  KaraokeSourceType,
  ProviderType,
  LyricsCapability,
  SongCapabilities
} from './capabilities';
import type { SongLyrics } from './lyrics';

export type SectionType = 'verse' | 'chorus' | 'bridge' | 'custom';

export interface SongSection {
  type: SectionType;
  label: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export type TrackSection = SongSection;

export interface ArtworkStyle {
  palette: [string, string, string, string]; // 4 accent gradient colors
  pattern: 'orbital' | 'geometric' | 'echo' | 'solaris';
  accentWarm: string;
  accentCool: string;
  accentCream?: string;
  imageUrl?: string; // Real album artwork from online provider
}

export interface TrackAttribution {
  title: string;
  artist: string;
  album?: string;
  license: string;
  licenseUrl?: string;
  source: string;
  sourceName?: string;
  sourceUrl?: string;
  text?: string;
  note?: string;
}

export interface KaraokeSource {
  type: KaraokeSourceType;
  streamUrl?: string;
  youtubeId?: string;
  provider: ProviderType;
  providerTrackId?: string;
  duration?: number;
  availability: 'available' | 'unavailable';
}

export interface PlaybackSource {
  provider: ProviderType;
  providerTrackId?: string;
  streamUrl?: string;
  youtubeId?: string;
  format?: string;
  isrc?: string;
  isStreamPreview?: boolean;
  playbackSourceType?: PlaybackSourceType;
  attribution?: TrackAttribution;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // playable duration in seconds
  fullTrackDuration?: number; // original complete track duration if this is a preview
  isStreamPreview?: boolean;
  playbackAvailable?: boolean;
  playbackType?: PlaybackAvailability;
  playbackAvailability?: PlaybackAvailability;
  playbackSourceType?: PlaybackSourceType;
  playbackProvider?: ProviderType;
  previewAvailable?: boolean;
  fullLengthAvailable?: boolean;
  karaokeAvailability?: 'available' | 'unavailable' | 'vocal_suppression';
  lyricsAvailable?: boolean;
  lyricsSyncAvailable?: boolean;
  lyricsCapability?: LyricsCapability;
  karaokeAvailable?: boolean;
  karaokeSource?: KaraokeSource;
  lyricsOffsetMs?: number;
  genre: string;
  bpm: number;
  musicalKey: string;
  releaseYear?: number;
  karaokeReady: boolean; // Convenience flag, true if karaoke is available
  capabilities?: SongCapabilities;
  artwork: ArtworkStyle;
  sections: SongSection[];
  lyrics: SongLyrics;
  playbackSource?: PlaybackSource;
  isFallbackDemo?: boolean;
  attribution?: TrackAttribution;
  audioSignature?: {
    chordProgression: string[];
    tempo: number;
    baseFreq: number;
  };
}

export type Song = Track;

export interface CatalogSection {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  isDynamicLive?: boolean;
}
