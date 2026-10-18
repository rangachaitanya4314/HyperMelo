import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Play,
  Pause,
  Loader2,
  WifiOff,
  Clock,
  Sparkles,
  Trash2,
  User,
  Music,
  ArrowRight
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import {
  predictiveSearchService,
  POPULAR_SEARCH_SUGGESTIONS
} from '../services/search/predictiveSearchService';
import type { Song } from '../types/music';
import type { ArtistProfile } from '../data/artistCatalog';
import { getCanonicalTrackDuration } from '../shared/track';
import { lyricsPipelineService } from '../services/lyrics/lyricsPipelineService';

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
    isOnline,
    setCurrentView
  } = useAudioPlayer();

  const [songResults, setSongResults] = useState<Song[]>([]);
  const [artistResults, setArtistResults] = useState<ArtistProfile[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const debounceTimerRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Refresh recent searches when modal opens
  useEffect(() => {
    if (searchModalOpen) {
      setRecentSearches(predictiveSearchService.getRecentSearches());
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchModalOpen]);

  // Synchronous instant local search + debounced remote search
  useEffect(() => {
    if (!searchModalOpen) return;

    const trimmed = searchQuery.trim();
    const requestId = ++searchRequestIdRef.current;

    if (!trimmed) {
      // Empty input -> clear results and show recent searches & popular suggestions
      setSongResults([]);
      setArtistResults([]);
      setLoading(false);
      setOfflineMessage(null);
      setSelectedIndex(-1);
      setRecentSearches(predictiveSearchService.getRecentSearches());
      return;
    }

    // 1. Instant local search execution (0ms delay)
    const local = predictiveSearchService.searchLocal(trimmed);
    setSongResults(local.songs);
    setArtistResults(local.artists);
    setSelectedIndex(-1);

    // 2. Debounce remote search for comprehensive federation
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (isOnline) {
      setLoading(true);
      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          const response = await musicCatalogService.search(trimmed);
          if (searchRequestIdRef.current === requestId) {
            if (response.songs && response.songs.length > 0) {
              // Merge local and remote, deduplicating by title + artist
              const seen = new Set<string>(
                local.songs.map(
                  (s) => `${s.title.toLowerCase().trim()}---${(s.artist || '').toLowerCase().trim()}`
                )
              );
              const merged = [...local.songs];
              for (const remoteSong of response.songs) {
                const key = `${remoteSong.title.toLowerCase().trim()}---${(remoteSong.artist || '').toLowerCase().trim()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  merged.push(remoteSong);
                }
              }
              setSongResults(merged);
            }
            setOfflineMessage(response.message || null);
            setLoading(false);
          }
        } catch {
          if (searchRequestIdRef.current === requestId) {
            setLoading(false);
          }
        }
      }, 250);
    } else {
      setLoading(false);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery, searchModalOpen, isOnline]);

  // Pre-resolve lyrics for visible search results in background
  useEffect(() => {
    if (songResults.length > 0) {
      lyricsPipelineService.preResolveTracks(songResults.slice(0, 8));
    }
  }, [songResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!searchModalOpen) {
        if (
          (e.ctrlKey && e.key === 'k') ||
          (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))
        ) {
          e.preventDefault();
          setSearchModalOpen(true);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchModalOpen(false);
        return;
      }

      // Compute total navigable items
      const totalItems = artistResults.length + songResults.length;
      if (totalItems === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < totalItems ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < totalItems) {
          e.preventDefault();
          if (selectedIndex < artistResults.length) {
            // Selected an artist
            const selectedArtist = artistResults[selectedIndex];
            handleSelectArtist(selectedArtist.name);
          } else {
            // Selected a song
            const songIndex = selectedIndex - artistResults.length;
            const selectedSong = songResults[songIndex];
            handleTrackPlay(selectedSong);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen, setSearchModalOpen, selectedIndex, artistResults, songResults]);

  if (!searchModalOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrackPlay = (song: Song) => {
    predictiveSearchService.addRecentSearch(song.title);
    setRecentSearches(predictiveSearchService.getRecentSearches());

    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
    setSearchModalOpen(false);
  };

  const handleSelectArtist = (artistName: string) => {
    predictiveSearchService.addRecentSearch(artistName);
    setRecentSearches(predictiveSearchService.getRecentSearches());
    setSearchModalOpen(false);
    setCurrentView('discover');
  };

  const handleApplyQuery = (query: string) => {
    setSearchQuery(query);
    predictiveSearchService.addRecentSearch(query);
    setRecentSearches(predictiveSearchService.getRecentSearches());
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    predictiveSearchService.removeRecentSearch(query);
    setRecentSearches(predictiveSearchService.getRecentSearches());
  };

  const handleClearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    predictiveSearchService.clearRecentSearches();
    setRecentSearches([]);
  };

  const isQueryEmpty = searchQuery.trim().length === 0;

  return (
    <div
      id="search-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Search HyperMelo Music Catalog"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.92)',
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
          backgroundColor: 'rgba(10, 14, 22, 0.96)'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(244, 240, 235, 0.08)'
          }}
        >
          <Search size={22} color="var(--accent-warm)" />
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            autoFocus
            placeholder="Search songs, artists, albums (English, Hindi, Telugu, Tamil)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search music catalog"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '1.1rem',
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
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FCA5A5',
              fontSize: '0.82rem'
            }}
          >
            <WifiOff size={16} />
            <span>
              {offlineMessage ||
                "You're offline. Searching local catalog tracks and artists while disconnected."}
            </span>
          </div>
        )}

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* EMPTY QUERY STATE: Recent Searches & Popular Suggestions */}
          {isQueryEmpty && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      padding: '0 4px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <Clock size={13} color="var(--accent-warm)" />
                      <span>Recent Searches</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAllRecent}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '0.68rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={12} />
                      Clear all
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => handleApplyQuery(term)}
                        role="button"
                        tabIndex={0}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(244, 240, 235, 0.05)',
                          border: '1px solid rgba(244, 240, 235, 0.1)',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.1)';
                          e.currentTarget.style.borderColor = 'var(--border-warm)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(244, 240, 235, 0.1)';
                        }}
                      >
                        <Clock size={12} color="var(--text-dim)" />
                        <span>{term}</span>
                        <span
                          role="button"
                          aria-label={`Remove ${term}`}
                          onClick={(e) => handleRemoveRecent(e, term)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-dim)',
                            padding: '2px',
                            marginLeft: '2px'
                          }}
                        >
                          <X size={12} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Suggestions */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                    padding: '0 4px'
                  }}
                >
                  <Sparkles size={13} color="var(--accent-warm)" />
                  <span>Popular Suggestions</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {POPULAR_SEARCH_SUGGESTIONS.map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => handleApplyQuery(sugg)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(231, 165, 141, 0.08)',
                        border: '1px solid rgba(231, 165, 141, 0.2)',
                        color: 'var(--accent-cream)',
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(231, 165, 141, 0.18)';
                        e.currentTarget.style.borderColor = 'var(--accent-warm)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(231, 165, 141, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(231, 165, 141, 0.2)';
                      }}
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE QUERY RESULTS */}
          {!isQueryEmpty && (
            <>
              {/* No Results Message */}
              {songResults.length === 0 && artistResults.length === 0 && !loading && (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  <p style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
                    No songs or artists found for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p style={{ fontSize: '0.86rem', marginTop: '6px' }}>
                    Try searching an artist name, song title, or Hindi/Telugu lyrics fragment.
                  </p>
                </div>
              )}

              {/* ARTISTS GROUP */}
              {artistResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--text-muted)',
                      padding: '0 6px'
                    }}
                  >
                    <User size={13} color="var(--accent-warm)" />
                    <span>Artists ({artistResults.length})</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {artistResults.map((artist, idx) => {
                      const isHighlighted = selectedIndex === idx;
                      return (
                        <div
                          key={artist.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectArtist(artist.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isHighlighted
                              ? 'rgba(231, 165, 141, 0.15)'
                              : 'rgba(244, 240, 235, 0.03)',
                            border: isHighlighted
                              ? '1px solid var(--accent-warm)'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(231, 165, 141, 0.18)',
                                border: '1px solid rgba(231, 165, 141, 0.3)',
                                color: 'var(--accent-cream)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                            >
                              {artist.initial || artist.name.charAt(0)}
                            </div>

                            <div>
                              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {artist.name}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                                {artist.genre} • {artist.language}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                            <span>Explore Discography</span>
                            <ArrowRight size={14} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SONGS GROUP */}
              {songResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 6px',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Music size={13} color="var(--accent-warm)" />
                      <span>Songs ({songResults.length})</span>
                    </div>
                    <span style={{ color: 'var(--accent-warm)', fontWeight: 600 }}>FEEL IT. MAKE IT.</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {songResults.map((song, idx) => {
                      const itemNavIndex = artistResults.length + idx;
                      const isHighlighted = selectedIndex === itemNavIndex;
                      const isThisCurrent = currentSong?.id === song.id;
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
                              ? 'rgba(231, 165, 141, 0.12)'
                              : isHighlighted
                              ? 'rgba(244, 240, 235, 0.08)'
                              : 'rgba(244, 240, 235, 0.02)',
                            border: isThisCurrent
                              ? '1px solid var(--border-warm)'
                              : isHighlighted
                              ? '1px solid var(--border-subtle)'
                              : '1px solid transparent',
                            transition: 'all 0.15s ease',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => {
                            if (!isThisCurrent) {
                              e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.06)';
                              e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isThisCurrent && !isHighlighted) {
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
                              <AbstractArtwork
                                artwork={song.artwork}
                                song={song}
                                trackId={song.id}
                                title={song.title}
                                artist={song.artist}
                                isPlaying={isThisPlaying}
                                size={46}
                              />
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

                            <button
                              type="button"
                              onClick={() => handleTrackPlay(song)}
                              aria-label={isThisPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                              className="btn-icon"
                              style={{
                                width: '36px',
                                height: '36px',
                                backgroundColor: isThisPlaying
                                  ? 'var(--accent-warm)'
                                  : 'rgba(244, 240, 235, 0.08)',
                                color: isThisPlaying ? '#080B10' : 'var(--text-primary)'
                              }}
                              title={isThisPlaying ? 'Pause' : 'Play inside HyperMelo'}
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
