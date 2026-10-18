// Chart Snapshot Store and Persistence Layer
// Persists validated chart snapshots with memory and localStorage support.
// Guarantees last-known-good snapshot preservation on provider failures.

import type { ChartSnapshot } from './types';

const STORAGE_PREFIX = 'hypermelo_chart_snapshot_';
const LAST_GOOD_PREFIX = 'hypermelo_chart_last_good_';

export class ChartSnapshotStore {
  private memoryCache = new Map<string, ChartSnapshot>();
  private lastGoodCache = new Map<string, ChartSnapshot>();

  /**
   * Retrieves the current snapshot for a chart ID
   */
  public getSnapshot(chartId: string): ChartSnapshot | null {
    // Check memory first
    if (this.memoryCache.has(chartId)) {
      return this.memoryCache.get(chartId)!;
    }

    // Try localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${chartId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as ChartSnapshot;
          this.memoryCache.set(chartId, parsed);
          return parsed;
        }
      } catch (err) {
        console.warn(`[ChartSnapshotStore] Failed to read from localStorage:`, err);
      }
    }

    return null;
  }

  /**
   * Persists a validated chart snapshot
   */
  public saveSnapshot(snapshot: ChartSnapshot): void {
    this.memoryCache.set(snapshot.chart_id, snapshot);

    // If snapshot has valid tracks and is live or editorial, also update last known good
    if (snapshot.tracks && snapshot.tracks.length > 0 && snapshot.status !== 'unavailable') {
      this.lastGoodCache.set(snapshot.chart_id, snapshot);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(
            `${LAST_GOOD_PREFIX}${snapshot.chart_id}`,
            JSON.stringify(snapshot)
          );
        } catch {
          // Ignore storage quota
        }
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          `${STORAGE_PREFIX}${snapshot.chart_id}`,
          JSON.stringify(snapshot)
        );
      } catch (err) {
        console.warn(`[ChartSnapshotStore] Failed to write to localStorage:`, err);
      }
    }
  }

  /**
   * Retrieves the last known good snapshot, crucial for graceful fallback during provider downtime
   */
  public getLastKnownGoodSnapshot(chartId: string): ChartSnapshot | null {
    if (this.lastGoodCache.has(chartId)) {
      return this.lastGoodCache.get(chartId)!;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`${LAST_GOOD_PREFIX}${chartId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as ChartSnapshot;
          this.lastGoodCache.set(chartId, parsed);
          return parsed;
        }
      } catch {
        // Fall back to current snapshot
      }
    }

    return this.getSnapshot(chartId);
  }

  /**
   * Clears cached snapshots (useful for tests and resets)
   */
  public clear(): void {
    this.memoryCache.clear();
    this.lastGoodCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith(LAST_GOOD_PREFIX))) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // Ignore
      }
    }
  }
}

export const chartSnapshotStore = new ChartSnapshotStore();
