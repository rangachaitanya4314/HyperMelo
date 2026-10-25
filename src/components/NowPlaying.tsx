import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  CloudRain,
  Sun,
  Moon,
  Plus,
  Sliders,
  ChevronDown,
  RotateCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { lyricsService, measureLinePace, getPaceTransition } from '../services/lyrics/lyricsService';
import { getListeningLyricDisplay } from '../shared/lyrics';
import { getConsumerLicenseLabel } from '../shared';
import type { Song, TimedLyricLine } from '../types/music';
import { SUPPORTED_LANGUAGES } from '../types/music';
import './NowPlaying.css';

export type AtmosphereMood = 'romance' | 'sad' | 'solaris' | 'midnight';

/**
 * Deterministically detect atmospheric mood from song metadata without fabrication.
 */
function getSongMood(song: Song | null): AtmosphereMood {
  if (!song) return 'midnight';
  const combined = `${song.genre || ''} ${song.title || ''} ${song.artwork?.pattern || ''}`.toLowerCase();
  if (
    combined.includes('sad') ||
    combined.includes('rain') ||
    combined.includes('melancholy') ||
    combined.includes('heartbreak') ||
    combined.includes('grief')
  ) {
    return 'sad';
  }
  if (
    combined.includes('romance') ||
    combined.includes('love') ||
    (combined.includes('heart') && !combined.includes('heartbreak')) ||
    combined.includes('romantic')
  ) {
    return 'romance';
  }
  if (
    combined.includes('solaris') ||
    combined.includes('acoustic') ||
    combined.includes('folk') ||
    combined.includes('indie rock') ||
    song.artwork?.pattern === 'solaris'
  ) {
    return 'solaris';
  }
  return 'midnight';
}

export const NowPlaying: React.FC = () => {
  const {
    nowPlayingOpen,
    closeNowPlaying,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    seekTo,
    togglePlay,
    nextSong,
    prevSong,
    volume,
    setVolume,
    isLoopingSection,
    setIsLoopingSection,
    sourceLanguage,
    setDisplayLanguage,
    listeningMeaningLanguage,
    setListeningMeaningLanguage,
    lyricsRevision,
    soundMode,
    soundPreset,
    bassIntensity,
    isDspSupported,
    activeDspDescription,
    setSoundMode,
    setSoundPreset,
    setBassIntensity,
    toggleLikeSong,
    isSongLiked,
    openAddToPlaylist,
    setCurrentView,
    lyricsResolution,
    isResolvingLyrics,
    retryLyricsResolution
  } = useAudioPlayer();

  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Atmospheric Mood
  const mood = useMemo(() => getSongMood(currentSong), [currentSong]);

  // Truthful Lyrics Capability
  const lyricsCapability = useMemo(
    () => lyricsService.getLyricsCapability(currentSong),
    [currentSong, lyricsRevision]
  );
  const isSynced = lyricsCapability === 'SYNCED_LYRICS';

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const canonicalLyricLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong, lyricsRevision]);

  // State to expand / collapse the Audiophile Sound Engine panel (collapsed by default)
  const [isAudiophileExpanded, setIsAudiophileExpanded] = useState<boolean>(false);

  // Displayed lines state - initialized with canonical lines and reset immediately on track switch, revision update, or line resolution
  const [displayedLines, setDisplayedLines] = useState<TimedLyricLine[]>(canonicalLyricLines);
  const prevTrackRef = useRef<{ id?: string; rev?: number; count?: number }>({
    id: currentSong?.id,
    rev: lyricsRevision,
    count: canonicalLyricLines.length
  });
  if (
    currentSong?.id !== prevTrackRef.current.id ||
    lyricsRevision !== prevTrackRef.current.rev ||
    canonicalLyricLines.length !== prevTrackRef.current.count
  ) {
    prevTrackRef.current = { id: currentSong?.id, rev: lyricsRevision, count: canonicalLyricLines.length };
    setDisplayedLines(canonicalLyricLines);
  }
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const translationRequestRef = useRef<number>(0);

  // Synchronize displayedLines for listening meaning without altering canonical primary lyrics
  useEffect(() => {
    const requestId = ++translationRequestRef.current;

    if (!currentSong || !canonicalLyricLines || canonicalLyricLines.length === 0) {
      setDisplayedLines([]);
      setIsTranslating(false);
      return;
    }

    const songOrig = (currentSong.originalLanguage || (currentSong as any).original_language || sourceLanguage || 'en') as string;

    // 1. If listening meaning language is the song's original language, canonical lines are already complete
    if (listeningMeaningLanguage === songOrig) {
      setDisplayedLines(canonicalLyricLines);
      setIsTranslating(false);
      return;
    }

    // 2. If canonical lines already have listening meaning or translation for this language, use canonical directly
    const hasMeaningOnLines = canonicalLyricLines.some(
      (l) => Boolean(l.listening_meaning?.[listeningMeaningLanguage] || l.translations?.[listeningMeaningLanguage])
    );
    if (hasMeaningOnLines) {
      setDisplayedLines(canonicalLyricLines);
      setIsTranslating(false);
      return;
    }

    // 3. Check synchronous cache
    const cached = lyricsService.getCachedTranslation(canonicalLyricLines, listeningMeaningLanguage, currentSong.id, songOrig);
    if (cached) {
      setDisplayedLines(cached);
      setIsTranslating(false);
      return;
    }

    // 4. Otherwise fetch translation asynchronously to enrich secondary meaning track
    setIsTranslating(true);
    lyricsService.translateLyricLines(canonicalLyricLines, listeningMeaningLanguage, songOrig, currentSong.id, true)
      .then((translated) => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(translated);
          setIsTranslating(false);
        }
      })
      .catch(() => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(canonicalLyricLines);
          setIsTranslating(false);
        }
      });
  }, [canonicalLyricLines, listeningMeaningLanguage, sourceLanguage, currentSong, lyricsRevision]);

  const hasLyrics = displayedLines.length > 0 && lyricsCapability !== 'LYRICS_UNAVAILABLE';

  // Active lyric index strictly derived from authoritative currentTime
  const activeLyricIndex = useMemo(() => {
    if (!hasLyrics || !isSynced || !currentSong) return -1;
    return lyricsService.getActiveLyricIndex(displayedLines, currentTime, currentSong.lyricsOffsetMs || 0);
  }, [hasLyrics, isSynced, displayedLines, currentTime, currentSong]);

  // Smooth scroll active lyric into view (respects prefers-reduced-motion)
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeLyricRef.current.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  }, [activeLyricIndex]);

  const isPopStateClosingRef = useRef<boolean>(false);

  // Reliable, universal exit mechanism: Closes expanded Now Playing, exits browser fullscreen if active, cleanly handles browser history
  const handleExit = React.useCallback(() => {
    // 1. Exit native browser fullscreen if active
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // 2. Immediately close Now Playing overlay
    closeNowPlaying();

    // 3. Clean up history entry without creating navigation loops
    if (typeof window !== 'undefined' && window.history.state?.naroNowPlaying && !isPopStateClosingRef.current) {
      isPopStateClosingRef.current = true;
      window.history.back();
      setTimeout(() => {
        isPopStateClosingRef.current = false;
      }, 100);
    }
  }, [closeNowPlaying]);

  // Synchronize with mobile browser back gesture / browser back button
  useEffect(() => {
    if (!nowPlayingOpen) return;

    // Push history state if not already pushed
    if (typeof window !== 'undefined' && !window.history.state?.naroNowPlaying) {
      window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
    }

    const handlePopState = () => {
      isPopStateClosingRef.current = true;
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      closeNowPlaying();
      setTimeout(() => {
        isPopStateClosingRef.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [nowPlayingOpen, closeNowPlaying]);

  // Keyboard accessibility: Escape to exit expanded Now Playing, Space to toggle play
  useEffect(() => {
    if (!nowPlayingOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      } else if (
        e.key === ' ' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nowPlayingOpen, handleExit, togglePlay]);

  // Lock background document scroll while Now Playing overlay is active
  useEffect(() => {
    if (!nowPlayingOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [nowPlayingOpen]);

  if (!nowPlayingOpen) return null;

  if (!currentSong) {
    return (
      <div
        id="naro-now-playing"
        data-testid="naro-now-playing"
        role="dialog"
        aria-label="Now Playing"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          backgroundColor: '#080B10',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <button
          id="minimize-now-playing-btn"
          data-testid="minimize-now-playing-btn"
          data-close-now-playing="true"
          onClick={handleExit}
          aria-label="Close full screen player"
          className="now-playing-minimize-btn"
          title="Close full screen player (Esc)"
          style={{ position: 'absolute', top: '16px', left: '16px' }}
        >
          <ChevronLeft size={24} />
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '16px' }}>
          No track currently selected.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={handleExit}
          style={{ padding: '8px 24px' }}
        >
          Back to catalog
        </button>
      </div>
    );
  }

  const effectiveDuration = duration > 0 ? duration : currentSong.duration || 180;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 0.8);
    }
  };

  return (
    <div
      id="naro-now-playing"
      data-testid="naro-now-playing"
      role="dialog"
      aria-label={`Now Playing: ${currentSong.title}`}
    >
      {/* =========================================================================
          EMOTIONAL ATMOSPHERE BACKDROP
          Cinematic, restrained visual languages for each mood
          ========================================================================= */}
      <div
        id="now-playing-atmosphere"
        data-mood={mood}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          transition: 'background 0.8s ease'
        }}
      >
        {/* Mood-Specific Layering */}
        {mood === 'romance' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 50% 25%, rgba(225, 29, 72, 0.20) 0%, rgba(245, 158, 11, 0.12) 35%, rgba(7, 9, 14, 0.98) 80%)'
            }}
          >
            {/* Restrained Heart-Inspired Warm Radiance Elements */}
            <div
              className="animate-heart-glow"
              style={{
                position: 'absolute',
                top: '18%',
                left: '28%',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(225, 29, 72, 0.25) 0%, transparent 70%)',
                filter: 'blur(45px)'
              }}
            />
            <div
              className="animate-heart-glow"
              style={{
                position: 'absolute',
                top: '22%',
                right: '25%',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
                filter: 'blur(55px)',
                animationDelay: '2.5s'
              }}
            />
          </div>
        )}

        {mood === 'sad' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 20%, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.75) 45%, rgba(6, 8, 12, 0.98) 85%)'
            }}
          >
            {/* Restrained Night Rain Streaks */}
            <div
              className="animate-rain-1"
              style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                width: '1px',
                height: '140px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.35), transparent)'
              }}
            />
            <div
              className="animate-rain-2"
              style={{
                position: 'absolute',
                top: 0,
                left: '45%',
                width: '1px',
                height: '180px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.45), transparent)'
              }}
            />
            <div
              className="animate-rain-3"
              style={{
                position: 'absolute',
                top: 0,
                left: '72%',
                width: '1px',
                height: '130px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.35), transparent)'
              }}
            />
            <div
              className="animate-rain-1"
              style={{
                position: 'absolute',
                top: 0,
                left: '88%',
                width: '1px',
                height: '160px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.4), transparent)',
                animationDelay: '1.4s'
              }}
            />
          </div>
        )}

        {mood === 'solaris' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 55% 30%, rgba(245, 158, 11, 0.22) 0%, rgba(56, 189, 248, 0.12) 40%, rgba(7, 9, 14, 0.98) 85%)'
            }}
          >
            {/* Golden Hour Sunlight Bloom & Drifting Dust Motes */}
            <div
              className="animate-solaris-bloom"
              style={{
                position: 'absolute',
                top: '15%',
                left: '30%',
                width: '420px',
                height: '420px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, transparent 68%)',
                filter: 'blur(50px)'
              }}
            />
            <div
              className="animate-dust-1"
              style={{
                position: 'absolute',
                top: '35%',
                left: '25%',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'rgba(254, 243, 199, 0.7)',
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.8)'
              }}
            />
            <div
              className="animate-dust-2"
              style={{
                position: 'absolute',
                top: '45%',
                left: '40%',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                backgroundColor: 'rgba(254, 243, 199, 0.6)',
                boxShadow: '0 0 6px rgba(245, 158, 11, 0.7)'
              }}
            />
            <div
              className="animate-dust-3"
              style={{
                position: 'absolute',
                top: '28%',
                right: '30%',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.7)',
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.8)'
              }}
            />
          </div>
        )}

        {mood === 'midnight' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 50% 25%, rgba(99, 102, 241, 0.20) 0%, rgba(30, 27, 75, 0.4) 40%, rgba(7, 9, 14, 0.98) 85%)'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '20%',
                left: '35%',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(129, 140, 248, 0.25) 0%, transparent 70%)',
                filter: 'blur(55px)'
              }}
            />
          </div>
        )}
      </div>

      {/* =========================================================================
          TOP BAR / HEADER
          Minimize button, Playing context, Capability badge
          ========================================================================= */}
      <header className="now-playing-header">
        {/* Persistent Obvious Close/Back Control (Top-Left, min 44x44px touch target) */}
        <button
          id="minimize-now-playing-btn"
          data-testid="minimize-now-playing-btn"
          data-close-now-playing="true"
          onClick={handleExit}
          aria-label="Close full screen player"
          className="now-playing-minimize-btn"
          title="Close full screen player (Esc)"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Center Title Context */}
        <div
          className="now-playing-header-center"
          onClick={() => {
            handleExit();
            setCurrentView('home');
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          title="NARO Home (Click to return to Home)"
          aria-label="NARO Home"
        >
          <span className="now-playing-header-eyebrow">
            PLAYING FROM NARO
          </span>
          <div className="now-playing-header-context">
            {currentSong.album || currentSong.title}
          </div>
        </div>

        {/* Mood Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            title={`Atmosphere: ${mood}`}
            className="now-playing-mood-badge"
          >
            {mood === 'romance' && <Heart size={15} color="#FB7185" />}
            {mood === 'sad' && <CloudRain size={15} color="#94A3B8" />}
            {mood === 'solaris' && <Sun size={15} color="#FBBF24" />}
            {mood === 'midnight' && <Moon size={15} color="#818CF8" />}
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN EXPERIENCE VIEWPORT
          Left: Expanded Hero Artwork & Metadata
          Right: Integrated Synced Lyrics Composition
          ========================================================================= */}
      <main
        id="now-playing-main"
        className="now-playing-main"
      >
        {/* Left Column: Expanded Artwork Hero */}
        <section
          aria-label="Track Information and Artwork"
          className="now-playing-left-col"
        >
          {/* Expanded Artwork with Ambient Outer Glow and Real Album Artwork */}
          <div
            id="now-playing-artwork-container"
            className="now-playing-artwork-wrap"
            style={{
              boxShadow: isPlaying
                ? '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 80px rgba(245, 158, 11, 0.2)'
                : '0 20px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <AbstractArtwork
              artwork={currentSong.artwork}
              song={currentSong}
              isPlaying={isPlaying}
              size="100%"
              alt={`${currentSong.title} by ${currentSong.artist}`}
            />
          </div>

          {/* Song Metadata */}
          <div className="now-playing-metadata">
            <h1
              id="now-playing-title"
              className="now-playing-title"
            >
              {currentSong.title}
            </h1>
            <p
              id="now-playing-artist"
              className="now-playing-artist"
            >
              {currentSong.artist}
            </p>

            {/* Song Meta Badges */}
            <div className="now-playing-badges">
              {currentSong.genre && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(244, 240, 235, 0.08)',
                    color: 'var(--text-dim, #94A3B8)'
                  }}
                >
                  {currentSong.genre}
                </span>
              )}
              {getConsumerLicenseLabel(currentSong.attribution) && (
                <span
                  id="now-playing-license-badge"
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(244, 240, 235, 0.06)',
                    color: 'var(--text-dim, #94A3B8)',
                    border: '1px solid rgba(244, 240, 235, 0.12)'
                  }}
                  title={currentSong.attribution?.text}
                >
                  {getConsumerLicenseLabel(currentSong.attribution)}
                </span>
              )}
            </div>

            {/* Action Row: Like, Add to Playlist */}
            <div className="now-playing-actions">
              <button
                id="now-playing-like-btn"
                data-testid="now-playing-like-btn"
                onClick={() => toggleLikeSong(currentSong)}
                className="now-playing-action-btn"
                style={{
                  color: isSongLiked(currentSong.id) ? '#EF4444' : 'var(--text-muted)'
                }}
                title={isSongLiked(currentSong.id) ? 'Unlike' : 'Like'}
              >
                <Heart size={18} fill={isSongLiked(currentSong.id) ? '#EF4444' : 'none'} />
              </button>

              <button
                id="now-playing-add-playlist-btn"
                data-testid="now-playing-add-playlist-btn"
                onClick={() => openAddToPlaylist(currentSong)}
                className="now-playing-action-btn"
                title="Add to Playlist"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* NARO Audiophile Listening Engine Suite */}
            <div
              id="now-playing-audiophile-suite"
              data-testid="now-playing-audiophile-suite"
              className="now-playing-sound-controls"
              style={{
                backgroundColor: 'rgba(244, 240, 235, 0.03)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                borderRadius: '16px',
                padding: '10px 14px',
                maxWidth: '420px',
                margin: '8px auto 0',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* Accessible Header Toggle: title, status badge, and chevron indicator */}
              <button
                type="button"
                id="now-playing-audiophile-toggle"
                data-testid="now-playing-audiophile-toggle"
                aria-expanded={isAudiophileExpanded}
                aria-controls="now-playing-audiophile-controls"
                aria-label={isAudiophileExpanded ? 'Collapse Audiophile Sound Engine' : 'Expand Audiophile Sound Engine'}
                onClick={() => setIsAudiophileExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  minHeight: '44px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                  color: 'inherit',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={14} color="var(--accent-warm)" />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)'
                    }}
                  >
                    Audiophile Sound Engine
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isAudiophileExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      color: 'var(--text-muted)'
                    }}
                  />
                </div>

                <span
                  id="now-playing-dsp-status-badge"
                  data-testid="now-playing-dsp-status-badge"
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: !isDspSupported
                      ? 'rgba(239, 68, 68, 0.15)'
                      : soundMode === 'original'
                      ? 'rgba(148, 163, 184, 0.15)'
                      : 'rgba(34, 197, 94, 0.15)',
                    color: !isDspSupported
                      ? '#F87171'
                      : soundMode === 'original'
                      ? '#94A3B8'
                      : '#4ADE80',
                    border: `1px solid ${
                      !isDspSupported
                        ? 'rgba(239, 68, 68, 0.3)'
                        : soundMode === 'original'
                        ? 'rgba(148, 163, 184, 0.3)'
                        : 'rgba(34, 197, 94, 0.3)'
                    }`
                  }}
                  title={
                    !isDspSupported
                      ? 'Audio provider bypasses Web Audio processing (e.g. YouTube iframe or Apple DRM)'
                      : soundMode === 'original'
                      ? 'Pure neutral bypass: zero coloration, bit-perfect reproduction'
                      : 'Web Audio DSP chain active with safety limiter'
                  }
                >
                  {!isDspSupported
                    ? 'DSP BYPASS'
                    : soundMode === 'original'
                    ? 'ORIGINAL (BYPASS)'
                    : 'DSP ACTIVE'}
                </span>
              </button>

              {/* Collapsible Audiophile Controls Container */}
              <div
                id="now-playing-audiophile-controls"
                data-testid="now-playing-audiophile-controls"
                style={{
                  display: isAudiophileExpanded ? 'block' : 'none',
                  width: '100%',
                  marginTop: '6px'
                }}
              >

              {/* Listening Mode Buttons: Original, Immersive, Punch */}
              <div
                role="radiogroup"
                aria-label="Audiophile Listening Modes"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  width: '100%'
                }}
              >
                {/* 1. Original */}
                <button
                  type="button"
                  id="now-playing-mode-original"
                  data-testid="now-playing-mode-original"
                  role="radio"
                  aria-checked={soundMode === 'original'}
                  onClick={() => setSoundMode('original')}
                  disabled={!isDspSupported}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '8px',
                    border: soundMode === 'original'
                      ? '1px solid rgba(244, 240, 235, 0.3)'
                      : '1px solid rgba(244, 240, 235, 0.08)',
                    backgroundColor: soundMode === 'original'
                      ? 'rgba(244, 240, 235, 0.14)'
                      : 'rgba(244, 240, 235, 0.04)',
                    color: soundMode === 'original' ? '#F4F0EB' : 'var(--text-dim)',
                    cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    opacity: !isDspSupported ? 0.5 : 1
                  }}
                  title="Faithful pure source reproduction with safety limiter"
                >
                  <div>Original</div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>Bypass</div>
                </button>

                {/* 2. Immersive */}
                <button
                  type="button"
                  id="now-playing-mode-immersive"
                  data-testid="now-playing-mode-immersive"
                  role="radio"
                  aria-checked={soundMode === 'immersive'}
                  onClick={() => setSoundMode('immersive')}
                  disabled={!isDspSupported}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '8px',
                    border: soundMode === 'immersive'
                      ? '1px solid var(--accent-warm)'
                      : '1px solid rgba(244, 240, 235, 0.08)',
                    backgroundColor: soundMode === 'immersive'
                      ? 'rgba(231, 165, 141, 0.22)'
                      : 'rgba(244, 240, 235, 0.04)',
                    color: soundMode === 'immersive' ? 'var(--accent-cream)' : 'var(--text-dim)',
                    cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    opacity: !isDspSupported ? 0.5 : 1
                  }}
                  title="Expansive 3D acoustic staging with centered vocals & warm bass"
                >
                  <div>Immersive</div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>Cinema 3D</div>
                </button>

                {/* 3. Punch */}
                <button
                  type="button"
                  id="now-playing-mode-punch"
                  data-testid="now-playing-mode-punch"
                  role="radio"
                  aria-checked={soundMode === 'punch'}
                  onClick={() => setSoundMode('punch')}
                  disabled={!isDspSupported}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '8px',
                    border: soundMode === 'punch'
                      ? '1px solid #F59E0B'
                      : '1px solid rgba(244, 240, 235, 0.08)',
                    backgroundColor: soundMode === 'punch'
                      ? 'rgba(245, 158, 11, 0.22)'
                      : 'rgba(244, 240, 235, 0.04)',
                    color: soundMode === 'punch' ? '#FCD34D' : 'var(--text-dim)',
                    cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    opacity: !isDspSupported ? 0.5 : 1
                  }}
                  title="JBL-inspired energetic punch with tight kick & clear transients"
                >
                  <div>Punch</div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>JBL Impact</div>
                </button>
              </div>

              {/* Dynamic Active DSP Description Banner */}
              <div
                id="now-playing-dsp-description"
                data-testid="now-playing-dsp-description"
                aria-live="polite"
                style={{
                  marginTop: '8px',
                  fontSize: '0.64rem',
                  lineHeight: 1.35,
                  color: !isDspSupported
                    ? '#F87171'
                    : soundMode === 'original'
                    ? '#94A3B8'
                    : '#FCD34D',
                  backgroundColor: 'rgba(0, 0, 0, 0.28)',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${
                    !isDspSupported
                      ? 'rgba(239, 68, 68, 0.2)'
                      : soundMode === 'original'
                      ? 'rgba(148, 163, 184, 0.15)'
                      : 'rgba(245, 158, 11, 0.2)'
                  }`,
                  textAlign: 'center',
                  width: '100%',
                  letterSpacing: '0.02em',
                  fontFamily: 'monospace'
                }}
              >
                {activeDspDescription || (!isDspSupported ? 'DSP Bypassed for Provider' : 'Bypass (Neutral flat response)')}
              </div>

              {/* Enhancement Presets */}
              {isDspSupported && (
                <div
                  className="now-playing-presets-container"
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      textAlign: 'center'
                    }}
                  >
                    Enhancement Presets {soundMode === 'original' && '(Engages DSP)'}
                  </div>
                  <div
                    className="now-playing-presets-row"
                    role="group"
                    aria-label="Sound Enhancement Presets"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      justifyContent: 'center',
                      width: '100%'
                    }}
                  >
                    {(['immersive', 'deep', 'vocal', 'wide', 'night'] as const).map((preset) => {
                      const isSelected = soundMode !== 'original' && soundPreset === preset;
                      const presetDescriptions: Record<string, { label: string; desc: string }> = {
                        immersive: { label: 'Standard', desc: 'Balanced 3D Soundstage' },
                        deep: { label: 'Deep', desc: 'Deeper low frequencies (+6 dB at 75 Hz)' },
                        vocal: { label: 'Vocal', desc: 'Clear vocal presence (+5.2 dB at 3.2 kHz)' },
                        wide: { label: 'Wide', desc: 'Expanded stereo separation (w = 1.90)' },
                        night: { label: 'Night', desc: 'Dynamic compression & gentle high rolloff' }
                      };
                      const info = presetDescriptions[preset];
                      return (
                        <button
                          key={preset}
                          type="button"
                          id={`now-playing-preset-${preset}`}
                          data-testid={`now-playing-preset-${preset}`}
                          aria-pressed={isSelected}
                          aria-label={`${info.label} Preset: ${info.desc}`}
                          title={`${info.label}: ${info.desc}`}
                          onClick={() => setSoundPreset(preset)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: isSelected
                              ? 'var(--accent-warm)'
                              : 'rgba(244, 240, 235, 0.06)',
                            color: isSelected ? '#080B10' : 'var(--text-dim)',
                            border: isSelected ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(244, 240, 235, 0.08)',
                            fontSize: '0.68rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bass Intensity Control (-5 to +5, neutral 0) */}
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(244, 240, 235, 0.06)',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <label htmlFor="now-playing-bass-slider" style={{ fontWeight: 600 }}>
                    Bass Intensity:
                  </label>
                  <span
                    id="now-playing-bass-readout"
                    data-testid="now-playing-bass-readout"
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: bassIntensity > 0 ? '#FCD34D' : bassIntensity < 0 ? '#93C5FD' : 'var(--text-dim)'
                    }}
                  >
                    {bassIntensity === 0 ? 'Neutral (0 dB)' : `${bassIntensity > 0 ? '+' : ''}${bassIntensity * 1.5} dB (${bassIntensity})`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="now-playing-bass-slider"
                    data-testid="now-playing-bass-slider"
                    type="range"
                    min={-5}
                    max={5}
                    step={1}
                    value={bassIntensity}
                    disabled={!isDspSupported || soundMode === 'original'}
                    onChange={(e) => setBassIntensity(parseInt(e.target.value, 10))}
                    aria-label="Bass Intensity adjustment (-5 to +5)"
                    style={{
                      flex: 1,
                      accentColor: soundMode === 'punch' ? '#F59E0B' : 'var(--accent-warm)',
                      cursor: (!isDspSupported || soundMode === 'original') ? 'not-allowed' : 'pointer',
                      height: '4px',
                      opacity: (!isDspSupported || soundMode === 'original') ? 0.4 : 1
                    }}
                  />
                  {bassIntensity !== 0 && (
                    <button
                      type="button"
                      onClick={() => setBassIntensity(0)}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(244, 240, 235, 0.12)',
                        borderRadius: '4px',
                        color: 'var(--text-dim)',
                        fontSize: '0.62rem',
                        padding: '1px 5px',
                        cursor: 'pointer'
                      }}
                      title="Reset bass to neutral"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* Right Column: Embedded Synced Lyrics Composition */}
        <section
          aria-label="Synchronized Lyrics"
          className="now-playing-lyrics-col"
        >
          {/* Header Bar: Capability Badge & 5-Language Meaning Switcher */}
          <div
            id="now-playing-lyrics-header"
            className="now-playing-lyrics-header"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                id="now-playing-lyrics-capability-badge"
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full, 9999px)',
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
                        ? 'var(--text-muted, #94A3B8)'
                        : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                          ? '#EAB308'
                          : '#F87171',
                  border: `1px solid ${(isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                      ? 'rgba(245, 158, 11, 0.3)'
                      : isSynced
                        ? 'rgba(56, 189, 248, 0.3)'
                        : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                          ? 'rgba(244, 240, 235, 0.15)'
                          : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                            ? 'rgba(234, 179, 8, 0.3)'
                            : 'rgba(239, 68, 68, 0.3)'
                    }`,
                  textTransform: 'uppercase'
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
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                Listening Mode • Original + Meaning
              </span>
              {isTranslating && (
                <span
                  id="now-playing-translating-badge"
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    color: 'var(--accent-warm, #E7A58D)',
                    border: '1px solid rgba(231, 165, 141, 0.3)'
                  }}
                >
                  Fetching meaning...
                </span>
              )}
            </div>

            {/* 5-Language Meaning Selector: EN, HI, TE, TA, ML */}
            <div
              className="glass-pill"
              role="radiogroup"
              aria-label="Listening meaning language selection"
              id="now-playing-meaning-lang-selector"
              data-testid="now-playing-meaning-lang-selector"
              style={{
                display: 'inline-flex',
                padding: '2px',
                gap: '2px',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                borderRadius: 'var(--radius-full, 9999px)',
                border: '1px solid rgba(244, 240, 235, 0.1)'
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = listeningMeaningLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    id={`now-playing-lang-${lang.code}`}
                    data-testid={`now-playing-lang-${lang.code}`}
                    role="radio"
                    aria-checked={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={isSelected ? 'active' : ''}
                    onClick={() => {
                      setListeningMeaningLanguage(lang.code);
                      setDisplayLanguage(lang.code);
                    }}
                    style={{
                      background: isSelected ? 'rgba(231, 165, 141, 0.28)' : 'transparent',
                      color: isSelected ? 'var(--accent-cream, #FEF3C7)' : 'rgba(244, 240, 235, 0.55)',
                      border: isSelected ? '1px solid rgba(231, 165, 141, 0.4)' : '1px solid transparent',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title={`Contextual meaning in ${lang.nativeLabel}`}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtle Mask Gradient for Smooth Fade on Top and Bottom */}
          <div
            style={{
              position: 'absolute',
              top: '44px',
              left: 0,
              right: 0,
              height: '40px',
              background: 'linear-gradient(180deg, #07090E 0%, transparent 100%)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40px',
              background: 'linear-gradient(0deg, #07090E 0%, transparent 100%)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />

          {/* Lyrics Scroller Container */}
          <div
            id="now-playing-lyrics-container"
            data-testid="now-playing-lyrics-container"
            ref={lyricsContainerRef}
            className="now-playing-lyrics-scroller"
          >
            {!isSynced && hasLyrics && (
              <div
                id="now-playing-plain-lyrics-banner"
                data-testid="now-playing-plain-lyrics-banner"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(244, 240, 235, 0.04)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '0 0 14px 0',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Untimed Plain Lyrics — Synchronized timestamps not yet verified for this track
                </span>
                <button
                  type="button"
                  id="now-playing-check-synced-btn"
                  data-testid="now-playing-check-synced-btn"
                  onClick={() => retryLyricsResolution()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(231, 165, 141, 0.12)',
                    border: '1px solid rgba(231, 165, 141, 0.3)',
                    color: 'var(--accent-cream)',
                    fontSize: '0.72rem',
                    borderRadius: 'var(--radius-full, 9999px)',
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={11} />
                  <span>Check Synced</span>
                </button>
              </div>
            )}
            {hasLyrics ? (
              displayedLines.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : line.time;
                const lineStart = lineTime !== undefined && lineTime >= 0 ? lineTime : 0;
                const lineEnd = line.endTime !== undefined && line.endTime > lineStart
                  ? line.endTime
                  : (line.duration !== undefined && line.duration > 0 ? lineStart + line.duration : lineStart + 3.0);
                const songOrigLang = (currentSong.originalLanguage || (currentSong as any).original_language || sourceLanguage || 'en') as string;
                const display = getListeningLyricDisplay(line, listeningMeaningLanguage, songOrigLang);
                const pace = line.pace !== undefined
                  ? line.pace
                  : measureLinePace({ text: display.originalText, startTime: lineStart, endTime: lineEnd }, songOrigLang);
                const paceTransition = getPaceTransition(pace);

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
                    onClick={() => {
                      if (isSynced && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                        seekTo(lineTime);
                      }
                    }}
                    role={isSynced ? 'button' : undefined}
                    tabIndex={isSynced ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isSynced && (e.key === 'Enter' || e.key === ' ') && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                        e.preventDefault();
                        seekTo(lineTime);
                      }
                    }}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '14px',
                      cursor: isSynced ? 'pointer' : 'default',
                      transition: isActive ? paceTransition.transitionCss : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      color: isActive ? 'var(--accent-cream, #FEF3C7)' : 'rgba(244, 240, 235, 0.85)',
                      fontSize: isActive ? 'clamp(1.15rem, 2.2vw, 1.55rem)' : 'clamp(0.95rem, 1.6vw, 1.18rem)',
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? 'rgba(244, 240, 235, 0.08)' : 'transparent',
                      transform: isActive ? 'scale(1.02) translateX(6px)' : 'scale(1)',
                      textShadow: isActive ? '0 0 25px rgba(254, 243, 199, 0.35)' : 'none',
                      userSelect: 'none',
                      borderLeft: isActive ? '3px solid var(--accent-warm, #E7A58D)' : '3px solid transparent'
                    }}
                    title={isSynced && typeof lineTime === 'number' && lineTime >= 0 ? `Seek to ${formatTime(lineTime)}` : undefined}
                  >
                    {/* Primary Line: Always the Original Sung Lyric in Native Script */}
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

                    {/* Secondary Line: Contextual / Poetic Meaning in Selected Language */}
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
              })
            ) : (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING') ? (
              <div
                id="now-playing-lyrics-loading"
                data-testid="now-playing-lyrics-loading"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Loader2 size={24} className="animate-spin" color="var(--accent-warm)" />
                <span style={{ fontSize: '0.88rem' }}>
                  Resolving canonical lyrics for "{currentSong?.title}"...
                </span>
              </div>
            ) : lyricsResolution?.outcome === 'TRANSIENT_FAILURE' ? (
              <div
                id="now-playing-lyrics-error"
                data-testid="now-playing-lyrics-error"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCD34D' }}>
                  <AlertCircle size={18} />
                  <span style={{ fontSize: '0.88rem' }}>
                    {lyricsResolution.errorReason || lyricsResolution.error || 'Temporary issue contacting lyrics providers'}
                  </span>
                </div>
                <button
                  type="button"
                  id="now-playing-retry-lyrics-btn"
                  data-testid="now-playing-retry-lyrics-btn"
                  onClick={() => retryLyricsResolution()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    border: '1px solid rgba(231, 165, 141, 0.35)',
                    color: 'var(--accent-cream)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={13} />
                  <span>Retry Lyrics Search</span>
                </button>
              </div>
            ) : (
              <div
                id="now-playing-no-lyrics"
                data-testid="now-playing-no-lyrics"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '0.92rem', color: 'var(--text-dim)' }}>
                  No lyrics found in catalogue for "{currentSong?.title}"
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Verified across available catalogue and external providers
                </span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =========================================================================
          BOTTOM AUTHORITATIVE CONTROLS BAR
          Authoritative Playhead Scrubber, Hi-Fi Controls, Volume & Karaoke
          ========================================================================= */}
      <footer className="now-playing-footer">
        {/* Scrubber & Central Playback Clock */}
        <div className="now-playing-scrubber-row">
          <span
            id="now-playing-current-time"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-muted, #CBD5E1)',
              width: '42px',
              textAlign: 'right'
            }}
          >
            {formatTime(currentTime)}
          </span>

          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              id="now-playing-seek-slider"
              data-testid="now-playing-seek-slider"
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.1}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              aria-label="Authoritative Timeline Scrubber"
              style={{
                width: '100%',
                accentColor: 'var(--accent-warm, #E7A58D)',
                cursor: 'pointer',
                height: '6px'
              }}
            />
          </div>

          <span
            id="now-playing-duration"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-muted, #CBD5E1)',
              width: '42px',
              textAlign: 'left'
            }}
          >
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="now-playing-controls-row">
          {/* Left: Shuffle & Moment Repeat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              aria-label={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
              className="now-playing-control-btn"
              style={{
                background: 'none',
                border: 'none',
                color: isShuffle ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
              title={isShuffle ? 'Shuffle active' : 'Shuffle tracks'}
            >
              <Shuffle size={18} />
            </button>

            <button
              onClick={() => setIsLoopingSection(!isLoopingSection)}
              aria-label="Repeat Section"
              className="now-playing-control-btn"
              style={{
                background: 'none',
                border: 'none',
                color: isLoopingSection ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
              title={isLoopingSection ? 'Moment looping active' : 'Repeat moment'}
            >
              <Repeat size={18} />
            </button>
          </div>

          {/* Center: Prev, Play/Pause, Next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3.5vw, 24px)' }}>
            <button
              onClick={prevSong}
              aria-label="Previous Track"
              className="now-playing-control-btn"
              style={{
                background: 'none',
                border: 'none',
                color: '#F4F0EB',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
            >
              <SkipBack size={22} />
            </button>

            <button
              id="now-playing-play-btn"
              data-testid="now-playing-play-btn"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="now-playing-play-btn"
              style={{ touchAction: 'manipulation' }}
            >
              {isPlaying ? <Pause size={24} fill="#080B10" /> : <Play size={24} fill="#080B10" style={{ marginLeft: '3px' }} />}
            </button>

            <button
              onClick={nextSong}
              aria-label="Next Track"
              className="now-playing-control-btn"
              style={{
                background: 'none',
                border: 'none',
                color: '#F4F0EB',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Right: Master Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleMuteToggle}
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              className="now-playing-control-btn"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #CBD5E1)',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation'
              }}
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <input
              id="now-playing-volume-slider"
              className="now-playing-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Master volume"
              style={{
                width: '85px',
                accentColor: 'var(--accent-warm, #E7A58D)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
