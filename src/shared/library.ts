// Canonical User Library Persistence Contracts for NARO

import type { RecordedTake, TakeMetadata } from './recording';

export interface LibraryQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'recordedAt' | 'title' | 'duration';
  order?: 'asc' | 'desc';
}

/**
 * Backend-facing User Library Persistence Contract.
 * Abstracts persistence for user-recorded takes and saved library collections.
 * Currently backed by browser IndexedDB, ready for future cloud synchronization.
 */
export interface IUserLibraryService {
  getAllTakes(options?: LibraryQueryOptions): Promise<RecordedTake[]>;
  getTakeById(id: string): Promise<RecordedTake | null>;
  saveTake(take: RecordedTake): Promise<void>;
  deleteTake(id: string): Promise<void>;
  getAllTakeMetadata?(): Promise<TakeMetadata[]>;
  triggerDownload?(take: RecordedTake): void;
}
