import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Moon,
  Heart,
  Flame,
  CloudRain,
  Coffee,
  Compass,
  Sun,
  Navigation,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MusicCard } from './MusicCard';
import { getMoodCatalog, type MoodId } from '../data/moodCatalog';
import type { Song } from '../types/music';
import './HomeMoods.css';

export type MoodType = MoodId;

interface MoodConfig {
  id: MoodType;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  accentColor: string;
  gradient: string;
  atmosphereClass: string;
  description: string;
}

const MOODS: MoodConfig[] = [
  {
    id: 'Late Nights',
    label: 'Late Nights',
    tagline: 'Intimate melodies for after-hours stillness',
    icon: <Moon size={18} />,
    accentColor: '#818CF8',
    gradient: 'radial-gradient(ellipse at top left, rgba(79, 70, 229, 0.18) 0%, rgba(15, 23, 42, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-late-nights',
    description: 'Deep nocturnal synth, contemplative indie ballads, and midnight frequencies across Telugu, Hindi, Tamil, Malayalam, and English.'
  },
  {
    id: 'Romance',
    label: 'Romance',
    tagline: 'Warm acoustic harmonies and heartfelt lyrics',
    icon: <Heart size={18} />,
    accentColor: '#FB7185',
    gradient: 'radial-gradient(ellipse at top left, rgba(244, 63, 94, 0.16) 0%, rgba(28, 15, 22, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-romance',
    description: 'Tender acoustic guitar, soft strings, and intimate duets spanning South Asian and global romance.'
  },
  {
    id: 'Party',
    label: 'Party',
    tagline: 'High-energy anthems with kinetic basslines',
    icon: <Flame size={18} />,
    accentColor: '#F59E0B',
    gradient: 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.20) 0%, rgba(30, 20, 10, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-party',
    description: 'Pumping percussion, dynamic festival drops, and celebratory mass dance beats.'
  },
  {
    id: 'Sad',
    label: 'Sad',
    tagline: 'Melancholic poetry and rain-washed acoustics',
    icon: <CloudRain size={18} />,
    accentColor: '#60A5FA',
    gradient: 'radial-gradient(ellipse at top left, rgba(37, 99, 235, 0.16) 0%, rgba(15, 23, 42, 0.6) 60%, transparent 100%)',
    atmosphereClass: 'mood-sad',
    description: 'Soulful minor keys, lingering piano chords, and evocative poetic textures for reflective moments.'
  },
  {
    id: 'Chill',
    label: 'Chill',
    tagline: 'Unwind with smooth lo-fi and easy acoustics',
    icon: <Coffee size={18} />,
    accentColor: '#34D399',
    gradient: 'radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.14) 0%, rgba(12, 28, 22, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-chill',
    description: 'Laid-back grooves, gentle guitar strums, and warm ambient calmness.'
  },
  {
    id: 'Focus',
    label: 'Focus',
    tagline: 'Minimalist soundscapes for deep workflow',
    icon: <Compass size={18} />,
    accentColor: '#38BDF8',
    gradient: 'radial-gradient(ellipse at top left, rgba(56, 189, 248, 0.14) 0%, rgba(10, 25, 41, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-focus',
    description: 'Steady tempos, classical acoustic themes, and distraction-free harmonics for uninterrupted flow.'
  },
  {
    id: 'Feel Good',
    label: 'Feel Good',
    tagline: 'Sunlit melodies and uplifting optimism',
    icon: <Sun size={18} />,
    accentColor: '#FBBF24',
    gradient: 'radial-gradient(ellipse at top left, rgba(251, 191, 36, 0.18) 0%, rgba(35, 25, 12, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-feel-good',
    description: 'Bright major progressions, feel-good vocal hooks, and contagious optimism.'
  },
  {
    id: 'Road Trip',
    label: 'Road Trip',
    tagline: 'Spirited acoustics built for the open road',
    icon: <Navigation size={18} />,
    accentColor: '#FB923C',
    gradient: 'radial-gradient(ellipse at top left, rgba(249, 115, 22, 0.16) 0%, rgba(32, 18, 14, 0.5) 60%, transparent 100%)',
    atmosphereClass: 'mood-road-trip',
    description: 'Driving acoustic guitars, open highways, and cinematic anthems ready to sing along.'
  }
];

export interface HomeMoodsProps {
  title?: string;
  id?: string;
}

export const HomeMoods: React.FC<HomeMoodsProps> = ({ title = 'MOODS', id = 'home-moods' }) => {
  const [activeMood, setActiveMood] = useState<MoodType>('Late Nights');
  const shelfRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Active mood songs from verified multilingual catalog
  const activeMoodSongs = useMemo<Song[]>(() => {
    return getMoodCatalog(activeMood);
  }, [activeMood]);

  // Unique languages represented in this active mood
  const activeLanguagesCount = useMemo(() => {
    const langs = new Set<string>();
    activeMoodSongs.forEach((s) => {
      if (s.language) langs.add(s.language);
      if (s.lyrics) {
        Object.keys(s.lyrics).forEach((l) => langs.add(l));
      }
    });
    return langs.size;
  }, [activeMoodSongs]);

  const currentConfig = useMemo(() => {
    return MOODS.find((m) => m.id === activeMood) || MOODS[0];
  }, [activeMood]);

  // Check scroll position to enable/disable arrow buttons
  const updateScrollState = useCallback(() => {
    const container = shelfRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  // Reset scroll and re-check scroll boundaries when active mood changes
  useEffect(() => {
    const container = shelfRef.current;
    if (container) {
      container.scrollLeft = 0;
    }
    const timer = setTimeout(updateScrollState, 60);
    return () => clearTimeout(timer);
  }, [activeMood, updateScrollState]);

  // Attach listener to update scroll arrows
  useEffect(() => {
    const container = shelfRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, activeMoodSongs]);

  const scrollShelf = (direction: 'left' | 'right') => {
    const container = shelfRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 240);
    const delta = direction === 'left' ? -scrollAmount : scrollAmount;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section
      id={id}
      className="home-moods-section"
      aria-label={title}
    >
      {/* Atmosphere background container */}
      <div
        className="home-moods-atmosphere"
        style={{
          background: currentConfig.gradient
        }}
      >
        {/* Subtle decorative glow */}
        <div
          aria-hidden="true"
          className="home-moods-glow"
          style={{
            background: `radial-gradient(circle, ${currentConfig.accentColor}26 0%, transparent 70%)`
          }}
        />

        {/* Section Header */}
        <div className="home-moods-header">
          <div className="home-moods-pill-row">
            <div className="home-moods-badge-group">
              <span
                className="home-moods-kicker"
                style={{ color: currentConfig.accentColor }}
              >
                {title}
              </span>
              <span
                className="home-moods-kicker-line"
                style={{ backgroundColor: `${currentConfig.accentColor}44` }}
              />
            </div>

            {/* Desktop / Tablet Shelf Navigation Arrows */}
            <div className="home-moods-nav-controls" aria-label="Shelf navigation">
              <button
                type="button"
                className="home-moods-nav-btn"
                onClick={() => scrollShelf('left')}
                disabled={!canScrollLeft}
                aria-label={`Scroll left in ${currentConfig.label} shelf`}
                title="Previous tracks"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="home-moods-nav-btn"
                onClick={() => scrollShelf('right')}
                disabled={!canScrollRight}
                aria-label={`Scroll right in ${currentConfig.label} shelf`}
                title="Next tracks"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="home-moods-title-row">
            <div>
              <h2 className="home-moods-heading font-editorial">
                Music For Your Moment
              </h2>
              <p className="home-moods-tagline">
                {currentConfig.tagline}
              </p>
            </div>

            <div className="home-moods-meta-badges">
              <div
                className="home-moods-atmosphere-pill"
                style={{ color: currentConfig.accentColor }}
              >
                {currentConfig.icon}
                <span>{currentConfig.label} Atmosphere</span>
              </div>
              <span className="home-moods-count-pill">
                {activeMoodSongs.length} Tracks • {activeLanguagesCount} Languages
              </span>
            </div>
          </div>
        </div>

        {/* Mood Selector Tabs */}
        <div
          role="tablist"
          aria-label="Mood selector"
          className="home-moods-tablist"
        >
          {MOODS.map((mood) => {
            const isSelected = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                role="tab"
                id={`mood-tab-${mood.id.toLowerCase().replace(/\s+/g, '-')}`}
                aria-selected={isSelected}
                aria-controls="home-moods-shelf-track"
                onClick={() => setActiveMood(mood.id)}
                className="home-moods-tab"
                style={{
                  background: isSelected ? mood.accentColor : 'rgba(244, 240, 235, 0.04)',
                  color: isSelected ? '#080B10' : 'var(--text-muted, #94A3B8)',
                  border: isSelected
                    ? `1px solid ${mood.accentColor}`
                    : '1px solid var(--border-subtle, rgba(244, 240, 235, 0.08))',
                  fontWeight: isSelected ? 700 : 500
                }}
              >
                {mood.icon}
                <span>{mood.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mood Description */}
        <p className="home-moods-description">
          {currentConfig.description}
        </p>

        {/* Horizontal Music Discovery Shelf */}
        <div className="mood-shelf-wrapper">
          <div
            id="home-moods-shelf-track"
            ref={shelfRef}
            role="region"
            aria-label={`${currentConfig.label} track shelf`}
            className="mood-shelf-track mood-shelf-active"
            key={`mood-shelf-${activeMood}`}
          >
            {activeMoodSongs.map((song) => (
              <div
                key={`mood-${activeMood}-${song.id}`}
                className="mood-shelf-card-item"
              >
                <MusicCard song={song} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
