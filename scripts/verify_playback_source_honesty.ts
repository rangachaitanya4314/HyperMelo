// Playback Source Honesty Acceptance Verification
// Tests:
// 1. Channa Mereya (genuine Apple preview, 30s, preview label, no synthetic WAV)
// 2. Hangova (genuine Apple preview, 30s, preview label)
// 3. Midnight Drive (dev-fixture, fullLengthAvailable: false, clearly tagged)
// 4. Codebase scan confirming zero runtime usage of /audio/channa-mereya-full.wav

import { appleMusicCatalogProvider } from '../src/services/providers/AppleMusicCatalogProvider';
import { naroCatalogProvider } from '../src/services/providers/NaroCatalogProvider';
import { musicCatalogService } from '../src/services/providers/musicCatalogService';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('====================================================');
  console.log('PLAYBACK SOURCE HONESTY ACCEPTANCE TEST');
  console.log('====================================================\n');

  // Test 1: Channa Mereya
  console.log('[Test 1] Testing "Channa Mereya" Playback Source Honesty...');
  const channaResults = await appleMusicCatalogProvider.search('Channa Mereya', { limit: 5 });
  if (!channaResults.length) {
    throw new Error('Channa Mereya not found in Apple Music catalog');
  }
  const channaResult = channaResults[0];
  console.log(`  Title: ${channaResult.title}`);
  console.log(`  Artist: ${channaResult.artist}`);
  console.log(`  Stream URL: ${channaResult.streamUrl}`);
  console.log(`  PlaybackType: ${channaResult.playbackType}`);
  console.log(`  PlaybackSourceType: ${channaResult.playbackSourceType}`);
  console.log(`  FullLengthAvailable: ${channaResult.fullLengthAvailable}`);

  if (!channaResult.streamUrl?.includes('apple.com') && !channaResult.streamUrl?.includes('itunes.apple.com')) {
    throw new Error(`Channa Mereya stream URL is not an official Apple preview: ${channaResult.streamUrl}`);
  }
  if (channaResult.fullLengthAvailable !== false) {
    throw new Error('Channa Mereya preview must have fullLengthAvailable: false');
  }

  const channaNorm = await appleMusicCatalogProvider.normalizeSong(channaResult);
  console.log(`  Playable Duration: ${channaNorm.duration}s`);
  console.log(`  isStreamPreview: ${channaNorm.isStreamPreview}`);
  if (channaNorm.duration > 35) {
    throw new Error(`Expected ~30s preview duration, got ${channaNorm.duration}s`);
  }
  if (channaNorm.playbackSource?.streamUrl?.includes('channa-mereya-full.wav')) {
    throw new Error('FATAL: Channa Mereya normalized song still references channa-mereya-full.wav!');
  }

  const channaHead = await fetch(channaNorm.playbackSource!.streamUrl, { method: 'HEAD' });
  console.log(`  Audio Preview HTTP status: ${channaHead.status} (${channaHead.headers.get('content-type')})`);
  if (channaHead.status !== 200) {
    throw new Error(`Channa Mereya audio preview returned HTTP ${channaHead.status}`);
  }
  console.log('  -> PASS: Channa Mereya uses genuine Apple preview (~30s, official CDN).\n');

  // Test 2: Hangova
  console.log('[Test 2] Testing "Hangova" Playback Source Honesty...');
  const hangovaResults = await appleMusicCatalogProvider.search('Hangova', { limit: 5 });
  if (!hangovaResults.length) {
    throw new Error('Hangova not found in Apple Music catalog');
  }
  const hangovaResult = hangovaResults[0];
  console.log(`  Title: ${hangovaResult.title}`);
  console.log(`  Artist: ${hangovaResult.artist}`);
  console.log(`  Stream URL: ${hangovaResult.streamUrl}`);
  console.log(`  PlaybackType: ${hangovaResult.playbackType}`);
  console.log(`  PlaybackSourceType: ${hangovaResult.playbackSourceType}`);
  console.log(`  FullLengthAvailable: ${hangovaResult.fullLengthAvailable}`);

  if (!hangovaResult.streamUrl?.includes('apple.com') && !hangovaResult.streamUrl?.includes('itunes.apple.com')) {
    throw new Error(`Hangova stream URL is not an official Apple preview: ${hangovaResult.streamUrl}`);
  }
  if (hangovaResult.fullLengthAvailable !== false) {
    throw new Error('Hangova preview must have fullLengthAvailable: false');
  }

  const hangovaNorm = await appleMusicCatalogProvider.normalizeSong(hangovaResult);
  console.log(`  Playable Duration: ${hangovaNorm.duration}s`);
  console.log(`  isStreamPreview: ${hangovaNorm.isStreamPreview}`);
  if (hangovaNorm.duration > 35) {
    throw new Error(`Expected ~30s preview duration for Hangova, got ${hangovaNorm.duration}s`);
  }

  const hangovaHead = await fetch(hangovaNorm.playbackSource!.streamUrl, { method: 'HEAD' });
  console.log(`  Audio Preview HTTP status: ${hangovaHead.status} (${hangovaHead.headers.get('content-type')})`);
  if (hangovaHead.status !== 200) {
    throw new Error(`Hangova audio preview returned HTTP ${hangovaHead.status}`);
  }
  console.log('  -> PASS: Hangova uses genuine Apple preview (~30s, official CDN).\n');

  // Test 3: Midnight Drive
  console.log('[Test 3] Testing "Midnight Drive" Dev Fixture Status...');
  const midnightSong = await naroCatalogProvider.getTrack('midnight-drive');
  if (!midnightSong) {
    throw new Error('Midnight Drive not found in NaroCatalogProvider');
  }
  console.log(`  Title: ${midnightSong.title}`);
  console.log(`  Artist: ${midnightSong.artist}`);
  console.log(`  Stream URL: ${midnightSong.playbackSource?.streamUrl}`);
  console.log(`  PlaybackSourceType: ${midnightSong.playbackSourceType}`);
  console.log(`  FullLengthAvailable: ${midnightSong.fullLengthAvailable}`);

  if (midnightSong.playbackSourceType !== 'dev-fixture') {
    throw new Error(`Expected playbackSourceType 'dev-fixture', got '${midnightSong.playbackSourceType}'`);
  }
  if (midnightSong.fullLengthAvailable !== false) {
    throw new Error('Midnight Drive dev-fixture must have fullLengthAvailable: false (not a real full song)');
  }
  if (midnightSong.playbackSource?.streamUrl !== '/audio/midnight-drive.wav') {
    throw new Error(`Expected streamUrl '/audio/midnight-drive.wav', got '${midnightSong.playbackSource?.streamUrl}'`);
  }
  console.log('  -> PASS: Midnight Drive is clearly marked as dev-fixture and not presented as a real full commercial song.\n');

  // Test 4: Deduplication priority
  console.log('[Test 4] Testing Deduplication Priority (Commercial tracks vs Dev Fixture)...');
  const deduplicated = musicCatalogService.deduplicateResults([
    {
      provider: 'naro',
      providerTrackId: 'channa-dev',
      title: 'Channa Mereya',
      artist: 'Dev Fixture Artist',
      album: 'Test Album',
      duration: 289,
      streamUrl: '/audio/channa-mereya-full.wav',
      playbackAvailability: true,
      playbackType: 'full',
      playbackSourceType: 'dev-fixture',
      fullLengthAvailable: false,
      previewAvailable: false,
      karaokeAvailability: false,
      lyricsAvailability: false,
      lyricsSyncAvailability: false
    },
    channaResult
  ]);
  if (deduplicated.length !== 1) {
    throw new Error(`Expected 1 deduplicated result, got ${deduplicated.length}`);
  }
  if (deduplicated[0].playbackSourceType === 'dev-fixture') {
    throw new Error('Deduplication failed: dev fixture took precedence over genuine commercial preview!');
  }
  console.log(`  Canonical result provider: ${deduplicated[0].provider}`);
  console.log(`  Canonical stream URL: ${deduplicated[0].streamUrl}`);
  console.log('  -> PASS: Commercial provider always takes precedence over dev fixtures.\n');

  // Test 5: Verify no references to /audio/channa-mereya-full.wav in src/
  console.log('[Test 5] Scanning src/ for any references to channa-mereya-full.wav...');
  function scanDir(dir: string): string[] {
    const found: string[] = [];
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, file.name);
      if (file.isDirectory()) {
        found.push(...scanDir(full));
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
        const content = fs.readFileSync(full, 'utf-8');
        if (content.includes('channa-mereya-full.wav')) {
          found.push(full);
        }
      }
    }
    return found;
  }

  const srcDir = path.resolve(process.cwd(), 'src');
  const violations = scanDir(srcDir);
  if (violations.length > 0) {
    throw new Error(`Found references to channa-mereya-full.wav in: ${violations.join(', ')}`);
  }
  console.log('  Zero occurrences found in src/.');
  console.log('  -> PASS: Synthetic WAV fixture is completely eliminated from active application code.\n');

  console.log('====================================================');
  console.log('ALL PLAYBACK SOURCE HONESTY TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
