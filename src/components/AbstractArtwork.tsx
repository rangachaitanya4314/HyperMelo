import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ArtworkStyle } from '../types/music';
import { getVerifiedSongArtwork } from '../data/verifiedArtwork';

export interface AbstractArtworkProps {
  artwork?: ArtworkStyle | null;
  size?: number | string;
  isVinyl?: boolean;
  isPlaying?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  artist?: string;
  trackId?: string;
  song?: { id?: string; title?: string; artist?: string; artwork?: ArtworkStyle | null } | null;
  alt?: string;
}

export const AbstractArtwork: React.FC<AbstractArtworkProps> = ({
  artwork,
  size = '100%',
  isVinyl = false,
  isPlaying = false,
  className = '',
  style = {},
  title,
  artist,
  trackId,
  song,
  alt
}) => {
  const effectiveId = trackId || song?.id;
  const effectiveTitle = title || song?.title;
  const effectiveArtist = artist || song?.artist;

  // Inspect raw imageUrl and filter out any synthetic placeholder patterns
  const rawUrl = artwork?.imageUrl || song?.artwork?.imageUrl;
  const isDummy =
    !!rawUrl &&
    (rawUrl.includes('/xx/yy/zz') ||
      rawUrl.includes('/aa/bb/cc') ||
      rawUrl.includes('/11/22/33') ||
      rawUrl.includes('/44/55/66') ||
      rawUrl.includes('/77/88/99') ||
      rawUrl.includes('/dd/ee/ff') ||
      rawUrl.includes('/00/11/22') ||
      rawUrl.includes('/33/44/55') ||
      rawUrl.includes('/66/77/88') ||
      rawUrl.includes('/99/00/11') ||
      rawUrl.includes('/22/33/44') ||
      rawUrl.includes('/55/66/77') ||
      rawUrl.includes('/88/99/00') ||
      rawUrl.includes('placeholder'));
  const validProvidedUrl = isDummy ? undefined : rawUrl;

  // Resolve genuine artwork URL: provided valid URL or lookup in authoritative registry
  const resolvedUrl = useMemo(() => {
    return (
      validProvidedUrl ||
      getVerifiedSongArtwork({
        id: effectiveId,
        title: effectiveTitle,
        artist: effectiveArtist
      })
    );
  }, [validProvidedUrl, effectiveId, effectiveTitle, effectiveArtist]);

  const [imageError, setImageError] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // When the resolved image URL or track identity changes, reset image state immediately
  // Also check if the image was already cached by the browser
  useEffect(() => {
    setImageError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [resolvedUrl, effectiveId]);

  const initialChar = (effectiveTitle || 'H').charAt(0).toUpperCase();

  // 1. Standard Album Art Presentation (Non-vinyl, with verified valid cover)
  if (resolvedUrl && !isVinyl && !imageError) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          aspectRatio: '1 / 1',
          borderRadius: '14px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#090D14',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          ...style
        }}
      >
        {/* Shimmer skeleton while high-res artwork loads */}
        {!isLoaded && (
          <div
            className="artwork-shimmer-bg"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              borderRadius: 'inherit'
            }}
          />
        )}

        <img
          ref={imgRef}
          key={resolvedUrl}
          src={resolvedUrl}
          alt={alt || `${effectiveTitle || 'Track'} album artwork`}
          loading="eager"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.25s ease, transform 0.3s ease'
          }}
        />

        {/* Subtle luxury edge vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 16px rgba(0,0,0,0.35)',
            pointerEvents: 'none'
          }}
        />
      </div>
    );
  }

  // 2. Vinyl Presentation (for spinning discs, player views, and turntable widgets)
  if (isVinyl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#080B10',
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.8), inset 0 0 12px rgba(0, 0, 0, 0.9)',
          ...style
        }}
      >
        <svg
          viewBox="0 0 400 400"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            animation: isPlaying ? 'discSpin 18s linear infinite' : 'none'
          }}
        >
          <defs>
            <radialGradient id="vinyl-groove-reflect" cx="50%" cy="50%" r="50%">
              <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#000000" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.65" />
            </radialGradient>
          </defs>

          {/* Vinyl base disc */}
          <rect width="400" height="400" fill="#0A0E15" />

          {/* Concentric vinyl groove rings */}
          <circle cx="200" cy="200" r="195" fill="none" stroke="#000000" strokeWidth="6" opacity="0.9" />
          {[60, 75, 90, 105, 120, 135, 150, 165, 180].map((rad) => (
            <circle
              key={rad}
              cx="200"
              cy="200"
              r={rad}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="0.8"
            />
          ))}

          {/* Center Label Area */}
          <circle cx="200" cy="200" r="58" fill="#111622" stroke="var(--accent-warm, #E7A58D)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="52" fill="none" stroke="rgba(244, 240, 235, 0.15)" strokeWidth="0.8" strokeDasharray="3 3" />

          {/* Center artwork thumbnail or HyperMelo typography */}
          {resolvedUrl && !imageError ? (
            <clipPath id="vinyl-art-clip">
              <circle cx="200" cy="200" r="50" />
            </clipPath>
          ) : null}

          {resolvedUrl && !imageError ? (
            <image
              href={resolvedUrl}
              x="150"
              y="150"
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#vinyl-art-clip)"
            />
          ) : (
            <g>
              <circle cx="200" cy="200" r="12" fill="#080B10" stroke="var(--accent-cream, #F4DFC9)" strokeWidth="1.2" />
              <text
                x="200"
                y="178"
                textAnchor="middle"
                fill="var(--accent-cream, #F4DFC9)"
                fontSize="9"
                fontWeight="700"
                letterSpacing="0.22em"
                style={{ fontFamily: 'var(--font-sans, system-ui)' }}
              >
                HYPERMELO
              </text>
              <text
                x="200"
                y="226"
                textAnchor="middle"
                fill="var(--accent-warm, #E7A58D)"
                fontSize="7"
                fontStyle="italic"
                letterSpacing="0.08em"
              >
                mastered
              </text>
            </g>
          )}

          {/* Center Spindle Hole */}
          <circle cx="200" cy="200" r="8" fill="#05070A" stroke="rgba(244, 240, 235, 0.4)" strokeWidth="0.8" />

          {/* Vinyl reflection gloss overlay */}
          <circle cx="200" cy="200" r="195" fill="url(#vinyl-groove-reflect)" pointerEvents="none" />
        </svg>
      </div>
    );
  }

  // 3. Deliberate, High-Quality Branded Fallback (When no verified artwork is available)
  // Transparently communicates HyperMelo brand identity rather than pretending to be genuine art
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#090D14',
        background: 'linear-gradient(145deg, #0D121D 0%, #080B10 60%, #120B16 100%)',
        border: '1px solid rgba(231, 165, 141, 0.15)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <svg
        viewBox="0 0 200 200"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      >
        <defs>
          <radialGradient id={`hm-fallback-glow-${initialChar}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D43CFF" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#E7A58D" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#090D14" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient atmospheric glow */}
        <circle cx="100" cy="100" r="90" fill={`url(#hm-fallback-glow-${initialChar})`} />

        {/* Subtle geometric orbit rings */}
        <circle cx="100" cy="100" r="68" stroke="rgba(231, 165, 141, 0.12)" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="46" stroke="rgba(212, 60, 255, 0.2)" strokeWidth="1" strokeDasharray="3 4" fill="none" />

        {/* Central luxury emblem with track initial */}
        <circle cx="100" cy="94" r="28" fill="rgba(19, 25, 38, 0.85)" stroke="rgba(231, 165, 141, 0.35)" strokeWidth="1.2" />
        <text
          x="100"
          y="103"
          textAnchor="middle"
          fill="var(--accent-cream, #F4DFC9)"
          fontSize="22"
          fontWeight="700"
          letterSpacing="-0.02em"
          style={{ fontFamily: 'var(--font-sans, system-ui)' }}
        >
          {initialChar}
        </text>

        {/* Brand signature mark: Deliberate HyperMelo Catalog Reserve */}
        <text
          x="100"
          y="158"
          textAnchor="middle"
          fill="rgba(231, 165, 141, 0.55)"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="0.22em"
          style={{ fontFamily: 'var(--font-sans, system-ui)' }}
        >
          HYPERMELO AUDIO
        </text>
      </svg>
    </div>
  );
};
