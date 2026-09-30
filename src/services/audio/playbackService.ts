// Master Playback Service for NARO
// Manages authorized playback providers, tracks actual playback clock, and broadcasts state

import type { Song } from '../../types/music';
import type {
  MusicPlaybackProvider,
  PlaybackClockEvent,
  PlaybackClockListener,
  ProviderCapabilities
} from './playbackTypes';
import { Html5AudioPlaybackProvider } from './Html5AudioPlaybackProvider';
import { YouTubeIframePlaybackProvider } from './YouTubeIframePlaybackProvider';
import { NaroFullLengthPlaybackProvider } from './NaroFullLengthPlaybackProvider';
import { AppleMusicPlaybackProvider } from './AppleMusicPlaybackProvider';
import { connectivityService } from '../connectivity/connectivityService';
import { karaokeMixer } from './karaokeMixer';

class PlaybackService {
  private activeProvider: MusicPlaybackProvider | null = null;
  private naroFullLengthProvider: NaroFullLengthPlaybackProvider;
  private appleMusicProvider: AppleMusicPlaybackProvider;
  private html5Provider: Html5AudioPlaybackProvider;
  private youtubeProvider: YouTubeIframePlaybackProvider;
  private clockListeners: Set<PlaybackClockListener> = new Set();
  private currentSong: Song | null = null;
  private currentVolume = 0.8;
  private currentClock: PlaybackClockEvent = {
    currentTime: 0,
    duration: 0,
    bufferedTime: 0,
    isPlaying: false,
    state: 'idle',
    playbackType: 'preview'
  };

  constructor() {
    this.naroFullLengthProvider = new NaroFullLengthPlaybackProvider(this.handleClockEvent);
    this.appleMusicProvider = new AppleMusicPlaybackProvider(this.handleClockEvent);
    this.html5Provider = new Html5AudioPlaybackProvider(this.handleClockEvent);
    this.youtubeProvider = new YouTubeIframePlaybackProvider(this.handleClockEvent);
    this.activeProvider = this.naroFullLengthProvider;

    // Listen for network loss
    connectivityService.subscribe((isOnline) => {
      if (!isOnline && this.currentClock.isPlaying) {
        // If current song is an online stream and we lost internet
        if (this.currentSong && !this.currentSong.isFallbackDemo && !this.currentSong.playbackSource?.streamUrl?.startsWith('blob:')) {
          this.pause();
          this.handleClockEvent({
            ...this.currentClock,
            isPlaying: false,
            state: 'offline',
            error: "You're offline. Connect to the internet to stream music."
          });
        }
      }
    });
  }

  public subscribeClock(listener: PlaybackClockListener): () => void {
    this.clockListeners.add(listener);
    listener(this.currentClock);
    return () => {
      this.clockListeners.delete(listener);
    };
  }

  private handleClockEvent = (event: PlaybackClockEvent) => {
    // A track must ONLY be marked full when the selected provider actually confirms full-length playback is available
    const isFull = this.activeProvider && this.currentSong
      ? this.activeProvider.canPlayFullLength(this.currentSong)
      : false;

    const sourceType = event.playbackSourceType ||
      this.currentSong?.playbackSourceType ||
      (this.currentSong?.playbackSourceType === 'dev-fixture' ? 'dev-fixture' : (isFull ? 'official-provider' : 'preview'));

    const enrichedEvent: PlaybackClockEvent = {
      ...event,
      providerId: this.activeProvider?.id || event.providerId,
      playbackType: isFull ? 'full' : (event.playbackType || 'preview'),
      playbackSourceType: sourceType
    };
    this.currentClock = enrichedEvent;
    this.clockListeners.forEach((listener) => {
      try {
        listener(enrichedEvent);
      } catch (err) {
        console.error('Error in clock listener:', err);
      }
    });
  };

  /**
   * Determine and select the best authorized playback provider for the song
   */
  public selectProviderForSong(song: Song): MusicPlaybackProvider {
    // 1. Authorized Apple MusicKit stream (ONLY if authorized!)
    if (this.appleMusicProvider.canPlay(song) && this.appleMusicProvider.isAuthorized()) {
      return this.appleMusicProvider;
    }

    // 2. NARO-owned full-length licensed stream
    if (this.naroFullLengthProvider.canPlayFullLength(song)) {
      return this.naroFullLengthProvider;
    }

    // 3. YouTube official iframe
    if (this.youtubeProvider.canPlayFullLength(song)) {
      return this.youtubeProvider;
    }

    // 4. Dev fixture provider for internal development testing
    if (song.playbackSourceType === 'dev-fixture' && this.naroFullLengthProvider.canPlay(song)) {
      return this.naroFullLengthProvider;
    }

    // 5. Default: HTML5 Audio Provider (previews, MP3s, direct stream URLs)
    return this.html5Provider;
  }

  public getActiveProvider(): MusicPlaybackProvider | null {
    return this.activeProvider;
  }

  public getProviderCapabilities(): ProviderCapabilities | null {
    return this.activeProvider?.capabilities || null;
  }

  public canPlayFullLength(song: Song): boolean {
    if (!song) return false;
    const provider = this.selectProviderForSong(song);
    return provider ? provider.canPlayFullLength(song) : false;
  }

  public isAuthorized(providerId?: string): boolean {
    if (!providerId || providerId === 'apple-music') {
      return this.appleMusicProvider.isAuthorized();
    }
    if (providerId === 'naro-full-length') {
      return this.naroFullLengthProvider.isAuthorized();
    }
    return true;
  }

  public async authenticateProvider(providerId: string): Promise<boolean> {
    if (providerId === 'apple-music') {
      return this.appleMusicProvider.authenticate();
    }
    if (providerId === 'naro-full-length') {
      return this.naroFullLengthProvider.authenticate();
    }
    return true;
  }

  public async loadAndPlay(song: Song, startTime = 0): Promise<void> {
    // If offline and trying to stream an online-only song
    if (!connectivityService.isOnline && !song.isFallbackDemo && !song.playbackSource?.streamUrl?.startsWith('blob:')) {
      this.currentSong = song;
      this.handleClockEvent({
        currentTime: 0,
        duration: song.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'offline',
        error: "You're offline. Connect to the internet to stream music."
      });
      return;
    }

    if (this.activeProvider) {
      this.activeProvider.pause();
    }

    this.currentSong = song;
    this.isKaraokeActive = false;

    const provider = this.selectProviderForSong(song);

    if (
      !provider.canPlay(song) &&
      !this.naroFullLengthProvider.canPlay(song) &&
      !this.appleMusicProvider.canPlay(song) &&
      !this.youtubeProvider.canPlay(song) &&
      !this.html5Provider.canPlay(song)
    ) {
      this.handleClockEvent({
        currentTime: 0,
        duration: song.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: 'Playback unavailable: No authorized audio stream available for this track.'
      });
      return;
    }

    if (this.activeProvider !== provider) {
      this.activeProvider = provider;
    }

    this.activeProvider.setVolume(this.currentVolume);

    try {
      await this.activeProvider.load(song, startTime);
      await this.activeProvider.play();
    } catch (err: unknown) {
      console.warn('Playback service error during loadAndPlay:', err);
      const domErr = err as DOMException;
      let errorMsg = this.currentClock.error;
      if (!errorMsg || errorMsg === 'Playback unavailable right now.') {
        if (domErr.name === 'NotAllowedError') {
          errorMsg = 'Playback blocked: NotAllowedError (user interaction needed to play audio)';
        } else if (domErr.name === 'NotSupportedError') {
          errorMsg = 'Playback error: NotSupportedError (format not supported by browser)';
        } else {
          errorMsg = `Playback error: ${domErr.name || 'Error'} - ${domErr.message || 'Failed to play'}`;
        }
      }
      this.handleClockEvent({
        currentTime: this.currentClock.currentTime || 0,
        duration: song.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: errorMsg
      });
    }
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    if (this.activeProvider) {
      this.activeProvider.pause();
    }
    this.currentSong = song;
    const provider = this.selectProviderForSong(song);
    this.activeProvider = provider;
    this.activeProvider.setVolume(this.currentVolume);
    await this.activeProvider.load(song, startTime);
  }

  public async play(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.play();
    }
  }

  public async togglePlay(fallbackSong?: Song): Promise<void> {
    if (!this.currentSong && fallbackSong) {
      this.currentSong = fallbackSong;
    }
    if (!this.activeProvider || !this.currentSong) return;

    if (this.currentClock.isPlaying) {
      this.activeProvider.pause();
    } else {
      if (
        this.currentClock.state === 'error' ||
        this.currentClock.state === 'idle' ||
        (this.currentClock.currentTime === 0 && !this.currentClock.isPlaying)
      ) {
        await this.loadAndPlay(this.currentSong, this.currentClock.currentTime);
      } else {
        await this.activeProvider.play();
      }
    }
  }

  public seek(time: number): void {
    if (this.activeProvider) {
      this.activeProvider.seek(time);
    }
  }

  public pause(): void {
    if (this.activeProvider) {
      this.activeProvider.pause();
    }
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.activeProvider) {
      this.activeProvider.setVolume(this.currentVolume);
    }
  }

  public getVisualizerData(): Uint8Array | null {
    if (this.activeProvider) {
      return this.activeProvider.getVisualizerData();
    }
    return null;
  }

  public getAudioElement(): HTMLAudioElement | null {
    if (this.activeProvider && 'getAudioElement' in this.activeProvider) {
      return (this.activeProvider as unknown as { getAudioElement(): HTMLAudioElement }).getAudioElement();
    }
    return null;
  }

  private isKaraokeActive = false;

  public setKaraokeMode(enabled: boolean): void {
    this.isKaraokeActive = enabled;
    const isDedicatedInstrumental =
      this.currentSong?.karaokeSource?.type === 'dedicated-instrumental' &&
      Boolean(this.currentSong.karaokeSource.streamUrl);

    if (isDedicatedInstrumental && this.currentSong?.karaokeSource?.streamUrl) {
      // Dedicated instrumental backing track:
      // Switch active provider to dedicated NoVox instrumental without DSP vocal cancellation
      this.activeProvider?.setBackingMode?.(
        enabled,
        this.currentSong.karaokeSource.streamUrl,
        this.currentSong.playbackSource?.streamUrl
      );
      karaokeMixer.setKaraokeMode(false);
    } else {
      // Standard track: Engage real-time WebAudio center-channel vocal suppression DSP
      karaokeMixer.setKaraokeMode(enabled);
    }
  }

  public isKaraokeMode(): boolean {
    return this.isKaraokeActive || karaokeMixer.isKaraoke;
  }

  public setBgmVolume(vol: number): void {
    karaokeMixer.setBgmVolume(vol);
  }

  public setVoiceVolume(vol: number): void {
    karaokeMixer.setVoiceVolume(vol);
  }

  public setMicEnabled(enabled: boolean): void {
    karaokeMixer.setMicEnabled(enabled);
  }

  public getCurrentClock(): PlaybackClockEvent {
    return this.currentClock;
  }
}

export const playbackService = new PlaybackService();
