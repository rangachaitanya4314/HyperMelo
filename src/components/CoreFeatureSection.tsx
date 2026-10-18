import React, { useMemo, useState } from 'react';
import { Play, Pause, Repeat, Sparkles } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { WaveformTimeline } from './WaveformTimeline';
import { lyricsService } from '../services/lyrics/lyricsService';
import type { SectionType, VerifiedLyricRepresentation, Language } from '../types/music';

export const CoreFeatureSection: React.FC = () => {
  const {
    currentSong,
    selectedSection,
    setSelectedSection,
    setActiveLanguage,
    setDisplayLanguage,
    setKaraokeScriptPreference,
    setListeningMeaningLanguage,
    isPlaying,
    currentTime,
    togglePlay,
    seekTo,
    isLoopingSection,
    setIsLoopingSection,
    lyricsRevision
  } = useAudioPlayer();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePresetClick = (type: SectionType) => {
    const found = currentSong?.sections?.find((s) => s.type === type);
    if (found) {
      setSelectedSection(found);
      seekTo(found.start);
    }
  };

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const currentLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong, lyricsRevision]);

  // Verified available lyric representations for the selected song
  const availableRepresentations = useMemo(() => {
    return lyricsService.getAvailableLyricRepresentations(currentSong, currentLines);
  }, [currentSong, currentLines]);

  const [selectedRepId, setSelectedRepId] = useState<string>('original');

  // Derive active representation: if user selection exists in available options, use it; otherwise fallback to primary available representation
  const activeRep = useMemo(() => {
    if (availableRepresentations.length === 0) return null;
    const matched = availableRepresentations.find((r) => r.id === selectedRepId);
    return matched || availableRepresentations[0] || null;
  }, [availableRepresentations, selectedRepId]);

  // Find active line matching selectedSection or live currentTime during section playback
  const sectionStart = selectedSection?.start ?? 0;
  const sectionEnd = selectedSection?.end ?? (currentSong?.duration || 255);

  const activeLine = useMemo(() => {
    if (!currentLines || currentLines.length === 0) return null;

    // If actively playing within the selected moment, follow playback time
    if (isPlaying && currentTime >= sectionStart && currentTime <= sectionEnd) {
      const liveIdx = lyricsService.getActiveLyricIndex(currentLines, currentTime);
      if (liveIdx >= 0 && currentLines[liveIdx]) {
        const liveLine = currentLines[liveIdx];
        const lineStart = liveLine.startTime !== undefined && liveLine.startTime >= 0 ? liveLine.startTime : (liveLine.time ?? 0);
        if (lineStart >= sectionStart - 1 && lineStart <= sectionEnd + 1) {
          return liveLine;
        }
      }
    }

    // Static moment selection: find first line overlapping [sectionStart, sectionEnd]
    const inSection = currentLines.find((l) => {
      const lineStart = l.startTime !== undefined && l.startTime >= 0 ? l.startTime : (l.time ?? 0);
      const lineEnd = l.endTime !== undefined ? l.endTime : lineStart + (l.duration || 4.0);
      return lineEnd > sectionStart && lineStart < sectionEnd;
    });

    if (inSection) return inSection;

    // Fallback: nearest line to sectionStart
    let closest = currentLines[0];
    let minDiff = Infinity;
    for (const l of currentLines) {
      const t = l.startTime !== undefined && l.startTime >= 0 ? l.startTime : (l.time ?? 0);
      const diff = Math.abs(t - sectionStart);
      if (diff < minDiff) {
        minDiff = diff;
        closest = l;
      }
    }
    return closest;
  }, [currentLines, sectionStart, sectionEnd, isPlaying, currentTime]);

  const songOrigLang = activeLine?.original_language || currentSong?.originalLanguage || lyricsService.detectSongLanguage(currentSong);
  const excerptResult = lyricsService.getLyricRepresentationText(activeLine, activeRep, songOrigLang);

  const singingReps = availableRepresentations.filter((r) => r.isSinging);
  const meaningReps = availableRepresentations.filter((r) => !r.isSinging);
  const hasLyrics = availableRepresentations.length > 0 && activeLine !== null;

  const handleSelectRepresentation = (rep: VerifiedLyricRepresentation) => {
    setSelectedRepId(rep.id);
    if (rep.type === 'original') {
      setKaraokeScriptPreference('native');
      if (rep.langCode && ['en', 'hi', 'te', 'ta', 'ml'].includes(rep.langCode)) {
        setActiveLanguage(rep.langCode as Language);
        setDisplayLanguage(rep.langCode as Language);
      }
    } else if (rep.type === 'transliteration') {
      setKaraokeScriptPreference('transliteration');
    } else if (rep.type === 'translation') {
      const target = rep.langCode as Language;
      setListeningMeaningLanguage(target);
      setDisplayLanguage(target);
      setActiveLanguage(target);
    }
  };

  const handlePreviewLoop = () => {
    if (!isPlaying) {
      seekTo(selectedSection.start);
      setIsLoopingSection(true);
      togglePlay();
    } else {
      if (!isLoopingSection) {
        setIsLoopingSection(true);
        seekTo(selectedSection.start);
      } else {
        togglePlay();
      }
    }
  };

  return (
    <section
      id="karaoke"
      aria-label="Core Karaoke Feature"
      style={{
        padding: 'clamp(56px, 8vw, 112px) clamp(16px, 5vw, 64px)',
        backgroundColor: 'rgba(10, 14, 21, 0.75)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background soft glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '750px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(231, 165, 141, 0.08) 0%, rgba(143, 168, 200, 0.04) 50%, transparent 80%)',
          filter: 'blur(90px)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '36px'
        }}
      >
        {/* Section Heading */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: 'var(--accent-warm)',
                textTransform: 'uppercase'
              }}
            >
              YOUR VOICE, YOUR PART
            </span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(2.4rem, 4.4vw, 3.8rem)',
              lineHeight: 1.15,
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: '0 0 16px 0'
            }}
          >
            Don't sing the whole song.
            <br />
            <span className="serif-italic" style={{ color: 'var(--accent-cream)', fontWeight: 400 }}>
              Sing the moment.
            </span>
          </h2>

          <p
            style={{
              fontSize: 'clamp(1rem, 1.3vw, 1.15rem)',
              color: 'var(--text-muted)',
              maxWidth: '620px',
              lineHeight: 1.6,
              margin: 0
            }}
          >
            Select a verse, chorus, bridge, or any exact lyric range. NARO starts and stops with you.
          </p>
        </div>

        {/* Feature Interactive Box */}
        <div
          className="glass-panel"
          style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'clamp(20px, 4vw, 40px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            boxShadow: 'var(--shadow-floating)'
          }}
        >
          {/* Top Control Bar: Section Tabs & Time Range Indicator */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(244, 240, 235, 0.08)'
            }}
          >
            {/* Section Preset Tabs */}
            <div
              role="tablist"
              aria-label="Song sections"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              {['verse', 'chorus', 'bridge', 'custom'].map((secKey) => {
                const isSelected = selectedSection.type === secKey;
                const labelMap: Record<string, string> = {
                  verse: 'Verse',
                  chorus: 'Chorus',
                  bridge: 'Bridge',
                  custom: 'Custom'
                };
                return (
                  <button
                    key={secKey}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handlePresetClick(secKey as SectionType)}
                    style={{
                      background: isSelected ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.05)',
                      color: isSelected ? '#080B10' : 'var(--text-muted)',
                      border: isSelected ? '1px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {labelMap[secKey]}
                  </button>
                );
              })}
            </div>

            {/* Displayed Section Time Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'var(--accent-warm)',
                  textTransform: 'uppercase',
                  background: 'rgba(231, 165, 141, 0.12)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(231, 165, 141, 0.25)'
                }}
              >
                {selectedSection.label.toUpperCase()}
              </span>

              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {formatTime(selectedSection.start)} — {formatTime(selectedSection.end)}
              </span>
            </div>
          </div>

          {/* Large Waveform Timeline */}
          <div>
            <WaveformTimeline
              song={currentSong}
              section={selectedSection}
              onChangeSection={setSelectedSection}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={seekTo}
              height={110}
            />
          </div>

          {/* Lyric and Language Controls Area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'rgba(8, 11, 16, 0.65)',
              border: '1px solid rgba(244, 240, 235, 0.06)'
            }}
          >
            {/* Language & Representation Controls Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              {hasLyrics ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {/* Singing Section: Original native script & Roman transliteration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Sing:
                    </span>
                    <div
                      className="glass-pill"
                      role="radiogroup"
                      aria-label="Singing lyrics representation"
                      style={{ display: 'inline-flex', padding: '3px', gap: '3px', flexWrap: 'wrap' }}
                    >
                      {singingReps.map((rep) => {
                        const isSelected = activeRep?.id === rep.id;
                        return (
                          <button
                            key={rep.id}
                            id={`core-lyric-rep-${rep.id}`}
                            data-testid={`core-lyric-rep-${rep.id}`}
                            role="radio"
                            aria-checked={isSelected}
                            data-selected={isSelected ? 'true' : 'false'}
                            onClick={() => handleSelectRepresentation(rep)}
                            style={{
                              background: isSelected ? 'rgba(231, 165, 141, 0.28)' : 'transparent',
                              color: isSelected ? 'var(--accent-cream)' : 'var(--text-muted)',
                              border: isSelected ? '1px solid var(--border-warm)' : '1px solid transparent',
                              padding: '4px 12px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            title={rep.description}
                          >
                            {rep.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meaning Section: Only languages with actual verified translation data */}
                  {meaningReps.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Meaning:
                      </span>
                      <div
                        className="glass-pill"
                        role="radiogroup"
                        aria-label="Translated meaning selection"
                        style={{ display: 'inline-flex', padding: '3px', gap: '3px', flexWrap: 'wrap' }}
                      >
                        {meaningReps.map((rep) => {
                          const isSelected = activeRep?.id === rep.id;
                          return (
                            <button
                              key={rep.id}
                              id={`core-lyric-rep-${rep.id}`}
                              data-testid={`core-lyric-rep-${rep.id}`}
                              role="radio"
                              aria-checked={isSelected}
                              data-selected={isSelected ? 'true' : 'false'}
                              onClick={() => handleSelectRepresentation(rep)}
                              style={{
                                background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                                color: isSelected ? '#BAE6FD' : 'var(--text-muted)',
                                border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                                padding: '4px 12px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              title={rep.description}
                            >
                              {rep.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Lyrics:</span>
                  <span
                    id="core-karaoke-lyrics-unavailable-badge"
                    data-testid="core-karaoke-lyrics-unavailable"
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'rgba(244, 240, 235, 0.05)',
                      border: '1px solid rgba(244, 240, 235, 0.1)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    No verified lyrics available
                  </span>
                </div>
              )}

              {/* Loop Preview Button */}
              <button
                onClick={handlePreviewLoop}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isLoopingSection && isPlaying ? 'rgba(231, 165, 141, 0.15)' : 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: isLoopingSection && isPlaying ? 'var(--accent-warm)' : 'var(--text-muted)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <Repeat size={14} />
                <span>{isLoopingSection && isPlaying ? 'Looping Section' : 'Loop Preview'}</span>
              </button>
            </div>

            {/* Displayed Lyric Snippet */}
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <div style={{ marginBottom: '10px' }}>
                <span
                  id="core-karaoke-moment-badge"
                  data-testid="core-karaoke-moment-badge"
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '3px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: !excerptResult.isAvailable
                      ? 'rgba(239, 68, 68, 0.12)'
                      : activeRep?.isSinging
                        ? 'rgba(231, 165, 141, 0.14)'
                        : 'rgba(56, 189, 248, 0.14)',
                    color: !excerptResult.isAvailable
                      ? '#F87171'
                      : activeRep?.isSinging
                        ? 'var(--accent-warm)'
                        : '#38BDF8',
                    border: `1px solid ${
                      !excerptResult.isAvailable
                        ? 'rgba(239, 68, 68, 0.25)'
                        : activeRep?.isSinging
                          ? 'rgba(231, 165, 141, 0.28)'
                          : 'rgba(56, 189, 248, 0.28)'
                    }`
                  }}
                >
                  {excerptResult.categoryLabel}
                </span>
              </div>

              {/* Main highlighted lyric line */}
              <p
                id="core-karaoke-active-lyric"
                data-testid="core-karaoke-active-lyric"
                aria-label={excerptResult.accessibleLabel}
                className="serif-italic"
                style={{
                  fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)',
                  color: excerptResult.isAvailable ? 'var(--accent-cream)' : 'var(--text-muted)',
                  margin: '0 0 8px 0',
                  lineHeight: 1.3
                }}
              >
                {excerptResult.isAvailable ? `"${excerptResult.text}"` : excerptResult.text}
              </p>

              {/* Sub-line context */}
              {excerptResult.secondaryText && (
                <p
                  id="core-karaoke-subline-lyric"
                  data-testid="core-karaoke-subline-lyric"
                  style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-muted)',
                    margin: 0
                  }}
                >
                  {excerptResult.secondaryText}
                </p>
              )}
            </div>
          </div>

          {/* Action Row: Sing this part CTA */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--accent-warm)" />
              <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                {currentSong ? `${currentSong.title} — ${selectedSection?.label || 'Selected part'}` : 'Select a track to start interactive practice'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={togglePlay}
                className="btn-primary"
                aria-label={isPlaying ? 'Pause' : 'Play selected song'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Pause' : 'Play track'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
