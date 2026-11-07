import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, WifiOff, Loader2, Sparkles, TrendingUp, Music, Globe, Users, Flame, Disc, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from '../components/MusicCard';
import { HomeMoods } from '../components/HomeMoods';
import { appleMusicCatalogProvider } from '../services/providers/AppleMusicCatalogProvider';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import { chartService } from '../services/charts';
import { ALL_ARTISTS, findArtistByName, isArtistMatch } from '../data/artistCatalog';
import {
  TRENDING_INDIA_SONGS,
  HINDI_POPULAR_SONGS,
  TELUGU_POPULAR_SONGS,
  TAMIL_POPULAR_SONGS,
  MALAYALAM_POPULAR_SONGS,
  ENGLISH_POPULAR_SONGS,
  NEW_RELEASES_SONGS,
  QUICK_PICKS_SONGS,
  getAllCuratedSongs
} from '../data/curatedCatalog';
import { MOOD_CATALOG } from '../data/moodCatalog';
import { MobileDiscover } from '../components/MobileDiscover';
import type { Song } from '../types/music';

interface DiscoverSectionData {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  icon: React.ReactNode;
}

// In-memory cache for artist discoveries to eliminate repeated loading latency
const artistTrackCache = new Map<string, Song[]>();

export const DiscoverPage: React.FC = () => {
  const { isOnline, setSearchModalOpen, setSearchQuery } = useAudioPlayer();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [artistCategoryFilter, setArtistCategoryFilter] = useState<'all' | 'en' | 'hi' | 'te' | 'ta'>('all');
  const [showAllArtists, setShowAllArtists] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [tabLoading, setTabLoading] = useState<boolean>(false);

  // AbortController and request ID refs to prevent stale responses from overwriting active tab
  const tabRequestIdRef = React.useRef<number>(0);
  const tabAbortControllerRef = React.useRef<AbortController | null>(null);

  // Discovery section data state - pre-populated with verified curated songs so content is instantly interactive
  const [trendingSongs, setTrendingSongs] = useState<Song[]>(() => TRENDING_INDIA_SONGS);
  const [hindiTop10, setHindiTop10] = useState<Song[]>(() => HINDI_POPULAR_SONGS);
  const [teluguTop10, setTeluguTop10] = useState<Song[]>(() => TELUGU_POPULAR_SONGS);
  const [tamilTop10, setTamilTop10] = useState<Song[]>(() => TAMIL_POPULAR_SONGS);
  const [malayalamTop10, setMalayalamTop10] = useState<Song[]>(() => MALAYALAM_POPULAR_SONGS);
  const [englishTop10, setEnglishTop10] = useState<Song[]>(() => ENGLISH_POPULAR_SONGS);
  const [newReleases, setNewReleases] = useState<Song[]>(() => NEW_RELEASES_SONGS);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);

  const fallbackCatalog = useMemo(() => musicCatalogService.getFallbackCatalog(), []);

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Helper to ensure section contains >= 15 tracks without duplicates
  const padTracksIfNeeded = (liveSongs: Song[], fallback: Song[]): Song[] => {
    if (liveSongs.length >= 15) return liveSongs;
    const existingTitles = new Set(liveSongs.map((s) => s.title.toLowerCase().trim()));
    const padding = fallback.filter((s) => !existingTitles.has(s.title.toLowerCase().trim()));
    return [...liveSongs, ...padding];
  };

  // Fetch all sections progressively on initial load without blocking the UI
  const loadDiscoveryData = useCallback(async () => {
    if (!isOnline) {
      setTrendingSongs(TRENDING_INDIA_SONGS);
      setHindiTop10(HINDI_POPULAR_SONGS);
      setTeluguTop10(TELUGU_POPULAR_SONGS);
      setTamilTop10(TAMIL_POPULAR_SONGS);
      setMalayalamTop10(MALAYALAM_POPULAR_SONGS);
      setEnglishTop10(ENGLISH_POPULAR_SONGS);
      setNewReleases(NEW_RELEASES_SONGS);
      return;
    }

    const loadSection = async (
      chartId: string,
      fallback: Song[],
      setter: React.Dispatch<React.SetStateAction<Song[]>>
    ) => {
      try {
        const snap = await chartService.getChart(chartId);
        if (snap?.tracks && snap.tracks.length > 0) {
          const songs = snap.tracks.map((t) => chartService.toSong(t));
          setter(padTracksIfNeeded(songs, fallback));
        }
      } catch {
        // Fallback already active
      }
    };

    const loadNewReleases = async () => {
      try {
        const res = await appleMusicCatalogProvider.search('new latest single releases 2024', { limit: 20 });
        if (res && res.length > 0) {
          const normNew = await Promise.all(res.map((item) => appleMusicCatalogProvider.normalizeSong(item)));
          const mergedMap = new Map<string, Song>();
          for (const s of normNew) {
            mergedMap.set(s.title.toLowerCase().trim(), s);
          }
          for (const s of NEW_RELEASES_SONGS) {
            if (!mergedMap.has(s.title.toLowerCase().trim())) {
              mergedMap.set(s.title.toLowerCase().trim(), s);
            }
          }
          setNewReleases(Array.from(mergedMap.values()));
        }
      } catch {
        // Fallback already active
      }
    };

    // Run independent section loads concurrently; each section renders as soon as ready
    await Promise.allSettled([
      loadSection('trending-india', TRENDING_INDIA_SONGS, setTrendingSongs),
      loadSection('hindi-top-10', HINDI_POPULAR_SONGS, setHindiTop10),
      loadSection('telugu-top-10', TELUGU_POPULAR_SONGS, setTeluguTop10),
      loadSection('tamil-top-10', TAMIL_POPULAR_SONGS, setTamilTop10),
      loadSection('malayalam-top-10', MALAYALAM_POPULAR_SONGS, setMalayalamTop10),
      loadSection('english-top-10', ENGLISH_POPULAR_SONGS, setEnglishTop10),
      loadNewReleases()
    ]);
  }, [isOnline]);

  // Clean up any in-flight tab request on unmount
  useEffect(() => {
    return () => {
      if (tabAbortControllerRef.current) {
        tabAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Handles responsive language tab selection with immediate loading state and stale response cancellation
  const handleTabSelect = async (tabId: string) => {
    setActiveTab(tabId);
    if (tabId !== 'artists') {
      setSelectedArtist(null);
    }

    const languageChartMap: Record<
      string,
      {
        chartId: string;
        setter: (songs: Song[]) => void;
        fallback: Song[];
      }
    > = {
      hindi: {
        chartId: 'hindi-top-10',
        setter: setHindiTop10,
        fallback: HINDI_POPULAR_SONGS
      },
      telugu: {
        chartId: 'telugu-top-10',
        setter: setTeluguTop10,
        fallback: TELUGU_POPULAR_SONGS
      },
      tamil: {
        chartId: 'tamil-top-10',
        setter: setTamilTop10,
        fallback: TAMIL_POPULAR_SONGS
      },
      malayalam: {
        chartId: 'malayalam-top-10',
        setter: setMalayalamTop10,
        fallback: MALAYALAM_POPULAR_SONGS
      },
      english: {
        chartId: 'english-top-10',
        setter: setEnglishTop10,
        fallback: ENGLISH_POPULAR_SONGS
      }
    };

    const target = languageChartMap[tabId];
    if (!target) {
      setTabLoading(false);
      return;
    }

    if (!isOnline) {
      target.setter(target.fallback);
      return;
    }

    // Immediately trigger loading state
    setTabLoading(true);

    // Cancel any prior in-flight tab request
    if (tabAbortControllerRef.current) {
      tabAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    tabAbortControllerRef.current = controller;
    const reqId = ++tabRequestIdRef.current;

    try {
      const snap = await chartService.getChart(target.chartId, false, controller.signal);
      // Prevent stale response from overwriting newer tab
      if (reqId !== tabRequestIdRef.current) {
        return;
      }

      if (snap.tracks.length > 0) {
        const liveSongs = snap.tracks.map((t) => chartService.toSong(t));
        target.setter(padTracksIfNeeded(liveSongs, target.fallback));
      } else {
        target.setter(target.fallback);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was aborted in favor of a newer tab
      }
      console.warn(`[DiscoverPage] Error fetching live catalog for ${tabId}:`, err);
      if (reqId === tabRequestIdRef.current) {
        target.setter(target.fallback);
      }
    } finally {
      if (reqId === tabRequestIdRef.current) {
        setTabLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDiscoveryData();
  }, [loadDiscoveryData]);

  // Load artist songs when artist is selected: immediate local match render + background live catalog merge + memory cache
  useEffect(() => {
    if (!selectedArtist) {
      setArtistSongs([]);
      return;
    }

    if (artistTrackCache.has(selectedArtist)) {
      setArtistSongs(artistTrackCache.get(selectedArtist)!);
      return;
    }

    let isMounted = true;
    const loadArtistMusic = async () => {
      const curatedAll = getAllCuratedSongs();
      const allMoodSongs = Object.values(MOOD_CATALOG).flat();
      const allLocal = [...curatedAll, ...allMoodSongs, ...fallbackCatalog];

      const localMatches: Song[] = [];
      const seen = new Set<string>();

      for (const s of allLocal) {
        if (isArtistMatch(s.artist, selectedArtist)) {
          const normKey = s.title.toLowerCase().trim();
          if (!seen.has(normKey)) {
            seen.add(normKey);
            localMatches.push(s);
          }
        }
      }

      // Check artist profile popularTracks ONLY if the track artist also matches
      const profile = findArtistByName(selectedArtist);
      if (profile?.popularTracks) {
        for (const trackTitle of profile.popularTracks) {
          const normKey = trackTitle.toLowerCase().trim();
          if (!seen.has(normKey)) {
            const found = allLocal.find(
              (s) =>
                s.title.toLowerCase().trim() === normKey &&
                isArtistMatch(s.artist, selectedArtist)
            );
            if (found) {
              seen.add(normKey);
              localMatches.push(found);
            }
          }
        }
      }

      // Render local matches immediately so user sees tracks in <1ms without delay
      if (isMounted) {
        setArtistSongs(localMatches);
        artistTrackCache.set(selectedArtist, localMatches);
      }

      if (!isOnline) {
        return;
      }

      try {
        const results = await appleMusicCatalogProvider.search(selectedArtist, { limit: 20 });
        const normalized = await Promise.all(
          results.map((r) => appleMusicCatalogProvider.normalizeSong(r))
        );
        const merged = [...localMatches];
        for (const song of normalized) {
          if (!isArtistMatch(song.artist, selectedArtist)) continue;
          const normKey = song.title.toLowerCase().trim();
          if (!seen.has(normKey)) {
            seen.add(normKey);
            merged.push(song);
          }
        }
        if (isMounted) {
          const finalList = merged.length > 0 ? merged : localMatches;
          setArtistSongs(finalList);
          artistTrackCache.set(selectedArtist, finalList);
        }
      } catch {
        // Local matches already active
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
        title: 'Popular in India',
        subtitle: 'The hottest tracks across India right now',
        songs: trendingSongs,
        icon: <Flame size={20} color="#F59E0B" />
      },
      {
        id: 'hindi',
        title: 'Popular Hindi Songs',
        subtitle: 'Top Bollywood hits and trending Hindi tracks',
        songs: hindiTop10,
        icon: <Music size={20} color="var(--accent-warm)" />
      },
      {
        id: 'telugu',
        title: 'Popular Telugu Songs',
        subtitle: 'Top Tollywood hits and popular Telugu melodies',
        songs: teluguTop10,
        icon: <Sparkles size={20} color="#38BDF8" />
      },
      {
        id: 'tamil',
        title: 'Popular Tamil Songs',
        subtitle: 'Trending Kollywood releases and popular Tamil tracks',
        songs: tamilTop10,
        icon: <TrendingUp size={20} color="#10B981" />
      },
      {
        id: 'malayalam',
        title: 'Popular Malayalam Songs',
        subtitle: 'Popular Mollywood melodies and top Malayalam hits',
        songs: malayalamTop10,
        icon: <Globe size={20} color="#A78BFA" />
      },
      {
        id: 'english',
        title: 'Popular English Songs',
        subtitle: 'Global hits and international chart-toppers',
        songs: englishTop10,
        icon: <Disc size={20} color="#F472B6" />
      },
      {
        id: 'new',
        title: 'New Releases',
        subtitle: 'Fresh singles and newly added music',
        songs: newReleases,
        icon: <Sparkles size={20} color="var(--accent-cream)" />
      },
      {
        id: 'made-for-you',
        title: 'Quick Picks',
        subtitle: 'Handpicked songs for your listening session',
        songs: QUICK_PICKS_SONGS,
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
    newReleases
  ]);

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
    { id: 'new', label: 'New Releases' },
    { id: 'made-for-you', label: 'Quick Picks' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Desktop Discover Layout (>= 900px) — 100% Frozen & Preserved */}
      <div className="desktop-discover-layout">
        <div
          className="discover-page-container"
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
          Explore popular music, language collections, and featured artists across Hindi,
          Telugu, Tamil, Malayalam, and English.
        </p>

        {/* Quick Search Trigger */}
        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
              flex: '1 1 240px',
              maxWidth: '440px'
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
        className="discover-filter-pills"
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
              onClick={() => handleTabSelect(tab.id)}
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
            You&apos;re offline. Playing your saved and offline tracks. Reconnect to explore more music.
          </span>
        </div>
      )}

      {/* Moods Atmospheric Shelf (shown on 'all' or 'moods' tab) */}
      {(activeTab === 'all' || activeTab === 'moods') && (
        <div style={{ marginBottom: '48px' }}>
          <HomeMoods title="Moods" id="home-moods" />
        </div>
      )}

      {/* Top Artists Row (shown on 'all' or 'artists' tab) */}
      {(activeTab === 'all' || activeTab === 'artists') && (() => {
        const categoryArtists =
          artistCategoryFilter === 'all'
            ? ALL_ARTISTS
            : ALL_ARTISTS.filter((a) => a.category === artistCategoryFilter);
        const visibleArtists = showAllArtists ? categoryArtists : categoryArtists.slice(0, 12);

        return (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                <span
                  style={{
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(231, 165, 141, 0.12)',
                    color: 'var(--accent-warm)',
                    fontWeight: 600
                  }}
                >
                  {categoryArtists.length} Artists
                </span>
              </div>

              {/* Artist Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${ALL_ARTISTS.length})` },
                  { id: 'en', label: 'English (16)' },
                  { id: 'hi', label: 'Hindi (16)' },
                  { id: 'te', label: 'Telugu (16)' },
                  { id: 'ta', label: 'Tamil (16)' }
                ].map((cat) => {
                  const isCatActive = artistCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setArtistCategoryFilter(cat.id as any)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.78rem',
                        fontWeight: isCatActive ? 700 : 500,
                        backgroundColor: isCatActive ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.05)',
                        color: isCatActive ? '#080B10' : 'var(--text-muted)',
                        border: isCatActive ? '1px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px 0' }}>
              Browse artist collections across English, Hindi, Telugu, and Tamil.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px'
              }}
            >
              {visibleArtists.map((artist) => {
                const isSelected = selectedArtist === artist.name;
                return (
                  <div
                    key={artist.id}
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

            {/* Toggle show all artists button */}
            {categoryArtists.length > 12 && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                  onClick={() => setShowAllArtists(!showAllArtists)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(231, 165, 141, 0.08)',
                    color: 'var(--accent-warm)',
                    border: '1px solid rgba(231, 165, 141, 0.25)',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>
                    {showAllArtists
                      ? 'Show Fewer Artists'
                      : `View All ${categoryArtists.length} Artists`}
                  </span>
                  {showAllArtists ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            )}

            {/* Selected Artist Tracks */}
            {selectedArtist && (
              <div style={{ marginTop: '32px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    <span
                      style={{
                        fontSize: '0.76rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(231, 165, 141, 0.12)',
                        color: 'var(--accent-warm)',
                        fontWeight: 600
                      }}
                    >
                      {artistSongs.length} Tracks
                    </span>
                  </div>
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
        );
      })()}

      {/* Main Discover Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          {tabLoading && (
            <div
              data-testid="tab-loading-state"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(231, 165, 141, 0.08)',
                border: '1px solid rgba(231, 165, 141, 0.25)',
                color: 'var(--accent-warm)',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              <Loader2 size={18} className="animate-spin" color="var(--accent-warm)" />
              <span>Loading music...</span>
            </div>
          )}

          {sections
            .filter((sec) => activeTab === 'all' || activeTab === sec.id)
            .map((section) => {
              if (section.songs.length === 0) return null;

              const isExpanded = expandedSections[section.id] || activeTab === section.id;
              const displayedSongs = isExpanded ? section.songs : section.songs.slice(0, 4);

              return (
                <div key={section.id} id={`discover-section-${section.id}`}>
                  {/* Section Title, Subtitle, and View All Action */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ marginTop: '2px' }}>{section.icon}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(231, 165, 141, 0.12)',
                              color: 'var(--accent-warm)',
                              fontWeight: 600
                            }}
                          >
                            {section.songs.length} Tracks
                          </span>
                        </div>
                        <p
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.9rem',
                            margin: '4px 0 0 0'
                          }}
                        >
                          {section.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* View All / Show Less Toggle Button */}
                    {activeTab === 'all' && section.songs.length > 4 && (
                      <button
                        onClick={() => toggleSectionExpanded(section.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isExpanded
                            ? 'rgba(231, 165, 141, 0.18)'
                            : 'rgba(244, 240, 235, 0.05)',
                          color: isExpanded ? 'var(--accent-warm)' : 'var(--text-muted)',
                          border: isExpanded
                            ? '1px solid rgba(231, 165, 141, 0.4)'
                            : '1px solid var(--border-subtle)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                      >
                        <span>
                          {isExpanded ? 'Show Fewer' : `View All (${section.songs.length})`}
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Songs Grid */}
                  <div
                    className="music-card-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      gap: '24px'
                    }}
                  >
                    {displayedSongs.map((song) => (
                      <MusicCard key={`${section.id}-${song.id}`} song={song} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
        </div>
      </div>

      {/* Mobile Discover Layout (< 900px) — Unified Search, Sticky Filters, Hero Spotlight, Bento Grid */}
      <div className="mobile-discover-layout">
        <MobileDiscover
          trendingSongs={trendingSongs}
          hindiTop10={hindiTop10}
          teluguTop10={teluguTop10}
          tamilTop10={tamilTop10}
          malayalamTop10={malayalamTop10}
          englishTop10={englishTop10}
          newReleases={newReleases}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedArtist={selectedArtist}
          setSelectedArtist={setSelectedArtist}
          artistSongs={artistSongs}
          tabLoading={tabLoading}
        />
      </div>

      <style>{`
        .mobile-discover-layout {
          display: none !important;
        }
        .desktop-discover-layout {
          display: contents !important;
        }

        @media (max-width: 899px) {
          .desktop-discover-layout {
            display: none !important;
          }
          .mobile-discover-layout {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }
        }

        @media (max-width: 1080px) {
          .music-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
};
