/**
 * Free-spins splash state: shows the "FREE SPINS" card art while the bookPlayer
 * holds on `freeSpinTrigger` (its `freeSpinTransition` pause), and a "TOTAL WIN"
 * summary while it holds on `freeSpinEnd` — then auto-hides. Presentation-only —
 * mirrors `celebration.ts` for win overlays.
 */
import { get, writable, type Writable } from 'svelte/store';
import { bus } from './eventBus';
import { freeSpins, turbo } from './gameState';
import { prefersReducedMotion } from './a11y';

/**
 * The splash currently on screen (null when idle): the feature intro (spins
 * awarded by the trigger) or the end-of-feature summary (accumulated win, in
 * dollars, read from the free-spins store before it resets).
 */
export type FreeSpinsSplash = { awarded: number } | { totalWin: number };

/** How long the splash stays up (ms) — tuned to the freeSpinTransition hold. */
export const SPLASH_DURATION_MS = 1400;
/** Shorter hold under turbo or OS reduce-motion. */
export const SPLASH_SHORT_DURATION_MS = 550;

/** The splash the overlay should render right now. */
export const activeSplash: Writable<FreeSpinsSplash | null> = writable(null);

let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Hide the splash (auto-timeout or tap-to-dismiss). */
export function dismissSplash(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = undefined;
  activeSplash.set(null);
}

function show(splash: FreeSpinsSplash): void {
  if (hideTimer) clearTimeout(hideTimer);
  activeSplash.set(splash);
  const short = get(turbo) || get(prefersReducedMotion);
  hideTimer = setTimeout(dismissSplash, short ? SPLASH_SHORT_DURATION_MS : SPLASH_DURATION_MS);
}

/**
 * Start listening for free-spin triggers and feature ends. Returns a teardown
 * function that unsubscribes and clears any visible splash (call on component
 * destroy).
 */
export function initFreeSpinsSplash(): () => void {
  const offStart = bus.on('freespins:start', (p) => show({ awarded: p.awarded }));
  const offEnd = bus.on('freespins:end', () => {
    // The store still holds the feature's accumulated dollars here — the book
    // player resets it only after the freeSpinEnd hold this splash rides on.
    const won = get(freeSpins).accumulated;
    if (won > 0) show({ totalWin: won });
  });
  return () => {
    offStart();
    offEnd();
    dismissSplash();
  };
}
