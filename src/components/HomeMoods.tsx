import React, { useState, useMemo } from 'react';
import {
  Moon,
  Heart,
  Flame,
  CloudRain,
  Coffee,
  Compass,
  Sun,
  Navigation
} from 'lucide-react';
import { MusicCard } from './MusicCard';
import { musicCatalogService } from '../services/providers/musicCatalogService';
import type { Song } from '../types/music';

export type MoodType =
  | 'Late Nights'
  | 'Romance'
  | 'Party'
  | 'Sad'
  | 'Chill'
  | 'Focus'
  | 'Feel Good'
  | 'Road Trip';

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
    gradient: 'radial-gradient(ellipse at top left, rgba(79, 70, 229, 0.15) 0%, rgba(15, 23, 42, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-late-nights',
    description: 'Deep nocturnal synth, contemplative indie ballads, and midnight frequencies.'
  },
  {
    id: 'Romance',
    label: 'Romance',
    tagline: 'Warm acoustic harmonies and heartfelt lyrics',
    icon: <Heart size={18} />,
    accentColor: '#FB7185',
    gradient: 'radial-gradient(ellipse at top left, rgba(244, 63, 94, 0.14) 0%, rgba(28, 15, 22, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-romance',
    description: 'Tender acoustic guitar, soft strings, and intimate Telugu, Hindi, and English duets.'
  },
  {
    id: 'Party',
    label: 'Party',
    tagline: 'High-energy anthems with kinetic basslines',
    icon: <Flame size={18} />,
    accentColor: '#F59E0B',
    gradient: 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.18) 0%, rgba(30, 20, 10, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-party',
    description: 'Pumping percussion, dynamic drops, and celebratory dancefloor rhythms.'
  },
  {
    id: 'Sad',
    label: 'Sad',
    tagline: 'Melancholic poetry and rain-washed acoustics',
    icon: <CloudRain size={18} />,
    accentColor: '#60A5FA',
    gradient: 'radial-gradient(ellipse at top left, rgba(37, 99, 235, 0.14) 0%, rgba(15, 23, 42, 0.6) 60%, transparent 100%)',
    atmosphereClass: 'mood-sad',
    description: 'Soulful minor keys, lingering piano chords, and evocative vocal textures.'
  },
  {
    id: 'Chill',
    label: 'Chill',
    tagline: 'Unwind with smooth lo-fi and easy acoustics',
    icon: <Coffee size={18} />,
    accentColor: '#34D399',
    gradient: 'radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.12) 0%, rgba(12, 28, 22, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-chill',
    description: 'Laid-back grooves, gentle guitar strums, and warm ambient warmth.'
  },
  {
    id: 'Focus',
    label: 'Focus',
    tagline: 'Minimalist soundscapes for deep workflow',
    icon: <Compass size={18} />,
    accentColor: '#38BDF8',
    gradient: 'radial-gradient(ellipse at top left, rgba(56, 189, 248, 0.12) 0%, rgba(10, 25, 41, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-focus',
    description: 'Steady rhythmic tempos, organic clarity, and distraction-free harmonics.'
  },
  {
    id: 'Feel Good',
    label: 'Feel Good',
    tagline: 'Sunlit melodies and uplifting optimism',
    icon: <Sun size={18} />,
    accentColor: '#FBBF24',
    gradient: 'radial-gradient(ellipse at top left, rgba(251, 191, 36, 0.16) 0%, rgba(35, 25, 12, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-feel-good',
    description: 'Bright major progressions, feel-good vocal hooks, and contagious optimism.'
  },
  {
    id: 'Road Trip',
    label: 'Road Trip',
    tagline: 'Spirited acoustics built for the open road',
    icon: <Navigation size={18} />,
    accentColor: '#FB923C',
    gradient: 'radial-gradient(ellipse at top left, rgba(249, 115, 22, 0.15) 0%, rgba(32, 18, 14, 0.4) 60%, transparent 100%)',
    atmosphereClass: 'mood-road-trip',
    description: 'Driving acoustic guitars, open horizons, and cinematic indie anthems.'
  }
];

export const HomeMoods: React.FC = () => {
  const [activeMood, setActiveMood] = useState<MoodType>('Late Nights');

  const catalogSongs = useMemo(() => musicCatalogService.getFallbackCatalog(), []);

  // Filter or arrange songs for the active mood
  const moodSongs = useMemo<Song[]>(() => {
    switch (activeMood) {
      case 'Late Nights':
        // Midnight Drive, Khaab, plus catalog
        return [
          ...catalogSongs.filter((s) => s.id === 'midnight-drive' || s.id === 'khaab'),
          ...catalogSongs.filter((s) => s.id !== 'midnight-drive' && s.id !== 'khaab')
        ];
      case 'Romance':
        // Neeve, Vennela
        return [
          ...catalogSongs.filter((s) => s.id === 'neeve' || s.id === 'vennela'),
          ...catalogSongs.filter((s) => s.id !== 'neeve' && s.id !== 'vennela')
        ];
      case 'Party':
        // Higher energy / BPM tracks
        return [...catalogSongs].sort((a, b) => (b.bpm || 100) - (a.bpm || 100));
      case 'Sad':
        // Vennela, Khaab, acoustic
        return [
          ...catalogSongs.filter((s) => s.id === 'vennela' || s.id === 'khaab'),
          ...catalogSongs.filter((s) => s.id !== 'vennela' && s.id !== 'khaab')
        ];
      case 'Chill':
        // Lower BPM tracks
        return [...catalogSongs].sort((a, b) => (a.bpm || 80) - (b.bpm || 80));
      case 'Focus':
        // Instrumental / clean acoustic
        return [
          ...catalogSongs.filter((s) => s.id === 'midnight-drive'),
          ...catalogSongs.filter((s) => s.id !== 'midnight-drive')
        ];
      case 'Feel Good':
        // Shot Down, Neeve
        return [
          ...catalogSongs.filter((s) => s.id === 'josh-woodward-shot-down' || s.id === 'neeve'),
          ...catalogSongs.filter((s) => s.id !== 'josh-woodward-shot-down' && s.id !== 'neeve')
        ];
      case 'Road Trip':
        // Shot Down, Midnight Drive
        return [
          ...catalogSongs.filter((s) => s.id === 'josh-woodward-shot-down' || s.id === 'midnight-drive'),
          ...catalogSongs.filter((s) => s.id !== 'josh-woodward-shot-down' && s.id !== 'midnight-drive')
        ];
      default:
        return catalogSongs;
    }
  }, [activeMood, catalogSongs]);

  const currentConfig = useMemo(() => {
    return MOODS.find((m) => m.id === activeMood) || MOODS[0];
  }, [activeMood]);

  return (
    <section
      id="home-moods"
      aria-label="Home Moods"
      style={{
        position: 'relative',
        padding: 'clamp(40px, 5vw, 72px) clamp(16px, 5vw, 64px)',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        transition: 'background 0.5s ease'
      }}
    >
      {/* Atmosphere background container */}
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(24px, 4vw, 40px)',
          background: currentConfig.gradient,
          border: '1px solid rgba(244, 240, 235, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Subtle decorative motif indicator */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${currentConfig.accentColor}22 0%, transparent 70%)`,
            filter: 'blur(40px)',
            pointerEvents: 'none'
          }}
        />

        {/* Section Header */}
        <div style={{ marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                color: currentConfig.accentColor,
                textTransform: 'uppercase'
              }}
            >
              HOME MOODS
            </span>
            <span
              style={{
                width: '32px',
                height: '1px',
                backgroundColor: `${currentConfig.accentColor}44`
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <h2
                className="font-editorial"
                style={{
                  fontSize: 'clamp(2rem, 3.4vw, 2.8rem)',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  margin: 0
                }}
              >
                Music For Your Moment
              </h2>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.98rem',
                  marginTop: '6px',
                  maxWidth: '560px'
                }}
              >
                {currentConfig.tagline}
              </p>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(244, 240, 235, 0.05)',
                border: '1px solid rgba(244, 240, 235, 0.1)',
                fontSize: '0.82rem',
                color: currentConfig.accentColor
              }}
            >
              {currentConfig.icon}
              <span>{currentConfig.label} Atmosphere</span>
            </div>
          </div>
        </div>

        {/* Mood Selector Pills */}
        <div
          role="tablist"
          aria-label="Mood selector"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '32px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {MOODS.map((mood) => {
            const isSelected = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                role="tab"
                id={`mood-tab-${mood.id.toLowerCase().replace(/\s+/g, '-')}`}
                aria-selected={isSelected}
                onClick={() => setActiveMood(mood.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? mood.accentColor : 'rgba(244, 240, 235, 0.04)',
                  color: isSelected ? '#080B10' : 'var(--text-muted)',
                  border: isSelected
                    ? `1px solid ${mood.accentColor}`
                    : '1px solid var(--border-subtle)',
                  fontSize: '0.86rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
              >
                {mood.icon}
                <span>{mood.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mood Description */}
        <p
          style={{
            color: 'var(--text-dim)',
            fontSize: '0.88rem',
            margin: '0 0 24px 0',
            position: 'relative',
            zIndex: 1
          }}
        >
          {currentConfig.description}
        </p>

        {/* Mood Curated Songs Grid */}
        <div
          className="music-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '24px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {moodSongs.slice(0, 4).map((song) => (
            <MusicCard key={`mood-${activeMood}-${song.id}`} song={song} />
          ))}
        </div>
      </div>
    </section>
  );
};
