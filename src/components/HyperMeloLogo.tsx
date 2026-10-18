import React from 'react';

export interface HyperMeloLogoProps {
  variant?: 'header' | 'hero' | 'splash' | 'player' | 'compact' | 'footer' | 'symbol-only' | 'monogram-only';
  showTagline?: boolean;
  showDivider?: boolean;
  showSymbol?: boolean;
  showMonogram?: boolean; // legacy alias for showSymbol
  showSpectrum?: boolean; // legacy alias
  showWaveform?: boolean; // legacy alias
  isPlaying?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  color?: string;
  taglineColor?: string;
}

/**
 * HyperMelo Master Brand Identity — Official Vector Lockup
 *
 * Master Composition:
 * - Left: Luminous ribbon audio waveform (#FF8FB8, #FF9C9C, #D43CFF, #8B25F5, #FFC2A1)
 * - Center: Slim vertical divider with subtle pink-to-peach highlight
 * - Right: Calligraphic "HyperMelo" script wordmark (warm ivory-cream with subtle peach/pink glow)
 * - Below: "FEEL IT. MAKE IT." tagline in clean uppercase sans-serif (#E7A58D)
 *
 * All elements match the master brand reference asset 1:1 in proportions, spacing, and colors.
 */
export const HyperMeloLogo: React.FC<HyperMeloLogoProps> = ({
  variant = 'header',
  showTagline = true,
  showDivider = true,
  showSymbol = true,
  showMonogram,
  showSpectrum,
  showWaveform,
  isPlaying = false,
  className = '',
  style = {},
  onClick
}) => {
  const isSymbolOnly = variant === 'symbol-only' || variant === 'monogram-only';
  const displaySymbol = showSymbol && (showMonogram !== false) && (showWaveform !== false) && (showSpectrum !== false);

  // Variant sizing configurations
  const config = {
    header: {
      height: 'clamp(32px, 4vw, 42px)',
      symbolHeight: '36px'
    },
    footer: {
      height: 'clamp(36px, 4.2vw, 42px)',
      symbolHeight: '38px'
    },
    hero: {
      height: 'clamp(54px, 7vw, 72px)',
      symbolHeight: '56px'
    },
    splash: {
      height: 'clamp(68px, 9vw, 92px)',
      symbolHeight: '74px'
    },
    player: {
      height: '28px',
      symbolHeight: '26px'
    },
    compact: {
      height: '32px',
      symbolHeight: '30px'
    },
    'symbol-only': {
      height: '36px',
      symbolHeight: '36px'
    },
    'monogram-only': {
      height: '36px',
      symbolHeight: '36px'
    }
  }[variant];

  // If user only wants the standalone waveform symbol
  if (isSymbolOnly) {
    return (
      <div
        className={`hypermelo-symbol-container ${className}`}
        role="img"
        aria-label="HyperMelo Symbol"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          userSelect: 'none',
          cursor: onClick ? 'pointer' : 'default',
          ...style
        }}
      >
        <svg
          viewBox="60 95 345 165"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{
            height: config.symbolHeight,
            width: 'auto',
            aspectRatio: '345 / 165',
            flexShrink: 0,
            filter: isPlaying
              ? 'drop-shadow(0 0 12px rgba(212, 60, 255, 0.65)) drop-shadow(0 0 20px rgba(255, 143, 184, 0.45))'
              : 'drop-shadow(0 0 6px rgba(212, 60, 255, 0.3))',
            transition: 'filter 0.3s ease'
          }}
        >
          <image
            href="/brand/hypermelo_waveform_layer.png"
            x="0"
            y="0"
            width="1024"
            height="341"
          />
        </svg>
      </div>
    );
  }

  // Master Horizontal Lockup: Waveform + Divider + Wordmark + Tagline
  // Master image viewBox is 1024x341.
  // Tight content bounds: x: 60..970 (width=910), y: 90..260 (height=170) -> Aspect Ratio ~ 5.353
  // If tagline is hidden, bounds: x: 60..970 (width=910), y: 90..232 (height=142) -> Aspect Ratio ~ 6.408
  const viewBox = showTagline ? '60 90 910 170' : '60 90 910 142';
  const aspectRatio = showTagline ? '910 / 170' : '910 / 142';

  return (
    <div
      className={`hypermelo-brand-lockup ${className}`}
      role="img"
      aria-label="HyperMelo — FEEL IT. MAKE IT."
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
        textDecoration: 'none',
        cursor: onClick ? 'pointer' : 'default',
        maxWidth: '100%',
        ...style
      }}
    >
      <svg
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          height: (style && style.height) ? style.height : config.height,
          width: 'auto',
          aspectRatio,
          display: 'block',
          flexShrink: 0,
          filter: isPlaying
            ? 'drop-shadow(0 0 14px rgba(212, 60, 255, 0.55)) drop-shadow(0 0 24px rgba(255, 143, 184, 0.38))'
            : 'none',
          transition: 'filter 0.3s ease'
        }}
      >
        {/* Layer 1: Luminous Waveform Symbol */}
        {displaySymbol && (
          <image
            href="/brand/hypermelo_waveform_layer.png"
            x="0"
            y="0"
            width="1024"
            height="341"
          />
        )}

        {/* Layer 2: Slim Vertical Divider */}
        {showDivider && (
          <image
            href="/brand/hypermelo_divider_layer.png"
            x="0"
            y="0"
            width="1024"
            height="341"
          />
        )}

        {/* Layer 3: Calligraphic HyperMelo Script Wordmark */}
        <image
          href="/brand/hypermelo_wordmark_layer.png"
          x="0"
          y="0"
          width="1024"
          height="341"
        />

        {/* Layer 4: Clean Uppercase Sans-Serif Tagline: FEEL IT. MAKE IT. */}
        {showTagline && (
          <image
            href="/brand/hypermelo_tagline_layer.png"
            x="0"
            y="0"
            width="1024"
            height="341"
          />
        )}
      </svg>
    </div>
  );
};
