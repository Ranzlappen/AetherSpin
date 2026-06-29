import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { BookPlayer, classifyWin } from './bookPlayer';
import type { Book } from '../../../shared/src/types/events';
import {
  RgsError,
  type RgsTransport,
  type PlayResult,
  type AuthenticateResult,
  type EndRoundResult,
  type Balance,
  type RoundState,
} from './rgsClient';
import { balance, totalWin, gameMode, freeSpins, isSpinning, lastResult, resetFreeSpins } from './gameState';

/** A fake transport returning a fixed book, recording endRound calls. */
class FakeTransport implements RgsTransport {
  readonly params = { sessionID: 's', rgsUrl: 'r', lang: 'en', currency: 'USD' };
  endRoundCalls = 0;
  constructor(
    private readonly book: Book,
    private readonly payoutMultiplier: number,
    private readonly balanceAfterPlay = 90,
    private readonly balanceAfterEnd = 100
  ) {}
  async authenticate(): Promise<AuthenticateResult> {
    return {
      balance: this.bal(this.balanceAfterPlay),
      config: { minBet: 0.1, maxBet: 100, stepBet: 0.1, betLevels: [] },
      round: null,
      statusCode: 'SUCCESS',
    };
  }
  async play(): Promise<PlayResult> {
    return {
      round: { betID: 1, state: 'placed', payoutMultiplier: this.payoutMultiplier, book: this.book },
      balance: this.bal(this.balanceAfterPlay),
      statusCode: 'SUCCESS',
    };
  }
  async endRound(): Promise<EndRoundResult> {
    this.endRoundCalls++;
    return { balance: this.bal(this.balanceAfterEnd), statusCode: 'SUCCESS' };
  }
  async getBalance(): Promise<Balance> {
    return this.bal(this.balanceAfterEnd);
  }
  private bal(amount: number): Balance {
    return { amount, currency: 'USD' };
  }
}

const instantWait = async (): Promise<void> => {};

beforeEach(() => {
  balance.set(0);
  totalWin.set(0);
  gameMode.set('base');
  isSpinning.set(false);
  lastResult.set(null);
  resetFreeSpins();
});

describe('classifyWin', () => {
  it('tiers winnings by multiplier', () => {
    expect(classifyWin(1)).toBe('small');
    expect(classifyWin(10)).toBe('medium');
    expect(classifyWin(25)).toBe('big');
    expect(classifyWin(80)).toBe('mega');
    expect(classifyWin(5000)).toBe('wincap');
  });
});

describe('BookPlayer base round', () => {
  const book: Book = {
    id: 1,
    payoutMultiplier: 0.5,
    events: [
      {
        type: 'reveal',
        gameType: 'base',
        board: [
          ['L3', 'L2', 'L1'],
          ['L4', 'L3', 'L2'],
          ['L5', 'L4', 'L3'],
          ['L4', 'L3', 'L2'],
          ['H4', 'L5', 'L4'],
        ],
        reelStops: [1, 2, 3, 4, 5],
      },
      {
        type: 'lineWins',
        gameType: 'base',
        wins: [{ line: 3, symbol: 'L3', count: 4, wildMultiplier: 1, amount: 0.5 }],
        amount: 0.5,
      },
      { type: 'finalWin', amount: 0.5, wincap: false },
    ],
  };

  it('settles the round, accrues win, and calls endRound once', async () => {
    const transport = new FakeTransport(book, 0.5, 90, 100);
    const player = new BookPlayer({ transport, wait: instantWait });
    await player.play(10, 'base');

    // Win = amount(0.5) * bet(10) = 5.
    expect(get(totalWin)).toBeCloseTo(5, 4);
    expect(get(balance)).toBe(100); // authoritative end-round balance
    expect(transport.endRoundCalls).toBe(1);
    expect(get(isSpinning)).toBe(false);
    expect(get(lastResult)?.triggeredFeature).toBe(false);
  });
});

describe('BookPlayer free-spins round', () => {
  const book: Book = {
    id: 2,
    payoutMultiplier: 12,
    events: [
      {
        type: 'reveal',
        gameType: 'base',
        board: [
          ['S', 'L5', 'L4'],
          ['S', 'L4', 'L5'],
          ['S', 'L1', 'L5'],
          ['L2', 'L1', 'H4'],
          ['H3', 'H2', 'L5'],
        ],
        reelStops: [1, 2, 3, 4, 5],
      },
      { type: 'scatterWin', count: 3, amount: 2 },
      { type: 'freeSpinTrigger', scatters: 3, awarded: 8, startMultiplier: 1 },
      {
        type: 'reveal',
        gameType: 'free',
        board: [
          ['L5', 'L4', 'L5'],
          ['L5', 'L4', 'L3'],
          ['H2', 'L5', 'L4'],
          ['W', 'W', 'W'],
          ['H1', 'W', 'L5'],
        ],
        reelStops: [1, 2, 3, 4, 5],
        spin: 1,
        spinsTotal: 8,
        globalMultiplier: 1,
        expandedReels: [3],
      },
      {
        type: 'freeSpinResult',
        spin: 1,
        wins: [{ line: 5, symbol: 'L5', count: 5, wildMultiplier: 3, amount: 10 }],
        scatter: null,
        globalMultiplier: 1,
        amount: 10,
      },
      { type: 'ladderStep', globalMultiplier: 2 },
      { type: 'freeSpinEnd', totalWin: 12 },
      { type: 'finalWin', amount: 12, wincap: false },
    ],
  };

  it('transitions to free mode, tracks ladder, then returns to base', async () => {
    const transport = new FakeTransport(book, 12, 0, 220);
    const player = new BookPlayer({ transport, wait: instantWait });

    let sawFreeMode = false;
    const unsub = gameMode.subscribe((m) => {
      if (m === 'free') sawFreeMode = true;
    });

    await player.play(1, 'bonus');
    unsub();

    expect(sawFreeMode).toBe(true);
    // Final win = 12 * bet(1).
    expect(get(totalWin)).toBeCloseTo(12, 4);
    expect(get(lastResult)?.triggeredFeature).toBe(true);
    // Free spins reset to idle at the end.
    expect(get(freeSpins).remaining).toBe(0);
    expect(get(gameMode)).toBe('base');
    expect(transport.endRoundCalls).toBe(1);
  });
});

/**
 * A transport whose first `endRound` fails with a transport error, then reports
 * a configurable round state on re-authenticate — exercising the settle-recovery
 * path in BookPlayer.settleRound.
 */
class FlakySettleTransport implements RgsTransport {
  readonly params = { sessionID: 's', rgsUrl: 'r', lang: 'en', currency: 'USD' };
  endRoundCalls = 0;
  authCalls = 0;
  constructor(
    private readonly book: Book,
    private readonly roundOnReauth: RoundState | null,
    private readonly firstEndError: RgsError = new RgsError('ERR_UE'),
    private readonly authBalance = 130,
    private readonly endBalance = 140
  ) {}
  async authenticate(): Promise<AuthenticateResult> {
    this.authCalls++;
    return {
      balance: { amount: this.authBalance, currency: 'USD' },
      config: { minBet: 0.1, maxBet: 100, stepBet: 0.1, betLevels: [] },
      round: this.roundOnReauth,
      statusCode: 'SUCCESS',
    };
  }
  async play(): Promise<PlayResult> {
    return {
      round: { betID: 7, state: 'placed', payoutMultiplier: 0.5, book: this.book },
      balance: { amount: 90, currency: 'USD' },
      statusCode: 'SUCCESS',
    };
  }
  async endRound(): Promise<EndRoundResult> {
    this.endRoundCalls++;
    if (this.endRoundCalls === 1) throw this.firstEndError;
    return { balance: { amount: this.endBalance, currency: 'USD' }, statusCode: 'SUCCESS' };
  }
  async getBalance(): Promise<Balance> {
    return { amount: this.endBalance, currency: 'USD' };
  }
}

describe('BookPlayer settle resilience', () => {
  const book: Book = {
    id: 1,
    payoutMultiplier: 0.5,
    events: [
      { type: 'reveal', gameType: 'base', board: [['L1', 'L2', 'L3']], reelStops: [1] },
      { type: 'finalWin', amount: 0.5, wincap: false },
    ],
  };

  it('treats a lost end-round response as settled when re-auth shows no open round', async () => {
    // endRound reply lost AFTER the server settled → re-auth shows round resolved.
    const transport = new FlakySettleTransport(book, null, new RgsError('ERR_UE'), 130, 999);
    const player = new BookPlayer({ transport, wait: instantWait });
    await player.play(10, 'base');
    // No blind double-settle: endRound called once (failed), not retried.
    expect(transport.endRoundCalls).toBe(1);
    expect(transport.authCalls).toBe(1);
    expect(get(balance)).toBe(130); // authoritative wallet balance from re-auth
    expect(get(isSpinning)).toBe(false);
  });

  it('retries end-round when re-auth shows the round is still open', async () => {
    const openRound: RoundState = { betID: 7, state: 'placed', payoutMultiplier: 0.5, book };
    const transport = new FlakySettleTransport(book, openRound, new RgsError('ERR_UE'), 130, 140);
    const player = new BookPlayer({ transport, wait: instantWait });
    await player.play(10, 'base');
    // Round genuinely unsettled → retried exactly once and the win finalizes.
    expect(transport.endRoundCalls).toBe(2);
    expect(get(balance)).toBe(140);
  });

  it('propagates a business error from end-round (does not swallow it)', async () => {
    const transport = new FlakySettleTransport(book, null, new RgsError('ERR_IS'));
    const player = new BookPlayer({ transport, wait: instantWait });
    await expect(player.play(10, 'base')).rejects.toMatchObject({ code: 'ERR_IS' });
    expect(transport.authCalls).toBe(0); // not a transport blip → no recovery attempt
    expect(get(isSpinning)).toBe(false); // finally still clears the spin flag
  });
});
