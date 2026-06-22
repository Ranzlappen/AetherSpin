import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  balance,
  currency,
  betLevelIndex,
  currentBet,
  increaseBet,
  decreaseBet,
  insufficientFunds,
  balanceLabel,
  freeSpins,
  resetFreeSpins,
  getCurrentBet,
} from './gameState';
import { betLevels, defaultBetLevelIndex } from '../config/gameConfig';

beforeEach(() => {
  betLevelIndex.set(defaultBetLevelIndex);
  balance.set(1000);
  currency.set('USD');
  resetFreeSpins();
});

describe('bet level logic', () => {
  it('currentBet tracks the selected level', () => {
    betLevelIndex.set(0);
    expect(get(currentBet)).toBe(betLevels[0]);
    betLevelIndex.set(betLevels.length - 1);
    expect(get(currentBet)).toBe(betLevels[betLevels.length - 1]);
  });

  it('increaseBet/decreaseBet clamp to the level bounds', () => {
    betLevelIndex.set(0);
    decreaseBet();
    expect(get(betLevelIndex)).toBe(0);

    betLevelIndex.set(betLevels.length - 1);
    increaseBet();
    expect(get(betLevelIndex)).toBe(betLevels.length - 1);

    betLevelIndex.set(2);
    increaseBet();
    expect(get(betLevelIndex)).toBe(3);
    decreaseBet();
    expect(get(betLevelIndex)).toBe(2);
  });

  it('getCurrentBet reads the dollar value synchronously', () => {
    betLevelIndex.set(3);
    expect(getCurrentBet()).toBe(betLevels[3]);
  });
});

describe('derived stores', () => {
  it('insufficientFunds is true only when balance < bet', () => {
    betLevelIndex.set(betLevels.length - 1); // max bet
    balance.set(0);
    expect(get(insufficientFunds)).toBe(true);
    balance.set(betLevels[betLevels.length - 1]);
    expect(get(insufficientFunds)).toBe(false);
  });

  it('balanceLabel formats as currency', () => {
    balance.set(1234.5);
    currency.set('USD');
    expect(get(balanceLabel)).toMatch(/\$1,234\.50/);
  });
});

describe('free spins state', () => {
  it('resetFreeSpins returns to idle defaults', () => {
    freeSpins.set({ remaining: 5, total: 8, globalMultiplier: 3, accumulated: 99 });
    resetFreeSpins();
    expect(get(freeSpins)).toEqual({
      remaining: 0,
      total: 0,
      globalMultiplier: 1,
      accumulated: 0,
    });
  });
});
