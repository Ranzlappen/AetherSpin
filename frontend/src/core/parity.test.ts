import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { BookPlayer } from './bookPlayer';
import type { Book, BookEvent } from '../../../shared/src/types/events';
import type { RgsTransport, PlayResult, AuthenticateResult, EndRoundResult, Balance } from './rgsClient';
import { balance, totalWin, gameMode, isSpinning, lastResult, resetFreeSpins } from './gameState';
import novaforged from '../../../shared/games/novaforged/game-definition.json';
import cosmicways from '../../../shared/games/cosmicways/game-definition.json';

/**
 * Cross-language parity against the committed golden-book corpus
 * (shared/fixtures/books, produced by math/scripts/gen_golden_corpus.py and
 * also checked by math/tests/test_parity.py).
 *
 * Two guards per book:
 *  1. Summed through the TypeScript `BookEvent` types, the win events reconcile
 *     to the book's declared `payoutMultiplier` (clamped to the win cap) — the
 *     same invariant the Python side asserts. If the math emitted an event the
 *     client doesn't account for, the sums diverge.
 *  2. The real `BookPlayer` replays every book without error and lands on the
 *     declared payout — proving the client accepts the exact event streams the
 *     engine produces.
 */

const WINCAP: Record<string, number> = {
  novaforged: novaforged.engine.wincapMultiplier,
  cosmicways: cosmicways.engine.wincapMultiplier,
};

// Eagerly load the committed corpus as raw text, keyed by `<game>_<mode>`.
const rawCorpus = import.meta.glob('../../../shared/fixtures/books/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface Fixture {
  name: string;
  game: string;
  books: Book[];
}

const fixtures: Fixture[] = Object.entries(rawCorpus).map(([path, text]) => {
  const name = path.split('/').pop()!.replace('.jsonl', '');
  const game = name.replace(/_(base|bonus)$/, '');
  const books = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Book);
  return { name, game, books };
});

/** Sum the win-bearing events using the typed BookEvent union. */
function winSum(events: BookEvent[]): number {
  let sum = 0;
  for (const e of events) {
    switch (e.type) {
      case 'lineWins':
      case 'wayWins':
      case 'scatterWin':
      case 'freeSpinResult':
        sum += e.amount;
        break;
      default:
        break;
    }
  }
  return sum;
}

/** A transport that replays a fixed book (mirrors bookPlayer.test.ts). */
class ReplayTransport implements RgsTransport {
  readonly params = { sessionID: 's', rgsUrl: 'r', lang: 'en', currency: 'USD' };
  constructor(private readonly book: Book) {}
  async authenticate(): Promise<AuthenticateResult> {
    return {
      balance: { amount: 100, currency: 'USD' },
      config: { minBet: 0.1, maxBet: 100, stepBet: 0.1, betLevels: [] },
      round: null,
      statusCode: 'SUCCESS',
    };
  }
  async play(): Promise<PlayResult> {
    return {
      round: { betID: 1, state: 'placed', payoutMultiplier: this.book.payoutMultiplier, book: this.book },
      balance: { amount: 100, currency: 'USD' },
      statusCode: 'SUCCESS',
    };
  }
  async endRound(): Promise<EndRoundResult> {
    return { balance: { amount: 100, currency: 'USD' }, statusCode: 'SUCCESS' };
  }
  async getBalance(): Promise<Balance> {
    return { amount: 100, currency: 'USD' };
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

it('loads a non-empty corpus for both games', () => {
  expect(fixtures.length).toBeGreaterThanOrEqual(4);
  expect(fixtures.some((f) => f.game === 'novaforged')).toBe(true);
  expect(fixtures.some((f) => f.game === 'cosmicways')).toBe(true);
  for (const f of fixtures) expect(f.books.length).toBeGreaterThan(0);
});

for (const fixture of fixtures) {
  describe(`parity — ${fixture.name}`, () => {
    const wincap = WINCAP[fixture.game];

    it('win events reconcile to the declared payout (clamped to wincap)', () => {
      for (const book of fixture.books) {
        const expected = Math.min(winSum(book.events), wincap);
        // Same 6-dp accumulated-rounding tolerance as the Python side.
        expect(Math.abs(book.payoutMultiplier - expected)).toBeLessThan(1e-4);
      }
    });

    it('the BookPlayer replays every book to the declared payout', async () => {
      for (const book of fixture.books) {
        totalWin.set(0);
        const player = new BookPlayer({ transport: new ReplayTransport(book), wait: instantWait });
        await player.play(1, 'base');
        // bet = 1, so the final dollar total equals payoutMultiplier (2-dp rounded).
        expect(get(totalWin)).toBeCloseTo(Math.round(book.payoutMultiplier * 100) / 100, 6);
        expect(get(lastResult)?.payoutMultiplier).toBe(book.payoutMultiplier);
      }
    });
  });
}
