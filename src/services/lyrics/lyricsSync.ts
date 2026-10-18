// Weighted Vocal Pace & Dynamic Highlight Timing Engine for NARO
// Authoritative syllable-based word timing fallback, line pace measurement,
// dynamic wipe transition styling, and Indic vowel-cluster syllable splitting.

import type { TimedLyricLine, LyricWord } from '../../shared/lyrics';
import { isLatinScript } from './transliterationService';

export type PaceCategory = 'fast' | 'moderate' | 'slow';

export interface PaceTransitionConfig {
  pace: number;
  category: PaceCategory;
  durationSeconds: number;
  durationCss: string;
  timingFunction: string;
  transitionCss: string;
}

export interface WordTimingOptions {
  /**
   * Weight multiplier for the final word of the line (giving extra duration to the phrase end).
   * Default: 1.5
   */
  finalWordWeight?: number;
  /**
   * Whether to split Indic words and transliterations into syllable vowel clusters
   * so the wipe matches the musical beat rather than treating multi-syllable compound words as single blocks.
   * Default: true
   */
  splitIndicSyllables?: boolean;
  /**
   * Minimum duration in seconds allocated to any word/syllable cluster.
   * Default: 0.05
   */
  minWordDuration?: number;
  /**
   * Language hint (e.g. 'te', 'hi', 'ta', 'ml', 'en', 'pa')
   */
  language?: string;
  /**
   * Explicitly treat as transliteration
   */
  isTransliteration?: boolean;
}

export interface HighlightTimingResult {
  line: TimedLyricLine;
  words: LyricWord[];
  pace: number;
  paceCategory: PaceCategory;
  transition: PaceTransitionConfig;
}

// Unicode ranges for Indic scripts:
// Devanagari (0900-097F), Bengali (0980-09FF), Gurmukhi (0A00-0A7F), Gujarati (0A80-0AFF),
// Odia (0B00-0B7F), Tamil (0B80-0BFF), Telugu (0C00-0C7F), Kannada (0C80-0CFF), Malayalam (0D00-0D7F)
const INDIC_SCRIPT_REGEX = /[\u0900-\u0D7F]/;

/**
 * Checks if the text contains any Indic Brahmic script characters.
 */
export function isIndicScript(text: string): boolean {
  if (!text) return false;
  return INDIC_SCRIPT_REGEX.test(text);
}

/**
 * Checks if Latin-script text represents an Indic transliteration.
 */
export function isIndicTransliteration(text: string, language?: string): boolean {
  if (!text) return false;
  if (isIndicScript(text)) return false;
  if (!isLatinScript(text)) return false;

  const normalizedLang = (language || '').toLowerCase().trim();
  if (normalizedLang === 'en') {
    return false;
  }

  // If language tag indicates an Indic tongue
  const indicLangs = new Set(['hi', 'te', 'ta', 'ml', 'pa', 'kn', 'bn', 'mr', 'gu', 'ur']);
  if (normalizedLang && indicLangs.has(normalizedLang)) {
    return true;
  }

  // Common English words check: if text contains clear English functional words, it's English
  const englishWordPattern = /\b(?:the|is|are|was|were|and|or|in|on|at|to|for|with|by|from|my|your|his|her|its|our|their|you|they|we|all|so|far|away|yesterday|troubles|seemed|walking|down|corridor|neon|shadow|light|night|morning|heart|world)\b/i;
  
  // Specific Indic transliterated words
  const indicTranslitWords = /\b(?:meri|tera|teri|mera|dil|hai|ho|hum|tum|aap|mein|tere|mere|kya|kyun|kyu|nahi|nahin|chala|chal|gaya|gaye|nannu|ninnu|neetho|naatho|prema|manasu|kannu|chupulu|kalisi|chesi|unna|unnadu|undi|leka|saami|chinna|pedda|pilla|kadha|raave|kaadhal|kanne|nenje|paattu|vaanam|uyire|ente|ninte|oru|ithu|aanu|njan|pyaar|ishq|mohabbat|zindagi|jaan|deewana|kesariya|kalasala|chinukula|lona|valenu|vayase|priyatama|samajavaragamana)\b/i;

  if (indicTranslitWords.test(text)) {
    return true;
  }

  if (englishWordPattern.test(text)) {
    return false;
  }

  // Characteristically Indic transliteration phonotactics without English words
  const indicPhonotactics = [
    /\b[b-df-hj-np-tv-z]+(?:aa|ee|ii|oo|uu)[b-df-hj-np-tv-z]*\b/i,
    /\b[a-z]*(?:bh|dh|gh|jh|kh|ph|zh|chh|rh)[a-z]*\b/i,
    /\b[a-z]*(?:ala|ulu|alu|ana|ani|odu|edi|ake|iki|loni)\b/i
  ];

  return indicPhonotactics.some((pattern) => pattern.test(text));
}

/**
 * Splits an Indic script word (e.g. Telugu, Hindi, Tamil, Malayalam) into
 * orthographic akshara syllables (consonant clusters with vowel matras and modifiers).
 */
export function splitIndicAksharas(word: string): string[] {
  if (!word) return [];
  const trimmed = word.trim();
  if (!trimmed) return [word];

  // Akshara matching regex:
  // Base akshara: (Consonant+Virama)* + Consonant + (Matra)? + (Anusvara/Visarga/Nukta)?
  // Followed optionally by coda: Consonant + Virama (e.g. Tamil pulli coda 'க்', 'ம்')
  const aksharaRegex = /(?:[\u0900-\u0D7F](?:[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D][\u0900-\u0D7F])*(?:[\u093E-\u094C\u0962-\u0963\u09BE-\u09CC\u0A3E-\u0A4C\u0ABE-\u0ACC\u0B3E-\u0B4C\u0BBE-\u0BCC\u0C3E-\u0C4C\u0CBE-\u0CCC\u0D3E-\u0D4C]?[\u0901-\u0903\u0981-\u0983\u0A01-\u0A03\u0A81-\u0A83\u0B01-\u0B03\u0B82\u0C01-\u0C03\u0C82-\u0C83\u0D02-\u0D03]*)?(?:[\u0900-\u0D7F][\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D](?![\u0900-\u0D7F]))?)/gu;

  const matches = trimmed.match(aksharaRegex);
  if (!matches || matches.length === 0) return [word];

  const result: string[] = [];
  let currentIdx = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const matchPos = trimmed.indexOf(m, currentIdx);
    if (matchPos > currentIdx && result.length > 0) {
      result[result.length - 1] += trimmed.slice(currentIdx, matchPos);
    }
    result.push(m);
    currentIdx = matchPos + m.length;
  }
  if (currentIdx < trimmed.length && result.length > 0) {
    result[result.length - 1] += trimmed.slice(currentIdx);
  }

  return result.length > 0 ? result : [word];
}

/**
 * Splits a Roman transliteration word along syllable vowel clusters so the wipe
 * matches the musical beat rather than treating multi-syllable compound words as single blocks.
 */
export function splitTransliterationSyllables(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [word];

  // Preserve trailing punctuation
  const punctMatch = clean.match(/([.,!?;:()"'`~]+)$/);
  const trailingPunct = punctMatch ? punctMatch[1] : '';
  const coreWord = trailingPunct ? clean.slice(0, -trailingPunct.length) : clean;

  if (coreWord.length <= 2) {
    return [word];
  }

  // Vowel cluster pattern for Indic transliterations:
  // Note: 'y' before a vowel (e.g. "ya", "ye", "yo", "yu") acts as an onset consonant glide, not a vowel nucleus.
  const vowelPattern = /(?:aa|ee|ii|oo|uu|ai|au|ou|ei|ia|[aeiou]|y(?![\s\p{P}]|[aeiou]))/giu;
  const vowelMatches: { start: number; end: number; vowel: string }[] = [];
  let vm: RegExpExecArray | null;
  while ((vm = vowelPattern.exec(coreWord)) !== null) {
    vowelMatches.push({ start: vm.index, end: vm.index + vm[0].length, vowel: vm[0] });
  }

  // If 0 or 1 vowel cluster, it's a single monosyllabic block
  if (vowelMatches.length <= 1) {
    return [word];
  }

  // Inseparable onset consonant clusters in Indic transliteration
  const onsetClusters = new Set([
    'pr', 'br', 'tr', 'dr', 'kr', 'gr', 'fr', 'vr',
    'pl', 'bl', 'cl', 'gl', 'fl',
    'ch', 'sh', 'th', 'dh', 'bh', 'gh', 'jh', 'kh', 'ph', 'rh', 'wh',
    'chh', 'zh',
    'sk', 'sp', 'st', 'sw', 'sv', 'sm', 'sn',
    'ny', 'my', 'ry', 'ly', 'ky', 'gy', 'ty', 'dy', 'py', 'by'
  ]);

  const splitIndices: number[] = [];

  for (let i = 0; i < vowelMatches.length - 1; i++) {
    const v1End = vowelMatches[i].end;
    const v2Start = vowelMatches[i + 1].start;
    const consonantSegment = coreWord.slice(v1End, v2Start);
    const len = consonantSegment.length;

    if (len === 0) {
      // Hiatus (two vowel clusters side-by-side, e.g. "pri-ya", "sa-i")
      splitIndices.push(v1End);
    } else if (len === 1) {
      // 1 consonant: CV rule (consonant goes to next syllable onset)
      splitIndices.push(v1End);
    } else if (len === 2) {
      const lower = consonantSegment.toLowerCase();
      if (onsetClusters.has(lower)) {
        // Inseparable onset cluster goes with next syllable
        splitIndices.push(v1End);
      } else {
        // Coda + Onset (e.g. "nan-nu", "dil-ba-ro")
        splitIndices.push(v1End + 1);
      }
    } else {
      // 3 or more consonants (e.g. "n-ch", "s-tr", "m-bhr")
      const lower = consonantSegment.toLowerCase();
      const last2 = lower.slice(-2);
      if (onsetClusters.has(last2)) {
        splitIndices.push(v1End + len - 2);
      } else {
        splitIndices.push(v1End + 1);
      }
    }
  }

  const chunks: string[] = [];
  let prev = 0;
  for (const s of splitIndices) {
    chunks.push(coreWord.slice(prev, s));
    prev = s;
  }
  chunks.push(coreWord.slice(prev) + trailingPunct);

  return chunks;
}

/**
 * Splits an Indic or transliterated word into syllable vowel clusters.
 */
export function splitIndicSyllables(word: string, isTranslit?: boolean): string[] {
  if (isIndicScript(word)) {
    return splitIndicAksharas(word);
  }
  if (isTranslit || isIndicTransliteration(word)) {
    return splitTransliterationSyllables(word);
  }
  return [word];
}

/**
 * Splits a word into syllable clusters based on language and script detection.
 */
export function splitWordIntoSyllableClusters(
  word: string,
  options?: { isIndic?: boolean; isTransliteration?: boolean; language?: string }
): string[] {
  if (!word || word.trim().length === 0) return [word];

  if (isIndicScript(word) || options?.isIndic) {
    return splitIndicAksharas(word);
  }

  if (
    options?.isTransliteration ||
    isIndicTransliteration(word, options?.language)
  ) {
    return splitTransliterationSyllables(word);
  }

  return [word];
}

/**
 * Counts syllables in a word.
 * Handles English phonetics, Indic aksharas, and transliterated vowel clusters.
 */
export function countSyllables(word: string, language?: string): number {
  if (!word) return 0;
  const clean = word.trim().toLowerCase().replace(/[.,!?;:()"'`~]/g, '');
  if (!clean) return 0;

  // 1. Indic Native Scripts: each akshara is one syllable
  if (isIndicScript(clean)) {
    const aksharas = splitIndicAksharas(clean);
    return Math.max(1, aksharas.length);
  }

  // 2. Indic Transliterations: count vowel clusters
  if (isIndicTransliteration(clean, language)) {
    const syllables = splitTransliterationSyllables(clean);
    return Math.max(1, syllables.length);
  }

  // 3. English / Latin phonetic heuristic
  if (clean.length <= 3) return 1;

  // Remove silent trailing 'e' (except '-le' preceded by consonant)
  let processed = clean;
  if (processed.endsWith('e') && !processed.endsWith('le') && !/(?:ee|oe|ye)$/.test(processed)) {
    processed = processed.slice(0, -1);
  }

  const vowelMatches = processed.match(/[aeiouy]+/g);
  const count = vowelMatches ? vowelMatches.length : 1;
  return Math.max(1, count);
}

/**
 * Counts total syllables across an entire line of lyric text.
 */
export function countLineSyllables(lineText: string, language?: string): number {
  if (!lineText) return 0;
  const words = lineText.trim().split(/\s+/).filter(Boolean);
  return words.reduce((total, word) => total + countSyllables(word, language), 0);
}

/**
 * Calculate Pace (Syllables Per Second):
 * Measure line pace: syllables / (lineEnd - lineStart).
 * 
 * @param syllables Total syllable count in the line
 * @param lineStart Start timestamp in seconds
 * @param lineEnd End timestamp in seconds
 * @returns Syllables per second (pace)
 */
export function calculateLinePace(syllables: number, lineStart: number, lineEnd: number): number {
  const duration = Math.max(0.1, lineEnd - lineStart);
  if (syllables <= 0) return 0;
  const pace = syllables / duration;
  return Math.round(pace * 1000) / 1000;
}

/**
 * Measures line pace directly from a TimedLyricLine.
 */
export function measureLinePace(
  line: { text: string; startTime?: number; endTime?: number; time?: number; duration?: number },
  language?: string
): number {
  const lineStart = line.startTime !== undefined && line.startTime >= 0
    ? line.startTime
    : (line.time !== undefined && line.time >= 0 ? line.time : 0);

  const lineEnd = line.endTime !== undefined && line.endTime > lineStart
    ? line.endTime
    : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : lineStart + 3.0);

  const syllables = countLineSyllables(line.text, language);
  return calculateLinePace(syllables, lineStart, lineEnd);
}

/**
 * Dynamic Highlight Timing & Transition configuration based on line pace:
 * 
 * - If pace is fast (> 4.5/s), make CSS wipe transition instantaneous (0.05s).
 * - If pace is slow (< 2.5/s), smooth out the transition curve using cubic-bezier(0.2, 0.8, 0.2, 1).
 * - Moderate pace (2.5 - 4.5/s): natural responsive transition (0.2s cubic-bezier(0.16, 1, 0.3, 1)).
 */
export function getPaceTransition(pace: number): PaceTransitionConfig {
  if (pace > 4.5) {
    // Fast pace (> 4.5/s): instantaneous CSS wipe transition
    return {
      pace,
      category: 'fast',
      durationSeconds: 0.05,
      durationCss: '0.05s',
      timingFunction: 'linear',
      transitionCss: 'all 0.05s linear'
    };
  }

  if (pace < 2.5) {
    // Slow pace (< 2.5/s): smooth out the transition curve
    return {
      pace,
      category: 'slow',
      durationSeconds: 0.35,
      durationCss: '0.35s',
      timingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      transitionCss: 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
    };
  }

  // Moderate pace: balanced responsive transition
  return {
    pace,
    category: 'moderate',
    durationSeconds: 0.2,
    durationCss: '0.2s',
    timingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    transitionCss: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
  };
}

/**
 * Convenient alias returning CSS transition properties for dynamic lyric wipe.
 */
export function getWipeTransition(pace: number): {
  transition: string;
  duration: string;
  timingFunction: string;
  isInstantaneous: boolean;
  isSmooth: boolean;
} {
  const config = getPaceTransition(pace);
  return {
    transition: config.transitionCss,
    duration: config.durationCss,
    timingFunction: config.timingFunction,
    isInstantaneous: config.category === 'fast',
    isSmooth: config.category === 'slow'
  };
}

/**
 * Word Timing Fallback Function
 * 
 * If word-level timestamps are not present in the LRC payload:
 * 1. Calculates each word's duration based on syllable/vowel count and phrase position
 *    (giving extra weight to the final word of the line).
 * 2. For Indic scripts and transliterations: splits words along syllable vowel clusters
 *    so the wipe matches the musical beat rather than treating multi-syllable compound words as single blocks.
 * 3. Binds timestamps seamlessly within [lineStart, lineEnd].
 * 
 * If word-level timestamps ARE already present in the LRC payload, preserves them as authoritative.
 */
export function calculateWordTimingFallback(
  line: TimedLyricLine,
  options: WordTimingOptions = {}
): LyricWord[] {
  // If word-level timestamps are already present in the LRC payload, preserve them!
  if (line.words && line.words.length > 0 && typeof line.words[0].end === 'number' && line.words[0].end > 0) {
    return line.words;
  }

  const rawText = (line.karaoke?.native || line.text || '').trim();
  if (!rawText) return [];

  const lineStart = line.startTime !== undefined && line.startTime >= 0
    ? line.startTime
    : (line.time !== undefined && line.time >= 0 ? line.time : 0);

  const lineEnd = line.endTime !== undefined && line.endTime > lineStart
    ? line.endTime
    : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : lineStart + 3.5);

  const totalDuration = Math.max(0.1, lineEnd - lineStart);
  const finalWordWeight = options.finalWordWeight ?? 1.5;
  const shouldSplitIndic = options.splitIndicSyllables ?? true;
  const minDuration = options.minWordDuration ?? 0.05;

  const rawWords = rawText.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const isIndic = isIndicScript(rawText) || (options.language && isIndicScript(options.language));
  const isTranslit = Boolean(
    options.isTransliteration ||
    isIndicTransliteration(rawText, options.language || (line.original_language as string))
  );

  interface SyllableUnit {
    text: string;
    syllables: number;
    wordIndex: number;
    isFinalWord: boolean;
    weight: number;
  }

  const units: SyllableUnit[] = [];

  for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
    const word = rawWords[wIdx];
    const isFinalWord = wIdx === rawWords.length - 1;
    const phraseWeight = isFinalWord ? finalWordWeight : 1.0;

    if (shouldSplitIndic && (isIndic || isTranslit)) {
      // Split Indic script or transliterated word along syllable vowel clusters
      const clusters = isIndic
        ? splitIndicAksharas(word)
        : splitTransliterationSyllables(word);

      for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
        const cluster = clusters[cIdx];
        const sylCount = Math.max(1, countSyllables(cluster, options.language));
        units.push({
          text: cluster,
          syllables: sylCount,
          wordIndex: wIdx,
          isFinalWord,
          weight: sylCount * phraseWeight
        });
      }
    } else {
      // Standard word-level unit
      const sylCount = Math.max(1, countSyllables(word, options.language));
      units.push({
        text: word,
        syllables: sylCount,
        wordIndex: wIdx,
        isFinalWord,
        weight: sylCount * phraseWeight
      });
    }
  }

  if (units.length === 0) return [];

  const totalWeight = units.reduce((acc, u) => acc + u.weight, 0);
  const result: LyricWord[] = [];
  let currentStart = lineStart;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const isLast = i === units.length - 1;

    let duration: number;
    if (isLast) {
      duration = Math.max(minDuration, lineEnd - currentStart);
    } else {
      duration = Math.max(minDuration, totalDuration * (unit.weight / totalWeight));
    }

    const wordStart = Math.round(currentStart * 1000) / 1000;
    const wordEnd = isLast ? Math.round(lineEnd * 1000) / 1000 : Math.round((currentStart + duration) * 1000) / 1000;

    result.push({
      text: unit.text,
      start: wordStart,
      end: wordEnd
    });

    currentStart = wordEnd;
  }

  return result;
}

/**
 * Canonical aliases for word timing fallback
 */
export const wordTimingFallback = calculateWordTimingFallback;
export const getWordTimingFallback = calculateWordTimingFallback;
export const computeWordTimingsFallback = calculateWordTimingFallback;

/**
 * Applies word timing fallback and vocal pace measurement to a TimedLyricLine.
 * Enriches the line with words and pace metadata.
 */
export function applyWordTimingFallback(
  line: TimedLyricLine,
  options: WordTimingOptions = {}
): TimedLyricLine {
  const words = calculateWordTimingFallback(line, options);

  const lineStart = line.startTime !== undefined && line.startTime >= 0
    ? line.startTime
    : (line.time !== undefined && line.time >= 0 ? line.time : 0);

  const lineEnd = line.endTime !== undefined && line.endTime > lineStart
    ? line.endTime
    : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : lineStart + 3.5);

  const syllables = countLineSyllables(line.text, options.language);
  const pace = calculateLinePace(syllables, lineStart, lineEnd);
  const paceConfig = getPaceTransition(pace);

  return {
    ...line,
    words,
    pace,
    paceCategory: paceConfig.category,
    wipeTransition: paceConfig.transitionCss,
    wipeDuration: paceConfig.durationCss,
    wipeTimingFunction: paceConfig.timingFunction
  };
}

/**
 * Applies word timing fallback across an array of lines.
 */
export function applyWordTimingFallbackToLines(
  lines: TimedLyricLine[],
  options: WordTimingOptions = {}
): TimedLyricLine[] {
  if (!lines || lines.length === 0) return [];
  return lines.map((l) => applyWordTimingFallback(l, options));
}

/**
 * Computes dynamic highlight timing and active word/syllable progress for current playback time.
 */
export function getDynamicHighlightTiming(
  line: TimedLyricLine,
  currentTime: number,
  options: WordTimingOptions = {}
): HighlightTimingResult & {
  activeWordIndex: number;
  activeWord: LyricWord | null;
  lineProgress: number;
} {
  const enriched = applyWordTimingFallback(line, options);
  const words = enriched.words || [];

  const lineStart = enriched.startTime !== undefined && enriched.startTime >= 0
    ? enriched.startTime
    : (enriched.time !== undefined && enriched.time >= 0 ? enriched.time : 0);

  const lineEnd = enriched.endTime !== undefined && enriched.endTime > lineStart
    ? enriched.endTime
    : lineStart + (enriched.duration || 3.0);

  const lineDuration = Math.max(0.1, lineEnd - lineStart);
  const lineProgress = Math.min(1, Math.max(0, (currentTime - lineStart) / lineDuration));

  let activeWordIndex = -1;
  let activeWord: LyricWord | null = null;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (currentTime >= w.start && currentTime < w.end) {
      activeWordIndex = i;
      activeWord = w;
      break;
    }
  }

  const pace = enriched.pace || calculateLinePace(countLineSyllables(line.text, options.language), lineStart, lineEnd);
  const transition = getPaceTransition(pace);

  return {
    line: enriched,
    words,
    pace,
    paceCategory: transition.category,
    transition,
    activeWordIndex,
    activeWord,
    lineProgress
  };
}
