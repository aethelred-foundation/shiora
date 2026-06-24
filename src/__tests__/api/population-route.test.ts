/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getAnalytics } from '@/app/api/population/analytics/route';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { __resetConsentForTests } from '@/lib/api/consent-service';
import { __resetAccessForTests } from '@/lib/api/access-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const ANALYST = seededAddress(700);
const INDIVIDUAL = seededAddress(701);
const analystToken = createSessionToken(ANALYST).token;
const individualToken = createSessionToken(INDIVIDUAL).token;

beforeEach(async () => {
  __resetRolesForTests();
  __resetConsentForTests();
  __resetAccessForTests();
  await assignRole(ANALYST, 'payer_analyst');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3001/api/population/analytics';

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(URL, { headers });
}

describe('GET /api/population/analytics', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getAnalytics(req(analystToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockReturnValueOnce(null);
    expect((await getAnalytics(req())).status).toBe(401);
  });

  it('returns 403 without the population-analytics capability', async () => {
    expect((await getAnalytics(req(individualToken))).status).toBe(403);
  });

  it('returns de-identified analytics for a health-plan analyst', async () => {
    const res = await getAnalytics(req(analystToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.minimumCohort).toBeDefined();
    expect(typeof body.data.cohortSize).toBe('number');
  });
});
