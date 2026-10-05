import type { Song, Language, TimedLyricLine } from '../../shared';
import { lyricsService, getActiveLyricIndex } from './lyricsService';

export interface FloatingLyricItem {
  text: string;
  tag: string;
  type: 'previous_line' | 'upcoming_line' | 'emotional_phrase' | 'chorus_snippet' | 'metadata';
  sourceLineIndex?: number;
  startTime?: number;
}

export interface FloatingLyricsState {
  topLeft: FloatingLyricItem | null;
  right: FloatingLyricItem | null;
  bottom: FloatingLyricItem | null;
}

const GENERIC_PLACEHOLDER_REGEX = /lyrics?\s*unavailable|गीत उपलब्ध नहीं|సాహిత్యం అందుబాటులో|unavailable|no lyrics|lorem ipsum|placeholder/i;

/**
 * Validates whether text is genuine, non-empty, non-placeholder lyric line.
 */
export function isValidLyricText(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (trimmed.length > 75) return false; // avoidVeryLongLines
  if (GENERIC_PLACEHOLDER_REGEX.test(trimmed)) return false; // neverUseGenericPlaceholderText

  // Filter out structural / non-lyric markers
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'instrumental' || lower === 'solo' || lower === 'intro' || lower === 'outro') return false;

  return true;
}

/**
 * Scores a lyric line based on suitability for floating visualizer display:
 * - Prefer short, impactful lines (12–42 chars)
 * - Prefer meaningful phrasing (3–8 words)
 * - Demote overly long or overly brief utterances
 */
export function scoreLyricLine(line: string): number {
  let score = 10;
  const len = line.length;

  if (len >= 12 && len <= 42) {
    score += 25; // sweet spot
  } else if (len > 42 && len <= 60) {
    score += 10;
  } else if (len > 60) {
    score -= 15; // avoidVeryLongLines
  } else if (len < 10) {
    score -= 5;
  }

  const wordCount = line.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 3 && wordCount <= 8) {
    score += 15;
  }

  return score;
}

/**
 * Extracts and aligns floating lyrics for the visualizer.
 * Follows strict constraints:
 * - topLeft: memorable previous or upcoming line
 * - right: memorable upcoming line
 * - bottom: short emotional phrase / chorus snippet
 * - avoidCurrentCenterLyric: strictly excludes current active lyric
 * - avoidDuplicateLines: all 3 positions are strictly unique
 * - fallbackToTaggedLyrics: uses untimed/tagged lines or sections if unsynced
 * - whenLyricsUnavailable: uses genuine song metadata or hides bubble (zero generic placeholders)
 */
export function selectVisualizerFloatingLyrics(
  song: Song | null | undefined,
  currentTime: number,
  displayLanguage: Language = 'en'
): FloatingLyricsState {
  if (!song) {
    return { topLeft: null, right: null, bottom: null };
  }

  // 1. Retrieve canonical lines (or localized lines for displayLanguage)
  let rawLines: TimedLyricLine[] = [];
  try {
    const canonical = lyricsService.getCanonicalLyricLines(song);
    if (canonical && canonical.length > 0) {
      if (displayLanguage && song.lyrics?.[displayLanguage]?.lines?.length) {
        rawLines = song.lyrics[displayLanguage]!.lines;
      } else {
        rawLines = canonical;
      }
    }
  } catch {
    rawLines = [];
  }

  // Fallback to tagged lyrics if canonical is empty
  if (rawLines.length === 0 && song.lyrics) {
    for (const langKey of [displayLanguage, 'en', 'hi', 'te', 'ta', 'ml']) {
      const bucket = song.lyrics[langKey];
      if (bucket?.lines?.length) {
        rawLines = bucket.lines;
        break;
      }
    }
  }

  // Filter valid candidate lines
  const validLines: { line: TimedLyricLine; index: number; score: number }[] = [];
  rawLines.forEach((line, index) => {
    if (isValidLyricText(line.text)) {
      validLines.push({
        line,
        index,
        score: scoreLyricLine(line.text)
      });
    }
  });

  // CASE A: Genuine Lyrics Available
  if (validLines.length > 0) {
    // Check if synced
    const hasSync = validLines.some((v) => (v.line.startTime !== undefined && v.line.startTime >= 0) || (v.line.time !== undefined && v.line.time >= 0));

    let activeValidIdx = -1;
    let currentCenterText: string | null = null;

    if (hasSync) {
      const activeRawIdx = getActiveLyricIndex(rawLines, currentTime);
      if (activeRawIdx >= 0 && activeRawIdx < rawLines.length) {
        currentCenterText = rawLines[activeRawIdx].text;
        activeValidIdx = validLines.findIndex((v) => v.index === activeRawIdx);
      }
    } else {
      // Unsynced progress mapping
      const duration = song.duration || 180;
      const progress = Math.min(0.99, Math.max(0, currentTime / duration));
      activeValidIdx = Math.floor(progress * validLines.length);
      currentCenterText = validLines[activeValidIdx]?.line.text || null;
    }

    const usedTexts = new Set<string>();
    if (currentCenterText) {
      usedTexts.add(currentCenterText.trim().toLowerCase());
    }

    // --- TopLeft: Memorable Previous or Upcoming Line ---
    let topLeftItem: FloatingLyricItem | null = null;

    if (activeValidIdx > 0) {
      // Look back for previous line
      for (let i = activeValidIdx - 1; i >= 0; i--) {
        const cand = validLines[i];
        const normalized = cand.line.text.trim().toLowerCase();
        if (!usedTexts.has(normalized)) {
          topLeftItem = {
            text: cand.line.text.trim(),
            tag: 'PREVIOUS',
            type: 'previous_line',
            sourceLineIndex: cand.index,
            startTime: cand.line.startTime ?? cand.line.time
          };
          usedTexts.add(normalized);
          break;
        }
      }
    }

    // If no previous line (song intro or line 0), look for upcoming memorable line
    if (!topLeftItem) {
      for (let i = Math.max(0, activeValidIdx + 1); i < validLines.length; i++) {
        const cand = validLines[i];
        const normalized = cand.line.text.trim().toLowerCase();
        if (!usedTexts.has(normalized)) {
          topLeftItem = {
            text: cand.line.text.trim(),
            tag: 'UPCOMING',
            type: 'upcoming_line',
            sourceLineIndex: cand.index,
            startTime: cand.line.startTime ?? cand.line.time
          };
          usedTexts.add(normalized);
          break;
        }
      }
    }

    // --- Right: Memorable Upcoming Line ---
    let rightItem: FloatingLyricItem | null = null;
    const rightSearchStart = Math.max(0, activeValidIdx + 1);

    for (let i = rightSearchStart; i < validLines.length; i++) {
      const cand = validLines[i];
      const normalized = cand.line.text.trim().toLowerCase();
      if (!usedTexts.has(normalized)) {
        rightItem = {
          text: cand.line.text.trim(),
          tag: 'UPCOMING',
          type: 'upcoming_line',
          sourceLineIndex: cand.index,
          startTime: cand.line.startTime ?? cand.line.time
        };
        usedTexts.add(normalized);
        break;
      }
    }

    // Fallback for right near end of track: find any other memorable line
    if (!rightItem) {
      for (let i = 0; i < validLines.length; i++) {
        const cand = validLines[i];
        const normalized = cand.line.text.trim().toLowerCase();
        if (!usedTexts.has(normalized)) {
          rightItem = {
            text: cand.line.text.trim(),
            tag: 'MEMORABLE',
            type: 'upcoming_line',
            sourceLineIndex: cand.index,
            startTime: cand.line.startTime ?? cand.line.time
          };
          usedTexts.add(normalized);
          break;
        }
      }
    }

    // --- Bottom: Short Emotional Phrase / Chorus Snippet ---
    let bottomItem: FloatingLyricItem | null = null;

    // Check chorusSnippet from song lyrics
    const chorusSnippet =
      song.lyrics?.[displayLanguage]?.chorusSnippet ||
      song.lyrics?.en?.chorusSnippet ||
      song.lyrics?.hi?.chorusSnippet ||
      song.lyrics?.te?.chorusSnippet;

    if (isValidLyricText(chorusSnippet)) {
      const normalized = chorusSnippet!.trim().toLowerCase();
      if (!usedTexts.has(normalized)) {
        bottomItem = {
          text: chorusSnippet!.trim(),
          tag: 'CHORUS HOOK',
          type: 'chorus_snippet'
        };
        usedTexts.add(normalized);
      }
    }

    // Fallback: pick shortest high-scoring line that hasn't been used
    if (!bottomItem) {
      const unusedCandidates = validLines
        .filter((v) => !usedTexts.has(v.line.text.trim().toLowerCase()))
        .sort((a, b) => a.line.text.length - b.line.text.length);

      if (unusedCandidates.length > 0) {
        const best = unusedCandidates[0];
        bottomItem = {
          text: best.line.text.trim(),
          tag: 'EMOTIONAL PHRASE',
          type: 'emotional_phrase',
          sourceLineIndex: best.index,
          startTime: best.line.startTime ?? best.line.time
        };
        usedTexts.add(best.line.text.trim().toLowerCase());
      }
    }

    return {
      topLeft: topLeftItem,
      right: rightItem,
      bottom: bottomItem
    };
  }

  // CASE B: Lyrics Unavailable (Fallback to Authentic Song Metadata, Zero Placeholders)
  // whenLyricsUnavailable: "use song metadata or hide bubble", neverUseGenericPlaceholderText: true

  // TopLeft: Genre & BPM
  let topLeftMeta: FloatingLyricItem | null = null;
  if (song.genre && song.genre.trim().length > 0) {
    const genreClean = song.genre.trim();
    const bpmText = song.bpm && song.bpm > 0 ? ` • ${song.bpm} BPM` : '';
    topLeftMeta = {
      text: `${genreClean}${bpmText}`,
      tag: 'GENRE & TEMPO',
      type: 'metadata'
    };
  }

  // Right: Musical Key or Release Year
  let rightMeta: FloatingLyricItem | null = null;
  if (song.musicalKey && song.musicalKey.trim().length > 0) {
    rightMeta = {
      text: `Key of ${song.musicalKey.trim()}`,
      tag: 'MUSICAL KEY',
      type: 'metadata'
    };
  } else if (song.releaseYear && song.releaseYear > 1900) {
    rightMeta = {
      text: `Released ${song.releaseYear}`,
      tag: 'RELEASE YEAR',
      type: 'metadata'
    };
  }

  // Bottom: Album or Master Attribution
  let bottomMeta: FloatingLyricItem | null = null;
  if (song.album && song.album.trim().length > 0 && song.album.toLowerCase() !== song.title.toLowerCase()) {
    bottomMeta = {
      text: song.album.trim(),
      tag: 'ALBUM',
      type: 'metadata'
    };
  } else if (song.attribution?.license) {
    bottomMeta = {
      text: `License: ${song.attribution.license}`,
      tag: 'ATTRIBUTION',
      type: 'metadata'
    };
  } else if (song.artist && song.artist.trim().length > 0) {
    bottomMeta = {
      text: `Original Master by ${song.artist}`,
      tag: 'MASTER AUDIO',
      type: 'metadata'
    };
  }

  return {
    topLeft: topLeftMeta,
    right: rightMeta,
    bottom: bottomMeta
  };
}
