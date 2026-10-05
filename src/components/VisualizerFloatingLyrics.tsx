import React, { useEffect, useState, useRef } from 'react';
import type { Song, Language } from '../shared';
import { selectVisualizerFloatingLyrics, type FloatingLyricItem } from '../services/lyrics/floatingLyricsSelector';

interface VisualizerFloatingLyricsProps {
  song: Song | null | undefined;
  currentTime: number;
  displayLanguage?: Language;
  onSeek?: (time: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface FloatingBubbleProps {
  id: string;
  item: FloatingLyricItem | null;
  positionClass: string;
  style?: React.CSSProperties;
  onSeek?: (time: number) => void;
  accentColor: string;
}

const FloatingBubble: React.FC<FloatingBubbleProps> = ({
  id,
  item,
  positionClass,
  style,
  onSeek,
  accentColor
}) => {
  const [displayedItem, setDisplayedItem] = useState<FloatingLyricItem | null>(item);
  const [isVisible, setIsVisible] = useState<boolean>(!!item);
  const prevTextRef = useRef<string | null>(item?.text || null);

  useEffect(() => {
    const nextText = item?.text || null;
    if (nextText === prevTextRef.current) return;

    prevTextRef.current = nextText;

    if (!item) {
      setIsVisible(false);
      const timer = setTimeout(() => setDisplayedItem(null), 350);
      return () => clearTimeout(timer);
    }

    // Smooth cross-fade transition on line change
    setIsVisible(false);
    const timer = setTimeout(() => {
      setDisplayedItem(item);
      setIsVisible(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [item?.text, item?.tag]);

  if (!displayedItem) return null;

  const canSeek = displayedItem.startTime !== undefined && typeof onSeek === 'function';

  return (
    <div
      id={id}
      className={`floating-lyric-bubble ${positionClass}`}
      onClick={(e) => {
        if (canSeek && displayedItem.startTime !== undefined) {
          e.stopPropagation();
          onSeek(displayedItem.startTime);
        }
      }}
      role={canSeek ? 'button' : undefined}
      tabIndex={canSeek ? 0 : undefined}
      title={canSeek ? `Jump to ${displayedItem.text}` : displayedItem.text}
      style={{
        position: 'absolute',
        zIndex: 5,
        maxWidth: '220px',
        padding: '8px 14px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.76)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(244, 240, 235, 0.12)',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.55), 0 0 20px rgba(0, 0, 0, 0.3)',
        pointerEvents: canSeek ? 'auto' : 'none',
        cursor: canSeek ? 'pointer' : 'default',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease',
        ...style
      }}
    >
      {/* Category / Position Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          marginBottom: '3px'
        }}
      >
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
            display: 'inline-block'
          }}
        />
        <span
          style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: accentColor,
            fontFamily: 'monospace'
          }}
        >
          {displayedItem.tag}
        </span>
      </div>

      {/* Lyric / Metadata Text */}
      <p
        style={{
          margin: 0,
          fontSize: 'clamp(0.74rem, 1.4vw, 0.86rem)',
          fontWeight: 500,
          color: 'var(--text-primary, #F8FAFC)',
          lineHeight: 1.35,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)'
        }}
      >
        {displayedItem.text}
      </p>
    </div>
  );
};

export const VisualizerFloatingLyrics: React.FC<VisualizerFloatingLyricsProps> = ({
  song,
  currentTime,
  displayLanguage = 'en',
  onSeek,
  className = '',
  style = {}
}) => {
  const lyricsState = selectVisualizerFloatingLyrics(song, currentTime, displayLanguage);

  return (
    <div
      id="visualizer-floating-lyrics-container"
      className={`visualizer-floating-lyrics ${className}`}
      aria-hidden="false"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'visible',
        ...style
      }}
    >
      {/* Top Left: Previous or Upcoming Memorable Line */}
      <FloatingBubble
        id="floating-lyric-top-left"
        item={lyricsState.topLeft}
        positionClass="floating-lyric-top-left"
        onSeek={onSeek}
        accentColor="var(--accent-warm, #E7A58D)"
        style={{
          top: '2%',
          left: '-8%'
        }}
      />

      {/* Right: Memorable Upcoming Line */}
      <FloatingBubble
        id="floating-lyric-right"
        item={lyricsState.right}
        positionClass="floating-lyric-right"
        onSeek={onSeek}
        accentColor="var(--accent-cool, #8FA8C8)"
        style={{
          top: '32%',
          right: '-10%'
        }}
      />

      {/* Bottom: Short Emotional Phrase / Chorus Snippet */}
      <FloatingBubble
        id="floating-lyric-bottom"
        item={lyricsState.bottom}
        positionClass="floating-lyric-bottom"
        onSeek={onSeek}
        accentColor="var(--accent-cream, #F4DFC9)"
        style={{
          bottom: '-6%',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '260px',
          textAlign: 'center'
        }}
      />

      <style>{`
        @keyframes subtleFloatA {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes subtleFloatB {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(4px); }
        }
        @keyframes subtleFloatC {
          0%, 100% { transform: translate(-50%, 0px); }
          50% { transform: translate(-50%, -3px); }
        }

        .floating-lyric-top-left {
          animation: subtleFloatA 5.5s ease-in-out infinite;
        }
        .floating-lyric-right {
          animation: subtleFloatB 6.2s ease-in-out infinite;
        }
        .floating-lyric-bottom {
          animation: subtleFloatC 5.8s ease-in-out infinite;
        }

        .floating-lyric-bubble:hover {
          border-color: rgba(244, 240, 235, 0.28) !important;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7), 0 0 25px rgba(231, 165, 141, 0.15) !important;
        }

        @media (max-width: 640px) {
          .floating-lyric-top-left {
            top: -4% !important;
            left: 2% !important;
            max-width: 160px !important;
            padding: 6px 10px !important;
          }
          .floating-lyric-right {
            top: auto !important;
            bottom: 12% !important;
            right: 2% !important;
            max-width: 160px !important;
            padding: 6px 10px !important;
          }
          .floating-lyric-bottom {
            bottom: -3% !important;
            max-width: 200px !important;
            padding: 6px 10px !important;
          }
        }
      `}</style>
    </div>
  );
};
