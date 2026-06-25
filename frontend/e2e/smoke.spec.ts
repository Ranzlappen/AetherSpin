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

test('boots on the mock RGS and shows the core HUD', async ({ page }) => {
  await page.goto('/');

  // The loading screen clears and the app mounts on the mock RGS.
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // Mandatory HUD pieces are present.
  await expect(page.getByText('Balance')).toBeVisible();
  await expect(spinButton(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paytable' })).toBeVisible();
});

test('plays a round: spin disables then re-enables once the round resolves', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  const spin = spinButton(page);
  await expect(spin).toBeEnabled();

  await spin.click();

  // While resolving, the button is disabled (the round is in flight)…
  await expect(spin).toBeDisabled();

  // …and once the full play → reveal → end-round cycle completes it is usable
  // again, proving the round resolved without throwing / corrupting state.
  await expect(spin).toBeEnabled({ timeout: 30_000 });
});

test('opens the paytable / rules modal', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Paytable' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('multi-game: mounts and plays the ways game via ?game=cosmicways', async ({ page }) => {
  await page.goto('/?game=cosmicways');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The registry resolved the requested game and the switcher reflects it.
  await expect(page.getByLabel('Switch game (demo)')).toHaveValue('cosmicways');

  // A round plays end-to-end (the mock emits wayWins; the player handles them).
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await spin.click();
  await expect(spin).toBeDisabled();
  await expect(spin).toBeEnabled({ timeout: 30_000 });
});

test('multi-game: mounts and plays the cluster game via ?game=stellarclusters', async ({ page }) => {
  await page.goto('/?game=stellarclusters');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The registry resolved the requested game and the switcher reflects it.
  await expect(page.getByLabel('Switch game (demo)')).toHaveValue('stellarclusters');

  // A round plays end-to-end (the mock emits clusterWins; the player handles them).
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await spin.click();
  await expect(spin).toBeDisabled();
  await expect(spin).toBeEnabled({ timeout: 30_000 });
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
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  // The canvas is opaque to assistive tech, so outcomes are mirrored here.
  const liveRegion = page.locator('[aria-live="polite"]');
  await expect(liveRegion).toBeAttached();

  // Keyboard operability: Space triggers a spin when no control owns focus.
  const spin = spinButton(page);
  await expect(spin).toBeEnabled();
  await page.locator('body').press('Space');
  await expect(spin).toBeDisabled();

  // The round resolves and the live region announces an outcome.
  await expect(spin).toBeEnabled({ timeout: 30_000 });
  await expect(liveRegion).not.toBeEmpty({ timeout: 30_000 });
});
