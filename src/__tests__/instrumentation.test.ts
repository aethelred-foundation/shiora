/** @jest-environment node */

jest.mock('@/lib/crypto/key-provider', () => ({ preloadKeyProvider: jest.fn() }));
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

import { register } from '@/instrumentation';
import { preloadKeyProvider } from '@/lib/crypto/key-provider';
import {
  assertProductionReadiness,
  checkProductionReadiness,
  hasDurableDatastore,
} from '@/lib/api/preflight';
import { startMaintenanceScheduler } from '@/lib/maintenance/store-maintenance';

const mockPreload = preloadKeyProvider as jest.Mock;
const mockAssert = assertProductionReadiness as jest.Mock;
const mockCheck = checkProductionReadiness as jest.Mock;
const mockDurable = hasDurableDatastore as jest.Mock;
const mockStartScheduler = startMaintenanceScheduler as jest.Mock;
const originalRuntime = process.env.NEXT_RUNTIME;

afterEach(() => {
  if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = originalRuntime;
  jest.clearAllMocks();
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

  it('starts the store-maintenance scheduler on durable deployments (GAP-01)', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockDurable.mockReturnValueOnce(true);
    await register();
    expect(mockStartScheduler).toHaveBeenCalledTimes(1);
  });

  it('prints the acknowledged-gaps banner on an evaluation deployment', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockCheck.mockReturnValueOnce({
      ok: true,
      enforced: true,
      mode: 'evaluation',
      problems: [],
      acknowledged: [
        { code: 'TRANSPORT_NOT_HARDENED', message: 'SHIORA_ENABLE_HSTS is not enabled.' },
        { code: 'DATASTORE_NOT_DURABLE', message: 'DATABASE_URL is not set.' },
      ],
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await register();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const banner = warnSpy.mock.calls[0][0] as string;
      expect(banner).toContain('SHIORA EVALUATION DEPLOYMENT');
      expect(banner).toContain('TRANSPORT_NOT_HARDENED');
      expect(banner).toContain('DATASTORE_NOT_DURABLE');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('boots silently in evaluation mode when nothing is acknowledged', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    mockCheck.mockReturnValueOnce({
      ok: true,
      enforced: true,
      mode: 'evaluation',
      problems: [],
      acknowledged: [],
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await register();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
