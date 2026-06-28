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
  // Each test boots a full PixiJS/WebGL app. On CI there is no GPU, so the
  // software renderer (SwiftShader) is CPU-bound; running too many in parallel
  // starves the page and causes spurious 30s timeouts (incl. axe's in-page DOM
  // walk). Cap workers on CI to keep render contention sane — wall time stays
  // well under the 20-minute job budget.
  workers: isCI ? 2 : undefined,
  // A spin drives a full RGS round → reveal → settle through the software
  // renderer; on a contended CI runner that occasionally brushes the default
  // 30s per-test cap (e.g. the replay viewer waiting on the round badge). Double
  // it on CI so a slow-but-correct spin isn't reported as a failure.
  timeout: isCI ? 60_000 : 30_000,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The game renders with PixiJS (WebGL). Headless CI has no GPU, so allow
    // Chromium's software renderer (SwiftShader) — otherwise WebGL init can hang.
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
      // Escape hatch for sandboxes whose pre-installed Chromium doesn't match the
      // pinned Playwright build: set PW_CHROMIUM to that binary. Unset in CI,
      // which installs the matching browser via `playwright install`.
      executablePath: process.env.PW_CHROMIUM || undefined,
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
