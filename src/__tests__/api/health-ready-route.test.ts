/** @jest-environment node */

jest.mock('@/lib/api/preflight', () => ({
  checkProductionReadiness: jest.fn(),
  hasDurableDatastore: jest.fn(),
}));
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(),
}));

import { GET } from '@/app/api/health/ready/route';
import { checkProductionReadiness, hasDurableDatastore } from '@/lib/api/preflight';
import { getPgClient } from '@/lib/persistence/sql-client';

const mockCheck = checkProductionReadiness as jest.Mock;
const mockHasDurable = hasDurableDatastore as jest.Mock;
const mockGetPgClient = getPgClient as jest.Mock;

const OK = { ok: true, enforced: false, problems: [] };

beforeEach(() => {
  mockCheck.mockReturnValue(OK);
  mockHasDurable.mockReturnValue(false);
});

afterEach(() => jest.clearAllMocks());

describe('/api/health/ready', () => {
  it('is ready on the in-memory datastore when config passes', async () => {
    mockHasDurable.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('ready');
    expect(body.data.checks.datastore).toEqual({ ok: true, driver: 'in-memory' });
  });

  it('is ready when the Postgres datastore round-trips', async () => {
    mockHasDurable.mockReturnValue(true);
    mockGetPgClient.mockReturnValue({ query: jest.fn().mockResolvedValue({ rows: [{}] }) });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.checks.datastore).toEqual({ ok: true, driver: 'postgres' });
  });

  it('returns 503 when the datastore is unreachable', async () => {
    mockHasDurable.mockReturnValue(true);
    mockGetPgClient.mockReturnValue({ query: jest.fn().mockRejectedValue(new Error('down')) });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_READY');
    expect(body.error.details.datastore.ok).toBe(false);
  });

  it('returns 503 when the production configuration is incomplete', async () => {
    mockCheck.mockReturnValue({
      ok: false,
      enforced: true,
      problems: [{ code: 'DATASTORE_NOT_DURABLE', message: 'x' }],
    });
    mockHasDurable.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_READY');
    expect(body.error.details.config.ok).toBe(false);
  });
});
