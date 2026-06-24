import { describe, it, expect, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { balance } from './gameState';
import {
  startSession,
  stopSession,
  acknowledgeRealityCheck,
  realityCheckDue,
  sessionElapsedMinutes,
  sessionNet,
} from './session';

describe('responsible-gaming session', () => {
  afterEach(() => stopSession());

  it('reports zero elapsed minutes and net immediately after start', () => {
    balance.set(1000);
    startSession(1000);
    expect(sessionElapsedMinutes()).toBe(0);
    expect(sessionNet()).toBe(0);
  });

  it('tracks net position from the starting balance', () => {
    balance.set(1000);
    startSession(1000);
    balance.set(1250);
    expect(sessionNet()).toBe(250);
    balance.set(600);
    expect(sessionNet()).toBe(-400);
  });

  it('clears a pending reality check on acknowledge', () => {
    startSession(500);
    expect(get(realityCheckDue)).toBe(false);
    realityCheckDue.set(true);
    acknowledgeRealityCheck();
    expect(get(realityCheckDue)).toBe(false);
  });

  it('restarting the session resets the reality-check flag', () => {
    startSession(500);
    realityCheckDue.set(true);
    startSession(750); // a fresh session clears any pending reminder
    expect(get(realityCheckDue)).toBe(false);
    expect(sessionNet()).toBe(get(balance) - 750);
  });
});
