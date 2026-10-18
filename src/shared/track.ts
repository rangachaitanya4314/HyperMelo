// Canonical Track and Catalog Contracts for NARO

import type {
  PlaybackAvailability,
  PlaybackSourceType,
  KaraokeSourceType,
  ProviderType,
  LyricsCapability,
  SongCapabilities
} from './capabilities';
import type { SongLyrics, Language } from './lyrics';

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
  language?: Language;
  originalLanguage?: Language;
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

/**
 * Resolves the genuine canonical track duration based on authoritative duration priority:
 * 1. Use genuine resolved full-track duration when fullLengthAvailable is true.
 * 2. Otherwise use the legitimate catalog duration if it is not merely the 30-second preview duration.
 * 3. Use 30 seconds only for genuinely preview-only tracks.
 */
export function getCanonicalTrackDuration(track?: {
  duration?: number;
  fullTrackDuration?: number;
  fullLengthAvailable?: boolean;
} | null): number {
  if (!track) return 30;

  // 1. Use genuine resolved full-track duration when fullLengthAvailable is true
  if (track.fullLengthAvailable) {
    if (track.fullTrackDuration && track.fullTrackDuration > 0) {
      return track.fullTrackDuration;
    }
    if (track.duration && track.duration > 0 && track.duration !== 30) {
      return track.duration;
    }
  }

  // 2. Otherwise use the legitimate catalog duration if it is not merely the 30-second preview duration
  if (track.fullTrackDuration && track.fullTrackDuration > 0 && track.fullTrackDuration !== 30) {
    return track.fullTrackDuration;
  }
  if (track.duration && track.duration > 0 && track.duration !== 30) {
    return track.duration;
  }

  // 3. Use 30 seconds only for genuinely preview-only tracks
  return track.duration || track.fullTrackDuration || 30;
}

export interface CatalogSection {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  isDynamicLive?: boolean;
}

/**
 * Safely extracts user-facing public license string, filtering out internal or commercial preview labels.
 * Preserves public open licenses like CC BY, while removing raw "Commercial Preview / Apple Music" badges.
 */
export function getConsumerLicenseLabel(attribution?: TrackAttribution): string | null {
  if (!attribution?.license) return null;
  const lic = attribution.license.trim();
  if (/commercial preview|apple music|internal/i.test(lic)) {
    return null;
  }
  return lic;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates whether a song artist string matches a target artist name.
 * Uses discrete tokenization on multi-artist delimiters and word boundaries
 * to prevent false substring matches (e.g. 'Malaysia Vasudevan' must never match 'Sia').
 */
export function isArtistMatch(
  songArtist: string | undefined | null,
  targetArtist: string | undefined | null
): boolean {
  if (!songArtist || !targetArtist) return false;
  const sNorm = songArtist.trim().toLowerCase();
  const tNorm = targetArtist.trim().toLowerCase();
  if (sNorm === tNorm) return true;

  // Delimiters for multi-artist credits: commas, slashes, ampersands, semicolons, pluses, "feat.", "ft.", "featuring", "with", "and", "vs.", "x"
  const splitDelimiters = /[,/;&+]|\b(?:feat\.?|ft\.?|featuring|with|and|vs\.?|x)\b/i;

  const targetTokens = tNorm
    .split(splitDelimiters)
    .map((s) => s.replace(/[()]/g, '').trim())
    .filter((s) => s.length > 0);

  const songTokens = sNorm
    .split(splitDelimiters)
    .map((s) => s.replace(/[()]/g, '').trim())
    .filter((s) => s.length > 0);

  for (const t of targetTokens) {
    if (t.length < 2) continue;
    for (const s of songTokens) {
      if (s === t) return true;
      // Discrete word boundary check: ensures "sia" matches word "sia" in "sia furler" but never "malaysia"
      const wordRegex = new RegExp(`(^|\\b)${escapeRegex(t)}(\\b|$)`, 'i');
      if (wordRegex.test(s)) {
        return true;
      }
      // Symmetric check if target token contains song token with word boundary
      if (s.length >= 2) {
        const songWordRegex = new RegExp(`(^|\\b)${escapeRegex(s)}(\\b|$)`, 'i');
        if (songWordRegex.test(t)) {
          return true;
        }
      }
    }
  }

  return false;
}

