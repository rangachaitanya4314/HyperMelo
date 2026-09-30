// Web Audio API Procedural Synthesizer for NARO
// Provides rich ambient chords, bass, and rhythm without external MP3 dependencies.

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying = false;
  private tempo = 80;
  private baseFreq = 146.83; // D3
  private timerId: number | null = null;
  private step = 0;
  private volume = 0.8;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public startSong(tempo: number, baseFreq: number) {
    this.initContext();
    this.tempo = tempo;
    this.baseFreq = baseFreq;
    this.isPlaying = true;
    this.step = 0;

    if (this.timerId) {
      clearInterval(this.timerId);
    }

    const intervalMs = (60 / this.tempo / 2) * 1000;
    this.timerId = window.setInterval(() => {
      if (this.isPlaying) {
        this.playStep(this.step);
        this.step = (this.step + 1) % 16;
      }
    }, intervalMs);

    // Initial chord burst
    this.playChord(this.baseFreq, 3.5);
  }

  public pause() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public resume(tempo: number, baseFreq: number) {
    this.startSong(tempo, baseFreq);
  }

  public stop() {
    this.pause();
    this.step = 0;
  }

  private playStep(step: number) {
    if (!this.ctx || !this.masterGain) return;

    // Chord triggers every 4 steps
    if (step % 4 === 0) {
      const chordIndex = Math.floor(step / 4);
      const chordMultipliers = [1, 1.2, 0.9, 1.12]; // musical variation
      const freq = this.baseFreq * (chordMultipliers[chordIndex] || 1);
      this.playChord(freq, 2.8);
    }

    // Gentle kick/pulse on steps 0, 8
    if (step === 0 || step === 8) {
      this.playSoftKick();
    }

    // Hi-hat shimmer on steps 2, 6, 10, 14
    if (step % 4 === 2) {
      this.playSoftHiHat();
    }
  }

  private playChord(rootFreq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;

    const notes = [rootFreq, rootFreq * 1.25, rootFreq * 1.5, rootFreq * 2]; // Major/Minor triad spread
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.exponentialRampToValueAtTime(350, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08 / (idx + 1), now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  private playSoftKick() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playSoftHiHat() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, now);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4500, now);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public getVisualizerData(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}

export const audioEngine = new AudioEngine();
