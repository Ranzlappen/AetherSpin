/**
 * A tiny, fully-typed publish/subscribe emitter used to decouple the core game
 * logic (`bookPlayer`) from the Pixi presentation layer (`scenes/`). Core emits
 * presentation intents; scenes subscribe. No Pixi or Svelte imports here.
 */
import type { Board, Win } from '../../../shared/src/types/events';

/** Map of event name -> payload type carried on the bus. */
export interface GameEventMap {
  /** A new board has been revealed; scenes should render it. */
  'board:reveal': {
    board: Board;
    gameType: 'base' | 'free';
    expandedReels: number[];
    /** Reel indices (0-based) carrying multiplier wilds, and their values. */
    multiplierWilds: Array<{ reel: number; row: number; value: number }>;
    anticipation: boolean;
  };
  /** Highlight winning lines (lines games) or ways symbols (ways games). */
  'wins:lines': { wins: Win[]; betPerLine: number };
  /** Show a scatter win celebration. */
  'wins:scatter': { count: number; amount: number };
  /** A win celebration of the given magnitude should play. */
  celebrate: { tier: WinTier; amount: number };
  /** Free spins are about to begin. */
  'freespins:start': { awarded: number; startMultiplier: number };
  /** Additional free spins were awarded mid-feature. */
  'freespins:retrigger': { awarded: number; spinsTotal: number };
  /** The global multiplier ladder advanced. */
  'ladder:step': { globalMultiplier: number };
  /** Free spins ended. */
  'freespins:end': { totalWin: number };
  /** The round settled with a final win. */
  'round:final': { amount: number; wincap: boolean };
  /** Request the reels to spin (drives the spin animation start). */
  'reels:spin': { gameType: 'base' | 'free' };
  /** Generic UI/log channel. */
  log: { message: string };
}

/** Win-magnitude tiers used to size celebrations. */
export type WinTier = 'small' | 'medium' | 'big' | 'mega' | 'wincap';

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

/**
 * Minimal typed event emitter. Generic over {@link GameEventMap} so subscribers
 * receive correctly-typed payloads.
 */
// Loosely-typed handler used only for internal storage; the public methods
// preserve full per-event type safety for callers.
type AnyHandler = (payload: never) => void;

export class EventBus {
  private readonly handlers = new Map<keyof GameEventMap, Set<AnyHandler>>();

  /**
   * Subscribe to an event.
   * @returns An unsubscribe function.
   */
  on<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set<AnyHandler>();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  /** Subscribe to an event for a single emission only. */
  once<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** Remove a previously registered handler. */
  off<K extends keyof GameEventMap>(event: K, handler: Handler<K>): void {
    this.handlers.get(event)?.delete(handler as AnyHandler);
  }

  /** Emit an event to all subscribers. */
  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Iterate a copy so handlers can unsubscribe during dispatch.
    for (const handler of [...set]) {
      (handler as Handler<K>)(payload);
    }
  }

  /** Remove every handler (used on teardown). */
  clear(): void {
    this.handlers.clear();
  }
}

/** Shared application-wide event bus instance. */
export const bus = new EventBus();
