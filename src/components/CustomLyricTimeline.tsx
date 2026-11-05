import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Clock,
  Sparkles
} from 'lucide-react';
import type { Song, TimedLyricLine } from '../types/music';
import type { CustomTimelineSelection } from '../types/share';
import { formatMomentTime } from '../services/share/shareMomentService';
import './CustomLyricTimeline.css';

interface CustomLyricTimelineProps {
  isOpen: boolean;
  song: Song | null;
  canonicalLines: TimedLyricLine[];
  initialStartSec: number;
  initialDurationSec: number;
  onClose: () => void;
  onUseSelection: (selection: CustomTimelineSelection) => void;
  audioElement?: HTMLAudioElement | null;
}

const PRESET_DURATIONS = [5, 10, 15, 20, 30] as const;

export const CustomLyricTimeline: React.FC<CustomLyricTimelineProps> = ({
  isOpen,
  song,
  canonicalLines,
  initialStartSec,
  initialDurationSec,
  onClose,
  onUseSelection,
  audioElement
}) => {
  const songDuration = useMemo(() => {
    return song?.duration && song.duration > 0 ? song.duration : 180;
  }, [song?.duration]);

  const [startSec, setStartSec] = useState<number>(() => Math.max(0, initialStartSec));
  const [endSec, setEndSec] = useState<number>(() =>
    Math.min(songDuration, initialStartSec + Math.max(5, initialDurationSec))
  );
  const [selectedLineIndices, setSelectedLineIndices] = useState<number[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);
  const startSecRef = useRef<number>(startSec);
  const endSecRef = useRef<number>(endSec);
  const isPlayingRef = useRef<boolean>(false);
  const fallbackClockRef = useRef<number>(0);
  const isManualLineOverrideRef = useRef<boolean>(false);

  // Keep refs synchronized
  useEffect(() => {
    startSecRef.current = startSec;
  }, [startSec]);

  useEffect(() => {
    endSecRef.current = endSec;
  }, [endSec]);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      isManualLineOverrideRef.current = false;
      const s = Math.max(0, initialStartSec);
      const e = Math.min(songDuration, s + Math.max(5, initialDurationSec));
      setStartSec(s);
      setEndSec(e);
      startSecRef.current = s;
      endSecRef.current = e;
      setIsPlayingPreview(false);
      isPlayingRef.current = false;
    }
  }, [isOpen, initialStartSec, initialDurationSec, songDuration]);

  // Calculate selected duration
  const selectedDuration = Math.max(1, Number((endSec - startSec).toFixed(1)));

  // Generate deterministic audio waveform bars
  const barCount = 72;
  const waveformBars = useMemo(() => {
    const bars: number[] = [];
    const seed = song?.id
      ? song.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : 55;
    for (let i = 0; i < barCount; i++) {
      const pos = i / barCount;
      const energy = 0.3 + 0.55 * Math.sin(pos * Math.PI) + 0.15 * Math.sin(pos * 6 * Math.PI);
      const rand = Math.sin(seed + i * 17.13) * 0.5 + 0.5;
      const h = Math.min(1, Math.max(0.18, energy * 0.72 + rand * 0.28));
      bars.push(h);
    }
    return bars;
  }, [song?.id, barCount]);

  // Synchronize lyric lines selection based on current [startSec, endSec] window
  useEffect(() => {
    if (canonicalLines.length === 0) return;
    if (isManualLineOverrideRef.current) return;
    const indices: number[] = [];
    for (let i = 0; i < canonicalLines.length; i++) {
      const l = canonicalLines[i];
      const s = l.startTime ?? l.time ?? 0;
      const e = l.endTime ?? (l.duration ? s + l.duration : s + 3.5);
      if (s < endSec && e > startSec) {
        indices.push(i);
      }
    }
    setSelectedLineIndices(indices);
  }, [startSec, endSec, canonicalLines]);

  // Stop playback on close or unmount
  const stopPlayback = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (audioElement) {
      audioElement.pause();
    }
    setIsPlayingPreview(false);
    isPlayingRef.current = false;
  }, [audioElement]);

  // Toggle preview of selected segment
  const handleTogglePreview = () => {
    if (isPlayingPreview) {
      stopPlayback();
    } else {
      const s = startSecRef.current;

      if (audioElement) {
        audioElement.currentTime = s;
        audioElement.playbackRate = 1.0;
        audioElement.preservesPitch = true;
        audioElement.play().catch((err) => console.warn('Preview play notice:', err));
      }
      fallbackClockRef.current = performance.now();
      setIsPlayingPreview(true);
      isPlayingRef.current = true;

      const loop = () => {
        if (!isPlayingRef.current) return;
        const curEnd = endSecRef.current;
        const curStart = startSecRef.current;

        let curTime: number;
        if (audioElement && !audioElement.paused && !audioElement.ended && isFinite(audioElement.currentTime)) {
          curTime = audioElement.currentTime;
        } else {
          const elapsed = (performance.now() - fallbackClockRef.current) / 1000;
          curTime = curStart + elapsed;
        }

        if (curTime >= curEnd) {
          // Loop back to start
          if (audioElement) {
            audioElement.currentTime = curStart;
            audioElement.play().catch(() => {});
          }
          fallbackClockRef.current = performance.now();
        }

        animRef.current = requestAnimationFrame(loop);
      };

      animRef.current = requestAnimationFrame(loop);
    }
  };

  // Close handler
  const handleClose = () => {
    stopPlayback();
    onClose();
  };

  // Apply selection handler
  const handleApplySelection = () => {
    stopPlayback();
    const dur = Math.max(1, Number((endSec - startSec).toFixed(1)));
    const cleanDur = [5, 10, 15, 20, 30].find((p) => Math.abs(p - dur) < 0.25) ?? dur;
    onUseSelection({
      startSec: Number(startSec.toFixed(1)),
      endSec: Number(endSec.toFixed(1)),
      durationSec: cleanDur,
      selectedLineIndices
    });
  };

  // Preset button handler
  const handleSelectPreset = (presetSec: number) => {
    isManualLineOverrideRef.current = false;
    let newEnd = Math.min(songDuration, startSec + presetSec);
    let newStart = startSec;
    if (newEnd - newStart < presetSec) {
      newStart = Math.max(0, newEnd - presetSec);
    }
    setStartSec(newStart);
    setEndSec(newEnd);
    startSecRef.current = newStart;
    endSecRef.current = newEnd;

    if (isPlayingPreview && audioElement) {
      audioElement.currentTime = newStart;
    }
  };

  // Toggle individual lyric line inclusion/exclusion
  const handleToggleLyricLine = (index: number) => {
    isManualLineOverrideRef.current = true;
    setSelectedLineIndices((prev) => {
      const isSelected = prev.includes(index);
      let next: number[];
      if (isSelected) {
        next = prev.filter((i) => i !== index);
      } else {
        next = [...prev, index].sort((a, b) => a - b);
      }

      if (next.length > 0) {
        const firstLine = canonicalLines[next[0]];
        const lastLine = canonicalLines[next[next.length - 1]];
        const newStart = firstLine.startTime ?? firstLine.time ?? 0;
        const lastStart = lastLine.startTime ?? lastLine.time ?? newStart;
        const lastEnd = lastLine.endTime ?? (lastLine.duration ? lastStart + lastLine.duration : lastStart + 3.5);
        const newEnd = Math.max(newStart + 1, Math.min(songDuration, lastEnd));

        setStartSec(newStart);
        setEndSec(newEnd);
        startSecRef.current = newStart;
        endSecRef.current = newEnd;

        if (isPlayingPreview && audioElement) {
          audioElement.currentTime = newStart;
        }
      }

      return next;
    });
  };

  // Handle pointer down on start/end handles
  const handlePointerDown = (type: 'start' | 'end', e: React.PointerEvent) => {
    isManualLineOverrideRef.current = false;
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setActiveDrag(type);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = Number((ratio * songDuration).toFixed(1));

    if (activeDrag === 'start') {
      const curEnd = endSecRef.current;
      const newStart = Math.max(0, Math.min(targetTime, curEnd - 1));
      setStartSec(newStart);
      startSecRef.current = newStart;
    } else if (activeDrag === 'end') {
      const curStart = startSecRef.current;
      const newEnd = Math.min(songDuration, Math.max(targetTime, curStart + 1));
      setEndSec(newEnd);
      endSecRef.current = newEnd;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setActiveDrag(null);
    }
  };

  // Window-level pointer tracking during drag for smooth touch and mouse tracking
  useEffect(() => {
    if (!activeDrag) return;
    const onMove = (e: PointerEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = Number((ratio * songDuration).toFixed(1));

      if (activeDrag === 'start') {
        const curEnd = endSecRef.current;
        const newStart = Math.max(0, Math.min(targetTime, curEnd - 1));
        setStartSec(newStart);
        startSecRef.current = newStart;
      } else if (activeDrag === 'end') {
        const curStart = startSecRef.current;
        const newEnd = Math.min(songDuration, Math.max(targetTime, curStart + 1));
        setEndSec(newEnd);
        endSecRef.current = newEnd;
      }
    };
    const onUp = () => {
      setActiveDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [activeDrag, songDuration]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))));
  };

  const handleResetRange = () => {
    isManualLineOverrideRef.current = false;
    setStartSec(0);
    setEndSec(Math.min(songDuration, 15));
    startSecRef.current = 0;
    endSecRef.current = Math.min(songDuration, 15);
  };

  if (!isOpen) return null;

  const startPercent = Math.max(0, Math.min(100, (startSec / songDuration) * 100));
  const endPercent = Math.max(0, Math.min(100, (endSec / songDuration) * 100));

  return (
    <div
      id="custom-lyric-timeline-modal"
      data-testid="custom-lyric-timeline-modal"
      className="custom-timeline-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Custom Lyric Timeline"
    >
      <div className="custom-timeline-container">
        {/* Header */}
        <header className="custom-timeline-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="var(--accent-warm, #E7A58D)" />
            <div>
              <h3 className="custom-timeline-title">Custom Lyric Timeline</h3>
              <p className="custom-timeline-subtitle">
                {song?.title || 'Selected Track'} • Precision Moment Selection
              </p>
            </div>
          </div>
          <button
            type="button"
            id="timeline-close-btn"
            data-testid="timeline-close-btn"
            className="timeline-icon-btn"
            onClick={handleClose}
            aria-label="Close Custom Timeline"
            title="Close"
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Main Area */}
        <div className="custom-timeline-scrollable">
          {/* Section 1: Stats & Readout Card */}
          <div className="timeline-stats-card">
            <div className="timeline-stat-item">
              <span className="timeline-stat-label">START TIME</span>
              <span
                id="timeline-start-time"
                data-testid="timeline-start-time"
                className="timeline-stat-val"
              >
                {formatMomentTime(startSec)}
              </span>
            </div>

            <div className="timeline-stat-divider" />

            <div className="timeline-stat-item highlight">
              <span className="timeline-stat-label">SELECTED DURATION</span>
              <span
                id="timeline-selected-duration"
                data-testid="timeline-selected-duration"
                className="timeline-stat-val accent"
              >
                {selectedDuration.toFixed(1)}s
              </span>
            </div>

            <div className="timeline-stat-divider" />

            <div className="timeline-stat-item">
              <span className="timeline-stat-label">END TIME</span>
              <span
                id="timeline-end-time"
                data-testid="timeline-end-time"
                className="timeline-stat-val"
              >
                {formatMomentTime(endSec)}
              </span>
            </div>
          </div>

          {/* Section 2: Duration Presets (5s, 10s, 15s, 20s, 30s) — Fits 320px without overflow */}
          <div className="timeline-section-wrap">
            <div className="timeline-section-label">
              <Clock size={13} color="var(--accent-warm, #E7A58D)" />
              <span>Duration Presets</span>
            </div>
            <div className="timeline-presets-row" role="radiogroup" aria-label="Duration Presets">
              {PRESET_DURATIONS.map((preset) => {
                const isActive = Math.round(selectedDuration) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    id={`preset-${preset}s`}
                    data-testid={`preset-${preset}s`}
                    role="radio"
                    aria-checked={isActive}
                    className={`timeline-preset-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <span>{preset}s</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Interactive Touch-Friendly Waveform Timeline */}
          <div className="timeline-section-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="timeline-section-label" style={{ margin: 0 }}>
                <Sparkles size={13} color="var(--accent-warm, #E7A58D)" />
                <span>Draggable Moment Window</span>
              </div>
              <div className="timeline-zoom-tools">
                <button
                  type="button"
                  id="timeline-zoom-out-btn"
                  data-testid="timeline-zoom-out-btn"
                  className="timeline-mini-tool-btn"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  aria-label="Zoom Out Timeline"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                  {zoom.toFixed(1)}x
                </span>
                <button
                  type="button"
                  id="timeline-zoom-in-btn"
                  data-testid="timeline-zoom-in-btn"
                  className="timeline-mini-tool-btn"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  aria-label="Zoom In Timeline"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  id="timeline-reset-btn"
                  data-testid="timeline-reset-btn"
                  className="timeline-mini-tool-btn"
                  onClick={handleResetRange}
                  aria-label="Reset Range"
                  title="Reset Range"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Scrollable Timeline Box */}
            <div
              ref={scrollWrapperRef}
              id="timeline-scroll-wrapper"
              className="timeline-scroll-wrapper"
            >
              <div
                ref={trackRef}
                id="timeline-track"
                data-testid="timeline-track"
                className="timeline-track"
                style={{ width: `${zoom * 100}%` }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Visual Waveform Bars */}
                <div className="timeline-waveform-canvas">
                  {waveformBars.map((barH, i) => {
                    const barPercent = (i / barCount) * 100;
                    const isInside = barPercent >= startPercent && barPercent <= endPercent;
                    return (
                      <div
                        key={i}
                        className={`timeline-wave-bar ${isInside ? 'active' : ''}`}
                        style={{ height: `${Math.round(barH * 100)}%` }}
                      />
                    );
                  })}
                </div>

                {/* Highlighted Selection Window */}
                <div
                  id="timeline-selection-region"
                  data-testid="timeline-selection-region"
                  className="timeline-selection-region"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(1, endPercent - startPercent)}%`
                  }}
                />

                {/* Draggable Start Handle (Minimum 44x44px touch target) */}
                <div
                  id="timeline-handle-start"
                  data-testid="timeline-handle-start"
                  role="slider"
                  aria-label="Moment Start Handle"
                  aria-valuenow={startSec}
                  aria-valuemin={0}
                  aria-valuemax={endSec - 1}
                  className={`timeline-handle start ${activeDrag === 'start' ? 'dragging' : ''}`}
                  style={{ left: `${startPercent}%` }}
                  onPointerDown={(e) => handlePointerDown('start', e)}
                >
                  <div className="timeline-handle-pill">
                    <div className="timeline-handle-grip" />
                  </div>
                  <span className="timeline-handle-tag start-tag">
                    {formatMomentTime(startSec)}
                  </span>
                </div>

                {/* Draggable End Handle (Minimum 44x44px touch target) */}
                <div
                  id="timeline-handle-end"
                  data-testid="timeline-handle-end"
                  role="slider"
                  aria-label="Moment End Handle"
                  aria-valuenow={endSec}
                  aria-valuemin={startSec + 1}
                  aria-valuemax={songDuration}
                  className={`timeline-handle end ${activeDrag === 'end' ? 'dragging' : ''}`}
                  style={{ left: `${endPercent}%` }}
                  onPointerDown={(e) => handlePointerDown('end', e)}
                >
                  <div className="timeline-handle-pill">
                    <div className="timeline-handle-grip" />
                  </div>
                  <span className="timeline-handle-tag end-tag">
                    {formatMomentTime(endSec)}
                  </span>
                </div>
              </div>
            </div>

            <div className="timeline-drag-hint">
              <span>Drag handles or tap lyric lines to adjust moment boundaries</span>
            </div>
          </div>

          {/* Section 4: Separate Vertically Scrollable Lyrics Section */}
          <div className="timeline-section-wrap" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="timeline-section-label" style={{ margin: 0 }}>
                <span>Lyric Lines ({canonicalLines.length})</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {selectedLineIndices.length} lines selected
              </span>
            </div>

            <div
              id="timeline-lyrics-scroller"
              data-testid="timeline-lyrics-scroller"
              className="timeline-lyrics-scroller"
              role="listbox"
              aria-label="Selectable Lyric Lines"
            >
              {canonicalLines.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                  No synchronized lyric lines found for this track. Use the audio timeline above to set your moment window.
                </div>
              ) : (
                canonicalLines.map((line, idx) => {
                  const s = line.startTime ?? line.time ?? 0;
                  const isSelected = selectedLineIndices.includes(idx);
                  return (
                    <button
                      key={line.id || idx}
                      type="button"
                      id={`timeline-lyric-${idx}`}
                      data-testid={`timeline-lyric-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`timeline-lyric-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleLyricLine(idx)}
                    >
                      {/* Checkbox indicator */}
                      <div className={`timeline-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={12} color="#080A0F" strokeWidth={3} />}
                      </div>

                      <span className="timeline-lyric-time">{formatMomentTime(s)}</span>

                      <span className="timeline-lyric-text">{line.text}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions Dock (One-handed ergonomics) */}
        <div id="timeline-sticky-dock" data-testid="timeline-sticky-dock" className="timeline-sticky-dock">
          <button
            type="button"
            id="timeline-preview-btn"
            data-testid="timeline-preview-btn"
            className="timeline-dock-preview-btn"
            onClick={handleTogglePreview}
            aria-label={isPlayingPreview ? 'Pause Moment Preview' : 'Preview Moment'}
          >
            {isPlayingPreview ? <Pause size={18} fill="#F4F0EB" /> : <Play size={18} fill="#F4F0EB" />}
            <span>{isPlayingPreview ? 'Pause' : 'Preview'}</span>
          </button>

          <button
            type="button"
            id="timeline-use-selection-btn"
            data-testid="timeline-use-selection-btn"
            className="timeline-dock-apply-btn"
            onClick={handleApplySelection}
            aria-label={`Use Selection of ${Math.round(selectedDuration)} seconds`}
          >
            <Check size={18} />
            <span>Use Selection ({Math.round(selectedDuration)}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
