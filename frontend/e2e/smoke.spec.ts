import { test, expect } from '@playwright/test';

/**
 * Smoke E2E against the in-browser mock RGS (no params → mock mode). Exercises the
 * real client path: boot → authenticate → render HUD → play a round → resolve.
 *
 * Selectors target accessible roles / visible copy rather than internals, so the
 * suite doubles as a light accessibility guard.
 */

// Surface browser-side failures in the CI log so a boot error is diagnosable
// without downloading the trace artifact.
test.beforeEach(({ page }) => {
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
  });
});

test('boots on the mock RGS and shows the core HUD', async ({ page }) => {
  await page.goto('/');

  // The loading screen clears and the app mounts on the mock RGS.
  try {
    await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });
  } catch (err) {
    // Dump what actually rendered to make a boot failure self-explanatory.
    console.log('[#app innerHTML]', await page.locator('#app').innerHTML());
    throw err;
  }

  // Mandatory HUD pieces are present.
  await expect(page.getByText('Balance')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paytable' })).toBeVisible();
});

test('plays a round: spin disables then re-enables once the round resolves', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });

  const spin = page.getByRole('button', { name: 'Spin' });
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
