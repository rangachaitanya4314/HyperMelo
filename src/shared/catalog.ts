// Canonical Backend-Facing Catalog Service Contracts for NARO

import type { Song, CatalogSection } from './track';
import type { ProviderResult, SearchOptions } from './providers';

export interface CatalogSearchOptions extends SearchOptions {
  includeDevFixtures?: boolean;
}

export interface CatalogSearchResult {
  songs: Song[];
  isOffline: boolean;
  message?: string;
}

/**
 * Backend-facing Catalog Service Contract.
 * Abstracts provider federation (Apple Music, YouTube, NARO licensed),
 * cross-catalog deduplication, dynamic discovery curation, and fallback handling.
 */
export interface ICatalogService {
  search(query: string, options?: CatalogSearchOptions): Promise<CatalogSearchResult>;
  getDiscoverySections(): Promise<CatalogSection[]>;
  getFallbackCatalog(): Song[];
  deduplicateResults(results: ProviderResult[], query?: string): ProviderResult[];
}
