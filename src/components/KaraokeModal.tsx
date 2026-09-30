import React, { useEffect, useState } from 'react';
import { X, Sparkles, Music, AlertCircle, Loader2, Play, Volume2, Mic, MicOff } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { karaokePlaybackService } from '../services/audio/karaokePlaybackService';
import { capabilityService } from '../services/capability/capabilityService';
import { lyricsService } from '../services/lyrics/lyricsService';
import { WaveformTimeline } from './WaveformTimeline';
import type { TimedLyricLine } from '../types/music';
import { SUPPORTED_LANGUAGES } from '../types/music';

export const KaraokeModal: React.FC = () => {
  const {
    karaokeModalOpen,
    closeKaraokeModal,
    currentSong,
    selectedSection,
    setSelectedSection,
    activeLanguage,
    setActiveLanguage,
    setDisplayLanguage,
    startKaraokeRecording,
    playSong,
    bgmVolume,
    setBgmVolume,
    voiceVolume,
    setVoiceVolume,
    isMicEnabled,
    toggleMic,
    seekTo
  } = useAudioPlayer();

  const capabilities = capabilityService.evaluate(currentSong);
  const karaokeCap = capabilities.karaoke;
  const isKaraokeEligible = karaokeCap !== 'UNAVAILABLE';
  const isSingAlong = karaokeCap === 'SING_ALONG';
  const [backingStatus, setBackingStatus] = useState<'verifying' | 'ready' | 'unavailable'>(() =>
    isKaraokeEligible ? 'verifying' : 'unavailable'
  );

  const [selectedLineIndex, setSelectedLineIndex] = useState<number>(-1);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && karaokeModalOpen) {
        closeKaraokeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [karaokeModalOpen, closeKaraokeModal]);

  // Backing audio verification before allowing recording
  useEffect(() => {
    if (!karaokeModalOpen) return;

    if (!isKaraokeEligible) {
      setBackingStatus('unavailable');
      return;
    }

    let isCurrent = true;
    setBackingStatus('verifying');

    karaokePlaybackService
      .loadBackingSource(currentSong, selectedSection.start)
      .then(() => {
        if (isCurrent) setBackingStatus('ready');
      })
      .catch((err) => {
        console.warn('Backing audio failed verification:', err);
        if (isCurrent) setBackingStatus('unavailable');
      });

    return () => {
      isCurrent = false;
    };
  }, [karaokeModalOpen, currentSong, selectedSection.start, isKaraokeEligible]);

  if (!karaokeModalOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };



  const currentLines = lyricsService.getCanonicalLyricLines(currentSong);
  const lyricsCapability = lyricsService.getLyricsCapability(currentSong);
  const isSyncedLyrics = lyricsCapability === 'SYNCED_LYRICS' && currentLines.length > 0;
  const currentSnippet = currentSong.lyrics?.en?.chorusSnippet || currentSong.title;

  // Active or selected line
  const activeLine = currentLines.find((l) => {
    const t = l.startTime !== undefined && l.startTime >= 0 ? l.startTime : l.time ?? 0;
    return t >= selectedSection.start && t <= selectedSection.end;
  }) || currentLines[0];

  const sectionTranslation = activeLine ? lyricsService.getLineTranslation(activeLine, activeLanguage) : null;

  // Click on a synchronized lyric line -> Seek playhead & set as starting line
  const handleLyricLineClick = (line: TimedLyricLine, index: number) => {
    const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : (line.time || 0);
    seekTo(lineTime);
    setSelectedLineIndex(index);
    setSelectedSection({
      type: 'custom',
      label: line.text.slice(0, 24) || 'Custom Line',
      start: lineTime,
      end: Math.min(currentSong.duration || 255, lineTime + 300)
    });
  };

  const handleGo = () => {
    if (backingStatus !== 'ready' || !isKaraokeEligible) return;
    startKaraokeRecording(selectedSection);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="karaoke-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 32px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeKaraokeModal();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(24px, 4vw, 38px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 50px rgba(231, 165, 141, 0.1)',
          position: 'relative'
        }}
      >
        {/* Close button */}
        <button
          onClick={closeKaraokeModal}
          aria-label="Close karaoke modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(244, 240, 235, 0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FFFFFF';
            e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.14)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.06)';
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Title & Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: karaokeCap === 'KARAOKE_READY'
                  ? '#4ADE80'
                  : karaokeCap === 'SING_ALONG'
                  ? 'var(--accent-cream)'
                  : 'var(--text-dim)',
                textTransform: 'uppercase'
              }}
            >
              {karaokeCap === 'KARAOKE_READY'
                ? 'KARAOKE READY'
                : karaokeCap === 'SING_ALONG'
                ? 'SING-ALONG'
                : 'KARAOKE UNAVAILABLE'}
            </span>
            <span
              style={{
                width: '20px',
                height: '1px',
                backgroundColor: 'rgba(231, 165, 141, 0.3)'
              }}
            />
          </div>

          <h2
            id="karaoke-modal-title"
            style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0 0 6px 0'
            }}
          >
            SING THE MOMENT
          </h2>

          <p
            style={{
              fontSize: '0.96rem',
              color: 'var(--text-muted)',
              margin: 0
            }}
          >
            Choose where you want to sing.
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '10px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(244, 240, 235, 0.04)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}
          >
            <Music size={13} color="var(--accent-warm)" />
            <span>
              {currentSong.title} — {currentSong.artist}
            </span>
          </div>
        </div>

        {/* Lyric-First Start Position & Mode Status */}
        <div
          data-testid="karaoke-start-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(244, 240, 235, 0.03)',
            border: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                START POSITION
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent-cream)' }}>
                {formatTime(selectedSection.start)}
              </span>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(244, 240, 235, 0.1)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                RECORDING MODE
              </span>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#4ADE80', letterSpacing: '0.02em' }}>
                Unlimited • Manual Stop
              </span>
            </div>
          </div>

          <WaveformTimeline
            song={currentSong}
            section={selectedSection}
            onChangeSection={setSelectedSection}
            height={48}
          />
        </div>

        {/* LYRIC-FIRST SYNCHRONIZED LYRICS VIEWER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isSyncedLyrics ? 'Tap any lyric line to start singing from that exact moment:' : 'Timeline Navigation:'}
            </span>

            {/* Language Selector */}
            <div
              className="glass-pill"
              role="radiogroup"
              aria-label="Karaoke modal language selection"
              style={{ display: 'inline-flex', padding: '3px', gap: '4px' }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = activeLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setActiveLanguage(lang.code);
                      setDisplayLanguage(lang.code);
                    }}
                    style={{
                      background: isSelected ? 'rgba(231, 165, 141, 0.25)' : 'transparent',
                      color: isSelected ? 'var(--accent-cream)' : 'var(--text-muted)',
                      border: isSelected ? '1px solid var(--border-warm)' : 'none',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title={lang.nativeLabel}
                  >
                    {lang.code === 'en' ? 'English' : lang.nativeLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synchronized Lyrics List or Truthful Fallback */}
          {isSyncedLyrics ? (
            <div
              id="karaoke-lyrics-viewer"
              data-testid="karaoke-lyrics-viewer"
              style={{
                maxHeight: '190px',
                overflowY: 'auto',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(8, 11, 16, 0.85)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {currentLines.map((line, idx) => {
                const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : (line.time || 0);
                const isSelected =
                  selectedLineIndex === idx ||
                  (selectedLineIndex === -1 && Math.abs(selectedSection.start - lineTime) < 2);
                const translation = lyricsService.getLineTranslation(line, activeLanguage);

                return (
                  <div
                    key={idx}
                    data-testid="karaoke-lyric-line"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleLyricLineClick(line, idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleLyricLineClick(line, idx);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'rgba(231, 165, 141, 0.16)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent-warm)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.94rem',
                        color: isSelected ? 'var(--accent-cream)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {translation.text}
                    </span>

                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: isSelected ? 'var(--accent-warm)' : 'var(--text-dim)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {formatTime(lineTime)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Truthful Synchronized Lyrics Fallback */
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(8, 11, 16, 0.7)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
                <AlertCircle size={15} />
                <span>Synchronized lyrics unavailable for this track — use timeline to choose your start position</span>
              </div>
              <input
                type="range"
                min={0}
                max={currentSong.duration || 255}
                step={1}
                value={selectedSection.start}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  seekTo(val);
                  setSelectedSection({
                    type: 'custom',
                    label: `Start at ${formatTime(val)}`,
                    start: val,
                    end: Math.min(currentSong.duration || 255, val + 300)
                  });
                }}
                aria-label="Authoritative timeline start position"
                style={{ width: '100%', height: '6px', accentColor: 'var(--accent-warm)', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* Translated Lyric Preview Box */}
          <div
            data-testid="karaoke-section-snippet"
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(8, 11, 16, 0.7)',
              border: '1px solid rgba(244, 240, 235, 0.08)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Lyrics for this moment
            </div>
            <p
              className="serif-italic"
              style={{
                fontSize: '1.25rem',
                color: 'var(--accent-cream)',
                margin: '0 0 2px 0',
                lineHeight: 1.3
              }}
            >
              &ldquo;{sectionTranslation ? sectionTranslation.text : (activeLine ? activeLine.text : currentSnippet)}&rdquo;
            </p>
          </div>
        </div>

        {/* Studio Live Mixer Controls: Music Volume, My Voice Volume, Mic Mute */}
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
          {/* Backing Music Volume Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Volume2 size={16} color="var(--accent-warm)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '70px' }}>
              Music: {Math.round(bgmVolume * 100)}%
            </span>
            <input
              id="karaoke-music-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgmVolume}
              onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
              aria-label="Backing music volume"
              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-warm)', cursor: 'pointer' }}
            />
          </div>

          {/* My Voice / Mic Volume Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <button
              onClick={toggleMic}
              aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              style={{
                background: 'none',
                border: 'none',
                color: isMicEnabled ? 'var(--accent-cream)' : '#EF4444',
                cursor: 'pointer',
                padding: '2px'
              }}
              title={isMicEnabled ? 'Mic active' : 'Mic muted'}
            >
              {isMicEnabled ? <Mic size={16} color="var(--accent-cream)" /> : <MicOff size={16} color="#EF4444" />}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '75px' }}>
              My Voice: {isMicEnabled ? `${Math.round(voiceVolume * 100)}%` : 'Muted'}
            </span>
            <input
              id="karaoke-voice-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={!isMicEnabled}
              value={voiceVolume}
              onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              aria-label="Microphone volume"
              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-cream)', cursor: 'pointer', opacity: isMicEnabled ? 1 : 0.4 }}
            />
          </div>
        </div>

        {/* Bottom CTA Button: Start Recording (No arbitrary limits) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isKaraokeEligible || backingStatus === 'unavailable' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#FCA5A5',
                  fontSize: '0.92rem',
                  fontWeight: 500
                }}
              >
                <AlertCircle size={20} color="#EF4444" />
                <span>Karaoke unavailable for this track (no authorized instrumental source).</span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  disabled
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(244, 240, 235, 0.06)',
                    color: 'var(--text-dim)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-subtle)',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <span>Karaoke Unavailable</span>
                </button>

                {currentSong.playbackAvailable && (
                  <button
                    onClick={() => {
                      closeKaraokeModal();
                      playSong(currentSong);
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '16px',
                      fontSize: '1rem',
                      justifyContent: 'center'
                    }}
                    title="Play original song in Normal Player"
                  >
                    <Play size={18} fill="#080B10" />
                    <span>Play Normal Song</span>
                  </button>
                )}
              </div>
            </div>
          ) : backingStatus === 'verifying' ? (
            <button
              disabled
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(231, 165, 141, 0.25)',
                color: 'var(--accent-cream)',
                fontSize: '1.05rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'wait',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <Loader2 size={18} className="animate-spin" />
              <span>Verifying backing audio...</span>
            </button>
          ) : (
            <>
              <button
                id="sing-moment-btn"
                data-testid="karaoke-launch-btn"
                onClick={handleGo}
                aria-label="Sing This Moment"
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-warm)',
                  color: '#080B10',
                  fontSize: '1.12rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 30px rgba(231, 165, 141, 0.35)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.backgroundColor = '#efb5a0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = 'var(--accent-warm)';
                }}
              >
                <Sparkles size={18} fill="#080B10" />
                <span>Sing This Moment</span>
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                {isSingAlong
                  ? `Live microphone monitoring & synced lyrics active • Backing starts at ${formatTime(selectedSection.start)}. Record freely until you choose to stop.`
                  : `Instrumental backing active • Backing starts at ${formatTime(selectedSection.start)}. Record freely until you choose to stop.`}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
