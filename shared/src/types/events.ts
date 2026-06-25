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

/** A single all-ways win (no fixed payline; carries the ways count). */
export interface WayWin {
  symbol: string;
  count: number;
  ways: number;
  wildMultiplier: number;
  amount: number;
}

/** A single cluster-pays win: a connected group of one symbol (wilds
 * substitute). `count` is the group size; `cells` are its board positions. */
export interface ClusterWin {
  symbol: string;
  count: number;
  wildMultiplier: number;
  amount: number;
  cells: Array<{ reel: number; row: number }>;
}

/** Any mechanic's win descriptor (lines carry `line`, ways `ways`, clusters `cells`). */
export type Win = LineWin | WayWin | ClusterWin;

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

export interface WayWinsEvent {
  type: 'wayWins';
  gameType: GameType;
  wins: WayWin[];
  amount: number;
}

export interface ClusterWinsEvent {
  type: 'clusterWins';
  gameType: GameType;
  wins: ClusterWin[];
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
  /** Wins for this free spin — line-, ways- or cluster-shaped per the mechanic. */
  wins: Win[];
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
  | WayWinsEvent
  | ClusterWinsEvent
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
