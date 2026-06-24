import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. The app auto-runs on the in-browser mock RGS when no `rgsUrl`/
 * `sessionID` query params are present, so the smoke suite needs no live backend
 * — it drives the real auth → play → reveal → end-round cycle against the mock.
 */
const PORT = 4173;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The game renders with PixiJS (WebGL). Headless CI has no GPU, so allow
    // Chromium's software renderer (SwiftShader) — otherwise WebGL init can hang.
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
    },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !isCI,
  },
});
