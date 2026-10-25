import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, RotateCw, Loader2, AlertCircle } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { lyricsService, measureLinePace, getPaceTransition } from '../services/lyrics/lyricsService';
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
    seekTo,
    lyricsResolution,
    isResolvingLyrics,
    retryLyricsResolution
  } = useAudioPlayer();

  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const canonicalLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong?.id, currentSong?.lyrics, lyricsRevision]);

  const [displayedLines, setDisplayedLines] = useState<TimedLyricLine[]>(canonicalLines);
  const prevTrackRef = useRef<{ id?: string; rev?: number; count?: number }>({
    id: currentSong?.id,
    rev: lyricsRevision,
    count: canonicalLines.length
  });
  if (
    currentSong?.id !== prevTrackRef.current.id ||
    lyricsRevision !== prevTrackRef.current.rev ||
    canonicalLines.length !== prevTrackRef.current.count
  ) {
    prevTrackRef.current = { id: currentSong?.id, rev: lyricsRevision, count: canonicalLines.length };
    setDisplayedLines(canonicalLines);
  }
  const translationRequestRef = useRef<number>(0);

  useEffect(() => {
    const requestId = ++translationRequestRef.current;

    if (!currentSong || !canonicalLines || canonicalLines.length === 0) {
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
  }, [canonicalLines, displayLanguage, sourceLanguage, currentSong?.id, lyricsRevision]);

  const lyricsCapability = lyricsService.getLyricsCapability(currentSong);
  const isSynced = lyricsCapability === 'SYNCED_LYRICS';

  // Active line calculation is deterministic and derived from authoritative currentTime
  const activeLineIndex = (isSynced && currentSong)
    ? lyricsService.getActiveLyricIndex(displayedLines, currentTime, currentSong.lyricsOffsetMs || 0)
    : -1;

  // Auto-scroll strictly on activeLineIndex changes — never on every audio tick (respects prefers-reduced-motion)
  useEffect(() => {
    if (activeLineRef.current) {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeLineRef.current.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'center'
      });
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
              id="drawer-lyrics-capability-badge"
              data-testid="drawer-lyrics-capability-badge"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                  ? 'rgba(245, 158, 11, 0.15)'
                  : isSynced
                    ? 'rgba(56, 189, 248, 0.15)'
                    : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                      ? 'rgba(244, 240, 235, 0.08)'
                      : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                        ? 'rgba(234, 179, 8, 0.15)'
                        : 'rgba(239, 68, 68, 0.12)',
                color: (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                  ? '#F59E0B'
                  : isSynced
                    ? '#38BDF8'
                    : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                      ? 'var(--text-muted)'
                      : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                        ? '#EAB308'
                        : '#F87171',
                border: `1px solid ${(isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                    ? 'rgba(245, 158, 11, 0.3)'
                    : isSynced
                      ? 'rgba(56, 189, 248, 0.3)'
                      : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                        ? 'var(--border-subtle)'
                        : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                          ? 'rgba(234, 179, 8, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'
                }`
              }}
              data-capability={lyricsCapability}
              data-outcome={lyricsResolution?.outcome || (isSynced ? 'SYNCED_VERIFIED' : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS') ? 'PLAIN_VERIFIED' : 'UNAVAILABLE')}
            >
              {(isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                ? 'SEARCHING...'
                : isSynced
                  ? 'SYNCED'
                  : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                    ? 'LYRICS'
                    : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                      ? 'RETRYABLE'
                      : 'NO LYRICS FOUND'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'No track selected'}
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
          (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING') ? (
            <div
              id="drawer-lyrics-loading"
              data-testid="drawer-lyrics-loading"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
                padding: '32px 16px',
                margin: 'auto',
                textAlign: 'center'
              }}
            >
              <Loader2 size={22} className="animate-spin" color="var(--accent-warm)" />
              <span style={{ fontSize: '0.84rem' }}>
                Resolving canonical lyrics for "{currentSong?.title}"...
              </span>
            </div>
          ) : lyricsResolution?.outcome === 'TRANSIENT_FAILURE' ? (
            <div
              id="drawer-lyrics-error"
              data-testid="drawer-lyrics-error"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
                padding: '32px 16px',
                margin: 'auto',
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCD34D' }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: '0.82rem' }}>
                  {lyricsResolution?.errorReason || lyricsResolution?.error || 'Temporary issue contacting lyrics providers'}
                </span>
              </div>
              <button
                type="button"
                id="drawer-retry-lyrics-btn"
                data-testid="drawer-retry-lyrics-btn"
                onClick={() => retryLyricsResolution()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(231, 165, 141, 0.15)',
                  border: '1px solid rgba(231, 165, 141, 0.35)',
                  color: 'var(--accent-cream)',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                <RotateCw size={12} />
                <span>Retry Search</span>
              </button>
            </div>
          ) : (
            <div
              id="drawer-no-lyrics"
              data-testid="drawer-no-lyrics"
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                padding: '32px 16px',
                margin: 'auto'
              }}
            >
              <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', color: 'var(--text-dim)' }}>
                No lyrics found in catalogue for "{currentSong?.title}"
              </p>
              <span style={{ fontSize: '0.74rem' }}>
                Verified across available catalogue and external sources
              </span>
            </div>
          )
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

            const lineEnd = line.endTime !== undefined && line.endTime > startTime
              ? line.endTime
              : (line.duration !== undefined && line.duration > 0 ? startTime + line.duration : startTime + 3.0);
            const pace = line.pace !== undefined
              ? line.pace
              : measureLinePace({ text: displayText, startTime, endTime: lineEnd }, displayLanguage);
            const paceTransition = getPaceTransition(pace);

            return (
              <div
                key={line.id || idx}
                ref={isCurrent ? activeLineRef : undefined}
                data-active={isCurrent ? 'true' : 'false'}
                data-testid={isCurrent ? 'active-lyric-line' : 'lyric-line'}
                data-pace={pace}
                data-pace-category={paceTransition.category}
                onClick={() => {
                  if (isSynced) {
                    seekTo(startTime);
                  }
                }}
                onKeyDown={(e) => {
                  if (isSynced && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    seekTo(startTime);
                  }
                }}
                role={isSynced ? 'button' : undefined}
                tabIndex={isSynced ? 0 : undefined}
                aria-label={isSynced ? `Seek to: ${line.text}` : undefined}
                style={{
                  transition: isCurrent ? paceTransition.transitionCss : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
                    lineHeight: 1.5,
                    overflowWrap: 'break-word',
                    fontFamily: 'inherit, "Noto Sans Devanagari", "Noto Sans Telugu", "Noto Sans Tamil", "Noto Sans Malayalam", sans-serif',
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
                  ) : ((line.id?.startsWith('test-lyric-') || currentSong?.id === 'test-multilingual-track') && !translation.isAvailable) ? (
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
