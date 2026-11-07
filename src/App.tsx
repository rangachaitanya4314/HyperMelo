import React, { useState } from 'react';
import { AudioPlayerProvider, useAudioPlayer } from './context/AudioPlayerContext';
import { IntroAnimation } from './components/IntroAnimation';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { DiscoverPage } from './pages/DiscoverPage';
import { KaraokePage } from './pages/KaraokePage';
import { LibraryPage } from './pages/LibraryPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { KaraokeModal } from './components/KaraokeModal';
import { KaraokeRecordingState } from './components/KaraokeRecordingState';
import { PerformanceReviewModal } from './components/PerformanceReviewModal';
import { LyricsDrawer } from './components/LyricsDrawer';
import { SearchModal } from './components/SearchModal';
import { BottomPlayer } from './components/BottomPlayer';
import { AccountConnectionModal } from './components/AccountConnectionModal';
import { NowPlaying } from './components/NowPlaying';
import { AuthModal } from './components/AuthModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { ShareMomentModal } from './components/ShareMomentModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileBottomNav } from './components/MobileBottomNav';

export const AppContent: React.FC = () => {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    // Only show intro once per browser session
    return !sessionStorage.getItem('hypermelo_intro_seen');
  });

  const {
    currentView,
    accountModalOpen,
    setAccountModalOpen,
    authModalOpen,
    authModalMode,
    setAuthModalOpen,
    addToPlaylistModalOpen,
    playlistTargetSong,
    setAddToPlaylistModalOpen,
    shareMomentOpen,
    shareMomentSong,
    closeShareMoment,
    currentSong
  } = useAudioPlayer();

  const handleIntroComplete = React.useCallback(() => {
    sessionStorage.setItem('hypermelo_intro_seen', 'true');
    setShowIntro(false);
  }, []);

  const handleReplayIntro = React.useCallback(() => {
    setShowIntro(true);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Netflix-style Cinematic Brand Reveal */}
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

      {/* Sticky Dark Cinematic Header with HyperMelo Logo & Spectrum */}
      <Header />

      {/* Active Navigation View */}
      <main
        className="app-main-content"
        style={{
          minHeight: 'calc(100vh - 160px)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(var(--bottom-player-height, 160px) + 32px)'
        }}
      >
        {currentView === 'home' && <Home onReplayIntro={handleReplayIntro} />}
        {currentView === 'discover' && <DiscoverPage />}
        {currentView === 'karaoke' && <KaraokePage />}
        {currentView === 'library' && <LibraryPage />}
        {currentView === 'downloads' && <DownloadsPage />}
      </main>

      {/* Floating Elements & Modals */}
      <ErrorBoundary fallbackTitle="Karaoke Studio encountered an issue">
        <KaraokeModal />
      </ErrorBoundary>
      <KaraokeRecordingState />
      <PerformanceReviewModal />
      <LyricsDrawer />
      <SearchModal />
      <AccountConnectionModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
      <AddToPlaylistModal
        isOpen={addToPlaylistModalOpen}
        song={playlistTargetSong}
        onClose={() => setAddToPlaylistModalOpen(false)}
      />
      <ShareMomentModal
        isOpen={shareMomentOpen}
        song={shareMomentSong || currentSong}
        onClose={closeShareMoment}
      />
      <NowPlaying />

      {/* Persistent Bottom Studio Music Player */}
      <BottomPlayer />

      {/* Floating Bottom Navigation Bar (Strictly Mobile Isolated) */}
      <MobileBottomNav />
    </div>
  );
};

export default function App() {
  return (
    <AudioPlayerProvider>
      <AppContent />
    </AudioPlayerProvider>
  );
}
