// Vocal Separation Engine Interface and Types for NARO
// Conforms to NARO Master Core Architecture Section 4

import type { Song } from '../../../types/music';

export type SeparationEngineType =
  | 'licensed_stems'
  | 'web_audio_dsp'
  | 'spectral_chunk'
  | 'hybrid';

export interface SeparationProgress {
  trackId: string;
  progress: number; // 0 to 1
  phase: 'idle' | 'analyzing' | 'suppressing' | 'ready';
  startTime?: number;
  duration?: number;
}

export type SeparationProgressListener = (progress: SeparationProgress) => void;

export interface KaraokeSeparationEngine {
  /**
   * Check whether this engine can process and suppress vocals for the given track
   */
  canProcess(track: Song): boolean;

  /**
   * Prepare the engine for the track around the initial playback position
   */
  prepare(track: Song): Promise<void>;

  /**
   * Process the full track or initialize real-time separation graph
   */
  process(track: Song): Promise<void>;

  /**
   * Process a chunk of audio ahead of the playhead
   */
  processChunk(track: Song, startTime: number, duration: number): Promise<AudioBuffer | null>;

  /**
   * Retrieve cached or generated instrumental buffer for a time offset
   */
  getInstrumentalChunk(track: Song, startTime: number): AudioBuffer | null;

  /**
   * Retrieve isolated vocal buffer if available
   */
  getVocalsChunk(track: Song, startTime: number): AudioBuffer | null;

  /**
   * Check if instrumental output is ready at the given timeline position
   */
  isReady(track: Song, startTime?: number): boolean;

  /**
   * Cancel ongoing background processing for the track
   */
  cancel(track: Song): void;

  /**
   * Dispose resources and free allocated memory
   */
  dispose(track: Song): void;
}
