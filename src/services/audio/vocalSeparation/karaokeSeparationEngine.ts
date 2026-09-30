// Master Karaoke Separation Engine for NARO
// Implements KaraokeSeparationEngine interface defined in NARO Master Core Architecture

import type { Song } from '../../../types/music';
import type { KaraokeSeparationEngine } from './separationTypes';
import { SpectralChunkSeparator } from './SpectralChunkSeparator';

class MasterKaraokeSeparationEngine implements KaraokeSeparationEngine {
  private chunkSeparator: SpectralChunkSeparator;
  private preparedTracks: Set<string> = new Set();
  private audioContext: AudioContext | null = null;

  constructor() {
    this.chunkSeparator = new SpectralChunkSeparator();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  public canProcess(track?: Song): boolean {
    if (!track) return true;
    // 1. If song has explicit licensed stems or procedural signature, it is 100% processable
    if (track.karaokeSource?.type === 'licensed_stems' || track.audioSignature) {
      return true;
    }
    // 2. If song has an authorized playback stream URL, it can be processed via real-time DSP suppression
    if (track.playbackSource?.streamUrl) {
      return true;
    }
    return false;
  }

  public async prepare(track: Song): Promise<void> {
    if (!this.canProcess(track)) {
      throw new Error(`Cannot process track ${track.title}: No stream or stems available.`);
    }
    this.preparedTracks.add(track.id);
  }

  public async process(track: Song): Promise<void> {
    await this.prepare(track);
  }

  public async processChunk(
    track: Song,
    startTime: number,
    duration: number
  ): Promise<AudioBuffer | null> {
    const cached = this.chunkSeparator.getChunk(track.id, startTime, duration);
    if (cached) return cached;

    const streamUrl = track.playbackSource?.streamUrl;
    if (!streamUrl) return null;

    try {
      const ctx = this.getAudioContext();
      // Fetch audio data for chunk processing
      const response = await fetch(streamUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      return await this.chunkSeparator.processBuffer(decoded, ctx, track.id, startTime);
    } catch (err) {
      console.warn('Chunk separation error:', err);
      return null;
    }
  }

  public getInstrumentalChunk(track: Song, startTime: number): AudioBuffer | null {
    return this.chunkSeparator.getChunk(track.id, startTime, 15);
  }

  public getVocalsChunk(_track: Song, _startTime: number): AudioBuffer | null {
    // Phase 1 provides vocal suppression; isolated vocal stems can be returned when neural model finishes
    return null;
  }

  public isReady(track: Song, _startTime?: number): boolean {
    return this.canProcess(track);
  }

  public cancel(track: Song): void {
    this.chunkSeparator.clearTrack(track.id);
    this.preparedTracks.delete(track.id);
  }

  public dispose(track: Song): void {
    this.cancel(track);
  }
}

export const karaokeSeparationEngine = new MasterKaraokeSeparationEngine();
