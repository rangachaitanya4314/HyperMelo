import React, { useEffect, useState, useCallback, useRef } from 'react';

export interface LogoRevealProps {
  onComplete: () => void;
  onToggleMode?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
}

interface VortexParticle {
  arm: number; // 0 = violet stream, 1 = gold stream, 2 = white-hot core
  progress: number; // 0 (outer) to 1 (center)
  speed: number;
  baseRadius: number;
  angleOffset: number;
  size: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
}

interface EmberParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  swaySpeed: number;
  swayDist: number;
  phase: number;
  alpha: number;
  maxAlpha: number;
  color: string;
}

/**
 * HyperMelo Cinematic Fluid-Particle Energy Logo Reveal
 *
 * Sequence:
 * - 0.0s - 1.8s: Deep OLED atmosphere with floating embers; violet & gold energy vortex ribbons swirl and converge
 * - 1.8s - 2.4s: Central convergence critical mass triggers optical flash, expanding shockwave ring & 150+ particle explosion
 * - 2.2s - 3.4s: Coalescing energy forms the "Hypermelo" calligraphic wordmark with a luxury gold shimmer sweep
 * - 2.7s - 4.2s: Active audio waveform visualizer pulses dynamically alongside the tagline "FEEL IT. MAKE IT."
 * - 4.2s - 4.6s: Smooth crossfade dissolve into the listening application
 */
export const LogoRevealCinematic: React.FC<LogoRevealProps> = ({ onComplete, onToggleMode }) => {
  const [isDissolving, setIsDissolving] = useState<boolean>(false);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const [phase, setPhase] = useState<'vortex' | 'explosion' | 'wordmark' | 'settled'>('vortex');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef<boolean>(false);
  const onCompleteRef = useRef<() => void>(onComplete);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const triggerComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  const handleQuickSkip = useCallback(() => {
    setIsDissolving(true);
    setTimeout(() => {
      triggerComplete();
    }, 120);
  }, [triggerComplete]);

  // Reduced motion handling & overall sequence timers
  useEffect(() => {
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedQuery.matches) {
      setIsReducedMotion(true);
      const reducedTimer = setTimeout(() => {
        setIsDissolving(true);
        setTimeout(() => triggerComplete(), 150);
      }, 400);
      return () => clearTimeout(reducedTimer);
    }

    // Check if auto-dismiss is paused (via window flag or ?pauseIntro=true URL param for tests/demo)
    const isAutoDismissPaused =
      typeof window !== 'undefined' &&
      ((window as any).__HYPERMELO_PAUSE_INTRO__ === true ||
        new URLSearchParams(window.location.search).get('pauseIntro') === 'true');

    // Phase triggers
    const explosionTimer = setTimeout(() => setPhase('explosion'), 1800);
    const wordmarkTimer = setTimeout(() => setPhase('wordmark'), 2400);
    const settledTimer = setTimeout(() => setPhase('settled'), 3200);

    let dissolveTimer: ReturnType<typeof setTimeout> | undefined;
    let completeTimer: ReturnType<typeof setTimeout> | undefined;

    if (!isAutoDismissPaused) {
      dissolveTimer = setTimeout(() => setIsDissolving(true), 6000);
      completeTimer = setTimeout(() => triggerComplete(), 6400);
    }

    return () => {
      clearTimeout(explosionTimer);
      clearTimeout(wordmarkTimer);
      clearTimeout(settledTimer);
      if (dissolveTimer) clearTimeout(dissolveTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [triggerComplete]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Escape', 'Space', 'Enter'].includes(e.key)) {
        e.preventDefault();
        handleQuickSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleQuickSkip]);

  // Canvas particle simulation engine
  useEffect(() => {
    if (isReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Color Palettes
    const violetColors = ['#D43CFF', '#9D00FF', '#7928CA', '#C026D3', '#E879F9'];
    const goldColors = ['#FFD700', '#FFAA00', '#FFC2A1', '#F59E0B', '#FDE047'];
    const coreColors = ['#FFFFFF', '#FFE4E6', '#FEF08A'];

    // 1. Ambient Background Embers
    const emberCount = 45;
    const embers: EmberParticle[] = [];
    for (let i = 0; i < emberCount; i++) {
      embers.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 0.8,
        speedY: Math.random() * 0.45 + 0.15,
        swaySpeed: Math.random() * 0.02 + 0.008,
        swayDist: Math.random() * 30 + 10,
        phase: Math.random() * Math.PI * 2,
        alpha: 0,
        maxAlpha: Math.random() * 0.5 + 0.2,
        color: Math.random() > 0.5 ? '#FFD700' : '#D43CFF'
      });
    }

    // 2. Swirling Energy Vortex Streams
    const vortexParticleCount = 120;
    const vortexParticles: VortexParticle[] = [];
    for (let i = 0; i < vortexParticleCount; i++) {
      const arm = i % 3; // 0 = violet, 1 = gold, 2 = white core highlight
      const color =
        arm === 0
          ? violetColors[Math.floor(Math.random() * violetColors.length)]
          : arm === 1
          ? goldColors[Math.floor(Math.random() * goldColors.length)]
          : coreColors[Math.floor(Math.random() * coreColors.length)];

      vortexParticles.push({
        arm,
        progress: Math.random() * 0.85,
        speed: Math.random() * 0.0035 + 0.0025,
        baseRadius: Math.random() * 220 + 100,
        angleOffset: (arm * (Math.PI * 2 / 3)) + (Math.random() * 0.6 - 0.3),
        size: arm === 2 ? Math.random() * 1.8 + 1 : Math.random() * 2.6 + 1.2,
        color,
        trail: []
      });
    }

    // 3. Shockwave & Explosion Sparks
    let explosionTriggered = false;
    const explosionSparks: Particle[] = [];
    let shockwaveRadius = 0;
    let shockwaveAlpha = 0;
    let flashIntensity = 0;

    startTimeRef.current = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000; // seconds

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw subtle background radial ambient glow
      const ambientGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        Math.max(width, height) * 0.6
      );
      ambientGrad.addColorStop(0, 'rgba(212, 60, 255, 0.08)');
      ambientGrad.addColorStop(0.35, 'rgba(255, 215, 0, 0.03)');
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, width, height);

      // --- 1. Render Ambient Floating Embers ---
      ctx.save();
      for (const ember of embers) {
        ember.y -= ember.speedY;
        ember.phase += ember.swaySpeed;
        const currentX = ember.x + Math.sin(ember.phase) * ember.swayDist * 0.3;

        if (ember.alpha < ember.maxAlpha && elapsed < 3.8) {
          ember.alpha += 0.01;
        } else if (elapsed >= 3.8) {
          ember.alpha = Math.max(0, ember.alpha - 0.02);
        }

        if (ember.y < -10) {
          ember.y = height + 10;
          ember.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(currentX, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fillStyle = ember.color;
        ctx.globalAlpha = ember.alpha;
        ctx.shadowColor = ember.color;
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.restore();

      // --- 2. Render Swirling Energy Vortex (0s - 2.0s) ---
      if (elapsed < 2.0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const vortexFade = elapsed < 1.7 ? 1 : Math.max(0, (2.0 - elapsed) / 0.3);

        for (const p of vortexParticles) {
          p.progress += p.speed * (1 + p.progress * 2.2); // Accelerate as it gets closer
          if (p.progress > 1) {
            p.progress = 0;
            p.trail = [];
          }

          // Inward spiral equation: radius shrinks non-linearly, angle spins rapidly
          const radius = (1 - Math.pow(p.progress, 1.4)) * (Math.min(width, height) * 0.42);
          const spinVelocity = 8.5; // High rotation count
          const angle = p.angleOffset + p.progress * spinVelocity * Math.PI;

          const px = centerX + Math.cos(angle) * radius;
          const py = centerY + Math.sin(angle) * (radius * 0.72); // slightly elliptical for 3D depth tilt

          // Track trailing ribbon coordinates
          p.trail.unshift({ x: px, y: py, alpha: vortexFade * (1 - p.progress * 0.3) });
          if (p.trail.length > 7) {
            p.trail.pop();
          }

          // Draw trailing luminous ribbon stroke
          if (p.trail.length > 2) {
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let t = 1; t < p.trail.length; t++) {
              ctx.lineTo(p.trail[t].x, p.trail[t].y);
            }
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * (1 - p.progress * 0.5);
            ctx.globalAlpha = (p.trail[0].alpha || 1) * 0.55;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.stroke();
          }

          // Draw head particle
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = vortexFade * 0.9;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 14;
          ctx.fill();
        }

        // Central converging energy singularity core
        const coreIntensity = Math.min(1, elapsed / 1.6);
        const coreRadius = Math.max(2, (1 - coreIntensity * 0.6) * 16 + Math.sin(elapsed * 20) * 3);
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2.5);
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        coreGrad.addColorStop(0.3, 'rgba(255, 215, 0, 0.75)');
        coreGrad.addColorStop(0.7, 'rgba(212, 60, 255, 0.4)');
        coreGrad.addColorStop(1, 'rgba(212, 60, 255, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // --- 3. Convergence Detonation & Explosion (1.75s+) ---
      if (elapsed >= 1.75 && !explosionTriggered) {
        explosionTriggered = true;
        flashIntensity = 1.0;
        shockwaveRadius = 2;
        shockwaveAlpha = 1.0;

        // Generate 160 explosive radial sparks
        const sparkCount = 150;
        for (let i = 0; i < sparkCount; i++) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 11 + 2.5;
          const colorType = Math.random();
          const color =
            colorType < 0.45
              ? goldColors[Math.floor(Math.random() * goldColors.length)]
              : colorType < 0.85
              ? violetColors[Math.floor(Math.random() * violetColors.length)]
              : '#FFFFFF';

          explosionSparks.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(sparkAngle) * speed,
            vy: Math.sin(sparkAngle) * speed * 0.8, // slight vertical compression
            size: Math.random() * 2.6 + 1.2,
            color,
            alpha: 1.0,
            decay: Math.random() * 0.02 + 0.012,
            life: 1.0,
            maxLife: 1.0
          });
        }
      }

      // Update & Render Explosion Sparks
      if (explosionTriggered && explosionSparks.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Expand shockwave rings
        if (shockwaveAlpha > 0.01) {
          shockwaveRadius += (Math.min(width, height) * 0.5 - shockwaveRadius) * 0.12;
          shockwaveAlpha *= 0.94;

          // Outer shockwave ring (Gold/Violet boundary)
          ctx.beginPath();
          ctx.arc(centerX, centerY, shockwaveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 215, 0, ${shockwaveAlpha * 0.85})`;
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#D43CFF';
          ctx.shadowBlur = 18;
          ctx.stroke();

          // Inner shockwave ripple
          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(0, shockwaveRadius - 18), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212, 60, 255, ${shockwaveAlpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Central Optical Flash Bloom
        if (flashIntensity > 0.02) {
          const flashGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            180 * flashIntensity
          );
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashIntensity * 0.85})`);
          flashGrad.addColorStop(0.3, `rgba(255, 215, 0, ${flashIntensity * 0.6})`);
          flashGrad.addColorStop(0.7, `rgba(212, 60, 255, ${flashIntensity * 0.3})`);
          flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = flashGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 180 * flashIntensity, 0, Math.PI * 2);
          ctx.fill();

          flashIntensity *= 0.86;
        }

        // Render bursting sparks
        for (let i = explosionSparks.length - 1; i >= 0; i--) {
          const s = explosionSparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.vx *= 0.95; // Drag
          s.vy *= 0.95;
          s.life -= s.decay;
          s.alpha = Math.max(0, s.life);

          if (s.life <= 0) {
            explosionSparks.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = s.alpha * 0.9;
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 12;
          ctx.fill();
        }

        ctx.restore();
      }

      if (elapsed < 5.0) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isReducedMotion]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HyperMelo Brand Reveal"
      onClick={handleQuickSkip}
      className={`hypermelo-cinematic-container ${isDissolving ? 'hypermelo-cinematic-dissolving' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#030205',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Background Interactive High-Performance Particle Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: isReducedMotion ? 'none' : 'block',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Deep OLED Radial Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(3, 2, 5, 0.85) 90%, #030205 100%)',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />

      {/* 9:16 Portrait / Responsive Central Hero Stage */}
      <div className="cinematic-hero-stage">
        {/* Active Audio Waveform Spectrum Bars (Pulses alongside the brand lockup) */}
        <div className={`cinematic-waveform-spectrum ${phase === 'wordmark' || phase === 'settled' ? 'active' : ''}`}>
          <div className="spectrum-bar bar-1" />
          <div className="spectrum-bar bar-2" />
          <div className="spectrum-bar bar-3" />
          <div className="spectrum-bar bar-4" />
          <div className="spectrum-bar bar-5" />
          <div className="spectrum-bar bar-6" />
          <div className="spectrum-bar bar-7" />
          <div className="spectrum-bar bar-8" />
          <div className="spectrum-bar bar-9" />
          <div className="spectrum-bar bar-10" />
          <div className="spectrum-bar bar-11" />
          <div className="spectrum-bar bar-12" />
          <div className="spectrum-bar bar-13" />
          <div className="spectrum-bar bar-14" />
          <div className="spectrum-bar bar-15" />
          <div className="spectrum-bar bar-16" />
        </div>

        {/* Master Brand SVG Stage (viewBox 60 90 910 170 matches master identity 1:1) */}
        <div className={`cinematic-brand-lockup ${phase !== 'vortex' ? 'reveal-active' : ''}`}>
          <svg
            viewBox="60 90 910 170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="cinematic-brand-svg"
          >
            {/* Luminous Waveform Symbol Layer */}
            <g className={`layer-waveform ${phase !== 'vortex' ? 'layer-enter' : ''}`}>
              <image
                href="/brand/hypermelo_waveform_layer.png"
                x="0"
                y="0"
                width="1024"
                height="341"
              />
            </g>

            {/* Vertical Divider Layer */}
            <g className={`layer-divider ${phase === 'wordmark' || phase === 'settled' ? 'layer-enter' : ''}`}>
              <image
                href="/brand/hypermelo_divider_layer.png"
                x="0"
                y="0"
                width="1024"
                height="341"
              />
            </g>

            {/* Calligraphic "Hypermelo" Script Wordmark Layer with Golden Shimmer Mask */}
            <g className={`layer-wordmark ${phase === 'wordmark' || phase === 'settled' ? 'layer-enter' : ''}`}>
              <image
                href="/brand/hypermelo_wordmark_layer.png"
                x="0"
                y="0"
                width="1024"
                height="341"
              />
            </g>

            {/* Tagline: "FEEL IT. MAKE IT." Layer */}
            <g className={`layer-tagline ${phase === 'settled' ? 'layer-enter' : ''}`}>
              <image
                href="/brand/hypermelo_tagline_layer.png"
                x="0"
                y="0"
                width="1024"
                height="341"
              />
            </g>
          </svg>

          {/* Liquid Gold Shimmer Beam Overlay */}
          <div className={`gold-shimmer-beam ${phase === 'wordmark' || phase === 'settled' ? 'sweep' : ''}`} />
        </div>
      </div>

      {/* Floating Bottom Utility Controls: Mode Switcher & Skip Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 28px',
          zIndex: 20
        }}
      >
        {onToggleMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMode();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 215, 0, 0.25)',
              borderRadius: '20px',
              padding: '6px 14px',
              color: 'rgba(255, 215, 0, 0.85)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Switch to Classic Reveal"
          >
            <span>↺</span>
            <span>Classic Reveal</span>
          </button>
        ) : <div />}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleQuickSkip();
          }}
          aria-label="Skip brand reveal"
          className="cinematic-skip-btn"
        >
          SKIP
        </button>
      </div>

      {/* Scoped CSS for Fluid-Particle Cinematic Typography & Shimmer */}
      <style>{`
        .hypermelo-cinematic-container {
          opacity: 1;
          transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hypermelo-cinematic-dissolving {
          opacity: 0 !important;
          pointer-events: none;
        }

        /* 9:16 Responsive Container Stage */
        .cinematic-hero-stage {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: min(880px, 90vw);
          max-width: 920px;
          aspect-ratio: auto;
        }

        @media (max-width: 899px) {
          .cinematic-hero-stage {
            width: 92vw;
            padding: 0 12px;
          }
        }

        /* Active Audio Spectrum Visualizer */
        .cinematic-waveform-spectrum {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
          height: 28px;
          margin-bottom: 20px;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.6s ease, transform 0.6s ease;
          pointer-events: none;
        }
        .cinematic-waveform-spectrum.active {
          opacity: 0.95;
          transform: translateY(0);
        }

        .spectrum-bar {
          width: 3.5px;
          border-radius: 2px;
          background: linear-gradient(180deg, #FFD700 0%, #D43CFF 70%, #9D00FF 100%);
          box-shadow: 0 0 10px rgba(212, 60, 255, 0.6);
          animation: spectrumPulse 1.4s ease-in-out infinite alternate;
        }

        .bar-1  { height: 8px;  animation-delay: 0.05s; }
        .bar-2  { height: 16px; animation-delay: 0.25s; }
        .bar-3  { height: 24px; animation-delay: 0.12s; }
        .bar-4  { height: 14px; animation-delay: 0.4s;  }
        .bar-5  { height: 20px; animation-delay: 0.18s; }
        .bar-6  { height: 26px; animation-delay: 0.32s; }
        .bar-7  { height: 12px; animation-delay: 0.5s;  }
        .bar-8  { height: 22px; animation-delay: 0.1s;  }
        .bar-9  { height: 28px; animation-delay: 0.35s; }
        .bar-10 { height: 15px; animation-delay: 0.22s; }
        .bar-11 { height: 23px; animation-delay: 0.45s; }
        .bar-12 { height: 18px; animation-delay: 0.15s; }
        .bar-13 { height: 25px; animation-delay: 0.28s; }
        .bar-14 { height: 11px; animation-delay: 0.52s; }
        .bar-15 { height: 19px; animation-delay: 0.08s; }
        .bar-16 { height: 9px;  animation-delay: 0.38s; }

        @keyframes spectrumPulse {
          0% {
            transform: scaleY(0.35);
            opacity: 0.6;
            filter: brightness(0.9);
          }
          50% {
            transform: scaleY(1.15);
            opacity: 1;
            filter: brightness(1.3) drop-shadow(0 0 8px rgba(255, 215, 0, 0.8));
          }
          100% {
            transform: scaleY(0.5);
            opacity: 0.75;
            filter: brightness(1.0);
          }
        }

        /* Brand Vector Composition */
        .cinematic-brand-lockup {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(0.92);
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cinematic-brand-lockup.reveal-active {
          opacity: 1;
          transform: scale(1);
        }

        .cinematic-brand-svg {
          width: 100%;
          height: auto;
          aspect-ratio: 910 / 170;
          display: block;
          filter: drop-shadow(0 0 32px rgba(212, 60, 255, 0.35)) drop-shadow(0 0 16px rgba(255, 215, 0, 0.25));
        }

        /* Layer Revelations */
        .layer-waveform {
          opacity: 0;
          transform: scale(0.94);
          transition: opacity 0.5s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .layer-waveform.layer-enter {
          opacity: 1;
          transform: scale(1);
        }

        .layer-divider {
          opacity: 0;
          transition: opacity 0.4s ease 0.1s;
        }
        .layer-divider.layer-enter {
          opacity: 1;
        }

        .layer-wordmark {
          opacity: 0;
          filter: blur(8px) brightness(1.8);
          transform: translateY(4px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s ease-out, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .layer-wordmark.layer-enter {
          opacity: 1;
          filter: blur(0px) brightness(1.0);
          transform: translateY(0);
        }

        .layer-tagline {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
        }
        .layer-tagline.layer-enter {
          opacity: 1;
          transform: translateY(0);
        }

        /* Luxury Liquid Gold Shimmer Beam */
        .gold-shimmer-beam {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 0%,
            transparent 35%,
            rgba(255, 215, 0, 0.3) 44%,
            rgba(255, 255, 255, 0.95) 50%,
            rgba(255, 215, 0, 0.35) 56%,
            transparent 65%,
            transparent 100%
          );
          opacity: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          transform: translateX(-100%);
        }

        .gold-shimmer-beam.sweep {
          animation: goldShimmerSweep 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s forwards;
        }

        @keyframes goldShimmerSweep {
          0% {
            opacity: 0;
            transform: translateX(-100%);
          }
          30% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        /* Accessible Skip Hint */
        .cinematic-skip-btn {
          background: none;
          border: none;
          color: rgba(255, 215, 0, 0.7);
          font-family: var(--font-sans), system-ui, sans-serif;
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 8px 16px;
          transition: color 0.2s ease, text-shadow 0.2s ease;
        }
        .cinematic-skip-btn:hover {
          color: #FFD700;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
        }
      `}</style>
    </div>
  );
};

