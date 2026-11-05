/**
 * Share Moment Service for HyperMelo
 * Generates vertical 9:16 music videos with synchronized lyrics for Instagram Stories/Reels,
 * WhatsApp Status, and Snapchat.
 *
 * Adheres strictly to non-negotiable safeguards:
 * - Checks mobile browser and device MediaRecorder support before selecting video export approach.
 * - Enforces audio rights: exports audio only when the source and applicable rights permit it (CC / Open License).
 * - Never fabricates lyrics, timestamps, or licensing permissions.
 * - Implements native share sheet where supported, with Save Video fallback and clear social handoff guides.
 */

import type { Song, TimedLyricLine } from '../../types/music';
import type {
  MomentTemplateId,
  MomentTemplateConfig,
  AudioRightsStatus,
  ExportMomentOptions,
  ExportMomentResult
} from '../../types/share';
import { getLyricRepresentationText, type VerifiedLyricRepresentation } from '../../shared/lyrics';
import { getInitialArtworkColors } from '../artwork/colorExtractor';

export const MOMENT_TEMPLATES: MomentTemplateConfig[] = [
  {
    id: 'cinematic',
    name: 'Cinematic Lyrics',
    tagline: 'Immersive Film Aesthetic',
    badge: 'CINEMATIC',
    aspectRatio: '9:16',
    description: 'Filmic ambient artwork backdrop with glowing synchronized typography and atmospheric bloom.'
  },
  {
    id: 'minimal',
    name: 'Minimal Lyrics',
    tagline: 'Editorial Typographic Focus',
    badge: 'MINIMAL',
    aspectRatio: '9:16',
    description: 'Clean Swiss design on obsidian carbon with high-contrast active lyrics and zero distractions.'
  },
  {
    id: 'visualizer',
    name: 'Audio Visualizer',
    tagline: 'Rhythmic Spectrum Bars',
    badge: 'VISUALIZER',
    aspectRatio: '9:16',
    description: 'Pulsating animated audio spectrum bars radiating around album artwork with synchronized subtitle card.'
  },
  {
    id: 'mood',
    name: 'Mood Card',
    tagline: 'Atmosphere & Emotion Aura',
    badge: 'MOOD CARD',
    aspectRatio: '9:16',
    description: 'Themed color aura matched to song mood (Solaris, Romance, Midnight, Sad) with stylized lyric quote.'
  },
  {
    id: 'karaoke',
    name: 'Karaoke Moment',
    tagline: 'Sing-Along Studio Aesthetic',
    badge: 'KARAOKE',
    aspectRatio: '9:16',
    description: 'Sing-along lyric highlight with microphone badge and dual-mode Roman or native singing guide.'
  }
];

/**
 * Checks audio rights for a track to determine whether audio re-encoding/export is permitted.
 * Open/Creative Commons licenses, public domain, or user recordings permit audio export.
 * Commercial preview streams restrict audio export to protect rights holders;
 * in that case, the video is exported as a silent 9:16 lyric video for Stories.
 */
export function checkAudioRights(song: Song | null | undefined): AudioRightsStatus {
  if (!song) {
    return {
      canExportAudio: false,
      classification: 'NO_AUDIO_SOURCE',
      licenseLabel: null,
      reason: 'No track selected.',
      notice: 'Select a track to configure Share Moment.'
    };
  }

  const lic = (song.attribution?.license || '').trim().toLowerCase();
  const sourceType = (song.playbackSourceType || '').toLowerCase();

  const isOpenLicense =
    lic.includes('cc') ||
    lic.includes('creative commons') ||
    lic.includes('public domain') ||
    sourceType.includes('open-license') ||
    Boolean(song.isFallbackDemo);

  if (isOpenLicense) {
    return {
      canExportAudio: true,
      classification: 'PERMITTED_FULL',
      licenseLabel: song.attribution?.license || 'Open License',
      reason: 'Open / Creative Commons License permits audiovisual creation and sharing.',
      notice: 'Audio and synchronized lyrics will both be embedded into the vertical 9:16 video.'
    };
  }

  // Commercial streaming preview or copyrighted catalog asset
  return {
    canExportAudio: false,
    classification: 'RESTRICTED_PREVIEW',
    licenseLabel: song.attribution?.license || 'Standard Commercial License',
    reason: 'Audio re-encoding is restricted by rights holders for this streaming preview.',
    notice: ''
  };
}

/**
 * Detects the best supported video MIME type on the current client.
 * Prioritizes MP4 for iOS Safari / Android compatibility, falling back to WebM.
 */
export function getSupportedVideoMimeType(): { mimeType: string; extension: string } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/mp4', extension: 'mp4' };
  }

  const candidates = [
    { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return { mimeType: c.mime, extension: c.ext };
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Formats seconds into mm:ss.s timestamp
 */
export function formatMomentTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Draws a single vertical 9:16 frame onto an HTMLCanvasElement (720 x 1280).
 */
export function renderCanvasFrame(
  ctx: CanvasRenderingContext2D,
  options: {
    width: number;
    height: number;
    song: Song;
    template: MomentTemplateId;
    representation: VerifiedLyricRepresentation;
    lines: TimedLyricLine[];
    startSec: number;
    durationSec: number;
    currentSec: number; // relative to song start
    artImg?: HTMLImageElement | null;
  }
): void {
  const { width, height, song, template, representation, lines, startSec, durationSec, currentSec, artImg } = options;
  const colors = getInitialArtworkColors(song);
  const relSec = Math.max(0, currentSec - startSec);
  const progressRatio = durationSec > 0 ? Math.min(1, Math.max(0, relSec / durationSec)) : 0;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. BASE BACKGROUND & MOOD AURAS
  if (template === 'minimal') {
    // Ultra-clean matte charcoal to obsidian
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#10141D');
    bg.addColorStop(0.5, '#080A0F');
    bg.addColorStop(1, '#05060A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle accent line on top
    ctx.fillStyle = colors.accent;
    ctx.fillRect(0, 0, width, 4);
  } else if (template === 'mood') {
    // Mood-specific color auras
    const moodColors: Record<string, [string, string, string]> = {
      romance: ['#4C0519', '#881337', '#1E040D'],
      sad: ['#0F172A', '#1E293B', '#020617'],
      solaris: ['#451A03', '#78350F', '#0C0804'],
      midnight: ['#1E1B4B', '#312E81', '#070614']
    };
    const moodKey = (song.artwork?.pattern || 'solaris') in moodColors ? song.artwork.pattern : 'solaris';
    const [c1, c2, c3] = moodColors[moodKey] || moodColors.solaris;

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, c1);
    bg.addColorStop(0.4, c2);
    bg.addColorStop(1, c3);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Dynamic floating mood glow
    const radial = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height * 0.35, width * 0.65);
    radial.addColorStop(0, colors.ambientGlow || 'rgba(245, 158, 11, 0.3)');
    radial.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Cinematic, Visualizer, Karaoke: Deep backdrop with blurred artwork or ambient mesh
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, width, height);

    if (artImg && artImg.complete && artImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = template === 'cinematic' ? 0.38 : 0.22;
      ctx.filter = 'blur(32px)';
      ctx.drawImage(artImg, -width * 0.2, -height * 0.1, width * 1.4, height * 1.2);
      ctx.restore();
    }

    // Radial lighting bloom
    const radial = ctx.createRadialGradient(width / 2, height * 0.42, 60, width / 2, height * 0.42, width * 0.75);
    radial.addColorStop(0, colors.primary);
    radial.addColorStop(0.6, colors.secondary);
    radial.addColorStop(1, 'rgba(7, 9, 14, 0.95)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. HEADER: Branding, Mood badge, Song Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(244, 240, 235, 0.65)';
  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('HYPERMELO MOMENT', width / 2, 70);

  // Template badge
  const templateConfig = MOMENT_TEMPLATES.find((t) => t.id === template);
  if (templateConfig) {
    ctx.fillStyle = colors.accent;
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(`• ${templateConfig.badge} •`, width / 2, 95);
  }
  ctx.restore();

  // 3. CENTRAL ALBUM ARTWORK (for Visualizer, Mood, and Cinematic)
  if (template === 'visualizer' || template === 'mood' || template === 'karaoke') {
    const artSize = template === 'visualizer' ? 260 : 200;
    const artX = (width - artSize) / 2;
    const artY = 140;

    // Artwork shadow / glow
    ctx.save();
    ctx.shadowColor = colors.ambientGlow || 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#1A1E29';
    roundRect(ctx, artX, artY, artSize, artSize, 24);
    ctx.fill();
    ctx.restore();

    // Draw image inside rounded rectangle
    if (artImg && artImg.complete && artImg.naturalWidth > 0) {
      ctx.save();
      roundRect(ctx, artX, artY, artSize, artSize, 24);
      ctx.clip();
      ctx.drawImage(artImg, artX, artY, artSize, artSize);
      ctx.restore();
    } else {
      // Fallback artwork box
      ctx.save();
      roundRect(ctx, artX, artY, artSize, artSize, 24);
      ctx.fillStyle = colors.primary;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(song.title.slice(0, 2).toUpperCase(), width / 2, artY + artSize / 2 + 12);
      ctx.restore();
    }

    // 3b. AUDIO VISUALIZER BARS (Visualizer Template)
    if (template === 'visualizer') {
      const barCount = 28;
      const barWidth = 14;
      const barGap = 6;
      const totalWidth = barCount * (barWidth + barGap) - barGap;
      const startX = (width - totalWidth) / 2;
      const baseY = artY + artSize + 60;

      for (let i = 0; i < barCount; i++) {
        // Pseudo audio reactive wave using sine + cosine harmonics
        const freq = (i / barCount) * Math.PI * 4;
        const pulse = Math.sin(currentSec * 6 + freq) * 0.5 + 0.5;
        const wave = Math.cos(currentSec * 3 + i * 0.4) * 0.3 + 0.7;
        const barH = Math.max(12, Math.min(100, (pulse * wave * 85)));

        const bx = startX + i * (barWidth + barGap);
        const by = baseY - barH;

        const grad = ctx.createLinearGradient(0, by, 0, baseY);
        grad.addColorStop(0, colors.accent);
        grad.addColorStop(1, colors.secondary);

        ctx.fillStyle = grad;
        roundRect(ctx, bx, by, barWidth, barH, 6);
        ctx.fill();
      }
    }
  }

  // 4. SONG METADATA HEADER (Multi-line dynamic wrapping, no unnecessary truncation)
  ctx.save();
  ctx.textAlign = 'center';
  const metaY = template === 'minimal' ? 210 : template === 'cinematic' ? 195 : 465;

  // Title: Adaptive size and 2-line wrap
  ctx.fillStyle = '#F4F0EB';
  const titleFontSize = song.title.length > 28 ? 26 : 32;
  const titleLineHeight = titleFontSize + 8;
  ctx.font = `700 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const titleMetrics = wrapText(ctx, song.title, width / 2, metaY, width - 100, titleLineHeight, 2);

  // Artist: Placed dynamically below title
  const artistY = metaY + (titleMetrics.height / 2) + 20;
  ctx.fillStyle = 'rgba(244, 240, 235, 0.72)';
  const artistFontSize = song.artist.length > 36 ? 18 : 20;
  ctx.font = `500 ${artistFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const artistMetrics = wrapText(ctx, song.artist, width / 2, artistY, width - 120, artistFontSize + 6, 2);

  // Language & Category Pill: Placed cleanly below artist
  if (representation) {
    const repX = width / 2;
    const repY = artistY + (artistMetrics.height / 2) + 26;
    ctx.fillStyle = 'rgba(244, 240, 235, 0.08)';
    ctx.strokeStyle = 'rgba(244, 240, 235, 0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, repX - 120, repY - 16, 240, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.accent;
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(representation.label.toUpperCase(), repX, repY + 5);
  }
  ctx.restore();

  // 5. SYNCHRONIZED LYRICS SECTION (Natural line advancement, high contrast & dynamic spacing)
  const lyricsCenterY = template === 'minimal' ? height * 0.60 : template === 'cinematic' ? height * 0.56 : height * 0.73;

  // Identify active lyric line for currentSec using robust continuous interval matching
  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineStart = lines[i].startTime ?? lines[i].time ?? 0;
    const nextStart = i < lines.length - 1
      ? (lines[i + 1].startTime ?? lines[i + 1].time ?? lineStart + 4)
      : lineStart + 5;

    if (currentSec >= lineStart && currentSec < nextStart) {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1 && lines.length > 0) {
    if (currentSec < (lines[0].startTime ?? lines[0].time ?? 0)) {
      activeIdx = 0;
    } else {
      activeIdx = lines.length - 1;
    }
  }

  const activeLine = lines[activeIdx];
  const prevLine = activeIdx > 0 ? lines[activeIdx - 1] : null;
  const nextLine = activeIdx < lines.length - 1 ? lines[activeIdx + 1] : null;

  const activeDisplay = activeLine
    ? getLyricRepresentationText(activeLine, representation, song.originalLanguage)
    : null;

  // 5a. Previous line (subtle context)
  if (prevLine && template !== 'minimal') {
    const prevDisplay = getLyricRepresentationText(prevLine, representation, song.originalLanguage);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    wrapText(ctx, prevDisplay.text, width / 2, lyricsCenterY - 110, width - 140, 26, 2);
    ctx.restore();
  }

  // 5b. Active line (Hero typography & high contrast)
  let activeHeight = 44;
  if (activeDisplay && activeDisplay.text) {
    ctx.save();
    ctx.textAlign = 'center';

    if (template === 'karaoke') {
      ctx.fillStyle = 'rgba(231, 165, 141, 0.12)';
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.5;
      roundRect(ctx, 36, lyricsCenterY - 50, width - 72, 100, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 16;
      const m = wrapText(ctx, activeDisplay.text, width / 2, lyricsCenterY + 4, width - 110, 40, 3);
      activeHeight = m.height;

      if (activeDisplay.secondaryText) {
        ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = colors.accent;
        ctx.shadowBlur = 0;
        ctx.fillText(activeDisplay.secondaryText, width / 2, lyricsCenterY + (activeHeight / 2) + 26);
      }
    } else if (template === 'mood') {
      ctx.fillStyle = colors.accent;
      ctx.font = 'italic 700 44px Georgia, serif';
      ctx.fillText('“', width / 2 - 160, lyricsCenterY - 24);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const m = wrapText(ctx, activeDisplay.text, width / 2, lyricsCenterY + 4, width - 130, 42, 3);
      activeHeight = m.height;

      if (activeDisplay.secondaryText) {
        ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'rgba(244, 240, 235, 0.7)';
        ctx.fillText(activeDisplay.secondaryText, width / 2, lyricsCenterY + (activeHeight / 2) + 26);
      }
    } else {
      if (template === 'cinematic') {
        ctx.fillStyle = 'rgba(5, 7, 12, 0.45)';
        roundRect(ctx, 30, lyricsCenterY - 50, width - 60, 100, 24);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = template === 'minimal'
        ? '700 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '700 36px Georgia, serif';
      ctx.shadowColor = template === 'cinematic' ? colors.accent : 'transparent';
      ctx.shadowBlur = template === 'cinematic' ? 20 : 0;
      const m = wrapText(ctx, activeDisplay.text, width / 2, lyricsCenterY + 4, width - 120, 44, 3);
      activeHeight = m.height;

      if (activeDisplay.secondaryText) {
        ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = colors.accent;
        ctx.shadowBlur = 0;
        ctx.fillText(activeDisplay.secondaryText, width / 2, lyricsCenterY + (activeHeight / 2) + 26);
      }
    }
    ctx.restore();
  }

  // 5c. Next line (subtle context)
  if (nextLine && template !== 'minimal') {
    const nextDisplay = getLyricRepresentationText(nextLine, representation, song.originalLanguage);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const nextY = lyricsCenterY + (activeHeight / 2) + (activeDisplay?.secondaryText ? 52 : 36) + 30;
    wrapText(ctx, nextDisplay.text, width / 2, nextY, width - 140, 26, 2);
    ctx.restore();
  }

  // 6. TIMELINE PROGRESS BAR
  const progressY = height - 120;
  ctx.save();
  // Track bar
  ctx.fillStyle = 'rgba(244, 240, 235, 0.16)';
  roundRect(ctx, 60, progressY, width - 120, 6, 3);
  ctx.fill();

  // Progress fill
  ctx.fillStyle = colors.accent;
  roundRect(ctx, 60, progressY, (width - 120) * progressRatio, 6, 3);
  ctx.fill();

  // Time stamps
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillStyle = 'rgba(244, 240, 235, 0.65)';
  ctx.textAlign = 'left';
  ctx.fillText(formatMomentTime(startSec + relSec), 60, progressY + 24);
  ctx.textAlign = 'right';
  ctx.fillText(formatMomentTime(startSec + durationSec), width - 60, progressY + 24);
  ctx.restore();

  // 7. FOOTER WATERMARK / BRANDING & ATTRIBUTION
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillStyle = 'rgba(244, 240, 235, 0.45)';
  ctx.fillText('HYPERMELO • FEEL IT. MAKE IT.', width / 2, height - 52);

  // Creative Commons Attribution line when track has an attribution license
  if (song.attribution?.license) {
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillStyle = 'rgba(244, 240, 235, 0.40)';
    ctx.fillText(`${song.attribution.license} • ${song.attribution.title || song.title} by ${song.attribution.artist || song.artist}`, width / 2, height - 30);
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Helper to draw rounded rectangle on canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Helper to wrap text with line breaks on 2D canvas
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4
): { lineCount: number; height: number; lines: string[] } {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      if (lines.length === maxLines - 1) {
        line = line.trim() + '...';
        break;
      }
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  if (line.trim().length > 0 && lines.length < maxLines) {
    lines.push(line.trim());
  }

  // Render centered lines
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  for (let k = 0; k < lines.length; k++) {
    ctx.fillText(lines[k], x, startY + k * lineHeight);
  }

  return { lineCount: lines.length, height: lines.length * lineHeight, lines };
}

/**
 * Loads an artwork image asynchronously for canvas rendering.
 */
export async function loadArtworkImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Exports a vertical 9:16 video using MediaRecorder and Canvas 2D captureStream.
 * Embeds audio only when permitted by rights and source.
 */
export async function exportMomentVideo(
  options: ExportMomentOptions
): Promise<ExportMomentResult> {
  const { song, template, representation, lines, startSec, durationSec, onProgress, audioElement } = options;
  const rights = checkAudioRights(song);
  const { mimeType } = getSupportedVideoMimeType();

  const width = 720;
  const height = 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available on this device.');
  }

  // Preload artwork image
  const artImg = await loadArtworkImage(song.artwork?.imageUrl);

  // Set up MediaStream from Canvas
  const fps = 30;
  const canvasStream = canvas.captureStream ? canvas.captureStream(fps) : (canvas as any).mozCaptureStream(fps);
  if (!canvasStream) {
    throw new Error('Canvas captureStream is not supported by your browser.');
  }

  const combinedStream = new MediaStream();
  for (const track of canvasStream.getVideoTracks()) {
    combinedStream.addTrack(track);
  }

  let isSilent = true;
  let audioCtx: AudioContext | null = null;

  // If audio is permitted, connect audio track and align start time
  if (rights.canExportAudio && audioElement) {
    try {
      let audioStream: MediaStream | null = null;
      if (typeof (audioElement as any).captureStream === 'function') {
        audioStream = (audioElement as any).captureStream();
      } else if (typeof (audioElement as any).mozCaptureStream === 'function') {
        audioStream = (audioElement as any).mozCaptureStream();
      }

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        for (const track of audioStream.getAudioTracks()) {
          combinedStream.addTrack(track);
          isSilent = false;
        }
        audioElement.currentTime = startSec;
        audioElement.playbackRate = 1.0;
        audioElement.preservesPitch = true;
        audioElement.play().catch((err) => console.warn('Audio play notice during export:', err));
      } else {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtx = new AudioCtx();
          const dest = audioCtx.createMediaStreamDestination();
          const source = audioCtx.createMediaElementSource(audioElement);
          source.connect(dest);
          for (const track of dest.stream.getAudioTracks()) {
            combinedStream.addTrack(track);
            isSilent = false;
          }
          audioElement.currentTime = startSec;
          audioElement.play().catch((err) => console.warn('Audio play notice during export:', err));
        }
      }
    } catch (err) {
      console.warn('[ShareMomentService] Audio capture skipped (CORS or DRM restriction):', err);
      isSilent = true;
    }
  }

  // Initialize MediaRecorder
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps crisp 720x1280 mobile video
    });
  } catch {
    // Fallback to basic MediaRecorder without mime options
    recorder = new MediaRecorder(combinedStream);
  }

  const actualMimeType = recorder.mimeType || mimeType;
  const actualExtension = actualMimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    let frameId = 0;
    const startTimeMs = performance.now();
    const durationMs = durationSec * 1000;

    recorder.onstop = () => {
      cancelAnimationFrame(frameId);
      if (audioElement) {
        audioElement.pause();
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      for (const track of combinedStream.getTracks()) {
        track.stop();
      }

      const videoBlob = new Blob(chunks, { type: actualMimeType });
      const sanitizedTitle = song.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `HyperMelo_${sanitizedTitle}_${Math.round(startSec)}s.${actualExtension}`;

      resolve({
        blob: videoBlob,
        filename,
        mimeType: actualMimeType,
        isSilent,
        durationSec,
        dimensions: { width, height }
      });
    };

    recorder.onerror = (e) => {
      cancelAnimationFrame(frameId);
      if (audioElement) {
        audioElement.pause();
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      for (const track of combinedStream.getTracks()) {
        track.stop();
      }
      reject(new Error(`Recording failed: ${(e as any).error?.message || 'MediaRecorder error'}`));
    };

    recorder.start(100); // 100ms slices

    // Animation rendering loop
    const renderLoop = () => {
      const elapsedMs = performance.now() - startTimeMs;
      const progress = Math.min(1.0, elapsedMs / durationMs);

      if (onProgress) {
        onProgress(Math.round(progress * 100));
      }

      const currentSec = startSec + (elapsedMs / 1000);
      renderCanvasFrame(ctx, {
        width,
        height,
        song,
        template,
        representation,
        lines,
        startSec,
        durationSec,
        currentSec,
        artImg
      });

      if (elapsedMs < durationMs) {
        frameId = requestAnimationFrame(renderLoop);
      } else {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }
    };

    frameId = requestAnimationFrame(renderLoop);
  });
}

/**
 * Triggers native OS share sheet using Web Share API Level 2 (files support).
 */
export async function shareToNativeSheet(
  file: File,
  song: Song,
  excerptText: string
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }

  const shareData: ShareData = {
    title: `${song.title} — HyperMelo Moment`,
    text: `"${excerptText}" • Listen to ${song.title} by ${song.artist} on HyperMelo`
  };

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    shareData.files = [file];
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled share sheet
      return false;
    }
    throw err;
  }
}

/**
 * Returns supported social handoff destination URL / URI schemes and user guidance.
 */
export function getSocialHandoff(
  platform: 'instagram' | 'whatsapp' | 'snapchat',
  song: Song
): { url: string; instructions: string } {
  switch (platform) {
    case 'instagram':
      return {
        url: 'instagram-stories://share',
        instructions:
          'Video saved to your Photos / Gallery! Open Instagram, tap "+" or "Your Story" in the top-left, pick your saved HyperMelo moment, and post.'
      };
    case 'whatsapp':
      return {
        url: `whatsapp://send?text=${encodeURIComponent(`Check out my HyperMelo moment for "${song.title}" by ${song.artist}!`)}`,
        instructions:
          'Video saved to your Photos! In WhatsApp, open the "Updates" / "Status" tab, tap the camera icon, select your video, and share to your status.'
      };
    case 'snapchat':
      return {
        url: 'snapchat://',
        instructions:
          'Video saved to your Camera Roll! Open Snapchat, swipe up to Memories -> Camera Roll, select the video, and tap Send to Story.'
      };
  }
}

