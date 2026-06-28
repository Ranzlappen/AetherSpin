import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Texture } from 'pixi.js';
import { AssetRegistry, assetRegistry, preloadAssets } from './assetLoader';
import type { AssetGroup } from '../config/assets';

// A stand-in for a Pixi Texture; the registry only stores/returns the object.
const fakeTexture = (id: string): Texture => ({ __id: id }) as unknown as Texture;

const MANIFEST: readonly AssetGroup[] = [
  { name: 'boot', assets: { 'symbol:H1': 'symbols/h1.png', 'symbol:H2': 'symbols/h2.png' } },
  { name: 'feature', assets: { 'bg:freespins': 'bg/freespins.png' } },
];

describe('AssetRegistry', () => {
  let reg: AssetRegistry;
  beforeEach(() => {
    reg = new AssetRegistry();
  });

  it('returns null for unloaded keys (the procedural-fallback signal)', () => {
    expect(reg.getTexture('symbol:H1')).toBeNull();
    expect(reg.has('symbol:H1')).toBe(false);
  });

  it('preloads the manifest through the injected loader and exposes textures by key', async () => {
    const load = vi.fn(async (url: string) => fakeTexture(url));
    const keys = await reg.preload({ manifest: MANIFEST, load });

    expect(load).toHaveBeenCalledTimes(3);
    expect(new Set(keys)).toEqual(new Set(['symbol:H1', 'symbol:H2', 'bg:freespins']));
    expect(reg.getTexture('symbol:H1')).not.toBeNull();
    expect(reg.has('bg:freespins')).toBe(true);
    expect(reg.getTexture('symbol:UNKNOWN')).toBeNull();
  });

  it('is fault-tolerant: a failing asset is skipped, the rest still load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.fn(async (url: string) => {
      if (url.includes('h2')) throw new Error('boom');
      return fakeTexture(url);
    });

    const keys = await reg.preload({ manifest: MANIFEST, load });

    expect(keys).not.toContain('symbol:H2');
    expect(reg.getTexture('symbol:H2')).toBeNull(); // falls back
    expect(reg.getTexture('symbol:H1')).not.toBeNull(); // unaffected
    expect(reg.has('bg:freespins')).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports progress as assets settle (including failures)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.fn(async (url: string) => {
      if (url.includes('h1')) throw new Error('nope');
      return fakeTexture(url);
    });
    const progress: Array<[number, number]> = [];
    await reg.preload({ manifest: MANIFEST, load, onProgress: (l, t) => progress.push([l, t]) });
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('is idempotent: a second preload does not reload', async () => {
    const load = vi.fn(async (url: string) => fakeTexture(url));
    await reg.preload({ manifest: MANIFEST, load });
    const second = await reg.preload({ manifest: MANIFEST, load });
    expect(load).toHaveBeenCalledTimes(3); // not 6
    expect(new Set(second)).toEqual(new Set(['symbol:H1', 'symbol:H2', 'bg:freespins']));
  });

  it('an empty manifest is a no-op (today’s procedural default)', async () => {
    const load = vi.fn();
    const keys = await reg.preload({ manifest: [], load });
    expect(keys).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('clear() drops textures and unlatches preload', async () => {
    const load = vi.fn(async (url: string) => fakeTexture(url));
    await reg.preload({ manifest: MANIFEST, load });
    reg.clear();
    expect(reg.getTexture('symbol:H1')).toBeNull();
    await reg.preload({ manifest: MANIFEST, load });
    expect(load).toHaveBeenCalledTimes(6); // reloaded after clear
  });

  it('register() exposes a texture directly (used by the renderer fallback path)', () => {
    reg.register('symbol:WILD', fakeTexture('w'));
    expect(reg.has('symbol:WILD')).toBe(true);
    expect(reg.getTexture('symbol:WILD')).not.toBeNull();
  });
});

describe('asset singleton (boot path)', () => {
  beforeEach(() => assetRegistry.clear());

  it('preloadAssets() drives the shared registry; empty manifest is a no-op', async () => {
    // Default manifest (the app's) is empty today → resolves to no keys.
    await expect(preloadAssets()).resolves.toEqual([]);
    assetRegistry.register('symbol:H1', fakeTexture('h1'));
    expect(assetRegistry.getTexture('symbol:H1')).not.toBeNull();
  });
});
