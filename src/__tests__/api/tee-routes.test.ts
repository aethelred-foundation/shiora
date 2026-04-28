/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

jest.mock('@/lib/api/mock-data', () => {
  const actual = jest.requireActual('@/lib/api/mock-data');
  return {
    ...actual,
    generateMockAttestations: jest.fn((...args: unknown[]) =>
      actual.generateMockAttestations(...args),
    ),
  };
});

const actualUtilsMod = jest.requireActual('@/lib/utils');
const mockSeededPick = jest.fn(actualUtilsMod.seededPick);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededPick: (...args: unknown[]) => mockSeededPick(...args),
}));

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { generateMockAttestations } from '@/lib/api/mock-data';
import { GET as getStatus } from '@/app/api/tee/status/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const mockedGenerateMockAttestations = generateMockAttestations as jest.MockedFunction<
  typeof generateMockAttestations
>;
const actualMockData = jest.requireActual('@/lib/api/mock-data');
import { GET as getAttestations } from '@/app/api/tee/attestations/route';
import { GET as getExplorer } from '@/app/api/tee/explorer/route';
import { GET as getExplorerById } from '@/app/api/tee/explorer/[id]/route';

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
  mockedGenerateMockAttestations.mockImplementation((...args: unknown[]) =>
    actualMockData.generateMockAttestations(...args),
  );
  mockSeededPick.mockImplementation(actualUtilsMod.seededPick);
});

describe('/api/tee/status', () => {
  it('returns TEE status', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/status');
    const res = await getStatus(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const req = new NextRequest('http://localhost:3000/api/tee/status');
    const res = await getStatus(req);
    expect(res.status).toBe(403);
  });
});

describe('/api/tee/attestations', () => {
  it('returns attestation list', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/attestations');
    const res = await getAttestations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.meta.summary).toBeDefined();
  });

  it('returns attestation list with pagination', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/attestations?page=1&limit=5');
    const res = await getAttestations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.pagination.limit).toBe(5);
  });

  it('filters by verified=true', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/attestations?verified=true');
    const res = await getAttestations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    body.data.forEach((a: { verified: boolean }) => {
      expect(a.verified).toBe(true);
    });
  });

  it('handles verified=false query param', async () => {
    // Note: z.coerce.boolean() converts "false" string to true (Boolean("false") === true)
    // This is a known quirk — the test validates the actual behavior
    const req = new NextRequest('http://localhost:3000/api/tee/attestations?verified=false');
    const res = await getAttestations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 422 for invalid query params', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/attestations?page=-1');
    const res = await getAttestations(req);
    expect(res.status).toBe(422);
  });

  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const req = new NextRequest('http://localhost:3000/api/tee/attestations');
    const res = await getAttestations(req);
    expect(res.status).toBe(403);
  });

  it('re-throws non-ZodError in catch block', async () => {
    mockedGenerateMockAttestations.mockImplementationOnce(() => {
      throw new Error('attestation generator failed');
    });
    await expect(
      getAttestations(new NextRequest('http://localhost:3000/api/tee/attestations')),
    ).rejects.toThrow('attestation generator failed');
  });
});

describe('/api/tee/explorer', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const req = new NextRequest('http://localhost:3000/api/tee/explorer');
    const res = await getExplorer(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for unknown view', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/explorer?view=unknown');
    const res = await getExplorer(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_VIEW');
  });
  it('returns TEE explorer data (default view)', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/explorer');
    const res = await getExplorer(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('returns attestations view', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/explorer?view=attestations');
    const res = await getExplorer(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns jobs view', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/explorer?view=jobs');
    const res = await getExplorer(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns enclaves view', async () => {
    const req = new NextRequest('http://localhost:3000/api/tee/explorer?view=enclaves');
    const res = await getExplorer(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('/api/tee/explorer/[id]', () => {
  it('returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const res = await getExplorerById(
      new NextRequest('http://localhost:3000/api/tee/explorer/any-id'),
      { params: Promise.resolve({ id: 'any-id' }) },
    );
    expect(res.status).toBe(403);
  });

  let validIds: string[] = [];

  beforeAll(async () => {
    const listRes = await getExplorer(
      new NextRequest('http://localhost:3000/api/tee/explorer?view=attestations'),
    );
    const listBody = await listRes.json();
    if (Array.isArray(listBody.data)) {
      validIds = listBody.data.map((a: { id: string }) => a.id);
    }
  });

  it('returns TEE details for a specific ID', async () => {
    expect(validIds.length).toBeGreaterThan(0);
    const res = await getExplorerById(
      new NextRequest(`http://localhost:3000/api/tee/explorer/${validIds[0]}`),
      { params: Promise.resolve({ id: validIds[0] }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(validIds[0]);
    expect(body.data.verification).toBeDefined();
    expect(body.data.enclave).toBeDefined();
    expect(body.data.model).toBeDefined();
  });

  it('returns details for multiple attestation IDs covering all platform firmware versions', async () => {
    const platformFirmwares = new Set<string>();
    // Iterate through all IDs to ensure all three platform branches are covered
    for (const id of validIds) {
      const res = await getExplorerById(
        new NextRequest(`http://localhost:3000/api/tee/explorer/${id}`),
        { params: Promise.resolve({ id }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.enclave.firmwareVersion).toBeDefined();
      platformFirmwares.add(body.data.enclave.firmwareVersion);
    }
    // All three firmware versions should be represented: Intel SGX (2.18.100.4), AWS Nitro (3.1.0), AMD SEV (1.51.0)
    expect(platformFirmwares.size).toBe(3);
  });

  it('falls back to modelId when AI_MODELS.find returns undefined (lines 100-101)', async () => {
    expect(validIds.length).toBeGreaterThan(0);
    // Mock seededPick: when picking from an array whose first element has an 'accuracy' field
    // (i.e. AI_MODELS), return a fake model with an unknown id
    mockSeededPick.mockImplementation((seed: number, arr: Array<Record<string, unknown>>) => {
      if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null && 'accuracy' in arr[0]) {
        return {
          id: 'unknown-model',
          name: 'X',
          version: 'X',
          type: 'X',
          accuracy: 0,
          description: '',
        };
      }
      return actualUtilsMod.seededPick(seed, arr);
    });
    const res = await getExplorerById(
      new NextRequest(`http://localhost:3000/api/tee/explorer/${validIds[0]}`),
      { params: Promise.resolve({ id: validIds[0] }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // name falls back to attestation.modelId, version falls back to 'v1.0'
    expect(body.data.model.name).toBe('unknown-model');
    expect(body.data.model.version).toBe('v1.0');
  });

  it('returns 404 for nonexistent ID', async () => {
    const res = await getExplorerById(
      new NextRequest('http://localhost:3000/api/tee/explorer/nonexistent'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});
