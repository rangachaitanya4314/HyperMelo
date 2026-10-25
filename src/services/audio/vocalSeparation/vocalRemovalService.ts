// Dedicated Vocal Removal Method Resolution Service for NARO
// Conforms to NARO Vocal Removal Architecture:
// 1. Prioritize verified instrumental or vocal-separated backing track (vocals absent)
// 2. Use source-separation stems/engine if configured
// 3. Fallback to real-time Web Audio center-channel vocal reduction (approximate)
// 4. Truthfully report when vocal removal is unavailable (DRM / external iframe)

import type { Song } from '../../../shared';

export type VocalRemovalType =
  | 'verified_instrumental'
  | 'source_separation'
  | 'center_channel_reduction'
  | 'unavailable_protected';

export interface VocalRemovalResolution {
  type: VocalRemovalType;
  methodName: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  isVocalAbsent: boolean;              // true when lead vocal is absent (verified instrumental)
  isApproximate: boolean;              // true for center-channel cancellation fallback
  isVocalRemovalUnavailable: boolean;  // true for protected providers (Apple MusicKit DRM / YouTube iframe)
  backingStreamUrl?: string;           // Direct stream URL for the instrumental track
  explanation: string;
}

export class VocalRemovalService {
  /**
   * Determine the best genuinely available vocal-removal method for the given song.
   */
  public resolveMethod(song: Song | null): VocalRemovalResolution {
    if (!song) {
      return {
        type: 'unavailable_protected',
        methodName: 'Vocal Removal Unavailable',
        badgeLabel: 'UNAVAILABLE',
        badgeColor: 'var(--text-dim)',
        description: 'No audio track selected.',
        isVocalAbsent: false,
        isApproximate: false,
        isVocalRemovalUnavailable: true,
        explanation: 'No song available for karaoke playback.'
      };
    }

    // PRIORITY 1: Verified Matching Instrumental or Vocal-Separated Backing Track
    // Strict check: Must be a genuinely distinct instrumental asset, never the identical vocal-bearing recording!
    const isDistinctInstrumentalUrl = Boolean(
      song.karaokeSource?.streamUrl &&
      song.karaokeSource.streamUrl !== song.playbackSource?.streamUrl
    );

    const isVerifiedInstrumentalType = Boolean(
      song.karaokeSource?.type === 'dedicated-instrumental' ||
      song.karaokeSource?.type === 'instrumental' ||
      song.karaokeSource?.type === 'licensed_stems' ||
      (song.karaokeSource?.streamUrl && (
        song.karaokeSource.streamUrl.includes('novox') ||
        song.karaokeSource.streamUrl.includes('instrumental') ||
        song.karaokeSource.streamUrl.includes('backing')
      ))
    );

    const hasDedicatedInstrumental = Boolean(
      (song.karaokeAvailable || song.karaokeSource?.availability === 'available') &&
      song.karaokeSource?.streamUrl &&
      isDistinctInstrumentalUrl &&
      isVerifiedInstrumentalType
    );

    if (hasDedicatedInstrumental && song.karaokeSource?.streamUrl) {
      return {
        type: 'verified_instrumental',
        methodName: 'Verified Instrumental Backing Track',
        badgeLabel: 'VERIFIED INSTRUMENTAL',
        badgeColor: '#4ADE80',
        description: 'Original lead vocal is absent from backing playback.',
        isVocalAbsent: true,
        isApproximate: false,
        isVocalRemovalUnavailable: false,
        backingStreamUrl: song.karaokeSource.streamUrl,
        explanation: 'Prioritizing matching verified instrumental asset. Original vocal recording is automatically replaced with the backing track.'
      };
    }

    // PRIORITY 2: Configured Source Separation Model / Stems
    if (song.audioSignature && song.karaokeSource?.type === 'licensed_stems') {
      return {
        type: 'source_separation',
        methodName: 'Source-Separated Instrumental Stems',
        badgeLabel: 'SEPARATED STEMS',
        badgeColor: '#4ADE80',
        description: 'Accompaniment via isolated instrumental stems.',
        isVocalAbsent: true,
        isApproximate: false,
        isVocalRemovalUnavailable: false,
        explanation: 'Separated instrumental stems active.'
      };
    }

    // Check provider capabilities for Web Audio routing & karaoke DSP
    // If provider does not support Web Audio routing (e.g. DRM-protected Apple MusicKit or YouTube iframe),
    // vocal removal is unavailable and Sing-Along is offered.
    const isYouTube = song.playbackSource?.provider === 'youtube' || song.playbackProvider === 'youtube';
    const isProtectedAppleMusic =
      (song.playbackSource?.provider === 'apple-music' || song.playbackProvider === 'apple-music') &&
      !song.isStreamPreview &&
      song.playbackType === 'full' &&
      !song.playbackSource?.streamUrl?.includes('itunes.apple.com') &&
      !song.playbackSource?.streamUrl?.includes('audio-ssl.itunes.apple.com') &&
      !song.playbackSource?.streamUrl?.includes('mzstatic.com');

    const isProtectedProvider = isYouTube || isProtectedAppleMusic;

    if (isProtectedProvider) {
      return {
        type: 'unavailable_protected',
        methodName: 'Vocal Removal Unavailable',
        badgeLabel: 'SING-ALONG (PROTECTED STREAM)',
        badgeColor: 'var(--accent-cream)',
        description: 'Vocal removal is not supported on this protected stream (DRM / external iframe). Sing along with original vocal playback and live microphone.',
        isVocalAbsent: false,
        isApproximate: false,
        isVocalRemovalUnavailable: true,
        explanation: 'Protected provider restrictions prevent Web Audio routing and phase cancellation. Original vocal playback is offered.'
      };
    }

    // PRIORITY 3: Ordinary Stereo Audio with Web Audio Routing -> Center-Channel Vocal Reduction Fallback
    const hasStreamUrl = Boolean(song.playbackSource?.streamUrl);
    if (hasStreamUrl) {
      return {
        type: 'center_channel_reduction',
        methodName: 'Approximate Center-Channel Vocal Reduction',
        badgeLabel: 'APPROXIMATE VOCAL REDUCTION',
        badgeColor: '#F59E0B',
        description: 'Real-time center-channel phase inversion fallback. Approximate: centered instruments may be attenuated and reverberant vocal remnants may remain.',
        isVocalAbsent: false,
        isApproximate: true,
        isVocalRemovalUnavailable: false,
        explanation: 'No dedicated instrumental exists for this track. Real-time center-channel phase inversion is applied as an approximate fallback.'
      };
    }

    // PRIORITY 4: Unavailable
    return {
      type: 'unavailable_protected',
      methodName: 'Vocal Removal Unavailable',
      badgeLabel: 'KARAOKE UNAVAILABLE',
      badgeColor: '#EF4444',
      description: 'Karaoke backing is unavailable for this track (no authorized instrumental source).',
      isVocalAbsent: false,
      isApproximate: false,
      isVocalRemovalUnavailable: true,
      explanation: 'No playable stream or instrumental source available.'
    };
  }
}

export const vocalRemovalService = new VocalRemovalService();
