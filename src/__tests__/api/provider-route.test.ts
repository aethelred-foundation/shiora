/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getPatients } from '@/app/api/provider/patients/route';
import { createAccessGrant, __resetAccessForTests } from '@/lib/api/access-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { updateProfile, __resetProfileForTests } from '@/lib/api/profile-service';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import type { MockAccessGrant } from '@/lib/api/mock-data';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

const PROVIDER = seededAddress(800);
const OTHER_PROVIDER = seededAddress(801);
const PATIENT = seededAddress(802);
const INDIVIDUAL = seededAddress(803);
const providerToken = createSessionToken(PROVIDER).token;
const individualToken = createSessionToken(INDIVIDUAL).token;

function grant(owner: string, providerAddress: string): MockAccessGrant {
  return {
    id: `g-${owner}-${providerAddress}`, provider: 'Dr', specialty: 'OB-GYN', address: providerAddress,
    status: 'Active', scope: 'Full Records', grantedAt: 1, expiresAt: 2, lastAccess: null,
    accessCount: 0, txHash: 't', attestation: 'a', canView: true, canDownload: false, canShare: false,
    ownerAddress: owner,
  };
}

beforeEach(async () => {
  __resetRolesForTests();
  __resetAccessForTests();
  __resetProfileForTests();
  await assignRole(PROVIDER, 'provider');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const URL = 'http://localhost:3001/api/provider/patients';

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(URL, { headers });
}

describe('GET /api/provider/patients', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await getPatients(req(providerToken))).status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(null);
    expect((await getPatients(req())).status).toBe(401);
  });

  it('returns 403 for a non-provider', async () => {
    expect((await getPatients(req(individualToken))).status).toBe(403);
  });

  it('lists only the patients who granted this provider access, with their display name', async () => {
    await createAccessGrant(PATIENT, grant(PATIENT, PROVIDER)); // targets this provider
    await createAccessGrant(PATIENT, grant(PATIENT, OTHER_PROVIDER)); // targets another provider
    await updateProfile(PATIENT, { displayName: 'Patient Zero' });

    const res = await getPatients(req(providerToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.patientCount).toBe(1);
    expect(body.data.patients[0].patientAddress).toBe(PATIENT);
    expect(body.data.patients[0].patientName).toBe('Patient Zero');
    expect(body.data.patients[0].permissions.view).toBe(true);
  });
});
