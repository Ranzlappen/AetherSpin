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
            book: { id: 7, payoutMultiplier: 3, events: [] },
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
    const client = new RgsClient({ params, fetchImpl });
    await expect(client.authenticate()).rejects.toBeInstanceOf(RgsError);
  });
});

describe('messageForStatus', () => {
  it('returns a friendly message per code', () => {
    expect(messageForStatus('ERR_IPB')).toMatch(/balance/i);
    expect(messageForStatus('ERR_IS')).toMatch(/session/i);
  });
});
