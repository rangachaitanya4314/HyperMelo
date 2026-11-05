import type { Song, TimedLyricLine } from './music';
import type { VerifiedLyricRepresentation } from '../shared/lyrics';

export type MomentTemplateId = 'cinematic' | 'minimal' | 'visualizer' | 'mood' | 'karaoke';

export interface MomentTemplateConfig {
  id: MomentTemplateId;
  name: string;
  tagline: string;
  badge: string;
  aspectRatio: '9:16';
  description: string;
}

export type AudioRightsClassification = 'PERMITTED_FULL' | 'RESTRICTED_PREVIEW' | 'NO_AUDIO_SOURCE';

export interface AudioRightsStatus {
  canExportAudio: boolean;
  classification: AudioRightsClassification;
  licenseLabel: string | null;
  reason: string;
  notice: string;
}

export interface ExportMomentOptions {
  song: Song;
  template: MomentTemplateId;
  representation: VerifiedLyricRepresentation;
  lines: TimedLyricLine[];
  startSec: number;
  durationSec: number;
  onProgress?: (progress: number) => void;
  audioElement?: HTMLAudioElement | null;
}

export interface ExportMomentResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  isSilent: boolean;
  durationSec: number;
  dimensions: { width: number; height: number };
}

export interface CustomTimelineSelection {
  startSec: number;
  endSec: number;
  durationSec: number;
  selectedLineIndices: number[];
}

