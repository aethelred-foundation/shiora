/** @jest-environment node */

jest.mock('@/lib/api/env', () => ({ serverEnv: { isProduction: false } }));
jest.mock('@/lib/api/preflight', () => ({ preflightMode: jest.fn(() => 'development') }));

import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { serverEnv } from '@/lib/api/env';
import { preflightMode } from '@/lib/api/preflight';

const mockEnv = serverEnv as unknown as { isProduction: boolean };
const mockMode = preflightMode as jest.Mock;
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

describe('shouldUsePostgres under the evaluation preflight mode', () => {
  it('permits the in-memory store for an acknowledged evaluation deployment', () => {
    delete process.env.DATABASE_URL;
    mockEnv.isProduction = true;
    mockMode.mockReturnValue('evaluation');
    try {
      expect(shouldUsePostgres()).toBe(false);
    } finally {
      mockMode.mockReturnValue('development');
    }
  });

  it('still prefers Postgres in evaluation when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    mockEnv.isProduction = true;
    mockMode.mockReturnValue('evaluation');
    try {
      expect(shouldUsePostgres()).toBe(true);
    } finally {
      mockMode.mockReturnValue('development');
    }
  });
});
