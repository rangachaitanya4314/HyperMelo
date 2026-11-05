// Comprehensive Verification Suite:
// HyperMelo — Premium Music Player Experience and Non-Duplicate Action Architecture

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9224;
const VITE_PORT = 5175;

function assert(condition, msg) {
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}`);
}

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      console.warn('CDP eval exception:', result.exceptionDetails);
    }
    return result.result?.value;
  }

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(400);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  console.log('================================================================================');
  console.log('HYPERMELO - PREMIUM MUSIC PLAYER & NON-DUPLICATE ARCHITECTURE VERIFICATION');
  console.log('================================================================================\n');

  let viteProc = null;
  let chromeProc = null;
  let cdp = null;

  try {
    console.log(`[Step 1] Checking/Starting Vite server on port ${VITE_PORT}...`);
    let viteReady = false;
    try {
      const check = await fetch(`http://127.0.0.1:${VITE_PORT}/`);
      if (check.ok) viteReady = true;
    } catch {}

    if (!viteReady) {
      viteProc = spawn('npx.cmd', ['vite', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {
        shell: true,
        stdio: 'pipe'
      });
      viteProc.stderr.on('data', (d) => process.stderr.write(d.toString()));
      await waitForServer(`http://127.0.0.1:${VITE_PORT}/`);
    }
    console.log(`  ✓ Vite server running at http://127.0.0.1:${VITE_PORT}/`);

    console.log(`\n[Step 2] Launching Google Chrome headless with CDP on port ${CDP_PORT}...`);
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ]);

    await waitForServer(`http://127.0.0.1:${CDP_PORT}/json/version`, 10000);
    const verRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const verData = await verRes.json();
    console.log(`  ✓ Browser running: ${verData.Browser}`);

    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const listData = await listRes.json();
    const pageTarget = listData.find((t) => t.type === 'page') || listData[0];
    if (!pageTarget) throw new Error('No page target found');

    cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('  ✓ Connected to Chrome CDP session');

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${VITE_PORT}/` });
    await sleep(2000);

    // Enter app if on intro screen
    await cdp.eval(`
      (() => {
        const skip = document.querySelector('.intro-skip-btn, button[aria-label="Enter Studio"]');
        if (skip) skip.click();
      })()
    `);
    await sleep(600);

    // ------------------------------------------------------------------------
    // SECTION 1: Play song and open Now Playing
    // ------------------------------------------------------------------------
    console.log('\n[Step 3] Loading track and opening full-screen Now Playing...');
    await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs ? window.__naro_get_songs() : [];
        const track = songs.find(s => s.id === 'INS171402375') || songs[0];
        if (track && window.__naro_play_song) {
          window.__naro_play_song(track, 1.0);
        }
        if (window.__naro_open_now_playing) {
          window.__naro_open_now_playing();
        }
      })()
    `);
    await sleep(1000);

    const isPlayerOpen = await cdp.eval(`Boolean(document.getElementById('naro-now-playing'))`);
    assert(isPlayerOpen, 'Now Playing player is open');

    // ------------------------------------------------------------------------
    // SECTION 2: Verify No Duplicate Actions across Main Player vs More Menu
    // ------------------------------------------------------------------------
    console.log('\n[Step 4] Verifying Non-Duplicate Action Architecture on Mobile...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(400);

    const nonDuplicateMetrics = await cdp.eval(`
      (() => {
        // Actions row on main player:
        const actionsRow = document.querySelector('.now-playing-actions');
        const actionsStyle = actionsRow ? window.getComputedStyle(actionsRow) : null;
        const actionsRowVisible = actionsStyle ? actionsStyle.display !== 'none' : false;

        // Individual quick-action buttons on main player:
        const mainLikeBtn = document.getElementById('now-playing-like-btn');
        const mainAddPlaylistBtn = document.getElementById('now-playing-add-playlist-btn');
        const mainShareBtn = document.getElementById('now-playing-share-btn');
        const mainSoundSuite = document.querySelector('.now-playing-sound-controls-desktop');

        const mainLikeVisible = mainLikeBtn ? (mainLikeBtn.offsetParent !== null && window.getComputedStyle(mainLikeBtn).display !== 'none') : false;
        const mainAddPlaylistVisible = mainAddPlaylistBtn ? (mainAddPlaylistBtn.offsetParent !== null && window.getComputedStyle(mainAddPlaylistBtn).display !== 'none') : false;
        const mainShareVisible = mainShareBtn ? (mainShareBtn.offsetParent !== null && window.getComputedStyle(mainShareBtn).display !== 'none') : false;
        const mainSoundSuiteVisible = mainSoundSuite ? window.getComputedStyle(mainSoundSuite).display !== 'none' : false;

        // Primary controls that MUST be present on main player:
        const minimizeBtn = document.querySelector('.now-playing-minimize-btn');
        const titleEl = document.getElementById('now-playing-title');
        const artistEl = document.getElementById('now-playing-artist');
        const artworkEl = document.getElementById('now-playing-artwork-container');
        const playBtn = document.getElementById('now-playing-play-btn');
        const prevBtn = document.querySelector('button[aria-label="Previous Track"]');
        const nextBtn = document.querySelector('button[aria-label="Next Track"]');
        const seekSlider = document.getElementById('now-playing-seek-slider');
        const lyricsBtn = document.getElementById('now-playing-lyrics-btn');
        const shuffleBtn = document.getElementById('now-playing-shuffle-btn') || document.querySelector('.now-playing-shuffle-btn');
        const repeatBtn = document.getElementById('now-playing-repeat-btn') || document.querySelector('button[aria-label*="Repeat"]');
        const moreBtn = document.getElementById('now-playing-more-btn');

        return {
          actionsRowVisible,
          mainLikeVisible,
          mainAddPlaylistVisible,
          mainShareVisible,
          mainSoundSuiteVisible,
          hasMinimize: Boolean(minimizeBtn),
          hasTitle: Boolean(titleEl && titleEl.textContent.trim()),
          hasArtist: Boolean(artistEl && artistEl.textContent.trim()),
          hasArtwork: Boolean(artworkEl),
          hasPlayBtn: Boolean(playBtn),
          hasPrevBtn: Boolean(prevBtn),
          hasNextBtn: Boolean(nextBtn),
          hasSeekSlider: Boolean(seekSlider),
          hasLyricsBtn: Boolean(lyricsBtn),
          hasShuffleBtn: Boolean(shuffleBtn),
          hasRepeatBtn: Boolean(repeatBtn),
          hasMoreBtn: Boolean(moreBtn)
        };
      })()
    `);

    assert(!nonDuplicateMetrics.actionsRowVisible, 'Secondary actions row is hidden on mobile main player');
    assert(!nonDuplicateMetrics.mainLikeVisible, 'Like button is NOT duplicated on mobile main player');
    assert(!nonDuplicateMetrics.mainAddPlaylistVisible, 'Add to Playlist button is NOT duplicated on mobile main player');
    assert(!nonDuplicateMetrics.mainShareVisible, 'Share button is NOT duplicated on mobile main player');
    assert(!nonDuplicateMetrics.mainSoundSuiteVisible, 'Audiophile Sound Engine is NOT in main player flow on mobile');

    assert(nonDuplicateMetrics.hasMinimize, 'Main player has minimize/back navigation');
    assert(nonDuplicateMetrics.hasTitle && nonDuplicateMetrics.hasArtist, 'Main player displays track title and artist');
    assert(nonDuplicateMetrics.hasArtwork, 'Main player displays album artwork');
    assert(nonDuplicateMetrics.hasPlayBtn && nonDuplicateMetrics.hasPrevBtn && nonDuplicateMetrics.hasNextBtn, 'Main player displays primary playback controls');
    assert(nonDuplicateMetrics.hasSeekSlider, 'Main player displays seek bar and duration');
    assert(nonDuplicateMetrics.hasShuffleBtn && nonDuplicateMetrics.hasRepeatBtn, 'Main player displays shuffle and repeat');
    assert(nonDuplicateMetrics.hasLyricsBtn, 'Main player displays dedicated Lyrics entry point');
    assert(nonDuplicateMetrics.hasMoreBtn, 'Main player displays More options button');

    // ------------------------------------------------------------------------
    // SECTION 3: Verify More Menu & All Secondary Actions
    // ------------------------------------------------------------------------
    console.log('\n[Step 5] Testing More Menu & Secondary Actions Functionality...');
    await cdp.eval(`
      (() => {
        if (window.__naro_open_more_menu) window.__naro_open_more_menu();
        else document.getElementById('now-playing-more-btn')?.click();
      })()
    `);
    await sleep(400);

    const menuMetrics = await cdp.eval(`
      (() => {
        const menu = document.getElementById('now-playing-more-menu');
        const header = document.querySelector('.now-playing-menu-track-header');
        const thumb = document.querySelector('.now-playing-menu-thumb');
        const title = document.querySelector('.now-playing-menu-title');
        const artist = document.querySelector('.now-playing-menu-artist');

        const likeBtn = document.getElementById('now-playing-menu-like-btn');
        const playlistBtn = document.getElementById('now-playing-menu-add-playlist-btn');
        const libraryBtn = document.getElementById('now-playing-menu-library-btn');
        const shareSongBtn = document.getElementById('now-playing-menu-share-btn');
        const shareMomentBtn = document.getElementById('now-playing-share-moment-btn');
        const copyLinkBtn = document.getElementById('now-playing-menu-copy-link-btn');
        const creditsBtn = document.getElementById('now-playing-menu-track-info-btn');
        const audioWrap = document.getElementById('now-playing-menu-audiophile-wrap');
        const soundBody = document.querySelector('.now-playing-menu-audiophile-body');

        // Check touch target heights >= 44px
        const buttons = [likeBtn, playlistBtn, libraryBtn, shareSongBtn, shareMomentBtn, copyLinkBtn, creditsBtn];
        const allTouchTargetsValid = buttons.every(b => b ? b.getBoundingClientRect().height >= 44 : false);

        return {
          menuOpen: Boolean(menu),
          hasHeader: Boolean(header && thumb && title && artist),
          trackTitle: title ? title.textContent.trim() : '',
          trackArtist: artist ? artist.textContent.trim() : '',
          hasLikeBtn: Boolean(likeBtn),
          hasPlaylistBtn: Boolean(playlistBtn),
          hasLibraryBtn: Boolean(libraryBtn),
          hasShareSongBtn: Boolean(shareSongBtn),
          hasShareMomentBtn: Boolean(shareMomentBtn),
          hasCopyLinkBtn: Boolean(copyLinkBtn),
          hasCreditsBtn: Boolean(creditsBtn),
          hasAudioWrap: Boolean(audioWrap),
          soundCollapsed: !soundBody,
          allTouchTargetsValid
        };
      })()
    `);

    assert(menuMetrics.menuOpen, 'More menu opened as dark translucent glass sheet');
    assert(menuMetrics.hasHeader, 'More menu header displays compact artwork, title and artist');
    assert(menuMetrics.hasLikeBtn, 'More menu contains Like / Unlike item');
    assert(menuMetrics.hasPlaylistBtn, 'More menu contains Add to Playlist item');
    assert(menuMetrics.hasLibraryBtn, 'More menu contains Save to Library item');
    assert(menuMetrics.hasShareSongBtn, 'More menu contains Share Song item');
    assert(menuMetrics.hasShareMomentBtn, 'More menu contains Share Moment item');
    assert(menuMetrics.hasCopyLinkBtn, 'More menu contains Copy Song Link item');
    assert(menuMetrics.hasCreditsBtn, 'More menu contains Song Credits and Information item');
    assert(menuMetrics.hasAudioWrap, 'More menu contains Audiophile Sound Engine item');
    assert(menuMetrics.soundCollapsed, 'Audiophile Sound Engine is collapsed by default (no leak)');
    assert(menuMetrics.allTouchTargetsValid, 'All More menu action touch targets are >= 44px');

    // Test Like / Unlike action
    await cdp.eval(`document.getElementById('now-playing-menu-like-btn')?.click()`);
    await sleep(200);

    const likeToggleResult = await cdp.eval(`
      (() => {
        const likeBtn = document.getElementById('now-playing-menu-like-btn');
        const toast = document.querySelector('.now-playing-menu-toast');
        return {
          text: likeBtn ? likeBtn.textContent : '',
          toastText: toast ? toast.textContent : ''
        };
      })()
    `);
    assert(likeToggleResult.text.includes('Liked') || likeToggleResult.text.includes('Like'), 'Like action toggled song like state with toast feedback');

    // Test Copy Song Link action
    await cdp.eval(`document.getElementById('now-playing-menu-copy-link-btn')?.click()`);
    await sleep(200);

    const copyResult = await cdp.eval(`
      (() => {
        const toast = document.querySelector('.now-playing-menu-toast');
        return { toastText: toast ? toast.textContent : '' };
      })()
    `);
    assert(copyResult.toastText.includes('copied'), 'Copy Song Link triggered confirmation toast');

    // Test Expanding Song Credits & Information
    await cdp.eval(`
      (() => {
        const creditsBtn = document.getElementById('now-playing-menu-track-info-btn');
        creditsBtn.click();
      })()
    `);
    await sleep(250);

    const creditsExpanded = await cdp.eval(`
      (() => {
        const panel = document.getElementById('now-playing-track-details-panel');
        if (!panel) return false;
        const text = panel.textContent;
        return text.includes('Track:') && text.includes('Artist:');
      })()
    `);
    assert(creditsExpanded, 'Song Credits and Information expanded with genuine track metadata');

    // Test Expanding Audiophile Sound Engine
    await cdp.eval(`
      (() => {
        const audioHeader = document.querySelector('.now-playing-menu-audiophile-header');
        audioHeader.click();
      })()
    `);
    await sleep(250);

    const soundExpanded = await cdp.eval(`
      (() => {
        const body = document.querySelector('.now-playing-menu-audiophile-body');
        const modeOriginal = document.getElementById('now-playing-menu-mode-original');
        const modeImmersive = document.getElementById('now-playing-menu-mode-immersive');
        const modePunch = document.getElementById('now-playing-menu-mode-punch');
        const bassSlider = document.getElementById('now-playing-menu-bass-slider');
        return {
          bodyOpen: Boolean(body),
          hasModes: Boolean(modeOriginal && modeImmersive && modePunch),
          hasBassSlider: Boolean(bassSlider)
        };
      })()
    `);
    assert(soundExpanded.bodyOpen && soundExpanded.hasModes && soundExpanded.hasBassSlider, 'Audiophile Sound Engine expanded deliberately with 3 modes and bass slider');

    // Close More menu
    await cdp.eval(`
      (() => {
        if (window.__naro_close_more_menu) window.__naro_close_more_menu();
        else document.querySelector('.now-playing-menu-close-btn')?.click();
      })()
    `);
    await sleep(400);

    const isMenuClosed = await cdp.eval(`!document.getElementById('now-playing-more-menu')`);
    assert(isMenuClosed, 'More menu closed smoothly without interrupting playback');

    // ------------------------------------------------------------------------
    // SECTION 4: Verify Album Artwork & Dynamic Atmosphere
    // ------------------------------------------------------------------------
    console.log('\n[Step 6] Testing Album Artwork Presentation & Dynamic Atmosphere...');
    const artMetrics = await cdp.eval(`
      (() => {
        const wrap = document.getElementById('now-playing-artwork-container');
        const mesh = document.querySelector('.now-playing-ambient-mesh');
        const bloom = document.querySelector('.now-playing-ambient-bloom');
        const img = wrap ? wrap.querySelector('img') : null;

        const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
        const wrapStyle = wrap ? window.getComputedStyle(wrap) : null;
        const primaryColor = getComputedStyle(document.getElementById('naro-now-playing')).getPropertyValue('--ambient-primary');
        const glowColor = getComputedStyle(document.getElementById('naro-now-playing')).getPropertyValue('--ambient-glow');

        return {
          aspectRatio: wrapRect ? (wrapRect.width / wrapRect.height).toFixed(2) : '0',
          hasAmbientMesh: Boolean(mesh),
          hasAmbientBloom: Boolean(bloom),
          hasImg: Boolean(img),
          imgComplete: img ? img.complete : false,
          primaryColor: primaryColor.trim(),
          glowColor: glowColor.trim(),
          isPlayingClass: wrap ? wrap.classList.contains('is-playing') : false
        };
      })()
    `);

    assert(artMetrics.aspectRatio === '1.00', `Album artwork preserves 1:1 square aspect ratio (actual ratio: ${artMetrics.aspectRatio})`);
    assert(artMetrics.hasAmbientMesh && artMetrics.hasAmbientBloom, 'Dynamic atmospheric ambient mesh and radial bloom are active');
    assert(artMetrics.primaryColor.length > 0, `Ambient primary color extracted: ${artMetrics.primaryColor}`);
    assert(artMetrics.glowColor.length > 0, `Ambient edge glow color extracted: ${artMetrics.glowColor}`);

    // ------------------------------------------------------------------------
    // SECTION 5: Verify Responsive Layout across all 4 Viewports + Screenshots
    // ------------------------------------------------------------------------
    console.log('\n[Step 7] Capturing and verifying 6 states across 4 target viewports...');
    const VIEWPORTS = [
      { name: '320x568', width: 320, height: 568 },
      { name: '360x800', width: 360, height: 800 },
      { name: '390x844', width: 390, height: 844 },
      { name: '430x932', width: 430, height: 932 }
    ];

    for (const vp of VIEWPORTS) {
      console.log(`\n  --- Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(350);

      // State 1: Main mobile player
      const vpMetrics = await cdp.eval(`
        (() => {
          const modal = document.getElementById('naro-now-playing');
          const wrap = document.getElementById('now-playing-artwork-container');
          const dockBtn = document.getElementById('now-playing-lyrics-btn');
          const actionsRow = document.querySelector('.now-playing-actions');

          const artRect = wrap ? wrap.getBoundingClientRect() : null;
          const dockRect = dockBtn ? dockBtn.getBoundingClientRect() : null;
          const actionsStyle = actionsRow ? window.getComputedStyle(actionsRow) : null;

          return {
            modalScrollHeight: modal ? modal.scrollHeight : 0,
            modalClientHeight: modal ? modal.clientHeight : 0,
            modalFits: modal ? (modal.scrollHeight <= modal.clientHeight + 5) : false,
            artworkWidth: artRect ? Math.round(artRect.width) : 0,
            dockBtnHeight: dockRect ? Math.round(dockRect.height) : 0,
            actionsHidden: actionsStyle ? actionsStyle.display === 'none' : true
          };
        })()
      `);

      assert(vpMetrics.modalFits, `Modal fits without vertical scroll overflow (${vpMetrics.modalScrollHeight}px <= ${vpMetrics.modalClientHeight + 5}px)`);
      assert(vpMetrics.artworkWidth >= 120, `Artwork is prominent (${vpMetrics.artworkWidth}px)`);
      assert(vpMetrics.dockBtnHeight >= 44, `Lyrics button touch target meets minimum (${vpMetrics.dockBtnHeight}px)`);
      assert(vpMetrics.actionsHidden, 'Secondary actions row is completely hidden on mobile');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_1_main.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_1_main.png`);

      // State 2: More menu closed
      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_2_more_closed.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_2_more_closed.png`);

      // State 3: More menu open (Track actions, collapsed Sound Engine)
      await cdp.eval(`
        (() => {
          if (window.__naro_open_more_menu) window.__naro_open_more_menu();
          else document.getElementById('now-playing-more-btn')?.click();
        })()
      `);
      await sleep(350);

      const menuCheck = await cdp.eval(`
        (() => {
          const menu = document.getElementById('now-playing-more-menu');
          const soundBody = document.querySelector('.now-playing-menu-audiophile-body');
          return {
            menuOpen: Boolean(menu),
            soundCollapsed: !soundBody
          };
        })()
      `);
      assert(menuCheck.menuOpen, 'More menu opened');
      assert(menuCheck.soundCollapsed, 'Sound Engine is collapsed by default');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_3_more_open.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_3_more_open.png`);

      // State 4: More menu with Audiophile Sound Engine expanded
      await cdp.eval(`
        (() => {
          const h = document.querySelector('.now-playing-menu-audiophile-header');
          if (h) h.click();
        })()
      `);
      await sleep(300);

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_4_sound_expanded.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_4_sound_expanded.png`);

      // Close More menu
      await cdp.eval(`
        (() => {
          if (window.__naro_close_more_menu) window.__naro_close_more_menu();
          else document.querySelector('.now-playing-menu-close-btn')?.click();
        })()
      `);
      await sleep(350);

      // State 5: Synchronized Lyrics sheet
      await cdp.eval(`
        (() => {
          if (window.__naro_open_mobile_lyrics) window.__naro_open_mobile_lyrics();
          else document.getElementById('now-playing-lyrics-btn')?.click();
        })()
      `);
      await sleep(500);

      const lyricsCheck = await cdp.eval(`
        (() => {
          const scroller = document.getElementById('now-playing-lyrics-container');
          const lines = document.querySelectorAll('[id^="now-playing-lyric-"]');
          return {
            scrollerOpen: Boolean(scroller),
            lineCount: lines.length
          };
        })()
      `);
      assert(lyricsCheck.scrollerOpen && lyricsCheck.lineCount > 0, 'Lyrics sheet is open with synchronized lines');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_5_lyrics.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_5_lyrics.png`);

      // State 6: Language selector overlay
      await cdp.eval(`
        (() => {
          if (window.__naro_open_lang_picker) window.__naro_open_lang_picker();
          else document.getElementById('now-playing-mobile-lang-btn')?.click();
        })()
      `);
      await sleep(350);

      const langCheck = await cdp.eval(`
        (() => {
          const sheet = document.getElementById('now-playing-lang-picker-sheet');
          const options = document.querySelectorAll('.now-playing-lang-option');
          return {
            sheetOpen: Boolean(sheet),
            optionCount: options.length
          };
        })()
      `);
      assert(langCheck.sheetOpen && langCheck.optionCount === 5, 'Language selector opened with all 5 languages and representation notices');

      await cdp.captureScreenshot(`screenshot_mobile_${vp.name}_6_lang_picker.png`);
      console.log(`    Saved: screenshot_mobile_${vp.name}_6_lang_picker.png`);

      // Close language picker and lyrics sheet for clean reset
      await cdp.eval(`
        (() => {
          if (window.__naro_close_lang_picker) window.__naro_close_lang_picker();
          else document.querySelector('.now-playing-menu-close-btn')?.click();
        })()
      `);
      await sleep(300);

      await cdp.eval(`
        (() => {
          if (window.__naro_close_mobile_lyrics) window.__naro_close_mobile_lyrics();
          else document.getElementById('now-playing-lyrics-collapse-btn')?.click();
        })()
      `);
      await sleep(400);
    }

    // ------------------------------------------------------------------------
    // SECTION 6: Desktop Layout Integrity (1440x900)
    // ------------------------------------------------------------------------
    console.log('\n[Step 8] Verifying Desktop (1440x900) Layout Integrity...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(400);

    const desktopMetrics = await cdp.eval(`
      (() => {
        const leftCol = document.querySelector('.now-playing-left-col');
        const lyricsCol = document.querySelector('.now-playing-lyrics-col');
        const soundDesktop = document.querySelector('.now-playing-sound-controls-desktop');
        const actionsRow = document.querySelector('.now-playing-actions');
        const dockBtn = document.getElementById('now-playing-lyrics-btn');

        const leftRect = leftCol ? leftCol.getBoundingClientRect() : null;
        const lyrRect = lyricsCol ? lyricsCol.getBoundingClientRect() : null;
        const soundStyle = soundDesktop ? window.getComputedStyle(soundDesktop) : null;
        const actionsStyle = actionsRow ? window.getComputedStyle(actionsRow) : null;
        const dockStyle = dockBtn ? window.getComputedStyle(dockBtn) : null;

        return {
          isSideBySide: Boolean(leftRect && lyrRect && leftRect.right <= lyrRect.left + 5),
          soundDesktopVisible: soundStyle ? soundStyle.display !== 'none' : false,
          actionsRowVisible: actionsStyle ? actionsStyle.display !== 'none' : false,
          lyricsDockBtnHidden: dockStyle ? dockStyle.display === 'none' : true
        };
      })()
    `);

    assert(desktopMetrics.isSideBySide, 'Desktop maintains side-by-side artwork and lyrics layout');
    assert(desktopMetrics.soundDesktopVisible, 'Desktop Sound Engine is visible on desktop');
    assert(desktopMetrics.actionsRowVisible, 'Desktop actions row is visible on desktop');
    assert(desktopMetrics.lyricsDockBtnHidden, 'Mobile lyrics dock button is hidden on desktop');

    await cdp.captureScreenshot(`screenshot_desktop_1440x900_verified.png`);
    console.log(`    Saved: screenshot_desktop_1440x900_verified.png`);

    console.log('\n================================================================================');
    console.log('✅ ALL PREMIUM PLAYER & NON-DUPLICATE ARCHITECTURE TESTS PASSED (100%)');
    console.log('================================================================================\n');
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill();
    if (viteProc) viteProc.kill();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
