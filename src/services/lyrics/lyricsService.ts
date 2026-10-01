// Lyrics Service for NARO
// Authoritative synchronized lyrics engine with deterministic timing & translation
// Strict adherence to actual timestamps without faked word-level timing or formula timestamps

import type { TimedLyricLine, LyricsCapability, SongLyrics, Language, Song } from '../../shared';
import { lyricsIngestionService } from '../../backend/services/LyricsIngestionService';

/**
 * Deterministic calculation of active lyric index from authoritative currentTime.
 * 
 * Rules:
 * 1. currentTime before first line -> -1 (no active line)
 * 2. currentTime within line [startTime, endTime) -> that line index
 * 3. currentTime between lines [endTime, nextStartTime) -> deterministic nearest valid previous line or gap
 * 4. currentTime after final line -> remains active only if within permitted interval, then -1
 * 5. Uses binary search for high performance on large datasets.
 */
export function getActiveLyricIndex(
  lines: TimedLyricLine[] | undefined | null,
  currentTime: number,
  options?: number | { offsetMs?: number; betweenLinesBehavior?: 'midpoint' | 'nearest_previous' | 'gap' }
): number {
  if (!lines || lines.length === 0) return -1;

  const offsetMs = typeof options === 'number' ? options : (options?.offsetMs || 0);
  const betweenLinesBehavior = typeof options === 'object' && options?.betweenLinesBehavior ? options.betweenLinesBehavior : 'midpoint';

  const effectiveTime = currentTime + (offsetMs / 1000);
  const n = lines.length;

  const firstStart = lines[0].startTime !== undefined && lines[0].startTime >= 0
    ? lines[0].startTime
    : (lines[0].time !== undefined ? lines[0].time : 0);

  // 1. currentTime before first line: no active line
  if (effectiveTime < firstStart) {
    return -1;
  }

  // 2. Binary search to find the rightmost line where lineStart <= effectiveTime
  let low = 0;
  let high = n - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lines[mid].startTime !== undefined && lines[mid].startTime >= 0
      ? lines[mid].startTime
      : (lines[mid].time !== undefined ? lines[mid].time : 0);

    if (start <= effectiveTime) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (candidate === -1) {
    return -1;
  }

  const line = lines[candidate];
  const lineStart = line.startTime !== undefined && line.startTime >= 0
    ? line.startTime
    : (line.time !== undefined ? line.time : 0);

  const nextLineStart = candidate + 1 < n
    ? (lines[candidate + 1].startTime !== undefined && lines[candidate + 1].startTime! >= 0
        ? lines[candidate + 1].startTime!
        : (lines[candidate + 1].time !== undefined ? lines[candidate + 1].time! : Infinity))
    : Infinity;

  const explicitEnd = line.endTime !== undefined
    ? line.endTime
    : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : undefined);

  // 3. Final line: remains active only if its interval permits it
  if (candidate === n - 1) {
    const permittedEnd = explicitEnd !== undefined ? explicitEnd : lineStart + (line.duration || 4.0);
    if (effectiveTime <= permittedEnd) {
      return candidate;
    }
    return -1;
  }

  // 4. Within line
  if (explicitEnd === undefined) {
    return candidate;
  }

  if (effectiveTime < explicitEnd) {
    return candidate;
  }

  // 5. Between lines (effectiveTime >= explicitEnd && effectiveTime < nextLineStart)
  if (betweenLinesBehavior === 'nearest_previous') {
    return candidate;
  }
  if (betweenLinesBehavior === 'gap') {
    return -1;
  }

  // Default 'midpoint': deterministic nearest previous line up to halfway, then gap before next line starts
  const midpoint = (explicitEnd + nextLineStart) / 2;
  if (effectiveTime <= midpoint) {
    return candidate;
  }
  return -1;
}

/**
 * Extract the canonical timed lyric segments from a song.
 * Guaranteed single authoritative timeline across all languages.
 */
export function getCanonicalLyricLines(song: Song | null | undefined): TimedLyricLine[] {
  if (!song || !song.lyrics) return [];

  // Check language buckets in order
  const buckets = [
    song.lyrics.en?.lines,
    song.lyrics.hi?.lines,
    song.lyrics.te?.lines,
    song.lyrics.ta?.lines,
    song.lyrics.ml?.lines
  ];

  for (const b of buckets) {
    if (b && b.length > 0) {
      return b as TimedLyricLine[];
    }
  }

  // Fallback to any custom bucket
  for (const key of Object.keys(song.lyrics)) {
    const lines = song.lyrics[key]?.lines;
    if (lines && lines.length > 0) {
      return lines as TimedLyricLine[];
    }
  }

  return [];
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

/**
 * Retrieve honest line translation for English, Hindi, Telugu, Tamil, or Malayalam.
 * Strictly returns "Translation unavailable" when missing — never substitutes another language!
 */
export function getLineTranslation(
  line: TimedLyricLine | undefined | null,
  targetLanguage: Language,
  fallbackOriginalLang?: Language
): { text: string; isAvailable: boolean } {
  if (!line) return { text: 'Translation unavailable', isAvailable: false };

  // 1. Line has dedicated translations dictionary with targetLanguage
  if (
    line.translations &&
    typeof line.translations[targetLanguage] === 'string' &&
    line.translations[targetLanguage].trim().length > 0
  ) {
    return { text: line.translations[targetLanguage].trim(), isAvailable: true };
  }

  // 2. Check if the line's original text itself matches targetLanguage
  const detected = detectLanguage(line.text);
  const effectiveOriginal = fallbackOriginalLang || detected;
  if (targetLanguage === effectiveOriginal) {
    return { text: line.text, isAvailable: true };
  }

  // 3. Translation does not exist
  return { text: 'Translation unavailable', isAvailable: false };
}

class LyricsService {
  /**
   * Extract canonical lines for a song (single timeline)
   */
  public getCanonicalLyricLines(song: Song | null | undefined): TimedLyricLine[] {
    return getCanonicalLyricLines(song);
  }

  /**
   * Evaluates the truthful lyrics capability of a song
   */
  public getLyricsCapability(song: Song | null | undefined): LyricsCapability {
    if (!song || !song.lyrics) return 'LYRICS_UNAVAILABLE';
    const lines = getCanonicalLyricLines(song);
    if (!lines || lines.length === 0) return 'LYRICS_UNAVAILABLE';

    // Must have genuine non-negative timestamps
    const hasRealTimestamps = lines.some(
      (l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1)
    );

    if (hasRealTimestamps && song.lyricsSyncAvailable !== false) {
      return 'SYNCED_LYRICS';
    }
    return 'PLAIN_LYRICS';
  }

  /**
   * Deterministic active lyric calculation wrapper
   */
  public getActiveLyricIndex(
    lines: TimedLyricLine[] | undefined | null,
    currentTime: number,
    offsetMs = 0
  ): number {
    return getActiveLyricIndex(lines, currentTime, offsetMs);
  }

  /**
   * Backward-compatible active line lookup
   */
  public getActiveLine(
    lines: TimedLyricLine[] | undefined | null,
    currentTime: number,
    offsetMs = 0
  ): { index: number; line: TimedLyricLine | null } {
    const index = this.getActiveLyricIndex(lines, currentTime, offsetMs);
    const line = (index >= 0 && lines && lines[index]) ? lines[index] : null;
    return { index, line };
  }

  /**
   * Retrieve honest line translation for English, Hindi, Telugu, Tamil, or Malayalam
   */
  public getLineTranslation(
    line: TimedLyricLine | undefined | null,
    targetLanguage: Language,
    fallbackOriginalLang?: Language
  ): { text: string; isAvailable: boolean } {
    return getLineTranslation(line, targetLanguage, fallbackOriginalLang);
  }

  /**
   * Detect language script (Telugu, Tamil, Malayalam, Devanagari/Hindi, or English)
   */
  public detectLanguage(text: string): Language {
    return detectLanguage(text);
  }

  /**
   * Parse standard LRC format [mm:ss.xx]
   * Delegated to backend lyrics ingestion service.
   */
  public parseLrc(lrcText: string, totalDuration: number): TimedLyricLine[] {
    return lyricsIngestionService.parseLrc(lrcText, totalDuration);
  }

  /**
   * Parse plain lyrics into lines when synced LRC is unavailable.
   * Delegated to backend lyrics ingestion service.
   */
  public parsePlainLyrics(plainText: string): TimedLyricLine[] {
    return lyricsIngestionService.parsePlainLyrics(plainText);
  }

  /**
   * Fetch online lyrics using exact track matching
   * Delegated to backend lyrics ingestion service.
   */
  public async fetchLyrics(
    trackName: string,
    artistName: string,
    duration?: number,
    albumName?: string,
    isrc?: string
  ): Promise<SongLyrics | null> {
    return lyricsIngestionService.fetchLyrics(trackName, artistName, duration, albumName, isrc);
  }
}

export const lyricsService = new LyricsService();
