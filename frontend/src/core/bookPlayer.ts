/**
 * Replays a {@link Book}'s events in order, driving the Svelte stores and the
 * presentation event bus, then settles the round via the RGS transport.
 *
 * Timing is delegated to an injected `wait` function so the player is fully
 * unit-testable (tests pass an instant `wait`). The player owns the orchestration
 * logic; the scenes own the actual animation and merely resolve/await the
 * intents emitted on the bus. No Pixi or Svelte component imports.
 */
import { get } from 'svelte/store';
import type { Book, BookEvent, Board } from '../../../shared/src/types/events';
import { wildSymbolId, scatterSymbolId, WINCAP_MULTIPLIER } from '../config/gameConfig';
import { bus, type WinTier } from './eventBus';
import type { RgsTransport, RoundState } from './rgsClient';
import {
  balance,
  currency as currencyStore,
  totalWin,
  gameMode,
  freeSpins,
  isSpinning,
  lastResult,
  resetFreeSpins,
  getCurrentBet,
} from './gameState';
import { sound } from './sound';

/** A promise-returning delay; injectable so tests can run instantly. */
export type WaitFn = (ms: number) => Promise<void>;

/** Default real-time delay backed by `setTimeout`. */
export const realWait: WaitFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tunable presentation timings (ms). */
export interface PlaybackTimings {
  reveal: number;
  lineWins: number;
  scatter: number;
  freeSpinTransition: number;
  freeSpinReveal: number;
  ladder: number;
  freeSpinEnd: number;
  settle: number;
}

/** Default timings used in production. */
export const DEFAULT_TIMINGS: PlaybackTimings = {
  reveal: 650,
  lineWins: 900,
  scatter: 800,
  freeSpinTransition: 1400,
  freeSpinReveal: 600,
  ladder: 500,
  freeSpinEnd: 1600,
  settle: 400,
};

/** Classify a win amount (as a multiple of the bet) into a celebration tier. */
export function classifyWin(winMultiplier: number): WinTier {
  if (winMultiplier >= WINCAP_MULTIPLIER) return 'wincap';
  if (winMultiplier >= 50) return 'mega';
  if (winMultiplier >= 20) return 'big';
  if (winMultiplier >= 5) return 'medium';
  return 'small';
}

/** Compute multiplier-wild badge positions from a board (free spins). */
function detectMultiplierWilds(
  board: Board,
  gameType: 'base' | 'free'
): Array<{ reel: number; row: number; value: number }> {
  // In this presentation, multiplier wilds only render in free spins. The book
  // carries the realized value via LineWin.wildMultiplier; absent per-cell data
  // we badge wilds with the line's wildMultiplier when > 1 (resolved later).
  if (gameType !== 'free') return [];
  const out: Array<{ reel: number; row: number; value: number }> = [];
  for (let reel = 0; reel < board.length; reel++) {
    for (let row = 0; row < board[reel].length; row++) {
      if (board[reel][row] === wildSymbolId) out.push({ reel, row, value: 1 });
    }
  }
  return out;
}

/** Count scatters on a board. */
function countScatters(board: Board): number {
  let n = 0;
  for (const col of board) for (const s of col) if (s === scatterSymbolId) n++;
  return n;
}

/** Options for {@link BookPlayer}. */
export interface BookPlayerOptions {
  transport: RgsTransport;
  wait?: WaitFn;
  timings?: Partial<PlaybackTimings>;
}

/**
 * Orchestrates a single round's playback. Construct once and call
 * {@link BookPlayer.play} per round.
 */
export class BookPlayer {
  private readonly transport: RgsTransport;
  private readonly wait: WaitFn;
  private readonly timings: PlaybackTimings;

  constructor(options: BookPlayerOptions) {
    this.transport = options.transport;
    this.wait = options.wait ?? realWait;
    this.timings = { ...DEFAULT_TIMINGS, ...options.timings };
  }

  /**
   * Place a bet and replay the resulting book to completion, updating stores and
   * settling via `endRound`.
   * @param bet Stake in dollars.
   * @param mode Bet mode (`"base"` | `"bonus"`).
   * @returns The settled {@link RoundState}.
   */
  async play(bet: number, mode: string): Promise<RoundState> {
    isSpinning.set(true);
    totalWin.set(0);
    bus.emit('reels:spin', { gameType: 'base' });
    sound.play('spin');

    try {
      const result = await this.transport.play(bet, mode);
      // Trust the authoritative wallet balance from the play response.
      balance.set(result.balance.amount);
      currencyStore.set(result.balance.currency);

      const book = result.round.book;
      if (book) {
        await this.replay(book, bet);
      }

      // Settle the round on the RGS.
      const end = await this.transport.endRound();
      balance.set(end.balance.amount);

      lastResult.set({
        betID: result.round.betID,
        win: get(totalWin),
        payoutMultiplier: result.round.payoutMultiplier,
        triggeredFeature: book ? bookTriggersFeature(book) : false,
        wincap: result.round.payoutMultiplier >= WINCAP_MULTIPLIER,
      });
      return result.round;
    } finally {
      isSpinning.set(false);
      gameMode.set('base');
    }
  }

  /**
   * Resume an unfinished round reported by `authenticate` (its `round.book`):
   * replay it and settle via `endRound`, WITHOUT placing a new bet. This honours
   * the RGS contract that an in-progress round must be resumed, not re-played as a
   * fresh spin (see SECURITY.md).
   * @param round The round descriptor from `authenticate`.
   * @param bet Stake in dollars (for display scaling).
   */
  async resume(round: RoundState, bet: number): Promise<void> {
    const book = round.book;
    if (!book) return;
    isSpinning.set(true);
    totalWin.set(0);
    bus.emit('reels:spin', { gameType: 'base' });
    try {
      await this.replay(book, bet);
      const end = await this.transport.endRound();
      balance.set(end.balance.amount);
      lastResult.set({
        betID: round.betID,
        win: get(totalWin),
        payoutMultiplier: round.payoutMultiplier,
        triggeredFeature: bookTriggersFeature(book),
        wincap: round.payoutMultiplier >= WINCAP_MULTIPLIER,
      });
    } finally {
      isSpinning.set(false);
      gameMode.set('base');
    }
  }

  /** Replay every event of a book in order. `bet` is the stake in dollars. */
  private async replay(book: Book, bet: number): Promise<void> {
    let runningWin = 0;
    const betPerLine = bet; // book amounts are bet multipliers already
    for (const event of book.events) {
      runningWin = await this.handleEvent(event, bet, betPerLine, runningWin);
    }
  }

  /** Dispatch a single event; returns the updated running win (dollars). */
  private async handleEvent(
    event: BookEvent,
    bet: number,
    betPerLine: number,
    runningWin: number
  ): Promise<number> {
    switch (event.type) {
      case 'reveal': {
        const expandedReels = event.expandedReels ?? [];
        // Prefer the realized per-cell multipliers carried in the book (the math
        // engine samples and commits them); only fall back to client-side
        // detection for legacy books that don't include them.
        const multiplierWilds = event.multiplierWilds ?? detectMultiplierWilds(event.board, event.gameType);
        bus.emit('board:reveal', {
          board: event.board,
          gameType: event.gameType,
          expandedReels,
          multiplierWilds,
          anticipation: countScatters(event.board) >= 2,
        });
        if (event.gameType === 'free') {
          gameMode.set('free');
          if (event.spin !== undefined && event.spinsTotal !== undefined) {
            freeSpins.update((fs) => ({
              ...fs,
              remaining: Math.max(0, event.spinsTotal! - event.spin!),
              total: event.spinsTotal!,
              globalMultiplier: event.globalMultiplier ?? fs.globalMultiplier,
            }));
          }
          await this.wait(this.timings.freeSpinReveal);
        } else {
          await this.wait(this.timings.reveal);
        }
        sound.play('reelStop');
        return runningWin;
      }

      case 'lineWins': {
        if (event.wins.length > 0) {
          bus.emit('wins:lines', { wins: event.wins, betPerLine });
          runningWin += event.amount * bet;
          totalWin.set(round2(runningWin));
          const tier = classifyWin(event.amount);
          bus.emit('celebrate', { tier, amount: event.amount * bet });
          sound.play(tier === 'small' ? 'win' : 'bigWin');
          await this.wait(this.timings.lineWins);
        }
        return runningWin;
      }

      case 'wayWins': {
        if (event.wins.length > 0) {
          bus.emit('wins:lines', { wins: event.wins, betPerLine });
          runningWin += event.amount * bet;
          totalWin.set(round2(runningWin));
          const tier = classifyWin(event.amount);
          bus.emit('celebrate', { tier, amount: event.amount * bet });
          sound.play(tier === 'small' ? 'win' : 'bigWin');
          await this.wait(this.timings.lineWins);
        }
        return runningWin;
      }

      case 'clusterWins': {
        if (event.wins.length > 0) {
          bus.emit('wins:lines', { wins: event.wins, betPerLine });
          runningWin += event.amount * bet;
          totalWin.set(round2(runningWin));
          const tier = classifyWin(event.amount);
          bus.emit('celebrate', { tier, amount: event.amount * bet });
          sound.play(tier === 'small' ? 'win' : 'bigWin');
          await this.wait(this.timings.lineWins);
        }
        return runningWin;
      }

      case 'scatterWin': {
        bus.emit('wins:scatter', { count: event.count, amount: event.amount });
        runningWin += event.amount * bet;
        totalWin.set(round2(runningWin));
        sound.play('scatter');
        await this.wait(this.timings.scatter);
        return runningWin;
      }

      case 'freeSpinTrigger': {
        resetFreeSpins();
        freeSpins.set({
          remaining: event.awarded,
          total: event.awarded,
          globalMultiplier: event.startMultiplier,
          accumulated: 0,
        });
        gameMode.set('free');
        bus.emit('freespins:start', {
          awarded: event.awarded,
          startMultiplier: event.startMultiplier,
        });
        sound.play('freeSpinStart');
        await this.wait(this.timings.freeSpinTransition);
        return runningWin;
      }

      case 'freeSpinResult': {
        if (event.wins.length > 0 || (event.scatter && event.scatter.amount > 0)) {
          if (event.wins.length > 0) {
            bus.emit('wins:lines', { wins: event.wins, betPerLine });
          }
          runningWin += event.amount * bet;
          totalWin.set(round2(runningWin));
          freeSpins.update((fs) => ({ ...fs, accumulated: round2(fs.accumulated + event.amount * bet) }));
          const tier = classifyWin(event.amount);
          bus.emit('celebrate', { tier, amount: event.amount * bet });
          sound.play(tier === 'small' ? 'win' : 'bigWin');
          await this.wait(this.timings.lineWins);
        }
        return runningWin;
      }

      case 'ladderStep': {
        freeSpins.update((fs) => ({ ...fs, globalMultiplier: event.globalMultiplier }));
        bus.emit('ladder:step', { globalMultiplier: event.globalMultiplier });
        await this.wait(this.timings.ladder);
        return runningWin;
      }

      case 'freeSpinRetrigger': {
        freeSpins.update((fs) => ({
          ...fs,
          remaining: fs.remaining + event.awarded,
          total: event.spinsTotal,
        }));
        bus.emit('freespins:retrigger', {
          awarded: event.awarded,
          spinsTotal: event.spinsTotal,
        });
        sound.play('scatter');
        await this.wait(this.timings.scatter);
        return runningWin;
      }

      case 'freeSpinEnd': {
        bus.emit('freespins:end', { totalWin: event.totalWin });
        await this.wait(this.timings.freeSpinEnd);
        gameMode.set('base');
        resetFreeSpins();
        return runningWin;
      }

      case 'finalWin': {
        const finalDollars = round2(event.amount * bet);
        totalWin.set(finalDollars);
        bus.emit('round:final', { amount: event.amount, wincap: event.wincap });
        if (event.amount > 0) {
          bus.emit('celebrate', {
            tier: event.wincap ? 'wincap' : classifyWin(event.amount),
            amount: finalDollars,
          });
        }
        await this.wait(this.timings.settle);
        return finalDollars;
      }

      default: {
        // Exhaustiveness guard — every BookEvent variant is handled above.
        const _never: never = event;
        return _never as unknown as number;
      }
    }
  }
}

/** Whether a book contains a free-spin trigger. */
function bookTriggersFeature(book: Book): boolean {
  return book.events.some((e) => e.type === 'freeSpinTrigger');
}

/** Round to 2 decimals (currency). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Re-export so callers can read the configured stake quickly. */
export { getCurrentBet };
