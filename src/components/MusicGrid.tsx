import React, { useEffect, useState } from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from './MusicCard';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import type { CatalogSection } from '../types/music';
import { Sparkles, WifiOff } from 'lucide-react';

export const MusicGrid: React.FC = () => {
  const { isOnline } = useAudioPlayer();
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    musicCatalogService
      .getDiscoverySections()
      .then((data) => {
        if (isMounted) {
          setSections(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSections([
            {
              id: 'fallback',
              title: 'MADE FOR YOU',
              subtitle: 'Curated tracks engineered for active listening and precise moment-by-moment karaoke.',
              songs: musicCatalogService.getFallbackCatalog(),
              isDynamicLive: false
            }
          ]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOnline]);

  return (
    <section
      id="discover"
      aria-label="Discovery Section"
      style={{
        padding: 'clamp(48px, 6vw, 96px) clamp(16px, 5vw, 64px)',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '64px'
      }}
    >
      {/* Offline Notice if applicable */}
      {!isOnline && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#FCA5A5',
            fontSize: '0.9rem'
          }}
        >
          <WifiOff size={18} />
          <div>
            <strong>Offline Mode Active:</strong> Showing previously saved and local fallback content. Connect to the internet to search and stream live global catalogs.
          </div>
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '12px 0' }}>
          Connecting to live music catalogs...
        </div>
      )}

      {/* Render Each Discovery Section */}
      {sections.map((section) => (
        <div key={section.id} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Section Header */}
          <div style={{ marginBottom: '28px' }}>
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
                {section.title}
              </span>
              <span
                style={{
                  width: '32px',
                  height: '1px',
                  backgroundColor: 'rgba(231, 165, 141, 0.3)'
                }}
              />
              {section.isDynamicLive && (
                <span
                  style={{
                    fontSize: '0.66rem',
                    color: 'var(--secondary-blue)',
                    border: '1px solid rgba(143, 168, 200, 0.3)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={10} /> Live Stream
                </span>
              )}
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.8rem, 2.8vw, 2.4rem)',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                margin: 0
              }}
            >
              {section.title === 'MADE FOR YOU' ? 'Pick a mood.' : section.title}
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.96rem',
                marginTop: '6px',
                maxWidth: '560px'
              }}
            >
              {section.subtitle}
            </p>
          </div>

          {/* Cards Grid */}
          <div
            className="music-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '24px'
            }}
          >
            {section.songs.map((song) => (
              <MusicCard key={song.id} song={song} />
            ))}
          </div>
        </div>
      ))}

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
    </section>
  );
};
