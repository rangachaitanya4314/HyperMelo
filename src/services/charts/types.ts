// Provider-Independent Music Chart Contracts for HyperMelo
// Follows strict provenance, honest metadata labeling, and normalized record schemas

import type { Language } from '../../shared/lyrics';

export type ChartProviderType = 'apple-music' | 'apple-music-live' | 'spotify' | 'naro-editorial' | 'custom';

export type RankMovement = 'new' | 'up' | 'down' | 'unchanged' | 'exit';

export type ChartStatus = 'live' | 'stale' | 'editorial' | 'unavailable';

export interface NormalizedChartTrack {
  internal_track_id: string;
  provider: ChartProviderType;
  provider_track_id: string;
  isrc_if_available?: string;
  title: string;
  primary_artist: string;
  album_or_release?: string;
  version_or_mix?: string;
  duration_if_available?: number;
  artwork_url?: string;
  language_if_verified?: Language;
  storefront: string;
  source_chart: string;
  source_rank: number;
  source_url_if_available?: string;
  source_updated_at_if_available?: string;
  last_verified_at: string;
  rank_movement?: RankMovement;
  previous_rank?: number | null;
  stream_url?: string;
  genre?: string;
}

export interface ChartSnapshot {
  chart_id: string;
  chart_title: string;
  storefront: string;
  provider: string;
  is_official: boolean;
  source_attribution: string;
  retrieved_at: string;
  source_updated_at?: string;
  tracks: NormalizedChartTrack[];
  status: ChartStatus;
  failure_reason?: string;
}

export interface ChartDestination {
  id: string;
  label: string;
  type: 'official-chart' | 'editorial-picks' | 'live-catalog';
  storefront: string;
  description: string;
  language?: Language;
}

export interface ChartProviderAdapter {
  readonly name: string;
  readonly isOfficial: boolean;
  isConfigured(): boolean;
  fetchChart(chartId: string, storefront: string): Promise<NormalizedChartTrack[]>;
}
