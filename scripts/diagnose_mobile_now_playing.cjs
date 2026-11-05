const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data.toString());
          if (raw.id && this.callbacks.has(raw.id)) {
            const cb = this.callbacks.get(raw.id);
            this.callbacks.delete(raw.id);
            cb(raw.result);
          }
        } catch {}
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value !== undefined ? res.result.value : res?.result?.description;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res?.data) {
      fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function findChromePath() {
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

async function runDiagnostics() {
  console.log('=== HyperMelo Mobile & Desktop Now Playing Diagnostics ===\n');

  const chromePath = await findChromePath();
  const cdpPort = 9255;
  const userDataDir = path.join(os.tmpdir(), `naro-diag-${Date.now()}`);

  const chromeProcess = spawn(chromePath, [
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
    let tabs = [];
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
      } catch {}
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab?.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome CDP');
    }

    const cdp = new CdpClient(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('[1] Waiting for App mount and dismissing intro...');
    for (let i = 0; i < 30; i++) {
      const isGone = await cdp.eval(`
        (() => {
          const skipBtn = document.querySelector('.intro-skip-btn');
          if (skipBtn) {
            skipBtn.click();
          }
          const intro = document.querySelector('.hypermelo-intro-container');
          return !intro;
        })()
      `);
      if (isGone) {
        console.log('Intro successfully dismissed and unmounted.');
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 600));

    // Play Kesariya with complete track metadata and expand Now Playing
    console.log('[2] Playing Kesariya and opening Now Playing...');
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const opened = await cdp.eval(`
        (() => {
          const win = window;
          if (win.__naro_play_song && win.__naro_open_now_playing) {
            const testSong = {
              id: 'tr-kesariya',
              title: 'Kesariya',
              artist: 'Arijit Singh, Pritam',
              album: 'Brahmastra',
              duration: 268,
              fullTrackDuration: 268,
              isStreamPreview: false,
              artwork: {
                palette: ['#F59E0B', '#1E293B', '#D97706', '#0F172A'],
                pattern: 'solaris',
                accentWarm: '#F59E0B',
                accentCool: '#1E293B',
                imageUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/9f/13/ca/9f13ca3b-e533-03e0-f19a-f0aaa774581d/196589311191.jpg/600x600bb.jpg'
              }
            };
            win.__naro_play_song(testSong, 0);
            win.__naro_open_now_playing();
            return Boolean(document.getElementById('naro-now-playing'));
          }
          return false;
        })()
      `);
      if (opened) break;
    }
    await new Promise((r) => setTimeout(r, 600));

    // Check if open
    const isOpen = await cdp.eval(`Boolean(document.getElementById('naro-now-playing'))`);
    console.log('NowPlaying is open in DOM:', isOpen);

    // Viewports to test
    const viewports = [
      { name: 'desktop_1440x900', width: 1440, height: 900, isMobile: false },
      { name: 'desktop_1920x1080', width: 1920, height: 1080, isMobile: false },
      { name: 'mobile_390x844', width: 390, height: 844, isMobile: true },
      { name: 'mobile_360x800', width: 360, height: 800, isMobile: true },
      { name: 'mobile_320x568', width: 320, height: 568, isMobile: true }
    ];

    for (const vp of viewports) {
      console.log(`\n--- Inspecting Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.isMobile
      });
      await cdp.send('Emulation.setVisibleSize', { width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 500));

      const domInspect = await cdp.eval(`
        (() => {
          const root = document.getElementById('naro-now-playing');
          if (!root) return { error: 'NowPlaying root not found' };

          const header = root.querySelector('.now-playing-header');
          const main = document.getElementById('now-playing-main');
          const leftCol = root.querySelector('.now-playing-left-col');
          const artworkWrap = document.getElementById('now-playing-artwork-container');
          const img = artworkWrap ? artworkWrap.querySelector('img') : null;
          const shimmer = artworkWrap ? artworkWrap.querySelector('.artwork-shimmer-bg') : null;
          const vinyl = artworkWrap ? artworkWrap.querySelector('.vinyl-record') : null;
          const metadata = root.querySelector('.now-playing-metadata');
          const title = document.getElementById('now-playing-title');
          const artist = document.getElementById('now-playing-artist');
          const actions = root.querySelector('.now-playing-actions');
          const soundSuite = document.getElementById('now-playing-audiophile-suite');
          const lyricsCol = root.querySelector('.now-playing-lyrics-col');
          const lyricsScroller = document.getElementById('now-playing-lyrics-container');
          const footer = root.querySelector('.now-playing-footer');

          const getBox = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
              height: Math.round(r.height),
              visible: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'
            };
          };

          const getComputed = (el, props) => {
            if (!el) return null;
            const cs = getComputedStyle(el);
            const res = {};
            for (const p of props) res[p] = cs.getPropertyValue(p);
            return res;
          };

          return {
            window: { w: window.innerWidth, h: window.innerHeight },
            mainScroll: main ? { scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight } : null,
            leftColScroll: leftCol ? { scrollTop: leftCol.scrollTop, scrollHeight: leftCol.scrollHeight, clientHeight: leftCol.clientHeight } : null,
            boxes: {
              header: getBox(header),
              main: getBox(main),
              leftCol: getBox(leftCol),
              artworkWrap: getBox(artworkWrap),
              img: getBox(img),
              metadata: getBox(metadata),
              title: getBox(title),
              artist: getBox(artist),
              actions: getBox(actions),
              soundSuite: getBox(soundSuite),
              lyricsCol: getBox(lyricsCol),
              lyricsScroller: getBox(lyricsScroller),
              footer: getBox(footer)
            },
            imgState: img ? {
              src: img.src?.substring(0, 80) + '...',
              complete: img.complete,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              currentSrc: img.currentSrc?.substring(0, 80) + '...'
            } : null,
            hasShimmer: !!shimmer,
            hasVinyl: !!vinyl,
            styles: {
              main: getComputed(main, ['display', 'flex-direction', 'overflow-y', 'padding']),
              leftCol: getComputed(leftCol, ['display', 'flex-direction', 'overflow-y', 'max-height', 'gap']),
              artworkWrap: getComputed(artworkWrap, ['width', 'height', 'aspect-ratio', 'display', 'border-radius', 'box-shadow'])
            }
          };
        })()
      `);

      console.log('DOM Inspection:', JSON.stringify(domInspect, null, 2));

      const screenshotFile = `screenshot_${vp.name}.png`;
      await cdp.captureScreenshot(screenshotFile);
    }

    console.log('\n=== Diagnostics complete ===');
  } catch (err) {
    console.error('Diagnostics failed:', err);
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

runDiagnostics();
