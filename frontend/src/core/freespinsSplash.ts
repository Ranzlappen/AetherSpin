/**
 * Free-spins intro splash state: shows the "FREE SPINS" card art while the
 * bookPlayer holds on `freeSpinTrigger` (its `freeSpinTransition` pause), then
 * auto-hides. Presentation-only — mirrors `celebration.ts` for win overlays.
 */
import { get, writable, type Writable } from 'svelte/store';
import { bus } from './eventBus';
import { turbo } from './gameState';
import { prefersReducedMotion } from './a11y';

/** The splash currently on screen (null when idle). */
export interface FreeSpinsSplash {
  /** Spins awarded by the trigger. */
  awarded: number;
}

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

function show(awarded: number): void {
  if (hideTimer) clearTimeout(hideTimer);
  activeSplash.set({ awarded });
  const short = get(turbo) || get(prefersReducedMotion);
  hideTimer = setTimeout(dismissSplash, short ? SPLASH_SHORT_DURATION_MS : SPLASH_DURATION_MS);
}

/**
 * Start listening for free-spin triggers. Returns a teardown function that
 * unsubscribes and clears any visible splash (call on component destroy).
 */
export function initFreeSpinsSplash(): () => void {
  const off = bus.on('freespins:start', (p) => show(p.awarded));
  return () => {
    off();
    dismissSplash();
  };
}
