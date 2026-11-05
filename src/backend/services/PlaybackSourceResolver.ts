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
    primary_artists?: string | string[];
    artistMap?: { primary_artists?: string | string[] };
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

  public isTitleSimilarityMatch(normSong: string, normCand: string): boolean {
    if (normSong.length < 4 || normCand.length < 4) return false;
    const phonSong = this.normalizePhoneticVariants(normSong);
    const phonCand = this.normalizePhoneticVariants(normCand);

    if (phonSong === phonCand) return true;

    // Check anchor token match (first 3 phonetic characters)
    const anchorS = phonSong.slice(0, 3);
    const anchorC = phonCand.slice(0, 3);
    if (anchorS !== anchorC) return false;

    const bigrams = new Map<string, number>();
    for (let i = 0; i < phonSong.length - 1; i++) {
      const bg = phonSong.slice(i, i + 2);
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
    const dice = (2.0 * intersection) / (phonSong.length - 1 + (phonCand.length - 1));
    return dice >= 0.70;
  }

  public normalizePhoneticVariants(text: string): string {
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
    } else if (this.isTitleSimilarityMatch(normCleanSongTitle, normCleanRTitle)) {
      titleScore = 70;
    } else {
      return -1; // REJECT: Title must align
    }

    // 3. Artist Matching
    const cleanArtist = song.artist.split('&')[0].split(',')[0].replace(/feat\..*/i, '').trim();
    const normSongArtist = this.normalizeText(cleanArtist);
    const primaryArts = Array.isArray(r.more_info?.primary_artists)
      ? r.more_info.primary_artists.map((a: any) => (typeof a === 'string' ? a : a?.name || '')).join(' ')
      : String(r.more_info?.primary_artists || '');
    const rArtistInfo = this.normalizeText(
      `${r.subtitle || ''} ${r.header_desc || ''} ${r.more_info?.singers || ''} ${r.more_info?.music || ''} ${primaryArts}`
    );

    let artistScore = 0;
    if (normSongArtist.length >= 3) {
      if (rArtistInfo.includes(normSongArtist)) {
        artistScore = 50;
      } else {
        const artistTokens = cleanArtist
          .toLowerCase()
          .split(/[\s,&/-]+/)
          .filter((t) => t.length >= 4);
        const hasTokenMatch = artistTokens.length > 0 && artistTokens.some((token) => rArtistInfo.includes(token));
        if (hasTokenMatch) {
          artistScore = 35;
        } else {
          return -1; // REJECT: Artist must match
        }
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
    const expectedDuration = (!song.isStreamPreview && song.duration > 35) ? song.duration : (song.fullTrackDuration || 0);
    if (expectedDuration > 0 && r.more_info?.duration) {
      const rDur = parseInt(String(r.more_info.duration), 10);
      if (!isNaN(rDur) && rDur > 0) {
        const diff = Math.abs(rDur - expectedDuration);
        if (diff <= 5) totalScore += 40;
        else if (diff <= 15) totalScore += 20;
        else if (diff > 60) totalScore -= 50;
      }
    }

    // 7. Version / Remix Penalty:
    // If the requested song title does NOT ask for Reloaded/Remix/Promo/Lofi, penalize candidate that is Reloaded/Remix
    const isSongRemix = /\b(reloaded|remix|lofi|lo-fi|promo|trailer|teaser|dialogue|bgm|instrumental)\b/i.test(song.title);
    const isCandRemix = /\b(reloaded|remix|lofi|lo-fi|promo|trailer|teaser|dialogue|bgm|instrumental)\b/i.test(unescapeHtml(r.title));
    if (!isSongRemix && isCandRemix) {
      totalScore -= 60; // Penalize alternative/trailer/reloaded versions over original soundtrack
    }

    return totalScore;
  }

  /**
   * Resolve a full-length playable audio source for a catalog song
   */
  private preservePreviewSong(song: Song): Song {
    const isPreview = Boolean(
      song.isStreamPreview ||
      song.playbackSource?.isStreamPreview ||
      song.playbackType === 'preview' ||
      song.playbackSource?.streamUrl?.includes('itunes.apple.com')
    );

    if (isPreview && song.playbackSource?.streamUrl) {
      return {
        ...song,
        duration: 30,
        fullTrackDuration: song.fullTrackDuration || song.duration || 30,
        isStreamPreview: true,
        previewAvailable: true,
        fullLengthAvailable: false,
        playbackType: 'preview',
        playbackAvailability: 'preview',
        playbackSourceType: 'preview',
        playbackSource: {
          ...song.playbackSource,
          isStreamPreview: true,
          playbackSourceType: 'preview'
        },
        capabilities: {
          ...song.capabilities,
          playback: song.capabilities?.playback ?? true,
          lyrics: song.capabilities?.lyrics ?? true,
          karaoke: song.capabilities?.karaoke ?? false,
          recording: song.capabilities?.recording ?? true,
          playbackAvailable: true,
          playbackType: 'preview',
          playbackSourceType: 'preview'
        }
      };
    }
    return song;
  }

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

    // 3. Dev fixtures remain tagged as dev fixtures
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

      // Build targeted search queries
      const queries: string[] = [];
      if (targetLang && targetLang !== 'english') {
        queries.push(`${cleanTitle} ${cleanArtist} ${targetLang}`.trim());
      }
      queries.push(`${cleanTitle} ${cleanArtist}`.trim());
      queries.push(cleanTitle);

      const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
      if (titleWords.length > 1 && cleanArtist) {
        queries.push(`${titleWords[0]} ${cleanArtist}`.trim());
      }

      let results: SaavnResult[] = [];
      for (const q of queries) {
        const res = await fetchSearchResults(q);
        if (res.length > 0) {
          results.push(...res);
        }
        // If language-specific search returned positive scored candidates, no need to over-fetch
        if (results.length > 0 && targetLang) {
          const testScored = results
            .map((r) => ({ result: r, score: this.scoreCandidate(song, r) }))
            .filter((c) => c.score > 0);
          if (testScored.length > 0) break;
        }
      }

      // Deduplicate results by ID
      const seenIds = new Set<string>();
      const uniqueResults = results.filter((r) => {
        if (!r.id || seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
      });

      // Score candidates
      let scored = uniqueResults
        .map((r) => ({ result: r, score: this.scoreCandidate(song, r) }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        // No legitimate matching recording found for this exact version/language.
        // Never substitute an alternate-language dub or unrelated audio file.
        return this.preservePreviewSong(song);
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
          return this.preservePreviewSong(song);
        }
      }

      const match = scored[0].result;
      const encUrl = match.more_info?.encrypted_media_url;
      if (!encUrl) {
        return this.preservePreviewSong(song);
      }

      // Decrypt DES ECB stream URL
      const decrypted = decryptDesEcb(encUrl, this.cipherKey);
      if (!decrypted || !decrypted.startsWith('http')) {
        return this.preservePreviewSong(song);
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
      return this.preservePreviewSong(song);
    }
  }
}

export const playbackSourceResolver = new PlaybackSourceResolver();
