import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Pause, Loader2, WifiOff } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import type { Song } from '../types/music';
import { getCanonicalTrackDuration } from '../shared/track';

export const SearchModal: React.FC = () => {
  const {
    searchModalOpen,
    setSearchModalOpen,
    searchQuery,
    setSearchQuery,
    playSong,
    currentSong,
    isPlaying,
    togglePlay,
    isOnline
  } = useAudioPlayer();

  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Keyboard shortcut Ctrl+K or / or ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchModalOpen) {
        setSearchModalOpen(false);
      }
      if (
        (e.ctrlKey && e.key === 'k') ||
        (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))
      ) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen, setSearchModalOpen]);

  // Execute debounced online search
  useEffect(() => {
    if (!searchModalOpen) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      // Default to curated fallback tracks when empty
      setResults(musicCatalogService.getFallbackCatalog());
      setLoading(false);
      setOfflineMessage(null);
      return;
    }

    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = window.setTimeout(async () => {
      const response = await musicCatalogService.search(trimmed);
      setResults(response.songs);
      setOfflineMessage(response.message || null);
      setLoading(false);
    }, 280);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery, searchModalOpen, isOnline]);

  if (!searchModalOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrackPlay = (song: Song) => {
    if (currentSong.id === song.id) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
  };

  return (
    <div
      id="search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Search NARO Music Catalog"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.9)',
        backdropFilter: 'blur(24px)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'clamp(20px, 7vw, 80px) 16px 32px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSearchModalOpen(false);
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '82vh',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(231, 165, 141, 0.12)',
          border: '1px solid var(--border-medium)',
          backgroundColor: 'rgba(10, 14, 22, 0.95)'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(244, 240, 235, 0.08)'
          }}
        >
          <Search size={22} color="var(--accent-warm)" />
          <input
            id="search-input"
            type="text"
            autoFocus
            placeholder="Search music, artists, lyrics, Hindi or Telugu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search music catalog"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '1.15rem',
              color: 'var(--text-primary)',
              letterSpacing: '0.01em'
            }}
          />

          {loading && <Loader2 size={18} className="animate-spin" color="var(--accent-warm)" />}

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear query"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          )}

          <button
            onClick={() => setSearchModalOpen(false)}
            aria-label="Close search"
            style={{
              background: 'rgba(244, 240, 235, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '4px 8px',
              cursor: 'pointer'
            }}
          >
            ESC
          </button>
        </div>

        {/* Offline Warning Banner inside Search */}
        {(!isOnline || offlineMessage) && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FCA5A5',
              fontSize: '0.85rem'
            }}
          >
            <WifiOff size={16} />
            <span>
              {offlineMessage || "You're offline. Connect to the internet to search and stream music."}
            </span>
          </div>
        )}

        {/* Results List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '0 8px 6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>
              {searchQuery.trim()
                ? `${results.length} NARO ${results.length === 1 ? 'Result' : 'Results'}`
                : 'Curated Tracks'}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--accent-warm)', letterSpacing: '0.12em', fontWeight: 600 }}>
              FEEL IT. MAKE IT.
            </span>
          </div>

          {results.length === 0 && !loading && (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <p style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
                No songs found for &ldquo;{searchQuery}&rdquo;
              </p>
              <p style={{ fontSize: '0.86rem', marginTop: '6px' }}>
                Try searching an artist name, song title, or Hindi/Telugu lyrics fragment.
              </p>
            </div>
          )}

          {results.map((song) => {
            const isThisCurrent = currentSong.id === song.id;
            const isThisPlaying = isThisCurrent && isPlaying;

            return (
              <div
                key={song.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isThisCurrent
                    ? 'rgba(231, 165, 141, 0.1)'
                    : 'rgba(244, 240, 235, 0.02)',
                  border: isThisCurrent
                    ? '1px solid var(--border-warm)'
                    : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!isThisCurrent) {
                    e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.06)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isThisCurrent) {
                    e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.02)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {/* Artwork + Title + Artist */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    minWidth: 0,
                    flex: 1,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleTrackPlay(song)}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <AbstractArtwork artwork={song.artwork} isPlaying={isThisPlaying} size={46} />
                  </div>

                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 600,
                        color: isThisCurrent ? 'var(--accent-warm)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {song.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {song.artist} {song.album && `• ${song.album}`}
                    </div>
                  </div>
                </div>

                {/* Right: Duration + Play Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: 'var(--text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: '38px',
                      textAlign: 'right'
                    }}
                  >
                    {formatDuration(getCanonicalTrackDuration(song))}
                  </span>

                  {/* Play Action Button for Normal Listening */}
                  <button
                    onClick={() => handleTrackPlay(song)}
                    aria-label={isThisPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                    className="btn-icon"
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: isThisPlaying ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.08)',
                      color: isThisPlaying ? '#080B10' : 'var(--text-primary)'
                    }}
                    title={isThisPlaying ? 'Pause' : 'Play inside NARO'}
                  >
                    {isThisPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
