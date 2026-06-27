/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET } from '@/app/api/provider/patients/[address]/records/route';
import { createRecord, __resetRecordsForTests } from '@/lib/api/records-service';
import { createAccessGrant, __resetAccessForTests } from '@/lib/api/access-service';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';
import type { MockAccessGrant, MockHealthRecord } from '@/lib/api/mock-data';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const PROVIDER = seededAddress(900);
const PATIENT = seededAddress(901);
const NON_PROVIDER = seededAddress(902);
const providerToken = createSessionToken(PROVIDER).token;
const nonProviderToken = createSessionToken(NON_PROVIDER).token;

function grantFrom(patient: string, overrides: Partial<MockAccessGrant> = {}): MockAccessGrant {
  return {
    id: `grant-${patient}`, provider: 'Dr. Rivera', specialty: 'Oncology',
    address: PROVIDER, status: 'Active', scope: 'Full Records',
    grantedAt: Date.now(), expiresAt: Date.now() + 1e9, lastAccess: null,
    accessCount: 0, txHash: '0x', attestation: 'att',
    canView: true, canDownload: false, canShare: false, ownerAddress: patient,
    ...overrides,
  };
}

function record(): MockHealthRecord {
  return {
    id: 'rec-shared', type: 'lab', label: 'CBC panel', description: 'note',
    date: 1, uploadDate: 1, encrypted: false, encryption: 'none', cid: 'c', txHash: 't',
    attestation: 'a', size: 10, provider: 'p', status: 'Processing', ipfsNodes: 0,
    tags: ['hematology'], deleted: false, ownerAddress: PATIENT, blockHeight: 1,
  };
}

beforeEach(async () => {
  __resetRecordsForTests();
  __resetAccessForTests();
  __resetRolesForTests();
  __resetAuditLogForTests();
  await assignRole(PROVIDER, 'provider');
});

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

const BASE = `http://localhost:3000/api/provider/patients/${PATIENT}/records`;

function authed(url: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { headers });
}

function ctx(address: string) {
  return { params: Promise.resolve({ address }) };
}

describe('GET /api/provider/patients/[address]/records', () => {
  it('returns the middleware error when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    expect((await GET(authed(BASE, providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 403 for a non-provider (missing the view_granted_records capability)', async () => {
    expect((await GET(authed(BASE, nonProviderToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns 400 for an invalid patient address', async () => {
    const res = await GET(
      authed('http://localhost:3000/api/provider/patients/bad/records', providerToken),
      ctx('not-an-address'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when the provider has no active grant', async () => {
    await createRecord(PATIENT, record());
    expect((await GET(authed(BASE, providerToken), ctx(PATIENT))).status).toBe(403);
  });

  it('returns the shared records when the patient has granted access', async () => {
    await createRecord(PATIENT, record());
    await createAccessGrant(PATIENT, grantFrom(PATIENT));

    const res = await GET(authed(BASE, providerToken), ctx(PATIENT));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.patientAddress).toBe(PATIENT);
    expect(body.data.total).toBe(1);
    expect(body.data.records[0].label).toBe('CBC panel');
  });
});
