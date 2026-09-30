import React from 'react';
import type { ArtworkStyle } from '../types/music';

interface AbstractArtworkProps {
  artwork: ArtworkStyle;
  size?: number | string;
  isVinyl?: boolean;
  isPlaying?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AbstractArtwork: React.FC<AbstractArtworkProps> = ({
  artwork,
  size = '100%',
  isVinyl = false,
  isPlaying = false,
  className = '',
  style = {}
}) => {
  const safeArtwork: ArtworkStyle = artwork || {
    palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
    pattern: 'orbital',
    accentWarm: '#E7A58D',
    accentCool: '#8FA8C8',
    accentCream: '#F4DFC9'
  };
  const [c1, c2, c3, c4] = safeArtwork.palette || ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'];
  const cream = safeArtwork.accentCream || '#F4DFC9';

  // If real album artwork image is present and not vinyl mode:
  if (safeArtwork.imageUrl && !isVinyl) {
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
        <img
          src={artwork.imageUrl}
          alt="Album artwork"
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 0.4s ease'
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none'
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        borderRadius: isVinyl ? '50%' : '16px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#090D14',
        boxShadow: isVinyl
          ? '0 12px 35px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(0, 0, 0, 0.8)'
          : '0 8px 24px rgba(0, 0, 0, 0.45)',
        ...style
      }}
    >
      <svg
        viewBox="0 0 400 400"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          animation: isPlaying && isVinyl ? 'discSpin 18s linear infinite' : 'none'
        }}
      >
        <defs>
          <radialGradient id={`rad-${artwork.pattern}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={artwork.accentWarm} stopOpacity="0.85" />
            <stop offset="45%" stopColor={c1} stopOpacity="0.7" />
            <stop offset="80%" stopColor={c2} stopOpacity="0.4" />
            <stop offset="100%" stopColor={c3} stopOpacity="0.1" />
          </radialGradient>

          <linearGradient id={`lin-${artwork.pattern}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>

          <linearGradient id={`foil-${artwork.pattern}`} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={artwork.accentWarm} stopOpacity="0.4" />
            <stop offset="50%" stopColor={c4} stopOpacity="0.1" />
            <stop offset="100%" stopColor={artwork.accentCool} stopOpacity="0.5" />
          </linearGradient>

          {/* Vinyl groove filter */}
          <radialGradient id="vinyl-reflection" cx="50%" cy="50%" r="50%">
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* Base dark canvas */}
        <rect width="400" height="400" fill="#0A0E15" />

        {/* Dynamic geometric composition according to pattern */}
        {artwork.pattern === 'orbital' && (
          <g>
            <circle cx="200" cy="200" r="170" fill={`url(#rad-${artwork.pattern})`} />
            <circle cx="230" cy="180" r="95" fill={c1} opacity="0.6" filter="blur(20px)" />
            <ellipse cx="160" cy="230" rx="140" ry="70" fill={artwork.accentCool} opacity="0.25" transform="rotate(-25 160 230)" />
            <circle cx="200" cy="200" r="130" stroke="rgba(244, 240, 235, 0.12)" strokeWidth="1.5" fill="none" />
            <circle cx="200" cy="200" r="85" stroke="rgba(231, 165, 141, 0.28)" strokeWidth="1" strokeDasharray="4 8" fill="none" />
            <circle cx="270" cy="140" r="14" fill={artwork.accentWarm} opacity="0.9" filter="drop-shadow(0 0 10px rgba(231,165,141,0.8))" />
          </g>
        )}

        {artwork.pattern === 'geometric' && (
          <g>
            <rect width="400" height="400" fill={`url(#lin-${artwork.pattern})`} opacity="0.4" />
            <polygon points="200,40 360,320 40,320" fill="none" stroke={artwork.accentWarm} strokeWidth="1.5" opacity="0.4" />
            <polygon points="200,80 330,300 70,300" fill={`url(#rad-${artwork.pattern})`} opacity="0.75" />
            <circle cx="200" cy="220" r="70" fill={c2} opacity="0.8" />
            <circle cx="200" cy="220" r="45" fill={artwork.accentCool} opacity="0.5" filter="blur(10px)" />
            <line x1="200" y1="20" x2="200" y2="380" stroke="rgba(244, 240, 235, 0.15)" strokeWidth="1" strokeDasharray="3 6" />
          </g>
        )}

        {artwork.pattern === 'echo' && (
          <g>
            <rect width="400" height="400" fill={c3} />
            <circle cx="170" cy="200" r="140" fill={c1} opacity="0.35" filter="blur(30px)" />
            <circle cx="240" cy="180" r="110" fill={artwork.accentWarm} opacity="0.4" filter="blur(25px)" />
            {[40, 75, 110, 145, 180].map((r, i) => (
              <circle
                key={i}
                cx="200"
                cy="200"
                r={r}
                fill="none"
                stroke="rgba(244, 223, 201, 0.14)"
                strokeWidth="1.2"
                strokeDasharray={i % 2 === 0 ? '6 4' : 'none'}
              />
            ))}
            <circle cx="200" cy="200" r="32" fill={artwork.accentWarm} opacity="0.85" />
          </g>
        )}

        {artwork.pattern === 'solaris' && (
          <g>
            <rect width="400" height="400" fill="#0C0812" />
            <circle cx="200" cy="200" r="180" fill={`url(#rad-${artwork.pattern})`} opacity="0.8" />
            <circle cx="200" cy="200" r="120" fill={c1} opacity="0.5" filter="blur(16px)" />
            <path
              d="M 60 200 Q 200 80 340 200 Q 200 320 60 200 Z"
              fill="none"
              stroke="rgba(244, 240, 235, 0.25)"
              strokeWidth="1.5"
            />
            <circle cx="200" cy="200" r="48" fill={cream} opacity="0.9" filter="drop-shadow(0 0 16px rgba(244,223,201,0.8))" />
          </g>
        )}

        {/* Fine concentric vinyl grooves if in vinyl mode */}
        {isVinyl && (
          <g>
            <circle cx="200" cy="200" r="195" fill="none" stroke="#000000" strokeWidth="6" opacity="0.85" />
            {[65, 80, 95, 110, 125, 140, 155, 170, 185].map((rad) => (
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
            {/* Center Label */}
            <circle cx="200" cy="200" r="55" fill="#0D1118" stroke={artwork.accentWarm} strokeWidth="1.5" />
            <circle cx="200" cy="200" r="50" fill="none" stroke="rgba(244, 240, 235, 0.15)" strokeWidth="0.8" strokeDasharray="3 3" />
            <circle cx="200" cy="200" r="12" fill="#080B10" stroke={cream} strokeWidth="1.2" />
            <text
              x="200"
              y="180"
              textAnchor="middle"
              fill={cream}
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.2em"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              NARO
            </text>
            <text
              x="200"
              y="226"
              textAnchor="middle"
              fill={artwork.accentWarm}
              fontSize="7"
              fontStyle="italic"
              letterSpacing="0.05em"
              style={{ fontFamily: 'var(--font-editorial)' }}
            >
              mastered
            </text>
            {/* Vinyl gloss overlay */}
            <circle cx="200" cy="200" r="195" fill="url(#vinyl-reflection)" pointerEvents="none" />
          </g>
        )}
      </svg>
    </div>
  );
};
