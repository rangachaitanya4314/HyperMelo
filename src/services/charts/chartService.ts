// Chart Engine Service Orchestrator for HyperMelo
// Coordinates provider-independent chart ingestion, snapshot persistence,
// rank movement calculation, honest status reporting, and track playback conversion.

import type {
  ChartSnapshot,
  ChartDestination,
  NormalizedChartTrack
} from './types';
import { chartSnapshotStore, ChartSnapshotStore } from './snapshotStore';
import { appleMusicChartAdapter, AppleMusicChartAdapter } from './appleMusicChartAdapter';
import { editorialFallbackAdapter, EditorialFallbackAdapter } from './editorialFallbackAdapter';
import { liveCatalogAdapter, LiveCatalogAdapter, LANGUAGE_CATALOG_CONFIGS } from './liveCatalogAdapter';
import { calculateRankMovements } from './movement';
import type { Song, ArtworkStyle, KaraokeSource, PlaybackAvailability } from '../../types/music';
import { SONGS, ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../../data/songs';
import { getAllCuratedSongs } from '../../data/curatedCatalog';
import { isArtistMatch } from '../../shared/track';
import { getVerifiedSongArtwork } from '../../data/verifiedArtwork';

export const CHART_DESTINATIONS: ChartDestination[] = [
  {
    id: 'trending-india',
    label: 'Trending in India',
    type: 'official-chart',
    storefront: 'in',
    description:
      'National top songs in the India storefront. Powered by Apple Music API when developer token is configured; otherwise transparently serves curated editorial picks.'
  },
  {
    id: 'hindi-top-10',
    label: 'Popular Hindi Songs',
    type: 'live-catalog',
    storefront: 'in',
    language: 'hi',
    description:
      'Live online catalog discoveries for Hindi music. Powered by Apple Music Online Catalog Discovery with curated editorial fallback.'
  },
  {
    id: 'telugu-top-10',
    label: 'Popular Telugu Songs',
    type: 'live-catalog',
    storefront: 'in',
    language: 'te',
    description:
      'Live online catalog discoveries for Telugu music. Powered by Apple Music Online Catalog Discovery with curated editorial fallback.'
  },
  {
    id: 'tamil-top-10',
    label: 'Popular Tamil Songs',
    type: 'live-catalog',
    storefront: 'in',
    language: 'ta',
    description:
      'Live online catalog discoveries for Tamil music. Powered by Apple Music Online Catalog Discovery with curated editorial fallback.'
  },
  {
    id: 'malayalam-top-10',
    label: 'Popular Malayalam Songs',
    type: 'live-catalog',
    storefront: 'in',
    language: 'ml',
    description:
      'Live online catalog discoveries for Malayalam music. Powered by Apple Music Online Catalog Discovery with curated editorial fallback.'
  },
  {
    id: 'english-top-10',
    label: 'Popular English Songs',
    type: 'live-catalog',
    storefront: 'in',
    language: 'en',
    description:
      'Live online catalog discoveries for English music. Powered by Apple Music Online Catalog Discovery with curated editorial fallback.'
  }
];

export class ChartService {
  private store: ChartSnapshotStore;
  private appleAdapter: AppleMusicChartAdapter;
  private editorialAdapter: EditorialFallbackAdapter;
  private liveCatalogAdapter: LiveCatalogAdapter;

  constructor(
    store = chartSnapshotStore,
    appleAdapter = appleMusicChartAdapter,
    editorialAdapter = editorialFallbackAdapter,
    liveCatalogAdapterInstance = liveCatalogAdapter
  ) {
    this.store = store;
    this.appleAdapter = appleAdapter;
    this.editorialAdapter = editorialAdapter;
    this.liveCatalogAdapter = liveCatalogAdapterInstance;
  }

  /**
   * Reports whether live provider credentials (e.g. Apple Music developer token) are operational
   */
  public isLiveIngestionConfigured(): boolean {
    return this.appleAdapter.isConfigured();
  }

  /**
   * Returns metadata for all supported chart destinations
   */
  public getDestinations(): ChartDestination[] {
    return CHART_DESTINATIONS;
  }

  /**
   * Retrieves or refreshes a chart snapshot by chart destination ID
   */
  /**
   * Retrieves or refreshes a chart snapshot by chart destination ID
   */
  public async getChart(
    chartId: string,
    forceRefresh = false,
    signal?: AbortSignal
  ): Promise<ChartSnapshot> {
    const destination = CHART_DESTINATIONS.find((d) => d.id === chartId);
    const storefront = destination?.storefront || 'in';
    const chartTitle = destination?.label || chartId;

    const existingSnapshot = this.store.getSnapshot(chartId);

    // If cache is fresh (< 30 minutes) and not forced, return cached snapshot
    if (existingSnapshot && !forceRefresh) {
      const retrieved = new Date(existingSnapshot.retrieved_at).getTime();
      const ageMs = Date.now() - retrieved;
      if (ageMs < 30 * 60 * 1000) {
        return existingSnapshot;
      }
    }

    return this.refreshChart(chartId, storefront, chartTitle, existingSnapshot, signal);
  }

  /**
   * Performs real ingestion or fallback refresh, calculates rank movement, and persists snapshot
   */
  public async refreshChart(
    chartId: string,
    storefront = 'in',
    chartTitle?: string,
    previousSnapshot: ChartSnapshot | null = null,
    signal?: AbortSignal
  ): Promise<ChartSnapshot> {
    const title = chartTitle || CHART_DESTINATIONS.find((d) => d.id === chartId)?.label || chartId;
    const now = new Date().toISOString();
    const prev = previousSnapshot || this.store.getSnapshot(chartId);

    // 1. If this is a live language catalog destination:
    if (chartId in LANGUAGE_CATALOG_CONFIGS) {
      try {
        const rawTracks = await this.liveCatalogAdapter.fetchLanguageCatalog(chartId, 20, signal);
        const { updatedTracks } = calculateRankMovements(rawTracks, prev);

        const snapshot: ChartSnapshot = {
          chart_id: chartId,
          chart_title: title,
          storefront,
          provider: 'apple-music-live',
          is_official: false,
          source_attribution: 'Apple Music Online Catalog Discovery · Live language picks',
          retrieved_at: now,
          tracks: updatedTracks,
          status: 'live'
        };

        this.store.saveSnapshot(snapshot);
        return snapshot;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw err;
        }
        console.warn(`[ChartService] Live catalog fetch failed for ${chartId}:`, err);

        // Fallback: Preserve last known good snapshot if available, mark as stale
        const lastGood = this.store.getLastKnownGoodSnapshot(chartId);
        if (lastGood && lastGood.tracks.length > 0) {
          const staleSnapshot: ChartSnapshot = {
            ...lastGood,
            status: 'stale',
            failure_reason: `Live provider refresh failed: ${err.message}. Retaining last known good snapshot.`
          };
          this.store.saveSnapshot(staleSnapshot);
          return staleSnapshot;
        }

        // If no last good snapshot, fall back to editorial picks with honest disclaimer
        const fallbackTracks = await this.editorialAdapter.fetchChart(chartId, storefront);
        const { updatedTracks } = calculateRankMovements(fallbackTracks, null);

        const fallbackSnapshot: ChartSnapshot = {
          chart_id: chartId,
          chart_title: title,
          storefront,
          provider: 'naro-editorial',
          is_official: false,
          source_attribution: 'HyperMelo Editorial Catalog Picks (Provider Offline)',
          retrieved_at: now,
          tracks: updatedTracks,
          status: 'editorial',
          failure_reason: `Live catalog request failed (${err.message}). Displaying curated editorial picks.`
        };

        this.store.saveSnapshot(fallbackSnapshot);
        return fallbackSnapshot;
      }
    }

    // 2. If this is the Trending in India destination AND Apple Music token is configured:
    if (chartId === 'trending-india' && this.appleAdapter.isConfigured()) {
      try {
        const rawTracks = await this.appleAdapter.fetchChart(chartId, storefront);
        const { updatedTracks } = calculateRankMovements(rawTracks, prev);

        const snapshot: ChartSnapshot = {
          chart_id: chartId,
          chart_title: title,
          storefront,
          provider: 'apple-music',
          is_official: true,
          source_attribution: 'Official Apple Music Catalog Charts (India Storefront)',
          retrieved_at: now,
          tracks: updatedTracks,
          status: 'live'
        };

        this.store.saveSnapshot(snapshot);
        return snapshot;
      } catch (err: any) {
        console.warn(`[ChartService] Live Apple Music fetch failed for ${chartId}:`, err);

        // Fallback: Preserve last known good snapshot if available, mark as stale
        const lastGood = this.store.getLastKnownGoodSnapshot(chartId);
        if (lastGood && lastGood.tracks.length > 0) {
          const staleSnapshot: ChartSnapshot = {
            ...lastGood,
            status: 'stale',
            failure_reason: `Live provider refresh failed: ${err.message}. Retaining last known good snapshot.`
          };
          this.store.saveSnapshot(staleSnapshot);
          return staleSnapshot;
        }

        // If no last good snapshot, fall back to editorial picks with honest disclaimer
        const fallbackTracks = await this.editorialAdapter.fetchChart(chartId, storefront);
        const { updatedTracks } = calculateRankMovements(fallbackTracks, null);

        const fallbackSnapshot: ChartSnapshot = {
          chart_id: chartId,
          chart_title: title,
          storefront,
          provider: 'naro-editorial',
          is_official: false,
          source_attribution: 'HyperMelo Editorial Catalog Picks (Provider Offline)',
          retrieved_at: now,
          tracks: updatedTracks,
          status: 'editorial',
          failure_reason: `Apple Music live chart request failed (${err.message}). Displaying editorial picks.`
        };

        this.store.saveSnapshot(fallbackSnapshot);
        return fallbackSnapshot;
      }
    }

    // 3. Otherwise, fetch from editorial fallback adapter with honest labeling
    try {
      const fallbackTracks = await this.editorialAdapter.fetchChart(chartId, storefront);
      const { updatedTracks } = calculateRankMovements(fallbackTracks, prev);

      const isLiveTokenMissing = chartId === 'trending-india';
      const failureReason = isLiveTokenMissing
        ? 'Apple Music API Developer Token is not configured (VITE_APPLE_MUSIC_DEVELOPER_TOKEN). Displaying curated editorial picks.'
        : undefined;

      const snapshot: ChartSnapshot = {
        chart_id: chartId,
        chart_title: title,
        storefront,
        provider: 'naro-editorial',
        is_official: false,
        source_attribution: 'HyperMelo Curated Picks · Not an official provider ranking',
        retrieved_at: now,
        tracks: updatedTracks,
        status: 'editorial',
        failure_reason: failureReason
      };

      this.store.saveSnapshot(snapshot);
      return snapshot;
    } catch (err: any) {
      const lastGood = this.store.getLastKnownGoodSnapshot(chartId);
      if (lastGood) {
        return {
          ...lastGood,
          status: 'stale',
          failure_reason: `Chart refresh failed: ${err.message}`
        };
      }

      return {
        chart_id: chartId,
        chart_title: title,
        storefront,
        provider: 'naro-editorial',
        is_official: false,
        source_attribution: 'Unavailable',
        retrieved_at: now,
        tracks: [],
        status: 'unavailable',
        failure_reason: err.message
      };
    }
  }

  /**
   * Converts a NormalizedChartTrack into a full Song object so that clicking a chart track
   * plays seamlessly in the player and NowPlaying views with proper identity and capabilities.
   */
  public toSong(chartTrack: NormalizedChartTrack): Song {
    // 1. Check if song already exists in canonical catalog (e.g. Gaali Vaaluga, Shot Down, or Curated Catalog)
    const exactLocalMatch = [
      ANIRUDH_GAALI_VAALUGA,
      JOSH_WOODWARD_SHOT_DOWN,
      ...SONGS,
      ...getAllCuratedSongs()
    ].find(
      (s) =>
        s.id === chartTrack.provider_track_id ||
        (s.title.toLowerCase() === chartTrack.title.toLowerCase() &&
          isArtistMatch(s.artist, chartTrack.primary_artist))
    );

    const verifiedArt =
      chartTrack.artwork_url ||
      exactLocalMatch?.artwork?.imageUrl ||
      getVerifiedSongArtwork({
        id: chartTrack.internal_track_id,
        title: chartTrack.title,
        artist: chartTrack.primary_artist
      });

    if (exactLocalMatch) {
      return {
        ...exactLocalMatch,
        artwork: {
          ...exactLocalMatch.artwork,
          imageUrl: verifiedArt || exactLocalMatch.artwork?.imageUrl
        }
      };
    }

    // 2. Synthesize complete Song model with artwork, playbackSource, and karaokeSource
    const artwork: ArtworkStyle = {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8',
      accentCream: '#F4DFC9',
      imageUrl: verifiedArt
    };

    const isPreview =
      !!chartTrack.stream_url &&
      (chartTrack.stream_url.includes('mzstatic') ||
        chartTrack.stream_url.includes('apple.com') ||
        chartTrack.stream_url.includes('itunes'));
    const playableDuration = chartTrack.duration_if_available || 180;
    const playbackType: PlaybackAvailability = chartTrack.stream_url
      ? isPreview
        ? 'preview'
        : 'full'
      : 'unavailable';

    const isAppleProvider =
      chartTrack.provider === 'apple-music' || chartTrack.provider === 'apple-music-live';

    const karaokeSource: KaraokeSource = {
      type: 'instrumental',
      provider: isAppleProvider ? 'apple-music' : 'naro',
      providerTrackId: chartTrack.provider_track_id,
      availability: 'unavailable'
    };

    return {
      id: chartTrack.internal_track_id,
      title: chartTrack.title,
      artist: chartTrack.primary_artist,
      album: chartTrack.album_or_release || chartTrack.title,
      duration: playableDuration,
      fullTrackDuration: chartTrack.duration_if_available || playableDuration,
      isStreamPreview: isPreview,
      fullLengthAvailable: !isPreview && !!chartTrack.stream_url,
      previewAvailable: isPreview,
      playbackAvailable: !!chartTrack.stream_url,
      playbackType,
      playbackAvailability: playbackType,
      playbackSourceType: isPreview ? 'preview' : 'open-license',
      playbackProvider: isAppleProvider ? 'apple-music' : 'naro',
      karaokeReady: false,
      karaokeAvailable: false,
      karaokeAvailability: 'unavailable',
      karaokeSource,
      lyricsAvailable: false,
      lyricsSyncAvailable: false,
      genre: chartTrack.genre || 'Popular Music',
      language: chartTrack.language_if_verified,
      bpm: 100,
      musicalKey: 'C Major',
      lyrics: {},
      artwork,
      sections: [
        { type: 'verse', label: 'Verse', start: 0, end: Math.floor(playableDuration * 0.4) },
        { type: 'chorus', label: 'Chorus', start: Math.floor(playableDuration * 0.4), end: playableDuration }
      ],
      playbackSource: chartTrack.stream_url
        ? {
            provider: isAppleProvider ? 'apple-music' : 'naro',
            providerTrackId: chartTrack.provider_track_id,
            streamUrl: chartTrack.stream_url,
            format: 'mp3',
            isStreamPreview: isPreview,
            playbackSourceType: isPreview ? 'preview' : 'open-license'
          }
        : undefined,
      capabilities: {
        playback: !!chartTrack.stream_url,
        playbackAvailable: !!chartTrack.stream_url,
        playbackType,
        playbackSourceType: isPreview ? 'preview' : 'open-license',
        lyrics: false,
        lyricsAvailable: false,
        lyricsSyncAvailable: false,
        karaoke: false,
        karaokeAvailable: false,
        recording: false
      }
    };
  }
}

export const chartService = new ChartService();
