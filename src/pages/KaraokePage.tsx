import React, { useState, useEffect, useMemo } from 'react';
import { Search, Mic, Sparkles, Play, Pause, Clock, X, Music, ArrowRight } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from '../components/AbstractArtwork';
import { capabilityService } from '../services/capability/capabilityService';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import { appleMusicCatalogProvider } from '../services/providers/AppleMusicCatalogProvider';
import { JOSH_WOODWARD_SHOT_DOWN } from '../data/songs';
import { takePlaybackService } from '../services/audio/takePlaybackService';
import type { Song, RecordedTake } from '../types/music';

export const KaraokePage: React.FC = () => {
  const {
    songs,
    openKaraokeForSong,
    savedTakes,
    setCurrentView
  } = useAudioPlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(() => takePlaybackService.getPlayingTakeId());

  useEffect(() => {
    const unsubscribe = takePlaybackService.subscribePreview((event) => {
      setPlayingTakeId(event.playingTakeId);
    });
    return () => {
      unsubscribe();
      takePlaybackService.stopTake();
    };
  }, []);

  // Recently sung tracks stored in session storage
  const [recentlySungIds, setRecentlySungIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('naro_recently_sung');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Dynamic language section songs state
  const [hindiTracks, setHindiTracks] = useState<Song[]>([]);
  const [teluguTracks, setTeluguTracks] = useState<Song[]>([]);
  const [tamilTracks, setTamilTracks] = useState<Song[]>([]);
  const [malayalamTracks, setMalayalamTracks] = useState<Song[]>([]);
  const [englishTracks, setEnglishTracks] = useState<Song[]>([JOSH_WOODWARD_SHOT_DOWN]);

  // Load language sections on mount
  useEffect(() => {
    let isCurrent = true;

    async function loadLanguageSections() {
      try {
        const [hindi, telugu, tamilRaw, malayalamRaw, trending] = await Promise.all([
          appleMusicCatalogProvider.getTrending('hindi').catch(() => []),
          appleMusicCatalogProvider.getTrending('telugu').catch(() => []),
          appleMusicCatalogProvider.search('tamil hits', { limit: 8 }).catch(() => []),
          appleMusicCatalogProvider.search('malayalam hits', { limit: 8 }).catch(() => []),
          appleMusicCatalogProvider.getTrending('all').catch(() => [])
        ]);

        if (!isCurrent) return;

        const tamil = await Promise.all(tamilRaw.map((r) => appleMusicCatalogProvider.normalizeSong(r)));
        const malayalam = await Promise.all(malayalamRaw.map((r) => appleMusicCatalogProvider.normalizeSong(r)));

        // Filter all tracks to ensure legitimate karaoke capability and no dev fixtures
        const filterValid = (list: Song[]) =>
          list.filter((s) => {
            const cap = capabilityService.evaluate(s);
            return cap.karaoke !== 'UNAVAILABLE' && !cap.isDevFixture;
          });

        setHindiTracks(filterValid(hindi));
        setTeluguTracks(filterValid(telugu));
        setTamilTracks(filterValid(tamil));
        setMalayalamTracks(filterValid(malayalam));
        setEnglishTracks([JOSH_WOODWARD_SHOT_DOWN, ...filterValid(trending)]);
      } catch (err) {
        console.warn('Error fetching karaoke discovery sections:', err);
      }
    }

    loadLanguageSections();
    return () => {
      isCurrent = false;
    };
  }, []);

  // Dedicated Scoped Karaoke Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        // Query live catalog
        const { songs: catalogResults } = await musicCatalogService.search(q);

        if (!isCurrent) return;

        // Combine with in-memory songs that match query
        const localMatches = [JOSH_WOODWARD_SHOT_DOWN, ...songs].filter((s) => {
          const normQ = q.toLowerCase();
          return (
            s.title.toLowerCase().includes(normQ) ||
            s.artist.toLowerCase().includes(normQ) ||
            s.album?.toLowerCase().includes(normQ)
          );
        });

        // Deduplicate
        const merged = new Map<string, Song>();
        for (const s of [...localMatches, ...catalogResults]) {
          if (!merged.has(s.id)) {
            merged.set(s.id, s);
          }
        }

        // Strictly filter: Karaoke capability must NOT be UNAVAILABLE, and NOT dev fixtures
        const validKaraokeSongs = Array.from(merged.values()).filter((s) => {
          const cap = capabilityService.evaluate(s);
          return cap.karaoke !== 'UNAVAILABLE' && !cap.isDevFixture;
        });

        setSearchResults(validKaraokeSongs);
      } catch (err) {
        console.warn('Karaoke search error:', err);
        setSearchResults([]);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery, songs]);

  const handleSingSong = (song: Song) => {
    // Record to recently sung
    setRecentlySungIds((prev) => {
      const next = [song.id, ...prev.filter((id) => id !== song.id)].slice(0, 10);
      try {
        sessionStorage.setItem('naro_recently_sung', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    openKaraokeForSong(song);
  };

  const handlePlayTake = (take: RecordedTake) => {
    takePlaybackService.toggleTake(take);
  };

  // Recently sung songs resolved
  const recentlySungSongs = useMemo(() => {
    const allKnown = [
      JOSH_WOODWARD_SHOT_DOWN,
      ...songs,
      ...hindiTracks,
      ...teluguTracks,
      ...tamilTracks,
      ...malayalamTracks,
      ...englishTracks
    ];
    const map = new Map<string, Song>();
    allKnown.forEach((s) => map.set(s.id, s));

    return recentlySungIds
      .map((id) => map.get(id))
      .filter((s): s is Song => Boolean(s) && capabilityService.evaluate(s!).karaoke !== 'UNAVAILABLE');
  }, [recentlySungIds, songs, hindiTracks, teluguTracks, tamilTracks, malayalamTracks, englishTracks]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  const renderSongCard = (song: Song) => {
    const capabilities = capabilityService.evaluate(song);
    const isKaraokeReady = capabilities.karaoke === 'KARAOKE_READY';

    return (
      <div
        key={song.id}
        id={`karaoke-song-${song.id}`}
        data-testid="karaoke-song-card"
        className="glass-panel"
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: '18px',
          backgroundColor: 'rgba(14, 18, 27, 0.82)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          border: '1px solid rgba(244, 240, 235, 0.08)',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '12px',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <AbstractArtwork artwork={song.artwork} size={64} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {song.title}
            </h3>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                margin: '2px 0 0 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {song.artist}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              {isKaraokeReady ? (
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: '#4ADE80',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={10} color="#4ADE80" /> KARAOKE READY
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: 'var(--accent-cream)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    border: '1px solid rgba(231, 165, 141, 0.35)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Mic size={10} color="var(--accent-warm)" /> SING-ALONG
                </span>
              )}

              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(song.duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => handleSingSong(song)}
          className="btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '9px 16px',
            fontSize: '0.84rem'
          }}
          title={isKaraokeReady ? 'Sing with instrumental backing' : 'Sing along with live microphone'}
        >
          <Mic size={14} />
          <span>Sing Now</span>
        </button>
      </div>
    );
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
      {/* Hero Section */}
      <div style={{ marginBottom: '40px' }}>
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
            NARO KARAOKE 2.0
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
          className="font-editorial"
          style={{
            fontSize: 'clamp(2.4rem, 4.4vw, 3.8rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: '0 0 10px 0'
          }}
        >
          What do you want to sing?
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1.02rem',
            maxWidth: '620px',
            lineHeight: 1.5,
            margin: '0 0 28px 0'
          }}
        >
          Discover songs with verified instrumental backing and live synchronized lyrics. Record your voice without arbitrary limits, review dual-track audio, and preserve your takes.
        </p>

        {/* Dedicated Karaoke Search Input (No generic provider cards) */}
        <div style={{ maxWidth: '640px', position: 'relative' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(14, 18, 27, 0.95)',
              border: '1px solid rgba(231, 165, 141, 0.25)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 18px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
            }}
          >
            <Search size={18} color="var(--accent-warm)" style={{ flexShrink: 0, marginRight: '12px' }} />
            <input
              id="karaoke-search-input"
              data-testid="karaoke-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs or artists for karaoke..."
              aria-label="Karaoke song search"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.98rem',
                outline: 'none',
                padding: '8px 0'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear karaoke search"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* If Search is Active */}
      {searchQuery.trim() ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Search Results {isSearching ? '(Searching...)' : `(${searchResults.length})`}
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              Showing only tracks with verified karaoke capability
            </span>
          </div>

          {searchResults.length === 0 && !isSearching ? (
            <div
              className="glass-panel"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(14, 18, 27, 0.5)'
              }}
            >
              <Music size={32} color="var(--accent-warm)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                No karaoke-ready songs found for &ldquo;{searchQuery}&rdquo;
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
                Only songs with verified instrumental backing or legitimate sing-along capabilities appear in Karaoke.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '18px'
              }}
            >
              {searchResults.map((song) => renderSongCard(song))}
            </div>
          )}
        </div>
      ) : (
        /* Default Landing Sections */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '44px' }}>
          {/* Section: Recently Sung */}
          {recentlySungSongs.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Clock size={16} color="var(--accent-warm)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Recently Sung
                </h2>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {recentlySungSongs.map((song) => renderSongCard(song))}
              </div>
            </div>
          )}

          {/* Section: Your Takes */}
          {savedTakes.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mic size={16} color="var(--accent-warm)" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Your Takes ({savedTakes.length})
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentView('library')}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>View All in Library</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '14px'
                }}
              >
                {savedTakes.slice(0, 4).map((take) => (
                  <div
                    key={take.id}
                    className="glass-panel"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      backgroundColor: 'rgba(14, 18, 27, 0.8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                        {take.songTitle}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        {take.sectionLabel} • {formatDuration(take.duration)} • {formatDate(take.recordedAt)}
                      </p>
                    </div>

                    <button
                      onClick={() => handlePlayTake(take)}
                      className="btn-icon"
                      style={{
                        width: '36px',
                        height: '36px',
                        backgroundColor: playingTakeId === take.id ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.08)',
                        color: playingTakeId === take.id ? '#080B10' : 'var(--text-primary)'
                      }}
                      title={playingTakeId === take.id ? 'Pause take preview' : 'Play take preview'}
                    >
                      {playingTakeId === take.id ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '2px' }} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Popular Hindi */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Popular Hindi
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}>हिन्दी कराओके</span>
            </div>
            {hindiTracks.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {hindiTracks.slice(0, 6).map((song) => renderSongCard(song))}
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                Discovering popular Hindi karaoke songs...
              </div>
            )}
          </div>

          {/* Section: Popular Telugu */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Popular Telugu
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}>తెలుగు కచేరీ</span>
            </div>
            {teluguTracks.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {teluguTracks.slice(0, 6).map((song) => renderSongCard(song))}
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                Discovering popular Telugu karaoke songs...
              </div>
            )}
          </div>

          {/* Section: Popular Tamil */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Popular Tamil
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}>தமிழ் பாடல்</span>
            </div>
            {tamilTracks.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {tamilTracks.slice(0, 6).map((song) => renderSongCard(song))}
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                Discovering popular Tamil karaoke songs...
              </div>
            )}
          </div>

          {/* Section: Popular Malayalam */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Popular Malayalam
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}>മലയാളം ഗാനങ്ങൾ</span>
            </div>
            {malayalamTracks.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {malayalamTracks.slice(0, 6).map((song) => renderSongCard(song))}
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                Discovering popular Malayalam karaoke songs...
              </div>
            )}
          </div>

          {/* Section: Popular English */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Popular English
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-warm)' }}>Global Acoustic & Indie</span>
            </div>
            {englishTracks.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '18px'
                }}
              >
                {englishTracks.slice(0, 6).map((song) => renderSongCard(song))}
              </div>
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                Discovering popular English karaoke songs...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
