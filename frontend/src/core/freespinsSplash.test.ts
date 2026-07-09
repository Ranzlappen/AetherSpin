import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  activeSplash,
  dismissSplash,
  initFreeSpinsSplash,
  SPLASH_DURATION_MS,
  SPLASH_SHORT_DURATION_MS,
} from './freespinsSplash';
import { turbo } from './gameState';
import { bus } from './eventBus';

let teardown: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  turbo.set(false);
  activeSplash.set(null);
  teardown = initFreeSpinsSplash();
});

afterEach(() => {
  teardown?.();
  teardown = null;
  vi.useRealTimers();
});

describe('free-spins splash store', () => {
  it('shows on a free-spins trigger with the awarded count', () => {
    bus.emit('freespins:start', { awarded: 8, startMultiplier: 1 });
    expect(get(activeSplash)).toEqual({ awarded: 8 });
  });

  it('auto-hides after the display duration', () => {
    bus.emit('freespins:start', { awarded: 12, startMultiplier: 1 });
    vi.advanceTimersByTime(SPLASH_DURATION_MS + 1);
    expect(get(activeSplash)).toBeNull();
  });

  it('uses the short duration under turbo', () => {
    turbo.set(true);
    bus.emit('freespins:start', { awarded: 8, startMultiplier: 1 });
    vi.advanceTimersByTime(SPLASH_SHORT_DURATION_MS + 1);
    expect(get(activeSplash)).toBeNull();
  });

  it('dismisses early on demand without a stale timer resurrecting it', () => {
    bus.emit('freespins:start', { awarded: 20, startMultiplier: 1 });
    dismissSplash();
    expect(get(activeSplash)).toBeNull();
    vi.advanceTimersByTime(SPLASH_DURATION_MS + 1);
    expect(get(activeSplash)).toBeNull();
  });

  it('teardown unsubscribes from the bus and clears the splash', () => {
    bus.emit('freespins:start', { awarded: 8, startMultiplier: 1 });
    teardown?.();
    teardown = null;
    expect(get(activeSplash)).toBeNull();
    bus.emit('freespins:start', { awarded: 8, startMultiplier: 1 });
    expect(get(activeSplash)).toBeNull();
  });
});
