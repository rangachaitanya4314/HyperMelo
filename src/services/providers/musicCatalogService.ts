// Master Music Catalog Service for NARO (Frontend Adapter / Facade)
// Conforms to ICatalogService, delegating provider federation and deduplication
// to the backend CatalogAggregationService while maintaining 100% backward compatibility

import type {
  Song,
  ProviderResult,
  CatalogSection,
  ICatalogService,
  CatalogSearchOptions,
  CatalogSearchResult
} from '../../shared';
import { catalogAggregationService } from '../../backend/services/CatalogAggregationService';

export class MusicCatalogService implements ICatalogService {
  /**
   * Deduplicate multiple provider results into ONE clean canonical result per song
   */
  public deduplicateResults(results: ProviderResult[], query?: string): ProviderResult[] {
    return catalogAggregationService.deduplicateResults(results, query);
  }

  /**
   * Search connected music catalogs across federated providers
   */
  public async search(query: string, options?: CatalogSearchOptions): Promise<CatalogSearchResult> {
    return catalogAggregationService.search(query, options);
  }

  /**
   * Fetch dynamic discovery sections
   */
  public async getDiscoverySections(): Promise<CatalogSection[]> {
    return catalogAggregationService.getDiscoverySections();
  }

  /**
   * Return verified fallback catalog of genuine full-length tracks
   */
  public getFallbackCatalog(): Song[] {
    return catalogAggregationService.getFallbackCatalog();
  }

  /**
   * Direct track lookup by ID
   */
  public async getTrack(trackId: string): Promise<Song | null> {
    return catalogAggregationService.getTrack(trackId);
  }
}

export const musicCatalogService = new MusicCatalogService();
