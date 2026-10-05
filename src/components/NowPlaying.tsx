import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Heart,
  CloudRain,
  Sun,
  Moon,
  Plus,
  Sliders
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { BeatSyncedVisualizer } from './BeatSyncedVisualizer';
import { lyricsService } from '../services/lyrics/lyricsService';
import { validateScriptForLanguage, transliterateIndic } from '../services/lyrics/translationService';
import type { Song, TimedLyricLine } from '../types/music';
import { SUPPORTED_LANGUAGES } from '../types/music';
import './NowPlaying.css';

export type AtmosphereMood = 'romance' | 'sad' | 'solaris' | 'midnight';

/**
 * Deterministically detect atmospheric mood from song metadata without fabrication.
 */
function getSongMood(song: Song): AtmosphereMood {
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
    displayLanguage,
    setDisplayLanguage,
    lyricsRevision,
    soundMode,
    soundPreset,
    setSoundMode,
    setSoundPreset,
    toggleLikeSong,
    isSongLiked,
    openAddToPlaylist
  } = useAudioPlayer();

  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Atmospheric Mood
  const mood = useMemo(() => getSongMood(currentSong), [currentSong]);

  // Truthful Lyrics Capability
  const lyricsCapability = useMemo(() => lyricsService.getLyricsCapability(currentSong), [currentSong]);
  const isSynced = lyricsCapability === 'SYNCED_LYRICS';

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const canonicalLyricLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong?.id, currentSong?.lyrics]);

  const originalLanguage = useMemo(() => {
    return lyricsService.detectSongLanguage(currentSong);
  }, [currentSong?.id, currentSong?.language, currentSong?.originalLanguage]);

  // Displayed lines state - initialized with canonical lines
  const [displayedLines, setDisplayedLines] = useState<TimedLyricLine[]>(canonicalLyricLines);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const translationRequestRef = useRef<number>(0);

  // Synchronize displayedLines when canonicalLyricLines or displayLanguage or originalLanguage changes
  useEffect(() => {
    const requestId = ++translationRequestRef.current;

    if (!canonicalLyricLines || canonicalLyricLines.length === 0) {
      setDisplayedLines([]);
      setIsTranslating(false);
      return;
    }

    // 1. If target language is original language, use canonical lines directly
    if (displayLanguage === originalLanguage) {
      setDisplayedLines(canonicalLyricLines);
      setIsTranslating(false);
      return;
    }

    // 2. Check if already cached synchronously (0ms delay)
    const cached = lyricsService.getCachedTranslation(canonicalLyricLines, displayLanguage, currentSong.id, originalLanguage);
    if (cached) {
      setDisplayedLines(cached);
      setIsTranslating(false);
      return;
    }

    // 3. Otherwise fetch translation asynchronously (< 1 second)
    setIsTranslating(true);
    lyricsService.translateLyricLines(canonicalLyricLines, displayLanguage, originalLanguage, currentSong.id, true)
      .then((translated) => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(translated);
          setIsTranslating(false);
        }
      })
      .catch(() => {
        if (translationRequestRef.current === requestId) {
          setIsTranslating(false);
        }
      });
  }, [canonicalLyricLines, displayLanguage, originalLanguage, currentSong.id, lyricsRevision]);

  const hasLyrics = displayedLines.length > 0 && lyricsCapability !== 'LYRICS_UNAVAILABLE';

  // Active lyric index strictly derived from authoritative currentTime
  const activeLyricIndex = useMemo(() => {
    if (!hasLyrics || !isSynced) return -1;
    return lyricsService.getActiveLyricIndex(displayedLines, currentTime, currentSong.lyricsOffsetMs || 0);
  }, [hasLyrics, isSynced, displayedLines, currentTime, currentSong.lyricsOffsetMs]);

  // Smooth scroll active lyric into view
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLyricIndex]);

  // Keyboard accessibility: Escape to minimize, Space to toggle play
  useEffect(() => {
    if (!nowPlayingOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNowPlaying();
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
  }, [nowPlayingOpen, closeNowPlaying, togglePlay]);

  if (!nowPlayingOpen) return null;

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
        {/* Minimize Button */}
        <button
          id="minimize-now-playing-btn"
          data-testid="minimize-now-playing-btn"
          onClick={closeNowPlaying}
          aria-label="Minimize Now Playing"
          className="now-playing-minimize-btn"
          title="Minimize Now Playing (Esc)"
        >
          <ChevronDown size={24} />
        </button>

        {/* Center Title Context */}
        <div className="now-playing-header-center">
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
          {/* Expanded Artwork with Ambient Outer Glow and Beat-Synced Visualizer */}
          <div
            id="now-playing-artwork-container"
            className="now-playing-artwork-wrap"
            style={{
              boxShadow: isPlaying
                ? '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 80px rgba(245, 158, 11, 0.2)'
                : '0 20px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <BeatSyncedVisualizer
              artwork={currentSong.artwork}
              isPlaying={isPlaying}
              size="100%"
              mode="fullscreen"
              songTitle={currentSong.title}
              songArtist={currentSong.artist}
              onTogglePlay={togglePlay}
              interactive={true}
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
              {currentSong.attribution?.license && (
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
                  title={currentSong.attribution.text}
                >
                  {currentSong.attribution.license}
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

            {/* NARO Immersive Sound Engine Controls */}
            <div className="now-playing-sound-controls">
              <button
                id="now-playing-sound-btn"
                data-testid="now-playing-sound-btn"
                onClick={() => {
                  setSoundMode(soundMode === 'immersive' ? 'original' : 'immersive');
                }}
                className="now-playing-sound-pill"
                style={{
                  backgroundColor:
                    soundMode === 'immersive'
                      ? 'rgba(231, 165, 141, 0.25)'
                      : 'rgba(244, 240, 235, 0.06)',
                  border:
                    soundMode === 'immersive'
                      ? '1px solid var(--accent-warm)'
                      : '1px solid rgba(244, 240, 235, 0.12)',
                  color:
                    soundMode === 'immersive'
                      ? 'var(--accent-cream)'
                      : 'var(--text-muted)'
                }}
              >
                <Sliders
                  size={14}
                  color={soundMode === 'immersive' ? 'var(--accent-warm)' : 'currentColor'}
                />
                <span>
                  {soundMode === 'immersive'
                    ? `Immersive • ${soundPreset.toUpperCase()}`
                    : 'Original Sound'}
                </span>
              </button>

              {soundMode === 'immersive' && (
                <div className="now-playing-presets-row">
                  {(['immersive', 'deep', 'vocal', 'wide', 'night'] as const).map(
                    (preset) => {
                      const isSelected = soundPreset === preset;
                      return (
                        <button
                          key={preset}
                          onClick={() => setSoundPreset(preset)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: isSelected
                              ? 'var(--accent-warm)'
                              : 'rgba(244, 240, 235, 0.05)',
                            color: isSelected ? '#080B10' : 'var(--text-dim)',
                            border: 'none',
                            fontSize: '0.74rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                          }}
                        >
                          {preset}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Embedded Synced Lyrics Composition */}
        <section
          aria-label="Synchronized Lyrics"
          className="now-playing-lyrics-col"
        >
          {/* Header Bar: Capability Badge & 5-Language Switcher */}
          <div
            id="now-playing-lyrics-header"
            className="now-playing-lyrics-header"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                id="now-playing-lyrics-capability-badge"
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  backgroundColor: isSynced
                    ? 'rgba(56, 189, 248, 0.15)'
                    : lyricsCapability === 'PLAIN_LYRICS'
                      ? 'rgba(244, 240, 235, 0.08)'
                      : 'rgba(239, 68, 68, 0.12)',
                  color: isSynced
                    ? '#38BDF8'
                    : lyricsCapability === 'PLAIN_LYRICS'
                      ? 'var(--text-muted, #94A3B8)'
                      : '#F87171',
                  border: `1px solid ${isSynced
                      ? 'rgba(56, 189, 248, 0.3)'
                      : lyricsCapability === 'PLAIN_LYRICS'
                        ? 'rgba(244, 240, 235, 0.15)'
                        : 'rgba(239, 68, 68, 0.3)'
                    }`,
                  textTransform: 'uppercase'
                }}
              >
                {isSynced ? 'SYNCED' : lyricsCapability === 'PLAIN_LYRICS' ? 'PLAIN' : 'UNAVAILABLE'}
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
                  Translating...
                </span>
              )}
            </div>

            {/* 5-Language Selector: English, Hindi, Telugu, Tamil, Malayalam */}
            <div
              className="glass-pill"
              role="radiogroup"
              aria-label="Now Playing lyric language selection"
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
                const isSelected = displayLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    id={`now-playing-lang-${lang.code}`}
                    role="radio"
                    aria-checked={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={isSelected ? 'active' : ''}
                    onClick={() => setDisplayLanguage(lang.code)}
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
                    title={lang.nativeLabel}
                  >
                    {lang.label}
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
            {hasLyrics ? (
              displayedLines.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : line.time;
                const translation = lyricsService.getLineTranslation(line, displayLanguage, originalLanguage);
                const isTargetOriginal = displayLanguage === originalLanguage;
                const candidateText = (translation.isAvailable && validateScriptForLanguage(translation.text, displayLanguage, originalLanguage))
                  ? translation.text
                  : (validateScriptForLanguage(line.text, displayLanguage, originalLanguage)
                      ? line.text
                      : (line.translations?.[displayLanguage] && validateScriptForLanguage(line.translations[displayLanguage], displayLanguage, originalLanguage)
                          ? line.translations[displayLanguage]
                          : (isTargetOriginal ? line.text : transliterateIndic(line.text, displayLanguage))));
                const displayText = candidateText;
                const originalText = canonicalLyricLines[idx]?.text || line.text;
                const showSubtitle = displayLanguage !== originalLanguage && originalText && originalText !== displayText;

                return (
                  <div
                    key={line.id || idx}
                    ref={isActive ? activeLyricRef : null}
                    id={`now-playing-lyric-${idx}`}
                    data-testid={isActive ? 'active-lyric-line' : `lyric-line-${idx}`}
                    data-active={isActive ? 'true' : 'false'}
                    data-timestamp={lineTime}
                    onClick={() => {
                      if (isSynced && typeof lineTime === 'number' && !isNaN(lineTime) && lineTime >= 0) {
                        seekTo(lineTime);
                      }
                    }}
                    role={isSynced ? 'button' : undefined}
                    tabIndex={isSynced ? 0 : undefined}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '14px',
                      cursor: isSynced ? 'pointer' : 'default',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      color: isActive ? 'var(--accent-cream, #FEF3C7)' : 'rgba(244, 240, 235, 0.4)',
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
                    <div>
                      {displayText}
                    </div>

                    {/* Subtitle with original lyrics when viewing translation */}
                    {showSubtitle && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: 'rgba(244, 240, 235, 0.45)',
                          marginTop: '4px',
                          fontStyle: 'italic'
                        }}
                      >
                        {originalText}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                id="now-playing-no-lyrics"
                data-testid="now-playing-no-lyrics"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '220px', height: '14px', borderRadius: '8px', background: 'rgba(244, 240, 235, 0.08)' }} />
                  <div style={{ width: '300px', height: '20px', borderRadius: '8px', background: 'rgba(244, 240, 235, 0.12)' }} />
                  <div style={{ width: '180px', height: '14px', borderRadius: '8px', background: 'rgba(244, 240, 235, 0.08)' }} />
                </div>
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
          {/* Left: Moment Repeat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsLoopingSection(!isLoopingSection)}
              aria-label="Repeat Section"
              style={{
                background: 'none',
                border: 'none',
                color: isLoopingSection ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)',
                cursor: 'pointer',
                padding: '8px'
              }}
              title={isLoopingSection ? 'Moment looping active' : 'Repeat moment'}
            >
              <Repeat size={18} />
            </button>
          </div>

          {/* Center: Prev, Play/Pause, Next */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={prevSong}
              aria-label="Previous Track"
              style={{
                background: 'none',
                border: 'none',
                color: '#F4F0EB',
                cursor: 'pointer',
                padding: '8px'
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
            >
              {isPlaying ? <Pause size={24} fill="#080B10" /> : <Play size={24} fill="#080B10" style={{ marginLeft: '3px' }} />}
            </button>

            <button
              onClick={nextSong}
              aria-label="Next Track"
              style={{
                background: 'none',
                border: 'none',
                color: '#F4F0EB',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Right: Master Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleMuteToggle}
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #CBD5E1)',
                cursor: 'pointer',
                padding: '4px'
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
              aria-label="Volume Slider"
              style={{
                width: '75px',
                accentColor: 'var(--accent-warm, #E7A58D)',
                cursor: 'pointer',
                height: '4px'
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
