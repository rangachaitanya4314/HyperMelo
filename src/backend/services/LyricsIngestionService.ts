// Backend Lyrics Ingestion Service for NARO
// Implements ILyricsService contract behind backend boundary
// External retrieval from LRCLIB, timeline parsing, caching, and multilingual alignment

import {
  type SongLyrics,
  type LanguageLyrics,
  type TimedLyricLine,
  type ILyricsService,
  detectLanguage
} from '../../shared';

interface LrclibRecord {
  id?: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
  isrc?: string;
}

export class LyricsIngestionService implements ILyricsService {
  private cache: Map<string, SongLyrics> = new Map();

  /**
   * Parse timestamped LRC format: [mm:ss.xx] or [mm:ss.xxx] line text
   */
  public parseLrc(lrcText: string, totalDuration: number): TimedLyricLine[] {
    const rawLines = lrcText.split('\n');
    const parsed: { time: number; text: string }[] = [];

    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Skip metadata tags like [ar:...], [ti:...], [al:...], [length:...]
      if (/^\[(ar|ti|al|by|offset|length):/i.test(trimmed)) {
        continue;
      }

      timeRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      const text = trimmed.replace(timeRegex, '').trim();

      while ((match = timeRegex.exec(trimmed)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millisStr = match[3] || '0';
        const millis = millisStr.length === 2 ? parseInt(millisStr, 10) * 10 : parseInt(millisStr, 10);
        const time = minutes * 60 + seconds + millis / 1000;

        if (text) {
          parsed.push({ time, text });
        }
      }
    }

    parsed.sort((a, b) => a.time - b.time);

    // Compute durations strictly between lines
    const result: TimedLyricLine[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const current = parsed[i];
      const next = parsed[i + 1];
      const duration = next ? Math.max(0.8, next.time - current.time) : Math.max(2, totalDuration - current.time);

      const detected = detectLanguage(current.text);
      result.push({
        id: `lyric-${i}`,
        startTime: current.time,
        endTime: current.time + duration,
        time: current.time,
        duration,
        text: current.text,
        translations: {
          [detected]: current.text
        }
      });
    }

    return result;
  }

  /**
   * Parse plain lyrics into lines when synced LRC is unavailable.
   * NEVER generates synthetic timestamps from duration, formulas, or intervals!
   */
  public parsePlainLyrics(plainText: string): TimedLyricLine[] {
    const rawLines = plainText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('['));

    if (rawLines.length === 0) return [];

    return rawLines.map((text, idx) => {
      const detected = detectLanguage(text);
      return {
        id: `plain-${idx}`,
        startTime: -1,
        time: -1,
        duration: 0,
        text,
        translations: {
          [detected]: text
        }
      };
    });
  }

  /**
   * Fetch online lyrics using exact track matching with fallback search
   */
  public async fetchLyrics(
    trackName: string,
    artistName: string,
    duration?: number,
    albumName?: string,
    isrc?: string
  ): Promise<SongLyrics | null> {
    const cacheKey = `${trackName.toLowerCase()}_${artistName.toLowerCase()}_${Math.round(duration || 0)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const cleanTrack = trackName.replace(/[[({].*?[)\]}]/g, '').trim();
    const cleanArtist = artistName.split('&')[0].split(',')[0].replace(/feat\..*/i, '').trim();
    const cleanAlbum = albumName ? albumName.replace(/[[({].*?[)\]}]/g, '').trim() : '';

    try {
      // Step 1: Try exact matching GET endpoint
      let exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      if (cleanAlbum) {
        exactUrl += `&album_name=${encodeURIComponent(cleanAlbum)}`;
      }
      if (duration && duration > 0) {
        exactUrl += `&duration=${Math.round(duration)}`;
      }

      const getRes = await fetch(exactUrl, { signal: AbortSignal.timeout(3000) });
      if (getRes.ok) {
        const record: LrclibRecord = await getRes.json();
        const lyrics = this.buildSongLyricsFromRecord(record, duration || record.duration || 180);
        if (lyrics) {
          this.cache.set(cacheKey, lyrics);
          return lyrics;
        }
      }

      // Step 2: Fallback to filtered search
      const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(3000) });
      if (!searchRes.ok) return null;

      const candidates: LrclibRecord[] = await searchRes.json();
      if (!Array.isArray(candidates) || candidates.length === 0) return null;

      const isOriginalWanted = !/remix|unplugged|live|lofi|acoustic|cover/i.test(trackName);

      const suitable = candidates.filter((c) => {
        if (isOriginalWanted && /remix|unplugged|live|lofi|acoustic|cover/i.test(c.trackName)) {
          return false;
        }
        if (duration && c.duration) {
          if (Math.abs(c.duration - duration) > 14) return false;
        }
        if (isrc && c.isrc && c.isrc !== isrc) return false;
        return true;
      });

      const best = (suitable.length > 0 ? suitable : candidates).find((c) => c.syncedLyrics) || candidates[0];
      const approxDuration = duration || best.duration || 180;

      const lyrics = this.buildSongLyricsFromRecord(best, approxDuration);
      if (lyrics) {
        this.cache.set(cacheKey, lyrics);
        return lyrics;
      }

      return null;
    } catch {
      return null;
    }
  }

  private buildSongLyricsFromRecord(record: LrclibRecord, duration: number): SongLyrics | null {
    let lines: TimedLyricLine[] = [];

    if (record.syncedLyrics) {
      lines = this.parseLrc(record.syncedLyrics, duration);
    } else if (record.plainLyrics) {
      lines = this.parsePlainLyrics(record.plainLyrics);
    }

    if (lines.length === 0) return null;

    const middleIdx = Math.floor(lines.length / 2);
    const chorusSnippet = lines[middleIdx]?.text || lines[0]?.text || '';


    // Detect script from sample lines or metadata
    const sampleText = lines.slice(0, 10).map((l) => l.text).join(' ');
    let detectedLang = detectLanguage(sampleText);
    if (detectedLang === 'en') {
      const meta = `${record.trackName} ${record.artistName} ${record.albumName || ''}`.toLowerCase();
      if (meta.includes('hindi') || meta.includes('arijit') || meta.includes('pritam') || meta.includes('channa') || meta.includes('apna') || meta.includes('kesariya')) {
        detectedLang = 'hi';
      } else if (meta.includes('telugu') || meta.includes('devara') || meta.includes('neeve') || meta.includes('vennela') || meta.includes('anirudh') || meta.includes('fear song')) {
        detectedLang = 'te';
      } else if (meta.includes('tamil') || meta.includes('kuthu') || meta.includes('hukum') || meta.includes('kaavaalaa')) {
        detectedLang = 'ta';
      } else if (meta.includes('malayalam') || meta.includes('illuminati') || meta.includes('aavesham')) {
        detectedLang = 'ml';
      }
    }

    // Attach detected language to each line's translations dictionary
    lines.forEach((l) => {
      if (!l.translations) l.translations = {};
      l.translations[detectedLang] = l.text;
    });

    const langLyrics: LanguageLyrics = {
      chorusSnippet,
      lines
    };

    const songLyrics: SongLyrics = {
      [detectedLang]: langLyrics
    };

    return songLyrics;
  }
}

export const lyricsIngestionService = new LyricsIngestionService();
