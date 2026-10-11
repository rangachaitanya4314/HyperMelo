// Canonical Playback Engine and Provider Contracts for NARO

import type {
  PlaybackState,
  PlaybackAvailability,
  PlaybackSourceType,
  ProviderCapabilities
} from './capabilities';
import type { Song } from './track';

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
  setBackingMode?(isBacking: boolean, backingUrl: string, vocalUrl?: string, seekTime?: number): void;
  dispose(): void;
  destroy?(): void;
}

export type PlaybackProvider = MusicPlaybackProvider;
