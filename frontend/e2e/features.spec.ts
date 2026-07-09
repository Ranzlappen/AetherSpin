import { test, expect } from '@playwright/test';

/**
 * Player-experience features E2E (mock RGS): turbo toggle, tap-to-skip, and the
 * autoplay menu's responsible-gaming limit controls. Selectors target
 * accessible roles/names so the suite doubles as an a11y guard.
 */

test.beforeEach(({ page }) => {
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
});

async function boot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });
}

test('turbo toggle flips its pressed state', async ({ page }) => {
  await boot(page);
  const turbo = page.getByRole('button', { name: 'Turbo mode' });
  await expect(turbo).toBeVisible();
  await expect(turbo).toHaveAttribute('aria-pressed', 'false');
  await turbo.click();
  await expect(turbo).toHaveAttribute('aria-pressed', 'true');
  await turbo.click();
  await expect(turbo).toHaveAttribute('aria-pressed', 'false');
});

test('skip fast-forwards a round to settlement', async ({ page }) => {
  await boot(page);
  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  await spin.click();

  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  await expect(skip).toBeVisible();
  await skip.click();

  // The round settles (presentation collapsed, outcome untouched).
  await expect(spin).toBeEnabled({ timeout: 30_000 });
});

test('autoplay menu exposes loss-limit and single-win-limit controls', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Autoplay' }).click();

  // Responsible-gaming limits are visible before a run can start.
  await expect(page.getByText('Loss limit')).toBeVisible();
  await expect(page.getByText('Single win limit')).toBeVisible();
  await expect(page.getByText('Stop on free spins')).toBeVisible();

  // Starting a short run swaps the control to Stop, then stop it.
  await page
    .getByRole('group', { name: 'Autoplay' })
    .getByRole('button', { name: '10', exact: true })
    .click();
  const stop = page.getByRole('button', { name: 'Stop autoplay' });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByRole('button', { name: 'Autoplay' })).toBeVisible({ timeout: 30_000 });
});
