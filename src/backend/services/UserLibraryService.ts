// Backend User Library Service for NARO
// Implements IUserLibraryService contract behind backend boundary
// Manages saved moments, takes, and user library metadata
// Currently backed by local IndexedDB engine, prepared for cloud sync

import type {
  RecordedTake,
  TakeMetadata,
  IUserLibraryService,
  IRecordingStorageService,
  LibraryQueryOptions
} from '../../shared';
import { indexedDbService } from '../../services/storage/indexedDbService';

export class UserLibraryService implements IUserLibraryService, IRecordingStorageService {
  /**
   * Retrieve all saved moments, ordered by most recent first
   */
  public async getAllTakes(options?: LibraryQueryOptions): Promise<RecordedTake[]> {
    const takes = await indexedDbService.getAllTakes();

    if (!options) return takes;

    let results = [...takes];

    // Sorting
    if (options.sortBy) {
      const field = options.sortBy;
      const order = options.order === 'asc' ? 1 : -1;
      results.sort((a, b) => {
        if (field === 'recordedAt') return (a.recordedAt - b.recordedAt) * order;
        if (field === 'duration') return (a.duration - b.duration) * order;
        if (field === 'title') return a.songTitle.localeCompare(b.songTitle) * order;
        return 0;
      });
    }

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit !== undefined ? options.limit : results.length;
    return results.slice(offset, offset + limit);
  }

  /**
   * Retrieve a single take by ID
   */
  public async getTakeById(id: string): Promise<RecordedTake | null> {
    return indexedDbService.getTakeById(id);
  }

  /**
   * Retrieve take by ID (IRecordingStorageService implementation)
   */
  public async getTake(id: string): Promise<RecordedTake | null> {
    return this.getTakeById(id);
  }

  /**
   * Persist a take with binary audio
   */
  public async saveTake(take: RecordedTake): Promise<void> {
    return indexedDbService.saveTake(take);
  }

  /**
   * Delete a take by ID
   */
  public async deleteTake(id: string): Promise<void> {
    return indexedDbService.deleteTake(id);
  }

  /**
   * Retrieve take metadata without reconstructing full blob URLs
   */
  public async getAllTakeMetadata(): Promise<TakeMetadata[]> {
    const takes = await indexedDbService.getAllTakes();
    return takes.map(({ audioBlob: _blob, audioBlobUrl: _url, ...meta }) => meta);
  }

  /**
   * Helper to trigger download of recorded take file
   */
  public triggerDownload(take: RecordedTake): void {
    indexedDbService.triggerDownload(take);
  }
}

export const userLibraryService = new UserLibraryService();
