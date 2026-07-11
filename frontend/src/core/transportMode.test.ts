import { describe, it, expect } from 'vitest';
import { resolveTransportMode } from './transportMode';
import type { RgsParams } from './rgsClient';

const REAL: RgsParams = { rgsUrl: 'https://rgs.example', sessionID: 's-1', lang: 'en', currency: 'USD' };
const NO_SESSION: RgsParams = { rgsUrl: null, sessionID: null, lang: 'en', currency: null };
const PARTIAL: RgsParams = { rgsUrl: 'https://rgs.example', sessionID: null, lang: 'en', currency: null };

describe('resolveTransportMode', () => {
  it('uses the real RGS whenever both rgsUrl and sessionID are present', () => {
    expect(resolveTransportMode(REAL, { prod: true }).mode).toBe('real');
    expect(resolveTransportMode(REAL, { prod: false }).mode).toBe('real');
  });

  it('treats a partial session (missing sessionID) as no session', () => {
    // In prod that must refuse, not silently mock.
    expect(resolveTransportMode(PARTIAL, { prod: true })).toEqual({
      mode: 'refused',
      reason: 'mock-in-production',
    });
    expect(resolveTransportMode(PARTIAL, { prod: false }).mode).toBe('mock');
  });

  it('allows the mock in a non-production build with no session (dev/demo/QA)', () => {
    expect(resolveTransportMode(NO_SESSION, { prod: false }).mode).toBe('mock');
  });

  it('REFUSES the mock in a production build with no session (fail closed)', () => {
    expect(resolveTransportMode(NO_SESSION, { prod: true })).toEqual({
      mode: 'refused',
      reason: 'mock-in-production',
    });
  });

  it('allows the mock in production only when explicitly opted in', () => {
    for (const flag of ['true', '1', 'yes', true]) {
      expect(resolveTransportMode(NO_SESSION, { prod: true, enableMock: flag }).mode).toBe('mock');
    }
  });

  it('ignores a falsy/garbage opt-in flag in production', () => {
    for (const flag of ['false', '0', 'no', '', undefined, 'maybe']) {
      expect(resolveTransportMode(NO_SESSION, { prod: true, enableMock: flag }).mode).toBe('refused');
    }
  });

  it('a real session always wins, even in production without the mock flag', () => {
    expect(resolveTransportMode(REAL, { prod: true, enableMock: 'false' }).mode).toBe('real');
  });
});
