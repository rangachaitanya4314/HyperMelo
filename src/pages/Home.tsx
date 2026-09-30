import React, { useEffect } from 'react';
import { Hero } from '../components/Hero';
import { MusicGrid } from '../components/MusicGrid';
import { CoreFeatureSection } from '../components/CoreFeatureSection';
import { Footer } from '../components/Footer';
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
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Hero />
      <MusicGrid />
      <CoreFeatureSection />
      <Footer onReplayIntro={onReplayIntro} />
    </main>
  );
};
