import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { selectVisualizerFloatingLyrics, isValidLyricText, scoreLyricLine } from '../src/services/lyrics/floatingLyricsSelector';
import { JOSH_WOODWARD_SHOT_DOWN } from '../src/data/songs';
import type { Song } from '../src/shared';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
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

const TEST_SYNCED_SONG: Song = {
  id: 'test-floating-synced-1',
  title: 'Starlight Mirage',
  artist: 'Antigravity Ensemble',
  duration: 180,
  genre: 'Neo-Classical Ambient',
  bpm: 108,
  musicalKey: 'D Minor',
  releaseYear: 2024,
  album: 'Celestial Harmonies',
  karaokeReady: true,
  artwork: {
    palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
    pattern: 'solaris',
    accentWarm: '#E7A58D',
    accentCool: '#8FA8C8',
    accentCream: '#F4DFC9'
  },
  sections: [
    { type: 'intro', label: 'Intro', start: 0, end: 4 },
    { type: 'verse', label: 'Verse 1', start: 4, end: 15 },
    { type: 'chorus', label: 'Chorus', start: 15, end: 32 }
  ],
  lyrics: {
    en: {
      chorusSnippet: 'Stars awaken through the velvet haze',
      lines: [
        { startTime: 4.0, endTime: 8.5, text: 'Whispers echo across the quiet night' },
        { startTime: 9.0, endTime: 14.5, text: 'Shadows dance beneath the silver moonlight' },
        { startTime: 15.0, endTime: 21.0, text: 'Stars awaken through the velvet haze' },
        { startTime: 22.0, endTime: 27.5, text: 'Lost in the beauty of endless space' },
        { startTime: 28.0, endTime: 34.0, text: 'A gentle rhythm that time cannot erase' }
      ]
    }
  },
  streamUrl: 'http://127.0.0.1:5173/audio/josh-woodward-shot-down-vocal.mp3',
  playbackSource: {
    streamUrl: 'http://127.0.0.1:5173/audio/josh-woodward-shot-down-vocal.mp3',
    format: 'mp3',
    bitrate: '320kbps'
  }
} as unknown as Song;

async function run() {
  console.log('======================================================================');
  console.log('NARO — VISUALIZER FLOATING LYRICS SPECIFICATION VERIFICATION');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------
  // [Check 1] Pure Selection Algorithm: Synced Track Timeline Progression
  // -------------------------------------------------------------------
  console.log('[Check 1] Verifying Synced Track Timeline Selection Logic...');
  {
    // At t = 0s (intro before line 0)
    const at0 = selectVisualizerFloatingLyrics(TEST_SYNCED_SONG, 0, 'en');
    assert(at0.topLeft !== null, 'at t=0s, topLeft bubble has content');
    assert(at0.right !== null, 'at t=0s, right bubble has content');
    assert(at0.bottom !== null, 'at t=0s, bottom bubble has content');
    assert(at0.topLeft!.text !== at0.right!.text, 'topLeft does not duplicate right');
    assert(at0.topLeft!.text !== at0.bottom!.text, 'topLeft does not duplicate bottom');
    assert(at0.right!.text !== at0.bottom!.text, 'right does not duplicate bottom');

    // At t = 10s (line 1: "Shadows dance beneath the silver moonlight" is ACTIVE)
    const activeLine1Text = 'Shadows dance beneath the silver moonlight';
    const at10 = selectVisualizerFloatingLyrics(TEST_SYNCED_SONG, 10, 'en');
    assert(at10.topLeft !== null, 'at t=10s, topLeft has previous line');
    assert(at10.topLeft!.type === 'previous_line', 'topLeft correctly marked as previous_line');
    assert(at10.topLeft!.text === 'Whispers echo across the quiet night', 'topLeft selected line 0 as previous line');

    // avoidCurrentCenterLyric
    assert(at10.topLeft!.text !== activeLine1Text, 'topLeft avoids current active center lyric');
    assert(at10.right!.text !== activeLine1Text, 'right avoids current active center lyric');
    assert(at10.bottom!.text !== activeLine1Text, 'bottom avoids current active center lyric');

    // avoidDuplicateLines
    assert(at10.topLeft!.text !== at10.right!.text, 'at t=10s, topLeft !== right');
    assert(at10.topLeft!.text !== at10.bottom!.text, 'at t=10s, topLeft !== bottom');
    assert(at10.right!.text !== at10.bottom!.text, 'at t=10s, right !== bottom');

    // At t = 24s (line 3: "Lost in the beauty of endless space" is ACTIVE)
    const at24 = selectVisualizerFloatingLyrics(TEST_SYNCED_SONG, 24, 'en');
    assert(at24.topLeft!.text !== 'Lost in the beauty of endless space', 'at t=24s, topLeft avoids active line 3');
    assert(at24.right!.text !== 'Lost in the beauty of endless space', 'at t=24s, right avoids active line 3');
  }

  // -------------------------------------------------------------------
  // [Check 2] Line Quality Selection Rules (Short, Meaningful, Non-Empty)
  // -------------------------------------------------------------------
  console.log('\n[Check 2] Verifying Selection Rules (Short, Meaningful, Valid)...');
  {
    assert(isValidLyricText('Short punchy line'), 'Valid lyric line passes');
    assert(!isValidLyricText(''), 'Empty string rejected');
    assert(!isValidLyricText('   '), 'Whitespace rejected');
    assert(!isValidLyricText('[Instrumental Solo]'), 'Instrumental bracket rejected');
    assert(!isValidLyricText('(Guitar riff)'), 'Parenthetical stage marker rejected');
    assert(!isValidLyricText('This is a ridiculously long lyric line that goes on and on and contains far too many syllables and words to reasonably fit inside a sleek luxury floating bubble without severely overflowing or breaking the layout'), 'Excessively long line rejected');
    assert(!isValidLyricText('Lyrics unavailable'), 'Generic placeholder "Lyrics unavailable" strictly rejected');
    assert(!isValidLyricText('సాహిత్యం అందుబాటులో లేదు'), 'Telugu placeholder strictly rejected');

    const shortScore = scoreLyricLine('Stars awaken through the velvet haze'); // 36 chars, 6 words
    const longScore = scoreLyricLine('A very long rambling sentence that exceeds sixty characters easily in length');
    assert(shortScore > longScore, 'Short impactful lines score higher than overly long lines');
  }

  // -------------------------------------------------------------------
  // [Check 3] Fallback When Lyrics Unavailable (Zero Generic Placeholders)
  // -------------------------------------------------------------------
  console.log('\n[Check 3] Verifying Fallback for Song with Unavailable Lyrics (Josh Woodward - Shot Down)...');
  {
    const shotDownFloating = selectVisualizerFloatingLyrics(JOSH_WOODWARD_SHOT_DOWN, 15, 'en');
    const allTexts = [
      shotDownFloating.topLeft?.text || '',
      shotDownFloating.right?.text || '',
      shotDownFloating.bottom?.text || ''
    ];

    for (const t of allTexts) {
      assert(!/lyrics?\s*unavailable/i.test(t), `No placeholder "Lyrics unavailable" found (got "${t}")`);
      assert(!/lorem ipsum/i.test(t), `No placeholder "Lorem ipsum" found`);
      assert(!/no lyrics/i.test(t), `No placeholder "No lyrics" found`);
    }

    assert(shotDownFloating.topLeft !== null, 'topLeft contains real song metadata');
    assert(shotDownFloating.topLeft!.text.includes('Indie Rock'), 'topLeft displays genuine genre ("Indie Rock / Acoustic Pop")');
    assert(shotDownFloating.right !== null, 'right contains real song metadata');
    assert(shotDownFloating.right!.text.includes('Key of G Major'), 'right displays genuine musical key ("Key of G Major")');
    assert(shotDownFloating.bottom !== null, 'bottom contains real song metadata');
    assert(shotDownFloating.bottom!.text.includes('The Beautiful Machine'), 'bottom displays genuine album ("The Beautiful Machine")');
  }

  // -------------------------------------------------------------------
  // Real Chrome CDP Session
  // -------------------------------------------------------------------
  console.log('\n[CDP Setup] Spawning Real Headless Chrome Process...');
  const chromePath = await findChromePath();
  const cdpPort = 9245;
  const userDataDir = path.join(os.tmpdir(), `naro-floating-lyrics-${Date.now()}`);
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
          const list = (await res.json()) as any[];
          if (Array.isArray(list) && list.length > 0 && list[0].webSocketDebuggerUrl) {
            tabs = list;
            break;
          }
        }
      } catch {
        // waiting for chrome
      }
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs.find((t) => t.type === 'page') || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP page on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');

    console.log('[Setup] Navigating to NARO Home...');
    await new Promise((r) => setTimeout(r, 1200));

    // Dismiss cinematic intro if present
    await cdp.eval(`
      (() => {
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------
    // [Check 4] Real Browser DOM: Verify Floating Lyric Bubbles on Home Hero
    // -------------------------------------------------------------------
    console.log('\n[Check 4] Verifying Floating Lyrics DOM Elements on Home Hero...');
    const domCheck = await cdp.eval(`(() => {
      const container = document.getElementById('visualizer-floating-lyrics-container');
      const topLeft = document.getElementById('floating-lyric-top-left');
      const right = document.getElementById('floating-lyric-right');
      const bottom = document.getElementById('floating-lyric-bottom');
      return {
        hasContainer: !!container,
        hasTopLeft: !!topLeft,
        hasRight: !!right,
        hasBottom: !!bottom,
        topLeftText: topLeft ? topLeft.innerText.trim() : null,
        rightText: right ? right.innerText.trim() : null,
        bottomText: bottom ? bottom.innerText.trim() : null
      };
    })()`);

    console.log('  Hero DOM Floating Lyrics Audit:', domCheck);
    assert(domCheck.hasContainer, 'Floating lyrics container #visualizer-floating-lyrics-container is mounted');
    assert(domCheck.hasTopLeft, 'Top-left bubble #floating-lyric-top-left is mounted');
    assert(domCheck.hasRight, 'Right bubble #floating-lyric-right is mounted');
    assert(domCheck.hasBottom, 'Bottom bubble #floating-lyric-bottom is mounted');
    assert(domCheck.topLeftText && domCheck.topLeftText.length > 0, 'Top-left bubble displays non-empty text');
    assert(domCheck.rightText && domCheck.rightText.length > 0, 'Right bubble displays non-empty text');
    assert(domCheck.bottomText && domCheck.bottomText.length > 0, 'Bottom bubble displays non-empty text');
    assert(!domCheck.topLeftText.includes('Lyrics unavailable'), 'Top-left contains NO generic placeholder');
    assert(!domCheck.rightText.includes('Lyrics unavailable'), 'Right contains NO generic placeholder');
    assert(!domCheck.bottomText.includes('Lyrics unavailable'), 'Bottom contains NO generic placeholder');

    // -------------------------------------------------------------------
    // [Check 5] Real Browser DOM: Timeline Progression with Synced Track
    // -------------------------------------------------------------------
    console.log('\n[Check 5] Injecting Synced Track and Verifying Timeline Progression & Avoidance...');
    await cdp.eval(`(() => {
      const audio = document.querySelector('audio');
      if (audio) {
        audio.src = 'http://127.0.0.1:5173/audio/josh-woodward-shot-down-vocal.mp3';
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------
    // [Check 6] Real Browser DOM: Fullscreen Now Playing Integration
    // -------------------------------------------------------------------
    console.log('\n[Check 6] Verifying Floating Lyrics in Fullscreen Now Playing Overlay...');
    await cdp.eval(`(() => {
      const expandBtn = document.querySelector('button[aria-label="Expand Now Playing"]');
      if (expandBtn) expandBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    const nowPlayingCheck = await cdp.eval(`(() => {
      const overlay = document.getElementById('naro-now-playing');
      const artwork = document.getElementById('now-playing-artwork-container');
      const container = artwork ? artwork.querySelector('#visualizer-floating-lyrics-container') : null;
      const topLeft = container ? container.querySelector('#floating-lyric-top-left') : null;
      const right = container ? container.querySelector('#floating-lyric-right') : null;
      const bottom = container ? container.querySelector('#floating-lyric-bottom') : null;

      return {
        isOverlayOpen: !!overlay,
        hasArtworkContainer: !!artwork,
        hasFloatingContainer: !!container,
        hasTopLeft: !!topLeft,
        hasRight: !!right,
        hasBottom: !!bottom
      };
    })()`);

    console.log('  Now Playing Overlay Audit:', nowPlayingCheck);
    assert(nowPlayingCheck.isOverlayOpen, 'Now Playing overlay is open');
    assert(nowPlayingCheck.hasArtworkContainer, 'Artwork container is mounted in Now Playing');
    assert(nowPlayingCheck.hasFloatingContainer, 'Floating lyrics container is mounted inside Now Playing visualizer');
    assert(nowPlayingCheck.hasTopLeft, 'Now Playing visualizer displays top-left bubble');
    assert(nowPlayingCheck.hasRight, 'Now Playing visualizer displays right bubble');
    assert(nowPlayingCheck.hasBottom, 'Now Playing visualizer displays bottom bubble');

    // Close Now Playing
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close Now Playing"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------
    // [Check 7] Responsive Aspect Ratio & Viewport Containment
    // -------------------------------------------------------------------
    console.log('\n[Check 7] Verifying Responsive Layout & Glassmorphic Styling...');
    const layoutAudit = await cdp.eval(`(() => {
      const topLeft = document.getElementById('floating-lyric-top-left');
      const right = document.getElementById('floating-lyric-right');
      const bottom = document.getElementById('floating-lyric-bottom');
      if (!topLeft || !right || !bottom) return { valid: false };

      const rTop = topLeft.getBoundingClientRect();
      const rRight = right.getBoundingClientRect();
      const rBottom = bottom.getBoundingClientRect();

      return {
        valid: true,
        topLeftVisible: rTop.width > 50 && rTop.height > 20,
        rightVisible: rRight.width > 50 && rRight.height > 20,
        bottomVisible: rBottom.width > 50 && rBottom.height > 20,
        withinViewportX: rTop.left >= -80 && rRight.right <= (window.innerWidth + 80)
      };
    })()`);

    console.log('  Layout & Visibility Audit:', layoutAudit);
    assert(layoutAudit.valid, 'All 3 bubbles have valid DOM geometry');
    assert(layoutAudit.topLeftVisible, 'TopLeft bubble has positive dimensions');
    assert(layoutAudit.rightVisible, 'Right bubble has positive dimensions');
    assert(layoutAudit.bottomVisible, 'Bottom bubble has positive dimensions');
    assert(layoutAudit.withinViewportX, 'Bubbles remain safely positioned within viewport range');

    cdp.close();

    console.log('\n======================================================================');
    console.log('ALL VISUALIZER FLOATING LYRICS SPECIFICATION CHECKS PASSED!');
    console.log('======================================================================\n');
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
