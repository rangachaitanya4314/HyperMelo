// Automated Verification Script for Verified Full-Length Karaoke Reference Track
// Track: "Shot Down" by Josh Woodward (Album: The Beautiful Machine)
// License: CC BY 3.0 US

import * as fs from 'fs';
import * as path from 'path';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import { capabilityService } from '../src/services/capability/capabilityService';
import { naroCatalogProvider } from '../src/services/providers/NaroCatalogProvider';
import { appleMusicCatalogProvider } from '../src/services/providers/AppleMusicCatalogProvider';
import { playbackService } from '../src/services/audio/playbackService';

async function runVerification() {
  console.log('====================================================');
  console.log('NARO REFERENCE TRACK INTEGRATION VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(message);
    }
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  }

  // 1. Audio Asset Files Existence on Disk
  console.log('[Check 1] Audio Asset Local Hosting...');
  const vocalPath = path.resolve(process.cwd(), 'public/audio/josh-woodward-shot-down-vocal.mp3');
  const novoxPath = path.resolve(process.cwd(), 'public/audio/josh-woodward-shot-down-novox.mp3');

  assert(fs.existsSync(vocalPath), `Vocal audio asset exists on disk (${vocalPath})`);
  assert(fs.existsSync(novoxPath), `Instrumental/NoVox audio asset exists on disk (${novoxPath})`);

  const vocalStat = fs.statSync(vocalPath);
  const novoxStat = fs.statSync(novoxPath);
  assert(vocalStat.size > 5_000_000, `Vocal MP3 is genuine full-length file (${(vocalStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  assert(novoxStat.size > 5_000_000, `Instrumental MP3 is genuine full-length file (${(novoxStat.size / (1024 * 1024)).toFixed(2)} MB)`);

  // 2. Track Metadata & Identification
  console.log('\n[Check 2] Catalog Entry & Metadata...');
  const song = JOSH_WOODWARD_SHOT_DOWN;
  assert(song.title === 'Shot Down', `Title is "Shot Down"`);
  assert(song.artist === 'Josh Woodward', `Artist is "Josh Woodward"`);
  assert(song.album === 'The Beautiful Machine', `Album is "The Beautiful Machine"`);
  assert(song.duration === 255, `Duration is full-length 255s (~4m 15s)`);
  assert(song.fullTrackDuration === 255, `fullTrackDuration is 255s`);
  assert(song.isStreamPreview === false, `isStreamPreview is strictly false`);
  assert(song.fullLengthAvailable === true, `fullLengthAvailable is strictly true`);
  assert(song.previewAvailable === false, `previewAvailable is false`);
  assert(song.playbackSourceType === 'open-license', `playbackSourceType is 'open-license'`);
  assert(song.karaokeSource?.type === 'dedicated-instrumental', `karaokeSourceType is 'dedicated-instrumental'`);
  assert(song.karaokeSource?.streamUrl === '/audio/josh-woodward-shot-down-novox.mp3', `Karaoke backing URL points to dedicated NoVox MP3`);
  assert(song.playbackSource?.streamUrl === '/audio/josh-woodward-shot-down-vocal.mp3', `Normal playback URL points to vocal master MP3`);

  // 3. Attribution Metadata
  console.log('\n[Check 3] Attribution Transparency...');
  assert(!!song.attribution, `Attribution block exists on track`);
  assert(song.attribution?.license.includes('CC BY 3.0'), `License is Creative Commons CC BY 3.0 US (${song.attribution?.license})`);
  assert(song.attribution?.source.includes('Free Music Archive') && song.attribution?.source.includes('Wikimedia Commons'), `Source identifies FMA / Wikimedia Commons`);
  assert(song.attribution?.note?.includes('Not NARO-owned') || song.attribution?.note?.includes('reference demo track'), `Does NOT claim to be NARO-owned music`);

  // 4. Capability Evaluation
  console.log('\n[Check 4] Capability Service Evaluation...');
  const capabilities = capabilityService.evaluate(song);
  console.log('  Evaluated capabilities:', JSON.stringify(capabilities, null, 2));

  assert(capabilities.playback === 'FULL_LENGTH', `playbackCapability is FULL_LENGTH (got ${capabilities.playback})`);
  assert(capabilities.karaoke === 'KARAOKE_READY', `karaokeCapability is KARAOKE_READY (got ${capabilities.karaoke})`);
  assert(capabilities.isDevFixture === false, `isDevFixture is strictly false`);
  assert(capabilities.playback !== 'PREVIEW', `Does NOT have PREVIEW capability`);
  assert(capabilities.playback !== 'UNAVAILABLE', `Does NOT have UNAVAILABLE capability`);

  // 5. NARO Catalog Provider Search & Retrieval
  console.log('\n[Check 5] NaroCatalogProvider Retrieval...');
  const searchResults = await naroCatalogProvider.search('Shot Down');
  assert(searchResults.length > 0, `NaroCatalogProvider finds "Shot Down"`);
  const foundResult = searchResults.find(r => r.title === 'Shot Down');
  assert(!!foundResult, `Found "Shot Down" in search results`);
  assert(foundResult?.fullLengthAvailable === true, `Search result has fullLengthAvailable: true`);
  assert(foundResult?.playbackSourceType === 'open-license', `Search result has playbackSourceType: 'open-license'`);
  assert(foundResult?.karaokeAvailability === true, `Search result has karaokeAvailability: true`);

  const fetchedTrack = await naroCatalogProvider.getTrack('josh-woodward-shot-down');
  assert(!!fetchedTrack, `getTrack('josh-woodward-shot-down') returns track`);
  assert(fetchedTrack?.playbackSourceType === 'open-license', `Fetched track has playbackSourceType: 'open-license'`);

  // 6. Provider Selection and Backing Mode Switching
  console.log('\n[Check 6] Audio Playback Provider & Karaoke Routing...');
  const selectedProvider = playbackService.selectProviderForSong(song);
  assert(selectedProvider.id === 'naro-full-length', `Selected provider is 'naro-full-length' (got ${selectedProvider.id})`);
  assert(selectedProvider.canPlayFullLength(song) === true, `selectedProvider.canPlayFullLength(song) is true`);
  assert(typeof selectedProvider.setBackingMode === 'function', `selectedProvider implements setBackingMode()`);

  // 7. Verify Existing Tracks Are Preserved Unchanged
  console.log('\n[Check 7] Preservation of Existing Preview and Fixture Tracks...');
  // A. Midnight Drive
  const midnightTrack = await naroCatalogProvider.getTrack('midnight-drive');
  assert(!!midnightTrack, `Midnight Drive exists in catalog`);
  const midnightCap = capabilityService.evaluate(midnightTrack!);
  assert(midnightCap.isDevFixture === true, `Midnight Drive isDevFixture remains true`);
  assert(midnightTrack?.playbackSourceType === 'dev-fixture', `Midnight Drive playbackSourceType remains 'dev-fixture'`);

  // B. Channa Mereya
  const channaResults = await appleMusicCatalogProvider.search('Channa Mereya', { limit: 1 });
  assert(channaResults.length > 0, `Channa Mereya search succeeds`);
  const channaNorm = await appleMusicCatalogProvider.normalizeSong(channaResults[0]);
  const channaCap = capabilityService.evaluate(channaNorm);
  assert(channaCap.playback === 'PREVIEW', `Channa Mereya remains PREVIEW (got ${channaCap.playback})`);
  assert(channaNorm.isStreamPreview === true, `Channa Mereya isStreamPreview remains true`);
  assert(channaNorm.fullLengthAvailable === false, `Channa Mereya fullLengthAvailable remains false`);

  // C. Hangova
  const hangovaResults = await appleMusicCatalogProvider.search('Hangova', { limit: 1 });
  assert(hangovaResults.length > 0, `Hangova search succeeds`);
  const hangovaNorm = await appleMusicCatalogProvider.normalizeSong(hangovaResults[0]);
  const hangovaCap = capabilityService.evaluate(hangovaNorm);
  assert(hangovaCap.playback === 'PREVIEW', `Hangova remains PREVIEW (got ${hangovaCap.playback})`);
  assert(hangovaNorm.isStreamPreview === true, `Hangova isStreamPreview remains true`);
  assert(hangovaNorm.fullLengthAvailable === false, `Hangova fullLengthAvailable remains false`);

  console.log('\n====================================================');
  console.log(`ALL VERIFICATION CHECKS PASSED: ${passedTests}/${totalTests}`);
  console.log('====================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
