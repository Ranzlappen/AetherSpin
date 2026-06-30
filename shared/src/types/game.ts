/**
 * Types describing the canonical game-definition.json single source of truth.
 * Mirrors shared/schemas/game-definition.schema.json. Consumed by the frontend
 * (paytable, bet levels, symbol metadata) and validated against the Python
 * loader in math/simulator/definition.py.
 */
import type { AetherSpinGameDefinition } from './game.generated';

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
  /** Minimum player age shown in the age/legal acknowledgement (e.g. 18). */
  ageRating?: number;
  /** Show a one-time age/legal acknowledgement before play (default false). */
  requireAgeAck?: boolean;
  /** Optional extra legal/terms line shown in the acknowledgement + reality check. */
  legalDisclaimer?: string;
}

/* ----------------------------- schema conformance ----------------------------
 * The JSON Schema (game-definition.schema.json) is the structural contract;
 * `game.generated.d.ts` is its committed TypeScript projection (drift-guarded in
 * CI). These hand-written types are the richer authoring layer over it. The
 * assertion below fails to compile if they drift from the schema on any field it
 * fully specifies. `features`/`paytable` are intentionally left open by the
 * schema (refined here), and `bet` differs only by the schema's minItems:1 tuple
 * for `levels`; all three are excluded from the check.
 */

type SchemaSpecified = Omit<AetherSpinGameDefinition, 'features' | 'paytable' | 'bet'>;

/** `true` when the hand-written types satisfy the schema; otherwise `never`. */
export type GameDefinitionConformsToSchema = GameDefinition extends SchemaSpecified ? true : never;

// A compile error on this line means game.ts drifted from the schema — run
// `pnpm gen:types` and reconcile the hand-written types.
export const __assertGameDefinitionConformsToSchema: GameDefinitionConformsToSchema = true;
