// Canonical User Recording and Performance Review Contracts for NARO
// Zero fabricated pitch scores, percentages, or stars
// Truthful unavailable states: analysisStatus: 'unavailable'

import type { Language } from './lyrics';
import type { SectionType, ArtworkStyle } from './track';

/**
 * Pure take metadata decoupled from the browser binary audio Blob.
 * Suitable for cloud persistence, database tables, and API responses.
 */
export interface TakeMetadata {
  id: string;
  songId: string;
  songTitle: string;
  artist: string;
  section: SectionType;
  sectionLabel: string;
  language: Language;
  recordedAt: number; // epoch timestamp
  duration: number;   // duration in seconds
  artwork?: ArtworkStyle;
  isRealRecording: boolean;
  analysisStatus: 'unavailable' | 'pending' | 'completed';
}

export interface RecordedTake extends TakeMetadata {
  audioBlob?: Blob;
  audioBlobUrl?: string;
}

/**
 * Backend-facing Recording Storage Service Contract.
 * Separates binary audio blob upload/download from browser recording lifecycle.
 */
export interface IRecordingStorageService {
  saveTake(take: RecordedTake): Promise<void>;
  getTake(id: string): Promise<RecordedTake | null>;
  deleteTake(id: string): Promise<void>;
  getAllTakes(): Promise<RecordedTake[]>;
}

export interface StartRecordingResult {
  success: boolean;
  error?: 'denied' | 'not_found' | 'unsupported' | 'unknown';
  errorMessage?: string;
}

export interface StopRecordingResult {
  success: boolean;
  audioBlob?: Blob;
  audioBlobUrl?: string;
  duration: number;
}
