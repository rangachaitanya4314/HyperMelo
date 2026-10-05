import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, CheckCircle, ArrowRight } from 'lucide-react';
import { authService } from '../services/auth/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await authService.loginWithEmail(email, password, rememberMe);
        if (onSuccess) onSuccess();
        onClose();
      } else if (mode === 'signup') {
        if (password && confirmPassword && password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await authService.signup(name, email, password, rememberMe);
        if (onSuccess) onSuccess();
        onClose();
      } else if (mode === 'forgot') {
        if (!email || !email.includes('@')) {
          throw new Error('Please enter a valid email address.');
        }
        setSuccessMsg(`Password reset link sent to ${email}. Check your inbox.`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setIsLoading(true);
      await authService.loginWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      setIsLoading(true);
      await authService.loginWithApple();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Apple sign in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NARO Personal Account Authentication"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 1650,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(14, 19, 28, 0.98)',
          border: '1px solid rgba(244, 240, 235, 0.1)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9), 0 0 50px rgba(231, 165, 141, 0.12)',
          padding: ' clamp(24px, 5vw, 36px)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle decorative background light */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(231, 165, 141, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none'
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="btn-icon"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '32px',
            height: '32px'
          }}
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span
            style={{
              fontFamily: '"Alex Brush", cursive, sans-serif',
              fontSize: '2.4rem',
              color: 'var(--accent-cream)',
              display: 'inline-block',
              lineHeight: 1
            }}
          >
            Naro
          </span>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '8px 0 4px',
              letterSpacing: '-0.01em'
            }}
          >
            {mode === 'signin' && 'Welcome to Your Music Space'}
            {mode === 'signup' && 'Create Your NARO Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            {mode === 'signin' && 'Sign in to sync your Liked Songs, Playlists and takes.'}
            {mode === 'signup' && 'Unlock personalized recommendations and permanent cloud storage.'}
            {mode === 'forgot' && 'Enter your account email to receive a recovery link.'}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Sign Up) */}
        {mode !== 'forgot' && (
          <div
            style={{
              display: 'flex',
              padding: '4px',
              background: 'rgba(244, 240, 235, 0.04)',
              borderRadius: 'var(--radius-full)',
              marginBottom: '22px',
              border: '1px solid rgba(244, 240, 235, 0.06)'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background: mode === 'signin' ? 'rgba(231, 165, 141, 0.22)' : 'transparent',
                color: mode === 'signin' ? 'var(--accent-cream)' : 'var(--text-muted)',
                border: mode === 'signin' ? '1px solid var(--border-warm)' : 'none',
                fontWeight: mode === 'signin' ? 600 : 400,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background: mode === 'signup' ? 'rgba(231, 165, 141, 0.22)' : 'transparent',
                color: mode === 'signup' ? 'var(--accent-cream)' : 'var(--text-muted)',
                border: mode === 'signup' ? '1px solid var(--border-warm)' : 'none',
                fontWeight: mode === 'signup' ? 600 : 400,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '0.84rem',
              marginBottom: '18px',
              lineHeight: 1.4
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6EE7B7',
              fontSize: '0.84rem',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(244, 240, 235, 0.05)',
                    border: '1px solid rgba(244, 240, 235, 0.12)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(244, 240, 235, 0.05)',
                  border: '1px solid rgba(244, 240, 235, 0.12)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-warm)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(244, 240, 235, 0.05)',
                    border: '1px solid rgba(244, 240, 235, 0.12)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(244, 240, 235, 0.05)',
                    border: '1px solid rgba(244, 240, 235, 0.12)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          {mode === 'signin' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '2px' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--accent-warm)' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Remember me on this browser</span>
            </label>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.92rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginTop: '8px',
              justifyContent: 'center'
            }}
          >
            <span>{isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}</span>
            {!isLoading && <ArrowRight size={16} color="#080B10" />}
          </button>
        </form>

        {mode === 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-warm)',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Social Authentication */}
        {mode !== 'forgot' && (
          <div style={{ marginTop: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(244, 240, 235, 0.08)' }} />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                or continue with
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(244, 240, 235, 0.08)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(244, 240, 235, 0.04)',
                  border: '1px solid rgba(244, 240, 235, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-1.9.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={handleApple}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(244, 240, 235, 0.04)',
                  border: '1px solid rgba(244, 240, 235, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 170 170" fill="currentColor">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.69-7.79-11.97-14.24-6.42-9.8-11.48-20.73-15.17-32.8-3.69-12.06-5.54-23.36-5.54-33.89 0-14.12 3.69-25.75 11.07-34.88 7.38-9.13 16.5-13.79 27.35-13.98 5.76 0 11.66 1.48 17.69 4.45 6.03 2.97 10.02 4.48 11.98 4.54 1.74 0 5.86-1.54 12.37-4.61 6.51-3.07 12.44-4.52 17.79-4.35 12.94.62 23.3 5.48 31.09 14.58-11.3 6.84-16.85 16.14-16.63 27.89.22 9.13 3.75 16.89 10.6 23.27 6.85 6.38 14.99 10.05 24.42 11.02-2.17 6.95-4.88 13.94-8.13 20.97zM119.22 33.39c0-7.39 2.66-14.28 7.97-20.67 5.31-6.39 11.91-10.42 19.8-12.08.33 1.52.5 3.11.5 4.77 0 7.39-2.88 14.49-8.63 21.31-5.75 6.82-12.59 10.87-20.52 12.15-.33-1.63-.5-3.32-.5-5.08z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>
          </div>
        )}

        {/* Guest reassurance footer */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Continue as Guest without signing in
          </button>
        </div>
      </div>
    </div>
  );
};
