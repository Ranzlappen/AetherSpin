import { describe, it, expect, afterEach } from 'vitest';
import { track, setTelemetrySink, type TelemetryEvent } from './telemetry';

afterEach(() => setTelemetrySink(null));

describe('telemetry', () => {
  it('is a no-op when no sink is installed', () => {
    expect(() => track({ type: 'spin:start', mode: 'base' })).not.toThrow();
  });

  it('forwards events to the sink with a timestamp', () => {
    const seen: Array<TelemetryEvent & { t: number }> = [];
    setTelemetrySink((e) => seen.push(e));
    track({ type: 'app:loaded', ms: 12, game: 'novaforged', mock: true });
    track({ type: 'spin:end', ms: 5, winMultiplier: 2, tier: 'win', feature: false });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ type: 'app:loaded', game: 'novaforged' });
    expect(typeof seen[0].t).toBe('number');
  });

  it('never lets a throwing sink surface to the caller', () => {
    setTelemetrySink(() => {
      throw new Error('analytics down');
    });
    expect(() => track({ type: 'rgs:error', code: 'ERR_IS' })).not.toThrow();
  });

  it('carries no player/session identifiers (PII-free)', () => {
    let captured: Record<string, unknown> | null = null;
    setTelemetrySink((e) => (captured = e as Record<string, unknown>));
    track({ type: 'spin:end', ms: 5, winMultiplier: 0, tier: 'none', feature: false });
    const keys = Object.keys(captured!);
    expect(keys).not.toContain('sessionID');
    expect(keys).not.toContain('playerId');
    expect(keys).not.toContain('userId');
  });
});
