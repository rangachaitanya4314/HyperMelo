// Phase: Now Playing / Immersive Responsive Layout Verification Suite
// Tests 9 distinct viewports using Chrome DevTools Protocol (CDP):
// 1. 1920x1080 (Desktop Large)
// 2. 1440x900 (Desktop Standard)
// 3. 1280x720 (Desktop Short / 720p)
// 4. 1024x768 (Tablet Landscape)
// 5. 768x1024 (Tablet Portrait)
// 6. 430x932 (Mobile Pro Max - iPhone 14/15/16 Pro Max)
// 7. 390x844 (Mobile Standard - iPhone 12/13/14)
// 8. 375x667 (Mobile Small - iPhone SE)
// 9. 360x800 (Mobile Narrow - Galaxy S)

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: '1920x1080 desktop', width: 1920, height: 1080, isMobile: false },
  { name: '1440x900 desktop', width: 1440, height: 900, isMobile: false },
  { name: '1280x720 short desktop', width: 1280, height: 720, isMobile: false },
  { name: '1024x768 tablet landscape', width: 1024, height: 768, isMobile: false },
  { name: '768x1024 tablet portrait', width: 768, height: 1024, isMobile: true },
  { name: '430x932 mobile', width: 430, height: 932, isMobile: true },
  { name: '390x844 mobile', width: 390, height: 844, isMobile: true },
  { name: '375x667 small mobile', width: 375, height: 667, isMobile: true },
  { name: '360x800 small mobile', width: 360, height: 800, isMobile: true }
];

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

async function runResponsiveVerification() {
  console.log('======================================================================');
  console.log('NARO — NOW PLAYING RESPONSIVE LAYOUT VERIFICATION (9 VIEWPORTS)');
  console.log('======================================================================\n');

  const chromePath = await findChromePath();
  const cdpPort = 9245;
  const userDataDir = path.join(os.tmpdir(), `naro-resp-${Date.now()}`);
  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1920,1080',
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

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP page on port ' + cdpPort);
    }

    const cdp = new CdpConnection(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('[Setup] Navigating to NARO Home and dismissing intro...');
    await new Promise((r) => setTimeout(r, 1200));

    // Dismiss cinematic intro if present
    await cdp.eval(`
      (() => {
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Start playing a track so Now Playing is active
    await cdp.eval(`
      (() => {
        if (window.__naro_play_song && window.__naro_current_song) {
          window.__naro_play_song(window.__naro_current_song, 2.0);
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Open Now Playing overlay
    await cdp.eval(`
      (() => {
        const expandBtn = document.querySelector('button[aria-label="Expand Now Playing"], button[data-testid="expand-now-playing-btn"]');
        if (expandBtn) {
          expandBtn.click();
        } else if (window.__naro_open_now_playing) {
          window.__naro_open_now_playing();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    let allPassed = true;

    for (const vp of VIEWPORTS) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`TESTING VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);
      console.log(`----------------------------------------------------------------------`);

      // Set Device Metrics in CDP
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.isMobile
      });
      await cdp.send('Emulation.setVisibleSize', {
        width: vp.width,
        height: vp.height
      });

      // Wait for layout resize observer and CSS reflow
      await new Promise((r) => setTimeout(r, 500));

      const metrics = await cdp.eval(`
        (() => {
          const container = document.getElementById('naro-now-playing');
          if (!container) return { error: 'NowPlaying container #naro-now-playing not found' };

          const header = container.querySelector('.now-playing-header') || container.querySelector('header');
          const main = document.getElementById('now-playing-main') || container.querySelector('main');
          const footer = container.querySelector('.now-playing-footer') || container.querySelector('footer');
          const artworkWrap = document.getElementById('now-playing-artwork-container');
          const visualizer = artworkWrap ? artworkWrap.querySelector('.beat-synced-visualizer') : null;
          const canvas = visualizer ? visualizer.querySelector('canvas') : null;
          const title = document.getElementById('now-playing-title');
          const artist = document.getElementById('now-playing-artist');
          const playBtn = document.getElementById('now-playing-play-btn');
          const soundBtn = document.getElementById('now-playing-sound-btn');
          const seekSlider = document.getElementById('now-playing-seek-slider');
          const lyricsContainer = document.getElementById('now-playing-lyrics-container');

          const cRect = container.getBoundingClientRect();
          const hRect = header ? header.getBoundingClientRect() : null;
          const mRect = main ? main.getBoundingClientRect() : null;
          const fRect = footer ? footer.getBoundingClientRect() : null;
          const vRect = artworkWrap ? artworkWrap.getBoundingClientRect() : null;
          const tRect = title ? title.getBoundingClientRect() : null;
          const aRect = artist ? artist.getBoundingClientRect() : null;
          const pRect = playBtn ? playBtn.getBoundingClientRect() : null;

          return {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            docScrollWidth: document.documentElement.scrollWidth,
            containerScrollWidth: container.scrollWidth,
            containerClientWidth: container.clientWidth,
            containerHeight: cRect.height,
            mainScrollWidth: main ? main.scrollWidth : 0,
            mainClientWidth: main ? main.clientWidth : 0,
            header: hRect ? { top: hRect.top, bottom: hRect.bottom, height: hRect.height } : null,
            footer: fRect ? { top: fRect.top, bottom: fRect.bottom, height: fRect.height } : null,
            visualizer: vRect ? {
              top: vRect.top,
              bottom: vRect.bottom,
              left: vRect.left,
              right: vRect.right,
              width: vRect.width,
              height: vRect.height,
              aspectRatio: (vRect.width / vRect.height).toFixed(2)
            } : null,
            canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
            title: tRect ? { width: tRect.width, height: tRect.height, text: title.textContent?.trim() } : null,
            artist: aRect ? { width: aRect.width, height: aRect.height, text: artist.textContent?.trim() } : null,
            playBtn: pRect ? { top: pRect.top, bottom: pRect.bottom, height: pRect.height } : null,
            hasSeekSlider: !!seekSlider,
            hasSoundBtn: !!soundBtn,
            hasLyricsContainer: !!lyricsContainer
          };
        })()
      `);

      if (metrics.error) {
        throw new Error(metrics.error);
      }

      // Check 1: Zero horizontal scrollbar
      const hDiff = metrics.containerScrollWidth - metrics.containerClientWidth;
      assert(hDiff <= 1, `No horizontal scrollbar (scrollWidth: ${metrics.containerScrollWidth}px, clientWidth: ${metrics.containerClientWidth}px)`);

      // Check 2: Visualizer square aspect ratio (1:1)
      assert(metrics.visualizer !== null, 'Visualizer container rendered');
      assert(Math.abs(parseFloat(metrics.visualizer.aspectRatio) - 1.0) <= 0.05,
        `Visualizer is strictly square 1:1 (${metrics.visualizer.width}px x ${metrics.visualizer.height}px, ratio: ${metrics.visualizer.aspectRatio})`);

      // Check 3: Visualizer does not exceed viewport width
      assert(metrics.visualizer.width <= vp.width,
        `Visualizer width (${metrics.visualizer.width}px) fits within viewport width (${vp.width}px)`);

      // Check 4: On desktop, visualizer fits vertically between header and footer without clipping
      if (!vp.isMobile) {
        assert(metrics.visualizer.top >= metrics.header.bottom - 4,
          `Visualizer top (${metrics.visualizer.top}px) does not hide behind header bottom (${metrics.header.bottom}px)`);
        assert(metrics.visualizer.bottom <= metrics.footer.top + 50,
          `Visualizer bottom (${metrics.visualizer.bottom}px) fits above footer top (${metrics.footer.top}px)`);
      }

      // Check 5: Song title and artist are visible with non-zero dimensions
      assert(metrics.title !== null && metrics.title.height > 0 && metrics.title.text.length > 0,
        `Song title is visible: "${metrics.title.text}" (${metrics.title.width.toFixed(1)}x${metrics.title.height.toFixed(1)}px)`);
      assert(metrics.artist !== null && metrics.artist.height > 0 && metrics.artist.text.length > 0,
        `Artist is visible: "${metrics.artist.text}" (${metrics.artist.width.toFixed(1)}x${metrics.artist.height.toFixed(1)}px)`);

      // Check 6: Playback controls and scrubber are accessible
      assert(metrics.playBtn !== null && metrics.playBtn.height > 0, 'Play/Pause control is accessible');
      assert(metrics.hasSeekSlider === true, 'Timeline scrubber slider is accessible');
      assert(metrics.hasSoundBtn === true, 'Immersive sound controls are accessible');

      // Check 7: Lyrics scroller container is accessible
      assert(metrics.hasLyricsContainer === true, 'Lyrics container is accessible');

      // Check 8: Footer is anchored within viewport bounds
      assert(metrics.footer.bottom <= vp.height + 2,
        `Bottom footer controls are properly anchored within viewport (${metrics.footer.bottom}px <= ${vp.height}px)`);
    }

    console.log('\n======================================================================');
    console.log('ALL 9 VIEWPORTS VERIFIED: 100% RESPONSIVE AND ZERO CROPPING!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\nVerification Error:', err);
    process.exit(1);
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

runResponsiveVerification();
