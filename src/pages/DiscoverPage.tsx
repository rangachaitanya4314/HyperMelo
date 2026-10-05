import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, WifiOff, Loader2, Sparkles, TrendingUp, Music, Globe, Users, Flame, Disc } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from '../components/MusicCard';
import { appleMusicCatalogProvider } from '../services/providers/AppleMusicCatalogProvider';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import type { Song } from '../types/music';

interface DiscoverSectionData {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  icon: React.ReactNode;
}

const TOP_ARTISTS = [
  { name: 'Arijit Singh', language: 'Hindi', genre: 'Romantic / Soulful', initial: 'AS' },
  { name: 'Anirudh Ravichander', language: 'Tamil / Telugu', genre: 'High-Energy Pop', initial: 'AR' },
  { name: 'Sid Sriram', language: 'Telugu / Tamil', genre: 'Carnatic Pop', initial: 'SS' },
  { name: 'Shreya Ghoshal', language: 'Multilingual', genre: 'Melodic Classical', initial: 'SG' },
  { name: 'Josh Woodward', language: 'English', genre: 'Acoustic Indie Rock', initial: 'JW' },
  { name: 'Aarav', language: 'English / Hindi', genre: 'Late-Night Synth', initial: 'AA' },
  { name: 'Anika', language: 'Telugu', genre: 'Indie Melodic', initial: 'AN' }
];

export const DiscoverPage: React.FC = () => {
  const { isOnline, setSearchModalOpen, setSearchQuery } = useAudioPlayer();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Discovery section data state
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [hindiTop10, setHindiTop10] = useState<Song[]>([]);
  const [teluguTop10, setTeluguTop10] = useState<Song[]>([]);
  const [tamilTop10, setTamilTop10] = useState<Song[]>([]);
  const [malayalamTop10, setMalayalamTop10] = useState<Song[]>([]);
  const [englishTop10, setEnglishTop10] = useState<Song[]>([]);
  const [newReleases, setNewReleases] = useState<Song[]>([]);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);

  const fallbackCatalog = useMemo(() => musicCatalogService.getFallbackCatalog(), []);

  // Fetch all sections concurrently
  const loadDiscoveryData = useCallback(async () => {
    setLoading(true);

    if (!isOnline) {
      // Partition fallback catalog
      setTrendingSongs(fallbackCatalog);
      setHindiTop10(fallbackCatalog.filter((s) => s.language === 'hi' || s.originalLanguage === 'hi'));
      setTeluguTop10(fallbackCatalog.filter((s) => s.language === 'te' || s.originalLanguage === 'te'));
      setTamilTop10(fallbackCatalog.filter((s) => s.language === 'ta' || s.originalLanguage === 'ta'));
      setMalayalamTop10(fallbackCatalog.filter((s) => s.language === 'ml' || s.originalLanguage === 'ml'));
      setEnglishTop10(fallbackCatalog.filter((s) => s.language === 'en' || s.originalLanguage === 'en'));
      setNewReleases(fallbackCatalog);
      setLoading(false);
      return;
    }

    try {
      const [
        trendingRes,
        hindiRes,
        teluguRes,
        tamilRes,
        malayalamRes,
        englishRes,
        newRes
      ] = await Promise.allSettled([
        appleMusicCatalogProvider.getTrending('all'),
        appleMusicCatalogProvider.search('hindi top 10 songs 2024 arijit', { limit: 10 }),
        appleMusicCatalogProvider.search('telugu top hits anirudh devara', { limit: 10 }),
        appleMusicCatalogProvider.search('tamil top hits anirudh leo', { limit: 10 }),
        appleMusicCatalogProvider.search('malayalam top songs sushin shyam', { limit: 10 }),
        appleMusicCatalogProvider.search('top global billboard hits 2024', { limit: 10 }),
        appleMusicCatalogProvider.search('new latest single releases 2024', { limit: 8 })
      ]);

      const normalizeResults = async (res: PromiseSettledResult<any>): Promise<Song[]> => {
        if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
          // If already normalized Song array
          if ('sections' in res.value[0] || 'playbackSource' in res.value[0]) {
            return res.value as Song[];
          }
          return Promise.all(res.value.map((item) => appleMusicCatalogProvider.normalizeSong(item)));
        }
        return [];
      };

      const [
        normTrending,
        normHindi,
        normTelugu,
        normTamil,
        normMalayalam,
        normEnglish,
        normNew
      ] = await Promise.all([
        normalizeResults(trendingRes),
        normalizeResults(hindiRes),
        normalizeResults(teluguRes),
        normalizeResults(tamilRes),
        normalizeResults(malayalamRes),
        normalizeResults(englishRes),
        normalizeResults(newRes)
      ]);

      setTrendingSongs(normTrending.length > 0 ? normTrending : fallbackCatalog);
      setHindiTop10(normHindi.length > 0 ? normHindi : fallbackCatalog.filter((s) => s.language === 'hi'));
      setTeluguTop10(normTelugu.length > 0 ? normTelugu : fallbackCatalog.filter((s) => s.language === 'te'));
      setTamilTop10(normTamil.length > 0 ? normTamil : fallbackCatalog);
      setMalayalamTop10(normMalayalam.length > 0 ? normMalayalam : fallbackCatalog);
      setEnglishTop10(normEnglish.length > 0 ? normEnglish : fallbackCatalog.filter((s) => s.language === 'en'));
      setNewReleases(normNew.length > 0 ? normNew : fallbackCatalog);
    } catch {
      setTrendingSongs(fallbackCatalog);
      setHindiTop10(fallbackCatalog);
      setTeluguTop10(fallbackCatalog);
      setTamilTop10(fallbackCatalog);
      setMalayalamTop10(fallbackCatalog);
      setEnglishTop10(fallbackCatalog);
      setNewReleases(fallbackCatalog);
    } finally {
      setLoading(false);
    }
  }, [isOnline, fallbackCatalog]);

  useEffect(() => {
    loadDiscoveryData();
  }, [loadDiscoveryData]);

  // Load artist songs when artist is selected
  useEffect(() => {
    if (!selectedArtist) {
      setArtistSongs([]);
      return;
    }

    let isMounted = true;
    const loadArtistMusic = async () => {
      // Check fallback catalog first
      const localMatches = fallbackCatalog.filter((s) =>
        s.artist.toLowerCase().includes(selectedArtist.toLowerCase())
      );

      if (!isOnline || localMatches.length >= 4) {
        if (isMounted) setArtistSongs(localMatches.length > 0 ? localMatches : fallbackCatalog);
        return;
      }

      try {
        const results = await appleMusicCatalogProvider.search(selectedArtist, { limit: 12 });
        const normalized = await Promise.all(
          results.map((r) => appleMusicCatalogProvider.normalizeSong(r))
        );
        if (isMounted) {
          setArtistSongs(normalized.length > 0 ? normalized : localMatches);
        }
      } catch {
        if (isMounted) setArtistSongs(localMatches.length > 0 ? localMatches : fallbackCatalog);
      }
    };

    loadArtistMusic();
    return () => {
      isMounted = false;
    };
  }, [selectedArtist, isOnline, fallbackCatalog]);

  const handleSearchShortcut = (term: string) => {
    setSearchQuery(term);
    setSearchModalOpen(true);
  };

  const sections: DiscoverSectionData[] = useMemo(() => {
    return [
      {
        id: 'trending',
        title: 'Trending Now',
        subtitle: 'The hottest tracks currently playing across the globe.',
        songs: trendingSongs,
        icon: <Flame size={20} color="#F59E0B" />
      },
      {
        id: 'hindi',
        title: 'Top 10 Hindi',
        subtitle: 'Most popular Bollywood melodies and Indie Hindi charts.',
        songs: hindiTop10,
        icon: <Music size={20} color="var(--accent-warm)" />
      },
      {
        id: 'telugu',
        title: 'Top 10 Telugu',
        subtitle: 'Tollywood sensations, mass beats, and heartfelt melodies.',
        songs: teluguTop10,
        icon: <Sparkles size={20} color="#38BDF8" />
      },
      {
        id: 'tamil',
        title: 'Top 10 Tamil',
        subtitle: 'Kollywood chartbusters and soul-stirring compositions.',
        songs: tamilTop10,
        icon: <TrendingUp size={20} color="#10B981" />
      },
      {
        id: 'malayalam',
        title: 'Top 10 Malayalam',
        subtitle: 'Mollywood indie acoustics and progressive melodies.',
        songs: malayalamTop10,
        icon: <Globe size={20} color="#A78BFA" />
      },
      {
        id: 'english',
        title: 'Top 10 English',
        subtitle: 'Global chart-toppers, acoustic pop, and indie gems.',
        songs: englishTop10,
        icon: <Disc size={20} color="#F472B6" />
      },
      {
        id: 'new',
        title: 'New Releases',
        subtitle: 'Fresh drops and newly licensed commercial singles.',
        songs: newReleases,
        icon: <Sparkles size={20} color="var(--accent-cream)" />
      },
      {
        id: 'made-for-you',
        title: 'Made for You',
        subtitle: 'Curated NARO tracks calibrated for premium listening room acoustics.',
        songs: fallbackCatalog,
        icon: <Sparkles size={20} color="var(--accent-warm)" />
      }
    ];
  }, [
    trendingSongs,
    hindiTop10,
    teluguTop10,
    tamilTop10,
    malayalamTop10,
    englishTop10,
    newReleases,
    fallbackCatalog
  ]);

  const filterTabs = [
    { id: 'all', label: 'All Discoveries' },
    { id: 'trending', label: 'Trending Now' },
    { id: 'hindi', label: 'Top 10 Hindi' },
    { id: 'telugu', label: 'Top 10 Telugu' },
    { id: 'tamil', label: 'Top 10 Tamil' },
    { id: 'malayalam', label: 'Top 10 Malayalam' },
    { id: 'english', label: 'Top 10 English' },
    { id: 'artists', label: 'Top Artists' },
    { id: 'new', label: 'New Releases' },
    { id: 'made-for-you', label: 'Made for You' }
  ];

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
            maxWidth: '620px',
            lineHeight: 1.5
          }}
        >
          Explore chart-topping music, language-based Top 10s, and curated artists across Hindi,
          Telugu, Tamil, Malayalam, and English with full-length streaming.
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
            <span style={{ fontSize: '0.92rem' }}>
              Search any song, artist, Hindi, Telugu, or Tamil tracks...
            </span>
          </button>
        </div>
      </div>

      {/* Discovery Navigation / Filter Pills */}
      <div
        role="tablist"
        aria-label="Discover sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '36px'
        }}
      >
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
              style={{
                backgroundColor: isSelected ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.05)',
                color: isSelected ? '#080B10' : 'var(--text-muted)',
                border: isSelected
                  ? '1px solid var(--accent-warm)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '8px 18px',
                fontSize: '0.84rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
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
          <span>
            You&apos;re offline. Showing fallback catalog. Connect to the internet to stream live
            global discoveries.
          </span>
        </div>
      )}

      {/* Top Artists Row (shown on 'all' or 'artists' tab) */}
      {(activeTab === 'all' || activeTab === 'artists') && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Users size={20} color="var(--accent-warm)" />
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}
            >
              Top Artists
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px 0' }}>
            Browse curated artist collections across Indian languages and global indie sounds.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '16px'
            }}
          >
            {TOP_ARTISTS.map((artist) => {
              const isSelected = selectedArtist === artist.name;
              return (
                <div
                  key={artist.name}
                  onClick={() => {
                    setSelectedArtist(isSelected ? null : artist.name);
                    if (activeTab !== 'artists') setActiveTab('artists');
                  }}
                  className="glass-panel"
                  style={{
                    padding: '18px 14px',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'rgba(231, 165, 141, 0.15)'
                      : 'rgba(14, 18, 27, 0.7)',
                    border: isSelected
                      ? '1px solid var(--accent-warm)'
                      : '1px solid var(--border-subtle)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                      backgroundColor: isSelected
                        ? 'var(--accent-warm)'
                        : 'rgba(231, 165, 141, 0.12)',
                      color: isSelected ? '#080B10' : 'var(--accent-warm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      border: '1px solid rgba(231, 165, 141, 0.3)'
                    }}
                  >
                    {artist.initial}
                  </div>
                  <h4
                    style={{
                      fontSize: '0.94rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {artist.name}
                  </h4>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-dim)',
                      marginTop: '4px',
                      display: 'block'
                    }}
                  >
                    {artist.language}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected Artist Tracks */}
          {selectedArtist && (
            <div style={{ marginTop: '28px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}
              >
                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    color: 'var(--accent-cream)',
                    margin: 0
                  }}
                >
                  Popular by {selectedArtist}
                </h3>
                <button
                  onClick={() => setSelectedArtist(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '0.84rem'
                  }}
                >
                  Clear filter
                </button>
              </div>

              <div
                className="music-card-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '24px'
                }}
              >
                {artistSongs.map((song) => (
                  <MusicCard key={song.id} song={song} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Discover Content */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--text-muted)',
            padding: '60px 0'
          }}
        >
          <Loader2 size={24} className="animate-spin" color="var(--accent-warm)" />
          <span>Curating live music discovery charts...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          {sections
            .filter((sec) => activeTab === 'all' || activeTab === sec.id)
            .map((section) => {
              if (section.songs.length === 0) return null;

              return (
                <div key={section.id} id={`discover-section-${section.id}`}>
                  {/* Section Title & Subtitle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px'
                    }}
                  >
                    {section.icon}
                    <h2
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0
                      }}
                    >
                      {section.title}
                    </h2>
                  </div>
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      margin: '0 0 20px 0'
                    }}
                  >
                    {section.subtitle}
                  </p>

                  {/* Songs Grid */}
                  <div
                    className="music-card-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: '24px'
                    }}
                  >
                    {section.songs.map((song) => (
                      <MusicCard key={`${section.id}-${song.id}`} song={song} />
                    ))}
                  </div>
                </div>
              );
            })}
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
