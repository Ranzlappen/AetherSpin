/**
 * Accessibility primitives shared across the UI.
 *
 * The game board is a Pixi canvas — opaque to assistive tech — so meaningful
 * state changes (spin start, win, feature) are mirrored into a polite ARIA
 * live region. Components announce via {@link announce}; `App.svelte` renders
 * the single visually-hidden live region bound to {@link announcement}.
 *
 * {@link prefersReducedMotion} reflects the OS "reduce motion" setting so the
 * renderer and CSS can tone down animation for vestibular safety.
 */
import { readable, writable, type Readable } from 'svelte/store';

/** Current text of the polite ARIA live region (empty when idle). */
export const announcement = writable<string>('');

let clearTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Announce a message to screen readers. Clears first so that repeating the same
 * text (e.g. two identical "No win" rounds) still re-triggers the live region.
 * @param message Human-readable, already-localized text.
 */
export function announce(message: string): void {
  announcement.set('');
  if (clearTimer) clearTimeout(clearTimer);
  // Next microtask-ish tick: set the text so the DOM mutation is observed.
  clearTimer = setTimeout(() => announcement.set(message), 50);
}

function reducedMotionStore(): Readable<boolean> {
  // jsdom/SSR-safe: if matchMedia is unavailable, motion is allowed (false).
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return readable(false);
  }
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  return readable(mq.matches, (set) => {
    const onChange = (e: MediaQueryListEvent): void => set(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
}

/** True when the user has requested reduced motion at the OS level. */
export const prefersReducedMotion: Readable<boolean> = reducedMotionStore();
