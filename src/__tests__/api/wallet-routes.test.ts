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
import {
  GET as getConnect,
  POST as postConnect,
  DELETE as deleteConnect,
} from '@/app/api/wallet/connect/route';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockVerifyChallenge.mockImplementation(actualChallenge.verifyChallenge);
});

const TEST_ADDRESS = seededAddress(12345);
const { token: TEST_TOKEN } = createSessionToken(TEST_ADDRESS);

const SESSION_SECRET = 'shiora-dev-session-secret-change-me-before-production';

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
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  return { nonce, issuedAt, expiresAt, hmac };
}

describe('/api/wallet/challenge', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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

  it('returns TIMESTAMP_EXPIRED for old timestamp', async () => {
    const challenge = createTestChallenge(TEST_ADDRESS);
    const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const req = new NextRequest('http://localhost:3000/api/wallet/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: TEST_ADDRESS,
        signature: 'fakesig',
        timestamp: oldTimestamp,
        ...challenge,
      }),
    });
    const res = await postConnect(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TIMESTAMP_EXPIRED');
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

  it('returns 200 with session on valid signature', async () => {
    // Generate a real secp256k1 keypair and sign the challenge
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
    });

    // Get the compressed public key bytes
    const pubKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    // The last 33 bytes of SPKI DER for compressed key, but we need uncompressed then compress
    const pubKeyUncompressed = crypto.ECDH.convertKey(
      pubKeyDer.subarray(pubKeyDer.length - 65),
      'secp256k1',
      undefined,
      undefined,
      'compressed',
    );
    const pubKeyHex = (pubKeyUncompressed as Buffer).toString('hex');

    // Derive the aeth address from the public key
    const sha256Hash = crypto.createHash('sha256').update(pubKeyUncompressed as Buffer).digest();
    const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();

    // Minimal bech32 encode
    function bech32Encode(hrp: string, data: Buffer): string {
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      const words: number[] = [];
      let acc = 0;
      let bits = 0;
      for (let i = 0; i < data.length; i++) {
        acc = (acc << 8) | data[i];
        bits += 8;
        while (bits >= 5) {
          bits -= 5;
          words.push((acc >> bits) & 0x1f);
        }
      }
      if (bits > 0) words.push((acc << (5 - bits)) & 0x1f);

      function hrpExpand(h: string): number[] {
        const r: number[] = [];
        for (const c of h) r.push(c.charCodeAt(0) >> 5);
        r.push(0);
        for (const c of h) r.push(c.charCodeAt(0) & 0x1f);
        return r;
      }
      function polymod(values: number[]): number {
        const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        let chk = 1;
        for (const v of values) {
          const top = chk >> 25;
          chk = ((chk & 0x1ffffff) << 5) ^ v;
          for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) chk ^= GEN[i];
          }
        }
        return chk;
      }
      const values = [...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
      const p = polymod(values) ^ 1;
      const checksum: number[] = [];
      for (let i = 0; i < 6; i++) checksum.push((p >> (5 * (5 - i))) & 0x1f);
      return hrp + '1' + [...words, ...checksum].map((d) => CHARSET[d]).join('');
    }

    const walletAddress = bech32Encode('aeth', ripemd160Hash);

    // Create challenge with this address
    const challenge = createTestChallenge(walletAddress);

    // Construct the challenge message
    const challengeMessage = [
      'Shiora on Aethelred — Wallet Authentication',
      '',
      `Address: ${walletAddress}`,
      `Nonce: ${challenge.nonce}`,
      `Issued: ${new Date(challenge.issuedAt).toISOString()}`,
      `Expires: ${new Date(challenge.expiresAt).toISOString()}`,
      '',
      'Sign this message to authenticate with Shiora.',
      'This request will not trigger a blockchain transaction.',
    ].join('\n');

    // Sign it
    const messageHash = crypto.createHash('sha256').update(challengeMessage).digest();
    const sigDer = crypto.sign(null, messageHash, privateKey);
    // Convert DER to raw r||s (64 bytes)
    function derToRaw(der: Buffer): Buffer {
      let offset = 2; // skip 0x30 + length
      // r
      offset++; // 0x02
      const rLen = der[offset++];
      const r = der.subarray(offset, offset + rLen);
      offset += rLen;
      // s
      offset++; // 0x02
      const sLen = der[offset++];
      const s = der.subarray(offset, offset + sLen);

      // Strip leading zero padding (DER can have 33-byte r/s with leading 0x00)
      const rTrimmed = r.length > 32 ? r.subarray(r.length - 32) : r;
      const sTrimmed = s.length > 32 ? s.subarray(s.length - 32) : s;
      const rPadded = Buffer.alloc(32);
      rTrimmed.copy(rPadded, 32 - rTrimmed.length);
      const sPadded = Buffer.alloc(32);
      sTrimmed.copy(sPadded, 32 - sTrimmed.length);
      return Buffer.concat([rPadded, sPadded]);
    }
    const rawSig = derToRaw(sigDer);
    const signatureField = `${pubKeyHex}.${rawSig.toString('hex')}`;

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
    expect(body.data.balances).toBeDefined();
    expect(body.data.profile).toBeDefined();
  });
});

describe('/api/wallet/connect DELETE', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
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
});
