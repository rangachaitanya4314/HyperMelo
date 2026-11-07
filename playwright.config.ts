import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 45000,
  expect: {
    timeout: 7000
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write', 'microphone']
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-web-security'
          ]
        }
      }
    }
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000
  }
});
