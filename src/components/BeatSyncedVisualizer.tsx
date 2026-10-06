import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import type { ArtworkStyle } from '../types/music';
import { playbackService } from '../services/audio/playbackService';

interface BeatSyncedVisualizerProps {
  artwork?: ArtworkStyle;
  isPlaying: boolean;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onTogglePlay?: () => void;
  interactive?: boolean;
  mode?: 'hero' | 'fullscreen' | 'compact';
  songTitle?: string;
  songArtist?: string;
}

interface OrbitalParticle {
  angle: number;
  baseRadiusRatio: number;
  speed: number;
  size: number;
  opacity: number;
  drift: number;
  pulsePhase: number;
}

interface TransientShockwave {
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
}

export const BeatSyncedVisualizer: React.FC<BeatSyncedVisualizerProps> = ({
  artwork,
  isPlaying,
  size = '100%',
  className = '',
  style = {},
  onTogglePlay,
  interactive = true,
  mode = 'hero',
  songTitle = 'NARO',
  songArtist = 'Music Experience'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const centerDiscRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Safe fallback artwork palette
  const safeArtwork: ArtworkStyle = artwork || {
    palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
    pattern: 'solaris',
    accentWarm: '#E7A58D',
    accentCool: '#8FA8C8',
    accentCream: '#F4DFC9'
  };

  const primaryColor = safeArtwork.accentWarm || safeArtwork.palette?.[0] || '#E7A58D';
  const secondaryColor = safeArtwork.accentCool || safeArtwork.palette?.[3] || '#8FA8C8';
  const creamColor = safeArtwork.accentCream || '#F4DFC9';

  // Animation and physics state held in ref (Zero React state updates per frame)
  const energyRef = useRef({
    bass: 0,
    mids: 0,
    highs: 0,
    overall: 0,
    kickImpulse: 0,
    prevBass: 0,
    rotation: 0,
    settleProgress: 1.0,
    smoothedBars: new Float32Array(64),
    shockwaves: [] as TransientShockwave[]
  });

  // Track changes: smoothly reset transient impulse when song changes
  useEffect(() => {
    energyRef.current.kickImpulse = 0;
    energyRef.current.shockwaves = [];
  }, [songTitle, songArtist]);

  // Pre-seed orbital particles
  const particlesRef = useRef<OrbitalParticle[]>([]);
  useEffect(() => {
    const count = mode === 'fullscreen' ? 32 : 24;
    const arr: OrbitalParticle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        angle: (i / count) * Math.PI * 2,
        baseRadiusRatio: 0.94 + (i % 6) * 0.035,
        speed: 0.0025 + (i % 4) * 0.0015,
        size: 1.2 + (i % 3) * 0.9,
        opacity: 0.2 + (i % 4) * 0.15,
        drift: (i % 2 === 0 ? 1 : -1) * 0.001,
        pulsePhase: (i / count) * Math.PI * 2
      });
    }
    particlesRef.current = arr;
  }, [mode]);

  // High-DPI Canvas resize observer
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      const width = Math.max(140, Math.floor(rect.width || 380));
      const height = Math.max(140, Math.floor(rect.height || 380));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
    };
  }, []);

  // Main real-time audio-reactive rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const NUM_BARS = 64;

    const render = () => {
      const state = energyRef.current;

      // 1. Fetch real frequency spectrum from Web Audio API AnalyserNode
      const freqData = playbackService.getVisualizerData();
      let rawBass = 0;
      let rawMids = 0;
      let rawHighs = 0;

      if (freqData && freqData.length > 0 && isPlaying) {
        const binCount = freqData.length;

        // Bass frequency range: approx 20Hz - 250Hz (first ~12% of bins)
        const bassEnd = Math.max(2, Math.floor(binCount * 0.12));
        let bassSum = 0;
        for (let i = 0; i < bassEnd; i++) {
          bassSum += freqData[i];
        }
        rawBass = bassSum / (bassEnd * 255);

        // Mids frequency range: approx 250Hz - 2500Hz (next ~38% of bins)
        const midEnd = Math.max(bassEnd + 2, Math.floor(binCount * 0.50));
        let midSum = 0;
        for (let i = bassEnd; i < midEnd; i++) {
          midSum += freqData[i];
        }
        rawMids = midSum / ((midEnd - bassEnd) * 255);

        // Highs frequency range: approx 2500Hz - 16000Hz+ (remaining bins)
        let highSum = 0;
        const highCount = Math.max(1, binCount - midEnd);
        for (let i = midEnd; i < binCount; i++) {
          highSum += freqData[i];
        }
        rawHighs = highSum / (highCount * 255);

        // Beat transient / kick impulse detection
        const bassDelta = rawBass - state.prevBass;
        if (bassDelta > 0.11) {
          state.kickImpulse = Math.min(1.0, state.kickImpulse + bassDelta * 1.8);
          // Spawn transient radial shockwave
          state.shockwaves.push({
            radius: 0,
            maxRadius: 0,
            opacity: 0.55,
            speed: 2.2
          });
          if (state.shockwaves.length > 3) {
            state.shockwaves.shift();
          }
        }
        state.prevBass = rawBass;
      } else {
        // Paused or silent: naturally settle towards 0
        rawBass = 0;
        rawMids = 0;
        rawHighs = 0;
        state.prevBass = 0;
      }

      // Smooth attack and release interpolation (fast punch attack, silky release)
      const bassFactor = rawBass > state.bass ? 0.32 : 0.10;
      const midsFactor = rawMids > state.mids ? 0.28 : 0.12;
      const highsFactor = rawHighs > state.highs ? 0.35 : 0.14;

      state.bass += (rawBass - state.bass) * bassFactor;
      state.mids += (rawMids - state.mids) * midsFactor;
      state.highs += (rawHighs - state.highs) * highsFactor;
      state.overall = state.bass * 0.5 + state.mids * 0.35 + state.highs * 0.15;

      // Exponential decay of kick impulse
      state.kickImpulse *= 0.88;

      // Settle progress: 0 when playing, decays toward 1 when paused
      if (isPlaying) {
        state.settleProgress = Math.max(0, state.settleProgress - 0.06);
      } else {
        state.settleProgress = Math.min(1.0, state.settleProgress + 0.035);
      }

      // Orbital rotation progression
      if (!prefersReducedMotion) {
        const rotSpeed = isPlaying
          ? 0.0016 + state.mids * 0.0035 + state.kickImpulse * 0.002
          : 0.0004 * (1 - state.settleProgress);
        state.rotation = (state.rotation + rotSpeed) % (Math.PI * 2);
      }

      // 2. Physical Central Disc Breathing (CSS transform direct update)
      if (centerDiscRef.current) {
        const discScale = prefersReducedMotion
          ? 1.0
          : 1.0 + (state.bass * 0.048 + state.kickImpulse * 0.036) * (1 - state.settleProgress);
        centerDiscRef.current.style.transform = `translate(-50%, -50%) scale(${discScale.toFixed(4)})`;
      }

      // 3. Canvas Rendering Dimensions & Adequate Padding (Avoid unintentional cropping)
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      const centerX = logicalWidth / 2;
      const centerY = logicalHeight / 2;
      const minDimension = Math.min(logicalWidth, logicalHeight);

      // Safe radii leaving outer breathing room for glow, particles, and maximum bar excursion
      const maxVisualizerRadius = minDimension * 0.44;
      const coreRadius = maxVisualizerRadius * 0.56;
      const spectrumBaseRadius = coreRadius + 6;
      const maxBarLength = maxVisualizerRadius * 0.32;

      // Amplitude-dependent expansions
      const bassExpand = prefersReducedMotion ? 0 : (state.bass * 14 + state.kickImpulse * 12) * (1 - state.settleProgress);
      const midExpand = prefersReducedMotion ? 0 : state.mids * 8 * (1 - state.settleProgress);

      // LAYER 1: Cinematic Ambient Aura & Glow
      const glowRadius = maxVisualizerRadius * 1.15 + bassExpand * 1.4;
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        coreRadius * 0.6,
        centerX,
        centerY,
        glowRadius
      );

      const baseGlowAlpha = isPlaying
        ? Math.min(0.42, 0.14 + state.overall * 0.32 + state.kickImpulse * 0.18)
        : 0.06 * (1 - state.settleProgress) + 0.02;

      glowGrad.addColorStop(0, hexToRgba(primaryColor, baseGlowAlpha * 0.9));
      glowGrad.addColorStop(0.5, hexToRgba(secondaryColor, baseGlowAlpha * 0.4));
      glowGrad.addColorStop(1, 'rgba(8, 11, 16, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();

      // LAYER 2: Transient Beat Shockwaves (Expanding Radial Pulses)
      if (!prefersReducedMotion && state.shockwaves.length > 0) {
        ctx.save();
        for (let i = state.shockwaves.length - 1; i >= 0; i--) {
          const sw = state.shockwaves[i];
          if (sw.radius === 0) {
            sw.radius = spectrumBaseRadius;
            sw.maxRadius = maxVisualizerRadius * 1.06;
          }
          sw.radius += sw.speed;
          sw.opacity *= 0.91;

          if (sw.opacity > 0.03 && sw.radius < sw.maxRadius) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = hexToRgba(creamColor, sw.opacity * (1 - state.settleProgress));
            ctx.lineWidth = 1.2;
            ctx.stroke();
          } else {
            state.shockwaves.splice(i, 1);
          }
        }
        ctx.restore();
      }

      // LAYER 3: Concentric Aesthetic Reference Rings
      // 3A: Inner breathing guide ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius + 2 + bassExpand * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(primaryColor, isPlaying ? 0.28 + state.bass * 0.35 : 0.12);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // 3B: Spectrum base reference ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, spectrumBaseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(244, 240, 235, 0.08)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();

      // 3C: Outer delicate dashed orbital ring
      if (!prefersReducedMotion) {
        ctx.save();
        const outerOrbitRadius = spectrumBaseRadius + maxBarLength * 0.85 + midExpand;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerOrbitRadius, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(secondaryColor, isPlaying ? 0.15 + state.highs * 0.25 : 0.05);
        ctx.lineWidth = 0.75;
        ctx.setLineDash([3, 10]);
        ctx.lineDashOffset = -state.rotation * 30;
        ctx.stroke();
        ctx.restore();
      }

      // LAYER 4: Primary Circular Spectrum (64 Radial Frequency Bars)
      const angleStep = (Math.PI * 2) / NUM_BARS;
      const barWidth = Math.max(1.8, (2 * Math.PI * spectrumBaseRadius) / NUM_BARS * 0.44);

      for (let i = 0; i < NUM_BARS; i++) {
        const theta = i * angleStep + state.rotation;

        // Symmetric frequency bin mapping (Low frequencies on both flanks, highs on tops)
        let binVal = 0;
        if (freqData && freqData.length > 0 && isPlaying) {
          const halfIndex = i < NUM_BARS / 2 ? i : (NUM_BARS - 1 - i);
          const mappedBin = Math.floor((halfIndex / (NUM_BARS / 2)) * freqData.length);
          binVal = (freqData[mappedBin] || 0) / 255;
        }

        // Smooth individual bar height with attack/decay
        const curBar = state.smoothedBars[i];
        const barTarget = isPlaying ? binVal : 0;
        const barFactor = barTarget > curBar ? 0.38 : 0.12;
        state.smoothedBars[i] += (barTarget - curBar) * barFactor;
        const smoothedVal = state.smoothedBars[i];

        // Minimum resting tick (2px) ensures visually crisp concentric structure even during silence
        const minBarHeight = 2.0;
        const barLength = minBarHeight + smoothedVal * maxBarLength * (1 - state.settleProgress * 0.9);

        const r0 = spectrumBaseRadius;
        const r1 = spectrumBaseRadius + barLength;

        const x0 = centerX + Math.cos(theta) * r0;
        const y0 = centerY + Math.sin(theta) * r0;
        const x1 = centerX + Math.cos(theta) * r1;
        const y1 = centerY + Math.sin(theta) * r1;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);

        // Dynamic gradient along each bar: Warm accent at root -> Cool/Cream accent at tip
        const barGrad = ctx.createLinearGradient(x0, y0, x1, y1);
        const barAlpha = isPlaying ? 0.45 + smoothedVal * 0.55 : 0.20;
        barGrad.addColorStop(0, hexToRgba(primaryColor, barAlpha * 0.85));
        barGrad.addColorStop(0.7, hexToRgba(secondaryColor, barAlpha));
        barGrad.addColorStop(1, hexToRgba(creamColor, barAlpha));

        ctx.strokeStyle = barGrad;
        ctx.lineWidth = barWidth;
        ctx.lineCap = 'round';

        // Luminous bloom on louder bars
        if (smoothedVal > 0.35 && isPlaying) {
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 6 + smoothedVal * 8;
        }

        ctx.stroke();
        ctx.restore();
      }

      // LAYER 5: Outer Harmonic Stardust Particles (Orbital High-Frequency Shimmer)
      if (!prefersReducedMotion) {
        ctx.save();
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.angle += p.speed * (1 + state.highs * 3.0);
          p.pulsePhase += 0.03;

          const pRadius = maxVisualizerRadius * p.baseRadiusRatio + bassExpand * 0.6;
          const px = centerX + Math.cos(p.angle) * pRadius;
          const py = centerY + Math.sin(p.angle) * pRadius;

          const shimmer = Math.sin(p.pulsePhase) * 0.2;
          const pOpacity = isPlaying
            ? Math.min(0.85, Math.max(0.1, p.opacity + shimmer + state.highs * 0.4))
            : p.opacity * 0.25 * (1 - state.settleProgress);

          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? hexToRgba(creamColor, pOpacity) : hexToRgba(secondaryColor, pOpacity);
          ctx.shadowColor = creamColor;
          ctx.shadowBlur = 3;
          ctx.fill();
        }
        ctx.restore();
      }

      // Continue animation frame
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, primaryColor, secondaryColor, creamColor]);

  const handleClick = useCallback(() => {
    if (interactive && onTogglePlay) {
      onTogglePlay();
    }
  }, [interactive, onTogglePlay]);

  return (
    <div
      ref={containerRef}
      className={`beat-synced-visualizer ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${songTitle} by ${songArtist}`}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        position: 'relative',
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        overflow: 'visible',
        ...style
      }}
    >
      {/* Real-time reactive Web Audio canvas background */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Center Breathing Disc (Audio-Reactive Core with Centered Title & Artist) */}
      <div
        ref={centerDiscRef}
        className="visualizer-center-disc"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '54%',
          height: '54%',
          borderRadius: '50%',
          zIndex: 2,
          background: 'radial-gradient(135% 135% at 50% 15%, rgba(20, 26, 38, 0.94) 0%, rgba(8, 11, 16, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(244, 240, 235, 0.12)',
          boxShadow: isPlaying
            ? '0 18px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(231, 165, 141, 0.18), inset 0 1px 2px rgba(255, 255, 255, 0.12)'
            : '0 12px 35px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease'
        }}
      >
        {/* Subtle Concentric Luxury Groove Rings */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '10%',
            borderRadius: '50%',
            border: '1px solid rgba(244, 240, 235, 0.04)',
            pointerEvents: 'none'
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '22%',
            borderRadius: '50%',
            border: '1px solid rgba(244, 240, 235, 0.03)',
            pointerEvents: 'none'
          }}
        />

        {/* Center Content: Song Title & Artist (NO NARO Logo, Premium Minimal, Gracefully Truncated) */}
        <div
          style={{
            position: 'relative',
            zIndex: 3,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            transform: isHovered ? 'translateY(-10px)' : 'translateY(0)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Song Title: Prominent, elegant typography with dynamic scaling & multi-line wrapping */}
          {(() => {
            const titleLen = songTitle.length;
            const titleFontSize = titleLen > 24
              ? 'clamp(0.62rem, 1.8vw, 0.78rem)'
              : titleLen > 14
                ? 'clamp(0.70rem, 2.0vw, 0.92rem)'
                : 'clamp(0.80rem, 2.2vw, 1.15rem)';

            const artistLen = songArtist.length;
            const artistFontSize = artistLen > 22
              ? 'clamp(0.56rem, 1.4vw, 0.70rem)'
              : 'clamp(0.64rem, 1.6vw, 0.82rem)';

            return (
              <>
                <span
                  id="visualizer-song-title"
                  title={songTitle}
                  style={{
                    fontSize: titleFontSize,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    maxWidth: '86%',
                    textAlign: 'center',
                    display: mode === 'fullscreen' ? '-webkit-box' : 'block',
                    WebkitLineClamp: mode === 'fullscreen' ? 2 : undefined,
                    WebkitBoxOrient: mode === 'fullscreen' ? 'vertical' : undefined,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: mode === 'fullscreen' ? 'normal' : 'nowrap',
                    lineHeight: 1.25,
                    wordBreak: mode === 'fullscreen' ? 'break-word' : 'normal',
                    textShadow: '0 2px 12px rgba(0, 0, 0, 0.85)',
                    padding: '0 2px'
                  }}
                >
                  {songTitle}
                </span>

                <span
                  id="visualizer-song-artist"
                  title={songArtist}
                  style={{
                    fontSize: artistFontSize,
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.01em',
                    maxWidth: '86%',
                    textAlign: 'center',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.25,
                    marginTop: '3px',
                    textShadow: '0 1px 8px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  {songArtist}
                </span>
              </>
            );
          })()}
        </div>

        {/* Interactive Play/Pause Cue (Appears cleanly on hover or when paused) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '18%',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered || !isPlaying ? 1 : 0,
            transform: isHovered || !isPlaying ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(6px)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: isHovered ? 'var(--accent-cream)' : 'rgba(244, 240, 235, 0.15)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${isHovered ? 'var(--accent-cream)' : 'rgba(244, 240, 235, 0.25)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isHovered ? '0 4px 16px rgba(0, 0, 0, 0.5)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isPlaying ? (
              <Pause size={14} color={isHovered ? '#080B10' : 'var(--accent-cream)'} />
            ) : (
              <Play size={14} color={isHovered ? '#080B10' : 'var(--accent-cream)'} style={{ marginLeft: '1.5px' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(231, 165, 141, ${alpha})`;
  let c = hex.slice(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.slice(0, 2), 16) || 231;
  const g = parseInt(c.slice(2, 4), 16) || 165;
  const b = parseInt(c.slice(4, 6), 16) || 141;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
