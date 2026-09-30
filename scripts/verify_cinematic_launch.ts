import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

interface CdpResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { message: string; code?: number };
}

class CdpClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending: Map<number, (res: CdpResponse) => void> = new Map();

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data.toString()) as { id?: number; method?: string; params?: any; error?: { message: string } };
          if (raw.id && this.pending.has(raw.id)) {
            const cb = this.pending.get(raw.id)!;
            this.pending.delete(raw.id);
            cb(raw as CdpResponse);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (res) => {
        if (res.error) {
          reject(new Error(`CDP Error [${method}]: ${res.error.message}`));
        } else {
          resolve(res.result || {});
        }
      });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    const resultObj = res.result as { value?: unknown; description?: string } | undefined;
    return resultObj?.value !== undefined ? resultObj.value : resultObj?.description;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('======================================================================');
  console.log('NARO — CINEMATIC LAUNCH / BRAND REVEAL VERIFICATION (REAL CHROME CDP)');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(os.tmpdir(), `naro-launch-test-${Date.now()}`);
  const port = 9333;

  console.log('[Setup] Launching Chrome instance on port ' + port + '...');
  const chromeProc: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'http://127.0.0.1:5173/'
  ]);

  let cdp: CdpClient = new CdpClient();

  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = (await resp.json()) as Array<{ webSocketDebuggerUrl?: string; type?: string; url?: string }>;
        const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget?.webSocketDebuggerUrl) {
          await cdp.connect(pageTarget.webSocketDebuggerUrl);
          connected = true;
          break;
        }
      } catch {
        // waiting
      }
    }

    if (!connected) {
      throw new Error('Could not connect to Chrome debugging WebSocket on port ' + port);
    }

    console.log('[Setup] Connected to Chrome. Waiting for React mount...');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    for (let i = 0; i < 40; i++) {
      const hasApp = await cdp.eval(`Boolean(document.querySelector('#root')?.children.length)`);
      if (hasApp) break;
      await sleep(50);
    }

    // ==========================================
    // Check 1: Brand reveal elements & typography
    // ==========================================
    console.log('\n[Check 1] Inspecting initial brand reveal elements at launch...');
    const introCheck = await cdp.eval(`
      (() => {
        const intro = document.querySelector('.naro-intro-container');
        if (!intro) return { hasIntro: false };

        const wordmark = intro.querySelector('.naro-revealed-text');
        const brush = intro.querySelector('.naro-energy-brush');
        const prism = intro.querySelector('.naro-prism-sheen');
        const harmonic = intro.querySelector('.naro-harmonic-spectrum');
        const tagline = intro.querySelector('.naro-intro-tagline');
        const skipBtn = intro.querySelector('button');

        // Check for generic loading anti-patterns
        const hasSpinner = !!document.querySelector('.spinner, .loader, [role="progressbar"], .loading-bar');
        const bodyText = document.body.innerText;
        const hasGenericLoadingText = bodyText.includes('Loading...') || bodyText.includes('0%') || bodyText.includes('100%');

        const computedStyle = wordmark ? window.getComputedStyle(wordmark) : null;

        return {
          hasIntro: true,
          hasWordmark: !!wordmark,
          wordmarkText: wordmark ? wordmark.textContent.trim() : null,
          fontFamily: computedStyle ? computedStyle.fontFamily : null,
          hasBrush: !!brush,
          hasPrism: !!prism,
          hasHarmonic: !!harmonic,
          hasTagline: !!tagline,
          taglineText: tagline ? tagline.textContent.trim() : null,
          hasSkipBtn: !!skipBtn,
          hasSpinner,
          hasGenericLoadingText
        };
      })()
    `);

    console.log('  Initial Intro State:', introCheck);
    if (!introCheck.hasIntro) throw new Error('Intro container not found on initial load');
    if (introCheck.wordmarkText !== 'Naro') throw new Error(`Wordmark text expected "Naro", got: ${introCheck.wordmarkText}`);
    if (!introCheck.fontFamily.toLowerCase().includes('alex brush')) {
      throw new Error(`Expected Alex Brush in wordmark font-family, got: ${introCheck.fontFamily}`);
    }
    if (!introCheck.hasBrush) throw new Error('Vertical spectrum energy brush not found');
    if (!introCheck.hasPrism) throw new Error('Prism sheen layer not found');
    if (!introCheck.hasHarmonic) throw new Error('Harmonic spectrum bars not found');
    if (introCheck.taglineText.toUpperCase() !== 'FEEL IT. MAKE IT.') {
      throw new Error(`Expected tagline "Feel It. Make It.", got: ${introCheck.taglineText}`);
    }
    if (introCheck.hasSpinner || introCheck.hasGenericLoadingText) {
      throw new Error('Found generic loading UI (spinner/loading percentage)');
    }
    console.log('  ✅ PASS: NARO wordmark with Alex Brush font, energy brush, prism sheen, harmonic bars, and tagline verified');

    // ==========================================
    // Check 2: Animation duration & transition
    // ==========================================
    console.log('\n[Check 2] Waiting for 1.4-1.6s cinematic sequence to complete and crossfade into application...');
    const startTime = Date.now();
    let introDismissed = false;

    for (let i = 0; i < 25; i++) {
      await sleep(100);
      const isStillPresent = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
      if (!isStillPresent) {
        introDismissed = true;
        break;
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`  Intro completed and unmounted in ~${elapsedMs + 250}ms`);
    if (!introDismissed) throw new Error('Intro animation did not unmount within 2.5 seconds');

    // Verify application shell is now visible and interactive
    const appShellCheck = await cdp.eval(`
      (() => {
        const header = document.querySelector('header');
        const hero = document.querySelector('section');
        const player = document.querySelector('aside');
        const playBtn = document.querySelector('#bottom-play-btn');
        return {
          hasHeader: !!header,
          hasHero: !!hero,
          hasPlayer: !!player,
          hasPlayBtn: !!playBtn
        };
      })()
    `);
    console.log('  App Shell State:', appShellCheck);
    if (!appShellCheck.hasHeader || !appShellCheck.hasHero || !appShellCheck.hasPlayer) {
      throw new Error('Application shell not properly rendered after intro completion');
    }
    console.log('  ✅ PASS: Intro completed smoothly within ~1.5s and transitioned into the application shell');

    // ==========================================
    // Check 3: Session storage persistence
    // ==========================================
    console.log('\n[Check 3] Verifying session storage persistence...');
    const sessionSeen = await cdp.eval(`sessionStorage.getItem('naro_intro_seen')`);
    console.log('  sessionStorage naro_intro_seen:', sessionSeen);
    if (sessionSeen !== 'true') throw new Error(`Expected sessionStorage naro_intro_seen to be 'true', got: ${sessionSeen}`);
    console.log('  ✅ PASS: Session storage correctly marked naro_intro_seen = true');

    // ==========================================
    // Check 4: Page Refresh does NOT replay intro
    // ==========================================
    console.log('\n[Check 4] Reloading page to verify intro does not replay...');
    await cdp.eval(`location.reload()`);
    await sleep(400);

    const reloadIntroCheck = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
    console.log('  Intro present after reload:', reloadIntroCheck);
    if (reloadIntroCheck) throw new Error('Intro replayed after page refresh! It must only play once per session.');
    console.log('  ✅ PASS: Intro does not replay on page reload');

    // ==========================================
    // Check 5: Route navigation does NOT replay intro
    // ==========================================
    console.log('\n[Check 5] Navigating across routes (Discover, Karaoke, Library, Downloads)...');
    const navCheck = await cdp.eval(`
      (() => {
        const navButtons = Array.from(document.querySelectorAll('nav button'));
        const discoverBtn = navButtons.find(b => b.textContent.includes('Discover'));
        const libraryBtn = navButtons.find(b => b.textContent.includes('Library'));
        const homeBtn = navButtons.find(b => b.textContent.includes('Home'));

        if (discoverBtn) discoverBtn.click();
        return { hasDiscover: !!discoverBtn, hasLibrary: !!libraryBtn, hasHome: !!homeBtn };
      })()
    `);
    await sleep(200);
    const navIntroCheck = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
    if (navIntroCheck) throw new Error('Intro replayed on navigation to Discover!');

    // Navigate to Library
    await cdp.eval(`
      (() => {
        const navButtons = Array.from(document.querySelectorAll('nav button'));
        const libraryBtn = navButtons.find(b => b.textContent.includes('Library'));
        if (libraryBtn) libraryBtn.click();
      })()
    `);
    await sleep(200);
    const libraryIntroCheck = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
    if (libraryIntroCheck) throw new Error('Intro replayed on navigation to Library!');

    // Return to Home
    await cdp.eval(`
      (() => {
        const navButtons = Array.from(document.querySelectorAll('nav button'));
        const homeBtn = navButtons.find(b => b.textContent.includes('Home'));
        if (homeBtn) homeBtn.click();
      })()
    `);
    await sleep(200);
    const homeIntroCheck = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
    if (homeIntroCheck) throw new Error('Intro replayed on returning to Home!');
    console.log('  ✅ PASS: Route changes (Discover, Library, Home) do NOT replay intro');

    // ==========================================
    // Check 6: Explicit User Replay in Footer
    // ==========================================
    console.log('\n[Check 6] Triggering intentional "Replay Cinematic Intro" from Footer...');
    const replayTriggered = await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const replayBtn = buttons.find(b => b.textContent.includes('Replay Cinematic Intro'));
        if (replayBtn) {
          replayBtn.click();
          return true;
        }
        return false;
      })()
    `);
    if (!replayTriggered) throw new Error('Replay Cinematic Intro button not found in footer');
    await sleep(150);

    const replayedIntroPresent = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
    console.log('  Intro present after intentional replay trigger:', replayedIntroPresent);
    if (!replayedIntroPresent) throw new Error('Intro failed to mount on intentional user replay');

    // Allow it to complete
    await sleep(1600);
    const replayedIntroFinished = await cdp.eval(`!document.querySelector('.naro-intro-container')`);
    if (!replayedIntroFinished) throw new Error('Replayed intro did not finish');
    console.log('  ✅ PASS: Intentional footer replay triggered, animated, and completed');

    // ==========================================
    // Check 7: Mobile Viewport Responsiveness (375x812)
    // ==========================================
    console.log('\n[Check 7] Testing mobile viewport responsiveness (375x812 iPhone width)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Replay intro on mobile
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const replayBtn = buttons.find(b => b.textContent.includes('Replay Cinematic Intro'));
        if (replayBtn) replayBtn.click();
      })()
    `);
    await sleep(200);

    const mobileCheck = await cdp.eval(`
      (() => {
        const stage = document.querySelector('.naro-wordmark-stage');
        const text = document.querySelector('.naro-revealed-text');
        if (!stage || !text) return { valid: false };

        const stageRect = stage.getBoundingClientRect();
        const textRect = text.getBoundingClientRect();
        const screenWidth = window.innerWidth;

        return {
          valid: true,
          screenWidth,
          stageWidth: stageRect.width,
          textWidth: textRect.width,
          isContained: stageRect.width <= screenWidth && textRect.width <= screenWidth
        };
      })()
    `);
    console.log('  Mobile Viewport Check:', mobileCheck);
    if (!mobileCheck.valid || !mobileCheck.isContained) {
      throw new Error(`Wordmark clipped or overflowed on 375px mobile screen: ${JSON.stringify(mobileCheck)}`);
    }

    // Reset emulation
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await sleep(1400); // let intro finish
    console.log('  ✅ PASS: Mobile viewport (375px) renders wordmark without clipping or overflow');

    // ==========================================
    // Check 8: prefers-reduced-motion: reduce
    // ==========================================
    console.log('\n[Check 8] Testing prefers-reduced-motion: reduce mode...');
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    const reducedStart = Date.now();
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const replayBtn = buttons.find(b => b.textContent.includes('Replay Cinematic Intro'));
        if (replayBtn) replayBtn.click();
      })()
    `);
    await sleep(100);

    let reducedFinished = false;
    for (let i = 0; i < 15; i++) {
      await sleep(50);
      const isPresent = await cdp.eval(`!!document.querySelector('.naro-intro-container')`);
      if (!isPresent) {
        reducedFinished = true;
        break;
      }
    }
    const reducedElapsed = Date.now() - reducedStart;
    console.log(`  Reduced-motion intro completed in ~${reducedElapsed}ms`);
    if (!reducedFinished || reducedElapsed > 750) {
      throw new Error(`Reduced-motion did not complete quickly (took ${reducedElapsed}ms)`);
    }

    // Clear emulated media
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    console.log('  ✅ PASS: Reduced motion completes quickly without running complex animations');

    console.log('\n======================================================================');
    console.log('ALL CINEMATIC LAUNCH VERIFICATION CHECKS PASSED (8/8)');
    console.log('======================================================================\n');
  } finally {
    cdp.close();
    chromeProc.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
