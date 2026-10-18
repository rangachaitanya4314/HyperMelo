// HyperMelo — Safe, Resumable Lyrics Catalog Audit Script
// Measures real lyrics coverage across all 321 unique tracks in HyperMelo.
// Enforces safe request pacing, exponential backoff, circuit breaking on 429,
// resumable progress via checkpoint, accurate 6-way classification, and comprehensive reporting.

import fs from 'node:fs';
import path from 'node:path';
import { getAllCuratedSongs } from '../src/data/curatedCatalog';
import { MOOD_CATALOG } from '../src/data/moodCatalog';
import { SONGS, ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import {
  lyricsPipelineService,
  getCanonicalTrackKey
} from '../src/services/lyrics/lyricsPipelineService';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import {
  lyricsIngestionService,
  isCandidateValidMatch,
  type LrclibRecord
} from '../src/backend/services/LyricsIngestionService';
import { sanitizeLyricsMetadata, unescapeHtml } from '../src/services/lyrics/lyricsSanitizer';
import { indexedDbService } from '../src/services/storage/indexedDbService';
import type { Song } from '../src/shared';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type AuditStatus =
  | 'Verified synchronized lyrics'
  | 'Verified plain lyrics'
  | 'Confirmed missing lyrics'
  | 'Transient provider failure'
  | 'Ambiguous or mismatched candidate'
  | 'Not checked';

export interface AuditRecord {
  canonicalKey: string;
  id: string;
  title: string;
  artist: string;
  language: string;
  duration?: number;
  fullTrackDuration?: number;
  surfaces: string[];
  status: AuditStatus;
  provider?: string;
  lineCount?: number;
  sampleSnippet?: string;
  auditTimestamp?: number;
  errorCategory?: string;
  candidateDetails?: string;
  notes?: string;
  originalLyrics?: any;
}

export interface CheckpointData {
  version: number;
  updatedAt: string;
  totalCatalogTracks: number;
  records: Record<string, AuditRecord>;
}

export interface AuditCliOptions {
  dryRun: boolean;
  sampleLimit?: number;
  resume: boolean;
  reset: boolean;
  delayMs: number;
  recheckFailed?: boolean;
  forceRecheck?: boolean;
}

// ============================================================================
// Safe Rate Limiter & Circuit Breaker
// ============================================================================

class SafeRateLimiter {
  private minDelayMs: number;
  private lastRequestTime = 0;
  private consecutiveRateLimits = 0;
  private circuitOpenUntil = 0;

  constructor(minDelayMs = 800) {
    this.minDelayMs = minDelayMs;
  }

  public async acquire(): Promise<boolean> {
    const now = Date.now();
    if (now < this.circuitOpenUntil) {
      return false; // Circuit breaker open due to active rate limit
    }

    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
    return true;
  }

  public handleResponse(status: number, headers?: Headers): void {
    if (status === 429) {
      this.consecutiveRateLimits++;
      const retryAfterSec = parseInt(headers?.get('retry-after') || '15', 10);
      const backoffMs = Math.min(
        Math.max(retryAfterSec * 1000, 5000) * Math.pow(1.5, this.consecutiveRateLimits - 1),
        60000
      );
      this.circuitOpenUntil = Date.now() + backoffMs;
      console.warn(
        `\n[RateLimiter] HTTP 429 received. Backing off for ${(backoffMs / 1000).toFixed(1)}s (Circuit open)`
      );
    } else if (status >= 200 && status < 400) {
      this.consecutiveRateLimits = 0;
    }
  }

  public isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  public getCircuitRemainingMs(): number {
    return Math.max(0, this.circuitOpenUntil - Date.now());
  }
}

// ============================================================================
// Checkpoint Persistence Manager
// ============================================================================

class CheckpointManager {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  public load(): CheckpointData | null {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && data.records) {
          return data as CheckpointData;
        }
      }
    } catch (err) {
      console.warn(`[CheckpointManager] Could not read checkpoint file: ${err}`);
    }
    return null;
  }

  public save(records: Map<string, AuditRecord>, totalTracks: number): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const cleanedRecords: Record<string, AuditRecord> = {};
    for (const [key, rec] of records.entries()) {
      const { originalLyrics, ...cleanRec } = rec;
      cleanedRecords[key] = cleanRec;
    }

    const data: CheckpointData = {
      version: 1,
      updatedAt: new Date().toISOString(),
      totalCatalogTracks: totalTracks,
      records: cleanedRecords
    };

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }
}

// ============================================================================
// Single Track Auditor
// ============================================================================

async function auditTrack(
  record: AuditRecord,
  rateLimiter: SafeRateLimiter,
  dryRun: boolean
): Promise<Partial<AuditRecord>> {
  // Synthesize song object for lookup (including in-memory fixtures)
  const songObj: Song = {
    id: record.id,
    title: record.title,
    artist: record.artist,
    duration: record.duration || 180,
    fullTrackDuration: record.fullTrackDuration,
    originalLanguage: record.language as any,
    playbackAvailable: true,
    lyrics: record.originalLyrics
  } as unknown as Song;

  // 1. Check in-memory canonical lyrics first (Zero network calls)
  const inMemory = lyricsService.getCanonicalLyricLines(songObj);
  if (inMemory && inMemory.length > 0) {
    const hasRealTimestamps = inMemory.some(
      (l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1)
    );
    return {
      status: hasRealTimestamps ? 'Verified synchronized lyrics' : 'Verified plain lyrics',
      provider: 'in-memory-catalog',
      lineCount: inMemory.length,
      sampleSnippet: inMemory[0]?.text || '',
      auditTimestamp: Date.now()
    };
  }

  // 2. Check IndexedDB / local storage cache under track ID
  const { cleanTitle, cleanArtist, primaryArtist } = sanitizeLyricsMetadata(record.title, record.artist);
  const effectiveTrackId = `track_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const localCached = await indexedDbService.getLyrics(effectiveTrackId);
  if (localCached) {
    const lines = lyricsService.parseCanonicalLyrics(localCached, songObj);
    if (lines && lines.length > 0) {
      const hasRealTimestamps = lines.some(
        (l) => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0 && l.startTime !== -1)
      );
      return {
        status: hasRealTimestamps ? 'Verified synchronized lyrics' : 'Verified plain lyrics',
        provider: 'local-indexeddb-cache',
        lineCount: lines.length,
        sampleSnippet: lines[0]?.text || '',
        auditTimestamp: Date.now()
      };
    }
  }

  // 3. Dry-run mode: do not perform network requests
  if (dryRun) {
    return {
      status: 'Not checked',
      notes: 'Dry-run mode (no network requests dispatched)',
      auditTimestamp: Date.now()
    };
  }

  // 4. Check circuit breaker status
  if (rateLimiter.isCircuitOpen()) {
    return {
      status: 'Transient provider failure',
      errorCategory: 'Rate limit active on provider (Circuit breaker open)',
      provider: 'circuit-breaker',
      auditTimestamp: Date.now(),
      notes: `Provider throttled; circuit open for ${(rateLimiter.getCircuitRemainingMs() / 1000).toFixed(1)}s`
    };
  }

  // 5. Query Providers with Pacing and Candidate Validation
  let ambiguousCandidateFound: string | null = null;
  let lastTransientError: string | null = null;
  let lastTransientProvider: string | null = null;

  // --- Provider Tier 1: LRCLIB Exact /api/get ---
  try {
    const acquired = await rateLimiter.acquire();
    if (acquired) {
      const exactUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist || cleanArtist)}`;
      const getRes = await fetch(exactUrl, {
        headers: { 'User-Agent': 'HyperMelo-Audit/1.0 (https://github.com/naro/hypermelo)' },
        signal: AbortSignal.timeout(6000)
      });
      rateLimiter.handleResponse(getRes.status, getRes.headers);

      if (getRes.status === 200) {
        const data: LrclibRecord = await getRes.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          const lines = data.syncedLyrics
            ? lyricsIngestionService.parseLrc(data.syncedLyrics, record.duration || 180)
            : lyricsIngestionService.parsePlainLyrics(data.plainLyrics || '');
          if (lines.length > 0) {
            return {
              status: data.syncedLyrics ? 'Verified synchronized lyrics' : 'Verified plain lyrics',
              provider: 'lrclib_exact',
              lineCount: lines.length,
              sampleSnippet: lines[0]?.text || '',
              auditTimestamp: Date.now()
            };
          }
        }
      } else if (getRes.status === 429 || getRes.status >= 500) {
        lastTransientError = `LRCLIB exact returned HTTP ${getRes.status}`;
        lastTransientProvider = 'lrclib';
      }
    }
  } catch (err: unknown) {
    lastTransientError = err instanceof Error ? err.message : String(err);
    lastTransientProvider = 'lrclib';
  }

  // --- Provider Tier 2: LRCLIB Search /api/search?q={query} ---
  try {
    const acquired = await rateLimiter.acquire();
    if (acquired) {
      const query = `${cleanTitle} ${primaryArtist || cleanArtist}`.trim();
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'HyperMelo-Audit/1.0 (https://github.com/naro/hypermelo)' },
        signal: AbortSignal.timeout(6000)
      });
      rateLimiter.handleResponse(searchRes.status, searchRes.headers);

      if (searchRes.status === 200) {
        const candidates: LrclibRecord[] = await searchRes.json();
        if (Array.isArray(candidates) && candidates.length > 0) {
          const withLyrics = candidates.filter((c) => c.syncedLyrics || c.plainLyrics);
          if (withLyrics.length > 0) {
            // Validate each candidate
            let matchedCandidate: LrclibRecord | null = null;
            for (const cand of withLyrics) {
              const evalRes = isCandidateValidMatch(cleanTitle, cleanArtist, cand.trackName, cand.artistName);
              if (evalRes.isMatch) {
                matchedCandidate = cand;
                break;
              } else {
                ambiguousCandidateFound = `Candidate "${cand.trackName}" by "${cand.artistName}" rejected (score: ${evalRes.score})`;
              }
            }

            if (matchedCandidate) {
              const lines = matchedCandidate.syncedLyrics
                ? lyricsIngestionService.parseLrc(matchedCandidate.syncedLyrics, record.duration || matchedCandidate.duration || 180)
                : lyricsIngestionService.parsePlainLyrics(matchedCandidate.plainLyrics || '');
              if (lines.length > 0) {
                return {
                  status: matchedCandidate.syncedLyrics ? 'Verified synchronized lyrics' : 'Verified plain lyrics',
                  provider: 'lrclib_search',
                  lineCount: lines.length,
                  sampleSnippet: lines[0]?.text || '',
                  auditTimestamp: Date.now()
                };
              }
            }
          }
        }
      } else if (searchRes.status === 429 || searchRes.status >= 500) {
        lastTransientError = `LRCLIB search returned HTTP ${searchRes.status}`;
        lastTransientProvider = 'lrclib';
      }
    }
  } catch (err: unknown) {
    lastTransientError = err instanceof Error ? err.message : String(err);
    lastTransientProvider = 'lrclib';
  }

  // --- Provider Tier 3: JioSaavn Lyrics API ---
  try {
    const acquired = await rateLimiter.acquire();
    if (acquired) {
      const saavnSearchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(`${cleanTitle} ${primaryArtist || cleanArtist}`.trim())}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=5&p=1`;
      const saavnRes = await fetch(saavnSearchUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          cookie: 'DL=english'
        },
        signal: AbortSignal.timeout(5000)
      });
      rateLimiter.handleResponse(saavnRes.status, saavnRes.headers);

      if (saavnRes.status === 200) {
        const data: { results?: Array<{ id: string; title: string; subtitle?: string; more_info?: { has_lyrics?: string | boolean; lyrics_id?: string; singers?: string; music?: string } }> } = await saavnRes.json();
        const results = data.results;
        if (Array.isArray(results) && results.length > 0) {
          const cand = results.find((r) => {
            const hasLyrics = r.more_info?.has_lyrics === 'true' || r.more_info?.has_lyrics === true;
            if (!hasLyrics) return false;
            const candTitle = unescapeHtml(r.title || '');
            const candArtist = unescapeHtml(r.more_info?.singers || r.more_info?.music || r.subtitle || '');
            const evalRes = isCandidateValidMatch(cleanTitle, cleanArtist, candTitle, candArtist);
            if (!evalRes.isMatch && hasLyrics) {
              ambiguousCandidateFound = `JioSaavn candidate "${candTitle}" by "${candArtist}" rejected (score: ${evalRes.score})`;
            }
            return evalRes.isMatch;
          });

          if (cand) {
            const lyricsId = cand.more_info?.lyrics_id || cand.id;
            const lyrUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(lyricsId)}&ctx=web6dot0&api_version=4&_format=json&_marker=0`;
            const lyrRes = await fetch(lyrUrl, {
              headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                cookie: 'DL=english'
              },
              signal: AbortSignal.timeout(5000)
            });
            rateLimiter.handleResponse(lyrRes.status, lyrRes.headers);

            if (lyrRes.status === 200) {
              const lyrData: { lyrics?: string } = await lyrRes.json();
              if (lyrData.lyrics && typeof lyrData.lyrics === 'string') {
                const cleanHtml = unescapeHtml(lyrData.lyrics)
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<[^>]+>/g, '')
                  .trim();
                const lines = lyricsIngestionService.parsePlainLyrics(cleanHtml);
                if (lines.length > 0) {
                  return {
                    status: 'Verified plain lyrics',
                    provider: 'jiosaavn',
                    lineCount: lines.length,
                    sampleSnippet: lines[0]?.text || '',
                    auditTimestamp: Date.now()
                  };
                }
              }
            }
          }
        }
      } else if (saavnRes.status === 429 || saavnRes.status >= 500) {
        lastTransientError = `JioSaavn search returned HTTP ${saavnRes.status}`;
        lastTransientProvider = 'jiosaavn';
      }
    }
  } catch (err: unknown) {
    lastTransientError = err instanceof Error ? err.message : String(err);
    lastTransientProvider = 'jiosaavn';
  }

  // Final Classification for Unresolved Track
  if (lastTransientError) {
    return {
      status: 'Transient provider failure',
      errorCategory: lastTransientError,
      provider: lastTransientProvider || undefined,
      auditTimestamp: Date.now()
    };
  }

  if (ambiguousCandidateFound) {
    return {
      status: 'Ambiguous or mismatched candidate',
      candidateDetails: ambiguousCandidateFound,
      auditTimestamp: Date.now(),
      notes: 'Search candidate rejected by title/artist candidate validator'
    };
  }

  return {
    status: 'Confirmed missing lyrics',
    auditTimestamp: Date.now(),
    notes: 'Providers authoritatively confirmed no matching lyrics available'
  };
}

// ============================================================================
// Main Catalog Audit Engine
// ============================================================================

export async function runCatalogLyricsAudit(options?: Partial<AuditCliOptions>) {
  console.log('================================================================');
  console.log('HYPERMELO CATALOG-WIDE LYRICS & SYNCHRONIZATION RELIABILITY AUDIT');
  console.log('Safe Pacing, Resumable Progress, and 6-Way Honest Classification');
  console.log('================================================================\n');

  // Parse options
  const args = process.argv.slice(2);
  const isDryRun = options?.dryRun ?? args.includes('--dry-run');
  const isReset = options?.reset ?? args.includes('--reset');
  const isResume = options?.resume ?? (!isReset && !args.includes('--no-resume'));
  const isRecheckFailed = options?.recheckFailed ?? (args.includes('--recheck-failed'));
  const isForceRecheck = options?.forceRecheck ?? (args.includes('--force-recheck'));
  const delayMs = options?.delayMs ?? (() => {
    const idx = args.indexOf('--delay');
    return idx !== -1 && args[idx + 1] ? parseInt(args[idx + 1], 10) : 800;
  })();
  const sampleLimit = options?.sampleLimit ?? (() => {
    const sIdx = args.indexOf('--sample');
    if (sIdx !== -1 && args[sIdx + 1]) return parseInt(args[sIdx + 1], 10);
    const lIdx = args.indexOf('--limit');
    if (lIdx !== -1 && args[lIdx + 1]) return parseInt(lIdx + 1, 10);
    return undefined;
  })();

  console.log(`Operating Mode:`);
  console.log(`  - Dry Run:        ${isDryRun ? 'YES (No network calls)' : 'NO (Live network verification)'}`);
  console.log(`  - Resumable:      ${isResume ? 'YES' : 'NO'}`);
  console.log(`  - Recheck Failed: ${isRecheckFailed ? 'YES (Re-auditing transient/unsettled tracks)' : 'NO'}`);
  console.log(`  - Force Recheck:  ${isForceRecheck ? 'YES (Re-auditing all tracks)' : 'NO'}`);
  console.log(`  - Paced Delay:    ${delayMs}ms between requests`);
  if (sampleLimit) {
    console.log(`  - Sample Cap:     ${sampleLimit} tracks`);
  } else {
    console.log(`  - Sample Cap:     Full catalog`);
  }
  console.log('');

  // 1. Discover all unique canonical tracks across catalog surfaces
  console.log('1. Enumerating all catalog discovery surfaces...');
  const catalogMap = new Map<string, AuditRecord>();
  const duplicateSurfacesMap = new Map<string, string[]>();
  const metadataAnomalies: { id: string; title: string; issue: string }[] = [];

  function registerTrack(song: Song, surface: string) {
    if (!song || !song.title) return;
    const key = getCanonicalTrackKey(song);
    let record = catalogMap.get(key);
    if (!record) {
      // Check for metadata anomalies
      if (!song.artist || song.artist.trim() === '' || song.artist.toLowerCase() === 'unknown') {
        metadataAnomalies.push({ id: song.id, title: song.title, issue: 'Missing or unknown artist credit' });
      }
      if (!song.duration || song.duration <= 0) {
        metadataAnomalies.push({ id: song.id, title: song.title, issue: 'Missing or zero duration' });
      }

      record = {
        canonicalKey: key,
        id: song.id,
        title: song.title,
        artist: song.artist || 'Unknown',
        language: song.originalLanguage || (song as any).language || 'en',
        duration: song.duration,
        fullTrackDuration: (song as any).fullTrackDuration,
        surfaces: [],
        status: 'Not checked',
        originalLyrics: song.lyrics
      };
      catalogMap.set(key, record);
    } else if (!record.originalLyrics && song.lyrics) {
      record.originalLyrics = song.lyrics;
    }

    if (!record.surfaces.includes(surface)) {
      record.surfaces.push(surface);
    }

    let dupList = duplicateSurfacesMap.get(key);
    if (!dupList) {
      dupList = [];
      duplicateSurfacesMap.set(key, dupList);
    }
    dupList.push(surface);
  }

  // Curated Catalog surfaces
  for (const s of getAllCuratedSongs()) registerTrack(s as unknown as Song, 'Curated: Discover / Trending');
  // Mood Catalog surfaces
  for (const [moodName, songs] of Object.entries(MOOD_CATALOG)) {
    for (const s of songs) registerTrack(s as unknown as Song, `Mood: ${moodName}`);
  }
  // Baseline Songs & Fixtures
  for (const s of SONGS) registerTrack(s as unknown as Song, 'Catalog: Baseline Songs');
  registerTrack(ANIRUDH_GAALI_VAALUGA as unknown as Song, 'Catalog: Hero Track');
  registerTrack(JOSH_WOODWARD_SHOT_DOWN as unknown as Song, 'Catalog: Alternative Fixture');

  const totalTracks = catalogMap.size;
  console.log(`Discovered ${totalTracks} unique canonical tracks across all surfaces.`);
  console.log(`Metadata anomalies detected: ${metadataAnomalies.length}`);

  // Count multi-surface duplicate appearances
  const multiSurfaceTracks = Array.from(duplicateSurfacesMap.entries()).filter(([_, surfaces]) => surfaces.length > 1);
  console.log(`Duplicate multi-surface appearances: ${multiSurfaceTracks.length} tracks appear on 2+ surfaces.\n`);

  // 2. Load Checkpoint if resuming
  const checkpointPath = path.resolve(process.cwd(), 'scratch/lyrics_catalog_audit_checkpoint.json');
  const checkpointMgr = new CheckpointManager(checkpointPath);

  if (isResume && !isReset && !isForceRecheck) {
    const existingCheckpoint = checkpointMgr.load();
    if (existingCheckpoint) {
      let restoredCount = 0;
      for (const [key, savedRecord] of Object.entries(existingCheckpoint.records)) {
        if (catalogMap.has(key)) {
          const current = catalogMap.get(key)!;
          const origLyr = current.originalLyrics;

          if (isRecheckFailed) {
            // Recheck failed: Only restore solid verified tracks; recheck missing, ambiguous, or transient
            if (
              savedRecord.status === 'Verified synchronized lyrics' ||
              savedRecord.status === 'Verified plain lyrics'
            ) {
              Object.assign(current, savedRecord);
              current.originalLyrics = origLyr;
              restoredCount++;
            }
            continue;
          }

          // Restore verified outcomes
          if (
            savedRecord.status === 'Verified synchronized lyrics' ||
            savedRecord.status === 'Verified plain lyrics' ||
            savedRecord.status === 'Confirmed missing lyrics' ||
            savedRecord.status === 'Ambiguous or mismatched candidate'
          ) {
            Object.assign(current, savedRecord);
            current.originalLyrics = origLyr;
            restoredCount++;
          }
        }
      }
      console.log(`[Checkpoint] Restored ${restoredCount} verified records from checkpoint file.`);
    }
  }

  // 3. Execute Audit with Pacing and Limit Control
  console.log('\n2. Executing safe, paced lyrics catalog audit...');
  const rateLimiter = new SafeRateLimiter(delayMs);
  const records = Array.from(catalogMap.values());
  let processedCount = 0;
  let auditedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // Check if already settled from checkpoint
    const isAlreadySettled =
      rec.status === 'Verified synchronized lyrics' ||
      rec.status === 'Verified plain lyrics' ||
      rec.status === 'Confirmed missing lyrics' ||
      rec.status === 'Ambiguous or mismatched candidate';

    if (isAlreadySettled) {
      processedCount++;
      continue;
    }

    // Check sample limit
    if (sampleLimit && auditedCount >= sampleLimit) {
      rec.status = 'Not checked';
      rec.notes = `Exceeded requested sample limit of ${sampleLimit} tracks`;
      continue;
    }

    // Perform audit
    const result = await auditTrack(rec, rateLimiter, isDryRun);
    Object.assign(rec, result);
    auditedCount++;
    processedCount++;

    // Print progress
    const remaining = records.length - processedCount;
    const estSec = isDryRun ? 0 : Math.round((remaining * delayMs) / 1000);
    process.stdout.write(
      `\r   [Progress] ${processedCount}/${records.length} (${((processedCount / records.length) * 100).toFixed(1)}%) | Track: "${rec.title.slice(0, 20)}" | Status: ${rec.status.slice(0, 15)}... | Est remaining: ~${estSec}s  `
    );

    // Save checkpoint incrementally every 10 tracks or on finish
    if (processedCount % 10 === 0 || processedCount === records.length) {
      checkpointMgr.save(catalogMap, totalTracks);
    }
  }

  console.log('\n   Audit processing phase completed.\n');
  checkpointMgr.save(catalogMap, totalTracks);

  // 4. Calculate Aggregate Metrics
  let syncedCount = 0;
  let plainCount = 0;
  let missingCount = 0;
  let transientCount = 0;
  let ambiguousCount = 0;
  let notCheckedCount = 0;

  const providerCounts: Record<string, number> = {};
  const providerTransientCounts: Record<string, number> = {};
  const langStats: Record<string, { total: number; synced: number; plain: number; missing: number; transient: number; ambiguous: number; notChecked: number }> = {};

  const manualReviewTracks: { id: string; title: string; artist: string; reason: string }[] = [];

  for (const rec of records) {
    const st = rec.status;
    if (st === 'Verified synchronized lyrics') syncedCount++;
    else if (st === 'Verified plain lyrics') plainCount++;
    else if (st === 'Confirmed missing lyrics') missingCount++;
    else if (st === 'Transient provider failure') transientCount++;
    else if (st === 'Ambiguous or mismatched candidate') {
      ambiguousCount++;
      manualReviewTracks.push({ id: rec.id, title: rec.title, artist: rec.artist, reason: rec.candidateDetails || 'Search candidate rejected' });
    } else notCheckedCount++;

    if ((st === 'Verified synchronized lyrics' || st === 'Verified plain lyrics') && rec.provider) {
      providerCounts[rec.provider] = (providerCounts[rec.provider] || 0) + 1;
    } else if (st === 'Transient provider failure') {
      const p = rec.provider || (rec.errorCategory?.includes('LRCLIB') ? 'lrclib' : rec.errorCategory?.includes('JioSaavn') ? 'jiosaavn' : 'network/circuit');
      providerTransientCounts[p] = (providerTransientCounts[p] || 0) + 1;
    }

    const lang = (rec.language || 'other').toLowerCase();
    const lKey = ['en', 'hi', 'te', 'ta', 'ml', 'pa'].includes(lang) ? lang : 'other';
    if (!langStats[lKey]) {
      langStats[lKey] = { total: 0, synced: 0, plain: 0, missing: 0, transient: 0, ambiguous: 0, notChecked: 0 };
    }
    langStats[lKey].total++;
    if (st === 'Verified synchronized lyrics') langStats[lKey].synced++;
    else if (st === 'Verified plain lyrics') langStats[lKey].plain++;
    else if (st === 'Confirmed missing lyrics') langStats[lKey].missing++;
    else if (st === 'Transient provider failure') langStats[lKey].transient++;
    else if (st === 'Ambiguous or mismatched candidate') langStats[lKey].ambiguous++;
    else langStats[lKey].notChecked++;
  }

  // Calculate coverage under clearly defined denominators
  const auditedDenominator = totalTracks - notCheckedCount;
  const settledDenominator = syncedCount + plainCount + missingCount;

  const syncedPctCatalog = ((syncedCount / totalTracks) * 100).toFixed(1);
  const anyLyricsPctCatalog = (((syncedCount + plainCount) / totalTracks) * 100).toFixed(1);

  const syncedPctAudited = auditedDenominator > 0 ? ((syncedCount / auditedDenominator) * 100).toFixed(1) : '0.0';
  const anyLyricsPctAudited = auditedDenominator > 0 ? (((syncedCount + plainCount) / auditedDenominator) * 100).toFixed(1) : '0.0';

  const syncedPctSettled = settledDenominator > 0 ? ((syncedCount / settledDenominator) * 100).toFixed(1) : '0.0';

  // 5. Console Reporting
  console.log('================================================================');
  console.log('CATALOG AUDIT COVERAGE & STATUS SUMMARY');
  console.log('================================================================');
  console.log(`Total Unique Discovered Tracks:       ${totalTracks}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`1. Verified Synchronized Lyrics:      ${syncedCount.toString().padStart(4)} (${syncedPctCatalog}% of catalog)`);
  console.log(`2. Verified Plain Lyrics:             ${plainCount.toString().padStart(4)} (${((plainCount / totalTracks) * 100).toFixed(1)}% of catalog)`);
  console.log(`3. Confirmed Missing Lyrics:          ${missingCount.toString().padStart(4)} (${((missingCount / totalTracks) * 100).toFixed(1)}% of catalog)`);
  console.log(`4. Transient Provider Failures:       ${transientCount.toString().padStart(4)} (${((transientCount / totalTracks) * 100).toFixed(1)}% of catalog)`);
  console.log(`5. Ambiguous / Mismatched Candidates: ${ambiguousCount.toString().padStart(4)} (${((ambiguousCount / totalTracks) * 100).toFixed(1)}% of catalog)`);
  console.log(`6. Not Checked:                       ${notCheckedCount.toString().padStart(4)} (${((notCheckedCount / totalTracks) * 100).toFixed(1)}% of catalog)`);
  console.log(`----------------------------------------------------------------`);
  console.log(`Total With Any Lyrics (Synced+Plain): ${syncedCount + plainCount} (${anyLyricsPctCatalog}% of catalog)`);
  console.log('');

  console.log('================================================================');
  console.log('EXPLICIT COVERAGE DENOMINATORS');
  console.log('================================================================');
  console.log(`Denominator A (Full Catalog, N = ${totalTracks}):`);
  console.log(`  - Synchronized Lyrics Coverage:    ${syncedPctCatalog}% (${syncedCount}/${totalTracks})`);
  console.log(`  - Any Lyrics Coverage (Total):     ${anyLyricsPctCatalog}% (${syncedCount + plainCount}/${totalTracks})`);
  console.log(`Denominator B (Audited Tracks, N = ${auditedDenominator}):`);
  console.log(`  - Synchronized Lyrics Coverage:    ${syncedPctAudited}% (${syncedCount}/${auditedDenominator})`);
  console.log(`  - Any Lyrics Coverage:             ${anyLyricsPctAudited}% (${syncedCount + plainCount}/${auditedDenominator})`);
  console.log(`Denominator C (Decisively Settled Tracks, N = ${settledDenominator}):`);
  console.log(`  - Synchronized Lyrics Coverage:    ${syncedPctSettled}% (${syncedCount}/${settledDenominator})`);
  console.log('');

  console.log('================================================================');
  console.log('PER-LANGUAGE COVERAGE BREAKDOWN');
  console.log('================================================================');
  console.log('Lang  | Total | Synced | Plain | Missing | Transient | Ambiguous | Not Checked | Synced % (Audited)');
  console.log('------+-------+--------+-------+---------+-----------+-----------+-------------+-------------------');
  for (const [lang, s] of Object.entries(langStats)) {
    const aud = s.total - s.notChecked;
    const pct = aud > 0 ? ((s.synced / aud) * 100).toFixed(1) : '0.0';
    console.log(
      `${lang.padEnd(5)} | ${s.total.toString().padEnd(5)} | ${s.synced.toString().padEnd(6)} | ${s.plain.toString().padEnd(5)} | ${s.missing.toString().padEnd(7)} | ${s.transient.toString().padEnd(9)} | ${s.ambiguous.toString().padEnd(9)} | ${s.notChecked.toString().padEnd(11)} | ${pct}%`
    );
  }
  console.log('');

  console.log('================================================================');
  console.log('PROVIDER RESOLUTION & FAILURE SUMMARY');
  console.log('================================================================');
  console.log('Provider Successes:');
  for (const [prov, count] of Object.entries(providerCounts)) {
    console.log(`  - ${prov}: ${count} tracks resolved`);
  }
  if (Object.keys(providerCounts).length === 0) {
    console.log(`  - No provider requests completed (Dry run or all un-cached).`);
  }
  console.log('Provider Transient Failures:');
  for (const [prov, count] of Object.entries(providerTransientCounts)) {
    console.log(`  - ${prov}: ${count} transient failures`);
  }
  if (Object.keys(providerTransientCounts).length === 0) {
    console.log(`  - 0 transient failures detected.`);
  }
  console.log('');

  if (manualReviewTracks.length > 0) {
    console.log('================================================================');
    console.log(`TRACKS REQUIRING MANUAL REVIEW (${manualReviewTracks.length} Tracks)`);
    console.log('================================================================');
    for (const t of manualReviewTracks.slice(0, 10)) {
      console.log(`- [${t.id}] "${t.title}" by ${t.artist}: ${t.reason}`);
    }
    if (manualReviewTracks.length > 10) {
      console.log(`  ... and ${manualReviewTracks.length - 10} more tracks in report file.`);
    }
    console.log('');
  }

  // 6. Write Markdown Report File
  const reportMdPath = path.resolve(process.cwd(), 'scratch/lyrics_catalog_audit_report.md');
  const reportJsonPath = path.resolve(process.cwd(), 'scratch/lyrics_catalog_audit_report.json');

  const reportMd = `# HyperMelo Lyrics Catalog Audit Report

Generated: ${new Date().toISOString()}  
Operating Mode: ${isDryRun ? 'Dry-Run (Offline)' : 'Live Network Audit'} | Resumed: ${isResume ? 'Yes' : 'No'}

## 1. Executive Summary & Headline Metrics

| Metric | Count | % of Catalog (N=${totalTracks}) | % of Audited (N=${auditedDenominator}) |
|---|:---:|:---:|:---:|
| **Verified Synchronized Lyrics** | **${syncedCount}** | **${syncedPctCatalog}%** | **${syncedPctAudited}%** |
| **Verified Plain Lyrics** | **${plainCount}** | **${((plainCount / totalTracks) * 100).toFixed(1)}%** | **${auditedDenominator > 0 ? ((plainCount / auditedDenominator) * 100).toFixed(1) : '0.0'}%** |
| **Confirmed Missing Lyrics** | **${missingCount}** | **${((missingCount / totalTracks) * 100).toFixed(1)}%** | **${auditedDenominator > 0 ? ((missingCount / auditedDenominator) * 100).toFixed(1) : '0.0'}%** |
| **Transient Provider Failures** | **${transientCount}** | **${((transientCount / totalTracks) * 100).toFixed(1)}%** | **${auditedDenominator > 0 ? ((transientCount / auditedDenominator) * 100).toFixed(1) : '0.0'}%** |
| **Ambiguous / Mismatched Candidates** | **${ambiguousCount}** | **${((ambiguousCount / totalTracks) * 100).toFixed(1)}%** | **${auditedDenominator > 0 ? ((ambiguousCount / auditedDenominator) * 100).toFixed(1) : '0.0'}%** |
| **Not Checked** | **${notCheckedCount}** | **${((notCheckedCount / totalTracks) * 100).toFixed(1)}%** | N/A |
| **Total With Any Lyrics** | **${syncedCount + plainCount}** | **${anyLyricsPctCatalog}%** | **${anyLyricsPctAudited}%** |

## 2. Definitive Coverage Denominators

- **Denominator A (Full Catalog, N = ${totalTracks})**:
  - Synchronized Lyrics Coverage: **${syncedPctCatalog}%** (${syncedCount}/${totalTracks})
  - Total Lyrics Coverage: **${anyLyricsPctCatalog}%** (${syncedCount + plainCount}/${totalTracks})
- **Denominator B (Audited Tracks, N = ${auditedDenominator})**:
  - Synchronized Lyrics Coverage: **${syncedPctAudited}%** (${syncedCount}/${auditedDenominator})
  - Total Lyrics Coverage: **${anyLyricsPctAudited}%** (${syncedCount + plainCount}/${auditedDenominator})
- **Denominator C (Decisively Settled Tracks, N = ${settledDenominator})**:
  - Synchronized Lyrics Coverage: **${syncedPctSettled}%** (${syncedCount}/${settledDenominator})

## 3. Language Breakdown

| Language | Total Tracks | Synced | Plain | Missing | Transient | Ambiguous | Not Checked | Synced % |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
${Object.entries(langStats)
  .map(([lang, s]) => {
    const aud = s.total - s.notChecked;
    const pct = aud > 0 ? ((s.synced / aud) * 100).toFixed(1) : '0.0';
    return `| ${lang.toUpperCase()} | ${s.total} | ${s.synced} | ${s.plain} | ${s.missing} | ${s.transient} | ${s.ambiguous} | ${s.notChecked} | ${pct}% |`;
  })
  .join('\n')}

## 4. Provider Attribution & Reliability

### Successful Resolutions
${Object.keys(providerCounts).length > 0
  ? Object.entries(providerCounts).map(([prov, count]) => `- **${prov}**: ${count} tracks resolved`).join('\n')
  : '- No provider successes recorded.'}

### Transient Failures
${Object.keys(providerTransientCounts).length > 0
  ? Object.entries(providerTransientCounts).map(([prov, count]) => `- **${prov}**: ${count} transient failures`).join('\n')
  : '- 0 transient failures recorded.'}

## 5. Duplicate Catalog Appearances & Metadata Anomalies

- **Multi-Surface Tracks**: ${multiSurfaceTracks.length} songs appear across 2 or more mood/curated playlists.
- **Metadata Anomalies**: ${metadataAnomalies.length} tracks with missing artist or zero duration.

${metadataAnomalies.length > 0 ? '### Anomalous Tracks\n' + metadataAnomalies.map((a) => `- [${a.id}] "${a.title}": ${a.issue}`).join('\n') : ''}

## 6. Tracks Requiring Manual Review

${manualReviewTracks.length > 0 ? manualReviewTracks.map((t) => `- **[${t.id}] "${t.title}"** by *${t.artist}*: ${t.reason}`).join('\n') : '- No tracks require manual review.'}
`;

  fs.writeFileSync(reportMdPath, reportMd, 'utf-8');
  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify(
      {
        totalTracks,
        syncedCount,
        plainCount,
        missingCount,
        transientCount,
        ambiguousCount,
        notCheckedCount,
        langStats,
        providerCounts,
        providerTransientCounts,
        metadataAnomalies,
        manualReviewTracks
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Saved audit checkpoint to: file:///${checkpointPath.replace(/\\/g, '/')}`);
  console.log(`Saved markdown audit report to: file:///${reportMdPath.replace(/\\/g, '/')}`);
  console.log(`Saved JSON audit report to: file:///${reportJsonPath.replace(/\\/g, '/')}`);

  return {
    totalTracks,
    syncedCount,
    plainCount,
    missingCount,
    transientCount,
    ambiguousCount,
    notCheckedCount,
    langStats,
    providerCounts,
    providerTransientCounts
  };
}

// Execute when invoked directly
if (import.meta.url.startsWith('file:') && process.argv[1] && process.argv[1].includes('audit_full_catalog_lyrics')) {
  runCatalogLyricsAudit().catch((err) => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
  });
}
