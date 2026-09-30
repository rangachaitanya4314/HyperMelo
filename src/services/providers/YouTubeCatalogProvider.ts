// YouTube Catalog Provider for NARO
// Compliant with YouTube terms: provides metadata and official IFrame player candidates

import type {
  Song,
  ProviderResult,
  SongLyrics,
  SongCapabilities,
  MusicProvider,
  SearchOptions
} from '../../shared';

export class YouTubeCatalogProvider implements MusicProvider {
  public readonly id = 'youtube';
  public readonly name = 'YouTube Catalog';

  public async search(_query: string, _options?: SearchOptions): Promise<ProviderResult[]> {
    // In browser environment without private API keys, YouTube catalog queries
    // are resolved during track candidate matching when a video ID is supplied
    return [];
  }

  public async getTrack(_trackId: string): Promise<Song | null> {
    return null;
  }

  public async getRecommendations(): Promise<Song[]> {
    return [];
  }

  public async getTrending(): Promise<Song[]> {
    return [];
  }

  public async getLyrics(): Promise<SongLyrics | null> {
    return null;
  }

  public async getPlaybackAvailability(): Promise<SongCapabilities> {
    return {
      playback: true,
      lyrics: false,
      karaoke: false,
      recording: true
    };
  }
}

export const youtubeCatalogProvider = new YouTubeCatalogProvider();
