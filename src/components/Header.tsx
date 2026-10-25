import React, { useState, useEffect } from 'react';
import { Search, Mic, Menu, X, User, WifiOff, Library, Download, Compass, Home as HomeIcon } from 'lucide-react';
import { useAudioPlayer, type AppView } from '../context/AudioPlayerContext';
import { HyperMeloLogo } from './HyperMeloLogo';

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
        className="naro-app-header"
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
          padding: '0 clamp(10px, 3.5vw, 48px)',
          backgroundColor: isScrolled ? 'rgba(8, 11, 16, 0.95)' : 'rgba(8, 11, 16, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: isScrolled ? '1px solid rgba(244, 240, 235, 0.08)' : '1px solid rgba(244, 240, 235, 0.04)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100vw'
        }}
      >
        {/* Left: HyperMelo Calligraphic Wordmark & HM Brand Crest */}
        <div className="header-left-cluster" style={{ display: 'flex', alignItems: 'center', gap: '28px', minWidth: 0, flexShrink: 0 }}>
          <button
            type="button"
            aria-label="NARO Home"
            onClick={() => handleNavClick('home')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              outline: 'none'
            }}
          >
            <HyperMeloLogo
              variant="header"
              showTagline={true}
              showSpectrum={true}
              showMonogram={true}
              isPlaying={isPlaying}
            />
          </button>

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
              const isKaraoke = item.id === 'karaoke';

              if (isKaraoke) {
                return (
                  <button
                    key={item.id}
                    id="nav-tab-karaoke-desktop"
                    data-testid="nav-tab-karaoke-desktop"
                    role="tab"
                    aria-selected={isActive}
                    aria-label="Karaoke Studio"
                    onClick={() => handleNavClick(item.id)}
                    className={`karaoke-nav-btn ${isActive ? 'karaoke-nav-btn-active' : 'karaoke-nav-btn-inactive'}`}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: '0.02em',
                      padding: '8px 18px',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(229, 195, 120, 0.22) 0%, rgba(198, 160, 82, 0.12) 100%)'
                        : 'rgba(229, 195, 120, 0.05)',
                      color: isActive ? '#FDF0CD' : '#E5C378',
                      border: isActive
                        ? '1px solid rgba(243, 216, 154, 0.65)'
                        : '1px solid rgba(229, 195, 120, 0.3)',
                      boxShadow: isActive
                        ? '0 0 16px rgba(229, 195, 120, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                        : '0 0 8px rgba(229, 195, 120, 0.06)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'rgba(243, 216, 154, 0.6)';
                        e.currentTarget.style.color = '#FDF0CD';
                        e.currentTarget.style.boxShadow = '0 0 14px rgba(229, 195, 120, 0.2)';
                        e.currentTarget.style.background = 'rgba(229, 195, 120, 0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'rgba(229, 195, 120, 0.3)';
                        e.currentTarget.style.color = '#E5C378';
                        e.currentTarget.style.boxShadow = '0 0 8px rgba(229, 195, 120, 0.06)';
                        e.currentTarget.style.background = 'rgba(229, 195, 120, 0.05)';
                      }
                    }}
                  >
                    {/* Subtle Champagne Gold Diffusion Particles behind text */}
                    <div className="karaoke-particle-layer" aria-hidden="true">
                      <span className="karaoke-particle karaoke-particle-1" />
                      <span className="karaoke-particle karaoke-particle-2" />
                      <span className="karaoke-particle karaoke-particle-3" />
                      <span className="karaoke-particle karaoke-particle-4" />
                    </div>
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Mic size={14} style={{ color: isActive ? '#F3D89A' : '#E5C378' }} />
                      {item.label}
                    </span>
                  </button>
                );
              }

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

        {/* Center/Right: Offline Badge + Search Input + Profile + Hamburger */}
        <div className="header-right-cluster" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {/* Offline indicator banner */}
          {!isOnline && (
            <div
              className="header-offline-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#FCA5A5',
                fontSize: '0.74rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}
              title="You're offline. Connect to the internet to search and stream music."
            >
              <WifiOff size={14} />
              <span className="header-offline-text">Offline</span>
            </div>
          )}

          {/* Search Trigger Bar / Button */}
          <div
            id="header-search-bar"
            data-testid="header-search-bar"
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
            title="Search music, artists, lyrics"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(244, 240, 235, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '8px 16px',
              minHeight: '44px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              touchAction: 'manipulation'
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <span
              className="header-search-text"
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
              className="header-search-shortcut"
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
          <div className="header-auth-wrapper" style={{ position: 'relative' }}>
            <button
              type="button"
              id="header-auth-btn"
              data-testid="header-auth-btn"
              onClick={() => {
                if (isAuthenticated) {
                  setProfileMenuOpen((prev) => !prev);
                } else {
                  openAuthModal('signin');
                }
              }}
              className="header-auth-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: isAuthenticated ? '4px 10px 4px 6px' : '6px 14px',
                minHeight: '44px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isAuthenticated ? 'rgba(231, 165, 141, 0.15)' : 'rgba(244, 240, 235, 0.08)',
                border: isAuthenticated ? '1px solid var(--border-warm)' : '1px solid var(--border-subtle)',
                color: isAuthenticated ? 'var(--accent-cream)' : 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                touchAction: 'manipulation'
              }}
              title={isAuthenticated ? currentUser?.name || 'Account' : 'Sign in to HyperMelo'}
              aria-label={isAuthenticated ? currentUser?.name || 'Account profile' : 'Sign In'}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isAuthenticated ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.12)',
                  color: isAuthenticated ? '#080B10' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  flexShrink: 0
                }}
              >
                {isAuthenticated ? (currentUser?.name?.charAt(0).toUpperCase() || 'U') : <User size={15} />}
              </div>
              <span className="header-auth-text">{isAuthenticated ? currentUser?.name?.split(' ')[0] : 'Sign In'}</span>
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

          {/* Mobile hamburger menu toggle — Guaranteed >= 44x44px touch target with safe margin */}
          <button
            id="mobile-hamburger-btn"
            data-testid="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            className="btn-icon mobile-menu-btn"
            style={{ display: 'none' }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation with Full Navigation & Accessible Account Section */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          data-testid="mobile-navigation-drawer"
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(8, 11, 16, 0.98)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px',
            gap: '12px',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          {/* Prominent Account / Sign In card inside mobile drawer */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(244, 240, 235, 0.05)',
              border: '1px solid rgba(244, 240, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  borderRadius: '50%',
                  backgroundColor: isAuthenticated ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.1)',
                  color: isAuthenticated ? '#080B10' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              >
                {isAuthenticated ? (currentUser?.name?.charAt(0).toUpperCase() || 'U') : <User size={18} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isAuthenticated ? currentUser?.name : 'Personal Account'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isAuthenticated ? currentUser?.email : 'Sign in for playlists & likes'}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="mobile-drawer-auth-btn"
              data-testid="mobile-drawer-auth-btn"
              onClick={async () => {
                setMobileMenuOpen(false);
                if (isAuthenticated) {
                  await logout();
                } else {
                  openAuthModal('signin');
                }
              }}
              style={{
                padding: '8px 14px',
                minHeight: '44px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isAuthenticated ? 'rgba(239, 68, 68, 0.12)' : 'var(--accent-warm)',
                color: isAuthenticated ? '#FCA5A5' : '#080B10',
                border: isAuthenticated ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                touchAction: 'manipulation',
                flexShrink: 0
              }}
            >
              {isAuthenticated ? 'Sign Out' : 'Sign In'}
            </button>
          </div>

          {/* Navigation Links */}
          {[
            { id: 'home' as AppView, label: 'Home', icon: HomeIcon },
            { id: 'discover' as AppView, label: 'Discover', icon: Compass },
            { id: 'library' as AppView, label: 'Library', icon: Library },
            { id: 'karaoke' as AppView, label: 'Karaoke', icon: Mic },
            { id: 'downloads' as AppView, label: 'Downloads', icon: Download }
          ].map((item) => {
            const isActive = currentView === item.id;
            const isKaraoke = item.id === 'karaoke';

            if (isKaraoke) {
              return (
                <button
                  key={item.id}
                  id="nav-tab-karaoke-mobile"
                  data-testid="nav-tab-karaoke-mobile"
                  role="tab"
                  aria-selected={isActive}
                  aria-label="Karaoke Studio"
                  onClick={() => handleNavClick(item.id)}
                  className={`karaoke-nav-btn ${isActive ? 'karaoke-nav-btn-active' : 'karaoke-nav-btn-inactive'}`}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '13px 16px',
                    minHeight: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(229, 195, 120, 0.24) 0%, rgba(198, 160, 82, 0.14) 100%)'
                      : 'rgba(229, 195, 120, 0.06)',
                    color: isActive ? '#FDF0CD' : '#E5C378',
                    border: isActive
                      ? '1px solid rgba(243, 216, 154, 0.7)'
                      : '1px solid rgba(229, 195, 120, 0.32)',
                    boxShadow: isActive
                      ? '0 0 16px rgba(229, 195, 120, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      : '0 0 8px rgba(229, 195, 120, 0.06)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    touchAction: 'manipulation',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Subtle Champagne Gold Diffusion Particles behind label and icon */}
                  <div className="karaoke-particle-layer" aria-hidden="true">
                    <span className="karaoke-particle karaoke-particle-1" />
                    <span className="karaoke-particle karaoke-particle-2" />
                    <span className="karaoke-particle karaoke-particle-3" />
                    <span className="karaoke-particle karaoke-particle-4" />
                  </div>
                  <item.icon size={20} color={isActive ? '#F3D89A' : '#E5C378'} style={{ position: 'relative', zIndex: 1 }} />
                  <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '13px 16px',
                  minHeight: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: currentView === item.id ? 'rgba(231, 165, 141, 0.15)' : 'rgba(244, 240, 235, 0.03)',
                  color: currentView === item.id ? 'var(--accent-cream)' : 'var(--text-primary)',
                  border: currentView === item.id ? '1px solid rgba(231, 165, 141, 0.3)' : '1px solid transparent',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  touchAction: 'manipulation',
                  transition: 'background-color 0.2s ease'
                }}
              >
                <item.icon size={20} color="var(--accent-warm)" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        /* Champagne Gold Karaoke Navigation Tab & Particle Diffusion Animation */
        .karaoke-nav-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .karaoke-nav-btn:focus-visible {
          outline: 2px solid #F3D89A !important;
          outline-offset: 2px !important;
        }

        .karaoke-particle-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: inherit;
          z-index: 0;
        }

        .karaoke-particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, #FDF0CD 0%, #E5C378 50%, rgba(229, 195, 120, 0) 100%);
          pointer-events: none;
          opacity: 0;
        }

        .karaoke-particle-1 {
          width: 4px;
          height: 4px;
          top: 25%;
          left: 18%;
          animation: hmGoldParticleDrift1 4.2s ease-in-out infinite;
        }

        .karaoke-particle-2 {
          width: 3px;
          height: 3px;
          top: 60%;
          left: 72%;
          animation: hmGoldParticleDrift2 4.8s ease-in-out infinite 0.7s;
        }

        .karaoke-particle-3 {
          width: 4px;
          height: 4px;
          top: 30%;
          left: 82%;
          animation: hmGoldParticleDrift3 5.4s ease-in-out infinite 1.4s;
        }

        .karaoke-particle-4 {
          width: 3px;
          height: 3px;
          top: 70%;
          left: 30%;
          animation: hmGoldParticleDrift4 4.6s ease-in-out infinite 2.1s;
        }

        @keyframes hmGoldParticleDrift1 {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          35% { transform: translate(-3px, -5px) scale(1.1); opacity: 0.75; }
          70% { transform: translate(-6px, -10px) scale(0.9); opacity: 0.4; }
          100% { transform: translate(-8px, -14px) scale(0.5); opacity: 0; }
        }

        @keyframes hmGoldParticleDrift2 {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          35% { transform: translate(4px, -4px) scale(1.15); opacity: 0.8; }
          70% { transform: translate(7px, -9px) scale(0.85); opacity: 0.45; }
          100% { transform: translate(10px, -13px) scale(0.5); opacity: 0; }
        }

        @keyframes hmGoldParticleDrift3 {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          35% { transform: translate(2px, -6px) scale(1.1); opacity: 0.7; }
          70% { transform: translate(4px, -11px) scale(0.9); opacity: 0.35; }
          100% { transform: translate(5px, -15px) scale(0.4); opacity: 0; }
        }

        @keyframes hmGoldParticleDrift4 {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          35% { transform: translate(-4px, -4px) scale(1.2); opacity: 0.75; }
          70% { transform: translate(-7px, -8px) scale(0.85); opacity: 0.4; }
          100% { transform: translate(-9px, -12px) scale(0.5); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .karaoke-particle {
            animation: none !important;
            display: none !important;
          }
        }
        .naro-app-header {
          padding-left: max(16px, env(safe-area-inset-left, 16px));
          padding-right: max(16px, env(safe-area-inset-right, 16px));
        }

        .header-search-bar {
          width: clamp(180px, 20vw, 320px);
        }

        .mobile-menu-btn {
          min-width: 44px;
          min-height: 44px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          align-items: center;
          justify-content: center;
          background: rgba(244, 240, 235, 0.06);
          border: 1px solid rgba(244, 240, 235, 0.12);
          color: var(--text-primary);
          touch-action: manipulation;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
        }

        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .naro-app-header {
            height: 64px !important;
          }
          .header-search-bar {
            width: 150px !important;
          }
        }

        @media (max-width: 600px) {
          .naro-app-header {
            padding-left: max(12px, env(safe-area-inset-left, 12px)) !important;
            padding-right: max(12px, env(safe-area-inset-right, 12px)) !important;
          }
          .header-left-cluster {
            gap: 10px !important;
          }
          .header-right-cluster {
            gap: 8px !important;
          }
          .hypermelo-wordmark-container .hypermelo-calligraphic-text {
            font-size: 1.35rem !important;
          }
          .hypermelo-wordmark-container .hypermelo-tagline-text {
            font-size: 0.52rem !important;
            letter-spacing: 0.14em !important;
          }
          /* Gracefully collapse search bar to compact 44x44 circular button on mobile */
          .header-search-bar {
            width: 44px !important;
            min-width: 44px !important;
            height: 44px !important;
            min-height: 44px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
          .header-search-text,
          .header-search-shortcut {
            display: none !important;
          }
        }

        @media (max-width: 430px) {
          .naro-app-header {
            padding-left: max(10px, env(safe-area-inset-left, 10px)) !important;
            padding-right: max(10px, env(safe-area-inset-right, 10px)) !important;
          }
          .header-right-cluster {
            gap: 6px !important;
          }
          .header-offline-text {
            display: none !important;
          }
          /* Compact account button at narrow widths (touch target preserved at 44x44) */
          .header-auth-text {
            display: none !important;
          }
          .header-auth-btn {
            padding: 0 !important;
            width: 44px !important;
            min-width: 44px !important;
            height: 44px !important;
            min-height: 44px !important;
            border-radius: 50% !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
        }

        @media (max-width: 360px) {
          .hypermelo-wordmark-container .hypermelo-calligraphic-text {
            font-size: 1.25rem !important;
          }
          .hypermelo-wordmark-container .hypermelo-tagline-text {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};
