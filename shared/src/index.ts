/**
 * @aetherspin/shared — browser-safe entry: shared types + constants.
 *
 * Node-only filesystem helpers (loadGameDefinition / listGameIds) live in
 * `./node.ts` so this barrel can be safely bundled into the browser frontend.
 * In the browser, import game definitions directly as JSON instead:
 *   import def from "@aetherspin/shared/games/novaforged/game-definition.json";
 */
export * from './types/index.js';

/** Amount conversion constants matching the RGS / book formats. */
export const API_AMOUNT_MULTIPLIER = 1_000_000;
export const BOOK_AMOUNT_MULTIPLIER = 100;

/** Convert a dollar amount to the integer API amount. */
export const toApiAmount = (dollars: number): number => Math.round(dollars * API_AMOUNT_MULTIPLIER);
/** Convert an integer API amount back to dollars. */
export const fromApiAmount = (amount: number): number => amount / API_AMOUNT_MULTIPLIER;
