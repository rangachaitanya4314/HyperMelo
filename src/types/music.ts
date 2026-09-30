export type Language = 'en' | 'hi' | 'te' | 'ta' | 'ml';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'EN', nativeLabel: 'English' },
  { code: 'hi', label: 'HI', nativeLabel: 'हिन्दी' },
  { code: 'te', label: 'TE', nativeLabel: 'తెలుగు' },
  { code: 'ta', label: 'TA', nativeLabel: 'தமிழ்' },
  { code: 'ml', label: 'ML', nativeLabel: 'മലയാളം' }
];

export type SectionType = 'verse' | 'chorus' | 'bridge' | 'custom';

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

export interface SongSection {
  type: SectionType;
  label: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export type LyricsCapability = 'SYNCED_LYRICS' | 'PLAIN_LYRICS' | 'LYRICS_UNAVAILABLE';

export interface LyricWord {
  text: string;
  start: number; // relative to section or absolute song time
  end: number;
}

export interface TimedLyricLine {
  id: string;
  startTime: number;
  endTime?: number;
  text: string;
  translations?: Record<string, string>;
  time?: number;
  duration?: number;
  words?: LyricWord[];
}

export interface LyricLine {
  time: number;
  duration: number;
  text: string;
  words?: LyricWord[];
  id?: string;
  startTime?: number;
  endTime?: number;
  translations?: Record<string, string>;
}

export interface LanguageLyrics {
  chorusSnippet: string;
  lines: LyricLine[];
}

export interface SongLyrics {
  en?: LanguageLyrics;
  hi?: LanguageLyrics;
  te?: LanguageLyrics;
  ta?: LanguageLyrics;
  ml?: LanguageLyrics;
  [key: string]: LanguageLyrics | undefined;
}

export interface ArtworkStyle {
  palette: [string, string, string, string]; // 4 accent gradient colors
  pattern: 'orbital' | 'geometric' | 'echo' | 'solaris';
  accentWarm: string;
  accentCool: string;
  accentCream?: string;
  imageUrl?: string; // Real album artwork from online provider
}

export type PlaybackCapability = 'PREVIEW' | 'FULL_LENGTH' | 'UNAVAILABLE';
export type KaraokeCapability = 'KARAOKE_READY' | 'SING_ALONG' | 'UNAVAILABLE';

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

export type ProviderType = 'naro' | 'apple-music' | 'itunes' | 'youtube' | 'local';

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

export interface Song {
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

export interface RecordedTake {
  id: string;
  songId: string;
  songTitle: string;
  artist: string;
  section: SectionType;
  sectionLabel: string;
  language: Language;
  recordedAt: number; // epoch timestamp
  duration: number;   // duration in seconds
  audioBlob?: Blob;
  audioBlobUrl?: string;
  artwork?: ArtworkStyle;
  isRealRecording: boolean;
  analysisStatus: 'unavailable' | 'pending' | 'completed';
  score?: {
    overall: number;
    resonance: number;
    timing: number;
    vibe: string;
  };
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

export interface CatalogSection {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  isDynamicLive?: boolean;
}
