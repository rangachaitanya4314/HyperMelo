import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

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
          const raw = JSON.parse(event.data.toString()) as { id?: number; result?: any; error?: { message: string }; method?: string; params?: any };
          if (raw.method === 'Runtime.consoleAPICalled') {
            const text = (raw.params?.args || []).map((a: any) => a.value !== undefined ? a.value : (a.description || '')).join(' ');
            if (raw.params?.type === 'error' || text.includes('Playback') || text.includes('Resolver') || text.includes('Audio')) {
              console.log(`    [Browser Console]:`, text);
            }
          }
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
    const resultObj = res.result as { value?: unknown; description?: string };
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

async function verifyRealFullLengthPlayback() {
  console.log('======================================================================');
  console.log('NARO MANDATORY VERIFICATION: REAL BROWSER FULL-LENGTH PLAYBACK');
  console.log('Authoritative Source of Truth: Real Chrome Audio Playback Beyond 00:30');
  console.log('======================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve(os.tmpdir(), 'chrome_naro_full_length_' + Date.now());

  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:5173/'
  ];

  const chromeProcess: ChildProcess = spawn(chromePath, chromeArgs, { stdio: 'ignore' });
  const cdp = new CdpClient();

  try {
    let listData: Array<{ id: string; webSocketDebuggerUrl?: string; url: string }> = [];
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch('http://127.0.0.1:9244/json');
        if (res.ok) {
          listData = await res.json();
          if (listData.length > 0 && listData[0].webSocketDebuggerUrl) {
            break;
          }
        }
      } catch {}
    }

    if (!listData.length || !listData[0].webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome on port 9244');
    }

    const page = listData.find((p) => p.url.includes('5173')) || listData[0];
    await cdp.connect(page.webSocketDebuggerUrl!);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('[Setup] Navigating to http://127.0.0.1:5173/ and dismissing intro...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });

    // Wait for app mount
    for (let i = 0; i < 30; i++) {
      const ready = await cdp.eval(`
        (() => {
          try { sessionStorage.setItem('naro_intro_seen', 'true'); } catch {}
          const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Skip') || b.innerText.includes('Explore') || b.innerText.includes('Enter')));
          if (skipBtn) skipBtn.click();
          return Boolean(document.querySelector('aside, [data-testid="bottom-player"], h1') && window.__naro_play_song);
        })()
      `);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log('App mounted successfully.');

    // Define 3 Ordinary Catalog Songs to test
    const catalogQueries = [
      { query: 'Red Sea Devara', expectedTitle: 'Red Sea' },
      { query: 'Channa Mereya', expectedTitle: 'Channa Mereya' },
      { query: 'Chaleya', expectedTitle: 'Chaleya' }
    ];

    const results: Array<{
      song: string;
      streamUrl: string;
      duration: number;
      initialPlayTime: number;
      seekTime: number;
      advancedTime: number;
      passed: boolean;
    }> = [];

    for (let idx = 0; idx < catalogQueries.length; idx++) {
      const item = catalogQueries[idx];
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`[Ordinary Catalog Song ${idx + 1}/${catalogQueries.length}]: "${item.query}"`);
      console.log(`----------------------------------------------------------------------`);

      // Search catalog via CatalogAggregationService or AppleMusicCatalogProvider in page
      console.log(`  1. Searching catalog for "${item.query}"...`);
      const searchRes = await cdp.eval(`
        (async () => {
          const { catalogAggregationService } = await import('/src/backend/services/CatalogAggregationService.ts');
          const results = await catalogAggregationService.search('${item.query}');
          const match = (results.songs && results.songs.length > 0) ? results.songs[0] : (results.items ? results.items[0] : null);
          return {
            id: match?.id,
            title: match?.title,
            artist: match?.artist,
            duration: match?.duration,
            fullTrackDuration: match?.fullTrackDuration,
            playbackSourceType: match?.playbackSourceType,
            fullLengthAvailable: match?.fullLengthAvailable,
            streamUrl: match?.streamUrl,
            raw: match
          };
        })()
      `);

      assert(Boolean(searchRes?.id), `Found catalog song: "${searchRes?.title}" by "${searchRes?.artist}"`);
      console.log(`    Metadata: title="${searchRes.title}", artist="${searchRes.artist}", duration=${searchRes.duration}s, fullLength=${searchRes.fullLengthAvailable}, type=${searchRes.playbackSourceType}`);
      console.log(`    Stream URL: ${searchRes.streamUrl}`);

      // 2. Play song via window.__naro_play_song
      console.log(`  2. Loading and starting playback in NARO...`);
      await cdp.eval(`
        (async () => {
          const { catalogAggregationService } = await import('/src/backend/services/CatalogAggregationService.ts');
          const results = await catalogAggregationService.search('${item.query}');
          const track = (results.songs && results.songs.length > 0) ? results.songs[0] : (results.items ? results.items[0] : null);
          window.__naro_play_song(track, 0);
        })()
      `);

      // Allow audio element to buffer and begin playback
      await new Promise((r) => setTimeout(r, 2500));

      // Inspect HTMLAudioElement and NARO Player State
      const playerState = await cdp.eval(`
        (() => {
          const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
          const currentSong = window.__naro_current_song;
          return {
            audioSrc: audio ? audio.src : null,
            audioDuration: audio ? audio.duration : 0,
            audioCurrentTime: audio ? audio.currentTime : 0,
            audioPaused: audio ? audio.paused : true,
            playerDuration: currentSong ? (currentSong.fullTrackDuration || currentSong.duration) : 0,
            fullLengthAvailable: currentSong ? currentSong.fullLengthAvailable : false,
            playbackSourceType: currentSong ? currentSong.playbackSourceType : null
          };
        })()
      `);

      console.log(`    Browser Audio: src="${playerState.audioSrc}"`);
      console.log(`    Browser Audio duration: ${playerState.audioDuration.toFixed(2)}s, currentTime: ${playerState.audioCurrentTime.toFixed(2)}s, paused: ${playerState.audioPaused}`);
      console.log(`    NARO Player duration: ${playerState.playerDuration}s`);

      // Mandatory Assertions on Real Chrome Audio
      assert(!playerState.audioPaused, 'Browser audio is actively playing');
      assert(playerState.audioDuration > 30, `Browser audio element duration > 30s (actual: ${playerState.audioDuration.toFixed(2)}s)`);
      assert(playerState.playerDuration > 30, `NARO player duration > 30s (actual: ${playerState.playerDuration}s)`);
      assert(!playerState.audioSrc?.includes('preview') && !playerState.audioSrc?.includes('mzstatic.com'), `Audio source is genuinely full-length, not a preview URL`);

      // 3. Seek to 45 seconds (well beyond 30-second preview limit)
      console.log(`  3. Seeking beyond 30s to 45.0s...`);
      await cdp.eval(`
        (() => {
          if (window.__naro_seek) {
            window.__naro_seek(45.0);
          } else {
            const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
            if (audio) audio.currentTime = 45.0;
          }
        })()
      `);

      // Wait 1.5s for audio buffer & playback to advance
      await new Promise((r) => setTimeout(r, 1500));

      const postSeekState = await cdp.eval(`
        (() => {
          const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
          return {
            currentTime: audio ? audio.currentTime : 0,
            paused: audio ? audio.paused : true,
            duration: audio ? audio.duration : 0
          };
        })()
      `);

      console.log(`    Post-seek state: currentTime=${postSeekState.currentTime.toFixed(2)}s, paused=${postSeekState.paused}, duration=${postSeekState.duration.toFixed(2)}s`);
      assert(postSeekState.currentTime >= 44.5, `Audio element currentTime reached beyond 30s (${postSeekState.currentTime.toFixed(2)}s)`);
      assert(!postSeekState.paused, 'Audio element continued playing past 30s without pausing or ending');

      // Wait another 1.2s to confirm clock advances
      const beforeAdvance = postSeekState.currentTime;
      await new Promise((r) => setTimeout(r, 1200));
      const advancedTime = await cdp.eval(`
        (() => {
          const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
          return audio ? audio.currentTime : 0;
        })()
      `);
      console.log(`    Advancing clock: ${beforeAdvance.toFixed(2)}s -> ${advancedTime.toFixed(2)}s`);
      assert(advancedTime > beforeAdvance, `Playback actively advances past 45s (+${(advancedTime - beforeAdvance).toFixed(2)}s)`);

      results.push({
        song: searchRes.title,
        streamUrl: playerState.audioSrc,
        duration: playerState.audioDuration,
        initialPlayTime: playerState.audioCurrentTime,
        seekTime: postSeekState.currentTime,
        advancedTime: advancedTime,
        passed: true
      });
    }

    // -----------------------------------------------------------------------
    // Control Track: Shot Down (by Josh Woodward)
    // -----------------------------------------------------------------------
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[Control Track]: "Shot Down" (Josh Woodward)`);
    console.log(`----------------------------------------------------------------------`);
    await cdp.eval(`
      (async () => {
        const { JOSH_WOODWARD_SHOT_DOWN } = await import('/src/data/songs.ts');
        window.__naro_play_song(JOSH_WOODWARD_SHOT_DOWN, 0);
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const shotDownState = await cdp.eval(`
      (() => {
        const audio = window.__naro_get_audio ? window.__naro_get_audio() : window.__naro_audio;
        const currentSong = window.__naro_current_song;
        return {
          title: currentSong?.title,
          src: audio?.src,
          duration: audio?.duration || 0,
          currentTime: audio?.currentTime || 0,
          paused: audio ? audio.paused : true
        };
      })()
    `);
    assert(shotDownState.title === 'Shot Down', 'Shot Down loaded as control track');
    assert(shotDownState.duration > 200, `Shot Down duration is full length: ${shotDownState.duration.toFixed(2)}s`);
    assert(!shotDownState.paused, 'Shot Down is actively playing');
    assert(shotDownState.src?.includes('shot-down'), `Shot Down points to local full-length asset: ${shotDownState.src}`);

    console.log('\n======================================================================');
    console.log('SUMMARY OF REAL CHROME BROWSER FULL-LENGTH PLAYBACK VERIFICATION:');
    console.log('======================================================================');
    for (const res of results) {
      console.log(`  🎵 "${res.song}":`);
      console.log(`     - Real Chrome Audio Duration: ${res.duration.toFixed(2)}s (> 30s)`);
      console.log(`     - Seek Beyond 30s: ${res.seekTime.toFixed(2)}s`);
      console.log(`     - Continued Playback to: ${res.advancedTime.toFixed(2)}s`);
      console.log(`     - Genuine Full-Length Stream: ${res.streamUrl}`);
      console.log(`     - STATUS: PASS ✅`);
    }
    console.log(`  🎵 Control Track: "${shotDownState.title}": ${shotDownState.duration.toFixed(2)}s PASS ✅`);
    console.log('======================================================================');
    console.log('🎉 ALL MANDATORY ACCEPTANCE CRITERIA VERIFIED IN REAL CHROME BROWSER');
    console.log('======================================================================\n');

    cdp.close();
  } finally {
    chromeProcess.kill();
  }
}

verifyRealFullLengthPlayback().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
