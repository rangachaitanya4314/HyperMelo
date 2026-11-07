import React, { useMemo } from 'react';
import {
  Search,
  Flame,
  Sparkles,
  Music,
  Globe,
  Play,
  Pause,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from './MusicCard';
import { HomeMoods } from './HomeMoods';
import { AbstractArtwork } from './AbstractArtwork';
import { ALL_ARTISTS } from '../data/artistCatalog';
import type { Song } from '../types/music';
import './MobileDiscover.css';

interface MobileDiscoverProps {
  trendingSongs: Song[];
  hindiTop10: Song[];
  teluguTop10: Song[];
  tamilTop10: Song[];
  malayalamTop10: Song[];
  englishTop10: Song[];
  newReleases: Song[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedArtist: string | null;
  setSelectedArtist: (artist: string | null) => void;
  artistSongs: Song[];
  tabLoading: boolean;
}

export const MobileDiscover: React.FC<MobileDiscoverProps> = ({
  trendingSongs,
  hindiTop10,
  teluguTop10,
  tamilTop10,
  malayalamTop10,
  englishTop10,
  newReleases,
  activeTab,
  setActiveTab,
  selectedArtist,
  setSelectedArtist,
  artistSongs,
  tabLoading
}) => {
  const {
    currentSong,
    isPlaying,
    playSong,
    togglePlay,
    setSearchModalOpen
  } = useAudioPlayer();

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'trending', label: 'Popular in India' },
    { id: 'moods', label: 'Moods' },
    { id: 'hindi', label: 'Hindi' },
    { id: 'telugu', label: 'Telugu' },
    { id: 'tamil', label: 'Tamil' },
    { id: 'malayalam', label: 'Malayalam' },
    { id: 'english', label: 'English' },
    { id: 'artists', label: 'Artists' },
    { id: 'new', label: 'New Releases' }
  ];

  // Dynamic curated spotlight hero tracks
  const heroSpotlightTracks = useMemo(() => {
    const list: { song: Song; badge: string }[] = [];
    if (trendingSongs.length > 0) {
      list.push({ song: trendingSongs[0], badge: 'Hit of the Week' });
    }
    if (teluguTop10.length > 0) {
      list.push({ song: teluguTop10[0], badge: 'Trending Blockbuster' });
    }
    if (hindiTop10.length > 0) {
      list.push({ song: hindiTop10[0], badge: 'Romantic Anthem' });
    }
    if (tamilTop10.length > 0) {
      list.push({ song: tamilTop10[0], badge: 'Mass Chart-Topper' });
    }
    if (englishTop10.length > 0) {
      list.push({ song: englishTop10[0], badge: 'Global Spotlight' });
    }
    return list;
  }, [trendingSongs, teluguTop10, hindiTop10, tamilTop10, englishTop10]);

  // Top 10 ranked tracks for rank badge spotlight
  const top10Ranked = useMemo(() => {
    return trendingSongs.slice(0, 10);
  }, [trendingSongs]);

  const featuredArtists = useMemo(() => {
    return ALL_ARTISTS.slice(0, 10);
  }, []);

  const handleTrackPlay = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
  };

  return (
    <div className="hm-mobile-discover-container" role="region" aria-label="Mobile Discover Catalog">
      {/* 1. Single Unified Search Bar */}
      <div className="hm-mobile-search-pill-wrap">
        <div
          id="mobile-discover-unified-search"
          data-testid="mobile-discover-unified-search"
          className="hm-mobile-search-pill"
          onClick={() => setSearchModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSearchModalOpen(true);
            }
          }}
          aria-label="Search songs, albums, artists, or lyrics"
        >
          <div className="hm-mobile-search-lead">
            <Search size={18} className="hm-mobile-search-icon" />
            <span className="hm-mobile-search-placeholder">
              Search songs, albums, artists, or lyrics...
            </span>
          </div>
          <div className="hm-mobile-search-tag">
            <span>DISCOVER</span>
          </div>
        </div>
      </div>

      {/* 2. Sticky Category Filter Row */}
      <div className="hm-mobile-sticky-filters">
        <div className="hm-mobile-filter-track" role="tablist" aria-label="Discover Categories">
          {filterTabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'artists') {
                    setSelectedArtist(null);
                  }
                }}
                className={`hm-mobile-filter-btn ${isSelected ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', color: 'var(--accent-warm)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '0.85rem' }}>Loading music...</span>
        </div>
      )}

      {/* 3. Hero Spotlight Carousel (Shown on 'all' tab) */}
      {activeTab === 'all' && heroSpotlightTracks.length > 0 && (
        <section className="hm-mobile-hero-section" aria-label="Hero Spotlight">
          <div className="hm-mobile-section-header">
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Spotlight</h2>
              <span className="hm-mobile-section-badge">FEATURED</span>
            </div>
          </div>

          <div className="hm-mobile-carousel">
            {heroSpotlightTracks.map(({ song, badge }) => {
              const isCurrent = currentSong?.id === song.id;
              const isThisPlaying = isCurrent && isPlaying;
              const artUrl = song.artwork?.imageUrl;

              return (
                <div
                  key={`hero-${song.id}`}
                  className="hm-hero-card"
                  onClick={() => handleTrackPlay(song)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${song.title} by ${song.artist}`}
                >
                  <div className="hm-hero-bg">
                    {artUrl ? (
                      <img
                        src={artUrl}
                        alt={song.title}
                        className="hm-hero-img"
                        loading="lazy"
                      />
                    ) : (
                      <AbstractArtwork
                        artwork={song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size={320}
                        className="hm-hero-img"
                      />
                    )}
                    <div className="hm-hero-overlay" />
                  </div>

                  <div className="hm-hero-content">
                    <div className="hm-hero-top-row">
                      <span className="hm-hero-pill-badge">{badge}</span>
                    </div>

                    <div className="hm-hero-bottom-row">
                      <div className="hm-hero-info">
                        <h3 className="hm-hero-title">{song.title}</h3>
                        <p className="hm-hero-artist">
                          {song.artist} {song.album ? `• ${song.album}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="hm-hero-play-btn"
                        onClick={(e) => handleTrackPlay(song, e)}
                        aria-label={isThisPlaying ? 'Pause' : 'Play'}
                      >
                        {isThisPlaying ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Bento Grid (Genres & Moods) - Shown on 'all' tab */}
      {activeTab === 'all' && (
        <section className="hm-mobile-bento-section" aria-label="Bento Moods and Categories">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Vibe & Atmosphere</h2>
              <span className="hm-mobile-section-badge">BENTO</span>
            </div>
          </div>

          <div className="hm-bento-grid">
            {/* Tile 1: Trending in India (Wide / Span 2) */}
            <div
              className="hm-bento-tile span-2 theme-trending"
              onClick={() => setActiveTab('trending')}
              role="button"
              tabIndex={0}
            >
              <div className="hm-bento-top">
                <span className="hm-bento-badge">TOP 50 CHARTS</span>
                <Flame size={22} color="#F59E0B" />
              </div>
              <div>
                <h3 className="hm-bento-title">Trending in India</h3>
                <p className="hm-bento-desc">
                  Bollywood anthems, Punjabi beats, and pan-Indian sensations
                </p>
              </div>
            </div>

            {/* Tile 2: Chill & Lofi */}
            <div
              className="hm-bento-tile theme-chill"
              onClick={() => setActiveTab('moods')}
              role="button"
              tabIndex={0}
            >
              <div className="hm-bento-top">
                <span className="hm-bento-badge">CHILL</span>
                <Sparkles size={20} color="#C084FC" />
              </div>
              <div>
                <h3 className="hm-bento-title">Late Night</h3>
                <p className="hm-bento-desc">Acoustic, lofi & dreamy</p>
              </div>
            </div>

            {/* Tile 3: South Blockbusters */}
            <div
              className="hm-bento-tile theme-south"
              onClick={() => setActiveTab('telugu')}
              role="button"
              tabIndex={0}
            >
              <div className="hm-bento-top">
                <span className="hm-bento-badge">SOUTH</span>
                <Music size={20} color="#34D399" />
              </div>
              <div>
                <h3 className="hm-bento-title">South Beats</h3>
                <p className="hm-bento-desc">Telugu, Tamil & Malayalam</p>
              </div>
            </div>

            {/* Tile 4: Global Hits (Span 2) */}
            <div
              className="hm-bento-tile span-2 theme-global"
              onClick={() => setActiveTab('english')}
              role="button"
              tabIndex={0}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="hm-bento-badge">GLOBAL</span>
                  <Globe size={18} color="var(--accent-warm, #E7A58D)" />
                </div>
                <h3 className="hm-bento-title" style={{ margin: 0 }}>International Top 40</h3>
                <p className="hm-bento-desc">Billboard Hot 100, viral pop & UK hits</p>
              </div>
              <ChevronRight size={20} color="var(--accent-warm, #E7A58D)" />
            </div>
          </div>
        </section>
      )}

      {/* 5. Ranked Top 10 Spotlight (with #1 Gold, #2 Silver, #3 Bronze badges) */}
      {(activeTab === 'all' || activeTab === 'trending') && top10Ranked.length > 0 && (
        <section className="hm-mobile-ranked-section" aria-label="Top Ranked Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Top 10 Spotlight</h2>
              <span className="hm-mobile-section-badge">INDIA CHARTS</span>
            </div>
          </div>

          <div className="hm-ranked-list">
            {top10Ranked.map((song, index) => {
              const rank = index + 1;
              const isCurrent = currentSong?.id === song.id;
              const isThisPlaying = isCurrent && isPlaying;
              const rankClass =
                rank === 1
                  ? 'rank-1'
                  : rank === 2
                  ? 'rank-2'
                  : rank === 3
                  ? 'rank-3'
                  : 'rank-other';

              const artUrl = song.artwork?.imageUrl;

              return (
                <div
                  key={`ranked-${song.id}`}
                  className={`hm-ranked-item ${isCurrent ? 'is-playing' : ''}`}
                  onClick={() => handleTrackPlay(song)}
                  role="button"
                  tabIndex={0}
                  aria-label={`#${rank} ${song.title} by ${song.artist}`}
                >
                  <div className={`hm-rank-badge ${rankClass}`}>
                    #{rank}
                  </div>

                  <div className="hm-ranked-thumb">
                    {artUrl ? (
                      <img
                        src={artUrl}
                        alt={song.title}
                        className="hm-ranked-thumb-img"
                        loading="lazy"
                      />
                    ) : (
                      <AbstractArtwork
                        artwork={song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size={44}
                        className="hm-ranked-thumb-img"
                      />
                    )}
                  </div>

                  <div className="hm-ranked-info">
                    <h4 className="hm-ranked-title">{song.title}</h4>
                    <p className="hm-ranked-artist">{song.artist}</p>
                  </div>

                  <button
                    type="button"
                    className={`hm-ranked-play-btn ${isThisPlaying ? 'active' : ''}`}
                    onClick={(e) => handleTrackPlay(song, e)}
                    aria-label={isThisPlaying ? 'Pause' : 'Play'}
                  >
                    {isThisPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Featured Artists Reel */}
      {(activeTab === 'all' || activeTab === 'artists') && (
        <section className="hm-mobile-artists-section" aria-label="Featured Artists">
          <div className="hm-mobile-section-header">
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Featured Artists</h2>
              <span className="hm-mobile-section-badge">ICONS</span>
            </div>
            {activeTab === 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('artists')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-warm, #E7A58D)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>View All</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="hm-artist-reel">
            {featuredArtists.map((artist) => {
              const isSelected = selectedArtist === artist.name;
              return (
                <div
                  key={artist.id}
                  className="hm-artist-bubble"
                  onClick={() => {
                    setSelectedArtist(isSelected ? null : artist.name);
                    if (activeTab !== 'artists') setActiveTab('artists');
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Artist ${artist.name}`}
                >
                  <div
                    className="hm-artist-avatar"
                    style={{
                      borderColor: isSelected
                        ? 'var(--accent-warm, #E7A58D)'
                        : 'rgba(231, 165, 141, 0.3)',
                      boxShadow: isSelected
                        ? '0 0 14px rgba(231, 165, 141, 0.4)'
                        : 'none'
                    }}
                  >
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        className="hm-artist-avatar-img"
                        loading="lazy"
                      />
                    ) : (
                      <span>{artist.initial}</span>
                    )}
                  </div>
                  <h4 className="hm-artist-name">{artist.name}</h4>
                  <span className="hm-artist-lang">{artist.language}</span>
                </div>
              );
            })}
          </div>

          {/* Selected Artist Tracks if in artist mode */}
          {selectedArtist && artistSongs.length > 0 && (
            <div style={{ padding: '20px 16px 0 16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px'
                }}
              >
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    margin: 0
                  }}
                >
                  Popular by {selectedArtist}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedArtist(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="hm-mobile-cards-grid">
                {artistSongs.map((song) => (
                  <MusicCard key={`artist-${song.id}`} song={song} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 7. Moods View (shown when activeTab === 'moods') */}
      {activeTab === 'moods' && (
        <section style={{ padding: '0 16px', marginBottom: '28px' }} aria-label="Moods Catalog">
          <HomeMoods title="All Moods & Genres" id="mobile-home-moods" />
        </section>
      )}

      {/* 8. Categorized Content Grids for specific language tabs */}
      {activeTab === 'hindi' && (
        <section className="hm-mobile-grid-section" aria-label="Hindi Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Popular Hindi</h2>
              <span className="hm-mobile-section-badge">{hindiTop10.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {hindiTop10.map((song) => (
              <MusicCard key={`hindi-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'telugu' && (
        <section className="hm-mobile-grid-section" aria-label="Telugu Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Popular Telugu</h2>
              <span className="hm-mobile-section-badge">{teluguTop10.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {teluguTop10.map((song) => (
              <MusicCard key={`telugu-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'tamil' && (
        <section className="hm-mobile-grid-section" aria-label="Tamil Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Popular Tamil</h2>
              <span className="hm-mobile-section-badge">{tamilTop10.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {tamilTop10.map((song) => (
              <MusicCard key={`tamil-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'malayalam' && (
        <section className="hm-mobile-grid-section" aria-label="Malayalam Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Popular Malayalam</h2>
              <span className="hm-mobile-section-badge">{malayalamTop10.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {malayalamTop10.map((song) => (
              <MusicCard key={`malayalam-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'english' && (
        <section className="hm-mobile-grid-section" aria-label="English Songs">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">Popular English</h2>
              <span className="hm-mobile-section-badge">{englishTop10.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {englishTop10.map((song) => (
              <MusicCard key={`english-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'new' && (
        <section className="hm-mobile-grid-section" aria-label="New Releases">
          <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="hm-mobile-section-title-wrap">
              <h2 className="hm-mobile-section-title">New Releases</h2>
              <span className="hm-mobile-section-badge">{newReleases.length} TRACKS</span>
            </div>
          </div>
          <div className="hm-mobile-cards-grid">
            {newReleases.map((song) => (
              <MusicCard key={`new-${song.id}`} song={song} />
            ))}
          </div>
        </section>
      )}

      {/* 9. When activeTab === 'all', show New Releases and South Highlights with visual rhythm */}
      {activeTab === 'all' && (
        <>
          <section className="hm-mobile-grid-section" aria-label="New Releases Section">
            <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="hm-mobile-section-title-wrap">
                <h2 className="hm-mobile-section-title">Fresh Drops</h2>
                <span className="hm-mobile-section-badge">NEW</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-warm, #E7A58D)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>More</span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="hm-mobile-cards-grid">
              {newReleases.slice(0, 4).map((song) => (
                <MusicCard key={`fresh-${song.id}`} song={song} />
              ))}
            </div>
          </section>

          <section className="hm-mobile-grid-section" aria-label="Telugu Hits Section">
            <div className="hm-mobile-section-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="hm-mobile-section-title-wrap">
                <h2 className="hm-mobile-section-title">Telugu Melodies & Beats</h2>
                <span className="hm-mobile-section-badge">TELUGU</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('telugu')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-warm, #E7A58D)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>More</span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="hm-mobile-cards-grid">
              {teluguTop10.slice(0, 4).map((song) => (
                <MusicCard key={`te-all-${song.id}`} song={song} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
