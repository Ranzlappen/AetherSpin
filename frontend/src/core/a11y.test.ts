import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { announce, announcement, prefersReducedMotion } from './a11y';

describe('a11y', () => {
  it('announce clears then sets the live region on the next tick', async () => {
    announce('You won $5.00.');
    // Cleared synchronously so repeating the same text re-triggers the region.
    expect(get(announcement)).toBe('');
    await new Promise((r) => setTimeout(r, 70));
    expect(get(announcement)).toBe('You won $5.00.');
  });

  it('defaults reduced motion to false when matchMedia is unavailable (jsdom)', () => {
    expect(get(prefersReducedMotion)).toBe(false);
  });
});
