/**
 * Win-celebration overlay state: the store half of the tiered Big/Mega/Epic/Max
 * Win presentation. Subscribes to `celebrate` intents on the bus, filters them
 * to overlay-worthy tiers, and exposes the active celebration for the
 * `WinCelebration.svelte` overlay to render. Auto-dismisses after a
 * reduced-motion-aware duration; the player can dismiss earlier by tapping.
 *
 * Presentation-only — `bookPlayer` holds playback while the overlay shows, so
 * dismissing here never affects event application or settlement.
 */
import { get, writable, type Writable } from 'svelte/store';
import { bus, type WinTier } from './eventBus';
import { isOverlayTier } from './bookPlayer';
import { prefersReducedMotion } from './a11y';

/** The celebration currently on screen (null when idle). */
export interface ActiveCelebration {
  tier: WinTier;
  /** Win amount in dollars. */
  amount: number;
}

/** How long the overlay stays up before auto-dismissing (ms). */
export const CELEBRATION_DURATION_MS = 2600;
/** Shorter hold under OS reduce-motion (no count-up animation to wait for). */
export const CELEBRATION_REDUCED_DURATION_MS = 1400;

/** The celebration the overlay should render right now. */
export const activeCelebration: Writable<ActiveCelebration | null> = writable(null);

let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/** Hide the overlay (tap-to-dismiss or auto-timeout). */
export function dismissCelebration(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = undefined;
  activeCelebration.set(null);
}

function show(tier: WinTier, amount: number): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  activeCelebration.set({ tier, amount });
  const duration = get(prefersReducedMotion) ? CELEBRATION_REDUCED_DURATION_MS : CELEBRATION_DURATION_MS;
  dismissTimer = setTimeout(dismissCelebration, duration);
}

/**
 * Start listening for `celebrate` intents. Returns a teardown function that
 * unsubscribes and clears any visible celebration (call on component destroy).
 */
export function initCelebrations(): () => void {
  const off = bus.on('celebrate', (p) => {
    if (isOverlayTier(p.tier)) show(p.tier, p.amount);
  });
  return () => {
    off();
    dismissCelebration();
  };
}
