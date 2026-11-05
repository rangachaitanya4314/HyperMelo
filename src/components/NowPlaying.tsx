import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  CloudRain,
  Sun,
  Moon,
  Plus,
  Share2,
  MoreVertical,
  Sliders,
  ChevronDown,
  RotateCw,
  Loader2,
  AlertCircle,
  Mic2,
  ListPlus,
  Bookmark,
  BookmarkCheck,
  Info,
  Copy,
  Check,
  X,
  Languages,
  Sparkles,
  ListMusic,
  Trash2
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { AbstractArtwork } from './AbstractArtwork';
import { lyricsService } from '../services/lyrics/lyricsService';
import { getListeningLyricDisplay } from '../shared/lyrics';
import { getConsumerLicenseLabel, getCanonicalTrackDuration } from '../shared';
import { useArtworkColors } from '../services/artwork/colorExtractor';
import type { Song, TimedLyricLine } from '../types/music';
import { SUPPORTED_LANGUAGES } from '../types/music';
import { FloatingLyrics } from './FloatingLyrics';
import './NowPlaying.css';

export type AtmosphereMood = 'romance' | 'sad' | 'solaris' | 'midnight';

/**
 * Deterministically detect atmospheric mood from song metadata without fabrication.
 */
function getSongMood(song: Song | null): AtmosphereMood {
  if (!song) return 'midnight';
  const combined = `${song.genre || ''} ${song.title || ''} ${song.artwork?.pattern || ''}`.toLowerCase();
  if (
    combined.includes('sad') ||
    combined.includes('rain') ||
    combined.includes('melancholy') ||
    combined.includes('heartbreak') ||
    combined.includes('grief')
  ) {
    return 'sad';
  }
  if (
    combined.includes('romance') ||
    combined.includes('love') ||
    (combined.includes('heart') && !combined.includes('heartbreak')) ||
    combined.includes('romantic')
  ) {
    return 'romance';
  }
  if (
    combined.includes('solaris') ||
    combined.includes('acoustic') ||
    combined.includes('folk') ||
    combined.includes('indie rock') ||
    song.artwork?.pattern === 'solaris'
  ) {
    return 'solaris';
  }
  return 'midnight';
}

export const NowPlaying: React.FC = () => {
  const {
    nowPlayingOpen,
    closeNowPlaying,
    currentSong,
    isPlaying,
    playbackState,
    currentTime,
    duration,
    seekTo,
    togglePlay,
    nextSong,
    prevSong,
    volume,
    setVolume,
    isLoopingSection,
    setIsLoopingSection,
    sourceLanguage,
    setDisplayLanguage,
    listeningMeaningLanguage,
    setListeningMeaningLanguage,
    lyricsRevision,
    soundMode,
    soundPreset,
    bassIntensity,
    isDspSupported,
    activeDspDescription,
    setSoundMode,
    setSoundPreset,
    setBassIntensity,
    toggleLikeSong,
    isSongLiked,
    openAddToPlaylist,
    openShareMoment,
    isSongDownloaded,
    downloadSong,
    setCurrentView,
    lyricsResolution,
    isResolvingLyrics,
    retryLyricsResolution,
    playSong,
    queue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    addToQueue
  } = useAudioPlayer();

  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const artworkColors = useArtworkColors(currentSong);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Mobile Controls & Menu States with Transition Controllers
  const [isMobileLyricsOpen, setIsMobileLyricsOpen] = useState<boolean>(false);
  const [isLyricsClosing, setIsLyricsClosing] = useState<boolean>(false);
  const isLyricsActive = isMobileLyricsOpen && !isLyricsClosing;
  const lyricsTimerRef = useRef<any>(null);
  const [lyricsDragOffset, setLyricsDragOffset] = useState<number>(0);
  const lyricsTouchStartYRef = useRef<number>(0);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isMoreMenuClosing, setIsMoreMenuClosing] = useState<boolean>(false);
  const moreMenuTimerRef = useRef<any>(null);
  const [menuDragOffset, setMenuDragOffset] = useState<number>(0);
  const menuTouchStartYRef = useRef<number>(0);

  const [isLangPickerOpen, setIsLangPickerOpen] = useState<boolean>(false);
  const [isLangPickerClosing, setIsLangPickerClosing] = useState<boolean>(false);
  const langPickerTimerRef = useRef<any>(null);
  const [langDragOffset, setLangDragOffset] = useState<number>(0);
  const langTouchStartYRef = useRef<number>(0);

  const [showTrackDetails, setShowTrackDetails] = useState<boolean>(false);
  const [menuToast, setMenuToast] = useState<string | null>(null);
  const [isMenuAudiophileExpanded, setIsMenuAudiophileExpanded] = useState<boolean>(false);
  const [lyricsAnimationMode, setLyricsAnimationMode] = useState<'floating' | 'classic'>('floating');
  const lyricsAnimationModeRef = useRef<'floating' | 'classic'>('floating');
  lyricsAnimationModeRef.current = lyricsAnimationMode;

  const showToast = useCallback((msg: string) => {
    setMenuToast(msg);
    setTimeout(() => {
      setMenuToast(null);
    }, 2500);
  }, []);

  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Motion preference detection
  const getPrefersReducedMotion = useCallback(() => {
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // 1. More Menu Open / Close Controllers (subtle upward sheet with backdrop fade)
  const openMoreMenu = useCallback(() => {
    if (moreMenuTimerRef.current) {
      clearTimeout(moreMenuTimerRef.current);
      moreMenuTimerRef.current = null;
    }
    setIsMenuAudiophileExpanded(false);
    setIsMoreMenuClosing(false);
    setIsMoreMenuOpen(true);
    setMenuDragOffset(0);
  }, []);

  const closeMoreMenu = useCallback((immediate = false) => {
    if (isMoreMenuClosing && !immediate) return;
    if (immediate || getPrefersReducedMotion()) {
      if (moreMenuTimerRef.current) clearTimeout(moreMenuTimerRef.current);
      setIsMoreMenuOpen(false);
      setIsMoreMenuClosing(false);
      setIsMenuAudiophileExpanded(false);
      setMenuDragOffset(0);
      return;
    }
    setIsMoreMenuClosing(true);
    if (moreMenuTimerRef.current) clearTimeout(moreMenuTimerRef.current);
    moreMenuTimerRef.current = setTimeout(() => {
      setIsMoreMenuOpen(false);
      setIsMoreMenuClosing(false);
      setIsMenuAudiophileExpanded(false);
      setMenuDragOffset(0);
      moreMenuTimerRef.current = null;
    }, 240);
  }, [isMoreMenuClosing, getPrefersReducedMotion]);

  // 2. Mobile Lyrics Open / Close Controllers (smooth rise 350-450ms, smooth drop 300-400ms)
  const openMobileLyrics = useCallback(() => {
    if (lyricsTimerRef.current) {
      clearTimeout(lyricsTimerRef.current);
      lyricsTimerRef.current = null;
    }
    setIsLyricsClosing(false);
    setIsMobileLyricsOpen(true);
    setLyricsDragOffset(0);
  }, []);

  const closeMobileLyrics = useCallback((immediate = false) => {
    if (isLyricsClosing && !immediate) return;
    if (isLangPickerOpen) {
      if (langPickerTimerRef.current) clearTimeout(langPickerTimerRef.current);
      setIsLangPickerOpen(false);
      setIsLangPickerClosing(false);
      setLangDragOffset(0);
    }
    if (immediate || getPrefersReducedMotion()) {
      if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
      setIsMobileLyricsOpen(false);
      setIsLyricsClosing(false);
      setLyricsDragOffset(0);
      return;
    }
    setIsLyricsClosing(true);
    if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
    lyricsTimerRef.current = setTimeout(() => {
      setIsMobileLyricsOpen(false);
      setIsLyricsClosing(false);
      setLyricsDragOffset(0);
      lyricsTimerRef.current = null;
    }, 350);
  }, [isLyricsClosing, isLangPickerOpen, getPrefersReducedMotion]);

  // 3. Language Picker Open / Close Controllers (nested overlay 200-250ms)
  const openLangPicker = useCallback(() => {
    if (langPickerTimerRef.current) {
      clearTimeout(langPickerTimerRef.current);
      langPickerTimerRef.current = null;
    }
    setIsLangPickerClosing(false);
    setIsLangPickerOpen(true);
    setLangDragOffset(0);
  }, []);

  const closeLangPicker = useCallback((immediate = false) => {
    if (isLangPickerClosing && !immediate) return;
    if (immediate || getPrefersReducedMotion()) {
      if (langPickerTimerRef.current) clearTimeout(langPickerTimerRef.current);
      setIsLangPickerOpen(false);
      setIsLangPickerClosing(false);
      setLangDragOffset(0);
      return;
    }
    setIsLangPickerClosing(true);
    if (langPickerTimerRef.current) clearTimeout(langPickerTimerRef.current);
    langPickerTimerRef.current = setTimeout(() => {
      setIsLangPickerOpen(false);
      setIsLangPickerClosing(false);
      setLangDragOffset(0);
      langPickerTimerRef.current = null;
    }, 220);
  }, [isLangPickerClosing, getPrefersReducedMotion]);

  // 4. Queue Bottom Sheet Open / Close Controllers (smooth rise 300-400ms)
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isQueueClosing, setIsQueueClosing] = useState<boolean>(false);
  const isQueueActive = isQueueOpen && !isQueueClosing;
  const queueTimerRef = useRef<any>(null);
  const [queueDragOffset, setQueueDragOffset] = useState<number>(0);
  const queueTouchStartYRef = useRef<number>(0);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  const openQueue = useCallback(() => {
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    setIsClearConfirmOpen(false);
    setIsQueueClosing(false);
    setIsQueueOpen(true);
    setQueueDragOffset(0);
  }, []);

  const closeQueue = useCallback((immediate = false) => {
    if (isQueueClosing && !immediate) return;
    setIsClearConfirmOpen(false);
    if (immediate || getPrefersReducedMotion()) {
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
      setIsQueueOpen(false);
      setIsQueueClosing(false);
      setQueueDragOffset(0);
      return;
    }
    setIsQueueClosing(true);
    if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    queueTimerRef.current = setTimeout(() => {
      setIsQueueOpen(false);
      setIsQueueClosing(false);
      setQueueDragOffset(0);
      queueTimerRef.current = null;
    }, 320);
  }, [isQueueClosing, getPrefersReducedMotion]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (moreMenuTimerRef.current) clearTimeout(moreMenuTimerRef.current);
      if (lyricsTimerRef.current) clearTimeout(lyricsTimerRef.current);
      if (langPickerTimerRef.current) clearTimeout(langPickerTimerRef.current);
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    };
  }, []);

  // Swipe-down touch handlers for More Menu
  const handleMenuTouchStart = (e: React.TouchEvent) => {
    menuTouchStartYRef.current = e.touches[0].clientY;
  };
  const handleMenuTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - menuTouchStartYRef.current;
    if (deltaY > 0) {
      setMenuDragOffset(deltaY);
    }
  };
  const handleMenuTouchEnd = () => {
    if (menuDragOffset > 70) {
      closeMoreMenu();
    }
    setMenuDragOffset(0);
  };

  // Swipe-down touch handlers for Language Picker
  const handleLangTouchStart = (e: React.TouchEvent) => {
    langTouchStartYRef.current = e.touches[0].clientY;
  };
  const handleLangTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - langTouchStartYRef.current;
    if (deltaY > 0) {
      setLangDragOffset(deltaY);
    }
  };
  const handleLangTouchEnd = () => {
    if (langDragOffset > 60) {
      closeLangPicker();
    }
    setLangDragOffset(0);
  };

  // Swipe-down touch handlers for Mobile Lyrics
  const handleLyricsTouchStart = (e: React.TouchEvent) => {
    lyricsTouchStartYRef.current = e.touches[0].clientY;
  };
  const handleLyricsTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - lyricsTouchStartYRef.current;
    if (deltaY > 0) {
      setLyricsDragOffset(deltaY);
    }
  };
  const handleLyricsTouchEnd = () => {
    if (lyricsDragOffset > 80) {
      closeMobileLyrics();
    }
    setLyricsDragOffset(0);
  };

  // Swipe-down touch handlers for Play Queue Bottom Sheet
  const handleQueueTouchStart = (e: React.TouchEvent) => {
    queueTouchStartYRef.current = e.touches[0].clientY;
  };
  const handleQueueTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - queueTouchStartYRef.current;
    if (deltaY > 0) {
      setQueueDragOffset(deltaY);
    }
  };
  const handleQueueTouchEnd = () => {
    if (queueDragOffset > 70) {
      closeQueue();
    }
    setQueueDragOffset(0);
  };

  // Authoritative Upcoming Queue & Next Track Preview
  const upcomingQueue = useMemo(() => {
    if (!currentSong) return queue;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    if (currentIndex === -1) return queue.filter((s) => s.id !== currentSong.id);
    const after = queue.slice(currentIndex + 1);
    const before = queue.slice(0, currentIndex);
    return [...after, ...before];
  }, [queue, currentSong]);

  const nextTrack = upcomingQueue.length > 0 ? upcomingQueue[0] : null;

  // Programmatic test bindings for Mobile Controls & Transitions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      win.__naro_open_more_menu = () => openMoreMenu();
      win.__naro_close_more_menu = () => closeMoreMenu();
      win.__naro_is_more_menu_open = () => isMoreMenuOpen;
      win.__naro_is_more_menu_closing = () => isMoreMenuClosing;
      win.__naro_open_mobile_lyrics = () => openMobileLyrics();
      win.__naro_close_mobile_lyrics = () => closeMobileLyrics();
      win.__naro_toggle_mobile_lyrics = () => {
        if (isMobileLyricsOpen) closeMobileLyrics();
        else openMobileLyrics();
      };
      win.__naro_is_mobile_lyrics_open = () => isMobileLyricsOpen;
      win.__naro_is_lyrics_closing = () => isLyricsClosing;
      win.__naro_is_lyrics_active = () => isMobileLyricsOpen && !isLyricsClosing;
      win.__naro_open_lang_picker = () => openLangPicker();
      win.__naro_close_lang_picker = () => closeLangPicker();
      win.__naro_is_lang_picker_open = () => isLangPickerOpen;
      win.__naro_is_lang_picker_closing = () => isLangPickerClosing;
      win.__naro_set_lyric_language = (langCode: any) => {
        setListeningMeaningLanguage(langCode);
        setDisplayLanguage(langCode);
      };
      win.__naro_get_lyric_language = () => listeningMeaningLanguage;

      // Queue Programmatic Test Bindings
      win.__naro_open_queue = () => openQueue();
      win.__naro_close_queue = () => closeQueue();
      win.__naro_toggle_queue = () => {
        if (isQueueOpen) closeQueue();
        else openQueue();
      };
      win.__naro_is_queue_open = () => isQueueOpen;
      win.__naro_is_queue_closing = () => isQueueClosing;
      win.__naro_is_queue_active = () => isQueueOpen && !isQueueClosing;
      win.__naro_get_queue = () => queue;
      win.__naro_clear_queue = () => clearQueue();
      win.__naro_remove_from_queue = (id: string) => removeFromQueue(id);
      win.__naro_add_to_queue = (song: any) => addToQueue(song);
      win.__naro_reorder_queue = (newQ: any) => reorderQueue(newQ);

      // Floating Lyrics Mode Test Hooks & Rollback Protection
      win.__naro_set_lyrics_animation_mode = (mode: 'floating' | 'classic') => {
        lyricsAnimationModeRef.current = mode;
        setLyricsAnimationMode(mode);
      };
      win.__naro_get_lyrics_animation_mode = () => lyricsAnimationModeRef.current;
    }
  }, [
    lyricsAnimationMode,
    isMoreMenuOpen,
    isMoreMenuClosing,
    isMobileLyricsOpen,
    isLyricsClosing,
    isLangPickerOpen,
    isLangPickerClosing,
    isQueueOpen,
    isQueueClosing,
    queue,
    openMoreMenu,
    closeMoreMenu,
    openMobileLyrics,
    closeMobileLyrics,
    openLangPicker,
    closeLangPicker,
    openQueue,
    closeQueue,
    clearQueue,
    removeFromQueue,
    addToQueue,
    reorderQueue,
    listeningMeaningLanguage,
    setListeningMeaningLanguage,
    setDisplayLanguage
  ]);

  // Atmospheric Mood
  const mood = useMemo(() => getSongMood(currentSong), [currentSong]);

  // Truthful Lyrics Capability
  const lyricsCapability = useMemo(
    () => lyricsService.getLyricsCapability(currentSong),
    [currentSong, lyricsRevision]
  );
  const isSynced = lyricsCapability === 'SYNCED_LYRICS';

  // Canonical Timed Lyric Segments (Single Authoritative Timeline)
  const canonicalLyricLines = useMemo(() => {
    return lyricsService.getCanonicalLyricLines(currentSong);
  }, [currentSong, lyricsRevision]);

  // State to expand / collapse the Audiophile Sound Engine panel (collapsed by default)
  const [isAudiophileExpanded, setIsAudiophileExpanded] = useState<boolean>(false);

  // Displayed lines state - initialized with canonical lines and reset immediately on track switch, revision update, or line resolution
  const [displayedLines, setDisplayedLines] = useState<TimedLyricLine[]>(canonicalLyricLines);
  const prevTrackRef = useRef<{ id?: string; rev?: number; count?: number }>({
    id: currentSong?.id,
    rev: lyricsRevision,
    count: canonicalLyricLines.length
  });
  if (
    currentSong?.id !== prevTrackRef.current.id ||
    lyricsRevision !== prevTrackRef.current.rev ||
    canonicalLyricLines.length !== prevTrackRef.current.count
  ) {
    prevTrackRef.current = { id: currentSong?.id, rev: lyricsRevision, count: canonicalLyricLines.length };
    setDisplayedLines(canonicalLyricLines);
  }
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const translationRequestRef = useRef<number>(0);

  // Synchronize displayedLines for listening meaning without altering canonical primary lyrics
  useEffect(() => {
    const requestId = ++translationRequestRef.current;

    if (!currentSong || !canonicalLyricLines || canonicalLyricLines.length === 0) {
      setDisplayedLines([]);
      setIsTranslating(false);
      return;
    }

    const songOrig = (currentSong.originalLanguage || (currentSong as any).original_language || sourceLanguage || 'en') as string;

    // 1. If listening meaning language is the song's original language, canonical lines are already complete
    if (listeningMeaningLanguage === songOrig) {
      setDisplayedLines(canonicalLyricLines);
      setIsTranslating(false);
      return;
    }

    // 2. If canonical lines already have listening meaning or translation for this language, use canonical directly
    const hasMeaningOnLines = canonicalLyricLines.some(
      (l) => Boolean(l.listening_meaning?.[listeningMeaningLanguage] || l.translations?.[listeningMeaningLanguage])
    );
    if (hasMeaningOnLines) {
      setDisplayedLines(canonicalLyricLines);
      setIsTranslating(false);
      return;
    }

    // 3. Check synchronous cache
    const cached = lyricsService.getCachedTranslation(canonicalLyricLines, listeningMeaningLanguage, currentSong.id, songOrig);
    if (cached) {
      setDisplayedLines(cached);
      setIsTranslating(false);
      return;
    }

    // 4. Otherwise fetch translation asynchronously to enrich secondary meaning track
    setIsTranslating(true);
    lyricsService.translateLyricLines(canonicalLyricLines, listeningMeaningLanguage, songOrig, currentSong.id, true)
      .then((translated) => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(translated);
          setIsTranslating(false);
        }
      })
      .catch(() => {
        if (translationRequestRef.current === requestId) {
          setDisplayedLines(canonicalLyricLines);
          setIsTranslating(false);
        }
      });
  }, [canonicalLyricLines, listeningMeaningLanguage, sourceLanguage, currentSong, lyricsRevision]);

  const hasLyrics = displayedLines.length > 0 && lyricsCapability !== 'LYRICS_UNAVAILABLE';

  // Active lyric index strictly derived from authoritative currentTime
  const activeLyricIndex = useMemo(() => {
    if (!hasLyrics || !isSynced || !currentSong) return -1;
    return lyricsService.getActiveLyricIndex(displayedLines, currentTime, currentSong.lyricsOffsetMs || 0);
  }, [hasLyrics, isSynced, displayedLines, currentTime, currentSong]);

  const lastActiveLyricIndexRef = useRef<number>(-1);

  // Smooth scroll active lyric within the dedicated lyrics container ONLY (prevents outer main/page from scrolling)
  // Immediate snapping on large jumps/seeking prevents disorienting animated travel
  useEffect(() => {
    const container = lyricsContainerRef.current;
    const activeEl = activeLyricRef.current;
    if (container && activeEl) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const isLargeJump = Math.abs(activeLyricIndex - lastActiveLyricIndexRef.current) > 1;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScroll = relativeTop - (container.clientHeight / 2) + (activeRect.height / 2);

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: (prefersReduced || isLargeJump) ? 'auto' : 'smooth'
      });
    }
    lastActiveLyricIndexRef.current = activeLyricIndex;
  }, [activeLyricIndex]);

  const isPopStateClosingRef = useRef<boolean>(false);

  // Reliable, universal exit mechanism: Closes expanded Now Playing, exits browser fullscreen if active, cleanly handles browser history
  const handleExit = React.useCallback(() => {
    // 1. Exit native browser fullscreen if active
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }

    const cleanupHistory = () => {
      if (typeof window !== 'undefined' && window.history.state?.naroNowPlaying && !isPopStateClosingRef.current) {
        isPopStateClosingRef.current = true;
        window.history.back();
        setTimeout(() => {
          isPopStateClosingRef.current = false;
        }, 100);
      }
    };

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      closeNowPlaying();
      cleanupHistory();
      return;
    }

    // 2. Smoothly slide down to mini-player
    setIsClosing(true);
    setTimeout(() => {
      closeNowPlaying();
      setIsClosing(false);
      cleanupHistory();
    }, 250);
  }, [closeNowPlaying]);

  // Synchronize with mobile browser back gesture / Android back button with hierarchical dismissal
  useEffect(() => {
    if (!nowPlayingOpen) return;

    // Push history state if not already pushed
    if (typeof window !== 'undefined' && !window.history.state?.naroNowPlaying) {
      window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
    }

    const handlePopState = () => {
      // 1. Language Picker (innermost overlay)
      if (isLangPickerOpen) {
        closeLangPicker();
        window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
        return;
      }
      // 2. Queue Bottom Sheet
      if (isQueueOpen) {
        closeQueue();
        window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
        return;
      }
      // 3. Three-dot Overflow Menu
      if (isMoreMenuOpen) {
        closeMoreMenu();
        window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
        return;
      }
      // 4. Mobile Synced Lyrics Sheet
      if (isMobileLyricsOpen) {
        closeMobileLyrics();
        window.history.pushState({ naroNowPlaying: true }, '', window.location.href);
        return;
      }

      // 4. Fullscreen Now Playing Modal
      isPopStateClosingRef.current = true;
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
      closeNowPlaying();
      setTimeout(() => {
        isPopStateClosingRef.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [nowPlayingOpen, isLangPickerOpen, isQueueOpen, isMoreMenuOpen, isMobileLyricsOpen, closeLangPicker, closeQueue, closeMoreMenu, closeMobileLyrics, closeNowPlaying]);

  // Keyboard accessibility: Escape to hierarchically exit, Space to toggle play
  useEffect(() => {
    if (!nowPlayingOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLangPickerOpen) {
          closeLangPicker();
          return;
        }
        if (isQueueOpen) {
          closeQueue();
          return;
        }
        if (isMoreMenuOpen) {
          closeMoreMenu();
          return;
        }
        if (isMobileLyricsOpen) {
          closeMobileLyrics();
          return;
        }
        handleExit();
      } else if (
        e.key === ' ' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nowPlayingOpen, isQueueOpen, isMoreMenuOpen, isLangPickerOpen, isMobileLyricsOpen, closeQueue, closeLangPicker, closeMoreMenu, closeMobileLyrics, handleExit, togglePlay]);

  // Close more menu when clicking outside (desktop dropdown fallback)
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.now-playing-more-backdrop') && !target.closest('.now-playing-more-menu')) {
          closeMoreMenu();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMoreMenuOpen, closeMoreMenu]);

  // Lock background document scroll while Now Playing overlay is active
  useEffect(() => {
    if (!nowPlayingOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevDocOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevDocOverflow;
    };
  }, [nowPlayingOpen]);

  if (!nowPlayingOpen) return null;

  if (!currentSong) {
    return (
      <div
        id="naro-now-playing"
        data-testid="naro-now-playing"
        role="dialog"
        aria-label="Now Playing"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          backgroundColor: '#080B10',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <button
          id="minimize-now-playing-btn"
          data-testid="minimize-now-playing-btn"
          data-close-now-playing="true"
          onClick={handleExit}
          aria-label="Close full screen player"
          className="now-playing-minimize-btn"
          title="Close full screen player (Esc)"
          style={{ position: 'absolute', top: '16px', left: '16px' }}
        >
          <ChevronLeft size={24} />
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '16px' }}>
          No track currently selected.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={handleExit}
          style={{ padding: '8px 24px' }}
        >
          Back to catalog
        </button>
      </div>
    );
  }

  const isPreview = Boolean(
    currentSong.isStreamPreview ||
    currentSong.playbackType === 'preview' ||
    currentSong.playbackSourceType === 'preview'
  );
  const canonicalDuration = getCanonicalTrackDuration(currentSong);
  const effectiveDuration = isPreview
    ? (duration > 0 && duration <= 60 ? duration : canonicalDuration)
    : (duration > 0 ? duration : canonicalDuration);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 0.8);
    }
  };

  return (
    <div
      id="naro-now-playing"
      data-testid="naro-now-playing"
      role="dialog"
      aria-label={`Now Playing: ${currentSong.title}`}
      className={`now-playing-root ${isClosing ? 'now-playing-closing' : ''}`}
      style={{
        ['--ambient-primary' as any]: artworkColors.primary,
        ['--ambient-secondary' as any]: artworkColors.secondary,
        ['--ambient-accent' as any]: artworkColors.accent,
        ['--ambient-glow' as any]: artworkColors.ambientGlow
      }}
    >
      {/* =========================================================================
          EMOTIONAL ATMOSPHERE BACKDROP
          Cinematic, dynamic artwork mesh and restrained visual languages
          ========================================================================= */}
      <div
        id="now-playing-atmosphere"
        data-mood={mood}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          transition: 'background 0.8s ease'
        }}
      >
        {/* Dynamic Fluid Artwork Mesh Gradient (BitChord style) */}
        <div
          className="now-playing-ambient-mesh"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 18%, var(--ambient-primary, rgba(231, 165, 141, 0.32)) 0%, var(--ambient-secondary, rgba(99, 102, 241, 0.20)) 45%, rgba(7, 9, 14, 0.96) 82%)',
            transition: 'background 0.8s ease-in-out'
          }}
        />

        {/* Ambient Soft Radial Glow behind Album Artwork */}
        <div
          className="now-playing-ambient-bloom"
          style={{
            position: 'absolute',
            top: '12%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(520px, 92vw)',
            height: 'min(520px, 92vw)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--ambient-primary, rgba(231, 165, 141, 0.36)) 0%, transparent 70%)',
            filter: 'blur(60px)',
            opacity: 0.85,
            transition: 'background 0.8s ease-in-out'
          }}
        />
        {/* Mood-Specific Layering */}
        {mood === 'romance' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 50% 25%, rgba(225, 29, 72, 0.20) 0%, rgba(245, 158, 11, 0.12) 35%, rgba(7, 9, 14, 0.98) 80%)'
            }}
          >
            {/* Restrained Heart-Inspired Warm Radiance Elements */}
            <div
              className="animate-heart-glow"
              style={{
                position: 'absolute',
                top: '18%',
                left: '28%',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(225, 29, 72, 0.25) 0%, transparent 70%)',
                filter: 'blur(45px)'
              }}
            />
            <div
              className="animate-heart-glow"
              style={{
                position: 'absolute',
                top: '22%',
                right: '25%',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
                filter: 'blur(55px)',
                animationDelay: '2.5s'
              }}
            />
          </div>
        )}

        {mood === 'sad' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 20%, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.75) 45%, rgba(6, 8, 12, 0.98) 85%)'
            }}
          >
            {/* Restrained Night Rain Streaks */}
            <div
              className="animate-rain-1"
              style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                width: '1px',
                height: '140px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.35), transparent)'
              }}
            />
            <div
              className="animate-rain-2"
              style={{
                position: 'absolute',
                top: 0,
                left: '45%',
                width: '1px',
                height: '180px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.45), transparent)'
              }}
            />
            <div
              className="animate-rain-3"
              style={{
                position: 'absolute',
                top: 0,
                left: '72%',
                width: '1px',
                height: '130px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.35), transparent)'
              }}
            />
            <div
              className="animate-rain-1"
              style={{
                position: 'absolute',
                top: 0,
                left: '88%',
                width: '1px',
                height: '160px',
                background: 'linear-gradient(180deg, transparent, rgba(148, 163, 184, 0.4), transparent)',
                animationDelay: '1.4s'
              }}
            />
          </div>
        )}

        {mood === 'solaris' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 55% 30%, rgba(245, 158, 11, 0.22) 0%, rgba(56, 189, 248, 0.12) 40%, rgba(7, 9, 14, 0.98) 85%)'
            }}
          >
            {/* Golden Hour Sunlight Bloom & Drifting Dust Motes */}
            <div
              className="animate-solaris-bloom"
              style={{
                position: 'absolute',
                top: '15%',
                left: '30%',
                width: '420px',
                height: '420px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, transparent 68%)',
                filter: 'blur(50px)'
              }}
            />
            <div
              className="animate-dust-1"
              style={{
                position: 'absolute',
                top: '35%',
                left: '25%',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'rgba(254, 243, 199, 0.7)',
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.8)'
              }}
            />
            <div
              className="animate-dust-2"
              style={{
                position: 'absolute',
                top: '45%',
                left: '40%',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                backgroundColor: 'rgba(254, 243, 199, 0.6)',
                boxShadow: '0 0 6px rgba(245, 158, 11, 0.7)'
              }}
            />
            <div
              className="animate-dust-3"
              style={{
                position: 'absolute',
                top: '28%',
                right: '30%',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'rgba(56, 189, 248, 0.7)',
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.8)'
              }}
            />
          </div>
        )}

        {mood === 'midnight' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 50% 25%, rgba(99, 102, 241, 0.20) 0%, rgba(30, 27, 75, 0.4) 40%, rgba(7, 9, 14, 0.98) 85%)'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '20%',
                left: '35%',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(129, 140, 248, 0.25) 0%, transparent 70%)',
                filter: 'blur(55px)'
              }}
            />
          </div>
        )}
      </div>

      {/* =========================================================================
          TOP BAR / HEADER
          Minimize button, Playing context, Capability badge
          ========================================================================= */}
      <header className="now-playing-header">
        {/* Persistent Obvious Close/Back Control (Top-Left, min 44x44px touch target) */}
        <button
          id="minimize-now-playing-btn"
          data-testid="minimize-now-playing-btn"
          data-close-now-playing="true"
          onClick={handleExit}
          aria-label="Close full screen player"
          className="now-playing-minimize-btn"
          title="Close full screen player (Esc)"
        >
          <ChevronDown size={24} />
        </button>

        {/* Center Title Context */}
        <div
          className="now-playing-header-center"
          onClick={() => {
            handleExit();
            setCurrentView('home');
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          title="HyperMelo Home (Click to return to Home)"
          aria-label="HyperMelo Home"
        >
          <span className="now-playing-header-eyebrow">
            PLAYING FROM HYPERMELO
          </span>
          <div className="now-playing-header-context">
            {currentSong.album || currentSong.title}
          </div>
        </div>

        {/* Header Right Cluster: Mood Indicator & More Options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={moreMenuRef}>
          <div
            title={`Atmosphere: ${mood}`}
            className="now-playing-mood-badge"
          >
            {mood === 'romance' && <Heart size={15} color="#FB7185" />}
            {mood === 'sad' && <CloudRain size={15} color="#94A3B8" />}
            {mood === 'solaris' && <Sun size={15} color="#FBBF24" />}
            {mood === 'midnight' && <Moon size={15} color="#818CF8" />}
          </div>

          {/* Three-Dot Menu Button */}
          <button
            type="button"
            id="now-playing-more-btn"
            data-testid="now-playing-more-btn"
            className="now-playing-more-btn"
            aria-label="More options"
            aria-expanded={isMoreMenuOpen}
            aria-haspopup="true"
            onClick={() => (isMoreMenuOpen ? closeMoreMenu() : openMoreMenu())}
            title="More options"
          >
            <MoreVertical size={20} />
          </button>

          {/* More Menu Backdrop (for outside dismissal on mobile) */}
          {(isMoreMenuOpen || isMoreMenuClosing) && (
            <div
              className={`now-playing-more-backdrop ${isMoreMenuClosing ? 'closing' : ''}`}
              onClick={() => closeMoreMenu()}
              aria-hidden="true"
            />
          )}

          {/* Three-Dot Bottom Sheet / Menu with smooth transition */}
          {(isMoreMenuOpen || isMoreMenuClosing) && (
            <div
              id="now-playing-more-menu"
              data-testid="now-playing-more-menu"
              className={`now-playing-more-menu ${isMoreMenuClosing ? 'closing' : ''}`}
              role="menu"
              aria-label="Player options"
              style={menuDragOffset > 0 ? { transform: `translateY(${menuDragOffset}px)`, transition: 'none' } : undefined}
            >
              {/* Drag handle for mobile swipe-down */}
              <div
                className="now-playing-menu-handle-bar"
                onTouchStart={handleMenuTouchStart}
                onTouchMove={handleMenuTouchMove}
                onTouchEnd={handleMenuTouchEnd}
              >
                <div className="now-playing-menu-handle" />
              </div>

              {/* Track Header Card */}
              <div className="now-playing-menu-track-header">
                <div className="now-playing-menu-thumb">
                  <AbstractArtwork artwork={currentSong.artwork} song={currentSong} size={44} />
                </div>
                <div className="now-playing-menu-meta">
                  <div className="now-playing-menu-title">{currentSong.title}</div>
                  <div className="now-playing-menu-artist">{currentSong.artist}</div>
                </div>
                <button
                  type="button"
                  className="now-playing-menu-close-btn"
                  aria-label="Close menu"
                  onClick={() => closeMoreMenu()}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Toast Feedback */}
              {menuToast && (
                <div className="now-playing-menu-toast" role="status">
                  <Check size={14} color="#34D399" />
                  <span>{menuToast}</span>
                </div>
              )}

              {/* Track Actions Section */}
              <div className="now-playing-menu-actions-group">
                <button
                  type="button"
                  id="now-playing-menu-like-btn"
                  data-testid="now-playing-menu-like-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={() => {
                    toggleLikeSong(currentSong);
                    showToast(isSongLiked(currentSong.id) ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
                  }}
                >
                  <Heart
                    size={18}
                    fill={isSongLiked(currentSong.id) ? '#EF4444' : 'none'}
                    color={isSongLiked(currentSong.id) ? '#EF4444' : 'currentColor'}
                  />
                  <span>{isSongLiked(currentSong.id) ? 'Liked' : 'Like'}</span>
                </button>

                <button
                  type="button"
                  id="now-playing-menu-add-playlist-btn"
                  data-testid="now-playing-menu-add-playlist-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={() => {
                    closeMoreMenu();
                    openAddToPlaylist(currentSong);
                  }}
                >
                  <ListPlus size={18} />
                  <span>Add to Playlist</span>
                </button>

                <button
                  type="button"
                  id="now-playing-menu-library-btn"
                  data-testid="now-playing-menu-library-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={() => {
                    downloadSong(currentSong);
                    showToast(isSongDownloaded(currentSong.id) ? 'Removed from Offline Library' : 'Saved to Offline Library');
                  }}
                >
                  {isSongDownloaded(currentSong.id) ? (
                    <BookmarkCheck size={18} color="#34D399" />
                  ) : (
                    <Bookmark size={18} />
                  )}
                  <span>{isSongDownloaded(currentSong.id) ? 'Downloaded to Library' : 'Save to Library'}</span>
                </button>

                <button
                  type="button"
                  id="now-playing-menu-share-btn"
                  data-testid="now-playing-menu-share-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={async () => {
                    const url = `${window.location.origin}/?track=${encodeURIComponent(currentSong.id)}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `${currentSong.title} - ${currentSong.artist}`,
                          text: `Listen to "${currentSong.title}" by ${currentSong.artist} on HyperMelo`,
                          url
                        });
                        showToast('Shared successfully');
                        return;
                      } catch (err: any) {
                        if (err.name === 'AbortError') return;
                      }
                    }
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url).catch(() => { });
                    }
                    showToast('Song link copied to clipboard');
                  }}
                >
                  <Share2 size={18} />
                  <span>Share Song</span>
                </button>

                <button
                  type="button"
                  id="now-playing-share-moment-btn"
                  data-testid="now-playing-share-moment-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={() => {
                    closeMoreMenu();
                    openShareMoment(currentSong);
                  }}
                >
                  <Sparkles size={18} color="var(--accent-warm)" />
                  <span>Share Moment</span>
                </button>

                <button
                  type="button"
                  id="now-playing-menu-copy-link-btn"
                  data-testid="now-playing-menu-copy-link-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  onClick={() => {
                    const url = `${window.location.origin}/?track=${encodeURIComponent(currentSong.id)}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url).catch(() => { });
                    }
                    showToast('Song link copied to clipboard');
                  }}
                >
                  <Copy size={18} />
                  <span>Copy Song Link</span>
                </button>
              </div>

              <div className="now-playing-menu-section-divider" />

              {/* Information Section */}
              <div className="now-playing-menu-actions-group">
                <button
                  type="button"
                  id="now-playing-menu-track-info-btn"
                  data-testid="now-playing-menu-track-info-btn"
                  role="menuitem"
                  className="now-playing-menu-item"
                  aria-expanded={showTrackDetails}
                  onClick={() => setShowTrackDetails(!showTrackDetails)}
                >
                  <Info size={18} />
                  <span>Song Credits & Information</span>
                  <ChevronDown
                    size={16}
                    style={{
                      marginLeft: 'auto',
                      transform: showTrackDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </button>

                {showTrackDetails && (
                  <div
                    id="now-playing-track-details-panel"
                    data-testid="now-playing-track-details-panel"
                    className="now-playing-track-details-panel"
                  >
                    <div className="track-detail-row">
                      <span className="track-detail-key">Track:</span>
                      <span className="track-detail-val">{currentSong.title}</span>
                    </div>
                    <div className="track-detail-row">
                      <span className="track-detail-key">Artist:</span>
                      <span className="track-detail-val">{currentSong.artist}</span>
                    </div>
                    <div className="track-detail-row">
                      <span className="track-detail-key">Album:</span>
                      <span className="track-detail-val">{currentSong.album || 'Single'}</span>
                    </div>
                    <div className="track-detail-row">
                      <span className="track-detail-key">Duration:</span>
                      <span className="track-detail-val">{formatTime(effectiveDuration)}</span>
                    </div>
                    <div className="track-detail-row">
                      <span className="track-detail-key">Provider:</span>
                      <span className="track-detail-val">{currentSong.playbackProvider || currentSong.playbackSourceType || 'NARO Engine'}</span>
                    </div>
                    {getConsumerLicenseLabel(currentSong.attribution) && (
                      <div className="track-detail-row">
                        <span className="track-detail-key">License:</span>
                        <span className="track-detail-val">{getConsumerLicenseLabel(currentSong.attribution)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="now-playing-menu-section-divider" />

              {/* Audiophile Sound Engine Section inside Overflow Menu */}
              <div id="now-playing-menu-audiophile-wrap" className="now-playing-menu-audiophile-wrap">
                <button
                  type="button"
                  className="now-playing-menu-audiophile-header"
                  onClick={() => setIsMenuAudiophileExpanded(!isMenuAudiophileExpanded)}
                  aria-expanded={isMenuAudiophileExpanded}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={16} color="var(--accent-warm)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F4F0EB' }}>
                      Audiophile Sound Engine
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isMenuAudiophileExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: 'var(--text-muted)'
                    }}
                  />
                </button>

                {isMenuAudiophileExpanded && (
                  <div className="now-playing-menu-audiophile-body">
                    <div className="now-playing-menu-modes-grid" role="radiogroup" aria-label="Menu Sound Modes">
                      <button
                        type="button"
                        id="now-playing-menu-mode-original"
                        role="radio"
                        aria-checked={soundMode === 'original'}
                        className={`now-playing-menu-mode-btn ${soundMode === 'original' ? 'active' : ''}`}
                        onClick={() => setSoundMode('original')}
                        disabled={!isDspSupported}
                      >
                        <span className="mode-btn-title">Original</span>
                        <span className="mode-btn-sub">Bypass</span>
                      </button>
                      <button
                        type="button"
                        id="now-playing-menu-mode-immersive"
                        role="radio"
                        aria-checked={soundMode === 'immersive'}
                        className={`now-playing-menu-mode-btn ${soundMode === 'immersive' ? 'active' : ''}`}
                        onClick={() => setSoundMode('immersive')}
                        disabled={!isDspSupported}
                      >
                        <span className="mode-btn-title">Immersive</span>
                        <span className="mode-btn-sub">3D Stage</span>
                      </button>
                      <button
                        type="button"
                        id="now-playing-menu-mode-punch"
                        role="radio"
                        aria-checked={soundMode === 'punch'}
                        className={`now-playing-menu-mode-btn ${soundMode === 'punch' ? 'active' : ''}`}
                        onClick={() => setSoundMode('punch')}
                        disabled={!isDspSupported}
                      >
                        <span className="mode-btn-title">Punch</span>
                        <span className="mode-btn-sub">JBL Impact</span>
                      </button>
                    </div>

                    <div className="now-playing-menu-bass-wrap">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Bass Intensity</span>
                        <span style={{ fontWeight: 700, color: bassIntensity > 0 ? '#FCD34D' : 'var(--text-dim)' }}>
                          {bassIntensity === 0 ? '0 dB' : `${bassIntensity > 0 ? '+' : ''}${bassIntensity * 1.5} dB`}
                        </span>
                      </div>
                      <input
                        id="now-playing-menu-bass-slider"
                        type="range"
                        min={-5}
                        max={5}
                        step={1}
                        value={bassIntensity}
                        disabled={!isDspSupported || soundMode === 'original'}
                        onChange={(e) => setBassIntensity(parseInt(e.target.value, 10))}
                        aria-label="Menu Bass Intensity"
                        style={{ width: '100%', accentColor: 'var(--accent-warm)', height: '4px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================================
          MAIN EXPERIENCE VIEWPORT
          Left: Expanded Hero Artwork & Metadata
          Right: Integrated Synced Lyrics Composition
          ========================================================================= */}
      <main
        id="now-playing-main"
        className={`now-playing-main ${isMobileLyricsOpen ? 'mobile-lyrics-active' : ''} ${isLyricsClosing ? 'mobile-lyrics-closing' : ''} ${isQueueActive ? 'queue-active' : ''}`}
      >
        {/* Left Column: Expanded Artwork Hero */}
        <section
          aria-label="Track Information and Artwork"
          className="now-playing-left-col"
        >
          {/* Expanded Artwork with Ambient Outer Glow and Real Album Artwork */}
          <div
            id="now-playing-artwork-container"
            className={`now-playing-artwork-wrap ${isPlaying ? 'is-playing' : ''}`}
          >
            <AbstractArtwork
              artwork={currentSong.artwork}
              song={currentSong}
              isPlaying={isPlaying}
              size="100%"
              alt={`${currentSong.title} by ${currentSong.artist}`}
            />
          </div>

          {/* Song Metadata */}
          <div className="now-playing-metadata">
            <h1
              id="now-playing-title"
              className="now-playing-title"
            >
              {currentSong.title}
            </h1>
            <p
              id="now-playing-artist"
              className="now-playing-artist"
            >
              {currentSong.artist}
            </p>

            {/* Song Meta Badges */}
            <div className="now-playing-badges">
              {isPreview && (
                <span
                  id="now-playing-preview-badge"
                  data-testid="now-playing-preview-badge"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    color: 'var(--accent-warm)',
                    border: '1px solid rgba(231, 165, 141, 0.3)'
                  }}
                  title="30-second official preview stream"
                >
                  PREVIEW (30s)
                </span>
              )}
              {currentSong.genre && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(244, 240, 235, 0.08)',
                    color: 'var(--text-dim, #94A3B8)'
                  }}
                >
                  {currentSong.genre}
                </span>
              )}
              {getConsumerLicenseLabel(currentSong.attribution) && (
                <span
                  id="now-playing-license-badge"
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(244, 240, 235, 0.06)',
                    color: 'var(--text-dim, #94A3B8)',
                    border: '1px solid rgba(244, 240, 235, 0.12)'
                  }}
                  title={currentSong.attribution?.text}
                >
                  {getConsumerLicenseLabel(currentSong.attribution)}
                </span>
              )}
            </div>

            {/* Action Row: Like, Add to Playlist, Share Moment */}
            <div className="now-playing-actions">
              <button
                id="now-playing-like-btn"
                data-testid="now-playing-like-btn"
                onClick={() => toggleLikeSong(currentSong)}
                className="now-playing-action-btn"
                style={{
                  color: isSongLiked(currentSong.id) ? '#EF4444' : 'var(--text-muted)'
                }}
                title={isSongLiked(currentSong.id) ? 'Unlike' : 'Like'}
              >
                <Heart size={18} fill={isSongLiked(currentSong.id) ? '#EF4444' : 'none'} />
              </button>

              <button
                id="now-playing-add-playlist-btn"
                data-testid="now-playing-add-playlist-btn"
                onClick={() => openAddToPlaylist(currentSong)}
                className="now-playing-action-btn"
                title="Add to Playlist"
              >
                <Plus size={18} />
              </button>

              <button
                id="now-playing-share-btn"
                data-testid="now-playing-share-btn"
                onClick={() => openShareMoment(currentSong)}
                className="now-playing-action-btn"
                title="Share Moment"
                aria-label="Share Moment"
              >
                <Share2 size={18} />
              </button>
            </div>

            {/* Intelligent Empty Space Fillers: Subtle Audio-Reactive Visualizer & Up Next Preview */}
            <div className="now-playing-mobile-fillers">
              {/* Subtle Audio-reactive Ambient Glow / Equalizer */}
              <div
                id="now-playing-audio-visualizer"
                data-testid="now-playing-audio-visualizer"
                className={`now-playing-audio-visualizer ${isPlaying ? 'playing' : 'paused'}`}
                aria-label={isPlaying ? 'Audio visualizer active' : 'Audio visualizer idle'}
              >
                <span className="now-playing-visualizer-bar" />
                <span className="now-playing-visualizer-bar" />
                <span className="now-playing-visualizer-bar" />
                <span className="now-playing-visualizer-bar" />
                <span className="now-playing-visualizer-bar" />
              </div>

              {/* Up Next Preview Pill */}
              <button
                type="button"
                id="now-playing-up-next-preview"
                data-testid="now-playing-up-next-preview"
                className="now-playing-up-next-preview"
                onClick={() => openQueue()}
                aria-label={nextTrack ? `Up Next: ${nextTrack.title} by ${nextTrack.artist}. Tap to open queue.` : 'Open play queue'}
              >
                <ListMusic size={14} color="var(--accent-warm, #E7A58D)" />
                <span className="now-playing-up-next-label">
                  {nextTrack ? (
                    <>
                      <span className="up-next-prefix">Up Next:</span>{' '}
                      <span className="up-next-track-info">{nextTrack.title} • {nextTrack.artist}</span>
                    </>
                  ) : (
                    <>
                      <span className="up-next-prefix">Play Queue:</span>{' '}
                      <span className="up-next-track-info">{queue.length} track{queue.length === 1 ? '' : 's'}</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* NARO Audiophile Listening Engine Suite */}
            <div
              id="now-playing-audiophile-suite"
              data-testid="now-playing-audiophile-suite"
              className="now-playing-sound-controls now-playing-sound-controls-desktop"
            >
              {/* Accessible Header Toggle: title, status badge, and chevron indicator */}
              <button
                type="button"
                id="now-playing-sound-btn"
                data-testid="now-playing-sound-btn"
                aria-label="Toggle Audiophile Sound Engine"
                onClick={() => setIsAudiophileExpanded((prev) => !prev)}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                id="now-playing-audiophile-toggle"
                data-testid="now-playing-audiophile-toggle"
                aria-expanded={isAudiophileExpanded}
                aria-controls="now-playing-audiophile-controls"
                aria-label={isAudiophileExpanded ? 'Collapse Audiophile Sound Engine' : 'Expand Audiophile Sound Engine'}
                onClick={() => setIsAudiophileExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  minHeight: '44px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                  color: 'inherit',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={14} color="var(--accent-warm)" />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)'
                    }}
                  >
                    Audiophile Sound Engine
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isAudiophileExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      color: 'var(--text-muted)'
                    }}
                  />
                </div>

                <span
                  id="now-playing-dsp-status-badge"
                  data-testid="now-playing-dsp-status-badge"
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: !isDspSupported
                      ? 'rgba(239, 68, 68, 0.15)'
                      : soundMode === 'original'
                        ? 'rgba(148, 163, 184, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                    color: !isDspSupported
                      ? '#F87171'
                      : soundMode === 'original'
                        ? '#94A3B8'
                        : '#4ADE80',
                    border: `1px solid ${!isDspSupported
                      ? 'rgba(239, 68, 68, 0.3)'
                      : soundMode === 'original'
                        ? 'rgba(148, 163, 184, 0.3)'
                        : 'rgba(34, 197, 94, 0.3)'
                      }`
                  }}
                  title={
                    !isDspSupported
                      ? 'Audio provider bypasses Web Audio processing (e.g. YouTube iframe or Apple DRM)'
                      : soundMode === 'original'
                        ? 'Pure neutral bypass: zero coloration, bit-perfect reproduction'
                        : 'Web Audio DSP chain active with safety limiter'
                  }
                >
                  {!isDspSupported
                    ? 'DSP BYPASS'
                    : soundMode === 'original'
                      ? 'ORIGINAL (BYPASS)'
                      : 'DSP ACTIVE'}
                </span>
              </button>

              {/* Collapsible Audiophile Controls Container */}
              <div
                id="now-playing-audiophile-controls"
                data-testid="now-playing-audiophile-controls"
                style={{
                  display: isAudiophileExpanded ? 'block' : 'none',
                  width: '100%',
                  marginTop: '6px'
                }}
              >

                {/* Listening Mode Buttons: Original, Immersive, Punch */}
                <div
                  role="radiogroup"
                  aria-label="Audiophile Listening Modes"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    width: '100%'
                  }}
                >
                  {/* 1. Original */}
                  <button
                    type="button"
                    id="now-playing-mode-original"
                    data-testid="now-playing-mode-original"
                    role="radio"
                    aria-checked={soundMode === 'original'}
                    onClick={() => setSoundMode('original')}
                    disabled={!isDspSupported}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: soundMode === 'original'
                        ? '1px solid rgba(244, 240, 235, 0.3)'
                        : '1px solid rgba(244, 240, 235, 0.08)',
                      backgroundColor: soundMode === 'original'
                        ? 'rgba(244, 240, 235, 0.14)'
                        : 'rgba(244, 240, 235, 0.04)',
                      color: soundMode === 'original' ? '#F4F0EB' : 'var(--text-dim)',
                      cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      opacity: !isDspSupported ? 0.5 : 1
                    }}
                    title="Faithful pure source reproduction with safety limiter"
                  >
                    <div>Original</div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>Bypass</div>
                  </button>

                  {/* 2. Immersive */}
                  <button
                    type="button"
                    id="now-playing-mode-immersive"
                    data-testid="now-playing-mode-immersive"
                    role="radio"
                    aria-checked={soundMode === 'immersive'}
                    onClick={() => setSoundMode('immersive')}
                    disabled={!isDspSupported}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: soundMode === 'immersive'
                        ? '1px solid var(--accent-warm)'
                        : '1px solid rgba(244, 240, 235, 0.08)',
                      backgroundColor: soundMode === 'immersive'
                        ? 'rgba(231, 165, 141, 0.22)'
                        : 'rgba(244, 240, 235, 0.04)',
                      color: soundMode === 'immersive' ? 'var(--accent-cream)' : 'var(--text-dim)',
                      cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      opacity: !isDspSupported ? 0.5 : 1
                    }}
                    title="Expansive 3D acoustic staging with centered vocals & warm bass"
                  >
                    <div>Immersive</div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>Cinema 3D</div>
                  </button>

                  {/* 3. Punch */}
                  <button
                    type="button"
                    id="now-playing-mode-punch"
                    data-testid="now-playing-mode-punch"
                    role="radio"
                    aria-checked={soundMode === 'punch'}
                    onClick={() => setSoundMode('punch')}
                    disabled={!isDspSupported}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: soundMode === 'punch'
                        ? '1px solid #F59E0B'
                        : '1px solid rgba(244, 240, 235, 0.08)',
                      backgroundColor: soundMode === 'punch'
                        ? 'rgba(245, 158, 11, 0.22)'
                        : 'rgba(244, 240, 235, 0.04)',
                      color: soundMode === 'punch' ? '#FCD34D' : 'var(--text-dim)',
                      cursor: !isDspSupported ? 'not-allowed' : 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      opacity: !isDspSupported ? 0.5 : 1
                    }}
                    title="JBL-inspired energetic punch with tight kick & clear transients"
                  >
                    <div>Punch</div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 400, opacity: 0.7 }}>JBL Impact</div>
                  </button>
                </div>

                {/* Dynamic Active DSP Description Banner */}
                <div
                  id="now-playing-dsp-description"
                  data-testid="now-playing-dsp-description"
                  aria-live="polite"
                  style={{
                    marginTop: '8px',
                    fontSize: '0.64rem',
                    lineHeight: 1.35,
                    color: !isDspSupported
                      ? '#F87171'
                      : soundMode === 'original'
                        ? '#94A3B8'
                        : '#FCD34D',
                    backgroundColor: 'rgba(0, 0, 0, 0.28)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: `1px solid ${!isDspSupported
                      ? 'rgba(239, 68, 68, 0.2)'
                      : soundMode === 'original'
                        ? 'rgba(148, 163, 184, 0.15)'
                        : 'rgba(245, 158, 11, 0.2)'
                      }`,
                    textAlign: 'center',
                    width: '100%',
                    letterSpacing: '0.02em',
                    fontFamily: 'monospace'
                  }}
                >
                  {activeDspDescription || (!isDspSupported ? 'DSP Bypassed for Provider' : 'Bypass (Neutral flat response)')}
                </div>

                {/* Enhancement Presets */}
                {isDspSupported && (
                  <div
                    className="now-playing-presets-container"
                    style={{
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      width: '100%'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        textAlign: 'center'
                      }}
                    >
                      Enhancement Presets {soundMode === 'original' && '(Engages DSP)'}
                    </div>
                    <div
                      className="now-playing-presets-row"
                      role="group"
                      aria-label="Sound Enhancement Presets"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        justifyContent: 'center',
                        width: '100%'
                      }}
                    >
                      {(['immersive', 'deep', 'vocal', 'wide', 'night'] as const).map((preset) => {
                        const isSelected = soundMode !== 'original' && soundPreset === preset;
                        const presetDescriptions: Record<string, { label: string; desc: string }> = {
                          immersive: { label: 'Standard', desc: 'Balanced 3D Soundstage' },
                          deep: { label: 'Deep', desc: 'Deeper low frequencies (+6 dB at 75 Hz)' },
                          vocal: { label: 'Vocal', desc: 'Clear vocal presence (+5.2 dB at 3.2 kHz)' },
                          wide: { label: 'Wide', desc: 'Expanded stereo separation (w = 1.90)' },
                          night: { label: 'Night', desc: 'Dynamic compression & gentle high rolloff' }
                        };
                        const info = presetDescriptions[preset];
                        return (
                          <button
                            key={preset}
                            type="button"
                            id={`now-playing-preset-${preset}`}
                            data-testid={`now-playing-preset-${preset}`}
                            aria-pressed={isSelected}
                            aria-label={`${info.label} Preset: ${info.desc}`}
                            title={`${info.label}: ${info.desc}`}
                            onClick={() => setSoundPreset(preset)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: isSelected
                                ? 'var(--accent-warm)'
                                : 'rgba(244, 240, 235, 0.06)',
                              color: isSelected ? '#080B10' : 'var(--text-dim)',
                              border: isSelected ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(244, 240, 235, 0.08)',
                              fontSize: '0.68rem',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bass Intensity Control (-5 to +5, neutral 0) */}
                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(244, 240, 235, 0.06)',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <label htmlFor="now-playing-bass-slider" style={{ fontWeight: 600 }}>
                      Bass Intensity:
                    </label>
                    <span
                      id="now-playing-bass-readout"
                      data-testid="now-playing-bass-readout"
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: bassIntensity > 0 ? '#FCD34D' : bassIntensity < 0 ? '#93C5FD' : 'var(--text-dim)'
                      }}
                    >
                      {bassIntensity === 0 ? 'Neutral (0 dB)' : `${bassIntensity > 0 ? '+' : ''}${bassIntensity * 1.5} dB (${bassIntensity})`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="now-playing-bass-slider"
                      data-testid="now-playing-bass-slider"
                      type="range"
                      min={-5}
                      max={5}
                      step={1}
                      value={bassIntensity}
                      disabled={!isDspSupported || soundMode === 'original'}
                      onChange={(e) => setBassIntensity(parseInt(e.target.value, 10))}
                      aria-label="Bass Intensity adjustment (-5 to +5)"
                      style={{
                        flex: 1,
                        accentColor: soundMode === 'punch' ? '#F59E0B' : 'var(--accent-warm)',
                        cursor: (!isDspSupported || soundMode === 'original') ? 'not-allowed' : 'pointer',
                        height: '4px',
                        opacity: (!isDspSupported || soundMode === 'original') ? 0.4 : 1
                      }}
                    />
                    {bassIntensity !== 0 && (
                      <button
                        type="button"
                        onClick={() => setBassIntensity(0)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(244, 240, 235, 0.12)',
                          borderRadius: '4px',
                          color: 'var(--text-dim)',
                          fontSize: '0.62rem',
                          padding: '1px 5px',
                          cursor: 'pointer'
                        }}
                        title="Reset bass to neutral"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Embedded Synced Lyrics Composition */}
        <section
          aria-label="Synchronized Lyrics"
          className="now-playing-lyrics-col"
          style={lyricsDragOffset > 0 ? { transform: `translateY(${lyricsDragOffset}px)`, transition: 'none' } : undefined}
        >
          {/* Mobile Drag Handle Bar for swipe-down dismissal */}
          <div
            className="now-playing-lyrics-drag-handle-bar"
            onTouchStart={handleLyricsTouchStart}
            onTouchMove={handleLyricsTouchMove}
            onTouchEnd={handleLyricsTouchEnd}
          >
            <div className="now-playing-lyrics-drag-handle" />
          </div>

          {/* Header Bar: Capability Badge & 5-Language Meaning Switcher */}
          <div
            id="now-playing-lyrics-header"
            className="now-playing-lyrics-header"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              <span
                id="now-playing-lyrics-capability-badge"
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  backgroundColor: (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                    ? 'rgba(245, 158, 11, 0.15)'
                    : isSynced
                      ? 'rgba(56, 189, 248, 0.15)'
                      : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                        ? 'rgba(244, 240, 235, 0.08)'
                        : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                          ? 'rgba(234, 179, 8, 0.15)'
                          : 'rgba(239, 68, 68, 0.12)',
                  color: (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                    ? '#F59E0B'
                    : isSynced
                      ? '#38BDF8'
                      : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                        ? 'var(--text-muted, #94A3B8)'
                        : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                          ? '#EAB308'
                          : '#F87171',
                  border: `1px solid ${(isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                    ? 'rgba(245, 158, 11, 0.3)'
                    : isSynced
                      ? 'rgba(56, 189, 248, 0.3)'
                      : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                        ? 'rgba(244, 240, 235, 0.15)'
                        : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                          ? 'rgba(234, 179, 8, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'
                    }`,
                  textTransform: 'uppercase'
                }}
                data-capability={lyricsCapability}
                data-outcome={lyricsResolution?.outcome || (isSynced ? 'SYNCED_VERIFIED' : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS') ? 'PLAIN_VERIFIED' : 'UNAVAILABLE')}
              >
                {(isResolvingLyrics || lyricsResolution?.outcome === 'PENDING')
                  ? 'SEARCHING...'
                  : isSynced
                    ? 'SYNCED'
                    : (displayedLines.length > 0 || lyricsCapability === 'PLAIN_LYRICS')
                      ? 'LYRICS'
                      : lyricsResolution?.outcome === 'TRANSIENT_FAILURE'
                        ? 'RETRYABLE'
                        : 'NO LYRICS FOUND'}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                Listening Mode • Original + Meaning
              </span>
              {isTranslating && (
                <span
                  id="now-playing-translating-badge"
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    color: 'var(--accent-warm, #E7A58D)',
                    border: '1px solid rgba(231, 165, 141, 0.3)'
                  }}
                >
                  Fetching meaning...
                </span>
              )}
            </div>

            {/* Mobile Meaning Language Selector Button & Script Indicator */}
            <div className="now-playing-mobile-lyrics-header-actions">
              <button
                type="button"
                id="now-playing-mobile-lang-btn"
                data-testid="now-playing-mobile-lang-btn"
                className="now-playing-mobile-lang-btn"
                aria-label="Select lyric translation language"
                onClick={() => openLangPicker()}
                title="Change lyric translation language"
              >
                <Languages size={15} />
                <span>{listeningMeaningLanguage.toUpperCase()}</span>
              </button>
              {(() => {
                const songOrigLang = (currentSong.originalLanguage || (currentSong as any).original_language || sourceLanguage || 'en') as string;
                const isIndic = ['te', 'ta', 'hi', 'ml'].includes(songOrigLang);
                if (isIndic && displayedLines.length > 0) {
                  const firstLineDisplay = getListeningLyricDisplay(displayedLines[0], listeningMeaningLanguage, songOrigLang);
                  if (firstLineDisplay.scriptType === 'romanized') {
                    const langNames: Record<string, string> = { te: 'Telugu', ta: 'Tamil', hi: 'Hindi', ml: 'Malayalam' };
                    return (
                      <span
                        id="now-playing-lyrics-script-badge"
                        data-testid="now-playing-lyrics-script-badge"
                        className="now-playing-lyrics-script-badge"
                        title={`Lyrics are in Romanized transliteration; genuine native ${langNames[songOrigLang]} script is unavailable`}
                      >
                        Romanized {langNames[songOrigLang] || ''}
                      </span>
                    );
                  }
                }
                return null;
              })()}
            </div>

            {/* Desktop 5-Language Meaning Selector: EN, HI, TE, TA, ML */}
            <div
              className="glass-pill now-playing-desktop-lang-selector"
              role="radiogroup"
              aria-label="Listening meaning language selection"
              id="now-playing-meaning-lang-selector"
              data-testid="now-playing-meaning-lang-selector"
              style={{
                display: 'inline-flex',
                padding: '2px',
                gap: '2px',
                backgroundColor: 'rgba(244, 240, 235, 0.04)',
                borderRadius: 'var(--radius-full, 9999px)',
                border: '1px solid rgba(244, 240, 235, 0.1)'
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = listeningMeaningLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    id={`now-playing-lang-${lang.code}`}
                    data-testid={`now-playing-lang-${lang.code}`}
                    role="radio"
                    aria-checked={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={isSelected ? 'active' : ''}
                    onClick={() => {
                      setListeningMeaningLanguage(lang.code);
                      setDisplayLanguage(lang.code);
                    }}
                    style={{
                      background: isSelected ? 'rgba(231, 165, 141, 0.28)' : 'transparent',
                      color: isSelected ? 'var(--accent-cream, #FEF3C7)' : 'rgba(244, 240, 235, 0.55)',
                      border: isSelected ? '1px solid rgba(231, 165, 141, 0.4)' : '1px solid transparent',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title={`Contextual meaning in ${lang.nativeLabel}`}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lyrics Scroller Container */}
          <div
            id="now-playing-lyrics-container"
            data-testid="now-playing-lyrics-container"
            ref={lyricsContainerRef}
            className={`now-playing-lyrics-scroller ${lyricsAnimationMode === 'floating' ? 'floating-lyrics-container' : ''}`}
            data-animation-mode={lyricsAnimationMode}
            data-playback-paused={!isPlaying ? 'true' : 'false'}
          >
            {!isSynced && hasLyrics && (
              <div
                id="now-playing-plain-lyrics-banner"
                data-testid="now-playing-plain-lyrics-banner"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(244, 240, 235, 0.04)',
                  border: '1px solid rgba(244, 240, 235, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '0 0 14px 0',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Untimed Plain Lyrics — Synchronized timestamps not yet verified for this track
                </span>
                <button
                  type="button"
                  id="now-playing-check-synced-btn"
                  data-testid="now-playing-check-synced-btn"
                  onClick={() => retryLyricsResolution()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(231, 165, 141, 0.12)',
                    border: '1px solid rgba(231, 165, 141, 0.3)',
                    color: 'var(--accent-cream)',
                    fontSize: '0.72rem',
                    borderRadius: 'var(--radius-full, 9999px)',
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={11} />
                  <span>Check Synced</span>
                </button>
              </div>
            )}
            {hasLyrics ? (
              <FloatingLyrics
                lines={displayedLines}
                activeLyricIndex={activeLyricIndex}
                isSynced={isSynced}
                isPlaying={isPlaying}
                currentTime={currentTime}
                sourceLanguage={(currentSong?.originalLanguage || (currentSong as any)?.original_language || sourceLanguage || 'en') as string}
                listeningMeaningLanguage={listeningMeaningLanguage}
                onSeek={seekTo}
                activeLyricRef={activeLyricRef}
                animationMode={lyricsAnimationMode}
              />
            ) : (isResolvingLyrics || lyricsResolution?.outcome === 'PENDING') ? (
              <div
                id="now-playing-lyrics-loading"
                data-testid="now-playing-lyrics-loading"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Loader2 size={24} className="animate-spin" color="var(--accent-warm)" />
                <span style={{ fontSize: '0.88rem' }}>
                  Resolving canonical lyrics for "{currentSong?.title}"...
                </span>
              </div>
            ) : lyricsResolution?.outcome === 'TRANSIENT_FAILURE' ? (
              <div
                id="now-playing-lyrics-error"
                data-testid="now-playing-lyrics-error"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FCD34D' }}>
                  <AlertCircle size={18} />
                  <span style={{ fontSize: '0.88rem' }}>
                    {lyricsResolution.errorReason || lyricsResolution.error || 'Temporary issue contacting lyrics providers'}
                  </span>
                </div>
                <button
                  type="button"
                  id="now-playing-retry-lyrics-btn"
                  data-testid="now-playing-retry-lyrics-btn"
                  onClick={() => retryLyricsResolution()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: 'rgba(231, 165, 141, 0.15)',
                    border: '1px solid rgba(231, 165, 141, 0.35)',
                    color: 'var(--accent-cream)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={13} />
                  <span>Retry Lyrics Search</span>
                </button>
              </div>
            ) : (
              <div
                id="now-playing-no-lyrics"
                data-testid="now-playing-no-lyrics"
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '0.92rem', color: 'var(--text-dim)' }}>
                  No lyrics found in catalogue for "{currentSong?.title}"
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Verified across available catalogue and external providers
                </span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Nested Language Picker Sheet with Smooth Slide Transitions */}
      {(isLangPickerOpen || isLangPickerClosing) && (
        <div
          className={`now-playing-lang-picker-backdrop ${isLangPickerClosing ? 'closing' : ''}`}
          onClick={() => closeLangPicker()}
          aria-hidden="true"
        />
      )}

      {(isLangPickerOpen || isLangPickerClosing) && (
        <div
          id="now-playing-lang-picker-sheet"
          data-testid="now-playing-lang-picker-sheet"
          className={`now-playing-lang-picker-sheet ${isLangPickerClosing ? 'closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Select Lyric Language"
          style={langDragOffset > 0 ? { transform: `translateY(${langDragOffset}px)`, transition: 'none' } : undefined}
        >
          <div
            className="now-playing-menu-handle-bar"
            onTouchStart={handleLangTouchStart}
            onTouchMove={handleLangTouchMove}
            onTouchEnd={handleLangTouchEnd}
          >
            <div className="now-playing-menu-handle" />
          </div>

          <div className="now-playing-lang-sheet-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="lang-sheet-title">Lyric Language</div>
              <div className="lang-sheet-sub">Original vocal preserved • Contextual meaning translated</div>
            </div>
            <button
              type="button"
              className="now-playing-menu-close-btn"
              aria-label="Close language selector"
              onClick={() => closeLangPicker()}
            >
              <X size={20} />
            </button>
          </div>

          <div className="now-playing-lang-options-list">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = listeningMeaningLanguage === lang.code;
              const songOrigLang = (currentSong.originalLanguage || (currentSong as any).original_language || sourceLanguage || 'en') as string;
              const isSongLang = songOrigLang === lang.code;
              const hasNativeScript = displayedLines.some((l) => {
                const d = getListeningLyricDisplay(l, lang.code, songOrigLang);
                return d.isNativeScriptAvailable;
              });

              let optionDesc = (lang as any).description || `Contextual meaning in ${lang.nativeLabel}`;
              if (isSongLang && ['te', 'ta', 'hi', 'ml'].includes(lang.code)) {
                if (hasNativeScript) {
                  optionDesc = `Original native ${lang.nativeLabel} script`;
                } else {
                  optionDesc = `Romanized ${lang.nativeLabel} (Native script unavailable)`;
                }
              }

              return (
                <button
                  key={lang.code}
                  id={`now-playing-lang-option-${lang.code}`}
                  data-testid={`now-playing-lang-option-${lang.code}`}
                  className={`now-playing-lang-option ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setListeningMeaningLanguage(lang.code);
                    setDisplayLanguage(lang.code);
                    closeLangPicker();
                  }}
                >
                  <div className="lang-option-text">
                    <div className="lang-option-primary">
                      <span className="lang-code-tag">{lang.code.toUpperCase()}</span>
                      <span className="lang-native-name">{lang.nativeLabel}</span>
                      <span className="lang-english-name">({lang.label})</span>
                    </div>
                    <span className="lang-option-desc">{optionDesc}</span>
                  </div>
                  {isSelected && <Check size={18} color="var(--accent-warm)" style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue Bottom Sheet Modal with Smooth Slide Transitions */}
      {(isQueueOpen || isQueueClosing) && (
        <div
          id="now-playing-queue-backdrop"
          data-testid="now-playing-queue-backdrop"
          className={`now-playing-queue-backdrop ${isQueueClosing ? 'closing' : ''}`}
          onClick={() => closeQueue()}
          aria-hidden="true"
        />
      )}

      {(isQueueOpen || isQueueClosing) && (
        <div
          id="now-playing-queue-sheet"
          data-testid="now-playing-queue-sheet"
          className={`now-playing-queue-sheet ${isQueueClosing ? 'closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Play Queue"
          style={queueDragOffset > 0 ? { transform: `translateY(${queueDragOffset}px)`, transition: 'none' } : undefined}
        >
          {/* Drag Handle Bar */}
          <div
            className="now-playing-menu-handle-bar"
            onTouchStart={handleQueueTouchStart}
            onTouchMove={handleQueueTouchMove}
            onTouchEnd={handleQueueTouchEnd}
          >
            <div className="now-playing-menu-handle" />
          </div>

          {/* Queue Header */}
          <div className="now-playing-queue-header">
            <div>
              <div className="queue-sheet-title">Play Queue</div>
              <div className="queue-sheet-sub">{queue.length} track{queue.length === 1 ? '' : 's'} in queue</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {upcomingQueue.length > 0 && (
                <button
                  type="button"
                  id="now-playing-clear-queue-btn"
                  data-testid="now-playing-clear-queue-btn"
                  className={`now-playing-queue-clear-btn ${isClearConfirmOpen ? 'confirming' : ''}`}
                  onClick={() => {
                    if (!isClearConfirmOpen) {
                      setIsClearConfirmOpen(true);
                    } else {
                      clearQueue();
                      setIsClearConfirmOpen(false);
                      showToast('Queue cleared');
                    }
                  }}
                >
                  {isClearConfirmOpen ? 'Confirm Clear?' : 'Clear Queue'}
                </button>
              )}
              {isClearConfirmOpen && (
                <button
                  type="button"
                  className="now-playing-queue-cancel-btn"
                  onClick={() => setIsClearConfirmOpen(false)}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                id="now-playing-queue-close-btn"
                data-testid="now-playing-queue-close-btn"
                className="now-playing-menu-close-btn"
                aria-label="Close play queue"
                onClick={() => closeQueue()}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Queue Content */}
          <div className="now-playing-queue-scroller">
            {/* Now Playing Section */}
            {currentSong && (
              <div className="now-playing-queue-section">
                <div className="now-playing-queue-section-title">Now Playing</div>
                <div
                  id="now-playing-queue-current-card"
                  data-testid="now-playing-queue-current-card"
                  className="now-playing-queue-current-card"
                >
                  <div className="queue-thumb-wrap">
                    <AbstractArtwork song={currentSong} size="sm" />
                  </div>
                  <div className="queue-track-meta">
                    <div className="queue-track-title">{currentSong.title}</div>
                    <div className="queue-track-artist">{currentSong.artist}</div>
                  </div>
                  <div className="queue-now-playing-indicator">
                    <span className="queue-now-playing-badge">PLAYING</span>
                  </div>
                </div>
              </div>
            )}

            {/* Up Next Section */}
            <div className="now-playing-queue-section">
              <div className="now-playing-queue-section-title">
                <span>Up Next</span>
                {upcomingQueue.length > 0 && (
                  <span className="queue-count-badge">{upcomingQueue.length}</span>
                )}
              </div>

              {upcomingQueue.length > 0 ? (
                <div id="now-playing-queue-list" data-testid="now-playing-queue-list" className="now-playing-queue-list">
                  {upcomingQueue.map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      id={`queue-item-${track.id}`}
                      data-testid={`queue-item-${track.id}`}
                      className="now-playing-queue-item"
                    >
                      <div className="queue-item-index">{idx + 1}</div>
                      <div
                        className="queue-item-clickable"
                        onClick={() => {
                          playSong(track, 0);
                        }}
                        title={`Play "${track.title}"`}
                      >
                        <div className="queue-thumb-wrap">
                          <AbstractArtwork song={track} size="sm" />
                        </div>
                        <div className="queue-track-meta">
                          <div className="queue-track-title">{track.title}</div>
                          <div className="queue-track-artist">{track.artist}</div>
                        </div>
                        <div className="queue-track-duration">
                          {formatTime(getCanonicalTrackDuration(track))}
                        </div>
                      </div>

                      <button
                        type="button"
                        id={`queue-remove-${track.id}`}
                        data-testid={`queue-remove-${track.id}`}
                        className="queue-item-remove-btn"
                        aria-label={`Remove ${track.title} from queue`}
                        title="Remove from queue"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(track.id);
                          showToast(`Removed "${track.title}" from queue`);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div id="now-playing-queue-empty" data-testid="now-playing-queue-empty" className="now-playing-queue-empty">
                  <ListMusic size={32} color="var(--text-dim, #94A3B8)" />
                  <p>No upcoming tracks in queue</p>
                  <span>Playlists and curated tracks play continuously</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BOTTOM AUTHORITATIVE CONTROLS BAR
          Authoritative Playhead Scrubber, Hi-Fi Controls, Volume & Karaoke
          ========================================================================= */}
      <footer className="now-playing-footer">
        {/* Scrubber & Central Playback Clock */}
        <div className="now-playing-scrubber-row">
          <span
            id="now-playing-current-time"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-muted, #CBD5E1)',
              width: '42px',
              textAlign: 'right'
            }}
          >
            {formatTime(currentTime)}
          </span>

          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              id="now-playing-seek-slider"
              data-testid="now-playing-seek-slider"
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.1}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              aria-label="Authoritative Timeline Scrubber"
              style={{
                width: '100%',
                accentColor: 'var(--ambient-accent, var(--accent-warm, #E7A58D))',
                cursor: 'pointer',
                height: '6px'
              }}
            />
          </div>

          <span
            id="now-playing-duration"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-muted, #CBD5E1)',
              width: '42px',
              textAlign: 'left'
            }}
          >
            {formatTime(effectiveDuration)}
          </span>
        </div>

        {/* Preview Completion Notice */}
        {playbackState === 'ended' && isPreview && (
          <div
            id="now-playing-preview-ended-notice"
            data-testid="now-playing-preview-ended-notice"
            style={{
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'var(--accent-warm)',
              padding: '2px 0 6px',
              fontWeight: 500
            }}
          >
            30-second preview completed. Full track requires authorized provider subscription.
          </div>
        )}

        {/* Action Controls Row */}
        <div className="now-playing-controls-row">
          {/* Left Dock: Dedicated Mobile Lyrics Toggle & Shuffle */}
          <div className="now-playing-controls-left-dock">
            {!isDesktopLayout && (
              <button
                type="button"
                id="now-playing-lyrics-btn"
                data-testid="now-playing-lyrics-btn"
                className={`now-playing-control-btn now-playing-lyrics-dock-btn ${isLyricsActive ? 'active' : ''}`}
                aria-label={isLyricsActive ? 'Close lyrics view' : 'Open lyrics view'}
                aria-expanded={isLyricsActive}
                aria-pressed={isLyricsActive}
                onClick={() => {
                  if (isMobileLyricsOpen) {
                    closeMobileLyrics();
                  } else {
                    closeQueue(true);
                    openMobileLyrics();
                  }
                }}
                title={isLyricsActive ? 'Return to album artwork' : 'View synchronized lyrics'}
              >
                <Mic2 size={18} />
                <span className="lyrics-dock-label">Lyrics</span>
              </button>
            )}

            <button
              id="now-playing-shuffle-btn"
              data-testid="now-playing-shuffle-btn"
              onClick={() => setIsShuffle(!isShuffle)}
              aria-label={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
              className={`now-playing-control-btn now-playing-shuffle-btn ${isShuffle ? 'active' : ''}`}
              style={{
                color: isShuffle ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)'
              }}
              title={isShuffle ? 'Shuffle active' : 'Shuffle tracks'}
            >
              <Shuffle size={18} />
            </button>

            {isDesktopLayout && (
              <button
                id="now-playing-repeat-btn"
                data-testid="now-playing-repeat-btn"
                onClick={() => setIsLoopingSection(!isLoopingSection)}
                aria-label={isLoopingSection ? 'Disable Section Repeat' : 'Repeat Section'}
                className={`now-playing-control-btn now-playing-repeat-btn ${isLoopingSection ? 'active' : ''}`}
                style={{
                  color: isLoopingSection ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)'
                }}
                title={isLoopingSection ? 'Moment looping active' : 'Repeat moment'}
              >
                <Repeat size={18} />
              </button>
            )}
          </div>

          {/* Center Group: Prev, Play/Pause, Next */}
          <div className="now-playing-controls-center-group">
            <button
              id="now-playing-prev-btn"
              data-testid="now-playing-prev-btn"
              onClick={prevSong}
              aria-label="Previous Track"
              className="now-playing-control-btn now-playing-prev-btn"
              title="Previous Track"
            >
              <SkipBack size={22} />
            </button>

            <button
              id="now-playing-play-btn"
              data-testid="now-playing-play-btn"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="now-playing-play-btn"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} fill="#080B10" /> : <Play size={24} fill="#080B10" style={{ marginLeft: '3px' }} />}
            </button>

            <button
              id="now-playing-next-btn"
              data-testid="now-playing-next-btn"
              onClick={nextSong}
              aria-label="Next Track"
              className="now-playing-control-btn now-playing-next-btn"
              title="Next Track"
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Right Dock:
              Mobile: Repeat + Queue
              Desktop: Master Volume */}
          <div className="now-playing-controls-right-dock">
            {!isDesktopLayout && (
              <button
                id="now-playing-repeat-btn"
                data-testid="now-playing-repeat-btn"
                onClick={() => setIsLoopingSection(!isLoopingSection)}
                aria-label={isLoopingSection ? 'Disable Section Repeat' : 'Repeat Section'}
                className={`now-playing-control-btn now-playing-repeat-btn ${isLoopingSection ? 'active' : ''}`}
                style={{
                  color: isLoopingSection ? 'var(--accent-warm, #E7A58D)' : 'var(--text-dim, #64748B)'
                }}
                title={isLoopingSection ? 'Moment looping active' : 'Repeat moment'}
              >
                <Repeat size={18} />
              </button>
            )}

            {!isDesktopLayout && (
              <button
                type="button"
                id="now-playing-queue-btn"
                data-testid="now-playing-queue-btn"
                className={`now-playing-control-btn now-playing-queue-dock-btn ${isQueueActive ? 'active' : ''}`}
                aria-label={isQueueActive ? 'Close play queue' : 'Open play queue'}
                aria-expanded={isQueueActive}
                aria-pressed={isQueueActive}
                onClick={() => {
                  if (isQueueOpen) {
                    closeQueue();
                  } else {
                    closeMobileLyrics(true);
                    openQueue();
                  }
                }}
                title={isQueueActive ? 'Close play queue' : 'View play queue'}
              >
                <ListMusic size={18} />
                <span className="queue-dock-label">Queue</span>
              </button>
            )}

            {/* Master Volume (Desktop only) */}
            <div className="now-playing-desktop-volume">
              <button
                onClick={handleMuteToggle}
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                className="now-playing-control-btn now-playing-volume-btn"
                title={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <input
                id="now-playing-volume-slider"
                className="now-playing-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Master volume"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
