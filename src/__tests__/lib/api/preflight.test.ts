/** @jest-environment node */

jest.mock('@/lib/api/env', () => ({
  serverEnv: {
    isProduction: true,
    hasConfiguredSessionSecret: true,
    allowInsecureWalletHeader: false,
  },
}));
jest.mock('@/lib/crypto/key-provider', () => ({ hasConfiguredDataKey: jest.fn(() => true) }));

import {
  checkProductionReadiness,
  assertProductionReadiness,
  hasDurableDatastore,
} from '@/lib/api/preflight';
import { serverEnv } from '@/lib/api/env';
import { hasConfiguredDataKey } from '@/lib/crypto/key-provider';

const mockServerEnv = serverEnv as unknown as {
  isProduction: boolean;
  hasConfiguredSessionSecret: boolean;
  allowInsecureWalletHeader: boolean;
};
const mockHasKey = hasConfiguredDataKey as jest.Mock;
const originalDatabaseUrl = process.env.DATABASE_URL;

function codes(): string[] {
  return checkProductionReadiness().problems.map((p) => p.code);
}

beforeEach(() => {
  // A fully-configured production baseline that passes every check.
  process.env.DATABASE_URL = 'postgres://localhost/shiora';
  mockServerEnv.isProduction = true;
  mockServerEnv.hasConfiguredSessionSecret = true;
  mockServerEnv.allowInsecureWalletHeader = false;
  mockHasKey.mockReturnValue(true);
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('hasDurableDatastore', () => {
  it('is true only when DATABASE_URL is set', () => {
    expect(hasDurableDatastore()).toBe(true);
    delete process.env.DATABASE_URL;
    expect(hasDurableDatastore()).toBe(false);
  });
});

describe('checkProductionReadiness', () => {
  it('passes with a complete production configuration', () => {
    const report = checkProductionReadiness();
    expect(report.ok).toBe(true);
    expect(report.enforced).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it('flags a missing durable datastore', () => {
    delete process.env.DATABASE_URL;
    expect(codes()).toContain('DATASTORE_NOT_DURABLE');
    expect(checkProductionReadiness().ok).toBe(false);
  });

  it('flags the default data-encryption key', () => {
    mockHasKey.mockReturnValue(false);
    expect(codes()).toContain('DATA_KEY_DEFAULT');
  });

  it('flags a missing session secret', () => {
    mockServerEnv.hasConfiguredSessionSecret = false;
    expect(codes()).toContain('SESSION_SECRET_DEFAULT');
  });

  it('flags the insecure wallet-header bypass', () => {
    mockServerEnv.allowInsecureWalletHeader = true;
    expect(codes()).toContain('INSECURE_WALLET_HEADER_ENABLED');
  });

  it('reports problems but stays ok outside production', () => {
    mockServerEnv.isProduction = false;
    delete process.env.DATABASE_URL;
    const report = checkProductionReadiness();
    expect(report.enforced).toBe(false);
    expect(report.ok).toBe(true); // advisory only outside production
    expect(report.problems.length).toBeGreaterThan(0);
  });
});

describe('assertProductionReadiness', () => {
  it('does not throw when the configuration is complete', () => {
    expect(() => assertProductionReadiness()).not.toThrow();
  });

  it('throws in production when a check fails', () => {
    delete process.env.DATABASE_URL;
    expect(() => assertProductionReadiness()).toThrow(/preflight failed/i);
  });

  it('does not throw outside production even with problems', () => {
    mockServerEnv.isProduction = false;
    delete process.env.DATABASE_URL;
    expect(() => assertProductionReadiness()).not.toThrow();
  });
});
