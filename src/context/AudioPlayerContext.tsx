import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Song, Language, SongSection, RecordedTake, PlaybackState, TimedLyricLine } from '../types/music';
import { JOSH_WOODWARD_SHOT_DOWN } from '../data/songs';
import { playbackController } from '../services/audio/PlaybackController';
import { connectivityService } from '../services/connectivity/connectivityService';
import { userLibraryService } from '../backend/services/UserLibraryService';
import { lyricsService } from '../services/lyrics/lyricsService';
import { personalLibraryStore, type User, type Playlist, type RecentlyPlayedItem } from '../services/storage/personalLibraryStore';
import { authService } from '../services/auth/authService';
import type { SoundMode, SoundPreset } from '../services/audio/naroImmersiveEngine';

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

  // NARO Immersive Sound Engine
  soundMode: SoundMode;
  soundPreset: SoundPreset;
  setSoundMode: (mode: SoundMode) => void;
  setSoundPreset: (preset: SoundPreset) => void;

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

  // NARO Personal Account & Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalMode: 'signin' | 'signup';
  setAuthModalOpen: (open: boolean) => void;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  logout: () => Promise<void>;

  // Personal Library: Likes & Playlists
  likedSongIds: string[];
  toggleLikeSong: (song: Song) => void;
  isSongLiked: (songId: string) => boolean;
  playlists: Playlist[];
  createPlaylist: (name: string, description?: string) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderPlaylistSongs: (playlistId: string, songIds: string[]) => void;
  playPlaylist: (playlist: Playlist) => void;

  // Add to Playlist Modal
  addToPlaylistModalOpen: boolean;
  playlistTargetSong: Song | null;
  setAddToPlaylistModalOpen: (open: boolean) => void;
  openAddToPlaylist: (song: Song) => void;

  // Personal Library: Recently Played & Downloads
  recentlyPlayed: RecentlyPlayedItem[];
  downloadedSongs: Song[];
  downloadSong: (song: Song) => void;
  isSongDownloaded: (songId: string) => boolean;

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
  renameTakeInLibrary: (takeId: string, newLabel: string) => Promise<void>;
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

export const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// Canonical featured track: Verified legitimate full-length reference recording ("Shot Down" by Josh Woodward, 255s)
const INITIAL_FEATURED_SONG: Song = JOSH_WOODWARD_SHOT_DOWN;

// Consumer catalog contains ONLY verified, legitimate full-length playable tracks.
const INITIAL_SONGS: Song[] = [
  JOSH_WOODWARD_SHOT_DOWN
];

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(INITIAL_FEATURED_SONG);
  const [volume, setVolumeState] = useState<number>(0.8);
  const initialSongLang = useMemo(() => lyricsService.detectSongLanguage(INITIAL_FEATURED_SONG), []);
  const [activeLanguage, setActiveLanguage] = useState<Language>(initialSongLang);
  const [displayLanguage, setDisplayLanguageState] = useState<Language>(initialSongLang);
  const manualLangRef = useRef<{ songId: string; lang: Language } | null>(null);
  const prevSongIdRef = useRef<string>(INITIAL_FEATURED_SONG.id);
  const [isLoopingSection, setIsLoopingSectionState] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [savedTakes, setSavedTakes] = useState<RecordedTake[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(connectivityService.isOnline);

  // Sound Engine state (Phase 2)
  const [soundMode, setSoundModeState] = useState<SoundMode>('original');
  const [soundPreset, setSoundPresetState] = useState<SoundPreset>('immersive');

  const setSoundMode = useCallback((mode: SoundMode) => {
    setSoundModeState(mode);
    playbackController.setSoundMode(mode);
  }, []);

  const setSoundPreset = useCallback((preset: SoundPreset) => {
    setSoundPresetState(preset);
    playbackController.setSoundPreset(preset);
  }, []);

  // Personal Account & Auth state (Phase 3)
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
    setLikedSongIds(personalLibraryStore.getLikedSongIds());
    setPlaylists(personalLibraryStore.getPlaylists());
    setRecentlyPlayed(personalLibraryStore.getRecentlyPlayed());
  }, []);

  // Subscribe to auth service session updates
  useEffect(() => {
    const unsub = authService.subscribe((user) => {
      setCurrentUser(user);
      const uid = user?.id;
      setLikedSongIds(personalLibraryStore.getLikedSongIds(uid));
      setPlaylists(personalLibraryStore.getPlaylists(uid));
      setRecentlyPlayed(personalLibraryStore.getRecentlyPlayed(uid));
    });
    return unsub;
  }, []);

  // Personal Library state: Likes, Playlists, Recently Played, Downloads
  const [likedSongIds, setLikedSongIds] = useState<string[]>(() =>
    personalLibraryStore.getLikedSongIds(authService.getCurrentUser()?.id)
  );

  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    personalLibraryStore.getPlaylists(authService.getCurrentUser()?.id)
  );

  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>(() =>
    personalLibraryStore.getRecentlyPlayed(authService.getCurrentUser()?.id)
  );

  const [downloadedSongs, setDownloadedSongs] = useState<Song[]>(() =>
    personalLibraryStore.getDownloadedSongs()
  );

  // Add to Playlist modal state
  const [addToPlaylistModalOpen, setAddToPlaylistModalOpen] = useState(false);
  const [playlistTargetSong, setPlaylistTargetSong] = useState<Song | null>(null);

  const openAddToPlaylist = useCallback((song: Song) => {
    setPlaylistTargetSong(song);
    setAddToPlaylistModalOpen(true);
  }, []);

  const toggleLikeSong = useCallback((song: Song) => {
    const uid = currentUser?.id;
    const isCurrentlyLiked = personalLibraryStore.isLiked(song.id, uid);
    if (isCurrentlyLiked) {
      personalLibraryStore.removeLikedSong(song.id, uid);
    } else {
      personalLibraryStore.addLikedSong(song.id, uid);
    }
    setLikedSongIds(personalLibraryStore.getLikedSongIds(uid));
  }, [currentUser]);

  const isSongLiked = useCallback(
    (songId: string) => {
      return likedSongIds.includes(songId);
    },
    [likedSongIds]
  );

  const createPlaylist = useCallback(
    (name: string, description?: string): Playlist => {
      const uid = currentUser?.id;
      const pl: Playlist = {
        id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: uid,
        name,
        description,
        songIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      personalLibraryStore.savePlaylist(pl, uid);
      setPlaylists(personalLibraryStore.getPlaylists(uid));
      return pl;
    },
    [currentUser]
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      const uid = currentUser?.id;
      const target = playlists.find((p) => p.id === id);
      if (target) {
        personalLibraryStore.savePlaylist({ ...target, name }, uid);
        setPlaylists(personalLibraryStore.getPlaylists(uid));
      }
    },
    [currentUser, playlists]
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      const uid = currentUser?.id;
      personalLibraryStore.deletePlaylist(id, uid);
      setPlaylists(personalLibraryStore.getPlaylists(uid));
    },
    [currentUser]
  );

  const addSongToPlaylist = useCallback(
    (playlistId: string, songId: string) => {
      const uid = currentUser?.id;
      const target = playlists.find((p) => p.id === playlistId);
      if (target && !target.songIds.includes(songId)) {
        const updated = { ...target, songIds: [...target.songIds, songId] };
        personalLibraryStore.savePlaylist(updated, uid);
        setPlaylists(personalLibraryStore.getPlaylists(uid));
      }
    },
    [currentUser, playlists]
  );

  const removeSongFromPlaylist = useCallback(
    (playlistId: string, songId: string) => {
      const uid = currentUser?.id;
      const target = playlists.find((p) => p.id === playlistId);
      if (target) {
        const updated = { ...target, songIds: target.songIds.filter((id) => id !== songId) };
        personalLibraryStore.savePlaylist(updated, uid);
        setPlaylists(personalLibraryStore.getPlaylists(uid));
      }
    },
    [currentUser, playlists]
  );

  const reorderPlaylistSongs = useCallback(
    (playlistId: string, songIds: string[]) => {
      const uid = currentUser?.id;
      const target = playlists.find((p) => p.id === playlistId);
      if (target) {
        const updated = { ...target, songIds };
        personalLibraryStore.savePlaylist(updated, uid);
        setPlaylists(personalLibraryStore.getPlaylists(uid));
      }
    },
    [currentUser, playlists]
  );

  const playPlaylist = useCallback(
    (playlist: Playlist) => {
      if (!playlist || playlist.songIds.length === 0) return;
      const firstId = playlist.songIds[0];
      const match = songs.find((s) => s.id === firstId) || JOSH_WOODWARD_SHOT_DOWN;
      playbackController.load(match, 0).then(() => {
        playbackController.play();
      });
    },
    [songs]
  );

  const downloadSong = useCallback((song: Song) => {
    personalLibraryStore.addDownloadedSong(song);
    setDownloadedSongs(personalLibraryStore.getDownloadedSongs());
  }, []);

  const isSongDownloaded = useCallback(
    (songId: string) => {
      return downloadedSongs.some((s) => s.id === songId);
    },
    [downloadedSongs]
  );

  // On-demand Karaoke Mode & Mixer states
  const [isKaraokeMode, setIsKaraokeMode] = useState<boolean>(false);
  const [bgmVolume, setBgmVolumeState] = useState<number>(1.0);
  const [voiceVolume, setVoiceVolumeState] = useState<number>(0.85);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const [micLevel] = useState<number>(0);

  // Native song language detection
  const nativeLanguage: Language = useMemo(() => {
    return lyricsService.detectSongLanguage(currentSong);
  }, [currentSong]);

  // Recalculate default lyrics language when song changes
  useEffect(() => {
    if (!currentSong) return;
    const isNew = currentSong.id !== prevSongIdRef.current;
    if (isNew) {
      prevSongIdRef.current = currentSong.id;
      manualLangRef.current = null;
      const detected = lyricsService.detectSongLanguage(currentSong);
      setDisplayLanguageState(detected);
      setActiveLanguage(detected);
    }
  }, [currentSong?.id]);

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

  // Modals & UI States
  const [karaokeModalOpen, setKaraokeModalOpen] = useState<boolean>(false);
  const [isRecordingActive, setIsRecordingActive] = useState<boolean>(false);
  const [recordedTake, setRecordedTake] = useState<RecordedTake | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [lyricsDrawerOpen, setLyricsDrawerOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState<boolean>(false);

  // Track listened history (> 5 seconds elapsed while playing)
  const lastRecordedSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isPlaying && currentSong) {
      if (currentTime > 5 && lastRecordedSongIdRef.current !== currentSong.id) {
        lastRecordedSongIdRef.current = currentSong.id;
        personalLibraryStore.addRecentlyPlayed(currentSong, currentUser?.id);
        setRecentlyPlayed(personalLibraryStore.getRecentlyPlayed(currentUser?.id));
      }
    }
  }, [isPlaying, currentTime, currentSong, currentUser]);

  // Sync with central PlaybackController clock
  useEffect(() => {
    const unsubscribe = playbackController.subscribeClock((event) => {
      setCurrentTime(event.currentTime);
      if (event.duration > 0) {
        setDuration(event.duration);
      }
      setBufferedTime(event.bufferedTime);
      setIsPlaying(event.isPlaying);
      setPlaybackState(event.state);
      setPlaybackError(event.error || null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update selected section when song changes
  useEffect(() => {
    if (!currentSong) return;
    const chorus = currentSong.sections?.find((s) => s.type === 'chorus') || currentSong.sections?.[0];
    if (chorus) {
      setSelectedSectionState(chorus);
    }
  }, [currentSong]);

  // Sync online status
  useEffect(() => {
    const unsub = connectivityService.subscribe((status) => {
      setIsOnline(status);
    });
    return unsub;
  }, []);

  // Load saved takes on mount
  const refreshLibrary = useCallback(async () => {
    try {
      const takes = await userLibraryService.getAllTakes();
      setSavedTakes(takes);
    } catch (err) {
      console.warn('Error loading saved takes:', err);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const addSongToCatalog = useCallback((newSong: Song) => {
    setSongs((prev) => {
      if (prev.some((s) => s.id === newSong.id)) return prev;
      return [...prev, newSong];
    });
  }, []);

  const playSong = useCallback((song: Song, startTime = 0) => {
    setCurrentSong(song);
    playbackController.load(song, startTime).then(() => {
      playbackController.play();
    });
  }, []);

  const togglePlay = useCallback(() => {
    playbackController.togglePlay(currentSong);
  }, [currentSong]);

  const seekTo = useCallback((time: number) => {
    playbackController.seek(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    playbackController.setVolume(clamped);
  }, []);

  const nextSong = useCallback(() => {
    const currentIndex = songs.findIndex((s) => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % songs.length;
    playSong(songs[nextIndex], 0);
  }, [songs, currentSong, playSong]);

  const prevSong = useCallback(() => {
    const currentIndex = songs.findIndex((s) => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(songs[prevIndex], 0);
  }, [songs, currentSong, playSong]);

  const setDisplayLanguage = useCallback((lang: Language) => {
    manualLangRef.current = { songId: currentSong.id, lang };
    setDisplayLanguageState(lang);
  }, [currentSong?.id]);

  const setSelectedSection = useCallback((sec: SongSection) => {
    setSelectedSectionState(sec);
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
    const clamped = Math.max(0, Math.min(1, vol));
    setBgmVolumeState(clamped);
    playbackController.setBgmVolume(clamped);
  }, []);

  const setVoiceVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVoiceVolumeState(clamped);
    playbackController.setVoiceVolume(clamped);
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => {
      const next = !prev;
      playbackController.setMicEnabled(next);
      return next;
    });
  }, []);

  const openKaraokeForSong = useCallback((song?: Song, section?: SongSection) => {
    if (song && song.id !== currentSong.id) {
      setCurrentSong(song);
      playbackController.load(song, 0);
    }
    if (section) {
      setSelectedSectionState(section);
    }
    setKaraokeModalOpen(true);
  }, [currentSong]);

  const closeKaraokeModal = useCallback(() => {
    setKaraokeModalOpen(false);
  }, []);

  const startKaraokeRecording = useCallback((section: SongSection) => {
    setSelectedSectionState(section);
    setKaraokeModalOpen(false);
    setIsRecordingActive(true);
  }, []);

  const stopKaraokeRecording = useCallback(() => {
    setIsRecordingActive(false);
  }, []);

  const finishTake = useCallback((take: RecordedTake) => {
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

  const renameTakeInLibrary = useCallback(
    async (takeId: string, newLabel: string) => {
      const take = savedTakes.find((t) => t.id === takeId);
      if (!take) return;
      const updated: RecordedTake = { ...take, sectionLabel: newLabel };
      await userLibraryService.saveTake(updated);
      await refreshLibrary();
    },
    [savedTakes, refreshLibrary]
  );

  const downloadTake = useCallback((take: RecordedTake) => {
    userLibraryService.triggerDownload(take);
  }, []);

  const toggleLyricsDrawer = useCallback(() => {
    setLyricsDrawerOpen((prev) => !prev);
  }, []);

  const openNowPlaying = useCallback(() => {
    setNowPlayingOpen(true);
  }, []);

  const closeNowPlaying = useCallback(() => {
    setNowPlayingOpen(false);
  }, []);

  const toggleNowPlaying = useCallback(() => {
    setNowPlayingOpen((prev) => !prev);
  }, []);

  const setIsLoopingSection = useCallback((loop: boolean) => {
    setIsLoopingSectionState(loop);
  }, []);

  // Window test bindings & facade exposure
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __naro_play_song?: (s: Song, st?: number) => void;
        __naro_toggle_play?: () => void;
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
        __naro_set_sound_mode?: (mode: SoundMode) => void;
        __naro_get_sound_mode?: () => SoundMode;
        __naro_set_sound_preset?: (preset: SoundPreset) => void;
        __naro_get_sound_preset?: () => SoundPreset;
        __naro_toggle_like?: (s: Song) => void;
        __naro_is_liked?: (id: string) => boolean;
        __naro_get_playlists?: () => Playlist[];
      };

      win.__naro_play_song = playSong;
      win.__naro_toggle_play = togglePlay;
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
      win.__naro_set_sound_mode = setSoundMode;
      win.__naro_get_sound_mode = () => soundMode;
      win.__naro_set_sound_preset = setSoundPreset;
      win.__naro_get_sound_preset = () => soundPreset;
      win.__naro_toggle_like = toggleLikeSong;
      win.__naro_is_liked = isSongLiked;
      win.__naro_get_playlists = () => playlists;
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
    isPlaying,
    soundMode,
    soundPreset,
    setSoundMode,
    setSoundPreset,
    toggleLikeSong,
    isSongLiked,
    playlists
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
        soundMode,
        soundPreset,
        setSoundMode,
        setSoundPreset,
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
        currentUser,
        isAuthenticated: currentUser !== null,
        authModalOpen,
        authModalMode,
        setAuthModalOpen,
        openAuthModal,
        logout,
        likedSongIds,
        toggleLikeSong,
        isSongLiked,
        playlists,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        reorderPlaylistSongs,
        playPlaylist,
        addToPlaylistModalOpen,
        playlistTargetSong,
        setAddToPlaylistModalOpen,
        openAddToPlaylist,
        recentlyPlayed,
        downloadedSongs,
        downloadSong,
        isSongDownloaded,
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
        renameTakeInLibrary,
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
