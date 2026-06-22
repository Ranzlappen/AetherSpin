/**
 * Browser-safe amount conversion helpers.
 *
 * These mirror `shared/src/index.ts` exactly, but are re-declared here so the
 * frontend bundle never pulls in the shared package's Node-only `loadDefinition`
 * module (which imports `node:fs`/`node:path`). The multiplier values are
 * additionally cross-checked against the game definition at module load so the
 * two sources can never silently drift.
 */
import { gameDefinition } from '../config/gameConfig';

/** API amounts are integers: `dollars * API_AMOUNT_MULTIPLIER`. */
export const API_AMOUNT_MULTIPLIER = 1_000_000;
/** Book payouts are integers: `multiplier * BOOK_AMOUNT_MULTIPLIER`. */
export const BOOK_AMOUNT_MULTIPLIER = 100;

// Fail loudly in dev if the definition ever disagrees with these constants.
if (gameDefinition.currency.apiAmountMultiplier !== API_AMOUNT_MULTIPLIER) {
  console.warn('[amount] apiAmountMultiplier mismatch between definition and shared constant.');
}

/** Convert a dollar amount to the integer API amount. */
export const toApiAmount = (dollars: number): number => Math.round(dollars * API_AMOUNT_MULTIPLIER);

/** Convert an integer API amount back to dollars. */
export const fromApiAmount = (amount: number): number => amount / API_AMOUNT_MULTIPLIER;
