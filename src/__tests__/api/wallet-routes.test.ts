/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

const actualChallenge = jest.requireActual('@/lib/api/challenge');
const mockVerifyChallenge = jest.fn(actualChallenge.verifyChallenge);
jest.mock('@/lib/api/challenge', () => ({
  ...jest.requireActual('@/lib/api/challenge'),
  verifyChallenge: (...args: unknown[]) => mockVerifyChallenge(...args),
}));

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getChallenge } from '@/app/api/wallet/challenge/route';
import { challengeSigningKey } from '@/lib/crypto/derived-secrets';
import {
  GET as getConnect,
  POST as postConnect,
  DELETE as deleteConnect,
} from '@/app/api/wallet/connect/route';
import { createSessionToken, verifySessionToken } from '@/lib/api/session';
import { isSessionRevoked } from '@/lib/api/session-revocation';
import { __resetNonceStoreForTests } from '@/lib/persistence/nonce-store';
import { __resetRateLimiterForTests } from '@/lib/api/rate-limiter';
import { __resetRevocationStoreForTests } from '@/lib/persistence/revocation-store';
import { __resetLoginAttemptStoreForTests } from '@/lib/persistence/login-attempt-store';
import { seededAddress } from '@/lib/utils';
import {
  testPrivateKey,
  evmAddress,
  personalSign,
  buildChallengeMessage,
} from '@/__tests__/helpers/evm-wallet';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockVerifyChallenge.mockImplementation(actualChallenge.verifyChallenge);
  __resetNonceStoreForTests();
  __resetRevocationStoreForTests();
  __resetRateLimiterForTests();
  __resetLoginAttemptStoreForTests();
});

const TEST_ADDRESS = seededAddress(12345);
const { token: TEST_TOKEN } = createSessionToken(TEST_ADDRESS);


function authedReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${TEST_TOKEN}` },
  });
}

/** Create a valid HMAC-signed challenge for testing */
function createTestChallenge(address: string) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60 * 1000;
  const payload = `${address}:${nonce}:${issuedAt}:${expiresAt}`;
  const hmac = crypto
    .createHmac('sha256', challengeSigningKey())
    .update(payload)
    .digest('hex');
  return { nonce, issuedAt, expiresAt, hmac };
}

describe('failed-auth lockout (GAP-09)', () => {
  it('locks the address after repeated invalid signatures, then 429s further attempts', async () => {
    const victim = seededAddress(90909);
    function badAttempt() {
      const challenge = createTestChallenge(victim);
      return postConnect(new NextRequest('http://localhost:3000/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: victim, signature: 'fakesig', ...challenge }),
      }));
    }

    // The first five bad signatures fail verification (not yet locked).
    for (let i = 0; i < 5; i++) {
      const res = await badAttempt();
      expect((await res.json()).error.code).toBe('INVALID_SIGNATURE');
    }

    // The sixth is refused outright: the address is now locked.
    const locked = await badAttempt();
    expect(locked.status).toBe(429);
    expect((await locked.json()).error.code).toBe('ACCOUNT_LOCKED');
    expect(Number(locked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
  });
});

describe('auth rate-limit class (GAP-04)', () => {
  it('challenge issuance and connect verification run under the stricter budget', async () => {
    const { AUTH_RATE_LIMIT } = jest.requireActual('@/lib/api/middleware');
    expect(AUTH_RATE_LIMIT).toEqual({ maxRequests: 20, windowMs: 60_000 });

    await getChallenge(new NextRequest(`http://localhost:3000/api/wallet/challenge?address=${TEST_ADDRESS}`));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(expect.anything(), AUTH_RATE_LIMIT);

    await postConnect(new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(mockedRunMiddleware).toHaveBeenLastCalledWith(expect.anything(), AUTH_RATE_LIMIT);
  });
});

describe('/api/wallet/challenge', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest(`http://localhost:3000/api/wallet/challenge?address=${TEST_ADDRESS}`);
    const res = await getChallenge(req);
    expect(res.status).toBe(403);
  });

  it('returns challenge for valid aeth address', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/wallet/challenge?address=${TEST_ADDRESS}`,
    );
    const res = await getChallenge(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('Shiora on Aethelred');
    expect(body.data.nonce).toBeDefined();
    expect(body.data.hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.issuedAt).toBeDefined();
    expect(body.data.expiresAt).toBeGreaterThan(body.data.issuedAt);
  });

  it('returns 400 for missing address', async () => {
    const req = new NextRequest('http://localhost:3000/api/wallet/challenge');
    const res = await getChallenge(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ADDRESS');
  });

  it('returns 400 for invalid address format', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/wallet/challenge?address=invalidaddr',
    );
    const res = await getChallenge(req);
    expect(res.status).toBe(400);
  });
});

describe('/api/wallet/connect GET', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getConnect(authedReq('http://localhost:3000/api/wallet/connect'));
    expect(res.status).toBe(403);
  });

  it('returns session info for authenticated user', async () => {
    const res = await getConnect(authedReq('http://localhost:3000/api/wallet/connect'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.address).toBe(TEST_ADDRESS);
    expect(body.data.authenticated).toBe(true);
  });

  it('returns 401 for unauthenticated request', async () => {
    const req = new NextRequest('http://localhost:3000/api/wallet/connect');
    const res = await getConnect(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('/api/wallet/connect POST', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(403);
  });

  it('returns validation error for empty body', async () => {
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns validation error for invalid address', async () => {
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: 'invalid',
        signature: 'test',
        timestamp: Date.now(),
        nonce: 'abc',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 300000,
        hmac: 'a'.repeat(64),
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(422);
  });

  it('returns INVALID_CHALLENGE for bad HMAC', async () => {
    const now = Date.now();
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        signature: 'fakesig',
        timestamp: now,
        nonce: 'testnonce',
        issuedAt: now,
        expiresAt: now + 300000,
        hmac: 'b'.repeat(64),
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CHALLENGE');
  });

  it('ignores any client-supplied timestamp — freshness is challenge-bound (audit L-04)', async () => {
    const challenge = createTestChallenge(TEST_ADDRESS);
    // A "stale" client timestamp must not produce a freshness rejection: the
    // field is attacker-controlled and was removed from the schema. Freshness
    // comes from the HMAC-bound expiresAt + single-use nonce, so this request
    // proceeds to real signature verification and fails there instead.
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        signature: 'fakesig',
        timestamp: Date.now() - 10 * 60 * 1000, // stripped, not validated
        ...challenge,
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('returns INVALID_SIGNATURE for wrong signature format', async () => {
    const challenge = createTestChallenge(TEST_ADDRESS);
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        signature: 'not-a-valid-sig',
        timestamp: Date.now(),
        ...challenge,
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('returns INVALID_CHALLENGE with default message when reason is undefined (line 81 ?? fallback)', async () => {
    const challenge = createTestChallenge(TEST_ADDRESS);
    // Mock verifyChallenge to return { valid: false } without a reason
    mockVerifyChallenge.mockReturnValueOnce({ valid: false });
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        signature: 'fakesig',
        timestamp: Date.now(),
        ...challenge,
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CHALLENGE');
    expect(body.error.message).toBe('Challenge verification failed.');
  });

  it('POST throws on invalid JSON body (non-Zod error)', async () => {
    await expect(
      postConnect(
        new NextRequest('http://localhost:3000/api/wallet/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects a replayed challenge — single-use nonce (audit H-02)', async () => {
    const challenge = createTestChallenge(TEST_ADDRESS);
    const payload = {
      address: TEST_ADDRESS,
      signature: 'deadbeef.deadbeef', // HMAC valid → nonce consumed; signature then fails
      timestamp: Date.now(),
      ...challenge,
    };
    const mk = () => new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // First redemption consumes the nonce, then fails on the bogus signature.
    const first = await postConnect(mk());
    expect((await first.json()).error.code).toBe('INVALID_SIGNATURE');

    // Replaying the same challenge is rejected before signature verification.
    const second = await postConnect(mk());
    expect(second.status).toBe(400);
    expect((await second.json()).error.code).toBe('CHALLENGE_ALREADY_USED');
  });

  it('returns 200 with session on a valid EIP-191 signature', async () => {
    // The Aethelred Wallet signs the challenge with personal_sign; the account
    // is the 0x address the signature recovers to.
    const privKey = testPrivateKey(0xa11ce);
    const walletAddress = evmAddress(privKey);

    const challenge = createTestChallenge(walletAddress);
    const challengeMessage = buildChallengeMessage({
      address: walletAddress,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
    });
    const signatureField = personalSign(challengeMessage, privKey);

    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: walletAddress,
        signature: signatureField,
        timestamp: Date.now(),
        ...challenge,
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.address).toBe(walletAddress);
    expect(body.data.expiresAt).toBeDefined();
    expect(body.data.session).toBeDefined();
    // The server must not fabricate data it has no source for (audit L-01).
    expect(body.data.balances).toBeUndefined();
    expect(body.data.profile).toBeUndefined();
  });
});

describe('/api/wallet/connect DELETE', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', { method: 'DELETE' });
    const res = await deleteConnect(req);
    expect(res.status).toBe(403);
  });

  it('returns disconnected response', async () => {
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'DELETE',
    });
    const res = await deleteConnect(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.disconnected).toBe(true);
  });

  it('server-side revokes the presented session so the token stops being honored', async () => {
    __resetRevocationStoreForTests();
    const { token } = createSessionToken(seededAddress(6060));
    const claims = verifySessionToken(token)!;
    expect(await isSessionRevoked(claims)).toBe(false);

    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await deleteConnect(req);
    expect(res.status).toBe(200);

    // The logged-out token is now rejected everywhere, not just cleared client-side.
    expect(await isSessionRevoked(claims)).toBe(true);
  });
});
