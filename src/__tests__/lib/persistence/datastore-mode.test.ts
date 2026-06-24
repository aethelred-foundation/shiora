/** @jest-environment node */

jest.mock('@/lib/api/env', () => ({ serverEnv: { isProduction: false } }));

import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { serverEnv } from '@/lib/api/env';

const mockEnv = serverEnv as unknown as { isProduction: boolean };
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  mockEnv.isProduction = false;
});

describe('shouldUsePostgres', () => {
  it('uses Postgres when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    expect(shouldUsePostgres()).toBe(true);
  });

  it('falls back to in-memory outside production when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    mockEnv.isProduction = false;
    expect(shouldUsePostgres()).toBe(false);
  });

  it('throws in production when DATABASE_URL is unset (no in-memory PHI)', () => {
    delete process.env.DATABASE_URL;
    mockEnv.isProduction = true;
    expect(() => shouldUsePostgres()).toThrow(/DATABASE_URL must be set in production/);
  });

  it('uses Postgres in production when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    mockEnv.isProduction = true;
    expect(shouldUsePostgres()).toBe(true);
  });
});
