import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  FileText,
  Repeat,
  Loader2,
  AlertCircle,
  Maximize2
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { MulticolorSpectrum } from './MulticolorSpectrum';

export const BottomPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    bufferedTime,
    playbackState,
    playbackError,
    volume,
    setVolume,
    togglePlay,
    seekTo,
    nextSong,
    prevSong,
    toggleLyricsDrawer,
    openNowPlaying,
    isLoopingSection,
    setIsLoopingSection
  } = useAudioPlayer();

  const [prevVolume, setPrevVolume] = useState<number>(0.8);

  const formatPlaybackError = (raw: string | null): string | null => {
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.includes('notallowed') || lower.includes('gesture') || lower.includes('interact')) {
      return 'Tap play to start audio playback.';
    }
    if (lower.includes('offline') || lower.includes('network')) {
      return "You're offline. Reconnect to resume streaming.";
    }
    if (lower.includes('notsupported') || lower.includes('format')) {
      return 'Audio format is not supported by your browser.';
    }
    if (lower.includes('no authorized') || lower.includes('unavailable')) {
      return 'Playback stream is currently unavailable for this track.';
    }
    if (lower.includes('abort')) {
      return 'Playback was interrupted.';
    }
    return 'Playback temporarily unavailable. Please try again.';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 0.8);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  const effectiveDuration = duration > 0 ? duration : currentSong.duration || 180;
  const progressPercent = Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100));
  const bufferPercent = Math.max(0, Math.min(100, (bufferedTime / effectiveDuration) * 100));

  return (
    <aside
      role="region"
      aria-label="NARO Studio Audio Player"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '86px',
        backgroundColor: 'rgba(8, 11, 16, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(244, 240, 235, 0.08)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.75)'
      }}
    >
      {/* Subtle Studio Metallic Top Accent Trim */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(231, 165, 141, 0.4) 30%, rgba(244, 223, 201, 0.5) 50%, rgba(143, 168, 200, 0.4) 70%, transparent 100%)'
        }}
      />

      {/* Left: Artwork, Title, Artist, Multicolor Spectrum Visualizer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          width: '320px',
          minWidth: 0
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
            position: 'relative'
          }}
          onClick={togglePlay}
          title="Toggle playback"
        >
          <AbstractArtwork artwork={currentSong.artwork} isPlaying={isPlaying} size={50} />
        </div>

        <div
          id="bottom-player-track-info"
          data-testid="bottom-player-track-info"
          onClick={openNowPlaying}
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            flex: 1,
            cursor: 'pointer'
          }}
          title="Expand Now Playing"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.94rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentSong.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentSong.artist}
            </span>

            {currentSong.attribution && (
              <span
                id="player-attribution-badge"
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(244, 240, 235, 0.06)',
                  color: 'var(--text-dim)',
                  border: '1px solid rgba(244, 240, 235, 0.12)',
                  whiteSpace: 'nowrap',
                  cursor: 'help'
                }}
                title={`${currentSong.attribution.text}\nSource: ${currentSong.attribution.sourceName}`}
              >
                {currentSong.attribution.license}
              </span>
            )}

            {/* Multicolor Audio Spectrum */}
            <MulticolorSpectrum
              isPlaying={isPlaying}
              barCount={7}
              height={14}
              barWidth={2.5}
              gap={2}
            />
          </div>
        </div>
      </div>

      {/* Center: Hi-Fi Studio Controls & Central Clock Scrubber */}
      <div
        className="player-center"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          maxWidth: '580px'
        }}
      >
        {/* Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button
            onClick={() => setIsLoopingSection(!isLoopingSection)}
            aria-label="Loop active moment"
            style={{
              background: 'none',
              border: 'none',
              color: isLoopingSection ? 'var(--accent-warm)' : 'var(--text-dim)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s ease'
            }}
            title={isLoopingSection ? 'Looping current moment' : 'Repeat moment'}
          >
            <Repeat size={16} />
          </button>

          <button
            onClick={prevSong}
            aria-label="Previous track"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <SkipBack size={18} />
          </button>

          {/* Master Play/Pause with Loading/Buffering feedback */}
          <button
            id="bottom-play-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--text-primary)',
              color: '#080B10',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
              boxShadow: '0 2px 14px rgba(244, 240, 235, 0.3)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {playbackState === 'loading' || playbackState === 'buffering' ? (
              <Loader2 size={18} className="animate-spin" color="#080B10" />
            ) : isPlaying ? (
              <Pause size={18} fill="#080B10" />
            ) : (
              <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />
            )}
          </button>

          <button
            onClick={nextSong}
            aria-label="Next track"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Scrubber progress bar mapped to ACTUAL playback clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <span
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-dim)',
              fontVariantNumeric: 'tabular-nums',
              width: '38px',
              textAlign: 'right'
            }}
          >
            {formatTime(currentTime)}
          </span>

          <div
            style={{
              position: 'relative',
              flex: 1,
              height: '4px',
              backgroundColor: 'rgba(244, 240, 235, 0.12)',
              borderRadius: '2px'
            }}
          >
            {/* Buffer bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${bufferPercent}%`,
                backgroundColor: 'rgba(244, 240, 235, 0.18)',
                borderRadius: '2px'
              }}
            />

            {/* Playhead progress */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progressPercent}%`,
                backgroundColor: 'var(--accent-warm)',
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(231, 165, 141, 0.4)'
              }}
            />

            <input
              id="bottom-seek-slider"
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.2}
              value={currentTime}
              onChange={handleProgressChange}
              aria-label="Song progress seek"
              style={{
                position: 'absolute',
                top: '-8px',
                left: 0,
                width: '100%',
                height: '20px',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
          </div>

          <span
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-dim)',
              fontVariantNumeric: 'tabular-nums',
              width: '38px'
            }}
          >
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Honest Error / Status Feedback */}
        {(() => {
          const userFriendlyError = formatPlaybackError(playbackError);
          if (!userFriendlyError) return null;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.72rem',
                color: '#FCA5A5'
              }}
            >
              <AlertCircle size={12} />
              <span>{userFriendlyError}</span>
            </div>
          );
        })()}
      </div>

      {/* Right: Lyrics drawer, Karaoke button, Hi-Fi Volume slider */}
      <div
        className="player-right"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '14px',
          width: '320px'
        }}
      >
        {/* Expand Now Playing Button */}
        <button
          id="expand-now-playing-btn"
          data-testid="expand-now-playing-btn"
          onClick={openNowPlaying}
          aria-label="Expand Now Playing"
          className="btn-icon"
          style={{ width: '38px', height: '38px' }}
          title="Expand Immersive Now Playing"
        >
          <Maximize2 size={17} />
        </button>

        {/* Toggle Lyrics Drawer */}
        <button
          id="toggle-lyrics-drawer-btn"
          data-testid="toggle-lyrics-drawer-btn"
          onClick={toggleLyricsDrawer}
          aria-label="Toggle floating lyrics"
          className="btn-icon"
          style={{ width: '38px', height: '38px' }}
          title="Floating Synchronized Lyrics"
        >
          <FileText size={17} />
        </button>

        {/* Studio Volume controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleMuteToggle}
            aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Master volume control"
            style={{
              width: '80px',
              accentColor: 'var(--accent-warm)',
              cursor: 'pointer',
              height: '4px'
            }}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .player-center {
            max-width: none !important;
          }
          .player-right .btn-icon,
          .player-right input[type="range"],
          .player-right button[aria-label*="Mute"] {
            display: none !important;
          }
          .player-right {
            width: auto !important;
          }
        }
      `}</style>
    </aside>
  );
};
