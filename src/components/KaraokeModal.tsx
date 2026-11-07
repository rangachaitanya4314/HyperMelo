import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, Sparkles, Music, AlertCircle, Loader2, Play, Volume2, Mic, MicOff, RotateCw } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { karaokePlaybackService } from '../services/audio/karaokePlaybackService';
import { capabilityService } from '../services/capability/capabilityService';
import { lyricsService, getLyricQueueIndices } from '../services/lyrics/lyricsService';
import { lyricsPipelineService } from '../services/lyrics/lyricsPipelineService';
import { WaveformTimeline } from './WaveformTimeline';
import type { TimedLyricLine } from '../types/music';
import { vocalRemovalService } from '../services/audio/vocalSeparation/vocalRemovalService';
import { karaokeMixer } from '../services/audio/karaokeMixer';
import { getKaraokeLyricLine } from '../shared/lyrics';

export const KaraokeModal: React.FC = () => {
  const {
    karaokeModalOpen,
    closeKaraokeModal,
    currentSong,
    selectedSection,
    setSelectedSection,
    karaokeScriptPreference,
    setKaraokeScriptPreference,
    startKaraokeRecording,
    playSong,
    bgmVolume,
    setBgmVolume,
    voiceVolume,
    setVoiceVolume,
    isMicEnabled,
    toggleMic,
    seekTo,
    currentTime,
    isPlaying,
    lyricsRevision
  } = useAudioPlayer();

  const capabilities = capabilityService.evaluate(currentSong);
  const karaokeCap = capabilities.karaoke;
  const vocalResolution = vocalRemovalService.resolveMethod(currentSong);
  const isKaraokeEligible = karaokeCap !== 'UNAVAILABLE' || vocalResolution.type === 'center_channel_reduction';
  const isSingAlong = karaokeCap === 'SING_ALONG';
  const [backingStatus, setBackingStatus] = useState<'verifying' | 'ready' | 'unavailable'>(() =>
    isKaraokeEligible ? 'verifying' : 'unavailable'
  );

  const [selectedLineIndex, setSelectedLineIndex] = useState<number>(-1);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState<boolean>(() => {
    if (!currentSong) return false;
    const res = lyricsPipelineService.getResolutionStatus(currentSong);
    return !res || res.outcome === 'PENDING';
  });
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const lyricsListRef = useRef<HTMLDivElement>(null);

  const currentLines = useMemo(
    () => lyricsService.getCanonicalLyricLines(currentSong),
    [currentSong, lyricsRevision]
  );
  const lyricsCapability = useMemo(
    () => lyricsService.getLyricsCapability(currentSong),
    [currentSong, lyricsRevision]
  );
  const isSyncedLyrics = lyricsCapability === 'SYNCED_LYRICS' && currentLines.length > 0;

  // Reset selected line when song changes
  useEffect(() => {
    setSelectedLineIndex(-1);
  }, [currentSong?.id]);

  // Resolve lyrics for canonical song identity with stale-request protection
  useEffect(() => {
    if (!karaokeModalOpen || !currentSong) return;
    let isCurrent = true;
    const songId = currentSong.id;

    const currentStatus = lyricsPipelineService.getResolutionStatus(currentSong);
    if (currentStatus) {
      if (currentStatus.outcome === 'SYNCHRONIZED' || currentStatus.outcome === 'VERIFIED_UNTIMED') {
        setIsLoadingLyrics(false);
        setLyricsError(null);
        return;
      }
      if (currentStatus.outcome === 'CONFIRMED_NO_RESULT') {
        setIsLoadingLyrics(false);
        setLyricsError(currentStatus.errorReason || 'No lyrics available for this track');
        return;
      }
    }

    setIsLoadingLyrics(true);
    setLyricsError(null);

    lyricsPipelineService
      .resolveTrack(currentSong)
      .then((res) => {
        if (!isCurrent || currentSong.id !== songId) return;
        setIsLoadingLyrics(false);
        if (res.outcome === 'CONFIRMED_NO_RESULT') {
          setLyricsError(res.errorReason || 'No lyrics available from supported providers');
        } else if (res.outcome === 'TRANSIENT_FAILURE') {
          setLyricsError(res.errorReason || 'Failed to fetch lyrics. Click retry to try again.');
        } else {
          setLyricsError(null);
        }
      })
      .catch((err) => {
        if (!isCurrent || currentSong.id !== songId) return;
        setIsLoadingLyrics(false);
        setLyricsError(err?.message || 'Network error while retrieving lyrics');
      });

    return () => {
      isCurrent = false;
    };
  }, [karaokeModalOpen, currentSong?.id]);

  const handleRetryLyrics = () => {
    if (!currentSong) return;
    setIsLoadingLyrics(true);
    setLyricsError(null);
    lyricsPipelineService
      .resolveTrack(currentSong, true)
      .then((res) => {
        setIsLoadingLyrics(false);
        if (res.outcome === 'CONFIRMED_NO_RESULT') {
          setLyricsError(res.errorReason || 'No lyrics available from supported providers');
        } else if (res.outcome === 'TRANSIENT_FAILURE') {
          setLyricsError(res.errorReason || 'Failed to fetch lyrics. Click retry to try again.');
        } else {
          setLyricsError(null);
        }
      })
      .catch((err) => {
        setIsLoadingLyrics(false);
        setLyricsError(err?.message || 'Network error while retrieving lyrics');
      });
  };

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

  // Active lyric index follows active audio clock or user selection
  const activeLyricIndex = useMemo(() => {
    if (!karaokeModalOpen || !currentSong || !isSyncedLyrics || currentLines.length === 0) return -1;
    if (selectedLineIndex !== -1 && !isPlaying) {
      return selectedLineIndex;
    }
    return lyricsService.getActiveLyricIndex(currentLines, currentTime, currentSong?.lyricsOffsetMs || 0);
  }, [karaokeModalOpen, currentSong, isSyncedLyrics, currentLines, selectedLineIndex, isPlaying, currentTime]);

  const lyricQueueIndices = useMemo(
    () => getLyricQueueIndices(currentLines, currentTime, currentSong?.lyricsOffsetMs || 0),
    [currentLines, currentTime, currentSong?.lyricsOffsetMs]
  );

  // Active or selected line
  const activeLine = useMemo(() => {
    if (!currentSong || currentLines.length === 0) return null;
    if (activeLyricIndex >= 0 && currentLines[activeLyricIndex]) {
      return currentLines[activeLyricIndex];
    }
    const secStart = selectedSection?.start ?? 0;
    const secEnd = selectedSection?.end ?? (currentSong?.duration || 255);
    return (
      currentLines.find((l) => {
        const t = l.startTime !== undefined && l.startTime >= 0 ? l.startTime : l.time ?? 0;
        return t >= secStart && t <= secEnd;
      }) || currentLines[0] || null
    );
  }, [currentSong, currentLines, activeLyricIndex, selectedSection?.start, selectedSection?.end]);

  const activeKaraoke = useMemo(() => {
    return activeLine ? getKaraokeLyricLine(activeLine, karaokeScriptPreference) : null;
  }, [activeLine, karaokeScriptPreference]);

  // Auto-scroll active lyric line into view smoothly
  useEffect(() => {
    if (karaokeModalOpen && activeLyricIndex >= 0 && lyricsListRef.current) {
      const activeEl = document.getElementById(`karaoke-lyric-${activeLyricIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [karaokeModalOpen, activeLyricIndex]);

  // Backing audio verification before allowing recording
  useEffect(() => {
    if (!karaokeModalOpen || !currentSong) return;

    if (!isKaraokeEligible) {
      setBackingStatus('unavailable');
      return;
    }

    let isCurrent = true;
    setBackingStatus('verifying');

    karaokePlaybackService
      .loadBackingSource(currentSong, selectedSection?.start ?? 0)
      .then(() => {
        if (isCurrent) setBackingStatus('ready');
      })
      .catch((err) => {
        console.warn('Backing audio failed verification:', err);
        if (isCurrent) {
          if (vocalResolution.type === 'center_channel_reduction' || karaokeCap === 'SING_ALONG') {
            setBackingStatus('ready');
          } else {
            setBackingStatus('unavailable');
          }
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [karaokeModalOpen, currentSong, selectedSection?.start, isKaraokeEligible, vocalResolution.type, karaokeCap]);

  const formatTime = (secs?: number) => {
    if (typeof secs !== 'number' || isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Click on a synchronized lyric line -> Seek playhead & set as starting line
  const handleLyricLineClick = (line: TimedLyricLine, index: number) => {
    const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : (line.time || 0);
    seekTo(lineTime);
    setSelectedLineIndex(index);
    setSelectedSection({
      type: 'custom',
      label: line.text.slice(0, 24) || 'Custom Line',
      start: lineTime,
      end: Math.min(currentSong?.duration || 255, lineTime + 300)
    });
  };

  const handleGo = () => {
    if (backingStatus !== 'ready' || !isKaraokeEligible) return;
    startKaraokeRecording(selectedSection || {
      type: 'verse',
      label: 'Verse 1',
      start: 0,
      end: Math.min(currentSong?.duration || 255, 45)
    });
  };

  if (!karaokeModalOpen) return null;

  if (!currentSong) {
    return (
      <div className="karaoke-modal-backdrop" onClick={closeKaraokeModal}>
        <div className="karaoke-modal glass-panel" onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>No track selected</h2>
            <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
              Please select a track before opening Karaoke studio.
            </p>
            <button className="btn-primary" onClick={closeKaraokeModal} style={{ marginTop: '20px' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSnippet = currentSong.lyrics?.en?.chorusSnippet || currentSong.title;

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
            backgroundColor: 'rgba(244, 240, 235, 0.06)',
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

        {/* Automatic Vocal Removal Fidelity Status Banner */}
        <div
          data-testid="vocal-removal-status-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: vocalResolution.type === 'verified_instrumental'
              ? 'rgba(74, 222, 128, 0.08)'
              : vocalResolution.type === 'center_channel_reduction'
              ? 'rgba(245, 158, 11, 0.08)'
              : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${
              vocalResolution.type === 'verified_instrumental'
                ? 'rgba(74, 222, 128, 0.25)'
                : vocalResolution.type === 'center_channel_reduction'
                ? 'rgba(245, 158, 11, 0.25)'
                : 'rgba(239, 68, 68, 0.25)'
            }`,
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: vocalResolution.badgeColor,
                  textTransform: 'uppercase'
                }}
              >
                {vocalResolution.badgeLabel}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>•</span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {vocalResolution.methodName}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
              {vocalResolution.description}
            </p>
          </div>
        </div>

        {/* LYRIC-FIRST SYNCHRONIZED LYRICS VIEWER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isSyncedLyrics ? 'Tap any lyric line to start singing from that exact moment:' : currentLines.length > 0 ? 'Song Lyrics & Timeline Navigation:' : 'Timeline Navigation:'}
            </span>

            {/* Karaoke Writing-System Selector: Native Script vs Roman Transliteration */}
            <div
              className="glass-pill"
              role="radiogroup"
              aria-label="Karaoke writing system selection"
              id="karaoke-script-selector"
              data-testid="karaoke-script-selector"
              style={{
                display: 'inline-flex',
                padding: '2px',
                gap: '2px',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(244, 240, 235, 0.1)'
              }}
            >
              <button
                type="button"
                id="karaoke-script-native"
                data-testid="karaoke-script-native"
                role="radio"
                aria-checked={karaokeScriptPreference === 'native'}
                data-selected={karaokeScriptPreference === 'native' ? 'true' : 'false'}
                className={karaokeScriptPreference === 'native' ? 'active' : ''}
                onClick={() => setKaraokeScriptPreference('native')}
                style={{
                  backgroundColor: karaokeScriptPreference === 'native' ? 'rgba(231, 165, 141, 0.28)' : 'transparent',
                  color: karaokeScriptPreference === 'native' ? 'var(--accent-cream)' : 'rgba(244, 240, 235, 0.55)',
                  border: karaokeScriptPreference === 'native' ? '1px solid rgba(231, 165, 141, 0.4)' : '1px solid transparent',
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: karaokeScriptPreference === 'native' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Native Script
              </button>
              <button
                type="button"
                id="karaoke-script-transliteration"
                data-testid="karaoke-script-transliteration"
                role="radio"
                aria-checked={karaokeScriptPreference === 'transliteration'}
                data-selected={karaokeScriptPreference === 'transliteration' ? 'true' : 'false'}
                className={karaokeScriptPreference === 'transliteration' ? 'active' : ''}
                onClick={() => setKaraokeScriptPreference('transliteration')}
                style={{
                  backgroundColor: karaokeScriptPreference === 'transliteration' ? 'rgba(231, 165, 141, 0.28)' : 'transparent',
                  color: karaokeScriptPreference === 'transliteration' ? 'var(--accent-cream)' : 'rgba(244, 240, 235, 0.55)',
                  border: karaokeScriptPreference === 'transliteration' ? '1px solid rgba(231, 165, 141, 0.4)' : '1px solid transparent',
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: karaokeScriptPreference === 'transliteration' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Roman Transliteration
              </button>
            </div>
          </div>

          {/* Synchronized Lyrics List, Plain Lyrics Reader, Loading, or Truthful Fallback */}
          {isLoadingLyrics && currentLines.length === 0 ? (
            <div
              data-testid="karaoke-lyrics-loading"
              style={{
                padding: '28px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(8, 11, 16, 0.85)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted)'
              }}
            >
              <Loader2 size={18} className="animate-spin" color="var(--accent-warm)" />
              <span style={{ fontSize: '0.9rem' }}>
                Fetching canonical lyrics for "{currentSong.title}"...
              </span>
            </div>
          ) : isSyncedLyrics ? (
            <div
              id="karaoke-lyrics-viewer"
              data-testid="karaoke-lyrics-viewer"
              ref={lyricsListRef}
              style={{
                maxHeight: 'min(230px, 34vh)',
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
              {lyricQueueIndices.map((idx) => {
                const line = currentLines[idx];
                const lineTime = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : (line.time || 0);
                const isSelected = idx === activeLyricIndex || (activeLyricIndex === -1 && selectedLineIndex === idx);
                const distance = idx - (activeLyricIndex >= 0 ? activeLyricIndex : (lyricQueueIndices[0] ?? 0) + 1);
                const karaokeLine = getKaraokeLyricLine(line, karaokeScriptPreference);

                return (
                  <div
                    key={idx}
                    id={`karaoke-lyric-${idx}`}
                    data-testid="karaoke-lyric-line"
                    data-lyric-index={idx}
                    data-active={isSelected ? 'true' : 'false'}
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
                      opacity: isSelected ? 1 : distance < 0 ? 0.48 : 0.74,
                      transform: isSelected ? 'scale(1.01)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        data-testid="karaoke-sung-text"
                        style={{
                          fontSize: '0.94rem',
                          color: isSelected ? 'var(--accent-cream)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 600 : 400
                        }}
                      >
                        {karaokeLine.text}
                      </span>
                      {karaokeScriptPreference === 'transliteration' && !karaokeLine.isAvailable && (
                        <span
                          data-testid="karaoke-transliteration-unavailable"
                          style={{
                            fontSize: '0.66rem',
                            color: '#F87171',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '4px',
                            padding: '1px 6px'
                          }}
                        >
                          Transliteration unavailable
                        </span>
                      )}
                    </div>

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
          ) : currentLines.length > 0 ? (
            /* Plain Untimed Lyrics Display */
            <div
              id="karaoke-plain-lyrics-viewer"
              data-testid="karaoke-plain-lyrics-viewer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div
                style={{
                  maxHeight: '170px',
                  overflowY: 'auto',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(8, 11, 16, 0.85)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--accent-warm)',
                      backgroundColor: 'rgba(231, 165, 141, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    UNTIMED PLAIN LYRICS
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                    Sing along with the words below
                  </span>
                </div>
                {currentLines.map((line, idx) => {
                  const karaokeLine = getKaraokeLyricLine(line, karaokeScriptPreference);
                  return (
                    <div
                      key={idx}
                      data-testid="karaoke-plain-lyric-line"
                      style={{
                        fontSize: '0.94rem',
                        color: 'var(--text-primary)',
                        padding: '4px 0',
                        lineHeight: 1.4
                      }}
                    >
                      {karaokeLine.text}
                    </div>
                  );
                })}
              </div>

              {/* Timeline start position selector */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(8, 11, 16, 0.7)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Set backing start position:
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cream)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(selectedSection.start)}
                  </span>
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
            </div>
          ) : (
            /* Truthful Unavailable Fallback with Retry */
            <div
              data-testid="karaoke-lyrics-unavailable"
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(8, 11, 16, 0.7)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
                  <AlertCircle size={15} color="#F59E0B" />
                  <span>
                    {lyricsError || 'Lyrics unavailable for this track — use timeline to choose your start position'}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="karaoke-retry-lyrics-btn"
                  onClick={handleRetryLyrics}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(231, 165, 141, 0.12)',
                    border: '1px solid rgba(231, 165, 141, 0.25)',
                    color: 'var(--accent-cream)',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={12} />
                  <span>Retry</span>
                </button>
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

          {/* Sung Lyric Preview Box */}
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
              Sung Lyrics for this moment ({karaokeScriptPreference === 'transliteration' ? 'Roman Transliteration' : 'Native Script'})
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
              &ldquo;{activeKaraoke ? activeKaraoke.text : (activeLine ? activeLine.text : currentSnippet)}&rdquo;
            </p>
            {karaokeScriptPreference === 'transliteration' && activeKaraoke && !activeKaraoke.isAvailable && (
              <div style={{ fontSize: '0.72rem', color: '#F87171', marginTop: '4px' }}>
                [Roman transliteration unavailable for this line — displaying native script]
              </div>
            )}
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
                backgroundColor: 'transparent',
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
          {!isKaraokeEligible || (backingStatus === 'unavailable' && vocalResolution.type === 'unavailable_protected') ? (
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
                <span>Karaoke unavailable for this track (no playable audio stream available).</span>
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
                data-action="start-karaoke"
                onClick={handleGo}
                aria-label="Start Karaoke Recording"
                title="Start Karaoke"
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
                <span>Start Karaoke</span>
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                {vocalResolution.type === 'verified_instrumental'
                  ? `Verified instrumental backing active • Lead vocal absent • Starts at ${formatTime(selectedSection.start)}. Record freely until you choose to stop.`
                  : vocalResolution.type === 'center_channel_reduction' && !karaokeMixer.isAudioRouteConnected()
                  ? `Vocal reduction unavailable: this playback source is not routed through Web Audio. Original vocals will remain. Starts at ${formatTime(selectedSection.start)}.`
                  : vocalResolution.type === 'center_channel_reduction'
                  ? `Experimental center-channel vocal reduction available • Vocal remnants and centered instruments may remain. Starts at ${formatTime(selectedSection.start)}.`
                  : isSingAlong
                  ? `Live microphone monitoring & synced lyrics active • Backing starts at ${formatTime(selectedSection.start)}. Record freely until you choose to stop.`
                  : `Karaoke starts at ${formatTime(selectedSection.start)}. Record freely until you choose to stop.`}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
