import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import type { Book } from '../../../shared/src/types/events';
import { parseReplayMode, loadReplayBooks, makeReplayProvider, replayStatus } from './replayRgs';

const fakeBook = (id: number): Book => ({ id, payoutMultiplier: id, events: [] });

describe('parseReplayMode', () => {
  it('maps the ?replay= value to a corpus mode', () => {
    expect(parseReplayMode(null)).toBeNull();
    expect(parseReplayMode('')).toBe('base');
    expect(parseReplayMode('base')).toBe('base');
    expect(parseReplayMode('bonus')).toBe('bonus');
    expect(parseReplayMode('anything-else')).toBe('base');
  });
});

describe('makeReplayProvider', () => {
  it('serves books in order, cycles, and publishes progress', () => {
    const books = [fakeBook(1), fakeBook(2)];
    const provider = makeReplayProvider(books, 'base');
    expect(get(replayStatus)).toEqual({ mode: 'base', index: 0, total: 2 });

    expect(provider(false, 10)).toBe(books[0]);
    expect(get(replayStatus)?.index).toBe(1);
    expect(provider(false, 11)).toBe(books[1]);
    expect(get(replayStatus)?.index).toBe(2);
    expect(provider(false, 12)).toBe(books[0]); // wraps around
    expect(get(replayStatus)?.index).toBe(1);
  });
});

describe('loadReplayBooks', () => {
  it('loads the committed corpus for a real game/mode', async () => {
    const books = await loadReplayBooks('novaforged', 'base');
    expect(books.length).toBeGreaterThan(0);
    expect(books[0]).toHaveProperty('payoutMultiplier');
    expect(books[0].events[0]?.type).toBe('reveal');
  });

  it('returns an empty array for an unknown game', async () => {
    expect(await loadReplayBooks('no-such-game', 'base')).toEqual([]);
  });
});
