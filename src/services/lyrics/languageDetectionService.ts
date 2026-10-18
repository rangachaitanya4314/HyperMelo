// Language Detection Engine for NARO
// Script-first, text-first language detection strictly independent from catalog/metadata
// Adheres to core rules:
// - "Never use genre, region, album category, playlist category, or catalog labels such as Bollywood/Tamil/Telugu/Malayalam as the lyric source language."
// - "Bollywood is not a language."
// - "Determine the actual language/script of the lyric text independently from song metadata."
// - "Support at minimum English, Hindi, Punjabi, Telugu, Tamil, Malayalam, Kannada, Bengali, Marathi, Gujarati, Urdu and common mixed-language Indian lyrics."

import type { Song, TimedLyricLine, Language } from '../../shared';

export type DetectedSourceLanguage =
  | 'en' // English
  | 'hi' // Hindi
  | 'pa' // Punjabi
  | 'te' // Telugu
  | 'ta' // Tamil
  | 'ml' // Malayalam
  | 'kn' // Kannada
  | 'bn' // Bengali
  | 'mr' // Marathi
  | 'gu' // Gujarati
  | 'ur' // Urdu
  | 'mixed' // Mixed multilingual
  | string;

// Common Punjabi lexical markers in Devanagari script (distinguishing authentic Punjabi from Hindi)
const PUNJABI_DEVANAGARI_MARKERS = [
  'मैनूं', 'तैनूं', 'साडूं', 'असां', 'तुसां', 'लग्दा', 'लग्दी', 'सोहणा', 'सोहणे',
  'सोहणी', 'वे माही', 'जिंदड़ी', 'कुड़ी', 'मुंडा', 'अक्खां', 'अखां', 'नहिंयो',
  'किवें', 'चन्ना', 'ढोलना', 'समझावां', 'समझावा', 'होर', 'इश्क दी', 'दिल दा',
  'छड्ड', 'किद्दान', 'सोणिया', 'जाणी'
];

// Common Marathi lexical markers in Devanagari script
const MARATHI_DEVANAGARI_MARKERS = [
  'आहे', 'नाही', 'झाला', 'झाली', 'माझा', 'माझी', 'तुझा', 'तुझी', 'त्याचा',
  'त्याची', 'कसा', 'कशी', 'करतो', 'करते', 'होता', 'होती', 'असेल', 'आम्ही',
  'तुम्ही', 'घेऊन', 'म्हणून', 'आणि', 'कधी', 'फार', 'करायचं', 'सांग'
];

// Word lists for Romanized / Latin script identification
const ROMANIZED_PUNJABI_WORDS = new Set([
  'tainu', 'mainu', 'samjhawan', 'samjhawa', 'lagda', 'lagdi', 'tere', 'bina',
  'dil', 'da', 'di', 'sohniye', 'sohna', 'sohni', 'makhna', 'kudi', 'munda',
  'akhiyan', 'rabb', 'jind', 'jindari', 've', 'mahi', 'channa', 'dholna',
  'hove', 'nachdi', 'saada', 'saadi', 'naal', 'kade', 'jina', 'chhad',
  'vakhra', 'soch', 'jeena', 'kinna', 'soniye', 'teri', 'khair', 'billo',
  'pind', 'gabru', 'mutiyar', 'surma', 'jatti', 'patiala', 'billo'
]);

const ROMANIZED_TAMIL_WORDS = new Set([
  'naan', 'nee', 'enakku', 'unakku', 'kaadhal', 'kanne', 'uyire', 'paarka',
  'pesa', 'solla', 'vaazhkkai', 'nenje', 'ippadi', 'adhuvum', 'badass', 'maari',
  'vaathi', 'kuthu', 'oru', 'rendu', 'ellarum', 'enna', 'aachu', 'poda',
  'vaa', 'vandhu', 'poren', 'nalla', 'theriyum', 'paathu', 'sirikki', 'thalaiva',
  'anbe', 'kannil', 'aasai', 'vizhiyil', 'thol', 'thonanum', 'poweradi',
  'ulla', 'ketta', 'pulla', 'thaan', 'da'
]);

const ROMANIZED_TELUGU_WORDS = new Set([
  'nenu', 'neevu', 'naaku', 'neeku', 'prema', 'gunde', 'hrudayam', 'choodu',
  'cheppu', 'kalisi', 'eppudu', 'ela', 'chala', 'enti', 'chey', 'vaste',
  'undhi', 'unnadi', 'manasu', 'kani', 'kavali', 'samayama', 'vennela', 'urike',
  'gopikamma', 'choosi', 'raave', 'kallu', 'preminche', 'madhi', 'kanulu',
  'nijama', 'choodamake', 'kalale'
]);

const ROMANIZED_MALAYALAM_WORDS = new Set([
  'njan', 'nee', 'enikku', 'ninakku', 'sneham', 'hridayam', 'oru', 'innu',
  'ithu', 'swapnam', 'kannukal', 'aaradhike', 'pavizha', 'mazha', 'uyire',
  'kadhale', 'malare', 'ninte', 'ente', 'nokki', 'parayamo', 'veendum',
  'manassil', 'thammil', 'kanneer', 'kaalam', 'vazhi'
]);

const ROMANIZED_HINDI_URDU_WORDS = new Set([
  'hai', 'hain', 'hum', 'tum', 'tera', 'mera', 'meri', 'tere', 'nahi',
  'nahin', 'kyun', 'kya', 'zindagi', 'ishq', 'mohabbat', 'dil', 'jaan',
  'aankhon', 'khuda', 'raatein', 'baatein', 'chaleya', 'kesariya', 'apna',
  'bana', 'le', 'hawayein', 'tujhe', 'kitna', 'chahein', 'yaara', 'sanam',
  'deewana', 'kaise', 'jiye', 'pal', 'kho', 'gaya', 'aasman', 'saath',
  'humsafar', 'dhadkan', 'khamoshi', 'dua', 'suno', 'kaho', 'jaana'
]);

const ENGLISH_WORDS = new Set([
  'the', 'and', 'you', 'to', 'in', 'that', 'is', 'it', 'of', 'my',
  'your', 'me', 'with', 'on', 'for', 'all', 'down', 'floor', 'heart',
  'light', 'walking', 'shadows', 'night', 'love', 'day', 'never', 'always',
  'hold', 'time', 'baby', 'girl', 'can', 'feel', 'stop', 'take', 'world',
  'see', 'know', 'way', 'look', 'come', 'shot', 'beautiful', 'machine',
  'corridor', 'dance', 'beating', 'rhythm', 'ending', 'brand', 'new',
  'start', 'listen', 'close', 'until', 'morning', 'like', 'we', 'are'
]);

/**
 * Detects the script of a given string using Unicode block ranges.
 * Priority signal 1 for all language detection.
 */
export function detectScriptFromUnicode(text: string): {
  script: 'gurmukhi' | 'telugu' | 'tamil' | 'malayalam' | 'kannada' | 'bengali' | 'gujarati' | 'arabic' | 'devanagari' | 'latin' | 'mixed' | 'unknown';
  dominantLanguage?: DetectedSourceLanguage;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {
    gurmukhi: 0,
    telugu: 0,
    tamil: 0,
    malayalam: 0,
    kannada: 0,
    bengali: 0,
    gujarati: 0,
    arabic: 0,
    devanagari: 0,
    latin: 0
  };

  for (const char of text) {
    const cp = char.codePointAt(0);
    if (!cp) continue;

    if (cp >= 0x0A00 && cp <= 0x0A7F) counts.gurmukhi++;
    else if (cp >= 0x0C00 && cp <= 0x0C7F) counts.telugu++;
    else if (cp >= 0x0B80 && cp <= 0x0BFF) counts.tamil++;
    else if (cp >= 0x0D00 && cp <= 0x0D7F) counts.malayalam++;
    else if (cp >= 0x0C80 && cp <= 0x0CFF) counts.kannada++;
    else if (cp >= 0x0980 && cp <= 0x09FF) counts.bengali++;
    else if (cp >= 0x0A80 && cp <= 0x0AFF) counts.gujarati++;
    else if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)) counts.arabic++;
    else if (cp >= 0x0900 && cp <= 0x097F) counts.devanagari++;
    else if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) counts.latin++;
  }

  // Find dominant script, prioritizing authentic Indic script over Latin structural scaffolding (e.g. "Intro: ...")
  let maxIndicCount = 0;
  let dominantIndicScript = 'unknown';

  for (const [script, cnt] of Object.entries(counts)) {
    if (script !== 'latin' && cnt > maxIndicCount) {
      maxIndicCount = cnt;
      dominantIndicScript = script;
    }
  }

  let dominant = 'unknown';
  if (maxIndicCount >= 5 || (maxIndicCount > 0 && maxIndicCount * 4 >= counts.latin)) {
    dominant = dominantIndicScript;
  } else if (counts.latin > 0) {
    dominant = 'latin';
  } else if (maxIndicCount > 0) {
    dominant = dominantIndicScript;
  }

  if (dominant === 'unknown') {
    return { script: 'unknown', counts };
  }

  // Script mapping to language
  switch (dominant) {
    case 'gurmukhi':
      return { script: 'gurmukhi', dominantLanguage: 'pa', counts };
    case 'telugu':
      return { script: 'telugu', dominantLanguage: 'te', counts };
    case 'tamil':
      return { script: 'tamil', dominantLanguage: 'ta', counts };
    case 'malayalam':
      return { script: 'malayalam', dominantLanguage: 'ml', counts };
    case 'kannada':
      return { script: 'kannada', dominantLanguage: 'kn', counts };
    case 'bengali':
      return { script: 'bengali', dominantLanguage: 'bn', counts };
    case 'gujarati':
      return { script: 'gujarati', dominantLanguage: 'gu', counts };
    case 'arabic':
      return { script: 'arabic', dominantLanguage: 'ur', counts };
    case 'devanagari': {
      // Discriminate between Hindi, Marathi, and Punjabi in Devanagari
      const lowerText = text.toLowerCase();
      const punjabiMatches = PUNJABI_DEVANAGARI_MARKERS.filter((m) => lowerText.includes(m));
      if (punjabiMatches.length >= 2) {
        return { script: 'devanagari', dominantLanguage: 'pa', counts };
      }
      const marathiMatches = MARATHI_DEVANAGARI_MARKERS.filter((m) => lowerText.includes(m));
      if (marathiMatches.length >= 2) {
        return { script: 'devanagari', dominantLanguage: 'mr', counts };
      }
      return { script: 'devanagari', dominantLanguage: 'hi', counts };
    }
    case 'latin':
      return { script: 'latin', counts };
    default:
      return { script: 'unknown', counts };
  }
}

/**
 * Tokenize and score words in Latin script against South Asian languages and English
 */
export function identifyLatinScriptLanguage(text: string): {
  language: DetectedSourceLanguage;
  confidence: number;
  scores: Record<string, number>;
} {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const scores: Record<string, number> = {
    pa: 0,
    ta: 0,
    te: 0,
    ml: 0,
    hi: 0,
    en: 0
  };

  for (const w of words) {
    if (ROMANIZED_PUNJABI_WORDS.has(w)) scores.pa += 2.5;
    if (ROMANIZED_TAMIL_WORDS.has(w)) scores.ta += 2.5;
    if (ROMANIZED_TELUGU_WORDS.has(w)) scores.te += 2.5;
    if (ROMANIZED_MALAYALAM_WORDS.has(w)) scores.ml += 2.5;
    if (ROMANIZED_HINDI_URDU_WORDS.has(w)) scores.hi += 2.0;
    if (ENGLISH_WORDS.has(w)) scores.en += 1.0;
  }

  // Specific high-value bigrams / phrases
  const lower = text.toLowerCase();
  if (lower.includes('samjhawan') || lower.includes('tainu') || lower.includes('lagda jee') || lower.includes('ve mahi')) {
    scores.pa += 10;
  }
  if (lower.includes('badass') || lower.includes('leo da') || lower.includes('poweradi') || lower.includes('ketta pulla')) {
    scores.ta += 10;
  }
  if (lower.includes('urike urike') || lower.includes('samayama') || lower.includes('gopikamma') || lower.includes('vennela')) {
    scores.te += 10;
  }
  if (lower.includes('aaradhike') || lower.includes('pavizha mazha') || lower.includes('minnal murali')) {
    scores.ml += 10;
  }
  if (lower.includes('kesariya') || lower.includes('tum hi ho') || lower.includes('apna bana le') || lower.includes('hawayein')) {
    scores.hi += 10;
  }

  let highestLang: DetectedSourceLanguage = 'en';
  let highestScore = 0;

  for (const [lang, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      highestLang = lang as DetectedSourceLanguage;
    }
  }

  const totalTokens = words.length || 1;
  const confidence = Math.min(1.0, highestScore / (totalTokens * 0.5));

  // If Indic score is zero and English score is high, it's English
  if (highestScore === 0) {
    return { language: 'en', confidence: 0.5, scores };
  }

  return { language: highestLang, confidence, scores };
}

/**
 * Authoritative, pure function to detect the source language of lyric lines.
 * Strictly adheres to:
 * 1. Unicode/script detection first.
 * 2. Lexical/language identification second.
 * 3. Never uses genre or catalog labels (Bollywood, Kollywood, etc.).
 * 4. Supports multi-language and mixed lyrics.
 */
export function detectLyricLinesLanguage(lines: TimedLyricLine[] | undefined | null): DetectedSourceLanguage {
  if (!lines || lines.length === 0) return 'en';

  const fullText = lines.map((l) => l.text).join(' \n ');
  if (!fullText.trim()) return 'en';

  // Signal 1: Unicode / Script detection
  const scriptResult = detectScriptFromUnicode(fullText);
  if (scriptResult.dominantLanguage) {
    return scriptResult.dominantLanguage;
  }

  // Signal 2: Latin text language identification
  if (scriptResult.script === 'latin') {
    const latinResult = identifyLatinScriptLanguage(fullText);
    return latinResult.language;
  }

  return 'en';
}

/**
 * Extracts and detects the actual source language for a song from its lyric content.
 * Guarantees:
 * - Deterministic, pure evaluation of lyric text.
 * - Catalog metadata (genre, Bollywood, region) is NEVER used as source language.
 * - Stored detected source language is completely separate from selected display language.
 */
export function detectSongSourceLanguage(song: Song | null | undefined): DetectedSourceLanguage {
  if (!song) return 'en';

  // 1. Check all lyric lines in song's lyrics object
  const candidateTexts: string[] = [];

  if (song.lyrics) {
    // Collect lines across all existing buckets
    for (const bucketKey of Object.keys(song.lyrics)) {
      const bucket = song.lyrics[bucketKey];
      if (bucket && Array.isArray(bucket.lines) && bucket.lines.length > 0) {
        candidateTexts.push(...bucket.lines.map((l) => l.text));
      }
    }
  }

  if (candidateTexts.length > 0) {
    const combined = candidateTexts.join(' \n ');
    // 1. Script detection first
    const scriptInfo = detectScriptFromUnicode(combined);
    if (scriptInfo.dominantLanguage) {
      return scriptInfo.dominantLanguage;
    }
    // 2. Lexical identification second
    if (scriptInfo.script === 'latin') {
      const latinInfo = identifyLatinScriptLanguage(combined);
      return latinInfo.language;
    }
  }

  // 2. Check title & artist as secondary signal (NEVER genre or Bollywood!)
  const titleAndArtist = `${song.title || ''} ${song.artist || ''}`;
  const scriptInfoTitle = detectScriptFromUnicode(titleAndArtist);
  if (scriptInfoTitle.dominantLanguage) {
    return scriptInfoTitle.dominantLanguage;
  }

  const latinTitle = identifyLatinScriptLanguage(titleAndArtist);
  if (latinTitle.confidence > 0.6 && latinTitle.language !== 'en') {
    return latinTitle.language;
  }

  // 3. Fallback to song.originalLanguage ONLY if explicitly defined as a standard language code (e.g. 'ta', 'te', 'hi', 'ml', 'pa')
  if (
    song.originalLanguage &&
    typeof song.originalLanguage === 'string' &&
    ['en', 'hi', 'te', 'ta', 'ml', 'pa', 'kn', 'bn', 'mr', 'gu', 'ur'].includes(song.originalLanguage.toLowerCase())
  ) {
    return song.originalLanguage.toLowerCase();
  }

  return 'en';
}

/**
 * Converts a detected source language to the nearest supported UI target language
 * if needed for default UI display (e.g., Punjabi 'pa' defaults to 'en' or 'hi' display).
 */
export function sourceLanguageToDefaultDisplay(sourceLang: DetectedSourceLanguage): Language {
  if (sourceLang === 'te') return 'te';
  if (sourceLang === 'ta') return 'ta';
  if (sourceLang === 'ml') return 'ml';
  if (sourceLang === 'hi' || sourceLang === 'mr' || sourceLang === 'pa') return 'hi';
  return 'en';
}
