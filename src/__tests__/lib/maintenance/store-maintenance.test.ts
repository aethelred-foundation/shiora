/** @jest-environment node */

jest.mock('@/lib/persistence/nonce-store', () => ({ getNonceStore: jest.fn() }));
jest.mock('@/lib/persistence/revocation-store', () => ({ getRevocationStore: jest.fn() }));
jest.mock('@/lib/api/rate-limiter', () => ({ getRateLimiter: jest.fn() }));
jest.mock('@/lib/persistence/session-index-store', () => ({ getSessionIndexStore: jest.fn() }));
jest.mock('@/lib/persistence/idempotency-store', () => ({ getIdempotencyStore: jest.fn() }));
jest.mock('@/lib/persistence/login-attempt-store', () => ({ getLoginAttemptStore: jest.fn() }));
jest.mock('@/lib/persistence/challenge-store', () => ({ getChallengeStore: jest.fn() }));
jest.mock('@/lib/maintenance/retention', () => ({
  runDurableRetention: jest.fn(async () => ({ durable: true, retentionDays: null, documentsPurged: 0, recordsPurged: 0, ranAt: 0 })),
}));
jest.mock('@/lib/api/preflight', () => ({ hasDurableDatastore: jest.fn(() => false) }));
jest.mock('@/lib/api/anchoring/anchor-outbox', () => ({
  runAnchorOutbox: jest.fn(async () => ({
    cut: 1, processed: 1, submitted: 0, confirmed: 1, pending: 0, retried: 0, dead: 0, errors: 0,
  })),
}));

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
import { getSessionIndexStore } from '@/lib/persistence/session-index-store';
import { getIdempotencyStore } from '@/lib/persistence/idempotency-store';
import { getLoginAttemptStore } from '@/lib/persistence/login-attempt-store';
import { getChallengeStore } from '@/lib/persistence/challenge-store';
import { hasDurableDatastore } from '@/lib/api/preflight';
import { runAnchorOutbox } from '@/lib/api/anchoring/anchor-outbox';

const mockNonces = getNonceStore as jest.Mock;
const mockRevocations = getRevocationStore as jest.Mock;
const mockLimiter = getRateLimiter as jest.Mock;
const mockSessions = getSessionIndexStore as jest.Mock;
const mockIdempotency = getIdempotencyStore as jest.Mock;
const mockLogin = getLoginAttemptStore as jest.Mock;
const mockChallenges = getChallengeStore as jest.Mock;
const mockDurable = hasDurableDatastore as jest.Mock;
const mockOutbox = runAnchorOutbox as jest.Mock;

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
    const sessionPrune = jest.fn(async () => 9);
    const idemPrune = jest.fn(async () => 11);
    const loginPrune = jest.fn(async () => 13);
    const challengePrune = jest.fn(async () => 17);
    mockNonces.mockReturnValue({ prune: noncePrune });
    mockRevocations.mockReturnValue({ prune: revocationPrune });
    mockLimiter.mockReturnValue({ prune: limiterPrune });
    mockSessions.mockReturnValue({ prune: sessionPrune });
    mockIdempotency.mockReturnValue({ prune: idemPrune });
    mockLogin.mockReturnValue({ prune: loginPrune });
    mockChallenges.mockReturnValue({ prune: challengePrune });

    const report = await runStoreMaintenance(1_000_000);

    expect(report).toMatchObject({
      durable: true,
      prunedNonces: 3,
      prunedRevocations: 5,
      prunedRateLimitWindows: 7,
      prunedSessions: 9,
      prunedIdempotencyKeys: 11,
      prunedLoginAttempts: 13,
      prunedWebauthnChallenges: 17,
      anchorOutbox: {
        cut: 1, processed: 1, submitted: 0, confirmed: 1, pending: 0, retried: 0, dead: 0, errors: 0,
      },
      ranAt: 1_000_000,
    });
    expect(mockOutbox).toHaveBeenCalledWith(1_000_000);
    expect(noncePrune).toHaveBeenCalledWith(1_000_000);
    expect(revocationPrune).toHaveBeenCalledWith(1_000_000);
    expect(sessionPrune).toHaveBeenCalledWith(1_000_000);
    expect(idemPrune).toHaveBeenCalledWith(1_000_000);
    expect(loginPrune).toHaveBeenCalledWith(1_000_000);
    expect(challengePrune).toHaveBeenCalledWith(1_000_000);
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
    mockSessions.mockReturnValue({});
    mockIdempotency.mockReturnValue({});
    mockLogin.mockReturnValue({});
    mockChallenges.mockReturnValue({});

    const report = await runStoreMaintenance();

    expect(report.durable).toBe(false);
    expect(report.prunedNonces).toBe(0);
    expect(report.prunedRevocations).toBe(0);
    expect(report.prunedRateLimitWindows).toBe(0);
    expect(report.prunedSessions).toBe(0);
    expect(report.prunedIdempotencyKeys).toBe(0);
    expect(report.prunedLoginAttempts).toBe(0);
    expect(report.prunedWebauthnChallenges).toBe(0);
    expect(typeof report.ranAt).toBe('number');
    // The anchor outbox runs regardless of datastore mode — an in-memory
    // deployment still cuts and locally records its segments.
    expect(mockOutbox).toHaveBeenCalled();
    expect(report.anchorOutbox).toEqual({
      cut: 1, processed: 1, submitted: 0, confirmed: 1, pending: 0, retried: 0, dead: 0, errors: 0,
    });
  });
});

describe('maintenance scheduler', () => {
  it('runs maintenance on the interval and is idempotent to start', async () => {
    jest.useFakeTimers();
    const noncePrune = jest.fn(async () => 1);
    mockNonces.mockReturnValue({ prune: noncePrune });
    mockRevocations.mockReturnValue({});
    mockLimiter.mockReturnValue({});
    mockSessions.mockReturnValue({});
    mockIdempotency.mockReturnValue({});
    mockLogin.mockReturnValue({});
    mockChallenges.mockReturnValue({});
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
    mockSessions.mockReturnValue({});
    mockIdempotency.mockReturnValue({});
    mockLogin.mockReturnValue({});
    mockChallenges.mockReturnValue({});
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
