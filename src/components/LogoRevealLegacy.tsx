import React, { useEffect, useState, useCallback, useRef } from 'react';

export interface LogoRevealProps {
  onComplete: () => void;
  onToggleMode?: () => void;
}

/**
 * HyperMelo Legacy Brand Reveal — Fallback Backup Implementation
 *
 * Sequence (~3.5s total):
 * - 0.0 - 0.5s: Deep near-black background (#050407) fades in with a soft luminous ambient aura.
 * - 0.5 - 1.4s: The ribbon audio waveform illuminates from left to right.
 * - 1.4 - 2.0s: The slim vertical divider line sweeps down.
 * - 2.0 - 2.8s: The calligraphic "HyperMelo" script wordmark reveals with a smooth sweep.
 * - 2.8 - 3.3s: The clean uppercase tagline "FEEL IT. MAKE IT." fades in gently below the wordmark.
 * - 3.3 - 3.5s: Complete master lockup rests in crystal-clear stillness.
 * - 3.5s+:      Smooth crossfade dissolve.
 */
export const LogoRevealLegacy: React.FC<LogoRevealProps> = ({ onComplete, onToggleMode }) => {
  const [isDissolving, setIsDissolving] = useState<boolean>(false);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);
  const onCompleteRef = useRef<() => void>(onComplete);

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

  useEffect(() => {
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedQuery.matches) {
      setIsReducedMotion(true);
      const reducedTimer = setTimeout(() => {
        setIsDissolving(true);
        setTimeout(() => triggerComplete(), 150);
      }, 300);
      return () => clearTimeout(reducedTimer);
    }

    const isAutoDismissPaused =
      typeof window !== 'undefined' &&
      ((window as any).__HYPERMELO_PAUSE_INTRO__ === true ||
        new URLSearchParams(window.location.search).get('pauseIntro') === 'true');

    let dissolveTimer: NodeJS.Timeout | undefined;
    let completeTimer: NodeJS.Timeout | undefined;

    if (!isAutoDismissPaused) {
      dissolveTimer = setTimeout(() => {
        setIsDissolving(true);
      }, 5500);

      completeTimer = setTimeout(() => {
        triggerComplete();
      }, 5800);
    }

    return () => {
      if (dissolveTimer) clearTimeout(dissolveTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [triggerComplete]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HyperMelo Brand Reveal (Legacy)"
      onClick={handleQuickSkip}
      className={`hypermelo-intro-container ${isDissolving ? 'hypermelo-intro-dissolving' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050407',
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
      {/* Ambient Neon Atmosphere (0.2s - 3.5s) */}
      {!isReducedMotion && <div className="intro-ambient-light" />}

      {/* Main Master Composition Stage */}
      <div className="intro-master-stage">
        <svg
          viewBox="60 90 910 170"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="intro-master-svg"
        >
          {/* 1. Waveform Layer */}
          <g className={isReducedMotion ? '' : 'anim-waveform-reveal'}>
            <image
              href="/brand/hypermelo_waveform_layer.png"
              x="0"
              y="0"
              width="1024"
              height="341"
            />
          </g>

          {/* 2. Vertical Divider Layer */}
          <g className={isReducedMotion ? '' : 'anim-divider-reveal'}>
            <image
              href="/brand/hypermelo_divider_layer.png"
              x="0"
              y="0"
              width="1024"
              height="341"
            />
          </g>

          {/* 3. Calligraphic HyperMelo Script Wordmark */}
          <g className={isReducedMotion ? '' : 'anim-wordmark-reveal'}>
            <image
              href="/brand/hypermelo_wordmark_layer.png"
              x="0"
              y="0"
              width="1024"
              height="341"
            />
          </g>

          {/* 4. Tagline: FEEL IT. MAKE IT. */}
          <g className={isReducedMotion ? '' : 'anim-tagline-reveal'}>
            <image
              href="/brand/hypermelo_tagline_layer.png"
              x="0"
              y="0"
              width="1024"
              height="341"
            />
          </g>
        </svg>
      </div>

      {/* Discreet Mode Indicator & Controls */}
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
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '6px 14px',
              color: 'var(--text-muted, #a1a1aa)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease'
            }}
            title="Switch to Fluid Particle Energy Reveal"
          >
            ✦ Try Cinematic Vortex
          </button>
        ) : <div />}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleQuickSkip();
          }}
          aria-label="Skip brand reveal"
          className="intro-skip-btn"
        >
          SKIP
        </button>
      </div>

      <style>{`
        .hypermelo-intro-container {
          opacity: 1;
          transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hypermelo-intro-dissolving {
          opacity: 0 !important;
          pointer-events: none;
        }

        .intro-master-stage {
          position: relative;
          width: min(840px, 88vw);
          max-width: 880px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .intro-master-svg {
          width: 100%;
          height: auto;
          aspect-ratio: 910 / 170;
          display: block;
          filter: drop-shadow(0 0 24px rgba(212, 60, 255, 0.25));
        }

        .intro-ambient-light {
          position: absolute;
          width: 450px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212, 60, 255, 0.16) 0%, rgba(255, 143, 184, 0.08) 40%, transparent 70%);
          filter: blur(45px);
          pointer-events: none;
          z-index: 2;
          animation: ambientBreath 3.5s ease-in-out infinite alternate;
        }

        @keyframes ambientBreath {
          0% { transform: scale(0.85); opacity: 0.4; }
          100% { transform: scale(1.15); opacity: 0.85; }
        }

        .anim-waveform-reveal {
          clip-path: inset(0 100% 0 0);
          animation: waveformSweep 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
        }

        @keyframes waveformSweep {
          0% {
            clip-path: inset(0 100% 0 0);
            opacity: 0.2;
            filter: brightness(1.6) drop-shadow(0 0 20px rgba(255, 143, 184, 0.8));
          }
          60% {
            opacity: 1;
            filter: brightness(1.2) drop-shadow(0 0 16px rgba(212, 60, 255, 0.6));
          }
          100% {
            clip-path: inset(0 0% 0 0);
            opacity: 1;
            filter: drop-shadow(0 0 10px rgba(212, 60, 255, 0.3));
          }
        }

        .anim-divider-reveal {
          clip-path: inset(0 0 100% 0);
          opacity: 0;
          animation: dividerSweep 0.55s cubic-bezier(0.16, 1, 0.3, 1) 1.4s forwards;
        }

        @keyframes dividerSweep {
          0% {
            clip-path: inset(0 0 100% 0);
            opacity: 0;
            filter: brightness(2) drop-shadow(0 0 16px #FF8FB8);
          }
          50% {
            opacity: 1;
            filter: brightness(1.5) drop-shadow(0 0 12px #FFC2A1);
          }
          100% {
            clip-path: inset(0 0 0% 0);
            opacity: 1;
            filter: drop-shadow(0 0 6px rgba(255, 143, 184, 0.4));
          }
        }

        .anim-wordmark-reveal {
          clip-path: inset(0 100% 0 0);
          opacity: 0;
          animation: wordmarkSweep 0.8s cubic-bezier(0.16, 1, 0.3, 1) 2.0s forwards;
        }

        @keyframes wordmarkSweep {
          0% {
            clip-path: inset(0 100% 0 0);
            opacity: 0;
            filter: blur(4px) drop-shadow(0 0 20px rgba(255, 143, 184, 0.6));
          }
          30% {
            opacity: 1;
            filter: blur(2px) drop-shadow(0 0 16px rgba(212, 60, 255, 0.4));
          }
          100% {
            clip-path: inset(0 0% 0 0);
            opacity: 1;
            filter: blur(0px) drop-shadow(0 0 8px rgba(255, 143, 184, 0.2));
          }
        }

        .anim-tagline-reveal {
          opacity: 0;
          transform: translateY(4px);
          animation: taglineFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) 2.8s forwards;
        }

        @keyframes taglineFade {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .intro-skip-btn {
          background: none;
          border: none;
          color: rgba(231, 165, 141, 0.6);
          font-family: var(--font-sans, system-ui, sans-serif);
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 8px 16px;
          transition: color 0.2s ease;
        }
        .intro-skip-btn:hover {
          color: #FF8FB8;
        }
      `}</style>
    </div>
  );
};

