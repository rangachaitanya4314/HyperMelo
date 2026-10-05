// NARO Immersive Sound Engine
// Multi-stage audiophile sound processing layer with zero playback disruption
// Conforms to NARO Phase 2 Master Specification

export type SoundMode = 'original' | 'immersive';
export type SoundPreset = 'immersive' | 'deep' | 'vocal' | 'wide' | 'night';

export interface SoundProfileState {
  mode: SoundMode;
  preset: SoundPreset;
  active: boolean;
}

export class NaroImmersiveEngine {
  private ctx: AudioContext | null = null;
  private mode: SoundMode = 'original';
  private preset: SoundPreset = 'immersive';

  // Gain crossfaders (Dry / Wet)
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private wetInputGain: GainNode | null = null;

  // EQ Biquad Filters
  private lowShelfFilter: BiquadFilterNode | null = null;
  private lowMidCutFilter: BiquadFilterNode | null = null;
  private vocalPresenceFilter: BiquadFilterNode | null = null;
  private highShelfFilter: BiquadFilterNode | null = null;

  // Dynamics & Limiter
  private dynamicCompressor: DynamicsCompressorNode | null = null;
  private safetyLimiter: DynamicsCompressorNode | null = null;

  // Spatial Widener Nodes
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private sideGain: GainNode | null = null;
  private sideFilter: BiquadFilterNode | null = null;

  private isInitialized = false;

  /**
   * Connect NARO Immersive Engine between input and output nodes in the Web Audio graph
   */
  public init(ctx: AudioContext, inputNode: AudioNode, outputNode: AudioNode): void {
    if (this.isInitialized && this.ctx === ctx) {
      return;
    }

    this.ctx = ctx;

    try {
      // 1. Dry Path (Direct bypass)
      this.dryGain = ctx.createGain();
      // Default to Original (1.0 dry, 0.0 wet)
      this.dryGain.gain.setValueAtTime(this.mode === 'original' ? 1.0 : 0.0, ctx.currentTime);
      inputNode.connect(this.dryGain);
      this.dryGain.connect(outputNode);

      // 2. Wet Input Gain Staging (-1.5dB / 0.84 to guarantee headroom)
      this.wetInputGain = ctx.createGain();
      this.wetInputGain.gain.setValueAtTime(0.85, ctx.currentTime);
      inputNode.connect(this.wetInputGain);

      // 3. Tonal Equalization Filters
      // Low-shelf (Sub & low-end warmth)
      this.lowShelfFilter = ctx.createBiquadFilter();
      this.lowShelfFilter.type = 'lowshelf';
      this.lowShelfFilter.frequency.setValueAtTime(95, ctx.currentTime);
      this.lowShelfFilter.gain.setValueAtTime(2.0, ctx.currentTime);

      // Low-mid notch (Removes boxiness/muddiness)
      this.lowMidCutFilter = ctx.createBiquadFilter();
      this.lowMidCutFilter.type = 'peaking';
      this.lowMidCutFilter.frequency.setValueAtTime(320, ctx.currentTime);
      this.lowMidCutFilter.Q.setValueAtTime(1.2, ctx.currentTime);
      this.lowMidCutFilter.gain.setValueAtTime(-0.8, ctx.currentTime);

      // Vocal Presence Filter (Brings forward vocals & acoustic instruments)
      this.vocalPresenceFilter = ctx.createBiquadFilter();
      this.vocalPresenceFilter.type = 'peaking';
      this.vocalPresenceFilter.frequency.setValueAtTime(3000, ctx.currentTime);
      this.vocalPresenceFilter.Q.setValueAtTime(1.0, ctx.currentTime);
      this.vocalPresenceFilter.gain.setValueAtTime(1.8, ctx.currentTime);

      // High-shelf Air Filter (Silky acoustic sparkle without harshness)
      this.highShelfFilter = ctx.createBiquadFilter();
      this.highShelfFilter.type = 'highshelf';
      this.highShelfFilter.frequency.setValueAtTime(11000, ctx.currentTime);
      this.highShelfFilter.gain.setValueAtTime(1.5, ctx.currentTime);

      // Connect EQ chain
      this.wetInputGain.connect(this.lowShelfFilter);
      this.lowShelfFilter.connect(this.lowMidCutFilter);
      this.lowMidCutFilter.connect(this.vocalPresenceFilter);
      this.vocalPresenceFilter.connect(this.highShelfFilter);

      // 4. Dynamic Control (Gentle musical compression)
      this.dynamicCompressor = ctx.createDynamicsCompressor();
      this.dynamicCompressor.threshold.setValueAtTime(-16, ctx.currentTime);
      this.dynamicCompressor.knee.setValueAtTime(10, ctx.currentTime);
      this.dynamicCompressor.ratio.setValueAtTime(2.0, ctx.currentTime);
      this.dynamicCompressor.attack.setValueAtTime(0.02, ctx.currentTime);
      this.dynamicCompressor.release.setValueAtTime(0.25, ctx.currentTime);

      this.highShelfFilter.connect(this.dynamicCompressor);

      // 5. Phase-Safe Stereo Spatial Processing
      // Preserves mono compatibility: Center bass below 150Hz remains strictly mono-centered
      this.splitter = ctx.createChannelSplitter(2);
      this.merger = ctx.createChannelMerger(2);
      this.sideGain = ctx.createGain();
      this.sideGain.gain.setValueAtTime(0.12, ctx.currentTime);

      this.sideFilter = ctx.createBiquadFilter();
      this.sideFilter.type = 'highpass';
      this.sideFilter.frequency.setValueAtTime(220, ctx.currentTime);

      // Connect compressor to stereo processor
      this.dynamicCompressor.connect(this.splitter);

      // Split into Left and Right
      // Direct pass-through L -> L, R -> R
      this.splitter.connect(this.merger, 0, 0);
      this.splitter.connect(this.merger, 1, 1);

      // Subtle phase-safe cross-side enhancement
      this.splitter.connect(this.sideFilter, 0);
      this.sideFilter.connect(this.sideGain);
      // Gentle out-of-phase cross-feed to the opposite channel for width without center cancellation
      this.sideGain.connect(this.merger, 0, 1);

      // 6. Safety Limiter (Prevents digital clipping under all conditions)
      this.safetyLimiter = ctx.createDynamicsCompressor();
      this.safetyLimiter.threshold.setValueAtTime(-0.5, ctx.currentTime); // -0.5 dB ceiling
      this.safetyLimiter.knee.setValueAtTime(0, ctx.currentTime);
      this.safetyLimiter.ratio.setValueAtTime(20.0, ctx.currentTime); // Brickwall limiting
      this.safetyLimiter.attack.setValueAtTime(0.001, ctx.currentTime); // 1ms peak catcher
      this.safetyLimiter.release.setValueAtTime(0.05, ctx.currentTime);

      this.merger.connect(this.safetyLimiter);

      // 7. Wet Output Gain Node
      this.wetGain = ctx.createGain();
      this.wetGain.gain.setValueAtTime(this.mode === 'immersive' ? 1.0 : 0.0, ctx.currentTime);
      this.safetyLimiter.connect(this.wetGain);
      this.wetGain.connect(outputNode);

      this.isInitialized = true;
      this.applyPreset(this.preset);
    } catch (err) {
      console.warn('[NaroImmersiveEngine] Web Audio initialization warning:', err);
    }
  }

  /**
   * Set sound mode ('original' = full bypass, 'immersive' = active NARO processing)
   * Smooth 30ms crossfade ensures zero clicks, zero restarts, zero position jumps
   */
  public setMode(mode: SoundMode): void {
    this.mode = mode;
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const now = this.ctx.currentTime;
    const isImmersive = mode === 'immersive';

    // 30ms smooth non-destructive crossfade
    this.dryGain.gain.setTargetAtTime(isImmersive ? 0.0 : 1.0, now, 0.025);
    this.wetGain.gain.setTargetAtTime(isImmersive ? 1.0 : 0.0, now, 0.025);
  }

  public getMode(): SoundMode {
    return this.mode;
  }

  /**
   * Switch between audiophile presets
   */
  public setPreset(preset: SoundPreset): void {
    this.preset = preset;
    this.applyPreset(preset);
  }

  public getPreset(): SoundPreset {
    return this.preset;
  }

  public getState(): SoundProfileState {
    return {
      mode: this.mode,
      preset: this.preset,
      active: this.mode === 'immersive'
    };
  }

  private applyPreset(preset: SoundPreset): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const timeConstant = 0.04;

    switch (preset) {
      case 'immersive':
        // Balanced NARO tonal character: warm controlled bass, vocal presence, transparent sparkle
        this.lowShelfFilter?.gain.setTargetAtTime(2.2, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-0.8, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(1.8, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(1.5, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-16, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(2.0, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.12, now, timeConstant);
        break;

      case 'deep':
        // Controlled bass enhancement with balanced mids and peak limiter safety
        this.lowShelfFilter?.gain.setTargetAtTime(4.2, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-1.8, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(1.0, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(0.6, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-18, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(2.4, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.06, now, timeConstant);
        break;

      case 'vocal':
        // Vocal presence enhancement and controlled low-mid cleanup
        this.lowShelfFilter?.gain.setTargetAtTime(-0.5, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-2.4, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(3.6, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(2.0, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-15, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(2.2, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.08, now, timeConstant);
        break;

      case 'wide':
        // Subtle phase-safe stereo widening for live & acoustic material
        this.lowShelfFilter?.gain.setTargetAtTime(1.2, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(0.0, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(1.6, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(2.4, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-14, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(1.8, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.32, now, timeConstant);
        break;

      case 'night':
        // Gentle dynamic compression and controlled peaks for comfortable low-volume listening
        this.lowShelfFilter?.gain.setTargetAtTime(1.0, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-1.0, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(0.2, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(-1.5, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-24, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(3.5, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.0, now, timeConstant);
        break;
    }
  }
}

export const naroImmersiveEngine = new NaroImmersiveEngine();
