import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { Song, SongSection } from '../types/music';

interface WaveformTimelineProps {
  song: Song;
  section: SongSection;
  onChangeSection: (newSection: SongSection) => void;
  currentTime?: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  height?: number;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  song,
  section,
  onChangeSection,
  currentTime = 0,
  isPlaying = false,
  onSeek,
  height = 96
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);

  // Generate deterministic realistic audio waveform bars for this song
  const barCount = 64;
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const seed = song.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < barCount; i++) {
      // Wave shape: quiet intro, swelling verse, high energy chorus, bridge variation
      const pos = i / barCount;
      const energy = 0.25 + 0.6 * Math.sin(pos * Math.PI) + 0.2 * Math.sin(pos * 5 * Math.PI);
      const rand = Math.sin(seed + i * 13.37) * 0.5 + 0.5;
      const heightVal = Math.min(1, Math.max(0.18, energy * 0.7 + rand * 0.3));
      bars.push(heightVal);
    }
    return bars;
  }, [song.id, barCount]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startPercent = Math.max(0, Math.min(100, (section.start / song.duration) * 100));
  const endPercent = Math.max(0, Math.min(100, (section.end / song.duration) * 100));
  const playheadPercent = Math.max(0, Math.min(100, (currentTime / song.duration) * 100));

  const handlePointerDown = (type: 'start' | 'end', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveDrag(type);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = clickPercent * song.duration;
    onSeek(targetTime);
  };

  const handleGlobalPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!activeDrag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, pointerX / rect.width));
      const newSec = Math.round(percent * song.duration);

      if (activeDrag === 'start') {
        const clampedStart = Math.min(newSec, section.end - 5);
        if (clampedStart >= 0) {
          onChangeSection({
            ...section,
            type: 'custom',
            label: 'Custom Range',
            start: clampedStart
          });
        }
      } else if (activeDrag === 'end') {
        const clampedEnd = Math.max(newSec, section.start + 5);
        if (clampedEnd <= song.duration) {
          onChangeSection({
            ...section,
            type: 'custom',
            label: 'Custom Range',
            end: clampedEnd
          });
        }
      }
    },
    [activeDrag, song.duration, section, onChangeSection]
  );

  const handleGlobalPointerUp = useCallback(() => {
    setActiveDrag(null);
  }, []);

  useEffect(() => {
    if (activeDrag) {
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      return () => {
        window.removeEventListener('pointermove', handleGlobalPointerMove);
        window.removeEventListener('pointerup', handleGlobalPointerUp);
      };
    }
  }, [activeDrag, handleGlobalPointerMove, handleGlobalPointerUp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Waveform track container */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        role="slider"
        aria-label="Audio selection range"
        aria-valuemin={0}
        aria-valuemax={song.duration}
        aria-valuenow={section.start}
        style={{
          position: 'relative',
          height: `${height}px`,
          backgroundColor: 'rgba(14, 19, 26, 0.9)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
        {/* Active Highlight Band */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
            backgroundColor: 'rgba(231, 165, 141, 0.12)',
            borderTop: '1px solid rgba(231, 165, 141, 0.4)',
            borderBottom: '1px solid rgba(231, 165, 141, 0.4)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />

        {/* Waveform Bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            zIndex: 2,
            gap: '2px'
          }}
        >
          {waveformBars.map((barHeight, idx) => {
            const barPercent = (idx / barCount) * 100;
            const isInside = barPercent >= startPercent && barPercent <= endPercent;
            const isPastPlayhead = isPlaying && barPercent <= playheadPercent;

            return (
              <span
                key={idx}
                style={{
                  flex: 1,
                  height: `${Math.round(barHeight * (height - 24))}px`,
                  borderRadius: '2px',
                  backgroundColor: isInside
                    ? isPastPlayhead
                      ? '#E7A58D'
                      : '#F4DFC9'
                    : '#1D2538',
                  opacity: isInside ? 0.95 : 0.45,
                  transition: 'background-color 0.2s ease, opacity 0.2s ease',
                  pointerEvents: 'none'
                }}
              />
            );
          })}
        </div>

        {/* Playhead indicator */}
        {currentTime > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${playheadPercent}%`,
              width: '2px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
              zIndex: 4,
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Start Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('start', e)}
          role="button"
          tabIndex={0}
          aria-label={`Start handle at ${formatTime(section.start)}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPercent}%`,
            width: '16px',
            transform: 'translateX(-50%)',
            zIndex: 5,
            cursor: 'ew-resize',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '4px',
              height: '100%',
              backgroundColor: 'var(--accent-warm)',
              borderRadius: '2px'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '6px',
              width: '12px',
              height: '18px',
              backgroundColor: 'var(--accent-cream)',
              borderRadius: '3px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              border: '1px solid #080B10'
            }}
          />
        </div>

        {/* End Handle */}
        <div
          onPointerDown={(e) => handlePointerDown('end', e)}
          role="button"
          tabIndex={0}
          aria-label={`End handle at ${formatTime(section.end)}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${endPercent}%`,
            width: '16px',
            transform: 'translateX(-50%)',
            zIndex: 5,
            cursor: 'ew-resize',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '4px',
              height: '100%',
              backgroundColor: 'var(--accent-warm)',
              borderRadius: '2px'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              width: '12px',
              height: '18px',
              backgroundColor: 'var(--accent-cream)',
              borderRadius: '3px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              border: '1px solid #080B10'
            }}
          />
        </div>
      </div>

      {/* Timestamp labels under waveform */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <span>00:00</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(231, 165, 141, 0.1)',
            padding: '2px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(231, 165, 141, 0.2)'
          }}
        >
          <span style={{ color: 'var(--accent-cream)', fontWeight: 600 }}>
            {formatTime(section.start)}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>—</span>
          <span style={{ color: 'var(--accent-cream)', fontWeight: 600 }}>
            {formatTime(section.end)}
          </span>
          <span style={{ color: 'var(--accent-warm)', fontSize: '0.74rem' }}>
            ({Math.round(section.end - section.start)}s moment)
          </span>
        </div>
        <span>{formatTime(song.duration)}</span>
      </div>
    </div>
  );
};
