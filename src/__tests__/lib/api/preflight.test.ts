/** @jest-environment node */

jest.mock('@/lib/api/env', () => ({
  serverEnv: {
    isProduction: true,
    hasConfiguredSessionSecret: true,
    allowInsecureWalletHeader: false,
    enableHsts: true,
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
  enableHsts: boolean;
};
const mockHasKey = hasConfiguredDataKey as jest.Mock;
const MANAGED_ENVS = ['DATABASE_URL', 'SHIORA_TRANSIT_KEY_NAME', 'SHIORA_VAULT_ADDR', 'SHIORA_VAULT_TOKEN'] as const;
const savedEnv: Record<string, string | undefined> = {};

function codes(): string[] {
  return checkProductionReadiness().problems.map((p) => p.code);
}

beforeEach(() => {
  for (const key of MANAGED_ENVS) savedEnv[key] = process.env[key];
  // A fully-configured production baseline that passes every check.
  process.env.DATABASE_URL = 'postgres://localhost/shiora';
  process.env.SHIORA_TRANSIT_KEY_NAME = 'shiora-kek';
  process.env.SHIORA_VAULT_ADDR = 'https://vault.internal:8200';
  process.env.SHIORA_VAULT_TOKEN = 's.token';
  mockServerEnv.isProduction = true;
  mockServerEnv.hasConfiguredSessionSecret = true;
  mockServerEnv.allowInsecureWalletHeader = false;
  mockServerEnv.enableHsts = true;
  mockHasKey.mockReturnValue(true);
});

afterEach(() => {
  for (const key of MANAGED_ENVS) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
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

  it('flags production key custody that is not Vault Transit (§7)', () => {
    delete process.env.SHIORA_TRANSIT_KEY_NAME;
    expect(codes()).toContain('KEY_CUSTODY_NOT_TRANSIT');
    expect(checkProductionReadiness().ok).toBe(false);
  });

  it('flags a missing session secret', () => {
    mockServerEnv.hasConfiguredSessionSecret = false;
    expect(codes()).toContain('SESSION_SECRET_DEFAULT');
  });

  it('flags the insecure wallet-header bypass', () => {
    mockServerEnv.allowInsecureWalletHeader = true;
    expect(codes()).toContain('INSECURE_WALLET_HEADER_ENABLED');
  });

  it('flags transport that is not hardened (HSTS disabled)', () => {
    mockServerEnv.enableHsts = false;
    expect(codes()).toContain('TRANSPORT_NOT_HARDENED');
    expect(checkProductionReadiness().ok).toBe(false);
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
