/** @jest-environment node */

jest.mock('@/lib/persistence/nonce-store', () => ({ getNonceStore: jest.fn() }));
jest.mock('@/lib/persistence/revocation-store', () => ({ getRevocationStore: jest.fn() }));
jest.mock('@/lib/api/rate-limiter', () => ({ getRateLimiter: jest.fn() }));
jest.mock('@/lib/api/preflight', () => ({ hasDurableDatastore: jest.fn(() => false) }));

import {
  runStoreMaintenance,
  startMaintenanceScheduler,
  stopMaintenanceScheduler,
  RATE_LIMIT_RETENTION_MS,
  DEFAULT_MAINTENANCE_INTERVAL_MS,
} from '@/lib/maintenance/store-maintenance';
import { getNonceStore } from '@/lib/persistence/nonce-store';
import { getRevocationStore } from '@/lib/persistence/revocation-store';
import { getRateLimiter } from '@/lib/api/rate-limiter';
import { hasDurableDatastore } from '@/lib/api/preflight';

const mockNonces = getNonceStore as jest.Mock;
const mockRevocations = getRevocationStore as jest.Mock;
const mockLimiter = getRateLimiter as jest.Mock;
const mockDurable = hasDurableDatastore as jest.Mock;

let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  stopMaintenanceScheduler();
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('runStoreMaintenance', () => {
  it('prunes every durable store and reports the counts', async () => {
    mockDurable.mockReturnValue(true);
    const noncePrune = jest.fn(async () => 3);
    const revocationPrune = jest.fn(async () => 5);
    const limiterPrune = jest.fn(async () => 7);
    mockNonces.mockReturnValue({ prune: noncePrune });
    mockRevocations.mockReturnValue({ prune: revocationPrune });
    mockLimiter.mockReturnValue({ prune: limiterPrune });

    const report = await runStoreMaintenance(1_000_000);

    expect(report).toMatchObject({
      durable: true,
      prunedNonces: 3,
      prunedRevocations: 5,
      prunedRateLimitWindows: 7,
      ranAt: 1_000_000,
    });
    expect(noncePrune).toHaveBeenCalledWith(1_000_000);
    expect(revocationPrune).toHaveBeenCalledWith(1_000_000);
    // The rate limiter prunes by retention window, not "now".
    expect(limiterPrune).toHaveBeenCalledWith(RATE_LIMIT_RETENTION_MS);
    // Structured completion log emitted.
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"subsystem":"maintenance"'));
  });

  it('skips in-memory stores (no prune method) and reports zeros', async () => {
    mockDurable.mockReturnValue(false);
    mockNonces.mockReturnValue({});
    mockRevocations.mockReturnValue({});
    mockLimiter.mockReturnValue({});

    const report = await runStoreMaintenance();

    expect(report.durable).toBe(false);
    expect(report.prunedNonces).toBe(0);
    expect(report.prunedRevocations).toBe(0);
    expect(report.prunedRateLimitWindows).toBe(0);
    expect(typeof report.ranAt).toBe('number');
  });
});

describe('maintenance scheduler', () => {
  it('runs maintenance on the interval and is idempotent to start', async () => {
    jest.useFakeTimers();
    const noncePrune = jest.fn(async () => 1);
    mockNonces.mockReturnValue({ prune: noncePrune });
    mockRevocations.mockReturnValue({});
    mockLimiter.mockReturnValue({});
    mockDurable.mockReturnValue(true);

    expect(startMaintenanceScheduler(1000)).toBe(true);
    expect(startMaintenanceScheduler(1000)).toBe(false); // already running

    await jest.advanceTimersByTimeAsync(1000);
    expect(noncePrune).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(noncePrune).toHaveBeenCalledTimes(2);
  });

  it('survives a failing sweep and records the error', async () => {
    jest.useFakeTimers();
    mockNonces.mockReturnValue({ prune: jest.fn(async () => { throw new Error('pg down'); }) });
    mockRevocations.mockReturnValue({});
    mockLimiter.mockReturnValue({});
    mockDurable.mockReturnValue(true);

    startMaintenanceScheduler(1000);
    await jest.advanceTimersByTimeAsync(1000);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('store maintenance failed'));

    // The scheduler keeps ticking after the failure.
    await jest.advanceTimersByTimeAsync(1000);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('stopMaintenanceScheduler is a no-op when not running, and the default interval applies', () => {
    stopMaintenanceScheduler();
    stopMaintenanceScheduler();
    expect(DEFAULT_MAINTENANCE_INTERVAL_MS).toBe(15 * 60 * 1000);
    expect(startMaintenanceScheduler()).toBe(true); // default 15-minute cadence
  });
});
