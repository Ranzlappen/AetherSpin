/**
 * Reactive game state as Svelte stores. This is the single source of UI truth;
 * components subscribe to these stores and never reach into the RGS client or
 * book player directly. The stores hold dollar amounts (not API integers).
 */
import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { betLevels, defaultBetLevelIndex, formatCurrency } from '../config/gameConfig';
import { localeTag } from './i18n';

/** High-level scene the player is currently in. */
export type GameMode = 'base' | 'free';

/** Free-spins feature state. */
export interface FreeSpinsState {
  /** Spins remaining (counts down). */
  remaining: number;
  /** Total spins awarded across the feature (including retriggers). */
  total: number;
  /** Current global win multiplier from the ladder. */
  globalMultiplier: number;
  /** Accumulated win across the feature, in dollars. */
  accumulated: number;
}

/** Autoplay configuration/state. */
export interface AutoplayState {
  active: boolean;
  /** Remaining auto spins, or `Infinity` for unlimited. */
  remaining: number;
  /** Stop autoplay automatically on any feature trigger. */
  stopOnFeature: boolean;
}

/** A summary of the most recently completed round. */
export interface RoundResult {
  betID: number | null;
  win: number;
  payoutMultiplier: number;
  triggeredFeature: boolean;
  wincap: boolean;
}

/** Player balance in dollars. */
export const balance: Writable<number> = writable(0);
/** Wallet currency code (e.g. `USD`). */
export const currency: Writable<string> = writable('USD');

/** Index into {@link betLevels}. */
export const betLevelIndex: Writable<number> = writable(defaultBetLevelIndex);

/** Current bet (dollars) derived from the selected level. */
export const currentBet: Readable<number> = derived(
  betLevelIndex,
  ($i) => betLevels[Math.max(0, Math.min($i, betLevels.length - 1))] ?? betLevels[0]
);

/** Total win of the current/last round (dollars). */
export const totalWin: Writable<number> = writable(0);

/** Whether a spin/round is currently in progress. */
export const isSpinning: Writable<boolean> = writable(false);

/** Current game mode (base game or free-spins). */
export const gameMode: Writable<GameMode> = writable('base');

/** Free-spins feature state. */
export const freeSpins: Writable<FreeSpinsState> = writable({
  remaining: 0,
  total: 0,
  globalMultiplier: 1,
  accumulated: 0,
});

/** Autoplay state. */
export const autoplay: Writable<AutoplayState> = writable({
  active: false,
  remaining: 0,
  stopOnFeature: true,
});

/** Result of the most recent round. */
export const lastResult: Writable<RoundResult | null> = writable(null);

/** Whether sound is muted. */
export const muted: Writable<boolean> = writable(false);

/** A transient error message for the UI toast (null when none). */
export const errorMessage: Writable<string | null> = writable(null);

/* ----------------------------- derived stores ----------------------------- */

/** Balance formatted as a localized currency string. */
export const balanceLabel: Readable<string> = derived([balance, currency, localeTag], ([$b, $c, $l]) =>
  formatCurrency($b, $c, $l)
);

/** Current bet formatted as a localized currency string. */
export const currentBetLabel: Readable<string> = derived(
  [currentBet, currency, localeTag],
  ([$bet, $c, $l]) => formatCurrency($bet, $c, $l)
);

/** Total win formatted as a localized currency string. */
export const totalWinLabel: Readable<string> = derived([totalWin, currency, localeTag], ([$w, $c, $l]) =>
  formatCurrency($w, $c, $l)
);

/** True when the player cannot afford the current base bet. */
export const insufficientFunds: Readable<boolean> = derived(
  [balance, currentBet],
  ([$balance, $bet]) => $balance < $bet
);

/* ------------------------------- mutations -------------------------------- */

/** Increase the bet level by one step (clamped to the highest level). */
export function increaseBet(): void {
  betLevelIndex.update((i) => Math.min(i + 1, betLevels.length - 1));
}

/** Decrease the bet level by one step (clamped to the lowest level). */
export function decreaseBet(): void {
  betLevelIndex.update((i) => Math.max(i - 1, 0));
}

/** Reset free-spins state to its idle defaults. */
export function resetFreeSpins(): void {
  freeSpins.set({ remaining: 0, total: 0, globalMultiplier: 1, accumulated: 0 });
}

/** Read the current bet synchronously (dollars). */
export function getCurrentBet(): number {
  return get(currentBet);
}
