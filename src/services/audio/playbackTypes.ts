// Playback Provider Abstraction Types for NARO
// Conforms to NARO Master Architecture & Provider Capability Model

import type { Song, PlaybackState, PlaybackAvailability, PlaybackSourceType } from '../../types/music';

export interface PlaybackClockEvent {
  currentTime: number;
  duration: number;
  bufferedTime: number;
  isPlaying: boolean;
  state: PlaybackState;
  error?: string;
  playbackType?: PlaybackAvailability;
  playbackSourceType?: PlaybackSourceType;
  providerId?: string;
}

export type PlaybackClockListener = (event: PlaybackClockEvent) => void;

export interface ProviderCapabilities {
  supportsFullLength: boolean;
  supportsSeek: boolean;
  supportsWebAudioRouting: boolean;
  supportsKaraokeProcessing: boolean;
  supportsLyrics: boolean;
  requiresAuthorization: boolean;
}

export interface MusicPlaybackProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  authenticate(): Promise<boolean>;
  isAuthorized(): boolean;
  canPlay(song: Song): boolean;
  canPlayFullLength(song: Song): boolean;

  load(song: Song, startTime?: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  seek(time: number): void;
  setVolume(volume: number): void;

  getCurrentTime(): number;
  getDuration(): number;
  getState(): PlaybackState;
  getVisualizerData(): Uint8Array | null;
  setBackingMode?(isBacking: boolean, backingUrl: string, vocalUrl?: string): void;
  dispose(): void;
  destroy?(): void;
}

export type PlaybackProvider = MusicPlaybackProvider;
