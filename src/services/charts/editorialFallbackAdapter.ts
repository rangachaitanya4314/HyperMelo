// Curated Editorial Chart & Picks Adapter for HyperMelo
// Provides high-quality, transparently labeled editorial selections when live
// provider chart credentials are not configured or for regional language picks.
// Delivers >= 15-20 verified, genuine songs per chart section.
// NEVER claims that editorial picks are official live provider rankings.

import type { ChartProviderAdapter, NormalizedChartTrack } from './types';
import type { Song } from '../../types/music';
import {
  TRENDING_INDIA_SONGS,
  HINDI_POPULAR_SONGS,
  TELUGU_POPULAR_SONGS,
  TAMIL_POPULAR_SONGS,
  MALAYALAM_POPULAR_SONGS,
  ENGLISH_POPULAR_SONGS
} from '../../data/curatedCatalog';

export class EditorialFallbackAdapter implements ChartProviderAdapter {
  public readonly name = 'HyperMelo Editorial Catalog Picks';
  public readonly isOfficial = false;

  public isConfigured(): boolean {
    return true; // Always configured as local safe fallback
  }

  private mapToNormalizedTrack(
    song: Song,
    index: number,
    storefront: string,
    chartId: string,
    verifiedAt: string
  ): NormalizedChartTrack {
    return {
      internal_track_id: `editorial-${chartId}-${song.id}`,
      provider: 'naro-editorial' as const,
      provider_track_id: song.id,
      title: song.title,
      primary_artist: song.artist,
      album_or_release: song.album,
      duration_if_available: song.duration,
      artwork_url: song.artwork?.imageUrl,
      language_if_verified: song.language || song.originalLanguage,
      storefront,
      source_chart: chartId,
      source_rank: index + 1,
      last_verified_at: verifiedAt,
      genre: song.genre,
      stream_url: song.playbackSource?.streamUrl
    };
  }

  public async fetchChart(
    chartId: string,
    storefront = 'in'
  ): Promise<NormalizedChartTrack[]> {
    const verifiedAt = new Date().toISOString();

    switch (chartId) {
      case 'trending-india':
        return TRENDING_INDIA_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      case 'hindi-top-10':
        return HINDI_POPULAR_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      case 'telugu-top-10':
        return TELUGU_POPULAR_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      case 'tamil-top-10':
        return TAMIL_POPULAR_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      case 'malayalam-top-10':
        return MALAYALAM_POPULAR_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      case 'english-top-10':
        return ENGLISH_POPULAR_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );

      default:
        return TRENDING_INDIA_SONGS.map((s, i) =>
          this.mapToNormalizedTrack(s, i, storefront, chartId, verifiedAt)
        );
    }
  }
}

export const editorialFallbackAdapter = new EditorialFallbackAdapter();
