// HTML5 Audio Playback Provider for NARO
// Delivers real authorized direct media streaming directly to system audio output
// High-resolution clock synchronization for real-time lyrics & waveform timeline

import type { Song, PlaybackState } from '../../shared';
import type { MusicPlaybackProvider, ProviderCapabilities, PlaybackClockListener } from './playbackTypes';
import { karaokeMixer } from './karaokeMixer';

export class Html5AudioPlaybackProvider implements MusicPlaybackProvider {
  public readonly id = 'html5-audio';
  public readonly name = 'HTML5 Audio Player';

  public readonly capabilities: ProviderCapabilities = {
    supportsFullLength: false,
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
        (window as unknown as { __naro_audio?: HTMLAudioElement }).__naro_audio = this.audio;
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

  public setClockListener(listener: PlaybackClockListener) {
    this.clockListener = listener;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  private setupListeners() {
    this.audio.addEventListener('loadstart', () => {
      this.state = 'loading';
      this.emitClock();
    });

    this.audio.addEventListener('loadedmetadata', () => {
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
      const message = this.audio.error?.message || `Playback error code: ${code}`;
      console.warn('HTML5 Audio playback error:', message);
      this.emitClock(message);
    });
  }

  public async authenticate(): Promise<boolean> {
    return true;
  }

  public isAuthorized(): boolean {
    return true;
  }

  public canPlay(song: Song): boolean {
    const src = song.playbackSource;
    return !!src?.streamUrl;
  }

  public canPlayFullLength(song: Song): boolean {
    if (!song?.playbackSource?.streamUrl) return false;
    if (song.isStreamPreview || song.playbackType === 'preview' || song.playbackSourceType === 'preview') return false;
    if (song.playbackSourceType === 'dev-fixture') return false;
    const url = song.playbackSource.streamUrl;
    if (url.includes('itunes.apple.com') || url.includes('mzstatic.com') || url.includes('audio-ssl.itunes.apple.com')) {
      return false;
    }
    return song.playbackType === 'full' && (song.playbackSourceType === 'naro-licensed' || song.playbackSourceType === 'open-license');
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

  public async load(song: Song, startTime = 0): Promise<void> {
    this.currentSong = song;
    this.state = 'loading';
    this.stopClockPoll();
    this.emitClock();

    const streamUrl = song.playbackSource?.streamUrl;
    if (!streamUrl) {
      this.state = 'error';
      this.emitClock('Audio stream is unavailable for this song.');
      return;
    }

    this.audio.pause();
    this.audio.muted = false;
    this.audio.playbackRate = 1.0;
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this.volume > 0 ? this.volume : 0.8;
    this.audio.src = streamUrl;

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
        const code = this.audio.error?.code;
        const msg = this.audio.error?.message || (code ? `Error code: ${code}` : 'Audio stream could not be loaded.');
        this.emitClock(`Playback error: ${msg}`);
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

      // Safety timeout after 6 seconds
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
    if (!this.audio.src) {
      this.state = 'error';
      this.emitClock('No audio stream available to play.');
      return;
    }

    this.audio.muted = false;
    this.audio.playbackRate = 1.0;
    if (this.audio.volume <= 0) {
      this.audio.volume = this.volume > 0 ? this.volume : 0.8;
    }

    try {
      await karaokeMixer.resumeContext();
      await this.audio.play();
      this.state = 'playing';
      this.startClockPoll();
      this.emitClock();
    } catch (err: unknown) {
      console.warn('Playback play request was prevented or failed:', err);
      this.state = 'error';
      this.stopClockPoll();
      const domErr = err as DOMException;
      let errorMsg = `Playback error: ${domErr.name || 'Unknown'}`;
      if (domErr.name === 'NotAllowedError') {
        errorMsg = 'Playback blocked: User interaction required to start audio.';
      } else if (domErr.name === 'NotSupportedError') {
        errorMsg = 'Playback error: Audio format not supported by browser.';
      } else if (domErr.message) {
        errorMsg = `Playback error: ${domErr.name || 'Error'} - ${domErr.message}`;
      }
      this.emitClock(errorMsg);
      throw err;
    }
  }

  public pause(): void {
    this.audio.pause();
    this.state = 'paused';
    this.stopClockPoll();
    this.emitClock();
  }

  public seek(time: number): void {
    const duration = this.getDuration();
    const clamped = duration > 0 ? Math.max(0, Math.min(duration, time)) : Math.max(0, time);
    try {
      this.audio.currentTime = clamped;
    } catch {
      // ignore
    }
    this.emitClock();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime || 0;
  }

  public getDuration(): number {
    return this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)
      ? this.audio.duration
      : this.currentSong?.duration || 0;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getVisualizerData(): Uint8Array | null {
    return karaokeMixer.getVisualizerData();
  }

  private startClockPoll() {
    this.stopClockPoll();
    const intervalFn = typeof window !== 'undefined' ? window.setInterval : setInterval;
    this.clockPollTimer = intervalFn(() => {
      if (this.state === 'playing') {
        this.emitClock();
      }
    }, 50) as unknown as number; // 20 updates per second for smooth lyrics & playhead progress
  }

  private stopClockPoll() {
    if (this.clockPollTimer) {
      const clearFn = typeof window !== 'undefined' ? window.clearInterval : clearInterval;
      clearFn(this.clockPollTimer as unknown as number);
      this.clockPollTimer = null;
    }
  }

  private emitClock(error?: string) {
    if (!this.clockListener) return;

    let buffered = 0;
    try {
      if (this.audio.buffered && this.audio.buffered.length > 0) {
        buffered = this.audio.buffered.end(this.audio.buffered.length - 1);
      }
    } catch {
      // ignore
    }

    const isPreview = this.currentSong?.isStreamPreview || this.currentSong?.playbackType === 'preview';
    const sourceType = this.currentSong?.playbackSourceType || (isPreview ? 'preview' : 'naro-licensed');

    this.clockListener({
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      bufferedTime: buffered,
      isPlaying: !this.audio.paused && !this.audio.ended && this.state === 'playing',
      state: this.state,
      playbackType: isPreview ? 'preview' : 'full',
      playbackSourceType: sourceType,
      providerId: this.id,
      error
    });
  }

  public async resume(): Promise<void> {
    return this.play();
  }

  public dispose(): void {
    this.destroy();
  }

  public destroy(): void {
    this.stopClockPoll();
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
}
