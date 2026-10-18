import React from 'react';
import { Download, Music, HardDrive, Trash2 } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from '../components/AbstractArtwork';

export const DownloadsPage: React.FC = () => {
  const { savedTakes, downloadTake, deleteTakeFromLibrary } = useAudioPlayer();

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 64px) 120px',
        width: '100%'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--accent-warm)',
              textTransform: 'uppercase'
            }}
          >
            OFFLINE STORAGE
          </span>
          <span
            style={{
              width: '32px',
              height: '1px',
              backgroundColor: 'rgba(231, 165, 141, 0.3)'
            }}
          />
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 3.8vw, 3.2rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0
          }}
        >
          DOWNLOADS
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1rem',
            marginTop: '8px',
            maxWidth: '560px'
          }}
        >
          Saved music and your exported vocal recordings.
        </p>
      </div>

      {savedTakes.length === 0 ? (
        <div
          style={{
            padding: '72px 24px',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'rgba(244, 240, 235, 0.02)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 240, 235, 0.05)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <HardDrive size={28} />
          </div>

          <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
            Nothing downloaded yet.
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', margin: 0, maxWidth: '420px' }}>
            Record moments in Karaoke or export your vocal takes to see your offline media files here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {savedTakes.map((take) => {
            const cleanTitle = (take.songTitle || 'Take').replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanSection = (take.section || 'Moment').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `NARO_${cleanTitle}_${cleanSection}_${take.language}.webm`;

            return (
              <div
                key={take.id}
                className="glass-panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(14, 18, 27, 0.8)',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    {take.artwork ? (
                      <AbstractArtwork artwork={take.artwork} title={take.songTitle} artist={take.artist} trackId={take.songId} size={44} />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#1F2937',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Music size={20} color="var(--accent-warm)" />
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {filename}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {take.songTitle} • {take.artist} ({take.sectionLabel}) • {take.duration}s
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <button
                    onClick={() => downloadTake(take)}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    <Download size={14} />
                    <span>Download File</span>
                  </button>

                  <button
                    onClick={() => deleteTakeFromLibrary(take.id)}
                    className="btn-icon"
                    style={{ width: '36px', height: '36px', color: '#F87171' }}
                    title="Remove from downloads"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
