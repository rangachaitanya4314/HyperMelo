// Music Provider Abstraction for NARO

import type { Song, ProviderResult, SongLyrics, SongCapabilities } from '../../types/music';

export interface SearchOptions {
  limit?: number;
  genre?: string;
  language?: string;
}

export interface MusicProvider {
  readonly id: string;
  readonly name: string;
  readonly isPrimaryCatalog?: boolean;

  search(query: string, options?: SearchOptions): Promise<ProviderResult[]>;
  getTrack(trackId: string): Promise<Song | null>;
  getRecommendations(seedTrackId?: string): Promise<Song[]>;
  getTrending(genreOrLanguage?: string): Promise<Song[]>;
  getLyrics(trackId: string, isrc?: string): Promise<SongLyrics | null>;
  getPlaybackAvailability(trackId: string): Promise<SongCapabilities>;
}
