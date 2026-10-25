// NARO Personal Library Store
// Manages Liked Songs, Custom Playlists, Recently Played History, and Offline Music
// Persists cleanly to localStorage with automatic guest-to-user migration

import type { Song } from '../../types/music';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: number;
  provider?: 'local' | 'google';
}

export interface Playlist {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  songIds: string[];
  songs?: Song[];
  artworkUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecentlyPlayedItem {
  songId: string;
  song: Song;
  playedAt: number;
}

class PersonalLibraryStore {
  private getStorageKey(prefix: string, userId?: string): string {
    return userId ? `naro_user_${userId}_${prefix}` : `naro_guest_${prefix}`;
  }

  // =========================================================================
  // LIKED SONGS
  // =========================================================================

  public getLikedSongIds(userId?: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = this.getStorageKey('liked_songs', userId);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addLikedSong(songId: string, userId?: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLikedSongIds(userId);
      if (!current.includes(songId)) {
        const updated = [songId, ...current];
        localStorage.setItem(this.getStorageKey('liked_songs', userId), JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error adding liked song:', err);
    }
  }

  public removeLikedSong(songId: string, userId?: string): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLikedSongIds(userId);
      const updated = current.filter((id) => id !== songId);
      localStorage.setItem(this.getStorageKey('liked_songs', userId), JSON.stringify(updated));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error removing liked song:', err);
    }
  }

  public isLiked(songId: string, userId?: string): boolean {
    return this.getLikedSongIds(userId).includes(songId);
  }

  // =========================================================================
  // PLAYLISTS
  // =========================================================================

  public getPlaylists(userId?: string): Playlist[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = this.getStorageKey('playlists', userId);
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
      // Default initial playlist for new users / guests
      const initialPlaylists: Playlist[] = [
        {
          id: 'favorites-mix',
          name: 'HyperMelo Favorites',
          description: 'Personal listening journey & favorites',
          songIds: ['josh-woodward-shot-down', 'midnight-drive'],
          createdAt: Date.now() - 86400000 * 2,
          updatedAt: Date.now()
        }
      ];
      localStorage.setItem(key, JSON.stringify(initialPlaylists));
      return initialPlaylists;
    } catch {
      return [];
    }
  }

  public savePlaylist(playlist: Playlist, userId?: string): void {
    if (typeof window === 'undefined') return;
    try {
      const playlists = this.getPlaylists(userId);
      const existingIdx = playlists.findIndex((p) => p.id === playlist.id);
      let updated: Playlist[];
      if (existingIdx >= 0) {
        updated = [...playlists];
        updated[existingIdx] = { ...playlist, updatedAt: Date.now() };
      } else {
        updated = [{ ...playlist, createdAt: Date.now(), updatedAt: Date.now() }, ...playlists];
      }
      localStorage.setItem(this.getStorageKey('playlists', userId), JSON.stringify(updated));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error saving playlist:', err);
    }
  }

  public deletePlaylist(playlistId: string, userId?: string): void {
    if (typeof window === 'undefined') return;
    try {
      const playlists = this.getPlaylists(userId);
      const updated = playlists.filter((p) => p.id !== playlistId);
      localStorage.setItem(this.getStorageKey('playlists', userId), JSON.stringify(updated));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error deleting playlist:', err);
    }
  }

  // =========================================================================
  // RECENTLY PLAYED
  // =========================================================================

  public getRecentlyPlayed(userId?: string): RecentlyPlayedItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = this.getStorageKey('recently_played', userId);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addRecentlyPlayed(song: Song, userId?: string): void {
    if (typeof window === 'undefined' || !song) return;
    try {
      const current = this.getRecentlyPlayed(userId);
      // Remove previous entry for same song if present
      const filtered = current.filter((item) => item.songId !== song.id);
      const updated = [{ songId: song.id, song, playedAt: Date.now() }, ...filtered].slice(0, 30);
      localStorage.setItem(this.getStorageKey('recently_played', userId), JSON.stringify(updated));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error adding recently played:', err);
    }
  }

  // =========================================================================
  // DOWNLOADED MUSIC
  // =========================================================================

  public getDownloadedSongs(userId?: string): Song[] {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage) return [];
    try {
      const key = this.getStorageKey('downloaded_songs', userId);
      let raw = storage.getItem(key);

      // Migration: If no partitioned downloads exist yet, inherit legacy unpartitioned downloads
      if (!raw) {
        const legacyRaw = storage.getItem('naro_downloaded_songs');
        if (legacyRaw) {
          try {
            const parsedLegacy = JSON.parse(legacyRaw);
            if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
              storage.setItem(key, legacyRaw);
              raw = legacyRaw;
            }
          } catch {
            // Ignore corrupted legacy data
          }
        }
      }
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public addDownloadedSong(song: Song, userId?: string): void {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage || !song) return;
    try {
      const current = this.getDownloadedSongs(userId);
      if (!current.some((s) => s.id === song.id)) {
        const updated = [song, ...current];
        const key = this.getStorageKey('downloaded_songs', userId);
        storage.setItem(key, JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error adding downloaded song:', err);
    }
  }

  public removeDownloadedSong(songId: string, userId?: string): void {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage) return;
    try {
      const current = this.getDownloadedSongs(userId);
      const updated = current.filter((s) => s.id !== songId);
      const key = this.getStorageKey('downloaded_songs', userId);
      storage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Error removing downloaded song:', err);
    }
  }

  // =========================================================================
  // GUEST MIGRATION
  // =========================================================================

  public migrateGuestDataToUser(userId: string): void {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage || !userId) return;
    try {
      // 1. Migrate Likes
      const guestLikes = this.getLikedSongIds();
      const userLikes = this.getLikedSongIds(userId);
      const mergedLikes = Array.from(new Set([...userLikes, ...guestLikes]));
      storage.setItem(this.getStorageKey('liked_songs', userId), JSON.stringify(mergedLikes));

      // 2. Migrate Playlists
      const guestPlaylists = this.getPlaylists();
      const userPlaylists = this.getPlaylists(userId);
      const mergedPlaylists = [...userPlaylists];
      for (const gp of guestPlaylists) {
        if (!mergedPlaylists.some((p) => p.name.toLowerCase() === gp.name.toLowerCase())) {
          mergedPlaylists.push({ ...gp, userId });
        }
      }
      storage.setItem(this.getStorageKey('playlists', userId), JSON.stringify(mergedPlaylists));

      // 3. Migrate Downloaded Songs
      const guestDownloads = this.getDownloadedSongs();
      const userDownloads = this.getDownloadedSongs(userId);
      const mergedDownloads = [...userDownloads];
      for (const gd of guestDownloads) {
        if (!mergedDownloads.some((s) => s.id === gd.id)) {
          mergedDownloads.push(gd);
        }
      }
      storage.setItem(this.getStorageKey('downloaded_songs', userId), JSON.stringify(mergedDownloads));
    } catch (err) {
      console.warn('[PersonalLibraryStore] Guest data migration warning:', err);
    }
  }
}

export const personalLibraryStore = new PersonalLibraryStore();
