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
import type { Book, BookEvent } from '../../../shared/src/types/events';

/** Valid book-event types (mirrors shared/schemas/book.schema.json). */
const VALID_EVENT_TYPES = new Set([
  'reveal',
  'lineWins',
  'scatterWin',
  'freeSpinTrigger',
  'freeSpinResult',
  'ladderStep',
  'freeSpinRetrigger',
  'freeSpinEnd',
  'finalWin',
]);

/**
 * Validate a server-returned book's shape before the frontend replays it.
 * Types do not protect against a malformed runtime payload; a bad book must be
 * rejected (and the round surfaced as an error) rather than mis-rendered.
 */
export function isValidBook(book: unknown): book is Book {
  if (!book || typeof book !== 'object') return false;
  const b = book as { id?: unknown; payoutMultiplier?: unknown; events?: unknown };
  if (typeof b.id !== 'number' || typeof b.payoutMultiplier !== 'number') return false;
  if (!Array.isArray(b.events) || b.events.length < 2) return false;
  const events = b.events as BookEvent[];
  if (events[0]?.type !== 'reveal' || events[events.length - 1]?.type !== 'finalWin') return false;
  return events.every((e) => e && typeof e.type === 'string' && VALID_EVENT_TYPES.has(e.type));
}

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
  /** Per-request timeout in ms (default 15000). */
  timeoutMs?: number;
  /** Max attempts for idempotent requests on transport errors (default 3). */
  maxRetries?: number;
  /** Injectable sleep (eases testing of backoff). */
  sleepImpl?: (ms: number) => Promise<void>;
}

/** True for an https URL, or a localhost http URL (dev only). */
function isSecureRgsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/** Concrete RGS client talking to the live Stake Engine wallet API. */
export class RgsClient implements RgsTransport {
  readonly params: RgsParams;
  private readonly fetchImpl: typeof fetch;
  private readonly currency: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: RgsClientOptions) {
    this.params = options.params;
    this.fetchImpl =
      options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined!);
    this.currency = options.params.currency ?? 'USD';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = Math.max(1, options.maxRetries ?? 3);
    this.sleep = options.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /**
   * POST `body` to `path` and parse JSON.
   * @param idempotent When true, transport failures (network/timeout/5xx) are
   *   retried with bounded exponential backoff. Only safe for read-only/idempotent
   *   calls (authenticate, balance) — never for play/end-round, which would risk a
   *   double-settle without a server idempotency key.
   */
  private async request<T>(path: string, body: Record<string, unknown>, idempotent = false): Promise<T> {
    if (!this.params.rgsUrl) {
      throw new RgsError('ERR_ATE', 'No rgsUrl configured.');
    }
    if (!isSecureRgsUrl(this.params.rgsUrl)) {
      throw new RgsError('ERR_VAL', 'Refusing to use a non-HTTPS rgsUrl.');
    }
    const base = this.params.rgsUrl.replace(/\/$/, '');
    const attempts = idempotent ? this.maxRetries : 1;
    let lastErr: RgsError = new RgsError('ERR_UE');
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await this.sleep(Math.min(2000, 250 * 2 ** (attempt - 1)));
      try {
        return await this.requestOnce<T>(base, path, body);
      } catch (err) {
        lastErr = err instanceof RgsError ? err : new RgsError('ERR_UE', String(err));
        // Only transport/server errors (ERR_UE) are retryable; business errors
        // (insufficient balance, invalid session, …) are returned immediately.
        if (lastErr.code !== 'ERR_UE') throw lastErr;
      }
    }
    throw lastErr;
  }

  private async requestOnce<T>(base: string, path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = (err as Error).name === 'AbortError' ? 'Request timed out' : (err as Error).message;
      throw new RgsError('ERR_UE', `Network error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
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
    const raw = await this.request<Record<string, unknown>>(
      '/wallet/authenticate',
      {
        sessionID: this.params.sessionID,
        rgsUrl: this.params.rgsUrl,
        language: this.params.lang,
      },
      true // idempotent: safe to retry
    );
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

  /** Place a bet and receive the round's book.
   *
   * Not retried on transport errors (a bet is non-idempotent). On an expired
   * session (`ERR_IS`) we re-authenticate once and retry the bet a single time. */
  async play(amount: number, mode: BetMode): Promise<PlayResult> {
    const send = async () => {
      const raw = await this.request<Record<string, unknown>>('/wallet/play', {
        amount: toApiAmount(amount),
        mode,
        currency: this.currency,
        sessionID: this.params.sessionID,
        rgsUrl: this.params.rgsUrl,
      });
      assertSuccess(readStatusCode(raw.status)); // throws e.g. ERR_IS so it can be caught below
      return raw;
    };
    let raw: Record<string, unknown>;
    try {
      raw = await send();
    } catch (err) {
      if (err instanceof RgsError && err.code === 'ERR_IS') {
        await this.authenticate();
        raw = await send();
      } else {
        throw err;
      }
    }
    const round = this.readRound(raw.round);
    if (!round) throw new RgsError('ERR_UE', 'play() returned no round.');
    return { round, balance: readBalance(raw.balance, this.currency), statusCode: 'SUCCESS' };
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
    const raw = await this.request<Record<string, unknown>>(
      '/wallet/balance',
      {
        sessionID: this.params.sessionID,
        rgsUrl: this.params.rgsUrl,
      },
      true // idempotent
    );
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
    // Reject a malformed book before the frontend tries to replay it.
    if (r.book !== undefined && r.book !== null && !isValidBook(r.book)) {
      throw new RgsError('ERR_VAL', 'RGS returned a malformed book.');
    }
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
