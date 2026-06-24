import { describe, it, expect } from 'vitest';
import { MockRgsClient } from './mockRgs';
import type { Book, BookEvent } from '../../../shared/src/types/events';
import { NUM_REELS, NUM_ROWS, WINCAP_MULTIPLIER } from '../config/gameConfig';

const params = { sessionID: null, rgsUrl: null, lang: 'en', currency: 'USD' };

/** Assert a value is a valid board shape. */
function assertBoard(board: unknown): void {
  expect(Array.isArray(board)).toBe(true);
  const b = board as string[][];
  expect(b.length).toBe(NUM_REELS);
  for (const col of b) {
    expect(col.length).toBe(NUM_ROWS);
    for (const sym of col) expect(typeof sym).toBe('string');
  }
}

/** Validate a single event conforms to the BookEvent union. */
function validateEvent(e: BookEvent): void {
  switch (e.type) {
    case 'reveal':
      assertBoard(e.board);
      expect(e.reelStops.length).toBe(NUM_REELS);
      expect(['base', 'free']).toContain(e.gameType);
      break;
    case 'lineWins':
      expect(typeof e.amount).toBe('number');
      for (const w of e.wins) {
        expect(typeof w.line).toBe('number');
        expect(typeof w.symbol).toBe('string');
        expect(w.count).toBeGreaterThanOrEqual(3);
        expect(typeof w.wildMultiplier).toBe('number');
        expect(typeof w.amount).toBe('number');
      }
      break;
    case 'wayWins':
      expect(typeof e.amount).toBe('number');
      for (const w of e.wins) {
        expect(typeof w.symbol).toBe('string');
        expect(w.count).toBeGreaterThanOrEqual(3);
        expect(w.ways).toBeGreaterThanOrEqual(1);
        expect(typeof w.wildMultiplier).toBe('number');
        expect(typeof w.amount).toBe('number');
      }
      break;
    case 'scatterWin':
      expect(e.count).toBeGreaterThanOrEqual(3);
      expect(typeof e.amount).toBe('number');
      break;
    case 'freeSpinTrigger':
      expect(e.scatters).toBeGreaterThanOrEqual(3);
      expect(e.awarded).toBeGreaterThan(0);
      expect(typeof e.startMultiplier).toBe('number');
      break;
    case 'freeSpinResult':
      expect(typeof e.spin).toBe('number');
      expect(Array.isArray(e.wins)).toBe(true);
      expect(typeof e.globalMultiplier).toBe('number');
      expect(typeof e.amount).toBe('number');
      break;
    case 'ladderStep':
      expect(typeof e.globalMultiplier).toBe('number');
      break;
    case 'freeSpinRetrigger':
      expect(e.awarded).toBeGreaterThan(0);
      expect(typeof e.spinsTotal).toBe('number');
      break;
    case 'freeSpinEnd':
      expect(typeof e.totalWin).toBe('number');
      break;
    case 'finalWin':
      expect(typeof e.amount).toBe('number');
      expect(typeof e.wincap).toBe('boolean');
      break;
    default: {
      const _never: never = e;
      throw new Error(`Unknown event type: ${JSON.stringify(_never)}`);
    }
  }
}

/** Validate overall book structure + event ordering invariants. */
function validateBook(book: Book): void {
  expect(typeof book.id).toBe('number');
  expect(typeof book.payoutMultiplier).toBe('number');
  expect(book.events.length).toBeGreaterThan(0);
  for (const e of book.events) validateEvent(e);

  const types = book.events.map((e) => e.type);
  // Must begin with a base reveal and end with finalWin.
  expect(types[0]).toBe('reveal');
  expect(types[types.length - 1]).toBe('finalWin');
  // payoutMultiplier never exceeds the win cap.
  expect(book.payoutMultiplier).toBeLessThanOrEqual(WINCAP_MULTIPLIER + 1e-6);
  // freeSpinTrigger (if present) precedes freeSpinEnd.
  const trig = types.indexOf('freeSpinTrigger');
  if (trig >= 0) {
    expect(types.indexOf('freeSpinEnd')).toBeGreaterThan(trig);
  }
}

describe('MockRgsClient procedural books', () => {
  it('authenticates with a positive balance and config', async () => {
    const client = new MockRgsClient({ params, startingBalance: 1000, seed: 1 });
    const auth = await client.authenticate();
    expect(auth.statusCode).toBe('SUCCESS');
    expect(auth.balance.amount).toBe(1000);
    expect(auth.config.betLevels.length).toBeGreaterThan(0);
  });

  it('generates base-game books that conform to the BookEvent union', async () => {
    const client = new MockRgsClient({ params, seed: 42 });
    for (let i = 0; i < 200; i++) {
      const res = await client.play(1, 'base');
      expect(res.round.book).not.toBeNull();
      validateBook(res.round.book as Book);
      await client.endRound();
    }
  });

  it('buy-bonus always triggers free spins', async () => {
    const client = new MockRgsClient({ params, startingBalance: 100000, seed: 7 });
    for (let i = 0; i < 25; i++) {
      const res = await client.play(1, 'bonus');
      const book = res.round.book as Book;
      validateBook(book);
      const hasTrigger = book.events.some((e) => e.type === 'freeSpinTrigger');
      expect(hasTrigger).toBe(true);
      await client.endRound();
    }
  });

  it('debits the stake on play and credits the win on endRound', async () => {
    const client = new MockRgsClient({ params, startingBalance: 100, seed: 3 });
    const play = await client.play(10, 'base');
    expect(play.balance.amount).toBeCloseTo(90, 4);
    const end = await client.endRound();
    const expectedWin = play.round.payoutMultiplier * 10;
    expect(end.balance.amount).toBeCloseTo(90 + expectedWin, 4);
  });

  it('rejects a bet larger than the balance with ERR_IPB', async () => {
    const client = new MockRgsClient({ params, startingBalance: 5, seed: 9 });
    await expect(client.play(10, 'base')).rejects.toMatchObject({ code: 'ERR_IPB' });
  });
});
