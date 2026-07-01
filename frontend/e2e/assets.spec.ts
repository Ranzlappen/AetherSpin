import { test, expect } from '@playwright/test';

/**
 * Asset-pipeline check: the symbol art must actually load and rasterize in a
 * real browser. Unit tests cover the loader logic with a fake loader (jsdom
 * can't rasterize images), so this is the only place that proves Pixi's loader
 * turns the committed `public/symbols/*` art (SVG or WebP/PNG) into textures.
 *
 * The loader emits one `[assets] ready: <loaded>/<total> loaded` marker at boot
 * and a `[assets] failed to load ...` warning per failure; we assert every
 * declared symbol loaded and none failed.
 */
test('asset pipeline: every placeholder symbol loads in the browser', async ({ page }) => {
  test.slow(); // boot + rasterizing 11 SVGs under the software renderer

  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/');
  // Mock-RGS boot finished → Stage.init (and its preload phase) has run.
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The readiness marker reports all declared assets loaded (loaded === total).
  await expect
    .poll(() => logs.find((m) => m.includes('[assets] ready:')) ?? '', { timeout: 30_000 })
    .toMatch(/\[assets\] ready: 11\/11 loaded/);

  // No symbol failed to fetch/decode in Chromium.
  expect(logs.filter((m) => m.includes('[assets] failed to load'))).toEqual([]);
});

/**
 * Audio delivery check. Playback needs a real audio device + a user gesture
 * (autoplay policy), which CI lacks — but we can still prove the placeholder
 * clips actually ship and are served at the URLs `sound.ts` requests.
 */
const CLIPS = ['spin', 'reelStop', 'win', 'bigWin', 'scatter', 'freeSpinStart', 'buttonClick'];
test('asset pipeline: every placeholder audio clip is served', async ({ page }) => {
  for (const name of CLIPS) {
    const res = await page.request.get(`/audio/${name}.wav`);
    expect(res.status(), `GET /audio/${name}.wav`).toBe(200);
    const body = await res.body();
    expect(body.length, `${name}.wav is empty`).toBeGreaterThan(44); // > WAV header
    expect(body.subarray(0, 4).toString('latin1')).toBe('RIFF'); // valid WAV magic
  }
});
