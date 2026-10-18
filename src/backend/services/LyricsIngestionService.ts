// Backend Lyrics Ingestion Service for NARO
// Implements ILyricsService contract behind backend boundary
// Multi-provider resilient lyrics retrieval: LRCLIB (exact + search) -> JioSaavn -> NetEase
// IndexedDB persistence under track ID

import {
  type SongLyrics,
  type LanguageLyrics,
  type TimedLyricLine,
  type ILyricsService,
  type Language
} from '../../shared';
import { validateScriptForLanguage } from '../../services/lyrics/translationService';
import {
  detectLyricLinesLanguage,
  sourceLanguageToDefaultDisplay
} from '../../services/lyrics/languageDetectionService';
import {
  sanitizeLyricsMetadata,
  unescapeHtml
} from '../../services/lyrics/lyricsSanitizer';
import { indexedDbService } from '../../services/storage/indexedDbService';

export interface LrclibRecord {
  id?: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
  isrc?: string;
}

export interface ProviderContext {
  lastTransientError?: Error;
  authoritativeChecked?: boolean;
}

export interface CandidateMatchResult {
  isMatch: boolean;
  score: number;
}

/**
 * Legitimate release descriptor and alternate-title suffix pattern.
 */
const RELEASE_DESCRIPTOR_REGEX = /^(?:from|soundtrack|ost|theme|remastered|remaster|bonus track|bonus|live|radio edit|single version|single|acoustic|remix|lofi|lo-fi|lyrical|version|instrumental|reprise|deluxe)(?:\s|$)/i;

/**
 * Normalizes title for candidate comparison across languages.
 * Strips bracketed descriptors, featured text, and normalizes punctuation.
 */
export function normalizeTitleForMatching(title: string): string {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
    .replace(/\s*[-–—:]\s*(?:from|theme|remastered|remaster|bonus track|bonus|live|radio edit|single version|single|acoustic|remix|lo-fi|lofi|ost|soundtrack).*/i, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes and extracts individual artist tokens from a multi-artist string.
 * Handles commas, ampersands, plus signs, semicolons, slashes, and feat/ft/with/and/vs/x.
 */
export function extractArtistCandidates(artistStr: string): string[] {
  if (!artistStr) return [];
  const parts = artistStr
    .split(/[,/;&+]|\b(?:feat\.?|ft\.?|featuring|with|and|vs\.?|x)\b/i)
    .map((s) =>
      s
        .toLowerCase()
        .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length > 0);
  return parts;
}

/**
 * Validates whether a candidate from LRCLIB/JioSaavn/NetEase genuinely matches the target song.
 * Prevents common-title collisions (e.g. "Stay", "Love") and reverse-prefix collisions while safely supporting multi-artist tracks.
 */
export function isCandidateValidMatch(
  targetTitle: string,
  targetArtist: string,
  candidateTitle: string,
  candidateArtist: string
): CandidateMatchResult {
  const normTarget = normalizeTitleForMatching(targetTitle);
  const normCand = normalizeTitleForMatching(candidateTitle);

  if (!normTarget || !normCand) {
    return { isMatch: false, score: 0 };
  }

  // 1. Title matching
  let titleScore = 0;
  let titleMatch = false;

  if (normTarget === normCand) {
    titleScore = 100;
    titleMatch = true;
  } else if (normCand.startsWith(normTarget + ' ')) {
    // Candidate title extends target title (e.g. candidate "Yellow Live at Pompeii" for target "Yellow")
    // Only accept if the trailing suffix is an explicitly supported alternate-title / release descriptor
    const remainder = normCand.slice(normTarget.length + 1).trim();
    if (RELEASE_DESCRIPTOR_REGEX.test(remainder)) {
      titleScore = 80;
      titleMatch = true;
    } else {
      // Disallow non-descriptor extensions like "Stay with Me" for target "Stay"
      return { isMatch: false, score: 0 };
    }
  } else if (normTarget.startsWith(normCand + ' ')) {
    // Target title extends candidate title (e.g. target "Yellow Live" for candidate "Yellow")
    // Never accept merely because target starts with candidate plus space; require descriptor
    const remainder = normTarget.slice(normCand.length + 1).trim();
    if (RELEASE_DESCRIPTOR_REGEX.test(remainder)) {
      titleScore = 80;
      titleMatch = true;
    } else {
      // Reject reverse-prefix collisions (e.g. target "Stay with Me", candidate "Stay")
      return { isMatch: false, score: 0 };
    }
  } else {
    // Short titles (<= 4 chars, e.g. "Stay", "Love", "Hero") MUST match exactly
    return { isMatch: false, score: 0 };
  }

  // 2. Artist matching
  const targetArtists = extractArtistCandidates(targetArtist);
  const candArtists = extractArtistCandidates(candidateArtist);

  let artistScore = 0;
  let artistMatch = false;

  if (targetArtists.length === 0 || candArtists.length === 0) {
    // If one side has no artist info, require exact title and distinctive title length (> 8 chars)
    if (titleScore === 100 && normTarget.length > 8) {
      artistScore = 20;
      artistMatch = true;
    }
  } else {
    for (const t of targetArtists) {
      for (const c of candArtists) {
        if (t === c) {
          artistScore = Math.max(artistScore, 100);
          artistMatch = true;
          break;
        }
        if (t.length >= 4 && c.length >= 4 && (t.includes(c) || c.includes(t))) {
          artistScore = Math.max(artistScore, 80);
          artistMatch = true;
          break;
        }
      }
      if (artistScore === 100) break;
    }
  }

  // For short titles (<= 4 chars, e.g. "Stay", "Love"), artist MUST match with high confidence
  if (normTarget.length <= 4 && !artistMatch) {
    return { isMatch: false, score: 0 };
  }

  const isMatch = titleMatch && artistMatch;
  return { isMatch, score: titleScore + artistScore };
}

export class LyricsIngestionService implements ILyricsService {
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

      const detected = sourceLanguageToDefaultDisplay(detectLyricLinesLanguage([{ text: current.text } as TimedLyricLine]));
      const translations: Record<string, string> = {};
      if (validateScriptForLanguage(current.text, detected)) {
        translations[detected] = current.text;
      }

      result.push({
        id: `lyric-${i}`,
        startTime: current.time,
        endTime: current.time + duration,
        time: current.time,
        duration,
        text: current.text,
        translations
      });
    }

    return result;
  }

  /**
   * Parse plain lyrics into lines when synced LRC is unavailable.
   * Generates initial plain model (timestamps can be generated from canonical timeline).
   */
  public parsePlainLyrics(plainText: string): TimedLyricLine[] {
    const rawLines = plainText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('['));

    if (rawLines.length === 0) return [];

    return rawLines.map((text, idx) => {
      const detected = sourceLanguageToDefaultDisplay(detectLyricLinesLanguage([{ text } as TimedLyricLine]));
      const translations: Record<string, string> = {};
      if (validateScriptForLanguage(text, detected)) {
        translations[detected] = text;
      }

      return {
        id: `plain-${idx}`,
        startTime: -1,
        time: -1,
        duration: 0,
        text,
        translations
      };
    });
  }

  /**
   * Resilient Multi-Provider Lyrics Fetching with 5-Tier Fallback:
   * Step 1: Check IndexedDB / local storage cache.
   * Step 2: Query LRCLIB exact /api/get.
   * Step 3: If 404, query LRCLIB search /api/search?q={cleanTitle} and pick top result matching duration (±3 seconds).
   * Step 4: If still missing, query the JioSaavn lyrics endpoint.
   * Step 5: Query the NetEase open lyrics endpoint.
   * Cache any successful response in IndexedDB under the track ID so it never needs to fetch across the network twice.
   */
  public async fetchLyrics(
    trackName: string,
    artistName: string,
    duration?: number,
    _albumName?: string,
    _isrc?: string,
    originalLanguage?: Language,
    trackId?: string
  ): Promise<SongLyrics | null> {
    const { cleanTitle, cleanArtist, primaryArtist } = sanitizeLyricsMetadata(trackName, artistName);
    const effectiveTrackId =
      trackId ||
      `track_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Step 1: Check IndexedDB / local storage cache
    const cached = await indexedDbService.getLyrics(effectiveTrackId);
    if (cached) {
      return cached;
    }

    const context: ProviderContext = {};

    // Step 2: Query LRCLIB exact /api/get with multi-artist and retry resilience
    const exactLyrics = await this.queryLrclibExact(cleanTitle, cleanArtist, duration, originalLanguage, primaryArtist, context);
    if (exactLyrics) {
      await indexedDbService.saveLyrics(effectiveTrackId, exactLyrics, 'lrclib_exact');
      return exactLyrics;
    }

    // Step 3: If 404, query LRCLIB search /api/search?q={cleanTitle} with artist hint, candidate validation, and preview duration bypass
    const searchLyrics = await this.queryLrclibSearch(cleanTitle, duration, originalLanguage, primaryArtist || cleanArtist, context);
    if (searchLyrics) {
      await indexedDbService.saveLyrics(effectiveTrackId, searchLyrics, 'lrclib_search');
      return searchLyrics;
    }

    // Step 4: If still missing, query the JioSaavn lyrics endpoint with candidate validation
    const saavnLyrics = await this.queryJioSaavnLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context);
    if (saavnLyrics) {
      await indexedDbService.saveLyrics(effectiveTrackId, saavnLyrics, 'jiosaavn');
      return saavnLyrics;
    }

    // Step 5: Query the NetEase open lyrics endpoint with candidate validation
    const neteaseLyrics = await this.queryNetEaseLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context);
    if (neteaseLyrics) {
      await indexedDbService.saveLyrics(effectiveTrackId, neteaseLyrics, 'netease');
      return neteaseLyrics;
    }

    // If no provider responded authoritatively and every attempt encountered transient network/rate/server errors,
    // propagate the transient error so the pipeline distinguishes it from a confirmed absence.
    if (!context.authoritativeChecked && context.lastTransientError) {
      throw new Error(`Transient provider failure: ${context.lastTransientError.message}`);
    }

    return null;
  }

  /**
   * Step 2: Query LRCLIB exact /api/get
   * Resilient across multi-artist strings (Arijit Singh & Pritam -> Arijit Singh),
   * with single 600ms retry on transient 503/429.
   */
  public async queryLrclibExact(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    primaryArtist?: string,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    const headers = {
      'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)'
    };

    // Build artist candidates list in priority order
    const artistCandidates: string[] = [];
    if (cleanArtist) artistCandidates.push(cleanArtist);
    if (primaryArtist && primaryArtist !== cleanArtist) artistCandidates.push(primaryArtist);

    // Also extract individual artists if cleanArtist is multi-artist
    const splitParts = cleanArtist.split(/[,/;&+]|\b(?:feat\.?|ft\.?|featuring|with|and|vs\.?|x)\b/i).map((s) => s.trim()).filter(Boolean);
    for (const part of splitParts) {
      if (!artistCandidates.includes(part)) {
        artistCandidates.push(part);
      }
    }

    for (const artist of artistCandidates) {
      try {
        const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`;
        let getRes = await fetch(exactUrl, { headers, signal: AbortSignal.timeout(6000) });

        // Handle transient 503 or 429 with backoff retry
        if (getRes.status === 503 || getRes.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          getRes = await fetch(exactUrl, { headers, signal: AbortSignal.timeout(6000) });
        }

        if (getRes.status === 200) {
          const record: LrclibRecord = await getRes.json();
          if (context) context.authoritativeChecked = true;
          if (record && (record.syncedLyrics || record.plainLyrics)) {
            return this.buildSongLyricsFromRecord(record, duration || record.duration || 180, originalLanguage);
          }
        } else if (getRes.status === 404) {
          if (context) context.authoritativeChecked = true;
        } else if (getRes.status === 429 || getRes.status >= 500) {
          if (context) {
            context.lastTransientError = new Error(`LRCLIB exact returned HTTP ${getRes.status}`);
          }
        }
      } catch (err: unknown) {
        if (context) {
          context.lastTransientError = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    return null;
  }

  /**
   * Step 3: Query LRCLIB search /api/search?q={query}.
   * Searches title + artist first, handles preview tracks (duration <= 35s),
   * strictly validates candidates against title/artist, and prioritizes synced lyrics.
   */
  public async queryLrclibSearch(
    cleanTitle: string,
    duration?: number,
    originalLanguage?: Language,
    artistHint?: string,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    const headers = {
      'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)'
    };

    const queries = artistHint ? [`${cleanTitle} ${artistHint}`.trim(), cleanTitle] : [cleanTitle];

    for (const q of queries) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
        let searchRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(6000) });

        // Handle transient 503 or 429 with backoff retry
        if (searchRes.status === 503 || searchRes.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          searchRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(6000) });
        }

        if (searchRes.status === 429 || searchRes.status >= 500) {
          if (context) {
            context.lastTransientError = new Error(`LRCLIB search returned HTTP ${searchRes.status}`);
          }
          continue;
        }

        if (!searchRes.ok) continue;

        const candidates: LrclibRecord[] = await searchRes.json();
        if (context) context.authoritativeChecked = true;
        if (!Array.isArray(candidates) || candidates.length === 0) continue;

        const withLyrics = candidates.filter((c) => c.syncedLyrics || c.plainLyrics);
        if (withLyrics.length === 0) continue;

        // Strictly validate each candidate against target title and artist
        const validCandidates: { record: LrclibRecord; score: number }[] = [];
        for (const c of withLyrics) {
          const evalRes = isCandidateValidMatch(cleanTitle, artistHint || '', c.trackName, c.artistName);
          if (evalRes.isMatch) {
            validCandidates.push({ record: c, score: evalRes.score });
          }
        }

        if (validCandidates.length === 0) continue;

        // Preview tracks have duration <= 35s. For preview tracks, do not filter by duration.
        const isPreview = !duration || duration <= 35;
        let pool = validCandidates;

        if (!isPreview && duration) {
          const closeMatches = validCandidates.filter(
            (c) => c.record.duration && Math.abs(c.record.duration - duration) <= 8
          );
          if (closeMatches.length > 0) {
            pool = closeMatches;
          }
        }

        // Sort candidates: match quality score first, then synced lyrics, then duration proximity
        pool.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.record.syncedLyrics && !b.record.syncedLyrics) return -1;
          if (!a.record.syncedLyrics && b.record.syncedLyrics) return 1;
          if (!isPreview && duration && a.record.duration && b.record.duration) {
            return Math.abs(a.record.duration - duration) - Math.abs(b.record.duration - duration);
          }
          return 0;
        });

        const topResult = pool[0]?.record;
        if (topResult) {
          return this.buildSongLyricsFromRecord(topResult, duration || topResult.duration || 180, originalLanguage);
        }
      } catch (err: unknown) {
        if (context) {
          context.lastTransientError = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    return null;
  }

  /**
   * Step 4: Query the JioSaavn lyrics endpoint with candidate verification
   */
  public async queryJioSaavnLyrics(
    cleanTitle: string,
    cleanArtist: string,
    _duration?: number,
    originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.origin);
    const query = `${cleanTitle} ${cleanArtist}`.trim();

    try {
      let searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=5&p=1&q=${encodeURIComponent(query)}`;
      if (isBrowser) {
        searchUrl = `/api/saavn/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=5&p=1&q=${encodeURIComponent(query)}`;
      }

      const searchRes = await fetch(searchUrl, {
        headers: isBrowser
          ? {}
          : {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              cookie: 'DL=english'
            },
        signal: AbortSignal.timeout(5000)
      });

      if (searchRes.status === 429 || searchRes.status >= 500) {
        if (context) context.lastTransientError = new Error(`JioSaavn search returned HTTP ${searchRes.status}`);
        return null;
      }

      if (!searchRes.ok) return null;

      const data: { results?: Array<{ id: string; title: string; subtitle?: string; more_info?: { has_lyrics?: string | boolean; lyrics_id?: string; singers?: string; music?: string; artistMap?: { primary_artists?: string } } }> } = await searchRes.json();
      if (context) context.authoritativeChecked = true;
      const results = data.results;
      if (!Array.isArray(results) || results.length === 0) return null;

      // Find candidates that genuinely have lyrics AND match title + artist
      const candidate = results.find((r) => {
        const hasLyrics = r.more_info?.has_lyrics === 'true' || r.more_info?.has_lyrics === true;
        if (!hasLyrics) return false;

        const candTitle = unescapeHtml(r.title || '');
        const candArtist = unescapeHtml(
          r.more_info?.artistMap?.primary_artists ||
          r.more_info?.singers ||
          r.more_info?.music ||
          r.subtitle ||
          ''
        );

        return isCandidateValidMatch(cleanTitle, cleanArtist, candTitle, candArtist).isMatch;
      });

      if (!candidate) return null;

      const targetLyricsId = candidate.more_info?.lyrics_id || candidate.id;
      if (!targetLyricsId) return null;

      let lyrUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(targetLyricsId)}&ctx=web6dot0&api_version=4&_format=json&_marker=0`;
      if (isBrowser) {
        lyrUrl = `/api/saavn/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(targetLyricsId)}&ctx=web6dot0&api_version=4&_format=json&_marker=0`;
      }

      const lyrRes = await fetch(lyrUrl, {
        headers: isBrowser
          ? {}
          : {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              cookie: 'DL=english'
            },
        signal: AbortSignal.timeout(5000)
      });

      if (lyrRes.status === 429 || lyrRes.status >= 500) {
        if (context) context.lastTransientError = new Error(`JioSaavn lyrics fetch returned HTTP ${lyrRes.status}`);
        return null;
      }

      if (!lyrRes.ok) return null;
      const lyrData: { lyrics?: string; status?: string } = await lyrRes.json();
      if (!lyrData.lyrics || typeof lyrData.lyrics !== 'string') return null;

      // Clean HTML entities and line breaks
      const cleanHtml = unescapeHtml(lyrData.lyrics)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      const lines = this.parsePlainLyrics(cleanHtml);
      if (lines.length === 0) return null;

      return this.buildSongLyricsFromLines(lines, originalLanguage);
    } catch (err: unknown) {
      if (context) {
        context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      }
      return null;
    }
  }

  /**
   * Step 5: Query the NetEase open lyrics endpoint with candidate verification
   */
  public async queryNetEaseLyrics(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.origin);
    const query = `${cleanTitle} ${cleanArtist}`.trim();

    try {
      let searchUrl = `https://music.163.com/api/search/get/web?csrf_token=&type=1&offset=0&total=true&limit=5&s=${encodeURIComponent(query)}`;
      if (isBrowser) {
        searchUrl = `/api/netease/api/search/get/web?csrf_token=&type=1&offset=0&total=true&limit=5&s=${encodeURIComponent(query)}`;
      }

      const searchRes = await fetch(searchUrl, {
        headers: {
          'Referer': 'https://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (searchRes.status === 429 || searchRes.status >= 500) {
        if (context) context.lastTransientError = new Error(`NetEase search returned HTTP ${searchRes.status}`);
        return null;
      }

      if (!searchRes.ok) return null;

      const data: { result?: { songs?: Array<{ id: number; name: string; duration?: number; artists?: Array<{ name: string }> }> } } = await searchRes.json();
      if (context) context.authoritativeChecked = true;
      const songs = data.result?.songs;
      if (!Array.isArray(songs) || songs.length === 0) return null;

      // Filter and validate candidates
      const matchingSongs = songs.filter((s) => {
        const candArtist = s.artists?.map((a) => a.name).join(', ') || '';
        return isCandidateValidMatch(cleanTitle, cleanArtist, s.name, candArtist).isMatch;
      });

      if (matchingSongs.length === 0) return null;

      let candidate = matchingSongs[0];
      if (duration && duration > 0) {
        const durationMatch = matchingSongs.find((s) => s.duration && Math.abs(s.duration / 1000 - duration) <= 5);
        if (durationMatch) {
          candidate = durationMatch;
        }
      }

      if (!candidate || !candidate.id) return null;

      let lyrUrl = `https://music.163.com/api/song/lyric?os=pc&id=${candidate.id}&lv=1&kv=1&tv=-1`;
      if (isBrowser) {
        lyrUrl = `/api/netease/api/song/lyric?id=${candidate.id}&lv=1&kv=1&tv=-1`;
      }

      const lyrRes = await fetch(lyrUrl, {
        headers: {
          'Referer': 'https://music.163.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (lyrRes.status === 429 || lyrRes.status >= 500) {
        if (context) context.lastTransientError = new Error(`NetEase lyric fetch returned HTTP ${lyrRes.status}`);
        return null;
      }

      if (!lyrRes.ok) return null;
      const lyrData: { lrc?: { lyric?: string } } = await lyrRes.json();
      const rawLrc = lyrData.lrc?.lyric;
      if (!rawLrc || typeof rawLrc !== 'string') return null;

      const approxDuration = duration || (candidate.duration ? candidate.duration / 1000 : 180);
      const lines = this.parseLrc(rawLrc, approxDuration);
      if (lines.length === 0) return null;

      return this.buildSongLyricsFromLines(lines, originalLanguage);
    } catch (err: unknown) {
      if (context) {
        context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      }
      return null;
    }
  }

  public buildSongLyricsFromRecord(
    record: LrclibRecord,
    duration: number,
    originalLanguage?: Language
  ): SongLyrics | null {
    let lines: TimedLyricLine[] = [];

    if (record.syncedLyrics) {
      lines = this.parseLrc(record.syncedLyrics, duration);
    } else if (record.plainLyrics) {
      lines = this.parsePlainLyrics(record.plainLyrics);
    }

    if (lines.length === 0) return null;
    return this.buildSongLyricsFromLines(lines, originalLanguage);
  }

  public buildSongLyricsFromLines(
    lines: TimedLyricLine[],
    _originalLanguage?: Language
  ): SongLyrics | null {
    if (!lines || lines.length === 0) return null;

    const middleIdx = Math.floor(lines.length / 2);
    const chorusSnippet = lines[middleIdx]?.text || lines[0]?.text || '';

    // Step 1: Detect actual source language from parsed lines (script-first, text-first)
    const detectedSource = detectLyricLinesLanguage(lines);
    const detectedLang: Language = sourceLanguageToDefaultDisplay(detectedSource);

    // Attach detected language to each line's translations dictionary strictly when validated
    lines.forEach((l) => {
      if (!l.translations) l.translations = {};
      if (validateScriptForLanguage(l.text, detectedLang)) {
        l.translations[detectedLang] = l.text;
      } else if (detectedLang === 'en') {
        l.translations['en'] = l.text;
      }
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
