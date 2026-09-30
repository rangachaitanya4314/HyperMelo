import React, { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { Song } from '../types/music';
import { AbstractArtwork } from './AbstractArtwork';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface MusicCardProps {
  song: Song;
}

export const MusicCard: React.FC<MusicCardProps> = ({ song }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { currentSong, isPlaying, playSong, togglePlay } = useAudioPlayer();

  const isCurrent = currentSong.id === song.id;
  const isThisPlaying = isCurrent && isPlaying;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else {
      playSong(song, 0);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handlePlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePlayClick(e as unknown as React.MouseEvent);
        }
      }}
      aria-label={`Play ${song.title} by ${song.artist}`}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-surface)',
        background: 'linear-gradient(155deg, rgba(19, 25, 36, 0.75) 0%, rgba(9, 13, 19, 0.95) 100%)',
        border: isCurrent
          ? '1px solid var(--border-warm)'
          : isHovered
          ? '1px solid rgba(231, 165, 141, 0.35)'
          : '1px solid var(--border-subtle)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'pointer',
        transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.32s ease, border-color 0.25s ease',
        transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 18px 40px rgba(0, 0, 0, 0.75), 0 0 24px rgba(231, 165, 141, 0.12)'
          : '0 6px 20px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Artwork container with zoom on hover */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isHovered ? 'scale(1.06)' : 'scale(1)'
          }}
        >
          <AbstractArtwork artwork={song.artwork} isPlaying={isThisPlaying} size="100%" />
        </div>

        {/* Play overlay button on artwork */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: isHovered || isThisPlaying ? 'rgba(8, 11, 16, 0.45)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s ease',
            opacity: isHovered || isThisPlaying ? 1 : 0
          }}
        >
          <button
            onClick={handlePlayClick}
            aria-label={isThisPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-warm)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#080B10',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(231, 165, 141, 0.45)',
              transform: isHovered ? 'scale(1)' : 'scale(0.85)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {isThisPlaying ? (
              <Pause size={22} fill="#080B10" />
            ) : (
              <Play size={22} fill="#080B10" style={{ marginLeft: '2px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Song Metadata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--accent-warm)',
            fontWeight: 500,
            margin: 0,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {song.artist}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: isCurrent ? 'var(--accent-cream)' : 'var(--text-primary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {song.title}
          </h3>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {formatDuration(song.duration)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {Object.keys(song.lyrics || { en: true }).map((langKey) => (
              <span
                key={langKey}
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(244, 240, 235, 0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  textTransform: 'uppercase'
                }}
              >
                {langKey}
              </span>
            ))}
            {song.attribution && (
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 500,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(244, 240, 235, 0.04)',
                  color: 'var(--text-dim)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  whiteSpace: 'nowrap',
                  cursor: 'help'
                }}
                title={`${song.attribution.text || song.attribution.license}\nSource: ${song.attribution.sourceName || song.attribution.source}`}
              >
                {song.attribution.license}
              </span>
            )}
          </div>

          {song.musicalKey && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--secondary-blue)',
                opacity: 0.85,
                flexShrink: 0,
                fontFamily: 'var(--font-sans)'
              }}
            >
              {song.musicalKey}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
