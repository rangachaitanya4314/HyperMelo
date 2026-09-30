import React, { useState, useEffect } from 'react';
import { Search, WifiOff, Loader2 } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from '../components/MusicCard';
import { appleMusicCatalogProvider } from '../services/providers/AppleMusicCatalogProvider';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import type { Song } from '../types/music';

export const DiscoverPage: React.FC = () => {
  const { isOnline, setSearchModalOpen, setSearchQuery } = useAudioPlayer();
  const [activeMood, setActiveMood] = useState<string>('all');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const moods = [
    { id: 'all', label: 'All Curations' },
    { id: 'trending', label: 'Trending Hits' },
    { id: 'hindi', label: 'Hindi' },
    { id: 'telugu', label: 'Telugu' },
    { id: 'midnight', label: 'Midnight Ambient' },
    { id: 'romantic', label: 'Romantic' },
    { id: 'energetic', label: 'Energetic' }
  ];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (!isOnline) {
      setSongs(musicCatalogService.getFallbackCatalog());
      setLoading(false);
      return;
    }

    appleMusicCatalogProvider
      .getTrending(activeMood)
      .then((res) => {
        if (isMounted) {
          if (res.length > 0) {
            setSongs(res);
          } else {
            setSongs(musicCatalogService.getFallbackCatalog());
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSongs(musicCatalogService.getFallbackCatalog());
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeMood, isOnline]);

  const handleSearchShortcut = (term: string) => {
    setSearchQuery(term);
    setSearchModalOpen(true);
  };

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 64px) 120px',
        width: '100%'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--accent-warm)',
              textTransform: 'uppercase'
            }}
          >
            GLOBAL DISCOVERY
          </span>
          <span
            style={{
              width: '32px',
              height: '1px',
              backgroundColor: 'rgba(231, 165, 141, 0.3)'
            }}
          />
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 3.8vw, 3.2rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0
          }}
        >
          DISCOVER
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1rem',
            marginTop: '8px',
            maxWidth: '560px'
          }}
        >
          Explore current and historical songs across languages with authorized streaming inside the NARO player.
        </p>

        {/* Quick Search Trigger */}
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => handleSearchShortcut('')}
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              width: '100%',
              maxWidth: '480px'
            }}
          >
            <Search size={18} color="var(--accent-warm)" />
            <span style={{ fontSize: '0.92rem' }}>Search any song, artist, Hindi or Telugu lyrics...</span>
          </button>
        </div>
      </div>

      {/* Mood Filter Chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '36px'
        }}
      >
        {moods.map((m) => {
          const isSelected = activeMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveMood(m.id)}
              style={{
                backgroundColor: isSelected ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.05)',
                color: isSelected ? '#080B10' : 'var(--text-muted)',
                border: isSelected ? '1px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '8px 18px',
                fontSize: '0.84rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Offline Banner if applicable */}
      {!isOnline && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#FCA5A5',
            fontSize: '0.88rem',
            marginBottom: '32px'
          }}
        >
          <WifiOff size={16} />
          <span>You&apos;re offline. Showing fallback catalog. Connect to the internet to stream live global discoveries.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', padding: '40px 0' }}>
          <Loader2 size={20} className="animate-spin" color="var(--accent-warm)" />
          <span>Loading live tracks from catalog...</span>
        </div>
      ) : (
        /* Grid of tracks */
        <div
          className="music-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '24px'
          }}
        >
          {songs.map((song) => (
            <MusicCard key={song.id} song={song} />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 1080px) {
          .music-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 20px !important;
          }
        }
        @media (max-width: 600px) {
          .music-card-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
