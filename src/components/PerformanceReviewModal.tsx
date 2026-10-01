import React, { useState, useEffect } from 'react';
import { Play, Pause, Share2, Download, Check, X, RotateCcw, Save, Trash2, Mic2, Volume2, Mic } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { takePlaybackService } from '../services/audio/takePlaybackService';

export const PerformanceReviewModal: React.FC = () => {
  const {
    reviewModalOpen,
    dismissReviewModal,
    recordedTake,
    currentSong,
    openKaraokeForSong,
    saveTakeToLibrary,
    deleteTakeFromLibrary,
    downloadTake
  } = useAudioPlayer();

  const [isPlayingBack, setIsPlayingBack] = useState<boolean>(false);
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true); // Pre-persisted via IndexedDB
  const [musicVolume, setMusicVolume] = useState<number>(0.8);
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);

  // Setup backing audio and voice recording via TakePlaybackService
  useEffect(() => {
    if (!reviewModalOpen || !recordedTake?.audioBlobUrl) {
      takePlaybackService.stopReviewSession();
      setIsPlayingBack(false);
      setPlaybackTime(0);
      return;
    }

    const backingStream = currentSong.karaokeSource?.streamUrl || currentSong.playbackSource?.streamUrl;
    const initialOffset = (recordedTake as any).startTime || 0;

    takePlaybackService.initReviewSession(recordedTake, backingStream, initialOffset);

    const unsubscribe = takePlaybackService.subscribeReview((state) => {
      setIsPlayingBack(state.isPlaying);
      setPlaybackTime(state.currentTime);
      setVoiceVolume(state.voiceVolume);
      setMusicVolume(state.musicVolume);
    });

    return () => {
      unsubscribe();
      takePlaybackService.stopReviewSession();
    };
  }, [reviewModalOpen, recordedTake?.audioBlobUrl, currentSong]);

  if (!reviewModalOpen || !recordedTake) return null;

  const handlePlayToggle = () => {
    takePlaybackService.toggleReviewPlayback();
  };

  const handleMusicVolumeChange = (newVol: number) => {
    setMusicVolume(newVol);
    takePlaybackService.setReviewMusicVolume(newVol);
  };

  const handleVoiceVolumeChange = (newVol: number) => {
    setVoiceVolume(newVol);
    takePlaybackService.setReviewVoiceVolume(newVol);
  };

  const handleClose = () => {
    takePlaybackService.stopReviewSession();
    dismissReviewModal();
  };

  const handleRerecord = () => {
    takePlaybackService.stopReviewSession();
    dismissReviewModal();
    openKaraokeForSong(currentSong);
  };

  const handleSave = async () => {
    if (!recordedTake) return;
    await saveTakeToLibrary(recordedTake);
    setIsSaved(true);
  };

  const handleDelete = async () => {
    takePlaybackService.stopReviewSession();
    if (recordedTake) {
      try {
        await deleteTakeFromLibrary(recordedTake.id);
      } catch (err) {
        console.warn('Error deleting take from library:', err);
      }
    }
    dismissReviewModal();
  };

  const handleShare = () => {
    setCopiedLink(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(
        `Listen to my NARO moment: ${recordedTake.songTitle} (${recordedTake.sectionLabel})`
      );
    }
    setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleDownload = () => {
    downloadTake(recordedTake);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  const languageLabels: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी',
    te: 'తెలుగు'
  };

  const totalDuration = recordedTake.duration || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 6, 9, 0.94)',
        backdropFilter: 'blur(24px)',
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 32px)'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '580px',
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(24px, 4vw, 36px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(231, 165, 141, 0.12)',
          position: 'relative',
          backgroundColor: 'rgba(11, 16, 26, 0.98)',
          border: '1px solid rgba(244, 240, 235, 0.12)'
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close review modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        {/* Header: YOUR TAKE */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(231, 165, 141, 0.12)',
              border: '1px solid rgba(231, 165, 141, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-warm)',
              marginBottom: '10px'
            }}
          >
            <Mic2 size={24} />
          </div>

          <h2
            id="review-title"
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              margin: '0 0 4px 0',
              textTransform: 'uppercase'
            }}
          >
            YOUR TAKE
          </h2>

          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: 0 }}>
            {recordedTake.songTitle} • {recordedTake.artist}
            <span style={{ color: 'var(--accent-warm)', marginLeft: '6px' }}>
              [{recordedTake.sectionLabel}]
            </span>
            {recordedTake.language && (
              <span style={{ color: 'var(--text-dim)', marginLeft: '6px' }}>
                ({languageLabels[recordedTake.language] || recordedTake.language})
              </span>
            )}
          </p>
        </div>

        {/* Performance Analysis - TRUTHFUL: NO fabricated scores, percentages, stars, or grades */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(244, 240, 235, 0.03)',
            border: '1px solid rgba(244, 240, 235, 0.08)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--accent-warm)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700
              }}
            >
              Performance analysis unavailable • Analysis unavailable
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            NARO preserves your authentic voice recording without fabricated pitch, accuracy, or percentage ratings.
          </p>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
            Captured {recordedTake.duration}s of audio directly from your microphone.
          </span>
        </div>

        {/* Studio Mixer: Music volume slider & My Voice volume slider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '12px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(244, 240, 235, 0.04)',
            border: '1px solid rgba(244, 240, 235, 0.08)',
            flexWrap: 'wrap'
          }}
        >
          {/* Music volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Volume2 size={16} color="var(--accent-warm)" />
            <label
              htmlFor="review-music-volume-slider"
              style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '70px', cursor: 'pointer' }}
            >
              Music: {Math.round(musicVolume * 100)}%
            </label>
            <input
              id="review-music-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVolume}
              onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
              aria-label="Music volume slider"
              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-warm)', cursor: 'pointer' }}
            />
          </div>

          {/* My Voice volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Mic size={16} color="var(--accent-cream)" />
            <label
              htmlFor="review-voice-volume-slider"
              style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '75px', cursor: 'pointer' }}
            >
              My Voice: {Math.round(voiceVolume * 100)}%
            </label>
            <input
              id="review-voice-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voiceVolume}
              onChange={(e) => handleVoiceVolumeChange(parseFloat(e.target.value))}
              aria-label="My Voice volume slider"
              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-cream)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Playback Take Audio Preview with Scrubber */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '16px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(244, 240, 235, 0.04)',
            border: '1px solid rgba(244, 240, 235, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                id="review-play-btn"
                data-testid="review-play-btn"
                onClick={handlePlayToggle}
                aria-label={isPlayingBack ? 'Pause take' : 'Play take'}
                className="btn-icon"
                style={{
                  width: '42px',
                  height: '42px',
                  backgroundColor: 'var(--accent-warm)',
                  color: '#080B10'
                }}
              >
                {isPlayingBack ? (
                  <Pause size={18} fill="#080B10" />
                ) : (
                  <Play size={18} fill="#080B10" style={{ marginLeft: '2px' }} />
                )}
              </button>

              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Take Preview ({recordedTake.sectionLabel})
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatSeconds(playbackTime)} / {formatSeconds(totalDuration)} • Genuine recording
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleDownload}
                aria-label="Download audio recording"
                className="btn-icon"
                style={{ width: '36px', height: '36px' }}
                title="Download audio file"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleShare}
                aria-label="Share take"
                className="btn-icon"
                style={{ width: '36px', height: '36px' }}
                title="Share take"
              >
                {copiedLink ? <Check size={16} color="#10B981" /> : <Share2 size={16} />}
              </button>
            </div>
          </div>

          {/* Scrub bar */}
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'rgba(244, 240, 235, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${totalDuration > 0 ? (playbackTime / totalDuration) * 100 : 0}%`,
                height: '100%',
                backgroundColor: 'var(--accent-warm)',
                transition: 'width 0.1s linear'
              }}
            />
          </div>
        </div>

        {/* 4 Primary Action Buttons: Play, Re-record, Save to Library, Delete */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
            gap: '10px'
          }}
        >
          {/* Action 1: Play / Pause */}
          <button
            onClick={handlePlayToggle}
            className="btn-secondary"
            style={{
              justifyContent: 'center',
              padding: '12px 14px',
              fontSize: '0.86rem',
              fontWeight: 500
            }}
            title={isPlayingBack ? 'Pause audio' : 'Play audio'}
          >
            {isPlayingBack ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlayingBack ? 'Pause' : 'Play'}</span>
          </button>

          {/* Action 2: Re-record */}
          <button
            onClick={handleRerecord}
            className="btn-secondary"
            style={{
              justifyContent: 'center',
              padding: '12px 14px',
              fontSize: '0.86rem',
              fontWeight: 500
            }}
            title="Sing another take for this song"
          >
            <RotateCcw size={16} />
            <span>Re-record</span>
          </button>

          {/* Action 3: Save to Library */}
          <button
            onClick={handleSave}
            className="btn-primary"
            style={{
              justifyContent: 'center',
              padding: '12px 14px',
              fontSize: '0.86rem',
              fontWeight: 600,
              backgroundColor: isSaved ? '#10B981' : undefined
            }}
            title="Save take to IndexedDB library"
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            <span>{isSaved ? 'Saved to Library' : 'Save'}</span>
          </button>

          {/* Action 4: Delete */}
          <button
            onClick={handleDelete}
            className="btn-secondary"
            style={{
              justifyContent: 'center',
              padding: '12px 14px',
              fontSize: '0.86rem',
              fontWeight: 500,
              color: '#EF4444',
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }}
            title="Delete this take"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
