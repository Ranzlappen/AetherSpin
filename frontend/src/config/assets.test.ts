import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assetUrl, manifestUrls, manifestPaths, ASSET_MANIFEST, ASSET_IS_BUNDLE_RELATIVE } from './assets';

describe('assets', () => {
  it('resolves bundle-relative when no CDN base is configured (test env)', () => {
    // No VITE_ASSET_BASE in the test env → bundle-relative, no cache-bust query.
    expect(assetUrl('audio/spin.mp3')).toBe('audio/spin.mp3');
    expect(assetUrl('/audio/spin.mp3')).toBe('audio/spin.mp3');
  });

  it('declares placeholder art for the full symbol set, keyed for the renderer', () => {
    const keys = ASSET_MANIFEST.flatMap((g) => Object.keys(g.assets));
    const expected = ['W', 'S', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L5'].map(
      (id) => `symbol:${id}`
    );
    expect(new Set(keys)).toEqual(new Set(expected));
    // manifestPaths/manifestUrls mirror the declared assets (bundle-relative here).
    expect(manifestPaths()).toHaveLength(expected.length);
    expect(manifestUrls()).toContain('symbols/W.svg');
  });

  it('asset keys are unique across the whole manifest', () => {
    const keys = ASSET_MANIFEST.flatMap((g) => Object.keys(g.assets));
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Missing-asset guard: any declared bundle-relative asset must actually ship,
  // i.e. exist under frontend/public/. This fails CI on a dangling reference the
  // moment real art is added to the manifest (it's a no-op while it's empty).
  it('every declared bundle-relative asset exists under public/', () => {
    if (!ASSET_IS_BUNDLE_RELATIVE) return; // CDN-served: existence can't be checked here
    const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
    const missing = manifestPaths().filter((p) => !existsSync(resolve(publicDir, p)));
    expect(missing, `declared assets missing from frontend/public/: ${missing.join(', ')}`).toEqual([]);
  });

  it('the missing-asset guard actually fires on a dangling path (mechanism check)', () => {
    const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
    const fake = ['symbols/__does_not_exist__.png'];
    const missing = fake.filter((p) => !existsSync(resolve(publicDir, p)));
    expect(missing).toEqual(fake);
  });
});
