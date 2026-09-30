import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { NaroLogo } from './NaroLogo';

interface FooterProps {
  onReplayIntro: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onReplayIntro }) => {
  const { setCurrentView } = useAudioPlayer();

  return (
    <footer
      style={{
        padding: 'clamp(48px, 6vw, 84px) clamp(16px, 5vw, 64px) 130px',
        backgroundColor: '#06080C',
        borderTop: '1px solid rgba(244, 240, 235, 0.06)',
        position: 'relative'
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '32px'
          }}
        >
          {/* Brand info */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ marginBottom: '8px' }}>
              <NaroLogo variant="compact" showSpectrum={true} showTagline={false} />
            </div>

            <p className="font-editorial" style={{ fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--accent-cream)', margin: '0 0 10px 0' }}>
              Feel It. Make It.
            </p>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              "Don't sing the whole song. Sing the moment." Discover, listen, and sing specific sections across English, Hindi, and Telugu.
            </p>
          </div>

          {/* Experience Links */}
          <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--accent-warm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                Experience
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <a
                    href="#home"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.88rem' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Hero Listen
                  </a>
                </li>
                <li>
                  <a
                    href="#discover"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.88rem' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Made For You
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('karaoke')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--accent-cream)',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    Karaoke
                  </button>
                </li>
              </ul>
            </div>

            {/* Keyboard Shortcuts */}
            <div>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--accent-warm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
                Shortcuts
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <li><kbd style={{ background: 'rgba(244,240,235,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Space</kbd> Play / Pause</li>
                <li><kbd style={{ background: 'rgba(244,240,235,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + K</kbd> Search</li>
                <li><kbd style={{ background: 'rgba(244,240,235,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> Close Dialogs</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(244, 240, 235, 0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            © 2026 NARO. Crafted for intimate audio moments.
          </div>

          <button
            onClick={onReplayIntro}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '4px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cream)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Replay cinematic intro animation"
          >
            <RotateCcw size={13} />
            <span>Replay Cinematic Intro</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
