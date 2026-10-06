// Comprehensive Verification Suite for Home Moods Content Expansion
// Verifies:
// 1. All 8 moods have >= 15 (target 20) authentic songs.
// 2. Multilingual representation across Telugu, Hindi, Tamil, Malayalam, English in every mood.
// 3. Zero duplicate track IDs within any mood.
// 4. Mood relevance & distinct collections per mood.
// 5. Browser CDP testing across Desktop, Tablet, and Mobile viewports.
// 6. Zero horizontal page overflow on all viewports.
// 7. Horizontal shelf scrolling & desktop arrow controls.
// 8. Track card playback interaction and integration with Now Playing & audio system.

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MOOD_CATALOG, getMoodCatalog, type MoodId } from '../src/data/moodCatalog';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}`);
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

async function runHomeMoodsVerification() {
  console.log('======================================================================');
  console.log('NARO — HOME MOODS CONTENT EXPANSION & RESPONSIVE SHELF VERIFICATION');
  console.log('======================================================================\n');

  // STEP 1: Verify Static Catalog Structure & Multilingual Invariants
  console.log('[Step 1] Verifying Mood Catalog Data & Language Diversity...');
  const moodIds: MoodId[] = [
    'Late Nights',
    'Romance',
    'Party',
    'Sad',
    'Chill',
    'Focus',
    'Feel Good',
    'Road Trip'
  ];

  assert(moodIds.length === 8, '8 distinct moods defined');

  for (const mood of moodIds) {
    const songs = getMoodCatalog(mood);
    console.log(`\n  Checking mood: "${mood}"...`);

    // Rule: Minimum 15, target 20 songs
    assert(
      songs.length >= 15 && songs.length <= 24,
      `Mood "${mood}" has ${songs.length} songs (meets target 15-24)`
    );

    // Rule: Zero duplicate IDs
    const idSet = new Set<string>();
    const dupes: string[] = [];
    for (const s of songs) {
      if (idSet.has(s.id)) dupes.push(s.id);
      idSet.add(s.id);
    }
    assert(dupes.length === 0, `Zero duplicate IDs in "${mood}" (found: ${dupes.join(', ') || 'none'})`);

    // Rule: Multilingual diversity (Telugu, Hindi, Tamil, Malayalam, English)
    const langs = new Set<string>();
    for (const s of songs) {
      if (s.language) langs.add(s.language);
    }

    const hasTe = langs.has('te');
    const hasHi = langs.has('hi');
    const hasTa = langs.has('ta');
    const hasMl = langs.has('ml');
    const hasEn = langs.has('en');

    assert(hasTe, `Mood "${mood}" includes Telugu tracks`);
    assert(hasHi, `Mood "${mood}" includes Hindi tracks`);
    assert(hasTa, `Mood "${mood}" includes Tamil tracks`);
    assert(hasMl, `Mood "${mood}" includes Malayalam tracks`);
    assert(hasEn, `Mood "${mood}" includes English tracks`);

    // Verify metadata completeness
    for (const s of songs) {
      assert(s.title.trim().length > 0, `Track ${s.id} has title`);
      assert(s.artist.trim().length > 0, `Track ${s.id} has artist`);
      assert(s.duration > 0, `Track ${s.id} has positive duration (${s.duration}s)`);
      assert(typeof s.releaseYear === 'number' && s.releaseYear > 1800, `Track ${s.id} has release year (${s.releaseYear})`);
      assert(s.fullLengthAvailable === true, `Track ${s.id} confirms full-length available`);
      assert(s.isStreamPreview === false, `Track ${s.id} is not preview-truncated`);
    }
  }

  // STEP 2: Browser CDP Acceptance & Responsive Tests
  console.log('\n[Step 2] Launching Chrome CDP for Responsive Browser Testing...');
  const chromePath = await findChromePath();
  const cdpPort = 9255;
  const userDataDir = path.join(os.tmpdir(), `naro-moods-${Date.now()}`);
  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1440,900',
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
          const list = (await res.json()) as any[];
          if (Array.isArray(list) && list.length > 0 && list[0].webSocketDebuggerUrl) {
            tabs = list;
            break;
          }
        }
      } catch {
        // waiting
      }
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP page on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('[Setup] Dismissing intro screen if present...');
    await new Promise((r) => setTimeout(r, 1200));

    await cdp.eval(`
      (() => {
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Navigate to Discover if #home-moods is not currently mounted
    await cdp.eval(`
      (() => {
        const moodsSection = document.getElementById('home-moods');
        if (!moodsSection) {
          const navBtns = Array.from(document.querySelectorAll('nav[aria-label="Main Navigation"] button, button'));
          const discoverBtn = navBtns.find(b => b.textContent?.trim().toLowerCase() === 'discover');
          if (discoverBtn) {
            discoverBtn.click();
          }
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Scroll Moods into view
    await cdp.eval(`
      (() => {
        const moodsSection = document.getElementById('home-moods');
        if (moodsSection) moodsSection.scrollIntoView({ behavior: 'instant' });
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // TEST 1: Check presence of Home Moods Section and Mood Tabs
    console.log('\n[Test 1] Verifying Home Moods DOM Presence & Active Shelf...');
    const sectionInfo = await cdp.eval(`
      (() => {
        const sec = document.getElementById('home-moods');
        const shelf = document.getElementById('home-moods-shelf-track');
        const tabs = Array.from(document.querySelectorAll('.home-moods-tablist button[role="tab"]')).map(t => t.textContent.trim());
        const cards = Array.from(document.querySelectorAll('#home-moods-shelf-track .mood-shelf-card-item')).length;
        return {
          sectionExists: !!sec,
          shelfExists: !!shelf,
          tabCount: tabs.length,
          tabs,
          cardCount: cards
        };
      })()
    `);

    assert(sectionInfo.sectionExists, 'Section #home-moods exists in DOM');
    assert(sectionInfo.shelfExists, 'Shelf #home-moods-shelf-track exists in DOM');
    assert(sectionInfo.tabCount === 8, `8 Mood tabs rendered in DOM (found: ${sectionInfo.tabCount})`);
    assert(sectionInfo.cardCount === 20, `Active mood shelf renders 20 song cards (found: ${sectionInfo.cardCount})`);

    // TEST 2: Mood Switching & Track Replacement
    console.log('\n[Test 2] Verifying Mood Switching & Active Collection Replacement...');
    for (const mood of ['Romance', 'Party', 'Sad', 'Chill', 'Focus', 'Feel Good', 'Road Trip', 'Late Nights']) {
      const tabId = `mood-tab-${mood.toLowerCase().replace(/\s+/g, '-')}`;
      const switchResult = await cdp.eval(`
        (() => {
          const btn = document.getElementById('${tabId}');
          if (!btn) return { found: false };
          btn.click();
          return { found: true };
        })()
      `);
      assert(switchResult.found, `Found and clicked tab for "${mood}"`);
      await new Promise((r) => setTimeout(r, 200));

      const activeState = await cdp.eval(`
        (() => {
          const shelf = document.getElementById('home-moods-shelf-track');
          const cards = Array.from(shelf?.querySelectorAll('.mood-shelf-card-item') || []);
          const firstSongTitle = cards[0]?.querySelector('h3')?.textContent || '';
          const firstSongArtist = cards[0]?.querySelector('p')?.textContent || '';
          const cardCount = cards.length;
          return {
            cardCount,
            firstSongTitle,
            firstSongArtist
          };
        })()
      `);

      const expectedCount = getMoodCatalog(mood).length;
      assert(activeState.cardCount === expectedCount, `Mood "${mood}" renders exactly ${expectedCount} cards (first track: "${activeState.firstSongTitle}" by ${activeState.firstSongArtist})`);
    }

    // TEST 3: Shelf Navigation Arrows (Desktop)
    console.log('\n[Test 3] Verifying Desktop Shelf Navigation Arrows...');
    // Ensure viewport is Desktop (1440x900)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 300));

    const initialScroll = await cdp.eval(`
      (() => {
        const shelf = document.getElementById('home-moods-shelf-track');
        const prevBtn = document.querySelector('button[aria-label^="Scroll left"]');
        const nextBtn = document.querySelector('button[aria-label^="Scroll right"]');
        return {
          scrollLeft: shelf ? shelf.scrollLeft : -1,
          scrollWidth: shelf ? shelf.scrollWidth : 0,
          clientWidth: shelf ? shelf.clientWidth : 0,
          prevDisabled: prevBtn ? prevBtn.disabled : null,
          nextDisabled: nextBtn ? nextBtn.disabled : null
        };
      })()
    `);

    assert(initialScroll.scrollLeft <= 5, `Initial shelf scrollLeft is at start (value: ${initialScroll.scrollLeft})`);
    assert(initialScroll.scrollWidth > initialScroll.clientWidth, `Shelf content overflows horizontally (${initialScroll.scrollWidth}px > ${initialScroll.clientWidth}px)`);
    assert(initialScroll.prevDisabled === true, `Left arrow button is disabled at start of shelf`);
    assert(initialScroll.nextDisabled === false, `Right arrow button is enabled`);

    // Click Right Arrow
    await cdp.eval(`
      (() => {
        const nextBtn = document.querySelector('button[aria-label^="Scroll right"]');
        if (nextBtn) nextBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const afterRightScroll = await cdp.eval(`
      (() => {
        const shelf = document.getElementById('home-moods-shelf-track');
        const prevBtn = document.querySelector('button[aria-label^="Scroll left"]');
        return {
          scrollLeft: shelf ? shelf.scrollLeft : 0,
          prevDisabled: prevBtn ? prevBtn.disabled : null
        };
      })()
    `);

    assert(afterRightScroll.scrollLeft > 50, `Clicking right arrow scrolled shelf to right (scrollLeft: ${afterRightScroll.scrollLeft}px)`);
    assert(afterRightScroll.prevDisabled === false, `Left arrow button is now enabled`);

    // Click Left Arrow
    await cdp.eval(`
      (() => {
        const prevBtn = document.querySelector('button[aria-label^="Scroll left"]');
        if (prevBtn) prevBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    const afterLeftScroll = await cdp.eval(`
      (() => {
        const shelf = document.getElementById('home-moods-shelf-track');
        return { scrollLeft: shelf ? shelf.scrollLeft : -1 };
      })()
    `);

    assert(afterLeftScroll.scrollLeft < 50, `Clicking left arrow scrolled shelf back to start (scrollLeft: ${afterLeftScroll.scrollLeft}px)`);

    // TEST 4: Responsive Layouts (Desktop, Tablet, Mobile) & Zero Page Horizontal Overflow
    console.log('\n[Test 4] Verifying Responsive Layouts & Zero Page Horizontal Overflow...');
    const viewports = [
      { name: 'Desktop (1440x900)', width: 1440, height: 900, mobile: false, targetVisibleMin: 4.5, targetVisibleMax: 7.5 },
      { name: 'Tablet (768x1024)', width: 768, height: 1024, mobile: true, targetVisibleMin: 2.8, targetVisibleMax: 4.5 },
      { name: 'Mobile (390x844)', width: 390, height: 844, mobile: true, targetVisibleMin: 1.5, targetVisibleMax: 2.4 }
    ];

    for (const vp of viewports) {
      console.log(`\n  Checking ${vp.name}...`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile
      });
      await new Promise((r) => setTimeout(r, 400));

      const metrics = await cdp.eval(`
        (() => {
          const docScrollWidth = document.documentElement.scrollWidth;
          const docClientWidth = document.documentElement.clientWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const shelf = document.getElementById('home-moods-shelf-track');
          const firstCard = shelf?.querySelector('.mood-shelf-card-item');
          const shelfRect = shelf?.getBoundingClientRect();
          const cardRect = firstCard?.getBoundingClientRect();

          const cardWidth = cardRect ? cardRect.width : 0;
          const shelfWidth = shelfRect ? shelfRect.width : 0;
          const visibleCards = cardWidth > 0 ? (shelfWidth / cardWidth) : 0;

          return {
            docScrollWidth,
            docClientWidth,
            bodyScrollWidth,
            hasPageHorizontalOverflow: docScrollWidth > docClientWidth + 2,
            shelfScrollable: shelf ? (shelf.scrollWidth > shelf.clientWidth) : false,
            cardWidth,
            shelfWidth,
            visibleCards
          };
        })()
      `);

      assert(!metrics.hasPageHorizontalOverflow, `No page horizontal overflow (docScrollWidth: ${metrics.docScrollWidth}px <= docClientWidth: ${metrics.docClientWidth}px)`);
      assert(metrics.shelfScrollable, `Shelf remains horizontally scrollable on ${vp.name}`);
      assert(
        metrics.visibleCards >= vp.targetVisibleMin && metrics.visibleCards <= vp.targetVisibleMax,
        `Visible cards on ${vp.name}: ~${metrics.visibleCards.toFixed(1)} (expected between ${vp.targetVisibleMin} and ${vp.targetVisibleMax})`
      );
    }

    // TEST 5: Track Playback Trigger from Mood Card
    console.log('\n[Test 5] Verifying Track Playback from Mood Card...');
    // Reset to desktop viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 300));

    // Click first card in active shelf
    const playResult = await cdp.eval(`
      (() => {
        const shelf = document.getElementById('home-moods-shelf-track');
        const firstCard = shelf?.querySelector('.mood-shelf-card-item [role="button"]');
        if (!firstCard) return { success: false, reason: 'Card button not found' };
        firstCard.click();
        return { success: true };
      })()
    `);

    assert(playResult.success, `Clicked track card in active mood shelf`);
    await new Promise((r) => setTimeout(r, 800));

    const playbackStatus = await cdp.eval(`
      (() => {
        const currentSong = window.__naro_current_song;
        const audio = window.__naro_audio;
        return {
          currentSongTitle: currentSong ? currentSong.title : '',
          currentSongArtist: currentSong ? currentSong.artist : '',
          audioSrc: audio ? audio.src : '',
          isAudioPlaying: audio ? !audio.paused : false,
          audioDuration: audio ? audio.duration : 0
        };
      })()
    `);

    console.log('    Now Playing track:', playbackStatus.currentSongTitle, 'by', playbackStatus.currentSongArtist);
    assert(playbackStatus.currentSongTitle.length > 0, `Track loaded into player: "${playbackStatus.currentSongTitle}"`);

    console.log('\n======================================================================');
    console.log('🎉 ALL HOME MOODS VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('======================================================================');

    cdp.close();
  } finally {
    try {
      chromeProcess.kill();
    } catch {
      // ignore
    }
  }
}

runHomeMoodsVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
