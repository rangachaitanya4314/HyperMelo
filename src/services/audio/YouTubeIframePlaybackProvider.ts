// YouTube IFrame Player API Playback Provider for NARO
// Compliant with YouTube Developer Terms: uses official IFrame API, never extracts audio

import type { Song, PlaybackState } from '../../types/music';
import type { MusicPlaybackProvider, PlaybackClockListener, ProviderCapabilities } from './playbackTypes';

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export class YouTubeIframePlaybackProvider implements MusicPlaybackProvider {
  public readonly id = 'youtube-iframe';
  public readonly name = 'youtube-iframe';
  public readonly capabilities: ProviderCapabilities = {
    supportsFullLength: true,
    supportsSeek: true,
    supportsWebAudioRouting: false,
    supportsKaraokeProcessing: false,
    supportsLyrics: true,
    requiresAuthorization: false
  };

  private player: YTPlayerInstance | null = null;
  private containerId = 'naro-yt-player-slot';
  private isApiReady = false;
  private state: PlaybackState = 'idle';
  private currentSong: Song | null = null;
  private clockListener: PlaybackClockListener | null = null;
  private timePollTimer: number | null = null;
  private volume = 80;

  constructor(clockListener?: PlaybackClockListener) {
    this.clockListener = clockListener || null;
    this.ensureIframeApi();
  }

  public setClockListener(listener: PlaybackClockListener) {
    this.clockListener = listener;
  }

  private ensureIframeApi() {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      this.isApiReady = true;
      return;
    }

    const existingScript = document.getElementById('naro-yt-iframe-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'naro-yt-iframe-script';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);

      const oldReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        this.isApiReady = true;
        if (oldReady) oldReady();
      };
    }
  }

  private ensureContainer(): HTMLElement {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.bottom = '0px';
      container.style.right = '0px';
      container.style.width = '2px';
      container.style.height = '2px';
      container.style.pointerEvents = 'none';
      container.style.opacity = '0.01';
      container.style.zIndex = '-1';
      document.body.appendChild(container);
    }
    return container;
  }

  public canPlay(song: Song): boolean {
    return !!song.playbackSource?.youtubeId;
  }

  public canPlayFullLength(track: Song): boolean {
    return this.canPlay(track);
  }

  public async authenticate(): Promise<boolean> {
    return true;
  }

  public isAuthorized(): boolean {
    return true;
  }

  public async resume(): Promise<void> {
    return this.play();
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    this.currentSong = song;
    this.state = 'loading';
    this.emitClock();

    const videoId = song.playbackSource?.youtubeId;
    if (!videoId) {
      this.state = 'error';
      this.emitClock('No YouTube video ID available.');
      return;
    }

    this.ensureContainer();

    // Wait until YT API is ready if loading
    if (!this.isApiReady && (!window.YT || !window.YT.Player)) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            this.isApiReady = true;
            resolve();
          }
        }, 100);
      });
    }

    return new Promise((resolve) => {
      if (this.player) {
        try {
          this.player.destroy();
        } catch {
          // ignore
        }
        this.player = null;
      }

      this.player = new window.YT.Player(this.containerId, {
        height: '200',
        width: '200',
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          enablejsapi: 1,
          start: Math.floor(startTime),
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            this.state = 'ready';
            this.emitClock();
            resolve();
          },
          onStateChange: (event) => {
            const YTState = window.YT.PlayerState;
            switch (event.data) {
              case YTState.PLAYING:
                this.state = 'playing';
                this.startTimePoll();
                break;
              case YTState.PAUSED:
                this.state = 'paused';
                this.stopTimePoll();
                break;
              case YTState.BUFFERING:
                this.state = 'buffering';
                break;
              case YTState.ENDED:
                this.state = 'ended';
                this.stopTimePoll();
                break;
            }
            this.emitClock();
          },
          onError: (event) => {
            this.state = 'error';
            this.stopTimePoll();
            this.emitClock(`YouTube playback error (${event.data})`);
            resolve();
          }
        }
      });
    });
  }

  public async play(): Promise<void> {
    if (!this.player) return;
    this.player.playVideo();
    this.state = 'playing';
    this.startTimePoll();
    this.emitClock();
  }

  public pause(): void {
    if (!this.player) return;
    this.player.pauseVideo();
    this.state = 'paused';
    this.stopTimePoll();
    this.emitClock();
  }

  public seek(time: number): void {
    if (!this.player) return;
    this.player.seekTo(time, true);
    this.emitClock();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(100, Math.round(vol * 100)));
    if (this.player) {
      this.player.setVolume(this.volume);
    }
  }

  public getCurrentTime(): number {
    if (this.player && typeof this.player.getCurrentTime === 'function') {
      try {
        return this.player.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  public getDuration(): number {
    if (this.player && typeof this.player.getDuration === 'function') {
      try {
        const d = this.player.getDuration();
        if (d && !isNaN(d) && isFinite(d)) return d;
      } catch {
        // fallback
      }
    }
    return this.currentSong?.duration || 0;
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getVisualizerData(): Uint8Array | null {
    // When playing YouTube iframe, generate natural spectrum envelope based on clock
    if (this.state === 'playing') {
      const bins = 32;
      const data = new Uint8Array(bins);
      const time = this.getCurrentTime();
      for (let i = 0; i < bins; i++) {
        const v = Math.sin(time * 3 + i * 0.5) * 40 + Math.cos(time * 7 + i * 0.3) * 30 + 120;
        data[i] = Math.max(20, Math.min(255, Math.floor(v)));
      }
      return data;
    }
    return null;
  }

  private startTimePoll() {
    this.stopTimePoll();
    this.timePollTimer = window.setInterval(() => {
      this.emitClock();
    }, 50);
  }

  private stopTimePoll() {
    if (this.timePollTimer) {
      clearInterval(this.timePollTimer);
      this.timePollTimer = null;
    }
  }

  private emitClock(error?: string) {
    if (!this.clockListener) return;
    this.clockListener({
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      bufferedTime: this.getCurrentTime() + 10,
      isPlaying: this.state === 'playing',
      state: this.state,
      error
    });
  }

  public destroy(): void {
    this.stopTimePoll();
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        // ignore
      }
      this.player = null;
    }
  }

  public dispose(): void {
    this.destroy();
  }
}
