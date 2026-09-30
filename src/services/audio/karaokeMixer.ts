// Unified Karaoke Audio Mixer for NARO
// Manages BGM, live user microphone, vocal suppression, and master output
// Conforms to NARO Master Core Architecture Sections 8, 9, 10, 11

import { WebAudioVocalSuppressor } from './vocalSeparation/WebAudioVocalSuppressor';

class KaraokeMixer {
  private ctx: AudioContext | null = null;
  private vocalSuppressor: WebAudioVocalSuppressor | null = null;

  // Audio nodes
  private bgmGainNode: GainNode | null = null;
  private voiceGainNode: GainNode | null = null;
  private micGainNode: GainNode | null = null;
  private micMonitorGainNode: GainNode | null = null;
  private masterOutputGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private micAnalyser: AnalyserNode | null = null;

  // Media sources
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private connectedAudioElement: HTMLAudioElement | null = null;
  private micStream: MediaStream | null = null;

  // State
  private isKaraokeActive = false;
  private bgmVolume = 1.0;
  private voiceVolume = 0.85;
  private micEnabled = true;
  private micMonitoring = false; // default off to prevent feedback on open speakers

  public async resumeContext(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch {
      // ignore
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupGraph();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupGraph() {
    if (!this.ctx) return;

    // Master Output & Analyser
    this.masterOutputGain = this.ctx.createGain();
    this.masterOutputGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 64;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    this.masterOutputGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // BGM Path
    this.vocalSuppressor = new WebAudioVocalSuppressor(this.ctx);
    this.bgmGainNode = this.ctx.createGain();
    this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);

    this.vocalSuppressor.getOutput().connect(this.bgmGainNode);
    this.bgmGainNode.connect(this.masterOutputGain);

    // Microphone Path
    this.micGainNode = this.ctx.createGain();
    this.micGainNode.gain.setValueAtTime(this.micEnabled ? 1.0 : 0.0, this.ctx.currentTime);

    this.voiceGainNode = this.ctx.createGain();
    this.voiceGainNode.gain.setValueAtTime(this.voiceVolume, this.ctx.currentTime);

    this.micMonitorGainNode = this.ctx.createGain();
    this.micMonitorGainNode.gain.setValueAtTime(this.micMonitoring ? 0.7 : 0.0, this.ctx.currentTime);

    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 64;
    this.micAnalyser.smoothingTimeConstant = 0.8;

    // Route: Mic -> micGain -> voiceGain -> micAnalyser
    //                                    -> micMonitorGain -> masterOutputGain (if monitoring on)
    this.micGainNode.connect(this.voiceGainNode);
    this.voiceGainNode.connect(this.micAnalyser);
    this.voiceGainNode.connect(this.micMonitorGainNode);
    this.micMonitorGainNode.connect(this.masterOutputGain);
  }

  /**
   * Connect HTML5 Audio Element to the vocal suppression and mixer graph
   */
  public connectAudioElement(audio: HTMLAudioElement): boolean {
    try {
      const ctx = this.getContext();
      if (this.connectedAudioElement === audio && this.audioSourceNode) {
        return true;
      }

      this.connectedAudioElement = audio;
      // Ensure crossOrigin is set for Web Audio integration
      if (!audio.crossOrigin) {
        audio.crossOrigin = 'anonymous';
      }

      if (!this.audioSourceNode) {
        this.audioSourceNode = ctx.createMediaElementSource(audio);
        if (this.vocalSuppressor) {
          this.audioSourceNode.connect(this.vocalSuppressor.getInput());
        }
      }
      return true;
    } catch (err) {
      console.warn('Could not connect audio element to Web Audio graph (CORS restriction fallback):', err);
      return false;
    }
  }

  /**
   * Connect User Microphone Stream
   */
  public connectMicStream(stream: MediaStream) {
    const ctx = this.getContext();
    this.micStream = stream;

    try {
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
      }
      this.micSourceNode = ctx.createMediaStreamSource(stream);
      if (this.micGainNode) {
        this.micSourceNode.connect(this.micGainNode);
      }
    } catch (err) {
      console.warn('Error connecting mic stream to mixer:', err);
    }
  }

  /**
   * Toggle or set Karaoke mode on the currently playing track
   * Seamlessly suppresses/removes the original singer's vocal over 80ms crossfade
   */
  public setKaraokeMode(enabled: boolean): void {
    this.isKaraokeActive = enabled;
    if (this.vocalSuppressor) {
      this.vocalSuppressor.setSuppression(enabled ? 1.0 : 0.0, 80);
    }
  }

  public get isKaraoke(): boolean {
    return this.isKaraokeActive;
  }

  public setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGainNode && this.ctx) {
      this.bgmGainNode.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.04);
    }
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setVoiceVolume(vol: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, vol));
    if (this.voiceGainNode && this.ctx) {
      this.voiceGainNode.gain.setTargetAtTime(this.voiceVolume, this.ctx.currentTime, 0.04);
    }
  }

  public getVoiceVolume(): number {
    return this.voiceVolume;
  }

  public setMicEnabled(enabled: boolean): void {
    this.micEnabled = enabled;
    if (this.micGainNode && this.ctx) {
      this.micGainNode.gain.setValueAtTime(enabled ? 1.0 : 0.0, this.ctx.currentTime);
    }
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public isMicOn(): boolean {
    return this.micEnabled;
  }

  public setMicMonitoring(enabled: boolean): void {
    this.micMonitoring = enabled;
    if (this.micMonitorGainNode && this.ctx) {
      this.micMonitorGainNode.gain.setTargetAtTime(enabled ? 0.7 : 0.0, this.ctx.currentTime, 0.04);
    }
  }

  public isMonitoringOn(): boolean {
    return this.micMonitoring;
  }

  public getMicLevel(): number {
    if (!this.micAnalyser) return 0;
    const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1, avg / 128);
  }

  public getVisualizerData(): Uint8Array | null {
    if (!this.masterAnalyser) return null;
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(data);
    return data;
  }
}

export const karaokeMixer = new KaraokeMixer();
