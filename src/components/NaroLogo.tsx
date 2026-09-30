import React from 'react';
import { MulticolorSpectrum } from './MulticolorSpectrum';

export interface NaroLogoProps {
  variant?: 'header' | 'hero' | 'splash' | 'player' | 'compact';
  showTagline?: boolean;
  showSpectrum?: boolean;
  isPlaying?: boolean;
  color?: string;
  taglineColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * NARO Brand Identity Wordmark
 *
 * Combines an expressive, calligraphic script typography with a subtle
 * multicolor spectrum flourish to create a memorable, artistic, and
 * human music brand identity.
 */
export const NaroLogo: React.FC<NaroLogoProps> = ({
  variant = 'header',
  showTagline = false,
  showSpectrum = true,
  isPlaying = false,
  color,
  taglineColor,
  className = '',
  style = {},
  onClick
}) => {
  // Variant sizing configurations
  const config = {
    header: {
      fontSize: 'clamp(1.6rem, 2.2vw, 1.95rem)',
      spectrumHeight: 12,
      spectrumBars: 5,
      taglineSize: '0.62rem',
      gap: '8px',
      svgWidth: 108,
      svgHeight: 38
    },
    hero: {
      fontSize: 'clamp(2.8rem, 5vw, 4.2rem)',
      spectrumHeight: 18,
      spectrumBars: 7,
      taglineSize: '0.8rem',
      gap: '12px',
      svgWidth: 160,
      svgHeight: 56
    },
    splash: {
      fontSize: 'clamp(3.4rem, 7vw, 5.2rem)',
      spectrumHeight: 22,
      spectrumBars: 9,
      taglineSize: '0.9rem',
      gap: '16px',
      svgWidth: 200,
      svgHeight: 70
    },
    player: {
      fontSize: '1.25rem',
      spectrumHeight: 10,
      spectrumBars: 4,
      taglineSize: '0.52rem',
      gap: '6px',
      svgWidth: 80,
      svgHeight: 28
    },
    compact: {
      fontSize: '1.4rem',
      spectrumHeight: 10,
      spectrumBars: 4,
      taglineSize: '0.56rem',
      gap: '6px',
      svgWidth: 92,
      svgHeight: 32
    }
  }[variant];

  const primaryColor = color || 'var(--text-primary)';
  const secondaryColor = taglineColor || 'var(--accent-warm)';

  const content = (
    <div
      className={`naro-wordmark-container ${className}`}
      role="img"
      aria-label="NARO — Feel It. Make It."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: config.gap,
        userSelect: 'none',
        textDecoration: 'none',
        ...style
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* Main Typographic Script Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', position: 'relative' }}>
          <span
            className="naro-calligraphic-text"
            style={{
              fontFamily: 'var(--font-brand), "Alex Brush", cursive, serif',
              fontSize: config.fontSize,
              lineHeight: 1,
              color: primaryColor,
              fontWeight: 400,
              letterSpacing: '0.04em',
              display: 'inline-block',
              textShadow: isPlaying ? '0 0 24px rgba(231, 165, 141, 0.35)' : 'none',
              transition: 'text-shadow 0.3s ease, color 0.2s ease',
              paddingRight: '4px'
            }}
          >
            Naro
          </span>

          {/* Subtle Multicolor Spectrum Accent / Wave */}
          {showSpectrum && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'flex-end',
                height: `${config.spectrumHeight}px`,
                paddingBottom: '2px',
                opacity: 0.85
              }}
            >
              <MulticolorSpectrum
                isPlaying={isPlaying}
                barCount={config.spectrumBars}
                height={config.spectrumHeight}
                barWidth={variant === 'hero' || variant === 'splash' ? 3 : 2}
                gap={variant === 'hero' || variant === 'splash' ? 2.5 : 1.8}
              />
            </div>
          )}
        </div>

        {/* Tagline */}
        {showTagline && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: config.taglineSize,
              letterSpacing: '0.18em',
              color: secondaryColor,
              textTransform: 'uppercase',
              fontWeight: 500,
              marginTop: '1px',
              opacity: 0.95
            }}
          >
            Feel It. Make It.
          </span>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="NARO Home"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        {content}
      </button>
    );
  }

  return content;
};
