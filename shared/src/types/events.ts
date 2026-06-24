/**
 * Book-event vocabulary — the contract between the math engine and the frontend.
 *
 * A "book" is one simulated round: { id, payoutMultiplier, events }. The frontend
 * replays `events` in order to drive the presentation. These types mirror exactly
 * what `math/simulator/engine.py` emits (and what the official-SDK
 * `game_events.py` is kept consistent with).
 */

export type GameType = 'base' | 'free';

/** board[reel][row] symbol id, top -> bottom. */
export type Board = string[][];

export interface LineWin {
  line: number;
  symbol: string;
  count: number;
  wildMultiplier: number;
  amount: number;
}

export interface RevealEvent {
  type: 'reveal';
  gameType: GameType;
  board: Board;
  reelStops: number[];
  spin?: number;
  spinsTotal?: number;
  globalMultiplier?: number;
  expandedReels?: number[];
  /** Realized per-cell wild multipliers for this board (free game only). */
  multiplierWilds?: Array<{ reel: number; row: number; value: number }>;
}

export interface LineWinsEvent {
  type: 'lineWins';
  gameType: GameType;
  wins: LineWin[];
  amount: number;
}

export interface ScatterWinEvent {
  type: 'scatterWin';
  count: number;
  amount: number;
}

export interface FreeSpinTriggerEvent {
  type: 'freeSpinTrigger';
  scatters: number;
  awarded: number;
  startMultiplier: number;
}

export interface FreeSpinResultEvent {
  type: 'freeSpinResult';
  spin: number;
  wins: LineWin[];
  scatter: { count: number; amount: number } | null;
  globalMultiplier: number;
  amount: number;
}

export interface LadderStepEvent {
  type: 'ladderStep';
  globalMultiplier: number;
}

export interface FreeSpinRetriggerEvent {
  type: 'freeSpinRetrigger';
  scatters: number;
  awarded: number;
  spinsTotal: number;
}

export interface FreeSpinEndEvent {
  type: 'freeSpinEnd';
  totalWin: number;
}

export interface FinalWinEvent {
  type: 'finalWin';
  amount: number;
  wincap: boolean;
}

export type BookEvent =
  | RevealEvent
  | LineWinsEvent
  | ScatterWinEvent
  | FreeSpinTriggerEvent
  | FreeSpinResultEvent
  | LadderStepEvent
  | FreeSpinRetriggerEvent
  | FreeSpinEndEvent
  | FinalWinEvent;

export interface Book {
  id: number;
  payoutMultiplier: number;
  events: BookEvent[];
}
