import React, { useState } from 'react';
import { X, Plus, Check, Music } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import type { Song } from '../types/music';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  song
}) => {
  const { playlists, createPlaylist, addSongToPlaylist, removeSongFromPlaylist } = useAudioPlayer();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen || !song) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const pl = createPlaylist(newPlaylistName.trim(), `Collection including ${song.title}`);
    addSongToPlaylist(pl.id, song.id);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to Playlist"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 1600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(14, 19, 28, 0.98)',
          border: '1px solid rgba(244, 240, 235, 0.1)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9)',
          padding: '24px',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Add to Playlist
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {song.title} — {song.artist}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Create New Playlist Button / Inline Form */}
        {!isCreating ? (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(231, 165, 141, 0.12)',
              border: '1px dashed rgba(231, 165, 141, 0.35)',
              color: 'var(--accent-cream)',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={18} color="var(--accent-warm)" />
            <span>Create New Playlist</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              autoFocus
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(244, 240, 235, 0.05)',
                border: '1px solid rgba(244, 240, 235, 0.15)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
          </form>
        )}

        {/* Existing Playlists List */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playlists.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', padding: '20px 0' }}>
              No playlists yet. Create one above!
            </p>
          ) : (
            playlists.map((pl) => {
              const containsSong = pl.songIds.includes(song.id);
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    if (containsSong) {
                      removeSongFromPlaylist(pl.id, song.id);
                    } else {
                      addSongToPlaylist(pl.id, song.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: containsSong ? 'rgba(231, 165, 141, 0.12)' : 'rgba(244, 240, 235, 0.03)',
                    border: containsSong ? '1px solid var(--border-warm)' : '1px solid rgba(244, 240, 235, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(244, 240, 235, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Music size={16} color="var(--accent-cream)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {pl.name}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                        {pl.songIds.length} {pl.songIds.length === 1 ? 'song' : 'songs'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: containsSong ? 'none' : '1.5px solid rgba(244, 240, 235, 0.3)',
                      backgroundColor: containsSong ? 'var(--accent-warm)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {containsSong && <Check size={14} color="#080B10" strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
