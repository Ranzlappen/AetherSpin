import { test, expect } from '@playwright/test';

/**
 * Smoke E2E against the in-browser mock RGS (no params → mock mode). Exercises the
 * real client path: boot → authenticate → render HUD → play a round → resolve.
 *
 * Selectors target accessible roles / visible copy rather than internals, so the
 * suite doubles as a light accessibility guard. `Spin` is matched exactly so it
 * doesn't also catch the "Buy Free Spins" button.
 */

// Surface browser-side failures in the CI log so a boot error is diagnosable
// without downloading the trace artifact.
test.beforeEach(({ page }) => {
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
  });
});

const spinButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Spin', exact: true });

// While a round plays the spin button becomes an enabled "Skip" control
// (tap-to-stop); a round in flight is detected by that accessible-name swap.
const skipButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Skip', exact: true });

/**
 * Settle the in-flight round in bounded time. Random mock books range from a
 * ~1s no-win spin to a retriggered free-spins feature running well past 30s,
 * so tap the skip control if it's still up (a short round may already have
 * settled — then the click quietly finds nothing) and wait for the button to
 * return to Spin. The strict skip-control contract itself is covered
 * deterministically in features.spec.ts against a replayed bonus book.
 */
const settleRound = async (page: import('@playwright/test').Page): Promise<void> => {
  // dispatchEvent fires the click on the button itself, so the free-spins
  // splash / win-celebration overlays can't swallow it — and the Skip locator
  // only matches while a round is in flight, so this can never start a spin.
  await skipButton(page)
    .dispatchEvent('click', {}, { timeout: 5_000 })
    .catch(() => {});
  await expect(spinButton(page)).toBeEnabled({ timeout: 30_000 });
};

test('boots on the mock RGS and shows the core HUD', async ({ page }) => {
  await page.goto('/');

  // The loading screen clears and the app mounts on the mock RGS.
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // Mandatory HUD pieces are present.
  await expect(page.getByText('Balance')).toBeVisible();
  await expect(spinButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paytable' })).toBeVisible();
});

test('plays a round to settlement', async ({ page }) => {
  test.slow(); // slow-runner boot + a feature round can brush the default budget
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  const spin = spinButton(page);
  await expect(spin).toBeEnabled();

  await spin.click();

  // The full play → reveal → end-round cycle completes and the button is
  // usable again, proving the round resolved without throwing/corrupting state.
  await settleRound(page);
});

test('opens the paytable / rules modal', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Paytable' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('multi-game: mounts and plays the ways game via ?game=cosmicways', async ({ page }) => {
  test.slow(); // slow-runner boot + a feature round can brush the default budget
  await page.goto('/?game=cosmicways');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The registry resolved the requested game and the switcher reflects it.
  await expect(page.getByLabel('Switch game (demo)')).toHaveValue('cosmicways');

  // A round plays end-to-end (the mock emits wayWins; the player handles them).
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await spin.click();
  await settleRound(page);
});

test('multi-game: mounts and plays the cluster game via ?game=stellarclusters', async ({ page }) => {
  test.slow(); // slow-runner boot + a feature round can brush the default budget
  await page.goto('/?game=stellarclusters');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The registry resolved the requested game and the switcher reflects it.
  await expect(page.getByLabel('Switch game (demo)')).toHaveValue('stellarclusters');

  // A round plays end-to-end (the mock emits clusterWins; the player handles them).
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await spin.click();
  await settleRound(page);
});

test('QA replay viewer: ?replay=base serves the committed corpus deterministically', async ({ page }) => {
  await page.goto('/?replay=base');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The replay badge shows progress through the corpus.
  const badge = page.getByText(/REPLAY · base/i);
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('0/');

  // Each spin advances deterministically through the reference books.
  const spin = spinButton(page);
  await spin.click();
  await expect(spin).toBeEnabled({ timeout: 30_000 });
  await expect(badge).toContainText('1/');
});

test('a11y: exposes a polite live region and spins via the keyboard', async ({ page }) => {
  test.slow(); // slow-runner boot + a feature round can brush the default budget
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The canvas is opaque to assistive tech, so outcomes are mirrored here.
  const liveRegion = page.locator('[aria-live="polite"]');
  await expect(liveRegion).toBeAttached();

  // Keyboard operability: Space triggers a spin when no control owns focus.
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await page.locator('body').press('Space');

  // The round resolves and the live region announces an outcome.
  await settleRound(page);
  await expect(liveRegion).not.toBeEmpty({ timeout: 30_000 });
});
