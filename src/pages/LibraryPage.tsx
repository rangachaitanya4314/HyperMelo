import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Download,
  Trash2,
  Share2,
  Mic,
  Check,
  Music,
  Heart,
  Plus,
  ListMusic,
  Clock,
  ArrowLeft,
  Edit2,
  X
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from '../components/AbstractArtwork';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import { takePlaybackService } from '../services/audio/takePlaybackService';
import type { RecordedTake, Song } from '../types/music';
import { getCanonicalTrackDuration } from '../shared/track';

type LibraryTab = 'takes' | 'liked' | 'playlists' | 'recent' | 'downloads';

export const LibraryPage: React.FC = () => {
  const {
    savedTakes,
    deleteTakeFromLibrary,
    renameTakeInLibrary,
    downloadTake,
    playSong,
    currentSong,
    isPlaying,
    togglePlay,
    setCurrentView,
    likedSongIds,
    toggleLikeSong,
    isSongLiked,
    playlists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    removeSongFromPlaylist,
    playPlaylist,
    openAddToPlaylist,
    recentlyPlayed,
    downloadedSongs,
    downloadSong,
    isSongDownloaded
  } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<LibraryTab>(() => {
    return savedTakes.length > 0 ? 'takes' : 'liked';
  });
  const [userClickedTab, setUserClickedTab] = useState(false);

  // Sync tab with takes when loaded asynchronously if user hasn't explicitly clicked away
  useEffect(() => {
    if (!userClickedTab && savedTakes.length > 0) {
      setActiveTab('takes');
    }
  }, [savedTakes.length, userClickedTab]);

  const [playingTakeId, setPlayingTakeId] = useState<string | null>(() =>
    takePlaybackService.getPlayingTakeId()
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playlist management state
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');

  // Take renaming state
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [editTakeLabel, setEditTakeLabel] = useState('');

  useEffect(() => {
    const unsubscribe = takePlaybackService.subscribePreview((event) => {
      setPlayingTakeId(event.playingTakeId);
    });
    return () => {
      unsubscribe();
      takePlaybackService.stopTake();
    };
  }, []);

  const catalogSongs = useMemo(() => musicCatalogService.getFallbackCatalog(), []);

  // Filtered liked songs
  const likedSongs = useMemo(() => {
    return catalogSongs.filter((song) => likedSongIds.includes(song.id));
  }, [catalogSongs, likedSongIds]);

  // Selected playlist object
  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  // Playlist song objects resolved from catalog
  const selectedPlaylistSongs = useMemo(() => {
    if (!selectedPlaylist) return [];
    return selectedPlaylist.songIds
      .map((id) => catalogSongs.find((s) => s.id === id))
      .filter((s): s is Song => Boolean(s));
  }, [selectedPlaylist, catalogSongs]);

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

  const handleSongPlay = (song: Song) => {
    if (currentSong.id === song.id) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
  };

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const created = createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim() || undefined);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setIsCreatingPlaylist(false);
    setSelectedPlaylistId(created.id);
  };

  const handleRenamePlaylistSubmit = (id: string) => {
    if (!editPlaylistName.trim()) return;
    renamePlaylist(id, editPlaylistName.trim());
    setEditingPlaylistId(null);
  };

  const handleRenameTakeSubmit = async (takeId: string) => {
    if (!editTakeLabel.trim()) return;
    await renameTakeInLibrary(takeId, editTakeLabel.trim());
    setEditingTakeId(null);
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

  const formatRelativeTime = (timestamp: number) => {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSecs < 60) return 'Just now';
    const mins = Math.floor(elapsedSecs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const languageLabels: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी',
    te: 'తెలుగు',
    ta: 'தமிழ்',
    ml: 'മലയാളം'
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
          Your Music Collection
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1.02rem',
            marginTop: '8px',
            maxWidth: '640px',
            lineHeight: 1.5
          }}
        >
          Personal playlists, favorite songs, listening history, and your recorded Karaoke takes.
        </p>

        {/* 5-Tab Navigation Bar */}
        <div
          role="tablist"
          aria-label="Library sections"
          style={{
            display: 'inline-flex',
            flexWrap: 'wrap',
            padding: '4px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(244, 240, 235, 0.05)',
            border: '1px solid var(--border-subtle)',
            marginTop: '24px',
            gap: '4px'
          }}
        >
          {/* 1. Liked Songs */}
          <button
            role="tab"
            id="lib-tab-liked"
            aria-selected={activeTab === 'liked'}
            onClick={() => {
              setUserClickedTab(true);
              setActiveTab('liked');
              setSelectedPlaylistId(null);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'liked' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'liked' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'liked' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Heart size={15} fill={activeTab === 'liked' ? '#080B10' : 'none'} />
            <span>Liked Songs ({likedSongs.length})</span>
          </button>

          {/* 2. Playlists */}
          <button
            role="tab"
            id="lib-tab-playlists"
            aria-selected={activeTab === 'playlists'}
            onClick={() => {
              setUserClickedTab(true);
              setActiveTab('playlists');
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'playlists' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'playlists' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'playlists' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <ListMusic size={15} />
            <span>Playlists ({playlists.length})</span>
          </button>

          {/* 3. Recently Played */}
          <button
            role="tab"
            id="lib-tab-recent"
            aria-selected={activeTab === 'recent'}
            onClick={() => {
              setUserClickedTab(true);
              setActiveTab('recent');
              setSelectedPlaylistId(null);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'recent' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'recent' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'recent' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={15} />
            <span>Recently Played ({recentlyPlayed.length})</span>
          </button>

          {/* 4. Downloaded Music */}
          <button
            role="tab"
            id="lib-tab-downloads"
            aria-selected={activeTab === 'downloads'}
            onClick={() => {
              setUserClickedTab(true);
              setActiveTab('downloads');
              setSelectedPlaylistId(null);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === 'downloads' ? 'var(--accent-warm)' : 'transparent',
              color: activeTab === 'downloads' ? '#080B10' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'downloads' ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={15} />
            <span>Downloads ({downloadedSongs.length})</span>
          </button>

          {/* 5. Your Karaoke Takes */}
          <button
            role="tab"
            id="lib-tab-takes"
            aria-selected={activeTab === 'takes'}
            onClick={() => {
              setUserClickedTab(true);
              setActiveTab('takes');
              setSelectedPlaylistId(null);
            }}
            style={{
              padding: '8px 18px',
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LIKED SONGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'liked' && (
        <div>
          {likedSongs.length === 0 ? (
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
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444'
                }}
              >
                <Heart size={28} />
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
                No liked songs yet
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '440px', margin: 0 }}>
                Tap the heart icon on any track in Home or Discover to save it to your personal favorites.
              </p>
              <button
                onClick={() => setCurrentView('discover')}
                className="btn-primary"
                style={{ marginTop: '12px' }}
              >
                <Music size={16} />
                <span>Explore Music</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Controls bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => {
                      if (likedSongs.length > 0) {
                        playPlaylist({
                          id: 'liked-all',
                          name: 'Liked Songs',
                          songIds: likedSongs.map((s) => s.id),
                          createdAt: Date.now(),
                          updatedAt: Date.now()
                        });
                      }
                    }}
                    className="btn-primary"
                    style={{ padding: '8px 20px', gap: '8px' }}
                  >
                    <Play size={16} fill="#080B10" />
                    <span>Play All ({likedSongs.length})</span>
                  </button>
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-dim)' }}>
                    {likedSongs.length} track{likedSongs.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Grid of liked songs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px'
                }}
              >
                {likedSongs.map((song) => {
                  const isThisCurrent = currentSong.id === song.id;
                  const isThisPlaying = isThisCurrent && isPlaying;

                  return (
                    <div
                      key={song.id}
                      className="glass-panel record-sleeve"
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        backgroundColor: 'rgba(14, 18, 27, 0.85)',
                        border: isThisCurrent
                          ? '1px solid var(--border-warm)'
                          : '1px solid var(--border-subtle)',
                        boxShadow: isThisCurrent
                          ? '0 10px 30px rgba(231, 165, 141, 0.15)'
                          : 'var(--shadow-subtle)',
                        transition: 'all 0.25s ease'
                      }}
                    >
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
                          <AbstractArtwork
                            artwork={song.artwork}
                            isPlaying={isThisPlaying}
                            size={56}
                          />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3
                            style={{
                              fontSize: '1.02rem',
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
                            {song.artist}
                          </p>
                        </div>
                      </div>

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
                          onClick={() => handleSongPlay(song)}
                          className="btn-primary"
                          style={{
                            padding: '6px 16px',
                            fontSize: '0.82rem'
                          }}
                        >
                          {isThisPlaying ? (
                            <Pause size={14} fill="#080B10" />
                          ) : (
                            <Play size={14} fill="#080B10" />
                          )}
                          <span>{isThisPlaying ? 'Pause' : 'Play'}</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => toggleLikeSong(song)}
                            className="btn-icon"
                            style={{
                              width: '32px',
                              height: '32px',
                              color: '#EF4444'
                            }}
                            title="Remove from Liked Songs"
                          >
                            <Heart size={16} fill="#EF4444" />
                          </button>

                          <button
                            onClick={() => openAddToPlaylist(song)}
                            className="btn-icon"
                            style={{ width: '32px', height: '32px' }}
                            title="Add to Playlist"
                          >
                            <Plus size={16} />
                          </button>

                          <button
                            onClick={() => downloadSong(song)}
                            className="btn-icon"
                            style={{
                              width: '32px',
                              height: '32px',
                              color: isSongDownloaded(song.id) ? '#10B981' : undefined
                            }}
                            title={isSongDownloaded(song.id) ? 'Downloaded' : 'Download Song'}
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PLAYLISTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'playlists' && (
        <div>
          {/* Detail View of a specific Playlist */}
          {selectedPlaylist ? (
            <div>
              <button
                onClick={() => setSelectedPlaylistId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-warm)',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '24px'
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Playlists</span>
              </button>

              {/* Playlist Header Card */}
              <div
                className="glass-panel"
                style={{
                  padding: '28px',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '24px',
                  marginBottom: '32px',
                  backgroundColor: 'rgba(14, 18, 27, 0.9)'
                }}
              >
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-warm)',
                    flexShrink: 0
                  }}
                >
                  <ListMusic size={48} />
                </div>

                <div style={{ flex: 1, minWidth: '240px' }}>
                  {editingPlaylistId === selectedPlaylist.id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editPlaylistName}
                        onChange={(e) => setEditPlaylistName(e.target.value)}
                        className="glass-input"
                        style={{
                          fontSize: '1.4rem',
                          fontWeight: 600,
                          padding: '6px 12px',
                          color: 'var(--text-primary)'
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenamePlaylistSubmit(selectedPlaylist.id)}
                        className="btn-primary"
                        style={{ padding: '8px 16px' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlaylistId(null)}
                        className="btn-secondary"
                        style={{ padding: '8px 12px' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h2
                        style={{
                          fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0
                        }}
                      >
                        {selectedPlaylist.name}
                      </h2>
                      <button
                        onClick={() => {
                          setEditingPlaylistId(selectedPlaylist.id);
                          setEditPlaylistName(selectedPlaylist.name);
                        }}
                        className="btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        title="Rename Playlist"
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>
                  )}

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', margin: '8px 0 0 0' }}>
                    {selectedPlaylist.description || 'Personal playlist'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginTop: '12px',
                      fontSize: '0.82rem',
                      color: 'var(--text-dim)'
                    }}
                  >
                    <span>{selectedPlaylistSongs.length} tracks</span>
                    <span>•</span>
                    <span>Updated {formatDate(selectedPlaylist.updatedAt)}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                    <button
                      onClick={() => playPlaylist(selectedPlaylist)}
                      disabled={selectedPlaylistSongs.length === 0}
                      className="btn-primary"
                      style={{ padding: '8px 20px', gap: '8px' }}
                    >
                      <Play size={16} fill="#080B10" />
                      <span>Play Playlist</span>
                    </button>
                    <button
                      onClick={() => {
                        deletePlaylist(selectedPlaylist.id);
                        setSelectedPlaylistId(null);
                      }}
                      className="btn-secondary"
                      style={{
                        padding: '8px 16px',
                        color: '#F87171',
                        borderColor: 'rgba(248, 113, 113, 0.3)'
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Playlist Tracks List */}
              {selectedPlaylistSongs.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-subtle)'
                  }}
                >
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    This playlist is currently empty.
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginTop: '6px' }}>
                    Use the '+' button on any song card across NARO to add music to this mix.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedPlaylistSongs.map((song, index) => {
                    const isThisCurrent = currentSong.id === song.id;
                    const isThisPlaying = isThisCurrent && isPlaying;

                    return (
                      <div
                        key={song.id}
                        className="glass-panel"
                        style={{
                          padding: '12px 18px',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          backgroundColor: isThisCurrent
                            ? 'rgba(231, 165, 141, 0.08)'
                            : 'rgba(14, 18, 27, 0.6)',
                          border: isThisCurrent
                            ? '1px solid var(--border-warm)'
                            : '1px solid var(--border-subtle)'
                        }}
                      >
                        <span
                          style={{
                            width: '24px',
                            textAlign: 'center',
                            fontSize: '0.86rem',
                            color: 'var(--text-dim)',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {index + 1}
                        </span>

                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          <AbstractArtwork
                            artwork={song.artwork}
                            isPlaying={isThisPlaying}
                            size={44}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '0.96rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {song.title}
                          </h4>
                          <p
                            style={{
                              margin: '2px 0 0 0',
                              fontSize: '0.82rem',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {song.artist}
                          </p>
                        </div>

                        <span
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-dim)',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {formatDuration(getCanonicalTrackDuration(song))}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleSongPlay(song)}
                            className="btn-icon"
                            style={{ width: '34px', height: '34px' }}
                            title={isThisPlaying ? 'Pause' : 'Play'}
                          >
                            {isThisPlaying ? (
                              <Pause size={15} fill="#080B10" />
                            ) : (
                              <Play size={15} />
                            )}
                          </button>

                          <button
                            onClick={() =>
                              removeSongFromPlaylist(selectedPlaylist.id, song.id)
                            }
                            className="btn-icon"
                            style={{ width: '34px', height: '34px', color: '#F87171' }}
                            title="Remove from playlist"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* All Playlists Grid */
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px'
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0
                    }}
                  >
                    Your Playlists
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                    Create and curate personalized mixes.
                  </p>
                </div>

                <button
                  id="create-playlist-btn"
                  onClick={() => setIsCreatingPlaylist(true)}
                  className="btn-primary"
                  style={{ gap: '8px' }}
                >
                  <Plus size={16} />
                  <span>Create Playlist</span>
                </button>
              </div>

              {/* Inline Create Playlist Form */}
              {isCreatingPlaylist && (
                <form
                  onSubmit={handleCreatePlaylistSubmit}
                  className="glass-panel"
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '28px',
                    backgroundColor: 'rgba(14, 18, 27, 0.95)',
                    border: '1px solid var(--border-warm)'
                  }}
                >
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    New Playlist
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      id="new-playlist-name-input"
                      type="text"
                      placeholder="Playlist Name (e.g. Midnight Beats)"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      required
                      autoFocus
                      className="glass-input"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.95rem'
                      }}
                    />
                    <input
                      id="new-playlist-desc-input"
                      type="text"
                      placeholder="Optional description"
                      value={newPlaylistDesc}
                      onChange={(e) => setNewPlaylistDesc(e.target.value)}
                      className="glass-input"
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.95rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button
                        id="submit-create-playlist-btn"
                        type="submit"
                        className="btn-primary"
                        style={{ padding: '8px 20px' }}
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingPlaylist(false);
                          setNewPlaylistName('');
                          setNewPlaylistDesc('');
                        }}
                        className="btn-secondary"
                        style={{ padding: '8px 16px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Grid of Playlists */}
              {playlists.length === 0 ? (
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
                    <ListMusic size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
                    No playlists yet
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '440px', margin: 0 }}>
                    Create custom playlists to organize your favorite tracks for any mood or occasion.
                  </p>
                  <button
                    onClick={() => setIsCreatingPlaylist(true)}
                    className="btn-primary"
                    style={{ marginTop: '12px' }}
                  >
                    <Plus size={16} />
                    <span>Create Your First Playlist</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '24px'
                  }}
                >
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="glass-panel record-sleeve"
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      style={{
                        padding: '20px',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        backgroundColor: 'rgba(14, 18, 27, 0.85)',
                        border: '1px solid var(--border-subtle)',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          backgroundColor: 'rgba(231, 165, 141, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-warm)'
                        }}
                      >
                        <ListMusic size={54} />
                      </div>

                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                          }}
                        >
                          {playlist.name}
                        </h3>
                        <p
                          style={{
                            margin: '4px 0 0 0',
                            fontSize: '0.84rem',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {playlist.songIds.length} track{playlist.songIds.length === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '12px',
                          borderTop: '1px solid rgba(244, 240, 235, 0.06)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => playPlaylist(playlist)}
                          disabled={playlist.songIds.length === 0}
                          className="btn-primary"
                          style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                        >
                          <Play size={14} fill="#080B10" />
                          <span>Play</span>
                        </button>

                        <button
                          onClick={() => deletePlaylist(playlist.id)}
                          className="btn-icon"
                          style={{ width: '32px', height: '32px', color: '#F87171' }}
                          title="Delete Playlist"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RECENTLY PLAYED TAB */}
      {/* ========================================================================= */}
      {activeTab === 'recent' && (
        <div>
          {recentlyPlayed.length === 0 ? (
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
                <Clock size={28} />
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
                No recently played tracks
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '440px', margin: 0 }}>
                Songs you listen to for more than 5 seconds will automatically appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentlyPlayed.map((item) => {
                const song = catalogSongs.find((s) => s.id === item.songId) || item.song;
                if (!song) return null;

                const isThisCurrent = currentSong.id === song.id;
                const isThisPlaying = isThisCurrent && isPlaying;

                return (
                  <div
                    key={`${item.songId}-${item.playedAt}`}
                    className="glass-panel"
                    style={{
                      padding: '12px 18px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      backgroundColor: isThisCurrent
                        ? 'rgba(231, 165, 141, 0.08)'
                        : 'rgba(14, 18, 27, 0.65)',
                      border: isThisCurrent
                        ? '1px solid var(--border-warm)'
                        : '1px solid var(--border-subtle)'
                    }}
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
                        isPlaying={isThisPlaying}
                        size={46}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '0.96rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {song.title}
                      </h4>
                      <p
                        style={{
                          margin: '2px 0 0 0',
                          fontSize: '0.82rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {song.artist}
                      </p>
                    </div>

                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-dim)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {formatRelativeTime(item.playedAt)}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleSongPlay(song)}
                        className="btn-icon"
                        style={{ width: '34px', height: '34px' }}
                        title={isThisPlaying ? 'Pause' : 'Play'}
                      >
                        {isThisPlaying ? (
                          <Pause size={15} fill="#080B10" />
                        ) : (
                          <Play size={15} />
                        )}
                      </button>

                      <button
                        onClick={() => toggleLikeSong(song)}
                        className="btn-icon"
                        style={{
                          width: '34px',
                          height: '34px',
                          color: isSongLiked(song.id) ? '#EF4444' : undefined
                        }}
                        title={isSongLiked(song.id) ? 'Unlike' : 'Like'}
                      >
                        <Heart
                          size={15}
                          fill={isSongLiked(song.id) ? '#EF4444' : 'none'}
                        />
                      </button>

                      <button
                        onClick={() => openAddToPlaylist(song)}
                        className="btn-icon"
                        style={{ width: '34px', height: '34px' }}
                        title="Add to Playlist"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DOWNLOADED MUSIC TAB */}
      {/* ========================================================================= */}
      {activeTab === 'downloads' && (
        <div>
          {downloadedSongs.length === 0 ? (
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
                <Download size={28} />
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
                No downloaded music
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '440px', margin: 0 }}>
                Save your favorite songs for instant playback even with limited internet connectivity.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px'
              }}
            >
              {downloadedSongs.map((song) => {
                const isThisCurrent = currentSong.id === song.id;
                const isThisPlaying = isThisCurrent && isPlaying;

                return (
                  <div
                    key={song.id}
                    className="glass-panel record-sleeve"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      backgroundColor: 'rgba(14, 18, 27, 0.85)',
                      border: isThisCurrent
                        ? '1px solid var(--border-warm)'
                        : '1px solid var(--border-subtle)',
                      boxShadow: isThisCurrent
                        ? '0 10px 30px rgba(231, 165, 141, 0.15)'
                        : 'var(--shadow-subtle)',
                      transition: 'all 0.25s ease'
                    }}
                  >
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
                        <AbstractArtwork
                          artwork={song.artwork}
                          isPlaying={isThisPlaying}
                          size={56}
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                          style={{
                            fontSize: '1.02rem',
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
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.28)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        OFFLINE READY
                      </span>
                    </div>

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
                        onClick={() => handleSongPlay(song)}
                        className="btn-primary"
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.82rem'
                        }}
                      >
                        {isThisPlaying ? (
                          <Pause size={14} fill="#080B10" />
                        ) : (
                          <Play size={14} fill="#080B10" />
                        )}
                        <span>{isThisPlaying ? 'Pause' : 'Play'}</span>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => toggleLikeSong(song)}
                          className="btn-icon"
                          style={{
                            width: '32px',
                            height: '32px',
                            color: isSongLiked(song.id) ? '#EF4444' : undefined
                          }}
                          title={isSongLiked(song.id) ? 'Unlike' : 'Like'}
                        >
                          <Heart
                            size={15}
                            fill={isSongLiked(song.id) ? '#EF4444' : 'none'}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. YOUR KARAOKE TAKES TAB */}
      {/* ========================================================================= */}
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
              <p
                className="serif-italic"
                style={{ color: 'var(--accent-cream)', fontSize: '1.15rem', margin: 0 }}
              >
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
                      border: isPlayingThis
                        ? '1px solid var(--border-warm)'
                        : '1px solid var(--border-subtle)',
                      boxShadow: isPlayingThis
                        ? '0 10px 30px rgba(231, 165, 141, 0.15)'
                        : 'var(--shadow-subtle)',
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
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
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

                      {editingTakeId === take.id ? (
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editTakeLabel}
                            onChange={(e) => setEditTakeLabel(e.target.value)}
                            className="glass-input"
                            style={{
                              fontSize: '0.74rem',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameTakeSubmit(take.id)}
                            className="btn-primary"
                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => {
                            setEditingTakeId(take.id);
                            setEditTakeLabel(take.sectionLabel);
                          }}
                          title="Click to rename"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: 'var(--accent-cream)',
                            backgroundColor: 'rgba(231, 165, 141, 0.15)',
                            border: '1px solid rgba(231, 165, 141, 0.3)',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            cursor: 'pointer'
                          }}
                        >
                          {take.sectionLabel}
                        </span>
                      )}

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
                        {isPlayingThis ? (
                          <Pause size={15} fill="#080B10" />
                        ) : (
                          <Play size={15} fill="#080B10" />
                        )}
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
                          {copiedId === take.id ? (
                            <Check size={15} color="#10B981" />
                          ) : (
                            <Share2 size={15} />
                          )}
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
    </div>
  );
};
