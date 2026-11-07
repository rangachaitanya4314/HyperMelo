import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  FileText,
  Repeat,
  Shuffle,
  Loader2,
  AlertCircle,
  Maximize2,
  Heart,
  Plus,
  Share2,
  Sparkles
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { MulticolorSpectrum } from './MulticolorSpectrum';
import { getConsumerLicenseLabel, getCanonicalTrackDuration } from '../shared';
import './BottomPlayer.css';

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
    setIsLoopingSection,
    soundMode,
    isDspSupported,
    activeDspDescription,
    cycleSoundMode,
    toggleLikeSong,
    isSongLiked,
    openAddToPlaylist,
    openShareMoment
  } = useAudioPlayer();

  const isLiked = currentSong ? isSongLiked(currentSong.id) : false;

  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const updateHeight = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        document.documentElement.style.setProperty('--bottom-player-height', `${Math.ceil(rect.height)}px`);
      }
    };
    updateHeight();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateHeight);
      ro.observe(el);
    }
    window.addEventListener('resize', updateHeight);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

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

  const isPreview = Boolean(
    currentSong?.isStreamPreview ||
    currentSong?.playbackType === 'preview' ||
    currentSong?.playbackSourceType === 'preview'
  );
  const canonicalDuration = getCanonicalTrackDuration(currentSong);
  const effectiveDuration = isPreview
    ? (duration > 0 && duration <= 60 ? duration : canonicalDuration)
    : (duration > 0 ? duration : canonicalDuration);
  const progressPercent = currentSong && effectiveDuration > 0 ? Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100)) : 0;
  const bufferPercent = currentSong && effectiveDuration > 0 ? Math.max(0, Math.min(100, (bufferedTime / effectiveDuration) * 100)) : 0;

  return (
    <aside
      ref={asideRef}
      role="region"
      aria-label="NARO Studio Audio Player"
      className="bottom-player-aside"
    >
      {/* Subtle Studio Metallic Top Accent Trim */}
      <div className="bottom-player-accent-trim" />

      {/* Mobile Top Edge Slim Progress Track */}
      <div className="player-mobile-progress-track" aria-hidden="true">
        <div
          className="player-mobile-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* =====================================================================
          REGION 1 (Mobile Row 2 Left / Desktop Left): Artwork & Track Metadata
          ===================================================================== */}
      <div className="player-left">
        <div
          className="player-artwork-box"
          onClick={togglePlay}
          title={currentSong ? "Toggle playback" : "Play music"}
          aria-label={currentSong ? "Toggle playback" : "Play music"}
          role="button"
          tabIndex={0}
        >
          <AbstractArtwork
            artwork={currentSong?.artwork}
            song={currentSong}
            trackId={currentSong?.id}
            title={currentSong?.title}
            artist={currentSong?.artist}
            isPlaying={isPlaying}
            size={50}
          />
        </div>

        <div
          id="bottom-player-track-info"
          data-testid="bottom-player-track-info"
          onClick={currentSong ? openNowPlaying : undefined}
          className="player-track-info"
          title={currentSong ? "Expand Now Playing" : undefined}
          role={currentSong ? "button" : undefined}
          tabIndex={currentSong ? 0 : undefined}
        >
          <span className="player-track-title">
            {currentSong?.title || 'No track selected'}
          </span>

          <div className="player-track-sub">
            <span className="player-track-artist">
              {currentSong?.artist || 'Select a track to play'}
            </span>

            {isPreview && (
              <span
                id="player-preview-badge"
                data-testid="player-preview-badge"
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(231, 165, 141, 0.15)',
                  color: 'var(--accent-warm)',
                  border: '1px solid rgba(231, 165, 141, 0.3)',
                  whiteSpace: 'nowrap'
                }}
                title="30-second official preview stream"
              >
                PREVIEW (30s)
              </span>
            )}

            {(() => {
              const lic = getConsumerLicenseLabel(currentSong?.attribution);
              if (!lic) return null;
              return (
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
                  title={`${currentSong?.attribution?.text || ''}\nSource: ${currentSong?.attribution?.sourceName || ''}`}
                >
                  {lic}
                </span>
              );
            })()}

            {/* Multicolor Audio Spectrum */}
            <div className="player-track-spectrum">
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

        {/* Quick Like Action (desktop left cluster) */}
        <div className="player-left-actions">
          <button
            type="button"
            id="bottom-player-like-btn"
            data-testid="bottom-player-like-btn"
            disabled={!currentSong}
            onClick={(e) => {
              e.stopPropagation();
              if (currentSong) toggleLikeSong(currentSong);
            }}
            aria-label={isLiked ? 'Unlike song' : 'Like song'}
            className="player-icon-btn"
            title={isLiked ? 'Unlike song' : 'Save to Liked Songs'}
            style={{ opacity: currentSong ? 1 : 0.4, cursor: currentSong ? 'pointer' : 'default' }}
          >
            <Heart
              size={18}
              fill={isLiked ? 'var(--accent-warm)' : 'none'}
              color={isLiked ? 'var(--accent-warm)' : 'var(--text-muted)'}
            />
          </button>

          <button
            type="button"
            id="bottom-player-add-playlist-btn"
            data-testid="bottom-player-add-playlist-btn"
            disabled={!currentSong}
            onClick={(e) => {
              e.stopPropagation();
              if (currentSong) openAddToPlaylist(currentSong);
            }}
            aria-label="Add to playlist"
            className="player-icon-btn"
            title="Add to playlist"
            style={{ opacity: currentSong ? 1 : 0.4, cursor: currentSong ? 'pointer' : 'default' }}
          >
            <Plus size={18} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          REGION 2 (Mobile Row 1: Dedicated Scrubber; Row 3: Buttons)
          ===================================================================== */}
      <div className="player-center">
        {/* Buttons Row (Controls: Shuffle, Prev, Play/Pause, Next, Repeat) */}
        <div className="player-buttons-row">
          <button
            type="button"
            onClick={() => setIsShuffle(!isShuffle)}
            aria-label={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
            className="player-control-icon-btn"
            style={{
              color: isShuffle ? 'var(--accent-warm)' : 'var(--text-dim)'
            }}
            title={isShuffle ? 'Shuffle active' : 'Shuffle tracks'}
          >
            <Shuffle size={18} />
          </button>

          <button
            type="button"
            onClick={prevSong}
            aria-label="Previous track"
            className="player-control-icon-btn"
            title="Previous track"
          >
            <SkipBack size={20} />
          </button>

          {/* Master Play/Pause with Loading/Buffering feedback */}
          <button
            type="button"
            id="bottom-play-btn"
            data-testid="bottom-play-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="player-master-play-btn"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState === 'loading' || playbackState === 'buffering' ? (
              <Loader2 size={20} className="animate-spin" color="#080B10" />
            ) : isPlaying ? (
              <Pause size={20} fill="#080B10" />
            ) : (
              <Play size={20} fill="#080B10" style={{ marginLeft: '2px' }} />
            )}
          </button>

          <button
            type="button"
            onClick={nextSong}
            aria-label="Next track"
            className="player-control-icon-btn"
            title="Next track"
          >
            <SkipForward size={20} />
          </button>

          <button
            type="button"
            onClick={() => setIsLoopingSection(!isLoopingSection)}
            aria-label="Loop active moment"
            className="player-control-icon-btn"
            style={{
              color: isLoopingSection ? 'var(--accent-warm)' : 'var(--text-dim)'
            }}
            title={isLoopingSection ? 'Looping current moment' : 'Repeat moment'}
          >
            <Repeat size={18} />
          </button>
        </div>

        {/* Dedicated Scrubber progress bar mapped to actual playback clock */}
        <div className="player-scrubber-row">
          <span className="player-time-display player-time-current">
            {formatTime(currentTime)}
          </span>

          <div
            style={{
              position: 'relative',
              flex: 1,
              height: '5px',
              backgroundColor: 'rgba(244, 240, 235, 0.14)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center'
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
                backgroundColor: 'rgba(244, 240, 235, 0.22)',
                borderRadius: '3px'
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
                borderRadius: '3px',
                boxShadow: '0 0 8px rgba(231, 165, 141, 0.45)'
              }}
            />

            {/* Seeking input with isolated 44px vertical touch hit area */}
            <input
              id="bottom-seek-slider"
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.2}
              value={currentSong ? currentTime : 0}
              disabled={!currentSong}
              onChange={handleProgressChange}
              aria-label="Song progress seek"
              style={{
                position: 'absolute',
                top: '-19px',
                bottom: '-19px',
                left: 0,
                width: '100%',
                height: '44px',
                opacity: 0,
                cursor: 'pointer',
                touchAction: 'manipulation',
                margin: 0
              }}
            />
          </div>

          <span className="player-time-display player-time-duration">
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Honest Error / Status Feedback */}
        {(() => {
          const userFriendlyError = formatPlaybackError(playbackError);
          if (userFriendlyError) {
            return (
              <div
                id="player-status-message"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.72rem',
                  color: '#FCA5A5',
                  padding: '2px 0'
                }}
              >
                <AlertCircle size={12} />
                <span>{userFriendlyError}</span>
              </div>
            );
          }
          if (playbackState === 'ended' && isPreview) {
            return (
              <div
                id="player-preview-ended-notice"
                data-testid="player-preview-ended-notice"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.72rem',
                  color: 'var(--accent-warm)',
                  padding: '2px 0'
                }}
              >
                <span>30-second preview completed. Full track requires authorized provider subscription.</span>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* =====================================================================
          REGION 3 (Mobile Row 2 Right / Desktop Right): Actions & Studio Volume
          ===================================================================== */}
      <div className="player-right">
        {/* Mobile quick like button when left actions are hidden */}
        <button
          type="button"
          disabled={!currentSong}
          onClick={(e) => {
            e.stopPropagation();
            if (currentSong) toggleLikeSong(currentSong);
          }}
          aria-label={isLiked ? 'Unlike song' : 'Like song'}
          className="player-icon-btn mobile-like-btn"
          title={isLiked ? 'Unlike song' : 'Save to Liked Songs'}
          style={{ display: 'none', opacity: currentSong ? 1 : 0.4 }}
        >
          <Heart
            size={18}
            fill={isLiked ? 'var(--accent-warm)' : 'none'}
            color={isLiked ? 'var(--accent-warm)' : 'var(--text-muted)'}
          />
        </button>

        {/* NARO Audiophile Sound Profile Pill */}
        <button
          id="sound-profile-toggle-btn"
          data-testid="sound-profile-toggle-btn"
          onClick={cycleSoundMode}
          disabled={!isDspSupported}
          aria-label={!isDspSupported ? 'Sound processing unavailable for current source' : `Sound profile: ${soundMode.toUpperCase()}`}
          className="player-desktop-sound-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            minHeight: '44px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: !isDspSupported
              ? 'rgba(244, 240, 235, 0.03)'
              : soundMode === 'punch'
              ? 'rgba(245, 158, 11, 0.18)'
              : soundMode === 'immersive'
              ? 'rgba(231, 165, 141, 0.18)'
              : 'rgba(244, 240, 235, 0.05)',
            border: !isDspSupported
              ? '1px dashed rgba(244, 240, 235, 0.15)'
              : soundMode === 'punch'
              ? '1px solid rgba(245, 158, 11, 0.4)'
              : soundMode === 'immersive'
              ? '1px solid var(--border-warm)'
              : '1px solid rgba(244, 240, 235, 0.08)',
            color: !isDspSupported
              ? 'var(--text-dim)'
              : soundMode === 'punch'
              ? '#FCD34D'
              : soundMode === 'immersive'
              ? 'var(--accent-cream)'
              : 'var(--text-dim)',
            fontSize: '0.74rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: !isDspSupported ? 'not-allowed' : 'pointer',
            opacity: !isDspSupported ? 0.6 : 1,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            touchAction: 'manipulation'
          }}
          title={
            !isDspSupported
              ? 'DSP processing bypassed for this stream (External iframe / DRM)'
              : soundMode === 'original'
              ? 'Original Mode: Bit-perfect source bypass (Zero coloration) - Click to cycle'
              : `${soundMode.toUpperCase()} Mode: ${activeDspDescription} - Click to cycle`
          }
        >
          <Sparkles
            size={14}
            color={
              !isDspSupported
                ? 'var(--text-dim)'
                : soundMode === 'punch'
                ? '#F59E0B'
                : soundMode === 'immersive'
                ? 'var(--accent-warm)'
                : 'var(--text-dim)'
            }
          />
          <span>
            {!isDspSupported
              ? 'DSP BYPASS'
              : soundMode === 'punch'
              ? 'PUNCH'
              : soundMode === 'immersive'
              ? 'IMMERSIVE'
              : 'ORIGINAL'}
          </span>
        </button>

        {/* Toggle Lyrics Drawer */}
        <button
          type="button"
          id="toggle-lyrics-drawer-btn"
          data-testid="toggle-lyrics-drawer-btn"
          onClick={toggleLyricsDrawer}
          aria-label="Toggle floating lyrics"
          className="player-icon-btn"
          title="Floating Synchronized Lyrics"
        >
          <FileText size={18} />
        </button>

        {/* Share Moment Button */}
        <button
          type="button"
          id="bottom-player-share-moment-btn"
          data-testid="bottom-player-share-moment-btn"
          onClick={() => openShareMoment(currentSong)}
          aria-label="Share Moment"
          className="player-icon-btn"
          title="Create & Share 9:16 Lyric Moment"
        >
          <Share2 size={18} />
        </button>

        {/* Expand Now Playing Button — Always independently accessible with min 44x44px touch target */}
        <button
          type="button"
          id="expand-now-playing-btn"
          data-testid="expand-now-playing-btn"
          onClick={openNowPlaying}
          aria-label="Expand Now Playing"
          className="player-icon-btn"
          title="Expand Immersive Now Playing"
        >
          <Maximize2 size={18} />
        </button>

        {/* Studio Volume controls (Desktop only) */}
        <div className="player-volume-wrap">
          <button
            type="button"
            onClick={handleMuteToggle}
            aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
            className="player-control-icon-btn"
            style={{ padding: '6px' }}
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
        @media (max-width: 768px) {
          .mobile-like-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </aside>
  );
};
