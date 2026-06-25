/**
 * Minimal, PII-free, opt-in telemetry. The game emits typed lifecycle/perf
 * events; by default they go nowhere (no-op sink). An operator wires a sink via
 * {@link setTelemetrySink} to forward them to their own analytics. Events
 * intentionally carry NO player/session identifiers — only timings, win tiers,
 * and error codes — so this is safe to ship enabled.
 */

/** The closed set of telemetry events (no PII by construction). */
export type TelemetryEvent =
  | { type: 'app:loaded'; ms: number; game: string; mock: boolean }
  | { type: 'spin:start'; mode: string }
  | { type: 'spin:end'; ms: number; winMultiplier: number; tier: string; feature: boolean }
  | { type: 'rgs:error'; code: string }
  | { type: 'render:contextlost' }
  | { type: 'render:restored' }
  | { type: 'error'; where: string; message: string };

/** A sink receives every tracked event, stamped with a monotonic timestamp. */
export type TelemetrySink = (event: TelemetryEvent & { t: number }) => void;

let sink: TelemetrySink | null = null;

/** Install (or remove, with `null`) the telemetry sink. */
export function setTelemetrySink(next: TelemetrySink | null): void {
  sink = next;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? Math.round(performance.now()) : 0;
}

/**
 * Emit a telemetry event. No-op when no sink is installed. A throwing sink is
 * swallowed — telemetry must never break gameplay.
 */
export function track(event: TelemetryEvent): void {
  if (!sink) return;
  try {
    sink({ ...event, t: nowMs() });
  } catch {
    /* never let an analytics failure surface to the player */
  }
}
