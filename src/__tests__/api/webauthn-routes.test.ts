/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

// Re-export the real service through a mutable module object so a single test
// can spy on a service function to force the routes' defensive non-Error
// re-throw path. Shared singleton state is preserved (the spread copies the
// real closures, and __resetWebAuthnForTests resets that same state).
jest.mock('@/lib/api/webauthn-service', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/api/webauthn-service'),
}));

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { POST as registerOptions } from '@/app/api/webauthn/register/options/route';
import { POST as registerVerify } from '@/app/api/webauthn/register/verify/route';
import { POST as authenticateOptions } from '@/app/api/webauthn/authenticate/options/route';
import { POST as authenticateVerify } from '@/app/api/webauthn/authenticate/verify/route';
import { GET as listCredentialsRoute } from '@/app/api/webauthn/credentials/route';
import { DELETE as deleteCredentialRoute } from '@/app/api/webauthn/credentials/[id]/route';
import * as webauthnService from '@/lib/api/webauthn-service';
import { relyingParty, __resetWebAuthnForTests } from '@/lib/api/webauthn-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import { makeAuthenticator } from '@/__tests__/helpers/webauthn-fixtures';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const USER = seededAddress(9151);
const TOKEN = createSessionToken(USER).token;
const { rpId, origin } = relyingParty();

function post(path: string, body: unknown, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/webauthn/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
function get(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/webauthn/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
function del(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/webauthn/${path}`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
/** Force the shared middleware to wave the next request through unauthenticated. */
function bypassOnce() {
  mockedRunMiddleware.mockResolvedValueOnce(null);
}

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetWebAuthnForTests();
  __resetAuditLogForTests();
});

afterEach(() => {
  __resetWebAuthnForTests();
  __resetAuditLogForTests();
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

/** Enroll a passkey through the real routes and return the simulated device. */
async function enroll() {
  const device = makeAuthenticator(rpId, origin);
  const opts = (await (await registerOptions(post('register/options', {}, TOKEN))).json()).data;
  const res = await registerVerify(post('register/verify', device.registration(opts.challenge), TOKEN));
  expect(res.status).toBe(201);
  return device;
}

describe('POST /api/webauthn/register/options', () => {
  it('returns registration options to an authenticated user', async () => {
    const res = await registerOptions(post('register/options', {}, TOKEN));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.rp.id).toBe(rpId);
    expect(typeof data.challenge).toBe('string');
  });

  it('requires authentication', async () => {
    expect((await registerOptions(post('register/options', {}))).status).toBe(401);
    bypassOnce();
    expect((await registerOptions(post('register/options', {}))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await registerOptions(post('register/options', {}, TOKEN))).status).toBe(429);
  });
});

describe('POST /api/webauthn/register/verify', () => {
  it('completes registration and reports the stored credential', async () => {
    const device = makeAuthenticator(rpId, origin);
    const opts = (await (await registerOptions(post('register/options', {}, TOKEN))).json()).data;
    const res = await registerVerify(post('register/verify', device.registration(opts.challenge), TOKEN));
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.registered).toBe(true);
    expect(data.credential.id).toBe(device.credentialId);
  });

  it('rejects a malformed body with 422', async () => {
    const res = await registerVerify(post('register/verify', { attestationObject: '' }, TOKEN));
    expect(res.status).toBe(422);
  });

  it('surfaces a verification failure as 400', async () => {
    const device = makeAuthenticator(rpId, origin);
    // No options were requested, so there is no pending challenge to consume.
    const res = await registerVerify(post('register/verify', device.registration('stale'), TOKEN));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('WEBAUTHN_REGISTRATION_FAILED');
  });

  it('re-throws a non-Error failure from the service', async () => {
    const spy = jest.spyOn(webauthnService, 'finishRegistration').mockRejectedValueOnce('kaboom' as never);
    await expect(registerVerify(post('register/verify', { attestationObject: 'AA', clientDataJSON: '{}' }, TOKEN)))
      .rejects.toBe('kaboom');
    spy.mockRestore();
  });

  it('requires authentication', async () => {
    expect((await registerVerify(post('register/verify', {}))).status).toBe(401);
    bypassOnce();
    expect((await registerVerify(post('register/verify', {}))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await registerVerify(post('register/verify', {}, TOKEN))).status).toBe(429);
  });
});

describe('POST /api/webauthn/authenticate/options', () => {
  it('lists the caller\'s enrolled credentials as allowCredentials', async () => {
    const device = await enroll();
    const res = await authenticateOptions(post('authenticate/options', {}, TOKEN));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.rpId).toBe(rpId);
    expect(data.allowCredentials).toEqual([{ type: 'public-key', id: device.credentialId }]);
  });

  it('requires authentication', async () => {
    expect((await authenticateOptions(post('authenticate/options', {}))).status).toBe(401);
    bypassOnce();
    expect((await authenticateOptions(post('authenticate/options', {}))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await authenticateOptions(post('authenticate/options', {}, TOKEN))).status).toBe(429);
  });
});

describe('POST /api/webauthn/authenticate/verify', () => {
  it('verifies a valid assertion', async () => {
    const device = await enroll();
    const opts = (await (await authenticateOptions(post('authenticate/options', {}, TOKEN))).json()).data;
    const res = await authenticateVerify(post('authenticate/verify', device.assertion(1, opts.challenge), TOKEN));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ verified: true });
  });

  it('rejects a malformed body with 422', async () => {
    const res = await authenticateVerify(post('authenticate/verify', { credentialId: 'x' }, TOKEN));
    expect(res.status).toBe(422);
  });

  it('surfaces an assertion failure as 400', async () => {
    const device = await enroll();
    // Consume the challenge by requesting options, then tamper: wrong challenge.
    await authenticateOptions(post('authenticate/options', {}, TOKEN));
    const res = await authenticateVerify(post('authenticate/verify', device.assertion(1, 'wrong-challenge'), TOKEN));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('WEBAUTHN_ASSERTION_FAILED');
  });

  it('re-throws a non-Error failure from the service', async () => {
    const spy = jest.spyOn(webauthnService, 'finishAuthentication').mockRejectedValueOnce('kaboom' as never);
    await expect(authenticateVerify(post('authenticate/verify',
      { credentialId: 'a', authenticatorData: 'b', clientDataJSON: '{}', signature: 's' }, TOKEN)))
      .rejects.toBe('kaboom');
    spy.mockRestore();
  });

  it('requires authentication', async () => {
    expect((await authenticateVerify(post('authenticate/verify', {}))).status).toBe(401);
    bypassOnce();
    expect((await authenticateVerify(post('authenticate/verify', {}))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await authenticateVerify(post('authenticate/verify', {}, TOKEN))).status).toBe(429);
  });
});

describe('GET /api/webauthn/credentials', () => {
  it('lists the caller\'s passkeys', async () => {
    const device = await enroll();
    const res = await listCredentialsRoute(get('credentials', TOKEN));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.total).toBe(1);
    expect(data.credentials[0].id).toBe(device.credentialId);
  });

  it('requires authentication', async () => {
    expect((await listCredentialsRoute(get('credentials'))).status).toBe(401);
    bypassOnce();
    expect((await listCredentialsRoute(get('credentials'))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await listCredentialsRoute(get('credentials', TOKEN))).status).toBe(429);
  });
});

describe('DELETE /api/webauthn/credentials/[id]', () => {
  it('removes an enrolled passkey', async () => {
    const device = await enroll();
    const res = await deleteCredentialRoute(del(`credentials/${device.credentialId}`, TOKEN), idCtx(device.credentialId));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ deleted: true, id: device.credentialId });
  });

  it('returns 404 for an unknown passkey', async () => {
    const res = await deleteCredentialRoute(del('credentials/ghost', TOKEN), idCtx('ghost'));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it('requires authentication', async () => {
    expect((await deleteCredentialRoute(del('credentials/x'), idCtx('x'))).status).toBe(401);
    bypassOnce();
    expect((await deleteCredentialRoute(del('credentials/x'), idCtx('x'))).status).toBe(401);
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await deleteCredentialRoute(del('credentials/x', TOKEN), idCtx('x'))).status).toBe(429);
  });
});
