// Backend Catalog Aggregation Service for NARO
// Implements ICatalogService contract behind backend boundary
// Multi-provider federation (NARO Licensed, Apple Music, YouTube), deduplication, and discovery curation

import type {
  Song,
  ProviderResult,
  CatalogSection,
  ICatalogService,
  CatalogSearchOptions,
  CatalogSearchResult
} from '../../shared';
import { naroCatalogProvider } from '../../services/providers/NaroCatalogProvider';
import { appleMusicCatalogProvider } from '../../services/providers/AppleMusicCatalogProvider';
import { connectivityService } from '../../services/connectivity/connectivityService';
import { playbackSourceResolver } from './PlaybackSourceResolver';

export class CatalogAggregationService implements ICatalogService {
  private inMemoryCache: Map<string, Song[]> = new Map();

  /**
   * Helper to normalize text for strong fuzzy matching & deduplication
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[[({].*?[)\]}]/g, '') // remove (feat. ...), [Remix], etc.
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Deduplicate multiple provider results into ONE clean canonical result per song
   */
  public deduplicateResults(results: ProviderResult[], query?: string): ProviderResult[] {
    const cleanQ = query ? this.normalizeString(query) : '';
    const canonicalMap = new Map<string, ProviderResult>();

    for (const item of results) {
      const normTitle = this.normalizeString(item.title);
      const isInstrumental = /instrumental|karaoke/i.test(item.title);
      const isRemix = /remix|lofi|flip/i.test(item.title);

      // Key on normalized title to collapse duplicate album releases
      const key = normTitle;

      if (!canonicalMap.has(key)) {
        canonicalMap.set(key, item);
      } else {
        const existing = canonicalMap.get(key)!;
        const existingIsVariant = /remix|unplugged|lofi|instrumental/i.test(existing.title);
        const thisIsOriginal = !isRemix && !isInstrumental && !/unplugged/i.test(item.title);

        // An official commercial track ALWAYS supersedes a dev-fixture
        if (existing.playbackSourceType === 'dev-fixture' && item.playbackSourceType !== 'dev-fixture') {
          canonicalMap.set(key, item);
        } else if (item.playbackSourceType === 'dev-fixture') {
          // A dev-fixture never overwrites an existing genuine commercial track
          if (existing.playbackSourceType === 'dev-fixture') {
            if (!existing.artworkUrl && item.artworkUrl) {
              existing.artworkUrl = item.artworkUrl;
            }
          }
        } else if (existingIsVariant && thisIsOriginal) {
          canonicalMap.set(key, item);
        } else if (!existing.streamUrl && item.streamUrl) {
          existing.streamUrl = item.streamUrl;
          existing.playbackAvailability = true;
          existing.playbackType = item.playbackType;
          existing.playbackSourceType = item.playbackSourceType;
        }
        if (!existing.artworkUrl && item.artworkUrl) {
          existing.artworkUrl = item.artworkUrl;
        }
        if ((!existing.duration || existing.duration === 30) && item.duration && item.duration !== 30) {
          existing.duration = item.duration;
        }
        if (item.karaokeAvailability && item.karaokeSource?.availability === 'available' && item.playbackSourceType !== 'dev-fixture') {
          existing.karaokeAvailability = true;
          existing.karaokeSource = item.karaokeSource;
        }
      }
    }

    let list = Array.from(canonicalMap.values());

    // If query matches a canonical song title (e.g. "Channa Mereya"), return ONE canonical result!
    if (cleanQ && list.some((item) => this.normalizeString(item.title) === cleanQ)) {
      list = list.filter((item) => this.normalizeString(item.title) === cleanQ);
    }

    return list;
  }

  /**
   * Search connected music catalogs across federated providers
   */
  public async search(
    query: string,
    options?: CatalogSearchOptions
  ): Promise<CatalogSearchResult> {
    const q = query.trim();
    if (!q) {
      return { songs: [], isOffline: !connectivityService.isOnline };
    }

    // Check if offline: online streaming/search is unavailable, never fake playback
    if (!connectivityService.isOnline) {
      return {
        songs: [],
        isOffline: true,
        message: "You're offline. Connect to the internet to search and stream music."
      };
    }

    // Check cache
    const cacheKey = `search_${q.toLowerCase()}`;
    if (this.inMemoryCache.has(cacheKey)) {
      return { songs: this.inMemoryCache.get(cacheKey)!, isOffline: false };
    }

    try {
      // 1. Query online catalogs and NARO catalog concurrently
      const [naroResults, appleResults] = await Promise.all([
        naroCatalogProvider.search(q, { limit: options?.limit || 5 }),
        appleMusicCatalogProvider.search(q, { limit: options?.limit || 20 })
      ]);

      // 2. Combine and deduplicate into ONE canonical result per song
      const merged = this.deduplicateResults([...naroResults, ...appleResults], q);

      // 3. Normalize concurrently using Promise.all for high responsiveness
      const normalizedSongs = await Promise.all(
        merged.map(async (item) => {
          if (item.provider === 'naro') {
            const track = await naroCatalogProvider.getTrack(item.providerTrackId);
            if (track) {
              if (item.artworkUrl) {
                track.artwork.imageUrl = item.artworkUrl;
              }
              return track;
            }
          }
          return appleMusicCatalogProvider.normalizeSong(item);
        })
      );

      let validSongs = normalizedSongs.filter((s): s is Song => s !== null);

      if (options?.includeDevFixtures === false) {
        validSongs = validSongs.filter((s) => s.playbackSourceType !== 'dev-fixture');
      }

      // Resolve genuine full-length audio sources for eligible catalog tracks
      const resolvedSongs = await Promise.all(
        validSongs.map((s) => playbackSourceResolver.resolvePlaybackSource(s))
      );

      this.inMemoryCache.set(cacheKey, resolvedSongs);
      return { songs: resolvedSongs, isOffline: false };
    } catch (err) {
      console.warn('Catalog search error, returning fallback results:', err);
      return {
        songs: [],
        isOffline: false,
        message: 'Could not connect to live music catalogs right now.'
      };
    }
  }

  /**
   * Fetch dynamic discovery sections (Trending, Made for You, Indian Music, Midnight)
   */
  public async getDiscoverySections(): Promise<CatalogSection[]> {
    const rawFallback = naroCatalogProvider.getRawCatalog();
    const consumerFallback = rawFallback.filter(
      (s) => s.playbackSourceType !== 'dev-fixture' && s.fullLengthAvailable === true
    );

    if (!connectivityService.isOnline) {
      // Offline mode: provide sections from fallback catalog
      return [
        {
          id: 'made-for-you',
          title: 'MADE FOR YOU',
          subtitle: 'Curated tracks engineered for active listening and moment-by-moment karaoke.',
          songs: consumerFallback,
          isDynamicLive: false
        }
      ];
    }

    // Online mode: build rich dynamic sections
    try {
      const [trendingSongs, indianSongs, midnightSongs] = await Promise.all([
        appleMusicCatalogProvider.getTrending('all'),
        appleMusicCatalogProvider.getTrending('hindi'),
        appleMusicCatalogProvider.getTrending('midnight')
      ]);

      // Concurrently resolve full-length playable sources for top trending tracks
      const [resolvedTrending, resolvedIndian, resolvedMidnight] = await Promise.all([
        Promise.all(trendingSongs.slice(0, 8).map((s) => playbackSourceResolver.resolvePlaybackSource(s))),
        Promise.all(indianSongs.slice(0, 8).map((s) => playbackSourceResolver.resolvePlaybackSource(s))),
        Promise.all(midnightSongs.slice(0, 8).map((s) => playbackSourceResolver.resolvePlaybackSource(s)))
      ]);

      const sections: CatalogSection[] = [
        {
          id: 'made-for-you',
          title: 'MADE FOR YOU',
          subtitle: 'Curated tracks engineered for active listening and moment-by-moment karaoke.',
          songs: consumerFallback,
          isDynamicLive: true
        }
      ];

      if (resolvedTrending.length > 0) {
        sections.push({
          id: 'trending-now',
          title: 'TRENDING NOW',
          subtitle: 'Live global & chart-topping tracks streaming directly inside NARO.',
          songs: resolvedTrending,
          isDynamicLive: true
        });
      }

      if (resolvedIndian.length > 0) {
        sections.push({
          id: 'indian-music',
          title: 'INDIAN MUSIC & HITS',
          subtitle: 'Hindi, Telugu, and South Asian sensations with mapped karaoke moments.',
          songs: resolvedIndian,
          isDynamicLive: true
        });
      }

      if (resolvedMidnight.length > 0) {
        sections.push({
          id: 'midnight-vibes',
          title: 'MIDNIGHT & VIBES',
          subtitle: 'Late-night indie, synth-pop, and intimate retro acoustics.',
          songs: resolvedMidnight,
          isDynamicLive: true
        });
      }

      return sections;
    } catch {
      return [
        {
          id: 'made-for-you',
          title: 'MADE FOR YOU',
          subtitle: 'Curated tracks engineered for active listening and moment-by-moment karaoke.',
          songs: consumerFallback,
          isDynamicLive: false
        }
      ];
    }
  }

  /**
   * Return verified fallback catalog of genuine full-length tracks
   */
  public getFallbackCatalog(): Song[] {
    return naroCatalogProvider
      .getRawCatalog()
      .filter((s) => s.playbackSourceType !== 'dev-fixture' && s.fullLengthAvailable === true);
  }

  /**
   * Direct track lookup by ID
   */
  public async getTrack(trackId: string): Promise<Song | null> {
    const naroTrack = await naroCatalogProvider.getTrack(trackId);
    if (naroTrack) return naroTrack;
    const appleTrack = await appleMusicCatalogProvider.getTrack(trackId);
    if (!appleTrack) return null;
    return playbackSourceResolver.resolvePlaybackSource(appleTrack);
  }
}

export const catalogAggregationService = new CatalogAggregationService();
