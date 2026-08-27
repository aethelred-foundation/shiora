/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as release } from '@/app/api/system/release/route';
import packageJson from '../../../package.json';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const URL = 'http://localhost:3000/api/system/release';

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) =>
    jest.requireActual('@/lib/api/middleware').runMiddleware(...args));
});

describe('GET /api/system/release', () => {
  it('serves the provenance manifest without authentication', async () => {
    const res = await release(new NextRequest(URL));
    expect(res.status).toBe(200);
    const manifest = (await res.json()).data;
    expect(manifest.service).toBe('shiora');
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.openapiHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.maturityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof manifest.migrationVersion).toBe('number');
  });

  it('returns the middleware block when blocked', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 429 }));
    expect((await release(new NextRequest(URL))).status).toBe(429);
  });
});
