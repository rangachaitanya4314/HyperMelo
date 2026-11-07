import React from 'react';
import { Home, Compass, Library, Search } from 'lucide-react';
import { useAudioPlayer, type AppView } from '../context/AudioPlayerContext';
import './MobileBottomNav.css';

export const MobileBottomNav: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    setSearchModalOpen,
    nowPlayingOpen,
    closeNowPlaying
  } = useAudioPlayer();

  if (nowPlayingOpen) {
    return null;
  }

  const handleTabClick = (view: 'home' | 'discover' | 'library' | 'search') => {
    if (nowPlayingOpen) {
      closeNowPlaying();
    }
    if (view === 'search') {
      setSearchModalOpen(true);
      return;
    }
    setCurrentView(view as AppView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: Home,
      isActive: currentView === 'home'
    },
    {
      id: 'discover' as const,
      label: 'Explore',
      icon: Compass,
      isActive: currentView === 'discover'
    },
    {
      id: 'library' as const,
      label: 'Library',
      icon: Library,
      isActive: currentView === 'library'
    },
    {
      id: 'search' as const,
      label: 'Search',
      icon: Search,
      isActive: false
    }
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      role="navigation"
      aria-label="Mobile Bottom Navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            id={`mobile-nav-tab-${item.id}`}
            data-testid={`mobile-nav-tab-${item.id}`}
            className={`mobile-bottom-nav-item ${item.isActive ? 'active' : ''}`}
            onClick={() => handleTabClick(item.id)}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
          >
            <div className="mobile-bottom-nav-icon-wrap">
              <Icon size={22} strokeWidth={item.isActive ? 2.4 : 1.8} />
              {item.isActive && <span className="mobile-bottom-nav-glow" />}
            </div>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

