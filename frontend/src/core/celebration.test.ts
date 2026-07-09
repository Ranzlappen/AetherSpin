import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  activeCelebration,
  dismissCelebration,
  initCelebrations,
  CELEBRATION_DURATION_MS,
} from './celebration';
import { bus } from './eventBus';

let teardown: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  activeCelebration.set(null);
  teardown = initCelebrations();
});

afterEach(() => {
  teardown?.();
  teardown = null;
  vi.useRealTimers();
});

describe('celebration overlay store', () => {
  it('ignores mid-round (non-final) wins of any size', () => {
    bus.emit('celebrate', { tier: 'mega', amount: 60, final: false });
    expect(get(activeCelebration)).toBeNull();
  });

  it('shows for final overlay tiers only', () => {
    bus.emit('celebrate', { tier: 'small', amount: 1, final: true });
    expect(get(activeCelebration)).toBeNull();
    bus.emit('celebrate', { tier: 'medium', amount: 5, final: true });
    expect(get(activeCelebration)).toBeNull();

    bus.emit('celebrate', { tier: 'big', amount: 25, final: true });
    expect(get(activeCelebration)).toEqual({ tier: 'big', amount: 25 });
  });

  it('replaces an active celebration with a bigger one', () => {
    bus.emit('celebrate', { tier: 'big', amount: 25, final: true });
    bus.emit('celebrate', { tier: 'wincap', amount: 5000, final: true });
    expect(get(activeCelebration)).toEqual({ tier: 'wincap', amount: 5000 });
  });

  it('auto-dismisses after the display duration', () => {
    bus.emit('celebrate', { tier: 'mega', amount: 60, final: true });
    expect(get(activeCelebration)).not.toBeNull();
    vi.advanceTimersByTime(CELEBRATION_DURATION_MS + 1);
    expect(get(activeCelebration)).toBeNull();
  });

  it('dismisses early on demand (tap-to-dismiss)', () => {
    bus.emit('celebrate', { tier: 'epic', amount: 150, final: true });
    dismissCelebration();
    expect(get(activeCelebration)).toBeNull();
    // The stale auto-dismiss timer must not resurrect anything later.
    vi.advanceTimersByTime(CELEBRATION_DURATION_MS + 1);
    expect(get(activeCelebration)).toBeNull();
  });

  it('teardown unsubscribes from the bus and clears the overlay', () => {
    bus.emit('celebrate', { tier: 'big', amount: 25, final: true });
    teardown?.();
    teardown = null;
    expect(get(activeCelebration)).toBeNull();
    bus.emit('celebrate', { tier: 'mega', amount: 60, final: true });
    expect(get(activeCelebration)).toBeNull();
  });
});
