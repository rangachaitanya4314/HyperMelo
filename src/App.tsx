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

export const AppContent: React.FC = () => {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    // Only show intro once per browser session
    return !sessionStorage.getItem('naro_intro_seen');
  });

  const { currentView, accountModalOpen, setAccountModalOpen } = useAudioPlayer();

  const handleIntroComplete = React.useCallback(() => {
    sessionStorage.setItem('naro_intro_seen', 'true');
    setShowIntro(false);
  }, []);

  const handleReplayIntro = React.useCallback(() => {
    setShowIntro(true);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Opening 1.58s Cinematic Intro */}
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

      {/* Sticky Dark Cinematic Header with NARO Logo Spectrum */}
      <Header />

      {/* Active Navigation View */}
      <main style={{ minHeight: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
        {currentView === 'home' && <Home onReplayIntro={handleReplayIntro} />}
        {currentView === 'discover' && <DiscoverPage />}
        {currentView === 'karaoke' && <KaraokePage />}
        {currentView === 'library' && <LibraryPage />}
        {currentView === 'downloads' && <DownloadsPage />}
      </main>

      {/* Floating Elements & Modals */}
      <KaraokeModal />
      <KaraokeRecordingState />
      <PerformanceReviewModal />
      <LyricsDrawer />
      <SearchModal />
      <AccountConnectionModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
      <NowPlaying />

      {/* Persistent Bottom Studio Music Player */}
      <BottomPlayer />
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
