import React, { useEffect } from 'react';
import { Hero } from '../components/Hero';
import { CoreFeatureSection } from '../components/CoreFeatureSection';
import { Footer } from '../components/Footer';
import { MobileHome } from '../components/MobileHome';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface HomeProps {
  onReplayIntro: () => void;
}

export const Home: React.FC<HomeProps> = ({ onReplayIntro }) => {
  const { togglePlay, karaokeModalOpen, isRecordingActive, reviewModalOpen, searchModalOpen } = useAudioPlayer();

  // Spacebar shortcut for Play/Pause when no input/modal is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;

      if (e.code === 'Space' && !karaokeModalOpen && !isRecordingActive && !reviewModalOpen && !searchModalOpen) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, karaokeModalOpen, isRecordingActive, reviewModalOpen, searchModalOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Desktop Home Layout (>= 900px) — 100% Preserved & Frozen */}
      <div className="desktop-home-layout">
        <Hero />
        <CoreFeatureSection />
        <Footer onReplayIntro={onReplayIntro} />
      </div>

      {/* Mobile Home Layout (< 900px) — Active Visualizer, Top Picks, Auth Card, Artist Bubbles */}
      <div className="mobile-home-layout">
        <MobileHome />
      </div>

      <style>{`
        .mobile-home-layout {
          display: none !important;
        }
        .desktop-home-layout {
          display: contents !important;
        }

        @media (max-width: 899px) {
          .desktop-home-layout {
            display: none !important;
          }
          .mobile-home-layout {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
