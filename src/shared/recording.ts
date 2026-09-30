// Canonical User Recording and Performance Review Contracts for NARO
// Zero fabricated pitch scores, percentages, or stars
// Truthful unavailable states: analysisStatus: 'unavailable'

import type { Language } from './lyrics';
import type { SectionType, ArtworkStyle } from './track';

export interface RecordedTake {
  id: string;
  songId: string;
  songTitle: string;
  artist: string;
  section: SectionType;
  sectionLabel: string;
  language: Language;
  recordedAt: number; // epoch timestamp
  duration: number;   // duration in seconds
  audioBlob?: Blob;
  audioBlobUrl?: string;
  artwork?: ArtworkStyle;
  isRealRecording: boolean;
  analysisStatus: 'unavailable' | 'pending' | 'completed';
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
