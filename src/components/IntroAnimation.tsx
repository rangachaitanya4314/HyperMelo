import React, { useEffect, useState, useCallback, useRef } from 'react';

interface IntroAnimationProps {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [isDissolving, setIsDissolving] = useState<boolean>(false);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);
  const onCompleteRef = useRef<() => void>(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const spectrumColors = ['#E7A58D', '#F4DFC9', '#8FA8C8', '#A78BFA', '#FCD34D', '#E7A58D', '#8FA8C8'];

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
    // Check for prefers-reduced-motion
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedQuery.matches) {
      setIsReducedMotion(true);
      const reducedTimer = setTimeout(() => {
        setIsDissolving(true);
        setTimeout(() => triggerComplete(), 150);
      }, 300);
      return () => clearTimeout(reducedTimer);
    }

    // Sequence timings (Total 1.52s):
    // 0.00s - 0.15s: Deep cinematic blackness
    // 0.15s - 0.30s: Subtle spectrum/radial wave energy begins
    // 0.30s - 0.85s: Progressive wordmark reveal drawn by vertical spectrum energy brush
    // 0.85s - 1.05s: Signature multicolor chromatic prism wave sweeps through NARO
    // 1.05s - 1.30s: "Feel It. Make It." settles softly beneath
    // 1.30s - 1.52s: Continuous crossfade/dissolve into the listening application
    const dissolveTimer = setTimeout(() => {
      setIsDissolving(true);
    }, 1300);

    const completeTimer = setTimeout(() => {
      triggerComplete();
    }, 1520);

    return () => {
      clearTimeout(dissolveTimer);
      clearTimeout(completeTimer);
    };
  }, [triggerComplete]);

  // Keyboard shortcut listener (Space, Escape, Enter) for instant skip
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
      aria-label="NARO Brand Reveal"
      onClick={handleQuickSkip}
      className={`naro-intro-container ${isDissolving ? 'naro-intro-dissolving' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#06080C',
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
      {/* 0.15s - Ambient Warm Radial Glow Field */}
      {!isReducedMotion && <div className="naro-ambient-glow" />}

      {/* Main Brand Hero Presentation */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
          padding: '0 24px'
        }}
      >
        {/* Wordmark Stage with Progressive Clip Reveal & Energy Brush */}
        <div className="naro-wordmark-stage">
          {/* Base Luminous Wordmark (Revealed left-to-right 0.30s - 0.85s) */}
          <h1 className="naro-revealed-text">
            Naro
          </h1>

          {/* Vertical Spectrum Energy Brush (Traces along the reveal edge) */}
          {!isReducedMotion && <div className="naro-energy-brush" />}

          {/* Signature Multicolor Prism Sweep (Washes across text 0.85s - 1.10s) */}
          {!isReducedMotion && (
            <div aria-hidden="true" className="naro-prism-sheen">
              Naro
            </div>
          )}
        </div>

        {/* 0.85s - Harmonic Audio Spectrum Bars */}
        {!isReducedMotion && (
          <div className="naro-harmonic-spectrum" aria-hidden="true">
            {spectrumColors.map((color, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: '3px',
                  height: i % 2 === 0 ? '16px' : '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}66`,
                  animation: `naroBarVibrate 0.6s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.08}s`
                }}
              />
            ))}
          </div>
        )}

        {/* 1.05s - Tagline: "Feel It. Make It." */}
        <p className="naro-intro-tagline">
          Feel It. Make It.
        </p>
      </div>

      {/* Discreet Accessible Skip Hint */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleQuickSkip();
        }}
        aria-label="Skip intro animation"
        style={{
          position: 'absolute',
          bottom: '28px',
          background: 'none',
          border: 'none',
          color: 'rgba(154, 162, 173, 0.4)',
          fontSize: '0.74rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          padding: '8px 16px',
          transition: 'color 0.2s ease',
          zIndex: 10
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#F4F0EB')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(154, 162, 173, 0.4)')}
      >
        Skip
      </button>

      {/* Scoped Cinematic GPU-Accelerated Keyframes */}
      <style>{`
        /* Ambient Radial Glow */
        .naro-ambient-glow {
          position: absolute;
          width: min(85vw, 680px);
          height: min(85vw, 420px);
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(231, 165, 141, 0.22) 0%, rgba(143, 168, 200, 0.12) 40%, transparent 70%);
          filter: blur(65px);
          pointer-events: none;
          opacity: 0;
          animation: naroGlowEntrance 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
        }

        @keyframes naroGlowEntrance {
          0% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 0.65; transform: scale(1.05); }
          80% { opacity: 0.75; transform: scale(1.15); }
          100% { opacity: 0.45; transform: scale(1.02); }
        }

        /* Wordmark Stage */
        .naro-wordmark-stage {
          position: relative;
          display: inline-block;
          padding: 0 clamp(16px, 4vw, 40px);
          margin-bottom: 2px;
        }

        /* 0.30s - 0.85s: Clip-Path Progressive Reveal */
        .naro-revealed-text {
          font-family: var(--font-brand), "Alex Brush", cursive, sans-serif;
          font-size: clamp(4.5rem, 12vw, 7.8rem);
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: 0.03em;
          color: #F4F0EB;
          margin: 0;
          display: block;
          clip-path: inset(0 100% 0 0);
          -webkit-clip-path: inset(0 100% 0 0);
          text-shadow: 0 0 40px rgba(244, 240, 235, 0.25);
          animation: naroClipReveal 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.30s forwards;
        }

        @keyframes naroClipReveal {
          0% {
            clip-path: inset(0 100% 0 0);
            -webkit-clip-path: inset(0 100% 0 0);
            opacity: 0.4;
          }
          15% {
            opacity: 1;
          }
          100% {
            clip-path: inset(0 0% 0 0);
            -webkit-clip-path: inset(0 0% 0 0);
            opacity: 1;
          }
        }

        /* Vertical Spectrum Energy Brush Traveling at Reveal Edge */
        .naro-energy-brush {
          position: absolute;
          top: 6%;
          bottom: 6%;
          width: 3.5px;
          border-radius: 2px;
          background: linear-gradient(180deg, transparent 0%, #E7A58D 25%, #F4DFC9 50%, #8FA8C8 75%, transparent 100%);
          box-shadow: 0 0 16px rgba(231, 165, 141, 0.95), 0 0 32px rgba(143, 168, 200, 0.8), 0 0 48px rgba(244, 223, 201, 0.6);
          pointer-events: none;
          opacity: 0;
          animation: naroBrushTravel 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.30s forwards;
        }

        @keyframes naroBrushTravel {
          0% {
            left: 0%;
            opacity: 0;
            transform: scaleY(0.4);
          }
          10% {
            opacity: 1;
            transform: scaleY(1);
          }
          85% {
            opacity: 1;
            transform: scaleY(1);
          }
          100% {
            left: 100%;
            opacity: 0;
            transform: scaleY(0.5);
          }
        }

        /* 0.85s - 1.10s: Signature Multicolor Prism Shimmer Sweep */
        .naro-prism-sheen {
          position: absolute;
          inset: 0;
          font-family: var(--font-brand), "Alex Brush", cursive, sans-serif;
          font-size: clamp(4.5rem, 12vw, 7.8rem);
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: 0.03em;
          margin: 0;
          padding: 0 clamp(16px, 4vw, 40px);
          pointer-events: none;
          background: linear-gradient(90deg, transparent 0%, rgba(231, 165, 141, 0.95) 25%, rgba(244, 223, 201, 1) 50%, rgba(143, 168, 200, 0.95) 75%, transparent 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          opacity: 0;
          animation: naroPrismSweep 0.32s ease-out 0.85s forwards;
        }

        @keyframes naroPrismSweep {
          0% {
            background-position: 100% 0;
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          75% {
            opacity: 0.9;
          }
          100% {
            background-position: -100% 0;
            opacity: 0;
          }
        }

        /* 0.85s: Harmonic Spectrum Micro-Bars */
        .naro-harmonic-spectrum {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 20px;
          margin-top: 8px;
          opacity: 0;
          animation: naroSpectrumFade 0.35s ease-out 0.85s forwards;
        }

        @keyframes naroSpectrumFade {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 0.88; transform: scale(1); }
        }

        @keyframes naroBarVibrate {
          0% { transform: scaleY(0.4); opacity: 0.5; }
          100% { transform: scaleY(1.25); opacity: 1; }
        }

        /* 1.05s: Tagline Reveal */
        .naro-intro-tagline {
          font-family: var(--font-sans), system-ui, sans-serif;
          font-size: clamp(0.82rem, 1.8vw, 0.96rem);
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #E7A58D;
          margin: 14px 0 0 0;
          opacity: 0;
          transform: translateY(6px);
          animation: naroTaglineFadeUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) 1.05s forwards;
        }

        @keyframes naroTaglineFadeUp {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 0.92;
            transform: translateY(0);
          }
        }

        /* 1.30s - 1.52s: Continuous Crossfade/Dissolve into Application */
        .naro-intro-dissolving {
          transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s ease, filter 0.24s ease !important;
          opacity: 0 !important;
          transform: scale(1.025) !important;
          filter: blur(3px) !important;
          pointer-events: none !important;
        }

        /* Accessible Reduced Motion Overrides */
        @media (prefers-reduced-motion: reduce) {
          .naro-ambient-glow,
          .naro-energy-brush,
          .naro-prism-sheen,
          .naro-harmonic-spectrum {
            display: none !important;
          }
          .naro-revealed-text {
            clip-path: none !important;
            -webkit-clip-path: none !important;
            opacity: 1 !important;
            animation: none !important;
          }
          .naro-intro-tagline {
            opacity: 0.92 !important;
            transform: none !important;
            animation: none !important;
          }
          .naro-intro-dissolving {
            transition: opacity 0.15s ease !important;
            opacity: 0 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>
    </div>
  );
};
