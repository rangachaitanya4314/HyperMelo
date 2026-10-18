import React, { useState } from 'react';
import { Music, Sparkles, Film, Heart, Zap, Globe, Mic2, Info, Radio, ChevronRight, ChevronDown } from 'lucide-react';
import { InstagramIcon } from '../components/InstagramIcon';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { MusicCard } from '../components/MusicCard';
import { getAllCuratedSongs } from '../data/curatedCatalog';

// Instagram Audio page — all content is clearly labelled as editorial/curated picks.
// This page does NOT claim real-time Instagram trending data; no such authorized API
// feed is available for this application. All sections use honest editorial labels.

const FILTER_TABS = [
  { id: 'all', label: 'All Audio' },
  { id: 'trending', label: 'Trending Picks' },
  { id: 'bgm', label: 'BGM / Cinematic' },
  { id: 'romantic', label: 'Romantic & Emotional' },
  { id: 'action', label: 'Action & Energy' },
  { id: 'instrumental', label: 'Instrumental' },
  { id: 'regional', label: 'Regional' },
];

interface EditorialSection {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  filterTab: string;
  icon: React.ReactNode;
  description: string;
}

const EDITORIAL_SECTIONS: EditorialSection[] = [
  {
    id: 'reels-picks',
    title: 'Reels Audio Picks',
    subtitle: 'Editor-curated sounds ideal for short-form Reels content',
    badge: 'Editorial Picks',
    badgeColor: 'var(--accent-warm)',
    filterTab: 'trending',
    icon: <Radio size={18} color="var(--accent-warm)" />,
    description: 'Hand-picked tracks from our editorial team — not real-time Instagram trending data. These songs have been selected for their Reels suitability based on rhythm, hook length, and lyrical moment.',
  },
  {
    id: 'cinematic-bgm',
    title: 'Cinematic BGMs',
    subtitle: 'Background music for story, travel, lifestyle and drama Reels',
    badge: 'BGM Collection',
    badgeColor: '#38BDF8',
    filterTab: 'bgm',
    icon: <Film size={18} color="#38BDF8" />,
    description: 'Instrumental and cinematic scores well-suited as background music for visual storytelling. Preview through authorized playback sources only.',
  },
  {
    id: 'romantic-emotional',
    title: 'Romantic & Emotional',
    subtitle: 'Love stories, heartbreak, and emotional journey sounds',
    badge: 'Mood Collection',
    badgeColor: '#F472B6',
    filterTab: 'romantic',
    icon: <Heart size={18} color="#F472B6" />,
    description: 'Curated for emotional resonance — perfect for couple Reels, anniversary posts, and heartfelt content.',
  },
  {
    id: 'action-energy',
    title: 'Action & High Energy',
    subtitle: 'Upbeat, cinematic, and high-BPM audio for sports and dance Reels',
    badge: 'Energy Picks',
    badgeColor: '#F59E0B',
    filterTab: 'action',
    icon: <Zap size={18} color="#F59E0B" />,
    description: 'High-energy tracks for dance, fitness, sports, and transformation content.',
  },
  {
    id: 'instrumental-vocal-free',
    title: 'Instrumental & Vocal-Free',
    subtitle: 'Pure instrumentals, beats and ambient sounds for voiceover Reels',
    badge: 'Instrumental',
    badgeColor: '#A78BFA',
    filterTab: 'instrumental',
    icon: <Mic2 size={18} color="#A78BFA" />,
    description: 'Tracks without lead vocals — ideal when you want your voice or narration to be the focus.',
  },
  {
    id: 'regional-audio',
    title: 'Regional Audio',
    subtitle: 'Telugu, Tamil, Malayalam, Hindi and Kannada audio for regional Reels',
    badge: 'Regional Picks',
    badgeColor: '#10B981',
    filterTab: 'regional',
    icon: <Globe size={18} color="#10B981" />,
    description: 'Regional language audio picks for culturally authentic content creation.',
  },
];

export const InstagramAudioPage: React.FC = () => {
  const { isOnline } = useAudioPlayer();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const curatedCatalog = React.useMemo(() => getAllCuratedSongs(), []);

  // For each section, select at least 15-20 verified songs from curated catalog
  const getSongsForSection = (sectionId: string) => {
    switch (sectionId) {
      case 'reels-picks':
        return curatedCatalog.filter((s) => s.duration <= 240).slice(0, 20);
      case 'cinematic-bgm':
        return curatedCatalog
          .filter(
            (s) =>
              s.genre?.toLowerCase().includes('classical') ||
              s.genre?.toLowerCase().includes('cinematic') ||
              s.genre?.toLowerCase().includes('ambient') ||
              s.genre?.toLowerCase().includes('strings') ||
              s.genre?.toLowerCase().includes('indie') ||
              !s.lyricsAvailable
          )
          .slice(0, 20);
      case 'romantic-emotional':
        return curatedCatalog
          .filter(
            (s) =>
              s.genre?.toLowerCase().includes('romantic') ||
              s.genre?.toLowerCase().includes('romance') ||
              s.genre?.toLowerCase().includes('soulful') ||
              s.genre?.toLowerCase().includes('ballad')
          )
          .slice(0, 20);
      case 'action-energy':
        return curatedCatalog
          .filter(
            (s) =>
              (s.bpm && s.bpm >= 110) ||
              s.genre?.toLowerCase().includes('mass') ||
              s.genre?.toLowerCase().includes('rock') ||
              s.genre?.toLowerCase().includes('pop') ||
              s.genre?.toLowerCase().includes('dance')
          )
          .slice(0, 20);
      case 'instrumental-vocal-free':
        return curatedCatalog
          .filter(
            (s) =>
              s.playbackSourceType === 'open-license' ||
              s.genre?.toLowerCase().includes('instrumental') ||
              s.genre?.toLowerCase().includes('theme') ||
              s.genre?.toLowerCase().includes('classical') ||
              s.karaokeReady === true
          )
          .slice(0, 20);
      case 'regional-audio':
        return curatedCatalog
          .filter(
            (s) =>
              s.language === 'te' ||
              s.language === 'ta' ||
              s.language === 'ml' ||
              s.language === 'hi'
          )
          .slice(0, 20);
      default:
        return curatedCatalog.slice(0, 20);
    }
  };

  const visibleSections = EDITORIAL_SECTIONS.filter(s =>
    activeFilter === 'all' || s.filterTab === activeFilter
  );

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(32px, 5vw, 64px) clamp(16px, 5vw, 64px) 120px',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <InstagramIcon size={20} color="var(--accent-warm)" />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--accent-warm)',
              textTransform: 'uppercase',
            }}
          >
            INSTAGRAM AUDIO
          </span>
          <span style={{ width: '32px', height: '1px', backgroundColor: 'rgba(231, 165, 141, 0.3)' }} />
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 3.8vw, 3.2rem)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          REELS AUDIO
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1rem',
            marginTop: '8px',
            maxWidth: '620px',
            lineHeight: 1.5,
          }}
        >
          Find sounds for your next Reel — BGMs, mood picks, regional audio and creator-friendly music.
        </p>

        {/* Source transparency notice */}
        <div
          style={{
            marginTop: '16px',
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(244, 240, 235, 0.04)',
            border: '1px solid var(--border-subtle)',
            maxWidth: '680px',
          }}
        >
          <Info size={15} color="var(--text-dim)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-muted)' }}>Source note:</strong> All sections on this page are
            editorial selections curated by the HyperMelo team — not real-time Instagram trend data.
            Live Instagram audio trends require platform-specific API access which is not available to
            this application. Playback uses authorized preview or licensed streams only.
          </p>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#FCA5A5',
            fontSize: '0.88rem',
            marginBottom: '24px',
          }}
        >
          <span>You&apos;re offline. Showing catalog content only.</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Instagram Audio filters"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '36px' }}
      >
        {FILTER_TABS.map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                backgroundColor: isSelected ? 'var(--accent-warm)' : 'rgba(244, 240, 235, 0.05)',
                color: isSelected ? '#080B10' : 'var(--text-muted)',
                border: isSelected
                  ? '1px solid var(--accent-warm)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '8px 18px',
                fontSize: '0.84rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Editorial Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        {visibleSections.map((section) => {
          const songs = getSongsForSection(section.id);
          if (songs.length === 0) return null;

          const isExpanded = !!expandedSections[section.id];
          const displayedSongs =
            activeFilter !== 'all' || isExpanded ? songs : songs.slice(0, 4);

          return (
            <div key={section.id} id={`insta-audio-${section.id}`}>
              {/* Section header */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {section.icon}
                    <h2
                      style={{
                        fontSize: '1.3rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {section.title}
                    </h2>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(244, 240, 235, 0.06)',
                        border: `1px solid ${section.badgeColor}`,
                        color: section.badgeColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {section.badge}
                    </span>
                  </div>

                  {activeFilter === 'all' && songs.length > 4 && (
                    <button
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isExpanded
                          ? 'rgba(231, 165, 141, 0.15)'
                          : 'rgba(244, 240, 235, 0.06)',
                        border: '1px solid rgba(244, 240, 235, 0.12)',
                        color: isExpanded ? 'var(--accent-warm)' : 'var(--text-muted)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>{isExpanded ? 'Show Less' : `View All (${songs.length})`}</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 6px 0' }}>
                  {section.subtitle}
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>
                  {section.description}
                </p>
              </div>

              {/* Responsive Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '20px',
                }}
                className="insta-card-grid"
              >
                {displayedSongs.map((song) => (
                  <MusicCard key={`${section.id}-${song.id}`} song={song} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legal / Disclaimer footer */}
      <div
        style={{
          marginTop: '64px',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'rgba(244, 240, 235, 0.03)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={14} color="var(--text-dim)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            About Instagram Audio
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
          This section provides editorial music recommendations suitable for Reels content.
          HyperMelo is not affiliated with or endorsed by Instagram or Meta.
          &ldquo;Instagram Audio&rdquo; refers to sounds that are commonly used on Reels based on
          editorial judgment — not official Instagram API data. All music is previewed through
          authorized licensed sources. Commercial reuse or redistribution of audio requires
          separate licensing from the rights holders.{' '}
          <Music size={12} color="var(--text-dim)" style={{ display: 'inline', verticalAlign: 'middle' }} />
        </p>
      </div>

      <style>{`
        @media (max-width: 1080px) {
          .insta-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 600px) {
          .insta-card-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
