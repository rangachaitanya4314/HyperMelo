import React, { useState, useEffect } from 'react';
import { Play, Pause, Download, Trash2, Share2, Mic, Check, Music } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from '../components/AbstractArtwork';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import { takePlaybackService } from '../services/audio/takePlaybackService';
import type { RecordedTake, Song } from '../types/music';
import { getCanonicalTrackDuration } from '../shared/track';

export const LibraryPage: React.FC = () => {
  const {
    savedTakes,
    deleteTakeFromLibrary,
    downloadTake,
    playSong,
    currentSong,
    isPlaying,
    togglePlay,
    setCurrentView
  } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<'takes' | 'songs'>('takes');
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(() => takePlaybackService.getPlayingTakeId());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = takePlaybackService.subscribePreview((event) => {
      setPlayingTakeId(event.playingTakeId);
    });
    return () => {
      unsubscribe();
      takePlaybackService.stopTake();
    };
  }, []);

  const catalogSongs = musicCatalogService.getFallbackCatalog();

  const handlePlayTake = (take: RecordedTake) => {
    takePlaybackService.toggleTake(take);
  };

  const handleShare = (take: RecordedTake) => {
    setCopiedId(take.id);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(
        `Listen to my NARO recorded moment: ${take.songTitle} (${take.sectionLabel})`
      );
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const languageLabels: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी',
    te: 'తెలుగు'
  };

  const handleCatalogSongPlay = (song: Song) => {
    if (currentSong.id === song.id) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
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
            LIBRARY
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
            fontSize: 'clamp(2.4rem, 4.2vw, 3.6rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0
          }}
        >
          Your Collection
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1.02rem',
            marginTop: '8px',
            maxWidth: '560px',
            lineHeight: 1.5
          }}
        >
          Your personal recorded takes captured in the listening room, alongside the curated catalog.
        </p>

        {/* Tab Controls: Separating Recordings from Songs */}
        <div
          role="tablist"
          aria-label="Library tabs"
          style={{
            display: 'inline-flex',
            padding: '4px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(244, 240, 235, 0.05)',
            border: '1px solid var(--border-subtle)',
            marginTop: '24px',
            gap: '4px'
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === 'takes'}
            onClick={() => setActiveTab('takes')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'takes' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'takes' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'takes' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Mic size={15} />
            <span>Your Takes ({savedTakes.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'songs'}
            onClick={() => setActiveTab('songs')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'songs' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'songs' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'songs' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Music size={15} />
            <span>Curated Songs ({catalogSongs.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content: Recorded Takes */}
      {activeTab === 'takes' && (
        <>
          {savedTakes.length === 0 ? (
            <div
              style={{
                padding: '72px 24px',
                textAlign: 'center',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(244, 240, 235, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(231, 165, 141, 0.12)',
                  border: '1px solid rgba(231, 165, 141, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-warm)'
                }}
              >
                <Mic size={28} />
              </div>

              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
                Your moments will live here.
              </h3>
              <p className="serif-italic" style={{ color: 'var(--accent-cream)', fontSize: '1.15rem', margin: 0 }}>
                Sing something worth keeping.
              </p>

              <button
                onClick={() => setCurrentView('karaoke')}
                className="btn-primary"
                style={{ marginTop: '12px' }}
              >
                <Mic size={16} />
                <span>Go to Karaoke</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '24px'
              }}
            >
              {savedTakes.map((take) => {
                const isPlayingThis = playingTakeId === take.id;

                return (
                  <div
                    key={take.id}
                    className="glass-panel record-sleeve"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      backgroundColor: 'rgba(14, 18, 27, 0.85)',
                      border: isPlayingThis ? '1px solid var(--border-warm)' : '1px solid var(--border-subtle)',
                      boxShadow: isPlayingThis ? '0 10px 30px rgba(231, 165, 141, 0.15)' : 'var(--shadow-subtle)',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    {/* Artwork + Title + Artist */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}
                      >
                        {take.artwork ? (
                          <AbstractArtwork artwork={take.artwork} size={56} />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#1E293B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-warm)'
                            }}
                          >
                            <Mic size={24} />
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {take.songTitle}
                        </h3>
                        <p
                          style={{
                            fontSize: '0.84rem',
                            color: 'var(--text-muted)',
                            margin: '2px 0 0 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {take.artist}
                        </p>
                      </div>
                    </div>

                    {/* Badges: User Take Badge + Section + Language + Date + Duration */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: 'var(--accent-warm)',
                          backgroundColor: 'rgba(231, 165, 141, 0.12)',
                          border: '1px solid rgba(231, 165, 141, 0.28)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          letterSpacing: '0.04em'
                        }}
                      >
                        YOUR TAKE
                      </span>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          color: 'var(--accent-cream)',
                          backgroundColor: 'rgba(231, 165, 141, 0.15)',
                          border: '1px solid rgba(231, 165, 141, 0.3)',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        {take.sectionLabel}
                      </span>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          backgroundColor: 'rgba(244, 240, 235, 0.05)',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        {languageLabels[take.language] || take.language}
                      </span>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-dim)',
                          padding: '3px 6px',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {take.duration}s
                      </span>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-dim)',
                          padding: '3px 6px',
                          marginLeft: 'auto'
                        }}
                      >
                        {formatDate(take.recordedAt)}
                      </span>
                    </div>

                    {/* Actions: Play, Download, Delete, Share */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(244, 240, 235, 0.06)'
                      }}
                    >
                      <button
                        onClick={() => handlePlayTake(take)}
                        className="btn-primary"
                        style={{
                          padding: '7px 16px',
                          fontSize: '0.84rem'
                        }}
                        data-testid={`play-take-${take.id}`}
                        title={isPlayingThis ? 'Pause Take' : 'Play Take'}
                      >
                        {isPlayingThis ? <Pause size={15} fill="#080B10" /> : <Play size={15} fill="#080B10" />}
                        <span>{isPlayingThis ? 'Pause' : 'Play Take'}</span>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => downloadTake(take)}
                          className="btn-icon"
                          style={{ width: '34px', height: '34px' }}
                          title="Download recorded file"
                        >
                          <Download size={15} />
                        </button>

                        <button
                          onClick={() => handleShare(take)}
                          className="btn-icon"
                          style={{ width: '34px', height: '34px' }}
                          title="Share Take"
                        >
                          {copiedId === take.id ? <Check size={15} color="#10B981" /> : <Share2 size={15} />}
                        </button>

                        <button
                          onClick={() => deleteTakeFromLibrary(take.id)}
                          className="btn-icon"
                          style={{ width: '34px', height: '34px', color: '#F87171' }}
                          title="Delete Take"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab Content: Curated Songs */}
      {activeTab === 'songs' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px'
          }}
        >
          {catalogSongs.map((song) => {
            const isThisCurrent = currentSong.id === song.id;
            const isThisPlaying = isThisCurrent && isPlaying;

            return (
              <div
                key={song.id}
                className="glass-panel record-sleeve"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  backgroundColor: 'rgba(14, 18, 27, 0.85)',
                  border: isThisCurrent ? '1px solid var(--border-warm)' : '1px solid var(--border-subtle)',
                  boxShadow: isThisCurrent ? '0 10px 30px rgba(231, 165, 141, 0.15)' : 'var(--shadow-subtle)',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Artwork + Title + Artist */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <AbstractArtwork artwork={song.artwork} isPlaying={isThisPlaying} size={56} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        fontSize: '1.05rem',
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
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        margin: '2px 0 0 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {song.artist} {song.album && `• ${song.album}`}
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-dim)',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {formatDuration(getCanonicalTrackDuration(song))}
                  </span>
                </div>

                {/* Action: Play Normal */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(244, 240, 235, 0.06)'
                  }}
                >
                  <button
                    onClick={() => handleCatalogSongPlay(song)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '8px 16px',
                      fontSize: '0.84rem'
                    }}
                  >
                    {isThisPlaying ? <Pause size={15} fill="#080B10" /> : <Play size={15} fill="#080B10" />}
                    <span>{isThisPlaying ? 'Pause' : 'Play Song'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
