/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn().mockReturnValue(null);
jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(...args),
}));

import { GET as getClinical } from '@/app/api/clinical/route';
import { GET as getDifferentials } from '@/app/api/clinical/differentials/route';
import { GET as getInteractions } from '@/app/api/clinical/interactions/route';
import { GET as getPathways } from '@/app/api/clinical/pathways/route';
import { GET as getAudit } from '@/app/api/clinical/audit/route';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const PROVIDER = seededAddress(100);
const PATIENT = seededAddress(101);
const providerToken = createSessionToken(PROVIDER).token;
const patientToken = createSessionToken(PATIENT).token;

beforeEach(async () => {
  __resetRolesForTests();
  await assignRole(PROVIDER, 'provider');
});

afterEach(() => {
  mockRunMiddleware.mockReturnValue(null);
});

function authed(url: string, token: string): NextRequest {
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

const BASE = 'http://localhost:3000/api/clinical';

describe('/api/clinical (provider-gated)', () => {
  it('returns clinical stats for a provider', async () => {
    const res = await getClinical(authed(BASE, providerToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalDecisions).toBeDefined();
    expect(body.data.activePathways).toBeDefined();
  });

  it('returns the alerts view for a provider', async () => {
    const res = await getClinical(authed(`${BASE}?view=alerts`, providerToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].severity).toBeDefined();
  });

  it('returns 400 for an invalid view', async () => {
    const res = await getClinical(authed(`${BASE}?view=invalid`, providerToken));
    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-provider', async () => {
    const res = await getClinical(authed(BASE, patientToken));
    expect(res.status).toBe(403);
  });

  it('returns the blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await getClinical(authed(BASE, providerToken));
    expect(res.status).toBe(429);
  });
});

describe.each([
  ['differentials', getDifferentials],
  ['interactions', getInteractions],
  ['pathways', getPathways],
  ['audit', getAudit],
] as const)('/api/clinical/%s (provider-gated)', (name, handler) => {
  const url = `${BASE}/${name}`;

  it('returns data for a provider', async () => {
    const res = await handler(authed(url, providerToken));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 403 for a non-provider', async () => {
    const res = await handler(authed(url, patientToken));
    expect(res.status).toBe(403);
  });

  it('returns the blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    const res = await handler(authed(url, providerToken));
    expect(res.status).toBe(429);
  });
});
