// Shared Lyrics Resolution and Synchronization Pipeline Service for HyperMelo
// Enforces unified track identity, request deduplication, bounded concurrency,
// explicit resolution status, and zero-fabrication honest reporting across all surfaces.

import type { Song, TimedLyricLine } from '../../shared';
import { lyricsService } from './lyricsService';
import { lyricsIngestionService, hasGenuineSynchronizedLines } from '../../backend/services/LyricsIngestionService';
import { detectSongLanguage } from './lyricsService';

export type LyricsResolutionOutcome =
  | 'SYNCED_VERIFIED'
  | 'PLAIN_VERIFIED'
  | 'CONFIRMED_NO_MATCH'
  | 'TRANSIENT_FAILURE'
  | 'AMBIGUOUS_MATCH'
  | 'NOT_CHECKED'
  | 'PENDING'
  // Backward compatibility aliases
  | 'SYNCHRONIZED'
  | 'VERIFIED_UNTIMED'
  | 'CONFIRMED_NO_RESULT';

export function isSyncedOutcome(outcome?: LyricsResolutionOutcome): boolean {
  return outcome === 'SYNCED_VERIFIED' || outcome === 'SYNCHRONIZED';
}

export function isPlainOutcome(outcome?: LyricsResolutionOutcome): boolean {
  return outcome === 'PLAIN_VERIFIED' || outcome === 'VERIFIED_UNTIMED';
}

export function isConfirmedNoMatchOutcome(outcome?: LyricsResolutionOutcome): boolean {
  return outcome === 'CONFIRMED_NO_MATCH' || outcome === 'CONFIRMED_NO_RESULT';
}

export function isTransientFailureOutcome(outcome?: LyricsResolutionOutcome): boolean {
  return outcome === 'TRANSIENT_FAILURE';
}

export function isAmbiguousOutcome(outcome?: LyricsResolutionOutcome): boolean {
  return outcome === 'AMBIGUOUS_MATCH';
}

export interface TrackLyricsResolution {
  canonicalKey: string;
  trackId: string;
  title: string;
  artist: string;
  language?: string;
  outcome: LyricsResolutionOutcome;
  hasSyncedLyrics: boolean;
  hasPlainLyrics: boolean;
  lineCount: number;
  sampleSnippet?: string;
  resolvedAt: number;
  sourceProvenance?: string;
  errorReason?: string;
  error?: string;
}

export function getCanonicalTrackKey(song: Partial<Song> | { title: string; artist: string; id?: string }): string {
  const normTitle = (song.title || '')
    .trim()
    .toLowerCase()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
    .replace(/\s*-\s*(?:remastered|bonus track|live|radio edit|single version|acoustic|lo-fi|remix).*/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

  const normArtist = (song.artist || '')
    .trim()
    .toLowerCase()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
    .split(/[,/;&+]|\b(?:feat\.?|ft\.?|featuring|with|and|vs\.?|x)\b/i)[0]
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

  return `${normTitle}:::${normArtist}`;
}

class LyricsPipelineService {
  private cache = new Map<string, TrackLyricsResolution>();
  private inFlight = new Map<string, Promise<TrackLyricsResolution>>();
  private listeners = new Set<(res: TrackLyricsResolution) => void>();
  private preResolveQueue: Song[] = [];
  private isProcessingQueue = false;
  private readonly MAX_CONCURRENCY = 3;

  /**
   * Subscribe to resolution status updates
   */
  public subscribe(listener: (res: TrackLyricsResolution) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(res: TrackLyricsResolution): void {
    for (const listener of this.listeners) {
      try {
        listener(res);
      } catch (err) {
        console.error('LyricsPipeline listener error:', err);
      }
    }
  }

  /**
   * Synchronously checks if a track's resolution is already known
   */
  public getResolutionStatus(song: Song | null | undefined): TrackLyricsResolution | undefined {
    if (!song) return undefined;
    const key = getCanonicalTrackKey(song);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Check if song already has in-memory canonical lines
    const lines = lyricsService.getCanonicalLyricLines(song);
    if (lines && lines.length > 0) {
      const isSynced = lines.some((l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1));
      const res: TrackLyricsResolution = {
        canonicalKey: key,
        trackId: song.id,
        title: song.title,
        artist: song.artist,
        language: song.originalLanguage,
        outcome: isSynced ? 'SYNCED_VERIFIED' : 'PLAIN_VERIFIED',
        hasSyncedLyrics: isSynced,
        hasPlainLyrics: !isSynced,
        lineCount: lines.length,
        sampleSnippet: lines[0]?.text,
        resolvedAt: Date.now(),
        sourceProvenance: 'catalog-in-memory'
      };
      this.cache.set(key, res);
      return res;
    }

    return undefined;
  }

  /**
   * Checks whether lyrics resolution is currently in-flight for this track
   */
  public isResolving(song: Song | null | undefined): boolean {
    if (!song) return false;
    const key = getCanonicalTrackKey(song);
    return this.inFlight.has(key);
  }

  /**
   * Resolves lyrics for a track with request deduplication and truthful outcomes
   */
  public async resolveTrack(song: Song | null | undefined, forceRetry = false): Promise<TrackLyricsResolution> {
    if (!song) {
      return {
        canonicalKey: 'unknown:::unknown',
        trackId: 'unknown',
        title: 'Unknown',
        artist: 'Unknown',
        outcome: 'CONFIRMED_NO_MATCH',
        hasSyncedLyrics: false,
        hasPlainLyrics: false,
        lineCount: 0,
        resolvedAt: Date.now(),
        errorReason: 'No track provided'
      };
    }

    const key = getCanonicalTrackKey(song);

    // Return cached if successful or non-retryable within TTL
    if (!forceRetry && this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      if (
        existing.outcome === 'SYNCED_VERIFIED' ||
        existing.outcome === 'SYNCHRONIZED' ||
        existing.outcome === 'PLAIN_VERIFIED' ||
        existing.outcome === 'VERIFIED_UNTIMED'
      ) {
        return existing;
      }
      if (
        (existing.outcome === 'CONFIRMED_NO_MATCH' || existing.outcome === 'CONFIRMED_NO_RESULT') &&
        Date.now() - existing.resolvedAt < 300000
      ) {
        return existing;
      }
      if (existing.outcome === 'TRANSIENT_FAILURE' && Date.now() - existing.resolvedAt < 10000) {
        return existing;
      }
    }

    // Deduplicate in-flight requests for the same track
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    const resolvePromise = this.executeResolution(song, key);
    this.inFlight.set(key, resolvePromise);

    try {
      const result = await resolvePromise;
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async executeResolution(song: Song, key: string): Promise<TrackLyricsResolution> {
    // Notify pending
    const pendingRes: TrackLyricsResolution = {
      canonicalKey: key,
      trackId: song.id,
      title: song.title,
      artist: song.artist,
      language: song.originalLanguage,
      outcome: 'PENDING',
      hasSyncedLyrics: false,
      hasPlainLyrics: false,
      lineCount: 0,
      resolvedAt: Date.now()
    };
    this.notify(pendingRes);

    try {
      let lines: TimedLyricLine[] = lyricsService.getCanonicalLyricLines(song);
      const initialHasSync = lines && lines.length > 0 && lines.some(
        (l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1)
      );

      // If lyrics are absent OR untimed (plain text only), attempt network resolution to discover synchronized timestamps
      if (!initialHasSync) {
        const origLang = detectSongLanguage(song);
        const effectiveDuration = (song as any).fullTrackDuration || (song.duration > 35 ? song.duration : undefined);
        try {
          const fetched = await lyricsIngestionService.fetchLyrics(
            song.title,
            song.artist,
            effectiveDuration,
            song.album,
            (song as unknown as { isrc?: string }).isrc,
            origLang,
            song.id
          );

          if (fetched) {
            const fetchedHasSync = hasGenuineSynchronizedLines(fetched);
            if (fetchedHasSync || !lines || lines.length === 0) {
              if (!song.lyrics) song.lyrics = {};
              Object.assign(song.lyrics, fetched);
              lyricsService.clearCanonicalLinesCache(song.id);
              lines = lyricsService.getCanonicalLyricLines(song);
            }
          }
        } catch (fetchErr) {
          // If network resolution encounters transient error but we already have plain lines, preserve plain lines
          if (!lines || lines.length === 0) {
            throw fetchErr;
          }
        }
      }

      if (lines && lines.length > 0) {
        const hasRealTimestamps = lines.some(
          (l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1)
        );

        const outcome: LyricsResolutionOutcome = hasRealTimestamps ? 'SYNCED_VERIFIED' : 'PLAIN_VERIFIED';
        song.lyricsAvailable = true;
        song.lyricsSyncAvailable = hasRealTimestamps;

        const resolved: TrackLyricsResolution = {
          canonicalKey: key,
          trackId: song.id,
          title: song.title,
          artist: song.artist,
          language: song.originalLanguage || detectSongLanguage(song),
          outcome,
          hasSyncedLyrics: hasRealTimestamps,
          hasPlainLyrics: !hasRealTimestamps,
          lineCount: lines.length,
          sampleSnippet: lines[0]?.text || '',
          resolvedAt: Date.now(),
          sourceProvenance: 'online-provider'
        };

        this.cache.set(key, resolved);
        this.notify(resolved);
        return resolved;
      }

      // No lines found - distinguish between confirmed no result and transient
      song.lyricsAvailable = false;
      song.lyricsSyncAvailable = false;

      const noResult: TrackLyricsResolution = {
        canonicalKey: key,
        trackId: song.id,
        title: song.title,
        artist: song.artist,
        language: song.originalLanguage,
        outcome: 'CONFIRMED_NO_MATCH',
        hasSyncedLyrics: false,
        hasPlainLyrics: false,
        lineCount: 0,
        resolvedAt: Date.now(),
        errorReason: 'No matching lyrics found on provider'
      };

      this.cache.set(key, noResult);
      this.notify(noResult);
      return noResult;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNetworkError = /network|timeout|fetch|abort|transient|rate|503|502|504|429/i.test(errorMessage);

      const failed: TrackLyricsResolution = {
        canonicalKey: key,
        trackId: song.id,
        title: song.title,
        artist: song.artist,
        language: song.originalLanguage,
        outcome: isNetworkError ? 'TRANSIENT_FAILURE' : 'CONFIRMED_NO_MATCH',
        hasSyncedLyrics: false,
        hasPlainLyrics: false,
        lineCount: 0,
        resolvedAt: Date.now(),
        errorReason: isNetworkError ? 'Network request failed or timed out' : 'Provider lookup failed',
        error: isNetworkError ? 'Network request failed or timed out' : 'Provider lookup failed'
      };

      this.cache.set(key, failed);
      this.notify(failed);
      return failed;
    }
  }

  /**
   * Pre-resolves lyrics for a list of visible tracks in the background
   * using bounded concurrency to prevent UI stalls or provider rate limiting.
   */
  public preResolveTracks(songs: Song[]): void {
    for (const song of songs) {
      const key = getCanonicalTrackKey(song);
      if (!this.cache.has(key) && !this.inFlight.has(key)) {
        if (!this.preResolveQueue.some((s) => getCanonicalTrackKey(s) === key)) {
          this.preResolveQueue.push(song);
        }
      }
    }

    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.preResolveQueue.length === 0) return;
    this.isProcessingQueue = true;

    try {
      while (this.preResolveQueue.length > 0) {
        const batch = this.preResolveQueue.splice(0, this.MAX_CONCURRENCY);
        await Promise.allSettled(batch.map((song) => this.resolveTrack(song)));
        // Brief pause to stay well under rate limits
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Invalidate cache for a specific track or all tracks
   */
  public invalidateCache(canonicalKey?: string): void {
    if (canonicalKey) {
      this.cache.delete(canonicalKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Returns a snapshot of all resolved tracks
   */
  public getAllResolutions(): TrackLyricsResolution[] {
    return Array.from(this.cache.values());
  }
}

export const lyricsPipelineService = new LyricsPipelineService();
