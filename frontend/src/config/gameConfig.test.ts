import { describe, it, expect } from 'vitest';
import {
  gameDefinition,
  getSymbol,
  getSymbolColor,
  getPayout,
  getBetMode,
  buyBonusMode,
  formatCurrency,
  formatMultiplier,
  NUM_REELS,
  NUM_ROWS,
  paylines,
  availableGames,
  activeGameId,
} from './gameConfig';

describe('gameConfig registry', () => {
  it('bundles multiple games and hides scaffolds', () => {
    expect(availableGames).toContain('novaforged');
    expect(availableGames).toContain('cosmicways');
    expect(availableGames).not.toContain('template'); // scaffold is hidden
    expect(availableGames).not.toContain('stellarclusters'); // math-only (no client cluster render yet)
  });

  it('defaults the active game to novaforged (no ?game= in the test env)', () => {
    expect(activeGameId).toBe('novaforged');
    expect(gameDefinition.id).toBe('novaforged');
  });
});

describe('gameConfig', () => {
  it('exposes engine dimensions from the definition', () => {
    expect(NUM_REELS).toBe(gameDefinition.engine.numReels);
    expect(NUM_ROWS).toBe(gameDefinition.engine.numRows);
    expect(NUM_REELS).toBe(5);
    expect(NUM_ROWS).toBe(3);
  });

  it('looks up symbols and colors', () => {
    expect(getSymbol('W')?.kind).toBe('wild');
    expect(getSymbol('S')?.kind).toBe('scatter');
    expect(getSymbolColor('H1')).toBe('#ffd166');
    expect(getSymbolColor('UNKNOWN')).toMatch(/^#/);
  });

  it('reads paytable multipliers and returns 0 for non-paying combos', () => {
    // Assert against the definition (not magic numbers) so re-tuning the RTP
    // never breaks this test.
    expect(getPayout('H1', 5)).toBe(gameDefinition.paytable.H1['5']);
    expect(getPayout('L5', 3)).toBe(gameDefinition.paytable.L5['3']);
    expect(getPayout('H1', 5)).toBeGreaterThan(0);
    expect(getPayout('H1', 2)).toBe(0);
    expect(getPayout('NOPE', 5)).toBe(0);
  });

  it('resolves bet modes including the buy-bonus mode', () => {
    expect(getBetMode('base')?.cost).toBe(1);
    expect(getBetMode('bonus')?.isBuyBonus).toBe(true);
    expect(buyBonusMode?.name).toBe('bonus');
  });

  it('has 20 paylines each spanning all reels', () => {
    expect(paylines.length).toBe(20);
    for (const line of paylines) expect(line.length).toBe(NUM_REELS);
  });

  it('formats currency and multipliers', () => {
    expect(formatCurrency(12.5, 'USD')).toMatch(/\$12\.50/);
    expect(formatMultiplier(3)).toBe('3.00x');
  });
});
