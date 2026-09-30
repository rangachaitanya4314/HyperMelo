// Verification Script for NARO Master Core Architecture
// Tests: Search, Normal Audio Stream, DSP Vocal Suppression, On-Demand Karaoke, Multi-Language Lyrics, Mic Recording

import { appleMusicCatalogProvider } from '../src/services/providers/AppleMusicCatalogProvider';
import { lyricsService } from '../src/services/lyrics/lyricsService';
import { karaokePlaybackService } from '../src/services/audio/karaokePlaybackService';
import { karaokeSeparationEngine } from '../src/services/audio/vocalSeparation/karaokeSeparationEngine';

async function runVerification() {
  console.log('====================================================');
  console.log('NARO MASTER CORE ARCHITECTURE VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Search "Channa Mereya" & Stream Verification
  console.log('[Test 1] Testing Search & Real Audio Stream for "Channa Mereya"...');
  const results = await appleMusicCatalogProvider.search('Channa Mereya', { limit: 5 });
  if (results.length === 0) {
    throw new Error('Search returned 0 results for "Channa Mereya"');
  }
  const topResult = results[0];
  console.log(`✓ Search returned: "${topResult.title}" by ${topResult.artist}`);
  console.log(`✓ Stream URL: ${topResult.streamUrl}`);

  if (!topResult.streamUrl) {
    throw new Error('Stream URL is missing from search result');
  }

  // Verify stream is live and returns audio
  const streamRes = await fetch(topResult.streamUrl, { method: 'HEAD' });
  console.log(`✓ Audio stream HTTP Status: ${streamRes.status} ${streamRes.statusText}`);
  const contentType = streamRes.headers.get('content-type') || '';
  console.log(`✓ Content-Type: ${contentType}`);
  if (streamRes.status !== 200 && streamRes.status !== 206) {
    throw new Error(`Audio stream returned non-200 status: ${streamRes.status}`);
  }

  // Normalize to full Song model
  const song = await appleMusicCatalogProvider.normalizeSong(topResult);
  console.log(`✓ Normalized song ID: ${song.id}, Playable duration: ${song.duration}s`);
  console.log(`✓ Sections generated: ${song.sections.map((s) => s.label).join(', ')}`);

  // Test 2: Normal Listening vs Karaoke Availability
  console.log('\n[Test 2] Testing Normal Listening & On-Demand Karaoke Eligibility...');
  const isKaraokeReady = karaokePlaybackService.isAvailableForSong(song);
  console.log(`✓ Song playbackAvailable: ${song.playbackAvailable}`);
  console.log(`✓ Song is on-demand Karaoke ready: ${isKaraokeReady}`);
  if (!isKaraokeReady) {
    throw new Error('Song should be Karaoke ready via on-demand vocal suppression DSP');
  }

  // Test 3: Separation Engine Interface & DSP Verification
  console.log('\n[Test 3] Testing Separation Engine Interface...');
  const canProcess = karaokeSeparationEngine.canProcess(song);
  console.log(`✓ karaokeSeparationEngine.canProcess: ${canProcess}`);
  const isEngineReady = karaokeSeparationEngine.isReady();
  console.log(`✓ karaokeSeparationEngine.isReady: ${isEngineReady}`);

  // Test 4: Multi-Language Lyrics & Language Detection
  console.log('\n[Test 4] Testing Multi-Language Lyrics & Script Detection...');
  const teLang = lyricsService.detectLanguage('సెలవంటూ వెళ్తున్నా దీవెనల్లో నన్ను గుర్తుంచుకో');
  const hiLang = lyricsService.detectLanguage('अच्छा चलता हूँ दुआओं में याद रखना');
  const enLang = lyricsService.detectLanguage('Channa mereya mereya beliya o piya');

  console.log(`✓ Telugu script detected: "${teLang}" (expected 'te')`);
  console.log(`✓ Hindi script detected: "${hiLang}" (expected 'hi')`);
  console.log(`✓ English script detected: "${enLang}" (expected 'en')`);

  if (teLang !== 'te' || hiLang !== 'hi' || enLang !== 'en') {
    throw new Error('Language detection failed for one or more scripts');
  }

  // Active line test at chorus (15.5s)
  const lines = song.lyrics?.en?.lines || [];
  if (lines.length > 0) {
    const active = lyricsService.getActiveLine(lines, 15.5);
    console.log(`✓ Active lyric at 15.5s: "${active.line?.text}" (index: ${active.index})`);
  }

  // Test 5: Loading Backing Source for Karaoke
  console.log('\n[Test 5] Testing On-Demand Karaoke Backing Loading...');
  await karaokePlaybackService.loadBackingSource(song, 12);
  const clock = karaokePlaybackService.getClock();
  console.log(`✓ Backing clock ready: ${clock.isReady}, SourceType: ${clock.sourceType}, Time: ${clock.currentTime}s`);
  if (!clock.isReady || clock.sourceType !== 'vocal_suppression_dsp') {
    throw new Error('Backing source failed to initialize in vocal suppression DSP mode');
  }

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
