import React, { useState, useCallback } from 'react';
import { LogoRevealCinematic } from './LogoRevealCinematic';
import { LogoRevealLegacy } from './LogoRevealLegacy';

export interface IntroAnimationProps {
  onComplete: () => void;
  fallbackLogoMode?: boolean;
}

/**
 * HyperMelo Master Intro Reveal Orchestrator
 *
 * Defaults to the new Fluid-Particle Energy Logo Reveal (LogoRevealCinematic).
 * Preserves the previous master reveal as a safe fallback backup (LogoRevealLegacy).
 * Allows instant live toggling between modes via `fallbackLogoMode` prop,
 * localStorage `hypermelo_logo_mode`, or the on-screen mode switcher.
 */
export const IntroAnimation: React.FC<IntroAnimationProps> = ({
  onComplete,
  fallbackLogoMode = false
}) => {
  const [mode, setMode] = useState<'cinematic' | 'legacy'>(() => {
    if (fallbackLogoMode) return 'legacy';
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('logo') === 'legacy') return 'legacy';
      const stored = localStorage.getItem('hypermelo_logo_mode');
      if (stored === 'legacy') return 'legacy';
    }
    return 'cinematic';
  });

  const handleToggleMode = useCallback(() => {
    setMode((prev) => {
      const nextMode = prev === 'cinematic' ? 'legacy' : 'cinematic';
      if (typeof window !== 'undefined') {
        localStorage.setItem('hypermelo_logo_mode', nextMode);
      }
      return nextMode;
    });
  }, []);

  if (mode === 'legacy') {
    return <LogoRevealLegacy onComplete={onComplete} onToggleMode={handleToggleMode} />;
  }

  return <LogoRevealCinematic onComplete={onComplete} onToggleMode={handleToggleMode} />;
};

export { LogoRevealCinematic } from './LogoRevealCinematic';
export { LogoRevealLegacy } from './LogoRevealLegacy';
