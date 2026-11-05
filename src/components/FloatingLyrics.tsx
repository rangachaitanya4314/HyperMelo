import React from 'react';
import type { TimedLyricLine } from '../types/music';
import { getListeningLyricDisplay } from '../shared/lyrics';
import { measureLinePace, getPaceTransition } from '../services/lyrics/lyricsService';
import './FloatingLyrics.css';

export interface FloatingLyricsProps {
  lines: TimedLyricLine[];
  activeLyricIndex: number;
  isSynced: boolean;
  isPlaying: boolean;
  currentTime: number;
  sourceLanguage?: string;
  listeningMeaningLanguage: string;
  onSeek: (time: number) => void;
  activeLyricRef?: React.RefObject<HTMLDivElement | null>;
  animationMode?: 'floating' | 'classic';
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const FloatingLyrics: React.FC<FloatingLyricsProps> = ({
  lines,
  activeLyricIndex,
  isSynced,
  isPlaying: _isPlaying,
  currentTime: _currentTime,
  sourceLanguage = 'en',
  listeningMeaningLanguage,
  onSeek,
  activeLyricRef,
  animationMode = 'floating'
}) => {
  if (!lines || lines.length === 0) return null;

  return (
    <React.Fragment>
      {lines.map((line, idx) => {
        const isActive = idx === activeLyricIndex;
        const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : line.time;
        const lineStart = lineTime !== undefined && lineTime >= 0 ? lineTime : 0;
        const lineEnd = line.endTime !== undefined && line.endTime > lineStart
          ? line.endTime
          : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : lineStart + 3.0);

        const display = getListeningLyricDisplay(line, listeningMeaningLanguage as any, sourceLanguage);
        const pace = line.pace !== undefined
          ? line.pace
          : measureLinePace({ text: display.originalText, startTime: lineStart, endTime: lineEnd }, sourceLanguage);
        const paceTransition = getPaceTransition(pace);

        // Derive spatial depth state relative to focal active index
        let depthState: 'active' | 'impending' | 'future' | 'ascending' | 'past';
        if (activeLyricIndex === -1) {
          depthState = 'future';
        } else if (idx === activeLyricIndex) {
          depthState = 'active';
        } else if (idx === activeLyricIndex + 1) {
          depthState = 'impending';
        } else if (idx > activeLyricIndex + 1) {
          depthState = 'future';
        } else if (idx === activeLyricIndex - 1) {
          depthState = 'ascending';
        } else {
          depthState = 'past';
        }

        // Rollback protection: Classic mode renders original inline styling
        if (animationMode === 'classic') {
          return (
            <div
              key={line.id || idx}
              ref={isActive ? activeLyricRef : null}
              id={`now-playing-lyric-${idx}`}
              data-testid={isActive ? 'active-lyric-line' : `lyric-line-${idx}`}
              data-active={isActive ? 'true' : 'false'}
              data-timestamp={lineTime}
              data-pace={pace}
              data-pace-category={paceTransition.category}
              data-animation-mode="classic"
              onClick={() => {
                if (isSynced && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                  onSeek(lineTime);
                }
              }}
              role={isSynced ? 'button' : undefined}
              tabIndex={isSynced ? 0 : undefined}
              onKeyDown={(e) => {
                if (isSynced && (e.key === 'Enter' || e.key === ' ') && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                  e.preventDefault();
                  onSeek(lineTime);
                }
              }}
              style={{
                padding: '12px 18px',
                borderRadius: '14px',
                cursor: isSynced ? 'pointer' : 'default',
                transition: isActive ? paceTransition.transitionCss : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                color: isActive ? '#FFFFFF' : 'rgba(244, 240, 235, 0.55)',
                fontSize: isActive ? 'clamp(1.18rem, 2.3vw, 1.6rem)' : 'clamp(0.95rem, 1.6vw, 1.15rem)',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? 'rgba(244, 240, 235, 0.08)' : 'transparent',
                transform: isActive ? 'scale(1.02) translateX(4px)' : 'scale(1)',
                textShadow: isActive ? '0 0 25px var(--ambient-glow, rgba(254, 243, 199, 0.35))' : 'none',
                userSelect: 'none',
                borderLeft: isActive ? '3px solid var(--ambient-accent, var(--accent-warm, #E7A58D))' : '3px solid transparent'
              }}
              title={isSynced && typeof lineTime === 'number' && lineTime >= 0 ? `Seek to ${formatTime(lineTime)}` : undefined}
            >
              <div
                data-testid="listening-primary-lyric"
                style={{
                  letterSpacing: '0.01em',
                  lineHeight: 1.5,
                  overflowWrap: 'break-word',
                  fontFamily: 'inherit, "Noto Sans Devanagari", "Noto Sans Telugu", "Noto Sans Tamil", "Noto Sans Malayalam", sans-serif'
                }}
              >
                {display.originalText}
              </div>

              {display.meaningText && !display.isSameAsOriginal ? (
                <div
                  data-testid={display.isMeaningAvailable ? 'listening-secondary-meaning' : 'listening-meaning-unavailable'}
                  style={{
                    fontSize: isActive ? 'clamp(0.85rem, 1.4vw, 1.02rem)' : 'clamp(0.76rem, 1.1vw, 0.88rem)',
                    color: display.isMeaningAvailable
                      ? (isActive ? 'rgba(231, 165, 141, 0.95)' : 'rgba(244, 240, 235, 0.6)')
                      : 'rgba(244, 240, 235, 0.4)',
                    fontStyle: display.isMeaningAvailable ? 'normal' : 'italic',
                    marginTop: '6px',
                    lineHeight: 1.45,
                    fontWeight: 400
                  }}
                >
                  {display.isMeaningAvailable ? display.meaningText : `[${display.meaningText}]`}
                </div>
              ) : null}
            </div>
          );
        }

        // Premium Floating Typography mode
        return (
          <div
            key={line.id || idx}
            ref={isActive ? activeLyricRef : null}
            id={`now-playing-lyric-${idx}`}
            data-testid={isActive ? 'active-lyric-line' : `lyric-line-${idx}`}
            data-active={isActive ? 'true' : 'false'}
            data-state={depthState}
            data-timestamp={lineTime}
            data-pace={pace}
            data-pace-category={paceTransition.category}
            data-animation-mode="floating"
            className="floating-lyric-item"
            onClick={() => {
              if (isSynced && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                onSeek(lineTime);
              }
            }}
            role={isSynced ? 'button' : undefined}
            tabIndex={isSynced ? 0 : undefined}
            aria-current={isActive ? 'true' : undefined}
            onKeyDown={(e) => {
              if (isSynced && (e.key === 'Enter' || e.key === ' ') && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                e.preventDefault();
                onSeek(lineTime);
              }
            }}
            title={isSynced && typeof lineTime === 'number' && lineTime >= 0 ? `Seek to ${formatTime(lineTime)}` : undefined}
          >
            {/* Primary Sung Text in Native Script */}
            <div
              className="floating-lyric-primary"
              data-testid="listening-primary-lyric"
            >
              {display.originalText}
            </div>

            {/* Contextual Meaning / Translation (with subtle 40ms stagger) */}
            {display.meaningText && !display.isSameAsOriginal ? (
              <div
                className={`floating-lyric-meaning ${!display.isMeaningAvailable ? 'unavailable' : ''}`}
                data-testid={display.isMeaningAvailable ? 'listening-secondary-meaning' : 'listening-meaning-unavailable'}
              >
                {display.isMeaningAvailable ? display.meaningText : `[${display.meaningText}]`}
              </div>
            ) : null}
          </div>
        );
      })}
    </React.Fragment>
  );
};
