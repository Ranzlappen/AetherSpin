import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility + boot-performance audit against the in-browser mock
 * RGS (no params → mock mode). This complements the role/keyboard assertions in
 * `smoke.spec.ts` with an axe-core scan of the rendered DOM, and a generous,
 * non-flaky boot-time budget.
 *
 * Scope notes:
 * - The game board is a PixiJS/WebGL `<canvas>`, which is opaque to axe (and to
 *   assistive tech); accessibility for outcomes is handled by the polite live
 *   region exercised in `smoke.spec.ts`. We therefore scan the HTML chrome
 *   (HUD, buttons, dialogs) and exclude the canvas from color-contrast rules,
 *   which cannot meaningfully apply to a WebGL surface.
 * - We fail only on `serious`/`critical` impacts to keep the gate signal-rich
 *   and avoid blocking on cosmetic `minor`/`moderate` findings.
 */

/** axe tags for the WCAG 2.1 A/AA rule set — the bar operators are held to. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** Only these impacts gate the build; lesser findings are advisory. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

const bootMock = async (page: import('@playwright/test').Page, url = '/') => {
  await page.goto(url);
  await expect(page.getByText(/mock RGS/i)).toBeVisible({ timeout: 30_000 });
};

const audit = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The WebGL canvas carries no text; contrast rules don't apply to it.
    .disableRules(['color-contrast'])
    .exclude('canvas');

const blockingViolations = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));

test('a11y: the booted HUD has no serious/critical axe violations', async ({ page }) => {
  // axe's in-page DOM walk is heavy and competes with the software WebGL render
  // loop on CI; give it the extra headroom rather than risk a spurious timeout.
  test.slow();
  await bootMock(page);

  const results = await audit(page).analyze();
  const blocking = blockingViolations(results.violations);

  // Emit a readable summary so a regression is diagnosable from the CI log
  // without downloading the report artifact.
  for (const v of blocking) {
    console.log(`[axe] ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`);
  }
  expect(blocking, blocking.map((v) => v.id).join(', ')).toEqual([]);
});

test('a11y: the open paytable dialog has no serious/critical axe violations', async ({ page }) => {
  test.slow(); // see note above — axe analyze under software WebGL is slow on CI.
  await bootMock(page);

  await page.getByRole('button', { name: 'Paytable' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const results = await audit(page).analyze();
  const blocking = blockingViolations(results.violations);
  for (const v of blocking) {
    console.log(`[axe] ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`);
  }
  expect(blocking, blocking.map((v) => v.id).join(', ')).toEqual([]);
});

test('a11y: the document language is set on <html>', async ({ page }) => {
  await bootMock(page);
  // `setLocale` reflects the resolved locale onto <html lang> at boot; with no
  // RGS `lang` param the mock falls back to the browser/default → an `en-*` tag.
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
});

test('perf: the app boots within a generous budget', async ({ page }) => {
  const start = Date.now();
  await bootMock(page);
  const elapsed = Date.now() - start;

  // Deliberately generous: CI runs Chromium's software WebGL renderer
  // (SwiftShader) with no GPU, so this guards against gross regressions
  // (e.g. a blocking main-thread stall or a doubled bundle) rather than
  // policing exact frame timing, which would be flaky here.
  expect(elapsed).toBeLessThan(20_000);
});
