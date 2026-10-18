import React from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { BeatSyncedVisualizer } from './BeatSyncedVisualizer';
import { SUPPORTED_LANGUAGES } from '../types/music';

export const Hero: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    activeLanguage,
    setActiveLanguage,
    setDisplayLanguage
  } = useAudioPlayer();

  return (
    <section
      id="home"
      aria-label="HyperMelo Hero"
      style={{
        position: 'relative',
        minHeight: '84vh',
        display: 'flex',
        alignItems: 'center',
        padding: ' clamp(32px, 6vw, 80px) clamp(16px, 5vw, 64px) clamp(48px, 8vw, 100px)',
        overflow: 'hidden'
      }}
    >
      {/* Background atmospheric ambient gradients */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-15%',
          right: '5%',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(231, 165, 141, 0.12) 0%, rgba(143, 168, 200, 0.05) 50%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '10%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29, 37, 56, 0.6) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
          gap: 'clamp(32px, 6vw, 72px)',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}
        className="hero-grid"
      >
        {/* Left Column: Editorial Headline & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                color: 'var(--accent-warm)',
                textTransform: 'uppercase'
              }}
            >
              YOUR NEXT LISTEN
            </span>
            <span
              style={{
                width: '40px',
                height: '1px',
                backgroundColor: 'rgba(231, 165, 141, 0.3)'
              }}
            />
          </div>

          {/* Hero headline */}
          <h1
            style={{
              fontSize: 'clamp(2.6rem, 5.2vw, 4.4rem)',
              lineHeight: 1.08,
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              margin: 0
            }}
          >
            Feel the song.
            <br />
            <span className="serif-italic" style={{ color: 'var(--accent-cream)', fontWeight: 400 }}>
              Make it yours.
            </span>
          </h1>

          {/* Supporting copy */}
          <p
            style={{
              fontSize: 'clamp(1rem, 1.25vw, 1.2rem)',
              lineHeight: 1.55,
              color: 'var(--text-muted)',
              maxWidth: '520px',
              fontWeight: 400,
              margin: 0
            }}
          >
            Listen in your language. Choose any part. Sing it your way.
          </p>

          {/* Language Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Lyrics in:
            </span>
            <div
              className="glass-pill"
              role="radiogroup"
              aria-label="Lyric language selection"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px',
                gap: '2px'
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = activeLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setActiveLanguage(lang.code);
                      setDisplayLanguage(lang.code);
                    }}
                    style={{
                      background: isSelected ? 'rgba(231, 165, 141, 0.22)' : 'transparent',
                      color: isSelected ? 'var(--accent-cream)' : 'var(--text-muted)',
                      border: isSelected ? '1px solid var(--border-warm)' : '1px solid transparent',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title={lang.nativeLabel}
                  >
                    {lang.code === 'en' ? 'EN' : lang.nativeLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA Buttons: Primary PLAY NOW, Secondary KARAOKE READY */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '16px',
              marginTop: '8px'
            }}
          >
            <button
              onClick={togglePlay}
              className="btn-primary"
              aria-label={isPlaying ? 'Pause song' : 'Play now'}
              style={{
                letterSpacing: '0.06em',
                fontWeight: 600,
                fontSize: '0.92rem'
              }}
            >
              {isPlaying ? <Pause size={18} fill="#080B10" /> : <Play size={18} fill="#080B10" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY NOW'}</span>
            </button>
          </div>

          {/* Now playing indicator preview */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '12px',
              padding: '10px 16px',
              background: 'rgba(244, 240, 235, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(244, 240, 235, 0.06)',
              maxWidth: '420px'
            }}
          >
            <Sparkles size={16} color="var(--accent-warm)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>
                {currentSong ? (
                  <>
                    Featured:{' '}
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {currentSong.title}
                    </strong>{' '}
                    — {currentSong.artist}
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      HyperMelo Experience
                    </strong>{' '}
                    — Select a track to listen
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Abstract Album / Vinyl Object with Floating Lyric Fragments */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '440px'
          }}
          className="hero-art-container"
        >
          {/* Subtle warm glow aura behind record */}
          <div
            className="animate-glow"
            style={{
              position: 'absolute',
              width: '380px',
              height: '380px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(231, 165, 141, 0.28) 0%, rgba(143, 168, 200, 0.15) 50%, transparent 75%)',
              filter: 'blur(35px)',
              pointerEvents: 'none'
            }}
          />

          {/* Beat-Synced Circular Audiophile Visualizer with Timeline-Driven Floating Lyrics */}
          <div
            style={{
              width: 'clamp(300px, 36vw, 420px)',
              height: 'clamp(300px, 36vw, 420px)',
              position: 'relative',
              zIndex: 2,
              filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.75))'
            }}
          >
            <BeatSyncedVisualizer
              artwork={currentSong?.artwork}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              interactive={true}
              mode="hero"
              songTitle={currentSong?.title ?? 'HyperMelo'}
              songArtist={currentSong?.artist ?? 'Audiophile Music Experience'}
              size="100%"
            />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: left;
            gap: 40px !important;
          }
          .hero-art-container {
            min-height: 340px !important;
          }
        }
      `}</style>
    </section>
  );
};
