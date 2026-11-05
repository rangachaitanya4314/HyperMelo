import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

let neteaseCooldownUntil = 0;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/saavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/saavn/, ''),
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'cookie': 'DL=english'
        },
        timeout: 6000,
        proxyTimeout: 6000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Upstream JioSaavn service unavailable',
                code: (err as any).code || 'UPSTREAM_ERROR',
                message: err.message
              }));
            }
          });
        }
      },
      '/api/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netease/, ''),
        headers: {
          'referer': 'https://music.163.com',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 4000,
        proxyTimeout: 4000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Upstream NetEase service unavailable',
                code: (err as any).code || 'UPSTREAM_RESET',
                message: err.message
              }));
            }
          });
        },
        bypass: async (req, res) => {
          if (!res) return;
          const now = Date.now();
          if (now < neteaseCooldownUntil) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
              'Retry-After': '300'
            });
            res.end(JSON.stringify({
              error: 'Upstream NetEase service in cooldown due to connection resets',
              code: 'ECONNRESET_COOLDOWN'
            }));
            return false;
          }

          try {
            const targetPath = (req.url || '').replace(/^\/api\/netease/, '');
            const targetUrl = `https://music.163.com${targetPath}`;
            const upstreamRes = await fetch(targetUrl, {
              headers: {
                'Referer': 'https://music.163.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              signal: AbortSignal.timeout(4000)
            });

            if (!upstreamRes.ok) {
              if (upstreamRes.status === 403 || upstreamRes.status >= 500) {
                neteaseCooldownUntil = Date.now() + 5 * 60 * 1000;
              }
              res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
              const body = await upstreamRes.text();
              res.end(body);
              return false;
            }

            const body = await upstreamRes.arrayBuffer();
            res.writeHead(upstreamRes.status, {
              'Content-Type': upstreamRes.headers.get('content-type') || 'application/json'
            });
            res.end(Buffer.from(body));
            return false;
          } catch (err: any) {
            neteaseCooldownUntil = Date.now() + 5 * 60 * 1000;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Upstream NetEase connection failed or was reset',
              code: err?.code || 'ECONNRESET',
              message: err?.message || 'Connection reset by peer'
            }));
            return false;
          }
        }
      }
    },
    watch: {
      ignored: ['**/.chrome_test_profile/**', '**/scratch/**']
    }
  },
  preview: {
    allowedHosts: [
      'hypermelo.app',
      'www.hypermelo.app',
      'naro-bf5m.onrender.com',
      'naro.onrender.com'
    ]
  }
})
