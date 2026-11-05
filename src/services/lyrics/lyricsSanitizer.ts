// Metadata Sanitizer for NARO Lyrics Engine
// Strips movie tags, features, and descriptors before making lyrics API requests

export interface SanitizedLyricsMetadata {
  cleanTitle: string;
  cleanArtist: string;
  primaryArtist: string;
  originalTitle: string;
  originalArtist: string;
}

/**
 * Unescape common HTML entities found in catalog metadata and API responses
 */
export function unescapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

/**
 * Sanitize track title for lyrics search.
 * Strips movie tags (From "..."), features (feat. ...), and descriptors [Remix], [Lyrical].
 */
export function sanitizeTrackTitle(rawTitle: string): string {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let title = unescapeHtml(rawTitle).trim();

  // 1. Strip Movie tags: (From "..."), [From '...'], - From "...", (Original Motion Picture Soundtrack), (OST)
  title = title.replace(
    /\s*[\(\[\{]\s*(?:from\s+["'‘“].*?["'’”]|from\s+.*?|original\s+motion\s+picture\s+soundtrack|soundtrack|ost)\s*[\)\]\}]/gi,
    ' '
  );
  title = title.replace(/\s*-\s*from\s+["'‘“].*?["'’”].*$/gi, ' ');
  title = title.replace(/\s*-\s*from\s+[^-\(\[]+.*$/gi, ' ');
  title = title.replace(/\s*-\s*original\s+motion\s+picture\s+soundtrack.*$/gi, ' ');

  // 2. Strip Features: (feat. DaBaby), [ft. ...], (featuring ...), (with ...)
  title = title.replace(
    /\s*[\(\[\{]\s*(?:feat\.?|ft\.?|featuring|with)\s+.*?[\)\]\}]/gi,
    ' '
  );
  title = title.replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/gi, ' ');

  // 3. Strip Descriptors: [Remix], [Lyrical], [Official Video], [Audio], [Slowed + Reverb], [Piano Version], etc.
  title = title.replace(
    /\s*[\(\[\{]\s*(?:remix(?:ed)?(?:\s+by\s+.*?)?|club\s+mix|dance\s+mix|lyrical(?:\s+video)?|lyric\s+video|official(?:\s+(?:music\s+video|video|audio|visualizer))?|audio|video|full(?:\s+(?:video\s+song|video|song))?|slowed(?:\s*[\+&]\s*reverb)?|sped\s+up|acoustic(?:\s+version)?|unplugged|live(?:\s+at\s+.*?)?|radio\s+edit|single\s+version|album\s+version|lo-?fi(?:\s+flip)?|deluxe(?:\s+edition)?|bonus\s+track|teaser|4k(?:\s+ultra\s+hd)?|hd|version|piano\s+version|orchestral\s+version|first\s+(?:love\s+song|single|track)|promo(?:\s+song)?|title\s+track|female\s+version|male\s+version|duet\s+version|sad\s+version|reprise(?:\s+version)?|extended(?:\s+version)?|original\s+version)\s*[\)\]\}]/gi,
    ' '
  );

  // 4. Strip Remastered notices and trailing catalog metadata: e.g. "- Remastered 2011", "(2024 Remaster)", "- 2015 Remaster"
  title = title.replace(
    /\s*[\(\[\{]\s*(?:remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster(?:ed)?)\s*[\)\]\}]/gi,
    ' '
  );
  title = title.replace(
    /\s*-\s*(?:remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster|bonus\s+track|mono|stereo).*/gi,
    ' '
  );

  // 5. Strip trailing regional and language release tags: e.g. "- TELUGU", "- Tamil", "(Telugu)", "(Tamil)", "- Hindi", etc.
  title = title.replace(
    /\s*[-–—]\s*(?:telugu|tamil|hindi|malayalam|kannada|punjabi|bengali|english|marathi|gujarati|bhojpuri)(?:\s+version)?\s*$/gi,
    ' '
  );
  title = title.replace(
    /\s*[\(\[\{]\s*(?:telugu|tamil|hindi|malayalam|kannada|punjabi|bengali|english|marathi|gujarati|bhojpuri)(?:\s+version)?\s*[\)\]\}]/gi,
    ' '
  );

  // 6. Clean extra spaces, punctuation, trailing hyphens/colons, and repeated dots/ellipses
  title = title
    .replace(/\.{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-_:]+$/g, '')
    .trim();

  return title;
}

/**
 * Sanitize artist name by removing parenthetical metadata and trailing features
 */
export function sanitizeArtistName(rawArtist: string): string {
  if (!rawArtist || typeof rawArtist !== 'string') return '';
  let artist = unescapeHtml(rawArtist).trim();

  // Remove parenthetical notes
  artist = artist.replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ');

  // Remove trailing features
  artist = artist.replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/gi, ' ');

  return artist.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extract the primary/first artist from a multi-artist credit list
 */
export function extractPrimaryArtist(rawArtist: string): string {
  if (!rawArtist) return '';
  const clean = sanitizeArtistName(rawArtist);

  // Split on delimiters: comma, slash, semicolon, ampersand, plus, feat, with, and, vs, x
  const parts = clean.split(/[,/;&+]|\b(?:feat\.?|ft\.?|featuring|with|and|vs\.?|x)\b/i);
  return (parts[0] || '').trim();
}

/**
 * Generate fully sanitized lyrics metadata bundle for provider requests
 */
export function sanitizeLyricsMetadata(title: string, artist = ''): SanitizedLyricsMetadata {
  const cleanTitle = sanitizeTrackTitle(title);
  const cleanArtist = sanitizeArtistName(artist);
  const primaryArtist = extractPrimaryArtist(artist);

  return {
    cleanTitle,
    cleanArtist,
    primaryArtist,
    originalTitle: title,
    originalArtist: artist
  };
}
