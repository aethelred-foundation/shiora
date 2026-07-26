/** @jest-environment node */

jest.mock('@/lib/crypto/key-provider', () => ({ preloadKeyProvider: jest.fn() }));
jest.mock('@/lib/crypto/dek-wrapper', () => ({
  isTransitConfigured: jest.fn(() => false),
  probeManagedDekCustody: jest.fn(),
}));
jest.mock('@/lib/crypto/vault-key-provider', () => ({ isVaultConfigured: jest.fn(() => false) }));
jest.mock('@/lib/api/preflight', () => ({
  assertProductionReadiness: jest.fn(),
  checkProductionReadiness: jest.fn(() => ({
    ok: true,
    enforced: false,
    mode: 'development',
    problems: [],
    acknowledged: [],
  })),
  hasDurableDatastore: jest.fn(() => false),
}));
jest.mock('@/lib/maintenance/store-maintenance', () => ({ startMaintenanceScheduler: jest.fn() }));
jest.mock('@/lib/persistence/migrator', () => ({
  migrate: jest.fn(async () => ({ applied: [], alreadyApplied: 0 })),
}));
jest.mock('@/lib/persistence/sql-client', () => ({ getPgClient: jest.fn(() => ({})) }));

import { register } from '@/instrumentation';
import { preloadKeyProvider } from '@/lib/crypto/key-provider';
import { isTransitConfigured, probeManagedDekCustody } from '@/lib/crypto/dek-wrapper';
import { isVaultConfigured } from '@/lib/crypto/vault-key-provider';
import {
  assertProductionReadiness,
  checkProductionReadiness,
  hasDurableDatastore,
} from '@/lib/api/preflight';
import { startMaintenanceScheduler } from '@/lib/maintenance/store-maintenance';
import { migrate } from '@/lib/persistence/migrator';

const mockPreload = preloadKeyProvider as jest.Mock;
const mockTransitConfigured = isTransitConfigured as jest.Mock;
const mockProbeCustody = probeManagedDekCustody as jest.Mock;
const mockVaultConfigured = isVaultConfigured as jest.Mock;
const mockAssert = assertProductionReadiness as jest.Mock;
const mockCheck = checkProductionReadiness as jest.Mock;
const mockDurable = hasDurableDatastore as jest.Mock;
const mockStartScheduler = startMaintenanceScheduler as jest.Mock;
const mockMigrate = migrate as jest.Mock;
const originalRuntime = process.env.NEXT_RUNTIME;

afterEach(() => {
  if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = originalRuntime;
  jest.clearAllMocks();
  mockTransitConfigured.mockReturnValue(false);
  mockVaultConfigured.mockReturnValue(false);
});

describe('register (startup instrumentation)', () => {
  it('is a no-op outside the nodejs runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    await register();
    expect(mockPreload).not.toHaveBeenCalled();
    expect(mockAssert).not.toHaveBeenCalled();
  });

  it('warms key custody and asserts production readiness on the nodejs runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    await register();
    expect(mockPreload).toHaveBeenCalledTimes(1);
    expect(mockAssert).toHaveBeenCalledTimes(1);
    // In-memory deployment: no durable stores to garbage-collect.
    expect(mockStartScheduler).not.toHaveBeenCalled();
  });

  it('does not preload an in-process KEK for a fresh Transit-only deployment', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockTransitConfigured.mockReturnValue(true);
    await register();
    expect(mockPreload).not.toHaveBeenCalled();
    expect(mockAssert).toHaveBeenCalledTimes(1);
    expect(mockProbeCustody).toHaveBeenCalledTimes(1);
  });

  it('preloads a configured Vault KV key for legacy envelopes alongside Transit', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockTransitConfigured.mockReturnValue(true);
    mockVaultConfigured.mockReturnValue(true);
    await register();
    expect(mockPreload).toHaveBeenCalledTimes(1);
  });

  it('starts the store-maintenance scheduler on durable deployments (GAP-01)', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockDurable.mockReturnValueOnce(true);
    await register();
    expect(mockStartScheduler).toHaveBeenCalledTimes(1);
  });

  it('applies pending schema migrations before serving durable deployments', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockDurable.mockReturnValueOnce(true);
    await register();
    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });

  it('skips auto-migration when SHIORA_AUTO_MIGRATE=false (pipeline-owned)', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.SHIORA_AUTO_MIGRATE = 'false';
    mockDurable.mockReturnValueOnce(true);
    try {
      await register();
      expect(mockMigrate).not.toHaveBeenCalled();
      expect(mockStartScheduler).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.SHIORA_AUTO_MIGRATE;
    }
  });

  it('does not touch the migrator on in-memory deployments', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    await register();
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it('prints every acknowledged gap for an evaluation deployment', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockCheck.mockReturnValueOnce({
      ok: true,
      enforced: true,
      mode: 'evaluation',
      problems: [],
      acknowledged: [{ code: 'NON_TLS_BACKEND', message: 'Backend transport is not TLS.' }],
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await register();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('NON_TLS_BACKEND: Backend transport is not TLS.'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('logs the schema migrations applied during durable startup', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockDurable.mockReturnValueOnce(true);
    mockMigrate.mockResolvedValueOnce({
      applied: ['001_initial', '002_access_grants'],
      alreadyApplied: 3,
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await register();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('"msg":"database migrations applied"'),
      );
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('"applied":["001_initial","002_access_grants"]'),
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('"alreadyApplied":3'));
    } finally {
      log.mockRestore();
    }
  });
});
