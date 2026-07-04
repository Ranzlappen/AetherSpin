/**
 * Autoplay run loop with jurisdiction-friendly stop conditions. Extracted from
 * the UI so the conditions are unit-testable: the caller injects the `spin`
 * function (and a delay for tests) and this module owns the loop, the
 * `autoplay` store transitions, and the stop reasons.
 *
 * A run stops when ANY of these hits:
 *  - the spin count is exhausted;
 *  - the balance can no longer cover the bet;
 *  - a feature triggered and "stop on feature" is on;
 *  - the round hit the win cap;
 *  - a single round's win reached the single-win limit;
 *  - cumulative losses since the run started reached the loss limit.
 *
 * Token-based cancellation: `stopAutoplay` (or starting a new run) invalidates
 * the in-flight loop, exactly like the previous App-owned implementation.
 */
import { get } from 'svelte/store';
import { autoplay, AUTOPLAY_IDLE, balance, errorMessage, insufficientFunds, lastResult } from './gameState';
import { realWait, type WaitFn } from './bookPlayer';
import { announce } from './a11y';
import { tn } from './i18n';

/** Options for a new autoplay run. Limits are in dollars; `null` = off. */
export interface AutoplayRunOptions {
  count: number;
  stopOnFeature?: boolean;
  lossLimit?: number | null;
  singleWinLimit?: number | null;
}

/** Dependencies injected by the caller (UI wires the real spin). */
export interface AutoplayDeps {
  /** Run one base-mode round to completion. */
  spin: () => Promise<void>;
  /** Delay between spins (injectable for tests). */
  delay?: WaitFn;
  /** Pause between autoplay spins (ms). */
  interSpinDelayMs?: number;
}

let token = 0;

/** Start an autoplay run (cancels any active run first). */
export function startAutoplay(options: AutoplayRunOptions, deps: AutoplayDeps): void {
  token++;
  autoplay.set({
    active: true,
    remaining: options.count,
    stopOnFeature: options.stopOnFeature ?? true,
    lossLimit: options.lossLimit ?? null,
    singleWinLimit: options.singleWinLimit ?? null,
    startBalance: get(balance),
  });
  void run(token, deps);
}

/** Stop the active run (if any) and reset the autoplay state. */
export function stopAutoplay(): void {
  token++;
  autoplay.set(AUTOPLAY_IDLE);
}

/** Announce why the run ended, both as a toast and to screen readers. */
function announceStop(
  reasonKey: 'error.autoplayInsufficient' | 'autoplay.stoppedLossLimit' | 'autoplay.stoppedWinLimit'
): void {
  const message = tn(reasonKey);
  errorMessage.set(message);
  announce(message);
}

/** Whether the completed round tripped a configured stop condition. */
function shouldStop(): boolean {
  const state = get(autoplay);
  const result = get(lastResult);
  if (state.stopOnFeature && result?.triggeredFeature) return true;
  if (result?.wincap) return true;
  if (state.singleWinLimit !== null && (result?.win ?? 0) >= state.singleWinLimit) {
    announceStop('autoplay.stoppedWinLimit');
    return true;
  }
  if (
    state.lossLimit !== null &&
    state.startBalance !== null &&
    state.startBalance - get(balance) >= state.lossLimit
  ) {
    announceStop('autoplay.stoppedLossLimit');
    return true;
  }
  return false;
}

/** Drive sequential autoplay spins until a stop condition or cancellation. */
async function run(myToken: number, deps: AutoplayDeps): Promise<void> {
  const delay = deps.delay ?? realWait;
  const gap = deps.interSpinDelayMs ?? 450;
  while (myToken === token && get(autoplay).active && get(autoplay).remaining > 0) {
    if (get(insufficientFunds)) {
      announceStop('error.autoplayInsufficient');
      break;
    }
    await deps.spin();
    if (myToken !== token) return; // cancelled mid-spin (e.g. spin error)
    autoplay.update((a) => ({ ...a, remaining: a.remaining - 1 }));
    if (shouldStop()) break;
    if (get(autoplay).remaining > 0) await delay(gap);
  }
  if (myToken === token) stopAutoplay();
}
