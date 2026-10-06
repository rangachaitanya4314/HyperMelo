import React, { useState, useEffect } from 'react';
import { Search, Mic, Menu, X, User, WifiOff, Library, Download, Compass, Home as HomeIcon } from 'lucide-react';
import { useAudioPlayer, type AppView } from '../context/AudioPlayerContext';
import { NaroLogo } from './NaroLogo';

export const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const {
    setSearchModalOpen,
    searchQuery,
    isPlaying,
    isOnline,
    currentView,
    setCurrentView,
    currentUser,
    isAuthenticated,
    openAuthModal,
    logout,
    nowPlayingOpen,
    closeNowPlaying
  } = useAudioPlayer();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (view: AppView) => {
    if (nowPlayingOpen) {
      closeNowPlaying();
    }
    setMobileMenuOpen(false);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          pointerEvents: nowPlayingOpen ? 'none' : 'auto',
          visibility: nowPlayingOpen ? 'hidden' : 'visible',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 4vw, 48px)',
          backgroundColor: isScrolled ? 'rgba(8, 11, 16, 0.92)' : 'rgba(8, 11, 16, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: isScrolled ? '1px solid rgba(244, 240, 235, 0.08)' : '1px solid rgba(244, 240, 235, 0.04)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Left: NARO Calligraphic Wordmark & Brand Accent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <NaroLogo
            variant="header"
            showTagline={true}
            showSpectrum={true}
            isPlaying={isPlaying}
            onClick={() => handleNavClick('home')}
          />

          {/* Desktop Navigation: Home, Discover, Karaoke, Library, Downloads */}
          <nav
            className="desktop-nav"
            aria-label="Main Navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {[
              { id: 'home' as AppView, label: 'Home' },
              { id: 'discover' as AppView, label: 'Discover' },
              { id: 'library' as AppView, label: 'Library' },
              { id: 'karaoke' as AppView, label: 'Karaoke' },
              { id: 'downloads' as AppView, label: 'Downloads' }
            ].map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    background: isActive ? 'rgba(244, 240, 235, 0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-full)',
                    color: isActive ? 'var(--accent-warm)' : 'var(--text-muted)',
                    fontSize: '0.88rem',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: '0.02em',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center/Right: Offline Badge + Search Input + Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Offline indicator banner */}
          {!isOnline && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#FCA5A5',
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
              title="You're offline. Connect to the internet to search and stream music."
            >
              <WifiOff size={14} />
              <span>You&apos;re offline</span>
            </div>
          )}

          {/* Search Trigger Bar */}
          <div
            id="header-search-bar"
            className="header-search-bar"
            onClick={() => setSearchModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSearchModalOpen(true);
              }
            }}
            aria-label="Search music, artists, lyrics"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(244, 240, 235, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '8px 16px',
              width: 'clamp(200px, 22vw, 320px)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <span
              style={{
                fontSize: '0.84rem',
                color: searchQuery ? 'var(--text-primary)' : 'var(--text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1
              }}
            >
              {searchQuery || 'Search music, artists, lyrics'}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-dim)',
                border: '1px solid rgba(244, 240, 235, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              /
            </span>
          </div>

          {/* Profile / Avatar / Auth Button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  setProfileMenuOpen((prev) => !prev);
                } else {
                  openAuthModal('signin');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: isAuthenticated ? '4px 10px 4px 6px' : '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isAuthenticated ? 'rgba(231, 165, 141, 0.15)' : 'rgba(244, 240, 235, 0.08)',
                border: isAuthenticated ? '1px solid var(--border-warm)' : '1px solid var(--border-subtle)',
                color: isAuthenticated ? 'var(--accent-cream)' : 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title={isAuthenticated ? currentUser?.name || 'Account' : 'Sign in to NARO'}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: isAuthenticated ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.12)',
                  color: isAuthenticated ? '#080B10' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                {isAuthenticated ? (currentUser?.name?.charAt(0).toUpperCase() || 'U') : <User size={15} />}
              </div>
              <span>{isAuthenticated ? currentUser?.name?.split(' ')[0] : 'Sign In'}</span>
            </button>

            {/* Authenticated User Menu Dropdown */}
            {profileMenuOpen && isAuthenticated && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '220px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(14, 19, 28, 0.98)',
                  border: '1px solid rgba(244, 240, 235, 0.1)',
                  boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(20px)',
                  padding: '12px',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid rgba(244, 240, 235, 0.08)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {currentUser?.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.email}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setCurrentView('library');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <Library size={16} color="var(--accent-warm)" />
                  <span>My Library</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    await logout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: 'none',
                    color: '#F87171',
                    fontSize: '0.84rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            className="btn-icon mobile-menu-btn"
            style={{ display: 'none' }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(8, 11, 16, 0.98)',
            backdropFilter: 'blur(25px)',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            gap: '16px'
          }}
        >
          {[
            { id: 'home' as AppView, label: 'Home', icon: HomeIcon },
            { id: 'discover' as AppView, label: 'Discover', icon: Compass },
            { id: 'library' as AppView, label: 'Library', icon: Library },
            { id: 'karaoke' as AppView, label: 'Karaoke', icon: Mic },
            { id: 'downloads' as AppView, label: 'Downloads', icon: Download }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: currentView === item.id ? 'rgba(231, 165, 141, 0.15)' : 'rgba(244, 240, 235, 0.03)',
                color: currentView === item.id ? 'var(--accent-cream)' : 'var(--text-primary)',
                border: 'none',
                fontSize: '1.05rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <item.icon size={20} color="var(--accent-warm)" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .header-search-bar {
            width: 160px !important;
          }
          .desktop-only {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};
