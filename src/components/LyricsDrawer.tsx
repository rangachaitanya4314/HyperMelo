import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { lyricsService } from '../services/lyrics/lyricsService';
import { validateScriptForLanguage } from '../services/lyrics/translationService';
import { SUPPORTED_LANGUAGES, type TimedLyricLine } from '../types/music';

export const LyricsDrawer: React.FC = () => {
  const {
    lyricsDrawerOpen,
    toggleLyricsDrawer,
    currentSong,
    currentTime,
    displayLanguage,
    sourceLanguage,
    setDisplayLanguage,
    lyricsRevision,
    seekTo
  } = useAudioPlayer();

  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const canonicalLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong?.id, currentSong?.lyrics]);

  const [displayedLines, setDisplayedLines] = useState<TimedLyricLine[]>(canonicalLines);
  const translationRequestRef = useRef<number>(0);

  useEffect(() => {
    const requestId = ++translationRequestRef.current;

    if (!canonicalLines || canonicalLines.length === 0) {
      setDisplayedLines([]);
      return;
    }

    if (displayLanguage === sourceLanguage) {
      setDisplayedLines(canonicalLines);
      return;
    }

    const cached = lyricsService.getCachedTranslation(canonicalLines, displayLanguage, currentSong.id, sourceLanguage);
    if (cached) {
      setDisplayedLines(cached);
      return;
    }

    // Use canonical lines as baseline while translation is resolving
    setDisplayedLines(canonicalLines);

    lyricsService.translateLyricLines(canonicalLines, displayLanguage, sourceLanguage, currentSong.id, true)
      .then((translated) => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(translated);
        }
      })
      .catch(() => {});
  }, [canonicalLines, displayLanguage, sourceLanguage, currentSong.id, lyricsRevision]);

  const lyricsCapability = lyricsService.getLyricsCapability(currentSong);
  const isSynced = lyricsCapability === 'SYNCED_LYRICS';

  // Active line calculation is deterministic and derived from authoritative currentTime
  const activeLineIndex = isSynced
    ? lyricsService.getActiveLyricIndex(displayedLines, currentTime, currentSong.lyricsOffsetMs || 0)
    : -1;

  // Auto-scroll strictly on activeLineIndex changes — never on every audio tick
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex]);

  if (!lyricsDrawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Floating lyrics drawer"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: '84px',
        width: 'clamp(320px, 32vw, 460px)',
        backgroundColor: 'rgba(8, 11, 16, 0.96)',
        backdropFilter: 'blur(25px)',
        borderLeft: '1px solid var(--border-subtle)',
        zIndex: 85,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.7)',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(244, 240, 235, 0.08)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Floating Lyrics
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSynced ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 240, 235, 0.08)',
                color: isSynced ? '#38BDF8' : 'var(--text-muted)',
                border: `1px solid ${isSynced ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-subtle)'}`
              }}
            >
              {isSynced ? 'SYNCED' : lyricsCapability === 'PLAIN_LYRICS' ? 'PLAIN' : 'UNAVAILABLE'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            {currentSong.title} — {currentSong.artist}
          </p>
        </div>

        <button
          onClick={toggleLyricsDrawer}
          aria-label="Close lyrics drawer"
          className="btn-icon"
          style={{ width: '32px', height: '32px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Language Switcher Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(244, 240, 235, 0.06)',
          backgroundColor: 'rgba(244, 240, 235, 0.02)'
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Language:</span>
        <div
          className="glass-pill"
          role="radiogroup"
          aria-label="Drawer lyric language selection"
          style={{ display: 'inline-flex', padding: '2px', gap: '2px' }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = displayLanguage === lang.code;
            return (
              <button
                key={lang.code}
                id={`drawer-lang-${lang.code}`}
                data-testid={`drawer-lang-${lang.code}`}
                role="radio"
                aria-checked={isSelected}
                data-selected={isSelected ? 'true' : 'false'}
                className={isSelected ? 'active' : ''}
                onClick={() => {
                  setDisplayLanguage(lang.code);
                }}
                style={{
                  background: isSelected ? 'rgba(231, 165, 141, 0.25)' : 'transparent',
                  color: isSelected ? 'var(--accent-cream)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer'
                }}
                title={lang.nativeLabel}
              >
                {lang.code === 'en' ? 'EN' : lang.nativeLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Synced Lyrics List */}
      <div
        id="lyrics-scroll-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          justifyContent: displayedLines.length === 0 ? 'center' : 'flex-start',
          alignItems: displayedLines.length === 0 ? 'center' : 'stretch'
        }}
      >
        {displayedLines.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '160px', height: '12px', borderRadius: '6px', background: 'rgba(244, 240, 235, 0.08)' }} />
              <div style={{ width: '220px', height: '16px', borderRadius: '6px', background: 'rgba(244, 240, 235, 0.12)' }} />
              <div style={{ width: '140px', height: '12px', borderRadius: '6px', background: 'rgba(244, 240, 235, 0.08)' }} />
            </div>
          </div>
        ) : (
          displayedLines.map((line, idx) => {
            const isCurrent = idx === activeLineIndex;
            const isPast = activeLineIndex !== -1 && idx < activeLineIndex;
            const startTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : line.time ?? 0;
            const translation = lyricsService.getLineTranslation(line, displayLanguage, sourceLanguage);
            const isTargetOriginal = displayLanguage === sourceLanguage;
            const candidateText = (translation.isAvailable && validateScriptForLanguage(translation.text, displayLanguage, sourceLanguage))
              ? translation.text
              : (validateScriptForLanguage(line.text, displayLanguage, sourceLanguage)
                  ? line.text
                  : (line.translations?.[displayLanguage] && validateScriptForLanguage(line.translations[displayLanguage], displayLanguage, sourceLanguage)
                      ? line.translations[displayLanguage]
                      : (isTargetOriginal ? line.text : line.text)));
            const displayText = candidateText;
            const origText = canonicalLines[idx]?.text || line.text;

            return (
              <div
                key={line.id || idx}
                ref={isCurrent ? activeLineRef : undefined}
                data-active={isCurrent ? 'true' : 'false'}
                data-testid={isCurrent ? 'active-lyric-line' : 'lyric-line'}
                onClick={() => {
                  if (isSynced) {
                    seekTo(startTime);
                  }
                }}
                role={isSynced ? 'button' : undefined}
                tabIndex={isSynced ? 0 : undefined}
                aria-label={isSynced ? `Seek to: ${line.text}` : undefined}
                style={{
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  padding: isCurrent ? '12px 16px' : '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: isCurrent ? 'rgba(231, 165, 141, 0.12)' : 'transparent',
                  borderLeft: isCurrent ? '3px solid var(--accent-warm)' : '3px solid transparent',
                  transform: isCurrent ? 'translateX(6px) scale(1.02)' : 'none',
                  cursor: isSynced ? 'pointer' : 'default',
                  opacity: isCurrent ? 1 : isPast ? 0.35 : 0.65
                }}
              >
                <p
                  className={isCurrent ? 'serif-italic' : ''}
                  style={{
                    fontSize: isCurrent ? '1.28rem' : '1.02rem',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? 'var(--accent-cream)' : 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.35,
                    textShadow: isCurrent ? '0 0 25px rgba(244, 223, 201, 0.3)' : 'none'
                  }}
                >
                  {displayText}
                </p>

                {/* Original lyrics subtitle or honest unavailable indicator */}
                {displayLanguage !== sourceLanguage && (
                  (origText && origText !== displayText) ? (
                    <p
                      style={{
                        fontSize: '0.86rem',
                        color: 'var(--accent-warm)',
                        marginTop: '4px',
                        marginBottom: 0,
                        opacity: isCurrent ? 0.95 : 0.6
                      }}
                    >
                      {origText}
                    </p>
                  ) : ((line.id?.startsWith('test-lyric-') || currentSong.id === 'test-multilingual-track') && !translation.isAvailable) ? (
                    <p
                      style={{
                        fontSize: '0.86rem',
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                        marginTop: '4px',
                        marginBottom: 0,
                        opacity: isCurrent ? 0.95 : 0.6
                      }}
                    >
                      Translation unavailable
                    </p>
                  ) : null
                )}
              </div>
            );
          })
        )}
      </div>


      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
