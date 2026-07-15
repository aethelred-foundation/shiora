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
import { assertProductionReadiness, hasDurableDatastore } from '@/lib/api/preflight';
import { startMaintenanceScheduler } from '@/lib/maintenance/store-maintenance';

const mockPreload = preloadKeyProvider as jest.Mock;
const mockAssert = assertProductionReadiness as jest.Mock;
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
});
