// Master Playback Service for NARO (Compatibility Facade)
// Phase 3.5B: Wraps the dedicated PlaybackController to preserve backward compatibility
// while delegating all playback orchestration and authoritative clock management to PlaybackController.

import type { Song } from '../../shared';
import type {
  MusicPlaybackProvider,
  PlaybackClockEvent,
  PlaybackClockListener,
  ProviderCapabilities
} from './playbackTypes';
import { AppleMusicPlaybackProvider } from './AppleMusicPlaybackProvider';
import { NaroFullLengthPlaybackProvider } from './NaroFullLengthPlaybackProvider';
import { Html5AudioPlaybackProvider } from './Html5AudioPlaybackProvider';
import { YouTubeIframePlaybackProvider } from './YouTubeIframePlaybackProvider';
import { PlaybackController, playbackController } from './PlaybackController';
import type { SoundMode, SoundPreset } from './naroImmersiveEngine';

export class PlaybackService {
  private controller: PlaybackController;

  constructor(controller: PlaybackController = playbackController) {
    this.controller = controller;
  }

  // Properties / getters / setters for provider & track access
  public get activeProvider(): MusicPlaybackProvider | null {
    return this.controller.getActiveProvider();
  }

  public set activeProvider(provider: MusicPlaybackProvider | null) {
    this.controller.setActiveProvider(provider);
  }

  public get appleMusicProvider(): AppleMusicPlaybackProvider {
    return this.controller.appleMusicProvider;
  }

  public set appleMusicProvider(provider: AppleMusicPlaybackProvider) {
    this.controller.appleMusicProvider = provider;
  }

  public get naroFullLengthProvider(): NaroFullLengthPlaybackProvider {
    return this.controller.naroFullLengthProvider;
  }

  public set naroFullLengthProvider(provider: NaroFullLengthPlaybackProvider) {
    this.controller.naroFullLengthProvider = provider;
  }

  public get html5Provider(): Html5AudioPlaybackProvider {
    return this.controller.html5Provider;
  }

  public set html5Provider(provider: Html5AudioPlaybackProvider) {
    this.controller.html5Provider = provider;
  }

  public get youtubeProvider(): YouTubeIframePlaybackProvider {
    return this.controller.youtubeProvider;
  }

  public set youtubeProvider(provider: YouTubeIframePlaybackProvider) {
    this.controller.youtubeProvider = provider;
  }

  public get currentSong(): Song | null {
    return this.controller.getCurrentTrack();
  }

  public set currentSong(song: Song | null) {
    this.controller.setCurrentTrack(song);
  }

  public subscribeClock(listener: PlaybackClockListener): () => void {
    return this.controller.subscribeClock(listener);
  }

  public selectProviderForSong(song: Song): MusicPlaybackProvider {
    return this.controller.selectProviderForSong(song);
  }

  public getActiveProvider(): MusicPlaybackProvider | null {
    return this.controller.getActiveProvider();
  }

  public getProviderCapabilities(): ProviderCapabilities | null {
    return this.controller.getProviderCapabilities();
  }

  public canPlayFullLength(song: Song): boolean {
    if (!song) return false;
    const provider = this.selectProviderForSong(song);
    return provider ? provider.canPlayFullLength(song) : false;
  }

  public isAuthorized(providerId?: string): boolean {
    return this.controller.isAuthorized(providerId);
  }

  public async authenticateProvider(providerId: string): Promise<boolean> {
    return this.controller.authenticateProvider(providerId);
  }

  public async loadAndPlay(song: Song, startTime = 0): Promise<void> {
    return this.controller.loadAndPlay(song, startTime);
  }

  public async playSong(song: Song, startTime = 0): Promise<void> {
    return this.controller.loadAndPlay(song, startTime);
  }

  public async load(song: Song, startTime = 0): Promise<void> {
    return this.controller.load(song, startTime);
  }

  public async play(): Promise<void> {
    return this.controller.play();
  }

  public async togglePlay(fallbackSong?: Song): Promise<void> {
    return this.controller.togglePlay(fallbackSong);
  }

  public seek(time: number): void {
    this.controller.seek(time);
  }

  public pause(): void {
    this.controller.pause();
  }

  public setVolume(vol: number): void {
    this.controller.setVolume(vol);
  }

  public getVolume(): number {
    return this.controller.getVolume();
  }

  public getVisualizerData(): Uint8Array | null {
    return this.controller.getVisualizerData();
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.controller.getAudioElement();
  }

  public setKaraokeMode(enabled: boolean, seekTime?: number): void {
    this.controller.setKaraokeMode(enabled, seekTime);
  }

  public isKaraokeMode(): boolean {
    return this.controller.isKaraokeMode();
  }

  public setBgmVolume(vol: number): void {
    this.controller.setBgmVolume(vol);
  }

  public setVoiceVolume(vol: number): void {
    this.controller.setVoiceVolume(vol);
  }

  public setMicEnabled(enabled: boolean): void {
    this.controller.setMicEnabled(enabled);
  }

  public setSoundMode(mode: SoundMode): void {
    this.controller.setSoundMode(mode);
  }

  public getSoundMode(): SoundMode {
    return this.controller.getSoundMode();
  }

  public setBassIntensity(intensity: number): void {
    this.controller.setBassIntensity(intensity);
  }

  public getBassIntensity(): number {
    return this.controller.getBassIntensity();
  }

  public isDspSupported(): boolean {
    return this.controller.isDspSupported();
  }

  public setSoundPreset(preset: SoundPreset): void {
    this.controller.setSoundPreset(preset);
  }

  public getSoundPreset(): SoundPreset {
    return this.controller.getSoundPreset();
  }

  public getCurrentClock(): PlaybackClockEvent {
    return this.controller.getCurrentClock();
  }
}

export const playbackService = new PlaybackService(playbackController);
