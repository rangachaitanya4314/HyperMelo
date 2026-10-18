// Indic Script Transliteration Engine for HyperMelo
// Supports Telugu, Devanagari (Hindi), Tamil, and Malayalam to Romanized text.
// Preserves original native lyrics in Native Script mode,
// and produces accurate phonetically-romanized lyrics for Roman Transliteration mode.

export interface ScriptMap {
  vowels: Record<string, string>;
  matras: Record<string, string>;
  consonants: Record<string, string>;
  virama: string;
  anusvara: string[];
  visarga: string[];
  special?: Record<string, string>;
}

// 1. TELUGU SCRIPT MAPPING (U+0C00 - U+0C7F)
export const TELUGU_MAP: ScriptMap = {
  vowels: {
    '\u0C05': 'a', '\u0C06': 'aa', '\u0C07': 'i', '\u0C08': 'ee',
    '\u0C09': 'u', '\u0C0A': 'oo', '\u0C0B': 'ru', '\u0C60': 'roo',
    '\u0C0E': 'e', '\u0C0F': 'ee', '\u0C10': 'ai',
    '\u0C12': 'o', '\u0C13': 'oo', '\u0C14': 'au'
  },
  matras: {
    '\u0C3E': 'aa', '\u0C3F': 'i', '\u0C40': 'ee',
    '\u0C41': 'u', '\u0C42': 'oo', '\u0C43': 'ru', '\u0C44': 'roo',
    '\u0C46': 'e', '\u0C47': 'ee', '\u0C48': 'ai',
    '\u0C4A': 'o', '\u0C4B': 'oo', '\u0C4C': 'au'
  },
  consonants: {
    '\u0C15': 'k', '\u0C16': 'kh', '\u0C17': 'g', '\u0C18': 'gh', '\u0C19': 'ng',
    '\u0C1A': 'ch', '\u0C1B': 'chh', '\u0C1C': 'j', '\u0C1D': 'jh', '\u0C1E': 'ny',
    '\u0C1F': 't', '\u0C20': 'th', '\u0C21': 'd', '\u0C22': 'dh', '\u0C23': 'n',
    '\u0C24': 't', '\u0C25': 'th', '\u0C26': 'd', '\u0C27': 'dh', '\u0C28': 'n',
    '\u0C2A': 'p', '\u0C2B': 'ph', '\u0C2C': 'b', '\u0C2D': 'bh', '\u0C2E': 'm',
    '\u0C2F': 'y', '\u0C30': 'r', '\u0C31': 'r', '\u0C32': 'l', '\u0C33': 'l',
    '\u0C35': 'v', '\u0C36': 'sh', '\u0C37': 'sh', '\u0C38': 's', '\u0C39': 'h'
  },
  virama: '\u0C4D',
  anusvara: ['\u0C02', '\u0C01'],
  visarga: ['\u0C03']
};

// 2. DEVANAGARI SCRIPT MAPPING (U+0900 - U+097F)
export const DEVANAGARI_MAP: ScriptMap = {
  vowels: {
    '\u0905': 'a', '\u0906': 'aa', '\u0907': 'i', '\u0908': 'ee',
    '\u0909': 'u', '\u090A': 'oo', '\u090B': 'ri', '\u0960': 'ree',
    '\u090E': 'e', '\u090F': 'e', '\u0910': 'ai',
    '\u0912': 'o', '\u0913': 'o', '\u0914': 'au'
  },
  matras: {
    '\u093E': 'aa', '\u093F': 'i', '\u0940': 'ee',
    '\u0941': 'u', '\u0942': 'oo', '\u0943': 'ri', '\u0944': 'ree',
    '\u0946': 'e', '\u0947': 'e', '\u0948': 'ai',
    '\u094A': 'o', '\u094B': 'o', '\u094C': 'au'
  },
  consonants: {
    '\u0915': 'k', '\u0916': 'kh', '\u0917': 'g', '\u0918': 'gh', '\u0919': 'ng',
    '\u091A': 'ch', '\u091B': 'chh', '\u091C': 'j', '\u091D': 'jh', '\u091E': 'ny',
    '\u091F': 't', '\u0920': 'th', '\u0921': 'd', '\u0922': 'dh', '\u0923': 'n',
    '\u0924': 't', '\u0925': 'th', '\u0926': 'd', '\u0927': 'dh', '\u0928': 'n',
    '\u092A': 'p', '\u092B': 'ph', '\u092C': 'b', '\u092D': 'bh', '\u092E': 'm',
    '\u092F': 'y', '\u0930': 'r', '\u0932': 'l', '\u0933': 'l',
    '\u0935': 'v', '\u0936': 'sh', '\u0937': 'sh', '\u0938': 's', '\u0939': 'h',
    '\u0958': 'q', '\u0959': 'kh', '\u095A': 'g', '\u095B': 'z', '\u095C': 'd', '\u095D': 'dh', '\u095E': 'f'
  },
  virama: '\u094D',
  anusvara: ['\u0902', '\u0901'],
  visarga: ['\u0903']
};

// 3. TAMIL SCRIPT MAPPING (U+0B80 - U+0BFF)
export const TAMIL_MAP: ScriptMap = {
  vowels: {
    '\u0B85': 'a', '\u0B86': 'aa', '\u0B87': 'i', '\u0B88': 'ee',
    '\u0B89': 'u', '\u0B8A': 'oo',
    '\u0B8E': 'e', '\u0B8F': 'ee', '\u0B90': 'ai',
    '\u0B92': 'o', '\u0B93': 'oo', '\u0B94': 'au'
  },
  matras: {
    '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee',
    '\u0BC1': 'u', '\u0BC2': 'oo',
    '\u0BC6': 'e', '\u0BC7': 'ee', '\u0BC8': 'ai',
    '\u0BCA': 'o', '\u0BCB': 'oo', '\u0BCC': 'au'
  },
  consonants: {
    '\u0B95': 'k', '\u0B99': 'ng', '\u0B9A': 'ch', '\u0B9E': 'ny',
    '\u0B9F': 't', '\u0BA3': 'n', '\u0BA4': 'th', '\u0BA8': 'n',
    '\u0BAA': 'p', '\u0BAE': 'm', '\u0BAF': 'y', '\u0BB0': 'r',
    '\u0BB1': 'r', '\u0BB2': 'l', '\u0BB3': 'l', '\u0BB4': 'zh',
    '\u0BB5': 'v', '\u0BB6': 'sh', '\u0BB7': 'sh', '\u0BB8': 's',
    '\u0BB9': 'h', '\u0BA9': 'n', '\u0B9C': 'j'
  },
  virama: '\u0BCD',
  anusvara: ['\u0B82'],
  visarga: ['\u0B83']
};

// 4. MALAYALAM SCRIPT MAPPING (U+0D00 - U+0D7F)
export const MALAYALAM_MAP: ScriptMap = {
  vowels: {
    '\u0D05': 'a', '\u0D06': 'aa', '\u0D07': 'i', '\u0D08': 'ee',
    '\u0D09': 'u', '\u0D0A': 'oo', '\u0D0B': 'ru', '\u0D60': 'roo',
    '\u0D0E': 'e', '\u0D0F': 'ee', '\u0D10': 'ai',
    '\u0D12': 'o', '\u0D13': 'oo', '\u0D14': 'au'
  },
  matras: {
    '\u0D3E': 'aa', '\u0D3F': 'i', '\u0D40': 'ee',
    '\u0D41': 'u', '\u0D42': 'oo', '\u0D43': 'ru', '\u0D44': 'roo',
    '\u0D46': 'e', '\u0D47': 'ee', '\u0D48': 'ai',
    '\u0D4A': 'o', '\u0D4B': 'oo', '\u0D4C': 'au'
  },
  consonants: {
    '\u0D15': 'k', '\u0D16': 'kh', '\u0D17': 'g', '\u0D18': 'gh', '\u0D19': 'ng',
    '\u0D1A': 'ch', '\u0D1B': 'chh', '\u0D1C': 'j', '\u0D1D': 'jh', '\u0D1E': 'ny',
    '\u0D1F': 't', '\u0D20': 'th', '\u0D21': 'd', '\u0D22': 'dh', '\u0D23': 'n',
    '\u0D24': 'th', '\u0D25': 'th', '\u0D26': 'd', '\u0D27': 'dh', '\u0D28': 'n',
    '\u0D2A': 'p', '\u0D2B': 'ph', '\u0D2C': 'b', '\u0D2D': 'bh', '\u0D2E': 'm',
    '\u0D2F': 'y', '\u0D30': 'r', '\u0D31': 'r', '\u0D32': 'l', '\u0D33': 'l',
    '\u0D34': 'zh', '\u0D35': 'v', '\u0D36': 'sh', '\u0D37': 'sh', '\u0D38': 's',
    '\u0D39': 'h'
  },
  special: {
    '\u0D7A': 'n', '\u0D7B': 'n', '\u0D7C': 'r', '\u0D7D': 'l', '\u0D7E': 'l', '\u0D7F': 'k'
  },
  virama: '\u0D4D',
  anusvara: ['\u0D02'],
  visarga: ['\u0D03']
};

/**
 * Nasal assimilation for anusvara based on following consonant
 */
function getAnusvaraSound(nextChar: string, map: ScriptMap): string {
  if (!nextChar) return 'm';
  const c = map.consonants[nextChar];
  if (!c) return 'm';
  // Labials: p, ph, b, bh, m -> 'm'
  if (['p', 'ph', 'b', 'bh', 'm'].includes(c)) return 'm';
  // Dental / alveolar / velar -> 'n'
  return 'n';
}

/**
 * Transliterates text written in a specific Indic script to Roman characters
 */
function transliterateScript(text: string, map: ScriptMap, lang: string): string {
  let out = '';
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    // 1. Independent Vowel
    if (map.vowels[char]) {
      out += map.vowels[char];
      continue;
    }

    // 2. Special characters (e.g. Malayalam chillu letters)
    if (map.special && map.special[char]) {
      out += map.special[char];
      continue;
    }

    // 3. Consonants
    if (map.consonants[char]) {
      const base = map.consonants[char];

      if (nextChar === map.virama) {
        // Pure consonant without vowel
        out += base;
        i++; // skip virama
      } else if (map.matras[nextChar]) {
        // Consonant + dependent vowel
        out += base + map.matras[nextChar];
        i++; // skip matra
      } else {
        // Inherent vowel
        // In Hindi/Devanagari, word-final consonant drops inherent 'a' (schwa deletion)
        const isWordEnd = !nextChar || /[\s\p{P}]/u.test(nextChar);
        if (lang === 'hi' && isWordEnd && base.length > 0 && out.length > 0) {
          out += base;
        } else {
          out += base + 'a';
        }
      }
      continue;
    }

    // 4. Modifiers: Anusvara
    if (map.anusvara.includes(char)) {
      out += getAnusvaraSound(nextChar, map);
      continue;
    }
    // Visarga
    if (map.visarga.includes(char)) {
      out += 'h';
      continue;
    }

    // 5. Standalone matra fallback
    if (map.matras[char]) {
      out += map.matras[char];
      continue;
    }

    // 6. Latin characters, punctuation, whitespace (passthrough)
    out += char;
  }

  // Capitalize first non-whitespace character of line for clean presentation
  if (out.length > 0) {
    const trimmedIndex = out.search(/\S/);
    if (trimmedIndex >= 0) {
      out = out.slice(0, trimmedIndex) + out[trimmedIndex].toUpperCase() + out.slice(trimmedIndex + 1);
    }
  }

  return out;
}

// In-memory cache for transliterations
const transliterationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

/**
 * Checks if a string contains any supported Indic script characters
 */
export function canTransliterate(text: string): boolean {
  if (!text || !text.trim()) return false;
  return /[\u0C00-\u0C7F\u0900-\u097F\u0B80-\u0BFF\u0D00-\u0D7F]/.test(text);
}

/**
 * Checks if text is predominantly Latin characters, punctuation, digits and whitespace
 */
export function isLatinScript(text: string): boolean {
  if (!text || !text.trim()) return false;
  // If no non-Latin Unicode script blocks (like Indic, Han, Arabic, Cyrillic)
  return !/[^\u0020-\u024F\u2000-\u206F\u2070-\u218F\s\p{P}\p{N}]/u.test(text);
}

/**
 * High-performance, language-aware phonetic transliteration engine.
 * Converts Telugu, Devanagari (Hindi), Tamil, and Malayalam scripts into Roman pronunciation.
 * Handles mixed scripts, punctuation, Latin-script originals, and whitespace cleanly.
 */
export function transliterateText(text: string, langHint?: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Check cache first
  const cacheKey = `${langHint || 'auto'}:${text}`;
  const cached = transliterationCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let result = text;

  // Detect script and perform conversion
  if (/[\u0C00-\u0C7F]/.test(text) || langHint === 'te') {
    result = transliterateScript(text, TELUGU_MAP, 'te');
  } else if (/[\u0900-\u097F]/.test(text) || langHint === 'hi') {
    result = transliterateScript(text, DEVANAGARI_MAP, 'hi');
  } else if (/[\u0B80-\u0BFF]/.test(text) || langHint === 'ta') {
    result = transliterateScript(text, TAMIL_MAP, 'ta');
  } else if (/[\u0D00-\u0D7F]/.test(text) || langHint === 'ml') {
    result = transliterateScript(text, MALAYALAM_MAP, 'ml');
  } else if (isLatinScript(text)) {
    // Pure Latin is already romanized
    result = text;
  }

  // Manage cache capacity
  if (transliterationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = transliterationCache.keys().next().value;
    if (firstKey) transliterationCache.delete(firstKey);
  }
  transliterationCache.set(cacheKey, result);

  return result;
}

/**
 * Transliterates an array of lyric lines, preserving timestamps and lyric structure
 */
export function transliterateLyricLines<T extends { text: string }>(
  lines: T[],
  langHint?: string
): (T & { transliteratedText: string })[] {
  return lines.map((line) => ({
    ...line,
    transliteratedText: transliterateText(line.text, langHint)
  }));
}
