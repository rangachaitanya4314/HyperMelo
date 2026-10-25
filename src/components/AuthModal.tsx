import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Key,
  AlertCircle
} from 'lucide-react';
import { authService } from '../services/auth/authService';
import { HyperMeloLogo } from './HyperMeloLogo';

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
  const [mode, setMode] = useState<'signin' | 'signup' | 'account_help'>(
    initialMode
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setInfoMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await authService.loginWithEmail(email, password, rememberMe);
        if (onSuccess) onSuccess();
        onClose();
      } else if (mode === 'signup') {
        if (!name.trim() || name.trim().length < 2) {
          throw new Error('Please enter your full name (at least 2 characters).');
        }
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please re-enter your password.');
        }
        await authService.signup(name, email, password, rememberMe);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setInfoMsg(null);
    setIsLoading(true);

    try {
      await authService.loginWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign in failed.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HyperMelo Personal Account Authentication"
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
          maxWidth: '460px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(14, 19, 28, 0.98)',
          border: '1px solid rgba(244, 240, 235, 0.12)',
          boxShadow:
            '0 30px 90px rgba(0, 0, 0, 0.9), 0 0 50px rgba(231, 165, 141, 0.12)',
          padding: 'clamp(24px, 5vw, 36px)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle decorative peach background light */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(231, 165, 141, 0.18) 0%, transparent 70%)',
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
            height: '32px',
            background: 'rgba(244, 240, 235, 0.05)',
            border: '1px solid rgba(244, 240, 235, 0.1)',
            borderRadius: '50%',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={16} />
        </button>

        {/* HyperMelo Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '10px'
            }}
          >
            <HyperMeloLogo
              variant="header"
              showTagline={true}
              style={{
                height: '38px',
                maxWidth: '100%',
                filter: 'drop-shadow(0 2px 14px rgba(231, 165, 141, 0.28))'
              }}
            />
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '6px 0 4px',
              letterSpacing: '-0.01em'
            }}
          >
            {mode === 'signin' && 'Welcome to HyperMelo'}
            {mode === 'signup' && 'Create Your HyperMelo Account'}
            {mode === 'account_help' && 'Account & Password Help'}
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.4
            }}
          >
            {mode === 'signin' &&
              'Sign in to sync your Liked Songs, Playlists, and moments.'}
            {mode === 'signup' &&
              'Unlock personalized recommendations, local library, and studio takes.'}
            {mode === 'account_help' &&
              'Understanding local-first profile recovery & device library access.'}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Create Account) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div
            style={{
              display: 'flex',
              padding: '4px',
              background: 'rgba(244, 240, 235, 0.04)',
              borderRadius: 'var(--radius-full)',
              marginBottom: '20px',
              border: '1px solid rgba(244, 240, 235, 0.08)'
            }}
          >
            <button
              type="button"
              id="tab-signin-btn"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
                setInfoMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background:
                  mode === 'signin'
                    ? 'rgba(231, 165, 141, 0.24)'
                    : 'transparent',
                color:
                  mode === 'signin' ? 'var(--accent-cream)' : 'var(--text-muted)',
                border:
                  mode === 'signin'
                    ? '1px solid var(--border-warm)'
                    : '1px solid transparent',
                fontWeight: mode === 'signin' ? 600 : 400,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow:
                  mode === 'signin'
                    ? '0 0 14px rgba(231, 165, 141, 0.16)'
                    : 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-signup-btn"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
                setInfoMsg(null);
              }}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background:
                  mode === 'signup'
                    ? 'rgba(231, 165, 141, 0.24)'
                    : 'transparent',
                color:
                  mode === 'signup' ? 'var(--accent-cream)' : 'var(--text-muted)',
                border:
                  mode === 'signup'
                    ? '1px solid var(--border-warm)'
                    : '1px solid transparent',
                fontWeight: mode === 'signup' ? 600 : 400,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow:
                  mode === 'signup'
                    ? '0 0 14px rgba(231, 165, 141, 0.16)'
                    : 'none'
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div
            id="auth-error-banner"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '0.84rem',
              marginBottom: '16px',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            id="auth-success-banner"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6EE7B7',
              fontSize: '0.84rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(231, 165, 141, 0.12)',
              border: '1px solid rgba(231, 165, 141, 0.3)',
              color: 'var(--accent-cream)',
              fontSize: '0.84rem',
              marginBottom: '16px',
              lineHeight: 1.4
            }}
          >
            {infoMsg}
          </div>
        )}

        {/* Form Inputs or Account Help Advisory */}
        {mode === 'account_help' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'rgba(231, 165, 141, 0.08)',
                border: '1px solid rgba(231, 165, 141, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={18} color="var(--accent-warm)" />
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.94rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}
                >
                  Local Device Storage Architecture
                </h3>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.84rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5
                }}
              >
                HyperMelo currently operates in a local-first architecture on your browser with Web Crypto
                PBKDF2 hashing. Because there is no external email delivery server configured,
                automated password-reset emails cannot be sent.
              </p>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                border: '1px solid rgba(244, 240, 235, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--accent-cream)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Available Recovery Options
              </span>

              <ul
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.83rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.45
                }}
              >
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>Remember your password?</strong>{' '}
                  Return to the Sign In screen and try your password again.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>Continue as Guest:</strong>{' '}
                  You can browse, stream music, search charts, and view synchronized lyrics without signing in.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>Create a New Profile:</strong>{' '}
                  You can create a new local account with a different email. Your device-stored playlists, liked songs, and downloaded tracks are preserved.
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                id="back-to-signin-btn"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setInfoMsg(null);
                }}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-warm)',
                  color: '#080B10',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(231, 165, 141, 0.28)'
                }}
              >
                <span>Back to Sign In</span>
                <ArrowRight size={16} color="#080B10" />
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                Continue listening as Guest
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Full Name (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '6px'
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <UserIcon
                    size={16}
                    color="var(--text-dim)"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  />
                  <input
                    type="text"
                    required
                    id="signup-name-input"
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
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  marginBottom: '6px'
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="var(--text-dim)"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
                <input
                  type="email"
                  required
                  id="auth-email-input"
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
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}
              >
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('account_help');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setInfoMsg(null);
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
                <Lock
                  size={16}
                  color="var(--text-dim)"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  id="auth-password-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(244, 240, 235, 0.05)',
                    border: '1px solid rgba(244, 240, 235, 0.12)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '6px'
                  }}
                >
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    color="var(--text-dim)"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    id="signup-confirm-password-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 38px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(244, 240, 235, 0.05)',
                      border: '1px solid rgba(244, 240, 235, 0.12)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Remember Me Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                marginTop: '2px'
              }}
            >
              <input
                type="checkbox"
                id="remember-me-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--accent-warm)' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Remember me on this browser
              </span>
            </label>

            {/* Submit CTA Button */}
            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.92rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginTop: '6px',
                justifyContent: 'center',
                backgroundColor: 'var(--accent-warm)',
                color: '#080B10',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(231, 165, 141, 0.28)'
              }}
            >
              <span>
                {isLoading
                  ? 'Processing...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
              </span>
              {!isLoading && <ArrowRight size={16} color="#080B10" />}
            </button>
          </form>
        )}

        {/* Social Authentication: Google Only (Apple Removed) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px'
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: 'rgba(244, 240, 235, 0.08)'
                }}
              />
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-dim)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}
              >
                or continue with
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: 'rgba(244, 240, 235, 0.08)'
                }}
              />
            </div>

            {/* Rebalanced Single Google OAuth Button (Full Width, Centered) */}
            <button
              type="button"
              id="google-auth-btn"
              onClick={handleGoogle}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '11px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                border: '1px solid rgba(244, 240, 235, 0.12)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(231, 165, 141, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(244, 240, 235, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(244, 240, 235, 0.12)';
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                style={{ flexShrink: 0 }}
              >
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
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Guest Reassurance Footer */}
        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <button
            type="button"
            id="continue-guest-btn"
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
