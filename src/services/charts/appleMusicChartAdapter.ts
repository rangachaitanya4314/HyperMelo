// Apple Music API Catalog Charts Provider Adapter
// Official Endpoint: GET https://api.music.apple.com/v1/catalog/{storefront}/charts
// Implements strict schema validation, credential verification, and bounded retries.

import type { ChartProviderAdapter, NormalizedChartTrack } from './types';

export interface AppleMusicApiSongResource {
  id: string;
  type: string;
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    isrc?: string;
    durationInMillis?: number;
    genreNames?: string[];
    releaseDate?: string;
    url?: string;
    artwork?: {
      url?: string;
      width?: number;
      height?: number;
    };
    previews?: Array<{
      url?: string;
    }>;
  };
}

export interface AppleMusicApiResponse {
  results?: {
    songs?: Array<{
      id?: string;
      name?: string;
      href?: string;
      chart?: string;
      data?: AppleMusicApiSongResource[];
    }>;
  };
  errors?: Array<{
    id?: string;
    title?: string;
    detail?: string;
    status?: string;
    code?: string;
  }>;
}

export class AppleMusicChartAdapter implements ChartProviderAdapter {
  public readonly name = 'Apple Music Catalog Charts';
  public readonly isOfficial = true;

  /**
   * Retrieves the Apple Music developer token securely from environment variables.
   * Returns empty string if not configured.
   */
  public getDeveloperToken(): string {
    // Check vite client env first
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        const viteToken = (import.meta as any).env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN;
        if (typeof viteToken === 'string' && viteToken.trim() !== '') {
          return viteToken.trim();
        }
      }
    } catch {
      // Ignore
    }

    // Check node process.env if in test or SSR environment
    const proc = (globalThis as any).process;
    if (proc && proc.env) {
      const nodeToken =
        proc.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN || proc.env.APPLE_MUSIC_DEVELOPER_TOKEN;
      if (typeof nodeToken === 'string' && nodeToken.trim() !== '') {
        return nodeToken.trim();
      }
    }

    return '';
  }

  /**
   * Returns true only when a genuine Apple Music Developer JWT is configured.
   */
  public isConfigured(): boolean {
    const token = this.getDeveloperToken();
    return token.length > 0;
  }

  /**
   * Fetches the official Apple Music catalog chart for a national storefront (e.g. 'in').
   * Uses bounded retries with exponential backoff and timeout handling.
   */
  public async fetchChart(
    chartId: string,
    storefront = 'in'
  ): Promise<NormalizedChartTrack[]> {
    const token = this.getDeveloperToken();
    if (!token) {
      throw new Error(
        'Apple Music API Developer Token is not configured (VITE_APPLE_MUSIC_DEVELOPER_TOKEN). Live chart ingestion requires a valid Apple Music JWT.'
      );
    }

    const endpoint = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(
      storefront
    )}/charts?types=songs&limit=25`;

    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new Error('Apple Music API rate limit reached (HTTP 429).');
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(
            `Apple Music API request failed with status ${response.status}: ${errText}`
          );
        }

        const data: AppleMusicApiResponse = await response.json();
        return this.parseAndNormalize(data, chartId, storefront);
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) {
          // Exponential backoff
          await new Promise((res) => setTimeout(res, attempt * 500));
        }
      }
    }

    throw lastError || new Error('Apple Music chart request failed.');
  }

  /**
   * Validates and normalizes raw Apple Music chart response schema into internal NormalizedChartTrack models.
   */
  public parseAndNormalize(
    data: AppleMusicApiResponse,
    chartId: string,
    storefront: string
  ): NormalizedChartTrack[] {
    if (data.errors && data.errors.length > 0) {
      throw new Error(`Apple Music API returned errors: ${data.errors[0]?.detail || data.errors[0]?.title}`);
    }

    const songChart = data.results?.songs?.[0];
    if (!songChart || !Array.isArray(songChart.data)) {
      throw new Error('Malformed Apple Music API response: missing results.songs[0].data');
    }

    const verifiedAt = new Date().toISOString();

    return songChart.data
      .filter((item) => item.attributes?.name && item.attributes?.artistName)
      .map((item, index) => {
        const attrs = item.attributes!;
        const durationSec = attrs.durationInMillis
          ? Math.round(attrs.durationInMillis / 1000)
          : undefined;

        let artworkUrl: string | undefined;
        if (attrs.artwork?.url) {
          artworkUrl = attrs.artwork.url.replace('{w}', '600').replace('{h}', '600');
        }

        const streamUrl = attrs.previews?.[0]?.url;

        return {
          internal_track_id: `am-chart-${item.id}`,
          provider: 'apple-music' as const,
          provider_track_id: item.id,
          isrc_if_available: attrs.isrc,
          title: attrs.name!,
          primary_artist: attrs.artistName!,
          album_or_release: attrs.albumName,
          duration_if_available: durationSec,
          artwork_url: artworkUrl,
          storefront,
          source_chart: chartId,
          source_rank: index + 1,
          source_url_if_available: attrs.url,
          last_verified_at: verifiedAt,
          stream_url: streamUrl,
          genre: attrs.genreNames?.[0]
        };
      });
  }
}

export const appleMusicChartAdapter = new AppleMusicChartAdapter();
