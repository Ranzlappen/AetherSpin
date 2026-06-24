import { describe, it, expect, vi } from 'vitest';
import { parseRgsParams, RgsClient, RgsError, messageForStatus } from './rgsClient';
import { toApiAmount, fromApiAmount } from './amount';

/** Build a mock fetch returning the given JSON body with HTTP 200. */
function mockFetch(body: unknown): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  ) as unknown as typeof fetch;
}

describe('parseRgsParams', () => {
  it('reads sessionID, rgs_url, lang and currency from a query string', () => {
    const params = parseRgsParams('?sessionID=abc123&rgs_url=https://rgs.example/api&lang=de&currency=EUR');
    expect(params.sessionID).toBe('abc123');
    expect(params.rgsUrl).toBe('https://rgs.example/api');
    expect(params.lang).toBe('de');
    expect(params.currency).toBe('EUR');
  });

  it('accepts a full URL and camelCase aliases', () => {
    const params = parseRgsParams('https://game.example/index.html?sessionId=zzz&rgsUrl=https://r/api');
    expect(params.sessionID).toBe('zzz');
    expect(params.rgsUrl).toBe('https://r/api');
  });

  it("defaults lang to 'en' and missing params to null", () => {
    const params = parseRgsParams('?foo=bar');
    expect(params.sessionID).toBeNull();
    expect(params.rgsUrl).toBeNull();
    expect(params.currency).toBeNull();
    expect(params.lang).toBe('en');
  });
});

describe('amount conversion (shared helpers)', () => {
  it('round-trips dollars through the API integer', () => {
    expect(toApiAmount(1)).toBe(1_000_000);
    expect(toApiAmount(0.1)).toBe(100_000);
    expect(fromApiAmount(2_000_000)).toBe(2);
    expect(fromApiAmount(toApiAmount(12.34))).toBeCloseTo(12.34, 6);
  });
});

describe('RgsClient', () => {
  const params = {
    sessionID: 'sess',
    rgsUrl: 'https://rgs.example/api',
    lang: 'en',
    currency: 'USD',
  };

  it('authenticate converts API integer amounts back to dollars', async () => {
    const fetchImpl = mockFetch({
      status: { statusCode: 'SUCCESS' },
      balance: { amount: 50_000_000, currency: 'USD' },
      config: {
        minBet: 100_000,
        maxBet: 100_000_000,
        stepBet: 100_000,
        betLevels: [100_000, 1_000_000],
      },
      round: null,
    });
    const client = new RgsClient({ params, fetchImpl });
    const auth = await client.authenticate();
    expect(auth.balance.amount).toBe(50);
    expect(auth.config.minBet).toBe(0.1);
    expect(auth.config.maxBet).toBe(100);
    expect(auth.config.betLevels).toEqual([0.1, 1]);
  });

  it('play sends the bet as an API integer and parses the round', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.amount).toBe(toApiAmount(2.5));
      expect(sent.mode).toBe('base');
      return new Response(
        JSON.stringify({
          status: { statusCode: 'SUCCESS' },
          balance: { amount: 47_500_000, currency: 'USD' },
          round: {
            betID: 7,
            state: 'placed',
            payoutMultiplier: 3,
            book: {
              id: 7,
              payoutMultiplier: 3,
              events: [
                { type: 'reveal', gameType: 'base', board: [['L1']], reelStops: [0] },
                { type: 'finalWin', amount: 3, wincap: false },
              ],
            },
          },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl });
    const res = await client.play(2.5, 'base');
    expect(res.round.betID).toBe(7);
    expect(res.balance.amount).toBe(47.5);
    expect(res.round.book?.payoutMultiplier).toBe(3);
  });

  it('maps non-SUCCESS status codes to a typed RgsError', async () => {
    const fetchImpl = mockFetch({ status: { statusCode: 'ERR_IPB' } });
    const client = new RgsClient({ params, fetchImpl });
    await expect(client.play(1, 'base')).rejects.toMatchObject({
      name: 'RgsError',
      code: 'ERR_IPB',
    });
  });

  it('wraps network failures as ERR_UE', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl, maxRetries: 1 });
    await expect(client.authenticate()).rejects.toBeInstanceOf(RgsError);
  });

  const noSleep = async () => {};

  it('retries idempotent authenticate on transient transport errors', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('flaky network');
      return new Response(JSON.stringify({ status: { statusCode: 'SUCCESS' }, balance: { amount: 0 } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl, maxRetries: 3, sleepImpl: noSleep });
    await client.authenticate();
    expect(calls).toBe(3);
  });

  it('does NOT retry a non-idempotent play (single attempt)', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl, maxRetries: 3, sleepImpl: noSleep });
    await expect(client.play(1, 'base')).rejects.toBeInstanceOf(RgsError);
    expect(calls).toBe(1);
  });

  it('re-authenticates once and retries play on ERR_IS', async () => {
    let playCalls = 0;
    let authCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/wallet/authenticate')) {
        authCalls += 1;
        return new Response(JSON.stringify({ status: { statusCode: 'SUCCESS' }, balance: { amount: 0 } }), {
          status: 200,
        });
      }
      // /wallet/play: first call fails with an expired session, second succeeds.
      playCalls += 1;
      if (playCalls === 1) {
        return new Response(JSON.stringify({ status: { statusCode: 'ERR_IS' } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          status: { statusCode: 'SUCCESS' },
          balance: { amount: 0 },
          round: {
            betID: 1,
            state: 'placed',
            payoutMultiplier: 0,
            book: {
              id: 1,
              payoutMultiplier: 0,
              events: [
                { type: 'reveal', gameType: 'base', board: [['L1']], reelStops: [0] },
                { type: 'finalWin', amount: 0, wincap: false },
              ],
            },
          },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl, sleepImpl: noSleep });
    const res = await client.play(1, 'base');
    expect(res.round.betID).toBe(1);
    expect(authCalls).toBe(1);
    expect(playCalls).toBe(2);
  });

  it('times out a hung request as ERR_UE', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          );
        })
    ) as unknown as typeof fetch;
    const client = new RgsClient({ params, fetchImpl, timeoutMs: 10, maxRetries: 1 });
    await expect(client.authenticate()).rejects.toMatchObject({ code: 'ERR_UE' });
  });

  it('refuses a non-HTTPS rgsUrl', async () => {
    const client = new RgsClient({
      params: { ...params, rgsUrl: 'http://evil.example/api' },
      fetchImpl: mockFetch({ status: { statusCode: 'SUCCESS' } }),
    });
    await expect(client.authenticate()).rejects.toMatchObject({ code: 'ERR_VAL' });
  });

  it('rejects a malformed book before replay', async () => {
    const fetchImpl = mockFetch({
      status: { statusCode: 'SUCCESS' },
      balance: { amount: 0 },
      round: {
        betID: 9,
        state: 'placed',
        payoutMultiplier: 0,
        book: { id: 9, payoutMultiplier: 0, events: [] },
      },
    });
    const client = new RgsClient({ params, fetchImpl });
    await expect(client.play(1, 'base')).rejects.toMatchObject({ code: 'ERR_VAL' });
  });
});

describe('isValidBook', () => {
  it('accepts a well-formed book and rejects malformed ones', async () => {
    const { isValidBook } = await import('./rgsClient');
    const good = {
      id: 1,
      payoutMultiplier: 0,
      events: [
        { type: 'reveal', gameType: 'base', board: [['L1']], reelStops: [0] },
        { type: 'finalWin', amount: 0, wincap: false },
      ],
    };
    expect(isValidBook(good)).toBe(true);
    expect(isValidBook({ id: 1, payoutMultiplier: 0, events: [] })).toBe(false);
    expect(
      isValidBook({ id: 1, payoutMultiplier: 0, events: [{ type: 'bogus' }, { type: 'finalWin' }] })
    ).toBe(false);
    expect(isValidBook(null)).toBe(false);
  });
});

describe('messageForStatus', () => {
  it('returns a friendly message per code', () => {
    expect(messageForStatus('ERR_IPB')).toMatch(/balance/i);
    expect(messageForStatus('ERR_IS')).toMatch(/session/i);
  });
});
