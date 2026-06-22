import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './eventBus';

describe('EventBus', () => {
  it('delivers typed payloads to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('ladder:step', handler);
    bus.emit('ladder:step', { globalMultiplier: 3 });
    expect(handler).toHaveBeenCalledWith({ globalMultiplier: 3 });
  });

  it('unsubscribes via the returned function and off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('log', handler);
    off();
    bus.emit('log', { message: 'x' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires exactly one time', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('log', handler);
    bus.emit('log', { message: 'a' });
    bus.emit('log', { message: 'b' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports unsubscribing during dispatch without skipping handlers', () => {
    const bus = new EventBus();
    const calls: number[] = [];
    const off1 = bus.on('log', () => {
      calls.push(1);
      off1();
    });
    bus.on('log', () => calls.push(2));
    bus.emit('log', { message: 'x' });
    expect(calls).toEqual([1, 2]);
  });

  it('clear() removes all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('log', handler);
    bus.clear();
    bus.emit('log', { message: 'x' });
    expect(handler).not.toHaveBeenCalled();
  });
});
