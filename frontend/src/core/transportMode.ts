/**
 * Decides which RGS transport the client is allowed to use, and — critically —
 * refuses the in-browser mock (fake-money) RGS in a production build unless it
 * is explicitly opted into.
 *
 * The client silently falls back to the mock RGS whenever the `rgs_url` /
 * `sessionID` params are absent. That is exactly right for local dev, the demo
 * page and QA replay, but in a real deployment a missing param would otherwise
 * serve a fully-playable fake-money game against a 1000-credit local wallet.
 * This pure resolver makes that a hard, visible error instead — defense in
 * depth around "did we ship the demo build to production?".
 *
 * Pure and env-injected so it is fully unit-testable; App.svelte passes the
 * real Vite env + parsed params.
 */
import type { RgsParams } from './rgsClient';

/** The transport the app should construct. */
export type TransportMode = 'real' | 'mock' | 'refused';

/** Environment inputs the decision depends on (subset of `import.meta.env`). */
export interface TransportEnv {
  /** `import.meta.env.PROD` — true in a production build. */
  prod: boolean;
  /** `VITE_ENABLE_MOCK_RGS` — explicit opt-in to the mock even in production. */
  enableMock?: string | boolean | undefined;
}

/** Result of {@link resolveTransportMode}: the mode plus a reason when refused. */
export interface TransportDecision {
  mode: TransportMode;
  /** Populated only when `mode === 'refused'` — a stable, loggable reason code. */
  reason?: 'mock-in-production';
}

/** Whether the mock opt-in flag is truthy (`"true"`/`"1"`/true). */
function mockExplicitlyEnabled(flag: TransportEnv['enableMock']): boolean {
  if (flag === true) return true;
  if (typeof flag === 'string') {
    const v = flag.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
}

/**
 * Resolve the transport mode.
 *
 * - Real RGS params present (`rgsUrl` + `sessionID`) → `real`.
 * - Params absent, non-production build → `mock` (dev / demo / QA).
 * - Params absent, production build → `refused`, UNLESS `VITE_ENABLE_MOCK_RGS`
 *   is explicitly set (e.g. a hosted demo), in which case `mock`.
 */
export function resolveTransportMode(params: RgsParams, env: TransportEnv): TransportDecision {
  const hasRealSession = Boolean(params.rgsUrl) && Boolean(params.sessionID);
  if (hasRealSession) return { mode: 'real' };
  if (!env.prod || mockExplicitlyEnabled(env.enableMock)) return { mode: 'mock' };
  return { mode: 'refused', reason: 'mock-in-production' };
}
