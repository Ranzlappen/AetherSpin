/**
 * Typed wrapper around the Stake Engine RGS HTTP API.
 *
 * Endpoints (POST JSON): `/wallet/authenticate`, `/wallet/play`,
 * `/wallet/end-round`, `/wallet/balance`, `/bet/event`.
 *
 * All amounts crossing the wire are integers equal to `dollars * 1_000_000`
 * ({@link API_AMOUNT_MULTIPLIER}); this client converts at the boundary using the
 * shared helpers so the rest of the app works in dollars. Status codes are mapped
 * to typed {@link RgsError}s. No Pixi or Svelte imports.
 */
import { API_AMOUNT_MULTIPLIER, toApiAmount, fromApiAmount } from './amount';
import type { Book } from '../../../shared/src/types/events';

/** RGS status codes surfaced by the Stake Engine wallet API. */
export type RgsStatusCode = 'SUCCESS' | 'ERR_IPB' | 'ERR_IS' | 'ERR_ATE' | 'ERR_VAL' | 'ERR_UE';

/** Human-readable messages keyed by status code. */
const STATUS_MESSAGES: Record<RgsStatusCode, string> = {
  SUCCESS: 'OK',
  ERR_IPB: 'Insufficient balance for this bet.',
  ERR_IS: 'Your session is invalid or has expired.',
  ERR_ATE: 'Authentication error. Please reload the game.',
  ERR_VAL: 'The request was rejected as invalid.',
  ERR_UE: 'An unexpected error occurred. Please try again.',
};

/** A typed error carrying the RGS status code that produced it. */
export class RgsError extends Error {
  constructor(
    /** The RGS status code, or `"ERR_UE"` for transport/parse failures. */
    public readonly code: RgsStatusCode,
    message?: string
  ) {
    super(message ?? STATUS_MESSAGES[code] ?? code);
    this.name = 'RgsError';
  }
}

/** Connection parameters parsed from the iframe URL. */
export interface RgsParams {
  sessionID: string | null;
  rgsUrl: string | null;
  lang: string;
  currency: string | null;
}

/** Wallet balance in dollars. */
export interface Balance {
  amount: number;
  currency: string;
}

/** Authenticate response (amounts already converted to dollars). */
export interface AuthenticateResult {
  balance: Balance;
  config: {
    minBet: number;
    maxBet: number;
    stepBet: number;
    betLevels: number[];
  };
  round: RoundState | null;
  statusCode: RgsStatusCode;
}

/** A round descriptor returned by `play`/`authenticate`. */
export interface RoundState {
  betID: number;
  /** Round lifecycle state, e.g. `"placed"` | `"resolved"`. */
  state: string;
  payoutMultiplier: number;
  /** The book the frontend replays. */
  book: Book | null;
}

/** Play response (amounts converted to dollars). */
export interface PlayResult {
  round: RoundState;
  balance: Balance;
  statusCode: RgsStatusCode;
}

/** End-round response. */
export interface EndRoundResult {
  balance: Balance;
  statusCode: RgsStatusCode;
}

/** Bet mode passed to `play` (e.g. `"base"`, `"bonus"`). */
export type BetMode = string;

/**
 * Read the RGS connection params from a URL's query string.
 * @param search A query string or full URL (defaults to `window.location.search`).
 */
export function parseRgsParams(
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): RgsParams {
  // Accept either a bare query string ("?a=b") or a full URL.
  let qs = search;
  const qIdx = search.indexOf('?');
  if (qIdx >= 0) qs = search.slice(qIdx);
  const params = new URLSearchParams(qs);
  return {
    sessionID: params.get('sessionID') ?? params.get('sessionId'),
    rgsUrl: params.get('rgs_url') ?? params.get('rgsUrl'),
    lang: params.get('lang') ?? params.get('language') ?? 'en',
    currency: params.get('currency'),
  };
}

/** Map a raw status object to a {@link RgsStatusCode}, defaulting to `ERR_UE`. */
function readStatusCode(status: unknown): RgsStatusCode {
  const code =
    status && typeof status === 'object' && 'statusCode' in status
      ? (status as { statusCode?: unknown }).statusCode
      : undefined;
  const known: RgsStatusCode[] = ['SUCCESS', 'ERR_IPB', 'ERR_IS', 'ERR_ATE', 'ERR_VAL', 'ERR_UE'];
  return known.includes(code as RgsStatusCode) ? (code as RgsStatusCode) : 'ERR_UE';
}

/** Throw if a status code is anything other than `SUCCESS`. */
function assertSuccess(code: RgsStatusCode): void {
  if (code !== 'SUCCESS') throw new RgsError(code);
}

/** Convert a raw `{amount,currency}` balance (API integer) to dollars. */
function readBalance(raw: unknown, fallbackCurrency: string): Balance {
  const obj = (raw ?? {}) as { amount?: number; currency?: string };
  return {
    amount: fromApiAmount(typeof obj.amount === 'number' ? obj.amount : 0),
    currency: obj.currency ?? fallbackCurrency,
  };
}

/**
 * The interface implemented by both the real RGS client and the mock. Lets the
 * rest of the app depend on an abstraction rather than a concrete transport.
 */
export interface RgsTransport {
  readonly params: RgsParams;
  authenticate(): Promise<AuthenticateResult>;
  play(amount: number, mode: BetMode): Promise<PlayResult>;
  endRound(): Promise<EndRoundResult>;
  getBalance(): Promise<Balance>;
}

/** Options for constructing an {@link RgsClient}. */
export interface RgsClientOptions {
  params: RgsParams;
  /** Injectable fetch (defaults to global `fetch`) — eases testing. */
  fetchImpl?: typeof fetch;
}

/** Concrete RGS client talking to the live Stake Engine wallet API. */
export class RgsClient implements RgsTransport {
  readonly params: RgsParams;
  private readonly fetchImpl: typeof fetch;
  private readonly currency: string;

  constructor(options: RgsClientOptions) {
    this.params = options.params;
    this.fetchImpl =
      options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined!);
    this.currency = options.params.currency ?? 'USD';
  }

  /** POST `body` to `path` on the configured RGS base URL and parse JSON. */
  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.params.rgsUrl) {
      throw new RgsError('ERR_ATE', 'No rgsUrl configured.');
    }
    const base = this.params.rgsUrl.replace(/\/$/, '');
    let res: Response;
    try {
      res = await this.fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new RgsError('ERR_UE', `Network error: ${(err as Error).message}`);
    }
    if (!res.ok) {
      // Some RGS errors still return a JSON status; try to read it.
      try {
        const data = (await res.json()) as { status?: unknown };
        const code = readStatusCode(data.status);
        if (code !== 'SUCCESS') throw new RgsError(code);
      } catch (err) {
        if (err instanceof RgsError) throw err;
      }
      throw new RgsError('ERR_UE', `HTTP ${res.status}`);
    }
    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new RgsError('ERR_UE', `Invalid JSON response: ${(err as Error).message}`);
    }
  }

  /** Authenticate the session and fetch wallet config + balance. */
  async authenticate(): Promise<AuthenticateResult> {
    const raw = await this.request<Record<string, unknown>>('/wallet/authenticate', {
      sessionID: this.params.sessionID,
      rgsUrl: this.params.rgsUrl,
      language: this.params.lang,
    });
    const statusCode = readStatusCode(raw.status);
    assertSuccess(statusCode);
    const balance = readBalance(raw.balance, this.currency);
    const config = (raw.config ?? {}) as {
      minBet?: number;
      maxBet?: number;
      stepBet?: number;
      betLevels?: number[];
    };
    return {
      balance,
      config: {
        minBet: fromApiAmount(config.minBet ?? 0),
        maxBet: fromApiAmount(config.maxBet ?? 0),
        stepBet: fromApiAmount(config.stepBet ?? 0),
        betLevels: (config.betLevels ?? []).map(fromApiAmount),
      },
      round: this.readRound(raw.round),
      statusCode,
    };
  }

  /** Place a bet and receive the round's book. */
  async play(amount: number, mode: BetMode): Promise<PlayResult> {
    const raw = await this.request<Record<string, unknown>>('/wallet/play', {
      amount: toApiAmount(amount),
      mode,
      currency: this.currency,
      sessionID: this.params.sessionID,
      rgsUrl: this.params.rgsUrl,
    });
    const statusCode = readStatusCode(raw.status);
    assertSuccess(statusCode);
    const round = this.readRound(raw.round);
    if (!round) throw new RgsError('ERR_UE', 'play() returned no round.');
    return { round, balance: readBalance(raw.balance, this.currency), statusCode };
  }

  /** Settle and finalize the current round. */
  async endRound(): Promise<EndRoundResult> {
    const raw = await this.request<Record<string, unknown>>('/wallet/end-round', {
      sessionID: this.params.sessionID,
      rgsUrl: this.params.rgsUrl,
    });
    const statusCode = readStatusCode(raw.status);
    assertSuccess(statusCode);
    return { balance: readBalance(raw.balance, this.currency), statusCode };
  }

  /** Fetch the current wallet balance. */
  async getBalance(): Promise<Balance> {
    const raw = await this.request<Record<string, unknown>>('/wallet/balance', {
      sessionID: this.params.sessionID,
      rgsUrl: this.params.rgsUrl,
    });
    assertSuccess(readStatusCode(raw.status));
    return readBalance(raw.balance, this.currency);
  }

  /** Parse a raw round object into a typed {@link RoundState}. */
  private readRound(raw: unknown): RoundState | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as {
      betID?: number;
      state?: string;
      payoutMultiplier?: number;
      book?: Book;
    };
    if (r.betID === undefined) return null;
    return {
      betID: r.betID,
      state: r.state ?? 'placed',
      payoutMultiplier: r.payoutMultiplier ?? 0,
      book: r.book ?? null,
    };
  }
}

/** Human-readable message for a status code (re-exported for UI use). */
export function messageForStatus(code: RgsStatusCode): string {
  return STATUS_MESSAGES[code] ?? STATUS_MESSAGES.ERR_UE;
}

/** Re-export so consumers need not import the shared package directly. */
export { API_AMOUNT_MULTIPLIER };
