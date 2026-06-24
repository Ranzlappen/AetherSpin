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
