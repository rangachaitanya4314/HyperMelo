import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, AlertCircle, X, Volume2 } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { recordingEngine } from '../services/recording/recordingEngine';
import { karaokePlaybackService } from '../services/audio/karaokePlaybackService';
import { karaokeMixer } from '../services/audio/karaokeMixer';
import { lyricsService } from '../services/lyrics/lyricsService';
import type { RecordedTake } from '../types/music';

export const KaraokeRecordingState: React.FC = () => {
  const {
    isRecordingActive,
    currentSong,
    selectedSection,
    activeLanguage,
    currentTime,
    seekTo,
    finishTake,
    stopKaraokeRecording,
    saveTakeToLibrary
  } = useAudioPlayer();

  const [countdown, setCountdown] = useState<number>(3);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [bgmVol, setBgmVol] = useState<number>(() => karaokeMixer.getBgmVolume());
  const [voiceVol, setVoiceVol] = useState<number>(() => karaokeMixer.getVoiceVolume());

  const micIntervalRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const countdownTimerRef = useRef<number | null>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBgmChange = (val: number) => {
    setBgmVol(val);
    karaokeMixer.setBgmVolume(val);
  };

  const handleVoiceChange = (val: number) => {
    setVoiceVol(val);
    karaokeMixer.setVoiceVolume(val);
  };

  const handleStop = useCallback(async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }

    karaokePlaybackService.stop();
    const result = await recordingEngine.stopRecording();

    if (!result.success || !result.audioBlob || result.audioBlob.size === 0) {
      // Stopped during countdown or cancelled before mic audio captured
      stopKaraokeRecording();
      return;
    }

    // Build genuine RecordedTake without fabricated numbers
    const take: RecordedTake = {
      id: `take-${Date.now()}`,
      songId: currentSong.id,
      songTitle: currentSong.title,
      artist: currentSong.artist,
      section: selectedSection.type,
      sectionLabel: selectedSection.label,
      language: activeLanguage,
      recordedAt: Date.now(),
      duration: Math.round(result.duration * 10) / 10,
      audioBlob: result.audioBlob,
      audioBlobUrl: result.audioBlobUrl,
      artwork: currentSong.artwork,
      isRealRecording: true,
      analysisStatus: 'unavailable' // Honest: no fabricated scoring!
    };

    // Save directly to IndexedDB
    try {
      await saveTakeToLibrary(take);
    } catch (err) {
      console.warn('Failed to save take to IndexedDB:', err);
    }

    finishTake(take);
  }, [currentSong, selectedSection, activeLanguage, finishTake, saveTakeToLibrary, stopKaraokeRecording]);

  const handleCancel = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
    karaokePlaybackService.stop();
    recordingEngine.cancelRecording();
    stopKaraokeRecording();
  };

  // 3 -> 2 -> 1 -> GO countdown sequence
  useEffect(() => {
    if (!isRecordingActive) return;

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0; // 0 indicates recording GO
        }
        return prev - 1;
      });
    }, 900);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(3);
      setIsRecording(false);
      setMicError(null);
      setElapsedSec(0);
    };
  }, [isRecordingActive]);

  // When countdown hits 0 (GO), engage genuine microphone recording & backing playback
  useEffect(() => {
    if (!isRecordingActive || countdown !== 0) return;

    let isMounted = true;

    // Verify backing availability - NEVER play normal vocal audio as backing track!
    if (!karaokePlaybackService.isAvailableForSong(currentSong)) {
      setTimeout(() => {
        if (isMounted) {
          setMicError('Karaoke unavailable: No authorized instrumental backing track exists for this song.');
          setIsRecording(false);
        }
      }, 0);
      return;
    }

    // Start real backing playback at section start
    karaokePlaybackService.playFrom(selectedSection.start).catch((err) => {
      console.warn('Failed to start backing playback for karaoke:', err);
    });

    // Start real microphone recording
    recordingEngine.startRecording().then((res) => {
      if (!isMounted) return;
      if (!res.success) {
        setMicError(res.errorMessage || 'Microphone permission is required to record your moment.');
        setIsRecording(false);
        karaokePlaybackService.pause();
        return;
      }

      setIsRecording(true);
      recordStartRef.current = Date.now();

      // Sample real microphone volume for metering
      micIntervalRef.current = window.setInterval(() => {
        const lvl = recordingEngine.getMicLevel();
        setMicLevel(lvl);
        setElapsedSec((Date.now() - recordStartRef.current) / 1000);
      }, 60);
    });

    return () => {
      isMounted = false;
      if (micIntervalRef.current) {
        clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
    };
  }, [countdown, isRecordingActive, currentSong, selectedSection.start]);

  // Auto-stop ONLY when song playback genuinely reaches the end of the full track (or user manually stops)
  useEffect(() => {
    const maxDuration = currentSong.duration > 0 ? currentSong.duration : 255;
    if (isRecordingActive && isRecording && elapsedSec > 1 && currentTime >= maxDuration) {
      handleStop();
    }
  }, [isRecordingActive, isRecording, elapsedSec, currentTime, currentSong.duration, handleStop]);

  // Never render dialog overlay on home page when inactive
  if (!isRecordingActive) {
    return null;
  }

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const currentLines = lyricsService.getCanonicalLyricLines(currentSong);

  // Active line derived from ACTUAL playback clock with calibrated offset
  const { index: currentLineIndex, line: activeLine } = lyricsService.getActiveLine(
    currentLines,
    currentTime,
    currentSong.lyricsOffsetMs || 0
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Karaoke Recording Session"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.96)',
        backdropFilter: 'blur(30px)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(20px, 4vw, 48px)'
      }}
    >
      {/* Top Bar: Section Badge, Time Remaining, Cancel Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#F87171',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.08em'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                animation: 'pulseDot 1s infinite alternate'
              }}
            />
            <span>REC</span>
            <span style={{ color: 'rgba(244, 240, 235, 0.3)', margin: '0 2px' }}>|</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#FFFFFF', fontWeight: 600 }}>
              {formatTime(elapsedSec)}
            </span>
          </div>

          <span style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
            {currentSong.title} • Starting at {formatTime(selectedSection.start)} (Unlimited Take)
          </span>
        </div>

        <button
          onClick={handleCancel}
          aria-label="Cancel recording"
          className="btn-icon"
          style={{ width: '40px', height: '40px' }}
          title="Cancel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Center Display: Countdown OR Microphone Error OR Synchronized Lyrics */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
          padding: '20px'
        }}
      >
        {micError ? (
          <div
            style={{
              padding: '32px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              maxWidth: '520px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <AlertCircle size={44} color="#EF4444" />
            <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem' }}>
              Microphone Notice
            </h3>
            <p style={{ color: '#FCA5A5', margin: 0, lineHeight: 1.5, fontSize: '0.94rem' }}>
              {micError}
            </p>
            <button
              onClick={handleCancel}
              className="btn-primary"
              style={{ marginTop: '8px' }}
            >
              Close
            </button>
          </div>
        ) : countdown > 0 ? (
          /* Get Ready State */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: 'var(--accent-warm)',
                textTransform: 'uppercase'
              }}
            >
              SING THE MOMENT
            </span>

            <span
              style={{
                fontSize: 'clamp(5.5rem, 15vw, 9.5rem)',
                fontWeight: 800,
                color: 'var(--accent-warm)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 50px rgba(231, 165, 141, 0.5)',
                animation: 'countdownScale 0.9s cubic-bezier(0.16, 1, 0.3, 1) infinite'
              }}
            >
              {countdown}
            </span>

            <div
              style={{
                marginTop: '10px',
                padding: '8px 24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(244, 240, 235, 0.06)',
                border: '1px solid var(--border-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ color: 'var(--accent-cream)', fontWeight: 600, fontSize: '1rem' }}>
                {selectedSection.label}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                From {formatTime(selectedSection.start)} • Unlimited Recording
              </span>
            </div>

            <span style={{ fontSize: '0.84rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Backing starts at {formatTime(selectedSection.start)} — Record freely and stop whenever you want
            </span>
          </div>
        ) : (
          /* Live Recording State */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', width: '100%' }}>
            {/* Real Synchronized Lyric Line or Truthful Unavailable Notice */}
            {activeLine ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p
                  className="serif-italic"
                  onClick={() => {
                    const start = activeLine.startTime !== undefined && activeLine.startTime >= 0 ? activeLine.startTime : activeLine.time;
                    if (start !== undefined && start >= 0) seekTo(start);
                  }}
                  role="button"
                  tabIndex={0}
                  title="Click to seek backing to this line"
                  style={{
                    fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
                    fontWeight: 600,
                    color: 'var(--accent-cream)',
                    margin: 0,
                    lineHeight: 1.25,
                    textShadow: '0 0 40px rgba(244, 223, 201, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  {activeLine.words && activeLine.words.length > 0 ? (
                    activeLine.words.map((w, wIdx) => {
                      const isWordActive = currentTime >= w.start && currentTime <= w.end;
                      return (
                        <span
                          key={wIdx}
                          style={{
                            color: isWordActive ? 'var(--accent-warm)' : 'var(--text-primary)',
                            transition: 'color 0.15s ease',
                            marginRight: '8px'
                          }}
                        >
                          {w.text}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ color: 'var(--accent-warm)' }}>
                      {lyricsService.getLineTranslation(activeLine, activeLanguage).text}
                    </span>
                  )}
                </p>

                {/* Next preview line */}
                {currentLineIndex !== -1 && currentLines[currentLineIndex + 1] && (
                  <p
                    onClick={() => {
                      const nextL = currentLines[currentLineIndex + 1];
                      const start = nextL?.startTime !== undefined && nextL.startTime >= 0 ? nextL.startTime : nextL?.time;
                      if (start !== undefined && start >= 0) seekTo(start);
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to seek backing to next line"
                    style={{
                      fontSize: 'clamp(1rem, 1.6vw, 1.3rem)',
                      color: 'var(--text-muted)',
                      margin: 0,
                      opacity: 0.6,
                      cursor: 'pointer'
                    }}
                  >
                    {lyricsService.getLineTranslation(currentLines[currentLineIndex + 1], activeLanguage).text}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Lyrics unavailable
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                  ♪ Backing music playing — sing your moment freely
                </span>
              </div>
            )}

            {/* Live Studio Mixer: Music & My Voice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                padding: '12px 24px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}
            >
              {/* Music Backing Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Volume2 size={16} color="var(--accent-warm)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '50px' }}>
                  Music
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVol}
                  onChange={(e) => handleBgmChange(parseFloat(e.target.value))}
                  aria-label="Backing music volume"
                  style={{ width: '90px', accentColor: 'var(--accent-warm)', cursor: 'pointer', height: '4px' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', minWidth: '32px', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(bgmVol * 100)}%
                </span>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(244, 240, 235, 0.1)' }} />

              {/* My Voice Microphone Control & Meter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mic size={16} color="var(--accent-cream)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '65px' }}>
                  My Voice
                </span>
                <div
                  style={{
                    width: '100px',
                    height: '6px',
                    backgroundColor: 'rgba(244, 240, 235, 0.15)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}
                  title="Live microphone input meter"
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(5, micLevel * 100))}%`,
                      height: '100%',
                      backgroundColor: micLevel > 0.7 ? '#EF4444' : 'var(--accent-warm)',
                      borderRadius: '3px',
                      transition: 'width 0.05s ease'
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={voiceVol}
                  onChange={(e) => handleVoiceChange(parseFloat(e.target.value))}
                  aria-label="Microphone volume"
                  style={{ width: '80px', accentColor: 'var(--accent-cream)', cursor: 'pointer', height: '4px' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', minWidth: '32px', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(voiceVol * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Action to STOP & Save Take - ALWAYS RESPONSIVE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          gap: '20px'
        }}
      >
        <button
          id="karaoke-stop-recording-btn"
          data-testid="karaoke-stop-recording-btn"
          onClick={handleStop}
          aria-label="Stop recording and review moment"
          disabled={countdown > 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: countdown > 0 ? '#4B5563' : '#EF4444',
            opacity: countdown > 0 ? 0.6 : 1,
            cursor: countdown > 0 ? 'not-allowed' : 'pointer',
            color: '#FFFFFF',
            border: 'none',
            padding: '14px 40px',
            borderRadius: 'var(--radius-full)',
            fontSize: '1.05rem',
            fontWeight: 700,
            boxShadow: countdown > 0 ? 'none' : '0 4px 25px rgba(239, 68, 68, 0.45)',
            transition: 'all 0.2s ease'
          }}
        >
          <Square size={18} fill="#FFFFFF" />
          <span>{countdown > 0 ? `Get Ready (${countdown})...` : 'Stop & Finish Moment'}</span>
        </button>
      </div>

      <style>{`
        @keyframes pulseDot {
          from { opacity: 0.4; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.1); }
        }
        @keyframes countdownScale {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
};
