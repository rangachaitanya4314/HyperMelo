// Backend Playback Source Resolver for NARO
// Resolves genuine full-length playable audio streams for normal catalog songs
// Enforces strict recording identity, artist alignment, and language dub rejection
// Never silently substitutes an alternate-language dub (e.g. Tamil/Hindi dub for a Telugu track)

import type { Song } from '../../shared';
import { decryptDesEcb } from '../utils/des';

interface SaavnResult {
  id: string;
  title: string;
  subtitle?: string;
  header_desc?: string;
  language?: string;
  year?: string | number;
  more_info?: {
    encrypted_media_url?: string;
    duration?: string | number;
    '320kbps'?: string | boolean;
    singers?: string;
    music?: string;
    album?: string;
  };
}

const LANGUAGE_MAP: Record<string, string> = {
  te: 'telugu',
  ta: 'tamil',
  hi: 'hindi',
  ml: 'malayalam',
  kn: 'kannada',
  en: 'english',
  pa: 'punjabi',
  bn: 'bengali',
  mr: 'marathi',
  gu: 'gujarati'
};

const ALL_LANGUAGES = [
  'telugu',
  'tamil',
  'hindi',
  'malayalam',
  'kannada',
  'punjabi',
  'bengali',
  'marathi',
  'gujarati'
];

function unescapeHtml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export class PlaybackSourceResolver {
  private cache: Map<string, Song> = new Map();
  private readonly cipherKey = '38346591';

  private normalizeText(str: string): string {
    return unescapeHtml(str)
      .toLowerCase()
      .replace(/[[({].*?[)\]}]/g, '')
      .replace(/-\s*(telugu|tamil|hindi|kannada|malayalam|english|punjabi|bengali)/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  public getCandidateLanguage(r: SaavnResult): string | undefined {
    if (r.language && r.language.trim()) {
      const l = r.language.toLowerCase().trim();
      return LANGUAGE_MAP[l] || l;
    }
    const text = unescapeHtml(`${r.title} ${r.subtitle || ''} ${r.header_desc || ''} ${r.more_info?.album || ''}`).toLowerCase();
    for (const lang of ALL_LANGUAGES) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(text)) {
        return lang;
      }
    }
    return undefined;
  }

  public inferSongLanguage(song: Song): string | undefined {
    if (song.language && song.language.trim()) {
      const l = song.language.toLowerCase().trim();
      return LANGUAGE_MAP[l] || l;
    }
    const combinedMeta = unescapeHtml(`${song.title} ${song.album || ''}`).toLowerCase();
    for (const lang of ALL_LANGUAGES) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(combinedMeta)) {
        return lang;
      }
    }
    return undefined;
  }

  /**
   * Scores an audio candidate against the target track.
   * Returns a positive score for valid matches, or -1 to reject mismatched songs or alternate-language dubs.
   */
  public scoreCandidate(song: Song, r: SaavnResult): number {
    if (!r.more_info?.encrypted_media_url) return -1;

    const targetLang = this.inferSongLanguage(song);
    const candLang = this.getCandidateLanguage(r);

    // 1. Language Dub Rejection
    // If target language is specified, reject any candidate with an explicitly different language tag
    if (targetLang && candLang) {
      if (candLang !== targetLang) {
        return -1; // REJECT: Direct language mismatch (e.g. target is Telugu, candidate is Tamil)
      }
    }

    // Inspect candidate title, subtitle, header, and album text for explicit mentions of other languages
    const rawCandText = unescapeHtml(`${r.title} ${r.subtitle || ''} ${r.header_desc || ''} ${r.more_info?.album || ''}`).toLowerCase();
    if (targetLang && targetLang !== 'english') {
      const otherLangs = ALL_LANGUAGES.filter((l) => l !== targetLang);
      for (const other of otherLangs) {
        const regex = new RegExp(`\\b${other}\\b`, 'i');
        if (regex.test(rawCandText)) {
          return -1; // REJECT: Explicit mention of alternate language dub (e.g. "Devara Part 1 - Tamil")
        }
      }
    }

    // 2. Title Matching
    const cleanSongTitle = song.title.replace(/[[({].*?[)\]}]/g, '').trim();
    const normCleanSongTitle = this.normalizeText(cleanSongTitle);
    const cleanRTitle = unescapeHtml(r.title).replace(/[[({].*?[)\]}]/g, '').trim();
    const normCleanRTitle = this.normalizeText(cleanRTitle);
    const normFullRTitle = this.normalizeText(unescapeHtml(r.title));

    let titleScore = 0;
    if (normCleanRTitle === normCleanSongTitle || normFullRTitle === normCleanSongTitle) {
      titleScore = 100;
    } else if (
      normCleanRTitle.length >= 4 &&
      normCleanSongTitle.length >= 4 &&
      (normCleanRTitle.includes(normCleanSongTitle) || normCleanSongTitle.includes(normCleanRTitle))
    ) {
      titleScore = 75;
    } else {
      return -1; // REJECT: Title must align
    }

    // 3. Artist Matching
    const cleanArtist = song.artist.split('&')[0].split(',')[0].replace(/feat\..*/i, '').trim();
    const normSongArtist = this.normalizeText(cleanArtist);
    const rArtistInfo = this.normalizeText(
      `${r.subtitle || ''} ${r.header_desc || ''} ${r.more_info?.singers || ''} ${r.more_info?.music || ''}`
    );

    let artistScore = 0;
    if (normSongArtist.length >= 3) {
      if (rArtistInfo.includes(normSongArtist)) {
        artistScore = 50;
      } else if (normSongArtist.length >= 4 && rArtistInfo.includes(normSongArtist.slice(0, 4))) {
        artistScore = 30;
      } else {
        return -1; // REJECT: Artist must match
      }
    }

    let totalScore = titleScore + artistScore;

    // 4. Language Alignment Bonus
    if (targetLang && candLang === targetLang) {
      totalScore += 100;
    }
    if (targetLang && rawCandText.includes(targetLang)) {
      totalScore += 40;
    }

    // 5. Album Alignment
    if (song.album) {
      const normTargetAlbum = this.normalizeText(song.album);
      const candAlbum = this.normalizeText(r.more_info?.album || '');
      if (candAlbum && (candAlbum.includes(normTargetAlbum) || normTargetAlbum.includes(candAlbum))) {
        totalScore += 60;
      }
    }

    // 6. Duration Matching
    if (song.duration && r.more_info?.duration) {
      const rDur = parseInt(String(r.more_info.duration), 10);
      if (!isNaN(rDur) && rDur > 0) {
        const diff = Math.abs(rDur - song.duration);
        if (diff <= 3) totalScore += 30;
        else if (diff <= 10) totalScore += 15;
        else if (diff > 60) totalScore -= 50;
      }
    }

    return totalScore;
  }

  /**
   * Resolve a full-length playable audio source for a catalog song
   */
  public async resolvePlaybackSource(song: Song | null): Promise<Song> {
    if (!song) {
      throw new Error('Cannot resolve source for null song');
    }

    // 1. Control tracks & already verified full-length tracks with valid streamUrl (e.g. Josh Woodward - Shot Down)
    if (
      song.playbackSource?.streamUrl &&
      (song.playbackSourceType === 'open-license' ||
        (song.fullLengthAvailable && !song.isStreamPreview && !song.playbackSource.streamUrl.includes('itunes.apple.com')))
    ) {
      return song;
    }

    // 2. Dev fixtures remain tagged as dev fixtures
    if (song.playbackSourceType === 'dev-fixture') {
      return song;
    }

    const targetLang = this.inferSongLanguage(song);

    // 3. Check in-memory cache with language and album isolation
    const cacheKey = `${this.normalizeText(song.title)}_${this.normalizeText(song.artist)}_${targetLang || 'any'}_${song.album ? this.normalizeText(song.album) : ''}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return {
        ...song,
        ...cached,
        id: song.id,
        artwork: song.artwork,
        lyrics: song.lyrics || cached.lyrics
      };
    }

    try {
      const cleanTitle = song.title.replace(/[[({].*?[)\]}]/g, '').trim();
      const cleanArtist = song.artist.split('&')[0].split(',')[0].replace(/feat\..*/i, '').trim();

      const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.origin);

      const fetchSearchResults = async (queryText: string): Promise<SaavnResult[]> => {
        let endpoint = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=10&p=1&q=${encodeURIComponent(queryText)}`;
        if (isBrowser) {
          endpoint = `/api/saavn/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=10&p=1&q=${encodeURIComponent(queryText)}`;
        }

        const res = await fetch(endpoint, {
          headers: isBrowser
            ? {}
            : {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                cookie: 'DL=english'
              },
          signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) return [];
        const data: { results?: SaavnResult[] } = await res.json();
        return Array.isArray(data.results) ? data.results : [];
      };

      // Primary search query
      const primaryQuery = `${cleanTitle} ${cleanArtist}`.trim();
      let results = await fetchSearchResults(primaryQuery);

      // Score candidates from primary search
      let scored = results
        .map((r) => ({ result: r, score: this.scoreCandidate(song, r) }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      // If no candidate matched with positive score and a target language is known,
      // retry with a language-targeted query
      if (scored.length === 0 && targetLang) {
        const langQuery = `${cleanTitle} ${cleanArtist} ${targetLang}`.trim();
        const langResults = await fetchSearchResults(langQuery);
        scored = langResults
          .map((r) => ({ result: r, score: this.scoreCandidate(song, r) }))
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score);
      }

      if (scored.length === 0) {
        // No legitimate matching recording found for this exact version/language.
        // Never substitute an alternate-language dub or unrelated audio file.
        return song;
      }

      // Conservative Selection Rule when target language is unknown:
      // If target language could not be determined from song metadata (language, title, or album),
      // inspect competing top candidates. If multiple candidates remain indistinguishable
      // across different language versions (e.g. score difference <= 30 points and competing candidates
      // represent different languages), do NOT silently select a potentially incorrect dub.
      if (!targetLang && scored.length > 1) {
        const topScore = scored[0].score;
        const topLang = this.getCandidateLanguage(scored[0].result);

        const competitors = scored.slice(1).filter((c) => topScore - c.score <= 30);
        const hasConflictingLanguage = competitors.some((c) => {
          const compLang = this.getCandidateLanguage(c.result);
          if (topLang && compLang && topLang !== compLang) {
            return true;
          }
          if (topLang !== compLang && (topLang || compLang)) {
            const markedLang = topLang || compLang;
            if (markedLang && markedLang !== 'english') {
              return true;
            }
          }
          return false;
        });

        if (hasConflictingLanguage) {
          // Multiple language versions compete with insufficient confidence to choose.
          // Return safe unresolved song rather than silently playing an arbitrary dub.
          return song;
        }
      }

      const match = scored[0].result;
      const encUrl = match.more_info?.encrypted_media_url;
      if (!encUrl) {
        return song;
      }

      // Decrypt DES ECB stream URL
      const decrypted = decryptDesEcb(encUrl, this.cipherKey);
      if (!decrypted || !decrypted.startsWith('http')) {
        return song;
      }

      // Use 160kbps high-quality AAC stream
      const streamUrl = decrypted.replace('_96.mp4', '_160.mp4');
      const rawDuration = match.more_info?.duration;
      const duration = rawDuration ? parseInt(String(rawDuration), 10) : (song.fullTrackDuration || song.duration || 180);

      const resolvedSong: Song = {
        ...song,
        duration,
        fullTrackDuration: duration,
        isStreamPreview: false,
        previewAvailable: false,
        fullLengthAvailable: true,
        playbackAvailable: true,
        playbackType: 'full',
        playbackAvailability: 'full',
        playbackSourceType: 'naro-licensed',
        playbackSource: {
          provider: 'naro',
          providerTrackId: match.id || song.id,
          streamUrl,
          format: 'aac',
          isStreamPreview: false,
          playbackSourceType: 'naro-licensed'
        },
        capabilities: {
          ...song.capabilities,
          playback: true,
          lyrics: song.capabilities?.lyrics ?? true,
          karaoke: song.capabilities?.karaoke ?? false,
          recording: true,
          playbackAvailable: true,
          playbackType: 'full',
          playbackSourceType: 'naro-licensed'
        }
      };

      this.cache.set(cacheKey, resolvedSong);
      return resolvedSong;
    } catch (err) {
      console.warn('PlaybackSourceResolver error, falling back to original song:', err);
      return song;
    }
  }
}

export const playbackSourceResolver = new PlaybackSourceResolver();
