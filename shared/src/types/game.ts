/**
 * Types describing the canonical game-definition.json single source of truth.
 * Mirrors shared/schemas/game-definition.schema.json. Consumed by the frontend
 * (paytable, bet levels, symbol metadata) and validated against the Python
 * loader in math/simulator/definition.py.
 */

export type SymbolKind = 'wild' | 'scatter' | 'high' | 'low' | 'bonus';
export type EngineType = 'lines' | 'ways' | 'cluster' | 'scatter';
export type Volatility = 'low' | 'medium' | 'high' | 'very-high';

export interface GameSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  color?: string;
  substitutes?: string[];
}

export interface EngineConfig {
  type: EngineType;
  numReels: number;
  numRows: number;
  wincapMultiplier: number;
  rtpTarget: number;
  volatility?: Volatility;
}

export interface CurrencyConfig {
  default: string;
  /** API amounts are integers: dollars * apiAmountMultiplier (1_000_000). */
  apiAmountMultiplier: number;
  /** Book payouts are integers: multiplier * bookAmountMultiplier (100). */
  bookAmountMultiplier: number;
}

export interface BetConfig {
  defaultLevelIndex: number;
  levels: number[];
  minBet: number;
  maxBet: number;
  stepBet: number;
}

export interface BetMode {
  name: string;
  cost: number;
  label?: string;
  isBuyBonus?: boolean;
}

export interface ScatterConfig {
  symbol: string;
  minToTrigger: number;
  pays: Record<string, number>;
}

export interface FeatureConfig {
  freeSpins: {
    enabled: boolean;
    awards: Record<string, number>;
    retrigger: boolean;
    winScale?: number;
    multiplierLadder: { description: string; start: number; step: number; max: number };
  };
  multiplierWilds: { enabled: boolean; appliesIn: string[]; values: number[]; weights: number[] };
  expandingWilds: { enabled: boolean; appliesIn: string[]; description: string };
  bonusBuy: { enabled: boolean; mode: string; costMultiplier: number; description: string };
}

export interface GameDefinition {
  id: string;
  displayName: string;
  version: string;
  studio?: string;
  theme?: string;
  description?: string;
  engine: EngineConfig;
  currency: CurrencyConfig;
  bet: BetConfig;
  betModes: BetMode[];
  symbols: GameSymbol[];
  paytable: Record<string, Record<string, number>>;
  paylines: number[][];
  scatter: ScatterConfig;
  features: FeatureConfig;
  responsibleGaming?: ResponsibleGamingConfig;
}

/** Optional operator-compliance UX policy shipped with the game. */
export interface ResponsibleGamingConfig {
  /** Minutes between reality-check reminders (omit/0 disables). */
  realityCheckMinutes?: number;
  /** URL to operator help / limit-setting resources. */
  helpUrl?: string;
}
