/**
 * Responsible-gaming session tracking: elapsed play time, net position, and a
 * periodic "reality check" reminder. The client surfaces this information; hard
 * limits and self-exclusion remain enforced by the operator/RGS. Outcomes are
 * never affected here — this is informational, anti-dark-pattern UX only.
 */
import { get, writable, type Writable } from 'svelte/store';
import { balance } from './gameState';
import { realityCheckEnabled, realityCheckMinutes } from '../config/responsibleGaming';

/** Epoch ms when the current session started. */
const sessionStart: Writable<number> = writable(nowMs());
/** Balance at session start, used to compute the net position. */
let initialBalance = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** True when a reality-check reminder is pending acknowledgement. */
export const realityCheckDue: Writable<boolean> = writable(false);

function nowMs(): number {
  return Date.now();
}

/**
 * Begin (or restart) session tracking. Call once the wallet is authenticated.
 * @param startingBalance Player balance at session start (dollars).
 */
export function startSession(startingBalance: number): void {
  initialBalance = startingBalance;
  sessionStart.set(nowMs());
  realityCheckDue.set(false);
  if (timer) clearInterval(timer);
  if (realityCheckEnabled) {
    timer = setInterval(() => realityCheckDue.set(true), realityCheckMinutes * 60_000);
  }
}

/** Acknowledge the current reminder; the next one fires after another interval. */
export function acknowledgeRealityCheck(): void {
  realityCheckDue.set(false);
}

/** Stop session tracking and clear the reminder timer. */
export function stopSession(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

/** Whole minutes elapsed since the session started. */
export function sessionElapsedMinutes(): number {
  return Math.max(0, Math.floor((nowMs() - get(sessionStart)) / 60_000));
}

/** Net position this session (dollars): positive is up, negative is down. */
export function sessionNet(): number {
  return get(balance) - initialBalance;
}
