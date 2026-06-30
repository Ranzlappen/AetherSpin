/**
 * One-time age/legal acknowledgement state.
 *
 * When a game opts in (`responsibleGaming.requireAgeAck`), the player confirms
 * they meet the minimum age and accept the terms before play. The choice is
 * persisted per game+version so a returning player isn't re-prompted, but a new
 * version (changed terms) prompts again. Informational/compliance only — it
 * never alters outcomes or balances.
 */
import { writable, type Writable } from 'svelte/store';
import { ageGateEnabled } from '../config/responsibleGaming';
import { gameDefinition } from '../config/gameConfig';

const STORAGE_KEY = `aetherspin.ageAck.${gameDefinition.id}.v${gameDefinition.version}`;

/** Read the persisted acknowledgement, tolerating private-mode/SSR localStorage. */
function readAck(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** `?ageGate=1` forces the gate on for QA/manual testing of a game that ships
 * with it off (the default). Never weakens a game that requires it. */
function forcedByQuery(): boolean {
  try {
    return (
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ageGate') === '1'
    );
  } catch {
    return false;
  }
}

/** True while the age/legal gate must block play (enabled — or QA-forced — and
 * not yet acknowledged). */
export const ageGateOpen: Writable<boolean> = writable((ageGateEnabled || forcedByQuery()) && !readAck());

/** Record the acknowledgement and close the gate. */
export function acknowledgeAge(): void {
  try {
    localStorage?.setItem(STORAGE_KEY, '1');
  } catch {
    // Persistence is best-effort; the gate still closes for this session.
  }
  ageGateOpen.set(false);
}
