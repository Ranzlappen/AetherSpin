/**
 * In-browser mock of the RGS, used for local development when no `rgsUrl`/
 * `sessionID` is present in the URL. It makes NovaForged fully playable with no
 * backend.
 *
 * Strategy:
 *  1. If real generated books are present under `src/assets/books/*.jsonl`
 *     (e.g. copied from `math/library/novaforged/books`), they are loaded and
 *     replayed verbatim — this is the highest-fidelity mode.
 *  2. Otherwise outcomes are generated procedurally from the game definition,
 *     emitting weighted-random {@link BookEvent}s that conform exactly to the
 *     `BookEvent` union and event ordering used by the math engine.
 *
 * No Pixi or Svelte imports.
 */
import type { Book, BookEvent, Board, LineWin, GameType } from '../../../shared/src/types/events';
import {
  gameDefinition,
  NUM_REELS,
  NUM_ROWS,
  paylines,
  getPayout,
  scatterMinToTrigger,
  scatterSymbolId,
  wildSymbolId,
  multiplierWildValues,
  multiplierWildWeights,
  ladderConfig,
  WINCAP_MULTIPLIER,
} from '../config/gameConfig';
import type {
  RgsTransport,
  RgsParams,
  AuthenticateResult,
  PlayResult,
  EndRoundResult,
  Balance,
  BetMode,
  RoundState,
} from './rgsClient';
import { RgsError } from './rgsClient';

/** Eagerly-loaded raw book files, if a developer drops real books in. */
const rawBookFiles = import.meta.glob('../assets/books/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Parse a `.jsonl` string into an array of {@link Book}. */
function parseJsonl(text: string): Book[] {
  const out: Book[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as Book);
    } catch {
      // Skip malformed lines rather than crashing dev mode.
    }
  }
  return out;
}

/** Books loaded from disk, keyed by mode (`base`/`bonus`). */
const loadedBooks: Record<string, Book[]> = {};
for (const [path, text] of Object.entries(rawBookFiles)) {
  const mode = /bonus/i.test(path) ? 'bonus' : 'base';
  (loadedBooks[mode] ??= []).push(...parseJsonl(text));
}

/* --------------------------- procedural fallback -------------------------- */

/** A small seedable RNG (mulberry32) for reproducible local sessions. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Symbol-id reel pool, weighted so lows are common and premiums are rare. */
const symbolPool: string[] = (() => {
  const pool: string[] = [];
  const weight: Record<string, number> = {
    W: 2,
    S: 2,
    H1: 3,
    H2: 4,
    H3: 5,
    H4: 6,
    L1: 9,
    L2: 9,
    L3: 10,
    L4: 10,
    L5: 11,
  };
  for (const sym of gameDefinition.symbols) {
    const w = weight[sym.id] ?? 6;
    for (let i = 0; i < w; i++) pool.push(sym.id);
  }
  return pool;
})();

/** Pick a weighted multiplier-wild value (free spins only). */
function pickWildMultiplier(rng: () => number): number {
  const total = multiplierWildWeights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < multiplierWildValues.length; i++) {
    roll -= multiplierWildWeights[i];
    if (roll <= 0) return multiplierWildValues[i];
  }
  return multiplierWildValues[0] ?? 1;
}

/** Build a random board `board[reel][row]`, optionally forcing scatter count. */
function makeBoard(rng: () => number, forcedScatters = -1): Board {
  const board: Board = [];
  for (let r = 0; r < NUM_REELS; r++) {
    const col: string[] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      col.push(symbolPool[Math.floor(rng() * symbolPool.length)]);
    }
    board.push(col);
  }
  if (forcedScatters >= 0) {
    // Clear existing scatters, then place exactly `forcedScatters` of them on
    // distinct reels (scatters pay anywhere, one per reel keeps it natural).
    for (let r = 0; r < NUM_REELS; r++) {
      for (let row = 0; row < NUM_ROWS; row++) {
        if (board[r][row] === scatterSymbolId) board[r][row] = 'L5';
      }
    }
    const reels = shuffle([...Array(NUM_REELS).keys()], rng).slice(0, forcedScatters);
    for (const r of reels) {
      board[r][Math.floor(rng() * NUM_ROWS)] = scatterSymbolId;
    }
  }
  return board;
}

/** Fisher-Yates shuffle using the provided RNG. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Count scatters anywhere on the board. */
function countScatters(board: Board): number {
  let n = 0;
  for (const col of board) for (const s of col) if (s === scatterSymbolId) n++;
  return n;
}

/**
 * Evaluate left-to-right line wins for a board. Wilds substitute; the win symbol
 * is the first non-wild in the line (or wild itself for a pure-wild line). The
 * returned `amount` is expressed as a bet multiplier (book amounts are in
 * bet-multiplier units, scaled by `betScale`).
 */
function evaluateLines(board: Board, wildMultiplier: number, betScale: number): LineWin[] {
  const wins: LineWin[] = [];
  paylines.forEach((line, lineIdx) => {
    const symbolsOnLine = line.map((row, reel) => board[reel][row]);
    // Determine the paying symbol: first non-wild, else wild.
    let baseSymbol = symbolsOnLine.find((s) => s !== wildSymbolId);
    if (baseSymbol === undefined) baseSymbol = wildSymbolId;
    if (baseSymbol === scatterSymbolId) return; // scatters don't pay on lines
    let count = 0;
    for (const s of symbolsOnLine) {
      if (s === baseSymbol || s === wildSymbolId) count++;
      else break;
    }
    if (count < 3) return;
    const base = getPayout(baseSymbol, count);
    if (base <= 0) return;
    const amount = base * betScale * wildMultiplier;
    wins.push({
      line: lineIdx,
      symbol: baseSymbol,
      count,
      wildMultiplier,
      amount: round4(amount),
    });
  });
  return wins;
}

/** Round to 4 decimals to match book precision. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Determine which middle-reel wilds expand (free spins, reels index 1-3). */
function expandedReelsFor(board: Board): number[] {
  const out: number[] = [];
  for (let r = 1; r <= 3 && r < NUM_REELS; r++) {
    if (board[r].includes(wildSymbolId)) out.push(r);
  }
  return out;
}

/**
 * Generate a procedurally-random base-game book. `betScale` is the per-line bet
 * fraction (total bet / number of lines) so book amounts are bet multipliers.
 */
function generateBaseBook(id: number, rng: () => number, buyBonus: boolean): Book {
  const events: BookEvent[] = [];
  const betScale = 1 / paylines.length;

  // Decide scatter count. Buy-bonus forces a trigger.
  let scatters: number;
  if (buyBonus) {
    scatters = scatterMinToTrigger + (rng() < 0.3 ? 1 : 0);
  } else {
    const roll = rng();
    scatters = roll < 0.04 ? scatterMinToTrigger : roll < 0.05 ? scatterMinToTrigger + 1 : 0;
  }

  const board = makeBoard(rng, scatters > 0 ? scatters : -1);
  const reelStops = board.map(() => Math.floor(rng() * 64));
  events.push({ type: 'reveal', gameType: 'base', board, reelStops });

  const baseWins = evaluateLines(board, 1, betScale);
  let runningTotal = 0;
  if (baseWins.length > 0) {
    const amount = round4(baseWins.reduce((a, w) => a + w.amount, 0));
    events.push({ type: 'lineWins', gameType: 'base', wins: baseWins, amount });
    runningTotal += amount;
  }

  const actualScatters = countScatters(board);
  if (actualScatters >= scatterMinToTrigger) {
    const scatterPay = (gameDefinition.scatter.pays[String(actualScatters)] ?? 0) * 1;
    if (scatterPay > 0) {
      events.push({ type: 'scatterWin', count: actualScatters, amount: round4(scatterPay) });
      runningTotal += scatterPay;
    }
    runningTotal += generateFreeSpins(events, rng, actualScatters, betScale);
  }

  const finalAmount = capAmount(round4(runningTotal));
  events.push({ type: 'finalWin', amount: finalAmount, wincap: finalAmount >= WINCAP_MULTIPLIER });
  return { id, payoutMultiplier: finalAmount, events };
}

/** Clamp a bet-multiplier amount to the win cap. */
function capAmount(amount: number): number {
  return Math.min(amount, WINCAP_MULTIPLIER);
}

/**
 * Append the free-spins feature events and return the total feature win. Mirrors
 * the math ordering: freeSpinTrigger -> (reveal(free) -> freeSpinResult)* with
 * interleaved ladderStep / freeSpinRetrigger -> freeSpinEnd.
 */
function generateFreeSpins(
  events: BookEvent[],
  rng: () => number,
  scatters: number,
  betScale: number
): number {
  const awarded = gameDefinition.features.freeSpins.awards[String(scatters)] ?? 8;
  let globalMultiplier = ladderConfig.start;
  events.push({
    type: 'freeSpinTrigger',
    scatters,
    awarded,
    startMultiplier: globalMultiplier,
  });

  let remaining = awarded;
  let spinsTotal = awarded;
  let spin = 0;
  let featureTotal = 0;
  const winScale = gameDefinition.features.freeSpins.winScale ?? 0.3;

  while (remaining > 0) {
    remaining--;
    spin++;

    // Occasional retrigger.
    if (gameDefinition.features.freeSpins.retrigger && rng() < 0.06) {
      const reScatters = scatterMinToTrigger;
      const extra = gameDefinition.features.freeSpins.awards[String(reScatters)] ?? 8;
      remaining += extra;
      spinsTotal += extra;
      events.push({
        type: 'freeSpinRetrigger',
        scatters: reScatters,
        awarded: extra,
        spinsTotal,
      });
    }

    const board = makeBoard(rng, -1);
    const reelStops = board.map(() => Math.floor(rng() * 64));
    const expandedReels = expandedReelsFor(board);
    // Realized per-cell wild multipliers (carried in the book, like the math engine).
    const multiplierWilds: Array<{ reel: number; row: number; value: number }> = [];
    board.forEach((col, reel) =>
      col.forEach((sym, row) => {
        if (sym === wildSymbolId) multiplierWilds.push({ reel, row, value: pickWildMultiplier(rng) });
      })
    );
    const reveal: BookEvent = {
      type: 'reveal',
      gameType: 'free' as GameType,
      board,
      reelStops,
      spin,
      spinsTotal,
      globalMultiplier,
      ...(expandedReels.length > 0 ? { expandedReels } : {}),
      ...(multiplierWilds.length > 0 ? { multiplierWilds } : {}),
    };
    events.push(reveal);

    // Free-spin wild multiplier (weighted), scaled down so RTP stays sane.
    const wildMult = expandedReels.length > 0 ? pickWildMultiplier(rng) : 1;
    const wins = evaluateLines(board, wildMult, betScale * winScale);
    if (wins.length > 0) {
      const amount = round4(wins.reduce((a, w) => a + w.amount, 0) * globalMultiplier);
      featureTotal += amount;
      events.push({
        type: 'freeSpinResult',
        spin,
        wins,
        scatter: null,
        globalMultiplier,
        amount,
      });
      // Ladder advances on a win (until max), emitted before the next spin.
      if (globalMultiplier < ladderConfig.max && remaining > 0) {
        globalMultiplier = Math.min(ladderConfig.max, globalMultiplier + ladderConfig.step);
        events.push({ type: 'ladderStep', globalMultiplier });
      }
    }
  }

  events.push({ type: 'freeSpinEnd', totalWin: round4(featureTotal) });
  return featureTotal;
}

/* ------------------------------- mock client ------------------------------ */

/** Options for the {@link MockRgsClient}. */
export interface MockRgsOptions {
  params: RgsParams;
  /** Starting wallet balance in dollars (default 1000). */
  startingBalance?: number;
  /** RNG seed for reproducible sessions (default time-based). */
  seed?: number;
}

/**
 * Fully client-side RGS implementation. Conforms to {@link RgsTransport} so it is
 * a drop-in replacement for {@link RgsClient}.
 */
export class MockRgsClient implements RgsTransport {
  readonly params: RgsParams;
  private balance: number;
  private readonly currency: string;
  private readonly rng: () => number;
  private bookCounter = 1;
  private currentRound: RoundState | null = null;
  /** Pending payout (dollars) awaiting `endRound` settlement. */
  private pendingPayout = 0;
  private readonly betLevels: number[];

  constructor(options: MockRgsOptions) {
    this.params = options.params;
    this.balance = options.startingBalance ?? 1000;
    this.currency = options.params.currency ?? gameDefinition.currency.default;
    this.rng = makeRng(options.seed ?? Date.now() & 0xffffffff);
    this.betLevels = [...gameDefinition.bet.levels];
  }

  /** Resolve mock authentication immediately. */
  async authenticate(): Promise<AuthenticateResult> {
    return {
      balance: this.snapshotBalance(),
      config: {
        minBet: gameDefinition.bet.minBet,
        maxBet: gameDefinition.bet.maxBet,
        stepBet: gameDefinition.bet.stepBet,
        betLevels: this.betLevels,
      },
      round: null,
      statusCode: 'SUCCESS',
    };
  }

  /** Place a bet: validate funds, build a book, debit the stake. */
  async play(amount: number, mode: BetMode): Promise<PlayResult> {
    const buyBonus = mode === 'bonus';
    const cost = buyBonus ? amount * (gameDefinition.features.bonusBuy.costMultiplier ?? 100) : amount;
    if (cost > this.balance + 1e-9) {
      throw new RgsError('ERR_IPB');
    }
    this.balance -= cost;

    const book = this.pickOrGenerateBook(buyBonus);
    // Book amounts are bet multipliers; convert to dollars using the stake.
    const winDollars = round4(book.payoutMultiplier * amount);
    this.pendingPayout = winDollars;
    this.currentRound = {
      betID: this.bookCounter++,
      state: 'placed',
      payoutMultiplier: book.payoutMultiplier,
      book,
    };
    return {
      round: this.currentRound,
      balance: this.snapshotBalance(),
      statusCode: 'SUCCESS',
    };
  }

  /** Credit the pending payout and finalize the round. */
  async endRound(): Promise<EndRoundResult> {
    if (this.currentRound) {
      this.balance += this.pendingPayout;
      this.pendingPayout = 0;
      this.currentRound.state = 'resolved';
      this.currentRound = null;
    }
    return { balance: this.snapshotBalance(), statusCode: 'SUCCESS' };
  }

  /** Return the current mock balance. */
  async getBalance(): Promise<Balance> {
    return this.snapshotBalance();
  }

  private snapshotBalance(): Balance {
    return { amount: round4(this.balance), currency: this.currency };
  }

  /** Use a real loaded book when available, otherwise generate one. */
  private pickOrGenerateBook(buyBonus: boolean): Book {
    const key = buyBonus ? 'bonus' : 'base';
    const pool = loadedBooks[key];
    if (pool && pool.length > 0) {
      const chosen = pool[Math.floor(this.rng() * pool.length)];
      // Clone with a fresh id so replays are independent.
      return { ...chosen, id: this.bookCounter };
    }
    return generateBaseBook(this.bookCounter, this.rng, buyBonus);
  }
}

/** True when at least one real book file was bundled. */
export const hasRealBooks = Object.keys(loadedBooks).length > 0;
