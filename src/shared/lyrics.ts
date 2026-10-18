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

export type KaraokeScriptMode = 'native' | 'transliteration';

export interface KaraokeLineTrack {
  native: string;
  transliteration?: string;
}

/**
 * Authoritative canonical synchronized lyric line.
 * Guaranteed single timeline across all languages with segment ID and timestamp invariance.
 * Supports dual-mode: Karaoke (native script vs Roman transliteration) and Listening (original + meaning).
 */
export interface TimedLyricLine {
  id?: string;
  startTime?: number; // canonical sync start time in seconds
  endTime?: number;   // canonical sync end time in seconds
  start_ms?: number;  // millisecond start timestamp if provided
  end_ms?: number;    // millisecond end timestamp if provided
  text: string;
  translations?: Record<string, string>;
  time?: number;      // legacy start time in seconds (backward compatibility)
  duration?: number;  // legacy duration in seconds (backward compatibility)
  words?: LyricWord[];

  // Vocal pace & dynamic highlight timing
  pace?: number;
  paceCategory?: 'fast' | 'moderate' | 'slow';
  wipeTransition?: string;
  wipeDuration?: string;
  wipeTimingFunction?: string;

  // Dual-mode contracts: one source of truth
  original_language?: Language | string;
  karaoke?: KaraokeLineTrack;
  listening_meaning?: Record<string, string>;
}

/**
 * Consolidated canonical alias: TimedLyricLine is the sole authoritative representation.
 * Eliminates duplicate competing models between LyricLine and TimedLyricLine.
 */
export type LyricLine = TimedLyricLine;

import { transliterateText, canTransliterate, isLatinScript } from '../services/lyrics/transliterationService';
import { validateScriptForLanguage } from '../services/lyrics/translationService';

/**
 * Resolves the primary singing lyric line for Karaoke Mode.
 * NEVER returns translated lyrics.
 * If preference is 'transliteration':
 * - Uses valid provider-supplied transliteration if present.
 * - Generates language-aware transliteration for supported scripts (Telugu, Devanagari, Tamil, Malayalam).
 * - Recognizes Latin-script originals as already Romanized.
 * - If transliteration is unsupported, gracefully falls back to native script with isAvailable: false.
 * Native Script mode preserves original lyric text exactly.
 */
export function getKaraokeLyricLine(
  line: TimedLyricLine | undefined | null,
  preference: KaraokeScriptMode = 'native'
): { text: string; isTransliteration: boolean; isAvailable: boolean; nativeText: string } {
  if (!line) return { text: '', isTransliteration: false, isAvailable: false, nativeText: '' };

  const native = (line.karaoke?.native || line.text || '').trim();
  const translit = line.karaoke?.transliteration?.trim();

  if (preference === 'transliteration') {
    // 1. Valid provider-supplied or pre-cached transliteration
    if (translit && translit.length > 0) {
      return { text: translit, isTransliteration: true, isAvailable: true, nativeText: native };
    }

    // 2. Language-aware transliteration for supported Indic scripts
    if (native && canTransliterate(native)) {
      const generated = transliterateText(native, line.original_language as string);
      if (generated && generated.length > 0) {
        return { text: generated, isTransliteration: true, isAvailable: true, nativeText: native };
      }
    }

    // 3. Latin-script originals: already in Roman script
    if (native && isLatinScript(native)) {
      return { text: native, isTransliteration: true, isAvailable: true, nativeText: native };
    }

    // 4. Honest unavailable state for unsupported non-Latin scripts - fall back to native script
    return { text: native, isTransliteration: false, isAvailable: false, nativeText: native };
  }

  // Native Script mode preserves the original lyrics exactly
  return { text: native, isTransliteration: false, isAvailable: true, nativeText: native };
}

/**
 * Resolves the primary and secondary lines for Listening Mode.
 * Primary: The original lyric line in its native script.
 * Secondary: The contextual/poetic meaning in the selected language.
 */
export function getListeningLyricDisplay(
  line: TimedLyricLine | undefined | null,
  meaningLang: Language = 'en',
  songOriginalLang?: string
): {
  originalText: string;
  meaningText: string;
  isMeaningAvailable: boolean;
  isSameAsOriginal: boolean;
} {
  if (!line) {
    return { originalText: '', meaningText: '', isMeaningAvailable: false, isSameAsOriginal: false };
  }

  const originalText = (line.karaoke?.native || line.text || '').trim();
  const effectiveOriginalLang = (line.original_language || songOriginalLang || detectLanguage(originalText)) as string;
  const isSameAsOriginal = meaningLang === effectiveOriginalLang;

  // Check listening_meaning first, then fallback to translations
  let meaning = line.listening_meaning?.[meaningLang]?.trim();
  if (!meaning && line.translations?.[meaningLang]) {
    meaning = line.translations[meaningLang].trim();
  }

  if (meaning && meaning.length > 0) {
    return {
      originalText,
      meaningText: meaning,
      isMeaningAvailable: true,
      isSameAsOriginal
    };
  }

  // If the user selected the original language and no secondary translation needed
  if (isSameAsOriginal) {
    return {
      originalText,
      meaningText: originalText,
      isMeaningAvailable: true,
      isSameAsOriginal: true
    };
  }

  // Meaning is genuinely unavailable for this language
  const languageNames: Record<Language, string> = {
    en: 'English',
    hi: 'Hindi',
    te: 'Telugu',
    ta: 'Tamil',
    ml: 'Malayalam'
  };
  const langName = languageNames[meaningLang] || String(meaningLang).toUpperCase();

  return {
    originalText,
    meaningText: `Meaning unavailable in ${langName}`,
    isMeaningAvailable: false,
    isSameAsOriginal: false
  };
}

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

export type LyricRepresentationType = 'original' | 'transliteration' | 'translation';

export interface VerifiedLyricRepresentation {
  id: string; // 'original' | 'transliteration' | `translation-${string}`
  type: LyricRepresentationType;
  langCode: string;
  label: string; // e.g. "Original (తెలుగు)", "Roman Transliteration", "English Meaning"
  shortLabel: string; // e.g. "తెలుగు", "Roman", "EN"
  isSinging: boolean; // true for singing lyrics (original, transliteration); false for meaning (translation)
  description: string;
}

export interface LyricExcerptResult {
  text: string;
  isAvailable: boolean;
  type: LyricRepresentationType;
  categoryLabel: string;
  secondaryText?: string;
  accessibleLabel: string;
}

/**
 * Returns human-readable label and native script label for a language code.
 */
export function getLanguageDisplayName(code: string): { code: string; label: string; nativeLabel: string } {
  const normalized = (code || '').toLowerCase().trim();
  const known: Record<string, { label: string; nativeLabel: string }> = {
    en: { label: 'English', nativeLabel: 'English' },
    hi: { label: 'Hindi', nativeLabel: 'हिन्दी' },
    te: { label: 'Telugu', nativeLabel: 'తెలుగు' },
    ta: { label: 'Tamil', nativeLabel: 'தமிழ்' },
    ml: { label: 'Malayalam', nativeLabel: 'മലയാളം' },
    pa: { label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
    kn: { label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
    bn: { label: 'Bengali', nativeLabel: 'বাংলা' },
    mr: { label: 'Marathi', nativeLabel: 'मराठी' },
    gu: { label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
    ur: { label: 'Urdu', nativeLabel: 'اردو' }
  };
  if (known[normalized]) {
    return { code: normalized, ...known[normalized] };
  }
  return { code: normalized, label: code ? code.toUpperCase() : 'Unknown', nativeLabel: code ? code.toUpperCase() : 'Unknown' };
}

/**
 * Calculates the verified available lyric representations for a song.
 * Guaranteed rules:
 * - Never implies lyrics exist in every application language.
 * - Prioritizes original native-script lyrics for singing.
 * - Offers Roman transliteration only when the original is non-Latin and transliteration is reliably available.
 * - Offers translation/meaning options ONLY when actual verified translation data exists for that song.
 * - Clearly marks translations as meaning (not sung words).
 * - Returns empty array if song has no verified lyrics.
 */
export function getAvailableLyricRepresentations(
  song: { id?: string; originalLanguage?: string; language?: string; lyrics?: SongLyrics; lyricsAvailable?: boolean; title?: string } | null | undefined,
  lines?: TimedLyricLine[]
): VerifiedLyricRepresentation[] {
  if (!song) return [];
  if (song.lyricsAvailable === false && (!lines || lines.length === 0)) return [];

  // If explicit lines were provided, use them. Otherwise, check song.lyrics
  let candidateLines: TimedLyricLine[] = lines || [];
  if (candidateLines.length === 0 && song.lyrics) {
    const knownKeys = ['te', 'ta', 'hi', 'ml', 'en', 'pa', ...Object.keys(song.lyrics)];
    for (const key of knownKeys) {
      const b = song.lyrics[key];
      if (b && Array.isArray(b.lines) && b.lines.length > 0) {
        candidateLines = b.lines;
        break;
      }
    }
  }

  if (!candidateLines || candidateLines.length === 0) {
    return [];
  }

  const firstLine = candidateLines[0];
  const nativeSample = (firstLine.karaoke?.native || firstLine.text || '').trim();
  if (!nativeSample) return [];

  const detectedFromText = detectLanguage(nativeSample);
  const originalLang = (firstLine.original_language || song.originalLanguage || (song.language && song.language !== 'en' ? song.language : undefined) || detectedFromText || 'en') as string;
  const langMeta = getLanguageDisplayName(originalLang);

  const reps: VerifiedLyricRepresentation[] = [];

  // 1. Original Native Script Singing Lyrics (always present if lines exist)
  reps.push({
    id: 'original',
    type: 'original',
    langCode: originalLang,
    label: langMeta.label === 'English' ? 'Original (English)' : `Original (${langMeta.nativeLabel})`,
    shortLabel: langMeta.label === 'English' ? 'EN' : langMeta.nativeLabel,
    isSinging: true,
    description: `Original sung lyrics in ${langMeta.label} (${langMeta.nativeLabel})`
  });

  // 2. Roman Transliteration Singing Guide
  // Only offer Roman transliteration if:
  // a) The original lyrics are NOT in Latin script
  // b) Roman transliteration is reliably available
  const isOriginalLatin = isLatinScript(nativeSample);
  if (!isOriginalLatin) {
    const translitCheck = getKaraokeLyricLine(firstLine, 'transliteration');
    if (translitCheck.isAvailable && translitCheck.isTransliteration && translitCheck.text !== nativeSample) {
      reps.push({
        id: 'transliteration',
        type: 'transliteration',
        langCode: originalLang,
        label: 'Roman Transliteration',
        shortLabel: 'Roman Script',
        isSinging: true,
        description: 'Phonetic Roman alphabet singing guide'
      });
    }
  }

  // 3. Verified Translations (Meaning)
  // Only list languages with actual verified meaning/translation data for this song.
  for (const target of SUPPORTED_LANGUAGES) {
    if (target.code === originalLang) continue;

    const hasVerifiedTranslation = candidateLines.some((l) => {
      let t = l.listening_meaning?.[target.code]?.trim();
      if (!t && l.translations?.[target.code]) {
        t = l.translations[target.code].trim();
      }
      if (!t || t.length === 0) return false;
      if (t === 'Translation unavailable' || t === 'Lyrics unavailable') return false;
      const native = (l.karaoke?.native || l.text || '').trim();
      if (t === native && target.code !== originalLang) return false;
      return validateScriptForLanguage(t, target.code, originalLang);
    });

    if (hasVerifiedTranslation) {
      reps.push({
        id: `translation-${target.code}`,
        type: 'translation',
        langCode: target.code,
        label: `${target.label} Meaning`,
        shortLabel: target.code === 'en' ? 'EN Meaning' : `${target.nativeLabel} (Meaning)`,
        isSinging: false,
        description: `Verified ${target.label} (${target.nativeLabel}) translation for understanding (not sung)`
      });
    }
  }

  return reps;
}

/**
 * Resolves the excerpt text, accessible label, and visual metadata for a moment line
 * according to the selected representation.
 */
export function getLyricRepresentationText(
  line: TimedLyricLine | null | undefined,
  rep: VerifiedLyricRepresentation | null | undefined,
  songOriginalLang?: string
): LyricExcerptResult {
  if (!line || !line.text) {
    return {
      text: 'Lyrics unavailable for this track',
      isAvailable: false,
      type: 'original',
      categoryLabel: 'LYRICS UNAVAILABLE',
      accessibleLabel: 'Lyrics unavailable for this track'
    };
  }

  const native = (line.karaoke?.native || line.text || '').trim();
  const effectiveOriginalLang = (line.original_language || songOriginalLang || detectLanguage(native)) as string;
  const langMeta = getLanguageDisplayName(effectiveOriginalLang);

  if (!rep || rep.type === 'original') {
    let secondary: string | undefined;
    const translitLine = getKaraokeLyricLine(line, 'transliteration');
    if (translitLine.isAvailable && translitLine.isTransliteration && translitLine.text !== native) {
      secondary = `Phonetic guide: ${translitLine.text}`;
    }

    return {
      text: native,
      isAvailable: true,
      type: 'original',
      categoryLabel: `SINGING LYRICS • ORIGINAL (${langMeta.label.toUpperCase()})`,
      secondaryText: secondary,
      accessibleLabel: `Original ${langMeta.label} singing lyrics: ${native}`
    };
  }

  if (rep.type === 'transliteration') {
    const kLine = getKaraokeLyricLine(line, 'transliteration');
    return {
      text: kLine.text,
      isAvailable: kLine.isAvailable,
      type: 'transliteration',
      categoryLabel: 'SINGING GUIDE • ROMAN TRANSLITERATION',
      secondaryText: `Original (${langMeta.nativeLabel}): ${native}`,
      accessibleLabel: `Roman transliteration singing guide: ${kLine.text}`
    };
  }

  if (rep.type === 'translation') {
    const targetLang = rep.langCode as Language;
    const targetMeta = getLanguageDisplayName(targetLang);
    const lDisplay = getListeningLyricDisplay(line, targetLang, effectiveOriginalLang);
    return {
      text: lDisplay.meaningText,
      isAvailable: lDisplay.isMeaningAvailable,
      type: 'translation',
      categoryLabel: `SONG MEANING • ${targetMeta.label.toUpperCase()} TRANSLATION (NOT SUNG)`,
      secondaryText: `Original singing lyrics: ${native}`,
      accessibleLabel: `${targetMeta.label} translated meaning: ${lDisplay.meaningText}. Original singing lyrics: ${native}`
    };
  }

  return {
    text: native,
    isAvailable: true,
    type: 'original',
    categoryLabel: `SINGING LYRICS • ORIGINAL (${langMeta.label.toUpperCase()})`,
    accessibleLabel: `Original singing lyrics: ${native}`
  };
}

