import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Song, Language, SongSection, RecordedTake, PlaybackState, TimedLyricLine } from '../types/music';
import { JOSH_WOODWARD_SHOT_DOWN } from '../data/songs';
import { playbackController } from '../services/audio/PlaybackController';
import { karaokePlaybackService } from '../services/audio/karaokePlaybackService';
import { connectivityService } from '../services/connectivity/connectivityService';
import { userLibraryService } from '../backend/services/UserLibraryService';
import { lyricsService } from '../services/lyrics/lyricsService';

export type AppView = 'home' | 'discover' | 'karaoke' | 'library' | 'downloads';

interface AudioPlayerContextType {
  songs: Song[];
  currentSong: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  playbackState: PlaybackState;
  playbackError: string | null;
  volume: number;
  activeLanguage: Language;
  selectedSection: SongSection;
  isOnline: boolean;
  currentView: AppView;
  savedTakes: RecordedTake[];

  // Karaoke On-Demand Mode & Mixer state
  isKaraokeMode: boolean;
  bgmVolume: number;
  voiceVolume: number;
  isMicEnabled: boolean;
  micLevel: number;
  nativeLanguage: Language;
  displayLanguage: Language;

  // Modals & UI States
  karaokeModalOpen: boolean;
  isRecordingActive: boolean;
  recordedTake: RecordedTake | null;
  reviewModalOpen: boolean;
  lyricsDrawerOpen: boolean;
  searchModalOpen: boolean;
  searchQuery: string;
  isLoopingSection: boolean;
  accountModalOpen: boolean;
  nowPlayingOpen: boolean;

  // Actions
  playSong: (song: Song, startTime?: number) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setVolume: (vol: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  setCurrentView: (view: AppView) => void;
  setActiveLanguage: (lang: Language) => void;
  setDisplayLanguage: (lang: Language) => void;
  setSelectedSection: (sec: SongSection) => void;
  toggleKaraokeMode: () => void;
  setKaraokeMode: (enabled: boolean) => void;
  setBgmVolume: (vol: number) => void;
  setVoiceVolume: (vol: number) => void;
  toggleMic: () => void;
  openKaraokeForSong: (song?: Song, section?: SongSection) => void;
  closeKaraokeModal: () => void;
  startKaraokeRecording: (section: SongSection) => void;
  stopKaraokeRecording: () => void;
  finishTake: (take: RecordedTake) => void;
  dismissReviewModal: () => void;
  saveTakeToLibrary: (take: RecordedTake) => Promise<void>;
  deleteTakeFromLibrary: (takeId: string) => Promise<void>;
  downloadTake: (take: RecordedTake) => void;
  toggleLyricsDrawer: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  toggleNowPlaying: () => void;
  setSearchModalOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setIsLoopingSection: (loop: boolean) => void;
  setAccountModalOpen: (open: boolean) => void;
  refreshLibrary: () => Promise<void>;
  addSongToCatalog: (song: Song) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// Canonical featured track: Verified legitimate full-length reference recording ("Shot Down" by Josh Woodward, 255s)
// Legitimate open-license master, complete vocal MP3 and dedicated NoVox instrumental MP3.
const INITIAL_FEATURED_SONG: Song = JOSH_WOODWARD_SHOT_DOWN;

// Consumer catalog contains ONLY verified, legitimate full-length playable tracks.
// Dev fixtures and unverified previews are strictly excluded from the consumer catalog.
const INITIAL_SONGS: Song[] = [
  JOSH_WOODWARD_SHOT_DOWN
];

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(INITIAL_FEATURED_SONG);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [activeLanguage, setActiveLanguage] = useState<Language>('en');
  const [displayLanguage, setDisplayLanguageState] = useState<Language>('en');
  const [isLoopingSection, setIsLoopingSectionState] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [savedTakes, setSavedTakes] = useState<RecordedTake[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(connectivityService.isOnline);

  // On-demand Karaoke Mode & Mixer states
  const [isKaraokeMode, setIsKaraokeMode] = useState<boolean>(false);
  const [bgmVolume, setBgmVolumeState] = useState<number>(1.0);
  const [voiceVolume, setVoiceVolumeState] = useState<number>(0.85);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const [micLevel] = useState<number>(0);

  // Native song language detection
  const nativeLanguage: Language = useMemo(() => {
    if (currentSong.lyrics?.te?.lines?.length && /[\u0C00-\u0C7F]/.test(currentSong.lyrics.te.lines[0]?.text || '')) return 'te';
    if (currentSong.lyrics?.ta?.lines?.length && /[\u0B80-\u0BFF]/.test(currentSong.lyrics.ta.lines[0]?.text || '')) return 'ta';
    if (currentSong.lyrics?.ml?.lines?.length && /[\u0D00-\u0D7F]/.test(currentSong.lyrics.ml.lines[0]?.text || '')) return 'ml';
    if (currentSong.lyrics?.hi?.lines?.length && /[\u0900-\u097F]/.test(currentSong.lyrics.hi.lines[0]?.text || '')) return 'hi';
    return lyricsService.detectLanguage((currentSong.title || '') + ' ' + (currentSong.artist || ''));
  }, [currentSong]);

  // Central playback clock states
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(INITIAL_FEATURED_SONG.duration);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Default section
  const defaultChorus = INITIAL_FEATURED_SONG.sections.find((s) => s.type === 'chorus') || INITIAL_FEATURED_SONG.sections[0];
  const [selectedSection, setSelectedSectionState] = useState<SongSection>(defaultChorus);

  // Modals - strict initial false state
  const [nowPlayingOpen, setNowPlayingOpen] = useState<boolean>(false);
  const [karaokeModalOpen, setKaraokeModalOpen] = useState<boolean>(false);
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);
  const [recordedTake, setRecordedTake] = useState<RecordedTake | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [lyricsDrawerOpen, setLyricsDrawerOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(false);

  const openNowPlaying = useCallback(() => setNowPlayingOpen(true), []);
  const closeNowPlaying = useCallback(() => setNowPlayingOpen(false), []);
  const toggleNowPlaying = useCallback(() => setNowPlayingOpen((prev) => !prev), []);

  const isRecordingActiveRef = useRef<boolean>(false);
  useEffect(() => {
    isRecordingActiveRef.current = isRecordingActive;
  }, [isRecordingActive]);

  // Synchronize catalog list with PlaybackController queue
  useEffect(() => {
    playbackController.setQueue(songs);
  }, [songs]);

  // 1. Subscribe to central authoritative playback clock from PlaybackController
  useEffect(() => {
    const unsubscribeClock = playbackController.subscribeClock((clockEvent) => {
      // If karaoke recording is active, do not allow normal playback to override karaoke clock
      if (isRecordingActiveRef.current) return;

      setCurrentTime(clockEvent.currentTime);
      if (clockEvent.duration > 0) {
        setDuration(clockEvent.duration);
      }
      setBufferedTime(clockEvent.bufferedTime);
      setIsPlaying(clockEvent.isPlaying);
      setPlaybackState(clockEvent.state);
      setPlaybackError(clockEvent.error || null);
    });

    return () => {
      unsubscribeClock();
    };
  }, []);

  // 1a. Subscribe to current track updates from PlaybackController
  useEffect(() => {
    const unsubscribeTrack = playbackController.subscribeTrack((track) => {
      if (track && track.id !== currentSong.id) {
        setCurrentSong(track);
        setDuration(track.duration);
        const chorus = track.sections.find((s) => s.type === 'chorus') || track.sections[0];
        if (chorus) {
          setSelectedSectionState(chorus);
          playbackController.setLoopSection(chorus, isLoopingSection);
        }
      }
    });

    return () => {
      unsubscribeTrack();
    };
  }, [currentSong.id, isLoopingSection]);

  // 1b. Subscribe to central playback clock for Karaoke Backing Playback
  useEffect(() => {
    const unsubscribeKaraokeClock = karaokePlaybackService.subscribe((kClock) => {
      if (!isRecordingActiveRef.current) return;

      setCurrentTime(kClock.currentTime);
      if (kClock.duration > 0) {
        setDuration(kClock.duration);
      }
      setIsPlaying(kClock.isPlaying);
      setPlaybackState(kClock.isPlaying ? 'playing' : kClock.isReady ? 'ready' : 'idle');
      setPlaybackError(kClock.error || null);
    });

    return () => {
      unsubscribeKaraokeClock();
    };
  }, []);

  // 2. Subscribe to connectivity service
  useEffect(() => {
    const unsubscribeConnectivity = connectivityService.subscribe((online) => {
      setIsOnline(online);
    });
    return () => {
      unsubscribeConnectivity();
    };
  }, []);

  // 3. Load user library moments via backend boundary
  const refreshLibrary = useCallback(async () => {
    try {
      const takes = await userLibraryService.getAllTakes();
      setSavedTakes(takes);
    } catch (err) {
      console.warn('Failed to load library moments from persistence layer:', err);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const addSongToCatalog = useCallback((song: Song) => {
    setSongs((prev) => {
      if (prev.some((s) => s.id === song.id)) return prev;
      return [song, ...prev];
    });
    playbackController.addToQueue(song);
  }, []);

  // Section and loop handlers delegating to PlaybackController
  const setIsLoopingSection = useCallback((loop: boolean) => {
    setIsLoopingSectionState(loop);
    playbackController.setIsLooping(loop);
  }, []);

  const setSelectedSection = useCallback(
    (sec: SongSection) => {
      setSelectedSectionState(sec);
      playbackController.setLoopSection(sec, isLoopingSection);
    },
    [isLoopingSection]
  );

  const playSong = useCallback(
    (song: Song, startTime = 0) => {
      const isNew = song.id !== currentSong.id;
      setCurrentSong(song);
      setDuration(song.duration);
      addSongToCatalog(song);

      const chorus = song.sections.find((s) => s.type === 'chorus') || song.sections[0];
      if (isNew && chorus) {
        setSelectedSectionState(chorus);
        playbackController.setLoopSection(chorus, isLoopingSection);
      }

      // Normal listening is ALWAYS default when starting any song
      playbackController.setKaraokeMode(false);
      setIsKaraokeMode(false);

      playbackController.loadAndPlay(song, startTime);

      // Background enrichment: fetch real synced lyrics if missing
      if (!song.lyrics?.en?.lines?.length && song.playbackSource?.provider === 'apple-music') {
        lyricsService.fetchLyrics(song.title, song.artist, song.duration, song.album).then((fetched) => {
          const hasLines = Boolean(
            (fetched?.en?.lines && fetched.en.lines.length > 0) ||
            (fetched?.hi?.lines && fetched.hi.lines.length > 0) ||
            (fetched?.te?.lines && fetched.te.lines.length > 0) ||
            (fetched?.ta?.lines && fetched.ta.lines.length > 0) ||
            (fetched?.ml?.lines && fetched.ml.lines.length > 0)
          );
          if (fetched && hasLines) {
            setCurrentSong((prev) => {
              if (prev.id === song.id) {
                return {
                  ...prev,
                  lyrics: fetched,
                  lyricsAvailable: true,
                  lyricsSyncAvailable: true,
                  capabilities: { ...prev.capabilities, lyrics: true, lyricsAvailable: true, lyricsSyncAvailable: true, playback: true, recording: false, karaoke: false, karaokeAvailable: false }
                };
              }
              return prev;
            });
            setSongs((prev) =>
              prev.map((s) =>
                s.id === song.id
                  ? {
                      ...s,
                      lyrics: fetched,
                      lyricsAvailable: true,
                      lyricsSyncAvailable: true,
                      capabilities: { ...s.capabilities, lyrics: true, lyricsAvailable: true, lyricsSyncAvailable: true, playback: true, recording: false, karaoke: false, karaokeAvailable: false }
                    }
                  : s
              )
            );
          }
        }).catch(() => {});
      }
    },
    [currentSong.id, addSongToCatalog, isLoopingSection]
  );

  // Preload initial featured track on startup
  useEffect(() => {
    playbackController.load(INITIAL_FEATURED_SONG);
  }, []);

  const togglePlay = useCallback(() => {
    playbackController.togglePlay(currentSong);
  }, [currentSong]);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
    playbackController.seek(time);
    if (isRecordingActiveRef.current) {
      karaokePlaybackService.seek(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    playbackController.setVolume(vol);
  }, []);

  const nextSong = useCallback(() => {
    playbackController.nextTrack();
  }, []);

  const prevSong = useCallback(() => {
    playbackController.prevTrack();
  }, []);

  const toggleKaraokeMode = useCallback(() => {
    setIsKaraokeMode((prev) => {
      const next = !prev;
      playbackController.setKaraokeMode(next);
      return next;
    });
  }, []);

  const setKaraokeMode = useCallback((enabled: boolean) => {
    setIsKaraokeMode(enabled);
    playbackController.setKaraokeMode(enabled);
  }, []);

  const setBgmVolume = useCallback((vol: number) => {
    setBgmVolumeState(vol);
    playbackController.setBgmVolume(vol);
  }, []);

  const setVoiceVolume = useCallback((vol: number) => {
    setVoiceVolumeState(vol);
    playbackController.setVoiceVolume(vol);
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => {
      const next = !prev;
      playbackController.setMicEnabled(next);
      return next;
    });
  }, []);

  const setDisplayLanguage = useCallback((lang: Language) => {
    setDisplayLanguageState(lang);
    setActiveLanguage(lang);
  }, []);

  const openKaraokeForSong = useCallback(
    (song?: Song, section?: SongSection) => {
      const targetSong = song || currentSong;
      if (targetSong.id !== currentSong.id) {
        playSong(targetSong);
      }
      addSongToCatalog(targetSong);

      if (section) {
        setSelectedSectionState(section);
        playbackController.setLoopSection(section, isLoopingSection);
      } else {
        const chorus = targetSong.sections.find((s) => s.type === 'chorus') || targetSong.sections[0];
        if (chorus) {
          setSelectedSectionState(chorus);
          playbackController.setLoopSection(chorus, isLoopingSection);
        }
      }

      // Engage real-time vocal suppression on active track
      playbackController.setKaraokeMode(true);
      setIsKaraokeMode(true);
      setKaraokeModalOpen(true);
    },
    [currentSong, playSong, addSongToCatalog, isLoopingSection]
  );

  const closeKaraokeModal = useCallback(() => {
    setKaraokeModalOpen(false);
  }, []);

  const startKaraokeRecording = useCallback(
    (section: SongSection) => {
      setSelectedSectionState(section);
      playbackController.setLoopSection(section, isLoopingSection);
      playbackController.setKaraokeMode(true);
      setIsKaraokeMode(true);
      setKaraokeModalOpen(false);
      setIsRecordingActive(true);
    },
    [isLoopingSection]
  );

  const stopKaraokeRecording = useCallback(() => {
    karaokePlaybackService.stop();
    setIsRecordingActive(false);
  }, []);

  const finishTake = useCallback((take: RecordedTake) => {
    karaokePlaybackService.stop();
    setRecordedTake(take);
    setIsRecordingActive(false);
    setReviewModalOpen(true);
  }, []);

  const dismissReviewModal = useCallback(() => {
    setReviewModalOpen(false);
  }, []);

  const saveTakeToLibrary = useCallback(
    async (take: RecordedTake) => {
      await userLibraryService.saveTake(take);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const deleteTakeFromLibrary = useCallback(
    async (takeId: string) => {
      await userLibraryService.deleteTake(takeId);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const downloadTake = useCallback((take: RecordedTake) => {
    userLibraryService.triggerDownload(take);
  }, []);

  const toggleLyricsDrawer = useCallback(() => {
    setLyricsDrawerOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __naro_play_song?: (s: Song, st?: number) => void;
        __naro_current_song?: Song;
        __naro_set_karaoke?: (enabled: boolean) => void;
        __naro_toggle_karaoke?: () => void;
        __naro_open_karaoke_modal?: () => void;
        __naro_get_audio?: () => HTMLAudioElement | null;
        __naro_toggle_lyrics?: () => void;
        __naro_seek?: (time: number) => void;
        __naro_open_now_playing?: () => void;
        __naro_close_now_playing?: () => void;
        __naro_toggle_now_playing?: () => void;
        __naro_is_now_playing_open?: () => boolean;
        __naro_set_display_language?: (lang: Language) => void;
        __naro_get_display_language?: () => Language;
        __naro_get_current_time?: () => number;
        __naro_is_playing?: () => boolean;
        __naro_get_canonical_lines?: () => TimedLyricLine[];
        __naro_playback_controller?: typeof playbackController;
      };
      win.__naro_play_song = playSong;
      win.__naro_playback_controller = playbackController;
      win.__naro_current_song = currentSong;
      win.__naro_set_karaoke = setKaraokeMode;
      win.__naro_toggle_karaoke = toggleKaraokeMode;
      win.__naro_open_karaoke_modal = () => openKaraokeForSong(currentSong);
      win.__naro_get_audio = () => playbackController.getAudioElement();
      win.__naro_toggle_lyrics = toggleLyricsDrawer;
      win.__naro_seek = seekTo;
      win.__naro_open_now_playing = openNowPlaying;
      win.__naro_close_now_playing = closeNowPlaying;
      win.__naro_toggle_now_playing = toggleNowPlaying;
      win.__naro_is_now_playing_open = () => nowPlayingOpen;
      win.__naro_set_display_language = setDisplayLanguage;
      win.__naro_get_display_language = () => displayLanguage;
      win.__naro_get_current_time = () => currentTime;
      win.__naro_is_playing = () => isPlaying;
      win.__naro_get_canonical_lines = () => lyricsService.getCanonicalLyricLines(currentSong);
    }
  }, [
    playSong,
    currentSong,
    setKaraokeMode,
    toggleKaraokeMode,
    openKaraokeForSong,
    toggleLyricsDrawer,
    seekTo,
    openNowPlaying,
    closeNowPlaying,
    toggleNowPlaying,
    nowPlayingOpen,
    setDisplayLanguage,
    displayLanguage,
    currentTime,
    isPlaying
  ]);

  return (
    <AudioPlayerContext.Provider
      value={{
        songs,
        currentSong,
        isPlaying,
        currentTime,
        duration,
        bufferedTime,
        playbackState,
        playbackError,
        volume,
        activeLanguage,
        selectedSection,
        isOnline,
        currentView,
        savedTakes,
        isKaraokeMode,
        bgmVolume,
        voiceVolume,
        isMicEnabled,
        micLevel,
        nativeLanguage,
        displayLanguage,
        nowPlayingOpen,
        karaokeModalOpen,
        isRecordingActive,
        recordedTake,
        reviewModalOpen,
        lyricsDrawerOpen,
        searchModalOpen,
        searchQuery,
        isLoopingSection,
        accountModalOpen,
        playSong,
        togglePlay,
        seekTo,
        setVolume,
        nextSong,
        prevSong,
        setCurrentView,
        setActiveLanguage,
        setDisplayLanguage,
        setSelectedSection,
        toggleKaraokeMode,
        setKaraokeMode,
        setBgmVolume,
        setVoiceVolume,
        toggleMic,
        openKaraokeForSong,
        closeKaraokeModal,
        startKaraokeRecording,
        stopKaraokeRecording,
        finishTake,
        dismissReviewModal,
        saveTakeToLibrary,
        deleteTakeFromLibrary,
        downloadTake,
        toggleLyricsDrawer,
        openNowPlaying,
        closeNowPlaying,
        toggleNowPlaying,
        setSearchModalOpen,
        setSearchQuery,
        setIsLoopingSection,
        setAccountModalOpen,
        refreshLibrary,
        addSongToCatalog
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
