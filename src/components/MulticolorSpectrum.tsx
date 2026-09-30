// Multicolor Audio Spectrum for NARO
// Replaces the single dot indicator with an organic, multi-bar animated spectrum
// Colors: Warm Coral (#E7A58D), Cream (#F4DFC9), Blue (#8FA8C8), Purple (#A78BFA), Soft Gold (#FCD34D)

import React, { useEffect, useRef, useState } from 'react';
import { playbackService } from '../services/audio/playbackService';

interface MulticolorSpectrumProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const MulticolorSpectrum: React.FC<MulticolorSpectrumProps> = ({
  isPlaying,
  barCount = 9,
  height = 24,
  barWidth = 3,
  gap = 3,
  className,
  style
}) => {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: barCount }, (_, i) => 0.2 + 0.15 * Math.sin(i))
  );
  const rafRef = useRef<number | null>(null);

  // Harmonious curated palette
  const colors = [
    '#E7A58D', // Warm Coral
    '#F4DFC9', // Cream
    '#8FA8C8', // Studio Blue
    '#A78BFA', // Intimate Purple
    '#FCD34D', // Soft Gold
    '#E7A58D',
    '#F4DFC9',
    '#8FA8C8',
    '#A78BFA',
    '#FCD34D'
  ];

  useEffect(() => {
    let phase = 0;

    const update = () => {
      const freqData = playbackService.getVisualizerData();

      if (freqData && isPlaying) {
        // Map actual frequency bins to bars
        const step = Math.floor(freqData.length / barCount);
        const nextLevels = Array.from({ length: barCount }, (_, i) => {
          const val = freqData[i * step] || 0;
          return Math.max(0.15, Math.min(1, val / 255));
        });
        setLevels(nextLevels);
      } else if (isPlaying) {
        // Organic undulating mathematical envelope when stream CORS restricts raw Analyser
        phase += 0.08;
        const nextLevels = Array.from({ length: barCount }, (_, i) => {
          const base = 0.35 + 0.3 * Math.sin(phase + i * 0.7);
          const harmonic = 0.2 * Math.cos(phase * 1.5 + i * 0.4);
          return Math.max(0.15, Math.min(1, base + harmonic));
        });
        setLevels(nextLevels);
      } else {
        // Rest state when paused: gentle ambient presence
        const restingLevels = Array.from({ length: barCount }, (_, i) => {
          return 0.18 + 0.12 * Math.sin(i * 0.8);
        });
        setLevels(restingLevels);
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, barCount]);

  return (
    <div
      className={className}
      role="img"
      aria-label={isPlaying ? 'Audio playing spectrum visualizer' : 'Audio paused'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${gap}px`,
        height: `${height}px`,
        ...style
      }}
    >
      {levels.map((lvl, index) => {
        const color = colors[index % colors.length];
        const barHeight = Math.max(3, lvl * height);

        return (
          <span
            key={index}
            style={{
              display: 'block',
              width: `${barWidth}px`,
              height: `${barHeight}px`,
              borderRadius: '2px',
              backgroundColor: color,
              opacity: isPlaying ? 0.9 : 0.45,
              transition: isPlaying ? 'height 0.08s ease' : 'height 0.3s ease, opacity 0.3s ease',
              boxShadow: isPlaying ? `0 0 6px ${color}33` : 'none'
            }}
          />
        );
      })}
    </div>
  );
};
