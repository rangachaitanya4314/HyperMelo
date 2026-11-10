// Apple Music / iTunes Online Catalog Provider for NARO
// Delivers live search across millions of current and historical songs with official preview streams

import {
  type Song,
  type ProviderResult,
  type SongLyrics,
  type SongCapabilities,
  type ArtworkStyle,
  type SongSection,
  type PlaybackAvailability,
  type KaraokeSource,
  type MusicProvider,
  type SearchOptions,
  type Language
} from '../../shared';
import { lyricsService } from '../lyrics/lyricsService';
import { indexedDbService } from '../storage/indexedDbService';
import { sanitizeLyricsMetadata } from '../lyrics/lyricsSanitizer';

interface ItunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  isStreamable?: boolean;
}

export class AppleMusicCatalogProvider implements MusicProvider {
  public readonly id = 'apple-music';
  public readonly name = 'Apple Music Catalog';

  public async search(query: string, options?: SearchOptions): Promise<ProviderResult[]> {
    if (!query.trim()) return [];

    const limit = options?.limit || 20;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&entity=song&limit=${limit}`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return [];

      const data: { results?: ItunesResult[] } = await response.json();
      if (!data.results || !Array.isArray(data.results)) return [];

      const qLower = query.toLowerCase();
      let queryLang: Language | undefined;
      if (qLower.includes('hindi') || qLower.includes('arijit') || qLower.includes('bollywood')) queryLang = 'hi';
      else if (qLower.includes('telugu') || qLower.includes('anirudh') || qLower.includes('devara')) queryLang = 'te';
      else if (qLower.includes('tamil') || qLower.includes('kollywood')) queryLang = 'ta';
      else if (qLower.includes('malayalam') || qLower.includes('mollywood')) queryLang = 'ml';

      return data.results
        .filter((r) => r.trackName && r.artistName)
        .map((r) => {
          const duration = r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 180;
          // Hi-res artwork
          const artworkUrl = r.artworkUrl100
            ? r.artworkUrl100.replace('100x100bb', '600x600bb')
            : r.artworkUrl60;

          const playbackType: PlaybackAvailability = r.previewUrl ? 'preview' : 'unavailable';
          const playbackSourceType = r.previewUrl ? 'preview' : 'unavailable';
          const karaokeSource: KaraokeSource = {
            type: 'instrumental',
            provider: 'apple-music',
            providerTrackId: String(r.trackId),
            availability: 'unavailable'
          };

          return {
            provider: 'apple-music',
            providerTrackId: String(r.trackId),
            title: r.trackName,
            artist: r.artistName,
            album: r.collectionName || r.trackName,
            artworkUrl,
            duration,
            streamUrl: r.previewUrl,
            genre: r.primaryGenreName || 'Music',
            language: queryLang,
            releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined,
            playbackAvailability: !!r.previewUrl,
            playbackType,
            playbackSourceType,
            previewAvailable: !!r.previewUrl,
            fullLengthAvailable: false,
            karaokeAvailability: false, // Normal vocal preview track must NEVER be used for karaoke!
            karaokeSource,
            lyricsAvailability: true,
            lyricsSyncAvailability: true
          };
        });
    } catch (err) {
      console.warn('Apple Music catalog search error:', err);
      return [];
    }
  }

  public async getTrack(trackId: string): Promise<Song | null> {
    try {
      const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&entity=song`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;

      const data: { results?: ItunesResult[] } = await res.json();
      const raw = data.results?.[0];
      if (!raw) return null;

      const playbackType: PlaybackAvailability = raw.previewUrl ? 'preview' : 'unavailable';
      const karaokeSource: KaraokeSource = {
        type: 'instrumental',
        provider: 'apple-music',
        providerTrackId: String(raw.trackId),
        availability: 'unavailable'
      };

      return this.normalizeSong({
        provider: 'apple-music',
        providerTrackId: String(raw.trackId),
        title: raw.trackName,
        artist: raw.artistName,
        album: raw.collectionName,
        artworkUrl: raw.artworkUrl100?.replace('100x100bb', '600x600bb'),
        duration: raw.trackTimeMillis ? Math.round(raw.trackTimeMillis / 1000) : 180,
        streamUrl: raw.previewUrl,
        genre: raw.primaryGenreName,
        releaseYear: raw.releaseDate ? new Date(raw.releaseDate).getFullYear() : undefined,
        playbackAvailability: !!raw.previewUrl,
        playbackType,
        karaokeAvailability: false,
        karaokeSource,
        lyricsAvailability: true,
        lyricsSyncAvailability: true
      });
    } catch {
      return null;
    }
  }

  public async getRecommendations(_seedTrackId?: string): Promise<Song[]> {
    const results = await this.search('trending hits', { limit: 8 });
    return Promise.all(results.map((r) => this.normalizeSong(r)));
  }

  public async getTrending(genreOrLanguage = 'all'): Promise<Song[]> {
    let query = 'top hits 2024';
    if (genreOrLanguage === 'hindi') query = 'hindi top songs arijit';
    else if (genreOrLanguage === 'telugu') query = 'telugu hits anirudh';
    else if (genreOrLanguage === 'romantic') query = 'romantic acoustic ballads';
    else if (genreOrLanguage === 'midnight') query = 'late night ambient synth';
    else if (genreOrLanguage === 'energetic') query = 'dance electronic upbeat';

    const results = await this.search(query, { limit: 12 });
    return Promise.all(results.map((r) => this.normalizeSong(r)));
  }

  public async getLyrics(trackId: string): Promise<SongLyrics | null> {
    const track = await this.getTrack(trackId);
    if (!track) return null;
    return lyricsService.fetchLyrics(track.title, track.artist, track.duration, track.album);
  }

  public async getPlaybackAvailability(trackId: string): Promise<SongCapabilities> {
    const track = await this.getTrack(trackId);
    return (
      track?.capabilities || {
        playback: true,
        lyrics: true,
        karaoke: false,
        recording: false,
        playbackAvailable: true,
        playbackType: 'preview',
        lyricsAvailable: true,
        lyricsSyncAvailable: true,
        karaokeAvailable: false
      }
    );
  }

  /**
   * Convert ProviderResult into normalized Song model with real stream, artwork & lyrics mapping
   */
  public async normalizeSong(result: ProviderResult): Promise<Song> {
    const artwork: ArtworkStyle = {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8',
      accentCream: '#F4DFC9',
      imageUrl: result.artworkUrl
    };

    // Fast local lookup: check IndexedDB for already-cached lyrics without blocking catalog discovery on remote network calls
    const { cleanTitle, cleanArtist } = sanitizeLyricsMetadata(result.title, result.artist);
    const effectiveTrackId = `track_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    let lyrics: SongLyrics | null = null;
    try {
      lyrics = await indexedDbService.getLyrics(effectiveTrackId);
    } catch {
      lyrics = null;
    }

    const hasLyrics = !!lyrics && Boolean(
      (lyrics.en?.lines && lyrics.en.lines.length > 0) ||
      (lyrics.hi?.lines && lyrics.hi.lines.length > 0) ||
      (lyrics.te?.lines && lyrics.te.lines.length > 0) ||
      (lyrics.ta?.lines && lyrics.ta.lines.length > 0) ||
      (lyrics.ml?.lines && lyrics.ml.lines.length > 0)
    );

    const isPreview = !!result.streamUrl && (result.streamUrl.includes('mzstatic') || result.streamUrl.includes('apple') || result.streamUrl.includes('itunes'));
    const fullTrackDuration = result.duration && result.duration > 0 ? result.duration : 180;
    const duration = fullTrackDuration;
    const playbackType: PlaybackAvailability = result.streamUrl ? (isPreview ? 'preview' : 'full') : 'unavailable';

    // Build intelligent moment sections within playable audio bounds
    const sections = this.generateSections(fullTrackDuration, isPreview, lyrics);

    const karaokeSource: KaraokeSource = {
      type: 'instrumental',
      provider: 'apple-music',
      providerTrackId: result.providerTrackId,
      availability: 'unavailable'
    };

    const playbackSourceType = isPreview ? 'preview' : (result.streamUrl ? 'official-provider' : 'unavailable');

    const detectedLang = (result as any).language || lyricsService.detectSongLanguage({
      id: `am-${result.providerTrackId}`,
      title: result.title,
      artist: result.artist,
      album: result.album,
      genre: result.genre || 'Contemporary',
      lyrics: lyrics || {},
      language: (result as any).language,
      duration,
      karaokeReady: false,
      bpm: 90,
      musicalKey: 'C Major',
      artwork,
      sections: []
    });

    return {
      id: `am-${result.providerTrackId}`,
      title: result.title,
      artist: result.artist,
      album: result.album,
      duration: fullTrackDuration,
      fullTrackDuration: fullTrackDuration,
      isStreamPreview: isPreview,
      playbackAvailable: !!result.streamUrl,
      playbackType,
      playbackSourceType,
      previewAvailable: isPreview,
      fullLengthAvailable: !isPreview && !!result.streamUrl,
      lyricsAvailable: hasLyrics,
      lyricsSyncAvailable: hasLyrics,
      karaokeAvailable: false, // Normal vocal stream is NEVER an authorized karaoke backing track!
      karaokeReady: false,
      karaokeSource,
      lyricsOffsetMs: 0,
      genre: result.genre || 'Contemporary',
      language: detectedLang,
      originalLanguage: detectedLang,
      bpm: 90,
      musicalKey: 'C Major',
      releaseYear: result.releaseYear,
      capabilities: {
        playback: result.playbackAvailability,
        playbackAvailable: !!result.streamUrl,
        playbackType,
        playbackSourceType,
        lyrics: hasLyrics,
        lyricsAvailable: hasLyrics,
        lyricsSyncAvailable: hasLyrics,
        karaoke: false,
        karaokeAvailable: false,
        karaokeSource,
        recording: false
      },
      artwork,
      sections,
      lyrics: lyrics || {
        en: { chorusSnippet: result.title, lines: [] },
        hi: { chorusSnippet: result.title, lines: [] },
        te: { chorusSnippet: result.title, lines: [] }
      },
      playbackSource: {
        provider: 'apple-music',
        providerTrackId: result.providerTrackId,
        streamUrl: result.streamUrl,
        format: 'aac',
        isStreamPreview: isPreview,
        playbackSourceType
      }
    };
  }

  private generateSections(duration: number, isPreview: boolean, lyrics: SongLyrics | null): SongSection[] {
    const total = Math.max(20, duration);

    if (isPreview) {
      // For 30s preview audio, sections MUST fall squarely within the 30s file
      return [
        {
          type: 'verse',
          label: 'Verse Intro',
          start: 2,
          end: 12
        },
        {
          type: 'chorus',
          label: 'Chorus Climax',
          start: 12,
          end: 27
        },
        {
          type: 'custom',
          label: 'Full Preview',
          start: 0,
          end: Math.floor(total)
        }
      ];
    }

    // If lyrics exist with timestamps on full track, find the chorus or middle peak
    if (lyrics?.en?.lines && lyrics.en.lines.length >= 4) {
      const lines = lyrics.en.lines;
      const firstLine = lines[0]?.startTime ?? lines[0]?.time ?? 5;
      const middleIdx = Math.floor(lines.length / 2);
      const midLineTime = lines[middleIdx]?.startTime ?? lines[middleIdx]?.time;
      const chorusStart = Math.max(10, midLineTime !== undefined ? midLineTime - 5 : Math.floor(total * 0.35));
      const chorusEnd = Math.min(total - 5, chorusStart + 35);

      return [
        {
          type: 'verse',
          label: 'Verse 1',
          start: Math.floor(firstLine),
          end: Math.floor(chorusStart - 2)
        },
        {
          type: 'chorus',
          label: 'Chorus',
          start: Math.floor(chorusStart),
          end: Math.floor(chorusEnd)
        },
        {
          type: 'bridge',
          label: 'Bridge',
          start: Math.floor(chorusEnd + 4),
          end: Math.floor(Math.min(total - 2, chorusEnd + 35))
        }
      ];
    }

    // Default proportional sections
    return [
      {
        type: 'verse',
        label: 'Verse 1',
        start: Math.floor(total * 0.08),
        end: Math.floor(total * 0.32)
      },
      {
        type: 'chorus',
        label: 'Chorus',
        start: Math.floor(total * 0.35),
        end: Math.floor(total * 0.65)
      },
      {
        type: 'bridge',
        label: 'Bridge',
        start: Math.floor(total * 0.68),
        end: Math.floor(total * 0.88)
      }
    ];
  }
}

export const appleMusicCatalogProvider = new AppleMusicCatalogProvider();
