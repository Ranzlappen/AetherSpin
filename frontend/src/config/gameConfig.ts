/**
 * Typed access layer over the canonical `game-definition.json`.
 *
 * The definition is the single source of truth shipped by the math engine; this
 * module imports it directly and exposes narrow, typed helpers so that no other
 * frontend module re-parses the raw JSON shape. Nothing here imports Pixi or
 * Svelte — it is pure data/config logic.
 */
import type { GameDefinition, GameSymbol, BetMode } from '../../../shared/src/types/game';

// Eagerly bundle every game definition so the client can mount any of them.
const definitionModules = import.meta.glob('../../../shared/games/*/game-definition.json', {
  eager: true,
  import: 'default',
}) as Record<string, GameDefinition>;

/** id -> definition registry, built from the bundled definitions. */
const registry: Record<string, GameDefinition> = {};
for (const def of Object.values(definitionModules)) {
  registry[def.id] = def;
}

/** The flagship game, used as the default. */
const DEFAULT_GAME = 'novaforged';
/** Games excluded from the player-facing list: scaffolds, and games that are
 * math-complete but not yet renderable client-side (stellarclusters emits
 * `clusterWins`, which the bookPlayer doesn't handle yet — math ships first). */
const HIDDEN_GAMES = new Set(['template', 'stellarclusters']);

/** Game ids selectable by the player (scaffolds hidden), sorted. */
export const availableGames: readonly string[] = Object.keys(registry)
  .filter((id) => !HIDDEN_GAMES.has(id))
  .sort();

/** Resolve the active game id from the `?game=` URL param (falls back safely). */
function resolveGameId(): string {
  let requested: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      requested = new URLSearchParams(window.location.search).get('game');
    } catch {
      /* non-browser / malformed search — fall through to default */
    }
  }
  if (requested && registry[requested]) return requested;
  return registry[DEFAULT_GAME] ? DEFAULT_GAME : (availableGames[0] ?? Object.keys(registry)[0]);
}

/** The active game id for this session. */
export const activeGameId = resolveGameId();

/** The fully-typed active game definition. */
export const gameDefinition: GameDefinition = registry[activeGameId];

/**
 * Fail-fast dev-time guard mirroring the key semantic invariants enforced
 * server-side (`math/simulator/definition.py` / `scripts/validate_definitions.py`).
 * Catches a corrupt/edited definition immediately in the browser during
 * development; tree-shaken out of production builds via `import.meta.env.DEV`.
 */
function assertDefinitionValid(d: GameDefinition): void {
  const symbolIds = new Set(d.symbols.map((s) => s.id));
  const problems: string[] = [];
  d.paylines.forEach((line, i) => {
    if (line.length !== d.engine.numReels) problems.push(`payline ${i} length != numReels`);
    if (line.some((r) => r < 0 || r >= d.engine.numRows)) problems.push(`payline ${i} row out of range`);
  });
  if (d.bet.defaultLevelIndex < 0 || d.bet.defaultLevelIndex >= d.bet.levels.length)
    problems.push('defaultLevelIndex out of range');
  for (const sym of Object.keys(d.paytable))
    if (!symbolIds.has(sym)) problems.push(`paytable symbol ${sym} unknown`);
  if (!symbolIds.has(d.scatter.symbol)) problems.push(`scatter symbol ${d.scatter.symbol} unknown`);
  if (problems.length) throw new Error(`Invalid game-definition.json:\n  - ${problems.join('\n  - ')}`);
}

if (import.meta.env.DEV) assertDefinitionValid(gameDefinition);

/** Number of reels (columns) on the board. */
export const NUM_REELS = gameDefinition.engine.numReels;
/** Number of rows visible per reel. */
export const NUM_ROWS = gameDefinition.engine.numRows;
/** Win-cap multiplier (max payout as a multiple of the base bet). */
export const WINCAP_MULTIPLIER = gameDefinition.engine.wincapMultiplier;

/** Performance budget constants used by the renderer. */
export const TARGET_FPS = 60;
/** Frame budget in milliseconds derived from {@link TARGET_FPS}. */
export const FRAME_BUDGET_MS = 1000 / TARGET_FPS;

/** Bet levels (in dollars) available to the player. */
export const betLevels: readonly number[] = gameDefinition.bet.levels;
/** Default bet level index from the definition. */
export const defaultBetLevelIndex = gameDefinition.bet.defaultLevelIndex;

const symbolIndex: Map<string, GameSymbol> = new Map(gameDefinition.symbols.map((s) => [s.id, s]));

/**
 * Look up a symbol's metadata by id.
 * @param id Symbol id (e.g. `"H1"`, `"W"`, `"S"`).
 * @returns The matching {@link GameSymbol}, or `undefined` if unknown.
 */
export function getSymbol(id: string): GameSymbol | undefined {
  return symbolIndex.get(id);
}

/**
 * Resolve a display color for a symbol, falling back to a neutral neon if the
 * definition omits one.
 * @param id Symbol id.
 */
export function getSymbolColor(id: string): string {
  return symbolIndex.get(id)?.color ?? '#8a8aff';
}

/**
 * The paytable multiplier for `count` matching `symbol` symbols, or `0` when the
 * combination does not pay.
 * @param symbol Symbol id.
 * @param count Number of symbols in the winning line (3-5).
 */
export function getPayout(symbol: string, count: number): number {
  return gameDefinition.paytable[symbol]?.[String(count)] ?? 0;
}

/** Paylines as `[reel] -> row` arrays. */
export const paylines: readonly number[][] = gameDefinition.paylines;

/** Wild symbol id, if the game defines one. */
export const wildSymbolId = gameDefinition.symbols.find((s) => s.kind === 'wild')?.id ?? 'W';
/** Scatter symbol id. */
export const scatterSymbolId = gameDefinition.scatter.symbol;

/** Minimum scatters required to trigger free spins. */
export const scatterMinToTrigger = gameDefinition.scatter.minToTrigger;

/** Bet mode descriptors keyed by name. */
const betModeIndex: Map<string, BetMode> = new Map(gameDefinition.betModes.map((m) => [m.name, m]));

/**
 * Resolve a bet mode descriptor by name (e.g. `"base"`, `"bonus"`).
 * @param name Bet-mode name.
 */
export function getBetMode(name: string): BetMode | undefined {
  return betModeIndex.get(name);
}

/** The buy-bonus mode descriptor, if the game offers one. */
export const buyBonusMode = gameDefinition.betModes.find((m) => m.isBuyBonus);

/** Multiplier-wild possible values and their relative weights (free spins). */
export const multiplierWildValues = gameDefinition.features.multiplierWilds.values;
/** Relative weights matching {@link multiplierWildValues}. */
export const multiplierWildWeights = gameDefinition.features.multiplierWilds.weights;

/** Free-spin multiplier ladder configuration. */
export const ladderConfig = gameDefinition.features.freeSpins.multiplierLadder;

/**
 * Format a dollar amount as a localized currency string.
 * @param amount Dollar amount.
 * @param currency ISO currency code (default `USD`).
 * @param locale BCP-47 locale (default `en-US`).
 */
export function formatCurrency(
  amount: number,
  currency = gameDefinition.currency.default,
  locale = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code: fall back to a plain fixed-decimal string.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format a payout multiplier (e.g. `12.5` -> `"12.50x"`).
 * @param multiplier Multiplier value.
 */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`;
}
