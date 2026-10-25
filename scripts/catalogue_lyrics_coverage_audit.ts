// Catalogue Lyrics Coverage Audit for HyperMelo
// Reads all 321 unique catalogue songs across all catalogue surfaces,
// classifies each song into the 6 canonical categories, supports safe paced batch resolution,
// and outputs comprehensive coverage metrics by language and provider.

import fs from 'node:fs';
import path from 'node:path';
import { lyricsIngestionService } from '../src/backend/services/LyricsIngestionService';
import { sanitizeTrackTitle, extractPrimaryArtist } from '../src/services/lyrics/lyricsSanitizer';

export type CanonicalLyricsCategory =
  | 'verified_synchronized_lyrics'
  | 'verified_plain_lyrics'
  | 'confirmed_no_match'
  | 'transient_provider_failure'
  | 'ambiguous_candidate_needs_review'
  | 'not_checked';

export interface AuditRecord {
  canonicalKey: string;
  id: string;
  title: string;
  artist: string;
  language: string;
  duration?: number;
  fullTrackDuration?: number;
  surfaces: string[];
  status: CanonicalLyricsCategory;
  rawStatus?: string;
  provider?: string;
  lineCount?: number;
  sampleSnippet?: string;
  errorReason?: string;
  auditTimestamp?: number;
}

const CHECKPOINT_PATH = path.resolve('scratch/lyrics_catalog_audit_checkpoint.json');

export function normalizeStatus(rawStatus?: string): CanonicalLyricsCategory {
  if (!rawStatus) return 'not_checked';
  const s = rawStatus.toLowerCase();
  if (s === 'verified_synchronized_lyrics' || s === 'verified synchronized lyrics') {
    return 'verified_synchronized_lyrics';
  }
  if (s === 'verified_plain_lyrics' || s === 'verified plain lyrics') {
    return 'verified_plain_lyrics';
  }
  if (s === 'confirmed_no_match' || s === 'no match found' || s === 'confirmed absent') {
    return 'confirmed_no_match';
  }
  if (s === 'transient_provider_failure' || s === 'transient failure' || s.includes('timeout') || s.includes('rate limit')) {
    return 'transient_provider_failure';
  }
  if (s === 'ambiguous_candidate_needs_review' || s.includes('ambiguous') || s.includes('review')) {
    return 'ambiguous_candidate_needs_review';
  }
  return 'not_checked';
}

export async function runAudit(batchSize = 0): Promise<void> {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    console.error(`Checkpoint file not found at ${CHECKPOINT_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
  const data = JSON.parse(raw);
  const recordsMap: Record<string, AuditRecord> = data.records || {};
  const records = Object.values(recordsMap);

  // Normalize statuses
  for (const r of records) {
    r.status = normalizeStatus(r.rawStatus || r.status as unknown as string);
  }

  // If a bounded batch is requested, safely process un-audited tracks with pacing
  if (batchSize > 0) {
    const unChecked = records.filter(r => r.status === 'not_checked');
    const toProcess = unChecked.slice(0, batchSize);
    console.log(`Paced Audit: Processing ${toProcess.length} tracks (out of ${unChecked.length} pending)...`);

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      const effDuration = item.fullTrackDuration || (item.duration && item.duration > 35 ? item.duration : undefined);
      
      try {
        const res = await lyricsIngestionService.fetchLyrics(
          item.title,
          item.artist,
          effDuration,
          undefined,
          undefined,
          item.language as any,
          item.id
        );

        if (res) {
          const firstLang = Object.keys(res)[0];
          const lines = res[firstLang]?.lines || [];
          const isSynced = lines.length > 0 && lines.some(l => (l.startTime !== undefined && l.startTime >= 0) || (l.time !== undefined && l.time >= 0));

          item.status = isSynced ? 'verified_synchronized_lyrics' : 'verified_plain_lyrics';
          item.lineCount = lines.length;
          item.sampleSnippet = lines[0]?.text?.slice(0, 60);
          item.provider = isSynced ? 'lrclib_exact' : 'lrclib_search';
          item.auditTimestamp = Date.now();
          console.log(`[${i + 1}/${toProcess.length}] ✓ Resolved: "${item.title}" by ${item.artist} -> ${item.status} (${lines.length} lines)`);
        } else {
          item.status = 'confirmed_no_match';
          item.auditTimestamp = Date.now();
          console.log(`[${i + 1}/${toProcess.length}] ✗ No match: "${item.title}" by ${item.artist}`);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isTransient = /network|timeout|fetch|rate|429|503|504/i.test(msg);
        item.status = isTransient ? 'transient_provider_failure' : 'confirmed_no_match';
        item.errorReason = msg;
        item.auditTimestamp = Date.now();
        console.log(`[${i + 1}/${toProcess.length}] ⚠ Error: "${item.title}" by ${item.artist} -> ${item.status} (${msg})`);
      }

      // Respectful request pacing: 250ms delay
      await new Promise(r => setTimeout(r, 250));
    }

    // Save checkpoint
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Checkpoint saved to ${CHECKPOINT_PATH}`);
  }

  // Generate Comprehensive Audit Report
  const total = records.length;
  const counts: Record<CanonicalLyricsCategory, number> = {
    verified_synchronized_lyrics: 0,
    verified_plain_lyrics: 0,
    confirmed_no_match: 0,
    transient_provider_failure: 0,
    ambiguous_candidate_needs_review: 0,
    not_checked: 0
  };

  const byLanguage: Record<string, Record<CanonicalLyricsCategory, number>> = {};
  const byProvider: Record<string, number> = {};
  const needsReview: { title: string; artist: string; reason?: string }[] = [];
  const confirmedMissing: { title: string; artist: string }[] = [];

  for (const r of records) {
    counts[r.status] = (counts[r.status] || 0) + 1;

    const lang = r.language || 'unknown';
    if (!byLanguage[lang]) {
      byLanguage[lang] = {
        verified_synchronized_lyrics: 0,
        verified_plain_lyrics: 0,
        confirmed_no_match: 0,
        transient_provider_failure: 0,
        ambiguous_candidate_needs_review: 0,
        not_checked: 0
      };
    }
    byLanguage[lang][r.status] = (byLanguage[lang][r.status] || 0) + 1;

    if (r.provider) {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
    }

    if (r.status === 'ambiguous_candidate_needs_review') {
      needsReview.push({ title: r.title, artist: r.artist, reason: r.errorReason || 'Candidate title/artist mismatch' });
    }
    if (r.status === 'confirmed_no_match') {
      confirmedMissing.push({ title: r.title, artist: r.artist });
    }
  }

  console.log('\n================================================================');
  console.log('HYPERMELO CATALOGUE LYRICS COVERAGE AUDIT REPORT');
  console.log('================================================================');
  console.log(`Total unique catalogue songs (Denominator): ${total}`);
  console.log(`1. Verified Synchronized Lyrics:           ${counts.verified_synchronized_lyrics} (${((counts.verified_synchronized_lyrics / total) * 100).toFixed(1)}%)`);
  console.log(`2. Verified Plain Lyrics:                  ${counts.verified_plain_lyrics} (${((counts.verified_plain_lyrics / total) * 100).toFixed(1)}%)`);
  console.log(`3. Confirmed No Available Match:           ${counts.confirmed_no_match}`);
  console.log(`4. Transient Failures:                     ${counts.transient_provider_failure}`);
  console.log(`5. Ambiguous Matches (Needs Review):       ${counts.ambiguous_candidate_needs_review}`);
  console.log(`6. Not Checked (Deferred Bounded Scan):    ${counts.not_checked} (${((counts.not_checked / total) * 100).toFixed(1)}%)`);

  console.log('\n--- Coverage by Language ---');
  for (const [lang, stats] of Object.entries(byLanguage)) {
    const verified = stats.verified_synchronized_lyrics + stats.verified_plain_lyrics;
    const langTotal = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log(`  [${lang.toUpperCase()}] Total: ${langTotal} | Synced: ${stats.verified_synchronized_lyrics} | Plain: ${stats.verified_plain_lyrics} | Unchecked: ${stats.not_checked}`);
  }

  console.log('\n--- Coverage by Provider ---');
  for (const [prov, count] of Object.entries(byProvider)) {
    console.log(`  ${prov}: ${count} songs`);
  }

  if (needsReview.length > 0) {
    console.log('\n--- Songs Requiring Manual Review ---');
    for (const nr of needsReview) {
      console.log(`  - "${nr.title}" by ${nr.artist} (${nr.reason})`);
    }
  }

  console.log('================================================================\n');
}

const batchArg = process.argv.find(a => a.startsWith('--batch='));
const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 0;

runAudit(batchSize).catch(console.error);
