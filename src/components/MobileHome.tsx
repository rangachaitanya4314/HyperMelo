import React, { useState } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Users,
  ChevronRight,
  X,
  Flame,
  Music
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { BeatSyncedVisualizer } from './BeatSyncedVisualizer';
import { AbstractArtwork } from './AbstractArtwork';
import {
  QUICK_PICKS_SONGS,
  TRENDING_INDIA_SONGS,
  NEW_RELEASES_SONGS
} from '../data/curatedCatalog';
import { ALL_ARTISTS } from '../data/artistCatalog';
import './MobileHome.css';

export const MobileHome: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playSong,
    openNowPlaying,
    currentUser,
    isAuthenticated,
    openAuthModal,
    setCurrentView
  } = useAudioPlayer();

  const [authBannerDismissed, setAuthBannerDismissed] = useState(false);

  const topPicks = QUICK_PICKS_SONGS.slice(0, 10);
  const featuredArtists = ALL_ARTISTS.slice(0, 10);
  const newReleases = NEW_RELEASES_SONGS.slice(0, 10);
  const trendingHits = TRENDING_INDIA_SONGS.slice(0, 10);

  return (
    <div className="hm-mobile-home-container" role="region" aria-label="Mobile Home Feed">
      {/* 1. Sleek Hypermelo / Google Authentication Card (Top of Mobile Feed) */}
      {!isAuthenticated && !authBannerDismissed ? (
        <div className="hm-mobile-auth-banner" role="banner">
          <div className="hm-mobile-auth-lead">
            <div className="hm-brand-icon-wrap" aria-hidden="true">
              {/* Hypermelo official app icon */}
              <img
                src="/brand/hypermelo_app_icon.png"
                alt="Hypermelo"
                className="hm-brand-badge-img"
              />
            </div>
            <div className="hm-mobile-auth-copy">
              <h3 className="hm-mobile-auth-title">Sign in to Hypermelo</h3>
              <p className="hm-mobile-auth-desc">
                Connect your account for personalized picks & saved library
              </p>
            </div>
          </div>
          <div className="hm-mobile-auth-ctrls">
            <button
              type="button"
              id="mobile-home-signin-btn"
              data-testid="mobile-home-signin-btn"
              className="hm-mobile-signin-btn"
              onClick={() => openAuthModal('signin')}
              aria-label="Sign In to Hypermelo"
            >
              Sign In
            </button>
            <button
              type="button"
              className="hm-mobile-dismiss-btn"
              onClick={() => setAuthBannerDismissed(true)}
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : isAuthenticated ? (
        <div className="hm-mobile-welcome-card">
          <div className="hm-mobile-user-avatar" aria-hidden="true">
            {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hm-mobile-welcome-copy">
            <span className="hm-mobile-welcome-badge">PERSONALIZED FOR YOU</span>
            <h3 className="hm-mobile-welcome-name">Welcome, {currentUser?.name}</h3>
          </div>
        </div>
      ) : null}

      {/* 2. Prominent Interactive Audio Visualizer on Mobile Home */}
      <section className="hm-mobile-visualizer-section" aria-label="Interactive Audio Visualizer">
        <div className="hm-mobile-visualizer-ambient-glow" aria-hidden="true" />

        <div className="hm-mobile-visualizer-box">
          <BeatSyncedVisualizer
            artwork={currentSong?.artwork}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            interactive={true}
            mode="hero"
            songTitle={currentSong?.title ?? 'HyperMelo Experience'}
            songArtist={currentSong?.artist ?? 'Select a track to listen'}
            size="100%"
          />
        </div>

        {/* Visualizer Metadata & Fast Action Controls */}
        <div className="hm-mobile-viz-meta">
          <div className="hm-mobile-viz-song-info">
            <span className="hm-mobile-viz-status-pill">
              <span className={`hm-viz-live-dot ${isPlaying ? 'pulsing' : ''}`} />
              {isPlaying ? 'ACTIVE LISTENING' : 'READY TO PLAY'}
            </span>
            <h2 className="hm-mobile-viz-title" title={currentSong?.title || 'HyperMelo'}>
              {currentSong?.title || 'Feel the song. Make it yours.'}
            </h2>
            <p className="hm-mobile-viz-artist">
              {currentSong?.artist || 'Tap visualizer or choose a track below'}
            </p>
          </div>

          <div className="hm-mobile-viz-actions">
            <button
              type="button"
              id="mobile-home-play-toggle-btn"
              data-testid="mobile-home-play-toggle-btn"
              className="hm-mobile-viz-play-btn"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause song' : 'Play song'}
            >
              {isPlaying ? <Pause size={18} fill="#080B10" /> : <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              type="button"
              id="mobile-home-open-nowplaying-btn"
              data-testid="mobile-home-open-nowplaying-btn"
              className="hm-mobile-viz-open-btn"
              onClick={openNowPlaying}
              aria-label="Open Full Now Playing Screen"
            >
              <span>NOW PLAYING</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* 3. "Top Picks for You" Horizontal Card Carousel */}
      <section className="hm-mobile-shelf-section" aria-label="Top Picks for You">
        <div className="hm-mobile-shelf-header">
          <div className="hm-mobile-shelf-title-cluster">
            <Sparkles size={18} color="var(--accent-warm, #E7A58D)" />
            <h3 className="hm-mobile-shelf-title">Top Picks for You</h3>
          </div>
          <button
            type="button"
            className="hm-mobile-shelf-see-all"
            onClick={() => setCurrentView('discover')}
            aria-label="See all Top Picks in Explore"
          >
            <span>See All</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="hm-mobile-cards-carousel" role="list">
          {topPicks.map((song) => {
            const isThisCurrent = currentSong?.id === song.id;
            const isThisPlaying = isThisCurrent && isPlaying;
            return (
              <div
                key={`top-pick-${song.id}`}
                role="listitem"
                className={`hm-mobile-card-item ${isThisCurrent ? 'is-active' : ''}`}
                onClick={() => playSong(song, 0)}
              >
                <div className="hm-mobile-card-thumb-wrap">
                  <AbstractArtwork
                    artwork={song.artwork}
                    song={song}
                    isPlaying={isThisPlaying}
                    size="100%"
                  />
                  <button
                    type="button"
                    className="hm-mobile-card-hover-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isThisCurrent) togglePlay();
                      else playSong(song, 0);
                    }}
                    aria-label={`Play ${song.title}`}
                  >
                    {isThisPlaying ? (
                      <Pause size={18} fill="#080B10" />
                    ) : (
                      <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />
                    )}
                  </button>
                  {isThisCurrent && <div className="hm-mobile-card-now-playing-badge">PLAYING</div>}
                </div>
                <div className="hm-mobile-card-meta">
                  <div className="hm-mobile-card-title" title={song.title}>
                    {song.title}
                  </div>
                  <div className="hm-mobile-card-subtitle" title={song.artist}>
                    {song.artist}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. "Featured Artists" Circular Highlight Bubbles */}
      <section className="hm-mobile-shelf-section" aria-label="Featured Artists">
        <div className="hm-mobile-shelf-header">
          <div className="hm-mobile-shelf-title-cluster">
            <Users size={18} color="var(--accent-warm, #E7A58D)" />
            <h3 className="hm-mobile-shelf-title">Featured Artists</h3>
          </div>
          <button
            type="button"
            className="hm-mobile-shelf-see-all"
            onClick={() => setCurrentView('discover')}
            aria-label="View all artists"
          >
            <span>Explore</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="hm-mobile-artist-bubbles-scroll" role="list">
          {featuredArtists.map((artist) => (
            <button
              key={`artist-bubble-${artist.id}`}
              type="button"
              role="listitem"
              className="hm-mobile-artist-bubble-btn"
              onClick={() => {
                const matchedSong = QUICK_PICKS_SONGS.find((s) =>
                  s.artist.toLowerCase().includes(artist.name.toLowerCase())
                ) || TRENDING_INDIA_SONGS.find((s) =>
                  s.artist.toLowerCase().includes(artist.name.toLowerCase())
                );
                if (matchedSong) {
                  playSong(matchedSong, 0);
                } else {
                  setCurrentView('discover');
                }
              }}
              aria-label={`Listen to ${artist.name}`}
            >
              <div className="hm-mobile-artist-img-frame">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="hm-mobile-artist-img"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="hm-mobile-artist-fallback-letter" aria-hidden="true">
                  {artist.initial || artist.name.charAt(0)}
                </div>
              </div>
              <span className="hm-mobile-artist-bubble-name">{artist.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 5. "New Releases & Trending Hits" Horizontal Carousel */}
      <section className="hm-mobile-shelf-section" aria-label="New Releases">
        <div className="hm-mobile-shelf-header">
          <div className="hm-mobile-shelf-title-cluster">
            <Flame size={18} color="#F87171" />
            <h3 className="hm-mobile-shelf-title">New Releases & Hits</h3>
          </div>
          <button
            type="button"
            className="hm-mobile-shelf-see-all"
            onClick={() => setCurrentView('discover')}
            aria-label="See all new releases"
          >
            <span>More</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="hm-mobile-cards-carousel" role="list">
          {newReleases.map((song) => {
            const isThisCurrent = currentSong?.id === song.id;
            const isThisPlaying = isThisCurrent && isPlaying;
            return (
              <div
                key={`new-release-${song.id}`}
                role="listitem"
                className={`hm-mobile-card-item ${isThisCurrent ? 'is-active' : ''}`}
                onClick={() => playSong(song, 0)}
              >
                <div className="hm-mobile-card-thumb-wrap">
                  <AbstractArtwork
                    artwork={song.artwork}
                    song={song}
                    isPlaying={isThisPlaying}
                    size="100%"
                  />
                  <button
                    type="button"
                    className="hm-mobile-card-hover-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isThisCurrent) togglePlay();
                      else playSong(song, 0);
                    }}
                    aria-label={`Play ${song.title}`}
                  >
                    {isThisPlaying ? (
                      <Pause size={18} fill="#080B10" />
                    ) : (
                      <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />
                    )}
                  </button>
                </div>
                <div className="hm-mobile-card-meta">
                  <div className="hm-mobile-card-title" title={song.title}>
                    {song.title}
                  </div>
                  <div className="hm-mobile-card-subtitle" title={song.artist}>
                    {song.artist}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Trending in India Carousel */}
      <section className="hm-mobile-shelf-section" aria-label="Trending Hits">
        <div className="hm-mobile-shelf-header">
          <div className="hm-mobile-shelf-title-cluster">
            <Music size={18} color="var(--accent-cream, #F4DFC9)" />
            <h3 className="hm-mobile-shelf-title">Trending in India</h3>
          </div>
          <button
            type="button"
            className="hm-mobile-shelf-see-all"
            onClick={() => setCurrentView('discover')}
            aria-label="See all trending tracks"
          >
            <span>All</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="hm-mobile-cards-carousel" role="list">
          {trendingHits.map((song) => {
            const isThisCurrent = currentSong?.id === song.id;
            const isThisPlaying = isThisCurrent && isPlaying;
            return (
              <div
                key={`trending-${song.id}`}
                role="listitem"
                className={`hm-mobile-card-item ${isThisCurrent ? 'is-active' : ''}`}
                onClick={() => playSong(song, 0)}
              >
                <div className="hm-mobile-card-thumb-wrap">
                  <AbstractArtwork
                    artwork={song.artwork}
                    song={song}
                    isPlaying={isThisPlaying}
                    size="100%"
                  />
                  <button
                    type="button"
                    className="hm-mobile-card-hover-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isThisCurrent) togglePlay();
                      else playSong(song, 0);
                    }}
                    aria-label={`Play ${song.title}`}
                  >
                    {isThisPlaying ? (
                      <Pause size={18} fill="#080B10" />
                    ) : (
                      <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />
                    )}
                  </button>
                </div>
                <div className="hm-mobile-card-meta">
                  <div className="hm-mobile-card-title" title={song.title}>
                    {song.title}
                  </div>
                  <div className="hm-mobile-card-subtitle" title={song.artist}>
                    {song.artist}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
