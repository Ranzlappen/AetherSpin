/* eslint-disable */
/**
 * GENERATED — DO NOT EDIT BY HAND.
 *
 * TypeScript projection of shared/schemas/game-definition.schema.json (the
 * single-source structural contract). The schema intentionally leaves some
 * objects open (e.g. `features`, `paytable`); the hand-written types in
 * `game.ts` add the precise shapes on top and are checked against this
 * projection by the conformance assertion at the bottom of `game.ts`.
 *
 * Regenerate with: pnpm gen:types  (CI fails if this drifts from the schema).
 */

/**
 * Canonical, single-source-of-truth definition for an AetherSpin slot game, consumed by both the Python math engine and the TypeScript frontend.
 */
export interface AetherSpinGameDefinition {
  $schema?: string;
  id: string;
  displayName: string;
  version: string;
  studio?: string;
  theme?: string;
  description?: string;
  engine: {
    type: 'lines' | 'ways' | 'cluster' | 'scatter';
    numReels: number;
    numRows: number;
    wincapMultiplier: number;
    rtpTarget: number;
    volatility?: 'low' | 'medium' | 'high' | 'very-high';
  };
  currency: {
    default: string;
    apiAmountMultiplier: number;
    bookAmountMultiplier: number;
  };
  bet: {
    defaultLevelIndex?: number;
    /**
     * @minItems 1
     */
    levels: [number, ...number[]];
    minBet: number;
    maxBet: number;
    stepBet?: number;
  };
  betModes: {
    name: string;
    cost: number;
    label?: string;
    isBuyBonus?: boolean;
  }[];
  symbols: {
    id: string;
    name: string;
    kind: 'wild' | 'scatter' | 'high' | 'low' | 'bonus';
    color?: string;
    substitutes?: string[];
  }[];
  paytable: {
    [k: string]: {
      [k: string]: number;
    };
  };
  paylines: number[][];
  scatter: {
    symbol: string;
    minToTrigger: number;
    pays: {
      [k: string]: number;
    };
  };
  features: {};
  /**
   * Optional operator-compliance UX policy shipped with the game (reality-check cadence, help resources).
   */
  responsibleGaming?: {
    realityCheckMinutes?: number;
    helpUrl?: string;
    /**
     * Minimum player age shown in the age/legal acknowledgement (e.g. 18).
     */
    ageRating?: number;
    /**
     * Show a one-time age/legal acknowledgement before play. Default false — for operator-embedded games KYC/age-gating is usually enforced upstream.
     */
    requireAgeAck?: boolean;
    /**
     * Optional extra legal/terms line shown in the acknowledgement and reality-check dialogs.
     */
    legalDisclaimer?: string;
  };
}
