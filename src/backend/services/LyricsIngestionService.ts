// Backend Lyrics Ingestion Service for NARO
// Implements ILyricsService contract behind backend boundary
// Multi-provider resilient lyrics retrieval: LRCLIB (exact + search) -> JioSaavn -> NetEase
// IndexedDB persistence under track ID

import {
  type SongLyrics,
  type LanguageLyrics,
  type TimedLyricLine,
  type ILyricsService,
  type Language,
  cleanDisplayLyricText,
  parseLyricWords
} from '../../shared';
import { validateScriptForLanguage } from '../../services/lyrics/translationService';
import { isLatinScript } from '../../services/lyrics/transliterationService';
import {
  detectLyricLinesLanguage,
  sourceLanguageToDefaultDisplay,
  detectScriptFromUnicode,
  identifyLatinScriptLanguage
} from '../../services/lyrics/languageDetectionService';
import {
  sanitizeLyricsMetadata,
  unescapeHtml,
  extractPrimaryArtist
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

export type ProviderClassification = 'active' | 'auth_required' | 'deprecated' | 'stub';

export type ProviderCheckStatus =
  | 'not_checked'
  | 'checking'
  | 'synchronized_lyrics_found'
  | 'plain_lyrics_found'
  | 'no_matching_lyrics'
  | 'provider_failed'
  | 'auth_required'
  | 'service_deprecated'
  | 'unimplemented_stub';

export interface ProviderAttemptLog {
  providerId: string;
  providerName: string;
  classification?: ProviderClassification;
  status: ProviderCheckStatus;
  hasSynchronized: boolean;
  hasPlain: boolean;
  error?: string;
  latencyMs?: number;
}

export interface ProviderContext {
  lastTransientError?: Error;
  authoritativeChecked?: boolean;
  sourceProvenance?: string;
  providerLogs?: Record<string, ProviderAttemptLog>;
  exhausted?: boolean;
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
 * Unicode script ranges for regional/Indic languages
 */
export const REGIONAL_SCRIPT_RANGES: Record<string, RegExp> = {
  te: /[\u0C00-\u0C7F]/, // Telugu
  ta: /[\u0B80-\u0BFF]/, // Tamil
  ml: /[\u0D00-\u0D7F]/, // Malayalam
  kn: /[\u0C80-\u0CFF]/, // Kannada
  hi: /[\u0900-\u097F]/, // Devanagari (Hindi)
  mr: /[\u0900-\u097F]/, // Devanagari (Marathi)
  pa: /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
  bn: /[\u0980-\u09FF]/, // Bengali
  gu: /[\u0A80-\u0AFF]/, // Gujarati
  ur: /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/ // Arabic/Urdu
};

/**
 * Checks if a candidate title or artist contains conflicting language tags/descriptors
 */
export function isCandidateTitleLanguageCompatible(candidateText: string, targetLanguage?: Language): boolean {
  if (!targetLanguage || !candidateText) return true;

  const lower = candidateText.toLowerCase();
  const langKeywords: Record<string, string[]> = {
    te: ['telugu'],
    ta: ['tamil'],
    hi: ['hindi'],
    ml: ['malayalam'],
    kn: ['kannada'],
    pa: ['punjabi'],
    bn: ['bengali'],
    mr: ['marathi'],
    gu: ['gujarati'],
    ur: ['urdu']
  };

  for (const [lang, keywords] of Object.entries(langKeywords)) {
    if (lang === targetLanguage) continue;
    for (const kw of keywords) {
            if (
        lower.includes(`[${kw}]`) ||
        lower.includes(`(${kw})`) ||
        lower.includes(`{${kw}}`) ||
        lower.includes(`- ${kw}`) ||
        lower.includes(`– ${kw}`) ||
        lower.includes(`— ${kw}`) ||
        lower.includes(`/${kw}/`) ||
        lower.includes(`${kw} version`) ||
        lower.includes(`${kw} track`) ||
        lower.includes(`${kw} audio`) ||
        lower.includes(`${kw} dub`)
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates candidate lyrics text against target song language.
 * Enforces:
 * - Reject conflicting Indic script (e.g. Malayalam script for Telugu song, or Indic script for English song).
 * - Reject conflicting high-confidence Romanized Latin lyrics.
 */
export function isLyricsCompatibleWithTarget(lyricsText: string, targetLanguage?: Language): boolean {
  if (!targetLanguage || !lyricsText || !lyricsText.trim()) return true;

  const targetScript = REGIONAL_SCRIPT_RANGES[targetLanguage];

  // 1. Target is English
  if (targetLanguage === 'en') {
    for (const regex of Object.values(REGIONAL_SCRIPT_RANGES)) {
      const matches = lyricsText.match(new RegExp(regex.source, 'g'));
      if (matches && matches.length > 5) {
        return false; // Conflicting Indic script in English track
      }
    }
    return true;
  }

  // 2. Target is an Indic/regional language
  for (const [lang, regex] of Object.entries(REGIONAL_SCRIPT_RANGES)) {
    if (
      lang === targetLanguage ||
      ((targetLanguage as string) === 'hi' && lang === 'mr') ||
      ((targetLanguage as string) === 'mr' && lang === 'hi')
    ) {
      continue;
    }
    const conflictingMatches = lyricsText.match(new RegExp(regex.source, 'g'));
    if (conflictingMatches && conflictingMatches.length > 5) {
      const targetMatches = targetScript ? lyricsText.match(new RegExp(targetScript.source, 'g')) : null;
      const targetCount = targetMatches ? targetMatches.length : 0;
      if (conflictingMatches.length > targetCount) {
        return false; // Reject: Conflicting script dominates
      }
    }
  }

  // 3. Latin script check for conflicting Romanized vocabulary
  const scriptResult = detectScriptFromUnicode(lyricsText);
  if (scriptResult.script === 'latin') {
    const latinResult = identifyLatinScriptLanguage(lyricsText);
    if (
      latinResult.language !== 'en' &&
      latinResult.language !== targetLanguage &&
      latinResult.confidence >= 0.5
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validates whether a candidate from LRCLIB/JioSaavn/NetEase genuinely matches the target song.
 * Prevents common-title collisions (e.g. "Stay", "Love") and reverse-prefix collisions while safely supporting multi-artist tracks.
 */
export function isCandidateValidMatch(
  targetTitle: string,
  targetArtist: string,
  candidateTitle: string,
  candidateArtist: string,
  targetLanguage?: Language
): CandidateMatchResult {
  if (
    targetLanguage &&
    (!isCandidateTitleLanguageCompatible(candidateTitle, targetLanguage) ||
      !isCandidateTitleLanguageCompatible(candidateArtist, targetLanguage))
  ) {
    return { isMatch: false, score: 0 };
  }

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
  } else if (normTarget.length >= 6 && normCand.length >= 6) {
    // Phonetic bigram similarity with matching initial anchor token (handles regional transliteration variants)
    const phonTarget = normalizePhoneticVariants(normTarget);
    const phonCand = normalizePhoneticVariants(normCand);
    const anchorT = phonTarget.slice(0, 3);
    const anchorC = phonCand.slice(0, 3);
    if (anchorT === anchorC) {
      const bigrams = new Map<string, number>();
      for (let i = 0; i < phonTarget.length - 1; i++) {
        const bg = phonTarget.slice(i, i + 2);
        bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
      }
      let intersection = 0;
      for (let i = 0; i < phonCand.length - 1; i++) {
        const bg = phonCand.slice(i, i + 2);
        const count = bigrams.get(bg) || 0;
        if (count > 0) {
          bigrams.set(bg, count - 1);
          intersection++;
        }
      }
      const dice = (2.0 * intersection) / (phonTarget.length - 1 + (phonCand.length - 1));
      if (dice >= 0.70) {
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
  private inFlightFetches = new Map<string, Promise<SongLyrics | null>>();
  private lrclibCooldownUntil: number = 0;
  private netEaseCooldownUntil: number = 0;

  public getNetEaseCooldownUntil(): number {
    return this.netEaseCooldownUntil;
  }

  public isNetEaseInCooldown(): boolean {
    return Date.now() < this.netEaseCooldownUntil;
  }

  public triggerNetEaseCooldown(durationMs: number = 5 * 60 * 1000): void {
    this.netEaseCooldownUntil = Date.now() + durationMs;
  }

  public getLrclibCooldownUntil(): number {
    return this.lrclibCooldownUntil;
  }

  public isLrclibInCooldown(): boolean {
    return Date.now() < this.lrclibCooldownUntil;
  }

  public getLrclibCooldownRemainingMs(): number {
    const diff = this.lrclibCooldownUntil - Date.now();
    return diff > 0 ? diff : 0;
  }

  public triggerLrclibCooldown(retryAfterHeader?: string | null): number {
    let cooldownMs = 60 * 1000; // default 60s
    if (retryAfterHeader) {
      const parsedSec = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsedSec) && parsedSec > 0) {
        cooldownMs = Math.min(Math.max(parsedSec * 1000, 5000), 300 * 1000);
      } else {
        const parsedDate = new Date(retryAfterHeader).getTime();
        if (!isNaN(parsedDate)) {
          const diff = parsedDate - Date.now();
          if (diff > 0) {
            cooldownMs = Math.min(Math.max(diff, 5000), 300 * 1000);
          }
        }
      }
    }
    this.lrclibCooldownUntil = Math.max(this.lrclibCooldownUntil, Date.now() + cooldownMs);
    return cooldownMs;
  }

  public resetCooldown(): void {
    this.lrclibCooldownUntil = 0;
  }

  /**
   * Parse timestamped LRC format: [mm:ss.xx] or [mm:ss.xxx] line text
   */
  public parseLrc(lrcText: string, totalDuration: number): TimedLyricLine[] {
    const rawLines = lrcText.split('\n');
    const parsed: { time: number; rawText: string; text: string }[] = [];

    const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:,](\d{1,3}))?\]/g;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Skip metadata tags like [ar:...], [ti:...], [al:...], [length:...]
      if (/^\[(ar|ti|al|by|offset|length):/i.test(trimmed)) {
        continue;
      }

      timeRegex.lastIndex = 0;
      const rawText = trimmed.replace(timeRegex, '').trim();
      const text = cleanDisplayLyricText(rawText);

      timeRegex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = timeRegex.exec(trimmed)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = match[3] ? parseFloat('0.' + match[3]) : 0;
        const time = minutes * 60 + seconds + fraction;

        if (text) {
          parsed.push({ time, rawText, text });
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
        words: parseLyricWords(current.rawText, current.time, current.time + duration),
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
      const cachedLines = Object.values(cached)[0]?.lines || [];
      const cachedText = cachedLines.map((l) => l.text).join(' \n ');
      if (!originalLanguage || isLyricsCompatibleWithTarget(cachedText, originalLanguage)) {
        if (callerContext) callerContext.sourceProvenance = 'indexeddb-cache';
        return cached;
      }
    }

    // Deduplicate in-flight requests for the same track
    if (this.inFlightFetches.has(effectiveTrackId)) {
      return this.inFlightFetches.get(effectiveTrackId)!;
    }

    const fetchPromise = (async () => {
      const context: ProviderContext = callerContext || {};
      let fallbackPlainLyrics: SongLyrics | null = null;
      let fallbackProvenance = '';

      // Multi-Provider Common Resolution Pipeline (14 BitChord Providers + Regional Sources)
      // Truthful Classification:
      // - 'active': Live, implemented providers executed over network (LRCLIB, lrc.red, NetEase, JioSaavn, KuGou).
      // - 'auth_required': Providers requiring API tokens / commercial credentials (PaxSenix, Musixmatch).
      // - 'deprecated': Upstream services permanently disabled (Megalobiz HTTP 410).
      // - 'stub': Integrations requiring client-side video session / unpopulated stubs (YouTube, SimpMusic, etc.).
      // NEVER claims a provider was checked or returned "no matching lyrics" when it is an unimplemented stub!
      interface ProviderEntry {
        id: string;
        name: string;
        classification: ProviderClassification;
        reason?: string;
        run?: () => Promise<SongLyrics | null>;
      }

      const providers: ProviderEntry[] = [
        // 1. Genuinely Active Implemented Open Providers
        { id: 'lrclib_exact', name: 'LRCLIB (Exact)', classification: 'active', run: () => this.queryLrclibExact(cleanTitle, cleanArtist, duration, originalLanguage, primaryArtist, context) },
        { id: 'lrc_red', name: 'lrc.red (Open Synced)', classification: 'active', run: () => this.queryLrcRed(cleanTitle, cleanArtist, duration, originalLanguage, context) },
        { id: 'lrclib_search', name: 'LRCLIB (Search)', classification: 'active', run: () => this.queryLrclibSearch(cleanTitle, duration, originalLanguage, primaryArtist || cleanArtist, context, _albumName) },
        { id: 'netease', name: 'NetEase Music', classification: 'active', run: () => this.queryNetEaseLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context) },
        { id: 'jiosaavn', name: 'JioSaavn Official', classification: 'active', run: () => this.queryJioSaavnLyrics(cleanTitle, primaryArtist || cleanArtist, duration, originalLanguage, context) },
        { id: 'kugou', name: 'KuGou Music', classification: 'active', run: () => this.queryKuGouLyrics(cleanTitle, cleanArtist, duration, originalLanguage, context) },

        // 2. Auth-Required Providers (requires API token / commercial credentials)
        { id: 'paxsenix', name: 'PaxSenix Lyrics API', classification: 'auth_required', reason: 'Requires configured PaxSenix API token' },
        { id: 'musixmatch', name: 'Musixmatch (Licensed)', classification: 'auth_required', reason: 'Requires commercial Musixmatch API credentials' },

        // 3. Deprecated Services (upstream permanently removed)
        { id: 'megalobiz', name: 'Megalobiz Community', classification: 'deprecated', reason: 'Upstream service permanently deprecated (HTTP 410 Gone)' },

        // 4. Stubs / Session-bound integrations
        { id: 'youtube_captions', name: 'YouTube Captions', classification: 'stub', reason: 'Requires bound YouTube video ID' },
        { id: 'youtube_music', name: 'YouTube Music Transcript', classification: 'stub', reason: 'Requires active YouTube session' },
        { id: 'simpmusic', name: 'SimpMusic Community', classification: 'stub', reason: 'Community integration stub' },
        { id: 'betterlyrics', name: 'BetterLyrics', classification: 'stub', reason: 'Client proxy integration stub' },
        { id: 'lyricsplus', name: 'LyricsPlus', classification: 'stub', reason: 'Community repository stub' },
        { id: 'binilyrics', name: 'BiniLyrics', classification: 'stub', reason: 'Asian pop repository stub' },
        { id: 'unison', name: 'Unison Synchronized', classification: 'stub', reason: 'P2P protocol stub' },
        { id: 'genius', name: 'Genius (Plain Text Fallback)', classification: 'stub', reason: 'Plain text scraper stub' }
      ];

      if (!context.providerLogs) {
        context.providerLogs = {};
        providers.forEach((p) => {
          context.providerLogs![p.id] = {
            providerId: p.id,
            providerName: p.name,
            classification: p.classification,
            status: p.classification === 'auth_required'
              ? 'auth_required'
              : p.classification === 'deprecated'
              ? 'service_deprecated'
              : p.classification === 'stub'
              ? 'unimplemented_stub'
              : 'not_checked',
            hasSynchronized: false,
            hasPlain: false,
            error: p.reason
          };
        });
      }

      for (const p of providers) {
        const log = context.providerLogs![p.id] || {
          providerId: p.id,
          providerName: p.name,
          classification: p.classification,
          status: 'not_checked',
          hasSynchronized: false,
          hasPlain: false
        };
        context.providerLogs![p.id] = log;

        if (p.classification === 'auth_required') {
          log.status = 'auth_required';
          log.error = p.reason;
          continue;
        }

        if (p.classification === 'deprecated') {
          log.status = 'service_deprecated';
          log.error = p.reason;
          continue;
        }

        if (p.classification === 'stub') {
          log.status = 'unimplemented_stub';
          log.error = p.reason;
          continue;
        }

        // Active provider execution
        log.status = 'checking';
        const startTime = Date.now();
        try {
          const lyrics = await p.run!();
          log.latencyMs = Date.now() - startTime;

          if (lyrics) {
            const hasSync = hasGenuineSynchronizedLines(lyrics);
            if (hasSync) {
              log.status = 'synchronized_lyrics_found';
              log.hasSynchronized = true;
              context.sourceProvenance = p.id;
              await indexedDbService.saveLyrics(effectiveTrackId, lyrics, p.id);
              return lyrics;
            } else {
              log.status = 'plain_lyrics_found';
              log.hasPlain = true;
              if (!fallbackPlainLyrics) {
                fallbackPlainLyrics = lyrics;
                fallbackProvenance = p.id;
              }
              // Do NOT stop; continue exhausting subsequent active providers in search of synchronized lyrics!
            }
          } else {
            if (log.status === 'checking') {
              log.status = 'no_matching_lyrics';
            }
          }
        } catch (err: unknown) {
          log.latencyMs = Date.now() - startTime;
          const errMsg = err instanceof Error ? err.message : String(err);
          log.status = 'provider_failed';
          log.error = errMsg;
          context.lastTransientError = err instanceof Error ? err : new Error(errMsg);
        }
      }

      // Return legitimate plain lyrics only as a clearly identified last fallback when no timed lyrics can be obtained
      if (fallbackPlainLyrics) {
        context.sourceProvenance = fallbackProvenance;
        await indexedDbService.saveLyrics(effectiveTrackId, fallbackPlainLyrics, fallbackProvenance);
        return fallbackPlainLyrics;
      }

      // All supported providers exhausted without finding lyrics
      context.exhausted = true;
      if (!context.authoritativeChecked && context.lastTransientError) {
        throw new Error(`Transient provider failure: ${context.lastTransientError.message}`);
      }

      return null;
    })();

    this.inFlightFetches.set(effectiveTrackId, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightFetches.delete(effectiveTrackId);
    }
  }

  /**
   * Step 2: Query LRCLIB exact /api/get
   * Strictly single lookup using clean title and primary artist, with provider-wide cooldown and zero aggressive retry.
   */
  /**
   * Query lrc.red public open synchronized lyrics repository
   */
  public async queryLrcRed(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;
    try {
      const primaryArtist = extractPrimaryArtist(cleanArtist);
      const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
      const queries = [`${cleanTitle} ${cleanArtist}`.trim()];
      if (primaryArtist && primaryArtist !== cleanArtist) {
        queries.push(`${cleanTitle} ${primaryArtist}`.trim());
      }
      if (titleWords.length > 1) {
        queries.push(`${titleWords[0]} ${primaryArtist || cleanArtist}`.trim());
      }

      for (const q of queries) {
        const searchUrl = `https://lrc.red/search.json?q=${encodeURIComponent(q)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)', Accept: 'application/json' },
          signal: AbortSignal.timeout(4000)
        });
        if (!searchRes.ok) continue;
        const data: { hits?: Array<{ isrc?: string; title?: string; artist?: string; duration?: number }> } = await searchRes.json();
        if (!Array.isArray(data.hits) || data.hits.length === 0) continue;

        const validHit = data.hits.find((h) => {
          if (!h.isrc || !h.title) return false;
          return isCandidateValidMatch(cleanTitle, cleanArtist, h.title, h.artist || '', originalLanguage).isMatch;
        });
        if (!validHit || !validHit.isrc) continue;

        const lrcUrl = `https://lrc.red/s/${encodeURIComponent(validHit.isrc)}.lrc`;
        const lrcRes = await fetch(lrcUrl, {
          headers: { 'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)' },
          signal: AbortSignal.timeout(4000)
        });
        if (!lrcRes.ok) continue;
        const rawLrc = await lrcRes.text();
        if (!rawLrc || !rawLrc.trim()) continue;

        if (originalLanguage && !isLyricsCompatibleWithTarget(rawLrc, originalLanguage)) {
          continue;
        }

        const lines = this.parseLrc(rawLrc, duration || validHit.duration || 180);
        if (lines.length === 0) continue;

        return this.buildSongLyricsFromLines(lines, originalLanguage);
      }
      return null;
    } catch (err: unknown) {
      if (context) {
        context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      }
      return null;
    }
  }

  /**
   * Query KuGou open candidate search and LRC download
   */
  public async queryKuGouLyrics(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;
    try {
      const keyword = `${cleanTitle} ${cleanArtist}`.trim();
      const searchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=${encodeURIComponent(keyword)}`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'KuGou/10.0.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return null;
      const data: { candidates?: Array<{ id: string; accesskey: string; song: string; singer: string }> } = await res.json();
      if (!Array.isArray(data.candidates) || data.candidates.length === 0) return null;

      const validCand = data.candidates.find((c) => {
        return isCandidateValidMatch(cleanTitle, cleanArtist, c.song, c.singer, originalLanguage).isMatch;
      });
      if (!validCand) return null;

      const dlUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${encodeURIComponent(validCand.id)}&accesskey=${encodeURIComponent(validCand.accesskey)}&fmt=lrc&charset=utf8`;
      const dlRes = await fetch(dlUrl, { signal: AbortSignal.timeout(4000) });
      if (!dlRes.ok) return null;
      const dlData: { status?: number; content?: string } = await dlRes.json();
      if (!dlData.content) return null;

      const rawLrc = typeof globalThis !== 'undefined' && (globalThis as any).Buffer
        ? (globalThis as any).Buffer.from(dlData.content, 'base64').toString('utf8')
        : atob(dlData.content);
      if (!rawLrc || !rawLrc.trim()) return null;

      if (originalLanguage && !isLyricsCompatibleWithTarget(rawLrc, originalLanguage)) {
        return null;
      }

      const lines = this.parseLrc(rawLrc, duration || 180);
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
   * Query YouTube timed text captions provider
   */
  public async queryYouTubeCaptions(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    // Requires a bound YouTube video ID; returns null gracefully when not available
    return null;
  }

  /**
   * Query YouTube Music transcript provider
   */
  public async queryYouTubeMusic(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query SimpMusic community lyrics service
   */
  public async querySimpMusic(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query PaxSenix lyrics proxy API
   */
  public async queryPaxSenix(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    try {
      const q = `${cleanTitle} ${cleanArtist}`.trim();
      const res = await fetch(`https://api.paxsenix.org/lyrics/search?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.status === 401 || res.status === 403) {
        if (context) context.lastTransientError = new Error('PaxSenix requires configured API token');
        return null;
      }
      if (!res.ok) return null;
      const data: any = await res.json();
      if (!data?.lyrics) return null;
      if (originalLanguage && !isLyricsCompatibleWithTarget(data.lyrics, originalLanguage)) return null;
      const lines = this.parseLrc(data.lyrics, duration || 180);
      return this.buildSongLyricsFromLines(lines, originalLanguage);
    } catch (err: unknown) {
      if (context) context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      return null;
    }
  }

  /**
   * Query BetterLyrics provider
   */
  public async queryBetterLyrics(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query LyricsPlus community provider
   */
  public async queryLyricsPlus(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query BiniLyrics Asian pop lyrics repository
   */
  public async queryBiniLyrics(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query Unison synchronized lyrics protocol
   */
  public async queryUnison(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query Megalobiz community LRC service
   */
  public async queryMegalobiz(
    cleanTitle: string,
    cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    try {
      const q = `${cleanTitle} ${cleanArtist}`.trim();
      const res = await fetch(`https://www.megalobiz.com/search/all?qry=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.status === 410) {
        if (context) context.lastTransientError = new Error('Megalobiz endpoint deprecated (HTTP 410)');
        return null;
      }
      return null;
    } catch (err: unknown) {
      if (context) context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      return null;
    }
  }

  /**
   * Query Genius search API for plain lyrics fallback
   */
  public async queryGenius(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    _context?: ProviderContext
  ): Promise<SongLyrics | null> {
    return null;
  }

  /**
   * Query Musixmatch licensed provider (verifies token/terms)
   */
  public async queryMusixmatch(
    _cleanTitle: string,
    _cleanArtist: string,
    _duration?: number,
    _originalLanguage?: Language,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (context) {
      context.lastTransientError = new Error('Musixmatch requires commercial user token');
    }
    return null;
  }

  public async queryLrclibExact(
    cleanTitle: string,
    cleanArtist: string,
    duration?: number,
    originalLanguage?: Language,
    primaryArtist?: string,
    context?: ProviderContext
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    if (this.isLrclibInCooldown()) {
      if (context) {
        context.lastTransientError = new Error(`LRCLIB in cooldown for next ${Math.ceil(this.getLrclibCooldownRemainingMs() / 1000)}s`);
      }
      return null;
    }

    const headers = {
      'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)'
    };

    // Exactly one exact lookup using primary artist or clean artist
    const artist = primaryArtist || cleanArtist;

    try {
      const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`;
      const getRes = await fetch(exactUrl, { headers, signal: AbortSignal.timeout(6000) });

      // Handle 429 or 503: trigger provider-wide cooldown immediately, no rapid retry!
      if (getRes.status === 429 || getRes.status === 503) {
        const retryAfter = getRes.headers?.get ? getRes.headers.get('retry-after') : null;
        this.triggerLrclibCooldown(retryAfter);
        if (context) {
          context.lastTransientError = new Error(`LRCLIB exact returned HTTP ${getRes.status}`);
        }
        return null;
      }

      if (getRes.status === 200) {
        const record: LrclibRecord = await getRes.json();
        if (context) context.authoritativeChecked = true;
        if (record && (record.syncedLyrics || record.plainLyrics)) {
          const raw = record.syncedLyrics || record.plainLyrics || '';
          if (originalLanguage && !isLyricsCompatibleWithTarget(raw, originalLanguage)) {
            return null;
          }
          return this.buildSongLyricsFromRecord(record, duration || record.duration || 180, originalLanguage);
        }
      } else if (getRes.status === 404) {
        if (context) context.authoritativeChecked = true;
      } else if (getRes.status >= 500) {
        if (context) {
          context.lastTransientError = new Error(`LRCLIB exact returned HTTP ${getRes.status}`);
        }
      }
    } catch (err: unknown) {
      if (context) {
        context.lastTransientError = err instanceof Error ? err : new Error(String(err));
      }
    }

    return null;
  }

  /**
   * Step 3: Query LRCLIB search /api/search?q={query}.
   * Single targeted search fallback strictly with title and primary artist.
   * Strictly validates candidates against title/artist and respects cooldown without retrying.
   */
  public async queryLrclibSearch(
    cleanTitle: string,
    duration?: number,
    originalLanguage?: Language,
    artistHint?: string,
    context?: ProviderContext,
    _albumHint?: string
  ): Promise<SongLyrics | null> {
    if (!cleanTitle) return null;

    if (this.isLrclibInCooldown()) {
      if (context) {
        context.lastTransientError = new Error(`LRCLIB in cooldown for next ${Math.ceil(this.getLrclibCooldownRemainingMs() / 1000)}s`);
      }
      return null;
    }

    const headers = {
      'User-Agent': 'HyperMelo/1.0 (https://github.com/naro/hypermelo)'
    };

    // Exactly one targeted search query using title and primary artist
    const query = artistHint ? `${cleanTitle} ${artistHint}`.trim() : cleanTitle;

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

    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const searchRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(6000) });

      // Handle 429 and 503: trigger provider-wide cooldown immediately, no rapid retry!
      if (searchRes.status === 429 || searchRes.status === 503) {
        const retryAfter = searchRes.headers?.get ? searchRes.headers.get('retry-after') : null;
        this.triggerLrclibCooldown(retryAfter);
        if (context) {
          context.lastTransientError = new Error(`LRCLIB search returned HTTP ${searchRes.status}`);
        }
        return null;
      }

      if (searchRes.status >= 500) {
        if (context) {
          context.lastTransientError = new Error(`LRCLIB search returned HTTP ${searchRes.status}`);
        }
        return null;
      }

      if (!searchRes.ok) return null;

      const candidates: LrclibRecord[] = await searchRes.json();
      if (context) context.authoritativeChecked = true;
      if (!Array.isArray(candidates) || candidates.length === 0) return null;

      const withLyrics = candidates.filter((c) => c.syncedLyrics || c.plainLyrics);
      if (withLyrics.length === 0) return null;

      // Strictly validate each candidate against target title, artist, and language compatibility
      const validCandidates: { record: LrclibRecord; score: number }[] = [];
      for (const c of withLyrics) {
        const raw = c.syncedLyrics || c.plainLyrics || '';
        if (originalLanguage && !isLyricsCompatibleWithTarget(raw, originalLanguage)) {
          continue;
        }
        const evalRes = isCandidateValidMatch(cleanTitle, artistHint || '', c.trackName, c.artistName, originalLanguage);
        if (evalRes.isMatch) {
          validCandidates.push({ record: c, score: evalRes.score });
        }
      }

      if (validCandidates.length === 0) return null;

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

          return isCandidateValidMatch(cleanTitle, cleanArtist, candTitle, candArtist, originalLanguage).isMatch;
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

      if (originalLanguage && !isLyricsCompatibleWithTarget(cleanHtml, originalLanguage)) {
        return null;
      }

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

    if (Date.now() < this.netEaseCooldownUntil) {
      if (context?.providerLogs?.['netease']) {
        context.providerLogs['netease'].status = 'provider_failed';
        context.providerLogs['netease'].error = 'NetEase upstream connection unavailable (circuit breaker cooldown active)';
      }
      return null;
    }

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
        signal: AbortSignal.timeout(4000)
      });

      if (searchRes.status === 403 || searchRes.status >= 500) {
        this.netEaseCooldownUntil = Date.now() + 5 * 60 * 1000;
        if (context) {
          context.lastTransientError = new Error(`NetEase search returned HTTP ${searchRes.status}`);
          if (context.providerLogs?.['netease']) {
            context.providerLogs['netease'].status = 'provider_failed';
            context.providerLogs['netease'].error = `NetEase upstream service unavailable (HTTP ${searchRes.status})`;
          }
        }
        return null;
      }

      if (searchRes.status === 429) {
        this.netEaseCooldownUntil = Date.now() + 60 * 1000;
        if (context) {
          context.lastTransientError = new Error(`NetEase search rate limited (HTTP 429)`);
          if (context.providerLogs?.['netease']) {
            context.providerLogs['netease'].status = 'provider_failed';
            context.providerLogs['netease'].error = 'NetEase rate limited (HTTP 429)';
          }
        }
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
        return isCandidateValidMatch(cleanTitle, cleanArtist, s.name, candArtist, originalLanguage).isMatch;
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
        signal: AbortSignal.timeout(4000)
      });

      if (lyrRes.status === 403 || lyrRes.status >= 500) {
        this.netEaseCooldownUntil = Date.now() + 5 * 60 * 1000;
        if (context) {
          context.lastTransientError = new Error(`NetEase lyric fetch returned HTTP ${lyrRes.status}`);
          if (context.providerLogs?.['netease']) {
            context.providerLogs['netease'].status = 'provider_failed';
            context.providerLogs['netease'].error = `NetEase lyric fetch returned HTTP ${lyrRes.status}`;
          }
        }
        return null;
      }

      if (!lyrRes.ok) return null;
      const lyrData: { lrc?: { lyric?: string } } = await lyrRes.json();
      const rawLrc = lyrData.lrc?.lyric;
      if (!rawLrc || typeof rawLrc !== 'string') return null;

      if (originalLanguage && !isLyricsCompatibleWithTarget(rawLrc, originalLanguage)) {
        return null;
      }

      const approxDuration = duration || (candidate.duration ? candidate.duration / 1000 : 180);
      const lines = this.parseLrc(rawLrc, approxDuration);
      if (lines.length === 0) return null;

      return this.buildSongLyricsFromLines(lines, originalLanguage);
    } catch (err: unknown) {
      this.netEaseCooldownUntil = Date.now() + 5 * 60 * 1000;
      if (context) {
        context.lastTransientError = err instanceof Error ? err : new Error(String(err));
        if (context.providerLogs?.['netease']) {
          context.providerLogs['netease'].status = 'provider_failed';
          context.providerLogs['netease'].error = `NetEase connection error: ${err instanceof Error ? err.message : String(err)}`;
        }
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
    originalLanguage?: Language
  ): SongLyrics | null {
    if (!lines || lines.length === 0) return null;

    const fullText = lines.map((l) => l.text).join(' \n ');
    if (originalLanguage && !isLyricsCompatibleWithTarget(fullText, originalLanguage)) {
      return null;
    }

    const middleIdx = Math.floor(lines.length / 2);
    const chorusSnippet = lines[middleIdx]?.text || lines[0]?.text || '';

    // Step 1: Detect actual source language from parsed lines (script-first, text-first)
    const detectedSource = detectLyricLinesLanguage(lines);
    let detectedLang: Language = sourceLanguageToDefaultDisplay(detectedSource);

    // If lyrics are in Latin script (transliterated) and target song has an explicit Indic language,
    // honor target originalLanguage rather than falsely labeling Romanized regional lyrics as English!
    if (detectedLang === 'en' && originalLanguage && originalLanguage !== 'en') {
      detectedLang = originalLanguage;
    }

    // Reject conflicting language: never accept detectedLang that conflicts with originalLanguage
    if (
      originalLanguage &&
      originalLanguage !== 'en' &&
      detectedLang !== 'en' &&
      detectedLang !== originalLanguage
    ) {
      return null;
    }

    // Attach detected language to each line's translations dictionary strictly when validated
    lines.forEach((l) => {
      if (!l.translations) l.translations = {};
      if (validateScriptForLanguage(l.text, detectedLang)) {
        l.translations[detectedLang] = l.text;
      } else if (detectedLang === 'en') {
        l.translations['en'] = l.text;
      }
      if (['te', 'ta', 'hi', 'ml'].includes(detectedLang) && isLatinScript(l.text)) {
        if (!l.karaoke) {
          l.karaoke = { native: '', transliteration: l.text };
        } else {
          l.karaoke.transliteration = l.text;
        }
      }
      l.original_language = detectedLang;
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
