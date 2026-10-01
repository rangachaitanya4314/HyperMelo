// Take Playback Service for NARO
// Authoritative single manager for recorded take audio playback
// Coordinates with PlaybackController to prevent simultaneous audio clashes
// Owns single-take previews (LibraryPage, KaraokePage) and dual-track review (PerformanceReviewModal)

import type { RecordedTake } from '../../shared';
import { playbackController } from './PlaybackController';

export interface TakePreviewEvent {
  playingTakeId: string | null;
  isPlaying: boolean;
  currentTime: number;
}

export interface TakeReviewEvent {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  voiceVolume: number;
  musicVolume: number;
}

export class TakePlaybackService {
  // --- Single Take Preview State ---
  private previewAudio: HTMLAudioElement | null = null;
  private playingTakeId: string | null = null;
  private previewListeners: Set<(event: TakePreviewEvent) => void> = new Set();

  // --- Dual-Track Performance Review State ---
  private reviewVoiceAudio: HTMLAudioElement | null = null;
  private reviewBackingAudio: HTMLAudioElement | null = null;
  private isReviewPlaying = false;
  private reviewCurrentTime = 0;
  private reviewDuration = 0;
  private voiceVolume = 1.0;
  private musicVolume = 0.8;
  private reviewInitialOffset = 0;
  private reviewListeners: Set<(event: TakeReviewEvent) => void> = new Set();

  // =========================================================================
  // SINGLE TAKE PREVIEW (LibraryPage, KaraokePage)
  // =========================================================================

  public subscribePreview(listener: (event: TakePreviewEvent) => void): () => void {
    this.previewListeners.add(listener);
    listener(this.getPreviewState());
    return () => {
      this.previewListeners.delete(listener);
    };
  }

  public getPreviewState(): TakePreviewEvent {
    return {
      playingTakeId: this.playingTakeId,
      isPlaying: Boolean(this.previewAudio && !this.previewAudio.paused),
      currentTime: this.previewAudio ? this.previewAudio.currentTime : 0
    };
  }

  private emitPreviewState(): void {
    const state = this.getPreviewState();
    this.previewListeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('Error in TakePlaybackService preview listener:', err);
      }
    });
  }

  public async playTake(take: RecordedTake): Promise<void> {
    if (!take) return;

    if (!take.audioBlobUrl && take.audioBlob) {
      try {
        take.audioBlobUrl = URL.createObjectURL(take.audioBlob);
      } catch (err) {
        console.warn('[TakePlaybackService] Failed to create object URL for audioBlob:', err);
      }
    }

    if (!take.audioBlobUrl) {
      console.warn('[TakePlaybackService] playTake aborted: take has no audioBlobUrl or audioBlob', take);
      return;
    }

    // 1. Pause normal music playback to prevent audio clashing
    playbackController.pause();

    // 2. Stop any active review session
    this.stopReviewSession();

    // 3. Stop previous preview audio if different
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }

    if (typeof Audio === 'undefined') {
      this.playingTakeId = take.id;
      this.emitPreviewState();
      return;
    }

    const audio = new Audio(take.audioBlobUrl);
    this.previewAudio = audio;
    this.playingTakeId = take.id;

    audio.addEventListener('timeupdate', () => {
      this.emitPreviewState();
    });

    audio.addEventListener('ended', () => {
      this.playingTakeId = null;
      this.previewAudio = null;
      this.emitPreviewState();
    });

    audio.addEventListener('error', (e) => {
      console.warn('Take preview audio error:', e);
      this.playingTakeId = null;
      this.previewAudio = null;
      this.emitPreviewState();
    });

    try {
      await audio.play();
      this.emitPreviewState();
    } catch (err) {
      console.warn('Take playback failed or was interrupted:', err);
      this.playingTakeId = null;
      this.previewAudio = null;
      this.emitPreviewState();
    }
  }

  public pauseTake(): void {
    if (this.previewAudio) {
      this.previewAudio.pause();
    }
    this.playingTakeId = null;
    this.emitPreviewState();
  }

  public toggleTake(take: RecordedTake): Promise<void> {
    if (this.playingTakeId === take.id) {
      this.pauseTake();
      return Promise.resolve();
    }
    return this.playTake(take);
  }

  public stopTake(): void {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
    this.playingTakeId = null;
    this.emitPreviewState();
  }

  public getPlayingTakeId(): string | null {
    return this.playingTakeId;
  }

  // =========================================================================
  // DUAL-TRACK REVIEW SESSION (PerformanceReviewModal)
  // =========================================================================

  public subscribeReview(listener: (event: TakeReviewEvent) => void): () => void {
    this.reviewListeners.add(listener);
    listener(this.getReviewState());
    return () => {
      this.reviewListeners.delete(listener);
    };
  }

  public getReviewState(): TakeReviewEvent {
    return {
      isPlaying: this.isReviewPlaying,
      currentTime: this.reviewCurrentTime,
      duration: this.reviewDuration,
      voiceVolume: this.voiceVolume,
      musicVolume: this.musicVolume
    };
  }

  private emitReviewState(): void {
    const state = this.getReviewState();
    this.reviewListeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('Error in TakePlaybackService review listener:', err);
      }
    });
  }

  public initReviewSession(
    take: RecordedTake,
    backingStreamUrl?: string,
    initialOffset = 0
  ): void {
    // 1. Halt any active single take preview
    this.stopTake();

    // 2. Halt any existing review session
    this.stopReviewSession();

    if (!take || !take.audioBlobUrl) return;

    this.reviewDuration = take.duration || 0;
    this.reviewInitialOffset = initialOffset;
    this.reviewCurrentTime = 0;
    this.isReviewPlaying = false;

    if (typeof Audio === 'undefined') {
      this.emitReviewState();
      return;
    }

    // Create voice audio element
    const voice = new Audio(take.audioBlobUrl);
    voice.volume = this.voiceVolume;
    this.reviewVoiceAudio = voice;

    // Optional backing track
    if (backingStreamUrl) {
      const backing = new Audio(backingStreamUrl);
      backing.volume = this.musicVolume;
      try {
        backing.currentTime = initialOffset;
      } catch {
        // safe fallback before metadata loads
      }
      this.reviewBackingAudio = backing;
    }

    voice.addEventListener('timeupdate', () => {
      this.reviewCurrentTime = voice.currentTime;
      this.emitReviewState();
    });

    voice.addEventListener('ended', () => {
      this.isReviewPlaying = false;
      this.reviewCurrentTime = 0;
      if (this.reviewBackingAudio) {
        this.reviewBackingAudio.pause();
        try {
          this.reviewBackingAudio.currentTime = this.reviewInitialOffset;
        } catch {
          // ignore
        }
      }
      this.emitReviewState();
    });

    voice.addEventListener('error', (err) => {
      console.warn('Voice review audio error:', err);
      this.isReviewPlaying = false;
      this.emitReviewState();
    });

    this.emitReviewState();
  }

  public async toggleReviewPlayback(): Promise<void> {
    if (this.isReviewPlaying) {
      this.pauseReview();
      return;
    }

    // Pause normal music player to prevent clashing
    playbackController.pause();

    if (!this.reviewVoiceAudio) return;

    try {
      await this.reviewVoiceAudio.play();
      this.isReviewPlaying = true;

      if (this.reviewBackingAudio) {
        try {
          this.reviewBackingAudio.currentTime = this.reviewVoiceAudio.currentTime + this.reviewInitialOffset;
          await this.reviewBackingAudio.play();
        } catch (backingErr) {
          console.warn('Backing audio play warning in review:', backingErr);
        }
      }

      this.emitReviewState();
    } catch (err) {
      console.warn('Voice review playback error:', err);
      this.isReviewPlaying = false;
      this.emitReviewState();
    }
  }

  public pauseReview(): void {
    if (this.reviewVoiceAudio) {
      this.reviewVoiceAudio.pause();
    }
    if (this.reviewBackingAudio) {
      this.reviewBackingAudio.pause();
    }
    this.isReviewPlaying = false;
    this.emitReviewState();
  }

  public setReviewVoiceVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.voiceVolume = clamped;
    if (this.reviewVoiceAudio) {
      this.reviewVoiceAudio.volume = clamped;
    }
    this.emitReviewState();
  }

  public setReviewMusicVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.musicVolume = clamped;
    if (this.reviewBackingAudio) {
      this.reviewBackingAudio.volume = clamped;
    }
    this.emitReviewState();
  }

  public stopReviewSession(): void {
    if (this.reviewVoiceAudio) {
      this.reviewVoiceAudio.pause();
      this.reviewVoiceAudio = null;
    }
    if (this.reviewBackingAudio) {
      this.reviewBackingAudio.pause();
      this.reviewBackingAudio = null;
    }
    this.isReviewPlaying = false;
    this.reviewCurrentTime = 0;
    this.emitReviewState();
  }

  public teardown(): void {
    this.stopTake();
    this.stopReviewSession();
  }
}

export const takePlaybackService = new TakePlaybackService();
if (typeof window !== 'undefined') {
  (window as unknown as { __naro_take_playback_service?: TakePlaybackService }).__naro_take_playback_service =
    takePlaybackService;
}
