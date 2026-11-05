// Dedicated Playback Controller for NARO
// Phase 3.5B Architecture:
// UI -> AudioPlayerContext -> PlaybackController -> Playback Provider
// Owns the single authoritative playback clock, provider lifecycle, track queue, and playback commands.

import type {
  Song,
  SongSection,
  MusicPlaybackProvider,
  PlaybackClockEvent,
  PlaybackClockListener,
  PlaybackState,
  ProviderCapabilities
} from '../../shared';
import { Html5AudioPlaybackProvider } from './Html5AudioPlaybackProvider';
import { YouTubeIframePlaybackProvider } from './YouTubeIframePlaybackProvider';
import { NaroFullLengthPlaybackProvider } from './NaroFullLengthPlaybackProvider';
import { AppleMusicPlaybackProvider } from './AppleMusicPlaybackProvider';
import { connectivityService } from '../connectivity/connectivityService';
import { karaokeMixer } from './karaokeMixer';
import type { SoundMode, SoundPreset } from './naroImmersiveEngine';
import { playbackSourceResolver } from './playbackSourceResolver';
import { vocalRemovalService } from './vocalSeparation/vocalRemovalService';

export interface PlaybackControllerOptions {
  naroFullLengthProvider?: NaroFullLengthPlaybackProvider;
  appleMusicProvider?: AppleMusicPlaybackProvider;
  html5Provider?: Html5AudioPlaybackProvider;
  youtubeProvider?: YouTubeIframePlaybackProvider;
  initialTrack?: Song | null;
  initialQueue?: Song[];
}

export class PlaybackController {
  // Available playback providers
  public naroFullLengthProvider: NaroFullLengthPlaybackProvider;
  public appleMusicProvider: AppleMusicPlaybackProvider;
  public html5Provider: Html5AudioPlaybackProvider;
  public youtubeProvider: YouTubeIframePlaybackProvider;

  // Currently active provider (strictly one at a time)
  private activeProvider: MusicPlaybackProvider | null = null;

  // Track & queue management
  private currentTrack: Song | null = null;
  private queue: Song[] = [];

  // Volume
  private volume = 0.8;

  // Authoritative Playback Clock
  private clockListeners: Set<PlaybackClockListener> = new Set();
  private trackListeners: Set<(track: Song | null) => void> = new Set();
  private queueListeners: Set<(queue: Song[]) => void> = new Set();
  private currentClock: PlaybackClockEvent;

  // Loop / Moment behavior
  private loopSection: SongSection | null = null;
  private isLooping = false;

  // Karaoke backing coordination on active provider
  private isKaraokeActive = false;
  private playbackLockOwner: string | null = null;

  // Connectivity unsubscription
  private unsubscribeConnectivity: (() => void) | null = null;

  constructor(options?: PlaybackControllerOptions) {
    // Instantiate or inject providers
    this.naroFullLengthProvider =
      options?.naroFullLengthProvider || new NaroFullLengthPlaybackProvider(this.handleClockEvent);
    this.appleMusicProvider =
      options?.appleMusicProvider || new AppleMusicPlaybackProvider(this.handleClockEvent);
    this.html5Provider =
      options?.html5Provider || new Html5AudioPlaybackProvider(this.handleClockEvent);
    this.youtubeProvider =
      options?.youtubeProvider || new YouTubeIframePlaybackProvider(this.handleClockEvent);

    // Wire clock listeners to our single authoritative clock handler
    this.naroFullLengthProvider.setClockListener(this.handleClockEvent);
    this.appleMusicProvider.setClockListener(this.handleClockEvent);
    this.html5Provider.setClockListener(this.handleClockEvent);
    this.youtubeProvider.setClockListener(this.handleClockEvent);

    // Initial track and queue setup - fresh launch starts empty (null)
    const initialTrack = options?.initialTrack ?? null;
    this.currentTrack = initialTrack;
    this.queue = options?.initialQueue || (initialTrack ? [initialTrack] : []);

    // Active provider defaults to HTML5 Audio provider when no track is loaded,
    // or NARO full length provider when an authorized track is provided
    this.activeProvider = initialTrack ? this.selectProviderForSong(initialTrack) : this.html5Provider;
    this.syncActiveAudioElement();

    // Initial authoritative clock state
    this.currentClock = {
      currentTime: 0,
      duration: initialTrack ? initialTrack.duration : 0,
      bufferedTime: 0,
      isPlaying: false,
      state: 'idle',
      playbackType: initialTrack?.playbackType || 'preview',
      playbackSourceType: initialTrack?.playbackSourceType || 'preview',
      providerId: this.activeProvider?.id || 'html5-audio'
    };

    // Listen for network loss
    this.unsubscribeConnectivity = connectivityService.subscribe((isOnline) => {
      if (!isOnline && this.currentClock.isPlaying) {
        // If current song is an online stream and we lost internet
        if (
          this.currentTrack &&
          !this.currentTrack.isFallbackDemo &&
          !this.currentTrack.playbackSource?.streamUrl?.startsWith('blob:')
        ) {
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

  // =========================================================================
  // AUTHORITATIVE PLAYBACK CLOCK & SUBSCRIPTIONS
  // =========================================================================

  public subscribeClock(listener: PlaybackClockListener): () => void {
    this.clockListeners.add(listener);
    try {
      listener(this.currentClock);
    } catch (err) {
      console.error('Error in initial clock listener call:', err);
    }
    return () => {
      this.clockListeners.delete(listener);
    };
  }

  public getCurrentClock(): PlaybackClockEvent {
    return this.currentClock;
  }

  public getCurrentTime(): number {
    return this.currentClock.currentTime;
  }

  public getDuration(): number {
    return this.currentClock.duration;
  }

  public getPlaybackState(): PlaybackState {
    return this.currentClock.state;
  }

  public isPlaying(): boolean {
    return this.currentClock.isPlaying;
  }

  private handleClockEvent = (event: PlaybackClockEvent) => {
    // A track must ONLY be marked full when the selected provider actually confirms full-length playback is available
    const isFull =
      this.activeProvider && this.currentTrack
        ? this.activeProvider.canPlayFullLength(this.currentTrack)
        : false;

    const sourceType =
      event.playbackSourceType ||
      this.currentTrack?.playbackSourceType ||
      (this.currentTrack?.playbackSourceType === 'dev-fixture'
        ? 'dev-fixture'
        : isFull
        ? 'official-provider'
        : 'preview');

    const enrichedEvent: PlaybackClockEvent = {
      ...event,
      providerId: this.activeProvider?.id || event.providerId,
      playbackType: isFull ? 'full' : event.playbackType || 'preview',
      playbackSourceType: sourceType
    };

    this.currentClock = enrichedEvent;

    // Loop/moment behavior: automatically loop back to start if within a looped moment
    if (this.isLooping && this.loopSection && enrichedEvent.isPlaying) {
      if (enrichedEvent.currentTime >= this.loopSection.end) {
        this.seek(this.loopSection.start);
      }
    }

    this.clockListeners.forEach((listener) => {
      try {
        listener(enrichedEvent);
      } catch (err) {
        console.error('Error in PlaybackController clock listener:', err);
      }
    });
  };

  // =========================================================================
  // =========================================================================
  // PLAYBACK OWNERSHIP / LOCK COORDINATION
  // =========================================================================

  public acquirePlaybackLock(ownerId: string): boolean {
    this.playbackLockOwner = ownerId;
    this.pause();
    return true;
  }

  public releasePlaybackLock(ownerId: string): void {
    if (this.playbackLockOwner === ownerId) {
      this.playbackLockOwner = null;
    }
  }

  public isPlaybackLocked(): boolean {
    return this.playbackLockOwner !== null;
  }

  public getPlaybackLockOwner(): string | null {
    return this.playbackLockOwner;
  }

  // PROVIDER LIFECYCLE & SELECTION
  // =========================================================================

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

  public setActiveProvider(provider: MusicPlaybackProvider | null): void {
    if (this.activeProvider && this.activeProvider !== provider) {
      if (typeof this.activeProvider.pause === 'function') {
        this.activeProvider.pause();
      }
      if (typeof this.activeProvider.dispose === 'function') {
        this.activeProvider.dispose();
      }
    }
    this.activeProvider = provider;
    this.syncActiveAudioElement();
  }

  public pauseAllProvidersExcept(exceptProvider?: MusicPlaybackProvider | null): void {
    const providers = [
      this.naroFullLengthProvider,
      this.appleMusicProvider,
      this.html5Provider,
      this.youtubeProvider
    ];
    for (const p of providers) {
      if (p !== exceptProvider) {
        try {
          if (typeof p.pause === 'function') {
            p.pause();
          }
        } catch {
          // ignore
        }
      }
    }
  }

  public clearAllProvidersAudio(): void {
    const providers = [
      this.naroFullLengthProvider,
      this.appleMusicProvider,
      this.html5Provider,
      this.youtubeProvider
    ];
    for (const p of providers) {
      try {
        if (typeof p.pause === 'function') {
          p.pause();
        }
        if ('destroy' in p && typeof (p as { destroy?: () => void }).destroy === 'function') {
          (p as { destroy: () => void }).destroy();
        } else if ('dispose' in p && typeof (p as { dispose?: () => void }).dispose === 'function') {
          (p as { dispose: () => void }).dispose();
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Switches to nextProvider, disposing the previous provider if replaced
   */
  private switchProvider(nextProvider: MusicPlaybackProvider): void {
    if (this.activeProvider && this.activeProvider !== nextProvider) {
      try {
        if (typeof this.activeProvider.pause === 'function') {
          this.activeProvider.pause();
        }
        if (typeof this.activeProvider.dispose === 'function') {
          this.activeProvider.dispose();
        }
      } catch (err) {
        console.warn('Error disposing previous provider:', err);
      }
    }
    this.pauseAllProvidersExcept(nextProvider);
    this.activeProvider = nextProvider;
    this.syncActiveAudioElement();
  }

  private syncActiveAudioElement(): boolean {
    const isSupported = this.activeProvider?.capabilities.supportsWebAudioRouting ?? false;
    karaokeMixer.setDspSupported(isSupported);

    if (typeof window !== 'undefined' && this.activeProvider && 'getAudioElement' in this.activeProvider) {
      const audio = (this.activeProvider as unknown as { getAudioElement(): HTMLAudioElement }).getAudioElement();
      if (audio) {
        (window as unknown as { __naro_audio?: HTMLAudioElement }).__naro_audio = audio;
        return isSupported && karaokeMixer.connectAudioElement(audio);
      }
    }
    return false;
  }

  public getAudioElement(): HTMLAudioElement | null {
    if (this.activeProvider && 'getAudioElement' in this.activeProvider) {
      return (this.activeProvider as unknown as { getAudioElement(): HTMLAudioElement }).getAudioElement();
    }
    if (typeof window !== 'undefined') {
      return (window as unknown as { __naro_audio?: HTMLAudioElement }).__naro_audio || null;
    }
    return null;
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

  // =========================================================================
  // TRACK & QUEUE ORCHESTRATION
  // =========================================================================

  public getCurrentTrack(): Song | null {
    return this.currentTrack;
  }

  public setCurrentTrack(song: Song | null): void {
    this.currentTrack = song;
    this.notifyTrackChanged();
  }

  public subscribeTrack(listener: (track: Song | null) => void): () => void {
    this.trackListeners.add(listener);
    try {
      listener(this.currentTrack);
    } catch (err) {
      console.error('Error in initial track listener call:', err);
    }
    return () => {
      this.trackListeners.delete(listener);
    };
  }

  private notifyTrackChanged(): void {
    this.trackListeners.forEach((listener) => {
      try {
        listener(this.currentTrack);
      } catch (err) {
        console.error('Error in track listener:', err);
      }
    });
  }

  public subscribeQueue(listener: (queue: Song[]) => void): () => void {
    this.queueListeners.add(listener);
    try {
      listener(this.getQueue());
    } catch (err) {
      console.error('Error in initial queue listener call:', err);
    }
    return () => {
      this.queueListeners.delete(listener);
    };
  }

  private notifyQueueChanged(): void {
    const current = this.getQueue();
    this.queueListeners.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.error('Error in queue listener:', err);
      }
    });
  }

  public getQueue(): Song[] {
    return [...this.queue];
  }

  public setQueue(queue: Song[]): void {
    this.queue = [...queue];
    this.notifyQueueChanged();
  }

  public addToQueue(song: Song): void {
    if (!this.queue.some((s) => s.id === song.id)) {
      this.queue.push(song);
      this.notifyQueueChanged();
    }
  }

  public removeFromQueue(songId: string): void {
    this.queue = this.queue.filter((s) => s.id !== songId);
    this.notifyQueueChanged();
  }

  public clearQueue(): void {
    if (this.currentTrack) {
      this.queue = [this.currentTrack];
    } else {
      this.queue = [];
    }
    this.notifyQueueChanged();
  }

  public reorderQueue(newQueue: Song[]): void {
    this.queue = [...newQueue];
    this.notifyQueueChanged();
  }

  public async nextTrack(): Promise<void> {
    if (this.queue.length === 0) return;
    const currentIndex = this.currentTrack
      ? this.queue.findIndex((s) => s.id === this.currentTrack!.id)
      : -1;
    const nextIndex = (currentIndex + 1) % this.queue.length;
    await this.loadAndPlay(this.queue[nextIndex], 0);
  }

  public async prevTrack(): Promise<void> {
    if (this.queue.length === 0) return;
    const currentIndex = this.currentTrack
      ? this.queue.findIndex((s) => s.id === this.currentTrack!.id)
      : -1;
    const prevIndex = (currentIndex - 1 + this.queue.length) % this.queue.length;
    await this.loadAndPlay(this.queue[prevIndex], 0);
  }

  private currentLoadId = 0;

  public async loadAndPlay(song: Song, startTime = 0): Promise<void> {
    if (this.playbackLockOwner) {
      console.warn(`[PlaybackController] loadAndPlay ignored: playback locked by ${this.playbackLockOwner}`);
      return;
    }
    const loadId = ++this.currentLoadId;

    // Immediately pause all currently active playback so the previous track cannot continue audibly
    this.pauseAllProvidersExcept();

    // If offline and trying to stream an online-only song
    if (
      !connectivityService.isOnline &&
      !song.isFallbackDemo &&
      !song.playbackSource?.streamUrl?.startsWith('blob:')
    ) {
      this.currentTrack = song;
      this.notifyTrackChanged();
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

    // Resolve genuine full-length playable audio source for catalog song
    const resolvedSong = await playbackSourceResolver.resolvePlaybackSource(song);
    if (loadId !== this.currentLoadId) {
      console.warn('[PlaybackController] Stale track resolution ignored for:', song.id);
      return;
    }

    // If the resolved song has no streamUrl, display honest error and never fall back to another track
    if (!resolvedSong.playbackSource?.streamUrl) {
      this.clearAllProvidersAudio();
      this.currentTrack = resolvedSong;
      this.notifyTrackChanged();
      this.handleClockEvent({
        currentTime: 0,
        duration: resolvedSong.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: 'Playback unavailable: Audio source is not available for this track.'
      });
      return;
    }

    this.currentTrack = resolvedSong;
    this.addToQueue(resolvedSong);
    this.notifyTrackChanged();
    const preserveKaraoke = this.isKaraokeActive;

    const provider = this.selectProviderForSong(resolvedSong);

    if (
      !provider.canPlay(resolvedSong) &&
      !this.naroFullLengthProvider.canPlay(resolvedSong) &&
      !this.appleMusicProvider.canPlay(resolvedSong) &&
      !this.youtubeProvider.canPlay(resolvedSong) &&
      !this.html5Provider.canPlay(resolvedSong)
    ) {
      this.clearAllProvidersAudio();
      this.handleClockEvent({
        currentTime: 0,
        duration: resolvedSong.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: 'Playback unavailable: No authorized audio stream available for this track.'
      });
      return;
    }

    this.switchProvider(provider);
    this.activeProvider?.setVolume(this.volume);

    try {
      await this.activeProvider?.load(resolvedSong, startTime);
      if (loadId !== this.currentLoadId) {
        console.warn('[PlaybackController] Stale load completed, ignoring play for:', song.id);
        this.activeProvider?.pause();
        return;
      }
      if (preserveKaraoke) {
        this.setKaraokeMode(true, startTime);
      }
      await this.activeProvider?.play();
    } catch (err: unknown) {
      console.warn('PlaybackController error during loadAndPlay:', err);
      const domErr = err as DOMException;
      let errorMsg = this.currentClock.error;
      if (!errorMsg || errorMsg === 'Playback unavailable right now.') {
        if (domErr?.name === 'NotAllowedError') {
          errorMsg = 'Playback blocked: NotAllowedError (user interaction needed to play audio)';
        } else if (domErr?.name === 'NotSupportedError') {
          errorMsg = 'Playback error: NotSupportedError (format not supported by browser)';
        } else {
          errorMsg = `Playback error: ${domErr?.name || 'Error'} - ${domErr?.message || 'Failed to play'}`;
        }
      }
      this.clearAllProvidersAudio();
      this.handleClockEvent({
        currentTime: this.currentClock.currentTime || 0,
        duration: resolvedSong.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: errorMsg
      });
    }
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    if (this.playbackLockOwner) {
      console.warn(`[PlaybackController] loadAndPlay ignored: playback locked by ${this.playbackLockOwner}`);
      return;
    }
    const loadId = ++this.currentLoadId;

    // Immediately pause all currently active playback so the previous track cannot continue audibly
    this.pauseAllProvidersExcept();

    const resolvedSong = await playbackSourceResolver.resolvePlaybackSource(song);
    if (loadId !== this.currentLoadId) {
      console.warn('[PlaybackController] Stale track resolution ignored for:', song.id);
      return;
    }

    this.currentTrack = resolvedSong;
    this.addToQueue(resolvedSong);
    this.notifyTrackChanged();
    const preserveKaraoke = this.isKaraokeActive;

    if (!resolvedSong.playbackSource?.streamUrl) {
      this.clearAllProvidersAudio();
      this.handleClockEvent({
        currentTime: 0,
        duration: resolvedSong.duration,
        bufferedTime: 0,
        isPlaying: false,
        state: 'error',
        error: 'Playback unavailable: Audio source is not available for this track.'
      });
      return;
    }

    const provider = this.selectProviderForSong(resolvedSong);
    this.switchProvider(provider);
    this.activeProvider?.setVolume(this.volume);
    await this.activeProvider?.load(resolvedSong, startTime);
    if (preserveKaraoke) {
      this.setKaraokeMode(true, startTime);
    }
  }

  public async play(): Promise<void> {
    if (this.playbackLockOwner) {
      console.warn('[PlaybackController] play ignored: locked by ' + this.playbackLockOwner);
      return;
    }
    if (!this.currentTrack) return;
    if (this.activeProvider) {
      await this.activeProvider.play();
    }
  }

  public pause(): void {
    if (this.activeProvider) {
      this.activeProvider.pause();
    }
  }

  public async togglePlay(fallbackSong?: Song): Promise<void> {
    if (this.playbackLockOwner) {
      console.warn('[PlaybackController] togglePlay ignored: locked by ' + this.playbackLockOwner);
      return;
    }
    const targetSong = fallbackSong || this.currentTrack;
    if (!targetSong) return;

    // If targetSong is specified and differs from currentTrack, switch to targetSong immediately
    if (this.currentTrack && targetSong.id !== this.currentTrack.id) {
      await this.loadAndPlay(targetSong, 0);
      return;
    }

    if (!this.currentTrack) {
      this.currentTrack = targetSong;
      this.addToQueue(targetSong);
      this.notifyTrackChanged();
    }

    if (!this.activeProvider) {
      const provider = this.selectProviderForSong(targetSong);
      this.switchProvider(provider);
    }

    if (this.currentClock.isPlaying) {
      this.activeProvider?.pause();
    } else {
      // Check if the current audio element actually has targetSong's stream loaded
      const streamUrl = this.currentTrack?.playbackSource?.streamUrl;
      const audio = this.getAudioElement();
      const currentSrc = audio?.src || '';
      const isMatchingSource = streamUrl && (currentSrc === streamUrl || currentSrc.endsWith(streamUrl));

      if (
        !isMatchingSource ||
        this.currentClock.state === 'error' ||
        this.currentClock.state === 'idle' ||
        (this.currentClock.currentTime === 0 && !this.currentClock.isPlaying)
      ) {
        await this.loadAndPlay(this.currentTrack, this.currentClock.currentTime);
      } else {
        await this.activeProvider?.play();
      }
    }
  }

  public seek(time: number): void {
    if (this.activeProvider) {
      this.activeProvider.seek(time);
      this.currentClock = {
        ...this.currentClock,
        currentTime: time
      };
      this.handleClockEvent(this.currentClock);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.activeProvider) {
      this.activeProvider.setVolume(this.volume);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  // =========================================================================
  // LOOP / MOMENT BEHAVIOR
  // =========================================================================

  public setLoopSection(section: SongSection | null, isLooping = true): void {
    this.loopSection = section;
    this.isLooping = isLooping;
  }

  public setIsLooping(isLooping: boolean): void {
    this.isLooping = isLooping;
  }

  public isLoopingActive(): boolean {
    return this.isLooping;
  }

  public getLoopSection(): SongSection | null {
    return this.loopSection;
  }

  // =========================================================================
  // AUDIO ELEMENT & VISUALIZER ACCESS
  // =========================================================================

  public getVisualizerData(): Uint8Array | null {
    if (this.activeProvider) {
      return this.activeProvider.getVisualizerData();
    }
    return null;
  }

  // =========================================================================
  // KARAOKE BACKING COORDINATION
  // (Maintains compatibility without migrating Karaoke into PlaybackController)
  // =========================================================================

  public setKaraokeMode(enabled: boolean, seekTime?: number): void {
    this.isKaraokeActive = enabled;
    const audio = this.getAudioElement();
    const supportsWebAudio = this.activeProvider?.capabilities.supportsWebAudioRouting ?? false;
    const audioRouteConnected = this.syncActiveAudioElement() || (supportsWebAudio && karaokeMixer.isAudioRouteConnected(audio));

    if (enabled) {
      karaokeMixer.resumeContext().catch(() => {});
    }

    if (!this.currentTrack) return;

    const resolution = vocalRemovalService.resolveMethod(this.currentTrack);

    if (!enabled) {
      // Leaving karaoke -> Restore normal music playback
      if (resolution.type === 'verified_instrumental' && resolution.backingStreamUrl) {
        this.activeProvider?.setBackingMode?.(
          false,
          resolution.backingStreamUrl,
          this.currentTrack.playbackSource?.streamUrl,
          seekTime
        );
      }
      karaokeMixer.setKaraokeMode(false);
      return;
    }

    // Entering karaoke -> Automatically activate best genuinely available vocal-removal method
    if (resolution.type === 'verified_instrumental' && resolution.backingStreamUrl) {
      // Prioritize verified instrumental backing track: play it automatically instead of original vocal recording
      this.activeProvider?.setBackingMode?.(
        true,
        resolution.backingStreamUrl,
        this.currentTrack.playbackSource?.streamUrl,
        seekTime
      );
      // Lead vocal is already absent from the backing track asset, so bypass center-channel cancellation
      karaokeMixer.setKaraokeMode(false);
    } else if (resolution.type === 'center_channel_reduction' && audioRouteConnected) {
      // Ordinary stereo audio fallback: engage real-time center-channel vocal reduction
      karaokeMixer.setKaraokeMode(true);
    } else {
      // Protected provider or unavailable: respect provider restrictions; do not attempt Web Audio DSP
      karaokeMixer.setKaraokeMode(false);
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

  // =========================================================================
  // NARO IMMERSIVE SOUND ENGINE COORDINATION
  // =========================================================================

  public setSoundMode(mode: SoundMode): void {
    karaokeMixer.setSoundMode(mode);
  }

  public getSoundMode(): SoundMode {
    return karaokeMixer.getSoundMode();
  }

  public setSoundPreset(preset: SoundPreset): void {
    karaokeMixer.setSoundPreset(preset);
  }

  public getSoundPreset(): SoundPreset {
    return karaokeMixer.getSoundPreset();
  }

  public setBassIntensity(intensity: number): void {
    karaokeMixer.setBassIntensity(intensity);
  }

  public getBassIntensity(): number {
    return karaokeMixer.getBassIntensity();
  }

  public isDspSupported(): boolean {
    return this.activeProvider?.capabilities.supportsWebAudioRouting ?? false;
  }

  public getActiveDspDescription(): string {
    return karaokeMixer.getActiveDspDescription();
  }

  // =========================================================================
  // CLEANUP / DISPOSAL
  // =========================================================================

  public dispose(): void {
    if (this.unsubscribeConnectivity) {
      this.unsubscribeConnectivity();
      this.unsubscribeConnectivity = null;
    }
    this.clockListeners.clear();
    if (this.activeProvider && typeof this.activeProvider.dispose === 'function') {
      this.activeProvider.dispose();
    }
  }
}

// Global canonical singleton instance of PlaybackController
export const playbackController = new PlaybackController();

if (typeof window !== 'undefined') {
  (window as unknown as { __naro_playback_controller?: PlaybackController }).__naro_playback_controller = playbackController;
}
