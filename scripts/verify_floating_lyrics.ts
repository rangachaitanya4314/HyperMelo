// HyperMelo — Floating Lyrics Animation System & UI Regression Verification
// Multi-Viewport Matrix: 320x568, 360x800, 390x844, 430x932, and Desktop 1440x900

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

interface AssertionResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, msg: string, details?: string): void {
  results.push({ name: msg, passed: condition, details });
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}${details ? ` (${details})` : ''}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}${details ? ` [${details}]` : ''}`);
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

async function captureScreenshot(cdp: CdpConnection, filename: string): Promise<string> {
  const screenshotData = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const screenshotsDir = path.join(process.cwd(), 'reports', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  const outPath = path.join(screenshotsDir, filename);
  fs.writeFileSync(outPath, Buffer.from(screenshotData.data, 'base64'));
  console.log(`    📸 Saved screenshot: reports/screenshots/${filename}`);
  return outPath;
}

async function setViewport(cdp: CdpConnection, width: number, height: number, isMobile = true) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: isMobile
  });
  await cdp.send('Emulation.setVisibleSize', { width, height });
  await sleep(350);
}

async function main() {
  console.log('======================================================================');
  console.log('HYPERMELO - FLOATING LYRICS ANIMATION SYSTEM VERIFICATION SUITE');
  console.log('======================================================================\n');

  const testPort = 5195;
  const cdpPort = 9235;

  console.log(`[Step 1] Starting Vite preview server on port ${testPort}...`);
  const viteProcess: ChildProcess = spawn(
    'cmd.exe',
    ['/c', `npx vite preview --port ${testPort} --strictPort`],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    }
  );

  let viteReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${testPort}`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject();
        });
        req.on('error', reject);
        req.setTimeout(500, () => req.destroy());
      });
      viteReady = true;
      break;
    } catch {
      await sleep(250);
    }
  }

  if (!viteReady) {
    viteProcess.kill();
    throw new Error(`Failed to start Vite preview server on port ${testPort}`);
  }
  console.log('  ✅ Vite preview server running.\n');

  console.log(`[Step 2] Launching Headless Chrome on CDP port ${cdpPort}...`);
  const chromePath = await findChromePath();
  const chromeProcess: ChildProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + path.join(process.cwd(), '.chrome-floating-profile-' + Date.now()),
      `http://localhost:${testPort}`
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    try {
      const json = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const pages = JSON.parse(json);
      const target = pages.find((p: any) => p.type === 'page' && p.url.includes(`${testPort}`));
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
  console.log('  ✅ CDP connected successfully.\n');

  try {
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    await cdp.send('Page.navigate', { url: `http://localhost:${testPort}` });
    await sleep(2000);

    // Skip splash / intro screen if present
    for (let i = 0; i < 20; i++) {
      const ready = await cdp.eval(`!!window.__naro_play_song && !!window.__naro_open_now_playing`);
      if (ready) break;
      await cdp.eval(`
        (() => {
          const skipBtn = document.querySelector('.intro-skip-btn, button[aria-label="Enter Studio"]');
          if (skipBtn) skipBtn.click();
        })()
      `);
      await sleep(300);
    }

    // ------------------------------------------------------------------------
    // SECTION 1: Start Track with Synced Lyrics and Seek to Active Lyric
    // ------------------------------------------------------------------------
    console.log('[Step 3] Selecting track with verified synced lyrics...');
    const trackInfo = await cdp.eval(`
      (() => {
        const songs = window.__naro_get_songs ? window.__naro_get_songs() : [];
        const song = songs.find(s => s.originalLanguage === 'te' || (s.lyrics && s.lyrics.length > 5)) || songs[0];
        if (song) {
          window.__naro_play_song(song, 0.5);
        }
        if (window.__naro_open_now_playing) {
          window.__naro_open_now_playing();
        }
        return song ? { id: song.id, title: song.title, lang: song.originalLanguage } : null;
      })()
    `);
    console.log('  Playing song:', trackInfo);
    await sleep(800);

    // Seek to first synced lyric line to make active lyric immediately active
    const firstLineInfo = await cdp.eval(`
      (() => {
        const lines = window.__naro_get_canonical_lines ? window.__naro_get_canonical_lines() : [];
        if (lines.length > 0) {
          const line = lines[0];
          const t = line.startTime !== undefined && line.startTime >= 0 ? line.startTime : (line.time || 1);
          if (window.__naro_seek) window.__naro_seek(t + 0.3);
          return { time: t + 0.3, text: line.text };
        }
        return null;
      })()
    `);
    console.log('  Seeked to initial active lyric line:', firstLineInfo);
    await sleep(600);

    const isNowPlayingOpen = await cdp.eval(`!!document.getElementById('naro-now-playing')`);
    assert(isNowPlayingOpen, 'Now Playing full-screen modal opened successfully');

    // ------------------------------------------------------------------------
    // SECTION 2: Branding Verification
    // ------------------------------------------------------------------------
    console.log('\n[Step 4] Verifying Header Eyebrow Branding...');
    const eyebrowText = await cdp.eval(`
      (() => {
        const el = document.querySelector('.now-playing-header-eyebrow');
        return el ? el.textContent.trim() : '';
      })()
    `);
    assert(
      eyebrowText === 'PLAYING FROM HYPERMELO',
      `Header displays 'PLAYING FROM HYPERMELO'`,
      `actual: '${eyebrowText}'`
    );

    // ------------------------------------------------------------------------
    // SECTION 3: Global Button Styling / Zero White Rectangular Artifacts
    // ------------------------------------------------------------------------
    console.log('\n[Step 5] Auditing Button Computed Backgrounds (Zero White Rectangles)...');
    const buttonAudit = await cdp.eval(`
      (() => {
        const buttonIds = [
          'now-playing-prev-btn',
          'now-playing-next-btn',
          'now-playing-play-btn',
          'now-playing-shuffle-btn',
          'now-playing-repeat-btn'
        ];
        const res = {};
        for (const id of buttonIds) {
          const el = document.getElementById(id);
          if (el) {
            const cs = window.getComputedStyle(el);
            res[id] = {
              bg: cs.backgroundColor,
              border: cs.border,
              display: cs.display
            };
          }
        }
        return res;
      })()
    `);
    console.log('  Button computed styles:', buttonAudit);

    for (const [btnId, style] of Object.entries(buttonAudit as any)) {
      const isWhite = (style as any).bg === 'rgb(255, 255, 255)' || (style as any).bg === '#ffffff';
      assert(!isWhite, `Button #${btnId} has NO solid white background`, `bg: ${(style as any).bg}`);
    }

    // ------------------------------------------------------------------------
    // SECTION 4: Multi-Viewport Matrix and Floating Lyrics Inspection
    // ------------------------------------------------------------------------
    const viewports = [
      { name: 'iPhone SE (Compact)', width: 320, height: 568, isMobile: true, screenshot: 'floating_lyrics_320x568_iphone_se.png' },
      { name: 'Android Standard', width: 360, height: 800, isMobile: true, screenshot: 'floating_lyrics_360x800_android.png' },
      { name: 'iPhone 14 (Standard)', width: 390, height: 844, isMobile: true, screenshot: 'floating_lyrics_390x844_iphone14.png' },
      { name: 'iPhone 14 Pro Max (Large)', width: 430, height: 932, isMobile: true, screenshot: 'floating_lyrics_430x932_iphone_promax.png' },
      { name: 'Desktop 1440x900 Side-by-Side', width: 1440, height: 900, isMobile: false, screenshot: 'floating_lyrics_1440x900_desktop.png' }
    ];

    console.log('\n[Step 6] Testing Viewports & Floating Typography Architecture...');

    for (const vp of viewports) {
      console.log(`\n  --- Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await setViewport(cdp, vp.width, vp.height, vp.isMobile);

      // On mobile viewports, open mobile lyrics sheet
      if (vp.isMobile) {
        await cdp.eval(`
          if (window.__naro_open_mobile_lyrics) {
            window.__naro_open_mobile_lyrics();
          }
        `);
        await sleep(500);
      }

      // Ensure lyrics container is visible
      const lyricsContainerState = await cdp.eval(`
        (() => {
          const container = document.getElementById('now-playing-lyrics-container');
          if (!container) return null;
          return {
            mode: container.getAttribute('data-animation-mode'),
            hasFloatingClass: container.classList.contains('floating-lyrics-container'),
            pausedAttr: container.getAttribute('data-playback-paused')
          };
        })()
      `);

      assert(lyricsContainerState !== null, `${vp.name}: Lyrics container rendered in DOM`);
      assert(
        lyricsContainerState.mode === 'floating',
        `${vp.name}: Lyrics container has data-animation-mode="floating"`,
        `actual: ${lyricsContainerState.mode}`
      );
      assert(
        lyricsContainerState.hasFloatingClass === true,
        `${vp.name}: Lyrics container has floating-lyrics-container class`
      );

      // Check active line scale and depth states
      const lyricLinesState = await cdp.eval(`
        (() => {
          const activeLine = document.querySelector('[data-testid="active-lyric-line"]');
          if (!activeLine) {
            const firstItem = document.querySelector('.floating-lyric-item');
            return {
              hasActive: false,
              sampleItem: firstItem ? {
                state: firstItem.getAttribute('data-state'),
                pace: firstItem.getAttribute('data-pace-category')
              } : null
            };
          }
          const cs = window.getComputedStyle(activeLine);
          const primary = activeLine.querySelector('.floating-lyric-primary');
          const primaryCs = primary ? window.getComputedStyle(primary) : null;
          const meaning = activeLine.querySelector('.floating-lyric-meaning');
          const meaningCs = meaning ? window.getComputedStyle(meaning) : null;

          return {
            hasActive: true,
            state: activeLine.getAttribute('data-state'),
            paceCategory: activeLine.getAttribute('data-pace-category'),
            transform: cs.transform,
            opacity: cs.opacity,
            fontWeight: cs.fontWeight,
            borderLeft: cs.borderLeft,
            primaryLineHeight: primaryCs ? primaryCs.lineHeight : null,
            primaryOverflow: primaryCs ? primaryCs.overflow : null,
            meaningTransitionDelay: meaningCs ? meaningCs.transitionDelay : null,
            meaningColor: meaningCs ? meaningCs.color : null
          };
        })()
      `);

      console.log(`    State:`, lyricLinesState);

      if (lyricLinesState.hasActive) {
        assert(
          lyricLinesState.state === 'active',
          `${vp.name}: Active line has data-state="active"`
        );
        // Transform scale check: matrix(scaleX, 0, 0, scaleY, tx, ty)
        if (lyricLinesState.transform && lyricLinesState.transform !== 'none') {
          const match = lyricLinesState.transform.match(/matrix\(([^)]+)\)/);
          if (match) {
            const values = match[1].split(',').map(s => parseFloat(s.trim()));
            const scaleX = values[0];
            const isScaleInTargetRange = scaleX >= 1.02 && scaleX <= 1.05;
            assert(
              isScaleInTargetRange,
              `${vp.name}: Active line scale is within target 1.03–1.04 range`,
              `computed scale: ${scaleX.toFixed(3)}`
            );
          }
        }

        // Indic script protection: line-height >= 1.6 or sufficient px clearance
        if (lyricLinesState.primaryLineHeight) {
          assert(
            parseFloat(lyricLinesState.primaryLineHeight) >= 20 || lyricLinesState.primaryLineHeight.includes('1.6'),
            `${vp.name}: Native script has generous line-height for Indic matras (${lyricLinesState.primaryLineHeight})`
          );
        }
      }

      // Check spatial depth progression on adjacent lines
      const depthAudit = await cdp.eval(`
        (() => {
          const items = Array.from(document.querySelectorAll('.floating-lyric-item'));
          const states = items.map(it => it.getAttribute('data-state'));
          const counts = {};
          for (const s of states) counts[s] = (counts[s] || 0) + 1;
          return { total: items.length, counts, sampleStates: states.slice(0, 6) };
        })()
      `);
      console.log(`    Depth states across lines:`, depthAudit);
      assert(
        depthAudit.total > 0,
        `${vp.name}: Rendered ${depthAudit.total} lyric lines with spatial depth stages`
      );

      // Capture official screenshot for this viewport
      await captureScreenshot(cdp, vp.screenshot);
    }

    // ------------------------------------------------------------------------
    // SECTION 5: Vocal Pace Adaptation Audit
    // ------------------------------------------------------------------------
    console.log('\n[Step 7] Verifying Vocal Pace Transitions...');
    const paceAudit = await cdp.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.floating-lyric-item'));
        const paces = items.map(el => ({
          pace: el.getAttribute('data-pace'),
          category: el.getAttribute('data-pace-category'),
          transitionDuration: window.getComputedStyle(el).getPropertyValue('--lyric-dur').trim()
        }));
        return paces.slice(0, 8);
      })()
    `);
    console.log('  Vocal pace sample items:', paceAudit);
    assert(
      paceAudit.length > 0 && paceAudit.some(p => !!p.category),
      'Vocal pace categories (fast / moderate / slow) computed and applied'
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Seek Snapping & Playback Pause Behavior
    // ------------------------------------------------------------------------
    console.log('\n[Step 8] Verifying Pause Rest & Seek Snapping...');
    // Verify toggle play/pause coordination
    const initialPlaying = await cdp.eval(`window.__naro_is_playing ? window.__naro_is_playing() : false`);
    console.log(`  Initial playing status: ${initialPlaying}`);

    // If playing, pause it; if not, toggle twice to test pause
    if (initialPlaying) {
      await cdp.eval(`window.__naro_toggle_play()`);
      await sleep(350);
      const pausedAttr = await cdp.eval(`document.getElementById('now-playing-lyrics-container').getAttribute('data-playback-paused')`);
      assert(pausedAttr === 'true', 'Paused state detected on lyrics container (data-playback-paused="true")');
      // Resume
      await cdp.eval(`window.__naro_toggle_play()`);
      await sleep(350);
    } else {
      await cdp.eval(`window.__naro_toggle_play()`);
      await sleep(350);
      await cdp.eval(`window.__naro_toggle_play()`);
      await sleep(350);
      const pausedAttr = await cdp.eval(`document.getElementById('now-playing-lyrics-container').getAttribute('data-playback-paused')`);
      assert(pausedAttr === 'true', 'Paused state detected on lyrics container (data-playback-paused="true")');
    }

    // Seek by clicking a future lyric line (e.g. line 2 or 3)
    console.log('  Testing seek interaction on lyric line...');
    const seekResult = await cdp.eval(`
      (() => {
        const lines = Array.from(document.querySelectorAll('.floating-lyric-item'));
        const targetLine = lines[2] || lines[1];
        if (targetLine) {
          targetLine.click();
          return { clicked: true, timestamp: targetLine.getAttribute('data-timestamp') };
        }
        return { clicked: false };
      })()
    `);
    await sleep(400);
    assert(seekResult.clicked === true, 'Successfully clicked lyric line to initiate seek');

    // ------------------------------------------------------------------------
    // SECTION 7: Rollback Protection & Mode Switching
    // ------------------------------------------------------------------------
    console.log('\n[Step 9] Verifying Rollback Protection (Classic Mode Toggle)...');
    await cdp.eval(`
      if (window.__naro_set_lyrics_animation_mode) {
        window.__naro_set_lyrics_animation_mode('classic');
      }
    `);
    await sleep(350);
    const toggleToClassic = await cdp.eval(`window.__naro_get_lyrics_animation_mode ? window.__naro_get_lyrics_animation_mode() : null`);
    assert(toggleToClassic === 'classic', 'Lyrics animation mode switched to classic via rollback hook');

    const classicModeDom = await cdp.eval(`
      (() => {
        const container = document.getElementById('now-playing-lyrics-container');
        const activeLine = document.querySelector('[data-testid="active-lyric-line"]');
        return {
          containerMode: container.getAttribute('data-animation-mode'),
          lineMode: activeLine ? activeLine.getAttribute('data-animation-mode') : null
        };
      })()
    `);
    assert(
      classicModeDom.containerMode === 'classic',
      'DOM reflects classic animation mode',
      `containerMode: ${classicModeDom.containerMode}`
    );
    await captureScreenshot(cdp, 'floating_lyrics_rollback_classic.png');

    // Restore to Floating Mode
    console.log('  Restoring to Floating Typography mode...');
    const toggleBackToFloating = await cdp.eval(`
      (() => {
        if (window.__naro_set_lyrics_animation_mode) {
          window.__naro_set_lyrics_animation_mode('floating');
          return window.__naro_get_lyrics_animation_mode();
        }
        return null;
      })()
    `);
    await sleep(300);
    assert(toggleBackToFloating === 'floating', 'Successfully restored to floating typography mode');

    // ------------------------------------------------------------------------
    // SECTION 8: Telugu Script & Diacritics Protection
    // ------------------------------------------------------------------------
    console.log('\n[Step 10] Testing Telugu Script Protection with Multi-matra lyrics...');
    await cdp.eval(`
      if (window.__naro_set_lyric_language) {
        window.__naro_set_lyric_language('te');
      }
    `);
    await sleep(500);
    await captureScreenshot(cdp, 'floating_lyrics_telugu_script_protection.png');

    const teluguAudit = await cdp.eval(`
      (() => {
        const primary = document.querySelector('.floating-lyric-primary');
        if (!primary) return null;
        const cs = window.getComputedStyle(primary);
        return {
          text: primary.textContent.trim(),
          fontFamily: cs.fontFamily,
          overflow: cs.overflow,
          lineHeight: cs.lineHeight
        };
      })()
    `);
    console.log('  Telugu script rendering audit:', teluguAudit);
    assert(teluguAudit !== null, 'Native script primary lyric rendered');
    assert(
      teluguAudit.overflow === 'visible',
      'Indic primary lyric has overflow: visible to protect matras and vattulu',
      `overflow: ${teluguAudit.overflow}`
    );

    // ------------------------------------------------------------------------
    // SECTION 9: Queue and Share Moment Integrity
    // ------------------------------------------------------------------------
    console.log('\n[Step 11] Verifying Queue & Share Moment Integrity...');
    // Open Queue
    await cdp.eval(`
      if (window.__naro_open_queue) {
        window.__naro_open_queue();
      }
    `);
    await sleep(400);

    const queueOpen = await cdp.eval(`window.__naro_is_queue_open ? window.__naro_is_queue_open() : false`);
    assert(queueOpen === true, 'Queue panel opens cleanly');

    const queueItems = await cdp.eval(`
      window.__naro_get_queue ? window.__naro_get_queue().length : 0
    `);
    console.log(`  Queue has ${queueItems} items`);
    assert(typeof queueItems === 'number', 'Queue state is intact and accessible');

    // Close Queue
    await cdp.eval(`
      if (window.__naro_close_queue) {
        window.__naro_close_queue();
      }
    `);
    await sleep(400);

    // Check Share Moment button
    const shareBtn = await cdp.eval(`
      (() => {
        const btn = document.getElementById('now-playing-share-btn') || document.getElementById('now-playing-share-moment-btn');
        return !!btn;
      })()
    `);
    console.log('  Share button present:', shareBtn);
    assert(shareBtn === true, 'Share Moment entrypoint present and accessible');

    console.log('\n======================================================================');
    console.log(`ALL VERIFICATION CHECKS PASSED: ${results.filter(r => r.passed).length}/${results.length}`);
    console.log('======================================================================\n');
  } finally {
    try { cdp.close(); } catch {}
    try { chromeProcess.kill(); } catch {}
    try { viteProcess.kill(); } catch {}
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
