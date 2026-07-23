import { test, expect, type Page } from '@playwright/test';

/**
 * Responsiveness / layout regression guard. The board is a full-bleed Pixi
 * canvas with the HUD absolutely positioned over it, so the Pixi `resize()`
 * reserves the measured top/bottom HUD bands and fits the board into the clear
 * area between them. These assertions lock in the two "watertight" invariants
 * across the full viewport range:
 *
 *   1. No horizontal overflow — the page never scrolls sideways.
 *   2. Every interactive control is fully inside the viewport (nothing clipped
 *      off-screen, nothing spilling past an edge) — the concrete defect this
 *      layout pass fixed was the bottom controls sitting under the board on
 *      short/landscape and tiny screens.
 *
 * DOM-only checks: they need the HUD (which mounts after the mock auth), not the
 * WebGL board, so they stay stable under CI's software renderer.
 */

const spinButton = (page: Page) => page.getByRole('button', { name: 'Spin', exact: true });

// Span the range that exposed layout defects: desktop, laptop, both tablet
// orientations, mobile portrait/landscape, and the smallest phones. `phone`
// viewports run on both projects (the mobile project's high devicePixelRatio is
// where the DPR-scaling bug lived); the larger desktop/tablet sizes run only on
// the desktop project — a 1920-wide viewport on a DPR-2.6 phone profile is both
// unrealistic and pathologically slow to render under CI's CPU renderer.
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080, phone: false },
  { name: 'laptop', width: 1280, height: 800, phone: false },
  { name: 'tablet-landscape', width: 1024, height: 768, phone: false },
  { name: 'tablet-portrait', width: 768, height: 1024, phone: false },
  { name: 'mobile-portrait', width: 390, height: 844, phone: true },
  { name: 'mobile-landscape', width: 844, height: 390, phone: true },
  { name: 'small-mobile', width: 360, height: 640, phone: true },
  { name: 'tiny', width: 320, height: 568, phone: true },
] as const;

for (const vp of VIEWPORTS) {
  test(`layout is watertight at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
    // Skip the large desktop/tablet viewports on the high-DPR mobile project.
    test.skip(
      !vp.phone && testInfo.project.name === 'mobile-chromium',
      'desktop/tablet sizes are covered on the desktop project'
    );
    // Every protocol roundtrip (boundingBox etc.) costs seconds when the CPU
    // renderer is saturated by a large canvas; give the layout sweep 3× budget.
    test.slow();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');

    // Wait for the HUD to mount (mock auth resolved).
    await expect(spinButton(page)).toBeVisible({ timeout: 30_000 });

    // (0) The Pixi board is laid out against the full CSS viewport, not a
    // DPR-scaled fraction of it. The mobile project runs at devicePixelRatio > 1,
    // where the historical bug (dividing the logical size by `resolution`) put
    // the board at a quarter size in the top-left. The stage stamps the logical
    // size it used onto the canvas host; it must match the viewport.
    const host = page.locator('.canvas-host');
    await expect(host).toHaveAttribute('data-stage-w', /\d+/, { timeout: 30_000 });
    const stageW = Number(await host.getAttribute('data-stage-w'));
    const stageH = Number(await host.getAttribute('data-stage-h'));
    expect(
      Math.abs(stageW - vp.width),
      'stage width must match the viewport (not a DPR fraction)'
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(stageH - vp.height),
      'stage height must match the viewport (not a DPR fraction)'
    ).toBeLessThanOrEqual(2);

    // (1) No horizontal overflow.
    const overflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflowsX, 'page must not scroll horizontally').toBe(false);

    // (2) Every key control sits fully within the viewport.
    const controls = [
      spinButton(page),
      page.getByText('Balance'),
      page.getByRole('button', { name: 'Increase bet' }),
      page.getByRole('button', { name: 'Buy Free Spins' }),
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box, 'control should be laid out').not.toBeNull();
      if (!box) continue;
      expect(box.x, 'control off the left edge').toBeGreaterThanOrEqual(-1);
      expect(box.y, 'control off the top edge').toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, 'control past the right edge').toBeLessThanOrEqual(vp.width + 1);
      expect(box.y + box.height, 'control past the bottom edge').toBeLessThanOrEqual(vp.height + 1);
    }
  });
}
