// Apple MusicKit Playback Provider for NARO
// Conforms to Apple Music Web Playback & NARO MusicPlaybackProvider specification

import type { Song, PlaybackState } from '../../shared';
import type { MusicPlaybackProvider, ProviderCapabilities, PlaybackClockListener, PlaybackClockEvent } from './playbackTypes';
import { appleMusicKitService } from '../providers/appleMusicKitService';

export class AppleMusicPlaybackProvider implements MusicPlaybackProvider {
  public readonly id = 'apple-music-kit';
  public readonly name = 'Apple MusicKit';

  public readonly capabilities: ProviderCapabilities = {
    supportsFullLength: true,
    supportsSeek: true,
    supportsWebAudioRouting: false, // EME DRM protected audio cannot be routed through WebAudio MediaElementAudioSourceNode
    supportsKaraokeProcessing: false,
    supportsLyrics: true,
    requiresAuthorization: true
  };

  private state: PlaybackState = 'idle';
  private currentSong: Song | null = null;
  private clockListener: PlaybackClockListener | null = null;
  private volume = 0.8;
  private clockPollTimer: number | null = null;

  constructor(clockListener?: PlaybackClockListener) {
    this.clockListener = clockListener || null;
  }

  public setClockListener(listener: PlaybackClockListener): void {
    this.clockListener = listener;
  }

  public async authenticate(): Promise<boolean> {
    return appleMusicKitService.authorize();
  }

  public isAuthorized(): boolean {
    return appleMusicKitService.isAuthorized();
  }

  public canPlay(song: Song): boolean {
    const isAppleTrack = song.playbackSource?.provider === 'apple-music' || !!song.playbackSource?.providerTrackId;
    return isAppleTrack && this.isAuthorized();
  }

  public canPlayFullLength(song: Song): boolean {
    return this.canPlay(song);
  }

  private emitClock(error?: string): void {
    if (!this.clockListener) return;
    const event: PlaybackClockEvent = {
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      bufferedTime: this.getCurrentTime(),
      isPlaying: this.state === 'playing',
      state: this.state,
      playbackType: 'full',
      playbackSourceType: 'official-provider',
      providerId: this.id,
      error
    };
    this.clockListener(event);
  }

  private startClockPoll(): void {
    this.stopClockPoll();
    this.clockPollTimer = window.setInterval(() => {
      this.emitClock();
    }, 200);
  }

  private stopClockPoll(): void {
    if (this.clockPollTimer !== null) {
      clearInterval(this.clockPollTimer);
      this.clockPollTimer = null;
    }
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    this.currentSong = song;
    this.state = 'loading';
    this.emitClock();

    const instance = appleMusicKitService.getMusicKitInstance() as {
      setQueue: (options: unknown) => Promise<void>;
      seekToTime?: (time: number) => Promise<void>;
    } | null;

    if (!instance || !this.isAuthorized()) {
      this.state = 'error';
      this.emitClock('Apple Music subscription authorization required for full-length playback.');
      throw new Error('Apple Music authorization required');
    }

    try {
      const trackId = song.playbackSource?.providerTrackId || song.id.replace('am-', '');
      await instance.setQueue({ song: trackId });

      if (startTime > 0 && instance.seekToTime) {
        await instance.seekToTime(startTime);
      }

      this.state = 'ready';
      this.emitClock();
    } catch (err: unknown) {
      this.state = 'error';
      const msg = err instanceof Error ? err.message : 'Failed to queue song in Apple MusicKit.';
      this.emitClock(msg);
      throw err;
    }
  }

  public async play(): Promise<void> {
    const instance = appleMusicKitService.getMusicKitInstance() as {
      play: () => Promise<void>;
    } | null;

    if (!instance) {
      throw new Error('MusicKit instance not ready');
    }

    try {
      await instance.play();
      this.state = 'playing';
      this.startClockPoll();
      this.emitClock();
    } catch (err: unknown) {
      this.state = 'error';
      const msg = err instanceof Error ? err.message : 'Playback failed in MusicKit.';
      this.emitClock(msg);
      throw err;
    }
  }

  public pause(): void {
    const instance = appleMusicKitService.getMusicKitInstance() as {
      pause: () => void;
    } | null;

    if (instance) {
      instance.pause();
    }
    this.state = 'paused';
    this.stopClockPoll();
    this.emitClock();
  }

  public async resume(): Promise<void> {
    return this.play();
  }

  public seek(time: number): void {
    const instance = appleMusicKitService.getMusicKitInstance() as {
      seekToTime?: (time: number) => Promise<void>;
    } | null;

    if (instance && instance.seekToTime) {
      instance.seekToTime(time).catch(() => {});
    }
    this.emitClock();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    const instance = appleMusicKitService.getMusicKitInstance() as {
      volume?: number;
    } | null;
    if (instance && 'volume' in instance) {
      instance.volume = this.volume;
    }
  }

  public getCurrentTime(): number {
    const instance = appleMusicKitService.getMusicKitInstance() as {
      currentPlaybackTime?: number;
    } | null;
    return instance?.currentPlaybackTime || 0;
  }

  public getDuration(): number {
    const instance = appleMusicKitService.getMusicKitInstance() as {
      currentPlaybackDuration?: number;
    } | null;
    return instance?.currentPlaybackDuration || this.currentSong?.fullTrackDuration || this.currentSong?.duration || 180;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getVisualizerData(): Uint8Array | null {
    return null; // DRM protected audio prevents direct FFT frequency sampling
  }

  public dispose(): void {
    this.stopClockPoll();
    this.pause();
    this.state = 'idle';
  }

  public destroy(): void {
    this.dispose();
  }
}
