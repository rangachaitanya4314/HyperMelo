// NARO Development & Offline Fixture Catalog Provider
// Supplies local procedural audio fixtures for offline testing, timeline seeking verification,
// and Web Audio vocal cancellation DSP testing.
// NOTE: Assets provided here are DEV/TEST FIXTURES ONLY — NEVER LICENSED PRODUCTION MASTERS.

import type {
  Song,
  ProviderResult,
  SongLyrics,
  SongCapabilities,
  KaraokeSource,
  MusicProvider,
  SearchOptions
} from '../../shared';
import { SONGS, ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../../data/songs';

export class NaroCatalogProvider implements MusicProvider {
  public readonly id = 'naro-catalog';
  public readonly name = 'HyperMelo Catalog & Reference Tracks';
  public readonly isPrimaryCatalog = false;

  private catalog: Song[] = [
    ANIRUDH_GAALI_VAALUGA,
    JOSH_WOODWARD_SHOT_DOWN,
    ...SONGS.filter((s) => s.id !== ANIRUDH_GAALI_VAALUGA.id && s.id !== JOSH_WOODWARD_SHOT_DOWN.id).map((s) => {
      // If song already has an authoritative external playback source (e.g. Apple Music preview), preserve it cleanly
      if (s.playbackSource && s.playbackProvider === 'apple-music') {
        return s;
      }

      const isMidnightDrive = s.id === 'midnight-drive';
      const streamUrl = isMidnightDrive ? '/audio/midnight-drive.wav' : (s.playbackSource?.streamUrl || '');
      const duration = isMidnightDrive ? 195 : s.duration;
      const hasAudio = Boolean(streamUrl);

      const karaokeSource: KaraokeSource = s.karaokeSource || {
        type: 'dev_fixture',
        provider: 'naro',
        providerTrackId: s.id,
        streamUrl,
        duration,
        availability: s.karaokeReady && hasAudio ? 'available' : 'unavailable'
      };

      return {
        ...s,
        duration,
        fullTrackDuration: duration,
        isFallbackDemo: isMidnightDrive,
        playbackAvailable: hasAudio,
        playbackType: hasAudio ? (s.playbackType || ('full' as const)) : ('unavailable' as const),
        playbackAvailability: hasAudio ? (s.playbackAvailability || ('full' as const)) : ('unavailable' as const),
        playbackSourceType: hasAudio ? (s.playbackSourceType || ('dev-fixture' as const)) : ('unavailable' as const),
        playbackProvider: s.playbackProvider || ('naro' as const),
        previewAvailable: s.previewAvailable ?? false,
        fullLengthAvailable: isMidnightDrive ? false : Boolean(hasAudio && (s.fullLengthAvailable ?? false)),
        karaokeAvailable: Boolean(s.karaokeReady && hasAudio),
        karaokeReady: Boolean(s.karaokeReady && hasAudio),
        karaokeAvailability: (s.karaokeReady && hasAudio ? 'available' : 'unavailable') as 'available' | 'unavailable',
        lyricsAvailable: true,
        lyricsSyncAvailable: true,
        karaokeSource,
        capabilities: {
          playback: true,
          playbackAvailable: true,
          playbackType: s.playbackType || ('full' as const),
          playbackSourceType: s.playbackSourceType || ('dev-fixture' as const),
          lyrics: true,
          lyricsAvailable: true,
          lyricsSyncAvailable: true,
          karaoke: s.karaokeReady,
          karaokeAvailable: s.karaokeReady,
          karaokeSource,
          recording: true
        },
        playbackSource: s.playbackSource || {
          provider: 'naro' as const,
          providerTrackId: s.id,
          streamUrl,
          isStreamPreview: false,
          playbackSourceType: 'dev-fixture' as const
        }
      };
    })
  ];

  public async search(query: string, options?: SearchOptions): Promise<ProviderResult[]> {
    const q = query.trim().toLowerCase();
    const limit = options?.limit || 10;

    const matches = this.catalog.filter((song) => {
      if (!q) return true;
      const inTitle = song.title.toLowerCase().includes(q);
      const inArtist = song.artist.toLowerCase().includes(q);
      const inGenre = song.genre.toLowerCase().includes(q);
      const inAlbum = song.album?.toLowerCase().includes(q);
      const inEn = song.lyrics.en?.lines?.some((l) => l.text.toLowerCase().includes(q));
      const inHi = song.lyrics.hi?.lines?.some((l) => l.text.toLowerCase().includes(q));
      const inTe = song.lyrics.te?.lines?.some((l) => l.text.toLowerCase().includes(q));
      return inTitle || inArtist || inGenre || inAlbum || inEn || inHi || inTe;
    });

    return matches.slice(0, limit).map((s) => ({
      provider: 'naro',
      providerTrackId: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album || s.title,
      artworkUrl: s.artwork.imageUrl,
      duration: s.duration,
      genre: s.genre,
      streamUrl: s.playbackSource?.streamUrl,
      playbackAvailability: true,
      playbackType: s.playbackType || 'full',
      playbackSourceType: s.playbackSourceType || ('dev-fixture' as const),
      previewAvailable: s.previewAvailable ?? false,
      fullLengthAvailable: s.fullLengthAvailable ?? false,
      karaokeAvailability: s.karaokeReady,
      karaokeSource: s.karaokeSource,
      lyricsAvailability: s.lyricsAvailable ?? true,
      lyricsSyncAvailability: s.lyricsSyncAvailable ?? true,
      attribution: s.attribution
    }));
  }

  public async getTrack(trackId: string): Promise<Song | null> {
    const found = this.catalog.find((s) => s.id === trackId || s.playbackSource?.providerTrackId === trackId);
    return found ? { ...found } : null;
  }

  public async getRecommendations(_seedTrackId?: string): Promise<Song[]> {
    return [...this.catalog];
  }

  public async getTrending(_genreOrLanguage?: string): Promise<Song[]> {
    return [...this.catalog];
  }

  public async getLyrics(trackId: string): Promise<SongLyrics | null> {
    const found = this.catalog.find((s) => s.id === trackId);
    return found ? found.lyrics : null;
  }

  public async getPlaybackAvailability(trackId: string): Promise<SongCapabilities> {
    const found = this.catalog.find((s) => s.id === trackId);
    return (
      found?.capabilities || {
        playback: true,
        lyrics: true,
        karaoke: true,
        recording: true
      }
    );
  }

  public getRawCatalog(): Song[] {
    return this.catalog;
  }
}

export const naroCatalogProvider = new NaroCatalogProvider();
