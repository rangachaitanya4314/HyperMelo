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
  sourceProvenance?: string;
}

export interface CandidateMatchResult {
  isMatch: boolean;
  score: number;
}

/**
 * Validates whether any language bucket in a SongLyrics object contains genuine non-negative synchronized line timestamps.
 */
export function hasGenuineSynchronizedLines(lyrics: SongLyrics | null | undefined): boolean {
  if (!lyrics) return false;
  return Object.values(lyrics).some((bucket) =>
    bucket?.lines?.some((l: TimedLyricLine) => l.startTime !== undefined && l.startTime >= 0 && l.startTime !== -1)
  );
}

/**
 * Legitimate release descriptor, regional language, and alternate-title suffix pattern.
 */
const RELEASE_DESCRIPTOR_REGEX = /^(?:from|soundtrack|ost|theme|remastered|remaster|bonus track|bonus|live|radio edit|single version|single|acoustic|remix|lofi|lo-fi|lyrical|version|instrumental|reprise|deluxe|telugu|tamil|hindi|kannada|malayalam|bengali|marathi|punjabi|gujarati|urdu|original motion picture soundtrack|audio)(?:\s|$)/i;

/**
 * Normalizes title for candidate comparison across languages.
 * Strips bracketed descriptors, featured text, and normalizes punctuation.
 */
export function normalizeTitleForMatching(title: string): string {
  return unescapeHtml(title || '')
    .toLowerCase()
    .trim()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
    .replace(/\s*[-–—:]\s*(?:from|theme|remastered|remaster|bonus track|bonus|live|radio edit|single version|single|acoustic|remix|lo-fi|lofi|ost|soundtrack|telugu|tamil|hindi|kannada|malayalam|bengali|marathi|punjabi|gujarati|urdu|original motion picture soundtrack|version|audio|lyrical).*/i, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes common South Asian and Arabic romanization/transliteration spelling variants
 * (e.g., th vs dh, aa vs a, ee vs i, oo vs u, ae vs e, sh vs s, single vs double consonants).
 */
export function normalizePhoneticVariants(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/th/g, 'dh')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/ae+/g, 'e')
    .replace(/sh+/g, 's')
    .replace(/w/g, 'v')
    .replace(/(\p{L})\1+/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Safely extracts artist name string from JioSaavn result data,
 * handling both array of artist objects, string artist names, and subtitle fallback.
 */
export function extractSaavnArtistString(moreInfo: any, subtitle?: string): string {
  if (!moreInfo) return subtitle ? unescapeHtml(subtitle) : '';
  const primary = moreInfo.artistMap?.primary_artists;
  if (Array.isArray(primary)) {
    const names = primary
      .map((a: any) => (typeof a === 'string' ? a : a?.name || ''))
      .filter(Boolean);
    if (names.length > 0) return unescapeHtml(names.join(', '));
  } else if (typeof primary === 'string' && primary.trim()) {
    return unescapeHtml(primary);
  }
  if (typeof moreInfo.singers === 'string' && moreInfo.singers.trim()) {
    return unescapeHtml(moreInfo.singers);
  }
  if (typeof moreInfo.music === 'string' && moreInfo.music.trim()) {
    return unescapeHtml(moreInfo.music);
  }
  return subtitle ? unescapeHtml(subtitle) : '';
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
  } else if (
    normTarget.length > 4 &&
    normCand.length > 4 &&
    normalizePhoneticVariants(normTarget) === normalizePhoneticVariants(normCand)
  ) {
    // Transliteration/phonetic equivalence (e.g. "Kadhale Kadhale" vs "Kaathalae Kaathalae")
    titleScore = 90;
    titleMatch = true;
  } else if (normTarget.length >= 8 && normCand.length >= 8) {
    // Multi-word titles with very high word overlap (>= 78% Dice coefficient) and matching initial anchor token
    const tWords = normTarget.split(' ').filter(Boolean);
    const cWords = normCand.split(' ').filter(Boolean);
    if (tWords.length >= 2 && cWords.length >= 2) {
      const common = tWords.filter((w) => cWords.includes(w));
      const dice = (2 * common.length) / (tWords.length + cWords.length);
      const anchorsMatch = tWords[0] === cWords[0] || tWords[0].startsWith(cWords[0]) || cWords[0].startsWith(tWords[0]);
      if (dice >= 0.78 && anchorsMatch) {
        titleScore = 75;
        titleMatch = true;
      }
    }
  }

  if (!titleMatch) {
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

    const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:,](\d{1,3}))?\]/g;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Skip metadata tags like [ar:...], [ti:...], [al:...], [length:...]
      if (/^\[(ar|ti|al|by|offset|length):/i.test(trimmed)) {
        continue;
      }

      timeRegex.lastIndex = 0;
      const text = trimmed.replace(timeRegex, '').trim();

      timeRegex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = timeRegex.exec(trimmed)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = match[3] ? parseFloat('0.' + match[3]) : 0;
        const time = minutes * 60 + seconds + fraction;

        if (text) {
          parsed.push({ time, text });
        }
      }
    }

    parsed.sort((a, b) => a.time - b.time);

    // Compute durations strictly between lines with natural cap on long instrumental breaks
    const result: TimedLyricLine[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const current = parsed[i];
      const next = parsed[i + 1];
      let duration: number;
      if (next) {
        const gap = next.time - current.time;
        // Cap excessive line duration during long instrumental breaks (> 8s) to a natural singing line duration (max 6.5s)
        duration = gap > 8 ? Math.min(gap, 6.5) : Math.max(0.8, gap);
      } else {
        const rem = totalDuration - current.time;
        duration = rem > 8 ? 6.5 : Math.max(2, rem);
      }

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
    trackId?: string,
    callerContext?: ProviderContext
  ): Promise<SongLyrics | null> {
    const { cleanTitle, cleanArtist, primaryArtist } = sanitizeLyricsMetadata(trackName, artistName);
    const effectiveTrackId =
      trackId ||
      `track_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Step 1: Check IndexedDB / local storage cache
    const cached = await indexedDbService.getLyrics(effectiveTrackId);
    if (cached) {
      if (callerContext) callerContext.sourceProvenance = 'indexeddb-cache';
      return cached;
    }

    const context: ProviderContext = callerContext || {};
    let fallbackPlainLyrics: SongLyrics | null = null;
    let fallbackProvenance = '';

    // Step 2: Query LRCLIB exact /api/get with multi-artist and retry resilience
    const exactLyrics = await this.queryLrclibExact(cleanTitle, cleanArtist, duration, originalLanguage, primaryArtist, context);
    if (exactLyrics) {
      const hasSync = hasGenuineSynchronizedLines(exactLyrics);
      if (hasSync) {
        context.sourceProvenance = 'lrclib_exact';
        await indexedDbService.saveLyrics(effectiveTrackId, exactLyrics, 'lrclib_exact');
        return exactLyrics;
      } else if (!fallbackPlainLyrics) {
        fallbackPlainLyrics = exactLyrics;
        fallbackProvenance = 'lrclib_exact';
      }
    }

    // Step 3: If 404 or plain, query LRCLIB search /api/search?q={cleanTitle} with artist hint, candidate validation, and preview duration bypass
    const searchLyrics = await this.queryLrclibSearch(cleanTitle, duration, originalLanguage, primaryArtist || cleanArtist, context, _albumName);
    if (searchLyrics) {
      const hasSync = hasGenuineSynchronizedLines(searchLyrics);
      if (hasSync) {
        context.sourceProvenance = 'lrclib_search';
        await indexedDbService.saveLyrics(effectiveTrackId, searchLyrics, 'lrclib_search');
        return searchLyrics;
      } else if (!fallbackPlainLyrics) {
        fallbackPlainLyrics = searchLyrics;
        fallbackProvenance = 'lrclib_search';
      }
    }

    // Step 4: Prioritize NetEase open lyrics endpoint for verified synchronized .lrc lines
    const neteaseLyrics = await this.queryNetEaseLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context);
    if (neteaseLyrics) {
      const hasSync = hasGenuineSynchronizedLines(neteaseLyrics);
      if (hasSync) {
        context.sourceProvenance = 'netease';
        await indexedDbService.saveLyrics(effectiveTrackId, neteaseLyrics, 'netease');
        return neteaseLyrics;
      } else if (!fallbackPlainLyrics) {
        fallbackPlainLyrics = neteaseLyrics;
        fallbackProvenance = 'netease';
      }
    }

    // Step 5: Query JioSaavn lyrics endpoint with candidate validation
    const saavnLyrics = await this.queryJioSaavnLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context);
    if (saavnLyrics) {
      const hasSync = hasGenuineSynchronizedLines(saavnLyrics);
      if (hasSync) {
        context.sourceProvenance = 'jiosaavn';
        await indexedDbService.saveLyrics(effectiveTrackId, saavnLyrics, 'jiosaavn');
        return saavnLyrics;
      } else if (!fallbackPlainLyrics) {
        fallbackPlainLyrics = saavnLyrics;
        fallbackProvenance = 'jiosaavn';
      }
    }

    // Return legitimate plain lyrics if no provider had synchronized timestamps
    if (fallbackPlainLyrics) {
      context.sourceProvenance = fallbackProvenance;
      await indexedDbService.saveLyrics(effectiveTrackId, fallbackPlainLyrics, fallbackProvenance);
      return fallbackPlainLyrics;
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
   * strictly validates candidates against title/artist, and prioritizes genuine synced lyrics
   * matching the target recording's language and Unicode script.
   */
  public async queryLrclibSearch(
    cleanTitle: string,
    duration?: number,
    originalLanguage?: Language,
    artistHint?: string,
    context?: ProviderContext,
    albumHint?: string
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    const headers = {
      'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)'
    };

    const queries: string[] = [];
    if (artistHint) {
      queries.push(`${cleanTitle} ${artistHint}`.trim());
    }
    if (albumHint && albumHint !== cleanTitle) {
      queries.push(`${cleanTitle} ${albumHint}`.trim());
    }
    queries.push(cleanTitle);

    const words = cleanTitle.split(/\s+/).filter(Boolean);
    if (words.length > 3 && artistHint) {
      const shortTitle = words.slice(0, 3).join(' ');
      const qShort = `${shortTitle} ${artistHint}`.trim();
      if (!queries.includes(qShort)) queries.push(qShort);
    }

    // Helper to evaluate linguistic affinity of candidate lyrics for regional/Indian film songs
    const getCandidateLanguageScore = (record: LrclibRecord, targetLang?: Language): number => {
      if (!targetLang || targetLang === 'en') return 0;

      const rawLyrics = record.syncedLyrics || record.plainLyrics || '';
      const trackName = unescapeHtml(record.trackName || '').toLowerCase();
      const artistName = unescapeHtml(record.artistName || '').toLowerCase();

      let langBonus = 0;

      // Unicode script ranges for Indian and regional languages
      const scriptRegexes: Record<string, RegExp> = {
        te: /[\u0C00-\u0C7F]/, // Telugu
        ta: /[\u0B80-\u0BFF]/, // Tamil
        hi: /[\u0900-\u097F]/, // Devanagari / Hindi
        ml: /[\u0D00-\u0D7F]/, // Malayalam
        kn: /[\u0C80-\u0CFF]/, // Kannada
        pa: /[\u0A00-\u0A7F]/, // Gurmukhi / Punjabi
        bn: /[\u0980-\u09FF]/  // Bengali
      };

      const targetScript = scriptRegexes[targetLang];
      if (targetScript && targetScript.test(rawLyrics)) {
        langBonus += 80; // High confidence authentic script match
      } else {
        // Penalize distinct conflicting regional script
        for (const [l, reg] of Object.entries(scriptRegexes)) {
          if (l !== targetLang && reg.test(rawLyrics)) {
            langBonus -= 50;
            break;
          }
        }
      }

      // Title/artist language descriptor tokens & lyricists
      const langKeywords: Record<string, string[]> = {
        te: ['telugu', 'ramajogayya sastry', 'sirivennela', 'ananta sriram', 'bhaskarabhatla', 'chandrabose'],
        ta: ['tamil', 'vishnu edavan', 'vairamuthu', 'na muthukumar', 'madhan karky', 'kabilan', 'yugabharathi'],
        hi: ['hindi', 'manoj muntashir', 'amitabh bhattacharya', 'irshad kamil', 'gulzar', 'javed akhtar'],
        ml: ['malayalam', 'vinayak sasikumar', 'rafeeq ahammed'],
        kn: ['kannada', 'jayanth kaykini'],
        pa: ['punjabi', 'jaani', 'b praak'],
        bn: ['bengali']
      };

      const targetKeywords = langKeywords[targetLang] || [targetLang];
      if (targetKeywords.some((kw) => trackName.includes(kw) || artistName.includes(kw))) {
        langBonus += 40;
      }

      // Strongly penalize explicit foreign language tags in title (e.g. "[Tamil]" when searching for Telugu)
      for (const [l, keywords] of Object.entries(langKeywords)) {
        if (l !== targetLang) {
          const mainTag = keywords[0];
          if (
            trackName.includes(`[${mainTag}]`) ||
            trackName.includes(`(${mainTag})`) ||
            trackName.includes(`- ${mainTag}`) ||
            trackName.includes(`– ${mainTag}`)
          ) {
            langBonus -= 60;
            break;
          }
        }
      }

      return langBonus;
    };

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

        // Sort candidates: language score + match quality score first, then synced lyrics, then duration proximity
        pool.sort((a, b) => {
          const langScoreA = getCandidateLanguageScore(a.record, originalLanguage);
          const langScoreB = getCandidateLanguageScore(b.record, originalLanguage);
          const totalA = a.score + langScoreA;
          const totalB = b.score + langScoreB;

          if (totalB !== totalA) return totalB - totalA;
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
    const saavnQueries = [`${cleanTitle} ${cleanArtist}`.trim()];
    const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
    if (titleWords.length > 3) {
      const short = `${titleWords.slice(0, 3).join(' ')} ${cleanArtist}`.trim();
      if (!saavnQueries.includes(short)) saavnQueries.push(short);
    }

    for (const query of saavnQueries) {
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
          continue;
        }

        if (!searchRes.ok) continue;

        const data: { results?: Array<{ id: string; title: string; subtitle?: string; more_info?: { has_lyrics?: string | boolean; lyrics_id?: string; singers?: string; music?: string; artistMap?: { primary_artists?: string } } }> } = await searchRes.json();
        if (context) context.authoritativeChecked = true;
        const results = data.results;
        if (!Array.isArray(results) || results.length === 0) continue;

        // Find candidates that genuinely have lyrics AND match title + artist
        const candidate = results.find((r) => {
          const hasLyrics = r.more_info?.has_lyrics === 'true' || r.more_info?.has_lyrics === true;
          if (!hasLyrics) return false;

          const candTitle = unescapeHtml(r.title || '');
          const candArtist = extractSaavnArtistString(r.more_info, r.subtitle);

          return isCandidateValidMatch(cleanTitle, cleanArtist, candTitle, candArtist).isMatch;
        });

        if (!candidate) continue;

        const targetLyricsId = candidate.more_info?.lyrics_id || candidate.id;
        if (!targetLyricsId) continue;

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
      }
    }
    return null;
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
