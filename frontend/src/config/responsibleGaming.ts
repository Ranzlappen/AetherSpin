/**
 * Typed access to the optional `responsibleGaming` policy from the canonical
 * game definition, with safe defaults when a game omits it. Operator-compliance
 * UX (reality-check cadence, help link) is sourced here so no component reads
 * the raw definition shape.
 */
import { gameDefinition } from './gameConfig';

const rg = gameDefinition.responsibleGaming ?? {};

/** Minutes between reality-check reminders (0 disables the feature). */
export const realityCheckMinutes = rg.realityCheckMinutes ?? 0;

/** Operator help / limit-setting URL (empty string when not configured). */
export const helpUrl = rg.helpUrl ?? '';

/** Whether periodic reality-check reminders are enabled for this game. */
export const realityCheckEnabled = realityCheckMinutes > 0;

/** Minimum player age for the age/legal acknowledgement (0 when unset). */
export const ageRating = rg.ageRating ?? 0;

/** Optional extra legal/terms line shown in the age + reality-check dialogs. */
export const legalDisclaimer = rg.legalDisclaimer ?? '';

/**
 * Whether to show a one-time age/legal acknowledgement before play.
 *
 * Off by default: Stake-style operator-embedded games enforce KYC/age-gating
 * upstream before the iframe loads, so a game opts in only when it must carry
 * its own acknowledgement (`responsibleGaming.requireAgeAck: true`).
 */
export const ageGateEnabled = rg.requireAgeAck === true;
