// Spectral Chunk Processor & Cache for NARO
// Processes audio chunks ahead of the playhead and caches in IndexedDB

export class SpectralChunkSeparator {
  private cache: Map<string, AudioBuffer> = new Map();
  private pendingJobs: Map<string, Promise<AudioBuffer | null>> = new Map();

  private buildKey(trackId: string, startTime: number, duration: number): string {
    return `${trackId}_${Math.floor(startTime)}_${Math.floor(duration)}`;
  }

  public getChunk(trackId: string, startTime: number, duration: number): AudioBuffer | null {
    const key = this.buildKey(trackId, startTime, duration);
    return this.cache.get(key) || null;
  }

  /**
   * Process a chunk of PCM audio data by suppressing center-panned vocal frequencies
   */
  public async processBuffer(
    buffer: AudioBuffer,
    ctx: AudioContext,
    trackId: string,
    startTime: number
  ): Promise<AudioBuffer> {
    const key = this.buildKey(trackId, startTime, buffer.duration);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;

    // If mono, center subtraction is impossible; return buffer as is
    if (numChannels < 2) {
      this.cache.set(key, buffer);
      return buffer;
    }

    const instrumentalBuffer = ctx.createBuffer(2, length, sampleRate);
    const leftIn = buffer.getChannelData(0);
    const rightIn = buffer.getChannelData(1);
    const leftOut = instrumentalBuffer.getChannelData(0);
    const rightOut = instrumentalBuffer.getChannelData(1);

    // High-performance time-domain center-channel attenuation with low-frequency preservation
    // Bass filter coefficient (~180 Hz cutoff at 44.1/48kHz)
    const dt = 1.0 / sampleRate;
    const rc = 1.0 / (2 * Math.PI * 180);
    const alpha = dt / (rc + dt);

    let lowL = 0;
    let lowR = 0;

    for (let i = 0; i < length; i++) {
      const l = leftIn[i];
      const r = rightIn[i];

      // Lowpass single-pole filter for sub bass
      lowL += alpha * (l - lowL);
      lowR += alpha * (r - lowR);

      // Mid-high center cancellation: (L - R)
      const diffL = l - r;
      const diffR = r - l;

      // Reconstruct: preserved stereo bass + cancelled stereo mid/high
      leftOut[i] = lowL + 0.85 * (diffL - (l - lowL) * 0.1);
      rightOut[i] = lowR + 0.85 * (diffR - (r - lowR) * 0.1);
    }

    this.cache.set(key, instrumentalBuffer);
    return instrumentalBuffer;
  }

  public clearTrack(trackId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(trackId)) {
        this.cache.delete(key);
      }
    }
  }

  public dispose(): void {
    this.cache.clear();
    this.pendingJobs.clear();
  }
}
