import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Song, Language, SongSection, RecordedTake, PlaybackState, TimedLyricLine, KaraokeScriptMode } from '../types/music';
import { ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN, SONGS } from '../data/songs';
import { getAllCuratedSongs } from '../data/curatedCatalog';
import { playbackController } from '../services/audio/PlaybackController';
import { karaokePlaybackService } from '../services/audio/karaokePlaybackService';
import { connectivityService } from '../services/connectivity/connectivityService';
import { userLibraryService } from '../backend/services/UserLibraryService';
import { lyricsService } from '../services/lyrics/lyricsService';
import { lyricsPipelineService, getCanonicalTrackKey, type TrackLyricsResolution } from '../services/lyrics/lyricsPipelineService';
import { personalLibraryStore, type User, type Playlist, type RecentlyPlayedItem } from '../services/storage/personalLibraryStore';
import { authService } from '../services/auth/authService';
import type { SoundMode, SoundPreset } from '../services/audio/naroImmersiveEngine';

export type AppView = 'home' | 'discover' | 'karaoke' | 'library' | 'downloads' | 'instagram-audio';

interface AudioPlayerContextType {
  songs: Song[];
  currentSong: Song | null;
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
  sourceLanguage: string;
  selectedLanguage: Language;
  lyricsRevision: number;

  // Real-time Lyrics Resolution State
  lyricsResolution: TrackLyricsResolution | undefined;
  isResolvingLyrics: boolean;
  retryLyricsResolution: () => Promise<TrackLyricsResolution | undefined>;

  // Dual-Mode Synchronized Lyrics Preferences
  karaokeScriptPreference: KaraokeScriptMode;
  setKaraokeScriptPreference: (pref: KaraokeScriptMode) => void;
  listeningMeaningLanguage: Language;
  setListeningMeaningLanguage: (lang: Language) => void;

  // NARO Immersive Sound Engine & Bass Enhancement
  soundMode: SoundMode;
  soundPreset: SoundPreset;
  bassIntensity: number;
  isDspSupported: boolean;
  activeDspDescription: string;
  setSoundMode: (mode: SoundMode) => void;
  setSoundPreset: (preset: SoundPreset) => void;
  setBassIntensity: (intensity: number) => void;
  cycleSoundMode: () => void;

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

  // Share Moment Video Creation Modal
  shareMomentOpen: boolean;
  shareMomentSong: Song | null;
  openShareMoment: (song?: Song | null) => void;
  closeShareMoment: () => void;

  // Personal Library: Recently Played & Downloads
  recentlyPlayed: RecentlyPlayedItem[];
  downloadedSongs: Song[];
  downloadSong: (song: Song) => void;
  isSongDownloaded: (songId: string) => boolean;

  // Authoritative Playback Queue
  queue: Song[];
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
  reorderQueue: (newQueue: Song[]) => void;
  addToQueue: (song: Song) => void;

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
  openKaraokeForSong: (song?: Song | null, section?: SongSection) => void;
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

// Resolve initial track respecting session state: fresh launch starts empty (null)
function resolveInitialSong(): Song | null {
  if (typeof window !== 'undefined') {
    try {
      const storedId = sessionStorage.getItem('hypermelo_active_track_id');
      if (storedId) {
        const found = [ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN, ...SONGS].find((s) => s.id === storedId);
        if (found) return found;
      }
    } catch {
      // sessionStorage inaccessible (private browsing or sandbox)
    }
  }
  return null;
}

// Consumer catalog contains verified tracks and catalog songs.
const INITIAL_SONGS: Song[] = [
  ANIRUDH_GAALI_VAALUGA,
  JOSH_WOODWARD_SHOT_DOWN,
  ...SONGS.filter((s) => s.id !== ANIRUDH_GAALI_VAALUGA.id && s.id !== JOSH_WOODWARD_SHOT_DOWN.id)
];

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [songs, setSongs] = useState<Song[]>(INITIAL_SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(resolveInitialSong);
  const [volume, setVolumeState] = useState<number>(0.8);
  const initialSongLang = useMemo(() => currentSong ? lyricsService.detectSongLanguage(currentSong) : 'en', [currentSong]);
  const [activeLanguage, setActiveLanguageState] = useState<Language>(initialSongLang);
  const [displayLanguage, setDisplayLanguageState] = useState<Language>(initialSongLang);
  const [lyricsRevision, setLyricsRevision] = useState<number>(0);
  const manualLangRef = useRef<{ songId: string; lang: Language } | null>(null);
  const prevSongIdRef = useRef<string | null>(currentSong?.id ?? null);
  const [isLoopingSection, setIsLoopingSectionState] = useState<boolean>(false);
  const [currentView, setCurrentViewState] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as AppView;
      const validViews: AppView[] = ['home', 'discover', 'karaoke', 'library', 'downloads'];
      if (validViews.includes(hash)) return hash;
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as AppView;
      if (validViews.includes(viewParam)) return viewParam;
    }
    return 'home';
  });

  const setCurrentView = useCallback((view: AppView) => {
    if ((view as string) === 'instagram-audio') {
      setCurrentViewState('discover');
      return;
    }
    setCurrentViewState(view);
  }, []);
  const [savedTakes, setSavedTakes] = useState<RecordedTake[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(connectivityService.isOnline);

  // Dual-Mode Synchronized Lyrics Preferences
  const [karaokeScriptPreference, setKaraokeScriptPreferenceState] = useState<KaraokeScriptMode>('native');
  const [listeningMeaningLanguage, setListeningMeaningLanguageState] = useState<Language>('en');

  // Sound Engine state (Phase 2 & 3)
  const [soundMode, setSoundModeState] = useState<SoundMode>('original');
  const [soundPreset, setSoundPresetState] = useState<SoundPreset>('immersive');
  const [bassIntensity, setBassIntensityState] = useState<number>(0);
  const [isDspSupported, setIsDspSupported] = useState<boolean>(() => playbackController.isDspSupported());

  const setSoundMode = useCallback((mode: SoundMode) => {
    setSoundModeState(mode);
    playbackController.setSoundMode(mode);
    setIsDspSupported(playbackController.isDspSupported());
  }, []);

  const setSoundPreset = useCallback((preset: SoundPreset) => {
    setSoundPresetState(preset);
    playbackController.setSoundPreset(preset);
    const currentActiveMode = playbackController.getSoundMode();
    setSoundModeState(currentActiveMode);
    setIsDspSupported(playbackController.isDspSupported());
  }, []);

  const setBassIntensity = useCallback((intensity: number) => {
    const clamped = Math.max(-5, Math.min(5, Math.round(intensity)));
    setBassIntensityState(clamped);
    playbackController.setBassIntensity(clamped);
  }, []);

  const cycleSoundMode = useCallback(() => {
    setSoundModeState((prev) => {
      let next: SoundMode;
      if (prev === 'original') next = 'immersive';
      else if (prev === 'immersive') next = 'punch';
      else next = 'original';
      playbackController.setSoundMode(next);
      return next;
    });
    setIsDspSupported(playbackController.isDspSupported());
  }, []);

  const activeDspDescription = useMemo(() => {
    return playbackController.getActiveDspDescription();
  }, [soundMode, soundPreset, bassIntensity, isDspSupported]);

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
    setDownloadedSongs(personalLibraryStore.getDownloadedSongs());
  }, []);

  // Subscribe to auth service session updates
  useEffect(() => {
    const unsub = authService.subscribe((user) => {
      setCurrentUser(user);
      const uid = user?.id;
      setLikedSongIds(personalLibraryStore.getLikedSongIds(uid));
      setPlaylists(personalLibraryStore.getPlaylists(uid));
      setRecentlyPlayed(personalLibraryStore.getRecentlyPlayed(uid));
      setDownloadedSongs(personalLibraryStore.getDownloadedSongs(uid));
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
    personalLibraryStore.getDownloadedSongs(authService.getCurrentUser()?.id)
  );

  // Authoritative Playback Queue state & synchronization
  const [queueState, setQueueState] = useState<Song[]>(() => playbackController.getQueue());

  useEffect(() => {
    const unsub = playbackController.subscribeQueue((q) => {
      setQueueState([...q]);
    });
    return unsub;
  }, []);

  const removeFromQueue = useCallback((songId: string) => {
    playbackController.removeFromQueue(songId);
  }, []);

  const clearQueue = useCallback(() => {
    playbackController.clearQueue();
  }, []);

  const reorderQueue = useCallback((newQueue: Song[]) => {
    playbackController.reorderQueue(newQueue);
  }, []);

  const addToQueue = useCallback((song: Song) => {
    playbackController.addToQueue(song);
  }, []);

  // Ensure playbackController has an initial queue if empty
  useEffect(() => {
    if (playbackController.getQueue().length === 0) {
      if (currentSong) {
        const remaining = songs.filter((s) => s.id !== currentSong.id);
        playbackController.setQueue([currentSong, ...remaining]);
      } else if (songs.length > 0) {
        playbackController.setQueue(songs);
      }
    }
  }, [songs, currentSong]);

  // Add to Playlist modal state
  const [addToPlaylistModalOpen, setAddToPlaylistModalOpen] = useState(false);
  const [playlistTargetSong, setPlaylistTargetSong] = useState<Song | null>(null);

  const openAddToPlaylist = useCallback((song: Song) => {
    setPlaylistTargetSong(song);
    setAddToPlaylistModalOpen(true);
  }, []);

  // Share Moment modal state & single playback ownership lifecycle
  const [shareMomentOpen, setShareMomentOpen] = useState(false);
  const [shareMomentSong, setShareMomentSong] = useState<Song | null>(null);
  const preShareMomentSnapshotRef = useRef<{
    song: Song | null;
    currentTime: number;
    wasPlaying: boolean;
  } | null>(null);

  const openShareMoment = useCallback((song?: Song | null) => {
    const target = song || currentSong;
    const clock = playbackController.getCurrentClock();
    const wasPlaying = Boolean(clock.isPlaying);
    const currentTime = Number(clock.currentTime) || 0;

    // 1. Capture snapshot of main player state
    preShareMomentSnapshotRef.current = {
      song: currentSong,
      currentTime,
      wasPlaying
    };

    // 2. Pause main player immediately and acquire exclusive playback lock
    playbackController.pause();
    playbackController.acquirePlaybackLock('share-moment');

    setShareMomentSong(target || null);
    setShareMomentOpen(true);
  }, [currentSong]);

  const closeShareMoment = useCallback(() => {
    setShareMomentOpen(false);

    // Release exclusive playback lock
    playbackController.releasePlaybackLock('share-moment');

    const snapshot = preShareMomentSnapshotRef.current;
    preShareMomentSnapshotRef.current = null;

    if (snapshot && snapshot.song) {
      if (snapshot.wasPlaying) {
        // Resume main player from exact saved position
        playbackController.loadAndPlay(snapshot.song, snapshot.currentTime).catch(console.warn);
      } else {
        // Restore exact position and leave paused
        playbackController.load(snapshot.song, snapshot.currentTime).catch(console.warn);
      }
    }
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
      const match = songs.find((s) => s.id === firstId) || ANIRUDH_GAALI_VAALUGA;
      playbackController.loadAndPlay(match, 0);
    },
    [songs]
  );

  const downloadSong = useCallback((song: Song) => {
    const uid = authService.getCurrentUser()?.id;
    personalLibraryStore.addDownloadedSong(song, uid);
    setDownloadedSongs(personalLibraryStore.getDownloadedSongs(uid));
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
    return currentSong ? lyricsService.detectSongLanguage(currentSong) : 'en';
  }, [currentSong]);

  // Actual source language detected from lyric text/script
  const sourceLanguage: string = useMemo(() => {
    return currentSong ? lyricsService.getSongSourceLanguage(currentSong) : 'en';
  }, [currentSong]);

  // Subscribe to authoritative PlaybackController track changes to keep UI and audio perfectly aligned
  useEffect(() => {
    const unsub = playbackController.subscribeTrack((track) => {
      if (track) {
        setCurrentSong((prev) => {
          if (
            !prev ||
            prev.id !== track.id ||
            prev.playbackSource?.streamUrl !== track.playbackSource?.streamUrl ||
            prev.artwork?.imageUrl !== track.artwork?.imageUrl
          ) {
            return track;
          }
          return prev;
        });
      }
    });
    return unsub;
  }, []);

  // Real-time Lyrics Resolution State
  const [lyricsResolution, setLyricsResolution] = useState<TrackLyricsResolution | undefined>(() =>
    lyricsPipelineService.getResolutionStatus(currentSong)
  );
  const [isResolvingLyrics, setIsResolvingLyrics] = useState<boolean>(() =>
    lyricsPipelineService.isResolving(currentSong)
  );

  // Subscribe to shared lyrics pipeline updates for current song
  useEffect(() => {
    if (!currentSong) {
      setLyricsResolution(undefined);
      setIsResolvingLyrics(false);
      return;
    }
    const currentKey = getCanonicalTrackKey(currentSong);
    const unsub = lyricsPipelineService.subscribe((res) => {
      if (res.trackId === currentSong.id || res.canonicalKey === currentKey) {
        setLyricsResolution(res);
        setIsResolvingLyrics(res.outcome === 'PENDING');
      }
    });
    return unsub;
  }, [currentSong?.id]);

  const retryLyricsResolution = useCallback(async () => {
    if (!currentSong) return undefined;
    setIsResolvingLyrics(true);
    try {
      const res = await lyricsPipelineService.resolveTrack(currentSong, true);
      setLyricsResolution(res);
      if (
        res.outcome === 'SYNCED_VERIFIED' ||
        res.outcome === 'SYNCHRONIZED' ||
        res.outcome === 'PLAIN_VERIFIED' ||
        res.outcome === 'VERIFIED_UNTIMED'
      ) {
        setCurrentSong((prev) =>
          prev && prev.id === currentSong.id
            ? {
                ...prev,
                lyrics: currentSong.lyrics ? { ...currentSong.lyrics } : prev.lyrics,
                lyricsAvailable: true,
                lyricsSyncAvailable: res.hasSyncedLyrics
              }
            : prev
        );
      }
      setLyricsRevision((r) => r + 1);
      return res;
    } finally {
      setIsResolvingLyrics(false);
    }
  }, [currentSong]);

  // Recalculate default lyrics language when song changes, resolve canonical lyrics & synchronize PlaybackController
  useEffect(() => {
    if (!currentSong) return;
    const isNew = currentSong.id !== prevSongIdRef.current;
    if (isNew) {
      prevSongIdRef.current = currentSong.id;
      manualLangRef.current = null;
      const detected = lyricsService.detectSongLanguage(currentSong);
      setDisplayLanguageState(detected);
      setActiveLanguageState(detected);

      // Keep PlaybackController in sync with user's selected song
      const active = playbackController.getCurrentTrack();
      if (!active || active.id !== currentSong.id) {
        if (playbackController.isPlaying()) {
          playbackController.loadAndPlay(currentSong, 0).catch((err) => {
            console.warn('Track switch notice:', err);
          });
        } else {
          playbackController.load(currentSong, 0).catch((err) => {
            console.warn('Track switch notice:', err);
          });
        }
      }
    }
    // Asynchronously resolve lyrics via shared lyrics pipeline, checking for stale track
    const targetSongId = currentSong.id;
    setIsResolvingLyrics(true);
    lyricsPipelineService
      .resolveTrack(currentSong)
      .then((res) => {
        if (prevSongIdRef.current === targetSongId) {
          setLyricsResolution(res);
          setIsResolvingLyrics(false);
          if (
            res.outcome === 'SYNCED_VERIFIED' ||
            res.outcome === 'SYNCHRONIZED' ||
            res.outcome === 'PLAIN_VERIFIED' ||
            res.outcome === 'VERIFIED_UNTIMED'
          ) {
            setCurrentSong((prev) =>
              prev && prev.id === targetSongId
                ? {
                    ...prev,
                    lyrics: currentSong.lyrics ? { ...currentSong.lyrics } : prev.lyrics,
                    lyricsAvailable: true,
                    lyricsSyncAvailable: res.hasSyncedLyrics
                  }
                : prev
            );
          }
          setLyricsRevision((prev) => prev + 1);
        }
      })
      .catch((err) => {
        console.warn('Lyrics resolution notice:', err);
        setIsResolvingLyrics(false);
      });
  }, [currentSong?.id]);

  // Central playback clock states
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(currentSong?.duration || 0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Default section
  const defaultChorus: SongSection = currentSong?.sections?.find((s) => s.type === 'chorus') || currentSong?.sections?.[0] || {
    type: 'verse',
    label: 'Verse 1',
    start: 0,
    end: 45
  };
  const [selectedSection, setSelectedSectionState] = useState<SongSection>(defaultChorus);

  // On session restore (when a valid user selection exists), prepare active track in PlaybackController
  useEffect(() => {
    if (currentSong) {
      playbackController.load(currentSong, 0).catch((err) => {
        console.warn('Initial track load notice:', err);
      });
    }
  }, []);

  // Save active track ID into session storage to preserve selection across session navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSong?.id) {
      try {
        sessionStorage.setItem('hypermelo_active_track_id', currentSong.id);
      } catch {
        // ignore
      }
    }
  }, [currentSong]);

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
      setIsDspSupported(playbackController.isDspSupported());
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
    setSongs((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song]));
    setCurrentSong(song);
    playbackController.loadAndPlay(song, startTime).catch((err) => {
      console.warn('playSong error:', err);
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentSong) {
      if (songs.length > 0) {
        playSong(songs[0], 0);
      }
      return;
    }
    playbackController.togglePlay(currentSong);
  }, [currentSong, songs, playSong]);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
    playbackController.seek(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    playbackController.setVolume(clamped);
  }, []);

  const nextSong = useCallback(() => {
    const queue = playbackController.getQueue();
    if (queue.length > 1) {
      playbackController.nextTrack().catch(console.warn);
      return;
    }
    const all = getAllCuratedSongs();
    const effectiveList = songs.length > 0 ? songs : all;
    if (!currentSong) {
      if (effectiveList.length > 0) playSong(effectiveList[0], 0);
      return;
    }
    const currentIndex = effectiveList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % effectiveList.length;
      playSong(effectiveList[nextIndex], 0);
    } else {
      const curIndex = all.findIndex((s) => s.id === currentSong.id);
      if (curIndex !== -1) {
        const nextIndex = (curIndex + 1) % all.length;
        playSong(all[nextIndex], 0);
      } else if (effectiveList.length > 0) {
        playSong(effectiveList[0], 0);
      }
    }
  }, [songs, currentSong, playSong]);

  const prevSong = useCallback(() => {
    const queue = playbackController.getQueue();
    if (queue.length > 1) {
      playbackController.prevTrack().catch(console.warn);
      return;
    }
    const all = getAllCuratedSongs();
    const effectiveList = songs.length > 0 ? songs : all;
    if (!currentSong) {
      if (effectiveList.length > 0) playSong(effectiveList[0], 0);
      return;
    }
    const currentIndex = effectiveList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + effectiveList.length) % effectiveList.length;
      playSong(effectiveList[prevIndex], 0);
    } else {
      const curIndex = all.findIndex((s) => s.id === currentSong.id);
      if (curIndex !== -1) {
        const prevIndex = (curIndex - 1 + all.length) % all.length;
        playSong(all[prevIndex], 0);
      } else if (effectiveList.length > 0) {
        playSong(effectiveList[0], 0);
      }
    }
  }, [songs, currentSong, playSong]);

  const setDisplayLanguage = useCallback((lang: Language) => {
    if (!currentSong) return;
    manualLangRef.current = { songId: currentSong.id, lang };
    const srcLang = lyricsService.getSongSourceLanguage(currentSong);
    // If re-selecting same language, invalidate cache to force fresh resolution
    if (lang === displayLanguage) {
      lyricsService.clearTranslationCache(currentSong.id, srcLang, lang);
    }
    setDisplayLanguageState(lang);
    setActiveLanguageState(lang);
    setLyricsRevision((prev) => prev + 1);
  }, [currentSong, displayLanguage]);

  const setActiveLanguage = useCallback((lang: Language) => {
    if (!currentSong) return;
    manualLangRef.current = { songId: currentSong.id, lang };
    const srcLang = lyricsService.getSongSourceLanguage(currentSong);
    if (lang === displayLanguage) {
      lyricsService.clearTranslationCache(currentSong.id, srcLang, lang);
    }
    setActiveLanguageState(lang);
    setDisplayLanguageState(lang);
    setLyricsRevision((prev) => prev + 1);
  }, [currentSong, displayLanguage]);

  const setSelectedSection = useCallback((sec: SongSection) => {
    setSelectedSectionState(sec);
  }, []);

  const setKaraokeScriptPreference = useCallback((pref: KaraokeScriptMode) => {
    setKaraokeScriptPreferenceState(pref);
  }, []);

  const setListeningMeaningLanguage = useCallback((lang: Language) => {
    setListeningMeaningLanguageState(lang);
    setDisplayLanguageState(lang);
    setActiveLanguageState(lang);
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

  const openKaraokeForSong = useCallback((song?: Song | null, section?: SongSection) => {
    const targetSong = song || currentSong;
    if (targetSong && targetSong.id !== currentSong?.id) {
      setCurrentSong(targetSong);
    }
    const resolvedSection: SongSection = section || targetSong?.sections?.find((s) => s.type === 'chorus') || targetSong?.sections?.[0] || {
      type: 'verse',
      label: 'Verse 1',
      start: 0,
      end: Math.min(targetSong?.duration || 255, 45)
    };
    setSelectedSectionState(resolvedSection);

    if (targetSong) {
      playbackController.load(targetSong, resolvedSection.start).catch((err) => {
        console.warn('openKaraokeForSong load notice:', err);
      });
      lyricsPipelineService.resolveTrack(targetSong).then((res) => {
        if (res.outcome === 'SYNCHRONIZED' || res.outcome === 'VERIFIED_UNTIMED') {
          setLyricsRevision((r) => r + 1);
        }
      }).catch((e) => {
        console.warn('[AudioPlayer] Pre-fetch lyrics notice in openKaraokeForSong:', e);
      });
    }
    setKaraokeModalOpen(true);
  }, [currentSong]);

  const closeKaraokeModal = useCallback(() => {
    setKaraokeModalOpen(false);
    karaokePlaybackService.stop();
    playbackController.setKaraokeMode(false);
    setIsKaraokeMode(false);
  }, []);

  const startKaraokeRecording = useCallback((section: SongSection) => {
    if (!currentSong) return;
    setSelectedSectionState(section);
    setKaraokeModalOpen(false);
    setIsRecordingActive(true);
    karaokePlaybackService.loadBackingSource(currentSong, section.start).catch((err) => {
      console.warn('loadBackingSource notice in startKaraokeRecording:', err);
    });
    playbackController.setKaraokeMode(true, section.start);
    setIsKaraokeMode(true);
  }, [currentSong]);

  const stopKaraokeRecording = useCallback(() => {
    setIsRecordingActive(false);
    karaokePlaybackService.stop();
    playbackController.setKaraokeMode(false);
    setIsKaraokeMode(false);
  }, []);

  const finishTake = useCallback((take: RecordedTake) => {
    setRecordedTake(take);
    setIsRecordingActive(false);
    setReviewModalOpen(true);
    karaokePlaybackService.stop();
    playbackController.setKaraokeMode(false);
    setIsKaraokeMode(false);
  }, []);

  const dismissReviewModal = useCallback(() => {
    setReviewModalOpen(false);
    playbackController.setKaraokeMode(false);
    setIsKaraokeMode(false);
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

  const openLyricsDrawer = useCallback(() => {
    setLyricsDrawerOpen(true);
  }, []);

  const closeLyricsDrawer = useCallback(() => {
    setLyricsDrawerOpen(false);
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
        __naro_current_song?: Song | null;
        __naro_set_karaoke?: (enabled: boolean) => void;
        __naro_toggle_karaoke?: () => void;
        __naro_open_karaoke_modal?: () => void;
        __naro_get_audio?: () => HTMLAudioElement | null;
        __naro_toggle_lyrics?: () => void;
        __naro_open_lyrics?: () => void;
        __naro_close_lyrics?: () => void;
        __naro_is_lyrics_open?: () => boolean;
        __naro_seek?: (time: number) => void;
        __naro_open_now_playing?: () => void;
        __naro_close_now_playing?: () => void;
        __naro_toggle_now_playing?: () => void;
        __naro_is_now_playing_open?: () => boolean;
        __naro_set_display_language?: (lang: Language) => void;
        __naro_get_display_language?: () => Language;
        __naro_get_source_language?: () => string;
        __naro_get_selected_language?: () => Language;
        __naro_get_current_time?: () => number;
        __naro_is_playing?: () => boolean;
        __naro_get_canonical_lines?: () => TimedLyricLine[];
        __naro_playback_controller?: typeof playbackController;
        __naro_set_sound_mode?: (mode: SoundMode) => void;
        __naro_get_sound_mode?: () => SoundMode;
        __naro_set_sound_preset?: (preset: SoundPreset) => void;
        __naro_get_sound_preset?: () => SoundPreset;
        __naro_set_bass_intensity?: (intensity: number) => void;
        __naro_get_bass_intensity?: () => number;
        __naro_cycle_sound_mode?: () => void;
        __naro_is_dsp_supported?: () => boolean;
        __naro_get_dsp_description?: () => string;
        __naro_refresh_lyrics?: () => void;
        __naro_get_lyrics_revision?: () => number;
        __naro_toggle_like?: (s: Song) => void;
        __naro_is_liked?: (id: string) => boolean;
        __naro_get_playlists?: () => Playlist[];
        __naro_set_karaoke_script_preference?: (pref: KaraokeScriptMode) => void;
        __naro_get_karaoke_script_preference?: () => KaraokeScriptMode;
        __naro_set_listening_meaning_language?: (lang: Language) => void;
        __naro_get_listening_meaning_language?: () => Language;
        __naro_get_songs?: () => Song[];
        __naro_play_song_by_id?: (id: string) => void;
        __naro_lyrics_pipeline?: typeof lyricsPipelineService;
        __naro_get_lyrics_status?: (s?: Song) => unknown;
        __naro_open_share_moment?: (s?: Song | null) => void;
        __naro_close_share_moment?: () => void;
        __naro_is_share_moment_open?: () => boolean;
      };

      win.__naro_play_song = playSong;
      win.__naro_toggle_play = togglePlay;
      win.__naro_playback_controller = playbackController;
      win.__naro_current_song = currentSong;
      win.__naro_get_songs = () => [...songs, ...getAllCuratedSongs().filter((cs) => !songs.some((s) => s.id === cs.id))];
      win.__naro_play_song_by_id = (id: string) => {
        const found =
          songs.find((s) => s.id === id) ||
          SONGS.find((s) => s.id === id) ||
          getAllCuratedSongs().find((s) => s.id === id);
        if (found) playSong(found);
      };
      win.__naro_set_karaoke = setKaraokeMode;
      win.__naro_toggle_karaoke = toggleKaraokeMode;
      win.__naro_open_karaoke_modal = () => openKaraokeForSong(currentSong);
      win.__naro_get_audio = () => playbackController.getAudioElement();
      win.__naro_toggle_lyrics = toggleLyricsDrawer;
      win.__naro_open_lyrics = openLyricsDrawer;
      win.__naro_close_lyrics = closeLyricsDrawer;
      win.__naro_is_lyrics_open = () => lyricsDrawerOpen;
      win.__naro_seek = seekTo;
      win.__naro_open_now_playing = openNowPlaying;
      win.__naro_close_now_playing = closeNowPlaying;
      win.__naro_toggle_now_playing = toggleNowPlaying;
      win.__naro_is_now_playing_open = () => nowPlayingOpen;
      win.__naro_set_display_language = setDisplayLanguage;
      win.__naro_get_display_language = () => displayLanguage;
      win.__naro_get_source_language = () => (currentSong ? lyricsService.getSongSourceLanguage(currentSong) : (sourceLanguage || 'en'));
      win.__naro_get_selected_language = () => displayLanguage;
      win.__naro_lyrics_pipeline = lyricsPipelineService;
      win.__naro_get_lyrics_status = (s?: Song) => lyricsPipelineService.getResolutionStatus(s || currentSong);
      win.__naro_get_current_time = () => playbackController.getCurrentClock().currentTime;
      win.__naro_is_playing = () => playbackController.getCurrentClock().isPlaying;
      win.__naro_get_canonical_lines = () => currentSong ? lyricsService.getCanonicalLyricLines(currentSong) : [];
      win.__naro_refresh_lyrics = () => setLyricsRevision((prev) => prev + 1);
      win.__naro_get_lyrics_revision = () => lyricsRevision;
      win.__naro_set_sound_mode = setSoundMode;
      win.__naro_get_sound_mode = () => soundMode;
      win.__naro_set_sound_preset = setSoundPreset;
      win.__naro_get_sound_preset = () => soundPreset;
      win.__naro_set_bass_intensity = setBassIntensity;
      win.__naro_get_bass_intensity = () => bassIntensity;
      win.__naro_cycle_sound_mode = cycleSoundMode;
      win.__naro_is_dsp_supported = () => playbackController.isDspSupported();
      win.__naro_get_dsp_description = () => playbackController.getActiveDspDescription();
      win.__naro_toggle_like = toggleLikeSong;
      win.__naro_is_liked = isSongLiked;
      win.__naro_get_playlists = () => playlists;
      win.__naro_set_karaoke_script_preference = setKaraokeScriptPreference;
      win.__naro_get_karaoke_script_preference = () => karaokeScriptPreference;
      win.__naro_set_listening_meaning_language = setListeningMeaningLanguage;
      win.__naro_get_listening_meaning_language = () => listeningMeaningLanguage;
      win.__naro_open_share_moment = openShareMoment;
      win.__naro_close_share_moment = closeShareMoment;
      win.__naro_is_share_moment_open = () => shareMomentOpen;
    }
  }, [
    playSong,
    currentSong,
    setKaraokeMode,
    toggleKaraokeMode,
    openKaraokeForSong,
    toggleLyricsDrawer,
    openLyricsDrawer,
    closeLyricsDrawer,
    lyricsDrawerOpen,
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
    bassIntensity,
    isDspSupported,
    setSoundMode,
    setSoundPreset,
    setBassIntensity,
    cycleSoundMode,
    toggleLikeSong,
    isSongLiked,
    playlists,
    karaokeScriptPreference,
    setKaraokeScriptPreference,
    listeningMeaningLanguage,
    setListeningMeaningLanguage,
    openShareMoment,
    closeShareMoment,
    shareMomentOpen,
    togglePlay,
    lyricsRevision,
    sourceLanguage,
    songs
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
        sourceLanguage,
        selectedLanguage: displayLanguage,
        lyricsRevision,
        soundMode,
        soundPreset,
        bassIntensity,
        isDspSupported,
        activeDspDescription,
        setSoundMode,
        setSoundPreset,
        setBassIntensity,
        cycleSoundMode,
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
        shareMomentOpen,
        shareMomentSong,
        openShareMoment,
        closeShareMoment,
        recentlyPlayed,
        downloadedSongs,
        downloadSong,
        isSongDownloaded,
        queue: queueState,
        removeFromQueue,
        clearQueue,
        reorderQueue,
        addToQueue,
        playSong,
        togglePlay,
        seekTo,
        setVolume,
        nextSong,
        prevSong,
        setCurrentView,
        setActiveLanguage,
        setDisplayLanguage,
        karaokeScriptPreference,
        setKaraokeScriptPreference,
        listeningMeaningLanguage,
        setListeningMeaningLanguage,
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
        addSongToCatalog,
        lyricsResolution,
        isResolvingLyrics,
        retryLyricsResolution
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
