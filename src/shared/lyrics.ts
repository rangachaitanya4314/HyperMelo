// Canonical Lyric and Multilingual Synchronization Contracts for NARO
// Authoritative synchronized lyric representation: TimedLyricLine
// Single authoritative timeline invariant across all translations

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

export interface LyricWord {
  text: string;
  start: number; // relative to section or absolute song time
  end: number;
}

/**
 * Authoritative canonical synchronized lyric line.
 * Guaranteed single timeline across all languages with segment ID and timestamp invariance.
 */
export interface TimedLyricLine {
  id?: string;
  startTime?: number; // canonical sync start time in seconds
  endTime?: number;   // canonical sync end time in seconds
  text: string;
  translations?: Record<string, string>;
  time?: number;      // legacy start time in seconds (backward compatibility)
  duration?: number;  // legacy duration in seconds (backward compatibility)
  words?: LyricWord[];
}

/**
 * Consolidated canonical alias: TimedLyricLine is the sole authoritative representation.
 * Eliminates duplicate competing models between LyricLine and TimedLyricLine.
 */
export type LyricLine = TimedLyricLine;

export interface LanguageLyrics {
  chorusSnippet: string;
  lines: TimedLyricLine[];
}

export interface SongLyrics {
  en?: LanguageLyrics;
  hi?: LanguageLyrics;
  te?: LanguageLyrics;
  ta?: LanguageLyrics;
  ml?: LanguageLyrics;
  [key: string]: LanguageLyrics | undefined;
}

export type TrackLyrics = SongLyrics;

export interface LyricsFetchParams {
  trackName: string;
  artistName: string;
  duration?: number;
  albumName?: string;
  isrc?: string;
}

/**
 * Backend-facing Lyrics Ingestion & Retrieval Contract.
 * Defines server-side lyrics querying, caching, and multi-language alignment.
 */
export interface ILyricsService {
  fetchLyrics(
    trackName: string,
    artistName: string,
    duration?: number,
    albumName?: string,
    isrc?: string
  ): Promise<SongLyrics | null>;
}

/**
 * Detect language script (Telugu, Tamil, Malayalam, Devanagari/Hindi, or English/Latin)
 */
export function detectLanguage(text: string): Language {
  if (!text) return 'en';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}
