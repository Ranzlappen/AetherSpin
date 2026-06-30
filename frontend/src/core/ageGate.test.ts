import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { ageGateOpen, acknowledgeAge } from './ageGate';
import { ageGateEnabled, ageRating } from '../config/responsibleGaming';

describe('age/legal gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is OFF by default for NovaForged (operator gates KYC upstream)', () => {
    // NovaForged does not set responsibleGaming.requireAgeAck, so the gate is
    // disabled and never blocks play — the default for operator-embedded games.
    expect(ageGateEnabled).toBe(false);
    expect(get(ageGateOpen)).toBe(false);
  });

  it('exposes a numeric age rating (0 when unset)', () => {
    expect(typeof ageRating).toBe('number');
    expect(ageRating).toBeGreaterThanOrEqual(0);
  });

  it('acknowledgeAge() closes the gate and persists per game+version', () => {
    acknowledgeAge();
    expect(get(ageGateOpen)).toBe(false);
    // A versioned key is written so a returning player isn't re-prompted, but a
    // new game version (changed terms) would prompt again.
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('aetherspin.ageAck.'));
    expect(keys.length).toBe(1);
    expect(localStorage.getItem(keys[0])).toBe('1');
  });
});
