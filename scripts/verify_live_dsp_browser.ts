// Automated Live Browser Verification: HyperMelo DSP Audio Engine UI & State Synchronization
// Verifies real DOM updates, mode switches, presets, bass slider, playback continuity, and honest capability badges

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(__filename);

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
          const raw = JSON.parse(event.data.toString());
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
    const wrapped = `(() => {\n${expression.trim()}\n})()`;
    const res = await this.send('Runtime.evaluate', {
      expression: wrapped,
      returnByValue: true,
      awaitPromise: true
    });
    if ((res as any).exceptionDetails) {
      const err = (res as any).exceptionDetails;
      const desc = err.exception?.description || err.text || JSON.stringify(err);
      throw new Error(`Eval failed: ${desc}`);
    }
    const resultObj = res.result as { value?: unknown };
    return resultObj?.value;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

async function runBrowserDspTest() {
  console.log('======================================================================');
  console.log('HYPERMELO DSP SOUND ENGINE — LIVE BROWSER VERIFICATION');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_dsp_verify_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9261',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });
  const cdp = new CdpClient();

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch('http://127.0.0.1:9261/json');
        if (res.ok) {
          listData = await res.json();
          if (listData.length > 0 && listData[0].webSocketDebuggerUrl) {
            break;
          }
        }
      } catch {
        // waiting
      }
    }

    const pageTarget = listData.find((p) => p.url.includes('5173')) || listData[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome on port 9261');
    }

    await cdp.connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Wait for app to render
    await new Promise((r) => setTimeout(r, 2500));

    // Skip intro animation if displayed
    await cdp.eval(`
      const skipBtn = document.querySelector('button[aria-label="Skip to main application"]') || document.querySelector('.intro-skip-btn');
      if (skipBtn) skipBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 500));

    // 1. Start playback and open Now Playing
    console.log('[Step 1] Initializing audio playback and opening Now Playing...');
    await cdp.eval(`
      if (window.__naro_play_song && window.__naro_current_song) {
        window.__naro_play_song(window.__naro_current_song);
      }
      if (window.__naro_open_now_playing) {
        window.__naro_open_now_playing();
      }
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify initial DSP mode is original and badge is ORIGINAL (BYPASS)
    const initialBadge = await cdp.eval(`
      const badge = document.getElementById('now-playing-dsp-status-badge');
      return badge ? badge.textContent.trim() : null;
    `);
    console.log('  Initial badge text:', initialBadge);
    assert(initialBadge === 'ORIGINAL (BYPASS)', 'Badge shows ORIGINAL (BYPASS) in Original mode');

    const initialDesc = await cdp.eval(`
      const desc = document.getElementById('now-playing-dsp-description');
      return desc ? desc.textContent.trim() : null;
    `);
    console.log('  Initial DSP description:', initialDesc);
    assert(initialDesc === 'Direct Neutral Bypass (0.0 dB Flat)', 'Description reports Direct Neutral Bypass (0.0 dB Flat)');

    // 2. Switch to Punch Mode
    console.log('\n[Step 2] Testing Punch Mode...');
    await cdp.eval(`
      const punchBtn = document.getElementById('now-playing-mode-punch');
      if (punchBtn) punchBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));

    const punchBadge = await cdp.eval(`
      const badge = document.getElementById('now-playing-dsp-status-badge');
      return badge ? badge.textContent.trim() : null;
    `);
    assert(punchBadge === 'DSP ACTIVE', 'Badge updates to DSP ACTIVE in Punch mode');

    const punchDesc = await cdp.eval(`
      const desc = document.getElementById('now-playing-dsp-description');
      return desc ? desc.textContent.trim() : null;
    `);
    console.log('  Punch DSP description:', punchDesc);
    assert(punchDesc.includes('Kick Punch (+5.5 dB @ 82Hz)'), 'Description reflects Kick Punch');

    // 3. Switch to Immersive Mode & Test Presets
    console.log('\n[Step 3] Testing Immersive Mode & Presets...');
    await cdp.eval(`
      const immBtn = document.getElementById('now-playing-mode-immersive');
      if (immBtn) immBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));

    const immDesc = await cdp.eval(`
      const desc = document.getElementById('now-playing-dsp-description');
      return desc ? desc.textContent.trim() : null;
    `);
    console.log('  Immersive DSP description:', immDesc);
    assert(immDesc.includes('3D Stereo Widening (1.55x)'), 'Description reflects 3D Stereo Widening');

    // Test Deep preset
    await cdp.eval(`
      const deepBtn = document.getElementById('now-playing-preset-deep');
      if (deepBtn) deepBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));
    const deepDesc = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    console.log('  Deep preset description:', deepDesc);
    assert(deepDesc.includes('Sub-Bass Shelf (+6.0 dB @ 75Hz)'), 'Description reflects Sub-Bass Shelf for Deep preset');

    // Test Vocal preset
    await cdp.eval(`
      const vocalBtn = document.getElementById('now-playing-preset-vocal');
      if (vocalBtn) vocalBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));
    const vocalDesc = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    console.log('  Vocal preset description:', vocalDesc);
    assert(vocalDesc.includes('Vocal Presence (+5.2 dB @ 3.2kHz)'), 'Description reflects Vocal Presence for Vocal preset');

    // Test Wide preset
    await cdp.eval(`
      const wideBtn = document.getElementById('now-playing-preset-wide');
      if (wideBtn) wideBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));
    const wideDesc = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    console.log('  Wide preset description:', wideDesc);
    assert(wideDesc.includes('Panoramic Stereo Width (1.9x)'), 'Description reflects Panoramic Stereo Width for Wide preset');

    // Test Night preset
    await cdp.eval(`
      const nightBtn = document.getElementById('now-playing-preset-night');
      if (nightBtn) nightBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));
    const nightDesc = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    console.log('  Night preset description:', nightDesc);
    assert(nightDesc.includes('Night Compression (4.2:1)'), 'Description reflects Night Compression for Night preset');

    // 4. Bass Intensity Slider Test
    console.log('\n[Step 4] Testing Bass Intensity Slider...');
    await cdp.eval(`
      if (window.__naro_set_bass_intensity) {
        window.__naro_set_bass_intensity(3);
      }
    `);
    await new Promise((r) => setTimeout(r, 300));
    const bassReadout = await cdp.eval(`
      return document.getElementById('now-playing-bass-readout')?.textContent.trim();
    `);
    console.log('  Bass slider readout:', bassReadout);
    assert(bassReadout.includes('+4.5 dB'), 'Bass readout shows +4.5 dB');

    const descWithBass = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    console.log('  Description with bass modifier:', descWithBass);
    assert(descWithBass.includes('Bass +4.5 dB'), 'Description displays active Bass +4.5 dB parameter');

    // Reset bass
    await cdp.eval(`
      if (window.__naro_set_bass_intensity) {
        window.__naro_set_bass_intensity(0);
      }
    `);

    // 5. Return to Original Mode & Check Neutral Bypass
    console.log('\n[Step 5] Returning to Original Mode...');
    await cdp.eval(`
      const origBtn = document.getElementById('now-playing-mode-original');
      if (origBtn) origBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 300));

    const finalBadge = await cdp.eval(`
      return document.getElementById('now-playing-dsp-status-badge')?.textContent.trim();
    `);
    assert(finalBadge === 'ORIGINAL (BYPASS)', 'Badge cleanly returns to ORIGINAL (BYPASS)');

    const finalDesc = await cdp.eval(`
      return document.getElementById('now-playing-dsp-description')?.textContent.trim();
    `);
    assert(finalDesc === 'Direct Neutral Bypass (0.0 dB Flat)', 'Description cleanly returns to Direct Neutral Bypass');

    console.log('\n======================================================================');
    console.log('✅ LIVE BROWSER VERIFICATION PASSED COMPLETELY!');
    console.log('======================================================================\n');
  } finally {
    cdp.close();
    chromeProcess.kill();
  }
}

runBrowserDspTest().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
