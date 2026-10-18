// IndexedDB Storage Service for NARO
// Persists real audio blobs and user-recorded moments in the browser

import type { RecordedTake, SongLyrics } from '../../shared';

const DB_NAME = 'naro_storage_db';
const DB_VERSION = 2;
const MOMENTS_STORE = 'moments';
const LYRICS_STORE = 'lyrics_cache';

export interface CachedLyricsRecord {
  trackId: string;
  lyrics: SongLyrics;
  provider?: string;
  cachedAt: number;
}

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryLyricsCache: Map<string, SongLyrics> = new Map();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MOMENTS_STORE)) {
          const store = db.createObjectStore(MOMENTS_STORE, { keyPath: 'id' });
          store.createIndex('recordedAt', 'recordedAt', { unique: false });
          store.createIndex('songId', 'songId', { unique: false });
        }
        if (!db.objectStoreNames.contains(LYRICS_STORE)) {
          const store = db.createObjectStore(LYRICS_STORE, { keyPath: 'trackId' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save a recorded take with its real audio Blob into IndexedDB
   */
  public async saveTake(take: RecordedTake): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MOMENTS_STORE], 'readwrite');
      const store = transaction.objectStore(MOMENTS_STORE);

      // Clone object but preserve blob; remove transient blob URL
      const { audioBlobUrl: _ignored, ...recordToSave } = take;

      const request = store.put(recordToSave);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve all saved moments, reconstructing blob URLs for instant playback
   */
  public async getAllTakes(): Promise<RecordedTake[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MOMENTS_STORE], 'readonly');
      const store = transaction.objectStore(MOMENTS_STORE);
      const index = store.index('recordedAt');
      const request = index.openCursor(null, 'prev'); // Most recent first
      const results: RecordedTake[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as RecordedTake;
          if (item.audioBlob && item.audioBlob instanceof Blob) {
            item.audioBlobUrl = URL.createObjectURL(item.audioBlob);
          }
          results.push(item);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve a single take by ID
   */
  public async getTakeById(id: string): Promise<RecordedTake | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MOMENTS_STORE], 'readonly');
      const store = transaction.objectStore(MOMENTS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result as RecordedTake | undefined;
        if (item && item.audioBlob && item.audioBlob instanceof Blob) {
          item.audioBlobUrl = URL.createObjectURL(item.audioBlob);
        }
        resolve(item || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a take by ID
   */
  public async deleteTake(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MOMENTS_STORE], 'readwrite');
      const store = transaction.objectStore(MOMENTS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export / Trigger genuine file download for a recorded take
   */
  public triggerDownload(take: RecordedTake): void {
    if (!take.audioBlob && !take.audioBlobUrl) {
      console.warn('No audio blob available to download for take:', take.id);
      return;
    }

    const cleanTitle = (take.songTitle || 'Take').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSection = (take.section || 'Moment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanLang = take.language || 'en';
    const filename = `NARO_${cleanTitle}_${cleanSection}_${cleanLang}.webm`;

    const url = take.audioBlobUrl || (take.audioBlob ? URL.createObjectURL(take.audioBlob) : null);
    if (!url) return;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  /**
   * Check IndexedDB / localStorage cache for a track ID
   */
  public async getLyrics(trackId: string): Promise<SongLyrics | null> {
    if (!trackId) return null;

    // 1. Check in-memory cache first
    if (this.memoryLyricsCache.has(trackId)) {
      return this.memoryLyricsCache.get(trackId)!;
    }

    // 2. Try IndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        const db = await this.getDB();
        const record = await new Promise<CachedLyricsRecord | null>((resolve, reject) => {
          const transaction = db.transaction([LYRICS_STORE], 'readonly');
          const store = transaction.objectStore(LYRICS_STORE);
          const request = store.get(trackId);
          request.onsuccess = () => resolve((request.result as CachedLyricsRecord) || null);
          request.onerror = () => reject(request.error);
        });

        if (record && record.lyrics) {
          this.memoryLyricsCache.set(trackId, record.lyrics);
          return record.lyrics;
        }
      } catch {
        // Fallback to localStorage or in-memory
      }
    }

    // 3. Try LocalStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`naro_lyrics_${trackId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as SongLyrics;
          if (parsed && typeof parsed === 'object') {
            this.memoryLyricsCache.set(trackId, parsed);
            return parsed;
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    return null;
  }

  /**
   * Save a successful lyrics payload into IndexedDB & localStorage cache under the track ID
   */
  public async saveLyrics(trackId: string, lyrics: SongLyrics, provider?: string): Promise<void> {
    if (!trackId || !lyrics) return;

    // 1. Populate in-memory cache immediately
    this.memoryLyricsCache.set(trackId, lyrics);

    // 2. Persist to localStorage as instant synchronous safeguard
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`naro_lyrics_${trackId}`, JSON.stringify(lyrics));
      }
    } catch {
      // Quota exceeded or private browsing safeguard
    }

    // 3. Persist to IndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        const db = await this.getDB();
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([LYRICS_STORE], 'readwrite');
          const store = transaction.objectStore(LYRICS_STORE);
          const record: CachedLyricsRecord = {
            trackId,
            lyrics,
            provider,
            cachedAt: Date.now()
          };
          const request = store.put(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (err) {
        // Non-fatal if IndexedDB is disabled; memory and localStorage already retain it
        console.warn('IndexedDB lyrics save fallback:', err);
      }
    }
  }

  /**
   * Clear cached lyrics for a track ID or all tracks
   */
  public async clearLyricsCache(trackId?: string): Promise<void> {
    if (trackId) {
      this.memoryLyricsCache.delete(trackId);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(`naro_lyrics_${trackId}`);
        }
        if (typeof window !== 'undefined' && window.indexedDB) {
          const db = await this.getDB();
          const transaction = db.transaction([LYRICS_STORE], 'readwrite');
          const store = transaction.objectStore(LYRICS_STORE);
          store.delete(trackId);
        }
      } catch {
        // Ignore
      }
    } else {
      this.memoryLyricsCache.clear();
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = window.localStorage.length - 1; i >= 0; i--) {
            const key = window.localStorage.key(i);
            if (key?.startsWith('naro_lyrics_')) {
              window.localStorage.removeItem(key);
            }
          }
        }
        if (typeof window !== 'undefined' && window.indexedDB) {
          const db = await this.getDB();
          const transaction = db.transaction([LYRICS_STORE], 'readwrite');
          const store = transaction.objectStore(LYRICS_STORE);
          store.clear();
        }
      } catch {
        // Ignore
      }
    }
  }
}

export const indexedDbService = new IndexedDbService();
