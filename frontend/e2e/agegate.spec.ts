import { test, expect } from '@playwright/test';

/**
 * Age/legal acknowledgement E2E. The gate ships OFF for every game (operators
 * gate KYC upstream), so `?ageGate=1` forces it on for this test. Verifies it
 * blocks play until acknowledged, that the Enter button is gated on the consent
 * checkbox, and that the choice persists across a reload (no re-prompt).
 */

test('blocks play until acknowledged, then persists', async ({ page }) => {
  await page.goto('/?ageGate=1');

  // The gate is shown and is a modal dialog.
  const gate = page.getByTestId('age-gate');
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await expect(gate.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');

  // Enter is disabled until the consent checkbox is ticked.
  const enter = page.getByRole('button', { name: /enter game/i });
  await expect(enter).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(enter).toBeEnabled();

  // Acknowledging dismisses the gate and reveals the game HUD.
  await enter.click();
  await expect(gate).toBeHidden();
  await expect(page.getByText('Balance')).toBeVisible();

  // Reload: the acknowledgement persisted, so the gate does not reappear.
  await page.reload();
  await expect(page.getByText('Balance')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('age-gate')).toHaveCount(0);
});

test('default (no ?ageGate) does not show the gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('age-gate')).toHaveCount(0);
});
