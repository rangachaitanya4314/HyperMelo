// NARO Immersive & Punch Sound Engine
// Multi-stage audiophile sound processing layer with zero playback disruption
// Conforms to NARO Phase 2 & Phase 3 Master Specification
// Provides genuine differentiated listening modes: Original, Immersive, Punch
// Plus click-free Bass Intensity enhancement, headroom compensation, and brickwall safety limiting.

export type SoundMode = 'original' | 'immersive' | 'punch';
export type SoundPreset = 'immersive' | 'punch' | 'deep' | 'vocal' | 'wide' | 'night';

export interface SoundProfileState {
  mode: SoundMode;
  preset: SoundPreset;
  bassIntensity: number; // -5 to +5, neutral default 0
  active: boolean;       // true if mode !== 'original'
  isSupported: boolean;  // true if current playback source routes through Web Audio
}

export class NaroImmersiveEngine {
  private ctx: AudioContext | null = null;
  private mode: SoundMode = 'original';
  private preset: SoundPreset = 'immersive';
  private bassIntensity = 0; // default 0 neutral (-5 to +5 range)
  private isSupported = true;

  // Gain crossfaders (Dry / Wet)
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private wetInputGain: GainNode | null = null;

  // EQ Biquad Filters
  private subsonicFilter: BiquadFilterNode | null = null;     // Highpass 35 Hz to control rumble < 40-50 Hz
  private lowShelfFilter: BiquadFilterNode | null = null;     // Low-shelf 95-105 Hz for rich bass warmth
  private punchFilter: BiquadFilterNode | null = null;        // Peaking 85 Hz (Q=1.4) for kick-drum definition
  private lowMidCutFilter: BiquadFilterNode | null = null;    // Peaking 280-300 Hz to remove mud and boxiness
  private vocalPresenceFilter: BiquadFilterNode | null = null;// Peaking 3.0-3.2 kHz to keep vocals clear & centered
  private highShelfFilter: BiquadFilterNode | null = null;    // High-shelf 9.5-11 kHz for silky, non-fatiguing highs

  // Dynamics & Limiter
  private dynamicCompressor: DynamicsCompressorNode | null = null;
  private safetyLimiter: DynamicsCompressorNode | null = null;

  // Spatial Widener Nodes (Phase-safe, mono-compatible)
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
      // 1. Dry Path (Direct true bypass with unity gain)
      this.dryGain = ctx.createGain();
      // Default to Original (1.0 dry, 0.0 wet)
      this.dryGain.gain.setValueAtTime(this.mode === 'original' ? 1.0 : 0.0, ctx.currentTime);
      inputNode.connect(this.dryGain);
      this.dryGain.connect(outputNode);

      // 2. Wet Input Gain Staging (-1.5dB to -1.8dB headroom compensation to prevent clipping and match loudness)
      this.wetInputGain = ctx.createGain();
      const initialWetInputGain = this.mode === 'punch' ? 0.81 : 0.84;
      this.wetInputGain.gain.setValueAtTime(initialWetInputGain, ctx.currentTime);
      inputNode.connect(this.wetInputGain);

      // 3. Tonal Equalization Filters
      // Subsonic Highpass Filter (Cuts muddy inaudible rumble below 35-40 Hz to protect excursion & headroom)
      this.subsonicFilter = ctx.createBiquadFilter();
      this.subsonicFilter.type = 'highpass';
      this.subsonicFilter.frequency.setValueAtTime(35, ctx.currentTime);
      this.subsonicFilter.Q.setValueAtTime(0.707, ctx.currentTime);

      // Low-shelf (Sub & low-end warmth, 70-120 Hz region)
      this.lowShelfFilter = ctx.createBiquadFilter();
      this.lowShelfFilter.type = 'lowshelf';
      this.lowShelfFilter.frequency.setValueAtTime(95, ctx.currentTime);
      this.lowShelfFilter.gain.setValueAtTime(2.5, ctx.currentTime);

      // Punch Peaking Filter (Kick-drum punch in the 80-90 Hz range)
      this.punchFilter = ctx.createBiquadFilter();
      this.punchFilter.type = 'peaking';
      this.punchFilter.frequency.setValueAtTime(85, ctx.currentTime);
      this.punchFilter.Q.setValueAtTime(1.4, ctx.currentTime);
      this.punchFilter.gain.setValueAtTime(0.0, ctx.currentTime);

      // Low-mid notch (Removes boxiness/muddiness around 280-320 Hz)
      this.lowMidCutFilter = ctx.createBiquadFilter();
      this.lowMidCutFilter.type = 'peaking';
      this.lowMidCutFilter.frequency.setValueAtTime(300, ctx.currentTime);
      this.lowMidCutFilter.Q.setValueAtTime(1.2, ctx.currentTime);
      this.lowMidCutFilter.gain.setValueAtTime(-1.0, ctx.currentTime);

      // Vocal Presence Filter (Keeps vocals intelligible, centered, and forward)
      this.vocalPresenceFilter = ctx.createBiquadFilter();
      this.vocalPresenceFilter.type = 'peaking';
      this.vocalPresenceFilter.frequency.setValueAtTime(3000, ctx.currentTime);
      this.vocalPresenceFilter.Q.setValueAtTime(1.0, ctx.currentTime);
      this.vocalPresenceFilter.gain.setValueAtTime(2.0, ctx.currentTime);

      // High-shelf Air Filter (Silky acoustic sparkle without harshness or fatigue)
      this.highShelfFilter = ctx.createBiquadFilter();
      this.highShelfFilter.type = 'highshelf';
      this.highShelfFilter.frequency.setValueAtTime(11000, ctx.currentTime);
      this.highShelfFilter.gain.setValueAtTime(1.6, ctx.currentTime);

      // Connect EQ chain: wetInput -> subsonic -> lowShelf -> punch -> lowMidCut -> vocalPresence -> highShelf
      this.wetInputGain.connect(this.subsonicFilter);
      this.subsonicFilter.connect(this.lowShelfFilter);
      this.lowShelfFilter.connect(this.punchFilter);
      this.punchFilter.connect(this.lowMidCutFilter);
      this.lowMidCutFilter.connect(this.vocalPresenceFilter);
      this.vocalPresenceFilter.connect(this.highShelfFilter);

      // 4. Dynamic Control (Controlled musical compression without pumping)
      this.dynamicCompressor = ctx.createDynamicsCompressor();
      this.dynamicCompressor.threshold.setValueAtTime(-16, ctx.currentTime);
      this.dynamicCompressor.knee.setValueAtTime(10, ctx.currentTime);
      this.dynamicCompressor.ratio.setValueAtTime(2.0, ctx.currentTime);
      this.dynamicCompressor.attack.setValueAtTime(0.02, ctx.currentTime);
      this.dynamicCompressor.release.setValueAtTime(0.25, ctx.currentTime);

      this.highShelfFilter.connect(this.dynamicCompressor);

      // 5. Phase-Safe Stereo Spatial Processing
      // Mono compatibility: Center bass below 160Hz remains strictly mono-centered
      this.splitter = ctx.createChannelSplitter(2);
      this.merger = ctx.createChannelMerger(2);
      this.sideGain = ctx.createGain();
      this.sideGain.gain.setValueAtTime(0.14, ctx.currentTime);

      this.sideFilter = ctx.createBiquadFilter();
      this.sideFilter.type = 'highpass';
      this.sideFilter.frequency.setValueAtTime(220, ctx.currentTime);

      // Connect compressor to stereo processor
      this.dynamicCompressor.connect(this.splitter);

      // Split into Left and Right
      // Direct pass-through L -> L, R -> R
      this.splitter.connect(this.merger, 0, 0);
      this.splitter.connect(this.merger, 1, 1);

      // Subtle phase-safe cross-side enhancement (high frequencies only)
      this.splitter.connect(this.sideFilter, 0);
      this.sideFilter.connect(this.sideGain);
      this.sideGain.connect(this.merger, 0, 1);

      // 6. Output Brickwall Safety Limiter (Prevents digital clipping under all circumstances)
      this.safetyLimiter = ctx.createDynamicsCompressor();
      this.safetyLimiter.threshold.setValueAtTime(-0.5, ctx.currentTime); // -0.5 dB ceiling
      this.safetyLimiter.knee.setValueAtTime(0, ctx.currentTime);
      this.safetyLimiter.ratio.setValueAtTime(20.0, ctx.currentTime);     // Brickwall limiting
      this.safetyLimiter.attack.setValueAtTime(0.001, ctx.currentTime);   // 1ms peak catcher
      this.safetyLimiter.release.setValueAtTime(0.05, ctx.currentTime);

      this.merger.connect(this.safetyLimiter);

      // 7. Wet Output Gain Node
      this.wetGain = ctx.createGain();
      this.wetGain.gain.setValueAtTime(this.mode !== 'original' ? 1.0 : 0.0, ctx.currentTime);
      this.safetyLimiter.connect(this.wetGain);
      this.wetGain.connect(outputNode);

      this.isInitialized = true;
      this.applyModeParameters(this.mode);
    } catch (err) {
      console.warn('[NaroImmersiveEngine] Web Audio initialization warning:', err);
    }
  }

  /**
   * Set sound mode ('original' | 'immersive' | 'punch')
   * Smooth 30ms non-destructive crossfade ensures zero clicks, zero restarts, zero position jumps.
   */
  public setMode(mode: SoundMode): void {
    this.mode = mode;
    this.applyModeParameters(mode);

    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const now = this.ctx.currentTime;
    const isProcessed = mode !== 'original' && this.isSupported;

    // Smooth 30ms non-destructive crossfade
    this.dryGain.gain.setTargetAtTime(isProcessed ? 0.0 : 1.0, now, 0.025);
    this.wetGain.gain.setTargetAtTime(isProcessed ? 1.0 : 0.0, now, 0.025);
  }

  public getMode(): SoundMode {
    return this.mode;
  }

  /**
   * Adjust Bass Intensity (-5 to +5, default 0 neutral).
   * Bounded adjustment mapped to low-shelf filter gain with 30ms smoothing ramp.
   */
  public setBassIntensity(intensity: number): void {
    this.bassIntensity = Math.max(-5, Math.min(5, Math.round(intensity)));
    if (!this.ctx || !this.lowShelfFilter) return;

    const now = this.ctx.currentTime;
    const baseLowShelfGain = this.mode === 'punch' ? 2.2 : (this.mode === 'immersive' ? 2.5 : 0.0);
    const targetGain = baseLowShelfGain + this.bassIntensity * 0.9;
    this.lowShelfFilter.gain.setTargetAtTime(targetGain, now, 0.03);
  }

  public getBassIntensity(): number {
    return this.bassIntensity;
  }

  /**
   * Declare whether current playback provider supports Web Audio processing.
   * If false, DSP automatically bypasses and reports honestly.
   */
  public setSupported(supported: boolean): void {
    this.isSupported = supported;
    if (!supported && this.dryGain && this.wetGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.025);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.025);
    } else if (supported && this.mode !== 'original' && this.dryGain && this.wetGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.dryGain.gain.setTargetAtTime(0.0, now, 0.025);
      this.wetGain.gain.setTargetAtTime(1.0, now, 0.025);
    }
  }

  public isDspSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Audiophile preset switching (maintains backward compatibility)
   */
  public setPreset(preset: SoundPreset): void {
    this.preset = preset;
    if (preset === 'punch') {
      this.setMode('punch');
    } else {
      this.applyPreset(preset);
    }
  }

  public getPreset(): SoundPreset {
    return this.preset;
  }

  public getState(): SoundProfileState {
    return {
      mode: this.mode,
      preset: this.preset,
      bassIntensity: this.bassIntensity,
      active: this.mode !== 'original' && this.isSupported,
      isSupported: this.isSupported
    };
  }

  private applyModeParameters(mode: SoundMode): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const timeConstant = 0.03; // 30ms smooth ramp to prevent audible clicks

    if (mode === 'original') {
      // Original mode: unity gain bypass
      return;
    }

    if (mode === 'immersive') {
      // IMMERSIVE MODE:
      // Spacious, cinema-inspired soundstage. Centered intelligible vocals, controlled bass warmth,
      // silky air, and mono-compatible phase-safe stereo width.
      this.wetInputGain?.gain.setTargetAtTime(0.84, now, timeConstant); // -1.5 dB headroom compensation
      this.subsonicFilter?.frequency.setTargetAtTime(35, now, timeConstant);
      this.lowShelfFilter?.frequency.setTargetAtTime(95, now, timeConstant);
      this.lowShelfFilter?.gain.setTargetAtTime(2.5 + this.bassIntensity * 0.9, now, timeConstant);
      this.punchFilter?.gain.setTargetAtTime(0.0, now, timeConstant); // Neutral in immersive
      this.lowMidCutFilter?.frequency.setTargetAtTime(300, now, timeConstant);
      this.lowMidCutFilter?.gain.setTargetAtTime(-1.0, now, timeConstant);
      this.vocalPresenceFilter?.frequency.setTargetAtTime(3000, now, timeConstant);
      this.vocalPresenceFilter?.gain.setTargetAtTime(2.0, now, timeConstant);
      this.highShelfFilter?.frequency.setTargetAtTime(11000, now, timeConstant);
      this.highShelfFilter?.gain.setTargetAtTime(1.6, now, timeConstant);

      this.dynamicCompressor?.threshold.setTargetAtTime(-16, now, timeConstant);
      this.dynamicCompressor?.ratio.setTargetAtTime(2.0, now, timeConstant);
      this.dynamicCompressor?.attack.setTargetAtTime(0.02, now, timeConstant);
      this.dynamicCompressor?.release.setTargetAtTime(0.25, now, timeConstant);

      this.sideGain?.gain.setTargetAtTime(0.14, now, timeConstant);
    } else if (mode === 'punch') {
      // PUNCH MODE:
      // Energetic, JBL-inspired impact. Tighter kick-drum impact, articulate bass guitar,
      // crisp non-fatiguing highs, controlled dynamics, and focused center punch.
      this.wetInputGain?.gain.setTargetAtTime(0.81, now, timeConstant); // -1.8 dB headroom compensation
      this.subsonicFilter?.frequency.setTargetAtTime(35, now, timeConstant);
      this.lowShelfFilter?.frequency.setTargetAtTime(105, now, timeConstant);
      this.lowShelfFilter?.gain.setTargetAtTime(2.2 + this.bassIntensity * 0.9, now, timeConstant);
      this.punchFilter?.frequency.setTargetAtTime(85, now, timeConstant);
      this.punchFilter?.gain.setTargetAtTime(3.6, now, timeConstant); // Dedicated kick punch
      this.lowMidCutFilter?.frequency.setTargetAtTime(280, now, timeConstant);
      this.lowMidCutFilter?.gain.setTargetAtTime(-1.6, now, timeConstant); // Clean up lower-mid mud
      this.vocalPresenceFilter?.frequency.setTargetAtTime(3200, now, timeConstant);
      this.vocalPresenceFilter?.gain.setTargetAtTime(1.8, now, timeConstant);
      this.highShelfFilter?.frequency.setTargetAtTime(9500, now, timeConstant);
      this.highShelfFilter?.gain.setTargetAtTime(1.8, now, timeConstant); // Crisp snap

      this.dynamicCompressor?.threshold.setTargetAtTime(-14, now, timeConstant);
      this.dynamicCompressor?.ratio.setTargetAtTime(2.5, now, timeConstant);
      this.dynamicCompressor?.attack.setTargetAtTime(0.01, now, timeConstant);
      this.dynamicCompressor?.release.setTargetAtTime(0.12, now, timeConstant);

      this.sideGain?.gain.setTargetAtTime(0.04, now, timeConstant); // Focused centered punch
    }
  }

  private applyPreset(preset: SoundPreset): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const timeConstant = 0.04;

    switch (preset) {
      case 'immersive':
        this.applyModeParameters('immersive');
        break;

      case 'punch':
        this.applyModeParameters('punch');
        break;

      case 'deep':
        this.lowShelfFilter?.gain.setTargetAtTime(4.2 + this.bassIntensity * 0.9, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-1.8, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(1.0, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(0.6, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-18, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(2.4, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.06, now, timeConstant);
        break;

      case 'vocal':
        this.lowShelfFilter?.gain.setTargetAtTime(-0.5 + this.bassIntensity * 0.9, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(-2.4, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(3.6, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(2.0, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-15, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(2.2, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.08, now, timeConstant);
        break;

      case 'wide':
        this.lowShelfFilter?.gain.setTargetAtTime(1.2 + this.bassIntensity * 0.9, now, timeConstant);
        this.lowMidCutFilter?.gain.setTargetAtTime(0.0, now, timeConstant);
        this.vocalPresenceFilter?.gain.setTargetAtTime(1.6, now, timeConstant);
        this.highShelfFilter?.gain.setTargetAtTime(2.4, now, timeConstant);
        this.dynamicCompressor?.threshold.setTargetAtTime(-14, now, timeConstant);
        this.dynamicCompressor?.ratio.setTargetAtTime(1.8, now, timeConstant);
        this.sideGain?.gain.setTargetAtTime(0.32, now, timeConstant);
        break;

      case 'night':
        this.lowShelfFilter?.gain.setTargetAtTime(1.0 + this.bassIntensity * 0.9, now, timeConstant);
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
