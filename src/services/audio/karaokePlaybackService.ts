// Dedicated Karaoke Backing Playback Service for NARO
// Conforms to NARO Master Core Architecture:
// Karaoke is an ON-DEMAND MODE of the active track with real-time vocal suppression DSP,
// or uses dedicated instrumental backing if provided.

import type { Song, KaraokeSource } from '../../shared';
import { audioEngine } from '../audioEngine';
import { playbackService } from './playbackService';
import { playbackController } from './PlaybackController';
import { capabilityService } from '../capability/capabilityService';
import { vocalRemovalService } from './vocalSeparation/vocalRemovalService';

export interface KaraokeClockEvent {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  sourceType: string | null;
  error?: string;
}

export type KaraokeClockListener = (event: KaraokeClockEvent) => void;

class KaraokePlaybackService {
  private currentSong: Song | null = null;
  private currentSource: KaraokeSource | null = null;
  private audio: HTMLAudioElement | null = null;
  private isSynthesizer = false;
  private isVocalSuppressionMode = false;
  private isSingAlongMode = false;
  private isPlaying = false;
  private isReady = false;
  private currentTime = 0;
  private duration = 0;
  private timer: number | null = null;
  private startTime = 0;
  private initialPlayOffset = 0;
  private listeners: Set<KaraokeClockListener> = new Set();
  private playbackClockUnsub: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio && !this.isVocalSuppressionMode && !this.playbackClockUnsub) {
          this.currentTime = this.audio.currentTime;
          this.emitClock();
        }
      });

      this.audio.addEventListener('ended', () => {
        if (!this.isVocalSuppressionMode && !this.playbackClockUnsub) {
          this.isPlaying = false;
          this.stopTimer();
          this.emitClock();
        }
      });

      this.audio.addEventListener('error', () => {
        if (!this.isVocalSuppressionMode && !this.playbackClockUnsub) {
          this.isPlaying = false;
          this.isReady = false;
          this.stopTimer();
          this.emitClock('Instrumental backing audio failed to load.');
        }
      });
    }
  }

  public subscribe(listener: KaraokeClockListener): () => void {
    this.listeners.add(listener);
    listener(this.getClock());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitClock(error?: string) {
    const clock = this.getClock(error);
    this.listeners.forEach((l) => {
      try {
        l(clock);
      } catch (err) {
        console.error('Error in karaoke clock listener:', err);
      }
    });
  }

  public getClock(error?: string): KaraokeClockEvent {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      isPlaying: this.isPlaying,
      isReady: this.isReady,
      sourceType: this.isSingAlongMode
        ? 'sing_along'
        : (this.isVocalSuppressionMode ? 'vocal_suppression_dsp' : this.currentSource?.type || null),
      error
    };
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  /**
   * Check if song is eligible for Karaoke.
   */
  public isAvailableForSong(song: Song): boolean {
    if (!song) return false;
    const cap = capabilityService.getKaraokeCapability(song);
    return cap !== 'UNAVAILABLE';
  }

  /**
   * Load backing source or activate vocal suppression DSP mode
   */
  public async loadBackingSource(song: Song, startTime = 0): Promise<void> {
    this.stop();

    if (!this.isAvailableForSong(song)) {
      this.currentSong = song;
      this.currentSource = null;
      this.isReady = false;
      this.emitClock('Karaoke unavailable for this track.');
      throw new Error('Karaoke unavailable for this track.');
    }

    this.currentSong = song;
    this.currentTime = startTime;

    const resolution = vocalRemovalService.resolveMethod(song);

    // If song is not the current track in playbackController, load it at startTime
    if (playbackController.getCurrentTrack()?.id !== song.id) {
      await playbackController.load(song, startTime);
    }

    // PRIORITY 1: Verified Instrumental or Vocal-Separated Backing Track
    if (resolution.type === 'verified_instrumental' && resolution.backingStreamUrl) {
      this.currentSource = song.karaokeSource || {
        type: 'dedicated-instrumental',
        provider: song.playbackSource?.provider || 'naro',
        streamUrl: resolution.backingStreamUrl,
        availability: 'available'
      };
      this.duration = song.karaokeSource?.duration || song.duration || 180;
      this.isVocalSuppressionMode = false;
      this.isSingAlongMode = false;
      this.isSynthesizer = false;

      // Automatically activate instrumental backing track on the authoritative controller
      playbackController.setKaraokeMode(true, startTime);
      playbackService.seek(startTime);

      this.isReady = true;

      // Subscribe to authoritative playback clock
      if (this.playbackClockUnsub) {
        this.playbackClockUnsub();
      }
      this.playbackClockUnsub = playbackService.subscribeClock((pClock) => {
        this.currentTime = pClock.currentTime;
        if (pClock.duration > 0) this.duration = pClock.duration;
        this.isPlaying = pClock.isPlaying;
        this.emitClock(pClock.error);
      });

      this.emitClock();
      return;
    }

    // PRIORITY 2: Source Separation Stems (e.g. procedural synthesizer)
    if (resolution.type === 'source_separation' && song.audioSignature) {
      this.isSynthesizer = true;
      this.isReady = true;
      this.duration = song.duration || 180;
      this.emitClock();
      return;
    }

    // PRIORITY 3: Ordinary Stereo Stream -> Center-Channel Vocal Reduction Fallback
    if (resolution.type === 'center_channel_reduction') {
      this.isSingAlongMode = false;
      this.isVocalSuppressionMode = true;
      this.isSynthesizer = false;
      this.currentSource = {
        type: 'instrumental',
        provider: song.playbackSource?.provider || 'naro',
        availability: 'available'
      };
      this.duration = song.duration || 180;
      this.isReady = true;

      playbackController.setKaraokeMode(true, startTime);
      playbackService.seek(startTime);

      if (this.playbackClockUnsub) {
        this.playbackClockUnsub();
      }
      this.playbackClockUnsub = playbackService.subscribeClock((pClock) => {
        if (this.isVocalSuppressionMode) {
          this.currentTime = pClock.currentTime;
          if (pClock.duration > 0) this.duration = pClock.duration;
          this.isPlaying = pClock.isPlaying;
          this.emitClock(pClock.error);
        }
      });

      this.emitClock();
      return;
    }

    // PRIORITY 4: Protected Provider -> SING-ALONG (Original playback, live mic & synced lyrics)
    const karaokeCap = capabilityService.getKaraokeCapability(song);
    if (karaokeCap === 'SING_ALONG') {
      this.isSingAlongMode = true;
      this.isVocalSuppressionMode = false;
      this.isSynthesizer = false;
      this.currentSource = {
        type: 'provider_karaoke',
        provider: song.playbackSource?.provider || 'apple-music',
        providerTrackId: song.playbackSource?.providerTrackId || song.id,
        availability: 'available'
      };
      this.duration = song.duration || 180;
      this.isReady = true;

      playbackController.setKaraokeMode(false, startTime);
      playbackService.seek(startTime);

      if (this.playbackClockUnsub) {
        this.playbackClockUnsub();
      }
      this.playbackClockUnsub = playbackService.subscribeClock((pClock) => {
        if (this.isSingAlongMode) {
          this.currentTime = pClock.currentTime;
          if (pClock.duration > 0) this.duration = pClock.duration;
          this.isPlaying = pClock.isPlaying;
          this.emitClock(pClock.error);
        }
      });

      this.emitClock();
      return;
    }

    this.isReady = false;
    this.emitClock('Karaoke unavailable for this track.');
    throw new Error('Karaoke unavailable for this track.');
  }

  public async playFrom(startTime: number): Promise<void> {
    if (!this.isReady || !this.currentSong) {
      throw new Error('Backing source not verified or ready.');
    }

    this.currentTime = startTime;
    this.initialPlayOffset = startTime;
    this.startTime = Date.now();
    this.isPlaying = true;

    const resolution = vocalRemovalService.resolveMethod(this.currentSong);

    if (resolution.type === 'verified_instrumental') {
      // Prioritize verified instrumental backing track
      playbackController.setKaraokeMode(true, startTime);
      playbackService.seek(startTime);
      await playbackService.play();
      this.emitClock();
      return;
    }

    if (this.isVocalSuppressionMode) {
      // Engage zero-latency center-channel vocal reduction DSP on the playing track
      playbackController.setKaraokeMode(true, startTime);
      playbackService.seek(startTime);
      await playbackService.play();
      this.emitClock();
      return;
    }

    if (this.isSingAlongMode) {
      // Protected provider: vocal suppression disabled to respect DRM, microphone live
      playbackController.setKaraokeMode(false, startTime);
      playbackService.seek(startTime);
      await playbackService.play();
      this.emitClock();
      return;
    }

    if (this.isSynthesizer && this.currentSong.audioSignature) {
      audioEngine.startSong(
        this.currentSong.audioSignature.tempo,
        this.currentSong.audioSignature.baseFreq
      );
      this.startSynthesizerClock();
    } else if (this.audio) {
      try {
        this.audio.currentTime = startTime;
        await this.audio.play();
        this.startAudioClock();
      } catch (err) {
        this.isPlaying = false;
        this.emitClock('Failed to start backing audio playback.');
        throw err;
      }
    }

    this.emitClock();
  }

  private startSynthesizerClock() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      if (this.isPlaying) {
        this.currentTime = this.initialPlayOffset + (Date.now() - this.startTime) / 1000;
        this.emitClock();
      }
    }, 50);
  }

  private startAudioClock() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      if (this.isPlaying && this.audio) {
        this.currentTime = this.audio.currentTime;
        this.emitClock();
      }
    }, 50);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public seek(time: number): void {
    this.currentTime = Math.max(0, time);
    if (this.playbackClockUnsub || this.isVocalSuppressionMode || this.isSingAlongMode) {
      playbackService.seek(time);
    } else if (this.audio) {
      this.audio.currentTime = time;
      this.emitClock();
    } else if (this.isSynthesizer) {
      this.initialPlayOffset = time;
      this.startTime = Date.now();
      this.emitClock();
    }
  }

  public pause(): void {
    this.isPlaying = false;
    this.stopTimer();

    if (this.playbackClockUnsub || this.isVocalSuppressionMode || this.isSingAlongMode) {
      playbackService.pause();
    } else if (this.isSynthesizer) {
      audioEngine.pause();
    } else if (this.audio) {
      this.audio.pause();
    }

    this.emitClock();
  }

  public stop(): void {
    const exitTime = this.currentTime;
    this.pause();
    this.isReady = false;
    this.currentTime = 0;
    this.currentSong = null;
    this.currentSource = null;

    if (this.playbackClockUnsub) {
      this.playbackClockUnsub();
      this.playbackClockUnsub = null;
    }

    this.isVocalSuppressionMode = false;
    this.isSingAlongMode = false;

    if (this.isSynthesizer) {
      audioEngine.stop();
    } else if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    // Restore normal playback behavior on the authoritative controller at current position
    playbackController.setKaraokeMode(false, exitTime);

    this.emitClock();
  }
}

export const karaokePlaybackService = new KaraokePlaybackService();
