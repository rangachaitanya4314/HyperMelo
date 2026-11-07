// Web Audio DSP Real-Time Vocal Suppressor for NARO
// Provides zero-latency center-channel phase inversion with dual-band bass/air preservation
// Allows instant "Turn the singer off and let me sing" on any playing stereo track

export class WebAudioVocalSuppressor {
  private ctx: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private suppressionAmount = 0; // 0 = normal (full vocal), 1 = karaoke (vocal suppressed)
  private isDisposed = false;

  // Filter nodes for multi-band reconstruction
  private bassLpL: BiquadFilterNode;
  private bassLpR: BiquadFilterNode;
  private airHpL: BiquadFilterNode;
  private airHpR: BiquadFilterNode;
  private midBpL: BiquadFilterNode;
  private midBpR: BiquadFilterNode;
  private notchL1: BiquadFilterNode;
  private notchR1: BiquadFilterNode;
  private notchL2: BiquadFilterNode;
  private notchR2: BiquadFilterNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Master in/out
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();

    // Crossfade paths
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // 1. Direct path (for normal mode)
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // 2. Vocal-suppressed path (for karaoke mode)
    const splitter = this.ctx.createChannelSplitter(2);
    const merger = this.ctx.createChannelMerger(2);

    this.inputNode.connect(splitter);

    // --- Band 1: Bass / Sub Preservation (< 180 Hz) ---
    // Protects kick drum, bassline and low-end harmonics from cancellation
    this.bassLpL = this.ctx.createBiquadFilter();
    this.bassLpL.type = 'lowpass';
    this.bassLpL.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.bassLpL.Q.setValueAtTime(0.707, this.ctx.currentTime);

    this.bassLpR = this.ctx.createBiquadFilter();
    this.bassLpR.type = 'lowpass';
    this.bassLpR.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.bassLpR.Q.setValueAtTime(0.707, this.ctx.currentTime);

    splitter.connect(this.bassLpL, 0);
    splitter.connect(this.bassLpR, 1);

    this.bassLpL.connect(merger, 0, 0);
    this.bassLpR.connect(merger, 0, 1);

    // --- Band 2: High Air Preservation (> 4500 Hz) ---
    // Protects cymbals, acoustic sparkle, high synths, and stereo ambiance
    this.airHpL = this.ctx.createBiquadFilter();
    this.airHpL.type = 'highpass';
    this.airHpL.frequency.setValueAtTime(4500, this.ctx.currentTime);
    this.airHpL.Q.setValueAtTime(0.707, this.ctx.currentTime);

    this.airHpR = this.ctx.createBiquadFilter();
    this.airHpR.type = 'highpass';
    this.airHpR.frequency.setValueAtTime(4500, this.ctx.currentTime);
    this.airHpR.Q.setValueAtTime(0.707, this.ctx.currentTime);

    splitter.connect(this.airHpL, 0);
    splitter.connect(this.airHpR, 1);

    this.airHpL.connect(merger, 0, 0);
    this.airHpR.connect(merger, 0, 1);

    // --- Band 3: Vocal / Midrange Band (180 Hz - 4500 Hz) with Center-Channel Phase Inversion ---
    // Most lead vocals are mixed center (L == R). L - R completely eliminates the center vocal.
    // Centered at 900 Hz with wide Q = 0.25 covering the 180 Hz - 4500 Hz vocal fundamental & formant spectrum.
    this.midBpL = this.ctx.createBiquadFilter();
    this.midBpL.type = 'bandpass';
    this.midBpL.frequency.setValueAtTime(900, this.ctx.currentTime);
    this.midBpL.Q.setValueAtTime(0.25, this.ctx.currentTime);

    this.midBpR = this.ctx.createBiquadFilter();
    this.midBpR.type = 'bandpass';
    this.midBpR.frequency.setValueAtTime(900, this.ctx.currentTime);
    this.midBpR.Q.setValueAtTime(0.25, this.ctx.currentTime);

    splitter.connect(this.midBpL, 0);
    splitter.connect(this.midBpR, 1);

    // Center-Channel Phase Cancellation Matrix:
    // Out_L = Mid_L - Mid_R
    // Out_R = Mid_R - Mid_L
    const invGainR = this.ctx.createGain();
    invGainR.gain.setValueAtTime(-1.0, this.ctx.currentTime); // -Mid_R

    const invGainL = this.ctx.createGain();
    invGainL.gain.setValueAtTime(-1.0, this.ctx.currentTime); // -Mid_L

    this.midBpR.connect(invGainR);
    this.midBpL.connect(invGainL);

    // Twin Formant Notch Filters for residual vocal energy damping (around 1 kHz & 2.5 kHz)
    this.notchL1 = this.ctx.createBiquadFilter();
    this.notchL1.type = 'peaking';
    this.notchL1.frequency.setValueAtTime(1050, this.ctx.currentTime);
    this.notchL1.Q.setValueAtTime(1.8, this.ctx.currentTime);
    this.notchL1.gain.setValueAtTime(-6.0, this.ctx.currentTime);

    this.notchR1 = this.ctx.createBiquadFilter();
    this.notchR1.type = 'peaking';
    this.notchR1.frequency.setValueAtTime(1050, this.ctx.currentTime);
    this.notchR1.Q.setValueAtTime(1.8, this.ctx.currentTime);
    this.notchR1.gain.setValueAtTime(-6.0, this.ctx.currentTime);

    this.notchL2 = this.ctx.createBiquadFilter();
    this.notchL2.type = 'peaking';
    this.notchL2.frequency.setValueAtTime(2600, this.ctx.currentTime);
    this.notchL2.Q.setValueAtTime(2.0, this.ctx.currentTime);
    this.notchL2.gain.setValueAtTime(-5.0, this.ctx.currentTime);

    this.notchR2 = this.ctx.createBiquadFilter();
    this.notchR2.type = 'peaking';
    this.notchR2.frequency.setValueAtTime(2600, this.ctx.currentTime);
    this.notchR2.Q.setValueAtTime(2.0, this.ctx.currentTime);
    this.notchR2.gain.setValueAtTime(-5.0, this.ctx.currentTime);

    // Connect L channel subtraction: Mid_L + (-Mid_R) -> Notch -> Merger Ch 0
    this.midBpL.connect(this.notchL1);
    invGainR.connect(this.notchL1);
    this.notchL1.connect(this.notchL2);
    this.notchL2.connect(merger, 0, 0);

    // Connect R channel subtraction: Mid_R + (-Mid_L) -> Notch -> Merger Ch 1
    this.midBpR.connect(this.notchR1);
    invGainL.connect(this.notchR1);
    this.notchR1.connect(this.notchR2);
    this.notchR2.connect(merger, 0, 1);

    // Route merged instrumental to wet gain
    merger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  public getInput(): GainNode {
    return this.inputNode;
  }

  public getOutput(): GainNode {
    return this.outputNode;
  }

  /**
   * Set suppression amount smoothly (0 = normal original vocal, 1 = vocal suppressed / karaoke)
   */
  public setSuppression(amount: number, rampDurationMs = 80): void {
    if (this.isDisposed) return;
    const clamped = Math.max(0, Math.min(1, amount));
    this.suppressionAmount = clamped;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const rampTime = rampDurationMs / 1000;

    // Linear crossfade prevents clicks and audio gaps
    this.dryGain.gain.cancelScheduledValues(now);
    this.wetGain.gain.cancelScheduledValues(now);

    if (rampTime <= 0.005) {
      this.dryGain.gain.setValueAtTime(1.0 - clamped, now);
      this.wetGain.gain.setValueAtTime(clamped, now);
    } else {
      this.dryGain.gain.setValueAtTime(this.dryGain.gain.value, now);
      this.dryGain.gain.linearRampToValueAtTime(1.0 - clamped, now + rampTime);

      this.wetGain.gain.setValueAtTime(this.wetGain.gain.value, now);
      this.wetGain.gain.linearRampToValueAtTime(clamped, now + rampTime);
    }
  }

  public getSuppression(): number {
    return this.suppressionAmount;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    try {
      this.inputNode.disconnect();
      this.dryGain.disconnect();
      this.wetGain.disconnect();
      this.outputNode.disconnect();
    } catch {
      // ignore
    }
  }
}
