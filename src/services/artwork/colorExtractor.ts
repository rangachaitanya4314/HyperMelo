/**
 * Authoritative Dynamic Artwork Color Extraction Engine for HyperMelo.
 * Extracts dominant, secondary, and accent colors from verified album artwork
 * to drive the BitChord-style fluid ambient mesh backdrop and controls.
 */

import { useState, useEffect } from 'react';
import type { Song } from '../../types/music';
import { getVerifiedSongArtwork } from '../../data/verifiedArtwork';

export interface ArtworkColors {
  primary: string;       // e.g. "rgba(225, 29, 72, 0.32)"
  secondary: string;     // e.g. "rgba(99, 102, 241, 0.20)"
  accent: string;        // vibrant hex for active controls e.g. "#E7A58D"
  ambientGlow: string;   // rgba string for shadows e.g. "rgba(231, 165, 141, 0.30)"
}

export const DEFAULT_COLORS: ArtworkColors = {
  primary: 'rgba(231, 165, 141, 0.28)',
  secondary: 'rgba(99, 102, 241, 0.18)',
  accent: '#E7A58D',
  ambientGlow: 'rgba(231, 165, 141, 0.25)'
};

function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return `rgba(231, 165, 141, ${alpha})`;
  }
  const r = parseInt(clean.substring(0, 2), 16) || 120;
  const g = parseInt(clean.substring(2, 4), 16) || 120;
  const b = parseInt(clean.substring(4, 6), 16) || 140;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// In-memory cache by songId / imageUrl to prevent redundant canvas operations
const colorCache = new Map<string, ArtworkColors>();

/**
 * Synchronous initial color determination from song palette or fallback.
 */
export function getInitialArtworkColors(song: Song | null): ArtworkColors {
  if (!song) return DEFAULT_COLORS;

  const key = song.id || `${song.title}-${song.artist}`;
  if (colorCache.has(key)) {
    return colorCache.get(key)!;
  }

  // 1. If song has curated artwork palette, use it immediately
  if (song.artwork?.palette && song.artwork.palette.length >= 2) {
    const p = song.artwork.palette;
    const initial: ArtworkColors = {
      primary: hexToRgba(p[0], 0.35),
      secondary: hexToRgba(p[1] || p[3] || p[0], 0.22),
      accent: p[2] || p[0] || '#E7A58D',
      ambientGlow: hexToRgba(p[0], 0.30)
    };
    colorCache.set(key, initial);
    return initial;
  }

  // 2. Deterministic vibrant fallback based on song genre / title
  const tag = `${song.genre || ''} ${song.title || ''}`.toLowerCase();
  if (tag.includes('sad') || tag.includes('rain') || tag.includes('melancholy')) {
    return {
      primary: 'rgba(56, 189, 248, 0.26)',
      secondary: 'rgba(30, 41, 59, 0.40)',
      accent: '#38BDF8',
      ambientGlow: 'rgba(56, 189, 248, 0.25)'
    };
  }
  if (tag.includes('love') || tag.includes('romance') || tag.includes('heart')) {
    return {
      primary: 'rgba(244, 63, 94, 0.30)',
      secondary: 'rgba(251, 146, 60, 0.20)',
      accent: '#FB7185',
      ambientGlow: 'rgba(244, 63, 94, 0.28)'
    };
  }
  if (tag.includes('acoustic') || tag.includes('folk') || tag.includes('classical')) {
    return {
      primary: 'rgba(245, 158, 11, 0.28)',
      secondary: 'rgba(180, 83, 9, 0.20)',
      accent: '#F59E0B',
      ambientGlow: 'rgba(245, 158, 11, 0.25)'
    };
  }

  return DEFAULT_COLORS;
}

/**
 * Extracts dominant and secondary colors from an HTMLImageElement using an offscreen canvas.
 */
function extractColorsFromImage(img: HTMLImageElement): ArtworkColors | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, 16, 16);
    const imageData = ctx.getImageData(0, 0, 16, 16);
    const data = imageData.data;

    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    const pixelBuckets: { r: number; g: number; b: number; sat: number }[] = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue;

      // Filter near-black and near-white pixels
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 25 || lum > 235) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;

      pixelBuckets.push({ r, g, b, sat });
      totalR += r;
      totalG += g;
      totalB += b;
      count++;
    }

    if (count === 0 || pixelBuckets.length === 0) {
      return null;
    }

    // Sort by saturation to prioritize rich vibrant tones over muddy grays
    pixelBuckets.sort((a, b) => b.sat - a.sat);

    // Primary: highest saturation pixel
    const primaryPixel = pixelBuckets[0];
    
    // Secondary: pixel with distinct color difference
    let secondaryPixel = pixelBuckets[Math.min(pixelBuckets.length - 1, 5)];
    for (let i = 1; i < pixelBuckets.length; i++) {
      const p = pixelBuckets[i];
      const diff = Math.abs(p.r - primaryPixel.r) + Math.abs(p.g - primaryPixel.g) + Math.abs(p.b - primaryPixel.b);
      if (diff > 80) {
        secondaryPixel = p;
        break;
      }
    }

    const accentHex = rgbToHex(primaryPixel.r, primaryPixel.g, primaryPixel.b);

    return {
      primary: `rgba(${primaryPixel.r}, ${primaryPixel.g}, ${primaryPixel.b}, 0.35)`,
      secondary: `rgba(${secondaryPixel.r}, ${secondaryPixel.g}, ${secondaryPixel.b}, 0.22)`,
      accent: accentHex,
      ambientGlow: `rgba(${primaryPixel.r}, ${primaryPixel.g}, ${primaryPixel.b}, 0.30)`
    };
  } catch {
    // Cross-origin tainted canvas fallback
    return null;
  }
}

/**
 * React Hook for fluid artwork-driven color extraction.
 */
export function useArtworkColors(song: Song | null): ArtworkColors {
  const [colors, setColors] = useState<ArtworkColors>(() => getInitialArtworkColors(song));

  useEffect(() => {
    if (!song) {
      setColors(DEFAULT_COLORS);
      return;
    }

    const key = song.id || `${song.title}-${song.artist}`;
    const initial = getInitialArtworkColors(song);
    setColors(initial);

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Resolve image URL
    const rawUrl = song.artwork?.imageUrl;
    const isDummy =
      !!rawUrl &&
      (rawUrl.includes('/xx/yy/zz') ||
        rawUrl.includes('/aa/bb/cc') ||
        rawUrl.includes('placeholder'));
    const candidateUrl = isDummy ? undefined : rawUrl;
    const resolvedUrl =
      candidateUrl ||
      getVerifiedSongArtwork({
        id: song.id,
        title: song.title,
        artist: song.artist
      });

    if (!resolvedUrl) return;

    if (colorCache.has(key) && colorCache.get(key) !== initial) {
      setColors(colorCache.get(key)!);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedUrl;

    img.onload = () => {
      if (!isMounted) return;
      const extracted = extractColorsFromImage(img);
      if (extracted) {
        colorCache.set(key, extracted);
        setColors(extracted);
      }
    };

    img.onerror = () => {
      // Fallback stays in place on network or CORS errors
    };

    return () => {
      isMounted = false;
    };
  }, [song?.id, song?.artwork?.imageUrl, song?.title, song?.artist]);

  return colors;
}

