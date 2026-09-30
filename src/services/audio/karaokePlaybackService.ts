// Dedicated Karaoke Backing Playback Service for NARO
// Conforms to NARO Master Core Architecture:
// Karaoke is an ON-DEMAND MODE of the active track with real-time vocal suppression DSP,
// or uses dedicated instrumental backing if provided.

import type { Song, KaraokeSource } from '../../shared';
import { audioEngine } from '../audioEngine';
import { playbackService } from './playbackService';
import { karaokeMixer } from './karaokeMixer';

import { capabilityService } from '../capability/capabilityService';

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
        if (this.audio && !this.isVocalSuppressionMode) {
          this.currentTime = this.audio.currentTime;
          this.emitClock();
        }
      });

      this.audio.addEventListener('ended', () => {
        if (!this.isVocalSuppressionMode) {
          this.isPlaying = false;
          this.stopTimer();
          this.emitClock();
        }
      });

      this.audio.addEventListener('error', () => {
        if (!this.isVocalSuppressionMode) {
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
   * Every song with an authorized audio stream is Karaoke ready via WebAudio DSP!
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

    // Check if dedicated instrumental source exists
    const hasDedicatedSource = song.karaokeAvailable && song.karaokeSource?.availability === 'available';

    if (hasDedicatedSource && song.karaokeSource) {
      const source = song.karaokeSource;
      this.currentSource = source;
      this.duration = source.duration || song.duration || 180;
      this.isVocalSuppressionMode = false;
      this.isSingAlongMode = false;

      if (source.type === 'licensed_stems' && song.audioSignature) {
        this.isSynthesizer = true;
        this.isReady = true;
        this.emitClock();
        return;
      }

      if (source.streamUrl) {
        this.isSynthesizer = false;
        if (!this.audio) {
          this.audio = new Audio();
        }
        this.audio.src = source.streamUrl;
        this.audio.currentTime = startTime;

        return new Promise((resolve, reject) => {
          if (!this.audio) {
            reject(new Error('Audio element not initialized'));
            return;
          }

          const onCanPlay = () => {
            this.audio?.removeEventListener('canplay', onCanPlay);
            this.isReady = true;
            this.emitClock();
            resolve();
          };

          const onError = () => {
            this.audio?.removeEventListener('canplay', onCanPlay);
            this.isReady = false;
            this.emitClock('Instrumental audio stream failed to load.');
            reject(new Error('Instrumental stream load failed'));
          };

          this.audio.addEventListener('canplay', onCanPlay, { once: true });
          this.audio.addEventListener('error', onError, { once: true });
          this.audio.load();
        });
      }
    }

    const karaokeCap = capabilityService.getKaraokeCapability(song);
    if (karaokeCap === 'SING_ALONG') {
      // Protected provider track where vocal suppression cannot be performed -> SING-ALONG
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

    // Default & Master NARO Mode: Real-time Web Audio DSP Vocal Suppression on active track
    this.isSingAlongMode = false;
    this.isVocalSuppressionMode = true;
    this.isSynthesizer = false;
    this.currentSource = {
      type: 'provider_karaoke',
      provider: song.playbackSource?.provider || 'apple-music',
      providerTrackId: song.playbackSource?.providerTrackId || song.id,
      availability: 'available'
    };
    this.duration = song.duration || 180;
    this.isReady = true;

    // Listen to playbackService clock while in vocal suppression mode
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
  }

  public async playFrom(startTime: number): Promise<void> {
    if (!this.isReady || !this.currentSong) {
      throw new Error('Backing source not verified or ready.');
    }

    this.currentTime = startTime;
    this.initialPlayOffset = startTime;
    this.startTime = Date.now();
    this.isPlaying = true;

    if (this.isSingAlongMode) {
      // Vocal suppression is disabled to respect DRM / protected stream; microphone is live and lyrics synced
      karaokeMixer.setKaraokeMode(false);
      playbackService.seek(startTime);
      await playbackService.play();
      this.emitClock();
      return;
    }

    if (this.isVocalSuppressionMode) {
      // Engage zero-latency vocal suppression DSP on the playing track
      karaokeMixer.setKaraokeMode(true);
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
    if (this.isVocalSuppressionMode || this.isSingAlongMode) {
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

    if (this.isVocalSuppressionMode || this.isSingAlongMode) {
      playbackService.pause();
    } else if (this.isSynthesizer) {
      audioEngine.pause();
    } else if (this.audio) {
      this.audio.pause();
    }

    this.emitClock();
  }

  public stop(): void {
    this.pause();
    this.isReady = false;
    this.currentTime = 0;
    this.currentSong = null;
    this.currentSource = null;

    if (this.playbackClockUnsub) {
      this.playbackClockUnsub();
      this.playbackClockUnsub = null;
    }

    if (this.isVocalSuppressionMode) {
      this.isVocalSuppressionMode = false;
      // Note: do not forcefully turn off karaokeMixer if user wants to keep singing
    }
    if (this.isSingAlongMode) {
      this.isSingAlongMode = false;
    } else if (this.isSynthesizer) {
      audioEngine.stop();
    } else if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.emitClock();
  }
}

export const karaokePlaybackService = new KaraokePlaybackService();
