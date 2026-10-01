// IndexedDB Storage Service for NARO
// Persists real audio blobs and user-recorded moments in the browser

import type { RecordedTake } from '../../shared';

const DB_NAME = 'naro_storage_db';
const DB_VERSION = 1;
const MOMENTS_STORE = 'moments';

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

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
}

export const indexedDbService = new IndexedDbService();
