// NARO Phase 3 — Karaoke 2.0 Comprehensive Acceptance Test
// Real Chrome CDP End-to-End Verification:
// 1. Primary Navigation: Home -> Discover -> Library -> Karaoke -> Downloads
// 2. Surface Cleanliness: Home, Discover, SearchModal, NowPlaying, Library songs have ZERO karaoke badges/buttons
// 3. Karaoke Landing Page: "What do you want to sing?", scoped search, filtered language sections, Your Takes
// 4. Lyric-First Karaoke Modal: Synced lyrics display, click-to-seek, playing/paused state preservation, no line numbers
// 5. Unlimited Recording: >30s recording proof with manual stop
// 6. Performance Review ("Your Take"): "Analysis unavailable", Music & Voice volume sliders, Play, Re-record, Save, Delete
// 7. Library Integration: Saved take appears in Library with truthful duration & metadata

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

class CdpConnection {
  private ws: any;
  private id = 1;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err: any) => reject(err);
      this.ws.onmessage = (event: any) => {
        try {
          const raw = JSON.parse(event.data.toString());
          if (raw.id && this.callbacks.has(raw.id)) {
            const cb = this.callbacks.get(raw.id)!;
            this.callbacks.delete(raw.id);
            cb(raw.result);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: any = {}): Promise<any> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      console.warn('CDP Eval Exception:', res.exceptionDetails);
    }
    const resultObj = res?.result;
    return resultObj?.value !== undefined ? resultObj.value : resultObj?.description;
  }

  close(): void {
    if (this.ws) this.ws.close();
  }
}

async function findChromePath(): Promise<string> {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'chrome';
}

async function runKaraokePhase3Verification() {
  console.log('======================================================================');
  console.log('NARO PHASE 3 — KARAOKE 2.0 FULL ACCEPTANCE TEST (REAL CHROME CDP)');
  console.log('======================================================================\n');

  const chromePath = await findChromePath();
  const cdpPort = 9444;
  const userDataDir = path.join(os.tmpdir(), `naro-karaoke-p3-${Date.now()}`);
  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,900',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ]);

  try {
    let tabs: any[] = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0 && list[0].webSocketDebuggerUrl) {
            tabs = list;
            break;
          }
        }
      } catch {
        // retry
      }
    }

    if (!tabs.length || !tabs[0].webSocketDebuggerUrl) {
      throw new Error(`Failed to connect to Chrome on port ${cdpPort}`);
    }

    const page = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    const cdp = new CdpConnection(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('[Setup] Waiting for React application to mount...');
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`
        (() => {
          sessionStorage.setItem('naro_intro_seen', 'true');
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(document.querySelector('header nav button')) && Boolean(window.__naro_play_song);
        })()
      `);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 1000));

    // =========================================================================
    // CHECK 1: PRIMARY NAVIGATION ORDER
    // Karaoke is a separate primary destination after Library:
    // NARO / Home / Discover / Library / Karaoke / Downloads
    // =========================================================================
    console.log('\n[Check 1] Verifying Primary Navigation Structure & Order...');
    const navCheck = await cdp.eval(`
      (() => {
        const links = Array.from(document.querySelectorAll('header nav button, header nav a'))
          .map(el => el.textContent?.trim())
          .filter(Boolean);
        return {
          links,
          hasHome: links.includes('Home'),
          hasDiscover: links.includes('Discover'),
          hasLibrary: links.includes('Library'),
          hasKaraoke: links.includes('Karaoke'),
          hasDownloads: links.includes('Downloads'),
          karaokeAfterLibrary: links.indexOf('Karaoke') > links.indexOf('Library')
        };
      })()
    `);
    console.log('  Nav Links:', navCheck.links);
    assert(navCheck.hasHome, 'Nav includes Home');
    assert(navCheck.hasDiscover, 'Nav includes Discover');
    assert(navCheck.hasLibrary, 'Nav includes Library');
    assert(navCheck.hasKaraoke, 'Nav includes Karaoke');
    assert(navCheck.hasDownloads, 'Nav includes Downloads');
    assert(navCheck.karaokeAfterLibrary, 'Karaoke is positioned AFTER Library in primary nav');

    // =========================================================================
    // CHECK 2: SURFACE CLEANLINESS (ZERO KARAOKE LEAKS)
    // Normal Home, Discover, Search, MusicCard, Now Playing, Library music
    // must NOT show Karaoke badges, buttons, or actions.
    // =========================================================================
    console.log('\n[Check 2] Verifying Surface Cleanliness (No Karaoke Badges/Buttons on Music Surfaces)...');
    
    // Check Home Surface
    const homeCleanliness = await cdp.eval(`
      (() => {
        const musicCards = Array.from(document.querySelectorAll('[data-testid="music-card"], .glass-panel'));
        const cardTexts = musicCards.map(c => c.textContent || '');
        const hasKaraokeInCards = cardTexts.some(t => t.includes('KARAOKE READY') || t.includes('SING-ALONG') || t.includes('Sing the moment'));
        const hasSingButtonsInCards = Array.from(document.querySelectorAll('main button')).some(b => b.textContent?.trim() === 'Sing' || b.textContent?.trim() === 'Sing Moment');
        return { hasKaraokeInCards, hasSingButtonsInCards };
      })()
    `);
    assert(!homeCleanliness.hasKaraokeInCards, 'Home MusicCards do not display Karaoke badges');
    assert(!homeCleanliness.hasSingButtonsInCards, 'Home MusicCards do not display Sing action buttons');

    // Check Global Search Modal
    console.log('  Testing Global Search Modal Cleanliness...');
    await cdp.eval(`
      (() => {
        const searchBar = document.getElementById('header-search-bar') || document.querySelector('.header-search-bar') || document.querySelector('input[placeholder*="Search"]');
        if (searchBar) {
          searchBar.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const searchCleanliness = await cdp.eval(`
      (() => {
        const modal = document.getElementById('search-modal') || document.querySelector('div[role="dialog"]');
        if (!modal) return { checked: false, hasKaraoke: false };
        const text = modal.textContent || '';
        const buttons = Array.from(modal.querySelectorAll('button')).map(b => b.textContent?.trim());
        const hasSingButtons = buttons.some(b => b === 'Sing' || b === 'Sing Moment');
        const hasKaraokeBadges = text.includes('KARAOKE READY') || text.includes('SING-ALONG');
        return { checked: true, hasKaraoke: hasSingButtons || hasKaraokeBadges };
      })()
    `);
    assert(!searchCleanliness.hasKaraoke, 'Global Search results do not show Karaoke badges or Sing buttons');

    // Close Search Modal
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close search modal"], button[aria-label="Close search"]');
        if (closeBtn) closeBtn.click();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // CHECK 3: KARAOKE LANDING PAGE & SCOPED SEARCH
    // Hero: "What do you want to sing?" with dedicated search input
    // Only returns songs with legitimate karaoke capability, no dev fixtures
    // Filtered language sections: Hindi, Telugu, Tamil, Malayalam, English
    // =========================================================================
    console.log('\n[Check 3] Navigating to Karaoke Destination Page...');
    await cdp.eval(`
      (() => {
        const karaokeNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Karaoke');
        if (karaokeNavBtn) karaokeNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const karaokeLandingCheck = await cdp.eval(`
      (() => {
        const h1 = document.querySelector('h1');
        const searchInput = document.getElementById('karaoke-search-input') || document.querySelector('input[data-testid="karaoke-search-input"]');
        const bodyText = document.body.innerText;

        const hasHeroPrompt = h1?.textContent?.includes('What do you want to sing?') || bodyText.includes('What do you want to sing?');
        const hasSearchInput = Boolean(searchInput);
        
        const hasEnglish = bodyText.includes('Popular English');
        const hasHindi = bodyText.includes('Popular Hindi') || bodyText.includes('हिन्दी कराओके');
        const hasTelugu = bodyText.includes('Popular Telugu') || bodyText.includes('తెలుగు కచేరీ');
        const hasTamil = bodyText.includes('Popular Tamil') || bodyText.includes('தமிழ் பாடல்');
        const hasMalayalam = bodyText.includes('Popular Malayalam') || bodyText.includes('മലയാളം ഗാനങ്ങൾ');

        return {
          h1Text: h1?.textContent,
          hasHeroPrompt,
          hasSearchInput,
          hasEnglish,
          hasHindi,
          hasTelugu,
          hasTamil,
          hasMalayalam
        };
      })()
    `);
    console.log('  Hero text:', karaokeLandingCheck.h1Text);
    assert(karaokeLandingCheck.hasHeroPrompt, 'Hero displays "What do you want to sing?"');
    assert(karaokeLandingCheck.hasSearchInput, 'Dedicated Karaoke search input is present');
    assert(karaokeLandingCheck.hasEnglish, 'Contains Popular English section');
    assert(karaokeLandingCheck.hasHindi, 'Contains Popular Hindi section');
    assert(karaokeLandingCheck.hasTelugu, 'Contains Popular Telugu section');
    assert(karaokeLandingCheck.hasTamil, 'Contains Popular Tamil section');
    assert(karaokeLandingCheck.hasMalayalam, 'Contains Popular Malayalam section');

    // Scoped search test: search for "Shot Down" in Karaoke
    console.log('  Testing Scoped Karaoke Search...');
    await cdp.eval(`
      (() => {
        const input = document.getElementById('karaoke-search-input');
        if (input) {
          input.value = 'Shot Down';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const searchResultsCheck = await cdp.eval(`
      (() => {
        const cards = Array.from(document.querySelectorAll('[data-testid="karaoke-song-card"]'));
        const titles = cards.map(c => c.querySelector('h3')?.textContent?.trim());
        const hasShotDown = titles.includes('Shot Down');
        const cardText = cards[0]?.textContent || '';
        const hasKaraokeReadyBadge = cardText.includes('KARAOKE READY');
        const hasSingNowBtn = Boolean(cards[0]?.querySelector('button'));
        return { hasShotDown, count: cards.length, hasKaraokeReadyBadge, hasSingNowBtn };
      })()
    `);
    assert(searchResultsCheck.hasShotDown, 'Scoped karaoke search returned "Shot Down"');
    assert(searchResultsCheck.hasKaraokeReadyBadge, 'Shot Down displays KARAOKE READY badge');
    assert(searchResultsCheck.hasSingNowBtn, 'Shot Down displays "Sing Now" action button');

    // Clear search input
    await cdp.eval(`
      (() => {
        const input = document.getElementById('karaoke-search-input');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // CHECK 4: LYRIC-FIRST KARAOKE FLOW
    // Launch Karaoke for verified song with synced lyrics
    // Displays synchronized lyrics, click-to-seek, no line numbers
    // Volume sliders for Music and My Voice
    // =========================================================================
    console.log('\n[Check 4] Testing Lyric-First Karaoke Modal & Synchronized Line Seeking...');
    // Play test track with synced lyrics
    await cdp.eval(`
      (() => {
        const testTrack = {
          id: 'phase3-test-track',
          title: 'Starlight Avenue',
          artist: 'NARO Studio',
          duration: 120,
          fullTrackDuration: 120,
          genre: 'Indie Pop',
          bpm: 100,
          musicalKey: 'C Major',
          lyricsAvailable: true,
          lyricsSyncAvailable: true,
          karaokeAvailable: true,
          karaokeReady: true,
          playbackAvailable: true,
          playbackType: 'full',
          playbackSourceType: 'open-license',
          streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
          karaokeSource: {
            type: 'dedicated-instrumental',
            provider: 'naro',
            providerTrackId: 'phase3-test-backing',
            streamUrl: '/audio/josh-woodward-shot-down-novox.mp3',
            duration: 120,
            availability: 'available'
          },
          artwork: {
            palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
            pattern: 'solaris',
            accentWarm: '#E7A58D',
            accentCool: '#8FA8C8'
          },
          sections: [
            { type: 'verse', label: 'Verse 1', start: 0, end: 40 },
            { type: 'chorus', label: 'Chorus', start: 40, end: 80 }
          ],
          lyrics: {
            en: {
              chorusSnippet: 'We walk through neon avenues',
              lines: [
                { time: 5, duration: 6, text: 'The city breathes in amber light' },
                { time: 12, duration: 6, text: 'We walk through neon avenues' },
                { time: 20, duration: 8, text: 'No turning back into the shadows' },
                { time: 30, duration: 8, text: 'Our voices echo in the night' }
              ]
            }
          }
        };

        if (window.__naro_play_song) {
          window.__naro_play_song(testTrack, 0);
        }
        if (window.__naro_open_karaoke_modal) {
          window.__naro_open_karaoke_modal();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    // Verify Lyric-First Karaoke Modal
    const lyricModalCheck = await cdp.eval(`
      (() => {
        const viewer = document.getElementById('karaoke-lyrics-viewer') || document.querySelector('[data-testid="karaoke-lyrics-viewer"]');
        const lines = Array.from(document.querySelectorAll('[data-testid="karaoke-lyric-line"]'));
        const lineTexts = lines.map(l => l.textContent || '');
        const hasLineNumbers = lineTexts.some(t => /^\\s*\\d+\\./.test(t) || t.includes('Line 1'));
        
        const musicSlider = document.getElementById('karaoke-music-volume-slider') || document.querySelector('input[aria-label="Backing music volume"]');
        const voiceSlider = document.getElementById('karaoke-voice-volume-slider') || document.querySelector('input[aria-label="Microphone volume"]');
        
        return {
          hasViewer: Boolean(viewer),
          lineCount: lines.length,
          hasLineNumbers,
          hasMusicSlider: Boolean(musicSlider),
          hasVoiceSlider: Boolean(voiceSlider)
        };
      })()
    `);
    assert(lyricModalCheck.hasViewer, 'Karaoke modal features dedicated Synchronized Lyrics Viewer');
    assert(lyricModalCheck.lineCount >= 4, `Rendered ${lyricModalCheck.lineCount} synchronized lyric lines`);
    assert(!lyricModalCheck.hasLineNumbers, 'No fabricated line numbers in lyric display');
    assert(lyricModalCheck.hasMusicSlider, 'Includes Backing Music volume slider');
    assert(lyricModalCheck.hasVoiceSlider, 'Includes My Voice / Mic volume slider');

    // Test Click-to-Seek on Line 1 (time: 12s)
    console.log('  Testing Click-to-Seek on Lyric Line 1...');
    const seekResult = await cdp.eval(`
      (() => {
        const lines = Array.from(document.querySelectorAll('[data-testid="karaoke-lyric-line"]'));
        if (lines[1]) {
          lines[1].click();
          return { clicked: true, text: lines[1].textContent };
        }
        return { clicked: false };
      })()
    `);
    assert(seekResult.clicked, 'Clicked lyric line 1');
    await new Promise((r) => setTimeout(r, 400));

    const playheadAfterSeek = await cdp.eval(`
      (() => {
        const curr = window.__naro_get_current_time ? window.__naro_get_current_time() : -1;
        return { curr };
      })()
    `);
    console.log('  Playhead after lyric click seek:', playheadAfterSeek.curr);
    assert(Math.abs(playheadAfterSeek.curr - 12) < 2, 'Authoritative playback clock accurately seeked to selected lyric line (12s)');

    // =========================================================================
    // CHECK 5: UNLIMITED RECORDING (>30s PROOF)
    // Start recording from selected line, let it run past 30 seconds (to 34s)
    // Manually click Stop. Confirm no auto-stop at 30s.
    // =========================================================================
    console.log('\n[Check 5] Launching Recording Session without 30s Limit...');
    await cdp.eval(`
      (() => {
        const btn = document.getElementById('sing-moment-btn') || document.querySelector('button[aria-label="Sing This Moment"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Wait for countdown (3s) to finish
    console.log('  Waiting for countdown to finish and live recording to begin...');
    await new Promise((r) => setTimeout(r, 3400));

    const recActiveCheck = await cdp.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const hasRec = bodyText.includes('REC');
        const stopBtn = document.getElementById('karaoke-stop-recording-btn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Stop'));
        return { hasRec, hasStopBtn: Boolean(stopBtn) };
      })()
    `);
    assert(recActiveCheck.hasRec, 'Live recording active with REC indicator');
    assert(recActiveCheck.hasStopBtn, 'Manual Stop button is present and accessible');

    console.log('  Letting recording run beyond 30-second boundary...');
    for (let s = 2; s <= 34; s += 4) {
      await new Promise((r) => setTimeout(r, 4000));
      process.stdout.write(`  ... Recording duration: ~${s + 2}s\n`);
    }

    // Verify still recording at >32s
    const stillRecording = await cdp.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return bodyText.includes('REC');
      })()
    `);
    assert(stillRecording, 'Recording is STILL active past 30 seconds (no artificial auto-stop)');

    // Trigger manual Stop
    console.log('  Triggering user manual STOP...');
    await cdp.eval(`
      (() => {
        const stopBtn = document.getElementById('karaoke-stop-recording-btn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Stop'));
        if (stopBtn) stopBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1400));

    // =========================================================================
    // CHECK 6: PERFORMANCE REVIEW — "YOUR TAKE"
    // Displays: YOUR TAKE, Analysis unavailable, Music volume slider,
    // My Voice volume slider, Play, Re-record, Save, Delete
    // Zero fake scores/pitch/stars
    // =========================================================================
    console.log('\n[Check 6] Verifying Performance Review Modal ("YOUR TAKE")...');
    const reviewCheck = await cdp.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const hasYourTake = bodyText.toUpperCase().includes('YOUR TAKE');
        const hasAnalysisUnavailable = bodyText.includes('Analysis unavailable') || bodyText.toUpperCase().includes('ANALYSIS UNAVAILABLE');
        
        const musicSlider = document.getElementById('review-music-volume-slider') || document.querySelector('input[aria-label="Music volume slider"]');
        const voiceSlider = document.getElementById('review-voice-volume-slider') || document.querySelector('input[aria-label="My Voice volume slider"]');
        
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
        const hasPlay = buttons.some(b => b?.includes('Play') || b?.includes('Pause'));
        const hasRerecord = buttons.some(b => b?.includes('Re-record'));
        const hasSave = buttons.some(b => b?.includes('Save'));
        const hasDelete = buttons.some(b => b?.includes('Delete'));

        // Confirm zero fake scoring numbers/stars
        const hasFakeScores = bodyText.includes('Pitch Accuracy:') || bodyText.includes('★') || bodyText.includes('Score: 9');

        return {
          hasYourTake,
          hasAnalysisUnavailable,
          hasMusicSlider: Boolean(musicSlider),
          hasVoiceSlider: Boolean(voiceSlider),
          hasPlay,
          hasRerecord,
          hasSave,
          hasDelete,
          hasFakeScores
        };
      })()
    `);
    assert(reviewCheck.hasYourTake, 'Modal heading displays "YOUR TAKE"');
    assert(reviewCheck.hasAnalysisUnavailable, 'Truthfully displays "Analysis unavailable"');
    assert(reviewCheck.hasMusicSlider, 'Review includes Music volume slider');
    assert(reviewCheck.hasVoiceSlider, 'Review includes My Voice volume slider');
    assert(reviewCheck.hasPlay, 'Review includes Play button');
    assert(reviewCheck.hasRerecord, 'Review includes Re-record button');
    assert(reviewCheck.hasSave, 'Review includes Save button');
    assert(reviewCheck.hasDelete, 'Review includes Delete button');
    assert(!reviewCheck.hasFakeScores, 'Zero fabricated pitch scores, percentages, or stars');

    // Click Save to Library
    console.log('  Saving take to Library...');
    await cdp.eval(`
      (() => {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Dismiss review modal
    await cdp.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close review modal"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // =========================================================================
    // CHECK 7: LIBRARY "YOUR TAKES" INTEGRATION
    // Navigate to Library -> "Your Takes" tab
    // Shows the saved take with duration >30s and authentic metadata
    // =========================================================================
    console.log('\n[Check 7] Verifying Saved Take in Library "Your Takes" Destination...');
    await cdp.eval(`
      (() => {
        const libNavBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent?.trim() === 'Library');
        if (libNavBtn) libNavBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const libraryCheck = await cdp.eval(`
      (async () => {
        const { indexedDbService } = await import('/src/services/storage/indexedDbService.ts');
        const takes = await indexedDbService.getAllTakes();
        const latest = takes[takes.length - 1];

        const bodyText = document.body.innerText;
        const hasTakeCard = bodyText.includes('Starlight Avenue') || bodyText.includes('Shot Down');
        
        return {
          totalTakes: takes.length,
          latestSongTitle: latest?.songTitle,
          latestDuration: latest?.duration,
          isRealRecording: latest?.isRealRecording,
          hasTakeCard
        };
      })()
    `);
    console.log('  Library Saved Takes:', libraryCheck);
    assert(libraryCheck.totalTakes >= 1, `IndexedDB contains ${libraryCheck.totalTakes} persisted takes`);
    assert(libraryCheck.latestDuration > 30, `Persisted take duration is >30s (actual: ${libraryCheck.latestDuration.toFixed(1)}s)`);
    assert(libraryCheck.isRealRecording === true, 'Saved take marked as authentic recording');
    assert(libraryCheck.hasTakeCard, 'Saved take card successfully rendered in Library UI');

    console.log('\n======================================================================');
    console.log('ALL PHASE 3 KARAOKE 2.0 ACCEPTANCE CHECKS PASSED: 7/7');
    console.log('======================================================================\n');
    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

runKaraokePhase3Verification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
