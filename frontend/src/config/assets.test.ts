import { describe, it, expect } from 'vitest';
import { assetUrl, manifestUrls, ASSET_MANIFEST } from './assets';

describe('assets', () => {
  it('resolves bundle-relative when no CDN base is configured (test env)', () => {
    // No VITE_ASSET_BASE in the test env → bundle-relative, no cache-bust query.
    expect(assetUrl('audio/spin.mp3')).toBe('audio/spin.mp3');
    expect(assetUrl('/audio/spin.mp3')).toBe('audio/spin.mp3');
  });

  it('manifest is empty today (procedural rendering) and yields no urls', () => {
    expect(ASSET_MANIFEST).toEqual([]);
    expect(manifestUrls()).toEqual([]);
  });
});
