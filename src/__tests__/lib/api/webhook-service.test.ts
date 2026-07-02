/** @jest-environment node */

jest.mock('@/lib/persistence/sql-client', () => ({ getPgClient: jest.fn(() => ({ query: jest.fn(async () => ({ rows: [] })) })) }));

import {
  createSubscription,
  listSubscriptions,
  getSubscription,
  deleteSubscription,
  deliverWebhook,
  __resetWebhooksForTests,
} from '@/lib/api/webhook-service';
import { verifyWebhookSignature } from '@/lib/api/webhook-security';
import { seededAddress } from '@/lib/utils';

const OWNER = seededAddress(2100);
const URL_OK = 'https://hooks.partner.example.com/shiora';

afterEach(() => __resetWebhooksForTests());

describe('webhook subscriptions', () => {
  it('creates a subscription with a signing secret and defaults events to *', async () => {
    const sub = await createSubscription(OWNER, { url: URL_OK });
    expect(sub.url).toBe(URL_OK);
    expect(sub.secret).toMatch(/^whsec_/);
    expect(sub.events).toEqual(['*']);
    expect(sub.active).toBe(true);
  });

  it('rejects an unsafe URL at create time', async () => {
    await expect(createSubscription(OWNER, { url: 'https://169.254.169.254/x' })).rejects.toThrow(/private|loopback/);
  });

  it('lists subscriptions with the secret redacted', async () => {
    await createSubscription(OWNER, { url: URL_OK, events: ['record.created'] });
    const [view] = await listSubscriptions(OWNER);
    expect(view.secretPreview).toMatch(/…$/);
    expect((view as unknown as { secret?: string }).secret).toBeUndefined();
    expect(view.events).toEqual(['record.created']);
  });

  it('gets and deletes a subscription', async () => {
    const sub = await createSubscription(OWNER, { url: URL_OK });
    expect((await getSubscription(OWNER, sub.id))?.id).toBe(sub.id);
    expect(await deleteSubscription(OWNER, sub.id)).toBe(true);
    expect(await getSubscription(OWNER, sub.id)).toBeUndefined();
    expect(await deleteSubscription(OWNER, sub.id)).toBe(false); // already gone
  });

  it('uses the Postgres store when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    __resetWebhooksForTests();
    try {
      expect(await listSubscriptions(OWNER)).toEqual([]); // mocked pg → empty
    } finally {
      delete process.env.DATABASE_URL;
      __resetWebhooksForTests();
    }
  });
});

describe('deliverWebhook', () => {
  const sub = { url: URL_OK, secret: 'whsec_abc' };

  it('signs the delivery and reports success on a 2xx', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await deliverWebhook(sub, { type: 'webhook.test', data: { x: 1 } }, {
      fetchImpl, now: () => 1_700_000_000_000,
    });

    expect(result).toEqual({ delivered: true, status: 200, attempts: 1 });
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers['X-Shiora-Event']).toBe('webhook.test');
    // The signature verifies against the delivered body.
    expect(verifyWebhookSignature(sub.secret, captured!.init.body as string, headers['X-Shiora-Signature'], 1_700_000_000_000)).toBe(true);
  });

  it('retries with backoff and eventually succeeds', async () => {
    const responses = [
      () => { throw new Error('ECONNRESET'); },
      () => new Response(null, { status: 500 }),
      () => new Response(null, { status: 204 }),
    ];
    let i = 0;
    const fetchImpl = jest.fn(async () => responses[i++]()) as unknown as typeof fetch;
    const sleep = jest.fn(async () => {});

    const result = await deliverWebhook(sub, { type: 'e', data: {} }, { fetchImpl, sleep, baseDelayMs: 10 });

    expect(result).toEqual({ delivered: true, status: 204, attempts: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Backoff grows: 10, 20 between the three attempts.
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it('gives up after all attempts fail', async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await deliverWebhook(sub, { type: 'e', data: {} }, { fetchImpl, sleep: async () => {}, attempts: 2 });
    expect(result).toEqual({ delivered: false, attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  it('uses default sleep/now when they are not injected', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => (call++ === 0 ? new Response(null, { status: 500 }) : new Response(null, { status: 200 }))) as unknown as typeof fetch;
    // Only fetchImpl + a 1ms backoff → the real defaultSleep and Date.now run.
    const result = await deliverWebhook(sub, { type: 'e', data: {} }, { fetchImpl, baseDelayMs: 1, attempts: 2 });
    expect(result.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses to deliver to an unsafe URL (with default options, before any fetch)', async () => {
    // No options arg → exercises the default options + default fetch binding;
    // the SSRF guard throws before fetch is ever called, so nothing leaves.
    await expect(
      deliverWebhook({ url: 'https://127.0.0.1/x', secret: 's' }, { type: 'e', data: {} }),
    ).rejects.toThrow(/private|loopback/);
  });
});
