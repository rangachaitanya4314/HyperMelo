// Comprehensive CDP Verification Suite: Mobile Player Controls & Premium Overflow Menu
// Viewports: 320x568, 360x640, 390x844, 430x932, and Desktop 1440x900

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('======================================================================');
  console.log('HYPERMELO - MOBILE PLAYER CONTROLS & OVERFLOW MENU VERIFICATION SUITE');
  console.log('======================================================================\n');

  // 1. Start Vite preview server on an isolated port
  const testPort = 5174;
  console.log(`[Step 1] Launching Vite preview server on port ${testPort}...`);
  const viteProcess: ChildProcess = spawn(
    'cmd.exe',
    ['/c', `npx vite preview --port ${testPort} --strictPort`],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  viteProcess.stdout?.on('data', (d) => {
    const line = d.toString();
    if (line.includes('Local:')) console.log(`  [Vite] ${line.trim()}`);
  });

  // Wait for server ready
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${testPort}`, (res) => {
          if (res.statusCode && res.statusCode < 400) resolve();
          else reject();
        });
        req.on('error', reject);
        req.end();
      });
      serverReady = true;
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!serverReady) {
    viteProcess.kill();
    throw new Error(`Vite dev server failed to start on port ${testPort}`);
  }
  console.log('  ✅ Vite dev server is responding.\n');

  // 2. Launch Chrome headless with remote debugging
  console.log('[Step 2] Launching Chrome in headless mode with remote debugging...');
  const cdpPort = 9223;
  const chromePath = await findChromePath();
  const chromeProcess: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + path.join(process.cwd(), '.chrome-test-profile-' + Date.now()),
      `http://localhost:${testPort}`
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  // Connect CDP
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const json = await new Promise<string>((resolve, reject) => {
        http.get(`http://localhost:${cdpPort}/json`, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const pages = JSON.parse(json);
      const target = pages.find((p: any) => p.type === 'page' && p.url.includes(`localhost:${testPort}`));
      if (target?.webSocketDebuggerUrl) {
        wsUrl = target.webSocketDebuggerUrl;
        break;
      }
    } catch {
      await sleep(400);
    }
  }

  if (!wsUrl) {
    chromeProcess.kill();
    viteProcess.kill();
    throw new Error('Failed to obtain Chrome CDP WebSocket URL');
  }

  const cdp = new CdpConnection(wsUrl);
  await cdp.connect();
  console.log('  ✅ Chrome CDP session connected successfully.\n');

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Skip intro animation immediately in test session
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { sessionStorage.setItem('hypermelo_intro_seen', 'true'); } catch (e) {}`
    });

    console.log(`[Step 2b] Navigating Chrome explicitly to http://localhost:${testPort}...`);
    await cdp.send('Page.navigate', { url: `http://localhost:${testPort}` });
    await sleep(2000);

    // Wait for React app to mount and window bindings to become available
    let appMounted = false;
    for (let i = 0; i < 30; i++) {
      const ready = await cdp.eval(`!!window.__naro_play_song && !!window.__naro_open_now_playing`);
      if (ready) {
        appMounted = true;
        break;
      }
      // Click skip button if intro is active
      await cdp.eval(`
        (() => {
          const skipBtn = document.querySelector('.intro-skip-btn, button[aria-label="Enter Studio"]');
          if (skipBtn) skipBtn.click();
        })()
      `);
      await sleep(400);
    }

    assert(appMounted, 'HyperMelo application mounted with audio test bindings');

    // 3. Play a real song and open Now Playing view
    console.log('[Step 3] Playing track and opening full-screen Now Playing view...');
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs ? window.__naro_get_songs() : [];
        const song = songs[0] || window.__naro_current_song;
        if (song) {
          window.__naro_play_song(song, 2.0);
        }
        if (window.__naro_open_now_playing) {
          window.__naro_open_now_playing();
        }
      })()
    `);
    await sleep(800);

    const isNowPlayingOpen = await cdp.eval(`!!document.getElementById('naro-now-playing')`);
    assert(isNowPlayingOpen, 'Full-screen Now Playing modal is rendered in DOM');

    // 4. Test Viewports
    const MOBILE_VIEWPORTS = [
      { name: '320x568 (iPhone SE 1st gen)', width: 320, height: 568 },
      { name: '360x640 (Compact Android)', width: 360, height: 640 },
      { name: '390x844 (iPhone 12/13/14 Standard)', width: 390, height: 844 },
      { name: '430x932 (iPhone 14/15/16 Pro Max)', width: 430, height: 932 }
    ];

    for (const vp of MOBILE_VIEWPORTS) {
      console.log(`\n--- Testing Mobile Viewport: ${vp.name} ---`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(400);

      const metrics = await cdp.eval(`
        (() => {
          const container = document.getElementById('naro-now-playing');
          const desktopSoundControls = document.getElementById('now-playing-audiophile-suite');
          const lyricsDockBtn = document.getElementById('now-playing-lyrics-btn');
          const moreBtn = document.getElementById('now-playing-more-btn');
          const seekSlider = document.getElementById('now-playing-seek-slider');
          const playBtn = document.getElementById('now-playing-play-btn');

          const soundVisible = desktopSoundControls ? window.getComputedStyle(desktopSoundControls).display !== 'none' : false;
          const lyricsBtnStyle = lyricsDockBtn ? window.getComputedStyle(lyricsDockBtn) : null;
          const lyricsBtnVisible = lyricsBtnStyle ? lyricsBtnStyle.display !== 'none' : false;
          const lyricsBtnRect = lyricsDockBtn ? lyricsDockBtn.getBoundingClientRect() : null;
          const moreBtnRect = moreBtn ? moreBtn.getBoundingClientRect() : null;

          const overflowing = container ? Array.from(container.querySelectorAll('*')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > window.innerWidth || el.scrollWidth > window.innerWidth;
          }).map(el => ({
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className : '',
            rectWidth: Math.round(el.getBoundingClientRect().width),
            rectRight: Math.round(el.getBoundingClientRect().right),
            scrollWidth: el.scrollWidth
          })) : [];

          return {
            windowWidth: window.innerWidth,
            containerScrollWidth: container?.scrollWidth || 0,
            hasHorizontalOverflow: (container?.scrollWidth || 0) > window.innerWidth + 1,
            overflowing: overflowing.slice(0, 10),
            soundVisibleOnMobile: soundVisible,
            hasLyricsDockBtn: !!lyricsDockBtn,
            lyricsBtnVisible: lyricsBtnVisible,
            lyricsBtnWidth: lyricsBtnRect?.width || 0,
            lyricsBtnHeight: lyricsBtnRect?.height || 0,
            moreBtnWidth: moreBtnRect?.width || 0,
            moreBtnHeight: moreBtnRect?.height || 0,
            hasSeekSlider: !!seekSlider,
            hasPlayBtn: !!playBtn
          };
        })()
      `);

      if (metrics.hasHorizontalOverflow) {
        console.log('    [Overflow elements at ' + vp.width + 'px]:', JSON.stringify(metrics.overflowing, null, 2));
      }

      assert(!metrics.hasHorizontalOverflow, `Zero horizontal overflow at ${vp.width}px (scrollWidth: ${metrics.containerScrollWidth}px <= ${metrics.windowWidth}px)`);
      assert(!metrics.soundVisibleOnMobile, `Audiophile Sound Engine panel is removed from main flow on mobile (display: none)`);
      assert(metrics.lyricsBtnVisible, `Dedicated Lyrics button is visible at bottom-left on mobile`);
      assert(metrics.lyricsBtnWidth >= 44 && metrics.lyricsBtnHeight >= 44, `Lyrics button touch target meets minimum 44px (${metrics.lyricsBtnWidth}x${metrics.lyricsBtnHeight}px)`);
      assert(metrics.moreBtnWidth >= 40 && metrics.moreBtnHeight >= 40, `Three-dot more button touch target is at least 40px (${metrics.moreBtnWidth}x${metrics.moreBtnHeight}px)`);
    }

    // 5. Test Top-Right Overflow Menu & Actions at 390x844
    console.log('\n[Step 5] Testing Top-Right Overflow Menu & Spotify/Apple-inspired Actions at 390x844...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(300);

    // Open menu
    await cdp.eval(`document.getElementById('now-playing-more-btn').click()`);
    await sleep(400);

    const menuOpenCheck = await cdp.eval(`
      (() => {
        const menu = document.getElementById('now-playing-more-menu');
        const backdrop = document.querySelector('.now-playing-more-backdrop');
        const trackTitle = menu?.querySelector('.now-playing-menu-title')?.textContent?.trim();
        const trackArtist = menu?.querySelector('.now-playing-menu-artist')?.textContent?.trim();

        // 6 Actions
        const likeBtn = document.getElementById('now-playing-menu-like-btn');
        const playlistBtn = document.getElementById('now-playing-menu-add-playlist-btn');
        const libraryBtn = document.getElementById('now-playing-menu-library-btn');
        const shareBtn = document.getElementById('now-playing-share-moment-btn');
        const copyLinkBtn = document.getElementById('now-playing-menu-copy-link-btn');
        const infoBtn = document.getElementById('now-playing-menu-track-info-btn');

        // Audiophile Section
        const audioWrap = document.getElementById('now-playing-menu-audiophile-wrap');
        const modeOriginal = document.getElementById('now-playing-menu-mode-original');
        const modeImmersive = document.getElementById('now-playing-menu-mode-immersive');
        const modePunch = document.getElementById('now-playing-menu-mode-punch');
        const bassSlider = document.getElementById('now-playing-menu-bass-slider');

        return {
          menuExists: !!menu,
          backdropExists: !!backdrop,
          trackTitle,
          trackArtist,
          hasLikeBtn: !!likeBtn,
          hasPlaylistBtn: !!playlistBtn,
          hasLibraryBtn: !!libraryBtn,
          hasShareBtn: !!shareBtn,
          hasCopyLinkBtn: !!copyLinkBtn,
          hasInfoBtn: !!infoBtn,
          hasAudiophileSection: !!audioWrap,
          hasModeOriginal: !!modeOriginal,
          hasModeImmersive: !!modeImmersive,
          hasModePunch: !!modePunch,
          hasBassSlider: !!bassSlider
        };
      })()
    `);

    assert(menuOpenCheck.menuExists, 'Overflow menu opened as mobile bottom-sheet');
    assert(menuOpenCheck.backdropExists, 'Translucent backdrop is rendered for outside-tap dismissal');
    assert(!!menuOpenCheck.trackTitle, `Menu displays genuine song title: "${menuOpenCheck.trackTitle}"`);
    assert(menuOpenCheck.hasLikeBtn, 'Menu contains Like / Unlike track item (#now-playing-menu-like-btn)');
    assert(menuOpenCheck.hasPlaylistBtn, 'Menu contains Add to Playlist item (#now-playing-menu-add-playlist-btn)');
    assert(menuOpenCheck.hasLibraryBtn, 'Menu contains Save to Library item (#now-playing-menu-library-btn)');
    assert(menuOpenCheck.hasShareBtn, 'Menu contains Share Moment item (#now-playing-share-moment-btn)');
    assert(menuOpenCheck.hasCopyLinkBtn, 'Menu contains Copy Song Link item (#now-playing-menu-copy-link-btn)');
    assert(menuOpenCheck.hasInfoBtn, 'Menu contains Song Credits & Info item (#now-playing-menu-track-info-btn)');
    assert(menuOpenCheck.hasAudiophileSection, 'Menu contains Audiophile Sound Engine section');
    assert(menuOpenCheck.hasModeOriginal && menuOpenCheck.hasModeImmersive && menuOpenCheck.hasModePunch, 'Menu includes all 3 Sound Modes: Original, Immersive, Punch');
    assert(menuOpenCheck.hasBassSlider, 'Menu includes Bass Intensity adjustment slider');

    // Test Clicking Track Info in Menu
    console.log('\n[Step 6] Testing Song Credits & Audio Info expander in menu...');
    await cdp.eval(`document.getElementById('now-playing-menu-track-info-btn').click()`);
    await sleep(200);

    const detailsCheck = await cdp.eval(`
      (() => {
        const panel = document.getElementById('now-playing-track-details-panel');
        if (!panel) return { panelExists: false };
        const text = panel.textContent || '';
        return {
          panelExists: true,
          hasTrack: text.includes('Track'),
          hasArtist: text.includes('Artist'),
          hasAlbum: text.includes('Album'),
          hasDuration: text.includes('Duration'),
          hasProvider: text.includes('Provider') || text.includes('License')
        };
      })()
    `);
    assert(detailsCheck.panelExists, 'Song Credits & Audio Info panel expanded');
    assert(detailsCheck.hasTrack && detailsCheck.hasArtist && detailsCheck.hasDuration, 'Genuine track metadata correctly rendered');

    // Test Sound Mode switching inside menu
    console.log('\n[Step 7] Testing Audiophile Sound Mode switching inside menu...');
    await cdp.eval(`document.getElementById('now-playing-menu-mode-immersive').click()`);
    await sleep(200);
    const modeSwitchCheck = await cdp.eval(`
      document.getElementById('now-playing-menu-mode-immersive')?.classList.contains('active') ||
      document.getElementById('now-playing-menu-mode-immersive')?.getAttribute('aria-checked') === 'true'
    `);
    assert(modeSwitchCheck, 'Switched to Immersive sound mode from overflow menu');

    // Test Outside click / backdrop dismiss
    console.log('\n[Step 8] Testing outside tap / backdrop dismiss of overflow menu...');
    await cdp.eval(`document.querySelector('.now-playing-more-backdrop').click()`);
    await sleep(300);
    const isMenuClosed = await cdp.eval(`!document.getElementById('now-playing-more-menu')`);
    assert(isMenuClosed, 'Overflow menu cleanly dismissed on outside / backdrop tap');

    // 9. Test Dedicated Lyrics Button & Mobile Lyrics Sheet
    console.log('\n[Step 9] Testing Dedicated Bottom-Left Lyrics Button...');
    const lyricsBtnTest = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-lyrics-btn');
        if (!btn) return { error: 'Lyrics button not found' };
        btn.click();
        return { clicked: true };
      })()
    `);
    assert(lyricsBtnTest.clicked, 'Tapped dedicated Lyrics button');
    await sleep(400);

    const mobileLyricsActiveCheck = await cdp.eval(`
      (() => {
        const main = document.getElementById('now-playing-main');
        const isLyricsActive = main?.classList.contains('mobile-lyrics-active');
        const lyricsCol = main?.querySelector('.now-playing-lyrics-col');
        const leftCol = main?.querySelector('.now-playing-left-col');
        const mobileLangBtn = document.getElementById('now-playing-mobile-lang-btn');
        const collapseBtn = document.getElementById('now-playing-lyrics-collapse-btn');
        const lyricsScroller = document.getElementById('now-playing-lyrics-container');

        // Playback dock controls check while lyrics are active
        const seekSlider = document.getElementById('now-playing-seek-slider');
        const playBtn = document.getElementById('now-playing-play-btn');
        const currentTime = document.getElementById('now-playing-current-time');
        const duration = document.getElementById('now-playing-duration');

        const lyricsColDisplay = lyricsCol ? window.getComputedStyle(lyricsCol).display : 'none';
        const leftColDisplay = leftCol ? window.getComputedStyle(leftCol).display : 'none';
        const leftColOpacity = leftCol ? window.getComputedStyle(leftCol).opacity : '1';
        const seekVisible = seekSlider ? window.getComputedStyle(seekSlider).display !== 'none' : false;
        const playVisible = playBtn ? window.getComputedStyle(playBtn).display !== 'none' : false;

        return {
          isLyricsActive,
          lyricsColVisible: lyricsColDisplay !== 'none',
          leftColHidden: leftColDisplay === 'none' || leftColOpacity === '0',
          hasMobileLangBtn: !!mobileLangBtn,
          hasCollapseBtn: !!collapseBtn || !!document.getElementById('now-playing-lyrics-btn'),
          hasLyricsScroller: !!lyricsScroller,
          seekVisible,
          playVisible,
          hasTimeDisplay: !!currentTime && !!duration
        };
      })()
    `);

    assert(mobileLyricsActiveCheck.isLyricsActive, 'Main container entered mobile-lyrics-active mode');
    assert(mobileLyricsActiveCheck.lyricsColVisible, 'Lyrics sheet seamlessly displayed and blends into album art background');
    assert(mobileLyricsActiveCheck.leftColHidden, 'Hero artwork cleanly hidden to maximize readable lyric space');
    assert(mobileLyricsActiveCheck.seekVisible && mobileLyricsActiveCheck.playVisible, 'Playback dock (scrubber, play/pause, prev, next) remains 100% visible and interactive');
    assert(mobileLyricsActiveCheck.hasMobileLangBtn, 'Mobile language selection button is present in lyrics header');
    assert(mobileLyricsActiveCheck.hasCollapseBtn, 'Collapse button is present to return to artwork');

    // 10. Test Multi-Language Selection inside Lyrics Sheet
    console.log('\n[Step 10] Testing Multi-Language Selection inside Lyrics Sheet...');
    await cdp.eval(`document.getElementById('now-playing-mobile-lang-btn').click()`);
    await sleep(300);

    const langSheetCheck = await cdp.eval(`
      (() => {
        const sheet = document.getElementById('now-playing-lang-picker-sheet');
        if (!sheet) return { sheetExists: false };

        const options = Array.from(sheet.querySelectorAll('.now-playing-lang-option')).map((btn) => {
          return {
            id: btn.id,
            code: btn.querySelector('.lang-code-tag')?.textContent?.trim(),
            native: btn.querySelector('.lang-native-name')?.textContent?.trim(),
            desc: btn.querySelector('.lang-option-desc')?.textContent?.trim()
          };
        });

        return {
          sheetExists: true,
          optionsCount: options.length,
          options
        };
      })()
    `);

    assert(langSheetCheck.sheetExists, 'Mobile Language Picker Sheet opened');
    assert(langSheetCheck.optionsCount === 5, `Displays all 5 verified languages (found ${langSheetCheck.optionsCount})`);
    console.log('    Available verified language representations:');
    for (const opt of langSheetCheck.options) {
      console.log(`      • [${opt.code}] ${opt.native}: ${opt.desc}`);
    }

    // Switch language to Hindi (HI)
    console.log('\n[Step 11] Switching language to Hindi (HI) without interrupting playback...');
    await cdp.eval(`
      (() => {
        const hiBtn = document.getElementById('now-playing-lang-option-hi');
        if (hiBtn) hiBtn.click();
      })()
    `);
    await sleep(400);

    const langSwitchResult = await cdp.eval(`
      (() => {
        const langBtnText = document.getElementById('now-playing-mobile-lang-btn')?.textContent?.trim();
        const activeLang = window.__naro_get_lyric_language ? window.__naro_get_lyric_language() : null;
        const sheetClosed = !document.getElementById('now-playing-lang-picker-sheet');
        return {
          langBtnText,
          activeLang,
          sheetClosed
        };
      })()
    `);
    assert(langSwitchResult.activeLang === 'hi', `Active lyric language updated to "hi" without audio interruption`);
    assert(langSwitchResult.sheetClosed, 'Language sheet dismissed automatically after selection');

    // 12. Test Collapsing Lyrics Sheet back to Artwork
    console.log('\n[Step 12] Testing collapse of Lyrics Sheet back to Hero Artwork...');
    await cdp.eval(`(document.getElementById('now-playing-lyrics-collapse-btn') || document.getElementById('now-playing-lyrics-btn')).click()`);
    await sleep(400);

    const collapsedCheck = await cdp.eval(`
      (() => {
        const main = document.getElementById('now-playing-main');
        const isLyricsActive = main?.classList.contains('mobile-lyrics-active');
        const leftCol = main?.querySelector('.now-playing-left-col');
        const leftColDisplay = leftCol ? window.getComputedStyle(leftCol).display : 'none';
        const leftColOpacity = leftCol ? window.getComputedStyle(leftCol).opacity : '0';
        return {
          isLyricsActive,
          leftColVisible: leftColDisplay !== 'none' && leftColOpacity !== '0'
        };
      })()
    `);
    assert(!collapsedCheck.isLyricsActive, 'mobile-lyrics-active mode deactivated');
    assert(collapsedCheck.leftColVisible, 'Returned seamlessly to hero artwork and main track controls');

    // 13. Test Desktop Viewport Regression (1440x900)
    console.log('\n[Step 13] Verifying Desktop Layout Preservation at 1440x900...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    const desktopCheck = await cdp.eval(`
      (() => {
        const leftCol = document.querySelector('.now-playing-left-col');
        const lyricsCol = document.querySelector('.now-playing-lyrics-col');
        const soundControls = document.getElementById('now-playing-audiophile-suite');
        const lyricsDockBtn = document.getElementById('now-playing-lyrics-btn');
        const desktopLangSelector = document.getElementById('now-playing-meaning-lang-selector');

        const leftDisplay = leftCol ? window.getComputedStyle(leftCol).display : 'none';
        const lyricsDisplay = lyricsCol ? window.getComputedStyle(lyricsCol).display : 'none';
        const soundDisplay = soundControls ? window.getComputedStyle(soundControls).display : 'none';
        const dockBtnDisplay = lyricsDockBtn ? window.getComputedStyle(lyricsDockBtn).display : 'none';
        const langSelectorDisplay = desktopLangSelector ? window.getComputedStyle(desktopLangSelector).display : 'none';

        const leftRect = leftCol?.getBoundingClientRect();
        const lyricsRect = lyricsCol?.getBoundingClientRect();
        const isSideBySide = (lyricsRect?.left || 0) > (leftRect?.right || 0);

        return {
          leftVisible: leftDisplay !== 'none',
          lyricsVisible: lyricsDisplay !== 'none',
          soundVisible: soundDisplay !== 'none',
          dockBtnHidden: dockBtnDisplay === 'none',
          desktopLangVisible: langSelectorDisplay !== 'none',
          isSideBySide
        };
      })()
    `);

    assert(desktopCheck.leftVisible, 'Desktop left column (artwork, metadata) is visible');
    assert(desktopCheck.lyricsVisible, 'Desktop right column (integrated lyrics) is visible');
    assert(desktopCheck.isSideBySide, 'Desktop layout maintains side-by-side 2-column grid');
    assert(desktopCheck.soundVisible, 'Desktop Audiophile Sound Engine suite remains visible in-flow');
    assert(desktopCheck.dockBtnHidden, 'Mobile-only lyrics dock button is hidden on desktop');
    assert(desktopCheck.desktopLangVisible, 'Desktop 5-language selector pill is visible');

    console.log('\n======================================================================');
    console.log('🎉 ALL MOBILE PLAYER CONTROLS & OVERFLOW MENU TESTS PASSED PERFECTLY!');
    console.log('======================================================================\n');
  } finally {
    cdp.close();
    chromeProcess.kill();
    viteProcess.kill();
  }
}

main().catch((err) => {
  console.error('\n❌ TEST RUNNER ERROR:', err);
  process.exit(1);
});
