// Track Identity Resolution and Normalization Rules
// Enforces conservative matching: never conflates remixes, remasters, or distinct versions,
// and strictly forbids deduplicating solely by artwork URL or borrowing metadata.

import type { NormalizedChartTrack } from './types';

/**
 * Normalizes a text string for conservative comparison (lowercase, trimmed, collapsed whitespace)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[''""`]/g, '');
}

/**
 * Computes a unique, deterministic identity key for a chart track.
 * Priority order:
 * 1. Stable provider ID (`${provider}:${provider_track_id}`)
 * 2. Standard ISRC (`isrc:${isrc}`)
 * 3. Conservative tuple: normalized title + primary artist + version/mix + (optional duration bucket)
 */
export function computeTrackIdentity(
  track: Pick<NormalizedChartTrack, 'provider' | 'provider_track_id'> &
    Partial<Pick<NormalizedChartTrack, 'isrc_if_available' | 'title' | 'primary_artist' | 'version_or_mix' | 'duration_if_available'>>
): string {
  if (track.provider && track.provider_track_id && track.provider_track_id.trim() !== '') {
    return `${track.provider}:${track.provider_track_id.trim()}`;
  }

  if (track.isrc_if_available && track.isrc_if_available.trim() !== '') {
    return `isrc:${track.isrc_if_available.trim().toUpperCase()}`;
  }

  const normTitle = normalizeText(track.title || '');
  const normArtist = normalizeText(track.primary_artist || '');
  const normVersion = normalizeText(track.version_or_mix || '');
  const durationBucket = track.duration_if_available
    ? Math.round(track.duration_if_available / 5) * 5
    : 'any';

  return `fallback:${normTitle}::${normArtist}::${normVersion}::${durationBucket}`;
}

/**
 * Checks whether two chart track records represent the same recording.
 * Strictly adheres to identity rules:
 * - Matching artwork URL alone is NEVER considered sufficient proof of identity.
 * - Distinct versions, remixes, or acoustic versions remain distinct.
 */
export function areTracksIdentical(
  a: NormalizedChartTrack,
  b: NormalizedChartTrack
): boolean {
  // If provider and provider_track_id match exactly
  if (a.provider === b.provider && a.provider_track_id && b.provider_track_id) {
    return a.provider_track_id === b.provider_track_id;
  }

  // If both have ISRCs and they match
  if (a.isrc_if_available && b.isrc_if_available) {
    return a.isrc_if_available.trim().toUpperCase() === b.isrc_if_available.trim().toUpperCase();
  }

  // Fallback to title, artist, and version match
  const titleA = normalizeText(a.title);
  const titleB = normalizeText(b.title);
  const artistA = normalizeText(a.primary_artist);
  const artistB = normalizeText(b.primary_artist);
  const verA = normalizeText(a.version_or_mix || '');
  const verB = normalizeText(b.version_or_mix || '');

  if (titleA !== titleB || artistA !== artistB || verA !== verB) {
    return false;
  }

  // If both durations are known, ensure they are within 4 seconds of each other
  if (a.duration_if_available && b.duration_if_available) {
    return Math.abs(a.duration_if_available - b.duration_if_available) <= 4;
  }

  return true;
}
