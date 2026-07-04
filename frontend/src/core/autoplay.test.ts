import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { startAutoplay, stopAutoplay } from './autoplay';
import { autoplay, balance, betLevelIndex, errorMessage, lastResult, totalWin } from './gameState';
import type { RoundResult } from './gameState';

const instantDelay = async (): Promise<void> => {};

/** Wait until the autoplay loop settles back to inactive. */
async function untilStopped(maxTicks = 500): Promise<void> {
  for (let i = 0; i < maxTicks && get(autoplay).active; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** A fake spin that applies a scripted sequence of round outcomes. */
function scriptedSpin(
  script: Array<{ win: number; cost?: number; triggeredFeature?: boolean; wincap?: boolean }>
): { spin: () => Promise<void>; calls: () => number } {
  let i = 0;
  const spin = async (): Promise<void> => {
    const step = script[Math.min(i, script.length - 1)];
    i++;
    balance.update((b) => b - (step.cost ?? 1) + step.win);
    totalWin.set(step.win);
    const result: RoundResult = {
      betID: i,
      win: step.win,
      payoutMultiplier: step.win,
      triggeredFeature: step.triggeredFeature ?? false,
      wincap: step.wincap ?? false,
    };
    lastResult.set(result);
  };
  return { spin, calls: () => i };
}

beforeEach(() => {
  stopAutoplay();
  balance.set(100);
  betLevelIndex.set(0); // bet 0.1 so insufficientFunds stays false
  totalWin.set(0);
  lastResult.set(null);
  errorMessage.set(null);
});

describe('autoplay stop conditions', () => {
  it('runs the requested number of spins then stops', async () => {
    const { spin, calls } = scriptedSpin([{ win: 0 }]);
    startAutoplay({ count: 5 }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(5);
    expect(get(autoplay).active).toBe(false);
  });

  it('stops on feature trigger when stopOnFeature is on', async () => {
    const { spin, calls } = scriptedSpin([{ win: 0 }, { win: 5, triggeredFeature: true }, { win: 0 }]);
    startAutoplay({ count: 10, stopOnFeature: true }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(2);
  });

  it('keeps spinning through features when stopOnFeature is off', async () => {
    const { spin, calls } = scriptedSpin([{ win: 0 }, { win: 5, triggeredFeature: true }, { win: 0 }]);
    startAutoplay({ count: 4, stopOnFeature: false }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(4);
  });

  it('always stops on a win-cap round', async () => {
    const { spin, calls } = scriptedSpin([{ win: 500, wincap: true }, { win: 0 }]);
    startAutoplay({ count: 10, stopOnFeature: false }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(1);
  });

  it('stops when a single win reaches the single-win limit (inclusive)', async () => {
    const { spin, calls } = scriptedSpin([{ win: 1 }, { win: 10 }, { win: 0 }]);
    startAutoplay({ count: 10, singleWinLimit: 10 }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(2);
    expect(get(errorMessage)).toContain('win limit');
  });

  it('stops when cumulative losses reach the loss limit (inclusive)', async () => {
    // Each spin costs 1 and wins nothing → 3 spins reach the 3-dollar loss limit.
    const { spin, calls } = scriptedSpin([{ win: 0, cost: 1 }]);
    startAutoplay({ count: 50, lossLimit: 3 }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(3);
    expect(get(errorMessage)).toContain('loss limit');
  });

  it('measures losses net of wins', async () => {
    // Alternating -1 / +1 keeps the balance near the start; a 3-loss limit
    // is only reached after enough net-losing spins.
    const { spin, calls } = scriptedSpin([
      { win: 0, cost: 1 },
      { win: 2, cost: 1 },
      { win: 0, cost: 1 },
      { win: 0, cost: 1 },
      { win: 0, cost: 1 },
      { win: 0, cost: 1 },
    ]);
    startAutoplay({ count: 50, lossLimit: 3 }, { spin, delay: instantDelay });
    await untilStopped();
    // Net loss reaches 3 only on spin 5 (-1 +1 -1 -1 -1).
    expect(calls()).toBe(5);
  });

  it('stops when the balance can no longer cover the bet', async () => {
    balance.set(0.05); // below the 0.1 bet
    const { spin, calls } = scriptedSpin([{ win: 0 }]);
    startAutoplay({ count: 10 }, { spin, delay: instantDelay });
    await untilStopped();
    expect(calls()).toBe(0);
    expect(get(autoplay).active).toBe(false);
  });

  it('stopAutoplay cancels an in-flight run', async () => {
    const gate: { release?: () => void } = {};
    const spin = (): Promise<void> =>
      new Promise<void>((resolve) => {
        gate.release = resolve;
      });
    startAutoplay({ count: 10 }, { spin, delay: instantDelay });
    await new Promise((r) => setTimeout(r, 0));
    stopAutoplay();
    gate.release?.();
    await untilStopped();
    expect(get(autoplay)).toMatchObject({ active: false, remaining: 0 });
  });

  it('records the starting balance for loss accounting', async () => {
    const { spin } = scriptedSpin([{ win: 0 }]);
    balance.set(42);
    startAutoplay({ count: 1, lossLimit: 100 }, { spin, delay: instantDelay });
    expect(get(autoplay).startBalance).toBe(42);
    await untilStopped();
  });
});
