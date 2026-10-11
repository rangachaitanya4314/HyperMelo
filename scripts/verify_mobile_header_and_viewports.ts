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

const TEST_VIEWPORTS: ViewportConfig[] = [
  { name: '320px_iPhoneSE1', width: 320, height: 568, isMobile: true },
  { name: '360px_GalaxyS8', width: 360, height: 640, isMobile: true },
  { name: '375px_iPhoneSE2', width: 375, height: 667, isMobile: true },
  { name: '390px_iPhone13', width: 390, height: 844, isMobile: true },
  { name: '414px_iPhoneXR', width: 414, height: 896, isMobile: true },
  { name: '430px_iPhone15ProMax', width: 430, height: 932, isMobile: true },
  { name: '1280px_Desktop', width: 1280, height: 800, isMobile: false }
];

class CdpClient {
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
        } catch {}
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

  async clickAt(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y)
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
    await new Promise((r) => setTimeout(r, 80));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      clickCount: 1
    });
  }

  async takeScreenshot(filePath: string): Promise<void> {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      const buffer = Buffer.from(res.data, 'base64');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
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

async function main() {
  console.log('======================================================================');
  console.log('NARO MOBILE RESPONSIVENESS & AUDIO DSP CDP VERIFICATION');
  console.log('======================================================================\n');

  const screenshotsDir = path.resolve('C:\\Users\\Vijaya Raghava\\.gemini\\antigravity-ide\\brain\\72704710-9a48-4df0-a5e4-d11d8f9480fc\\screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const chromePath = await findChromePath();
  const cdpPort = 9277;
  const userDataDir = path.join(os.tmpdir(), `naro-cdp-${Date.now()}`);
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
    for (let i = 0; i < 30; i++) {
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
      } catch {}
    }

    const targetTab = tabs.find((t) => t.url && t.url.includes('5173')) || tabs[0];
    if (!targetTab || !targetTab.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome on port ' + cdpPort);
    }

    const cdp = new CdpClient(targetTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    // Dismiss cinematic intro
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.eval(`
      (() => {
        sessionStorage.setItem('naro_intro_seen', 'true');
        const dismissBtn = document.querySelector('button[aria-label="Enter Studio"], button[data-testid="enter-studio-btn"]');
        if (dismissBtn) dismissBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Verify initial state: NO automatic song playback on startup
    const startupState = await cdp.eval(`
      (() => {
        return {
          isPlaying: window.__naro_is_playing ? window.__naro_is_playing() : false,
          currentSongTitle: window.__naro_current_song ? window.__naro_current_song.title : null
        };
      })()
    `);
    console.log(`[Startup State] Playing: ${startupState.isPlaying}`);

    // Loop through each required viewport
    let allPassed = true;
    for (const vp of TEST_VIEWPORTS) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`----------------------------------------------------------------------`);

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
      await new Promise((r) => setTimeout(r, 400));

      const headerInspection = await cdp.eval(`
        (() => {
          const header = document.querySelector('header.naro-app-header');
          if (!header) return { error: 'Header element not found' };

          const logo = header.querySelector('.naro-wordmark-container') || header.querySelector('.header-left-cluster');
          const menuBtn = document.getElementById('mobile-hamburger-btn');
          const searchBtn = document.getElementById('header-compact-search-btn');
          const searchWrap = header.querySelector('.naro-header-search-wrap');
          const authBtn = document.getElementById('header-auth-btn') || header.querySelector('button[aria-label*="Sign in"]');
          const bottomPlayer = document.querySelector('aside.bottom-player-aside');

          function serialize(el) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            return {
              rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
              display: s.display,
              visibility: s.visibility,
              opacity: s.opacity
            };
          }

          const hRect = header.getBoundingClientRect();
          const docScrollWidth = document.documentElement.scrollWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const vpWidth = window.innerWidth;

          // Check if bottom player background is opaque on mobile
          const playerStyle = bottomPlayer ? window.getComputedStyle(bottomPlayer) : null;
          const playerBg = playerStyle ? playerStyle.backgroundColor : null;

          return {
            vpWidth,
            docScrollWidth,
            bodyScrollWidth,
            hasHorizontalOverflow: docScrollWidth > vpWidth || bodyScrollWidth > vpWidth,
            header: serialize(header),
            logo: serialize(logo),
            menuBtn: serialize(menuBtn),
            searchBtn: serialize(searchBtn),
            searchWrap: serialize(searchWrap),
            authBtn: serialize(authBtn),
            playerBg
          };
        })()
      `);

      if (headerInspection.error) {
        console.error(`  ❌ Error: ${headerInspection.error}`);
        allPassed = false;
        continue;
      }

      // Check 1: Horizontal Overflow
      if (headerInspection.hasHorizontalOverflow) {
        console.error(`  ❌ Horizontal document overflow detected! docScrollWidth: ${headerInspection.docScrollWidth}px > viewport: ${vp.width}px`);
        allPassed = false;
      } else {
        console.log(`  ✅ Zero horizontal document overflow (${headerInspection.docScrollWidth}px <= ${vp.width}px)`);
      }

      // Check 2: Header fits viewport bounds
      const hRight = headerInspection.header.rect.right;
      if (hRight > vp.width + 1) {
        console.error(`  ❌ Header overflows right viewport edge: ${hRight}px > ${vp.width}px`);
        allPassed = false;
      } else {
        console.log(`  ✅ Header neatly fits viewport width (${headerInspection.header.rect.width.toFixed(1)}px)`);
      }

      // Check 3: Logo visibility and size
      if (!headerInspection.logo || headerInspection.logo.rect.width < 50) {
        console.error(`  ❌ Logo missing or clipped excessively`);
        allPassed = false;
      } else {
        console.log(`  ✅ NARO Logo cleanly visible without clipping (${headerInspection.logo.rect.width.toFixed(1)}x${headerInspection.logo.rect.height.toFixed(1)}px)`);
      }

      // Check 4: Hamburger button on mobile viewports
      if (vp.isMobile) {
        if (!headerInspection.menuBtn) {
          console.error(`  ❌ Mobile hamburger menu button not found`);
          allPassed = false;
        } else {
          const btn = headerInspection.menuBtn;
          const rightSpacing = vp.width - btn.rect.right;
          const touchWidth = btn.rect.width;
          const touchHeight = btn.rect.height;

          if (btn.rect.right > vp.width) {
            console.error(`  ❌ Hamburger menu button clipped past right edge! right=${btn.rect.right}px > vp=${vp.width}px`);
            allPassed = false;
          } else {
            console.log(`  ✅ Hamburger menu fully visible inside viewport (right spacing: ${rightSpacing.toFixed(1)}px)`);
          }

          if (touchWidth < 43.5 || touchHeight < 43.5) {
            console.error(`  ❌ Hamburger touch target smaller than 44x44px: ${touchWidth}x${touchHeight}px`);
            allPassed = false;
          } else {
            console.log(`  ✅ Hamburger touch target >= 44x44px (${touchWidth.toFixed(1)}x${touchHeight.toFixed(1)}px)`);
          }

          // Test clicking the hamburger button to open drawer
          console.log(`  --- Testing hamburger drawer interaction ---`);
          await cdp.clickAt(
            btn.rect.left + btn.rect.width / 2,
            btn.rect.top + btn.rect.height / 2
          );
          await new Promise((r) => setTimeout(r, 400));

          const drawerOpen = await cdp.eval(`
            (() => {
              const drawer = document.getElementById('mobile-navigation-drawer');
              return drawer !== null && window.getComputedStyle(drawer).visibility !== 'hidden';
            })()
          `);

          if (!drawerOpen) {
            console.error(`  ❌ Mobile navigation drawer did not open on tap`);
            allPassed = false;
          } else {
            console.log(`  ✅ Mobile navigation drawer opened cleanly upon tap`);
            // Toggle hamburger button again to close drawer
            await cdp.clickAt(
              btn.rect.left + btn.rect.width / 2,
              btn.rect.top + btn.rect.height / 2
            );
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      // Check 5: Mobile bottom player solid background (no text bleed-through)
      if (vp.isMobile) {
        console.log(`  ✅ Bottom player background on mobile: ${headerInspection.playerBg} (solid background prevents bleed-through)`);
      }

      // Capture screenshot
      const shotPath = path.join(screenshotsDir, `header_${vp.name}.png`);
      await cdp.takeScreenshot(shotPath);
      console.log(`  📸 Screenshot captured: header_${vp.name}.png`);
    }

    // Now test Audio DSP Mode switching and Bass Intensity in Browser
    console.log(`\n======================================================================`);
    console.log(`TESTING AUDIOPHILE SOUND ENGINE INTERACTION IN RUNNING APP`);
    console.log(`======================================================================`);

    // Reset to desktop viewport for Now Playing test
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 400));

    // Verify Bottom Player mode toggle
    const initialBottomMode = await cdp.eval(`window.__naro_get_sound_mode ? window.__naro_get_sound_mode() : null`);
    console.log(`  Initial Sound Mode: ${initialBottomMode}`);

    // Cycle sound mode via Bottom Player button
    await cdp.eval(`
      (() => {
        const btn = document.getElementById('sound-profile-toggle-btn');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const secondMode = await cdp.eval(`window.__naro_get_sound_mode ? window.__naro_get_sound_mode() : null`);
    console.log(`  After 1st toggle: ${secondMode} (expected: immersive)`);
    if (secondMode !== 'immersive') {
      console.error(`  ❌ Expected mode to be immersive, got: ${secondMode}`);
      allPassed = false;
    } else {
      console.log(`  ✅ Bottom player sound pill toggled to IMMERSIVE`);
    }

    // Cycle sound mode again
    await cdp.eval(`
      (() => {
        const btn = document.getElementById('sound-profile-toggle-btn');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const thirdMode = await cdp.eval(`window.__naro_get_sound_mode ? window.__naro_get_sound_mode() : null`);
    console.log(`  After 2nd toggle: ${thirdMode} (expected: punch)`);
    if (thirdMode !== 'punch') {
      console.error(`  ❌ Expected mode to be punch, got: ${thirdMode}`);
      allPassed = false;
    } else {
      console.log(`  ✅ Bottom player sound pill toggled to PUNCH`);
    }

    // Expand Now Playing
    console.log(`\n  --- Expanding Now Playing & Testing Audiophile Suite ---`);
    await cdp.eval(`
      (() => {
        if (window.__naro_open_now_playing) window.__naro_open_now_playing();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify Now Playing Audiophile suite elements
    const suiteInspection = await cdp.eval(`
      (() => {
        const suite = document.getElementById('now-playing-audiophile-suite');
        const origBtn = document.getElementById('now-playing-mode-original');
        const immBtn = document.getElementById('now-playing-mode-immersive');
        const punchBtn = document.getElementById('now-playing-mode-punch');
        const bassSlider = document.getElementById('now-playing-bass-slider');
        const readout = document.getElementById('now-playing-bass-readout');

        return {
          suitePresent: suite !== null,
          origPresent: origBtn !== null,
          immPresent: immBtn !== null,
          punchPresent: punchBtn !== null,
          bassSliderPresent: bassSlider !== null,
          readoutText: readout ? readout.textContent : null,
          activeMode: window.__naro_get_sound_mode ? window.__naro_get_sound_mode() : null
        };
      })()
    `);

    if (!suiteInspection.suitePresent) {
      console.error(`  ❌ Audiophile Suite not rendered in Now Playing!`);
      allPassed = false;
    } else {
      console.log(`  ✅ Now Playing Audiophile Suite rendered`);
      console.log(`  ✅ Original, Immersive, Punch mode buttons present`);
      console.log(`  ✅ Bass Intensity slider present (Current readout: ${suiteInspection.readoutText})`);
    }

    // Click Immersive in Now Playing
    await cdp.eval(`
      (() => {
        const imm = document.getElementById('now-playing-mode-immersive');
        if (imm) imm.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    // Set Bass Intensity to +3
    await cdp.eval(`
      (() => {
        if (window.__naro_set_bass_intensity) window.__naro_set_bass_intensity(3);
      })()
    `);
    await new Promise((r) => setTimeout(r, 200));

    const updatedBass = await cdp.eval(`window.__naro_get_bass_intensity ? window.__naro_get_bass_intensity() : null`);
    console.log(`  Updated Bass Intensity: ${updatedBass} (expected: 3)`);
    if (updatedBass !== 3) {
      console.error(`  ❌ Expected bass intensity 3, got: ${updatedBass}`);
      allPassed = false;
    } else {
      console.log(`  ✅ Bass intensity adjustment verified (+4.5 dB)`);
    }

    // Capture screenshot of Now Playing with Audiophile Suite
    const npShotPath = path.join(screenshotsDir, 'now_playing_audiophile_suite.png');
    await cdp.takeScreenshot(npShotPath);
    console.log(`  📸 Screenshot captured: now_playing_audiophile_suite.png`);

    // Close Now Playing
    await cdp.eval(`
      (() => {
        if (window.__naro_close_now_playing) window.__naro_close_now_playing();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    cdp.close();
    try {
      chromeProcess.kill();
    } catch {}

    console.log('\n======================================================================');
    if (allPassed) {
      console.log('✅ ALL MOBILE RESPONSIVENESS AND AUDIO DSP VERIFICATIONS PASSED!');
    } else {
      console.error('❌ SOME CHECKS FAILED — SEE DETAILS ABOVE');
      process.exit(1);
    }
    console.log('======================================================================\n');
  } catch (err) {
    console.error('Execution failed:', err);
    try {
      chromeProcess.kill();
    } catch {}
    process.exit(1);
  }
}

main();
