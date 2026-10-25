// NARO Full-Length Authorized Playback Provider
// Delivers full-length licensed music streaming with complete Web Audio DSP vocal suppression
// Supports instant seeking across entire timeline (60s, 120s, 180s) and unified clock broadcast

import type { Song, PlaybackState } from '../../shared';
import type { MusicPlaybackProvider, ProviderCapabilities, PlaybackClockListener, PlaybackClockEvent } from './playbackTypes';
import { karaokeMixer } from './karaokeMixer';

export class NaroFullLengthPlaybackProvider implements MusicPlaybackProvider {
  public readonly id = 'naro-full-length';
  public readonly name = 'NARO Full-Length Player';

  public readonly capabilities: ProviderCapabilities = {
    supportsFullLength: true,
    supportsSeek: true,
    supportsWebAudioRouting: true,
    supportsKaraokeProcessing: true,
    supportsLyrics: true,
    requiresAuthorization: false
  };

  private audio: HTMLAudioElement;
  private state: PlaybackState = 'idle';
  private currentSong: Song | null = null;
  private clockListener: PlaybackClockListener | null = null;
  private volume = 0.8;
  private clockPollTimer: number | null = null;

  constructor(clockListener?: PlaybackClockListener) {
    this.clockListener = clockListener || null;
    if (typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      if (typeof window !== 'undefined') {
        (window as unknown as { __naro_audio?: HTMLAudioElement; __naro_full_audio?: HTMLAudioElement }).__naro_audio = this.audio;
        (window as unknown as { __naro_audio?: HTMLAudioElement; __naro_full_audio?: HTMLAudioElement }).__naro_full_audio = this.audio;
      }
      this.setupListeners();
    } else {
      this.audio = {
        preload: 'auto',
        addEventListener: () => {},
        removeEventListener: () => {},
        load: () => {},
        play: async () => {},
        pause: () => {},
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        muted: false,
        playbackRate: 1.0,
        src: '',
        readyState: 0
      } as unknown as HTMLAudioElement;
    }
  }

  public setClockListener(listener: PlaybackClockListener): void {
    this.clockListener = listener;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  public async authenticate(): Promise<boolean> {
    return true; // NARO full-length provider is authorized by default for catalog songs
  }

  public isAuthorized(): boolean {
    return true;
  }

  public canPlay(song: Song): boolean {
    if (!song) return false;
    const stream = song.playbackSource?.streamUrl;
    if (!stream) return false;
    // Naro licensed master stream OR open license OR dev fixture can play in this audio element
    return (
      song.playbackSourceType === 'naro-licensed' ||
      song.playbackSourceType === 'open-license' ||
      song.playbackSourceType === 'dev-fixture'
    );
  }

  public canPlayFullLength(song: Song): boolean {
    if (!song) return false;
    // FULL LENGTH is confirmed for genuine licensed recordings, NEVER dev fixtures or local WAV files
    return (
      (song.playbackSourceType === 'naro-licensed' || song.playbackSourceType === 'open-license') &&
      !song.isStreamPreview &&
      !!song.playbackSource?.streamUrl
    );
  }

  public setBackingMode(isBacking: boolean, backingUrl: string, vocalUrl?: string, seekTime?: number): void {
    if (!this.audio || !this.currentSong) return;
    const targetUrl = isBacking
      ? backingUrl
      : (vocalUrl || this.currentSong.playbackSource?.streamUrl);

    if (!targetUrl || this.audio.src.endsWith(targetUrl) || this.audio.src === targetUrl) {
      if (seekTime !== undefined && seekTime >= 0) {
        this.seek(seekTime);
      }
      return;
    }

    const currentTime = seekTime !== undefined && seekTime >= 0 ? seekTime : this.audio.currentTime;
    const isPlaying = !this.audio.paused;

    const onLoadedMetadata = () => {
      try {
        this.audio.currentTime = currentTime;
      } catch (err) {
        console.warn('Could not set currentTime after backing source change:', err);
      }
      if (isPlaying) {
        this.audio.play().catch((err) => console.warn('Error resuming backing audio:', err));
      }
      this.emitClock();
    };

    this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    this.audio.src = targetUrl;
    this.audio.load();
  }

  private setupListeners(): void {
    this.audio.addEventListener('loadstart', () => {
      this.state = 'loading';
      this.emitClock();
    });

    this.audio.addEventListener('canplay', () => {
      if (this.state === 'loading') {
        this.state = 'ready';
      }
      this.emitClock();
    });

    this.audio.addEventListener('play', () => {
      this.state = 'playing';
      this.startClockPoll();
      this.emitClock();
    });

    this.audio.addEventListener('playing', () => {
      this.state = 'playing';
      this.startClockPoll();
      this.emitClock();
    });

    this.audio.addEventListener('pause', () => {
      if (this.state !== 'ended') {
        this.state = 'paused';
      }
      this.stopClockPoll();
      this.emitClock();
    });

    this.audio.addEventListener('waiting', () => {
      this.state = 'buffering';
      this.emitClock();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.emitClock();
    });

    this.audio.addEventListener('ended', () => {
      this.state = 'ended';
      this.stopClockPoll();
      this.emitClock();
    });

    this.audio.addEventListener('error', () => {
      this.state = 'error';
      this.stopClockPoll();
      const code = this.audio.error?.code;
      const message = this.audio.error?.message || `Audio error code ${code}`;
      console.warn('NARO Full-Length playback error:', message);
      this.emitClock(message);
    });
  }

  private startClockPoll(): void {
    this.stopClockPoll();
    const intervalFn = typeof window !== 'undefined' ? window.setInterval : setInterval;
    this.clockPollTimer = intervalFn(() => {
      this.emitClock();
    }, 200) as unknown as number;
  }

  private stopClockPoll(): void {
    if (this.clockPollTimer !== null) {
      clearInterval(this.clockPollTimer);
      this.clockPollTimer = null;
    }
  }

  private emitClock(error?: string): void {
    if (!this.clockListener) return;
    const sourceType = this.currentSong?.playbackSourceType ||
      (this.currentSong?.playbackSource?.streamUrl?.includes('/audio/') ? 'dev-fixture' : 'naro-licensed');
    const event: PlaybackClockEvent = {
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      bufferedTime: this.getBufferedTime(),
      isPlaying: !this.audio.paused && !this.audio.ended && this.audio.readyState > 2,
      state: this.state,
      playbackType: 'full',
      playbackSourceType: sourceType,
      providerId: this.id,
      error
    };
    this.clockListener(event);
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    this.currentSong = song;
    this.state = 'loading';
    this.stopClockPoll();
    this.emitClock();

    const streamUrl = song.playbackSource?.streamUrl;
    if (!streamUrl) {
      this.state = 'error';
      this.emitClock('Full-length audio stream is unavailable for this track.');
      return;
    }

    this.audio.pause();
    this.audio.muted = false;
    this.audio.playbackRate = 1.0;
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this.volume > 0 ? this.volume : 0.8;
    this.audio.src = streamUrl;
    if (typeof window !== 'undefined') {
      (window as unknown as { __naro_audio?: HTMLAudioElement }).__naro_audio = this.audio;
    }

    // Connect to Web Audio mixer graph for DSP vocal suppression & visualizer
    karaokeMixer.connectAudioElement(this.audio);

    if (startTime > 0) {
      const onLoadedMetadata = () => {
        this.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        try {
          this.audio.currentTime = Math.min(this.getDuration(), startTime);
        } catch {
          // ignore
        }
      };
      this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.state = 'ready';
      this.emitClock();
      return;
    }

    return new Promise((resolve) => {
      let isResolved = false;

      const onCanPlay = () => {
        cleanup();
        this.state = 'ready';
        this.emitClock();
        resolve();
      };

      const onError = () => {
        cleanup();
        this.state = 'error';
        this.emitClock('Full-length audio stream could not be loaded.');
        resolve();
      };

      const cleanup = () => {
        if (isResolved) return;
        isResolved = true;
        this.audio.removeEventListener('canplay', onCanPlay);
        this.audio.removeEventListener('error', onError);
      };

      this.audio.addEventListener('canplay', onCanPlay, { once: true });
      this.audio.addEventListener('error', onError, { once: true });
      this.audio.load();

      if (this.audio.readyState >= 2) {
        cleanup();
        this.state = 'ready';
        this.emitClock();
        resolve();
        return;
      }

      setTimeout(() => {
        if (!isResolved) {
          cleanup();
          if (this.state === 'loading') {
            this.state = 'ready';
          }
          this.emitClock();
          resolve();
        }
      }, 6000);
    });
  }

  public async play(): Promise<void> {
    if (!this.audio.src) return;
    try {
      await karaokeMixer.resumeContext();
      await this.audio.play();
      this.state = 'playing';
      this.startClockPoll();
      this.emitClock();
    } catch (err: unknown) {
      this.state = 'error';
      const domErr = err as DOMException;
      const msg = domErr.name === 'NotAllowedError'
        ? 'User gesture required to start playback.'
        : (domErr.message || 'Failed to play full-length audio.');
      this.emitClock(msg);
      throw err;
    }
  }

  public pause(): void {
    if (this.audio && typeof this.audio.pause === 'function') {
      this.audio.pause();
    }
    if (this.state !== 'ended') {
      this.state = 'paused';
    }
    this.stopClockPoll();
    this.emitClock();
  }

  public async resume(): Promise<void> {
    return this.play();
  }

  public seek(time: number): void {
    if (!this.audio) return;
    const dur = this.getDuration();
    const clamped = dur > 0 ? Math.max(0, Math.min(dur, time)) : Math.max(0, time);
    try {
      this.audio.currentTime = clamped;
      this.emitClock();
    } catch (err) {
      console.warn('Seek error:', err);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  public getDuration(): number {
    if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0) {
      return this.audio.duration;
    }
    return this.currentSong?.duration || 195;
  }

  private getBufferedTime(): number {
    try {
      if (this.audio && this.audio.buffered && this.audio.buffered.length > 0) {
        return this.audio.buffered.end(this.audio.buffered.length - 1);
      }
    } catch {
      // ignore
    }
    return 0;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getVisualizerData(): Uint8Array | null {
    return karaokeMixer.getVisualizerData();
  }

  public dispose(): void {
    this.stopClockPoll();
    this.pause();
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {
        this.audio.src = '';
      }
    }
    this.currentSong = null;
    this.state = 'idle';
  }

  public destroy(): void {
    this.dispose();
  }
}
