import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Music, ShieldCheck, Key, LogIn, LogOut } from 'lucide-react';
import { appleMusicKitService } from '../services/providers/appleMusicKitService';

interface AccountConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorizedChange?: () => void;
}

export const AccountConnectionModal: React.FC<AccountConnectionModalProps> = ({
  isOpen,
  onClose,
  onAuthorizedChange
}) => {
  const [appleAuth, setAppleAuth] = useState(appleMusicKitService.isAuthorized());
  const [devToken, setDevToken] = useState(appleMusicKitService.getDeveloperToken() || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAppleAuth(appleMusicKitService.isAuthorized());
      setDevToken(appleMusicKitService.getDeveloperToken() || '');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectAppleMusic = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      if (devToken.trim()) {
        appleMusicKitService.setDeveloperToken(devToken.trim());
      }
      const success = await appleMusicKitService.authorize();
      if (success) {
        setAppleAuth(true);
        if (onAuthorizedChange) onAuthorizedChange();
      } else {
        setErrorMsg('Apple Music authorization could not be completed. Check developer token or subscription.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authorization failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await appleMusicKitService.unauthorize();
    setAppleAuth(false);
    if (onAuthorizedChange) onAuthorizedChange();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect Music Account"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 1600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(231, 165, 141, 0.15)',
          border: '1px solid var(--border-medium)',
          backgroundColor: 'rgba(12, 16, 26, 0.98)',
          padding: '28px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(231, 165, 141, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-warm)'
              }}
            >
              <Music size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Music Accounts
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Connect your music account to listen to full songs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* NARO Catalog Status */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(244, 240, 235, 0.03)',
            border: '1px solid rgba(244, 240, 235, 0.08)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                NARO Licensed Catalog
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: 'var(--accent-cool)',
                  backgroundColor: 'rgba(143, 168, 200, 0.15)',
                  border: '1px solid rgba(143, 168, 200, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 8px'
                }}
              >
                FULL SONGS INCLUDED
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              High-fidelity studio tracks with native vocal suppression & synchronized multi-language lyrics.
            </p>
          </div>
          <CheckCircle size={20} color="var(--accent-cool)" style={{ flexShrink: 0 }} />
        </div>

        {/* Apple Music Provider */}
        <div
          style={{
            padding: '18px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: appleAuth ? 'rgba(143, 168, 200, 0.06)' : 'rgba(231, 165, 141, 0.06)',
            border: appleAuth ? '1px solid rgba(143, 168, 200, 0.25)' : '1px solid rgba(231, 165, 141, 0.25)',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                Apple Music
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: appleAuth ? 'var(--accent-cool)' : 'var(--accent-warm)',
                  backgroundColor: appleAuth ? 'rgba(143, 168, 200, 0.15)' : 'rgba(231, 165, 141, 0.15)',
                  border: appleAuth ? '1px solid rgba(143, 168, 200, 0.3)' : '1px solid rgba(231, 165, 141, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 8px'
                }}
              >
                {appleAuth ? 'AUTHORIZED' : 'PREVIEW MODE (30s)'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '0 0 12px' }}>
            {appleAuth
              ? 'Authorized for full-length playback via official Apple MusicKit on the Web.'
              : 'Connect an active Apple Music subscription to stream full songs instead of 30-second previews.'}
          </p>

          {!appleAuth ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label
                  htmlFor="apple-music-dev-token"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px'
                  }}
                >
                  <Key size={12} />
                  Apple Developer Token (JWT)
                </label>
                <input
                  id="apple-music-dev-token"
                  type="password"
                  placeholder="Paste Apple Music developer token..."
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    backgroundColor: 'rgba(8, 11, 16, 0.8)',
                    border: '1px solid rgba(244, 240, 235, 0.12)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ fontSize: '0.76rem', color: '#ff6b6b' }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleConnectAppleMusic}
                disabled={isConnecting}
                className="btn-primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <LogIn size={15} />
                <span>{isConnecting ? 'Authorizing with Apple...' : 'Connect Apple Music Account'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleDisconnect}
              className="btn-secondary"
              style={{
                padding: '8px 16px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <LogOut size={14} />
              <span>Disconnect Apple Music</span>
            </button>
          )}
        </div>

        {/* Technical/Legal Compliance Notice */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '0 4px' }}>
          <ShieldCheck size={16} color="var(--accent-cream)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
            NARO streams legitimate full songs exclusively through official provider authorization
            (Apple MusicKit JS) and NARO licensed master audio. We never rip, extract, or bypass DRM.
          </p>
        </div>
      </div>
    </div>
  );
};
