import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Download,
  Check,
  Copy,
  Sparkles,
  Type,
  Activity,
  Heart,
  Mic,
  ShieldCheck,
  Clock,
  Film,
  Sliders
} from 'lucide-react';
import { InstagramIcon } from './InstagramIcon';
import type { Song, TimedLyricLine } from '../types/music';
import type { MomentTemplateId, ExportMomentResult, CustomTimelineSelection } from '../types/share';
import { CustomLyricTimeline } from './CustomLyricTimeline';
import {
  MOMENT_TEMPLATES,
  checkAudioRights,
  renderCanvasFrame,
  loadArtworkImage,
  exportMomentVideo,
  shareToNativeSheet,
  getSocialHandoff,
  formatMomentTime
} from '../services/share/shareMomentService';
import { lyricsService } from '../services/lyrics/lyricsService';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import './ShareMomentModal.css';

interface ShareMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  song?: Song | null;
}

export const ShareMomentModal: React.FC<ShareMomentModalProps> = ({
  isOpen,
  onClose,
  song
}) => {
  const { currentSong: contextSong } = useAudioPlayer();
  const targetSong = song || contextSong;

  // 1. Template State
  const [selectedTemplate, setSelectedTemplate] = useState<MomentTemplateId>('cinematic');

  // 2. Duration & Moment Timing
  const [durationSec, setDurationSec] = useState<number>(10);
  const [startSec, setStartSec] = useState<number>(0);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const startSecRef = useRef<number>(0);
  const durationSecRef = useRef<number>(10);

  // 3. Lyrics & Representation
  const canonicalLines = useMemo(() => {
    return targetSong ? lyricsService.getCanonicalLyricLines(targetSong) : [];
  }, [targetSong]);

  const representations = useMemo(() => {
    return targetSong ? lyricsService.getAvailableLyricRepresentations(targetSong, canonicalLines) : [];
  }, [targetSong, canonicalLines]);

  const [selectedRepId, setSelectedRepId] = useState<string>('original');

  const activeRep = useMemo(() => {
    return representations.find((r) => r.id === selectedRepId) || representations[0] || {
      id: 'original',
      type: 'original',
      langCode: 'en',
      label: 'Original Lyrics',
      shortLabel: 'Original',
      isSinging: true
    };
  }, [representations, selectedRepId]);

  // Audio Rights Status
  const rightsStatus = useMemo(() => checkAudioRights(targetSong), [targetSong]);

  // 4. Live Preview Canvas & Authoritative Audio Synchronization
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const [artImage, setArtImage] = useState<HTMLImageElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState<boolean>(false);
  const currentOffsetRef = useRef<number>(0);
  const fallbackStartTimeRef = useRef<number>(0);
  const previewAnimRef = useRef<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const initializedSongIdRef = useRef<string | null>(null);

  // Custom Timeline Modal State
  const [isCustomTimelineOpen, setIsCustomTimelineOpen] = useState<boolean>(false);

  // 5. Video Export & Share States
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportResult, setExportResult] = useState<ExportMomentResult | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preload artwork image
  useEffect(() => {
    if (!targetSong?.artwork?.imageUrl) {
      setArtImage(null);
      return;
    }
    let isCancelled = false;
    loadArtworkImage(targetSong.artwork.imageUrl).then((img) => {
      if (!isCancelled) setArtImage(img);
    });
    return () => {
      isCancelled = true;
    };
  }, [targetSong]);

  // Update time display directly without triggering full React component re-renders
  const updateTimeDisplay = useCallback((currentSec: number, totalDuration: number) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${formatMomentTime(currentSec)} / ${formatMomentTime(totalDuration)}`;
    }
  }, []);

  // Render static or dynamic canvas frame
  const drawPreview = useCallback(
    (currentSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !targetSong) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderCanvasFrame(ctx, {
        width: canvas.width,
        height: canvas.height,
        song: targetSong,
        template: selectedTemplate,
        representation: activeRep,
        lines: canonicalLines,
        startSec,
        durationSec,
        currentSec,
        artImg: artImage
      });
    },
    [targetSong, selectedTemplate, activeRep, canonicalLines, startSec, durationSec, artImage]
  );

  // Safely seek preview audio element with readyState guard
  const seekAudio = useCallback((audio: HTMLAudioElement, targetTime: number) => {
    if (audio.readyState >= 1) {
      try {
        audio.currentTime = targetTime;
      } catch (e) {
        console.warn('[ShareMoment] Seek failed:', e);
      }
    } else {
      const onLoadedMetadata = () => {
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        try {
          audio.currentTime = targetTime;
        } catch (e) {
          console.warn('[ShareMoment] Seek after loadedmetadata failed:', e);
        }
      };
      audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    }
  }, []);

  // Set initial moment start time to first lyrical line (only once per song)
  useEffect(() => {
    if (!isOpen || !targetSong) return;
    if (canonicalLines.length > 0 && initializedSongIdRef.current !== targetSong.id) {
      initializedSongIdRef.current = targetSong.id;
      const first = canonicalLines[0];
      const s = first.startTime ?? first.time ?? 0;
      startSecRef.current = s;
      setStartSec(s);
      setSelectedLineIdx(0);
      currentOffsetRef.current = 0;
      fallbackStartTimeRef.current = performance.now();
      drawPreview(s);
      updateTimeDisplay(s, s + durationSecRef.current);
    }
  }, [isOpen, targetSong?.id, canonicalLines, drawPreview, updateTimeDisplay]);

  // Autoplay preview when modal opens and audio source is available
  useEffect(() => {
    if (!isOpen || !targetSong) return;

    const curS = startSecRef.current;
    const curD = durationSecRef.current;
    const audio = audioPreviewRef.current;
    if (audio) {
      audio.playbackRate = 1.0;
      audio.preservesPitch = true;
      audio.muted = isPreviewMuted;
      seekAudio(audio, curS);
    }

    currentOffsetRef.current = 0;
    fallbackStartTimeRef.current = performance.now();

    // Start preview playback automatically if permitted
    setIsPlayingPreview(true);
    if (audio) {
      audio.play().catch((err) => {
        console.warn('[ShareMoment] Autoplay prevented by browser policy:', err);
      });
    }

    drawPreview(curS);
    updateTimeDisplay(curS, curS + curD);
  }, [isOpen, targetSong?.id, seekAudio]); // Re-runs strictly on modal open or song switch

  // Authoritative animation loop synchronized to audio.currentTime
  useEffect(() => {
    if (!isPlayingPreview) {
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
        previewAnimRef.current = null;
      }
      return;
    }

    const audio = audioPreviewRef.current;
    if (audio) {
      audio.playbackRate = 1.0;
      audio.preservesPitch = true;
      audio.muted = isPreviewMuted;
    }

    const loop = () => {
      const audioEl = audioPreviewRef.current;
      const curStart = startSecRef.current;
      const curDuration = durationSecRef.current;
      let currentSec: number;
      let offsetSec: number;

      if (audioEl && !audioEl.paused && !audioEl.ended && isFinite(audioEl.currentTime)) {
        // Authoritative audio timeline - exact 1x normal speed playback position
        currentSec = audioEl.currentTime;
        if (currentSec < curStart) {
          currentSec = curStart;
        }
        offsetSec = Math.max(0, currentSec - curStart);
      } else {
        // Fallback clock for silent tracks or while buffer loads
        offsetSec = Math.max(0, (performance.now() - fallbackStartTimeRef.current) / 1000);
        currentSec = curStart + offsetSec;
      }

      currentOffsetRef.current = offsetSec;

      if (offsetSec >= curDuration) {
        // Loop moment cleanly back to curStart without timing drift
        if (audioEl) {
          seekAudio(audioEl, curStart);
          audioEl.play().catch(() => {});
        }
        fallbackStartTimeRef.current = performance.now();
        currentOffsetRef.current = 0;
        currentSec = curStart;
        offsetSec = 0;
      }

      // Render frame synchronized to currentSec
      drawPreview(currentSec);

      // Update time display directly without React re-renders
      updateTimeDisplay(currentSec, curStart + curDuration);

      previewAnimRef.current = requestAnimationFrame(loop);
    };

    previewAnimRef.current = requestAnimationFrame(loop);

    return () => {
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
        previewAnimRef.current = null;
      }
    };
  }, [isPlayingPreview, durationSec, startSec, drawPreview, updateTimeDisplay, isPreviewMuted, seekAudio]);

  // Stop preview and cleanup on modal close or unmount
  useEffect(() => {
    return () => {
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
        previewAnimRef.current = null;
      }
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = '';
      }
    };
  }, []);

  // Stop preview on modal close and cleanly release all audio resources
  const handleClose = useCallback(() => {
    if (previewAnimRef.current) {
      cancelAnimationFrame(previewAnimRef.current);
      previewAnimRef.current = null;
    }
    setIsPlayingPreview(false);
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.src = '';
      audioPreviewRef.current.load();
    }
    currentOffsetRef.current = 0;
    initializedSongIdRef.current = null;
    setExportResult(null);
    setHandoffNotice(null);
    setErrorMsg(null);
    onClose();
  }, [onClose]);

  // Line selection handler
  const handleSelectLine = (line: TimedLyricLine, index: number) => {
    const s = line.startTime ?? line.time ?? 0;
    startSecRef.current = s;
    setStartSec(s);
    setSelectedLineIdx(index);
    currentOffsetRef.current = 0;
    fallbackStartTimeRef.current = performance.now();

    const audio = audioPreviewRef.current;
    if (audio) {
      audio.playbackRate = 1.0;
      audio.preservesPitch = true;
      seekAudio(audio, s);
      if (isPlayingPreview) {
        audio.play().catch(console.warn);
      }
    }
    drawPreview(s);
    updateTimeDisplay(s, s + durationSecRef.current);
  };

  // Toggle preview play/pause
  const handleTogglePlayPreview = () => {
    const audio = audioPreviewRef.current;
    if (isPlayingPreview) {
      if (audio) audio.pause();
      if (previewAnimRef.current) {
        cancelAnimationFrame(previewAnimRef.current);
        previewAnimRef.current = null;
      }
      setIsPlayingPreview(false);
      drawPreview(startSec + currentOffsetRef.current);
      updateTimeDisplay(startSec + currentOffsetRef.current, startSec + durationSec);
    } else {
      const curStart = startSecRef.current;
      const targetTime = curStart + currentOffsetRef.current;
      if (audio) {
        audio.playbackRate = 1.0;
        audio.preservesPitch = true;
        seekAudio(audio, targetTime);
        audio.play().catch((err) => console.warn('Audio play notice:', err));
      }
      fallbackStartTimeRef.current = performance.now() - currentOffsetRef.current * 1000;
      setIsPlayingPreview(true);
    }
  };

  // Toggle preview mute
  const handleToggleMute = () => {
    setIsPreviewMuted((prev) => {
      const next = !prev;
      if (audioPreviewRef.current) {
        audioPreviewRef.current.muted = next;
      }
      return next;
    });
  };

  // Duration selection handler
  const handleSelectDuration = (d: number) => {
    durationSecRef.current = d;
    setDurationSec(d);
    if (currentOffsetRef.current >= d) {
      currentOffsetRef.current = 0;
      fallbackStartTimeRef.current = performance.now();
      const audio = audioPreviewRef.current;
      if (audio) {
        seekAudio(audio, startSecRef.current);
      }
    }
    updateTimeDisplay(startSecRef.current + currentOffsetRef.current, startSecRef.current + d);
  };

  // Custom Timeline Selection handler
  const handleUseCustomTimeline = (selection: CustomTimelineSelection) => {
    const rawDur = selection.durationSec;
    const cleanDur = [5, 10, 15, 20, 30].find((p) => Math.abs(p - rawDur) < 0.25) ?? Math.max(1, Math.round(rawDur * 10) / 10);
    const targetStart = selection.startSec;

    startSecRef.current = targetStart;
    durationSecRef.current = cleanDur;
    setStartSec(targetStart);
    setDurationSec(cleanDur);
    currentOffsetRef.current = 0;
    fallbackStartTimeRef.current = performance.now();

    if (selection.selectedLineIndices.length > 0) {
      setSelectedLineIdx(selection.selectedLineIndices[0]);
    } else {
      const idx = canonicalLines.findIndex((l) => {
        const lineS = l.startTime ?? l.time ?? 0;
        return lineS >= targetStart - 0.5;
      });
      if (idx !== -1) setSelectedLineIdx(idx);
    }

    const audio = audioPreviewRef.current;
    if (audio) {
      audio.playbackRate = 1.0;
      audio.preservesPitch = true;
      audio.muted = isPreviewMuted;
      seekAudio(audio, targetStart);
      if (isPlayingPreview) {
        audio.play().catch(console.warn);
      }
    }

    setIsCustomTimelineOpen(false);
    drawPreview(targetStart);
    updateTimeDisplay(targetStart, targetStart + cleanDur);
  };

  // Window test hooks for Custom Lyric Timeline & Share Moment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      win.__naro_open_custom_timeline = () => setIsCustomTimelineOpen(true);
      win.__naro_close_custom_timeline = () => setIsCustomTimelineOpen(false);
      win.__naro_is_custom_timeline_open = () => isCustomTimelineOpen;
      win.__naro_get_share_moment_timing = () => ({
        startSec: startSecRef.current,
        durationSec: durationSecRef.current,
        isPlaying: isPlayingPreview
      });
    }
  }, [isCustomTimelineOpen, isPlayingPreview]);

  // Video Export Handler
  const handleExportVideo = async () => {
    if (!targetSong) return;

    // Pause live preview during export to prevent audio clash
    setIsPlayingPreview(false);
    if (audioPreviewRef.current) audioPreviewRef.current.pause();

    setIsExporting(true);
    setExportProgress(0);
    setErrorMsg(null);
    setHandoffNotice(null);

    try {
      const result = await exportMomentVideo({
        song: targetSong,
        template: selectedTemplate,
        representation: activeRep,
        lines: canonicalLines,
        startSec,
        durationSec,
        onProgress: (p) => setExportProgress(p),
        audioElement: audioPreviewRef.current
      });

      setExportResult(result);
    } catch (err: any) {
      console.error('[ShareMomentModal] Export failed:', err);
      setErrorMsg(err.message || 'Video export failed on this device. You can still save a moment snapshot!');
    } finally {
      setIsExporting(false);
    }
  };

  // Native Share Sheet Trigger
  const handleNativeShare = async () => {
    if (!exportResult || !targetSong) return;

    try {
      const file = new File([exportResult.blob], exportResult.filename, {
        type: exportResult.mimeType
      });

      const excerpt = canonicalLines[selectedLineIdx]?.text || targetSong.title;
      const shared = await shareToNativeSheet(file, targetSong, excerpt);
      if (shared) {
        setHandoffNotice('Shared successfully via your native share sheet!');
      }
    } catch (err: any) {
      console.warn('Native share error:', err);
      // Fall back to Save Video
      handleSaveVideo();
    }
  };

  // Save Video / Download Handler
  const handleSaveVideo = () => {
    if (!exportResult) return;
    const url = URL.createObjectURL(exportResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHandoffNotice(`✓ "${exportResult.filename}" saved to your device Downloads/Photos!`);
  };

  // Social Handoff Handler
  const handleSocialHandoff = (platform: 'instagram' | 'whatsapp' | 'snapchat') => {
    if (!targetSong) return;

    // Trigger save first so video is in device storage
    if (exportResult) {
      handleSaveVideo();
    }

    const { url, instructions } = getSocialHandoff(platform, targetSong);
    setHandoffNotice(instructions);

    // Attempt to open native application scheme
    window.location.href = url;
  };

  // Copy Moment Link
  const handleCopyMomentLink = () => {
    if (!targetSong) return;
    const shareText = `Check out "${targetSong.title}" (${formatMomentTime(startSec)}) on HyperMelo!`;
    navigator.clipboard?.writeText(shareText);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };

  // Keyboard accessibility: Escape to dismiss Share Moment modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, handleClose]);

  if (!isOpen || !targetSong) return null;

  return (
    <div
      id="share-moment-overlay"
      data-testid="share-moment-overlay"
      className="share-moment-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-moment-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) handleClose();
      }}
    >
      {/* Hidden audio element for preview and Web Audio capture */}
      <audio
        ref={audioPreviewRef}
        src={targetSong.playbackSource?.streamUrl || targetSong.karaokeSource?.streamUrl}
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />

      <div id="share-moment-modal" data-testid="share-moment-modal" className="share-moment-modal">
        {/* Header */}
        <header className="share-moment-header">
          <div>
            <h2
              id="share-moment-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#F4F0EB',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Film size={20} color="var(--accent-warm)" />
              <span>Share Moment</span>
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Vertical 9:16 Video with Synced Lyrics
            </p>
          </div>

          <button
            type="button"
            id="share-moment-close-btn"
            data-testid="share-moment-close-btn"
            onClick={handleClose}
            aria-label="Close Share Moment"
            className="share-moment-close-btn"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="share-moment-body">
          {/* Section 1: 9:16 Live Canvas Preview */}
          <div className="share-preview-wrapper">
            <div className="share-preview-container">
              <canvas
                ref={canvasRef}
                id="share-moment-canvas"
                data-testid="share-moment-canvas"
                width={720}
                height={1280}
                className="share-preview-canvas"
              />

              {/* Floating Preview Controls */}
              <div className="share-preview-controls">
                <button
                  type="button"
                  id="preview-play-pause-btn"
                  data-testid="preview-play-pause-btn"
                  onClick={handleTogglePlayPreview}
                  aria-label={isPlayingPreview ? 'Pause preview' : 'Play preview'}
                  className="share-preview-play-btn"
                  title={isPlayingPreview ? 'Pause' : 'Play'}
                >
                  {isPlayingPreview ? <Pause size={18} fill="#F4F0EB" /> : <Play size={18} fill="#F4F0EB" />}
                </button>

                <span
                  ref={timeDisplayRef}
                  id="preview-time-display"
                  data-testid="preview-time-display"
                  style={{ fontSize: '0.72rem', color: '#F4F0EB', fontFamily: 'monospace' }}
                >
                  {formatMomentTime(startSec + currentOffsetRef.current)} / {formatMomentTime(startSec + durationSec)}
                </span>

                <button
                  type="button"
                  id="preview-mute-btn"
                  data-testid="preview-mute-btn"
                  onClick={handleToggleMute}
                  aria-label={isPreviewMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                  className="share-preview-mute-btn"
                  title={isPreviewMuted ? 'Unmute' : 'Mute'}
                >
                  {isPreviewMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: 5 Template Switcher */}
          <div>
            <div className="share-section-title">
              <Sparkles size={14} color="var(--accent-warm)" />
              <span>Choose Template</span>
            </div>
            <div className="share-templates-row" role="tablist">
              {MOMENT_TEMPLATES.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    id={`template-tab-${tpl.id}`}
                    data-testid={`template-tab-${tpl.id}`}
                    role="tab"
                    aria-selected={isSelected}
                    className={`share-template-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    title={tpl.description}
                  >
                    {tpl.id === 'cinematic' && <Film size={14} />}
                    {tpl.id === 'minimal' && <Type size={14} />}
                    {tpl.id === 'visualizer' && <Activity size={14} />}
                    {tpl.id === 'mood' && <Heart size={14} />}
                    {tpl.id === 'karaoke' && <Mic size={14} />}
                    <span>{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Verified Language & Representation Selector */}
          <div>
            <div className="share-section-title">
              <Type size={14} color="var(--accent-warm)" />
              <span>Lyric Language & Representation</span>
            </div>
            <div className="share-languages-row">
              {representations.map((rep) => {
                const isSelected = activeRep.id === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    id={`share-lang-${rep.id}`}
                    data-testid={`share-lang-${rep.id}`}
                    className={`share-lang-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedRepId(rep.id)}
                    title={rep.description}
                  >
                    <span>{rep.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Moment Lyric Line Chooser & Mobile Custom Timeline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div className="share-section-title" style={{ margin: 0 }}>
                <Clock size={14} color="var(--accent-warm)" />
                <span>Select Lyric Moment</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                  {formatMomentTime(startSec)} - {formatMomentTime(startSec + durationSec)} ({durationSec}s)
                </span>
                <button
                  type="button"
                  id="open-custom-timeline-btn"
                  data-testid="open-custom-timeline-btn"
                  className="share-custom-timeline-btn"
                  onClick={() => setIsCustomTimelineOpen(true)}
                  aria-label="Open Custom Lyric Timeline"
                  title="Adjust Start and End Times with Full Timeline"
                >
                  <Sliders size={13} />
                  <span>Custom Timeline</span>
                </button>
              </div>
            </div>

            {/* Duration Presets (5s, 10s, 15s, 20s, 30s) — Fits without page overflow */}
            <div className="share-duration-row" style={{ marginBottom: '10px' }}>
              {[5, 10, 15, 20, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  id={`duration-pill-${d}`}
                  data-testid={`duration-pill-${d}`}
                  className={`share-duration-pill ${Math.abs(durationSec - d) < 0.25 ? 'active' : ''}`}
                  onClick={() => handleSelectDuration(d)}
                >
                  {d}s
                </button>
              ))}
            </div>

            {/* Lyric Lines Scroll List */}
            <div className="share-lines-scroller" role="listbox">
              {canonicalLines.length === 0 ? (
                <div className="share-line-empty-state" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
                  <span>No synchronized lyric lines for this track. Share Moment will feature the track title and artist.</span>
                </div>
              ) : (
                canonicalLines.map((line, idx) => {
                  const s = line.startTime ?? line.time ?? 0;
                  const isSelected = selectedLineIdx === idx;
                  return (
                    <button
                      key={line.id || idx}
                      type="button"
                      id={`share-moment-line-${idx}`}
                      data-testid={`share-moment-line-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`share-line-item share-lyric-item ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectLine(line, idx)}
                    >
                      <span className="share-line-timestamp">{formatMomentTime(s)}</span>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {line.text}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 5: Audio Rights & Permitted Export Notice (Rendered only for permitted audio exports) */}
          {rightsStatus.canExportAudio && (
            <div className="share-rights-box">
              <div
                id="audio-rights-badge"
                data-testid="audio-rights-badge"
                className="share-rights-badge permitted"
              >
                <ShieldCheck size={14} />
                <span>AUDIO EXPORT PERMITTED (Audio Included)</span>
              </div>
              {rightsStatus.licenseLabel && (
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  License: {rightsStatus.licenseLabel}
                </div>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#F87171',
                fontSize: '0.82rem'
              }}
            >
              {errorMsg}
            </div>
          )}

          {handoffNotice && (
            <div
              id="share-handoff-notice"
              data-testid="share-handoff-notice"
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#7DD3FC',
                fontSize: '0.82rem',
                lineHeight: 1.45
              }}
            >
              {handoffNotice}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="share-moment-footer">
          {/* Export in progress */}
          {isExporting ? (
            <div className="share-export-progress-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#F4F0EB' }}>
                <span>Rendering 9:16 Video Moment...</span>
                <span id="export-progress-percent" data-testid="export-progress-percent">{exportProgress}%</span>
              </div>
              <div className="share-progress-track">
                <div
                  id="export-progress-bar"
                  data-testid="export-progress-bar"
                  className="share-progress-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          ) : !exportResult ? (
            /* Primary Export Trigger */
            <button
              type="button"
              id="export-moment-btn"
              data-testid="export-moment-btn"
              className="share-primary-btn"
              onClick={handleExportVideo}
            >
              <Film size={18} />
              <span>Export 9:16 Video ({durationSec}s)</span>
            </button>
          ) : (
            /* Ready to Share Actions */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  id="share-native-btn"
                  data-testid="share-native-btn"
                  className="share-primary-btn"
                  style={{ flex: 2 }}
                  onClick={handleNativeShare}
                >
                  <Share2 size={18} />
                  <span>Share Video</span>
                </button>

                <button
                  type="button"
                  id="save-video-btn"
                  data-testid="save-video-btn"
                  className="share-primary-btn"
                  style={{
                    flex: 1,
                    background: 'rgba(244, 240, 235, 0.12)',
                    color: '#F4F0EB',
                    boxShadow: 'none'
                  }}
                  onClick={handleSaveVideo}
                  title="Save Video to device"
                >
                  <Download size={18} />
                  <span>Save</span>
                </button>
              </div>

              {/* Supported Social Handoffs */}
              <div className="share-handoff-grid">
                <button
                  type="button"
                  id="handoff-instagram"
                  data-testid="handoff-instagram"
                  className="share-handoff-btn"
                  onClick={() => handleSocialHandoff('instagram')}
                >
                  <InstagramIcon size={18} color="#FB7185" />
                  <span>Instagram</span>
                </button>

                <button
                  type="button"
                  id="handoff-whatsapp"
                  data-testid="handoff-whatsapp"
                  className="share-handoff-btn"
                  onClick={() => handleSocialHandoff('whatsapp')}
                >
                  <span style={{ fontSize: '1.1rem' }}>💬</span>
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  id="handoff-snapchat"
                  data-testid="handoff-snapchat"
                  className="share-handoff-btn"
                  onClick={() => handleSocialHandoff('snapchat')}
                >
                  <span style={{ fontSize: '1.1rem' }}>👻</span>
                  <span>Snapchat</span>
                </button>
              </div>

              {/* Copy Moment Link */}
              <button
                type="button"
                id="copy-moment-link-btn"
                data-testid="copy-moment-link-btn"
                onClick={handleCopyMomentLink}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 0'
                }}
              >
                {copiedLink ? <Check size={14} color="#34D399" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Moment link copied!' : 'Copy song & moment link'}</span>
              </button>
            </div>
          )}
        </footer>
      </div>

      {/* Mobile-First Custom Lyric Timeline Modal */}
      <CustomLyricTimeline
        isOpen={isCustomTimelineOpen}
        song={targetSong}
        canonicalLines={canonicalLines}
        initialStartSec={startSec}
        initialDurationSec={durationSec}
        onClose={() => setIsCustomTimelineOpen(false)}
        onUseSelection={handleUseCustomTimeline}
        audioElement={audioPreviewRef.current}
      />
    </div>
  );
};
